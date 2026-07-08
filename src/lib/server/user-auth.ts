// User authentication helpers for Cloudflare Workers.
//
// Password hashing uses PBKDF2 via the Web Crypto API (no Node.js crypto).
// Stored format:  "pbkdf2$<salt_hex>$<hash_hex>"
//
// Google OAuth helpers use the standard Authorization Code flow (no PKCE needed
// for server-side confidential clients).

import type { DbEnv } from './db'
import { db } from './db'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Encode a Uint8Array to a lowercase hex string. */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Decode a lowercase hex string to a Uint8Array. */
function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

// ---------------------------------------------------------------------------
// Password hashing — PBKDF2 + SHA-256
// ---------------------------------------------------------------------------

const PBKDF2_ITERATIONS = 100_000
const PBKDF2_HASH = 'SHA-256'
const KEY_LENGTH_BYTES = 32

/**
 * Hash a plaintext password.
 * Returns a self-contained string:  "pbkdf2$<salt_hex>$<hash_hex>"
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password).buffer as ArrayBuffer,
    'PBKDF2',
    false,
    ['deriveBits'],
  )

  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH,
    },
    keyMaterial,
    KEY_LENGTH_BYTES * 8,
  )

  return `pbkdf2$${toHex(salt)}$${toHex(new Uint8Array(derived))}`
}

/**
 * Verify a plaintext password against a stored hash string.
 * Uses a constant-time comparison to prevent timing attacks.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 'pbkdf2') return false

  const salt = fromHex(parts[1])
  const expectedHash = fromHex(parts[2])

  let keyMaterial: CryptoKey
  try {
    keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password).buffer as ArrayBuffer,
      'PBKDF2',
      false,
      ['deriveBits'],
    )
  } catch {
    return false
  }

  let derived: ArrayBuffer
  try {
    derived = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt.buffer as ArrayBuffer,
        iterations: PBKDF2_ITERATIONS,
        hash: PBKDF2_HASH,
      },
      keyMaterial,
      KEY_LENGTH_BYTES * 8,
    )
  } catch {
    return false
  }

  const candidateHash = new Uint8Array(derived)

  // Timing-safe comparison: always iterate through the full length.
  if (candidateHash.length !== expectedHash.length) return false
  let diff = 0
  for (let i = 0; i < candidateHash.length; i++) {
    diff |= candidateHash[i] ^ expectedHash[i]
  }
  return diff === 0
}

// ---------------------------------------------------------------------------
// Token / ID generation
// ---------------------------------------------------------------------------

/** Generate a 32-byte session token as a 64-character hex string. */
export function generateSessionToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return toHex(bytes)
}

/** Generate a UUID v4 using the runtime's built-in. */
export function generateId(): string {
  return crypto.randomUUID()
}

// ---------------------------------------------------------------------------
// User row type
// ---------------------------------------------------------------------------

export interface UserRow {
  id: string
  email: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  google_id: string | null
  password_hash: string | null
  created_at: number
  updated_at: number
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * Insert a new user record and return the full row.
 * Pass `password` for email/password sign-up, `googleId` for OAuth.
 */
export async function createUser(
  env: DbEnv,
  opts: {
    email: string
    password?: string
    googleId?: string
    displayName?: string
    avatarUrl?: string
  },
): Promise<UserRow> {
  const id = generateId()
  const now = Date.now()
  const hash = opts.password ? await hashPassword(opts.password) : null

  await db(env).run(
    `INSERT INTO users
       (id, email, display_name, avatar_url, google_id, password_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      opts.email,
      opts.displayName ?? null,
      opts.avatarUrl ?? null,
      opts.googleId ?? null,
      hash,
      now,
      now,
    ],
  )

  // first() is guaranteed to return the row we just inserted.
  return db(env).first<UserRow>('SELECT * FROM users WHERE id = ?', [id]) as Promise<UserRow>
}

// ---------------------------------------------------------------------------
// Google OAuth helpers (Authorization Code flow — server-side confidential)
// ---------------------------------------------------------------------------

export interface GoogleOAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

/**
 * Build the Google authorization URL.
 * `state` must be a random CSRF token generated per request and verified on
 * the callback before calling `exchangeGoogleCode`.
 */
export function getGoogleAuthUrl(config: GoogleOAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'select_account',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export interface GoogleUserInfo {
  id: string
  email: string
  name: string
  picture: string
}

/**
 * Exchange an authorization code for Google user info.
 * Throws if the token exchange or userinfo request fails.
 */
export async function exchangeGoogleCode(
  config: GoogleOAuthConfig,
  code: string,
): Promise<GoogleUserInfo> {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    const body = await tokenRes.text()
    throw new Error(`Google token exchange failed (${tokenRes.status}): ${body}`)
  }

  const tokens = (await tokenRes.json()) as { access_token: string; error?: string }
  if (tokens.error || !tokens.access_token) {
    throw new Error(`Google token error: ${tokens.error ?? 'missing access_token'}`)
  }

  const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })

  if (!userRes.ok) {
    throw new Error(`Google userinfo fetch failed (${userRes.status})`)
  }

  const user = (await userRes.json()) as {
    sub: string
    email: string
    name: string
    picture: string
  }

  return {
    id: user.sub,
    email: user.email,
    name: user.name,
    picture: user.picture,
  }
}
