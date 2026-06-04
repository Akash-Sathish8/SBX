
import { useEffect, useRef, useState } from 'react';
import { formatCountdown } from '@/lib/stats';
import Ticker from './Ticker';
import HeroPanel from './HeroPanel';
import CountUp from './CountUp';
import { useFollows } from '@/lib/follows';
import type { CaseyLocation, ItineraryMatch, TripStats } from '@/lib/types';

interface Props {
  location: CaseyLocation;
  stats: TripStats;
  itinerary: ItineraryMatch[];
  onOpenSchedule: () => void;
  onOpenMatch: (matchNumber: number) => void;
  onOpenFollowing: () => void;
  onOpenToday: () => void;
  lastUpdateAt: number;
  connectionLost: boolean;
}

function indicatorFor(state: CaseyLocation['state']): { color: string; label: string; pulse: boolean } {
  switch (state) {
    case 'at-stadium':
      return { color: 'bg-live', label: 'LIVE · AT MATCH', pulse: true };
    case 'in-transit':
      return { color: 'bg-snap-yellow', label: 'IN TRANSIT', pulse: true };
    case 'at-hotel':
      return { color: 'bg-snap-yellow', label: 'RESTING', pulse: false };
    case 'pre-trip':
      return { color: 'bg-snap-fog', label: 'PRE-TRIP', pulse: false };
    case 'post-trip':
      return { color: 'bg-snap-fog', label: 'TRIP COMPLETE', pulse: false };
  }
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="mt-1 h-[2px] w-full bg-snap-ash">
      <div
        className="h-full bg-snap-yellow"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

function PipStrip({ total, completed }: { total: number; completed: number }) {
  return (
    <div className="mt-1 flex w-full gap-[1px]" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => {
        const isCompleted = i < completed;
        const isCurrent = i === completed && completed < total;
        return (
          <div
            key={i}
            className={`h-[3px] flex-1 ${
              isCurrent
                ? 'bg-snap-yellow animate-pulse-live'
                : isCompleted
                ? 'bg-snap-yellow'
                : 'bg-snap-ash'
            }`}
          />
        );
      })}
    </div>
  );
}

const COLLAPSE_KEY = 'casey-tracker-stats-collapsed-v1';

export default function StatsBar({
  location,
  stats,
  itinerary,
  onOpenSchedule,
  onOpenMatch,
  onOpenFollowing,
  onOpenToday,
  lastUpdateAt,
  connectionLost,
}: Props) {
  const indicator = indicatorFor(location.state);
  const [staleAge, setStaleAge] = useState<number>(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStaleAge(Date.now() - lastUpdateAt);
    }, 1000);
    return () => clearInterval(id);
  }, [lastUpdateAt]);

  const isStale = staleAge > 5 * 60_000;
  const staleMinutes = Math.floor(staleAge / 60_000);
  const [collapsed, setCollapsed] = useState(false);
  const { count: followingCount } = useFollows();
  const [todayCount, setTodayCount] = useState<number | null>(null);

  // Fetches the same /api/today endpoint the LIVE TODAY tab uses, but
  // only cares about the item count for the pill label. Cheap: edge
  // cached at the route. Refreshes every 2 min so the count tracks
  // live results as they finalize.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/today', { cache: 'no-store' });
        const data = await res.json();
        if (!cancelled && data?.ok) setTodayCount((data.items ?? []).length);
      } catch {
        // ignore
      }
    };
    void load();
    const id = setInterval(load, 2 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    try {
      if (localStorage.getItem(COLLAPSE_KEY) === '1') setCollapsed(true);
    } catch {
      // ignore
    }
  }, []);

  // When the user collapses or expands the panel, the StatsBar's height
  // changes — refit the map to the visible area so corner stadiums don't
  // end up hidden behind the now-shorter (or taller) overlay. Wait ~280ms
  // for the layout (and any CSS transitions) to settle before calling
  // recenter, then verify the global is present in case the map hasn't
  // mounted yet.
  const collapseDidMount = useRef(false);
  useEffect(() => {
    if (!collapseDidMount.current) {
      collapseDidMount.current = true;
      return;
    }
    const t = setTimeout(() => {
      window.__caseyRecenter?.();
    }, 280);
    return () => clearTimeout(t);
  }, [collapsed]);

  const toggleCollapse = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  };

  const [countdownMs, setCountdownMs] = useState(stats.nextMatchInMs);
  useEffect(() => {
    setCountdownMs(stats.nextMatchInMs);
  }, [stats.nextMatchInMs]);
  useEffect(() => {
    if (countdownMs === null) return;
    const id = setInterval(() => {
      setCountdownMs((prev) => (prev === null ? null : Math.max(0, prev - 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [countdownMs === null]);

  const milesPct = (stats.milesFlown / stats.milesTotal) * 100;

  return (
    <div
      className="pointer-events-none absolute left-0 right-0 top-0 z-20 px-3 pt-3 pb-6 sm:px-5 sm:pt-4"
      data-map-overlay="top"
      style={{
        background:
          'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 60%, rgba(0,0,0,0) 100%)',
      }}
    >
      {/* Branding block (Snapback logo + CASEY TRACKER wordmark) removed for the
          SBX embed — SBX's own site nav already brands the page. Controls stay
          right-aligned via justify-end. */}
      <div className="flex items-center justify-end gap-3">
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={toggleCollapse}
            className={`flex items-center gap-1.5 border px-2.5 py-1.5 font-mono text-[10px] tracking-[0.18em] transition-colors ${
              collapsed
                ? 'border-snap-yellow bg-snap-yellow/10 text-snap-yellow'
                : 'border-snap-ash bg-snap-black/70 text-snap-mist hover:text-snap-yellow hover:border-snap-yellow'
            }`}
            aria-pressed={collapsed}
            aria-label={collapsed ? 'Show hero panel' : 'Hide hero panel'}
            title={collapsed ? 'Show hero panel' : 'Hide hero panel'}
          >
            <span aria-hidden="true">{collapsed ? '▸' : '▾'}</span>
            {collapsed ? 'SHOW' : 'HIDE'}
          </button>
          <button
            type="button"
            onClick={onOpenToday}
            className={`flex items-center gap-1.5 border px-2.5 py-1.5 font-mono text-[10px] tracking-[0.18em] transition-colors ${
              todayCount && todayCount > 0
                ? 'border-snap-yellow bg-snap-yellow/10 text-snap-yellow'
                : 'border-snap-ash bg-snap-black/70 text-snap-mist hover:text-snap-yellow hover:border-snap-yellow'
            }`}
            aria-label="Today's updates"
            title="Today's vlogs + live World Cup results"
          >
            <span
              aria-hidden="true"
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                todayCount && todayCount > 0 ? 'bg-snap-yellow animate-pulse-live' : 'bg-snap-fog'
              }`}
            />
            TODAY{todayCount && todayCount > 0 ? ` · ${todayCount}` : ''}
          </button>
          <button
            type="button"
            onClick={onOpenFollowing}
            className={`flex items-center gap-1.5 border px-2.5 py-1.5 font-mono text-[10px] tracking-[0.18em] transition-colors ${
              followingCount > 0
                ? 'border-snap-yellow bg-snap-yellow/10 text-snap-yellow'
                : 'border-snap-ash bg-snap-black/70 text-snap-mist hover:text-snap-yellow hover:border-snap-yellow'
            }`}
            aria-label="My followed teams"
            title="Manage followed teams"
          >
            <span aria-hidden="true">{followingCount > 0 ? '★' : '☆'}</span>
            {followingCount > 0 ? followingCount : 'TEAMS'}
          </button>
          <button
            type="button"
            onClick={onOpenSchedule}
            className="flex items-center gap-1.5 border border-snap-ash bg-snap-black/70 px-2.5 py-1.5 font-mono text-[10px] tracking-[0.18em] text-snap-mist hover:text-snap-yellow hover:border-snap-yellow transition-colors"
          >
            <svg viewBox="0 0 12 12" className="h-3 w-3 fill-current" aria-hidden="true">
              <rect x="1" y="2" width="10" height="9" stroke="currentColor" strokeWidth="1" fill="none" />
              <line x1="1" y1="5" x2="11" y2="5" stroke="currentColor" strokeWidth="1" />
              <line x1="4" y1="1" x2="4" y2="3" stroke="currentColor" strokeWidth="1" />
              <line x1="8" y1="1" x2="8" y2="3" stroke="currentColor" strokeWidth="1" />
            </svg>
            TOURNAMENT HUB
          </button>
          <div className="flex items-center gap-2 border border-snap-ash bg-snap-black/70 px-2.5 py-1.5">
            <span
              className={`block h-2 w-2 rounded-full ${
                connectionLost ? 'bg-live' : indicator.color
              } ${indicator.pulse && !connectionLost ? 'animate-pulse-live' : ''}`}
              aria-hidden="true"
              title={
                connectionLost
                  ? 'Connection lost'
                  : isStale
                  ? `Last update ${staleMinutes}m ago`
                  : 'Live'
              }
            />
            <span className="font-mono text-[10px] tracking-[0.18em] text-snap-chalk">
              {connectionLost
                ? 'OFFLINE'
                : isStale
                ? `STALE · ${staleMinutes}M`
                : indicator.label}
            </span>
          </div>
        </div>
      </div>

      <div className={`mt-3 ${collapsed ? 'hidden' : ''}`}>
        <HeroPanel
          location={location}
          stats={stats}
          itinerary={itinerary}
          onOpenMatch={onOpenMatch}
        />
      </div>

      <div className={`mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3 ${collapsed ? 'hidden sm:grid' : ''}`}>
        <StatCellLive
          label="MATCHES"
          value={stats.matchesAttended}
          suffix={`/ ${stats.matchesTotal}`}
          pips={{ total: stats.matchesTotal, completed: stats.matchesAttended }}
        />
        <StatCellLive
          label="MILES FLOWN"
          value={stats.milesFlown}
          suffix={`/ ${stats.milesTotal.toLocaleString()}`}
          pct={milesPct}
        />
        <StatCellLive
          label="DAY"
          value={stats.dayNumber}
          suffix={`/ ${stats.daysTotal}`}
          pips={{ total: stats.daysTotal, completed: stats.dayNumber }}
          className="hidden sm:block"
        />
        <StatCellLive
          label="STADIUMS"
          value={stats.stadiumsVisited}
          suffix={`/ ${stats.stadiumsTotal}`}
          pips={{ total: stats.stadiumsTotal, completed: stats.stadiumsVisited }}
          className="hidden sm:block"
        />
        <div className="pointer-events-auto bg-gradient-to-br from-snap-yellow/10 to-snap-black/70 border border-snap-yellow/40 px-2 py-1.5">
          <div className="font-mono text-[9px] tracking-[0.15em] text-snap-yellow">NEXT KO</div>
          <div className="stat-number text-snap-yellow text-[18px] sm:text-[22px] mt-0.5 tabular-nums">
            {formatCountdown(countdownMs)}
          </div>
          <div className="mt-1 h-[3px] w-full bg-snap-ash/50 overflow-hidden">
            <div className="h-full bg-snap-yellow animate-pulse-live" style={{ width: '30%' }} />
          </div>
        </div>
      </div>

      <div className={`pointer-events-auto mt-2 ${collapsed ? 'hidden sm:block' : ''}`}>
        <Ticker />
      </div>
    </div>
  );
}

function StatCellLive({
  label,
  value,
  suffix,
  pct,
  pips,
  className = '',
}: {
  label: string;
  value: number;
  suffix: string;
  pct?: number;
  pips?: { total: number; completed: number };
  className?: string;
}) {
  return (
    <div
      className={`pointer-events-auto bg-snap-black/70 border-t border-snap-ash/60 hover:border-t-snap-yellow/60 transition-colors px-2 py-1.5 ${className}`}
    >
      <div className="font-mono text-[9px] tracking-[0.15em] text-snap-mist">{label}</div>
      <div className="flex items-baseline gap-1">
        <CountUp
          value={value}
          className="stat-number text-[18px] sm:text-[22px] text-snap-chalk tabular-nums"
        />
        <span className="stat-number text-[10px] text-snap-mist">{suffix}</span>
      </div>
      {pips ? (
        <PipStrip total={pips.total} completed={pips.completed} />
      ) : (
        <ProgressBar pct={pct ?? 0} />
      )}
    </div>
  );
}
