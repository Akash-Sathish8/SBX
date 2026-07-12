import { createFileRoute } from '@tanstack/react-router'
import { getUserFromRequest } from '@/lib/auth.functions'
import { dbAssistantRateBump } from '../../server/db'
import { runAssistant, type AssistantTurn } from '../../server/assistant'

// POST /api/assistant — grounded chat about one venue or game. Auth-gated (the
// model costs money) and per-user rate-limited. The client sends the running
// conversation; we validate it (the trust boundary) before handing it to Claude.
const noStore = { 'Cache-Control': 'no-store' }
const SCOPES = new Set(['venue', 'event', 'general'])
const isTarget = (s: any) => typeof s === 'string' && /^[a-z0-9:_-]{1,40}$/i.test(s)
const HOURLY_LIMIT = 30

// Must be a non-empty, alternating user/assistant transcript that starts AND ends
// with a user turn — otherwise the Messages API 400s. Cap length + size.
function validMessages(raw: any): AssistantTurn[] | null {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 20) return null
  const out: AssistantTurn[] = []
  for (let i = 0; i < raw.length; i++) {
    const role = raw[i]?.role
    const content = typeof raw[i]?.content === 'string' ? raw[i].content.trim() : ''
    if (role !== (i % 2 === 0 ? 'user' : 'assistant')) return null
    if (!content || content.length > 2000) return null
    out.push({ role, content })
  }
  if (out[out.length - 1].role !== 'user') return null
  return out
}

export const Route = createFileRoute('/api/assistant')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getUserFromRequest(request)
        if (!user) return Response.json({ ok: false, error: 'Sign in to use the assistant.' }, { status: 401, headers: noStore })

        let body: any
        try { body = await request.json() } catch { return Response.json({ ok: false, error: 'Invalid request.' }, { status: 400, headers: noStore }) }

        const scope = String(body?.scope ?? '')
        const targetId = body?.targetId != null ? String(body.targetId) : ''
        if (!SCOPES.has(scope)) return Response.json({ ok: false, error: 'Bad request.' }, { status: 400, headers: noStore })
        if (scope !== 'general' && !isTarget(targetId)) return Response.json({ ok: false, error: 'Bad request.' }, { status: 400, headers: noStore })
        const messages = validMessages(body?.messages)
        if (!messages) return Response.json({ ok: false, error: 'Bad request.' }, { status: 400, headers: noStore })

        // Per-user hourly rate limit (counts attempts, including failures).
        const bucket = new Date().toISOString().slice(0, 13) // 'YYYY-MM-DDTHH'
        const count = await dbAssistantRateBump(user.id, bucket)
        if (count > HOURLY_LIMIT) return Response.json({ ok: false, error: "You've hit the hourly limit for the assistant. Try again later." }, { status: 429, headers: noStore })

        const result = await runAssistant(scope as 'venue' | 'event' | 'general', scope === 'general' ? undefined : targetId, messages)
        if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: result.status, headers: noStore })
        return Response.json({ ok: true, reply: result.reply }, { headers: noStore })
      },
    },
  },
})
