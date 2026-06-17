
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Flag from './Flag';
import { liveScoreSearch } from '@/lib/external-links';

interface Props {
  date: string;
  homeTeam: string;
  awayTeam: string;
}

interface Score {
  home: { name: string; score: number | null };
  away: { name: string; score: number | null };
  status: 'pre' | 'in' | 'post' | 'unknown';
  detail: string;
  completed: boolean;
}

export default function InlineMatchScore({ date, homeTeam, awayTeam }: Props) {
  const [open, setOpen] = useState(false);

  const q = useQuery<Score | null>({
    queryKey: ['match-score', date, homeTeam, awayTeam],
    queryFn: async () => {
      const res = await fetch(
        `/api/match-score?date=${encodeURIComponent(date)}&home=${encodeURIComponent(homeTeam)}&away=${encodeURIComponent(awayTeam)}`,
        { cache: 'no-store' },
      );
      const json = await res.json();
      if (!json?.ok) throw new Error('score unavailable');
      return (json.data ?? null) as Score | null;
    },
    enabled: open,
    // Poll only while the match is in progress, and pause when the tab is hidden.
    refetchInterval: (query) => (query.state.data?.status === 'in' ? 45_000 : false),
    refetchIntervalInBackground: false,
    staleTime: 0,
  });

  const data = q.data ?? null;
  const failed = open && !q.isLoading && !data;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border border-snap-ash hover:border-snap-yellow text-snap-mist hover:text-snap-yellow font-mono text-[9px] tracking-[0.18em] px-2 py-1 transition-colors"
      >
        ↓ LIVE SCORE
      </button>
    );
  }

  return (
    <div className="border border-snap-ash bg-snap-black/60 p-2.5 w-full">
      <div className="flex items-center justify-between gap-2">
        <div className="font-mono text-[9px] tracking-[0.18em] text-snap-yellow">
          LIVE SCORE {data?.status === 'in' ? '· REFRESHING' : ''}
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="font-mono text-[9px] tracking-[0.18em] text-snap-mist hover:text-snap-yellow"
        >
          ✕ HIDE
        </button>
      </div>
      {q.isLoading && !data && (
        <div className="mt-2 font-mono text-[10px] text-snap-mist">pulling the score…</div>
      )}
      {failed && (
        <div className="mt-2 font-mono text-[10px] text-snap-mist">
          no score yet ·{' '}
          <a
            href={liveScoreSearch(homeTeam, awayTeam, date)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-snap-yellow underline underline-offset-2"
          >
            check google ↗
          </a>
        </div>
      )}
      {data && (
        <div className="mt-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-[11px] text-snap-chalk truncate">
              <Flag team={data.home.name || homeTeam} size={12} className="mr-1" />
              {data.home.name}
            </span>
            <span className="stat-number text-[22px] text-snap-yellow">
              {data.home.score ?? '—'}
              <span className="text-snap-mist mx-1.5 text-sm">·</span>
              {data.away.score ?? '—'}
            </span>
            <span className="font-mono text-[11px] text-snap-chalk truncate text-right">
              {data.away.name}
              <Flag team={data.away.name || awayTeam} size={12} className="ml-1" />
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 font-mono text-[9px] tracking-[0.15em]">
            <span
              className={
                data.status === 'in'
                  ? 'text-live animate-pulse-live'
                  : data.status === 'post'
                  ? 'text-snap-yellow'
                  : 'text-snap-mist'
              }
            >
              {data.detail || (data.status === 'in' ? 'LIVE' : data.status.toUpperCase())}
            </span>
            <span className="text-snap-fog">via ESPN</span>
          </div>
        </div>
      )}
    </div>
  );
}
