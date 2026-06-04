// Phase-1 read-only stand-in for the Supabase-backed KV.
// No admin writes exist in Phase 1, so every read returns its documented default.
import { DEFAULT_SPEND } from './itinerary';
import type {
  MatchResult, PositionOverride, SpendTracker, MatchFieldOverride, StadiumOverride,
} from './types';

export interface VisibilityFlags { showLodging: boolean; showTransport: boolean; }
export const DEFAULT_VISIBILITY: VisibilityFlags = { showLodging: false, showTransport: false };

export async function getAllResults(): Promise<Record<number, MatchResult>> { return {}; }
export async function getPositionOverride(): Promise<PositionOverride | null> { return null; }
export async function getSpend(): Promise<SpendTracker> { return { ...DEFAULT_SPEND }; }
export async function getAllMatchOverrides(): Promise<Record<number, MatchFieldOverride>> { return {}; }
export async function getAllYouTubeIds(): Promise<Record<number, string>> { return {}; }
export async function getAllStadiumOverrides(): Promise<Record<string, StadiumOverride>> { return {}; }
export async function getVisibilityFlags(): Promise<VisibilityFlags> { return { ...DEFAULT_VISIBILITY }; }
