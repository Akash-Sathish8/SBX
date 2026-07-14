import { createFileRoute } from '@tanstack/react-router'
import { dbVenueFanStats } from '../../server/queries'

// GET /api/venue-stats?venueId=<id>&venue=<name> -> the fan ranking for a venue:
// the average of every signed-in fan's ranking of a game there. New ratings key on
// venue id; legacy ones on the name, so pass both (either alone works). Public read;
// `count` is 0 until fans have ranked games here.
export const Route = createFileRoute('/api/venue-stats')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const params = new URL(request.url).searchParams
        const venueId = (params.get('venueId') || '').trim()
        const venue = (params.get('venue') || '').trim()
        if (!venueId && !venue) return Response.json({ ok: false, error: 'venueId or venue is required.' }, { status: 400 })
        try {
          const data = await dbVenueFanStats({ venueId: venueId || undefined, name: venue || undefined })
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
