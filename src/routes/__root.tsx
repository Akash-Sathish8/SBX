import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

import appCss from '../styles.css?url'
// Eagerly preload every page's stylesheet at startup so client-side navigation
// applies page CSS from cache near-instantly — mitigates the flash of unstyled
// content (FOUC) from the per-route <link> loading after the HTML paints. Kept as
// preload (not mounted stylesheets) so it never conflicts with the per-route link
// that styles each page on first/SSR paint, incl. CSS shared across routes.
import gameCss from '../pages/game.css?url'
import gamesCss from '../pages/games.css?url'
import guideCss from '../pages/guide.css?url'
import indexPageCss from '../pages/index.css?url'
import venueCss from '../pages/venue.css?url'
import venuesCss from '../pages/venues.css?url'
import shareCss from '../pages/share.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        // Lock zoom on mobile (no pinch / double-tap zoom) per product decision.
        content: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover',
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
      { rel: 'prefetch', as: 'style', href: gameCss },
      { rel: 'prefetch', as: 'style', href: gamesCss },
      { rel: 'prefetch', as: 'style', href: guideCss },
      { rel: 'prefetch', as: 'style', href: indexPageCss },
      { rel: 'prefetch', as: 'style', href: venueCss },
      { rel: 'prefetch', as: 'style', href: venuesCss },
      { rel: 'prefetch', as: 'style', href: shareCss },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
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
