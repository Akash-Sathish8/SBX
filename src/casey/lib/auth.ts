// TanStack-compatible admin auth. The parent app's lib/auth.ts uses
// next/headers cookies() which doesn't exist here, so this standalone
// version reads/writes cookies via the web-standard Request/Response.
// JWT signing logic is identical (jose, HS256, same cookie name/secret),
// so tokens issued by either app validate in both.

import { SignJWT, jwtVerify } from 'jose';

const COOKIE_NAME = 'casey_admin';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function getSecret(): Uint8Array {
  const raw =
    process.env.ADMIN_JWT_SECRET ?? 'dev-insecure-secret-please-set-ADMIN_JWT_SECRET';
  if (raw.startsWith('dev-insecure') && process.env.NODE_ENV === 'production') {
    console.warn('[auth] ADMIN_JWT_SECRET not set in production');
  }
  return new TextEncoder().encode(raw);
}

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD ?? 'snapback2026';
}

export function getAdminCookieName(): string {
  return COOKIE_NAME;
}

export function getAdminCookieMaxAge(): number {
  return MAX_AGE_SECONDS;
}

export async function issueAdminToken(): Promise<string> {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret());
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    if (k === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

export async function verifyAdminFromRequest(request: Request): Promise<boolean> {
  try {
    const token = readCookie(request.headers.get('cookie'), COOKIE_NAME);
    if (!token) return false;
    const { payload } = await jwtVerify(token, getSecret());
    return payload.role === 'admin';
  } catch {
    return false;
  }
}

// Build a Set-Cookie header value for the admin token (or to clear it).
export function buildAdminCookie(token: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}
