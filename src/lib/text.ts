// Small text helpers shared by the content routes (game / venue / build / agenda),
// which each used to carry their own copy of these (and had started to drift).

// Uppercase the first letter when it's lowercase (leave already-capped / emoji alone).
export const cap = (s = '') => (/^[a-z]/.test(s) ? s[0].toUpperCase() + s.slice(1) : s)

// Split prose into sentences (kept as bullet candidates). Tolerant of non-strings.
export const splitSentences = (t: unknown): string[] =>
  String(t ?? '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)

// First sentence only, with any trailing period trimmed.
export const firstSentence = (t?: string): string =>
  t ? (splitSentences(t)[0] ?? '').replace(/\.$/, '') : ''
