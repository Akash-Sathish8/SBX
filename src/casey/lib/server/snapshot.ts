// The admin-driven slice of state that the public read paths (/api/bootstrap and
// /api/live) need. It changes ONLY on an admin write — which bumps data:version —
// so we cache the assembled snapshot at the edge keyed by that version. Steady
// state per public request becomes one KV read (the version) + a local Cache API
// hit, instead of ~8 KV reads plus prefix-list fan-outs. On a miss (once per colo
// after a write, or after the backstop TTL) we recompute and repopulate.
//
// Time-dependent values (location, stats) are NOT part of the snapshot — the
// callers derive those per request from the snapshot's positionOverride + results.

import type {
  ItineraryMatch,
  Stadium,
  MatchResult,
  SpendTracker,
  PositionOverride,
} from '../types';
import { getMergedItinerary, getMergedStadiums } from '../merged-itinerary';
import {
  getPositionOverride,
  getSpend,
  getAllResults,
  getVisibilityFlags,
  getUnderdogReferral,
  getDataVersion,
  type VisibilityFlags,
} from './kv';

export interface PublicSnapshot {
  itinerary: ItineraryMatch[]; // full merged itinerary (NOT visibility-stripped)
  stadiums: Record<string, Stadium>;
  results: Record<number, MatchResult>;
  spend: SpendTracker;
  positionOverride: PositionOverride | null;
  visibility: VisibilityFlags;
  underdogReferral: string;
}

async function computeSnapshot(): Promise<PublicSnapshot> {
  const [itinerary, stadiums, positionOverride, spend, results, visibility, underdogReferral] =
    await Promise.all([
      getMergedItinerary(),
      getMergedStadiums(),
      getPositionOverride(),
      getSpend(),
      getAllResults(),
      getVisibilityFlags(),
      getUnderdogReferral(),
    ]);
  return { itinerary, stadiums, positionOverride, spend, results, visibility, underdogReferral };
}

export async function getPublicSnapshot(): Promise<PublicSnapshot> {
  const cache = typeof caches !== 'undefined' ? caches.default : undefined;
  if (!cache) return computeSnapshot();

  const version = await getDataVersion();
  const key = new Request(`https://snapshot.internal/public/${version}`);
  const hit = await cache.match(key);
  if (hit) return (await hit.json()) as PublicSnapshot;

  const snap = await computeSnapshot();
  // max-age is a backstop: stale-version keys are never matched again anyway, but
  // this guarantees the entry is eventually evicted even if the version never moves.
  await cache.put(
    key,
    new Response(JSON.stringify(snap), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
    }),
  );
  return snap;
}
