import { createFileRoute } from '@tanstack/react-router';
import { verifyAdminFromRequest } from '@/lib/auth';
import { getMergedItinerary, getMergedStadiums } from '@/lib/merged-itinerary';
import { getPositionOverride, getSpend } from '@/lib/kv';

// Admin page data + auth gate in one call. The /admin route component
// fetches this on mount: { authed:false } → render AdminLogin; otherwise
// the full admin dataset → render AdminShell. Replaces the Next server
// component that branched on verifyAdmin().
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
        const [itinerary, stadiums, spend, override] = await Promise.all([
          getMergedItinerary(),
          getMergedStadiums(),
          getSpend(),
          getPositionOverride(),
        ]);
        return Response.json(
          { ok: true, authed: true, itinerary, stadiums, spend, override },
          { headers: { 'Cache-Control': 'no-store, max-age=0' } },
        );
      },
    },
  },
});
