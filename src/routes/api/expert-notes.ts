import { createFileRoute } from '@tanstack/react-router'
import type { Experience } from '#/lib/data-types'
import EXPERIENCES_RAW from '../../../data/experiences.json'

const EXPERIENCES = EXPERIENCES_RAW as Experience[]

export const Route = createFileRoute('/api/expert-notes')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url)
          const venueId = url.searchParams.get('venue_id')
          const experienceId = url.searchParams.get('experience_id')

          if (!venueId && !experienceId) {
            return Response.json(
              { error: 'venue_id or experience_id is required' },
              { status: 400 },
            )
          }

          let experience: Experience | undefined

          if (experienceId) {
            experience = EXPERIENCES.find(e => e.id === experienceId)
          } else if (venueId) {
            // Return the highest-ranked experience for this venue
            const matches = EXPERIENCES.filter(e => e.venue_id === venueId).sort(
              (a, b) => a.rank - b.rank,
            )
            experience = matches[0]
          }

          if (!experience) {
            return Response.json(null, {
              headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
            })
          }

          return Response.json(
            { review_body: experience.review_body, tips: experience.tips },
            { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' } },
          )
        } catch (err) {
          console.error('[expert-notes] error', err)
          return Response.json({ error: 'Failed to fetch expert notes' }, { status: 500 })
        }
      },
    },
  },
})
