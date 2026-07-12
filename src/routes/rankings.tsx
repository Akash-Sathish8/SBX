import { useEffect, useMemo, useState } from 'react'
import { containerWide as container } from '../lib/ui'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteNav } from '../components/SiteNav'
import { PageCssGuard } from '../components/PageCssGuard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'
import { getJSON, warmImage } from '../lib/dataCache'
import type { Experience } from '../lib/experiences'
import { expImage } from '../lib/experiences'
import type { Venue } from '../lib/espn'
import { collectionBySlug } from '../lib/collections'
import { matchVenueForExperience } from '../lib/experienceMatch'

// Expert-rated US sports experiences (built from public/data/experiences.csv via
// scripts/build-experiences.mjs — non-US dropped, re-ranked #1..N by final score).
interface ExpData {
  count: number
  sports: string[]
  experiences: Experience[]
}

export const Route = createFileRoute('/rankings')({
  // ?collection=<slug> filters to an editorial collection (deep-linked from the
  // explore home); ?q= pre-fills the search (deep-linked from search results).
  validateSearch: (s: Record<string, unknown>) => {
    const out: { collection?: string; q?: string } = {}
    if (typeof s.collection === 'string' && collectionBySlug(s.collection)) out.collection = s.collection
    if (s.q != null && String(s.q).trim()) out.q = String(s.q)
    return out
  },
  head: () => ({
    meta: [{ title: 'Snapback · Experience Rankings' }],
  }),
  component: Rankings,
})

const f1 = (n: number) => n.toFixed(1)

const PILLARS = [
  { key: 'fans', label: 'Fans & atmosphere' },
  { key: 'food', label: 'Food & drink' },
  { key: 'unique', label: 'Uniqueness' },
  { key: 'stadium', label: 'The stadium' },
] as const

// The old .container: full-bleed with the clamped gutters every section shares.
// .loading / .empty in the results block.
const emptyCls = 'p-[34px] text-center font-semibold text-[#8a8a82]'

function Rankings() {
  const { collection: colSlug, q: qParam } = Route.useSearch()
  const col = colSlug ? collectionBySlug(colSlug) : undefined
  const [data, setData] = useState<ExpData | null>(null)
  const [venues, setVenues] = useState<Venue[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [q, setQ] = useState(qParam ?? '')
  const [sport, setSport] = useState('All Sports')
  // Spotlight selection (by rank). Falls back to the first visible row whenever
  // the current pick is filtered out.
  const [selRank, setSelRank] = useState<number | null>(null)

  // Deep-linked search (?q= from home search results) wins over stale local state.
  useEffect(() => { if (qParam != null) setQ(qParam) }, [qParam])

  useEffect(() => {
    let alive = true
    getJSON<ExpData>('/data/experiences.json')
      .then((d) => { if (alive) setData(d) })
      .catch(() => { if (alive) setErr("Couldn't load rankings.") })
    getJSON('/api/venues')
      .then((r: any) => { if (alive) setVenues(Array.isArray(r?.data) ? r.data : []) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const list = useMemo(() => {
    if (!data) return []
    const base = col ? col.pick(data.experiences) : data.experiences
    const needle = q.trim().toLowerCase()
    return base.filter((e) => {
      if (sport !== 'All Sports' && e.sport !== sport) return false
      if (needle && !`${e.name} ${e.location} ${e.sport}`.toLowerCase().includes(needle)) return false
      return true
    })
  }, [data, q, sport, col])

  const sel = useMemo(
    () => list.find((e) => e.rank === selRank) ?? list[0] ?? null,
    [list, selRank],
  )
  const selVenue = useMemo(() => (sel ? matchVenueForExperience(sel.name, venues) : null), [sel, venues])
  const selImage = sel ? (sel.image ?? expImage(sel.name, venues)) : undefined
  useEffect(() => { if (selImage) warmImage(selImage) }, [selImage])

  return (
    <div className="min-h-screen bg-white font-sans text-[#16160f]">
      <PageCssGuard id="rankings" />
      <SiteNav />
      <section className="pt-[46px] pb-[22px]">
        <div className={container}>
          <div className="text-[12px] font-extrabold uppercase tracking-[1px] text-[#8a7c00]">Expert-rated · {data ? data.count : '–'} US experiences</div>
          <h1 className="mt-3 mb-6 font-display text-[clamp(40px,6vw,74px)] leading-[1.16] tracking-[.5px] text-[#16160f] max-[760px]:text-[42px]">Our best experiences</h1>
          {col ? (
            <Badge variant="outline" className="mb-3.5 gap-2 overflow-visible rounded-md border-2 border-[#16160f] bg-[#fdf6c8] px-3 py-1.5 text-[13px] font-bold text-[#16160f]">
              Collection: <b className="font-extrabold">{col.title}</b>
              {/* text color rides the a{color:inherit} global — the chip's ink */}
              <Link to="/rankings" search={{}} aria-label="Clear collection" className="rounded-sm px-[3px] font-extrabold hover:bg-brand">✕</Link>
            </Badge>
          ) : null}
          <p className="mb-[22px] max-w-[64ch] text-[16px] leading-[1.5] text-[#5a5a52]">
            {/* ! beats the unlayered global a{color:inherit} in styles.css */}
            <Link to="/rank" className="border-b-2 border-brand font-extrabold whitespace-nowrap text-[#16160f]!">Log a game →</Link>
          </p>
          <div className="flex flex-wrap gap-3">
            <Label className="flex min-h-[50px] min-w-[240px] flex-[1_1_280px] items-center gap-2.5 rounded-xl border border-[#e6e6e0] bg-white px-4 font-normal shadow-[0_1px_2px_rgba(0,0,0,.04)] max-[760px]:basis-full">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[18px] flex-none fill-none stroke-[#9a9a90] [stroke-width:2.2]"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search teams, cities, or names…"
                aria-label="Search experiences"
                className="h-auto rounded-none border-0 bg-transparent p-0 text-[15px] text-[#16160f] shadow-none placeholder:text-[#9a9a90] focus-visible:ring-0 md:text-[15px]"
              />
            </Label>
            {/* the wrapper lets the select fill its own row under 760px (old flex:1) */}
            <div className="max-[760px]:flex-1 max-[760px]:[&>div]:w-full">
              <NativeSelect
                value={sport}
                onChange={(e) => setSport(e.target.value)}
                aria-label="Filter by sport"
                className="h-auto min-h-[50px] cursor-pointer rounded-xl border-[#e6e6e0] bg-white py-0 pr-[38px] pl-4 text-[15px] font-bold text-[#16160f] shadow-none"
              >
                {(data ? data.sports : ['All Sports']).map((s) => <NativeSelectOption key={s} value={s}>{s}</NativeSelectOption>)}
              </NativeSelect>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-16">
        <div className={container}>
          {data === null && !err ? <div className={emptyCls}>Loading rankings…</div> : null}
          {err ? <div className={emptyCls}>{err}</div> : null}
          {data !== null && !err ? (
            <>
              <p className="mb-3 text-[13px] font-bold uppercase tracking-[.5px] text-[#8a8a82]">{list.length} {list.length === 1 ? 'experience' : 'experiences'}{sport !== 'All Sports' ? ` · ${sport}` : ''}</p>
              {list.length === 0 ? <div className={emptyCls}>No experiences match your search.</div> : (
                <div className="grid grid-cols-[1.05fr_1.5fr] items-stretch gap-5 max-[900px]:grid-cols-1">
                  {/* Leaderboard — hover or tap a row to load it into the spotlight */}
                  <div
                    className="max-h-[680px] overflow-y-auto rounded-xl border-2 border-[#16160f] bg-white [scrollbar-width:thin] max-[900px]:max-h-[480px]"
                    role="listbox"
                    aria-label="Experience rankings"
                  >
                    {list.map((e) => (
                      <Button
                        key={e.rank}
                        type="button"
                        role="option"
                        aria-selected={sel?.rank === e.rank}
                        variant="ghost"
                        onClick={() => setSelRank(e.rank)}
                        onMouseEnter={() => setSelRank(e.rank)}
                        className={cn(
                          'flex h-auto w-full cursor-pointer items-center justify-start gap-3 whitespace-normal rounded-none border-t-[1.5px] border-[#ecece4] px-3.5 py-2.5 text-left text-[16px] font-normal text-[#16160f] first:border-t-0 hover:text-[#16160f]',
                          sel?.rank === e.rank ? 'bg-brand hover:bg-brand' : 'bg-white hover:bg-[#fff7c9]',
                        )}
                      >
                        <span className={cn('w-10 flex-none font-display text-[18px]', sel?.rank === e.rank ? 'text-[#16160f]' : 'text-[#9a9a8e]')}>#{e.rank}</span>
                        <span className="flex min-w-0 flex-col">
                          <span className="text-[14px] font-extrabold">{e.name}</span>
                          <span className="text-[11px] font-bold uppercase tracking-[.4px] text-[#8a8a82]">{e.location}</span>
                        </span>
                        <span className="ml-auto flex-none font-display text-[17px]">{f1(e.final)}</span>
                      </Button>
                    ))}
                  </div>

                  {/* Spotlight — the selected experience with its venue photo */}
                  {sel ? (
                    <div className="sticky top-5 flex flex-col overflow-hidden rounded-xl border-2 border-[#16160f] bg-white shadow-[6px_6px_0_#16160f] max-[900px]:static max-[900px]:-order-1 max-[900px]:shadow-[4px_4px_0_#16160f]">
                      {/* mobile height comes from flex-basis (the global img{height:auto}
                          in styles.css is unlayered and would beat an h-[210px] utility) */}
                      {selImage
                        ? <img src={selImage} alt={sel.name} className="block h-auto min-h-[300px] w-full flex-[1_0_300px] border-b-2 border-[#16160f] object-cover max-[900px]:min-h-0 max-[900px]:flex-[0_0_210px]" />
                        : <div aria-hidden="true" className="min-h-[300px] w-full flex-[1_0_300px] border-b-2 border-[#16160f] bg-[repeating-linear-gradient(45deg,#f2f0e8_0_14px,#e8e6dc_14px_28px)] max-[900px]:h-[210px] max-[900px]:min-h-0 max-[900px]:flex-[0_0_210px]" />}
                      <div className="flex-none px-5 pt-[18px] pb-5">
                        <div className="font-display text-[28px] uppercase leading-[1.1] tracking-[.4px]">{sel.name}</div>
                        <div className="mt-1 mb-4 text-[13px] font-bold uppercase tracking-[.6px] text-[#8a8a82]">
                          #{sel.rank} in America · {sel.location} · {sel.sport}
                          {selVenue ? <> · {selVenue.name}</> : null}
                        </div>
                        {PILLARS.map((p) => (
                          <div key={p.key} className="mb-2.5">
                            <div className="mb-1 flex justify-between text-[11px] font-extrabold uppercase tracking-[.6px]"><span>{p.label}</span><span>{f1(sel[p.key])}</span></div>
                            <div className="h-3 overflow-hidden rounded-md border-[1.5px] border-[#16160f] bg-[#f0eee4]"><i className="block h-full border-r-[1.5px] border-[#16160f] bg-brand" style={{ width: `${sel[p.key] * 10}%` }} /></div>
                          </div>
                        ))}
                        {selVenue ? (
                          <Button asChild className="mt-3.5 h-auto rounded-full bg-[#16160f] px-[22px] py-[11px] text-[12px] font-extrabold uppercase tracking-[.6px] text-brand! hover:bg-black">
                            <Link to="/venue" search={{ id: selVenue.id }}>Plan this trip →</Link>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </>
          ) : null}
        </div>
      </section>

      <footer className="mt-2.5 border-t border-[#e6e6e0] py-6">
        <div className={cn(container, 'text-[13px] text-[#8a8a82]')}>© 2026 Snapback Sports · Experience Rankings. <Link to="/" className="font-bold text-[#8a7c00]!">← Home</Link></div>
      </footer>
    </div>
  )
}
