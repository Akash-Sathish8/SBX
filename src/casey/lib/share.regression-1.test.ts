// @vitest-environment jsdom
// Regression: ISSUE-001 / ISSUE-011 — share URLs pointed at routes from the
// standalone tracker app (/match/N and the site root) instead of the routes
// this app actually registers (/casey/match/N and /casey).
// Found by /qa on 2026-06-11
// Report: .gstack/qa-reports/qa-report-localhost-2026-06-11.md
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { shareMatch, shareTracker } from './share'

describe('share URLs target registered routes', () => {
  let copied: string[]

  beforeEach(() => {
    copied = []
    // No Web Share API → functions fall back to clipboard, capturing the URL.
    vi.stubGlobal('navigator', {
      clipboard: { writeText: async (s: string) => { copied.push(s) } },
    })
  })

  it('shareMatch links to /casey/match/N (not the nonexistent /match/N)', async () => {
    const result = await shareMatch({ matchNumber: 7, matchName: 'NED v JPN', stadium: 'AT&T Stadium' })
    expect(result).toBe('copied')
    expect(copied[0]).toBe(`${window.location.origin}/casey/match/7`)
  })

  it('shareTracker links to /casey (not the marketing home)', async () => {
    const result = await shareTracker()
    expect(result).toBe('copied')
    expect(copied[0]).toBe(`${window.location.origin}/casey`)
  })
})
