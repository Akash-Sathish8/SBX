import { useEffect } from 'react'
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { prewarmShared } from '../lib/dataCache'
import { AuthProvider } from '../components/auth/AuthProvider'
import { AssistantChat } from '../components/AssistantChat'

import appCss from '../styles.css?url'
// Global, always-on auth styles (modal + save prompt). Untagged on purpose:
// PageCssGuard only disables links carrying data-page-css, so this survives on
// every route — the auth modal can open from home, /rank, anywhere.
import authCss from '../styles/auth.css?url'
// Global subpage nav styles (the hamburger menu). Untagged for the same reason as
// authCss — SiteNav renders on every non-home route and must always be styled.
import navCss from '../styles/nav.css?url'
// Eagerly preload every page's stylesheet at startup so client-side navigation
// applies page CSS from cache near-instantly — mitigates the flash of unstyled
// content (FOUC) from the per-route <link> loading after the HTML paints. Kept as
// preload (not mounted stylesheets) so it never conflicts with the per-route link
// that styles each page on first/SSR paint, incl. CSS shared across routes.
import agendaCss from '../pages/agenda.css?url'
import gameCss from '../pages/game.css?url'
import gamesCss from '../pages/games.css?url'
import guideCss from '../pages/guide.css?url'
import homeCss from '../pages/home.css?url'
import searchboxCss from '../pages/searchbox.css?url'
import venueCss from '../pages/venue.css?url'
import venuesCss from '../pages/venues.css?url'
import shareCss from '../pages/share.css?url'
import gamerowCss from '../pages/gamerow.css?url'
import weekendCss from '../pages/weekend.css?url'
import teamCss from '../pages/team.css?url'
import teamsCss from '../pages/teams.css?url'
import nexthopCss from '../pages/nexthop.css?url'

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
      { rel: 'stylesheet', href: authCss },
      { rel: 'stylesheet', href: navCss },
      // preload (not prefetch): iOS Safari ignores rel=prefetch, so the warmup
      // never happened on the platform that needs it most.
      { rel: 'preload', as: 'style', href: agendaCss },
      { rel: 'preload', as: 'style', href: gameCss },
      { rel: 'preload', as: 'style', href: gamesCss },
      { rel: 'preload', as: 'style', href: guideCss },
      { rel: 'preload', as: 'style', href: homeCss },
      { rel: 'preload', as: 'style', href: searchboxCss },
      { rel: 'preload', as: 'style', href: venueCss },
      { rel: 'preload', as: 'style', href: venuesCss },
      { rel: 'preload', as: 'style', href: shareCss },
      { rel: 'preload', as: 'style', href: gamerowCss },
      { rel: 'preload', as: 'style', href: weekendCss },
      { rel: 'preload', as: 'style', href: teamCss },
      { rel: 'preload', as: 'style', href: teamsCss },
      { rel: 'preload', as: 'style', href: nexthopCss },
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
        <AuthProvider>
          {children}
          {/* BackBuddy — the Snapback assistant, present on every page (scopes itself by route) */}
          <AssistantChat />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  )
}
