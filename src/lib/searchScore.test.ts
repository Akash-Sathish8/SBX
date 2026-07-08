import { describe, it, expect } from 'vitest'
import { tokenize, escapeLike, scoreMatch, gameBoost } from './searchScore'

describe('tokenize', () => {
  it('lowercases and splits on whitespace', () => {
    expect(tokenize('  Chicago  Cubs ')).toEqual(['chicago', 'cubs'])
  })
  it('returns [] for blank input', () => {
    expect(tokenize('   ')).toEqual([])
  })
})

describe('escapeLike', () => {
  it('escapes %, _ and backslash', () => {
    expect(escapeLike('100%_a\\b')).toBe('100\\%\\_a\\\\b')
  })
  it('leaves plain text alone', () => {
    expect(escapeLike('wrigley')).toBe('wrigley')
  })
})

describe('scoreMatch', () => {
  const HAY = 'Philadelphia Eagles'

  it('exact haystack beats everything', () => {
    expect(scoreMatch('phi', ['phi'], { abbr: 'PHI' })).toBe(100)
  })
  it('exact abbr beats word prefix', () => {
    const abbr = scoreMatch(HAY, ['phi'], { abbr: 'PHI' })
    const prefix = scoreMatch(HAY, ['phi'])
    expect(abbr).toBe(95)
    expect(prefix).toBe(80)
  })
  it('whole word beats prefix beats mid-word', () => {
    const word = scoreMatch(HAY, ['eagles'])
    const prefix = scoreMatch(HAY, ['eagl'])
    const mid = scoreMatch(HAY, ['agles'])
    expect(word).toBe(85)
    expect(prefix).toBe(80)
    expect(mid).toBe(40)
    expect(word).toBeGreaterThan(prefix)
    expect(prefix).toBeGreaterThan(mid)
  })
  it('mid-word partials match ("rigley" → Wrigley Field)', () => {
    expect(scoreMatch('Wrigley Field', ['rigley'])).toBe(40)
  })
  it('every token must land — one miss fails the match', () => {
    expect(scoreMatch(HAY, ['philadelphia', 'cubs'])).toBe(0)
  })
  it('multi-word queries average per-token scores', () => {
    // 'chicago' whole word (85) + 'cub' prefix (80) → 82.5
    expect(scoreMatch('Chicago Cubs', ['chicago', 'cub'])).toBe(82.5)
  })
  it('splits words on punctuation', () => {
    expect(scoreMatch('T-Mobile Park', ['mobile'])).toBe(85)
  })
  it('empty token list scores 0', () => {
    expect(scoreMatch(HAY, [])).toBe(0)
  })
})

describe('gameBoost', () => {
  const NOW = '2026-07-06T12:00:00.000Z'

  it('live games get the top boost', () => {
    expect(gameBoost('in', '2026-07-06T11:00Z', NOW)).toBe(30)
  })
  it('near upcoming beats far upcoming', () => {
    const near = gameBoost('pre', '2026-07-08T00:00Z', NOW)
    const far = gameBoost('pre', '2026-08-30T00:00Z', NOW)
    expect(near).toBeGreaterThan(far)
    expect(near).toBeLessThanOrEqual(15)
  })
  it('past games get no boost', () => {
    expect(gameBoost('post', '2026-07-01T00:00Z', NOW)).toBe(0)
  })
  it('boost floors at zero far in the future', () => {
    expect(gameBoost('pre', '2027-07-06T00:00Z', NOW)).toBe(0)
  })
  it('unparseable dates get no boost', () => {
    expect(gameBoost('pre', 'not-a-date', NOW)).toBe(0)
  })
})
