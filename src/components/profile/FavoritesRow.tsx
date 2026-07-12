import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import type { VenueIndex } from './useVenues'
import { block, blockHead, blockH2, editMini } from './ui'

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
      <section className={block}>
        <div className={blockHead}><h2 className={blockH2}>Favorite venues</h2></div>
        <button className="w-full cursor-pointer rounded-[8px] border-2 border-dashed border-[#bbb] bg-[#fbfbfb] p-[18px] text-left text-[14px] font-bold text-[#888] hover:border-[#888] hover:text-[#555]" onClick={onEdit}>+ Pin up to 4 favorite venues</button>
      </section>
    )
  }

  return (
    <section className={block}>
      <div className={blockHead}>
        <h2 className={blockH2}>Favorite venues</h2>
        {mine ? <Button variant="link" className={editMini} onClick={onEdit}>Edit</Button> : null}
      </div>
      <div className="grid grid-cols-4 gap-[14px] max-[760px]:grid-cols-2">
        {favorites.slice(0, 4).map((id) => {
          const v = venues.byId.get(id)
          const accent = v?.teams?.[0]?.logo ? undefined : '#3a3a3a'
          return (
            <Link key={id} to="/venue" search={{ id }} className="block overflow-hidden rounded-[8px] border-[3px] border-[#222] bg-[#111] shadow-[5px_5px_0_#222] [transition:transform_80ms,box-shadow_120ms] active:[transform:translate(2px,2px)] active:shadow-[3px_3px_0_#222]">
              <div className="aspect-4/3 bg-cover bg-center" style={v?.image ? { backgroundImage: `url('${v.image}')` } : { background: `linear-gradient(150% 120% at 50% -10%, ${accent ?? '#2a2a2a'}, #0a0a0a 75%)` }} />
              <div className="overflow-hidden bg-[#111] px-[10px] py-[8px] text-[13px] font-extrabold text-ellipsis whitespace-nowrap text-white">{v?.name ?? 'Venue'}</div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
