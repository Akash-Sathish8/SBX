import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteNav } from '../components/SiteNav'
import { PageCssGuard } from '../components/PageCssGuard'
import css from '../pages/index.css?url'

export const Route = createFileRoute('/')({
  head: () => ({
    links: [{ rel: 'stylesheet', href: css, 'data-page-css': 'home' }],
    meta: [{ title: 'Snapback Experiences' }],
  }),
  component: Home,
})

// Rotating hero stadium: photo + fan comment + ranking (ported from index.html script).
// Slide 0 mirrors the original page's hand-set initial markup (quote + bar widths).
type Det = [string, number, number] // [label, value, width%]
type Slide = {
  img: string; av: string; nm: string; mt: string; stars: number; q: string
  cc: string; cv: string; crit: number; fan: number; det: Det[]
}
const slides: Slide[] = [
  { img: '/img/stadiums/sofi.jpg', av: 'C', nm: 'Casey M.', mt: 'SoFi · USA vs PAR', stars: 5,
    q: '"Loudest 90 minutes of my life. Get there early, the food court by section 130 is unreal."',
    cc: 'Los Angeles · USA', cv: 'SoFi Stadium', crit: 84, fan: 90,
    det: [['Atmosphere', 9, 92], ['Food', 8, 84], ['Parking', 6, 58]] },
  { img: '/img/stadiums/azteca.jpg', av: 'D', nm: 'Diego M.', mt: 'Azteca · Opening match', stars: 5,
    q: '"History you can feel. The altitude is no joke — pace yourself."',
    cc: 'Mexico City · MEX', cv: 'Estadio Azteca', crit: 95, fan: 71,
    det: [['Atmosphere', 10, 100], ['History', 10, 100], ['Altitude', 4, 40]] },
  { img: '/img/stadiums/arrowhead.jpg', av: 'J', nm: 'Jordan P.', mt: 'Arrowhead · ARG vs ALG', stars: 4,
    q: '"Tailgate is the whole event. Lot G fills by 9am — get there early."',
    cc: 'Kansas City · USA', cv: 'Arrowhead Stadium', crit: 92, fan: 88,
    det: [['Atmosphere', 10, 100], ['Tailgate', 9, 90], ['Parking', 7, 70]] },
  { img: '/img/stadiums/metlife.jpg', av: 'L', nm: 'Leo R.', mt: 'MetLife · The Final', stars: 4,
    q: '"It hosts the final, enough said. Take the train, do not drive."',
    cc: 'New York · USA', cv: 'MetLife Stadium', crit: 79, fan: 74,
    det: [['Atmosphere', 7, 70], ['Transit', 6, 60], ['Big stage', 10, 100]] },
  { img: '/img/stadiums/bcplace.jpg', av: 'P', nm: 'Priya N.', mt: 'BC Place · CAN vs QAT', stars: 4,
    q: '"Roof open, lakeside walk in. Best night of the whole trip."',
    cc: 'Vancouver · CAN', cv: 'BC Place', crit: 82, fan: 80,
    det: [['Atmosphere', 8, 80], ['Food', 7, 70], ['Getting in', 8, 80]] },
]

type Card = { img: string; tag: string; name: string; sub: string; crit: number; fan: number }
const MARQUEE: Card[] = [
  { img: 'sofi', tag: 'Los Angeles · USA', name: 'SoFi Stadium', sub: 'The spaceship', crit: 84, fan: 90 },
  { img: 'arrowhead', tag: 'Kansas City · USA', name: 'Arrowhead Stadium', sub: 'Loudest in the world', crit: 92, fan: 88 },
  { img: 'azteca', tag: 'Mexico City · MEX', name: 'Estadio Azteca', sub: 'History at altitude', crit: 95, fan: 71 },
  { img: 'mercedes', tag: 'Atlanta · USA', name: 'Mercedes-Benz Stadium', sub: 'The halo roof', crit: 90, fan: 79 },
  { img: 'metlife', tag: 'New York · USA', name: 'MetLife Stadium', sub: 'Hosts the final', crit: 79, fan: 74 },
  { img: 'bcplace', tag: 'Vancouver · CAN', name: 'BC Place', sub: 'Roof on the water', crit: 82, fan: 80 },
  { img: 'att', tag: 'Dallas · USA', name: 'AT&T Stadium', sub: 'Jerry World', crit: 88, fan: 85 },
  { img: 'nrg', tag: 'Houston · USA', name: 'NRG Stadium', sub: 'Retractable in Texas', crit: 80, fan: 76 },
  { img: 'hardrock', tag: 'Miami · USA', name: 'Hard Rock Stadium', sub: 'Miami nights', crit: 83, fan: 81 },
  { img: 'linc', tag: 'Philadelphia · USA', name: 'Lincoln Financial Field', sub: 'The Linc', crit: 85, fan: 87 },
  { img: 'levis', tag: 'San Francisco · USA', name: "Levi's Stadium", sub: 'Silicon Valley bowl', crit: 78, fan: 72 },
  { img: 'lumen', tag: 'Seattle · USA', name: 'Lumen Field', sub: 'Wall of sound', crit: 88, fan: 85 },
  { img: 'gillette', tag: 'Boston · USA', name: 'Gillette Stadium', sub: 'New England fortress', crit: 81, fan: 77 },
  { img: 'bmo', tag: 'Toronto · CAN', name: 'BMO Field', sub: "Toronto's lakeside", crit: 80, fan: 83 },
  { img: 'akron', tag: 'Guadalajara · MEX', name: 'Estadio Akron', sub: "Guadalajara's jewel", crit: 86, fan: 82 },
  { img: 'bbva', tag: 'Monterrey · MEX', name: 'Estadio BBVA', sub: 'El Gigante de Acero', crit: 89, fan: 84 },
]

function MarqueeCard({ c, hidden }: { c: Card; hidden?: boolean }) {
  return (
    <Link
      to="/venue"
      search={{ id: c.img }}
      className="card venue interactive"
      aria-hidden={hidden ? 'true' : undefined}
      tabIndex={hidden ? -1 : undefined}
    >
      <div className="photo" style={{ backgroundImage: `url('/img/stadiums/${c.img}.jpg')` }}><span className="tag">{c.tag}</span></div>
      <div className="body">
        <h4>{c.name}</h4>
        <div className="city">{c.sub}</div>
        <div className="scores">
          <div className="score crit"><div className="v">{c.crit}</div><div className="k">Critics</div></div>
          <div className="score fan"><div className="v">{c.fan}</div><div className="k">Fans</div></div>
        </div>
      </div>
    </Link>
  )
}

// Matchday agenda mockups, dealt like a hand of playing cards. Each card carries a
// playing-card rank (A/K/Q/J/10 + ball suit); every card opens the match-guide builder.
type AgendaRow = [string, string, string] // [glyph, section label, sample plan]
type AgendaMock = { game: string; rank: string; match: string; venue: string; when: string; rows: AgendaRow[] }
const AGENDAS: AgendaMock[] = [
  { game: 'azteca-jun11', rank: 'K', match: 'MEX v RSA', venue: 'Estadio Azteca · Mexico City', when: 'Jun 11 · 1:00 PM', rows: [
    ['🚆', 'Getting there', 'Tren Ligero, Azteca stop'],
    ['🍺', 'Before the match', 'Tacos in Coyoacán'],
    ['🍔', 'Eat inside', 'Churros + michelada'],
    ['🧢', 'Merch', 'El Tri home jersey'],
    ['🏁', 'After the whistle', 'Mariachi in Garibaldi'],
  ] },
  { game: 'metlife-jun13', rank: 'Q', match: 'BRA v MAR', venue: 'MetLife Stadium · New York', when: 'Jun 13 · 6:00 PM', rows: [
    ['🚆', 'Getting there', 'NJ Transit from Penn'],
    ['🍺', 'Before the match', 'Samba in the lots'],
    ['🍔', 'Eat inside', 'Pretzel + cold lager'],
    ['🧢', 'Merch', "Seleção '26 kit"],
    ['🏁', 'After the whistle', 'Train back to Manhattan'],
  ] },
  { game: 'sofi-jun12', rank: 'A', match: 'USA v PAR', venue: 'SoFi Stadium · Los Angeles', when: 'Jun 12 · 6:00 PM', rows: [
    ['🚆', 'Getting there', 'Metro K + SoFi shuttle'],
    ['🍺', 'Before the match', 'Tailgate on Lot K'],
    ['🍔', 'Eat inside', 'Food court, section 130'],
    ['🧢', 'Merch', 'USA scarf, south shop'],
    ['🏁', 'After the whistle', 'Lake Park fan fest'],
  ] },
  { game: 'arrowhead-jun16', rank: 'J', match: 'ARG v ALG', venue: 'Arrowhead Stadium · Kansas City', when: 'Jun 16 · 8:00 PM', rows: [
    ['🚆', 'Getting there', 'Drive in, Lot G by 9am'],
    ['🍺', 'Before the match', 'BBQ tailgate till kickoff'],
    ['🍔', 'Eat inside', 'Burnt ends, section 132'],
    ['🧢', 'Merch', 'Albiceleste flag'],
    ['🏁', 'After the whistle', 'Power & Light party'],
  ] },
  { game: 'bcplace-jun18', rank: '10', match: 'CAN v QAT', venue: 'BC Place · Vancouver', when: 'Jun 18 · 3:00 PM', rows: [
    ['🚆', 'Getting there', 'SkyTrain to Chinatown'],
    ['🍺', 'Before the match', 'Seawall walk to the gates'],
    ['🍔', 'Eat inside', 'Japadog on the concourse'],
    ['🧢', 'Merch', 'Maple leaf scarf'],
    ['🏁', 'After the whistle', 'Gastown patios'],
  ] },
]

function AgendaCard({ a }: { a: AgendaMock }) {
  return (
    <Link to="/guide" className="acard">
      <span className="acorner tl" aria-hidden="true"><b>{a.rank}</b><i>⚽</i></span>
      <span className="acorner br" aria-hidden="true"><b>{a.rank}</b><i>⚽</i></span>
      <span className="acard-hd">
        <span className="acard-match">{a.match}</span>
        <span className="acard-meta">{a.venue}</span>
        <span className="acard-meta">{a.when}</span>
      </span>
      <span className="acard-rows">
        {a.rows.map(([ic, label, val], i) => (
          <span className="acard-row" key={i}>
            <span className="ai"><i>{ic}</i></span>
            <span className="at"><b>{label}</b><span>{val}</span></span>
          </span>
        ))}
      </span>
      <span className="acard-ft">Snapback · Matchday Agenda</span>
    </Link>
  )
}

function Home() {
  const [dotI, setDotI] = useState(0)
  const [contentI, setContentI] = useState(0)
  const [vis, setVis] = useState(1)

  useEffect(() => {
    let fadeT: ReturnType<typeof setTimeout> | undefined
    const id = setInterval(() => {
      setDotI((prev) => {
        const next = (prev + 1) % slides.length
        setVis(0)
        fadeT = setTimeout(() => { setContentI(next); setVis(1) }, 470)
        return next
      })
    }, 4000)
    return () => { clearInterval(id); if (fadeT) clearTimeout(fadeT) }
  }, [])

  const cur = slides[contentI]
  const fadeStyle = { transition: 'opacity .45s ease', opacity: vis } as const

  return (
    <>
      <PageCssGuard id="home" />
      <SiteNav />

      {/* HERO (concept A: split / share + compare) */}
      <section className="a-hero">
        <div className="a-left grid-bg">
          <div className="reveal" style={{ animationDelay: '.05s' }}>
            <span className="eyebrow">World Cup 2026 · 16 venues</span>
            <h1><span className="ln">Build your</span> <span className="hl">matchday</span></h1>
          </div>
          <div className="reveal" style={{ animationDelay: '.12s' }}>
            <div className="a-quick">
              <Link to="/guide" className="a-quick-item"><span className="a-quick-ic"><span className="a-quick-gl">🚆</span></span><span className="a-quick-lb">Getting there</span></Link>
              <Link to="/guide" className="a-quick-item"><span className="a-quick-ic"><span className="a-quick-gl">🍺</span></span><span className="a-quick-lb">Before the match</span></Link>
              <Link to="/guide" className="a-quick-item"><span className="a-quick-ic"><span className="a-quick-gl">🍔</span></span><span className="a-quick-lb">Where to eat</span></Link>
              <Link to="/guide" className="a-quick-item"><span className="a-quick-ic"><span className="a-quick-gl">🏁</span></span><span className="a-quick-lb">After the whistle</span></Link>
            </div>
          </div>
          <div className="reveal" style={{ animationDelay: '.2s' }}>
            <div className="a-cta">
              <Link to="/guide" className="btn btn-brand btn-xl">Build your match guide</Link>
              <Link to="/casey" className="btn btn-dark btn-xl">See what Casey did</Link>
            </div>
          </div>
        </div>
        <div className="a-right">
          <div className="img" style={{ backgroundImage: `url('${cur.img}')`, ...fadeStyle }}></div>
          <div className="a-dots">
            {[0, 1, 2, 3, 4].map((k) => <span key={k} className={k === dotI ? 'on' : undefined}></span>)}
          </div>
          <div className="a-post fanpost" style={fadeStyle}>
            <div className="hd"><div className="avatar">{cur.av}</div><div><div className="nm">{cur.nm}</div><div className="mt">{cur.mt}</div></div></div>
            <div className="stars">{[0, 1, 2, 3, 4].map((k) => <span key={k} className={k < cur.stars ? undefined : 'e'}>★</span>)}</div>
            <div className="q" style={{ marginTop: '6px' }}>{cur.q}</div>
            <span className="wasthere">✓ Was there</span>
          </div>
          <div className="a-venue on-dark" style={fadeStyle}>
            <div className="cc">{cur.cc}</div>
            <div className="cv">{cur.cv}</div>
            <div className="scorechip">
              <div className="s crit"><div className="v">{cur.crit}</div><div className="k">Critics</div></div>
              <div className="s fan"><div className="v">{cur.fan}</div><div className="k">Fans</div></div>
            </div>
            {cur.det.map(([label, , w], k) => (
              <div key={k} className="detrow"><span className="dl">{label}</span><span className="db"><i style={{ width: w + '%' }}></i></span><span className="dv">{cur.det[k][1]}</span></div>
            ))}
          </div>
        </div>
      </section>

      {/* BROWSE VENUES (scrollable marquee on the black band) */}
      <section id="experiences" className="browse-band">
        <div className="container">
          <div className="rail-hint"><span className="rail-count">Browse venues</span></div>
        </div>
        <div className="marquee">
          <div className="marquee-track">
            {MARQUEE.map((c, i) => <MarqueeCard key={'a' + i} c={c} />)}
            {MARQUEE.map((c, i) => <MarqueeCard key={'b' + i} c={c} hidden />)}
          </div>
        </div>
      </section>

      {/* GET YOUR MATCHDAY AGENDA */}
      <section id="agendas" className="sec-light grid-bg">
        <div className="container">
          <div className="sec-head">
            <span className="eyebrow">Plan it · Share it</span>
            <h2>Get your matchday agenda</h2>
            <p>Your whole day on one card — how you're getting there, where you're drinking, what you're eating, where it ends. Pick a match and deal yourself in.</p>
          </div>
          <div className="agenda-fan">
            {AGENDAS.map((a) => <AgendaCard key={a.game} a={a} />)}
          </div>
          <div className="agenda-cta">
            <Link to="/guide" className="btn btn-brand btn-lg">Build your agenda</Link>
          </div>
        </div>
      </section>

      <footer>
        <div className="container">
          <div className="logo"><img className="logo-img" src="/img/logo.png" alt="Snapback Sports" width={42} height={42} />SNAPBACK<span className="wc">WC 2026</span></div>
          <div className="fnav">
            <a href="#experiences">Experiences</a>
            <Link to="/guide">Guide</Link>
          </div>
        </div>
      </footer>
    </>
  )
}
