import type { League } from './sports'

// The shape of one personal ranking — shared by /rank (which writes it) and
// /profile (which reads it). Stored in localStorage under RANKINGS_KEY and, when
// signed in, mirrored to D1 via /api/rankings.
export interface MyRank {
  gameId: string
  league: League
  away: string
  home: string
  awayLogo?: string
  homeLogo?: string
  date: string
  venue: string
  venueId?: string // the game's venue id — fan scores aggregate by this
  city?: string
  fans: number
  food: number
  unique: number
  stadium: number
  score: number
  ts: number
}

export const RANKINGS_KEY = 'sbx:my-rankings:v1'

export function loadMyRankings(): MyRank[] {
  if (typeof window === 'undefined') return []
  try {
    const arr = JSON.parse(window.localStorage.getItem(RANKINGS_KEY) || '[]')
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

// Write one ranking: upsert by gameId into the shared localStorage list (same key
// /rank reads), and — when signed in — mirror it to D1 via /api/rankings (the
// server re-verifies the score and stores venue_id). Lets any page log a game
// without routing through /rank.
export function saveMyRanking(rank: MyRank, opts?: { sync?: boolean }): void {
  if (typeof window === 'undefined') return
  const list = loadMyRankings().filter((r) => r.gameId !== rank.gameId)
  list.push(rank)
  list.sort((a, b) => b.score - a.score)
  try { window.localStorage.setItem(RANKINGS_KEY, JSON.stringify(list)) } catch { /* private mode / quota */ }
  if (opts?.sync) {
    fetch('/api/rankings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rankings: [rank] }),
    }).catch(() => {})
  }
}
