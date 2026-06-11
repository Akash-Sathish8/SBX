// The "Today" activity feed — a single chronological stream of everything
// happening across the tournament, derived purely from the itinerary (no extra
// backend call). Each match can surface one or more discrete events:
//
//   live     — a match is in progress right now
//   result   — a match finished ("Mexico beat South Africa 2–0")
//   vlog     — Casey posted a vlog for the match
//   bet      — Casey dropped his Underdog pick for the match
//   agenda   — Casey posted his gameday agenda for the match
//   upcoming — a match with no Casey content yet that kicks off soon
//
// This is intentionally one pure function so the Today modal only depends on
// FeedEvent[] and the follow-filter is a trivial array .filter() on top.

import { zonedTimeToUtc } from './time';
import type { ItineraryMatch } from './types';

export type FeedEventType =
  | 'live'
  | 'result'
  | 'vlog'
  | 'bet'
  | 'agenda'
  | 'upcoming';

export interface FeedEvent {
  id: string;
  type: FeedEventType;
  matchNumber: number;
  homeTeam: string;
  awayTeam: string;
  /** Non-TBD teams in this match — what the FOLLOWING tab matches against. */
  teams: string[];
  date: string;
  stage: string;
  kickoffMs: number;
  /** The big line — "Casey dropped his bet", "Mexico beat South Africa 2–0". */
  headline: string;
  /** The matchup — "Mexico vs South Africa". */
  detail: string;
  /** Short relative date chip — "TODAY", "TOMORROW", "SAT JUN 13". */
  meta: string;
}

// Only generate filler "upcoming" cards for matches kicking off within this
// window — otherwise every one of the ~100 fixtures would flood the feed.
const UPCOMING_WINDOW_MS = 6 * 24 * 60 * 60 * 1000;
// Keep the feed fresh: show only the most recent finished matches.
const MAX_RESULTS = 15;
const DAY_MS = 24 * 60 * 60 * 1000;

function kickoffMsOf(m: ItineraryMatch): number {
  try {
    return zonedTimeToUtc(m.kickoffLocal, m.kickoffTZ).getTime();
  } catch {
    return Date.parse(m.date) || 0;
  }
}

function teamsOf(m: ItineraryMatch): string[] {
  return [m.homeTeam, m.awayTeam].filter((t) => t && t !== 'TBD');
}

function matchup(m: ItineraryMatch): string {
  return `${m.homeTeam} vs ${m.awayTeam}`;
}

function resultHeadline(m: ItineraryMatch): string {
  const hs = m.result?.homeScore;
  const as = m.result?.awayScore;
  if (hs == null || as == null) return `${matchup(m)} — full time`;
  if (hs === as) return `${m.homeTeam} ${hs}–${as} ${m.awayTeam} · draw`;
  const [winner, loser, ws, ls] =
    hs > as ? [m.homeTeam, m.awayTeam, hs, as] : [m.awayTeam, m.homeTeam, as, hs];
  return `${winner} beat ${loser} ${ws}–${ls}`;
}

function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dayLabel(ms: number, nowMs: number): string {
  const diff = Math.round((startOfLocalDay(ms) - startOfLocalDay(nowMs)) / DAY_MS);
  if (diff === 0) return 'TODAY';
  if (diff === 1) return 'TOMORROW';
  if (diff === -1) return 'YESTERDAY';
  return new Date(ms)
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .toUpperCase();
}

// Ordering: LIVE first, then the future soonest-first ("what's next" — Casey's
// posted bets/agendas + imminent matches), then the past most-recent-first
// ("what just happened" — results + vlogs). When two events share a match/time,
// fall back to a stable type order.
const TYPE_ORDER: Record<FeedEventType, number> = {
  live: 0,
  result: 0,
  vlog: 1,
  bet: 1,
  agenda: 2,
  upcoming: 3,
};

export function buildFeed(matches: ItineraryMatch[], nowMs: number): FeedEvent[] {
  const events: FeedEvent[] = [];

  for (const m of matches) {
    const ko = kickoffMsOf(m);
    const status = m.result?.status ?? 'scheduled';
    const hasAgenda = Boolean(m.agenda && m.agenda.trim());
    const base = {
      matchNumber: m.matchNumber,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      teams: teamsOf(m),
      date: m.date,
      stage: m.stage,
      kickoffMs: ko,
      detail: matchup(m),
      meta: dayLabel(ko, nowMs),
    };

    // A live match is its own urgent card; nothing else competes with it.
    if (status === 'live') {
      events.push({ ...base, id: `live-${m.matchNumber}`, type: 'live', headline: `LIVE NOW — ${matchup(m)}` });
      continue;
    }

    if (status === 'final') {
      events.push({ ...base, id: `result-${m.matchNumber}`, type: 'result', headline: resultHeadline(m) });
    }
    if (m.youtubeId) {
      events.push({ ...base, id: `vlog-${m.matchNumber}`, type: 'vlog', headline: 'Casey dropped a new vlog' });
    }
    // Bets/agendas are pre-match prep — once a game is final the result speaks.
    if (status !== 'final') {
      if (m.betSlipImage) {
        events.push({ ...base, id: `bet-${m.matchNumber}`, type: 'bet', headline: 'Casey dropped his bet' });
      }
      if (hasAgenda) {
        events.push({ ...base, id: `agenda-${m.matchNumber}`, type: 'agenda', headline: 'Casey posted his agenda' });
      }
      const hasContent = Boolean(m.betSlipImage) || hasAgenda || Boolean(m.youtubeId);
      if (!hasContent && ko >= nowMs && ko - nowMs <= UPCOMING_WINDOW_MS) {
        events.push({ ...base, id: `up-${m.matchNumber}`, type: 'upcoming', headline: matchup(m) });
      }
    }
  }

  // Trim to the most recent results so old finals don't pile up at the bottom.
  const recentResultIds = new Set(
    events
      .filter((e) => e.type === 'result')
      .sort((a, b) => b.kickoffMs - a.kickoffMs)
      .slice(0, MAX_RESULTS)
      .map((e) => e.id),
  );
  const trimmed = events.filter((e) => e.type !== 'result' || recentResultIds.has(e.id));

  trimmed.sort((a, b) => {
    if (a.type === 'live' && b.type !== 'live') return -1;
    if (b.type === 'live' && a.type !== 'live') return 1;
    const aFuture = a.kickoffMs >= nowMs;
    const bFuture = b.kickoffMs >= nowMs;
    if (aFuture !== bFuture) return aFuture ? -1 : 1;
    if (a.kickoffMs !== b.kickoffMs) {
      return aFuture ? a.kickoffMs - b.kickoffMs : b.kickoffMs - a.kickoffMs;
    }
    return TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
  });

  return trimmed;
}

/** How many feed events are live or happening today — drives the TODAY badge. */
export function countLiveAndToday(events: FeedEvent[]): number {
  return events.filter((e) => e.type === 'live' || e.meta === 'TODAY').length;
}
