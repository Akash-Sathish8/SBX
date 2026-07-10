// Build public/data/experiences.json from experiences.csv:
//   - drop every non-US experience (per product decision)
//   - re-rank the remainder #1..N by final score (desc)
//   - emit the distinct sport list for the filter
// Re-run after editing the CSV:  node scripts/build-experiences.mjs
import fs from 'node:fs'

const csv = fs.readFileSync(new URL('../public/data/experiences.csv', import.meta.url), 'utf8').trim()
const rows = csv.split('\n').slice(1)

function parseCsvLine(line) {
  const out = []
  let cur = '', q = false
  for (const c of line) {
    if (c === '"') q = !q
    else if (c === ',' && !q) { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur)
  return out
}

// A location is non-US if it names a foreign country/region. On-US-soil events
// (e.g. India vs Pakistan in East Meadow, NY) stay.
const FOREIGN = /(France|Germany|Canada|Ireland|Spain|Brazil|England|Italy|Mexico|, MX|Quebec|Alberta|British Columbia|Ontario)/

const all = rows.map(parseCsvLine).map((f) => ({
  name: f[1], location: f[2], sport: f[3],
  fans: +f[4], food: +f[5], unique: +f[6], stadium: +f[7], final: +f[8],
}))

// Curated venue photos, keyed by exact experience name. Team experiences whose
// team exists in /api/venues (Chicago Cubs → Wrigley, etc.) get their photo at
// runtime and don't need an entry; everything else (events, college football,
// NASCAR, venues missing a DB image) is curated here so every ranked experience
// renders with an image.
const IMAGES = {
  'National Championship 2026': '/img/stadiums/hardrock.jpg', // Hard Rock Stadium, Miami (CFP host)
  'Kentucky Derby': '/img/exp/churchill-downs.jpg',
  'Indy 500': '/img/exp/indianapolis-motor-speedway.jpg',
  'BYU Holy War': '/img/exp/lavell-edwards-stadium.jpg',
  // Every remaining experience the runtime team-match can't cover, mapped to a
  // photo of its real venue (Wikipedia lead images / Wikimedia Commons, 960px
  // thumbs — same hotlink pattern the venues DB already uses). Local
  // /img/stadiums assets reused where the venue is already in the repo.
  "Red River Rivalry": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/View_from_Top_o%27_Texas_Tower_September_2019_10_%28Cotton_Bowl%29.jpg/960px-View_from_Top_o%27_Texas_Tower_September_2019_10_%28Cotton_Bowl%29.jpg",
  "WWE Wrestlemania 41": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Allegiant_Stadium_Street_View_on_Super_Bowl_LVIII.jpg/960px-Allegiant_Stadium_Street_View_on_Super_Bowl_LVIII.jpg",
  "Super Bowl LVIII": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Allegiant_Stadium_Street_View_on_Super_Bowl_LVIII.jpg/960px-Allegiant_Stadium_Street_View_on_Super_Bowl_LVIII.jpg",
  "Ryder Cup NYC": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Bethpage-golf1.jpg/960px-Bethpage-golf1.jpg",
  "Yankees World Series": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Yankee_Stadium_overhead_2010.jpg/960px-Yankee_Stadium_overhead_2010.jpg",
  "2025 Rose Bowl (Ohio State vs. Oregon)": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/2018.06.17_Over_the_Rose_Bowl%2C_Pasadena%2C_CA_USA_0039_%2842855669451%29_%28cropped%29.jpg/960px-2018.06.17_Over_the_Rose_Bowl%2C_Pasadena%2C_CA_USA_0039_%2842855669451%29_%28cropped%29.jpg",
  "2025 4 Nations Final Canada-USA": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/TD_Garden_%2854960947755%29.jpg/960px-TD_Garden_%2854960947755%29.jpg",
  "Minnesota High School Hockey Tourney": "https://upload.wikimedia.org/wikipedia/commons/8/84/XcelEnergyCenteroverview.jpg",
  "Nebraska Football": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Memorial_Stadium%2C_Home_of_the_University_of_Nebraska_Cornhuskers%2C_Lincoln%2C_Nebraska_%2869182817%29.jpg/960px-Memorial_Stadium%2C_Home_of_the_University_of_Nebraska_Cornhuskers%2C_Lincoln%2C_Nebraska_%2869182817%29.jpg",
  "2024 NBA Finals (Celtics vs. Mavericks)": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/TD_Garden_%2854960947755%29.jpg/960px-TD_Garden_%2854960947755%29.jpg",
  "Brawl of the Wild Montana": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Washington%E2%80%93Grizzly_Stadium_%28Missoula%2C_Montana%29.jpg/960px-Washington%E2%80%93Grizzly_Stadium_%28Missoula%2C_Montana%29.jpg",
  "Texas at Ohio State - 2025 Week 1": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Ohio_Stadium_Overhead.jpg/960px-Ohio_Stadium_Overhead.jpg",
  "Oklahoma Home CFP": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/OMU_with_2016_extension.jpg/960px-OMU_with_2016_extension.jpg",
  "2024 CFB Semifinal (Washington vs. Texas)": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Caesars_Superdome_New_Orleans%2C_LA.jpg/960px-Caesars_Superdome_New_Orleans%2C_LA.jpg",
  "Ohio State CFP": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Ohio_Stadium_Overhead.jpg/960px-Ohio_Stadium_Overhead.jpg",
  "World Series": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Reserve_A-10_Warthogs_Flyover_2023_World_Series_%288099146%29.jpg/960px-Reserve_A-10_Warthogs_Flyover_2023_World_Series_%288099146%29.jpg",
  "Luka's Return (Mavericks vs. Lakers)": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/American_Airlines_Center_August_2015.jpg/960px-American_Airlines_Center_August_2015.jpg",
  "Iron Bowl @ Auburn": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Jordan-Hare_Stadium_Exterior_2017.jpg/960px-Jordan-Hare_Stadium_Exterior_2017.jpg",
  "Texas A&M (vs. Texas)": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/Kyle_Field_Panorama.jpg/960px-Kyle_Field_Panorama.jpg",
  "Los Angeles Clippers": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Intuit_Dome_Fa%C3%A7ade.jpg/960px-Intuit_Dome_Fa%C3%A7ade.jpg",
  "Daytona 500": "https://upload.wikimedia.org/wikipedia/commons/d/d8/DaytonaInternationalSpeedwayAerial.jpg",
  "2025 CFP National Championship (ND vs. OSU)": "/img/stadiums/mercedes.jpg",
  "Neymar/Brazil Copa America Match": "/img/stadiums/sofi.jpg",
  "ASU Blackout": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Sun_Devil_Stadium_-_Pac12_Championship.jpg/960px-Sun_Devil_Stadium_-_Pac12_Championship.jpg",
  "UFC 296": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/T_Mobile_Arena_The_Strip_Las_Vegas_%2829798246202%29.jpg/960px-T_Mobile_Arena_The_Strip_Las_Vegas_%2829798246202%29.jpg",
  "UCF 326": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/T_Mobile_Arena_The_Strip_Las_Vegas_%2829798246202%29.jpg/960px-T_Mobile_Arena_The_Strip_Las_Vegas_%2829798246202%29.jpg",
  "Texas Tech Football": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Aerial_Drone_Jones_Stadium.jpg/960px-Aerial_Drone_Jones_Stadium.jpg",
  "Oregon Football": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Autzen_Stadium_at_night.jpg/960px-Autzen_Stadium_at_night.jpg",
  "Notre Dame CFP": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/NotreDameStadiumNight.jpg/960px-NotreDameStadiumNight.jpg",
  "Penn State Whiteout CFP": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Beaver_Stadium_Whiteout_2018_Pregame.jpg/960px-Beaver_Stadium_Whiteout_2018_Pregame.jpg",
  "St. John's in MSG": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Madison_Square_Garden_%28MSG%29_-_Full_%2848124330357%29.jpg/960px-Madison_Square_Garden_%28MSG%29_-_Full_%2848124330357%29.jpg",
  "New York Liberty": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Barclays_Center_-_May_2_2025.jpg/960px-Barclays_Center_-_May_2_2025.jpg",
  "NASCAR Chicago Street Race": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Ford_Mustang_NASCAR_%2853198227800%29.jpg/960px-Ford_Mustang_NASCAR_%2853198227800%29.jpg",
  "UNC - Bill Belichick's 1st Game": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/UNC_chapel_hill_kenan_football_stadium_aerial.jpg/960px-UNC_chapel_hill_kenan_football_stadium_aerial.jpg",
  "India vs. Pakistan Cricket T20 World Cup": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/%E0%A7%A8%E0%A7%A6%E0%A7%A8%E0%A7%AA_%E0%A6%9F%E0%A6%BF%E0%A7%A8%E0%A7%A6_%E0%A6%AC%E0%A6%BF%E0%A6%B6%E0%A7%8D%E0%A6%AC%E0%A6%95%E0%A6%BE%E0%A6%AA%E0%A7%87%E0%A6%B0_%E0%A6%B8%E0%A6%AE%E0%A6%AF%E0%A6%BC_%E0%A6%A8%E0%A6%BE%E0%A6%B8%E0%A6%BE%E0%A6%89_%E0%A6%95%E0%A6%BE%E0%A6%89%E0%A6%A8%E0%A7%8D%E0%A6%9F%E0%A6%BF_%E0%A6%86%E0%A6%A8%E0%A7%8D%E0%A6%A4%E0%A6%B0%E0%A7%8D%E0%A6%9C%E0%A6%BE%E0%A6%A4%E0%A6%BF%E0%A6%95_%E0%A6%95%E0%A7%8D%E0%A6%B0%E0%A6%BF%E0%A6%95%E0%A7%87%E0%A6%9F_%E0%A6%B8%E0%A7%8D%E0%A6%9F%E0%A7%87%E0%A6%A1%E0%A6%BF%E0%A6%AF%E0%A6%BC%E0%A6%BE%E0%A6%AE.jpg/960px-thumbnail.jpg",
  "Premier Lacrosse League": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/HomewoodFIeld2008.jpg/960px-HomewoodFIeld2008.jpg",
  "Super Bowl LIX (Chiefs vs. Eagles)": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Caesars_Superdome_New_Orleans%2C_LA.jpg/960px-Caesars_Superdome_New_Orleans%2C_LA.jpg",
  "CFB National Championship (Alabama vs. OSU)": "/img/stadiums/hardrock.jpg",
  "Texas CFP": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Darrell_K_Royal-Texas_Memorial_Stadium_at_Night.jpg/960px-Darrell_K_Royal-Texas_Memorial_Stadium_at_Night.jpg",
  "Atlanta United": "/img/stadiums/mercedes.jpg",
  "CFB Backyard Brawl (WVU @ Pitt)": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Acrisure_Stadium_2024.jpg/960px-Acrisure_Stadium_2024.jpg",
  "Big East Tournament (UConn vs. Providence)": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Madison_Square_Garden_%28MSG%29_-_Full_%2848124330357%29.jpg/960px-Madison_Square_Garden_%28MSG%29_-_Full_%2848124330357%29.jpg",
  "Penn State Outdoor Hockey": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Beaver_Stadium_Whiteout_2018_Pregame.jpg/960px-Beaver_Stadium_Whiteout_2018_Pregame.jpg",
  "WWE (House Show)": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Madison_Square_Garden_%28MSG%29_-_Full_%2848124330357%29.jpg/960px-Madison_Square_Garden_%28MSG%29_-_Full_%2848124330357%29.jpg",
  "USMNT World Cup Qualifier": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Lower.com_Field_Interior_July_3_2021.jpg/960px-Lower.com_Field_Interior_July_3_2021.jpg",
  "KD's Return to Austin (Spurs vs. Suns)": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Moody_Center_-_UT_Austin_%2854984998424%29.jpg/960px-Moody_Center_-_UT_Austin_%2854984998424%29.jpg",
  "SDSU Dakota Marker": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Dana_J._Dykhouse_Stadium_2016.jpg/960px-Dana_J._Dykhouse_Stadium_2016.jpg",
  "Georgia-Florida Rivalry Game": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/EverBank_Stadium_aerial_view.jpg/960px-EverBank_Stadium_aerial_view.jpg",
  "NBA Summer League": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Thomas_%26_Mack_Center_by_Gage_Skidmore.jpg/960px-Thomas_%26_Mack_Center_by_Gage_Skidmore.jpg",
  "NASCAR Talladega RV Infield": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Talladega_Superspeedway_Frontstretch_Grandstands_%287160014786%29.jpg/960px-Talladega_Superspeedway_Frontstretch_Grandstands_%287160014786%29.jpg",
  "SailGP": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/SailGP_Season_2_Grand_Final_-_San_Francisco_-_March_2022_%281452%29.jpg/960px-SailGP_Season_2_Grand_Final_-_San_Francisco_-_March_2022_%281452%29.jpg",
  "Hudson River Derby": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Red_Bull_Arena_Harrison_behind_goal.jpg/960px-Red_Bull_Arena_Harrison_behind_goal.jpg",
  "Rays at Steinbrenner Field": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/MacDill_Aircrew%2C_service_members_kick_off_opening_day_ceremony_for_TB_Rays_%28250328-F-YW699-1029%29.jpg/960px-MacDill_Aircrew%2C_service_members_kick_off_opening_day_ceremony_for_TB_Rays_%28250328-F-YW699-1029%29.jpg",
  "Penn State White Out": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Beaver_Stadium_Whiteout_2018_Pregame.jpg/960px-Beaver_Stadium_Whiteout_2018_Pregame.jpg",
  "Palmetto Bowl @ SCAR": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Williams_Brice_Stadium.jpg/960px-Williams_Brice_Stadium.jpg",
  "Ole Miss Football": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Vaught-Hemingway_Stadium.jpg/960px-Vaught-Hemingway_Stadium.jpg",
  "Iowa State Football": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/American_football_at_jack_trice_stadium.jpeg/960px-American_football_at_jack_trice_stadium.jpeg",
  "2023 March Madness Elite 8 (FAU vs. K State)": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Madison_Square_Garden_%28MSG%29_-_Full_%2848124330357%29.jpg/960px-Madison_Square_Garden_%28MSG%29_-_Full_%2848124330357%29.jpg",
  "NASCAR Championship": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Phoenix_Raceway_2025.jpg/960px-Phoenix_Raceway_2025.jpg",
  "2022 NBA Finals (Warriors vs. Celtics)": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Chase_Center.jpg/960px-Chase_Center.jpg",
  "Argentina - 2024 Copa America": "/img/stadiums/metlife.jpg",
  "Coastal Carolina All You Can Eat": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/CoastalBrooksStad1.jpg/960px-CoastalBrooksStad1.jpg",
  "2024 Army-Navy Game": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Commanders_vs_Giants_%2853345178211%29.jpg/960px-Commanders_vs_Giants_%2853345178211%29.jpg",
  "Tampa Bay Bucaneeers": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Raymond_James_Stadium_Aerial_%282%29.jpg/960px-Raymond_James_Stadium_Aerial_%282%29.jpg",
  "Big 12 Championship": "/img/stadiums/att.jpg",
  "Chicago Fire": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Soldier_Field_S.jpg/960px-Soldier_Field_S.jpg",
  "2023 NBA Finals (Heat vs. Nuggets)": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Ball_Arena_exterior_2022.jpg/960px-Ball_Arena_exterior_2022.jpg",
  "NJ Devils Playoff Game": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Prudential_Center_%2855183935068%29.jpg/960px-Prudential_Center_%2855183935068%29.jpg",
  "US Open Tennis": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Arthur_Ashe_Stadium_with_the_roof_closed_%2832938595438%29.jpg/960px-Arthur_Ashe_Stadium_with_the_roof_closed_%2832938595438%29.jpg",
  "NBA All-Star Game": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Delta_Center_2023.jpg/960px-Delta_Center_2023.jpg",
  "NASCAR Clash at the Coliseum": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/USC_vs_University_of_Oregon_November_2019.png/960px-USC_vs_University_of_Oregon_November_2019.png",
  "PGA Championship 2019": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Bethpage-golf1.jpg/960px-Bethpage-golf1.jpg",
  "Idaho Potato Bowl": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/BSUvsFresnoSt.jpg/960px-BSUvsFresnoSt.jpg",
  "Champions Classic (Kentucky vs. Michigan St.)": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Madison_Square_Garden_%28MSG%29_-_Full_%2848124330357%29.jpg/960px-Madison_Square_Garden_%28MSG%29_-_Full_%2848124330357%29.jpg",
  "2K Classic (Georgetown vs. Texas)": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Madison_Square_Garden_%28MSG%29_-_Full_%2848124330357%29.jpg/960px-Madison_Square_Garden_%28MSG%29_-_Full_%2848124330357%29.jpg",
  "Charlotte FC": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Aerial_view_of_Bank_of_America_Stadium_in_Charlotte.jpg/960px-Aerial_view_of_Bank_of_America_Stadium_in_Charlotte.jpg",
  "Kent State MACtion": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/Dix_Stadium_west.JPG/960px-Dix_Stadium_west.JPG",
  "Atlanta Hawks": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/State_Farm_%28Philips%29_Arena%2C_Atlanta%2C_GA_%2846558861525%29_-_2019.jpg/960px-State_Farm_%28Philips%29_Arena%2C_Atlanta%2C_GA_%2846558861525%29_-_2019.jpg",
  "UPenn Football": "https://upload.wikimedia.org/wikipedia/commons/f/f8/Franklin_Field_aerial.jpg",
  "Delaware State Football Homecoming": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Alumni_Stadium_%28Delaware_State%29.jpg/960px-Alumni_Stadium_%28Delaware_State%29.jpg",
  "Italian Bowl XLIV": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Glass_bowl_stadium_utoledo.jpg/960px-Glass_bowl_stadium_utoledo.jpg",
  "Sonoma NASCAR": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/NASCAR_2008_-_Infineon_Raceway_%282604726646%29.jpg/960px-NASCAR_2008_-_Infineon_Raceway_%282604726646%29.jpg",
  "Preakness": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/147th_Preakness_Stakes_%2852093518043%29.jpg/960px-147th_Preakness_Stakes_%2852093518043%29.jpg",
  "USMNT vs Panama (Nations League Semifinal)": "/img/stadiums/sofi.jpg",
  "BGSU Midweek Maction": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/BGSUStadium1.jpg/960px-BGSUStadium1.jpg",
  "NFL Pro Bowl": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Allegiant_Stadium_Street_View_on_Super_Bowl_LVIII.jpg/960px-Allegiant_Stadium_Street_View_on_Super_Bowl_LVIII.jpg",
  "Pegasus World Cup": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Gulfstream_Sunshine_Millions_2006.jpg/960px-Gulfstream_Sunshine_Millions_2006.jpg",
  "A10 Tournament": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Barclays_Center_-_May_2_2025.jpg/960px-Barclays_Center_-_May_2_2025.jpg",
  "Oakland A's": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Oakland_Coliseum_from_above_2024.png/960px-Oakland_Coliseum_from_above_2024.png",
}

const us = all.filter((e) => !FOREIGN.test(e.location))
us.sort((a, b) => b.final - a.final)
const experiences = us.map((e, i) => ({ rank: i + 1, ...e, image: IMAGES[e.name] }))
const sports = ['All Sports', ...Array.from(new Set(experiences.map((e) => e.sport))).sort()]

fs.writeFileSync(
  new URL('../public/data/experiences.json', import.meta.url),
  JSON.stringify({ count: experiences.length, sports, experiences }),
)
console.log(`wrote ${experiences.length} US experiences (${all.length - experiences.length} non-US dropped); ${sports.length - 1} sports`)
