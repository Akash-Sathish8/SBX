import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteNav } from '../components/SiteNav'
import { PageCssGuard } from '../components/PageCssGuard'
import { GameRow } from '../components/GameRow'
import { getJSON, warmImage } from '../lib/dataCache'
import { SPORTS, isLeague, type League } from '../lib/sports'
import type { TeamInfo, Venue, Game } from '../lib/espn'
import type { Experience } from '../lib/experiences'
import { matchExperienceForVenue, matchExperienceForTeam } from '../lib/experienceMatch'
import css from '../pages/team.css?url'
import rowCss from '../pages/gamerow.css?url'

// Team page — the fandom axis: one team's home venue, upcoming games and ranked
// experience. Everything real: teams/venues/games from D1, experience from
// experiences.json via the shared matcher; unmatched sections are omitted.

export const Route = createFileRoute('/team')({
  // Coerce to string like /venue: numeric ids arrive as numbers from the parser.
  validateSearch: (s: Record<string, unknown>) => ({
    league: s.league != null ? String(s.league) : '',
    id: s.id != null ? String(s.id) : '',
  }),
  head: () => ({
    links: [
      { rel: 'stylesheet', href: css, 'data-page-css': 'team' },
      { rel: 'stylesheet', href: rowCss, 'data-page-css': 'games weekend team game venue' },
    ],
    meta: [{ title: 'Snapback · Team' }],
  }),
  component: TeamPage,
})

const todayIso = () => new Date().toISOString().slice(0, 10)

function TeamPage() {
  const { league: rawLeague, id: rawId } = Route.useSearch()
  const league = isLeague(rawLeague) ? (rawLeague as League) : null
  const id = (rawId || '').replace(/[^a-z0-9_-]/gi, '')
  const [team, setTeam] = useState<TeamInfo | null | undefined>(undefined)
  const [venue, setVenue] = useState<Venue | null | undefined>(undefined)
  const [games, setGames] = useState<Game[] | null>(null)
  const [exps, setExps] = useState<Experience[] | null>(null)

  useEffect(() => {
    if (!league || !id) return
    let alive = true
    setTeam(undefined); setVenue(undefined); setGames(null)
    getJSON('/api/teams?league=' + league)
      .then((r: any) => {
        const t = (Array.isArray(r?.data) ? r.data : []).find((x: TeamInfo) => x.id === id) ?? null
        if (alive) { setTeam(t); if (t) { document.title = 'Snapback · ' + t.displayName; if (t.logo) warmImage(t.logo) } }
      })
      .catch(() => { if (alive) setTeam(null) })
    getJSON('/api/venues')
      .then((r: any) => {
        const v = (Array.isArray(r?.data) ? r.data : []).find((x: Venue) => x.teams.some((t) => t.league === league && t.id === id)) ?? null
        if (alive) { setVenue(v); if (v?.image) warmImage(v.image) }
      })
      .catch(() => { if (alive) setVenue(null) })
    getJSON('/data/experiences.json')
      .then((r: any) => { if (alive) setExps(Array.isArray(r?.experiences) ? r.experiences : []) })
      .catch(() => { if (alive) setExps([]) })
    return () => { alive = false }
  }, [league, id])

  // Upcoming games need the team abbr (dbGames filters by abbr + league).
  useEffect(() => {
    if (!league || !team) return
    let alive = true
    getJSON(`/api/games?league=${league}&team=${encodeURIComponent(team.abbr)}&from=${todayIso()}&limit=12`)
      .then((r: any) => { if (alive) setGames(Array.isArray(r?.data) ? r.data : []) })
      .catch(() => { if (alive) setGames([]) })
    return () => { alive = false }
  }, [league, team])

  // Experience: venue match first (carries the pinned overrides), else team name.
  const snap = useMemo(() => {
    if (!exps) return null
    if (venue) { const m = matchExperienceForVenue(venue, exps); if (m) return m }
    return team ? matchExperienceForTeam(team.displayName, exps) : null
  }, [exps, venue, team])

  return (
    <>
      <PageCssGuard id="team" />
      <SiteNav active="teams" />
      <main id="app">{renderBody()}</main>
      <footer><div className="container">© 2026 Snapback Sports. <Link to="/teams">← All teams</Link></div></footer>
    </>
  )

  function renderBody() {
    if (!league || !id) return <div className="loadwrap">No team selected. <Link to="/teams" className="ulink">Browse teams →</Link></div>
    if (team === undefined) return <div className="loadwrap">Loading team…</div>
    if (team === null) return <div className="loadwrap">Couldn't find this team. <Link to="/teams" className="ulink">Browse teams →</Link></div>
    return <TeamContent league={league} t={team} venue={venue ?? null} games={games} snap={snap} />
  }
}

function TeamContent({ league, t, venue, games, snap }: { league: League; t: TeamInfo; venue: Venue | null; games: Game[] | null; snap: Experience | null }) {
  const accent = t.color ? (t.color.startsWith('#') ? t.color : '#' + t.color) : '#333'
  return (
    <>
      <section className="thero" style={{ background: `radial-gradient(120% 140% at 50% -10%, ${accent}, #0a0a0a 70%)` }}>
        <Link className="back" to="/teams">← All teams</Link>
        <div className="container">
          {t.logo ? <img className="tlogo" src={t.logo} alt="" width={96} height={96} /> : null}
          <div className="teyebrow"><span className="pill">{SPORTS[league].label}</span>{t.location ? <span className="pill loc">{t.location}</span> : null}</div>
          <h1>{t.displayName}</h1>
        </div>
      </section>

      {(venue || snap) ? (
        <section className="block"><div className="container">
          <div className="eyebrow">Where they play · how it rates</div>
          <div className="hopcards">
            {venue ? (
              <Link to="/venue" search={{ id: venue.id }} className={'hopcard venue' + (venue.image ? '' : ' noimg')}>
                {venue.image ? <div className="bg" style={{ backgroundImage: `url('${venue.image}')` }} /> : null}
                <div className="m">
                  <div className="lab">Home venue</div>
                  <div className="nm">{venue.name}</div>
                  <div className="sub">{[venue.city, venue.state].filter(Boolean).join(', ')} · full guide →</div>
                </div>
              </Link>
            ) : null}
            {snap ? (
              <Link to="/rankings" className="hopcard score">
                <div className="m">
                  <div className="lab"><img src="/img/logo.png" alt="" width={18} height={18} /> Snapback Score</div>
                  <div className="val">{snap.final.toFixed(1)}</div>
                  <div className="sub">#{snap.rank} in America · {snap.name} · see the rankings →</div>
                </div>
              </Link>
            ) : null}
          </div>
        </div></section>
      ) : null}

      <section className="block"><div className="container">
        <div className="eyebrow">On the schedule</div>
        <h2 className="shead">Upcoming games</h2>
        {games === null ? <div className="loading">Loading games…</div> : null}
        {games && !games.length ? (
          <div className="empty">No upcoming {t.displayName} games on the schedule. <Link to="/games">Browse all games →</Link></div>
        ) : null}
        {games && games.length ? games.map((g) => <GameRow key={g.league + ':' + g.id} g={g} />) : null}
      </div></section>
    </>
  )
}
