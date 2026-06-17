import { createFileRoute } from '@tanstack/react-router';
import { SiteNav } from '../components/SiteNav';
import TrackerApp from '../casey/components/TrackerApp';
// The tracker's custom CSS (markers/keyframes/MapLibre) — scoped to .casey-shell
// so it can load on the casey routes without leaking onto the rest of the app.
import trackerCss from '../styles/casey-tracker.css?url';

export const Route = createFileRoute('/casey/')({
  head: () => ({
    meta: [{ title: 'Casey · Snapback WC 2026' }],
    links: [
      { rel: 'stylesheet', href: trackerCss },
      { rel: 'stylesheet', href: 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css' },
    ],
  }),
  component: Casey,
});

function Casey() {
  return (
    <>
      <SiteNav active="casey" />
      <div className="casey-shell">
        <TrackerApp />
      </div>
    </>
  );
}
