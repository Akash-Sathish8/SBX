import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import type { Experience, SportsVenue } from '#/lib/data-types'
import { parseBody } from '#/lib/server/middleware'
import EXPERIENCES_RAW from '../../../data/experiences.json'
import VENUES_RAW from '../../../data/venues.json'

const EXPERIENCES = EXPERIENCES_RAW as Experience[]
const VENUES = VENUES_RAW as SportsVenue[]

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 512

// ---------------------------------------------------------------------------
// Build system prompt based on context
// ---------------------------------------------------------------------------

function buildSystemPrompt(
  context: string,
  entityId?: string | null,
): string {
  if (context === 'venue') {
    const venue = entityId ? VENUES.find(v => v.id === entityId || v.slug === entityId) : null
    const experience = entityId
      ? EXPERIENCES.find(e => e.venue_id === (venue?.id ?? entityId))
      : null

    const venueName = venue?.name ?? 'this stadium'
    const city = venue ? `${venue.city}, ${venue.state}` : ''
    const review = experience?.review_body ?? ''
    const tips = experience?.tips ?? []
    const tipsText = tips
      .map(([label, text]: [string, string]) => `- ${label}: ${text}`)
      .join('\n')

    return [
      `You are a knowledgeable gameday guide for ${venueName}${city ? ` in ${city}` : ''}.`,
      `You help fans plan their gameday experience with insider tips and practical advice.`,
      review ? `\nExpert review:\n${review}` : '',
      tipsText ? `\nKey tips:\n${tipsText}` : '',
      `\nKeep responses concise and actionable. Focus on practical gameday advice.`,
    ]
      .filter(Boolean)
      .join('\n')
  }

  if (context === 'game') {
    // Try to look up the venue for this game entity
    const venue = entityId ? VENUES.find(v => v.id === entityId || v.slug === entityId) : null
    const venueName = venue?.name ?? 'the stadium'
    return [
      `You are helping a fan plan for a game at ${venueName}.`,
      `Provide practical advice about attending the game: parking, arrival time, what to bring, seating tips, and nearby food/bars.`,
      `Keep responses concise and friendly.`,
    ].join('\n')
  }

  // general
  return [
    `You are Snapback's Field Guide assistant — an expert on the gameday experience at sports venues across the US.`,
    `You help fans find the best seats, food, parking, and gameday traditions at stadiums and arenas.`,
    `Keep responses concise, friendly, and focused on actionable advice.`,
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createFileRoute('/api/assistant')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await parseBody<{
            context?: string
            entity_id?: string
            message: string
          }>(request)

          if (!body) {
            return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          const { context = 'general', entity_id, message } = body

          if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return new Response(JSON.stringify({ error: 'message is required' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          if (message.length > 1000) {
            return new Response(JSON.stringify({ error: 'message must be 1000 characters or fewer' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          const apiKey = (env as any).ANTHROPIC_API_KEY
          if (!apiKey) {
            return new Response(
              JSON.stringify({ error: 'Assistant service unavailable' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } },
            )
          }

          const systemPrompt = buildSystemPrompt(context, entity_id)

          // Forward as an SSE stream directly to the client
          const anthropicResponse = await fetch(ANTHROPIC_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: MODEL,
              max_tokens: MAX_TOKENS,
              stream: true,
              system: systemPrompt,
              messages: [
                { role: 'user', content: message.trim() },
              ],
            }),
          })

          if (!anthropicResponse.ok) {
            const errBody = await anthropicResponse.text()
            console.error('[assistant] Anthropic error', anthropicResponse.status, errBody)
            return new Response(
              JSON.stringify({ error: 'Assistant request failed' }),
              { status: 502, headers: { 'Content-Type': 'application/json' } },
            )
          }

          // Forward the SSE stream directly to the client
          return new Response(anthropicResponse.body, {
            status: 200,
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'X-Accel-Buffering': 'no',
            },
          })
        } catch (err) {
          console.error('[assistant] error', err)
          return new Response(
            JSON.stringify({ error: 'Assistant failed' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          )
        }
      },
    },
  },
})
