import { useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { toPng } from 'html-to-image'
import { SiteNav } from '../components/SiteNav'
import { ShareCard, type Plan } from '../components/ShareCard'
import { teamName, teamFlag } from '../lib/teams'
import gameCss from '../pages/game.css?url'
import shareCss from '../pages/share.css?url'

export const Route = createFileRoute('/build')({
  validateSearch: (s: Record<string, unknown>) => ({
    game: typeof s.game === 'string' ? s.game : '',
    mode: s.mode === 'venue' ? 'venue' : 'matchup',
  }),
  head: () => ({
    links: [{ rel: 'stylesheet', href: gameCss }, { rel: 'stylesheet', href: shareCss }],
    meta: [{ title: 'Snapback — Build Match Guide' }],
  }),
  component: BuildPage,
})

const VENUE_COORDS: Record<string, [number, number]> = {
  metlife: [40.8135, -74.0745], sofi: [33.9535, -118.3392], azteca: [19.3029, -99.1505], att: [32.7473, -97.0945],
  arrowhead: [39.0489, -94.4839], nrg: [29.6847, -95.4107], mercedes: [33.7553, -84.4006], gillette: [42.0909, -71.2643],
  linc: [39.9008, -75.1675], lumen: [47.5952, -122.3316], hardrock: [25.958, -80.2389], levis: [37.403, -121.9697],
  bmo: [43.6332, -79.4185], bcplace: [49.2768, -123.1119], akron: [20.6819, -103.4628], bbva: [25.6694, -100.2444],
}
const WX: Record<number, string> = { 0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Fog', 51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 80: 'Showers', 81: 'Showers', 82: 'Showers', 95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm' }
async function fetchMatchWeather(venue: string, dateISO: string): Promise<{ temp: string; label: string } | null> {
  const c = VENUE_COORDS[venue]; if (!c || !dateISO) return null
  try {
    const cf = (c2: number) => Math.round(c2) + '°C / ' + Math.round(c2 * 9 / 5 + 32) + '°F'
    const fc = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c[0]}&longitude=${c[1]}&daily=weathercode,temperature_2m_max&temperature_unit=celsius&timezone=auto&start_date=${dateISO}&end_date=${dateISO}`).then((r) => r.json())
    if (fc?.daily?.time?.length && fc.daily.temperature_2m_max[0] != null) return { temp: cf(fc.daily.temperature_2m_max[0]), label: WX[fc.daily.weathercode[0]] || 'Mild' }
    const last = '2025' + dateISO.slice(4)
    const ar = await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${c[0]}&longitude=${c[1]}&daily=weathercode,temperature_2m_max&temperature_unit=celsius&timezone=auto&start_date=${last}&end_date=${last}`).then((r) => r.json())
    if (ar?.daily?.temperature_2m_max?.[0] != null) return { temp: cf(ar.daily.temperature_2m_max[0]), label: (WX[ar.daily.weathercode[0]] || 'Mild') + ' (typical)' }
  } catch { /* ignore */ }
  return null
}
function marchRelevant(m: any, g: any) {
  if (m.venue !== g.venue) return false
  const hay = ((m.title || '') + ' ' + (m.note || '') + ' ' + (m.when || '')).toLowerCase()
  const teams = [g.home, g.away, teamName(g.home), teamName(g.away)].filter(Boolean).map((s: string) => s.toLowerCase())
  if (teams.some((t: string) => t && hay.indexOf(t) > -1)) return true
  return /every match day|all matches|each match day|match day/.test(hay) && !/match:/.test(hay)
}
const firstSentence = (t?: string) => (t ? String(t).split(/(?<=[.!?])\s+/)[0].replace(/\.$/, '') : '')

function BuildPage() {
  const { game, mode } = Route.useSearch()
  const navigate = useNavigate()
  const [index, setIndex] = useState<any[] | null>(null)
  const [fi, setFi] = useState<any>(null)

  useEffect(() => {
    Promise.all([
      fetch('/data/games/index.json').then((r) => r.json()),
      fetch('/data/fanintel.json').then((r) => r.json()),
    ]).then(([idx, f]) => { setIndex(idx); setFi(f) }).catch(() => {})
  }, [])

  const setGame = (id: string) => navigate({ to: '/build', search: { game: id } })
  const g = index ? index.find((x) => x.id === game) : null

  return (
    <>
      <SiteNav active="games" />
      <main id="app">
        <section className="ghero"><div className="container">
          <div className="ground">Snapback · World Cup 2026</div>
          <h1 className="bld-h1">Build your match guide</h1>
          <div className="gmeta">Pick a match, choose your spots, download a shareable card.</div>
        </div></section>
        {!index ? <div className="loadwrap">Loading…</div>
          : g ? <Builder g={g} fi={fi} onBack={() => setGame('')} />
            : <Chooser index={index} onPick={setGame} initialMode={mode} />}
      </main>
      <footer><div className="container">© 2026 Snapback Sports — World Cup Games. <Link to="/games">← All games</Link></div></footer>
    </>
  )
}

function Chooser({ index, onPick, initialMode }: { index: any[]; onPick: (id: string) => void; initialMode?: 'matchup' | 'venue' }) {
  const [mode, setMode] = useState<'matchup' | 'venue'>(initialMode || 'matchup')
  const [q, setQ] = useState('')
  const [venue, setVenue] = useState('')
  const real = useMemo(() => index.filter((x) => !x.tbd), [index])
  const venues = useMemo(() => {
    const seen: Record<string, any> = {}
    real.forEach((x) => { if (!seen[x.venue]) seen[x.venue] = { id: x.venue, name: x.venueName, city: x.city, n: 0 }; seen[x.venue].n++ })
    return Object.values(seen).sort((a: any, b: any) => a.name.localeCompare(b.name))
  }, [real])
  const ql = q.trim().toLowerCase()
  const matchupList = real.filter((x) => !ql || (x.home + ' ' + x.away + ' ' + teamName(x.home) + ' ' + teamName(x.away) + ' ' + x.venueName + ' ' + x.city).toLowerCase().includes(ql))
  const venueList = venue ? real.filter((x) => x.venue === venue) : []

  return (
    <section className="block"><div className="container">
      <div className="eyebrow">Step 1</div>
      <h2 className="shead">Choose your match</h2>
      <div className="bld-tabs">
        <button className={'bld-tab' + (mode === 'matchup' ? ' on' : '')} onClick={() => setMode('matchup')}>By matchup</button>
        <button className={'bld-tab' + (mode === 'venue' ? ' on' : '')} onClick={() => { setMode('venue'); setVenue('') }}>By venue</button>
      </div>

      {mode === 'matchup' ? (
        <>
          <div className="search bld-search"><span className="si">🔍</span><input type="search" placeholder="Search team, venue or city…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="bld-list">
            {matchupList.map((x) => (
              <button key={x.id} className="bld-mrow" onClick={() => onPick(x.id)}>
                <span className="bld-date">{x.date}</span>
                <span className="bld-teams">{teamFlag(x.home)} {teamName(x.home)} <span className="bld-vs">v</span> {teamName(x.away)} {teamFlag(x.away)}</span>
                <span className="bld-meta">{x.round} · {x.venueName}</span>
                <span className="bld-go">Choose →</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          {!venue ? (
            <div className="bld-venues">
              {venues.map((v: any) => (
                <button key={v.id} className="bld-venue" onClick={() => setVenue(v.id)}>
                  <span className="bld-vn">{v.name}</span>
                  <span className="bld-vc">{v.city} · {v.n} matches</span>
                </button>
              ))}
            </div>
          ) : (
            <>
              <button className="bld-backlink" onClick={() => setVenue('')}>← All venues</button>
              <div className="bld-list">
                {venueList.map((x) => (
                  <button key={x.id} className="bld-mrow" onClick={() => onPick(x.id)}>
                    <span className="bld-date">{x.date}</span>
                    <span className="bld-teams">{teamFlag(x.home)} {teamName(x.home)} <span className="bld-vs">v</span> {teamName(x.away)} {teamFlag(x.away)}</span>
                    <span className="bld-meta">{x.round} · {x.ko}</span>
                    <span className="bld-go">Choose →</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div></section>
  )
}

function Builder({ g, fi, onBack }: { g: any; fi: any; onBack: () => void }) {
  const [venue, setVenue] = useState<any>(null)
  const [weather, setWeather] = useState<{ temp: string; label: string } | null>(null)
  const [preI, setPreI] = useState(0)
  const [eatI, setEatI] = useState(0)
  const [postI, setPostI] = useState(0)
  const [busy, setBusy] = useState('')
  const storyRef = useRef<HTMLDivElement>(null)
  const squareRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    setVenue(null); setWeather(null); setPreI(0); setEatI(0); setPostI(0)
    fetch('/data/venues/' + g.venue + '.json').then((r) => r.json()).then((v) => { if (alive) setVenue(v) }).catch(() => {})
    fetchMatchWeather(g.venue, g.dateISO).then((w) => { if (alive) setWeather(w) })
    return () => { alive = false }
  }, [g.venue, g.dateISO, g.id])

  const intel = fi?.venues ? fi.venues[g.venue] : null
  const marches = fi?.marches ? fi.marches.filter((m: any) => marchRelevant(m, g)) : []
  const around = (venue && venue.around) || {}
  const preOpts: any[] = (around.pre || []).filter((s: any) => !s.fifa)
  const eatOpts: any[] = around.food || []
  const postOpts: any[] = around.post || []
  const gtField = (intel?.fields || []).find((f: any) => f.label === 'Getting there')
  const gettingThere = gtField ? (gtField.points && gtField.points.length ? gtField.points[0] : firstSentence(gtField.text)) : null
  let parking: string | null = null
  if (venue?.parking) {
    if (venue.parking.lots && venue.parking.lots.length) parking = venue.parking.lots[0].name + (venue.parking.lots[0].price ? ' · ' + venue.parking.lots[0].price : '')
    else if (venue.parking.summary) parking = firstSentence(venue.parking.summary)
  }
  const fanwalk = marches.length ? { name: marches[0].title.replace(/—.*$/, '').trim(), note: firstSentence(marches[0].route) } : null

  const plan: Plan = {
    home: teamName(g.home), away: teamName(g.away), homeFlag: teamFlag(g.home), awayFlag: teamFlag(g.away),
    round: g.round, date: g.date, ko: g.ko || '', venueName: g.venueName, city: g.city, weather, gettingThere, parking,
    pre: preOpts[preI] ? { name: preOpts[preI].name, note: preOpts[preI].note } : null,
    fanwalk,
    eat: eatOpts[eatI] ? { name: eatOpts[eatI].name, note: eatOpts[eatI].note } : null,
    post: postOpts[postI] ? { name: postOpts[postI].name, note: postOpts[postI].note } : null,
  }

  async function download(fmt: 'story' | 'square') {
    const node = (fmt === 'story' ? storyRef : squareRef).current
    if (!node) return
    setBusy(fmt)
    try {
      await new Promise((r) => setTimeout(r, 60))
      const url = await toPng(node, { pixelRatio: 1, cacheBust: true, skipFonts: true, width: 1080, height: fmt === 'story' ? 1920 : 1080 })
      const a = document.createElement('a'); a.href = url; a.download = `snapback-${g.id}-${fmt}.png`; a.click()
    } catch { /* noop */ } finally { setBusy('') }
  }

  const Picker = ({ label, opts, val, set }: { label: string; opts: any[]; val: number; set: (n: number) => void }) => (
    <div className="sb-group">
      <div className="sb-glab">{label}</div>
      {opts.length ? opts.map((o, i) => (
        <label key={i} className="sb-opt"><input type="radio" checked={val === i} onChange={() => set(i)} /><span><b>{o.name}</b>{o.note ? ' — ' + o.note : ''}</span></label>
      )) : <div className="sb-opt" style={{ color: '#999' }}>None listed</div>}
    </div>
  )

  return (
    <section className="block"><div className="container">
      <button className="bld-backlink" onClick={onBack}>← Choose another match</button>
      <div className="eyebrow">Step 2 · {teamName(g.home)} v {teamName(g.away)}</div>
      <h2 className="shead">Make your decisions</h2>
      <div className="ssub">{g.date}{g.ko ? ' · ' + g.ko : ''} · {g.venueName}</div>
      <div className="sb-wrap">
        <div className="sb-auto">
          {weather ? <span className="sb-pill">Weather · {weather.temp} {weather.label}</span> : null}
          {gettingThere ? <span className="sb-pill">Getting there ✓</span> : null}
          {parking ? <span className="sb-pill">Parking ✓</span> : null}
          {fanwalk ? <span className="sb-pill">Fan walk ✓</span> : null}
        </div>
        <div className="sb-row">
          <Picker label="Before the match" opts={preOpts} val={preI} set={setPreI} />
          <Picker label="Eat inside" opts={eatOpts} val={eatI} set={setEatI} />
          <Picker label="After the whistle" opts={postOpts} val={postI} set={setPostI} />
        </div>
        <div className="sb-actions">
          <button className="sb-btn" disabled={!!busy} onClick={() => download('story')}>{busy === 'story' ? 'Rendering…' : 'Download story (9:16)'}</button>
          <button className="sb-btn dark" disabled={!!busy} onClick={() => download('square')}>{busy === 'square' ? 'Rendering…' : 'Download square (1:1)'}</button>
        </div>
        <div className="sb-preview">
          <div className="sb-pvbox"><div className="sb-pvcap">Story · 9:16</div><div className="sb-scale-story"><ShareCard plan={plan} format="story" /></div></div>
          <div className="sb-pvbox"><div className="sb-pvcap">Square · 1:1</div><div className="sb-scale-square"><ShareCard plan={plan} format="square" /></div></div>
        </div>
      </div>
      <div className="sb-stage" aria-hidden>
        <ShareCard ref={storyRef} plan={plan} format="story" />
        <ShareCard ref={squareRef} plan={plan} format="square" />
      </div>
    </div></section>
  )
}
