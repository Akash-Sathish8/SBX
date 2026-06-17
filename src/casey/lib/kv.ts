import { DEFAULT_SPEND } from './itinerary';
import type {
  MatchResult,
  PositionOverride,
  SpendTracker,
  MatchFieldOverride,
  StadiumOverride,
} from './types';
import type { HealthRecord } from './health';
import type { KVNamespace } from '@cloudflare/workers-types';

let _kv: KVNamespace | null | undefined; // undefined = not yet resolved
let warned = false;
const memoryStore = new Map<string, unknown>();

// Resolve the `KV` binding from the Cloudflare runtime. Done via a guarded
// dynamic import so this module also loads cleanly in plain Node (vitest, any
// non-Workers context), where it falls back to the in-memory store. The binding
// reference is stable across requests, so we resolve it once.
async function getKV(): Promise<KVNamespace | null> {
  if (_kv !== undefined) return _kv;
  try {
    const mod = await import('cloudflare:workers');
    _kv = mod.env?.KV ?? null;
  } catch {
    _kv = null;
  }
  if (!_kv && !warned) {
    console.warn('[kv] Cloudflare KV binding "KV" not found — using in-memory store. Persistence disabled.');
    warned = true;
  }
  return _kv;
}

async function kvGet<T>(key: string): Promise<T | null> {
  const kv = await getKV();
  if (!kv) return (memoryStore.get(key) as T) ?? null;
  try {
    return ((await kv.get(key, 'json')) as T) ?? null;
  } catch (err) {
    console.error('[kv] get failed', key, (err as Error).message);
    return null;
  }
}

async function kvSet<T>(key: string, value: T): Promise<void> {
  const kv = await getKV();
  if (!kv) {
    memoryStore.set(key, value);
    return;
  }
  await kv.put(key, JSON.stringify(value));
}

async function kvDel(key: string): Promise<void> {
  const kv = await getKV();
  if (!kv) {
    memoryStore.delete(key);
    return;
  }
  await kv.delete(key);
}

async function kvGetByPrefix<T>(prefix: string): Promise<Record<string, T>> {
  const kv = await getKV();
  if (!kv) {
    const out: Record<string, T> = {};
    for (const [k, v] of memoryStore.entries()) {
      if (k.startsWith(prefix)) out[k] = v as T;
    }
    return out;
  }
  // List the (small) key set under this prefix, then fetch values in parallel.
  const names: string[] = [];
  let cursor: string | undefined;
  do {
    const res = await kv.list({ prefix, cursor });
    for (const k of res.keys) names.push(k.name);
    cursor = res.list_complete ? undefined : res.cursor;
  } while (cursor);
  const out: Record<string, T> = {};
  await Promise.all(
    names.map(async (name) => {
      const v = (await kv.get(name, 'json')) as T | null;
      if (v != null) out[name] = v;
    }),
  );
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
// Underdog Fantasy referral link (global)
// ──────────────────────────────────────────────────────────────────

const KEY_UNDERDOG_REFERRAL = 'underdog:referral';

export async function getUnderdogReferral(): Promise<string> {
  return (await kvGet<string>(KEY_UNDERDOG_REFERRAL)) ?? '';
}

export async function setUnderdogReferral(url: string): Promise<void> {
  await kvSet(KEY_UNDERDOG_REFERRAL, url);
}

// ──────────────────────────────────────────────────────────────────
// Data version — a single token bumped on every admin write. Public read
// paths key their edge-cached snapshot on it (see snapshot.ts), so they can
// skip the KV fan-out until something actually changes.
// ──────────────────────────────────────────────────────────────────

const KEY_DATA_VERSION = 'data:version';

export async function getDataVersion(): Promise<string> {
  return (await kvGet<string>(KEY_DATA_VERSION)) ?? '0';
}

export async function bumpDataVersion(): Promise<void> {
  // Any new UNIQUE value invalidates the cached snapshot. Date.now() alone can
  // repeat if two writes land in the same millisecond, so append a random token
  // to guarantee uniqueness (the value is opaque — only its change matters).
  await kvSet(KEY_DATA_VERSION, `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`);
}
