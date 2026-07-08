import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { db } from '#/lib/server/db'
import { getSession } from '#/lib/server/session'
import { jsonResponse, parseBody } from '#/lib/server/middleware'

export const Route = createFileRoute('/api/follow')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await getSession(request, env as any)
          if (!user) return jsonResponse({ error: 'Unauthorized' }, 401)

          const body = await parseBody<{ target_username: string }>(request)
          if (!body?.target_username) {
            return jsonResponse({ error: 'target_username is required' }, 400)
          }

          const database = db(env as any)
          const target = await database.first<{ id: string; username: string }>(
            'SELECT id, username FROM users WHERE username = ?',
            [body.target_username],
          )

          if (!target) return jsonResponse({ error: 'User not found' }, 404)

          if (target.id === user.id) {
            return jsonResponse({ error: 'You cannot follow yourself' }, 400)
          }

          const now = Date.now()
          await database.run(
            'INSERT OR IGNORE INTO follows (follower_id, following_id, created_at) VALUES (?, ?, ?)',
            [user.id, target.id, now],
          )

          return jsonResponse({ ok: true })
        } catch (err) {
          console.error('[follow POST] error', err)
          return jsonResponse({ error: 'Failed to follow user' }, 500)
        }
      },

      DELETE: async ({ request }) => {
        try {
          const user = await getSession(request, env as any)
          if (!user) return jsonResponse({ error: 'Unauthorized' }, 401)

          const body = await parseBody<{ target_username: string }>(request)
          if (!body?.target_username) {
            return jsonResponse({ error: 'target_username is required' }, 400)
          }

          const database = db(env as any)
          const target = await database.first<{ id: string }>(
            'SELECT id FROM users WHERE username = ?',
            [body.target_username],
          )

          if (!target) return jsonResponse({ error: 'User not found' }, 404)

          await database.run(
            'DELETE FROM follows WHERE follower_id = ? AND following_id = ?',
            [user.id, target.id],
          )

          return jsonResponse({ ok: true })
        } catch (err) {
          console.error('[follow DELETE] error', err)
          return jsonResponse({ error: 'Failed to unfollow user' }, 500)
        }
      },
    },
  },
})
