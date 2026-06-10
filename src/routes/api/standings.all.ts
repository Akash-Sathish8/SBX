import { createFileRoute } from '@tanstack/react-router';
import { getAllGroupStandings } from '@/lib/espn';

export const Route = createFileRoute('/api/standings/all')({
  server: {
    handlers: {
      GET: async () => {
        const groups = await getAllGroupStandings();
        return Response.json(
          { ok: true, data: groups },
          { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
        );
      },
    },
  },
});
