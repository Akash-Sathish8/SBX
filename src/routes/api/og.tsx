import { createFileRoute } from '@tanstack/react-router';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { getPositionOverride, getAllResults } from '@/lib/kv';
import { computeCaseyLocation } from '@/lib/location';
import { computeTripStats } from '@/lib/stats';
import { STADIUMS, ITINERARY } from '@/lib/itinerary';

const W = 1200;
const H = 630;

// Satori needs explicit font ArrayBuffers (no system fonts). We fetch
// woff files (satori supports ttf/otf/woff, not woff2) from a CDN once
// and cache them for the life of the server process.
let fontCache: { name: string; data: ArrayBuffer; weight: 400 | 700; style: 'normal' }[] | null =
  null;

async function loadFonts() {
  if (fontCache) return fontCache;
  const [bebas, inter] = await Promise.all([
    fetch('https://cdn.jsdelivr.net/npm/@fontsource/bebas-neue@5.0.0/files/bebas-neue-latin-400-normal.woff').then(
      (r) => r.arrayBuffer(),
    ),
    fetch('https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.0/files/inter-latin-700-normal.woff').then(
      (r) => r.arrayBuffer(),
    ),
  ]);
  fontCache = [
    { name: 'Bebas Neue', data: bebas, weight: 400, style: 'normal' },
    { name: 'Inter', data: inter, weight: 700, style: 'normal' },
  ];
  return fontCache;
}

function tagFor(state: string): { color: string; label: string } {
  switch (state) {
    case 'at-stadium':
      return { color: '#FF3838', label: 'LIVE · AT MATCH' };
    case 'in-transit':
      return { color: '#FFD400', label: 'IN TRANSIT' };
    case 'at-hotel':
      return { color: '#FFD400', label: 'BETWEEN MATCHES' };
    case 'pre-trip':
      return { color: '#8A8A8A', label: 'PRE-TOURNAMENT' };
    default:
      return { color: '#8A8A8A', label: 'TRIP COMPLETE' };
  }
}

export const Route = createFileRoute('/api/og')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const matchParam = url.searchParams.get('match');
        const targetMatchNumber = matchParam ? Number(matchParam) : null;

        const [override, results] = await Promise.all([
          getPositionOverride(),
          getAllResults(),
        ]);
        const now = new Date();
        const location = computeCaseyLocation(now, override);
        const stats = computeTripStats(now, location, results);

        const focusMatch =
          targetMatchNumber != null
            ? ITINERARY.find((m) => m.matchNumber === targetMatchNumber) ?? null
            : null;
        const focusStadium = focusMatch ? STADIUMS[focusMatch.stadiumId] : null;

        const tag = tagFor(location.state);
        const headline = focusMatch
          ? `${focusMatch.homeTeam.toUpperCase()} VS ${focusMatch.awayTeam.toUpperCase()}`
          : 'CASEY TRACKER';
        const sub = focusMatch
          ? `${focusStadium?.name ?? 'TBD'}${focusStadium?.city ? ' · ' + focusStadium.city : ''}`
          : 'One Game. Every Day. · World Cup 2026';

        const fonts = await loadFonts();

        const element = {
          type: 'div',
          props: {
            style: {
              width: W,
              height: H,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, #141414 0%, #0a0a0a 55%, #1f1f1f 100%)',
              padding: 64,
              fontFamily: 'Inter',
            },
            children: [
              // top row: brand + tag
              {
                type: 'div',
                props: {
                  style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          fontSize: 22,
                          letterSpacing: 4,
                          color: '#FFD400',
                          fontFamily: 'Inter',
                        },
                        children: 'SNAPBACK SPORTS · WORLD CUP 2026',
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          fontSize: 20,
                          letterSpacing: 3,
                          color: tag.color,
                          border: `2px solid ${tag.color}`,
                          padding: '8px 16px',
                          fontFamily: 'Inter',
                        },
                        children: tag.label,
                      },
                    },
                  ],
                },
              },
              // headline
              {
                type: 'div',
                props: {
                  style: { display: 'flex', flexDirection: 'column' },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          fontSize: 96,
                          color: '#E8E8E8',
                          fontFamily: 'Bebas Neue',
                          lineHeight: 1,
                        },
                        children: headline,
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: {
                          fontSize: 28,
                          color: '#8A8A8A',
                          marginTop: 16,
                          fontFamily: 'Inter',
                        },
                        children: sub,
                      },
                    },
                  ],
                },
              },
              // bottom stat row
              {
                type: 'div',
                props: {
                  style: { display: 'flex', gap: 48, alignItems: 'flex-end' },
                  children: [
                    statBlock('DAY', `${stats.dayNumber} / ${stats.daysTotal}`),
                    statBlock('MATCHES', `${stats.matchesAttended} / ${stats.matchesTotal}`),
                    statBlock('MILES', stats.milesFlown.toLocaleString()),
                    statBlock('STADIUMS', `${stats.stadiumsVisited} / ${stats.stadiumsTotal}`),
                  ],
                },
              },
            ],
          },
        };

        const svg = await satori(element as any, {
          width: W,
          height: H,
          fonts: fonts as any,
        });

        const pngBuf = new Resvg(svg, { fitTo: { mode: 'width', value: W } })
          .render()
          .asPng();
        // Copy into a guaranteed ArrayBuffer (Buffer.buffer may be SharedArrayBuffer).
        const png = pngBuf.buffer.slice(
          pngBuf.byteOffset,
          pngBuf.byteOffset + pngBuf.byteLength,
        ) as ArrayBuffer;

        return new Response(png, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=120, s-maxage=120',
          },
        });
      },
    },
  },
});

function statBlock(label: string, value: string) {
  return {
    type: 'div',
    props: {
      style: { display: 'flex', flexDirection: 'column' },
      children: [
        {
          type: 'div',
          props: {
            style: { fontSize: 18, letterSpacing: 3, color: '#8A8A8A', fontFamily: 'Inter' },
            children: label,
          },
        },
        {
          type: 'div',
          props: {
            style: { fontSize: 52, color: '#FFD400', fontFamily: 'Bebas Neue', lineHeight: 1 },
            children: value,
          },
        },
      ],
    },
  };
}
