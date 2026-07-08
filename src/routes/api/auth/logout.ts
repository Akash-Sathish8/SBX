import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { deleteSession, clearSessionCookie } from '#/lib/server/session'
import { jsonResponse } from '#/lib/server/middleware'

const COOKIE_NAME = 'sbx_session'

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim())
  }
  return null
}

export const Route = createFileRoute('/api/auth/logout')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const token = readCookie(request.headers.get('cookie'), COOKIE_NAME)

          if (token) {
            // Delete from D1 — fire and forget is fine, don't block the response
            await deleteSession(token, env as any).catch(err => {
              console.error('[auth/logout] failed to delete session', err)
            })
          }

          const cookieHeader = clearSessionCookie()

          return jsonResponse(
            { ok: true },
            200,
            { 'Set-Cookie': cookieHeader },
          )
        } catch (err) {
          console.error('[auth/logout] error', err)
          // Still clear the cookie even if the DB delete failed
          return jsonResponse(
            { ok: true },
            200,
            { 'Set-Cookie': clearSessionCookie() },
          )
        }
      },
    },
  },
})
