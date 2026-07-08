// Ranking for /api/search. Pure functions — no D1 here — so ordering is
// unit-testable and shared across entity types. The SQL layer only finds
// candidates (every token must appear somewhere in the row's haystack);
// this module decides which candidates surface first.

export function tokenize(q: string): string[] {
  return q.toLowerCase().split(/\s+/).filter(Boolean)
}

// Escape a token for use inside a LIKE '%…%' pattern with ESCAPE '\'.
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => '\\' + c)
}

export interface ScoreOpts {
  abbr?: string // team abbreviation — an exact abbr token ("phi") outranks prefix hits
}

// Per-token tiers: exact haystack 100 · exact abbr 95 · whole word 85 ·
// word prefix 80 · mid-word substring 40. A token that lands nowhere fails
// the whole match (SQL candidates search a wider haystack than we may score,
// e.g. a venue matched via a tenant team name the caller chose not to score).
// Returns the mean over tokens, 0-100.
export function scoreMatch(haystack: string, tokens: string[], opts: ScoreOpts = {}): number {
  if (!tokens.length) return 0
  const hay = haystack.toLowerCase()
  const words = hay.split(/[^a-z0-9]+/).filter(Boolean)
  const abbr = opts.abbr?.toLowerCase()
  let total = 0
  for (const tok of tokens) {
    let s = 0
    if (hay === tok) s = 100
    else if (abbr && abbr === tok) s = 95
    else if (words.includes(tok)) s = 85
    else if (words.some((w) => w.startsWith(tok))) s = 80
    else if (hay.includes(tok)) s = 40
    else return 0
    total += s
  }
  return total / tokens.length
}

// Recency boost for game results: live now beats upcoming beats past, and a
// game this weekend beats one in October. `nowIso` is injected for testability.
// Upcoming boost starts at +15 and fades to 0 over ~60 days; past games get 0.
export function gameBoost(state: string, dateIso: string, nowIso: string): number {
  if (state === 'in') return 30
  const t = Date.parse(dateIso)
  const now = Date.parse(nowIso)
  if (Number.isNaN(t) || Number.isNaN(now)) return 0
  if (t < now) return 0
  const days = (t - now) / 86_400_000
  return Math.max(0, 15 - days * 0.25)
}
