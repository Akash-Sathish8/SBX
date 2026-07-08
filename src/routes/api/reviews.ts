import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { db } from '#/lib/server/db'
import { getSession } from '#/lib/server/session'
import { generateId } from '#/lib/server/user-auth'
import { jsonResponse, parseBody } from '#/lib/server/middleware'
import type { Review } from '#/lib/data-types'

export const Route = createFileRoute('/api/reviews')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url)
          const venueId = url.searchParams.get('venue_id')
          const gameId = url.searchParams.get('game_id')
          const limitParam = parseInt(url.searchParams.get('limit') ?? '20', 10)
          const offsetParam = parseInt(url.searchParams.get('offset') ?? '0', 10)
          const limit = Number.isNaN(limitParam) ? 20 : Math.min(limitParam, 100)
          const offset = Number.isNaN(offsetParam) ? 0 : offsetParam

          if (!venueId && !gameId) {
            return jsonResponse({ error: 'venue_id or game_id is required' }, 400)
          }

          const database = db(env as any)
          let reviews: Review[]

          if (venueId) {
            reviews = await database.query<Review>(
              `SELECT r.*, u.username, u.display_name, u.avatar_url
               FROM reviews r
               LEFT JOIN users u ON u.id = r.user_id
               WHERE r.venue_id = ?
               ORDER BY r.created_at DESC
               LIMIT ? OFFSET ?`,
              [venueId, limit, offset],
            )
          } else {
            reviews = await database.query<Review>(
              `SELECT r.*, u.username, u.display_name, u.avatar_url
               FROM reviews r
               LEFT JOIN users u ON u.id = r.user_id
               WHERE r.game_id = ?
               ORDER BY r.created_at DESC
               LIMIT ? OFFSET ?`,
              [gameId, limit, offset],
            )
          }

          return jsonResponse(reviews, 200, {
            'Cache-Control': 'no-store',
          })
        } catch (err) {
          console.error('[reviews GET] error', err)
          return jsonResponse({ error: 'Failed to fetch reviews' }, 500)
        }
      },

      POST: async ({ request }) => {
        try {
          const user = await getSession(request, env as any)
          if (!user) return jsonResponse({ error: 'Unauthorized' }, 401)

          const body = await parseBody<{
            venue_id?: string
            game_id?: string
            rating: number
            body: string
          }>(request)

          if (!body) return jsonResponse({ error: 'Invalid JSON body' }, 400)

          if (!body.venue_id && !body.game_id) {
            return jsonResponse({ error: 'venue_id or game_id is required' }, 400)
          }

          if (typeof body.rating !== 'number' || body.rating < 1 || body.rating > 10) {
            return jsonResponse({ error: 'rating must be a number between 1 and 10' }, 400)
          }

          if (typeof body.body !== 'string' || body.body.trim().length === 0) {
            return jsonResponse({ error: 'body is required' }, 400)
          }

          if (body.body.length > 4000) {
            return jsonResponse({ error: 'body must be 4000 characters or fewer' }, 400)
          }

          const id = generateId()
          const now = Date.now()

          await db(env as any).run(
            `INSERT INTO reviews (id, user_id, venue_id, game_id, rating, body, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              user.id,
              body.venue_id ?? null,
              body.game_id ?? null,
              body.rating,
              body.body.trim(),
              now,
              now,
            ],
          )

          return jsonResponse({ id, ok: true }, 201)
        } catch (err) {
          console.error('[reviews POST] error', err)
          return jsonResponse({ error: 'Failed to create review' }, 500)
        }
      },

      DELETE: async ({ request }) => {
        try {
          const user = await getSession(request, env as any)
          if (!user) return jsonResponse({ error: 'Unauthorized' }, 401)

          const url = new URL(request.url)
          const id = url.searchParams.get('id')

          if (!id) return jsonResponse({ error: 'id is required' }, 400)

          const database = db(env as any)
          const review = await database.first<{ user_id: string }>(
            'SELECT user_id FROM reviews WHERE id = ?',
            [id],
          )

          if (!review) return jsonResponse({ error: 'Review not found' }, 404)
          if (review.user_id !== user.id) {
            return jsonResponse({ error: 'Forbidden — not your review' }, 403)
          }

          await database.run('DELETE FROM reviews WHERE id = ?', [id])

          return jsonResponse({ ok: true })
        } catch (err) {
          console.error('[reviews DELETE] error', err)
          return jsonResponse({ error: 'Failed to delete review' }, 500)
        }
      },
    },
  },
})

