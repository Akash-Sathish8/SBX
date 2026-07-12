import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useAuth } from './auth/AuthProvider'

// Crowdsourced "what do I need to know?" layer — the Letterboxd-for-sports core.
// Real fan tips per section, stored in D1 (/api/tips) and shown to everyone.
// Writing is auth-gated; sections with no tips stay HONESTLY empty — nothing here
// is ever fabricated.

type Section = { key: string; label: string; hint: string }

const VENUE_SECTIONS: Section[] = [
  { key: 'getting-there', label: 'Getting there', hint: 'Transit, parking, rideshare. What actually works on gameday.' },
  { key: 'best-seats', label: 'Best seats', hint: 'Where the view, the shade, or the atmosphere is best.' },
  { key: 'food', label: 'Best food', hint: 'The must-get item, and exactly where to find it.' },
  { key: 'before', label: 'Before the game', hint: 'Bars, tailgates and pregame spots nearby.' },
  { key: 'atmosphere', label: 'Atmosphere', hint: 'What the crowd and the gameday feel are really like.' },
  { key: 'tips', label: 'Insider tips', hint: 'The stuff only regulars know.' },
]

const EVENT_SECTIONS: Section[] = [
  { key: 'getting-there', label: 'Getting there', hint: 'How to arrive, and when to show up.' },
  { key: 'best-seats', label: 'Best seats for this one', hint: 'Sun, shade, sightlines and where the energy is.' },
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

// All of one author's tips in a section, collapsed into a single card.
interface TipGroup {
  author: string
  avatar?: string | null
  verified: boolean
  official: boolean
  latest: string
  tips: Tip[]
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

  // Group each author's tips within a section into ONE card, ordered by votes:
  // tips inside a card sort by net score (ups minus downs), and cards sort by
  // their best tip's net score. Votes update `tips` optimistically, so the
  // order reshuffles live as arrows are pressed. Ties: verified voices
  // (Snapback, Jack Settleman) first, then recency.
  const net = (t: Tip) => t.up - t.down
  const bySection = useMemo(() => {
    const out: Record<string, TipGroup[]> = {}
    for (const t of tips) {
      const groups = (out[t.section] ||= [])
      const key = (t.verified ? 'v:' : 'u:') + t.author
      let g = groups.find((x) => (x.verified ? 'v:' : 'u:') + x.author === key)
      if (!g) { g = { author: t.author, avatar: t.avatar ?? null, verified: !!t.verified, official: !!t.official, latest: t.createdAt, tips: [] }; groups.push(g) }
      g.tips.push(t)
      if (!g.avatar && t.avatar) g.avatar = t.avatar
      if (t.createdAt > g.latest) g.latest = t.createdAt
    }
    for (const k in out) {
      for (const g of out[k]) g.tips.sort((a, b) => net(b) - net(a) || (b.createdAt < a.createdAt ? -1 : 1))
      out[k].sort((a, b) =>
        net(b.tips[0]) - net(a.tips[0]) ||
        (b.verified ? 1 : 0) - (a.verified ? 1 : 0) ||
        (b.latest < a.latest ? -1 : 1))
    }
    return out
  }, [tips])

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

      <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5 [.wtk-layout_&]:mt-0 [.wtk-layout_&]:grid-cols-3 [.wtk-layout_&]:max-[980px]:grid-cols-2 [.wtk-layout_&]:max-[560px]:grid-cols-1">
      {sections.map((s) => {
        const list = bySection[s.key] || []
        return (
          <div key={s.key} className="rounded-[10px] border-2 border-[#141414] bg-white px-4 py-[15px]">
            <div className="font-display text-[19px] tracking-[.4px] text-[#141414] uppercase">{s.label}</div>
            <div className="mt-[5px] text-[13px] leading-[1.4] font-semibold text-[#666]">{s.hint}</div>

            {list.length ? (
              <div className="mt-3 flex max-h-[300px] flex-col gap-2.5 overflow-x-hidden overflow-y-auto overscroll-contain border-t border-dashed border-[#ddd] pt-[11px] pr-[5px] [scrollbar-color:#cdcdcd_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-[7px] [&::-webkit-scrollbar-thumb]:rounded-[4px] [&::-webkit-scrollbar-thumb]:bg-[#cdcdcd] [&::-webkit-scrollbar-track]:bg-transparent">
                {list.map((g) => (
                  <div
                    key={(g.verified ? 'v:' : 'u:') + g.author}
                    className={cn(
                      'relative rounded-[8px] border-[1.5px] border-[#e7dca0] bg-tip py-[9px] pr-[26px] pl-[11px]',
                      g.verified && 'border-[#141414] border-l-4 border-l-brand bg-white',
                    )}
                  >
                    <div className="mb-[3px] flex items-baseline gap-2">
                      {g.verified ? (
                        <span className="inline-flex items-center gap-1.5">
                          <img className="block h-5! w-5 self-center rounded-full border-[1.5px] border-[#141414] object-cover" src={g.avatar || '/img/logo.png'} alt="" width={20} height={20} />
                          <span className="text-[12px] font-extrabold tracking-[.3px] text-[#141414] uppercase">{g.author}</span>
                          <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#141414] text-[9px] leading-none font-black text-brand" title="Verified" aria-label="Verified">✓</span>
                        </span>
                      ) : (
                        <>
                          <span className="text-[12px] font-extrabold tracking-[.3px] text-[#141414] uppercase">{g.author}</span>
                          <span className="text-[11px] font-semibold text-[#9a9a9a]">{timeAgo(g.latest)}</span>
                        </>
                      )}
                    </div>
                    <div className="text-[13.5px] leading-[1.4] font-medium whitespace-pre-wrap text-[#2a2a2a] [overflow-wrap:anywhere]">
                      {g.tips.map((t) => (
                        <div key={t.id} className="flex flex-wrap items-start gap-2 [&:not(:first-child)]:mt-2 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-[rgba(20,20,20,.1)] [&:not(:first-child)]:pt-2">
                          <span className="min-w-0 flex-1">{t.body}</span>
                          {t.mine ? (
                            <Button
                              variant="ghost"
                              className="h-auto flex-none cursor-pointer self-start rounded-none px-[2px] py-0 text-[17px] leading-none font-normal text-[#bbb] hover:bg-transparent hover:text-danger"
                              aria-label="Delete tip" onClick={() => remove(t)}
                            >×</Button>
                          ) : null}
                          <span className="mt-[7px] inline-flex max-w-max flex-[0_0_100%] items-center self-start overflow-hidden rounded-full border-[1.5px] border-[rgba(20,20,20,.13)]">
                            <Button
                              type="button"
                              variant="ghost"
                              className={voteBtnCls(t.myVote === 1, 'up')}
                              aria-label="Upvote tip"
                              aria-pressed={t.myVote === 1}
                              title="Helpful"
                              onClick={() => vote(t, 1)}
                            >▲</Button>
                            <span className="min-w-4 px-[2px] text-center text-[11.5px] font-extrabold text-[#3a3a34]" title={t.up + ' up · ' + t.down + ' down'}>{t.up - t.down}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              className={voteBtnCls(t.myVote === -1, 'down')}
                              aria-label="Downvote tip"
                              aria-pressed={t.myVote === -1}
                              title="Not helpful"
                              onClick={() => vote(t, -1)}
                            >▼</Button>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2 border-t border-dashed border-[#ddd] pt-[11px] text-[12.5px] font-bold text-[#999]"><span className="h-[7px] w-[7px] flex-none rounded-full bg-brand" /> No tips yet. Be the first.</div>
            )}

          </div>
        )
      })}
      </div>
    </div>
  )
}
