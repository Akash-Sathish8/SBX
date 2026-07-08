// Server-side middleware utilities for Field Guide API routes.
//
// `requireAuth`  — wraps a handler to enforce session authentication (401 JSON on failure)
// `jsonResponse` — builds a typed JSON Response with correct Content-Type
// `parseBody`    — safely parses a JSON request body (returns null on failure)

import type { DbEnv } from './db'
import { getSession } from './session'
import type { UserRow } from './user-auth'

// ---------------------------------------------------------------------------
// Handler types
// ---------------------------------------------------------------------------

/**
 * An API handler that receives an authenticated user.
 */
export type AuthenticatedHandler = (
  request: Request,
  env: DbEnv & Record<string, unknown>,
  user: UserRow,
) => Promise<Response>

/**
 * A plain API handler (no auth requirement).
 */
export type Handler = (
  request: Request,
  env: DbEnv & Record<string, unknown>,
) => Promise<Response>

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

/**
 * Wrap a handler so it requires a valid session cookie.
 * Returns `401 { error: "Unauthorized" }` if the session is missing or expired.
 *
 * Usage:
 *   export const GET = requireAuth(async (request, env, user) => {
 *     return jsonResponse({ id: user.id })
 *   })
 */
export function requireAuth(handler: AuthenticatedHandler): Handler {
  return async (request, env) => {
    const user = await getSession(request, env)
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return handler(request, env, user)
  }
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

/**
 * Build a JSON `Response` with the correct `Content-Type` header.
 *
 * @param data    - Any JSON-serialisable value.
 * @param status  - HTTP status code (default 200).
 * @param headers - Additional headers to merge in (e.g. `Set-Cookie`, CORS).
 */
export function jsonResponse(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  })
}

// ---------------------------------------------------------------------------
// Body parsing
// ---------------------------------------------------------------------------

/**
 * Parse the JSON body of a request.
 * Returns `null` (never throws) if the body is missing or malformed.
 *
 * Usage:
 *   const body = await parseBody<{ email: string; password: string }>(request)
 *   if (!body) return jsonResponse({ error: 'Invalid JSON' }, 400)
 */
export async function parseBody<T = unknown>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}
