import { createFileRoute } from '@tanstack/react-router'
import { getUserFromRequest, getVoterFromRequest } from '@/lib/auth.functions'
import { dbVoteTip } from '../../server/queries'

const noStore = { 'Cache-Control': 'no-store' }

// POST { tipId, vote: 1 | -1 | 0 } — cast, flip, or clear (0) your vote on a
// tip. The tips mirror of /api/review-votes; one vote per (tip, voter).
export const Route = createFileRoute('/api/tip-votes')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Votes work signed-out: anonymous devices key on the sbx_anon cookie
        // (minted on first vote), signed-in users on their account id.
        const user = await getUserFromRequest(request)
        const { voter, setCookie } = getVoterFromRequest(request, user?.id)
        let body: any
        try { body = await request.json() } catch { return Response.json({ ok: false, error: 'Invalid request.' }, { status: 400, headers: noStore }) }
        const tipId = String(body?.tipId ?? '')
        const vote = Number(body?.vote)
        if (!tipId || ![1, -1, 0].includes(vote)) {
          return Response.json({ ok: false, error: 'tipId and vote (1, -1, or 0) required.' }, { status: 400, headers: noStore })
        }
        try {
          const counts = await dbVoteTip(voter, tipId, vote as 1 | -1 | 0)
          if (!counts) return Response.json({ ok: false, error: 'Tip not found.' }, { status: 404, headers: noStore })
          const headers: Record<string, string> = setCookie ? { ...noStore, 'Set-Cookie': setCookie } : noStore
          return Response.json({ ok: true, data: { ...counts, myVote: vote } }, { headers })
        } catch (e: any) {
          return Response.json({ ok: false, error: String(e?.message || e) }, { status: 500, headers: noStore })
        }
      },
    },
  },
})
