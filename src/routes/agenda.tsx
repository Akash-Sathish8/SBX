// Standalone Gameday Agenda editor.
// SEPARATE feature: this route only ADDS files — it imports ShareCard/fonts
// read-only and never touches the consumer SBX pages. Pick a game, type a line
// per section, live-preview the share card, download/share. Auto-saves per game.
import { useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { SearchIcon } from 'lucide-react'
import { getJSON } from '../lib/dataCache'
import { ShareCard, type Plan } from '../components/ShareCard'
import { renderShareCardBlob } from '../lib/renderShareCard'
import { SPORTS } from '../lib/sports'
import type { Game } from '../lib/espn'
import { PageCssGuard } from '../components/PageCssGuard'
import shareCss from '../pages/share.css?url'
import css from '../pages/agenda.css?url'

export const Route = createFileRoute('/agenda')({
  validateSearch: (s: Record<string, unknown>) => ({ game: typeof s.game === 'string' ? s.game : '' }),
  head: () => ({
    links: [
      // 'build agenda': must match build.tsx's tag — TanStack dedupes by href
      // and only one link (with one tag) survives across both routes.
      { rel: 'stylesheet', href: shareCss, 'data-page-css': 'build agenda' },
      { rel: 'stylesheet', href: css, 'data-page-css': 'agenda' },
    ],
    meta: [{ title: 'Snapback · Gameday Agenda' }],
  }),
  component: AgendaPage,
})

const SECTIONS = [
  { key: 'get', label: 'Getting there', ph: "How you're getting to the venue…" },
  { key: 'pre', label: 'Before the game', ph: "Where you're going before tip / first pitch / kickoff…" },
  { key: 'eat', label: 'Eat inside', ph: "What you're grabbing in the building…" },
  { key: 'merch', label: 'Merch', ph: "Any shop you're hitting…" },
  { key: 'post', label: 'After the final whistle', ph: "Where you're heading after…" },
] as const
type Fields = Record<string, string>
const blank = (): Fields => ({ get: '', pre: '', eat: '', merch: '', post: '' })
const saveKey = (id: string) => 'sbx-agenda:' + id

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const fmtDate = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? '' : `${WD[d.getDay()]} ${MON[d.getMonth()]} ${d.getDate()}` }
const fmtKo = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }
const teamShort = (g: Game, side: 'home' | 'away') => g[side].location || g[side].displayName

function AgendaPage() {
  const { game } = Route.useSearch()
  const navigate = useNavigate()
  const [games, setGames] = useState<Game[] | null>(null)

  useEffect(() => {
    getJSON('/api/games').then((r: any) => setGames(Array.isArray(r?.data) ? r.data : [])).catch(() => setGames([]))
  }, [])

  const g = games ? games.find((x) => x.id === game) : null

  return (
    <>
      <PageCssGuard id="agenda" />
      <main className="ag-wrap">
        <header className="ag-top">
          <Link to="/" className="ag-brand" aria-label="Snapback home" style={{ textDecoration: 'none', color: 'inherit' }}><img src="/img/logo.png" alt="" /><span>Snapback<br />Agenda</span></Link>
          {g ? <button className="ag-link" onClick={() => navigate({ to: '/agenda', search: { game: '' } })}>← Change game</button> : null}
        </header>
        {!games ? <div className="ag-load">Loading…</div>
          : g ? <Editor key={g.id} g={g} />
            : <Picker games={games} onPick={(id) => navigate({ to: '/agenda', search: { game: id } })} />}
      </main>
    </>
  )
}

function Picker({ games, onPick }: { games: Game[]; onPick: (id: string) => void }) {
  const [q, setQ] = useState('')
  const ql = q.trim().toLowerCase()
  const list = useMemo(
    () => games.filter((x) => !ql || (x.home.displayName + ' ' + x.away.displayName + ' ' + (x.venue.name || '') + ' ' + (x.venue.city || '') + ' ' + SPORTS[x.league].label).toLowerCase().includes(ql)),
    [games, ql],
  )
  return (
    <div className="ag-pick">
      <h1 className="ag-h1">Build a gameday agenda</h1>
      <div className="ag-sub">Pick your game, then type your plan. It saves automatically.</div>
      <div className="search ag-search"><SearchIcon className="si" /><input type="search" placeholder="Search team, venue or city…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="bld-list">
        {list.map((x) => (
          <button key={x.id} className="bld-mrow" onClick={() => onPick(x.id)}>
            <span className="bld-date">{fmtDate(x.date)}</span>
            <span className="bld-teams">
              {x.away.logo ? <img className="bld-logo" src={x.away.logo} alt="" width={22} height={22} /> : null} {teamShort(x, 'away')} <span className="bld-vs">@</span> {teamShort(x, 'home')} {x.home.logo ? <img className="bld-logo" src={x.home.logo} alt="" width={22} height={22} /> : null}
            </span>
            <span className="bld-meta">{SPORTS[x.league].label} · {x.venue.name}</span>
            <span className="bld-go">Use →</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function Editor({ g }: { g: Game }) {
  const loadSaved = (): Fields => {
    try { const s = localStorage.getItem(saveKey(g.id)); return s ? { ...blank(), ...JSON.parse(s) } : blank() } catch { return blank() }
  }
  const [f, setF] = useState<Fields>(loadSaved)
  const [busy, setBusy] = useState('')
  const storyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try { localStorage.setItem(saveKey(g.id), JSON.stringify(f)) } catch { /* ignore */ }
  }, [f, g.id])

  const set = (k: string) => (e: React.ChangeEvent<HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }))
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
  const anyFilled = SECTIONS.some((s) => f[s.key].trim())

  async function renderBlob(): Promise<Blob | null> {
    const node = storyRef.current; if (!node) return null
    return renderShareCardBlob(node)
  }
  async function download() {
    setBusy('download')
    try { const b = await renderBlob(); if (!b) return; const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `snapback-agenda-${g.id}.png`; a.click(); URL.revokeObjectURL(u) } catch { /* noop */ } finally { setBusy('') }
  }
  async function share() {
    setBusy('share')
    try {
      const b = await renderBlob(); if (!b) return
      const file = new File([b], `snapback-agenda-${g.id}.png`, { type: 'image/png' })
      const nav: any = navigator
      const text = `Gameday plan: ${teamShort(g, 'away')} @ ${teamShort(g, 'home')} at ${g.venue.name}.`
      if (nav.canShare && nav.canShare({ files: [file] })) await nav.share({ files: [file], title: 'Snapback gameday agenda', text })
      else if (nav.share) await nav.share({ title: 'Snapback gameday agenda', text })
      else { const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = file.name; a.click(); URL.revokeObjectURL(u) }
    } catch { /* dismissed */ } finally { setBusy('') }
  }

  return (
    <div className="ag-edit">
      <div className="ag-fields">
        <div className="ag-match">
          {g.away.logo ? <img className="bld-logo" src={g.away.logo} alt="" width={26} height={26} /> : null} {teamShort(g, 'away')} <span className="ag-v">@</span> {teamShort(g, 'home')} {g.home.logo ? <img className="bld-logo" src={g.home.logo} alt="" width={26} height={26} /> : null}
        </div>
        <div className="ag-meta">{SPORTS[g.league].label} · {fmtDate(g.date)}{fmtKo(g.date) ? ' · ' + fmtKo(g.date) : ''} · {g.venue.name}</div>
        {SECTIONS.map((s) => (
          <label key={s.key} className="ag-field">
            <span className="ag-flabel">{s.label}</span>
            <textarea className="ag-input" rows={2} placeholder={s.ph} value={f[s.key]} onChange={set(s.key)} />
          </label>
        ))}
        <div className="ag-savednote">Saved automatically on this device.</div>
      </div>

      <div className="ag-preview">
        <div className="sb-pvbox"><div className="sb-pvcap">Story · 9:16</div><div className="sb-scale-story"><ShareCard plan={plan} format="story" /></div></div>
        <div className="ag-actions">
          <button className="sb-btn" disabled={!!busy || !anyFilled} onClick={download}>{busy === 'download' ? 'Rendering…' : '↓ Download'}</button>
          <button className="sb-btn dark" disabled={!!busy || !anyFilled} onClick={share}>{busy === 'share' ? 'Preparing…' : 'Share'}</button>
        </div>
      </div>

      <div className="sb-stage" aria-hidden><ShareCard ref={storyRef} plan={plan} format="story" /></div>
    </div>
  )
}
