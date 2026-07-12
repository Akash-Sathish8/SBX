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
New D1 data-layer code goes through drizzle-orm (`drizzle-orm/d1`) — see
`src/server/auth-schema.ts` for the pattern (snake_case columns, ISO-text dates
via customType). Pre-existing raw prepared statements in `src/server/db.ts` stay
until deliberately ported.

## Auth
Better Auth (email/password via username plugin + Google OAuth), configured in
`src/server/better-auth.ts`, mounted at `/api/auth/$`. Protected routes call
`getUserFromRequest()` from `src/server/auth.ts`. Passwords are PBKDF2 via a
custom hasher (Workers CPU budget — don't switch to the scrypt default).
