import { useEffect, useState } from 'react'
import { containerWide as container } from '../lib/ui'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteNav } from '../components/SiteNav'
import { PageCssGuard } from '../components/PageCssGuard'
import { getJSON } from '../lib/dataCache'
import { SPORTS, isLeague, type League } from '../lib/sports'
import type { Game, GameTeam, Venue } from '../lib/espn'
import { WhatToKnow, AddTipButton } from '../components/WhatToKnow'
import { ExpertNotes } from '../components/ExpertNotes'
import { Reviews } from '../components/Reviews'
import { NearbyVenues, RelatedExperience } from '../components/NextHops'
import { FanScorePill, useFanScores } from '../components/FanScore'
import { LogGameButton } from '../components/LogGameButton'
import { Badge } from '@/components/ui/badge'

export const Route = createFileRoute('/game')({
  validateSearch: (s: Record<string, unknown>) => ({
    // Coerce to string: a numeric ?id=401234 is parsed as a number and would be
    // dropped by a `typeof === 'string'` check (breaks direct loads / shared links).
    id: s.id != null ? String(s.id) : '',
    league: isLeague(s.league as string) ? (s.league as League) : undefined,
  }),
  head: () => ({
    links: [],
    meta: [{ title: 'Snapback · Game' }],
  }),
  component: GamePage,
})

// Legacy .container — full-width with the responsive gutter.
// Legacy .ulink — global styles.css `a{color:inherit;text-decoration:none}` is
// unlayered and beats utilities, hence the important suffixes.
const ulink = 'text-ink-soft! underline!'

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function when(g: Game) {
  const d = new Date(g.date)
  if (isNaN(d.getTime())) return ''
  if (g.state === 'post') return 'Final'
  if (g.state === 'in') return g.detail || 'Live'
  const day = `${WD[d.getDay()]} ${MON[d.getMonth()]} ${d.getDate()}`
  const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return `${day} · ${t}`
}

function GamePage() {
  const { id: rawId, league } = Route.useSearch()
  const id = (rawId || '').replace(/[^a-z0-9_-]/gi, '')
  const [state, setState] = useState<{ status: 'loading' | 'error' | 'ok'; g?: Game }>({ status: 'loading' })

  useEffect(() => {
    if (!id) return
    let alive = true
    setState({ status: 'loading' })
    getJSON('/api/games?id=' + encodeURIComponent(id) + (league ? '&league=' + league : ''))
      .then((r: any) => {
        const g = (Array.isArray(r?.data) ? r.data : []).find((x: Game) => x.id === id)
        if (!g) throw new Error('not found')
        if (alive) {
          setState({ status: 'ok', g })
          document.title = 'Snapback · ' + g.away.displayName + ' @ ' + g.home.displayName
        }
      })
      .catch(() => { if (alive) setState({ status: 'error' }) })
    return () => { alive = false }
  }, [id, league])

  return (
    <div className="min-h-screen bg-white font-sans text-[#33352f]">
      <PageCssGuard id="game" />
      <SiteNav active="games" />
      <main id="app">{renderBody()}</main>
      <footer className="bg-black py-10 text-[13px] text-[#888]">
        <div className={container}>© 2026 Snapback Sports · Games. <Link to="/games" className="font-bold text-brand!">← All games</Link></div>
      </footer>
    </div>
  )

  function renderBody() {
    const loadwrap = 'py-20 text-center font-bold uppercase tracking-[1px] text-muted'
    if (!id) return <div className={loadwrap}>No game selected. <Link to="/games" className={ulink}>Back to games →</Link></div>
    if (state.status === 'loading') return <div className={loadwrap}>Loading game…</div>
    if (state.status === 'error') return <div className={loadwrap}>Couldn't find this game. <Link to="/games" className={ulink}>Back to games →</Link></div>
    return <GameContent g={state.g!} />
  }
}

// Legacy .gteam/.glogo/.gname/.gsub (the .home/.away hooks carried no styles).
// .glogo height needs `!`: the global unlayered `img{height:auto}` beats utilities.
function TeamSide({ t }: { t: GameTeam }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-[clamp(8px,1.6vw,14px)]">
      {t.logo ? <img className="h-[clamp(56px,11vw,96px)]! w-[clamp(56px,11vw,96px)] object-contain drop-shadow-[0_5px_12px_rgba(0,0,0,0.5)]" src={t.logo} alt="" width={64} height={64} /> : null}
      <span className="font-display text-[clamp(23px,4.4vw,50px)] uppercase leading-[1.02] tracking-[0.5px] text-balance text-white max-[560px]:text-[clamp(26px,8vw,34px)]">{t.location || t.displayName}</span>
      <span className="text-[13px] font-bold uppercase tracking-[0.6px] text-[rgba(255,255,255,0.65)]">{t.name}</span>
    </div>
  )
}

function GameContent({ g }: { g: Game }) {
  const showScore = (g.state === 'post' || g.state === 'in') && g.home.score !== null && g.away.score !== null
  const [tipOpen, setTipOpen] = useState(false)
  const fanScores = useFanScores()

  // The crowdsourced layer belongs to the BUILDING, not the fixture: resolve
  // the game's D1 venue (by name, falling back to the home tenant — the games
  // API doesn't carry venue ids) and show that venue's expert notes, tips,
  // reviews, and field photos. Unresolvable venue -> event-scoped fallback.
  const [venue, setVenue] = useState<Venue | null>(null)
  useEffect(() => {
    let alive = true
    getJSON('/api/venues')
      .then((r: any) => {
        if (!alive) return
        const venues: Venue[] = Array.isArray(r?.data) ? r.data : []
        const vn = (g.venue.name || '').toLowerCase()
        const hn = g.home.displayName.toLowerCase()
        const gc = (g.venue.city || '').toLowerCase()
        // Home-tenant fallback only when the cities agree — a spring-training
        // or neutral-site game (London, Maui, ...) must NOT show the home
        // team's regular building. A missing city on either side counts as
        // agreement (better a near-certain match than an empty section).
        const tenant = venues.find((x) => (x.teams || []).some((t) => (t.displayName || '').toLowerCase() === hn))
        const cityOk = !gc || !tenant?.city || tenant.city.toLowerCase() === gc
        const v =
          (vn ? venues.find((x) => x.name.toLowerCase() === vn) : undefined) ??
          (tenant && cityOk ? tenant : null)
        setVenue(v)
      })
      .catch(() => { if (alive) setVenue(null) })
    return () => { alive = false }
  }, [g.venue.name, g.home.displayName])

  return (
    <>
      {/* Legacy .ghero — team-color flag halves under a radial ink scrim (::before). */}
      <section className="relative overflow-hidden bg-ink-soft pt-[clamp(30px,5vw,52px)] pb-[clamp(30px,5vw,46px)] text-white before:absolute before:inset-0 before:z-[1] before:bg-[radial-gradient(120%_120%_at_50%_0%,rgba(20,20,16,0.34)_0%,rgba(20,20,16,0.72)_55%,rgba(20,20,16,0.9)_100%)] before:content-['']">
        <div className="absolute inset-0 z-0" aria-hidden>
          <div className="absolute inset-y-0 left-0 w-[62%] bg-cover bg-center opacity-30 saturate-[1.05] [-webkit-mask-image:linear-gradient(to_right,#000_42%,transparent_95%)] [mask-image:linear-gradient(to_right,#000_42%,transparent_95%)]" style={{ background: g.away.color || '#1a1a1a' }} />
          <div className="absolute inset-y-0 right-0 w-[62%] bg-cover bg-center opacity-30 saturate-[1.05] [-webkit-mask-image:linear-gradient(to_left,#000_42%,transparent_95%)] [mask-image:linear-gradient(to_left,#000_42%,transparent_95%)]" style={{ background: g.home.color || '#1a1a1a' }} />
        </div>
        <div className={container + ' relative z-[2] text-center'}>
          <Badge className="mb-[clamp(16px,3vw,24px)] rounded-[5px] border-0 bg-brand px-[13px] py-1.5 text-[12px] font-extrabold tracking-[1.4px] uppercase text-[#111]">{SPORTS[g.league].label}{g.state === 'in' ? ' · LIVE' : ''}</Badge>
          <div className="mx-auto grid max-w-[880px] grid-cols-[1fr_auto_1fr] items-center gap-[clamp(12px,3.5vw,40px)] max-[560px]:max-w-[340px] max-[560px]:grid-cols-1 max-[560px]:gap-2.5">
            <TeamSide t={g.away} />
            {showScore
              ? <span className="inline-flex flex-none items-center gap-2 font-display text-[clamp(34px,7vw,68px)] tracking-[1px] text-white">{g.away.score}<span className="text-brand">–</span>{g.home.score}</span>
              : <span className="flex h-[clamp(40px,6vw,58px)] w-[clamp(40px,6vw,58px)] flex-none items-center justify-center rounded-full bg-brand font-display text-[clamp(14px,2vw,21px)] tracking-[0.5px] text-[#111] shadow-[0_6px_18px_rgba(0,0,0,0.35)] max-[560px]:mx-auto max-[560px]:my-[2px]">@</span>}
            <TeamSide t={g.home} />
          </div>
          <div className="mt-[clamp(16px,3vw,22px)] text-[15px] font-semibold tracking-[0.3px] text-[#dcdcdc]">
            {when(g)}
            {g.venue.name ? <> · <span className="border-b border-[rgba(247,223,2,0.45)] font-bold text-brand hover:border-brand">{g.venue.name}</span></> : null}
            {g.venue.city ? ', ' + g.venue.city : ''}
          </div>
          <div className="mt-[clamp(18px,3vw,24px)] flex justify-center">
            <LogGameButton game={g} />
          </div>
        </div>
      </section>

      {/* Legacy section.block.tint (.shead-row/.wtk-addbar/.wtk-layout stay: they live in the global styles.css) */}
      <section className="bg-[#f7f6f2] py-[clamp(34px,5vw,52px)]"><div className={container}>
        <div className="mb-[11px] inline-flex items-center gap-[9px] text-[12.5px] font-extrabold tracking-[1.2px] uppercase text-black">Snapback · crowdsourced</div>
        <div className="shead-row">
          <h2 className="shead font-display text-[clamp(28px,3.6vw,40px)] uppercase leading-none tracking-[0.5px] text-ink-soft">What do I need to know?</h2>
          <div className="shead-actions">
            {venue ? <Link to="/venue-plan" search={{ id: venue.id }} className="wtk-addbar guide inline-flex items-center rounded-full bg-brand px-6 py-3 font-sans text-[13px] font-extrabold uppercase tracking-[.5px] whitespace-nowrap text-[#141414]! cursor-pointer hover:bg-black [line-height:normal]">Build your guide →</Link> : null}
            <AddTipButton onOpen={() => setTipOpen(true)} />
          </div>
        </div>
        <div className="mb-[22px] flex flex-wrap items-center gap-x-[14px] gap-y-[10px] text-sm font-semibold tracking-[0.5px] uppercase text-muted">
          {venue
            ? <>Insider tips &amp; reviews from fans who've actually been to {venue.name}</>
            : <>Tips from fans for {g.away.displayName} @ {g.home.displayName}</>}
          {venue ? <FanScorePill stat={fanScores?.[venue.id]} /> : null}
        </div>
        {venue ? (
          <>
            <ExpertNotes scope="venue" targetId={venue.id} />
            <WhatToKnow scope="venue" targetId={venue.id} composerOpen={tipOpen} onComposerClose={() => setTipOpen(false)} />
            <div className="mt-8">
              <Reviews scope="venue" targetId={venue.id} gameId={g.id} venueName={venue.name} venueCity={venue.city} />
            </div>
          </>
        ) : (
          <>
            <ExpertNotes scope="event" targetId={g.league + ':' + g.id} />
            <WhatToKnow scope="event" targetId={g.league + ':' + g.id} composerOpen={tipOpen} onComposerClose={() => setTipOpen(false)} />
          </>
        )}
      </div></section>

      {/* Next hops — the trip doesn't end at this game. */}
      <RelatedExperience g={g} />
      <NearbyVenues city={g.venue.city} state={g.venue.state} excludeName={g.venue.name} />
    </>
  )
}
