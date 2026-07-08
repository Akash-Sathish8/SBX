import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteNav } from '../components/SiteNav'
import { PageCssGuard } from '../components/PageCssGuard'
import { useAuth } from '../components/auth/AuthProvider'
import { Avatar } from '../components/profile/Avatar'
import { useVenues } from '../components/profile/useVenues'
import { SPORTS } from '../lib/sports'
import css from '../pages/profile.css?url'

// The following feed — recent logs + reviews from the fans you follow, newest
// first. Auth-gated content; keyset-paginated via the nextCursor "Load more".
export const Route = createFileRoute('/feed')({
  head: () => ({
    links: [{ rel: 'stylesheet', href: css, 'data-page-css': 'profile' }],
    meta: [{ title: 'Snapback — Following' }],
  }),
  component: FeedPage,
})

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
      <section className="pf-hero">
        <div className="container">
          <h1 className="pf-name">Following</h1>
          <div className="pf-statline" style={{ marginTop: 8 }}><span>Recent activity from fans you follow</span></div>
        </div>
      </section>

      <div className="pf-body">
        <div className="container">
          {!user ? (
            <div className="pf-empty">
              <button className="pf-save" onClick={() => openAuth('signin')}>Sign in</button>
              <p style={{ marginTop: 12 }}>Sign in and follow other fans to build your feed.</p>
            </div>
          ) : loading ? (
            <div className="pf-empty">Loading…</div>
          ) : items.length === 0 ? (
            <div className="pf-empty">
              No activity yet. Open a fan’s profile at <b>/u/their-name</b> and tap Follow — their logs and reviews show up here.
            </div>
          ) : (
            <>
              <div className="pf-feed">
                {items.map((it, i) => <FeedRow key={it.kind + i + it.createdAt} it={it} venues={venues} />)}
              </div>
              {cursor ? (
                <div style={{ marginTop: 18 }}>
                  <button className="pf-mini-btn" disabled={more} onClick={() => { setMore(true); load(cursor).finally(() => setMore(false)) }}>
                    {more ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      <footer><div className="container">© 2026 Snapback Sports — Following. <Link to="/">← Home</Link></div></footer>
    </>
  )
}

function FeedRow({ it, venues }: { it: FeedItem; venues: ReturnType<typeof useVenues> }) {
  const author = it.author || 'Fan'
  const authorLink = <Link to="/u/$username" params={{ username: author }} className="pf-feed-author">{it.authorName || author}</Link>

  if (it.kind === 'ranking' && it.ranking) {
    const r = it.ranking
    const v = venues.byName.get((r.venue ?? '').trim().toLowerCase())
    return (
      <div className="pf-feed-item">
        <Avatar avatar={it.avatar} name={it.authorName || author} size={42} />
        <div className="pf-feed-main">
          <div className="pf-feed-line">{authorLink} logged <b>{r.away} @ {r.home}</b></div>
          <div className="pf-feed-sub">
            {SPORTS[r.league as keyof typeof SPORTS]?.label ?? r.league} · {v ? <Link to="/venue" search={{ id: v.id }} className="pf-d-venuelink">{r.venue}</Link> : r.venue} · {timeAgo(it.createdAt)}
          </div>
        </div>
        <div className="pf-d-score"><span className="pf-sv">{r.score.toFixed(1)}</span></div>
      </div>
    )
  }

  if (it.kind === 'review' && it.review) {
    const rv = it.review
    const v = rv.scope === 'venue' ? venues.byId.get(rv.targetId) : undefined
    return (
      <div className="pf-feed-item">
        <Avatar avatar={it.avatar} name={it.authorName || author} size={42} />
        <div className="pf-feed-main">
          <div className="pf-feed-line">
            {authorLink} reviewed {v ? <Link to="/venue" search={{ id: v.id }} className="pf-d-venuelink">{v.name}</Link> : <b>{rv.scope === 'event' ? 'a game' : 'a venue'}</b>}
            {typeof rv.rating === 'number' ? <span className="pf-review-score" style={{ marginLeft: 8 }}>{rv.rating}/10</span> : null}
          </div>
          <div className="pf-feed-sub">{timeAgo(it.createdAt)}</div>
          <div className="pf-feed-body">{rv.body}</div>
        </div>
      </div>
    )
  }

  return null
}
