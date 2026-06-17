import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteNav } from '../components/SiteNav'

export const Route = createFileRoute('/guide')({
  head: () => ({
    meta: [{ title: 'Snapback — Build your match guide' }],
  }),
  component: Guide,
})

const MOSAIC = ['metlife', 'azteca', 'att', 'sofi', 'mercedes', 'hardrock', 'bcplace', 'nrg', 'lumen', 'arrowhead', 'linc', 'bmo', 'levis', 'gillette', 'akron', 'bbva']

function Guide() {
  return (
    <>
      <SiteNav active="guide" />
      <section className="grid-overlay bg-[#222] text-white pt-[54px] pb-[46px] relative overflow-hidden">
        <div className="container max-w-[1180px] mx-auto px-[28px] relative z-[1]">
          <div className="eyebrow inline-flex items-center gap-[9px] font-bold text-[13px] tracking-[1.4px] uppercase text-[#111] bg-brand-yellow px-[13px] py-[6px] rounded-[3px] shadow-[4px_4px_0_#000] mb-[18px]">Let's go</div>
          <h1 className="font-display uppercase tracking-[1px] text-white text-[clamp(44px,7vw,88px)] max-w-[16ch] leading-[.95]">Build your <span className="hl bg-brand-yellow text-[#111] px-[10px] py-0 shadow-[5px_5px_0_#000] inline-block">match guide</span></h1>
        </div>
      </section>

      <section className="block py-[52px]">
        <div className="container max-w-[1180px] mx-auto px-[28px]">
          <div className="choices grid grid-cols-[1fr_1fr] gap-[26px] max-[760px]:grid-cols-[1fr]">
            <Link className="choice venue block bg-white border-4 border-[#222] rounded-[10px] overflow-hidden text-inherit filter-[drop-shadow(9px_9px_0_#222)] [transition:transform_.12s_ease-out,filter_.15s] hover:translate-x-[-3px] hover:translate-y-[-3px] hover:[filter:drop-shadow(13px_13px_0_#F7DF02)]" to="/build" search={{ game: '', mode: 'venue' }}>
              <div className="top mosaic relative h-[190px] overflow-hidden border-b-4 border-[#222] grid grid-cols-[repeat(4,1fr)] grid-rows-[repeat(4,1fr)] after:content-[''] after:absolute after:inset-0 after:[background:linear-gradient(180deg,rgba(0,0,0,.05)_40%,rgba(0,0,0,.55)_100%)]" id="mosaic">
                {MOSAIC.map((id) => (
                  <div key={id} className="tile relative bg-cover bg-center shadow-[inset_0_0_0_1px_rgba(0,0,0,0.25)]" style={{ backgroundImage: `url('/img/stadiums/${id}.jpg')` }}></div>
                ))}
                <span className="num absolute left-[14px] top-[12px] z-[3] font-display text-white text-[15px] tracking-[1px] bg-[rgba(0,0,0,.45)] px-[9px] py-[2px] rounded-[3px]">01</span><span className="lbl absolute left-[14px] bottom-[12px] z-[3] font-display text-white text-[20px] tracking-[.6px] [text-shadow:2px_2px_0_rgba(0,0,0,.6)]">16 venues</span>
              </div>
              <div className="body px-[24px] pt-[22px] pb-[26px]">
                <div className="t font-display text-[28px] text-[#222] tracking-[.6px]">Start with a venue</div>
                <div className="x text-[15.5px] leading-[1.55] text-[#33352f] mt-[9px]">Pick one of the 16 host stadiums, then choose your match there<span className="xtra max-[760px]:hidden"> — the build flow stitches in transit, fan walk, food and weather automatically</span>.</div>
                <span className="go inline-flex items-center gap-[8px] mt-[16px] font-extrabold text-[13px] uppercase tracking-[.7px] text-[#111] bg-brand-yellow px-[16px] py-[9px] rounded-[4px] shadow-[3px_3px_0_#222]">Choose a venue →</span>
              </div>
            </Link>
            <Link className="choice game block bg-white border-4 border-[#222] rounded-[10px] overflow-hidden text-inherit filter-[drop-shadow(9px_9px_0_#222)] [transition:transform_.12s_ease-out,filter_.15s] hover:translate-x-[-3px] hover:translate-y-[-3px] hover:[filter:drop-shadow(13px_13px_0_#F7DF02)]" to="/build" search={{ game: '', mode: 'matchup' }}>
              <div className="top collage relative h-[190px] overflow-hidden border-b-4 border-[#222] grid grid-cols-[1fr_1fr] after:content-[''] after:absolute after:inset-0 after:[background:linear-gradient(180deg,rgba(0,0,0,.05)_40%,rgba(0,0,0,.55)_100%)]" id="gtop">
                <div className="ctile c1 relative bg-cover bg-[image-set(url('/img/celebration.webp')_type('image/webp'),url('/img/celebration.jpg')_type('image/jpeg'))] bg-position-[center_42%]"></div>
                <div className="ctile c2 relative bg-cover bg-[url('/img/celebration2.jpg')] bg-position-[center_35%] border-l-[3px] border-[#222]"></div>
                <span className="num absolute left-[14px] top-[12px] z-[3] font-display text-white text-[15px] tracking-[1px] bg-[rgba(0,0,0,.45)] px-[9px] py-[2px] rounded-[3px]">02</span><span className="lbl absolute left-[14px] bottom-[12px] z-[3] font-display text-white text-[20px] tracking-[.6px] [text-shadow:2px_2px_0_rgba(0,0,0,.6)]">Every match</span>
              </div>
              <div className="body px-[24px] pt-[22px] pb-[26px]">
                <div className="t font-display text-[28px] text-[#222] tracking-[.6px]">Pick a specific game</div>
                <div className="x text-[15.5px] leading-[1.55] text-[#33352f] mt-[9px]">Jump straight to any of the 104 fixtures, in date order<span className="xtra max-[760px]:hidden">, then build a shareable matchday plan for it</span>.</div>
                <span className="go inline-flex items-center gap-[8px] mt-[16px] font-extrabold text-[13px] uppercase tracking-[.7px] text-[#111] bg-brand-yellow px-[16px] py-[9px] rounded-[4px] shadow-[3px_3px_0_#222]">Choose a match →</span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      <footer className="mt-auto bg-black text-[#888] py-[40px] text-[13px]">
        <div className="container max-w-[1180px] mx-auto px-[28px]">© 2026 Snapback Sports — World Cup 2026. <Link className="text-brand-yellow font-bold" to="/">← Home</Link></div>
      </footer>
    </>
  )
}
