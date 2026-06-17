import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteNav } from '../components/SiteNav'
import { PageCssGuard } from '../components/PageCssGuard'
import { warmImage, intentWarm } from '../lib/dataCache'
import { VENUES, venueNationCounts } from '../lib/venues-meta'
import css from '../pages/venues.css?url'

export const Route = createFileRoute('/venues')({
  head: () => ({
    links: [{ rel: 'stylesheet', href: css, 'data-page-css': 'venues' }],
    meta: [{ title: 'Snapback — World Cup Venues' }],
  }),
  component: Venues,
})

const FL: Record<string, string> = { USA: '🇺🇸', CAN: '🇨🇦', MEX: '🇲🇽' }
const NATION: Record<string, string> = { USA: 'USA', CAN: 'Canada', MEX: 'Mexico' }

function Venues() {
  const [filter, setFilter] = useState('all')
  const list = VENUES.filter((v) => filter === 'all' || v.cc === filter)
  const pill = (cc: string) => 'pill' + (filter === cc ? ' on' : '')
  return (
    <>
      <PageCssGuard id="venues" />
      <SiteNav active="venues" />
      <section className="head">
        <div className="container">
          <div className="eyebrow">{VENUES.length} stadiums · {venueNationCounts().length} nations · 1 tournament</div>
          <h1>Every World Cup <span className="hl">venue</span></h1>
          <p className="sub">All 16 host stadiums for FIFA World Cup 2026 across the USA, Canada and Mexico.</p>
          <div className="tally" id="tally">
            <button className={pill('all')} onClick={() => setFilter('all')}><b>{VENUES.length}</b> Stadiums</button>
            {venueNationCounts().map(({ cc, n }) => (
              <button key={cc} className={pill(cc)} onClick={() => setFilter(cc)}><b>{n}</b> {FL[cc]} {NATION[cc]}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="block">
        <div className="container">
          <div className="grid" id="grid">
            {list.map((v) => (
              <Link key={v.img} className="vcard" to="/venue/$id" params={{ id: v.img }} {...intentWarm(() => warmImage(`/img/stadiums/${v.img}.jpg`))}>
                <div className="photo">
                  <img className="photo-img" src={`/img/stadiums/${v.img}.jpg`} alt="" loading="lazy" decoding="async" />
                  <span className="citytag"><span className="flag">{FL[v.cc]}</span>{v.city}</span>
                  {v.role ? <span className="role">{v.role}</span> : null}
                </div>
                <div className="body">
                  <div className="name">{v.name}</div>
                  <div className="meta">{v.city} · {v.cc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <footer>
        <div className="container">© 2026 Snapback Sports — World Cup Venues. <Link to="/">← Experiences</Link></div>
      </footer>
    </>
  )
}
