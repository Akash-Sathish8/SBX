import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { db } from '#/lib/server/db'
import { getSession } from '#/lib/server/session'
import { generateId } from '#/lib/server/user-auth'
import type { MyRank } from '#/lib/myRankings'

const NO_STORE = { 'Cache-Control': 'no-store' }

function sanitize(r: any): MyRank | null {
  if (!r || typeof r.gameId !== 'string' || !r.gameId) return null
  const num = (v: any, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d)
  return {
    gameId: r.gameId,
    sport: String(r.sport ?? ''),
    away: String(r.away ?? ''),
    home: String(r.home ?? ''),
    awayLogo: r.awayLogo ? String(r.awayLogo) : undefined,
    homeLogo: r.homeLogo ? String(r.homeLogo) : undefined,
    date: String(r.date ?? ''),
    venue: String(r.venue ?? ''),
    city: r.city ? String(r.city) : undefined,
    fans: num(r.fans), food: num(r.food), unique: num(r.unique), stadium: num(r.stadium),
    score: num(r.score), ts: num(r.ts, Date.now()),
  }
}

function rowToMyRank(r: any): MyRank {
  return {
    gameId: r.game_id, sport: r.sport,
    away: r.away, home: r.home,
    awayLogo: r.away_logo ?? undefined,
    homeLogo: r.home_logo ?? undefined,
    date: r.game_date, venue: r.venue, city: r.city ?? undefined,
    fans: r.fans, food: r.food, unique: r.unique_val, stadium: r.stadium,
    score: r.score, ts: r.ts,
  }
}

// GET = user's game diary; PUT = upsert (bulk on login sync OR single write);
// DELETE ?gameId= = remove one entry.
export const Route = createFileRoute('/api/rankings')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSession(request, env as any)
        if (!user) return Response.json({ ok: false, error: 'Not signed in' }, { status: 401, headers: NO_STORE })
        const rows = await db(env as any).query(
          'SELECT * FROM game_rankings WHERE user_id = ? ORDER BY ts DESC',
          [user.id],
        )
        return Response.json({ ok: true, data: rows.map(rowToMyRank) }, { headers: NO_STORE })
      },

      PUT: async ({ request }) => {
        const user = await getSession(request, env as any)
        if (!user) return Response.json({ ok: false, error: 'Not signed in' }, { status: 401, headers: NO_STORE })
        let body: any
        try { body = await request.json() } catch { return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }) }
        const incoming = (Array.isArray(body?.rankings) ? body.rankings.map(sanitize).filter(Boolean) : []) as MyRank[]
        const database = db(env as any)
        for (const r of incoming) {
          await database.run(
            `INSERT INTO game_rankings (id,user_id,game_id,sport,away,home,away_logo,home_logo,game_date,venue,city,fans,food,unique_val,stadium,score,ts)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
             ON CONFLICT(user_id,game_id) DO UPDATE SET
               sport=excluded.sport,away=excluded.away,home=excluded.home,
               away_logo=excluded.away_logo,home_logo=excluded.home_logo,
               game_date=excluded.game_date,venue=excluded.venue,city=excluded.city,
               fans=excluded.fans,food=excluded.food,unique_val=excluded.unique_val,
               stadium=excluded.stadium,score=excluded.score,ts=excluded.ts`,
            [generateId(), user.id, r.gameId, r.sport, r.away, r.home,
             r.awayLogo ?? null, r.homeLogo ?? null, r.date, r.venue, r.city ?? null,
             r.fans, r.food, r.unique, r.stadium, r.score, r.ts],
          )
        }
        const rows = await database.query('SELECT * FROM game_rankings WHERE user_id = ? ORDER BY ts DESC', [user.id])
        return Response.json({ ok: true, data: rows.map(rowToMyRank) }, { headers: NO_STORE })
      },

      DELETE: async ({ request }) => {
        const user = await getSession(request, env as any)
        if (!user) return Response.json({ ok: false, error: 'Not signed in' }, { status: 401, headers: NO_STORE })
        const gameId = new URL(request.url).searchParams.get('gameId')
        if (gameId) await db(env as any).run('DELETE FROM game_rankings WHERE user_id=? AND game_id=?', [user.id, gameId])
        return Response.json({ ok: true }, { headers: NO_STORE })
      },
    },
  },
})
