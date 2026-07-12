// D1 data layer — the app reads games/teams/venues from SQL (system of record),
// not from ESPN per-request. ESPN is only the ingest source (scripts/ingest.mjs).
// All queries go through Drizzle (drizzle-orm/d1); the shared client + unified
// schema live in ./db/. Public function names/signatures are unchanged so the
// /api/* routes that import them keep working.
import { and, asc, avg, count, desc, eq, gte, inArray, lt, lte, or, sql, type SQL } from 'drizzle-orm'
import { db } from './db/client'
import {
  games, teams, venues, venueTeams, conferences, conferenceTeams,
  user, userRankings, tips, tipVotes, reviews, reviewVotes, expertNotes, assistantUsage, follows,
} from './db/schema'
import type { Game, GameTeam, Venue, TeamInfo } from '../lib/espn'
import type { League } from '../lib/sports'
import { escapeLike } from '../lib/searchScore'

type GameRow = typeof games.$inferSelect

function gameTeam(side: 'home' | 'away', g: GameRow): GameTeam {
  const p = side === 'home'
    ? { teamId: g.homeTeamId, abbr: g.homeAbbr, location: g.homeLocation, name: g.homeName, display: g.homeDisplay, color: g.homeColor, logo: g.homeLogo, score: g.homeScore, winner: g.homeWinner }
    : { teamId: g.awayTeamId, abbr: g.awayAbbr, location: g.awayLocation, name: g.awayName, display: g.awayDisplay, color: g.awayColor, logo: g.awayLogo, score: g.awayScore, winner: g.awayWinner }
  return {
    id: String(p.teamId ?? ''),
    abbr: p.abbr ?? '',
    location: p.location ?? '',
    name: p.name ?? '',
    displayName: p.display ?? '',
    shortName: p.abbr ?? '',
    color: p.color ?? undefined,
    altColor: undefined,
    logo: p.logo ?? undefined,
    score: p.score === null || p.score === undefined ? null : Number(p.score),
    homeAway: side,
    winner: !!p.winner,
  }
}

function toGame(g: GameRow): Game {
  return {
    id: String(g.id),
    league: g.league as League,
    date: g.date,
    name: g.name ?? '',
    shortName: g.shortName ?? '',
    state: (g.state ?? 'unknown') as Game['state'],
    detail: g.detail ?? '',
    completed: !!g.completed,
    venue: { id: g.venueId != null ? String(g.venueId) : undefined, name: g.venueName ?? undefined, city: g.venueCity ?? undefined, state: g.venueState ?? undefined },
    home: gameTeam('home', g),
    away: gameTeam('away', g),
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
  const conds: SQL[] = []
  if (opts.league) conds.push(eq(games.league, opts.league))
  if (opts.from) conds.push(gte(games.date, opts.from))
  if (opts.to) conds.push(lte(games.date, opts.to))
  if (opts.team) conds.push(or(eq(games.homeAbbr, opts.team), eq(games.awayAbbr, opts.team))!)
  const rows = await db()
    .select().from(games)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(opts.order === 'desc' ? desc(games.date) : asc(games.date))
    .limit(Math.min(opts.limit ?? 300, 2000))
  return rows.map(toGame)
}

export async function dbGameById(id: string, league?: League): Promise<Game | null> {
  const rows = await db()
    .select().from(games)
    .where(league ? and(eq(games.id, id), eq(games.league, league)) : eq(games.id, id))
    .limit(1)
  return rows.length ? toGame(rows[0]) : null
}

export async function dbTeams(league?: League): Promise<TeamInfo[]> {
  const rows = await db()
    .select().from(teams)
    .where(league ? eq(teams.league, league) : undefined)
    .orderBy(asc(teams.displayName))
  return rows.map((t) => ({
    id: String(t.id),
    abbr: t.abbr ?? '',
    location: t.location ?? '',
    name: t.name ?? '',
    displayName: t.displayName ?? '',
    shortDisplayName: t.abbr ?? '',
    color: t.color ?? undefined,
    altColor: t.altColor ?? undefined,
    logo: t.logo ?? undefined,
    logoDark: undefined,
  }))
}

export async function dbVenues(league?: League): Promise<Venue[]> {
  // LEFT JOINs: event venues (racetracks, golf courses, ...) have no tenant teams
  // but still need venue pages; a league filter still narrows to that league's home
  // grounds because WHERE vt.league drops team-less rows.
  const rows = await db()
    .select({
      id: venues.id, name: venues.name, city: venues.city, state: venues.state, zip: venues.zip, surface: venues.surface, indoor: venues.indoor, image: venues.image,
      tl: venueTeams.league, tid: teams.id, tabbr: teams.abbr, tdisplay: teams.displayName, tlogo: teams.logo,
      confName: conferences.name, confShort: conferences.shortName,
    })
    .from(venues)
    .leftJoin(venueTeams, eq(venueTeams.venueId, venues.id))
    .leftJoin(teams, and(eq(teams.league, venueTeams.league), eq(teams.id, venueTeams.teamId)))
    .leftJoin(conferenceTeams, and(eq(conferenceTeams.league, venueTeams.league), eq(conferenceTeams.teamId, venueTeams.teamId)))
    .leftJoin(conferences, and(eq(conferences.league, conferenceTeams.league), eq(conferences.id, conferenceTeams.conferenceId)))
    .where(league ? eq(venueTeams.league, league) : undefined)
    .orderBy(asc(venues.name))
  const byId = new Map<string, Venue>()
  for (const r of rows) {
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
    if (r.tl) v.teams.push({ league: r.tl as League, id: String(r.tid), abbr: r.tabbr ?? '', displayName: r.tdisplay ?? '', logo: r.tlogo ?? undefined, conference: r.confName ?? undefined, conferenceShort: r.confShort ?? undefined })
  }
  return [...byId.values()]
}

// Single venue by id (reuses the dbVenues join — teams + conference). Venue count
// is small and the assistant calls this once per request, so no separate query.
export async function dbVenueById(id: string): Promise<Venue | null> {
  const all = await dbVenues()
  return all.find((v) => v.id === id) ?? null
}

// ---- free-text search candidates (/api/search). SQL only guarantees every token
// appears somewhere in the row's haystack (token-AND LIKE — this is what makes
// mid-word partials like "rigley" work); ranking happens in JS via lib/searchScore
// so it's unit-testable. Tables are small (≤~13k rows), so a full LIKE scan is
// single-digit ms — no FTS index needed. ----
function tokenConds(hay: SQL, tokens: string[]): SQL[] {
  return tokens.map((t) => sql`${hay} LIKE ${'%' + escapeLike(t) + '%'} ESCAPE '\\'`)
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
  const hay = sql`lower(${teams.displayName} || ' ' || ${teams.location} || ' ' || ${teams.name} || ' ' || ${teams.abbr})`
  const rows = await db()
    .select({
      league: teams.league, id: teams.id, abbr: teams.abbr, location: teams.location, displayName: teams.displayName, color: teams.color, logo: teams.logo,
      venueId: venues.id, venueName: venues.name,
    })
    .from(teams)
    .leftJoin(venueTeams, and(eq(venueTeams.league, teams.league), eq(venueTeams.teamId, teams.id)))
    .leftJoin(venues, eq(venues.id, venueTeams.venueId))
    .where(and(...tokenConds(hay, tokens)))
    .limit(40)
  const seen = new Map<string, TeamSearchRow>()
  for (const r of rows) {
    const key = `${r.league}:${r.id}`
    if (seen.has(key)) continue // a team in several venue rows — keep the first
    seen.set(key, {
      league: r.league as League,
      id: String(r.id),
      abbr: r.abbr ?? '',
      displayName: r.displayName ?? '',
      location: r.location ?? '',
      logo: r.logo ?? undefined,
      color: r.color ?? undefined,
      venueId: r.venueId != null ? String(r.venueId) : undefined,
      venueName: r.venueName ?? undefined,
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
  const hay = sql`lower(${venues.name} || ' ' || coalesce(${venues.city},'') || ' ' || coalesce(${venues.state},'') || ' ' || coalesce(${teams.displayName},''))`
  const rows = await db()
    .select({
      id: venues.id, name: venues.name, city: venues.city, state: venues.state, image: venues.image,
      tl: teams.league, tabbr: teams.abbr, tdisplay: teams.displayName,
    })
    .from(venues)
    .leftJoin(venueTeams, eq(venueTeams.venueId, venues.id))
    .leftJoin(teams, and(eq(teams.league, venueTeams.league), eq(teams.id, venueTeams.teamId)))
    .where(and(...tokenConds(hay, tokens)))
    .limit(60)
  const byId = new Map<string, VenueSearchRow>()
  for (const r of rows) {
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

// Two candidate pools keep results relevant without scanning the whole table into
// JS: nearest upcoming games plus a short tail of recent ones.
export async function dbSearchGames(tokens: string[], todayIso: string): Promise<GameSearchRow[]> {
  const hay = sql`lower(${games.name} || ' ' || ${games.shortName} || ' ' || coalesce(${games.venueName},'') || ' ' || coalesce(${games.venueCity},''))`
  const conds = tokenConds(hay, tokens)
  const cols = { league: games.league, id: games.id, name: games.name, shortName: games.shortName, date: games.date, state: games.state, venueName: games.venueName, venueCity: games.venueCity }
  const [up, past] = await Promise.all([
    db().select(cols).from(games).where(and(...conds, gte(games.date, todayIso))).orderBy(asc(games.date)).limit(25),
    db().select(cols).from(games).where(and(...conds, lt(games.date, todayIso))).orderBy(desc(games.date)).limit(15),
  ])
  const row = (r: typeof up[number]): GameSearchRow => ({
    league: r.league as League,
    id: String(r.id),
    name: r.name ?? '',
    shortName: r.shortName ?? '',
    date: r.date,
    state: r.state ?? 'unknown',
    venueName: r.venueName ?? undefined,
    venueCity: r.venueCity ?? undefined,
  })
  return [...up.map(row), ...past.map(row)]
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

function toUserRanking(r: typeof userRankings.$inferSelect): UserRanking {
  return {
    gameId: String(r.gameId),
    league: r.league as League,
    away: r.away,
    home: r.home,
    awayLogo: r.awayLogo ?? undefined,
    homeLogo: r.homeLogo ?? undefined,
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
  const rows = await db()
    .select().from(userRankings)
    .where(eq(userRankings.userId, userId))
    .orderBy(...(order === 'recent' ? [desc(userRankings.date), desc(userRankings.ts)] : [desc(userRankings.score)]))
  return rows.map(toUserRanking)
}

// Upsert-all: serves both the post-login bulk sync (whole list) and incremental
// single-game writes. Atomic via D1 batch (same idiom as cron.ts).
export async function dbUpsertUserRankings(userId: string, ranks: UserRanking[]): Promise<void> {
  if (!ranks.length) return
  const now = new Date().toISOString()
  const stmts = ranks.map((r) =>
    db()
      .insert(userRankings)
      .values({
        userId, gameId: r.gameId, league: r.league, away: r.away, home: r.home,
        awayLogo: r.awayLogo ?? null, homeLogo: r.homeLogo ?? null, date: r.date, venue: r.venue, city: r.city ?? null,
        fans: r.fans, food: r.food, unique_: r.unique, stadium: r.stadium, score: r.score, ts: r.ts, createdAt: now, updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [userRankings.userId, userRankings.gameId],
        set: {
          league: r.league, away: r.away, home: r.home, awayLogo: r.awayLogo ?? null, homeLogo: r.homeLogo ?? null,
          date: r.date, venue: r.venue, city: r.city ?? null, fans: r.fans, food: r.food, unique_: r.unique,
          stadium: r.stadium, score: r.score, ts: r.ts, updatedAt: now,
        },
      }),
  )
  await db().batch(stmts as [(typeof stmts)[number], ...(typeof stmts)[number][]])
}

export async function dbDeleteUserRanking(userId: string, gameId: string): Promise<void> {
  await db().delete(userRankings).where(and(eq(userRankings.userId, userId), eq(userRankings.gameId, gameId)))
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
  const rows = await db()
    .select({ displayName: user.name, bio: user.bio, avatar: user.image, favorites: user.favorites, createdAt: user.createdAt })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  const row = rows[0]
  return {
    displayName: row?.displayName ?? null,
    bio: row?.bio ?? null,
    avatar: row?.avatar ?? null,
    favorites: parseFavorites(row?.favorites),
    createdAt: row?.createdAt ? row.createdAt.toISOString() : null,
  }
}

// Dynamic partial update — only the keys present in `f` are written. favorites is
// serialized to JSON (capped at 4). Caller validates sizes/shape before this.
export async function dbUpdateProfile(userId: string, f: { displayName?: string | null; bio?: string | null; avatar?: string | null; favorites?: string[] }): Promise<void> {
  const set: Partial<typeof user.$inferInsert> = {}
  if ('displayName' in f) set.name = f.displayName ?? null // display_name column
  if ('bio' in f) set.bio = f.bio ?? null
  if ('avatar' in f) set.image = f.avatar ?? null // avatar column
  if ('favorites' in f) set.favorites = JSON.stringify((f.favorites ?? []).slice(0, 4))
  if (!Object.keys(set).length) return
  await db().update(user).set(set).where(eq(user.id, userId))
}

// ---- Fan ranking for a venue: the average of EVERY signed-in fan's ranking of a
// game at that venue (user_rankings stores the venue name on each row, so no game
// join is needed). Real, cross-user data — `count` is 0 until fans rank here. ----
export interface VenueFanStats { count: number; fans: number; food: number; unique: number; stadium: number; score: number }
export async function dbVenueFanStats(venue: string): Promise<VenueFanStats> {
  const rows = await db()
    .select({
      n: count(),
      fans: avg(userRankings.fans),
      food: avg(userRankings.food),
      uniq: avg(userRankings.unique_),
      stadium: avg(userRankings.stadium),
      score: avg(userRankings.score),
    })
    .from(userRankings)
    .where(eq(userRankings.venue, venue))
  const row = rows[0]
  const r1 = (n: number | string | null | undefined) => Math.round(Number(n ?? 0) * 10) / 10
  return {
    count: Number(row?.n ?? 0),
    fans: r1(row?.fans), food: r1(row?.food), unique: r1(row?.uniq), stadium: r1(row?.stadium), score: r1(row?.score),
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

type TipRow = typeof tips.$inferSelect
function toTip(r: TipRow, avatar: string | null, up: number, down: number): Tip {
  return {
    id: String(r.id),
    scope: r.scope,
    targetId: String(r.targetId),
    section: r.section,
    author: r.author,
    avatar: avatar ?? undefined,
    body: r.body,
    createdAt: r.createdAt,
    userId: String(r.userId),
    up,
    down,
  }
}

const upCount = (votes: { vote: number }[]) => votes.reduce((n, v) => n + (v.vote === 1 ? 1 : 0), 0)
const downCount = (votes: { vote: number }[]) => votes.reduce((n, v) => n + (v.vote === -1 ? 1 : 0), 0)

export async function dbGetTips(scope: string, targetId: string): Promise<Tip[]> {
  const rows = await db().query.tips.findMany({
    where: and(eq(tips.scope, scope), eq(tips.targetId, targetId)),
    orderBy: desc(tips.createdAt),
    with: { authorUser: { columns: { image: true } }, votes: { columns: { vote: true } } },
  })
  return rows.map((r) => toTip(r, r.authorUser?.image ?? null, upCount(r.votes), downCount(r.votes)))
}

export async function dbAddTip(userId: string, author: string, scope: string, targetId: string, section: string, body: string): Promise<void> {
  await db().insert(tips).values({ id: crypto.randomUUID(), scope, targetId, section, userId, author, body, createdAt: new Date().toISOString() })
}

export async function dbDeleteTip(userId: string, id: string): Promise<void> {
  const deleted = await db().delete(tips).where(and(eq(tips.id, id), eq(tips.userId, userId))).returning({ id: tips.id })
  // Only sweep votes when the caller really owned (and deleted) the tip.
  if (deleted.length) await db().delete(tipVotes).where(eq(tipVotes.tipId, id))
}

// The caller's own votes on a target's tips (tip id -> 1 | -1); `voter` is a user
// id or an 'anon:<device-id>' key — votes work signed-out.
export async function dbMyTipVotes(voter: string, scope: string, targetId: string): Promise<Record<string, number>> {
  const rows = await db()
    .select({ tipId: tipVotes.tipId, vote: tipVotes.vote })
    .from(tipVotes)
    .innerJoin(tips, eq(tips.id, tipVotes.tipId))
    .where(and(eq(tipVotes.userId, voter), eq(tips.scope, scope), eq(tips.targetId, targetId)))
  const out: Record<string, number> = {}
  for (const r of rows) out[String(r.tipId)] = Number(r.vote)
  return out
}

// Cast/flip/clear a vote on a tip (vote 0 clears). Returns fresh counts, or null
// when the tip id doesn't exist.
export async function dbVoteTip(voter: string, tipId: string, vote: 1 | -1 | 0): Promise<{ up: number; down: number } | null> {
  const exists = await db().select({ id: tips.id }).from(tips).where(eq(tips.id, tipId)).limit(1)
  if (!exists.length) return null
  if (vote === 0) {
    await db().delete(tipVotes).where(and(eq(tipVotes.tipId, tipId), eq(tipVotes.userId, voter)))
  } else {
    const nowIso = new Date().toISOString()
    await db().insert(tipVotes).values({ tipId, userId: voter, vote, createdAt: nowIso })
      .onConflictDoUpdate({ target: [tipVotes.tipId, tipVotes.userId], set: { vote, createdAt: nowIso } })
  }
  const agg = await db()
    .select({ up: sql<number>`COALESCE(SUM(${tipVotes.vote} = 1), 0)`, down: sql<number>`COALESCE(SUM(${tipVotes.vote} = -1), 0)` })
    .from(tipVotes)
    .where(eq(tipVotes.tipId, tipId))
  return { up: Number(agg[0]?.up ?? 0), down: Number(agg[0]?.down ?? 0) }
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

type ReviewRow = typeof reviews.$inferSelect
function toReview(r: ReviewRow, avatar: string | null, up: number, down: number): Review {
  return {
    id: String(r.id),
    scope: r.scope,
    targetId: String(r.targetId),
    gameId: r.gameId != null ? String(r.gameId) : undefined,
    rating: r.rating != null ? Number(r.rating) : undefined,
    author: r.author,
    avatar: avatar ?? undefined,
    body: r.body,
    createdAt: r.createdAt,
    userId: String(r.userId),
    up,
    down,
  }
}

export async function dbGetReviews(scope: string, targetId: string): Promise<Review[]> {
  const rows = await db().query.reviews.findMany({
    where: and(eq(reviews.scope, scope), eq(reviews.targetId, targetId)),
    with: { authorUser: { columns: { image: true } }, votes: { columns: { vote: true } } },
  })
  const mapped = rows.map((r) => toReview(r, r.authorUser?.image ?? null, upCount(r.votes), downCount(r.votes)))
  // Reddit-style ordering: net score (ups minus downs) first, then recency.
  mapped.sort((a, b) => (b.up - b.down) - (a.up - a.down) || (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
  return mapped
}

// Every review a user has written (the "My reviews" block on their profile + the
// public profile). Reviews are normally fetched by target; this is the by-user path.
export async function dbGetReviewsByUser(userId: string): Promise<Review[]> {
  const rows = await db().query.reviews.findMany({
    where: eq(reviews.userId, userId),
    orderBy: desc(reviews.createdAt),
    with: { votes: { columns: { vote: true } } },
  })
  return rows.map((r) => toReview(r, null, upCount(r.votes), downCount(r.votes)))
}

export async function dbAddReview(userId: string, author: string, scope: string, targetId: string, gameId: string | null, rating: number | null, body: string): Promise<void> {
  await db().insert(reviews).values({ id: crypto.randomUUID(), scope, targetId, gameId, userId, author, rating, body, createdAt: new Date().toISOString() })
}

export async function dbDeleteReview(userId: string, id: string): Promise<void> {
  const deleted = await db().delete(reviews).where(and(eq(reviews.id, id), eq(reviews.userId, userId))).returning({ id: reviews.id })
  // Only sweep votes when the caller really owned (and deleted) the review.
  if (deleted.length) await db().delete(reviewVotes).where(eq(reviewVotes.reviewId, id))
}

// The caller's own votes on a target's reviews (review id -> 1 | -1), so the UI can
// highlight the arrow they already pressed. `voter` is a user id or an
// 'anon:<device-id>' key — votes work signed-out.
export async function dbMyReviewVotes(voter: string, scope: string, targetId: string): Promise<Record<string, number>> {
  const rows = await db()
    .select({ reviewId: reviewVotes.reviewId, vote: reviewVotes.vote })
    .from(reviewVotes)
    .innerJoin(reviews, eq(reviews.id, reviewVotes.reviewId))
    .where(and(eq(reviewVotes.userId, voter), eq(reviews.scope, scope), eq(reviews.targetId, targetId)))
  const out: Record<string, number> = {}
  for (const r of rows) out[String(r.reviewId)] = Number(r.vote)
  return out
}

// Cast/flip/clear a vote (vote 0 clears). Returns the review's fresh counts, or
// null when the review id doesn't exist.
export async function dbVoteReview(voter: string, reviewId: string, vote: 1 | -1 | 0): Promise<{ up: number; down: number } | null> {
  const exists = await db().select({ id: reviews.id }).from(reviews).where(eq(reviews.id, reviewId)).limit(1)
  if (!exists.length) return null
  if (vote === 0) {
    await db().delete(reviewVotes).where(and(eq(reviewVotes.reviewId, reviewId), eq(reviewVotes.userId, voter)))
  } else {
    const nowIso = new Date().toISOString()
    await db().insert(reviewVotes).values({ reviewId, userId: voter, vote, createdAt: nowIso })
      .onConflictDoUpdate({ target: [reviewVotes.reviewId, reviewVotes.userId], set: { vote, createdAt: nowIso } })
  }
  const agg = await db()
    .select({ up: sql<number>`COALESCE(SUM(${reviewVotes.vote} = 1), 0)`, down: sql<number>`COALESCE(SUM(${reviewVotes.vote} = -1), 0)` })
    .from(reviewVotes)
    .where(eq(reviewVotes.reviewId, reviewId))
  return { up: Number(agg[0]?.up ?? 0), down: Number(agg[0]?.down ?? 0) }
}

// ---- college conferences + member schools (the /conferences page) ----
export interface ConferenceTeam { id: string; abbr: string; displayName: string; location: string; logo?: string }
export interface Conference { id: string; name: string; shortName?: string; teams: ConferenceTeam[] }

export async function dbConferences(league: League): Promise<Conference[]> {
  const rows = await db()
    .select({
      cid: conferences.id, cname: conferences.name, cshort: conferences.shortName,
      tid: teams.id, tabbr: teams.abbr, tdisplay: teams.displayName, tloc: teams.location, tlogo: teams.logo,
    })
    .from(conferences)
    .leftJoin(conferenceTeams, and(eq(conferenceTeams.league, conferences.league), eq(conferenceTeams.conferenceId, conferences.id)))
    .leftJoin(teams, and(eq(teams.league, conferences.league), eq(teams.id, conferenceTeams.teamId)))
    .where(eq(conferences.league, league))
    .orderBy(asc(conferences.sort), asc(conferences.name), asc(teams.displayName))
  const byId = new Map<string, Conference>()
  for (const r of rows) {
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

export async function dbGetExpertNotes(scope: string, targetId: string): Promise<ExpertNote[]> {
  const rows = await db()
    .select().from(expertNotes)
    .where(and(eq(expertNotes.scope, scope), eq(expertNotes.targetId, targetId)))
    .orderBy(asc(expertNotes.section), asc(expertNotes.createdAt))
  return rows.map((r) => ({
    id: String(r.id),
    scope: r.scope,
    targetId: String(r.targetId),
    section: r.section,
    body: r.body,
    sourceUrl: r.sourceUrl ?? undefined,
    sourceQuote: r.sourceQuote ?? undefined,
    createdAt: r.createdAt,
  }))
}

// ---- AI assistant rate-limit (assistant_usage table). Atomically bump the count
// for this user's current hour bucket and return the new total; the caller 429s
// once it exceeds the per-hour limit. One D1 round-trip; isolate-safe. ----
export async function dbAssistantRateBump(userId: string, bucket: string): Promise<number> {
  const rows = await db()
    .insert(assistantUsage)
    .values({ userId, bucket, count: 1 })
    .onConflictDoUpdate({ target: [assistantUsage.userId, assistantUsage.bucket], set: { count: sql`${assistantUsage.count} + 1` } })
    .returning({ count: assistantUsage.count })
  return Number(rows[0]?.count ?? 1)
}

// ---- social graph (follows) + public profile assembly. The Letterboxd-style
// public profile is reachable by username; it deliberately NEVER selects email. ----
export async function dbFollow(followerId: string, followeeId: string): Promise<void> {
  if (followerId === followeeId) return
  await db().insert(follows).values({ followerId, followeeId, createdAt: new Date().toISOString() }).onConflictDoNothing()
}

export async function dbUnfollow(followerId: string, followeeId: string): Promise<void> {
  await db().delete(follows).where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)))
}

export async function dbIsFollowing(followerId: string, followeeId: string): Promise<boolean> {
  const rows = await db()
    .select({ x: sql`1` }).from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)))
    .limit(1)
  return rows.length > 0
}

export async function dbFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  const [followers, following] = await Promise.all([
    db().select({ n: count() }).from(follows).where(eq(follows.followeeId, userId)),
    db().select({ n: count() }).from(follows).where(eq(follows.followerId, userId)),
  ])
  return { followers: Number(followers[0]?.n ?? 0), following: Number(following[0]?.n ?? 0) }
}

// Everything the public profile (/u/$username) renders. `userId` is internal — the
// API uses it to compute isFollowing/mine and then omits it. No email here.
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
  const fol = await db().select({ followeeId: follows.followeeId }).from(follows).where(eq(follows.followerId, followerId))
  const ids = fol.map((r) => String(r.followeeId))
  if (!ids.length) return []
  const before = opts.before

  // `username` is stored normalized (lowercase); display_username keeps the casing
  // the fan typed — prefer it for display.
  const authorOf = (u: { username: string | null; displayUsername: string | null; name: string | null; image: string | null }) => ({
    author: u.displayUsername ?? u.username ?? null,
    authorName: u.name ?? null,
    avatar: u.image ?? null,
  })
  const userCols = { columns: { username: true, displayUsername: true, name: true, image: true } } as const

  const [rk, rv] = await Promise.all([
    db().query.userRankings.findMany({
      where: and(inArray(userRankings.userId, ids), before ? lt(userRankings.createdAt, before) : undefined),
      orderBy: desc(userRankings.createdAt),
      limit,
      with: { user: userCols },
    }),
    db().query.reviews.findMany({
      where: and(inArray(reviews.userId, ids), before ? lt(reviews.createdAt, before) : undefined),
      orderBy: desc(reviews.createdAt),
      limit,
      with: { authorUser: userCols, votes: { columns: { vote: true } } },
    }),
  ])

  const items: FeedItem[] = []
  for (const r of rk) items.push({ kind: 'ranking', userId: String(r.userId), ...authorOf(r.user), createdAt: String(r.createdAt), ranking: toUserRanking(r) })
  for (const r of rv) items.push({ kind: 'review', userId: String(r.userId), ...authorOf(r.authorUser), createdAt: String(r.createdAt), review: toReview(r, null, upCount(r.votes), downCount(r.votes)) })
  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
  return items.slice(0, limit)
}

export async function dbGetPublicProfile(username: string): Promise<PublicProfile | null> {
  const rows = await db()
    .select({ id: user.id, username: user.username, displayUsername: user.displayUsername, displayName: user.name, bio: user.bio, avatar: user.image, favorites: user.favorites, createdAt: user.createdAt })
    .from(user)
    .where(sql`${user.username} = ${username} COLLATE NOCASE`)
    .limit(1)
  const u = rows[0]
  const handle = u?.displayUsername ?? u?.username ?? null
  if (!u || !handle) return null
  const [rankings, reviews, counts] = await Promise.all([
    dbGetUserRankings(String(u.id), 'recent'),
    dbGetReviewsByUser(String(u.id)),
    dbFollowCounts(String(u.id)),
  ])
  return {
    userId: String(u.id),
    username: handle,
    displayName: u.displayName ?? null,
    bio: u.bio ?? null,
    avatar: u.avatar ?? null,
    createdAt: u.createdAt ? u.createdAt.toISOString() : null,
    favorites: parseFavorites(u.favorites),
    rankings,
    reviews,
    followers: counts.followers,
    following: counts.following,
  }
}
