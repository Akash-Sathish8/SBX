// Admin auth via Cloudflare Access (Zero Trust).
//
// `/casey/admin*` and `/api/admin/*` sit behind a Cloudflare Access self-hosted
// application, so every request that reaches the Worker through the gated hostname
// carries a signed Access JWT (the `Cf-Access-Jwt-Assertion` header / `CF_Authorization`
// cookie). We verify that assertion against Cloudflare's public keys — this is the
// ONLY admin auth now: no app password, no app-signed cookie, no Worker secrets.
//
// Verifying server-side (rather than blindly trusting "Access is in front") also
// closes the `*.workers.dev` bypass: a request that didn't pass Access has no valid
// assertion, so it's rejected no matter how it reached the Worker.

import { jwtVerify, createRemoteJWKSet } from 'jose';

// Public identifiers for the Access application — NOT secrets (security comes from
// verifying the JWT signature against Cloudflare's keys). If the Access app is
// recreated, update these: Zero Trust → Access → app → Application Audience (AUD) Tag.
const TEAM_DOMAIN = 'morning-sunset-52b4.cloudflareaccess.com';
const ACCESS_AUD = '1bad8fa54f0e7d0bc434022f3b96c556d078fcf23ca430ad37710542d6f775d2';
const ACCESS_ISSUER = `https://${TEAM_DOMAIN}`;

// Cloudflare publishes the Access signing keys here; createRemoteJWKSet fetches and
// caches them (and refreshes on rotation).
const JWKS = createRemoteJWKSet(new URL(`${ACCESS_ISSUER}/cdn-cgi/access/certs`));

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
  // Local `npm run dev` has no Access in front. `import.meta.env.DEV` is a
  // COMPILE-TIME constant (false in production builds), so this can never open
  // admin on the deployed Worker — it fails closed regardless of runtime env.
  if (import.meta.env.DEV) return true;

  const token =
    request.headers.get('cf-access-jwt-assertion') ??
    readCookie(request.headers.get('cookie'), 'CF_Authorization');
  if (!token) return false;
  try {
    await jwtVerify(token, JWKS, {
      issuer: ACCESS_ISSUER,
      audience: ACCESS_AUD,
      algorithms: ['RS256'], // Cloudflare Access signs with RS256; pin it (no alg confusion).
    });
    return true;
  } catch {
    return false;
  }
}

// Wrap a server-route handler so it 401s (clean JSON) unless the request carries a
// valid Access assertion. The admin *bootstrap* route stays bespoke (it returns 200
// {authed:false} to drive the page) — everything that mutates uses this.
export function withAdmin<C extends { request: Request }>(
  handler: (ctx: C) => Promise<Response>,
): (ctx: C) => Promise<Response> {
  return async (ctx) => {
    if (!(await verifyAdminFromRequest(ctx.request))) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    return handler(ctx);
  };
}
