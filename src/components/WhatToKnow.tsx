import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { photosForAuthor, type FieldPhoto } from '../lib/fieldPhotos'
import { PhotoLightbox } from './PhotoLightbox'
import { useAuth } from './auth/AuthProvider'

// Crowdsourced "what do I need to know?" layer — the Letterboxd-for-sports core.
// Real fan tips per section, stored in D1 (/api/tips) and shown to everyone.
// Writing is auth-gated; sections with no tips stay HONESTLY empty — nothing here
// is ever fabricated.

type Section = { key: string; label: string; hint: string }

// Card order follows the review-redesign mockup: the marquee categories (Best
// Seats, Best Food) lead the 2-up grid.
const VENUE_SECTIONS: Section[] = [
  { key: 'best-seats', label: 'Best seats', hint: 'Where the view, the shade, or the atmosphere is best.' },
  { key: 'food', label: 'Best food', hint: 'The must-get item, and exactly where to find it.' },
  { key: 'getting-there', label: 'Getting there', hint: 'Transit, parking, rideshare. What actually works on gameday.' },
  { key: 'before', label: 'Before the game', hint: 'Bars, tailgates and pregame spots nearby.' },
  { key: 'atmosphere', label: 'Atmosphere', hint: 'What the crowd and the gameday feel are really like.' },
  { key: 'tips', label: 'Insider tips', hint: 'The stuff only regulars know.' },
]

const EVENT_SECTIONS: Section[] = [
  { key: 'best-seats', label: 'Best seats for this one', hint: 'Sun, shade, sightlines and where the energy is.' },
  { key: 'getting-there', label: 'Getting there', hint: 'How to arrive, and when to show up.' },
  { key: 'before', label: 'Before the game', hint: 'Where to be beforehand.' },
  { key: 'tips', label: 'Insider tips', hint: "What you'd tell a friend going to this game." },
]

interface Tip {
  id: string
  section: string
  author: string
  avatar?: string | null
  body: string
  createdAt: string
  up: number
  down: number
  myVote: number // 1 | -1 | 0 — the caller's standing vote (works signed-out)
  mine: boolean
  official?: boolean
  verified?: boolean
}

// A distinct contributor, for the header/footer avatar stacks.
interface AuthorChip { author: string; avatar?: string | null; verified: boolean }

// "Pinned" has no DB column — a tip from a verified/official voice (Snapback,
// Jack Settleman) is the pinned one: it sorts first and wears the badge.
const isPinned = (t: Tip) => !!(t.verified || t.official)
const net = (t: Tip) => t.up - t.down

// Distinct contributors in display order, verified voices first (for the
// "N fans" count and the overlapping avatar stacks).
function uniqueAuthors(list: Tip[]): AuthorChip[] {
  const seen = new Map<string, AuthorChip>()
  for (const t of list) {
    const key = (t.verified ? 'v:' : 'u:') + t.author
    if (!seen.has(key)) seen.set(key, { author: t.author, avatar: t.avatar ?? null, verified: !!t.verified })
  }
  return [...seen.values()].sort((a, b) => (b.verified ? 1 : 0) - (a.verified ? 1 : 0))
}

// When binding a photo to a tip, prefer one whose field-report category fits the
// section (a seats tip shows a seat view, a food tip shows food) before falling back
// to any of that author's photos. Keys are the FieldPhoto.category values.
const SECTION_PHOTO_CATEGORY: Record<string, string> = {
  'best-seats': 'Views',
  'food': 'Food',
  'getting-there': 'Stadium',
  'before': 'Lounges',
  'atmosphere': 'Stadium',
  'tips': 'Stadium',
}

// Non-verified fans get a stable initials bubble in one of the mockup's hues
// (production stores no per-author color, so derive one from the name — purely
// decorative and deterministic).
const AV_COLORS = ['#c0392b', '#2b6cb0', '#6b46c1', '#b7791f', '#2f855a', '#c53030', '#285e61', '#97266d', '#4a5568', '#9c4221', '#1a365d', '#702459', '#22543d']
function hashHue(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return AV_COLORS[h % AV_COLORS.length]
}
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// One avatar for the stacks and tip meta rows. Verified voices show their logo;
// everyone else shows initials on their derived hue. Inline width/height beat the
// unlayered global `img{height:auto}` (see CLAUDE.md) without needing `!`.
function avatarEl(idKey: string, author: string, avatar: string | null | undefined, verified: boolean, size: number, font: number, className: string) {
  const style = { width: size, height: size }
  if (verified) {
    return <img key={idKey} className={cn('block flex-none rounded-full object-cover', className)} style={style} src={avatar || '/img/logo.png'} alt="" />
  }
  return <span key={idKey} className={cn('inline-flex flex-none items-center justify-center rounded-full font-extrabold text-white', className)} style={{ ...style, background: hashHue(author), fontSize: font }}>{initials(author)}</span>
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime()
  if (isNaN(t)) return ''
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return m + 'm ago'
  const h = Math.floor(m / 60); if (h < 24) return h + 'h ago'
  const d = Math.floor(h / 24); if (d < 30) return d + 'd ago'
  const mo = Math.floor(d / 30); if (mo < 12) return mo + 'mo ago'
  return Math.floor(mo / 12) + 'y ago'
}

// Compact vote-pill arrow (the legacy .rvw-vote in its .wtkv variant): quiet
// until pressed — yellow up, red-washed down. The `on` state must also pin the
// hover colors so a pressed arrow doesn't flicker.
const voteBtnCls = (on: boolean, dir: 'up' | 'down') => cn(
  'h-auto cursor-pointer rounded-none px-[9px] py-1 font-sans text-[10px] leading-none font-extrabold text-[#9a9a90] transition-[background-color,color] duration-[120ms] hover:bg-[rgba(20,20,20,.06)] hover:text-[#141414]',
  on && dir === 'up' && 'bg-brand text-[#141414] hover:bg-brand hover:text-[#141414]',
  on && dir === 'down' && 'bg-[rgba(226,72,61,.14)] text-danger hover:bg-[rgba(226,72,61,.14)] hover:text-danger',
)

// The single "+ add a tip" control, rendered ONCE on the section header row
// (right of "What do I need to know?"), not per card. Signed out it opens the
// auth modal; signed in it opens the composer (see WhatToKnow composerOpen).
export function AddTipButton({ onOpen }: { onOpen: () => void }) {
  const { user, openAuth } = useAuth()
  return (
    <Button
      variant="ghost"
      className="h-auto cursor-pointer rounded-full bg-[#141414] px-6 py-3 font-sans text-[13px] font-extrabold tracking-[.5px] whitespace-nowrap text-white uppercase [line-height:normal] hover:bg-black hover:text-white"
      onClick={() => (user ? onOpen() : openAuth('signin'))}
    >
      {user ? '+ Add a tip' : '+ Sign in to add a tip'}
    </Button>
  )
}

export function WhatToKnow({
  scope, targetId, composerOpen = false, onComposerClose, cancelLabel = 'Cancel',
}: {
  scope: 'venue' | 'event'
  targetId: string
  composerOpen?: boolean
  onComposerClose?: () => void
  cancelLabel?: string // "Skip" on the post-rank handoff
}) {
  const { user } = useAuth()
  const sections = scope === 'venue' ? VENUE_SECTIONS : EVENT_SECTIONS
  const [tips, setTips] = useState<Tip[]>([])
  const [sec, setSec] = useState(sections[0].key) // composer's target section
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // Which section cards have their "+N more" overflow revealed (keyed by section).
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  // Open photo viewer for a tapped tip thumbnail (paged across that author's set).
  const [lbx, setLbx] = useState<{ photos: FieldPhoto[]; index: number; credit: string } | null>(null)

  // Fresh composer every time it opens.
  useEffect(() => {
    if (composerOpen) { setDraft(''); setErr(null); setSec(sections[0].key) }
  }, [composerOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load tips for this target (client-only; re-runs if the target changes, and
  // on auth change — `mine` and `myVote` depend on who's asking).
  useEffect(() => {
    if (!targetId) return
    let alive = true
    fetch('/api/tips?scope=' + scope + '&targetId=' + encodeURIComponent(targetId))
      .then((r) => r.json())
      .then((j) => { if (alive && j?.ok && Array.isArray(j.data)) setTips(j.data) })
      .catch(() => {})
    return () => { alive = false }
  }, [scope, targetId, user?.id])

  // Tips render individually now, sorted pinned/verified-first, then by net score
  // (ups minus downs), then recency. Votes mutate `tips` optimistically, so the
  // order reshuffles live as arrows are pressed. Alongside, bind a best-effort
  // photo to each tip: the author's field-report photos for this venue (the only
  // photo source we have — no per-tip column), a per-author cursor handing each of
  // an author's tips a distinct frame. Almost every venue/event has none → the tip
  // renders text-only. Never fabricated.
  const { bySection, photoOf, pinnedIds } = useMemo(() => {
    const out: Record<string, Tip[]> = {}
    for (const t of tips) (out[t.section] ||= []).push(t)
    const photoOf: Record<string, FieldPhoto | null> = {}
    // One pinned tip per section: the top verified/official voice (by net votes).
    // Everyone else — including that voice's other tips — sorts by votes.
    const pinnedIds = new Set<string>()
    for (const k in out) {
      let lead: Tip | null = null
      for (const t of out[k]) {
        if (!isPinned(t)) continue
        if (!lead || net(t) > net(lead) || (net(t) === net(lead) && t.createdAt > lead.createdAt)) lead = t
      }
      if (lead) pinnedIds.add(lead.id)
      out[k].sort((a, b) =>
        (pinnedIds.has(b.id) ? 1 : 0) - (pinnedIds.has(a.id) ? 1 : 0) ||
        net(b) - net(a) ||
        (b.createdAt < a.createdAt ? -1 : 1))
      // Per author in this section, a queue of their photos with section-matching
      // categories first; shift one off per tip so each of an author's tips gets a
      // distinct, on-topic frame.
      const want = SECTION_PHOTO_CATEGORY[k]
      const queue: Record<string, FieldPhoto[]> = {}
      for (const t of out[k]) {
        const ps = photosForAuthor(scope, targetId, t.author)
        if (!ps?.length) { photoOf[t.id] = null; continue }
        const q = (queue[t.author] ||= [...ps.filter((p) => p.category === want), ...ps.filter((p) => p.category !== want)])
        photoOf[t.id] = q.shift() ?? ps[0]
      }
    }
    return { bySection: out, photoOf, pinnedIds }
  }, [tips, scope, targetId])

  const submit = async () => {
    const text = draft.trim()
    if (!text || busy) return
    setBusy(true); setErr(null)
    try {
      const r = await fetch('/api/tips', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scope, targetId, section: sec, body: text }),
      })
      const j = await r.json().catch(() => ({}))
      if (r.ok && j?.ok && Array.isArray(j.data)) { setTips(j.data); setDraft(''); onComposerClose?.() }
      else setErr(j?.error || 'Could not post your tip.')
    } catch {
      setErr('Network error. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const remove = (t: Tip) => {
    setTips((prev) => prev.filter((x) => x.id !== t.id)) // optimistic
    fetch('/api/tips?id=' + encodeURIComponent(t.id) + '&scope=' + scope + '&targetId=' + encodeURIComponent(targetId), { method: 'DELETE' })
      .then((r) => r.json())
      .then((j) => { if (j?.ok && Array.isArray(j.data)) setTips(j.data) })
      .catch(() => {})
  }

  // Up/down vote on a tip: same press toggles off, the other flips. Works
  // signed-out (the server keys anonymous votes on a device cookie).
  // Optimistic counts, reconciled from the server response.
  const vote = (t: Tip, dir: 1 | -1) => {
    const next = t.myVote === dir ? 0 : dir
    const apply = (x: Tip, up: number, down: number, myVote: number) => ({ ...x, up, down, myVote })
    setTips((prev) => prev.map((x) => x.id !== t.id ? x : apply(x,
      x.up + (next === 1 ? 1 : 0) - (x.myVote === 1 ? 1 : 0),
      x.down + (next === -1 ? 1 : 0) - (x.myVote === -1 ? 1 : 0),
      next,
    )))
    fetch('/api/tip-votes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tipId: t.id, vote: next }),
    })
      .then((r) => r.json())
      .then((j) => {
        setTips((prev) => prev.map((x) => x.id !== t.id ? x
          : j?.ok && j.data ? apply(x, j.data.up, j.data.down, j.data.myVote)
            : apply(x, t.up, t.down, t.myVote))) // failed — put the old counts back
      })
      .catch(() => {
        setTips((prev) => prev.map((x) => (x.id !== t.id ? x : apply(x, t.up, t.down, t.myVote))))
      })
  }

  // One tip as a "media object": the author's bound photo (when there is one) on
  // the left, their words + attribution + vote pill on the right. No photo → a
  // clean full-width text row (the mockup's .nophoto state).
  const renderTip = (t: Tip) => {
    const photo = photoOf[t.id]
    const pinned = pinnedIds.has(t.id)
    return (
      <div
        key={t.id}
        className={cn(
          'grid items-start gap-4 border-t border-dashed border-[#e0ddcf] py-4 first:border-t-0',
          photo ? 'grid-cols-[112px_1fr]' : 'grid-cols-[1fr]',
        )}
      >
        {photo ? (
          <button
            type="button"
            className="group relative block aspect-[4/3] cursor-pointer overflow-hidden rounded-[9px] border-2 border-ink p-0 shadow-punch"
            aria-label={'View photo: ' + photo.area}
            onClick={() => {
              const ps = photosForAuthor(scope, targetId, t.author)
              const i = Math.max(0, ps?.findIndex((x) => x.src === photo.src) ?? 0)
              setLbx({ photos: ps?.length ? ps : [photo], index: i, credit: t.author })
            }}
          >
            <img className="block h-full! w-full object-cover transition-transform duration-150 group-hover:scale-105" src={photo.src} alt={photo.area} loading="lazy" decoding="async" />
            <span className="absolute bottom-1.5 left-1.5 rounded-[3px] border-[1.5px] border-ink bg-brand px-1.5 py-[2px] font-sans text-[8px] font-extrabold tracking-[.5px] whitespace-nowrap text-ink uppercase">{photo.area}</span>
          </button>
        ) : null}
        <div className="min-w-0">
          <div className="mb-[5px] flex flex-wrap items-center gap-[7px]">
            {avatarEl(t.id, t.author, t.avatar, !!t.verified, 24, 9, 'border-[1.5px] border-ink')}
            <span className="text-[12px] font-extrabold tracking-[.2px] text-ink uppercase">{t.author}</span>
            {t.verified ? <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-ink text-[9px] leading-none font-black text-brand" title="Verified" aria-label="Verified">✓</span> : null}
            {pinned
              ? <span className="rounded-[4px] border border-[#e7dca0] bg-tip px-[5px] py-px text-[8.5px] font-extrabold tracking-[.5px] text-gold uppercase">Pinned</span>
              : <span className="text-[11px] font-semibold text-[#a3a091]">{timeAgo(t.createdAt)}</span>}
            {t.mine ? (
              <Button
                variant="ghost"
                className="ml-auto h-auto flex-none cursor-pointer rounded-none px-[2px] py-0 text-[17px] leading-none font-normal text-[#bbb] hover:bg-transparent hover:text-danger"
                aria-label="Delete tip" onClick={() => remove(t)}
              >×</Button>
            ) : null}
          </div>
          <div className="text-[14.5px] leading-[1.48] font-medium whitespace-pre-wrap text-[#2a2a2a] [overflow-wrap:anywhere]">{t.body}</div>
          <div className="mt-2 flex items-end gap-2.5">
            <span className="inline-flex max-w-max items-center self-start overflow-hidden rounded-full border-[1.5px] border-[rgba(20,20,20,.13)]">
              <Button
                type="button" variant="ghost" className={voteBtnCls(t.myVote === 1, 'up')}
                aria-label="Upvote tip" aria-pressed={t.myVote === 1} title="Helpful" onClick={() => vote(t, 1)}
              >▲</Button>
              <span className="min-w-4 px-[2px] text-center text-[11.5px] font-extrabold text-[#3a3a34]" title={t.up + ' up · ' + t.down + ' down'}>{t.up - t.down}</span>
              <Button
                type="button" variant="ghost" className={voteBtnCls(t.myVote === -1, 'down')}
                aria-label="Downvote tip" aria-pressed={t.myVote === -1} title="Not helpful" onClick={() => vote(t, -1)}
              >▼</Button>
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="font-sans [line-height:normal]">
      {composerOpen ? (
        <div className="mt-2 mb-3.5 rounded-[10px] border-2 border-[#141414] bg-white px-4 py-3.5">
          <div className="mb-2.5">
            <NativeSelect
              className="h-auto cursor-pointer rounded-[8px] border-2 border-[#141414] bg-white py-2 pr-8 pl-2.5 font-sans text-[13px] font-bold text-[#141414] shadow-none [line-height:normal]"
              value={sec} onChange={(e) => setSec(e.target.value)} aria-label="Tip section"
            >
              {sections.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </NativeSelect>
          </div>
          <Textarea
            className="field-sizing-fixed min-h-0 w-full resize-y rounded-[8px] border-2 border-[#141414] bg-white px-[11px] py-[9px] font-sans text-[13.5px] font-medium text-[#141414] shadow-none [line-height:normal] focus-visible:border-[#caa800] focus-visible:ring-0 md:text-[13.5px]"
            rows={3} maxLength={500} autoFocus
            placeholder={sections.find((s) => s.key === sec)?.hint}
            value={draft} onChange={(e) => setDraft(e.target.value)}
          />
          {err ? <div className="mt-1.5 text-[12px] font-bold text-[#c0392b]">{err}</div> : null}
          <div className="mt-2 flex justify-end gap-2">
            <Button
              variant="ghost"
              className="h-auto cursor-pointer px-2.5 py-2 font-sans text-[12.5px] font-bold text-[#888] hover:bg-transparent hover:text-[#141414]"
              onClick={() => { setErr(null); onComposerClose?.() }}
            >{cancelLabel}</Button>
            <Button
              variant="brand"
              className="h-auto cursor-pointer rounded-[8px] px-4 py-[9px] font-sans text-[12.5px] tracking-[.4px] text-[#111]"
              disabled={busy || !draft.trim()} onClick={submit}
            >
              {busy ? 'Posting…' : 'Post tip'}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-2 grid grid-cols-2 gap-[30px] max-[860px]:grid-cols-1 max-[860px]:gap-6">
      {sections.map((s) => {
        const list = bySection[s.key] || []
        const authors = uniqueAuthors(list)
        const isExp = !!expanded[s.key]
        const shown = isExp ? list : list.slice(0, 3)
        const rest = list.slice(3)
        const restAuthors = uniqueAuthors(rest)
        return (
          <article key={s.key} className="flex flex-col overflow-hidden rounded-[16px] border-2 border-ink bg-cream shadow-punch-lg">
            <div className="flex items-center gap-[14px] px-[26px] pt-[20px] pb-1 max-[860px]:px-5">
              <h3 className="m-0 font-display text-[clamp(28px,3.2vw,38px)] leading-[.92] tracking-[.5px] text-ink uppercase">{s.label}</h3>
              <div className="ml-auto flex flex-col items-end gap-1.5">
                <span className="text-[11px] font-extrabold tracking-[.6px] text-muted uppercase">{list.length} {list.length === 1 ? 'tip' : 'tips'} · {authors.length} {authors.length === 1 ? 'fan' : 'fans'}</span>
                {authors.length ? (
                  <span className="flex pl-2">
                    {authors.slice(0, 5).map((a) => avatarEl((a.verified ? 'v:' : 'u:') + a.author, a.author, a.avatar, a.verified, 26, 9, '-ml-2 border-2 border-cream shadow-[0_0_0_1.5px_var(--color-ink)]'))}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex flex-1 flex-col px-[26px] pt-1.5 pb-[24px] max-[860px]:px-5">
              {list.length ? (
                <>
                  {shown.map(renderTip)}
                  {rest.length ? (
                    <div className="mt-auto border-t-[1.5px] border-ink pt-4">
                      <button
                        type="button"
                        onClick={() => setExpanded((p) => ({ ...p, [s.key]: !isExp }))}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-[#e7dca0] bg-tip px-3.5 py-[7px] font-sans text-[12px] font-extrabold tracking-[.5px] text-ink uppercase"
                      >
                        {isExp ? 'Show less ←' : (
                          <>
                            <span className="mr-0.5 inline-flex pl-1.5">
                              {restAuthors.slice(0, 4).map((a) => avatarEl((a.verified ? 'v:' : 'u:') + a.author, a.author, a.avatar, a.verified, 20, 7, '-ml-1.5 border-[1.5px] border-tip shadow-[0_0_0_1px_var(--color-ink)]'))}
                            </span>
                            +{rest.length} more {rest.length === 1 ? 'tip' : 'tips'} from fans →
                          </>
                        )}
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="flex items-center gap-2 border-t border-dashed border-[#ddd] pt-[11px] text-[12.5px] font-bold text-[#999]"><span className="h-[7px] w-[7px] flex-none rounded-full bg-brand" /> No tips yet. Be the first.</div>
              )}
            </div>
          </article>
        )
      })}
      </div>

      {lbx ? (
        <PhotoLightbox
          photos={lbx.photos}
          index={lbx.index}
          credit={lbx.credit}
          onIndex={(index) => setLbx({ ...lbx, index })}
          onClose={() => setLbx(null)}
        />
      ) : null}
    </div>
  )
}
