
import { useEffect, useMemo, useState } from 'react';
import Flag from './Flag';
import { useFollows } from '@/lib/follows';
import { buildFeed, type FeedEvent, type FeedEventType } from '@/lib/feed';
import type { ItineraryMatch } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  itinerary: ItineraryMatch[];
  nowMs: number;
  /** Tap an event → route into the tracker (open the match, deep-link a modal). */
  onOpenEvent: (matchNumber: number, type: FeedEventType) => void;
}

// Per-type chrome: a colored dot + a short mono label + the left accent rail.
const TYPE_META: Record<FeedEventType, { label: string; dot: string; rail: string; tone: string }> = {
  live: { label: 'LIVE', dot: 'bg-live', rail: 'border-l-live', tone: 'text-live' },
  result: { label: 'FINAL', dot: 'bg-snap-yellow', rail: 'border-l-snap-yellow', tone: 'text-snap-yellow' },
  vlog: { label: 'VLOG', dot: 'bg-snap-mist', rail: 'border-l-snap-mist', tone: 'text-snap-mist' },
  bet: { label: 'BET', dot: 'bg-snap-yellow', rail: 'border-l-snap-yellow', tone: 'text-snap-yellow' },
  agenda: { label: 'AGENDA', dot: 'bg-snap-chalk', rail: 'border-l-snap-chalk', tone: 'text-snap-chalk' },
  upcoming: { label: 'UP NEXT', dot: 'bg-snap-fog', rail: 'border-l-snap-ash', tone: 'text-snap-fog' },
};

export default function TodayModal({ open, onClose, itinerary, nowMs, onOpenEvent }: Props) {
  const { isFollowing, count } = useFollows();
  const [tab, setTab] = useState<'all' | 'following'>('all');

  const feed = useMemo(() => buildFeed(itinerary, nowMs), [itinerary, nowMs]);
  const followingFeed = useMemo(
    () => feed.filter((e) => e.teams.some((t) => isFollowing(t))),
    [feed, isFollowing],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!open) return null;

  const events = tab === 'all' ? feed : followingFeed;

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center bg-snap-black/85 backdrop-blur-sm p-3 sm:p-6 animate-detail-reveal"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg bg-snap-coal border-2 border-snap-yellow shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-snap-ash flex-shrink-0">
          <div>
            <div className="font-display text-snap-chalk text-[24px] leading-none tracking-wide">
              TODAY
            </div>
            <div className="font-mono text-[9px] tracking-[0.22em] text-snap-mist mt-1">
              WHAT&apos;S HAPPENING · ACROSS THE TOURNAMENT
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

        {/* Tabs */}
        <div className="flex items-stretch border-b border-snap-ash flex-shrink-0">
          <TabButton
            active={tab === 'all'}
            label="ALL"
            badge={feed.length}
            onClick={() => setTab('all')}
          />
          <TabButton
            active={tab === 'following'}
            label="★ FOLLOWING"
            badge={followingFeed.length}
            onClick={() => setTab('following')}
          />
        </div>

        {/* Feed */}
        <div className="overflow-y-auto flex-1 p-3 space-y-2">
          {events.length === 0 ? (
            <EmptyState tab={tab} followCount={count} />
          ) : (
            events.map((e) => <EventCard key={e.id} event={e} onClick={() => onOpenEvent(e.matchNumber, e.type)} />)
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-snap-ash flex-shrink-0">
          <div className="font-mono text-[9px] tracking-[0.18em] text-snap-fog leading-relaxed">
            FOLLOWING is local to this device · tap ★ on any match or open MY TEAMS to curate it
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  label,
  badge,
  onClick,
}: {
  active: boolean;
  label: string;
  badge: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-4 py-2.5 font-mono text-[11px] tracking-[0.18em] transition-colors ${
        active
          ? 'text-snap-yellow border-b-2 border-snap-yellow bg-snap-yellow/5'
          : 'text-snap-mist border-b-2 border-transparent hover:text-snap-chalk'
      }`}
    >
      {label}
      <span className={`ml-1.5 ${active ? 'text-snap-chalk' : 'text-snap-fog'}`}>{badge}</span>
    </button>
  );
}

function EventCard({ event, onClick }: { event: FeedEvent; onClick: () => void }) {
  const t = TYPE_META[event.type];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-3 border border-solid border-snap-ash border-l-[3px] ${t.rail} bg-snap-carbon px-3 py-2.5 text-left transition-colors hover:border-snap-mist hover:bg-snap-smoke/30`}
    >
      <div className="flex flex-shrink-0 -space-x-1.5">
        <Flag team={event.homeTeam} size={22} className="ring-1 ring-snap-coal" />
        <Flag team={event.awayTeam} size={22} className="ring-1 ring-snap-coal" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${t.dot} ${event.type === 'live' ? 'animate-pulse' : ''}`} aria-hidden="true" />
            <span className={`font-mono text-[9px] tracking-[0.18em] ${t.tone}`}>{t.label}</span>
          </span>
          <span className="font-mono text-[9px] tracking-[0.14em] text-snap-fog">{event.meta}</span>
        </div>
        <div className="mt-0.5 font-display text-[17px] leading-tight tracking-wide text-snap-chalk truncate">
          {event.headline}
        </div>
        <div className="font-mono text-[10px] tracking-[0.06em] text-snap-mist truncate">
          {event.detail} · {event.stage}
        </div>
      </div>
      <span className="flex-shrink-0 text-[18px] leading-none text-snap-fog transition-colors group-hover:text-snap-yellow" aria-hidden="true">
        ›
      </span>
    </button>
  );
}

function EmptyState({ tab, followCount }: { tab: 'all' | 'following'; followCount: number }) {
  if (tab === 'following' && followCount === 0) {
    return (
      <div className="border border-dashed border-snap-ash bg-snap-black/40 px-4 py-10 text-center">
        <div className="font-display text-[20px] tracking-wide text-snap-chalk">FOLLOW YOUR TEAMS</div>
        <div className="mx-auto mt-2 max-w-[260px] font-body text-[12px] leading-relaxed text-snap-mist">
          Tap the ★ on any match — or open <span className="text-snap-chalk">MY TEAMS</span> — and
          this tab fills with just their bets, agendas, results and vlogs.
        </div>
      </div>
    );
  }
  return (
    <div className="border border-dashed border-snap-ash bg-snap-black/40 px-4 py-10 text-center">
      <div className="font-display text-[20px] tracking-wide text-snap-chalk">NOTHING YET</div>
      <div className="mx-auto mt-2 max-w-[260px] font-body text-[12px] leading-relaxed text-snap-mist">
        {tab === 'following'
          ? 'No activity for your teams right now. Check back when they’re next up.'
          : 'No activity yet — this fills up as the tournament kicks off and Casey starts posting.'}
      </div>
    </div>
  );
}
