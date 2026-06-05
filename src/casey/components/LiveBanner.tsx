
import { useEffect, useMemo, useState } from 'react';
import type { ItineraryMatch } from '@/lib/types';

interface Props {
  itinerary: ItineraryMatch[];
  onOpenMatch: (matchNumber: number) => void;
}

interface BannerMessage {
  key: string;
  title: string;
  subtitle?: string;
  cta?: { label: string; matchNumber: number };
  tone: 'live' | 'final' | 'info';
}

const DISMISS_KEY_PREFIX = 'casey-tracker-banner-dismiss-';

function computeBanner(itinerary: ItineraryMatch[], now: Date): BannerMessage | null {
  const liveMatch = itinerary.find((m) => m.result?.status === 'live');
  if (liveMatch) {
    return {
      key: `live-${liveMatch.matchNumber}`,
      title: `🔴 LIVE NOW · ${liveMatch.match.toUpperCase()}`,
      subtitle: `Match ${liveMatch.matchNumber} · ${liveMatch.stage}`,
      cta: { label: 'OPEN MATCH', matchNumber: liveMatch.matchNumber },
      tone: 'live',
    };
  }

  const finalMatch = itinerary.find((m) => m.stage === 'FINAL');
  if (finalMatch && finalMatch.date) {
    const today = now.toISOString().slice(0, 10);
    if (today === finalMatch.date) {
      return {
        key: `final-day-${finalMatch.matchNumber}`,
        title: 'WORLD CUP FINAL TODAY',
        subtitle: `${finalMatch.match} at the host stadium`,
        cta: { label: 'OPEN FINAL', matchNumber: finalMatch.matchNumber },
        tone: 'final',
      };
    }
    const finalDate = new Date(finalMatch.date + 'T12:00:00Z');
    const dayMs = 24 * 60 * 60 * 1000;
    if (
      finalDate.getTime() - now.getTime() > 0 &&
      finalDate.getTime() - now.getTime() < dayMs
    ) {
      return {
        key: `final-tomorrow-${finalMatch.matchNumber}`,
        title: 'WORLD CUP FINAL TOMORROW',
        subtitle: 'One more day · the trip culminates',
        cta: { label: 'OPEN FINAL', matchNumber: finalMatch.matchNumber },
        tone: 'final',
      };
    }
  }

  return null;
}

export default function LiveBanner({ itinerary, onOpenMatch }: Props) {
  const [now, setNow] = useState(() => new Date());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(DISMISS_KEY_PREFIX)) {
          keys.push(k.slice(DISMISS_KEY_PREFIX.length));
        }
      }
      setDismissed(new Set(keys));
    } catch {
      // ignore
    }
  }, []);

  const banner = useMemo(() => computeBanner(itinerary, now), [itinerary, now]);

  if (!banner || dismissed.has(banner.key)) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY_PREFIX + banner.key, '1');
    } catch {
      // ignore
    }
    setDismissed((s) => new Set(s).add(banner.key));
  };

  const toneCls =
    banner.tone === 'live'
      ? 'border-live bg-live/10 text-live'
      : banner.tone === 'final'
      ? 'border-snap-yellow bg-snap-yellow/10 text-snap-yellow'
      : 'border-snap-ash bg-snap-black/85 text-snap-chalk';

  return (
    <div className="pointer-events-auto absolute left-0 right-0 top-0 z-30 px-3 pt-3 sm:px-5 sm:pt-4">
      <div
        className={`flex items-center justify-between gap-3 border ${toneCls} px-3 py-2 sm:px-4 sm:py-2.5`}
        style={{ animation: 'banner-drop 320ms cubic-bezier(0.2,0.9,0.2,1)' }}
      >
        <div className="min-w-0 flex-1">
          <div className="font-display text-[18px] sm:text-[22px] leading-tight truncate">
            {banner.title}
          </div>
          {banner.subtitle && (
            <div className="font-mono text-[10px] tracking-[0.18em] text-snap-mist mt-0.5 truncate">
              {banner.subtitle}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {banner.cta && (
            <button
              type="button"
              onClick={() => onOpenMatch(banner.cta!.matchNumber)}
              className="font-mono text-[10px] tracking-[0.18em] underline underline-offset-2 hover:no-underline"
            >
              {banner.cta.label}
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="flex h-8 w-8 items-center justify-center border border-current opacity-70 hover:opacity-100"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
