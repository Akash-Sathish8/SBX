import { useState } from 'react';
import SnapbackLogo from './SnapbackLogo';
import type { ItineraryMatch, PositionOverride, SpendTracker, Stadium } from '@/lib/types';
import { btnDimCls } from './admin/ui';
import { MatchesTab } from './admin/MatchesTab';
import { StadiumsTab } from './admin/StadiumsTab';
import { PositionTab } from './admin/PositionTab';
import { SpendTab } from './admin/SpendTab';
import { VisibilityTab } from './admin/VisibilityTab';
import { AttentionTab } from './admin/AttentionTab';
import { HealthTab } from './admin/HealthTab';

interface Props {
  itinerary: ItineraryMatch[];
  spend: SpendTracker;
  override: PositionOverride | null;
  stadiums: Record<string, Stadium>;
  underdogReferral: string;
  onRefresh: () => void;
}

type Tab = 'attention' | 'matches' | 'stadiums' | 'position' | 'spend' | 'visibility' | 'health';

export default function AdminShell({ itinerary, spend, override, stadiums, underdogReferral, onRefresh }: Props) {
  const [tab, setTab] = useState<Tab>('attention');
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  // Set by the Attention tab's "OPEN #N" button so the Matches tab opens that
  // match's editor on entry. Cleared on any manual tab click.
  const [jumpMatch, setJumpMatch] = useState<number | null>(null);

  async function post(action: string, payload: any): Promise<boolean> {
    try {
      const res = await fetch('/api/admin/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setToast({ kind: 'err', text: data.error ?? 'Save failed' });
        setTimeout(() => setToast(null), 3000);
        return false;
      }
      setToast({ kind: 'ok', text: 'Saved' });
      setTimeout(() => setToast(null), 2000);
      onRefresh();
      return true;
    } catch (err) {
      setToast({ kind: 'err', text: (err as Error).message });
      setTimeout(() => setToast(null), 3000);
      return false;
    }
  }

  function logout() {
    // Auth is Cloudflare Access now (no app cookie) — log out of the Access session.
    window.location.href = '/cdn-cgi/access/logout';
  }

  return (
    <div className="absolute inset-0 overflow-y-auto bg-snap-black text-snap-chalk">
      <header className="sticky top-0 z-20 border-b border-snap-ash bg-snap-black/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <SnapbackLogo size={32} />
            <div className="leading-none">
              <div className="font-display text-[22px]">CASEY TRACKER · ADMIN</div>
              <div className="font-mono text-[9px] tracking-[0.18em] text-snap-mist mt-0.5">
                CONTROL PANEL
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" className={btnDimCls}>
              ← TRACKER
            </a>
            <button type="button" onClick={logout} className={btnDimCls}>
              LOGOUT
            </button>
          </div>
        </div>
        <div className="flex border-t border-snap-ash">
          {(['attention', 'matches', 'stadiums', 'position', 'spend', 'visibility', 'health'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setTab(t); setJumpMatch(null); }}
              className={`flex-1 sm:flex-none px-5 py-2 font-mono text-[11px] tracking-[0.18em] transition-colors ${
                tab === t
                  ? 'bg-snap-yellow text-snap-black'
                  : 'text-snap-mist hover:text-snap-chalk'
              }`}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      <main className="px-4 py-5 sm:px-6 sm:py-6 max-w-5xl mx-auto">
        {tab === 'matches' && (
          <MatchesTab itinerary={itinerary} stadiums={stadiums} post={post} initialOpenId={jumpMatch} />
        )}
        {tab === 'stadiums' && <StadiumsTab stadiums={stadiums} post={post} />}
        {tab === 'position' && (
          <PositionTab override={override} stadiums={stadiums} post={post} />
        )}
        {tab === 'spend' && <SpendTab spend={spend} post={post} />}
        {tab === 'visibility' && <VisibilityTab post={post} initialUnderdogReferral={underdogReferral} />}
        {tab === 'attention' && <AttentionTab onJumpToMatch={(n) => { setJumpMatch(n); setTab('matches'); }} />}
        {tab === 'health' && <HealthTab />}
      </main>

      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-30 border px-4 py-2 font-mono text-xs tracking-widest ${
            toast.kind === 'ok'
              ? 'border-snap-yellow bg-snap-yellow/10 text-snap-yellow'
              : 'border-live bg-live/10 text-live'
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

