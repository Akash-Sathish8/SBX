// Server-side auth helpers. `getSession` / `ensureSession` follow the TanStack
// Start integration guide (createServerFn + getRequestHeaders + auth.api.getSession)
// for use in route beforeLoad. The request-based helpers below
// (getUserFromRequest / getVoterFromRequest / findUserByUsername) are what the
// /api/* fetch handlers use — they read the session straight off the incoming
// Request, which is the same server pattern (auth.api.getSession({ headers })).
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { sql } from 'drizzle-orm'
import { auth } from './auth'
import { db } from '../server/db/client'
import { user } from '../server/db/schema'

// ---- TanStack Start server functions (docs convention) ----
export const getSession = createServerFn({ method: 'GET' }).handler(async () => {
  return auth.api.getSession({ headers: new Headers(getRequestHeaders() as HeadersInit) })
})

export const ensureSession = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await auth.api.getSession({ headers: new Headers(getRequestHeaders() as HeadersInit) })
  if (!session) throw new Error('Unauthorized')
  return session
})

// ---- the workhorse used by every protected /api handler ----
// `username` is the case-preserved handle (displayUsername) so authored content
// keeps showing the casing the fan typed.
export interface AuthUser { id: string; email: string; username: string | null }

export async function getUserFromRequest(request: Request): Promise<AuthUser | null> {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) return null
  const u = session.user as { id: string; email: string; username?: string | null; displayUsername?: string | null }
  return { id: u.id, email: u.email, username: u.displayUsername ?? u.username ?? null }
}

// ---- anonymous voter identity (review/tip votes work signed-out) ----
// A long-lived random id in its own cookie; signed-out votes key on 'anon:<id>' so
// one device gets one vote per item. Signing in switches the voter key to the real
// user id (the anon votes simply stop being "yours").
export const ANON_COOKIE = 'sbx_anon'
const ANON_MAX_AGE = 60 * 60 * 24 * 365

function isSecureRequest(request: Request): boolean {
  try { return new URL(request.url).protocol === 'https:' } catch { return false }
}

function anonCookieHeader(id: string, secure: boolean): string {
  return `${ANON_COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ANON_MAX_AGE}${secure ? '; Secure' : ''}`
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    if (part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim()
  }
  return null
}

// The voter key for vote reads/writes. When the device has no anon cookie yet a
// fresh id is minted and `setCookie` is returned — vote WRITES must attach it to
// the response; reads can ignore it (a fresh id has no votes anyway).
export function getVoterFromRequest(request: Request, userId?: string | null): { voter: string; setCookie?: string } {
  if (userId) return { voter: userId }
  const existing = readCookie(request, ANON_COOKIE)
  if (existing && /^[a-f0-9-]{8,64}$/i.test(existing)) return { voter: 'anon:' + existing }
  const id = crypto.randomUUID()
  return { voter: 'anon:' + id, setCookie: anonCookieHeader(id, isSecureRequest(request)) }
}

// ---- user lookup by public handle (follow flows) ----
// COLLATE NOCASE so mixed-case handles and normalized lowercase ones both resolve.
export async function findUserByUsername(username: string): Promise<{ id: string } | null> {
  const handle = String(username ?? '').trim()
  if (!handle) return null
  const rows = await db()
    .select({ id: user.id })
    .from(user)
    .where(sql`${user.username} = ${handle} COLLATE NOCASE`)
    .limit(1)
  return rows[0] ?? null
}
