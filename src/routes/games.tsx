import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { SiteNav } from '../components/SiteNav'
import { getGamesFn } from '../server/games'
import css from '../pages/games.css?url'

export const Route = createFileRoute('/games')({
  head: () => ({
    links: [{ rel: 'stylesheet', href: css }],
    meta: [{ title: 'Snapback — Games & Tickets' }],
  }),
  component: Games,
})

const FLAG: Record<string, string> = { 'Mexico': '🇲🇽', 'South Africa': '🇿🇦', 'Korea Republic': '🇰🇷', 'Czechia': '🇨🇿', 'Canada': '🇨🇦', 'Bosnia-Herzegovina': '🇧🇦', 'USA': '🇺🇸', 'Paraguay': '🇵🇾', 'Qatar': '🇶🇦', 'Switzerland': '🇨🇭', 'Brazil': '🇧🇷', 'Morocco': '🇲🇦', 'Haiti': '🇭🇹', 'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Australia': '🇦🇺', 'Turkey': '🇹🇷', 'Germany': '🇩🇪', 'Curacao': '🇨🇼', 'Netherlands': '🇳🇱', 'Japan': '🇯🇵', 'Ivory Coast': '🇨🇮', 'Ecuador': '🇪🇨', 'Tunisia': '🇹🇳', 'Sweden': '🇸🇪', 'Argentina': '🇦🇷', 'Algeria': '🇩🇿', 'Spain': '🇪🇸', 'Cabo Verde': '🇨🇻', 'France': '🇫🇷', 'Senegal': '🇸🇳', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Croatia': '🇭🇷', 'Panama': '🇵🇦', 'Ghana': '🇬🇭', 'Belgium': '🇧🇪', 'Iran': '🇮🇷', 'New Zealand': '🇳🇿', 'Egypt': '🇪🇬', 'Uruguay': '🇺🇾', 'Colombia': '🇨🇴', 'Portugal': '🇵🇹', 'Uzbekistan': '🇺🇿', 'Austria': '🇦🇹', 'Jordan': '🇯🇴', 'Norway': '🇳🇴', 'Saudi Arabia': '🇸🇦', "Cote d'Ivoire": '🇨🇮' }
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const flag = (n: string) => FLAG[n] || '⚽'

function fmt(ds: string, ts: string) {
  if (!ds) return ''
  const p = ds.split('-').map(Number)
  const wd = WD[new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()]
  let t = ''
  if (ts) {
    const x = ts.split(':').map(Number)
    const ap = x[0] >= 12 ? 'PM' : 'AM'
    const h = x[0] % 12 || 12
    t = ' · ' + h + ':' + String(x[1]).padStart(2, '0') + ' ' + ap
  }
  return wd + ' ' + MON[p[1] - 1] + ' ' + p[2] + t
}
const matchText = (m: any) => (m.a + ' ' + m.b + ' ' + m.venue + ' ' + (m.city || '') + ' ' + (m.group ? 'Group ' + m.group : '') + ' ' + (m.round || '')).toLowerCase()
const rowLabel = (m: any) => (m.round || (m.matchNo ? 'Match ' + m.matchNo : '')) + (m.group ? ' · Group ' + m.group : '')
const statusTag = (m: any) => m.status === 'onsale'
  ? <span className="tag onsale">On sale</span>
  : <span className="tag off">{m.status || 'TBD'}</span>

function MatchRow({ m }: { m: any }) {
  const label = rowLabel(m)
  return (
    <div className="mrow" data-id={m.id}>
      <div>
        <div className="mteams">{flag(m.a)} {m.a} <span className="vs">vs</span> {m.b} {flag(m.b)}{statusTag(m)}</div>
        <div className="mmeta">{label ? label + ' · ' : ''}{fmt(m.date, m.time)} · {m.venue}{m.city ? ' · ' + m.city : ''}</div>
      </div>
      <div className="price-slot"><span className="soon">price</span>via resale</div>
      <div className="acts"><a className="btn btn-dark btn-sm" href={m.url} target="_blank" rel="noopener">Get tickets ↗</a></div>
    </div>
  )
}

function Games() {
  const [all, setAll] = useState<any[] | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [upd, setUpd] = useState('loading…')
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    let alive = true
    getGamesFn()
      .then((d: any) => {
        if (!alive) return
        if (!d.ok) { setErrMsg("Couldn't load fixtures: " + (d.error || 'error')); setUpd('error'); return }
        setAll(d.matches); setUpd(d.count + ' matches')
      })
      .catch(() => { if (alive) { setErrMsg('Server not reachable — is the Node proxy running?'); setUpd('offline') } })
    return () => { alive = false }
  }, [])

  const cities = useMemo(() => all ? ['all'].concat([...new Set(all.map((m) => m.city).filter(Boolean))].sort()) : [], [all])
  const q = query.trim().toLowerCase()
  const list = all ? all.filter((m) => (filter === 'all' || m.city === filter) && (!q || matchText(m).indexOf(q) > -1)) : []

  return (
    <>
      <SiteNav active="games" />
      <section className="head">
        <div className="container">
          <div className="eyebrow"><span className="live-dot"></span>Live fixtures · Ticketmaster · <span id="upd">{upd}</span></div>
          <h1>Every World Cup <span className="hl">game</span></h1>
          <p className="sub">All 2026 World Cup matches, live from Ticketmaster.</p>
        </div>
      </section>

      <section className="block">
        <div className="container">
          <div className="block-head">
            <h2>All matches</h2>
            <div className="search"><span className="si">🔍</span><input id="search" type="search" placeholder="Search team, venue or city…" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
          </div>
          <div className="note">Filter by host city or search · "Get tickets" opens the official Ticketmaster page.</div>
          <div className="filters" id="filters">
            {cities.map((c) => (
              <button key={c} className={'chip' + (c === filter ? ' on' : '')} onClick={() => setFilter(c)}>{c === 'all' ? 'All cities' : c}</button>
            ))}
          </div>
          <div id="matches">
            {all === null && !errMsg ? <div className="loading">Loading live fixtures…</div> : null}
            {errMsg ? <div className="empty">{errMsg}</div> : null}
            {all !== null && !errMsg ? (
              list.length
                ? list.map((m) => <MatchRow key={m.id} m={m} />)
                : <div className="empty">No matches{q ? ' for “' + query.trim() + '”' : ' for that city'}.</div>
            ) : null}
          </div>
        </div>
      </section>

      <footer><div className="container">© 2026 Snapback Sports — Games &amp; Tickets. Fixtures via Ticketmaster Discovery API. <a href="/">← Experiences</a></div></footer>
    </>
  )
}
