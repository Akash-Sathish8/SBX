import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { MyRank } from '../lib/myRankings'
import VENUES_DATA from '../../data/venues.json'
import type { SportsVenue } from '../lib/data-types'

const ALL_VENUES = VENUES_DATA as SportsVenue[]

export function ContributePrompt({ r, onDismiss }: { r: MyRank; onDismiss: () => void }) {
  const [venueId, setVenueId] = useState<string | null>(null)

  useEffect(() => {
    const match = ALL_VENUES.find(v => v.name === r.venue)
    setVenueId(match?.id ?? null)
  }, [r.venue])

  return (
    <div
      className="mb-6 bg-white border-[3px] border-[#222] shadow-[4px_4px_0_#222] rounded-[8px] p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center"
      role="status"
    >
      <div className="flex-1">
        <div className="font-display text-[15px] uppercase tracking-[0.5px] text-ink mb-0.5">Help other fans</div>
        <div className="font-body text-[13px] text-[#666]">
          You ranked {r.away} @ {r.home}{r.venue ? ` at ${r.venue}` : ''}. Leave tips and write a review.
        </div>
      </div>
      <div className="flex gap-3 shrink-0 items-center">
        {venueId ? (
          <Link
            to="/venue/$id"
            params={{ id: venueId }}
            onClick={onDismiss}
            className="bg-ink text-brand-yellow font-display text-[12px] uppercase tracking-[0.5px] px-4 py-2 border-[2px] border-[#222] shadow-[3px_3px_0_#222] no-underline hover:-translate-y-px [transition:transform_.1s]"
          >
            Write a review →
          </Link>
        ) : (
          <Link
            to="/venues"
            onClick={onDismiss}
            className="bg-ink text-brand-yellow font-display text-[12px] uppercase tracking-[0.5px] px-4 py-2 border-[2px] border-[#222] shadow-[3px_3px_0_#222] no-underline hover:-translate-y-px [transition:transform_.1s]"
          >
            Find the venue →
          </Link>
        )}
        <button onClick={onDismiss} className="font-body text-[13px] text-[#555] underline cursor-pointer bg-transparent border-0">
          Maybe later
        </button>
      </div>
    </div>
  )
}
