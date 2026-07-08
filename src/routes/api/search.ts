import { createFileRoute } from '@tanstack/react-router'
import type { Experience, SportsVenue, Team } from '#/lib/data-types'

// Build-time imports — bundled at compile time
import EXPERIENCES_RAW from '../../../data/experiences.json'
import VENUES_RAW from '../../../data/venues.json'
import TEAMS_RAW from '../../../data/teams.json'

const EXPERIENCES = EXPERIENCES_RAW as Experience[]
const VENUES = VENUES_RAW as SportsVenue[]
const TEAMS_ALL = TEAMS_RAW as Record<string, Team[]>

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

function score(query: string, target: string): number {
  const q = query.toLowerCase().trim()
  const t = target.toLowerCase()
  if (!q) return 0
  if (t === q) return 10
  if (t.startsWith(q)) return 7
  const words = t.split(/\s+/)
  if (words.some(w => w.startsWith(q))) return 5
  if (t.includes(q)) return 2
  return 0
}

function scoreItem(query: string, fields: string[]): number {
  return fields.reduce((best, f) => Math.max(best, score(query, f)), 0)
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createFileRoute('/api/search')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url)
          const q = (url.searchParams.get('q') ?? '').trim()
          const typeFilter = url.searchParams.get('type') ?? ''
          const limitParam = parseInt(url.searchParams.get('limit') ?? '20', 10)
          const limit = Number.isNaN(limitParam) ? 20 : Math.min(limitParam, 100)
          const perGroup = Math.ceil(limit / 3)

          if (!q) {
            return Response.json({ results: { experiences: [], venues: [], teams: [], total: 0 } })
          }

          // Score experiences
          const scoredExperiences = EXPERIENCES.map(exp => ({
            item: exp,
            score: scoreItem(q, [exp.venue_name, exp.exp_name, exp.team ?? '', exp.league]),
          }))
            .filter(x => x.score > 0)
            .sort((a, b) => b.score - a.score)

          // Score venues
          const scoredVenues = VENUES.map(v => ({
            item: v,
            score: scoreItem(q, [v.name, v.city, v.state, ...v.leagues, ...v.teams]),
          }))
            .filter(x => x.score > 0)
            .sort((a, b) => b.score - a.score)

          // Score teams (flatten all leagues)
          const allTeams: Team[] = Object.values(TEAMS_ALL).flat()
          const scoredTeams = allTeams
            .map(t => ({
              item: t,
              score: scoreItem(q, [t.name, t.city, t.abbr, t.conference, t.division ?? '']),
            }))
            .filter(x => x.score > 0)
            .sort((a, b) => b.score - a.score)

          let experiences: Experience[] = []
          let venues: SportsVenue[] = []
          let teams: Team[] = []

          if (typeFilter === 'experiences') {
            experiences = scoredExperiences.slice(0, limit).map(x => x.item)
          } else if (typeFilter === 'venues') {
            venues = scoredVenues.slice(0, limit).map(x => x.item)
          } else if (typeFilter === 'teams') {
            teams = scoredTeams.slice(0, limit).map(x => x.item)
          } else {
            experiences = scoredExperiences.slice(0, perGroup).map(x => x.item)
            venues = scoredVenues.slice(0, perGroup).map(x => x.item)
            teams = scoredTeams.slice(0, perGroup).map(x => x.item)
          }

          const total = experiences.length + venues.length + teams.length

          return Response.json(
            { results: { experiences, venues, teams, total } },
            { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } },
          )
        } catch (err) {
          console.error('[search] error', err)
          return Response.json({ error: 'Search failed' }, { status: 500 })
        }
      },
    },
  },
})
