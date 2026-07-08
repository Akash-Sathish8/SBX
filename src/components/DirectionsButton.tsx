import { useEffect, useState } from 'react'
import { NavigationIcon } from 'lucide-react'
import { googleDirections, appleDirections, isAppleDevice } from '../lib/maps'

// One-tap "Get directions" to a venue. Opens Apple Maps on Apple devices and
// Google Maps everywhere else; the maps app routes from the user's current
// location, so no geolocation permission is requested here.
//
// SSR and the first client render both use the Google URL so the markup is
// deterministic; after mount we upgrade to Apple Maps on Apple devices, which
// avoids a React hydration mismatch.
export function DirectionsButton({ lat, lng, label }: { lat: number; lng: number; label?: string }) {
  const [href, setHref] = useState(() => googleDirections(lat, lng))
  useEffect(() => {
    if (isAppleDevice()) setHref(appleDirections(lat, lng, label))
  }, [lat, lng, label])
  return (
    <a className="dir-btn" href={href} target="_blank" rel="noopener noreferrer" aria-label="Get directions to the stadium">
      <NavigationIcon size={16} aria-hidden /> Get directions
    </a>
  )
}
