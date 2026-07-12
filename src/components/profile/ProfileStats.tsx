import { useMemo } from 'react'
import type { MyRank } from '../../lib/myRankings'
import { SPORTS } from '../../lib/sports'
import { block, blockHead, blockH2, card } from './ui'

// Client-side stats from the logged games: a 1-10 ratings histogram + a per-league
// breakdown. Pure derived data — no API. Hidden when there's nothing logged.
export function ProfileStats({ rankings }: { rankings: MyRank[] }) {
  const { bins, maxBin, leagues, maxLeague } = useMemo(() => {
    const bins = new Array(10).fill(0) as number[] // index 0 => score 1, index 9 => score 10
    const leagueMap = new Map<string, number>()
    for (const r of rankings) {
      const b = Math.min(10, Math.max(1, Math.round(r.score)))
      bins[b - 1]++
      leagueMap.set(r.league, (leagueMap.get(r.league) ?? 0) + 1)
    }
    const leagues = [...leagueMap.entries()].sort((a, b) => b[1] - a[1])
    return {
      bins,
      maxBin: Math.max(1, ...bins),
      leagues,
      maxLeague: Math.max(1, ...leagues.map(([, n]) => n)),
    }
  }, [rankings])

  if (!rankings.length) return null

  return (
    <section className={block}>
      <div className={blockHead}><h2 className={blockH2}>Stats</h2></div>
      <div className="grid grid-cols-2 gap-[16px] max-[760px]:grid-cols-1">
        <div className={card + ' px-[18px] py-[16px]'}>
          <div className="mb-[12px] text-[12px] font-extrabold uppercase tracking-[.6px] text-[#111]">Ratings</div>
          <div className="flex h-[96px] items-end gap-[6px]">
            {bins.map((n, i) => (
              <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-[5px]" title={`${n} at ${i + 1}`}>
                <div className="min-h-[2px] w-full rounded-[2px_2px_0_0] border border-[#111] bg-brand" style={{ height: `${Math.round((n / maxBin) * 100)}%` }} />
                <span className="text-[10px] font-bold text-[#6b6b6b]">{i + 1}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={card + ' px-[18px] py-[16px]'}>
          <div className="mb-[12px] text-[12px] font-extrabold uppercase tracking-[.6px] text-[#111]">By league</div>
          <div className="flex flex-col gap-[9px]">
            {leagues.map(([lg, n]) => (
              <div key={lg} className="grid grid-cols-[64px_1fr_auto] items-center gap-[10px]">
                <span className="text-[12px] font-extrabold uppercase tracking-[.4px] text-[#444]">{SPORTS[lg as keyof typeof SPORTS]?.label ?? lg}</span>
                <span className="h-[12px] overflow-hidden rounded-[6px] border border-[#ddd] bg-[#eee]"><span className="block h-full bg-[#222]" style={{ width: `${Math.round((n / maxLeague) * 100)}%` }} /></span>
                <span className="min-w-[20px] text-right text-[13px] font-extrabold text-[#111]">{n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
