import { createFileRoute } from '@tanstack/react-router';
import { SiteNav } from '../components/SiteNav';
import { PageCssGuard } from '../components/PageCssGuard';
import TrackerApp from '../casey/components/TrackerApp';
// navCss = SBX's shared page/nav styles; trackerCss = the tracker's compiled
// Tailwind, scoped to .casey-shell.
import navCss from '../pages/casey.css?url';
import trackerCss from '../pages/casey-tracker.css?url';

export const Route = createFileRoute('/casey/')({
  head: () => ({
    meta: [{ title: 'Casey · Snapback WC 2026' }],
    // Tag the page CSS so PageCssGuard can retire it on navigation away. Without
    // the data-page-css tag the tracker's global Tailwind preflight reset stays
    // applied (media=all) forever and wrecks the layout of the next page.
    links: [
      { rel: 'stylesheet', href: navCss, 'data-page-css': 'casey' },
      { rel: 'stylesheet', href: trackerCss, 'data-page-css': 'casey' },
      { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap', 'data-page-css': 'casey' },
      { rel: 'stylesheet', href: 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css', 'data-page-css': 'casey' },
    ],
  }),
  component: Casey,
});

function Casey() {
  return (
    <>
      <PageCssGuard id="casey" />
      <SiteNav active="casey" />
      <div className="casey-shell">
        <TrackerApp />
      </div>
    </>
  );
}
