import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteNav } from '../components/SiteNav'
import { PageCssGuard } from '../components/PageCssGuard'
import { teamName, teamFlag, teamCode } from '../lib/teams'
import { getJSON } from '../lib/dataCache'
import css from '../pages/game.css?url'

export const Route = createFileRoute('/game')({
  validateSearch: (s: Record<string, unknown>) => ({ id: typeof s.id === 'string' ? s.id : '' }),
  head: () => ({
    links: [{ rel: 'stylesheet', href: css, 'data-page-css': 'game build' }],
    meta: [{ title: 'Snapback — Game' }],
  }),
  component: GamePage,
})

const toBullets = (t = '') => t.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
const cap = (s = '') => (/^[a-z]/.test(s) ? s[0].toUpperCase() + s.slice(1) : s)
// A march belongs on THIS match's page if it names one of the two teams,
// or if it's a general "every match day" item for the venue.
function marchRelevant(m: any, g: any) {
  if (m.venue !== g.venue) return false
  const hay = ((m.title || '') + ' ' + (m.note || '') + ' ' + (m.when || '')).toLowerCase()
  const teams = [g.home, g.away, teamName(g.home), teamName(g.away)].filter(Boolean).map((s: string) => s.toLowerCase())
  if (teams.some((t: string) => t && hay.indexOf(t) > -1)) return true
  return /every match day|all matches|each match day|match day/.test(hay) && !/match:/.test(hay)
}
const BADGE_LABEL: Record<string, string> = { verified: 'Verified', reported: 'Reported', unverified: 'Unverified' }
const Badge = ({ k }: { k?: string }) => (k && BADGE_LABEL[k] ? <span className={'bd ' + k}>{BADGE_LABEL[k]}</span> : null)

function Sources({ list }: { list?: any[] }) {
  if (!list || !list.length) return null
  return (
    <div className="fi-src">Sources: {list.map((s: any, i: number) => (
      <span key={i}>{i ? ' · ' : ''}<a href={s.url} target="_blank" rel="noopener">{s.label}</a></span>
    ))}</div>
  )
}

function GamePage() {
  const { id: rawId } = Route.useSearch()
  const id = (rawId || '').replace(/[^a-z0-9_-]/gi, '')
  const [state, setState] = useState<{ status: 'loading' | 'error' | 'ok'; data?: any }>({ status: 'loading' })

  useEffect(() => {
    if (!id) return
    let alive = true
    setState({ status: 'loading' })
    Promise.all([
      getJSON('/data/games/index.json'),
      getJSON('/data/fanintel.json'),
    ])
      .then(async ([index, fi]) => {
        const g = (index as any[]).find((x) => x.id === id)
        if (!g) throw new Error('not found')
        const intel = fi.venues ? fi.venues[g.venue] : null
        const marches = fi.marches ? fi.marches.filter((m: any) => marchRelevant(m, g)) : []
        let detail: any = null
        if (g.hasDetail) {
          try { detail = await getJSON('/data/games/' + id + '.json') } catch { detail = null }
        }
        if (alive) {
          setState({ status: 'ok', data: { g, intel, marches, detail } })
          document.title = 'Snapback — ' + (g.tbd ? g.round : teamName(g.home) + ' vs ' + teamName(g.away))
        }
      })
      .catch(() => { if (alive) setState({ status: 'error' }) })
    return () => { alive = false }
  }, [id])

  return (
    <>
      <PageCssGuard id="game" />
      <SiteNav active="games" />
      <main id="app">{renderBody()}</main>
      <footer>
        <div className="container">© 2026 Snapback Sports — World Cup Games. <Link to="/games">← All games</Link></div>
      </footer>
    </>
  )

  function renderBody() {
    if (!id) return <div className="loadwrap">No game selected. <Link to="/games" style={{ color: '#222', textDecoration: 'underline' }}>Back to games →</Link></div>
    if (state.status === 'loading') return <div className="loadwrap">Loading game…</div>
    if (state.status === 'error') return <div className="loadwrap">Couldn't find this game. <Link to="/games" style={{ color: '#222', textDecoration: 'underline' }}>Back to games →</Link></div>
    return <GameContent {...state.data} />
  }
}

function GameContent({ g, intel, marches, detail }: { g: any; intel: any; marches: any[]; detail: any }) {
  const pre = (detail && detail.preview) || null
  return (
    <>
      {/* HERO */}
      <section className="ghero">
        {!g.tbd && teamCode(g.home) && teamCode(g.away) ? (
          <div className="flagbg" aria-hidden>
            <div className="fhalf left" style={{ backgroundImage: `url(https://flagcdn.com/${teamCode(g.home)}.svg)` }} />
            <div className="fhalf right" style={{ backgroundImage: `url(https://flagcdn.com/${teamCode(g.away)}.svg)` }} />
          </div>
        ) : null}
        <div className="container">
          <div className="ground">{g.round}</div>
          {g.tbd ? (
            <div className="gmatch"><span className="gname tbd">To be confirmed</span></div>
          ) : (
            <div className="gmatch">
              <div className="gteam home"><span className="gflag">{teamFlag(g.home)}</span><span className="gname">{teamName(g.home)}</span></div>
              <span className="gvs">vs</span>
              <div className="gteam away"><span className="gflag">{teamFlag(g.away)}</span><span className="gname">{teamName(g.away)}</span></div>
            </div>
          )}
          <div className="gmeta">
            {g.date}{g.ko ? ' · ' + g.ko : ''} ·{' '}
            <Link to="/venue" search={{ id: g.venue }} className="glink">{g.venueName}</Link>
            {g.city ? ', ' + g.city : ''}
          </div>
          {g.tbd ? <div className="gunverified">Opponents set once the group stage finishes</div> : null}
        </div>
      </section>

      {/* MATCH PREVIEW (only where researched) */}
      {pre && (pre.summary || (pre.storylines && pre.storylines.length)) ? (
        <section className="block tint"><div className="container">
          <div className="eyebrow">The matchup</div>
          <h2 className="shead">Match preview</h2>
          {pre.summary ? <ul className="fi-points lg">{toBullets(pre.summary).map((p, i) => <li key={i}>{cap(p)}</li>)}</ul> : null}
          <div className="teamcards">
            <div className="teamcard">
              <div className="tchead"><span className="gflag sm">{teamFlag(g.home)}</span>{teamName(g.home)}</div>
              {pre.homeForm ? <div className="tcrow"><span className="tclab">Form</span><span className="tcval">{pre.homeForm}</span></div> : null}
              {pre.homeKey ? <div className="tcrow"><span className="tclab">Key player</span><span className="tcval">{pre.homeKey}</span></div> : null}
            </div>
            <div className="teamcard">
              <div className="tchead"><span className="gflag sm">{teamFlag(g.away)}</span>{teamName(g.away)}</div>
              {pre.awayForm ? <div className="tcrow"><span className="tclab">Form</span><span className="tcval">{pre.awayForm}</span></div> : null}
              {pre.awayKey ? <div className="tcrow"><span className="tclab">Key player</span><span className="tcval">{pre.awayKey}</span></div> : null}
            </div>
          </div>
          {pre.storylines && pre.storylines.length ? (
            <>
              <h3 className="subhead">Storylines</h3>
              <ul className="storylines">{pre.storylines.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
            </>
          ) : null}
          {pre.h2h ? <div className="gnotes"><div className="gnote"><span className="gnlab">Head to head</span><span className="gntx">{pre.h2h}</span></div></div> : null}
        </div></section>
      ) : null}

      {/* FAN INTEL — how to do THIS match, audited & sourced */}
      {intel ? (
        <section className="block"><div className="container">
          <div className="eyebrow">Fan intel · audited &amp; sourced</div>
          <h2 className="shead">Going to {g.tbd ? 'this match' : teamName(g.home) + ' v ' + teamName(g.away)}</h2>
          <div className="fi-legend">
            <Badge k="verified" /> official / multiple sources &nbsp;
            <Badge k="reported" /> single or travel-media &nbsp;
            <Badge k="unverified" /> unconfirmed
          </div>
          <div className="fi-meta">
            {intel.wcName ? <>FIFA venue name: <b>{intel.wcName}</b> · </> : null}
            Capacity {intel.capacity?.text} <Badge k={intel.capacity?.badge} />
          </div>
          <div className="fi-rows">
            {(intel.fields || []).filter((f: any) => f.label !== 'Matches').map((f: any, i: number) => (
              <div key={i} className="fi-row">
                <div className="fi-l">{f.label} <Badge k={f.badge} /></div>
                {f.points && f.points.length
                  ? <ul className="fi-points">{f.points.map((p: string, j: number) => <li key={j}>{cap(p)}</li>)}</ul>
                  : <div className="fi-t">{f.text}</div>}
              </div>
            ))}
          </div>
          <Sources list={intel.sources} />
        </div></section>
      ) : null}

      {/* SUPPORTER MARCHES */}
      {marches && marches.length ? (
        <section className="block tint"><div className="container">
          <div className="eyebrow">Get there together</div>
          <h2 className="shead">Supporter marches &amp; fan walks</h2>
          <div className="ssub">Where fan groups meet and walk in together. Specifics firm up 1–2 weeks before each match.</div>
          <div className="march-grid">
            {marches.map((m: any, i: number) => (
              <div key={i} className={'march-card' + (m.badge === 'unverified' ? ' u' : '')}>
                <div className="mc-h"><span className="mc-flag">{m.flag}</span>{m.title} <Badge k={m.badge} /></div>
                {m.when ? <div className="mc-when">{m.when}</div> : null}
                {m.points && m.points.length
                  ? <ul className="fi-points mc-points">{m.points.map((p: string, j: number) => <li key={j}>{cap(p)}</li>)}</ul>
                  : <>
                      {m.route ? <div className="mc-route">{m.route}</div> : null}
                      {m.note ? <div className="mc-note">{m.note}</div> : null}
                    </>}
                <Sources list={m.sources} />
              </div>
            ))}
          </div>
        </div></section>
      ) : null}

      {/* BUILD MATCH GUIDE CTA → dedicated builder flow */}
      {!g.tbd ? (
        <section className="block tint"><div className="container">
          <div className="eyebrow">Make it yours</div>
          <h2 className="shead">Your match guide</h2>
          <div className="ssub">A shareable card of your matchday plan</div>
          <Link to="/build" search={{ game: g.id, mode: 'matchup' }} className="guidecta">Build Match Guide →</Link>
        </div></section>
      ) : null}

      {/* CTA */}
      <section className="block endband"><div className="container">
        <Link to="/venue" search={{ id: g.venue }} className="guidecta lg">Plan the full matchday at {g.venueName} →</Link>
      </div></section>
    </>
  )
}
