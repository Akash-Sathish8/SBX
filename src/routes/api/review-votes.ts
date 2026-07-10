import { createFileRoute } from '@tanstack/react-router'
import { getUserFromRequest, getVoterFromRequest } from '../../server/auth'
import { dbVoteReview } from '../../server/db'

const noStore = { 'Cache-Control': 'no-store' }

// POST { reviewId, vote: 1 | -1 | 0 } — cast, flip, or clear (0) your vote on
// a review. Works signed-out; one vote per (review, voter) enforced by the
// table's primary key. Returns the fresh counts plus your standing vote.
export const Route = createFileRoute('/api/review-votes')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Votes work signed-out: anonymous devices key on the sbx_anon cookie
        // (minted on first vote), signed-in users on their account id.
        const user = await getUserFromRequest(request)
        const { voter, setCookie } = getVoterFromRequest(request, user?.id)
        let body: any
        try { body = await request.json() } catch { return Response.json({ ok: false, error: 'Invalid request.' }, { status: 400, headers: noStore }) }
        const reviewId = String(body?.reviewId ?? '')
        const vote = Number(body?.vote)
        if (!reviewId || ![1, -1, 0].includes(vote)) {
          return Response.json({ ok: false, error: 'reviewId and vote (1, -1, or 0) required.' }, { status: 400, headers: noStore })
        }
        try {
          const counts = await dbVoteReview(voter, reviewId, vote as 1 | -1 | 0)
          if (!counts) return Response.json({ ok: false, error: 'Review not found.' }, { status: 404, headers: noStore })
          const headers: Record<string, string> = setCookie ? { ...noStore, 'Set-Cookie': setCookie } : noStore
          return Response.json({ ok: true, data: { ...counts, myVote: vote } }, { headers })
        } catch (e: any) {
          return Response.json({ ok: false, error: String(e?.message || e) }, { status: 500, headers: noStore })
        }
      },
    },
  },
})
