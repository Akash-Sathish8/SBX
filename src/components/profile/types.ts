import type { MyRank } from '../../lib/myRankings'

export interface ProfileReview {
  id: string
  scope: string // 'venue' | 'event'
  targetId: string
  gameId?: string
  rating?: number
  body: string
  createdAt: string
  official?: boolean
  mine?: boolean
}

export interface ProfileData {
  username: string | null
  displayName?: string | null
  bio: string | null
  avatar: string | null
  favorites: string[] // venue ids
  rankings: MyRank[]
  reviews: ProfileReview[]
  createdAt?: string | null
  followers?: number
  following?: number
  isFollowing?: boolean
}

const MON3 = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

export function diaryDate(iso: string): { day: string; year: string } {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return { day: '', year: '' }
  return { day: `${MON3[d.getMonth()]} ${d.getDate()}`, year: String(d.getFullYear()) }
}

export function initialsFor(name: string | null | undefined): string {
  const s = String(name ?? '').trim()
  return s ? s[0]!.toUpperCase() : '?'
}

export const AVATAR_PRESETS = ['#F7DF02', '#1f9d4d', '#e0533d', '#3d7be0', '#9b59b6', '#e08f3d', '#16a3a3', '#d4488f']

export function presetColor(key: string | null | undefined): string {
  if (typeof key === 'string' && key.startsWith('preset:')) {
    const n = parseInt(key.slice(7), 10)
    if (Number.isFinite(n) && n >= 0 && n < AVATAR_PRESETS.length) return AVATAR_PRESETS[n]!
  }
  return '#2c2c2c'
}
