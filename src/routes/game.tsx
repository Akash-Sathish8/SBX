import { createFileRoute, redirect } from '@tanstack/react-router'

// Legacy redirect: the match detail moved from /game?id=X to the canonical,
// SEO-friendly path /game/$id. Preserves any old or shared query-param links.
export const Route = createFileRoute('/game')({
  validateSearch: (s: Record<string, unknown>) => ({ id: typeof s.id === 'string' ? s.id : '' }),
  beforeLoad: ({ search }) => {
    if (search.id) {
      throw redirect({ to: '/game/$id', params: { id: search.id }, replace: true })
    }
    throw redirect({ to: '/games', replace: true })
  },
})
