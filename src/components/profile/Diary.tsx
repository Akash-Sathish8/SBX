import { Link, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { MyRank } from '../../lib/myRankings'
import { SPORTS } from '../../lib/sports'
import { diaryDate } from './types'
import type { VenueIndex } from './useVenues'
import { BallotShareCard } from '../BallotShareCard'
import { ShareCardModal } from '../ShareCardModal'
import { block, blockHead, blockH2, count, empty, editMini } from './ui'

// Reverse-chronological diary of logged games (Letterboxd diary analog). Each row
// = date attended + matchup + venue + the score you gave it. The venue links to
// its page only when the stored name confidently matches a known venue. On YOUR
// OWN profile a row is actionable: click it to re-rate (deep-links into /rank's
// pre-filled panel) or share it as a rating card.
export function Diary({ rankings, venues, mine, handle }: { rankings: MyRank[]; venues: VenueIndex; mine: boolean; handle?: string | null }) {
  const rows = useMemo(
    () => [...rankings].sort((a, b) => (b.date < a.date ? -1 : b.date > a.date ? 1 : b.ts - a.ts)),
    [rankings],
  )

  // Pending share hands the card to ShareCardModal (native sheet / copy /
  // download on the pre-rendered PNG).
  const [share, setShare] = useState<MyRank | null>(null)

  return (
    <section className={block}>
      <div className={blockHead}>
        <h2 className={blockH2}>Diary <span className={count}>{rows.length}</span></h2>
        {mine ? <Button asChild variant="link" className={editMini}><Link to="/rank">+ Log a game</Link></Button> : null}
      </div>

      {rows.length === 0 ? (
        <div className={empty}>
          {mine ? <>No games logged yet. <Link to="/rank" className="font-extrabold !text-[#b58900] hover:!text-[#111]">Log your first →</Link></> : 'No games logged yet.'}
        </div>
      ) : (
        <div className="flex flex-col gap-[11px]">
          {rows.map((r) => <DiaryRow key={r.gameId} r={r} venues={venues} mine={mine} onShare={() => setShare(r)} sharing={share?.gameId === r.gameId} />)}
        </div>
      )}

      {share ? (
        <ShareCardModal
          filename={`snapback-rating-${share.gameId}.png`}
          title="Snapback"
          text="My gameday rating on Snapback"
          onClose={() => setShare(null)}
        >
          <BallotShareCard
            rows={[{ away: share.away, home: share.home, venue: share.venue, league: SPORTS[share.league]?.label ?? '', date: share.date, score: share.score }]}
            total={1}
            title="My Gameday Rating"
            handle={handle ?? null}
          />
        </ShareCardModal>
      ) : null}
    </section>
  )
}

function DiaryRow({ r, venues, mine, onShare, sharing }: { r: MyRank; venues: VenueIndex; mine: boolean; onShare: () => void; sharing: boolean }) {
  const navigate = useNavigate()
  const { day, year } = diaryDate(r.date)
  const v = venues.byName.get((r.venue ?? '').trim().toLowerCase())
  const logoImg = 'h-[22px]! w-[22px] flex-[0_0_auto] object-contain'
  const logo = (src?: string) => (src ? <img className={logoImg} src={src} alt="" width={22} height={22} loading="lazy" /> : <span className={logoImg + ' rounded-full bg-[#eee]'} aria-hidden="true" />)
  const venueEl = v
    ? <Link to="/venue" search={{ id: v.id }} className="font-extrabold !text-[#b58900] hover:!text-[#111]" onClick={(e) => e.stopPropagation()}>{r.venue}</Link>
    : <span>{r.venue}</span>
  const edit = () => navigate({ to: '/rank', search: { edit: r.gameId } })

  return (
    <div
      className={cn(
        'grid grid-cols-[64px_1fr_auto] items-center gap-[14px] rounded-[8px] border-[3px] border-[#222] bg-white px-[16px] py-[13px] shadow-[5px_5px_0_#222] max-[520px]:grid-cols-[52px_1fr_auto] max-[520px]:gap-[10px] max-[520px]:px-[13px] max-[520px]:py-[11px]',
        mine && 'cursor-pointer grid-cols-[64px_1fr_auto_auto] [transition:box-shadow_.12s,transform_.12s] hover:shadow-[7px_7px_0_0_#F7DF02] hover:[transform:translate(-1px,-1px)]',
      )}
      {...(mine ? { role: 'button', tabIndex: 0, title: 'Update your rating', onClick: edit, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter') edit() } } : {})}
    >
      <div className="text-center leading-[1.05]"><b className="block font-display text-[15px] tracking-[.5px] text-[#111]">{day}</b><span className="text-[11px] font-bold text-[#6b6b6b]">{year}</span></div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-[7px] text-[16px] font-extrabold leading-[1.15] text-[#222] max-[520px]:text-[15px]">
          {logo(r.awayLogo)}<span className="font-extrabold">{r.away}</span>
          <span className="text-[12px] font-bold text-[#6b6b6b]">@</span>
          {logo(r.homeLogo)}<span className="font-extrabold">{r.home}</span>
        </div>
        <div className="mt-[5px] text-[12px] font-semibold uppercase tracking-[.3px] text-[#6b6b6b]">
          {SPORTS[r.league]?.label ?? r.league} · {venueEl}{r.city ? <> · {r.city}</> : null}
          {mine ? <> · <span className="font-extrabold text-[#b6a900]">edit rating</span></> : null}
        </div>
      </div>
      {mine ? (
        <Button variant="outline" className="h-auto rounded-[999px] border-2 border-[#111] bg-white px-[12px] py-[6px] text-[11px] font-extrabold tracking-[.5px] whitespace-nowrap text-[#111] hover:bg-brand hover:text-[#111] disabled:opacity-60" disabled={sharing} onClick={(e) => { e.stopPropagation(); onShare() }}>
          {sharing ? '…' : '↓ Share'}
        </Button>
      ) : null}
      <div className="flex min-w-[58px] items-center justify-center rounded-[7px] bg-[#222] px-[13px] py-[7px] max-[520px]:min-w-[50px] max-[520px]:px-[10px] max-[520px]:py-[6px]"><span className="font-display text-[22px] leading-none text-brand max-[520px]:text-[19px]">{r.score.toFixed(1)}</span></div>
    </div>
  )
}
