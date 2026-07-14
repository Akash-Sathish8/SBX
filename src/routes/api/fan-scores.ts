import { createFileRoute } from '@tanstack/react-router'
import { dbAllVenueFanStats } from '../../server/queries'

// GET /api/fan-scores -> { [venueId]: { score, count } } for every venue that has
// fan ratings. One query so listing pages (venues grid, nearby, search, home) can
// show fan scores without an N+1 of /api/venue-stats calls. Cards tolerate slight
// staleness, so this is short-cached (the venue-page hero stays live/no-store).
export const Route = createFileRoute('/api/fan-scores')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const data = await dbAllVenueFanStats()
          return Response.json({ ok: true, data }, {
            headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=300' },
          })
        } catch (e: any) {
          return Response.json({ ok: false, error: String(e?.message || e) }, { status: 500 })
        }
      },
    },
  },
})
