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

function Step({ label, name, note, where, walk, square }: { label: string; name: string; note?: string; where?: string; walk?: boolean; square?: boolean }) {
  return (
    <div
      className={
        'sc-step relative ' +
        (square
          ? 'mb-0 pl-[24px] border-l-[6px] ' + (walk ? 'border-[#111]' : 'border-brand-yellow')
          // story: timeline dot via ::before (sits on the rail at left:-63px)
          : "before:content-[''] before:absolute before:left-[-63px] before:top-[6px] before:w-[34px] before:h-[34px] before:rounded-full before:border-[6px] before:border-[#f7f6f2] " + (walk ? 'before:bg-[#111] before:[box-shadow:0_0_0_4px_#111]' : 'before:bg-brand-yellow before:[box-shadow:0_0_0_4px_#F7DF02]')) +
        (walk ? ' walk' : '')
      }
    >
      {/* story type scales with --scf (set by the fill effect); square uses fixed sizes */}
      <div className={'sc-slab font-display tracking-[1.5px] uppercase ' + (square ? 'text-[25px]' : '[font-size:calc(25px*var(--scf,1))]') + ' ' + (walk ? 'text-[#111]' : 'text-[#9a7e00]')}>{label}</div>
      <div className={'sc-sname font-display tracking-[0.5px] text-[#111] leading-[1.02] mt-[6px] ' + (square ? 'text-[34px]' : '[font-size:calc(44px*var(--scf,1))]')}>{name}</div>
      {note ? <div className={'sc-snote font-body text-[#555] leading-[1.34] mt-[8px] ' + (square ? 'text-[23px]' : '[font-size:calc(27px*var(--scf,1))]')}>{note}</div> : null}
      {where ? <div className={'sc-swhere font-body text-[#8a8a8a] leading-[1.3] mt-[7px] ' + (square ? 'text-[23px]' : '[font-size:calc(23px*var(--scf,1))]')}>{where}</div> : null}
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
      <div
        ref={setRefs}
        className={
          'sc relative w-[1080px] bg-[#f7f6f2] text-[#161616] font-body overflow-hidden ' +
          (format === 'story' ? 'sc-story h-[1920px]' : 'sc-square h-[1080px]')
        }
      >
        <div className="sc-tex absolute inset-0 pointer-events-none [background-image:linear-gradient(rgba(0,0,0,.035)_2px,transparent_2px),linear-gradient(90deg,rgba(0,0,0,.035)_2px,transparent_2px)] [background-size:90px_90px]" />
        <div className="sc-pad relative z-[2] h-full flex flex-col pt-[70px] pr-[72px] pb-[100px] pl-[72px]">
          <div className="sc-brand flex items-center justify-between mb-[38px]">
            <div className="sc-logo flex items-center gap-[18px]"><img className="sc-cap w-[92px] h-[92px] rounded-[16px] shadow-[5px_5px_0_#111] flex-none object-contain bg-[#111]" src="/img/logo.png" alt="Snapback Sports" width={92} height={92} /><span className="sc-wm font-display text-[46px] leading-[.9] tracking-[1px] uppercase text-[#111]">SNAPBACK<br />SPORTS</span></div>
            <div className="sc-planlab font-display text-[24px] tracking-[2px] uppercase text-[#111] bg-brand-yellow px-[18px] py-[10px] rounded-[8px]">Matchday plan</div>
          </div>
          <div className="sc-match flex items-center gap-[30px] mb-[26px]">
            <div className="sc-tm flex-1 flex flex-col items-center gap-[16px]"><span className={'sc-fl leading-[1] ' + (format === 'square' ? 'text-[84px]' : 'text-[118px]')}>{plan.homeFlag}</span><span className={'sc-nm font-display tracking-[1px] uppercase text-center leading-[.95] text-[#111] ' + (format === 'square' ? 'text-[46px]' : 'text-[58px]')}>{plan.home}</span></div>
            <div className="sc-mid flex flex-col items-center justify-center flex-none"><span className="sc-vs font-display text-[46px] text-[#111] leading-[1] self-center">VS</span></div>
            <div className="sc-tm flex-1 flex flex-col items-center gap-[16px]"><span className={'sc-fl leading-[1] ' + (format === 'square' ? 'text-[84px]' : 'text-[118px]')}>{plan.awayFlag}</span><span className={'sc-nm font-display tracking-[1px] uppercase text-center leading-[.95] text-[#111] ' + (format === 'square' ? 'text-[46px]' : 'text-[58px]')}>{plan.away}</span></div>
          </div>
          <div className="sc-when flex items-center justify-center gap-[32px] flex-wrap mb-[22px]">
            <span className="sc-chip y inline-flex items-center gap-[10px] text-[30px] font-extrabold bg-brand-yellow text-[#111] px-[24px] py-[14px] rounded-[50px] whitespace-nowrap">{plan.date} · {plan.ko}</span>
          </div>
          <div className="sc-venue flex flex-wrap justify-center items-center gap-[16px] text-[30px] text-[#666] font-semibold text-center mb-[44px]"><span>{plan.venueName} · {plan.city}</span>{plan.round ? <span className="sc-rnd inline-flex items-center font-display text-[25px] tracking-[1px] uppercase text-[#111] bg-brand-yellow px-[16px] py-[6px] rounded-[8px] leading-[1]">{plan.round}</span> : null}</div>
          <div
            className={
              format === 'square'
                ? 'sc-tl grid relative grid-cols-[1fr_1fr] gap-x-[40px] gap-y-[26px] pl-0 flex-1 content-start'
                // story: vertical rail via ::before + --scf-scaled gap
                : "sc-tl relative flex-[1_1_auto] pl-[58px] flex flex-col justify-between [gap:calc(30px*var(--scf,1))] before:content-[''] before:absolute before:left-[16px] before:top-[14px] before:bottom-[14px] before:w-[4px] before:bg-[#e3d98f]"
            }
          >
            {steps.map((s, i) => <Step key={i} label={s.label} name={s.name} note={s.note} where={s.where} walk={s.walk} square={format === 'square'} />)}
          </div>
        </div>
      </div>
    )
  },
)
