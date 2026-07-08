import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { getSession } from '#/lib/server/session'
import { jsonResponse } from '#/lib/server/middleware'
import type { PublicUser } from '#/lib/data-types'
import type { UserRow } from '#/lib/server/user-auth'

function toPublicUser(user: UserRow): PublicUser {
  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    avatar_url: user.avatar_url,
    bio: user.bio,
    created_at: user.created_at,
  }
}

export const Route = createFileRoute('/api/auth/me')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await getSession(request, env as any)

          if (!user) {
            return jsonResponse({ error: 'Unauthorized' }, 401)
          }

          return jsonResponse(
            { user: toPublicUser(user) },
            200,
            { 'Cache-Control': 'no-store' },
          )
        } catch (err) {
          console.error('[auth/me] error', err)
          return jsonResponse({ error: 'Failed to get current user' }, 500)
        }
      },
    },
  },
})
