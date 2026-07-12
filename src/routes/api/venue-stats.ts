import { createFileRoute } from '@tanstack/react-router'
import { dbVenueFanStats } from '../../server/queries'

// GET /api/venue-stats?venue=<name> -> the fan ranking for a venue: the average
// of every signed-in fan's ranking of a game there (user_rankings is keyed by the
// venue name). Public read; `count` is 0 until fans have ranked games here.
export const Route = createFileRoute('/api/venue-stats')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const venue = (new URL(request.url).searchParams.get('venue') || '').trim()
        if (!venue) return Response.json({ ok: false, error: 'venue is required.' }, { status: 400 })
        try {
          const data = await dbVenueFanStats(venue)
          // Live fan aggregate — never cache, so a fan's own just-submitted score
          // shows up immediately on the venue page.
          return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } })
        } catch (e: any) {
          return Response.json({ ok: false, error: String(e?.message || e) }, { status: 500 })
        }
      },
    },
  },
})
