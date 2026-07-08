// Custom Cloudflare Worker entry. Mirrors @tanstack/react-start's default
// server-entry (createStartHandler) for `fetch`, and ADDS a `scheduled` handler
// so a cron trigger can keep live game scores fresh in D1. Referenced by
// wrangler.jsonc `main`.
import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'
import { runScheduledIngest, type CronEnv } from './server/cron'

const fetch = createStartHandler(defaultStreamHandler)

export default {
  fetch,
  // Cron-triggered (wrangler.jsonc triggers.crons): refresh today's live games.
  async scheduled(
    _event: unknown,
    env: CronEnv,
    ctx: { waitUntil(p: Promise<unknown>): void },
  ) {
    ctx.waitUntil(runScheduledIngest(env))
  },
}
