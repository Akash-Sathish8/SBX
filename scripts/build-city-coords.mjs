// Build public/data/city-coords.json: centroid coordinates for every distinct
// venue city in the local D1 (games ∪ venues), geocoded ONCE via Open-Meteo's
// free geocoding API (no key). Powers the /near page's distance math at
// city-level precision. Unresolved cities are logged and omitted — their games
// simply carry no distance (honest gap). Re-run after big ingests:
//   node scripts/build-city-coords.mjs   (or npm run build:city-coords)
import { writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public', 'data', 'city-coords.json')
const DB_DIR = path.join(ROOT, '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject')

// Same direct-sqlite pattern as scripts/repair-venue-links.mjs.
const dbFile = execSync(`ls ${DB_DIR}/*.sqlite | grep -v metadata | head -1`).toString().trim()
const rows = JSON.parse(
  execSync(
    `sqlite3 -json "${dbFile}" "SELECT DISTINCT venue_city AS city, venue_state AS state FROM games WHERE venue_city IS NOT NULL UNION SELECT DISTINCT city, state FROM venues WHERE city IS NOT NULL"`,
  ).toString() || '[]',
)

// Keying MUST match src/lib/geo.ts cityKey().
const cityKey = (city, state) => `${(city || '').trim().toLowerCase()}|${(state || '').trim().toLowerCase()}`

// States arrive as either codes ("IL") or names ("Illinois"); Open-Meteo's
// admin1 is the full name, so both spellings must resolve for matching.
const US_STATES = {
  al: 'alabama', ak: 'alaska', az: 'arizona', ar: 'arkansas', ca: 'california', co: 'colorado',
  ct: 'connecticut', de: 'delaware', fl: 'florida', ga: 'georgia', hi: 'hawaii', id: 'idaho',
  il: 'illinois', in: 'indiana', ia: 'iowa', ks: 'kansas', ky: 'kentucky', la: 'louisiana',
  me: 'maine', md: 'maryland', ma: 'massachusetts', mi: 'michigan', mn: 'minnesota',
  ms: 'mississippi', mo: 'missouri', mt: 'montana', ne: 'nebraska', nv: 'nevada',
  nh: 'new hampshire', nj: 'new jersey', nm: 'new mexico', ny: 'new york',
  nc: 'north carolina', nd: 'north dakota', oh: 'ohio', ok: 'oklahoma', or: 'oregon',
  pa: 'pennsylvania', ri: 'rhode island', sc: 'south carolina', sd: 'south dakota',
  tn: 'tennessee', tx: 'texas', ut: 'utah', vt: 'vermont', va: 'virginia', wa: 'washington',
  wv: 'west virginia', wi: 'wisconsin', wy: 'wyoming', dc: 'district of columbia',
  // Canadian provinces (NHL/college games)
  ab: 'alberta', bc: 'british columbia', mb: 'manitoba', on: 'ontario', qc: 'quebec',
  sk: 'saskatchewan', ns: 'nova scotia',
}
const stateName = (s) => {
  const k = (s || '').trim().toLowerCase()
  return US_STATES[k] ?? k // already a full name (or empty)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function geocode(city, state) {
  const url =
    'https://geocoding-api.open-meteo.com/v1/search?count=10&language=en&format=json&name=' +
    encodeURIComponent(city)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url)
      if (r.status === 429) { await sleep(2000 * (attempt + 1)); continue }
      if (!r.ok) return null
      const j = await r.json()
      const want = stateName(state)
      const hits = (j.results || []).filter((x) => x.country_code === 'US' || x.country_code === 'CA')
      // Prefer the state/province match; fall back to the top US/CA hit only
      // when the state is missing (never cross-state guesses).
      const m = want
        ? hits.find((x) => (x.admin1 || '').toLowerCase() === want)
        : hits[0]
      return m ? { lat: Math.round(m.latitude * 1000) / 1000, lng: Math.round(m.longitude * 1000) / 1000 } : null
    } catch { await sleep(1000) }
  }
  return null
}

const out = {}
const misses = []
let done = 0
for (const r of rows) {
  const key = cityKey(r.city, r.state)
  if (out[key]) continue
  const hit = await geocode(r.city, r.state)
  if (hit) out[key] = hit
  else misses.push(`${r.city}, ${r.state}`)
  done++
  if (done % 50 === 0) console.log(`${done}/${rows.length}…`)
  await sleep(250) // ~4 req/s, polite to the free API
}

writeFileSync(OUT, JSON.stringify(out))
console.log(`Wrote ${path.relative(ROOT, OUT)}: ${Object.keys(out).length} cities.`)
if (misses.length) console.log(`Unresolved (${misses.length}): ${misses.join(' · ')}`)
