import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteNav } from '../components/SiteNav'
import { PageCssGuard } from '../components/PageCssGuard'
import { SearchBox } from '../components/SearchBox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getJSON, intentWarm, warmImage } from '../lib/dataCache'
import { SPORTS, LEAGUES, COLLEGE_LEAGUES, type League } from '../lib/sports'
import { cardImg } from '../lib/img'
import type { Venue } from '../lib/espn'

export const Route = createFileRoute('/venues')({
  head: () => ({
    links: [
    ],
    meta: [{ title: 'Snapback · Venues' }],
  }),
  component: Venues,
})

const hasLeague = (v: Venue, l: League) => v.teams.some((t) => t.league === l)
const leagueTags = (v: Venue) => [...new Set(v.teams.map((t) => SPORTS[t.league].label))].join(' · ')
// Dedupe tenants by team id for DISPLAY — a school that plays two sports at one
// building (e.g. Syracuse football + basketball at the Carrier Dome) is listed
// once per league in the data (for filtering) but should show once on the card.
const uniqTeams = (v: Venue) => [...new Map(v.teams.map((t) => [t.id, t])).values()]

const container = 'mx-auto px-[clamp(28px,4vw,72px)]'

// League filter chip (legacy .tally .pill) — white brutalist tile that lifts on
// hover, presses on click, and fills brand yellow when active.
const pillCls = (on: boolean) => cn(
  'h-auto cursor-pointer gap-[6px] rounded-[6px] border-[3px] border-ink-soft bg-white px-[14px] py-[8px] text-[13px] font-bold tracking-[.4px] text-ink-soft uppercase shadow-[4px_4px_0_#222] duration-100',
  'hover:-translate-x-px hover:-translate-y-px hover:bg-white hover:text-ink-soft hover:shadow-[5px_5px_0_#222]',
  'active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#222]',
  on && 'bg-brand hover:bg-brand',
)

// Conference sub-filter chip (legacy .cchip) — smaller, flat secondary chip.
const cchipCls = (on: boolean) => cn(
  'h-auto flex-none cursor-pointer gap-[5px] rounded-[6px] border-2 border-ink-soft bg-white px-[12px] py-[6px] text-[12px] font-bold tracking-[.3px] text-ink-soft uppercase shadow-none transition-[background-color] duration-[120ms] hover:bg-[#f4f4f4] hover:text-ink-soft',
  on && 'bg-brand hover:bg-brand',
)

function Venues() {
  const [all, setAll] = useState<Venue[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | League>('all')
  const [conf, setConf] = useState<string | null>(null)
  // Progressive reveal — 601 cards (each a background-image fetch) is too heavy
  // to mount at once, especially on mobile.
  const PAGE = 24
  const [shown, setShown] = useState(PAGE)

  useEffect(() => {
    let alive = true
    getJSON('/api/venues')
      .then((r: any) => { if (alive) setAll(Array.isArray(r?.data) ? r.data : []) })
      .catch(() => { if (alive) setErr("Couldn't load venues.") })
    return () => { alive = false }
  }, [])


  const isCollege = filter === 'college-football' || filter === 'college-basketball'
  const list = useMemo(
    () => (all
      ? all.filter((v) =>
        (filter === 'all' || hasLeague(v, filter)) &&
        (!conf || v.teams.some((t) => t.league === filter && t.conference === conf)))
      : []),
    [all, filter, conf],
  )
  const count = (l: League) => (all ? all.filter((v) => hasLeague(v, l)).length : 0)
  // Conferences present for the active college sport (short name + venue count).
  const confList = useMemo(() => {
    if (!all || !isCollege) return []
    const m = new Map<string, { short: string; n: number }>()
    for (const v of all) {
      const t = v.teams.find((x) => x.league === filter && x.conference)
      if (!t?.conference) continue
      const e = m.get(t.conference) || { short: t.conferenceShort || t.conference, n: 0 }
      e.n++; m.set(t.conference, e)
    }
    return [...m.entries()].map(([name, x]) => ({ name, short: x.short, n: x.n })).sort((a, b) => a.short.localeCompare(b.short))
  }, [all, filter, isCollege])
  const pickFilter = (f: 'all' | League) => { setFilter(f); setConf(null); setShown(PAGE) }

  const visible = list.slice(0, shown)
  // Warm the photos for the visible slice so cards paint instantly.
  useEffect(() => {
    for (const v of visible) { const s = cardImg(v.image); if (s) warmImage(s) }
  }, [visible])

  return (
    <div className="min-h-screen bg-[#f4f4f4] font-sans text-[#33352f]">
      <PageCssGuard id="venues" />
      <SiteNav active="venues" />
      {/* overflow stays visible and z-5 lifts the header, so the search dropdown
          escapes the section and paints over the venue card grid below */}
      <section className="relative z-[5] bg-ink-soft pt-[44px] pb-[38px] text-white after:pointer-events-none after:absolute after:inset-0 after:content-[''] after:bg-[image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] after:bg-[size:32px_32px]">
        <div className={cn(container, 'relative z-[1]')}>
          <div className="mb-[14px] inline-flex items-center gap-[9px] rounded-[3px] bg-brand px-[13px] py-[6px] text-[13px] font-bold tracking-[1.4px] text-[#111] uppercase shadow-[4px_4px_0_#000]">NFL · NBA · MLB · NHL · every home ground</div>
          <h1 className="max-w-[20ch] font-display text-[clamp(44px,6.4vw,84px)] leading-none tracking-[1px] text-white uppercase">Every <span className="inline-block bg-brand px-[10px] text-[#111] shadow-[5px_5px_0_#000]">venue</span></h1>
          {/* the header SearchBox needs breathing room above the pills */}
          <div className="mt-[4px] mb-[16px]">
            <SearchBox placeholder="Search a venue, team, or city…" />
          </div>
          <div className="mt-[22px] flex flex-wrap gap-[14px]" id="tally">
            <Button variant="outline" className={pillCls(filter === 'all')} aria-pressed={filter === 'all'} onClick={() => pickFilter('all')}>All venues</Button>
            {[...LEAGUES, ...COLLEGE_LEAGUES].map((l) => (
              <Button key={l} variant="outline" className={pillCls(filter === l)} aria-pressed={filter === l} onClick={() => pickFilter(l)}><b className="mr-[5px] font-display text-[18px]">{all ? count(l) : '–'}</b> {SPORTS[l].label}</Button>
            ))}
          </div>
          {isCollege && confList.length ? (
            /* Conference sub-filter — appears under the league chips once CFB/CBB is
               picked. Horizontal scroll rail (CBB has 31 conferences) of smaller
               secondary chips. */
            <div className="mt-[12px] flex gap-[8px] overflow-x-auto pt-[2px] pb-[8px] [-webkit-overflow-scrolling:touch] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-[6px] [&::-webkit-scrollbar-thumb]:rounded-[3px] [&::-webkit-scrollbar-thumb]:bg-[#ccc]">
              <Button variant="outline" className={cchipCls(conf === null)} aria-pressed={conf === null} onClick={() => { setConf(null); setShown(PAGE) }}>All conferences</Button>
              {confList.map((c) => (
                <Button key={c.name} variant="outline" className={cchipCls(conf === c.name)} aria-pressed={conf === c.name} onClick={() => { setConf(c.name); setShown(PAGE) }}><b className="font-display text-[14px]">{c.n}</b> {c.short}</Button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="py-[46px]">
        <div className={container}>
          {all === null && !err ? <div className="px-[4px] py-[46px] text-[17px] font-semibold text-muted">Loading venues…</div> : null}
          {err ? <div className="px-[4px] py-[46px] text-[17px] font-semibold text-muted">{err}</div> : null}
          {all !== null && !err && list.length === 0 ? (
            <div className="px-[4px] py-[46px] text-[17px] font-semibold text-muted">No venues here.</div>
          ) : null}
          {all !== null && !err && list.length > 0 ? (
            <div className="grid grid-cols-3 gap-[26px] max-[900px]:grid-cols-2 max-[600px]:grid-cols-1" id="grid">
              {visible.map((v) => (
                <Link
                  key={v.id}
                  className="block overflow-hidden rounded-[8px] border-4 border-ink-soft bg-white drop-shadow-[8px_8px_0_#222] [transition:translate_.12s_ease-out,filter_.15s] [content-visibility:auto] [contain-intrinsic-size:auto_262px] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:drop-shadow-[11px_11px_0_#222]"
                  to="/venue"
                  search={{ id: v.id }}
                  {...intentWarm(() => { if (v.image) warmImage(v.image); const lg = v.teams[0]?.logo; if (lg) warmImage(lg) })}
                >
                  <div
                    className={cn(
                      'relative h-[178px]',
                      v.image
                        // real ESPN venue photo as the card background, under a
                        // darkening gradient wash
                        ? "bg-[#0d0d0d] bg-cover bg-center after:absolute after:inset-0 after:content-[''] after:bg-[linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.35))]"
                        // fallback (no photo): tenant team logos on a dark field
                        : 'flex items-center justify-center bg-[radial-gradient(120%_120%_at_50%_0%,#1c1c1c,#0a0a0a)]',
                    )}
                    style={v.image ? { backgroundImage: `url('${cardImg(v.image)}')` } : undefined}
                  >
                    {!v.image ? (
                      <div className="z-[1] flex flex-wrap items-center justify-center gap-[14px] px-[18px] py-[14px]">
                        {uniqTeams(v).slice(0, 4).map((t) => (t.logo ? <img key={t.id} className="h-[62px] w-[62px] object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,.5)]" src={t.logo} alt={t.displayName} loading="lazy" decoding="async" /> : null))}
                      </div>
                    ) : null}
                    {/* city text on one side, team logo on the OPPOSITE side — both over
                        the dark lower part of the photo gradient so they stay readable */}
                    <Badge className={cn('absolute z-[2] rounded-[3px] border-0 bg-brand px-[9px] py-[5px] text-[10px] font-extrabold tracking-[.6px] whitespace-normal text-[#111] uppercase shadow-[3px_3px_0_#000]', v.image ? 'top-[12px] left-[12px]' : 'top-[12px] right-[12px]')}>{leagueTags(v)}</Badge>
                    {v.city ? <Badge variant="ghost" className={cn('absolute z-[2] gap-[6px] rounded-[3px] border-0 bg-ink-soft px-[10px] py-[5px] text-[11px] font-bold tracking-[.5px] whitespace-normal text-white uppercase', v.image ? 'bottom-[12px] left-[12px]' : 'top-[12px] left-[12px]')}>{v.city}</Badge> : null}
                    {v.image ? (
                      <span className="absolute right-[12px] bottom-[12px] z-[2] flex items-center gap-[6px]">
                        {uniqTeams(v).slice(0, 3).map((t) => (t.logo ? <img key={t.id} className="h-[42px] w-[42px] object-contain drop-shadow-[0_2px_5px_rgba(0,0,0,.65)]" src={t.logo} alt={t.displayName} loading="lazy" /> : null))}
                      </span>
                    ) : null}
                  </div>
                  <div className="px-[18px] pt-[15px] pb-[17px]">
                    <div className="font-display text-[23px] leading-[1.05] tracking-[.6px] text-ink-soft">{v.name}</div>
                    <div className="mt-[6px] text-[13px] font-semibold tracking-[.4px] text-muted uppercase">{uniqTeams(v).map((t) => t.displayName).join(' · ')}</div>
                  </div>
                </Link>
              ))}
            </div>
          ) : null}
          {all !== null && !err && list.length > shown ? (
            <div className="flex justify-center pt-[26px] pb-[8px]">
              <Button
                variant="outline"
                className="h-auto cursor-pointer rounded-[6px] border-[3px] border-ink-soft bg-white px-[22px] py-[12px] text-[14px] font-bold tracking-[.4px] text-ink-soft uppercase shadow-[4px_4px_0_#222] duration-100 hover:-translate-x-px hover:-translate-y-px hover:bg-brand hover:text-ink-soft hover:shadow-[5px_5px_0_#222] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#222]"
                onClick={() => setShown((n) => n + PAGE * 2)}
              >
                Show more · {list.length - shown} left
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      <footer className="bg-black py-[40px] text-[13px] text-[#888]">
        <div className={container}>© 2026 Snapback Sports · Venues. <Link className="font-bold text-brand!" to="/">← Experiences</Link></div>
      </footer>
    </div>
  )
}
