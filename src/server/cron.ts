// Live-score refresh, run on a Cloudflare cron trigger (see src/server.ts +
// wrangler.jsonc). Finished games are permanent in D1; only in-progress/today
// games drift. We pull each league's CURRENT ESPN scoreboard and UPDATE the
// volatile fields (state / detail / completed / scores / winner) on the rows
// that already exist from the full-season ingest — NOT INSERT OR REPLACE, so the
// season/venue/team columns set by scripts/ingest.mjs are preserved.
import { getScoreboard, type Game } from '../lib/espn'
import { LEAGUES } from '../lib/sports'

// Minimal structural type for the D1 binding (avoids depending on ambient
// D1Database types, which aren't wired into this project's tsconfig).
interface D1PreparedLike { bind(...vals: unknown[]): D1PreparedLike }
interface D1Like {
  prepare(sql: string): D1PreparedLike
  batch(stmts: D1PreparedLike[]): Promise<unknown>
}
export interface CronEnv { DB?: D1Like }

const UPDATE_SQL =
  'UPDATE games SET state=?, detail=?, completed=?, ' +
  'home_score=?, home_winner=?, away_score=?, away_winner=?, updated_at=? ' +
  'WHERE league=? AND id=?'

export async function runScheduledIngest(env: CronEnv): Promise<void> {
  const db = env?.DB
  if (!db) return
  const stamp = new Date().toISOString()
  for (const league of LEAGUES) {
    let games: Game[] = []
    try {
      games = await getScoreboard(league)
    } catch {
      continue // ESPN hiccup for this league → leave D1 as-is
    }
    if (!games.length) continue
    const stmts = games.map((g) =>
      db.prepare(UPDATE_SQL).bind(
        g.state,
        g.detail,
        g.completed ? 1 : 0,
        g.home.score,
        g.home.winner ? 1 : 0,
        g.away.score,
        g.away.winner ? 1 : 0,
        stamp,
        g.league,
        g.id,
      ),
    )
    try {
      await db.batch(stmts)
    } catch {
      // skip this league's batch on a D1 error; next cron tick retries
    }
  }
}
