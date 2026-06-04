import { createFileRoute } from '@tanstack/react-router';
import { verifyAdminFromRequest } from '@/lib/auth';
import { getStoredTweets, getTweetTags } from '@/lib/kv';
import { runBlueskyPoll } from '@/lib/bluesky-poll';

export const Route = createFileRoute('/api/admin/tweets')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await verifyAdminFromRequest(request))) {
          return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }
        const [tweets, tags] = await Promise.all([getStoredTweets(), getTweetTags()]);
        const items = Object.values(tweets)
          .map((t) => ({ tweet: t, tag: tags[t.id] ?? null }))
          .sort(
            (a, b) =>
              new Date(b.tweet.createdAt).getTime() - new Date(a.tweet.createdAt).getTime(),
          );
        return Response.json({ ok: true, items });
      },
      POST: async ({ request }) => {
        if (!(await verifyAdminFromRequest(request))) {
          return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }
        try {
          const result = await runBlueskyPoll();
          return Response.json({ ok: true, ...result });
        } catch (err) {
          return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
        }
      },
    },
  },
});
