import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SiteNav } from '../components/SiteNav'
import { PageCssGuard } from '../components/PageCssGuard'
import { useAuth } from '../components/auth/AuthProvider'
import { Avatar } from '../components/profile/Avatar'
import { useVenues } from '../components/profile/useVenues'
import { container, notchBtn, miniBtn, empty } from '../components/profile/ui'
import { SPORTS } from '../lib/sports'

// The following feed — recent logs + reviews from the fans you follow, newest
// first. Auth-gated content; keyset-paginated via the nextCursor "Load more".
export const Route = createFileRoute('/feed')({
  head: () => ({
    meta: [{ title: 'Snapback · Following' }],
  }),
  component: FeedPage,
})

const feedItem = 'grid grid-cols-[42px_1fr_auto] items-center gap-[13px] rounded-[8px] border-[3px] border-[#222] bg-white px-[16px] py-[13px] shadow-[5px_5px_0_#222]'
const feedAvatar = 'border-2 shadow-[2px_2px_0_rgba(0,0,0,.3)]'
const feedSub = 'mt-[4px] text-[12px] font-semibold uppercase tracking-[.3px] text-[#6b6b6b]'
const venueLink = 'font-extrabold !text-[#b58900] hover:!text-[#111]'
const scoreChip = 'flex min-w-[58px] items-center justify-center rounded-[7px] bg-[#222] px-[13px] py-[7px]'
const scoreVal = 'font-display text-[22px] leading-none text-brand'

interface FeedItem {
  kind: 'ranking' | 'review'
  userId: string
  author: string | null
  authorName: string | null
  avatar: string | null
  createdAt: string
  ranking?: { league: string; away: string; home: string; venue: string; city?: string; score: number }
  review?: { scope: string; targetId: string; rating?: number; body: string }
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

function FeedPage() {
  const { user, openAuth } = useAuth()
  const venues = useVenues()
  const [items, setItems] = useState<FeedItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [more, setMore] = useState(false)

  const load = (before?: string) => {
    const url = '/api/feed' + (before ? '?before=' + encodeURIComponent(before) : '')
    return fetch(url)
      .then((r) => r.json())
      .then((j) => {
        if (!j?.ok) return
        setItems((prev) => (before ? [...prev, ...j.items] : j.items))
        setCursor(j.nextCursor ?? null)
      })
      .catch(() => {})
  }

  useEffect(() => {
    let alive = true
    if (!user) { setLoading(false); setItems([]); return }
    setLoading(true)
    load().finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [user])

  return (
    <>
      <PageCssGuard id="profile" />
      <SiteNav />
      <section className="relative overflow-hidden bg-[#222] pt-[34px] pb-[30px] text-white after:pointer-events-none after:absolute after:inset-0 after:bg-size-[32px_32px] after:[background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] after:content-['']">
        <div className={container + ' relative z-[1]'}>
          <h1 className="font-display text-[clamp(28px,5vw,44px)] uppercase leading-none tracking-[1px] !text-white">Following</h1>
          <div className="mt-[8px] flex flex-wrap gap-[18px] text-[14px] text-[#cfcfcf]"><span>Recent activity from fans you follow</span></div>
        </div>
      </section>

      <div className="pt-[30px] pb-[70px]">
        <div className={container}>
          {!user ? (
            <div className={empty}>
              <Button variant="brand" className={notchBtn} onClick={() => openAuth('signin')}>Sign in</Button>
              <p className="mt-[12px]">Sign in and follow other fans to build your feed.</p>
            </div>
          ) : loading ? (
            <div className={empty}>Loading…</div>
          ) : items.length === 0 ? (
            <div className={empty}>
              No activity yet. Open a fan’s profile at <b>/u/their-name</b> and tap Follow. Their logs and reviews show up here.
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-[11px]">
                {items.map((it, i) => <FeedRow key={it.kind + i + it.createdAt} it={it} venues={venues} />)}
              </div>
              {cursor ? (
                <div className="mt-[18px]">
                  <Button variant="brand" className={cn(notchBtn, miniBtn)} disabled={more} onClick={() => { setMore(true); load(cursor).finally(() => setMore(false)) }}>
                    {more ? 'Loading…' : 'Load more'}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      <footer className="bg-black py-[34px] text-[13px] text-[#888]"><div className={container}>© 2026 Snapback Sports · Following. <Link to="/" className="font-bold !text-brand">← Home</Link></div></footer>
    </>
  )
}

function FeedRow({ it, venues }: { it: FeedItem; venues: ReturnType<typeof useVenues> }) {
  const author = it.author || 'Fan'
  const authorLink = <Link to="/u/$username" params={{ username: author }} className={venueLink}>{it.authorName || author}</Link>

  if (it.kind === 'ranking' && it.ranking) {
    const r = it.ranking
    const v = venues.byName.get((r.venue ?? '').trim().toLowerCase())
    return (
      <div className={feedItem}>
        <Avatar avatar={it.avatar} name={it.authorName || author} size={42} className={feedAvatar} />
        <div className="min-w-0">
          <div className="text-[15px] leading-[1.35] text-[#222] [&_b]:font-extrabold">{authorLink} logged <b>{r.away} @ {r.home}</b></div>
          <div className={feedSub}>
            {SPORTS[r.league as keyof typeof SPORTS]?.label ?? r.league} · {v ? <Link to="/venue" search={{ id: v.id }} className={venueLink}>{r.venue}</Link> : r.venue} · {timeAgo(it.createdAt)}
          </div>
        </div>
        <div className={scoreChip}><span className={scoreVal}>{r.score.toFixed(1)}</span></div>
      </div>
    )
  }

  if (it.kind === 'review' && it.review) {
    const rv = it.review
    const v = rv.scope === 'venue' ? venues.byId.get(rv.targetId) : undefined
    return (
      <div className={feedItem}>
        <Avatar avatar={it.avatar} name={it.authorName || author} size={42} className={feedAvatar} />
        <div className="min-w-0">
          <div className="text-[15px] leading-[1.35] text-[#222] [&_b]:font-extrabold">
            {authorLink} reviewed {v ? <Link to="/venue" search={{ id: v.id }} className={venueLink}>{v.name}</Link> : <b>{rv.scope === 'event' ? 'a game' : 'a venue'}</b>}
            {typeof rv.rating === 'number' ? <span className="ml-[8px] rounded-[5px] bg-[#222] px-[9px] py-px font-display text-[13px] text-brand">{rv.rating}/10</span> : null}
          </div>
          <div className={feedSub}>{timeAgo(it.createdAt)}</div>
          <div className="mt-[7px] line-clamp-4 text-[14px] leading-[1.5] whitespace-pre-wrap text-[#33352f]">{rv.body}</div>
        </div>
      </div>
    )
  }

  return null
}
