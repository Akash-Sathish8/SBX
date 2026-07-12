import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { getJSON } from '../lib/dataCache'
import type { MyRank } from '../lib/myRankings'
import type { Venue } from '../lib/espn'

// Card chrome shared with SaveRankingsPrompt (was the .sbx-sp-* block).
const card = 'mb-[22px] flex flex-wrap items-center justify-between gap-[16px] rounded-[12px] border-[3px] border-[#111] bg-[#1d1d1f] px-[20px] py-[16px] text-white shadow-[6px_6px_0_0_#F7DF02] max-[520px]:flex-col max-[520px]:items-stretch'
const goCls = 'h-auto rounded-[9px] px-[18px] py-[11px] text-[13px] tracking-[.5px] whitespace-nowrap'
const laterCls = 'h-auto p-[8px] text-[13px] font-bold text-[#a9a9ad] hover:bg-transparent hover:text-white'

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
    <div className={card} role="status">
      <div className="flex min-w-[200px] flex-1 flex-col gap-[3px]">
        <strong className="font-display text-[18px] uppercase tracking-[.6px]">Help other fans</strong>
        <span className="font-sans text-[13.5px] font-medium text-[#c9c9cc]">
          You ranked {r.away} @ {r.home}{r.venue ? ` at ${r.venue}` : ''}. Leave a tip to help the next fan going.
        </span>
      </div>
      <div className="flex items-center gap-[10px] max-[520px]:justify-between">
        {venueId ? (
          <Button asChild variant="brand" className={goCls}>
            <Link to="/venue" search={{ id: venueId, tip: 1 }} onClick={onDismiss}>Leave a tip →</Link>
          </Button>
        ) : (
          <Button asChild variant="brand" className={goCls}>
            <Link to="/venues" onClick={onDismiss}>Find the venue →</Link>
          </Button>
        )}
        <Button variant="ghost" className={laterCls} onClick={onDismiss}>Maybe later</Button>
      </div>
    </div>
  )
}
