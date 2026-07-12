import { createFileRoute } from '@tanstack/react-router'
import { getUserFromRequest, getVoterFromRequest } from '@/lib/auth.functions'
import { dbGetTips, dbAddTip, dbDeleteTip, dbMyTipVotes, OFFICIAL_USER_ID, VERIFIED_USER_IDS, type Tip } from '../../server/db'

const noStore = { 'Cache-Control': 'no-store' }
const SCOPES = new Set(['venue', 'event'])
const isSlug = (s: any) => typeof s === 'string' && /^[a-z0-9:_-]{1,40}$/i.test(s)

// Strip the internal user_id; expose a `mine` flag so the author (and only the
// author) sees a delete control. Reads are public; the cookie is optional.
// `myVote` is the caller's own up/down (0 when signed out or not voted).
function publicTip(t: Tip, uid?: string, myVotes?: Record<string, number>) {
  return {
    id: t.id, scope: t.scope, targetId: t.targetId, section: t.section,
    author: t.author, avatar: t.avatar ?? null, body: t.body, createdAt: t.createdAt,
    up: t.up, down: t.down, myVote: myVotes?.[t.id] ?? 0,
    mine: !!uid && t.userId === uid,
    official: t.userId === OFFICIAL_USER_ID,
    verified: VERIFIED_USER_IDS.has(t.userId),
  }
}

// The target's tips with the caller's votes attached (shared by GET/POST/
// DELETE). `myVote` works signed-out too: the voter key falls back to the
// device's anon cookie (a freshly minted key has no votes, so skip the query).
async function listForTarget(request: Request, scope: string, targetId: string, uid?: string) {
  const { voter, setCookie } = getVoterFromRequest(request, uid)
  const [tips, myVotes] = await Promise.all([
    dbGetTips(scope, targetId),
    setCookie ? Promise.resolve({} as Record<string, number>) : dbMyTipVotes(voter, scope, targetId),
  ])
  return tips.map((t) => publicTip(t, uid, myVotes))
}

// GET = public list for a target. POST = auth-gated create. DELETE ?id= = remove
// your own. POST/DELETE return the refreshed list so the client adopts it.
export const Route = createFileRoute('/api/tips')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const scope = url.searchParams.get('scope') || ''
        const targetId = url.searchParams.get('targetId') || ''
        if (!SCOPES.has(scope) || !targetId) return Response.json({ ok: false, error: 'Bad request.', data: [] }, { status: 400, headers: noStore })
        const user = await getUserFromRequest(request)
        const data = await listForTarget(request, scope, targetId, user?.id)
        return Response.json({ ok: true, data }, { headers: noStore })
      },
      POST: async ({ request }) => {
        const user = await getUserFromRequest(request)
        if (!user) return Response.json({ ok: false, error: 'Sign in to add a tip.' }, { status: 401, headers: noStore })
        let body: any
        try { body = await request.json() } catch { return Response.json({ ok: false, error: 'Invalid request.' }, { status: 400 }) }
        const scope = String(body?.scope ?? '')
        const targetId = String(body?.targetId ?? '')
        const section = String(body?.section ?? '')
        const text = String(body?.body ?? '').trim()
        if (!SCOPES.has(scope) || !targetId || !isSlug(section)) return Response.json({ ok: false, error: 'Bad request.' }, { status: 400, headers: noStore })
        if (text.length < 1 || text.length > 500) return Response.json({ ok: false, error: 'Tip must be 1–500 characters.' }, { status: 400, headers: noStore })
        const author = (user.email.split('@')[0] || 'fan').slice(0, 40)
        await dbAddTip(user.id, author, scope, targetId, section, text)
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
        if (id) await dbDeleteTip(user.id, id)
        const data = SCOPES.has(scope) && targetId ? await listForTarget(request, scope, targetId, user.id) : []
        return Response.json({ ok: true, data }, { headers: noStore })
      },
    },
  },
})
