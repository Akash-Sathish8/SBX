import { useEffect, useMemo, useRef, useState } from 'react'
import { containerWide as container } from '../lib/ui'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { SearchIcon } from 'lucide-react'
import { SiteNav } from '../components/SiteNav'
import { PageCssGuard } from '../components/PageCssGuard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { getJSON } from '../lib/dataCache'
import { SPORTS, RANKABLE_LEAGUES, type League } from '../lib/sports'
import type { Game, TeamInfo } from '../lib/espn'
import { avgPillars as avg } from '../lib/pillars'
import { RatePanel } from '../components/RatePanel'
import { useAuth } from '../components/auth/AuthProvider'
import { SaveRankingsPrompt } from '../components/auth/SaveRankingsPrompt'
import { ContributePrompt } from '../components/ContributePrompt'
import { BallotShareCard, type BallotCardRow } from '../components/BallotShareCard'
import { ShareCardModal } from '../components/ShareCardModal'

// "Make your rankings" — a fan ranks the games they ACTUALLY went to. Pick the
// team, pick the date you attended (from the seeded 2025–2026 season in D1), then
// score the experience on the same four pillars the experts use (fans, food,
// uniqueness, stadium). Your list is the personal mirror of /rankings. Ratings
// are the user's own input — nothing here is fabricated — and the list persists
// locally, and once signed in it syncs to D1 so it follows you across devices.

export const Route = createFileRoute('/rank')({
  // `?edit=<gameId>` deep-links straight into the pre-filled rate panel for a
  // game already on the ballot (the profile Diary rows land here).
  validateSearch: (s: Record<string, unknown>) => {
    const out: { edit?: string } = {}
    if (s.edit != null && String(s.edit).trim()) out.edit = String(s.edit)
    return out
  },
  head: () => ({
    meta: [{ title: 'Snapback · Make your rankings' }],
  }),
  component: RankPage,
})

// The old .container: full-bleed with the clamped gutters every section shares.
// The old .btn: notched ticket-corner CTA cut with clip-path, hard drop shadow
// that presses flat on :active. Layered onto <Button variant="secondary"> so the
// bg/hover-bg get pinned explicitly per call site (gray or brand yellow).
const notchBtn =
  'relative h-auto cursor-pointer gap-2 rounded-none border-0 px-[22px] py-[11px] text-[14px] font-bold uppercase tracking-[.8px] text-ink-soft [clip-path:polygon(calc(100%_-_10px)_0px,100%_10px,100%_100%,10px_100%,0px_calc(100%_-_10px),0px_0px)] [filter:drop-shadow(5px_5px_0_#222222)] transition-[translate,filter] duration-[80ms,120ms] ease-[ease] hover:[filter:drop-shadow(5px_5px_0_#222222)_brightness(1.04)] active:translate-x-[3px] active:translate-y-[3px] active:[filter:drop-shadow(2px_2px_0_#222222)]'
// .rk-loading / .rk-empty
const loadingCls = 'px-[2px] py-[34px] font-semibold text-muted'
const emptyCls = 'px-[2px] py-[18px] text-[15px] font-semibold text-muted'
// .rk-add / .rk-ahead / .rk-ahead h2 / .rk-x — the white add-flow panel shell
const panelCls =
  'rounded-[10px] border-[5px] border-ink-soft bg-white px-6 pt-[22px] pb-[26px] shadow-[8px_8px_0_0_#222222]'
const panelHeadCls = 'mb-[6px] flex items-center justify-between gap-[14px]'
const panelH2Cls = 'mb-0 font-display text-[24px] uppercase leading-none tracking-[1px] text-ink-soft'
const closeBtnCls =
  'h-auto cursor-pointer rounded-md border-2 border-[#111] bg-transparent px-3 py-[6px] text-[12px] font-extrabold uppercase tracking-[.4px] text-[#111] shadow-none hover:bg-brand hover:text-[#111]'
// .rk-backlink
const backlinkCls =
  'mb-[10px] h-auto cursor-pointer rounded-none border-0 bg-transparent p-0 text-[13px] font-bold uppercase tracking-[.4px] text-muted hover:bg-transparent hover:text-[#111]'
// .rk-step
const stepCls = 'mt-2 mb-4 text-[13px] font-bold uppercase tracking-[.4px] text-muted'
// Shared hover for the tappable cards (.rk-row.clickable / .rk-team / .rk-game)
const cardHover =
  'transition-[box-shadow,translate] duration-[120ms] ease-[ease] hover:-translate-x-px hover:-translate-y-px'
// Sport filter chip on the rankings header — pill, brand-yellow when active.
const sportChip = (on: boolean) => cn(
  'h-auto cursor-pointer rounded-full border-2 border-[#111] bg-white px-[15px] py-[6px] font-sans text-[13px] font-bold uppercase tracking-[.4px] text-[#111] shadow-none hover:bg-white hover:text-[#111]',
  on && 'bg-brand hover:bg-brand',
)

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : `${WD[d.getDay()]} ${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}
const teamShort = (g: Game, side: 'home' | 'away') => g[side].location || g[side].displayName

// One game the user has ranked. A flat snapshot so the list renders without a
// refetch and survives across seasons even if a game later drops out of a query.
interface MyRank {
  gameId: string
  league: League
  away: string
  home: string
  awayLogo?: string
  homeLogo?: string
  date: string
  venue: string
  venueId?: string // the game's venue id — fan scores aggregate by this
  city?: string
  fans: number
  food: number
  unique: number
  stadium: number
  score: number
  ts: number
}

const STORE_KEY = 'sbx:my-rankings:v1'

function loadMine(): MyRank[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORE_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}
function saveMine(list: MyRank[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(list))
  } catch {
    /* private mode / quota — list still lives in memory for the session */
  }
}

// Merge two ranking lists by gameId; the latest rating (higher ts) wins, sorted
// by score. Reconciles this device's localStorage with the account's server list.
function mergeRankings(a: MyRank[], b: MyRank[]): MyRank[] {
  const byId = new Map<string, MyRank>()
  for (const r of [...a, ...b]) {
    const cur = byId.get(r.gameId)
    if (!cur || r.ts >= cur.ts) byId.set(r.gameId, r)
  }
  return [...byId.values()].sort((x, y) => y.score - x.score)
}

// Save-prompt cadence (signed-out only): show after the 1st ranking, then every
// PROMPT_EVERY-th. `count` will also include reviews once UGC ships.
const PROMPT_KEY = 'sbx:save-prompt:v1'
const PROMPT_EVERY = 3
interface PromptState { count: number; lastShownAt: number }
function loadPrompt(): PromptState {
  if (typeof window === 'undefined') return { count: 0, lastShownAt: 0 }
  try {
    const p = JSON.parse(window.localStorage.getItem(PROMPT_KEY) || 'null')
    return p && typeof p.count === 'number' ? { count: p.count, lastShownAt: p.lastShownAt ?? 0 } : { count: 0, lastShownAt: 0 }
  } catch {
    return { count: 0, lastShownAt: 0 }
  }
}
function savePrompt(p: PromptState) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(PROMPT_KEY, JSON.stringify(p)) } catch { /* ignore */ }
}

function RankPage() {
  const { user, openAuth } = useAuth()
  const navigate = useNavigate()
  const { edit: editParam } = Route.useSearch()
  const [mine, setMine] = useState<MyRank[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [adding, setAdding] = useState(false)
  const [prompt, setPrompt] = useState(false)
  const [contribute, setContribute] = useState<MyRank | null>(null)
  // Share: null = idle; otherwise the ShareCardModal renders this payload and
  // handles the rasterise / native-sheet / copy / download flow.
  const [share, setShare] = useState<{ rows: BallotCardRow[]; total: number; title?: string; filename: string } | null>(null)
  // Edit: re-open the rate panel for a game already on the ballot.
  const [editing, setEditing] = useState<{ r: MyRank; g: Game } | null>(null)
  const [editErr, setEditErr] = useState<string | null>(null)
  const [sportFilter, setSportFilter] = useState<'all' | League>('all')

  // Load once on the client (localStorage is unavailable during SSR).
  useEffect(() => {
    setMine(loadMine())
    setHydrated(true)
  }, [])

  // Signed in: merge this device's list with the account's (latest rating wins),
  // adopt it, and settle the server to match — makes rankings saved + cross-device.
  useEffect(() => {
    if (!hydrated || !user) return
    let alive = true
    ;(async () => {
      try {
        const local = loadMine()
        const res = await fetch('/api/rankings')
        const j = await res.json().catch(() => null)
        const server: MyRank[] = j?.ok && Array.isArray(j.data) ? j.data : []
        const merged = mergeRankings(local, server)
        if (!alive) return
        setMine(merged)
        saveMine(merged)
        fetch('/api/rankings', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ rankings: merged }),
        }).catch(() => {})
        setPrompt(false)
      } catch {
        /* offline — keep the local list */
      }
    })()
    return () => { alive = false }
  }, [hydrated, user])

  const persist = (next: MyRank[]) => {
    setMine(next)
    saveMine(next)
  }
  const remove = (id: string) => {
    persist(mine.filter((m) => m.gameId !== id))
    if (user) fetch('/api/rankings?gameId=' + encodeURIComponent(id), { method: 'DELETE' }).catch(() => {})
  }
  const upsert = (r: MyRank, opts?: { quiet?: boolean; venueId?: string }) => {
    const isNew = !mine.some((m) => m.gameId === r.gameId)
    persist([...mine.filter((m) => m.gameId !== r.gameId), r].sort((a, b) => b.score - a.score))
    setAdding(false)
    if (opts?.quiet) {
      // Re-rating an existing entry: sync the server, skip the tip handoff.
      if (user) {
        fetch('/api/rankings', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ rankings: [r] }),
        }).catch(() => {})
      }
      return
    }
    if (user) {
      fetch('/api/rankings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rankings: [r] }),
      }).catch(() => {})
      // Drop them on that venue's page (scrolled to the tips + reviews section,
      // nothing force-opened) so they can leave a tip / write a review. Prefer the
      // rated game's real venue id; fall back to a name-match, then the inline nudge.
      if (opts?.venueId) {
        navigate({ to: '/venue', search: { id: opts.venueId, intel: 1 } })
      } else {
        getJSON('/api/venues')
          .then((res: any) => {
            const match = (Array.isArray(res?.data) ? res.data : []).find((v: any) => v.name === r.venue)
            if (match) navigate({ to: '/venue', search: { id: match.id, intel: 1 } })
            else setContribute(r)
          })
          .catch(() => setContribute(r))
      }
    } else if (isNew) {
      // Nudge to save: the first ranking, then every few after that.
      const p = loadPrompt()
      const count = p.count + 1
      const show = count === 1 || count - p.lastShownAt >= PROMPT_EVERY
      savePrompt({ count, lastShownAt: show ? count : p.lastShownAt })
      if (show) setPrompt(true)
    }
  }

  const ranked = useMemo(() => [...mine].sort((a, b) => b.score - a.score), [mine])
  // Sports the fan has actually ranked, in the canonical league order — the chips.
  const sportsPresent = useMemo(
    () => RANKABLE_LEAGUES.filter((l) => mine.some((r) => r.league === l)),
    [mine],
  )
  // The rankings shown/shared: all, or filtered to one sport (a per-sport leaderboard).
  const shown = useMemo(
    () => (sportFilter === 'all' ? ranked : ranked.filter((r) => r.league === sportFilter)),
    [ranked, sportFilter],
  )
  // Reset the filter if the fan deletes their last game in that sport.
  useEffect(() => {
    if (sportFilter !== 'all' && !sportsPresent.includes(sportFilter)) setSportFilter('all')
  }, [sportsPresent, sportFilter])

  const toCardRow = (r: MyRank): BallotCardRow => ({
    away: r.away, home: r.home, awayLogo: r.awayLogo, homeLogo: r.homeLogo,
    venue: r.venue, league: SPORTS[r.league]?.label ?? '', date: r.date, score: r.score,
  })
  const shareBallot = () =>
    setShare({
      rows: shown.map(toCardRow),
      total: shown.length,
      title: sportFilter === 'all' ? 'My Gameday Ballot' : `My ${SPORTS[sportFilter].label} Ballot`,
      filename: sportFilter === 'all' ? 'snapback-rankings.png' : `snapback-rankings-${sportFilter}.png`,
    })
  const shareOne = (r: MyRank) =>
    setShare({ rows: [toCardRow(r)], total: 1, title: 'My Gameday Rating', filename: `snapback-rating-${r.gameId}.png` })

  // Deep link (?edit=<gameId>) from the profile Diary: open that game's edit
  // panel once the ballot has hydrated. Consumed at most once per visit.
  const editConsumed = useRef(false)
  useEffect(() => {
    if (!hydrated || !editParam || editConsumed.current) return
    const r = mine.find((m) => m.gameId === editParam)
    if (r) { editConsumed.current = true; startEdit(r) }
  }, [hydrated, editParam, mine]) // eslint-disable-line react-hooks/exhaustive-deps

  // Row click -> re-open the rate panel, pre-filled. The panel needs the real
  // Game (benchmarks resolve from it), so fetch it by id first.
  const startEdit = (r: MyRank) => {
    setEditErr(null)
    getJSON('/api/games?id=' + encodeURIComponent(r.gameId) + '&league=' + r.league)
      .then((res: any) => {
        const g = (Array.isArray(res?.data) ? res.data : []).find((x: Game) => x.id === r.gameId)
        if (g) { setEditing({ r, g }); setAdding(false) }
        else setEditErr("Couldn't load that game to re-rate it.")
      })
      .catch(() => setEditErr("Couldn't load that game to re-rate it."))
  }
  // Show the picker up front when the list is empty; otherwise it's behind "Add".
  const showAdd = adding || (hydrated && mine.length === 0)

  return (
    <div className="min-h-screen bg-[#f4f4f4] font-sans text-[#33352f]">
      <PageCssGuard id="rank" />
      <SiteNav />
      {/* dark hero header with the faint 32px grid overlay */}
      <section className="relative overflow-hidden bg-ink-soft pt-10 pb-9 text-white after:pointer-events-none after:absolute after:inset-0 after:content-[''] after:[background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] after:[background-size:32px_32px]">
        <div className={cn(container, 'relative z-[1]')}>
          <div className="mb-[14px] inline-flex items-center gap-[9px] rounded-[3px] bg-brand px-[13px] py-[6px] text-[12px] font-bold uppercase tracking-[1.2px] text-[#111] shadow-[4px_4px_0_#000]">Your ballot · score the games you went to</div>
          <h1 className="font-display text-[clamp(30px,7vw,72px)] uppercase leading-none tracking-[1px] text-white">Make your <span className="inline-block bg-brand px-[10px] text-[#111] shadow-[5px_5px_0_#000]">rankings</span></h1>
        </div>
      </section>

      <section className="pt-10 pb-16">
        <div className={container}>
          {contribute ? (
            <ContributePrompt r={contribute} onDismiss={() => setContribute(null)} />
          ) : null}

          {prompt && !user ? (
            <SaveRankingsPrompt onCreate={() => openAuth('register')} onDismiss={() => setPrompt(false)} />
          ) : null}

          {/* The "Add a game" picker opens above your existing rankings, not below them. */}
          {showAdd ? (
            <div className="mb-[34px]">
              <AddFlow
                onSave={upsert}
                onClose={ranked.length > 0 ? () => setAdding(false) : undefined}
                existing={new Set(mine.map((m) => m.gameId))}
              />
            </div>
          ) : null}

          {ranked.length > 0 ? (
            <div className="mb-[34px]">
              <div className="mb-[18px] flex flex-wrap items-center justify-between gap-4">
                <h2 className="mb-0 flex items-center gap-3 font-display text-[28px] uppercase leading-none tracking-[1px] text-ink-soft">
                  Your rankings
                  <Badge className="rounded-[20px] border-2 border-[#111] bg-brand px-[11px] py-[2px] font-sans text-[14px] font-extrabold tracking-normal text-[#111]">{shown.length}</Badge>
                </h2>
                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" className={cn(notchBtn, 'bg-[#f4f4f4] hover:bg-[#f4f4f4]')} onClick={shareBallot}>↓ Share my rankings</Button>
                  {!showAdd ? (
                    <Button variant="secondary" className={cn(notchBtn, 'bg-brand text-[#111] hover:bg-brand')} onClick={() => setAdding(true)}>+ Add a game</Button>
                  ) : null}
                </div>
              </div>
              {sportsPresent.length > 1 ? (
                <div className="mb-[18px] flex flex-wrap gap-2">
                  <Button type="button" variant="outline" aria-pressed={sportFilter === 'all'} onClick={() => setSportFilter('all')} className={sportChip(sportFilter === 'all')}>All <b className="ml-[5px] font-display text-[15px]">{ranked.length}</b></Button>
                  {sportsPresent.map((l) => (
                    <Button key={l} type="button" variant="outline" aria-pressed={sportFilter === l} onClick={() => setSportFilter(l)} className={sportChip(sportFilter === l)}>{SPORTS[l].label} <b className="ml-[5px] font-display text-[15px]">{mine.filter((r) => r.league === l).length}</b></Button>
                  ))}
                </div>
              ) : null}
              {editErr ? <div className={emptyCls}>{editErr}</div> : null}
              <div className="flex flex-col gap-3">
                {shown.map((r, i) => (
                  <YourRow
                    key={r.gameId}
                    r={r}
                    place={i + 1}
                    onEdit={() => startEdit(r)}
                    onShare={() => shareOne(r)}
                    onRemove={() => remove(r.gameId)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {editing ? (
            <div className={panelCls}>
              <div className={panelHeadCls}>
                <h2 className={panelH2Cls}>Update your rating</h2>
                <Button variant="outline" className={closeBtnCls} aria-label="Close" onClick={() => setEditing(null)}>Done</Button>
              </div>
              <RatePanel
                game={editing.g}
                initial={{ fans: editing.r.fans, food: editing.r.food, unique: editing.r.unique, stadium: editing.r.stadium }}
                backLabel="← Cancel"
                onBack={() => setEditing(null)}
                onSave={(scores) => {
                  // Quiet upsert (syncs, no prompt), then send them to that venue's
                  // page — updating a rating counts as rating the game.
                  upsert({ ...editing.r, ...scores, venueId: editing.g.venue.id ?? editing.r.venueId, score: avg(scores), ts: Date.now() }, { quiet: true })
                  setEditing(null)
                  if (editing.g.venue.id) navigate({ to: '/venue', search: { id: editing.g.venue.id, intel: 1 } })
                }}
              />
            </div>
          ) : null}

          {!hydrated ? <div className={loadingCls}>Loading your rankings…</div> : null}
        </div>
      </section>

      {share ? (
        <ShareCardModal
          filename={share.filename}
          title="Snapback"
          text="My gameday rankings on Snapback"
          onClose={() => setShare(null)}
        >
          <BallotShareCard rows={share.rows} total={share.total} title={share.title} handle={user?.username ?? null} />
        </ShareCardModal>
      ) : null}

      <footer className="mt-[10px] bg-black py-9 text-[13px] text-[#888]">
        <div className={container}>
          {/* ! beats the unlayered global a{color:inherit} in styles.css */}
          © 2026 Snapback Sports · {user ? 'Saved to your account.' : 'Your rankings live on this device.'} <Link to="/rankings" className="font-bold text-brand!">See the expert rankings →</Link>
        </div>
      </footer>
    </div>
  )
}

// .rk-logo — 26px square team mark (h! beats the unlayered img{height:auto} in styles.css)
function Logo({ src }: { src?: string }) {
  return src
    ? <img className="h-[26px]! w-[26px] flex-none object-contain" src={src} alt="" width={26} height={26} loading="lazy" />
    : <span className="h-[26px] w-[26px] flex-none rounded-full bg-[#eee]" aria-hidden="true" />
}

function YourRow({ r, place, onEdit, onShare, onRemove }: { r: MyRank; place: number; onEdit: () => void; onShare: () => void; onRemove: () => void }) {
  return (
    <div
      className={cn(
        'grid cursor-pointer grid-cols-[auto_1fr_auto_auto_auto] items-center gap-[14px] rounded-lg border-[3px] border-ink-soft bg-white px-[18px] py-[14px] shadow-[6px_6px_0_0_#222222] hover:shadow-[8px_8px_0_0_#f7df02] max-[640px]:grid-cols-[auto_1fr_auto] max-[640px]:gap-[10px] max-[640px]:px-3 max-[640px]:py-3',
        cardHover,
      )}
      role="button" tabIndex={0} title="Update your rating"
      onClick={onEdit}
      onKeyDown={(e) => { if (e.key === 'Enter') onEdit() }}>
      <span className="min-w-[42px] font-display text-[26px] text-[#111] max-[640px]:min-w-[30px] max-[640px]:text-[21px]">#{place}</span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-[18px] font-extrabold leading-[1.15] text-ink-soft max-[640px]:text-[16px]">
          <Logo src={r.awayLogo} />
          <span className="font-extrabold">{r.away}</span>
          <span className="text-[13px] font-bold text-muted">@</span>
          <Logo src={r.homeLogo} />
          <span className="font-extrabold">{r.home}</span>
        </div>
        <div className="mt-[5px] text-[12.5px] font-semibold uppercase tracking-[.3px] text-muted">
          {SPORTS[r.league].label} · {r.venue}{r.city ? ' · ' + r.city : ''} · {fmtDate(r.date)} · <span className="font-extrabold text-gold">edit rating</span>
        </div>
      </div>
      <Button
        variant="outline"
        className="h-auto cursor-pointer rounded-full border-2 border-[#111] bg-white px-[14px] py-[7px] text-[11.5px] font-extrabold uppercase tracking-[.5px] text-[#111] shadow-none hover:bg-brand hover:text-[#111] max-[640px]:col-start-2 max-[640px]:row-start-3 max-[640px]:mt-[2px] max-[640px]:justify-self-start"
        aria-label="Share this rating" onClick={(e) => { e.stopPropagation(); onShare() }}>↓ Share</Button>
      <div className="flex min-w-[74px] flex-col items-center justify-center rounded-[7px] bg-ink-soft px-[14px] py-2 text-white max-[640px]:col-start-2 max-[640px]:row-start-2 max-[640px]:min-w-0 max-[640px]:flex-row max-[640px]:gap-[7px] max-[640px]:self-start max-[640px]:px-[10px] max-[640px]:py-[5px]">
        <span className="font-display text-[24px] leading-none text-brand max-[640px]:text-[18px]">{r.score.toFixed(1)}</span>
        <span className="mt-[3px] text-[9px] font-bold uppercase tracking-[.5px] text-[#cfcfcf] max-[640px]:mt-0">your score</span>
      </div>
      <Button
        variant="ghost"
        className="h-auto cursor-pointer rounded-none border-0 bg-transparent px-1 py-0 text-[26px] font-normal leading-none text-[#bbb] hover:bg-transparent hover:text-danger max-[640px]:col-start-3 max-[640px]:row-start-1 max-[640px]:self-start"
        aria-label="Remove from your rankings" onClick={(e) => { e.stopPropagation(); onRemove() }}>×</Button>
    </div>
  )
}

// ---- Add flow: league + team → game → rate ----------------------------------

function AddFlow({ onSave, onClose, existing }: { onSave: (r: MyRank, opts?: { venueId?: string }) => void; onClose?: () => void; existing: Set<string> }) {
  const [league, setLeague] = useState<League>('mlb')
  const [team, setTeam] = useState<TeamInfo | null>(null)
  const [picked, setPicked] = useState<Game | null>(null)

  // Reset deeper selections when the user steps back up the funnel.
  const pickLeague = (l: League) => { setLeague(l); setTeam(null); setPicked(null) }
  const pickTeam = (t: TeamInfo | null) => { setTeam(t); setPicked(null) }

  return (
    <div className={panelCls}>
      <div className={panelHeadCls}>
        <h2 className={panelH2Cls}>{picked ? 'Rate your experience' : team ? 'Which game?' : 'Add a game you went to'}</h2>
        {onClose ? <Button variant="outline" className={closeBtnCls} aria-label="Close" onClick={onClose}>Done</Button> : null}
      </div>

      {picked ? (
        <RatePanel
          game={picked}
          onBack={() => setPicked(null)}
          onSave={(scores) =>
            onSave({
              gameId: picked.id,
              league: picked.league,
              away: teamShort(picked, 'away'),
              home: teamShort(picked, 'home'),
              awayLogo: picked.away.logo,
              homeLogo: picked.home.logo,
              date: picked.date,
              venue: picked.venue.name || '',
              venueId: picked.venue.id, // fan scores aggregate by venue id
              city: picked.venue.city,
              ...scores,
              score: avg(scores),
              ts: Date.now(),
              // Pass the rated game's real venue id so the post-rate handoff can
              // link straight to /venue?id=… (no fragile venue-name match).
            }, { venueId: picked.venue.id })
          }
        />
      ) : team ? (
        <GamePicker league={league} team={team} existing={existing} onBack={() => pickTeam(null)} onPick={setPicked} />
      ) : (
        <TeamPicker league={league} onLeague={pickLeague} onPick={pickTeam} />
      )}
    </div>
  )
}

function LeagueTabs({ league, onLeague }: { league: League; onLeague: (l: League) => void }) {
  return (
    <div className="mb-[14px] flex flex-wrap gap-[10px]">
      {RANKABLE_LEAGUES.map((l) => (
        <Button
          key={l}
          variant="outline"
          className={cn(
            'h-auto cursor-pointer rounded-none border-2 border-[#111] px-4 py-2 text-[13px] font-extrabold uppercase tracking-[.4px] text-[#111] shadow-none hover:text-[#111]',
            l === league ? 'bg-brand hover:bg-brand' : 'bg-white hover:bg-white',
          )}
          onClick={() => onLeague(l)}
        >{SPORTS[l].label}</Button>
      ))}
    </div>
  )
}

function TeamPicker({ league, onLeague, onPick }: { league: League; onLeague: (l: League) => void; onPick: (t: TeamInfo) => void }) {
  const [teams, setTeams] = useState<TeamInfo[] | null>(null)
  const [err, setErr] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => {
    let alive = true
    setTeams(null); setErr(false)
    getJSON('/api/teams?league=' + league)
      .then((r: any) => { if (alive) setTeams(Array.isArray(r?.data) ? r.data : []) })
      .catch(() => { if (alive) setErr(true) })
    return () => { alive = false }
  }, [league])

  const ql = q.trim().toLowerCase()
  const list = useMemo(
    () => (teams ? teams.filter((t) => !ql || (t.displayName + ' ' + t.location + ' ' + t.abbr).toLowerCase().includes(ql)) : []),
    [teams, ql],
  )

  return (
    <>
      <p className={stepCls}>Step 1 · Which team did you go see?</p>
      <LeagueTabs league={league} onLeague={onLeague} />
      <Label className="mb-[18px] flex items-center gap-[9px] rounded-md border-[3px] border-ink-soft bg-white px-[14px] py-[9px] font-normal leading-normal shadow-[4px_4px_0_0_#222222]">
        <SearchIcon className="h-4 w-4 flex-none text-ink-soft opacity-70" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a team…"
          aria-label="Search teams"
          className="h-auto w-full rounded-none border-0 bg-transparent p-0 text-[16px] font-semibold text-ink-soft shadow-none placeholder:font-medium placeholder:text-[#9a9a9a] focus-visible:ring-0 md:text-[16px]"
        />
      </Label>
      {teams === null && !err ? <div className={loadingCls}>Loading teams…</div> : null}
      {err ? <div className={emptyCls}>Couldn't load teams. Try again.</div> : null}
      {teams !== null && !err ? (
        <div className="grid grid-cols-2 gap-[10px] min-[640px]:grid-cols-3 min-[960px]:grid-cols-4">
          {list.map((t) => (
            <Button
              key={t.id}
              variant="outline"
              className={cn(
                'h-auto cursor-pointer items-center justify-start gap-[10px] whitespace-normal rounded-lg border-[2.5px] border-ink-soft bg-white px-3 py-[11px] text-left shadow-[4px_4px_0_0_#222222] hover:bg-white hover:shadow-[6px_6px_0_0_#f7df02]',
                cardHover,
              )}
              onClick={() => onPick(t)}
            >
              {t.logo
                ? <img className="h-[34px]! w-[34px] flex-none object-contain" src={t.logo} alt="" width={34} height={34} loading="lazy" />
                : <span className="h-[34px] w-[34px] flex-none rounded-full bg-[#eee]" aria-hidden="true" />}
              <span className="text-[14px] font-extrabold leading-[1.1] text-ink-soft">{t.displayName}</span>
            </Button>
          ))}
          {list.length === 0 ? <div className={emptyCls}>No teams match “{q.trim()}”.</div> : null}
        </div>
      ) : null}
    </>
  )
}

function GamePicker({ league, team, existing, onBack, onPick }: { league: League; team: TeamInfo; existing: Set<string>; onBack: () => void; onPick: (g: Game) => void }) {
  const [games, setGames] = useState<Game[] | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    let alive = true
    setGames(null); setErr(false)
    getJSON('/api/games?league=' + league + '&team=' + encodeURIComponent(team.abbr) + '&limit=400')
      .then((r: any) => { if (alive) setGames(Array.isArray(r?.data) ? r.data : []) })
      .catch(() => { if (alive) setErr(true) })
    return () => { alive = false }
  }, [league, team.abbr])

  // You can only have attended a game that was actually PLAYED. `state==='post'`
  // is the reliable signal — date alone lets through games seeded on the schedule
  // but not yet played (they'd show a misleading 0–0). Most-recent first.
  const past = useMemo(
    () => (games || []).filter((g) => g.state === 'post').sort((a, b) => b.date.localeCompare(a.date)),
    [games],
  )

  return (
    <>
      <Button variant="ghost" className={backlinkCls} onClick={onBack}>← All teams</Button>
      <p className={stepCls}>
        Step 2 · {team.displayName}: pick the date you went
      </p>
      {games === null && !err ? <div className={loadingCls}>Loading games…</div> : null}
      {err ? <div className={emptyCls}>Couldn't load games. Try again.</div> : null}
      {games !== null && !err ? (
        past.length ? (
          <div className="flex max-h-[60vh] flex-col gap-[11px] overflow-y-auto py-[2px] pr-[2px] pl-0">
            {past.map((g) => {
              const done = existing.has(g.id)
              // Only show a final once it's a real one — hide the 0–0 of completed
              // games whose score never ingested (a data gap, not a real scoreline).
              const score = (g.away.score ?? 0) + (g.home.score ?? 0) > 0
              return (
                <Button
                  key={g.id}
                  variant="outline"
                  className={cn(
                    "grid h-auto cursor-pointer grid-cols-[1fr_auto] [grid-template-areas:'date_go'_'teams_go'_'meta_go'] gap-x-[14px] gap-y-[2px] whitespace-normal rounded-lg border-[2.5px] bg-white px-4 py-3 text-left shadow-[4px_4px_0_0_#222222] hover:bg-white hover:shadow-[6px_6px_0_0_#f7df02]",
                    cardHover,
                    done ? 'border-[#1f9d4d]' : 'border-ink-soft',
                  )}
                  onClick={() => onPick(g)}
                >
                  <span className="[grid-area:date] text-[11px] font-extrabold uppercase tracking-[.5px] text-[#9a7e00]">{fmtDate(g.date)}</span>
                  <span className="[grid-area:teams] mt-[2px] flex flex-wrap items-center gap-[7px] text-[16px] font-extrabold text-ink-soft">
                    <Logo src={g.away.logo} /><span className="font-extrabold">{teamShort(g, 'away')}</span>
                    <span className="text-[13px] font-bold text-muted">@</span>
                    <Logo src={g.home.logo} /><span className="font-extrabold">{teamShort(g, 'home')}</span>
                    {score ? <Badge variant="outline" className="ml-1 rounded-[5px] border-[1.5px] border-[#ddd] bg-[#f4f4f4] px-[7px] py-px text-[14px] font-extrabold text-ink-soft">{g.away.score}–{g.home.score}</Badge> : null}
                  </span>
                  <span className="[grid-area:meta] mt-[3px] text-[12px] font-semibold uppercase tracking-[.3px] text-muted">{g.venue.name}{g.venue.city ? ' · ' + g.venue.city : ''}</span>
                  <span className={cn('[grid-area:go] self-center whitespace-nowrap text-[12px] font-extrabold uppercase tracking-[.5px]', done ? 'text-[#1f9d4d]' : 'text-[#111]')}>{done ? 'Re-rate →' : 'Rate →'}</span>
                </Button>
              )
            })}
          </div>
        ) : (
          <div className={emptyCls}>No past {SPORTS[league].label} games found for {team.displayName}.</div>
        )
      ) : null}
    </>
  )
}
