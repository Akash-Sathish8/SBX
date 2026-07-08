// ESPN -> SQL ingest for SBX. Fetches the current season's full schedule
// (every game + score) for MLB / NFL / NBA, plus teams and venues, and writes
// an idempotent INSERT OR REPLACE seed file (db/seed.generated.sql). Apply with:
//   npx wrangler d1 execute DB --local --file db/seed.generated.sql
//
// ESPN caps scoreboard results per call, so we fetch month-by-month and dedupe.
// Finished games never change; re-running refreshes live/recent games in place.
//
// Venues are derived from where teams ACTUALLY PLAY (the games data), not from
// ESPN's franchise.venue — which can be stale after a relocation (e.g. the LA
// Clippers moving to Intuit Dome while franchise.venue still says crypto.com).
// franchise.venue is used only to enrich surface/indoor/photo by venue id.
//
// Run: node scripts/ingest.mjs   (writes the SQL; does not touch the DB itself)

import { writeFile } from 'node:fs/promises'

const SITE = 'https://site.api.espn.com/apis/site/v2/sports'

const LEAGUES = [
  { key: 'mlb', label: 'MLB', sport: 'Baseball', path: 'baseball/mlb', start: '2026-03', end: '2026-11' },
  { key: 'nfl', label: 'NFL', sport: 'Football', path: 'football/nfl', start: '2025-08', end: '2026-02' },
  { key: 'nba', label: 'NBA', sport: 'Basketball', path: 'basketball/nba', start: '2025-10', end: '2026-06' },
]

// College: conferences + member schools only (no games/venues). The ESPN standings
// endpoint returns every conference with its teams in one call per sport.
// FBS football = level 80; men's D1 basketball = level 50.
const COLLEGE = [
  { key: 'college-football', label: 'CFB', sport: 'Football', path: 'football/college-football', season: 2025, level: 80 },
  { key: 'college-basketball', label: 'CBB', sport: 'Basketball', path: 'basketball/mens-college-basketball', season: 2026, level: 50 },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, '')
const num = (v) => (v !== undefined && v !== null && v !== '' ? Number(v) : null)

async function getJSON(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url)
      if (r.ok) return await r.json()
    } catch { /* retry */ }
    await sleep(400 * (i + 1))
  }
  return null
}

async function imageExists(url) {
  try { const r = await fetch(url, { method: 'HEAD' }); return r.ok } catch { return false }
}

function months(start, end) {
  const out = []
  let [y, m] = start.split('-').map(Number)
  const [ey, em] = end.split('-').map(Number)
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}${String(m).padStart(2, '0')}`)
    m++; if (m > 12) { m = 1; y++ }
  }
  return out
}

function parseTeam(c) {
  const t = c?.team ?? {}
  return {
    id: String(t.id ?? ''),
    abbr: t.abbreviation ?? '',
    location: t.location ?? '',
    name: t.name ?? '',
    display: t.displayName ?? '',
    color: t.color ? `#${t.color}` : null,
    logo: t.logo ?? null,
    score: num(c?.score),
    winner: c?.winner ? 1 : 0,
  }
}

function parseGame(ev, league) {
  const comp = ev?.competitions?.[0]
  if (!comp) return null
  const cs = comp.competitors ?? []
  if (cs.length !== 2) return null
  const home = parseTeam(cs.find((c) => c.homeAway === 'home') ?? cs[0])
  const away = parseTeam(cs.find((c) => c.homeAway === 'away') ?? cs[1])
  const stateRaw = ev.status?.type?.state
  return {
    league, id: String(ev.id ?? ''),
    date: ev.date ?? '',
    season: num(ev.season?.year),
    season_type: num(ev.season?.type),
    state: ['pre', 'in', 'post'].includes(stateRaw) ? stateRaw : 'unknown',
    detail: ev.status?.type?.shortDetail ?? ev.status?.type?.detail ?? '',
    completed: ev.status?.type?.completed ? 1 : 0,
    name: ev.name ?? '',
    short_name: ev.shortName ?? '',
    venue_id: comp.venue?.id ? String(comp.venue.id) : null,
    venue_name: comp.venue?.fullName ?? null,
    venue_city: comp.venue?.address?.city ?? null,
    venue_state: comp.venue?.address?.state ?? null,
    venue_indoor: typeof comp.venue?.indoor === 'boolean' ? (comp.venue.indoor ? 1 : 0) : null,
    home, away,
  }
}

async function fetchSeasonGames(lg) {
  const byId = new Map()
  for (const mo of months(lg.start, lg.end)) {
    const y = Number(mo.slice(0, 4)), m = Number(mo.slice(4))
    const first = ymd(new Date(Date.UTC(y, m - 1, 1)))
    const last = ymd(new Date(Date.UTC(y, m, 0)))
    const data = await getJSON(`${SITE}/${lg.path}/scoreboard?dates=${first}-${last}&limit=1000`)
    const evs = data?.events ?? []
    for (const ev of evs) { const g = parseGame(ev, lg.key); if (g?.id) byId.set(g.id, g) }
    process.stderr.write(`  ${lg.key} ${mo}: ${evs.length} events (running ${byId.size})\n`)
    await sleep(150)
  }
  return [...byId.values()]
}

async function fetchTeams(lg) {
  const data = await getJSON(`${SITE}/${lg.path}/teams`)
  const raw = data?.sports?.[0]?.leagues?.[0]?.teams ?? []
  return raw.map((e) => e?.team).filter(Boolean).map((t) => {
    const logos = t.logos ?? []
    const light = logos.find((l) => !String(l.href).includes('dark') && !String(l.href).includes('scoreboard'))
    return {
      id: String(t.id ?? ''), abbr: t.abbreviation ?? '', location: t.location ?? '',
      name: t.name ?? '', display: t.displayName ?? '',
      color: t.color ? `#${t.color}` : null, alt: t.alternateColor ? `#${t.alternateColor}` : null,
      logo: light?.href ?? logos[0]?.href ?? null,
    }
  })
}

// franchise.venue metadata (surface / indoor / photo / zip) keyed by venue id —
// only an enrichment source; the home venue itself comes from the games.
async function fetchFranchiseMeta(lg, teams) {
  const meta = new Map()
  for (const t of teams) {
    const d = await getJSON(`${SITE}/${lg.path}/teams/${t.id}`)
    await sleep(120)
    const v = d?.team?.franchise?.venue
    if (!v?.id) continue
    meta.set(String(v.id), {
      surface: typeof v.grass === 'boolean' ? (v.grass ? 'grass' : 'turf') : null,
      indoor: typeof v.indoor === 'boolean' ? (v.indoor ? 1 : 0) : null,
      image: Array.isArray(v.images) && v.images.length ? v.images[0]?.href : null,
      zip: v.address?.zipCode ?? null,
    })
  }
  return meta
}

// Each team's home venue = the venue it plays the MOST home games at (filters out
// neutral-site / preseason oddballs). Teams sharing a building collapse to one
// venue with multiple tenants (e.g. Rams + Chargers at SoFi).
async function buildVenues(lg, teams, games, meta) {
  const tally = new Map() // abbr -> Map(venueId -> {n,name,city,state,indoor})
  for (const g of games) {
    const vid = g.venue_id, abbr = g.home?.abbr
    if (!vid || !abbr) continue
    if (!tally.has(abbr)) tally.set(abbr, new Map())
    const m = tally.get(abbr)
    const cur = m.get(vid) || { n: 0, name: g.venue_name, city: g.venue_city, state: g.venue_state, indoor: g.venue_indoor }
    cur.n++
    m.set(vid, cur)
  }

  const byVenue = new Map()
  for (const t of teams) {
    const m = tally.get(t.abbr)
    if (!m) continue
    let chosen = null
    for (const [vid, info] of m) if (!chosen || info.n > chosen.info.n) chosen = { vid, info }
    if (!chosen) continue
    const { vid, info } = chosen
    if (!byVenue.has(vid)) {
      const mm = meta.get(vid) || {}
      let image = mm.image
      if (!image) {
        const u = `https://a.espncdn.com/i/venues/${lg.key}/day/${vid}.jpg`
        if (await imageExists(u)) image = u
      }
      byVenue.set(vid, {
        id: vid, name: info.name, city: info.city ?? null, state: info.state ?? null,
        zip: mm.zip ?? null,
        surface: mm.surface ?? null,
        indoor: mm.indoor ?? info.indoor ?? null,
        image: image ?? null,
        tenants: [],
      })
    }
    byVenue.get(vid).tenants.push({ league: lg.key, team_id: t.id })
  }
  return [...byVenue.values()]
}

// Walk an ESPN standings group: collect member teams from this node's entries AND
// any nested division children (e.g. Sun Belt East/West) into one flat list.
function collectCollegeTeams(node) {
  const out = []
  for (const e of node?.standings?.entries ?? []) {
    const t = e?.team
    if (!t?.id) continue
    const logos = t.logos ?? []
    const light = logos.find((l) => !String(l.href).includes('dark')) ?? logos[0]
    out.push({
      id: String(t.id), abbr: t.abbreviation ?? '', location: t.location ?? '',
      name: t.name ?? '', display: t.displayName ?? '',
      color: t.color ? `#${t.color}` : null,
      logo: light?.href ?? `https://a.espncdn.com/i/teamlogos/ncaa/500/${t.id}.png`,
    })
  }
  for (const c of node?.children ?? []) out.push(...collectCollegeTeams(c))
  return out
}

// Every D1 conference for a sport + its schools. Skips non-conference groups
// (isConference === false, e.g. the basketball "College Basketball Crown").
async function fetchConferences(cfg) {
  const data = await getJSON(`https://site.web.api.espn.com/apis/v2/sports/${cfg.path}/standings?season=${cfg.season}&level=${cfg.level}`)
  const out = []
  for (const c of data?.children ?? []) {
    if (c?.isConference === false) continue
    const teams = collectCollegeTeams(c)
    if (!teams.length) continue
    out.push({ id: String(c.id), name: c.name ?? c.shortName ?? '', shortName: c.shortName ?? null, teams })
  }
  return out
}

const cleanVenueName = (s) => String(s ?? '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/[–—]/g, '-').trim()
// Junk images that aren't a venue photo (logos, seals, maps, flags, SVG marks).
const JUNK_IMG = /logo|seal|crest|wordmark|emblem|locator|location.?map|\bflag\b|coat_of_arms|\bicon\b|\.svg(?:$|\?)/i

// Wikipedia REQUIRES a descriptive User-Agent — without one it throttles hard
// (429s), which silently looked like "no photo". Retry with backoff on throttle.
async function wikiGet(url) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'SnapbackSports/1.0 (Snapback venue photo ingest)' } })
      if (r.ok) return await r.json()
      if (r.status === 429) { await sleep(900 * (i + 1)); continue }
      return null
    } catch { await sleep(400 * (i + 1)) }
  }
  return null
}

// Top Wikipedia article's lead photo as a ~640px THUMBNAIL (not the multi-MB
// original — those load slowly). Junk-filtered.
async function wikiTopImage(query) {
  if (!query) return null
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=1&prop=pageimages&piprop=thumbnail&pithumbsize=640`
  const d = await wikiGet(url)
  const page = Object.values((d?.query?.pages) || {})[0]
  const img = page?.thumbnail?.source
  return img && !JUNK_IMG.test(img) ? img : null
}

const GENERIC_WORDS_C = new Set(['stadium', 'arena', 'gymnasium', 'center', 'centre', 'coliseum', 'pavilion', 'fieldhouse', 'field', 'court', 'forum', 'complex', 'events', 'event', 'wellness', 'athletic', 'memorial', 'university', 'college', 'house', 'hall', 'dome', 'bowl', 'bank', 'financial', 'insurance', 'health', 'first', 'trust', 'credit', 'union', 'family', 'the'])

// Direct Wikimedia Commons file search. REQUIRES the file's name to contain one of
// `tokens` (the venue's/school's distinctive words) — the Commons search is broad,
// so without this it grabs garbage (an Obama photo for "Fairleigh Dickinson arena",
// a cathedral for "Sacred Heart", etc.). That name-match is the correctness gate.
async function commonsImage(query, tokens) {
  if (!query || !tokens.length) return null
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url&iiurlwidth=640`
  const d = await wikiGet(url)
  const pages = Object.values((d?.query?.pages) || {}).sort((a, b) => (a.index || 9) - (b.index || 9))
  for (const p of pages) {
    const t = String(p.title || '').toLowerCase()
    const ii = (p.imageinfo || [])[0] || {}
    const u = ii.thumburl || ii.url
    if (!u || JUNK_IMG.test(u) || !/\.(jpe?g|png)$/.test(t) || t.includes('logo') || t.includes('map')) continue
    if (tokens.some((tok) => t.includes(tok))) return u
  }
  return null
}

// Best-effort venue photo for venues ESPN didn't photograph. Tries the Wikipedia
// article photo (school-disambiguated), then a Commons file search gated on a
// venue/school name-match. Real Commons images only — lower confidence than ESPN.
async function wikiVenueImage(venueName, schoolHint) {
  const name = cleanVenueName(venueName)
  if (!name) return null
  const tokens = [...name.toLowerCase().split(/[^a-z0-9]+/), ...String(schoolHint).toLowerCase().split(/[^a-z0-9]+/)]
    .filter((w) => w.length >= 4 && !GENERIC_WORDS_C.has(w))
  return (await wikiTopImage(`${name} ${schoolHint}`.trim()))
    || (await wikiTopImage(name))
    || (await commonsImage(`${name} ${schoolHint}`.trim(), tokens))
    || (await commonsImage(`${schoolHint} arena`.trim(), tokens))
}

// Each college team's home venue via the CORE API (the site API team endpoint has
// no venue for college; the core API embeds it). Grouped by venue id; tenants =
// the team(s) that play there. ESPN photo if present, else a verified Wikipedia one.
// Hand-verified Commons photos for college venues the auto-pipeline can't resolve:
// ESPN's core API has no image AND the Wikipedia lead/search returns a WRONG image
// the verification gate rightly rejects (a president's portrait for "James Madison",
// a Super Bowl security photo on the Devlin Fieldhouse page, the predecessor arena).
// Each URL was eyeballed-correct by filename + page. Keyed by ESPN venue id; applied
// last so it wins over the auto pass. (Atlantic Union Bank Center / JMU id 7107 has
// NO correct free photo on Commons — stays on the honest logo card, not faked.)
const CURATED_VENUE_IMAGES = {
  '2168': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Northern_Colorado_Bears_-_Bank_of_Colorado_Arena.JPG/960px-Northern_Colorado_Bears_-_Bank_of_Colorado_Arena.JPG', // Bank of Colorado Arena — Northern Colorado
  '2048': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Devlin_Fieldhouse-Tulane_Green_Wave_men%27s_basketball.jpg/960px-Devlin_Fieldhouse-Tulane_Green_Wave_men%27s_basketball.jpg', // Avron B. Fogelman Arena in the Devlin Fieldhouse — Tulane
  '2216': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Ocean_Bank_Convocation_Center_from_front.jpg/960px-Ocean_Bank_Convocation_Center_from_front.jpg', // Ocean Bank Convocation Center — FIU
  '7116': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Outside_of_the_Nido_and_Mariana_Qubein_Arena%2C_Conference_Center_and_Jana_and_Ken_Kahn_Hotel.jpg/960px-Outside_of_the_Nido_and_Mariana_Qubein_Arena%2C_Conference_Center_and_Jana_and_Ken_Kahn_Hotel.jpg', // Qubein Center — High Point
  '5994': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/CBU_Events_Center_%28Riverside%2C_California%29.jpg/960px-CBU_Events_Center_%28Riverside%2C_California%29.jpg', // Dale E. and Sarah Ann Fowler Events Center (CBU Events Center) — California Baptist
  '2020': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/KSUMACC.JPG/960px-KSUMACC.JPG', // M.A.C. Center (Memorial Athletic and Convocation Center) — Kent State
  // Self-hosted official arena photos (no free-licensed Wikimedia image exists). Each
  // was visually verified as the correct building/court, then committed under
  // public/img/venues/<id>.jpg so the path is stable (not a fragile hotlink).
  '2042': '/img/venues/2042.jpg', // Reilly Center — St. Bonaventure
  '2191': '/img/venues/2191.jpg', // Pete Hanna Center — Samford
  '5725': '/img/venues/5725.jpg', // Schar Center — Elon
  '1972': '/img/venues/1972.jpg', // University Arena (Read Fieldhouse) — Western Michigan
  '2064': '/img/venues/2064.jpg', // Hytche Center — Maryland Eastern Shore
  '2130': '/img/venues/2130.jpg', // Pete Mathews Coliseum — Jacksonville State
  '4935': '/img/venues/4935.jpg', // Freedom Hall — East Tennessee State
  '2138': '/img/venues/2138.jpg', // Groniger Arena (Lantz Arena) — Eastern Illinois
  '1959': '/img/venues/1959.jpg', // Reese Court — Eastern Washington
  '2040': '/img/venues/2040.jpg', // University Center — SE Louisiana
  '1957': '/img/venues/1957.jpg', // Memorial Hall — Delaware State
  '2004': '/img/venues/2004.jpg', // Leede Arena — Dartmouth
  '2070': '/img/venues/2070.jpg', // G.B. Hodge Center — South Carolina Upstate
  '2113': '/img/venues/2113.jpg', // Gentry Center — Tennessee State
  '1908': '/img/venues/1908.jpg', // Farris Center — Central Arkansas
  '1965': '/img/venues/1965.jpg', // Redhawk Center — Seattle U
  '7107': '/img/venues/7107.jpg', // Atlantic Union Bank Center — James Madison
  '7508': '/img/venues/7508.jpg', // F&M Bank Arena — Austin Peay
  '2076': '/img/venues/2076.jpg', // Bogota Savings Bank Center (Stratis Arena) — Fairleigh Dickinson
  '10675': '/img/venues/10675.jpg', // Jack and Ruth Ann Hill Convocation Center — Georgia Southern
  '9548': '/img/venues/9548.jpg', // The Coliseum — West Georgia
  '1916': '/img/venues/1916.jpg', // William H. Pitt Center — Sacred Heart
  '7095': '/img/venues/7095.jpg', // Burns Arena — Utah Tech
  '2105': '/img/venues/2105.jpg', // H.O. Clemmons Arena — Arkansas-Pine Bluff
  '5995': '/img/venues/5995.jpg', // Flowers Hall (CB&S Bank Arena) — North Alabama
  '7341': '/img/venues/7341.jpg', // Merkert Gymnasium — Stonehill
  '11954': '/img/venues/11954.png', // EECU Center — Tarleton State
  '553': '/img/venues/553.jpg', // Alex G. Spanos Center — Pacific
  '2129': '/img/venues/2129.jpg', // The Jungle (IUPUI Gymnasium) — IU Indianapolis
  '4606': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/ME_Alumni_Memorial_Gym-Facade_2024.jpg/960px-ME_Alumni_Memorial_Gym-Facade_2024.jpg', // Memorial Gymnasium (The Pit) — Maine (free Commons)
  '11540': '/img/venues/11540.jpg', // Jeffery P. Hazell Athletics Center (Charger Athletics Center) — New Haven
  '7109': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Sutter_Health_Park_view_on_an_off-day.jpg/960px-Sutter_Health_Park_view_on_an_off-day.jpg', // Sutter Health Park (Athletics temp home) — MLB, free Commons
  // User-supplied official photos — no public source had these; provided directly and
  // verified by on-court/banner signage. Self-hosted like the rest. (Now CBB 365/365.)
  '854': '/img/venues/854.png', // Hamilton Gymnasium — Denver
  '7510': '/img/venues/7510.png', // Ted Grant Court (Le Moyne Events Center) — Le Moyne
  '2072': '/img/venues/2072.png', // Davey L. Whitney Complex — Alcorn State
}

async function fetchCollegeVenues(cfg, teams) {
  const [sport, leagueKey] = cfg.path.split('/')
  const byVenue = new Map()
  for (const team of teams) {
    const d = await getJSON(`http://sports.core.api.espn.com/v2/sports/${sport}/leagues/${leagueKey}/seasons/${cfg.season}/teams/${team.id}?lang=en`)
    await sleep(80)
    const v = d?.venue
    if (!v?.id) continue
    const vid = String(v.id)
    if (!byVenue.has(vid)) {
      const imgs = v.images ?? []
      byVenue.set(vid, {
        id: vid, name: v.fullName ?? '', city: v.address?.city ?? null, state: v.address?.state ?? null,
        zip: v.address?.zipCode ?? null,
        surface: typeof v.grass === 'boolean' ? (v.grass ? 'grass' : 'turf') : null,
        indoor: typeof v.indoor === 'boolean' ? (v.indoor ? 1 : 0) : null,
        image: imgs.length ? (imgs[0]?.href ?? null) : null,
        schoolHint: team.location || '',
        tenants: [],
      })
    }
    byVenue.get(vid).tenants.push(team.id)
  }
  const venues = [...byVenue.values()]
  let wiki = 0
  for (const v of venues) {
    if (v.image) continue
    const img = await wikiVenueImage(v.name, v.schoolHint)
    await sleep(60)
    if (img) { v.image = img; wiki++ }
  }
  process.stderr.write(`    [${cfg.key}] +${wiki} venue photos from Wikipedia\n`)
  let curated = 0
  for (const v of venues) {
    if (CURATED_VENUE_IMAGES[v.id]) { v.image = CURATED_VENUE_IMAGES[v.id]; curated++ }
  }
  if (curated) process.stderr.write(`    [${cfg.key}] +${curated} curated venue photos\n`)
  return venues
}

// ---- SQL emit helpers ----
const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`)
const n = (v) => (v === null || v === undefined ? 'NULL' : Number(v))
const stamp = new Date().toISOString()

;(async () => {
  // Full refresh: clear the repopulated tables so stale rows (e.g. a relocated
  // team's old venue mapping) don't linger — INSERT OR REPLACE alone can't.
  const out = [
    'PRAGMA foreign_keys=OFF;', 'BEGIN TRANSACTION;',
    'DELETE FROM conference_teams;', 'DELETE FROM conferences;',
    'DELETE FROM venue_teams;', 'DELETE FROM venues;', 'DELETE FROM games;', 'DELETE FROM teams;',
  ]
  for (const lg of LEAGUES) {
    out.push(`INSERT OR REPLACE INTO leagues (key,label,sport,espn_path) VALUES (${q(lg.key)},${q(lg.label)},${q(lg.sport)},${q(lg.path)});`)
  }

  let totalGames = 0, totalTeams = 0, totalVenues = 0
  for (const lg of LEAGUES) {
    process.stderr.write(`[${lg.key}] teams…\n`)
    const teams = await fetchTeams(lg)
    for (const t of teams) {
      out.push(`INSERT OR REPLACE INTO teams (league,id,abbr,location,name,display_name,color,alt_color,logo) VALUES (${q(lg.key)},${q(t.id)},${q(t.abbr)},${q(t.location)},${q(t.name)},${q(t.display)},${q(t.color)},${q(t.alt)},${q(t.logo)});`)
    }
    totalTeams += teams.length

    process.stderr.write(`[${lg.key}] games…\n`)
    const games = await fetchSeasonGames(lg)
    for (const g of games) {
      out.push(
        `INSERT OR REPLACE INTO games (league,id,date,season,season_type,state,detail,completed,name,short_name,venue_id,venue_name,venue_city,venue_state,` +
        `home_team_id,home_abbr,home_location,home_name,home_display,home_color,home_logo,home_score,home_winner,` +
        `away_team_id,away_abbr,away_location,away_name,away_display,away_color,away_logo,away_score,away_winner,updated_at) VALUES (` +
        `${q(g.league)},${q(g.id)},${q(g.date)},${n(g.season)},${n(g.season_type)},${q(g.state)},${q(g.detail)},${n(g.completed)},${q(g.name)},${q(g.short_name)},${q(g.venue_id)},${q(g.venue_name)},${q(g.venue_city)},${q(g.venue_state)},` +
        `${q(g.home.id)},${q(g.home.abbr)},${q(g.home.location)},${q(g.home.name)},${q(g.home.display)},${q(g.home.color)},${q(g.home.logo)},${n(g.home.score)},${n(g.home.winner)},` +
        `${q(g.away.id)},${q(g.away.abbr)},${q(g.away.location)},${q(g.away.name)},${q(g.away.display)},${q(g.away.color)},${q(g.away.logo)},${n(g.away.score)},${n(g.away.winner)},${q(stamp)});`,
      )
    }
    totalGames += games.length

    process.stderr.write(`[${lg.key}] venues (from games + franchise meta)…\n`)
    const meta = await fetchFranchiseMeta(lg, teams)
    const venues = await buildVenues(lg, teams, games, meta)
    for (const v of venues) {
      if (CURATED_VENUE_IMAGES[v.id]) v.image = CURATED_VENUE_IMAGES[v.id] // pro venues ESPN didn't photograph (e.g. Sutter Health Park)
      out.push(`INSERT OR REPLACE INTO venues (id,name,city,state,zip,surface,indoor,image) VALUES (${q(v.id)},${q(v.name)},${q(v.city)},${q(v.state)},${q(v.zip)},${q(v.surface)},${n(v.indoor)},${q(v.image)});`)
      for (const tn of v.tenants) {
        out.push(`INSERT OR REPLACE INTO venue_teams (venue_id,league,team_id) VALUES (${q(v.id)},${q(tn.league)},${q(tn.team_id)});`)
      }
    }
    totalVenues += venues.length
    process.stderr.write(`[${lg.key}] -> ${games.length} games, ${teams.length} teams, ${venues.length} venues\n`)
  }

  // ---- college: conferences + schools + venues (with ESPN photos; no games) ----
  let totalConfs = 0, totalCollegeTeams = 0, totalCollegeVenues = 0
  for (const cfg of COLLEGE) {
    out.push(`INSERT OR REPLACE INTO leagues (key,label,sport,espn_path) VALUES (${q(cfg.key)},${q(cfg.label)},${q(cfg.sport)},${q(cfg.path)});`)
    process.stderr.write(`[${cfg.key}] conferences…\n`)
    const confs = await fetchConferences(cfg)
    confs.forEach((c, i) => {
      out.push(`INSERT OR REPLACE INTO conferences (league,id,name,short_name,sort) VALUES (${q(cfg.key)},${q(c.id)},${q(c.name)},${q(c.shortName)},${n(i)});`)
      for (const t of c.teams) {
        out.push(`INSERT OR REPLACE INTO teams (league,id,abbr,location,name,display_name,color,alt_color,logo) VALUES (${q(cfg.key)},${q(t.id)},${q(t.abbr)},${q(t.location)},${q(t.name)},${q(t.display)},${q(t.color)},NULL,${q(t.logo)});`)
        out.push(`INSERT OR REPLACE INTO conference_teams (league,conference_id,team_id) VALUES (${q(cfg.key)},${q(c.id)},${q(t.id)});`)
      }
      totalCollegeTeams += c.teams.length
    })
    totalConfs += confs.length

    // venues: one core-API call per team -> its home venue + ESPN photo
    process.stderr.write(`[${cfg.key}] venues…\n`)
    const teams = confs.flatMap((c) => c.teams)
    const venues = await fetchCollegeVenues(cfg, teams)
    for (const v of venues) {
      out.push(`INSERT OR REPLACE INTO venues (id,name,city,state,zip,surface,indoor,image) VALUES (${q(v.id)},${q(v.name)},${q(v.city)},${q(v.state)},${q(v.zip)},${q(v.surface)},${n(v.indoor)},${q(v.image)});`)
      for (const tid of v.tenants) {
        out.push(`INSERT OR REPLACE INTO venue_teams (venue_id,league,team_id) VALUES (${q(v.id)},${q(cfg.key)},${q(tid)});`)
      }
    }
    totalCollegeVenues += venues.length
    process.stderr.write(`[${cfg.key}] -> ${confs.length} conferences, ${confs.reduce((s, c) => s + c.teams.length, 0)} schools, ${venues.length} venues (${venues.filter((v) => v.image).length} w/ photo)\n`)
  }

  out.push('COMMIT;')
  await writeFile('db/seed.generated.sql', out.join('\n') + '\n')
  process.stderr.write(`\nWROTE db/seed.generated.sql — ${totalGames} games, ${totalTeams} teams, ${totalVenues} venues, ${totalConfs} conferences, ${totalCollegeTeams} college teams, ${totalCollegeVenues} college venues\n`)
})()
