import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { liveJson } from '@/lib/queries';
import { btnCls } from './ui';

interface PingResult {
  id: string;
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

interface HealthRecord {
  byId: Record<string, {
    lastSuccess: PingResult | null;
    lastFailure: PingResult | null;
    lastChecked: PingResult | null;
  }>;
  updatedAt: string;
}

interface EndpointMeta {
  id: string;
  label: string;
  description: string;
}

export function HealthTab() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['casey', 'espn-health'],
    queryFn: () =>
      liveJson<{ ok?: boolean; record?: HealthRecord | null; endpoints?: EndpointMeta[] }>(
        '/api/admin/espn-health',
      ),
    staleTime: 0,
  });
  const record = q.data?.ok ? q.data.record ?? null : null;
  const endpoints = q.data?.ok ? q.data.endpoints ?? [] : [];
  const [pinging, setPinging] = useState(false);

  const pingNow = async () => {
    setPinging(true);
    try {
      const res = await fetch('/api/admin/espn-health', { method: 'POST' });
      const data = await res.json();
      // POST returns the freshly-pinged record — write it straight into the cache.
      if (data.ok) qc.setQueryData(['casey', 'espn-health'], data);
    } finally {
      setPinging(false);
    }
  };

  const overall = computeOverallHealth(record, endpoints);

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between border border-snap-ash bg-snap-coal p-4">
        <div>
          <div className="font-display text-[22px] text-snap-chalk">ESPN FEED HEALTH</div>
          <div className="font-mono text-[10px] tracking-[0.18em] text-snap-mist mt-1">
            monitors the upstream endpoints that power live scores, standings, and bracket.
          </div>
          <div
            className={`mt-2 inline-block px-2 py-1 font-mono text-[10px] tracking-[0.22em] border ${
              overall.color
            }`}
          >
            {overall.label}
          </div>
        </div>
        <button type="button" onClick={pingNow} disabled={pinging} className={btnCls + ' disabled:opacity-50'}>
          {pinging ? 'PINGING…' : '◷ TEST ALL'}
        </button>
      </div>

      <div className="space-y-3">
        {endpoints.map((ep) => {
          const r = record?.byId?.[ep.id];
          return <HealthCard key={ep.id} endpoint={ep} record={r} />;
        })}
        {endpoints.length === 0 && (
          <div className="font-mono text-[11px] text-snap-mist py-4 text-center">
            {q.isLoading
              ? 'loading endpoint list…'
              : q.isError
              ? 'couldn’t load health — tap TEST ALL to retry'
              : 'no endpoints configured'}
          </div>
        )}
      </div>

      <div className="font-mono text-[9px] text-snap-fog leading-relaxed pt-2">
        all endpoints are public ESPN URLs (no API key, no auth, anonymous fetch). this monitor
        verifies reachability + payload sanity. if a feed goes red during the tournament, the
        public tabs that depend on it will show an empty state — public visitors will see
        &quot;loading the table…&quot; or &quot;can&apos;t pull scores rn&quot; rather than stale data.
      </div>
    </div>
  );
}

function computeOverallHealth(
  record: HealthRecord | null,
  endpoints: EndpointMeta[],
): { label: string; color: string } {
  if (!record || endpoints.length === 0) {
    return { label: '◷ NOT YET TESTED', color: 'border-snap-fog text-snap-fog' };
  }
  const states = endpoints.map((e) => record.byId?.[e.id]?.lastChecked?.ok ?? null);
  const tested = states.filter((s) => s !== null);
  if (tested.length === 0) return { label: '◷ NOT YET TESTED', color: 'border-snap-fog text-snap-fog' };
  if (tested.every((s) => s === true)) return { label: '● ALL HEALTHY', color: 'border-snap-yellow text-snap-yellow' };
  if (tested.every((s) => s === false)) return { label: '● ALL FAILING', color: 'border-live text-live' };
  return { label: '◐ PARTIAL · MIXED', color: 'border-snap-yellow text-snap-yellow' };
}

function HealthCard({
  endpoint,
  record,
}: {
  endpoint: EndpointMeta;
  record?: { lastSuccess: PingResult | null; lastFailure: PingResult | null; lastChecked: PingResult | null };
}) {
  const last = record?.lastChecked;
  const lastSuccess = record?.lastSuccess;
  const lastFailure = record?.lastFailure;
  const status = !last
    ? { dot: '○', label: 'UNTESTED', color: 'text-snap-fog border-snap-fog' }
    : last.ok
    ? { dot: '●', label: 'HEALTHY', color: 'text-snap-yellow border-snap-yellow' }
    : { dot: '●', label: 'FAILING', color: 'text-live border-live' };

  return (
    <div className={`border bg-snap-coal p-3 ${status.color.replace(/text-\S+/, '').trim()}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[11px] tracking-[0.18em] text-snap-chalk">
            {endpoint.label}
          </div>
          <div className="font-body text-[11px] text-snap-mist mt-1 leading-relaxed">
            {endpoint.description}
          </div>
        </div>
        <span className={`flex-shrink-0 px-2 py-0.5 font-mono text-[10px] tracking-[0.18em] border ${status.color}`}>
          {status.dot} {status.label}
        </span>
      </div>

      {last && (
        <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[10px] text-snap-mist">
          <div>
            <div className="text-snap-fog tracking-[0.18em] text-[9px]">LATENCY</div>
            <div className="text-snap-chalk">{last.durationMs} ms</div>
          </div>
          <div>
            <div className="text-snap-fog tracking-[0.18em] text-[9px]">HTTP</div>
            <div className="text-snap-chalk">{last.status ?? '—'}</div>
          </div>
          <div>
            <div className="text-snap-fog tracking-[0.18em] text-[9px]">PAYLOAD</div>
            <div className="text-snap-chalk truncate">{last.sanity}</div>
          </div>
          <div>
            <div className="text-snap-fog tracking-[0.18em] text-[9px]">SIZE</div>
            <div className="text-snap-chalk">{(last.bytes / 1024).toFixed(1)} KB</div>
          </div>
        </div>
      )}

      {last && !last.ok && last.error && (
        <div className="mt-2 px-2 py-1 bg-live/10 border-l-2 border-live font-mono text-[10px] text-live">
          {last.error}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 text-[9px] font-mono tracking-[0.12em]">
        <div className="text-snap-fog">
          last healthy: <span className="text-snap-mist">{lastSuccess ? formatAgo(lastSuccess.checkedAt) : 'never'}</span>
        </div>
        <div className="text-snap-fog text-right">
          last failure: <span className="text-snap-mist">{lastFailure ? formatAgo(lastFailure.checkedAt) : 'none'}</span>
        </div>
      </div>
    </div>
  );
}

function formatAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} min ago`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)} h ago`;
  return `${Math.round(ms / 86_400_000)} d ago`;
}

