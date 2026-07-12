// Better Auth browser client. Same-origin (/api/auth/*), so no baseURL needed.
// The username plugin adds signUp.email({ username }) support and puts
// username/displayUsername on the session user.
import { createAuthClient } from 'better-auth/react'
import { usernameClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  plugins: [usernameClient()],
})
