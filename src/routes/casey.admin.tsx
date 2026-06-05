import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import AdminLogin from '../casey/components/AdminLogin';
import AdminShell from '../casey/components/AdminShell';
import { SiteNav } from '../components/SiteNav';
import type {
  ItineraryMatch,
  PositionOverride,
  SpendTracker,
  Stadium,
} from '@/lib/types';
import navCss from '../pages/casey.css?url';
import trackerCss from '../pages/casey-tracker.css?url';

export const Route = createFileRoute('/casey/admin')({
  head: () => ({
    meta: [{ title: 'Admin · Casey Tracker' }],
    links: [
      { rel: 'stylesheet', href: navCss },
      { rel: 'stylesheet', href: trackerCss },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap',
      },
    ],
  }),
  component: AdminRoute,
});

interface AdminData {
  authed: boolean;
  itinerary?: ItineraryMatch[];
  stadiums?: Record<string, Stadium>;
  spend?: SpendTracker;
  override?: PositionOverride | null;
  underdogReferral?: string;
}

function AdminRoute() {
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<AdminData | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const load = useCallback(() => {
    fetch('/api/admin/bootstrap', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok) setState(d as AdminData);
      })
      .catch(() => setState({ authed: false }));
  }, []);

  useEffect(() => {
    if (mounted) load();
  }, [mounted, load]);

  if (!mounted || !state) {
    return (
      <>
        <SiteNav active="casey" />
        <div className="casey-shell" style={{ overflowY: 'auto' }}>
          <main className="absolute inset-0 flex items-center justify-center bg-snap-black">
            <div className="font-mono text-[10px] tracking-[0.24em] text-snap-mist">
              loading…
            </div>
          </main>
        </div>
      </>
    );
  }

  if (!state.authed) {
    return (
      <>
        <SiteNav active="casey" />
        <div className="casey-shell" style={{ overflowY: 'auto' }}>
          <AdminLogin onAuthed={load} />
        </div>
      </>
    );
  }

  return (
    <>
      <SiteNav active="casey" />
      <div className="casey-shell" style={{ overflowY: 'auto' }}>
        <AdminShell
          itinerary={state.itinerary!}
          stadiums={state.stadiums!}
          spend={state.spend!}
          override={state.override ?? null}
          underdogReferral={state.underdogReferral ?? ''}
          onRefresh={load}
        />
      </div>
    </>
  );
}
