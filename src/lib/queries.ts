import { queryOptions } from '@tanstack/react-query'

// Central TanStack Query option factories for the per-item static JSON (venue +
// game detail). These files are build-time-static and served with a long cache
// header (see public/_headers), so a long staleTime keeps them out of refetch.
// Shared by route components (useQuery) and intent-prefetch (prefetchQuery).

const STATIC_STALE = 60 * 60_000 // 1h — content only changes on deploy

// Strip anything that isn't a safe id char. Exported so route components key
// their <img>/warm/lookup off the SAME sanitized id the query options use —
// otherwise the route and the query cache can disagree.
export const sanitizeId = (id: string) => (id || '').replace(/[^a-z0-9_-]/gi, '')

async function fetchJSON<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`fetch ${url} -> ${r.status}`)
  return (await r.json()) as T
}

export function venueQueryOptions(id: string) {
  const clean = sanitizeId(id)
  return queryOptions({
    queryKey: ['venue', clean],
    queryFn: () => fetchJSON<any>(`/data/venues/${clean}.json`),
    enabled: clean.length > 0,
    staleTime: STATIC_STALE,
  })
}

export function gameDetailQueryOptions(id: string) {
  const clean = sanitizeId(id)
  return queryOptions({
    queryKey: ['game-detail', clean],
    queryFn: () => fetchJSON<any>(`/data/games/${clean}.json`),
    enabled: clean.length > 0,
    staleTime: STATIC_STALE,
  })
}
