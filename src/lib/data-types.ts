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
