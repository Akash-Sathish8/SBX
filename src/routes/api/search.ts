import { createFileRoute } from '@tanstack/react-router'
import { dbSearchTeams, dbSearchVenues, dbSearchGames } from '../../server/queries'
import { tokenize, scoreMatch, gameBoost } from '@/lib/searchScore'
import { LEAGUES, COLLEGE_LEAGUES } from '@/lib/sports'
import experiencesData from '../../../public/data/experiences.json'

// Free-text search across the four explorable entity types: teams, venues,
// games (D1) and ranked experiences (experiences.json, statically bundled —
// same idiom as assistantContext). No live-score overlay here: suggestion rows
// show no scores and D1 `state` is at most ~2 min stale via cron.
//   GET /api/search?q=<text>&limit=<1..20>&types=teams,venues,games,experiences

interface Exp {
  rank: number
  name: string
  location: string
  sport: string
  final: number
  image?: string | null
}

const ALL_TYPES = ['teams', 'venues', 'games', 'experiences'] as const
type SearchType = (typeof ALL_TYPES)[number]

// Pro leagues in display order first, college after — mirrors the app's rails.
const LEAGUE_ORDER: string[] = [...LEAGUES, ...COLLEGE_LEAGUES]
const leagueRank = (l: string) => {
  const i = LEAGUE_ORDER.indexOf(l)
  return i === -1 ? LEAGUE_ORDER.length : i
}

export const Route = createFileRoute('/api/search')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const q = (url.searchParams.get('q') ?? '').trim()
        if (q.length < 2) {
          return Response.json({ ok: false, error: 'q must be at least 2 characters' }, { status: 400 })
        }
        const tokens = tokenize(q)
        const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 5, 1), 20)
        const typesParam = url.searchParams.get('types')
        const types = new Set<SearchType>(
          typesParam
            ? (typesParam.split(',').map((t) => t.trim()).filter((t): t is SearchType => (ALL_TYPES as readonly string[]).includes(t)))
            : ALL_TYPES,
        )
        if (!types.size) {
          return Response.json({ ok: false, error: `types must be a subset of ${ALL_TYPES.join(',')}` }, { status: 400 })
        }

        const now = new Date()
        const todayIso = now.toISOString().slice(0, 10)
        const nowIso = now.toISOString()

        try {
          const [teamRows, venueRows, gameRows] = await Promise.all([
            types.has('teams') ? dbSearchTeams(tokens) : Promise.resolve([]),
            types.has('venues') ? dbSearchVenues(tokens) : Promise.resolve([]),
            types.has('games') ? dbSearchGames(tokens, todayIso) : Promise.resolve([]),
          ])

          const teams = teamRows
            .map((t) => ({ t, s: scoreMatch(`${t.displayName} ${t.location}`, tokens, { abbr: t.abbr }) }))
            .filter((x) => x.s > 0)
            .sort((a, b) => b.s - a.s || leagueRank(a.t.league) - leagueRank(b.t.league) || a.t.displayName.localeCompare(b.t.displayName))
            .slice(0, limit)
            .map((x) => x.t)

          const venues = venueRows
            .map((v) => {
              const hay = `${v.name} ${v.city ?? ''} ${v.state ?? ''} ${v.teams.map((t) => t.displayName).join(' ')}`
              return { v, s: scoreMatch(hay, tokens) + (v.image ? 5 : 0) }
            })
            .filter((x) => x.s > 0)
            .sort((a, b) => b.s - a.s || a.v.name.localeCompare(b.v.name))
            .slice(0, limit)
            .map((x) => x.v)

          const games = gameRows
            .map((g) => {
              const hay = `${g.name} ${g.shortName} ${g.venueName ?? ''} ${g.venueCity ?? ''}`
              return { g, s: scoreMatch(hay, tokens) + gameBoost(g.state, g.date, nowIso) }
            })
            .filter((x) => x.s > 0)
            .sort((a, b) => b.s - a.s || (a.g.date < b.g.date ? -1 : 1))
            .slice(0, limit)
            .map((x) => x.g)

          const experiences = !types.has('experiences')
            ? []
            : ((experiencesData as any).experiences as Exp[])
                .map((e) => ({ e, s: scoreMatch(`${e.name} ${e.location} ${e.sport}`, tokens) }))
                .filter((x) => x.s > 0)
                .sort((a, b) => b.s - a.s || a.e.rank - b.e.rank)
                .slice(0, limit)
                .map(({ e }) => ({ rank: e.rank, name: e.name, location: e.location, sport: e.sport, final: e.final, image: e.image ?? undefined }))

          return Response.json(
            { ok: true, q, data: { teams, venues, games, experiences } },
            // All four sources are slow-moving (cron touches only volatile game
            // fields) — cache aggressively at the edge.
            { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' } },
          )
        } catch (e: any) {
          return Response.json({ ok: false, error: String(e?.message || e) }, { status: 500 })
        }
      },
    },
  },
})
