// Server-side computation of admin "what needs attention" items.
// Scans the itinerary, results, position override, and visibility flags
// for anything the admin should look at.

import type { ItineraryMatch, MatchResult, PositionOverride } from './types';
import { zonedTimeToUtc } from './time';

export type AttentionSeverity = 'high' | 'medium' | 'low';

export interface AttentionItem {
  id: string;
  severity: AttentionSeverity;
  category:
    | 'missing-result'
    | 'missing-vlog'
    | 'stale-live'
    | 'expired-override'
    | 'visibility-info';
  title: string;
  detail: string;
  matchNumber?: number;
  action?: string;
}

const HOUR_MS = 60 * 60 * 1000;

export function computeAttention(args: {
  itinerary: ItineraryMatch[];
  results: Record<number, MatchResult>;
  override: PositionOverride | null;
  visibility: { showLodging: boolean; showTransport: boolean };
  now?: Date;
}): AttentionItem[] {
  const now = (args.now ?? new Date()).getTime();
  const items: AttentionItem[] = [];

  for (const m of args.itinerary) {
    const ko = zonedTimeToUtc(m.kickoffLocal, m.kickoffTZ).getTime();
    const hoursSinceKickoff = (now - ko) / HOUR_MS;
    const result = args.results[m.matchNumber];

    // 1. Past kickoff (>3 h since whistle) with no admin-entered result.
    if (hoursSinceKickoff > 3 && (!result || result.status === 'scheduled')) {
      items.push({
        id: `missing-result-${m.matchNumber}`,
        severity: hoursSinceKickoff > 24 ? 'high' : 'medium',
        category: 'missing-result',
        title: `MATCH #${m.matchNumber} · NO RESULT ENTERED`,
        detail: `${m.match} kicked off ${formatRelative(hoursSinceKickoff)} ago.`,
        matchNumber: m.matchNumber,
        action: 'Open match editor and set final score.',
      });
    }

    // 2. Final result entered but no YouTube vlog linked.
    if (result?.status === 'final' && !m.youtubeId) {
      const hoursSinceFinal = hoursSinceKickoff;
      // Only nag after 12 h so admin has time to upload + link.
      if (hoursSinceFinal > 12) {
        items.push({
          id: `missing-vlog-${m.matchNumber}`,
          severity: hoursSinceFinal > 72 ? 'medium' : 'low',
          category: 'missing-vlog',
          title: `MATCH #${m.matchNumber} · NO VLOG LINKED`,
          detail: `${m.match} ended ${formatRelative(hoursSinceFinal)} ago. Result is logged but YouTube ID is empty.`,
          matchNumber: m.matchNumber,
          action: 'Paste the YouTube video ID in the match editor.',
        });
      }
    }

    // 3. Stale live: status === 'live' but match should be done by now.
    if (result?.status === 'live' && hoursSinceKickoff > 4) {
      items.push({
        id: `stale-live-${m.matchNumber}`,
        severity: 'high',
        category: 'stale-live',
        title: `MATCH #${m.matchNumber} · STILL MARKED LIVE`,
        detail: `${m.match} status is 'live' but kicked off ${formatRelative(hoursSinceKickoff)} ago. Probably needs a final score.`,
        matchNumber: m.matchNumber,
        action: 'Update status to final.',
      });
    }
  }

  // 4. Expired position override still flagged active.
  if (args.override?.active && args.override.expiresAt) {
    const expiresMs = new Date(args.override.expiresAt).getTime();
    if (!Number.isNaN(expiresMs) && expiresMs < now) {
      items.push({
        id: 'expired-override',
        severity: 'medium',
        category: 'expired-override',
        title: 'POSITION OVERRIDE EXPIRED',
        detail: `Override is marked active but its expiresAt (${args.override.expiresAt}) passed ${formatRelative((now - expiresMs) / HOUR_MS)} ago. Casey's position is being held in place.`,
        action: 'Clear the override on the POSITION tab.',
      });
    }
  }

  // 5. Visibility info — not an error, just a status line so admins remember.
  const lodging = args.visibility.showLodging;
  const transport = args.visibility.showTransport;
  if (!lodging && !transport) {
    items.push({
      id: 'visibility-status',
      severity: 'low',
      category: 'visibility-info',
      title: 'TRIP DETAILS · ALL HIDDEN (DEFAULT)',
      detail: 'Lodging and transport are hidden on the public match cards. Toggle on the VISIBILITY tab if Snapback approves sharing.',
    });
  } else if (lodging !== transport) {
    items.push({
      id: 'visibility-partial',
      severity: 'low',
      category: 'visibility-info',
      title: `TRIP DETAILS · PARTIAL (${lodging ? 'LODGING' : 'TRANSPORT'} ON)`,
      detail: `Only one of lodging/transport is visible publicly. Confirm this matches the approval.`,
    });
  }

  // Sort: high → medium → low, then by category/matchNumber for stability.
  const sevWeight = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => {
    const w = sevWeight[a.severity] - sevWeight[b.severity];
    if (w !== 0) return w;
    return (a.matchNumber ?? 999) - (b.matchNumber ?? 999);
  });

  return items;
}

function formatRelative(hours: number): string {
  const abs = Math.abs(hours);
  if (abs < 1) return `${Math.round(abs * 60)} min`;
  if (abs < 36) return `${Math.round(abs)} h`;
  return `${Math.round(abs / 24)} d`;
}
