import { createFileRoute } from '@tanstack/react-router';
import { getPositionOverride, getAllResults, getSpend } from '@/lib/kv';
import { computeCaseyLocation } from '@/lib/location';
import { computeTripStats } from '@/lib/stats';
import { parseSimTime, resolveNow } from '@/lib/now';

export const Route = createFileRoute('/api/live')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const simTime = parseSimTime(new URL(request.url).searchParams.get('simTime'));
        const [override, results, spend] = await Promise.all([
          getPositionOverride(),
          getAllResults(),
          getSpend(),
        ]);
        const now = resolveNow(simTime);
        const location = computeCaseyLocation(now, override);
        const stats = computeTripStats(now, location, results);
        return Response.json(
          { location, stats, spend, simTime: simTime ? simTime.toISOString() : null },
          { headers: { 'Cache-Control': 'no-store, max-age=0' } },
        );
      },
    },
  },
});
