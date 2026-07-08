// Venue/team → expert experience matching (the "Snapback Score" source).
// Extracted from venue.tsx so team pages and next-hop modules share the exact
// same logic (and the same honest gaps: unmatched = no score shown).
import type { Venue } from './espn'
import type { Experience } from './experiences'

// Snapback Score for every venue Snapback has visited: map venue id to the exact
// experience name in experiences.json. The team-name auto-match misses event-named
// experiences (World Series) and shared venues (Jets vs Giants at MetLife), so the
// visited venues are pinned explicitly here.
export const EXP_OVERRIDE: Record<string, string> = {
  '3632': 'Penn State White Out', // Beaver Stadium
  '30': 'World Series', // Chase Field
  '1949': 'Phoenix Suns', // Mortgage Matchup Center
  '3752': 'Pittsburgh Steelers', // Acrisure Stadium
  '3933': 'Chicago Bears', // Soldier Field
  '3839': 'New York Jets', // MetLife Stadium
  '3687': 'Dallas Cowboys', // AT&T Stadium
  '3622': 'Kansas City Chiefs', // GEHA Field at Arrowhead
  '3806': 'Philadelphia Eagles', // Lincoln Financial Field
  '4738': 'San Francisco 49ers', // Levi's Stadium
  '3798': 'Green Bay Packers', // Lambeau Field
  '3719': 'Washington Commanders', // Northwest Stadium
  '3493': 'New Orleans Saints', // Caesars Superdome
  '3883': 'Buffalo Bills', // Highmark Stadium
  '3814': 'Baltimore Ravens', // M&T Bank Stadium
  '6501': 'Las Vegas Raiders', // Allegiant Stadium
  '7065': 'Los Angeles Rams', // SoFi Stadium
  '3679': 'Cleveland Browns', // Huntington Bank Field
  '1841': 'Los Angeles Lakers', // crypto.com Arena
  '1830': 'New York Knicks', // Madison Square Garden
  '1845': 'Philadelphia 76ers', // Xfinity Mobile Arena (Wells Fargo Center)
  '1824': '2024 NBA Finals (Celtics vs. Mavericks)', // TD Garden
  '1827': 'Atlanta Hawks', // State Farm Arena
  '43': 'San Francisco Giants', // Oracle Park
  '4242': 'Milwaukee Brewers', // American Family Field
  '87': 'St. Louis Cardinals', // Busch Stadium
  '83': 'Cincinnati Reds', // Great American Ball Park
  '16': 'Chicago Cubs', // Wrigley Field
  '47': 'Pittsburgh Pirates', // PNC Park
  '84': 'Philadelphia Phillies', // Citizens Bank Park
  '218': 'Atlanta Braves', // Truist Park
  '3726': 'Colorado Buffaloes', // Folsom Field
  '3657': 'Alabama Crimson Tide Football', // Bryant-Denny Stadium
  '3853': 'Tennessee Volunteers Football', // Neyland Stadium
  '3948': 'Miami Hurricanes', // Hard Rock Stadium
  '208': 'Yankees World Series', // Yankee Stadium
  '347': 'Wisconsin Badgers Football', // Camp Randall Stadium
  '3696': 'Kent State MACtion', // Dix Stadium
  '3795': 'Texas A&M (vs. Texas)', // Kyle Field
  '3861': 'Ohio State Buckeyes', // Ohio Stadium
  '3855': 'Notre Dame CFP', // Notre Dame Stadium
  '3910': 'Texas CFP', // DKR-Texas Memorial Stadium
  '5348': '2025 CFP National Championship (ND vs. OSU)', // Mercedes-Benz Stadium
  '1056': '2025 Rose Bowl (Ohio State vs. Oregon)', // Rose Bowl
  '7317': "KD's Return to Austin (Spurs vs. Suns)", // Moody Center
  '516': "Luka's Return (Mavericks vs. Lakers)", // American Airlines Center
  '10642': 'Los Angeles Clippers', // Intuit Dome
  '5404': 'Detroit Pistons Playoff Game', // Little Caesars Arena
  '3739': 'Italian Bowl XLIV', // Glass Bowl
  '3610': "Hawai'i Rainbow Warriors Football", // Aloha Stadium
  '3787': "UNC - Bill Belichick's 1st Game", // Kenan Stadium
  '3626': 'Oregon Football', // Autzen Stadium
  '3654': 'Coastal Carolina All You Can Eat', // Brooks Stadium
  '3974': 'Ole Miss Football', // Vaught-Hemingway Stadium
  '3834': 'Nebraska Football', // Memorial Stadium (Lincoln)
  '3801': 'BYU Holy War', // LaVell Edwards Stadium
  '3772': 'Iowa State Football', // Jack Trice Stadium
  '3784': 'Texas Tech Football', // Jones AT&T Stadium
  '3785': 'Iron Bowl @ Auburn', // Jordan-Hare Stadium
  '3994': 'Palmetto Bowl @ SCAR', // Williams-Brice Stadium
  '3700': 'BGSU Midweek Maction', // Doyt L. Perry Stadium
  '3835': 'Oklahoma Home CFP', // Memorial Stadium (Norman)
  '3653': 'Idaho Potato Bowl', // Albertsons Stadium
  '2024': 'New Mexico Lobos Basketball', // The Pit
  '3947': 'ASU Blackout', // Mountain America Stadium
  '3970': 'Arizona Cardinals', // State Farm Stadium
}

// Match a venue to an expert experience: pinned override first, then team-name
// auto-match (e.g. "Chicago Cubs" → Wrigley). Event-based experiences won't
// auto-match — honest gap.
export function matchExperienceForVenue(v: Venue, exps: Experience[]): Experience | null {
  const forced = EXP_OVERRIDE[v.id]
  if (forced) {
    const m = exps.find((e) => e.name.toLowerCase() === forced.toLowerCase())
    if (m) return m
  }
  const teamNames = v.teams.map((t) => (t.displayName || '').toLowerCase()).filter((d) => d.length > 5)
  return exps.find((e) => { const n = e.name.toLowerCase(); return teamNames.some((dn) => n.includes(dn)) }) ?? null
}

// Match a single team by display name (team pages, search results).
export function matchExperienceForTeam(displayName: string, exps: Experience[]): Experience | null {
  const dn = (displayName || '').toLowerCase()
  if (dn.length <= 5) return null
  return exps.find((e) => e.name.toLowerCase().includes(dn)) ?? null
}
