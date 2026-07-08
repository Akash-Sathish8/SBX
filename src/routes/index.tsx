import { useState, useEffect, useRef } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { SiteNav } from '../components/SiteNav'
import { absUrl, socialMeta } from '../lib/site'
import type { Experience, SportsVenue, LiveGame, League } from '../lib/data-types'
import EXPERIENCES_DATA from '../../data/experiences.json'
import VENUES_DATA from '../../data/venues.json'

const EXPERIENCES = EXPERIENCES_DATA as Experience[]
const VENUES = VENUES_DATA as SportsVenue[]

const TOP_EXPERIENCES = EXPERIENCES.slice(0, 7)
const ICONIC_SLUGS = ['wrigley-field', 'lambeau-field', 'yankee-stadium', 'michigan-stadium', 'madison-square-garden', 'arrowhead-stadium', 'neyland-stadium', 'cameron-indoor-stadium']
const ICONIC_VENUES = ICONIC_SLUGS
  .map(slug => VENUES.find(v => v.slug === slug))
  .filter((v): v is SportsVenue => !!v)
  .slice(0, 8)

export const Route = createFileRoute('/')({
  head: () => {
    const title = 'Snapback Field Guide — Rate Every American Sports Experience'
    const description = "Expert rankings of 300+ sports venue experiences. Browse venues, teams, and games. Track every game you attend."
    return {
      links: [{ rel: 'canonical', href: absUrl('/') }],
      meta: socialMeta({ title, description, image: absUrl('/img/logo.png') }),
    }
  },
  component: Home,
})

// ---- Search ----

type SearchResult =
  | { type: 'experience'; item: Experience }
  | { type: 'venue'; item: SportsVenue }

function scoreText(text: string, q: string): number {
  const t = text.toLowerCase()
  const query = q.toLowerCase()
  if (t === query) return 10
  if (t.startsWith(query)) return 7
  if (t.includes(query)) return 4
  return 0
}

function searchLocal(q: string): SearchResult[] {
  if (q.trim().length < 2) return []
  const results: (SearchResult & { score: number })[] = []

  EXPERIENCES.forEach(e => {
    const s = Math.max(scoreText(e.venue_name, q), scoreText(e.exp_name, q), scoreText(e.league, q))
    if (s > 0) results.push({ type: 'experience', item: e, score: s })
  })

  VENUES.forEach(v => {
    const s = Math.max(scoreText(v.name, q), scoreText(v.city, q))
    if (s > 0) results.push({ type: 'venue', item: v, score: s })
  })

  return results.sort((a, b) => b.score - a.score).slice(0, 12)
}

function SearchBox() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const results = searchLocal(q)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative w-full max-w-[560px]">
      <div className="flex items-center bg-white border-[3px] border-[#222] shadow-[6px_6px_0_#000] rounded-[8px] overflow-hidden">
        <input
          type="search"
          placeholder="Search venues, teams, experiences..."
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          className="flex-1 px-5 py-4 font-body text-[16px] text-ink bg-transparent outline-none placeholder:text-[#aaa]"
        />
        <Link
          to="/rankings"
          search={{ q, league: '', collection: '' } as any}
          className="bg-brand-yellow text-ink font-display text-[14px] uppercase tracking-[0.5px] px-5 py-4 no-underline border-l-[3px] border-[#222] hover:bg-[#e0c400] [transition:background_.1s]"
        >
          Search
        </Link>
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border-[3px] border-[#222] shadow-[6px_6px_0_#000] rounded-[8px] overflow-hidden z-50 max-h-[360px] overflow-y-auto">
          {results.map((r, i) =>
            r.type === 'experience' ? (
              <Link
                key={`e-${i}`}
                to="/venue/$id"
                params={{ id: r.item.venue_id }}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-5 py-3 hover:bg-[#fffde0] border-b border-[#eee] last:border-0 no-underline [transition:background_.1s]"
              >
                <span className="text-[11px] font-bold text-ink bg-brand-yellow px-2 py-0.5 rounded uppercase tracking-[0.5px] shrink-0">{r.item.league}</span>
                <div>
                  <div className="font-body font-bold text-[14px] text-ink">{r.item.exp_name}</div>
                  <div className="font-body text-[11px] text-[#666]">{r.item.venue_name}</div>
                </div>
                <div className="ml-auto font-display text-[18px] text-ink">{r.item.final.toFixed(1)}</div>
              </Link>
            ) : (
              <Link
                key={`v-${i}`}
                to="/venue/$id"
                params={{ id: r.item.id }}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-5 py-3 hover:bg-[#fffde0] border-b border-[#eee] last:border-0 no-underline [transition:background_.1s]"
              >
                <span className="text-[11px] font-bold text-[#444] bg-[#eee] px-2 py-0.5 rounded uppercase tracking-[0.5px] shrink-0">Venue</span>
                <div>
                  <div className="font-body font-bold text-[14px] text-ink">{r.item.name}</div>
                  <div className="font-body text-[11px] text-[#666]">{r.item.city}, {r.item.state}</div>
                </div>
              </Link>
            )
          )}
        </div>
      )}
    </div>
  )
}

// ---- ADMIT ONE card ----

function AdmitOneCard({ exp }: { exp: Experience }) {
  return (
    <Link to="/venue/$id" params={{ id: exp.venue_id }} className="no-underline shrink-0 group">
      <div className="w-[220px] bg-white border-[4px] border-[#222] shadow-[6px_6px_0_#000] rounded-[8px] overflow-hidden [transition:transform_.15s,box-shadow_.15s] group-hover:-translate-y-1 group-hover:shadow-[8px_10px_0_#000]">
        {exp.image
          ? <img src={exp.image} alt={exp.venue_name} className="w-full h-[110px] object-cover" loading="lazy" />
          : <div className="w-full h-[110px] bg-[#222] flex items-center justify-center"><span className="font-display text-[28px] text-[#444]">{exp.league}</span></div>
        }
        <div className="bg-ink text-white px-4 pt-2 pb-1.5 flex items-center justify-between">
          <span className="font-body text-[9px] font-bold uppercase tracking-[2px] text-[#999]">ADMIT ONE</span>
          <span className="font-body text-[9px] font-bold uppercase tracking-[1px] text-brand-yellow">{exp.league}</span>
        </div>
        <div className="p-4 pt-3">
          <div className="font-display text-[13px] uppercase tracking-[0.5px] text-ink leading-tight mb-0.5">{exp.exp_name}</div>
          <div className="font-body text-[11px] text-[#666] mb-3 leading-tight">{exp.venue_name}</div>
          <div className="font-display text-[36px] text-brand-yellow leading-none">{exp.final.toFixed(1)}</div>
          <div className="font-body text-[10px] text-[#999] uppercase tracking-[0.5px] mt-0.5">Snapback Score</div>
        </div>
        <div className="bg-brand-yellow px-4 py-2 flex items-center justify-between">
          <span className="font-body text-[10px] font-bold text-ink uppercase tracking-[0.5px]">#{exp.rank} Ranked</span>
          <span className="font-body text-[10px] text-ink">{exp.league}</span>
        </div>
      </div>
    </Link>
  )
}

// ---- Ticket stub for "On the Slate" ----

function TicketStub({ game }: { game: LiveGame }) {
  return (
    <Link to="/game/$id" params={{ id: game.id }} className="no-underline shrink-0 group">
      <div className="w-[200px] bg-white border-[4px] border-[#222] shadow-[6px_6px_0_#000] rounded-[8px] overflow-hidden [transition:transform_.15s,box-shadow_.15s] group-hover:-translate-y-1 group-hover:shadow-[8px_10px_0_#000]">
        <div className="bg-ink px-4 py-2 flex items-center justify-between">
          {game.isLive
            ? <span className="text-[9px] font-bold text-red-400 uppercase tracking-[1.5px]">● Live</span>
            : <span className="text-[9px] font-bold text-[#888] uppercase tracking-[1px]">{game.sport.toUpperCase()}</span>
          }
          <span className="text-[9px] font-bold text-[#888] uppercase tracking-[1px]">{game.sport.toUpperCase()}</span>
        </div>
        <div className="h-[1px] border-t-[2px] border-dashed border-[#e0e0e0]" />
        <div className="p-4">
          <div className="flex justify-between items-center mb-2">
            <div className="text-center flex-1">
              {game.away.logo && <img src={game.away.logo} alt={game.away.abbr} width={28} height={28} className="w-7 h-7 object-contain mx-auto mb-1" />}
              <div className="font-display text-[13px] uppercase">{game.away.abbr}</div>
            </div>
            <div className="text-center px-2">
              {(game.isLive || game.isFinal)
                ? <div className="font-display text-[18px] text-ink">{game.away.score}<span className="text-[#ccc] mx-0.5">–</span>{game.home.score}</div>
                : <div className="font-body text-[11px] text-[#999]">vs</div>
              }
            </div>
            <div className="text-center flex-1">
              {game.home.logo && <img src={game.home.logo} alt={game.home.abbr} width={28} height={28} className="w-7 h-7 object-contain mx-auto mb-1" />}
              <div className="font-display text-[13px] uppercase">{game.home.abbr}</div>
            </div>
          </div>
          {game.venueName && <div className="font-body text-[10px] text-[#888] text-center leading-tight">{game.venueName}</div>}
        </div>
        <div className="bg-[#f4f4f4] px-4 py-2">
          <div className="font-body text-[10px] text-[#666] text-center">
            {game.isLive
              ? game.statusDesc
              : new Date(game.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
            }
          </div>
        </div>
      </div>
    </Link>
  )
}

// ---- League pills ----

const LEAGUES: { value: League; label: string; espnSport: string }[] = [
  { value: 'NFL', label: 'NFL', espnSport: 'nfl' },
  { value: 'MLB', label: 'MLB', espnSport: 'mlb' },
  { value: 'NBA', label: 'NBA', espnSport: 'nba' },
  { value: 'NHL', label: 'NHL', espnSport: 'nhl' },
  { value: 'CFB', label: 'CFB', espnSport: 'college-football' },
  { value: 'CBB', label: 'CBB', espnSport: 'mens-college-basketball' },
]

// ---- Home ----

function Home() {
  const [activeLeague, setActiveLeague] = useState<(typeof LEAGUES)[0]>(LEAGUES[0])

  const { data: todayGames = [] } = useQuery<LiveGame[]>({
    queryKey: ['today-games', activeLeague.espnSport],
    queryFn: () =>
      fetch(`/api/games?today=true&sport=${activeLeague.espnSport}`).then(r => r.json()),
    refetchInterval: 25_000,
    staleTime: 20_000,
  })

  const totalVenues = VENUES.length
  const totalExperiences = EXPERIENCES.length
  const totalSports = new Set(EXPERIENCES.map(e => e.league)).size

  return (
    <>
      <SiteNav active="home" />

      {/* Hero */}
      <section className="bg-ink text-white pt-[56px] pb-[64px] relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: "url('/img/celebration.jpg')" }} aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/80 to-transparent" aria-hidden="true" />
        <div className="container relative z-[1] max-w-[1180px] mx-auto px-[28px]">
          <div className="max-w-[700px]">
            {totalExperiences > 0 && (
              <div className="inline-flex items-center gap-[9px] font-bold text-[12px] tracking-[1.4px] uppercase text-ink bg-brand-yellow px-[13px] py-[6px] rounded-[3px] shadow-[4px_4px_0_#000] mb-[20px]">
                {totalExperiences} ranked experiences · {totalVenues} venues · {totalSports} sports
              </div>
            )}
            <h1 className="font-display uppercase text-white tracking-[1px] leading-[0.95] text-[clamp(52px,7vw,96px)] mb-[24px]">
              The Field<br />
              <span className="bg-brand-yellow text-ink px-[12px] shadow-[6px_6px_0_#000] inline-block">Guide</span>
            </h1>
            <p className="font-body text-[18px] text-[#d6d6d6] leading-[1.6] mb-[32px] max-w-[520px]">
              Expert-ranked sports venue experiences across America. Track every game you attend, leave reviews, follow fans.
            </p>
            <SearchBox />
          </div>
        </div>
      </section>

      {/* Explore tiles */}
      <section className="bg-[#f4f4f4] py-[40px]">
        <div className="container max-w-[1180px] mx-auto px-[28px]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(
              [
                <Link key="teams" to="/teams" search={{ league: 'NFL' }} className="no-underline bg-white border-[3px] border-[#222] shadow-[4px_4px_0_#222] rounded-[8px] p-5 flex flex-col gap-2 [transition:transform_.1s,box-shadow_.1s] hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_#222] group"><div className="font-display text-[22px] uppercase tracking-[0.5px] text-ink">Teams</div><div className="font-body text-[13px] text-[#666]">All leagues</div><div className="mt-auto text-[11px] font-bold text-[#aaa] uppercase tracking-[0.5px]">Explore →</div></Link>,
                <Link key="weekend" to="/weekend" className="no-underline bg-white border-[3px] border-[#222] shadow-[4px_4px_0_#222] rounded-[8px] p-5 flex flex-col gap-2 [transition:transform_.1s,box-shadow_.1s] hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_#222] group"><div className="font-display text-[22px] uppercase tracking-[0.5px] text-ink">This Weekend</div><div className="font-body text-[13px] text-[#666]">Fri–Sun slate</div><div className="mt-auto text-[11px] font-bold text-[#aaa] uppercase tracking-[0.5px]">Explore →</div></Link>,
                <Link key="venues" to="/venues" className="no-underline bg-white border-[3px] border-[#222] shadow-[4px_4px_0_#222] rounded-[8px] p-5 flex flex-col gap-2 [transition:transform_.1s,box-shadow_.1s] hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_#222] group"><div className="font-display text-[22px] uppercase tracking-[0.5px] text-ink">Venues</div><div className="font-body text-[13px] text-[#666]">{totalVenues || '130+'} stadiums</div><div className="mt-auto text-[11px] font-bold text-[#aaa] uppercase tracking-[0.5px]">Explore →</div></Link>,
                <Link key="rankings" to="/rankings" search={{ league: '', q: '', collection: '' }} className="no-underline bg-white border-[3px] border-[#222] shadow-[4px_4px_0_#222] rounded-[8px] p-5 flex flex-col gap-2 [transition:transform_.1s,box-shadow_.1s] hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_#222] group"><div className="font-display text-[22px] uppercase tracking-[0.5px] text-ink">Rankings</div><div className="font-body text-[13px] text-[#666]">Top experiences</div><div className="mt-auto text-[11px] font-bold text-[#aaa] uppercase tracking-[0.5px]">Explore →</div></Link>,
              ]
            )}
          </div>
        </div>
      </section>

      {/* Sport pivot + On the Slate */}
      <section className="bg-[#222] py-[40px]">
        <div className="container max-w-[1180px] mx-auto px-[28px]">
          <div className="flex gap-2 flex-wrap mb-6">
            {LEAGUES.map(l => (
              <button
                key={l.value}
                onClick={() => setActiveLeague(l)}
                className={`px-[14px] py-[7px] border-[2px] font-body font-bold text-[12px] uppercase tracking-[0.5px] cursor-pointer rounded-full [transition:background_.1s,color_.1s,border-color_.1s] ${l.value === activeLeague.value ? 'bg-brand-yellow text-ink border-brand-yellow' : 'bg-transparent text-[#cfcfcf] border-[#444] hover:border-[#888]'}`}
              >
                {l.label}
              </button>
            ))}
          </div>

          <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#666] mb-3">
            On the slate · {activeLeague.label}
          </div>
          <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {todayGames.length === 0 ? (
              <div className="text-[#666] font-body text-[13px] py-4 italic">No games today for {activeLeague.label}.</div>
            ) : (
              todayGames.map(g => (
                <div key={g.id} className="snap-start">
                  <TicketStub game={g} />
                </div>
              ))
            )}
          </div>

          <div className="mt-6">
            <Link to="/games" className="font-body font-bold text-[12px] text-[#666] no-underline hover:text-brand-yellow uppercase tracking-[0.5px] [transition:color_.1s]">
              See full schedule →
            </Link>
          </div>
        </div>
      </section>

      {/* Top Ranked in America */}
      {TOP_EXPERIENCES.length > 0 && (
        <section className="bg-[#f4f4f4] py-[48px]">
          <div className="container max-w-[1180px] mx-auto px-[28px]">
            <div className="flex items-baseline justify-between mb-6">
              <h2 className="font-display text-[clamp(24px,3.5vw,42px)] uppercase tracking-[1px] text-ink">
                Top ranked <span className="bg-brand-yellow px-[8px] shadow-[4px_4px_0_#000] inline-block">in America</span>
              </h2>
              <Link to="/rankings" search={{ league: '', q: '', collection: '' }} className="font-body font-bold text-[13px] text-[#666] no-underline hover:text-ink [transition:color_.1s] shrink-0 ml-4">
                See all {totalExperiences} →
              </Link>
            </div>
            <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#999] mb-3">Snapback expert rankings</div>
            <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {TOP_EXPERIENCES.map(exp => (
                <div key={exp.id} className="snap-start">
                  <AdmitOneCard exp={exp} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Iconic Buildings */}
      {ICONIC_VENUES.length > 0 && (
        <section className="bg-[#222] py-[48px]">
          <div className="container max-w-[1180px] mx-auto px-[28px]">
            <div className="flex items-baseline justify-between mb-6">
              <h2 className="font-display text-[clamp(24px,3.5vw,42px)] uppercase tracking-[1px] text-white">
                Iconic <span className="bg-brand-yellow text-ink px-[8px] shadow-[4px_4px_0_#000] inline-block">buildings</span>
              </h2>
              <Link to="/venues" className="font-body font-bold text-[13px] text-[#cfcfcf] no-underline hover:text-brand-yellow [transition:color_.1s] shrink-0 ml-4">
                Browse all {totalVenues} →
              </Link>
            </div>
            <div className="flex gap-5 overflow-x-auto pb-3 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {ICONIC_VENUES.map(v => (
                <div key={v.id} className="snap-start shrink-0 w-[280px]">
                  <Link to="/venue/$id" params={{ id: v.id }} className="no-underline group block">
                    <div className="bg-white border-[3px] border-[#333] shadow-[4px_4px_0_#000] rounded-[8px] overflow-hidden [transition:transform_.15s,box-shadow_.15s] group-hover:-translate-x-px group-hover:-translate-y-px group-hover:shadow-[7px_7px_0_#f7df02]">
                      {v.hero_url
                        ? <img src={v.hero_url} alt={v.name} className="w-full h-[148px] object-cover" loading="lazy" />
                        : <div className="w-full h-[148px] bg-[#333]" />
                      }
                      <div className="p-4">
                        <div className="font-display text-[15px] uppercase tracking-[0.5px] text-ink leading-tight">{v.name}</div>
                        <div className="font-body text-[12px] text-[#666] mt-1">{v.city}, {v.state}</div>
                        {v.snapback_score > 0 && (
                          <div className="mt-2 font-display text-[20px] text-ink">{v.snapback_score.toFixed(1)}</div>
                        )}
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Stats bar */}
      {totalExperiences > 0 && (
        <section className="bg-ink py-[28px]">
          <div className="container max-w-[1180px] mx-auto px-[28px]">
            <div className="flex justify-around flex-wrap gap-6">
              {[
                { n: totalExperiences, label: 'Experiences ranked' },
                { n: totalVenues, label: 'Venues covered' },
                { n: totalSports, label: 'Sports' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <div className="font-display text-[36px] text-brand-yellow">{s.n.toLocaleString()}</div>
                  <div className="font-body text-[12px] text-[#888] uppercase tracking-[0.5px]">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <footer className="bg-black text-[#888] py-[40px] text-[13px]">
        <div className="container max-w-[1180px] mx-auto px-[28px] flex items-center justify-between flex-wrap gap-4">
          <span>© 2025 Snapback Sports — Field Guide</span>
          <div className="flex gap-5">
            <Link to="/rankings" search={{ league: '', q: '', collection: '' }} className="text-[#666] no-underline hover:text-brand-yellow">Rankings</Link>
            <Link to="/venues" className="text-[#666] no-underline hover:text-brand-yellow">Venues</Link>
            <Link to="/teams" search={{ league: 'NFL' }} className="text-[#666] no-underline hover:text-brand-yellow">Teams</Link>
          </div>
        </div>
      </footer>
    </>
  )
}
