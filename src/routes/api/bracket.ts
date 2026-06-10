import { createFileRoute } from '@tanstack/react-router';
import { getEventsForDateRange } from '@/lib/espn';

const KNOCKOUT_START = '2026-06-28';
const KNOCKOUT_END = '2026-07-19';

function classifyStage(name: string, shortName: string): string {
  const s = (name + ' ' + shortName).toLowerCase();
  if (s.includes('final') && !s.includes('semi') && !s.includes('quarter')) return 'FINAL';
  if (s.includes('third') || s.includes('3rd')) return '3RD PLACE';
  if (s.includes('semi')) return 'SF';
  if (s.includes('quarter')) return 'QF';
  if (s.includes('round of 16')) return 'R16';
  if (s.includes('round of 32')) return 'R32';
  return 'KNOCKOUT';
}

export const Route = createFileRoute('/api/bracket')({
  server: {
    handlers: {
      GET: async () => {
        const events = await getEventsForDateRange(KNOCKOUT_START, KNOCKOUT_END);
        const grouped: Record<string, typeof events> = {
          R32: [],
          R16: [],
          QF: [],
          SF: [],
          '3RD PLACE': [],
          FINAL: [],
        };
        for (const ev of events) {
          const stage = classifyStage(ev.name, ev.shortName);
          if (!grouped[stage]) grouped[stage] = [];
          grouped[stage].push(ev);
        }
        for (const k of Object.keys(grouped)) {
          grouped[k].sort((a, b) => a.date.localeCompare(b.date));
        }
        return Response.json(
          { ok: true, data: grouped },
          { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
        );
      },
    },
  },
});
