// Shareable venue-plan card — light editorial, sibling of the matchday ShareCard.
// Same 1080-wide .sc frame + share.css step system, so renderShareCardBlob and
// useShareCardFit apply unchanged; the header swaps the matchup for the venue
// ("MY CITI FIELD PLAN"). Deliberately no venue photo: html-to-image silently
// drops remote images it can't fetch (see getLogoDataUri), and the card must
// export identically everywhere.
import { forwardRef, useRef } from 'react'
import { useShareCardFit } from '../lib/useShareCardFit'

export type VenuePlanCard = {
  venueName: string
  city: string // "Queens, NY" — city + state pre-joined by the builder
  steps: { label: string; name: string; by?: string }[] // by = "via @author" credit
}

function Step({ label, name, by }: { label: string; name: string; by?: string }) {
  return (
    <div className="sc-step">
      <div className="sc-slab">{label}</div>
      <div className="sc-sname">{name}</div>
      {/* credit rides the muted .sc-swhere tier so the fit hook drops it FIRST
          when the plan runs long — the item itself always survives */}
      {by ? <div className="sc-swhere">{by}</div> : null}
    </div>
  )
}

export const VenueShareCard = forwardRef<HTMLDivElement, { plan: VenuePlanCard; format: 'story' | 'square' }>(
  function VenueShareCard({ plan, format }, ref) {
    const localRef = useRef<HTMLDivElement | null>(null)
    const setRefs = (node: HTMLDivElement | null) => {
      localRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) (ref as any).current = node
    }
    const sig = format + '|' + plan.venueName + '|' + plan.steps.map((s) => s.label + s.name + (s.by || '')).join('¦')
    // Unlike the matchday card, BOTH formats fit-to-frame here (share.css carries
    // matching .sc-square --scf rules); grid mode skips the justify tweak.
    useShareCardFit(localRef, sig, { fit: true, grid: format === 'square', stepsCount: plan.steps.length })
    return (
      <div ref={setRefs} className={'sc ' + (format === 'story' ? 'sc-story' : 'sc-square')}>
        <div className="sc-tex" />
        <div className="sc-pad">
          <div className="sc-brand">
            <div className="sc-logo"><img className="sc-cap" src="/img/logo.png" alt="Snapback Sports" width={92} height={92} /><span className="sc-wm">SNAPBACK<br />SPORTS</span></div>
            <div className="sc-planlab">Venue plan</div>
          </div>
          <div className="scv-title">My {plan.venueName} plan</div>
          {plan.city ? <div className="sc-venue"><span>{plan.city}</span></div> : null}
          <div className={'sc-tl' + (format === 'square' ? ' grid' : '')}>
            {plan.steps.map((s, i) => <Step key={i} label={s.label} name={s.name} by={s.by} />)}
          </div>
        </div>
      </div>
    )
  },
)
