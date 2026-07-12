import { useEffect, useMemo, useState } from 'react'
import { container } from '../lib/ui'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { SiteNav } from '../components/SiteNav'
import { PageCssGuard } from '../components/PageCssGuard'
import { getJSON, intentWarm, warmImage } from '../lib/dataCache'
import { SPORTS, LEAGUES, COLLEGE_LEAGUES, HERO_LEAGUE, isCollegeLeague, isLeague, type League } from '../lib/sports'
import type { TeamInfo } from '../lib/espn'

// The sport/team browser — axis 1 of the explore loop. Pro leagues render a flat
// logo grid (/api/teams); college leagues render conference-grouped grids
// (/api/conferences). Every card lands on /team. `?league=` deep-links a sport
// (the home page's Pick-your-sport chips).

export const Route = createFileRoute('/teams')({
  validateSearch: (s: Record<string, unknown>) => ({
    league: isLeague(s.league as string) ? (s.league as League) : undefined,
  }),
  head: () => ({
    meta: [{ title: 'Snapback · Teams' }],
  }),
  component: Teams,
})

interface ConfTeam { id: string; abbr: string; displayName: string; location: string; logo?: string }
interface Conf { id: string; name: string; shortName?: string; teams: ConfTeam[] }

// .container — shared page gutter

function TeamCard({ league, t }: { league: League; t: { id: string; abbr: string; displayName: string; location?: string; logo?: string } }) {
  const warm = () => { if (t.logo) warmImage(t.logo) }
  return (
    <Link
      to="/team"
      search={{ league, id: t.id }}
      className="flex min-w-0 cursor-pointer items-center gap-3 rounded-lg border-[3px] border-ink-soft bg-white px-[14px] py-3 shadow-[5px_5px_0_0_#222222] [transition:box-shadow_.15s,transform_.12s] hover:shadow-[8px_8px_0_0_#f7df02] hover:transform-[translate(-1px,-1px)] max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-2 max-[640px]:px-3"
      {...intentWarm(warm)}
    >
      {t.logo
        ? <img src={t.logo} alt="" width={44} height={44} loading="lazy" className="h-11 w-11 flex-none object-contain" />
        : <span className="flex h-11 w-11 flex-none items-center justify-center rounded-lg bg-ink-soft font-[family-name:Anton] text-[13px] text-brand">{t.abbr.slice(0, 3)}</span>}
      <span className="min-w-0 text-[15px] font-extrabold leading-[1.15] text-ink-soft max-[640px]:text-[13.5px]">{t.displayName}</span>
      <span className="ml-auto font-display text-[17px] text-[#111] max-[640px]:hidden">→</span>
    </Link>
  )
}

function Teams() {
  const { league: leagueParam } = Route.useSearch()
  const [league, setLeague] = useState<League>(leagueParam ?? HERO_LEAGUE)
  // Deep link (?league=) wins when it changes under a mounted component.
  useEffect(() => { if (leagueParam) setLeague(leagueParam) }, [leagueParam])
  const [teams, setTeams] = useState<TeamInfo[] | null>(null)
  const [confs, setConfs] = useState<Conf[] | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let alive = true
    setTeams(null); setConfs(null); setErrMsg(null)
    if (isCollegeLeague(league)) {
      getJSON('/api/conferences?league=' + league)
        .then((r: any) => { if (alive) setConfs(Array.isArray(r?.data) ? r.data : []) })
        .catch(() => { if (alive) setErrMsg("Couldn't load conferences.") })
    } else {
      getJSON('/api/teams?league=' + league)
        .then((r: any) => { if (alive) setTeams(Array.isArray(r?.data) ? r.data : []) })
        .catch(() => { if (alive) setErrMsg("Couldn't load teams.") })
    }
    return () => { alive = false }
  }, [league])

  const q = query.trim().toLowerCase()
  const match = (t: { displayName: string; location?: string; abbr: string }) =>
    !q || `${t.displayName} ${t.location ?? ''} ${t.abbr}`.toLowerCase().includes(q)

  const proList = useMemo(() => (teams ? teams.filter(match) : []), [teams, q])
  const confList = useMemo(
    () => (confs ? confs.map((c) => ({ ...c, teams: c.teams.filter(match) })).filter((c) => c.teams.length) : []),
    [confs, q],
  )
  const loading = teams === null && confs === null && !errMsg

  return (
    <div className="min-h-screen bg-[#f4f4f4] font-sans text-[#33352f]">
      <PageCssGuard id="teams" />
      <SiteNav active="teams" />
      <section className="relative overflow-hidden bg-ink-soft pb-[38px] pt-[44px] text-white after:pointer-events-none after:absolute after:inset-0 after:content-[''] after:[background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] after:[background-size:32px_32px]">
        <div className={cn(container, 'relative z-[1]')}>
          <Link to="/" className="mb-[14px] inline-flex items-center gap-[6px] text-[13px] font-bold uppercase tracking-[.5px] text-[#cfcfcf]! transition-colors hover:text-brand!">← Back</Link>
          <h1 className="font-display text-[clamp(30px,6.4vw,84px)] uppercase leading-none tracking-[1px] text-white max-[600px]:text-[clamp(28px,9vw,40px)] max-[600px]:leading-[1.04]">Pick your <span className="inline-block bg-brand px-[10px] text-[#111] shadow-[5px_5px_0_#000]">team</span></h1>
        </div>
      </section>

      <section className="pb-[46px] pt-[38px]">
        <div className={container}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-[10px] max-[640px]:-mx-[28px] max-[640px]:w-[calc(100%+56px)] max-[640px]:flex-nowrap max-[640px]:snap-x max-[640px]:snap-proximity max-[640px]:gap-2 max-[640px]:overflow-x-auto max-[640px]:px-[28px] max-[640px]:py-1 max-[640px]:[-webkit-overflow-scrolling:touch] max-[640px]:[scrollbar-width:none] max-[640px]:[&::-webkit-scrollbar]:hidden">
              {[...LEAGUES, ...COLLEGE_LEAGUES].map((l) => (
                <Button
                  key={l}
                  type="button"
                  variant="outline"
                  aria-pressed={l === league}
                  onClick={() => setLeague(l)}
                  className={cn(
                    'h-auto cursor-pointer rounded-none border-2 border-[#111] bg-white px-[14px] py-2 text-[13px] font-bold uppercase leading-[1.5] tracking-[.4px] text-[#111] shadow-none hover:bg-white hover:text-[#111] max-[640px]:flex-none max-[640px]:snap-start',
                    l === league && 'bg-brand hover:bg-brand',
                  )}
                >
                  {SPORTS[l].label}
                </Button>
              ))}
            </div>
            <div className="flex min-w-[260px] items-center gap-[9px] rounded-md border-[3px] border-ink-soft bg-white px-[14px] py-[9px] shadow-[4px_4px_0_0_#222222] max-[600px]:w-full max-[600px]:min-w-0">
              <SearchIcon className="h-4 w-4 flex-none text-ink-soft opacity-70" />
              <Input
                type="search"
                placeholder="Search teams…"
                autoComplete="off"
                aria-label="Search teams"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-auto rounded-none border-0 p-0 font-semibold text-ink-soft shadow-none placeholder:font-medium placeholder:text-[#9a9a9a] focus-visible:ring-0 md:text-base"
              />
            </div>
          </div>

          {loading ? <div className="py-10 font-semibold text-muted">Loading teams…</div> : null}
          {errMsg ? <div className="px-[2px] py-[18px] text-[15px] text-muted">{errMsg}</div> : null}

          {teams !== null ? (
            proList.length
              ? <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-[13px] max-[640px]:grid-cols-[1fr_1fr] max-[640px]:gap-[10px]">{proList.map((t) => <TeamCard key={t.id} league={league} t={t} />)}</div>
              : <div className="px-[2px] py-[18px] text-[15px] text-muted">No {SPORTS[league].label} teams{q ? ` for “${query.trim()}”` : ''}.</div>
          ) : null}

          {confs !== null ? (
            confList.length ? (
              confList.map((c) => (
                <section key={c.id} className="mt-[30px]">
                  <div className="mb-3 flex items-baseline gap-3 border-b-[3px] border-[#141414] pb-2">
                    <h2 className="font-display text-[21px] uppercase leading-none tracking-[1px] text-ink-soft">{c.name}</h2>
                    <span className="text-[13px] font-bold text-muted">{c.teams.length} {c.teams.length === 1 ? 'school' : 'schools'}</span>
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-[13px] max-[640px]:grid-cols-[1fr_1fr] max-[640px]:gap-[10px]">{c.teams.map((t) => <TeamCard key={t.id} league={league} t={t} />)}</div>
                </section>
              ))
            ) : <div className="px-[2px] py-[18px] text-[15px] text-muted">No {SPORTS[league].label} schools{q ? ` for “${query.trim()}”` : ''}.</div>
          ) : null}
        </div>
      </section>

      <footer className="mt-[26px] bg-black py-10 text-[13px] text-[#888]">
        <div className={container}>© 2026 Snapback Sports. <Link to="/" className="font-bold text-brand!">← Explore</Link></div>
      </footer>
    </div>
  )
}
