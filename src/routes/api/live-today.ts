import { createFileRoute } from '@tanstack/react-router';
import { getEventsForDate } from '@/lib/espn';

export const Route = createFileRoute('/api/live-today')({
  server: {
    handlers: {
      GET: async () => {
        // ESPN dates are UTC days, but the tournament runs on US evenings: after
        // ~8pm ET the UTC date has already rolled over and tonight's matches live
        // on "yesterday". Fetch both days (same hedge as /api/today) and dedupe.
        const now = new Date();
        const today = now.toISOString().slice(0, 10);
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const [a, b] = await Promise.all([getEventsForDate(yesterday), getEventsForDate(today)]);
        const seen = new Set<string>();
        const events = [...a, ...b]
          .filter((ev) => (seen.has(ev.id) ? false : (seen.add(ev.id), true)))
          .sort((x, y) => x.date.localeCompare(y.date));
        // Label with the viewer-relevant (tournament) calendar day, not raw UTC.
        const label = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(now);
        return Response.json(
          { ok: true, date: label, data: events },
          { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } },
        );
      },
    },
  },
});
