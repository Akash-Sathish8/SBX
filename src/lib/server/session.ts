// Session management backed by Cloudflare D1.
//
// Sessions are stored in the `sessions` table:
//   CREATE TABLE sessions (
//     id         TEXT PRIMARY KEY,  -- the token (64-char hex)
//     user_id    TEXT NOT NULL,
//     expires_at INTEGER NOT NULL,  -- Unix ms
//     created_at INTEGER NOT NULL
//   );
//
// The token is set as an HttpOnly cookie (`sbx_session`) and used as the
// session primary key so there is no separate lookup table needed.

import type { DbEnv } from './db'
import { db } from './db'
import { generateSessionToken } from './user-auth'
import type { UserRow } from './user-auth'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
const COOKIE_NAME = 'sbx_session'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionRow {
  id: string
  user_id: string
  expires_at: number
  created_at: number
}

// ---------------------------------------------------------------------------
// Cookie parsing (mirrors the approach in src/casey/lib/server/auth.ts)
// ---------------------------------------------------------------------------

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    const k = part.slice(0, idx).trim()
    if (k === name) return decodeURIComponent(part.slice(idx + 1).trim())
  }
  return null
}

// ---------------------------------------------------------------------------
// Session CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new session for `userId`, persist it to D1, and return the token.
 * Store the returned token in the `sbx_session` cookie via `setSessionCookie`.
 */
export async function createSession(env: DbEnv, userId: string): Promise<string> {
  const token = generateSessionToken()
  const now = Date.now()
  await db(env).run(
    'INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
    [token, userId, now + SESSION_TTL_MS, now],
  )
  return token
}

/**
 * Parse the `sbx_session` cookie from the request, validate the session in
 * D1, and return the associated `UserRow` — or `null` if missing, expired, or
 * the user no longer exists.
 */
export async function getSession(request: Request, env: DbEnv): Promise<UserRow | null> {
  const token = readCookie(request.headers.get('cookie'), COOKIE_NAME)
  if (!token) return null

  // Single JOIN so we get the user in one round-trip.
  const row = await db(env).first<UserRow & { expires_at: number }>(
    `SELECT u.*, s.expires_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ?
     LIMIT 1`,
    [token],
  )

  if (!row) return null

  // Reject expired sessions (but keep the row in D1; a cleanup job can prune
  // stale rows periodically without blocking the hot path).
  if (row.expires_at < Date.now()) return null

  // Strip the session-join column before returning the plain UserRow.
  const { expires_at: _expires, ...user } = row
  return user as unknown as UserRow
}

/**
 * Delete a session by token (called on sign-out).
 */
export async function deleteSession(token: string, env: DbEnv): Promise<void> {
  await db(env).run('DELETE FROM sessions WHERE id = ?', [token])
}

// ---------------------------------------------------------------------------
// Cookie header strings
// ---------------------------------------------------------------------------

/**
 * Build a `Set-Cookie` header value that stores the session token.
 * Pass `secure: false` only in local dev (no HTTPS).
 */
export function setSessionCookie(token: string, secure: boolean): string {
  const expires = new Date(Date.now() + SESSION_TTL_MS).toUTCString()
  return (
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires}` +
    (secure ? '; Secure' : '')
  )
}

/**
 * Build a `Set-Cookie` header value that immediately expires the session
 * cookie (used on sign-out).
 */
export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
}
