import { ITINERARY, STADIUMS } from './itinerary';
import {
  getAllMatchOverrides,
  getAllResults,
  getAllStadiumOverrides,
  getAllYouTubeIds,
} from './kv';
import type { ItineraryMatch, Stadium } from './types';

export async function getMergedItinerary(): Promise<ItineraryMatch[]> {
  const [overrides, results, ytIds] = await Promise.all([
    getAllMatchOverrides(),
    getAllResults(),
    getAllYouTubeIds(),
  ]);
  return ITINERARY.map((match) => {
    const override = overrides[match.matchNumber] ?? {};
    const result = results[match.matchNumber] ?? null;
    const ytId = ytIds[match.matchNumber] ?? null;
    return {
      ...match,
      ...override,
      result,
      youtubeId: ytId ?? match.youtubeId,
    };
  });
}

export async function getMergedStadiums(): Promise<Record<string, Stadium>> {
  const overrides = await getAllStadiumOverrides();
  const out: Record<string, Stadium> = {};
  for (const [id, stadium] of Object.entries(STADIUMS)) {
    out[id] = { ...stadium, ...overrides[id] };
  }
  return out;
}
