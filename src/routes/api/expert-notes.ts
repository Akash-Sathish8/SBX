import { createFileRoute } from '@tanstack/react-router'
import { dbGetExpertNotes } from '../../server/queries'

// GET /api/expert-notes?scope=&targetId= — Snapback's editorial "what to know"
// notes for a venue/game (read-only; curated, not user UGC). Empty until the
// transcript pipeline (scripts/build-expert-notes.mjs) seeds them.
const noStore = { 'Cache-Control': 'no-store' }
const SCOPES = new Set(['venue', 'event'])

export const Route = createFileRoute('/api/expert-notes')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const scope = url.searchParams.get('scope') || ''
        const targetId = url.searchParams.get('targetId') || ''
        if (!SCOPES.has(scope) || !targetId) return Response.json({ ok: false, error: 'Bad request.', data: [] }, { status: 400, headers: noStore })
        const data = (await dbGetExpertNotes(scope, targetId)).map((n) => ({ id: n.id, section: n.section, body: n.body, sourceUrl: n.sourceUrl }))
        return Response.json({ ok: true, data }, { headers: noStore })
      },
    },
  },
})
