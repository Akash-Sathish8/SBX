import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
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
// below and rasterised via the shared pipeline.
export function ShareCardModal({
  filename, title, text, onClose, children,
}: {
  filename: string
  title: string
  text?: string
  onClose: () => void
  children: ReactNode
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [err, setErr] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    const node = stageRef.current?.firstElementChild as HTMLElement | null
    if (!node) { setErr(true); return }
    renderShareCardBlob(node)
      .then((b) => {
        if (!alive) return
        setBlob(b)
        setUrl(URL.createObjectURL(b))
      })
      .catch(() => { if (alive) setErr(true) })
    return () => { alive = false }
  }, [])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  // Escape closes (matches the photo lightbox behavior).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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

  return (
    <div className="shm" role="dialog" aria-modal="true" aria-label="Share card" onClick={onClose}>
      <div className="shm-in" onClick={(e) => e.stopPropagation()}>
        <button className="shm-x" aria-label="Close" onClick={onClose}>✕</button>
        <div className="shm-prev">
          {url
            ? <img src={url} alt="Share card preview" />
            : <div className="shm-load">{err ? "Couldn't render the card. Try again." : 'Rendering your card…'}</div>}
        </div>
        <div className="shm-actions">
          {canNative || !blob ? (
            <button className="shm-btn brand" disabled={!canNative} onClick={doShare}>Share…</button>
          ) : null}
          <button className="shm-btn" disabled={!blob} onClick={doCopy}>{copied ? 'Copied!' : 'Copy image'}</button>
          <button className="shm-btn" disabled={!url} onClick={doDownload}>↓ Download</button>
        </div>
      </div>
      {/* offscreen full-size card, rasterised once on mount */}
      <div ref={stageRef} style={{ position: 'fixed', left: -12000, top: 0, pointerEvents: 'none' }} aria-hidden="true">
        {children}
      </div>
    </div>
  )
}
