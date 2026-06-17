import { lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  CaseyLocation,
  ItineraryMatch,
  MatchResult,
  SpendTracker,
  Stadium,
  TripStats,
} from '@/lib/types';

// ClientShell pulls in MapView -> maplibre-gl, which touches `window` at
// import time. Lazy-loading it (and only rendering once bootstrap data has
// resolved — which never happens during SSR) guarantees maplibre never loads
// on the server.
const ClientShell = lazy(() => import('./ClientShell'));

interface BootstrapData {
  location: CaseyLocation;
  stats: TripStats;
  spend: SpendTracker;
  results: Record<number, MatchResult>;
  itinerary: ItineraryMatch[];
  stadiums: Record<string, Stadium>;
  visibility: { showLodging: boolean; showTransport: boolean };
  underdogReferral: string;
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
  // simTime is a dev/sim clock override read from the URL (client-only). It only
  // changes via navigation, so it's stable within a mount and safe in the key.
  const sim =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('simTime')
      : null;

  // Bootstrap is per-request, time-dependent live data (location/stats), so it
  // stays a client fetch — useQuery just replaces the hand-rolled mounted/data/
  // failed state machine and shares the result through the app QueryClient.
  const bootstrap = useQuery({
    queryKey: ['bootstrap', sim],
    queryFn: async (): Promise<BootstrapData> => {
      const url = sim ? `/api/bootstrap?simTime=${encodeURIComponent(sim)}` : '/api/bootstrap';
      const r = await fetch(url, { cache: 'no-store' });
      const d = await r.json();
      if (!d?.ok) throw new Error('bootstrap unavailable');
      return d as BootstrapData;
    },
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const data = bootstrap.data;
  if (!data) {
    return <Splash failed={bootstrap.isError} />;
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
        underdogReferral={data.underdogReferral}
        simTimeIso={data.simTime}
        initialMatchNumber={initialMatchNumber}
      />
    </Suspense>
  );
}
