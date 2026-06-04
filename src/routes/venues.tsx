import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteNav } from '../components/SiteNav'
import css from '../pages/venues.css?url'

export const Route = createFileRoute('/venues')({
  head: () => ({
    links: [{ rel: 'stylesheet', href: css }],
    meta: [{ title: 'Snapback — World Cup Venues' }],
  }),
  component: Venues,
})

const FL: Record<string, string> = { USA: '🇺🇸', CAN: '🇨🇦', MEX: '🇲🇽' }

type Venue = { img: string; name: string; city: string; cc: string; role: string }
const VENUES: Venue[] = [
  { img: 'azteca', name: 'Estadio Azteca', city: 'Mexico City', cc: 'MEX', role: 'Opening Match' },
  { img: 'metlife', name: 'MetLife Stadium', city: 'New York / NJ', cc: 'USA', role: 'Final' },
  { img: 'att', name: 'AT&T Stadium', city: 'Dallas', cc: 'USA', role: 'Semifinal' },
  { img: 'mercedes', name: 'Mercedes-Benz Stadium', city: 'Atlanta', cc: 'USA', role: 'Semifinal' },
  { img: 'hardrock', name: 'Hard Rock Stadium', city: 'Miami', cc: 'USA', role: 'Third place' },
  { img: 'sofi', name: 'SoFi Stadium', city: 'Los Angeles', cc: 'USA', role: '' },
  { img: 'nrg', name: 'NRG Stadium', city: 'Houston', cc: 'USA', role: '' },
  { img: 'arrowhead', name: 'Arrowhead Stadium', city: 'Kansas City', cc: 'USA', role: '' },
  { img: 'linc', name: 'Lincoln Financial Field', city: 'Philadelphia', cc: 'USA', role: '' },
  { img: 'levis', name: "Levi's Stadium", city: 'San Francisco Bay', cc: 'USA', role: '' },
  { img: 'lumen', name: 'Lumen Field', city: 'Seattle', cc: 'USA', role: '' },
  { img: 'gillette', name: 'Gillette Stadium', city: 'Boston', cc: 'USA', role: '' },
  { img: 'bcplace', name: 'BC Place', city: 'Vancouver', cc: 'CAN', role: '' },
  { img: 'bmo', name: 'BMO Field', city: 'Toronto', cc: 'CAN', role: '' },
  { img: 'akron', name: 'Estadio Akron', city: 'Guadalajara', cc: 'MEX', role: '' },
  { img: 'bbva', name: 'Estadio BBVA', city: 'Monterrey', cc: 'MEX', role: '' },
]

function Venues() {
  const [filter, setFilter] = useState('all')
  const list = VENUES.filter((v) => filter === 'all' || v.cc === filter)
  const pill = (cc: string) => 'pill' + (filter === cc ? ' on' : '')
  return (
    <>
      <SiteNav active="venues" />
      <section className="head">
        <div className="container">
          <div className="eyebrow">16 stadiums · 3 nations · 1 tournament</div>
          <h1>Every World Cup <span className="hl">venue</span></h1>
          <p className="sub">All 16 host stadiums for FIFA World Cup 2026 across the USA, Canada and Mexico.</p>
          <div className="tally" id="tally">
            <button className={pill('all')} onClick={() => setFilter('all')}><b>16</b> Stadiums</button>
            <button className={pill('USA')} onClick={() => setFilter('USA')}><b>11</b> 🇺🇸 USA</button>
            <button className={pill('MEX')} onClick={() => setFilter('MEX')}><b>3</b> 🇲🇽 Mexico</button>
            <button className={pill('CAN')} onClick={() => setFilter('CAN')}><b>2</b> 🇨🇦 Canada</button>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="container">
          <div className="grid" id="grid">
            {list.map((v) => (
              <Link key={v.img} className="vcard" to="/venue" search={{ id: v.img }}>
                <div className="photo" style={{ backgroundImage: `url('/img/stadiums/${v.img}.jpg')` }}>
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
