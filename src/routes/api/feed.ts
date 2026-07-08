import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { db } from '#/lib/server/db'
import { getSession } from '#/lib/server/session'
import { jsonResponse } from '#/lib/server/middleware'

const PAGE_SIZE = 20

interface ReviewFeedItem {
  type: 'review'
  data: {
    id: string
    user_id: string
    username: string | null
    display_name: string | null
    avatar_url: string | null
    venue_id: string | null
    game_id: string | null
    rating: number
    body: string | null
    created_at: number
    updated_at: number
    // cursor anchor
    _cursor_ts: number
  }
}

interface RankingFeedItem {
  type: 'ranking'
  data: {
    id: string
    user_id: string
    username: string | null
    display_name: string | null
    avatar_url: string | null
    experience_id: string
    venue_name: string | null
    exp_name: string | null
    fans_score: number | null
    food_score: number | null
    unique_score: number | null
    stadium_score: number | null
    notes: string | null
    attended_at: number | null
    created_at: number
    updated_at: number
    _cursor_ts: number
  }
}

type FeedItem = ReviewFeedItem | RankingFeedItem

export const Route = createFileRoute('/api/feed')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await getSession(request, env as any)
          if (!user) return jsonResponse({ error: 'Unauthorized' }, 401)

          const url = new URL(request.url)
          const cursorParam = url.searchParams.get('cursor')

          // Cursor is an ISO timestamp of the oldest item seen so far
          const cursorTs = cursorParam ? new Date(cursorParam).getTime() : null
          const cutoff = cursorTs && !Number.isNaN(cursorTs) ? cursorTs : Date.now()

          const database = db(env as any)

          // Get list of followed user IDs
          const followRows = await database.query<{ following_id: string }>(
            'SELECT following_id FROM follows WHERE follower_id = ?',
            [user.id],
          )

          if (followRows.length === 0) {
            return jsonResponse({ items: [], cursor: null }, 200, {
              'Cache-Control': 'no-store',
            })
          }

          const followedIds = followRows.map(r => r.following_id)
          const placeholders = followedIds.map(() => '?').join(', ')

          // Fetch recent reviews and rankings in parallel, filter by cursor
          const [reviews, rankings] = await Promise.all([
            database.query<ReviewFeedItem['data']>(
              `SELECT r.*, u.username, u.display_name, u.avatar_url, r.created_at as _cursor_ts
               FROM reviews r
               LEFT JOIN users u ON u.id = r.user_id
               WHERE r.user_id IN (${placeholders})
                 AND r.created_at < ?
               ORDER BY r.created_at DESC
               LIMIT ?`,
              [...followedIds, cutoff, PAGE_SIZE],
            ),
            database.query<RankingFeedItem['data']>(
              `SELECT r.*, u.username, u.display_name, u.avatar_url, e.venue_name, e.exp_name, r.updated_at as _cursor_ts
               FROM rankings r
               LEFT JOIN users u ON u.id = r.user_id
               LEFT JOIN experiences e ON e.id = r.experience_id
               WHERE r.user_id IN (${placeholders})
                 AND r.updated_at < ?
               ORDER BY r.updated_at DESC
               LIMIT ?`,
              [...followedIds, cutoff, PAGE_SIZE],
            ),
          ])

          // Merge and sort by timestamp descending, take PAGE_SIZE
          const items: FeedItem[] = [
            ...reviews.map(d => ({ type: 'review' as const, data: d })),
            ...rankings.map(d => ({ type: 'ranking' as const, data: d })),
          ].sort((a, b) => b.data._cursor_ts - a.data._cursor_ts).slice(0, PAGE_SIZE)

          // Next cursor: timestamp of last item (oldest in this page)
          const lastItem = items[items.length - 1]
          const nextCursor: string | null =
            items.length === PAGE_SIZE && lastItem
              ? new Date(lastItem.data._cursor_ts).toISOString()
              : null

          return jsonResponse({ items, cursor: nextCursor }, 200, {
            'Cache-Control': 'no-store',
          })
        } catch (err) {
          console.error('[feed GET] error', err)
          return jsonResponse({ error: 'Failed to fetch feed' }, 500)
        }
      },
    },
  },
})
