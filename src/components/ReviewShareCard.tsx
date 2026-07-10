import { forwardRef } from 'react'
import type { CSSProperties } from 'react'
import type { FieldPhoto } from '../lib/fieldPhotos'

// Shareable card for a fan's OWN review — same ticket language as the ballot
// card, rendered offscreen at 1080x1920 and rasterised by renderShareCardBlob.
// Inline-styled and self-contained (the venue/game pages don't load share CSS).
// Long reviews scale their type down by length instead of clipping; worst case
// the body fades out behind the footer rather than cutting mid-glyph.

export interface ReviewCardData {
  venueName: string
  venueCity?: string
  author: string
  body: string
  rating?: number
  createdAt: string
  net: number // up minus down; only shown when > 0
  photos?: FieldPhoto[] // first 2 are shown
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

const INK = '#141410'
const YEL = '#F7DF02'
const anton: CSSProperties = { fontFamily: "'Anton','Barlow',sans-serif", fontWeight: 400 }
const upper: CSSProperties = { textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 800 }

// Deterministic type scaling by length — measured fitting is overkill for a
// fixed frame, and deterministic sizes rasterise identically every time.
const bodyFont = (len: number) =>
  len < 260 ? 44 : len < 550 ? 38 : len < 900 ? 32 : len < 1400 ? 27 : 23

export const ReviewShareCard = forwardRef<HTMLDivElement, { r: ReviewCardData }>(
  function ReviewShareCard({ r }, ref) {
    const photos = (r.photos || []).slice(0, 2)
    const fs = bodyFont(r.body.length)
    return (
      <div
        ref={ref}
        style={{
          width: 1080, height: 1920, background: INK, position: 'relative', overflow: 'hidden',
          fontFamily: "'Barlow',sans-serif", padding: '76px 68px',
          backgroundImage: 'radial-gradient(140% 90% at 50% -20%, #2a2a22, #141410 60%)',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px)', backgroundSize: '56px 56px' }} />
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 40 }}>
            <img className="sc-cap" src="/img/logo.png" alt="" width={68} height={68} style={{ borderRadius: 16, boxShadow: '6px 6px 0 #000', background: YEL }} />
            <span style={{ ...anton, color: '#fff', fontSize: 44, letterSpacing: 4 }}>SNAPBACK</span>
          </div>

          <div style={{ background: '#fffdf4', border: '8px solid #000', borderRadius: 32, boxShadow: '20px 20px 0 rgba(0,0,0,.55)', overflow: 'hidden', display: 'flex', flexDirection: 'column', margin: 'auto 0', maxHeight: 1560 }}>
            <div style={{ background: YEL, borderBottom: '8px solid ' + INK, padding: '30px 44px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20 }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ ...anton, fontSize: 44, letterSpacing: 2, textTransform: 'uppercase', color: INK, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.venueName}</span>
                <span style={{ ...upper, fontSize: 20, color: '#5d5308' }}>{r.venueCity ? r.venueCity + ' · ' : ''}Fan review</span>
              </span>
              {typeof r.rating === 'number' ? (
                <span style={{ ...anton, fontSize: 46, color: INK, background: '#fffdf4', border: '6px solid ' + INK, borderRadius: 16, padding: '8px 22px', boxShadow: '5px 5px 0 ' + INK, whiteSpace: 'nowrap' }}>{r.rating}/10</span>
              ) : null}
            </div>
            <div style={{ position: 'relative', borderBottom: '6px dashed ' + INK }}>
              <span style={{ position: 'absolute', top: -22, left: -26, width: 44, height: 44, borderRadius: '50%', background: INK, border: '6px solid #000' }} />
              <span style={{ position: 'absolute', top: -22, right: -26, width: 44, height: 44, borderRadius: '50%', background: INK, border: '6px solid #000' }} />
            </div>

            <div style={{ padding: '34px 44px 0', flex: '1 1 auto', minHeight: 0, overflow: 'hidden', position: 'relative' }}>
              {/* bottom padding keeps a fitting body clear of the overflow fade */}
              <div style={{ fontSize: fs, lineHeight: 1.42, fontWeight: 600, color: '#22221c', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', paddingBottom: 78 }}>
                {r.body}
              </div>
              {/* fade instead of a hard clip when a very long review overflows */}
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 70, background: 'linear-gradient(180deg, rgba(255,253,244,0), #fffdf4)' }} />
            </div>

            {photos.length ? (
              <div style={{ display: 'flex', gap: 18, padding: '20px 44px 8px' }}>
                {photos.map((p) => (
                  <span key={p.src} style={{ position: 'relative', flex: 1, height: 300, borderRadius: 18, overflow: 'hidden', border: '6px solid ' + INK, display: 'block' }}>
                    <img src={p.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <span style={{ position: 'absolute', left: 12, bottom: 12, background: YEL, color: INK, ...upper, fontSize: 16, letterSpacing: 1, padding: '5px 12px', borderRadius: 6, border: '3px solid ' + INK }}>{p.area}</span>
                  </span>
                ))}
              </div>
            ) : null}

            <div style={{ borderTop: '6px dashed ' + INK, marginTop: 22, padding: '24px 44px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'repeating-linear-gradient(45deg, rgba(20,20,16,.04) 0 16px, transparent 16px 32px)' }}>
              <span>
                <span style={{ fontWeight: 800, fontSize: 30, color: INK, display: 'block' }}>@{r.author}</span>
                <span style={{ ...upper, fontSize: 18, color: '#8a8a7c' }}>{fmtDate(r.createdAt)}</span>
              </span>
              {r.net > 0 ? (
                <span style={{ ...anton, fontSize: 30, color: INK, background: YEL, border: '5px solid ' + INK, borderRadius: 14, padding: '10px 22px', boxShadow: '4px 4px 0 ' + INK }}>▲ {r.net}</span>
              ) : null}
            </div>
          </div>

          <div style={{ marginTop: 'auto', textAlign: 'center', ...upper, fontSize: 26, letterSpacing: 3, color: '#cfcfc2' }}>
            Fan reviews on <span style={{ color: YEL }}>sbx.snapbacksports.com</span>
          </div>
        </div>
      </div>
    )
  },
)
