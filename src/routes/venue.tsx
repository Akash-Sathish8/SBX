import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteNav } from '../components/SiteNav'
import css from '../pages/venue.css?url'

export const Route = createFileRoute('/venue')({
  validateSearch: (s: Record<string, unknown>) => ({ id: typeof s.id === 'string' ? s.id : '' }),
  head: () => ({
    links: [{ rel: 'stylesheet', href: css }],
    meta: [{ title: 'Snapback — Venue' }],
  }),
  component: VenuePage,
})

const FL: Record<string, string> = { USA: '🇺🇸', CAN: '🇨🇦', MEX: '🇲🇽' }

function VenuePage() {
  const { id: rawId } = Route.useSearch()
  const id = (rawId || '').replace(/[^a-z0-9_-]/gi, '')
  const [state, setState] = useState<{ status: 'loading' | 'error' | 'ok'; v?: any }>({ status: 'loading' })

  useEffect(() => {
    if (!id) return
    let alive = true
    setState({ status: 'loading' })
    fetch('/data/venues/' + id + '.json')
      .then((r) => { if (!r.ok) throw new Error('not found'); return r.json() })
      .then((v) => { if (alive) { setState({ status: 'ok', v }); document.title = 'Snapback — ' + v.name } })
      .catch(() => { if (alive) setState({ status: 'error' }) })
    return () => { alive = false }
  }, [id])

  return (
    <>
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
    if (state.status === 'loading') return <div className="loadwrap">Loading venue…</div>
    if (state.status === 'error') {
      return (
        <div className="loadwrap">Couldn't load this venue. <Link to="/venues" style={{ color: '#222', textDecoration: 'underline' }}>Back to venues →</Link></div>
      )
    }
    return <VenueContent v={state.v} />
  }
}

function VenueContent({ v }: { v: any }) {
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
          {v.tagline ? <p className="tag">{v.tagline}</p> : null}
        </div>
      </section>

      {v.stats && v.stats.length ? (
        <div className="statstrip"><div className="container"><div className="statrow">
          {v.stats.map((s: any, i: number) => (
            <div key={i} className="stat"><div className="v">{s.value}</div><div className="l">{s.label}</div></div>
          ))}
        </div></div></div>
      ) : null}

      {v.why && v.why.length ? (
        <section className="block"><div className="container">
          <h2 className="shead">Why it hits different</h2><div className="ssub">What makes this ground special</div>
          <div className="why">
            {v.why.map((w: any, i: number) => (
              <div key={i} className="whyc"><div className="t">{w.title}</div><div className="x">{w.text}</div></div>
            ))}
          </div>
        </div></section>
      ) : null}

      {v.matches && v.matches.length ? (
        <section className="block alt"><div className="container">
          <h2 className="shead">Matches here</h2><div className="ssub">{v.matches.length} World Cup 2026 fixtures</div>
          <div className="mlist">
            {v.matches.map((m: any, i: number) => (
              <div key={i} className="mrow">
                <div className="mdate">{m.date}</div>
                <div className="mmid"><div className="mfix">{m.fixture}</div><div className="mround">{m.round}</div></div>
                <div className="mko">{m.ko}</div>
              </div>
            ))}
          </div>
        </div></section>
      ) : null}

      <section className="block"><div className="container">
        <h2 className="shead">Plan your matchday</h2><div className="ssub">Getting in, and what's around</div>
        <div className="cols">
          <div className="panel">
            <h3>🚇 Getting there</h3>
            {v.gettingThere ? <div className="lead">{v.gettingThere}</div> : null}
            {v.transit && v.transit.length ? (
              <ul className="ul">{v.transit.map((t: string, i: number) => <li key={i}>{t}</li>)}</ul>
            ) : null}
          </div>
          <div className="panel">
            <h3>🎉 Around the ground</h3>
            {v.matchday ? <div className="lead">{v.matchday}</div> : null}
            {v.food && v.food.length ? (
              <ul className="ul">{v.food.map((f: string, i: number) => <li key={i}>{f}</li>)}</ul>
            ) : null}
          </div>
        </div>
      </div></section>

      {v.tips && v.tips.length ? (
        <section className="block alt"><div className="container">
          <h2 className="shead">Insider tips</h2><div className="ssub">Read this before you go</div>
          <div className="tips">
            {v.tips.map((t: string, i: number) => (
              <div key={i} className="tip"><span className="n">{i + 1}</span><span>{t}</span></div>
            ))}
          </div>
        </div></section>
      ) : null}

      {v.weather ? (
        <section className="block"><div className="container">
          <div className="kbox"><span className="ic">🌤️</span><div><div className="kt">Weather & what to pack</div><div className="kx">{v.weather}</div></div></div>
        </div></section>
      ) : null}

      {v.lore && v.lore.length ? (
        <section className="block alt"><div className="container">
          <h2 className="shead">History & lore</h2><div className="ssub">The stories in the walls</div>
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
