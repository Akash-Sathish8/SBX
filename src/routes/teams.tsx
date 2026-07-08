import { useState, useMemo } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteNav } from '../components/SiteNav'
import TEAMS_DATA from '../../data/teams.json'
import type { Teams, Team, League } from '../lib/data-types'

const TEAMS = TEAMS_DATA as Teams

export const Route = createFileRoute('/teams')({
  validateSearch: (s: Record<string, unknown>) => ({
    league: (s.league as string) ?? 'NFL',
  }),
  head: () => ({
    meta: [{ title: 'Snapback — Teams' }],
  }),
  component: TeamsPage,
})

const PRO_LEAGUES: League[] = ['NFL', 'MLB', 'NBA', 'NHL']
const COLLEGE_LEAGUES: League[] = ['CFB', 'CBB']

function TeamCard({ team }: { team: Team }) {
  return (
    <Link
      to="/team/$id"
      params={{ id: team.id }}
      className="no-underline group"
    >
      <div
        className="flex flex-col items-center gap-2 p-4 bg-white border-[3px] border-[#222] shadow-[4px_4px_0_#222] rounded-[6px] [transition:transform_.1s,box-shadow_.1s] hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_#222]"
        style={{ borderTopColor: team.primary_color }}
      >
        <img
          src={team.logo_url}
          alt={team.name}
          width={64}
          height={64}
          className="w-16 h-16 object-contain"
          loading="lazy"
        />
        <div className="text-center">
          <div className="font-display text-[13px] tracking-[0.5px] uppercase text-ink leading-tight">{team.abbr}</div>
          <div className="font-body text-[11px] text-[#555] leading-tight mt-0.5">{team.city}</div>
        </div>
      </div>
    </Link>
  )
}

function groupByConference(teams: Team[]): Record<string, Team[]> {
  return teams.reduce<Record<string, Team[]>>((acc, t) => {
    const key = t.conference || 'Independent'
    ;(acc[key] ??= []).push(t)
    return acc
  }, {})
}

function TeamsPage() {
  const { league } = Route.useSearch()
  const [search, setSearch] = useState('')

  const isCollege = COLLEGE_LEAGUES.includes(league as League)
  const allTeams: Team[] = (TEAMS[league as keyof Teams] ?? [])
  const filtered = useMemo(() =>
    search.trim()
      ? allTeams.filter(t =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.city.toLowerCase().includes(search.toLowerCase()) ||
          t.abbr.toLowerCase().includes(search.toLowerCase())
        )
      : allTeams,
    [allTeams, search]
  )

  const grouped = useMemo(() =>
    isCollege ? groupByConference(filtered) : null,
    [isCollege, filtered]
  )

  return (
    <>
      <SiteNav active="teams" />

      <section className="grid-overlay bg-[#222] text-white pt-[44px] pb-[38px] relative overflow-hidden">
        <div className="container relative z-[1] max-w-[1180px] mx-auto px-[28px]">
          <div className="eyebrow inline-flex items-center gap-[9px] font-bold text-[13px] tracking-[1.4px] uppercase text-ink bg-brand-yellow px-[13px] py-[6px] rounded-[3px] shadow-[4px_4px_0_#000] mb-[14px]">
            Field Guide · Teams
          </div>
          <h1 className="font-display uppercase text-white tracking-[1px] leading-none text-[clamp(44px,6.4vw,84px)]">
            <span className="hl bg-brand-yellow text-ink px-[10px] shadow-[5px_5px_0_#000] inline-block">Teams</span>
          </h1>

          {/* League selector */}
          <div className="flex gap-3 flex-wrap mt-6">
            {[...PRO_LEAGUES, ...COLLEGE_LEAGUES].map(l => (
              <Link
                key={l}
                to="/teams"
                search={{ league: l }}
                className={`inline-flex items-center border-[3px] border-[#222] rounded-[6px] shadow-[4px_4px_0_#222] px-[14px] py-[8px] font-body font-bold text-[13px] uppercase tracking-[0.4px] no-underline [transition:transform_.1s,box-shadow_.1s,background_.12s] hover:-translate-x-px hover:-translate-y-px hover:shadow-[5px_5px_0_#222] ${l === league ? 'bg-brand-yellow text-ink' : 'bg-white text-ink'}`}
              >
                {l}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-[46px] bg-[#f4f4f4]">
        <div className="container max-w-[1180px] mx-auto px-[28px]">
          {/* Search */}
          <div className="mb-6">
            <input
              type="search"
              placeholder={`Search ${league} teams...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full max-w-[400px] border-[3px] border-[#222] rounded-[6px] shadow-[4px_4px_0_#222] px-4 py-3 font-body text-[15px] bg-white outline-none focus:shadow-[6px_6px_0_#222] [transition:box-shadow_.1s]"
            />
          </div>

          {/* Pro: flat grid */}
          {!isCollege && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-4">
              {filtered.map(t => <TeamCard key={t.id} team={t} />)}
            </div>
          )}

          {/* College: conference-grouped grids */}
          {isCollege && grouped && Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([conf, teams]) => (
            <div key={conf} className="mb-10">
              <h2 className="font-display text-[20px] uppercase tracking-[1px] mb-4 pb-2 border-b-[3px] border-brand-yellow inline-block">{conf}</h2>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-4">
                {teams.map(t => <TeamCard key={t.id} team={t} />)}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <p className="text-[#666] font-body text-[16px]">No teams match "{search}"</p>
          )}
        </div>
      </section>

      <footer className="bg-black text-[#888] py-[40px] text-[13px]">
        <div className="container max-w-[1180px] mx-auto px-[28px]">
          © 2025 Snapback Sports — Field Guide. <Link to="/" className="text-brand-yellow font-bold">← Home</Link>
        </div>
      </footer>
    </>
  )
}
