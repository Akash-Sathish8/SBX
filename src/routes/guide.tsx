import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteNav } from '../components/SiteNav'
import { PageCssGuard } from '../components/PageCssGuard'
import css from '../pages/guide.css?url'

export const Route = createFileRoute('/guide')({
  head: () => ({
    links: [{ rel: 'stylesheet', href: css, 'data-page-css': 'guide' }],
    meta: [{ title: 'Snapback — Build your gameday guide' }],
  }),
  component: Guide,
})

function Guide() {
  return (
    <>
      <PageCssGuard id="guide" />
      <SiteNav active="guide" />
      <section className="head">
        <div className="container">
          <div className="eyebrow">Let's go</div>
          <h1>Build your <span className="hl">gameday guide</span></h1>
        </div>
      </section>

      <section className="block">
        <div className="container">
          <div className="choices">
            <Link className="choice venue" to="/build" search={{ game: '', mode: 'venue' }}>
              <div className="top solidtop">
                <span className="num">01</span><span className="lbl">Every home ground</span>
              </div>
              <div className="body">
                <div className="t">Start with a venue</div>
                <div className="x">Pick any NFL, NBA or MLB venue, then choose a game there<span className="xtra"> and build a plan around it</span>.</div>
                <span className="go">Choose a venue →</span>
              </div>
            </Link>
            <Link className="choice game" to="/build" search={{ game: '', mode: 'matchup' }}>
              <div className="top solidtop alt">
                <span className="num">02</span><span className="lbl">Every game</span>
              </div>
              <div className="body">
                <div className="t">Pick a specific game</div>
                <div className="x">Jump straight to any game on the schedule<span className="xtra">, then build a shareable gameday plan for it</span>.</div>
                <span className="go">Choose a game →</span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      <footer>
        <div className="container">© 2026 Snapback Sports. <Link to="/">← Home</Link></div>
      </footer>
    </>
  )
}
