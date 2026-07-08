import { createFileRoute, Link } from '@tanstack/react-router'
import { useInfiniteQuery } from '@tanstack/react-query'
import { SiteNav } from '../components/SiteNav'
import type { Review, PersonalRanking } from '../lib/data-types'

export const Route = createFileRoute('/feed')({
  head: () => ({ meta: [{ title: 'Snapback — Following Feed' }] }),
  component: FeedPage,
})

type FeedItem =
  | { type: 'review'; data: Review }
  | { type: 'ranking'; data: PersonalRanking & { experience_name?: string; venue_name?: string } }

interface FeedPage {
  items: FeedItem[]
  cursor: string | null
}

function ReviewCard({ item }: { item: Review }) {
  return (
    <div className="bg-white border-[3px] border-[#222] shadow-[4px_4px_0_#222] rounded-[8px] p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-[#e0e0e0] flex items-center justify-center font-display text-[16px] text-ink">
          {(item.display_name ?? item.username ?? '?')[0].toUpperCase()}
        </div>
        <div>
          <Link to="/u/$username" params={{ username: item.username ?? item.user_id }} className="font-body font-bold text-[14px] text-ink no-underline hover:underline">
            {item.display_name ?? item.username ?? 'Anonymous'}
          </Link>
          <div className="font-body text-[11px] text-[#999]">
            {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        </div>
        <div className="ml-auto">
          <span className="font-display text-[22px] text-ink">{item.rating}</span>
          <span className="font-body text-[11px] text-[#999]">/10</span>
        </div>
      </div>
      {item.venue_id && (
        <Link to="/venue/$id" params={{ id: item.venue_id }} className="font-body font-bold text-[12px] text-brand-yellow uppercase tracking-[0.5px] no-underline mb-2 block">
          Review
        </Link>
      )}
      {item.body && <p className="font-body text-[14px] text-[#333] leading-[1.6]">{item.body}</p>}
    </div>
  )
}

function RankingCard({ item }: { item: PersonalRanking & { experience_name?: string; venue_name?: string; username?: string | null; display_name?: string | null } }) {
  const final = item.fans_score && item.food_score && item.unique_score && item.stadium_score
    ? Math.round((item.fans_score * 0.3 + item.food_score * 0.2 + item.unique_score * 0.25 + item.stadium_score * 0.25) * 10) / 10
    : null

  return (
    <div className="bg-white border-[3px] border-[#222] shadow-[4px_4px_0_#222] rounded-[8px] p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-[#e0e0e0] flex items-center justify-center font-display text-[16px] text-ink">
          {((item as any).display_name ?? (item as any).username ?? '?')[0].toUpperCase()}
        </div>
        <div>
          <Link to="/u/$username" params={{ username: (item as any).username ?? item.user_id }} className="font-body font-bold text-[14px] text-ink no-underline hover:underline">
            {(item as any).display_name ?? (item as any).username ?? 'Anonymous'}
          </Link>
          <div className="font-body text-[11px] text-[#999]">
            {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        </div>
        {final !== null && (
          <div className="ml-auto text-right">
            <div className="font-display text-[26px] text-brand-yellow">{final.toFixed(1)}</div>
            <div className="font-body text-[10px] text-[#999] uppercase tracking-[0.5px]">Score</div>
          </div>
        )}
      </div>
      <div className="font-body font-bold text-[13px] text-ink">{item.experience_name}</div>
      {item.venue_name && <div className="font-body text-[12px] text-[#666]">{item.venue_name}</div>}
      {item.notes && <p className="font-body text-[13px] text-[#555] mt-2 leading-[1.5]">{item.notes}</p>}
    </div>
  )
}

function FeedPage() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } = useInfiniteQuery<FeedPage>({
    queryKey: ['feed'],
    queryFn: ({ pageParam }) =>
      fetch(`/api/feed${pageParam ? `?cursor=${pageParam}` : ''}`).then(r => {
        if (r.status === 401) throw new Error('auth')
        return r.json()
      }),
    getNextPageParam: (last) => last.cursor ?? undefined,
    initialPageParam: undefined,
  })

  const items = data?.pages.flatMap(p => p.items) ?? []

  if (isError) {
    return (
      <>
        <SiteNav />
        <div className="container max-w-[700px] mx-auto px-[28px] py-20 text-center">
          <h2 className="font-display text-[28px] uppercase mb-4">Sign in to see your feed</h2>
          <p className="font-body text-[16px] text-[#666] mb-8">Follow fans to see their ratings and reviews here.</p>
          <Link to="/profile" className="bg-brand-yellow text-ink font-bold px-8 py-3 border-[3px] border-ink shadow-[4px_4px_0_#000] no-underline font-body uppercase tracking-[0.5px]">
            Sign In
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <SiteNav />

      <section className="grid-overlay bg-[#222] text-white pt-[44px] pb-[38px] relative overflow-hidden">
        <div className="container relative z-[1] max-w-[700px] mx-auto px-[28px]">
          <h1 className="font-display uppercase text-white tracking-[1px] leading-none text-[clamp(40px,5vw,72px)]">
            <span className="hl bg-brand-yellow text-ink px-[10px] shadow-[5px_5px_0_#000] inline-block">Following</span>
          </h1>
          <p className="text-[#d6d6d6] text-[16px] mt-4">Ratings and reviews from fans you follow.</p>
        </div>
      </section>

      <section className="py-[46px] bg-[#f4f4f4]">
        <div className="container max-w-[700px] mx-auto px-[28px]">
          {isLoading && (
            <div className="text-[#999] font-body text-[14px] text-center py-8">Loading feed...</div>
          )}
          {!isLoading && items.length === 0 && (
            <div className="text-center py-12">
              <p className="font-body text-[16px] text-[#666] mb-4">Nothing in your feed yet. Find fans to follow on their public profiles.</p>
              <Link to="/rankings" search={{ league: '', q: '', collection: '' }} className="text-brand-yellow font-bold no-underline font-body">Explore Rankings →</Link>
            </div>
          )}
          <div className="flex flex-col gap-4">
            {items.map((item, i) =>
              item.type === 'review'
                ? <ReviewCard key={`r-${i}`} item={item.data} />
                : <RankingCard key={`k-${i}`} item={item.data as any} />
            )}
          </div>
          {hasNextPage && (
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="w-full mt-8 py-3 border-[3px] border-[#222] bg-white font-body font-bold text-[14px] uppercase tracking-[0.5px] shadow-[4px_4px_0_#222] cursor-pointer hover:-translate-y-px hover:shadow-[6px_6px_0_#222] [transition:transform_.1s,box-shadow_.1s] disabled:opacity-50"
            >
              {isFetchingNextPage ? 'Loading...' : 'Load more'}
            </button>
          )}
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
