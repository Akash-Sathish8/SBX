
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatInTimezone, zonedTimeToUtc } from '@/lib/time';
import Flag from './Flag';
import FollowStar from './FollowStar';
import { useFollows } from '@/lib/follows';
import { shareTracker } from '@/lib/share';
import LiveTodayTab from './LiveTodayTab';
import GroupsTab from './GroupsTab';
import BracketTab from './BracketTab';
import type { ItineraryMatch, Stadium, TripStats } from '@/lib/types';

type Filter = 'all' | 'upcoming' | 'done' | 'starred';
type Tab = 'schedule' | 'live' | 'groups' | 'bracket';

interface Props {
  open: boolean;
  onClose: () => void;
  itinerary: ItineraryMatch[];
  stadiums: Record<string, Stadium>;
  stats: TripStats;
  onMatchClick: (matchNumber: number) => void;
  initialTab?: Tab;
}

function countryColor(code: string): string {
  switch (code) {
    case 'US':
      return '#3b82f6';
    case 'MX':
      return '#16a34a';
    case 'CA':
      return '#dc2626';
    default:
      return '#6e6e6e';
  }
}

export default function ScheduleDrawer({
  open,
  onClose,
  itinerary,
  stadiums,
  stats,
  onMatchClick,
  initialTab,
}: Props) {
  const todayRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const { isFollowing, count: followCount } = useFollows();
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(initialTab ?? 'schedule');

  // If the drawer is re-opened from a different entry point (e.g. the
  // TODAY pill targeting 'live' vs the TOURNAMENT HUB button targeting
  // 'schedule'), respect the new initialTab.
  useEffect(() => {
    if (open && initialTab) setTab(initialTab);
  }, [open, initialTab]);

  const nowIndex = useMemo(() => {
    const now = Date.now();
    for (let i = 0; i < itinerary.length; i++) {
      const m = itinerary[i];
      const ko = zonedTimeToUtc(m.kickoffLocal, m.kickoffTZ).getTime();
      if (now <= ko + 4 * 60 * 60 * 1000) return i;
    }
    return itinerary.length - 1;
  }, [itinerary]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const t = setTimeout(() => {
      todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 220);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1100]">
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="absolute left-0 top-0 h-full w-full overflow-hidden bg-snap-coal border-r border-snap-ash sm:max-w-[480px] flex flex-col"
        style={{ animation: 'drawer-slide-left 280ms cubic-bezier(0.2,0.8,0.2,1)' }}
      >
        <div
          className="sm:hidden flex justify-center py-2 bg-snap-black cursor-grab active:cursor-grabbing"
          onTouchStart={(e) => {
            const startY = e.touches[0].clientY;
            const startT = Date.now();
            const onEnd = (te: TouchEvent) => {
              const endY = te.changedTouches[0].clientY;
              const dy = endY - startY;
              const dt = Date.now() - startT;
              if (dy > 60 && dt < 700) onClose();
              window.removeEventListener('touchend', onEnd);
            };
            window.addEventListener('touchend', onEnd, { passive: true });
          }}
          aria-hidden="true"
        >
          <div className="h-1 w-10 bg-snap-fog rounded" />
        </div>
        <header className="flex flex-col gap-3 border-b border-snap-ash p-4 bg-snap-black">
          <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] tracking-[0.22em] text-snap-yellow">
              TOURNAMENT HUB
            </div>
            <h2 className="font-display text-[28px] leading-none mt-1 text-snap-chalk">
              WORLD CUP 2026
            </h2>
            <div className="font-mono text-[10px] text-snap-mist mt-1">
              JUN 10 — JUL 19 · 40 DAYS
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={async () => {
                const r = await shareTracker();
                if (r === 'copied') {
                  setShareHint('LINK COPIED');
                  setTimeout(() => setShareHint(null), 1800);
                } else if (r === 'shared') {
                  setShareHint('SHARED ↗');
                  setTimeout(() => setShareHint(null), 1800);
                }
              }}
              className="h-10 sm:h-9 px-3 border border-snap-ash text-snap-mist hover:text-snap-yellow hover:border-snap-yellow transition-colors font-mono text-[10px] tracking-[0.18em]"
            >
              {shareHint ?? '↗ SHARE'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 sm:h-9 sm:w-9 items-center justify-center border border-snap-ash text-snap-mist hover:text-snap-yellow hover:border-snap-yellow transition-colors"
              aria-label="Close schedule"
            >
              ✕
            </button>
          </div>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {(['schedule', 'live', 'groups', 'bracket'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-3 py-1 font-mono text-[10px] tracking-[0.18em] border transition-colors flex-shrink-0 ${
                  tab === t
                    ? 'border-snap-yellow text-snap-yellow bg-snap-yellow/10'
                    : 'border-snap-ash text-snap-mist hover:text-snap-yellow hover:border-snap-yellow'
                }`}
              >
                {t === 'schedule' ? "CASEY'S SCHEDULE" : t.toUpperCase()}
              </button>
            ))}
          </div>
          {tab === 'schedule' && (
            <div className="relative">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as Filter)}
                className="appearance-none bg-snap-black border border-snap-ash text-snap-yellow font-mono text-[10px] tracking-[0.18em] pl-2.5 pr-7 py-1 hover:border-snap-yellow transition-colors focus:outline-none focus:border-snap-yellow cursor-pointer"
                aria-label="Filter Casey's schedule"
              >
                <option value="all">ALL MATCHES</option>
                <option value="upcoming">UPCOMING</option>
                <option value="done">DONE</option>
                <option value="starred">★ STARRED TEAMS</option>
              </select>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-snap-yellow text-[10px]"
              >
                ▾
              </span>
            </div>
          )}
        </header>

        <div ref={containerRef} className="flex-1 overflow-y-auto no-scrollbar pb-16">
          {tab === 'live' && <LiveTodayTab onMatchClick={onMatchClick} />}
          {tab === 'groups' && <GroupsTab />}
          {tab === 'bracket' && <BracketTab />}
          {tab === 'schedule' && (
          <div className="p-3 space-y-2">
          {filter === 'starred' && followCount === 0 && (
            <div className="border border-dashed border-snap-ash bg-snap-coal/50 px-4 py-6 text-center">
              <div className="font-mono text-[10px] tracking-[0.22em] text-snap-yellow">
                ★ NO TEAMS STARRED YET
              </div>
              <div className="font-body text-[12px] text-snap-mist mt-2 leading-relaxed">
                tap the ☆ next to any team name to follow them. their
                matches will be filtered here and highlighted across the
                tracker.
              </div>
            </div>
          )}
          {itinerary
            .map((m, i) => ({ m, i }))
            .filter(({ m, i }) => {
              if (filter === 'all') return true;
              if (filter === 'starred') {
                return isFollowing(m.homeTeam) || isFollowing(m.awayTeam);
              }
              const isDone = i < stats.matchesAttended;
              return filter === 'done' ? isDone : !isDone;
            })
            .map(({ m, i }) => (
              <MatchRow
                key={m.matchNumber}
                m={m}
                index={i}
                stadium={stadiums[m.stadiumId]}
                isAttended={i < stats.matchesAttended}
                isNext={i === nowIndex && i >= stats.matchesAttended}
                attachRef={(el) => {
                  if (i === nowIndex) todayRef.current = el;
                }}
                onClick={() => onMatchClick(m.matchNumber)}
              />
            ))}
          </div>
          )}
        </div>

        <footer className="border-t border-snap-ash bg-snap-black px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] tracking-[0.18em]">
          <span className="text-snap-mist">FOLLOW:</span>
          <a
            href="https://x.com/csett13"
            target="_blank"
            rel="noopener noreferrer"
            className="text-snap-chalk hover:text-snap-yellow transition-colors"
          >
            @CSETT13 ↗
          </a>
          <a
            href="https://x.com/snapbacksports"
            target="_blank"
            rel="noopener noreferrer"
            className="text-snap-chalk hover:text-snap-yellow transition-colors"
          >
            @SNAPBACKSPORTS ↗
          </a>
          <a
            href="https://youtube.com/@snapbacksports"
            target="_blank"
            rel="noopener noreferrer"
            className="text-snap-chalk hover:text-snap-yellow transition-colors"
          >
            YOUTUBE ↗
          </a>
        </footer>
      </aside>

      <style>{`
        @keyframes drawer-slide-left {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(0);
          }
        }
        @media (max-width: 640px) {
          aside {
            animation: drawer-slide-up-mobile 280ms cubic-bezier(0.2, 0.8, 0.2, 1) !important;
          }
          @keyframes drawer-slide-up-mobile {
            from {
              transform: translateY(100%);
            }
            to {
              transform: translateY(0);
            }
          }
        }
      `}</style>
    </div>
  );
}

function matchStamp(m: ItineraryMatch): { label: string; rotate: 'l' | 'r' } | null {
  if (m.stage === 'FINAL') return { label: 'THE FINAL', rotate: 'l' };
  if (/3rd Place/i.test(m.stage)) return { label: 'BRONZE', rotate: 'r' };
  if (/Semifinal/i.test(m.stage)) return { label: 'SEMIS', rotate: 'r' };
  if (m.matchNumber === 1) return { label: 'OPENER', rotate: 'l' };
  if (m.homeTeam === 'USA' || m.awayTeam === 'USA') return { label: 'USA', rotate: 'r' };
  if (m.homeTeam === 'Mexico' || m.awayTeam === 'Mexico') return { label: 'EL TRI', rotate: 'l' };
  if (m.homeTeam === 'Canada' || m.awayTeam === 'Canada') return { label: 'CAN', rotate: 'r' };
  if (m.homeTeam === 'Brazil' || m.awayTeam === 'Brazil') return { label: 'SELEÇÃO', rotate: 'l' };
  if (m.homeTeam === 'France' || m.awayTeam === 'France') return { label: 'LES BLEUS', rotate: 'r' };
  if (m.homeTeam === 'England' || m.awayTeam === 'England') return { label: 'ENGLAND', rotate: 'l' };
  return null;
}

function MatchRow({
  m,
  index,
  stadium,
  isAttended,
  isNext,
  attachRef,
  onClick,
}: {
  m: ItineraryMatch;
  index: number;
  stadium: Stadium | undefined;
  isAttended: boolean;
  isNext: boolean;
  attachRef: (el: HTMLDivElement | null) => void;
  onClick: () => void;
}) {
  const ko = zonedTimeToUtc(m.kickoffLocal, m.kickoffTZ);
  const koLabel = formatInTimezone(ko, m.kickoffTZ, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const isLive = m.result?.status === 'live';
  const isFinal = m.result?.status === 'final';
  const isKnockout = !/Group/i.test(m.stage);
  const hs = m.result?.homeScore;
  const as = m.result?.awayScore;
  const homeWon = hs != null && as != null && hs > as;
  const awayWon = as != null && hs != null && as > hs;
  const { isFollowing } = useFollows();
  const anyFollowed = isFollowing(m.homeTeam) || isFollowing(m.awayTeam);

  // Variant determines treatment
  const variant: 'next-up' | 'live' | 'done' | 'upcoming' = isLive
    ? 'live'
    : isNext
    ? 'next-up'
    : isAttended || isFinal
    ? 'done'
    : 'upcoming';

  // Special stamps for notable matches
  const stamp = matchStamp(m);

  // NEXT UP is dramatic: bigger, with hero treatment
  if (variant === 'next-up') {
    return (
      <div
        ref={attachRef}
        onClick={onClick}
        className="card-lift relative cursor-pointer bg-gradient-to-br from-snap-yellow/15 via-snap-coal to-snap-coal border-2 border-snap-yellow p-4 group overflow-hidden panel-textured"
        style={{ boxShadow: '0 4px 20px rgba(255,212,0,0.18)' }}
      >
        <div
          className="absolute top-0 right-0 font-display text-snap-yellow/10 leading-none pointer-events-none select-none"
          style={{ fontSize: '110px', marginRight: '-10px', marginTop: '-18px' }}
          aria-hidden="true"
        >
          #{m.matchNumber}
        </div>
        {stamp && (
          <span
            className={`stamp ${stamp.rotate === 'l' ? 'stamp-rotate-l' : 'stamp-rotate-r'}`}
            style={{ top: 8, right: 8 }}
          >
            {stamp.label}
          </span>
        )}
        <div className="relative">
          <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.22em] text-snap-yellow">
            <span className="bg-snap-yellow text-snap-black px-1.5 py-0.5">NEXT UP</span>
            <span className="text-snap-mist">·</span>
            <span>{m.stage.toUpperCase()}</span>
          </div>
          <div className="font-display text-[28px] sm:text-[32px] text-snap-chalk mt-2 leading-[0.95] flex items-center gap-2 flex-wrap">
            <Flag team={m.homeTeam} size={24} />
            <span>{m.homeTeam}</span>
            <FollowStar team={m.homeTeam} size={16} />
            <span className="text-snap-fog text-[18px] italic font-body">vs</span>
            <span>{m.awayTeam}</span>
            <FollowStar team={m.awayTeam} size={16} />
            <Flag team={m.awayTeam} size={24} />
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 font-mono text-[10px] text-snap-mist">
            <span>{koLabel}</span>
            <span className="text-right">{stadium?.city ?? m.stadiumId}</span>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'live') {
    return (
      <div
        ref={attachRef}
        onClick={onClick}
        className="card-lift relative cursor-pointer bg-gradient-to-r from-live/10 to-snap-coal border-2 border-live p-3 group overflow-hidden"
        style={{ boxShadow: '0 0 24px rgba(255,56,56,0.2)' }}
      >
        <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.22em] text-live animate-pulse-live">
          <span className="inline-block h-2 w-2 rounded-full bg-live" />
          LIVE NOW
        </div>
        <div className="font-display text-[20px] text-snap-chalk mt-1 leading-tight flex items-center gap-1.5 flex-wrap">
          <Flag team={m.homeTeam} size={18} />
          <span>{m.homeTeam}</span>
          <FollowStar team={m.homeTeam} size={14} />
          <span className="text-snap-fog text-sm italic font-body">vs</span>
          <span>{m.awayTeam}</span>
          <FollowStar team={m.awayTeam} size={14} />
          <Flag team={m.awayTeam} size={18} />
        </div>
        <div className="font-mono text-[10px] text-snap-mist mt-1">
          {stadium?.city ?? m.stadiumId} · tap for live score
        </div>
      </div>
    );
  }

  // DONE: dim, smaller, score-emphasized
  if (variant === 'done') {
    return (
      <div
        ref={attachRef}
        onClick={onClick}
        className={`relative cursor-pointer bg-snap-coal/40 border-l-2 px-3 py-2 hover:bg-snap-smoke/40 transition-colors group flex items-center gap-3 ${
          anyFollowed ? 'border-snap-yellow' : 'border-snap-fog'
        }`}
      >
        <span className="font-mono text-[9px] tracking-[0.18em] text-snap-fog flex-shrink-0 w-8">
          #{m.matchNumber}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-display text-[14px] text-snap-mist leading-tight truncate">
            <Flag team={m.homeTeam} size={12} className="mr-1" />
            {m.homeTeam}
            <FollowStar team={m.homeTeam} size={10} className="ml-0.5" />
            <span className="text-snap-fog mx-1">vs</span>
            {m.awayTeam}
            <FollowStar team={m.awayTeam} size={10} className="ml-0.5" />
            <Flag team={m.awayTeam} size={12} className="ml-1" />
          </div>
          <div className="font-mono text-[9px] text-snap-fog truncate">
            {m.date} · {stadium?.city ?? m.stadiumId}
          </div>
        </div>
        {isFinal && hs != null && as != null && (
          <div className="stat-number text-[16px] flex-shrink-0">
            <span className={homeWon ? 'text-snap-yellow' : 'text-snap-fog'}>{hs}</span>
            <span className="text-snap-fog mx-1">·</span>
            <span className={awayWon ? 'text-snap-yellow' : 'text-snap-fog'}>{as}</span>
          </div>
        )}
        {!isFinal && (
          <span className="font-mono text-[8px] tracking-[0.18em] text-snap-fog">DONE</span>
        )}
      </div>
    );
  }

  // UPCOMING: standard card, knockouts get yellow top accent, followed
  // teams' matches get a left-edge yellow accent so they stand out in
  // the schedule list at a glance.
  return (
    <div
      ref={attachRef}
      onClick={onClick}
      className={`card-lift relative cursor-pointer bg-snap-coal/60 border border-snap-ash p-3 hover:bg-snap-smoke/60 hover:border-snap-mist group ${
        isKnockout ? 'border-t-2 border-t-snap-yellow/70' : ''
      } ${anyFollowed ? 'border-l-2 border-l-snap-yellow' : ''}`}
    >
      {stamp && (
        <span
          className={`stamp ${stamp.rotate === 'l' ? 'stamp-rotate-l' : 'stamp-rotate-r'}`}
          style={{ top: 6, right: 6, fontSize: 10 }}
        >
          {stamp.label}
        </span>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 font-mono text-[9px] tracking-[0.18em] text-snap-mist">
            <span className="text-snap-yellow">#{m.matchNumber}</span>
            <span>·</span>
            <span>{m.stage.toUpperCase()}</span>
            {isKnockout && (
              <span className="bg-snap-yellow/15 text-snap-yellow px-1 py-0.5 text-[8px]">KO</span>
            )}
          </div>
          <div className="font-display text-[17px] text-snap-chalk mt-1 leading-tight flex items-center gap-1.5 flex-wrap">
            <Flag team={m.homeTeam} size={16} />
            <span>{m.homeTeam}</span>
            <FollowStar team={m.homeTeam} size={12} />
            <span className="text-snap-fog text-sm italic font-body">vs</span>
            <span>{m.awayTeam}</span>
            <FollowStar team={m.awayTeam} size={12} />
            <Flag team={m.awayTeam} size={16} />
          </div>
          <div className="font-mono text-[10px] text-snap-mist mt-1">
            {koLabel} · {stadium?.city ?? m.stadiumId}
          </div>
        </div>
      </div>
    </div>
  );
}
