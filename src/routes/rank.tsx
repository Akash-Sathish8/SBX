import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { SearchIcon } from 'lucide-react'
import { SiteNav } from '../components/SiteNav'
import { PageCssGuard } from '../components/PageCssGuard'
import { getJSON, getJSONFresh } from '../lib/dataCache'
import { SPORTS, RANKABLE_LEAGUES, type League } from '../lib/sports'
import type { Game, TeamInfo, Venue } from '../lib/espn'
import type { Experience } from '../lib/experiences'
import { matchExperienceForVenue, matchExperienceForTeam } from '../lib/experienceMatch'
import { useAuth } from '../components/auth/AuthProvider'
import { SaveRankingsPrompt } from '../components/auth/SaveRankingsPrompt'
import { ContributePrompt } from '../components/ContributePrompt'
import css from '../pages/rank.css?url'

// "Make your rankings" — a fan ranks the games they ACTUALLY went to. Pick the
// team, pick the date you attended (from the seeded 2025–2026 season in D1), then
// score the experience on the same four pillars the experts use (fans, food,
// uniqueness, stadium). Your list is the personal mirror of /rankings. Ratings
// are the user's own input — nothing here is fabricated — and the list persists
// locally, and once signed in it syncs to D1 so it follows you across devices.

export const Route = createFileRoute('/rank')({
  head: () => ({
    links: [{ rel: 'stylesheet', href: css, 'data-page-css': 'rank' }],
    meta: [{ title: 'Snapback · Make your rankings' }],
  }),
  component: RankPage,
})

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : `${WD[d.getDay()]} ${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}
const teamShort = (g: Game, side: 'home' | 'away') => g[side].location || g[side].displayName

// The four pillars, identical to the expert-rankings columns on /rankings.
// `desc` feeds the "?" tooltip so fans score against the same rubric the experts use.
const PILLARS = [
  {
    key: 'fans',
    label: 'Fans & atmosphere',
    desc: 'The crowd and the energy. Were fans loud, locked in, and did the building have juice from start to finish?',
  },
  {
    key: 'food',
    label: 'Food & concessions',
    desc: 'What you ate and drank: quality, variety, and whether it was worth the concession-stand prices.',
  },
  {
    key: 'unique',
    label: 'Uniqueness',
    desc: "The stuff you can't get anywhere else: traditions, chants, views, and only-here gameday moments.",
  },
  {
    key: 'stadium',
    label: 'The stadium itself',
    desc: 'The building: sightlines, concourses, seats, and scoreboard. How good is the venue at hosting a game?',
  },
] as const
type PillarKey = (typeof PILLARS)[number]['key']

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
  city?: string
  fans: number
  food: number
  unique: number
  stadium: number
  score: number
  ts: number
}

const STORE_KEY = 'sbx:my-rankings:v1'
const avg = (r: { fans: number; food: number; unique: number; stadium: number }) =>
  Math.round(((r.fans + r.food + r.unique + r.stadium) / 4) * 10) / 10

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
  const [mine, setMine] = useState<MyRank[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [adding, setAdding] = useState(false)
  const [prompt, setPrompt] = useState(false)
  const [contribute, setContribute] = useState<MyRank | null>(null)

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
  const upsert = (r: MyRank) => {
    const isNew = !mine.some((m) => m.gameId === r.gameId)
    persist([...mine.filter((m) => m.gameId !== r.gameId), r].sort((a, b) => b.score - a.score))
    setAdding(false)
    if (user) {
      fetch('/api/rankings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rankings: [r] }),
      }).catch(() => {})
      // Straight to the venue's tip composer (skippable there) — tips beat
      // general reviews for the next fan. Unknown venue: inline nudge instead.
      getJSON('/api/venues')
        .then((res: any) => {
          const match = (Array.isArray(res?.data) ? res.data : []).find((v: any) => v.name === r.venue)
          if (match) navigate({ to: '/venue', search: { id: match.id, tip: 1 } })
          else setContribute(r)
        })
        .catch(() => setContribute(r))
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
  // Show the picker up front when the list is empty; otherwise it's behind "Add".
  const showAdd = adding || (hydrated && mine.length === 0)

  return (
    <>
      <PageCssGuard id="rank" />
      <SiteNav />
      <section className="head">
        <div className="container">
          <div className="eyebrow">Your ballot · score the games you went to</div>
          <h1>Make your <span className="hl">rankings</span></h1>
        </div>
      </section>

      <section className="block">
        <div className="container">
          {contribute ? (
            <ContributePrompt r={contribute} onDismiss={() => setContribute(null)} />
          ) : null}

          {prompt && !user ? (
            <SaveRankingsPrompt onCreate={() => openAuth('register')} onDismiss={() => setPrompt(false)} />
          ) : null}

          {ranked.length > 0 ? (
            <div className="rk-yours">
              <div className="rk-yhead">
                <h2>Your rankings <span className="rk-count">{ranked.length}</span></h2>
                {!showAdd ? (
                  <button className="btn brand" onClick={() => setAdding(true)}>+ Add a game</button>
                ) : null}
              </div>
              <div className="rk-list">
                {ranked.map((r, i) => (
                  <YourRow key={r.gameId} r={r} place={i + 1} onRemove={() => remove(r.gameId)} />
                ))}
              </div>
            </div>
          ) : null}

          {showAdd ? (
            <AddFlow
              onSave={upsert}
              onClose={ranked.length > 0 ? () => setAdding(false) : undefined}
              existing={new Set(mine.map((m) => m.gameId))}
            />
          ) : null}

          {!hydrated ? <div className="rk-loading">Loading your rankings…</div> : null}
        </div>
      </section>

      <footer>
        <div className="container">
          © 2026 Snapback Sports · {user ? 'Saved to your account.' : 'Your rankings live on this device.'} <Link to="/rankings">See the expert rankings →</Link>
        </div>
      </footer>
    </>
  )
}

function Logo({ src }: { src?: string }) {
  return src ? <img className="rk-logo" src={src} alt="" width={26} height={26} loading="lazy" /> : <span className="rk-logo ph" aria-hidden="true" />
}

function YourRow({ r, place, onRemove }: { r: MyRank; place: number; onRemove: () => void }) {
  return (
    <div className="rk-row">
      <span className="rk-place">#{place}</span>
      <div className="rk-rmid">
        <div className="rk-rteams">
          <Logo src={r.awayLogo} />
          <span className="rk-tn">{r.away}</span>
          <span className="rk-at">@</span>
          <Logo src={r.homeLogo} />
          <span className="rk-tn">{r.home}</span>
        </div>
        <div className="rk-rmeta">
          {SPORTS[r.league].label} · {r.venue}{r.city ? ' · ' + r.city : ''} · {fmtDate(r.date)}
        </div>
      </div>
      <div className="rk-rscore"><span className="rk-sv">{r.score.toFixed(1)}</span><span className="rk-sl">your score</span></div>
      <button className="rk-del" aria-label="Remove from your rankings" onClick={onRemove}>×</button>
    </div>
  )
}

// ---- Add flow: league + team → game → rate ----------------------------------

function AddFlow({ onSave, onClose, existing }: { onSave: (r: MyRank) => void; onClose?: () => void; existing: Set<string> }) {
  const [league, setLeague] = useState<League>('mlb')
  const [team, setTeam] = useState<TeamInfo | null>(null)
  const [picked, setPicked] = useState<Game | null>(null)

  // Reset deeper selections when the user steps back up the funnel.
  const pickLeague = (l: League) => { setLeague(l); setTeam(null); setPicked(null) }
  const pickTeam = (t: TeamInfo | null) => { setTeam(t); setPicked(null) }

  return (
    <div className="rk-add">
      <div className="rk-ahead">
        <h2>{picked ? 'Rate your experience' : team ? 'Which game?' : 'Add a game you went to'}</h2>
        {onClose ? <button className="rk-x" aria-label="Close" onClick={onClose}>Done</button> : null}
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
              city: picked.venue.city,
              ...scores,
              score: avg(scores),
              ts: Date.now(),
            })
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
    <div className="rk-tabs">
      {RANKABLE_LEAGUES.map((l) => (
        <button key={l} className={'rk-tab' + (l === league ? ' on' : '')} onClick={() => onLeague(l)}>{SPORTS[l].label}</button>
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
      <p className="rk-step">Step 1 · Which team did you go see?</p>
      <LeagueTabs league={league} onLeague={onLeague} />
      <label className="rk-search">
        <SearchIcon className="rk-si" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a team…" aria-label="Search teams" />
      </label>
      {teams === null && !err ? <div className="rk-loading">Loading teams…</div> : null}
      {err ? <div className="rk-empty">Couldn't load teams. Try again.</div> : null}
      {teams !== null && !err ? (
        <div className="rk-teams">
          {list.map((t) => (
            <button key={t.id} className="rk-team" onClick={() => onPick(t)}>
              {t.logo ? <img className="rk-tlogo" src={t.logo} alt="" width={34} height={34} loading="lazy" /> : <span className="rk-tlogo ph" aria-hidden="true" />}
              <span className="rk-tnm">{t.displayName}</span>
            </button>
          ))}
          {list.length === 0 ? <div className="rk-empty">No teams match “{q.trim()}”.</div> : null}
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
      <button className="rk-backlink" onClick={onBack}>← All teams</button>
      <p className="rk-step">
        Step 2 · {team.displayName}: pick the date you went
      </p>
      {games === null && !err ? <div className="rk-loading">Loading games…</div> : null}
      {err ? <div className="rk-empty">Couldn't load games. Try again.</div> : null}
      {games !== null && !err ? (
        past.length ? (
          <div className="rk-games">
            {past.map((g) => {
              const done = existing.has(g.id)
              // Only show a final once it's a real one — hide the 0–0 of completed
              // games whose score never ingested (a data gap, not a real scoreline).
              const score = (g.away.score ?? 0) + (g.home.score ?? 0) > 0
              return (
                <button key={g.id} className={'rk-game' + (done ? ' done' : '')} onClick={() => onPick(g)}>
                  <span className="rk-gdate">{fmtDate(g.date)}</span>
                  <span className="rk-gteams">
                    <Logo src={g.away.logo} /><span className="rk-tn">{teamShort(g, 'away')}</span>
                    <span className="rk-at">@</span>
                    <Logo src={g.home.logo} /><span className="rk-tn">{teamShort(g, 'home')}</span>
                    {score ? <span className="rk-gscore">{g.away.score}–{g.home.score}</span> : null}
                  </span>
                  <span className="rk-gmeta">{g.venue.name}{g.venue.city ? ' · ' + g.venue.city : ''}</span>
                  <span className="rk-go">{done ? 'Re-rate →' : 'Rate →'}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="rk-empty">No past {SPORTS[league].label} games found for {team.displayName}.</div>
        )
      ) : null}
    </>
  )
}

// Live fan aggregate for this venue (see /api/venue-stats) — count is 0 until
// fans have ranked games here, and pillar averages only render once they have.
interface FanStats { count: number; fans: number; food: number; unique: number; stadium: number; score: number }

function RatePanel({ game, onBack, onSave }: { game: Game; onBack: () => void; onSave: (s: Record<PillarKey, number>) => void }) {
  const [s, setS] = useState<Record<PillarKey, number>>({ fans: 7, food: 7, unique: 7, stadium: 7 })
  const [fan, setFan] = useState<FanStats | null>(null)
  const [exps, setExps] = useState<Experience[]>([])
  const [venues, setVenues] = useState<Venue[]>([])
  const total = avg(s)

  // Benchmarks: what other fans averaged at this venue, and what Snapback's
  // experts scored the matching experience. Both are honest gaps — no data,
  // no number.
  useEffect(() => {
    let alive = true
    setFan(null)
    if (game.venue.name) {
      getJSONFresh('/api/venue-stats?venue=' + encodeURIComponent(game.venue.name))
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
    <div className="rk-rate">
      <button className="rk-backlink" onClick={onBack}>← Pick another game</button>
      <div className="rk-rctx">
        <div className="rk-rcmatch">
          <Logo src={game.away.logo} /><span className="rk-tn">{teamShort(game, 'away')}</span>
          <span className="rk-at">@</span>
          <Logo src={game.home.logo} /><span className="rk-tn">{teamShort(game, 'home')}</span>
        </div>
        <div className="rk-rcmeta">{SPORTS[game.league].label} · {game.venue.name}{game.venue.city ? ' · ' + game.venue.city : ''} · {fmtDate(game.date)}</div>
      </div>

      <div className="rk-sliders">
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

      <div className="rk-rfoot">
        <div className="rk-total">
          <span className="rk-tv">{total.toFixed(1)}</span>
          <span className="rk-tl">your score</span>
        </div>
        <button className="btn brand rk-save" onClick={() => onSave(s)}>Add to my rankings</button>
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
    <div className="rk-slider">
      <div className="rk-slabel">
        <span className="rk-slname">
          {label}
          <span className="rk-help">
            <button type="button" className="rk-helpbtn" aria-label={`What "${label}" means`}>?</button>
            <span role="tooltip" className="rk-helptip">{desc}</span>
          </span>
        </span>
        <span className="rk-srefs">
          {fanAvg != null ? (
            <span className="rk-ref" title="Average score from fans who ranked a game here">
              <span className="rk-refl">Fan avg</span>
              <span className="rk-refv">{fanAvg.toFixed(1)}</span>
            </span>
          ) : null}
          {sbx != null ? (
            <span className="rk-ref sbx" title="Snapback's expert rating for this experience">
              <span className="rk-refl">Snapback</span>
              <span className="rk-refv">{sbx.toFixed(1)}</span>
            </span>
          ) : null}
          <span className="rk-ref you">
            <span className="rk-refl">You</span>
            <input
              className="rk-sval"
              type="text"
              inputMode="decimal"
              aria-label={`${label} score, 1 to 10`}
              value={draft ?? value.toFixed(1)}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => onText(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
            />
          </span>
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        step={0.1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
    </div>
  )
}
