// Make route navigation feel instant: warm the data + images a page needs
// BEFORE the user clicks. The shared static JSON (games index, fan intel) is
// fetched once and shared by every interior route instead of being re-fetched
// per mount, and a destination's per-item JSON + stadium photo are warmed the
// moment the user hovers/presses the card that links to it. Mirrors the
// dedupe-by-key idiom already used by useMatchScores.

const jsonCache = new Map<string, Promise<any>>()

// Memoised JSON fetch: one in-flight/resolved promise per URL, shared across
// every route and every intent-warm caller. A failed fetch is evicted so a
// later call can retry instead of caching the rejection forever.
export function getJSON<T = any>(url: string): Promise<T> {
  let p = jsonCache.get(url)
  if (!p) {
    p = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`fetch ${url} -> ${r.status}`)
        return r.json()
      })
      .catch((e) => {
        jsonCache.delete(url)
        throw e
      })
    jsonCache.set(url, p)
  }
  return p as Promise<T>
}

// Force a fresh network fetch, bypassing the session-forever memo, and refresh
// the cached entry so later getJSON callers see the newer data too. Use for
// LIVE data (e.g. /api/games) that must not be pinned to the first snapshot —
// e.g. the home page's periodic refresh. (Leave /api/venues on getJSON.)
export function getJSONFresh<T = any>(url: string): Promise<T> {
  const p = fetch(url).then((r) => {
    if (!r.ok) throw new Error(`fetch ${url} -> ${r.status}`)
    return r.json()
  })
  jsonCache.set(url, p)
  // Evict on failure so a stale/failed promise isn't pinned for getJSON callers.
  p.catch(() => { if (jsonCache.get(url) === p) jsonCache.delete(url) })
  return p as Promise<T>
}

const warmedImgs = new Set<string>()

// Warm an image into the browser HTTP cache without rendering it, so the
// destination page paints it instantly. Client-only; deduped.
export function warmImage(src: string): void {
  if (!src || typeof window === 'undefined' || warmedImgs.has(src)) return
  warmedImgs.add(src)
  const img = new Image()
  img.decoding = 'async'
  img.src = src
}

// The stadium hero photo + per-item JSON that /venue (and the build wizard's
// venue tab) block on. For all 16 venues the id IS the stadium filename.
export function warmVenue(id: string): void {
  if (!id) return
  warmImage(`/img/stadiums/${id}.jpg`)
  getJSON(`/data/venues/${id}.json`).catch(() => {})
}

// A game's detail JSON (only some fixtures have one; gated by hasDetail).
export function warmGame(id: string, hasDetail?: boolean): void {
  if (id && hasDetail) getJSON(`/data/games/${id}.json`).catch(() => {})
}

// Shared JSON every interior route needs + the logo reused on every page and in
// the share-card export. Call once on the client at startup.
export function prewarmShared(): void {
  if (typeof window === 'undefined') return
  getJSON('/data/games/index.json').catch(() => {})
  getJSON('/data/fanintel.json').catch(() => {})
  warmImage('/img/logo.png')
}

// Spread onto a <Link>/card to warm its destination on hover (desktop),
// press (the ~100ms before a tap commits), or keyboard focus.
export function intentWarm(fn: () => void) {
  return { onPointerEnter: fn, onPointerDown: fn, onFocus: fn }
}
