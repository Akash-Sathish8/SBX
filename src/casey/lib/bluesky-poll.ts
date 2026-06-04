// Bluesky poll orchestrator. Pulls posts about each World Cup match
// from Bluesky's public search, tags them to matches, persists in KV.
//
// Strategy: for every match in the current "buzz window" (a day before
// to a day after kickoff), build a few targeted search queries from
// the home/away team names and stadium. Aggregate results, dedupe by
// post URI, run the existing tagger to attach matches, store.
//
// Bluesky's public unauthenticated search endpoint has rate limits
// around 3000 requests per 5 minutes, well above what we need
// (34 matches × 2 queries × 1 poll/15min ≈ 270 req/hour).

import { ITINERARY, STADIUMS } from './itinerary';
import { searchBlueskyPosts } from './bluesky';
import { tagTweet } from './tweet-tagger';
import {
  upsertTweets,
  getTweetTags,
  bulkSetTweetTags,
  type TweetTag,
} from './kv';
import { zonedTimeToUtc } from './time';
import type { Tweet } from './x';
import type { ItineraryMatch } from './types';

const HOUR_MS = 60 * 60 * 1000;
const BUZZ_WINDOW_BEFORE_MS = 24 * HOUR_MS;
const BUZZ_WINDOW_AFTER_MS = 36 * HOUR_MS;
const PER_QUERY_LIMIT = 25;

function matchesInBuzzWindow(now: Date): ItineraryMatch[] {
  const nowMs = now.getTime();
  return ITINERARY.filter((m) => {
    try {
      const ko = zonedTimeToUtc(m.kickoffLocal, m.kickoffTZ).getTime();
      return nowMs - ko < BUZZ_WINDOW_AFTER_MS && ko - nowMs < BUZZ_WINDOW_BEFORE_MS;
    } catch {
      return false;
    }
  });
}

// Build a small set of Bluesky search queries for a given match. We keep
// queries simple (single team term or a single hashtag) because Bluesky's
// search ranks short, focused queries better than long boolean expressions.
export function queriesForMatch(m: ItineraryMatch): string[] {
  const queries = new Set<string>();
  const stadium = STADIUMS[m.stadiumId];

  // Per-team queries paired with "world cup" so we filter out unrelated
  // mentions of the team name (e.g. tweets about USMNT friendlies).
  queries.add(`${m.homeTeam} world cup`);
  queries.add(`${m.awayTeam} world cup`);

  // Vs-style hashtags that fans commonly use.
  const home = m.homeTeam.replace(/\s+/g, '');
  const away = m.awayTeam.replace(/\s+/g, '');
  queries.add(`#${home}vs${away}`);

  // Notable stadiums get their own query — the lesser-known ones don't
  // generate enough buzz alone, so we cap at the marquee venues.
  if (
    stadium &&
    ['estadio_azteca', 'sofi_stadium', 'metlife_stadium', 'att_stadium'].includes(stadium.id)
  ) {
    queries.add(stadium.name);
  }

  return Array.from(queries);
}

export interface BlueskyPollResult {
  fetched: number;
  unique: number;
  tagged: number;
  windowSize: number;
  queries: number;
  errors: string[];
}

export async function runBlueskyPoll(now: Date = new Date()): Promise<BlueskyPollResult> {
  const window = matchesInBuzzWindow(now);
  const errors: string[] = [];

  if (window.length === 0) {
    // No matches close enough in time — skip entirely. Saves API calls
    // during the long gaps in the schedule.
    return { fetched: 0, unique: 0, tagged: 0, windowSize: 0, queries: 0, errors };
  }

  const queries = new Set<string>();
  for (const m of window) {
    for (const q of queriesForMatch(m)) queries.add(q);
  }

  // Sequential rather than parallel — Bluesky's public endpoint is
  // tolerant but a thundering herd of 50+ concurrent requests is rude.
  let totalFetched = 0;
  const allPosts: Tweet[] = [];
  for (const q of queries) {
    try {
      const posts = await searchBlueskyPosts(q, {
        limit: PER_QUERY_LIMIT,
        sort: 'latest',
      });
      totalFetched += posts.length;
      allPosts.push(...posts);
    } catch (e) {
      errors.push(`${q}: ${(e as Error).message}`);
    }
  }

  // Dedupe by post id (Bluesky URI).
  const byId = new Map<string, Tweet>();
  for (const p of allPosts) byId.set(p.id, p);
  const unique = Array.from(byId.values());

  if (unique.length === 0) {
    return {
      fetched: totalFetched,
      unique: 0,
      tagged: 0,
      windowSize: window.length,
      queries: queries.size,
      errors,
    };
  }

  // Score every post against every match in the buzz window. The tagger
  // returns matchNumbers when confidence ≥ threshold (0.4).
  const existingTags = await getTweetTags();
  const newTags: Record<string, TweetTag> = {};
  let tagged = 0;
  for (const p of unique) {
    // Preserve manual tags — don't overwrite human curation.
    if (existingTags[p.id]?.manual) continue;
    const result = tagTweet(p, ITINERARY, STADIUMS);
    if (result.matchNumbers.length > 0) {
      newTags[p.id] = {
        matchNumbers: result.matchNumbers,
        confidence: result.confidence,
        manual: false,
        taggedAt: new Date().toISOString(),
      };
      tagged += 1;
    }
  }

  await upsertTweets(unique);
  await bulkSetTweetTags(newTags);

  return {
    fetched: totalFetched,
    unique: unique.length,
    tagged,
    windowSize: window.length,
    queries: queries.size,
    errors,
  };
}
