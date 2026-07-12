import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SiteNav } from '../components/SiteNav'
import { PageCssGuard } from '../components/PageCssGuard'
import { GameRow } from '../components/GameRow'
import { getJSON } from '../lib/dataCache'
import { SPORTS, RANKABLE_LEAGUES, type League } from '../lib/sports'
import { weekendWindow, localDayKey } from '../lib/weekend'
import type { Game } from '../lib/espn'

export const Route = createFileRoute('/weekend')({
  head: () => ({
    links: [],
    meta: [{ title: 'Snapback · This Weekend' }],
  }),
  component: Weekend,
})

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const dayLabel = (d: Date) => `${WD[d.getDay()]} · ${MON[d.getMonth()]} ${d.getDate()}`
const shortDate = (d: Date) => `${MON[d.getMonth()]} ${d.getDate()}`

// The old .container: full-bleed with the clamped gutters every section shares.
const container = 'mx-auto px-[clamp(28px,4vw,72px)]'
// .empty — quiet gray notices ("no games", load errors).
const emptyCls = 'px-[2px] py-[18px] text-[15px] text-muted'
// .empty a — bold with the yellow underline.
const emptyLink = 'border-b-2 border-brand font-extrabold'

function Weekend() {
  // The window is computed once per mount — Fri–Sun containing today, or the
  // next one when it's mid-week (see lib/weekend).
  const win = useMemo(() => weekendWindow(new Date()), [])
  const [all, setAll] = useState<Game[] | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | League>('all')

  useEffect(() => {
    let alive = true
    // limit=1000: a fall weekend (NFL + NHL + NBA + both college slates) tops
    // 320+ games — 300 was silently truncating the window. dbGames caps at 2000.
    getJSON(`/api/games?from=${encodeURIComponent(win.from)}&to=${encodeURIComponent(win.to)}&limit=1000`)
      .then((r: any) => { if (alive) setAll(Array.isArray(r?.data) ? r.data : []) })
      .catch(() => { if (alive) setErrMsg("Couldn't load the weekend slate.") })
    return () => { alive = false }
  }, [win])

  const list = useMemo(
    () => (all ? (filter === 'all' ? all : all.filter((g) => g.league === filter)) : []),
    [all, filter],
  )

  // The old .chip — square league filter pill, brand-yellow when `.on`. Kept
  // identical to the /games rail (weekend's chrome follows the games idioms).
  // Button's base shrink-0 + whitespace-nowrap cover the legacy mobile
  // `flex:0 0 auto; white-space:nowrap`.
  const chip = (on: boolean) => cn(
    'h-auto cursor-pointer rounded-none border-2 border-[#111] px-3.5 py-2 text-[13px] font-bold uppercase tracking-[0.4px] text-[#111] shadow-none hover:text-[#111] max-[640px]:snap-start',
    on ? 'bg-brand hover:bg-brand' : 'bg-white hover:bg-white',
  )

  return (
    <div className="min-h-screen bg-[#f4f4f4] font-sans text-[#33352f]">
      <PageCssGuard id="weekend" />
      <SiteNav active="weekend" />
      <section className="relative overflow-hidden bg-ink-soft pb-[38px] pt-[44px] text-white after:pointer-events-none after:absolute after:inset-0 after:content-[''] after:[background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] after:[background-size:32px_32px]">
        <div className={cn(container, 'relative z-[1]')}>
          {/* `!` beats the unlayered global a{color:inherit} in styles.css */}
          <Link to="/" className="mb-[14px] inline-flex items-center gap-[6px] text-[13px] font-bold uppercase tracking-[.5px] text-[#cfcfcf]! transition-colors hover:text-brand!">← Back</Link>
          <h1 className="font-display text-[clamp(30px,6.4vw,84px)] uppercase leading-none tracking-[1px] text-white max-[600px]:text-[clamp(28px,9vw,40px)] max-[600px]:leading-[1.04]">This <span className="inline-block bg-brand px-[10px] text-[#111] shadow-[5px_5px_0_#000]">weekend</span></h1>
          <p className="mt-[18px] max-w-[64ch] text-[18px] leading-[1.5] text-[#d6d6d6]">
            {shortDate(win.days[0])} – {shortDate(win.days[2])} · every game, every league. Tap one for its full guide.
          </p>
        </div>
      </section>

      <section className="pb-[46px] pt-[38px]">
        <div className={container}>
          <div className="mb-1.5 flex flex-wrap gap-[10px] max-[640px]:-mx-[28px] max-[640px]:flex-nowrap max-[640px]:snap-x max-[640px]:snap-proximity max-[640px]:gap-2 max-[640px]:overflow-x-auto max-[640px]:px-[28px] max-[640px]:pb-3 max-[640px]:pt-1 max-[640px]:[-webkit-overflow-scrolling:touch] max-[640px]:[scrollbar-width:none] max-[640px]:[&::-webkit-scrollbar]:hidden">
            <Button type="button" variant="outline" aria-pressed={filter === 'all'} className={chip(filter === 'all')} onClick={() => setFilter('all')}>All sports</Button>
            {RANKABLE_LEAGUES.map((l) => (
              <Button key={l} type="button" variant="outline" aria-pressed={l === filter} className={chip(l === filter)} onClick={() => setFilter(l)}>{SPORTS[l].label}</Button>
            ))}
          </div>

          {all === null && !errMsg ? <div className="py-10 font-semibold text-muted">Loading the weekend slate…</div> : null}
          {errMsg ? <div className={emptyCls}>{errMsg}</div> : null}

          {all !== null && !errMsg ? (
            list.length ? (
              win.days.map((d) => {
                const key = localDayKey(d)
                const dayGames = list.filter((g) => localDayKey(new Date(g.date)) === key)
                if (!dayGames.length) return null
                return (
                  <section key={key}>
                    {/* FRI / SAT / SUN day header */}
                    <div className="mb-3.5 mt-[30px] flex items-baseline gap-3 border-b-[3px] border-[#141414] pb-2">
                      <h2 className="font-display text-[24px] uppercase leading-none tracking-[1px] text-[#222]">{dayLabel(d)}</h2>
                      <span className="text-[13px] font-bold text-muted">{dayGames.length} {dayGames.length === 1 ? 'game' : 'games'}</span>
                    </div>
                    {dayGames.map((g) => <GameRow key={g.league + ':' + g.id} g={g} />)}
                  </section>
                )
              })
            ) : (
              <div className={emptyCls}>
                {filter === 'all'
                  ? <>Nothing on the schedule this weekend. <Link to="/games" className={emptyLink}>Browse the full schedule →</Link></>
                  : <>No {SPORTS[filter].label} games in this window. <Link to="/games" className={emptyLink}>See the {SPORTS[filter].label} schedule →</Link></>}
              </div>
            )
          ) : null}
        </div>
      </section>

      <footer className="bg-black py-10 text-[13px] text-[#888]">
        <div className={container}>© 2026 Snapback Sports. <Link to="/" className="font-bold text-brand!">← Explore</Link></div>
      </footer>
    </div>
  )
}
