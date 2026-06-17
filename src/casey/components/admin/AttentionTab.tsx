import { useQuery } from '@tanstack/react-query';
import { liveJson } from '@/lib/queries';
import { btnCls, btnDimCls } from './ui';

interface AttentionItem {
  id: string;
  severity: 'high' | 'medium' | 'low';
  category: string;
  title: string;
  detail: string;
  matchNumber?: number;
  action?: string;
}

export function AttentionTab({ onJumpToMatch }: { onJumpToMatch: (n: number) => void }) {
  const q = useQuery({
    queryKey: ['casey', 'attention'],
    queryFn: () =>
      liveJson<{ ok?: boolean; items?: AttentionItem[]; generatedAt?: string }>('/api/admin/attention'),
    staleTime: 0,
  });
  const items = q.data?.ok ? q.data.items ?? [] : null;
  const generatedAt = q.data?.ok ? q.data.generatedAt ?? null : null;
  const loading = q.isFetching;
  const errored = q.isError;

  const high = items?.filter((i) => i.severity === 'high') ?? [];
  const med = items?.filter((i) => i.severity === 'medium') ?? [];
  const low = items?.filter((i) => i.severity === 'low') ?? [];

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between border border-snap-ash bg-snap-coal p-4">
        <div>
          <div className="font-display text-[22px] text-snap-chalk">NEEDS YOUR ATTENTION</div>
          <div className="font-mono text-[10px] tracking-[0.18em] text-snap-mist mt-1">
            {loading
              ? 'scanning…'
              : errored
              ? 'scan failed · tap REFRESH to retry'
              : items === null
              ? 'tap REFRESH to scan'
              : items.length === 0
              ? '✓ all clear · nothing to do right now'
              : `${high.length} HIGH · ${med.length} MEDIUM · ${low.length} LOW`}
          </div>
          {generatedAt && (
            <div className="font-mono text-[9px] text-snap-fog mt-1 tracking-[0.15em]">
              last scan {new Date(generatedAt).toLocaleString()}
            </div>
          )}
        </div>
        <button type="button" onClick={() => void q.refetch()} disabled={loading} className={btnCls + ' disabled:opacity-50'}>
          {loading ? 'SCANNING…' : '↻ REFRESH'}
        </button>
      </div>

      {items !== null && items.length === 0 && (
        <div className="border border-snap-yellow/40 bg-snap-yellow/5 p-6 text-center">
          <div className="font-display text-[28px] text-snap-yellow">ALL CLEAR</div>
          <div className="font-body text-[13px] text-snap-mist mt-1">
            no missing results, no orphan vlogs, no stale states. trip is in good shape.
          </div>
        </div>
      )}

      {[high, med, low].map((bucket, i) => {
        if (bucket.length === 0) return null;
        const sevLabel = ['HIGH', 'MEDIUM', 'LOW'][i];
        const sevColor =
          i === 0 ? 'border-live text-live' : i === 1 ? 'border-snap-yellow text-snap-yellow' : 'border-snap-fog text-snap-fog';
        return (
          <div key={i}>
            <div className={`font-mono text-[10px] tracking-[0.22em] px-2 py-1 border ${sevColor} inline-block mb-2`}>
              {sevLabel} · {bucket.length}
            </div>
            <div className="space-y-2">
              {bucket.map((item) => (
                <AttentionCard key={item.id} item={item} onJumpToMatch={onJumpToMatch} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AttentionCard({
  item,
  onJumpToMatch,
}: {
  item: AttentionItem;
  onJumpToMatch: (n: number) => void;
}) {
  const sevBorder =
    item.severity === 'high'
      ? 'border-live border-l-4'
      : item.severity === 'medium'
      ? 'border-snap-yellow border-l-4'
      : 'border-snap-ash border-l-2';
  return (
    <div className={`bg-snap-coal p-3 border ${sevBorder}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[11px] tracking-[0.18em] text-snap-chalk">{item.title}</div>
          <div className="font-body text-[12px] text-snap-mist mt-1 leading-relaxed">{item.detail}</div>
          {item.action && (
            <div className="font-mono text-[10px] text-snap-fog mt-2 tracking-[0.12em]">
              → {item.action.toUpperCase()}
            </div>
          )}
        </div>
        {item.matchNumber && (
          <button
            type="button"
            onClick={() => onJumpToMatch(item.matchNumber!)}
            className={btnDimCls + ' flex-shrink-0'}
          >
            OPEN #{item.matchNumber}
          </button>
        )}
      </div>
    </div>
  );
}

