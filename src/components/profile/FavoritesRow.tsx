import { Link } from '@tanstack/react-router'
import type { VenueIndex } from './useVenues'

// The 4 pinned "favorite venues" posters. Favorite ids resolve to a venue photo
// (or a team-color gradient fallback) via the shared venue index. Empty + mine =>
// a prompt to pin some; empty + public => the section is hidden.
export function FavoritesRow({ favorites, venues, mine, onEdit }: {
  favorites: string[]
  venues: VenueIndex
  mine: boolean
  onEdit?: () => void
}) {
  if (!favorites.length) {
    if (!mine) return null
    return (
      <section className="pf-block">
        <div className="pf-blockhead"><h2>Favorite venues</h2></div>
        <button className="pf-fav-empty" onClick={onEdit}>+ Pin up to 4 favorite venues</button>
      </section>
    )
  }

  return (
    <section className="pf-block">
      <div className="pf-blockhead">
        <h2>Favorite venues</h2>
        {mine ? <button className="pf-edit-mini" onClick={onEdit}>Edit</button> : null}
      </div>
      <div className="pf-fav-row">
        {favorites.slice(0, 4).map((id) => {
          const v = venues.byId.get(id)
          const accent = v?.teams?.[0]?.logo ? undefined : '#3a3a3a'
          return (
            <Link key={id} to="/venue" search={{ id }} className="pf-fav">
              <div className="pf-fav-img" style={v?.image ? { backgroundImage: `url('${v.image}')` } : { background: `linear-gradient(150% 120% at 50% -10%, ${accent ?? '#2a2a2a'}, #0a0a0a 75%)` }} />
              <div className="pf-fav-name">{v?.name ?? 'Venue'}</div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
