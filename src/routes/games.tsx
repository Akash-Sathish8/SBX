import { Fragment, useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteNav } from '../components/SiteNav'
import { PageCssGuard } from '../components/PageCssGuard'
import { teamName, teamFlag } from '../lib/teams'
import css from '../pages/games.css?url'

export const Route = createFileRoute('/games')({
  head: () => ({
    links: [{ rel: 'stylesheet', href: css, 'data-page-css': 'games' }],
    meta: [{ title: 'Snapback — Games & Tickets' }],
  }),
  component: Games,
})

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function dateChip(iso: string) {
  if (!iso) return { wd: '', md: '' }
  const p = iso.split('-').map(Number)
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]))
  return { wd: WD[d.getUTCDay()], md: MON[p[1] - 1] + ' ' + p[2] }
}
const matchText = (m: any) => ((m.home || '') + ' ' + (m.away || '') + ' ' + teamName(m.home || '') + ' ' + teamName(m.away || '') + ' ' + (m.venueName || '') + ' ' + (m.city || '') + ' ' + (m.round || '') + ' ' + (m.fixture || '')).toLowerCase()

function GameRow({ m }: { m: any }) {
  const c = dateChip(m.dateISO)
  const inner = (
    <>
      <div className="gr-date"><span className="gr-wd">{c.wd}</span><span className="gr-md">{c.md}</span></div>
      <div className="gr-mid">
        <div className="gr-round">{m.round || 'Match'}</div>
        {m.tbd
          ? <div className="gr-teams tbd">To be confirmed</div>
          : <div className="gr-teams">{teamFlag(m.home)} {teamName(m.home)} <span className="gr-vs">v</span> {teamName(m.away)} {teamFlag(m.away)}</div>}
        <div className="gr-meta">{m.venueName}{m.city ? ' · ' + m.city : ''}{m.ko ? ' · ' + m.ko : ''}</div>
      </div>
      <div className="gr-right">
        {!m.tbd ? <span className="gr-go">Match information →</span> : <span className="gr-soon">Info soon</span>}
      </div>
    </>
  )
  if (m.tbd) return <div className="grow dim">{inner}</div>
  return <Link to="/game" search={{ id: m.id }} className="grow">{inner}</Link>
}

function Games() {
  const [all, setAll] = useState<any[] | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    let alive = true
    fetch('/data/games/index.json')
      .then((r) => { if (!r.ok) throw new Error('not found'); return r.json() })
      .then((d: any) => { if (alive) setAll(d) })
      .catch(() => { if (alive) setErrMsg('Couldn\'t load the fixture list.') })
    return () => { alive = false }
  }, [])

  const cities = useMemo(() => all ? ['all'].concat([...new Set(all.map((m) => m.city).filter(Boolean))].sort()) : [], [all])
  const q = query.trim().toLowerCase()
  const list = all ? all.filter((m) => (filter === 'all' || m.city === filter) && (!q || matchText(m).indexOf(q) > -1)) : []

  return (
    <>
      <PageCssGuard id="games" />
      <SiteNav active="games" />
      <section className="head">
        <div className="container">
          <h1>Every World Cup <span className="hl">game</span></h1>
        </div>
      </section>

      <section className="block">
        <div className="container">
          <div className="block-head">
            <h2>All matches</h2>
            <div className="search"><span className="si">🔍</span><input id="search" type="search" placeholder="Search team, venue or city…" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
          </div>
          <div className="note">Filter by host city or search · tap a match for its full game guide.</div>
          <div className="filters" id="filters">
            {cities.map((c) => (
              <Fragment key={c}>
                {c === 'Miami' ? <span className="chipbreak" /> : null}
                <button className={'chip' + (c === filter ? ' on' : '')} onClick={() => setFilter(c)}>{c === 'all' ? 'All cities' : c}</button>
              </Fragment>
            ))}
          </div>
          <div id="matches">
            {all === null && !errMsg ? <div className="loading">Loading fixtures…</div> : null}
            {errMsg ? <div className="empty">{errMsg}</div> : null}
            {all !== null && !errMsg ? (
              list.length
                ? list.map((m) => <GameRow key={m.id} m={m} />)
                : <div className="empty">No matches{q ? ' for “' + query.trim() + '”' : ' for that city'}.</div>
            ) : null}
          </div>
        </div>
      </section>

      <footer><div className="container">© 2026 Snapback Sports — Games &amp; Tickets. <Link to="/">← Experiences</Link></div></footer>
    </>
  )
}
