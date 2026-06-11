
import { useEffect, useMemo } from 'react';
import Flag from './Flag';
import { useFollows } from '@/lib/follows';
import type { ItineraryMatch } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  itinerary: ItineraryMatch[];
}

// Every team currently in the tracker — derived from itinerary so that
// as TBD knockouts get filled in, those teams show up automatically.
function uniqueTeams(itinerary: ItineraryMatch[]): string[] {
  const set = new Set<string>();
  for (const m of itinerary) {
    if (m.homeTeam && m.homeTeam !== 'TBD') set.add(m.homeTeam);
    if (m.awayTeam && m.awayTeam !== 'TBD') set.add(m.awayTeam);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export default function FollowingModal({ open, onClose, itinerary }: Props) {
  const { follows, toggle, isFollowing, clear, count } = useFollows();
  const allTeams = useMemo(() => uniqueTeams(itinerary), [itinerary]);
  const followedList = useMemo(
    () => Array.from(follows).sort((a, b) => a.localeCompare(b)),
    [follows],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center bg-snap-black/85 backdrop-blur-sm p-3 sm:p-6 animate-detail-reveal"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg bg-snap-coal border-2 border-snap-yellow shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-snap-ash flex-shrink-0">
          <div>
            <div className="font-display text-snap-chalk text-[24px] leading-none tracking-wide">
              MY TEAMS
            </div>
            <div className="font-mono text-[9px] tracking-[0.22em] text-snap-mist mt-1">
              FOLLOW · TRACK · FILTER
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-snap-mist hover:text-snap-yellow text-[20px] leading-none flex-shrink-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* What does following do? — explainer for first-time users */}
          <div className="px-4 py-3 border-b border-snap-ash bg-snap-yellow/5">
            <div className="font-mono text-[9px] tracking-[0.22em] text-snap-yellow mb-1.5">
              WHY FOLLOW
            </div>
            <ul className="space-y-1 font-body text-[12px] text-snap-mist leading-relaxed">
              <li>
                <span className="text-snap-chalk">★ highlighted everywhere</span> — your
                team&apos;s match cards get a yellow accent in Casey&apos;s Schedule, group
                tables, and the bracket
              </li>
              <li>
                <span className="text-snap-chalk">quick filter</span> — the Casey&apos;s
                Schedule dropdown gets a &quot;★ STARRED TEAMS&quot; option that hides every
                match not involving a team you follow
              </li>
              <li>
                <span className="text-snap-chalk">surfaces in today&apos;s updates</span> —
                results and vlogs involving your teams will be flagged at the top
              </li>
              <li className="text-snap-fog">
                coming soon · push notifications when your teams kick off, and when
                Casey posts content from one of their matches
              </li>
            </ul>
          </div>

          {/* FOLLOWING section */}
          <div className="px-4 py-4 border-b border-snap-ash">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="font-mono text-[10px] tracking-[0.22em] text-snap-yellow">
                ★ FOLLOWING · {count}
              </div>
              {count > 0 && (
                <button
                  type="button"
                  onClick={clear}
                  className="font-mono text-[9px] tracking-[0.22em] text-snap-mist hover:text-live transition-colors"
                >
                  CLEAR ALL
                </button>
              )}
            </div>
            {count === 0 ? (
              <div className="border border-dashed border-snap-ash bg-snap-black/40 px-3 py-5 text-center">
                <div className="font-body text-[12px] text-snap-mist leading-relaxed">
                  no teams yet. tap any team below — or any ☆ next to a match
                  in the tracker — to start following.
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {followedList.map((team) => (
                  <TeamTile key={team} team={team} on onToggle={() => toggle(team)} />
                ))}
              </div>
            )}
          </div>

          {/* ALL TEAMS section */}
          <div className="px-4 py-4">
            <div className="font-mono text-[10px] tracking-[0.22em] text-snap-mist mb-2.5">
              ALL TEAMS · {allTeams.length} IN TOURNAMENT
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {allTeams.map((team) => (
                <TeamTile
                  key={team}
                  team={team}
                  on={isFollowing(team)}
                  onToggle={() => toggle(team)}
                />
              ))}
            </div>
            <div className="font-mono text-[9px] tracking-[0.18em] text-snap-fog mt-4 leading-relaxed">
              more teams will appear here as the knockout bracket fills in.
              your stars persist on this device only — no account needed.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamTile({
  team,
  on,
  onToggle,
}: {
  team: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className={`relative flex items-center gap-2 px-2.5 py-2 border transition-colors text-left ${
        on
          ? 'border-snap-yellow bg-snap-yellow/10 text-snap-chalk'
          : 'border-snap-ash bg-snap-black/40 text-snap-mist hover:border-snap-mist hover:text-snap-chalk'
      }`}
    >
      <Flag team={team} size={18} />
      <span className="font-mono text-[11px] truncate flex-1">{team}</span>
      <span
        className={`text-[14px] leading-none flex-shrink-0 ${on ? 'text-snap-yellow' : 'text-snap-fog'}`}
        aria-hidden="true"
      >
        {on ? '★' : '☆'}
      </span>
    </button>
  );
}
