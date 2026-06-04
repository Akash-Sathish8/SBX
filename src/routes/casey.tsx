import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteNav } from '../components/SiteNav'
import css from '../pages/casey.css?url'

export const Route = createFileRoute('/casey')({
  head: () => ({
    links: [{ rel: 'stylesheet', href: css }],
    meta: [{ title: 'Snapback — Casey' }],
  }),
  component: Casey,
})

function Casey() {
  return (
    <>
      <SiteNav active="casey" />
      <main>
        <div className="casey">
          <span className="eye">Coming soon</span>
          <h1>Casey</h1>
          <p>Something's brewing here.</p>
        </div>
      </main>
      <footer>
        <div className="container">© 2026 Snapback Sports — World Cup 2026. <Link to="/">← Home</Link></div>
      </footer>
    </>
  )
}
