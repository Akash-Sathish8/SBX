import { useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { SearchIcon, FlagIcon, MapPinIcon, ShareIcon } from 'lucide-react'
import { SiteNav } from '../components/SiteNav'
import { PageCssGuard } from '../components/PageCssGuard'
import { ShareCard, type Plan } from '../components/ShareCard'
import { renderShareCardBlob } from '../lib/renderShareCard'
import { byDistance, isInside } from '../lib/dist'
import { teamName, teamFlag, teamCode } from '../lib/teams'
import { useMatchScores } from '../lib/useMatchScores'
import { getJSON, warmVenue, intentWarm } from '../lib/dataCache'
import gameCss from '../pages/game.css?url'
import shareCss from '../pages/share.css?url'

export const Route = createFileRoute('/build')({
  validateSearch: (s: Record<string, unknown>) => ({
    game: typeof s.game === 'string' ? s.game : '',
    mode: (s.mode === 'venue' ? 'venue' : 'matchup') as 'venue' | 'matchup',
  }),
  head: () => ({
    links: [
      { rel: 'stylesheet', href: gameCss, 'data-page-css': 'game build' },
      // 'build agenda': TanStack dedupes head links by href, so the surviving
      // link must carry every route id that uses this stylesheet.
      { rel: 'stylesheet', href: shareCss, 'data-page-css': 'build agenda' },
    ],
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
  // Exclude entries that are NOT a supporter walk (e.g. security corridors,
  // "no walking" advisories) — these aren't a fan walk to opt into.
  if (/not a supporter march|no walking|no walk|bans pedestrian|pedestrian corridor/.test(hay)) return false
  // Must read like an actual supporter walk / march / gathering.
  if (!/fanwalk|fan walk|fan march|supporter march|banderazo|parade|tartan army/.test(hay)) return false
  // And it must be tied to one of THIS match's teams (date/team specific).
  const teams = [g.home, g.away, teamName(g.home), teamName(g.away)].filter(Boolean).map((s: string) => s.toLowerCase())
  return teams.some((t: string) => t && hay.indexOf(t) > -1)
}
const firstSentence = (t?: string) => (t ? String(t).split(/(?<=[.!?])\s+/)[0].replace(/\.$/, '') : '')

// A supporter march walks you to the gates, so it IS the "getting there" leg.
// Pull the meet point (start of the route) and the gather/depart times out of
// the march so the plan can show fans exactly where and when to show up.
function buildFanwalk(m: any): { name: string; note?: string; where?: string } {
  // Meet point + address now come from the structured `meet` field (researched
  // per fan walk); times are still parsed from `when`.
  const meet = m.meet || {}
  const gather = (String(m.when || '').match(/gather\s+([0-9:apm.\s]+?)(?:[,;·]|$)/i) || [])[1]?.trim()
  const depart = (String(m.when || '').match(/depart\s+([0-9:apm.\s]+?)(?:[,;·]|$)/i) || [])[1]?.trim()
  const times = [gather && `gather ${gather}`, depart && `depart ${depart}`].filter(Boolean).join(', ')
  const where = [meet.address, times].filter(Boolean).join(' · ') || (String(m.when || '') || undefined)
  return { name: String(m.title || '').replace(/—.*$/, '').trim(), note: meet.spot || undefined, where }
}

function BuildPage() {
  const { game, mode } = Route.useSearch()
  const navigate = useNavigate()
  const [index, setIndex] = useState<any[] | null>(null)
  const [fi, setFi] = useState<any>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    Promise.all([
      getJSON('/data/games/index.json'),
      getJSON('/data/fanintel.json'),
    ]).then(([idx, f]) => { setIndex(idx); setFi(f) }).catch(() => setFailed(true))
  }, [])

  const setGame = (id: string) => navigate({ to: '/build', search: { game: id, mode } })
  const g = index ? index.find((x) => x.id === game) : null

  return (
    <>
      <PageCssGuard id="build" />
      <SiteNav active="guide" />
      <main id="app">
        {/* Intro hero only while choosing a match; once a match is picked the
            guide wizard takes over the full page. */}
        {!g && (
          <section className="ghero"><div className="container">
            <div className="ground">Snapback · World Cup 2026</div>
            <h1 className="bld-h1">Build your match guide</h1>
            <div className="gmeta">Pick a match, choose your spots, share a plan.</div>
          </div></section>
        )}
        {failed ? <div className="loadwrap">Couldn't load match data. <Link to="/" style={{ color: '#222', textDecoration: 'underline' }}>← Home</Link></div>
          : !index ? <div className="loadwrap">Loading…</div>
            : g ? <Builder g={g} fi={fi} onBack={() => setGame('')} />
              : <Chooser index={index} onPick={setGame} initialMode={mode} />}
      </main>
    </>
  )
}

function Chooser({ index, onPick, initialMode }: { index: any[]; onPick: (id: string) => void; initialMode?: 'matchup' | 'venue' }) {
  const [mode, setMode] = useState<'matchup' | 'venue'>(initialMode || 'matchup')
  const [q, setQ] = useState('')
  const [venue, setVenue] = useState('')
  const real = useMemo(() => index.filter((x) => !x.tbd), [index])
  // Real final scores (ESPN, once/day). Played matches show the score and sort last.
  const scoreInputs = useMemo(() => real.map((x) => ({ key: x.id, dateISO: x.dateISO, home: x.home, away: x.away })), [real])
  const scores = useMatchScores(scoreInputs)
  const byPlayed = (a: any, b: any) => (scores[a.id] ? 1 : 0) - (scores[b.id] ? 1 : 0)
  const venues = useMemo(() => {
    const seen: Record<string, any> = {}
    real.forEach((x) => { if (!seen[x.venue]) seen[x.venue] = { id: x.venue, name: x.venueName, city: x.city, n: 0 }; seen[x.venue].n++ })
    return Object.values(seen).sort((a: any, b: any) => a.name.localeCompare(b.name))
  }, [real])
  const ql = q.trim().toLowerCase()
  const matchupList = real.filter((x) => !ql || (x.home + ' ' + x.away + ' ' + teamName(x.home) + ' ' + teamName(x.away) + ' ' + x.venueName + ' ' + x.city).toLowerCase().includes(ql)).sort(byPlayed)
  const venueList = venue ? real.filter((x) => x.venue === venue).sort(byPlayed) : []

  return (
    <section className="block"><div className="container">
      <div className="eyebrow">Step 1</div>
      <h2 className="shead">Choose your match</h2>
      <div className="bld-tabs">
        <button className={'bld-tab' + (mode === 'matchup' ? ' on' : '')} onClick={() => setMode('matchup')}>By matchup</button>
        <button className={'bld-tab' + (mode === 'venue' ? ' on' : '')} onClick={() => { setMode('venue'); setVenue('') }}>By venue</button>
        {mode === 'matchup' ? (
          <div className="search bld-search"><SearchIcon className="si" /><input type="search" placeholder="Search team, venue or city…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        ) : null}
      </div>

      {mode === 'matchup' ? (
        <>
          <div className="bld-list">
            {matchupList.map((x) => (
              <button key={x.id} className="bld-mrow" onClick={() => onPick(x.id)}>
                <span className="bld-date">{x.date}</span>
                <span className="bld-teams">{teamFlag(x.home)} {teamName(x.home)} {scores[x.id] ? <span className="bld-score">{scores[x.id].hs}–{scores[x.id].as}</span> : <span className="bld-vs">v</span>} {teamName(x.away)} {teamFlag(x.away)}</span>
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
                <button key={v.id} className="bld-venue" onClick={() => setVenue(v.id)} {...intentWarm(() => warmVenue(v.id))}>
                  <img className="bld-vthumb" src={'/img/stadiums/' + v.id + '.jpg'} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none' }} />
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
                    <span className="bld-teams">{teamFlag(x.home)} {teamName(x.home)} {scores[x.id] ? <span className="bld-score">{scores[x.id].hs}–{scores[x.id].as}</span> : <span className="bld-vs">v</span>} {teamName(x.away)} {teamFlag(x.away)}</span>
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
  const [getI, setGetI] = useState(0)
  const [parkI, setParkI] = useState(0)
  // pre / eat / merch / post are multi-select: arrays of chosen option indices.
  const [preSel, setPreSel] = useState<number[]>([])
  const [eatSel, setEatSel] = useState<number[]>([])
  const [postSel, setPostSel] = useState<number[]>([])
  const [merchSel, setMerchSel] = useState<number[]>([])
  const [walkI, setWalkI] = useState(0)
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState('')
  // Free-typed "Add Custom Option" text per step. Single-select steps mark the
  // custom tile as chosen with sel index -1; multi steps include it whenever
  // the text is non-empty. Custom lines render on the share card as {name}.
  const blankCustom = { get: '', park: '', pre: '', eat: '', merch: '', post: '' }
  const [custom, setCustom] = useState<Record<string, string>>(blankCustom)
  const customLine = (k: string) => (custom[k] || '').trim()
  const storyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    setVenue(null); setWeather(null); setStep(0); setWalkI(0); setGetI(0); setParkI(0); setPreSel([]); setEatSel([]); setPostSel([]); setMerchSel([]); setCustom(blankCustom)
    getJSON('/data/venues/' + g.venue + '.json').then((v) => { if (alive) setVenue(v) }).catch(() => {})
    fetchMatchWeather(g.venue, g.dateISO).then((w) => { if (alive) setWeather(w) })
    return () => { alive = false }
  }, [g.venue, g.dateISO, g.id])

  const marches = fi?.marches ? fi.marches.filter((m: any) => marchRelevant(m, g)) : []
  const around = (venue && venue.around) || {}
  // "Eat inside" is only the truly in-stadium food; nearby food spots become
  // before-the-match options (you grab them on the walk in). Sorted nearest-first.
  const rawFood: any[] = around.food || []
  const nearbyFood: any[] = rawFood.filter((f: any) => !isInside(f))
  const eatOpts: any[] = byDistance(rawFood.filter((f: any) => isInside(f)))
  const preOpts: any[] = byDistance([...(around.pre || []).filter((s: any) => !s.fifa), ...nearbyFood])
  const postOpts: any[] = byDistance(around.post || [])
  const merchOpts: any[] = byDistance(around.merch || [])
  const fanwalk = marches.length ? buildFanwalk(marches[0]) : null

  // Getting there: real, researched options pulled from the venue's transport + parking data.
  const getThereOpts: any[] = useMemo(() => {
    const t = (venue && venue.transport) || {}
    const sentences = (s: any) => String(s || '').split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean)
    const bulletsOf = (item: any) => (item.points && item.points.length)
      ? item.points.map((p: any) => (p.b ? p.b + (p.t ? ': ' + p.t : '') : p.t))
      : sentences(item.detail).slice(0, 3)
    const o: any[] = []
    ;(t.rail || []).forEach((r: any) => o.push({ name: r.name, tag: 'Train', bullets: bulletsOf(r), deal: r.deal }))
    ;(t.bus || []).forEach((b: any) => o.push({ name: b.name, tag: 'Bus', bullets: bulletsOf(b), deal: b.deal }))
    ;(t.shuttle || []).forEach((s: any) => o.push({ name: s.name, tag: 'Shuttle', bullets: bulletsOf(s), deal: s.deal }))
    if (t.rideshare) o.push({ name: 'Rideshare & taxi', tag: 'Rideshare', bullets: sentences(t.rideshare).slice(0, 2) })
    if (t.bike) o.push({ name: 'Bike & scooter', tag: 'Active', bullets: sentences(t.bike).slice(0, 2) })
    if (venue && venue.parking) {
      const lots: any[] = venue.parking.lots || []
      o.push({ name: 'Drive & park', tag: 'Driving', driving: true, bullets: sentences(venue.parking.summary).slice(0, 2), lots })
    }
    return o
  }, [venue])

  const point = (p: any) => p ? (p.b ? p.b + (p.t ? ': ' + p.t : '') : p.t) : ''
  const spot = (o: any) => o ? {
    name: o.name,
    note: o.note || (o.why && o.why[0]) || '',
    where: [o.where, o.why && o.why[1], o.rating ? `★ ${o.rating}` : null, o.dist].filter(Boolean).join(' · '),
  } : null

  const selGet = getThereOpts[getI] || null
  const gettingThere = selGet ? {
    name: selGet.name,
    note: [selGet.tag, selGet.bullets && selGet.bullets[0]].filter(Boolean).join(' · '),
    where: [selGet.bullets && selGet.bullets[1], selGet.deal ? 'Fare · ' + selGet.deal : null].filter(Boolean).join('  ·  '),
  } : (getI === -1 && customLine('get') ? { name: customLine('get') } : null)
  const parkLots: any[] = selGet && selGet.driving ? (selGet.lots || []) : []
  const selLot = parkLots[parkI] || null
  const parking = selLot ? {
    name: selLot.name,
    note: [selLot.price, point(selLot.points && selLot.points[0])].filter(Boolean).join(' · '),
    where: point(selLot.points && selLot.points[1]),
  } : (parkI === -1 && customLine('park') ? { name: customLine('park') } : null)

  // Special event (fan walk / supporter march). When one exists it becomes the
  // first question of the build: are you joining it?
  const walkOpts: any[] = fanwalk ? [
    { name: "Yes, I'm in", note: fanwalk.note || 'Meet the crowd and march in together.', attend: true },
    { name: 'No, head straight in', note: 'Skip the march and go right to the stadium.', attend: false },
  ] : []
  const attendingWalk = !!fanwalk && walkOpts[walkI]?.attend !== false

  const plan: Plan = {
    home: teamName(g.home), away: teamName(g.away), homeFlag: teamFlag(g.home), awayFlag: teamFlag(g.away),
    round: g.round, date: g.date, ko: g.ko || '', venueName: g.venueName, city: g.city, weather,
    // The fan walk delivers you to the gates, so when fans opt in we drop the
    // "getting there" + parking legs entirely (the walk replaces them).
    gettingThere: attendingWalk ? null : gettingThere,
    parking: attendingWalk ? null : parking,
    // Multi-select sections append the custom line whenever one is typed.
    pre: [...preSel.map((i) => spot(preOpts[i])), customLine('pre') ? { name: customLine('pre') } : null].filter(Boolean) as any,
    fanwalk: attendingWalk ? fanwalk : null,
    eat: [...eatSel.map((i) => spot(eatOpts[i])), customLine('eat') ? { name: customLine('eat') } : null].filter(Boolean) as any,
    merch: [...merchSel.map((i) => spot(merchOpts[i])), customLine('merch') ? { name: customLine('merch') } : null].filter(Boolean) as any,
    post: [...postSel.map((i) => spot(postOpts[i])), customLine('post') ? { name: customLine('post') } : null].filter(Boolean) as any,
  }

  async function renderBlob(): Promise<Blob | null> {
    const node = storyRef.current
    if (!node) return null
    return renderShareCardBlob(node)
  }

  // Share opens the OS share sheet with the rendered image (Save Image,
  // AirDrop, socials). Falls back to a download when the browser can't
  // share a file.
  async function share() {
    setBusy('share')
    try {
      const blob = await renderBlob(); if (!blob) return
      const file = new File([blob], `snapback-${g.id}.png`, { type: 'image/png' })
      const text = `My matchday plan for ${teamName(g.home)} v ${teamName(g.away)} at ${g.venueName}.`
      const nav: any = navigator
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: 'Snapback matchday plan', text })
      } else if (nav.share) {
        await nav.share({ title: 'Snapback matchday plan', text })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = file.name; a.click()
        URL.revokeObjectURL(url)
      }
    } catch { /* user dismissed the share sheet */ } finally { setBusy('') }
  }

  // ---- one-decision-at-a-time wizard ----
  const driving = !!(selGet && selGet.driving)
  // Toggle helper for the multi-select steps (add / remove an option index).
  const toggle = (setter: (fn: (prev: number[]) => number[]) => void) => (i: number) =>
    setter((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]))
  const flow: any[] = [
    ...(fanwalk ? [{ key: 'walk', title: 'Are you joining the fan walk?', sub: fanwalk.name, opts: walkOpts, sel: walkI, set: setWalkI, empty: '' }] : []),
    // Joining the walk means you arrive on foot — skip the transport + parking steps.
    ...(attendingWalk ? [] : [{ key: 'get', title: 'Choose how to get there', sub: 'Pick your way to the stadium', opts: getThereOpts, sel: getI, set: setGetI, custom: true, empty: 'No transport options listed for this venue yet.' }]),
    ...(driving && !attendingWalk ? [{ key: 'park', title: 'Choose where to park', sub: 'Pick a lot for the car', opts: parkLots, sel: parkI, set: setParkI, custom: true, empty: 'No fan parking listed for this venue.' }] : []),
    { key: 'pre', title: 'Before the match', sub: 'Pick any spots to hit before kickoff', opts: preOpts, sel: preSel, toggle: toggle(setPreSel), multi: true, custom: true, empty: 'Nothing listed near this ground yet.' },
    { key: 'eat', title: 'Eat inside', sub: 'Grab anything you like in the concourse', opts: eatOpts, sel: eatSel, toggle: toggle(setEatSel), multi: true, custom: true, empty: 'No in-stadium food listed yet.' },
    ...(merchOpts.length ? [{ key: 'merch', title: 'Grab some merch', sub: 'Official shops at the stadium', opts: merchOpts, sel: merchSel, toggle: toggle(setMerchSel), multi: true, custom: true, empty: '' }] : []),
    { key: 'post', title: 'After the whistle', sub: 'Pick where to head once it ends', opts: postOpts, sel: postSel, toggle: toggle(setPostSel), multi: true, custom: true, empty: 'Nothing listed for after the match yet.' },
    { key: 'share', title: 'Your matchday plan', sub: 'Save it and share', share: true },
  ]
  const stepIdx = Math.min(step, flow.length - 1)
  const cur = flow[stepIdx]

  const cardLines = (key: string, o: any): string[] => {
    if (key === 'park') return (o.points && o.points.length ? o.points.map((p: any) => (p.b ? p.b + (p.t ? ': ' + p.t : '') : p.t)) : [firstSentence(o.detail)]).filter(Boolean)
    if (key === 'get') { const l = [...(o.bullets || [])]; if (o.deal) l.push('Fare · ' + o.deal); if (o.driving) l.push('Next: choose your parking lot →'); return l }
    return o.note ? [o.note] : []
  }
  // Multi steps toggle (stay on the page); single steps select and advance.
  const pick = (i: number) => { if (cur.multi) { cur.toggle(i) } else { cur.set(i); setStep((s) => s + 1) } }

  return (
    <>
    {/* wz-screen (phones): lock the step to one viewport-high screen — no page
        scroll, cards swipe sideways, nav + flag footer stay put. The share step
        keeps natural page flow (its preview is taller than a screen). */}
    <section className={'block' + (cur.share ? '' : ' wz-screen')}><div className="container">
      <div className="wz-top">
        <button className="bld-backlink" onClick={onBack}>← Choose another match</button>
        <div className="wz-prog">
          {flow.map((s, i) => <span key={s.key} className={'wz-dot' + (i === stepIdx ? ' on' : '') + (i < stepIdx ? ' done' : '')} />)}
          <span className="wz-progtxt">{stepIdx + 1} / {flow.length}</span>
        </div>
      </div>

      <div className="wz-context">
        <span className="wz-cmatch">{teamName(g.home)} v {teamName(g.away)}</span>
        <div className="wz-cmeta-row">
          <span className="wz-cmeta">{g.venueName}</span>
          {weather && !cur.share ? <span className="wz-cmeta wz-cwx">{weather.temp} · {weather.label}</span> : null}
          {attendingWalk && cur.key !== 'walk' ? <span className="wz-cmeta wz-cwalk"><FlagIcon className="wz-cgl" /> {fanwalk.name}</span> : null}
        </div>
      </div>

      <h2 className="shead">{cur.title}</h2>
      <div className="ssub">{cur.sub}</div>

      <div className="sb-wrap">
        {cur.share ? (
          <div className="wz-share">
            <div className="sb-preview">
              <div className="sb-pvbox"><div className="sb-pvcap">Story · 9:16</div><div className="sb-scale-story"><ShareCard plan={plan} format="story" /></div></div>
            </div>
            <div className="sb-actions">
              <button className="sb-btn" disabled={!!busy} onClick={share}>
                {busy === 'share' ? 'Preparing…' : (
                  <>
                    Share Agenda
                    <ShareIcon size={15} aria-hidden="true" />
                  </>
                )}
              </button>
              <button className="sb-btn ghost" onClick={() => setStep((s) => s - 1)}>← Back</button>
            </div>
          </div>
        ) : (
          <>
            <div className="wz-scroll" key={cur.key}>
              {cur.opts.length ? cur.opts.map((o: any, i: number) => {
                const on = cur.multi ? (cur.sel as number[]).includes(i) : cur.sel === i
                return (
                <button key={i} className={'wz-card' + (on ? ' on' : '')} onClick={() => pick(i)}>
                  <div className="wz-cardtop">
                    <span className="wz-cardname">{o.name}</span>
                    {cur.key === 'get' && o.tag ? <span className="wz-cardtag">{o.tag}</span> : null}
                  </div>
                  {cur.key === 'park' && o.price ? <div className="wz-cardprice">{o.price}</div> : null}
                  {o.rating || o.dist ? (
                    <div className="wz-cardmeta">
                      {o.rating ? <span className="wz-cardrating">★ {o.rating}</span> : null}
                      {o.dist ? <span className="wz-carddist"><MapPinIcon className="wz-distgl" /> {o.dist}</span> : null}
                    </div>
                  ) : null}
                  <ul className="wz-cardbul">
                    {cardLines(cur.key, o).map((l: string, j: number) => <li key={j}>{l}</li>)}
                  </ul>
                  <span className="wz-pick">{on ? (cur.multi ? 'Added ✓ · tap to remove' : 'Selected ✓ · tap to continue') : (cur.multi ? 'Add +' : 'Choose →')}</span>
                </button>
                )
              }) : (cur.custom ? null : <div className="wz-empty">{cur.empty}</div>)}
              {cur.custom ? (() => {
                const txt = customLine(cur.key)
                const on = cur.multi ? !!txt : cur.sel === -1 && !!txt
                return (
                  <div className={'wz-card wz-custom' + (on ? ' on' : '')}>
                    <div className="wz-cardtop"><span className="wz-cardname">Add Custom Option</span></div>
                    <textarea
                      className="wz-custom-input"
                      rows={3}
                      placeholder="Type what you're doing…"
                      value={custom[cur.key] || ''}
                      onChange={(e) => {
                        const v = e.target.value
                        setCustom((p) => ({ ...p, [cur.key]: v }))
                        // Single-select steps: typing claims the selection (sel -1 = custom).
                        if (!cur.multi && v.trim()) cur.set(-1)
                      }}
                    />
                    {cur.multi ? (
                      <span className="wz-pick">{on ? "Added ✓ · it's on your card" : 'Type to add +'}</span>
                    ) : (
                      <button className="wz-custom-use" disabled={!txt} onClick={() => { cur.set(-1); setStep((s) => s + 1) }}>
                        {on ? 'Selected ✓ · continue →' : 'Use this →'}
                      </button>
                    )}
                  </div>
                )
              })() : null}
            </div>
            <div className="wz-nav">
              <button className="sb-btn ghost" onClick={() => (stepIdx > 0 ? setStep((s) => s - 1) : onBack())}>← Back</button>
              <div className="wz-nav-stack">
                <button className="sb-btn ghost wz-skip" onClick={() => setStep((s) => s + 1)}>Skip</button>
                <button className="sb-btn dark" onClick={() => setStep((s) => s + 1)} disabled={!cur.opts.length && !cur.custom}>Next →</button>
              </div>
            </div>
          </>
        )}
      </div>
      <div className="sb-stage" aria-hidden>
        <ShareCard ref={storyRef} plan={plan} format="story" />
      </div>
    </div></section>
    {!cur.share && teamCode(g.home) && teamCode(g.away) ? (
      <>
        <div className="matchbar-spacer" aria-hidden />
        <div className="matchbar" aria-hidden>
          <div className="matchbar-side" style={{ backgroundImage: `url(https://flagcdn.com/${teamCode(g.home)}.svg)` }}>
            <span className="matchbar-team">{teamName(g.home)}</span>
          </div>
          <span className="matchbar-vs">VS</span>
          <div className="matchbar-side matchbar-away" style={{ backgroundImage: `url(https://flagcdn.com/${teamCode(g.away)}.svg)` }}>
            <span className="matchbar-team">{teamName(g.away)}</span>
          </div>
        </div>
      </>
    ) : null}
    </>
  )
}
