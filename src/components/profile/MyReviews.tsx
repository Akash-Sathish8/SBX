import { Link } from '@tanstack/react-router'
import type { ProfileReview } from './types'
import type { VenueIndex } from './useVenues'

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
    <section className="pf-block">
      <div className="pf-blockhead"><h2>Reviews <span className="pf-count">{reviews.length}</span></h2></div>
      {reviews.length === 0 ? (
        <div className="pf-empty">{mine ? 'You haven’t written any reviews yet.' : 'No reviews yet.'}</div>
      ) : (
        <div className="pf-reviews">
          {reviews.map((rv) => {
            const v = rv.scope === 'venue' ? venues.byId.get(rv.targetId) : undefined
            return (
              <div key={rv.id} className="pf-review">
                <div className="pf-review-head">
                  {v ? (
                    <Link to="/venue" search={{ id: v.id }} className="pf-review-target">{v.name}</Link>
                  ) : (
                    <span className="pf-review-target muted">{rv.scope === 'event' ? 'Game review' : 'Venue review'}</span>
                  )}
                  {typeof rv.rating === 'number' ? <span className="pf-review-score">{rv.rating}/10</span> : null}
                  <span className="pf-review-ago">{timeAgo(rv.createdAt)}</span>
                </div>
                <div className="pf-review-body">{rv.body}</div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
