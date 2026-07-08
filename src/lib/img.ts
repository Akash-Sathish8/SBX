// ESPN venue photos are large; route them through a resizing/caching image proxy
// (wsrv.nl, Cloudflare-backed) for fast loads. Wikipedia images are already stored
// as ~640px thumbnails (the proxy can't fetch Wikimedia), so they pass through.
// Callers must keep a non-photo fallback (team-logo grid) — the proxy is a third
// party and can fail.
export const cardImg = (url?: string): string | undefined =>
  !url ? undefined
    : url.includes('a.espncdn.com') ? 'https://wsrv.nl/?url=' + encodeURIComponent(url) + '&w=720&output=webp&q=78'
      : url
