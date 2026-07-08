import { createFileRoute } from '@tanstack/react-router'
import { getUserFromRequest } from '../../../server/auth'

// GET /api/auth/me -> { ok, user: { id, email } | null }. Called on every client
// mount; `user: null` (signed out) is a normal 200, not an error.
export const Route = createFileRoute('/api/auth/me')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getUserFromRequest(request)
        return Response.json({ ok: true, user }, { headers: { 'Cache-Control': 'no-store' } })
      },
    },
  },
})
