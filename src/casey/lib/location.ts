import { ITINERARY, getStadium } from './itinerary';
import { zonedTimeToUtc } from './time';
import { interpolateGreatCircle } from './geo';
import type { CaseyLocation, PositionOverride, ItineraryMatch } from './types';

export const STADIUM_ARRIVAL_HOURS_BEFORE_KICKOFF = 2;
export const STADIUM_DEPART_HOURS_AFTER_KICKOFF = 4;
export const FLIGHT_HOURS_DEFAULT = 4;

const HOUR_MS = 60 * 60 * 1000;
const TRIP_START_UTC = Date.UTC(2026, 5, 11, 0, 0, 0);
const NYC_FALLBACK = { lat: 40.7128, lng: -74.006 };

interface Window {
  kickoffUtc: number;
  start: number;
  end: number;
}

function stadiumWindow(m: ItineraryMatch): Window {
  const kickoffUtc = zonedTimeToUtc(m.kickoffLocal, m.kickoffTZ).getTime();
  return {
    kickoffUtc,
    start: kickoffUtc - STADIUM_ARRIVAL_HOURS_BEFORE_KICKOFF * HOUR_MS,
    end: kickoffUtc + STADIUM_DEPART_HOURS_AFTER_KICKOFF * HOUR_MS,
  };
}

export function computeCaseyLocation(
  now: Date = new Date(),
  override?: PositionOverride | null,
): CaseyLocation {
  const computedAt = now.toISOString();
  const nowMs = now.getTime();

  if (override && override.active) {
    const expired = override.expiresAt && new Date(override.expiresAt).getTime() < nowMs;
    const notYetActive = override.startsAt && new Date(override.startsAt).getTime() > nowMs;
    if (!expired && !notYetActive) {
      const stadium = override.stadiumId ? getStadium(override.stadiumId) : null;
      const lat = stadium?.lat ?? override.lat ?? NYC_FALLBACK.lat;
      const lng = stadium?.lng ?? override.lng ?? NYC_FALLBACK.lng;
      let description = override.description ?? 'Current location';
      if (stadium) {
        description = `At ${stadium.name}, ${stadium.city}`;
      }
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

  if (nowMs < TRIP_START_UTC) {
    return {
      state: 'pre-trip',
      lat: NYC_FALLBACK.lat,
      lng: NYC_FALLBACK.lng,
      description: 'tournament loading · azteca up first',
      currentMatchNumber: null,
      nextMatchNumber: ITINERARY[0]?.matchNumber ?? null,
      computedAt,
    };
  }

  const lastMatch = ITINERARY[ITINERARY.length - 1];
  const lastWindow = stadiumWindow(lastMatch);
  if (nowMs > lastWindow.end + 24 * HOUR_MS) {
    return {
      state: 'post-trip',
      lat: lastMatch.sleepLat,
      lng: lastMatch.sleepLng,
      description: 'wrapped · 34/34 · casey survived',
      currentMatchNumber: null,
      nextMatchNumber: null,
      computedAt,
    };
  }

  let currentMatch: ItineraryMatch | null = null;
  let nextMatch: ItineraryMatch | null = null;
  let prevMatch: ItineraryMatch | null = null;

  for (let i = 0; i < ITINERARY.length; i++) {
    const m = ITINERARY[i];
    const w = stadiumWindow(m);
    if (nowMs >= w.start && nowMs <= w.end) {
      currentMatch = m;
      prevMatch = ITINERARY[i - 1] ?? null;
      nextMatch = ITINERARY[i + 1] ?? null;
      break;
    }
    if (nowMs < w.start) {
      nextMatch = m;
      prevMatch = ITINERARY[i - 1] ?? null;
      break;
    }
  }

  if (!currentMatch && !nextMatch && !prevMatch) {
    prevMatch = ITINERARY[ITINERARY.length - 1];
  }

  if (currentMatch) {
    const stadium = getStadium(currentMatch.stadiumId);
    if (stadium) {
      return {
        state: 'at-stadium',
        lat: stadium.lat,
        lng: stadium.lng,
        description: `At ${stadium.name} · ${currentMatch.match}`,
        currentMatchNumber: currentMatch.matchNumber,
        nextMatchNumber: nextMatch?.matchNumber ?? null,
        computedAt,
      };
    }
  }

  if (nextMatch) {
    const nextStadium = getStadium(nextMatch.stadiumId);
    if (nextStadium) {
      const nextWindow = stadiumWindow(nextMatch);
      const departHotel = nextWindow.start - FLIGHT_HOURS_DEFAULT * HOUR_MS;

      const startPoint = prevMatch
        ? { lat: prevMatch.sleepLat, lng: prevMatch.sleepLng }
        : NYC_FALLBACK;
      const startCityName = prevMatch?.sleepCity ?? 'New York City';

      if (nowMs < departHotel) {
        return {
          state: 'at-hotel',
          lat: startPoint.lat,
          lng: startPoint.lng,
          description: `off day in ${startCityName.toLowerCase()}`,
          currentMatchNumber: null,
          nextMatchNumber: nextMatch.matchNumber,
          computedAt,
        };
      }

      const elapsed = nowMs - departHotel;
      const totalFlightMs = nextWindow.start - departHotel;
      const t = Math.max(0, Math.min(1, elapsed / totalFlightMs));
      const interp = interpolateGreatCircle(
        startPoint,
        { lat: nextStadium.lat, lng: nextStadium.lng },
        t,
      );
      return {
        state: 'in-transit',
        lat: interp.lat,
        lng: interp.lng,
        description: `wheels up · ${nextStadium.city.toLowerCase()} bound`,
        currentMatchNumber: null,
        nextMatchNumber: nextMatch.matchNumber,
        fromStadiumId: prevMatch?.stadiumId,
        toStadiumId: nextMatch.stadiumId,
        progressPercent: Math.round(t * 100),
        computedAt,
      };
    }
  }

  if (prevMatch) {
    return {
      state: 'at-hotel',
      lat: prevMatch.sleepLat,
      lng: prevMatch.sleepLng,
      description: `posted up in ${prevMatch.sleepCity.toLowerCase()}`,
      currentMatchNumber: null,
      nextMatchNumber: null,
      computedAt,
    };
  }

  return {
    state: 'pre-trip',
    lat: NYC_FALLBACK.lat,
    lng: NYC_FALLBACK.lng,
    description: 'Status unknown',
    currentMatchNumber: null,
    nextMatchNumber: null,
    computedAt,
  };
}
