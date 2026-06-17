import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { liveJson } from '@/lib/queries';
import { Field, inputCls, btnCls, btnDimCls } from './ui';

export function VisibilityTab({
  post,
  initialUnderdogReferral = '',
}: {
  post: (a: string, p: any) => Promise<boolean>;
  initialUnderdogReferral?: string;
}) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['casey', 'visibility'],
    queryFn: () => liveJson<{ showLodging?: boolean; showTransport?: boolean }>('/api/visibility'),
    staleTime: 0,
  });
  const showLodging = Boolean(q.data?.showLodging);
  const showTransport = Boolean(q.data?.showTransport);
  const loaded = !q.isLoading;
  const [saving, setSaving] = useState(false);
  const [underdogUrl, setUnderdogUrl] = useState(initialUnderdogReferral);
  const [savingReferral, setSavingReferral] = useState(false);

  async function save(nextLodging: boolean, nextTransport: boolean) {
    setSaving(true);
    const ok = await post('set-visibility', {
      showLodging: nextLodging,
      showTransport: nextTransport,
    });
    // Reflect the saved state into the query cache (optimistic, server-confirmed).
    if (ok) qc.setQueryData(['casey', 'visibility'], { showLodging: nextLodging, showTransport: nextTransport });
    setSaving(false);
  }

  async function saveReferral() {
    setSavingReferral(true);
    await post('set-underdog-referral', { url: underdogUrl.trim() });
    setSavingReferral(false);
  }

  if (!loaded) {
    return <div className="font-mono text-[11px] text-snap-mist py-6">loading visibility…</div>;
  }

  const bothOn = showLodging && showTransport;
  const anyOn = showLodging || showTransport;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="border border-snap-ash bg-snap-coal p-4">
        <div className="font-display text-[20px] text-snap-chalk">TRIP DETAIL VISIBILITY</div>
        <p className="font-body text-[13px] text-snap-mist mt-2 leading-relaxed">
          Controls whether lodging (hotel/host names) and transport details (flight vs. train) are
          shown on the public match cards. When both are <strong>OFF</strong>, the
          &quot;Trip Details&quot; button does not appear and the sensitive fields are stripped
          server-side before reaching the public client. Default: both off.
        </p>
        <div className="mt-3 border-l-2 border-snap-yellow bg-snap-yellow/5 px-3 py-2 font-mono text-[10px] tracking-[0.15em] text-snap-yellow">
          CURRENT STATE: {bothOn ? 'BOTH VISIBLE' : anyOn ? 'PARTIAL' : 'ALL HIDDEN'}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ToggleRow
          label="LODGING"
          desc="Hotel names + host residences (friends/family). Hide unless Snapback approved sharing host names."
          on={showLodging}
          saving={saving}
          onToggle={() => save(!showLodging, showTransport)}
        />
        <ToggleRow
          label="TRANSPORT"
          desc="Flight vs. train inbound. Less sensitive but still operational detail about Casey's moves."
          on={showTransport}
          saving={saving}
          onToggle={() => save(showLodging, !showTransport)}
        />
      </div>

      <div className="border border-snap-ash bg-snap-coal p-4">
        <div className="font-mono text-[10px] tracking-[0.18em] text-snap-mist mb-2">
          BULK CONTROL
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => save(true, true)}
            disabled={saving || bothOn}
            className={btnCls + ' w-full disabled:opacity-40'}
          >
            ENABLE BOTH
          </button>
          <button
            type="button"
            onClick={() => save(false, false)}
            disabled={saving || (!showLodging && !showTransport)}
            className={btnDimCls + ' w-full disabled:opacity-40'}
          >
            HIDE BOTH
          </button>
        </div>
      </div>

      <div className="font-mono text-[10px] text-snap-fog leading-relaxed">
        Changes apply on the next page load for public visitors. Disabled fields never reach the
        client bundle — they&apos;re stripped at the server-side boundary.
      </div>

      {/* Underdog referral link — global, shown on all bet panels */}
      <div className="border border-snap-ash bg-snap-coal p-4">
        <div className="font-display text-[20px] text-snap-chalk">UNDERDOG REFERRAL LINK</div>
        <p className="font-body text-[13px] text-snap-mist mt-2 leading-relaxed">
          Global referral URL shown on every &quot;CASEY&apos;S BETS&quot; panel after the bet slip image.
          Leave blank to fall back to <span className="font-mono text-snap-fog">underdogfantasy.com</span>.
        </p>
        <div className="mt-3 space-y-2">
          <Field label="Underdog referral URL">
            <input
              className={inputCls}
              value={underdogUrl}
              onChange={(e) => setUnderdogUrl(e.target.value)}
              placeholder="https://underdogfantasy.com/refer/..."
            />
          </Field>
          <div className="flex gap-2">
            <button
              type="button"
              className={btnCls}
              disabled={savingReferral}
              onClick={saveReferral}
            >
              {savingReferral ? 'SAVING…' : 'SAVE REFERRAL'}
            </button>
            <button
              type="button"
              className={btnDimCls}
              disabled={!underdogUrl || savingReferral}
              onClick={() => setUnderdogUrl('')}
            >
              CLEAR
            </button>
          </div>
          <div className="font-mono text-[9px] tracking-[0.15em] text-snap-fog">
            code shown below the link: <span className="text-snap-mist">TKALINOWSKI12</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  desc,
  on,
  saving,
  onToggle,
}: {
  label: string;
  desc: string;
  on: boolean;
  saving: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`border p-4 transition-colors ${
        on ? 'border-snap-yellow bg-snap-yellow/5' : 'border-snap-ash bg-snap-coal'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="font-mono text-[11px] tracking-[0.2em] text-snap-chalk">{label}</div>
        <button
          type="button"
          onClick={onToggle}
          disabled={saving}
          className={`relative h-6 w-11 transition-colors disabled:opacity-50 ${
            on ? 'bg-snap-yellow' : 'bg-snap-ash'
          }`}
          aria-pressed={on}
          aria-label={`Toggle ${label}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 bg-snap-black transition-transform ${
              on ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
      <div className="font-body text-[12px] text-snap-mist mt-2 leading-relaxed">{desc}</div>
      <div className="mt-2 font-mono text-[10px] tracking-[0.15em] text-snap-fog">
        {on ? '● VISIBLE TO PUBLIC' : '○ HIDDEN'}
      </div>
    </div>
  );
}

