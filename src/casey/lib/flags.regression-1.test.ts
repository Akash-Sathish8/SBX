// Regression: ISSUE-017 — ESPN-fed standings/bracket rows rendered a '·'
// placeholder for real 2026 teams missing from TEAM_TO_CODE/ALIASES.
// Found by /qa on 2026-06-11
// Report: .gstack/qa-reports/qa-report-localhost-2026-06-11.md
import { describe, expect, it } from 'vitest'
import { flagCodeForTeam } from './flags'

describe('flagCodeForTeam covers ESPN display names for the 2026 field', () => {
  it.each([
    ['Czech Republic', 'cz'],
    ['Czechia', 'cz'],
    ['Bosnia & Herzegovina', 'ba'],
    ['Bosnia and Herzegovina', 'ba'],
    ['Turkey', 'tr'],
    ['Türkiye', 'tr'],
    ['Jordan', 'jo'],
    ['Panama', 'pa'],
    ['DR Congo', 'cd'],
    ['Democratic Republic of the Congo', 'cd'],
    ['Uzbekistan', 'uz'],
  ])('%s → %s', (team, code) => {
    expect(flagCodeForTeam(team)).toBe(code)
  })

  it('still returns null only for TBD/unknown', () => {
    expect(flagCodeForTeam('TBD')).toBeNull()
    expect(flagCodeForTeam('Atlantis')).toBeNull()
  })
})
