import { Link } from '@tanstack/react-router'
import { intentWarm, warmImage } from '../lib/dataCache'
import { SPORTS } from '../lib/sports'
import type { Game, GameTeam } from '../lib/espn'

// Shared clickable game row (/games list, /weekend slate, team pages, next-hop
// modules). Styled by pages/gamerow.css — a multi-route stylesheet: every route
// that renders this component must link that file with the SAME space-separated
// data-page-css id string, or PageCssGuard will disable it on one of the routes.

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function dateChip(iso: string) {
  if (!iso) return { wd: '', md: '' }
  const d = new Date(iso)
  if (isNaN(d.getTime())) return { wd: '', md: '' }
  return { wd: WD[d.getDay()], md: MON[d.getMonth()] + ' ' + d.getDate() }
}

export const kickoff = (iso: string) => {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export const matchText = (g: Game) =>
  [g.home.displayName, g.away.displayName, g.home.location, g.away.location, g.venue.name, g.venue.city, SPORTS[g.league].label]
    .filter(Boolean).join(' ').toLowerCase()

function TeamCell({ t, align }: { t: GameTeam; align: 'l' | 'r' }) {
  const logo = t.logo ? <img className="gr-logo" src={t.logo} alt="" width={24} height={24} loading="lazy" /> : null
  const name = <span className="gr-tn">{t.location || t.displayName}</span>
  return (
    <span className={'gr-team' + (align === 'r' ? ' r' : '')}>
      {align === 'l' ? <>{logo}{name}</> : <>{name}{logo}</>}
    </span>
  )
}

export function GameRow({ g }: { g: Game }) {
  const c = dateChip(g.date)
  const live = g.state === 'in'
  const done = g.state === 'post'
  const showScore = (live || done) && g.home.score !== null && g.away.score !== null
  const warm = () => { if (g.home.logo) warmImage(g.home.logo); if (g.away.logo) warmImage(g.away.logo) }
  return (
    <Link to="/game" search={{ id: g.id, league: g.league }} className="grow" {...intentWarm(warm)}>
      {done ? <span className="gr-ft">Final</span> : null}
      {live ? <span className="gr-ft live">{g.detail || 'Live'}</span> : null}
      <div className="gr-date"><span className="gr-wd">{c.wd}</span><span className="gr-md">{c.md}</span></div>
      <div className="gr-mid">
        <div className="gr-round">{SPORTS[g.league].label}</div>
        <div className="gr-teams">
          <TeamCell t={g.away} align="l" />
          {showScore
            ? <span className="gr-score">{g.away.score}<span className="gr-dash">–</span>{g.home.score}</span>
            : <span className="gr-vs">@</span>}
          <TeamCell t={g.home} align="r" />
        </div>
        <div className="gr-meta">{g.venue.name}{g.venue.city ? ' · ' + g.venue.city : ''}{g.state === 'pre' && kickoff(g.date) ? ' · ' + kickoff(g.date) : ''}</div>
      </div>
      <div className="gr-right">
        <span className="gr-go">{done ? 'Recap →' : live ? 'Watch →' : 'Game info →'}</span>
      </div>
    </Link>
  )
}
