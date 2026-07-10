import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { getJSON } from '../lib/dataCache'
import type { MyRank } from '../lib/myRankings'
import type { Venue } from '../lib/espn'

// Inline nudge shown on /rank right after a fan adds a ranking, as the FALLBACK
// when the direct post-rank handoff couldn't resolve the venue up front (rank.tsx
// normally navigates straight to the venue's tip composer, ?tip=1). A ranked game
// only carries the venue NAME, so we resolve it to a venue id via /api/venues.
export function ContributePrompt({ r, onDismiss }: { r: MyRank; onDismiss: () => void }) {
  const [venueId, setVenueId] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    getJSON('/api/venues')
      .then((res: any) => {
        const list: Venue[] = Array.isArray(res?.data) ? res.data : []
        const match = list.find((v) => v.name === r.venue)
        if (alive) setVenueId(match?.id ?? null)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [r.venue])

  return (
    <div className="sbx-saveprompt" role="status">
      <div className="sbx-sp-copy">
        <strong>Help other fans</strong>
        <span>
          You ranked {r.away} @ {r.home}{r.venue ? ` at ${r.venue}` : ''}. Leave a tip to help the next fan going.
        </span>
      </div>
      <div className="sbx-sp-actions">
        {venueId ? (
          <Link className="sbx-sp-go" to="/venue" search={{ id: venueId, tip: 1 }} onClick={onDismiss}>
            Leave a tip →
          </Link>
        ) : (
          <Link className="sbx-sp-go" to="/venues" onClick={onDismiss}>
            Find the venue →
          </Link>
        )}
        <button className="sbx-sp-later" onClick={onDismiss}>Maybe later</button>
      </div>
    </div>
  )
}
