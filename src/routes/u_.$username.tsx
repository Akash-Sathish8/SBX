import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { SiteNav } from '../components/SiteNav'
import type { PublicUser, PersonalRanking, Review } from '../lib/data-types'

export const Route = createFileRoute('/u_/$username')({
  head: ({ params }) => ({ meta: [{ title: `Snapback — @${params.username}` }] }),
  component: PublicProfilePage,
})

interface PublicProfileData {
  user: PublicUser
  rankings: (PersonalRanking & { experience_name?: string; venue_name?: string })[]
  reviews: Review[]
  stats: { rankings: number; reviews: number; following: number; followers: number }
  is_following: boolean
}

function PublicProfilePage() {
  const { username } = Route.useParams()
  const qc = useQueryClient()

  const { data, isLoading, isError } = useQuery<PublicProfileData>({
    queryKey: ['public-profile', username],
    queryFn: () => fetch(`/api/u/${username}`).then(r => {
      if (r.status === 404) throw new Error('not-found')
      return r.json()
    }),
  })

  const followMut = useMutation({
    mutationFn: (action: 'follow' | 'unfollow') =>
      fetch('/api/follow', {
        method: action === 'follow' ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_username: username }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['public-profile', username] }),
  })

  if (isLoading) return <><SiteNav /><div className="py-20 text-center font-body text-[#999]">Loading...</div></>
  if (isError || !data) {
    return (
      <>
        <SiteNav />
        <div className="py-20 text-center">
          <h2 className="font-display text-[28px] uppercase mb-3">User not found</h2>
          <Link to="/" className="text-brand-yellow font-bold no-underline">← Home</Link>
        </div>
      </>
    )
  }

  const { user, rankings, reviews, stats, is_following } = data

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
            <div className="flex-1">
              <h1 className="font-display text-[clamp(28px,4vw,52px)] uppercase tracking-[1px] leading-none text-white">
                {user.display_name ?? user.username}
              </h1>
              {user.username && <div className="font-body text-[#999] text-[14px] mt-1">@{user.username}</div>}
              {user.bio && <p className="font-body text-[#d6d6d6] text-[14px] mt-2 max-w-[500px]">{user.bio}</p>}
            </div>
            <button
              onClick={() => followMut.mutate(is_following ? 'unfollow' : 'follow')}
              disabled={followMut.isPending}
              className={`px-5 py-2.5 border-[3px] border-[#222] font-body font-bold text-[13px] uppercase tracking-[0.5px] cursor-pointer shadow-[4px_4px_0_#222] [transition:transform_.1s,box-shadow_.1s] hover:-translate-y-px hover:shadow-[6px_6px_0_#222] disabled:opacity-50 ${is_following ? 'bg-white text-ink' : 'bg-brand-yellow text-ink'}`}
            >
              {followMut.isPending ? '...' : is_following ? 'Following' : 'Follow'}
            </button>
          </div>

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
            <div>
              <h2 className="font-display text-[22px] uppercase tracking-[1px] mb-5">Diary</h2>
              {rankings.length === 0
                ? <p className="text-[#999] font-body text-[14px]">No games ranked yet.</p>
                : rankings.map(r => {
                    const final = r.fans_score && r.food_score && r.unique_score && r.stadium_score
                      ? Math.round((r.fans_score * 0.3 + r.food_score * 0.2 + r.unique_score * 0.25 + r.stadium_score * 0.25) * 10) / 10
                      : null
                    return (
                      <div key={r.id} className="bg-white border-[3px] border-[#222] shadow-[4px_4px_0_#222] rounded-[6px] p-4 mb-3 flex items-center gap-4">
                        <div className="flex-1">
                          <div className="font-body font-bold text-[14px] text-ink">{r.experience_name}</div>
                          <div className="font-body text-[12px] text-[#666]">{r.venue_name}</div>
                        </div>
                        {final !== null && (
                          <span className="font-display text-[26px] text-brand-yellow">{final.toFixed(1)}</span>
                        )}
                      </div>
                    )
                  })
              }
            </div>
            <div>
              <h2 className="font-display text-[22px] uppercase tracking-[1px] mb-5">Reviews</h2>
              {reviews.length === 0
                ? <p className="text-[#999] font-body text-[14px]">No reviews yet.</p>
                : reviews.map(r => (
                    <div key={r.id} className="bg-white border-[3px] border-[#222] shadow-[4px_4px_0_#222] rounded-[6px] p-4 mb-3">
                      <div className="flex items-center justify-between mb-2">
                        {r.venue_id && <Link to="/venue/$id" params={{ id: r.venue_id }} className="font-body text-[12px] text-brand-yellow no-underline hover:underline">Venue →</Link>}
                        <span className="font-display text-[20px]">{r.rating}<span className="font-body text-[11px] text-[#999]">/10</span></span>
                      </div>
                      {r.body && <p className="font-body text-[13px] text-[#444] leading-[1.6]">{r.body}</p>}
                    </div>
                  ))
              }
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-black text-[#888] py-[40px] text-[13px]">
        <div className="container max-w-[1180px] mx-auto px-[28px]">
          © 2025 Snapback Sports — Field Guide. <Link to="/" className="text-brand-yellow font-bold">← Home</Link>
        </div>
      </footer>
    </>
  )
}
