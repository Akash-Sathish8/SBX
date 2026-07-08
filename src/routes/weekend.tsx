import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { SiteNav } from '../components/SiteNav'
import type { LiveGame, League } from '../lib/data-types'

export const Route = createFileRoute('/weekend')({
  head: () => ({ meta: [{ title: 'Snapback — This Weekend' }] }),
  component: WeekendPage,
})

const LEAGUES: { value: League | ''; label: string }[] = [
  { value: '', label: 'All Sports' },
  { value: 'NFL', label: 'NFL' },
  { value: 'MLB', label: 'MLB' },
  { value: 'NBA', label: 'NBA' },
  { value: 'NHL', label: 'NHL' },
  { value: 'CFB', label: 'College Football' },
  { value: 'CBB', label: 'College Basketball' },
]

function getWeekendDates(): { label: string; date: string }[] {
  const now = new Date()
  const day = now.getDay()
  const daysToFri = (5 - day + 7) % 7 || 7
  const fri = new Date(now)
  fri.setDate(now.getDate() + (daysToFri === 7 && day === 5 ? 0 : daysToFri))
  return [0, 1, 2].map(offset => {
    const d = new Date(fri)
    d.setDate(fri.getDate() + offset)
    return {
      label: ['Friday', 'Saturday', 'Sunday'][offset],
      date: d.toISOString().slice(0, 10),
    }
  })
}

function GameRow({ game }: { game: LiveGame }) {
  return (
    <Link to="/game/$id" params={{ id: game.id }} className="no-underline">
      <div className="flex items-center gap-4 p-4 bg-white border-[3px] border-[#222] shadow-[4px_4px_0_#222] rounded-[6px] mb-3 [transition:transform_.1s,box-shadow_.1s] hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_#222]">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex flex-col items-center gap-1 min-w-[80px]">
            <div className="flex items-center gap-2">
              {game.away.logo && <img src={game.away.logo} alt={game.away.abbr} width={24} height={24} className="w-6 h-6 object-contain" />}
              <span className="font-display text-[14px]">{game.away.abbr}</span>
            </div>
            <div className="text-[#999] font-body text-[11px]">@</div>
            <div className="flex items-center gap-2">
              {game.home.logo && <img src={game.home.logo} alt={game.home.abbr} width={24} height={24} className="w-6 h-6 object-contain" />}
              <span className="font-display text-[14px]">{game.home.abbr}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-body font-bold text-[14px] text-ink truncate">{game.name}</div>
            {game.venueName && <div className="font-body text-[12px] text-[#666] truncate">{game.venueName}{game.venueCity ? ` · ${game.venueCity}` : ''}</div>}
            <div className="font-body text-[12px] text-[#999] mt-0.5">
              {new Date(game.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}
            </div>
          </div>
        </div>
        {(game.isLive || game.isFinal) && (
          <div className="text-right shrink-0">
            {game.isLive && <div className="text-[10px] font-bold text-red-600 uppercase tracking-[1px] mb-0.5">Live</div>}
            <div className="font-display text-[18px]">{game.away.score}–{game.home.score}</div>
            {game.isLive && <div className="text-[11px] text-[#666]">{game.statusDesc}</div>}
          </div>
        )}
      </div>
    </Link>
  )
}

function WeekendPage() {
  const [league, setLeague] = useState<League | ''>('')
  const days = getWeekendDates()

  const queries = days.map(d =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useQuery<LiveGame[]>({
      queryKey: ['weekend-games', d.date, league],
      queryFn: () =>
        fetch(`/api/games?date=${d.date}${league ? `&league=${league}` : ''}`)
          .then(r => r.json()),
      staleTime: 5 * 60 * 1000,
    })
  )

  return (
    <>
      <SiteNav active="weekend" />

      <section className="grid-overlay bg-[#222] text-white pt-[44px] pb-[38px] relative overflow-hidden">
        <div className="container relative z-[1] max-w-[1180px] mx-auto px-[28px]">
          <div className="eyebrow inline-flex items-center gap-[9px] font-bold text-[13px] tracking-[1.4px] uppercase text-ink bg-brand-yellow px-[13px] py-[6px] rounded-[3px] shadow-[4px_4px_0_#000] mb-[14px]">
            {days[0].date} — {days[2].date}
          </div>
          <h1 className="font-display uppercase text-white tracking-[1px] leading-none text-[clamp(44px,6.4vw,84px)]">
            This <span className="hl bg-brand-yellow text-ink px-[10px] shadow-[5px_5px_0_#000] inline-block">Weekend</span>
          </h1>
          <div className="flex gap-3 flex-wrap mt-6">
            {LEAGUES.map(l => (
              <button
                key={l.value}
                onClick={() => setLeague(l.value as League | '')}
                className={`inline-flex items-center border-[3px] border-[#222] rounded-[6px] shadow-[4px_4px_0_#222] px-[14px] py-[8px] font-body font-bold text-[13px] uppercase tracking-[0.4px] cursor-pointer [transition:transform_.1s,box-shadow_.1s,background_.12s] hover:-translate-x-px hover:-translate-y-px ${l.value === league ? 'bg-brand-yellow text-ink' : 'bg-white text-ink'}`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="py-[46px] bg-[#f4f4f4]">
        <div className="container max-w-[1180px] mx-auto px-[28px]">
          {days.map((day, i) => {
            const { data, isLoading } = queries[i]
            const games = data ?? []
            return (
              <div key={day.date} className="mb-12">
                <h2 className="font-display text-[26px] uppercase tracking-[1px] mb-5 pb-2 border-b-[3px] border-brand-yellow">
                  {day.label} <span className="font-body font-normal text-[16px] text-[#666] tracking-normal normal-case">{day.date}</span>
                </h2>
                {isLoading && (
                  <div className="text-[#999] font-body text-[14px] py-4">Loading games...</div>
                )}
                {!isLoading && games.length === 0 && (
                  <div className="text-[#999] font-body text-[14px] py-4">No games scheduled{league ? ` for ${league}` : ''}.</div>
                )}
                {games.map(g => <GameRow key={g.id} game={g} />)}
              </div>
            )
          })}
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
