import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { db } from '#/lib/server/db'
import { createUser, type UserRow } from '#/lib/server/user-auth'
import { createSession, setSessionCookie } from '#/lib/server/session'
import { jsonResponse, parseBody } from '#/lib/server/middleware'
import type { PublicUser } from '#/lib/data-types'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

export const Route = createFileRoute('/api/auth/register')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await parseBody<{
            email: string
            password: string
            display_name?: string
          }>(request)

          if (!body) return jsonResponse({ error: 'Invalid JSON body' }, 400)

          if (!body.email || typeof body.email !== 'string') {
            return jsonResponse({ error: 'email is required' }, 400)
          }

          const email = body.email.trim().toLowerCase()

          if (!EMAIL_REGEX.test(email)) {
            return jsonResponse({ error: 'Invalid email format' }, 400)
          }

          if (!body.password || typeof body.password !== 'string') {
            return jsonResponse({ error: 'password is required' }, 400)
          }

          if (body.password.length < 8) {
            return jsonResponse({ error: 'password must be at least 8 characters' }, 400)
          }

          const database = db(env as any)

          // Check email not already taken
          const existing = await database.first<{ id: string }>(
            'SELECT id FROM users WHERE email = ? LIMIT 1',
            [email],
          )
          if (existing) {
            return jsonResponse({ error: 'An account with this email already exists' }, 409)
          }

          const user = await createUser(env as any, {
            email,
            password: body.password,
            displayName: body.display_name?.trim() || undefined,
          })

          const token = await createSession(env as any, user.id)
          const isSecure = new URL(request.url).protocol === 'https:'
          const cookieHeader = setSessionCookie(token, isSecure)

          return jsonResponse(
            { user: toPublicUser(user) },
            201,
            { 'Set-Cookie': cookieHeader },
          )
        } catch (err) {
          console.error('[auth/register] error', err)
          return jsonResponse({ error: 'Registration failed' }, 500)
        }
      },
    },
  },
})
