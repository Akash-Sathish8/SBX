import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteNav } from '../components/SiteNav'
import { VenueCard } from '../components/VenueCard'
import { VENUES, venueNationCounts, NATION_FLAG, NATION_NAME } from '../lib/venues-meta'

export const Route = createFileRoute('/venues')({
  head: () => ({
    meta: [{ title: 'Snapback — World Cup Venues' }],
  }),
  component: Venues,
})

function Venues() {
  const [filter, setFilter] = useState('all')
  const list = VENUES.filter((v) => filter === 'all' || v.cc === filter)
  // Active filter pill gets the brand-yellow fill (was a `.tally .pill.on` CSS rule).
  const pill = (cc: string) => (filter === cc ? 'bg-brand-yellow' : 'bg-white')
  return (
    <>
      <SiteNav active="venues" />
      <section className="grid-overlay bg-[#222222] text-white pt-[44px] pb-[38px] relative overflow-hidden">
        <div className="container relative z-[1] max-w-[1180px] mx-auto px-[28px]">
          <div className="eyebrow inline-flex items-center gap-[9px] font-bold text-[13px] tracking-[1.4px] uppercase text-ink bg-brand-yellow px-[13px] py-[6px] rounded-[3px] shadow-[4px_4px_0_#000] mb-[14px]">{VENUES.length} stadiums · {venueNationCounts().length} nations · 1 tournament</div>
          <h1 className="font-display uppercase text-white tracking-[1px] leading-none text-[clamp(44px,6.4vw,84px)] max-w-[20ch]">Every World Cup <span className="hl bg-brand-yellow text-ink px-[10px] shadow-[5px_5px_0_#000] inline-block">venue</span></h1>
          <p className="sub text-[#d6d6d6] text-[18px] mt-[18px] leading-[1.5]">All 16 host stadiums for FIFA World Cup 2026 across the USA, Canada and Mexico.</p>
          <div className="tally flex gap-[14px] flex-wrap mt-[22px]" id="tally">
            <button className={pill('all') + ' inline-flex items-center gap-[6px] border-[3px] border-[#222222] rounded-[6px] shadow-[4px_4px_0_#222222] px-[14px] py-[8px] font-body font-bold text-[13px] text-[#222222] uppercase tracking-[0.4px] cursor-pointer [transition:transform_.1s,box-shadow_.1s,background_.12s] hover:-translate-x-px hover:-translate-y-px hover:shadow-[5px_5px_0_#222222] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#222222]'} onClick={() => setFilter('all')}><b className="font-display text-[18px] mr-[5px]">{VENUES.length}</b> Stadiums</button>
            {venueNationCounts().map(({ cc, n }) => (
              <button key={cc} className={pill(cc) + ' inline-flex items-center gap-[6px] border-[3px] border-[#222222] rounded-[6px] shadow-[4px_4px_0_#222222] px-[14px] py-[8px] font-body font-bold text-[13px] text-[#222222] uppercase tracking-[0.4px] cursor-pointer [transition:transform_.1s,box-shadow_.1s,background_.12s] hover:-translate-x-px hover:-translate-y-px hover:shadow-[5px_5px_0_#222222] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#222222]'} onClick={() => setFilter(cc)}><b className="font-display text-[18px] mr-[5px]">{n}</b> {NATION_FLAG[cc]} {NATION_NAME[cc]}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="block py-[46px]">
        <div className="container max-w-[1180px] mx-auto px-[28px]">
          <div className="grid grid-cols-3 gap-[26px] max-[900px]:grid-cols-2 max-[600px]:grid-cols-1" id="grid">
            {list.map((v) => (
              <VenueCard
                key={v.img}
                v={v}
                className="[content-visibility:auto] [contain-intrinsic-size:auto_262px]"
              />
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-black text-[#888] py-[40px] text-[13px]">
        <div className="container max-w-[1180px] mx-auto px-[28px]">© 2026 Snapback Sports — World Cup Venues. <Link to="/" className="text-brand-yellow font-bold">← Experiences</Link></div>
      </footer>
    </>
  )
}
