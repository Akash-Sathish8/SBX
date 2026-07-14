import { useEffect, useMemo, useState } from 'react'
import { container } from '../lib/ui'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Star, MapPin, Flag, Ticket, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PageCssGuard } from '../components/PageCssGuard'
import { SiteNav } from '../components/SiteNav'
import { SearchBox } from '../components/SearchBox'
import { getJSON } from '../lib/dataCache'
import { SPORTS, LEAGUES, COLLEGE_LEAGUES } from '../lib/sports'
import { cardImg } from '../lib/img'
import type { Venue } from '../lib/espn'
import { expImage, type Experience } from '../lib/experiences'
import { matchVenueForExperience } from '../lib/experienceMatch'
import { FanScorePill, useFanScores } from '../components/FanScore'
import { COLLECTIONS } from '../lib/collections'

// The explore home, TICKET STUB edition — discovery starts at pixel one. A
// poster hero (FIELD GUIDE question + search) sits vertically centered with
// the five explore doors as mini tickets, then the page is inventory:
// tonight's games as perforated ticket stubs, ranked experiences as ADMIT ONE
// cards, venues as photo tickets. Every card is a real D1 / experiences.json
// row; numbers are computed or omitted while loading.
// Fully Tailwind: home.css is gone — only the shared searchbox.css remains
// (SearchBox converts later; PageCssGuard still needs the id).
export const Route = createFileRoute('/')({
  head: () => ({
    links: [
    ],
    meta: [{ title: 'Snapback · Where does gameday take you?' }],
  }),
  component: Home,
})

// Real local assets (checked into public/img/hero) — fan-shot gamedays that rotate
// behind the hero copy. Rendered vibrant (not the old washed-out whisper): a mild
// brightness/scrim keeps the type readable while the photos still pop.
const HERO_IMAGES = [
  '/img/hero/hero-1.jpg', // Florida — fireworks
  '/img/hero/hero-2.jpg', // Florida — flashlight sea
  '/img/hero/hero-3.jpg', // Penn State — whiteout
  '/img/hero/hero-4.jpg', // Oracle Park
  '/img/hero/hero-5.jpg', // Levi's — 49ers
  '/img/hero/hero-6.jpg', // World Cup — Brazil
]

const LEAGUE_LINE = [...LEAGUES, ...COLLEGE_LEAGUES].map((l) => SPORTS[l].label)

// Iconic parks lead the venue rail when present; the rest fills from any pro
// venue that has a photo. (Editorial ordering over real rows, not invented data.)

/* ---- home.css, translated to utilities ---- */
// .container — shared page gutter
// .hsec / .sec / .sec-left / .sec-eye / .sec h2 — eyebrow + title flush-left
const hsec = 'pb-1 pt-9 min-[900px]:pb-1.5 min-[900px]:pt-11'
const sec = 'mb-[18px] flex flex-wrap items-end gap-x-3.5 gap-y-3'
const secEye = 'text-[11px] font-extrabold uppercase tracking-[2.5px] text-muted'
const secH2 = 'mt-1.5 font-display text-[26px] uppercase leading-none tracking-[.5px] text-ink min-[900px]:text-[36px]'
// .tchip — ticket-chip CTA: punch Button variant with exact legacy geometry
// (6px radius, 2px→4px ink punch, dashed inner border, lift on hover)
const tchip =
  "relative ml-auto h-auto rounded-md border-2 px-3.5 py-2 text-[11px] tracking-[1.5px] shadow-[2px_2px_0_0_#141410] transition-[box-shadow,transform] duration-[.15s,.12s] ease-[ease] after:pointer-events-none after:absolute after:inset-[3px] after:rounded-[3px] after:border after:border-dashed after:border-ink after:content-[''] hover:translate-x-0 hover:translate-y-0 hover:transform-[translate(-1px,-1px)] hover:shadow-[4px_4px_0_0_#141410]"
// .hrail — full-bleed rail whose first card aligns with the container edge
const hrail =
  'flex snap-x snap-proximity gap-4 overflow-x-auto px-[clamp(28px,4vw,72px)] pb-[30px] pt-1.5 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-[900px]:snap-none'
const hload = 'pb-3.5 pt-1.5 text-[14px] font-semibold text-muted'

// Explore pills under the hero search — a colour-dot chip per destination
// (search-first layout). Each icon rides in its accent circle.
const EXPLORE = [
  { label: 'Rank a game', to: '/rank', accent: '#f7df02', ink: true, Icon: Star },
  { label: 'Near you', to: '/near', accent: '#2b6cb0', Icon: MapPin },
  { label: 'Teams', to: '/teams', accent: '#2f855a', Icon: Flag, search: { league: undefined } },
  { label: 'Venues', to: '/venues', accent: '#6b46c1', Icon: Ticket },
  { label: 'Top ranked', to: '/rankings', accent: '#c0392b', Icon: BarChart3 },
]

// .rank-card — ADMIT ONE experience tickets (desktop: 4-up grid via rankGrid)
const rankCard =
  'flex min-h-[288px] flex-[0_0_252px] snap-start flex-col overflow-hidden rounded-xl border-[3px] border-ink bg-cream shadow-[5px_5px_0_0_#141410] [transition:box-shadow_.15s,transform_.12s] hover:shadow-[8px_8px_0_0_#f7df02] hover:transform-[translate(-1px,-1px)] min-[900px]:min-h-[300px] min-[900px]:flex-none'
const admit = 'flex w-full items-baseline gap-2.5 border-b-[3px] border-ink bg-brand px-3 py-[7px]'
const admitB = 'text-[11px] font-extrabold uppercase tracking-[3px] text-ink'
const admitNum = 'ml-auto font-display text-[15px] tracking-[1px] text-ink tabular-nums'
const rankBody = 'flex w-full flex-1 flex-col items-start px-3.5 pb-[13px] pt-3'
const rankName = 'font-display text-[19px] font-normal uppercase leading-[1.12] tracking-[.4px] text-ink'
const rankScore = 'mt-auto pt-2.5 text-[11px] font-extrabold uppercase tracking-[2px] text-ink tabular-nums'
// ranked rail becomes a 4-up grid aligned with the container on desktop
const rankGrid = cn(hrail, 'min-[900px]:grid min-[900px]:grid-cols-4 min-[900px]:gap-x-[18px] min-[900px]:gap-y-[22px] min-[900px]:overflow-visible')

const footLink = 'font-extrabold uppercase tracking-[1px] text-brand'

function Home() {
  const [exps, setExps] = useState<Experience[] | null>(null)
  const [venues, setVenues] = useState<Venue[] | null>(null)
  const fanScores = useFanScores()

  // Hero photo rotation: crossfade to the next fan shot every 7s. Images are set
  // just-in-time (current + next) so the page doesn't fetch all six up front.
  const [heroIdx, setHeroIdx] = useState(0)
  const [heroReady, setHeroReady] = useState<Set<number>>(() => new Set([0]))
  useEffect(() => {
    const iv = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      setHeroIdx((i) => (i + 1) % HERO_IMAGES.length)
    }, 7000)
    return () => clearInterval(iv)
  }, [])
  useEffect(() => {
    const next = (heroIdx + 1) % HERO_IMAGES.length
    const img = new Image(); img.src = HERO_IMAGES[next] // warm the crossfade target
    setHeroReady((s) => (s.has(heroIdx) && s.has(next) ? s : new Set(s).add(heroIdx).add(next)))
  }, [heroIdx])

  useEffect(() => {
    let alive = true
    getJSON('/api/venues')
      .then((r: any) => { if (alive) setVenues(Array.isArray(r?.data) ? r.data : []) })
      .catch(() => { if (alive) setVenues([]) })
    getJSON('/data/experiences.json')
      .then((r: any) => { if (alive) setExps(Array.isArray(r?.experiences) ? r.experiences : []) })
      .catch(() => { if (alive) setExps([]) })
    return () => { alive = false }
  }, [])

  // 7 + the collection card = a clean 4×2 ADMIT ONE grid on desktop. Resolve each
  // experience to its team's venue so the card links straight there (events with no
  // team venue fall back to the ranked list).
  const topExps = useMemo(
    () => (exps ? exps.slice(0, 7).map((e) => ({
      ...e,
      image: e.image ?? expImage(e.name, venues ?? []),
      venueId: matchVenueForExperience(e.name, venues ?? [])?.id,
    })) : null),
    [exps, venues],
  )

  const col = COLLECTIONS[0]

  return (
    // body: Barlow on the warm gray canvas (html/body keep overflow-x:clip globally)
    <div className="min-h-screen bg-[#f4f4f4] font-sans text-[#33352f]">
      <PageCssGuard id="home" />
      <SiteNav active="home" />

      {/* Poster hero: copy docked bottom-left (never floating centered), doors as mini tickets.
          z-5 lifts the hero's stacking context above the rails below it, so the search
          dropdown paints over the ticket cards (nav stays on top at z-50). */}
      <section className="relative isolate z-[5] flex min-h-[calc(100vh-72px)] flex-col border-b-[3px] border-ink text-white supports-[min-height:100svh]:min-h-[calc(100svh-72px)]">
        {/* Rotating fan-shot gamedays. Kept vibrant — a mild brightness/saturation
            trim (not the old heavy fade) so the photos pop; the scrim below carries
            text legibility. Each layer crossfades. Exactly inset-0 (no scale) so the
            photo lines up with the scrim — a scaled layer would bleed a bright, un-
            faded sliver past the fade at the section's bottom edge. */}
        {HERO_IMAGES.map((src, i) => (
          <div
            key={src}
            aria-hidden
            className="absolute inset-0 -z-[2] bg-[#0d0d0b] bg-cover bg-center transition-opacity duration-[1400ms] ease-in-out filter-[saturate(1.02)_brightness(.66)]"
            style={{ backgroundImage: heroReady.has(i) ? `url('${src}')` : undefined, opacity: i === heroIdx ? 1 : 0 }}
          />
        ))}
        {/* scrim: light up top so the photo reads, darkening toward the copy at the
            bottom; a flat wash keeps the ≥900px centered text legible over any frame */}
        <div className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,rgba(10,10,8,.34)_0%,rgba(10,10,8,.28)_38%,rgba(10,10,8,.52)_70%,rgba(10,10,8,.86)_100%)]" />
        <div className={cn(container, 'flex w-full flex-1 flex-col items-start pb-[26px] pt-[38px]')}>
          {/* mt-auto docks the copy to the hero's bottom edge — text never floats
              vertically centered on mobile; ≥900px it centers as one stack */}
          <div className="mt-auto w-full min-[900px]:my-auto min-[900px]:flex min-[900px]:flex-col min-[900px]:items-center min-[900px]:text-center">
            <div className="min-[900px]:flex min-[900px]:w-full min-[900px]:min-w-0 min-[900px]:flex-col min-[900px]:items-center">
              {/* inline-block shrinks the highlight to its own line-height instead of Anton's
                  tall font metrics — the yellow box must never overlap the lines around it */}
              <h1 className="mt-3 max-w-[12ch] font-display text-[clamp(58px,14vw,120px)] uppercase leading-[1.04] tracking-[.5px] text-white [text-shadow:0_2px_18px_rgba(0,0,0,.5)] min-[900px]:mx-auto min-[900px]:max-w-[15ch] min-[900px]:text-[clamp(96px,10vw,188px)]">
                Find Your <span className="inline-block bg-brand px-[.14em] leading-[1.02] text-ink shadow-[5px_5px_0_#141410] [text-shadow:none]">Experience</span>
              </h1>
              {/* z-4: the search dropdown must paint OVER the pill row below. `size=lg`
                  is the search-first hero treatment; the wrapper drives its width. */}
              <div className="relative z-[4] mt-[24px] w-full max-w-[620px] min-[900px]:mx-auto min-[900px]:mt-[32px] min-[900px]:max-w-[820px] [&>.sbx-search]:max-w-none!">
                <SearchBox size="lg" />
              </div>
            </div>
            <div className="mt-[22px] flex w-full flex-wrap gap-[13px] min-[900px]:mt-8 min-[900px]:justify-center">
              {EXPLORE.map((e) => (
                <Link
                  key={e.label}
                  to={e.to as any}
                  search={e.search as any}
                  className="inline-flex items-center gap-[11px] rounded-full border-2 border-ink bg-white px-[20px] py-[13px] font-sans text-[15px] font-extrabold uppercase tracking-[.4px] text-ink! shadow-punch transition-[box-shadow,translate] duration-[120ms] hover:-translate-x-px hover:-translate-y-px hover:shadow-punch-brand"
                >
                  <span className="inline-flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full border-2 border-ink" style={{ background: e.accent, color: e.ink ? '#141410' : '#fff' }}>
                    <e.Icon className="h-[17px] w-[17px]" strokeWidth={2.5} />
                  </span>
                  {e.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Rail — top-ranked experiences as ADMIT ONE cards (collection card leads) */}
      <section className={hsec}>
        <div className={container}>
          <div className={sec}>
            <div className="flex flex-col items-start"><span className={secEye}>{exps?.length ? `${exps.length} ranked experiences` : 'Expert rankings'}</span><h2 className={secH2}>Top ranked in America</h2></div>
            <Button asChild variant="punch" className={tchip}><Link to="/rankings">Full rankings →</Link></Button>
          </div>
        </div>
        {topExps ? (
          <div className={rankGrid}>
            <Link to="/rankings" search={{ collection: col.slug }} className={rankCard}>
              <span className={admit}><b className={admitB}>Collection</b><span className={admitNum}>→</span></span>
              <span className={rankBody}>
                <span className={cn(rankName, 'text-[22px]')}>{col.title}</span>
                <span className={rankScore}>The collection →</span>
              </span>
            </Link>
            {topExps.map((e) => (
              <Link
                key={e.rank}
                to={e.venueId ? '/venue' : '/rankings'}
                search={(e.venueId ? { id: e.venueId } : { q: e.name }) as any}
                className={rankCard}
              >
                <span className={admit}><b className={admitB}>Admit One</b><span className={admitNum}>№ {e.rank}</span></span>
                {e.image ? <span className="h-[140px] w-full flex-none border-b-2 border-dashed border-ink"><img src={cardImg(e.image)} alt="" loading="lazy" className="h-full! w-full object-cover" /></span> : null}
                <span className={rankBody}>
                  <span className={cn(rankName, !e.image && 'text-[22px]')}>{e.name}</span>
                  <span className="mt-[5px] text-[12px] font-semibold uppercase tracking-[1px] text-muted">{e.location}{e.sport ? ' · ' + e.sport : ''}</span>
                  <span className={cn(rankScore, 'flex flex-wrap items-center gap-x-[10px] gap-y-[6px]')}>
                    <span>{e.final.toFixed(2)} expert</span>
                    {e.venueId ? <FanScorePill stat={fanScores?.[e.venueId]} /> : null}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        ) : <div className={container}><div className={hload}>Loading rankings…</div></div>}
      </section>

      {/* stat bar (all numbers computed from real data; omitted while loading) */}
      <div className="border-t-[3px] border-ink bg-[#ecebe6] py-[17px]">
        <div className={container}>
          <p className="flex flex-wrap gap-x-2 gap-y-0 text-[12px] font-extrabold uppercase tracking-[2px] text-ink tabular-nums">
            {exps?.length ? <span><b>{exps.length}</b> ranked experiences</span> : null}
            {exps?.length && venues?.length ? <i className="not-italic text-[#a3a196]">·</i> : null}
            {venues?.length ? <span><b>{venues.length}</b> venues</span> : null}
            {(exps?.length || venues?.length) ? <i className="not-italic text-[#a3a196]">·</i> : null}
            <span>{LEAGUE_LINE.join(' · ')}</span>
          </p>
        </div>
      </div>

      <footer className="bg-[#111] pb-[34px] pt-[26px] text-[13px] text-[#9a988c]"><div className={container}>© 2026 Snapback Sports. <Link to="/games" className={footLink}>Games</Link> · <Link to="/venues" className={footLink}>Venues</Link> · <Link to="/rankings" className={footLink}>Rankings</Link></div></footer>
    </div>
  )
}
