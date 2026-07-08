import { createFileRoute } from '@tanstack/react-router'
import {
  googleClientId, findOrCreateOAuthUser, signSession,
  sessionCookieHeader, isSecureRequest, normalizeEmail,
} from '../../../server/auth'

// POST /api/auth/google { accessToken } — exchanges a Google OAuth access token
// (from the client's Google Identity Services flow) for OUR session. The token is
// validated against Google's tokeninfo and we require aud === our own client id,
// so a token minted for a different app can't be replayed here.
export const Route = createFileRoute('/api/auth/google')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const clientId = googleClientId()
        if (!clientId) {
          return Response.json({ ok: false, error: 'Google sign-in is not configured.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
        }
        let body: any
        try { body = await request.json() } catch { return Response.json({ ok: false, error: 'Invalid request.' }, { status: 400 }) }
        const accessToken = String(body?.accessToken ?? '')
        if (!accessToken) return Response.json({ ok: false, error: 'Missing token.' }, { status: 400 })

        const info: any = await fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(accessToken))
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
        // The token must have been minted for OUR client (the id lands in `aud` or
        // `azp` for access tokens), else a token issued to another app could be replayed.
        if (!info || (info.aud !== clientId && info.azp !== clientId)) {
          return Response.json({ ok: false, error: 'Google sign-in failed.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
        }

        // tokeninfo usually carries the email for email-scoped access tokens, but not
        // always — fall back to the userinfo endpoint, which reliably returns it.
        let email = typeof info.email === 'string' ? info.email : ''
        let verified = info.email_verified === true || info.email_verified === 'true'
        if (!email) {
          const ui: any = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: 'Bearer ' + accessToken },
          }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
          if (ui?.email) { email = ui.email; verified = ui.email_verified === true || ui.email_verified === 'true' }
        }
        if (!email || !verified) {
          return Response.json({ ok: false, error: 'Google sign-in failed.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
        }

        const user = await findOrCreateOAuthUser(normalizeEmail(email))
        const token = await signSession({ uid: user.id, email: user.email })
        return Response.json(
          { ok: true, user },
          { headers: { 'Set-Cookie': sessionCookieHeader(token, isSecureRequest(request)), 'Cache-Control': 'no-store' } },
        )
      },
    },
  },
})
