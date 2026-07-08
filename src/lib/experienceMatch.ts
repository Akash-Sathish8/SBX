// Venue → expert experience matching for the "Snapback Score" surfaces.
// Adapted from arcade-demo's experienceMatch.ts to intern-sbx's Experience shape
// (exp_name not name, venue_id-based, SportsVenue not Venue).
import type { SportsVenue, Experience } from './data-types'

// Pinned venue id → experience name. Covers shared venues (MetLife: Jets vs Giants),
// event-named experiences (Rose Bowl), and disambiguation (multiple teams per arena).
export const EXP_OVERRIDE: Record<string, string> = {
  // MLB
  '16': 'Chicago Cubs',
  '47': 'Pittsburgh Pirates',
  '83': 'Cincinnati Reds',
  '84': 'Philadelphia Phillies',
  '87': 'St. Louis Cardinals',
  '208': 'Yankees World Series',
  '218': 'Atlanta Braves',
  '4242': 'Milwaukee Brewers',
  // NFL (slug IDs we seeded)
  'lambeau-nfl': 'Green Bay Packers',
  'arrowhead-nfl': 'Kansas City Chiefs',
  'att-nfl': 'Dallas Cowboys',
  'sofi-nfl': 'Los Angeles Rams',
  'allegiant-nfl': 'Las Vegas Raiders',
  'linc-nfl': 'Philadelphia Eagles',
  'highmark-nfl': 'Buffalo Bills',
  'acrisure-nfl': 'Pittsburgh Steelers',
  'soldier-nfl': 'Chicago Bears',
  'metlife-nfl': 'New York Jets',
  'fedex-nfl': 'Washington Commanders',
  'levis-nfl': 'San Francisco 49ers',
  // NBA
  'msg-nba': 'New York Knicks',
  'td-garden-nba': '2024 NBA Finals (Celtics vs. Mavericks)',
  'crypto-nba': 'Los Angeles Lakers',
  // CFB
  'mich-stadium-cfb': 'Michigan Wolverines — The Big House',
  'pennst-cfb': 'Penn State White Out',
  'lsu-cfb': 'LSU Tigers Football',
  'sanford-cfb': 'Georgia Bulldogs Football',
  // Numeric CFB IDs
  '347': 'Wisconsin Badgers Football',
  '1056': '2025 Rose Bowl (Ohio State vs. Oregon)',
  '3657': 'Alabama Crimson Tide Football',
  '3853': 'Tennessee Volunteers Football',
  '3726': 'Colorado Buffaloes',
  '3861': 'Ohio State Buckeyes',
  '3855': 'Notre Dame CFP',
  '3801': 'BYU Holy War',
  '3795': 'Texas A&M (vs. Texas)',
  '3948': 'Miami Hurricanes',
  '5348': '2025 CFP National Championship (ND vs. OSU)',
  '3696': 'Kent State MACtion',
}

export function matchExperienceForVenue(v: SportsVenue, exps: Experience[]): Experience | null {
  const forced = EXP_OVERRIDE[String(v.id)]
  if (forced) {
    const m = exps.find(e => e.exp_name.toLowerCase() === forced.toLowerCase())
    if (m) return m
  }
  const teamNames = (v.teams ?? []).map(t => t.toLowerCase()).filter(t => t.length > 5)
  return exps.find(e => {
    const n = e.exp_name.toLowerCase()
    return teamNames.some(dn => n.includes(dn))
  }) ?? null
}

export function matchExperienceForTeam(displayName: string, exps: Experience[]): Experience | null {
  const dn = (displayName || '').toLowerCase()
  if (dn.length <= 5) return null
  return exps.find(e => e.exp_name.toLowerCase().includes(dn)) ?? null
}
