import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { FieldPhoto } from '../lib/fieldPhotos'

// Full-screen viewer for a review's field-report photos. Arrow keys / buttons
// navigate; shadcn Dialog supplies escape-to-close, the scroll lock and the
// focus trap, while clicks anywhere outside the figure still close (legacy
// backdrop behavior). Fullscreen dark look is intact — the overlay carries the
// wash and the content pane is a transparent fullscreen flexbox.
export function PhotoLightbox({
  photos, index, credit, onIndex, onClose,
}: {
  photos: FieldPhoto[]
  index: number
  credit: string
  onIndex: (i: number) => void
  onClose: () => void
}) {
  const prev = () => onIndex((index - 1 + photos.length) % photos.length)
  const next = () => onIndex((index + 1) % photos.length)

  // Arrow-key navigation (Dialog already owns Escape).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, photos.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const p = photos[index]
  if (!p) return null

  const navCls = 'absolute top-1/2 z-[2] flex h-[52px] w-[52px] -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-[rgba(20,20,20,.6)] p-0 pb-1 text-[30px] leading-none font-normal text-white hover:border-[#141414] hover:bg-brand hover:text-[#141414] max-[700px]:h-[42px] max-[700px]:w-[42px] max-[700px]:text-[24px]'

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="z-[120] bg-[rgba(12,12,9,.92)] data-[state=open]:animate-none data-[state=closed]:animate-none"
        className="fixed inset-0 top-0 left-0 z-[120] flex h-full w-full max-w-none translate-x-0 translate-y-0 items-center justify-center rounded-none border-0 bg-transparent p-0 font-sans shadow-none [line-height:normal] data-[state=open]:animate-none data-[state=closed]:animate-none"
        aria-label="Photo viewer"
        aria-describedby={undefined}
        onClick={onClose}
      >
        <DialogTitle className="sr-only">Photo viewer</DialogTitle>
        <Button
          variant="ghost"
          className="absolute top-3.5 right-[18px] z-[2] h-auto cursor-pointer rounded-none px-2.5 py-1 text-[40px] leading-none font-normal text-white hover:bg-transparent hover:text-brand"
          aria-label="Close" onClick={onClose}
        >×</Button>
        {photos.length > 1 ? (
          <Button variant="ghost" className={cn(navCls, 'left-4')} aria-label="Previous photo" onClick={(e) => { e.stopPropagation(); prev() }}>‹</Button>
        ) : null}
        <figure className="m-0 flex max-w-[min(92vw,1100px)] flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <img className="max-h-[78vh] max-w-full rounded-[10px] border-[3px] border-white shadow-[6px_6px_0_rgba(0,0,0,.5)] max-[700px]:max-h-[66vh]" src={p.src} alt={p.area} />
          <figcaption className="flex items-center gap-3">
            <span className="rounded-[4px] border-2 border-[#141414] bg-brand px-2.5 py-1 text-[11px] font-extrabold tracking-[.6px] text-[#141414] uppercase">{p.area}</span>
            <span className="text-[13px] font-extrabold text-white tabular-nums">{index + 1} / {photos.length}</span>
            <span className="text-[12.5px] font-bold tracking-[.5px] text-[#bdbcae] uppercase">📸 {credit}</span>
          </figcaption>
        </figure>
        {photos.length > 1 ? (
          <Button variant="ghost" className={cn(navCls, 'right-4')} aria-label="Next photo" onClick={(e) => { e.stopPropagation(); next() }}>›</Button>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
