import { createFileRoute } from '@tanstack/react-router'
import type { Team, Teams } from '#/lib/data-types'
import TEAMS_RAW from '../../../data/teams.json'

const TEAMS = TEAMS_RAW as Teams

export const Route = createFileRoute('/api/teams')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url)
          const league = url.searchParams.get('league')

          if (league) {
            const leagueUpper = league.toUpperCase() as keyof Teams
            const leagueTeams: Team[] = TEAMS[leagueUpper] ?? []
            return Response.json(leagueTeams, {
              headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
            })
          }

          return Response.json(TEAMS, {
            headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
          })
        } catch (err) {
          console.error('[teams] error', err)
          return Response.json({ error: 'Failed to fetch teams' }, { status: 500 })
        }
      },
    },
  },
})
