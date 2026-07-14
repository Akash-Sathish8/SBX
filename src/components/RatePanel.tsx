import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { getJSON, getJSONFresh } from '../lib/dataCache'
import { SPORTS } from '../lib/sports'
import type { Game, Venue } from '../lib/espn'
import type { Experience } from '../lib/experiences'
import { matchExperienceForVenue, matchExperienceForTeam } from '../lib/experienceMatch'
import { PILLARS, avgPillars, type PillarKey } from '../lib/pillars'

// The gameday rating panel — score a specific game on the four pillars, with live
// benchmarks (what fans here averaged, what Snapback's experts gave the venue).
// Shared by the /rank ballot and the log-a-game button. Emits the pillar scores via
// onSave; the caller owns persistence.

interface FanStats { count: number; fans: number; food: number; unique: number; stadium: number; score: number }

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : `${WD[d.getDay()]} ${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}
const teamShort = (g: Game, side: 'home' | 'away') => g[side].location || g[side].displayName

// Notched ticket-corner CTA (matches the /rank buttons).
export const notchBtn =
  'relative h-auto cursor-pointer gap-2 rounded-none border-0 px-[22px] py-[11px] text-[14px] font-bold uppercase tracking-[.8px] text-ink-soft [clip-path:polygon(calc(100%_-_10px)_0px,100%_10px,100%_100%,10px_100%,0px_calc(100%_-_10px),0px_0px)] [filter:drop-shadow(5px_5px_0_#222222)] transition-[translate,filter] duration-[80ms,120ms] ease-[ease] hover:[filter:drop-shadow(5px_5px_0_#222222)_brightness(1.04)] active:translate-x-[3px] active:translate-y-[3px] active:[filter:drop-shadow(2px_2px_0_#222222)]'
const backlinkCls =
  'mb-[10px] h-auto cursor-pointer rounded-none border-0 bg-transparent p-0 text-[13px] font-bold uppercase tracking-[.4px] text-muted hover:bg-transparent hover:text-[#111]'

// 26px team mark (h! beats the unlayered img{height:auto} in styles.css).
function Logo({ src }: { src?: string }) {
  return src
    ? <img className="h-[26px]! w-[26px] flex-none object-contain" src={src} alt="" width={26} height={26} loading="lazy" />
    : <span className="h-[26px] w-[26px] flex-none rounded-full bg-[#eee]" aria-hidden="true" />
}

export function RatePanel({ game, onBack, onSave, initial, backLabel = '← Pick another game', saveLabel = 'Add to my rankings' }: {
  game: Game
  onBack: () => void
  onSave: (s: Record<PillarKey, number>) => void
  initial?: Record<PillarKey, number>
  backLabel?: string
  saveLabel?: string
}) {
  const [s, setS] = useState<Record<PillarKey, number>>(initial ?? { fans: 7, food: 7, unique: 7, stadium: 7 })
  const [fan, setFan] = useState<FanStats | null>(null)
  const [exps, setExps] = useState<Experience[]>([])
  const [venues, setVenues] = useState<Venue[]>([])
  const total = avgPillars(s)

  // Benchmarks: what other fans averaged at this venue, and what Snapback's
  // experts scored the matching experience. Both are honest gaps — no data,
  // no number.
  useEffect(() => {
    let alive = true
    setFan(null)
    if (game.venue.id || game.venue.name) {
      const qs = [game.venue.id ? 'venueId=' + encodeURIComponent(game.venue.id) : '', game.venue.name ? 'venue=' + encodeURIComponent(game.venue.name) : ''].filter(Boolean).join('&')
      getJSONFresh('/api/venue-stats?' + qs)
        .then((r: any) => { if (alive) setFan(r?.ok ? r.data : null) })
        .catch(() => { if (alive) setFan(null) })
    }
    getJSON('/data/experiences.json')
      .then((r: any) => { if (alive) setExps(Array.isArray(r?.experiences) ? r.experiences : []) })
      .catch(() => { if (alive) setExps([]) })
    getJSON('/api/venues')
      .then((r: any) => { if (alive) setVenues(Array.isArray(r?.data) ? r.data : []) })
      .catch(() => { if (alive) setVenues([]) })
    return () => { alive = false }
  }, [game.id, game.venue.name])

  const exp = useMemo(() => {
    if (!exps.length) return null
    // The games API doesn't carry venue ids, so resolve the D1 venue by name
    // (teams share buildings across leagues — hoops vs football), falling back
    // to home tenant, then reuse the shared matcher (overrides + auto-match).
    const vn = (game.venue.name || '').toLowerCase()
    const hn = game.home.displayName.toLowerCase()
    const ven =
      (vn ? venues.find((v) => v.name.toLowerCase() === vn) : undefined) ??
      venues.find((v) => (v.teams || []).some((t) => (t.displayName || '').toLowerCase() === hn))
    return (ven && matchExperienceForVenue(ven, exps)) || matchExperienceForTeam(game.home.displayName, exps)
  }, [exps, venues, game.venue.name, game.home.displayName])

  return (
    <div>
      <Button variant="ghost" className={backlinkCls} onClick={onBack}>{backLabel}</Button>
      <div className="mb-5 rounded-lg border-[2.5px] border-ink-soft bg-[#f4f4f4] px-4 py-[13px]">
        <div className="flex flex-wrap items-center gap-2 text-[18px] font-extrabold text-ink-soft">
          <Logo src={game.away.logo} /><span className="font-extrabold">{teamShort(game, 'away')}</span>
          <span className="text-[13px] font-bold text-muted">@</span>
          <Logo src={game.home.logo} /><span className="font-extrabold">{teamShort(game, 'home')}</span>
        </div>
        <div className="mt-[6px] text-[12.5px] font-semibold uppercase tracking-[.3px] text-muted">{SPORTS[game.league].label} · {game.venue.name}{game.venue.city ? ' · ' + game.venue.city : ''} · {fmtDate(game.date)}</div>
      </div>

      <div className="mb-6 flex flex-col gap-5">
        {PILLARS.map((p) => (
          <PillarRow
            key={p.key}
            label={p.label}
            desc={p.desc}
            value={s[p.key]}
            fanAvg={fan && fan.count > 0 ? fan[p.key] : undefined}
            sbx={exp ? exp[p.key] : undefined}
            onChange={(n) => setS((prev) => ({ ...prev, [p.key]: n }))}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-[18px] border-t-2 border-dashed border-[#ddd] pt-5">
        <div className="flex items-baseline gap-[10px]">
          <span className="font-display text-[44px] leading-none text-[#111]">{total.toFixed(1)}</span>
          <span className="text-[12px] font-bold uppercase tracking-[.5px] text-muted">your score</span>
        </div>
        <Button variant="secondary" className={cn(notchBtn, 'bg-brand px-6 py-[13px] text-[15px] text-[#111] hover:bg-brand')} onClick={() => onSave(s)}>{saveLabel}</Button>
      </div>
    </div>
  )
}

// One pillar: a slider plus a click-to-edit number badge. They share one value,
// so typing an exact score moves the slider and dragging updates the number. The
// badge keeps a raw text draft while focused so partial input ("7." or an empty
// field) isn't clobbered; the value is clamped to 1–10 (one decimal) on commit.
// `fanAvg`/`sbx` render as reference chips beside your score — what fans here
// averaged and what Snapback's experts gave it — so you rate with context.
function PillarRow({ label, desc, value, fanAvg, sbx, onChange }: {
  label: string
  desc: string
  value: number
  fanAvg?: number
  sbx?: number
  onChange: (n: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const clamp = (n: number) => Math.min(10, Math.max(1, Math.round(n * 10) / 10))

  const onText = (raw: string) => {
    const cleaned = raw.replace(/[^0-9.]/g, '')
    setDraft(cleaned)
    const n = parseFloat(cleaned)
    if (!isNaN(n) && n >= 1 && n <= 10) onChange(clamp(n)) // slider tracks valid input live
  }
  const commit = () => {
    if (draft !== null) {
      const n = parseFloat(draft)
      if (!isNaN(n)) onChange(clamp(n))
    }
    setDraft(null)
  }

  return (
    <div className="flex flex-col gap-[9px]">
      <div className="flex flex-wrap items-end justify-between gap-3 text-[15px] font-bold text-ink-soft">
        <span className="inline-flex items-center gap-[7px]">
          {label}
          {/* "?" rubric tooltip — hover or keyboard focus explains what the pillar means */}
          <span className="group relative inline-flex">
            <Button
              type="button"
              variant="ghost"
              className="peer h-[17px] w-[17px] cursor-help rounded-full border-2 border-[#111] bg-white p-0 text-[10.5px] font-extrabold leading-none text-[#444] hover:bg-brand hover:text-[#111] focus-visible:border-[#111] focus-visible:bg-brand focus-visible:text-[#111] focus-visible:ring-0"
              aria-label={`What "${label}" means`}
            >?</Button>
            <span
              role="tooltip"
              className="pointer-events-none absolute bottom-[calc(100%_+_10px)] left-[-10px] z-[6] w-[min(260px,72vw)] translate-y-[3px] rounded-[7px] bg-ink-soft px-3 py-[9px] text-[12.5px] font-semibold normal-case leading-[1.45] tracking-normal text-[#f2f2f2] opacity-0 shadow-[3px_3px_0_0_rgba(0,0,0,.85)] transition-[opacity,translate] duration-[120ms] ease-[ease] after:absolute after:left-[14px] after:top-full after:border-[6px] after:border-transparent after:border-t-ink-soft after:content-[''] group-hover:translate-y-0 group-hover:opacity-100 peer-focus-visible:translate-y-0 peer-focus-visible:opacity-100"
            >{desc}</span>
          </span>
        </span>
        <span className="inline-flex items-end gap-3">
          {fanAvg != null ? (
            <span className="inline-flex flex-col items-center gap-[3px]" title="Average score from fans who ranked a game here">
              <span className="text-[9px] font-extrabold uppercase tracking-[.6px] text-muted">Fan avg</span>
              <span className="min-w-[52px] rounded-md border-2 border-[#d7d7d7] bg-white px-2 py-1 text-center font-display text-[17px] leading-[1.05] text-[#333]">{fanAvg.toFixed(1)}</span>
            </span>
          ) : null}
          {sbx != null ? (
            <span className="inline-flex flex-col items-center gap-[3px]" title="Snapback's expert rating for this experience">
              <span className="text-[9px] font-extrabold uppercase tracking-[.6px] text-[#111]">Snapback</span>
              <span className="min-w-[52px] rounded-md border-2 border-[#111] bg-ink-soft px-2 py-1 text-center font-display text-[17px] leading-[1.05] text-brand">{sbx.toFixed(1)}</span>
            </span>
          ) : null}
          <span className="inline-flex flex-col items-center gap-[3px]">
            <span className="text-[9px] font-extrabold uppercase tracking-[.6px] text-[#111]">You</span>
            {/* click-to-edit score badge (an <Input> styled to look like the yellow chip) */}
            <Input
              type="text"
              inputMode="decimal"
              aria-label={`${label} score, 1 to 10`}
              value={draft ?? value.toFixed(1)}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => onText(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
              className="h-auto w-16 min-w-0 cursor-text appearance-none rounded-md border-2 border-[#111] bg-brand px-2 py-[3px] text-center font-display text-[20px] leading-[1.05] text-[#111] shadow-none transition-shadow duration-100 ease-[ease] hover:shadow-[2px_2px_0_0_#111] focus:bg-white focus:shadow-[3px_3px_0_0_#111] focus-visible:border-[#111] focus-visible:ring-0 md:text-[20px]"
            />
          </span>
        </span>
      </div>
      {/* range slider — track/thumb styled for both WebKit and Firefox so they match */}
      <input
        type="range"
        min={1}
        max={10}
        step={0.1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="m-0 h-[10px] w-full cursor-pointer appearance-none bg-transparent focus:outline-none [&::-moz-range-thumb]:h-[22px] [&::-moz-range-thumb]:w-[22px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-solid [&::-moz-range-thumb]:border-[#111] [&::-moz-range-thumb]:bg-brand [&::-moz-range-thumb]:shadow-[2px_2px_0_0_#111] [&::-moz-range-track]:h-[10px] [&::-moz-range-track]:rounded-[6px] [&::-moz-range-track]:border-2 [&::-moz-range-track]:border-solid [&::-moz-range-track]:border-[#111] [&::-moz-range-track]:bg-[#ececec] [&::-webkit-slider-runnable-track]:h-[10px] [&::-webkit-slider-runnable-track]:rounded-[6px] [&::-webkit-slider-runnable-track]:border-2 [&::-webkit-slider-runnable-track]:border-solid [&::-webkit-slider-runnable-track]:border-[#111] [&::-webkit-slider-runnable-track]:bg-[#ececec] [&::-webkit-slider-thumb]:-mt-[10px] [&::-webkit-slider-thumb]:h-[26px] [&::-webkit-slider-thumb]:w-[26px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-solid [&::-webkit-slider-thumb]:border-[#111] [&::-webkit-slider-thumb]:bg-brand [&::-webkit-slider-thumb]:shadow-[2px_2px_0_0_#111] [&:focus-visible::-webkit-slider-thumb]:shadow-[0_0_0_3px_rgba(247,223,2,.6),2px_2px_0_0_#111]"
      />
    </div>
  )
}
