// The Better Auth instance. Replaces the hand-rolled JWT/PBKDF2 stack that
// used to live in auth.ts — Better Auth owns sign-up/sign-in/sign-out/session
// endpoints (mounted at /api/auth/$ via auth.handler) and DB-backed sessions
// in an httpOnly cookie. D1 is reached through drizzle (auth-schema.ts).
//
// Lazy singleton: `env` bindings (DB, AUTH_SECRET, …) are only safe to touch
// inside a request, so the instance is built on first use, not at module load.
import { env } from 'cloudflare:workers'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { username } from 'better-auth/plugins'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from './auth-schema'
import { hashPassword, verifyPassword } from './password'

const e = () => env as any

export function googleConfigured(): boolean {
  return Boolean(e().GOOGLE_CLIENT_ID && e().GOOGLE_CLIENT_SECRET)
}

function createAuth() {
  return betterAuth({
    // Needed to build the Google redirect_uri. Prod value lives in
    // wrangler.jsonc vars; dev in .dev.vars. Unset → inferred per request.
    baseURL: (e().BETTER_AUTH_URL as string) || undefined,
    secret: e().AUTH_SECRET as string,
    database: drizzleAdapter(drizzle(e().DB as D1Database, { schema }), {
      provider: 'sqlite',
      schema,
      transaction: false, // D1 has no interactive transactions
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 200,
      // Web-Crypto PBKDF2 instead of Better Auth's default scrypt: native on
      // Workers AND backwards-compatible with every pre-migration hash.
      password: { hash: hashPassword, verify: verifyPassword },
    },
    ...(googleConfigured()
      ? {
          socialProviders: {
            google: {
              clientId: e().GOOGLE_CLIENT_ID as string,
              clientSecret: e().GOOGLE_CLIENT_SECRET as string,
              // Don't write Google's picture URL into users.avatar — that
              // column means 'data:image/...' | 'preset:N' | NULL (initials).
              // Runtime null overrides the default picture mapping; the type
              // only admits string|undefined, hence the cast.
              mapProfileToUser: () => ({ image: null as unknown as undefined }),
            },
          },
        }
      : {}),
    account: {
      accountLinking: {
        enabled: true,
        // Legacy Google users have no `account` row (the old stack only kept
        // their email). Trusting google lets their next sign-in link to the
        // existing users row by verified email instead of erroring.
        trustedProviders: ['google'],
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30d, matching the old JWT cookie
      updateAge: 60 * 60 * 24,
    },
    advanced: {
      cookiePrefix: 'sbx',
      database: { generateId: () => crypto.randomUUID() }, // keep users.id a UUID like every existing row
    },
    telemetry: { enabled: false },
    plugins: [
      // Public handle: 3-20 chars, letters/numbers/underscore — same rules the
      // old register endpoint enforced. Uniqueness is case-insensitive via
      // normalization (+ the DB's COLLATE NOCASE unique index as backstop).
      username({
        minUsernameLength: 3,
        maxUsernameLength: 20,
        usernameValidator: (u) => /^[A-Za-z0-9_]+$/.test(u),
        displayUsernameValidator: (u) => /^[A-Za-z0-9_]+$/.test(u),
      }),
    ],
  })
}

let _auth: ReturnType<typeof createAuth> | null = null
export function getAuth(): ReturnType<typeof createAuth> {
  if (!_auth) _auth = createAuth()
  return _auth
}
