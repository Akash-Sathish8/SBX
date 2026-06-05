import stadiumsJson from '@/data/stadiums.json';
import itineraryJson from '@/data/itinerary.json';
import type { ItineraryMatch, Stadium } from './types';

export const STADIUMS: Record<string, Stadium> = stadiumsJson as Record<string, Stadium>;

export const ITINERARY: ItineraryMatch[] = (itineraryJson as ItineraryMatch[])
  .slice()
  .sort((a, b) => a.matchNumber - b.matchNumber);

export const TOTAL_MATCHES = ITINERARY.length;
export const TOTAL_STADIUMS = Object.keys(STADIUMS).length;
export const TRIP_START_DATE = ITINERARY[0]?.date ?? '2026-06-11';
export const TRIP_END_DATE = ITINERARY[ITINERARY.length - 1]?.date ?? '2026-07-19';
// Casey's home — every trip leg starts/ends here. The JFK→MEX departure is
// computed as TRIP_ORIGIN → Estadio Azteca; redeyes home land back here.
export const TRIP_ORIGIN = { lat: 40.7128, lng: -74.006, label: 'NYC' };
export const ADVERTISED_TOTAL_MILES = 40_112;

export const DEFAULT_SPEND = {
  budgetTotal: 68_263,
  travelBudget: 17_500,
  ticketsBudget: 38_763,
  incidentalsBudget: 12_000,
  travelActual: 17_500,
  ticketsActual: 0,
  incidentalsActual: 0,
  // Seed timestamp — overwritten on every admin save (setSpend stamps
  // updatedAt with the current time). Set to the day this default
  // landed so the panel reads honestly until the first edit.
  updatedAt: '2026-06-03T00:00:00.000Z',
};

export function getStadium(id: string): Stadium | null {
  return STADIUMS[id] ?? null;
}

export function getMatch(matchNumber: number): ItineraryMatch | null {
  return ITINERARY.find((m) => m.matchNumber === matchNumber) ?? null;
}
