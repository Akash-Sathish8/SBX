import { createRouter as createTanStackRouter, Link } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

// Inline-styled so it renders correctly with no per-route stylesheet mounted
// (this component can appear on any unknown URL).
function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: '#0a0a0a', color: '#fff', fontFamily: "'Barlow', sans-serif", textAlign: 'center', padding: 24 }}>
      <img src="/img/logo.png" alt="Snapback" style={{ width: 64, height: 64 }} />
      <h1 style={{ fontFamily: "'Anton', sans-serif", fontSize: 48, margin: 0, letterSpacing: 1 }}>OFFSIDE</h1>
      <p style={{ margin: 0, opacity: 0.8 }}>This page doesn't exist. The play continues back home.</p>
      <Link to="/" style={{ background: '#FFD400', color: '#0a0a0a', padding: '12px 28px', fontWeight: 700, textDecoration: 'none', textTransform: 'uppercase' }}>
        Back to Snapback →
      </Link>
    </div>
  )
}

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: NotFound,
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
