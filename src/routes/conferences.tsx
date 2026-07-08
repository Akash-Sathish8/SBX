import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteNav } from '../components/SiteNav'
import { PageCssGuard } from '../components/PageCssGuard'
import { getJSON } from '../lib/dataCache'
import css from '../pages/conferences.css?url'

// Every NCAA D1 conference + its schools, by sport. Football = FBS (incl. Notre
// Dame under "FBS Independents"); Basketball = all D1 men's. Data is sourced from
// ESPN via the ingest — nothing is hand-typed.
type CollegeLeague = 'college-football' | 'college-basketball'
interface ConfTeam { id: string; abbr: string; displayName: string; location: string; logo?: string }
interface Conference { id: string; name: string; shortName?: string; teams: ConfTeam[] }

export const Route = createFileRoute('/conferences')({
  head: () => ({
    links: [{ rel: 'stylesheet', href: css, 'data-page-css': 'conferences' }],
    meta: [{ title: 'Snapback — College Conferences' }],
  }),
  component: ConferencesPage,
})

const TABS: { key: CollegeLeague; label: string }[] = [
  { key: 'college-football', label: 'Football · FBS' },
  { key: 'college-basketball', label: 'Basketball' },
]

function ConferencesPage() {
  const [league, setLeague] = useState<CollegeLeague>('college-football')
  const [data, setData] = useState<Conference[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    let alive = true
    setData(null); setErr(null)
    getJSON<{ ok: boolean; data: Conference[] }>('/api/conferences?league=' + league)
      .then((r) => { if (alive) setData(Array.isArray(r?.data) ? r.data : []) })
      .catch(() => { if (alive) setErr("Couldn't load conferences.") })
    return () => { alive = false }
  }, [league])

  // Filter: a conference matches by its name (keep all its schools) or by any
  // school name (keep just the matches).
  const list = useMemo(() => {
    if (!data) return []
    const needle = q.trim().toLowerCase()
    if (!needle) return data
    return data
      .map((c) => {
        if ((c.name + ' ' + (c.shortName || '')).toLowerCase().includes(needle)) return c
        return { ...c, teams: c.teams.filter((t) => (t.displayName + ' ' + t.location + ' ' + t.abbr).toLowerCase().includes(needle)) }
      })
      .filter((c) => c.teams.length)
  }, [data, q])

  const totalSchools = useMemo(() => (data ? data.reduce((s, c) => s + c.teams.length, 0) : 0), [data])

  return (
    <>
      <PageCssGuard id="conferences" />
      <SiteNav />
      <section className="chead">
        <div className="container">
          <div className="eyebrow">NCAA Division I</div>
          <h1>Every <span className="hl">conference</span></h1>
          <p className="csub">
            Every D1 {league === 'college-football' ? 'FBS football' : "men's basketball"} conference and the
            schools in it{data ? ` · ${data.length} conferences · ${totalSchools} schools` : ''}.
          </p>
          <div className="ctabs">
            {TABS.map((t) => (
              <button key={t.key} className={'ctab' + (t.key === league ? ' on' : '')} onClick={() => { setLeague(t.key); setQ('') }}>{t.label}</button>
            ))}
          </div>
          <label className="csearch">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a school or conference…" aria-label="Search schools or conferences" />
          </label>
        </div>
      </section>

      <section className="cblock">
        <div className="container">
          {data === null && !err ? <div className="cloading">Loading conferences…</div> : null}
          {err ? <div className="cempty">{err}</div> : null}
          {data !== null && !err ? (
            list.length ? (
              list.map((c) => (
                <div key={c.id} className="conf">
                  <div className="conf-h">
                    <h2>{c.name}</h2>
                    <span className="conf-n">{c.teams.length}</span>
                  </div>
                  <div className="schools">
                    {c.teams.map((t) => (
                      <div key={t.id} className="school">
                        {t.logo ? <img className="school-logo" src={t.logo} alt="" width={34} height={34} loading="lazy" /> : <span className="school-logo ph" aria-hidden="true" />}
                        <span className="school-name">{t.displayName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="cempty">No matches for “{q.trim()}”.</div>
            )
          ) : null}
        </div>
      </section>

      <footer><div className="container">© 2026 Snapback Sports — College conferences. <Link to="/">← Home</Link></div></footer>
    </>
  )
}
