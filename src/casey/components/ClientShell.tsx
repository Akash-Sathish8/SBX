
import { useCallback, useEffect, useState } from 'react';
import MapView from './MapView';
import StatsBar from './StatsBar';
import StadiumDrawer from './StadiumDrawer';
import SpendPanel from './SpendPanel';
import WelcomeCard from './WelcomeCard';
import ScheduleDrawer from './ScheduleDrawer';
import VideoStrip from './VideoStrip';
import LiveBanner from './LiveBanner';
import WhereIsCaseyBadge from './WhereIsCaseyBadge';
import FollowingModal from './FollowingModal';
import { computeCaseyLocation } from '@/lib/location';
import { computeTripStats } from '@/lib/stats';
import type {
  CaseyLocation,
  ItineraryMatch,
  MatchResult,
  SpendTracker,
  Stadium,
  TripStats,
} from '@/lib/types';

declare global {
  interface Window {
    __caseyRecenter?: () => void;
  }
}

interface Props {
  initialLocation: CaseyLocation;
  initialStats: TripStats;
  initialSpend: SpendTracker;
  initialResults?: Record<number, MatchResult>;
  itinerary: ItineraryMatch[];
  stadiums: Record<string, Stadium>;
  initialMatchNumber?: number;
  visibility?: { showLodging: boolean; showTransport: boolean };
  simTimeIso?: string | null;
}

export default function ClientShell({
  initialLocation,
  initialStats,
  initialSpend,
  initialResults = {},
  itinerary,
  stadiums,
  initialMatchNumber,
  visibility = { showLodging: false, showTransport: false },
  simTimeIso = null,
}: Props) {
  const [location, setLocation] = useState(initialLocation);
  const [stats, setStats] = useState(initialStats);
  const [spend, setSpend] = useState(initialSpend);
  const [selectedStadiumId, setSelectedStadiumId] = useState<string | null>(null);
  const [highlightMatchNumber, setHighlightMatchNumber] = useState<number | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleTab, setScheduleTab] = useState<'schedule' | 'live' | 'groups' | 'bracket'>(
    'schedule',
  );
  const [followingOpen, setFollowingOpen] = useState(false);
  const [welcomeForce, setWelcomeForce] = useState(false);
  // On phones the map is a live tracker: default to following Casey once the
  // trip is underway (pre/post-trip keeps the whole-journey overview). Desktop
  // map is a locked showcase, so following stays off there.
  const [following, setFollowing] = useState(() => {
    try {
      const s = initialLocation.state;
      return window.innerWidth < 640 && s !== 'pre-trip' && s !== 'post-trip';
    } catch {
      return false;
    }
  });
  const [lastUpdateAt, setLastUpdateAt] = useState<number>(Date.now());
  const [connectionLost, setConnectionLost] = useState(false);

  // ── Sim state (driven only by the ?simTime URL param) ──
  const [simTimeMs] = useState<number | null>(
    simTimeIso ? new Date(simTimeIso).getTime() : null,
  );
  const simModeActive = simTimeMs !== null;

  // ── Track top-overlay height (StatsBar) so floating badges sit just under it ──
  useEffect(() => {
    const update = () => {
      const topEl = document.querySelector<HTMLElement>('[data-map-overlay="top"]');
      const h = topEl?.offsetHeight ?? 280;
      document.documentElement.style.setProperty('--casey-badge-top', `${h + 12}px`);
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    // ResizeObserver catches StatsBar collapse/expand without a window resize.
    const topEl = document.querySelector<HTMLElement>('[data-map-overlay="top"]');
    let ro: ResizeObserver | null = null;
    if (topEl && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update);
      ro.observe(topEl);
    }
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      ro?.disconnect();
    };
  }, []);

  // ── Live polling — only when NOT in sim mode (sim recomputes locally) ──
  useEffect(() => {
    if (simModeActive) return; // sim mode owns the clock; skip server polling.
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let consecutiveFailures = 0;

    const schedule = (delayMs: number) => {
      if (cancelled) return;
      timer = setTimeout(tick, delayMs);
    };

    const tick = async () => {
      try {
        const res = await fetch('/api/live', { cache: 'no-store' });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.location) setLocation(data.location);
        if (data.stats) setStats(data.stats);
        if (data.spend) setSpend(data.spend);
        setLastUpdateAt(Date.now());
        setConnectionLost(false);
        consecutiveFailures = 0;
        schedule(60_000);
      } catch {
        if (cancelled) return;
        consecutiveFailures += 1;
        if (consecutiveFailures >= 3) setConnectionLost(true);
        const backoff = Math.min(60_000, 5_000 * Math.pow(2, consecutiveFailures - 1));
        schedule(backoff);
      }
    };

    timer = setTimeout(tick, 60_000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [simModeActive]);

  // ── Sim mode: recompute location/stats client-side whenever simTimeMs changes ──
  useEffect(() => {
    if (simTimeMs === null) return;
    const now = new Date(simTimeMs);
    const loc = computeCaseyLocation(now, null);
    const s = computeTripStats(now, loc, initialResults);
    setLocation(loc);
    setStats(s);
    setLastUpdateAt(Date.now());
  }, [simTimeMs, initialResults]);

  const openMatch = useCallback(
    (matchNumber: number) => {
      const m = itinerary.find((x) => x.matchNumber === matchNumber);
      if (!m) return;
      setSelectedStadiumId(m.stadiumId);
      setHighlightMatchNumber(matchNumber);
      setScheduleOpen(false);
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('match', String(matchNumber));
        // Preserve TanStack Router's history state (__TSR_index/key) — replacing
        // with null desyncs back/forward tracking and scroll restoration.
        window.history.replaceState(window.history.state, '', url.toString());
      } catch {
        // ignore
      }
    },
    [itinerary],
  );

  const closeStadiumDrawer = useCallback(() => {
    setSelectedStadiumId(null);
    setHighlightMatchNumber(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('match');
      window.history.replaceState(window.history.state, '', url.toString());
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      // ?match wins over the path param: openMatch writes ?match=N onto the
      // current URL, so on /casey/match/5 browsing to match 12 yields
      // /casey/match/5?match=12 — the search param is always the freshest state
      // and must round-trip on reload/share.
      const url = new URL(window.location.href);
      const match = url.searchParams.get('match');
      if (match) {
        const n = Number(match);
        if (!Number.isNaN(n)) {
          openMatch(n);
          return;
        }
      }
      if (initialMatchNumber !== undefined) openMatch(initialMatchNumber);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedStadium = selectedStadiumId ? stadiums[selectedStadiumId] : null;
  const stadiumMatches = selectedStadiumId
    ? itinerary.filter((m) => m.stadiumId === selectedStadiumId)
    : [];

  return (
    <>
      <MapView
        location={location}
        itinerary={itinerary}
        stadiums={stadiums}
        stats={stats}
        following={following}
        onUserPan={() => following && setFollowing(false)}
        onStadiumClick={(id) => {
          setSelectedStadiumId(id);
          setHighlightMatchNumber(null);
        }}
      />
      <div className="map-fx map-fx-grid" aria-hidden="true" />
      <div className="map-fx map-fx-vignette" aria-hidden="true" />
      <div className="map-fx map-fx-scanline" aria-hidden="true" />
      <div className="map-fx map-fx-noise" aria-hidden="true" />
      <div className="day-watermark" aria-hidden="true">
        <small>DAY</small>
        {String(stats.dayNumber).padStart(2, '0')}
        <span style={{ opacity: 0.5, margin: '0 0.05em' }}>/</span>
        {stats.daysTotal}
      </div>
      <LiveBanner itinerary={itinerary} onOpenMatch={openMatch} />
      <StatsBar
        location={location}
        stats={stats}
        itinerary={itinerary}
        onOpenSchedule={() => {
          setScheduleTab('schedule');
          setScheduleOpen(true);
        }}
        onOpenToday={() => {
          setScheduleTab('live');
          setScheduleOpen(true);
        }}
        onOpenFollowing={() => setFollowingOpen(true)}
        onOpenMatch={openMatch}
        lastUpdateAt={lastUpdateAt}
        connectionLost={connectionLost}
      />
      <SpendPanel
        spend={spend}
        following={following}
        onToggleFollow={() => setFollowing((f) => !f)}
        onOpenHelp={() => setWelcomeForce(true)}
      />
      <VideoStrip itinerary={itinerary} onMatchClick={openMatch} />
      {selectedStadium && (
        <StadiumDrawer
          stadium={selectedStadium}
          matches={stadiumMatches}
          highlightMatchNumber={highlightMatchNumber}
          onClose={closeStadiumDrawer}
          visibility={visibility}
        />
      )}
      <ScheduleDrawer
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        itinerary={itinerary}
        stadiums={stadiums}
        stats={stats}
        onMatchClick={openMatch}
        initialTab={scheduleTab}
      />
      <WelcomeCard
        forceOpen={welcomeForce}
        onClose={() => setWelcomeForce(false)}
      />
      <WhereIsCaseyBadge
        location={location}
        stats={stats}
        itinerary={itinerary}
        stadiums={stadiums}
      />
      <FollowingModal
        open={followingOpen}
        onClose={() => setFollowingOpen(false)}
        itinerary={itinerary}
      />
    </>
  );
}
