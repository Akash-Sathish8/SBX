// Live-score refresh. The ~4,500 finished games in D1 never change, so reads
// stay pure-SQL. Any game that ISN'T final yet can drift between ingests — for
// those we overlay ESPN's current scoreboard at read time. We don't gate on the
// stored date (a suspended/postponed game keeps an old date but resolves later);
// instead we patch any non-final game that ESPN currently lists. ESPN is hit at
// most once per league per ~45s (espn.ts caches) and only when the result set
// actually contains a non-final game — so finished-season reads never touch it.
//
// Matching is by ESPN event id (the same id we ingested into games.id), so the
// overlay is exact. Exposed as a pure transform so a cron Worker could reuse the
// same fetch to PERSIST fresh scores into D1 later.
import { getScoreboard, type Game } from '../lib/espn'
import type { League } from '../lib/sports'

const refreshable = (g: Game) => g.state !== 'post'

export async function overlayLiveScores(games: Game[]): Promise<Game[]> {
  const leagues = new Set<League>()
  for (const g of games) if (refreshable(g)) leagues.add(g.league)
  if (!leagues.size) return games

  // getScoreboard() with no date = ESPN's current window (today's slate + live +
  // recently-resolved games such as suspensions).
  const live = new Map<string, Game>()
  await Promise.all(
    [...leagues].map(async (lg) => {
      try {
        for (const e of await getScoreboard(lg)) live.set(`${lg}:${e.id}`, e)
      } catch { /* ESPN hiccup → keep the D1 value */ }
    }),
  )
  if (!live.size) return games

  return games.map((g) => {
    if (!refreshable(g)) return g
    const e = live.get(`${g.league}:${g.id}`)
    if (!e) return g
    return {
      ...g,
      state: e.state,
      detail: e.detail,
      completed: e.completed,
      home: { ...g.home, score: e.home.score, winner: e.home.winner },
      away: { ...g.away, score: e.away.score, winner: e.away.winner },
    }
  })
}
