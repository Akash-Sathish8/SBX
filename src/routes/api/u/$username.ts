import { createFileRoute } from '@tanstack/react-router'
import { getUserFromRequest } from '../../../server/auth'
import { dbGetPublicProfile, dbIsFollowing, OFFICIAL_USER_ID, type Review } from '../../../server/db'

const noStore = { 'Cache-Control': 'no-store' }

// Strip the internal user_id; never leak it. `mine` = the viewer wrote it.
function publicReview(r: Review, viewerId?: string) {
  return {
    id: r.id, scope: r.scope, targetId: r.targetId, gameId: r.gameId, rating: r.rating,
    body: r.body, createdAt: r.createdAt,
    official: r.userId === OFFICIAL_USER_ID,
    mine: !!viewerId && r.userId === viewerId,
  }
}

// Public, by-username profile (Letterboxd-style). Anyone can read it; the cookie
// is optional and only used to compute isFollowing/mine. Email is never returned
// (dbGetPublicProfile doesn't select it).
export const Route = createFileRoute('/api/u/$username')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const username = String((params as any)?.username ?? '').trim()
        if (!username) return Response.json({ ok: false, error: 'Not found' }, { status: 404, headers: noStore })

        const profile = await dbGetPublicProfile(username)
        if (!profile) return Response.json({ ok: false, error: 'Not found' }, { status: 404, headers: noStore })

        const viewer = await getUserFromRequest(request)
        const mine = !!viewer && viewer.id === profile.userId
        const isFollowing = viewer && !mine ? await dbIsFollowing(viewer.id, profile.userId) : false

        return Response.json(
          {
            ok: true,
            profile: {
              username: profile.username,
              displayName: profile.displayName,
              bio: profile.bio,
              avatar: profile.avatar,
              createdAt: profile.createdAt,
              favorites: profile.favorites,
              rankings: profile.rankings,
              reviews: profile.reviews.map((r) => publicReview(r, viewer?.id)),
              followers: profile.followers,
              following: profile.following,
              isFollowing,
              mine,
            },
          },
          { headers: noStore },
        )
      },
    },
  },
})
