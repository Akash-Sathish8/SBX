import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteNav } from '../components/SiteNav'
import css from '../pages/guide.css?url'

export const Route = createFileRoute('/guide')({
  head: () => ({
    links: [{ rel: 'stylesheet', href: css }],
    meta: [{ title: 'Snapback — Build your match guide' }],
  }),
  component: Guide,
})

const MOSAIC = ['metlife', 'azteca', 'att', 'sofi', 'mercedes', 'hardrock', 'bcplace', 'nrg', 'lumen', 'arrowhead', 'linc', 'bmo', 'levis', 'gillette', 'akron', 'bbva']

function Guide() {
  return (
    <>
      <SiteNav active="guide" />
      <section className="head">
        <div className="container">
          <div className="eyebrow">Let's go</div>
          <h1>Build your <span className="hl">match guide</span></h1>
        </div>
      </section>

      <section className="block">
        <div className="container">
          <div className="choices">
            <Link className="choice venue" to="/venues">
              <div className="top mosaic" id="mosaic">
                {MOSAIC.map((id) => (
                  <div key={id} className="tile" style={{ backgroundImage: `url('/img/stadiums/${id}.jpg')` }}></div>
                ))}
                <span className="num">01</span><span className="lbl">16 venues</span>
              </div>
              <div className="body">
                <div className="t">Start with a venue</div>
                <div className="x">Explore all 16 host stadiums across the USA, Mexico and Canada. Get the full fan guide for each — how to get in, what's around, and the stories in the walls.</div>
                <span className="go">Browse venues →</span>
              </div>
            </Link>
            <Link className="choice game" to="/games">
              <div className="top collage" id="gtop">
                <div className="ctile" style={{ backgroundImage: "url('/img/celebration.jpg')", backgroundPosition: 'center 42%' }}></div>
                <div className="ctile" style={{ backgroundImage: "url('/img/celebration2.jpg')", backgroundPosition: 'center 35%' }}></div>
                <span className="num">02</span><span className="lbl">Every match</span>
              </div>
              <div className="body">
                <div className="t">Pick a specific game</div>
                <div className="x">Browse every World Cup 2026 fixture, live from Ticketmaster. Find your match, the venue and city, and tap straight through to tickets.</div>
                <span className="go">Browse games →</span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      <footer>
        <div className="container">© 2026 Snapback Sports — World Cup 2026. <Link to="/">← Home</Link></div>
      </footer>
    </>
  )
}
