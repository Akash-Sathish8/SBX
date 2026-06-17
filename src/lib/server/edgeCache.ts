// Edge caching for a Worker's *computed output* on Cloudflare.
//
// Use this when the cost is the Worker's own work (CPU, assembly) rather than an
// upstream fetch — primarily the OG image render (satori + resvg), which has no
// subrequest to cache. For routes whose cost is a third-party GET (the ESPN
// proxies), cache at the `fetch` layer instead via `cf: { cacheTtl }` (see
// espn.ts) — that's shared by URL across routes and isolates.
//
// A Worker's generated response is NOT stored in Cloudflare's cache by default,
// so a bare `Cache-Control: s-maxage=…` header is inert. This helper uses the
// Cache API (`caches.default`) to actually store the response at the edge, keyed
// by request URL. Note `caches.default` derives its entry TTL from the response's
// `s-maxage`/`max-age` and does NOT itself honor `stale-while-revalidate` — that
// directive only benefits the browser/downstream shared caches. Falls back to
// just producing the response when the Cache API is unavailable (Node/vitest) or
// the request isn't a cacheable GET.

interface EdgeCacheOpts {
  /** How long the edge should serve this from cache (s-maxage). */
  edgeTtlSeconds: number;
  /** Browser cache lifetime (max-age). 0 = always revalidate (default). */
  browserMaxAge?: number;
  /** stale-while-revalidate window. */
  swrSeconds?: number;
  /**
   * Override the cache key (defaults to the request itself). Pass a normalized
   * URL/Request to collapse away cache-busting junk query params — otherwise an
   * attacker can append `?x=1`, `?x=2`, … to multiply cache entries and force
   * the (expensive) producer to re-run per unique URL. Always GET.
   */
  cacheKey?: Request | string;
}

export async function withEdgeCache(
  request: Request,
  opts: EdgeCacheOpts,
  produce: () => Promise<Response>,
): Promise<Response> {
  const cache = typeof caches !== 'undefined' ? caches.default : undefined;
  if (!cache || request.method !== 'GET') return produce();

  const key = opts.cacheKey
    ? typeof opts.cacheKey === 'string'
      ? new Request(opts.cacheKey)
      : opts.cacheKey
    : request;

  const hit = await cache.match(key);
  if (hit) return hit;

  const res = await produce();
  // Only cache successful responses; pass errors straight through.
  if (!res.ok) return res;

  const { edgeTtlSeconds, browserMaxAge = 0, swrSeconds } = opts;
  const headers = new Headers(res.headers);
  headers.set(
    'Cache-Control',
    `public, max-age=${browserMaxAge}, s-maxage=${edgeTtlSeconds}` +
      (swrSeconds ? `, stale-while-revalidate=${swrSeconds}` : ''),
  );

  const toCache = new Response(res.body, { status: res.status, headers });
  const toReturn = toCache.clone();
  await cache.put(key, toCache);
  return toReturn;
}
