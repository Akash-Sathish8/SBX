import { useEffect, useRef, useState } from 'react'
import { useLocation } from '@tanstack/react-router'
import { useAuth } from './auth/AuthProvider'

// Floating BackBuddy assistant — a Snapback-cap button pinned bottom-right of EVERY
// page that expands into a chat panel. It reads the current route to scope itself:
// a venue/game page → that venue/game; anywhere else → general (the rankings).
// Grounded server-side in real Snapback data only (/api/assistant). Auth-gated to send.
type Turn = { role: 'user' | 'assistant'; content: string }
type Scope = 'venue' | 'event' | 'general'

const SUGGESTIONS: Record<Scope, string[]> = {
  venue: ['How do I get there?', 'Where are the best seats?', 'What should I eat?'],
  event: ['How do I get there?', 'When should I show up?', 'Best seats for this game?'],
  general: ['What are the top experiences?', "Where's the best gameday food?", 'Tell me about the Penn State White Out'],
}

// Derive the assistant's grounding from the current route.
function useRouteTarget(): { scope: Scope; targetId?: string; sub: string } {
  const loc = useLocation()
  const path = loc.pathname
  const search = (loc.search || {}) as Record<string, any>
  if (path === '/venue' && search.id != null && String(search.id)) {
    return { scope: 'venue', targetId: String(search.id), sub: 'About this venue · only Snapback data' }
  }
  if (path === '/game' && search.id != null && search.league) {
    return { scope: 'event', targetId: `${search.league}:${search.id}`, sub: 'About this game · only Snapback data' }
  }
  return { scope: 'general', sub: 'Venues, games & the rankings · only Snapback data' }
}

export function AssistantChat() {
  const { user, openAuth } = useAuth()
  const { scope, targetId, sub } = useRouteTarget()
  const [open, setOpen] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const streamRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollDown = () => queueMicrotask(() => streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight }))

  // New page context → fresh conversation (the grounding changed).
  const ctxKey = scope + ':' + (targetId || '')
  useEffect(() => { setTurns([]); setErr(null); setDraft('') }, [ctxKey])

  // Close on Escape; focus the input when opened (if signed in).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    if (user) inputRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open, user])

  const send = async (text: string) => {
    const q = text.trim()
    if (!q || busy) return
    if (!user) { openAuth('signin'); return }
    setErr(null)
    const next: Turn[] = [...turns, { role: 'user', content: q }]
    setTurns(next)
    setDraft('')
    setBusy(true)
    scrollDown()
    try {
      const r = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scope, targetId, messages: next }),
      })
      const j = await r.json().catch(() => ({}))
      if (r.ok && j?.ok && typeof j.reply === 'string') {
        setTurns((prev) => [...prev, { role: 'assistant', content: j.reply }])
      } else {
        setErr(j?.error || 'BackBuddy is unavailable right now.')
        setTurns((prev) => prev.slice(0, -1)) // drop the unanswered question
        setDraft(q)
      }
    } catch {
      setErr('Network error. Try again.')
      setTurns((prev) => prev.slice(0, -1))
      setDraft(q)
    } finally {
      setBusy(false)
      scrollDown()
    }
  }

  return (
    <>
      <button
        className={'asst-fab' + (open ? ' open' : '')}
        aria-label={open ? 'Close BackBuddy' : 'Ask BackBuddy'}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <span className="asst-fab-x" aria-hidden>×</span> : <img className="asst-fab-logo" src="/img/logo.png" alt="" width={62} height={62} />}
      </button>

      {open ? (
        <div className="asst-panel" role="dialog" aria-label="BackBuddy assistant">
          <div className="asst-panel-head">
            <span className="asst-spark" aria-hidden>✦</span>
            <span className="asst-panel-title">Ask Snapback</span>
            <button className="asst-close" aria-label="Close" onClick={() => setOpen(false)}>×</button>
          </div>
          <div className="asst-sub">{sub}</div>

          <div className="asst-stream" ref={streamRef}>
            {turns.length === 0 ? (
              <div className="asst-empty">
                <p>BackBuddy here, how can I help?</p>
                <div className="asst-chips">
                  {SUGGESTIONS[scope].map((s) => (
                    <button key={s} type="button" className="asst-chip" onClick={() => send(s)} disabled={busy}>{s}</button>
                  ))}
                </div>
              </div>
            ) : (
              turns.map((t, i) => <div key={i} className={'asst-msg ' + t.role}>{t.content}</div>)
            )}
            {busy ? <div className="asst-msg assistant asst-typing"><span /><span /><span /></div> : null}
          </div>

          {err ? <div className="asst-err">{err}</div> : null}

          <form className="asst-form" onSubmit={(e) => { e.preventDefault(); send(draft) }}>
            <input
              ref={inputRef}
              className="asst-input"
              value={draft}
              maxLength={2000}
              placeholder={user ? 'Ask a question…' : 'Sign in to ask BackBuddy'}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={() => { if (!user) openAuth('signin') }}
              disabled={busy}
            />
            <button className="asst-send" type="submit" disabled={busy || !draft.trim()}>{busy ? '…' : 'Ask'}</button>
          </form>
        </div>
      ) : null}
    </>
  )
}
