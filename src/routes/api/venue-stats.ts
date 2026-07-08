import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { db } from '#/lib/server/db'

interface VenueStats {
  avg_rating: number | null
  review_count: number
  avg_fans: number | null
  avg_food: number | null
  avg_unique: number | null
  avg_stadium: number | null
  ranking_count: number
}

export const Route = createFileRoute('/api/venue-stats')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url)
          const venueId = url.searchParams.get('venue_id')

          if (!venueId) {
            return Response.json({ error: 'venue_id is required' }, { status: 400 })
          }

          const database = db(env as any)

          // Fetch review stats and ranking stats in parallel
          const [reviewStats, rankingStats] = await Promise.all([
            database.first<{ avg_rating: number | null; review_count: number }>(
              'SELECT AVG(rating) as avg_rating, COUNT(*) as review_count FROM reviews WHERE venue_id = ?',
              [venueId],
            ),
            database.first<{
              avg_fans: number | null
              avg_food: number | null
              avg_unique: number | null
              avg_stadium: number | null
              ranking_count: number
            }>(
              `SELECT
                AVG(r.fans_score) as avg_fans,
                AVG(r.food_score) as avg_food,
                AVG(r.unique_score) as avg_unique,
                AVG(r.stadium_score) as avg_stadium,
                COUNT(*) as ranking_count
               FROM rankings r
               JOIN experiences e ON e.id = r.experience_id
               WHERE e.venue_id = ?`,
              [venueId],
            ),
          ])

          const stats: VenueStats = {
            avg_rating: reviewStats?.avg_rating ?? null,
            review_count: reviewStats?.review_count ?? 0,
            avg_fans: rankingStats?.avg_fans ?? null,
            avg_food: rankingStats?.avg_food ?? null,
            avg_unique: rankingStats?.avg_unique ?? null,
            avg_stadium: rankingStats?.avg_stadium ?? null,
            ranking_count: rankingStats?.ranking_count ?? 0,
          }

          return Response.json(stats, {
            headers: { 'Cache-Control': 'no-store' },
          })
        } catch (err) {
          console.error('[venue-stats] error', err)
          return Response.json({ error: 'Failed to fetch venue stats' }, { status: 500 })
        }
      },
    },
  },
})
