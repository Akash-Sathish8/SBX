import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { db } from '#/lib/server/db'
import { verifyPassword, type UserRow } from '#/lib/server/user-auth'
import { createSession, setSessionCookie } from '#/lib/server/session'
import { jsonResponse, parseBody } from '#/lib/server/middleware'
import type { PublicUser } from '#/lib/data-types'

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

export const Route = createFileRoute('/api/auth/login')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await parseBody<{ email: string; password: string }>(request)

          if (!body) return jsonResponse({ error: 'Invalid JSON body' }, 400)

          if (!body.email || typeof body.email !== 'string') {
            return jsonResponse({ error: 'email is required' }, 400)
          }

          if (!body.password || typeof body.password !== 'string') {
            return jsonResponse({ error: 'password is required' }, 400)
          }

          const database = db(env as any)
          const user = await database.first<UserRow>(
            'SELECT * FROM users WHERE email = ? LIMIT 1',
            [body.email.trim().toLowerCase()],
          )

          // Use a constant-time path to avoid email enumeration
          if (!user || !user.password_hash) {
            // Still run verifyPassword with a dummy hash to burn similar time
            await verifyPassword(body.password, 'pbkdf2$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000')
            return jsonResponse({ error: 'Invalid email or password' }, 401)
          }

          const valid = await verifyPassword(body.password, user.password_hash)
          if (!valid) {
            return jsonResponse({ error: 'Invalid email or password' }, 401)
          }

          const token = await createSession(env as any, user.id)
          const isSecure = new URL(request.url).protocol === 'https:'
          const cookieHeader = setSessionCookie(token, isSecure)

          return jsonResponse(
            { user: toPublicUser(user) },
            200,
            { 'Set-Cookie': cookieHeader },
          )
        } catch (err) {
          console.error('[auth/login] error', err)
          return jsonResponse({ error: 'Login failed' }, 500)
        }
      },
    },
  },
})
