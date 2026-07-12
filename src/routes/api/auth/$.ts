import { createFileRoute } from '@tanstack/react-router'
import { getAuth } from '../../../server/better-auth'

// Catch-all mount for Better Auth. Everything under /api/auth/* — sign-up,
// sign-in (email/username/social), sign-out, get-session, the Google OAuth
// callback — is handled by the library. /api/auth/config stays a static
// sibling route (static segments outrank the splat).
export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: async ({ request }) => getAuth().handler(request),
      POST: async ({ request }) => getAuth().handler(request),
    },
  },
})
