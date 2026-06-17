// Live daily weather from Open-Meteo (free, no key, CORS-enabled → fetched
// client-side). Shared by the venue page (multi-day strip) and the build wizard
// (single matchday). Both fall back to last year's archive for dates beyond the
// ~16-day forecast window. Each request has a hard timeout so a hung Open-Meteo
// call can't leave the weather query pending forever.

export interface WeatherDay {
  date: string
  tmax: number
  tmin: number
  code: number
  pop: number | null
  src: 'forecast' | 'normal'
}

// WMO weather-code → short label (used for the build-wizard card text).
export const WMO_LABEL: Record<number, string> = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Fog',
  51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  80: 'Showers', 81: 'Showers', 82: 'Showers', 95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm',
}

const isoAddDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const shiftYear = (iso: string, y: number) => String(Number(iso.slice(0, 4)) + y) + iso.slice(4)

async function getJson(url: string, timeoutMs = 8000): Promise<any | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const r = await fetch(url, { signal: ctrl.signal })
    return r.ok ? await r.json() : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// Venue page: per-day forecast (Fahrenheit) through `last`, archive-filled beyond
// the ~16-day forecast horizon (labelled "typical" via src: 'normal').
export async function fetchVenueWeather(lat: number, lon: number, last: string): Promise<WeatherDay[]> {
  const today = new Date().toISOString().slice(0, 10)
  if (!lat || !lon || !last || last < today) return []
  const fcEnd = last < isoAddDays(today, 15) ? last : isoAddDays(today, 15)
  const days: WeatherDay[] = []

  const fc = await getJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=fahrenheit&timezone=auto&forecast_days=16`,
  )
  const ft: string[] = fc?.daily?.time ?? []
  for (let i = 0; i < ft.length; i++) {
    if (ft[i] >= today && ft[i] <= fcEnd) {
      days.push({
        date: ft[i],
        tmax: Math.round(fc.daily.temperature_2m_max[i]),
        tmin: Math.round(fc.daily.temperature_2m_min[i]),
        code: fc.daily.weather_code[i],
        pop: fc.daily.precipitation_probability_max[i],
        src: 'forecast',
      })
    }
  }

  if (last > fcEnd) {
    const aStart = shiftYear(isoAddDays(fcEnd, 1), -1)
    const aEnd = shiftYear(last, -1)
    const ar = await getJson(
      `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${aStart}&end_date=${aEnd}&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=auto`,
    )
    const at: string[] = ar?.daily?.time ?? []
    for (let i = 0; i < at.length; i++) {
      days.push({
        date: shiftYear(at[i], 1),
        tmax: Math.round(ar.daily.temperature_2m_max[i]),
        tmin: Math.round(ar.daily.temperature_2m_min[i]),
        code: ar.daily.weather_code[i],
        pop: null,
        src: 'normal',
      })
    }
  }
  days.sort((a, b) => (a.date < b.date ? -1 : 1))
  return days
}

// Build wizard: a single matchday temp + label (Celsius/Fahrenheit string),
// archive-filled (last year) when the date is beyond the forecast window.
export async function fetchMatchWeather(
  coords: [number, number] | undefined,
  dateISO: string,
): Promise<{ temp: string; label: string } | null> {
  if (!coords || !dateISO) return null
  const [lat, lon] = coords
  const fmt = (c: number) => Math.round(c) + '°C / ' + Math.round((c * 9) / 5 + 32) + '°F'

  const fc = await getJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max&temperature_unit=celsius&timezone=auto&start_date=${dateISO}&end_date=${dateISO}`,
  )
  if (fc?.daily?.time?.length && fc.daily.temperature_2m_max[0] != null) {
    return { temp: fmt(fc.daily.temperature_2m_max[0]), label: WMO_LABEL[fc.daily.weathercode[0]] || 'Mild' }
  }
  const lastYr = '2025' + dateISO.slice(4)
  const ar = await getJson(
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max&temperature_unit=celsius&timezone=auto&start_date=${lastYr}&end_date=${lastYr}`,
  )
  if (ar?.daily?.temperature_2m_max?.[0] != null) {
    return { temp: fmt(ar.daily.temperature_2m_max[0]), label: (WMO_LABEL[ar.daily.weathercode[0]] || 'Mild') + ' (typical)' }
  }
  return null
}
