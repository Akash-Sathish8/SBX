import { useEffect, useState } from 'react'
import { getJSON } from '../../lib/dataCache'
import type { Venue } from '../../lib/espn'

// Shared venue index for the profile surfaces: maps venue id -> Venue (for
// favorite posters) and lowercased name -> Venue (to best-effort link a diary
// row, whose user_rankings only store the venue NAME). One memoized fetch of
// /api/venues (getJSON dedupes across every caller).
export interface VenueIndex {
  byId: Map<string, Venue>
  byName: Map<string, Venue>
  ready: boolean
}

let cache: { byId: Map<string, Venue>; byName: Map<string, Venue> } | null = null

export function useVenues(): VenueIndex {
  const [idx, setIdx] = useState<VenueIndex>(() =>
    cache ? { ...cache, ready: true } : { byId: new Map(), byName: new Map(), ready: false },
  )

  useEffect(() => {
    if (cache) return
    let alive = true
    getJSON<{ ok: boolean; data: Venue[] }>('/api/venues')
      .then((j) => {
        if (!alive || !j?.ok || !Array.isArray(j.data)) return
        const byId = new Map<string, Venue>()
        const byName = new Map<string, Venue>()
        for (const v of j.data) {
          byId.set(String(v.id), v)
          if (v.name) byName.set(v.name.trim().toLowerCase(), v)
        }
        cache = { byId, byName }
        setIdx({ byId, byName, ready: true })
      })
      .catch(() => { if (alive) setIdx((s) => ({ ...s, ready: true })) })
    return () => { alive = false }
  }, [])

  return idx
}
