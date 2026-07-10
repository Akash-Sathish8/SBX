import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteNav } from '../components/SiteNav'
import { PageCssGuard } from '../components/PageCssGuard'
import { GameRow } from '../components/GameRow'
import { getJSON } from '../lib/dataCache'
import { SPORTS, RANKABLE_LEAGUES, type League } from '../lib/sports'
import { weekendWindow, localDayKey } from '../lib/weekend'
import type { Game } from '../lib/espn'
import css from '../pages/weekend.css?url'
import rowCss from '../pages/gamerow.css?url'

export const Route = createFileRoute('/weekend')({
  head: () => ({
    links: [
      { rel: 'stylesheet', href: css, 'data-page-css': 'weekend' },
      { rel: 'stylesheet', href: rowCss, 'data-page-css': 'games weekend team game venue near' },
    ],
    meta: [{ title: 'Snapback · This Weekend' }],
  }),
  component: Weekend,
})

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const dayLabel = (d: Date) => `${WD[d.getDay()]} · ${MON[d.getMonth()]} ${d.getDate()}`
const shortDate = (d: Date) => `${MON[d.getMonth()]} ${d.getDate()}`

function Weekend() {
  // The window is computed once per mount — Fri–Sun containing today, or the
  // next one when it's mid-week (see lib/weekend).
  const win = useMemo(() => weekendWindow(new Date()), [])
  const [all, setAll] = useState<Game[] | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | League>('all')

  useEffect(() => {
    let alive = true
    // limit=1000: a fall weekend (NFL + NHL + NBA + both college slates) tops
    // 320+ games — 300 was silently truncating the window. dbGames caps at 2000.
    getJSON(`/api/games?from=${encodeURIComponent(win.from)}&to=${encodeURIComponent(win.to)}&limit=1000`)
      .then((r: any) => { if (alive) setAll(Array.isArray(r?.data) ? r.data : []) })
      .catch(() => { if (alive) setErrMsg("Couldn't load the weekend slate.") })
    return () => { alive = false }
  }, [win])

  const list = useMemo(
    () => (all ? (filter === 'all' ? all : all.filter((g) => g.league === filter)) : []),
    [all, filter],
  )

  return (
    <>
      <PageCssGuard id="weekend" />
      <SiteNav active="weekend" />
      <section className="head">
        <div className="container">
          <Link to="/" className="ghback">← Back</Link>
          <h1>This <span className="hl">weekend</span></h1>
          <p className="sub">
            {shortDate(win.days[0])} – {shortDate(win.days[2])} · every game, every league. Tap one for its full guide.
          </p>
        </div>
      </section>

      <section className="block">
        <div className="container">
          <div className="filters">
            <button className={'chip' + (filter === 'all' ? ' on' : '')} onClick={() => setFilter('all')}>All sports</button>
            {RANKABLE_LEAGUES.map((l) => (
              <button key={l} className={'chip' + (l === filter ? ' on' : '')} onClick={() => setFilter(l)}>{SPORTS[l].label}</button>
            ))}
          </div>

          {all === null && !errMsg ? <div className="loading">Loading the weekend slate…</div> : null}
          {errMsg ? <div className="empty">{errMsg}</div> : null}

          {all !== null && !errMsg ? (
            list.length ? (
              win.days.map((d) => {
                const key = localDayKey(d)
                const dayGames = list.filter((g) => localDayKey(new Date(g.date)) === key)
                if (!dayGames.length) return null
                return (
                  <section key={key}>
                    <div className="dayhd">
                      <h2>{dayLabel(d)}</h2>
                      <span className="cnt">{dayGames.length} {dayGames.length === 1 ? 'game' : 'games'}</span>
                    </div>
                    {dayGames.map((g) => <GameRow key={g.league + ':' + g.id} g={g} />)}
                  </section>
                )
              })
            ) : (
              <div className="empty">
                {filter === 'all'
                  ? <>Nothing on the schedule this weekend. <Link to="/games">Browse the full schedule →</Link></>
                  : <>No {SPORTS[filter].label} games in this window. <Link to="/games">See the {SPORTS[filter].label} schedule →</Link></>}
              </div>
            )
          ) : null}
        </div>
      </section>

      <footer><div className="container">© 2026 Snapback Sports. <Link to="/">← Explore</Link></div></footer>
    </>
  )
}
