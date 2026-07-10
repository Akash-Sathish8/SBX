import { useLayoutEffect, type RefObject } from 'react'

/**
 * Content-aware fill for share cards (.sc frames from share.css). Measures the
 * .sc-tl timeline and auto-scales its type (--scf) so the plan fills the fixed
 * frame whether few or many steps are picked, and never overflows (which would
 * clip text in the exported PNG). When the content is too tall to fit readably
 * it CUTS secondary detail before shrinking type: the muted .sc-swhere line
 * drops first, then .sc-snote.
 *
 * Export-correctness logic shared by every card (ShareCard, VenueShareCard) so
 * fixes live in ONE place and can't drift apart — same rule renderShareCard.ts
 * follows for rasterisation.
 *
 * `sig` must change whenever the rendered content changes (format + step text).
 * `fit: false` skips everything (e.g. the game card's fixed-size square mode);
 * `grid: true` keeps the timeline's justify-content untouched (grid layouts
 * ignore it and short plans shouldn't be re-centered).
 */
export function useShareCardFit(
  ref: RefObject<HTMLDivElement | null>,
  sig: string,
  opts: { fit: boolean; grid?: boolean; stepsCount: number },
): void {
  const { fit, grid, stepsCount } = opts
  useLayoutEffect(() => {
    const root = ref.current
    if (!root || !fit) return
    const tl = root.querySelector('.sc-tl') as HTMLElement | null
    const pad = root.querySelector('.sc-pad') as HTMLElement | null
    const foot = root.querySelector('.sc-foot') as HTMLElement | null
    if (!tl || !pad) return
    const wheres = Array.from(root.querySelectorAll<HTMLElement>('.sc-swhere'))
    const notes = Array.from(root.querySelectorAll<HTMLElement>('.sc-snote'))
    // reset to full detail + neutral scale before measuring
    root.style.setProperty('--scf', '1')
    wheres.forEach((el) => { el.style.display = '' })
    notes.forEach((el) => { el.style.display = '' })
    const padBottom = parseFloat(getComputedStyle(pad).paddingBottom) || 56
    const avail = root.offsetHeight - tl.offsetTop - (foot ? foot.offsetHeight : 0) - padBottom - 6
    // un-stretch the (flex:1) timeline so scrollHeight is the true content height
    const measure = () => { const f = tl.style.flex; tl.style.flex = '0 0 auto'; const h = tl.scrollHeight; tl.style.flex = f; return h }
    if (avail > 0) {
      // Plan too tall to fit readably → CUT secondary detail before shrinking
      // type: drop the muted "where" line first, then the "note" line.
      if (measure() > avail) wheres.forEach((el) => { el.style.display = 'none' })
      if (measure() > avail) notes.forEach((el) => { el.style.display = 'none' })
      // Final micro-fit: scale up to fill (few steps) or down to fit (many).
      const scf = Math.max(0.5, Math.min(1.3, avail / measure()))
      root.style.setProperty('--scf', String(Math.round(scf * 1000) / 1000))
    }
    // very short plans read better centered; longer ones spread along the timeline
    if (!grid) tl.style.justifyContent = stepsCount <= 2 ? 'space-around' : 'space-between'
  }, [sig]) // eslint-disable-line react-hooks/exhaustive-deps
}
