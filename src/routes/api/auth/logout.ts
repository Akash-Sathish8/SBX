import { createFileRoute } from '@tanstack/react-router'
import { clearCookieHeader, isSecureRequest } from '../../../server/auth'

// POST /api/auth/logout -> clears the session cookie. Idempotent.
export const Route = createFileRoute('/api/auth/logout')({
  server: {
    handlers: {
      POST: async ({ request }) =>
        Response.json(
          { ok: true },
          { headers: { 'Set-Cookie': clearCookieHeader(isSecureRequest(request)), 'Cache-Control': 'no-store' } },
        ),
    },
  },
})
