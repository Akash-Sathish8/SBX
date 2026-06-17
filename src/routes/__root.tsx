import { useEffect } from 'react'
import { HeadContent, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { prewarmShared } from '../lib/dataCache'

import appCss from '../styles.css?url'
// Eagerly preload every page's stylesheet at startup so client-side navigation
// applies page CSS from cache near-instantly — mitigates the flash of unstyled
// content (FOUC) from the per-route <link> loading after the HTML paints. Kept as
// preload (not mounted stylesheets) so it never conflicts with the per-route link
// that styles each page on first/SSR paint, incl. CSS shared across routes.
import agendaCss from '../pages/agenda.css?url'
import caseyCss from '../pages/casey.css?url'
import caseyTrackerCss from '../pages/casey-tracker.css?url'
import gameCss from '../pages/game.css?url'
import gamesCss from '../pages/games.css?url'
import guideCss from '../pages/guide.css?url'
import indexPageCss from '../pages/index.css?url'
import venueCss from '../pages/venue.css?url'
import venuesCss from '../pages/venues.css?url'
import shareCss from '../pages/share.css?url'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        // Allow pinch-zoom (accessibility — WCAG 1.4.4). maplibre handles its own
        // gesture zoom on the map, so page-level zoom doesn't fight the tracker.
        content: 'width=device-width, initial-scale=1.0, viewport-fit=cover',
      },
      // Mobile browser chrome matches the brand black instead of flashing white.
      { name: 'theme-color', content: '#0a0a0a' },
      // Stop iOS Safari from auto-linking kickoff times / scores as phone numbers.
      { name: 'format-detection', content: 'telephone=no' },
      { name: 'mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      { title: 'Snapback' },
    ],
    links: [
      // Brand fonts: Anton (headers/taglines), Barlow (body) — global, every page needs them.
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Anton&family=Barlow:wght@400;500;600;700;800&display=swap',
      },
      { rel: 'icon', type: 'image/png', href: '/img/logo.png' },
      { rel: 'apple-touch-icon', href: '/img/logo.png' },
      { rel: 'stylesheet', href: appCss },
      // preload (not prefetch): iOS Safari ignores rel=prefetch, so the warmup
      // never happened on the platform that needs it most.
      { rel: 'preload', as: 'style', href: agendaCss },
      { rel: 'preload', as: 'style', href: caseyCss },
      { rel: 'preload', as: 'style', href: caseyTrackerCss },
      { rel: 'preload', as: 'style', href: gameCss },
      { rel: 'preload', as: 'style', href: gamesCss },
      { rel: 'preload', as: 'style', href: guideCss },
      { rel: 'preload', as: 'style', href: indexPageCss },
      { rel: 'preload', as: 'style', href: venueCss },
      { rel: 'preload', as: 'style', href: venuesCss },
      { rel: 'preload', as: 'style', href: shareCss },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  // Warm the JSON every interior route shares (games index, fan intel) + the
  // logo right after first paint, so the first navigation already has its data.
  useEffect(() => { prewarmShared() }, [])
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
