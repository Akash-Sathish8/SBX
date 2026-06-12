import { ITINERARY, getStadium } from './itinerary';
import { zonedTimeToUtc } from './time';
import { interpolateGreatCircle, haversineMiles } from './geo';
import type { LatLng } from './geo';
import type { CaseyLocation, PositionOverride } from './types';

const HOUR_MS = 60 * 60 * 1000;

// Casey lives in NYC — every trip begins and ends here.
const TRIP_ORIGIN = { lat: 40.7128, lng: -74.006, city: 'New York City' };
const NYC_FALLBACK = { lat: TRIP_ORIGIN.lat, lng: TRIP_ORIGIN.lng };

// Stadium window: Casey is "at the stadium" from a couple hours before kickoff
// until a few hours after (match + getting out).
export const STADIUM_ARRIVAL_HOURS_BEFORE_KICKOFF = 2;
export const STADIUM_DEPART_HOURS_AFTER_KICKOFF = 4;

// How long Casey is settled in the destination city before heading to the
// ground. Paired with the distance-based flight estimate this pushes long
// hauls (the NYC→Mexico City opener leg, cross-country hops) overnight, so he
// travels while the followers sleep and wakes up already in the next city —
// instead of teleporting or sitting at the origin until match day.
const CITY_REST_HOURS_BEFORE_STADIUM = 10;

// No per-leg flight times exist in the data, so transit duration is estimated
// from great-circle distance: cruise speed + a fixed gate/boarding buffer,
// floored so even a short hop reads as a real hop.
const FLIGHT_MPH = 500;
const TRAIN_MPH = 60;
const DRIVE_MPH = 45;
const TRAVEL_BUFFER_HOURS = 1.25;
const MIN_TRAVEL_HOURS = 1.5;

// Stadium and sleep coordinates within the same metro (e.g. Gillette in
// Foxborough vs a Boston hotel ~22mi away) shouldn't register as a flight; only
// a genuine transfer (Vancouver→Seattle ~120mi and up) animates a redeye.
const SAME_METRO_MILES = 75;

// Hours after the final whistle before the tracker flips to the wrap state.
const POST_TRIP_WRAP_HOURS = 24;

type Mode = 'flight' | 'train' | 'home';

function travelMs(from: LatLng, to: LatLng, mode: Mode, via?: LatLng): number {
  const miles = via
    ? haversineMiles(from, via) + haversineMiles(via, to)
    : haversineMiles(from, to);
  const mph = mode === 'train' ? TRAIN_MPH : mode === 'home' ? DRIVE_MPH : FLIGHT_MPH;
  const hours = Math.max(MIN_TRAVEL_HOURS, TRAVEL_BUFFER_HOURS + miles / mph);
  return hours * HOUR_MS;
}

// Position along a (possibly via-routed) great-circle leg, weighted by the
// distance of each half so the dot moves at a constant ground speed.
function positionAlong(from: LatLng, to: LatLng, t: number, via?: LatLng): LatLng {
  if (!via) return interpolateGreatCircle(from, to, t);
  const d1 = haversineMiles(from, via);
  const d2 = haversineMiles(via, to);
  const split = d1 / (d1 + d2 || 1);
  if (t <= split) return interpolateGreatCircle(from, via, split > 0 ? t / split : 1);
  return interpolateGreatCircle(via, to, (t - split) / (1 - split || 1));
}

interface Segment {
  start: number;
  end: number;
  state: CaseyLocation['state'];
  description: string;
  currentMatchNumber: number | null;
  nextMatchNumber: number | null;
  // Static states (pre-trip / at-hotel / at-stadium / post-trip):
  lat?: number;
  lng?: number;
  // In-transit:
  from?: LatLng;
  to?: LatLng;
  via?: LatLng;
  fromStadiumId?: string;
  toStadiumId?: string;
  fromLabel?: string;
  toLabel?: string;
}

// Build the whole trip as an ordered, gap-free list of timed segments. Casey is
// always either settled at a data location or moving along the great-circle
// between two consecutive ones — so for any instant we can say exactly where he
// is, and during a leg he is genuinely interpolating between the endpoints.
function buildTimeline(): Segment[] {
  const segs: Segment[] = [];

  // Cursor = where Casey currently is and when he becomes free to leave it.
  let cursor: LatLng = { lat: TRIP_ORIGIN.lat, lng: TRIP_ORIGIN.lng };
  let cursorCity = TRIP_ORIGIN.city;
  let cursorStadiumId: string | undefined;
  let cursorReady = -Infinity; // before the trip Casey has been home "forever"
  let firstLeg = true;

  for (let i = 0; i < ITINERARY.length; i++) {
    const m = ITINERARY[i];
    const stadium = getStadium(m.stadiumId);
    if (!stadium) continue;

    const kickoff = zonedTimeToUtc(m.kickoffLocal, m.kickoffTZ).getTime();
    const windowStart = kickoff - STADIUM_ARRIVAL_HOURS_BEFORE_KICKOFF * HOUR_MS;
    const windowEnd = kickoff + STADIUM_DEPART_HOURS_AFTER_KICKOFF * HOUR_MS;
    const cityPoint: LatLng = { lat: stadium.lat, lng: stadium.lng };
    const via = m.routeVia ? { lat: m.routeVia.lat, lng: m.routeVia.lng } : undefined;
    const nextMatchNumber = ITINERARY[i + 1]?.matchNumber ?? null;

    const inboundMode: Mode = (m.transportMode as Mode) ?? 'flight';
    const travel = travelMs(cursor, cityPoint, inboundMode, via);

    // Aim to land in the city CITY_REST_HOURS before the ground opens, leaving
    // `travel` earlier. Clamp so Casey never departs before he's free from the
    // previous match, and never arrives after the window has already opened.
    let arrive = windowStart - CITY_REST_HOURS_BEFORE_STADIUM * HOUR_MS;
    let depart = arrive - travel;
    if (depart < cursorReady) {
      depart = cursorReady;
      arrive = Math.min(depart + travel, windowStart);
    }
    if (depart > windowStart) depart = windowStart; // degenerate guard

    // 1. Resting at the previous location until departure (off day / pre-trip).
    if (depart > cursorReady) {
      segs.push({
        start: cursorReady,
        end: depart,
        state: firstLeg ? 'pre-trip' : 'at-hotel',
        lat: cursor.lat,
        lng: cursor.lng,
        description: firstLeg
          ? 'tournament loading · azteca up first'
          : `off day in ${cursorCity.toLowerCase()}`,
        currentMatchNumber: null,
        nextMatchNumber: m.matchNumber,
      });
    }

    // 2. In transit, previous location → this match's city (the overnight leg).
    if (arrive > depart) {
      segs.push({
        start: depart,
        end: arrive,
        state: 'in-transit',
        from: { ...cursor },
        to: cityPoint,
        via,
        description: `${inboundMode === 'train' ? 'on the rails' : 'wheels up'} · ${stadium.city.toLowerCase()} bound`,
        currentMatchNumber: null,
        nextMatchNumber: m.matchNumber,
        fromStadiumId: cursorStadiumId,
        toStadiumId: m.stadiumId,
        fromLabel: cursorCity,
        toLabel: stadium.city,
      });
    }

    // 3. Settled in the destination city before the stadium opens.
    if (windowStart > arrive) {
      segs.push({
        start: arrive,
        end: windowStart,
        state: 'at-hotel',
        lat: cityPoint.lat,
        lng: cityPoint.lng,
        description: `in ${stadium.city.toLowerCase()}`,
        currentMatchNumber: null,
        nextMatchNumber: m.matchNumber,
      });
    }

    // 4. At the stadium for the match window.
    segs.push({
      start: windowStart,
      end: windowEnd,
      state: 'at-stadium',
      lat: stadium.lat,
      lng: stadium.lng,
      description: `At ${stadium.name} · ${m.match}`,
      currentMatchNumber: m.matchNumber,
      nextMatchNumber,
    });

    // 5. Post-match: animate the redeye/transfer when he sleeps in another metro
    //    (e.g. the LAX→JFK redeye after the USA match). Same-metro nights don't
    //    move the dot.
    const sleepPoint: LatLng = { lat: m.sleepLat, lng: m.sleepLng };
    if (haversineMiles(cityPoint, sleepPoint) > SAME_METRO_MILES) {
      const arriveSleep = windowEnd + travelMs(cityPoint, sleepPoint, 'flight');
      segs.push({
        start: windowEnd,
        end: arriveSleep,
        state: 'in-transit',
        from: cityPoint,
        to: sleepPoint,
        description: `redeye · ${m.sleepCity.toLowerCase()} bound`,
        currentMatchNumber: null,
        nextMatchNumber,
        fromStadiumId: m.stadiumId,
        fromLabel: stadium.city,
        toLabel: m.sleepCity,
      });
      cursorReady = arriveSleep;
    } else {
      cursorReady = windowEnd;
    }

    cursor = sleepPoint;
    cursorCity = m.sleepCity;
    cursorStadiumId = m.stadiumId;
    firstLeg = false;
  }

  // Wrap: settle at the last sleep location, then flip to post-trip.
  const wrapEnd = cursorReady + POST_TRIP_WRAP_HOURS * HOUR_MS;
  segs.push({
    start: cursorReady,
    end: wrapEnd,
    state: 'at-hotel',
    lat: cursor.lat,
    lng: cursor.lng,
    description: `posted up in ${cursorCity.toLowerCase()}`,
    currentMatchNumber: null,
    nextMatchNumber: null,
  });
  segs.push({
    start: wrapEnd,
    end: Infinity,
    state: 'post-trip',
    lat: cursor.lat,
    lng: cursor.lng,
    description: 'wrapped · 34/34 · casey survived',
    currentMatchNumber: null,
    nextMatchNumber: null,
  });

  return segs;
}

export function computeCaseyLocation(
  now: Date = new Date(),
  override?: PositionOverride | null,
): CaseyLocation {
  const computedAt = now.toISOString();
  const nowMs = now.getTime();

  // Admin pin always wins while it's active and unexpired.
  if (override && override.active) {
    const expired = override.expiresAt && new Date(override.expiresAt).getTime() < nowMs;
    const notYetActive = override.startsAt && new Date(override.startsAt).getTime() > nowMs;
    if (!expired && !notYetActive) {
      const stadium = override.stadiumId ? getStadium(override.stadiumId) : null;
      const lat = stadium?.lat ?? override.lat ?? NYC_FALLBACK.lat;
      const lng = stadium?.lng ?? override.lng ?? NYC_FALLBACK.lng;
      let description = override.description ?? 'Current location';
      if (stadium) description = `At ${stadium.name}, ${stadium.city}`;
      return {
        state: stadium ? 'at-stadium' : 'in-transit',
        lat,
        lng,
        description,
        currentMatchNumber: null,
        nextMatchNumber: null,
        computedAt,
      };
    }
  }

  const segs = buildTimeline();
  const seg =
    segs.find((s) => nowMs >= s.start && nowMs < s.end) ?? segs[segs.length - 1];

  if (seg.state === 'in-transit' && seg.from && seg.to) {
    const span = seg.end - seg.start;
    const t = span > 0 ? Math.max(0, Math.min(1, (nowMs - seg.start) / span)) : 1;
    const pos = positionAlong(seg.from, seg.to, t, seg.via);
    return {
      state: 'in-transit',
      lat: pos.lat,
      lng: pos.lng,
      description: seg.description,
      currentMatchNumber: null,
      nextMatchNumber: seg.nextMatchNumber,
      fromStadiumId: seg.fromStadiumId,
      toStadiumId: seg.toStadiumId,
      fromLat: seg.from.lat,
      fromLng: seg.from.lng,
      toLat: seg.to.lat,
      toLng: seg.to.lng,
      fromLabel: seg.fromLabel,
      toLabel: seg.toLabel,
      progressPercent: Math.round(t * 100),
      computedAt,
    };
  }

  return {
    state: seg.state,
    lat: seg.lat ?? NYC_FALLBACK.lat,
    lng: seg.lng ?? NYC_FALLBACK.lng,
    description: seg.description,
    currentMatchNumber: seg.currentMatchNumber,
    nextMatchNumber: seg.nextMatchNumber,
    computedAt,
  };
}
