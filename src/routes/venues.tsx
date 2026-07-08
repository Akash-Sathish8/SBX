import { useState, useMemo } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteNav } from '../components/SiteNav'
import VENUES_DATA from '../../data/venues.json'
import type { SportsVenue } from '../lib/data-types'

const ALL_VENUES = VENUES_DATA as SportsVenue[]

const PAGE_SIZE = 24

export const Route = createFileRoute('/venues')({
  head: () => ({ meta: [{ title: 'Snapback Field Guide — Venues' }] }),
  component: VenuesPage,
})

const LEAGUES = ['All', 'NFL', 'MLB', 'NBA', 'NHL', 'CFB', 'CBB'] as const

function VenueCard({ v }: { v: SportsVenue }) {
  return (
    <Link to="/venue/$id" params={{ id: v.id }} className="no-underline group block">
      <div className="bg-white border-[3px] border-[#222] shadow-[4px_4px_0_#222] rounded-[8px] overflow-hidden [transition:transform_.12s,box-shadow_.12s] group-hover:-translate-x-px group-hover:-translate-y-px group-hover:shadow-[6px_6px_0_#f7df02]">
        {v.hero_url ? (
          <img src={v.hero_url} alt={v.name} className="w-full h-[148px] object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-[148px] bg-[#222] flex items-center justify-center">
            <span className="font-display text-[40px] text-[#444]">{v.name[0]}</span>
          </div>
        )}
        <div className="p-4">
          <div className="font-display text-[16px] uppercase tracking-[0.5px] text-ink leading-tight">{v.name}</div>
          <div className="font-body text-[12px] text-[#666] mt-1">{v.city}, {v.state}</div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {v.leagues?.slice(0, 3).map(l => (
              <span key={l} className="text-[10px] font-bold uppercase tracking-[0.5px] text-ink bg-brand-yellow px-1.5 py-0.5 rounded">{l}</span>
            ))}
          </div>
          {v.capacity > 0 && (
            <div className="font-body text-[11px] text-[#999] mt-2">Cap. {v.capacity.toLocaleString()}</div>
          )}
          {v.snapback_score > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <span className="font-body text-[11px] text-[#666]">Snapback</span>
              <span className="font-display text-[18px] text-ink">{v.snapback_score.toFixed(1)}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

function VenuesPage() {
  const [activeLeague, setActiveLeague] = useState<typeof LEAGUES[number]>('All')
  const [query, setQuery] = useState('')
  const [visible, setVisible] = useState(PAGE_SIZE)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return ALL_VENUES.filter(v => {
      const matchLeague = activeLeague === 'All' || v.leagues?.includes(activeLeague)
      const matchQuery = !q ||
        v.name.toLowerCase().includes(q) ||
        v.city.toLowerCase().includes(q) ||
        v.state.toLowerCase().includes(q) ||
        v.teams?.some(t => t.toLowerCase().includes(q))
      return matchLeague && matchQuery
    })
  }, [activeLeague, query])

  const shown = filtered.slice(0, visible)

  return (
    <>
      <SiteNav active="venues" />

      <section className="grid-overlay bg-[#222] text-white pt-[44px] pb-[38px] relative overflow-hidden">
        <div className="container relative z-[1] max-w-[1180px] mx-auto px-[28px]">
          <div className="eyebrow inline-flex items-center gap-[9px] font-bold text-[12px] tracking-[1.4px] uppercase text-ink bg-brand-yellow px-[13px] py-[6px] rounded-[3px] shadow-[4px_4px_0_#000] mb-[14px]">
            {ALL_VENUES.length} venues · 6 sports · all of America
          </div>
          <h1 className="font-display uppercase text-white tracking-[1px] leading-none text-[clamp(40px,6vw,80px)]">
            American <span className="bg-brand-yellow text-ink px-[10px] shadow-[5px_5px_0_#000] inline-block">venues</span>
          </h1>
          <p className="text-[#d6d6d6] text-[16px] mt-4 max-w-[560px]">
            Every major sports venue in North America — NFL, MLB, NBA, NHL, CFB, and CBB. Ranked and reviewed by fans.
          </p>
        </div>
      </section>

      <section className="py-[46px] bg-[#f4f4f4]">
        <div className="container max-w-[1180px] mx-auto px-[28px]">

          {/* Controls */}
          <div className="flex flex-col gap-4 mb-8 md:flex-row md:items-center">
            <div className="flex gap-2 flex-wrap">
              {LEAGUES.map(l => (
                <button
                  key={l}
                  onClick={() => { setActiveLeague(l); setVisible(PAGE_SIZE) }}
                  className={`px-[14px] py-[7px] border-[2px] font-body font-bold text-[12px] uppercase tracking-[0.5px] cursor-pointer rounded-full [transition:background_.1s,color_.1s,border-color_.1s] ${l === activeLeague ? 'bg-ink text-white border-ink' : 'bg-white text-ink border-[#222] hover:border-ink'}`}
                >
                  {l}
                </button>
              ))}
            </div>
            <input
              type="search"
              placeholder="Search venues, cities..."
              value={query}
              onChange={e => { setQuery(e.target.value); setVisible(PAGE_SIZE) }}
              className="flex-1 border-[2px] border-[#222] rounded-[6px] shadow-[3px_3px_0_#222] px-4 py-2.5 font-body text-[14px] bg-white outline-none focus:shadow-[5px_5px_0_#222] [transition:box-shadow_.1s] md:max-w-[320px]"
            />
          </div>

          {/* Count */}
          <div className="text-[11px] font-bold uppercase tracking-[1px] text-[#999] mb-6">
            {filtered.length} venue{filtered.length !== 1 ? 's' : ''}
            {activeLeague !== 'All' && ` · ${activeLeague}`}
          </div>

          {/* Grid */}
          {ALL_VENUES.length === 0 ? (
            <div className="py-12 text-center text-[#999] font-body text-[15px]">
              Venue database loading... check back soon.
            </div>
          ) : shown.length === 0 ? (
            <div className="py-12 text-center text-[#999] font-body text-[14px]">
              No venues found{query ? ` for "${query}"` : ''}.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-[22px] max-[900px]:grid-cols-2 max-[580px]:grid-cols-1">
                {shown.map(v => <VenueCard key={v.id} v={v} />)}
              </div>
              {visible < filtered.length && (
                <button
                  onClick={() => setVisible(v => v + PAGE_SIZE)}
                  className="w-full mt-8 py-3 border-[3px] border-[#222] bg-white font-body font-bold text-[14px] uppercase tracking-[0.5px] shadow-[4px_4px_0_#222] cursor-pointer hover:-translate-y-px hover:shadow-[6px_6px_0_#222] [transition:transform_.1s,box-shadow_.1s]"
                >
                  Show {Math.min(PAGE_SIZE, filtered.length - visible)} more
                </button>
              )}
            </>
          )}
        </div>
      </section>

      <footer className="bg-black text-[#888] py-[40px] text-[13px]">
        <div className="container max-w-[1180px] mx-auto px-[28px]">
          © 2025 Snapback Sports — Field Guide. <Link to="/" className="text-brand-yellow font-bold">← Home</Link>
        </div>
      </footer>
    </>
  )
}
