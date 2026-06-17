// Generic, pure, isomorphic helpers shared across the app — no I/O, no React, no
// Worker APIs, so they're safe to import anywhere (client or server). Domain and
// infra modules (teams, weather, queries, edgeCache, site, …) stay separate so a
// page importing a one-liner from here never pulls server/heavy deps into its bundle.

// ── text ────────────────────────────────────────────────────────────────────

// Uppercase the first letter when it's lowercase (leave already-capped / emoji alone).
export const cap = (s = '') => (/^[a-z]/.test(s) ? s[0].toUpperCase() + s.slice(1) : s)

// Split prose into sentences (kept as bullet candidates). Tolerant of non-strings.
export const splitSentences = (t: unknown): string[] =>
  String(t ?? '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)

// First sentence only, with any trailing period trimmed.
export const firstSentence = (t?: string): string =>
  t ? (splitSentences(t)[0] ?? '').replace(/\.$/, '') : ''

// ISO date → compact { weekday, "Mon D" } chip for match cards.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export function dateChip(iso: string): { wd: string; md: string } {
  if (!iso) return { wd: '', md: '' }
  const p = iso.split('-').map(Number)
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]))
  return { wd: WEEKDAYS[d.getUTCDay()], md: MONTHS[p[1] - 1] + ' ' + p[2] }
}

// ── distance (sort venue spots nearest-first) ───────────────────────────────

// Parse a free-form "distance from the stadium" string into approximate miles,
// so spot lists can be sorted nearest-first. Handles miles, km, walking minutes
// (~0.05 mi/min at 3 mph), and driving/transit minutes (~0.4 mi/min). Anything
// at/inside the stadium ranks 0; unparseable strings rank last.
export function distMiles(dist?: string | null): number {
  if (!dist) return 9999
  const s = String(dist).toLowerCase()
  if (/inside|at the stadium|at stadium|on-?site|stadium grounds|in[- ]stadium/.test(s)) return 0
  let m = s.match(/([\d.]+)\s*mi\b/)
  if (m) return parseFloat(m[1])
  m = s.match(/([\d.]+)\s*km/)
  if (m) return parseFloat(m[1]) * 0.621
  m = s.match(/([\d.]+)\s*min\s*walk/)
  if (m) return parseFloat(m[1]) * 0.05
  m = s.match(/([\d.]+)\s*min/)
  if (m) return parseFloat(m[1]) * 0.4
  return 9999
}

// Is this spot actually inside / on the stadium grounds (a real concourse option)
// vs a place out in the neighbourhood? Used to keep "Eat inside" honest.
export function isInside(item: { distMi?: number | null; dist?: string | null; where?: string }): boolean {
  if (typeof item.distMi === 'number') return item.distMi <= 0.12
  const s = (`${item.where || ''} ${item.dist || ''}`).toLowerCase()
  return /at stadium|inside|concourse|in[- ]stadium|stadium grounds|on[- ]site/.test(s)
}

// Prefer the accurate numeric distMi (miles from the stadium) when present;
// fall back to parsing the free-form dist string.
export function itemMiles(item: { distMi?: number | null; dist?: string | null }): number {
  if (typeof item.distMi === 'number' && isFinite(item.distMi)) return item.distMi
  return distMiles(item.dist)
}

// Stable nearest-first sort (does not mutate the input).
export function byDistance<T extends { distMi?: number | null; dist?: string | null }>(items: T[]): T[] {
  return items.map((x, i) => [x, i] as const)
    .sort((a, b) => itemMiles(a[0]) - itemMiles(b[0]) || a[1] - b[1])
    .map(([x]) => x)
}
