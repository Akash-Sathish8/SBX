// Time-travel parsing for the public preview feature. Anyone can pass
// ?simTime=2026-06-19T15:30:00Z (or any ISO datetime) and the app will
// render as if that were "now". When unset or invalid, returns real now.

export function parseSimTime(input: string | string[] | null | undefined): Date | null {
  if (!input) return null;
  const raw = Array.isArray(input) ? input[0] : input;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function resolveNow(simTime: Date | null): Date {
  return simTime ?? new Date();
}

// Canonical moments worth previewing. Keep this list short — the panel
// shows them as quick-jump buttons. Times chosen to land mid-state.
export const SIM_PRESETS = [
  { id: 'real', label: 'REAL TIME', iso: null, blurb: 'live mode' },
  {
    id: 'pretrip',
    label: 'PRE-TRIP',
    iso: '2026-06-05T18:00:00Z',
    blurb: 't-minus 6 days',
  },
  {
    id: 'departure',
    label: 'DEPARTURE',
    iso: '2026-06-10T20:30:00Z',
    blurb: 'jfk→mex airborne',
  },
  {
    id: 'opener',
    label: 'OPENER KICKOFF',
    iso: '2026-06-11T20:30:00Z',
    blurb: 'mexico vs south africa · at azteca',
  },
  {
    id: 'usa1',
    label: 'USA MATCH 1',
    iso: '2026-06-13T01:30:00Z',
    blurb: 'usa vs paraguay · at sofi',
  },
  {
    id: 'redeye',
    label: 'REDEYE',
    iso: '2026-06-13T07:00:00Z',
    blurb: 'lax→jfk overnight',
  },
  {
    id: 'midgroup',
    label: 'MID GROUP STAGE',
    iso: '2026-06-24T19:30:00Z',
    blurb: 'matchday 14 · atlanta',
  },
  {
    id: 'r32',
    label: 'R32 KICKOFF',
    iso: '2026-06-28T19:30:00Z',
    blurb: 'knockouts begin · sofi',
  },
  {
    id: 'qf1',
    label: 'QUARTERFINAL',
    iso: '2026-07-09T20:30:00Z',
    blurb: 'qf1 · gillette',
  },
  {
    id: 'semi',
    label: 'SEMIFINAL',
    iso: '2026-07-14T19:30:00Z',
    blurb: 'sf1 · at&t stadium',
  },
  {
    id: 'final',
    label: 'FINAL WHISTLE',
    iso: '2026-07-19T19:30:00Z',
    blurb: 'world cup final · metlife',
  },
  {
    id: 'posttrip',
    label: 'POST-TRIP',
    iso: '2026-07-21T18:00:00Z',
    blurb: '34/34 · wrapped',
  },
] as const;
