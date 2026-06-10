
import { useEffect, useState } from 'react';
import Flag from './Flag';

interface ScoreboardEvent {
  id: string;
  date: string;
  name: string;
  shortName: string;
  venue?: string;
  city?: string;
  home: { name: string; abbr?: string; score: number | null };
  away: { name: string; abbr?: string; score: number | null };
  status: 'pre' | 'in' | 'post' | 'unknown';
  detail: string;
  completed: boolean;
}

interface VlogItem {
  matchNumber: number;
  match: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  youtubeId: string;
  thumbnail: string;
}

interface Props {
  onMatchClick?: (matchNumber: number) => void;
}

export default function LiveTodayTab({ onMatchClick }: Props = {}) {
  const [events, setEvents] = useState<ScoreboardEvent[] | null>(null);
  const [vlogs, setVlogs] = useState<VlogItem[] | null>(null);
  const [date, setDate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  async function load() {
    try {
      const [liveRes, todayRes] = await Promise.all([
        fetch('/api/live-today', { cache: 'no-store' }),
        fetch('/api/today', { cache: 'no-store' }),
      ]);
      const liveJson = await liveRes.json();
      const todayJson = await todayRes.json();
      if (liveJson?.ok) {
        setEvents(liveJson.data ?? []);
        setDate(liveJson.date ?? '');
      } else {
        setFailed(true);
      }
      if (todayJson?.ok) {
        // Only render vlog items (results are already shown below)
        const vs = (todayJson.items ?? []).filter(
          (it: { kind: string }) => it.kind === 'vlog',
        );
        setVlogs(vs);
      }
    } catch {
      setFailed(true);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  const hasVlogs = (vlogs?.length ?? 0) > 0;

  return (
    <div className="p-3 space-y-2">
      {hasVlogs && (
        <>
          <div className="font-mono text-[10px] tracking-[0.22em] text-snap-yellow mb-2 flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-snap-yellow animate-pulse-live" />
            CASEY&apos;S LATEST · {vlogs!.length} {vlogs!.length === 1 ? 'VLOG' : 'VLOGS'}
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-2 -mx-3 px-3">
            {vlogs!.map((v) => (
              <button
                key={v.matchNumber}
                type="button"
                onClick={() => onMatchClick?.(v.matchNumber)}
                className="flex-shrink-0 snap-start w-[160px] bg-snap-coal border border-snap-yellow/40 hover:border-snap-yellow transition-colors text-left overflow-hidden"
              >
                <div className="relative aspect-video bg-snap-black overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={v.thumbnail}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute top-1 left-1 bg-snap-yellow text-snap-chalk font-mono text-[8px] tracking-[0.18em] px-1 py-0.5">
                    ▶ VLOG
                  </div>
                </div>
                <div className="px-2 py-1.5">
                  <div className="font-mono text-[9px] tracking-[0.18em] text-snap-yellow truncate">
                    #{v.matchNumber} · {v.date.slice(5)}
                  </div>
                  <div className="font-display text-[12px] text-snap-chalk truncate leading-tight mt-0.5 flex items-center gap-1">
                    <Flag team={v.homeTeam} size={10} />
                    <span className="truncate">{v.match}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="border-t border-snap-ash my-2" />
        </>
      )}
      <div className="font-mono text-[10px] tracking-[0.22em] text-snap-mist mb-2">
        TODAY{date ? ` · ${date}` : ''} · {events?.length ?? 0} MATCHES
      </div>
      {loading && (
        <div className="font-mono text-[11px] text-snap-mist py-8 text-center">
          checking the scores…
        </div>
      )}
      {!loading && failed && (
        <div className="font-mono text-[11px] text-snap-mist py-6 text-center">
          can&apos;t pull scores rn · try again in a sec
        </div>
      )}
      {!loading && events && events.length === 0 && (
        <div className="font-mono text-[11px] text-snap-mist py-8 text-center">
          no games today · casey&apos;s catching his breath
        </div>
      )}
      {!loading &&
        events?.map((ev) => (
          <div key={ev.id} className="card-lift border border-snap-ash bg-gradient-to-br from-snap-coal to-snap-coal/70 p-3">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`font-mono text-[9px] tracking-[0.18em] ${
                  ev.status === 'in'
                    ? 'text-live animate-pulse-live'
                    : ev.status === 'post'
                    ? 'text-snap-yellow'
                    : 'text-snap-mist'
                }`}
              >
                {ev.detail || ev.status.toUpperCase()}
              </span>
              {ev.venue && (
                <span className="font-mono text-[9px] text-snap-fog truncate">
                  {ev.city ? `${ev.city} · ` : ''}
                  {ev.venue}
                </span>
              )}
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span className="font-mono text-[12px] text-snap-chalk truncate">
                <Flag team={ev.home.name} size={14} className="mr-1.5" />
                {ev.home.name}
              </span>
              <span className="stat-number text-[22px] text-snap-yellow">
                {ev.home.score ?? '—'}
                <span className="text-snap-mist mx-1.5 text-sm">·</span>
                {ev.away.score ?? '—'}
              </span>
              <span className="font-mono text-[12px] text-snap-chalk truncate text-right">
                {ev.away.name}
                <Flag team={ev.away.name} size={14} className="ml-1.5" />
              </span>
            </div>
          </div>
        ))}
      <div className="font-mono text-[9px] tracking-[0.18em] text-snap-fog text-right pt-2">
        via ESPN · refreshes every 30s
      </div>
    </div>
  );
}
