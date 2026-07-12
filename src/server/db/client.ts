// Shared Drizzle client for the app data layer. Lazy accessor — the `DB` binding
// is only safe to touch inside a request (same reason auth.ts builds its instance
// lazily), so `db()` is called at query time, not at module load. The schema
// passed here bundles tables + relations so the relational query builder
// (db().query.x.findMany({ with })) is available.
import { env } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/d1'
import * as tables from './schema'
import * as relations from './relations'

export const schema = { ...tables, ...relations }

export type DB = ReturnType<typeof drizzle<typeof schema>>

let _db: DB | null = null

export function db(): DB {
  if (!_db) _db = drizzle((env as any).DB as D1Database, { schema })
  return _db
}
