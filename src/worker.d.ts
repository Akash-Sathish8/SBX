// Minimal Cloudflare Workers ambient types for this ISOMORPHIC app.
//
// We deliberately do NOT use the full `wrangler types` output
// (worker-configuration.d.ts): its runtime globals redefine fetch/Response/etc.
// and clash with lib.dom that the React client relies on (e.g. it makes
// Response.json() return `unknown`, breaking every `.json().ok` site). Instead
// this is an ambient *script* (.d.ts with no top-level import/export) that
// declaration-merges only the few worker-only members we touch onto the
// existing DOM globals, pulling the real KVNamespace type via an inline import.

interface CacheStorage {
  // workerd exposes a default cache that lib.dom's CacheStorage lacks.
  readonly default: Cache
}

interface RequestInit {
  // Cloudflare-specific fetch options (edge cache control).
  cf?: { cacheEverything?: boolean; cacheTtl?: number } & Record<string, unknown>
}

// Minimal D1 globals used by src/lib/server/db.ts.
// We inline only what we need rather than pulling in the full workers-types
// globals (which conflict with lib.dom — see comment above).
declare interface D1Result<T = Record<string, unknown>> {
  results: T[]
  success: boolean
  meta: Record<string, unknown>
}

declare interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>
  raw<T = unknown[]>(): Promise<T[]>
}

declare interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>
  exec(query: string): Promise<D1Result>
  dump(): Promise<ArrayBuffer>
}

declare module 'cloudflare:workers' {
  // Bindings from wrangler.jsonc. KV is optional so non-Worker contexts
  // (vitest / Node) typecheck against kv.ts's in-memory fallback.
  export const env: {
    KV?: import('@cloudflare/workers-types').KVNamespace
    TILES?: import('@cloudflare/workers-types').R2Bucket
    DB?: D1Database
  } & Record<string, unknown>
}
