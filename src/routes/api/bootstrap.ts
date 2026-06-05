import { createFileRoute } from '@tanstack/react-router';
import { getMergedItinerary, getMergedStadiums } from '@/lib/merged-itinerary';
import {
  getPositionOverride,
  getSpend,
  getAllResults,
  getVisibilityFlags,
} from '@/lib/kv';
import { computeCaseyLocation } from '@/lib/location';
import { computeTripStats } from '@/lib/stats';
import { parseSimTime, resolveNow } from '@/lib/now';

// Single payload that boots the public tracker. Mirrors what app/page.tsx
// computed server-side in the Next app (location/stats/spend + the
// visibility-stripped itinerary). The client TrackerApp fetches this once
// on mount, then ClientShell takes over with its own /api/live polling.
export const Route = createFileRoute('/api/bootstrap')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const [itinerary, stadiums, override, spend, results, visibility] = await Promise.all([
          getMergedItinerary(),
          getMergedStadiums(),
          getPositionOverride(),
          getSpend(),
          getAllResults(),
          getVisibilityFlags(),
        ]);

        const allowDetails = visibility.showLodging || visibility.showTransport;
        const publicItinerary = itinerary.map((m) => ({
          ...m,
          lodging: visibility.showLodging ? m.lodging : null,
          transportMode: visibility.showTransport ? m.transportMode : null,
          notes: allowDetails ? m.notes : null,
        }));

        const simTime = parseSimTime(new URL(request.url).searchParams.get('simTime'));
        const now = resolveNow(simTime);
        const location = computeCaseyLocation(now, override);
        const stats = computeTripStats(now, location, results);

        return Response.json(
          {
            ok: true,
            location,
            stats,
            spend,
            results,
            itinerary: publicItinerary,
            stadiums,
            visibility,
            simTime: simTime ? simTime.toISOString() : null,
          },
          { headers: { 'Cache-Control': 'no-store, max-age=0' } },
        );
      },
    },
  },
});
