import { describe, it, expect } from 'vitest';
import { computeCaseyLocation } from '@/lib/location';
import { ITINERARY, getStadium } from '@/lib/itinerary';
import { zonedTimeToUtc } from '@/lib/time';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

function kickoffMs(matchNumber: number): number {
  const m = ITINERARY.find((x) => x.matchNumber === matchNumber)!;
  return zonedTimeToUtc(m.kickoffLocal, m.kickoffTZ).getTime();
}

describe('schedule kickoff times match the official schedule', () => {
  // The four matches whose local kickoff had drifted from public/data
  // _official_schedule.json. Expected values are the official local kickoff
  // converted to UTC for that venue's timezone.
  it('opener (Azteca, Jun 11) is 1PM Mexico City = 3PM ET = 19:00 UTC', () => {
    expect(new Date(kickoffMs(1)).toISOString()).toBe('2026-06-11T19:00:00.000Z');
  });
  it('match 7 (ATT, Jun 17) is 3PM CDT = 20:00 UTC', () => {
    expect(new Date(kickoffMs(7)).toISOString()).toBe('2026-06-17T20:00:00.000Z');
  });
  it('match 8 (BC Place, Jun 18) is 3PM PDT = 22:00 UTC', () => {
    expect(new Date(kickoffMs(8)).toISOString()).toBe('2026-06-18T22:00:00.000Z');
  });
  it('match 14 (Mercedes-Benz, Jun 24) is 6PM EDT = 22:00 UTC', () => {
    expect(new Date(kickoffMs(14)).toISOString()).toBe('2026-06-24T22:00:00.000Z');
  });
});

describe('Casey location follows the itinerary', () => {
  // The exact scenario the bug report described: at 5h50m before the opener
  // Casey was shown still in New York. He flew down overnight and should be in
  // Mexico City by then — never pinned at the NYC fallback.
  it('is in Mexico City (not New York) the morning of the opener', () => {
    const loc = computeCaseyLocation(new Date(kickoffMs(1) - (5 * HOUR + 50 * MIN)));
    expect(loc.lng).toBeLessThan(-90); // Mexico City -99 vs NYC -74
    expect(loc.lat).toBeLessThan(25); //  Mexico City ~19 vs NYC ~41
    expect(loc.state).not.toBe('pre-trip');
    expect(loc.nextMatchNumber).toBe(1);
  });

  it('travels NYC -> Mexico City across the night before the opener', () => {
    const ko = kickoffMs(1);
    const samples: { t: number; lng: number; state: string }[] = [];
    for (let t = ko - 24 * HOUR; t <= ko - 2 * HOUR; t += 15 * MIN) {
      const loc = computeCaseyLocation(new Date(t));
      samples.push({ t, lng: loc.lng, state: loc.state });
    }
    // Starts at home in NYC...
    expect(samples[0].lng).toBeGreaterThan(-80);
    // ...spends real time airborne...
    const transit = samples.filter((s) => s.state === 'in-transit');
    expect(transit.length).toBeGreaterThan(0);
    // ...passes through the middle of the continent while airborne...
    expect(transit.some((s) => s.lng < -80 && s.lng > -98)).toBe(true);
    // ...and ends up in Mexico City.
    expect(samples[samples.length - 1].lng).toBeLessThan(-95);
    // Longitude only ever moves west on this leg (no teleport / backtrack).
    for (let i = 1; i < transit.length; i++) {
      expect(transit[i].lng).toBeLessThanOrEqual(transit[i - 1].lng + 0.5);
    }
  });

  // "Always where the data puts him": one hour before every kickoff he is
  // inside that match's stadium window, at that stadium.
  it('is at the right stadium an hour before every kickoff', () => {
    for (const m of ITINERARY) {
      const stadium = getStadium(m.stadiumId)!;
      const loc = computeCaseyLocation(new Date(kickoffMs(m.matchNumber) - HOUR));
      expect(loc.state, `match ${m.matchNumber}`).toBe('at-stadium');
      expect(loc.currentMatchNumber, `match ${m.matchNumber}`).toBe(m.matchNumber);
      expect(Math.abs(loc.lat - stadium.lat), `match ${m.matchNumber} lat`).toBeLessThan(0.3);
      expect(Math.abs(loc.lng - stadium.lng), `match ${m.matchNumber} lng`).toBeLessThan(0.3);
    }
  });

  it('animates the LAX -> JFK redeye after the USA opener (match 2)', () => {
    // Match 2 is at SoFi (LA) and Casey sleeps in NYC — the redeye should move.
    const windowEnd = kickoffMs(2) + 4 * HOUR;
    const loc = computeCaseyLocation(new Date(windowEnd + 1 * HOUR));
    expect(loc.state).toBe('in-transit');
    expect(loc.toLabel).toBe('New York City');
    // Eastbound: somewhere between LA (-118) and NYC (-74).
    expect(loc.lng).toBeGreaterThan(-118);
    expect(loc.lng).toBeLessThan(-74);
  });
});

describe('admin override still wins', () => {
  it('pins Casey at an override stadium', () => {
    const loc = computeCaseyLocation(new Date(kickoffMs(1) - 6 * HOUR), {
      active: true,
      stadiumId: 'metlife_stadium',
    });
    expect(loc.state).toBe('at-stadium');
    const metlife = getStadium('metlife_stadium')!;
    expect(loc.lat).toBeCloseTo(metlife.lat, 3);
  });
});
