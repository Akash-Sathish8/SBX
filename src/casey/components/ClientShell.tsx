
import { useCallback, useEffect, useState } from 'react';
import MapView from './MapView';
import ControlCluster from './ControlCluster';
import HeroStatsDock from './HeroStatsDock';
import StadiumDrawer from './StadiumDrawer';
import SpendPanel from './SpendPanel';
import WelcomeCard from './WelcomeCard';
import ScheduleDrawer from './ScheduleDrawer';
import VideoStrip from './VideoStrip';
import LiveBanner from './LiveBanner';
import TimeTravelPanel from './TimeTravelPanel';
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

// Sim speed = how many hours of trip time per second of real time.
// 0.5 = 30 min/sec (32 min for full 40-day trip)
// 2   = 2 hr/sec  (8 min)
// 8   = 8 hr/sec  (2 min)
export type SimSpeed = 0.5 | 2 | 8;
const TRIP_START_MS = Date.UTC(2026, 5, 10, 12, 0, 0);
// Extend a bit past the final so the sim plays through the 'wrapped' state.
const TRIP_END_MS = Date.UTC(2026, 6, 21, 12, 0, 0);
const TICK_INTERVAL_MS = 200; // 5 ticks/sec — smooth motion

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
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [welcomeForce, setWelcomeForce] = useState(false);
  const [following, setFollowing] = useState(false);
  const [lastUpdateAt, setLastUpdateAt] = useState<number>(Date.now());
  const [connectionLost, setConnectionLost] = useState(false);

  // ── Sim state ──
  const [simTimeMs, setSimTimeMs] = useState<number | null>(
    simTimeIso ? new Date(simTimeIso).getTime() : null,
  );
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<SimSpeed>(2);
  const simModeActive = simTimeMs !== null;

  // ── No top overlay anymore — pin the WhereIsCaseyBadge near the top ──
  useEffect(() => {
    document.documentElement.style.setProperty('--casey-badge-top', '16px');
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

  // ── Auto-play: tick simTimeMs forward at the chosen speed ──
  useEffect(() => {
    if (!playing || simTimeMs === null) return;
    const hoursPerTick = speed * (TICK_INTERVAL_MS / 1000);
    const msPerTick = hoursPerTick * 3600 * 1000;
    const id = setInterval(() => {
      setSimTimeMs((prev) => {
        if (prev === null) return prev;
        const next = prev + msPerTick;
        if (next >= TRIP_END_MS) {
          // Reached end of trip — stop the playback and clamp.
          setPlaying(false);
          return TRIP_END_MS;
        }
        return next;
      });
    }, TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [playing, speed, simTimeMs === null]);

  const handleStartSim = useCallback((startMs?: number) => {
    setSimTimeMs(startMs ?? TRIP_START_MS);
    setPlaying(true);
  }, []);

  const handleExitSim = useCallback(() => {
    setSimTimeMs(null);
    setPlaying(false);
    // Reset to server-provided real-time values immediately while polling resumes.
    setLocation(initialLocation);
    setStats(initialStats);
  }, [initialLocation, initialStats]);

  const handleSeek = useCallback((ms: number) => {
    setSimTimeMs(ms);
  }, []);

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
        window.history.replaceState(null, '', url.toString());
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
      window.history.replaceState(null, '', url.toString());
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      if (initialMatchNumber !== undefined) {
        openMatch(initialMatchNumber);
        return;
      }
      const url = new URL(window.location.href);
      const match = url.searchParams.get('match');
      if (match) {
        const n = Number(match);
        if (!Number.isNaN(n)) openMatch(n);
      }
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
      <ControlCluster
        location={location}
        collapsed={dockCollapsed}
        onToggleCollapse={() => setDockCollapsed((c) => !c)}
        onOpenToday={() => { setScheduleTab('live'); setScheduleOpen(true); }}
        onOpenFollowing={() => setFollowingOpen(true)}
        onOpenSchedule={() => { setScheduleTab('schedule'); setScheduleOpen(true); }}
        lastUpdateAt={lastUpdateAt}
        connectionLost={connectionLost}
      />
      <HeroStatsDock
        location={location}
        stats={stats}
        itinerary={itinerary}
        onOpenMatch={openMatch}
        collapsed={dockCollapsed}
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
      {(simModeActive || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('sim'))) ? (
        <TimeTravelPanel
          simTimeMs={simTimeMs}
          playing={playing}
          speed={speed}
          tripStartMs={TRIP_START_MS}
          tripEndMs={TRIP_END_MS}
          onStart={handleStartSim}
          onPause={() => setPlaying(false)}
          onResume={() => setPlaying(true)}
          onSeek={handleSeek}
          onSpeedChange={setSpeed}
          onExit={handleExitSim}
        />
      ) : null}
    </>
  );
}
