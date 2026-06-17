import { createFileRoute, redirect } from '@tanstack/react-router'

// Legacy redirect: the venue detail moved from /venue?id=X to the canonical,
// SEO-friendly path /venue/$id. Preserves any old or shared query-param links.
export const Route = createFileRoute('/venue')({
  validateSearch: (s: Record<string, unknown>) => ({ id: typeof s.id === 'string' ? s.id : '' }),
  beforeLoad: ({ search }) => {
    if (search.id) {
      throw redirect({ to: '/venue/$id', params: { id: search.id }, replace: true })
    }
    throw redirect({ to: '/venues', replace: true })
  },
})
