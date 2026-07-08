// Self-contained email+password auth for the Workers runtime. Passwords are
// hashed with Web Crypto PBKDF2 (bcrypt/scrypt aren't available natively);
// sessions are a jose HS256 JWT carried in an httpOnly cookie. No external IdP.
// Mirrors src/server/db.ts's `env`/`db()` access idiom.
import { env } from 'cloudflare:workers'
import { SignJWT, jwtVerify } from 'jose'

const db = () => (env as any).DB as D1Database
const secretKey = () => new TextEncoder().encode((env as any).AUTH_SECRET as string)

export const SESSION_COOKIE = 'sbx_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30d
const PBKDF2_ITER = 100_000 // Workers-CPU vs OWASP(600k) compromise; iters are stored so it's upgradeable

// ---- base64 <-> bytes (btoa/atob exist in Workers) ----
function b64(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}
function unb64(str: string): Uint8Array {
  const bin = atob(str)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr
}

// ---- password hashing (PBKDF2-HMAC-SHA256) ----
async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256)
  return new Uint8Array(bits)
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await pbkdf2(password, salt, PBKDF2_ITER)
  return `pbkdf2$${PBKDF2_ITER}$${b64(salt)}$${b64(hash)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = parseInt(parts[1], 10)
  if (!iterations) return false
  const salt = unb64(parts[2])
  const expected = unb64(parts[3])
  const actual = await pbkdf2(password, salt, iterations)
  return timingSafeEqual(actual, expected)
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

// A throwaway hash to verify against when an email is unknown, so login timing
// doesn't reveal whether the account exists.
const DUMMY_HASH = `pbkdf2$${PBKDF2_ITER}$${b64(new Uint8Array(16))}$${b64(new Uint8Array(32))}`
export async function dummyVerify(password: string): Promise<void> {
  await verifyPassword(password, DUMMY_HASH).catch(() => {})
}

// ---- session JWT ----
export interface SessionClaims { uid: string; email: string }

export async function signSession(c: SessionClaims): Promise<string> {
  return new SignJWT({ uid: c.uid, email: c.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secretKey())
}

export async function verifySession(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey())
    if (typeof payload.uid === 'string' && typeof payload.email === 'string') {
      return { uid: payload.uid, email: payload.email }
    }
    return null
  } catch {
    return null
  }
}

// ---- cookies (manual Set-Cookie so we don't depend on request-context helpers) ----
// `secure` is gated on the request protocol: HTTPS in prod, off on http://localhost
// so curl/headless dev verification can round-trip the cookie.
export function isSecureRequest(request: Request): boolean {
  try { return new URL(request.url).protocol === 'https:' } catch { return false }
}
export function sessionCookieHeader(token: string, secure: boolean): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${secure ? '; Secure' : ''}`
}
export function clearCookieHeader(secure: boolean): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`
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

// ---- the workhorse used by every protected handler ----
export interface AuthUser { id: string; email: string; username: string | null }

export async function getUserFromRequest(request: Request): Promise<AuthUser | null> {
  const token = readCookie(request, SESSION_COOKIE)
  if (!token) return null
  const claims = await verifySession(token)
  if (!claims) return null
  const row = await db()
    .prepare('SELECT id, email, username FROM users WHERE id = ? LIMIT 1')
    .bind(claims.uid)
    .first<{ id: string; email: string; username: string | null }>()
  return row ? { id: String(row.id), email: String(row.email), username: row.username ?? null } : null
}

// ---- user data access ----
export async function findUserByEmail(email: string): Promise<{ id: string; email: string; username: string | null; password_hash: string } | null> {
  const row = await db()
    .prepare('SELECT id, email, username, password_hash FROM users WHERE email = ? LIMIT 1')
    .bind(normalizeEmail(email))
    .first<{ id: string; email: string; username: string | null; password_hash: string }>()
  return row ?? null
}

export async function findUserByUsername(username: string): Promise<{ id: string } | null> {
  const handle = normalizeUsername(username)
  if (!handle) return null
  const row = await db()
    .prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE LIMIT 1')
    .bind(handle)
    .first<{ id: string }>()
  return row ?? null
}

export async function createUser(email: string, password: string, username: string): Promise<AuthUser> {
  const norm = normalizeEmail(email)
  const handle = normalizeUsername(username)
  if (await findUserByEmail(norm)) throw new Error('EMAIL_TAKEN')
  if (await findUserByUsername(handle)) throw new Error('USERNAME_TAKEN')
  const id = crypto.randomUUID()
  const password_hash = await hashPassword(password)
  try {
    await db()
      .prepare('INSERT INTO users (id, email, username, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(id, norm, handle, password_hash, new Date().toISOString())
      .run()
  } catch (e: any) {
    // Unique-index backstop in case two signups race past the checks above.
    const msg = String(e?.message)
    if (/UNIQUE/i.test(msg)) throw new Error(/username/i.test(msg) ? 'USERNAME_TAKEN' : 'EMAIL_TAKEN')
    throw e
  }
  return { id, email: norm, username: handle }
}

// ---- Google sign-in. The client id is public (safe to expose). An OAuth user
// has no password, so we store a sentinel hash that can never match PBKDF2 verify
// (password login stays impossible for them until they set one). ----
export function googleClientId(): string | null {
  return ((env as any).GOOGLE_CLIENT_ID as string) || null
}

export async function findOrCreateOAuthUser(email: string): Promise<AuthUser> {
  const norm = normalizeEmail(email)
  const existing = await db()
    .prepare('SELECT id, email, username FROM users WHERE email = ? LIMIT 1')
    .bind(norm)
    .first<{ id: string; email: string; username: string | null }>()
  if (existing) return { id: String(existing.id), email: String(existing.email), username: existing.username ?? null }
  const id = crypto.randomUUID()
  await db()
    .prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
    .bind(id, norm, 'oauth:google', new Date().toISOString())
    .run()
  return { id, email: norm, username: null }
}

// ---- validation ----
export function normalizeEmail(s: string): string { return String(s ?? '').trim().toLowerCase() }
export function isValidEmail(s: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(s)) }
export function isValidPassword(s: string): boolean { return typeof s === 'string' && s.length >= 8 && s.length <= 200 }
// Public handle: 3-20 chars, letters/numbers/underscore. Case preserved for display,
// but uniqueness is case-insensitive (see idx_users_username + findUserByUsername).
export function normalizeUsername(s: string): string { return String(s ?? '').trim() }
export function isValidUsername(s: string): boolean { return /^[A-Za-z0-9_]{3,20}$/.test(normalizeUsername(s)) }
