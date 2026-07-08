import { useEffect, useState } from 'react'
import { useAuth } from './auth/AuthProvider'

// Elongated, scrollable "Reviews" card shown beside the WhatToKnow tips grid on the
// venue page (and reused in the post-rating contribute flow). Extensive fan reviews
// of a gameday experience, stored in D1 (/api/reviews). Writing is auth-gated; with
// no reviews it stays HONESTLY empty — nothing here is fabricated.

interface Review {
  id: string
  author: string
  avatar?: string | null
  body: string
  createdAt: string
  rating?: number
  mine: boolean
  official?: boolean
  verified?: boolean
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

// The fan's own venue-specific pillar scores (from /rank), shown on the card
// while they write so the review carries the context of how they rated it.
export interface VenueRatings {
  fans: number
  food: number
  unique: number
  stadium: number
  score: number
}
const RATING_PILLARS: { key: keyof VenueRatings; label: string }[] = [
  { key: 'fans', label: 'Fans' },
  { key: 'food', label: 'Food' },
  { key: 'unique', label: 'Unique' },
  { key: 'stadium', label: 'Stadium' },
]
const fmtPillar = (n: number) => (Math.round(n * 10) / 10).toString()

export function Reviews({
  scope, targetId, gameId, defaultRating, startOpen = false, venueRatings,
}: {
  scope: 'venue' | 'event'
  targetId: string
  gameId?: string
  defaultRating?: number | null
  startOpen?: boolean
  venueRatings?: VenueRatings | null
}) {
  const { user, openAuth } = useAuth()
  const [reviews, setReviews] = useState<Review[]>([])
  const [open, setOpen] = useState(startOpen)
  const [draft, setDraft] = useState('')
  const [rating, setRating] = useState<number | null>(defaultRating ?? null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!targetId) return
    let alive = true
    setReviews([])
    fetch('/api/reviews?scope=' + scope + '&targetId=' + encodeURIComponent(targetId))
      .then((r) => r.json())
      .then((j) => { if (alive && j?.ok && Array.isArray(j.data)) setReviews(j.data) })
      .catch(() => {})
    return () => { alive = false }
  }, [scope, targetId])

  // venue.tsx resolves the fan's own score from localStorage after mount, so
  // adopt it once it arrives — but never clobber a score they've already picked.
  useEffect(() => {
    if (defaultRating != null) setRating((cur) => (cur == null ? defaultRating : cur))
  }, [defaultRating])

  // The post-rank handoff sets startOpen, but auth resolves async — so startOpen
  // can flip true after mount (once `user` loads). Open the form when it does.
  useEffect(() => {
    if (startOpen) setOpen(true)
  }, [startOpen])

  const startAdd = () => {
    if (!user) { openAuth('signin'); return }
    setErr(null); setOpen(true)
  }

  const submit = async () => {
    const text = draft.trim()
    if (!text || busy) return
    setBusy(true); setErr(null)
    try {
      const r = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scope, targetId, gameId, rating, body: text }),
      })
      const j = await r.json().catch(() => ({}))
      if (r.ok && j?.ok && Array.isArray(j.data)) { setReviews(j.data); setOpen(false); setDraft(''); setRating(defaultRating ?? null) }
      else setErr(j?.error || 'Could not post your review.')
    } catch {
      setErr('Network error. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const remove = (rv: Review) => {
    setReviews((prev) => prev.filter((x) => x.id !== rv.id)) // optimistic
    fetch('/api/reviews?id=' + encodeURIComponent(rv.id) + '&scope=' + scope + '&targetId=' + encodeURIComponent(targetId), { method: 'DELETE' })
      .then((r) => r.json())
      .then((j) => { if (j?.ok && Array.isArray(j.data)) setReviews(j.data) })
      .catch(() => {})
  }

  return (
    <aside className="rvw">
      <div className="rvw-head">
        <span className="rvw-h">Fan Reviews</span>
        <span className="rvw-count">{reviews.length}</span>
      </div>

      {open ? (
        <div className="rvw-form">
          {venueRatings ? (
            <div className="rvw-ratings">
              <span className="rvw-ratlab">Your venue ratings</span>
              <div className="rvw-ratchips">
                {RATING_PILLARS.map((p) => (
                  <span key={p.key} className="rvw-chip">{p.label} <b>{fmtPillar(venueRatings[p.key])}</b></span>
                ))}
              </div>
            </div>
          ) : null}
          <div className="rvw-raterow">
            <span className="rvw-ratelab">Your score</span>
            <div className="rvw-rate">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button key={n} type="button" className={'rvw-num' + (rating === n ? ' on' : '')} onClick={() => setRating(rating === n ? null : n)}>{n}</button>
              ))}
            </div>
          </div>
          <textarea
            className="rvw-textarea" rows={7} maxLength={4000} autoFocus
            placeholder="What was the gameday experience really like — the crowd, the food, getting in and out, the moments that made it?"
            value={draft} onChange={(e) => setDraft(e.target.value)}
          />
          {err ? <div className="wtk-err">{err}</div> : null}
          <div className="rvw-formrow">
            <button className="wtk-cancel" onClick={() => { setOpen(false); setErr(null) }}>Cancel</button>
            <button className="wtk-post" disabled={busy || !draft.trim()} onClick={submit}>{busy ? 'Posting…' : 'Post review'}</button>
          </div>
        </div>
      ) : (
        <button className="rvw-add" onClick={startAdd}>{user ? '✎ Write a review' : '✎ Sign in to review'}</button>
      )}

      <div className="rvw-list">
        {reviews.length ? (
          reviews.map((rv) => (
            <div key={rv.id} className={'rvw-item' + (rv.official ? ' official' : '')}>
              <div className="rvw-itemmeta">
                {rv.verified ? (
                  <span className="wtk-official">
                    <img className="wtk-offlogo" src={rv.avatar || '/img/logo.png'} alt="" width={20} height={20} />
                    <span className="wtk-offname">{rv.author}</span>
                    <span className="wtk-offbadge" title="Verified" aria-label="Verified">✓</span>
                  </span>
                ) : (
                  <span className="rvw-author">{rv.author}</span>
                )}
                {typeof rv.rating === 'number' ? <span className="rvw-score">{rv.rating}/10</span> : null}
                <span className="rvw-ago">{timeAgo(rv.createdAt)}</span>
              </div>
              <div className="rvw-body">{rv.body}</div>
              {rv.mine ? <button className="rvw-del" aria-label="Delete review" onClick={() => remove(rv)}>×</button> : null}
            </div>
          ))
        ) : (
          <div className="rvw-empty"><span className="wtk-dot" /> No reviews yet — be the first to write one.</div>
        )}
      </div>
    </aside>
  )
}
