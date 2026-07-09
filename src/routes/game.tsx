import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteNav } from '../components/SiteNav'
import { PageCssGuard } from '../components/PageCssGuard'
import { getJSON } from '../lib/dataCache'
import { SPORTS, isLeague, type League } from '../lib/sports'
import type { Game, GameTeam } from '../lib/espn'
import { WhatToKnow, AddTipButton } from '../components/WhatToKnow'
import { ExpertNotes } from '../components/ExpertNotes'
import { GamesThatWeekend, NearbyVenues, RelatedExperience } from '../components/NextHops'
import css from '../pages/game.css?url'
import rowCss from '../pages/gamerow.css?url'
import nexthopCss from '../pages/nexthop.css?url'

export const Route = createFileRoute('/game')({
  validateSearch: (s: Record<string, unknown>) => ({
    // Coerce to string: a numeric ?id=401234 is parsed as a number and would be
    // dropped by a `typeof === 'string'` check (breaks direct loads / shared links).
    id: s.id != null ? String(s.id) : '',
    league: isLeague(s.league as string) ? (s.league as League) : undefined,
  }),
  head: () => ({
    links: [
      { rel: 'stylesheet', href: css, 'data-page-css': 'game build' },
      { rel: 'stylesheet', href: rowCss, 'data-page-css': 'games weekend team game venue' },
      { rel: 'stylesheet', href: nexthopCss, 'data-page-css': 'venue game' },
    ],
    meta: [{ title: 'Snapback — Game' }],
  }),
  component: GamePage,
})

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
          document.title = 'Snapback — ' + g.away.displayName + ' @ ' + g.home.displayName
        }
      })
      .catch(() => { if (alive) setState({ status: 'error' }) })
    return () => { alive = false }
  }, [id, league])

  return (
    <>
      <PageCssGuard id="game" />
      <SiteNav active="games" />
      <main id="app">{renderBody()}</main>
      <footer>
        <div className="container">© 2026 Snapback Sports — Games. <Link to="/games">← All games</Link></div>
      </footer>
    </>
  )

  function renderBody() {
    if (!id) return <div className="loadwrap">No game selected. <Link to="/games" className="ulink">Back to games →</Link></div>
    if (state.status === 'loading') return <div className="loadwrap">Loading game…</div>
    if (state.status === 'error') return <div className="loadwrap">Couldn't find this game. <Link to="/games" className="ulink">Back to games →</Link></div>
    return <GameContent g={state.g!} />
  }
}

function TeamSide({ t, side }: { t: GameTeam; side: 'home' | 'away' }) {
  return (
    <div className={'gteam ' + side}>
      {t.logo ? <img className="glogo" src={t.logo} alt="" width={64} height={64} /> : null}
      <span className="gname">{t.location || t.displayName}</span>
      <span className="gsub">{t.name}</span>
    </div>
  )
}

function GameContent({ g }: { g: Game }) {
  const showScore = (g.state === 'post' || g.state === 'in') && g.home.score !== null && g.away.score !== null
  const [tipOpen, setTipOpen] = useState(false)
  return (
    <>
      <section className="ghero">
        <div className="flagbg" aria-hidden>
          <div className="fhalf left" style={{ background: g.away.color || '#1a1a1a' }} />
          <div className="fhalf right" style={{ background: g.home.color || '#1a1a1a' }} />
        </div>
        <div className="container">
          <div className="ground">{SPORTS[g.league].label}{g.state === 'in' ? ' · LIVE' : ''}</div>
          <div className="gmatch">
            <TeamSide t={g.away} side="away" />
            {showScore
              ? <span className="gscore">{g.away.score}<span className="gdash">–</span>{g.home.score}</span>
              : <span className="gvs">@</span>}
            <TeamSide t={g.home} side="home" />
          </div>
          <div className="gmeta">
            {when(g)}
            {g.venue.name ? <> · <span className="glink">{g.venue.name}</span></> : null}
            {g.venue.city ? ', ' + g.venue.city : ''}
          </div>
        </div>
      </section>

      <section className="block tint"><div className="container">
        <div className="eyebrow">Snapback · crowdsourced</div>
        <div className="shead-row">
          <h2 className="shead">What do I need to know?</h2>
          <AddTipButton onOpen={() => setTipOpen(true)} />
        </div>
        <div className="ssub">Tips from fans for {g.away.displayName} @ {g.home.displayName}</div>
        <ExpertNotes scope="event" targetId={g.league + ':' + g.id} />
        <WhatToKnow scope="event" targetId={g.league + ':' + g.id} composerOpen={tipOpen} onComposerClose={() => setTipOpen(false)} />
      </div></section>

      {/* Next hops — the trip doesn't end at this game. */}
      <RelatedExperience g={g} />
      <GamesThatWeekend anchorDate={g.date} city={g.venue.city} league={g.league} excludeGameKey={g.league + ':' + g.id} />
      <NearbyVenues city={g.venue.city} state={g.venue.state} excludeName={g.venue.name} />
    </>
  )
}
