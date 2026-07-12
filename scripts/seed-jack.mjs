// Seed the Jack Settleman demo profile + his first-party Madison Square Garden
// gameday intel (tips per WhatToKnow section + one review). Attributed to his own
// account (id 'jack-settleman', display "Jack Settleman"), NOT the official
// Snapback account and NOT faked as a fan. His own words only, no em dashes, and
// no invented rating. Unlike seed-snapback-tips.mjs this does NOT delete anything,
// so Jack's content coexists with the official Snapback tips already on the venue.
//
//   npm run db:seed:jack         # (re)generate the SQL
//   npm run db:seed:jack:local   # apply to local D1
//
// Avatar source: data/jack-avatar.jpg (128px), embedded as a data: URL.

import { writeFileSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'db', 'seed.jack.generated.sql')

const JACK = {
  id: 'jack-settleman',
  email: 'jack@snapbacksports.com',
  username: 'JackSettleman',
  displayName: 'Jack Settleman',
  author: 'Jack Settleman',
}
const SCOPE = 'venue'
const VENUE_ID = '1830' // Madison Square Garden (New York Knicks)

// [section, body] — sections match WhatToKnow VENUE_SECTIONS.
const TIPS = [
  ['getting-there', "Best ways in: walking, the subway, the LIRR, or NJ Transit. Driving would be my last choice."],
  ['before', "Pregame spots nearby: Nick and Stef's Steakhouse, The Rutherford, Stout, Mustang Harry's, and American Whiskey."],
  ['before', "There is a Chase reserve lounge inside the arena. You can reserve a spot pregame."],
  ['best-seats', "Front rows in the 200s in the center sections beat behind the basket, even down low."],
  ['best-seats', "The Chase Bridge and the Hyundai Bridge are both cool spots, and the Hyundai Bridge is good value."],
  ['best-seats', "The Delta Club comes with all-inclusive food and drink (non-alcoholic)."],
  ['atmosphere', "Best crowd in the NBA. Be ready to stand, and the seats are tight between people. There are not as many gimmicks as other NBA arenas, so it is not the most family-friendly, but there is still plenty of in-game entertainment like t-shirt tosses."],
  ['food', "Best food in MSG is the steak sandwich outside section 107."],
  ['food', "The hamburgers from the Garden Market are the best basic food item in sports. They use a different type of bun that is fantastic."],
  ['food', "Carnegie Deli is another good one. Skip the pizza, it is bad in the arena."],
  ['tips', "The merch store through the gates on the 100 level has a way shorter line than the one in the MSG lobby."],
  ['tips', "Alcoholic drinks are very expensive inside MSG."],
]

const REVIEW = {
  rating: null, // Jack gave no numeric score, so we invent none.
  body:
    "Best crowd in the NBA. Be ready to stand and the seats are tight, but the energy is worth it. " +
    "For seats, the front rows in the 200s in the center sections beat behind the basket even down low, " +
    "and the Hyundai Bridge is a cool spot with good value. Eat the steak sandwich outside section 107 " +
    "and the Garden Market hamburgers, and skip the arena pizza. Get in through the 100 level gates for a " +
    "shorter merch line, and know the alcohol is very expensive.",
}

const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`)
const tipId = (section, body) => createHash('sha256').update(`jack|tip|${VENUE_ID}|${section}|${body}`).digest('hex').slice(0, 24)
const reviewId = (body) => createHash('sha256').update(`jack|review|${VENUE_ID}|${body}`).digest('hex').slice(0, 24)
const ts = new Date().toISOString()

// Avatar -> data URL.
const b64 = readFileSync(path.join(ROOT, 'data', 'jack-avatar.jpg')).toString('base64')
const avatar = 'data:image/jpeg;base64,' + b64

const lines = ['PRAGMA foreign_keys=OFF;', 'BEGIN TRANSACTION;']

// Author-only account (never signs in) — Better Auth columns, no password.
// display_name is the shown name; username is the normalized URL handle and
// display_username preserves the casing.
lines.push(
  'INSERT OR REPLACE INTO users (id,email,username,display_username,display_name,email_verified,created_at,updated_at,bio,avatar,favorites) VALUES (' +
    `${q(JACK.id)},${q(JACK.email)},${q(JACK.username.toLowerCase())},${q(JACK.username)},${q(JACK.displayName)},1,${q(ts)},${q(ts)},NULL,${q(avatar)},NULL);`,
)

for (const [section, body] of TIPS) {
  lines.push(
    'INSERT OR REPLACE INTO tips (id,scope,target_id,section,user_id,author,body,created_at) VALUES (' +
      `${q(tipId(section, body))},${q(SCOPE)},${q(VENUE_ID)},${q(section)},${q(JACK.id)},${q(JACK.author)},${q(body)},${q(ts)});`,
  )
}

lines.push(
  'INSERT OR REPLACE INTO reviews (id,scope,target_id,game_id,user_id,author,rating,body,created_at) VALUES (' +
    `${q(reviewId(REVIEW.body))},${q(SCOPE)},${q(VENUE_ID)},NULL,${q(JACK.id)},${q(JACK.author)},${REVIEW.rating === null ? 'NULL' : REVIEW.rating},${q(REVIEW.body)},${q(ts)});`,
)

lines.push('COMMIT;', '')
writeFileSync(OUT, lines.join('\n'))
console.log(`Wrote ${path.relative(ROOT, OUT)} — ${TIPS.length} tips + 1 review for venue ${VENUE_ID}, avatar ${(avatar.length / 1024).toFixed(1)}KB.`)
