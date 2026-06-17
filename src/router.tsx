import { createRouter as createTanStackRouter, Link } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { routeTree } from './routeTree.gen'

// Inline-styled so it renders correctly with no per-route stylesheet mounted
// (this component can appear on any unknown URL).
function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: '#0a0a0a', color: '#fff', fontFamily: "'Barlow', sans-serif", textAlign: 'center', padding: 24 }}>
      <img src="/img/logo.png" alt="Snapback" style={{ width: 64, height: 64 }} />
      <h1 style={{ fontFamily: "'Anton', sans-serif", fontSize: 48, margin: 0, letterSpacing: 1 }}>OFFSIDE</h1>
      <p style={{ margin: 0, opacity: 0.8 }}>This page doesn't exist — the play continues back home.</p>
      <Link to="/" style={{ background: '#FFD400', color: '#0a0a0a', padding: '12px 28px', fontWeight: 700, textDecoration: 'none', textTransform: 'uppercase' }}>
        Back to Snapback →
      </Link>
    </div>
  )
}

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Static JSON (games/venues/fan-intel) changes rarely; live queries set
        // their own shorter staleTime/refetchInterval per-call.
        staleTime: 5 * 60_000,
        refetchOnWindowFocus: false,
      },
    },
  })

  const router = createTanStackRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: 'intent',
    // Always run loaders on intent and let Query's cache decide freshness/dedupe.
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: NotFound,
  })

  // Wires SSR dehydration/hydration of the QueryClient and wraps the app in a
  // QueryClientProvider so route loaders and client useQuery share one cache.
  setupRouterSsrQueryIntegration({ router, queryClient, wrapQueryClient: true })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
