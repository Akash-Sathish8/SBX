import { createFileRoute } from '@tanstack/react-router';
import type { R2Bucket, R2Range } from '@cloudflare/workers-types';

// Serves the Protomaps basemap (a single .pmtiles extract) from R2 with HTTP
// Range support, so maplibre's pmtiles protocol can read the directory header
// and individual tiles via byte-range requests. Returns 404 until the extract is
// uploaded (`wrangler r2 object put sbx-tiles/basemap.pmtiles --file=…`); MapView
// falls back to the CARTO style while VITE_MAP_PMTILES_URL is unset.
const KEY = 'basemap.pmtiles';

async function getBucket(): Promise<R2Bucket | null> {
  try {
    const mod = await import('cloudflare:workers');
    return (mod.env?.TILES as R2Bucket | undefined) ?? null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute('/api/basemap')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const bucket = await getBucket();
        if (!bucket) return new Response('tiles bucket not bound', { status: 503 });

        const rangeHeader = request.headers.get('range');
        let range: R2Range | undefined;
        if (rangeHeader) {
          const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
          if (m) {
            const start = m[1] ? Number(m[1]) : undefined;
            const end = m[2] ? Number(m[2]) : undefined;
            if (start !== undefined && end !== undefined) range = { offset: start, length: end - start + 1 };
            else if (start !== undefined) range = { offset: start };
            else if (end !== undefined) range = { suffix: end };
          }
        }

        const obj = await bucket.get(KEY, range ? { range } : undefined);
        if (!obj) return new Response('not found', { status: 404 });

        const headers = new Headers();
        headers.set('Content-Type', 'application/octet-stream');
        headers.set('Accept-Ranges', 'bytes');
        headers.set('Cache-Control', 'public, max-age=86400');
        headers.set('Access-Control-Allow-Origin', '*');

        // The R2 stream type (workers-types) differs from lib.dom's ReadableStream
        // in this isomorphic project; cast at the Response boundary only.
        const body = obj.body as unknown as ReadableStream;

        if (rangeHeader && obj.range && 'offset' in obj.range) {
          const offset = (obj.range as { offset?: number }).offset ?? 0;
          const length = (obj.range as { length?: number }).length ?? obj.size - offset;
          headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${obj.size}`);
          headers.set('Content-Length', String(length));
          return new Response(body, { status: 206, headers });
        }
        headers.set('Content-Length', String(obj.size));
        return new Response(body, { headers });
      },
    },
  },
});
