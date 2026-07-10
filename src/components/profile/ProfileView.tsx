import { useMemo, type ReactNode } from 'react'
import { Avatar } from './Avatar'
import { FavoritesRow } from './FavoritesRow'
import { Diary } from './Diary'
import { ProfileStats } from './ProfileStats'
import { MyReviews } from './MyReviews'
import type { ProfileData } from './types'
import type { VenueIndex } from './useVenues'

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
      <section className="pf-hero">
        <div className="container pf-hero-in">
          <Avatar avatar={data.avatar} name={shownName} size={92} />
          <div className="pf-id">
            <h1 className="pf-name">{shownName}</h1>
            {data.displayName && data.username ? <div className="pf-handle">@{data.username}</div> : null}
            {data.bio ? <p className="pf-bio-text">{data.bio}</p> : mine ? <p className="pf-bio-text muted">Add a bio so fans know what you’re about.</p> : null}
            <div className="pf-statline">
              <span><b>{summary.games}</b> games</span>
              <span><b>{summary.venuesN}</b> venues</span>
              <span><b>{summary.avg ? summary.avg.toFixed(1) : '–'}</b> avg</span>
              {hasSocial ? (
                <>
                  <span><b>{data.followers ?? 0}</b> followers</span>
                  <span><b>{data.following ?? 0}</b> following</span>
                </>
              ) : null}
            </div>
            {sinceYear ? <div className="pf-since">Member since {sinceYear}</div> : null}
          </div>
          <div className="pf-hero-actions">
            {mine ? <button className="pf-edit" onClick={onEdit}>Edit profile</button> : null}
            {headerAction}
          </div>
        </div>
      </section>

      <div className="pf-body">
        <div className="container">
          <FavoritesRow favorites={data.favorites} venues={venues} mine={mine} onEdit={onEdit} />
          <Diary rankings={data.rankings} venues={venues} mine={mine} />
          <ProfileStats rankings={data.rankings} />
          <MyReviews reviews={data.reviews} venues={venues} mine={mine} />
        </div>
      </div>
    </>
  )
}
