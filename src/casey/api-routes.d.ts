// Augments TanStack Router's FileRoutesByPath so createFileRoute() in the
// Casey API route files type-checks without a running vite-router-plugin pass.
// The plugin will overwrite routeTree.gen.ts (and make this redundant) on
// first `vite dev` / `vite build`, but for `tsc --noEmit` we need these now.
export {};
declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/api/bootstrap': {
      id: '/api/bootstrap'
      path: '/api/bootstrap'
      fullPath: '/api/bootstrap'
      preLoaderRoute: never
      parentRoute: never
    }
    '/api/bracket': {
      id: '/api/bracket'
      path: '/api/bracket'
      fullPath: '/api/bracket'
      preLoaderRoute: never
      parentRoute: never
    }
    '/api/live-today': {
      id: '/api/live-today'
      path: '/api/live-today'
      fullPath: '/api/live-today'
      preLoaderRoute: never
      parentRoute: never
    }
    '/api/live': {
      id: '/api/live'
      path: '/api/live'
      fullPath: '/api/live'
      preLoaderRoute: never
      parentRoute: never
    }
    '/api/match-score': {
      id: '/api/match-score'
      path: '/api/match-score'
      fullPath: '/api/match-score'
      preLoaderRoute: never
      parentRoute: never
    }
    '/api/standings/all': {
      id: '/api/standings/all'
      path: '/api/standings/all'
      fullPath: '/api/standings/all'
      preLoaderRoute: never
      parentRoute: never
    }
    '/api/standings': {
      id: '/api/standings'
      path: '/api/standings'
      fullPath: '/api/standings'
      preLoaderRoute: never
      parentRoute: never
    }
    '/api/today': {
      id: '/api/today'
      path: '/api/today'
      fullPath: '/api/today'
      preLoaderRoute: never
      parentRoute: never
    }
    '/api/visibility': {
      id: '/api/visibility'
      path: '/api/visibility'
      fullPath: '/api/visibility'
      preLoaderRoute: never
      parentRoute: never
    }
  }
}
