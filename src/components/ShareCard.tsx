// Shareable matchday-plan card — light editorial. Rendered at full pixel size
// (1080 wide) for export; the builder scales it down for preview.
import { forwardRef, useLayoutEffect, useRef } from 'react'

type Spot = { name: string; note?: string; where?: string }
export type Plan = {
  home: string; away: string; homeFlag: string; awayFlag: string
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

    // Content-aware fill: measure the timeline and auto-scale its type (--scf) so
    // the plan fills the fixed 1080x1920 frame whether few or many spots are picked,
    // and never overflows (which would clip text).
    const localRef = useRef<HTMLDivElement | null>(null)
    const setRefs = (node: HTMLDivElement | null) => {
      localRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) (ref as any).current = node
    }
    const sig = format + '|' + steps.map((s) => s.label + s.name + (s.note || '') + (s.where || '')).join('¦')
    useLayoutEffect(() => {
      const root = localRef.current
      if (!root || format !== 'story') return
      const tl = root.querySelector('.sc-tl') as HTMLElement | null
      const pad = root.querySelector('.sc-pad') as HTMLElement | null
      const foot = root.querySelector('.sc-foot') as HTMLElement | null
      if (!tl || !pad) return
      const wheres = Array.from(root.querySelectorAll<HTMLElement>('.sc-swhere'))
      const notes = Array.from(root.querySelectorAll<HTMLElement>('.sc-snote'))
      // reset to full detail + neutral scale before measuring
      root.style.setProperty('--scf', '1')
      wheres.forEach((el) => { el.style.display = '' })
      notes.forEach((el) => { el.style.display = '' })
      const padBottom = parseFloat(getComputedStyle(pad).paddingBottom) || 56
      const avail = root.offsetHeight - tl.offsetTop - (foot ? foot.offsetHeight : 0) - padBottom - 6
      // un-stretch the (flex:1) timeline so scrollHeight is the true content height
      const measure = () => { const f = tl.style.flex; tl.style.flex = '0 0 auto'; const h = tl.scrollHeight; tl.style.flex = f; return h }
      if (avail > 0) {
        // Agenda too tall to fit readably → CUT secondary detail before shrinking
        // type: drop the muted "where" line first, then the "note" line.
        if (measure() > avail) wheres.forEach((el) => { el.style.display = 'none' })
        if (measure() > avail) notes.forEach((el) => { el.style.display = 'none' })
        // Final micro-fit: scale up to fill (few steps) or down to fit (many).
        const scf = Math.max(0.5, Math.min(1.3, avail / measure()))
        root.style.setProperty('--scf', String(Math.round(scf * 1000) / 1000))
      }
      // very short plans read better centered; longer ones spread along the timeline
      tl.style.justifyContent = steps.length <= 2 ? 'space-around' : 'space-between'
    }, [sig])
    return (
      <div ref={setRefs} className={'sc ' + (format === 'story' ? 'sc-story' : 'sc-square')}>
        <div className="sc-tex" />
        <div className="sc-pad">
          <div className="sc-brand">
            <div className="sc-logo"><img className="sc-cap" src="/img/logo.png" alt="Snapback Sports" width={92} height={92} /><span className="sc-wm">SNAPBACK<br />SPORTS</span></div>
            <div className="sc-planlab">Matchday plan</div>
          </div>
          <div className="sc-match">
            <div className="sc-tm"><span className="sc-fl">{plan.homeFlag}</span><span className="sc-nm">{plan.home}</span></div>
            <div className="sc-mid"><span className="sc-vs">VS</span></div>
            <div className="sc-tm"><span className="sc-fl">{plan.awayFlag}</span><span className="sc-nm">{plan.away}</span></div>
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
