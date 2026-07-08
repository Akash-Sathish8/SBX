import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { db } from '#/lib/server/db'
import { getSession } from '#/lib/server/session'
import { jsonResponse } from '#/lib/server/middleware'
import type { PublicUser, PersonalRanking, Review } from '#/lib/data-types'

interface PublicProfileData {
  user: PublicUser
  stats: {
    ranking_count: number
    review_count: number
    following_count: number
    follower_count: number
  }
  rankings: PersonalRanking[]
  reviews: Review[]
  is_following: boolean
}

export const Route = createFileRoute('/api/u/$username')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url)
          // Extract username from path: /api/u/:username
          const pathParts = url.pathname.split('/')
          const username = pathParts[pathParts.length - 1]

          if (!username) {
            return jsonResponse({ error: 'username is required' }, 400)
          }

          const database = db(env as any)

          const userRow = await database.first<PublicUser & { password_hash: unknown; google_id: unknown; email: unknown }>(
            'SELECT * FROM users WHERE username = ?',
            [username],
          )

          if (!userRow) {
            return jsonResponse({ error: 'User not found' }, 404)
          }

          const targetUserId = userRow.id

          // Get current session user (optional — for is_following)
          const sessionUser = await getSession(request, env as any)

          const [rankings, reviews, stats, followCheck] = await Promise.all([
            database.query<PersonalRanking>(
              `SELECT r.*, e.venue_name, e.exp_name
               FROM rankings r
               LEFT JOIN experiences e ON e.id = r.experience_id
               WHERE r.user_id = ?
               ORDER BY r.updated_at DESC
               LIMIT 50`,
              [targetUserId],
            ),
            database.query<Review>(
              `SELECT r.*, u.username, u.display_name, u.avatar_url
               FROM reviews r
               LEFT JOIN users u ON u.id = r.user_id
               WHERE r.user_id = ?
               ORDER BY r.created_at DESC
               LIMIT 50`,
              [targetUserId],
            ),
            database.first<{
              ranking_count: number
              review_count: number
              following_count: number
              follower_count: number
            }>(
              `SELECT
                 (SELECT COUNT(*) FROM rankings WHERE user_id = ?) as ranking_count,
                 (SELECT COUNT(*) FROM reviews WHERE user_id = ?) as review_count,
                 (SELECT COUNT(*) FROM follows WHERE follower_id = ?) as following_count,
                 (SELECT COUNT(*) FROM follows WHERE following_id = ?) as follower_count`,
              [targetUserId, targetUserId, targetUserId, targetUserId],
            ),
            sessionUser
              ? database.first<{ exists: number }>(
                  'SELECT 1 as exists FROM follows WHERE follower_id = ? AND following_id = ?',
                  [sessionUser.id, targetUserId],
                )
              : Promise.resolve(null),
          ])

          const publicUser: PublicUser = {
            id: userRow.id,
            username: userRow.username,
            display_name: userRow.display_name,
            avatar_url: userRow.avatar_url,
            bio: userRow.bio,
            created_at: userRow.created_at,
          }

          const response: PublicProfileData = {
            user: publicUser,
            stats: stats ?? {
              ranking_count: 0,
              review_count: 0,
              following_count: 0,
              follower_count: 0,
            },
            rankings,
            reviews,
            is_following: followCheck?.exists === 1,
          }

          return jsonResponse(response, 200, {
            'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
          })
        } catch (err) {
          console.error('[u.$username GET] error', err)
          return jsonResponse({ error: 'Failed to fetch user profile' }, 500)
        }
      },
    },
  },
})
