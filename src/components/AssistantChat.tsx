import { useEffect, useRef, useState } from 'react'
import { useLocation } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

  const msgBase = 'max-w-[88%] whitespace-pre-wrap rounded-[13px] px-[13px] py-[10px] text-[14px] leading-[1.5] [overflow-wrap:anywhere]'
  return (
    <>
      <button
        className="fixed right-[18px] bottom-[18px] z-[90] flex h-[62px] w-[62px] cursor-pointer items-center justify-center overflow-hidden rounded-full border-[3px] border-[#111] bg-[#111] p-0 shadow-[4px_4px_0_rgba(0,0,0,.28)] [transition:transform_120ms_ease,box-shadow_120ms_ease] hover:[transform:translateY(-2px)] hover:shadow-[6px_6px_0_rgba(0,0,0,.28)] active:[transform:translateY(0)] active:shadow-[2px_2px_0_rgba(0,0,0,.28)] focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-[#F7DF02] max-[520px]:right-[14px] max-[520px]:bottom-[14px]"
        aria-label={open ? 'Close BackBuddy' : 'Ask BackBuddy'}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <span className="text-[30px] leading-none text-[#F7DF02]" aria-hidden>×</span> : <img className="block h-full! w-full object-cover" src="/img/logo.png" alt="" width={62} height={62} />}
      </button>

      {open ? (
        <div className="fixed right-[18px] bottom-[92px] z-[91] flex max-h-[min(72vh,560px)] w-[min(384px,calc(100vw-36px))] origin-bottom-right animate-[asstpop_140ms_ease-out] flex-col overflow-hidden rounded-[16px] border-[2.5px] border-[#111] bg-white shadow-[6px_6px_0_rgba(0,0,0,.2)] max-[520px]:right-[12px] max-[520px]:bottom-[86px] max-[520px]:left-[12px] max-[520px]:max-h-[74vh] max-[520px]:w-auto" role="dialog" aria-label="BackBuddy assistant">
          <div className="flex items-center gap-[10px] border-b-[2.5px] border-[#111] bg-[#F7DF02] px-[15px] py-[13px]">
            <span className="text-[16px] leading-none text-[#111]" aria-hidden>✦</span>
            <span className="font-display text-[18px] uppercase leading-none tracking-[.8px] text-[#111]">Ask Snapback</span>
            <button className="ml-auto flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-full border-0 bg-[#111] p-0 text-[20px] leading-none text-white hover:bg-[#333]" aria-label="Close" onClick={() => setOpen(false)}>×</button>
          </div>
          <div className="px-[15px] pt-[9px] text-[11.5px] font-bold uppercase tracking-[.3px] text-[#999]">{sub}</div>

          <div className="flex min-h-[120px] flex-1 flex-col gap-[10px] overflow-y-auto bg-white px-[15px] py-[14px]" ref={streamRef}>
            {turns.length === 0 ? (
              <div className="text-[14px] leading-[1.5] text-[#444]">
                <p className="m-0 mb-[12px]">BackBuddy here, how can I help?</p>
                <div className="flex flex-wrap gap-[8px]">
                  {SUGGESTIONS[scope].map((s) => (
                    <Button key={s} type="button" variant="outline" className="h-auto rounded-[999px] border-2 border-[#222] bg-white px-[13px] py-[7px] text-[13px] font-semibold text-[#222] [transition:background_120ms] enabled:hover:bg-[#F7DF02] enabled:hover:text-[#222]" onClick={() => send(s)} disabled={busy}>{s}</Button>
                  ))}
                </div>
              </div>
            ) : (
              turns.map((t, i) => (
                <div key={i} className={msgBase + (t.role === 'user' ? ' self-end rounded-br-[3px] bg-[#222] text-white' : ' self-start rounded-bl-[3px] bg-[#f4f4f4] text-[#1a1a1a]')}>{t.content}</div>
              ))
            )}
            {busy ? (
              <div className={msgBase + ' inline-flex items-center gap-[4px] self-start rounded-bl-[3px] bg-[#f4f4f4]'}>
                <span className="h-[6px] w-[6px] animate-[asstblink_1s_infinite_ease-in-out] rounded-full bg-[#bbb]" />
                <span className="h-[6px] w-[6px] animate-[asstblink_1s_infinite_ease-in-out] rounded-full bg-[#bbb] [animation-delay:.2s]" />
                <span className="h-[6px] w-[6px] animate-[asstblink_1s_infinite_ease-in-out] rounded-full bg-[#bbb] [animation-delay:.4s]" />
              </div>
            ) : null}
          </div>

          {err ? <div className="border-t border-[#f3c9c4] bg-[#fce8e6] px-[15px] py-[8px] text-[13px] text-[#a61b1b]">{err}</div> : null}

          <form className="flex gap-[8px] border-t-2 border-[#111] bg-white p-[12px]" onSubmit={(e) => { e.preventDefault(); send(draft) }}>
            <Input
              ref={inputRef}
              className="h-auto min-w-0 flex-1 rounded-[9px] border-2 border-[#cfcfcf] bg-white px-[12px] py-[10px] text-[14px] text-[#222] focus-visible:border-[#111] focus-visible:ring-0 disabled:bg-[#f3f3f3] md:text-[14px]"
              value={draft}
              maxLength={2000}
              placeholder={user ? 'Ask a question…' : 'Sign in to ask BackBuddy'}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={() => { if (!user) openAuth('signin') }}
              disabled={busy}
            />
            <Button className="h-auto flex-[0_0_auto] rounded-[9px] border-0 bg-[#111] px-[16px] py-[10px] text-[13px] font-extrabold uppercase tracking-[.5px] text-white hover:bg-[#111]" type="submit" disabled={busy || !draft.trim()}>{busy ? '…' : 'Ask'}</Button>
          </form>
        </div>
      ) : null}
    </>
  )
}
