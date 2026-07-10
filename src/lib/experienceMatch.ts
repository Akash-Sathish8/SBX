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
  // Event venues seeded by scripts/seed-event-venues.mjs (no ESPN tenants).
  'ev-churchill-downs': 'Kentucky Derby',
  'ev-indy-motor-speedway': 'Indy 500',
  'ev-cotton-bowl': 'Red River Rivalry',
  'ev-bethpage-black': 'Ryder Cup NYC',
  'ev-washington-grizzly': 'Brawl of the Wild Montana',
  'ev-daytona-speedway': 'Daytona 500',
  'ev-chicago-street-course': 'NASCAR Chicago Street Race',
  'ev-nassau-cricket-stadium': 'India vs. Pakistan Cricket T20 World Cup',
  'ev-homewood-field': 'Premier Lacrosse League',
  'ev-lower-com-field': 'USMNT World Cup Qualifier',
  'ev-dana-j-dykhouse': 'SDSU Dakota Marker',
  'ev-talladega-superspeedway': 'NASCAR Talladega RV Infield',
  'ev-new-york-harbor': 'SailGP',
  'ev-red-bull-arena': 'Hudson River Derby',
  'ev-steinbrenner-field': 'Rays at Steinbrenner Field',
  'ev-phoenix-raceway': 'NASCAR Championship',
  'ev-arthur-ashe': 'US Open Tennis',
  'ev-franklin-field': 'UPenn Football',
  'ev-alumni-stadium-dsu': 'Delaware State Football Homecoming',
  'ev-sonoma-raceway': 'Sonoma NASCAR',
  'ev-pimlico': 'Preakness',
  'ev-gulfstream-park': 'Pegasus World Cup',
  'ev-oakland-coliseum': "Oakland A's",
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

// The reverse direction: the D1 venue behind an experience (the rankings
// spotlight's "Plan this trip" link). Event-named experiences at venues that
// exist in D1 but have no EXP_OVERRIDE entry are pinned here; experiences at
// venues Snapback doesn't track (Churchill Downs, speedways, golf courses)
// stay unpinned — no venue page exists, so no link is shown. Honest gap.
const EXP_VENUE_PIN: Record<string, string> = {
  'National Championship 2026': '3948', // Hard Rock Stadium
  'CFB National Championship (Alabama vs. OSU)': '3948',
  'WWE Wrestlemania 41': '6501', // Allegiant Stadium
  'Super Bowl LVIII': '6501',
  'NFL Pro Bowl': '6501',
  '2025 4 Nations Final Canada-USA': '1824', // TD Garden
  'Minnesota High School Hockey Tourney': '1835', // Grand Casino Arena (ex-Xcel)
  'Texas at Ohio State - 2025 Week 1': '3861', // Ohio Stadium
  'Ohio State CFP': '3861',
  '2024 CFB Semifinal (Washington vs. Texas)': '3493', // Caesars Superdome
  'Super Bowl LIX (Chiefs vs. Eagles)': '3493',
  'Neymar/Brazil Copa America Match': '7065', // SoFi Stadium
  'USMNT vs Panama (Nations League Semifinal)': '7065',
  'UFC 296': '5060', // T-Mobile Arena
  'UCF 326': '5060',
  'Penn State Whiteout CFP': '3632', // Beaver Stadium
  'Penn State Outdoor Hockey': '3632',
  "St. John's in MSG": '1830', // Madison Square Garden
  'WWE (House Show)': '1830',
  'Big East Tournament (UConn vs. Providence)': '1830',
  '2023 March Madness Elite 8 (FAU vs. K State)': '1830',
  'Champions Classic (Kentucky vs. Michigan St.)': '1830',
  '2K Classic (Georgetown vs. Texas)': '1830',
  'New York Liberty': '3559', // Barclays Center
  'A10 Tournament': '3559',
  'Atlanta United': '5348', // Mercedes-Benz Stadium
  'CFB Backyard Brawl (WVU @ Pitt)': '3752', // Acrisure Stadium
  'Georgia-Florida Rivalry Game': '3712', // EverBank Stadium
  'NBA Summer League': '2083', // Thomas & Mack Center
  '2022 NBA Finals (Warriors vs. Celtics)': '6270', // Chase Center
  'Argentina - 2024 Copa America': '3839', // MetLife Stadium
  '2024 Army-Navy Game': '3719', // Northwest Stadium
  'Tampa Bay Bucaneeers': '3886', // Raymond James Stadium
  'Big 12 Championship': '3687', // AT&T Stadium
  'Chicago Fire': '3933', // Soldier Field
  '2023 NBA Finals (Heat vs. Nuggets)': '892', // Ball Arena
  'NJ Devils Playoff Game': '1826', // Prudential Center
  'NBA All-Star Game': '3093', // Delta Center
  'NASCAR Clash at the Coliseum': '477', // LA Memorial Coliseum
  'Charlotte FC': '3628', // Bank of America Stadium
  'PGA Championship 2019': 'ev-bethpage-black', // shares Bethpage with Ryder Cup NYC
}

// experience name (lowercased) -> venue id: reversed overrides + explicit pins
// (pins win — an override value names the experience Snapback filmed there,
// which isn't always the experience a ranking row refers to).
const VENUE_BY_EXP: Record<string, string> = {}
for (const [vid, exp] of Object.entries(EXP_OVERRIDE)) {
  const k = exp.toLowerCase()
  if (!(k in VENUE_BY_EXP)) VENUE_BY_EXP[k] = vid
}
for (const [exp, vid] of Object.entries(EXP_VENUE_PIN)) VENUE_BY_EXP[exp.toLowerCase()] = vid

// Venue for an experience: pinned mapping first, then team-name auto-match
// (e.g. "Chicago Cubs" -> Wrigley). Returns null when the venue isn't in D1.
export function matchVenueForExperience(expName: string, venues: Venue[]): Venue | null {
  const n = expName.toLowerCase()
  const pinned = VENUE_BY_EXP[n]
  if (pinned) {
    const v = venues.find((v) => v.id === pinned)
    if (v) return v
  }
  for (const ven of venues) {
    for (const t of ven.teams || []) {
      const dn = (t.displayName || '').toLowerCase()
      if (dn.length > 5 && n.includes(dn)) return ven
    }
  }
  return null
}
