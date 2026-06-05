import { createFileRoute } from '@tanstack/react-router';
import { getGroupStandings } from '@/lib/espn';

export const Route = createFileRoute('/api/standings')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const group = new URL(request.url).searchParams.get('group');
        if (!group) {
          return Response.json({ ok: false, error: 'group required' }, { status: 400 });
        }
        const standings = await getGroupStandings(group);
        return Response.json(
          { ok: true, data: standings },
          { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
        );
      },
    },
  },
});
