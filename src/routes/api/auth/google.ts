import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { db } from '#/lib/server/db'
import {
  exchangeGoogleCode,
  createUser,
  type UserRow,
  type GoogleOAuthConfig,
} from '#/lib/server/user-auth'
import { createSession, setSessionCookie } from '#/lib/server/session'

export const Route = createFileRoute('/api/auth/google')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url)
          const code = url.searchParams.get('code')
          const state = url.searchParams.get('state')

          if (!code) {
            return new Response(null, {
              status: 302,
              headers: { Location: '/?error=missing_code' },
            })
          }

          const anyEnv = env as any
          const clientId: string | undefined = anyEnv.GOOGLE_CLIENT_ID
          const clientSecret: string | undefined = anyEnv.GOOGLE_CLIENT_SECRET

          if (!clientId || !clientSecret) {
            console.error('[auth/google] missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET')
            return new Response(null, {
              status: 302,
              headers: { Location: '/?error=oauth_not_configured' },
            })
          }

          // Determine redirect URI (origin + /api/auth/google)
          const redirectUri = `${url.origin}/api/auth/google`

          const oauthConfig: GoogleOAuthConfig = {
            clientId,
            clientSecret,
            redirectUri,
          }

          let googleUser
          try {
            googleUser = await exchangeGoogleCode(oauthConfig, code)
          } catch (err) {
            console.error('[auth/google] code exchange failed', err)
            return new Response(null, {
              status: 302,
              headers: { Location: '/?error=oauth_failed' },
            })
          }

          const database = db(anyEnv)

          // Try to find existing user by google_id first, then by email
          let user = await database.first<UserRow>(
            'SELECT * FROM users WHERE google_id = ? LIMIT 1',
            [googleUser.id],
          )

          if (!user) {
            // Try by email (might have signed up with password before)
            user = await database.first<UserRow>(
              'SELECT * FROM users WHERE email = ? LIMIT 1',
              [googleUser.email],
            )

            if (user) {
              // Link the Google account to the existing user
              await database.run(
                'UPDATE users SET google_id = ?, avatar_url = COALESCE(avatar_url, ?), updated_at = ? WHERE id = ?',
                [googleUser.id, googleUser.picture, Date.now(), user.id],
              )
              // Refresh user row
              user = await database.first<UserRow>('SELECT * FROM users WHERE id = ?', [user.id])
            } else {
              // Create a new user
              user = await createUser(anyEnv, {
                email: googleUser.email,
                googleId: googleUser.id,
                displayName: googleUser.name,
                avatarUrl: googleUser.picture,
              })
            }
          }

          if (!user) {
            return new Response(null, {
              status: 302,
              headers: { Location: '/?error=user_creation_failed' },
            })
          }

          const token = await createSession(anyEnv, user.id)
          const isSecure = url.protocol === 'https:'
          const cookieHeader = setSessionCookie(token, isSecure)

          // Redirect to the app root (or state URL if valid same-origin)
          let redirectTo = '/'
          if (state) {
            try {
              const stateUrl = new URL(state, url.origin)
              if (stateUrl.origin === url.origin) {
                redirectTo = stateUrl.pathname + stateUrl.search
              }
            } catch {
              // invalid state — use default
            }
          }

          return new Response(null, {
            status: 302,
            headers: {
              Location: redirectTo,
              'Set-Cookie': cookieHeader,
            },
          })
        } catch (err) {
          console.error('[auth/google] error', err)
          return new Response(null, {
            status: 302,
            headers: { Location: '/?error=server_error' },
          })
        }
      },
    },
  },
})
