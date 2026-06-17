import { Fragment, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SearchIcon } from 'lucide-react'
import { SiteNav } from '../components/SiteNav'
import { teamName, teamFlag } from '../lib/teams'
import { useMatchScores, type Score } from '../lib/useMatchScores'
// Build-time-static fixture list — imported (bundled) rather than fetched at
// runtime, so the page server-renders the full list (SEO + instant first paint).
import { GAMES as GAMES_INDEX } from '../data'
import type { Game } from '../lib/data-types'

export const Route = createFileRoute('/games')({
  head: () => ({
    meta: [{ title: 'Snapback — Games & Tickets' }],
  }),
  component: Games,
})

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function dateChip(iso: string) {
  if (!iso) return { wd: '', md: '' }
  const p = iso.split('-').map(Number)
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]))
  return { wd: WD[d.getUTCDay()], md: MON[p[1] - 1] + ' ' + p[2] }
}
const matchText = (m: any) => ((m.home || '') + ' ' + (m.away || '') + ' ' + teamName(m.home || '') + ' ' + teamName(m.away || '') + ' ' + (m.venueName || '') + ' ' + (m.city || '') + ' ' + (m.round || '') + ' ' + (m.fixture || '')).toLowerCase()

function GameRow({ m, score }: { m: Game; score?: Score }) {
  const c = dateChip(m.dateISO)
  const played = !m.tbd && !!score
  const inner = (
    <>
      {played ? <span className="absolute top-[8px] right-[10px] z-[2] text-[9.5px] font-extrabold uppercase tracking-[0.5px] text-ink bg-brand-yellow border-[1.5px] border-ink rounded-[5px] px-[7px] py-[2px] leading-[1.2]">Full time</span> : null}
      <div className="flex flex-col items-start justify-center"><span className={'text-[10px] font-extrabold uppercase tracking-[0.6px] ' + (m.tbd ? 'text-[#aaa]' : 'text-[#9a7e00]')}>{c.wd}</span><span className={'font-display text-[19px] tracking-[0.3px] leading-none ' + (m.tbd ? 'text-[#999]' : 'text-ink')}>{c.md}</span></div>
      <div className="min-w-0">
        <div className={'text-[10.5px] font-extrabold uppercase tracking-[0.6px] ' + (m.tbd ? 'text-[#999]' : 'text-ink') + (played ? ' max-[760px]:pr-[66px]' : '')}>{m.round || 'Match'}</div>
        {m.tbd
          ? <div className="flex items-center [column-gap:9px] [row-gap:1px] flex-wrap mt-[3px] text-[#999] font-bold text-[16px] leading-[1.12]">To be confirmed</div>
          : <div className="flex items-center [column-gap:9px] [row-gap:1px] font-extrabold text-[19px] leading-[1.12] text-[#222] flex-wrap mt-[3px]"><span className="inline-flex items-center gap-[8px] whitespace-nowrap">{teamFlag(m.home)} {teamName(m.home)}</span> {played ? <span className="inline-flex items-center gap-[5px] font-extrabold text-[18px] text-[#222]">{score!.hs}<span className="text-[#6b6b6b] font-bold">–</span>{score!.as}</span> : <span className="text-[#6b6b6b] font-bold text-[13px]">v</span>} <span className="inline-flex items-center gap-[8px] whitespace-nowrap">{teamName(m.away)} {teamFlag(m.away)}</span></div>}
        <div className="text-[12.5px] text-[#6b6b6b] font-semibold uppercase tracking-[0.3px] mt-[4px]">{m.venueName}{m.city ? ' · ' + m.city : ''}{m.ko ? ' · ' + m.ko : ''}</div>
      </div>
      <div className="flex items-center gap-[14px] flex-none max-[760px]:[grid-column:2] max-[760px]:justify-start max-[760px]:mt-[2px]">
        {m.tbd ? <span className="text-[11px] font-bold uppercase tracking-[0.5px] text-[#aaa] whitespace-nowrap">Info soon</span> : <span className="text-[12px] font-extrabold uppercase tracking-[0.5px] text-ink whitespace-nowrap">{played ? 'Match recap →' : 'Match information →'}</span>}
      </div>
    </>
  )
  // The yellow accent bar is now a before: pseudo utility. border-color + shadow
  // live per-variant (not on growBase) so the dim/link values never collide on the
  // same property — Tailwind resolves same-property utilities by source order, not
  // class order, so two competing border-colors on one element would be a coin-flip.
  const growBase = "before:content-[''] before:absolute before:left-0 before:inset-y-0 before:w-[8px] before:rounded-[5px_0_0_5px] relative grid grid-cols-[58px_1fr_auto] gap-[18px] items-center bg-white border-[3px] rounded-[8px] px-[18px] py-[14px] pl-[26px] mb-[13px] [transition:box-shadow_.15s,transform_.12s] [content-visibility:auto] [contain-intrinsic-size:auto_92px] max-[760px]:grid-cols-[56px_1fr]"
  if (m.tbd) return <div className={growBase + " before:bg-[#d8d8d8] border-[#cfcfcf] shadow-[4px_4px_0_0_#ccc] opacity-[0.85] cursor-default"}>{inner}</div>
  // defaultPreload:'intent' (router.tsx) preloads the /game/$id route on hover.
  return <Link to="/game/$id" params={{ id: m.id }} className={growBase + " before:bg-brand-yellow border-[#222] shadow-[6px_6px_0_0_#222] cursor-pointer hover:shadow-[9px_9px_0_0_#f7df02] hover:translate-x-[-1px] hover:translate-y-[-1px]"}>{inner}</Link>
}

function Games() {
  const all = GAMES_INDEX
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')

  // Real final scores (ESPN), refreshed at most once per day. Completed matches
  // sort to the bottom of the list.
  const scoreInputs = useMemo(
    () => all.map((m) => ({ key: m.id, dateISO: m.dateISO, home: m.home, away: m.away })),
    [all],
  )
  const scores = useMatchScores(scoreInputs)

  const cities = useMemo(() => ['all'].concat([...new Set(all.map((m) => m.city).filter(Boolean))].sort()), [all])
  const q = query.trim().toLowerCase()
  const list = all.filter((m) => (filter === 'all' || m.city === filter) && (!q || matchText(m).indexOf(q) > -1))
  // completed matches drop to the bottom (stable sort keeps date order within each group)
  const sortedList = [...list].sort((a, b) => (scores[a.id] ? 1 : 0) - (scores[b.id] ? 1 : 0))

  return (
    <>
      <SiteNav active="games" />
      <section className="bg-[#222] text-white pt-[44px] pb-[38px] relative overflow-hidden grid-overlay">
        <div className="max-w-[1180px] mx-auto px-[28px] relative z-[1]">
          <Link to="/" className="inline-flex items-center gap-[6px] text-[#cfcfcf] font-bold text-[13px] uppercase tracking-[0.5px] mb-[14px] hover:text-brand-yellow">← Back</Link>
          <h1 className="font-display uppercase tracking-[1px] leading-none text-white text-[clamp(30px,6.4vw,84px)] max-w-none whitespace-nowrap max-[600px]:whitespace-normal max-[600px]:text-[clamp(28px,9vw,40px)] max-[600px]:leading-[1.04]">Every World Cup <span className="bg-brand-yellow text-ink px-[10px] shadow-[5px_5px_0_#000] inline-block">game</span></h1>
        </div>
      </section>

      <section className="py-[46px]">
        <div className="max-w-[1180px] mx-auto px-[28px]">
          <div className="flex items-center justify-between gap-[16px] flex-wrap">
            <h2 className="font-display uppercase tracking-[1px] leading-none text-[#222] text-[30px] mb-0">All matches</h2>
            <div className="flex items-center gap-[9px] bg-white border-[3px] border-[#222] rounded-[6px] shadow-[4px_4px_0_0_#222] px-[14px] py-[9px] min-w-[300px] max-[600px]:w-full max-[600px]:min-w-0"><SearchIcon className="w-[16px] h-[16px] flex-none opacity-70 text-[#222]" /><input id="search" type="search" placeholder="Search team, venue or city…" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} className="border-0 outline-0 bg-transparent font-body text-[16px] font-semibold text-[#111] w-full placeholder:text-[#9a9a9a] placeholder:font-medium [&::-webkit-search-cancel-button]:cursor-pointer" /></div>
          </div>
          <div className="text-[14px] text-[#6b6b6b] mt-[16px] mb-[22px]">Filter by host city or search · tap a match for its full game guide.</div>
          <div className="flex gap-[10px] flex-wrap mb-[18px] max-[640px]:flex-nowrap max-[640px]:overflow-x-auto max-[640px]:[scroll-snap-type:x_proximity] max-[640px]:gap-[8px] max-[640px]:mx-[-28px] max-[640px]:pt-[4px] max-[640px]:px-[28px] max-[640px]:pb-[12px] max-[640px]:[scrollbar-width:none] max-[640px]:[&::-webkit-scrollbar]:hidden" id="filters">
            {cities.map((c) => (
              <Fragment key={c}>
                {c === 'Miami' ? <span className="basis-full w-full h-0 m-0 p-0 max-[640px]:hidden" /> : null}
                <button className={'font-bold text-[13px] uppercase tracking-[0.4px] px-[14px] py-[8px] border-2 border-ink cursor-pointer text-ink max-[640px]:flex-[0_0_auto] max-[640px]:[scroll-snap-align:start] max-[640px]:whitespace-nowrap ' + (c === filter ? 'bg-brand-yellow' : 'bg-white')} onClick={() => setFilter(c)}>{c === 'all' ? 'All cities' : c}</button>
              </Fragment>
            ))}
          </div>
          <div id="matches">
            {list.length
              ? sortedList.map((m) => <GameRow key={m.id} m={m} score={scores[m.id]} />)
              : <div className="text-[#6b6b6b] text-[15px] px-[2px] py-[12px]">No matches{q ? ' for “' + query.trim() + '”' : ' for that city'}.</div>}
          </div>
        </div>
      </section>

      <footer className="bg-black text-[#888] py-[40px] text-[13px]"><div className="max-w-[1180px] mx-auto px-[28px]">© 2026 Snapback Sports — Games &amp; Tickets. <Link to="/" className="text-brand-yellow font-bold">← Experiences</Link></div></footer>
    </>
  )
}
