import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SearchIcon } from 'lucide-react'
import { SiteNav } from '../components/SiteNav'
import { SaveRankingsPrompt } from '../components/SaveRankingsPrompt'
import { ContributePrompt } from '../components/ContributePrompt'
import { loadMyRankings, saveMyRankings, type MyRank } from '../lib/myRankings'
import type { Team, LiveGame } from '../lib/data-types'

export const Route = createFileRoute('/rank')({
  head: () => ({ meta: [{ title: 'Snapback — Make Your Rankings' }] }),
  component: RankPage,
})

// ---- helpers ----

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${WEEKDAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

const avg = (s: { fans: number; food: number; unique: number; stadium: number }) =>
  Math.round(((s.fans + s.food + s.unique + s.stadium) / 4) * 10) / 10

const PILLARS = [
  { key: 'fans' as const, label: 'Fans & atmosphere', desc: 'Crowd energy, noise, passion, tailgating' },
  { key: 'food' as const, label: 'Food & concessions', desc: 'Quality, variety, value, local specialties' },
  { key: 'unique' as const, label: 'Uniqueness', desc: 'Special feel, traditions, one-of-a-kind moments' },
  { key: 'stadium' as const, label: 'The stadium itself', desc: 'Architecture, sightlines, amenities, views' },
]

const SPORTS = [
  { key: 'NFL', sport: 'nfl', label: 'NFL' },
  { key: 'MLB', sport: 'mlb', label: 'MLB' },
  { key: 'NBA', sport: 'nba', label: 'NBA' },
  { key: 'NHL', sport: 'nhl', label: 'NHL' },
  { key: 'CFB', sport: 'college-football', label: 'CFB' },
  { key: 'CBB', sport: 'mens-college-basketball', label: 'CBB' },
] as const
type SportEntry = (typeof SPORTS)[number]

const SPORT_LABELS: Record<string, string> = {
  nfl: 'NFL', mlb: 'MLB', nba: 'NBA', nhl: 'NHL',
  'college-football': 'CFB', 'mens-college-basketball': 'CBB',
}

const PROMPT_KEY = 'sbx:save-prompt:v1'
const PROMPT_EVERY = 3
interface PromptState { count: number; lastShownAt: number }
function loadPrompt(): PromptState {
  if (typeof window === 'undefined') return { count: 0, lastShownAt: 0 }
  try {
    const p = JSON.parse(window.localStorage.getItem(PROMPT_KEY) || 'null')
    return p && typeof p.count === 'number' ? p : { count: 0, lastShownAt: 0 }
  } catch { return { count: 0, lastShownAt: 0 } }
}
function savePrompt(p: PromptState) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(PROMPT_KEY, JSON.stringify(p)) } catch { /* noop */ }
}

// ---- page ----

function RankPage() {
  const [mine, setMine] = useState<MyRank[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [adding, setAdding] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const [contribute, setContribute] = useState<MyRank | null>(null)

  useEffect(() => { setMine(loadMyRankings()); setHydrated(true) }, [])

  const persist = (next: MyRank[]) => { setMine(next); saveMyRankings(next) }

  const remove = (gameId: string) => {
    persist(mine.filter(m => m.gameId !== gameId))
    fetch('/api/rankings?gameId=' + encodeURIComponent(gameId), { method: 'DELETE' }).catch(() => {})
  }

  const upsert = (r: MyRank) => {
    const isNew = !mine.some(m => m.gameId === r.gameId)
    const next = [...mine.filter(m => m.gameId !== r.gameId), r].sort((a, b) => b.score - a.score)
    persist(next)
    setAdding(false)
    setContribute(r)
    fetch('/api/rankings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rankings: [r] }),
    }).catch(() => {})
    if (isNew) {
      const p = loadPrompt()
      const count = p.count + 1
      const show = count === 1 || count - p.lastShownAt >= PROMPT_EVERY
      savePrompt({ count, lastShownAt: show ? count : p.lastShownAt })
      if (show) setShowPrompt(true)
    }
  }

  const ranked = useMemo(() => [...mine].sort((a, b) => b.score - a.score), [mine])
  const showAdd = adding || (hydrated && mine.length === 0)

  return (
    <>
      <SiteNav active="rankings" />

      {/* Header */}
      <section className="bg-ink text-white pt-[44px] pb-[38px]">
        <div className="container max-w-[1180px] mx-auto px-[28px]">
          <div className="inline-flex items-center gap-[9px] font-bold text-[12px] tracking-[1.4px] uppercase text-ink bg-brand-yellow px-[13px] py-[6px] rounded-[3px] shadow-[4px_4px_0_#000] mb-[14px]">
            Your ballot · score the games you went to
          </div>
          <h1 className="font-display uppercase text-white tracking-[1px] leading-none text-[clamp(44px,6.4vw,80px)]">
            Make your{' '}
            <span className="bg-brand-yellow text-ink px-[10px] shadow-[5px_5px_0_#000] inline-block">
              rankings
            </span>
          </h1>
        </div>
      </section>

      {/* Body */}
      <section className="py-[40px] bg-[#f4f4f4]">
        <div className="container max-w-[1180px] mx-auto px-[28px]">

          {contribute ? (
            <ContributePrompt r={contribute} onDismiss={() => setContribute(null)} />
          ) : null}
          {showPrompt && !contribute ? (
            <SaveRankingsPrompt
              onCreate={() => { setShowPrompt(false); alert('Account creation coming soon!') }}
              onDismiss={() => setShowPrompt(false)}
            />
          ) : null}

          {ranked.length > 0 ? (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-[22px] uppercase tracking-[0.5px] text-ink flex items-center gap-3">
                  Your rankings
                  <span className="font-body text-[14px] text-[#999] normal-case font-normal">{ranked.length}</span>
                </h2>
                {!showAdd ? (
                  <button
                    onClick={() => setAdding(true)}
                    className="bg-brand-yellow text-ink font-display text-[12px] uppercase tracking-[0.5px] px-4 py-2 border-[3px] border-[#222] shadow-[4px_4px_0_#222] cursor-pointer hover:-translate-y-px hover:shadow-[6px_6px_0_#222] [transition:transform_.1s,box-shadow_.1s]"
                  >
                    + Add a game
                  </button>
                ) : null}
              </div>
              <div className="flex flex-col border-[3px] border-[#222] shadow-[4px_4px_0_#222] rounded-[8px] overflow-hidden bg-white">
                {ranked.map((r, i) => (
                  <DiaryRow key={r.gameId} r={r} place={i + 1} onRemove={() => remove(r.gameId)} />
                ))}
              </div>
            </div>
          ) : null}

          {showAdd ? (
            <AddFlow
              onSave={upsert}
              onClose={ranked.length > 0 ? () => setAdding(false) : undefined}
              existing={new Set(mine.map(m => m.gameId))}
            />
          ) : null}

          {!hydrated ? (
            <div className="font-body text-[14px] text-[#999] py-8">Loading your rankings…</div>
          ) : null}
        </div>
      </section>

      <footer className="bg-black text-[#888] py-[40px] text-[13px]">
        <div className="container max-w-[1180px] mx-auto px-[28px] flex items-center justify-between flex-wrap gap-4">
          <span>Your rankings live on this device.</span>
          <Link
            to="/rankings"
            search={{ league: '', q: '', collection: '' }}
            className="text-brand-yellow font-bold no-underline"
          >
            See the expert rankings →
          </Link>
        </div>
      </footer>
    </>
  )
}

// ---- Diary row ----

function TeamLogo({ src, name }: { src?: string; name?: string }) {
  return src ? (
    <img src={src} alt={name ?? ''} width={24} height={24} className="w-6 h-6 object-contain shrink-0" loading="lazy" />
  ) : (
    <span className="w-6 h-6 rounded-full bg-[#e0e0e0] shrink-0 inline-block" aria-hidden="true" />
  )
}

function DiaryRow({ r, place, onRemove }: { r: MyRank; place: number; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-[#eee] last:border-0 hover:bg-[#fffde0] [transition:background_.1s]">
      <span className="font-display text-[20px] text-[#ccc] w-[32px] shrink-0">#{place}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <TeamLogo src={r.awayLogo} name={r.away} />
          <span className="font-body font-bold text-[13px] text-ink">{r.away}</span>
          <span className="font-body text-[12px] text-[#aaa]">@</span>
          <TeamLogo src={r.homeLogo} name={r.home} />
          <span className="font-body font-bold text-[13px] text-ink">{r.home}</span>
        </div>
        <div className="font-body text-[11px] text-[#888]">
          {SPORT_LABELS[r.sport] ?? r.sport} · {r.venue}{r.city ? ' · ' + r.city : ''} · {fmtDate(r.date)}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-display text-[26px] text-ink">{r.score.toFixed(1)}</div>
        <div className="font-body text-[10px] text-[#999] uppercase">your score</div>
      </div>
      <button
        onClick={onRemove}
        aria-label="Remove"
        className="text-[#bbb] hover:text-ink text-[20px] leading-none cursor-pointer bg-transparent border-0 shrink-0 w-7 h-7 flex items-center justify-center [transition:color_.1s]"
      >
        ×
      </button>
    </div>
  )
}

// ---- Add flow: step 1 (team) → step 2 (game) → step 3 (rate) ----

function AddFlow({
  onSave,
  onClose,
  existing,
}: {
  onSave: (r: MyRank) => void
  onClose?: () => void
  existing: Set<string>
}) {
  const [sport, setSport] = useState<SportEntry>(SPORTS[0])
  const [team, setTeam] = useState<Team | null>(null)
  const [game, setGame] = useState<LiveGame | null>(null)

  const pickSport = (s: SportEntry) => { setSport(s); setTeam(null); setGame(null) }
  const pickTeam = (t: Team | null) => { setTeam(t); setGame(null) }

  const stepLabel = game ? 'Rate your experience' : team ? 'Which game?' : 'Add a game you went to'

  return (
    <div className="bg-white border-[3px] border-[#222] shadow-[4px_4px_0_#222] rounded-[8px] overflow-hidden">
      <div className="flex items-center justify-between bg-ink px-5 py-4">
        <h2 className="font-display text-[16px] uppercase tracking-[0.5px] text-white">{stepLabel}</h2>
        {onClose ? (
          <button
            onClick={onClose}
            className="font-body text-[13px] text-brand-yellow underline cursor-pointer bg-transparent border-0"
          >
            Done
          </button>
        ) : null}
      </div>

      <div className="p-5">
        {game ? (
          <RatePanel
            game={game}
            sport={sport}
            onBack={() => setGame(null)}
            onSave={scores =>
              onSave({
                gameId: game.id,
                sport: sport.sport,
                away: game.away.abbr,
                home: game.home.abbr,
                awayLogo: game.away.logo,
                homeLogo: game.home.logo,
                date: game.date,
                venue: game.venueName ?? '',
                city: game.venueCity ?? undefined,
                ...scores,
                score: avg(scores),
                ts: Date.now(),
              })
            }
          />
        ) : team ? (
          <GamePicker
            sport={sport}
            team={team}
            existing={existing}
            onBack={() => pickTeam(null)}
            onPick={setGame}
          />
        ) : (
          <TeamPicker sport={sport} onSport={pickSport} onPick={pickTeam} />
        )}
      </div>
    </div>
  )
}

// ---- Step 1: TeamPicker ----

function SportTabs({ sport, onSport }: { sport: SportEntry; onSport: (s: SportEntry) => void }) {
  return (
    <div className="flex gap-2 flex-wrap mb-5">
      {SPORTS.map(s => (
        <button
          key={s.key}
          onClick={() => onSport(s)}
          className={`px-[14px] py-[6px] border-[2px] font-body font-bold text-[12px] uppercase tracking-[0.5px] cursor-pointer rounded-full [transition:background_.1s,color_.1s,border-color_.1s] ${
            s.key === sport.key
              ? 'bg-ink text-white border-ink'
              : 'bg-white text-ink border-[#ccc] hover:border-ink'
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}

function TeamPicker({
  sport,
  onSport,
  onPick,
}: {
  sport: SportEntry
  onSport: (s: SportEntry) => void
  onPick: (t: Team) => void
}) {
  const [teams, setTeams] = useState<Team[] | null>(null)
  const [err, setErr] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => {
    let alive = true
    setTeams(null); setErr(false)
    fetch('/api/teams?league=' + sport.key)
      .then(r => r.json())
      .then((d: unknown) => { if (alive) setTeams(Array.isArray(d) ? (d as Team[]) : []) })
      .catch(() => { if (alive) setErr(true) })
    return () => { alive = false }
  }, [sport.key])

  const ql = q.trim().toLowerCase()
  const list = useMemo(
    () => teams
      ? teams.filter(t => !ql || (t.name + ' ' + t.city + ' ' + t.abbr).toLowerCase().includes(ql))
      : [],
    [teams, ql],
  )

  return (
    <>
      <p className="font-body text-[13px] text-[#999] uppercase tracking-[0.5px] font-bold mb-3">
        Step 1 · Which team?
      </p>
      <SportTabs sport={sport} onSport={onSport} />

      <div className="relative mb-4">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#aaa]" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search a team…"
          aria-label="Search teams"
          className="w-full border-[2px] border-[#e0e0e0] rounded-[6px] pl-9 pr-4 py-2.5 font-body text-[14px] outline-none focus:border-ink [transition:border-color_.1s] bg-[#fafafa]"
        />
      </div>

      {teams === null && !err
        ? <div className="font-body text-[13px] text-[#999] py-4">Loading teams…</div>
        : null}
      {err
        ? <div className="font-body text-[13px] text-red-500 py-4">Couldn't load teams. Try again.</div>
        : null}
      {teams !== null && !err ? (
        list.length ? (
          <div className="grid grid-cols-2 gap-2 max-[580px]:grid-cols-1 max-h-[360px] overflow-y-auto">
            {list.map(t => (
              <button
                key={t.id}
                onClick={() => onPick(t)}
                className="flex items-center gap-3 px-3 py-2.5 border-[2px] border-[#e8e8e8] rounded-[6px] bg-white text-left cursor-pointer hover:border-ink hover:bg-[#fffde0] [transition:border-color_.1s,background_.1s]"
              >
                {t.logo_url ? (
                  <img src={t.logo_url} alt="" width={28} height={28} className="w-7 h-7 object-contain shrink-0" loading="lazy" />
                ) : (
                  <span className="w-7 h-7 rounded-full bg-[#e8e8e8] shrink-0 inline-block" aria-hidden="true" />
                )}
                <span className="font-body text-[13px] text-ink font-semibold leading-tight">
                  {t.city} {t.name}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="font-body text-[13px] text-[#999] py-4">
            No teams match &ldquo;{q.trim()}&rdquo;.
          </div>
        )
      ) : null}
    </>
  )
}

// ---- Step 2: GamePicker ----

function GamePicker({
  sport,
  team,
  existing,
  onBack,
  onPick,
}: {
  sport: SportEntry
  team: Team
  existing: Set<string>
  onBack: () => void
  onPick: (g: LiveGame) => void
}) {
  const [games, setGames] = useState<LiveGame[] | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    let alive = true
    setGames(null); setErr(false)
    fetch(`/api/games?sport=${sport.sport}&team=${encodeURIComponent(team.abbr)}&limit=200`)
      .then(r => r.json())
      .then((d: unknown) => { if (alive) setGames(Array.isArray(d) ? (d as LiveGame[]) : []) })
      .catch(() => { if (alive) setErr(true) })
    return () => { alive = false }
  }, [sport.sport, team.abbr])

  const past = useMemo(
    () => (games ?? []).filter(g => g.isFinal).sort((a, b) => b.date.localeCompare(a.date)),
    [games],
  )

  return (
    <>
      <button
        onClick={onBack}
        className="font-body text-[13px] text-[#666] hover:text-ink [transition:color_.1s] mb-3 cursor-pointer bg-transparent border-0 p-0"
      >
        ← All teams
      </button>
      <p className="font-body text-[13px] text-[#999] uppercase tracking-[0.5px] font-bold mb-4">
        Step 2 · {team.city} {team.name} — which date did you go?
      </p>

      {games === null && !err
        ? <div className="font-body text-[13px] text-[#999] py-4">Loading games…</div>
        : null}
      {err
        ? <div className="font-body text-[13px] text-red-500 py-4">Couldn't load games. Try again.</div>
        : null}
      {games !== null && !err ? (
        past.length ? (
          <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
            {past.map(g => {
              const done = existing.has(g.id)
              const hasScore = g.away.score !== '0' || g.home.score !== '0'
              return (
                <button
                  key={g.id}
                  onClick={() => onPick(g)}
                  className={`flex items-center gap-4 px-4 py-3 border-[2px] rounded-[6px] text-left cursor-pointer [transition:border-color_.1s,background_.1s] ${
                    done
                      ? 'border-brand-yellow bg-[#fffde0]'
                      : 'border-[#e8e8e8] bg-white hover:border-ink hover:bg-[#fafafa]'
                  }`}
                >
                  <span className="font-body text-[12px] text-[#888] w-[72px] shrink-0 leading-tight">
                    {fmtDate(g.date).split(',')[0]}
                  </span>
                  <div className="flex-1 flex items-center gap-2 flex-wrap">
                    <img src={g.away.logo} alt="" width={20} height={20} className="w-5 h-5 object-contain shrink-0" loading="lazy" />
                    <span className="font-body font-semibold text-[13px]">{g.away.abbr}</span>
                    <span className="text-[#aaa] text-[12px]">@</span>
                    <img src={g.home.logo} alt="" width={20} height={20} className="w-5 h-5 object-contain shrink-0" loading="lazy" />
                    <span className="font-body font-semibold text-[13px]">{g.home.abbr}</span>
                    {hasScore ? (
                      <span className="font-body text-[12px] text-[#666]">
                        ({g.away.score}–{g.home.score})
                      </span>
                    ) : null}
                  </div>
                  <div className="text-right shrink-0">
                    {g.venueName ? (
                      <div className="font-body text-[11px] text-[#999] mb-0.5">{g.venueName}</div>
                    ) : null}
                    <div className="font-body text-[11px] text-brand-yellow font-bold">
                      {done ? 'Re-rate →' : 'Rate →'}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="font-body text-[13px] text-[#999] py-4">
            No completed {sport.label} games found for {team.city} {team.name}.
          </div>
        )
      ) : null}
    </>
  )
}

// ---- Step 3: RatePanel ----

type Scores = { fans: number; food: number; unique: number; stadium: number }

function RatePanel({
  game,
  sport,
  onBack,
  onSave,
}: {
  game: LiveGame
  sport: SportEntry
  onBack: () => void
  onSave: (s: Scores) => void
}) {
  const [s, setS] = useState<Scores>({ fans: 7, food: 7, unique: 7, stadium: 7 })
  const total = avg(s)

  return (
    <>
      <button
        onClick={onBack}
        className="font-body text-[13px] text-[#666] hover:text-ink [transition:color_.1s] mb-4 cursor-pointer bg-transparent border-0 p-0"
      >
        ← Pick another game
      </button>

      {/* Game recap */}
      <div className="bg-[#f4f4f4] rounded-[8px] p-4 mb-6">
        <div className="flex items-center gap-3 mb-2">
          <img src={game.away.logo} alt="" width={28} height={28} className="w-7 h-7 object-contain" loading="lazy" />
          <span className="font-body font-bold text-[14px] text-ink">{game.away.abbr}</span>
          <span className="font-body text-[13px] text-[#aaa]">@</span>
          <img src={game.home.logo} alt="" width={28} height={28} className="w-7 h-7 object-contain" loading="lazy" />
          <span className="font-body font-bold text-[14px] text-ink">{game.home.abbr}</span>
          <span className="font-body text-[13px] text-[#666] ml-1">
            ({game.away.score}–{game.home.score})
          </span>
        </div>
        <div className="font-body text-[12px] text-[#777]">
          {sport.label}
          {game.venueName ? ` · ${game.venueName}` : ''}
          {game.venueCity ? `, ${game.venueCity}` : ''}
          {' · '}{fmtDate(game.date)}
        </div>
      </div>

      <p className="font-body text-[13px] text-[#999] uppercase tracking-[0.5px] font-bold mb-4">
        Step 3 · Rate your experience
      </p>

      <div className="flex flex-col gap-5 mb-6">
        {PILLARS.map(p => (
          <PillarRow
            key={p.key}
            label={p.label}
            desc={p.desc}
            value={s[p.key]}
            onChange={n => setS(prev => ({ ...prev, [p.key]: n }))}
          />
        ))}
      </div>

      <div className="flex items-center justify-between pt-4 border-t-[2px] border-[#e8e8e8]">
        <div>
          <div className="font-display text-[44px] text-ink leading-none">{total.toFixed(1)}</div>
          <div className="font-body text-[11px] text-[#999] uppercase tracking-[0.5px]">your score</div>
        </div>
        <button
          onClick={() => onSave(s)}
          className="bg-brand-yellow text-ink font-display text-[14px] uppercase tracking-[0.5px] px-6 py-3 border-[3px] border-[#222] shadow-[4px_4px_0_#222] cursor-pointer hover:-translate-y-px hover:shadow-[6px_6px_0_#222] [transition:transform_.1s,box-shadow_.1s]"
        >
          Add to my rankings
        </button>
      </div>
    </>
  )
}

// Separate draft state so typing "7." or clearing the field doesn't immediately
// reset the slider to 1 (the numeric parse of "" or "7.").
function PillarRow({
  label,
  desc,
  value,
  onChange,
}: {
  label: string
  desc: string
  value: number
  onChange: (n: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const clamp = (n: number) => Math.min(10, Math.max(1, Math.round(n * 10) / 10))

  const onText = (raw: string) => {
    const cleaned = raw.replace(/[^0-9.]/g, '')
    setDraft(cleaned)
    const n = parseFloat(cleaned)
    if (!isNaN(n) && n >= 1 && n <= 10) onChange(clamp(n))
  }
  const commit = () => {
    if (draft !== null) {
      const n = parseFloat(draft)
      if (!isNaN(n)) onChange(clamp(n))
    }
    setDraft(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <span className="font-body font-bold text-[13px] text-ink">{label}</span>
          <span className="font-body text-[11px] text-[#999] ml-2">{desc}</span>
        </div>
        <input
          type="text"
          inputMode="decimal"
          aria-label={`${label} score 1 to 10`}
          value={draft ?? value.toFixed(1)}
          onFocus={e => e.currentTarget.select()}
          onChange={e => onText(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          className="w-[52px] border-[2px] border-[#222] rounded-[4px] text-center font-display text-[16px] text-ink py-1 outline-none focus:border-brand-yellow [transition:border-color_.1s]"
        />
      </div>
      <input
        type="range"
        min={1}
        max={10}
        step={0.1}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        aria-label={label}
        className="w-full accent-brand-yellow h-1.5 rounded-full cursor-pointer"
      />
      <div className="flex justify-between font-body text-[10px] text-[#ccc] mt-0.5">
        <span>1</span><span>5</span><span>10</span>
      </div>
    </div>
  )
}
