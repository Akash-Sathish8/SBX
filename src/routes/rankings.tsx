import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteNav } from '../components/SiteNav'
import { PageCssGuard } from '../components/PageCssGuard'
import { getJSON, warmImage } from '../lib/dataCache'
import type { Experience } from '../lib/experiences'
import { expImage } from '../lib/experiences'
import type { Venue } from '../lib/espn'
import { collectionBySlug } from '../lib/collections'
import { matchVenueForExperience } from '../lib/experienceMatch'
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
    meta: [{ title: 'Snapback · Experience Rankings' }],
  }),
  component: Rankings,
})

const f1 = (n: number) => n.toFixed(1)

const PILLARS = [
  { key: 'fans', label: 'Fans & atmosphere' },
  { key: 'food', label: 'Food & drink' },
  { key: 'unique', label: 'Uniqueness' },
  { key: 'stadium', label: 'The stadium' },
] as const

function Rankings() {
  const { collection: colSlug, q: qParam } = Route.useSearch()
  const col = colSlug ? collectionBySlug(colSlug) : undefined
  const [data, setData] = useState<ExpData | null>(null)
  const [venues, setVenues] = useState<Venue[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [q, setQ] = useState(qParam ?? '')
  const [sport, setSport] = useState('All Sports')
  // Spotlight selection (by rank). Falls back to the first visible row whenever
  // the current pick is filtered out.
  const [selRank, setSelRank] = useState<number | null>(null)

  // Deep-linked search (?q= from home search results) wins over stale local state.
  useEffect(() => { if (qParam != null) setQ(qParam) }, [qParam])

  useEffect(() => {
    let alive = true
    getJSON<ExpData>('/data/experiences.json')
      .then((d) => { if (alive) setData(d) })
      .catch(() => { if (alive) setErr("Couldn't load rankings.") })
    getJSON('/api/venues')
      .then((r: any) => { if (alive) setVenues(Array.isArray(r?.data) ? r.data : []) })
      .catch(() => {})
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

  const sel = useMemo(
    () => list.find((e) => e.rank === selRank) ?? list[0] ?? null,
    [list, selRank],
  )
  const selVenue = useMemo(() => (sel ? matchVenueForExperience(sel.name, venues) : null), [sel, venues])
  const selImage = sel ? (sel.image ?? expImage(sel.name, venues)) : undefined
  useEffect(() => { if (selImage) warmImage(selImage) }, [selImage])

  return (
    <>
      <PageCssGuard id="rankings" />
      <SiteNav />
      <section className="rhead">
        <div className="container">
          <div className="eyebrow">Expert-rated · {data ? data.count : '–'} US experiences</div>
          <h1>Our best experiences</h1>
          {col ? (
            <div className="colchip">
              Collection: <b>{col.title}</b>
              <Link to="/rankings" search={{}} aria-label="Clear collection" className="colx">✕</Link>
            </div>
          ) : null}
          <p className="sub">
            <Link to="/rank" className="logcta">Log a game →</Link>
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
              {list.length === 0 ? <div className="empty">No experiences match your search.</div> : (
                <div className="splitr">
                  {/* Leaderboard — hover or tap a row to load it into the spotlight */}
                  <div className="lb" role="listbox" aria-label="Experience rankings">
                    {list.map((e) => (
                      <button
                        key={e.rank}
                        type="button"
                        role="option"
                        aria-selected={sel?.rank === e.rank}
                        className={'lb-row' + (sel?.rank === e.rank ? ' on' : '')}
                        onClick={() => setSelRank(e.rank)}
                        onMouseEnter={() => setSelRank(e.rank)}
                      >
                        <span className="lb-rk">#{e.rank}</span>
                        <span className="lb-txt">
                          <span className="lb-nm">{e.name}</span>
                          <span className="lb-city">{e.location}</span>
                        </span>
                        <span className="lb-score">{f1(e.final)}</span>
                      </button>
                    ))}
                  </div>

                  {/* Spotlight — the selected experience with its venue photo */}
                  {sel ? (
                    <div className="detail">
                      {selImage
                        ? <img src={selImage} alt={sel.name} />
                        : <div className="detail-noimg" aria-hidden="true" />}
                      <div className="detail-body">
                        <div className="detail-nm">{sel.name}</div>
                        <div className="detail-meta">
                          #{sel.rank} in America · {sel.location} · {sel.sport}
                          {selVenue ? <> · {selVenue.name}</> : null}
                        </div>
                        {PILLARS.map((p) => (
                          <div key={p.key} className="bar">
                            <div className="bar-lab"><span>{p.label}</span><span>{f1(sel[p.key])}</span></div>
                            <div className="bar-tr"><i style={{ width: `${sel[p.key] * 10}%` }} /></div>
                          </div>
                        ))}
                        {selVenue ? (
                          <Link to="/venue" search={{ id: selVenue.id }} className="detail-cta">Plan this trip →</Link>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </>
          ) : null}
        </div>
      </section>

      <footer>
        <div className="container">© 2026 Snapback Sports · Experience Rankings. <Link to="/">← Home</Link></div>
      </footer>
    </>
  )
}
