// Shareable matchday-plan card — light editorial. Rendered at full pixel size
// (1080 wide) for export; the builder scales it down for preview.
import { forwardRef } from 'react'

type Spot = { name: string; note?: string }
export type Plan = {
  home: string; away: string; homeFlag: string; awayFlag: string
  round: string; date: string; ko: string; venueName: string; city: string
  weather?: { temp: string; label: string } | null
  gettingThere?: string | null
  parking?: string | null
  pre?: Spot | null
  fanwalk?: { name: string; note?: string } | null
  eat?: Spot | null
  post?: Spot | null
}

function Step({ label, name, note, walk }: { label: string; name: string; note?: string; walk?: boolean }) {
  return (
    <div className={'sc-step' + (walk ? ' walk' : '')}>
      <div className="sc-slab">{label}</div>
      <div className="sc-sname">{name}</div>
      {note ? <div className="sc-snote">{note}</div> : null}
    </div>
  )
}

export const ShareCard = forwardRef<HTMLDivElement, { plan: Plan; format: 'story' | 'square' }>(
  function ShareCard({ plan, format }, ref) {
    const steps: any[] = []
    if (plan.gettingThere) steps.push({ label: 'Getting there', name: plan.gettingThere })
    if (plan.parking) steps.push({ label: 'Parking', name: plan.parking })
    if (plan.pre) steps.push({ label: 'Before the match', name: plan.pre.name, note: plan.pre.note })
    if (plan.fanwalk) steps.push({ label: 'Fan walk in', name: plan.fanwalk.name, note: plan.fanwalk.note, walk: true })
    if (plan.eat) steps.push({ label: 'Eat inside', name: plan.eat.name, note: plan.eat.note })
    if (plan.post) steps.push({ label: 'After the whistle', name: plan.post.name, note: plan.post.note })

    return (
      <div ref={ref} className={'sc ' + (format === 'story' ? 'sc-story' : 'sc-square')}>
        <div className="sc-tex" />
        <div className="sc-pad">
          <div className="sc-brand">
            <div className="sc-logo">SNAP<span>BACK</span></div>
            <div className="sc-planlab">Matchday plan</div>
          </div>
          <div className="sc-rnd">{plan.round}</div>
          <div className="sc-match">
            <div className="sc-tm"><span className="sc-fl">{plan.homeFlag}</span><span className="sc-nm">{plan.home}</span></div>
            <span className="sc-vs">VS</span>
            <div className="sc-tm"><span className="sc-fl">{plan.awayFlag}</span><span className="sc-nm">{plan.away}</span></div>
          </div>
          <div className="sc-when">
            <span className="sc-chip y">{plan.date} · {plan.ko}</span>
            {plan.weather ? <span className="sc-chip">{plan.weather.temp} · {plan.weather.label}</span> : null}
          </div>
          <div className="sc-venue">{plan.venueName} · {plan.city}</div>
          <div className={'sc-tl' + (format === 'square' ? ' grid' : '')}>
            {steps.map((s, i) => <Step key={i} label={s.label} name={s.name} note={s.note} walk={s.walk} />)}
          </div>
          <div className="sc-foot">
            <span>World Cup 2026 · matchday guide</span>
            <span className="sc-hand">snapback.sport</span>
          </div>
        </div>
      </div>
    )
  },
)
