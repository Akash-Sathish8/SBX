import { useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { SearchIcon, ShareIcon } from 'lucide-react'
import { SiteNav } from '../components/SiteNav'
import { PageCssGuard } from '../components/PageCssGuard'
import { ShareCard, type Plan } from '../components/ShareCard'
import { renderShareCardBlob } from '../lib/renderShareCard'
import { getJSON, intentWarm } from '../lib/dataCache'
import { SPORTS, isLeague, type League } from '../lib/sports'
import type { Game } from '../lib/espn'
import gameCss from '../pages/game.css?url'
import shareCss from '../pages/share.css?url'

export const Route = createFileRoute('/build')({
  validateSearch: (s: Record<string, unknown>) => ({
    game: typeof s.game === 'string' ? s.game : '',
    league: isLeague(s.league as string) ? (s.league as League) : undefined,
    mode: (s.mode === 'venue' ? 'venue' : 'matchup') as 'venue' | 'matchup',
  }),
  head: () => ({
    links: [
      { rel: 'stylesheet', href: gameCss, 'data-page-css': 'game build' },
      // 'build agenda': TanStack dedupes head links by href, so the surviving
      // link must carry every route id that uses this stylesheet.
      { rel: 'stylesheet', href: shareCss, 'data-page-css': 'build agenda' },
    ],
    meta: [{ title: 'Snapback — Build Gameday Guide' }],
  }),
  component: BuildPage,
})

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const fmtDate = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? '' : `${WD[d.getDay()]} ${MON[d.getMonth()]} ${d.getDate()}` }
const fmtKo = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }
const teamShort = (g: Game, side: 'home' | 'away') => g[side].location || g[side].displayName

function BuildPage() {
  const { game, mode } = Route.useSearch()
  const navigate = useNavigate()
  const [games, setGames] = useState<Game[] | null>(null)
  const [failed, setFailed] = useState(false)

  const [extra, setExtra] = useState<Game | null>(null)

  useEffect(() => {
    getJSON('/api/games').then((r: any) => setGames(Array.isArray(r?.data) ? r.data : [])).catch(() => setFailed(true))
  }, [])

  const setGame = (id: string) => navigate({ to: '/build', search: { game: id, mode } })
  const listed = games ? games.find((x) => x.id === game) : null
  const g = listed || (extra && extra.id === game ? extra : null)

  // The chooser list is a near-term window; a linked-in game (from a game page)
  // may fall outside it, so resolve it by id.
  useEffect(() => {
    if (!game || !games || listed) return
    let alive = true
    getJSON('/api/games?id=' + encodeURIComponent(game))
      .then((r: any) => { if (alive) setExtra((Array.isArray(r?.data) && r.data[0]) || null) })
      .catch(() => {})
    return () => { alive = false }
  }, [game, games, listed])

  return (
    <>
      <PageCssGuard id="build" />
      <SiteNav active="guide" />
      <main id="app">
        {!g && (
          <section className="ghero"><div className="container">
            <div className="ground">Snapback · Gameday</div>
            <h1 className="bld-h1">Build your gameday guide</h1>
            <div className="gmeta">Pick a game, type your plan, share a card.</div>
          </div></section>
        )}
        {failed ? <div className="loadwrap">Couldn't load game data. <Link to="/" className="ulink">← Home</Link></div>
          : !games ? <div className="loadwrap">Loading…</div>
            : g ? <Builder g={g} onBack={() => setGame('')} />
              : <Chooser games={games} onPick={setGame} initialMode={mode} />}
      </main>
    </>
  )
}

function Chooser({ games, onPick, initialMode }: { games: Game[]; onPick: (id: string) => void; initialMode?: 'matchup' | 'venue' }) {
  const [mode, setMode] = useState<'matchup' | 'venue'>(initialMode || 'matchup')
  const [q, setQ] = useState('')
  const [venue, setVenue] = useState('')

  const venues = useMemo(() => {
    const seen: Record<string, { name: string; city?: string; n: number }> = {}
    games.forEach((x) => { const k = x.venue.name || ''; if (!k) return; if (!seen[k]) seen[k] = { name: k, city: x.venue.city, n: 0 }; seen[k].n++ })
    return Object.values(seen).sort((a, b) => a.name.localeCompare(b.name))
  }, [games])

  const ql = q.trim().toLowerCase()
  const matchupList = useMemo(
    () => games.filter((x) => !ql || (x.home.displayName + ' ' + x.away.displayName + ' ' + (x.venue.name || '') + ' ' + (x.venue.city || '') + ' ' + SPORTS[x.league].label).toLowerCase().includes(ql)),
    [games, ql],
  )
  const venueList = venue ? games.filter((x) => x.venue.name === venue) : []

  const Row = ({ x }: { x: Game }) => (
    <button key={x.id} className="bld-mrow" onClick={() => onPick(x.id)}>
      <span className="bld-date">{fmtDate(x.date)}</span>
      <span className="bld-teams">
        {x.away.logo ? <img className="bld-logo" src={x.away.logo} alt="" width={22} height={22} /> : null} {teamShort(x, 'away')} <span className="bld-vs">@</span> {teamShort(x, 'home')} {x.home.logo ? <img className="bld-logo" src={x.home.logo} alt="" width={22} height={22} /> : null}
      </span>
      <span className="bld-meta">{SPORTS[x.league].label} · {x.venue.name}</span>
      <span className="bld-go">Choose →</span>
    </button>
  )

  return (
    <section className="block"><div className="container">
      <div className="eyebrow">Step 1</div>
      <h2 className="shead">Choose your game</h2>
      <div className="bld-tabs">
        <button className={'bld-tab' + (mode === 'matchup' ? ' on' : '')} onClick={() => setMode('matchup')}>By matchup</button>
        <button className={'bld-tab' + (mode === 'venue' ? ' on' : '')} onClick={() => { setMode('venue'); setVenue('') }}>By venue</button>
        {mode === 'matchup' ? (
          <div className="search bld-search"><SearchIcon className="si" /><input type="search" placeholder="Search team, venue or city…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        ) : null}
      </div>

      {mode === 'matchup' ? (
        <div className="bld-list">{matchupList.map((x) => <Row key={x.id} x={x} />)}</div>
      ) : !venue ? (
        <div className="bld-venues">
          {venues.map((v) => (
            <button key={v.name} className="bld-venue" onClick={() => setVenue(v.name)}>
              <span className="bld-vn">{v.name}</span>
              <span className="bld-vc">{v.city} · {v.n} game{v.n === 1 ? '' : 's'}</span>
            </button>
          ))}
        </div>
      ) : (
        <>
          <button className="bld-backlink" onClick={() => setVenue('')}>← All venues</button>
          <div className="bld-list">{venueList.map((x) => <Row key={x.id} x={x} />)}</div>
        </>
      )}
    </div></section>
  )
}

const SECTIONS = [
  { key: 'get', title: 'Getting there', sub: 'How are you getting to the venue?', ph: 'Train, rideshare, driving + parking…' },
  { key: 'pre', title: 'Before the game', sub: 'Where are you going beforehand?', ph: 'Bar, tailgate, dinner spot…' },
  { key: 'eat', title: 'Eat inside', sub: "What you're grabbing in the building", ph: 'Concourse food, section…' },
  { key: 'merch', title: 'Grab some merch', sub: 'Anything you want to pick up', ph: 'Jersey, cap, team store…' },
  { key: 'post', title: 'After the final whistle', sub: 'Where are you headed after?', ph: 'Postgame bar, food, plans…' },
] as const

function Builder({ g, onBack }: { g: Game; onBack: () => void }) {
  const blank = { get: '', pre: '', eat: '', merch: '', post: '' }
  const [f, setF] = useState<Record<string, string>>(blank)
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState('')
  const storyRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setF(blank); setStep(0) }, [g.id])

  const line = (v: string) => (v.trim() ? [{ name: v.trim() }] : null)
  const plan: Plan = {
    home: teamShort(g, 'home'), away: teamShort(g, 'away'),
    homeAbbr: g.home.abbr, awayAbbr: g.away.abbr,
    homeColor: g.home.color, awayColor: g.away.color,
    round: SPORTS[g.league].label, date: fmtDate(g.date), ko: fmtKo(g.date),
    venueName: g.venue.name || '', city: g.venue.city || '', weather: null,
    gettingThere: f.get.trim() ? { name: f.get.trim() } : null,
    parking: null, fanwalk: null,
    pre: line(f.pre), eat: line(f.eat), merch: line(f.merch), post: line(f.post),
  }

  const flow = [...SECTIONS.map((s) => ({ ...s, share: false })), { key: 'share', title: 'Your gameday plan', sub: 'Save it and share', ph: '', share: true }]
  const stepIdx = Math.min(step, flow.length - 1)
  const cur = flow[stepIdx]

  async function renderBlob(): Promise<Blob | null> {
    const node = storyRef.current; if (!node) return null
    return renderShareCardBlob(node)
  }
  async function share() {
    setBusy('share')
    try {
      const blob = await renderBlob(); if (!blob) return
      const file = new File([blob], `snapback-${g.id}.png`, { type: 'image/png' })
      const text = `My gameday plan for ${teamShort(g, 'away')} @ ${teamShort(g, 'home')} at ${g.venue.name}.`
      const nav: any = navigator
      if (nav.canShare && nav.canShare({ files: [file] })) await nav.share({ files: [file], title: 'Snapback gameday plan', text })
      else if (nav.share) await nav.share({ title: 'Snapback gameday plan', text })
      else { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = file.name; a.click(); URL.revokeObjectURL(url) }
    } catch { /* dismissed */ } finally { setBusy('') }
  }

  return (
    <>
      <section className={'block' + (cur.share ? '' : ' wz-screen')}><div className="container">
        <div className="wz-top">
          <button className="bld-backlink" onClick={onBack}>← Choose another game</button>
          <div className="wz-prog">
            {flow.map((s, i) => <span key={s.key} className={'wz-dot' + (i === stepIdx ? ' on' : '') + (i < stepIdx ? ' done' : '')} />)}
            <span className="wz-progtxt">{stepIdx + 1} / {flow.length}</span>
          </div>
        </div>

        <div className="wz-context">
          <span className="wz-cmatch">{teamShort(g, 'away')} @ {teamShort(g, 'home')}</span>
          <div className="wz-cmeta-row">
            <span className="wz-cmeta">{SPORTS[g.league].label}</span>
            <span className="wz-cmeta">{g.venue.name}</span>
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
                  {busy === 'share' ? 'Preparing…' : <>Share plan <ShareIcon size={15} aria-hidden="true" /></>}
                </button>
                <button className="sb-btn ghost" onClick={() => setStep((s) => s - 1)}>← Back</button>
              </div>
            </div>
          ) : (
            <>
              <div className="wz-scroll" key={cur.key}>
                <div className="wz-card wz-custom on">
                  <textarea
                    className="wz-custom-input"
                    rows={4}
                    placeholder={cur.ph}
                    value={f[cur.key] || ''}
                    onChange={(e) => setF((p) => ({ ...p, [cur.key]: e.target.value }))}
                  />
                  <span className="wz-pick">{f[cur.key]?.trim() ? "Added ✓ · it's on your card" : 'Optional · skip if not planned'}</span>
                </div>
              </div>
              <div className="wz-nav">
                <button className="sb-btn ghost" onClick={() => (stepIdx > 0 ? setStep((s) => s - 1) : onBack())}>← Back</button>
                <div className="wz-nav-stack">
                  <button className="sb-btn ghost wz-skip" onClick={() => setStep((s) => s + 1)}>Skip</button>
                  <button className="sb-btn dark" onClick={() => setStep((s) => s + 1)}>Next →</button>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="sb-stage" aria-hidden><ShareCard ref={storyRef} plan={plan} format="story" /></div>
      </div></section>

      {!cur.share ? (
        <>
          <div className="matchbar-spacer" aria-hidden />
          <div className="matchbar" aria-hidden>
            <div className="matchbar-side" style={{ background: g.away.color || '#1a1a1a' }}>
              {g.away.logo ? <img className="matchbar-logo" src={g.away.logo} alt="" /> : null}
              <span className="matchbar-team">{teamShort(g, 'away')}</span>
            </div>
            <span className="matchbar-vs">@</span>
            <div className="matchbar-side matchbar-away" style={{ background: g.home.color || '#1a1a1a' }}>
              {g.home.logo ? <img className="matchbar-logo" src={g.home.logo} alt="" /> : null}
              <span className="matchbar-team">{teamShort(g, 'home')}</span>
            </div>
          </div>
        </>
      ) : null}
    </>
  )
}
