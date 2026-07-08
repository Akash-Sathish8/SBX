import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { PageCssGuard } from '../components/PageCssGuard'
import { SiteNav } from '../components/SiteNav'
import { SearchBox } from '../components/SearchBox'
import { getJSON, getJSONFresh, intentWarm, warmImage } from '../lib/dataCache'
import { SPORTS, LEAGUES, COLLEGE_LEAGUES, type League } from '../lib/sports'
import { cardImg } from '../lib/img'
import type { Game, Venue } from '../lib/espn'
import { expImage, type Experience } from '../lib/experiences'
import { COLLECTIONS } from '../lib/collections'
import css from '../pages/home.css?url'
import searchCss from '../pages/searchbox.css?url'

// The explore home, TICKET STUB edition — discovery starts at pixel one. A
// poster hero (FIELD GUIDE question + search) docks bottom-left on the crowd
// photo with the four explore doors as mini tickets, then the page is
// inventory: tonight's games as perforated ticket stubs, ranked experiences as
// ADMIT ONE cards, venues as photo tickets. Every card is a real D1 /
// experiences.json row; numbers are computed or omitted while loading.
export const Route = createFileRoute('/')({
  head: () => ({
    links: [
      { rel: 'stylesheet', href: css, 'data-page-css': 'home' },
      { rel: 'stylesheet', href: searchCss, 'data-page-css': 'home venues' },
    ],
    meta: [{ title: 'Snapback — Where does gameday take you?' }],
  }),
  component: Home,
})

// Real local assets (checked into public/img) — no hotlinked or invented photos.
const HERO_IMG = '/img/celebration2.jpg'

const LEAGUE_LINE = [...LEAGUES, ...COLLEGE_LEAGUES].map((l) => SPORTS[l].label)

// Iconic parks lead the venue rail when present; the rest fills from any pro
// venue that has a photo. (Editorial ordering over real rows, not invented data.)
const ICONIC = ['Fenway Park', 'Wrigley Field', 'Dodger Stadium', 'Yankee Stadium', 'Oracle Park', 'Coors Field', 'Truist Park', 'Citizens Bank Park']

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
// The ticket stub carries the when: big line (time / LIVE / FINAL) over a small
// qualifier (meridiem + weekday for non-today games, inning detail while live).
function stubWhen(g: Game): { big: string; small: string } {
  if (g.state === 'in') return { big: 'LIVE', small: g.detail || '' }
  if (g.state === 'post') return { big: 'FINAL', small: '' }
  const d = new Date(g.date)
  if (isNaN(d.getTime())) return { big: '', small: '' }
  const [big, mer = ''] = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).split(' ')
  const day = d.toDateString() === new Date().toDateString() ? '' : ` ${WD[d.getDay()]}`
  return { big, small: (mer + day).trim() }
}

function GameCard({ g }: { g: Game }) {
  const live = g.state === 'in'
  const done = g.state === 'post'
  const score = (live || done) && g.home.score !== null && g.away.score !== null
  const { big, small } = stubWhen(g)
  const warm = () => { if (g.home.logo) warmImage(g.home.logo); if (g.away.logo) warmImage(g.away.logo) }
  return (
    <Link to="/game" search={{ id: g.id, league: g.league }} className="ticket" {...intentWarm(warm)}>
      <span className="stub">
        <b className={'stub-lg' + (live ? ' live' : '')}>{SPORTS[g.league].label}</b>
        <span className="stub-time">
          <b className={'num' + (live ? ' live' : '')}>{big}</b>
          {small ? <span>{small}</span> : null}
        </span>
      </span>
      <span className="tk-main">
        <span className="tk-match">
          {g.away.logo ? <img src={g.away.logo} alt="" width={26} height={26} loading="lazy" /> : null}
          <span className="abbr">{g.away.abbr}</span>
          {score ? <i className="tk-score">{g.away.score}–{g.home.score}</i> : <i className="at">@</i>}
          <span className="abbr">{g.home.abbr}</span>
          {g.home.logo ? <img src={g.home.logo} alt="" width={26} height={26} loading="lazy" /> : null}
        </span>
        <span className="tk-venue">{g.venue.name}{g.venue.city ? ', ' + g.venue.city : ''}</span>
      </span>
    </Link>
  )
}

function Home() {
  const [exps, setExps] = useState<Experience[] | null>(null)
  const [venues, setVenues] = useState<Venue[] | null>(null)
  const [games, setGames] = useState<Game[] | null>(null)

  useEffect(() => {
    let alive = true
    const applyGames = (r: any) => { if (alive) setGames(Array.isArray(r?.data) ? r.data : []) }
    getJSON('/api/games').then(applyGames).catch(() => { if (alive) setGames([]) })
    getJSON('/api/venues')
      .then((r: any) => { if (alive) setVenues(Array.isArray(r?.data) ? r.data : []) })
      .catch(() => { if (alive) setVenues([]) })
    getJSON('/data/experiences.json')
      .then((r: any) => { if (alive) setExps(Array.isArray(r?.experiences) ? r.experiences : []) })
      .catch(() => { if (alive) setExps([]) })
    // Live games drift; refresh while the tab is visible (server overlays live
    // scores on /api/games, s-maxage=20). Venues/experiences are static.
    const iv = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      getJSONFresh('/api/games').then(applyGames).catch(() => { /* keep prior data */ })
    }, 25000)
    return () => { alive = false; clearInterval(iv) }
  }, [])

  // Tonight's slate: live first, then next up — the rail you can graze now.
  const slate = useMemo(() => {
    if (!games) return null
    const order = (x: Game) => (x.state === 'in' ? 0 : x.state === 'pre' ? 1 : 2)
    return [...games].sort((a, b) => order(a) - order(b) || a.date.localeCompare(b.date)).slice(0, 12)
  }, [games])

  // 7 + the collection card = a clean 4×2 ADMIT ONE grid on desktop.
  const topExps = useMemo(
    () => (exps ? exps.slice(0, 7).map((e) => ({ ...e, image: e.image ?? expImage(e.name, venues ?? []) })) : null),
    [exps, venues],
  )

  const venueRail = useMemo(() => {
    if (!venues) return null
    const byName = new Map(venues.map((v) => [v.name, v]))
    const iconic = ICONIC.map((n) => byName.get(n)).filter((v): v is Venue => !!v && !!v.image)
    const rest = venues.filter((v) => v.image && !ICONIC.includes(v.name) && v.teams.some((t) => LEAGUES.includes(t.league)))
    return [...iconic, ...rest].slice(0, 10)
  }, [venues])

  const col = COLLECTIONS[0]

  return (
    <>
      <PageCssGuard id="home" />
      <SiteNav active="home" />

      {/* Poster hero: copy docked bottom-left (never floating centered), doors as mini tickets */}
      <section className="fg-hero">
        <div className="bg" style={{ backgroundImage: `url('${HERO_IMG}')` }} />
        <div className="shade" />
        <div className="container">
          <div className="fg-copy">
            <span className="fg-kick">The fan's field guide</span>
            <h1>Where does <span className="hl">gameday</span> take&nbsp;you?</h1>
            <SearchBox />
            <div className="doors">
              <Link to="/teams" search={{ league: undefined }} className="door"><span className="door-stub"><b>Explore</b></span><span className="door-main"><span className="door-label">By sport &amp; team</span><span className="door-count">Browse leagues</span></span></Link>
              <Link to="/weekend" className="door"><span className="door-stub"><b>Explore</b></span><span className="door-main"><span className="door-label">This weekend</span><span className="door-count">Upcoming slate</span></span></Link>
              <Link to="/venues" className="door"><span className="door-stub"><b>Explore</b></span><span className="door-main"><span className="door-label">By venue</span><span className="door-count num">{venues?.length ? `${venues.length} venues` : 'The buildings'}</span></span></Link>
              <Link to="/rankings" className="door"><span className="door-stub"><b>Explore</b></span><span className="door-main"><span className="door-label">Top ranked</span><span className="door-count num">{exps?.length ? `${exps.length} experiences` : 'The expert list'}</span></span></Link>
            </div>
          </div>
        </div>
      </section>

      {/* Rail 1 — tonight's slate as perforated ticket stubs (live first, real scores) */}
      <section className="hsec">
        <div className="container">
          <div className="sec">
            <div className="sec-left"><span className="sec-eye">Live &amp; next up</span><h2>On the slate</h2></div>
            <Link to="/weekend" className="tchip">This weekend →</Link>
          </div>
        </div>
        {slate === null ? <div className="container"><div className="hload">Loading games…</div></div> : null}
        {slate && slate.length ? (
          <div className="hrail">{slate.map((g) => <GameCard key={g.league + ':' + g.id} g={g} />)}</div>
        ) : null}
        {slate && !slate.length ? <div className="container"><div className="hload">Nothing on right now. <Link to="/games" className="hlink">Browse the schedule →</Link></div></div> : null}
      </section>

      {/* Rail 2 — top-ranked experiences as ADMIT ONE cards (collection card leads) */}
      <section className="hsec">
        <div className="container">
          <div className="sec">
            <div className="sec-left"><span className="sec-eye">{exps?.length ? `${exps.length} ranked experiences` : 'Expert rankings'}</span><h2>Top ranked in America</h2></div>
            <Link to="/rankings" className="tchip">Full rankings →</Link>
          </div>
        </div>
        {topExps ? (
          <div className="hrail rank-grid">
            <Link to="/rankings" search={{ collection: col.slug }} className="rank-card no-img">
              <span className="admit"><b>Collection</b><span>→</span></span>
              <span className="rank-body">
                <span className="rank-name">{col.title}</span>
                <span className="rank-score">The collection →</span>
              </span>
            </Link>
            {topExps.map((e) => (
              <Link key={e.rank} to="/rankings" search={{ q: e.name }} className={'rank-card' + (e.image ? '' : ' no-img')}>
                <span className="admit"><b>Admit One</b><span className="num">№ {e.rank}</span></span>
                {e.image ? <span className="rank-photo"><img src={cardImg(e.image)} alt="" loading="lazy" /></span> : null}
                <span className="rank-body">
                  <span className="rank-name">{e.name}</span>
                  <span className="rank-loc">{e.location}{e.sport ? ' · ' + e.sport : ''}</span>
                  <span className="rank-score num">{e.final.toFixed(2)} expert score</span>
                </span>
              </Link>
            ))}
          </div>
        ) : <div className="container"><div className="hload">Loading rankings…</div></div>}
      </section>

      {/* Rail 3 — iconic buildings as photo tickets (caption on the stub, not the photo) */}
      <section className="hsec">
        <div className="container">
          <div className="sec">
            <div className="sec-left"><span className="sec-eye">{venues?.length ? `${venues.length} venues` : 'The buildings'}</span><h2>Iconic buildings</h2></div>
            <Link to="/venues" className="tchip">All venues →</Link>
          </div>
        </div>
        {venueRail ? (
          <div className="hrail">
            {venueRail.map((v) => (
              <Link key={v.id} to="/venue" search={{ id: v.id }} className="venue" {...intentWarm(() => { const s = cardImg(v.image); if (s) warmImage(s) })}>
                <img src={cardImg(v.image)} alt="" loading="lazy" />
                <span className="venue-body"><span className="venue-name">{v.name}</span><span className="venue-city">{[v.city, v.state].filter(Boolean).join(', ')}</span></span>
              </Link>
            ))}
          </div>
        ) : <div className="container"><div className="hload">Loading venues…</div></div>}
      </section>

      {/* Sport pivot — one tap re-aims the whole app at your league */}
      <section className="hsec">
        <div className="container">
          <div className="sec">
            <div className="sec-left"><span className="sec-eye">Browse the leagues</span><h2>Pick your sport</h2></div>
          </div>
          <div className="sportrow">
            {[...LEAGUES, ...COLLEGE_LEAGUES].map((l) => (
              <Link key={l} to="/teams" search={{ league: l }} className="spchip" style={{ ['--acc' as any]: SPORTS[l].accent }}><i /><span>{SPORTS[l].label}</span></Link>
            ))}
          </div>
        </div>
      </section>

      <div className="statbar">
        <div className="container">
          <p>
            {exps?.length ? <span className="num"><b>{exps.length}</b> ranked experiences</span> : null}
            {exps?.length && venues?.length ? <i>·</i> : null}
            {venues?.length ? <span className="num"><b>{venues.length}</b> venues</span> : null}
            {(exps?.length || venues?.length) ? <i>·</i> : null}
            <span>{LEAGUE_LINE.join(' · ')}</span>
          </p>
        </div>
      </div>

      <footer><div className="container">© 2026 Snapback Sports. <Link to="/games">Games</Link> · <Link to="/venues">Venues</Link> · <Link to="/rankings">Rankings</Link></div></footer>
    </>
  )
}
