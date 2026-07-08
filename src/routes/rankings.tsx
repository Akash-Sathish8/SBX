import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteNav } from '../components/SiteNav'
import { PageCssGuard } from '../components/PageCssGuard'
import { getJSON } from '../lib/dataCache'
import type { Experience } from '../lib/experiences'
import { collectionBySlug } from '../lib/collections'
import css from '../pages/rankings.css?url'

// Expert-rated US sports experiences (built from public/data/experiences.csv via
// scripts/build-experiences.mjs — non-US dropped, re-ranked #1..N by final score).
interface ExpData {
  count: number
  sports: string[]
  experiences: Experience[]
}

export const Route = createFileRoute('/rankings')({
  // ?collection=<slug> filters to an editorial collection (deep-linked from the
  // explore home); ?q= pre-fills the search (deep-linked from search results).
  validateSearch: (s: Record<string, unknown>) => {
    const out: { collection?: string; q?: string } = {}
    if (typeof s.collection === 'string' && collectionBySlug(s.collection)) out.collection = s.collection
    if (s.q != null && String(s.q).trim()) out.q = String(s.q)
    return out
  },
  head: () => ({
    links: [{ rel: 'stylesheet', href: css, 'data-page-css': 'rankings' }],
    meta: [{ title: 'Snapback — Experience Rankings' }],
  }),
  component: Rankings,
})

const f1 = (n: number) => n.toFixed(1)

function Rankings() {
  const { collection: colSlug, q: qParam } = Route.useSearch()
  const col = colSlug ? collectionBySlug(colSlug) : undefined
  const [data, setData] = useState<ExpData | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [q, setQ] = useState(qParam ?? '')
  const [sport, setSport] = useState('All Sports')

  // Deep-linked search (?q= from home search results) wins over stale local state.
  useEffect(() => { if (qParam != null) setQ(qParam) }, [qParam])

  useEffect(() => {
    let alive = true
    getJSON<ExpData>('/data/experiences.json')
      .then((d) => { if (alive) setData(d) })
      .catch(() => { if (alive) setErr("Couldn't load rankings.") })
    return () => { alive = false }
  }, [])

  const list = useMemo(() => {
    if (!data) return []
    const base = col ? col.pick(data.experiences) : data.experiences
    const needle = q.trim().toLowerCase()
    return base.filter((e) => {
      if (sport !== 'All Sports' && e.sport !== sport) return false
      if (needle && !`${e.name} ${e.location} ${e.sport}`.toLowerCase().includes(needle)) return false
      return true
    })
  }, [data, q, sport, col])

  return (
    <>
      <PageCssGuard id="rankings" />
      <SiteNav />
      <section className="rhead">
        <div className="container">
          <div className="eyebrow">Expert-rated · {data ? data.count : '—'} US experiences</div>
          <h1>Our best <span className="hl">experiences</span></h1>
          {col ? (
            <div className="colchip">
              Collection: <b>{col.title}</b>
              <Link to="/rankings" search={{}} aria-label="Clear collection" className="colx">✕</Link>
            </div>
          ) : null}
          <p className="sub">
            Every US sports experience, ranked. Scored by our experts on fans, food,
            uniqueness, and the stadium itself. Been to one? <Link to="/rank" className="logcta">Log a game →</Link>
          </p>
          <div className="controls">
            <label className="search">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search teams, cities, or names…"
                aria-label="Search experiences"
              />
            </label>
            <select value={sport} onChange={(e) => setSport(e.target.value)} aria-label="Filter by sport">
              {(data ? data.sports : ['All Sports']).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="rblock">
        <div className="container">
          {data === null && !err ? <div className="loading">Loading rankings…</div> : null}
          {err ? <div className="empty">{err}</div> : null}
          {data !== null && !err ? (
            <>
              <p className="rcount">{list.length} {list.length === 1 ? 'experience' : 'experiences'}{sport !== 'All Sports' ? ` · ${sport}` : ''}</p>
              <div className="rtable-wrap">
                <table className="rtable">
                  <thead>
                    <tr>
                      <th className="l">Rank</th>
                      <th className="l">Experience</th>
                      <th className="l">Location</th>
                      <th className="l">Sport</th>
                      <th>Fans</th>
                      <th>Food</th>
                      <th>Unique</th>
                      <th>Stadium</th>
                      <th>Final Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((e) => (
                      <tr key={e.rank}>
                        <td className="l"><span className="rnum">#{e.rank}</span></td>
                        <td className="l c-name">{e.name}</td>
                        <td className="l c-loc">{e.location}</td>
                        <td className="l"><span className="sporttag">{e.sport}</span></td>
                        <td>{f1(e.fans)}</td>
                        <td>{f1(e.food)}</td>
                        <td>{f1(e.unique)}</td>
                        <td>{f1(e.stadium)}</td>
                        <td><span className="finalscore">{f1(e.final)}</span></td>
                      </tr>
                    ))}
                    {list.length === 0 ? <tr><td colSpan={9} className="empty">No experiences match your search.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      </section>

      <footer>
        <div className="container">© 2026 Snapback Sports — Experience Rankings. <Link to="/">← Home</Link></div>
      </footer>
    </>
  )
}
