import { createFileRoute } from '@tanstack/react-router'
import {
  findUserByEmail, verifyPassword, dummyVerify, signSession,
  sessionCookieHeader, isSecureRequest, isValidEmail, normalizeEmail,
} from '../../../server/auth'

// POST /api/auth/login { email, password }. One generic error for any failure
// (+ a dummy hash when the email is unknown) so it can't be used to enumerate users.
export const Route = createFileRoute('/api/auth/login')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: any
        try { body = await request.json() } catch { return Response.json({ ok: false, error: 'Invalid request.' }, { status: 400 }) }
        const email = normalizeEmail(body?.email)
        const password = String(body?.password ?? '')
        const GENERIC = 'Invalid email or password.'
        if (!isValidEmail(email) || !password) {
          await dummyVerify(password)
          return Response.json({ ok: false, error: GENERIC }, { status: 401 })
        }
        const u = await findUserByEmail(email)
        if (!u) {
          await dummyVerify(password)
          return Response.json({ ok: false, error: GENERIC }, { status: 401 })
        }
        if (!(await verifyPassword(password, u.password_hash))) {
          return Response.json({ ok: false, error: GENERIC }, { status: 401 })
        }
        const token = await signSession({ uid: u.id, email: u.email })
        return Response.json(
          { ok: true, user: { id: u.id, email: u.email, username: u.username ?? null } },
          { headers: { 'Set-Cookie': sessionCookieHeader(token, isSecureRequest(request)), 'Cache-Control': 'no-store' } },
        )
      },
    },
  },
})
