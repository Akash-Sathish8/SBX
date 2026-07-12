# SBX (intern-sbx)

TanStack Start + React 19 on Cloudflare Workers, D1 (SQLite) as the system of
record. Deployed at sbx.snapbacksports.com. See AGENTS.md for skill loading.

## UI: use shadcn/ui
shadcn is our design component library. All components are vendored in
`src/components/ui/` (add more with `npx shadcn@latest add <name> -y`).
- Build new UI from shadcn primitives (Dialog, Button, Input, Select, Sheet, …),
  not hand-rolled elements. Reference conversions: `src/components/auth/AuthModal.tsx`,
  `src/components/ShareCardModal.tsx`.
- Theme tokens live in `src/styles/tailwind.css`, mapped to the Snapback palette
  (`bg-brand`, `text-ink`, `font-display`, punch shadows). The Button has a custom
  `brand` variant for the yellow CTA.
- Mid-migration gotcha: legacy per-route CSS (`src/pages/*.css`) is UNLAYERED and
  beats Tailwind utilities on conflict. Bare element selectors there are guarded
  with `:where(:not([data-slot]))` so they skip shadcn portals — keep that pattern
  if touching legacy sheets, and visually check new surfaces on legacy routes.
- Legacy pages adopt shadcn as each converts to Tailwind (page CSS file deleted).

## Data: use Drizzle for D1
The whole data layer is Drizzle (`drizzle-orm/d1`). The unified schema is the
single source of truth: tables in `src/server/db/schema.ts` (snake_case columns,
ISO-text dates via the `isoDate` customType), relations in
`src/server/db/relations.ts`, and the lazy client in `src/server/db/client.ts`.
App queries live in `src/server/queries.ts` (use the relational query builder,
`db().query.x.findMany({ with })`, where it fits). Never hand-write raw SQL.

Migrations are clean-slate and Drizzle-owned: edit the schema, then
`npm run db:generate` (drizzle-kit → `drizzle/*.sql`) and
`npm run db:migrate:local` / `:remote` (`wrangler d1 migrations apply`). There is
no `db/schema.sql`. `npm run db:setup:local` = migrate + ingest + seed. Offline
seed GENERATORS in `scripts/*.mjs` still emit raw `INSERT OR REPLACE` SQL — that's
expected; they don't query the live DB. (Note: `seed.snapback-tips`/`jack`/`crew`
generators are stale — they still emit a dropped `password_hash` column.)

## Auth
Better Auth (email/password via username plugin + Google OAuth), following the
TanStack Start docs layout: instance in `src/lib/auth.ts` (exported as `auth`, a
lazy Proxy over a per-request singleton because Workers `env` isn't safe at module
load; `tanstackStartCookies()` is the LAST plugin), server helpers in
`src/lib/auth.functions.ts` (`getSession`/`ensureSession` serverFns + the
request-based `getUserFromRequest()` that `/api/*` handlers call), client in
`src/lib/auth-client.ts`. Mounted at `/api/auth/$`. Passwords are PBKDF2 via a
custom hasher in `src/server/password.ts` (Workers CPU budget — don't switch to
the scrypt default).
