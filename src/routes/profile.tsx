import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteNav } from '../components/SiteNav'
import { PageCssGuard } from '../components/PageCssGuard'
import { useAuth } from '../components/auth/AuthProvider'
import { loadMyRankings, type MyRank } from '../lib/myRankings'
import { Button } from '@/components/ui/button'
import { ProfileView } from '../components/profile/ProfileView'
import { EditProfileModal } from '../components/profile/EditProfileModal'
import { useVenues } from '../components/profile/useVenues'
import type { ProfileData, ProfileReview } from '../components/profile/types'
import { container, notchBtn, notchDark, miniBtn, miniGhost } from '../components/profile/ui'

// "My Profile" — a Letterboxd-style fan profile: identity (avatar, bio, stats),
// pinned favorite venues, a reverse-chron diary of every game you've logged, your
// ratings stats, and your reviews. Reads the same rankings /rank writes
// (localStorage, or D1 when signed in); bio/avatar/favorites/reviews come from D1.
export const Route = createFileRoute('/profile')({
  head: () => ({
    meta: [{ title: 'Snapback · My Profile' }],
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
        <div className="border-b-[3px] border-[#111] bg-brand text-[#111]">
          <div className="flex flex-wrap items-center justify-between gap-[14px] px-[28px] py-[13px] text-[14px] font-bold">
            <span>Create a free account so your diary, reviews, and favorites follow you to any device.</span>
            <div className="flex flex-wrap gap-[10px]">
              <Button variant="brand" className={notchBtn} onClick={() => openAuth('register')}>Create account</Button>
              <Button variant="brand" className={notchBtn + ' ' + miniBtn + ' ' + miniGhost} onClick={() => openAuth('signin')}>Sign in</Button>
            </div>
          </div>
        </div>
      ) : null}

      <ProfileView
        data={data}
        mine
        venues={venues}
        onEdit={() => (user ? setEditing(true) : openAuth('register'))}
        headerAction={user ? <Button variant="brand" className={notchBtn + ' ' + notchDark} onClick={() => logout()}>Sign out</Button> : null}
      />

      {editing && user ? (
        <EditProfileModal
          data={data}
          venues={venues}
          onClose={() => setEditing(false)}
          onSaved={(p) => setFields((prev) => ({ ...prev, ...p }))}
        />
      ) : null}

      <footer className="bg-black py-[34px] text-[13px] text-[#888]"><div className={container}>© 2026 Snapback Sports · My Profile. <Link to="/" className="font-bold !text-brand">← Home</Link></div></footer>
    </>
  )
}
