// Incremental ESPN -> SQL ingest layered ON TOP of ingest.mjs (which seeds the pro
// MLB/NFL/NBA + college conferences/teams/venues). This adds, for the 2025-26 season:
//   • NHL as a full league: teams, venues (with ESPN photos), venue_teams.
//   • Games for college-football, college-basketball, and nhl — one ESPN per-team
//     SCHEDULE fetch per team (the "one agent per team" fan-out), real data only.
// Why a separate script: re-running the full ingest re-fetches the Wikipedia college
// venue photos (flaky, already hand-tuned), so we layer the new data instead.
//
// Output: db/seed.extra.generated.sql  (applied after seed.generated.sql in db:seed:local)
// It also applies straight to the local D1 so the result is live immediately.

import { writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const SITE = 'https://site.api.espn.com/apis/site/v2/sports'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v))
const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`)
const n = (v) => (v === null || v === undefined ? 'NULL' : Number(v))
const stamp = new Date().toISOString()

async function getJSON(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'SnapbackSports/1.0 (schedule ingest)' } })
      if (r.status === 429) { await sleep(700 * (i + 1)); continue }
      if (!r.ok) return null
      return await r.json()
    } catch { await sleep(300 * (i + 1)) }
  }
  return null
}

// Run async `worker` over `items` with bounded concurrency.
async function pool(items, worker, concurrency = 12) {
  const results = new Array(items.length)
  let i = 0
  async function run() { while (i < items.length) { const idx = i++; results[idx] = await worker(items[idx], idx) } }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run))
  return results
}

// ---- schedule-event parser (the team SCHEDULE API differs from the scoreboard:
// status + venue live on competition, season type is `seasonType`, logos are an
// array, and there is no team color). ----
function parseScheduleEvent(ev, league) {
  const comp = ev?.competitions?.[0]
  if (!comp) return null
  const cs = comp.competitors ?? []
  if (cs.length !== 2) return null
  const st = comp.status?.type ?? {}
  const team = (c) => {
    const t = c?.team ?? {}
    const sc = c?.score
    return {
      id: String(t.id ?? ''),
      abbr: t.abbreviation ?? '',
      location: t.location ?? '',
      name: t.nickname ?? t.name ?? '',
      display: t.displayName ?? '',
      color: t.color ? `#${t.color}` : null,
      logo: t.logos?.[0]?.href ?? t.logo ?? null,
      score: sc == null ? null : (typeof sc === 'object' ? num(sc.value) : num(sc)),
      winner: c?.winner ? 1 : 0,
    }
  }
  const home = team(cs.find((c) => c.homeAway === 'home') ?? cs[0])
  const away = team(cs.find((c) => c.homeAway === 'away') ?? cs[1])
  const stateRaw = st.state
  return {
    league, id: String(ev.id ?? ''),
    date: ev.date ?? '',
    season: num(ev.season?.year),
    season_type: num(ev.seasonType?.type),
    state: ['pre', 'in', 'post'].includes(stateRaw) ? stateRaw : 'unknown',
    detail: st.shortDetail ?? st.detail ?? '',
    completed: st.completed ? 1 : 0,
    name: ev.name ?? '',
    short_name: ev.shortName ?? '',
    venue_id: comp.venue?.id ? String(comp.venue.id) : null,
    venue_name: comp.venue?.fullName ?? null,
    venue_city: comp.venue?.address?.city ?? null,
    venue_state: comp.venue?.address?.state ?? null,
    home, away,
  }
}

// Every game a set of teams played in one season — both regular (seasontype 2) and
// postseason (3), merged + de-duped by event id (each game is on two teams' cards).
async function fetchScheduleGames(leagueKey, path, season, teamIds) {
  const byId = new Map()
  let done = 0
  await pool(teamIds, async (id) => {
    for (const stype of [2, 3]) {
      const data = await getJSON(`${SITE}/${path}/teams/${id}/schedule?season=${season}&seasontype=${stype}`)
      for (const ev of data?.events ?? []) {
        const g = parseScheduleEvent(ev, leagueKey)
        if (g?.id && g.home.id && g.away.id) byId.set(g.id, g)
      }
    }
    if (++done % 25 === 0 || done === teamIds.length) process.stderr.write(`  [${leagueKey}] ${done}/${teamIds.length} teams, ${byId.size} games\n`)
  })
  return [...byId.values()]
}

function gameInsert(g) {
  return (
    `INSERT OR REPLACE INTO games (league,id,date,season,season_type,state,detail,completed,name,short_name,venue_id,venue_name,venue_city,venue_state,` +
    `home_team_id,home_abbr,home_location,home_name,home_display,home_color,home_logo,home_score,home_winner,` +
    `away_team_id,away_abbr,away_location,away_name,away_display,away_color,away_logo,away_score,away_winner,updated_at) VALUES (` +
    `${q(g.league)},${q(g.id)},${q(g.date)},${n(g.season)},${n(g.season_type)},${q(g.state)},${q(g.detail)},${n(g.completed)},${q(g.name)},${q(g.short_name)},${q(g.venue_id)},${q(g.venue_name)},${q(g.venue_city)},${q(g.venue_state)},` +
    `${q(g.home.id)},${q(g.home.abbr)},${q(g.home.location)},${q(g.home.name)},${q(g.home.display)},${q(g.home.color)},${q(g.home.logo)},${n(g.home.score)},${n(g.home.winner)},` +
    `${q(g.away.id)},${q(g.away.abbr)},${q(g.away.location)},${q(g.away.name)},${q(g.away.display)},${q(g.away.color)},${q(g.away.logo)},${n(g.away.score)},${n(g.away.winner)},${q(stamp)});`
  )
}

// team ids already seeded for a college league (keeps game abbrs aligned with /api/teams)
function dbTeamIds(league) {
  const out = execSync(`npx wrangler d1 execute DB --local --json --command "SELECT id FROM teams WHERE league='${league}'" 2>/dev/null`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return JSON.parse(out)[0].results.map((r) => String(r.id))
}

// ---- NHL teams + venues (a brand-new pro league) ----
async function fetchNhlTeams() {
  const data = await getJSON(`${SITE}/hockey/nhl/teams`)
  const raw = data?.sports?.[0]?.leagues?.[0]?.teams ?? []
  return raw.map((e) => e?.team).filter(Boolean).map((t) => ({
    id: String(t.id), abbr: t.abbreviation ?? '', location: t.location ?? '', name: t.name ?? '',
    display: t.displayName ?? '', color: t.color ? `#${t.color}` : null,
    alt: t.alternateColor ? `#${t.alternateColor}` : null,
    logo: (t.logos?.find((l) => !String(l.href).includes('dark') && !String(l.href).includes('scoreboard'))?.href) ?? t.logos?.[0]?.href ?? null,
  }))
}
async function fetchNhlVenues(teams) {
  const byVenue = new Map()
  await pool(teams, async (t) => {
    const d = await getJSON(`${SITE}/hockey/nhl/teams/${t.id}`)
    const v = d?.team?.franchise?.venue
    if (!v?.id || !v?.fullName) return
    const vid = String(v.id)
    if (!byVenue.has(vid)) byVenue.set(vid, {
      id: vid, name: v.fullName, city: v.address?.city ?? null, state: v.address?.state ?? null,
      zip: v.address?.zipCode ?? null, surface: null,
      indoor: typeof v.indoor === 'boolean' ? (v.indoor ? 1 : 0) : 1,
      image: Array.isArray(v.images) && v.images.length ? v.images[0]?.href : null,
      tenants: [],
    })
    byVenue.get(vid).tenants.push(t.id)
  }, 8)
  return [...byVenue.values()]
}

// ---------------------------------------------------------------------------
async function main() {
  const out = ['PRAGMA foreign_keys=OFF;', 'BEGIN TRANSACTION;']
  // wipe only the leagues this script owns, so re-runs are clean + pro games untouched
  out.push(`DELETE FROM games WHERE league IN ('college-football','college-basketball','nhl');`)
  out.push(`DELETE FROM venue_teams WHERE league='nhl';`)
  out.push(`DELETE FROM teams WHERE league='nhl';`)

  // ---- NHL league + teams + venues ----
  process.stderr.write('[nhl] teams…\n')
  const nhlTeams = await fetchNhlTeams()
  out.push(`INSERT OR REPLACE INTO leagues (key,label,sport,espn_path) VALUES ('nhl','NHL','Hockey','hockey/nhl');`)
  for (const t of nhlTeams) {
    out.push(`INSERT OR REPLACE INTO teams (league,id,abbr,location,name,display_name,color,alt_color,logo) VALUES ('nhl',${q(t.id)},${q(t.abbr)},${q(t.location)},${q(t.name)},${q(t.display)},${q(t.color)},${q(t.alt)},${q(t.logo)});`)
  }
  process.stderr.write(`[nhl] venues…\n`)
  const nhlVenues = await fetchNhlVenues(nhlTeams)
  let nhlImg = 0
  for (const v of nhlVenues) {
    if (v.image) nhlImg++
    out.push(`INSERT OR REPLACE INTO venues (id,name,city,state,zip,surface,indoor,image) VALUES (${q(v.id)},${q(v.name)},${q(v.city)},${q(v.state)},${q(v.zip)},${q(v.surface)},${n(v.indoor)},${q(v.image)});`)
    for (const tid of v.tenants) out.push(`INSERT OR REPLACE INTO venue_teams (venue_id,league,team_id) VALUES (${q(v.id)},'nhl',${q(tid)});`)
  }
  process.stderr.write(`[nhl] ${nhlTeams.length} teams, ${nhlVenues.length} venues (${nhlImg} with photos)\n`)

  // ---- games: CFB (2025), CBB (2026), NHL (2026) — 2025-26 season only ----
  const jobs = [
    { key: 'college-football', path: 'football/college-football', season: 2025, ids: dbTeamIds('college-football') },
    { key: 'college-basketball', path: 'basketball/mens-college-basketball', season: 2026, ids: dbTeamIds('college-basketball') },
    { key: 'nhl', path: 'hockey/nhl', season: 2026, ids: nhlTeams.map((t) => t.id) },
  ]
  const counts = {}
  for (const j of jobs) {
    process.stderr.write(`[${j.key}] games (${j.ids.length} teams)…\n`)
    const games = await fetchScheduleGames(j.key, j.path, j.season, j.ids)
    counts[j.key] = games.length
    for (const g of games) out.push(gameInsert(g))
  }

  out.push('COMMIT;')
  writeFileSync('db/seed.extra.generated.sql', out.join('\n') + '\n')
  process.stderr.write(`\nGames: CFB ${counts['college-football']}, CBB ${counts['college-basketball']}, NHL ${counts['nhl']}\n`)
  process.stderr.write('Wrote db/seed.extra.generated.sql — applying to local D1…\n')
  execSync('npx wrangler d1 execute DB --local --file db/seed.extra.generated.sql 2>/dev/null', { stdio: 'inherit' })
  process.stderr.write('Done.\n')
}
main()
