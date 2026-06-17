import { createFileRoute } from '@tanstack/react-router';
import { withAdmin } from '@/lib/auth';
import { pingAll, mergeHealthRecord, ENDPOINTS } from '@/lib/health';
import { getHealthRecord, setHealthRecord } from '@/lib/kv';

export const Route = createFileRoute('/api/admin/espn-health')({
  server: {
    handlers: {
      GET: withAdmin(async () => {
        const record = await getHealthRecord();
        return Response.json(
          {
            ok: true,
            record,
            endpoints: ENDPOINTS.map((e) => ({
              id: e.id,
              label: e.label,
              description: e.description,
            })),
          },
          { headers: { 'Cache-Control': 'no-store, max-age=0' } },
        );
      }),
      POST: withAdmin(async () => {
        const results = await pingAll();
        const prev = await getHealthRecord();
        const next = mergeHealthRecord(prev, results);
        await setHealthRecord(next);
        return Response.json(
          {
            ok: true,
            record: next,
            latest: results,
            endpoints: ENDPOINTS.map((e) => ({
              id: e.id,
              label: e.label,
              description: e.description,
            })),
          },
          { headers: { 'Cache-Control': 'no-store, max-age=0' } },
        );
      }),
    },
  },
});
