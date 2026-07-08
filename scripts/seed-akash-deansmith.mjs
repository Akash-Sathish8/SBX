// Seed akash8's first-party Dean E. Smith Center intel (tips per WhatToKnow
// section), attributed to the existing 'akash8' account, and repoint that
// account's email to akakash.sathish8@gmail.com (per request). akash8 is a real
// registered account, so this NEVER recreates the user or touches its password.
// tip user_id resolves to akash8's real id at apply time via a subquery, so this
// stays correct regardless of the account's UUID. No em dashes, his words only.
//
//   npm run db:seed:akash         # (re)generate the SQL
//   npm run db:seed:akash:local   # apply to local D1

import { writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'db', 'seed.akash-deansmith.generated.sql')

const USERNAME = 'akash8'
const EMAIL = 'akakash.sathish8@gmail.com'
const AUTHOR = 'akash8'
const SCOPE = 'venue'
const VENUE_ID = '207' // Dean E. Smith Center (North Carolina Tar Heels)

// [section, body] — sections match WhatToKnow VENUE_SECTIONS.
const TIPS = [
  ['getting-there', "Walk if you're a student. If you're not, take the Tar Heel Express shuttle for $5 round trip."],
  ['getting-there', "Driving is the last resort, but parking is only $10 to $12."],
  ['getting-there', "Doors open 90 minutes before tip."],
  ['before', "Top of the Hill: rooftop bar with occasional UNC star sightings."],
  ['before', "He's Not Here: 32oz blue cups (beer or seltzer) for $5, rated a top-10 bar in the US by The Athletic."],
  ['before', "Sup Dogs: game-day bar food, affordable and always hits."],
  ['best-seats', "Students stand in the risers. If you're not in the student section, the spots are sections 116-117 and 216-217, and they expand for big games."],
  ['best-seats', "If you're not a student, the lower level is mostly donors. Buying from UNC directly usually only gets you upper level. Lower-level rights belong to donors, so it is resale only."],
  ['atmosphere', "Weak for smaller games. The older donors do not bring much noise."],
  ['atmosphere', "But for ranked opponents and Duke, the student section expands and it gets loud."],
  ['atmosphere', "Not a small college gym feel. More of an NBA vibe."],
  ['food', "Not great, and the alcohol is expensive."],
  ['food', "Nearby options: Crumbl, Alpaca, Chick-fil-A, and Domino's."],
  ['tips', "One concourse serves both levels and it is small, so it gets packed at halftime. Go before or after."],
  ['tips', "The Carolina Basketball Museum is next door, with really cool artifacts."],
]

const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`)
const tipId = (section, body) => createHash('sha256').update(`akash8|tip|${VENUE_ID}|${section}|${body}`).digest('hex').slice(0, 24)
const ts = new Date().toISOString()
const USER_SUBQUERY = `(SELECT id FROM users WHERE username = ${q(USERNAME)} COLLATE NOCASE)`

const lines = ['PRAGMA foreign_keys=OFF;', 'BEGIN TRANSACTION;']

// Repoint the existing akash8 account's email (does not touch its password/login otherwise).
lines.push(`UPDATE users SET email = ${q(EMAIL)} WHERE username = ${q(USERNAME)} COLLATE NOCASE;`)

for (const [section, body] of TIPS) {
  lines.push(
    'INSERT OR REPLACE INTO tips (id,scope,target_id,section,user_id,author,body,created_at) VALUES (' +
      `${q(tipId(section, body))},${q(SCOPE)},${q(VENUE_ID)},${q(section)},${USER_SUBQUERY},${q(AUTHOR)},${q(body)},${q(ts)});`,
  )
}

lines.push('COMMIT;', '')
writeFileSync(OUT, lines.join('\n'))
console.log(`Wrote ${path.relative(ROOT, OUT)} — ${TIPS.length} tips for venue ${VENUE_ID} under ${USERNAME} (email -> ${EMAIL}).`)
