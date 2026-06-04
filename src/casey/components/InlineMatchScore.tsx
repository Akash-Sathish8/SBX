
import { useEffect, useState } from 'react';
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
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Score | null>(null);
  const [failed, setFailed] = useState(false);

  async function load() {
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch(
        `/api/match-score?date=${encodeURIComponent(date)}&home=${encodeURIComponent(homeTeam)}&away=${encodeURIComponent(awayTeam)}`,
        { cache: 'no-store' },
      );
      const json = await res.json();
      if (json?.ok && json.data) {
        setData(json.data);
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (open && !data && !loading) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open && data && data.status === 'in') {
      const id = setInterval(load, 45_000);
      return () => clearInterval(id);
    }
  }, [open, data?.status]); // eslint-disable-line react-hooks/exhaustive-deps

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
      {loading && !data && (
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
