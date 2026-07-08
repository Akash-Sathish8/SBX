// ESPN data layer for SBX v2 — league-parameterized (NFL / NBA / MLB).
//
// Everything is sourced live from ESPN's public site API; we never invent
// scores or schedules. Each game arrives with full team objects (logo, colors,
// abbreviation) and its venue, so downstream code rarely needs a second lookup.
// `getMatchScore` is retained for the client-side score refresh hook, now
// league-aware. Replaces the old single-tournament (WC/FIFA) module.

import { SPORTS, type League } from './sports'

const base = (league: League) =>
  `https://site.api.espn.com/apis/site/v2/sports/${SPORTS[league].espnPath}`

// In-memory response cache (per worker isolate) keyed by URL with a TTL, so
// repeated calls for the same scoreboard (e.g. several games sharing a date)
// don't each re-hit ESPN — cutting load and avoiding burst rate-limiting.
const _jsonCache = new Map<string, { t: number; data: any }>()

async function fetchJson(url: string, revalidateSec: number): Promise<any | null> {
  const now = Date.now()
  const hit = _jsonCache.get(url)
  if (hit && now - hit.t < revalidateSec * 1000) return hit.data
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    _jsonCache.set(url, { t: now, data })
    return data
  } catch {
    return null
  }
}

type StatusState = 'pre' | 'in' | 'post' | 'unknown'

function toState(raw: string | undefined): StatusState {
  return raw === 'pre' || raw === 'in' || raw === 'post' ? raw : 'unknown'
}

function num(score: unknown): number | null {
  return score !== undefined && score !== null && score !== '' ? Number(score) : null
}

export interface GameTeam {
  id: string
  abbr: string
  location: string // 'Philadelphia'
  name: string // 'Phillies'
  displayName: string // 'Philadelphia Phillies'
  shortName: string // 'PHI'
  color?: string
  altColor?: string
  logo?: string // ESPN-provided absolute URL
  score: number | null
  homeAway: 'home' | 'away'
  winner: boolean
}

export interface GameVenue {
  id?: string
  name?: string
  city?: string
  state?: string
}

export interface Game {
  id: string
  league: League
  date: string // ISO timestamp
  name: string // 'Miami Marlins at Philadelphia Phillies'
  shortName: string // 'MIA @ PHI'
  state: StatusState
  detail: string // 'Final', 'Top 5th', '7:05 PM', …
  completed: boolean
  venue: GameVenue
  home: GameTeam
  away: GameTeam
}

function parseTeam(c: any): GameTeam {
  const t = c?.team ?? {}
  return {
    id: String(t.id ?? ''),
    abbr: t.abbreviation ?? '',
    location: t.location ?? '',
    name: t.name ?? t.shortDisplayName ?? '',
    displayName: t.displayName ?? '',
    shortName: t.abbreviation ?? t.shortDisplayName ?? '',
    color: t.color ? `#${t.color}` : undefined,
    altColor: t.alternateColor ? `#${t.alternateColor}` : undefined,
    logo: t.logo,
    score: num(c?.score),
    homeAway: c?.homeAway === 'away' ? 'away' : 'home',
    winner: Boolean(c?.winner),
  }
}

function parseGame(ev: any, league: League): Game | null {
  const comp = ev?.competitions?.[0]
  if (!comp) return null
  const competitors = comp.competitors ?? []
  if (competitors.length !== 2) return null
  const homeC = competitors.find((c: any) => c.homeAway === 'home') ?? competitors[0]
  const awayC = competitors.find((c: any) => c.homeAway === 'away') ?? competitors[1]
  return {
    id: String(ev.id ?? ''),
    league,
    date: ev.date ?? '',
    name: ev.name ?? '',
    shortName: ev.shortName ?? '',
    state: toState(ev.status?.type?.state),
    detail: ev.status?.type?.shortDetail ?? ev.status?.type?.detail ?? '',
    completed: Boolean(ev.status?.type?.completed),
    venue: {
      name: comp.venue?.fullName,
      city: comp.venue?.address?.city,
      state: comp.venue?.address?.state,
    },
    home: parseTeam(homeC),
    away: parseTeam(awayC),
  }
}

// `dates` accepts ESPN's forms: 'YYYYMMDD', 'YYYYMMDD-YYYYMMDD', or omitted
// (ESPN returns the current scoreboard window for the league).
export async function getScoreboard(league: League, dates?: string): Promise<Game[]> {
  const qs = dates ? `?dates=${dates}` : ''
  const data = await fetchJson(`${base(league)}/scoreboard${qs}`, 45)
  if (!data?.events?.length) return []
  return data.events
    .map((ev: any) => parseGame(ev, league))
    .filter((g: Game | null): g is Game => g !== null)
}

export async function getEventsForDate(league: League, date: string): Promise<Game[]> {
  return getScoreboard(league, date.replace(/-/g, ''))
}

export async function getEventsForDateRange(
  league: League,
  startDate: string,
  endDate: string,
): Promise<Game[]> {
  return getScoreboard(league, `${startDate.replace(/-/g, '')}-${endDate.replace(/-/g, '')}`)
}

// ---- Client score-refresh shape (consumed by /api/match-score + useMatchScores) ----

export interface MatchScore {
  home: { name: string; abbr?: string; score: number | null }
  away: { name: string; abbr?: string; score: number | null }
  status: StatusState
  detail: string
  completed: boolean
}

// Lenient two-way substring match — a team's distinctive token (abbr or name)
// is enough to bridge minor display-name differences.
function teamMatches(query: string, team: GameTeam): boolean {
  const q = query.toLowerCase().trim()
  if (!q) return false
  return [team.displayName, team.name, team.location, team.abbr]
    .filter(Boolean)
    .some((n) => {
      const v = n.toLowerCase()
      return v.includes(q) || q.includes(v)
    })
}

export async function getMatchScore(
  league: League,
  date: string,
  homeTeam: string,
  awayTeam: string,
): Promise<MatchScore | null> {
  const games = await getScoreboard(league, date.replace(/-/g, ''))
  for (const g of games) {
    const teams = [g.home, g.away]
    const matchesHome = teams.some((t) => teamMatches(homeTeam, t))
    const matchesAway = teams.some((t) => teamMatches(awayTeam, t))
    if (!matchesHome || !matchesAway) continue
    return {
      home: { name: g.home.displayName, abbr: g.home.abbr, score: g.home.score },
      away: { name: g.away.displayName, abbr: g.away.abbr, score: g.away.score },
      status: g.state,
      detail: g.detail,
      completed: g.completed,
    }
  }
  return null
}

// ---- Teams (for the team/logo layer and venue derivation) ----

export interface TeamInfo {
  id: string
  abbr: string
  location: string
  name: string
  displayName: string
  shortDisplayName: string
  color?: string
  altColor?: string
  logo?: string // primary light-bg mark
  logoDark?: string // dark-bg variant
}

function pickLogo(logos: any[], match: (href: string) => boolean): string | undefined {
  return logos?.find((l) => match(String(l?.href ?? '')))?.href
}

export async function getTeams(league: League): Promise<TeamInfo[]> {
  const data = await fetchJson(`${base(league)}/teams`, 6 * 60 * 60)
  const raw = data?.sports?.[0]?.leagues?.[0]?.teams ?? []
  return raw
    .map((entry: any) => entry?.team)
    .filter(Boolean)
    .map((t: any): TeamInfo => {
      const logos: any[] = t.logos ?? []
      return {
        id: String(t.id ?? ''),
        abbr: t.abbreviation ?? '',
        location: t.location ?? '',
        name: t.name ?? '',
        displayName: t.displayName ?? '',
        shortDisplayName: t.shortDisplayName ?? t.abbreviation ?? '',
        color: t.color ? `#${t.color}` : undefined,
        altColor: t.alternateColor ? `#${t.alternateColor}` : undefined,
        logo: pickLogo(logos, (h) => !h.includes('dark') && !h.includes('scoreboard')) ?? logos[0]?.href,
        logoDark: pickLogo(logos, (h) => h.includes('500-dark') && !h.includes('scoreboard')),
      }
    })
}

// ---- Venues (derived: every team's home ground) ----

export interface VenueTeam {
  league: League
  id: string
  abbr: string
  displayName: string
  logo?: string
  conference?: string // college only: the team's conference for this sport
  conferenceShort?: string
}

export interface Venue {
  id: string
  name: string
  city?: string
  state?: string
  zip?: string
  surface?: 'grass' | 'turf' // ESPN `grass` boolean → label
  indoor?: boolean
  image?: string // real ESPN venue photo
  teams: VenueTeam[] // home tenants — usually one, more for shared buildings
}

// ESPN's /teams list omits the venue; each team's home ground lives on the
// team-detail endpoint under franchise.venue. We fan out over the league's
// teams (cached a day) and group by venue id so shared buildings collapse to
// one entry with multiple tenants.
export async function getVenues(league: League): Promise<Venue[]> {
  const teams = await getTeams(league)
  const detailed = await Promise.all(
    teams.map(async (t) => {
      const d = await fetchJson(`${base(league)}/teams/${t.id}`, 24 * 60 * 60)
      return { team: t, venue: d?.team?.franchise?.venue }
    }),
  )
  const byVenue = new Map<string, Venue>()
  for (const { team, venue } of detailed) {
    if (!venue?.id || !venue?.fullName) continue
    const vid = String(venue.id)
    let v = byVenue.get(vid)
    if (!v) {
      v = {
        id: vid,
        name: venue.fullName,
        city: venue.address?.city,
        state: venue.address?.state,
        zip: venue.address?.zipCode,
        surface: typeof venue.grass === 'boolean' ? (venue.grass ? 'grass' : 'turf') : undefined,
        indoor: typeof venue.indoor === 'boolean' ? venue.indoor : undefined,
        image: Array.isArray(venue.images) && venue.images.length ? venue.images[0]?.href : undefined,
        teams: [],
      }
      byVenue.set(vid, v)
    }
    v.teams.push({ league, id: team.id, abbr: team.abbr, displayName: team.displayName, logo: team.logo })
  }
  return [...byVenue.values()].sort((a, b) => a.name.localeCompare(b.name))
}
