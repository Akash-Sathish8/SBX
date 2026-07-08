// Personal game diary entry — shape stored in localStorage and D1 via /api/rankings.
// Mirrors the arcade-demo's MyRank but uses `sport` (ESPN slug) instead of `league`.
export interface MyRank {
  gameId: string
  sport: string   // 'nfl' | 'mlb' | 'nba' | 'nhl' | 'college-football' | 'mens-college-basketball'
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

export function saveMyRankings(list: MyRank[]): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(RANKINGS_KEY, JSON.stringify(list)) } catch { /* quota */ }
}

// Merge two lists by gameId; latest ts wins. Sorted by score desc.
export function mergeRankings(a: MyRank[], b: MyRank[]): MyRank[] {
  const m = new Map<string, MyRank>()
  for (const r of [...a, ...b]) {
    const cur = m.get(r.gameId)
    if (!cur || r.ts >= cur.ts) m.set(r.gameId, r)
  }
  return [...m.values()].sort((x, y) => y.score - x.score)
}
