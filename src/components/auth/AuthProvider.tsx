import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { AuthModal } from './AuthModal'

// App-wide auth state. Mounted once in __root so every route (home "Sign in",
// the /rank save flow, nav) can read the user and open the auth modal. Sessions
// live in an httpOnly cookie; this only mirrors the user identity client-side.
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

// Load Google Identity Services once, lazily (only when a user clicks Google).
let gisPromise: Promise<void> | null = null
function loadGoogleScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if ((window as any).google?.accounts?.oauth2) return Promise.resolve()
  if (gisPromise) return gisPromise
  gisPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => { gisPromise = null; reject(new Error('Failed to load Google')) }
    document.head.appendChild(s)
  })
  return gisPromise
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<AuthMode>('signin')
  const [googleClientId, setGoogleClientId] = useState<string | null>(null)

  // Who's signed in? (cookie -> /api/auth/me). null is the normal signed-out state.
  // Also pull the public client config (Google client id) to enable that button.
  useEffect(() => {
    let alive = true
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((j) => { if (alive) setUser(j?.user ?? null) })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    fetch('/api/auth/config')
      .then((r) => r.json())
      .then((j) => { if (alive) setGoogleClientId(j?.googleClientId ?? null) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const submit = useCallback(async (path: string, body: Record<string, string>): Promise<Result> => {
    try {
      const r = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await r.json().catch(() => ({}))
      if (r.ok && j?.ok && j.user) { setUser(j.user); return { ok: true } }
      return { ok: false, error: j?.error || 'Something went wrong. Try again.' }
    } catch {
      return { ok: false, error: 'Network error. Try again.' }
    }
  }, [])

  const login = useCallback((email: string, password: string) => submit('/api/auth/login', { email, password }), [submit])
  const register = useCallback((email: string, password: string, username: string) => submit('/api/auth/register', { email, username, password }), [submit])
  const logout = useCallback(async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }) } catch { /* clear locally regardless */ }
    setUser(null)
  }, [])

  // Google: open the GIS token popup, then exchange the token for our session.
  const loginWithGoogle = useCallback(async (): Promise<Result> => {
    if (!googleClientId) return { ok: false, error: 'Google sign-in isn’t set up yet.' }
    try {
      await loadGoogleScript()
      const accessToken = await new Promise<string>((resolve, reject) => {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: googleClientId,
          scope: 'openid email profile',
          callback: (resp: any) => (resp?.access_token ? resolve(resp.access_token) : reject(new Error('cancelled'))),
          error_callback: (err: any) => reject(new Error(err?.type === 'popup_closed' ? 'cancelled' : 'popup_error')),
        })
        client.requestAccessToken()
      })
      const r = await fetch('/api/auth/google', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ accessToken }),
      })
      const j = await r.json().catch(() => ({}))
      if (r.ok && j?.ok && j.user) { setUser(j.user); return { ok: true } }
      return { ok: false, error: j?.error || 'Google sign-in failed.' }
    } catch (e: any) {
      const m = e?.message
      if (m === 'cancelled') return { ok: false, error: '' } // user closed the popup — no error
      if (m === 'popup_error') return { ok: false, error: 'Couldn’t open Google sign-in. Make sure http://localhost:3001 is an authorized origin and pop-ups aren’t blocked.' }
      return { ok: false, error: 'Google sign-in failed.' }
    }
  }, [googleClientId])

  const openAuth = useCallback((m: AuthMode = 'signin') => { setMode(m); setOpen(true) }, [])
  const closeAuth = useCallback(() => setOpen(false), [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, logout, loginWithGoogle, googleEnabled: !!googleClientId, openAuth, closeAuth }),
    [user, loading, login, register, logout, loginWithGoogle, googleClientId, openAuth, closeAuth],
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
