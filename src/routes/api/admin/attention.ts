import { createFileRoute } from '@tanstack/react-router';
import { withAdmin } from '@/lib/server/auth';
import { computeAttention } from '@/lib/attention';
import { getMergedItinerary } from '@/lib/merged-itinerary';
import { getAllResults, getPositionOverride, getVisibilityFlags } from '@/lib/server/kv';

export const Route = createFileRoute('/api/admin/attention')({
  server: {
    handlers: {
      GET: withAdmin(async () => {
        const [itinerary, results, override, visibility] = await Promise.all([
          getMergedItinerary(),
          getAllResults(),
          getPositionOverride(),
          getVisibilityFlags(),
        ]);
        const items = computeAttention({ itinerary, results, override, visibility });
        return Response.json(
          { ok: true, items, generatedAt: new Date().toISOString() },
          { headers: { 'Cache-Control': 'no-store, max-age=0' } },
        );
      }),
    },
  },
});
