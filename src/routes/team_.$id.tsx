import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { SiteNav } from '../components/SiteNav'
import TEAMS_DATA from '../../data/teams.json'
import VENUES_DATA from '../../data/venues.json'
import type { Teams, SportsVenue, LiveGame } from '../lib/data-types'

const TEAMS = TEAMS_DATA as Teams
const VENUES = VENUES_DATA as SportsVenue[]

const ALL_TEAMS = Object.values(TEAMS).flat()

export const Route = createFileRoute('/team_/$id')({
  head: ({ params }) => {
    const team = ALL_TEAMS.find(t => t.id === params.id)
    return { meta: [{ title: team ? `Snapback — ${team.name}` : 'Team' }] }
  },
  component: TeamPage,
})

function TeamPage() {
  const { id } = Route.useParams()
  const team = ALL_TEAMS.find(t => t.id === id)
  const venue = team ? VENUES.find(v => v.id === team.venue_id) : null

  const { data: games = [] } = useQuery<LiveGame[]>({
    queryKey: ['team-games', id],
    queryFn: () => fetch(`/api/games?team=${id}&limit=12`).then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  })

  if (!team) {
    return (
      <>
        <SiteNav />
        <div className="container max-w-[1180px] mx-auto px-[28px] py-16 text-center">
          <h1 className="font-display text-[40px] text-ink">Team not found</h1>
          <Link to="/teams" search={{ league: 'NFL' }}className="text-brand-yellow font-bold no-underline">← Back to Teams</Link>
        </div>
      </>
    )
  }

  return (
    <>
      <SiteNav active="teams" />

      {/* Hero */}
      <section
        className="grid-overlay text-white pt-[44px] pb-[38px] relative overflow-hidden"
        style={{ background: team.primary_color }}
      >
        <div className="container relative z-[1] max-w-[1180px] mx-auto px-[28px]">
          <div className="flex items-center gap-6">
            <img
              src={team.logo_url}
              alt={team.name}
              width={96}
              height={96}
              className="w-24 h-24 object-contain drop-shadow-lg"
            />
            <div>
              <div className="font-body font-bold text-[13px] tracking-[1.4px] uppercase opacity-80 mb-2">{team.conference}{team.division ? ` · ${team.division}` : ''}</div>
              <h1 className="font-display uppercase text-white tracking-[1px] leading-none text-[clamp(36px,5vw,70px)]">
                {team.name}
              </h1>
              <p className="opacity-80 text-[16px] mt-2">{team.city}, {team.state}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-[46px] bg-[#f4f4f4]">
        <div className="container max-w-[1180px] mx-auto px-[28px]">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Home venue */}
            <div className="lg:col-span-1">
              <h2 className="font-display text-[22px] uppercase tracking-[1px] mb-4">Home Venue</h2>
              {venue ? (
                <Link to="/venue/$id" params={{ id: venue.id }} className="no-underline group">
                  <div className="bg-white border-[3px] border-[#222] shadow-[4px_4px_0_#222] rounded-[8px] overflow-hidden [transition:transform_.1s,box-shadow_.1s] group-hover:-translate-x-px group-hover:-translate-y-px group-hover:shadow-[6px_6px_0_#222]">
                    {venue.hero_url && (
                      <img
                        src={venue.hero_url}
                        alt={venue.name}
                        className="w-full h-[160px] object-cover"
                      />
                    )}
                    <div className="p-4">
                      <div className="font-display text-[18px] uppercase tracking-[0.5px]">{venue.name}</div>
                      <div className="font-body text-[13px] text-[#666] mt-1">{venue.city}, {venue.state}</div>
                      <div className="flex items-center gap-3 mt-3">
                        <span className="font-body text-[12px] text-[#666]">Capacity {venue.capacity?.toLocaleString()}</span>
                        <span className="font-body text-[12px] text-[#666]">Est. {venue.opened}</span>
                      </div>
                      {venue.snapback_score > 0 && (
                        <div className="mt-3 flex items-center gap-2">
                          <span className="font-body text-[12px] text-[#666]">Snapback Score</span>
                          <span className="font-display text-[20px] text-ink">{venue.snapback_score.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="text-[#999] font-body text-[14px]">Venue info unavailable</div>
              )}
            </div>

            {/* Upcoming games */}
            <div className="lg:col-span-2">
              <h2 className="font-display text-[22px] uppercase tracking-[1px] mb-4">Upcoming Games</h2>
              {games.length === 0 ? (
                <div className="text-[#999] font-body text-[14px] py-8 text-center">No upcoming games found.</div>
              ) : (
                <div className="flex flex-col gap-3">
                  {games.map(g => (
                    <Link key={g.id} to="/game/$id" params={{ id: g.id }} className="no-underline">
                      <div className="bg-white border-[3px] border-[#222] shadow-[4px_4px_0_#222] rounded-[6px] p-4 flex items-center gap-4 [transition:transform_.1s,box-shadow_.1s] hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_#222]">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="flex flex-col items-center gap-1 min-w-[70px]">
                            <span className="font-display text-[14px]">{g.away.abbr}</span>
                            <span className="text-[#999] text-[10px]">@</span>
                            <span className="font-display text-[14px]">{g.home.abbr}</span>
                          </div>
                          <div>
                            <div className="font-body font-bold text-[13px] text-ink">{g.shortName}</div>
                            <div className="font-body text-[11px] text-[#666]">
                              {new Date(g.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                              {' · '}
                              {new Date(g.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            </div>
                            {g.venueName && <div className="font-body text-[11px] text-[#999]">{g.venueName}</div>}
                          </div>
                        </div>
                        {(g.isLive || g.isFinal) && (
                          <div className="text-right shrink-0">
                            {g.isLive && <div className="text-[10px] font-bold text-red-600 uppercase mb-0.5">Live</div>}
                            <div className="font-display text-[16px]">{g.away.score}–{g.home.score}</div>
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-black text-[#888] py-[40px] text-[13px]">
        <div className="container max-w-[1180px] mx-auto px-[28px]">
          © 2025 Snapback Sports — Field Guide. <Link to="/teams" search={{ league: 'NFL' }}className="text-brand-yellow font-bold">← Teams</Link>
        </div>
      </footer>
    </>
  )
}
