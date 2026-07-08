import { useEffect, useState } from 'react'

// Real final scores for fixtures, sourced from ESPN via /api/match-score.
// Shared by the games list, the venue page and the build wizard.
//
// REFRESH CADENCE: once per day. Results are cached in localStorage under a key
// that includes today's date, so each fixture is checked at most once per calendar
// day; a new day starts a fresh cache. We cache a `null` for fixtures that ESPN
// doesn't (yet) report as completed, so we don't re-hit ESPN for them again today.
// We never invent a score — only ESPN-confirmed completed matches get one.

import type { League } from './sports'

export type Score = { hs: number; as: number }
export type ScoreInput = { key: string; league: League; dateISO: string | null; home?: string; away?: string }

const uk = (m: ScoreInput) => `${m.league}|${m.dateISO}|${m.home}|${m.away}`

export function useMatchScores(items: ScoreInput[] | null): Record<string, Score> {
  const [scores, setScores] = useState<Record<string, Score>>({})
  // only re-run when the actual set of fixtures changes
  const sig = items ? items.map((i) => i.key).join(',') : ''

  useEffect(() => {
    if (!items || !items.length) return
    const today = new Date().toISOString().slice(0, 10)
    // version in the key so shipping a matcher/data change invalidates old caches
    const cacheKey = 'sbx:scores:v2:' + today
    const played = items.filter((m) => m.dateISO && m.dateISO <= today && m.home && m.away)
    if (!played.length) return

    // universal cache: "<dateISO>|<home>|<away>" -> Score | null (null = checked, not done)
    let univ: Record<string, Score | null> = {}
    try { const c = localStorage.getItem(cacheKey); if (c) univ = JSON.parse(c) } catch { /* ignore */ }

    const apply = (u: Record<string, Score | null>) => {
      const map: Record<string, Score> = {}
      for (const m of played) { const s = u[uk(m)]; if (s) map[m.key] = s }
      setScores(map)
    }

    const need = played.filter((m) => !(uk(m) in univ))
    if (!need.length) { apply(univ); return }

    let alive = true
    // Fetch SEQUENTIALLY, not in a burst: ESPN rate-limits parallel hits, and the
    // server warms its per-date cache after the first request for each date. Scores
    // are applied progressively so they pop in as they resolve.
    ;(async () => {
      const merged: Record<string, Score | null> = { ...univ }
      for (const m of need) {
        if (!alive) return
        let score: Score | null = null
        try {
          const r = await fetch(`/api/match-score?league=${m.league}&date=${m.dateISO}&home=${encodeURIComponent(m.home!)}&away=${encodeURIComponent(m.away!)}`)
          const j = await r.json()
          const d = j?.data
          if (d?.completed && typeof d.home?.score === 'number' && typeof d.away?.score === 'number') {
            score = { hs: d.home.score as number, as: d.away.score as number }
          }
        } catch { /* ignore — treated as not-yet-done */ }
        merged[uk(m)] = score
        apply(merged)
      }
      if (!alive) return
      try {
        // keep only today's cache to avoid unbounded growth
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i)
          if (k && k.startsWith('sbx:scores:') && k !== cacheKey) localStorage.removeItem(k)
        }
        localStorage.setItem(cacheKey, JSON.stringify(merged))
      } catch { /* ignore quota / private mode */ }
    })()
    return () => { alive = false }
  }, [sig])

  return scores
}
