import type { ReactNode } from 'react';

// Shared form/button styles, extracted from AdminShell when it was split into
// per-tab files under ./admin. Imported by the tab components.
export const inputCls =
  'w-full bg-snap-black border border-snap-ash px-2 py-1.5 font-mono text-xs text-snap-chalk focus:outline-none focus:border-snap-yellow';
export const btnCls =
  'bg-snap-yellow text-snap-black font-mono text-xs tracking-widest px-4 py-2 hover:bg-snap-yellowDim transition-colors disabled:opacity-50';
export const btnDimCls =
  'border border-snap-yellow/50 bg-snap-yellow/5 text-snap-yellow font-mono text-xs tracking-widest px-4 py-2 hover:bg-snap-yellow/15 hover:border-snap-yellow transition-colors';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-[9px] tracking-[0.18em] text-snap-mist uppercase block mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
