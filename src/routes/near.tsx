import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteNav } from '../components/SiteNav'
import { PageCssGuard } from '../components/PageCssGuard'
import { containerWide } from '../lib/ui'
import { GameRow } from '../components/GameRow'
import { getJSON } from '../lib/dataCache'
import { SPORTS, RANKABLE_LEAGUES, type League } from '../lib/sports'
import { toStoredUtc, localDayKey } from '../lib/weekend'
import { cityKey, haversineMiles, fmtMiles, loadCityCoords, type LatLng } from '../lib/geo'
import type { Game } from '../lib/espn'

// "Near you" — upcoming games sorted by real distance from the fan (Jack's
// trending-near-me ask). Distance is CITY-level: venue cities map to centroid
// coordinates from the generated /data/city-coords.json; games in a city the
// geocoder couldn't resolve carry no distance and drop out. Location is always
// explicit — a "Use my location" button or a city picker, never an unprompted
// permission dialog — and the last anchor persists per device.

// First fully-Tailwind page of the migration: no per-route page CSS — only the
// shared gamerow.css for the GameRow rows (PageCssGuard still needs the id).
export const Route = createFileRoute('/near')({
  head: () => ({
    links: [],
    meta: [{ title: 'Snapback · Near You' }],
  }),
  component: Near,
})

const RANGE_MILES = 150
const WINDOW_DAYS = 14

interface Anchor extends LatLng { label: string }
const STORE_KEY = 'sbx:near-loc:v1'

function loadAnchor(): Anchor | null {
  try {
    const a = JSON.parse(window.localStorage.getItem(STORE_KEY) || 'null')
    return a && typeof a.lat === 'number' && typeof a.lng === 'number' ? a : null
  } catch {
    return null
  }
}
function saveAnchor(a: Anchor) {
  try { window.localStorage.setItem(STORE_KEY, JSON.stringify(a)) } catch { /* ignore */ }
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const dayLabel = (d: Date) => `${WD[d.getDay()]} · ${MON[d.getMonth()]} ${d.getDate()}`

// "chicago|il" -> "Chicago, IL"
const cityLabel = (key: string) => {
  const [c, s] = key.split('|')
  const cap = (w: string) => w.replace(/\b[a-z]/g, (ch) => ch.toUpperCase())
  return cap(c) + (s ? ', ' + (s.length <= 2 ? s.toUpperCase() : cap(s)) : '')
}

function Near() {
  const [coords, setCoords] = useState<Record<string, LatLng> | null>(null)
  const [games, setGames] = useState<Game[] | null>(null)
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [locBusy, setLocBusy] = useState(false)
  const [locErr, setLocErr] = useState<string | null>(null)
  const [cityQ, setCityQ] = useState('')
  const [filter, setFilter] = useState<'all' | League>('all')

  useEffect(() => { setAnchor(loadAnchor()); setHydrated(true) }, [])

  useEffect(() => {
    let alive = true
    loadCityCoords().then((c) => { if (alive) setCoords(c) }).catch(() => { if (alive) setCoords({}) })
    const now = new Date()
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + WINDOW_DAYS, 23, 59)
    getJSON(`/api/games?from=${encodeURIComponent(toStoredUtc(now))}&to=${encodeURIComponent(toStoredUtc(end))}&limit=1000`)
      .then((r: any) => { if (alive) setGames(Array.isArray(r?.data) ? r.data : []) })
      .catch(() => { if (alive) setGames([]) })
    return () => { alive = false }
  }, [])

  const useMyLocation = () => {
    if (!navigator.geolocation) { setLocErr("This browser can't share your location. Pick your city instead."); return }
    setLocBusy(true); setLocErr(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const a: Anchor = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'your location' }
        setAnchor(a); saveAnchor(a); setLocBusy(false)
      },
      () => { setLocBusy(false); setLocErr("Couldn't get your location. Pick your city instead.") },
      { maximumAge: 600000, timeout: 10000 },
    )
  }

  const pickCity = (key: string) => {
    const c = coords?.[key]
    if (!c) return
    const a: Anchor = { ...c, label: cityLabel(key) }
    setAnchor(a); saveAnchor(a); setCityQ('')
  }

  // City picker suggestions (fallback path — also useful when geolocation is denied).
  const citySuggestions = useMemo(() => {
    const q = cityQ.trim().toLowerCase()
    if (!coords || q.length < 2) return []
    return Object.keys(coords).filter((k) => k.startsWith(q) || k.includes('|' + q)).sort().slice(0, 8)
  }, [coords, cityQ])

  // Every upcoming game within range, its distance attached; nearest first.
  const nearby = useMemo(() => {
    if (!anchor || !coords || !games) return null
    const out: { g: Game; miles: number }[] = []
    for (const g of games) {
      const c = coords[cityKey(g.venue.city, g.venue.state)]
      if (!c) continue // unresolved city — no honest distance to show
      const miles = haversineMiles(anchor, c)
      if (miles <= RANGE_MILES) out.push({ g, miles })
    }
    return out.filter(({ g }) => filter === 'all' || g.league === filter)
  }, [anchor, coords, games, filter])

  // Day sections (soonest first), nearest-first within each day.
  const days = useMemo(() => {
    if (!nearby) return []
    const by = new Map<string, { date: Date; items: { g: Game; miles: number }[] }>()
    for (const it of nearby) {
      const d = new Date(it.g.date)
      const key = localDayKey(d)
      if (!by.has(key)) by.set(key, { date: new Date(d.getFullYear(), d.getMonth(), d.getDate()), items: [] })
      by.get(key)!.items.push(it)
    }
    const list = [...by.values()].sort((a, b) => a.date.getTime() - b.date.getTime())
    for (const day of list) day.items.sort((a, b) => a.miles - b.miles)
    return list
  }, [nearby])

  const container = containerWide
  const chip = (on: boolean) =>
    'cursor-pointer border-2 border-ink px-3.5 py-2 text-[13px] font-bold uppercase tracking-[0.4px] text-ink ' +
    (on ? 'bg-brand' : 'bg-white')
  const emptyCls = 'px-0.5 py-[18px] text-[15px] text-muted [&_a]:border-b-2 [&_a]:border-brand [&_a]:font-extrabold'

  return (
    <div className="min-h-screen bg-paper font-sans text-[#33352f] [&_h1]:font-display [&_h2]:font-display [&_h1]:uppercase [&_h2]:uppercase [&_h1]:leading-none [&_h2]:leading-none [&_h1]:tracking-[1px] [&_h2]:tracking-[1px]">
      <PageCssGuard id="near" />
      <SiteNav />
      <section className="relative z-[5] bg-ink-soft py-10 pb-[38px] text-white">
        {/* the faint grid the dark headers carry */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div className={container + ' relative z-[1]'}>
          <Link to="/" className="mb-3.5 inline-flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-[0.5px] text-[#cfcfcf] hover:text-brand">← Back</Link>
          <h1 className="text-[clamp(30px,6.4vw,84px)] text-white">Near <span className="inline-block bg-brand px-2.5 text-ink shadow-[5px_5px_0_#000]">you</span></h1>
          <p className="mt-[18px] max-w-[64ch] text-lg leading-normal text-[#d6d6d6]">
            {anchor
              ? <>Every game within {RANGE_MILES} miles of {anchor.label} over the next {WINDOW_DAYS} days, nearest first.</>
              : <>Games close to you over the next {WINDOW_DAYS} days. Share your location or pick your city.</>}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3.5">
            <button
              className="cursor-pointer rounded-lg border-2 border-black bg-brand px-[18px] py-[11px] text-[13px] font-extrabold uppercase tracking-[0.6px] text-ink shadow-[3px_3px_0_#000] hover:brightness-105 disabled:cursor-default disabled:opacity-60"
              disabled={locBusy}
              onClick={useMyLocation}
            >
              {locBusy ? 'Locating…' : '📍 Use my location'}
            </button>
            <div className="relative">
              <input
                className="w-60 rounded-lg border-2 border-black bg-white px-3.5 py-[11px] font-sans text-sm font-semibold text-ink shadow-[3px_3px_0_#000] focus:border-brand focus:outline-none"
                value={cityQ}
                onChange={(e) => setCityQ(e.target.value)}
                placeholder="or pick your city…"
                aria-label="Pick your city"
              />
              {citySuggestions.length ? (
                <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-lg border-2 border-black bg-white shadow-[4px_4px_0_#000]">
                  {citySuggestions.map((k) => (
                    <button key={k} className="block w-full cursor-pointer border-t border-[#eee] bg-white px-[13px] py-[9px] text-left font-sans text-[13.5px] font-bold text-ink first:border-t-0 hover:bg-[#fff7c9]" onClick={() => pickCity(k)}>{cityLabel(k)}</button>
                  ))}
                </div>
              ) : null}
            </div>
            {anchor ? <span className="text-[13px] font-bold uppercase tracking-[0.4px] text-[#cfcfcf]">Showing: <b className="text-brand">{anchor.label}</b></span> : null}
            {locErr ? <span className="w-full text-[13px] font-bold text-[#f2b8b3]">{locErr}</span> : null}
          </div>
        </div>
      </section>

      <section className="py-[38px] pb-[46px]">
        <div className={container}>
          {anchor ? (
            <div className="mb-1.5 flex flex-wrap gap-2.5">
              <button className={chip(filter === 'all')} onClick={() => setFilter('all')}>All sports</button>
              {RANKABLE_LEAGUES.map((l) => (
                <button key={l} className={chip(l === filter)} onClick={() => setFilter(l)}>{SPORTS[l].label}</button>
              ))}
            </div>
          ) : null}

          {!hydrated || (anchor && (games === null || coords === null)) ? (
            <div className="py-10 font-semibold text-muted">Finding games near you…</div>
          ) : null}

          {hydrated && !anchor ? (
            <div className={emptyCls}>Set your location above and the slate fills in. Nothing is stored beyond this device.</div>
          ) : null}

          {anchor && nearby !== null ? (
            days.length ? (
              days.map((day) => (
                <section key={day.date.toISOString()}>
                  <div className="mb-3.5 mt-[30px] flex items-baseline gap-3 border-b-[3px] border-ink pb-2">
                    <h2 className="text-2xl text-ink">{dayLabel(day.date)}</h2>
                    <span className="text-[13px] font-bold text-muted">{day.items.length} {day.items.length === 1 ? 'game' : 'games'}</span>
                  </div>
                  {day.items.map(({ g, miles }) => (
                    <div key={g.league + ':' + g.id} className="relative">
                      <span className="num pointer-events-none absolute -top-[9px] right-2.5 z-[3] rounded-full bg-ink-soft px-2.5 py-[3px] text-[11px] font-extrabold uppercase tracking-[0.6px] text-brand shadow-[2px_2px_0_rgba(0,0,0,0.35)]">{fmtMiles(miles)}</span>
                      <GameRow g={g} />
                    </div>
                  ))}
                </section>
              ))
            ) : (
              <div className={emptyCls}>
                {filter === 'all'
                  ? <>No games within {RANGE_MILES} miles in the next {WINDOW_DAYS} days. <Link to="/games">Browse the full schedule →</Link></>
                  : <>No {SPORTS[filter].label} games near you in this window. <Link to="/games">See the {SPORTS[filter].label} schedule →</Link></>}
              </div>
            )
          ) : null}
        </div>
      </section>

      <footer className="bg-black py-10 text-[13px] text-[#888]"><div className={container}>© 2026 Snapback Sports. <Link to="/" className="font-bold text-brand">← Explore</Link></div></footer>
    </div>
  )
}
