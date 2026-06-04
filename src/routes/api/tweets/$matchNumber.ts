import { createFileRoute } from '@tanstack/react-router';
import {
  getStoredTweets,
  getTweetTags,
  getBuzzCache,
  setBuzzCache,
} from '@/lib/kv';
import { fetchMatchBuzz } from '@/lib/buzz';
import type { Tweet } from '@/lib/x';

const CACHE_TTL_MS = 8 * 60 * 1000;

export const Route = createFileRoute('/api/tweets/$matchNumber')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const n = Number(params.matchNumber);
        if (!Number.isFinite(n)) {
          return Response.json({ ok: false, error: 'bad match number' }, { status: 400 });
        }

        const [stored, tags, cache] = await Promise.all([
          getStoredTweets(),
          getTweetTags(),
          getBuzzCache(n),
        ]);
        const curated = Object.values(stored).filter((t) =>
          tags[t.id]?.matchNumbers?.includes(n),
        );

        let live: Tweet[] = [];
        const cacheFresh = cache && Date.now() - new Date(cache.fetchedAt).getTime() < CACHE_TTL_MS;
        if (cacheFresh) {
          live = cache!.tweets;
        } else {
          try {
            live = await fetchMatchBuzz(n, 20);
            await setBuzzCache(n, { tweets: live, fetchedAt: new Date().toISOString() });
          } catch {
            live = cache?.tweets ?? [];
          }
        }

        const byId = new Map<string, Tweet>();
        for (const t of curated) byId.set(t.id, t);
        for (const t of live) if (!byId.has(t.id)) byId.set(t.id, t);
        const tweets = Array.from(byId.values())
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 20);

        return Response.json(
          { ok: true, tweets },
          { headers: { 'Cache-Control': 'no-store, max-age=0' } },
        );
      },
    },
  },
});
