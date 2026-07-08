import { createFileRoute } from '@tanstack/react-router'
import type { SportsVenue } from '#/lib/data-types'
import VENUES_RAW from '../../../data/venues.json'

const VENUES = VENUES_RAW as SportsVenue[]

export const Route = createFileRoute('/api/venues')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url)
          const league = url.searchParams.get('league')

          let result: SportsVenue[] = VENUES

          if (league) {
            const leagueUpper = league.toUpperCase()
            result = VENUES.filter(v => v.leagues.some(l => l.toUpperCase() === leagueUpper))
          }

          return Response.json(result, {
            headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
          })
        } catch (err) {
          console.error('[venues] error', err)
          return Response.json({ error: 'Failed to fetch venues' }, { status: 500 })
        }
      },
    },
  },
})
