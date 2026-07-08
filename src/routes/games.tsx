import { useState, useMemo } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { SiteNav } from '../components/SiteNav'
import type { LiveGame } from '../lib/data-types'

const PAGE_SIZE = 40

export const Route = createFileRoute('/games')({
  head: () => ({ meta: [{ title: 'Snapback Field Guide — Games' }] }),
  component: GamesPage,
})

type Sport = { label: string; espnSport: string; league: string }

const SPORTS: Sport[] = [
  { label: 'All', espnSport: '', league: '' },
  { label: 'NFL', espnSport: 'nfl', league: 'NFL' },
  { label: 'MLB', espnSport: 'mlb', league: 'MLB' },
  { label: 'NBA', espnSport: 'nba', league: 'NBA' },
  { label: 'NHL', espnSport: 'nhl', league: 'NHL' },
  { label: 'CFB', espnSport: 'college-football', league: 'CFB' },
  { label: 'CBB', espnSport: 'mens-college-basketball', league: 'CBB' },
]

function GameRow({ g }: { g: LiveGame }) {
  const dateStr = new Date(g.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const timeStr = new Date(g.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  return (
    <Link
      to="/game/$id"
      params={{ id: g.id }}
      className="no-underline group"
    >
      <div className="relative bg-white border-[3px] border-[#222] shadow-[5px_5px_0_#222] rounded-[8px] px-5 py-4 mb-3 flex items-center gap-4 [transition:transform_.1s,box-shadow_.1s] hover:-translate-x-px hover:-translate-y-px hover:shadow-[7px_7px_0_#f7df02] before:content-[''] before:absolute before:left-0 before:inset-y-0 before:w-[7px] before:bg-brand-yellow before:rounded-l-[6px]">
        {g.isLive && (
          <span className="absolute top-2 right-3 text-[9px] font-bold text-red-600 uppercase tracking-[1px]">● Live</span>
        )}
        <div className="pl-3 flex flex-col items-start justify-center min-w-[70px] shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#9a7e00]">{dateStr.split(',')[0]}</span>
          <span className="font-display text-[19px] leading-tight text-ink">{dateStr.split(', ')[1]}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-body font-bold text-[15px] text-ink leading-tight">
            {g.shortName || g.name}
          </div>
          <div className="font-body text-[12px] text-[#666] mt-0.5">
            {g.venueName && `${g.venueName} · `}{timeStr}
            {g.sport && <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.5px] text-[#999] bg-[#eee] px-1.5 py-0.5 rounded">{g.sport}</span>}
          </div>
        </div>
        {(g.isLive || g.isFinal) ? (
          <div className="text-right shrink-0">
            <div className="flex items-center gap-1">
              {g.away.logo && <img src={g.away.logo} alt={g.away.abbr} width={20} height={20} className="w-5 h-5 object-contain" />}
              <span className="font-display text-[18px]">{g.away.score}</span>
              <span className="text-[#ccc] font-bold text-[14px]">–</span>
              <span className="font-display text-[18px]">{g.home.score}</span>
              {g.home.logo && <img src={g.home.logo} alt={g.home.abbr} width={20} height={20} className="w-5 h-5 object-contain" />}
            </div>
            {g.isFinal && <div className="text-[10px] text-[#999] uppercase tracking-[0.5px] text-right">Final</div>}
            {g.isLive && <div className="text-[10px] text-red-600 uppercase tracking-[0.5px] text-right font-bold">{g.statusDesc}</div>}
          </div>
        ) : (
          <div className="text-[12px] font-bold text-[#888] uppercase tracking-[0.5px] shrink-0">Match info →</div>
        )}
      </div>
    </Link>
  )
}

function GamesPage() {
  const [activeSport, setActiveSport] = useState(SPORTS[0])
  const [query, setQuery] = useState('')
  const [visible, setVisible] = useState(PAGE_SIZE)

  const { data: games = [], isLoading } = useQuery<LiveGame[]>({
    queryKey: ['games', activeSport.espnSport],
    queryFn: () => {
      const url = activeSport.espnSport
        ? `/api/games?sport=${activeSport.espnSport}`
        : '/api/games'
      return fetch(url).then(r => r.json())
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return games.filter(g =>
      !q ||
      g.name.toLowerCase().includes(q) ||
      g.shortName?.toLowerCase().includes(q) ||
      g.home.abbr.toLowerCase().includes(q) ||
      g.away.abbr.toLowerCase().includes(q) ||
      g.venueName?.toLowerCase().includes(q) ||
      g.venueCity?.toLowerCase().includes(q)
    )
  }, [games, query])

  const shown = filtered.slice(0, visible)

  return (
    <>
      <SiteNav active="games" />

      <section className="grid-overlay bg-[#222] text-white pt-[44px] pb-[38px] relative overflow-hidden">
        <div className="container relative z-[1] max-w-[1180px] mx-auto px-[28px]">
          <Link to="/" className="inline-flex items-center gap-[6px] text-[#cfcfcf] font-bold text-[13px] uppercase tracking-[0.5px] mb-[14px] hover:text-brand-yellow [transition:color_.1s]">← Home</Link>
          <h1 className="font-display uppercase tracking-[1px] leading-none text-white text-[clamp(36px,5.5vw,72px)]">
            Games <span className="bg-brand-yellow text-ink px-[10px] shadow-[5px_5px_0_#000] inline-block">&amp; Scores</span>
          </h1>
          <p className="text-[#d6d6d6] text-[16px] mt-4 max-w-[480px]">Today's slate and upcoming games across all major American sports leagues.</p>
        </div>
      </section>

      <section className="bg-[#f4f4f4] py-[46px]">
        <div className="container max-w-[1180px] mx-auto px-[28px]">

          {/* Controls */}
          <div className="flex flex-col gap-4 mb-8 md:flex-row md:items-center">
            <div className="flex gap-2 flex-wrap">
              {SPORTS.map(s => (
                <button
                  key={s.label}
                  onClick={() => { setActiveSport(s); setVisible(PAGE_SIZE) }}
                  className={`px-[14px] py-[7px] border-[2px] font-body font-bold text-[12px] uppercase tracking-[0.5px] cursor-pointer rounded-full [transition:background_.1s,color_.1s,border-color_.1s] ${s.label === activeSport.label ? 'bg-ink text-white border-ink' : 'bg-white text-ink border-[#222] hover:border-ink'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <input
              type="search"
              placeholder="Search team, venue..."
              value={query}
              onChange={e => { setQuery(e.target.value); setVisible(PAGE_SIZE) }}
              className="flex-1 border-[2px] border-[#222] rounded-[6px] shadow-[3px_3px_0_#222] px-4 py-2.5 font-body text-[14px] bg-white outline-none focus:shadow-[5px_5px_0_#222] [transition:box-shadow_.1s] md:max-w-[320px]"
            />
          </div>

          {/* Game list */}
          {isLoading ? (
            <div className="text-[#999] font-body text-[14px] py-12 text-center">Loading games...</div>
          ) : shown.length === 0 ? (
            <div className="text-[#999] font-body text-[14px] py-12 text-center">
              No games found{query ? ` for "${query}"` : ''}.
            </div>
          ) : (
            <>
              <div className="text-[11px] font-bold uppercase tracking-[1px] text-[#999] mb-4">
                {filtered.length} game{filtered.length !== 1 ? 's' : ''}{activeSport.label !== 'All' ? ` · ${activeSport.label}` : ''}
              </div>
              {shown.map(g => <GameRow key={g.id} g={g} />)}
              {visible < filtered.length && (
                <button
                  onClick={() => setVisible(v => v + PAGE_SIZE)}
                  className="w-full mt-4 py-3 border-[3px] border-[#222] bg-white font-body font-bold text-[14px] uppercase tracking-[0.5px] shadow-[4px_4px_0_#222] cursor-pointer hover:-translate-y-px hover:shadow-[6px_6px_0_#222] [transition:transform_.1s,box-shadow_.1s]"
                >
                  Show {Math.min(PAGE_SIZE, filtered.length - visible)} more
                </button>
              )}
            </>
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
