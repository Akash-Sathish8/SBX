// "This weekend" window math. The weekend is Fri 00:00 → Sun 23:59 in the
// user's local timezone — the Fri–Sun span containing `now`, or the next
// upcoming one when today is Mon–Thu. Bounds are formatted to the stored game
// date format (YYYY-MM-DDTHH:MMZ — minute-precision UTC with a literal Z) so
// dbGames' lexicographic string comparison stays correct. `now` is injected
// for testability.

export interface WeekendWindow {
  from: string // stored-format UTC lower bound (Fri 00:00 local)
  to: string // stored-format UTC upper bound (Sun 23:59 local)
  days: [Date, Date, Date] // local Fri/Sat/Sun midnights, for section headers
}

export function toStoredUtc(d: Date): string {
  return d.toISOString().slice(0, 16) + 'Z'
}

export function weekendWindow(now: Date): WeekendWindow {
  const day = now.getDay() // 0 Sun … 6 Sat
  // Fri/Sat/Sun → back up to this window's Friday; Mon–Thu → the next Friday.
  const offset = day === 5 ? 0 : day === 6 ? -1 : day === 0 ? -2 : 5 - day
  const fri = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
  const days: [Date, Date, Date] = [0, 1, 2].map(
    (i) => new Date(fri.getFullYear(), fri.getMonth(), fri.getDate() + i),
  ) as [Date, Date, Date]
  const end = new Date(fri.getFullYear(), fri.getMonth(), fri.getDate() + 2, 23, 59)
  return { from: toStoredUtc(fri), to: toStoredUtc(end), days }
}

// Local calendar-day key — groups games under their FRI/SAT/SUN header by the
// day they happen in the user's timezone, not UTC.
export const localDayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
