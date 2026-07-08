import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteNav } from '../../components/SiteNav'
import { PageCssGuard } from '../../components/PageCssGuard'
import { ProfileView } from '../../components/profile/ProfileView'
import { FollowButton } from '../../components/profile/FollowButton'
import { useVenues } from '../../components/profile/useVenues'
import type { ProfileData } from '../../components/profile/types'
import css from '../../pages/profile.css?url'

// Public, shareable fan profile — same diary-feed view as /profile, read-only,
// with a Follow button. Reachable at /u/<username>; the app has no server loaders
// so this renders client-side (generic title set below).
export const Route = createFileRoute('/u/$username')({
  head: ({ params }) => ({
    links: [{ rel: 'stylesheet', href: css, 'data-page-css': 'profile' }],
    meta: [{ title: `${params.username} on Snapback` }],
  }),
  component: PublicProfilePage,
})

function PublicProfilePage() {
  const { username } = Route.useParams()
  const venues = useVenues()
  const [state, setState] = useState<'loading' | 'ok' | '404'>('loading')
  const [data, setData] = useState<ProfileData | null>(null)
  const [mine, setMine] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    setState('loading')
    fetch('/api/u/' + encodeURIComponent(username))
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return
        if (!j?.ok || !j.profile) { setState('404'); return }
        const p = j.profile
        setData({
          username: p.username, displayName: p.displayName, bio: p.bio, avatar: p.avatar, favorites: p.favorites ?? [],
          createdAt: p.createdAt, rankings: p.rankings ?? [], reviews: p.reviews ?? [],
          followers: p.followers ?? 0, following: p.following ?? 0,
        })
        setMine(!!p.mine)
        setIsFollowing(!!p.isFollowing)
        setState('ok')
      })
      .catch(() => { if (alive) setState('404') })
    return () => { alive = false }
  }, [username])

  const share = () => {
    try {
      navigator.clipboard?.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch { /* ignore */ }
  }

  const headerAction = data ? (
    <>
      {mine ? (
        <Link to="/profile" className="pf-edit">Edit profile</Link>
      ) : (
        <FollowButton
          username={data.username || username}
          initialFollowing={isFollowing}
          onChange={(f, followers) => { setIsFollowing(f); setData((d) => (d ? { ...d, followers } : d)) }}
        />
      )}
      <button className="pf-signout" onClick={share}>{copied ? 'Copied!' : 'Share'}</button>
    </>
  ) : null

  return (
    <>
      <PageCssGuard id="profile" />
      <SiteNav />
      {state === 'loading' ? (
        <div className="pf-body"><div className="container"><div className="pf-empty">Loading…</div></div></div>
      ) : state === '404' ? (
        <div className="pf-body"><div className="container">
          <h1 style={{ fontSize: 28, marginBottom: 10 }}>No fan named “{username}”</h1>
          <div className="pf-empty">That profile doesn’t exist. <Link to="/">← Home</Link></div>
        </div></div>
      ) : data ? (
        <ProfileView data={data} mine={false} venues={venues} headerAction={headerAction} />
      ) : null}
      <footer><div className="container">© 2026 Snapback Sports. <Link to="/">← Home</Link></div></footer>
    </>
  )
}
