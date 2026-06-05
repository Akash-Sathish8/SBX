
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { formatInTimezone } from '@/lib/time';
import { zonedTimeToUtc } from '@/lib/time';
import { shareMatch } from '@/lib/share';
import Flag from './Flag';
import FollowStar from './FollowStar';
import { groupStandingsSearch } from '@/lib/external-links';
import InlineMatchScore from './InlineMatchScore';
import StandingsModal from './StandingsModal';
import type { ItineraryMatch, MatchStatus, Stadium } from '@/lib/types';

interface Props {
  stadium: Stadium;
  matches: ItineraryMatch[];
  highlightMatchNumber?: number | null;
  onClose: () => void;
  visibility?: { showLodging: boolean; showTransport: boolean };
  underdogReferral?: string;
}

function countryAccent(code: string): string {
  switch (code) {
    case 'US':
      return '#3b82f6';
    case 'MX':
      return '#16a34a';
    case 'CA':
      return '#dc2626';
    default:
      return 'var(--snap-fog)';
  }
}

function statusStyle(status: MatchStatus): { border: string; text: string; label: string } {
  switch (status) {
    case 'live':
      return { border: 'border-live', text: 'text-live', label: 'LIVE' };
    case 'final':
      return { border: 'border-snap-yellow', text: 'text-snap-yellow', label: 'FINAL' };
    case 'postponed':
      return { border: 'border-snap-mist', text: 'text-snap-mist', label: 'POSTPONED' };
    case 'cancelled':
      return { border: 'border-snap-mist', text: 'text-snap-mist', label: 'CANCELLED' };
    default:
      return { border: 'border-snap-ash', text: 'text-snap-mist', label: 'SCHEDULED' };
  }
}

function stageChipClass(stage: string): string {
  const s = stage.toUpperCase();
  if (s === 'FINAL') return 'bg-snap-yellow text-snap-black';
  if (s.includes('SEMI')) return 'bg-snap-yellow/30 text-snap-yellow';
  if (s.includes('QUARTER')) return 'bg-snap-yellow/20 text-snap-yellow';
  if (s.includes('ROUND OF 16')) return 'bg-snap-yellow/15 text-snap-yellow';
  if (s.includes('ROUND OF 32')) return 'bg-snap-yellow/10 text-snap-yellow';
  if (s.includes('3RD PLACE')) return 'bg-snap-yellow/20 text-snap-yellow';
  return 'text-snap-yellow';
}

export default function StadiumDrawer({
  stadium,
  matches,
  highlightMatchNumber,
  onClose,
  visibility = { showLodging: false, showTransport: false },
  underdogReferral = '',
}: Props) {
  const [openDetailsFor, setOpenDetailsFor] = useState<number | null>(null);
  const [openAgendaFor, setOpenAgendaFor] = useState<number | null>(null);
  const [openBetsFor, setOpenBetsFor] = useState<number | null>(null);
  const showLogisticsButton = visibility.showLodging || visibility.showTransport;
  const carouselRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const highlightedRef = useRef<HTMLDivElement | null>(null);
  const [sharedHint, setSharedHint] = useState<{ n: number; text: string } | null>(null);
  const [openStandingsGroup, setOpenStandingsGroup] = useState<string | null>(null);

  async function handleShare(m: ItineraryMatch) {
    const result = await shareMatch({
      matchNumber: m.matchNumber,
      matchName: m.match,
      stadium: stadium.name,
    });
    if (result === 'copied') {
      setSharedHint({ n: m.matchNumber, text: 'LINK COPIED' });
      setTimeout(() => setSharedHint(null), 1800);
    } else if (result === 'shared') {
      setSharedHint({ n: m.matchNumber, text: 'SHARED ↗' });
      setTimeout(() => setSharedHint(null), 1800);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // On mount: snap the carousel to the *next upcoming* match by default
  // (the one a user is most likely curious about), or to the most recent
  // past match if the tournament is over for this venue. A specific
  // highlightMatchNumber prop overrides this default.
  useEffect(() => {
    const t = setTimeout(() => {
      let idx = 0;
      if (highlightMatchNumber) {
        idx = matches.findIndex((m) => m.matchNumber === highlightMatchNumber);
        if (idx < 0) idx = 0;
      } else {
        const nowMs = Date.now();
        const upcoming = matches.findIndex((m) => {
          try {
            return zonedTimeToUtc(m.kickoffLocal, m.kickoffTZ).getTime() > nowMs;
          } catch {
            return false;
          }
        });
        idx = upcoming >= 0 ? upcoming : Math.max(0, matches.length - 1);
      }
      setCurrentIndex(idx);
      const el = carouselRef.current;
      if (el) {
        // Use 'auto' on mount (no animated scroll) so the user lands
        // squarely on the right card. Smooth-scroll only when nav happens
        // from the pagination buttons.
        el.scrollTo({ left: idx * el.clientWidth, behavior: 'auto' });
      }
    }, 320); // wait for the drawer's slide-in animation to complete
    return () => clearTimeout(t);
  }, [highlightMatchNumber, matches]);

  // Sync currentIndex with scroll position as the user swipes.
  function handleCarouselScroll() {
    const el = carouselRef.current;
    if (!el || el.clientWidth === 0) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    const clamped = Math.max(0, Math.min(matches.length - 1, idx));
    if (clamped !== currentIndex) setCurrentIndex(clamped);
  }

  function goToIndex(idx: number) {
    const el = carouselRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' });
  }

  const currentMatch = matches[currentIndex] ?? matches[0];

  return (
    <div className="fixed inset-0 z-[1100]">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside
        className="absolute right-0 top-0 h-full w-full overflow-y-auto no-scrollbar flex flex-col bg-snap-coal border-l border-snap-ash sm:max-w-[420px]"
        style={{ animation: 'drawer-slide 280ms cubic-bezier(0.2,0.8,0.2,1)' }}
      >
        <div
          className="sm:hidden flex justify-center py-2 cursor-grab active:cursor-grabbing"
          onTouchStart={(e) => {
            const startY = e.touches[0].clientY;
            const startT = Date.now();
            const onEnd = (te: TouchEvent) => {
              const endY = te.changedTouches[0].clientY;
              const dy = endY - startY;
              const dt = Date.now() - startT;
              if (dy > 60 && dt < 700) onClose();
              window.removeEventListener('touchend', onEnd);
            };
            window.addEventListener('touchend', onEnd, { passive: true });
          }}
          aria-hidden="true"
        >
          <div className="h-1 w-10 bg-snap-fog rounded" />
        </div>
        <div className="relative h-[200px] flex-shrink-0 overflow-hidden border-b border-snap-ash">
          <div
            className="absolute top-0 left-0 right-0 h-[2px] z-10"
            style={{ background: countryAccent(stadium.country) }}
          />
          {stadium.heroImage ? (
            <>
              <img
                src={stadium.heroImage}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(10,10,10,0.9) 100%)',
                }}
              />
            </>
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(135deg, #1f1f1f 0%, #0a0a0a 50%, #141414 100%)',
              }}
            />
          )}

          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 z-10 flex h-10 w-10 sm:h-8 sm:w-8 items-center justify-center border border-snap-ash bg-snap-black/80 text-snap-mist hover:text-snap-yellow hover:border-snap-yellow transition-colors"
            aria-label="Close"
          >
            ✕
          </button>

          <div className="absolute bottom-4 left-5 right-14 z-10">
            <div className="font-mono text-[10px] tracking-[0.18em] text-snap-yellow">
              STADIUM · {stadium.countryName.toUpperCase()}
            </div>
            <h2
              className="font-display text-[32px] sm:text-[38px] leading-none mt-1 text-snap-chalk"
              style={{ textShadow: '0 2px 12px rgba(0,0,0,0.8)' }}
            >
              {stadium.name}
            </h2>
            <div className="font-mono text-[11px] text-snap-mist mt-1.5">
              {stadium.city}
              {stadium.state ? `, ${stadium.state}` : ''}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 flex-shrink-0 divide-x divide-snap-ash border-b border-snap-ash bg-snap-coal">
          <Meta label="CAPACITY" value={stadium.capacity.toLocaleString()} />
          <Meta label="MATCHES" value={String(matches.length)} />
          <div className="px-3 py-2 flex items-center gap-2">
            <Flag countryCode={stadium.country} countryName={stadium.countryName} size={18} />
            <div className="leading-tight">
              <div className="font-mono text-[9px] tracking-[0.15em] text-snap-mist">COUNTRY</div>
              <div className="stat-number text-snap-chalk text-sm mt-0.5">
                {stadium.countryName}
              </div>
            </div>
          </div>
        </div>

        {/* Carousel of match cards (snap-x). Height = the full card content
            so nothing (incl. the video section) is ever clipped. The buzz
            panel sits beneath it and the whole drawer scrolls if needed. */}
        <div className="relative flex-shrink-0 flex flex-col border-b border-snap-ash">
          <div
            ref={carouselRef}
            onScroll={handleCarouselScroll}
            className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar overscroll-x-contain"
          >
          {matches.map((m, mIdx) => {
            const s = statusStyle(m.result?.status ?? 'scheduled');
            const kickoffDate = zonedTimeToUtc(m.kickoffLocal, m.kickoffTZ);
            const kickoffStr = formatInTimezone(kickoffDate, m.kickoffTZ, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              timeZoneName: 'short',
            });
            return (
              <article
                key={m.matchNumber}
                ref={highlightMatchNumber === m.matchNumber ? highlightedRef : null}
                className={`flex-shrink-0 w-full snap-start snap-always p-4 ${
                  mIdx === currentIndex ? '' : 'opacity-90'
                }`}
              ><div className={`relative border bg-gradient-to-br from-snap-carbon to-snap-coal/80 p-4 ${
                  highlightMatchNumber === m.matchNumber
                    ? 'border-snap-yellow shadow-[0_0_0_1px_rgba(255,212,0,0.5)]'
                    : 'border-snap-ash'
                }`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] tracking-[0.18em] text-snap-mist">
                      MATCH {m.matchNumber}
                    </span>
                    <span
                      className={`font-mono text-[9px] tracking-[0.18em] px-1.5 py-0.5 ${stageChipClass(m.stage)}`}
                    >
                      {m.stage.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleShare(m)}
                      className="font-mono text-[9px] tracking-[0.18em] text-snap-mist hover:text-snap-yellow transition-colors"
                      aria-label={`Share match ${m.matchNumber}`}
                    >
                      {sharedHint?.n === m.matchNumber ? sharedHint.text : '↗ SHARE'}
                    </button>
                    <span className={`border ${s.border} ${s.text} font-mono text-[9px] tracking-[0.15em] px-2 py-0.5`}>
                      {s.label}
                    </span>
                  </div>
                </div>
                <h3 className="font-display text-[22px] sm:text-[26px] mt-2 text-snap-chalk leading-tight flex items-center gap-2 flex-wrap">
                  <Flag team={m.homeTeam} size={22} />
                  <span>{m.homeTeam}</span>
                  <FollowStar team={m.homeTeam} size={14} />
                  <span className="text-snap-fog text-base">vs</span>
                  <span>{m.awayTeam}</span>
                  <FollowStar team={m.awayTeam} size={14} />
                  <Flag team={m.awayTeam} size={22} />
                </h3>
                <div className="font-mono text-[11px] text-snap-mist mt-1.5">
                  <div>{kickoffStr}</div>
                  <div className="text-snap-fog mt-0.5">
                    YOUR TIME:{' '}
                    {new Intl.DateTimeFormat(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      timeZoneName: 'short',
                    }).format(kickoffDate)}
                  </div>
                </div>

                {showLogisticsButton && (m.transportMode || m.lodging) && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenDetailsFor((prev) =>
                          prev === m.matchNumber ? null : m.matchNumber,
                        )
                      }
                      className="font-mono text-[9px] tracking-[0.22em] text-snap-mist hover:text-snap-yellow transition-colors"
                      aria-expanded={openDetailsFor === m.matchNumber}
                    >
                      {openDetailsFor === m.matchNumber ? '× HIDE TRIP DETAILS' : '+ TRIP DETAILS'}
                    </button>
                    {openDetailsFor === m.matchNumber && (
                      <LogisticsStrip
                        transportMode={visibility.showTransport ? m.transportMode : null}
                        lodging={visibility.showLodging ? m.lodging : null}
                        sleepCity={m.sleepCity}
                      />
                    )}
                  </div>
                )}

                <div className="mt-2 flex flex-wrap items-start gap-1.5">
                  <InlineMatchScore
                    date={m.date}
                    homeTeam={m.homeTeam}
                    awayTeam={m.awayTeam}
                  />
                  {(() => {
                    const groupMatch = m.stage.match(/Group\s+([A-L])/i);
                    if (groupMatch) {
                      return (
                        <button
                          type="button"
                          onClick={() => setOpenStandingsGroup(groupMatch[1].toUpperCase())}
                          className="border border-snap-ash hover:border-snap-yellow text-snap-mist hover:text-snap-yellow font-mono text-[9px] tracking-[0.18em] px-2 py-1 transition-colors"
                        >
                          ↓ GROUP {groupMatch[1].toUpperCase()}
                        </button>
                      );
                    }
                    return (
                      <a
                        href={groupStandingsSearch(m.stage)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="border border-snap-ash hover:border-snap-yellow text-snap-mist hover:text-snap-yellow font-mono text-[9px] tracking-[0.18em] px-2 py-1 transition-colors"
                      >
                        ↗ BRACKET
                      </a>
                    );
                  })()}
                </div>

                {m.result && m.result.status !== 'scheduled' && (() => {
                  const hs = m.result.homeScore;
                  const as = m.result.awayScore;
                  const homeWon = hs !== null && as !== null && hs > as;
                  const awayWon = hs !== null && as !== null && as > hs;
                  return (
                    <div className="mt-3 border border-snap-ash bg-snap-black/50 p-3">
                      <div className="font-mono text-[9px] tracking-[0.18em] text-snap-mist">
                        {m.result.status === 'final' ? 'FINAL SCORE' : m.result.status.toUpperCase()}
                      </div>
                      <div className="mt-1 flex items-baseline justify-between gap-2">
                        <span
                          className={`font-mono text-xs ${
                            homeWon ? 'text-snap-yellow font-bold' : awayWon ? 'text-snap-fog' : 'text-snap-chalk'
                          }`}
                        >
                          {m.homeTeam}
                        </span>
                        <span className="stat-number text-[28px] leading-none">
                          <span className={homeWon ? 'text-snap-yellow' : awayWon ? 'text-snap-fog' : 'text-snap-chalk'}>
                            {hs ?? '—'}
                          </span>
                          <span className="text-snap-mist mx-2 text-base">·</span>
                          <span className={awayWon ? 'text-snap-yellow' : homeWon ? 'text-snap-fog' : 'text-snap-chalk'}>
                            {as ?? '—'}
                          </span>
                        </span>
                        <span
                          className={`font-mono text-xs text-right ${
                            awayWon ? 'text-snap-yellow font-bold' : homeWon ? 'text-snap-fog' : 'text-snap-chalk'
                          }`}
                        >
                          {m.awayTeam}
                        </span>
                      </div>
                      {m.result.notes && (
                        <div className="mt-2 font-mono text-[10px] italic text-snap-mist">
                          {m.result.notes}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {m.youtubeId ? (
                  <div className="mt-3 relative w-full" style={{ paddingBottom: '56.25%' }}>
                    <iframe
                      src={`https://www.youtube.com/embed/${m.youtubeId}`}
                      title={`Casey at ${stadium.name}`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="absolute inset-0 h-full w-full border border-snap-ash"
                    />
                  </div>
                ) : (
                  <div className="mt-3 flex h-24 items-center justify-center border border-dashed border-snap-ash text-snap-mist font-mono text-[10px] tracking-[0.18em]">
                    VIDEO COMING SOON · DAY {m.dayNumber}
                  </div>
                )}
              </div>
              </article>
            );
          })}
          </div>

          {/* Pagination dots — only when more than 1 match. */}
          {matches.length > 1 && (
            <div className="flex items-center justify-between gap-3 px-5 py-2.5 border-t border-snap-ash bg-snap-coal">
              <button
                type="button"
                onClick={() => goToIndex(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
                className="font-mono text-[14px] text-snap-mist hover:text-snap-yellow disabled:opacity-25 disabled:hover:text-snap-mist transition-colors leading-none"
                aria-label="Previous match"
              >
                ‹
              </button>
              <div className="flex items-center gap-2 flex-1 justify-center">
                <span className="font-mono text-[10px] tracking-[0.22em] text-snap-yellow tabular-nums">
                  {String(currentIndex + 1).padStart(2, '0')} / {String(matches.length).padStart(2, '0')}
                </span>
                <div className="flex items-center gap-1">
                  {matches.map((m, i) => (
                    <button
                      key={m.matchNumber}
                      type="button"
                      onClick={() => goToIndex(i)}
                      className={`h-1.5 rounded-full transition-all ${
                        i === currentIndex
                          ? 'w-5 bg-snap-yellow'
                          : 'w-1.5 bg-snap-ash hover:bg-snap-mist'
                      }`}
                      aria-label={`Match ${m.matchNumber}`}
                    />
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => goToIndex(Math.min(matches.length - 1, currentIndex + 1))}
                disabled={currentIndex === matches.length - 1}
                className="font-mono text-[14px] text-snap-mist hover:text-snap-yellow disabled:opacity-25 disabled:hover:text-snap-mist transition-colors leading-none"
                aria-label="Next match"
              >
                ›
              </button>
            </div>
          )}
        </div>

        {/* Casey's Agenda + Casey's Bets — triggers; each opens its own modal. */}
        {currentMatch && (
          <div className="grid grid-cols-1 gap-2.5 bg-snap-black/40 px-4 py-3">
            <button
              type="button"
              onClick={() => {
                setOpenAgendaFor(currentMatch.matchNumber);
                setOpenBetsFor(null);
              }}
              className="group flex items-center justify-between border border-snap-ash bg-snap-coal px-4 py-3.5 transition-colors hover:border-snap-yellow hover:bg-snap-smoke/40"
            >
              <span className="font-display text-[20px] sm:text-[22px] tracking-wide text-snap-chalk transition-colors group-hover:text-snap-yellow">
                CASEY&apos;S AGENDA
              </span>
              <span className="font-mono text-[10px] tracking-[0.2em] text-snap-mist transition-colors group-hover:text-snap-yellow">
                GAMEDAY →
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOpenBetsFor(currentMatch.matchNumber);
                setOpenAgendaFor(null);
              }}
              className="group flex items-center justify-between border border-snap-yellow/50 bg-gradient-to-r from-snap-yellow/10 to-snap-coal px-4 py-3.5 transition-colors hover:border-snap-yellow hover:from-snap-yellow/20"
            >
              <span className="font-display text-[20px] sm:text-[22px] tracking-wide text-snap-yellow">
                CASEY&apos;S BETS
              </span>
              <span className="font-mono text-[10px] tracking-[0.2em] text-snap-mist transition-colors group-hover:text-snap-yellow">
                UNDERDOG →
              </span>
            </button>
          </div>
        )}
      </aside>

      <style>{`
        @keyframes drawer-slide {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @media (max-width: 640px) {
          aside {
            animation: drawer-slide-up 280ms cubic-bezier(0.2,0.8,0.2,1) !important;
          }
          @keyframes drawer-slide-up {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
        }
      `}</style>
      {openStandingsGroup && (
        <StandingsModal
          group={openStandingsGroup}
          onClose={() => setOpenStandingsGroup(null)}
        />
      )}
      {currentMatch && openAgendaFor === currentMatch.matchNumber && (
        <CaseyInfoModal title="CASEY'S AGENDA" onClose={() => setOpenAgendaFor(null)}>
          <div className="py-8 text-center font-mono text-[12px] leading-relaxed tracking-[0.14em] text-snap-mist">
            Casey&apos;s gameday agenda — coming soon.
          </div>
        </CaseyInfoModal>
      )}
      {currentMatch && openBetsFor === currentMatch.matchNumber && (
        <CaseyInfoModal title="CASEY'S BETS" onClose={() => setOpenBetsFor(null)}>
          {currentMatch.betSlipImage ? (
            <div className="space-y-4">
              <img
                src={currentMatch.betSlipImage}
                alt="Casey's Underdog pick"
                className="w-full rounded border border-snap-ash"
              />
              <a
                href={underdogReferral || 'https://underdogfantasy.com'}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-snap-yellow px-4 py-3.5 text-center font-display text-[24px] tracking-wide text-snap-black transition-colors hover:bg-snap-yellowDim"
              >
                MAKE THIS PICK ON UNDERDOG →
              </a>
            </div>
          ) : (
            <div className="py-8 text-center font-mono text-[12px] tracking-[0.14em] text-snap-mist">
              Casey hasn&apos;t dropped his bet for this game yet.
            </div>
          )}
        </CaseyInfoModal>
      )}
    </div>
  );
}

function CaseyInfoModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div
        className="relative w-full max-w-sm overflow-y-auto border border-snap-ash bg-snap-coal no-scrollbar"
        style={{ maxHeight: '88vh' }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-snap-ash bg-snap-coal px-4 py-3">
          <h3 className="font-display text-[26px] leading-none tracking-wide text-snap-yellow">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center border border-snap-ash text-snap-mist transition-colors hover:border-snap-yellow hover:text-snap-yellow"
          >
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2">
      <div className="font-mono text-[9px] tracking-[0.15em] text-snap-mist">{label}</div>
      <div className="stat-number text-snap-chalk text-sm mt-0.5">{value}</div>
    </div>
  );
}

function LogisticsStrip({
  transportMode,
  lodging,
  sleepCity,
}: {
  transportMode?: import('@/lib/types').TransportMode | null;
  lodging?: import('@/lib/types').Lodging | null;
  sleepCity: string;
}) {
  if (!transportMode && !lodging) return null;

  const transportIcon =
    transportMode === 'train' ? '🚂' : transportMode === 'flight' ? '✈' : null;
  const transportLabel =
    transportMode === 'train'
      ? 'AMTRAK IN'
      : transportMode === 'flight'
      ? 'FLIGHT IN'
      : null;

  const lodgingIcon =
    lodging?.type === 'home'
      ? '🏠'
      : lodging?.type === 'friends' || lodging?.type === 'family'
      ? '🛋'
      : lodging?.type === 'redeye'
      ? '✈'
      : '🛏';

  return (
    <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5 animate-detail-reveal">
      {transportMode && (
        <div className="flex items-center gap-1.5 bg-snap-black/40 border-l-2 border-snap-yellow/60 px-2 py-1">
          <span className="text-snap-yellow text-[12px]" aria-hidden="true">
            {transportIcon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[8px] tracking-[0.18em] text-snap-mist">
              {transportLabel}
            </div>
            <div className="font-mono text-[10px] tracking-[0.12em] text-snap-chalk truncate uppercase">
              {transportMode === 'train' ? 'RAIL TO ' : 'FLIGHT TO '}
              {sleepCity.toUpperCase()}
            </div>
          </div>
        </div>
      )}
      {lodging && (
        <div className="flex items-center gap-1.5 bg-snap-black/40 border-l-2 border-snap-fog/60 px-2 py-1">
          <span className="text-snap-chalk text-[12px]" aria-hidden="true">
            {lodgingIcon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[8px] tracking-[0.18em] text-snap-mist">
              {lodging.type === 'redeye' ? 'OVERNIGHT' : 'SLEEPS AT'}
            </div>
            <div className="font-mono text-[10px] tracking-[0.12em] text-snap-chalk truncate uppercase">
              {lodging.name.toUpperCase()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
