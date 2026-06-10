import { createFileRoute } from '@tanstack/react-router';
import { getMatchScore } from '@/lib/espn';

export const Route = createFileRoute('/api/match-score')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const date = url.searchParams.get('date');
        const home = url.searchParams.get('home');
        const away = url.searchParams.get('away');
        if (!date || !home || !away) {
          return Response.json(
            { ok: false, error: 'date, home, away required' },
            { status: 400 },
          );
        }
        const score = await getMatchScore(date, home, away);
        return Response.json(
          { ok: true, data: score },
          { headers: { 'Cache-Control': 'public, s-maxage=45, stale-while-revalidate=60' } },
        );
      },
    },
  },
});
