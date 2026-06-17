// Casey's standalone Matchday Agenda editor.
// SEPARATE product: this route only ADDS files — it imports ShareCard/teams/fonts
// read-only and never touches the consumer SBX pages. Pick a match, type a line
// per section, live-preview the share card, download/share. Auto-saves per match.
import { useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { SearchIcon } from 'lucide-react'
// Build-time-static fixture list — imported (bundled) so the picker SSRs and
// paints instantly, instead of fetching /data/games/index.json on mount.
import { GAMES as GAMES_INDEX } from '../data'
import { ShareCard, type Plan } from '../components/ShareCard'
import { renderShareCardBlob } from '../lib/renderShareCard'
import { teamName, teamFlag } from '../lib/teams'

export const Route = createFileRoute('/agenda')({
  validateSearch: (s: Record<string, unknown>) => ({ game: typeof s.game === 'string' ? s.game : '' }),
  head: () => ({
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
  const index = GAMES_INDEX
  const g = index.find((x) => x.id === game) ?? null

  return (
    <>
      <main className="ag-wrap max-w-[1080px] mx-auto pt-[18px] px-[18px] pb-[64px]">
        <header className="ag-top flex items-center justify-between gap-[14px] mb-[20px]">
          <Link to="/" className="ag-brand flex items-center gap-[12px] font-display uppercase text-[19px] leading-[.88] tracking-[.5px] text-ink" aria-label="Snapback home" style={{ textDecoration: 'none', color: 'inherit' }}><img className="w-[44px] h-[44px] rounded-[9px] shadow-[3px_3px_0_#111]" src="/img/logo.png" alt="" /><span>Snapback<br />Agenda</span></Link>
          {g ? <button className="ag-link bg-none border-0 font-extrabold uppercase tracking-[.5px] text-[12.5px] text-ink cursor-pointer py-[6px] px-[2px]" onClick={() => navigate({ to: '/agenda', search: { game: '' } })}>← Change match</button> : null}
        </header>
        {g ? <Editor key={g.id} g={g} />
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
      <h1 className="ag-h1 font-display text-[clamp(30px,6vw,46px)] tracking-[.5px] text-ink mt-[2px] mb-[4px] uppercase">Build a matchday agenda</h1>
      <div className="ag-sub text-[#777] font-semibold mb-[18px]">Pick your match, then type your plan. It saves automatically.</div>
      <div className="search ag-search flex items-center gap-[9px] bg-white border-2 border-ink rounded-[8px] shadow-[4px_4px_0_0_#111] px-[14px] py-[9px] mb-[16px] max-w-[540px]"><SearchIcon className="si w-[16px] h-[16px] flex-none opacity-70 text-ink" /><input className="border-0 outline-0 bg-transparent font-body text-[16px] font-semibold text-ink w-full placeholder:text-[#9a9a9a] placeholder:font-medium" type="search" placeholder="Search team, venue or city…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="bld-list grid gap-[10px]">
        {list.map((x) => (
          <button key={x.id} className="bld-mrow grid grid-cols-[64px_1fr_auto_auto] gap-[16px] items-center text-left bg-white border border-[#ececec] rounded-[12px] shadow-[0_8px_22px_rgba(0,0,0,0.05)] px-[16px] py-[13px] cursor-pointer transition-[transform,box-shadow,border-color] duration-[120ms] font-[inherit] max-[600px]:grid-cols-[56px_1fr] max-[600px]:gap-[10px]" onClick={() => onPick(x.id)}>
            <span className="bld-date font-display text-[16px] text-ink bg-[#f5f3ea] rounded-[7px] px-[6px] py-[8px] text-center">{x.date}</span>
            <span className="bld-teams font-extrabold text-[16px] text-ink">{teamFlag(x.home)} {teamName(x.home)} <span className="bld-vs text-[#bbb] font-bold text-[12px] mx-[2px]">v</span> {teamName(x.away)} {teamFlag(x.away)}</span>
            <span className="bld-meta text-[12px] text-[#888] font-semibold uppercase tracking-[0.3px]">{x.round} · {x.venueName}</span>
            <span className="bld-go text-[12px] font-extrabold uppercase tracking-[0.5px] text-ink whitespace-nowrap">Use →</span>
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
    <div className="ag-edit grid grid-cols-[1fr] gap-[24px] min-[900px]:grid-cols-[1fr_360px] min-[900px]:items-start">
      <div className="ag-fields">
        <div className="ag-match font-display text-[clamp(22px,5vw,30px)] text-ink tracking-[.4px] uppercase">{teamFlag(g.home)} {teamName(g.home)} <span className="ag-v text-[#b8860b] mx-[4px]">v</span> {teamName(g.away)} {teamFlag(g.away)}</div>
        <div className="ag-meta text-[13px] font-bold uppercase tracking-[.4px] text-[#999] mt-[4px] mb-[18px]">{g.round} · {g.date}{g.ko ? ' · ' + g.ko : ''} · {g.venueName}</div>
        {SECTIONS.map((s) => (
          <label key={s.key} className="ag-field block mb-[15px]">
            <span className="ag-flabel block text-[12px] font-extrabold uppercase tracking-[.7px] text-[#9a7e00] mb-[6px]">{s.label}</span>
            <textarea className="ag-input w-full font-body text-[16px] leading-[1.45] text-ink bg-white border-2 border-[#e4e4de] rounded-[12px] py-[11px] px-[14px] resize-y shadow-[0_6px_18px_rgba(0,0,0,.05)] placeholder:text-[#b3b3ac] focus:outline-0 focus:border-ink" rows={2} placeholder={s.ph} value={f[s.key]} onChange={set(s.key)} />
          </label>
        ))}
        <div className="ag-savednote text-[12px] text-[#9a9a9a] font-semibold mt-[4px]">Saved automatically on this device.</div>
      </div>

      <div className="ag-preview sticky top-[16px] flex flex-col items-center max-[900px]:static">
        <div className="sb-pvbox bg-[#e9e7e0] rounded-[14px] p-[16px] shadow-[inset_0_2px_8px_rgba(0,0,0,0.06)] max-[600px]:p-[10px]"><div className="sb-pvcap text-[11px] font-extrabold uppercase tracking-[0.6px] text-[#888] mb-[8px] text-center">Story · 9:16</div><div className="sb-scale-story w-[283px] h-[503px] overflow-hidden [&_.sc]:scale-[.262] [&_.sc]:origin-top-left"><ShareCard plan={plan} format="story" /></div></div>
        <div className="ag-actions flex gap-[12px] mt-[16px] justify-center">
          <button className="sb-btn font-display uppercase tracking-[0.6px] text-[15px] text-ink bg-brand-yellow border-0 rounded-[8px] px-[22px] py-[13px] cursor-pointer disabled:opacity-[.45] disabled:cursor-not-allowed shadow-[0_8px_22px_rgba(0,0,0,0.1)]" disabled={!!busy || !anyFilled} onClick={download}>{busy === 'download' ? 'Rendering…' : '↓ Download'}</button>
          <button className="sb-btn dark font-display uppercase tracking-[0.6px] text-[15px] text-white bg-ink border-0 rounded-[8px] px-[22px] py-[13px] cursor-pointer disabled:opacity-[.45] disabled:cursor-not-allowed shadow-[0_8px_22px_rgba(0,0,0,0.1)]" disabled={!!busy || !anyFilled} onClick={share}>{busy === 'share' ? 'Preparing…' : 'Share'}</button>
        </div>
      </div>

      {/* offscreen full-size render target for export */}
      <div className="sb-stage fixed left-[-99999px] top-0 z-[-1] pointer-events-none" aria-hidden><ShareCard ref={storyRef} plan={plan} format="story" /></div>
    </div>
  )
}
