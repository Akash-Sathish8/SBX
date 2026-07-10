// Shared grounding-context builder for the AI assistant.
//
// Everything the assistant is allowed to know comes from here: real rows in D1
// (games / venues / fan rankings / tips / reviews) plus the editorial expert_notes.
// Phase 1 (embedded "ask about this venue/game") calls getVenueContext /
// getEventContext directly to pre-fetch a CONTEXT block. Phase 2 (standalone chat)
// will expose the same retrieval helpers as tools — so this module is the single
// source of truth for "what data the assistant can see".
//
// IMPORTANT: the returned `context` string is placed in a prompt-cached system
// block, so it must be DETERMINISTIC — no timestamps, no row ids, no Date.now().
// We print durable facts (names, scores, bodies, authors) and omit volatile ids.

import {
  dbVenueById,
  dbGameById,
  dbGames,
  dbVenueFanStats,
  dbGetExpertNotes,
  dbGetTips,
  dbGetReviews,
  type ExpertNote,
  type Tip,
  type Review,
  type VenueFanStats,
} from './db'
import type { Game, Venue } from '../lib/espn'
import { SPORTS, isLeague, type League } from '../lib/sports'
import experiencesData from '../../public/data/experiences.json'

export interface AssistantContext {
  title: string // short label for this target, e.g. "Wrigley Field"
  context: string // the grounded CONTEXT block (deterministic)
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
// Date formatting off a stored ISO string is deterministic (no "now").
function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return `${WD[d.getUTCDay()]} ${MON[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}

function fanLine(s: VenueFanStats): string {
  if (!s.count) return 'FAN RATINGS: no fans have rated this yet.'
  return (
    `FAN RATINGS (average of ${s.count} fan ${s.count === 1 ? 'rating' : 'ratings'}, scale 1-10): ` +
    `fans ${s.fans}, food ${s.food}, uniqueness ${s.unique}, stadium ${s.stadium}, overall ${s.score}`
  )
}

function notesBlock(notes: ExpertNote[], label = 'SNAPBACK EXPERT NOTES'): string {
  if (!notes.length) return ''
  const lines = notes.map((n) => {
    const src = n.sourceUrl ? `  (source: ${n.sourceUrl})` : ''
    return `- [${n.section}] ${n.body}${src}`
  })
  return `${label}:\n${lines.join('\n')}`
}

function tipsBlock(tips: Tip[], label = 'FAN TIPS'): string {
  if (!tips.length) return ''
  const lines = tips.map((t) => `- [${t.section}] ${t.body} (${t.author})`)
  return `${label}:\n${lines.join('\n')}`
}

function reviewsBlock(reviews: Review[], label = 'FAN REVIEWS'): string {
  if (!reviews.length) return ''
  const lines = reviews.map((r) => `- ${r.rating != null ? `(${r.rating}/10) ` : ''}${r.body} (${r.author})`)
  return `${label}:\n${lines.join('\n')}`
}

function venueFacts(v: Venue): string {
  const loc = [v.city, v.state].filter(Boolean).join(', ')
  const phys = [v.surface, v.indoor === undefined ? undefined : v.indoor ? 'indoor' : 'outdoor'].filter(Boolean).join(', ')
  const teams = v.teams.map((t) => `${t.displayName} (${SPORTS[t.league]?.label ?? t.league})`).join('; ')
  return [
    `VENUE: ${v.name}${loc ? ` · ${loc}` : ''}${phys ? ` · ${phys}` : ''}`,
    teams ? `HOME TEAM(S): ${teams}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function gamesHere(v: Venue, games: Game[]): string {
  const abbrs = new Set(v.teams.map((t) => t.abbr))
  const here = games
    .filter((g) => g.venue.name === v.name || abbrs.has(g.home.abbr))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8)
  if (!here.length) return ''
  const lines = here.map((g) => {
    const status = g.state === 'post' ? 'Final' : g.state === 'in' ? g.detail || 'Live' : fmtDate(g.date)
    const sc = (g.state === 'post' || g.state === 'in') && g.home.score != null && g.away.score != null ? ` (${g.away.abbr} ${g.away.score}–${g.home.score} ${g.home.abbr})` : ''
    return `- ${g.away.displayName} @ ${g.home.displayName} · ${status}${sc}`
  })
  return `GAMES HERE:\n${lines.join('\n')}`
}

// --- Venue scope: targetId is the ESPN venue id ---------------------------------
export async function getVenueContext(targetId: string): Promise<AssistantContext | null> {
  const v = await dbVenueById(targetId)
  if (!v) return null
  const [fan, notes, tips, reviews, allGames] = await Promise.all([
    dbVenueFanStats(v.name),
    dbGetExpertNotes('venue', targetId),
    dbGetTips('venue', targetId),
    dbGetReviews('venue', targetId),
    dbGames({ limit: 600 }),
  ])
  const context = [
    venueFacts(v),
    fanLine(fan),
    gamesHere(v, allGames),
    notesBlock(notes),
    tipsBlock(tips),
    reviewsBlock(reviews),
  ]
    .filter(Boolean)
    .join('\n\n')
  return { title: v.name, context }
}

// --- Event scope: targetId is 'league:gameId' (matches the tips/reviews scope) ---
export async function getEventContext(targetId: string): Promise<AssistantContext | null> {
  const idx = targetId.indexOf(':')
  if (idx < 0) return null
  const leaguePart = targetId.slice(0, idx)
  const gameId = targetId.slice(idx + 1)
  if (!isLeague(leaguePart) || !gameId) return null
  const league = leaguePart as League

  const g = await dbGameById(gameId, league)
  if (!g) return null

  // Event-scoped UGC/notes, plus the host venue's venue-scoped content (most
  // "how do I get there / where do I sit" knowledge lives at the venue level).
  const venueId = g.venue.id
  const [notes, tips, reviews, fan, vNotes, vTips] = await Promise.all([
    dbGetExpertNotes('event', targetId),
    dbGetTips('event', targetId),
    dbGetReviews('event', targetId),
    g.venue.name ? dbVenueFanStats(g.venue.name) : Promise.resolve(null),
    venueId ? dbGetExpertNotes('venue', venueId) : Promise.resolve([] as ExpertNote[]),
    venueId ? dbGetTips('venue', venueId) : Promise.resolve([] as Tip[]),
  ])

  const status =
    g.state === 'post' ? 'Final' : g.state === 'in' ? `Live: ${g.detail || 'in progress'}` : `Scheduled: ${fmtDate(g.date)}`
  const score =
    (g.state === 'post' || g.state === 'in') && g.home.score != null && g.away.score != null
      ? `SCORE: ${g.away.displayName} ${g.away.score} – ${g.home.score} ${g.home.displayName}`
      : ''
  const venueLine = g.venue.name ? `VENUE: ${g.venue.name}${g.venue.city ? `, ${g.venue.city}` : ''}${g.venue.state ? `, ${g.venue.state}` : ''}` : ''

  const context = [
    `GAME: ${g.away.displayName} @ ${g.home.displayName} · ${SPORTS[league]?.label ?? league}`,
    `STATUS: ${status}`,
    score,
    venueLine,
    fan ? fanLine(fan) : '',
    notesBlock(notes, 'SNAPBACK EXPERT NOTES (this game)'),
    notesBlock(vNotes, 'SNAPBACK EXPERT NOTES (this venue)'),
    tipsBlock(tips, 'FAN TIPS (this game)'),
    tipsBlock(vTips, 'FAN TIPS (this venue)'),
    reviewsBlock(reviews, 'FAN REVIEWS (this game)'),
  ]
    .filter(Boolean)
    .join('\n\n')
  return { title: `${g.away.displayName} @ ${g.home.displayName}`, context }
}

// --- General (site-wide) scope: BackBuddy on any page that isn't a specific
// venue/game (home, /venues, /rankings, …). Grounded in Snapback's experience
// rankings (the core ranked dataset) plus a short overview of what the site covers.
export async function getGeneralContext(): Promise<AssistantContext> {
  const exps = ((experiencesData as any).experiences ?? []) as Array<any>
  const ranked = exps.map(
    (e) => `#${e.rank} ${e.name} (${e.location}, ${e.sport}): fans ${e.fans}, food ${e.food}, unique ${e.unique}, stadium ${e.stadium}, overall ${e.final}`,
  )
  const context = [
    'SNAPBACK ranks the best live sports experiences in the US and helps fans figure out what to know before they go. Fans can browse venues and games, read Snapback and fan tips, and see the rankings on the site.',
    'Leagues covered: MLB, NFL, NBA, college football, and college basketball. There is no ticket-price data anywhere in Snapback.',
    `SNAPBACK EXPERIENCE RANKINGS (${ranked.length} experiences; scores out of 10: fans, food, uniqueness, stadium, and overall):`,
    ranked.join('\n'),
  ].join('\n\n')
  return { title: 'Snapback', context }
}

export async function buildContext(scope: 'venue' | 'event' | 'general', targetId?: string): Promise<AssistantContext | null> {
  if (scope === 'general') return getGeneralContext()
  if (!targetId) return null
  return scope === 'venue' ? getVenueContext(targetId) : getEventContext(targetId)
}
