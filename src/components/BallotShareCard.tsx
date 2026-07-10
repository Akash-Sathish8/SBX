import { forwardRef } from 'react'
import type { CSSProperties } from 'react'

// Shareable "My Gameday Ballot" card — the fan's top-ranked games as one tall
// ADMIT ONE ticket, rendered offscreen at full story size (1080x1920) and
// rasterised by renderShareCardBlob (which also swaps img.sc-cap to a data
// URI). Inline styles only: /rank doesn't load the share-page CSS, and
// html-to-image serialises computed styles, so the card must be self-contained.

export interface BallotCardRow {
  away: string
  home: string
  venue: string
  league: string
  date: string
  score: number
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const fmtRowDate = (iso: string) => {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

const INK = '#141410'
const YEL = '#F7DF02'
const anton: CSSProperties = { fontFamily: "'Anton','Barlow',sans-serif", fontWeight: 400 }
const upper: CSSProperties = { textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 800 }

export const BallotShareCard = forwardRef<HTMLDivElement, { rows: BallotCardRow[]; total: number; handle?: string | null; title?: string }>(
  function BallotShareCard({ rows, total, handle, title = 'My Gameday Ballot' }, ref) {
    const top = rows.slice(0, 5)
    const avg = total ? Math.round((rows.reduce((s, r) => s + r.score, 0) / rows.length) * 10) / 10 : 0
    const now = new Date()
    const stamp = `${MON[now.getMonth()]} ${now.getFullYear()}`
    return (
      <div
        ref={ref}
        style={{
          width: 1080, height: 1920, background: INK, position: 'relative', overflow: 'hidden',
          fontFamily: "'Barlow',sans-serif", padding: '76px 68px',
          backgroundImage: 'radial-gradient(140% 90% at 50% -20%, #2a2a22, #141410 60%)',
        }}
      >
        {/* faint grid, matching the app's dark headers */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px)', backgroundSize: '56px 56px' }} />
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 40 }}>
            <img className="sc-cap" src="/img/logo.png" alt="" width={68} height={68} style={{ borderRadius: 16, boxShadow: '6px 6px 0 #000', background: YEL }} />
            <span style={{ ...anton, color: '#fff', fontSize: 44, letterSpacing: 4 }}>SNAPBACK</span>
          </div>

          <div style={{ background: '#fffdf4', border: '8px solid #000', borderRadius: 32, boxShadow: '20px 20px 0 rgba(0,0,0,.55)', overflow: 'hidden', flex: '0 0 auto', margin: 'auto 0' }}>
            <div style={{ background: YEL, borderBottom: '8px solid ' + INK, padding: '32px 44px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ ...anton, fontSize: 48, letterSpacing: 3, textTransform: 'uppercase', color: INK }}>{title}</span>
              <span style={{ ...upper, fontSize: 24, color: '#5d5308' }}>№ {total} {total === 1 ? 'game' : 'games'}</span>
            </div>
            <div style={{ position: 'relative', borderBottom: '6px dashed ' + INK }}>
              <span style={{ position: 'absolute', top: -22, left: -26, width: 44, height: 44, borderRadius: '50%', background: INK, border: '6px solid #000' }} />
              <span style={{ position: 'absolute', top: -22, right: -26, width: 44, height: 44, borderRadius: '50%', background: INK, border: '6px solid #000' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '24px 44px', ...upper, fontSize: 23, color: '#8a8a7c' }}>
              <span>{handle ? '@' + handle : 'My rankings'}</span>
              <span>{stamp}</span>
            </div>
            <div style={{ padding: '8px 36px 28px' }}>
              {top.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 26, padding: '34px 12px', borderTop: i ? '3px solid #ecece0' : 'none' }}>
                  {i === 0 ? (
                    <span style={{ ...anton, fontSize: 44, color: INK, background: YEL, border: '5px solid ' + INK, borderRadius: 16, width: 84, textAlign: 'center', padding: '4px 0', boxShadow: '4px 4px 0 ' + INK }}>1</span>
                  ) : (
                    <span style={{ ...anton, fontSize: 46, color: '#b6a900', width: 84, textAlign: 'center' }}>{i + 1}</span>
                  )}
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', fontWeight: 800, fontSize: 33, color: INK, lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.away} @ {r.home}</span>
                    <span style={{ display: 'block', fontSize: 21, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#8a8a7c', marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.venue}{r.league ? ' · ' + r.league : ''} · {fmtRowDate(r.date)}
                    </span>
                  </span>
                  <span style={{ ...anton, fontSize: 42, color: INK, background: i === 0 ? YEL : '#fff', border: '5px solid ' + INK, borderRadius: 14, padding: '6px 20px', boxShadow: '4px 4px 0 ' + INK }}>{r.score.toFixed(1)}</span>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '6px dashed ' + INK, padding: '26px 44px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'repeating-linear-gradient(45deg, rgba(20,20,16,.04) 0 16px, transparent 16px 32px)' }}>
              <span>
                <span style={{ ...anton, fontSize: 58, color: INK, display: 'block', lineHeight: 1 }}>{avg.toFixed(1)}</span>
                <span style={{ ...upper, fontSize: 19, color: '#8a8a7c' }}>avg score</span>
              </span>
              <span style={{ ...anton, fontSize: 30, color: INK, background: YEL, border: '5px solid ' + INK, borderRadius: 14, padding: '10px 24px', boxShadow: '4px 4px 0 ' + INK, textTransform: 'uppercase', letterSpacing: 2 }}>Ranked by me</span>
            </div>
          </div>

          <div style={{ marginTop: 'auto', textAlign: 'center', ...upper, fontSize: 26, letterSpacing: 3, color: '#cfcfc2' }}>
            Rank your gamedays at <span style={{ color: YEL }}>sbx.snapbacksports.com</span>
          </div>
        </div>
      </div>
    )
  },
)
