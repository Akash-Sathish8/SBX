// Deep-links to the user's maps app for turn-by-turn directions to a venue.
// We only supply the DESTINATION (lat/lng); the maps app fills in the origin from
// the device's current location, so no browser geolocation permission is needed.

/** Google Maps universal directions URL — opens the Google Maps app if installed,
 *  otherwise the web. Origin defaults to the user's current location. Works on
 *  every platform, so it's the safe SSR default. */
export function googleDirections(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
}

/** Apple Maps directions URL. `daddr` is the destination; omitting `saddr` makes
 *  Apple Maps start from Current Location. `q` labels the destination pin. */
export function appleDirections(lat: number, lng: number, label?: string): string {
  const q = label ? `&q=${encodeURIComponent(label)}` : ''
  return `https://maps.apple.com/?daddr=${lat},${lng}${q}`
}

/** True on Apple platforms (iPhone / iPad / iPod / Mac), where Apple Maps is the
 *  native default. Guarded so it's safe to call during SSR (returns false). */
export function isAppleDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent)
}
