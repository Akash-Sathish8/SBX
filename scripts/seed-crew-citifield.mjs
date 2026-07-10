// Seed the crew demo accounts (omer, robby, ahmed) + Omer's and Robby's
// first-party Citi Field gameday intel from the 2026-07-07 Royals @ Mets game.
// Their own words only (as provided), no em dashes, and no invented ratings.
// akash8 already exists and is untouched.
//
// Each review is split into the sections it belongs to and seeded as tips on the
// VENUE scope (Citi Field has all six WhatToKnow sections). The sections that
// also exist on the game page (EVENT_SECTIONS: getting-there / best-seats /
// before / tips) are seeded on the event scope too, so the July 7 game page
// carries the gameday-specific intel. Full reviews are venue-scoped (the only
// surface that renders reviews) and tied to the game via game_id.
//
//   node scripts/seed-crew-citifield.mjs        # (re)generate the SQL
//   npx wrangler d1 execute DB --local --file db/seed.crew-citifield.generated.sql
//
// Accounts are real (loginable): password hashes use the same PBKDF2 format as
// src/server/auth.ts (pbkdf2$100000$saltB64$hashB64). Shared demo password below.

import { writeFileSync } from 'node:fs'
import { createHash, pbkdf2Sync, randomBytes } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'db', 'seed.crew-citifield.generated.sql')

const GAME_ID = '401816057' // Royals @ Mets, 2026-07-07 (KC 16, NYM 12)
const VENUE_ID = '209' // Citi Field
const EVENT_TARGET = `mlb:${GAME_ID}`
const PASSWORD = 'snapback26' // shared demo password for the three accounts

// Game pages only render these WhatToKnow sections (EVENT_SECTIONS in WhatToKnow.tsx).
const EVENT_SECTION_KEYS = new Set(['getting-there', 'best-seats', 'before', 'tips'])

const PBKDF2_ITER = 100_000
function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = pbkdf2Sync(password, salt, PBKDF2_ITER, 32, 'sha256')
  return `pbkdf2$${PBKDF2_ITER}$${salt.toString('base64')}$${hash.toString('base64')}`
}

const USERS = [
  { id: 'omer', username: 'omer', display: 'Omer', email: 'omer@snapbacksports.com', avatar: 'preset:1' },
  { id: 'robby', username: 'robby', display: 'Robby', email: 'robby@snapbacksports.com', avatar: 'preset:2' },
  { id: 'ahmed', username: 'ahmed', display: 'Ahmed', email: 'ahmed@snapbacksports.com', avatar: 'preset:3' },
]

// [section, body] — each review split into the sections it belongs to, verbatim.
// Seeded on the venue scope (all sections) + event scope (game-page sections).
const OMER_TIPS = [
  ['getting-there', "I started at Midtown and took the 7 train directly to Mets-Willets Point, and when I exited the station I followed the rest of the Mets fans to the stadium (2 minute walk). The gate into the stadium was quick and efficient making it about 45 minutes total from Midtown to inside Citi Field."],
  ['best-seats', "I got section 109 and was very satisfied with the view of home plate and first base, as well as the jumbotron to the right. There was lots of food near the seat as well and it was easily accessible. The seats also came with access to the Heineken-Hudson-Metro Clubs which had seating and basic ballpark food."],
  ['best-seats', "The 100s sections have a good chance of catching a foul ball and T-shirts (there were 2 foul balls landing a couple rows behind us)."],
  ['food', "It is worth going to Wok N' Roll and picking from their vast selection of unique egg rolls. I tried the Rainbow Cookie Egg Roll for $10 which was good but very heavy. They have a different egg roll for every major city with some seasonal ones as well."],
  ['food', "I ordered the hot Maine lobster roll from the stand outside of section 109 and was very disappointed. It was nearly $37 and was basically lobster pieces on a bun. They were even out of the bayside chips that were supposed to come with it. Skip this."],
  ['before', "I walked through the different lounges we had access to, and the Heineken lounge was huge with lots of seating and food/drink options. It didn't have a view of the field so if you want to hang out there I would recommend being there before the game starts."],
  ['before', "There is a fan section behind the center jumbotron where you can throw a pitch, as well as a batting range, but the line was very long to pitch and the batting range was mainly children."],
  ['before', "There are lots of team stores scattered throughout the stadium that had cool vintage memorabilia that is worth looking through."],
  ['atmosphere', "I went to a game with the two worst teams in the MLB and yet the vibes could not have been higher. There was an entire section doing \"tarps off\" where hundreds of guys took their shirts off and waved it. The colored light show in between innings had people on their feet and everyone was singing during karaoke and Take Me Out to the Ballgame. The game was one of the highest scoring of the season at 16-12 so we had lots of fireworks and cheering."],
  ['tips', "The food is overly expensive, so don't take risks on food that sounds interesting in theory but probably isn't actually."],
  ['tips', "The 100s section lower rows have no shade from the sun so I would only recommend those during a night game or chillier days."],
  ['tips', "There is a \"super express\" train after the game that goes from Mets-Willets Point straight to Manhattan."],
]

const ROBBY_TIPS = [
  ['getting-there', "I came from the airport on a delayed flight with bags. I Ubered from the airport to Corona food market near the 111 St station where I left my bags with them using the Bounce app for ~$15. I left a suitcase and a backpack with them before walking 1 minute to the 111 St station and took the 7 train one stop to the Mets-Willets Point station where I got off and walked into the stadium when the gates first opened at 5:40pm for a 7:10pm game."],
  ['best-seats', "Seats in the 100s are all generally pretty good. The views of the plate, outfield, and infield are all solid and they put you near lots of good food on the concourse with a good shot at getting balls or a t-shirt."],
  ['food', "The best food I tried all night was the $5.00 hot dog and $5.00 12oz Coors Light combo. It was affordable, convenient, didn't have a line, and hit the spot."],
  ['before', "The Heineken lounge that we had access to via our 100 level tickets on the 300 level was pretty cool but wasn't exclusive nor as cool as we had originally thought."],
  ['before', "The team store is loaded with cool gear and is pretty big. I would recommend checking that out although you can expect to pay a decent amount of money for most items."],
  ['atmosphere', "The Mets and Royals aren't the best MLB teams this year so I had low expectations but we ended up seeing one of the highest scoring games of the year. It felt like there was a homer every inning which made the game highly entertaining however I don't think this is something you can count on."],
  ['tips', "If you're looking for consistency food wise, just hit the Shake Shack on the concourse behind the jumbotron."],
  ['tips', "Avoid cocktails. They're all ridiculously priced throughout the stadium."],
]

// Full reviews — their verbatim text, section headers as they wrote them.
// Venue-scoped (Reviews renders on the venue page), tied to the game.
// No numeric ratings: neither gave one, so we invent none.
const OMER_REVIEW =
  "Getting There: I started at Midtown and took the 7 train directly to Mets-Willets Point, and when I exited the station I followed the rest of the Mets fans to the stadium (2 minute walk). The gate into the stadium was quick and efficient making it about 45 minutes total from Midtown to inside Citi Field.\n\n" +
  "Best Seats: I got section 109 and was very satisfied with the view of home plate and first base, as well as the jumbotron to the right. There was lots of food near the seat as well and it was easily accessible. The seats also came with access to the Heineken-Hudson-Metro Clubs which had seating and basic ballpark food. The 100s sections have a good chance of catching a foul ball and T-shirts (there were 2 foul balls landing a couple rows behind us).\n\n" +
  "Food: It is worth going to Wok N' Roll and picking from their vast selection of unique egg rolls. I tried the Rainbow Cookie Egg Roll for $10 which was good but very heavy. They have a different egg roll for every major city with some seasonal ones as well. I ordered the hot Maine lobster roll from the stand outside of section 109 and was very disappointed. It was nearly $37 and was basically lobster pieces on a bun. They were even out of the bayside chips that were supposed to come with it. Skip this.\n\n" +
  "Before the Game: I walked through the different lounges we had access to, and the Heineken lounge was huge with lots of seating and food/drink options. It didn't have a view of the field so if you want to hang out there I would recommend being there before the game starts. There is a fan section behind the center jumbotron where you can throw a pitch, as well as a batting range, but the line was very long to pitch and the batting range was mainly children. There are lots of team stores scattered throughout the stadium that had cool vintage memorabilia that is worth looking through.\n\n" +
  "Atmosphere: I went to a game with the two worst teams in the MLB and yet the vibes could not have been higher. There was an entire section doing \"tarps off\" where hundreds of guys took their shirts off and waved it. The colored light show in between innings had people on their feet and everyone was singing during karaoke and Take Me Out to the Ballgame. The game was one of the highest scoring of the season at 16-12 so we had lots of fireworks and cheering.\n\n" +
  "Insider tips: The food is overly expensive, so don't take risks on food that sounds interesting in theory but probably isn't actually. The 100s section lower rows have no shade from the sun so I would only recommend those during a night game or chillier days. There is a \"super express\" train after the game that goes from Mets-Willets Point straight to Manhattan."

const ROBBY_REVIEW =
  "Getting there: I came from the airport on a delayed flight with bags. I Ubered from the airport to Corona food market near the 111 St station where I left my bags with them using the Bounce app for ~$15. I left a suitcase and a backpack with them before walking 1 minute to the 111 St station and took the 7 train one stop to the Mets-Willets Point station where I got off and walked into the stadium when the gates first opened at 5:40pm for a 7:10pm game.\n\n" +
  "Best Seats: Seats in the 100s are all generally pretty good. The views of the plate, outfield, and infield are all solid and they put you near lots of good food on the concourse with a good shot at getting balls or a t-shirt.\n\n" +
  "Best food: The best food I tried all night was the $5.00 hot dog and $5.00 12oz Coors Light combo. It was affordable, convenient, didn't have a line, and hit the spot.\n\n" +
  "Before the Game: The Heineken lounge that we had access to via our 100 level tickets on the 300 level was pretty cool but wasn't exclusive nor as cool as we had originally thought. The team store is loaded with cool gear and is pretty big. I would recommend checking that out although you can expect to pay a decent amount of money for most items.\n\n" +
  "Atmosphere: The Mets and Royals aren't the best MLB teams this year so I had low expectations but we ended up seeing one of the highest scoring games of the year. It felt like there was a homer every inning which made the game highly entertaining however I don't think this is something you can count on.\n\n" +
  "Insider Tips: If you're looking for consistency food wise, just hit the Shake Shack on the concourse behind the jumbotron. Also, avoid cocktails. They're all ridiculously priced throughout the stadium."

const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`)
const idFor = (user, kind, target, extra) =>
  createHash('sha256').update(`${user}|${kind}|${target}|${extra}`).digest('hex').slice(0, 24)
const ts = new Date().toISOString()

const lines = ['PRAGMA foreign_keys=OFF;', 'BEGIN TRANSACTION;']

// Re-runnable: clear this seed's prior tips/reviews for these users+targets so
// content edits don't leave stale rows behind (ids are content-hashed).
lines.push(`DELETE FROM tips WHERE user_id IN ('omer','robby') AND target_id IN (${q(VENUE_ID)},${q(EVENT_TARGET)});`)
lines.push(`DELETE FROM reviews WHERE user_id IN ('omer','robby') AND target_id = ${q(VENUE_ID)};`)

for (const u of USERS) {
  lines.push(
    'INSERT OR REPLACE INTO users (id,email,username,password_hash,created_at,display_name,bio,avatar,favorites) VALUES (' +
      `${q(u.id)},${q(u.email)},${q(u.username)},${q(hashPassword(PASSWORD))},${q(ts)},${q(u.display)},NULL,${q(u.avatar)},NULL);`,
  )
}

let tipCount = 0
const seedTips = (userId, author, tips) => {
  for (const [section, body] of tips) {
    const targets = [['venue', VENUE_ID]]
    if (EVENT_SECTION_KEYS.has(section)) targets.push(['event', EVENT_TARGET])
    for (const [scope, target] of targets) {
      tipCount++
      lines.push(
        'INSERT OR REPLACE INTO tips (id,scope,target_id,section,user_id,author,body,created_at) VALUES (' +
          `${q(idFor(userId, 'tip', target, section + '|' + body))},${q(scope)},${q(target)},${q(section)},${q(userId)},${q(author)},${q(body)},${q(ts)});`,
      )
    }
  }
}

const seedReview = (userId, author, body) => {
  lines.push(
    'INSERT OR REPLACE INTO reviews (id,scope,target_id,game_id,user_id,author,rating,body,created_at) VALUES (' +
      `${q(idFor(userId, 'review', VENUE_ID, GAME_ID))},'venue',${q(VENUE_ID)},${q(GAME_ID)},${q(userId)},${q(author)},NULL,${q(body)},${q(ts)});`,
  )
}

seedTips('omer', 'omer', OMER_TIPS)
seedTips('robby', 'robby', ROBBY_TIPS)
// NO text reviews by design — their intel lives in the section tips, and the
// Fan Reviews card is the photo field report (src/lib/fieldPhotos.ts).
void OMER_REVIEW
void ROBBY_REVIEW
void seedReview

lines.push('COMMIT;', '')
writeFileSync(OUT, lines.join('\n'))
console.log(
  `Wrote ${path.relative(ROOT, OUT)} — ${USERS.length} users, ${tipCount} tip rows ` +
  `(venue ${VENUE_ID} all sections + event ${EVENT_TARGET} game sections), 2 verbatim reviews.`,
)
