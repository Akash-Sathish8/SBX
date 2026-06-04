import { createFileRoute } from '@tanstack/react-router';
import { SiteNav } from '../components/SiteNav';
import TrackerApp from '../casey/components/TrackerApp';
// navCss = SBX's shared page/nav styles (so SiteNav renders correctly);
// trackerCss = the tracker's compiled Tailwind, scoped to .casey-shell.
import navCss from '../pages/casey.css?url';
import trackerCss from '../pages/casey-tracker.css?url';

export const Route = createFileRoute('/casey')({
  head: () => ({
    meta: [{ title: 'Casey · Snapback WC 2026' }],
    links: [
      { rel: 'stylesheet', href: navCss },
      { rel: 'stylesheet', href: trackerCss },
      { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap' },
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
