import { Link } from '@tanstack/react-router'
import { warmImage, intentWarm } from '../lib/dataCache'
import { NATION_FLAG, type VenueMeta } from '../lib/venues-meta'

type VenueCardProps = {
  v: VenueMeta
  className?: string
  photoClassName?: string
  /** Light = venues grid on white; dark = home marquee on #222 band. */
  tone?: 'light' | 'dark'
  hidden?: boolean
}

const FRAME =
  'border-4 border-[#222222] shadow-[8px_8px_0_0_#222222] transition-[transform,box-shadow] duration-150 hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[11px_11px_0_0_#222222]'
// #222 border/shadow vanish on the browse band — pure black reads the same as venues cards do on white.
const FRAME_ON_DARK =
  'border-4 border-black shadow-[8px_8px_0_0_#000000] transition-[transform,box-shadow] duration-150 hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[11px_11px_0_0_#000000]'

export function VenueCard({
  v,
  className = '',
  photoClassName = 'h-[178px]',
  tone = 'light',
  hidden,
}: VenueCardProps) {
  const frame = tone === 'dark' ? FRAME_ON_DARK : FRAME
  return (
    <Link
      to="/venue/$id"
      params={{ id: v.img }}
      className={`vcard group block bg-white rounded-[8px] overflow-hidden text-inherit no-underline opacity-100 ${frame} ${className}`}
      aria-hidden={hidden ? 'true' : undefined}
      tabIndex={hidden ? -1 : undefined}
      {...intentWarm(() => warmImage(`/img/stadiums/${v.img}.jpg`))}
    >
      <div className={`photo ${photoClassName} bg-[#0d0d0d] relative after:content-[''] after:absolute after:inset-0 after:[background:linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.35))]`}>
        <img
          className="photo-img absolute inset-0 w-full h-full object-cover object-center block"
          src={`/img/stadiums/${v.img}.jpg`}
          alt=""
          loading="lazy"
          decoding="async"
        />
        <span className="citytag absolute left-[12px] top-[12px] z-[2] bg-[#222222] text-white font-bold text-[11px] tracking-[0.5px] uppercase px-[10px] py-[5px] rounded-[3px] inline-flex items-center gap-[6px]">
          <span className="flag text-[14px] leading-none">{NATION_FLAG[v.cc]}</span>
          {v.city}
        </span>
        {v.role ? (
          <span className="role absolute right-[12px] top-[12px] z-[2] bg-brand-yellow text-ink font-extrabold text-[10px] tracking-[0.6px] uppercase px-[9px] py-[5px] rounded-[3px] shadow-[3px_3px_0_#000]">
            {v.role}
          </span>
        ) : null}
      </div>
      <div className="body pt-[15px] px-[18px] pb-[17px]">
        <div className="name font-display text-[23px] text-[#222222] tracking-[0.6px] leading-[1.05]">{v.name}</div>
        <div className="meta text-[13px] text-[#6b6b6b] font-semibold mt-[6px] uppercase tracking-[0.4px]">
          {v.city} · {v.cc}
        </div>
      </div>
    </Link>
  )
}
