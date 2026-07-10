import { Link, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import type { MyRank } from '../../lib/myRankings'
import { SPORTS } from '../../lib/sports'
import { diaryDate } from './types'
import type { VenueIndex } from './useVenues'
import { BallotShareCard } from '../BallotShareCard'
import { ShareCardModal } from '../ShareCardModal'

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
    <section className="pf-block">
      <div className="pf-blockhead">
        <h2>Diary <span className="pf-count">{rows.length}</span></h2>
        {mine ? <Link to="/rank" className="pf-edit-mini">+ Log a game</Link> : null}
      </div>

      {rows.length === 0 ? (
        <div className="pf-empty">
          {mine ? <>No games logged yet. <Link to="/rank">Log your first →</Link></> : 'No games logged yet.'}
        </div>
      ) : (
        <div className="pf-diary">
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
  const logo = (src?: string) => (src ? <img className="pf-logo" src={src} alt="" width={22} height={22} loading="lazy" /> : <span className="pf-logo ph" aria-hidden="true" />)
  const venueEl = v
    ? <Link to="/venue" search={{ id: v.id }} className="pf-d-venuelink" onClick={(e) => e.stopPropagation()}>{r.venue}</Link>
    : <span>{r.venue}</span>
  const edit = () => navigate({ to: '/rank', search: { edit: r.gameId } })

  return (
    <div
      className={'pf-d-row' + (mine ? ' clickable' : '')}
      {...(mine ? { role: 'button', tabIndex: 0, title: 'Update your rating', onClick: edit, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter') edit() } } : {})}
    >
      <div className="pf-d-date"><b>{day}</b><span>{year}</span></div>
      <div className="pf-d-mid">
        <div className="pf-d-teams">
          {logo(r.awayLogo)}<span className="pf-tn">{r.away}</span>
          <span className="pf-at">@</span>
          {logo(r.homeLogo)}<span className="pf-tn">{r.home}</span>
        </div>
        <div className="pf-d-meta">
          {SPORTS[r.league]?.label ?? r.league} · {venueEl}{r.city ? <> · {r.city}</> : null}
          {mine ? <> · <span className="pf-edithint">edit rating</span></> : null}
        </div>
      </div>
      {mine ? (
        <button className="pf-d-share" disabled={sharing} onClick={(e) => { e.stopPropagation(); onShare() }}>
          {sharing ? '…' : '↓ Share'}
        </button>
      ) : null}
      <div className="pf-d-score"><span className="pf-sv">{r.score.toFixed(1)}</span></div>
    </div>
  )
}
