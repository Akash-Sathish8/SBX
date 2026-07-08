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

// Curated photos for non-team experiences (events) that can't be auto-matched to
// a team venue. Team experiences (Chicago Cubs → Wrigley, etc.) get their photo
// at runtime from /api/venues, so they don't need an entry here.
const IMAGES = {
  'National Championship 2026': '/img/stadiums/hardrock.jpg', // Hard Rock Stadium, Miami (CFP host)
  'Kentucky Derby': '/img/exp/churchill-downs.jpg',
  'Indy 500': '/img/exp/indianapolis-motor-speedway.jpg',
  'BYU Holy War': '/img/exp/lavell-edwards-stadium.jpg',
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
