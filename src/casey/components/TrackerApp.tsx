import { lazy, Suspense, useEffect, useState } from 'react';
import type {
  CaseyLocation,
  ItineraryMatch,
  MatchResult,
  SpendTracker,
  Stadium,
  TripStats,
} from '@/lib/types';

// ClientShell pulls in MapView -> maplibre-gl, which touches `window` at
// import time. Lazy-loading it (and only rendering after mount) guarantees
// maplibre never loads during SSR.
const ClientShell = lazy(() => import('./ClientShell'));

interface BootstrapData {
  location: CaseyLocation;
  stats: TripStats;
  spend: SpendTracker;
  results: Record<number, MatchResult>;
  itinerary: ItineraryMatch[];
  stadiums: Record<string, Stadium>;
  visibility: { showLodging: boolean; showTransport: boolean };
  simTime: string | null;
}

function Splash({ failed = false }: { failed?: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-snap-black">
      <div className="text-center">
        <div className="font-display text-[40px] text-snap-yellow tracking-wide">CASEY TRACKER</div>
        <div className="font-mono text-[10px] tracking-[0.24em] text-snap-mist mt-2">
          {failed ? "can't load right now · refresh in a sec" : 'loading the tracker…'}
        </div>
      </div>
    </div>
  );
}

export default function TrackerApp({ initialMatchNumber }: { initialMatchNumber?: number }) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<BootstrapData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const sim = new URLSearchParams(window.location.search).get('simTime');
    const url = sim ? `/api/bootstrap?simTime=${encodeURIComponent(sim)}` : '/api/bootstrap';
    let cancelled = false;
    fetch(url, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d?.ok) setData(d as BootstrapData);
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [mounted]);

  if (!mounted || !data) {
    return <Splash failed={failed} />;
  }

  return (
    <Suspense fallback={<Splash />}>
      <ClientShell
        initialLocation={data.location}
        initialStats={data.stats}
        initialSpend={data.spend}
        initialResults={data.results}
        itinerary={data.itinerary}
        stadiums={data.stadiums}
        visibility={data.visibility}
        simTimeIso={data.simTime}
        initialMatchNumber={initialMatchNumber}
      />
    </Suspense>
  );
}
