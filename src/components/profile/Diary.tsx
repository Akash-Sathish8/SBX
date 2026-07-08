import { Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import type { MyRank } from '../../lib/myRankings'
import { SPORTS } from '../../lib/sports'
import { diaryDate } from './types'
import type { VenueIndex } from './useVenues'

// Reverse-chronological diary of logged games (Letterboxd diary analog). Each row
// = date attended + matchup + venue + the score you gave it. The venue links to
// its page only when the stored name confidently matches a known venue.
export function Diary({ rankings, venues, mine }: { rankings: MyRank[]; venues: VenueIndex; mine: boolean }) {
  const rows = useMemo(
    () => [...rankings].sort((a, b) => (b.date < a.date ? -1 : b.date > a.date ? 1 : b.ts - a.ts)),
    [rankings],
  )

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
          {rows.map((r) => <DiaryRow key={r.gameId} r={r} venues={venues} />)}
        </div>
      )}
    </section>
  )
}

function DiaryRow({ r, venues }: { r: MyRank; venues: VenueIndex }) {
  const { day, year } = diaryDate(r.date)
  const v = venues.byName.get((r.venue ?? '').trim().toLowerCase())
  const logo = (src?: string) => (src ? <img className="pf-logo" src={src} alt="" width={22} height={22} loading="lazy" /> : <span className="pf-logo ph" aria-hidden="true" />)
  const venueEl = v
    ? <Link to="/venue" search={{ id: v.id }} className="pf-d-venuelink">{r.venue}</Link>
    : <span>{r.venue}</span>

  return (
    <div className="pf-d-row">
      <div className="pf-d-date"><b>{day}</b><span>{year}</span></div>
      <div className="pf-d-mid">
        <div className="pf-d-teams">
          {logo(r.awayLogo)}<span className="pf-tn">{r.away}</span>
          <span className="pf-at">@</span>
          {logo(r.homeLogo)}<span className="pf-tn">{r.home}</span>
        </div>
        <div className="pf-d-meta">{SPORTS[r.league]?.label ?? r.league} · {venueEl}{r.city ? <> · {r.city}</> : null}</div>
      </div>
      <div className="pf-d-score"><span className="pf-sv">{r.score.toFixed(1)}</span></div>
    </div>
  )
}
