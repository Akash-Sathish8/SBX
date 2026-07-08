// Sport/league registry for SBX v2 (US sports). Everything downstream — ESPN
// fetches, team logos, UI labels, sport filtering — keys off this table, so
// adding a league is a single entry here. Replaces the WC-era single-tournament
// assumption baked into the old data layer.

export type League = 'nfl' | 'nba' | 'mlb' | 'nhl' | 'college-football' | 'college-basketball'

export interface SportDef {
  key: League
  label: string // short UI label, e.g. 'NFL'
  sport: string // human sport name, e.g. 'Football'
  espnPath: string // ESPN site-API path segment, e.g. 'football/nfl'
  accent: string // accent hex for chips / cards
}

export const SPORTS: Record<League, SportDef> = {
  nfl: { key: 'nfl', label: 'NFL', sport: 'Football', espnPath: 'football/nfl', accent: '#013369' },
  nba: { key: 'nba', label: 'NBA', sport: 'Basketball', espnPath: 'basketball/nba', accent: '#c8102e' },
  mlb: { key: 'mlb', label: 'MLB', sport: 'Baseball', espnPath: 'baseball/mlb', accent: '#041e42' },
  nhl: { key: 'nhl', label: 'NHL', sport: 'Hockey', espnPath: 'hockey/nhl', accent: '#0033a0' },
  'college-football': { key: 'college-football', label: 'CFB', sport: 'Football', espnPath: 'football/college-football', accent: '#9e1b32' },
  'college-basketball': { key: 'college-basketball', label: 'CBB', sport: 'Basketball', espnPath: 'basketball/mens-college-basketball', accent: '#f47321' },
}

// Stable display order across the app (filter rails, tabs, etc.).
// MLB leads: it's the in-season hero sport; NFL/NBA stay supported but secondary.
export const LEAGUES: League[] = ['mlb', 'nfl', 'nba', 'nhl']

// The sport we lead with on exploration surfaces while it's the only live one.
export const HERO_LEAGUE: League = 'mlb'

// College leagues hold conferences + schools only (no games/venues); kept OUT of
// LEAGUES so the pro surfaces get no empty chips. Drives the /conferences page.
export const COLLEGE_LEAGUES: League[] = ['college-football', 'college-basketball']
export const isCollegeLeague = (s: string | undefined | null): s is League =>
  s === 'college-football' || s === 'college-basketball'

// Leagues whose games are seeded in D1 and can be rated on /rank. Pro leagues (incl.
// NHL) plus the college sports that now have a full 2025-26 season of games.
export const RANKABLE_LEAGUES: League[] = [...LEAGUES, 'college-football', 'college-basketball']

// Valid league = any key in SPORTS (pro + college). College games/venues just
// return [] from their endpoints, which is harmless.
export const isLeague = (s: string | undefined | null): s is League =>
  !!s && Object.prototype.hasOwnProperty.call(SPORTS, s)

export const sportDef = (league: League): SportDef => SPORTS[league]

// ESPN serves team logos off a stable CDN path keyed by lowercase team
// abbreviation. The /scoreboard variant is sized + transparent for dark cards;
// the plain variant is the full-color mark. ESPN also returns an explicit
// `team.logo` URL per game — prefer that when present and fall back to this.
export function teamLogo(league: League, abbr: string, variant: 'scoreboard' | 'full' = 'scoreboard'): string {
  const a = abbr.toLowerCase()
  return variant === 'scoreboard'
    ? `https://a.espncdn.com/i/teamlogos/${league}/500/scoreboard/${a}.png`
    : `https://a.espncdn.com/i/teamlogos/${league}/500/${a}.png`
}
