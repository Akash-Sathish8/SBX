import { createFileRoute } from '@tanstack/react-router';
import { dbTeams } from '../../server/db';
import { isLeague } from '@/lib/sports';

// Team directory from D1. `?league=` narrows; omitted = all three.
export const Route = createFileRoute('/api/teams')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const leagueParam = url.searchParams.get('league');
        if (leagueParam && !isLeague(leagueParam)) {
          return Response.json({ ok: false, error: 'league must be nfl|nba|mlb' }, { status: 400 });
        }
        try {
          const teams = await dbTeams(isLeague(leagueParam) ? leagueParam : undefined);
          return Response.json(
            { ok: true, data: teams },
            { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400' } },
          );
        } catch (e: any) {
          return Response.json({ ok: false, error: String(e?.message || e), data: [] }, { status: 500 });
        }
      },
    },
  },
});
