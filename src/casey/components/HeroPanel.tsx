
import { useEffect, useRef, useState } from 'react';
import { formatCountdown } from '@/lib/stats';
import type { CaseyLocation, ItineraryMatch, TripStats } from '@/lib/types';

interface Props {
  location: CaseyLocation;
  stats: TripStats;
  itinerary: ItineraryMatch[];
  onOpenMatch: (matchNumber: number) => void;
}

interface HeroContent {
  tone: 'live' | 'transit' | 'rest' | 'pre' | 'post';
  tagText: string;
  bigText: string;
  scriptText?: string;
  metaLeft?: string;
  metaRight?: string;
  cta?: { label: string; matchNumber: number };
  progressPercent?: number;
}

function buildHero(
  location: CaseyLocation,
  stats: TripStats,
  itinerary: ItineraryMatch[],
  liveCountdownMs: number | null,
): HeroContent {
  const nextMatch = itinerary.find((m) => m.matchNumber === stats.nextMatchNumber) ?? null;
  const currentMatch = location.currentMatchNumber
    ? itinerary.find((m) => m.matchNumber === location.currentMatchNumber) ?? null
    : null;

  const countdown = formatCountdown(liveCountdownMs);

  switch (location.state) {
    case 'pre-trip':
      return {
        tone: 'pre',
        tagText: '◷ TOURNAMENT LOADING',
        bigText: countdown.toUpperCase(),
        scriptText: 'till mexico vs south africa',
        metaLeft: 'JUN 11 · 3PM CDT',
        metaRight: 'ESTADIO AZTECA',
        cta: nextMatch ? { label: 'OPENER', matchNumber: nextMatch.matchNumber } : undefined,
      };
    case 'at-stadium': {
      return {
        tone: 'live',
        tagText: '● LIVE · IN THE STADIUM',
        bigText: currentMatch
          ? `${currentMatch.homeTeam.toUpperCase()} VS ${currentMatch.awayTeam.toUpperCase()}`
          : 'AT MATCH',
        scriptText: currentMatch?.match.toLowerCase() ?? '',
        metaLeft: currentMatch?.stage.toUpperCase(),
        metaRight: 'CASEY IS HERE',
        cta: currentMatch
          ? { label: 'OPEN MATCH', matchNumber: currentMatch.matchNumber }
          : undefined,
      };
    }
    case 'in-transit': {
      const isTrain = nextMatch?.transportMode === 'train';
      return {
        tone: 'transit',
        tagText: isTrain ? '🚂 ON THE RAILS' : '✈ WHEELS UP',
        bigText: nextMatch
          ? `${nextMatch.homeTeam.toUpperCase()} VS ${nextMatch.awayTeam.toUpperCase()}`
          : 'EN ROUTE',
        scriptText: nextMatch ? `kickoff in ${countdown.toLowerCase()}` : 'in the air',
        metaLeft: nextMatch
          ? `${location.progressPercent ?? 0}% ${isTrain ? 'ALONG' : 'AIRBORNE'}`
          : undefined,
        metaRight: nextMatch?.match.toUpperCase(),
        cta: nextMatch ? { label: 'NEXT MATCH', matchNumber: nextMatch.matchNumber } : undefined,
        progressPercent: location.progressPercent,
      };
    }
    case 'at-hotel': {
      const city = location.description
        .replace(/^(off day in|posted up in|day off in|chilling in|resting in|in)\s/i, '')
        .toUpperCase();
      return {
        tone: 'rest',
        tagText: '☕ OFF DAY',
        bigText: city || 'BETWEEN MATCHES',
        scriptText: nextMatch ? `up next in ${countdown.toLowerCase()}` : 'casey is offline',
        metaLeft: nextMatch?.match.toUpperCase(),
        metaRight: nextMatch ? `${nextMatch.date}` : undefined,
        cta: nextMatch ? { label: 'NEXT MATCH', matchNumber: nextMatch.matchNumber } : undefined,
      };
    }
    case 'post-trip':
      return {
        tone: 'post',
        tagText: '🎬 WRAPPED',
        bigText: '34 / 34',
        scriptText: 'casey survived the world cup',
        metaLeft: 'JUN 11 — JUL 19',
        metaRight: '@SNAPBACKSPORTS',
      };
  }
}

function useTickingCountdown(initial: number | null): number | null {
  const [ms, setMs] = useState(initial);
  useEffect(() => {
    setMs(initial);
  }, [initial]);
  useEffect(() => {
    if (ms === null) return;
    const id = setInterval(() => {
      setMs((prev) => (prev === null ? null : Math.max(0, prev - 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [ms === null]);
  return ms;
}

export default function HeroPanel({ location, stats, itinerary, onOpenMatch }: Props) {
  const countdownMs = useTickingCountdown(stats.nextMatchInMs);
  const hero = buildHero(location, stats, itinerary, countdownMs);

  const prevBigText = useRef(hero.bigText);
  const [animating, setAnimating] = useState(false);
  useEffect(() => {
    if (prevBigText.current !== hero.bigText) {
      setAnimating(true);
      const t = setTimeout(() => setAnimating(false), 600);
      prevBigText.current = hero.bigText;
      return () => clearTimeout(t);
    }
  }, [hero.bigText]);

  const toneClass =
    hero.tone === 'live'
      ? 'border-l-live'
      : hero.tone === 'transit'
      ? 'border-l-snap-yellow'
      : hero.tone === 'rest'
      ? 'border-l-snap-yellow'
      : hero.tone === 'post'
      ? 'border-l-snap-fog'
      : 'border-l-snap-mist';

  const tagClass =
    hero.tone === 'live'
      ? 'text-live'
      : hero.tone === 'transit' || hero.tone === 'rest'
      ? 'text-snap-yellow'
      : 'text-snap-mist';

  return (
    <div
      className={`pointer-events-auto relative overflow-hidden bg-gradient-to-br from-snap-black/85 via-snap-coal/80 to-snap-black/85 backdrop-blur-sm border-l-4 ${toneClass}`}
      style={{
        boxShadow: hero.tone === 'live' ? '0 0 24px rgba(255,56,56,0.15)' : '0 4px 24px rgba(0,0,0,0.6)',
      }}
    >
      {hero.tone === 'live' && (
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute -top-12 -right-12 w-32 h-32 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(255,56,56,0.25) 0%, transparent 70%)',
            }}
          />
        </div>
      )}

      <div className="relative px-3 pt-2.5 pb-3 sm:px-4">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`font-mono text-[10px] tracking-[0.24em] font-medium ${tagClass} ${
              hero.tone === 'live' ? 'animate-pulse-live' : ''
            }`}
          >
            {hero.tagText}
          </span>
          {hero.cta && (
            <button
              type="button"
              onClick={() => onOpenMatch(hero.cta!.matchNumber)}
              className="font-mono text-[9px] tracking-[0.22em] text-snap-mist hover:text-snap-yellow transition-colors"
            >
              {hero.cta.label} →
            </button>
          )}
        </div>

        <div
          key={hero.bigText}
          className={`font-display leading-[0.95] mt-1.5 text-snap-chalk break-words ${
            animating ? 'animate-hero-swap' : ''
          }`}
          style={{
            fontSize: 'clamp(28px, 5.5vw, 44px)',
            letterSpacing: '-0.01em',
            textShadow: hero.tone === 'live' ? '0 0 20px rgba(255,56,56,0.3)' : 'none',
          }}
        >
          {hero.bigText}
        </div>

        {hero.scriptText && (
          <div className="font-body italic text-snap-mist text-[12px] sm:text-[13px] mt-0.5">
            {hero.scriptText}
          </div>
        )}

        {hero.progressPercent !== undefined && (
          <div className="mt-2.5 flex items-center gap-2">
            <div className="h-[3px] flex-1 bg-snap-ash overflow-hidden">
              <div
                className="h-full bg-snap-yellow transition-[width] duration-1000"
                style={{ width: `${hero.progressPercent}%` }}
              />
            </div>
            <span className="stat-number text-snap-yellow text-[11px]">{hero.progressPercent}%</span>
          </div>
        )}

        {(hero.metaLeft || hero.metaRight) && (
          <div className="mt-2 flex items-center justify-between gap-3 font-mono text-[9px] tracking-[0.18em] text-snap-fog">
            {hero.metaLeft && <span className="truncate">{hero.metaLeft}</span>}
            {hero.metaRight && <span className="truncate text-right">{hero.metaRight}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
