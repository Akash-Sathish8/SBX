// City-level geo helpers for the /near page. Coordinates come from the
// generated public/data/city-coords.json (scripts/build-city-coords.mjs) —
// centroids per distinct venue city, keyed by cityKey(). Games in a city the
// builder couldn't resolve simply carry no distance (honest gap).
import { getJSON } from './dataCache'

export interface LatLng { lat: number; lng: number }

// MUST match the builder's keying (scripts/build-city-coords.mjs).
export const cityKey = (city?: string, state?: string) =>
  `${(city || '').trim().toLowerCase()}|${(state || '').trim().toLowerCase()}`

export function loadCityCoords(): Promise<Record<string, LatLng>> {
  return getJSON('/data/city-coords.json')
}

// Great-circle distance in miles (haversine; Earth radius 3958.8 mi).
export function haversineMiles(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * 3958.8 * Math.asin(Math.sqrt(s))
}

export const fmtMiles = (n: number) => `${Math.round(n).toLocaleString()} mi`
