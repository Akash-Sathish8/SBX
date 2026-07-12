import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { renderShareCardBlob } from '../lib/renderShareCard'

// Share flow for the consumer-facing cards (ballot / rating / review): render
// the card once up front, then offer Share / Copy / Download on the CACHED
// blob. Splitting render from action matters — navigator.share() only opens
// the native sheet (AirDrop, Instagram, Snapchat, Save Image, ...) inside a
// fresh user gesture, and rasterisation takes seconds; calling it after the
// render used to trip Safari's transient-activation rule and silently degrade
// to a download. Here every button press is its own gesture on a ready file.
//
// `children` is the full-size card (1080x1920), mounted in the offscreen stage
// below and rasterised via the shared pipeline. Built on shadcn Dialog (portal,
// escape, backdrop click, focus trap) with the ticket-language skin on top.
export function ShareCardModal({
  filename, title, text, size, onClose, children,
}: {
  filename: string
  title: string
  text?: string
  // Card frame to rasterise; defaults to the 1080×1920 story frame. Pass e.g.
  // { width: 1080, height: 1080 } for the square format (venue plan).
  size?: { width?: number; height?: number }
  onClose: () => void
  children: ReactNode
}) {
  // Ref-as-state, not useRef: the offscreen stage below lives inside the Radix
  // Dialog portal, which doesn't attach its children until AFTER this component's
  // first effect would run — a plain useRef read races to null and the card
  // "fails to render". A ref callback flips this state the instant the node
  // mounts (its children commit first), so the rasterise fires exactly then.
  const [stage, setStage] = useState<HTMLDivElement | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [err, setErr] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!stage) return
    let alive = true
    const node = stage.firstElementChild as HTMLElement | null
    if (!node) { setErr(true); return }
    renderShareCardBlob(node, size)
      .then((b) => {
        if (!alive) return
        setBlob(b)
        setUrl(URL.createObjectURL(b))
      })
      .catch(() => { if (alive) setErr(true) })
    return () => { alive = false }
  }, [stage])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  const file = blob ? new File([blob], filename, { type: 'image/png' }) : null
  const nav = typeof navigator !== 'undefined' ? (navigator as any) : null
  const canNative = !!(file && nav?.canShare && nav.canShare({ files: [file] }))

  const doShare = async () => {
    if (!file) return
    try { await nav.share({ files: [file], title, text }) } catch { /* sheet dismissed */ }
  }
  const doCopy = async () => {
    if (!blob) return
    try {
      await (navigator.clipboard as any).write([new (window as any).ClipboardItem({ 'image/png': blob })])
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch { /* clipboard unavailable — Download still works */ }
  }
  const doDownload = () => {
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
  }

  const btn =
    'h-auto flex-1 whitespace-nowrap rounded-full border-2 border-ink bg-white px-2 py-[11px] ' +
    'font-sans text-[12.5px] font-extrabold uppercase tracking-[0.5px] text-ink hover:bg-[#fff7c9] hover:text-ink ' +
    'disabled:opacity-55'
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="z-[130] bg-[rgba(12,12,9,0.9)]"
        className="z-[130] block w-[calc(100%-36px)] max-w-[380px] rounded-[14px] border-[3px] border-ink bg-cream p-4 shadow-[8px_8px_0_rgba(0,0,0,0.5)] sm:max-w-[380px]"
      >
        <DialogTitle className="sr-only">Share card</DialogTitle>
        <DialogClose asChild>
          <button className="absolute -right-3.5 -top-3.5 z-[2] h-8 w-8 cursor-pointer rounded-full border-2 border-ink bg-brand text-sm font-extrabold text-ink shadow-[2px_2px_0_#141410]" aria-label="Close">✕</button>
        </DialogClose>
        <div className="flex min-h-[240px] max-h-[min(58vh,520px)] items-center justify-center overflow-hidden rounded-[10px] border-2 border-ink bg-ink">
          {url
            ? <img src={url} alt="Share card preview" className="block h-full max-h-[min(58vh,520px)] w-full object-contain" />
            : <div className="px-2.5 py-10 text-[13.5px] font-bold text-[#bdbcae]">{err ? "Couldn't render the card. Try again." : 'Rendering your card…'}</div>}
        </div>
        <div className="mt-3 flex gap-2">
          {canNative || !blob ? (
            <Button variant="outline" className={cn(btn, 'bg-brand hover:bg-brand hover:brightness-105')} disabled={!canNative} onClick={doShare}>Share…</Button>
          ) : null}
          <Button variant="outline" className={btn} disabled={!blob} onClick={doCopy}>{copied ? 'Copied!' : 'Copy image'}</Button>
          <Button variant="outline" className={btn} disabled={!url} onClick={doDownload}>↓ Download</Button>
        </div>
        {/* offscreen full-size card, rasterised once on mount */}
        <div ref={setStage} style={{ position: 'fixed', left: -12000, top: 0, pointerEvents: 'none' }} aria-hidden="true">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}
