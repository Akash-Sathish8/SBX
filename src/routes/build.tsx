import { useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SearchIcon, FlagIcon, MapPinIcon, ShareIcon } from 'lucide-react'
import { SiteNav } from '../components/SiteNav'
import { ShareCard, type Plan } from '../components/ShareCard'
import { renderShareCardBlob } from '../lib/renderShareCard'
import { byDistance, isInside } from '../lib/dist'
import { teamName, teamFlag, teamCode } from '../lib/teams'
import { useMatchScores } from '../lib/useMatchScores'
import { venueQueryOptions } from '../lib/queries'
import { VENUE_COORDS } from '../lib/venues-meta'
import { firstSentence, splitSentences } from '../lib/text'
import { fetchMatchWeather } from '../lib/weather'
import { warmImage, intentWarm } from '../lib/dataCache'
// Build-time-static data — bundled so the chooser SSRs instantly instead of
// fetching index.json + fanintel.json on mount.
import { GAMES as GAMES_INDEX, FAN_INTEL } from '../data'

export const Route = createFileRoute('/build')({
  validateSearch: (s: Record<string, unknown>) => ({
    game: typeof s.game === 'string' ? s.game : '',
    mode: (s.mode === 'venue' ? 'venue' : 'matchup') as 'venue' | 'matchup',
  }),
  head: () => ({
    meta: [{ title: 'Snapback — Build Match Guide' }],
  }),
  component: BuildPage,
})

// A bullet in the venue-detail JSON is either { b, t } (bold lead + tail) or a
// bare { t }. Render it as one line — shared by every section that lists points.
const pointText = (p: any): string => (p ? (p.b ? p.b + (p.t ? ': ' + p.t : '') : p.t) : '')

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
  const index = GAMES_INDEX
  const fi = FAN_INTEL

  const setGame = (id: string) => navigate({ to: '/build', search: { game: id, mode } })
  const g = index.find((x) => x.id === game) ?? null

  return (
    <>
      <SiteNav active="guide" />
      <main id="app">
        {/* Intro hero only while choosing a match; once a match is picked the
            guide wizard takes over the full page. */}
        {!g && (
          <section className="ghero relative overflow-hidden bg-[#222] text-white pt-[clamp(30px,5vw,52px)] pb-[clamp(30px,5vw,46px)] px-0"><div className="container relative z-[2] text-center max-w-[1180px] mx-auto px-[28px]">
            <div className="ground inline-block font-extrabold text-[12px] tracking-[1.4px] uppercase text-ink bg-brand-yellow px-[13px] py-[6px] rounded-[5px] mb-[clamp(16px,3vw,24px)]">Snapback · World Cup 2026</div>
            <h1 className="bld-h1 font-display text-white text-[clamp(34px,5vw,56px)] tracking-[0.5px] leading-none mt-[4px] mr-0 mb-0 ml-0">Build your match guide</h1>
            <div className="gmeta mt-[clamp(16px,3vw,22px)] text-[#dcdcdc] font-semibold text-[15px] tracking-[0.3px]">Pick a match, choose your spots, share a plan.</div>
          </div></section>
        )}
        {g
          ? <Builder key={g.id} g={g} fi={fi} onBack={() => setGame('')} />
          : <Chooser index={index} onPick={setGame} initialMode={mode} />}
      </main>
    </>
  )
}

function Chooser({ index, onPick, initialMode }: { index: any[]; onPick: (id: string) => void; initialMode?: 'matchup' | 'venue' }) {
  const qc = useQueryClient()
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
    <section className="block bg-white pt-[22px] pb-[clamp(34px,5vw,52px)] px-0"><div className="container max-w-[1180px] mx-auto px-[28px]">
      <div className="eyebrow inline-flex items-center gap-[9px] font-extrabold text-[12.5px] tracking-[1.2px] uppercase text-black mb-[11px]">Step 1</div>
      <h2 className="shead font-display text-[clamp(28px,3.6vw,40px)] text-[#222] tracking-[0.5px] mb-[20px]">Choose your match</h2>
      <div className="bld-tabs flex gap-[10px] mb-[20px] items-center flex-wrap">
        <button className={'bld-tab font-display uppercase tracking-[0.5px] text-[14px] text-ink border-2 border-ink rounded-[8px] px-[18px] py-[10px] cursor-pointer' + (mode === 'matchup' ? ' on bg-brand-yellow' : ' bg-white')} onClick={() => setMode('matchup')}>By matchup</button>
        <button className={'bld-tab font-display uppercase tracking-[0.5px] text-[14px] text-ink border-2 border-ink rounded-[8px] px-[18px] py-[10px] cursor-pointer' + (mode === 'venue' ? ' on bg-brand-yellow' : ' bg-white')} onClick={() => { setMode('venue'); setVenue('') }}>By venue</button>
        {mode === 'matchup' ? (
          <div className="search bld-search flex items-center gap-[9px] bg-white border-2 border-ink rounded-[8px] shadow-[4px_4px_0_0_#111] px-[14px] py-[9px] m-0 ml-auto max-w-[420px] flex-[1_1_240px] max-[600px]:mt-[6px] max-[600px]:mr-0 max-[600px]:mb-0 max-[600px]:ml-0 max-[600px]:basis-full max-[600px]:max-w-none"><SearchIcon className="si w-[16px] h-[16px] flex-none opacity-70 text-ink" /><input className="border-0 outline-0 bg-transparent font-body text-[16px] font-semibold text-ink w-full placeholder:text-[#9a9a9a] placeholder:font-medium" type="search" placeholder="Search team, venue or city…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        ) : null}
      </div>

      {mode === 'matchup' ? (
        <>
          <div className="bld-list grid gap-[10px]">
            {matchupList.map((x) => (
              <button key={x.id} className="bld-mrow grid grid-cols-[64px_1fr_auto_auto] gap-[16px] items-center text-left bg-white border border-[#ececec] rounded-[12px] shadow-[0_8px_22px_rgba(0,0,0,0.05)] px-[16px] py-[13px] cursor-pointer transition-[transform,box-shadow,border-color] duration-[120ms] font-[inherit] max-[600px]:grid-cols-[56px_1fr] max-[600px]:gap-[10px]" onClick={() => onPick(x.id)}>
                <span className="bld-date font-display text-[16px] text-ink bg-[#f5f3ea] rounded-[7px] px-[6px] py-[8px] text-center">{x.date}</span>
                <span className="bld-teams font-extrabold text-[16px] text-ink">{teamFlag(x.home)} {teamName(x.home)} {scores[x.id] ? <span className="bld-score font-extrabold text-[16px] text-ink mx-[4px] whitespace-nowrap">{scores[x.id].hs}–{scores[x.id].as}</span> : <span className="bld-vs text-[#bbb] font-bold text-[12px] mx-[2px]">v</span>} {teamName(x.away)} {teamFlag(x.away)}</span>
                <span className="bld-meta text-[12px] text-[#888] font-semibold uppercase tracking-[0.3px]">{x.round} · {x.venueName}</span>
                <span className="bld-go text-[12px] font-extrabold uppercase tracking-[0.5px] text-ink whitespace-nowrap">Choose →</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          {!venue ? (
            <div className="bld-venues grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-[12px]">
              {venues.map((v: any) => (
                <button key={v.id} className="bld-venue text-left bg-white border border-[#ececec] rounded-[12px] shadow-[0_8px_22px_rgba(0,0,0,0.05)] p-0 overflow-hidden cursor-pointer transition-[transform,box-shadow,border-color] duration-[120ms] flex flex-col" onClick={() => setVenue(v.id)} {...intentWarm(() => { void qc.prefetchQuery(venueQueryOptions(v.id)); warmImage('/img/stadiums/' + v.id + '.jpg') })}>
                  <img className="bld-vthumb w-full h-[110px] object-cover block bg-[#e9e9e6]" src={'/img/stadiums/' + v.id + '.jpg'} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                  <span className="bld-vn font-display text-[19px] text-ink tracking-[0.3px] mt-[13px] mx-[16px] mb-0">{v.name}</span>
                  <span className="bld-vc text-[12px] text-[#888] font-semibold uppercase tracking-[0.4px] mt-[4px] mx-[16px] mb-[15px]">{v.city} · {v.n} matches</span>
                </button>
              ))}
            </div>
          ) : (
            <>
              <button className="bld-backlink inline-block bg-none border-0 text-ink font-extrabold text-[13px] uppercase tracking-[0.5px] cursor-pointer mb-[16px] p-0" onClick={() => setVenue('')}>← All venues</button>
              <div className="bld-list grid gap-[10px]">
                {venueList.map((x) => (
                  <button key={x.id} className="bld-mrow grid grid-cols-[64px_1fr_auto_auto] gap-[16px] items-center text-left bg-white border border-[#ececec] rounded-[12px] shadow-[0_8px_22px_rgba(0,0,0,0.05)] px-[16px] py-[13px] cursor-pointer transition-[transform,box-shadow,border-color] duration-[120ms] font-[inherit] max-[600px]:grid-cols-[56px_1fr] max-[600px]:gap-[10px]" onClick={() => onPick(x.id)}>
                    <span className="bld-date font-display text-[16px] text-ink bg-[#f5f3ea] rounded-[7px] px-[6px] py-[8px] text-center">{x.date}</span>
                    <span className="bld-teams font-extrabold text-[16px] text-ink">{teamFlag(x.home)} {teamName(x.home)} {scores[x.id] ? <span className="bld-score font-extrabold text-[16px] text-ink mx-[4px] whitespace-nowrap">{scores[x.id].hs}–{scores[x.id].as}</span> : <span className="bld-vs text-[#bbb] font-bold text-[12px] mx-[2px]">v</span>} {teamName(x.away)} {teamFlag(x.away)}</span>
                    <span className="bld-meta text-[12px] text-[#888] font-semibold uppercase tracking-[0.3px]">{x.round} · {x.ko}</span>
                    <span className="bld-go text-[12px] font-extrabold uppercase tracking-[0.5px] text-ink whitespace-nowrap">Choose →</span>
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
  // <Builder> is keyed by g.id in BuildPage, so switching matches remounts it —
  // every wizard useState below resets to its initial value for free, and these
  // two queries re-key to the new match (no manual reset effect needed).
  const venue = useQuery(venueQueryOptions(g.venue)).data ?? null
  const weather =
    useQuery({
      queryKey: ['build-weather', g.venue, g.dateISO],
      queryFn: () => fetchMatchWeather(VENUE_COORDS[g.venue], g.dateISO),
      staleTime: 60 * 60_000,
    }).data ?? null
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
    const bulletsOf = (item: any) => (item.points && item.points.length)
      ? item.points.map(pointText)
      : splitSentences(item.detail).slice(0, 3)
    const o: any[] = []
    ;(t.rail || []).forEach((r: any) => o.push({ name: r.name, tag: 'Train', bullets: bulletsOf(r), deal: r.deal }))
    ;(t.bus || []).forEach((b: any) => o.push({ name: b.name, tag: 'Bus', bullets: bulletsOf(b), deal: b.deal }))
    ;(t.shuttle || []).forEach((s: any) => o.push({ name: s.name, tag: 'Shuttle', bullets: bulletsOf(s), deal: s.deal }))
    if (t.rideshare) o.push({ name: 'Rideshare & taxi', tag: 'Rideshare', bullets: splitSentences(t.rideshare).slice(0, 2) })
    if (t.bike) o.push({ name: 'Bike & scooter', tag: 'Active', bullets: splitSentences(t.bike).slice(0, 2) })
    if (venue && venue.parking) {
      const lots: any[] = venue.parking.lots || []
      o.push({ name: 'Drive & park', tag: 'Driving', driving: true, bullets: splitSentences(venue.parking.summary).slice(0, 2), lots })
    }
    return o
  }, [venue])

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
    note: [selLot.price, pointText(selLot.points && selLot.points[0])].filter(Boolean).join(' · '),
    where: pointText(selLot.points && selLot.points[1]),
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
    if (key === 'park') return (o.points && o.points.length ? o.points.map(pointText) : [firstSentence(o.detail)]).filter(Boolean)
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
    <section className={'block bg-white pt-[22px] pb-[clamp(34px,5vw,52px)] px-0' + (cur.share ? '' : ' wz-screen max-[760px]:h-[calc(100dvh-72px)] max-[760px]:flex max-[760px]:flex-col max-[760px]:overflow-hidden max-[760px]:pt-[10px] max-[760px]:pb-[calc(48px+env(safe-area-inset-bottom))]')}><div className="container max-w-[1180px] mx-auto px-[28px]">
      <div className="wz-top flex items-center justify-between gap-x-[16px] gap-y-[10px] flex-wrap mb-[14px]">
        <button className="bld-backlink inline-block bg-none border-0 text-ink font-extrabold text-[13px] uppercase tracking-[0.5px] cursor-pointer mb-0 p-0" onClick={onBack}>← Choose another match</button>
        <div className="wz-prog flex items-center gap-[7px] m-0">
          {flow.map((s, i) => <span key={s.key} className={'wz-dot w-[9px] h-[9px] rounded-full transition-[background,transform] duration-150' + (i === stepIdx ? ' on bg-brand-yellow shadow-[0_0_0_2px_#111] scale-110' : '') + (i < stepIdx ? ' done bg-[#caa600]' : (i === stepIdx ? '' : ' bg-[#dcdcd6]'))} />)}
          <span className="wz-progtxt ml-[8px] text-[11.5px] font-extrabold uppercase tracking-[0.6px] text-[#999]">{stepIdx + 1} / {flow.length}</span>
        </div>
      </div>

      <div className="wz-context flex flex-col items-start gap-[11px] mb-[22px]">
        <span className="wz-cmatch font-display text-[14px] tracking-[0.4px] uppercase text-ink bg-brand-yellow px-[13px] py-[6px] rounded-[6px] shadow-[3px_3px_0_#111]">{teamName(g.home)} v {teamName(g.away)}</span>
        <div className="wz-cmeta-row flex flex-wrap items-center gap-[9px]">
          <span className="wz-cmeta text-[12.5px] font-bold tracking-[0.3px] text-[#666] uppercase inline-flex items-center">{g.venueName}</span>
          {weather && !cur.share ? <span className="wz-cmeta wz-cwx text-[12.5px] font-bold tracking-[0.3px] text-[#666] uppercase inline-flex items-center before:content-[''] before:w-[4px] before:h-[4px] before:rounded-full before:bg-[#cfcfcf] before:mr-[9px] before:flex-none">{weather.temp} · {weather.label}</span> : null}
          {attendingWalk && cur.key !== 'walk' ? <span className="wz-cmeta wz-cwalk text-[12.5px] font-bold tracking-[0.3px] normal-case text-[#9a7e00] inline-flex items-center before:content-[''] before:w-[4px] before:h-[4px] before:rounded-full before:bg-[#cfcfcf] before:mr-[9px] before:flex-none"><FlagIcon className="wz-cgl w-[13px] h-[13px] flex-none mr-[4px]" /> {fanwalk.name}</span> : null}
        </div>
      </div>

      <h2 className="shead font-display text-[clamp(28px,3.6vw,40px)] text-[#222] tracking-[0.5px] mb-[7px]">{cur.title}</h2>
      <div className="ssub text-[#6b6b6b] font-semibold text-[14px] uppercase tracking-[0.5px] mt-0 mx-0 mb-[22px]">{cur.sub}</div>

      <div className="sb-wrap mt-[6px]">
        {cur.share ? (
          <div className="wz-share flex flex-col items-center">
            <div className="sb-preview mt-[22px] flex gap-[26px] flex-wrap items-start max-[600px]:gap-[16px] max-[600px]:justify-center">
              <div className="sb-pvbox bg-[#e9e7e0] rounded-[14px] p-[16px] shadow-[inset_0_2px_8px_rgba(0,0,0,0.06)] max-[600px]:p-[10px]"><div className="sb-pvcap text-[11px] font-extrabold uppercase tracking-[0.6px] text-[#888] mb-[8px] text-center">Story · 9:16</div><div className="sb-scale-story w-[283px] h-[503px] overflow-hidden min-[601px]:w-[360px] min-[601px]:h-[640px] [&_.sc]:scale-[.262] [&_.sc]:origin-top-left min-[601px]:[&_.sc]:scale-[.33333]"><ShareCard plan={plan} format="story" /></div></div>
            </div>
            <div className="sb-actions flex flex-wrap gap-[12px] items-center [&_.sb-btn]:flex [&_.sb-btn]:items-center [&_.sb-btn]:justify-center [&_.sb-btn]:gap-[9px] [&_.sb-btn]:w-full">
              <button className="sb-btn font-display uppercase tracking-[0.6px] text-[15px] text-ink bg-brand-yellow border-0 rounded-[8px] px-[22px] py-[13px] cursor-pointer shadow-[0_8px_22px_rgba(0,0,0,0.1)] disabled:opacity-50 disabled:cursor-wait" disabled={!!busy} onClick={share}>
                {busy === 'share' ? 'Preparing…' : (
                  <>
                    Share Agenda
                    <ShareIcon size={15} aria-hidden="true" />
                  </>
                )}
              </button>
              <button className="sb-btn ghost font-display uppercase tracking-[0.6px] text-[15px] text-ink bg-white border-2 border-ink rounded-[8px] px-[22px] py-[13px] cursor-pointer shadow-none disabled:opacity-50 disabled:cursor-wait" onClick={() => setStep((s) => s - 1)}>← Back</button>
            </div>
          </div>
        ) : (
          <>
            <div className="wz-scroll flex gap-[14px] overflow-x-auto pt-[18px] px-[2px] pb-[20px] [scroll-snap-type:x_mandatory] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:h-[9px] [&::-webkit-scrollbar-thumb]:bg-[#d2d2cc] [&::-webkit-scrollbar-thumb]:rounded-[20px]" key={cur.key}>
              {cur.opts.length ? cur.opts.map((o: any, i: number) => {
                const on = cur.multi ? (cur.sel as number[]).includes(i) : cur.sel === i
                return (
                <button key={i} className={'wz-card flex-[0_0_290px] [scroll-snap-align:start] text-left border rounded-[14px] p-[18px] cursor-pointer flex flex-col gap-[11px] transition-[transform,box-shadow,border-color] duration-[120ms]' + (on ? ' on border-ink bg-[#fffdf3] shadow-[0_14px_30px_rgba(0,0,0,0.12)]' : ' border-[#ececec] bg-white shadow-[0_8px_22px_rgba(0,0,0,0.05)]')} onClick={() => pick(i)}>
                  <div className="wz-cardtop flex items-start gap-[10px]">
                    <span className="wz-cardname font-display text-[18px] text-ink tracking-[0.2px] leading-[1.15]">{o.name}</span>
                    {cur.key === 'get' && o.tag ? <span className="wz-cardtag ml-auto flex-none max-w-[50%] whitespace-nowrap overflow-hidden text-ellipsis text-[10.5px] font-extrabold uppercase tracking-[0.5px] text-[#7a6700] bg-[#fff3b0] border border-[#ecd96b] rounded-[20px] px-[9px] py-[3px]">{o.tag}</span> : null}
                  </div>
                  {cur.key === 'park' && o.price ? <div className="wz-cardprice text-[12.5px] font-bold text-[#7a6700] leading-[1.35] [overflow-wrap:anywhere]">{o.price}</div> : null}
                  {o.rating || o.dist ? (
                    <div className="wz-cardmeta flex flex-wrap items-center gap-x-[12px] gap-y-[5px] mt-[-3px] mx-0 mb-[1px]">
                      {o.rating ? <span className="wz-cardrating text-[12px] font-extrabold tracking-[0.2px] text-[#b8860b]">★ {o.rating}</span> : null}
                      {o.dist ? <span className="wz-carddist text-[12px] font-bold text-[#777] inline-flex items-center gap-[3px]"><MapPinIcon className="wz-distgl w-[12px] h-[12px] flex-none" /> {o.dist}</span> : null}
                    </div>
                  ) : null}
                  <ul className="wz-cardbul list-none m-0 p-0 grid gap-[7px] flex-1">
                    {cardLines(cur.key, o).map((l: string, j: number) => <li key={j} className="relative pl-[15px] text-[13px] text-[#444] leading-[1.42] [text-wrap:pretty] [overflow-wrap:anywhere] before:content-[''] before:absolute before:left-0 before:top-[7px] before:w-[5px] before:h-[5px] before:rounded-full before:bg-brand-yellow before:[box-shadow:0_0_0_1px_#caa600]">{l}</li>)}
                  </ul>
                  <span className={'wz-pick mt-[2px] text-[11.5px] font-extrabold uppercase tracking-[0.5px] ' + (on ? 'text-[#7a6700]' : 'text-ink')}>{on ? (cur.multi ? 'Added ✓ · tap to remove' : 'Selected ✓ · tap to continue') : (cur.multi ? 'Add +' : 'Choose →')}</span>
                </button>
                )
              }) : (cur.custom ? null : <div className="wz-empty py-[30px] px-[4px] text-[#999] font-semibold">{cur.empty}</div>)}
              {cur.custom ? (() => {
                const txt = customLine(cur.key)
                const on = cur.multi ? !!txt : cur.sel === -1 && !!txt
                return (
                  <div className={'wz-card wz-custom flex-[0_0_290px] [scroll-snap-align:start] text-left rounded-[14px] p-[18px] flex flex-col gap-[11px] transition-[transform,box-shadow,border-color] duration-[120ms] border cursor-default' + (on ? ' on border-solid border-ink bg-[#fffdf3] shadow-[0_14px_30px_rgba(0,0,0,0.12)]' : ' border-dashed border-[#cfcfc6] bg-white shadow-[0_8px_22px_rgba(0,0,0,0.05)]')}>
                    <div className="wz-cardtop flex items-start gap-[10px]"><span className="wz-cardname font-display text-[18px] text-ink tracking-[0.2px] leading-[1.15]">Add Custom Option</span></div>
                    <textarea
                      className="wz-custom-input w-full flex-1 min-h-[96px] resize-none border-2 border-[#ececec] rounded-[8px] bg-[#fafaf6] px-[12px] py-[10px] font-body text-[16px] font-semibold text-ink leading-[1.4] outline-none placeholder:text-[#9a9a9a] placeholder:font-medium"
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
                      <span className="wz-pick mt-[2px] text-[11.5px] font-extrabold uppercase tracking-[0.5px] text-ink">{on ? "Added ✓ · it's on your card" : 'Type to add +'}</span>
                    ) : (
                      <button className="wz-custom-use self-start font-[inherit] text-[11.5px] font-extrabold uppercase tracking-[0.5px] text-ink bg-brand-yellow border-0 rounded-[6px] px-[15px] py-[9px] cursor-pointer disabled:opacity-45 disabled:cursor-default" disabled={!txt} onClick={() => { cur.set(-1); setStep((s) => s + 1) }}>
                        {on ? 'Selected ✓ · continue →' : 'Use this →'}
                      </button>
                    )}
                  </div>
                )
              })() : null}
            </div>
            <div className="wz-nav fixed left-0 right-0 bottom-[calc(44px+env(safe-area-inset-bottom))] z-[44] flex justify-between items-end gap-[14px] max-w-[1180px] mx-auto my-0 pt-[14px] px-[28px] pb-[10px] bg-[linear-gradient(to_top,#f7f6f2_78%,rgba(247,246,242,0))] pointer-events-none">
              <button className="sb-btn ghost font-display uppercase tracking-[0.6px] text-[15px] text-ink bg-white border-2 border-ink rounded-[8px] px-[22px] py-[13px] cursor-pointer shadow-none pointer-events-auto disabled:opacity-50 disabled:cursor-wait" onClick={() => (stepIdx > 0 ? setStep((s) => s - 1) : onBack())}>← Back</button>
              <div className="wz-nav-stack flex flex-col gap-[8px] items-stretch flex-none pointer-events-auto">
                <button className="sb-btn ghost wz-skip font-display uppercase tracking-[0.6px] text-[15px] text-ink bg-white border-2 border-ink rounded-[8px] px-[22px] py-[13px] cursor-pointer shadow-none disabled:opacity-50 disabled:cursor-wait" onClick={() => setStep((s) => s + 1)}>Skip</button>
                <button className="sb-btn dark font-display uppercase tracking-[0.6px] text-[15px] text-white bg-ink border-0 rounded-[8px] px-[22px] py-[13px] cursor-pointer shadow-[0_8px_22px_rgba(0,0,0,0.1)] disabled:opacity-50 disabled:cursor-wait" onClick={() => setStep((s) => s + 1)} disabled={!cur.opts.length && !cur.custom}>Next →</button>
              </div>
            </div>
          </>
        )}
      </div>
      <div className="sb-stage fixed left-[-99999px] top-0 z-[-1] pointer-events-none" aria-hidden>
        <ShareCard ref={storyRef} plan={plan} format="story" />
      </div>
    </div></section>
    {!cur.share && teamCode(g.home) && teamCode(g.away) ? (
      <>
        <div className="matchbar-spacer h-[calc(180px+env(safe-area-inset-bottom))]" aria-hidden />
        <div className="matchbar fixed left-0 right-0 bottom-0 z-[45] flex items-stretch min-h-[44px] bg-ink border-t-[3px] border-solid border-brand-yellow pb-[env(safe-area-inset-bottom)]" aria-hidden>
          <div className="matchbar-side flex-1 flex items-center justify-center relative overflow-hidden bg-cover bg-center px-[16px] max-[600px]:px-[10px] before:content-[''] before:absolute before:inset-0 before:bg-[rgba(17,17,17,.72)]" style={{ backgroundImage: `url(https://flagcdn.com/${teamCode(g.home)}.svg)` }}>
            <span className="matchbar-team relative z-[1] font-display text-[clamp(13px,3.6vw,17px)] text-white uppercase tracking-[0.5px] whitespace-nowrap overflow-hidden text-ellipsis [text-shadow:0_1px_4px_rgba(0,0,0,0.55)]">{teamName(g.home)}</span>
          </div>
          <span className="matchbar-vs flex-none self-center relative z-[2] font-display text-[clamp(11px,3vw,13px)] text-brand-yellow tracking-[1px] px-[8px]">VS</span>
          <div className="matchbar-side matchbar-away flex-1 flex items-center justify-center relative overflow-hidden bg-cover bg-center px-[16px] max-[600px]:px-[10px] before:content-[''] before:absolute before:inset-0 before:bg-[rgba(17,17,17,.72)]" style={{ backgroundImage: `url(https://flagcdn.com/${teamCode(g.away)}.svg)` }}>
            <span className="matchbar-team relative z-[1] font-display text-[clamp(13px,3.6vw,17px)] text-white uppercase tracking-[0.5px] whitespace-nowrap overflow-hidden text-ellipsis [text-shadow:0_1px_4px_rgba(0,0,0,0.55)]">{teamName(g.away)}</span>
          </div>
        </div>
      </>
    ) : null}
    </>
  )
}
