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
// password, yellow CTA, mode-toggle + Forgot links. Built on shadcn Dialog
// (portal, backdrop, esc, focus trap, scroll lock) — bottom sheet on phones,
// centered card from sm: up. Forgot-password is an intentional "coming soon"
// no-op. Google sign-in is temporarily removed (onGoogle stays plumbed in Props
// / AuthProvider so the button can be restored later).
const inputDark =
  'h-auto rounded-[14px] border-[1.5px] border-[#3a3a3c] bg-[#2a2a2c] px-[18px] py-4 text-base font-semibold text-white placeholder:font-medium placeholder:text-[#8a8a8e] focus-visible:border-brand focus-visible:ring-0'

export function AuthModal({ open, mode, onMode, onClose, onLogin, onRegister }: Props) {
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
      </DialogContent>
    </Dialog>
  )
}
