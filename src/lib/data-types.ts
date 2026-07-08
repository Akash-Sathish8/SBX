// Shapes for the build-time-static datasets the SBX routes import/fetch: the
// fixture list (games-index.json), fan intel (fanintel.json), and the per-venue
// detail JSON (public/data/venues/*.json). These were previously read as `any`
// in 5+ routes, so a JSON field rename compiled clean and rendered blank.

export interface Game {
  id: string
  venue: string
  venueName: string
  city: string
  country: string
  date: string
  dateISO: string
  ko: string
  round: string
  fixture: string
  home: string | null // null for TBD knockout fixtures (teams not yet set)
  away: string | null
  tbd: boolean
  hasDetail: boolean
}

export interface March {
  flag?: string
  title?: string
  badge?: string
  city?: string
  when?: string
  route?: string
  note?: string
  venue: string
  points?: string[]
  sources?: { label: string; url: string }[]
  meet?: { spot?: string; address?: string }
}

export interface VenueIntel {
  wcName?: string
  capacity?: { text?: string; badge?: string }
  fields?: unknown[]
  sources?: { label: string; url: string }[]
  location?: unknown
}

export interface FanIntel {
  venues: Record<string, VenueIntel>
  marches: March[]
}

// The per-venue detail JSON is deeply + variably nested; the top level (the part
// routes branch on) is typed, while the leaf collections stay loose since each
// section maps over them with its own local adapters.
export interface Venue {
  id: string
  name: string
  fifaName?: string
  nickname?: string
  city: string
  country: string
  cc: string
  role?: string
  hero?: string
  why?: { title: string; text: string }[]
  matches?: { date: string; fixture?: string }[]
  gettingThere?: string
  transit?: string[]
  around?: { pre?: any[]; food?: any[]; post?: any[]; merch?: any[] }
  food?: string[]
  tips?: string[]
  weather?: string
  lore?: string[]
  transport?: {
    rail?: any[]
    bus?: any[]
    shuttle?: any[]
    fromAirport?: string
    rideshare?: string
    bike?: string
    tips?: string[]
  }
  parking?: { lots?: any[]; prepaid?: string; accessible?: string; tailgating?: string; tips?: string[]; summary?: string }
}

// ---- Field Guide v2 types ----

export type League = 'NFL' | 'MLB' | 'NBA' | 'NHL' | 'CFB' | 'CBB' | 'other'

export interface Experience {
  id: string
  venue_id: string
  venue_name: string
  exp_name: string
  league: League
  team: string | null
  rank: number
  fans: number
  food: number
  unique: number
  stadium: number
  final: number
  review_body: string
  tips: [string, string][]
  image?: string
}

export interface SportsVenue {
  id: string
  slug: string
  name: string
  city: string
  state: string
  country: string
  leagues: League[]
  teams: string[]
  capacity: number
  opened: number
  hero_url: string
  lat: number
  lng: number
  snapback_score: number
  description: string
}

export interface Team {
  id: string
  name: string
  abbr: string
  city: string
  state: string
  venue_id: string
  conference: string
  division: string | null
  logo_url: string
  primary_color: string
  secondary_color: string
}

export interface Teams {
  NFL: Team[]
  MLB: Team[]
  NBA: Team[]
  NHL: Team[]
  CFB: Team[]
  CBB: Team[]
}

export interface ConferenceMember {
  id: string
  name: string
  abbr: string
  espn_id?: string
}

export interface Conference {
  id: string
  name: string
  sport: 'CFB' | 'CBB'
  abbr: string
  members: ConferenceMember[]
}

// Lightweight game summary from ESPN scoreboard overlay
export interface LiveGame {
  id: string
  sport: string
  name: string
  shortName: string
  date: string
  statusType: string
  statusDesc: string
  clock: string
  period: number
  isLive: boolean
  isFinal: boolean
  home: { teamId: string; abbr: string; name: string; logo: string; score: string }
  away: { teamId: string; abbr: string; name: string; logo: string; score: string }
  venueId: string | null
  venueName: string | null
  venueCity: string | null
}

// Community types (D1-backed)
export interface Review {
  id: string
  user_id: string
  venue_id: string | null
  game_id: string | null
  rating: number
  body: string | null
  created_at: number
  updated_at: number
  // joined
  username?: string | null
  display_name?: string | null
  avatar_url?: string | null
}

export interface Tip {
  id: string
  user_id: string
  venue_id: string | null
  game_id: string | null
  section: string
  body: string
  upvotes: number
  created_at: number
  username?: string | null
  display_name?: string | null
}

export interface PersonalRanking {
  id: string
  user_id: string
  experience_id: string
  game_id: string | null
  fans_score: number | null
  food_score: number | null
  unique_score: number | null
  stadium_score: number | null
  notes: string | null
  attended_at: number | null
  created_at: number
  updated_at: number
}

export interface PublicUser {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  created_at: number
}
