import { useQueries } from '@tanstack/react-query'

// Real final scores for fixtures, sourced from ESPN via /api/match-score.
// Shared by the games list, the venue page and the build wizard.
//
// Backed by TanStack Query: one query per already-played fixture, deduped across
// every consumer that asks for the same date+teams through the shared
// QueryClient cache (replaces the old hand-rolled useEffect + `alive` machine).
// A read-through localStorage layer (keyed by today's date) means a hard reload
// the SAME day reuses the day's checks instead of re-hitting the Worker — so each
// fixture is fetched at most once per calendar day, per device. We only ever
// surface ESPN-confirmed completed matches; a `null` ("checked, not done") is
// cached too so an unfinished match isn't re-polled again today.

export type Score = { hs: number; as: number }
// home/away are nullable: TBD knockout fixtures carry null until teams are set.
// The played() filter drops those (needs both teams) before any score lookup.
export type ScoreInput = { key: string; dateISO: string | null; home?: string | null; away?: string | null }

const uk = (m: { dateISO: string | null; home?: string | null; away?: string | null }) =>
  `${m.dateISO}|${m.home}|${m.away}`

const CACHE_PREFIX = 'sbx:scores:v3:'
const todayISO = () => new Date().toISOString().slice(0, 10)
const cacheKeyFor = (k: string) => `${CACHE_PREFIX}${todayISO()}|${k}`

// Drop stale-day cache entries once per load so localStorage can't grow without
// bound across days. Guarded to run at most once per session.
let pruned = false
function pruneStaleDays() {
  if (pruned || typeof localStorage === 'undefined') return
  pruned = true
  try {
    const keep = `${CACHE_PREFIX}${todayISO()}|`
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key && key.startsWith(CACHE_PREFIX) && !key.startsWith(keep)) {
        localStorage.removeItem(key)
      }
    }
  } catch {
    /* ignore quota / private mode */
  }
}

function readCache(k: string): Score | null | undefined {
  if (typeof localStorage === 'undefined') return undefined
  try {
    const raw = localStorage.getItem(cacheKeyFor(k))
    return raw === null ? undefined : (JSON.parse(raw) as Score | null)
  } catch {
    return undefined
  }
}

function writeCache(k: string, v: Score | null) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(cacheKeyFor(k), JSON.stringify(v))
  } catch {
    /* ignore quota / private mode */
  }
}

async function fetchScore(m: { dateISO: string; home: string; away: string }): Promise<Score | null> {
  const k = uk(m)
  const cached = readCache(k)
  if (cached !== undefined) return cached // includes a cached `null` (checked today, not done)
  // Throw on a failed request so TanStack Query retries it, and persist ONLY a
  // successful response. Otherwise a transient blip on an already-finished match
  // would cache `null` for the whole day and hide a real final score.
  const r = await fetch(
    `/api/match-score?date=${m.dateISO}&home=${encodeURIComponent(m.home)}&away=${encodeURIComponent(m.away)}`,
  )
  if (!r.ok) throw new Error(`match-score ${r.status}`)
  const j = await r.json()
  const d = j?.data
  const score: Score | null =
    d?.completed && typeof d.home?.score === 'number' && typeof d.away?.score === 'number'
      ? { hs: d.home.score as number, as: d.away.score as number }
      : null
  writeCache(k, score)
  return score
}

export function useMatchScores(items: ScoreInput[] | null): Record<string, Score> {
  pruneStaleDays()
  const today = todayISO()
  // Only matches whose date has passed and that have both teams are checkable.
  const played = (items ?? []).filter(
    (m): m is ScoreInput & { dateISO: string; home: string; away: string } =>
      Boolean(m.dateISO && m.dateISO <= today && m.home && m.away),
  )

  // One query per played fixture. queryKey is namespaced 'match-final' so it
  // never collides with InlineMatchScore's live ['match-score', …] entries,
  // which cache a different shape under the same date/teams.
  const results = useQueries({
    queries: played.map((m) => ({
      queryKey: ['match-final', m.dateISO, m.home, m.away] as const,
      queryFn: () => fetchScore({ dateISO: m.dateISO, home: m.home, away: m.away }),
      // A completed score is immutable and unfinished matches are cached as
      // `null` for the day, so never auto-refetch within a session.
      staleTime: Infinity,
    })),
  })

  const map: Record<string, Score> = {}
  played.forEach((m, i) => {
    const s = results[i]?.data
    if (s) map[m.key] = s
  })
  return map
}
