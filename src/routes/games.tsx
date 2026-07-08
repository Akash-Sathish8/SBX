import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SearchIcon } from 'lucide-react'
import { SiteNav } from '../components/SiteNav'
import { PageCssGuard } from '../components/PageCssGuard'
import { GameRow, matchText } from '../components/GameRow'
import { getJSON } from '../lib/dataCache'
import { SPORTS, LEAGUES, type League } from '../lib/sports'
import type { Game } from '../lib/espn'
import css from '../pages/games.css?url'
import rowCss from '../pages/gamerow.css?url'

export const Route = createFileRoute('/games')({
  head: () => ({
    links: [
      { rel: 'stylesheet', href: css, 'data-page-css': 'games' },
      // Shared GameRow styles — identical id string on every route that links it.
      { rel: 'stylesheet', href: rowCss, 'data-page-css': 'games weekend team game venue' },
    ],
    meta: [{ title: 'Snapback — Games' }],
  }),
  component: Games,
})

function Games() {
  const [all, setAll] = useState<Game[] | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | League>('all')
  const [query, setQuery] = useState('')
  // Explore-first: the full schedule renders only after a league/search choice
  // or an explicit reveal; the default view is Today + This Weekend entries.
  const [reveal, setReveal] = useState(false)
  // Progressive reveal — up to 200 rows (28k+ px) is a long, heavy scroll on mobile.
  const PAGE = 40
  const [shown, setShown] = useState(PAGE)

  // Refetch per league: 'all' returns a near-term cross-league window ("what's
  // on"); a specific league returns its most-recent games (its season may be
  // over), so the chips browse the whole stored season, not just the window.
  useEffect(() => {
    let alive = true
    setAll(null); setErrMsg(null); setShown(PAGE)
    getJSON('/api/games' + (filter === 'all' ? '' : '?league=' + filter))
      .then((r: any) => { if (alive) setAll(Array.isArray(r?.data) ? r.data : []) })
      .catch(() => { if (alive) setErrMsg("Couldn't load the schedule.") })
    return () => { alive = false }
  }, [filter])

  const q = query.trim().toLowerCase()
  const list = useMemo(
    () => (all ? all.filter((g) => !q || matchText(g).indexOf(q) > -1) : []),
    [all, q],
  )
  const showList = filter !== 'all' || !!q || reveal
  // Today's slate (local calendar day) — the honest default view.
  const today = useMemo(() => {
    if (!all) return null
    const now = new Date()
    return all.filter((g) => { const d = new Date(g.date); return !isNaN(d.getTime()) && d.toDateString() === now.toDateString() })
  }, [all])

  return (
    <>
      <PageCssGuard id="games" />
      <SiteNav active="games" />
      <section className="head">
        <div className="container">
          <Link to="/" className="ghback">← Back</Link>
          <h1>Every <span className="hl">game</span>, every league</h1>
        </div>
      </section>

      <section className="block">
        <div className="container">
          <div className="block-head">
            <h2>On the schedule</h2>
            <div className="search"><SearchIcon className="si" /><input id="search" type="search" placeholder="Search team, venue or city…" autoComplete="off" value={query} onChange={(e) => { setQuery(e.target.value); setShown(PAGE) }} /></div>
          </div>
          <div className="note">Filter by league or search · tap a game for its full guide.</div>
          <div className="filters" id="filters">
            <button className={'chip' + (filter === 'all' ? ' on' : '')} onClick={() => setFilter('all')}>All sports</button>
            {LEAGUES.map((l) => (
              <button key={l} className={'chip' + (l === filter ? ' on' : '')} onClick={() => setFilter(l)}>{SPORTS[l].label}</button>
            ))}
          </div>
          <div id="matches">
            {all === null && !errMsg ? <div className="loading">Loading games…</div> : null}
            {errMsg ? <div className="empty">{errMsg}</div> : null}
            {all !== null && !errMsg && !showList ? (
              <>
                <Link to="/weekend" className="wkcard">
                  <span className="wk-t">This weekend →</span>
                  <span className="wk-d">The full Fri–Sun slate, every league, grouped by day</span>
                </Link>
                <div className="dayhd2"><h3>Today</h3>{today ? <span className="cnt">{today.length} {today.length === 1 ? 'game' : 'games'}</span> : null}</div>
                {today && today.length ? today.slice(0, 12).map((g) => <GameRow key={g.id} g={g} />) : null}
                {today && !today.length ? <div className="empty">No games today. Pick a league above or browse the weekend.</div> : null}
                <div className="loadmore-row">
                  <button className="chip loadmore" onClick={() => setReveal(true)}>Full schedule →</button>
                </div>
              </>
            ) : null}
            {all !== null && !errMsg && showList ? (
              list.length
                ? list.slice(0, shown).map((g) => <GameRow key={g.id} g={g} />)
                : <div className="empty">No games{q ? ' for “' + query.trim() + '”' : filter !== 'all' ? ' on the ' + SPORTS[filter].label + ' schedule right now' : ' on the schedule right now'}.</div>
            ) : null}
          </div>
          {all !== null && !errMsg && showList && list.length > shown ? (
            <div className="loadmore-row">
              <button className="chip loadmore" onClick={() => setShown((n) => n + PAGE * 2)}>
                Show more · {list.length - shown} left
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <footer><div className="container">© 2026 Snapback Sports — Games. <Link to="/">← Experiences</Link></div></footer>
    </>
  )
}
