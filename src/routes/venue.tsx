import { useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteNav } from '../components/SiteNav'
import { PageCssGuard } from '../components/PageCssGuard'
import { getJSON, getJSONFresh, warmImage } from '../lib/dataCache'
import { SPORTS } from '../lib/sports'
import type { Venue, Game } from '../lib/espn'
import { WhatToKnow } from '../components/WhatToKnow'
import { ExpertNotes } from '../components/ExpertNotes'
import { Reviews, type VenueRatings } from '../components/Reviews'
import { useAuth } from '../components/auth/AuthProvider'
import { loadMyRankings } from '../lib/myRankings'
import type { Experience } from '../lib/experiences'
import { matchExperienceForVenue } from '../lib/experienceMatch'
import { GamesThatWeekend, NearbyVenues } from '../components/NextHops'
import css from '../pages/venue.css?url'
import rowCss from '../pages/gamerow.css?url'
import nexthopCss from '../pages/nexthop.css?url'

// The fan ranking for this venue: averaged across every signed-in fan who ranked
// a game here (served by /api/venue-stats). `count` is 0 until anyone has.
interface FanStats { count: number; fans: number; food: number; unique: number; stadium: number; score: number }

export const Route = createFileRoute('/venue')({
  // Coerce to string: TanStack's default parser turns a numeric ?id=3687 into the
  // number 3687, which a `typeof === 'string'` check would drop (breaks direct
  // loads / shared links to venues whose ESPN id is all digits).
  // `?review=1` is the post-rank handoff from /rank: open the review form + scroll.
  // Kept optional so every existing `<Link to="/venue" search={{ id }}>` stays valid.
  validateSearch: (s: Record<string, unknown>) => {
    const out: { id: string; review?: 1 } = { id: s.id != null ? String(s.id) : '' }
    if (s.review === '1' || s.review === 1) out.review = 1
    return out
  },
  head: () => ({
    links: [
      { rel: 'stylesheet', href: css, 'data-page-css': 'venue' },
      { rel: 'stylesheet', href: rowCss, 'data-page-css': 'games weekend team game venue' },
      { rel: 'stylesheet', href: nexthopCss, 'data-page-css': 'venue game' },
    ],
    meta: [{ title: 'Snapback — Venue' }],
  }),
  component: VenuePage,
})

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function fmt(iso: string) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${WD[d.getDay()]} ${MON[d.getMonth()]} ${d.getDate()}`
}
const kickoff = (iso: string) => {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function VenuePage() {
  const { id: rawId, review } = Route.useSearch()
  const id = (rawId || '').replace(/[^a-z0-9_-]/gi, '')
  const [venue, setVenue] = useState<Venue | null | undefined>(undefined) // undefined = loading
  const [games, setGames] = useState<Game[] | null>(null)

  useEffect(() => {
    if (!id) return
    let alive = true
    setVenue(undefined)
    getJSON('/api/venues')
      .then((r: any) => {
        const v = (Array.isArray(r?.data) ? r.data : []).find((x: Venue) => x.id === id) ?? null
        if (alive) { setVenue(v); if (v) { document.title = 'Snapback — ' + v.name; if (v.image) warmImage(v.image); v.teams.forEach((t: any) => t.logo && warmImage(t.logo)) } }
      })
      .catch(() => { if (alive) setVenue(null) })
    getJSON('/api/games')
      .then((r: any) => { if (alive) setGames(Array.isArray(r?.data) ? r.data : []) })
      .catch(() => { if (alive) setGames([]) })
    return () => { alive = false }
  }, [id])

  return (
    <>
      <PageCssGuard id="venue" />
      <SiteNav active="venues" />
      <main id="app">{renderBody()}</main>
      <footer>
        <div className="container">© 2026 Snapback Sports — Venues. <Link to="/venues">← All venues</Link></div>
      </footer>
    </>
  )

  function renderBody() {
    if (!id) return <div className="loadwrap">No venue selected. <Link to="/venues" className="ulink">Back to venues →</Link></div>
    if (venue === undefined) return <div className="loadwrap">Loading venue…</div>
    if (venue === null) return <div className="loadwrap">Couldn't load this venue. <Link to="/venues" className="ulink">Back to venues →</Link></div>
    return <VenueContent v={venue} games={games} review={review === 1} />
  }
}

function VenueContent({ v, games, review }: { v: Venue; games: Game[] | null; review: boolean }) {
  const { user } = useAuth()
  const forumRef = useRef<HTMLElement>(null)
  // The fan's own pillar scores for THIS venue (matched by name — a ranked game
  // only stores the venue name), surfaced on the review card while they write.
  const [myRating, setMyRating] = useState<VenueRatings | null>(null)
  useEffect(() => {
    const mine = loadMyRankings().find((m) => m.venue === v.name)
    setMyRating(mine ? { fans: mine.fans, food: mine.food, unique: mine.unique, stadium: mine.stadium, score: mine.score } : null)
  }, [v.name])

  // Snapback ranking (the expert experience-rankings) + the live fan-average.
  const [exps, setExps] = useState<Experience[] | null>(null)
  const [fan, setFan] = useState<FanStats | null>(null)
  useEffect(() => {
    let alive = true
    getJSON('/data/experiences.json').then((r: any) => { if (alive) setExps(Array.isArray(r?.experiences) ? r.experiences : []) }).catch(() => { if (alive) setExps([]) })
    // Fan stats are LIVE (they change the moment a fan submits a score), so bypass
    // the session-forever getJSON memo — otherwise the Fan Score shows a stale value
    // after you rank a game until a full reload.
    getJSONFresh('/api/venue-stats?venue=' + encodeURIComponent(v.name)).then((r: any) => { if (alive) setFan(r?.ok ? r.data : null) }).catch(() => { if (alive) setFan(null) })
    return () => { alive = false }
  }, [v.name])

  // Match this venue to an expert experience (shared logic: pinned override
  // first, then team-name auto-match; event experiences stay unmatched — honest gap).
  const snap = useMemo(() => (exps ? matchExperienceForVenue(v, exps) : null), [exps, v])
  const hasFan = !!fan && fan.count > 0

  // Post-rank handoff (?review=1): land on the open form by scrolling the forum in.
  useEffect(() => {
    if (review && forumRef.current) forumRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [review])

  const tenantAbbrs = new Set(v.teams.map((t) => t.abbr))
  const here = useMemo(() => {
    if (!games) return null
    return games
      .filter((g) => g.venue.name === v.name || tenantAbbrs.has(g.home.abbr))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [games, v.name])

  const accent = (v.teams[0] as any)?.color
  const hasPhoto = !!v.image
  const leanStyle = accent ? { background: `radial-gradient(120% 140% at 50% -10%, ${accent}, #0a0a0a 70%)` } : undefined

  return (
    <>
      <section className={'hero' + (hasPhoto ? '' : ' lean')} style={hasPhoto ? undefined : leanStyle}>
        {hasPhoto ? <div className="bg" style={{ backgroundImage: `url('${v.image}')` }} /> : null}
        <Link className="back" to="/venues">← All venues</Link>
        <div className="container">
          <div className="vlogos-hero">
            {v.teams.map((t) => (t.logo ? <img key={t.id} src={t.logo} alt={t.displayName} width={72} height={72} /> : null))}
          </div>
          <div className="heyebrow">
            <span className="pillcity">{[v.city, v.state].filter(Boolean).join(', ')}</span>
          </div>
          <div className="vhero-row">
            <div className="vhero-title">
              <h1>{v.name}</h1>
              <div className="altname">Home of <b>{v.teams.map((t) => t.displayName).join(' · ')}</b></div>
            </div>
            <div className="vscores">
              {snap ? (
                <div className="vscore snap">
                  <div className="lab"><img className="cap" src="/img/logo.png" alt="" width={18} height={18} /> Snapback Score</div>
                  <div className="val">{snap.final.toFixed(1)}</div>
                  <div className="sub">Expert-rated · #{snap.rank}</div>
                </div>
              ) : null}
              <div className="vscore">
                <div className="lab">Fan Score</div>
                <div className="val">{hasFan ? fan!.score.toFixed(1) : '—'}</div>
                <div className="sub">{hasFan ? `${fan!.count} fan ${fan!.count === 1 ? 'rating' : 'ratings'}` : 'Be the first to rank it'}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT DO I NEED TO KNOW — the crowdsourced info-discovery core */}
      <section className="block tint" ref={forumRef}><div className="container">
        <div className="eyebrow">Snapback · crowdsourced</div>
        <h2 className="shead">What do I need to know?</h2>
        <div className="ssub">Insider tips &amp; reviews from fans who've actually been to {v.name}</div>
        <ExpertNotes scope="venue" targetId={v.id} />
        <div className="wtk-layout">
          <WhatToKnow scope="venue" targetId={v.id} />
          <Reviews
            scope="venue"
            targetId={v.id}
            venueRatings={myRating}
            defaultRating={myRating ? Math.round(myRating.score) : null}
            startOpen={review && !!user}
          />
        </div>
      </div></section>

      <section className="block"><div className="container">
        <div className="eyebrow">On the schedule</div>
        <h2 className="shead">Games here</h2>
        <div className="ssub">Upcoming &amp; recent at {v.name}</div>
        {here === null ? <div className="elead">Loading games…</div> : null}
        {here && !here.length ? <div className="elead">No games on the schedule here right now.</div> : null}
        {here && here.length ? (
          <div className="vgames">
            {here.slice(0, 20).map((g) => (
              <Link key={g.id} to="/game" search={{ id: g.id, league: g.league }} className="vgrow">
                <span className="vg-lg">{SPORTS[g.league].label}</span>
                <span className="vg-match">{g.away.location || g.away.displayName} <span className="vg-at">@</span> {g.home.location || g.home.displayName}</span>
                <span className="vg-when">{g.state === 'post' ? 'Final' : g.state === 'in' ? (g.detail || 'Live') : `${fmt(g.date)} · ${kickoff(g.date)}`}</span>
              </Link>
            ))}
          </div>
        ) : null}
      </div></section>

      {/* Next hops — the journey continues from here (other games nearby that
          weekend + venues worth adding to the same trip). */}
      <GamesThatWeekend city={v.city} excludeVenueName={v.name} />
      <NearbyVenues city={v.city} state={v.state} excludeId={v.id} />
    </>
  )
}
