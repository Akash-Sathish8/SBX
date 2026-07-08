import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { db } from '#/lib/server/db'
import { getSession } from '#/lib/server/session'
import { generateId } from '#/lib/server/user-auth'
import { jsonResponse, parseBody } from '#/lib/server/middleware'
import type { Tip } from '#/lib/data-types'

export const Route = createFileRoute('/api/tips')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url)
          const venueId = url.searchParams.get('venue_id')
          const gameId = url.searchParams.get('game_id')
          const section = url.searchParams.get('section')
          const limitParam = parseInt(url.searchParams.get('limit') ?? '20', 10)
          const offsetParam = parseInt(url.searchParams.get('offset') ?? '0', 10)
          const limit = Number.isNaN(limitParam) ? 20 : Math.min(limitParam, 100)
          const offset = Number.isNaN(offsetParam) ? 0 : offsetParam

          if (!venueId && !gameId) {
            return jsonResponse({ error: 'venue_id or game_id is required' }, 400)
          }

          const database = db(env as any)

          const conditions: string[] = []
          const params: unknown[] = []

          if (venueId) {
            conditions.push('t.venue_id = ?')
            params.push(venueId)
          } else if (gameId) {
            conditions.push('t.game_id = ?')
            params.push(gameId)
          }

          if (section) {
            conditions.push('t.section = ?')
            params.push(section)
          }

          const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
          params.push(limit, offset)

          const tips = await database.query<Tip>(
            `SELECT t.*, u.username, u.display_name
             FROM tips t
             LEFT JOIN users u ON u.id = t.user_id
             ${where}
             ORDER BY t.upvotes DESC, t.created_at DESC
             LIMIT ? OFFSET ?`,
            params,
          )

          return jsonResponse(tips, 200, { 'Cache-Control': 'no-store' })
        } catch (err) {
          console.error('[tips GET] error', err)
          return jsonResponse({ error: 'Failed to fetch tips' }, 500)
        }
      },

      POST: async ({ request }) => {
        try {
          const user = await getSession(request, env as any)
          if (!user) return jsonResponse({ error: 'Unauthorized' }, 401)

          const body = await parseBody<{
            venue_id?: string
            game_id?: string
            section: string
            body: string
          }>(request)

          if (!body) return jsonResponse({ error: 'Invalid JSON body' }, 400)

          if (!body.venue_id && !body.game_id) {
            return jsonResponse({ error: 'venue_id or game_id is required' }, 400)
          }

          if (typeof body.section !== 'string' || body.section.trim().length === 0) {
            return jsonResponse({ error: 'section is required' }, 400)
          }

          if (typeof body.body !== 'string' || body.body.trim().length === 0) {
            return jsonResponse({ error: 'body is required' }, 400)
          }

          if (body.body.length > 2000) {
            return jsonResponse({ error: 'body must be 2000 characters or fewer' }, 400)
          }

          const id = generateId()
          const now = Date.now()

          await db(env as any).run(
            `INSERT INTO tips (id, user_id, venue_id, game_id, section, body, upvotes, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
            [
              id,
              user.id,
              body.venue_id ?? null,
              body.game_id ?? null,
              body.section.trim(),
              body.body.trim(),
              now,
            ],
          )

          return jsonResponse({ id, ok: true }, 201)
        } catch (err) {
          console.error('[tips POST] error', err)
          return jsonResponse({ error: 'Failed to create tip' }, 500)
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
          const tip = await database.first<{ user_id: string }>(
            'SELECT user_id FROM tips WHERE id = ?',
            [id],
          )

          if (!tip) return jsonResponse({ error: 'Tip not found' }, 404)
          if (tip.user_id !== user.id) {
            return jsonResponse({ error: 'Forbidden — not your tip' }, 403)
          }

          await database.run('DELETE FROM tips WHERE id = ?', [id])

          return jsonResponse({ ok: true })
        } catch (err) {
          console.error('[tips DELETE] error', err)
          return jsonResponse({ error: 'Failed to delete tip' }, 500)
        }
      },
    },
  },
})
