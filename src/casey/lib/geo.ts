export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_MILES = 3958.8;
const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function haversineMiles(a: LatLng, b: LatLng): number {
  return haversine(a, b, EARTH_RADIUS_MILES);
}

export function haversineKm(a: LatLng, b: LatLng): number {
  return haversine(a, b, EARTH_RADIUS_KM);
}

function haversine(a: LatLng, b: LatLng, radius: number): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLat = lat2 - lat1;
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function interpolateGreatCircle(a: LatLng, b: LatLng, t: number): LatLng {
  if (a.lat === b.lat && a.lng === b.lng) return { lat: a.lat, lng: a.lng };

  const lat1 = toRad(a.lat);
  const lng1 = toRad(a.lng);
  const lat2 = toRad(b.lat);
  const lng2 = toRad(b.lng);

  const cosLat1 = Math.cos(lat1);
  const cosLat2 = Math.cos(lat2);
  const sinLat1 = Math.sin(lat1);
  const sinLat2 = Math.sin(lat2);
  const cosDLng = Math.cos(lng2 - lng1);

  const cosD = sinLat1 * sinLat2 + cosLat1 * cosLat2 * cosDLng;
  const clamped = Math.max(-1, Math.min(1, cosD));
  const d = Math.acos(clamped);

  if (d === 0) return { lat: a.lat, lng: a.lng };

  const sinD = Math.sin(d);
  const A = Math.sin((1 - t) * d) / sinD;
  const B = Math.sin(t * d) / sinD;

  const x = A * cosLat1 * Math.cos(lng1) + B * cosLat2 * Math.cos(lng2);
  const y = A * cosLat1 * Math.sin(lng1) + B * cosLat2 * Math.sin(lng2);
  const z = A * sinLat1 + B * sinLat2;

  const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
  const lng = Math.atan2(y, x);

  return { lat: toDeg(lat), lng: toDeg(lng) };
}

export function sampleArc(a: LatLng, b: LatLng, n = 64): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = interpolateGreatCircle(a, b, t);
    points.push([p.lng, p.lat]);
  }
  return points;
}

export function initialBearing(a: LatLng, b: LatLng): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360;
}
