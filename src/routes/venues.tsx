import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteNav } from '../components/SiteNav'
import { PageCssGuard } from '../components/PageCssGuard'
import { SearchBox } from '../components/SearchBox'
import { getJSON, intentWarm, warmImage } from '../lib/dataCache'
import { SPORTS, LEAGUES, COLLEGE_LEAGUES, type League } from '../lib/sports'
import { cardImg } from '../lib/img'
import type { Venue } from '../lib/espn'
import css from '../pages/venues.css?url'
import searchCss from '../pages/searchbox.css?url'

export const Route = createFileRoute('/venues')({
  head: () => ({
    links: [
      { rel: 'stylesheet', href: css, 'data-page-css': 'venues' },
      { rel: 'stylesheet', href: searchCss, 'data-page-css': 'home venues' },
    ],
    meta: [{ title: 'Snapback — Venues' }],
  }),
  component: Venues,
})

const hasLeague = (v: Venue, l: League) => v.teams.some((t) => t.league === l)
const leagueTags = (v: Venue) => [...new Set(v.teams.map((t) => SPORTS[t.league].label))].join(' · ')
// Dedupe tenants by team id for DISPLAY — a school that plays two sports at one
// building (e.g. Syracuse football + basketball at the Carrier Dome) is listed
// once per league in the data (for filtering) but should show once on the card.
const uniqTeams = (v: Venue) => [...new Map(v.teams.map((t) => [t.id, t])).values()]

function Venues() {
  const [all, setAll] = useState<Venue[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | League>('all')
  const [conf, setConf] = useState<string | null>(null)
  // Progressive reveal — 601 cards (each a background-image fetch) is too heavy
  // to mount at once, especially on mobile.
  const PAGE = 24
  const [shown, setShown] = useState(PAGE)

  useEffect(() => {
    let alive = true
    getJSON('/api/venues')
      .then((r: any) => { if (alive) setAll(Array.isArray(r?.data) ? r.data : []) })
      .catch(() => { if (alive) setErr("Couldn't load venues.") })
    return () => { alive = false }
  }, [])


  const isCollege = filter === 'college-football' || filter === 'college-basketball'
  const list = useMemo(
    () => (all
      ? all.filter((v) =>
        (filter === 'all' || hasLeague(v, filter)) &&
        (!conf || v.teams.some((t) => t.league === filter && t.conference === conf)))
      : []),
    [all, filter, conf],
  )
  const count = (l: League) => (all ? all.filter((v) => hasLeague(v, l)).length : 0)
  // Conferences present for the active college sport (short name + venue count).
  const confList = useMemo(() => {
    if (!all || !isCollege) return []
    const m = new Map<string, { short: string; n: number }>()
    for (const v of all) {
      const t = v.teams.find((x) => x.league === filter && x.conference)
      if (!t?.conference) continue
      const e = m.get(t.conference) || { short: t.conferenceShort || t.conference, n: 0 }
      e.n++; m.set(t.conference, e)
    }
    return [...m.entries()].map(([name, x]) => ({ name, short: x.short, n: x.n })).sort((a, b) => a.short.localeCompare(b.short))
  }, [all, filter, isCollege])
  const pill = (k: string) => 'pill' + (filter === k ? ' on' : '')
  const pickFilter = (f: 'all' | League) => { setFilter(f); setConf(null); setShown(PAGE) }

  const visible = list.slice(0, shown)
  // Warm the photos for the visible slice so cards paint instantly.
  useEffect(() => {
    for (const v of visible) { const s = cardImg(v.image); if (s) warmImage(s) }
  }, [visible])

  return (
    <>
      <PageCssGuard id="venues" />
      <SiteNav active="venues" />
      <section className="head">
        <div className="container">
          <div className="eyebrow">NFL · NBA · MLB · NHL · every home ground</div>
          <h1>Every <span className="hl">venue</span></h1>
          <SearchBox placeholder="Search a venue, team, or city…" />
          <div className="tally" id="tally">
            <button className={pill('all')} onClick={() => pickFilter('all')}>All venues</button>
            {[...LEAGUES, ...COLLEGE_LEAGUES].map((l) => (
              <button key={l} className={pill(l)} onClick={() => pickFilter(l)}><b>{all ? count(l) : '—'}</b> {SPORTS[l].label}</button>
            ))}
          </div>
          {isCollege && confList.length ? (
            <div className="confrow">
              <button className={'cchip' + (conf === null ? ' on' : '')} onClick={() => { setConf(null); setShown(PAGE) }}>All conferences</button>
              {confList.map((c) => (
                <button key={c.name} className={'cchip' + (conf === c.name ? ' on' : '')} onClick={() => { setConf(c.name); setShown(PAGE) }}><b>{c.n}</b> {c.short}</button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="block">
        <div className="container">
          {all === null && !err ? <div className="loading">Loading venues…</div> : null}
          {err ? <div className="empty">{err}</div> : null}
          {all !== null && !err && list.length === 0 ? (
            <div className="empty">No venues here.</div>
          ) : null}
          {all !== null && !err && list.length > 0 ? (
            <div className="grid" id="grid">
              {visible.map((v) => (
                <Link key={v.id} className="vcard" to="/venue" search={{ id: v.id }} {...intentWarm(() => { if (v.image) warmImage(v.image); const lg = v.teams[0]?.logo; if (lg) warmImage(lg) })}>
                  <div className={'photo' + (v.image ? ' has-img' : ' vphoto')} style={v.image ? { backgroundImage: `url('${cardImg(v.image)}')` } : undefined}>
                    {!v.image ? (
                      <div className="vlogos">
                        {uniqTeams(v).slice(0, 4).map((t) => (t.logo ? <img key={t.id} className="vlogo" src={t.logo} alt={t.displayName} loading="lazy" decoding="async" /> : null))}
                      </div>
                    ) : null}
                    <span className="role">{leagueTags(v)}</span>
                    {v.city ? <span className="citytag">{v.city}</span> : null}
                    {v.image ? (
                      <span className="vlogo-badge">
                        {uniqTeams(v).slice(0, 3).map((t) => (t.logo ? <img key={t.id} src={t.logo} alt={t.displayName} loading="lazy" /> : null))}
                      </span>
                    ) : null}
                  </div>
                  <div className="body">
                    <div className="name">{v.name}</div>
                    <div className="meta">{uniqTeams(v).map((t) => t.displayName).join(' · ')}</div>
                  </div>
                </Link>
              ))}
            </div>
          ) : null}
          {all !== null && !err && list.length > shown ? (
            <div className="loadmore-row">
              <button className="pill loadmore" onClick={() => setShown((n) => n + PAGE * 2)}>
                Show more · {list.length - shown} left
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <footer>
        <div className="container">© 2026 Snapback Sports — Venues. <Link to="/">← Experiences</Link></div>
      </footer>
    </>
  )
}
