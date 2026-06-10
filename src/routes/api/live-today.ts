import { createFileRoute } from '@tanstack/react-router';
import { getEventsForDate } from '@/lib/espn';

export const Route = createFileRoute('/api/live-today')({
  server: {
    handlers: {
      GET: async () => {
        const today = new Date().toISOString().slice(0, 10);
        const events = await getEventsForDate(today);
        return Response.json(
          { ok: true, date: today, data: events },
          { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } },
        );
      },
    },
  },
});
