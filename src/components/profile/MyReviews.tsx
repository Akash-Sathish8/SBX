import { Link } from '@tanstack/react-router'
import type { ProfileReview } from './types'
import type { VenueIndex } from './useVenues'
import { block, blockHead, blockH2, count, empty, card } from './ui'

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime()
  if (isNaN(t)) return ''
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return m + 'm ago'
  const h = Math.floor(m / 60); if (h < 24) return h + 'h ago'
  const d = Math.floor(h / 24); if (d < 30) return d + 'd ago'
  const mo = Math.floor(d / 30); if (mo < 12) return mo + 'mo ago'
  return Math.floor(mo / 12) + 'y ago'
}

// The user's written reviews. Each review's target (a venue id, or 'league:gameId'
// for an event) resolves to a venue name + link when we know it; otherwise the
// review still renders with a neutral label.
export function MyReviews({ reviews, venues, mine }: { reviews: ProfileReview[]; venues: VenueIndex; mine: boolean }) {
  return (
    <section className={block}>
      <div className={blockHead}><h2 className={blockH2}>Reviews <span className={count}>{reviews.length}</span></h2></div>
      {reviews.length === 0 ? (
        <div className={empty}>{mine ? 'You haven’t written any reviews yet.' : 'No reviews yet.'}</div>
      ) : (
        <div className="flex flex-col gap-[11px]">
          {reviews.map((rv) => {
            const v = rv.scope === 'venue' ? venues.byId.get(rv.targetId) : undefined
            return (
              <div key={rv.id} className={card + ' px-[16px] py-[13px]'}>
                <div className="mb-[6px] flex flex-wrap items-center gap-[10px]">
                  {v ? (
                    <Link to="/venue" search={{ id: v.id }} className="font-extrabold !text-[#b58900] hover:!text-[#111]">{v.name}</Link>
                  ) : (
                    <span className="font-extrabold text-[#888]">{rv.scope === 'event' ? 'Game review' : 'Venue review'}</span>
                  )}
                  {typeof rv.rating === 'number' ? <span className="rounded-[5px] bg-[#222] px-[9px] py-px font-display text-[13px] text-brand">{rv.rating}/10</span> : null}
                  <span className="text-[11px] font-bold uppercase tracking-[.3px] text-[#6b6b6b]">{timeAgo(rv.createdAt)}</span>
                </div>
                <div className="text-[14.5px] leading-[1.55] whitespace-pre-wrap text-[#33352f]">{rv.body}</div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
