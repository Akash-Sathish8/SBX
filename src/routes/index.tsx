import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PageCssGuard } from '../components/PageCssGuard'
import { SiteNav } from '../components/SiteNav'
import { SearchBox } from '../components/SearchBox'
import { getJSON, getJSONFresh, intentWarm, warmImage } from '../lib/dataCache'
import { SPORTS, LEAGUES, COLLEGE_LEAGUES, type League } from '../lib/sports'
import { cardImg } from '../lib/img'
import type { Game, Venue } from '../lib/espn'
import { expImage, type Experience } from '../lib/experiences'
import { COLLECTIONS } from '../lib/collections'

// The explore home, TICKET STUB edition — discovery starts at pixel one. A
// poster hero (FIELD GUIDE question + search) sits vertically centered with
// the five explore doors as mini tickets, then the page is inventory:
// tonight's games as perforated ticket stubs, ranked experiences as ADMIT ONE
// cards, venues as photo tickets. Every card is a real D1 / experiences.json
// row; numbers are computed or omitted while loading.
// Fully Tailwind: home.css is gone — only the shared searchbox.css remains
// (SearchBox converts later; PageCssGuard still needs the id).
export const Route = createFileRoute('/')({
  head: () => ({
    links: [
    ],
    meta: [{ title: 'Snapback · Where does gameday take you?' }],
  }),
  component: Home,
})

// Real local assets (checked into public/img) — no hotlinked or invented photos.
// Neyland checkerboard, rendered as a whisper: heavily faded + blurred by the
// hero bg treatment so the type and tickets stay the primary read.
const HERO_IMG = '/img/neyland-checkerboard.jpg'

const LEAGUE_LINE = [...LEAGUES, ...COLLEGE_LEAGUES].map((l) => SPORTS[l].label)

// Iconic parks lead the venue rail when present; the rest fills from any pro
// venue that has a photo. (Editorial ordering over real rows, not invented data.)

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
// The ticket stub carries the when: big line (time / LIVE / FINAL) over a small
// qualifier (meridiem + weekday for non-today games, inning detail while live).
function stubWhen(g: Game): { big: string; small: string } {
  if (g.state === 'in') return { big: 'LIVE', small: g.detail || '' }
  if (g.state === 'post') return { big: 'FINAL', small: '' }
  const d = new Date(g.date)
  if (isNaN(d.getTime())) return { big: '', small: '' }
  const [big, mer = ''] = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).split(' ')
  const day = d.toDateString() === new Date().toDateString() ? '' : ` ${WD[d.getDay()]}`
  return { big, small: (mer + day).trim() }
}

/* ---- home.css, translated to utilities ---- */
// .container — shared page gutter
const container = 'mx-auto px-[clamp(28px,4vw,72px)]'
// .hsec / .sec / .sec-left / .sec-eye / .sec h2 — eyebrow + title flush-left
const hsec = 'pb-1 pt-9 min-[900px]:pb-1.5 min-[900px]:pt-11'
const sec = 'mb-[18px] flex flex-wrap items-end gap-x-3.5 gap-y-3'
const secEye = 'text-[11px] font-extrabold uppercase tracking-[2.5px] text-muted'
const secH2 = 'mt-1.5 font-display text-[26px] uppercase leading-none tracking-[.5px] text-ink min-[900px]:text-[36px]'
// .tchip — ticket-chip CTA: punch Button variant with exact legacy geometry
// (6px radius, 2px→4px ink punch, dashed inner border, lift on hover)
const tchip =
  "relative ml-auto h-auto rounded-md border-2 px-3.5 py-2 text-[11px] tracking-[1.5px] shadow-[2px_2px_0_0_#141410] transition-[box-shadow,transform] duration-[.15s,.12s] ease-[ease] after:pointer-events-none after:absolute after:inset-[3px] after:rounded-[3px] after:border after:border-dashed after:border-ink after:content-[''] hover:translate-x-0 hover:translate-y-0 hover:transform-[translate(-1px,-1px)] hover:shadow-[4px_4px_0_0_#141410]"
// .hrail — full-bleed rail whose first card aligns with the container edge
const hrail =
  'flex snap-x snap-proximity gap-4 overflow-x-auto px-[clamp(28px,4vw,72px)] pb-[30px] pt-1.5 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-[900px]:snap-none'
const hload = 'pb-3.5 pt-1.5 text-[14px] font-semibold text-muted'

// .ticket — perforated game ticket. The punched notches straddle the stub's
// perforation (overflow-hidden crops them to half-moons); notch fill matches
// the page background so they read as die-cut holes.
const ticket =
  "relative flex min-h-[132px] flex-[0_0_288px] snap-start overflow-hidden rounded-xl border-[3px] border-ink bg-cream shadow-[5px_5px_0_0_#141410] [transition:box-shadow_.15s,transform_.12s] hover:shadow-[8px_8px_0_0_#f7df02] hover:transform-[translate(-1px,-1px)] before:absolute before:-top-[11px] before:left-[60px] before:z-[2] before:h-[18px] before:w-[18px] before:rounded-full before:border-[3px] before:border-ink before:bg-[#f4f4f4] before:content-[''] after:absolute after:-bottom-[11px] after:left-[60px] after:z-[2] after:h-[18px] after:w-[18px] after:rounded-full after:border-[3px] after:border-ink after:bg-[#f4f4f4] after:content-[''] min-[900px]:min-h-[140px] min-[900px]:basis-[316px]"
// .stub — league + time column behind the dashed perforation, hatched paper
const stubCls =
  'flex flex-[0_0_72px] flex-col items-start border-r-2 border-dashed border-ink bg-[repeating-linear-gradient(45deg,rgba(20,20,16,.04)_0_6px,transparent_6px_12px)] py-3 pl-3 pr-2'
const abbrCls = 'font-display text-[20px] font-normal tracking-[1px] text-ink'
const logoCls = 'h-[26px]! w-[26px] flex-none object-contain'

function GameCard({ g }: { g: Game }) {
  const live = g.state === 'in'
  const done = g.state === 'post'
  const score = (live || done) && g.home.score !== null && g.away.score !== null
  const { big, small } = stubWhen(g)
  const warm = () => { if (g.home.logo) warmImage(g.home.logo); if (g.away.logo) warmImage(g.away.logo) }
  return (
    <Link to="/game" search={{ id: g.id, league: g.league }} className={ticket} {...intentWarm(warm)}>
      <span className={stubCls}>
        <b className={cn('rotate-180 text-[11px] font-extrabold uppercase tracking-[3px] [writing-mode:vertical-rl]', live ? 'text-live' : 'text-muted')}>{SPORTS[g.league].label}</b>
        <span className="mt-auto flex flex-col items-start">
          <b className={cn('text-[15px] font-extrabold leading-[1.1] tabular-nums', live ? 'text-live' : 'text-ink')}>{big}</b>
          {small ? <span className="text-[9px] font-extrabold uppercase tracking-[1.5px] text-muted">{small}</span> : null}
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col items-start px-3.5 py-3">
        <span className="flex items-center gap-2">
          {g.away.logo ? <img src={g.away.logo} alt="" width={26} height={26} loading="lazy" className={logoCls} /> : null}
          <span className={abbrCls}>{g.away.abbr}</span>
          {score
            ? <i className="text-[16px] font-extrabold not-italic tabular-nums text-ink">{g.away.score}–{g.home.score}</i>
            : <i className="text-[13px] font-bold not-italic text-muted">@</i>}
          <span className={abbrCls}>{g.home.abbr}</span>
          {g.home.logo ? <img src={g.home.logo} alt="" width={26} height={26} loading="lazy" className={logoCls} /> : null}
        </span>
        <span className="mt-auto w-full truncate pt-2.5 text-[12px] font-semibold text-muted">{g.venue.name}{g.venue.city ? ', ' + g.venue.city : ''}</span>
      </span>
    </Link>
  )
}

// .door — explore doors as mini tickets: vertical stub, punched ink notches
const door =
  "relative flex min-h-[78px] overflow-hidden rounded-[9px] border-2 border-ink bg-cream text-ink shadow-punch [transition:box-shadow_.15s,transform_.12s] hover:shadow-punch-brand hover:transform-[translate(-1px,-1px)] before:absolute before:-top-[9px] before:left-6 before:h-3.5 before:w-3.5 before:rounded-full before:border-2 before:border-ink before:bg-ink before:content-[''] after:absolute after:-bottom-[9px] after:left-6 after:h-3.5 after:w-3.5 after:rounded-full after:border-2 after:border-ink after:bg-ink after:content-[''] min-[900px]:min-h-[104px] min-[900px]:before:left-[33px] min-[900px]:after:left-[33px]"
const doorStub = 'flex flex-[0_0_33px] flex-col items-start border-r-2 border-dashed border-ink py-2 pl-[9px] min-[900px]:basis-10 min-[900px]:pl-[11px]'
const doorStubB = 'mt-auto rotate-180 text-[9px] font-extrabold uppercase tracking-[2px] text-muted [writing-mode:vertical-rl] min-[900px]:text-[10px]'
const doorMain = 'flex min-w-0 flex-1 flex-col items-start px-3 py-[10px] min-[900px]:px-4 min-[900px]:py-3.5'
const doorLabel = 'text-[13px] font-extrabold uppercase tracking-[.5px] text-ink min-[900px]:text-[17px]'
const doorCount = 'mt-auto pt-1.5 text-[11px] font-bold uppercase tracking-[1px] text-muted tabular-nums min-[900px]:text-[12px]'

// .rank-card — ADMIT ONE experience tickets (desktop: 4-up grid via rankGrid)
const rankCard =
  'flex min-h-[288px] flex-[0_0_252px] snap-start flex-col overflow-hidden rounded-xl border-[3px] border-ink bg-cream shadow-[5px_5px_0_0_#141410] [transition:box-shadow_.15s,transform_.12s] hover:shadow-[8px_8px_0_0_#f7df02] hover:transform-[translate(-1px,-1px)] min-[900px]:min-h-[300px] min-[900px]:flex-none'
const admit = 'flex w-full items-baseline gap-2.5 border-b-[3px] border-ink bg-brand px-3 py-[7px]'
const admitB = 'text-[11px] font-extrabold uppercase tracking-[3px] text-ink'
const admitNum = 'ml-auto font-display text-[15px] tracking-[1px] text-ink tabular-nums'
const rankBody = 'flex w-full flex-1 flex-col items-start px-3.5 pb-[13px] pt-3'
const rankName = 'font-display text-[19px] font-normal uppercase leading-[1.12] tracking-[.4px] text-ink'
const rankScore = 'mt-auto pt-2.5 text-[11px] font-extrabold uppercase tracking-[2px] text-ink tabular-nums'
// ranked rail becomes a 4-up grid aligned with the container on desktop
const rankGrid = cn(hrail, 'min-[900px]:grid min-[900px]:grid-cols-4 min-[900px]:gap-x-[18px] min-[900px]:gap-y-[22px] min-[900px]:overflow-visible')

const footLink = 'font-extrabold uppercase tracking-[1px] text-brand'

function Home() {
  const [exps, setExps] = useState<Experience[] | null>(null)
  const [venues, setVenues] = useState<Venue[] | null>(null)
  const [games, setGames] = useState<Game[] | null>(null)

  useEffect(() => {
    let alive = true
    const applyGames = (r: any) => { if (alive) setGames(Array.isArray(r?.data) ? r.data : []) }
    getJSON('/api/games').then(applyGames).catch(() => { if (alive) setGames([]) })
    getJSON('/api/venues')
      .then((r: any) => { if (alive) setVenues(Array.isArray(r?.data) ? r.data : []) })
      .catch(() => { if (alive) setVenues([]) })
    getJSON('/data/experiences.json')
      .then((r: any) => { if (alive) setExps(Array.isArray(r?.experiences) ? r.experiences : []) })
      .catch(() => { if (alive) setExps([]) })
    // Live games drift; refresh while the tab is visible (server overlays live
    // scores on /api/games, s-maxage=20). Venues/experiences are static.
    const iv = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      getJSONFresh('/api/games').then(applyGames).catch(() => { /* keep prior data */ })
    }, 25000)
    return () => { alive = false; clearInterval(iv) }
  }, [])

  // Tonight's slate: live first, then next up — the rail you can graze now.
  const slate = useMemo(() => {
    if (!games) return null
    const order = (x: Game) => (x.state === 'in' ? 0 : x.state === 'pre' ? 1 : 2)
    return [...games].sort((a, b) => order(a) - order(b) || a.date.localeCompare(b.date)).slice(0, 12)
  }, [games])

  // 7 + the collection card = a clean 4×2 ADMIT ONE grid on desktop.
  const topExps = useMemo(
    () => (exps ? exps.slice(0, 7).map((e) => ({ ...e, image: e.image ?? expImage(e.name, venues ?? []) })) : null),
    [exps, venues],
  )

  const col = COLLECTIONS[0]

  return (
    // body: Barlow on the warm gray canvas (html/body keep overflow-x:clip globally)
    <div className="min-h-screen bg-[#f4f4f4] font-sans text-[#33352f]">
      <PageCssGuard id="home" />
      <SiteNav active="home" />

      {/* Poster hero: copy docked bottom-left (never floating centered), doors as mini tickets.
          z-5 lifts the hero's stacking context above the rails below it, so the search
          dropdown paints over the ticket cards (nav stays on top at z-50). */}
      <section className="relative isolate z-[5] flex min-h-[calc(100vh-72px)] flex-col border-b-[3px] border-ink text-white supports-[min-height:100svh]:min-h-[calc(100svh-72px)]">
        {/* the photo is a tertiary thought: low opacity, desaturated, softly blurred
            (the 1.04 scale hides the blur's edge vignette), under a heavy shade */}
        <div
          className="absolute inset-0 -z-[2] scale-[1.04] bg-[#0d0d0b] bg-cover bg-[position:center_40%] opacity-50 filter-[saturate(.5)_brightness(.42)_blur(2px)]"
          style={{ backgroundImage: `url('${HERO_IMG}')` }}
        />
        <div className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,rgba(10,10,8,.66)_0%,rgba(10,10,8,.5)_40%,rgba(10,10,8,.62)_70%,rgba(10,10,8,.88)_100%)]" />
        <div className={cn(container, 'flex w-full flex-1 flex-col items-start pb-[26px] pt-[38px]')}>
          {/* mt-auto docks the copy to the hero's bottom edge — text never floats
              vertically centered on mobile; ≥900px it centers as one stack */}
          <div className="mt-auto w-full min-[900px]:my-auto min-[900px]:flex min-[900px]:flex-col min-[900px]:items-center min-[900px]:text-center">
            <div className="min-[900px]:flex min-[900px]:w-full min-[900px]:min-w-0 min-[900px]:flex-col min-[900px]:items-center">
              {/* inline-block shrinks the highlight to its own line-height instead of Anton's
                  tall font metrics — the yellow box must never overlap the lines around it */}
              <h1 className="mt-3 max-w-[13ch] font-display text-[clamp(42px,9.6vw,84px)] uppercase leading-[1.14] tracking-[.5px] text-white [text-shadow:0_2px_18px_rgba(0,0,0,.5)] min-[900px]:mx-auto min-[900px]:max-w-[18ch] min-[900px]:text-[clamp(60px,6vw,112px)]">
                Where does <span className="inline-block bg-brand px-[.14em] leading-[1.04] text-ink shadow-[4px_4px_0_#141410] [text-shadow:none]">gameday</span> take&nbsp;you?
              </h1>
              {/* z-4: the search dropdown must paint OVER the door row below. The wrapper
                  carries the old .fg-hero .sbx-search constraints; the important max-width
                  outranks searchbox.css's unlayered 640px cap at desktop. */}
              <div className="relative z-[4] mt-[22px] max-w-[560px] min-[900px]:mx-auto min-[900px]:mt-[28px] min-[900px]:w-full min-[900px]:max-w-[680px] min-[900px]:[&>.sbx-search]:max-w-[680px]!">
                <SearchBox />
              </div>
            </div>
            <div className="mt-[22px] grid w-full grid-cols-2 gap-3 min-[900px]:mt-9 min-[900px]:grid-cols-6 min-[900px]:gap-3.5">
              {/* the rank door leads the grid: full row on the mobile 2-col grid */}
              <Link to="/rank" className={cn(door, 'col-span-full min-[900px]:col-auto')}><span className={doorStub}><b className={doorStubB}>Rank</b></span><span className={doorMain}><span className={doorLabel}>Been there? Rank it</span><span className={doorCount}>Review your experiences</span></span></Link>
              <Link to="/near" className={door}><span className={doorStub}><b className={doorStubB}>Explore</b></span><span className={doorMain}><span className={doorLabel}>Near you</span><span className={doorCount}>Games close to you</span></span></Link>
              <Link to="/teams" search={{ league: undefined }} className={door}><span className={doorStub}><b className={doorStubB}>Explore</b></span><span className={doorMain}><span className={doorLabel}>By sport &amp; team</span><span className={doorCount}>Browse leagues</span></span></Link>
              <Link to="/weekend" className={door}><span className={doorStub}><b className={doorStubB}>Explore</b></span><span className={doorMain}><span className={doorLabel}>Upcoming Events</span><span className={doorCount}>This weekend</span></span></Link>
              <Link to="/venues" className={door}><span className={doorStub}><b className={doorStubB}>Explore</b></span><span className={doorMain}><span className={doorLabel}>By venue</span><span className={doorCount}>{venues?.length ? `${venues.length} venues` : 'The buildings'}</span></span></Link>
              <Link to="/rankings" className={door}><span className={doorStub}><b className={doorStubB}>Explore</b></span><span className={doorMain}><span className={doorLabel}>Top ranked</span><span className={doorCount}>{exps?.length ? `${exps.length} experiences` : 'The expert list'}</span></span></Link>
            </div>
          </div>
        </div>
      </section>

      {/* Rail 1 — tonight's slate as perforated ticket stubs (live first, real scores) */}
      <section className={hsec}>
        <div className={container}>
          <div className={sec}>
            <div className="flex flex-col items-start"><span className={secEye}>Live &amp; next up</span><h2 className={secH2}>On the slate</h2></div>
            <Button asChild variant="punch" className={tchip}><Link to="/weekend">This weekend →</Link></Button>
          </div>
        </div>
        {slate === null ? <div className={container}><div className={hload}>Loading games…</div></div> : null}
        {slate && slate.length ? (
          <div className={cn(hrail, 'min-[900px]:gap-[18px]')}>{slate.map((g) => <GameCard key={g.league + ':' + g.id} g={g} />)}</div>
        ) : null}
        {slate && !slate.length ? <div className={container}><div className={hload}>Nothing on right now. <Link to="/games" className="border-b-2 border-brand font-extrabold">Browse the schedule →</Link></div></div> : null}
      </section>

      {/* Rail 2 — top-ranked experiences as ADMIT ONE cards (collection card leads) */}
      <section className={hsec}>
        <div className={container}>
          <div className={sec}>
            <div className="flex flex-col items-start"><span className={secEye}>{exps?.length ? `${exps.length} ranked experiences` : 'Expert rankings'}</span><h2 className={secH2}>Top ranked in America</h2></div>
            <Button asChild variant="punch" className={tchip}><Link to="/rankings">Full rankings →</Link></Button>
          </div>
        </div>
        {topExps ? (
          <div className={rankGrid}>
            <Link to="/rankings" search={{ collection: col.slug }} className={rankCard}>
              <span className={admit}><b className={admitB}>Collection</b><span className={admitNum}>→</span></span>
              <span className={rankBody}>
                <span className={cn(rankName, 'text-[22px]')}>{col.title}</span>
                <span className={rankScore}>The collection →</span>
              </span>
            </Link>
            {topExps.map((e) => (
              <Link key={e.rank} to="/rankings" search={{ q: e.name }} className={rankCard}>
                <span className={admit}><b className={admitB}>Admit One</b><span className={admitNum}>№ {e.rank}</span></span>
                {e.image ? <span className="h-[140px] w-full flex-none border-b-2 border-dashed border-ink"><img src={cardImg(e.image)} alt="" loading="lazy" className="h-full! w-full object-cover" /></span> : null}
                <span className={rankBody}>
                  <span className={cn(rankName, !e.image && 'text-[22px]')}>{e.name}</span>
                  <span className="mt-[5px] text-[12px] font-semibold uppercase tracking-[1px] text-muted">{e.location}{e.sport ? ' · ' + e.sport : ''}</span>
                  <span className={rankScore}>{e.final.toFixed(2)} expert score</span>
                </span>
              </Link>
            ))}
          </div>
        ) : <div className={container}><div className={hload}>Loading rankings…</div></div>}
      </section>

      {/* stat bar (all numbers computed from real data; omitted while loading) */}
      <div className="border-t-[3px] border-ink bg-[#ecebe6] py-[17px]">
        <div className={container}>
          <p className="flex flex-wrap gap-x-2 gap-y-0 text-[12px] font-extrabold uppercase tracking-[2px] text-ink tabular-nums">
            {exps?.length ? <span><b>{exps.length}</b> ranked experiences</span> : null}
            {exps?.length && venues?.length ? <i className="not-italic text-[#a3a196]">·</i> : null}
            {venues?.length ? <span><b>{venues.length}</b> venues</span> : null}
            {(exps?.length || venues?.length) ? <i className="not-italic text-[#a3a196]">·</i> : null}
            <span>{LEAGUE_LINE.join(' · ')}</span>
          </p>
        </div>
      </div>

      <footer className="bg-[#111] pb-[34px] pt-[26px] text-[13px] text-[#9a988c]"><div className={container}>© 2026 Snapback Sports. <Link to="/games" className={footLink}>Games</Link> · <Link to="/venues" className={footLink}>Venues</Link> · <Link to="/rankings" className={footLink}>Rankings</Link></div></footer>
    </div>
  )
}
