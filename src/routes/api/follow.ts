import { createFileRoute } from '@tanstack/react-router'
import { getUserFromRequest, findUserByUsername } from '@/lib/auth.functions'
import { dbFollow, dbUnfollow, dbFollowCounts } from '../../server/db'

const noStore = { 'Cache-Control': 'no-store' }

// Follow / unfollow another fan by username. Auth-gated; self-follow rejected.
// Returns the followee's refreshed follower count + the viewer's isFollowing.
export const Route = createFileRoute('/api/follow')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getUserFromRequest(request)
        if (!user) return Response.json({ ok: false, error: 'Sign in to follow fans.' }, { status: 401, headers: noStore })
        let body: any
        try { body = await request.json() } catch { return Response.json({ ok: false, error: 'Invalid request.' }, { status: 400, headers: noStore }) }
        const target = await findUserByUsername(String(body?.username ?? ''))
        if (!target) return Response.json({ ok: false, error: 'No such fan.' }, { status: 404, headers: noStore })
        if (target.id === user.id) return Response.json({ ok: false, error: "You can't follow yourself." }, { status: 400, headers: noStore })
        await dbFollow(user.id, target.id)
        const { followers } = await dbFollowCounts(target.id)
        return Response.json({ ok: true, isFollowing: true, followers }, { headers: noStore })
      },
      DELETE: async ({ request }) => {
        const user = await getUserFromRequest(request)
        if (!user) return Response.json({ ok: false, error: 'Not signed in' }, { status: 401, headers: noStore })
        const username = new URL(request.url).searchParams.get('username') || ''
        const target = await findUserByUsername(username)
        if (!target) return Response.json({ ok: false, error: 'No such fan.' }, { status: 404, headers: noStore })
        await dbUnfollow(user.id, target.id)
        const { followers } = await dbFollowCounts(target.id)
        return Response.json({ ok: true, isFollowing: false, followers }, { headers: noStore })
      },
    },
  },
})
