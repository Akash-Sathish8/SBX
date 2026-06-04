import { createFileRoute } from '@tanstack/react-router';
import { verifyAdminFromRequest } from '@/lib/auth';
import {
  setMatchResult,
  setMatchOverride,
  setPositionOverride,
  clearPositionOverride,
  setSpend,
  setYouTubeId,
  setStadiumOverride,
  setVisibilityFlags,
  setTweetTag,
  clearTweetTag,
} from '@/lib/kv';

export const Route = createFileRoute('/api/admin/update')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await verifyAdminFromRequest(request))) {
          return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }
        try {
          const { action, payload } = (await request.json()) as {
            action: string;
            payload: any;
          };
          switch (action) {
            case 'set-result':
              await setMatchResult(payload.matchNumber, payload.result);
              break;
            case 'bulk-set-results': {
              const entries: { matchNumber: number; result: any }[] = payload.entries ?? [];
              for (const e of entries) {
                await setMatchResult(e.matchNumber, e.result);
              }
              break;
            }
            case 'set-match-fields':
              await setMatchOverride(payload.matchNumber, payload.fields);
              break;
            case 'set-position-override':
              await setPositionOverride(payload);
              break;
            case 'clear-position-override':
              await clearPositionOverride();
              break;
            case 'set-spend':
              await setSpend(payload);
              break;
            case 'set-youtube':
              await setYouTubeId(payload.matchNumber, payload.youtubeId);
              break;
            case 'set-stadium-hero':
              await setStadiumOverride(payload.stadiumId, { heroImage: payload.heroImage });
              break;
            case 'set-visibility':
              await setVisibilityFlags({
                showLodging: Boolean(payload.showLodging),
                showTransport: Boolean(payload.showTransport),
              });
              break;
            case 'set-tweet-tag': {
              const matchNumbers: number[] = Array.isArray(payload.matchNumbers)
                ? payload.matchNumbers
                    .map((n: unknown) => Number(n))
                    .filter((n: number) => Number.isFinite(n))
                : [];
              await setTweetTag(payload.tweetId, {
                matchNumbers,
                confidence: 1,
                manual: true,
                taggedAt: new Date().toISOString(),
              });
              break;
            }
            case 'clear-tweet-tag':
              await clearTweetTag(payload.tweetId);
              break;
            default:
              return Response.json(
                { ok: false, error: `Unknown action: ${action}` },
                { status: 400 },
              );
          }
          return Response.json({ ok: true });
        } catch (err) {
          return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
        }
      },
    },
  },
});
