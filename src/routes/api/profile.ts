import { createFileRoute } from '@tanstack/react-router'
import { getUserFromRequest } from '../../server/auth'
import { dbGetProfileFields, dbUpdateProfile, dbFollowCounts } from '../../server/db'

const noStore = { 'Cache-Control': 'no-store' }

// The signed-in user's OWN profile. This is the one endpoint that returns email
// (to the owner only) — the public-by-username endpoint never selects it.
export const Route = createFileRoute('/api/profile')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getUserFromRequest(request)
        if (!user) return Response.json({ ok: false, error: 'Not signed in' }, { status: 401, headers: noStore })
        const [fields, counts] = await Promise.all([dbGetProfileFields(user.id), dbFollowCounts(user.id)])
        return Response.json(
          { ok: true, profile: { username: user.username, email: user.email, ...fields, ...counts } },
          { headers: noStore },
        )
      },
      PATCH: async ({ request }) => {
        const user = await getUserFromRequest(request)
        if (!user) return Response.json({ ok: false, error: 'Sign in to edit your profile.' }, { status: 401, headers: noStore })
        let body: any
        try { body = await request.json() } catch { return Response.json({ ok: false, error: 'Invalid request.' }, { status: 400, headers: noStore }) }

        const patch: { displayName?: string | null; bio?: string | null; avatar?: string | null; favorites?: string[] } = {}

        if ('displayName' in body) {
          const dn = String(body.displayName ?? '').trim()
          if (dn.length > 40) return Response.json({ ok: false, error: 'Display name must be 40 characters or fewer.' }, { status: 400, headers: noStore })
          patch.displayName = dn || null
        }

        if ('bio' in body) {
          const bio = String(body.bio ?? '').trim()
          if (bio.length > 280) return Response.json({ ok: false, error: 'Bio must be 280 characters or fewer.' }, { status: 400, headers: noStore })
          patch.bio = bio || null
        }

        if ('avatar' in body) {
          const a = body.avatar
          if (a == null || a === '') {
            patch.avatar = null
          } else if (typeof a === 'string' && /^preset:\d{1,2}$/.test(a)) {
            patch.avatar = a
          } else if (typeof a === 'string' && a.startsWith('data:image/')) {
            // ~48KB cap on the stored data URL (a 128px webp is ~5-15KB).
            if (a.length > 50_000) return Response.json({ ok: false, error: 'Avatar image is too large.' }, { status: 400, headers: noStore })
            patch.avatar = a
          } else {
            return Response.json({ ok: false, error: 'Invalid avatar.' }, { status: 400, headers: noStore })
          }
        }

        if ('favorites' in body) {
          const raw = Array.isArray(body.favorites) ? body.favorites : []
          const ids = raw
            .filter((x: any) => typeof x === 'string' && /^[a-z0-9:_-]{1,40}$/i.test(x))
            .slice(0, 4)
          patch.favorites = ids
        }

        await dbUpdateProfile(user.id, patch)
        const fields = await dbGetProfileFields(user.id)
        return Response.json(
          { ok: true, profile: { username: user.username, email: user.email, ...fields } },
          { headers: noStore },
        )
      },
    },
  },
})
