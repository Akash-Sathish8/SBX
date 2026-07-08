import { createFileRoute } from '@tanstack/react-router'
import { fetchScoreboard, type Sport, type GameSummary } from '#/lib/server/espn'

const ALL_SPORTS: Sport[] = ['nfl', 'mlb', 'nba', 'nhl', 'college-football', 'mens-college-basketball']

export const Route = createFileRoute('/api/games')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url)
          const sportParam = url.searchParams.get('sport')
          const dateParam = url.searchParams.get('date') ?? undefined
          const todayParam = url.searchParams.get('today') === 'true'
          const teamParam = url.searchParams.get('team')
          const limitParam = parseInt(url.searchParams.get('limit') ?? '40', 10)
          const limit = Number.isNaN(limitParam) ? 40 : Math.min(limitParam, 200)

          // Validate sport if provided
          const sport = sportParam as Sport | null
          if (sport && !ALL_SPORTS.includes(sport)) {
            return Response.json(
              { error: `Invalid sport. Must be one of: ${ALL_SPORTS.join(', ')}` },
              { status: 400 },
            )
          }

          // Determine which sports to fetch
          const sportsToFetch: Sport[] = sport ? [sport] : ALL_SPORTS

          // Determine date: if today=true use no date param (ESPN returns today), else use provided date
          const fetchDate = todayParam ? undefined : dateParam

          // Fetch all sports in parallel
          const results = await Promise.all(
            sportsToFetch.map(s => fetchScoreboard(s, fetchDate)),
          )

          let games: GameSummary[] = results.flat()

          // Filter by team abbreviation if requested
          if (teamParam) {
            const abbr = teamParam.toUpperCase()
            games = games.filter(
              g => g.home.abbr.toUpperCase() === abbr || g.away.abbr.toUpperCase() === abbr,
            )
          }

          // Trim to limit
          games = games.slice(0, limit)

          // Determine cache header: shorter TTL if any live game is in progress
          const hasLive = games.some(g => g.isLive)
          const cacheControl = hasLive
            ? 'public, s-maxage=20, stale-while-revalidate=40'
            : 'public, s-maxage=300, stale-while-revalidate=600'

          return Response.json(games, { headers: { 'Cache-Control': cacheControl } })
        } catch (err) {
          console.error('[games] error', err)
          return Response.json({ error: 'Failed to fetch games' }, { status: 500 })
        }
      },
    },
  },
})
