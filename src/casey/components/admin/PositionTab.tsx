import { useState } from 'react';
import type { PositionOverride, Stadium } from '@/lib/types';
import { Field, inputCls, btnCls, btnDimCls } from './ui';

export function PositionTab({
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

