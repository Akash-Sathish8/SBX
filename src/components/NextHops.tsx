import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { getJSON, intentWarm, warmImage } from '../lib/dataCache'
import { LEAGUES } from '../lib/sports'
import { cardImg } from '../lib/img'
import { cn } from '../lib/utils'
import { block, container, eyebrow, shead } from '../lib/ui'
import { FanScorePill, useFanScores } from './FanScore'
import { matchExperienceForVenue, matchExperienceForTeam } from '../lib/experienceMatch'
import type { Game, Venue } from '../lib/espn'
import type { Experience } from '../lib/experiences'

// "Next hop" modules for detail pages — the journey continues from every venue
// and game. All real data: games/venues from D1 (one cached fetch per identical
// window), experiences via the shared matcher. Empty states are honest lines.
// Self-contained Tailwind (was pages/nexthop.css + the .block/.eyebrow/.shead
// chrome the host pages used to supply); GameRow carries its own styles.

// block / container / eyebrow / shead now come from src/lib/ui (shared chrome).
const nhSub = 'mt-[-4px] mb-[16px] text-[13px] font-semibold text-[#76766c]'
const nhEmpty = 'pt-[6px] pb-[10px] text-[14.5px] font-semibold text-[#76766c]'

// The ranked-experience card for a game's venue/home team (venue pages already
// surface their Snapback Score in the hero, so this module is for /game).
export function RelatedExperience({ g }: { g: Game }) {
  const [exps, setExps] = useState<Experience[] | null>(null)
  const [venues, setVenues] = useState<Venue[] | null>(null)
  useEffect(() => {
    let alive = true
    getJSON('/data/experiences.json').then((r: any) => { if (alive) setExps(Array.isArray(r?.experiences) ? r.experiences : []) }).catch(() => { if (alive) setExps([]) })
    getJSON('/api/venues').then((r: any) => { if (alive) setVenues(Array.isArray(r?.data) ? r.data : []) }).catch(() => { if (alive) setVenues([]) })
    return () => { alive = false }
  }, [])

  const hit = useMemo(() => {
    if (!exps || !exps.length) return null
    const venue = venues?.find((v) => v.name === g.venue.name)
    if (venue) { const m = matchExperienceForVenue(venue, exps); if (m) return { m, venueId: venue.id } }
    const m = matchExperienceForTeam(g.home.displayName, exps)
    return m ? { m, venueId: venues?.find((v) => v.name === g.venue.name)?.id } : null
  }, [exps, venues, g])

  // Real or nothing: no match → no module (never an invented score).
  if (!hit) return null
  return (
    <section className={block}><div className={container}>
      <div className={eyebrow}>Expert-rated</div>
      <h2 className={cn(shead, '!mb-[20px]')}>How this trip rates</h2>
      <Link to="/rankings" search={{ q: hit.m.name }} className="flex max-w-[520px] flex-col gap-[4px] rounded-[10px] border-[3px] border-[#222222] bg-[#111] px-[18px] py-[16px] text-white! shadow-[6px_6px_0_0_#f7df02] [transition:box-shadow_.15s,transform_.12s] hover:shadow-[9px_9px_0_0_#f7df02] hover:[transform:translate(-1px,-1px)]">
        <span className="flex items-center gap-[7px] text-[11px] font-extrabold uppercase tracking-[.8px] text-[#f7df02]"><img src="/img/logo.png" alt="" width={18} height={18} className="rounded-[4px]" /> Snapback Score</span>
        <span className="font-display text-[38px] tracking-[.5px] text-[#f7df02]">{hit.m.final.toFixed(1)}</span>
        <span className="text-[12.5px] font-semibold text-[#d9d9d0]">#{hit.m.rank} in America · {hit.m.name} · see the rankings →</span>
      </Link>
    </div></section>
  )
}

// Venues in the same city (then same state) — the "make a trip of it" hop.
export function NearbyVenues({ city, state, excludeId, excludeName }: {
  city?: string
  state?: string
  excludeId?: string
  excludeName?: string
}) {
  const [venues, setVenues] = useState<Venue[] | null>(null)
  const fanScores = useFanScores()
  useEffect(() => {
    let alive = true
    getJSON('/api/venues').then((r: any) => { if (alive) setVenues(Array.isArray(r?.data) ? r.data : []) }).catch(() => { if (alive) setVenues([]) })
    return () => { alive = false }
  }, [])

  const list = useMemo(() => {
    if (!venues || (!city && !state)) return []
    const cityLc = (city ?? '').toLowerCase()
    const stateLc = (state ?? '').toLowerCase()
    return venues
      .filter((v) => v.id !== excludeId && v.name !== excludeName)
      .map((v) => ({
        v,
        tier: cityLc && (v.city ?? '').toLowerCase() === cityLc ? 0 : stateLc && (v.state ?? '').toLowerCase() === stateLc ? 1 : 2,
      }))
      .filter((x) => x.tier < 2)
      // Same tier: pro-league buildings first, then photographed, then A–Z — a
      // ranking preference over real rows, not invented data.
      .sort((a, b) => {
        const pro = (v: Venue) => Number(!v.teams.some((t) => LEAGUES.includes(t.league)))
        return a.tier - b.tier || pro(a.v) - pro(b.v) || Number(!!b.v.image) - Number(!!a.v.image) || a.v.name.localeCompare(b.v.name)
      })
      .slice(0, 6)
      .map((x) => x.v)
  }, [venues, city, state, excludeId, excludeName])

  // No same-city/state venues (or no location data) → omit the module entirely.
  if (venues !== null && !list.length) return null
  return (
    <section className={block}><div className={container}>
      <div className={eyebrow}>Make a trip of it</div>
      <h2 className={shead}>Nearby venues</h2>
      <div className={nhSub}>{city ? `Around ${city}` : state ? `Around ${state}` : ''}</div>
      {venues === null ? <div className={nhEmpty}>Loading venues…</div> : null}
      <div className="grid grid-cols-2 gap-[12px] min-[760px]:grid-cols-3">
        {list.map((v) => {
          const img = cardImg(v.image)
          const logo = v.teams[0]?.logo
          return (
            <Link key={v.id} to="/venue" search={{ id: v.id }} className="flex flex-col overflow-hidden rounded-[10px] border-[3px] border-[#222222] bg-white shadow-[5px_5px_0_0_#222222] [transition:box-shadow_.15s,transform_.12s] hover:shadow-[8px_8px_0_0_#f7df02] hover:[transform:translate(-1px,-1px)]" {...intentWarm(() => { if (img) warmImage(img) })}>
              <span className="flex h-[86px] items-center justify-center overflow-hidden bg-[#16160f]">
                {img ? <img src={img} alt="" loading="lazy" className="h-full! w-full object-cover" /> : logo ? <img src={logo} alt="" loading="lazy" className="h-[52px]! w-[52px] object-contain" /> : null}
              </span>
              <span className="flex flex-col gap-[5px] px-[12px] py-[10px]">
                <span className="text-[13.5px] font-extrabold leading-[1.15] text-[#141410]">{v.name}</span>
                <span className="text-[11.5px] font-semibold text-[#76766c]">{[v.city, v.state].filter(Boolean).join(', ')}</span>
                <FanScorePill stat={fanScores?.[v.id]} className="mt-[2px] self-start" />
              </span>
            </Link>
          )
        })}
      </div>
    </div></section>
  )
}
