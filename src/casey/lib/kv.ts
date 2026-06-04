import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_SPEND } from './itinerary';
import type {
  MatchResult,
  PositionOverride,
  SpendTracker,
  MatchFieldOverride,
  StadiumOverride,
} from './types';
import type { HealthRecord } from './health';
import type { Tweet } from './x';

const KV_TABLE = 'kv';

let cachedClient: SupabaseClient | null = null;
let warned = false;
const memoryStore = new Map<string, unknown>();

function getClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    if (!warned) {
      console.warn(
        '[kv] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY missing — using in-memory store. Persistence disabled.',
      );
      warned = true;
    }
    return null;
  }
  if (!cachedClient) {
    cachedClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cachedClient;
}

async function kvGet<T>(key: string): Promise<T | null> {
  const client = getClient();
  if (!client) {
    return (memoryStore.get(key) as T) ?? null;
  }
  const { data, error } = await client
    .from(KV_TABLE)
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) {
    console.error('[kv] get failed', key, error.message);
    return null;
  }
  return (data?.value as T) ?? null;
}

async function kvSet<T>(key: string, value: T): Promise<void> {
  const client = getClient();
  if (!client) {
    memoryStore.set(key, value);
    return;
  }
  const { error } = await client.from(KV_TABLE).upsert({ key, value });
  if (error) {
    console.error('[kv] set failed', key, error.message);
    throw new Error(error.message);
  }
}

async function kvDel(key: string): Promise<void> {
  const client = getClient();
  if (!client) {
    memoryStore.delete(key);
    return;
  }
  const { error } = await client.from(KV_TABLE).delete().eq('key', key);
  if (error) {
    console.error('[kv] del failed', key, error.message);
    throw new Error(error.message);
  }
}

async function kvGetByPrefix<T>(prefix: string): Promise<Record<string, T>> {
  const client = getClient();
  if (!client) {
    const out: Record<string, T> = {};
    for (const [k, v] of memoryStore.entries()) {
      if (k.startsWith(prefix)) out[k] = v as T;
    }
    return out;
  }
  const { data, error } = await client
    .from(KV_TABLE)
    .select('key, value')
    .like('key', `${prefix}%`);
  if (error) {
    console.error('[kv] prefix get failed', prefix, error.message);
    return {};
  }
  const out: Record<string, T> = {};
  for (const row of data ?? []) {
    out[row.key as string] = row.value as T;
  }
  return out;
}

const keyResult = (n: number) => `result:${n}`;
const KEY_RESULTS_ALL = 'results:all';
const KEY_POSITION_OVERRIDE = 'position:override';
const KEY_SPEND = 'spend:tracker';
const KEY_VISIBILITY = 'visibility:flags';
const KEY_HEALTH = 'health:espn';
const PREFIX_MATCH_OVERRIDE = 'match:override:';
const keyMatchOverride = (n: number) => `${PREFIX_MATCH_OVERRIDE}${n}`;
const PREFIX_YOUTUBE = 'youtube:';
const keyYoutube = (n: number) => `${PREFIX_YOUTUBE}${n}`;
const PREFIX_STADIUM_OVERRIDE = 'stadium:override:';
const keyStadiumOverride = (id: string) => `${PREFIX_STADIUM_OVERRIDE}${id}`;

export async function getMatchResult(n: number): Promise<MatchResult | null> {
  return kvGet<MatchResult>(keyResult(n));
}

export async function setMatchResult(n: number, result: MatchResult): Promise<void> {
  const stamped: MatchResult = { ...result, updatedAt: new Date().toISOString() };
  await kvSet(keyResult(n), stamped);
  const all = (await kvGet<Record<number, MatchResult>>(KEY_RESULTS_ALL)) ?? {};
  all[n] = stamped;
  await kvSet(KEY_RESULTS_ALL, all);
}

export async function getAllResults(): Promise<Record<number, MatchResult>> {
  const all = await kvGet<Record<number, MatchResult>>(KEY_RESULTS_ALL);
  return all ?? {};
}

export async function getPositionOverride(): Promise<PositionOverride | null> {
  return kvGet<PositionOverride>(KEY_POSITION_OVERRIDE);
}

export async function setPositionOverride(o: PositionOverride): Promise<void> {
  await kvSet(KEY_POSITION_OVERRIDE, o);
}

export async function clearPositionOverride(): Promise<void> {
  await kvDel(KEY_POSITION_OVERRIDE);
}

export async function getSpend(): Promise<SpendTracker> {
  const s = await kvGet<SpendTracker>(KEY_SPEND);
  return s ?? { ...DEFAULT_SPEND };
}

export async function setSpend(s: SpendTracker): Promise<void> {
  const stamped: SpendTracker = { ...s, updatedAt: new Date().toISOString() };
  await kvSet(KEY_SPEND, stamped);
}

export async function getMatchOverride(n: number): Promise<MatchFieldOverride | null> {
  return kvGet<MatchFieldOverride>(keyMatchOverride(n));
}

export async function setMatchOverride(n: number, o: MatchFieldOverride): Promise<void> {
  await kvSet(keyMatchOverride(n), o);
}

export async function getAllMatchOverrides(): Promise<Record<number, MatchFieldOverride>> {
  const rows = await kvGetByPrefix<MatchFieldOverride>(PREFIX_MATCH_OVERRIDE);
  const out: Record<number, MatchFieldOverride> = {};
  for (const [k, v] of Object.entries(rows)) {
    const n = Number(k.slice(PREFIX_MATCH_OVERRIDE.length));
    if (!Number.isNaN(n)) out[n] = v;
  }
  return out;
}

export async function getYouTubeId(n: number): Promise<string | null> {
  return kvGet<string>(keyYoutube(n));
}

export async function setYouTubeId(n: number, id: string): Promise<void> {
  await kvSet(keyYoutube(n), id);
}

export async function getAllYouTubeIds(): Promise<Record<number, string>> {
  const rows = await kvGetByPrefix<string>(PREFIX_YOUTUBE);
  const out: Record<number, string> = {};
  for (const [k, v] of Object.entries(rows)) {
    const n = Number(k.slice(PREFIX_YOUTUBE.length));
    if (!Number.isNaN(n)) out[n] = v;
  }
  return out;
}

export async function setStadiumOverride(
  id: string,
  override: StadiumOverride,
): Promise<void> {
  await kvSet(keyStadiumOverride(id), override);
}

export async function getAllStadiumOverrides(): Promise<Record<string, StadiumOverride>> {
  const rows = await kvGetByPrefix<StadiumOverride>(PREFIX_STADIUM_OVERRIDE);
  const out: Record<string, StadiumOverride> = {};
  for (const [k, v] of Object.entries(rows)) {
    out[k.slice(PREFIX_STADIUM_OVERRIDE.length)] = v;
  }
  return out;
}

export interface VisibilityFlags {
  showLodging: boolean;
  showTransport: boolean;
}

export const DEFAULT_VISIBILITY: VisibilityFlags = {
  showLodging: false,
  showTransport: false,
};

export async function getVisibilityFlags(): Promise<VisibilityFlags> {
  const v = await kvGet<VisibilityFlags>(KEY_VISIBILITY);
  return v ?? { ...DEFAULT_VISIBILITY };
}

export async function setVisibilityFlags(v: VisibilityFlags): Promise<void> {
  await kvSet(KEY_VISIBILITY, v);
}

export async function getHealthRecord(): Promise<HealthRecord | null> {
  return kvGet<HealthRecord>(KEY_HEALTH);
}

export async function setHealthRecord(rec: HealthRecord): Promise<void> {
  await kvSet(KEY_HEALTH, rec);
}

// ──────────────────────────────────────────────────────────────────
// X / Twitter feed storage
// ──────────────────────────────────────────────────────────────────

const KEY_TWEETS = 'x:tweets';                   // Record<tweetId, Tweet>
const KEY_TWEETS_NEWEST_ID = 'x:tweets:newest';  // string — for since_id polling
const KEY_TWEET_TAGS = 'x:tweet-tags';           // Record<tweetId, TweetTag>

export interface TweetTag {
  matchNumbers: number[];
  confidence: number;
  manual?: boolean;
  taggedAt?: string;
}

export async function getStoredTweets(): Promise<Record<string, Tweet>> {
  return (await kvGet<Record<string, Tweet>>(KEY_TWEETS)) ?? {};
}

export async function upsertTweets(tweets: Tweet[]): Promise<void> {
  if (tweets.length === 0) return;
  const existing = await getStoredTweets();
  for (const t of tweets) existing[t.id] = t;
  await kvSet(KEY_TWEETS, existing);
}

export async function getNewestTweetId(): Promise<string | null> {
  return kvGet<string>(KEY_TWEETS_NEWEST_ID);
}

export async function setNewestTweetId(id: string): Promise<void> {
  await kvSet(KEY_TWEETS_NEWEST_ID, id);
}

export async function getTweetTags(): Promise<Record<string, TweetTag>> {
  return (await kvGet<Record<string, TweetTag>>(KEY_TWEET_TAGS)) ?? {};
}

export async function setTweetTag(tweetId: string, tag: TweetTag): Promise<void> {
  const tags = await getTweetTags();
  tags[tweetId] = tag;
  await kvSet(KEY_TWEET_TAGS, tags);
}

export async function bulkSetTweetTags(updates: Record<string, TweetTag>): Promise<void> {
  if (Object.keys(updates).length === 0) return;
  const tags = await getTweetTags();
  for (const [id, tag] of Object.entries(updates)) tags[id] = tag;
  await kvSet(KEY_TWEET_TAGS, tags);
}

export async function clearTweetTag(tweetId: string): Promise<void> {
  const tags = await getTweetTags();
  delete tags[tweetId];
  await kvSet(KEY_TWEET_TAGS, tags);
}

// Per-match on-demand buzz cache. Keyed by match number; holds the last
// fetched Bluesky posts + a timestamp so the public route can serve from
// cache for a short TTL instead of hitting Bluesky on every page view.
const keyBuzzCache = (n: number) => `buzz:cache:${n}`;

export interface BuzzCache {
  tweets: Tweet[];
  fetchedAt: string;
}

export async function getBuzzCache(matchNumber: number): Promise<BuzzCache | null> {
  return kvGet<BuzzCache>(keyBuzzCache(matchNumber));
}

export async function setBuzzCache(matchNumber: number, cache: BuzzCache): Promise<void> {
  await kvSet(keyBuzzCache(matchNumber), cache);
}
