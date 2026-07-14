import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { SearchIcon, MapPinIcon, CalendarDaysIcon, TrophyIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { getJSON } from '../lib/dataCache'
import { FanScorePill, useFanScores } from './FanScore'
import { SPORTS, type League } from '../lib/sports'

// The explore search box — live grouped suggestions from /api/search (teams,
// venues, games, ranked experiences; all real D1/experiences.json rows).
// Self-contained Tailwind (was pages/searchbox.css); the `sbx-search` marker
// class stays so index.tsx's desktop max-width override still targets it.
const lic = 'h-[16px] w-[16px] text-[#55554c]'

interface TeamHit { league: League; id: string; abbr: string; displayName: string; location: string; logo?: string; venueName?: string }
interface VenueHit { id: string; name: string; city?: string; state?: string; image?: string; teams: { league: League; abbr: string; displayName: string }[] }
interface GameHit { league: League; id: string; name: string; shortName: string; date: string; state: string; venueName?: string; venueCity?: string }
interface ExpHit { rank: number; name: string; location: string; sport: string; final: number }
interface SearchData { teams: TeamHit[]; venues: VenueHit[]; games: GameHit[]; experiences: ExpHit[] }

interface Item {
  key: string
  group: 'Teams' | 'Venues' | 'Games' | 'Ranked experiences'
  icon: React.ReactNode
  title: string
  sub: string
  to: string
  search: Record<string, unknown>
  venueId?: string // venue hits carry their id so the row can show a fan score
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const gameWhen = (g: GameHit) => {
  if (g.state === 'in') return 'Live now'
  const d = new Date(g.date)
  const when = isNaN(d.getTime()) ? '' : `${MON[d.getMonth()]} ${d.getDate()}`
  return [when, g.venueName].filter(Boolean).join(' · ')
}

function toItems(d: SearchData): Item[] {
  const items: Item[] = []
  for (const t of d.teams) items.push({
    key: `t:${t.league}:${t.id}`, group: 'Teams',
    icon: t.logo ? <img className="h-[26px]! w-[26px] object-contain" src={t.logo} alt="" width={26} height={26} loading="lazy" /> : <span className="font-display text-[10px] text-[#111]">{t.abbr.slice(0, 3)}</span>,
    title: t.displayName,
    sub: [SPORTS[t.league].label, t.venueName].filter(Boolean).join(' · '),
    to: '/team', search: { league: t.league, id: t.id },
  })
  for (const v of d.venues) items.push({
    key: `v:${v.id}`, group: 'Venues',
    icon: <MapPinIcon className={lic} />,
    title: v.name,
    sub: [[v.city, v.state].filter(Boolean).join(', '), v.teams[0] ? `home of the ${v.teams[0].displayName}` : ''].filter(Boolean).join(' · '),
    to: '/venue', search: { id: v.id }, venueId: v.id,
  })
  for (const g of d.games) items.push({
    key: `g:${g.league}:${g.id}`, group: 'Games',
    icon: <CalendarDaysIcon className={lic} />,
    title: g.name || g.shortName,
    sub: [SPORTS[g.league].label, gameWhen(g)].filter(Boolean).join(' · '),
    to: '/game', search: { id: g.id, league: g.league },
  })
  for (const e of d.experiences) items.push({
    key: `e:${e.rank}`, group: 'Ranked experiences',
    icon: <TrophyIcon className={lic} />,
    title: e.name,
    sub: `Ranked #${e.rank} in America · ${e.final.toFixed(2)}`,
    to: '/rankings', search: { q: e.name },
  })
  return items
}

export function SearchBox({ placeholder = 'Search any team, venue, game or city…', autoFocus = false, size = 'md' }: { placeholder?: string; autoFocus?: boolean; size?: 'md' | 'lg' }) {
  const big = size === 'lg'
  const navigate = useNavigate()
  const fanScores = useFanScores()
  const wrapRef = useRef<HTMLDivElement>(null)
  const seqRef = useRef(0)
  const [q, setQ] = useState('')
  const [items, setItems] = useState<Item[] | null>(null) // null = nothing to show
  const [open, setOpen] = useState(false)
  const [idx, setIdx] = useState(-1)

  // Debounced fetch with a sequence guard so a slow earlier response can't
  // overwrite a newer one (getJSON dedupes identical queries).
  useEffect(() => {
    const needle = q.trim()
    if (needle.length < 2) { setItems(null); setIdx(-1); return }
    const seq = ++seqRef.current
    const t = setTimeout(() => {
      getJSON('/api/search?q=' + encodeURIComponent(needle) + '&limit=4')
        .then((r: any) => {
          if (seqRef.current !== seq) return
          setItems(r?.ok ? toItems(r.data as SearchData) : [])
          setIdx(-1)
        })
        .catch(() => { if (seqRef.current === seq) setItems([]) })
    }, 180)
    return () => clearTimeout(t)
  }, [q])

  // Tap/click outside closes the dropdown.
  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('touchstart', onDown) }
  }, [])

  const groups = useMemo(() => {
    if (!items) return []
    const order: Item['group'][] = ['Teams', 'Venues', 'Games', 'Ranked experiences']
    return order.map((g) => ({ g, rows: items.filter((i) => i.group === g) })).filter((x) => x.rows.length)
  }, [items])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!items || !items.length) { if (e.key === 'Escape') setOpen(false); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, items.length - 1)); setOpen(true) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && idx >= 0 && items[idx]) {
      e.preventDefault(); setOpen(false)
      navigate({ to: items[idx].to, search: items[idx].search as any })
    } else if (e.key === 'Escape') setOpen(false)
  }

  const showSugg = open && q.trim().length >= 2 && items !== null
  let flat = -1

  return (
    <div className="sbx-search relative max-w-[640px] text-left" ref={wrapRef}>
      <div className={cn('flex items-center border-[3px] border-[#222222] bg-white',
        big ? 'gap-3.5 px-[26px] py-[22px] shadow-[8px_8px_0_0_#222222]' : 'gap-[10px] px-[15px] py-[13px] shadow-[5px_5px_0_0_#222222]',
        showSugg && groups.length
          ? (big ? 'rounded-[16px_16px_0_0]' : 'rounded-[10px_10px_0_0]')
          : (big ? 'rounded-[16px]' : 'rounded-[10px]'))}>
        <SearchIcon className={cn('flex-none text-[#141410] opacity-65', big ? 'h-[26px] w-[26px]' : 'h-[18px] w-[18px]')} />
        <Input
          type="search"
          value={q}
          placeholder={placeholder}
          autoComplete="off"
          autoFocus={autoFocus}
          aria-label="Search"
          className={cn('h-auto w-full border-0 bg-transparent p-0 font-semibold text-[#141410] shadow-none placeholder:font-medium placeholder:text-[#9a9a9a] focus-visible:ring-0', big ? 'text-[21px] md:text-[21px]' : 'text-[16px] md:text-[16px]')}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
      </div>
      {showSugg ? (
        <div className={cn('absolute top-full right-0 left-0 z-[60] max-h-[400px] overflow-y-auto border-[3px] border-t-0 border-[#222222] bg-white shadow-[5px_8px_0_0_#222222]', big ? 'rounded-[0_0_16px_16px]' : 'rounded-[0_0_10px_10px]')} role="listbox">
          {groups.length ? groups.map(({ g, rows }) => (
            <div key={g}>
              <div className="border-t border-[#eeede6] bg-[#fbf7dd] px-[15px] py-[6px] text-[10px] font-extrabold uppercase tracking-[1px] text-[#8a8a00]">{g}</div>
              {rows.map((it) => {
                flat++
                const on = flat === idx
                return (
                  <Link
                    key={it.key}
                    to={it.to}
                    search={it.search as any}
                    className={'flex cursor-pointer items-center gap-[11px] border-t border-[#f0efe8] px-[15px] py-[11px] hover:bg-[#fdf6c8]' + (on ? ' bg-[#fdf6c8]' : '')}
                    onClick={() => setOpen(false)}
                  >
                    <span className="flex h-[30px] w-[30px] flex-[0_0_auto] items-center justify-center overflow-hidden rounded-[8px] bg-[#f2f1ea]">{it.icon}</span>
                    <span className="flex min-w-0 flex-col">
                      <span className="overflow-hidden text-[13.5px] font-extrabold leading-[1.2] text-ellipsis whitespace-nowrap text-[#141410]">{it.title}</span>
                      <span className="mt-[1px] overflow-hidden text-[11.5px] font-semibold text-ellipsis whitespace-nowrap text-[#76766c]">{it.sub}</span>
                    </span>
                    {it.venueId ? <FanScorePill stat={fanScores?.[it.venueId]} className="ml-auto flex-none" /> : null}
                    <span className={cn('flex-[0_0_auto] font-display text-[15px] text-[#111]', it.venueId ? 'ml-[10px]' : 'ml-auto')}>→</span>
                  </Link>
                )
              })}
            </div>
          )) : (
            <div className="px-[15px] py-[14px] text-[13.5px] font-semibold text-[#76766c]">Nothing found for “{q.trim()}”.</div>
          )}
        </div>
      ) : null}
    </div>
  )
}
