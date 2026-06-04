
import { useState } from 'react';
import type { SpendTracker } from '@/lib/types';

interface Props {
  spend: SpendTracker;
  following: boolean;
  onToggleFollow: () => void;
  onOpenHelp: () => void;
}

function fmtK(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return `$${n}`;
}

function fmtFull(n: number): string {
  return `$${n.toLocaleString()}`;
}

function fmtUpdated(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d
    .toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
    .toUpperCase();
}

function Bar({ pct, accent = false }: { pct: number; accent?: boolean }) {
  return (
    <div className="mt-1 h-[3px] w-full bg-snap-ash">
      <div
        className={`h-full ${accent ? 'bg-snap-yellow' : 'bg-snap-yellow/70'}`}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

export default function SpendPanel({ spend, following, onToggleFollow, onOpenHelp }: Props) {
  const [open, setOpen] = useState(false);

  const totalActual = spend.travelActual + spend.ticketsActual + spend.incidentalsActual;
  const totalPct = (totalActual / spend.budgetTotal) * 100;

  return (
    <div className="absolute bottom-3 left-3 z-20 pointer-events-auto sm:bottom-5 sm:left-5">
      <div className="border border-snap-ash bg-snap-black/85 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setOpen((s) => !s)}
          className="flex items-center gap-2 px-3 py-2 font-mono text-[10px] tracking-[0.18em] hover:bg-snap-smoke/50 transition-colors"
        >
          <span className="text-snap-mist">SPEND</span>
          <span className="stat-number text-snap-yellow text-[13px]">{fmtK(totalActual)}</span>
          <span className="text-snap-fog">/</span>
          <span className="stat-number text-snap-fog text-[13px]">{fmtK(spend.budgetTotal)}</span>
          <span className="ml-1 text-snap-mist">{open ? '−' : '+'}</span>
        </button>

        {open && (
          <div className="border-t border-snap-ash p-3 space-y-2 w-[260px]">
            <Row
              label="TRAVEL"
              actual={spend.travelActual}
              budget={spend.travelBudget}
            />
            <Row
              label="TICKETS"
              actual={spend.ticketsActual}
              budget={spend.ticketsBudget}
            />
            <Row
              label="INCIDENTALS"
              actual={spend.incidentalsActual}
              budget={spend.incidentalsBudget}
            />
            <div className="border-t border-snap-ash pt-2 mt-2">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[10px] tracking-[0.18em] text-snap-chalk">TOTAL</span>
                <div>
                  <span className="stat-number text-snap-yellow text-sm">{fmtFull(totalActual)}</span>
                  <span className="stat-number text-snap-fog text-[11px] ml-1">/ {fmtFull(spend.budgetTotal)}</span>
                </div>
              </div>
              <Bar pct={totalPct} accent />
              <div className="mt-1 font-mono text-[9px] tracking-[0.18em] text-snap-mist text-right">
                {totalPct.toFixed(1)}% OF BUDGET
              </div>
            </div>
            {(() => {
              const updated = fmtUpdated(spend.updatedAt);
              if (!updated) return null;
              return (
                <div className="border-t border-snap-ash pt-2 mt-2 flex items-center justify-between gap-2 font-mono text-[10px] tracking-[0.18em] text-snap-mist">
                  <span>LAST UPDATED</span>
                  <span className="text-snap-chalk">{updated}</span>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={onToggleFollow}
          className={`border px-2 py-1.5 font-mono text-[9px] tracking-[0.18em] transition-colors ${
            following
              ? 'border-snap-yellow bg-snap-yellow/10 text-snap-yellow'
              : 'border-snap-ash bg-snap-black/85 text-snap-mist hover:text-snap-yellow hover:border-snap-yellow'
          }`}
          aria-pressed={following}
        >
          {following ? '◉ FOLLOWING' : '◎ FOLLOW'}
        </button>
        <button
          type="button"
          onClick={() => window.__caseyRecenter?.()}
          className="border border-snap-ash bg-snap-black/85 px-2 py-1.5 font-mono text-[9px] tracking-[0.18em] text-snap-mist hover:text-snap-yellow hover:border-snap-yellow transition-colors"
        >
          ↻ RECENTER
        </button>
      </div>
      <button
        type="button"
        onClick={onOpenHelp}
        className="mt-1.5 w-full border border-snap-ash bg-snap-black/85 px-2 py-1.5 font-mono text-[9px] tracking-[0.18em] text-snap-mist hover:text-snap-yellow hover:border-snap-yellow transition-colors"
      >
        ? ABOUT THIS TRACKER
      </button>
    </div>
  );
}

function Row({ label, actual, budget }: { label: string; actual: number; budget: number }) {
  const pct = budget > 0 ? (actual / budget) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] tracking-[0.15em] text-snap-mist">{label}</span>
        <div>
          <span className="stat-number text-snap-chalk text-[12px]">{fmtFull(actual)}</span>
          <span className="stat-number text-snap-fog text-[10px] ml-1">/ {fmtFull(budget)}</span>
        </div>
      </div>
      <Bar pct={pct} />
    </div>
  );
}
