import { Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import type { MyRank } from '../../lib/myRankings'
import { diaryDate } from './types'

const SPORT_LABELS: Record<string, string> = {
  nfl: 'NFL', mlb: 'MLB', nba: 'NBA', nhl: 'NHL',
  'college-football': 'CFB', 'mens-college-basketball': 'CBB',
}

interface VenueIndex {
  byName: Map<string, { id: string }>
}

export function Diary({ rankings, venues, mine }: { rankings: MyRank[]; venues: VenueIndex; mine: boolean }) {
  const rows = useMemo(
    () => [...rankings].sort((a, b) => (b.date < a.date ? -1 : b.date > a.date ? 1 : b.ts - a.ts)),
    [rankings],
  )

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-[20px] uppercase tracking-[0.5px] text-ink flex items-center gap-2">
          Diary
          <span className="font-body text-[13px] text-[#999] normal-case font-normal">{rows.length}</span>
        </h2>
        {mine && (
          <Link to="/rank" className="font-body text-[13px] font-bold text-[#666] no-underline hover:text-ink [transition:color_.1s]">
            + Log a game
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="font-body text-[14px] text-[#999] py-6">
          {mine ? (
            <>No games logged yet. <Link to="/rank" className="text-ink underline">Log your first →</Link></>
          ) : 'No games logged yet.'}
        </div>
      ) : (
        <div className="flex flex-col gap-0 border-[2px] border-[#e8e8e8] rounded-[8px] overflow-hidden">
          {rows.map(r => <DiaryRow key={r.gameId} r={r} venues={venues} />)}
        </div>
      )}
    </section>
  )
}

function DiaryRow({ r, venues }: { r: MyRank; venues: VenueIndex }) {
  const { day, year } = diaryDate(r.date)
  const v = venues.byName.get((r.venue ?? '').trim().toLowerCase())

  const logo = (src?: string, name?: string) =>
    src ? (
      <img src={src} alt={name ?? ''} width={20} height={20} className="w-5 h-5 object-contain shrink-0" loading="lazy" />
    ) : (
      <span className="w-5 h-5 rounded-full bg-[#e8e8e8] shrink-0 inline-block" aria-hidden="true" />
    )

  const venueEl = v ? (
    <Link to="/venue/$id" params={{ id: v.id }} className="text-ink underline hover:text-brand-yellow [transition:color_.1s]">
      {r.venue}
    </Link>
  ) : <span>{r.venue}</span>

  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-[#eee] last:border-0 bg-white hover:bg-[#fffde0] [transition:background_.1s]">
      <div className="text-center w-[52px] shrink-0">
        <div className="font-display text-[13px] uppercase text-ink">{day}</div>
        <div className="font-body text-[11px] text-[#999]">{year}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          {logo(r.awayLogo, r.away)}
          <span className="font-body font-bold text-[13px] text-ink">{r.away}</span>
          <span className="font-body text-[12px] text-[#999]">@</span>
          {logo(r.homeLogo, r.home)}
          <span className="font-body font-bold text-[13px] text-ink">{r.home}</span>
        </div>
        <div className="font-body text-[11px] text-[#888]">
          {SPORT_LABELS[r.sport] ?? r.sport} · {venueEl}{r.city ? <> · {r.city}</> : null}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-display text-[22px] text-ink">{r.score.toFixed(1)}</div>
      </div>
    </div>
  )
}
