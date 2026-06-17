import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import AdminShell from '../casey/components/AdminShell';
import { SiteNav } from '../components/SiteNav';
import { liveJson } from '@/lib/queries';
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

function CaseyShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteNav active="casey" />
      <div className="casey-shell" style={{ overflowY: 'auto' }}>
        {children}
      </div>
    </>
  );
}

function AdminRoute() {
  // Client-side bootstrap. queryFn throws on transport failure / ok:false so a
  // network blip surfaces as isError (with one retry) — NOT as a false auth denial.
  const q = useQuery({
    queryKey: ['casey', 'admin-bootstrap'],
    queryFn: async () => {
      const d = await liveJson<AdminData & { ok?: boolean }>('/api/admin/bootstrap');
      if (!d?.ok) throw new Error('bootstrap returned not-ok');
      return d;
    },
    retry: 1,
    staleTime: Infinity,
  });
  const state = q.data ?? null;

  if (q.isLoading) {
    return (
      <CaseyShell>
        <main className="absolute inset-0 flex items-center justify-center bg-snap-black">
          <div className="font-mono text-[10px] tracking-[0.24em] text-snap-mist">
            loading…
          </div>
        </main>
      </CaseyShell>
    );
  }

  // A load failure is distinct from an auth denial: offer a retry instead of
  // misreporting an unreachable endpoint as NOT AUTHORIZED.
  if (q.isError || !state) {
    return (
      <CaseyShell>
        <main className="absolute inset-0 flex items-center justify-center bg-snap-black p-6">
          <div className="max-w-sm text-center">
            <div className="font-display text-[40px] leading-none text-snap-yellow">CAN’T LOAD</div>
            <div className="mt-3 font-mono text-[11px] leading-relaxed tracking-[0.18em] text-snap-mist">
              Couldn’t reach the admin data. Check your connection and try again.
            </div>
            <button
              type="button"
              onClick={() => void q.refetch()}
              className="mt-4 border border-snap-yellow/50 bg-snap-yellow/5 text-snap-yellow font-mono text-[11px] tracking-widest px-4 py-2 hover:bg-snap-yellow/15 hover:border-snap-yellow transition-colors"
            >
              ↻ RETRY
            </button>
          </div>
        </main>
      </CaseyShell>
    );
  }

  if (!state.authed) {
    // Behind Cloudflare Access this shouldn't happen (a request that reaches here
    // already passed Access). Shown only if the Access assertion is missing/invalid.
    return (
      <CaseyShell>
        <main className="absolute inset-0 flex items-center justify-center bg-snap-black p-6">
          <div className="max-w-sm text-center">
            <div className="font-display text-[40px] leading-none text-snap-yellow">NOT AUTHORIZED</div>
            <div className="mt-3 font-mono text-[11px] leading-relaxed tracking-[0.18em] text-snap-mist">
              This panel is protected by Cloudflare Access. Sign in with an approved
              Snapback account to continue.
            </div>
          </div>
        </main>
      </CaseyShell>
    );
  }

  return (
    <CaseyShell>
      <AdminShell
        itinerary={state.itinerary!}
        stadiums={state.stadiums!}
        spend={state.spend!}
        override={state.override ?? null}
        underdogReferral={state.underdogReferral ?? ''}
        onRefresh={() => void q.refetch()}
      />
    </CaseyShell>
  );
}
