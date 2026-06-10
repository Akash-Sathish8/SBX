import { createFileRoute } from '@tanstack/react-router';
import { ITINERARY } from '@/lib/itinerary';
import { getEventsForDate, type ScoreboardEvent } from '@/lib/espn';

const VLOG_LIMIT = 6;
const RESULT_LIMIT = 12;

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export const Route = createFileRoute('/api/today')({
  server: {
    handlers: {
      GET: async () => {
        const now = new Date();
        const today = ymd(now);
        const yesterday = ymd(new Date(now.getTime() - 24 * 60 * 60 * 1000));

        const vlogs = ITINERARY.filter((m) => Boolean(m.youtubeId))
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, VLOG_LIMIT)
          .map((m) => ({
            kind: 'vlog' as const,
            matchNumber: m.matchNumber,
            match: m.match,
            date: m.date,
            homeTeam: m.homeTeam,
            awayTeam: m.awayTeam,
            youtubeId: m.youtubeId as string,
            thumbnail: `https://i.ytimg.com/vi/${m.youtubeId}/mqdefault.jpg`,
          }));

        let events: ScoreboardEvent[] = [];
        try {
          const [a, b] = await Promise.all([
            getEventsForDate(yesterday),
            getEventsForDate(today),
          ]);
          events = [...a, ...b];
        } catch {
          events = [];
        }

        const results = events
          .filter((ev) => ev.status === 'in' || ev.status === 'post')
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, RESULT_LIMIT)
          .map((ev) => ({
            kind: 'result' as const,
            eventId: ev.id,
            shortName: ev.shortName,
            home: ev.home,
            away: ev.away,
            status: ev.status,
            detail: ev.detail,
            completed: ev.completed,
            when: ev.date,
          }));

        const items = [...vlogs, ...results];

        return Response.json(
          { ok: true, generatedAt: now.toISOString(), items },
          {
            headers: {
              'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
            },
          },
        );
      },
    },
  },
});
