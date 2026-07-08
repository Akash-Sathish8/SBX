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
