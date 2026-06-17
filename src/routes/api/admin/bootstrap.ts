import { createFileRoute } from '@tanstack/react-router';
import { verifyAdminFromRequest } from '@/lib/auth';
import { getMergedItinerary, getMergedStadiums } from '@/lib/merged-itinerary';
import { getPositionOverride, getSpend, getUnderdogReferral } from '@/lib/kv';

// Admin page data + auth gate in one call. The /admin route component fetches
// this on mount: { authed:false } → show a "not authorized" notice; otherwise the
// full admin dataset → render AdminShell. `authed` reflects the Cloudflare Access
// assertion (verifyAdminFromRequest), so behind Access it's always true.
export const Route = createFileRoute('/api/admin/bootstrap')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await verifyAdminFromRequest(request))) {
          return Response.json(
            { ok: true, authed: false },
            { headers: { 'Cache-Control': 'no-store, max-age=0' } },
          );
        }
        const [itinerary, stadiums, spend, override, underdogReferral] = await Promise.all([
          getMergedItinerary(),
          getMergedStadiums(),
          getSpend(),
          getPositionOverride(),
          getUnderdogReferral(),
        ]);
        return Response.json(
          { ok: true, authed: true, itinerary, stadiums, spend, override, underdogReferral },
          { headers: { 'Cache-Control': 'no-store, max-age=0' } },
        );
      },
    },
  },
});
