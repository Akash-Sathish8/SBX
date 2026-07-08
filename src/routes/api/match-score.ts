import { createFileRoute } from '@tanstack/react-router';
import { getMatchScore } from '@/lib/espn';
import { isLeague } from '@/lib/sports';

export const Route = createFileRoute('/api/match-score')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const league = url.searchParams.get('league');
        const date = url.searchParams.get('date');
        const home = url.searchParams.get('home');
        const away = url.searchParams.get('away');
        if (!isLeague(league) || !date || !home || !away) {
          return Response.json(
            { ok: false, error: 'league (nfl|nba|mlb), date, home, away required' },
            { status: 400 },
          );
        }
        const score = await getMatchScore(league, date, home, away);
        return Response.json(
          { ok: true, data: score },
          { headers: { 'Cache-Control': 'public, s-maxage=45, stale-while-revalidate=60' } },
        );
      },
    },
  },
});
