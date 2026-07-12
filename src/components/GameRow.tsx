import { Link } from '@tanstack/react-router'
import { intentWarm, warmImage } from '../lib/dataCache'
import { SPORTS } from '../lib/sports'
import type { Game, GameTeam } from '../lib/espn'

// Shared clickable game row (/games list, /weekend slate, team pages, next-hop
// modules). Self-contained Tailwind — was pages/gamerow.css until the v4
// migration; colors are the literals the legacy bridge resolved (--k #222222,
// --y #f7df02, --ink #141410, --gray #6b6b6b).

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function dateChip(iso: string) {
  if (!iso) return { wd: '', md: '' }
  const d = new Date(iso)
  if (isNaN(d.getTime())) return { wd: '', md: '' }
  return { wd: WD[d.getDay()], md: MON[d.getMonth()] + ' ' + d.getDate() }
}

export const kickoff = (iso: string) => {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export const matchText = (g: Game) =>
  [g.home.displayName, g.away.displayName, g.home.location, g.away.location, g.venue.name, g.venue.city, SPORTS[g.league].label]
    .filter(Boolean).join(' ').toLowerCase()

function TeamCell({ t, align }: { t: GameTeam; align: 'l' | 'r' }) {
  const logo = t.logo ? <img className="h-[24px]! w-[24px] flex-[0_0_auto] object-contain" src={t.logo} alt="" width={24} height={24} loading="lazy" /> : null
  const name = <span className="font-extrabold">{t.location || t.displayName}</span>
  return (
    <span className="inline-flex items-center gap-[8px] whitespace-nowrap">
      {align === 'l' ? <>{logo}{name}</> : <>{name}{logo}</>}
    </span>
  )
}

// .grow — the card. before: is the yellow left accent bar.
const row =
  "relative grid grid-cols-[58px_1fr_auto] items-center gap-[18px] rounded-[8px] border-[3px] border-[#222222] bg-white pt-[14px] pr-[18px] pb-[14px] pl-[26px] mb-[13px] cursor-pointer [content-visibility:auto] [contain-intrinsic-size:auto_92px] [transition:box-shadow_.15s,transform_.12s] hover:shadow-[9px_9px_0_0_#f7df02] hover:[transform:translate(-1px,-1px)] shadow-[6px_6px_0_0_#222222] " +
  "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[8px] before:rounded-[5px_0_0_5px] before:bg-[#f7df02] before:content-[''] " +
  "max-[760px]:grid-cols-[56px_1fr]"

export function GameRow({ g }: { g: Game }) {
  const c = dateChip(g.date)
  const live = g.state === 'in'
  const done = g.state === 'post'
  const showScore = (live || done) && g.home.score !== null && g.away.score !== null
  const warm = () => { if (g.home.logo) warmImage(g.home.logo); if (g.away.logo) warmImage(g.away.logo) }
  // .gr-ft — corner "Final"/"Live" badge; when present, keep the round line clear of it on mobile.
  const ftBase = 'absolute top-[8px] right-[10px] z-[2] rounded-[5px] px-[7px] py-[2px] text-[9.5px] font-extrabold uppercase leading-[1.2] tracking-[.5px]'
  return (
    <Link to="/game" search={{ id: g.id, league: g.league }} className={row} {...intentWarm(warm)}>
      {done ? <span className={ftBase + ' border-[1.5px] border-[#111] bg-[#f7df02] text-[#111]'}>Final</span> : null}
      {live ? <span className={ftBase + ' border-[1.5px] border-[#e8362c] bg-[#e8362c] text-white'}>{g.detail || 'Live'}</span> : null}
      <div className="flex flex-col items-start justify-center">
        <span className="text-[10px] font-extrabold uppercase tracking-[.6px] text-[#9a7e00]">{c.wd}</span>
        <span className="font-display text-[19px] leading-none tracking-[.3px] text-[#111]">{c.md}</span>
      </div>
      <div className="min-w-0">
        <div className={'text-[10.5px] font-extrabold uppercase tracking-[.6px] text-[#111]' + (done || live ? ' max-[760px]:pr-[66px]' : '')}>{SPORTS[g.league].label}</div>
        <div className="mt-[3px] flex flex-wrap items-center gap-x-[9px] gap-y-[1px] text-[19px] font-extrabold leading-[1.12] text-[#141410]">
          <TeamCell t={g.away} align="l" />
          {showScore
            ? <span className="inline-flex items-center gap-[5px] text-[18px] font-extrabold text-[#141410]">{g.away.score}<span className="font-bold text-[#6b6b6b]">–</span>{g.home.score}</span>
            : <span className="text-[14px] font-bold text-[#6b6b6b]">@</span>}
          <TeamCell t={g.home} align="r" />
        </div>
        <div className="mt-[4px] text-[12.5px] font-semibold uppercase tracking-[.3px] text-[#6b6b6b]">{g.venue.name}{g.venue.city ? ' · ' + g.venue.city : ''}{g.state === 'pre' && kickoff(g.date) ? ' · ' + kickoff(g.date) : ''}</div>
      </div>
      <div className="flex flex-[0_0_auto] items-center gap-[14px] max-[760px]:col-start-2 max-[760px]:mt-[2px] max-[760px]:justify-start">
        <span className="whitespace-nowrap text-[12px] font-extrabold uppercase tracking-[.5px] text-[#111]">{done ? 'Recap →' : live ? 'Watch →' : 'Game info →'}</span>
      </div>
    </Link>
  )
}
