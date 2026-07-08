// Typed D1 query helpers for Cloudflare Workers.
//
// Usage:
//   import { db } from '~/lib/server/db'
//   const users = await db(env).query<UserRow>('SELECT * FROM users WHERE id = ?', [id])

export interface DbEnv {
  DB: D1Database
}

export function db(env: DbEnv) {
  return {
    async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
      const result = await env.DB.prepare(sql).bind(...params).all<T>()
      return result.results
    },

    async first<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
      return env.DB.prepare(sql).bind(...params).first<T>()
    },

    async run(sql: string, params: unknown[] = []): Promise<D1Result> {
      return env.DB.prepare(sql).bind(...params).run()
    },

    async batch(statements: { sql: string; params?: unknown[] }[]): Promise<D1Result[]> {
      const prepared = statements.map(s =>
        env.DB.prepare(s.sql).bind(...(s.params ?? []))
      )
      return env.DB.batch(prepared)
    },
  }
}
