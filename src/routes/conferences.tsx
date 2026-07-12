import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteNav } from '../components/SiteNav'
import { PageCssGuard } from '../components/PageCssGuard'
import { getJSON } from '../lib/dataCache'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// Every NCAA D1 conference + its schools, by sport. Football = FBS (incl. Notre
// Dame under "FBS Independents"); Basketball = all D1 men's. Data is sourced from
// ESPN via the ingest — nothing is hand-typed.
type CollegeLeague = 'college-football' | 'college-basketball'
interface ConfTeam { id: string; abbr: string; displayName: string; location: string; logo?: string }
interface Conference { id: string; name: string; shortName?: string; teams: ConfTeam[] }

export const Route = createFileRoute('/conferences')({
  head: () => ({
    meta: [{ title: 'Snapback · College Conferences' }],
  }),
  component: ConferencesPage,
})

const TABS: { key: CollegeLeague; label: string }[] = [
  { key: 'college-football', label: 'Football · FBS' },
  { key: 'college-basketball', label: 'Basketball' },
]

// .container — full-width shell with the clamped gutters every section shares.
const container = 'mx-auto px-[clamp(28px,4vw,72px)]'

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
    <div className="min-h-screen bg-[#f4f4f4] font-sans text-[#33352f]">
      <PageCssGuard id="conferences" />
      <SiteNav />
      <section className="relative overflow-hidden bg-ink-soft pt-10 pb-[30px] text-white after:pointer-events-none after:absolute after:inset-0 after:content-[''] after:bg-[linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] after:bg-size-[32px_32px]">
        <div className={cn(container, 'relative z-[1]')}>
          <div className="mb-3.5 inline-flex items-center gap-[9px] rounded-[3px] bg-brand px-[13px] py-1.5 text-[12px] font-bold tracking-[1.2px] uppercase text-[#111] shadow-[4px_4px_0_#000]">NCAA Division I</div>
          <h1 className="font-display text-[clamp(30px,6vw,60px)] leading-none tracking-[1px] uppercase text-white">Every <span className="inline-block bg-brand px-2.5 text-[#111] shadow-[5px_5px_0_#000]">conference</span></h1>
          <p className="mt-3.5 max-w-[64ch] text-[16px] leading-[1.5] text-[#d6d6d6]">
            Every D1 {league === 'college-football' ? 'FBS football' : "men's basketball"} conference and the
            schools in it{data ? ` · ${data.length} conferences · ${totalSchools} schools` : ''}.
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            {TABS.map((t) => (
              <Button
                key={t.key}
                type="button"
                variant="outline"
                aria-pressed={t.key === league}
                className={cn(
                  'h-auto rounded-md border-2 px-[18px] py-[9px] text-[13px] font-extrabold tracking-[.4px] uppercase shadow-none',
                  t.key === league
                    ? 'border-brand bg-brand text-[#111] hover:bg-brand hover:text-[#111]'
                    : 'border-white bg-transparent text-white hover:bg-transparent hover:text-white',
                )}
                onClick={() => { setLeague(t.key); setQ('') }}
              >
                {t.label}
              </Button>
            ))}
          </div>
          <Label className="mt-[18px] flex max-w-[440px] items-center gap-[9px] rounded-md border-[3px] border-black bg-white px-3.5 py-[9px] shadow-[4px_4px_0_0_#000]">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 flex-none fill-none stroke-ink-soft stroke-2 opacity-70"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search a school or conference…"
              aria-label="Search schools or conferences"
              className="h-auto rounded-none border-0 bg-transparent p-0 text-[16px] font-semibold text-ink-soft shadow-none placeholder:font-medium placeholder:text-[#9a9a9a] focus-visible:border-0 focus-visible:ring-0 md:text-[16px]"
            />
          </Label>
        </div>
      </section>

      <section className="pt-[34px] pb-16">
        <div className={container}>
          {data === null && !err ? <div className="px-[2px] py-6 text-[15px] font-semibold text-muted">Loading conferences…</div> : null}
          {err ? <div className="px-[2px] py-6 text-[15px] font-semibold text-muted">{err}</div> : null}
          {data !== null && !err ? (
            list.length ? (
              list.map((c) => (
                <div key={c.id} className="mb-[30px]">
                  <div className="mb-3.5 flex items-center gap-3 border-b-[3px] border-ink-soft pb-2">
                    <h2 className="font-display text-2xl leading-none tracking-[1px] uppercase text-ink-soft">{c.name}</h2>
                    <Badge className="rounded-[20px] border-2 border-[#111] bg-brand px-[11px] py-0.5 text-[13px] font-extrabold text-[#111]">{c.teams.length}</Badge>
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2.5">
                    {c.teams.map((t) => (
                      <div key={t.id} className="flex items-center gap-[11px] rounded-lg border-[2.5px] border-ink-soft bg-white px-3 py-2.5 shadow-[4px_4px_0_0_#222] transition-[box-shadow,transform] duration-[120ms] ease-[ease] hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_0_#f7df02]">
                        {t.logo ? <img className="h-[34px] w-[34px] flex-none object-contain" src={t.logo} alt="" width={34} height={34} loading="lazy" /> : <span className="h-[34px] w-[34px] flex-none rounded-full bg-[#eee]" aria-hidden="true" />}
                        <span className="text-[14px] leading-[1.15] font-extrabold text-ink-soft">{t.displayName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-[2px] py-6 text-[15px] font-semibold text-muted">No matches for “{q.trim()}”.</div>
            )
          ) : null}
        </div>
      </section>

      <footer className="bg-black py-[34px] text-[13px] text-[#888]"><div className={container}>© 2026 Snapback Sports · College conferences. <Link to="/" className="font-bold text-brand!">← Home</Link></div></footer>
    </div>
  )
}
