import { createFileRoute } from '@tanstack/react-router';
import { dbGameById, dbGames, type GamesQuery } from '../../server/queries';
import { overlayLiveScores } from '../../server/live';
import { isLeague } from '@/lib/sports';

// Games from D1 (system of record). `?league=` narrows; `?from=&to=` (ISO date)
// filter the window; `?team=` (abbr); `?limit=`. Smart defaults when no date
// filter: a near-term cross-league window for "what's on", or the most-recent
// games for a single (possibly out-of-season) league.
function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const Route = createFileRoute('/api/games')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const leagueParam = url.searchParams.get('league');
        if (leagueParam && !isLeague(leagueParam)) {
          return Response.json({ ok: false, error: 'league must be nfl|nba|mlb' }, { status: 400 });
        }
        const league = isLeague(leagueParam) ? leagueParam : undefined;
        const id = url.searchParams.get('id') || undefined;
        if (id) {
          // Direct lookup — game pages must resolve any game, not just ones
          // inside the list windows below.
          try {
            const g = await dbGameById(id, league);
            const data = g ? await overlayLiveScores([g]) : [];
            return Response.json(
              { ok: true, data },
              { headers: { 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=60' } },
            );
          } catch (e: any) {
            return Response.json({ ok: false, error: String(e?.message || e), data: [] }, { status: 500 });
          }
        }
        const from = url.searchParams.get('from') || undefined;
        const to = url.searchParams.get('to') || undefined;
        const team = url.searchParams.get('team') || undefined;
        const limit = Number(url.searchParams.get('limit')) || undefined;

        const opts: GamesQuery = { league, from, to, team, limit };
        if (!from && !to) {
          if (league) {
            // A single league: show its most-recent games (its season may be over).
            opts.order = 'desc';
            opts.limit = limit ?? 150;
          } else {
            // Cross-league: a near-term window = "what's on" now.
            opts.from = isoDaysFromNow(-2);
            opts.order = 'asc';
            opts.limit = limit ?? 200;
          }
        }
        // A window that starts after today can't contain a live game — skip the
        // ESPN overlay entirely (it pings the scoreboard for every near, non-final
        // game it sees, up to one fetch per league per isolate).
        const futureOnly = !!opts.from && opts.from.slice(0, 10) > isoDaysFromNow(0);
        try {
          const rows = await dbGames(opts);
          const games = futureOnly ? rows : await overlayLiveScores(rows);
          return Response.json(
            { ok: true, data: games },
            // Short TTL so live games stay fresh; finished-game reads are still
            // cheap (the overlay only hits ESPN when a near, non-final game exists).
            { headers: { 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=60' } },
          );
        } catch (e: any) {
          return Response.json({ ok: false, error: String(e?.message || e), data: [] }, { status: 500 });
        }
      },
    },
  },
});
