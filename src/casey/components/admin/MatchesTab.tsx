import { useMemo, useRef, useState } from 'react';
import { resizeImageToDataUrl, estimateDataUrlBytes } from '@/lib/image';
import type { ItineraryMatch, MatchStatus, Stadium } from '@/lib/types';
import { Field, inputCls, btnCls, btnDimCls } from './ui';

export function MatchesTab({
  itinerary,
  stadiums,
  post,
  initialOpenId = null,
}: {
  itinerary: ItineraryMatch[];
  stadiums: Record<string, Stadium>;
  post: (a: string, p: any) => Promise<boolean>;
  initialOpenId?: number | null;
}) {
  const [openId, setOpenId] = useState<number | null>(initialOpenId);
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

