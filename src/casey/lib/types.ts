export interface Stadium {
  id: string;
  name: string;
  city: string;
  state: string | null;
  country: string;
  countryName: string;
  lat: number;
  lng: number;
  timezone: string;
  capacity: number;
  heroImage?: string;
}

export type MatchStatus = 'scheduled' | 'live' | 'final' | 'postponed' | 'cancelled';

export interface MatchResult {
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  notes: string | null;
  updatedAt?: string;
}

export type LodgingType = 'hotel' | 'home' | 'friends' | 'family' | 'redeye';
export type TransportMode = 'flight' | 'train' | 'home';

export interface Lodging {
  name: string;
  type: LodgingType;
}

export interface RouteVia {
  lat: number;
  lng: number;
  city: string;
}

export interface ItineraryMatch {
  matchNumber: number;
  dayNumber: number;
  date: string;
  stage: string;
  match: string;
  homeTeam: string;
  awayTeam: string;
  stadiumId: string;
  kickoffLocal: string;
  kickoffTZ: string;
  sleepCity: string;
  sleepLat: number;
  sleepLng: number;
  youtubeId: string | null;
  result: MatchResult | null;
  notes: string | null;
  scheduleVerified?: boolean;
  scheduleSource?: string;
  lodging?: Lodging | null;
  transportMode?: TransportMode | null;
  routeVia?: RouteVia | null;
  betSlipImage?: string;
}

export type CaseyState =
  | 'pre-trip'
  | 'at-stadium'
  | 'at-hotel'
  | 'in-transit'
  | 'post-trip';

export interface CaseyLocation {
  state: CaseyState;
  lat: number;
  lng: number;
  description: string;
  currentMatchNumber: number | null;
  nextMatchNumber: number | null;
  fromStadiumId?: string;
  toStadiumId?: string;
  progressPercent?: number;
  computedAt: string;
}

export interface SpendLineItem {
  category: 'travel' | 'tickets' | 'incidentals';
  label: string;
  amount: number;
  notes?: string;
}

export interface SpendTracker {
  budgetTotal: number;
  travelBudget: number;
  ticketsBudget: number;
  incidentalsBudget: number;
  travelActual: number;
  ticketsActual: number;
  incidentalsActual: number;
  lineItems?: SpendLineItem[];
  updatedAt?: string;
}

export interface PositionOverride {
  active: boolean;
  stadiumId?: string;
  lat?: number;
  lng?: number;
  description?: string;
  startsAt?: string;
  expiresAt?: string;
}

export interface TripStats {
  matchesAttended: number;
  matchesTotal: number;
  dayNumber: number;
  daysTotal: number;
  milesFlown: number;
  milesTotal: number;
  stadiumsVisited: number;
  stadiumsTotal: number;
  countriesVisited: number;
  nextMatchInMs: number | null;
  nextMatchNumber: number | null;
}

export interface MatchFieldOverride {
  match?: string;
  homeTeam?: string;
  awayTeam?: string;
  stadiumId?: string;
  kickoffLocal?: string;
  kickoffTZ?: string;
  sleepCity?: string;
  sleepLat?: number;
  sleepLng?: number;
  notes?: string | null;
  betSlipImage?: string;
}

export interface StadiumOverride {
  heroImage?: string;
}
