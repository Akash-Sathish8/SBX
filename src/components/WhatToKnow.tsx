import { useEffect, useMemo, useState } from 'react'
import { useAuth } from './auth/AuthProvider'

// Crowdsourced "what do I need to know?" layer — the Letterboxd-for-sports core.
// Real fan tips per section, stored in D1 (/api/tips) and shown to everyone.
// Writing is auth-gated; sections with no tips stay HONESTLY empty — nothing here
// is ever fabricated.

type Section = { key: string; label: string; hint: string }

const VENUE_SECTIONS: Section[] = [
  { key: 'getting-there', label: 'Getting there', hint: 'Transit, parking, rideshare — what actually works on gameday.' },
  { key: 'best-seats', label: 'Best seats', hint: 'Where the view, the shade, or the atmosphere is best.' },
  { key: 'food', label: 'Best food', hint: 'The must-get item — and exactly where to find it.' },
  { key: 'before', label: 'Before the game', hint: 'Bars, tailgates and pregame spots nearby.' },
  { key: 'atmosphere', label: 'Atmosphere', hint: 'What the crowd and the gameday feel are really like.' },
  { key: 'tips', label: 'Insider tips', hint: 'The stuff only regulars know.' },
]

const EVENT_SECTIONS: Section[] = [
  { key: 'getting-there', label: 'Getting there', hint: 'How to arrive — and when to show up.' },
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

export function WhatToKnow({ scope, targetId }: { scope: 'venue' | 'event'; targetId: string }) {
  const sections = scope === 'venue' ? VENUE_SECTIONS : EVENT_SECTIONS
  const { user, openAuth } = useAuth()
  const [tips, setTips] = useState<Tip[]>([])
  const [open, setOpen] = useState<string | null>(null) // section key with the composer open
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Load tips for this target (client-only; re-runs if the target changes).
  useEffect(() => {
    if (!targetId) return
    let alive = true
    setTips([])
    fetch('/api/tips?scope=' + scope + '&targetId=' + encodeURIComponent(targetId))
      .then((r) => r.json())
      .then((j) => { if (alive && j?.ok && Array.isArray(j.data)) setTips(j.data) })
      .catch(() => {})
    return () => { alive = false }
  }, [scope, targetId])

  // Group each author's tips within a section into ONE card. Verified voices
  // (Snapback, Jack Settleman) lead each section; the rest follow by recency.
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
    for (const k in out) out[k].sort((a, b) => (b.verified ? 1 : 0) - (a.verified ? 1 : 0) || (b.latest < a.latest ? -1 : 1))
    return out
  }, [tips])

  const startAdd = (key: string) => {
    if (!user) { openAuth('signin'); return }
    setErr(null); setDraft(''); setOpen(key)
  }

  const submit = async (key: string) => {
    const text = draft.trim()
    if (!text || busy) return
    setBusy(true); setErr(null)
    try {
      const r = await fetch('/api/tips', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scope, targetId, section: key, body: text }),
      })
      const j = await r.json().catch(() => ({}))
      if (r.ok && j?.ok && Array.isArray(j.data)) { setTips(j.data); setOpen(null); setDraft('') }
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

  return (
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
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="wtk-empty"><span className="wtk-dot" /> No tips yet — be the first.</div>
            )}

            {open === s.key ? (
              <div className="wtk-form">
                <textarea
                  className="wtk-textarea" rows={3} maxLength={500} autoFocus
                  placeholder={s.hint} value={draft} onChange={(e) => setDraft(e.target.value)}
                />
                {err ? <div className="wtk-err">{err}</div> : null}
                <div className="wtk-formrow">
                  <button className="wtk-cancel" onClick={() => { setOpen(null); setErr(null) }}>Cancel</button>
                  <button className="wtk-post" disabled={busy || !draft.trim()} onClick={() => submit(s.key)}>
                    {busy ? 'Posting…' : 'Post tip'}
                  </button>
                </div>
              </div>
            ) : (
              <button className="wtk-add" onClick={() => startAdd(s.key)}>
                {user ? '+ Add a tip' : '+ Sign in to add a tip'}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
