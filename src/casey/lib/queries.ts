import { queryOptions } from '@tanstack/react-query';
import type { GroupStandings, ScoreboardEvent } from './espn';

// Shared TanStack Query layer for Casey's LIVE tracker endpoints (scores,
// standings, bracket, admin panels). Unlike the static venue/game JSON in
// src/lib/queries.ts, these are live data and must never be statically cached,
// so every fetch is `cache: 'no-store'`.
//
// `liveJson` throws on a transport-level failure so Query surfaces it as
// `isError` (and retries with backoff) instead of each component hand-rolling a
// `useEffect` + `cancelled` flag that silently collapses a feed outage into an
// empty "no data yet" state. The `{ ok, data }` envelope is returned as-is so
// callers can still distinguish ok:false (a real 200 with no data) from a throw.
export async function liveJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`fetch ${url} -> ${r.status}`);
  return (await r.json()) as T;
}

type Envelope<T> = { ok?: boolean; data?: T };

// Live data: the server caches upstream ESPN ~5 min, so a 60 s client staleTime
// dedupes rapid tab-switching without serving anything truly stale.
const LIVE_STALE = 60_000;

export function standingsAllQueryOptions() {
  return queryOptions({
    queryKey: ['casey', 'standings-all'],
    queryFn: () => liveJson<Envelope<GroupStandings[]>>('/api/standings/all'),
    staleTime: LIVE_STALE,
  });
}

export function bracketQueryOptions() {
  return queryOptions({
    queryKey: ['casey', 'bracket'],
    queryFn: () => liveJson<Envelope<Record<string, ScoreboardEvent[]>>>('/api/bracket'),
    staleTime: LIVE_STALE,
  });
}

export function standingsGroupQueryOptions(group: string) {
  return queryOptions({
    queryKey: ['casey', 'standings', group],
    queryFn: () =>
      liveJson<Envelope<GroupStandings>>(`/api/standings?group=${encodeURIComponent(group)}`),
    enabled: group.length > 0,
    staleTime: LIVE_STALE,
  });
}
