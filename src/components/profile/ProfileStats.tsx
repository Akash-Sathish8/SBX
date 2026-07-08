import { useMemo } from 'react'
import type { MyRank } from '../../lib/myRankings'
import { SPORTS } from '../../lib/sports'

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
    <section className="pf-block">
      <div className="pf-blockhead"><h2>Stats</h2></div>
      <div className="pf-stats">
        <div className="pf-stat-card">
          <div className="pf-stat-lab">Ratings</div>
          <div className="pf-hist">
            {bins.map((n, i) => (
              <div key={i} className="pf-hist-col" title={`${n} at ${i + 1}`}>
                <div className="pf-hist-bar" style={{ height: `${Math.round((n / maxBin) * 100)}%` }} />
                <span className="pf-hist-x">{i + 1}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pf-stat-card">
          <div className="pf-stat-lab">By league</div>
          <div className="pf-leagues">
            {leagues.map(([lg, n]) => (
              <div key={lg} className="pf-lg-row">
                <span className="pf-lg-name">{SPORTS[lg as keyof typeof SPORTS]?.label ?? lg}</span>
                <span className="pf-lg-track"><span className="pf-lg-fill" style={{ width: `${Math.round((n / maxLeague) * 100)}%` }} /></span>
                <span className="pf-lg-n">{n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
