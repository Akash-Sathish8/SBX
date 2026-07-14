import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { FIELD_PHOTOS, photosForAuthor, type FieldPhoto } from '../lib/fieldPhotos'
import { PhotoLightbox } from './PhotoLightbox'
import { useAuth } from './auth/AuthProvider'
import { ReviewShareCard } from './ReviewShareCard'
import { ShareCardModal } from './ShareCardModal'

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
  { key: 'stadium', label: 'Gameday' },
]
const fmtPillar = (n: number) => (Math.round(n * 10) / 10).toString()

// Reddit-style vote pill arrow: quiet until pressed — yellow up, red-washed
// down. The `on` state must also pin the hover colors so a pressed arrow
// doesn't flicker.
const voteBtnCls = (on: boolean, dir: 'up' | 'down') => cn(
  'h-auto cursor-pointer rounded-none px-2.5 py-1.5 font-sans text-[11px] leading-none font-extrabold text-[#9a9a90] transition-[background-color,color] duration-[120ms] hover:bg-[rgba(20,20,20,.06)] hover:text-[#141414]',
  on && dir === 'up' && 'bg-brand text-[#141414] hover:bg-brand hover:text-[#141414]',
  on && dir === 'down' && 'bg-[rgba(226,72,61,.14)] text-danger hover:bg-[rgba(226,72,61,.14)] hover:text-danger',
)

// Photo tiles: fixed 118x88 thumbs on the horizontal strip; 4:3 cells that fill
// their track in the category gallery (which spreads across the full section).
const photoTileCls = (inGallery: boolean) => cn(
  'group relative flex-none cursor-pointer overflow-hidden rounded-[8px] border-2 border-[#141414] bg-[#eee] p-0',
  inGallery ? 'aspect-[4/3] w-full' : 'h-[88px] w-[118px]',
)
const moreTileCls = (inGallery: boolean) => cn(
  'flex flex-none cursor-pointer flex-col items-center justify-center gap-[2px] rounded-[8px] border-2 border-[#141414] bg-[#141414] text-brand hover:bg-black',
  inGallery ? 'aspect-[4/3] w-full' : 'h-[88px] w-[118px]',
)

export function Reviews({
  scope, targetId, gameId, defaultRating, startOpen = false, venueRatings, venueName, venueCity,
}: {
  scope: 'venue' | 'event'
  targetId: string
  gameId?: string
  defaultRating?: number | null
  startOpen?: boolean
  venueRatings?: VenueRatings | null
  venueName?: string // enables the share card on your own reviews
  venueCity?: string
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
  // Pending share hands the card to ShareCardModal (native sheet / copy /
  // download on the pre-rendered PNG).
  const [shareRv, setShareRv] = useState<Review | null>(null)
  const photosFor = (author: string): FieldPhoto[] | null => photosForAuthor(scope, targetId, author)

  const photoImg = (p: FieldPhoto) => (
    // h-full needs `!`: the unlayered global `img { height: auto }` in
    // styles.css beats layered utilities.
    <img className="block h-full! w-full object-cover transition-transform duration-150 group-hover:scale-105" src={p.src} alt={p.area} loading="lazy" decoding="async" />
  )
  const photoTag = (p: FieldPhoto) => (
    <span className="absolute bottom-[5px] left-[5px] rounded-[3px] border-[1.5px] border-[#141414] bg-brand px-1.5 py-[2px] font-sans text-[8.5px] font-extrabold tracking-[.5px] whitespace-nowrap text-[#141414] uppercase">{p.area}</span>
  )

  // The scrolling thumbnail strip (first 4 + "+N"). Shared by reviews that have
  // photos AND photo-only field reports (an author with photos but no review).
  const strip = (author: string) => {
    const photos = photosFor(author)
    if (!photos?.length) return null
    const openAt = (index: number) => setLbx({ photos, index, credit: author })
    return (
      <div className="mt-[11px] flex gap-2 overflow-x-auto pb-[3px] [scrollbar-color:#cdcdcd_transparent] [scrollbar-width:thin]">
        {photos.slice(0, 4).map((p, i) => (
          <button key={p.src} type="button" className={photoTileCls(false)} onClick={() => openAt(i)} aria-label={'View photo: ' + p.area}>
            {photoImg(p)}
            {photoTag(p)}
          </button>
        ))}
        {photos.length > 4 ? (
          <button type="button" className={moreTileCls(false)} onClick={() => openAt(4)}>
            <b className="font-display text-[20px] font-normal">+{photos.length - 4}</b><span className="font-sans text-[8.5px] font-extrabold tracking-[1.2px] uppercase">All photos</span>
          </button>
        ) : null}
      </div>
    )
  }

  // Photo-only field reports render grouped by category (manifest order), each
  // group capped at CAT_MAX thumbs + a "+N" tile that opens the lightbox at
  // that category's first hidden photo. Lightbox indexes span the whole set.
  const CAT_MAX = 8
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
          <div key={g.name} className="mt-[13px]">
            <div className="mb-2 flex items-baseline gap-[7px] border-b-2 border-[#141414] pb-[5px] font-display text-[14px] tracking-[.8px] text-[#141414] uppercase">{g.name} <i className="font-sans text-[11px] font-extrabold text-[#9a9a8e] not-italic">{g.items.length}</i></div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
              {g.items.slice(0, CAT_MAX).map(({ p, flat }) => (
                <button key={p.src} type="button" className={photoTileCls(true)} onClick={() => openAt(flat)} aria-label={'View photo: ' + p.area}>
                  {photoImg(p)}
                  {photoTag(p)}
                </button>
              ))}
              {g.items.length > CAT_MAX ? (
                <button type="button" className={moreTileCls(true)} onClick={() => openAt(g.items[CAT_MAX].flat)}>
                  <b className="font-display text-[20px] font-normal">+{g.items.length - CAT_MAX}</b><span className="font-sans text-[8.5px] font-extrabold tracking-[1.2px] uppercase">{g.name}</span>
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
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-[10px] border-2 border-[#141414] bg-white font-sans [line-height:normal]">
      <div className="flex items-center gap-[9px] border-b-2 border-[#141414] bg-brand px-[15px] py-[11px]">
        <span className="font-display text-[19px] tracking-[.4px] text-[#141414] uppercase">Fan Reviews</span>
        <span className="ml-auto inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-[11px] bg-[#141414] px-[7px] text-[12px] font-extrabold text-white">{reviews.length + photoOnlyAuthors.length}</span>
      </div>

      {open ? (
        <div className="px-[15px] pt-[13px] pb-1">
          {venueRatings ? (
            <div className="mb-[11px]">
              <span className="mb-1.5 block text-[10.5px] font-extrabold tracking-[.5px] text-[#8a8a82] uppercase">Your venue ratings</span>
              <div className="flex flex-wrap gap-1.5">
                {RATING_PILLARS.map((p) => (
                  <Badge key={p.key} variant="outline" className="gap-[5px] rounded-full border-[1.5px] border-[#e7dca0] bg-tip px-2.5 py-[3px] text-[11px] font-bold tracking-[.3px] text-[#5a5a52] uppercase">{p.label} <b className="font-display text-[14px] font-normal text-[#141414]">{fmtPillar(venueRatings[p.key])}</b></Badge>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mb-2.5">
            <span className="mb-1.5 block text-[10.5px] font-extrabold tracking-[.5px] text-[#8a8a82] uppercase">Your score</span>
            <div className="grid grid-cols-10 gap-[5px] max-[560px]:grid-cols-5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <Button
                  key={n}
                  type="button"
                  variant="ghost"
                  className={cn(
                    'h-[30px] min-w-0 cursor-pointer rounded-[6px] border-[1.5px] border-[#d9d9cf] bg-white p-0 font-sans text-[13px] font-extrabold text-[#555] hover:border-[#141414] hover:bg-white hover:text-[#555]',
                    rating === n && 'border-[#141414] bg-brand text-[#141414] hover:bg-brand hover:text-[#141414]',
                  )}
                  onClick={() => setRating(rating === n ? null : n)}
                >{n}</Button>
              ))}
            </div>
          </div>
          <Textarea
            className="field-sizing-fixed min-h-[124px] w-full resize-y rounded-[8px] border-[1.5px] border-[#d9d9cf] bg-white px-3 py-2.5 font-sans text-[13.5px] leading-[1.45] text-[#2a2a2a] shadow-none focus-visible:border-[#141414] focus-visible:ring-0 md:text-[13.5px]"
            rows={7} maxLength={4000} autoFocus
            placeholder="What was the gameday experience really like? The crowd, the food, getting in and out, the moments that made it."
            value={draft} onChange={(e) => setDraft(e.target.value)}
          />
          {err ? <div className="mt-1.5 text-[12px] font-bold text-[#c0392b]">{err}</div> : null}
          <div className="mt-[9px] flex justify-end gap-2">
            <Button
              variant="ghost"
              className="h-auto cursor-pointer px-2.5 py-2 font-sans text-[12.5px] font-bold text-[#888] hover:bg-transparent hover:text-[#141414]"
              onClick={() => { setOpen(false); setErr(null) }}
            >Cancel</Button>
            <Button
              variant="brand"
              className="h-auto cursor-pointer rounded-[8px] px-4 py-[9px] font-sans text-[12.5px] tracking-[.4px] text-[#111]"
              disabled={busy || !draft.trim()} onClick={submit}
            >{busy ? 'Posting…' : 'Post review'}</Button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] items-start gap-3 px-[15px] pt-3 pb-3.5">
        {photoOnlyAuthors.map((author) => (
          <div key={'photos:' + author} className="relative col-span-full rounded-[9px] border-[1.5px] border-[#ecece4] bg-[#faf9f5] py-2.5 pr-3 pl-3">
            <div className="mb-1 flex flex-wrap items-baseline gap-2">
              <span className="text-[12px] font-extrabold tracking-[.3px] text-[#141414] uppercase">{author}</span>
              <span className="ml-auto text-[11px] font-semibold text-[#9a9a9a]">📸 {photosFor(author)?.length} photos · field report</span>
            </div>
            {gallery(author)}
          </div>
        ))}
        {reviews.length ? (
          [...reviews].sort((a, b) => (b.up - b.down) - (a.up - a.down) || (b.createdAt < a.createdAt ? -1 : 1)).map((rv) => (
            <div key={rv.id} className="relative rounded-[9px] border-[1.5px] border-[#ecece4] bg-[#faf9f5] py-2.5 pr-[26px] pl-3">
              <div className="mb-1 flex flex-wrap items-baseline gap-2">
                {rv.verified ? (
                  <span className="inline-flex items-center gap-1.5">
                    <img className="block h-5! w-5 self-center rounded-full border-[1.5px] border-[#141414] object-cover" src={rv.avatar || '/img/logo.png'} alt="" width={20} height={20} />
                    <span className="text-[12px] font-extrabold tracking-[.3px] text-[#141414] uppercase">{rv.author}</span>
                    <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#141414] text-[9px] leading-none font-black text-brand" title="Verified" aria-label="Verified">✓</span>
                  </span>
                ) : (
                  <span className="text-[12px] font-extrabold tracking-[.3px] text-[#141414] uppercase">{rv.author}</span>
                )}
                {typeof rv.rating === 'number' ? <span className="rounded-[5px] bg-brand px-1.5 py-px font-display text-[12px] tracking-[.3px] text-[#141414]">{rv.rating}/10</span> : null}
                <span className="ml-auto text-[11px] font-semibold text-[#9a9a9a]">{timeAgo(rv.createdAt)}</span>
              </div>
              <div className="text-[13.5px] leading-[1.45] font-medium whitespace-pre-wrap text-[#2a2a2a] [overflow-wrap:anywhere]">{rv.body}</div>
              {strip(rv.author)}
              <div className="mt-[11px] flex items-center justify-between gap-2.5 border-t border-dashed border-[#e3e3d9] pt-[9px]">
              <div className="inline-flex items-center self-start overflow-hidden rounded-full border-[1.5px] border-[rgba(20,20,20,.13)]">
                <Button
                  type="button"
                  variant="ghost"
                  className={voteBtnCls(rv.myVote === 1, 'up')}
                  aria-label={'Upvote review by ' + rv.author}
                  aria-pressed={rv.myVote === 1}
                  title="Helpful"
                  onClick={() => vote(rv, 1)}
                >▲</Button>
                <span className="min-w-5 px-[2px] text-center text-[12.5px] font-extrabold text-[#3a3a34]" title={rv.up + ' up · ' + rv.down + ' down'}>{rv.up - rv.down}</span>
                <Button
                  type="button"
                  variant="ghost"
                  className={voteBtnCls(rv.myVote === -1, 'down')}
                  aria-label={'Downvote review by ' + rv.author}
                  aria-pressed={rv.myVote === -1}
                  title="Not helpful"
                  onClick={() => vote(rv, -1)}
                >▼</Button>
              </div>
              {rv.mine && venueName ? (
                <Button
                  variant="ghost"
                  className="h-auto cursor-pointer rounded-full border-[1.5px] border-[rgba(20,20,20,.13)] bg-transparent px-3 py-[5px] font-sans text-[11.5px] font-extrabold text-[#8a8a80] transition-[border-color,color] duration-[120ms] hover:border-[rgba(20,20,20,.5)] hover:bg-transparent hover:text-[#141414] disabled:opacity-60"
                  onClick={() => setShareRv(rv)}
                >↓ Share</Button>
              ) : null}
              </div>
              {rv.mine ? (
                <Button
                  variant="ghost"
                  className="absolute top-1.5 right-[7px] h-auto cursor-pointer rounded-none px-[2px] py-0 text-[17px] leading-none font-normal text-[#bbb] hover:bg-transparent hover:text-danger"
                  aria-label="Delete review" onClick={() => remove(rv)}
                >×</Button>
              ) : null}
            </div>
          ))
        ) : photoOnlyAuthors.length ? null : (
          <div className="flex items-center gap-2 py-1 text-[12.5px] font-bold text-[#999]"><span className="h-[7px] w-[7px] flex-none rounded-full bg-brand" /> No reviews yet. Be the first to write one.</div>
        )}
      </div>

      {shareRv && venueName ? (
        <ShareCardModal
          filename={`snapback-review-${shareRv.id.slice(0, 8)}.png`}
          title="Snapback"
          text="My review on Snapback"
          onClose={() => setShareRv(null)}
        >
          <ReviewShareCard
            r={{
              venueName,
              venueCity,
              author: shareRv.author,
              body: shareRv.body,
              rating: shareRv.rating,
              createdAt: shareRv.createdAt,
              net: shareRv.up - shareRv.down,
              photos: photosFor(shareRv.author) ?? undefined,
            }}
          />
        </ShareCardModal>
      ) : null}

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
