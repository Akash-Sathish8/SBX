// Shareable matchday-plan card — light editorial. Rendered at full pixel size
// (1080 wide) for export; the builder scales it down for preview.
import { forwardRef, useRef } from 'react'
import { useShareCardFit } from '../lib/useShareCardFit'

type Spot = { name: string; note?: string; where?: string }
export type Plan = {
  home: string; away: string; homeAbbr: string; awayAbbr: string
  homeColor?: string; awayColor?: string
  round: string; date: string; ko: string; venueName: string; city: string
  weather?: { temp: string; label: string } | null
  gettingThere?: Spot | null
  parking?: Spot | null
  pre?: Spot[] | null
  fanwalk?: { name: string; note?: string; where?: string } | null
  eat?: Spot[] | null
  merch?: Spot[] | null
  post?: Spot[] | null
}

function Step({ label, name, note, where, walk }: { label: string; name: string; note?: string; where?: string; walk?: boolean }) {
  return (
    <div className={'sc-step' + (walk ? ' walk' : '')}>
      <div className="sc-slab">{label}</div>
      <div className="sc-sname">{name}</div>
      {note ? <div className="sc-snote">{note}</div> : null}
      {where ? <div className="sc-swhere">{where}</div> : null}
    </div>
  )
}

export const ShareCard = forwardRef<HTMLDivElement, { plan: Plan; format: 'story' | 'square' }>(
  function ShareCard({ plan, format }, ref) {
    const steps: any[] = []
    if (plan.gettingThere) steps.push({ label: 'Getting there', name: plan.gettingThere.name, note: plan.gettingThere.note, where: plan.gettingThere.where })
    if (plan.parking) steps.push({ label: 'Parking', name: plan.parking.name, note: plan.parking.note, where: plan.parking.where })
    if (plan.fanwalk) steps.push({ label: 'Fan walk in', name: plan.fanwalk.name, note: plan.fanwalk.note, where: plan.fanwalk.where, walk: true })
    ;(plan.pre || []).forEach((s) => steps.push({ label: 'Before the match', name: s.name, note: s.note, where: s.where }))
    ;(plan.eat || []).forEach((s) => steps.push({ label: 'Eat inside', name: s.name, note: s.note, where: s.where }))
    ;(plan.merch || []).forEach((s) => steps.push({ label: 'Merch', name: s.name, note: s.note, where: s.where }))
    ;(plan.post || []).forEach((s) => steps.push({ label: 'After the whistle', name: s.name, note: s.note, where: s.where }))

    // Content-aware fill (extracted to useShareCardFit; story-only, exactly as
    // before — square uses fixed sizes on this card).
    const localRef = useRef<HTMLDivElement | null>(null)
    const setRefs = (node: HTMLDivElement | null) => {
      localRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) (ref as any).current = node
    }
    const sig = format + '|' + steps.map((s) => s.label + s.name + (s.note || '') + (s.where || '')).join('¦')
    useShareCardFit(localRef, sig, { fit: format === 'story', stepsCount: steps.length })
    return (
      <div ref={setRefs} className={'sc ' + (format === 'story' ? 'sc-story' : 'sc-square')}>
        <div className="sc-tex" />
        <div className="sc-pad">
          <div className="sc-brand">
            <div className="sc-logo"><img className="sc-cap" src="/img/logo.png" alt="Snapback Sports" width={92} height={92} /><span className="sc-wm">SNAPBACK<br />SPORTS</span></div>
            <div className="sc-planlab">Matchday plan</div>
          </div>
          <div className="sc-match">
            <div className="sc-tm"><span className="sc-badge" style={{ background: plan.awayColor || '#1a1a1a' }}>{plan.awayAbbr}</span><span className="sc-nm">{plan.away}</span></div>
            <div className="sc-mid"><span className="sc-vs">@</span></div>
            <div className="sc-tm"><span className="sc-badge" style={{ background: plan.homeColor || '#1a1a1a' }}>{plan.homeAbbr}</span><span className="sc-nm">{plan.home}</span></div>
          </div>
          <div className="sc-when">
            <span className="sc-chip y">{plan.date} · {plan.ko}</span>
          </div>
          <div className="sc-venue"><span>{plan.venueName} · {plan.city}</span>{plan.round ? <span className="sc-rnd">{plan.round}</span> : null}</div>
          <div className={'sc-tl' + (format === 'square' ? ' grid' : '')}>
            {steps.map((s, i) => <Step key={i} label={s.label} name={s.name} note={s.note} where={s.where} walk={s.walk} />)}
          </div>
        </div>
      </div>
    )
  },
)
