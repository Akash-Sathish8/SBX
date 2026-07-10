import { useEffect } from 'react'
import type { FieldPhoto } from '../lib/fieldPhotos'

// Full-screen viewer for a review's field-report photos. Arrow keys / buttons
// navigate, Escape or backdrop click closes. Styled by .lbx* in styles.css.
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    // Lock page scroll behind the overlay.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [index, photos.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const p = photos[index]
  if (!p) return null

  return (
    <div className="lbx" onClick={onClose} role="dialog" aria-modal="true" aria-label="Photo viewer">
      <button className="lbx-x" aria-label="Close" onClick={onClose}>×</button>
      {photos.length > 1 ? (
        <button className="lbx-nav lbx-prev" aria-label="Previous photo" onClick={(e) => { e.stopPropagation(); prev() }}>‹</button>
      ) : null}
      <figure className="lbx-in" onClick={(e) => e.stopPropagation()}>
        <img src={p.src} alt={p.area} />
        <figcaption className="lbx-meta">
          <span className="lbx-tag">{p.area}</span>
          <span className="lbx-count">{index + 1} / {photos.length}</span>
          <span className="lbx-credit">📸 {credit}</span>
        </figcaption>
      </figure>
      {photos.length > 1 ? (
        <button className="lbx-nav lbx-next" aria-label="Next photo" onClick={(e) => { e.stopPropagation(); next() }}>›</button>
      ) : null}
    </div>
  )
}
