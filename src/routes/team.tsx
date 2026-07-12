import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { SiteNav } from '../components/SiteNav'
import { PageCssGuard } from '../components/PageCssGuard'
import { GameRow } from '../components/GameRow'
import { getJSON, warmImage } from '../lib/dataCache'
import { SPORTS, isLeague, type League } from '../lib/sports'
import type { TeamInfo, Venue, Game } from '../lib/espn'
import type { Experience } from '../lib/experiences'
import { matchExperienceForVenue, matchExperienceForTeam } from '../lib/experienceMatch'

// Team page — the fandom axis: one team's home venue, upcoming games and ranked
// experience. Everything real: teams/venues/games from D1, experience from
// experiences.json via the shared matcher; unmatched sections are omitted.

export const Route = createFileRoute('/team')({
  // Coerce to string like /venue: numeric ids arrive as numbers from the parser.
  validateSearch: (s: Record<string, unknown>) => ({
    league: s.league != null ? String(s.league) : '',
    id: s.id != null ? String(s.id) : '',
  }),
  head: () => ({
    links: [],
    meta: [{ title: 'Snapback · Team' }],
  }),
  component: TeamPage,
})

const todayIso = () => new Date().toISOString().slice(0, 10)

// .container — shared page gutter
const container = 'mx-auto px-[clamp(28px,4vw,72px)]'
// .ulink / .empty a — yellow-underlined emphasis link
const ulink = 'border-b-2 border-brand font-extrabold'
// .loadwrap — centered full-page status text
const loadwrap = 'px-[28px] py-20 text-center font-semibold text-muted'
// .pill — hero eyebrow chips (Badge overrides keep the exact legacy geometry)
const pill = 'whitespace-normal rounded-[4px] border-0 bg-brand px-[10px] py-[5px] text-[11px] font-extrabold uppercase tracking-[.8px] text-[#111] shadow-[3px_3px_0_rgba(0,0,0,.4)]'
// .eyebrow — yellow section label
const eyebrow = 'mb-4 gap-[9px] whitespace-normal rounded-[3px] border-0 bg-brand px-3 py-[5px] text-[12px] font-bold uppercase tracking-[1.4px] text-[#111] shadow-[4px_4px_0_#000]'
// .hopcard — dark next-hop card (home venue / snapback score)
const hopcard = 'relative flex min-h-[150px] items-end overflow-hidden rounded-[10px] border-[3px] border-ink-soft bg-ink-soft text-white! shadow-[6px_6px_0_0_#222222] [transition:box-shadow_.15s,transform_.12s] hover:shadow-[9px_9px_0_0_#f7df02] hover:transform-[translate(-1px,-1px)]'
// .hopcard .lab — small yellow label line
const hoplab = 'flex items-center gap-[7px] text-[11px] font-extrabold uppercase tracking-[.8px] text-brand'
// .hopcard .sub — muted footnote line
const hopsub = 'mt-1 text-[12.5px] font-semibold text-[#d9d9d0]'

function TeamPage() {
  const { league: rawLeague, id: rawId } = Route.useSearch()
  const league = isLeague(rawLeague) ? (rawLeague as League) : null
  const id = (rawId || '').replace(/[^a-z0-9_-]/gi, '')
  const [team, setTeam] = useState<TeamInfo | null | undefined>(undefined)
  const [venue, setVenue] = useState<Venue | null | undefined>(undefined)
  const [games, setGames] = useState<Game[] | null>(null)
  const [exps, setExps] = useState<Experience[] | null>(null)

  useEffect(() => {
    if (!league || !id) return
    let alive = true
    setTeam(undefined); setVenue(undefined); setGames(null)
    getJSON('/api/teams?league=' + league)
      .then((r: any) => {
        const t = (Array.isArray(r?.data) ? r.data : []).find((x: TeamInfo) => x.id === id) ?? null
        if (alive) { setTeam(t); if (t) { document.title = 'Snapback · ' + t.displayName; if (t.logo) warmImage(t.logo) } }
      })
      .catch(() => { if (alive) setTeam(null) })
    getJSON('/api/venues')
      .then((r: any) => {
        const v = (Array.isArray(r?.data) ? r.data : []).find((x: Venue) => x.teams.some((t) => t.league === league && t.id === id)) ?? null
        if (alive) { setVenue(v); if (v?.image) warmImage(v.image) }
      })
      .catch(() => { if (alive) setVenue(null) })
    getJSON('/data/experiences.json')
      .then((r: any) => { if (alive) setExps(Array.isArray(r?.experiences) ? r.experiences : []) })
      .catch(() => { if (alive) setExps([]) })
    return () => { alive = false }
  }, [league, id])

  // Upcoming games need the team abbr (dbGames filters by abbr + league).
  useEffect(() => {
    if (!league || !team) return
    let alive = true
    getJSON(`/api/games?league=${league}&team=${encodeURIComponent(team.abbr)}&from=${todayIso()}&limit=12`)
      .then((r: any) => { if (alive) setGames(Array.isArray(r?.data) ? r.data : []) })
      .catch(() => { if (alive) setGames([]) })
    return () => { alive = false }
  }, [league, team])

  // Experience: venue match first (carries the pinned overrides), else team name.
  const snap = useMemo(() => {
    if (!exps) return null
    if (venue) { const m = matchExperienceForVenue(venue, exps); if (m) return m }
    return team ? matchExperienceForTeam(team.displayName, exps) : null
  }, [exps, venue, team])

  return (
    <div className="min-h-screen bg-[#f4f4f4] font-sans text-[#33352f]">
      <PageCssGuard id="team" />
      <SiteNav active="teams" />
      <main id="app">{renderBody()}</main>
      <footer className="mt-[26px] bg-black py-10 text-[13px] text-[#888]">
        <div className={container}>© 2026 Snapback Sports. <Link to="/teams" search={{ league: undefined }} className="font-bold text-brand!">← All teams</Link></div>
      </footer>
    </div>
  )

  function renderBody() {
    if (!league || !id) return <div className={loadwrap}>No team selected. <Link to="/teams" search={{ league: undefined }} className={ulink}>Browse teams →</Link></div>
    if (team === undefined) return <div className={loadwrap}>Loading team…</div>
    if (team === null) return <div className={loadwrap}>Couldn't find this team. <Link to="/teams" search={{ league: undefined }} className={ulink}>Browse teams →</Link></div>
    return <TeamContent league={league} t={team} venue={venue ?? null} games={games} snap={snap} />
  }
}

function TeamContent({ league, t, venue, games, snap }: { league: League; t: TeamInfo; venue: Venue | null; games: Game[] | null; snap: Experience | null }) {
  const accent = t.color ? (t.color.startsWith('#') ? t.color : '#' + t.color) : '#333'
  return (
    <>
      <section className="relative overflow-hidden pt-[30px] pb-[34px] text-white" style={{ background: `radial-gradient(120% 140% at 50% -10%, ${accent}, #0a0a0a 70%)` }}>
        <Link className="relative z-[2] mb-[18px] ml-7 inline-flex text-[13px] font-bold uppercase tracking-[.5px] text-[#e8e8e8]! transition-colors hover:text-brand!" to="/teams" search={{ league: undefined }}>← All teams</Link>
        <div className={cn(container, 'relative z-[2]')}>
          {t.logo ? <img className="mb-3.5 h-24 w-24 object-contain drop-shadow-[4px_4px_0_rgba(0,0,0,.45)]" src={t.logo} alt="" width={96} height={96} /> : null}
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge className={pill}>{SPORTS[league].label}</Badge>
            {t.location ? <Badge className={cn(pill, 'bg-white')}>{t.location}</Badge> : null}
          </div>
          <h1 className="font-display text-[clamp(32px,8vw,64px)] uppercase leading-none tracking-[1px] text-white [text-shadow:3px_3px_0_rgba(0,0,0,.35)]">{t.displayName}</h1>
        </div>
      </section>

      {(venue || snap) ? (
        <section className="pt-[34px] pb-2"><div className={container}>
          <Badge className={eyebrow}>Where they play · how it rates</Badge>
          <div className="grid grid-cols-[1fr_1fr] gap-3.5 max-[700px]:grid-cols-1">
            {venue ? (
              <Link to="/venue" search={{ id: venue.id }} className={cn(hopcard, "after:absolute after:inset-0 after:bg-[linear-gradient(180deg,rgba(0,0,0,.1)_30%,rgba(0,0,0,.78))] after:content-['']")}>
                {venue.image ? <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${venue.image}')` }} /> : null}
                <div className="relative z-[2] px-4 py-3.5">
                  <div className={hoplab}>Home venue</div>
                  <div className="mt-[5px] font-display text-[22px] leading-[1.05] tracking-[.5px]">{venue.name}</div>
                  <div className={hopsub}>{[venue.city, venue.state].filter(Boolean).join(', ')} · full guide →</div>
                </div>
              </Link>
            ) : null}
            {snap ? (
              <Link to="/rankings" className={cn(hopcard, 'bg-[#111]')}>
                <div className="relative z-[2] px-4 py-3.5">
                  <div className={hoplab}><img src="/img/logo.png" alt="" width={18} height={18} className="rounded-[4px]" /> Snapback Score</div>
                  <div className="mt-1 font-display text-[40px] tracking-[.5px] text-brand">{snap.final.toFixed(1)}</div>
                  <div className={hopsub}>#{snap.rank} in America · {snap.name} · see the rankings →</div>
                </div>
              </Link>
            ) : null}
          </div>
        </div></section>
      ) : null}

      <section className="pt-[34px] pb-[46px]"><div className={container}>
        <Badge className={eyebrow}>On the schedule</Badge>
        <h2 className="mb-3.5 font-display text-[26px] uppercase leading-none tracking-[1px] text-ink-soft">Upcoming games</h2>
        {games === null ? <div className="py-[26px] font-semibold text-muted">Loading games…</div> : null}
        {games && !games.length ? (
          <div className="px-[2px] pt-3 pb-[22px] text-[15px] text-muted">No upcoming {t.displayName} games on the schedule. <Link to="/games" className={ulink}>Browse all games →</Link></div>
        ) : null}
        {games && games.length ? games.map((g) => <GameRow key={g.league + ':' + g.id} g={g} />) : null}
      </div></section>
    </>
  )
}
