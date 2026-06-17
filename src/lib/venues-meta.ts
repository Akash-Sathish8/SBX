// Lightweight, build-time-static venue metadata — shared by the /venues list
// and the /venue/$id detail route's head() SEO tags (needs name/city synchronously
// at SSR time, before the heavier per-venue JSON loads).

export type VenueMeta = { img: string; name: string; city: string; cc: string; role: string }

export const VENUES: VenueMeta[] = [
  { img: 'azteca', name: 'Estadio Azteca', city: 'Mexico City', cc: 'MEX', role: 'Opening Match' },
  { img: 'metlife', name: 'MetLife Stadium', city: 'New York / NJ', cc: 'USA', role: 'Final' },
  { img: 'att', name: 'AT&T Stadium', city: 'Dallas', cc: 'USA', role: 'Semifinal' },
  { img: 'mercedes', name: 'Mercedes-Benz Stadium', city: 'Atlanta', cc: 'USA', role: 'Semifinal' },
  { img: 'hardrock', name: 'Hard Rock Stadium', city: 'Miami', cc: 'USA', role: 'Third place' },
  { img: 'sofi', name: 'SoFi Stadium', city: 'Los Angeles', cc: 'USA', role: '' },
  { img: 'nrg', name: 'NRG Stadium', city: 'Houston', cc: 'USA', role: '' },
  { img: 'arrowhead', name: 'Arrowhead Stadium', city: 'Kansas City', cc: 'USA', role: '' },
  { img: 'linc', name: 'Lincoln Financial Field', city: 'Philadelphia', cc: 'USA', role: '' },
  { img: 'levis', name: "Levi's Stadium", city: 'San Francisco Bay', cc: 'USA', role: '' },
  { img: 'lumen', name: 'Lumen Field', city: 'Seattle', cc: 'USA', role: '' },
  { img: 'gillette', name: 'Gillette Stadium', city: 'Boston', cc: 'USA', role: '' },
  { img: 'bcplace', name: 'BC Place', city: 'Vancouver', cc: 'CAN', role: '' },
  { img: 'bmo', name: 'BMO Field', city: 'Toronto', cc: 'CAN', role: '' },
  { img: 'akron', name: 'Estadio Akron', city: 'Guadalajara', cc: 'MEX', role: '' },
  { img: 'bbva', name: 'Estadio BBVA', city: 'Monterrey', cc: 'MEX', role: '' },
]

export function venueMeta(id: string): VenueMeta | null {
  return VENUES.find((v) => v.img === id) ?? null
}

// Single source of truth for stadium coordinates (was hand-copied — and drifted —
// in both /venue/$id and /build). Used for the per-venue weather lookups.
export const VENUE_COORDS: Record<string, [number, number]> = {
  metlife: [40.8135, -74.0745], sofi: [33.9535, -118.3392], azteca: [19.3029, -99.1505],
  att: [32.7473, -97.0945], mercedes: [33.7554, -84.4009], hardrock: [25.958, -80.2389],
  nrg: [29.6847, -95.4107], arrowhead: [39.0489, -94.4839], linc: [39.9008, -75.1675],
  levis: [37.403, -121.97], lumen: [47.5952, -122.3316], gillette: [42.0909, -71.2643],
  bcplace: [49.2767, -123.1119], bmo: [43.6332, -79.4185], akron: [20.6819, -103.4626],
  bbva: [25.6692, -100.2444],
}

// Country tallies derived from VENUES so the /venues headline can't drift from the list.
export const venueNationCounts = (): { cc: string; n: number }[] => {
  const order = ['USA', 'MEX', 'CAN']
  const counts = new Map<string, number>()
  for (const v of VENUES) counts.set(v.cc, (counts.get(v.cc) ?? 0) + 1)
  return order.filter((cc) => counts.has(cc)).map((cc) => ({ cc, n: counts.get(cc)! }))
}
