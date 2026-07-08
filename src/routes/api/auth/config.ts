import { createFileRoute } from '@tanstack/react-router'
import { googleClientId } from '../../../server/auth'

// GET /api/auth/config — public client config. The Google client id is public, so
// the browser fetches it here to initialize the Google Identity Services flow.
export const Route = createFileRoute('/api/auth/config')({
  server: {
    handlers: {
      GET: async () =>
        Response.json({ ok: true, googleClientId: googleClientId() }, { headers: { 'Cache-Control': 'no-store' } }),
    },
  },
})
