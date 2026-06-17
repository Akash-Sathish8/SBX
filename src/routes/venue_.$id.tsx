import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  MapPinIcon, SunIcon, CloudSunIcon, CloudIcon, CloudFogIcon, CloudRainIcon, CloudSnowIcon, CloudLightningIcon,
  BusIcon, TruckIcon, SquareParkingIcon, TrainFrontIcon,
} from 'lucide-react'
import { SiteNav } from '../components/SiteNav'
import { displayFixture } from '../lib/teams'
import { byDistance, isInside } from '../lib/dist'
import { useMatchScores } from '../lib/useMatchScores'
import { venueQueryOptions, sanitizeId } from '../lib/queries'
import { venueMeta, VENUE_COORDS } from '../lib/venues-meta'
import { cap, splitSentences } from '../lib/text'
import type { Venue } from '../lib/data-types'
import { fetchVenueWeather } from '../lib/weather'
import { absUrl, socialMeta } from '../lib/site'
import { warmImage } from '../lib/dataCache'

export const Route = createFileRoute('/venue_/$id')({
  // Per-venue SEO metadata, rendered server-side from the bundled venue index.
  head: ({ params }) => {
    const m = venueMeta(params.id)
    const name = m?.name ?? 'World Cup Venue'
    const title = m
      ? `${name} — World Cup 2026 Guide | Snapback`
      : 'World Cup 2026 Venue | Snapback'
    const description = m
      ? `${name} in ${m.city}: how to get there, parking, matchday food & drink, live weather and insider tips for FIFA World Cup 2026.`
      : 'FIFA World Cup 2026 venue guide: getting there, parking, matchday tips.'
    const image = absUrl(`/img/stadiums/${params.id}.jpg`)
    return {
      links: [
        { rel: 'canonical', href: absUrl(`/venue/${params.id}`) },
      ],
      meta: socialMeta({ title, description, image, type: 'article' }),
    }
  },
  component: VenuePage,
})

const FL: Record<string, string> = { USA: '🇺🇸', CAN: '🇨🇦', MEX: '🇲🇽' }

function VenuePage() {
  const { id: rawId } = Route.useParams()
  const id = sanitizeId(rawId)
  // The stadium hero filename is the id for every venue, so kick off the photo
  // download immediately, in parallel with the JSON query.
  useEffect(() => { if (id) warmImage('/img/stadiums/' + id + '.jpg') }, [id])

  const { data: v, status } = useQuery(venueQueryOptions(id))
  useEffect(() => { if (v?.name) document.title = 'Snapback — ' + v.name }, [v?.name])

  return (
    <>
      <SiteNav active="venues" />
      <main id="app">{renderBody()}</main>
      <footer>
        <div className="container max-w-[1180px] mx-auto px-[28px]">© 2026 Snapback Sports — World Cup Venues. <Link to="/venues">← All venues</Link></div>
      </footer>
    </>
  )

  function renderBody() {
    if (!id) {
      return (
        <div className="loadwrap py-[80px] text-center text-[#6b6b6b] font-bold uppercase tracking-[1px]">No venue selected. <Link to="/venues" style={{ color: '#222', textDecoration: 'underline' }}>Back to venues →</Link></div>
      )
    }
    if (status === 'pending') return <div className="loadwrap py-[80px] text-center text-[#6b6b6b] font-bold uppercase tracking-[1px]">Loading venue…</div>
    if (status === 'error') {
      return (
        <div className="loadwrap py-[80px] text-center text-[#6b6b6b] font-bold uppercase tracking-[1px]">Couldn't load this venue. <Link to="/venues" style={{ color: '#222', textDecoration: 'underline' }}>Back to venues →</Link></div>
      )
    }
    return <VenueContent v={v} />
  }
}

const MON3: Record<string, number> = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 }
const MONABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WD3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function matchISO(d: string): string | null {
  if (!d) return null
  // handles "Jun 11", "Sun Jun 14", "June 14", etc. — find the month token, take the next number
  const toks = d.trim().split(/[\s,]+/)
  for (let i = 0; i < toks.length; i++) {
    const m = MON3[toks[i].slice(0, 3)]
    if (m) {
      const day = Number(toks[i + 1])
      if (day) return `2026-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }
  return null
}
function fmtCard(iso: string) {
  const d = new Date(iso + 'T00:00:00Z')
  return { wd: WD3[d.getUTCDay()], md: MONABBR[d.getUTCMonth()] + ' ' + d.getUTCDate() }
}
// Weather glyphs from the Lucide line-icon family (stroke-2), matching the rest of the site.
function WxIcon({ code }: { code: number }) {
  const p = { size: 34, 'aria-hidden': true as const }
  if (code === 0) return <SunIcon {...p} />
  if (code === 1 || code === 2) return <CloudSunIcon {...p} />
  if (code === 3) return <CloudIcon {...p} />
  if (code === 45 || code === 48) return <CloudFogIcon {...p} />
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return <CloudRainIcon {...p} />
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return <CloudSnowIcon {...p} />
  if (code >= 95) return <CloudLightningIcon {...p} />
  return <CloudIcon {...p} />
}

function WeatherSection({ v }: { v: Venue }) {
  const coords = VENUE_COORDS[v.id]
  // one card per match at this venue, in date order
  const matchInfo = useMemo(
    () =>
      (((v.matches || [])
        .map((m: any) => ({ iso: matchISO(m.date), fixture: m.fixture || '' }))
        .filter((m: any) => m.iso)) as { iso: string; fixture: string }[]).sort((a, b) =>
        a.iso < b.iso ? -1 : 1,
      ),
    [v],
  )
  const last = matchInfo.length ? matchInfo[matchInfo.length - 1].iso : ''
  // Weather via TanStack Query (was a useEffect + `alive` machine). fetchWeather
  // resolves to [] on failure (never throws), so the query never errors.
  const weatherQ = useQuery({
    queryKey: ['venue-weather', v.id],
    queryFn: () => fetchVenueWeather(coords![0], coords![1], last),
    enabled: Boolean(coords && last),
    staleTime: 30 * 60_000,
  })
  const days = weatherQ.data ?? null
  const err = weatherQ.isError

  // Real final scores (ESPN, once/day). A played match shows its score instead of a
  // (pointless) weather forecast and sorts to the bottom of the strip. Home/away come
  // from splitting the fixture string ("Mexico vs South Africa").
  const scoreInputs = useMemo(
    () =>
      matchInfo.map((m) => {
        const p = m.fixture.split(/\s+vs?\s+/i)
        return { key: m.iso + '|' + m.fixture, dateISO: m.iso, home: p[0]?.trim(), away: p[1]?.trim() }
      }),
    [matchInfo],
  )
  const scores = useMatchScores(scoreInputs)
  const sortedMatches = [...matchInfo].sort((a, b) =>
    (scores[a.iso + '|' + a.fixture] ? 1 : 0) - (scores[b.iso + '|' + b.fixture] ? 1 : 0))

  if (!coords || !matchInfo.length) {
    return v.weather ? (
      <section className="block py-[48px] bg-white"><div className="container max-w-[1180px] mx-auto px-[28px]">
        <div className="eyebrow inline-flex items-center gap-[9px] font-extrabold text-[12.5px] tracking-[1.2px] uppercase text-black mb-[11px]">Forecast</div><h2 className="shead font-display text-[clamp(28px,3.6vw,40px)] text-[#222] tracking-[0.5px] mb-[5px]">Live Weather Data</h2><div className="ssub text-[#6b6b6b] font-semibold text-[14px] uppercase tracking-[0.5px] mb-[26px]">Specific to {v.name}</div>
        <div className="elead text-[16px] leading-[1.55] text-[#33352f] max-w-[74ch] mb-[20px]">{v.weather}</div>
      </div></section>
    ) : null
  }

  const byDate: Record<string, any> = {}
  if (days) for (const d of days) byDate[d.date] = d

  return (
    <section className="block tint py-[48px] bg-[#f7f6f2]"><div className="container max-w-[1180px] mx-auto px-[28px]">
      <div className="eyebrow inline-flex items-center gap-[9px] font-extrabold text-[12.5px] tracking-[1.2px] uppercase text-black mb-[11px]">Forecast</div><h2 className="shead font-display text-[clamp(28px,3.6vw,40px)] text-[#222] tracking-[0.5px] mb-[5px]">Live Weather Data</h2><div className="ssub text-[#6b6b6b] font-semibold text-[14px] uppercase tracking-[0.5px] mb-[26px]">Specific to {v.name}</div>
      {err ? <div className="wx-msg text-[#6b6b6b] font-semibold text-[14.5px] py-[10px]">Couldn't load live weather right now.</div> : null}
      {!err && days === null ? <div className="wx-msg text-[#6b6b6b] font-semibold text-[14.5px] py-[10px]">Loading live weather…</div> : null}
      {!err && days ? (
        <div className="flex gap-[12px] overflow-x-auto pt-[14px] px-[2px] pb-[16px] [scroll-snap-type:x_proximity] [&::-webkit-scrollbar]:h-[10px] [&::-webkit-scrollbar-thumb]:bg-[#222] [&::-webkit-scrollbar-thumb]:rounded-[5px]">
          {sortedMatches.map((m) => {
            const c = fmtCard(m.iso)
            const w = byDate[m.iso]
            const score = scores[m.iso + '|' + m.fixture]
            return (
              <div key={m.iso + m.fixture} className={'wx-day flex-[0_0_164px] border rounded-[14px] shadow-[0_10px_26px_rgba(0,0,0,0.06)] pt-[15px] px-[12px] pb-[16px] text-center relative ' + (score ? 'border-brand-yellow bg-[#fffdf0]' : 'border-[#ececec] bg-white')}>
                <div className="wx-wd font-extrabold text-[11px] uppercase tracking-[0.5px] text-[#6b6b6b]">{c.wd}</div>
                <div className="wx-dt font-display text-[20px] text-[#222] tracking-[0.5px] mt-[1px]">{c.md}</div>
                <div className="wx-match font-extrabold text-[12px] text-[#222] leading-[1.25] mx-[2px] mt-[8px] mb-[5px] min-h-[30px] flex items-center justify-center text-center">{m.fixture ? displayFixture(m.fixture) : 'TBD'}</div>
                {score ? (
                  <>
                    <div className="wx-score font-display text-[28px] text-[#222] leading-none mt-[8px] tracking-[1px]">{score.hs}–{score.as}</div>
                    <div className="wx-ft text-[10px] font-extrabold uppercase tracking-[0.5px] text-ink bg-brand-yellow rounded-[5px] px-[8px] py-[2px] inline-block mt-[7px]">Full time</div>
                  </>
                ) : w ? (
                  <>
                    <div className="wx-ic mt-[9px] mb-[7px] h-[34px] flex items-center justify-center"><WxIcon code={w.code} /></div>
                    <div className="wx-temp font-extrabold text-[15px] text-[#222] mt-[2px]">{w.tmax}°<span className="lo text-[#6b6b6b] font-bold"> / {w.tmin}°</span> <span className="wxu text-[10px] font-extrabold text-[#9a9a9a]">F</span></div>
                    <div className="wx-tempc font-bold text-[12.5px] text-[#6b6b6b]">{Math.round((w.tmax - 32) * 5 / 9)}°<span className="lo text-[#aaa]"> / {Math.round((w.tmin - 32) * 5 / 9)}°</span> <span className="wxu text-[10px] font-extrabold text-[#9a9a9a]">C</span></div>
                    {w.pop !== null && w.pop !== undefined ? <div className="wx-rain text-[11px] text-[#6b6b6b] font-bold uppercase tracking-[0.3px] mt-[4px]">{w.pop}% rain</div> : (w.src === 'normal' ? <div className="wx-typical text-[9px] font-bold uppercase tracking-[0.4px] text-[#a07c00] mt-[4px]">typical (last yr)</div> : null)}
                  </>
                ) : <div className="wx-rain text-[11px] text-[#6b6b6b] font-bold uppercase tracking-[0.3px] mt-[4px]">forecast soon</div>}
              </div>
            )
          })}
        </div>
      ) : null}
    </div></section>
  )
}

// transit mode line-icons from the Lucide family (stroke-2)
function ModeIcon({ m }: { m: string }) {
  const p = { size: 24, 'aria-hidden': true as const }
  if (m === 'bus') return <BusIcon {...p} />
  if (m === 'shuttle') return <TruckIcon {...p} />
  if (m === 'park') return <SquareParkingIcon {...p} />
  return <TrainFrontIcon {...p} />
}

function Blurb({ text, className }: { text: any; className?: string }) {
  if (typeof text !== 'string') return <div className={className}>{text}</div>
  const parts = splitSentences(text)
  if (parts.length <= 1) return <div className={className}>{text}</div>
  return <ul className={'blurb-bullets list-none m-0 p-0 diamond-bullets [--db-size:6px]' + (className ? ' ' + className : '')}>{parts.map((p, i) => <li key={i} className="relative pl-[17px] leading-[1.5] mt-[6px]">{cap(p)}</li>)}</ul>
}
function AccRow({ m, title, sub, detail, points, deal }: { m: string; title: string; sub?: string; detail?: string; points?: { b: string; t: string }[]; deal?: string }) {
  return (
    <div className="erow flex gap-[16px] items-center px-[22px] py-[18px] border-b border-[#f1f1f1] max-[600px]:flex-wrap">
      <span className="echip w-[46px] h-[46px] flex-none rounded-full bg-[#f4f4f1] flex items-center justify-center"><ModeIcon m={m} /></span>
      <div className="emid flex-1 min-w-0 max-[600px]:basis-[calc(100%-62px)]">
        <div className="etitle font-extrabold text-[16px] text-ink tracking-[0.2px]">{title}</div>
        {sub ? <div className="estn text-[11px] font-bold uppercase tracking-[0.5px] text-[#9a9a9a] mt-[3px]">{sub}</div> : null}
        {points && points.length ? (
          <ul className="epoints list-none flex flex-col gap-[6px] mt-[9px] diamond-bullets">{points.map((p, i) => <li key={i} className="relative pl-[17px] text-[13.5px] leading-[1.45] text-[#555]"><b>{cap(p.b)}</b> {p.t}</li>)}</ul>
        ) : detail ? <Blurb className="edet text-[13.5px] text-[#555] leading-[1.5] mt-[6px] max-w-[64ch]" text={detail} /> : null}
      </div>
      {deal ? <span className="epill flex-none bg-[#fff8cf] text-[#7a6700] border border-[#ecd96b] font-extrabold text-[11.5px] px-[13px] py-[7px] rounded-[20px] max-w-[160px] text-center leading-[1.3] max-[600px]:order-3 max-[600px]:basis-full max-[600px]:max-w-none max-[600px]:self-start">{deal}</span> : null}
    </div>
  )
}
function ENote({ label, children }: { label: string; children: any }) {
  return (
    <details className="group border border-[#e6e6e6] rounded-[12px] bg-white overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
      <summary className="flex items-center gap-[11px] cursor-pointer list-none px-[18px] py-[13px] [&::-webkit-details-marker]:hidden"><span className="font-extrabold text-[11px] uppercase tracking-[0.5px] text-ink bg-brand-yellow px-[12px] py-[5px] rounded-[20px]">{label}</span><span className="w-[11px] h-[11px] border-r-[3px] border-b-[3px] border-[#111] flex-none ml-auto -rotate-45 transition duration-200 group-open:rotate-45"></span></summary>
      <div className="ndbody border-t border-[#efefef] px-[18px] py-[13px] text-[13.5px] leading-[1.55] text-[#555]">{typeof children === 'string' ? <Blurb text={children} /> : children}</div>
    </details>
  )
}
function TipsDropdown({ tips }: { tips?: string[] }) {
  if (!tips || !tips.length) return null
  return (
    <details className="group border border-[#e6e6e6] rounded-[12px] bg-white overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.06)] mt-[16px]">
      <summary className="flex items-center gap-[11px] cursor-pointer list-none px-[18px] py-[14px] [&::-webkit-details-marker]:hidden"><span className="font-display text-[12px] tracking-[0.6px] text-ink bg-brand-yellow rounded-[6px] px-[11px] py-[4px]">Tips</span><span className="w-[11px] h-[11px] border-r-[3px] border-b-[3px] border-[#111] flex-none ml-auto -rotate-45 transition duration-200 group-open:rotate-45"></span></summary>
      <div className="tbody border-t border-[#efefef]">
        {tips.map((t, i) => <div key={i} className="tline flex gap-[11px] items-start px-[18px] py-[13px] border-b border-[#f4f4f4]"><span className="dot flex-none w-[9px] h-[9px] bg-brand-yellow border-2 border-ink rotate-45 mt-[5px]"></span><span className="ttx text-[13.5px] leading-[1.5] text-[#444]">{t}</span></div>)}
      </div>
    </details>
  )
}
function AgendaCol({ title, items, hscroll }: { title: string; items?: any[]; hscroll?: boolean }) {
  if (!items || !items.length) return null
  const sorted = byDistance(items)
  return (
    <div className={'agcol' + (hscroll ? ' agcol-hscroll mt-[30px]' : '')}>
      <div className="agtitle font-display text-[18px] text-[#222] tracking-[0.4px] uppercase pb-[9px] border-b-[3px] border-brand-yellow mb-[15px]">{title}</div>
      <div className={'aglist flex flex-col gap-[12px]' + (hscroll ? ' flex-row overflow-x-auto gap-[16px] pt-[2px] px-[2px] pb-[14px] [scroll-snap-type:x_proximity] [scrollbar-width:thin] [scrollbar-color:#cfccc2_transparent] [&::-webkit-scrollbar]:h-[8px] [&::-webkit-scrollbar-thumb]:bg-[#cfccc2] [&::-webkit-scrollbar-thumb]:rounded-[99px] [&::-webkit-scrollbar-track]:bg-transparent [&_.agspot]:flex-[0_0_clamp(232px,74vw,268px)] [&_.agspot]:snap-start' : '')}>
        {sorted.map((s: any, i: number) => (
          <div key={i} className={'agspot relative bg-white border rounded-[12px] px-[16px] py-[14px] ' + (s.fifa ? 'border-[#111] shadow-[0_8px_22px_rgba(0,0,0,0.1)]' : 'border-[#ececec] shadow-[0_8px_22px_rgba(0,0,0,0.06)]')}>
            {s.fifa ? <span className="agtag inline-block font-display text-[10px] tracking-[0.7px] uppercase text-ink bg-brand-yellow rounded-[5px] px-[7px] py-[2px] mb-[6px]">Official FIFA</span> : null}
            <div className="agname font-extrabold text-[15px] text-ink tracking-[0.2px]">{s.name}</div>
            {s.rating || s.dist ? (
              <div className="agmeta flex flex-wrap items-center gap-x-[11px] gap-y-[4px] mt-[5px]">
                {s.rating ? <span className="agrating text-[12px] font-extrabold tracking-[0.2px] text-[#b8860b]">★ {s.rating}</span> : null}
                {s.dist ? <span className="agdist text-[12px] font-bold text-[#888] inline-flex items-center gap-[3px]"><MapPinIcon className="agdist-gl w-[12px] h-[12px] flex-none" /> {s.dist}</span> : null}
              </div>
            ) : null}
            {s.where ? <div className="agwhere text-[11px] font-bold uppercase tracking-[0.5px] text-[#9a9a9a] mt-[3px]">{s.where}</div> : null}
            {s.why && s.why.length ? (
              <ul className="agwhy list-none mt-[8px] mb-0 p-0 diamond-bullets">{s.why.map((w: string, j: number) => <li key={j} className="relative pl-[15px] text-[13px] leading-[1.45] text-[#555] mt-[5px]">{cap(w)}</li>)}</ul>
            ) : s.note ? <div className="agnote text-[13px] text-[#555] leading-[1.5] mt-[6px]">{s.note}</div> : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function VenueContent({ v }: { v: Venue }) {
  const heroUrl = String(v.hero || '').startsWith('/') ? v.hero : '/' + v.hero
  return (
    <>
      <section className="hero relative bg-[#222] text-white overflow-hidden min-h-[420px] flex items-end">
        <div className="bg absolute inset-0 bg-cover bg-center z-0 after:content-[''] after:absolute after:inset-0 after:[background:linear-gradient(180deg,rgba(20,20,20,.35)_0%,rgba(20,20,20,.72)_55%,rgba(20,20,20,.95)_95%)]" style={{ backgroundImage: `url('${heroUrl}')` }}></div>
        <Link className="back absolute top-0 left-0 z-[5] inline-flex items-center gap-[7px] text-white font-bold text-[13px] uppercase tracking-[0.6px] px-[18px] py-[14px] [text-shadow:0_1px_4px_rgba(0,0,0,0.7)] hover:text-brand-yellow" to="/venues">← All venues</Link>
        <div className="container max-w-[1180px] mx-auto px-[28px] relative z-[2] w-full pt-[34px] pb-[30px]">
          <div className="heyebrow inline-flex flex-wrap items-center gap-[10px] mb-[14px]">
            {v.role ? <span className="pillrole bg-brand-yellow text-ink font-extrabold text-[12px] tracking-[0.6px] uppercase px-[11px] py-[5px] rounded-[3px] shadow-[3px_3px_0_#000]">{v.role}</span> : null}
            <span className="pillcity bg-[rgba(255,255,255,0.12)] text-white font-bold text-[12px] tracking-[0.6px] uppercase px-[11px] py-[5px] rounded-[3px] inline-flex gap-[7px] items-center">{(FL[v.cc] || '')} {v.city}, {v.country}</span>
          </div>
          <h1 className="text-white text-[clamp(40px,7vw,86px)] max-w-[16ch] leading-[0.95]">{v.name}</h1>
          {(v.fifaName || v.nickname) ? (
            <div className="text-[#bdbdbd] font-semibold text-[15px] mt-[10px] tracking-[0.3px]">
              {v.fifaName ? <>FIFA name: <b className="text-white">{v.fifaName}</b></> : null}
              {v.fifaName && v.nickname ? <>{'  ·  '}</> : null}
              {v.nickname ? <>Known as <b className="text-white">{v.nickname}</b></> : null}
            </div>
          ) : null}
        </div>
      </section>

      {/* GETTING THERE + PARKING (combined matchday access) */}
      {(v.transport || v.parking) ? (
        <section className="block py-[48px] bg-white"><div className="container max-w-[1180px] mx-auto px-[28px]">
          <div className="eyebrow inline-flex items-center gap-[9px] font-extrabold text-[12.5px] tracking-[1.2px] uppercase text-black mb-[11px]">Matchday access</div>
          <h2 className="shead font-display text-[clamp(28px,3.6vw,40px)] text-[#222] tracking-[0.5px] mb-[5px]">Getting there</h2><div className="ssub text-[#6b6b6b] font-semibold text-[14px] uppercase tracking-[0.5px] mb-[26px]">Transit, parking &amp; rideshare</div>
          {v.transport &&((v.transport.rail && v.transport.rail.length) || (v.transport.bus && v.transport.bus.length) || (v.transport.shuttle && v.transport.shuttle.length)) ? (
            <div className="epanel bg-white border border-[#ececec] rounded-[16px] shadow-[0_14px_40px_rgba(0,0,0,0.08)] overflow-hidden">
              {(v.transport.rail || []).map((r: any, i: number) => <AccRow key={'r' + i} m="rail" title={r.name} sub={r.station} detail={r.detail} points={r.points} deal={r.deal} />)}
              {(v.transport.bus || []).map((b: any, i: number) => <AccRow key={'b' + i} m="bus" title={b.name} sub={b.from ? 'From ' + b.from : undefined} detail={b.detail} points={b.points} deal={b.deal} />)}
              {(v.transport.shuttle || []).map((s: any, i: number) => <AccRow key={'s' + i} m="shuttle" title={s.name} detail={s.detail} points={s.points} />)}
            </div>
          ) : (v.gettingThere || (v.transit && v.transit.length)) ? (
            <>
              {v.gettingThere ? <div className="elead text-[16px] leading-[1.55] text-[#33352f] max-w-[74ch] mb-[20px]">{v.gettingThere}</div> : null}
              {v.transit && v.transit.length ? <ul className="ul list-none flex flex-col gap-[11px] diamond-bullets [--db-size:9px] [--db-top:8px] [--db-border:2px_solid_#222222]">{v.transit.map((t: string, i: number) => <li key={i} className="relative pl-[22px] text-[14.5px] leading-[1.5] text-[#33352f]">{t}</li>)}</ul> : null}
            </>
          ) : null}

          {v.parking && v.parking.lots && v.parking.lots.length ? (
            <>
              <h3 className="font-display text-[22px] text-[#222] tracking-[0.5px] mt-[30px] mb-[14px] flex items-center gap-[10px] before:content-[''] before:w-[18px] before:h-[3px] before:bg-brand-yellow">Parking</h3>
              <div className="epanel bg-white border border-[#ececec] rounded-[16px] shadow-[0_14px_40px_rgba(0,0,0,0.08)] overflow-hidden">
                {v.parking.lots.map((l: any, i: number) => <AccRow key={'p' + i} m="park" title={l.name} detail={l.detail} points={l.points} deal={l.price} />)}
              </div>
            </>
          ) : null}

          <div className="enotes flex flex-col gap-[12px] mt-[18px]">
            {v.transport && v.transport.fromAirport ? <ENote label="Airport">{v.transport.fromAirport}</ENote> : null}
            {v.transport && v.transport.rideshare ? <ENote label="Rideshare">{v.transport.rideshare}</ENote> : null}
            {v.transport && v.transport.bike ? <ENote label="Bike / walk">{v.transport.bike}</ENote> : null}
            {v.parking && v.parking.prepaid ? <ENote label="Prepaid">{v.parking.prepaid}</ENote> : null}
            {v.parking && v.parking.accessible ? <ENote label="Accessible">{v.parking.accessible}</ENote> : null}
            {v.parking && v.parking.tailgating ? <ENote label="Tailgating">{v.parking.tailgating}</ENote> : null}
          </div>

          <TipsDropdown tips={[...((v.transport && v.transport.tips) || []), ...((v.parking && v.parking.tips) || [])]} />
        </div></section>
      ) : null}

      {/* AROUND THE GROUND — matchday agenda */}
      {(v.around || (v.food && v.food.length)) ? (
        <section className="block tint py-[48px] bg-[#f7f6f2]"><div className="container max-w-[1180px] mx-auto px-[28px]">
          <div className="eyebrow inline-flex items-center gap-[9px] font-extrabold text-[12.5px] tracking-[1.2px] uppercase text-black mb-[11px]">Your matchday</div>
          <h2 className="shead font-display text-[clamp(28px,3.6vw,40px)] text-[#222] tracking-[0.5px] mb-[5px]">Around the ground</h2><div className="ssub text-[#6b6b6b] font-semibold text-[14px] uppercase tracking-[0.5px] mb-[26px]">Pre-game · eat inside · post-game</div>
          {v.around ? (
            <>
              <div className="agenda grid grid-cols-3 gap-[22px] max-[860px]:grid-cols-1">
                <AgendaCol title="Before the match" items={[...(v.around.pre || []), ...((v.around.food || []).filter((f: any) => !isInside(f)))]} />
                <AgendaCol title="Inside the stadium" items={(v.around.food || []).filter((f: any) => isInside(f))} />
                <AgendaCol title="Merch & shops" items={v.around.merch} />
              </div>
              <AgendaCol title="After the whistle" items={v.around.post} hscroll />
            </>
          ) : (
            v.food && v.food.length ? <ul className="ul list-none flex flex-col gap-[11px] diamond-bullets [--db-size:9px] [--db-top:8px] [--db-border:2px_solid_#222222]">{v.food.map((f: string, i: number) => <li key={i} className="relative pl-[24px] text-[15px] leading-[1.55] text-[#33352f]">{f}</li>)}</ul> : null
          )}
        </div></section>
      ) : null}

      {v.tips && v.tips.length ? (
        <section className="block py-[48px] bg-white"><div className="container max-w-[1180px] mx-auto px-[28px]">
          <div className="eyebrow inline-flex items-center gap-[9px] font-extrabold text-[12.5px] tracking-[1.2px] uppercase text-black mb-[11px]">Before you go</div>
          <h2 className="shead font-display text-[clamp(28px,3.6vw,40px)] text-[#222] tracking-[0.5px] mb-[5px]">Insider tips</h2>
          <div className="tips grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-[14px]">
            {v.tips.map((t: string, i: number) => (
              <div key={i} className="tip bg-white border border-[#ececec] rounded-[12px] shadow-[0_10px_26px_rgba(0,0,0,0.06)] px-[18px] py-[16px] text-[14.5px] leading-[1.5] text-[#444] flex gap-[12px]"><span className="n font-display text-ink bg-brand-yellow w-[26px] h-[26px] rounded-[7px] flex items-center justify-center text-[14px] flex-none">{i + 1}</span><span>{t}</span></div>
            ))}
          </div>
        </div></section>
      ) : null}

      <WeatherSection v={v} />

      {v.why && v.why.length ? (
        <section className="block py-[48px] bg-white"><div className="container max-w-[1180px] mx-auto px-[28px]">
          <div className="eyebrow inline-flex items-center gap-[9px] font-extrabold text-[12.5px] tracking-[1.2px] uppercase text-black mb-[11px]">The ground</div>
          <h2 className="shead font-display text-[clamp(28px,3.6vw,40px)] text-[#222] tracking-[0.5px] mb-[5px]">Why it hits different</h2>
          <div className="why grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-[18px]">
            {v.why.map((w: any, i: number) => (
              <div key={i} className="relative overflow-hidden bg-white border border-[#ececec] rounded-[14px] shadow-[0_12px_34px_rgba(0,0,0,0.07)] pt-[24px] pr-[22px] pb-[24px] pl-[26px] before:content-[''] before:absolute before:left-0 before:inset-y-0 before:w-[5px] before:bg-brand-yellow"><div className="t font-display text-[20px] tracking-[0.5px] text-[#222] mb-[9px]">{w.title}</div><Blurb className="x text-[14.5px] leading-[1.55] text-[#555]" text={w.text} /></div>
            ))}
          </div>
        </div></section>
      ) : null}

      {v.lore && v.lore.length ? (
        <section className="block tint py-[48px] bg-[#f7f6f2]"><div className="container max-w-[1180px] mx-auto px-[28px]">
          <div className="eyebrow inline-flex items-center gap-[9px] font-extrabold text-[12.5px] tracking-[1.2px] uppercase text-black mb-[11px]">Heritage</div>
          <h2 className="shead font-display text-[clamp(28px,3.6vw,40px)] text-[#222] tracking-[0.5px] mb-[5px]">History & lore</h2>
          <div className="lore flex flex-col gap-0">
            {v.lore.map((l: string, i: number) => (
              <div key={i} className="li py-[16px] border-b border-[#ececec] flex gap-[16px] items-start"><span className="dot w-[12px] h-[12px] bg-brand-yellow rotate-45 mt-[5px] flex-none border-2 border-[#222]"></span><span className="lx text-[16px] leading-[1.55] text-[#33352f]">{l}</span></div>
            ))}
          </div>
        </div></section>
      ) : null}
    </>
  )
}
