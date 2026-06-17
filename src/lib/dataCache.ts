// Make navigation feel instant by warming a destination's stadium photo into the
// browser cache the moment the user hovers/presses the card that links to it.
// (Per-item JSON is prefetched through TanStack Query — queryClient.prefetchQuery
// at the call sites — so it warms the Query cache the page actually reads from,
// rather than a parallel hand-rolled cache.)

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

// The logo reused on every page and in the share-card export. Call once on the
// client at startup. (index.json + fanintel.json are bundled into the routes
// that use them, so there's nothing else to prewarm-fetch.)
export function prewarmShared(): void {
  if (typeof window === 'undefined') return
  warmImage('/img/logo.png')
}

// Spread onto a <Link>/card to warm its destination on hover (desktop), press
// (the ~100ms before a tap commits), or keyboard focus.
export function intentWarm(fn: () => void) {
  return { onPointerEnter: fn, onPointerDown: fn, onFocus: fn }
}
