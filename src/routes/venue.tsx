import { useEffect, useMemo, useRef, useState } from 'react'
import { container } from '../lib/ui'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteNav } from '../components/SiteNav'
import { PageCssGuard } from '../components/PageCssGuard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getJSON, getJSONFresh, warmImage } from '../lib/dataCache'
import { SPORTS } from '../lib/sports'
import type { Venue, Game } from '../lib/espn'
import { WhatToKnow, AddTipButton } from '../components/WhatToKnow'
import { ExpertNotes } from '../components/ExpertNotes'
import { Reviews, type VenueRatings } from '../components/Reviews'
import { useAuth } from '../components/auth/AuthProvider'
import { loadMyRankings } from '../lib/myRankings'
import type { Experience } from '../lib/experiences'
import { matchExperienceForVenue } from '../lib/experienceMatch'
import { GamesThatWeekend, NearbyVenues } from '../components/NextHops'

// The fan ranking for this venue: averaged across every signed-in fan who ranked
// a game here (served by /api/venue-stats). `count` is 0 until anyone has.
interface FanStats { count: number; fans: number; food: number; unique: number; stadium: number; score: number }

export const Route = createFileRoute('/venue')({
  // Coerce to string: TanStack's default parser turns a numeric ?id=3687 into the
  // number 3687, which a `typeof === 'string'` check would drop (breaks direct
  // loads / shared links to venues whose ESPN id is all digits).
  // `?tip=1` is the post-rank handoff from /rank: open the tip composer + scroll
  // (`?review=1` is the older review handoff, kept working for old links).
  // Kept optional so every existing `<Link to="/venue" search={{ id }}>` stays valid.
  validateSearch: (s: Record<string, unknown>) => {
    const out: { id: string; review?: 1; tip?: 1 } = { id: s.id != null ? String(s.id) : '' }
    if (s.review === '1' || s.review === 1) out.review = 1
    if (s.tip === '1' || s.tip === 1) out.tip = 1
    return out
  },
  head: () => ({
    links: [],
    meta: [{ title: 'Snapback · Venue' }],
  }),
  component: VenuePage,
})

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function fmt(iso: string) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${WD[d.getDay()]} ${MON[d.getMonth()]} ${d.getDate()}`
}
const kickoff = (iso: string) => {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

// Section header trio (legacy .eyebrow / .shead / .ssub, editorial refresh).
const eyebrowCls = 'mb-[11px] inline-flex items-center gap-[9px] text-[12.5px] font-extrabold tracking-[1.2px] text-black uppercase'
const sheadCls = 'font-display text-[clamp(28px,3.6vw,40px)] leading-none tracking-[.5px] text-ink-soft uppercase'
const ssubCls = 'mb-[26px] text-[14px] font-semibold tracking-[.5px] text-muted uppercase'
const eleadCls = 'mb-[20px] max-w-[74ch] text-[16px] leading-[1.55] text-[#33352f]'
// Hero score cards (legacy .vscore and its .lab/.val/.sub children).
const vscoreCls = 'min-w-[124px] rounded-[13px] bg-white px-[18px] py-[12px]'
const vscoreLabCls = 'flex items-center gap-[6px] font-sans text-[11px] font-extrabold tracking-[.5px] uppercase'
const vscoreValCls = 'mt-[6px] font-display text-[34px] leading-none tracking-[.5px] text-[#16160f]'
const vscoreSubCls = 'mt-[5px] text-[11px] font-semibold tracking-[.2px] text-[#9a9a92]'

function VenuePage() {
  const { id: rawId, review, tip } = Route.useSearch()
  const id = (rawId || '').replace(/[^a-z0-9_-]/gi, '')
  const [venue, setVenue] = useState<Venue | null | undefined>(undefined) // undefined = loading
  const [games, setGames] = useState<Game[] | null>(null)

  useEffect(() => {
    if (!id) return
    let alive = true
    setVenue(undefined)
    getJSON('/api/venues')
      .then((r: any) => {
        const v = (Array.isArray(r?.data) ? r.data : []).find((x: Venue) => x.id === id) ?? null
        if (alive) { setVenue(v); if (v) { document.title = 'Snapback · ' + v.name; if (v.image) warmImage(v.image); v.teams.forEach((t: any) => t.logo && warmImage(t.logo)) } }
      })
      .catch(() => { if (alive) setVenue(null) })
    getJSON('/api/games')
      .then((r: any) => { if (alive) setGames(Array.isArray(r?.data) ? r.data : []) })
      .catch(() => { if (alive) setGames([]) })
    return () => { alive = false }
  }, [id])

  return (
    <div className="min-h-screen bg-[#f4f4f4] font-sans text-[#33352f]">
      <PageCssGuard id="venue" />
      <SiteNav active="venues" />
      <main id="app">{renderBody()}</main>
      <footer className="bg-black py-[40px] text-[13px] text-[#888]">
        <div className={container}>© 2026 Snapback Sports · Venues. <Link className="font-bold text-brand!" to="/venues">← All venues</Link></div>
      </footer>
    </div>
  )

  function renderBody() {
    const loadwrap = 'py-[80px] text-center font-bold tracking-[1px] text-muted uppercase'
    const ulink = 'text-ink-soft! underline'
    if (!id) return <div className={loadwrap}>No venue selected. <Link to="/venues" className={ulink}>Back to venues →</Link></div>
    if (venue === undefined) return <div className={loadwrap}>Loading venue…</div>
    if (venue === null) return <div className={loadwrap}>Couldn't load this venue. <Link to="/venues" className={ulink}>Back to venues →</Link></div>
    return <VenueContent v={venue} games={games} review={review === 1} tip={tip === 1} />
  }
}

function VenueContent({ v, games, review, tip }: { v: Venue; games: Game[] | null; review: boolean; tip: boolean }) {
  const { user } = useAuth()
  const forumRef = useRef<HTMLElement>(null)
  const [tipOpen, setTipOpen] = useState(false)
  // The fan's own pillar scores for THIS venue (matched by name — a ranked game
  // only stores the venue name), surfaced on the review card while they write.
  const [myRating, setMyRating] = useState<VenueRatings | null>(null)
  useEffect(() => {
    const mine = loadMyRankings().find((m) => m.venue === v.name)
    setMyRating(mine ? { fans: mine.fans, food: mine.food, unique: mine.unique, stadium: mine.stadium, score: mine.score } : null)
  }, [v.name])

  // Snapback ranking (the expert experience-rankings) + the live fan-average.
  const [exps, setExps] = useState<Experience[] | null>(null)
  const [fan, setFan] = useState<FanStats | null>(null)
  useEffect(() => {
    let alive = true
    getJSON('/data/experiences.json').then((r: any) => { if (alive) setExps(Array.isArray(r?.experiences) ? r.experiences : []) }).catch(() => { if (alive) setExps([]) })
    // Fan stats are LIVE (they change the moment a fan submits a score), so bypass
    // the session-forever getJSON memo — otherwise the Fan Score shows a stale value
    // after you rank a game until a full reload.
    getJSONFresh('/api/venue-stats?venue=' + encodeURIComponent(v.name)).then((r: any) => { if (alive) setFan(r?.ok ? r.data : null) }).catch(() => { if (alive) setFan(null) })
    return () => { alive = false }
  }, [v.name])

  // Match this venue to an expert experience (shared logic: pinned override
  // first, then team-name auto-match; event experiences stay unmatched — honest gap).
  const snap = useMemo(() => (exps ? matchExperienceForVenue(v, exps) : null), [exps, v])
  const hasFan = !!fan && fan.count > 0

  // Post-rank handoff (?tip=1 / ?review=1): land on the open form by scrolling
  // the forum in. The tip composer only auto-opens for signed-in fans (posting
  // is auth-gated); signed-out fans land at the forum's sign-in button.
  useEffect(() => {
    if ((review || tip) && forumRef.current) forumRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [review, tip])
  useEffect(() => {
    if (tip && user) setTipOpen(true)
  }, [tip, user])

  const tenantAbbrs = new Set(v.teams.map((t) => t.abbr))
  const here = useMemo(() => {
    if (!games) return null
    return games
      .filter((g) => g.venue.name === v.name || tenantAbbrs.has(g.home.abbr))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [games, v.name])

  const accent = (v.teams[0] as any)?.color
  const hasPhoto = !!v.image
  const leanStyle = accent ? { background: `radial-gradient(120% 140% at 50% -10%, ${accent}, #0a0a0a 70%)` } : undefined

  return (
    <>
      <section className="relative flex min-h-[420px] items-end overflow-hidden bg-ink-soft text-white" style={hasPhoto ? undefined : leanStyle}>
        {hasPhoto ? <div className="absolute inset-0 z-0 bg-cover bg-center after:absolute after:inset-0 after:content-[''] after:bg-[linear-gradient(180deg,rgba(20,20,20,.35)_0%,rgba(20,20,20,.72)_55%,rgba(20,20,20,.95)_100%)]" style={{ backgroundImage: `url('${v.image}')` }} /> : null}
        <Link className="absolute top-0 left-0 z-[5] inline-flex items-center gap-[7px] px-[18px] py-[14px] text-[13px] font-bold tracking-[.6px] text-white uppercase [text-shadow:0_1px_4px_rgba(0,0,0,.7)] hover:text-brand!" to="/venues">← All venues</Link>
        <div className={cn(container, 'relative z-[2] w-full pt-[34px] pb-[30px]')}>
          <div className="mb-[18px] flex flex-wrap items-center gap-[18px]">
            {v.teams.map((t) => (t.logo ? <img key={t.id} className="object-contain drop-shadow-[0_3px_10px_rgba(0,0,0,.55)]" src={t.logo} alt={t.displayName} width={72} height={72} /> : null))}
          </div>
          <div className="mb-[14px] inline-flex flex-wrap items-center gap-[10px]">
            <Badge variant="ghost" className="gap-[7px] rounded-[3px] border-0 bg-[rgba(255,255,255,.12)] px-[11px] py-[5px] text-[12px] font-bold tracking-[.6px] whitespace-normal text-white uppercase">{[v.city, v.state].filter(Boolean).join(', ')}</Badge>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-[32px]">
            <div className="min-w-0">
              <h1 className="max-w-[16ch] font-display text-[clamp(40px,7vw,86px)] leading-[.95] tracking-[1px] text-white uppercase">{v.name}</h1>
              {v.teams.length ? <div className="mt-[10px] text-[15px] font-semibold tracking-[.3px] text-[#bdbdbd]">Home of <b className="text-white">{v.teams.map((t) => t.displayName).join(' · ')}</b></div> : null}
              <Button asChild variant="brand" className="mt-[16px] h-auto rounded-[8px] px-[20px] py-[12px] font-display text-[15px] font-normal tracking-[.5px] text-[#111]! shadow-[0_6px_18px_rgba(0,0,0,.1)] transition-[filter,translate] duration-[120ms,80ms] ease-[ease] hover:brightness-[.96] active:translate-y-[1px]">
                <Link to="/venue-plan" search={{ id: v.id }}>Plan your visit →</Link>
              </Button>
            </div>
            <div className="flex flex-wrap gap-[12px]">
              {snap ? (
                <div className={cn(vscoreCls, 'border-2 border-brand shadow-[0_8px_22px_rgba(247,223,2,.34)]')}>
                  <div className={cn(vscoreLabCls, 'text-[#16160f]')}><img className="h-[18px] w-[18px] flex-none rounded-[4px]" src="/img/logo.png" alt="" width={18} height={18} /> Snapback Score</div>
                  <div className={vscoreValCls}>{snap.final.toFixed(1)}</div>
                  <div className={vscoreSubCls}>Expert-rated · #{snap.rank}</div>
                </div>
              ) : null}
              <div className={cn(vscoreCls, 'border border-[#e6e6e0] shadow-[0_8px_22px_rgba(0,0,0,.32)]')}>
                <div className={cn(vscoreLabCls, 'text-[#8a8a82]')}>Fan Score</div>
                <div className={vscoreValCls}>{hasFan ? fan!.score.toFixed(1) : '–'}</div>
                <div className={vscoreSubCls}>{hasFan ? `${fan!.count} fan ${fan!.count === 1 ? 'rating' : 'ratings'}` : 'Be the first to rank it'}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT DO I NEED TO KNOW — the crowdsourced info-discovery core */}
      <section className="bg-[#f7f6f2] py-[48px]" ref={forumRef}><div className={container}>
        <div className={eyebrowCls}>Snapback · crowdsourced</div>
        <div className="shead-row">
          <h2 className={sheadCls}>What do I need to know?</h2>
          <div className="shead-actions">
            <Link to="/venue-plan" search={{ id: v.id }} className="wtk-addbar guide inline-flex items-center rounded-full bg-brand px-6 py-3 font-sans text-[13px] font-extrabold uppercase tracking-[.5px] whitespace-nowrap text-[#141414]! cursor-pointer hover:bg-black [line-height:normal]">Build your guide →</Link>
            <AddTipButton onOpen={() => setTipOpen(true)} />
          </div>
        </div>
        <div className={ssubCls}>Insider tips &amp; reviews from fans who've actually been to {v.name}</div>
        <ExpertNotes scope="venue" targetId={v.id} />
        <div className="wtk-layout mt-2 grid grid-cols-[minmax(0,1fr)_clamp(300px,28%,380px)] items-stretch gap-[18px] max-[980px]:grid-cols-1">
          <WhatToKnow scope="venue" targetId={v.id} composerOpen={tipOpen} onComposerClose={() => setTipOpen(false)} cancelLabel={tip ? 'Skip' : 'Cancel'} />
          <Reviews
            scope="venue"
            targetId={v.id}
            venueName={v.name}
            venueCity={v.city}
            venueRatings={myRating}
            defaultRating={myRating ? Math.round(myRating.score) : null}
            startOpen={review && !!user}
          />
        </div>
      </div></section>

      <section className="bg-white py-[48px]"><div className={container}>
        <div className={eyebrowCls}>On the schedule</div>
        <h2 className={cn(sheadCls, 'mb-[5px]')}>Games here</h2>
        <div className={ssubCls}>Upcoming &amp; recent at {v.name}</div>
        {here === null ? <div className={eleadCls}>Loading games…</div> : null}
        {here && !here.length ? <div className={eleadCls}>No games on the schedule here right now.</div> : null}
        {here && here.length ? (
          <div className="mt-[6px] flex flex-col gap-[10px]">
            {here.slice(0, 20).map((g) => (
              <Link key={g.id} to="/game" search={{ id: g.id, league: g.league }} className="grid grid-cols-[auto_1fr_auto] items-center gap-[14px] rounded-[8px] border-2 border-ink-soft bg-white px-[16px] py-[13px] [transition:translate_.12s,filter_.12s] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:drop-shadow-[7px_7px_0_#222] max-[560px]:grid-cols-[auto_1fr]">
                <Badge variant="ghost" className="rounded-[4px] border-0 bg-ink-soft px-[8px] py-[4px] text-[11px] font-extrabold tracking-[.6px] whitespace-normal text-white">{SPORTS[g.league].label}</Badge>
                <span className="text-[16px] font-extrabold text-ink-soft">{g.away.location || g.away.displayName} <span className="font-bold text-muted">@</span> {g.home.location || g.home.displayName}</span>
                <span className="text-[12.5px] font-bold tracking-[.4px] whitespace-nowrap text-muted uppercase max-[560px]:col-start-2 max-[560px]:justify-self-start">{g.state === 'post' ? 'Final' : g.state === 'in' ? (g.detail || 'Live') : `${fmt(g.date)} · ${kickoff(g.date)}`}</span>
              </Link>
            ))}
          </div>
        ) : null}
      </div></section>

      {/* Next hops — the journey continues from here (other games nearby that
          weekend + venues worth adding to the same trip). */}
      <GamesThatWeekend city={v.city} excludeVenueName={v.name} />
      <NearbyVenues city={v.city} state={v.state} excludeId={v.id} />
    </>
  )
}
