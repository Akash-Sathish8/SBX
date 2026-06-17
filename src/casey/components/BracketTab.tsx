
import Flag from './Flag';
import { useFollows } from '@/lib/follows';
import { useQuery } from '@tanstack/react-query';
import type { ScoreboardEvent } from '@/lib/espn';
import { bracketQueryOptions } from '@/lib/queries';

type Stages = Record<string, ScoreboardEvent[]>;

const COLUMNS = [
  { key: 'R32', label: 'ROUND OF 32', short: 'R32', slots: 16 },
  { key: 'R16', label: 'ROUND OF 16', short: 'R16', slots: 8 },
  { key: 'QF', label: 'QUARTERFINALS', short: 'QF', slots: 4 },
  { key: 'SF', label: 'SEMIFINALS', short: 'SF', slots: 2 },
  { key: 'FINAL', label: 'FINAL', short: 'F', slots: 1 },
] as const;

export default function BracketTab() {
  const q = useQuery(bracketQueryOptions());
  const stages: Stages | null = q.data?.ok && q.data.data ? q.data.data : null;
  const loading = q.isLoading;
  const total = stages ? Object.values(stages).reduce((sum, arr) => sum + arr.length, 0) : 0;
  const failed = !loading && (q.isError || !stages || total === 0);

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="font-mono text-[10px] tracking-[0.22em] text-snap-mist">
          KNOCKOUT BRACKET
        </div>
        <div className="font-mono text-[9px] tracking-[0.18em] text-snap-fog hidden sm:block">
          SCROLL HORIZONTALLY →
        </div>
      </div>

      {loading && (
        <div className="font-mono text-[11px] text-snap-mist py-8 text-center">
          drawing the bracket…
        </div>
      )}
      {!loading && failed && (
        <div className="font-mono text-[11px] text-snap-mist py-6 text-center">
          bracket fills in once R32 kicks off · june 28
        </div>
      )}
      {!loading && stages && !failed && (
        <>
          <div className="overflow-x-auto no-scrollbar pb-2 -mx-3 px-3">
            <div className="flex gap-3 min-w-max">
              {COLUMNS.map((col) => (
                <BracketColumn
                  key={col.key}
                  label={col.label}
                  short={col.short}
                  slots={col.slots}
                  events={stages[col.key] ?? []}
                  isFinal={col.key === 'FINAL'}
                />
              ))}
            </div>
          </div>

          {(stages['3RD PLACE']?.length ?? 0) > 0 && (
            <div className="mt-5 pt-4 border-t border-snap-ash">
              <div className="font-mono text-[10px] tracking-[0.22em] text-snap-yellow mb-2">
                3RD PLACE PLAYOFF
              </div>
              <div className="max-w-xs">
                <BracketCard ev={stages['3RD PLACE'][0]} highlight={false} />
              </div>
            </div>
          )}
        </>
      )}

      <div className="font-mono text-[9px] tracking-[0.18em] text-snap-fog text-right pt-3">
        via ESPN · cached 5 min · cards within each round listed by date
      </div>
    </div>
  );
}

function BracketColumn({
  label,
  short,
  slots,
  events,
  isFinal,
}: {
  label: string;
  short: string;
  slots: number;
  events: ScoreboardEvent[];
  isFinal: boolean;
}) {
  const width = isFinal ? 168 : 148;
  return (
    <div
      className="flex flex-col flex-shrink-0"
      style={{ width, minHeight: 760 }}
    >
      <div
        className={`text-center font-mono text-[10px] tracking-[0.22em] px-2 py-1.5 mb-2 ${
          isFinal
            ? 'bg-snap-yellow text-snap-chalk'
            : 'border border-snap-ash text-snap-yellow bg-snap-black/40'
        }`}
      >
        {short}
      </div>
      <div className="flex flex-col justify-around flex-1 gap-1">
        {Array.from({ length: slots }, (_, i) => {
          const ev = events[i];
          if (ev) return <BracketCard key={ev.id} ev={ev} highlight={isFinal} />;
          return (
            <PlaceholderCard key={`empty-${short}-${i}`} compact={short !== 'R32'} />
          );
        })}
      </div>
      <div
        className="text-center font-mono text-[8px] tracking-[0.18em] text-snap-fog mt-2"
        aria-hidden="true"
      >
        {label}
      </div>
    </div>
  );
}

function PlaceholderCard({ compact }: { compact: boolean }) {
  return (
    <div
      className="border border-dashed border-snap-ash/60 bg-snap-coal/40"
      style={{ padding: compact ? '6px 8px' : '8px 8px' }}
    >
      <div className="flex items-center justify-between gap-2 font-mono text-[10px] text-snap-fog">
        <span>TBD</span>
      </div>
      <div className="flex items-center justify-between gap-2 font-mono text-[10px] text-snap-fog">
        <span>TBD</span>
      </div>
    </div>
  );
}

function BracketCard({
  ev,
  highlight,
}: {
  ev: ScoreboardEvent;
  highlight: boolean;
}) {
  const homeScore = ev.home.score;
  const awayScore = ev.away.score;
  const homeWon = homeScore !== null && awayScore !== null && homeScore > awayScore;
  const awayWon = awayScore !== null && homeScore !== null && awayScore > homeScore;

  const borderCls =
    ev.status === 'in'
      ? 'border-live'
      : ev.status === 'post'
      ? 'border-snap-yellow/70'
      : 'border-snap-ash';

  return (
    <div
      className={`card-lift relative border ${borderCls} bg-gradient-to-br from-snap-coal to-snap-coal/70 hover:bg-snap-smoke/60`}
      style={{ padding: '6px 8px' }}
    >
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="font-mono text-[9px] text-snap-fog">
          {ev.date.slice(5, 10).replace('-', '/')}
        </span>
        <span
          className={`font-mono text-[8px] tracking-[0.15em] ${
            ev.status === 'in'
              ? 'text-live animate-pulse-live'
              : ev.status === 'post'
              ? 'text-snap-yellow'
              : 'text-snap-mist'
          }`}
        >
          {(ev.detail || ev.status).toUpperCase().slice(0, 10)}
        </span>
      </div>
      <BracketTeamRow
        name={ev.home.name || 'TBD'}
        score={homeScore}
        won={homeWon}
        lost={awayWon}
      />
      <BracketTeamRow
        name={ev.away.name || 'TBD'}
        score={awayScore}
        won={awayWon}
        lost={homeWon}
      />
      {highlight && (
        <div className="absolute -top-1 -left-1 -right-1 -bottom-1 border border-snap-yellow pointer-events-none" />
      )}
    </div>
  );
}

function BracketTeamRow({
  name,
  score,
  won,
  lost,
}: {
  name: string;
  score: number | null;
  won: boolean;
  lost: boolean;
}) {
  const { isFollowing } = useFollows();
  const followed = isFollowing(name);
  return (
    <div className={`flex items-center justify-between gap-1.5 ${followed ? 'bg-snap-yellow/10 -mx-1 px-1' : ''}`}>
      <span
        className={`font-mono text-[10px] truncate ${
          won
            ? 'text-snap-yellow font-bold'
            : lost
            ? 'text-snap-fog'
            : 'text-snap-chalk'
        }`}
      >
        <Flag team={name} size={12} className="mr-1" />
        {name === 'TBD' ? 'TBD' : (name.length > 12 ? name.slice(0, 11) + '…' : name)}
      </span>
      <span
        className={`stat-number text-[12px] tabular-nums flex-shrink-0 ${
          won ? 'text-snap-yellow' : lost ? 'text-snap-fog' : 'text-snap-chalk'
        }`}
      >
        {score ?? '—'}
      </span>
    </div>
  );
}
