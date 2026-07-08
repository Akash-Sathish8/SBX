import { createFileRoute } from '@tanstack/react-router'
import { getUserFromRequest } from '../../server/auth'
import { dbGetUserRankings, dbUpsertUserRankings, dbDeleteUserRanking, type UserRanking } from '../../server/db'

const noStore = { 'Cache-Control': 'no-store' }

// Defensive: only persist well-formed rows (this is user-supplied JSON).
function sanitize(r: any): UserRanking | null {
  if (!r || typeof r.gameId !== 'string' || !r.gameId) return null
  const num = (v: any, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d)
  return {
    gameId: r.gameId,
    league: r.league,
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

// GET = the signed-in user's list. PUT = upsert-all (post-login bulk sync OR a
// single-game write). DELETE ?gameId= = remove one.
export const Route = createFileRoute('/api/rankings')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getUserFromRequest(request)
        if (!user) return Response.json({ ok: false, error: 'Not signed in' }, { status: 401, headers: noStore })
        return Response.json({ ok: true, data: await dbGetUserRankings(user.id) }, { headers: noStore })
      },
      PUT: async ({ request }) => {
        const user = await getUserFromRequest(request)
        if (!user) return Response.json({ ok: false, error: 'Not signed in' }, { status: 401, headers: noStore })
        let body: any
        try { body = await request.json() } catch { return Response.json({ ok: false, error: 'Invalid request.' }, { status: 400 }) }
        const incoming = (Array.isArray(body?.rankings) ? body.rankings.map(sanitize).filter(Boolean) : []) as UserRanking[]
        await dbUpsertUserRankings(user.id, incoming)
        return Response.json({ ok: true, data: await dbGetUserRankings(user.id) }, { headers: noStore })
      },
      DELETE: async ({ request }) => {
        const user = await getUserFromRequest(request)
        if (!user) return Response.json({ ok: false, error: 'Not signed in' }, { status: 401, headers: noStore })
        const gameId = new URL(request.url).searchParams.get('gameId')
        if (gameId) await dbDeleteUserRanking(user.id, gameId)
        return Response.json({ ok: true, data: await dbGetUserRankings(user.id) }, { headers: noStore })
      },
    },
  },
})
