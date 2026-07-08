import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'

// Follow / unfollow a fan. Optimistic toggle; reverts on failure. Signed-out taps
// open the sign-in modal (same pattern as Reviews.tsx).
export function FollowButton({ username, initialFollowing, onChange }: {
  username: string
  initialFollowing: boolean
  onChange?: (following: boolean, followers: number) => void
}) {
  const { user, openAuth } = useAuth()
  const [following, setFollowing] = useState(initialFollowing)
  const [busy, setBusy] = useState(false)

  const toggle = async () => {
    if (!user) { openAuth('signin'); return }
    if (busy) return
    const next = !following
    setFollowing(next); setBusy(true) // optimistic
    try {
      const r = next
        ? await fetch('/api/follow', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username }) })
        : await fetch('/api/follow?username=' + encodeURIComponent(username), { method: 'DELETE' })
      const j = await r.json().catch(() => ({}))
      if (r.ok && j?.ok) { setFollowing(j.isFollowing); onChange?.(j.isFollowing, j.followers) }
      else setFollowing(!next)
    } catch {
      setFollowing(!next)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button className={'pf-follow' + (following ? ' on' : '')} onClick={toggle} disabled={busy}>
      {following ? 'Following' : 'Follow'}
    </button>
  )
}
