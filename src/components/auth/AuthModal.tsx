import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AuthMode } from './AuthProvider'

interface Props {
  open: boolean
  mode: AuthMode
  onMode: (m: AuthMode) => void
  onClose: () => void
  onLogin: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  onRegister: (email: string, password: string, username: string) => Promise<{ ok: boolean; error?: string }>
  onGoogle: () => Promise<{ ok: boolean; error?: string }>
}

// Sign-in / register sheet matching the brand mock: dark rounded sheet, email +
// password, yellow CTA, mode-toggle + Forgot links, OR divider, Apple button.
// Apple + Forgot are intentional "coming soon" no-ops (see note below).
export function AuthModal({ open, mode, onMode, onClose, onLogin, onRegister, onGoogle }: Props) {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const usernameRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (open) { setError(null); setNote(null); setBusy(false) } }, [open, mode])
  useEffect(() => {
    if (!open) return
    // Register starts on username (the first field); sign-in starts on email.
    const t = setTimeout(() => (mode === 'register' ? usernameRef : emailRef).current?.focus(), 60)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey) }
  }, [open, mode, onClose])
  useEffect(() => {
    if (!open || typeof document === 'undefined') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open || typeof document === 'undefined') return null
  const isRegister = mode === 'register'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError(null); setNote(null); setBusy(true)
    const res = isRegister
      ? await onRegister(email.trim(), password, username.trim())
      : await onLogin(email.trim(), password)
    setBusy(false)
    if (res.ok) { setEmail(''); setUsername(''); setPassword(''); onClose() }
    else setError(res.error || 'Something went wrong.')
  }
  const comingSoon = (what: string) => { setError(null); setNote(`${what} is coming soon.`) }
  const doGoogle = async () => {
    if (busy) return
    setError(null); setNote(null); setBusy(true)
    const res = await onGoogle()
    setBusy(false)
    if (res.ok) onClose()
    else if (res.error) setError(res.error) // empty error = user cancelled the popup
  }

  return createPortal(
    <div className="sbx-auth" role="dialog" aria-modal="true" aria-label={isRegister ? 'Create account' : 'Sign in'}>
      <div className="sbx-auth-backdrop" onClick={onClose} />
      <div className="sbx-auth-sheet">
        <button className="sbx-auth-x" aria-label="Close" onClick={onClose}>×</button>
        <div className="sbx-auth-head">
          <img className="sbx-auth-logo" src="/img/logo.png" alt="" width={34} height={34} />
          <h2 className="sbx-auth-h">{isRegister ? 'Create account' : 'Sign in'}</h2>
        </div>
        <form className="sbx-auth-form" onSubmit={submit}>
          {isRegister ? (
            <input
              ref={usernameRef} className="sbx-auth-input" type="text" autoComplete="username" maxLength={20}
              placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)}
            />
          ) : null}
          <input
            ref={emailRef} className="sbx-auth-input" type="email" autoComplete="email"
            placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="sbx-auth-input" type="password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
          />
          {error ? <div className="sbx-auth-err">{error}</div> : null}
          {note ? <div className="sbx-auth-note">{note}</div> : null}
          <button className="sbx-auth-submit" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
          </button>
        </form>
        <button className="sbx-auth-link" onClick={() => onMode(isRegister ? 'signin' : 'register')}>
          {isRegister ? 'Have an account? Sign in' : 'Need an account? Register'}
        </button>
        {!isRegister ? (
          <button className="sbx-auth-link" onClick={() => comingSoon('Password reset')}>Forgot Password?</button>
        ) : null}
        <div className="sbx-auth-or"><span>OR</span></div>
        <button className="sbx-auth-google" type="button" disabled={busy} onClick={doGoogle}>
          <svg viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          Continue with Google
        </button>
      </div>
    </div>,
    document.body,
  )
}
