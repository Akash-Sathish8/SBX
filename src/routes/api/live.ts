import { createFileRoute } from '@tanstack/react-router';
import { getPublicSnapshot } from '@/lib/snapshot';
import { computeCaseyLocation } from '@/lib/location';
import { computeTripStats } from '@/lib/stats';
import { parseSimTime, resolveNow } from '@/lib/now';

export const Route = createFileRoute('/api/live')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const simTime = parseSimTime(new URL(request.url).searchParams.get('simTime'));
        const snap = await getPublicSnapshot();
        const now = resolveNow(simTime);
        const location = computeCaseyLocation(now, snap.positionOverride);
        const stats = computeTripStats(now, location, snap.results);
        return Response.json(
          { location, stats, spend: snap.spend, simTime: simTime ? simTime.toISOString() : null },
          { headers: { 'Cache-Control': 'no-store, max-age=0' } },
        );
      },
    },
  },
});
