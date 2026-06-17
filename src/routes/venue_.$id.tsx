import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  MapPinIcon, SunIcon, CloudSunIcon, CloudIcon, CloudFogIcon, CloudRainIcon, CloudSnowIcon, CloudLightningIcon,
  BusIcon, TruckIcon, SquareParkingIcon, TrainFrontIcon,
} from 'lucide-react'
import { SiteNav } from '../components/SiteNav'
import { PageCssGuard } from '../components/PageCssGuard'
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
import css from '../pages/venue.css?url'

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
        { rel: 'stylesheet', href: css, 'data-page-css': 'venue' },
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
      <PageCssGuard id="venue" />
      <SiteNav active="venues" />
      <main id="app">{renderBody()}</main>
      <footer>
        <div className="container">© 2026 Snapback Sports — World Cup Venues. <Link to="/venues">← All venues</Link></div>
      </footer>
    </>
  )

  function renderBody() {
    if (!id) {
      return (
        <div className="loadwrap">No venue selected. <Link to="/venues" style={{ color: '#222', textDecoration: 'underline' }}>Back to venues →</Link></div>
      )
    }
    if (status === 'pending') return <div className="loadwrap">Loading venue…</div>
    if (status === 'error') {
      return (
        <div className="loadwrap">Couldn't load this venue. <Link to="/venues" style={{ color: '#222', textDecoration: 'underline' }}>Back to venues →</Link></div>
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
      <section className="block"><div className="container">
        <div className="eyebrow">Forecast</div><h2 className="shead">Live Weather Data</h2><div className="ssub">Specific to {v.name}</div>
        <div className="elead">{v.weather}</div>
      </div></section>
    ) : null
  }

  const byDate: Record<string, any> = {}
  if (days) for (const d of days) byDate[d.date] = d

  return (
    <section className="block tint"><div className="container">
      <div className="eyebrow">Forecast</div><h2 className="shead">Live Weather Data</h2><div className="ssub">Specific to {v.name}</div>
      {err ? <div className="wx-msg">Couldn't load live weather right now.</div> : null}
      {!err && days === null ? <div className="wx-msg">Loading live weather…</div> : null}
      {!err && days ? (
        <div className="wx-strip">
          {sortedMatches.map((m) => {
            const c = fmtCard(m.iso)
            const w = byDate[m.iso]
            const score = scores[m.iso + '|' + m.fixture]
            return (
              <div key={m.iso + m.fixture} className={'wx-day' + (score ? ' played' : '')}>
                <div className="wx-wd">{c.wd}</div>
                <div className="wx-dt">{c.md}</div>
                <div className="wx-match">{m.fixture ? displayFixture(m.fixture) : 'TBD'}</div>
                {score ? (
                  <>
                    <div className="wx-score">{score.hs}–{score.as}</div>
                    <div className="wx-ft">Full time</div>
                  </>
                ) : w ? (
                  <>
                    <div className="wx-ic"><WxIcon code={w.code} /></div>
                    <div className="wx-temp">{w.tmax}°<span className="lo"> / {w.tmin}°</span> <span className="wxu">F</span></div>
                    <div className="wx-tempc">{Math.round((w.tmax - 32) * 5 / 9)}°<span className="lo"> / {Math.round((w.tmin - 32) * 5 / 9)}°</span> <span className="wxu">C</span></div>
                    {w.pop !== null && w.pop !== undefined ? <div className="wx-rain">{w.pop}% rain</div> : (w.src === 'normal' ? <div className="wx-typical">typical (last yr)</div> : null)}
                  </>
                ) : <div className="wx-rain">forecast soon</div>}
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
  return <ul className={'blurb-bullets' + (className ? ' ' + className : '')}>{parts.map((p, i) => <li key={i}>{cap(p)}</li>)}</ul>
}
function AccRow({ m, title, sub, detail, points, deal }: { m: string; title: string; sub?: string; detail?: string; points?: { b: string; t: string }[]; deal?: string }) {
  return (
    <div className="erow">
      <span className="echip"><ModeIcon m={m} /></span>
      <div className="emid">
        <div className="etitle">{title}</div>
        {sub ? <div className="estn">{sub}</div> : null}
        {points && points.length ? (
          <ul className="epoints">{points.map((p, i) => <li key={i}><b>{cap(p.b)}</b> {p.t}</li>)}</ul>
        ) : detail ? <Blurb className="edet" text={detail} /> : null}
      </div>
      {deal ? <span className="epill">{deal}</span> : null}
    </div>
  )
}
function ENote({ label, children }: { label: string; children: any }) {
  return (
    <details className="notedd">
      <summary><span className="nlabel">{label}</span><span className="chev"></span></summary>
      <div className="ndbody">{typeof children === 'string' ? <Blurb text={children} /> : children}</div>
    </details>
  )
}
function TipsDropdown({ tips }: { tips?: string[] }) {
  if (!tips || !tips.length) return null
  return (
    <details className="tipsdd">
      <summary><span className="tipchip">Tips</span><span className="chev"></span></summary>
      <div className="tbody">
        {tips.map((t, i) => <div key={i} className="tline"><span className="dot"></span><span className="ttx">{t}</span></div>)}
      </div>
    </details>
  )
}
function AgendaCol({ title, items, hscroll }: { title: string; items?: any[]; hscroll?: boolean }) {
  if (!items || !items.length) return null
  const sorted = byDistance(items)
  return (
    <div className={'agcol' + (hscroll ? ' agcol-hscroll' : '')}>
      <div className="agtitle">{title}</div>
      <div className={'aglist' + (hscroll ? ' aglist-hscroll' : '')}>
        {sorted.map((s: any, i: number) => (
          <div key={i} className={'agspot' + (s.fifa ? ' fifa' : '')}>
            {s.fifa ? <span className="agtag">Official FIFA</span> : null}
            <div className="agname">{s.name}</div>
            {s.rating || s.dist ? (
              <div className="agmeta">
                {s.rating ? <span className="agrating">★ {s.rating}</span> : null}
                {s.dist ? <span className="agdist"><MapPinIcon className="agdist-gl" /> {s.dist}</span> : null}
              </div>
            ) : null}
            {s.where ? <div className="agwhere">{s.where}</div> : null}
            {s.why && s.why.length ? (
              <ul className="agwhy">{s.why.map((w: string, j: number) => <li key={j}>{cap(w)}</li>)}</ul>
            ) : s.note ? <div className="agnote">{s.note}</div> : null}
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
      <section className="hero">
        <div className="bg" style={{ backgroundImage: `url('${heroUrl}')` }}></div>
        <Link className="back" to="/venues">← All venues</Link>
        <div className="container">
          <div className="heyebrow">
            {v.role ? <span className="pillrole">{v.role}</span> : null}
            <span className="pillcity">{(FL[v.cc] || '')} {v.city}, {v.country}</span>
          </div>
          <h1>{v.name}</h1>
          {(v.fifaName || v.nickname) ? (
            <div className="altname">
              {v.fifaName ? <>FIFA name: <b>{v.fifaName}</b></> : null}
              {v.fifaName && v.nickname ? <>{'  ·  '}</> : null}
              {v.nickname ? <>Known as <b>{v.nickname}</b></> : null}
            </div>
          ) : null}
        </div>
      </section>

      {/* GETTING THERE + PARKING (combined matchday access) */}
      {(v.transport || v.parking) ? (
        <section className="block"><div className="container">
          <div className="eyebrow">Matchday access</div>
          <h2 className="shead">Getting there</h2><div className="ssub">Transit, parking &amp; rideshare</div>
          {v.transport &&((v.transport.rail && v.transport.rail.length) || (v.transport.bus && v.transport.bus.length) || (v.transport.shuttle && v.transport.shuttle.length)) ? (
            <div className="epanel">
              {(v.transport.rail || []).map((r: any, i: number) => <AccRow key={'r' + i} m="rail" title={r.name} sub={r.station} detail={r.detail} points={r.points} deal={r.deal} />)}
              {(v.transport.bus || []).map((b: any, i: number) => <AccRow key={'b' + i} m="bus" title={b.name} sub={b.from ? 'From ' + b.from : undefined} detail={b.detail} points={b.points} deal={b.deal} />)}
              {(v.transport.shuttle || []).map((s: any, i: number) => <AccRow key={'s' + i} m="shuttle" title={s.name} detail={s.detail} points={s.points} />)}
            </div>
          ) : (v.gettingThere || (v.transit && v.transit.length)) ? (
            <>
              {v.gettingThere ? <div className="elead">{v.gettingThere}</div> : null}
              {v.transit && v.transit.length ? <ul className="ul">{v.transit.map((t: string, i: number) => <li key={i}>{t}</li>)}</ul> : null}
            </>
          ) : null}

          {v.parking && v.parking.lots && v.parking.lots.length ? (
            <>
              <h3 className="subhead">Parking</h3>
              <div className="epanel">
                {v.parking.lots.map((l: any, i: number) => <AccRow key={'p' + i} m="park" title={l.name} detail={l.detail} points={l.points} deal={l.price} />)}
              </div>
            </>
          ) : null}

          <div className="enotes">
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
        <section className="block tint"><div className="container">
          <div className="eyebrow">Your matchday</div>
          <h2 className="shead">Around the ground</h2><div className="ssub">Pre-game · eat inside · post-game</div>
          {v.around ? (
            <>
              <div className="agenda">
                <AgendaCol title="Before the match" items={[...(v.around.pre || []), ...((v.around.food || []).filter((f: any) => !isInside(f)))]} />
                <AgendaCol title="Inside the stadium" items={(v.around.food || []).filter((f: any) => isInside(f))} />
                <AgendaCol title="Merch & shops" items={v.around.merch} />
              </div>
              <AgendaCol title="After the whistle" items={v.around.post} hscroll />
            </>
          ) : (
            v.food && v.food.length ? <ul className="ul">{v.food.map((f: string, i: number) => <li key={i}>{f}</li>)}</ul> : null
          )}
        </div></section>
      ) : null}

      {v.tips && v.tips.length ? (
        <section className="block"><div className="container">
          <div className="eyebrow">Before you go</div>
          <h2 className="shead">Insider tips</h2>
          <div className="tips">
            {v.tips.map((t: string, i: number) => (
              <div key={i} className="tip"><span className="n">{i + 1}</span><span>{t}</span></div>
            ))}
          </div>
        </div></section>
      ) : null}

      <WeatherSection v={v} />

      {v.why && v.why.length ? (
        <section className="block"><div className="container">
          <div className="eyebrow">The ground</div>
          <h2 className="shead">Why it hits different</h2>
          <div className="why">
            {v.why.map((w: any, i: number) => (
              <div key={i} className="whyc"><div className="t">{w.title}</div><Blurb className="x" text={w.text} /></div>
            ))}
          </div>
        </div></section>
      ) : null}

      {v.lore && v.lore.length ? (
        <section className="block tint"><div className="container">
          <div className="eyebrow">Heritage</div>
          <h2 className="shead">History & lore</h2>
          <div className="lore">
            {v.lore.map((l: string, i: number) => (
              <div key={i} className="li"><span className="dot"></span><span className="lx">{l}</span></div>
            ))}
          </div>
        </div></section>
      ) : null}
    </>
  )
}
