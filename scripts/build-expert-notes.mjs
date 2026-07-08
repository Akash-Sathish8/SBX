// Transcript -> Snapback expert notes pipeline.
//
// Reads transcripts the team drops in data/transcripts/ (one per game/venue the
// team actually attended) plus a manifest mapping each to a venue/game, asks Claude
// to extract ONLY concrete, factual gameday notes the speaker actually states (with
// the verbatim supporting quote), and emits:
//   - db/seed.expert-notes.generated.sql   (applied to D1 via `npm run db:seed:notes:local`)
//   - data/expert-notes.review.json        (human-readable — eyeball/approve before seeding)
//
// This honours the no-fabricated-data rule: the source is real first-party footage,
// kept as EDITORIAL content (not laundered into the fan tips/reviews tables), and
// every note keeps its source url + verbatim quote so the claim stays checkable.
//
// Usage:  ANTHROPIC_API_KEY=sk-ant-... npm run db:expert-notes
//         (then review data/expert-notes.review.json, then `npm run db:seed:notes:local`)

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Anthropic from '@anthropic-ai/sdk'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const TDIR = path.join(ROOT, 'data', 'transcripts')
const MANIFEST = path.join(TDIR, 'manifest.json')
const SEED_OUT = path.join(ROOT, 'db', 'seed.expert-notes.generated.sql')
const REVIEW_OUT = path.join(ROOT, 'data', 'expert-notes.review.json')

const MODEL = 'claude-opus-4-8' // extraction is quality-sensitive + low-volume
const SECTIONS = ['getting-there', 'best-seats', 'food', 'before', 'atmosphere', 'tips']

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    notes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          section: { type: 'string', enum: SECTIONS },
          body: { type: 'string' },
          source_quote: { type: 'string' },
        },
        required: ['section', 'body', 'source_quote'],
      },
    },
  },
  required: ['notes'],
}

const SYSTEM = [
  "You extract Snapback's editorial \"what to know\" notes from a transcript of a video where the host actually attended a sporting event.",
  'Extract ONLY concrete, factual, actionable things the speaker actually states about THIS specific venue or game:',
  'getting there / parking / transit, best seats or sections, food and what to get, pregame spots, atmosphere, and insider tips.',
  'For each note: `body` is one short fan-facing sentence; `source_quote` is the verbatim line from the transcript that supports it.',
  'Do NOT infer, generalise, summarise vaguely, or add any outside knowledge. Never invent prices.',
  'If the transcript contains no concrete, location-specific info, return an empty notes array.',
].join('\n')

// Strip WEBVTT / SRT scaffolding (cue numbers, timestamps, headers) down to prose.
function toPlainText(raw) {
  return raw
    .replace(/^WEBVTT.*$/gim, '')
    .replace(/^\d+\s*$/gm, '') // SRT cue indices
    .replace(/^\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->.*$/gm, '') // timestamp lines
    .replace(/<[^>]+>/g, '') // inline tags
    .replace(/\n{2,}/g, '\n')
    .trim()
}

const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`)
const noteId = (scope, targetId, section, body) =>
  createHash('sha256').update(`${scope}|${targetId}|${section}|${body}`).digest('hex').slice(0, 24)

async function extract(client, text, entry) {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM,
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    messages: [
      {
        role: 'user',
        content:
          `This transcript is from a video about ${entry.scope === 'venue' ? 'the venue' : 'the game'} ` +
          `identified as "${entry.targetId}". Extract the notes.\n\nTRANSCRIPT:\n${text}`,
      },
    ],
  })
  const out = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
  let parsed
  try { parsed = JSON.parse(out) } catch { parsed = { notes: [] } }
  return Array.isArray(parsed?.notes) ? parsed.notes : []
}

;(async () => {
  if (!process.env.ANTHROPIC_API_KEY) {
    process.stderr.write('ANTHROPIC_API_KEY is not set. Run: ANTHROPIC_API_KEY=sk-ant-... npm run db:expert-notes\n')
    process.exit(1)
  }
  if (!existsSync(MANIFEST)) {
    process.stderr.write(`No manifest at ${MANIFEST}. Create it (see data/transcripts/README.md) and drop transcripts alongside.\n`)
    process.exit(1)
  }

  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
  if (!Array.isArray(manifest) || !manifest.length) {
    process.stderr.write('Manifest is empty — nothing to do.\n')
    writeFileSync(SEED_OUT, '-- expert notes seed (generated): no transcripts in manifest yet\n')
    writeFileSync(REVIEW_OUT, '[]\n')
    return
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const createdAt = new Date().toISOString()
  const review = []
  const rows = []

  for (const entry of manifest) {
    const { file, scope, targetId, sourceUrl } = entry || {}
    if (!file || (scope !== 'venue' && scope !== 'event') || !targetId) {
      process.stderr.write(`  skip (bad manifest entry): ${JSON.stringify(entry)}\n`)
      continue
    }
    const fpath = path.join(TDIR, file)
    if (!existsSync(fpath)) { process.stderr.write(`  skip (missing file): ${file}\n`); continue }

    process.stderr.write(`[${scope}:${targetId}] ${file} …\n`)
    const text = toPlainText(readFileSync(fpath, 'utf8'))
    if (!text) { process.stderr.write('  (empty transcript)\n'); continue }

    let notes = []
    try { notes = await extract(client, text, entry) } catch (e) {
      process.stderr.write(`  extraction failed: ${e?.message || e}\n`); continue
    }
    process.stderr.write(`  +${notes.length} notes\n`)

    for (const note of notes) {
      if (!SECTIONS.includes(note?.section) || !note?.body) continue
      const body = String(note.body).trim()
      const id = noteId(scope, targetId, note.section, body)
      review.push({ scope, targetId, sourceUrl: sourceUrl ?? null, section: note.section, body, source_quote: note.source_quote ?? '' })
      rows.push(
        `INSERT OR REPLACE INTO expert_notes (id,scope,target_id,section,body,source_url,source_quote,created_at) VALUES ` +
          `(${q(id)},${q(scope)},${q(targetId)},${q(note.section)},${q(body)},${q(sourceUrl ?? null)},${q(note.source_quote ?? null)},${q(createdAt)});`,
      )
    }
  }

  const sql = ['PRAGMA foreign_keys=OFF;', 'BEGIN TRANSACTION;', ...rows, 'COMMIT;', ''].join('\n')
  writeFileSync(SEED_OUT, sql)
  writeFileSync(REVIEW_OUT, JSON.stringify(review, null, 2) + '\n')
  process.stderr.write(`\nWrote ${rows.length} notes →\n  ${path.relative(ROOT, SEED_OUT)}\n  ${path.relative(ROOT, REVIEW_OUT)} (review before seeding)\n`)
})()
