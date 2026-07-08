// Expert experience-rankings shared types + helpers (data: /data/experiences.json,
// built from the CSV by scripts/build-experiences.mjs). Lives in lib so venue/team
// pages, the home page, and rankings all consume one definition.
import type { Venue } from './espn'

// Expert-rated US experience (one row of experiences.json).
export interface Experience {
  rank: number
  name: string
  location: string
  sport: string
  fans: number
  food: number
  unique: number
  stadium: number
  final: number
  image?: string // best-effort venue photo (team-matched from /api/venues; events stay image-less)
}

// Best-effort: attach a venue photo to team-based experiences (e.g. "Chicago
// Cubs" → Wrigley) by matching the experience name to a venue's team. Events
// (Kentucky Derby, Indy 500) won't match and stay image-less — real or nothing.
export function expImage(name: string, venues: Venue[]): string | undefined {
  const n = name.toLowerCase()
  for (const ven of venues) {
    if (!ven.image) continue
    for (const t of ven.teams || []) {
      const dn = (t.displayName || '').toLowerCase()
      if (dn.length > 5 && n.includes(dn)) return ven.image
    }
  }
  return undefined
}
