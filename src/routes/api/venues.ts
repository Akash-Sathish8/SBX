import { createFileRoute } from '@tanstack/react-router';
import { dbVenues } from '../../server/queries';
import { isLeague } from '@/lib/sports';

// Venues from D1. `?league=` narrows to that league's home grounds; omitted =
// all, with shared buildings carrying every tenant team.
export const Route = createFileRoute('/api/venues')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const leagueParam = url.searchParams.get('league');
        if (leagueParam && !isLeague(leagueParam)) {
          return Response.json({ ok: false, error: 'league must be nfl|nba|mlb' }, { status: 400 });
        }
        try {
          const venues = await dbVenues(isLeague(leagueParam) ? leagueParam : undefined);
          return Response.json(
            { ok: true, data: venues },
            { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
          );
        } catch (e: any) {
          return Response.json({ ok: false, error: String(e?.message || e), data: [] }, { status: 500 });
        }
      },
    },
  },
});
