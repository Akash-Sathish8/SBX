import { useEffect } from 'react'
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { prewarmShared } from '../lib/dataCache'
import { AuthProvider } from '../components/auth/AuthProvider'
import { AssistantChat } from '../components/AssistantChat'

import appCss from '../styles.css?url'
import twCss from '../styles/tailwind.css?url'
// Eagerly preload every page's stylesheet at startup so client-side navigation
// applies page CSS from cache near-instantly — mitigates the flash of unstyled
// content (FOUC) from the per-route <link> loading after the HTML paints. Kept as
// preload (not mounted stylesheets) so it never conflicts with the per-route link
// that styles each page on first/SSR paint, incl. CSS shared across routes.
// (entries drop out of this list as each page converts to Tailwind and its
// css file is deleted — games/venues/teams/conferences are already gone)
import agendaCss from '../pages/agenda.css?url'
import venuePlanCss from '../pages/venue-plan.css?url'
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
      // Tailwind loads FIRST so legacy page CSS keeps winning ties while pages
      // convert; untagged, so PageCssGuard never disables it.
      { rel: 'stylesheet', href: twCss },
      { rel: 'stylesheet', href: appCss },
      // preload (not prefetch): iOS Safari ignores rel=prefetch, so the warmup
      // never happened on the platform that needs it most.
      { rel: 'preload', as: 'style', href: agendaCss },
      { rel: 'preload', as: 'style', href: venuePlanCss },
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
