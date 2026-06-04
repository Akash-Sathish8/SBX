// On-demand match-buzz fetcher. Pulls fresh Bluesky posts about a single
// match the moment a user opens it — no scheduled cron required. The
// public /api/tweets/[matchNumber] route calls this and caches the result
// in KV for a few minutes so repeat views don't re-hit Bluesky.

import { getMatch } from './itinerary';
import { searchBlueskyPosts } from './bluesky';
import { queriesForMatch } from './bluesky-poll';
import type { Tweet } from './x';

const PER_QUERY_LIMIT = 15;

export async function fetchMatchBuzz(matchNumber: number, limit = 20): Promise<Tweet[]> {
  const match = getMatch(matchNumber);
  if (!match) return [];

  const queries = queriesForMatch(match);
  const collected: Tweet[] = [];

  // Sequential to stay polite to the public Bluesky endpoint.
  for (const q of queries) {
    try {
      const posts = await searchBlueskyPosts(q, { limit: PER_QUERY_LIMIT, sort: 'latest' });
      collected.push(...posts);
    } catch {
      // One bad query shouldn't sink the whole feed — skip and continue.
    }
  }

  // Dedupe by post URI.
  const byId = new Map<string, Tweet>();
  for (const p of collected) byId.set(p.id, p);

  // Drop replies (conversation noise) and rank newest-first.
  return Array.from(byId.values())
    .filter((t) => !t.isReply)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}
