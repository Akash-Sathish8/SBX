// Standalone Venue Plan builder — "here's what I'm doing at this venue, tell me
// if it's right." SEPARATE feature in the agenda mold: this route only ADDS
// files and imports the share pipeline read-only (single sanctioned exception:
// the venue page's "Plan your visit" deep-link). Pick a venue, stack up what
// you're doing per section — type it or tap a fan tip / expert note — live-
// preview the share card, download/share the PNG. Auto-saves per venue.
import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { SearchIcon } from 'lucide-react'
import { getJSON } from '../lib/dataCache'
import { cardImg } from '../lib/img'
import { VenueShareCard, type VenuePlanCard } from '../components/VenueShareCard'
import { ShareCardModal } from '../components/ShareCardModal'
import type { Venue } from '../lib/espn'
import { PageCssGuard } from '../components/PageCssGuard'
import shareCss from '../pages/share.css?url'

export const Route = createFileRoute('/venue-plan')({
  // Coerce to string: TanStack parses a numeric ?id=209 into a number, which a
  // string check would drop (same gotcha venue.tsx documents).
  validateSearch: (s: Record<string, unknown>) => ({ id: s.id != null ? String(s.id) : '' }),
  head: () => ({
    links: [
      // 'build agenda venue-plan': must match agenda.tsx's tag — TanStack dedupes
      // by href and only one link (with one tag) survives across the routes.
      { rel: 'stylesheet', href: shareCss, 'data-page-css': 'build agenda venue-plan' },
    ],
    meta: [{ title: 'Snapback · Venue Plan' }],
  }),
  component: VenuePlanPage,
})

// Builder sections. `tipSection` maps each one onto the venue tip/expert-note
// section (WhatToKnow's keys) that feeds its quick-picks; 'after' has no tip
// source and stays free-type only. 'atmosphere' is deliberately unmapped —
// it describes the venue, it isn't something you *do*.
const SECTIONS = [
  { key: 'get', label: 'Getting there', card: 'Getting there', ph: "How you're getting in…", tipSection: 'getting-there' },
  { key: 'before', label: 'Before you go in', card: 'Before', ph: 'Bars, tailgates, pregame stops…', tipSection: 'before' },
  { key: 'seats', label: 'Seats & sights', card: 'Seats & sights', ph: "Where you're sitting, what you have to see…", tipSection: 'best-seats' },
  { key: 'eat', label: 'Food & drink', card: 'Eat & drink', ph: "What you're eating and where…", tipSection: 'food' },
  { key: 'moves', label: 'Insider moves', card: 'Insider move', ph: "The regulars-only stuff you're trying…", tipSection: 'tips' },
  { key: 'after', label: 'Afterwards', card: 'After', ph: "Where you're heading after…", tipSection: null },
] as const
type SectionKey = (typeof SECTIONS)[number]['key']

type PlanItem = { id: string; text: string; sourceId?: string; by?: string }
type PlanState = Record<SectionKey, PlanItem[]>
const blank = (): PlanState => ({ get: [], before: [], seats: [], eat: [], moves: [], after: [] })
const saveKey = (id: string) => 'sbx-venue-plan:' + id

// Tips run to 500 chars; the card's Anton name tier needs plan-length lines.
const MAXLEN = 120
const clip = (s: string) => { const t = s.trim().replace(/\s+/g, ' '); return t.length > MAXLEN ? t.slice(0, MAXLEN - 1).trimEnd() + '…' : t }

// A tappable suggestion: an expert note ('note:<id>') or a fan tip ('tip:<id>').
type Suggestion = { id: string; text: string; by: string; expert: boolean; net: number }

function VenuePlanPage() {
  const { id } = Route.useSearch()
  const navigate = useNavigate()
  const [venues, setVenues] = useState<Venue[] | null>(null)

  useEffect(() => {
    getJSON('/api/venues').then((r: any) => setVenues(Array.isArray(r?.data) ? r.data : [])).catch(() => setVenues([]))
  }, [])

  const v = venues ? venues.find((x) => x.id === id) : null

  return (
    <>
      <PageCssGuard id="venue-plan" />
      <main className="min-h-dvh bg-[#f4f4f1] text-[#161616] mx-auto pt-[18px] px-[clamp(18px,4vw,72px)] pb-[64px]">
        <header className="flex items-center justify-between gap-[14px] mb-[20px]">
          <Link to="/" className="flex items-center gap-[12px] font-display uppercase text-[19px] leading-[1.04] tracking-[.5px] text-[#111]" aria-label="Snapback home" style={{ textDecoration: 'none', color: 'inherit' }}><img className="w-[44px] h-[44px] rounded-[9px] shadow-[3px_3px_0_#111]" src="/img/logo.png" alt="" /><span>Snapback<br />Venue plan</span></Link>
          {v ? <button className="bg-none border-0 font-extrabold uppercase tracking-[.5px] text-[12.5px] text-[#111] cursor-pointer px-[2px] py-[6px]" onClick={() => navigate({ to: '/venue-plan', search: { id: '' } })}>← Change venue</button> : null}
        </header>
        {!venues ? <div className="py-[70px] text-center text-[#8a8a8a] font-bold">Loading…</div>
          : v ? <Editor key={v.id} v={v} />
            : <Picker venues={venues} onPick={(vid) => navigate({ to: '/venue-plan', search: { id: vid } })} />}
      </main>
    </>
  )
}

function Picker({ venues, onPick }: { venues: Venue[]; onPick: (id: string) => void }) {
  const [q, setQ] = useState('')
  const ql = q.trim().toLowerCase()
  const list = useMemo(
    () => venues.filter((x) => !ql || (x.name + ' ' + (x.city || '') + ' ' + (x.state || '') + ' ' + x.teams.map((t) => t.displayName).join(' ')).toLowerCase().includes(ql)),
    [venues, ql],
  )
  return (
    <div>
      <h1 className="font-display text-[clamp(30px,6vw,46px)] tracking-[.5px] text-[#111] mt-[2px] mb-[4px] uppercase">Plan your venue visit</h1>
      <div className="text-[#777] font-semibold mb-[18px]">Pick the venue, then stack up what you're doing there. It saves automatically.</div>
      <div className="search mb-[16px] max-w-[540px]"><SearchIcon className="si" /><input type="search" placeholder="Search venue, city or team…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="bld-venues">
        {list.map((x) => (
          <button key={x.id} className="bld-venue" onClick={() => onPick(x.id)}>
            {x.image ? <img className="bld-vthumb" src={cardImg(x.image)} alt="" loading="lazy" /> : <div className="bld-vthumb" />}
            <div className="bld-vn">{x.name}</div>
            <div className="bld-vc">{[x.city, x.state].filter(Boolean).join(', ')}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

function Editor({ v }: { v: Venue }) {
  const loadSaved = (): PlanState => {
    try {
      const s = localStorage.getItem(saveKey(v.id))
      if (!s) return blank()
      const parsed = JSON.parse(s)
      const out = blank()
      for (const k of Object.keys(out) as SectionKey[]) {
        if (Array.isArray(parsed?.[k])) out[k] = parsed[k].filter((it: any) => it && typeof it.id === 'string' && typeof it.text === 'string')
      }
      return out
    } catch { return blank() }
  }
  const [items, setItems] = useState<PlanState>(loadSaved)
  const [drafts, setDrafts] = useState<Record<SectionKey, string>>({ get: '', before: '', seats: '', eat: '', moves: '', after: '' })
  const [picks, setPicks] = useState<Record<string, Suggestion[]>>({}) // keyed by tipSection
  const [fmt, setFmt] = useState<'story' | 'square'>('story')
  // null = idle; when set, ShareCardModal renders the card offscreen and drives
  // the native sheet / copy / download — same flow as the rankings share.
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    try { localStorage.setItem(saveKey(v.id), JSON.stringify(items)) } catch { /* ignore */ }
  }, [items, v.id])

  // Quick-picks: this venue's expert notes + fan tips, grouped by tip section.
  // Raw fetch, not getJSON — tips are no-store and vote counts move (same call
  // WhatToKnow/ExpertNotes make). Expert notes lead; tips follow by verified,
  // then net votes (the API returns newest-first); capped at 4 per section so
  // the column stays scannable.
  useEffect(() => {
    let alive = true
    const grab = (url: string) => fetch(url).then((r) => r.json()).then((j) => (j?.ok && Array.isArray(j.data) ? j.data : [])).catch(() => [])
    Promise.all([
      grab('/api/expert-notes?scope=venue&targetId=' + encodeURIComponent(v.id)),
      grab('/api/tips?scope=venue&targetId=' + encodeURIComponent(v.id)),
    ]).then(([notes, tips]) => {
      if (!alive) return
      const bySec: Record<string, Suggestion[]> = {}
      for (const n of notes) (bySec[n.section] ||= []).push({ id: 'note:' + n.id, text: n.body, by: 'Snapback', expert: true, net: 0 })
      const ranked = [...tips].sort((a, b) =>
        (Number(!!b.verified) - Number(!!a.verified)) || ((b.up - b.down) - (a.up - a.down)) || String(b.createdAt).localeCompare(String(a.createdAt)))
      for (const t of ranked) (bySec[t.section] ||= []).push({ id: 'tip:' + t.id, text: t.body, by: '@' + t.author, expert: false, net: t.up - t.down })
      for (const k of Object.keys(bySec)) bySec[k] = bySec[k].slice(0, 4)
      setPicks(bySec)
    })
    return () => { alive = false }
  }, [v.id])

  const removeItem = (k: SectionKey, itemId: string) => setItems((p) => ({ ...p, [k]: p[k].filter((x) => x.id !== itemId) }))
  const editItem = (k: SectionKey, itemId: string, text: string) => setItems((p) => ({ ...p, [k]: p[k].map((x) => (x.id === itemId ? { ...x, text } : x)) }))
  // Tap = toggle: a chip whose item is already on the plan removes it (dedup);
  // otherwise it lands as a normal editable item that remembers its source.
  const toggleSuggestion = (k: SectionKey, s: Suggestion) => setItems((p) => {
    const list = p[k]
    return list.some((x) => x.sourceId === s.id)
      ? { ...p, [k]: list.filter((x) => x.sourceId !== s.id) }
      : { ...p, [k]: [...list, { id: crypto.randomUUID(), text: clip(s.text), sourceId: s.id, by: s.by }] }
  })
  const commitDraft = (k: SectionKey) => {
    const t = clip(drafts[k])
    if (!t) return
    setItems((p) => ({ ...p, [k]: [...p[k], { id: crypto.randomUUID(), text: t }] }))
    setDrafts((p) => ({ ...p, [k]: '' }))
  }

  const plan: VenuePlanCard = {
    venueName: v.name,
    city: [v.city, v.state].filter(Boolean).join(', '),
    steps: SECTIONS.flatMap((s) => items[s.key].map((it) => ({ label: s.card, name: it.text, by: it.by ? 'via ' + it.by : undefined }))),
  }
  const anyFilled = plan.steps.length > 0

  return (
    <div className="grid grid-cols-1 gap-[24px] min-[900px]:grid-cols-[1fr_400px] min-[900px]:items-start">
      <div>
        <div className="font-display text-[clamp(22px,5vw,30px)] text-[#111] tracking-[.4px] uppercase">{v.name}</div>
        <div className="text-[13px] font-bold uppercase tracking-[.4px] text-[#999] mt-[4px] mb-[18px]">{[v.city, v.state].filter(Boolean).join(', ')}{v.teams.length ? ' · ' + v.teams.map((t) => t.displayName).join(' · ') : ''}</div>
        {SECTIONS.map((s) => {
          const sugs = s.tipSection ? picks[s.tipSection] || [] : []
          return (
            <div key={s.key} className="mb-[22px]">
              <span className="block text-[12px] font-extrabold uppercase tracking-[.7px] text-[#9a7e00] mb-[7px]">{s.label}</span>
              {items[s.key].length ? (
                <div className="grid gap-[8px] mb-[8px]">
                  {items[s.key].map((it) => (
                    <div key={it.id} className="flex items-center gap-[8px]">
                      <input className="w-full flex-1 font-sans text-[15.5px] font-semibold leading-[1.4] text-[#111] bg-white border-2 border-[#e4e4de] rounded-[10px] px-[13px] py-[10px] shadow-[0_6px_18px_rgba(0,0,0,0.05)] placeholder:text-[#b3b3ac] placeholder:font-medium focus:outline-0 focus:border-[#111]" maxLength={MAXLEN} value={it.text} onChange={(e) => editItem(s.key, it.id, e.target.value)} />
                      <button className="flex-none w-[36px] h-[36px] border-0 rounded-[8px] bg-[#eceae2] text-[#666] text-[17px] font-extrabold leading-none cursor-pointer hover:bg-[#111] hover:text-white" aria-label="Remove" title="Remove" onClick={() => removeItem(s.key, it.id)}>×</button>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="flex gap-[8px]">
                <input
                  className="w-full flex-1 font-sans text-[15.5px] font-semibold leading-[1.4] text-[#111] bg-white border-2 border-[#e4e4de] rounded-[10px] px-[13px] py-[10px] shadow-[0_6px_18px_rgba(0,0,0,0.05)] placeholder:text-[#b3b3ac] placeholder:font-medium focus:outline-0 focus:border-[#111]" maxLength={MAXLEN} placeholder={s.ph} value={drafts[s.key]}
                  onChange={(e) => setDrafts((p) => ({ ...p, [s.key]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitDraft(s.key) }}
                />
                <button className="flex-none font-display uppercase tracking-[.5px] text-[13px] text-[#111] bg-[#F7DF02] border-0 rounded-[8px] px-[16px] cursor-pointer disabled:opacity-[.45] disabled:cursor-default" disabled={!drafts[s.key].trim()} onClick={() => commitDraft(s.key)}>Add</button>
              </div>
              {sugs.length ? (
                <>
                  <div className="text-[10.5px] font-extrabold uppercase tracking-[.5px] text-[#b3b3ac] mt-[11px]">From the fans — tap to add</div>
                  <div className="flex flex-wrap gap-[7px] mt-[7px]">
                    {sugs.map((sg) => {
                      const on = items[s.key].some((x) => x.sourceId === sg.id)
                      return (
                        <button key={sg.id} className={'inline-flex items-center gap-[8px] max-w-full text-left font-[inherit] text-[12.5px] font-semibold leading-[1.3] text-[#333] border rounded-[18px] px-[12px] py-[6px] cursor-pointer transition-[border-color,background] duration-[.12s] hover:border-[#caa600] ' + (on ? 'bg-[#fff3b0] border-[#ecd96b]' : 'bg-white border-[#e2e0d6]')} title={sg.text} onClick={() => toggleSuggestion(s.key, sg)}>
                          <span className="flex-none font-extrabold text-[#111]">{on ? '✓' : '+'}</span>
                          <span className="overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">{sg.text}</span>
                          <span className="flex-none text-[#9a7e00] font-extrabold text-[10.5px] uppercase tracking-[.3px] whitespace-nowrap">{sg.by}{!sg.expert && sg.net > 0 ? ' · ▲' + sg.net : ''}</span>
                        </button>
                      )
                    })}
                  </div>
                </>
              ) : null}
            </div>
          )
        })}
        <div className="text-[12px] text-[#9a9a9a] font-semibold mt-[4px]">Saved automatically on this device.</div>
      </div>

      <div className="sticky top-[16px] flex flex-col items-center max-[900px]:static">
        <div className="bld-tabs mb-[12px]">
          <button className={'bld-tab' + (fmt === 'story' ? ' on' : '')} onClick={() => setFmt('story')}>Story · 9:16</button>
          <button className={'bld-tab' + (fmt === 'square' ? ' on' : '')} onClick={() => setFmt('square')}>Square · 1:1</button>
        </div>
        <div className="sb-pvbox">
          <div className="sb-pvcap">{fmt === 'story' ? 'Story · 9:16' : 'Square · 1:1'}</div>
          <div className={fmt === 'story' ? 'sb-scale-story' : 'sb-scale-square'}><VenueShareCard plan={plan} format={fmt} /></div>
        </div>
        <div className="flex gap-[12px] mt-[16px] justify-center">
          <button className="sb-btn dark disabled:opacity-[.45] disabled:cursor-not-allowed" disabled={!anyFilled} onClick={() => setSharing(true)}>Share</button>
        </div>
      </div>

      {sharing ? (
        <ShareCardModal
          filename={`snapback-venue-plan-${v.id}-${fmt}.png`}
          title="Snapback venue plan"
          // The card stays neutral — the ask ("is this right?") travels as the caption.
          text={`My ${v.name} plan — is this the right things to do here?`}
          size={{ width: 1080, height: fmt === 'story' ? 1920 : 1080 }}
          onClose={() => setSharing(false)}
        >
          <VenueShareCard plan={plan} format={fmt} />
        </ShareCardModal>
      ) : null}
    </div>
  )
}
