import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteNav } from '../components/SiteNav'
import { PageCssGuard } from '../components/PageCssGuard'
import { GameRow } from '../components/GameRow'
import { getJSON } from '../lib/dataCache'
import { SPORTS, RANKABLE_LEAGUES, type League } from '../lib/sports'
import { toStoredUtc, localDayKey } from '../lib/weekend'
import { cityKey, haversineMiles, fmtMiles, loadCityCoords, type LatLng } from '../lib/geo'
import type { Game } from '../lib/espn'
import css from '../pages/near.css?url'
import rowCss from '../pages/gamerow.css?url'

// "Near you" — upcoming games sorted by real distance from the fan (Jack's
// trending-near-me ask). Distance is CITY-level: venue cities map to centroid
// coordinates from the generated /data/city-coords.json; games in a city the
// geocoder couldn't resolve carry no distance and drop out. Location is always
// explicit — a "Use my location" button or a city picker, never an unprompted
// permission dialog — and the last anchor persists per device.

export const Route = createFileRoute('/near')({
  head: () => ({
    links: [
      { rel: 'stylesheet', href: css, 'data-page-css': 'near' },
      { rel: 'stylesheet', href: rowCss, 'data-page-css': 'games weekend team game venue near' },
    ],
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

  return (
    <>
      <PageCssGuard id="near" />
      <SiteNav />
      <section className="head">
        <div className="container">
          <Link to="/" className="ghback">← Back</Link>
          <h1>Near <span className="hl">you</span></h1>
          <p className="sub">
            {anchor
              ? <>Every game within {RANGE_MILES} miles of {anchor.label} over the next {WINDOW_DAYS} days, nearest first.</>
              : <>Games close to you over the next {WINDOW_DAYS} days. Share your location or pick your city.</>}
          </p>
          <div className="locrow">
            <button className="locbtn" disabled={locBusy} onClick={useMyLocation}>
              {locBusy ? 'Locating…' : '📍 Use my location'}
            </button>
            <div className="citypick">
              <input
                value={cityQ}
                onChange={(e) => setCityQ(e.target.value)}
                placeholder="or pick your city…"
                aria-label="Pick your city"
              />
              {citySuggestions.length ? (
                <div className="citysugg">
                  {citySuggestions.map((k) => (
                    <button key={k} onClick={() => pickCity(k)}>{cityLabel(k)}</button>
                  ))}
                </div>
              ) : null}
            </div>
            {anchor ? <span className="locnow">Showing: <b>{anchor.label}</b></span> : null}
            {locErr ? <span className="locerr">{locErr}</span> : null}
          </div>
        </div>
      </section>

      <section className="block">
        <div className="container">
          {anchor ? (
            <div className="filters">
              <button className={'chip' + (filter === 'all' ? ' on' : '')} onClick={() => setFilter('all')}>All sports</button>
              {RANKABLE_LEAGUES.map((l) => (
                <button key={l} className={'chip' + (l === filter ? ' on' : '')} onClick={() => setFilter(l)}>{SPORTS[l].label}</button>
              ))}
            </div>
          ) : null}

          {!hydrated || (anchor && (games === null || coords === null)) ? (
            <div className="loading">Finding games near you…</div>
          ) : null}

          {hydrated && !anchor ? (
            <div className="empty">Set your location above and the slate fills in. Nothing is stored beyond this device.</div>
          ) : null}

          {anchor && nearby !== null ? (
            days.length ? (
              days.map((day) => (
                <section key={day.date.toISOString()}>
                  <div className="dayhd">
                    <h2>{dayLabel(day.date)}</h2>
                    <span className="cnt">{day.items.length} {day.items.length === 1 ? 'game' : 'games'}</span>
                  </div>
                  {day.items.map(({ g, miles }) => (
                    <div key={g.league + ':' + g.id} className="near-item">
                      <span className="near-dist num">{fmtMiles(miles)}</span>
                      <GameRow g={g} />
                    </div>
                  ))}
                </section>
              ))
            ) : (
              <div className="empty">
                {filter === 'all'
                  ? <>No games within {RANGE_MILES} miles in the next {WINDOW_DAYS} days. <Link to="/games">Browse the full schedule →</Link></>
                  : <>No {SPORTS[filter].label} games near you in this window. <Link to="/games">See the {SPORTS[filter].label} schedule →</Link></>}
              </div>
            )
          ) : null}
        </div>
      </section>

      <footer><div className="container">© 2026 Snapback Sports. <Link to="/">← Explore</Link></div></footer>
    </>
  )
}
