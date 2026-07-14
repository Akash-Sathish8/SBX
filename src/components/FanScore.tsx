import { useEffect, useState } from 'react'
import { getJSON } from '../lib/dataCache'
import { cn } from '@/lib/utils'

// A venue's fan score = the average of every fan's rating of a game there (0–10),
// with the number of ratings behind it. Sourced from /api/fan-scores in one batch
// so listing pages show scores without an N+1 of per-venue calls.

export type FanStat = { score: number; count: number }
export type FanScoreMap = Record<string, FanStat>

// Fetch every venue's fan score once (getJSON memoizes for the session, so many
// cards on a page share the single request). Look up by venue id. null until loaded.
export function useFanScores(): FanScoreMap | null {
  const [map, setMap] = useState<FanScoreMap | null>(null)
  useEffect(() => {
    let alive = true
    getJSON('/api/fan-scores')
      .then((r: any) => { if (alive) setMap(r?.ok && r.data ? r.data : {}) })
      .catch(() => { if (alive) setMap({}) })
    return () => { alive = false }
  }, [])
  return map
}

// Compact fan-score chip: ★ 8.7 · fan · N. Renders nothing when a venue has no
// ratings (count 0) so cards stay clean. The count is always shown when present
// so the sample size (and thus confidence) is visible.
export function FanScorePill({ stat, className }: { stat?: FanStat | null; className?: string }) {
  if (!stat || stat.count < 1) return null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-[5px] rounded-full border-[1.5px] border-ink bg-tip px-2.5 py-[3px] font-sans [line-height:normal]',
        className,
      )}
      title={`${stat.count} fan ${stat.count === 1 ? 'rating' : 'ratings'}`}
    >
      <span aria-hidden className="text-[13px] leading-none text-gold">★</span>
      <b className="font-display text-[14px] font-normal tracking-[.3px] text-ink">{stat.score.toFixed(1)}</b>
      <span className="text-[10.5px] font-bold tracking-[.2px] text-muted uppercase">Fan · {stat.count}</span>
    </span>
  )
}
