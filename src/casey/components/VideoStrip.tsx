
import type { ItineraryMatch } from '@/lib/types';

interface Props {
  itinerary: ItineraryMatch[];
  onMatchClick: (matchNumber: number) => void;
}

export default function VideoStrip({ itinerary, onMatchClick }: Props) {
  const videos = itinerary
    .filter((m) => m.youtubeId)
    .slice()
    .reverse()
    .slice(0, 12);

  if (videos.length === 0) return null;

  return (
    <div
      className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-full px-3 sm:bottom-5 sm:max-w-[640px]"
      data-map-overlay="bottom"
    >
      <div className="pointer-events-auto border border-snap-ash bg-snap-black/85 backdrop-blur-sm">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-snap-ash">
          <div className="flex items-center gap-2 font-mono text-[9px] tracking-[0.22em]">
            <span className="block h-1.5 w-1.5 rounded-full bg-snap-yellow" />
            <span className="text-snap-yellow">LATEST VLOGS</span>
            <span className="text-snap-mist">· {videos.length}</span>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar p-2 snap-x">
          {videos.map((m) => (
            <button
              key={m.matchNumber}
              type="button"
              onClick={() => onMatchClick(m.matchNumber)}
              className="group relative flex-shrink-0 snap-start w-[124px] sm:w-[140px] aspect-video overflow-hidden border border-snap-ash hover:border-snap-yellow transition-colors text-left"
            >
              <img
                src={`https://i.ytimg.com/vi/${m.youtubeId}/mqdefault.jpg`}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.9) 100%)',
                }}
              />
              <div className="absolute top-1.5 left-1.5 flex h-5 w-5 items-center justify-center bg-snap-yellow text-snap-black opacity-90 group-hover:opacity-100">
                <svg viewBox="0 0 10 10" className="h-2.5 w-2.5 fill-current">
                  <path d="M2 1 L9 5 L2 9 Z" />
                </svg>
              </div>
              <div className="absolute bottom-1 left-1.5 right-1.5">
                <div className="font-mono text-[8px] tracking-[0.18em] text-snap-yellow">
                  DAY {m.dayNumber}
                </div>
                <div className="font-mono text-[9px] text-snap-chalk leading-tight line-clamp-2">
                  {m.match}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
