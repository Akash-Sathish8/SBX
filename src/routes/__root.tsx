import { useEffect } from 'react'
import { HeadContent, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { prewarmShared } from '../lib/dataCache'

// styles.css is the single global stylesheet: the Tailwind v4 entry (theme +
// utilities + a few @utility/@keyframes primitives). Every marketing page is on
// utilities now — there are no per-page salvage stylesheets left.
import appCss from '../styles.css?url'
// Casey tracker still ships its own custom CSS (markers/keyframes/MapLibre) —
// preloaded so the /casey chunk's stylesheet is warm.
import caseyTrackerCss from '../styles/casey-tracker.css?url'

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
      // Brand fonts (Anton + Barlow) are self-hosted via @fontsource — imported in
      // styles.css, so no Google Fonts <link> / preconnect is needed here.
      { rel: 'icon', type: 'image/png', href: '/img/logo.png' },
      { rel: 'apple-touch-icon', href: '/img/logo.png' },
      { rel: 'stylesheet', href: appCss },
      // preload (not prefetch): iOS Safari ignores rel=prefetch. Only the casey
      // tracker has its own stylesheet left to warm.
      { rel: 'preload', as: 'style', href: caseyTrackerCss },
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
