import { createFileRoute } from '@tanstack/react-router'
import type { Conference } from '#/lib/data-types'
import CONFERENCES_RAW from '../../../data/conferences.json'

const CONFERENCES = CONFERENCES_RAW as Conference[]

export const Route = createFileRoute('/api/conferences')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url)
          const sport = url.searchParams.get('sport')

          let result: Conference[] = CONFERENCES

          if (sport) {
            const sportUpper = sport.toUpperCase() as 'CFB' | 'CBB'
            result = CONFERENCES.filter(c => c.sport === sportUpper)
          }

          return Response.json(result, {
            headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
          })
        } catch (err) {
          console.error('[conferences] error', err)
          return Response.json({ error: 'Failed to fetch conferences' }, { status: 500 })
        }
      },
    },
  },
})
