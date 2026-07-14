import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { Game } from '../lib/espn'
import { SPORTS } from '../lib/sports'
import { avgPillars, type PillarKey } from '../lib/pillars'
import { loadMyRankings, saveMyRanking, type MyRank } from '../lib/myRankings'
import { RatePanel } from './RatePanel'
import { useAuth } from './auth/AuthProvider'

// Build a MyRank from a game + pillar scores (shared by both buttons below).
function rankFromGame(game: Game, scores: Record<PillarKey, number>): MyRank {
  return {
    gameId: game.id,
    league: game.league,
    away: game.away.location || game.away.displayName,
    home: game.home.location || game.home.displayName,
    awayLogo: game.away.logo,
    homeLogo: game.home.logo,
    date: game.date,
    venue: game.venue.name || '',
    venueId: game.venue.id,
    city: game.venue.city,
    fans: scores.fans, food: scores.food, unique: scores.unique, stadium: scores.stadium,
    score: avgPillars(scores),
    ts: Date.now(),
  }
}

// Rate a specific game right where you are — a button that opens the RatePanel in a
// dialog and saves the ranking (localStorage + D1 sync), no trip to /rank. Used on
// the game and team pages.
export function LogGameButton({ game, className, compact = false }: { game: Game; className?: string; compact?: boolean }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  // The user's existing rating for this game (if any) — prefills the panel and
  // flips the button to "edit". Re-read after each save and on auth change.
  const [mine, setMine] = useState<MyRank | null>(null)
  useEffect(() => {
    setMine(loadMyRankings().find((r) => r.gameId === game.id) ?? null)
  }, [game.id, user?.id, open])

  const save = (scores: Record<PillarKey, number>) => {
    const rank = rankFromGame(game, scores)
    saveMyRanking(rank, { sync: !!user })
    setMine(rank)
    setOpen(false)
  }

  return (
    <>
      <Button
        variant="brand"
        className={cn(
          'h-auto cursor-pointer rounded-full font-sans font-extrabold tracking-[.5px] whitespace-nowrap text-[#111]! uppercase [line-height:normal]',
          compact ? 'px-4 py-2 text-[12px]' : 'px-5 py-3 text-[13px]',
          className,
        )}
        onClick={() => setOpen(true)}
      >
        {compact
          ? (mine ? `✓ ${mine.score.toFixed(1)}` : '+ Log')
          : (mine ? `✓ Logged · ${mine.score.toFixed(1)} — edit` : '+ Log this game')}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-h-[92vh] w-[min(560px,94vw)] max-w-none overflow-y-auto rounded-[12px] border-[3px] border-ink-soft bg-white p-6 font-sans shadow-[10px_10px_0_0_#222222] [line-height:normal]"
          aria-describedby={undefined}
        >
          <DialogTitle className="mb-4 font-display text-[24px] uppercase leading-none tracking-[1px] text-ink-soft">
            {mine ? 'Update your rating' : 'Log this game'}
          </DialogTitle>
          <RatePanel
            game={game}
            initial={mine ? { fans: mine.fans, food: mine.food, unique: mine.unique, stadium: mine.stadium } : undefined}
            backLabel="← Cancel"
            saveLabel={mine ? 'Save rating' : 'Log this game'}
            onBack={() => setOpen(false)}
            onSave={save}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

// Venue-level entry point: "+ Log a game" that opens a picker of this venue's games
// (rate one inline, no navigation). Falls back to /rank when the venue has no games
// on the schedule to rate. Prominent on the venue hero so logging is discoverable.
export function LogAtVenueButton({ games, venueName, className }: { games: Game[] | null; venueName?: string; className?: string }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<Game | null>(null)
  const [ranked, setRanked] = useState<Record<string, number>>({})
  useEffect(() => {
    const m: Record<string, number> = {}
    for (const r of loadMyRankings()) m[r.gameId] = r.score
    setRanked(m)
  }, [open, user?.id])

  const list = useMemo(() => (games ?? []).slice(0, 40), [games])
  const pickedRank = picked ? loadMyRankings().find((r) => r.gameId === picked.id) : undefined

  const save = (scores: Record<PillarKey, number>) => {
    if (!picked) return
    saveMyRanking(rankFromGame(picked, scores), { sync: !!user })
    setPicked(null)
    setOpen(false)
  }

  const fmt = (iso: string) => {
    const d = new Date(iso)
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
  }

  return (
    <>
      <Button
        variant="brand"
        className={cn('h-auto cursor-pointer rounded-[8px] px-[20px] py-[12px] font-display text-[15px] font-normal tracking-[.5px] whitespace-nowrap text-[#111]! [line-height:normal]', className)}
        onClick={() => { setPicked(null); setOpen(true) }}
      >
        + Log a game
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-h-[92vh] w-[min(560px,94vw)] max-w-none overflow-y-auto rounded-[12px] border-[3px] border-ink-soft bg-white p-6 font-sans shadow-[10px_10px_0_0_#222222] [line-height:normal]"
          aria-describedby={undefined}
        >
          <DialogTitle className="mb-4 font-display text-[24px] uppercase leading-none tracking-[1px] text-ink-soft">
            {picked ? 'Rate this game' : `Log a game at ${venueName || 'this venue'}`}
          </DialogTitle>
          {picked ? (
            <RatePanel
              game={picked}
              initial={pickedRank ? { fans: pickedRank.fans, food: pickedRank.food, unique: pickedRank.unique, stadium: pickedRank.stadium } : undefined}
              backLabel="← Back to games"
              saveLabel={pickedRank ? 'Save rating' : 'Log this game'}
              onBack={() => setPicked(null)}
              onSave={save}
            />
          ) : list.length ? (
            <>
              <div className="mb-3 text-[13px] font-semibold text-muted">Pick the game you went to:</div>
              <div className="flex flex-col gap-2">
                {list.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setPicked(g)}
                    className="flex cursor-pointer items-center gap-[12px] rounded-[8px] border-2 border-ink-soft bg-white px-[14px] py-[11px] text-left [transition:box-shadow_.12s,translate_.12s] hover:-translate-x-px hover:-translate-y-px hover:shadow-[5px_5px_0_0_#222]"
                  >
                    <span className="rounded-[4px] bg-ink-soft px-[7px] py-[3px] text-[10px] font-extrabold tracking-[.6px] text-white uppercase">{SPORTS[g.league].label}</span>
                    <span className="min-w-0 flex-1 text-[15px] font-extrabold text-ink-soft">{g.away.location || g.away.displayName} <span className="font-bold text-muted">@</span> {g.home.location || g.home.displayName}</span>
                    <span className="whitespace-nowrap text-[11.5px] font-bold text-muted uppercase">{ranked[g.id] != null ? `✓ ${ranked[g.id].toFixed(1)}` : fmt(g.date)}</span>
                  </button>
                ))}
              </div>
              <div className="mt-4 border-t-2 border-dashed border-[#ddd] pt-3 text-[13px] font-semibold text-muted">
                Don't see your game? <Link to="/rank" className="font-extrabold text-[#b58900]! underline" onClick={() => setOpen(false)}>Log any game →</Link>
              </div>
            </>
          ) : (
            <div className="text-[14px] font-semibold text-muted">
              No {venueName || 'venue'} games are on the schedule to rate yet.{' '}
              <Link to="/rank" className="font-extrabold text-[#b58900]! underline" onClick={() => setOpen(false)}>Log any game →</Link>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
