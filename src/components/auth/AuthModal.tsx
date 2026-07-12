import { useEffect, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
// password, yellow CTA, mode-toggle + Forgot links, OR divider, Google button.
// Built on shadcn Dialog (portal, backdrop, esc, focus trap, scroll lock) —
// bottom sheet on phones, centered card from sm: up. Forgot-password is an
// intentional "coming soon" no-op.
const inputDark =
  'h-auto rounded-[14px] border-[1.5px] border-[#3a3a3c] bg-[#2a2a2c] px-[18px] py-4 text-base font-semibold text-white placeholder:font-medium placeholder:text-[#8a8a8e] focus-visible:border-brand focus-visible:ring-0'

export function AuthModal({ open, mode, onMode, onClose, onLogin, onRegister, onGoogle }: Props) {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => { if (open) { setError(null); setNote(null); setBusy(false) } }, [open, mode])

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
    else if (res.error) setError(res.error)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent
        overlayClassName="bg-black/60 backdrop-blur-[2px]"
        className="top-auto bottom-0 left-[50%] w-full max-w-[480px] translate-x-[-50%] translate-y-0 gap-0 rounded-[22px] rounded-b-none border-0 bg-[#1d1d1f] px-[26px] pt-[30px] pb-[calc(30px+env(safe-area-inset-bottom))] text-white shadow-[0_-10px_40px_rgba(0,0,0,.5)] max-h-[94dvh] overflow-y-auto sm:top-[50%] sm:bottom-auto sm:translate-y-[-50%] sm:rounded-[22px] sm:pb-[30px] sm:max-w-[480px] sm:max-h-[calc(100dvh-40px)]"
        aria-label={isRegister ? 'Create account' : 'Sign in'}
      >
        <DialogHeader className="mb-[22px] flex-row items-center justify-center gap-3 space-y-0 text-center">
          <img className="h-[34px] w-[34px] rounded-lg shadow-punch" src="/img/logo.png" alt="" width={34} height={34} />
          <DialogTitle className="font-display text-[30px] font-normal uppercase tracking-[1px] text-white">
            {isRegister ? 'Create account' : 'Sign in'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isRegister ? 'Create a Snapback account with a username, email, and password.' : 'Sign in to Snapback with your email and password.'}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-3.5" onSubmit={submit}>
          {isRegister ? (
            <div>
              <Label htmlFor="auth-username" className="sr-only">Username</Label>
              <Input
                id="auth-username" className={inputDark} type="text" autoComplete="username" maxLength={20}
                placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          ) : null}
          <div>
            <Label htmlFor="auth-email" className="sr-only">Email</Label>
            <Input
              id="auth-email" className={inputDark} type="email" autoComplete="email"
              placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="auth-password" className="sr-only">Password</Label>
            <Input
              id="auth-password" className={inputDark} type="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? (
            <Alert variant="destructive" className="border-[#7a2a2a] bg-[#3a1d1d] text-[#ffb4b4]">
              <AlertDescription className="justify-center text-center font-semibold text-[#ffb4b4]">{error}</AlertDescription>
            </Alert>
          ) : null}
          {note ? <p className="text-center text-sm font-semibold text-[#d8d29a]">{note}</p> : null}
          <Button type="submit" variant="brand" disabled={busy} className="mt-1.5 h-auto w-full rounded-[14px] py-[17px] text-base">
            {busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
          </Button>
        </form>

        <Button
          type="button" variant="link"
          className="h-auto w-full pt-3 pb-0.5 text-[15px] font-bold text-brand"
          onClick={() => onMode(isRegister ? 'signin' : 'register')}
        >
          {isRegister ? 'Have an account? Sign in' : 'Need an account? Register'}
        </Button>
        {!isRegister ? (
          <Button
            type="button" variant="link"
            className="h-auto w-full pt-3 pb-0.5 text-[15px] font-bold text-brand"
            onClick={() => comingSoon('Password reset')}
          >
            Forgot Password?
          </Button>
        ) : null}

        <div className="my-3 flex items-center gap-3 text-xs font-extrabold tracking-[1px] text-[#8a8a8e]">
          <span className="h-px flex-1 bg-[#3a3a3c]" />
          <span>OR</span>
          <span className="h-px flex-1 bg-[#3a3a3c]" />
        </div>

        <Button
          type="button" variant="outline" disabled={busy} onClick={doGoogle}
          className="mb-2.5 h-auto w-full gap-2.5 rounded-[14px] border-[#dadce0] bg-white py-4 text-base font-bold text-[#1f1f1f] hover:bg-[#f7f8f8] hover:text-[#1f1f1f]"
        >
          <svg viewBox="0 0 48 48" aria-hidden="true" className="!size-[18px]">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          Continue with Google
        </Button>
      </DialogContent>
    </Dialog>
  )
}
