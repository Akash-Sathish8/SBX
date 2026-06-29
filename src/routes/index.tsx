import { useEffect, useRef, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { MapIcon, BeerIcon, HamburgerIcon, FlagIcon, ShoppingBagIcon, type LucideIcon } from 'lucide-react'
import { SiteNav } from '../components/SiteNav'
import { VenueCard } from '../components/VenueCard'
import { venueMeta, type VenueMeta } from '../lib/venues-meta'
import { absUrl, socialMeta } from '../lib/site'

export const Route = createFileRoute('/')({
  head: () => {
    const title = 'Snapback — World Cup 2026 Matchday Guides, Venues & Tickets'
    const description =
      'Plan your FIFA World Cup 2026 matchday across all 16 venues in the USA, Canada and Mexico — how to get there, where to eat and drink, fan intel, and a shareable matchday agenda for every game.'
    const image = absUrl('/img/stadiums/sofi.jpg')
    return {
      links: [
        { rel: 'canonical', href: absUrl('/') },
      ],
      meta: socialMeta({ title, description, image }),
    }
  },
  component: Home,
})

// Rotating hero stadium: photo + fan comment + ranking (ported from index.html script).
// Slide 0 mirrors the original page's hand-set initial markup (quote + bar widths).
type Det = [string, number, number] // [label, value, width%]
type Slide = {
  img: string; av: string; nm: string; mt: string; stars: number; q: string
  cc: string; cv: string; crit: number; fan: number; det: Det[]
}
const slides: Slide[] = [
  { img: '/img/stadiums/sofi.jpg', av: 'C', nm: 'Casey M.', mt: 'SoFi · USA vs PAR', stars: 5,
    q: '"Loudest 90 minutes of my life. Get there early, the food court by section 130 is unreal."',
    cc: 'Los Angeles · USA', cv: 'SoFi Stadium', crit: 84, fan: 90,
    det: [['Atmosphere', 9, 92], ['Food', 8, 84], ['Parking', 6, 58]] },
  { img: '/img/stadiums/azteca.jpg', av: 'D', nm: 'Diego M.', mt: 'Azteca · Opening match', stars: 5,
    q: '"History you can feel. The altitude is no joke — pace yourself."',
    cc: 'Mexico City · MEX', cv: 'Estadio Azteca', crit: 95, fan: 71,
    det: [['Atmosphere', 10, 100], ['History', 10, 100], ['Altitude', 4, 40]] },
  { img: '/img/stadiums/arrowhead.jpg', av: 'J', nm: 'Jordan P.', mt: 'Arrowhead · ARG vs ALG', stars: 4,
    q: '"Tailgate is the whole event. Lot G fills by 9am — get there early."',
    cc: 'Kansas City · USA', cv: 'Arrowhead Stadium', crit: 92, fan: 88,
    det: [['Atmosphere', 10, 100], ['Tailgate', 9, 90], ['Parking', 7, 70]] },
  { img: '/img/stadiums/metlife.jpg', av: 'L', nm: 'Leo R.', mt: 'MetLife · The Final', stars: 4,
    q: '"It hosts the final, enough said. Take the train, do not drive."',
    cc: 'New York · USA', cv: 'MetLife Stadium', crit: 79, fan: 74,
    det: [['Atmosphere', 7, 70], ['Transit', 6, 60], ['Big stage', 10, 100]] },
  { img: '/img/stadiums/bcplace.jpg', av: 'P', nm: 'Priya N.', mt: 'BC Place · CAN vs QAT', stars: 4,
    q: '"Roof open, lakeside walk in. Best night of the whole trip."',
    cc: 'Vancouver · CAN', cv: 'BC Place', crit: 82, fan: 80,
    det: [['Atmosphere', 8, 80], ['Food', 7, 70], ['Getting in', 8, 80]] },
]

// Curated scroll order for the home marquee; metadata comes from venues-meta.
const MARQUEE_IDS = [
  'sofi', 'arrowhead', 'azteca', 'mercedes', 'metlife', 'bcplace', 'att', 'nrg',
  'hardrock', 'linc', 'levis', 'lumen', 'gillette', 'bmo', 'akron', 'bbva',
] as const
const MARQUEE = MARQUEE_IDS.map((id) => venueMeta(id)).filter((v): v is VenueMeta => v !== null)

function MarqueeCard({ v, hidden }: { v: VenueMeta; hidden?: boolean }) {
  return (
    <VenueCard
      v={v}
      hidden={hidden}
      tone="dark"
      photoClassName="h-[148px]"
      className="relative z-[1] opacity-100 flex-[0_0_280px] max-[520px]:flex-[0_0_76vw]"
    />
  )
}

// Matchday agenda mockups, dealt like a hand of playing cards. Each card carries a
// playing-card rank (A/K/Q/J/10 + ball suit); every card opens the match-guide builder.
type AgendaRow = [LucideIcon, string, string] // [icon, section label, sample plan]
type AgendaMock = { game: string; rank: string; match: string; venue: string; when: string; rows: AgendaRow[] }
const AGENDAS: AgendaMock[] = [
  { game: 'azteca-jun11', rank: 'K', match: 'MEX v RSA', venue: 'Estadio Azteca · Mexico City', when: 'Jun 11 · 1:00 PM', rows: [
    [MapIcon,'Getting there', 'Tren Ligero, Azteca stop'],
    [BeerIcon,'Before the match', 'Tacos in Coyoacán'],
    [HamburgerIcon,'Eat inside', 'Churros + michelada'],
    [ShoppingBagIcon,'Merch', 'El Tri home jersey'],
    [FlagIcon,'After the whistle', 'Mariachi in Garibaldi'],
  ] },
  { game: 'metlife-jun13', rank: 'Q', match: 'BRA v MAR', venue: 'MetLife Stadium · New York', when: 'Jun 13 · 6:00 PM', rows: [
    [MapIcon,'Getting there', 'NJ Transit from Penn'],
    [BeerIcon,'Before the match', 'Samba in the lots'],
    [HamburgerIcon,'Eat inside', 'Pretzel + cold lager'],
    [ShoppingBagIcon,'Merch', "Seleção '26 kit"],
    [FlagIcon,'After the whistle', 'Train back to Manhattan'],
  ] },
  { game: 'sofi-jun12', rank: 'A', match: 'USA v PAR', venue: 'SoFi Stadium · Los Angeles', when: 'Jun 12 · 6:00 PM', rows: [
    [MapIcon,'Getting there', 'Metro K + SoFi shuttle'],
    [BeerIcon,'Before the match', 'Tailgate on Lot K'],
    [HamburgerIcon,'Eat inside', 'Food court, section 130'],
    [ShoppingBagIcon,'Merch', 'USA scarf, south shop'],
    [FlagIcon,'After the whistle', 'Lake Park fan fest'],
  ] },
  { game: 'arrowhead-jun16', rank: 'J', match: 'ARG v ALG', venue: 'Arrowhead Stadium · Kansas City', when: 'Jun 16 · 8:00 PM', rows: [
    [MapIcon,'Getting there', 'Drive in, Lot G by 9am'],
    [BeerIcon,'Before the match', 'BBQ tailgate till kickoff'],
    [HamburgerIcon,'Eat inside', 'Burnt ends, section 132'],
    [ShoppingBagIcon,'Merch', 'Albiceleste flag'],
    [FlagIcon,'After the whistle', 'Power & Light party'],
  ] },
  { game: 'bcplace-jun18', rank: '10', match: 'CAN v QAT', venue: 'BC Place · Vancouver', when: 'Jun 18 · 3:00 PM', rows: [
    [MapIcon,'Getting there', 'SkyTrain to Chinatown'],
    [BeerIcon,'Before the match', 'Seawall walk to the gates'],
    [HamburgerIcon,'Eat inside', 'Japadog on the concourse'],
    [ShoppingBagIcon,'Merch', 'Maple leaf scarf'],
    [FlagIcon,'After the whistle', 'Gastown patios'],
  ] },
]

// Per-position fan transforms for the 5 agenda cards (was a `.acard:nth-child` block).
// Driving it off the map index keeps the base transform a non-variant utility, so
// `hover:` reliably overrides it (Tailwind sorts hover variants after the base).
const FAN_TRANSFORMS = ['[transform:rotate(-8deg)_translateY(30px)]', '[transform:rotate(-4deg)_translateY(9px)]', '[transform:rotate(0deg)]', '[transform:rotate(4deg)_translateY(9px)]', '[transform:rotate(8deg)_translateY(30px)]']

function AgendaCard({ a, i }: { a: AgendaMock; i: number }) {
  const fan = FAN_TRANSFORMS[i] ?? '[transform:rotate(0deg)]'
  const mobile = i % 2 ? 'max-[760px]:[transform:rotate(1.6deg)]' : 'max-[760px]:[transform:rotate(-1.6deg)]'
  return (
    <Link to="/guide" className={`relative flex-[0_0_252px] aspect-[5/7] flex flex-col overflow-hidden no-underline text-inherit bg-white border-[5px] border-[#222] rounded-[14px] shadow-[8px_8px_0_0_#222] pt-[36px] px-[18px] pb-[14px] mx-[-19px] [transition:transform_.16s_ease-out,box-shadow_.15s,border-color_.15s] ${fan} ${mobile} hover:[transform:rotate(0deg)_translateY(-16px)_scale(1.04)] hover:z-10 hover:border-brand-yellow hover:shadow-[12px_12px_0_0_#222] focus-visible:outline-4 focus-visible:outline-brand-yellow-dim focus-visible:outline-offset-2 max-[760px]:flex-[0_0_240px] max-[760px]:mx-0`}>
      <span className="acorner tl absolute flex flex-col items-center leading-none top-[10px] left-[12px]" aria-hidden="true"><b className="font-display font-normal text-[17px] text-[#222] tracking-[0]">{a.rank}</b><i className="not-italic text-[9px] [filter:brightness(0)] mt-[2px]">⚽</i></span>
      <span className="acorner br absolute flex flex-col items-center leading-none bottom-[10px] right-[12px] rotate-180" aria-hidden="true"><b className="font-display font-normal text-[17px] text-[#222] tracking-[0]">{a.rank}</b><i className="not-italic text-[9px] [filter:brightness(0)] mt-[2px]">⚽</i></span>
      <span className="acard-hd block text-center mb-[12px]">
        <span className="acard-match block font-display text-[23px] tracking-[1px] text-[#222] leading-[1.05]">{a.match}</span>
        <span className="acard-meta block text-[10px] font-bold uppercase tracking-[0.4px] text-[#6b6b6b] mt-[4px] whitespace-nowrap overflow-hidden text-ellipsis">{a.venue}</span>
        <span className="acard-meta block text-[10px] font-bold uppercase tracking-[0.4px] text-[#6b6b6b] mt-[4px] whitespace-nowrap overflow-hidden text-ellipsis">{a.when}</span>
      </span>
      <span className="acard-rows flex flex-col justify-evenly gap-[8px] flex-1 min-h-0">
        {a.rows.map(([Ic, label, val], i) => (
          <span className="acard-row flex items-center gap-[9px] min-w-0" key={i}>
            <span className="ai flex-[0_0_auto] w-[26px] h-[26px] flex items-center justify-center bg-brand-yellow border-2 border-[#111] rounded-[7px]"><Ic className="ai-gl w-[15px] h-[15px] text-[#111] [stroke-width:2]" /></span>
            <span className="at flex flex-col min-w-0"><b className="text-[8.5px] font-bold tracking-[0.6px] uppercase text-[#6b6b6b]">{label}</b><span className="text-[12px] font-semibold text-[#222] leading-[1.25] whitespace-nowrap overflow-hidden text-ellipsis">{val}</span></span>
          </span>
        ))}
      </span>
      <span className="acard-ft block mt-[10px] text-center text-[8px] font-bold tracking-[1.2px] uppercase text-[#b5b5b5] border-t-2 border-[#eee] pt-[7px]">Snapback · Matchday Agenda</span>
    </Link>
  )
}

function Home() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  // Hero stadium carousel. Desktop crossfades between stacked slides; mobile is a
  // native horizontal scroll-snap rail you swipe by hand. Scrollability is CSS-only
  // (works without JS) — this effect only auto-advances every 4s and keeps the
  // active dot in sync, and on mobile it yields the moment you drag.
  useEffect(() => {
    const mqMobile = window.matchMedia('(max-width: 860px)')
    let teardown = () => {}
    const setup = () => {
      teardown()
      const el = scrollRef.current
      if (mqMobile.matches && el) {
        let userDriven = false
        let raf = 0
        const sync = () => { raf = 0; setActive(Math.round(el.scrollLeft / el.clientWidth)) }
        const onScroll = () => { if (!raf) raf = requestAnimationFrame(sync) }
        const onTouch = () => { userDriven = true }
        el.addEventListener('scroll', onScroll, { passive: true })
        el.addEventListener('touchstart', onTouch, { passive: true })
        const id = setInterval(() => {
          if (userDriven || !el.clientWidth) return
          const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % slides.length
          el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' })
        }, 4000)
        teardown = () => {
          el.removeEventListener('scroll', onScroll)
          el.removeEventListener('touchstart', onTouch)
          if (raf) cancelAnimationFrame(raf)
          clearInterval(id)
        }
      } else {
        const id = setInterval(() => setActive((p) => (p + 1) % slides.length), 4000)
        teardown = () => clearInterval(id)
      }
    }
    setup()
    const onChange = () => { setActive(0); setup() }
    mqMobile.addEventListener('change', onChange)
    return () => { teardown(); mqMobile.removeEventListener('change', onChange) }
  }, [])

  const goTo = (k: number) => {
    setActive(k)
    const el = scrollRef.current
    if (el && el.clientWidth) el.scrollTo({ left: k * el.clientWidth, behavior: 'smooth' })
  }

  return (
    <>
      <SiteNav active="home" />

      <main>
      {/* HERO (concept A: split / share + compare) */}
      <section className="a-hero grid w-full p-0 grid-cols-[46%_54%] min-h-[calc(100vh-72px)] max-[860px]:grid-cols-[1fr]">
        <div className="a-left grid-overlay [--grid-line:rgba(17,17,17,.06)] relative z-[1] flex flex-col min-w-0 [container-type:inline-size] pt-[36px] px-[clamp(24px,5vw,72px)] pb-[32px] gap-[24px] justify-start min-[861px]:justify-center min-[861px]:gap-[48px] max-[860px]:min-h-[calc(100svh-72px)] max-[860px]:justify-between">
          <div className="reveal opacity-0 -translate-y-[18px] [animation:drop_.55s_cubic-bezier(.5,0,.75,0)_forwards]" style={{ animationDelay: '.05s' }}>
            <span className="eyebrow inline-flex items-center gap-[8px] font-bold text-[13px] tracking-[1.5px] uppercase text-[#6b6b6b] mb-[18px]">World Cup 2026 · 16 venues</span>
            <h1 className="font-display font-normal uppercase text-[#222] [font-family:'Monument_Extended','Anton',sans-serif] text-[clamp(58px,22cqw,176px)] max-w-full mt-[16px] mb-[24px] min-[861px]:mb-0 leading-[.92] tracking-[1px] [overflow-wrap:break-word]"><span className="ln block">Build your</span> <span className="hl inline-block max-w-full text-[#222] bg-brand-yellow px-[10px] shadow-[6px_6px_0_0_#222] -rotate-[1.5deg] mt-[.22em]">matchday</span></h1>
          </div>
          <div className="reveal opacity-0 -translate-y-[18px] [animation:drop_.55s_cubic-bezier(.5,0,.75,0)_forwards]" style={{ animationDelay: '.12s' }}>
            <div className="a-quick flex flex-col gap-[12px] min-[861px]:gap-[18px] min-[861px]:max-w-[560px]">
              <Link to="/guide" className="a-quick-item group flex items-center no-underline text-[#222] gap-[13px] min-[861px]:gap-[18px]"><span className="a-quick-ic flex items-center justify-center bg-[#111] border-2 border-[#111] flex-[0_0_auto] w-[48px] h-[48px] text-[23px] rounded-[10px] min-[861px]:w-[68px] min-[861px]:h-[68px] min-[861px]:text-[32px] min-[861px]:rounded-[12px] min-[861px]:group-hover:shadow-[4px_4px_0_0_var(--sb-yellow)]"><MapIcon className="a-quick-gl text-white w-[54%] h-[54%]" /></span><span className="a-quick-lb font-display tracking-[0.5px] leading-[1.05] text-[19px] min-[861px]:text-[30px] min-[861px]:group-hover:text-brand-yellow-dim">Getting there</span></Link>
              <Link to="/guide" className="a-quick-item group flex items-center no-underline text-[#222] gap-[13px] min-[861px]:gap-[18px]"><span className="a-quick-ic flex items-center justify-center bg-[#111] border-2 border-[#111] flex-[0_0_auto] w-[48px] h-[48px] text-[23px] rounded-[10px] min-[861px]:w-[68px] min-[861px]:h-[68px] min-[861px]:text-[32px] min-[861px]:rounded-[12px] min-[861px]:group-hover:shadow-[4px_4px_0_0_var(--sb-yellow)]"><BeerIcon className="a-quick-gl text-white w-[54%] h-[54%]" /></span><span className="a-quick-lb font-display tracking-[0.5px] leading-[1.05] text-[19px] min-[861px]:text-[30px] min-[861px]:group-hover:text-brand-yellow-dim">Before the match</span></Link>
              <Link to="/guide" className="a-quick-item group flex items-center no-underline text-[#222] gap-[13px] min-[861px]:gap-[18px]"><span className="a-quick-ic flex items-center justify-center bg-[#111] border-2 border-[#111] flex-[0_0_auto] w-[48px] h-[48px] text-[23px] rounded-[10px] min-[861px]:w-[68px] min-[861px]:h-[68px] min-[861px]:text-[32px] min-[861px]:rounded-[12px] min-[861px]:group-hover:shadow-[4px_4px_0_0_var(--sb-yellow)]"><HamburgerIcon className="a-quick-gl text-white w-[54%] h-[54%]" /></span><span className="a-quick-lb font-display tracking-[0.5px] leading-[1.05] text-[19px] min-[861px]:text-[30px] min-[861px]:group-hover:text-brand-yellow-dim">Where to eat</span></Link>
              <Link to="/guide" className="a-quick-item group flex items-center no-underline text-[#222] gap-[13px] min-[861px]:gap-[18px]"><span className="a-quick-ic flex items-center justify-center bg-[#111] border-2 border-[#111] flex-[0_0_auto] w-[48px] h-[48px] text-[23px] rounded-[10px] min-[861px]:w-[68px] min-[861px]:h-[68px] min-[861px]:text-[32px] min-[861px]:rounded-[12px] min-[861px]:group-hover:shadow-[4px_4px_0_0_var(--sb-yellow)]"><FlagIcon className="a-quick-gl text-white w-[54%] h-[54%]" /></span><span className="a-quick-lb font-display tracking-[0.5px] leading-[1.05] text-[19px] min-[861px]:text-[30px] min-[861px]:group-hover:text-brand-yellow-dim">After the whistle</span></Link>
            </div>
          </div>
          <div className="reveal opacity-0 -translate-y-[18px] [animation:drop_.55s_cubic-bezier(.5,0,.75,0)_forwards]" style={{ animationDelay: '.2s' }}>
            <div className="a-cta flex flex-col items-start gap-[18px]">
              <Link to="/guide" className="btn btn-brand btn-xl relative inline-flex items-center gap-[10px] font-body font-bold uppercase border-0 rounded-none cursor-pointer no-underline [clip-path:var(--notch)] shadow-[inset_var(--color-1-400)_0_6px_0_-5px] [transition:transform_80ms_ease-out,filter_120ms] bg-brand-yellow text-[#222] [filter:drop-shadow(6px_6px_0_var(--gradient-shadow))] hover:[filter:drop-shadow(6px_6px_0_var(--gradient-shadow))_brightness(1.05)] active:translate-x-[3px] active:translate-y-[3px] active:[filter:drop-shadow(3px_3px_0_var(--gradient-shadow))] focus-visible:outline-4 focus-visible:outline-brand-yellow-dim focus-visible:outline-offset-2 text-[29px] py-[22px] px-[46px] tracking-[1.2px] max-[860px]:text-[19px] max-[860px]:py-[14px] max-[860px]:px-[28px] max-[860px]:tracking-[.6px]">Build your match guide</Link>
              <Link to="/casey" className="btn btn-dark btn-xl relative inline-flex items-center gap-[10px] font-body font-bold uppercase border-0 rounded-none cursor-pointer no-underline [clip-path:var(--notch)] shadow-[inset_var(--color-1-400)_0_6px_0_-5px] [transition:transform_80ms_ease-out,filter_120ms] bg-[#222] text-white [filter:drop-shadow(6px_6px_0_var(--sb-yellow))] hover:[filter:drop-shadow(6px_6px_0_var(--sb-yellow))_brightness(1.1)] active:translate-x-[3px] active:translate-y-[3px] active:[filter:drop-shadow(3px_3px_0_var(--sb-yellow))] focus-visible:outline-4 focus-visible:outline-brand-yellow-dim focus-visible:outline-offset-2 text-[29px] py-[22px] px-[46px] tracking-[1.2px] max-[860px]:text-[19px] max-[860px]:py-[14px] max-[860px]:px-[28px] max-[860px]:tracking-[.6px]">See what Casey did</Link>
            </div>
          </div>
        </div>
        <div className="a-right relative bg-black overflow-hidden min-h-[420px] max-[860px]:min-h-[440px] max-[640px]:min-h-[360px] before:content-[''] before:absolute before:left-0 before:inset-y-0 before:w-[8px] before:bg-brand-yellow before:z-[3]">
          <div className="a-scroll absolute inset-0 z-[1] max-[860px]:flex max-[860px]:overflow-x-auto max-[860px]:overflow-y-hidden max-[860px]:[scroll-snap-type:x_mandatory] max-[860px]:[scroll-snap-stop:always] max-[860px]:[-webkit-overflow-scrolling:touch] max-[860px]:overscroll-x-contain max-[860px]:[&::-webkit-scrollbar]:hidden" ref={scrollRef}>
            {slides.map((s, i) => (
              <div className={'a-slide absolute inset-0 [transition:opacity_.6s_ease] max-[860px]:relative max-[860px]:inset-auto max-[860px]:flex-[0_0_100%] max-[860px]:w-full max-[860px]:h-full max-[860px]:opacity-100 max-[860px]:[transition:none] max-[860px]:[scroll-snap-align:start] ' + (i === active ? 'active opacity-100' : 'opacity-0')} key={i}>
                <div className="img absolute inset-0 [background-position:center] [background-size:cover] after:content-[''] after:absolute after:inset-0 after:[background:linear-gradient(115deg,rgba(17,17,17,.55),rgba(17,17,17,.05)_45%,rgba(17,17,17,.45))]" style={{ backgroundImage: `url('${s.img}')` }}></div>
                <div className="a-post fanpost absolute z-[4] bg-white border-4 border-[#111] rounded-[6px] shadow-[8px_8px_0_0_#111] py-[14px] px-[16px] top-[30px] right-[30px] max-w-[280px] max-[640px]:top-[12px] max-[640px]:right-[12px] max-[640px]:max-w-[47%] max-[640px]:py-[9px] max-[640px]:px-[11px] max-[640px]:border-[3px] max-[640px]:shadow-[5px_5px_0_0_#111]">
                  <div className="hd flex items-center gap-[10px] mb-[9px] max-[640px]:gap-[7px] max-[640px]:mb-[5px]"><div className="avatar flex items-center justify-center flex-[0_0_auto] rounded-full bg-brand-yellow text-[#111] font-display border-2 border-[#111] w-[42px] h-[42px] text-[21px] max-[640px]:w-[30px] max-[640px]:h-[30px] max-[640px]:text-[15px] max-[640px]:border-2">{s.av}</div><div><div className="nm font-bold text-[14px] text-[#111] leading-[1.1] max-[640px]:text-[12px]">{s.nm}</div><div className="mt text-[11px] text-[#6b6b6b] font-semibold max-[640px]:text-[10px]">{s.mt}</div></div></div>
                  <div className="stars text-brand-yellow-dim text-[14px] tracking-[2px] leading-none max-[640px]:text-[12px]">{[0, 1, 2, 3, 4].map((k) => <span key={k} className={k < s.stars ? undefined : 'e text-[#cfcfcf]'}>★</span>)}</div>
                  <div className="q text-[14px] text-[#222] leading-[1.45] max-[640px]:hidden" style={{ marginTop: '6px' }}>{s.q}</div>
                  <span className="wasthere inline-flex items-center gap-[6px] text-[10px] font-bold uppercase tracking-[0.5px] text-[#111] bg-brand-yellow py-[3px] px-[8px] rounded-[3px] mt-[10px] max-[640px]:hidden">✓ Was there</span>
                </div>
                <div className="a-venue on-dark absolute z-[4] bg-[#222] text-white border-[6px] border-brand-yellow rounded-[6px] py-[18px] px-[20px] shadow-[12px_12px_0_0_rgba(0,0,0,.45)] left-[34px] bottom-[38px] w-[330px] max-w-[calc(100%-68px)] max-[640px]:left-[12px] max-[640px]:bottom-[12px] max-[640px]:w-auto max-[640px]:max-w-[50%] max-[640px]:py-[10px] max-[640px]:px-[12px] max-[640px]:border-4 max-[640px]:shadow-[6px_6px_0_0_rgba(0,0,0,.45)]">
                  <div className="cc text-[12px] font-bold uppercase tracking-[0.5px] text-brand-yellow mb-[2px] max-[640px]:text-[10px]">{s.cc}</div>
                  <div className="cv font-display text-[30px] text-white tracking-[1px] mb-[12px] max-[640px]:text-[17px] max-[640px]:leading-none max-[640px]:mb-[8px]">{s.cv}</div>
                  <div className="scorechip flex gap-[10px] mb-[14px] max-[640px]:gap-[7px] max-[640px]:mb-0">
                    <div className="s crit border-[3px] border-[#222] rounded-[4px] py-[8px] px-[14px] text-center bg-[#1b1b1b] min-w-[78px] max-[640px]:min-w-0 max-[640px]:py-[5px] max-[640px]:px-[9px]"><div className="v font-display text-[32px] leading-none text-white max-[640px]:text-[22px]">{s.crit}</div><div className="k text-[10px] font-bold uppercase tracking-[0.5px] text-[#6b6b6b] mt-[2px] max-[640px]:text-[8px]">Critics</div></div>
                    <div className="s fan border-[3px] border-brand-yellow-dim rounded-[4px] py-[8px] px-[14px] text-center bg-[#1b1b1b] min-w-[78px] max-[640px]:min-w-0 max-[640px]:py-[5px] max-[640px]:px-[9px]"><div className="v font-display text-[32px] leading-none text-brand-yellow max-[640px]:text-[22px]">{s.fan}</div><div className="k text-[10px] font-bold uppercase tracking-[0.5px] text-[#6b6b6b] mt-[2px] max-[640px]:text-[8px]">Fans</div></div>
                  </div>
                  {s.det.map(([label, , w], k) => (
                    <div key={k} className="detrow flex items-center gap-[10px] my-[8px] max-[640px]:hidden"><span className="dl text-[11px] font-bold uppercase tracking-[0.4px] w-[92px] text-[#b8b8b8]">{label}</span><span className="db flex flex-1 h-[10px] bg-[#2b2b2b] border-2 border-black"><i style={{ width: w + '%' }} className="block bg-brand-yellow"></i></span><span className="dv font-display text-[17px] w-[24px] text-right text-white">{s.det[k][1]}</span></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="a-dots absolute z-[4] flex bottom-[23px] right-[27px] gap-[2px]">
            {slides.map((_, k) => (
              <button key={k} type="button" aria-label={`Show stadium ${k + 1}`} className={`relative w-[24px] h-[24px] p-0 border-0 bg-transparent cursor-pointer appearance-none before:content-[''] before:absolute before:top-1/2 before:left-1/2 before:w-[10px] before:h-[10px] before:rounded-full before:[box-shadow:0_0_0_1px_rgba(0,0,0,.3)] before:[transition:background_.3s,transform_.3s] max-[860px]:before:w-[12px] max-[860px]:before:h-[12px] ${k === active ? 'on before:bg-brand-yellow before:[transform:translate(-50%,-50%)_scale(1.3)]' : 'before:bg-[rgba(255,255,255,.55)] before:[transform:translate(-50%,-50%)]'}`} onClick={() => goTo(k)}></button>
            ))}
          </div>
        </div>
      </section>

      {/* BROWSE VENUES (scrollable marquee on the black band) */}
      <section id="experiences" className="browse-band grid-overlay relative overflow-hidden bg-[#222] pt-[34px] pb-[30px]">
        <div className="container relative z-[1] max-w-full m-0 px-[28px]">
          <h2 className="sr-only absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0 [clip:rect(0,0,0,0)]">Browse World Cup 2026 venues</h2>
          <div className="rail-hint flex items-center gap-[8px] font-bold uppercase text-[12px] tracking-[0.5px] text-[#6b6b6b] mb-0"><span className="rail-count bg-white text-[#111] py-[1px] px-[8px] rounded-[3px] text-[12px]">Browse venues</span></div>
        </div>
        <div className="marquee group relative z-[1] overflow-x-hidden overflow-y-visible pt-[14px] pb-[32px] pr-[12px] max-[760px]:overflow-x-auto max-[760px]:[scroll-snap-type:x_proximity] max-[760px]:overscroll-x-contain max-[760px]:[&::-webkit-scrollbar]:hidden motion-reduce:overflow-x-auto">
          <div className="marquee-track flex gap-[24px] w-max pb-[12px] [animation:venue-scroll_70s_linear_infinite] group-hover:[animation-play-state:paused] [will-change:transform] max-[760px]:[animation:none] max-[760px]:px-[24px] motion-reduce:[animation:none] max-[760px]:[&>[aria-hidden=true]]:hidden">
            {MARQUEE.map((v, i) => <MarqueeCard key={'a' + i} v={v} />)}
            {MARQUEE.map((v, i) => <MarqueeCard key={'b' + i} v={v} hidden />)}
          </div>
        </div>
      </section>

      {/* GET YOUR MATCHDAY AGENDA */}
      <section id="agendas" className="sec-light grid-overlay [--grid-line:rgba(17,17,17,.06)] relative overflow-hidden py-[96px] bg-[#F4F4F4]">
        <div className="container relative z-[1] max-w-[1200px] mx-auto px-[24px]">
          <div className="sec-head mb-[48px] max-w-[760px]">
            <span className="eyebrow inline-flex items-center gap-[8px] font-bold text-[13px] tracking-[1.5px] uppercase text-[#6b6b6b]">Plan it · Share it</span>
            <h2 className="font-display font-normal uppercase text-[#222] leading-[1.02] text-[clamp(36px,5.5vw,64px)] tracking-[1.5px]">Get your matchday agenda</h2>
            <p className="leading-[1.65] max-w-[65ch] text-inherit opacity-85 mt-[16px]">Your whole day on one card — how you're getting there, where you're drinking, what you're eating, where it ends. Pick a match and deal yourself in.</p>
          </div>
          <div className="agenda-fan flex justify-center items-start pt-[26px] pb-[52px] max-[760px]:justify-start max-[760px]:overflow-x-auto max-[760px]:[scroll-snap-type:x_mandatory] max-[760px]:gap-[16px] max-[760px]:pt-[16px] max-[760px]:px-[24px] max-[760px]:pb-[36px] max-[760px]:-mx-[24px] max-[760px]:my-0">
            {AGENDAS.map((a, i) => <AgendaCard key={a.game} a={a} i={i} />)}
          </div>
          <div className="agenda-cta flex justify-center">
            <Link to="/guide" className="btn btn-brand btn-lg relative inline-flex items-center gap-[10px] font-body font-bold uppercase border-0 rounded-none cursor-pointer no-underline [clip-path:var(--notch)] shadow-[inset_var(--color-1-400)_0_6px_0_-5px] [transition:transform_80ms_ease-out,filter_120ms] bg-brand-yellow text-[#222] [filter:drop-shadow(6px_6px_0_var(--gradient-shadow))] hover:[filter:drop-shadow(6px_6px_0_var(--gradient-shadow))_brightness(1.05)] active:translate-x-[3px] active:translate-y-[3px] active:[filter:drop-shadow(3px_3px_0_var(--gradient-shadow))] focus-visible:outline-4 focus-visible:outline-brand-yellow-dim focus-visible:outline-offset-2 text-[22px] py-[17px] px-[34px] tracking-[1px] min-[761px]:text-[26px] min-[761px]:py-[18px] min-[761px]:px-[40px]">Build your agenda</Link>
          </div>
        </div>
      </section>
      </main>

      <footer className="bg-black text-[#9a9a9a] pt-[56px] pb-[40px]">
        <div className="container relative z-[1] max-w-[1200px] mx-auto px-[24px]">
          <div className="logo font-display text-white text-[28px] tracking-[2px] flex items-center gap-[12px] no-underline cursor-pointer mb-[18px]"><img className="logo-img h-[42px] w-[42px] block rounded-[8px] shadow-[3px_3px_0_0_#000]" src="/img/logo.png" alt="Snapback Sports" width={42} height={42} />SNAPBACK<span className="wc font-body font-bold text-[10px] tracking-[1px] text-[#111] bg-brand-yellow py-[2px] px-[7px] rounded-[3px] ml-[2px] self-center whitespace-nowrap">WC 2026</span></div>
          <div className="fnav flex gap-[28px] flex-wrap mb-[24px]">
            <a href="#experiences" className="no-underline font-bold uppercase text-[13px] tracking-[0.5px] text-[#bdbdbd] hover:text-brand-yellow">Experiences</a>
            <Link to="/guide" className="no-underline font-bold uppercase text-[13px] tracking-[0.5px] text-[#bdbdbd] hover:text-brand-yellow">Guide</Link>
          </div>
        </div>
      </footer>
    </>
  )
}
