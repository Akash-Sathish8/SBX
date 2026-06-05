import { createFileRoute } from '@tanstack/react-router';
import { SiteNav } from '../components/SiteNav';
import TrackerApp from '../casey/components/TrackerApp';
import { ITINERARY } from '@/lib/itinerary';
import navCss from '../pages/casey.css?url';
import trackerCss from '../pages/casey-tracker.css?url';

export const Route = createFileRoute('/casey/match/$number')({
  head: ({ params }) => {
    const n = Number(params.number);
    const match = ITINERARY.find((m) => m.matchNumber === n);
    return {
      meta: [{ title: match ? `${match.match} · Casey Tracker` : 'Match not found · Casey Tracker' }],
      links: [
        { rel: 'stylesheet', href: navCss },
        { rel: 'stylesheet', href: trackerCss },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap' },
        { rel: 'stylesheet', href: 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css' },
      ],
    };
  },
  component: MatchRoute,
});

function MatchRoute() {
  const { number } = Route.useParams();
  const n = Number(number);
  const valid = Number.isFinite(n) && ITINERARY.some((m) => m.matchNumber === n);
  return (
    <>
      <SiteNav active="casey" />
      <div className="casey-shell">
        <TrackerApp initialMatchNumber={valid ? n : undefined} />
      </div>
    </>
  );
}
