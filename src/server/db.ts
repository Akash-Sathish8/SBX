// D1 data layer — the app reads games/teams/venues from SQL (system of record),
// not from ESPN per-request. ESPN is only the ingest source (scripts/ingest.mjs).
// Binding `DB` is declared in wrangler.jsonc; in the Workers runtime it's reached
// via the `cloudflare:workers` env.
import { env } from 'cloudflare:workers'
import type { Game, GameTeam, Venue, TeamInfo } from '../lib/espn'
import type { League } from '../lib/sports'
import { escapeLike } from '../lib/searchScore'

const db = () => (env as any).DB as D1Database

type Row = Record<string, any>

function team(r: Row, side: 'home' | 'away'): GameTeam {
  const p = (k: string) => r[`${side}_${k}`]
  return {
    id: String(p('team_id') ?? ''),
    abbr: p('abbr') ?? '',
    location: p('location') ?? '',
    name: p('name') ?? '',
    displayName: p('display') ?? '',
    shortName: p('abbr') ?? '',
    color: p('color') ?? undefined,
    altColor: undefined,
    logo: p('logo') ?? undefined,
    score: p('score') === null || p('score') === undefined ? null : Number(p('score')),
    homeAway: side,
    winner: !!p('winner'),
  }
}

function rowToGame(r: Row): Game {
  return {
    id: String(r.id),
    league: r.league as League,
    date: r.date,
    name: r.name ?? '',
    shortName: r.short_name ?? '',
    state: r.state ?? 'unknown',
    detail: r.detail ?? '',
    completed: !!r.completed,
    venue: { id: r.venue_id != null ? String(r.venue_id) : undefined, name: r.venue_name ?? undefined, city: r.venue_city ?? undefined, state: r.venue_state ?? undefined },
    home: team(r, 'home'),
    away: team(r, 'away'),
  }
}

export interface GamesQuery {
  league?: League
  from?: string // ISO date lower bound (inclusive)
  to?: string // ISO date upper bound (inclusive)
  team?: string // team abbr (home or away)
  limit?: number
  order?: 'asc' | 'desc'
}

export async function dbGames(opts: GamesQuery = {}): Promise<Game[]> {
  const where: string[] = []
  const binds: any[] = []
  if (opts.league) { where.push('league = ?'); binds.push(opts.league) }
  if (opts.from) { where.push('date >= ?'); binds.push(opts.from) }
  if (opts.to) { where.push('date <= ?'); binds.push(opts.to) }
  if (opts.team) { where.push('(home_abbr = ? OR away_abbr = ?)'); binds.push(opts.team, opts.team) }
  const sql =
    `SELECT * FROM games ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ` +
    `ORDER BY date ${opts.order === 'desc' ? 'DESC' : 'ASC'} LIMIT ?`
  binds.push(Math.min(opts.limit ?? 300, 2000))
  const { results } = await db().prepare(sql).bind(...binds).all<Row>()
  return (results ?? []).map(rowToGame)
}

export async function dbGameById(id: string, league?: League): Promise<Game | null> {
  const sql = league
    ? 'SELECT * FROM games WHERE id = ? AND league = ? LIMIT 1'
    : 'SELECT * FROM games WHERE id = ? LIMIT 1'
  const binds = league ? [id, league] : [id]
  const { results } = await db().prepare(sql).bind(...binds).all<Row>()
  return results && results.length ? rowToGame(results[0]) : null
}

export async function dbTeams(league?: League): Promise<TeamInfo[]> {
  const sql = `SELECT * FROM teams ${league ? 'WHERE league = ?' : ''} ORDER BY display_name`
  const stmt = league ? db().prepare(sql).bind(league) : db().prepare(sql)
  const { results } = await stmt.all<Row>()
  return (results ?? []).map((t) => ({
    id: String(t.id),
    abbr: t.abbr ?? '',
    location: t.location ?? '',
    name: t.name ?? '',
    displayName: t.display_name ?? '',
    shortDisplayName: t.abbr ?? '',
    color: t.color ?? undefined,
    altColor: t.alt_color ?? undefined,
    logo: t.logo ?? undefined,
    logoDark: undefined,
  }))
}

export async function dbVenues(league?: League): Promise<Venue[]> {
  const sql =
    `SELECT v.*, vt.league AS tl, t.id AS tid, t.abbr AS tabbr, t.display_name AS tdisplay, t.logo AS tlogo, ` +
    `c.name AS conf_name, c.short_name AS conf_short ` +
    // LEFT JOINs: event venues (racetracks, golf courses, ...) have no tenant
    // teams but still need venue pages; a league filter still narrows to that
    // league's home grounds because WHERE vt.league drops team-less rows.
    `FROM venues v LEFT JOIN venue_teams vt ON vt.venue_id = v.id ` +
    `LEFT JOIN teams t ON t.league = vt.league AND t.id = vt.team_id ` +
    `LEFT JOIN conference_teams ct ON ct.league = vt.league AND ct.team_id = vt.team_id ` +
    `LEFT JOIN conferences c ON c.league = ct.league AND c.id = ct.conference_id ` +
    `${league ? 'WHERE vt.league = ?' : ''} ORDER BY v.name`
  const stmt = league ? db().prepare(sql).bind(league) : db().prepare(sql)
  const { results } = await stmt.all<Row>()
  const byId = new Map<string, Venue>()
  for (const r of results ?? []) {
    const id = String(r.id)
    let v = byId.get(id)
    if (!v) {
      v = {
        id,
        name: r.name,
        city: r.city ?? undefined,
        state: r.state ?? undefined,
        zip: r.zip ?? undefined,
        surface: (r.surface as 'grass' | 'turf') ?? undefined,
        indoor: r.indoor === null || r.indoor === undefined ? undefined : !!r.indoor,
        image: r.image ?? undefined,
        teams: [],
      }
      byId.set(id, v)
    }
    if (r.tl) v.teams.push({ league: r.tl as League, id: String(r.tid), abbr: r.tabbr ?? '', displayName: r.tdisplay ?? '', logo: r.tlogo ?? undefined, conference: r.conf_name ?? undefined, conferenceShort: r.conf_short ?? undefined })
  }
  return [...byId.values()]
}

// Single venue by id (reuses the dbVenues join — teams + conference). Venue count
// is small and the assistant calls this once per request, so no separate query.
export async function dbVenueById(id: string): Promise<Venue | null> {
  const all = await dbVenues()
  return all.find((v) => v.id === id) ?? null
}

// ---- free-text search candidates (/api/search). SQL only guarantees every
// token appears somewhere in the row's haystack (token-AND LIKE — this is what
// makes mid-word partials like "rigley" work); ranking happens in JS via
// lib/searchScore so it's unit-testable. Tables are small (≤~13k rows), so a
// full LIKE scan is single-digit ms — no FTS index needed. ----

function tokenWhere(haystack: string, tokens: string[]): { where: string; binds: string[] } {
  return {
    where: tokens.map(() => `${haystack} LIKE ? ESCAPE '\\'`).join(' AND '),
    binds: tokens.map((t) => `%${escapeLike(t)}%`),
  }
}

export interface TeamSearchRow {
  league: League
  id: string
  abbr: string
  displayName: string
  location: string
  logo?: string
  color?: string
  venueId?: string
  venueName?: string
}

export async function dbSearchTeams(tokens: string[]): Promise<TeamSearchRow[]> {
  const hay = `lower(t.display_name || ' ' || t.location || ' ' || t.name || ' ' || t.abbr)`
  const { where, binds } = tokenWhere(hay, tokens)
  const sql =
    `SELECT t.league, t.id, t.abbr, t.location, t.display_name, t.color, t.logo, ` +
    `v.id AS venue_id, v.name AS venue_name ` +
    `FROM teams t ` +
    `LEFT JOIN venue_teams vt ON vt.league = t.league AND vt.team_id = t.id ` +
    `LEFT JOIN venues v ON v.id = vt.venue_id ` +
    `WHERE ${where} LIMIT 40`
  const { results } = await db().prepare(sql).bind(...binds).all<Row>()
  const seen = new Map<string, TeamSearchRow>()
  for (const r of results ?? []) {
    const key = `${r.league}:${r.id}`
    if (seen.has(key)) continue // a team in several venue rows — keep the first
    seen.set(key, {
      league: r.league as League,
      id: String(r.id),
      abbr: r.abbr ?? '',
      displayName: r.display_name ?? '',
      location: r.location ?? '',
      logo: r.logo ?? undefined,
      color: r.color ?? undefined,
      venueId: r.venue_id != null ? String(r.venue_id) : undefined,
      venueName: r.venue_name ?? undefined,
    })
  }
  return [...seen.values()]
}

export interface VenueSearchRow {
  id: string
  name: string
  city?: string
  state?: string
  image?: string
  teams: { league: League; abbr: string; displayName: string }[]
}

// Tenant team names are part of the haystack so "cubs" finds Wrigley Field.
export async function dbSearchVenues(tokens: string[]): Promise<VenueSearchRow[]> {
  const hay =
    `lower(v.name || ' ' || coalesce(v.city,'') || ' ' || coalesce(v.state,'') || ' ' || coalesce(t.display_name,''))`
  const { where, binds } = tokenWhere(hay, tokens)
  const sql =
    `SELECT v.id, v.name, v.city, v.state, v.image, ` +
    `t.league AS tl, t.abbr AS tabbr, t.display_name AS tdisplay ` +
    `FROM venues v ` +
    `LEFT JOIN venue_teams vt ON vt.venue_id = v.id ` +
    `LEFT JOIN teams t ON t.league = vt.league AND t.id = vt.team_id ` +
    `WHERE ${where} LIMIT 60`
  const { results } = await db().prepare(sql).bind(...binds).all<Row>()
  const byId = new Map<string, VenueSearchRow>()
  for (const r of results ?? []) {
    const id = String(r.id)
    let v = byId.get(id)
    if (!v) {
      v = { id, name: r.name, city: r.city ?? undefined, state: r.state ?? undefined, image: r.image ?? undefined, teams: [] }
      byId.set(id, v)
    }
    if (r.tl && v.teams.length < 3) v.teams.push({ league: r.tl as League, abbr: r.tabbr ?? '', displayName: r.tdisplay ?? '' })
  }
  return [...byId.values()]
}

export interface GameSearchRow {
  league: League
  id: string
  name: string
  shortName: string
  date: string
  state: string
  venueName?: string
  venueCity?: string
}

// Two candidate pools keep results relevant without scanning the whole table
// into JS: nearest upcoming games plus a short tail of recent ones.
export async function dbSearchGames(tokens: string[], todayIso: string): Promise<GameSearchRow[]> {
  const hay =
    `lower(name || ' ' || short_name || ' ' || coalesce(venue_name,'') || ' ' || coalesce(venue_city,''))`
  const { where, binds } = tokenWhere(hay, tokens)
  const base = `SELECT league, id, name, short_name, date, state, venue_name, venue_city FROM games WHERE ${where}`
  const [up, past] = await Promise.all([
    db().prepare(`${base} AND date >= ? ORDER BY date ASC LIMIT 25`).bind(...binds, todayIso).all<Row>(),
    db().prepare(`${base} AND date < ? ORDER BY date DESC LIMIT 15`).bind(...binds, todayIso).all<Row>(),
  ])
  const row = (r: Row): GameSearchRow => ({
    league: r.league as League,
    id: String(r.id),
    name: r.name ?? '',
    shortName: r.short_name ?? '',
    date: r.date,
    state: r.state ?? 'unknown',
    venueName: r.venue_name ?? undefined,
    venueCity: r.venue_city ?? undefined,
  })
  return [...(up.results ?? []).map(row), ...(past.results ?? []).map(row)]
}

// ---- user rankings (the personal "make your rankings" list; mirrors MyRank in
// rank.tsx). The `unique` pillar maps to the `unique_` column (SQL keyword). ----
export interface UserRanking {
  gameId: string
  league: League
  away: string
  home: string
  awayLogo?: string
  homeLogo?: string
  date: string
  venue: string
  city?: string
  fans: number
  food: number
  unique: number
  stadium: number
  score: number
  ts: number
}

function rowToUserRanking(r: Row): UserRanking {
  return {
    gameId: String(r.game_id),
    league: r.league as League,
    away: r.away,
    home: r.home,
    awayLogo: r.away_logo ?? undefined,
    homeLogo: r.home_logo ?? undefined,
    date: r.date,
    venue: r.venue,
    city: r.city ?? undefined,
    fans: Number(r.fans),
    food: Number(r.food),
    unique: Number(r.unique_),
    stadium: Number(r.stadium),
    score: Number(r.score),
    ts: Number(r.ts),
  }
}

// order: 'score' (leaderboard, the default the API + venue page rely on) or
// 'recent' (reverse-chron by date attended — the Letterboxd diary feed).
export async function dbGetUserRankings(userId: string, order: 'score' | 'recent' = 'score'): Promise<UserRanking[]> {
  const orderBy = order === 'recent' ? 'date DESC, ts DESC' : 'score DESC'
  const { results } = await db()
    .prepare(`SELECT * FROM user_rankings WHERE user_id = ? ORDER BY ${orderBy}`)
    .bind(userId)
    .all<Row>()
  return (results ?? []).map(rowToUserRanking)
}

// Upsert-all: serves both the post-login bulk sync (whole list) and incremental
// single-game writes. Atomic via D1 batch (same idiom as cron.ts).
export async function dbUpsertUserRankings(userId: string, ranks: UserRanking[]): Promise<void> {
  if (!ranks.length) return
  const now = new Date().toISOString()
  const stmt = db().prepare(
    `INSERT INTO user_rankings
       (user_id, game_id, league, away, home, away_logo, home_logo, date, venue, city, fans, food, unique_, stadium, score, ts, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, game_id) DO UPDATE SET
       league=excluded.league, away=excluded.away, home=excluded.home,
       away_logo=excluded.away_logo, home_logo=excluded.home_logo, date=excluded.date,
       venue=excluded.venue, city=excluded.city, fans=excluded.fans, food=excluded.food,
       unique_=excluded.unique_, stadium=excluded.stadium, score=excluded.score,
       ts=excluded.ts, updated_at=excluded.updated_at`,
  )
  await db().batch(
    ranks.map((r) =>
      stmt.bind(
        userId, r.gameId, r.league, r.away, r.home, r.awayLogo ?? null, r.homeLogo ?? null,
        r.date, r.venue, r.city ?? null, r.fans, r.food, r.unique, r.stadium, r.score, r.ts, now, now,
      ),
    ),
  )
}

export async function dbDeleteUserRanking(userId: string, gameId: string): Promise<void> {
  await db().prepare('DELETE FROM user_rankings WHERE user_id = ? AND game_id = ?').bind(userId, gameId).run()
}

// ---- editable profile fields on the users row (bio + avatar + favorite venue
// ids). avatar is a small data: URL (128px webp), a 'preset:N' key, or NULL.
// favorites is a JSON array of up to 4 venue ids the user pinned. ----
export interface ProfileFields { displayName: string | null; bio: string | null; avatar: string | null; favorites: string[]; createdAt: string | null }

function parseFavorites(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const a = JSON.parse(raw)
    return Array.isArray(a) ? a.filter((x) => typeof x === 'string').slice(0, 4) : []
  } catch { return [] }
}

export async function dbGetProfileFields(userId: string): Promise<ProfileFields> {
  const row = await db()
    .prepare('SELECT display_name, bio, avatar, favorites, created_at FROM users WHERE id = ? LIMIT 1')
    .bind(userId)
    .first<{ display_name: string | null; bio: string | null; avatar: string | null; favorites: string | null; created_at: string | null }>()
  return { displayName: row?.display_name ?? null, bio: row?.bio ?? null, avatar: row?.avatar ?? null, favorites: parseFavorites(row?.favorites), createdAt: row?.created_at ?? null }
}

// Dynamic partial update — only the keys present in `f` are written. favorites is
// serialized to JSON (capped at 4). Caller validates sizes/shape before this.
export async function dbUpdateProfile(userId: string, f: { displayName?: string | null; bio?: string | null; avatar?: string | null; favorites?: string[] }): Promise<void> {
  const sets: string[] = []
  const binds: any[] = []
  if ('displayName' in f) { sets.push('display_name = ?'); binds.push(f.displayName ?? null) }
  if ('bio' in f) { sets.push('bio = ?'); binds.push(f.bio ?? null) }
  if ('avatar' in f) { sets.push('avatar = ?'); binds.push(f.avatar ?? null) }
  if ('favorites' in f) { sets.push('favorites = ?'); binds.push(JSON.stringify((f.favorites ?? []).slice(0, 4))) }
  if (!sets.length) return
  binds.push(userId)
  await db().prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run()
}

// ---- Fan ranking for a venue: the average of EVERY signed-in fan's ranking of a
// game at that venue (user_rankings stores the venue name on each row, so no game
// join is needed). Real, cross-user data — `count` is 0 until fans rank here. ----
export interface VenueFanStats { count: number; fans: number; food: number; unique: number; stadium: number; score: number }
export async function dbVenueFanStats(venue: string): Promise<VenueFanStats> {
  const row = await db()
    .prepare(
      `SELECT COUNT(*) AS n, AVG(fans) AS fans, AVG(food) AS food, AVG(unique_) AS unique_,
              AVG(stadium) AS stadium, AVG(score) AS score
         FROM user_rankings WHERE venue = ?`,
    )
    .bind(venue)
    .first<{ n: number; fans: number | null; food: number | null; unique_: number | null; stadium: number | null; score: number | null }>()
  const r1 = (n: number | null | undefined) => Math.round(Number(n ?? 0) * 10) / 10
  return {
    count: Number(row?.n ?? 0),
    fans: r1(row?.fans), food: r1(row?.food), unique: r1(row?.unique_), stadium: r1(row?.stadium), score: r1(row?.score),
  }
}

// The official Snapback account. Tips authored by this user id are editorial,
// first-party content (e.g. seeded from Snapback's own videos) — the API flags
// them so the UI can show the logo + verified badge instead of a fan handle.
export const OFFICIAL_USER_ID = 'snapback-official'

// Accounts that render with an avatar + verified checkmark on their tips/reviews
// (the official Snapback account + seeded first-party voices like Jack Settleman).
export const VERIFIED_USER_IDS = new Set<string>([OFFICIAL_USER_ID, 'jack-settleman'])

// ---- crowdsourced tips (the "what to know" layer; src/components/WhatToKnow.tsx).
// `userId` is internal — the API strips it and exposes a `mine` flag instead. ----
export interface Tip {
  id: string
  scope: string
  targetId: string
  section: string
  author: string
  avatar?: string | null // author's avatar (joined from users) — used for verified voices
  body: string
  createdAt: string
  userId: string
  up: number // tip_votes aggregates (0 when the query doesn't join them)
  down: number
}

function rowToTip(r: Row): Tip {
  return {
    id: String(r.id),
    scope: r.scope,
    targetId: String(r.target_id),
    section: r.section,
    author: r.author,
    avatar: r._avatar ?? undefined,
    body: r.body,
    createdAt: r.created_at,
    userId: String(r.user_id),
    up: Number(r._up ?? 0),
    down: Number(r._down ?? 0),
  }
}

// Aggregated up/down counts per tip, LEFT JOINed into tip reads (the tips
// mirror of the reviews VOTE_JOIN below).
const TIP_VOTE_JOIN =
  'LEFT JOIN (SELECT tip_id, SUM(vote = 1) AS up, SUM(vote = -1) AS down FROM tip_votes GROUP BY tip_id) tv ON tv.tip_id = t.id'

export async function dbGetTips(scope: string, targetId: string): Promise<Tip[]> {
  const { results } = await db()
    .prepare(`SELECT t.*, u.avatar AS _avatar, COALESCE(tv.up, 0) AS _up, COALESCE(tv.down, 0) AS _down FROM tips t LEFT JOIN users u ON u.id = t.user_id ${TIP_VOTE_JOIN} WHERE t.scope = ? AND t.target_id = ? ORDER BY t.created_at DESC`)
    .bind(scope, targetId)
    .all<Row>()
  return (results ?? []).map(rowToTip)
}

export async function dbAddTip(userId: string, author: string, scope: string, targetId: string, section: string, body: string): Promise<void> {
  await db()
    .prepare('INSERT INTO tips (id, scope, target_id, section, user_id, author, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), scope, targetId, section, userId, author, body, new Date().toISOString())
    .run()
}

export async function dbDeleteTip(userId: string, id: string): Promise<void> {
  const res = await db().prepare('DELETE FROM tips WHERE id = ? AND user_id = ?').bind(id, userId).run()
  // Only sweep votes when the caller really owned (and deleted) the tip.
  if ((res.meta?.changes ?? 0) > 0) await db().prepare('DELETE FROM tip_votes WHERE tip_id = ?').bind(id).run()
}

// The caller's own votes on a target's tips (tip id -> 1 | -1); `voter` is a
// user id or an 'anon:<device-id>' key — votes work signed-out.
export async function dbMyTipVotes(voter: string, scope: string, targetId: string): Promise<Record<string, number>> {
  const { results } = await db()
    .prepare('SELECT tv.tip_id, tv.vote FROM tip_votes tv JOIN tips t ON t.id = tv.tip_id WHERE tv.user_id = ? AND t.scope = ? AND t.target_id = ?')
    .bind(voter, scope, targetId)
    .all<Row>()
  const out: Record<string, number> = {}
  for (const r of results ?? []) out[String(r.tip_id)] = Number(r.vote)
  return out
}

// Cast/flip/clear a vote on a tip (vote 0 clears). Returns fresh counts, or
// null when the tip id doesn't exist.
export async function dbVoteTip(voter: string, tipId: string, vote: 1 | -1 | 0): Promise<{ up: number; down: number } | null> {
  const exists = await db().prepare('SELECT id FROM tips WHERE id = ?').bind(tipId).first()
  if (!exists) return null
  if (vote === 0) {
    await db().prepare('DELETE FROM tip_votes WHERE tip_id = ? AND user_id = ?').bind(tipId, voter).run()
  } else {
    await db()
      .prepare('INSERT OR REPLACE INTO tip_votes (tip_id, user_id, vote, created_at) VALUES (?, ?, ?, ?)')
      .bind(tipId, voter, vote, new Date().toISOString())
      .run()
  }
  const row = await db()
    .prepare('SELECT COALESCE(SUM(vote = 1), 0) AS up, COALESCE(SUM(vote = -1), 0) AS down FROM tip_votes WHERE tip_id = ?')
    .bind(tipId)
    .first<{ up: number; down: number }>()
  return { up: Number(row?.up ?? 0), down: Number(row?.down ?? 0) }
}

// ---- extensive gameday reviews (longer-form than a tip; `reviews` table). Same
// public/`mine` model as tips; an optional 1-10 rating + the game attended. ----
export interface Review {
  id: string
  scope: string
  targetId: string
  gameId?: string
  rating?: number
  author: string
  avatar?: string | null // author's avatar (joined from users) — used for verified voices
  body: string
  createdAt: string
  userId: string
  up: number // review_votes aggregates (0 when the query doesn't join them)
  down: number
}

function rowToReview(r: Row): Review {
  return {
    id: String(r.id),
    scope: r.scope,
    targetId: String(r.target_id),
    gameId: r.game_id != null ? String(r.game_id) : undefined,
    rating: r.rating != null ? Number(r.rating) : undefined,
    author: r.author,
    avatar: r._avatar ?? undefined,
    body: r.body,
    createdAt: r.created_at,
    userId: String(r.user_id),
    up: Number(r._up ?? 0),
    down: Number(r._down ?? 0),
  }
}

// Aggregated up/down counts per review, LEFT JOINed into review reads.
const VOTE_JOIN =
  'LEFT JOIN (SELECT review_id, SUM(vote = 1) AS up, SUM(vote = -1) AS down FROM review_votes GROUP BY review_id) v ON v.review_id = r.id'

export async function dbGetReviews(scope: string, targetId: string): Promise<Review[]> {
  // Reddit-style ordering: net score (ups minus downs) first, then recency.
  const { results } = await db()
    .prepare(`SELECT r.*, u.avatar AS _avatar, COALESCE(v.up, 0) AS _up, COALESCE(v.down, 0) AS _down FROM reviews r LEFT JOIN users u ON u.id = r.user_id ${VOTE_JOIN} WHERE r.scope = ? AND r.target_id = ? ORDER BY (COALESCE(v.up, 0) - COALESCE(v.down, 0)) DESC, r.created_at DESC`)
    .bind(scope, targetId)
    .all<Row>()
  return (results ?? []).map(rowToReview)
}

// Every review a user has written (the "My reviews" block on their profile + the
// public profile). Reviews are normally fetched by target; this is the by-user path.
export async function dbGetReviewsByUser(userId: string): Promise<Review[]> {
  const { results } = await db()
    .prepare(`SELECT r.*, COALESCE(v.up, 0) AS _up, COALESCE(v.down, 0) AS _down FROM reviews r ${VOTE_JOIN} WHERE r.user_id = ? ORDER BY r.created_at DESC`)
    .bind(userId)
    .all<Row>()
  return (results ?? []).map(rowToReview)
}

export async function dbAddReview(userId: string, author: string, scope: string, targetId: string, gameId: string | null, rating: number | null, body: string): Promise<void> {
  await db()
    .prepare('INSERT INTO reviews (id, scope, target_id, game_id, user_id, author, rating, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), scope, targetId, gameId, userId, author, rating, body, new Date().toISOString())
    .run()
}

export async function dbDeleteReview(userId: string, id: string): Promise<void> {
  const res = await db().prepare('DELETE FROM reviews WHERE id = ? AND user_id = ?').bind(id, userId).run()
  // Only sweep votes when the caller really owned (and deleted) the review.
  if ((res.meta?.changes ?? 0) > 0) await db().prepare('DELETE FROM review_votes WHERE review_id = ?').bind(id).run()
}

// The caller's own votes on a target's reviews (review id -> 1 | -1), so the
// UI can highlight the arrow they already pressed. `voter` is a user id or an
// 'anon:<device-id>' key — votes work signed-out.
export async function dbMyReviewVotes(voter: string, scope: string, targetId: string): Promise<Record<string, number>> {
  const { results } = await db()
    .prepare('SELECT rv.review_id, rv.vote FROM review_votes rv JOIN reviews r ON r.id = rv.review_id WHERE rv.user_id = ? AND r.scope = ? AND r.target_id = ?')
    .bind(voter, scope, targetId)
    .all<Row>()
  const out: Record<string, number> = {}
  for (const r of results ?? []) out[String(r.review_id)] = Number(r.vote)
  return out
}

// Cast/flip/clear a vote (vote 0 clears). Returns the review's fresh counts,
// or null when the review id doesn't exist.
export async function dbVoteReview(voter: string, reviewId: string, vote: 1 | -1 | 0): Promise<{ up: number; down: number } | null> {
  const exists = await db().prepare('SELECT id FROM reviews WHERE id = ?').bind(reviewId).first()
  if (!exists) return null
  if (vote === 0) {
    await db().prepare('DELETE FROM review_votes WHERE review_id = ? AND user_id = ?').bind(reviewId, voter).run()
  } else {
    await db()
      .prepare('INSERT OR REPLACE INTO review_votes (review_id, user_id, vote, created_at) VALUES (?, ?, ?, ?)')
      .bind(reviewId, voter, vote, new Date().toISOString())
      .run()
  }
  const row = await db()
    .prepare('SELECT COALESCE(SUM(vote = 1), 0) AS up, COALESCE(SUM(vote = -1), 0) AS down FROM review_votes WHERE review_id = ?')
    .bind(reviewId)
    .first<{ up: number; down: number }>()
  return { up: Number(row?.up ?? 0), down: Number(row?.down ?? 0) }
}

// ---- college conferences + member schools (the /conferences page) ----
export interface ConferenceTeam { id: string; abbr: string; displayName: string; location: string; logo?: string }
export interface Conference { id: string; name: string; shortName?: string; teams: ConferenceTeam[] }

export async function dbConferences(league: League): Promise<Conference[]> {
  const sql =
    `SELECT c.id AS cid, c.name AS cname, c.short_name AS cshort, ` +
    `t.id AS tid, t.abbr AS tabbr, t.display_name AS tdisplay, t.location AS tloc, t.logo AS tlogo ` +
    `FROM conferences c ` +
    `LEFT JOIN conference_teams ct ON ct.league = c.league AND ct.conference_id = c.id ` +
    `LEFT JOIN teams t ON t.league = c.league AND t.id = ct.team_id ` +
    `WHERE c.league = ? ORDER BY c.sort, c.name, t.display_name`
  const { results } = await db().prepare(sql).bind(league).all<Row>()
  const byId = new Map<string, Conference>()
  for (const r of results ?? []) {
    const id = String(r.cid)
    let c = byId.get(id)
    if (!c) { c = { id, name: r.cname, shortName: r.cshort ?? undefined, teams: [] }; byId.set(id, c) }
    if (r.tid) c.teams.push({ id: String(r.tid), abbr: r.tabbr ?? '', displayName: r.tdisplay ?? '', location: r.tloc ?? '', logo: r.tlogo ?? undefined })
  }
  return [...byId.values()]
}

// ---- Snapback editorial "expert notes" (expert_notes table). Curated, NOT user
// UGC — keyed by scope/target like tips so they render in the same WhatToKnow
// sections and ground the AI assistant. Each keeps a source url + verbatim quote. ----
export interface ExpertNote {
  id: string
  scope: string
  targetId: string
  section: string
  body: string
  sourceUrl?: string
  sourceQuote?: string
  createdAt: string
}

function rowToExpertNote(r: Row): ExpertNote {
  return {
    id: String(r.id),
    scope: r.scope,
    targetId: String(r.target_id),
    section: r.section,
    body: r.body,
    sourceUrl: r.source_url ?? undefined,
    sourceQuote: r.source_quote ?? undefined,
    createdAt: r.created_at,
  }
}

export async function dbGetExpertNotes(scope: string, targetId: string): Promise<ExpertNote[]> {
  const { results } = await db()
    .prepare('SELECT * FROM expert_notes WHERE scope = ? AND target_id = ? ORDER BY section, created_at')
    .bind(scope, targetId)
    .all<Row>()
  return (results ?? []).map(rowToExpertNote)
}

// ---- AI assistant rate-limit (assistant_usage table). Atomically bump the count
// for this user's current hour bucket and return the new total; the caller 429s
// once it exceeds the per-hour limit. One D1 round-trip; isolate-safe. ----
export async function dbAssistantRateBump(userId: string, bucket: string): Promise<number> {
  const row = await db()
    .prepare(
      `INSERT INTO assistant_usage (user_id, bucket, count) VALUES (?, ?, 1)
       ON CONFLICT(user_id, bucket) DO UPDATE SET count = count + 1
       RETURNING count`,
    )
    .bind(userId, bucket)
    .first<{ count: number }>()
  return Number(row?.count ?? 1)
}

// ---- social graph (follows) + public profile assembly. The Letterboxd-style
// public profile is reachable by username; it deliberately NEVER selects email. ----
export async function dbFollow(followerId: string, followeeId: string): Promise<void> {
  if (followerId === followeeId) return
  await db()
    .prepare('INSERT OR IGNORE INTO follows (follower_id, followee_id, created_at) VALUES (?, ?, ?)')
    .bind(followerId, followeeId, new Date().toISOString())
    .run()
}

export async function dbUnfollow(followerId: string, followeeId: string): Promise<void> {
  await db().prepare('DELETE FROM follows WHERE follower_id = ? AND followee_id = ?').bind(followerId, followeeId).run()
}

export async function dbIsFollowing(followerId: string, followeeId: string): Promise<boolean> {
  const row = await db()
    .prepare('SELECT 1 AS x FROM follows WHERE follower_id = ? AND followee_id = ? LIMIT 1')
    .bind(followerId, followeeId)
    .first<{ x: number }>()
  return !!row
}

export async function dbFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  const row = await db()
    .prepare(
      `SELECT (SELECT COUNT(*) FROM follows WHERE followee_id = ?1) AS followers,
              (SELECT COUNT(*) FROM follows WHERE follower_id = ?1) AS following`,
    )
    .bind(userId)
    .first<{ followers: number; following: number }>()
  return { followers: Number(row?.followers ?? 0), following: Number(row?.following ?? 0) }
}

// Everything the public profile (/u/$username) renders. `userId` is internal —
// the API uses it to compute isFollowing/mine and then omits it. No email here.
export interface PublicProfile {
  userId: string
  username: string
  displayName: string | null
  bio: string | null
  avatar: string | null
  createdAt: string | null
  favorites: string[]
  rankings: UserRanking[]
  reviews: Review[]
  followers: number
  following: number
}

// One item in the following feed: a followee logging a game or writing a review.
// `createdAt` is the activity time (ISO) shared by both kinds, used to sort + page.
// `author` is the URL handle (username); `authorName` is the friendly display name.
export interface FeedItem {
  kind: 'ranking' | 'review'
  userId: string
  author: string | null
  authorName: string | null
  avatar: string | null
  createdAt: string
  ranking?: UserRanking
  review?: Review
}

// Recent activity from everyone the user follows. Two filtered selects (rankings +
// reviews from the followee set) merged + sorted in JS — simpler than a UNION and
// fine at this scale. Keyset-paginated via `before` (the last item's createdAt),
// not OFFSET. Returns [] when the user follows nobody.
export async function dbGetFollowingFeed(followerId: string, opts: { limit?: number; before?: string } = {}): Promise<FeedItem[]> {
  const limit = Math.min(opts.limit ?? 20, 50)
  const fol = await db().prepare('SELECT followee_id FROM follows WHERE follower_id = ?').bind(followerId).all<{ followee_id: string }>()
  const ids = (fol.results ?? []).map((r) => String(r.followee_id))
  if (!ids.length) return []
  const ph = ids.map(() => '?').join(',')
  const before = opts.before ?? null

  const rkSql = `SELECT ur.*, u.username AS _author, u.display_name AS _name, u.avatar AS _avatar FROM user_rankings ur JOIN users u ON u.id = ur.user_id WHERE ur.user_id IN (${ph}) ${before ? 'AND ur.created_at < ?' : ''} ORDER BY ur.created_at DESC LIMIT ?`
  const rvSql = `SELECT r.*, u.username AS _author, u.display_name AS _name, u.avatar AS _avatar FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.user_id IN (${ph}) ${before ? 'AND r.created_at < ?' : ''} ORDER BY r.created_at DESC LIMIT ?`
  const rkBinds = before ? [...ids, before, limit] : [...ids, limit]
  const rvBinds = before ? [...ids, before, limit] : [...ids, limit]

  const [rk, rv] = await Promise.all([
    db().prepare(rkSql).bind(...rkBinds).all<Row>(),
    db().prepare(rvSql).bind(...rvBinds).all<Row>(),
  ])

  const items: FeedItem[] = []
  for (const r of rk.results ?? []) items.push({ kind: 'ranking', userId: String(r.user_id), author: r._author ?? null, authorName: r._name ?? null, avatar: r._avatar ?? null, createdAt: String(r.created_at), ranking: rowToUserRanking(r) })
  for (const r of rv.results ?? []) items.push({ kind: 'review', userId: String(r.user_id), author: r._author ?? null, authorName: r._name ?? null, avatar: r._avatar ?? null, createdAt: String(r.created_at), review: rowToReview(r) })
  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
  return items.slice(0, limit)
}

export async function dbGetPublicProfile(username: string): Promise<PublicProfile | null> {
  const u = await db()
    .prepare('SELECT id, username, display_name, bio, avatar, favorites, created_at FROM users WHERE username = ? COLLATE NOCASE LIMIT 1')
    .bind(username)
    .first<{ id: string; username: string | null; display_name: string | null; bio: string | null; avatar: string | null; favorites: string | null; created_at: string | null }>()
  if (!u || !u.username) return null
  const [rankings, reviews, counts] = await Promise.all([
    dbGetUserRankings(String(u.id), 'recent'),
    dbGetReviewsByUser(String(u.id)),
    dbFollowCounts(String(u.id)),
  ])
  return {
    userId: String(u.id),
    username: u.username,
    displayName: u.display_name ?? null,
    bio: u.bio ?? null,
    avatar: u.avatar ?? null,
    createdAt: u.created_at ?? null,
    favorites: parseFavorites(u.favorites),
    rankings,
    reviews,
    followers: counts.followers,
    following: counts.following,
  }
}
