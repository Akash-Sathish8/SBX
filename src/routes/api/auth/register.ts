import { createFileRoute } from '@tanstack/react-router'
import {
  createUser, signSession, sessionCookieHeader, isSecureRequest,
  isValidEmail, isValidPassword, isValidUsername, normalizeEmail, normalizeUsername,
} from '../../../server/auth'

// POST /api/auth/register { email, username, password } -> sets session cookie, returns user.
export const Route = createFileRoute('/api/auth/register')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: any
        try { body = await request.json() } catch { return Response.json({ ok: false, error: 'Invalid request.' }, { status: 400 }) }
        const email = normalizeEmail(body?.email)
        const username = normalizeUsername(body?.username)
        const password = String(body?.password ?? '')
        if (!isValidEmail(email)) return Response.json({ ok: false, error: 'Enter a valid email.' }, { status: 400 })
        if (!isValidUsername(username)) return Response.json({ ok: false, error: 'Username must be 3-20 letters, numbers, or underscores.' }, { status: 400 })
        if (!isValidPassword(password)) return Response.json({ ok: false, error: 'Password must be at least 8 characters.' }, { status: 400 })
        try {
          const user = await createUser(email, password, username)
          const token = await signSession({ uid: user.id, email: user.email })
          return Response.json(
            { ok: true, user },
            { headers: { 'Set-Cookie': sessionCookieHeader(token, isSecureRequest(request)), 'Cache-Control': 'no-store' } },
          )
        } catch (e: any) {
          const m = String(e?.message)
          if (m === 'USERNAME_TAKEN') return Response.json({ ok: false, error: 'That username is taken. Pick another.' }, { status: 409 })
          if (m === 'EMAIL_TAKEN') return Response.json({ ok: false, error: 'That email is already registered.' }, { status: 409 })
          return Response.json({ ok: false, error: 'Could not create account.' }, { status: 500 })
        }
      },
    },
  },
})
