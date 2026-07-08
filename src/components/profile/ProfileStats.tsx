import { useMemo } from 'react'
import type { MyRank } from '../../lib/myRankings'

const SPORT_LABELS: Record<string, string> = {
  nfl: 'NFL', mlb: 'MLB', nba: 'NBA', nhl: 'NHL',
  'college-football': 'CFB', 'mens-college-basketball': 'CBB',
}

export function ProfileStats({ rankings }: { rankings: MyRank[] }) {
  const { bins, maxBin, leagues, maxLeague } = useMemo(() => {
    const bins = new Array(10).fill(0) as number[]
    const leagueMap = new Map<string, number>()
    for (const r of rankings) {
      const b = Math.min(10, Math.max(1, Math.round(r.score)))
      bins[b - 1]++
      leagueMap.set(r.sport, (leagueMap.get(r.sport) ?? 0) + 1)
    }
    const leagues = [...leagueMap.entries()].sort((a, b) => b[1] - a[1])
    return { bins, maxBin: Math.max(1, ...bins), leagues, maxLeague: Math.max(1, ...leagues.map(([, n]) => n)) }
  }, [rankings])

  if (!rankings.length) return null

  return (
    <section className="mb-8">
      <div className="mb-4">
        <h2 className="font-display text-[20px] uppercase tracking-[0.5px] text-ink">Stats</h2>
      </div>
      <div className="grid grid-cols-2 gap-4 max-[580px]:grid-cols-1">
        {/* Histogram */}
        <div className="bg-white border-[3px] border-[#222] shadow-[4px_4px_0_#222] rounded-[8px] p-4">
          <div className="font-body text-[11px] font-bold uppercase tracking-[0.5px] text-[#999] mb-3">Ratings distribution</div>
          <div className="flex items-end gap-1 h-[60px]">
            {bins.map((n, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${n} at ${i + 1}`}>
                <div
                  className="w-full bg-brand-yellow rounded-t-[2px]"
                  style={{ height: `${Math.round((n / maxBin) * 56)}px` }}
                />
                <span className="font-body text-[8px] text-[#aaa]">{i + 1}</span>
              </div>
            ))}
          </div>
        </div>

        {/* By sport */}
        <div className="bg-white border-[3px] border-[#222] shadow-[4px_4px_0_#222] rounded-[8px] p-4">
          <div className="font-body text-[11px] font-bold uppercase tracking-[0.5px] text-[#999] mb-3">By league</div>
          <div className="flex flex-col gap-2">
            {leagues.map(([sport, n]) => (
              <div key={sport} className="flex items-center gap-2">
                <span className="font-body text-[12px] text-ink w-[36px] shrink-0">{SPORT_LABELS[sport] ?? sport}</span>
                <div className="flex-1 h-[6px] bg-[#e8e8e8] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-yellow rounded-full"
                    style={{ width: `${Math.round((n / maxLeague) * 100)}%` }}
                  />
                </div>
                <span className="font-body font-bold text-[12px] text-ink w-[20px] text-right">{n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
