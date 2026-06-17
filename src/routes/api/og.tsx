import { createFileRoute } from '@tanstack/react-router';
import satori from 'satori';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
// Native @resvg/resvg-js can't load in Cloudflare Workers (no native .node
// addons), so we use the WASM build. The .wasm import resolves to a
// WebAssembly.Module in the worker environment; initWasm() must run once
// before any Resvg use.
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
// Satori fonts, BUNDLED (not fetched) so OG generation has no runtime network
// dependency. `?inline` makes Vite embed the woff as a base64 data URI at build
// time. Satori supports ttf/otf/woff (not woff2). Bebas Neue is the display face;
// Barlow is the site's own body font (replaces the old CDN-only Inter).
import bebasWoff from '@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff?inline';
import barlowWoff from '@fontsource/barlow/files/barlow-latin-700-normal.woff?inline';
import { getPositionOverride, getAllResults } from '@/lib/server/kv';
import { computeCaseyLocation } from '@/lib/location';
import { computeTripStats } from '@/lib/stats';
import { STADIUMS, ITINERARY } from '@/lib/itinerary';
import { withEdgeCache } from '#/lib/server/edgeCache';

const W = 1200;
const H = 630;

// Decode a base64 data URI ("data:font/woff;base64,…") to the ArrayBuffer Satori
// wants. Runs once at module load — no fetch, no per-request work.
function dataUriToArrayBuffer(uri: string): ArrayBuffer {
  const binary = atob(uri.slice(uri.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
const FONTS = [
  { name: 'Bebas Neue', data: dataUriToArrayBuffer(bebasWoff), weight: 400 as const, style: 'normal' as const },
  { name: 'Barlow', data: dataUriToArrayBuffer(barlowWoff), weight: 700 as const, style: 'normal' as const },
];

// initWasm throws if called more than once, so share a single init promise
// across requests for the life of the worker.
let resvgReady: Promise<void> | null = null;
function ensureResvg() {
  if (!resvgReady) resvgReady = initWasm(resvgWasm);
  return resvgReady;
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
        const reqUrl = new URL(request.url);
        // Normalize the cache key to ONLY the meaningful param (an integer
        // `match`). Junk/cache-busting params (?match=5&utm=…, ?match=5&x=2)
        // would otherwise each become a distinct cache entry and force a fresh
        // satori + resvg render — a CPU/cost amplification vector on the one
        // expensive, publicly-reachable, edge-cached endpoint.
        const matchInt = reqUrl.searchParams.get('match');
        const normalizedMatch = matchInt && /^\d+$/.test(matchInt) ? matchInt : '';
        const cacheKey =
          `${reqUrl.origin}${reqUrl.pathname}` + (normalizedMatch ? `?match=${normalizedMatch}` : '');
        return withEdgeCache(
          request,
          { edgeTtlSeconds: 300, browserMaxAge: 120, swrSeconds: 600, cacheKey },
          async () => {
        const matchParam = reqUrl.searchParams.get('match');
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

        await ensureResvg();
        const fonts = FONTS;

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
              fontFamily: 'Barlow',
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
                          fontFamily: 'Barlow',
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
                          fontFamily: 'Barlow',
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
                          fontFamily: 'Barlow',
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
        // asPng() returns a Uint8Array viewing WASM linear memory; copy the
        // bytes into a standalone ArrayBuffer so the Response owns stable data.
        const png = pngBuf.buffer.slice(
          pngBuf.byteOffset,
          pngBuf.byteOffset + pngBuf.byteLength,
        ) as ArrayBuffer;

        return new Response(png, {
          headers: { 'Content-Type': 'image/png' },
        });
          },
        );
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
            style: { fontSize: 18, letterSpacing: 3, color: '#8A8A8A', fontFamily: 'Barlow' },
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
