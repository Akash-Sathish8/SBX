import { createFileRoute } from '@tanstack/react-router'
import { dbConferences } from '../../server/db'
import { isCollegeLeague } from '@/lib/sports'

// GET /api/conferences?league=college-football|college-basketball — every D1
// conference for that sport with its member schools. Public, long-cached (the
// conference roster is static for a season).
export const Route = createFileRoute('/api/conferences')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const league = new URL(request.url).searchParams.get('league')
        if (!isCollegeLeague(league)) {
          return Response.json({ ok: false, error: 'league must be college-football or college-basketball', data: [] }, { status: 400 })
        }
        try {
          const data = await dbConferences(league)
          return Response.json(
            { ok: true, data },
            { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } },
          )
        } catch (e: any) {
          return Response.json({ ok: false, error: String(e?.message || e), data: [] }, { status: 500 })
        }
      },
    },
  },
})
