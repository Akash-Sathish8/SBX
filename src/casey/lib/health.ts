// ESPN endpoint health monitoring. Pings each public ESPN URL we depend
// on, captures latency / status / payload sanity, and persists the last
// result in KV so admins can see when a feed last responded healthily.

export type EndpointId = 'scoreboard_today' | 'scoreboard_opener' | 'standings' | 'bracket_range';

export interface EndpointSpec {
  id: EndpointId;
  label: string;
  description: string;
  buildUrl: () => string;
  sanityCheck: (json: any) => { ok: boolean; detail: string };
}

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world';
const ESPN_STANDINGS = 'https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings';

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

export const ENDPOINTS: EndpointSpec[] = [
  {
    id: 'scoreboard_today',
    label: 'SCOREBOARD · TODAY',
    description: 'Live scores for the current calendar day. Powers Live Today tab + per-card scores.',
    buildUrl: () => `${ESPN_BASE}/scoreboard?dates=${todayYmd()}`,
    sanityCheck: (json) => {
      if (!json || typeof json !== 'object') return { ok: false, detail: 'not JSON' };
      if (!Array.isArray(json.events)) return { ok: false, detail: 'missing events[]' };
      return { ok: true, detail: `${json.events.length} event(s)` };
    },
  },
  {
    id: 'scoreboard_opener',
    label: 'SCOREBOARD · OPENING DAY',
    description: 'Same endpoint pinned to Jun 11 2026 (opener). Validates feed for upcoming tournament dates.',
    buildUrl: () => `${ESPN_BASE}/scoreboard?dates=20260611`,
    sanityCheck: (json) => {
      if (!json || typeof json !== 'object') return { ok: false, detail: 'not JSON' };
      if (!Array.isArray(json.events)) return { ok: false, detail: 'missing events[]' };
      return { ok: true, detail: `${json.events.length} event(s)` };
    },
  },
  {
    id: 'standings',
    label: 'STANDINGS',
    description: 'Group standings table. Powers Groups tab + the group modal.',
    buildUrl: () => ESPN_STANDINGS,
    sanityCheck: (json) => {
      if (!json || typeof json !== 'object') return { ok: false, detail: 'not JSON' };
      if (!Array.isArray(json.children)) return { ok: false, detail: 'missing children[]' };
      return { ok: true, detail: `${json.children.length} group(s)` };
    },
  },
  {
    id: 'bracket_range',
    label: 'BRACKET · KNOCKOUT RANGE',
    description: 'Pings Jun 28 (R32 start) on the scoreboard. Surfaces feed health for the knockout window.',
    buildUrl: () => `${ESPN_BASE}/scoreboard?dates=20260628`,
    sanityCheck: (json) => {
      if (!json || typeof json !== 'object') return { ok: false, detail: 'not JSON' };
      if (!Array.isArray(json.events)) return { ok: false, detail: 'missing events[]' };
      return { ok: true, detail: `${json.events.length} event(s)` };
    },
  },
];

export interface PingResult {
  id: EndpointId;
  label: string;
  url: string;
  ok: boolean;
  status: number | null;
  durationMs: number;
  bytes: number;
  sanity: string;
  error: string | null;
  checkedAt: string;
}

export async function pingEndpoint(spec: EndpointSpec, timeoutMs = 8000): Promise<PingResult> {
  const url = spec.buildUrl();
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    const text = await res.text();
    const durationMs = Date.now() - startedAt;
    if (!res.ok) {
      return {
        id: spec.id,
        label: spec.label,
        url,
        ok: false,
        status: res.status,
        durationMs,
        bytes: text.length,
        sanity: 'http error',
        error: `${res.status} ${res.statusText || ''}`.trim(),
        checkedAt: new Date().toISOString(),
      };
    }
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return {
        id: spec.id,
        label: spec.label,
        url,
        ok: false,
        status: res.status,
        durationMs,
        bytes: text.length,
        sanity: 'invalid json',
        error: (e as Error).message,
        checkedAt: new Date().toISOString(),
      };
    }
    const sane = spec.sanityCheck(parsed);
    return {
      id: spec.id,
      label: spec.label,
      url,
      ok: sane.ok,
      status: res.status,
      durationMs,
      bytes: text.length,
      sanity: sane.detail,
      error: sane.ok ? null : `payload sanity failed: ${sane.detail}`,
      checkedAt: new Date().toISOString(),
    };
  } catch (e) {
    return {
      id: spec.id,
      label: spec.label,
      url,
      ok: false,
      status: null,
      durationMs: Date.now() - startedAt,
      bytes: 0,
      sanity: 'unreachable',
      error: (e as Error).message || 'network error',
      checkedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function pingAll(): Promise<PingResult[]> {
  return Promise.all(ENDPOINTS.map((e) => pingEndpoint(e)));
}

// Persistent record (last seen success/failure per endpoint) — surfaces
// "last healthy 12 min ago" indicators even when a fresh ping fails.
export interface HealthRecord {
  byId: Partial<Record<EndpointId, {
    lastSuccess: PingResult | null;
    lastFailure: PingResult | null;
    lastChecked: PingResult | null;
  }>>;
  updatedAt: string;
}

export function mergeHealthRecord(prev: HealthRecord | null, latest: PingResult[]): HealthRecord {
  const byId = { ...(prev?.byId ?? {}) };
  for (const result of latest) {
    const existing = byId[result.id] ?? { lastSuccess: null, lastFailure: null, lastChecked: null };
    byId[result.id] = {
      lastSuccess: result.ok ? result : existing.lastSuccess,
      lastFailure: result.ok ? existing.lastFailure : result,
      lastChecked: result,
    };
  }
  return { byId, updatedAt: new Date().toISOString() };
}
