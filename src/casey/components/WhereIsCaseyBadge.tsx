
import { useEffect, useState } from 'react';
import Flag from './Flag';
import type { CaseyLocation, ItineraryMatch, Stadium, TripStats } from '@/lib/types';

interface Props {
  location: CaseyLocation;
  stats: TripStats;
  itinerary: ItineraryMatch[];
  stadiums: Record<string, Stadium>;
}

function formatCountdown(ms: number | null): string {
  if (ms === null || ms <= 0) return '—';
  const totalMin = Math.floor(ms / 60000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function WhereIsCaseyBadge({ location, stats, itinerary, stadiums }: Props) {
  const [open, setOpen] = useState(false);
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

  const stateColor =
    location.state === 'at-stadium'
      ? 'border-live'
      : location.state === 'in-transit'
      ? 'border-snap-yellow'
      : location.state === 'at-hotel'
      ? 'border-snap-yellow'
      : 'border-snap-fog';
  const statePulse = location.state === 'at-stadium' ? 'animate-pulse-live' : '';

  const currentMatch = location.currentMatchNumber
    ? itinerary.find((m) => m.matchNumber === location.currentMatchNumber) ?? null
    : null;
  const nextMatch = location.nextMatchNumber
    ? itinerary.find((m) => m.matchNumber === location.nextMatchNumber) ?? null
    : null;
  const currentStadium = currentMatch ? stadiums[currentMatch.stadiumId] : null;
  const nextStadium = nextMatch ? stadiums[nextMatch.stadiumId] : null;
  const fromStadium = location.fromStadiumId ? stadiums[location.fromStadiumId] : null;
  const toStadium = location.toStadiumId ? stadiums[location.toStadiumId] : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`pointer-events-auto fixed z-30 h-12 w-12 rounded-full overflow-hidden border-2 ${stateColor} ${statePulse} bg-snap-coal shadow-lg hover:scale-105 transition-transform`}
        style={{ top: 'var(--casey-badge-top, 290px)', right: '12px' }}
        aria-label="Where is Casey?"
      >
        <img
          src="/casey-avatar.jpeg"
          alt="Casey"
          className="h-full w-full object-cover"
          draggable={false}
        />
        <span
          className={`absolute -bottom-0.5 -right-0.5 block h-3 w-3 rounded-full border-2 border-snap-black ${
            location.state === 'at-stadium'
              ? 'bg-live'
              : location.state === 'in-transit'
              ? 'bg-snap-yellow animate-pulse-live'
              : location.state === 'at-hotel'
              ? 'bg-snap-yellow'
              : 'bg-snap-fog'
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center bg-snap-black/85 backdrop-blur-sm p-3 sm:p-6 animate-detail-reveal"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full sm:max-w-md bg-snap-coal border-2 border-snap-yellow shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-snap-ash">
              <div className="font-display text-snap-chalk text-[24px] leading-none tracking-wide">
                WHERE IS CASEY?
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-snap-mist hover:text-snap-yellow text-[20px] leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="overflow-y-auto px-4 py-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="relative flex-shrink-0">
                  <img
                    src="/casey-avatar.jpeg"
                    alt="Casey"
                    className={`h-16 w-16 rounded-full object-cover border-2 ${stateColor} ${statePulse}`}
                    draggable={false}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <StatePill state={location.state} />
                  <div className="font-mono text-[10px] tracking-[0.18em] text-snap-mist mt-1.5 uppercase">
                    {location.description}
                  </div>
                </div>
              </div>

              {location.state === 'at-stadium' && currentMatch && currentStadium && (
                <AtStadiumDetail
                  match={currentMatch}
                  stadium={currentStadium}
                />
              )}

              {location.state === 'in-transit' && (
                <InTransitDetail
                  fromStadium={fromStadium}
                  toStadium={toStadium}
                  progressPercent={location.progressPercent ?? 0}
                  nextMatch={nextMatch}
                  countdownMs={countdownMs}
                />
              )}

              {location.state === 'at-hotel' && (
                <AtHotelDetail
                  sleepCity={location.description}
                  nextMatch={nextMatch}
                  nextStadium={nextStadium}
                  countdownMs={countdownMs}
                />
              )}

              {location.state === 'pre-trip' && (
                <PreTripDetail nextMatch={nextMatch} countdownMs={countdownMs} />
              )}

              {location.state === 'post-trip' && <PostTripDetail />}

              <div className="grid grid-cols-2 gap-2 border-t border-snap-ash pt-3">
                <Stat label="DAY" value={`${String(stats.dayNumber).padStart(2, '0')} / ${stats.daysTotal}`} />
                <Stat
                  label="MATCHES"
                  value={`${stats.matchesAttended} / ${stats.matchesTotal}`}
                />
                <Stat
                  label="MILES FLOWN"
                  value={`${stats.milesFlown.toLocaleString()}`}
                />
                <Stat
                  label="STADIUMS"
                  value={`${stats.stadiumsVisited} / ${stats.stadiumsTotal}`}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StatePill({ state }: { state: CaseyLocation['state'] }) {
  const map: Record<CaseyLocation['state'], { label: string; cls: string }> = {
    'at-stadium': { label: '● LIVE · INSIDE THE STADIUM', cls: 'bg-live text-snap-chalk' },
    'in-transit': { label: '✈ IN TRANSIT', cls: 'bg-snap-yellow text-snap-chalk' },
    'at-hotel': { label: '☕ OFF DAY · AT HOTEL', cls: 'bg-snap-yellow text-snap-chalk' },
    'pre-trip': { label: '◷ PRE-TRIP', cls: 'bg-snap-fog text-snap-chalk' },
    'post-trip': { label: '🎬 WRAPPED', cls: 'bg-snap-fog text-snap-chalk' },
  };
  const s = map[state];
  return (
    <span
      className={`inline-block px-2 py-0.5 font-mono text-[10px] tracking-[0.22em] ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

function AtStadiumDetail({ match, stadium }: { match: ItineraryMatch; stadium: Stadium }) {
  return (
    <div className="bg-snap-black/60 border-l-2 border-live p-3 space-y-2">
      <div className="font-mono text-[9px] tracking-[0.22em] text-live">MATCH IN PROGRESS</div>
      <div className="font-display text-[20px] leading-tight text-snap-chalk flex items-center gap-2 flex-wrap">
        <Flag team={match.homeTeam} size={18} />
        <span>{match.homeTeam}</span>
        <span className="text-snap-fog text-[14px] italic">vs</span>
        <span>{match.awayTeam}</span>
        <Flag team={match.awayTeam} size={18} />
      </div>
      <div className="font-body text-[12px] text-snap-mist">
        {stadium.name}
        <br />
        <span className="text-snap-fog">
          {stadium.city}
          {stadium.state ? `, ${stadium.state}` : ''}
        </span>
      </div>
    </div>
  );
}

function InTransitDetail({
  fromStadium,
  toStadium,
  progressPercent,
  nextMatch,
  countdownMs,
}: {
  fromStadium: Stadium | null;
  toStadium: Stadium | null;
  progressPercent: number;
  nextMatch: ItineraryMatch | null;
  countdownMs: number | null;
}) {
  return (
    <div className="bg-snap-black/60 border-l-2 border-snap-yellow p-3 space-y-3">
      <div className="font-mono text-[9px] tracking-[0.22em] text-snap-yellow">EN ROUTE</div>
      <div className="flex items-center justify-between gap-2 font-mono text-[11px] uppercase">
        <div className="flex-1 min-w-0">
          <div className="text-snap-fog text-[9px] tracking-[0.18em]">FROM</div>
          <div className="text-snap-chalk truncate">{fromStadium?.city ?? 'New York City'}</div>
        </div>
        <div className="text-snap-yellow text-[18px]">→</div>
        <div className="flex-1 min-w-0 text-right">
          <div className="text-snap-fog text-[9px] tracking-[0.18em]">TO</div>
          <div className="text-snap-chalk truncate">{toStadium?.city ?? '—'}</div>
        </div>
      </div>
      <div>
        <div className="h-1.5 bg-snap-ash overflow-hidden">
          <div
            className="h-full bg-snap-yellow transition-[width] duration-700"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between font-mono text-[9px] tracking-[0.18em] text-snap-mist mt-1">
          <span>{progressPercent}% AIRBORNE</span>
          {nextMatch && countdownMs !== null && (
            <span className="text-snap-yellow">KICKOFF IN {formatCountdown(countdownMs)}</span>
          )}
        </div>
      </div>
      {nextMatch && (
        <div className="font-body text-[12px] text-snap-mist">
          Next: <span className="text-snap-chalk">{nextMatch.match}</span>
        </div>
      )}
    </div>
  );
}

function AtHotelDetail({
  sleepCity,
  nextMatch,
  nextStadium,
  countdownMs,
}: {
  sleepCity: string;
  nextMatch: ItineraryMatch | null;
  nextStadium: Stadium | null;
  countdownMs: number | null;
}) {
  const cityClean = sleepCity
    .replace(/^(off day in|posted up in|day off in|chilling in|resting in|in)\s/i, '')
    .toUpperCase();
  return (
    <div className="bg-snap-black/60 border-l-2 border-snap-yellow p-3 space-y-2">
      <div className="font-mono text-[9px] tracking-[0.22em] text-snap-yellow">BETWEEN MATCHES</div>
      <div className="font-display text-[24px] leading-tight text-snap-chalk">
        {cityClean || 'AT HOTEL'}
      </div>
      {nextMatch && nextStadium && (
        <div className="border-t border-snap-ash pt-2 mt-2">
          <div className="font-mono text-[9px] tracking-[0.22em] text-snap-mist">NEXT MATCH</div>
          <div className="font-body text-[13px] text-snap-chalk mt-1">{nextMatch.match}</div>
          <div className="font-mono text-[10px] text-snap-mist">
            {nextStadium.city} · {nextMatch.date}
          </div>
          {countdownMs !== null && (
            <div className="font-mono text-[10px] text-snap-yellow mt-1">
              KICKOFF IN {formatCountdown(countdownMs)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PreTripDetail({
  nextMatch,
  countdownMs,
}: {
  nextMatch: ItineraryMatch | null;
  countdownMs: number | null;
}) {
  return (
    <div className="bg-snap-black/60 border-l-2 border-snap-fog p-3 space-y-2">
      <div className="font-mono text-[9px] tracking-[0.22em] text-snap-mist">TOURNAMENT LOADING</div>
      <div className="font-display text-[24px] leading-tight text-snap-chalk">
        {countdownMs !== null ? formatCountdown(countdownMs).toUpperCase() : 'JUN 11'}{' '}
        TO KICKOFF
      </div>
      {nextMatch && (
        <div className="font-body text-[12px] text-snap-mist">
          Opener: <span className="text-snap-chalk">{nextMatch.match}</span> at Estadio Azteca
        </div>
      )}
    </div>
  );
}

function PostTripDetail() {
  return (
    <div className="bg-snap-black/60 border-l-2 border-snap-fog p-3 space-y-2">
      <div className="font-mono text-[9px] tracking-[0.22em] text-snap-mist">WRAPPED</div>
      <div className="font-display text-[24px] leading-tight text-snap-chalk">
        34 / 34 MATCHES
      </div>
      <div className="font-body text-[12px] text-snap-mist">
        casey survived the world cup. vlogs on youtube.
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-snap-black/40 px-2.5 py-1.5 border-l-2 border-snap-ash">
      <div className="font-mono text-[9px] tracking-[0.18em] text-snap-mist">{label}</div>
      <div className="stat-number text-snap-chalk text-[14px] tabular-nums">{value}</div>
    </div>
  );
}
