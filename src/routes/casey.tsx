import { createFileRoute, Outlet } from '@tanstack/react-router';
// The tracker's custom CSS (markers/keyframes/MapLibre), scoped to .casey-shell.
import trackerCss from '../styles/casey-tracker.css?url';

// Layout route for /casey/*. In TanStack flat routing this is the PARENT of
// casey.index (the tracker), casey.admin, and casey.match.$number — so it must
// render an <Outlet/> for those children. (Previously it rendered the tracker
// directly with no Outlet, which made /casey/admin and /casey/match/* fall
// through to the tracker instead of their own components.)
export const Route = createFileRoute('/casey')({
  component: () => <Outlet />,
  head: () => ({
    meta: [{ title: 'Casey · Snapback WC 2026' }],
    links: [
      { rel: 'stylesheet', href: trackerCss },
      // tracker CSS (.stamp, .day-watermark, mono readouts) and the map popups
      { rel: 'stylesheet', href: 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css' },
    ],
  }),
});
