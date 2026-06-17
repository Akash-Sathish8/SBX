import { useState } from 'react';
import type { SpendTracker } from '@/lib/types';
import { Field, inputCls, btnCls } from './ui';

export function SpendTab({
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

