import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { db } from '#/lib/server/db'
import { getSession } from '#/lib/server/session'
import { jsonResponse, parseBody } from '#/lib/server/middleware'
import type { PublicUser, PersonalRanking, Review } from '#/lib/data-types'

interface ProfileStats {
  ranking_count: number
  review_count: number
  following_count: number
  follower_count: number
}

interface ProfileResponse {
  user: PublicUser
  stats: ProfileStats
  rankings: PersonalRanking[]
  reviews: Review[]
  pinned: PersonalRanking[]
}

export const Route = createFileRoute('/api/profile')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await getSession(request, env as any)
          if (!user) return jsonResponse({ error: 'Unauthorized' }, 401)

          const database = db(env as any)

          const [rankings, reviews, stats] = await Promise.all([
            database.query<PersonalRanking>(
              `SELECT r.*, e.venue_name, e.exp_name
               FROM rankings r
               LEFT JOIN experiences e ON e.id = r.experience_id
               WHERE r.user_id = ?
               ORDER BY r.updated_at DESC
               LIMIT 50`,
              [user.id],
            ),
            database.query<Review>(
              `SELECT r.*, u.username, u.display_name, u.avatar_url
               FROM reviews r
               LEFT JOIN users u ON u.id = r.user_id
               WHERE r.user_id = ?
               ORDER BY r.created_at DESC
               LIMIT 50`,
              [user.id],
            ),
            database.first<ProfileStats>(
              `SELECT
                 (SELECT COUNT(*) FROM rankings WHERE user_id = ?) as ranking_count,
                 (SELECT COUNT(*) FROM reviews WHERE user_id = ?) as review_count,
                 (SELECT COUNT(*) FROM follows WHERE follower_id = ?) as following_count,
                 (SELECT COUNT(*) FROM follows WHERE following_id = ?) as follower_count`,
              [user.id, user.id, user.id, user.id],
            ),
          ])

          const publicUser: PublicUser = {
            id: user.id,
            username: user.username,
            display_name: user.display_name,
            avatar_url: user.avatar_url,
            bio: user.bio,
            created_at: user.created_at,
          }

          const response: ProfileResponse = {
            user: publicUser,
            stats: stats ?? {
              ranking_count: 0,
              review_count: 0,
              following_count: 0,
              follower_count: 0,
            },
            rankings,
            reviews,
            pinned: [],
          }

          return jsonResponse(response, 200, { 'Cache-Control': 'no-store' })
        } catch (err) {
          console.error('[profile GET] error', err)
          return jsonResponse({ error: 'Failed to fetch profile' }, 500)
        }
      },

      PATCH: async ({ request }) => {
        try {
          const user = await getSession(request, env as any)
          if (!user) return jsonResponse({ error: 'Unauthorized' }, 401)

          const body = await parseBody<{
            display_name?: string
            bio?: string
            username?: string
          }>(request)

          if (!body) return jsonResponse({ error: 'Invalid JSON body' }, 400)

          const updates: Record<string, string | null> = {}

          if (body.display_name !== undefined) {
            if (typeof body.display_name !== 'string') {
              return jsonResponse({ error: 'display_name must be a string' }, 400)
            }
            updates['display_name'] = body.display_name.trim() || null
          }

          if (body.bio !== undefined) {
            if (typeof body.bio !== 'string') {
              return jsonResponse({ error: 'bio must be a string' }, 400)
            }
            if (body.bio.length > 500) {
              return jsonResponse({ error: 'bio must be 500 characters or fewer' }, 400)
            }
            updates['bio'] = body.bio.trim() || null
          }

          if (body.username !== undefined) {
            if (typeof body.username !== 'string') {
              return jsonResponse({ error: 'username must be a string' }, 400)
            }
            const uname = body.username.trim().toLowerCase()
            if (!/^[a-z0-9_]{3,30}$/.test(uname)) {
              return jsonResponse(
                { error: 'username must be 3–30 chars, letters/numbers/underscores only' },
                400,
              )
            }

            const database = db(env as any)
            const existing = await database.first<{ id: string }>(
              'SELECT id FROM users WHERE username = ? AND id != ?',
              [uname, user.id],
            )
            if (existing) {
              return jsonResponse({ error: 'Username is already taken' }, 409)
            }
            updates['username'] = uname
          }

          if (Object.keys(updates).length === 0) {
            return jsonResponse({ error: 'No fields to update' }, 400)
          }

          const setClauses = Object.keys(updates)
            .map(k => `${k} = ?`)
            .join(', ')
          const values = [...Object.values(updates), Date.now(), user.id]

          await db(env as any).run(
            `UPDATE users SET ${setClauses}, updated_at = ? WHERE id = ?`,
            values,
          )

          return jsonResponse({ ok: true })
        } catch (err) {
          console.error('[profile PATCH] error', err)
          return jsonResponse({ error: 'Failed to update profile' }, 500)
        }
      },
    },
  },
})
