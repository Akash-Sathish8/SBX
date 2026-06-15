// Casey's standalone Matchday Agenda editor.
// SEPARATE product: this route only ADDS files — it imports ShareCard/teams/fonts
// read-only and never touches the consumer SBX pages. Pick a match, type a line
// per section, live-preview the share card, download/share. Auto-saves per match.
import { useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { SearchIcon } from 'lucide-react'
import { ShareCard, type Plan } from '../components/ShareCard'
import { renderShareCardBlob } from '../lib/renderShareCard'
import { teamName, teamFlag } from '../lib/teams'
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
    meta: [{ title: 'Snapback — Matchday Agenda' }],
  }),
  component: AgendaPage,
})

const SECTIONS = [
  { key: 'get', label: 'Getting there', ph: "How you're getting to the stadium…" },
  { key: 'pre', label: 'Before the match', ph: "Where you're going before kickoff…" },
  { key: 'eat', label: 'Eat inside', ph: "What you're grabbing in the ground…" },
  { key: 'merch', label: 'Merch', ph: "Any shop you're hitting…" },
  { key: 'post', label: 'After the whistle', ph: "Where you're heading after…" },
] as const
type Fields = Record<string, string>
const blank = (): Fields => ({ get: '', pre: '', eat: '', merch: '', post: '' })
const saveKey = (id: string) => 'sbx-agenda:' + id

function AgendaPage() {
  const { game } = Route.useSearch()
  const navigate = useNavigate()
  const [index, setIndex] = useState<any[] | null>(null)

  useEffect(() => {
    fetch('/data/games/index.json').then((r) => r.json()).then(setIndex).catch(() => setIndex([]))
  }, [])

  const g = index ? index.find((x) => x.id === game) : null

  return (
    <>
      <PageCssGuard id="agenda" />
      <main className="ag-wrap">
        <header className="ag-top">
          <Link to="/" className="ag-brand" aria-label="Snapback home" style={{ textDecoration: 'none', color: 'inherit' }}><img src="/img/logo.png" alt="" /><span>Snapback<br />Agenda</span></Link>
          {g ? <button className="ag-link" onClick={() => navigate({ to: '/agenda', search: { game: '' } })}>← Change match</button> : null}
        </header>
        {!index ? <div className="ag-load">Loading…</div>
          : g ? <Editor key={g.id} g={g} />
            : <Picker index={index} onPick={(id) => navigate({ to: '/agenda', search: { game: id } })} />}
      </main>
    </>
  )
}

function Picker({ index, onPick }: { index: any[]; onPick: (id: string) => void }) {
  const [q, setQ] = useState('')
  const real = useMemo(() => index.filter((x) => !x.tbd), [index])
  const ql = q.trim().toLowerCase()
  const list = real.filter((x) => !ql || (x.home + ' ' + x.away + ' ' + teamName(x.home) + ' ' + teamName(x.away) + ' ' + x.venueName + ' ' + x.city).toLowerCase().includes(ql))
  return (
    <div className="ag-pick">
      <h1 className="ag-h1">Build a matchday agenda</h1>
      <div className="ag-sub">Pick your match, then type your plan. It saves automatically.</div>
      <div className="search ag-search"><SearchIcon className="si" /><input type="search" placeholder="Search team, venue or city…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="bld-list">
        {list.map((x) => (
          <button key={x.id} className="bld-mrow" onClick={() => onPick(x.id)}>
            <span className="bld-date">{x.date}</span>
            <span className="bld-teams">{teamFlag(x.home)} {teamName(x.home)} <span className="bld-vs">v</span> {teamName(x.away)} {teamFlag(x.away)}</span>
            <span className="bld-meta">{x.round} · {x.venueName}</span>
            <span className="bld-go">Use →</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function Editor({ g }: { g: any }) {
  // Lazily load this match's saved agenda from the initializer (so state starts
  // at the SAVED value, never blank). The parent keys <Editor> by game id, so
  // switching matches remounts and re-reads. Starting blank + loading in an
  // effect races the autosave effect and clobbers the saved value on reload.
  const loadSaved = (): Fields => {
    try { const s = localStorage.getItem(saveKey(g.id)); return s ? { ...blank(), ...JSON.parse(s) } : blank() } catch { return blank() }
  }
  const [f, setF] = useState<Fields>(loadSaved)
  const [busy, setBusy] = useState('')
  const storyRef = useRef<HTMLDivElement>(null)

  // auto-save on every edit
  useEffect(() => {
    try { localStorage.setItem(saveKey(g.id), JSON.stringify(f)) } catch { /* ignore */ }
  }, [f, g.id])

  const set = (k: string) => (e: React.ChangeEvent<HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }))
  const line = (v: string) => (v.trim() ? [{ name: v.trim() }] : null)

  const plan: Plan = {
    home: teamName(g.home), away: teamName(g.away), homeFlag: teamFlag(g.home), awayFlag: teamFlag(g.away),
    round: g.round, date: g.date, ko: g.ko || '', venueName: g.venueName, city: g.city, weather: null,
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
      const text = `Matchday plan: ${teamName(g.home)} v ${teamName(g.away)} at ${g.venueName}.`
      if (nav.canShare && nav.canShare({ files: [file] })) await nav.share({ files: [file], title: 'Snapback matchday agenda', text })
      else if (nav.share) await nav.share({ title: 'Snapback matchday agenda', text })
      else { const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = file.name; a.click(); URL.revokeObjectURL(u) }
    } catch { /* dismissed */ } finally { setBusy('') }
  }

  return (
    <div className="ag-edit">
      <div className="ag-fields">
        <div className="ag-match">{teamFlag(g.home)} {teamName(g.home)} <span className="ag-v">v</span> {teamName(g.away)} {teamFlag(g.away)}</div>
        <div className="ag-meta">{g.round} · {g.date}{g.ko ? ' · ' + g.ko : ''} · {g.venueName}</div>
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

      {/* offscreen full-size render target for export */}
      <div className="sb-stage" aria-hidden><ShareCard ref={storyRef} plan={plan} format="story" /></div>
    </div>
  )
}
