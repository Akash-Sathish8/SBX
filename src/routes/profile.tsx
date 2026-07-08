import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteNav } from '../components/SiteNav'
import { PageCssGuard } from '../components/PageCssGuard'
import { useAuth } from '../components/auth/AuthProvider'
import { loadMyRankings, type MyRank } from '../lib/myRankings'
import { ProfileView } from '../components/profile/ProfileView'
import { EditProfileModal } from '../components/profile/EditProfileModal'
import { useVenues } from '../components/profile/useVenues'
import type { ProfileData, ProfileReview } from '../components/profile/types'
import css from '../pages/profile.css?url'

// "My Profile" — a Letterboxd-style fan profile: identity (avatar, bio, stats),
// pinned favorite venues, a reverse-chron diary of every game you've logged, your
// ratings stats, and your reviews. Reads the same rankings /rank writes
// (localStorage, or D1 when signed in); bio/avatar/favorites/reviews come from D1.
export const Route = createFileRoute('/profile')({
  head: () => ({
    links: [{ rel: 'stylesheet', href: css, 'data-page-css': 'profile' }],
    meta: [{ title: 'Snapback — My Profile' }],
  }),
  component: ProfilePage,
})

interface SelfFields { displayName: string | null; bio: string | null; avatar: string | null; favorites: string[]; createdAt: string | null; followers?: number; following?: number }
const EMPTY: SelfFields = { displayName: null, bio: null, avatar: null, favorites: [], createdAt: null }

function ProfilePage() {
  const { user, openAuth, logout } = useAuth()
  const venues = useVenues()
  const [rankings, setRankings] = useState<MyRank[]>([])
  const [fields, setFields] = useState<SelfFields>(EMPTY)
  const [reviews, setReviews] = useState<ProfileReview[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [editing, setEditing] = useState(false)

  // This device's local rankings render immediately (works signed-out too).
  useEffect(() => {
    setRankings(loadMyRankings())
    setHydrated(true)
  }, [])

  // Signed in: D1 is authoritative for rankings, and the source of bio/avatar/
  // favorites/reviews. Signed out: clear back to local-only.
  useEffect(() => {
    if (!hydrated) return
    if (!user) { setFields(EMPTY); setReviews([]); setRankings(loadMyRankings()); return }
    let alive = true
    fetch('/api/rankings').then((r) => r.json()).then((j) => { if (alive && j?.ok && Array.isArray(j.data)) setRankings(j.data) }).catch(() => {})
    fetch('/api/profile').then((r) => r.json()).then((j) => {
      if (alive && j?.ok && j.profile) setFields({ displayName: j.profile.displayName ?? null, bio: j.profile.bio ?? null, avatar: j.profile.avatar ?? null, favorites: j.profile.favorites ?? [], createdAt: j.profile.createdAt ?? null, followers: j.profile.followers, following: j.profile.following })
    }).catch(() => {})
    fetch('/api/reviews?by=mine').then((r) => r.json()).then((j) => { if (alive && j?.ok && Array.isArray(j.data)) setReviews(j.data) }).catch(() => {})
    return () => { alive = false }
  }, [hydrated, user])

  const data: ProfileData = {
    username: user ? (user.username || user.email.split('@')[0]) : null,
    displayName: fields.displayName,
    bio: fields.bio,
    avatar: fields.avatar,
    favorites: fields.favorites,
    createdAt: fields.createdAt,
    followers: fields.followers,
    following: fields.following,
    rankings,
    reviews,
  }

  return (
    <>
      <PageCssGuard id="profile" />
      <SiteNav />

      {!user ? (
        <div className="pf-signin">
          <div className="container pf-signin-in">
            <span>Create a free account so your diary, reviews, and favorites follow you to any device.</span>
            <div className="pf-signin-cta">
              <button className="pf-save" onClick={() => openAuth('register')}>Create account</button>
              <button className="pf-mini-btn ghost" onClick={() => openAuth('signin')}>Sign in</button>
            </div>
          </div>
        </div>
      ) : null}

      <ProfileView
        data={data}
        mine
        venues={venues}
        onEdit={() => (user ? setEditing(true) : openAuth('register'))}
        headerAction={user ? <button className="pf-signout" onClick={() => logout()}>Sign out</button> : null}
      />

      {editing && user ? (
        <EditProfileModal
          data={data}
          venues={venues}
          onClose={() => setEditing(false)}
          onSaved={(p) => setFields((prev) => ({ ...prev, ...p }))}
        />
      ) : null}

      <footer><div className="container">© 2026 Snapback Sports — My Profile. <Link to="/">← Home</Link></div></footer>
    </>
  )
}
