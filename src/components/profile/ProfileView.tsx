import { useMemo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar } from './Avatar'
import { FavoritesRow } from './FavoritesRow'
import { Diary } from './Diary'
import { ProfileStats } from './ProfileStats'
import { MyReviews } from './MyReviews'
import type { ProfileData } from './types'
import type { VenueIndex } from './useVenues'
import { container, notchBtn } from './ui'

const statB = 'mr-[4px] font-display text-[18px] tracking-[.5px] text-brand'

// The whole profile body — shared by the signed-in self view (/profile) and the
// public view (/u/$username). `mine` toggles the edit affordances; `headerAction`
// is where the public view slots its Follow button.
export function ProfileView({ data, mine, venues, onEdit, headerAction }: {
  data: ProfileData
  mine: boolean
  venues: VenueIndex
  onEdit?: () => void
  headerAction?: ReactNode
}) {
  const summary = useMemo(() => {
    const games = data.rankings.length
    const venuesN = new Set(data.rankings.map((r) => (r.venue ?? '').trim().toLowerCase()).filter(Boolean)).size
    const avg = games ? data.rankings.reduce((s, r) => s + r.score, 0) / games : 0
    return { games, venuesN, avg }
  }, [data.rankings])

  const sinceYear = data.createdAt ? new Date(data.createdAt).getFullYear() : null
  const hasSocial = typeof data.followers === 'number' || typeof data.following === 'number'
  const shownName = data.displayName || data.username || 'Fan'

  return (
    <>
      <section className="relative overflow-hidden bg-[#222] pt-[34px] pb-[30px] text-white after:pointer-events-none after:absolute after:inset-0 after:bg-size-[32px_32px] after:[background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] after:content-['']">
        <div className={container + ' relative z-[1] flex flex-wrap items-center gap-[22px] max-[520px]:gap-[16px]'}>
          <Avatar avatar={data.avatar} name={shownName} size={92} />
          <div className="min-w-0 flex-[1_1_240px]">
            <h1 className="font-display text-[clamp(28px,5vw,44px)] uppercase leading-none tracking-[1px] !text-white [overflow-wrap:anywhere]">{shownName}</h1>
            {data.displayName && data.username ? <div className="mt-[3px] text-[13px] font-bold tracking-[.4px] text-[#9a9a9a]">@{data.username}</div> : null}
            {data.bio ? <p className="mt-[8px] max-w-[60ch] text-[15px] leading-[1.5] text-[#dcdcdc]">{data.bio}</p> : mine ? <p className="mt-[8px] max-w-[60ch] text-[15px] leading-[1.5] text-[#9a9a9a] italic">Add a bio so fans know what you’re about.</p> : null}
            <div className="mt-[12px] flex flex-wrap gap-[18px] text-[14px] text-[#cfcfcf]">
              <span><b className={statB}>{summary.games}</b> games</span>
              <span><b className={statB}>{summary.venuesN}</b> venues</span>
              <span><b className={statB}>{summary.avg ? summary.avg.toFixed(1) : '–'}</b> avg</span>
              {hasSocial ? (
                <>
                  <span><b className={statB}>{data.followers ?? 0}</b> followers</span>
                  <span><b className={statB}>{data.following ?? 0}</b> following</span>
                </>
              ) : null}
            </div>
            {sinceYear ? <div className="mt-[9px] text-[12px] font-bold uppercase tracking-[.6px] text-[#8f8f8f]">Member since {sinceYear}</div> : null}
          </div>
          <div className="flex flex-wrap items-center gap-[10px] max-[760px]:ml-0 max-[760px]:w-full ml-auto">
            {mine ? <Button variant="brand" className={notchBtn} onClick={onEdit}>Edit profile</Button> : null}
            {headerAction}
          </div>
        </div>
      </section>

      <div className="pt-[30px] pb-[70px]">
        <div className={container}>
          <FavoritesRow favorites={data.favorites} venues={venues} mine={mine} onEdit={onEdit} />
          <Diary rankings={data.rankings} venues={venues} mine={mine} handle={data.username} />
          <ProfileStats rankings={data.rankings} />
          <MyReviews reviews={data.reviews} venues={venues} mine={mine} />
        </div>
      </div>
    </>
  )
}
