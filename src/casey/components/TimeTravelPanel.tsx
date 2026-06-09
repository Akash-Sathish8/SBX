
import { useState } from 'react';
import type { SimSpeed } from './ClientShell';

interface Props {
  simTimeMs: number | null;
  playing: boolean;
  speed: SimSpeed;
  tripStartMs: number;
  tripEndMs: number;
  onStart: (startMs?: number) => void;
  onPause: () => void;
  onResume: () => void;
  onSeek: (ms: number) => void;
  onSpeedChange: (speed: SimSpeed) => void;
  onExit: () => void;
}

interface Preset {
  id: string;
  label: string;
  iso: string;
  blurb: string;
}

const PRESETS: Preset[] = [
  { id: 'departure', label: 'DEPARTURE DAY', iso: '2026-06-10T16:00:00-04:00', blurb: 'jun 10 · jfk→mex' },
  { id: 'opener', label: 'OPENER KICKOFF', iso: '2026-06-11T14:00:00-06:00', blurb: 'jun 11 · mexico vs south africa' },
  { id: 'usa1', label: 'USA MATCH 1', iso: '2026-06-12T18:00:00-07:00', blurb: 'jun 12 · usa vs paraguay' },
  { id: 'midgroup', label: 'MID GROUP STAGE', iso: '2026-06-24T15:00:00-04:00', blurb: 'jun 24 · matchday 14' },
  { id: 'r32', label: 'R32 KICKOFF', iso: '2026-06-28T12:00:00-07:00', blurb: 'jun 28 · knockouts begin' },
  { id: 'qf1', label: 'QUARTERFINAL', iso: '2026-07-09T16:00:00-04:00', blurb: 'jul 9 · qf1' },
  { id: 'semi', label: 'SEMIFINAL', iso: '2026-07-14T14:00:00-05:00', blurb: 'jul 14 · sf1' },
  { id: 'final', label: 'FINAL', iso: '2026-07-19T15:00:00-04:00', blurb: 'jul 19 · world cup final' },
];

const SPEED_OPTIONS: { value: SimSpeed; label: string; desc: string }[] = [
  { value: 0.5, label: '1×', desc: '30 min/sec · full trip ≈ 32 min' },
  { value: 2, label: '4×', desc: '2 hr/sec · full trip ≈ 8 min' },
  { value: 8, label: '16×', desc: '8 hr/sec · full trip ≈ 2 min' },
];

function formatSim(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function progressPct(ms: number, start: number, end: number): number {
  return Math.max(0, Math.min(100, ((ms - start) / (end - start)) * 100));
}

export default function TimeTravelPanel({
  simTimeMs,
  playing,
  speed,
  tripStartMs,
  tripEndMs,
  onStart,
  onPause,
  onResume,
  onSeek,
  onSpeedChange,
  onExit,
}: Props) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const active = simTimeMs !== null;

  const jumpToPreset = (iso: string) => {
    const ms = new Date(iso).getTime();
    if (Number.isNaN(ms)) return;
    onSeek(ms);
  };

  const jumpCustom = () => {
    if (!custom) return;
    const ms = new Date(custom).getTime();
    if (Number.isNaN(ms)) return;
    onSeek(ms);
  };

  const pct = active ? progressPct(simTimeMs!, tripStartMs, tripEndMs) : 0;

  return (
    <>
      {active && (
        <div
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 z-50 bg-snap-yellow text-snap-chalk font-mono text-[10px] tracking-[0.22em] px-3 py-1 shadow-lg whitespace-nowrap"
          style={{ top: '4px' }}
        >
          {playing ? '▶ SIMULATING' : '⏸ PAUSED'} · {formatSim(simTimeMs!)}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`pointer-events-auto fixed z-50 flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[9px] tracking-[0.22em] transition-colors ${
          active
            ? 'bg-snap-yellow text-snap-chalk border border-snap-yellow'
            : 'bg-snap-black/80 text-snap-mist border border-snap-ash hover:text-snap-yellow hover:border-snap-yellow'
        }`}
        style={{ bottom: '12px', right: '12px' }}
        aria-label="Open simulator"
      >
        ◷ {active ? (playing ? 'SIMULATING' : 'PAUSED') : 'TIME TRAVEL'}
      </button>

      {open && (
        <div
          className="pointer-events-auto fixed z-[1100] w-[300px] sm:w-[340px] bg-snap-coal border-2 border-snap-yellow shadow-2xl flex flex-col"
          style={{ bottom: '52px', right: '12px', maxHeight: 'calc(100vh - 80px)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-snap-ash bg-snap-black px-3 py-2 flex-shrink-0">
            <div className="font-display text-snap-yellow text-[15px] tracking-wide">
              ◷ TRIP SIMULATOR
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="font-mono text-[16px] text-snap-mist hover:text-snap-yellow leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            {!active && (
              <>
                <div className="px-3 py-3 font-body text-[12px] text-snap-mist leading-relaxed border-b border-snap-ash">
                  watch the entire 40-day trip play out in fast-forward · casey
                  moves between cities, matches go live, days tick by.
                  rebuilt server-free so it&apos;s smooth.
                </div>
                <button
                  type="button"
                  onClick={() => onStart()}
                  className="w-full bg-snap-yellow text-snap-chalk font-mono text-[12px] tracking-[0.22em] py-3 hover:bg-snap-yellowDim transition-colors"
                >
                  ▶ PLAY FROM DEPARTURE
                </button>
              </>
            )}

            {active && (
              <>
                {/* Playback bar */}
                <div className="px-3 py-3 border-b border-snap-ash space-y-2.5">
                  <div className="font-mono text-[10px] tracking-[0.18em] text-snap-yellow">
                    {formatSim(simTimeMs!)}
                  </div>
                  <div className="relative h-2 bg-snap-ash">
                    <div
                      className="h-full bg-snap-yellow transition-[width] duration-200"
                      style={{ width: `${pct}%` }}
                    />
                    <input
                      type="range"
                      min={tripStartMs}
                      max={tripEndMs}
                      step={3600000}
                      value={simTimeMs!}
                      onChange={(e) => onSeek(Number(e.target.value))}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      aria-label="Scrub trip timeline"
                    />
                  </div>
                  <div className="flex justify-between font-mono text-[8px] text-snap-fog tracking-[0.18em]">
                    <span>JUN 10</span>
                    <span>{pct.toFixed(0)}%</span>
                    <span>JUL 19</span>
                  </div>
                </div>

                {/* Play / Pause / Speed */}
                <div className="px-3 py-2.5 border-b border-snap-ash">
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {playing ? (
                      <button
                        type="button"
                        onClick={onPause}
                        className="bg-snap-yellow text-snap-chalk font-mono text-[11px] tracking-[0.2em] py-2"
                      >
                        ⏸ PAUSE
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onResume}
                        className="bg-snap-yellow text-snap-chalk font-mono text-[11px] tracking-[0.2em] py-2 hover:bg-snap-yellowDim transition-colors"
                      >
                        ▶ PLAY
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onSeek(tripStartMs)}
                      className="bg-snap-black border border-snap-ash text-snap-mist hover:border-snap-yellow hover:text-snap-yellow font-mono text-[11px] tracking-[0.2em] py-2 transition-colors"
                    >
                      ↻ RESTART
                    </button>
                  </div>
                  <div className="font-mono text-[9px] tracking-[0.2em] text-snap-mist mb-1.5">
                    SPEED
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {SPEED_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => onSpeedChange(opt.value)}
                        className={`font-mono text-[10px] tracking-[0.15em] py-1.5 border transition-colors ${
                          speed === opt.value
                            ? 'border-snap-yellow bg-snap-yellow/10 text-snap-yellow'
                            : 'border-snap-ash bg-snap-black/40 text-snap-mist hover:border-snap-mist'
                        }`}
                        title={opt.desc}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="font-mono text-[8px] text-snap-fog mt-1.5 tracking-[0.1em]">
                    {SPEED_OPTIONS.find((o) => o.value === speed)?.desc}
                  </div>
                </div>
              </>
            )}

            {/* Presets — always shown */}
            <div className="px-2 py-2">
              <div className="font-mono text-[9px] tracking-[0.2em] text-snap-mist px-1 mb-1.5">
                JUMP TO MOMENT
              </div>
              <div className="space-y-1">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => jumpToPreset(p.iso)}
                    className="w-full text-left px-2.5 py-1.5 border border-snap-ash bg-snap-black/50 hover:border-snap-mist transition-colors"
                  >
                    <div className="font-mono text-[10px] tracking-[0.18em] text-snap-chalk">
                      {p.label}
                    </div>
                    <div className="font-body text-[10px] text-snap-mist mt-0.5">{p.blurb}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom datetime */}
            <div className="border-t border-snap-ash px-3 py-2.5 bg-snap-black/40">
              <div className="font-mono text-[9px] tracking-[0.2em] text-snap-mist mb-1.5">
                CUSTOM DATE
              </div>
              <div className="flex gap-1.5">
                <input
                  type="datetime-local"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  className="flex-1 bg-snap-black border border-snap-ash px-2 py-1 font-mono text-[10px] text-snap-chalk focus:outline-none focus:border-snap-yellow"
                />
                <button
                  type="button"
                  onClick={jumpCustom}
                  disabled={!custom}
                  className="bg-snap-yellow text-snap-chalk font-mono text-[9px] tracking-[0.2em] px-2.5 py-1 disabled:opacity-40 hover:bg-snap-yellowDim transition-colors"
                >
                  GO
                </button>
              </div>
            </div>

            {active && (
              <div className="border-t border-snap-ash px-3 py-2.5 bg-snap-yellow/5 flex-shrink-0">
                <button
                  type="button"
                  onClick={onExit}
                  className="w-full font-mono text-[10px] tracking-[0.22em] text-snap-yellow hover:text-snap-yellowDim"
                >
                  ← EXIT SIM · BACK TO REAL TIME
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
