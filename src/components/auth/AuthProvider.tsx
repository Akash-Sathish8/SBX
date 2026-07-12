import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { AuthModal } from './AuthModal'

// App-wide auth state. Mounted once in __root so every route (home "Sign in",
// the /rank save flow, nav) can read the user and open the auth modal. Sessions
// live in an httpOnly cookie owned by Better Auth; authClient.useSession()
// mirrors the identity client-side. `username` is the case-preserved handle.
export interface AuthUser { id: string; email: string; username?: string | null }
export type AuthMode = 'signin' | 'register'
type Result = { ok: boolean; error?: string }

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<Result>
  register: (email: string, password: string, username: string) => Promise<Result>
  logout: () => Promise<void>
  loginWithGoogle: () => Promise<Result>
  googleEnabled: boolean
  openAuth: (mode?: AuthMode) => void
  closeAuth: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}

// Friendly copy for the Better Auth error codes our flows can hit; anything
// unmapped falls back to the server message.
const ERROR_COPY: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'Invalid email or password.',
  INVALID_EMAIL: 'Enter a valid email.',
  USER_ALREADY_EXISTS: 'That email is already registered.',
  USERNAME_IS_ALREADY_TAKEN_PLEASE_TRY_ANOTHER: 'That username is taken. Pick another.',
  USERNAME_IS_ALREADY_TAKEN: 'That username is taken. Pick another.',
  INVALID_USERNAME: 'Username must be 3-20 letters, numbers, or underscores.',
  USERNAME_TOO_SHORT: 'Username must be at least 3 characters.',
  USERNAME_TOO_LONG: 'Username must be 20 characters or fewer.',
  PASSWORD_TOO_SHORT: 'Password must be at least 8 characters.',
  PASSWORD_TOO_LONG: 'Password must be 200 characters or fewer.',
}
function friendlyError(error: { code?: string; message?: string } | null, fallback: string): string {
  if (!error) return fallback
  return (error.code && ERROR_COPY[error.code]) || error.message || fallback
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<AuthMode>('signin')
  const [googleEnabled, setGoogleEnabled] = useState(false)

  const user = useMemo<AuthUser | null>(() => {
    const u = session?.user as (AuthUser & { displayUsername?: string | null }) | undefined
    if (!u) return null
    return { id: u.id, email: u.email, username: u.displayUsername ?? u.username ?? null }
  }, [session])

  // Public client config: is the Google button live on this deployment?
  useEffect(() => {
    let alive = true
    fetch('/api/auth/config')
      .then((r) => r.json())
      .then((j) => { if (alive) setGoogleEnabled(!!j?.googleEnabled) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<Result> => {
    try {
      const { error } = await authClient.signIn.email({ email: email.trim(), password })
      if (error) return { ok: false, error: friendlyError(error, 'Invalid email or password.') }
      return { ok: true }
    } catch {
      return { ok: false, error: 'Network error. Try again.' }
    }
  }, [])

  const register = useCallback(async (email: string, password: string, username: string): Promise<Result> => {
    try {
      const handle = username.trim()
      const { error } = await authClient.signUp.email({
        email: email.trim(),
        password,
        username: handle,
        // Better Auth requires a display name; the handle doubles as the
        // initial one (editable later on the profile page).
        name: handle,
      })
      if (error) return { ok: false, error: friendlyError(error, 'Could not create account.') }
      return { ok: true }
    } catch {
      return { ok: false, error: 'Network error. Try again.' }
    }
  }, [])

  const logout = useCallback(async () => {
    try { await authClient.signOut() } catch { /* session hook clears regardless */ }
  }, [])

  // Google: Better Auth's redirect flow — the page navigates away to Google
  // and comes back signed in via /api/auth/callback/google.
  const loginWithGoogle = useCallback(async (): Promise<Result> => {
    if (!googleEnabled) return { ok: false, error: 'Google sign-in isn’t set up yet.' }
    try {
      const { error } = await authClient.signIn.social({
        provider: 'google',
        callbackURL: typeof window === 'undefined' ? '/' : window.location.pathname,
      })
      if (error) return { ok: false, error: friendlyError(error, 'Google sign-in failed.') }
      return { ok: true } // redirecting — nothing else to do here
    } catch {
      return { ok: false, error: 'Google sign-in failed.' }
    }
  }, [googleEnabled])

  const openAuth = useCallback((m: AuthMode = 'signin') => { setMode(m); setOpen(true) }, [])
  const closeAuth = useCallback(() => setOpen(false), [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading: isPending, login, register, logout, loginWithGoogle, googleEnabled, openAuth, closeAuth }),
    [user, isPending, login, register, logout, loginWithGoogle, googleEnabled, openAuth, closeAuth],
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthModal
        open={open} mode={mode} onMode={setMode} onClose={closeAuth}
        onLogin={login} onRegister={register} onGoogle={loginWithGoogle}
      />
    </AuthContext.Provider>
  )
}
