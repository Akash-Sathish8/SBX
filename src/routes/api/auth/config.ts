import { createFileRoute } from '@tanstack/react-router'
import { googleConfigured } from '@/lib/auth'

// GET /api/auth/config — public client config. Tells the browser whether the
// Google button should be live (needs GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET
// on the worker; the redirect flow itself is Better Auth's).
export const Route = createFileRoute('/api/auth/config')({
  server: {
    handlers: {
      GET: async () =>
        Response.json({ ok: true, googleEnabled: googleConfigured() }, { headers: { 'Cache-Control': 'no-store' } }),
    },
  },
})
