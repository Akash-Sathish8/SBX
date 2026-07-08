import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { SiteNav } from '../components/SiteNav'
import type { PublicUser, PersonalRanking, Review } from '../lib/data-types'

export const Route = createFileRoute('/profile')({
  head: () => ({ meta: [{ title: 'Snapback — My Profile' }] }),
  component: ProfilePage,
})

interface ProfileData {
  user: PublicUser
  rankings: (PersonalRanking & { experience_name?: string; venue_name?: string })[]
  reviews: Review[]
  stats: { rankings: number; reviews: number; following: number; followers: number }
  pinned: string[]
}

function ProfilePage() {
  const qc = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ display_name: '', bio: '' })

  const { data, isLoading, isError } = useQuery<ProfileData>({
    queryKey: ['profile'],
    queryFn: () => fetch('/api/profile').then(r => {
      if (r.status === 401) throw new Error('auth')
      return r.json()
    }),
    retry: false,
  })

  const save = useMutation({
    mutationFn: (body: { display_name?: string; bio?: string }) =>
      fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); setEditOpen(false) },
  })

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    qc.clear()
    window.location.href = '/'
  }

  if (isError) {
    return (
      <>
        <SiteNav />
        <div className="container max-w-[600px] mx-auto px-[28px] py-20 text-center">
          <h2 className="font-display text-[32px] uppercase mb-4">Sign In</h2>
          <p className="font-body text-[16px] text-[#666] mb-8">Create an account or sign in to track your rankings and connect with other fans.</p>
          <div className="flex flex-col gap-4 max-w-[360px] mx-auto">
            <a href="/api/auth/google" className="flex items-center justify-center gap-3 bg-white border-[3px] border-[#222] shadow-[4px_4px_0_#222] px-6 py-3 font-body font-bold text-[15px] no-underline text-ink hover:-translate-y-px hover:shadow-[6px_6px_0_#222] [transition:transform_.1s,box-shadow_.1s]">
              <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </a>
            <div className="relative flex items-center gap-3">
              <div className="flex-1 h-px bg-[#ddd]" />
              <span className="font-body text-[12px] text-[#999]">or</span>
              <div className="flex-1 h-px bg-[#ddd]" />
            </div>
            <Link to="/profile" search={{ mode: 'login' } as any} className="text-center bg-brand-yellow text-ink font-bold px-6 py-3 border-[3px] border-ink shadow-[4px_4px_0_#000] no-underline font-body uppercase tracking-[0.5px] hover:-translate-y-px hover:shadow-[6px_6px_0_#000] [transition:transform_.1s,box-shadow_.1s]">
              Sign In with Email
            </Link>
            <Link to="/profile" search={{ mode: 'register' } as any} className="text-center bg-white text-ink font-bold px-6 py-3 border-[3px] border-[#222] shadow-[4px_4px_0_#222] no-underline font-body uppercase tracking-[0.5px] hover:-translate-y-px hover:shadow-[6px_6px_0_#222] [transition:transform_.1s,box-shadow_.1s]">
              Create Account
            </Link>
          </div>
        </div>
      </>
    )
  }

  if (isLoading || !data) {
    return <><SiteNav /><div className="py-20 text-center font-body text-[#999]">Loading...</div></>
  }

  const { user, rankings, reviews, stats } = data

  return (
    <>
      <SiteNav />

      <section className="grid-overlay bg-[#222] text-white pt-[44px] pb-[38px] relative overflow-hidden">
        <div className="container relative z-[1] max-w-[1180px] mx-auto px-[28px]">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-brand-yellow flex items-center justify-center font-display text-[36px] text-ink shrink-0">
              {user.avatar_url
                ? <img src={user.avatar_url} alt="" className="w-20 h-20 rounded-full object-cover" />
                : (user.display_name ?? user.username ?? '?')[0].toUpperCase()
              }
            </div>
            <div>
              <h1 className="font-display text-[clamp(28px,4vw,52px)] uppercase tracking-[1px] leading-none text-white">
                {user.display_name ?? user.username ?? 'Fan'}
              </h1>
              {user.username && <div className="font-body text-[#999] text-[14px] mt-1">@{user.username}</div>}
              {user.bio && <p className="font-body text-[#d6d6d6] text-[14px] mt-2 max-w-[500px]">{user.bio}</p>}
            </div>
            <div className="ml-auto flex gap-3">
              <button
                onClick={() => { setEditForm({ display_name: user.display_name ?? '', bio: user.bio ?? '' }); setEditOpen(true) }}
                className="bg-white text-ink font-body font-bold text-[13px] px-4 py-2 border-[2px] border-white cursor-pointer hover:bg-brand-yellow [transition:background_.1s]"
              >
                Edit
              </button>
              <button
                onClick={handleLogout}
                className="text-[#999] font-body text-[13px] px-4 py-2 border-[2px] border-[#555] cursor-pointer hover:border-white hover:text-white [transition:color_.1s,border-color_.1s]"
              >
                Sign out
              </button>
            </div>
          </div>

          {/* Stats bar */}
          <div className="flex gap-8 mt-6">
            {[
              { label: 'Ranked', value: stats.rankings },
              { label: 'Reviews', value: stats.reviews },
              { label: 'Following', value: stats.following },
              { label: 'Followers', value: stats.followers },
            ].map(s => (
              <div key={s.label}>
                <div className="font-display text-[24px] text-brand-yellow">{s.value}</div>
                <div className="font-body text-[12px] text-[#999] uppercase tracking-[0.5px]">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-[46px] bg-[#f4f4f4]">
        <div className="container max-w-[1180px] mx-auto px-[28px]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">

            {/* Rankings diary */}
            <div>
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display text-[22px] uppercase tracking-[1px]">Diary</h2>
                <Link to="/rank" className="bg-brand-yellow text-ink font-body font-bold text-[12px] uppercase tracking-[0.5px] px-3 py-1.5 border-[2px] border-ink no-underline hover:shadow-[3px_3px_0_#000] [transition:box-shadow_.1s]">
                  + Add Game
                </Link>
              </div>
              {rankings.length === 0 ? (
                <div className="text-center py-10 text-[#999] font-body">
                  <p className="mb-3">No games ranked yet.</p>
                  <Link to="/rank" className="text-brand-yellow font-bold no-underline">Rate your first game →</Link>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {rankings.map(r => {
                    const final = r.fans_score && r.food_score && r.unique_score && r.stadium_score
                      ? Math.round((r.fans_score * 0.3 + r.food_score * 0.2 + r.unique_score * 0.25 + r.stadium_score * 0.25) * 10) / 10
                      : null
                    return (
                      <div key={r.id} className="bg-white border-[3px] border-[#222] shadow-[4px_4px_0_#222] rounded-[6px] p-4 flex items-center gap-4">
                        <div className="flex-1">
                          <div className="font-body font-bold text-[14px] text-ink">{r.experience_name}</div>
                          <div className="font-body text-[12px] text-[#666]">{r.venue_name}</div>
                          {r.notes && <div className="font-body text-[12px] text-[#888] mt-1 italic">"{r.notes}"</div>}
                        </div>
                        {final !== null && (
                          <div className="text-right shrink-0">
                            <div className="font-display text-[28px] text-brand-yellow">{final.toFixed(1)}</div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Reviews */}
            <div>
              <h2 className="font-display text-[22px] uppercase tracking-[1px] mb-5">Reviews</h2>
              {reviews.length === 0 ? (
                <div className="text-center py-10 text-[#999] font-body">
                  <p>No reviews yet. Leave one on a venue or game page.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {reviews.map(r => (
                    <div key={r.id} className="bg-white border-[3px] border-[#222] shadow-[4px_4px_0_#222] rounded-[6px] p-4">
                      <div className="flex items-center justify-between mb-2">
                        {r.venue_id && (
                          <Link to="/venue/$id" params={{ id: r.venue_id }} className="font-body font-bold text-[13px] text-brand-yellow no-underline hover:underline">
                            View venue →
                          </Link>
                        )}
                        <span className="font-display text-[20px] text-ink">{r.rating}<span className="font-body text-[12px] text-[#999]">/10</span></span>
                      </div>
                      {r.body && <p className="font-body text-[13px] text-[#444] leading-[1.6]">{r.body}</p>}
                      <div className="font-body text-[11px] text-[#999] mt-2">{new Date(r.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Edit modal */}
      {editOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white border-[3px] border-[#222] shadow-[8px_8px_0_#000] rounded-[8px] p-6 w-full max-w-[420px]">
            <h3 className="font-display text-[22px] uppercase tracking-[1px] mb-5">Edit Profile</h3>
            <div className="flex flex-col gap-4">
              <div>
                <label className="font-body font-bold text-[13px] block mb-1">Display Name</label>
                <input
                  value={editForm.display_name}
                  onChange={e => setEditForm(f => ({ ...f, display_name: e.target.value }))}
                  className="w-full border-[2px] border-[#222] rounded-[4px] px-3 py-2 font-body text-[14px] outline-none focus:border-brand-yellow"
                />
              </div>
              <div>
                <label className="font-body font-bold text-[13px] block mb-1">Bio</label>
                <textarea
                  value={editForm.bio}
                  onChange={e => setEditForm(f => ({ ...f, bio: e.target.value }))}
                  rows={3}
                  className="w-full border-[2px] border-[#222] rounded-[4px] px-3 py-2 font-body text-[14px] outline-none focus:border-brand-yellow resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => save.mutate(editForm)}
                disabled={save.isPending}
                className="flex-1 bg-brand-yellow text-ink font-body font-bold py-2.5 border-[2px] border-ink cursor-pointer hover:shadow-[3px_3px_0_#000] [transition:box-shadow_.1s] disabled:opacity-50"
              >
                {save.isPending ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => setEditOpen(false)}
                className="px-4 py-2.5 border-[2px] border-[#222] font-body text-[13px] cursor-pointer hover:bg-[#f4f4f4]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="bg-black text-[#888] py-[40px] text-[13px]">
        <div className="container max-w-[1180px] mx-auto px-[28px]">
          © 2025 Snapback Sports — Field Guide. <Link to="/" className="text-brand-yellow font-bold">← Home</Link>
        </div>
      </footer>
    </>
  )
}
