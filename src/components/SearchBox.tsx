import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { SearchIcon, MapPinIcon, CalendarDaysIcon, TrophyIcon } from 'lucide-react'
import { getJSON } from '../lib/dataCache'
import { SPORTS, type League } from '../lib/sports'

// The explore search box — live grouped suggestions from /api/search (teams,
// venues, games, ranked experiences; all real D1/experiences.json rows).
// Styled by pages/searchbox.css (multi-route stylesheet, id "home venues").

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
    icon: t.logo ? <img src={t.logo} alt="" width={26} height={26} loading="lazy" /> : <span className="abbr">{t.abbr.slice(0, 3)}</span>,
    title: t.displayName,
    sub: [SPORTS[t.league].label, t.venueName].filter(Boolean).join(' · '),
    to: '/team', search: { league: t.league, id: t.id },
  })
  for (const v of d.venues) items.push({
    key: `v:${v.id}`, group: 'Venues',
    icon: <MapPinIcon className="lic" />,
    title: v.name,
    sub: [[v.city, v.state].filter(Boolean).join(', '), v.teams[0] ? `home of the ${v.teams[0].displayName}` : ''].filter(Boolean).join(' · '),
    to: '/venue', search: { id: v.id },
  })
  for (const g of d.games) items.push({
    key: `g:${g.league}:${g.id}`, group: 'Games',
    icon: <CalendarDaysIcon className="lic" />,
    title: g.name || g.shortName,
    sub: [SPORTS[g.league].label, gameWhen(g)].filter(Boolean).join(' · '),
    to: '/game', search: { id: g.id, league: g.league },
  })
  for (const e of d.experiences) items.push({
    key: `e:${e.rank}`, group: 'Ranked experiences',
    icon: <TrophyIcon className="lic" />,
    title: e.name,
    sub: `Ranked #${e.rank} in America · ${e.final.toFixed(2)}`,
    to: '/rankings', search: { q: e.name },
  })
  return items
}

export function SearchBox({ placeholder = 'Search any team, venue, game or city…', autoFocus = false }: { placeholder?: string; autoFocus?: boolean }) {
  const navigate = useNavigate()
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
    <div className="sbx-search" ref={wrapRef}>
      <div className={'sbx-box' + (showSugg && groups.length ? ' open' : '')}>
        <SearchIcon className="sbx-si" />
        <input
          type="search"
          value={q}
          placeholder={placeholder}
          autoComplete="off"
          autoFocus={autoFocus}
          aria-label="Search"
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
      </div>
      {showSugg ? (
        <div className="sbx-sugg" role="listbox">
          {groups.length ? groups.map(({ g, rows }) => (
            <div key={g}>
              <div className="sbx-glab">{g}</div>
              {rows.map((it) => {
                flat++
                const on = flat === idx
                return (
                  <Link
                    key={it.key}
                    to={it.to}
                    search={it.search as any}
                    className={'sbx-row' + (on ? ' on' : '')}
                    onClick={() => setOpen(false)}
                  >
                    <span className="sbx-ic">{it.icon}</span>
                    <span className="sbx-m"><span className="t">{it.title}</span><span className="d">{it.sub}</span></span>
                    <span className="sbx-go">→</span>
                  </Link>
                )
              })}
            </div>
          )) : (
            <div className="sbx-empty">Nothing found for “{q.trim()}”.</div>
          )}
        </div>
      ) : null}
    </div>
  )
}
