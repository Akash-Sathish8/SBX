import { createFileRoute } from '@tanstack/react-router'
import { getUserFromRequest, getVoterFromRequest } from '@/lib/auth.functions'
import { dbGetReviews, dbGetReviewsByUser, dbAddReview, dbDeleteReview, dbMyReviewVotes, OFFICIAL_USER_ID, VERIFIED_USER_IDS, type Review } from '../../server/db'

const noStore = { 'Cache-Control': 'no-store' }
const SCOPES = new Set(['venue', 'event'])
const isId = (s: any) => typeof s === 'string' && /^[a-z0-9:_-]{1,40}$/i.test(s)

// Strip the internal user_id; expose `mine` so the author (and only the author)
// sees a delete control. Reads are public; the cookie is optional. `myVote` is
// the caller's own up/down (0 when signed out or not voted).
function publicReview(r: Review, uid?: string, myVotes?: Record<string, number>) {
  return {
    id: r.id, scope: r.scope, targetId: r.targetId, gameId: r.gameId, rating: r.rating,
    author: r.author, avatar: r.avatar ?? null, body: r.body, createdAt: r.createdAt,
    up: r.up, down: r.down, myVote: myVotes?.[r.id] ?? 0,
    mine: !!uid && r.userId === uid,
    official: r.userId === OFFICIAL_USER_ID,
    verified: VERIFIED_USER_IDS.has(r.userId),
  }
}

// The target's reviews with the caller's votes attached (shared by GET/POST/
// DELETE). `myVote` works signed-out too: the voter key falls back to the
// device's anon cookie (a freshly minted key has no votes, so skip the query).
async function listForTarget(request: Request, scope: string, targetId: string, uid?: string) {
  const { voter, setCookie } = getVoterFromRequest(request, uid)
  const [reviews, myVotes] = await Promise.all([
    dbGetReviews(scope, targetId),
    setCookie ? Promise.resolve({} as Record<string, number>) : dbMyReviewVotes(voter, scope, targetId),
  ])
  return reviews.map((r) => publicReview(r, uid, myVotes))
}

// GET = public list for a target. POST = auth-gated create (extensive body + optional
// 1-10 rating). DELETE ?id= = remove your own. POST/DELETE return the refreshed list.
export const Route = createFileRoute('/api/reviews')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        // ?by=mine — the signed-in user's own reviews (for their profile), newest first.
        if (url.searchParams.get('by') === 'mine') {
          const user = await getUserFromRequest(request)
          if (!user) return Response.json({ ok: false, error: 'Not signed in', data: [] }, { status: 401, headers: noStore })
          const data = (await dbGetReviewsByUser(user.id)).map((r) => publicReview(r, user.id))
          return Response.json({ ok: true, data }, { headers: noStore })
        }
        const scope = url.searchParams.get('scope') || ''
        const targetId = url.searchParams.get('targetId') || ''
        if (!SCOPES.has(scope) || !targetId) return Response.json({ ok: false, error: 'Bad request.', data: [] }, { status: 400, headers: noStore })
        const user = await getUserFromRequest(request)
        const data = await listForTarget(request, scope, targetId, user?.id)
        return Response.json({ ok: true, data }, { headers: noStore })
      },
      POST: async ({ request }) => {
        const user = await getUserFromRequest(request)
        if (!user) return Response.json({ ok: false, error: 'Sign in to write a review.' }, { status: 401, headers: noStore })
        let body: any
        try { body = await request.json() } catch { return Response.json({ ok: false, error: 'Invalid request.' }, { status: 400 }) }
        const scope = String(body?.scope ?? '')
        const targetId = String(body?.targetId ?? '')
        const gameId = body?.gameId != null ? String(body.gameId).slice(0, 40) : null
        const text = String(body?.body ?? '').trim()
        let rating: number | null = null
        if (body?.rating != null && body.rating !== '') {
          const n = Math.round(Number(body.rating))
          if (Number.isFinite(n) && n >= 1 && n <= 10) rating = n
        }
        if (!SCOPES.has(scope) || !targetId) return Response.json({ ok: false, error: 'Bad request.' }, { status: 400, headers: noStore })
        if (text.length < 1 || text.length > 4000) return Response.json({ ok: false, error: 'Review must be 1–4000 characters.' }, { status: 400, headers: noStore })
        const author = (user.username || user.email.split('@')[0] || 'fan').slice(0, 40)
        await dbAddReview(user.id, author, scope, targetId, gameId, rating, text)
        const data = await listForTarget(request, scope, targetId, user.id)
        return Response.json({ ok: true, data }, { headers: noStore })
      },
      DELETE: async ({ request }) => {
        const user = await getUserFromRequest(request)
        if (!user) return Response.json({ ok: false, error: 'Not signed in' }, { status: 401, headers: noStore })
        const url = new URL(request.url)
        const id = url.searchParams.get('id') || ''
        const scope = url.searchParams.get('scope') || ''
        const targetId = url.searchParams.get('targetId') || ''
        if (id) await dbDeleteReview(user.id, id)
        const data = SCOPES.has(scope) && targetId ? await listForTarget(request, scope, targetId, user.id) : []
        return Response.json({ ok: true, data }, { headers: noStore })
      },
    },
  },
})
