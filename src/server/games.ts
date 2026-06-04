import { createServerFn } from '@tanstack/react-start'

// Ported verbatim from the static site's server.js /api/games proxy.
// Pulls live World Cup 2026 fixtures from the Ticketmaster Discovery API.
// The API key is read from the environment only (never committed).

const KEY = process.env.TICKETMASTER_API_KEY
const TM = 'https://app.ticketmaster.com/discovery/v2/events.json'

let cache: { ts: number; data: any[] | null } = { ts: 0, data: null }
const CACHE_MS = 15 * 60 * 1000

function parseEvent(e: any) {
  const v = (e._embedded && e._embedded.venues && e._embedded.venues[0]) || {}
  const name = e.name || ''
  let a = '', b = '', group = '', matchNo = '', round = ''
  const s = name.replace(/^World Cup:\s*/i, '').trim()
  const mm = s.match(/Match\s+(\d+)/i); if (mm) matchNo = mm[1]
  const gm = s.match(/Group\s+([A-Z])/i); if (gm) group = gm[1]
  const rm = s.match(/(Round of \d+|Quarter[- ]?final|Semi[- ]?final|Third[- ]?place|Final)/i); if (rm) round = rm[1]
  const vIdx = s.search(/\s+vs\.?\s+/i)
  if (vIdx > -1) {
    b = s.slice(vIdx).replace(/^\s+vs\.?\s+/i, '').trim()
    a = s.slice(0, vIdx)
      .replace(/Match\s+\d+/i, '').replace(/Group\s+[A-Z]/i, '')
      .replace(/Round of \d+/i, '').replace(/Quarter[- ]?final/i, '').replace(/Semi[- ]?final/i, '')
      .replace(/Third[- ]?place([- ]play[- ]?off)?/i, '').replace(/\bFinal\b/i, '')
      .replace(/^[\s\-]+/, '').replace(/[\s\-]+$/, '').trim()
  }
  const d = (e.dates && e.dates.start) || {}
  return {
    id: e.id, name, a, b, group, matchNo: matchNo ? Number(matchNo) : null, round,
    venue: v.name || '', city: (v.city && v.city.name) || '', state: (v.state && v.state.stateCode) || '',
    country: (v.country && v.country.countryCode) || '',
    date: d.localDate || '', time: d.localTime || '', status: (e.dates && e.dates.status && e.dates.status.code) || '',
    url: e.url || '', priceRanges: e.priceRanges || null,
  }
}

async function fetchCountry(cc: string) {
  const out: any[] = []
  for (let page = 0; page < 3; page++) {
    const q = new URLSearchParams({
      classificationName: 'Soccer', keyword: 'World Cup',
      startDateTime: '2026-06-10T00:00:00Z', endDateTime: '2026-07-20T00:00:00Z',
      countryCode: cc, source: 'ticketmaster,tmr', size: '100', page: String(page),
      sort: 'date,asc', apikey: KEY || '',
    })
    const r = await fetch(TM + '?' + q.toString())
    if (!r.ok) break
    const j: any = await r.json()
    const evs = (j._embedded && j._embedded.events) || []
    out.push(...evs)
    const tp = (j.page && j.page.totalPages) || 1
    if (page >= tp - 1) break
  }
  return out
}

async function getGames() {
  if (cache.data && Date.now() - cache.ts < CACHE_MS) return cache.data
  if (!KEY) throw new Error('TICKETMASTER_API_KEY not set')
  const all: any[] = []
  for (const cc of ['US', 'CA', 'MX']) { try { all.push(...await fetchCountry(cc)) } catch (e) {} }
  const seen = new Set<string>()
  const matches = all
    .filter((e) => /^World Cup:/i.test(e.name || '') && !/(festival|watch party|kickoff|party|fan fest)/i.test(e.name || ''))
    .filter((e) => { if (seen.has(e.id)) return false; seen.add(e.id); return true })
    .map(parseEvent)
    .filter((m) => m.a && m.b)
    .sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time) || (x.matchNo || 999) - (y.matchNo || 999))
  cache = { ts: Date.now(), data: matches }
  return matches
}

export const getGamesFn = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    const data = await getGames()
    return { ok: true as const, count: data.length, cachedAt: new Date(cache.ts).toISOString(), matches: data }
  } catch (e: any) {
    return { ok: false as const, error: String(e?.message || e), count: 0, matches: [] as any[] }
  }
})
