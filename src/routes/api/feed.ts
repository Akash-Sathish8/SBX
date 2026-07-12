import { createFileRoute } from '@tanstack/react-router'
import { getUserFromRequest } from '@/lib/auth.functions'
import { dbGetFollowingFeed } from '../../server/db'

const noStore = { 'Cache-Control': 'no-store' }

// The signed-in user's following feed — recent logs + reviews from fans they
// follow, newest first. `?before=<ISO>` pages back (keyset cursor); `nextCursor`
// is the last item's createdAt (null when the page wasn't full).
export const Route = createFileRoute('/api/feed')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getUserFromRequest(request)
        if (!user) return Response.json({ ok: false, error: 'Not signed in', items: [] }, { status: 401, headers: noStore })
        const url = new URL(request.url)
        const before = url.searchParams.get('before') || undefined
        const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 20, 1), 50)
        const items = await dbGetFollowingFeed(user.id, { before, limit })
        const nextCursor = items.length === limit ? items[items.length - 1]!.createdAt : null
        return Response.json({ ok: true, items, nextCursor }, { headers: noStore })
      },
    },
  },
})
