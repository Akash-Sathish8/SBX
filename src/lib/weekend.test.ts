import { describe, it, expect } from 'vitest'
import { weekendWindow, toStoredUtc, localDayKey } from './weekend'

const STORED = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/

describe('weekendWindow', () => {
  it('mid-week points at the upcoming Fri–Sun', () => {
    // Mon Jul 6 2026 (local) → Fri Jul 10 … Sun Jul 12
    const w = weekendWindow(new Date(2026, 6, 6, 12, 0))
    expect(w.days[0].getDay()).toBe(5)
    expect(w.days[0].getDate()).toBe(10)
    expect(w.days[2].getDay()).toBe(0)
    expect(w.days[2].getDate()).toBe(12)
  })
  it('Friday starts the current weekend', () => {
    const w = weekendWindow(new Date(2026, 6, 10, 9, 0))
    expect(w.days[0].getDate()).toBe(10)
  })
  it('Saturday and Sunday stay inside the current weekend', () => {
    expect(weekendWindow(new Date(2026, 6, 11)).days[0].getDate()).toBe(10)
    expect(weekendWindow(new Date(2026, 6, 12)).days[0].getDate()).toBe(10)
  })
  it('bounds use the stored game-date format and span Fri 00:00 → Sun 23:59', () => {
    const w = weekendWindow(new Date(2026, 6, 6))
    expect(w.from).toMatch(STORED)
    expect(w.to).toMatch(STORED)
    const span = Date.parse(w.to) - Date.parse(w.from)
    expect(span).toBe(3 * 86_400_000 - 60_000)
  })
  it('crosses month boundaries', () => {
    // Thu Jul 30 2026 → Fri Jul 31 … Sun Aug 2
    const w = weekendWindow(new Date(2026, 6, 30))
    expect(w.days[0].getDate()).toBe(31)
    expect(w.days[2].getMonth()).toBe(7)
    expect(w.days[2].getDate()).toBe(2)
  })
})

describe('toStoredUtc', () => {
  it('formats minute-precision UTC with literal Z', () => {
    expect(toStoredUtc(new Date(Date.UTC(2026, 6, 10, 4, 0)))).toBe('2026-07-10T04:00Z')
  })
})

describe('localDayKey', () => {
  it('same local day → same key, next day → different', () => {
    expect(localDayKey(new Date(2026, 6, 10, 0, 1))).toBe(localDayKey(new Date(2026, 6, 10, 23, 59)))
    expect(localDayKey(new Date(2026, 6, 10))).not.toBe(localDayKey(new Date(2026, 6, 11)))
  })
})
