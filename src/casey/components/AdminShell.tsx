
import { useEffect, useMemo, useRef, useState } from 'react';
import SnapbackLogo from './SnapbackLogo';
import { resizeImageToDataUrl, estimateDataUrlBytes } from '@/lib/image';
import type {
  ItineraryMatch,
  MatchStatus,
  PositionOverride,
  SpendTracker,
  Stadium,
} from '@/lib/types';

interface Props {
  itinerary: ItineraryMatch[];
  spend: SpendTracker;
  override: PositionOverride | null;
  stadiums: Record<string, Stadium>;
  underdogReferral: string;
  onRefresh: () => void;
}

type Tab = 'attention' | 'matches' | 'stadiums' | 'position' | 'spend' | 'visibility' | 'health';

const inputCls =
  'w-full bg-snap-black border border-snap-ash px-2 py-1.5 font-mono text-xs text-snap-chalk focus:outline-none focus:border-snap-yellow';
const btnCls =
  'bg-snap-yellow text-snap-black font-mono text-xs tracking-widest px-4 py-2 hover:bg-snap-yellowDim transition-colors disabled:opacity-50';
const btnDimCls =
  'border border-snap-yellow/50 bg-snap-yellow/5 text-snap-yellow font-mono text-xs tracking-widest px-4 py-2 hover:bg-snap-yellow/15 hover:border-snap-yellow transition-colors';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-[9px] tracking-[0.18em] text-snap-mist uppercase block mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

export default function AdminShell({ itinerary, spend, override, stadiums, underdogReferral, onRefresh }: Props) {
  const [tab, setTab] = useState<Tab>('attention');
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

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
              onClick={() => setTab(t)}
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
          <MatchesTab itinerary={itinerary} stadiums={stadiums} post={post} />
        )}
        {tab === 'stadiums' && <StadiumsTab stadiums={stadiums} post={post} />}
        {tab === 'position' && (
          <PositionTab override={override} stadiums={stadiums} post={post} />
        )}
        {tab === 'spend' && <SpendTab spend={spend} post={post} />}
        {tab === 'visibility' && <VisibilityTab post={post} initialUnderdogReferral={underdogReferral} />}
        {tab === 'attention' && <AttentionTab onJumpToMatch={(n) => { setTab('matches'); /* match editor opens by ID */ void n; }} />}
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

function MatchesTab({
  itinerary,
  stadiums,
  post,
}: {
  itinerary: ItineraryMatch[];
  stadiums: Record<string, Stadium>;
  post: (a: string, p: any) => Promise<boolean>;
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between mb-2">
        <div className="font-mono text-[10px] tracking-[0.18em] text-snap-mist">
          {itinerary.length} MATCHES
        </div>
        <button type="button" onClick={() => setBulkOpen(true)} className={btnDimCls}>
          ≡ BULK RESULTS
        </button>
      </div>
      {bulkOpen && (
        <BulkResultsModal
          itinerary={itinerary}
          post={post}
          onClose={() => setBulkOpen(false)}
        />
      )}
      {itinerary.map((m) => {
        const isOpen = openId === m.matchNumber;
        return (
          <div key={m.matchNumber} className="border border-snap-ash bg-snap-coal">
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : m.matchNumber)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-snap-smoke/50 transition-colors"
            >
              <span className="font-mono text-[10px] text-snap-yellow tracking-[0.15em] w-9">
                #{m.matchNumber}
              </span>
              <span className="font-mono text-[10px] text-snap-mist w-20">{m.date}</span>
              <span className="font-display text-[15px] text-snap-chalk flex-1">{m.match}</span>
              <span className="font-mono text-[10px] text-snap-mist hidden sm:block">
                {stadiums[m.stadiumId]?.city ?? m.stadiumId}
              </span>
              <span className="text-snap-mist">{isOpen ? '−' : '+'}</span>
            </button>
            {isOpen && (
              <MatchEditor match={m} stadiums={stadiums} post={post} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function MatchEditor({
  match,
  stadiums,
  post,
}: {
  match: ItineraryMatch;
  stadiums: Record<string, Stadium>;
  post: (a: string, p: any) => Promise<boolean>;
}) {
  const [fields, setFields] = useState({
    match: match.match,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    stadiumId: match.stadiumId,
    kickoffLocal: match.kickoffLocal,
    kickoffTZ: match.kickoffTZ,
    sleepCity: match.sleepCity,
    sleepLat: match.sleepLat,
    sleepLng: match.sleepLng,
    notes: match.notes ?? '',
    agenda: match.agenda ?? '',
  });
  const [betSlipImage, setBetSlipImage] = useState(match.betSlipImage ?? '');
  const [betSlipProcessing, setBetSlipProcessing] = useState(false);
  const [betSlipErr, setBetSlipErr] = useState<string | null>(null);
  const betSlipFileRef = useRef<HTMLInputElement>(null);

  async function handleBetSlipFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBetSlipErr(null);
    setBetSlipProcessing(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file, {
        maxWidth: 1400,
        maxHeight: 1800,
        quality: 0.78,
      });
      const bytes = estimateDataUrlBytes(dataUrl);
      if (bytes > 3_000_000) {
        setBetSlipErr(`image still ${(bytes / 1024 / 1024).toFixed(1)} MB after resize — try a smaller photo`);
        return;
      }
      setBetSlipImage(dataUrl);
    } catch (err) {
      setBetSlipErr((err as Error).message);
    } finally {
      setBetSlipProcessing(false);
      if (betSlipFileRef.current) betSlipFileRef.current.value = '';
    }
  }

  const [result, setResult] = useState({
    homeScore: match.result?.homeScore ?? null,
    awayScore: match.result?.awayScore ?? null,
    status: (match.result?.status ?? 'scheduled') as MatchStatus,
    notes: match.result?.notes ?? '',
  });
  const [ytId, setYtId] = useState(match.youtubeId ?? '');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-4 border-t border-snap-ash">
      <section>
        <h3 className="font-mono text-[10px] tracking-[0.18em] text-snap-yellow mb-3">
          MATCH DETAILS
        </h3>
        <div className="space-y-3">
          <Field label="Match name">
            <input
              className={inputCls}
              value={fields.match}
              onChange={(e) => setFields({ ...fields, match: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Home team">
              <input
                className={inputCls}
                value={fields.homeTeam}
                onChange={(e) => setFields({ ...fields, homeTeam: e.target.value })}
              />
            </Field>
            <Field label="Away team">
              <input
                className={inputCls}
                value={fields.awayTeam}
                onChange={(e) => setFields({ ...fields, awayTeam: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Stadium">
            <select
              className={inputCls}
              value={fields.stadiumId}
              onChange={(e) => setFields({ ...fields, stadiumId: e.target.value })}
            >
              {Object.values(stadiums).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.city}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Kickoff (local)">
              <input
                className={inputCls}
                value={fields.kickoffLocal}
                onChange={(e) => setFields({ ...fields, kickoffLocal: e.target.value })}
                placeholder="2026-06-11T15:00:00"
              />
            </Field>
            <Field label="Timezone (IANA)">
              <input
                className={inputCls}
                value={fields.kickoffTZ}
                onChange={(e) => setFields({ ...fields, kickoffTZ: e.target.value })}
                placeholder="America/New_York"
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Sleep city">
              <input
                className={inputCls}
                value={fields.sleepCity}
                onChange={(e) => setFields({ ...fields, sleepCity: e.target.value })}
              />
            </Field>
            <Field label="Sleep lat">
              <input
                className={inputCls}
                type="number"
                onWheel={(e) => e.currentTarget.blur()}
                step="any"
                value={fields.sleepLat}
                onChange={(e) =>
                  setFields({ ...fields, sleepLat: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Sleep lng">
              <input
                className={inputCls}
                type="number"
                onWheel={(e) => e.currentTarget.blur()}
                step="any"
                value={fields.sleepLng}
                onChange={(e) =>
                  setFields({ ...fields, sleepLng: Number(e.target.value) })
                }
              />
            </Field>
          </div>
          <Field label="Notes">
            <textarea
              className={`${inputCls} h-14 resize-none`}
              value={fields.notes}
              onChange={(e) => setFields({ ...fields, notes: e.target.value })}
            />
          </Field>
          <Field label="Gameday agenda (natural language — shown as cards in CASEY'S AGENDA)">
            <textarea
              className={`${inputCls} h-28 resize-none`}
              value={fields.agenda}
              onChange={(e) => setFields({ ...fields, agenda: e.target.value })}
              placeholder={'One item per line works best, e.g.\n9am — land in Mexico City\nbreakfast at the hotel\n2pm — stadium tour\n5pm — kickoff'}
            />
          </Field>
          <button
            type="button"
            className={btnCls}
            onClick={() =>
              post('set-match-fields', {
                matchNumber: match.matchNumber,
                fields: {
                  ...fields,
                  notes: fields.notes || null,
                  agenda: fields.agenda || null,
                },
              })
            }
          >
            SAVE DETAILS
          </button>
        </div>
      </section>

      <section>
        <h3 className="font-mono text-[10px] tracking-[0.18em] text-snap-yellow mb-3">
          RESULT & YOUTUBE
        </h3>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Field label="Home score">
              <input
                className={inputCls}
                type="number"
                onWheel={(e) => e.currentTarget.blur()}
                value={result.homeScore ?? ''}
                onChange={(e) =>
                  setResult({
                    ...result,
                    homeScore: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field label="Away score">
              <input
                className={inputCls}
                type="number"
                onWheel={(e) => e.currentTarget.blur()}
                value={result.awayScore ?? ''}
                onChange={(e) =>
                  setResult({
                    ...result,
                    awayScore: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field label="Status">
              <select
                className={inputCls}
                value={result.status}
                onChange={(e) =>
                  setResult({ ...result, status: e.target.value as MatchStatus })
                }
              >
                <option value="scheduled">scheduled</option>
                <option value="live">live</option>
                <option value="final">final</option>
                <option value="postponed">postponed</option>
                <option value="cancelled">cancelled</option>
              </select>
            </Field>
          </div>
          <Field label="Result notes (e.g. 5-3 pens after 1-1)">
            <input
              className={inputCls}
              value={result.notes ?? ''}
              onChange={(e) => setResult({ ...result, notes: e.target.value })}
            />
          </Field>
          <button
            type="button"
            className={btnCls}
            onClick={() =>
              post('set-result', {
                matchNumber: match.matchNumber,
                result: {
                  homeScore: result.homeScore,
                  awayScore: result.awayScore,
                  status: result.status,
                  notes: result.notes || null,
                },
              })
            }
          >
            SAVE RESULT
          </button>

          <div className="pt-3 border-t border-snap-ash">
            <Field label="YouTube ID (e.g. dQw4w9WgXcQ)">
              <input
                className={inputCls}
                value={ytId}
                onChange={(e) => setYtId(e.target.value)}
                placeholder="dQw4w9WgXcQ"
              />
            </Field>
            <button
              type="button"
              className={`${btnCls} mt-3`}
              onClick={() =>
                post('set-youtube', {
                  matchNumber: match.matchNumber,
                  youtubeId: ytId,
                })
              }
            >
              SAVE YOUTUBE
            </button>
          </div>

          <div className="pt-3 border-t border-snap-ash">
            <h3 className="font-mono text-[10px] tracking-[0.18em] text-snap-yellow mb-3">
              BET SLIP IMAGE
            </h3>
            <div className="flex gap-2 flex-wrap items-start">
              {betSlipImage && (
                <img
                  src={betSlipImage}
                  alt="Bet slip preview"
                  className="h-20 w-auto border border-snap-ash flex-shrink-0 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
            </div>
            <div className="mt-2 flex gap-2 flex-wrap">
              <input
                ref={betSlipFileRef}
                type="file"
                accept="image/*"
                onChange={handleBetSlipFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => betSlipFileRef.current?.click()}
                disabled={betSlipProcessing}
                className={btnDimCls + ' disabled:opacity-50'}
              >
                {betSlipProcessing ? 'PROCESSING…' : '↑ UPLOAD SLIP'}
              </button>
              <button
                type="button"
                onClick={() => { setBetSlipImage(''); setBetSlipErr(null); }}
                disabled={!betSlipImage || betSlipProcessing}
                className={btnDimCls + ' disabled:opacity-30'}
              >
                CLEAR
              </button>
              <button
                type="button"
                className={btnCls}
                disabled={betSlipProcessing}
                onClick={() =>
                  post('set-match-fields', {
                    matchNumber: match.matchNumber,
                    fields: { betSlipImage: betSlipImage || '' },
                  })
                }
              >
                SAVE SLIP
              </button>
            </div>
            {betSlipErr && (
              <div className="mt-2 px-2 py-1 bg-live/10 border-l-2 border-live font-mono text-[10px] text-live">
                {betSlipErr}
              </div>
            )}
            <div className="mt-2 font-mono text-[9px] tracking-[0.15em] text-snap-fog">
              shown in the &quot;CASEY&apos;S BETS&quot; panel on the public stadium card.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function StadiumsTab({
  stadiums,
  post,
}: {
  stadiums: Record<string, Stadium>;
  post: (a: string, p: any) => Promise<boolean>;
}) {
  return (
    <div className="max-w-3xl">
      <div className="font-mono text-[10px] tracking-[0.18em] text-snap-mist mb-3 leading-relaxed">
        Upload a photo from your phone, OR paste a direct image URL.
        <br />
        <span className="text-snap-fog">
          For URLs: must be a direct image link (ends in .jpg/.png/.webp), not
          a Wikipedia article page. Right-click the image on the article and
          choose &quot;Copy image address&quot;.
        </span>
      </div>
      <div className="space-y-2">
        {Object.values(stadiums).map((s) => (
          <StadiumRow key={s.id} stadium={s} post={post} />
        ))}
      </div>
    </div>
  );
}

function StadiumRow({
  stadium,
  post,
}: {
  stadium: Stadium;
  post: (a: string, p: any) => Promise<boolean>;
}) {
  const [url, setUrl] = useState(stadium.heroImage ?? '');
  const [processing, setProcessing] = useState(false);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileErr(null);
    setProcessing(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file, {
        maxWidth: 1400,
        maxHeight: 900,
        quality: 0.78,
      });
      const bytes = estimateDataUrlBytes(dataUrl);
      // Vercel function body limit is ~4.5 MB. Bail safely before we
      // hit that, since the server-side error message is opaque.
      if (bytes > 3_000_000) {
        setFileErr(
          `image still ${(bytes / 1024 / 1024).toFixed(1)} MB after resize — try a smaller photo`,
        );
        return;
      }
      setUrl(dataUrl);
    } catch (err) {
      setFileErr((err as Error).message);
    } finally {
      setProcessing(false);
      // Reset so the same file can be picked again if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const isUrlLikelyBad =
    url.length > 0 &&
    !url.startsWith('data:') &&
    (/\/wiki\//i.test(url) || /#\/media\//i.test(url));

  return (
    <div className="border border-snap-ash bg-snap-coal p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-[16px] text-snap-chalk truncate">
            {stadium.name}
          </div>
          <div className="font-mono text-[10px] text-snap-mist">
            {stadium.city}
            {stadium.state ? `, ${stadium.state}` : ''} · {stadium.country}
          </div>
        </div>
        {url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            className="h-12 w-20 object-cover border border-snap-ash flex-shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
      </div>

      <div className="mt-2 flex gap-2 flex-wrap">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={processing}
          className={btnDimCls + ' disabled:opacity-50'}
        >
          {processing ? 'PROCESSING…' : '↑ UPLOAD PHOTO'}
        </button>
        <button
          type="button"
          onClick={() => {
            setUrl('');
            setFileErr(null);
          }}
          disabled={!url || processing}
          className={btnDimCls + ' disabled:opacity-30'}
        >
          CLEAR
        </button>
        <button
          type="button"
          className={btnCls}
          disabled={processing}
          onClick={() =>
            post('set-stadium-hero', { stadiumId: stadium.id, heroImage: url || '' })
          }
        >
          SAVE
        </button>
      </div>

      <div className="mt-2 flex gap-2">
        <input
          className={`${inputCls} flex-1 font-mono text-[10px]`}
          value={url.startsWith('data:') ? '[uploaded photo — saved on server]' : url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="…or paste https://upload.wikimedia.org/wikipedia/commons/..."
          readOnly={url.startsWith('data:')}
        />
      </div>

      {isUrlLikelyBad && (
        <div className="mt-2 px-2 py-1 bg-live/10 border-l-2 border-live font-mono text-[10px] text-live leading-relaxed">
          that looks like a wikipedia <strong>article</strong> URL — saving it
          won&apos;t show an image. either upload a photo above, or right-click
          the image on wikipedia and choose &quot;copy image address&quot; to get
          the direct link.
        </div>
      )}

      {fileErr && (
        <div className="mt-2 px-2 py-1 bg-live/10 border-l-2 border-live font-mono text-[10px] text-live">
          {fileErr}
        </div>
      )}
    </div>
  );
}

function PositionTab({
  override,
  stadiums,
  post,
}: {
  override: PositionOverride | null;
  stadiums: Record<string, Stadium>;
  post: (a: string, p: any) => Promise<boolean>;
}) {
  const [active, setActive] = useState(override?.active ?? false);
  const [mode, setMode] = useState<'stadium' | 'coords'>(
    override?.stadiumId ? 'stadium' : 'coords',
  );
  const stadiumIds = Object.keys(stadiums);
  const [stadiumId, setStadiumId] = useState(
    override?.stadiumId ?? stadiumIds[0] ?? '',
  );
  const [lat, setLat] = useState(override?.lat ?? 40.7128);
  const [lng, setLng] = useState(override?.lng ?? -74.006);
  const [description, setDescription] = useState(override?.description ?? '');
  const [startsAt, setStartsAt] = useState(override?.startsAt ?? '');
  const [expiresAt, setExpiresAt] = useState(override?.expiresAt ?? '');

  return (
    <div className="max-w-xl border border-snap-ash bg-snap-coal p-5">
      <h2 className="font-display text-[22px] text-snap-chalk">POSITION OVERRIDE</h2>
      <p className="font-mono text-[10px] tracking-[0.15em] text-snap-mist mt-1">
        Forces Casey's marker. Use when reality diverges from the schedule.
      </p>

      <label className="flex items-center gap-2 mt-5">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="accent-snap-yellow"
        />
        <span className="font-mono text-xs tracking-widest text-snap-chalk">
          OVERRIDE ACTIVE
        </span>
      </label>

      <div className="mt-4 inline-flex border border-snap-ash">
        {(['stadium', 'coords'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 font-mono text-[10px] tracking-widest ${
              mode === m ? 'bg-snap-yellow text-snap-black' : 'text-snap-mist'
            }`}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {mode === 'stadium' ? (
          <Field label="Stadium">
            <select
              className={inputCls}
              value={stadiumId}
              onChange={(e) => setStadiumId(e.target.value)}
            >
              {Object.values(stadiums).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.city}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Lat">
              <input
                className={inputCls}
                type="number"
                onWheel={(e) => e.currentTarget.blur()}
                step="any"
                value={lat}
                onChange={(e) => setLat(Number(e.target.value))}
              />
            </Field>
            <Field label="Lng">
              <input
                className={inputCls}
                type="number"
                onWheel={(e) => e.currentTarget.blur()}
                step="any"
                value={lng}
                onChange={(e) => setLng(Number(e.target.value))}
              />
            </Field>
          </div>
        )}
        <Field label="Description (optional)">
          <input
            className={inputCls}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="At JFK · Awaiting flight to LAX"
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Starts at (ISO, optional)">
            <input
              className={inputCls}
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              placeholder="2026-06-12T01:00:00Z"
            />
          </Field>
          <Field label="Expires at (ISO, optional)">
            <input
              className={inputCls}
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              placeholder="2026-06-12T03:00:00Z"
            />
          </Field>
        </div>
        <div className="font-mono text-[9px] tracking-[0.18em] text-snap-mist">
          Leave starts-at blank for instant. Both accept ISO datetime (UTC with Z, or local with offset).
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          className={btnCls}
          onClick={() =>
            post('set-position-override', {
              active,
              ...(mode === 'stadium' ? { stadiumId } : { lat, lng }),
              description: description || undefined,
              startsAt: startsAt || undefined,
              expiresAt: expiresAt || undefined,
            })
          }
        >
          SAVE OVERRIDE
        </button>
        <button
          type="button"
          className={btnDimCls}
          onClick={() => post('clear-position-override', {})}
        >
          CLEAR
        </button>
      </div>
    </div>
  );
}

interface ParsedBulk {
  matchNumber: number;
  homeScore: number;
  awayScore: number;
  status: MatchStatus;
  notes: string | null;
  raw: string;
  warning?: string;
}

function parseBulk(text: string, knownNumbers: Set<number>): ParsedBulk[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.map((raw): ParsedBulk => {
    const m = raw.match(
      /^(\d+)\s+(\d+)\s*[-–:]\s*(\d+)(?:\s+(scheduled|live|final|postponed|cancelled))?(?:\s+(.+))?$/i,
    );
    if (!m) {
      return {
        matchNumber: 0,
        homeScore: 0,
        awayScore: 0,
        status: 'final',
        notes: null,
        raw,
        warning: 'Cannot parse line',
      };
    }
    const [, num, hs, as, status, notes] = m;
    const matchNumber = Number(num);
    return {
      matchNumber,
      homeScore: Number(hs),
      awayScore: Number(as),
      status: (status?.toLowerCase() as MatchStatus) ?? 'final',
      notes: notes?.trim() || null,
      raw,
      warning: knownNumbers.has(matchNumber) ? undefined : `Match #${matchNumber} not in itinerary`,
    };
  });
}

function BulkResultsModal({
  itinerary,
  post,
  onClose,
}: {
  itinerary: ItineraryMatch[];
  post: (a: string, p: any) => Promise<boolean>;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const knownNumbers = useMemo(
    () => new Set(itinerary.map((m) => m.matchNumber)),
    [itinerary],
  );
  const parsed = useMemo(() => parseBulk(text, knownNumbers), [text, knownNumbers]);
  const valid = parsed.filter((p) => !p.warning && p.matchNumber > 0);

  async function save() {
    setSaving(true);
    const entries = valid.map((p) => ({
      matchNumber: p.matchNumber,
      result: {
        homeScore: p.homeScore,
        awayScore: p.awayScore,
        status: p.status,
        notes: p.notes,
      },
    }));
    const ok = await post('bulk-set-results', { entries });
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-xl border border-snap-ash bg-snap-coal p-5 max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-[24px]">BULK RESULTS</h3>
          <button type="button" onClick={onClose} className="text-snap-mist hover:text-snap-yellow">
            ✕
          </button>
        </div>
        <p className="font-mono text-[10px] tracking-[0.15em] text-snap-mist mt-2">
          One match per line: <span className="text-snap-yellow">#</span>{' '}
          <span className="text-snap-yellow">home-away</span>{' '}
          <span className="text-snap-yellow">[status]</span>{' '}
          <span className="text-snap-yellow">[notes]</span>
        </p>
        <pre className="font-mono text-[10px] text-snap-mist mt-2 bg-snap-black border border-snap-ash p-2">{`1 2-1 final
2 0-0 final
3 3-2 final 5-3 pens after extra time
5 1-1 live`}</pre>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          className={`${inputCls} mt-3 font-mono`}
          placeholder="Paste results here..."
        />
        {parsed.length > 0 && (
          <div className="mt-3 border border-snap-ash">
            <div className="px-3 py-2 font-mono text-[10px] tracking-[0.18em] text-snap-mist border-b border-snap-ash">
              PREVIEW · {valid.length} / {parsed.length} VALID
            </div>
            <div className="divide-y divide-snap-ash">
              {parsed.map((p, i) => (
                <div
                  key={i}
                  className={`px-3 py-1.5 flex items-center justify-between gap-3 font-mono text-[11px] ${
                    p.warning ? 'text-live' : 'text-snap-chalk'
                  }`}
                >
                  <span className="truncate">{p.raw}</span>
                  {p.warning ? (
                    <span className="text-live text-[10px]">⚠ {p.warning}</span>
                  ) : (
                    <span className="text-snap-yellow">
                      #{p.matchNumber} → {p.homeScore}-{p.awayScore} · {p.status}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4 flex gap-2 justify-end">
          <button type="button" onClick={onClose} className={btnDimCls}>
            CANCEL
          </button>
          <button
            type="button"
            disabled={saving || valid.length === 0}
            onClick={save}
            className={btnCls}
          >
            {saving ? 'SAVING…' : `SAVE ${valid.length} RESULTS`}
          </button>
        </div>
      </div>
    </div>
  );
}

function SpendTab({
  spend,
  post,
}: {
  spend: SpendTracker;
  post: (a: string, p: any) => Promise<boolean>;
}) {
  const [s, setS] = useState(spend);
  const upd = (k: keyof SpendTracker, v: number) => setS((cur) => ({ ...cur, [k]: v }));

  return (
    <div className="max-w-xl border border-snap-ash bg-snap-coal p-5">
      <h2 className="font-display text-[22px] text-snap-chalk">SPEND</h2>
      <p className="font-mono text-[10px] tracking-[0.15em] text-snap-mist mt-1">
        Budget total $68,263 — $17,500 travel booked, $38,763 tickets projected, $12,000 incidentals.
      </p>

      <div className="mt-5 space-y-3">
        <Field label="Budget total">
          <input
            className={inputCls}
            type="number"
            onWheel={(e) => e.currentTarget.blur()}
            value={s.budgetTotal}
            onChange={(e) => upd('budgetTotal', Number(e.target.value))}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Travel budget">
            <input
              className={inputCls}
              type="number"
              onWheel={(e) => e.currentTarget.blur()}
              value={s.travelBudget}
              onChange={(e) => upd('travelBudget', Number(e.target.value))}
            />
          </Field>
          <Field label="Travel actual">
            <input
              className={inputCls}
              type="number"
              onWheel={(e) => e.currentTarget.blur()}
              value={s.travelActual}
              onChange={(e) => upd('travelActual', Number(e.target.value))}
            />
          </Field>
          <Field label="Tickets budget">
            <input
              className={inputCls}
              type="number"
              onWheel={(e) => e.currentTarget.blur()}
              value={s.ticketsBudget}
              onChange={(e) => upd('ticketsBudget', Number(e.target.value))}
            />
          </Field>
          <Field label="Tickets actual">
            <input
              className={inputCls}
              type="number"
              onWheel={(e) => e.currentTarget.blur()}
              value={s.ticketsActual}
              onChange={(e) => upd('ticketsActual', Number(e.target.value))}
            />
          </Field>
          <Field label="Incidentals budget">
            <input
              className={inputCls}
              type="number"
              onWheel={(e) => e.currentTarget.blur()}
              value={s.incidentalsBudget}
              onChange={(e) => upd('incidentalsBudget', Number(e.target.value))}
            />
          </Field>
          <Field label="Incidentals actual">
            <input
              className={inputCls}
              type="number"
              onWheel={(e) => e.currentTarget.blur()}
              value={s.incidentalsActual}
              onChange={(e) => upd('incidentalsActual', Number(e.target.value))}
            />
          </Field>
        </div>

        <button
          type="button"
          className={`${btnCls} w-full mt-2`}
          onClick={() => post('set-spend', s)}
        >
          SAVE SPEND
        </button>
      </div>
    </div>
  );
}

function VisibilityTab({
  post,
  initialUnderdogReferral = '',
}: {
  post: (a: string, p: any) => Promise<boolean>;
  initialUnderdogReferral?: string;
}) {
  const [showLodging, setShowLodging] = useState(false);
  const [showTransport, setShowTransport] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [underdogUrl, setUnderdogUrl] = useState(initialUnderdogReferral);
  const [savingReferral, setSavingReferral] = useState(false);

  useEffect(() => {
    fetch('/api/visibility', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setShowLodging(Boolean(d.showLodging));
        setShowTransport(Boolean(d.showTransport));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function save(nextLodging: boolean, nextTransport: boolean) {
    setSaving(true);
    const ok = await post('set-visibility', {
      showLodging: nextLodging,
      showTransport: nextTransport,
    });
    if (ok) {
      setShowLodging(nextLodging);
      setShowTransport(nextTransport);
    }
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

// ────────────────────────────────────────────────────────────────────────
// ATTENTION TAB
// ────────────────────────────────────────────────────────────────────────

interface AttentionItem {
  id: string;
  severity: 'high' | 'medium' | 'low';
  category: string;
  title: string;
  detail: string;
  matchNumber?: number;
  action?: string;
}

function AttentionTab({ onJumpToMatch }: { onJumpToMatch: (n: number) => void }) {
  const [items, setItems] = useState<AttentionItem[] | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/attention', { cache: 'no-store' });
      const data = await res.json();
      if (data.ok) {
        setItems(data.items);
        setGeneratedAt(data.generatedAt);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const high = items?.filter((i) => i.severity === 'high') ?? [];
  const med = items?.filter((i) => i.severity === 'medium') ?? [];
  const low = items?.filter((i) => i.severity === 'low') ?? [];

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between border border-snap-ash bg-snap-coal p-4">
        <div>
          <div className="font-display text-[22px] text-snap-chalk">NEEDS YOUR ATTENTION</div>
          <div className="font-mono text-[10px] tracking-[0.18em] text-snap-mist mt-1">
            {loading
              ? 'scanning…'
              : items === null
              ? 'tap REFRESH to scan'
              : items.length === 0
              ? '✓ all clear · nothing to do right now'
              : `${high.length} HIGH · ${med.length} MEDIUM · ${low.length} LOW`}
          </div>
          {generatedAt && (
            <div className="font-mono text-[9px] text-snap-fog mt-1 tracking-[0.15em]">
              last scan {new Date(generatedAt).toLocaleString()}
            </div>
          )}
        </div>
        <button type="button" onClick={load} disabled={loading} className={btnCls + ' disabled:opacity-50'}>
          {loading ? 'SCANNING…' : '↻ REFRESH'}
        </button>
      </div>

      {items !== null && items.length === 0 && (
        <div className="border border-snap-yellow/40 bg-snap-yellow/5 p-6 text-center">
          <div className="font-display text-[28px] text-snap-yellow">ALL CLEAR</div>
          <div className="font-body text-[13px] text-snap-mist mt-1">
            no missing results, no orphan vlogs, no stale states. trip is in good shape.
          </div>
        </div>
      )}

      {[high, med, low].map((bucket, i) => {
        if (bucket.length === 0) return null;
        const sevLabel = ['HIGH', 'MEDIUM', 'LOW'][i];
        const sevColor =
          i === 0 ? 'border-live text-live' : i === 1 ? 'border-snap-yellow text-snap-yellow' : 'border-snap-fog text-snap-fog';
        return (
          <div key={i}>
            <div className={`font-mono text-[10px] tracking-[0.22em] px-2 py-1 border ${sevColor} inline-block mb-2`}>
              {sevLabel} · {bucket.length}
            </div>
            <div className="space-y-2">
              {bucket.map((item) => (
                <AttentionCard key={item.id} item={item} onJumpToMatch={onJumpToMatch} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AttentionCard({
  item,
  onJumpToMatch,
}: {
  item: AttentionItem;
  onJumpToMatch: (n: number) => void;
}) {
  const sevBorder =
    item.severity === 'high'
      ? 'border-live border-l-4'
      : item.severity === 'medium'
      ? 'border-snap-yellow border-l-4'
      : 'border-snap-ash border-l-2';
  return (
    <div className={`bg-snap-coal p-3 border ${sevBorder}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[11px] tracking-[0.18em] text-snap-chalk">{item.title}</div>
          <div className="font-body text-[12px] text-snap-mist mt-1 leading-relaxed">{item.detail}</div>
          {item.action && (
            <div className="font-mono text-[10px] text-snap-fog mt-2 tracking-[0.12em]">
              → {item.action.toUpperCase()}
            </div>
          )}
        </div>
        {item.matchNumber && (
          <button
            type="button"
            onClick={() => onJumpToMatch(item.matchNumber!)}
            className={btnDimCls + ' flex-shrink-0'}
          >
            OPEN #{item.matchNumber}
          </button>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// HEALTH TAB
// ────────────────────────────────────────────────────────────────────────

interface PingResult {
  id: string;
  label: string;
  url: string;
  ok: boolean;
  status: number | null;
  durationMs: number;
  bytes: number;
  sanity: string;
  error: string | null;
  checkedAt: string;
}

interface HealthRecord {
  byId: Record<string, {
    lastSuccess: PingResult | null;
    lastFailure: PingResult | null;
    lastChecked: PingResult | null;
  }>;
  updatedAt: string;
}

interface EndpointMeta {
  id: string;
  label: string;
  description: string;
}

function HealthTab() {
  const [record, setRecord] = useState<HealthRecord | null>(null);
  const [endpoints, setEndpoints] = useState<EndpointMeta[]>([]);
  const [pinging, setPinging] = useState(false);

  const load = async () => {
    try {
      const res = await fetch('/api/admin/espn-health', { cache: 'no-store' });
      const data = await res.json();
      if (data.ok) {
        setRecord(data.record ?? null);
        setEndpoints(data.endpoints ?? []);
      }
    } catch {
      // ignore
    }
  };

  const pingNow = async () => {
    setPinging(true);
    try {
      const res = await fetch('/api/admin/espn-health', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setRecord(data.record);
        setEndpoints(data.endpoints ?? []);
      }
    } finally {
      setPinging(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const overall = computeOverallHealth(record, endpoints);

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between border border-snap-ash bg-snap-coal p-4">
        <div>
          <div className="font-display text-[22px] text-snap-chalk">ESPN FEED HEALTH</div>
          <div className="font-mono text-[10px] tracking-[0.18em] text-snap-mist mt-1">
            monitors the upstream endpoints that power live scores, standings, and bracket.
          </div>
          <div
            className={`mt-2 inline-block px-2 py-1 font-mono text-[10px] tracking-[0.22em] border ${
              overall.color
            }`}
          >
            {overall.label}
          </div>
        </div>
        <button type="button" onClick={pingNow} disabled={pinging} className={btnCls + ' disabled:opacity-50'}>
          {pinging ? 'PINGING…' : '◷ TEST ALL'}
        </button>
      </div>

      <div className="space-y-3">
        {endpoints.map((ep) => {
          const r = record?.byId?.[ep.id];
          return <HealthCard key={ep.id} endpoint={ep} record={r} />;
        })}
        {endpoints.length === 0 && (
          <div className="font-mono text-[11px] text-snap-mist py-4 text-center">
            loading endpoint list…
          </div>
        )}
      </div>

      <div className="font-mono text-[9px] text-snap-fog leading-relaxed pt-2">
        all endpoints are public ESPN URLs (no API key, no auth, anonymous fetch). this monitor
        verifies reachability + payload sanity. if a feed goes red during the tournament, the
        public tabs that depend on it will show an empty state — public visitors will see
        &quot;loading the table…&quot; or &quot;can&apos;t pull scores rn&quot; rather than stale data.
      </div>
    </div>
  );
}

function computeOverallHealth(
  record: HealthRecord | null,
  endpoints: EndpointMeta[],
): { label: string; color: string } {
  if (!record || endpoints.length === 0) {
    return { label: '◷ NOT YET TESTED', color: 'border-snap-fog text-snap-fog' };
  }
  const states = endpoints.map((e) => record.byId?.[e.id]?.lastChecked?.ok ?? null);
  const tested = states.filter((s) => s !== null);
  if (tested.length === 0) return { label: '◷ NOT YET TESTED', color: 'border-snap-fog text-snap-fog' };
  if (tested.every((s) => s === true)) return { label: '● ALL HEALTHY', color: 'border-snap-yellow text-snap-yellow' };
  if (tested.every((s) => s === false)) return { label: '● ALL FAILING', color: 'border-live text-live' };
  return { label: '◐ PARTIAL · MIXED', color: 'border-snap-yellow text-snap-yellow' };
}

function HealthCard({
  endpoint,
  record,
}: {
  endpoint: EndpointMeta;
  record?: { lastSuccess: PingResult | null; lastFailure: PingResult | null; lastChecked: PingResult | null };
}) {
  const last = record?.lastChecked;
  const lastSuccess = record?.lastSuccess;
  const lastFailure = record?.lastFailure;
  const status = !last
    ? { dot: '○', label: 'UNTESTED', color: 'text-snap-fog border-snap-fog' }
    : last.ok
    ? { dot: '●', label: 'HEALTHY', color: 'text-snap-yellow border-snap-yellow' }
    : { dot: '●', label: 'FAILING', color: 'text-live border-live' };

  return (
    <div className={`border bg-snap-coal p-3 ${status.color.replace(/text-\S+/, '').trim()}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[11px] tracking-[0.18em] text-snap-chalk">
            {endpoint.label}
          </div>
          <div className="font-body text-[11px] text-snap-mist mt-1 leading-relaxed">
            {endpoint.description}
          </div>
        </div>
        <span className={`flex-shrink-0 px-2 py-0.5 font-mono text-[10px] tracking-[0.18em] border ${status.color}`}>
          {status.dot} {status.label}
        </span>
      </div>

      {last && (
        <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[10px] text-snap-mist">
          <div>
            <div className="text-snap-fog tracking-[0.18em] text-[9px]">LATENCY</div>
            <div className="text-snap-chalk">{last.durationMs} ms</div>
          </div>
          <div>
            <div className="text-snap-fog tracking-[0.18em] text-[9px]">HTTP</div>
            <div className="text-snap-chalk">{last.status ?? '—'}</div>
          </div>
          <div>
            <div className="text-snap-fog tracking-[0.18em] text-[9px]">PAYLOAD</div>
            <div className="text-snap-chalk truncate">{last.sanity}</div>
          </div>
          <div>
            <div className="text-snap-fog tracking-[0.18em] text-[9px]">SIZE</div>
            <div className="text-snap-chalk">{(last.bytes / 1024).toFixed(1)} KB</div>
          </div>
        </div>
      )}

      {last && !last.ok && last.error && (
        <div className="mt-2 px-2 py-1 bg-live/10 border-l-2 border-live font-mono text-[10px] text-live">
          {last.error}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 text-[9px] font-mono tracking-[0.12em]">
        <div className="text-snap-fog">
          last healthy: <span className="text-snap-mist">{lastSuccess ? formatAgo(lastSuccess.checkedAt) : 'never'}</span>
        </div>
        <div className="text-snap-fog text-right">
          last failure: <span className="text-snap-mist">{lastFailure ? formatAgo(lastFailure.checkedAt) : 'none'}</span>
        </div>
      </div>
    </div>
  );
}

function formatAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} min ago`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)} h ago`;
  return `${Math.round(ms / 86_400_000)} d ago`;
}

