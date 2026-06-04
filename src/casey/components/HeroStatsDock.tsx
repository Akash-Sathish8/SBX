
import { useEffect, useState } from 'react';
import { formatCountdown } from '@/lib/stats';
import Ticker from './Ticker';
import HeroPanel from './HeroPanel';
import CountUp from './CountUp';
import type { CaseyLocation, ItineraryMatch, TripStats } from '@/lib/types';

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

interface Props {
  location: CaseyLocation;
  stats: TripStats;
  itinerary: ItineraryMatch[];
  onOpenMatch: (n: number) => void;
  collapsed: boolean;
}

export default function HeroStatsDock({ location, stats, itinerary, onOpenMatch, collapsed }: Props) {
  const [countdownMs, setCountdownMs] = useState(stats.nextMatchInMs);
  useEffect(() => { setCountdownMs(stats.nextMatchInMs); }, [stats.nextMatchInMs]);
  useEffect(() => {
    if (countdownMs === null) return;
    const id = setInterval(() => setCountdownMs((p) => (p === null ? null : Math.max(0, p - 1000))), 1000);
    return () => clearInterval(id);
  }, [countdownMs === null]);
  const milesPct = (stats.milesFlown / stats.milesTotal) * 100;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pb-3 pt-6 sm:px-5"
      data-map-overlay="bottom"
      style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 55%, rgba(0,0,0,0) 100%)' }}
    >
      <div className={collapsed ? 'hidden' : ''}>
        <HeroPanel location={location} stats={stats} itinerary={itinerary} onOpenMatch={onOpenMatch} />
      </div>
      <div className={`mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3 ${collapsed ? 'hidden sm:grid' : ''}`}>
        <StatCellLive label="MATCHES" value={stats.matchesAttended} suffix={`/ ${stats.matchesTotal}`} pips={{ total: stats.matchesTotal, completed: stats.matchesAttended }} />
        <StatCellLive label="MILES FLOWN" value={stats.milesFlown} suffix={`/ ${stats.milesTotal.toLocaleString()}`} pct={milesPct} />
        <StatCellLive label="DAY" value={stats.dayNumber} suffix={`/ ${stats.daysTotal}`} pips={{ total: stats.daysTotal, completed: stats.dayNumber }} className="hidden sm:block" />
        <StatCellLive label="STADIUMS" value={stats.stadiumsVisited} suffix={`/ ${stats.stadiumsTotal}`} pips={{ total: stats.stadiumsTotal, completed: stats.stadiumsVisited }} className="hidden sm:block" />
        <div className="pointer-events-auto bg-gradient-to-br from-snap-yellow/10 to-snap-black/70 border border-snap-yellow/40 px-2 py-1.5">
          <div className="font-mono text-[9px] tracking-[0.15em] text-snap-yellow">NEXT KO</div>
          <div className="stat-number text-snap-yellow text-[18px] sm:text-[22px] mt-0.5 tabular-nums">{formatCountdown(countdownMs)}</div>
          <div className="mt-1 h-[3px] w-full bg-snap-ash/50 overflow-hidden"><div className="h-full bg-snap-yellow animate-pulse-live" style={{ width: '30%' }} /></div>
        </div>
      </div>
      <div className={`pointer-events-auto mt-2 ${collapsed ? 'hidden sm:block' : ''}`}><Ticker /></div>
    </div>
  );
}
