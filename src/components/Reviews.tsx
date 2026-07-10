import { useEffect, useState } from 'react'
import { FIELD_PHOTOS, type FieldPhoto } from '../lib/fieldPhotos'
import { PhotoLightbox } from './PhotoLightbox'
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
  up: number
  down: number
  myVote: number // 1 | -1 | 0 — the caller's standing vote (works signed-out)
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
  const { user } = useAuth()
  const [reviews, setReviews] = useState<Review[]>([])
  const [open, setOpen] = useState(startOpen)
  const [draft, setDraft] = useState('')
  const [rating, setRating] = useState<number | null>(defaultRating ?? null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // Field-report photo strip: static photos keyed by venue + author (lowercased).
  const [lbx, setLbx] = useState<{ photos: FieldPhoto[]; index: number; credit: string } | null>(null)
  const photosFor = (author: string): FieldPhoto[] | null =>
    (scope === 'venue' && FIELD_PHOTOS[targetId]?.[author.toLowerCase()]) || null

  // The scrolling thumbnail strip (first 4 + "+N"). Shared by reviews that have
  // photos AND photo-only field reports (an author with photos but no review).
  const strip = (author: string) => {
    const photos = photosFor(author)
    if (!photos?.length) return null
    const openAt = (index: number) => setLbx({ photos, index, credit: author })
    return (
      <div className="rvw-photos">
        {photos.slice(0, 4).map((p, i) => (
          <button key={p.src} type="button" className="rvw-photo" onClick={() => openAt(i)} aria-label={'View photo: ' + p.area}>
            <img src={p.src} alt={p.area} loading="lazy" decoding="async" />
            <span className="rvw-phototag">{p.area}</span>
          </button>
        ))}
        {photos.length > 4 ? (
          <button type="button" className="rvw-photomore" onClick={() => openAt(4)}>
            <b>+{photos.length - 4}</b><span>All photos</span>
          </button>
        ) : null}
      </div>
    )
  }

  // Photo-only field reports render grouped by category (manifest order), each
  // group capped at CAT_MAX thumbs + a "+N" tile that opens the lightbox at
  // that category's first hidden photo. Lightbox indexes span the whole set.
  const CAT_MAX = 4
  const gallery = (author: string) => {
    const photos = photosFor(author)
    if (!photos?.length) return null
    const openAt = (index: number) => setLbx({ photos, index, credit: author })
    const groups: { name: string; items: { p: FieldPhoto; flat: number }[] }[] = []
    photos.forEach((p, flat) => {
      let g = groups[groups.length - 1]
      if (!g || g.name !== p.category) { g = { name: p.category, items: [] }; groups.push(g) }
      g.items.push({ p, flat })
    })
    return (
      <>
        {groups.map((g) => (
          <div key={g.name} className="rvw-catblock">
            <div className="rvw-cat">{g.name} <i>{g.items.length}</i></div>
            <div className="rvw-gallery">
              {g.items.slice(0, CAT_MAX).map(({ p, flat }) => (
                <button key={p.src} type="button" className="rvw-photo" onClick={() => openAt(flat)} aria-label={'View photo: ' + p.area}>
                  <img src={p.src} alt={p.area} loading="lazy" decoding="async" />
                  <span className="rvw-phototag">{p.area}</span>
                </button>
              ))}
              {g.items.length > CAT_MAX ? (
                <button type="button" className="rvw-photomore" onClick={() => openAt(g.items[CAT_MAX].flat)}>
                  <b>+{g.items.length - CAT_MAX}</b><span>{g.name}</span>
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </>
    )
  }

  // Authors with a photo dump for this venue but no written review — they get a
  // photo-only "field report" item in the list.
  const photoOnlyAuthors = scope === 'venue'
    ? Object.keys(FIELD_PHOTOS[targetId] ?? {}).filter((a) => !reviews.some((rv) => rv.author.toLowerCase() === a))
    : []

  // Refetches on auth change too — `mine` and `myVote` depend on who's asking.
  useEffect(() => {
    if (!targetId) return
    let alive = true
    fetch('/api/reviews?scope=' + scope + '&targetId=' + encodeURIComponent(targetId))
      .then((r) => r.json())
      .then((j) => { if (alive && j?.ok && Array.isArray(j.data)) setReviews(j.data) })
      .catch(() => {})
    return () => { alive = false }
  }, [scope, targetId, user?.id])

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

  // Up/down vote: same press toggles off, the other flips. Works signed-out
  // (the server keys anonymous votes on a device cookie). Optimistic counts,
  // reconciled from the server response (reverted if the call fails).
  const vote = (rv: Review, dir: 1 | -1) => {
    const next = rv.myVote === dir ? 0 : dir
    const apply = (x: Review, up: number, down: number, myVote: number) => ({ ...x, up, down, myVote })
    setReviews((prev) => prev.map((x) => x.id !== rv.id ? x : apply(x,
      x.up + (next === 1 ? 1 : 0) - (x.myVote === 1 ? 1 : 0),
      x.down + (next === -1 ? 1 : 0) - (x.myVote === -1 ? 1 : 0),
      next,
    )))
    fetch('/api/review-votes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reviewId: rv.id, vote: next }),
    })
      .then((r) => r.json())
      .then((j) => {
        setReviews((prev) => prev.map((x) => x.id !== rv.id ? x
          : j?.ok && j.data ? apply(x, j.data.up, j.data.down, j.data.myVote)
            : apply(x, rv.up, rv.down, rv.myVote))) // failed — put the old counts back
      })
      .catch(() => {
        setReviews((prev) => prev.map((x) => (x.id !== rv.id ? x : apply(x, rv.up, rv.down, rv.myVote))))
      })
  }

  return (
    <aside className="rvw">
      <div className="rvw-head">
        <span className="rvw-h">Fan Reviews</span>
        <span className="rvw-count">{reviews.length + photoOnlyAuthors.length}</span>
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
            placeholder="What was the gameday experience really like? The crowd, the food, getting in and out, the moments that made it."
            value={draft} onChange={(e) => setDraft(e.target.value)}
          />
          {err ? <div className="wtk-err">{err}</div> : null}
          <div className="rvw-formrow">
            <button className="wtk-cancel" onClick={() => { setOpen(false); setErr(null) }}>Cancel</button>
            <button className="wtk-post" disabled={busy || !draft.trim()} onClick={submit}>{busy ? 'Posting…' : 'Post review'}</button>
          </div>
        </div>
      ) : null}

      <div className="rvw-list">
        {photoOnlyAuthors.map((author) => (
          <div key={'photos:' + author} className="rvw-item">
            <div className="rvw-itemmeta">
              <span className="rvw-author">{author}</span>
              <span className="rvw-ago">📸 {photosFor(author)?.length} photos · field report</span>
            </div>
            {gallery(author)}
          </div>
        ))}
        {reviews.length ? (
          [...reviews].sort((a, b) => (b.up - b.down) - (a.up - a.down) || (b.createdAt < a.createdAt ? -1 : 1)).map((rv) => (
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
              {strip(rv.author)}
              <div className="rvw-foot">
              <div className="rvw-votes">
                <button
                  type="button"
                  className={'rvw-vote up' + (rv.myVote === 1 ? ' on' : '')}
                  aria-label={'Upvote review by ' + rv.author}
                  aria-pressed={rv.myVote === 1}
                  title="Helpful"
                  onClick={() => vote(rv, 1)}
                >▲</button>
                <span className="rvw-net num" title={rv.up + ' up · ' + rv.down + ' down'}>{rv.up - rv.down}</span>
                <button
                  type="button"
                  className={'rvw-vote down' + (rv.myVote === -1 ? ' on' : '')}
                  aria-label={'Downvote review by ' + rv.author}
                  aria-pressed={rv.myVote === -1}
                  title="Not helpful"
                  onClick={() => vote(rv, -1)}
                >▼</button>
              </div>
              </div>
              {rv.mine ? <button className="rvw-del" aria-label="Delete review" onClick={() => remove(rv)}>×</button> : null}
            </div>
          ))
        ) : photoOnlyAuthors.length ? null : (
          <div className="rvw-empty"><span className="wtk-dot" /> No reviews yet. Be the first to write one.</div>
        )}
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
    </aside>
  )
}
