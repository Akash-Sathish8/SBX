// Standalone Snapback Matchday Agenda — client-only SPA version of the /agenda
// route (no TanStack router). Match selection lives in the URL hash so it works
// on static hosting with no rewrites; entries auto-save per match in localStorage.
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { toPng } from 'html-to-image'
import { ShareCard, type Plan } from '../src/components/ShareCard'
import { getShareFontEmbedCss } from '../src/lib/shareFonts'
import { teamName, teamFlag } from '../src/lib/teams'

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
const gameFromHash = () => new URLSearchParams(location.hash.replace(/^#/, '')).get('game') || ''

export function AgendaApp() {
  const [index, setIndex] = useState<any[] | null>(null)
  const [gameId, setGameId] = useState<string>(gameFromHash)

  useEffect(() => {
    fetch('/data/games/index.json').then((r) => r.json()).then(setIndex).catch(() => setIndex([]))
  }, [])
  useEffect(() => {
    const onHash = () => setGameId(gameFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const pick = (id: string) => { location.hash = id ? 'game=' + id : ''; setGameId(id) }
  const g = index ? index.find((x) => x.id === gameId) : null

  return (
    <main className="ag-wrap">
      <header className="ag-top">
        <div className="ag-brand"><img src="/img/logo.png" alt="" /><span>Snapback<br />Agenda</span></div>
        {g ? <button className="ag-link" onClick={() => pick('')}>← Change match</button> : null}
      </header>
      {!index ? <div className="ag-load">Loading…</div>
        : g ? <Editor key={g.id} g={g} />
          : <Picker index={index} onPick={pick} />}
    </main>
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
      <div className="search ag-search"><span className="si">🔍</span><input type="search" placeholder="Search team, venue or city…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
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
  const loadSaved = (): Fields => {
    try { const s = localStorage.getItem(saveKey(g.id)); return s ? { ...blank(), ...JSON.parse(s) } : blank() } catch { return blank() }
  }
  const [f, setF] = useState<Fields>(loadSaved)
  const [busy, setBusy] = useState('')
  const storyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try { localStorage.setItem(saveKey(g.id), JSON.stringify(f)) } catch { /* ignore */ }
  }, [f, g.id])

  const set = (k: string) => (e: ChangeEvent<HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }))
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
    try { await (document as any).fonts?.ready } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 60))
    let fontEmbedCSS: string | undefined
    try { fontEmbedCSS = await getShareFontEmbedCss() } catch { fontEmbedCSS = undefined }
    const url = await toPng(node, { pixelRatio: 1, cacheBust: true, width: 1080, height: 1920, ...(fontEmbedCSS ? { fontEmbedCSS } : { skipFonts: true }) })
    return await (await fetch(url)).blob()
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
      <div className="sb-stage" aria-hidden><ShareCard ref={storyRef} plan={plan} format="story" /></div>
    </div>
  )
}
