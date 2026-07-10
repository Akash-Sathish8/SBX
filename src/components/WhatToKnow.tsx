import { useEffect, useMemo, useState } from 'react'
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

// The single "+ add a tip" control, rendered ONCE on the section header row
// (right of "What do I need to know?"), not per card. Signed out it opens the
// auth modal; signed in it opens the composer (see WhatToKnow composerOpen).
export function AddTipButton({ onOpen }: { onOpen: () => void }) {
  const { user, openAuth } = useAuth()
  return (
    <button className="wtk-addbar" onClick={() => (user ? onOpen() : openAuth('signin'))}>
      {user ? '+ Add a tip' : '+ Sign in to add a tip'}
    </button>
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
    <div className="wtk-wrap">
      {composerOpen ? (
        <div className="wtk-composer">
          <div className="wtk-composerrow">
            <select className="wtk-select" value={sec} onChange={(e) => setSec(e.target.value)} aria-label="Tip section">
              {sections.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <textarea
            className="wtk-textarea" rows={3} maxLength={500} autoFocus
            placeholder={sections.find((s) => s.key === sec)?.hint}
            value={draft} onChange={(e) => setDraft(e.target.value)}
          />
          {err ? <div className="wtk-err">{err}</div> : null}
          <div className="wtk-formrow">
            <button className="wtk-cancel" onClick={() => { setErr(null); onComposerClose?.() }}>{cancelLabel}</button>
            <button className="wtk-post" disabled={busy || !draft.trim()} onClick={submit}>
              {busy ? 'Posting…' : 'Post tip'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="wtk">
      {sections.map((s) => {
        const list = bySection[s.key] || []
        return (
          <div key={s.key} className="wtk-card">
            <div className="wtk-h">{s.label}</div>
            <div className="wtk-hint">{s.hint}</div>

            {list.length ? (
              <div className="wtk-tips">
                {list.map((g) => (
                  <div key={(g.verified ? 'v:' : 'u:') + g.author} className={'wtk-tip' + (g.verified ? ' official' : '')}>
                    <div className="wtk-tipmeta">
                      {g.verified ? (
                        <span className="wtk-official">
                          <img className="wtk-offlogo" src={g.avatar || '/img/logo.png'} alt="" width={20} height={20} />
                          <span className="wtk-offname">{g.author}</span>
                          <span className="wtk-offbadge" title="Verified" aria-label="Verified">✓</span>
                        </span>
                      ) : (
                        <>
                          <span className="wtk-tipauthor">{g.author}</span>
                          <span className="wtk-tipago">{timeAgo(g.latest)}</span>
                        </>
                      )}
                    </div>
                    <div className="wtk-tipbody">
                      {g.tips.map((t) => (
                        <div key={t.id} className="wtk-tipline">
                          <span>{t.body}</span>
                          {t.mine ? <button className="wtk-tipdel inline" aria-label="Delete tip" onClick={() => remove(t)}>×</button> : null}
                          <span className="rvw-votes wtkv">
                            <button
                              type="button"
                              className={'rvw-vote up' + (t.myVote === 1 ? ' on' : '')}
                              aria-label="Upvote tip"
                              aria-pressed={t.myVote === 1}
                              title="Helpful"
                              onClick={() => vote(t, 1)}
                            >▲</button>
                            <span className="rvw-net num" title={t.up + ' up · ' + t.down + ' down'}>{t.up - t.down}</span>
                            <button
                              type="button"
                              className={'rvw-vote down' + (t.myVote === -1 ? ' on' : '')}
                              aria-label="Downvote tip"
                              aria-pressed={t.myVote === -1}
                              title="Not helpful"
                              onClick={() => vote(t, -1)}
                            >▼</button>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="wtk-empty"><span className="wtk-dot" /> No tips yet. Be the first.</div>
            )}

          </div>
        )
      })}
      </div>
    </div>
  )
}
