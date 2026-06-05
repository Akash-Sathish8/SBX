import { ITINERARY, ADVERTISED_TOTAL_MILES, TRIP_ORIGIN, TOTAL_STADIUMS, getStadium } from './itinerary';
import { zonedTimeToUtc } from './time';
import { haversineMiles } from './geo';
import type { CaseyLocation, MatchResult, TripStats } from './types';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
// Trip is 40 days inclusive: Jun 10 (departure) through Jul 19 (final).
// Day 1 = Jun 10, Day 40 = Jul 19 + the wrap morning after.
const TRIP_START_UTC = Date.UTC(2026, 5, 10, 0, 0, 0);

export function computeTripStats(
  now: Date,
  _location: CaseyLocation,
  results: Record<number, MatchResult>,
): TripStats {
  const nowMs = now.getTime();

  const daysElapsed = Math.floor((nowMs - TRIP_START_UTC) / DAY_MS) + 1;
  const dayNumber = Math.max(0, Math.min(40, daysElapsed));

  const attendedMatches = ITINERARY.filter((m) => {
    const kickoffUtc = zonedTimeToUtc(m.kickoffLocal, m.kickoffTZ).getTime();
    const result = results[m.matchNumber];
    return nowMs > kickoffUtc + 4 * HOUR_MS || result?.status === 'final';
  });
  const matchesAttended = attendedMatches.length;

  let milesFlown = 0;
  for (let i = 0; i < ITINERARY.length; i++) {
    const curr = ITINERARY[i];
    const stadium = getStadium(curr.stadiumId);
    if (!stadium) continue;
    const currKickoff = zonedTimeToUtc(curr.kickoffLocal, curr.kickoffTZ).getTime();
    if (nowMs < currKickoff) continue;

    // Inbound leg: from previous sleep (or trip origin for Match 1) to this stadium.
    // Honor routeVia for matches that detour through an intermediate city.
    const from =
      i === 0
        ? { lat: TRIP_ORIGIN.lat, lng: TRIP_ORIGIN.lng }
        : { lat: ITINERARY[i - 1].sleepLat, lng: ITINERARY[i - 1].sleepLng };
    const to = { lat: stadium.lat, lng: stadium.lng };
    if (curr.routeVia) {
      milesFlown += haversineMiles(from, { lat: curr.routeVia.lat, lng: curr.routeVia.lng });
      milesFlown += haversineMiles({ lat: curr.routeVia.lat, lng: curr.routeVia.lng }, to);
    } else {
      milesFlown += haversineMiles(from, to);
    }

    // Post-match leg: from stadium to sleep location (captures redeyes home etc.)
    milesFlown += haversineMiles(to, { lat: curr.sleepLat, lng: curr.sleepLng });
  }

  const stadiumIds = new Set(attendedMatches.map((m) => m.stadiumId));
  const countries = new Set(
    attendedMatches
      .map((m) => getStadium(m.stadiumId)?.country)
      .filter((c): c is string => Boolean(c)),
  );

  const future = ITINERARY.find((m) => {
    const kickoffUtc = zonedTimeToUtc(m.kickoffLocal, m.kickoffTZ).getTime();
    return kickoffUtc > nowMs;
  });
  const nextMatchInMs = future
    ? zonedTimeToUtc(future.kickoffLocal, future.kickoffTZ).getTime() - nowMs
    : null;

  return {
    matchesAttended,
    matchesTotal: ITINERARY.length,
    dayNumber,
    daysTotal: 40,
    milesFlown: Math.round(milesFlown),
    milesTotal: ADVERTISED_TOTAL_MILES,
    stadiumsVisited: stadiumIds.size,
    stadiumsTotal: TOTAL_STADIUMS,
    countriesVisited: countries.size,
    nextMatchInMs,
    nextMatchNumber: future?.matchNumber ?? null,
  };
}

export function formatCountdown(ms: number | null): string {
  if (ms === null || ms <= 0) return '—';
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
