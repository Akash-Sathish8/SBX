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
