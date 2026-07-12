// The Better Auth instance — file location + `auth` export follow the official
// TanStack Start integration guide (better-auth.com/docs/integrations/tanstack).
// Better Auth owns sign-up/sign-in/sign-out/session endpoints (mounted at
// /api/auth/$ via auth.handler) and DB-backed sessions in an httpOnly cookie.
// D1 is reached through Drizzle (src/server/db/schema.ts).
//
// Workers caveat: `env` bindings (DB, AUTH_SECRET, …) are only safe to touch
// inside a request, so the instance is built lazily on first use. `auth` is a
// thin Proxy over that lazy singleton so call sites still read exactly like the
// docs (`auth.handler(...)`, `auth.api.getSession(...)`) without a top-level
// `betterAuth()` that would evaluate at module load.
import { env } from 'cloudflare:workers'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { username } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { drizzle } from 'drizzle-orm/d1'
import { user, session, account, verification } from '../server/db/schema'
import { hashPassword, verifyPassword } from '../server/password'

// Just the tables Better Auth manages (keyed by its model names).
const authSchema = { user, session, account, verification }

const e = () => env as any

export function googleConfigured(): boolean {
  return Boolean(e().GOOGLE_CLIENT_ID && e().GOOGLE_CLIENT_SECRET)
}

function createAuth() {
  return betterAuth({
    // Needed to build the Google redirect_uri. Prod value lives in wrangler.jsonc
    // vars; dev in .dev.vars. Unset → inferred per request.
    baseURL: (e().BETTER_AUTH_URL as string) || undefined,
    secret: e().AUTH_SECRET as string,
    database: drizzleAdapter(drizzle(e().DB as D1Database, { schema: authSchema }), {
      provider: 'sqlite',
      schema: authSchema,
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
              // Don't write Google's picture URL into users.avatar — that column
              // means 'data:image/...' | 'preset:N' | NULL (initials). Runtime null
              // overrides the default picture mapping; the type only admits
              // string|undefined, hence the cast.
              mapProfileToUser: () => ({ image: null as unknown as undefined }),
            },
          },
        }
      : {}),
    account: {
      accountLinking: {
        enabled: true,
        // Legacy Google users have no `account` row (the old stack only kept their
        // email). Trusting google lets their next sign-in link to the existing
        // users row by verified email instead of erroring.
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
      // Public handle: 3-20 chars, letters/numbers/underscore — same rules the old
      // register endpoint enforced. Uniqueness is case-insensitive via normalization
      // (+ the DB's COLLATE NOCASE unique index as backstop).
      username({
        minUsernameLength: 3,
        maxUsernameLength: 20,
        usernameValidator: (u) => /^[A-Za-z0-9_]+$/.test(u),
        displayUsernameValidator: (u) => /^[A-Za-z0-9_]+$/.test(u),
      }),
      // MUST stay last — it wires Better Auth's Set-Cookie into TanStack Start's
      // response (better-auth warns if any plugin follows it).
      tanstackStartCookies(),
    ],
  })
}

let _auth: ReturnType<typeof createAuth> | null = null
function getAuth(): ReturnType<typeof createAuth> {
  if (!_auth) _auth = createAuth()
  return _auth
}

// Docs-shaped `auth` export backed by the lazy singleton (see file header).
export const auth = new Proxy({} as ReturnType<typeof createAuth>, {
  get(_t, prop) {
    const a = getAuth() as any
    const v = a[prop as keyof typeof a]
    return typeof v === 'function' ? v.bind(a) : v
  },
}) as ReturnType<typeof createAuth>
