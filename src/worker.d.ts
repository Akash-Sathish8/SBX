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

declare module 'cloudflare:workers' {
  // Bindings from wrangler.jsonc. KV is optional so non-Worker contexts
  // (vitest / Node) typecheck against kv.ts's in-memory fallback.
  export const env: {
    KV?: import('@cloudflare/workers-types').KVNamespace
    TILES?: import('@cloudflare/workers-types').R2Bucket
  } & Record<string, unknown>
}
