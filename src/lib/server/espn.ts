// Generalized ESPN scoreboard fetcher for American sports.
//
// Mirrors the two-layer caching strategy from src/casey/lib/espn.ts:
//   L1 — per-isolate in-memory map (dedupes within one isolate lifetime)
//   L2 — Cloudflare edge cache via `cf.cacheTtl` (shared across all isolates
//        and routes in a colo)
//
// `fetchScoreboard` and `fetchGame` never throw — they return empty / null on
// any network or parse error so callers can always render something.

export type Sport =
  | 'nfl'
  | 'mlb'
  | 'nba'
  | 'nhl'
  | 'college-football'
  | 'mens-college-basketball'

// ---------------------------------------------------------------------------
// ESPN API types (internal — matches the raw JSON shape)
// ---------------------------------------------------------------------------

interface ESPNTeam {
  id: string
  abbreviation: string
  displayName: string
  logo: string
}

interface ESPNCompetitor {
  team: ESPNTeam
  score: string
  homeAway: 'home' | 'away'
}

interface ESPNVenue {
  id: string
  fullName: string
  address: { city: string; state: string }
}

interface ESPNCompetition {
  competitors: ESPNCompetitor[]
  venue?: ESPNVenue
}

interface ESPNStatusType {
  name: string
  completed: boolean
  description: string
  state?: string
  shortDetail?: string
}

interface ESPNStatus {
  type: ESPNStatusType
  displayClock: string
  period: number
}

interface ESPNEvent {
  id: string
  name: string
  shortName: string
  date: string
  status: ESPNStatus
  competitions: [ESPNCompetition, ...ESPNCompetition[]]
}

// ---------------------------------------------------------------------------
// Public output type
// ---------------------------------------------------------------------------

export interface GameSummary {
  id: string
  sport: Sport
  name: string
  shortName: string
  date: string
  /** e.g. "STATUS_IN_PROGRESS", "STATUS_FINAL", "STATUS_SCHEDULED" */
  statusType: string
  statusDesc: string
  clock: string
  period: number
  isLive: boolean
  isFinal: boolean
  home: { teamId: string; abbr: string; name: string; logo: string; score: string }
  away: { teamId: string; abbr: string; name: string; logo: string; score: string }
  venueId: string | null
  venueName: string | null
  venueCity: string | null
}

// ---------------------------------------------------------------------------
// Sport → ESPN API path
// ---------------------------------------------------------------------------

const ESPN_SPORT_PATH: Record<Sport, string> = {
  nfl: 'football/nfl',
  mlb: 'baseball/mlb',
  nba: 'basketball/nba',
  nhl: 'hockey/nhl',
  'college-football': 'football/college-football',
  'mens-college-basketball': 'basketball/mens-college-basketball',
}

// Default cache TTL per sport (seconds).  Live games revalidate more often.
// These are the edge-cache TTLs; the L1 in-memory cache mirrors the same value.
const DEFAULT_CACHE_TTL_SEC = 45

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports'

// ---------------------------------------------------------------------------
// Two-layer cache (identical pattern to src/casey/lib/espn.ts)
// ---------------------------------------------------------------------------

const _jsonCache = new Map<string, { t: number; data: unknown }>()

async function fetchJson(url: string, cacheTtlSec: number): Promise<unknown | null> {
  const now = Date.now()
  const hit = _jsonCache.get(url)
  if (hit && now - hit.t < cacheTtlSec * 1000) return hit.data

  try {
    const res = await fetch(url, { cf: { cacheEverything: true, cacheTtl: cacheTtlSec } })
    if (!res.ok) return null
    const data = await res.json()
    _jsonCache.set(url, { t: now, data })
    return data
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Event parser
// ---------------------------------------------------------------------------

function parseEvent(ev: ESPNEvent, sport: Sport): GameSummary | null {
  try {
    const comp = ev.competitions?.[0]
    if (!comp) return null

    const competitors = comp.competitors ?? []
    if (competitors.length < 2) return null

    const homeComp =
      competitors.find(c => c.homeAway === 'home') ?? competitors[0]
    const awayComp =
      competitors.find(c => c.homeAway === 'away') ?? competitors[1]

    const statusType = ev.status?.type
    const statusName = statusType?.name ?? ''
    const isLive = statusType?.state === 'in'
    const isFinal = statusType?.completed ?? false

    const venue = comp.venue ?? null

    return {
      id: String(ev.id ?? ''),
      sport,
      name: ev.name ?? '',
      shortName: ev.shortName ?? '',
      date: ev.date ?? '',
      statusType: statusName,
      statusDesc: statusType?.description ?? statusType?.shortDetail ?? '',
      clock: ev.status?.displayClock ?? '',
      period: ev.status?.period ?? 0,
      isLive,
      isFinal,
      home: {
        teamId: homeComp.team?.id ?? '',
        abbr: homeComp.team?.abbreviation ?? '',
        name: homeComp.team?.displayName ?? '',
        logo: homeComp.team?.logo ?? '',
        score: homeComp.score ?? '',
      },
      away: {
        teamId: awayComp.team?.id ?? '',
        abbr: awayComp.team?.abbreviation ?? '',
        name: awayComp.team?.displayName ?? '',
        logo: awayComp.team?.logo ?? '',
        score: awayComp.score ?? '',
      },
      venueId: venue?.id ?? null,
      venueName: venue?.fullName ?? null,
      venueCity: venue?.address?.city ?? null,
    }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch all games for `sport` on the given date (YYYY-MM-DD or YYYYMMDD).
 * If `date` is omitted ESPN returns today's games.
 * Returns an empty array on any error — never throws.
 */
export async function fetchScoreboard(sport: Sport, date?: string): Promise<GameSummary[]> {
  const path = ESPN_SPORT_PATH[sport]
  let url = `${ESPN_BASE}/${path}/scoreboard`

  if (date) {
    // Accept both YYYY-MM-DD and YYYYMMDD
    const ymd = date.replace(/-/g, '')
    url += `?dates=${ymd}`
  }

  try {
    const data = await fetchJson(url, DEFAULT_CACHE_TTL_SEC)
    const raw = data as { events?: ESPNEvent[] } | null
    if (!raw?.events?.length) return []

    const results: GameSummary[] = []
    for (const ev of raw.events) {
      const parsed = parseEvent(ev, sport)
      if (parsed) results.push(parsed)
    }
    return results
  } catch {
    return []
  }
}

/**
 * Fetch a single game by ESPN event ID.
 * Returns `null` if the game is not found in the scoreboard or on any error.
 */
export async function fetchGame(sport: Sport, gameId: string): Promise<GameSummary | null> {
  try {
    // The scoreboard endpoint doesn't filter by ID server-side, so we fetch
    // today's board and filter locally.  For past/future games callers should
    // pass a `date` to `fetchScoreboard` and filter themselves.
    const games = await fetchScoreboard(sport)
    return games.find(g => g.id === gameId) ?? null
  } catch {
    return null
  }
}
