// AI assistant backend (Phase 1: embedded, retrieval-grounded).
//
// The assistant answers ONLY from real Snapback data: a CONTEXT block built by
// assistantContext.ts (D1 games/venues/tips/reviews/fan-stats + editorial
// expert_notes) is placed in a prompt-cached system block, and Claude is told to
// stay strictly inside it. This is how the firm no-fabricated-data rule is kept —
// the model has no licence to invent prices, stats, or facts.
//
// Runs in the Cloudflare Workers runtime: the key is read per-request from the
// `cloudflare:workers` env (NOT process.env), mirroring googleClientId() in auth.ts.

import { env } from 'cloudflare:workers'
import Anthropic from '@anthropic-ai/sdk'
import { buildContext } from './assistantContext'

// Chat path uses Sonnet 4.6 (balanced cost/quality for grounded Q&A). The offline
// transcript-extraction pipeline (scripts/build-expert-notes.mjs) uses Opus 4.8.
const CHAT_MODEL = 'claude-sonnet-4-6'

const SYSTEM_PROMPT = [
  "You are BackBuddy, Snapback's gameday assistant. Snapback Sports helps fans figure out what to know before they go to a sporting event.",
  '',
  "You answer ONLY from the CONTEXT block provided in this conversation. CONTEXT is the complete set of facts Snapback has for this page — a specific venue or game, or Snapback's overall rankings.",
  '',
  'Rules:',
  '- Never invent, estimate, guess, or infer facts that are not in CONTEXT. Do not use outside knowledge about teams, venues, schedules, prices, food, or anything else.',
  "- If the answer isn't in CONTEXT, say so plainly — \"Snapback doesn't have that yet\" — and, when it fits, invite the fan to add a tip or review so the next person knows.",
  "- Snapback does NOT track ticket prices or seat-by-seat pricing. For any price or \"how much\" question, say Snapback doesn't have ticket prices yet.",
  '- Fan ratings are crowd averages — mention how many ratings they are based on. If no fans have rated yet, say so honestly.',
  "- When it matters, say where a fact comes from: \"Snapback's team notes…\", \"a fan tip says…\", or \"a fan review mentions…\".",
  '- Be concise, friendly, and specific. Keep answers short. Do not use markdown headings. Do not use em dashes; write in plain sentences.',
].join('\n')

export type AssistantTurn = { role: 'user' | 'assistant'; content: string }
export type AssistantResult =
  | { ok: true; reply: string; title: string; usage: unknown }
  | { ok: false; status: number; error: string }

export async function runAssistant(
  scope: 'venue' | 'event' | 'general',
  targetId: string | undefined,
  messages: AssistantTurn[],
): Promise<AssistantResult> {
  const apiKey = (env as any).ANTHROPIC_API_KEY as string | undefined
  if (!apiKey) return { ok: false, status: 503, error: 'The assistant is not configured yet.' }

  const ctx = await buildContext(scope, targetId)
  if (!ctx) return { ok: false, status: 404, error: "Snapback doesn't have data on this one yet." }

  // Construct per-request (env isn't reliably populated at module-eval time in Workers).
  const client = new Anthropic({ apiKey })
  try {
    const res = await client.messages.create({
      model: CHAT_MODEL,
      max_tokens: 1024,
      thinking: { type: 'disabled' }, // grounded Q&A over a small context — no need to think
      system: [
        { type: 'text', text: SYSTEM_PROMPT },
        {
          type: 'text',
          text: `CONTEXT — the complete set of facts Snapback has about ${ctx.title}:\n\n${ctx.context}`,
          cache_control: { type: 'ephemeral' }, // stable per (scope,targetId) → cheap follow-ups
        },
      ],
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    })
    const reply = res.content
      .filter((b) => b.type === 'text')
      .map((b: any) => b.text)
      .join('')
      .trim()
    return {
      ok: true,
      reply: reply || "Sorry — I couldn't put that together. Try asking another way.",
      title: ctx.title,
      usage: res.usage,
    }
  } catch (e: any) {
    if (e instanceof Anthropic.RateLimitError) return { ok: false, status: 503, error: 'The assistant is busy right now — try again in a moment.' }
    if (e instanceof Anthropic.APIError) return { ok: false, status: 502, error: 'The assistant had a hiccup. Try again.' }
    return { ok: false, status: 500, error: 'Something went wrong.' }
  }
}
