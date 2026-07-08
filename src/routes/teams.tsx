import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SearchIcon } from 'lucide-react'
import { SiteNav } from '../components/SiteNav'
import { PageCssGuard } from '../components/PageCssGuard'
import { getJSON, intentWarm, warmImage } from '../lib/dataCache'
import { SPORTS, LEAGUES, COLLEGE_LEAGUES, HERO_LEAGUE, isCollegeLeague, isLeague, type League } from '../lib/sports'
import type { TeamInfo } from '../lib/espn'
import css from '../pages/teams.css?url'

// The sport/team browser — axis 1 of the explore loop. Pro leagues render a flat
// logo grid (/api/teams); college leagues render conference-grouped grids
// (/api/conferences). Every card lands on /team. `?league=` deep-links a sport
// (the home page's Pick-your-sport chips).

export const Route = createFileRoute('/teams')({
  validateSearch: (s: Record<string, unknown>) => ({
    league: isLeague(s.league as string) ? (s.league as League) : undefined,
  }),
  head: () => ({
    links: [{ rel: 'stylesheet', href: css, 'data-page-css': 'teams' }],
    meta: [{ title: 'Snapback — Teams' }],
  }),
  component: Teams,
})

interface ConfTeam { id: string; abbr: string; displayName: string; location: string; logo?: string }
interface Conf { id: string; name: string; shortName?: string; teams: ConfTeam[] }

function TeamCard({ league, t }: { league: League; t: { id: string; abbr: string; displayName: string; location?: string; logo?: string } }) {
  const warm = () => { if (t.logo) warmImage(t.logo) }
  return (
    <Link to="/team" search={{ league, id: t.id }} className="tcard" {...intentWarm(warm)}>
      {t.logo ? <img src={t.logo} alt="" width={44} height={44} loading="lazy" /> : <span className="tcard-ph">{t.abbr.slice(0, 3)}</span>}
      <span className="tcard-nm">{t.displayName}</span>
      <span className="tcard-go">→</span>
    </Link>
  )
}

function Teams() {
  const { league: leagueParam } = Route.useSearch()
  const [league, setLeague] = useState<League>(leagueParam ?? HERO_LEAGUE)
  // Deep link (?league=) wins when it changes under a mounted component.
  useEffect(() => { if (leagueParam) setLeague(leagueParam) }, [leagueParam])
  const [teams, setTeams] = useState<TeamInfo[] | null>(null)
  const [confs, setConfs] = useState<Conf[] | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let alive = true
    setTeams(null); setConfs(null); setErrMsg(null)
    if (isCollegeLeague(league)) {
      getJSON('/api/conferences?league=' + league)
        .then((r: any) => { if (alive) setConfs(Array.isArray(r?.data) ? r.data : []) })
        .catch(() => { if (alive) setErrMsg("Couldn't load conferences.") })
    } else {
      getJSON('/api/teams?league=' + league)
        .then((r: any) => { if (alive) setTeams(Array.isArray(r?.data) ? r.data : []) })
        .catch(() => { if (alive) setErrMsg("Couldn't load teams.") })
    }
    return () => { alive = false }
  }, [league])

  const q = query.trim().toLowerCase()
  const match = (t: { displayName: string; location?: string; abbr: string }) =>
    !q || `${t.displayName} ${t.location ?? ''} ${t.abbr}`.toLowerCase().includes(q)

  const proList = useMemo(() => (teams ? teams.filter(match) : []), [teams, q])
  const confList = useMemo(
    () => (confs ? confs.map((c) => ({ ...c, teams: c.teams.filter(match) })).filter((c) => c.teams.length) : []),
    [confs, q],
  )
  const loading = teams === null && confs === null && !errMsg

  return (
    <>
      <PageCssGuard id="teams" />
      <SiteNav active="teams" />
      <section className="head">
        <div className="container">
          <Link to="/" className="ghback">← Back</Link>
          <h1>Pick your <span className="hl">team</span></h1>
          <p className="sub">Every team leads to its home venue, upcoming games and ranked experiences.</p>
        </div>
      </section>

      <section className="block">
        <div className="container">
          <div className="block-head">
            <div className="filters">
              {[...LEAGUES, ...COLLEGE_LEAGUES].map((l) => (
                <button key={l} className={'chip' + (l === league ? ' on' : '')} onClick={() => setLeague(l)}>{SPORTS[l].label}</button>
              ))}
            </div>
            <div className="search"><SearchIcon className="si" /><input type="search" placeholder="Search teams…" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
          </div>

          {loading ? <div className="loading">Loading teams…</div> : null}
          {errMsg ? <div className="empty">{errMsg}</div> : null}

          {teams !== null ? (
            proList.length
              ? <div className="tgrid">{proList.map((t) => <TeamCard key={t.id} league={league} t={t} />)}</div>
              : <div className="empty">No {SPORTS[league].label} teams{q ? ` for “${query.trim()}”` : ''}.</div>
          ) : null}

          {confs !== null ? (
            confList.length ? (
              confList.map((c) => (
                <section key={c.id} className="confsec">
                  <div className="confhd"><h2>{c.name}</h2><span className="cnt">{c.teams.length} {c.teams.length === 1 ? 'school' : 'schools'}</span></div>
                  <div className="tgrid">{c.teams.map((t) => <TeamCard key={t.id} league={league} t={t} />)}</div>
                </section>
              ))
            ) : <div className="empty">No {SPORTS[league].label} schools{q ? ` for “${query.trim()}”` : ''}.</div>
          ) : null}
        </div>
      </section>

      <footer><div className="container">© 2026 Snapback Sports. <Link to="/">← Explore</Link></div></footer>
    </>
  )
}
