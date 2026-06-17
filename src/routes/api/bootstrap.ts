import { createFileRoute } from '@tanstack/react-router';
import { getPublicSnapshot } from '@/lib/snapshot';
import { computeCaseyLocation } from '@/lib/location';
import { computeTripStats } from '@/lib/stats';
import { parseSimTime, resolveNow } from '@/lib/now';

// Single payload that boots the public tracker. The admin-driven state comes
// from the edge-cached snapshot (see snapshot.ts); only the time-dependent
// location/stats are computed per request. The client TrackerApp fetches this
// once on mount, then ClientShell takes over with its own /api/live polling.
export const Route = createFileRoute('/api/bootstrap')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const snap = await getPublicSnapshot();

        const allowDetails = snap.visibility.showLodging || snap.visibility.showTransport;
        const publicItinerary = snap.itinerary.map((m) => ({
          ...m,
          lodging: snap.visibility.showLodging ? m.lodging : null,
          transportMode: snap.visibility.showTransport ? m.transportMode : null,
          notes: allowDetails ? m.notes : null,
        }));

        const simTime = parseSimTime(new URL(request.url).searchParams.get('simTime'));
        const now = resolveNow(simTime);
        const location = computeCaseyLocation(now, snap.positionOverride);
        const stats = computeTripStats(now, location, snap.results);

        return Response.json(
          {
            ok: true,
            location,
            stats,
            spend: snap.spend,
            results: snap.results,
            itinerary: publicItinerary,
            stadiums: snap.stadiums,
            visibility: snap.visibility,
            underdogReferral: snap.underdogReferral,
            simTime: simTime ? simTime.toISOString() : null,
          },
          { headers: { 'Cache-Control': 'no-store, max-age=0' } },
        );
      },
    },
  },
});
