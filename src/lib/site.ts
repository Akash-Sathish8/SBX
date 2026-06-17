// Absolute-URL helper for SEO/social tags. Social crawlers (Facebook, X,
// iMessage) require ABSOLUTE og:image / canonical URLs, so this defaults to the
// production host. Override with a `VITE_SITE_URL` build env only if the domain
// ever changes — no env file is required for the normal deploy.
export const SITE_URL = ((import.meta.env.VITE_SITE_URL as string | undefined) ?? 'https://sbx.snapbacksports.com').replace(/\/$/, '')

export function absUrl(path: string): string {
  if (!path) return SITE_URL
  return SITE_URL ? SITE_URL + (path.startsWith('/') ? path : '/' + path) : path
}

// The full title + OpenGraph + Twitter meta set for a page's `head()`. One place
// to keep the social-tag shape consistent across every SEO route (game, venue,
// home) — add a tag here once instead of in each route.
export function socialMeta(opts: {
  title: string
  description: string
  image: string
  type?: 'website' | 'article'
}) {
  const { title, description, image, type = 'website' } = opts
  return [
    { title },
    { name: 'description', content: description },
    { property: 'og:type', content: type },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:image', content: image },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: image },
  ]
}
