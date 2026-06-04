
import { useEffect, useState } from 'react';
import { useFollows } from '@/lib/follows';
import type { CaseyLocation } from '@/lib/types';

function indicatorFor(state: CaseyLocation['state']): { color: string; label: string; pulse: boolean } {
  switch (state) {
    case 'at-stadium': return { color: 'bg-live', label: 'LIVE · AT MATCH', pulse: true };
    case 'in-transit': return { color: 'bg-snap-yellow', label: 'IN TRANSIT', pulse: true };
    case 'at-hotel': return { color: 'bg-snap-yellow', label: 'RESTING', pulse: false };
    case 'pre-trip': return { color: 'bg-snap-fog', label: 'PRE-TRIP', pulse: false };
    case 'post-trip': return { color: 'bg-snap-fog', label: 'TRIP COMPLETE', pulse: false };
  }
}

interface Props {
  location: CaseyLocation;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenToday: () => void;
  onOpenFollowing: () => void;
  onOpenSchedule: () => void;
  lastUpdateAt: number;
  connectionLost: boolean;
}

export default function ControlCluster({
  location, collapsed, onToggleCollapse, onOpenToday, onOpenFollowing,
  onOpenSchedule, lastUpdateAt, connectionLost,
}: Props) {
  const indicator = indicatorFor(location.state);
  const { count: followingCount } = useFollows();
  const [todayCount, setTodayCount] = useState<number | null>(null);
  const [staleAge, setStaleAge] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setStaleAge(Date.now() - lastUpdateAt), 1000);
    return () => clearInterval(id);
  }, [lastUpdateAt]);
  const isStale = staleAge > 5 * 60_000;
  const staleMinutes = Math.floor(staleAge / 60_000);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/today', { cache: 'no-store' });
        const data = await res.json();
        if (!cancelled && data?.ok) setTodayCount((data.items ?? []).length);
      } catch { /* ignore */ }
    };
    void load();
    const id = setInterval(load, 2 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const btn = 'pointer-events-auto flex items-center gap-1.5 border px-2.5 py-1.5 font-mono text-[10px] tracking-[0.18em] transition-colors bg-snap-black/70';
  const dim = 'border-snap-ash text-snap-mist hover:text-snap-yellow hover:border-snap-yellow';
  const on = 'border-snap-yellow bg-snap-yellow/10 text-snap-yellow';

  return (
    <div className="pointer-events-none absolute right-3 top-3 z-30 flex flex-col items-end gap-2 sm:right-5 sm:top-4">
      <button type="button" onClick={onToggleCollapse} className={`${btn} ${collapsed ? on : dim}`} aria-pressed={collapsed} title={collapsed ? 'Show panel' : 'Hide panel'}>
        <span aria-hidden="true">{collapsed ? '▸' : '▾'}</span>{collapsed ? 'SHOW' : 'HIDE'}
      </button>
      <button type="button" onClick={onOpenToday} className={`${btn} ${todayCount && todayCount > 0 ? on : dim}`} title="Today's vlogs + live results">
        <span aria-hidden="true" className={`inline-block h-1.5 w-1.5 rounded-full ${todayCount && todayCount > 0 ? 'bg-snap-yellow animate-pulse-live' : 'bg-snap-fog'}`} />
        TODAY{todayCount && todayCount > 0 ? ` · ${todayCount}` : ''}
      </button>
      <button type="button" onClick={onOpenFollowing} className={`${btn} ${followingCount > 0 ? on : dim}`} title="Manage followed teams">
        <span aria-hidden="true">{followingCount > 0 ? '★' : '☆'}</span>{followingCount > 0 ? followingCount : 'TEAMS'}
      </button>
      <button type="button" onClick={onOpenSchedule} className={`${btn} ${dim}`}>
        <svg viewBox="0 0 12 12" className="h-3 w-3 fill-current" aria-hidden="true">
          <rect x="1" y="2" width="10" height="9" stroke="currentColor" strokeWidth="1" fill="none" />
          <line x1="1" y1="5" x2="11" y2="5" stroke="currentColor" strokeWidth="1" />
          <line x1="4" y1="1" x2="4" y2="3" stroke="currentColor" strokeWidth="1" />
          <line x1="8" y1="1" x2="8" y2="3" stroke="currentColor" strokeWidth="1" />
        </svg>
        HUB
      </button>
      <div className="pointer-events-auto flex items-center gap-2 border border-snap-ash bg-snap-black/70 px-2.5 py-1.5">
        <span className={`block h-2 w-2 rounded-full ${connectionLost ? 'bg-live' : indicator.color} ${indicator.pulse && !connectionLost ? 'animate-pulse-live' : ''}`} aria-hidden="true" />
        <span className="font-mono text-[10px] tracking-[0.18em] text-snap-chalk">
          {connectionLost ? 'OFFLINE' : isStale ? `STALE · ${staleMinutes}M` : indicator.label}
        </span>
      </div>
    </div>
  );
}
