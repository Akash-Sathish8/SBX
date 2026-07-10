// One-time venue data repairs, found by auditing every team's venue_teams link
// against the modal venue_name of its actual home games:
//   1. ESPN venue ids collide across sports: college FIU (Riccardo Silva/
//      Pitbull Stadium) REPLACEd MLB's Truist Park at id 218. FIU moves to
//      'vx-pitbull-stadium'; Truist Park is restored as 218 (its tips/reviews
//      always described Truist: The Battery, Chop House seats, ...).
//   2. Wrong-arena links from the NHL ingest (Jets -> State Farm Arena id
//      collision, Devils -> defunct IZOD Center).
//   3. Stale ESPN team-venue records: teams that renamed or replaced their
//      stadium (Rutgers SHI, Houston TDECU, Baylor McLane, UNLV Allegiant, ...).
//      Same-building renames keep the row + photo; replacement buildings get
//      the new name with the old photo dropped (never show the wrong building).
// Every row is real data taken from the games table. Re-run after editing:
//   node scripts/repair-venue-links.mjs
//   npm run db:repair:venues:local
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'db', 'seed.venue-repairs.generated.sql')

const sql = []

// -- 1. the 218 collision ------------------------------------------------------
sql.push(
  // FIU's building (renamed Pitbull Stadium in 2024) moves to its own id.
  `INSERT OR REPLACE INTO venues (id,name,city,state,zip,surface,indoor,image) VALUES ('vx-pitbull-stadium','Pitbull Stadium','Miami','FL',NULL,NULL,0,'https://a.espncdn.com/i/venues/college-football/day/interior/218.jpg');`,
  `UPDATE venue_teams SET venue_id='vx-pitbull-stadium' WHERE venue_id='218' AND league='college-football';`,
  // Truist Park back at 218 (original MLB ingest values).
  `INSERT OR REPLACE INTO venues (id,name,city,state,zip,surface,indoor,image) VALUES ('218','Truist Park','Atlanta','Georgia','30339','grass',0,'https://a.espncdn.com/i/venues/mlb/day/218.jpg');`,
)

// -- 2. wrong-arena links ------------------------------------------------------
sql.push(
  // Winnipeg Jets: ESPN NHL venue id collided with the NBA's State Farm Arena.
  `INSERT OR REPLACE INTO venues (id,name,city,state,zip,surface,indoor,image) VALUES ('vx-canada-life-centre','Canada Life Centre','Winnipeg','MB',NULL,NULL,1,NULL);`,
  `DELETE FROM venue_teams WHERE venue_id='1827' AND league='nhl';`,
  `INSERT OR REPLACE INTO venue_teams (venue_id,league,team_id) VALUES ('vx-canada-life-centre','nhl','28');`,
  // NJ Devils: linked to the demolished IZOD Center; Prudential Center is 1826.
  `UPDATE venue_teams SET venue_id='1826' WHERE venue_id='2562' AND league='nhl';`,
)

// -- 3a. same-building renames (keep id, content, photo) -----------------------
sql.push(
  `UPDATE venues SET name='SHI Stadium' WHERE id='3754';`, // ex HighPoint.com Stadium (Rutgers)
  // Illinois' row (3597) was a bogus record only Illinois links; their home is
  // the renamed Memorial Stadium. Different building than the row described,
  // so the name/city are corrected and the photo dropped.
  `UPDATE venues SET name='Gies Memorial Stadium', city='Champaign', state='IL', image=NULL WHERE id='3597';`,
)

// -- 3b. replacement buildings on/near the old site (rename, drop old photo) ---
sql.push(
  `UPDATE venues SET name='TDECU Stadium', image=NULL WHERE id='453';`, // ex Robertson Stadium (Houston)
  `UPDATE venues SET name='McLane Stadium', image=NULL WHERE id='3724';`, // ex Floyd Casey Stadium (Baylor)
  `UPDATE venues SET name='Snapdragon Stadium', image=NULL WHERE id='3932';`, // ex SDCCU Stadium (San Diego State)
  `UPDATE venues SET name='Canvas Stadium', image=NULL WHERE id='3761';`, // ex Hughes Stadium (Colorado State)
)

// -- 3c. moves to a different (still-standing or new) building: new row + relink.
// The old rows stay — they are real venues (Legion Field, Aloha Stadium, ...).
const MOVES = [
  // [newId, name, city, state, league, teamId, oldVenueId]
  ['vx-protective-stadium', 'Protective Stadium', 'Birmingham', 'AL', 'college-football', '5', '3803'], // UAB (ex Legion Field)
  ['vx-martin-stadium', 'Northwestern Medicine Field at Martin Stadium', 'Evanston', 'IL', 'college-football', '77', '3911'], // Northwestern (Ryan Field demolished)
  ['vx-ching-complex', 'Clarence T.C. Ching Athletics Complex', 'Honolulu', 'HI', 'college-football', '62', '3610'], // Hawai'i (ex Aloha Stadium)
  ['vx-shell-energy-stadium', 'Shell Energy Stadium', 'Houston', 'TX', 'college-football', '2534', '3647'], // Sam Houston (Bowers renovation)
  ['vx-bodford-arena', 'Bodford Arena', 'Greensboro', 'NC', 'college-basketball', '2430', '349'], // UNC Greensboro
  ['vx-wisdom-gym', 'Wisdom Gym', 'Stephenville', 'TX', 'college-basketball', '2627', '11954'], // Tarleton State
]
for (const [id, name, city, state, league, teamId, oldId] of MOVES) {
  sql.push(
    `INSERT OR REPLACE INTO venues (id,name,city,state,zip,surface,indoor,image) VALUES ('${id}','${name.replace(/'/g, "''")}','${city}','${state}',NULL,NULL,0,NULL);`,
    `UPDATE venue_teams SET venue_id='${id}' WHERE venue_id='${oldId}' AND league='${league}' AND team_id='${teamId}';`,
  )
}

// UNLV: Allegiant Stadium already exists (6501) — just relink.
sql.push(`UPDATE venue_teams SET venue_id='6501' WHERE venue_id='3914' AND league='college-football';`)

writeFileSync(OUT, ['-- generated by scripts/repair-venue-links.mjs; do not edit', ...sql, ''].join('\n'))
console.log(`Wrote ${path.relative(ROOT, OUT)}: ${sql.length} statements.`)
