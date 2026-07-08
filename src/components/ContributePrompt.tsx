import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { getJSON } from '../lib/dataCache'
import type { MyRank } from '../lib/myRankings'
import type { Venue } from '../lib/espn'

// Inline nudge shown on /rank right after a fan adds a ranking: invite them to
// contribute the qualitative side — tips + a written review — for that venue.
// A ranked game only carries the venue NAME, so we resolve it to a venue id via
// /api/venues (the same name match the venue page uses) to deep-link into the
// venue's "What do I need to know?" forum with the review form open (?review=1).
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
          You ranked {r.away} @ {r.home}{r.venue ? ` at ${r.venue}` : ''}. Leave tips &amp; write a review of the experience.
        </span>
      </div>
      <div className="sbx-sp-actions">
        {venueId ? (
          <Link className="sbx-sp-go" to="/venue" search={{ id: venueId, review: 1 }} onClick={onDismiss}>
            Write a review →
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
