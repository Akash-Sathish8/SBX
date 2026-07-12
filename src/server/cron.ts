// Live-score refresh, run on a Cloudflare cron trigger (see src/server.ts +
// wrangler.jsonc). Finished games are permanent in D1; only in-progress/today
// games drift. We pull each league's CURRENT ESPN scoreboard and UPDATE the
// volatile fields (state / detail / completed / scores / winner) on the rows
// that already exist from the full-season ingest — NOT an upsert, so the
// season/venue/team columns set by scripts/ingest.mjs are preserved.
import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { getScoreboard, type Game } from '../lib/espn'
import { LEAGUES } from '../lib/sports'
import * as schema from './db/schema'
import { games } from './db/schema'

// The cron receives its bindings via the Worker `scheduled` handler (src/server.ts),
// so the D1 handle is passed in rather than read from `cloudflare:workers`.
export interface CronEnv { DB?: D1Database }

export async function runScheduledIngest(env: CronEnv): Promise<void> {
  if (!env?.DB) return
  const d = drizzle(env.DB, { schema })
  const stamp = new Date().toISOString()
  for (const league of LEAGUES) {
    let list: Game[] = []
    try {
      list = await getScoreboard(league)
    } catch {
      continue // ESPN hiccup for this league → leave D1 as-is
    }
    if (!list.length) continue
    const stmts = list.map((g) =>
      d.update(games)
        .set({
          state: g.state,
          detail: g.detail,
          completed: g.completed ? 1 : 0,
          homeScore: g.home.score,
          homeWinner: g.home.winner ? 1 : 0,
          awayScore: g.away.score,
          awayWinner: g.away.winner ? 1 : 0,
          updatedAt: stamp,
        })
        .where(and(eq(games.league, g.league), eq(games.id, g.id))),
    )
    try {
      await d.batch(stmts as [(typeof stmts)[number], ...(typeof stmts)[number][]])
    } catch {
      // skip this league's batch on a D1 error; next cron tick retries
    }
  }
}
