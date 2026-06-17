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
