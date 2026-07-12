import { defineConfig } from 'drizzle-kit'

// Drizzle-kit config for the D1 (SQLite) database. `drizzle-kit generate` reads
// the unified schema and authors migrations into ./drizzle; those migrations are
// applied to D1 with `wrangler d1 migrations apply DB --local | --remote` (see the
// db:* scripts in package.json). We don't use `drizzle-kit migrate`/`push` here —
// they need the remote d1-http driver + a Cloudflare token and can't reach the
// local miniflare database.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/server/db/schema.ts',
  out: './drizzle',
})
