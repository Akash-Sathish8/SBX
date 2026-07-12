import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SearchIcon } from 'lucide-react'
import { SiteNav } from '../components/SiteNav'
import { PageCssGuard } from '../components/PageCssGuard'
import { GameRow, matchText } from '../components/GameRow'
import { getJSON } from '../lib/dataCache'
import { SPORTS, LEAGUES, type League } from '../lib/sports'
import type { Game } from '../lib/espn'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/games')({
  head: () => ({
    links: [],
    meta: [{ title: 'Snapback · Games' }],
  }),
  component: Games,
})

const container = 'mx-auto w-full px-[clamp(28px,4vw,72px)]'
// Legacy .chip — square league filter pill; brand-yellow when active. On phones
// (≤640px) the filters row is a swipeable rail, so chips snap and never shrink.
const chipCls = (on: boolean) =>
  cn(
    'h-auto cursor-pointer rounded-none border-2 border-[#111] px-3.5 py-2 text-[13px] font-bold uppercase tracking-[0.4px] text-[#111] shadow-none hover:text-[#111] max-[640px]:snap-start',
    on ? 'bg-brand hover:bg-brand' : 'bg-white hover:bg-white',
  )
const emptyCls = 'px-0.5 py-3 text-[15px] text-muted'

function Games() {
  const [all, setAll] = useState<Game[] | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | League>('all')
  const [query, setQuery] = useState('')
  // Explore-first: the full schedule renders only after a league/search choice
  // or an explicit reveal; the default view is Today + This Weekend entries.
  const [reveal, setReveal] = useState(false)
  // Progressive reveal — up to 200 rows (28k+ px) is a long, heavy scroll on mobile.
  const PAGE = 40
  const [shown, setShown] = useState(PAGE)

  // Refetch per league: 'all' returns a near-term cross-league window ("what's
  // on"); a specific league returns its most-recent games (its season may be
  // over), so the chips browse the whole stored season, not just the window.
  useEffect(() => {
    let alive = true
    setAll(null); setErrMsg(null); setShown(PAGE)
    getJSON('/api/games' + (filter === 'all' ? '' : '?league=' + filter))
      .then((r: any) => { if (alive) setAll(Array.isArray(r?.data) ? r.data : []) })
      .catch(() => { if (alive) setErrMsg("Couldn't load the schedule.") })
    return () => { alive = false }
  }, [filter])

  const q = query.trim().toLowerCase()
  const list = useMemo(
    () => (all ? all.filter((g) => !q || matchText(g).indexOf(q) > -1) : []),
    [all, q],
  )
  const showList = filter !== 'all' || !!q || reveal
  // Today's slate (local calendar day) — the honest default view.
  const today = useMemo(() => {
    if (!all) return null
    const now = new Date()
    return all.filter((g) => { const d = new Date(g.date); return !isNaN(d.getTime()) && d.toDateString() === now.toDateString() })
  }, [all])

  return (
    <div className="min-h-screen bg-[#f4f4f4] font-sans text-[#33352f]">
      <PageCssGuard id="games" />
      <SiteNav active="games" />
      <section className="relative overflow-hidden bg-ink-soft pt-11 pb-[38px] text-white">
        {/* the faint grid the dark headers carry */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div className={container + ' relative z-[1]'}>
          <Link to="/" className="mb-3.5 inline-flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-[0.5px] text-[#cfcfcf]! hover:text-brand!">← Back</Link>
          <h1 className="font-display text-[clamp(30px,6.4vw,84px)] uppercase leading-none tracking-[1px] whitespace-nowrap text-white max-[600px]:whitespace-normal max-[600px]:text-[clamp(28px,9vw,40px)] max-[600px]:leading-[1.04]">Every <span className="inline-block bg-brand px-2.5 text-[#111] shadow-[5px_5px_0_#000]">game</span>, every league</h1>
        </div>
      </section>

      <section className="py-[46px]">
        <div className={container}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-display text-[30px] uppercase leading-none tracking-[1px] text-ink-soft">On the schedule</h2>
            <div className="flex min-w-[300px] items-center gap-[9px] rounded-md border-[3px] border-ink-soft bg-white px-3.5 py-[9px] shadow-[4px_4px_0_0_#222] max-[600px]:w-full max-[600px]:min-w-0">
              <SearchIcon className="size-4 flex-none text-ink-soft opacity-70" />
              <Input
                id="search"
                type="search"
                placeholder="Search team, venue or city…"
                aria-label="Search team, venue or city"
                autoComplete="off"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setShown(PAGE) }}
                className="h-auto rounded-none border-0 p-0 font-sans text-base font-semibold text-ink-soft shadow-none focus-visible:ring-0 md:text-base placeholder:font-medium placeholder:text-[#9a9a9a] [&::-webkit-search-cancel-button]:cursor-pointer"
              />
            </div>
          </div>
          <div className="mt-4 mb-[22px] text-sm text-muted">Filter by league or search · tap a game for its full guide.</div>
          <div className="mb-[18px] flex flex-wrap gap-2.5 max-[640px]:-mx-7 max-[640px]:flex-nowrap max-[640px]:gap-2 max-[640px]:overflow-x-auto max-[640px]:px-7 max-[640px]:pt-1 max-[640px]:pb-3 max-[640px]:[-webkit-overflow-scrolling:touch] max-[640px]:[scroll-snap-type:x_proximity] max-[640px]:[scrollbar-width:none] max-[640px]:[&::-webkit-scrollbar]:hidden" id="filters">
            <Button variant="outline" className={chipCls(filter === 'all')} onClick={() => setFilter('all')}>All sports</Button>
            {LEAGUES.map((l) => (
              <Button key={l} variant="outline" className={chipCls(l === filter)} onClick={() => setFilter(l)}>{SPORTS[l].label}</Button>
            ))}
          </div>
          <div id="matches">
            {all === null && !errMsg ? <div className="py-10 font-semibold text-muted">Loading games…</div> : null}
            {errMsg ? <div className={emptyCls}>{errMsg}</div> : null}
            {all !== null && !errMsg && !showList ? (
              <>
                <Link to="/weekend" className="mb-[22px] flex cursor-pointer flex-col gap-[5px] rounded-lg border-[3px] border-ink-soft bg-ink-soft px-5 py-[18px] text-white! shadow-[6px_6px_0_0_#f7df02] [transition:box-shadow_.15s,translate_.12s] hover:-translate-x-px hover:-translate-y-px hover:shadow-[9px_9px_0_0_#f7df02]">
                  <span className="font-display text-[22px] uppercase tracking-[0.6px] text-brand">This weekend →</span>
                  <span className="text-[13px] font-semibold text-[#d6d6d6]">The full Fri–Sun slate, every league, grouped by day</span>
                </Link>
                <div className="mt-1.5 mb-3.5 flex items-baseline gap-3 border-b-[3px] border-[#141414] pb-2"><h3 className="font-display text-[22px] uppercase leading-none tracking-[1px] text-ink-soft">Today</h3>{today ? <span className="text-[13px] font-bold text-muted">{today.length} {today.length === 1 ? 'game' : 'games'}</span> : null}</div>
                {today && today.length ? today.slice(0, 12).map((g) => <GameRow key={g.id} g={g} />) : null}
                {today && !today.length ? <div className={emptyCls}>No games today. Pick a league above or browse the weekend.</div> : null}
                <div className="flex justify-center pt-[22px] pb-1.5">
                  <Button variant="outline" className={cn(chipCls(false), 'px-[22px] py-3 text-[14px]')} onClick={() => setReveal(true)}>Full schedule →</Button>
                </div>
              </>
            ) : null}
            {all !== null && !errMsg && showList ? (
              list.length
                ? list.slice(0, shown).map((g) => <GameRow key={g.id} g={g} />)
                : <div className={emptyCls}>No games{q ? ' for “' + query.trim() + '”' : filter !== 'all' ? ' on the ' + SPORTS[filter].label + ' schedule right now' : ' on the schedule right now'}.</div>
            ) : null}
          </div>
          {all !== null && !errMsg && showList && list.length > shown ? (
            <div className="flex justify-center pt-[22px] pb-1.5">
              <Button variant="outline" className={cn(chipCls(false), 'px-[22px] py-3 text-[14px]')} onClick={() => setShown((n) => n + PAGE * 2)}>
                Show more · {list.length - shown} left
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      <footer className="bg-black py-10 text-[13px] text-[#888]"><div className={container}>© 2026 Snapback Sports · Games. <Link to="/" className="font-bold text-brand!">← Experiences</Link></div></footer>
    </div>
  )
}
