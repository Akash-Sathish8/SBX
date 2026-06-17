# Production-Readiness Work — Session Progress

**App:** WC2026 "Casey Tracker" — TanStack Start (React 19) on Cloudflare Workers (worker `sbx`).
**Why:** About to be exposed on a `snapbacksports.com` subdomain and promoted. Originally built by an intern; this session audits it as a senior engineer and rewrites the parts that aren't production-grade. The tournament is **live** (work done 2026‑06‑16), so changes must not break the running site.

Approved plan: `~/.claude-snapback/plans/this-was-made-by-greedy-eagle.md`.

> Status legend: ✅ done & verified · 🟡 partial/deferred · ⏸️ blocked on external/infra · ❌ not started

---

## Key decisions (with rationale)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Phase the work**: launch-hardening first, then architecture rewrite | Ship safely fast on a live site; de-risk the launch date |
| 2 | **Remove Supabase entirely → Cloudflare KV**, in Phase 1, **start fresh** (no data migration) | KV is native/cheaper/lower-latency on Workers and removes the service-role-key-on-hot-path risk. Admin re-enters current overrides once after cutover (cheap for a daily tracker) |
| 3 | **Admin behind Cloudflare Access** (Zero Trust) | Removes the brute-force / forgeable-token surface; best for an internal admin tool |
| 4 | **Build-time image optimization** (commit optimized assets) | No recurring cost; fully owned; simplest |
| 5 | **Map tiles → Protomaps + R2** (keep `MapView.tsx`). Rejected Google Maps (different engine = full rewrite + per‑load billing) and mapcn (assumes Tailwind/shadcn this app deliberately dropped) | Owned, zero per-tile cost; only the tile `style` URL changes |
| 6 | **Caching is layer-specific**: `cf.cacheTtl` on the ESPN `fetch` (shared upstream cache) + Cache API (`edgeCache.ts`) only for the OG render (CPU output) | Worker responses aren't auto-edge-cached; cache at the layer where the cost actually is |
| 7 | **Build-time-static JSON is imported (bundled), not fetched at runtime** | Bundling SSRs the page for free (SEO) and removes runtime fetches; the intern fetched static data like an API |
| 8 | **Types: small ambient `worker.d.ts` + real `KVNamespace` import**, NOT the full `wrangler types` output | The generated runtime globals clash with `lib.dom` in this isomorphic app (made `Response.json()` return `unknown`, breaking ~54 sites) |
| 9 | **SEO: path-based `/game/$id`, `/venue/$id`** with per-route `head()` meta; legacy `?id=` 307-redirects | Query-param pages index poorly; path routes + SSR'd meta are crawlable |
| 10 | **zod** for `/api/admin/update` payload validation | Idiomatic; added security refinements (block `javascript:` URLs, constrain YouTube id) |

---

## Audit findings (what we identified)

### Caching (the central cost problem)
- Worker-generated API responses are **not** edge-cached by Cloudflare by default → the `s-maxage` headers were **inert**; every request re-hit ESPN / re-rendered OG.
- Static assets (`/img`, `/data`) had **no `max-age`** → repeat visitors re-validated everything.
- `/api/bootstrap` did **~8 Supabase service-role reads per public request**; `/api/live` 3 per poll.
- OG image (`satori`+`resvg-wasm`) re-rendered per request.

### Images
- ~**12 MB** in `public/`, none optimized, no WebP; stadium JPGs 400–475 KB each.
- **Duplicate stadium set** (~4 MB): `public/stadiums/*` (used only by Casey `StadiumDrawer`) vs `public/img/stadiums/*`.

### Client patterns
- **No TanStack Query** despite `react-router-ssr-query` installed; ad-hoc `useEffect`+`fetch` state machines; **no route loaders**; hand-rolled `dataCache.ts`.
- **Polling never paused on hidden tabs** → background tabs kept hitting the Worker.
- maplibre loads **CARTO demo tiles** (not licensed for promoted traffic).

### Security / launch blockers
- **Hardcoded fallback secrets** in `auth.ts` (JWT secret only `warn`ed, didn't fail → forgeable admin tokens if unset).
- **No input validation** on `/api/admin/update`.
- `robots.txt` allowed all; `manifest.json` said "TanStack App"; ngrok hosts left in `vite.config.ts`.

### Skill-based audit (Cloudflare `workers-best-practices` + TanStack skills)
- 🔴 **`src/server/games.ts:7` — module-scope `process.env.TICKETMASTER_API_KEY`** → `undefined` on Workers (env injected per-request). Currently **dead code** (`getGamesFn` unused). Fix: delete the file or read env inside the handler.
- 🟠 **`api/admin/login.ts`** — `password !== getAdminPassword()` is a non-timing-safe compare → use `crypto.subtle.timingSafeEqual`.
- 🟡 Admin auth repeated inline across ~5 routes → should be **server-route middleware** (`createHandlers`).
- 🟡 `edgeCache` `await`s `cache.put` instead of `ctx.waitUntil()` — TanStack server-route handlers don't expose `ctx`; await is the safe fallback.
- 🟡 Add `observability.head_sampling_rate` to `wrangler.jsonc`.
- 🔵 Live `web-perf` trace (LCP/CLS/INP) not run — needs the `chrome-devtools` MCP; run post-deploy.

---

## Progress

### Phase 1 — Launch hardening ✅ (build + 23 tests + SSR smoke all green)
- **1a Security:** `auth.ts` fails closed in prod (no `snapback2026` / `dev-insecure` fallbacks); `/api/admin/update` validated per-action with **zod** (blocks `javascript:` in referral/image fields, constrains YouTube id). Auth gate kept.
- **1b Caching:** `public/_headers` (img/stadiums `immutable` 1yr, data SWR); new `src/lib/edgeCache.ts` (Cache API) wraps **`/api/og`**; ESPN routes use `cf: { cacheEverything, cacheTtl }` at the `fetch` layer (`espn.ts`).
- **1c Images:** `scripts/optimize-images.mjs` (sharp) → **`public/` 12 MB → 4.9 MB**; deduped stadium sets (deleted `public/stadiums/`, repointed `src/casey/data/stadiums.json` to `/img/stadiums/*`).
- **1d Supabase → Cloudflare KV:** `src/casey/lib/kv.ts` reimplemented on Workers KV (same exported signatures, in-memory dev fallback); `@supabase/supabase-js` + all `SUPABASE_*` refs removed; KV binding added to `wrangler.jsonc` (**placeholder ids — must be filled**).
- **1e Hygiene:** `robots.txt` (disallow admin/api, allow `/api/og`), real `manifest.json`, ngrok hosts removed from `vite.config.ts`.

### Phase 2 — Architecture
- **2a Versioned snapshot cache ✅:** `src/casey/lib/snapshot.ts` caches the admin-driven state in `caches.default` keyed by a `data:version` (bumped on every admin write in `update.ts`). `/api/bootstrap` + `/api/live` read the snapshot then compute time-dependent bits → ~8 KV reads/request collapse to ~1 + a cache hit.
- **2b Query + loaders + polling ✅ (high-value scope):** `QueryClient` + `setupRouterSsrQueryIntegration` in `router.tsx`/`__root.tsx`; polling `LiveTodayTab` + `InlineMatchScore` → `useQuery` (`refetchIntervalInBackground:false`); `ClientShell` `/api/live` loop got a visibility-pause; `/games` + `/game` SSR via bundled static data; `/venue` → `useQuery` via `src/lib/queries.ts`. `useMatchScores` left as-is (once-a-day localStorage cache, not a poll).
- **2b cleanup 🟡 deferred (low value):** `agenda.tsx`/`build.tsx` still use `dataCache.getJSON`; `dataCache.ts` not fully retired (they're tools, not SEO pages).
- **2c Remove custom admin auth ⏸️ BLOCKED** on confirming Cloudflare Access is live (else admin would be unprotected).
- **2d Map tiles → Protomaps/R2 ❌ not started** — needs an R2 bucket + a US/CA/MX `.pmtiles` extract (your Cloudflare account); code can be scaffolded.

### Type safety (Cloudflare Workers types) ✅
- Installed `@cloudflare/workers-types`; added ambient `src/worker.d.ts` (declaration-merges `caches.default`, `RequestInit.cf`, the `cloudflare:workers` env module with real `KVNamespace`). Removed all four type casts. `tsc --noEmit` clean for our code (only **pre-existing** `TS6133` unused-var errors remain in `AdminShell.tsx`, `ScheduleDrawer.tsx`, `casey.tsx`). The full `wrangler types` output is gitignored (conflicts with `lib.dom`).

### SEO path routes ✅ (verified)
- `/game?id=X` → **`/game/$id`** (`game_.$id.tsx`), `/venue?id=X` → **`/venue/$id`** (`venue_.$id.tsx`), un-nest `_` convention.
- Per-page SSR'd `head()` meta (title/description/canonical/OG/Twitter) from bundled data + `src/lib/venues-meta.ts`; absolute URLs via `src/lib/site.ts` (`VITE_SITE_URL`).
- Legacy `?id=` routes are 307 redirect stubs; all 5 internal `<Link>`s updated.

### Tooling skills loaded
- Cloudflare skills at `~/.claude/skills/` (`workers-best-practices`, `web-perf`, `wrangler`, …).
- TanStack skills via `@tanstack/intent` (guidance in `AGENTS.md`; skills in `node_modules/@tanstack/*/skills/`).

---

## Outstanding work

### Quick-win fixes
- [x] `src/server/games.ts` — moved `process.env.TICKETMASTER_API_KEY` read into `getGames()` (per-request); `fetchCountry` now takes the key as a param. (Still unused, but no longer a latent Workers bug.)
- [x] `timingSafeEqual` admin password compare — added `verifyAdminPassword()` in `auth.ts` (SHA‑256 digests + `crypto.subtle.timingSafeEqual`); `api/admin/login.ts` uses it. Typed `SubtleCrypto.timingSafeEqual` in `worker.d.ts`.
- [x] `observability.head_sampling_rate: 1` in `wrangler.jsonc` (comment notes lowering for cost at scale).
- [ ] **Deferred — admin-auth → server-route middleware.** Have the API (`createMiddleware().server()` + `server.middleware`), but request middleware returns the chain `Response`/throws → a thrown error is a 500, whereas our inline checks return a clean **401 JSON**. Replicating the 401 needs the short-circuit-return-Response path, which should be verified in the live auth flow (curl/browser), not just a build. It's a DRY cleanup (not a bug) and admin will also be behind Cloudflare Access, so it's queued as its own verified pass.

### Manual / infra steps required before deploy
1. **KV namespace:** `wrangler kv namespace create sbx-kv` (+ `--preview`); paste ids into `wrangler.jsonc`.
2. **Cloudflare Access** policy over `/casey/admin*` + `/api/admin/*` (unblocks 2c).
3. **Worker secrets:** `ADMIN_PASSWORD`, `ADMIN_JWT_SECRET`, `TICKETMASTER_API_KEY` (drop `SUPABASE_*`).
4. **`VITE_SITE_URL`** set at build → absolute OG/canonical URLs (social scrapers need absolute).
5. Admin **re-enters** current results/position/spend after the KV cutover (start-fresh).
6. Post-deploy: verify `cf-cache-status: HIT` + `immutable` headers via `curl -I`; run the `web-perf` trace (add `chrome-devtools` MCP).

### Later phases
- 2d map tiles (Protomaps/R2), 2b cleanup (agenda/build + retire `dataCache`), pre-existing `TS6133` cleanup in 3 files.

---

## Re-audit pass (2026-06-16, session 2)

Senior re-audit of the full tree against the Cloudflare `workers-best-practices`
and TanStack skills. The Phase-1/2 work above was re-verified against the actual
code (not just the notes) and held up. New findings were triaged and the safe,
high-value ones fixed in this pass:

**Fixed (build + 23 tests + `tsc --noEmit` all green after):**
- 🟢 **`tsc` is now clean** — the 6 pre-existing `TS6133` unused-symbol errors are
  gone (`tsconfig` has `noUnusedLocals`/`noUnusedParameters`, so they *did* fail
  typecheck). Removed: dead `countryColor()` + unused `index` binding in
  `ScheduleDrawer.tsx`; unused `total` in `AdminShell.tsx`; 3 unused imports + a
  dead commented `Casey()` block in `casey.tsx`.
- 🔴 **OG cache-key amplification (DoS/cost)** — `/api/og` is the one expensive,
  publicly-reachable, edge-cached endpoint (satori + resvg per miss). It keyed the
  Cache API on the **raw request URL**, so `?match=5&x=1`, `?match=5&x=2`, … each
  became a distinct entry forcing a fresh render. `edgeCache.ts` now takes a
  `cacheKey` override; `og.tsx` normalizes to a single integer `match` param.
- 🐛 **`/casey` CSS leak** — `casey.index.tsx` injected its page CSS **untagged**
  (no `data-page-css`), so `PageCssGuard` never retired the tracker's global
  Tailwind preflight reset → it stayed `media=all` and wrecked the next page after
  visiting `/casey`. Now tagged + renders `<PageCssGuard id="casey" />`, matching
  the known-good `casey_.match.$number.tsx`.
- ⚡ **`PageCssGuard` effect had no dependency array** → it re-queried `<head>` and
  respawned a 250 ms `setInterval` on **every render** of nearly every page. Keyed
  on `[id]`.
- 🧹 **Deleted dead `src/server/games.ts`** (`getGamesFn` was never imported
  anywhere; Ticketmaster fixtures are unused — fixtures come from bundled static
  data). Removes a latent dead surface.
- 🔧 **Map tiles now build-time configurable** — `MapView.tsx` reads
  `VITE_MAP_STYLE_URL` (falls back to the current CARTO demo URL when unset), so
  2d can be a config flip, not a code change.
- 🔗 `AdminLogin` "← BACK TO TRACKER" pointed at `/` (marketing home); now `/casey`.

**Confirmed-good (no action needed):** snapshot/version edge cache, KV layer +
in-memory dev fallback, `auth.ts` fail-closed + `timingSafeEqual`, zod per-action
validation in `update.ts`, `cf.cacheTtl` ESPN fetch cache + L1 map, the
visibility-paused `/api/live` loop in `ClientShell`, the `useQuery`
(`refetchIntervalInBackground:false`) polling in `LiveTodayTab`/`InlineMatchScore`,
the admin routes' auth gating (`attention.ts`, `espn-health.ts`), `_headers`,
`robots.txt`, `manifest.json`, ngrok-free `vite.config.ts`.

**Remaining (triaged, NOT done — see Outstanding work / infra steps):**
- ⚠️ **`wrangler.jsonc` KV ids are still `REPLACE_WITH_*` placeholders** — a
  real `wrangler deploy` will **fail** until a namespace is created and the ids
  pasted in. #1 launch blocker (needs the Cloudflare account — manual step 1).
- CARTO **demo** tiles are still the runtime default until `VITE_MAP_STYLE_URL` is
  set to an owned/licensed source (Protomaps+R2 recommended).
- Marketing **CLS**: hero/marquee/mosaic art is CSS `background-image` and several
  `<img>` (venues list, agenda logo) lack `width`/`height`. Deferred — visual-parity
  risk; validate with a real `web-perf` trace before changing.
- No rate-limit on `/api/admin/login` (Cloudflare Access is the real gate).

### Session 2 follow-up — client shells + useMatchScores → Query (done, SSR-verified on :3001)
- **`useMatchScores` → `useQueries`** (`src/lib/useMatchScores.ts`): one query per
  played fixture, deduped across games/venue/build through the shared QueryClient;
  the once-a-day localStorage cache is kept as a **read-through** layer inside the
  queryFn (so a same-day reload still doesn't re-hit the Worker). Key namespaced
  `['match-final', …]` so it never collides with `InlineMatchScore`'s live
  `['match-score', …]` shape. Hand-rolled `alive` machine gone.
- **`TrackerApp` → `useQuery`** for `/api/bootstrap` (drops the `mounted`/`data`/
  `failed` machine; still client-only by design — bootstrap is per-request live
  data; Splash is the pending/error state).
- **`agenda` + `build` → bundled static imports** (`GAMES_INDEX`/`FAN_INTEL`) so
  both now **SSR their pickers** instead of a `useEffect`+`getJSON` "Loading…"
  shell. `build`'s `Builder` is `key={g.id}` (remount resets the wizard) with venue
  via `venueQueryOptions` and weather via `useQuery`. Verified: `/agenda` and
  `/build` SSR full lists, old `ag-load`/`Loading…` shells gone; `/games` still
  renders, `/casey` shows its splash. `dataCache.getJSON` now only powers
  image/intent prewarm.

### Web-perf audit — LIVE trace done (chrome-devtools MCP, Chrome 149 headless, dev :3001)
MCP setup note: macOS Tahoe blocks Node `posix_spawn` of the puppeteer-cached
Chrome (errno -88) and Dia exposes CDP but isn't puppeteer-compatible for page
ops — resolved by installing system Chrome and pointing the MCP at `--channel
stable` (local-scope config in `~/.claude-snapback/.claude.json`, not committed).
Caveat: dev server serves unbundled modules + HMR + no compression, so absolute
LCP/timing run pessimistic; CLS, LCP-element, network structure, a11y & SEO are
accurate. For authoritative CWV, trace the deployed Worker / `wrangler dev`.

**PROD build (`vite preview` → workerd, the real worker) — the authoritative read:**
**`/` LCP 148 ms · CLS 0.00** · **`/casey` LCP 168 ms · CLS 0.02**. The app is FAST
in production. (Dev :3001 showed `/` LCP 5117 ms — that was 100% an unbundled-module
artifact, NOT real.) Lighthouse (mobile): **Best-Practices 100, SEO 92, Accessibility 83**.
- 🔴 **`/assets/*` (content-hashed JS/CSS) lack immutable caching** — prod preview
  served them `cache-control: max-age=0, must-revalidate`, so repeat visitors
  revalidate every bundle. `_headers` covers `/img`,`/data` but NOT `/assets`.
  Fix: add `/assets/*` → `immutable, max-age=31536000` (safe: hashed filenames).
- 🔴 **Landing LCP is JS-gated** — LCP element is `azteca.jpg` stadium hero as a
  CSS `background-image` div, rendered by carousel JS → can't paint pre-hydration.
  `fetchpriority=high: FAILED`. Fix: SSR the first hero as a real
  `<img fetchpriority="high">` or add a `<link rel=preload as=image>` in the route head.
- 🔴 **Landing eagerly loads all 16 stadium photos + 10 page-CSS files** on first
  paint (confirmed in the network waterfall). Lazy-load the below-fold marquee
  images; demote the 10 cross-route `preload`s in `__root.tsx`.
- 🔴 **`/` has no `<meta name=description>`** (the promoted page) — SEO 92; add it + OG.
- 🟠 **A11y 83**: no `<main>` landmark on `/` (`landmark-one-main`); `user-scalable=no`
  blocks zoom (intentional product call, but a real a11y cost); small touch targets
  (`target-size`); `heading-order` skips.
- 🟠 **`/casey` forced reflow** from overlay-height measurement (ClientShell
  `--casey-badge-top`, MapView `computePadding`) — layout read-after-write.
- 🟢 CLS excellent (0.00 / 0.02); Best-Practices 100; code-splitting good
  (maplibre `ClientShell` ~893 KB only on `/casey`); TTFB 15–50 ms.

### Web-perf fixes APPLIED (session 2, verified on the prod preview + Lighthouse)
- ✅ **`/assets/*` immutable caching** — added to `public/_headers`; confirmed
  hashed JS/CSS now serve `immutable` (were `must-revalidate`).
- ✅ **Landing SEO** — `index.tsx` head now emits `<meta name=description>` + OG +
  Twitter + canonical (SSR-verified). Lighthouse `meta-description` now passes.
  (Canonical resolves absolute once `VITE_SITE_URL` is set at build — deploy step 4.)
- ✅ **Landing `<main>` landmark** — Accessibility **83 → 86**.
- ✅ **Images optimized per use case** (`scripts/optimize-images.mjs` rewritten with
  per-asset target sizes; verified crisp via MCP screenshots of landing/venue/casey):
  `logo.png` **118 KB → 17 KB** (900² → 256², every page), `celebration2.jpg`
  384→226, `celebration.jpg` 179→106, `casey-cutout.png` 58→20, `casey-avatar`
  17→10, `snapback-logo` 22→5. Stadium JPGs kept (already optimal at 1280px; they
  double as `og:image` so stay JPG, not WebP — the "only-if-smaller" guard avoided
  degrading them). `public/` 4.9 MB → 4.5 MB.
### Session 2 — Group A (infra) + B + C executed
**A. Infra (wrangler CLI, authed as alexlane@snapbacksports.com):**
- ✅ **KV namespaces created + wired** in `wrangler.jsonc` (prod
  `2748f19e5a204da08549fbc3c513bd02`, preview `97dc09137084488fa9fcc4dd6c8580f7`).
  The #1 deploy blocker is cleared.
- ✅ **Cloudflare Access** configured over admin (Zero-Trust dashboard).
- ✅ **Admin auth rewritten → verify the Cloudflare Access JWT** (plan 2c done).
  `auth.ts` now validates the `Cf-Access-Jwt-Assertion` against Cloudflare's JWKS
  (`jose` `createRemoteJWKSet`, team `morning-sunset-52b4`, the app AUD) — **no app
  password, no app-signed cookie, no Worker secrets at all**. Deleted
  `/api/admin/login` + `AdminLogin.tsx`; admin logout → `/cdn-cgi/access/logout`;
  local-dev bypass is the compile-time `import.meta.env.DEV` (false in prod builds →
  fails closed). This also **closes the `*.workers.dev` bypass** (no valid assertion
  → 401 however the request arrives). Verified on the prod preview: admin routes
  401 without an assertion, `/api/admin/login` 404, public routes 200.
  **Net: the deploy needs ZERO secrets** (`ADMIN_PASSWORD`/`ADMIN_JWT_SECRET`/
  `TICKETMASTER`/`SUPABASE_*` all gone).
- ⏳ **Still needs you:** the first `wrangler deploy` (the KV-empty cutover — your
  timing); optional `workers_dev: false` hardening; admin re-enters overrides post-cutover.

**B. Architecture:**
- ✅ **B8 admin auth → `withAdmin` wrapper** (`auth.ts`) on `update`/`attention`/
  `espn-health`; verified on the prod preview: unauthed → **clean 401 JSON**, and
  `admin/bootstrap` still returns 200 `{authed:false}` for the login flow.
- ✅ **B7 map tiles → Protomaps + R2 COMPLETE & verified rendering** (off CARTO):
  R2 bucket `sbx-tiles` created + bound (`TILES`); `src/routes/api/basemap.ts`
  range-serves the `.pmtiles` from R2 (verified 206 + `Content-Range`); `MapView.tsx`
  builds an owned Protomaps light style (`protomaps-themes-base`, pmtiles protocol).
  **Extracted a North-America z0–8 basemap** (88 MB) from the Protomaps planet build
  via `pmtiles extract … --bbox=-130,12,-60,60 --maxzoom=8` and **uploaded it to
  production R2** (`wrangler r2 object put … --remote`; confirmed `PMTiles\x03` header).
  The Protomaps URL is a **hardcoded default** in `MapView.tsx` (`import.meta.env.DEV`
  keeps local dev on CARTO) — no env file. Verified on the prod preview:
  the `/casey` map renders the Protomaps basemap (city labels + glyphs), **0 CARTO
  requests**. Note: the prod URL only resolves once the Worker is deployed — use
  `npm run dev` (CARTO) for local map work. Deps `pmtiles` + `protomaps-themes-base`
  bundle into the lazy `/casey` chunk (no `sideEffects:false`). To refresh the
  basemap: re-extract + `wrangler r2 object put … --remote`. (npm flagged 5
  transitive vulns from pmtiles' deps — worth an `npm audit` look, non-blocking.)
- ✅ **Absolute OG/canonical + Protomaps URL are hardcoded defaults** (`site.ts` /
  `MapView.tsx`, prod host; `VITE_*` env overrides still honored). **`.env.production`
  deleted** — it only held 2 public URLs, no secrets. **Net: zero-config deploy** —
  no `.env*` files and no Worker secrets at all.
- ℹ️ **Ticketmaster key not needed** — games are bundled static JSON
  (`public/data/games/index.json`) + ESPN scores; the only TM code was the unwired
  dead `server/games.ts` (deleted). A fixture-refresh script (which *would* use the
  key) doesn't exist and is optional.

**C. A11y/perf polish — DONE (Lighthouse a11y 83 → 100, verified via MCP screenshots):**
- ✅ C9 pinch-zoom allowed (viewport meta); C10 carousel-dot tap targets → 24×24
  (visible dot unchanged via `::before`); C11 heading-order (marquee `<h4>`→`<h3>` +
  hidden section `<h2>`); C12 marquee backgrounds lazy-load via IntersectionObserver
  (verified: load on scroll, not before); C13 guide collage WebP via `image-set()`
  with JPG fallback (celebration 106→84 KB; celebration2 kept JPG — its WebP was larger).

### Static-asset findings (production build, unchanged)
Code-splitting is good: maplibre (`ClientShell` ~893 KB) is its own chunk loaded
only on `/casey`; routes are split.
- 🔴 **`public/img/logo.png` is 900×900 / 118 KB and loads on every page** (nav,
  root icon, share card — 12 refs) at ~42–84 px display. Resize + WebP → ~10–15 KB.
  (Check the share-card render size before shrinking the source.)
- 🟠 **No WebP/AVIF anywhere**; `/guide` collage ships `celebration2.jpg` 384 KB +
  `celebration.jpg` 179 KB as CSS `background-image` (LCP, no priority hint).
- 🟠 **`__root.tsx` eager-`preload`s 10 routes' CSS** on every page — competes with
  the landing LCP. Consider demoting non-critical ones to `prefetch` / intent-only
  (note: team chose `preload` because iOS ignores `prefetch` — validate w/ a trace).
- 🟡 CLS: marketing heroes are `background-image` (no intrinsic size); some `<img>`
  (venues list, agenda logo) lack `width`/`height`.

## Data-layer cleanup (code-smell pass) — DONE
The 5+ routes read the bundled static datasets as `any`, so a JSON field rename
compiled clean and silently rendered blank. Plus duplicated copy/coord/weather
helpers had drifted between routes. Fixed in three stages, all verified green:
- ✅ **Stage 1 — dedup + dead code.** `VENUE_COORDS` was copy-pasted in 2 routes and
  had **drifted (5 of 16 venues differed)**; consolidated to one canonical
  `venues-meta.ts` export (venue-page values) + a `venueNationCounts()` helper.
  Extracted shared text helpers to `lib/text.ts` (`cap`/`splitSentences`/`firstSentence`,
  was 4 copies). Deleted dead `DirectionsButton.tsx`, `lib/maps.ts`,
  `api/admin/login.ts`, `AdminLogin.tsx`, `server/games.ts`.
- ✅ **Stage 2 — weather.** Consolidated two near-identical fetchers into `lib/weather.ts`
  (`fetchVenueWeather` / `fetchMatchWeather`, shared `getJson` with an 8 s AbortController
  timeout — the old copies could hang). Preserved the Open-Meteo param difference
  (venue uses `weather_code`, build uses `weathercode`).
- ✅ **Stage 3 — typed data boundary.** Added `lib/data-types.ts` (`Game` / `FanIntel` /
  `Venue` / `March` / `VenueIntel`) and `src/data/index.ts` typed accessors that validate
  the JSON against the interfaces at the import. Repointed all 5 routes to
  `import { GAMES, FAN_INTEL } from '../data'` and dropped the `as any` casts.
  **The boundary immediately caught real drift:** 32 TBD knockout fixtures carry
  `home: null, away: null`, so `Game.home/away` are `string | null` — widened the
  `teams.ts` helpers (`teamName`/`teamFlag`/`teamCode`) and `ScoreInput` to accept
  nullish (they already gate on `g.tbd`/`m.home && m.away` at runtime). Verified both
  paths on the prod preview: a normal game (`azteca-jun11`) renders "Mexico vs South
  Africa" + flags; a TBD fixture (`sofi-jun28`) renders "To be confirmed" with the
  flag background, Build-CTA and team helpers all correctly suppressed. No console errors.

## Casey-subtree cleanup (second code-smell pass) — DONE
Audited `src/casey/` (the live admin/tracker product, ported from a Next.js app by
the intern). Found + fixed, in two batches, all verified green + browser-smoke-tested:

**Batch 1 — isolated fixes (low-risk):**
- ✅ **`pointText()` helper** in `build.tsx` — the `{b,t}` bullet adapter was inlined 3×.
- ✅ **`espn.ts` alias typo** — `'Cote dIvoire'` (no apostrophe, an unmatchable dead
  alias) → `"Cote d'Ivoire"`.
- ✅ **`ScoreboardEvent` deduped** — was declared 3× (`espn.ts` + 2 drifting client
  copies that dropped `stage`); clients now `import type` the canonical one.
- ✅ **4 dead `@next/next/no-img-element` eslint directives removed** (not a Next app).

**Batch 2 — structural:**
- ✅ **Finished the abandoned TanStack Query migration.** `GroupsTab`, `BracketTab`,
  `StandingsModal` + the admin `Visibility`/`Attention`/`Health` tabs + the
  `casey.admin` route bootstrap all hand-rolled `useEffect` + `fetch({cache:'no-store'})`
  + `loading/failed/cancelled` state right next to already-migrated siblings. All moved
  to `useQuery`, backed by a new shared `casey/lib/queries.ts` (`liveJson` + queryOptions
  factories). ~8 duplicated fetch sites collapsed; mutations write through via
  `qc.setQueryData`. Verified on `vite dev`: Groups renders all 12 live ESPN tables,
  Bracket renders R32→Final, admin tabs all load.
- ✅ **Fixed the broken "OPEN #N" Attention button** (`void n` discarded the match
  number → did nothing). Now lifts `jumpMatch` in AdminShell → `MatchesTab initialOpenId`.
  Browser-verified: clicking OPEN #1 switches to Matches **and** opens match #1's editor.
- ✅ **Fixed network-failure → "NOT AUTHORIZED" misattribution** in `casey.admin`: a
  bootstrap blip now shows a retry ("CAN'T LOAD"), not a false auth denial; the
  Attention/Health tabs surface load errors instead of a permanent "loading…".
- ✅ **Split the 1663-line `AdminShell.tsx` god-component** → a slim 128-line shell +
  `components/admin/{ui,MatchesTab,StadiumsTab,PositionTab,SpendTab,VisibilityTab,
  AttentionTab,HealthTab}.tsx`. Done by exact byte-slicing (no transcription risk);
  tsc + build + 23 tests + a full browser pass of every admin tab all green, 0 console errors.

## Out-of-framework cleanup: standalone agenda + Tailwind v4 — DONE
Three dirs sat outside `src/` and the TanStack framework. Investigated each (they
were NOT the same thing), then per the user's calls:
- ✅ **Deleted the redundant standalone agenda.** `agenda-standalone/` (a plain-React
  SPA built by `vite.agenda.config.ts`) + `snapback-agenda/` (a *committed build
  bundle* — hashed assets in git) duplicated the already-integrated `/agenda` route
  (`src/routes/agenda.tsx` — same saveKey/fields/ShareCard). Nothing deployed the
  standalone (no vercel/wrangler ref). Removed both dirs + `vite.agenda.config.ts` +
  the dead `dist-agenda` .gitignore entry.
- ✅ **Migrated the Casey tracker to Tailwind v4, properly integrated.** Was: a
  `casey:css` predev/prebuild hook shelling out to `npx tailwindcss@3.4.16` with a v3
  `casey-build/tailwind.config.cjs` → a committed, minified `casey-tracker.css`, while
  the repo's installed **Tailwind v4** (`@tailwindcss/vite`) sat unused. Now: added
  `@tailwindcss/vite` to `vite.config.ts`; `src/pages/casey-tracker.css` is a real v4
  **source** (theme + utilities imported, `@theme` tokens ported from the old config,
  custom CSS kept verbatim) compiled by Vite. Deleted `casey-build/`, the `casey:css`
  script, and the predev/prebuild hooks.
  - **Scoped, not global:** only `casey-tracker.css` opts into Tailwind (via
    `@import 'tailwindcss/...'` + `@source ../casey`); CSS without those directives
    passes through untouched, so the verbatim-CSS marketing pages are unaffected
    (verified `/games` pixel-unchanged). **Preflight intentionally NOT imported**
    (matches the old `preflight:false`) so it never resets other routes.
  - **Cascade gotcha fixed:** v4 puts utilities in `@layer utilities`, and the SBX
    global `* { margin:0; padding:0 }` is *unlayered* → it beat every utility (padding
    collapsed). Fixed by importing utilities **unlayered**, restoring the v3 cascade
    (utilities win by specificity). Verified pixel-identical to the v3 baseline.
  - Verified on `vite dev` + prod build: `/casey/admin` and `/casey` render identically
    to the v3 baseline (screenshot diff), built CSS asset contains the compiled
    utilities + custom CSS, 0 console errors.

## App-wide Tailwind v4 migration — DONE
Converted the ENTIRE app off its per-route verbatim-CSS system onto Tailwind v4
utilities, and removed the bespoke CSS-isolation machinery.
- ✅ **`src/styles.css` is the single Tailwind entry**: full layered `@import "tailwindcss"`
  (theme + **preflight** as the global reset + utilities) + the `@theme` config (brand +
  casey tokens, fonts, animations). One global stylesheet for the whole app.
- ✅ **Deleted the standalone agenda** (`agenda-standalone/`, `snapback-agenda/`,
  `vite.agenda.config.ts`) — already integrated at `/agenda`.
- ✅ **SiteNav + all 8 page stylesheets converted to utilities** (games, guide, venues,
  venue, game, build, index, agenda + the shared ShareCard). Each page's genuinely
  un-convertible CSS (pseudo-element overlays, `@keyframes`, the agenda-card `:nth-child`
  fan, flag masks, scrollbar pseudo, the ShareCard timeline + `--scf` runtime scaling)
  lives in a tiny `src/pages/salvage/*.css` imported (unlayered) by styles.css. Done via
  parallel subagents + central wiring; **every page browser-verified pixel-faithful**.
- ✅ **Deleted 8 marketing stylesheets + `casey.css`** (casey.css was a full page sheet
  whose only live rule — the admin `<main>` dark grid — was salvaged to a scoped
  `.casey-admin-grid` in casey-tracker.css). `casey-tracker.css` remains as the legit
  custom layer (markers/keyframes/MapLibre); its generic `.font-*` classes were scoped
  under `.casey-shell` so they don't leak now that everything's global.
- ✅ **Removed `PageCssGuard`** (component + all 10 usages) and the `__root` CSS-preload
  block — no per-route stylesheets left to isolate.
- **Result:** CSS footprint ~2,400 lines / 11 sheets → ~1,050 (mostly casey-tracker.css
  + small salvage files). `/games`, `/game`, `/casey/admin`, `/casey` all verified
  pixel-faithful under preflight; 0 console errors.
- ✅ **Renamed `src/pages/` → `src/styles/`** (holds casey-tracker.css + salvage/),
  alongside the `src/styles.css` entry; all imports updated.
- ✅ **CSS audited to only used + un-convertible rules:** removed dead casey rules
  (`.bg-grid`/`.bg-noise`, `.drawer-*` transition classes, `.brand-mark-wiggle` +
  `@keyframes cap-wiggle`, `.fill-snap-yellow` + its reskin), dropped the unused
  `.sec-dark.grid-bg::after` variant, de-duplicated shared rules (`.head::after` 3×→1,
  `.subhead::before` 2×→1), and converted the cleanly-convertible `.tally .pill.on`
  to a `bg-brand-yellow` ternary in venues.tsx. Verified the dead classes were truly
  unreferenced (incl. JS-built `country-${cc}` marker classes, which were KEPT).

## Self-hosted fonts + deeper Tailwind-feature conversion — DONE
Adopted modern self-hosted font loading (the `next/font` equivalent for a Vite/TanStack
app is **@fontsource**, not `next/font` itself) and corrected the earlier, over-conservative
"un-convertible" labelling by moving more salvage CSS onto modern Tailwind v4 variants.
- ✅ **Fonts self-hosted via `@fontsource`**: Anton 400 + Barlow 400–800 imported in
  `styles.css`; Bebas Neue + JetBrains Mono 400/500/700 in `casey-tracker.css`. The
  per-weight woff2 are **bundled + fingerprinted by Vite with `font-display:swap`** — no
  render-blocking Google Fonts CDN `<link>`, no preconnect. Removed the Google Fonts
  `<link>`/preconnect tags from `__root` and every casey route. (Inter was dropped from
  the client entirely — it's only used server-side by Satori in `og.tsx`.)
- ✅ **More CSS → Tailwind v4 variants** (the "pseudo-elements & nth-child" point):
  - `<details>` chevrons: `group` + base `rotate-[-45deg]` + `group-open:rotate-45`
    (compiles to the `[open]` attribute selector — cross-browser), with `list-none` +
    `[&::-webkit-details-marker]:hidden` for the marker (venue notes/tips dropdowns).
  - agenda-card **`:nth-child` fan** → index-driven `[transform:rotate(..)translateY(..)]`
    utilities (the map index is passed to `AgendaCard`) + hover/responsive overrides.
  - accent **bars** → `before:content-[''] before:absolute …`: games match-row 8px bar,
    venue `.whyc` 5px bar, the `.subhead` 18×3 tick (venue + game).
  - styled **scrollbars** → `[&::-webkit-scrollbar]:h-[…] [&::-webkit-scrollbar-thumb]:…
    [&::-webkit-scrollbar-track]:…` (venue weather strip + agenda hscroll) and
    `[&::-webkit-scrollbar]:hidden` (games filter rail); plus `placeholder:` utilities,
    `[&::-webkit-search-cancel-button]:cursor-pointer`, a descendant
    `[&_.agspot]:flex-[0_0_clamp(…)] [&_.agspot]:snap-start`, and bare-`<b>` → `text-white`.
  - 🐞 **Latent bug fixed in passing:** the match-row yellow hover-shadow referenced an
    **undefined `var(--y)`** (its defining `:root` rule was dropped in the v4 migration),
    so the signature hover effect was silently a no-op — now a literal `#f7df02`.
  - **Kept as CSS (honest comments, not "impossible"):** multi-stop/radial gradient
    overlays, feathered flag masks, `image-set()` fallbacks, `@keyframes`, the repeated
    diamond list-bullet markers (one rule beats a 9-utility `before:` on every `<ul>`),
    the fixed-dimension PNG-export ShareCard (`.sc-*` + `--scf`), and compound state
    selectors (`.wx-day.played`, `.agspot.fifa`) whose `(0,2,0)` specificity reliably
    beats the base utility (conditional utilities would fight v4's source-order tiebreak).
  - **Salvage CSS now 6 files / 244 lines.** Every converted interaction browser-verified:
    chevron rotates −45°→+45° on open, accent bars/scrollbars compile to real pseudo
    rules, the hscroll cards size to `0 0 268px` + `snap-start`.
- ✅ **`casey-tracker.css` audited too** (3 more conversions): `.animate-hero-swap` +
  `.animate-detail-reveal` moved to `@theme` `--animate-*` tokens (now first-class
  generated utilities, matching the existing `pulse-live`/`pulse-flight` pattern — JSX
  unchanged); the `.a-right` 8px yellow hero rail → a `before:` utility in `index.tsx`;
  and the `@layer base` button reset trimmed of its `-webkit-appearance` line (v4 preflight
  already applies `appearance:button`, but — unlike v3 — does **not** strip the UA button
  background, so that part stays). Verified: both `animate-*` utilities resolve to running
  keyframes, the rail renders 8px/z-3, bare buttons stay `transparent`, and the file now
  has **0 IDE diagnostics**.
  - **Deliberately kept as CSS** (Tailwind genuinely can't/shouldn't own these): the
    MapLibre library overrides (`.maplibregl-*`) and **JS-injected map markers**
    (`.stadium-pin`, `.casey-marker`, `.casey-avatar`, `.stadium-label`, `.country-accent`,
    `.casey-direction-arrow`) — built via `document.createElement` + `new maplibregl.Marker`
    in `MapView.tsx`, so there's no JSX element to carry a utility; `@keyframes`; the
    SVG-data-uri noise/grain textures + radial vignettes; and the heavily-reused component
    classes (`stat-number` ×11 files, `no-scrollbar` ×8, `card-lift` ×4, `stamp`,
    `ticker-*`, `day-watermark`) — Tailwind's own docs endorse extracting repeated patterns
    into a class, and inlining them would be a maintainability regression.
- ✅ **Removed all `.casey-shell` scoped CSS from `casey-tracker.css`.** Key realisation:
  this sheet is linked as a `rel="stylesheet"` **only on the casey routes** (in `__root`
  it's merely `rel="preload"`, which downloads but never applies), so the `.casey-shell`
  prefixes were redundant defensive scoping — the route-only loading already isolates it.
  - Folded the entire **"LIGHT RE-SKIN OVERRIDES"** section into the base rules: the app
    is always the light SBX skin, so the dark base values were dead (every element renders
    inside `.casey-shell`, which always won). `stadium-label`, `ticker-strip`, `stamp`,
    `day-watermark`, `map-fx-grid/-vignette`, `maplibregl-ctrl-attrib`, and the 4 `arc-popup`
    rules now carry their final light values directly; the scoped override block is gone.
  - Unscoped the casey font tweak (`.font-display`/`.font-mono` keep only `letter-spacing`;
    the global utilities already supply the family; `.font-body` was identical → dropped),
    `text-snap-yellow → gold` (the one standalone utility override), and the
    `prefers-reduced-motion` block. Rewrote the map-fill fix `.casey-shell .maplibregl-map`
    → `.maplibregl-map.maplibregl-map` (a doubled-class keeps the 0,2,0 specificity needed
    to beat maplibre's later-loaded `position:relative`, without scoping). Dropped the
    `.casey-shell *{box-sizing}` reset (preflight covers it) and the dead `map-fx-scanline`
    sweep + `@keyframes scanline-sweep` (the re-skin always `display:none`'d it).
  - **Verified pixel-identical:** injected probe elements for all 17 reskinned styles and
    diffed computed values before/after — every one byte-matched (incl. the arc-popup
    `--snap-carbon` bg that actually comes from the `!important` generic rule). Map renders
    full-height (doubled-class works), `/casey` screenshot unchanged, and **no leak onto
    marketing pages** (`/games`: casey sheet not applied, `font-display` = `normal`,
    `text-snap-yellow` = brand yellow). `casey-tracker.css` 678 → 627 lines, 0 diagnostics.

## Eliminated ALL per-page salvage stylesheets → minimal styles.css — DONE
Drove to the stated goal "only minimal styles.css": deleted all six `src/styles/salvage/*.css`
files (guide, venues, game, venue, index, share) by converting every rule to Tailwind.
- ✅ **`styles.css` is now the single global config (165 lines)** — Tailwind entry + `@theme`
  + global element rules + the handful of irreducible primitives: three `@utility` blocks
  (`grid-overlay` with `[--grid-line]`/`[--grid-size]` vars for the header/browse/agenda grids;
  `diamond-bullets` with `[--db-size]`/`[--db-top]`/`[--db-border]` for every yellow list
  marker; `wz-screen` for the build wizard's phone one-screen layout), the marketing
  `@keyframes` (`drop`, `venue-scroll`) registered as `--animate-*` tokens, and the `--notch`
  clip-path var. No salvage `@import`s remain.
- ✅ **One-off pseudos/gradients/masks → inline arbitrary utilities**: every `::after`/`::before`
  overlay became `after:[background:linear-gradient(…)]` / `before:…`; the flag feathered masks
  `[mask-image:…]`+`[-webkit-mask-image:…]`; the collage `image-set()` `[background-image:image-set(…)]`;
  the ShareCard timeline rail/dots `before:…` (story only) and its `--scf` runtime type-scaling
  `[font-size:calc(25px*var(--scf,1))]`; the crossfade carousel + marquee hover-pause/mobile
  rules via `group`/`group-hover:`/`motion-reduce:`/`max-[Npx]:[&::-webkit-scrollbar]:` variants.
- ✅ **State combos → ternaries** (`wx-day.played`, `agspot.fifa`, `wz-card.on .wz-pick`): the
  competing border/bg/shadow/colour live in a `cond ? A : B` so the two values never collide on
  one element (Tailwind breaks same-property ties by source order, not class order).
- 🐞 **Fixed three latent salvage-extraction bugs found en route**: the venue diamond lists had
  lost their `<li>` `position:relative`+padding (restored from git per list: 22/24/17/15/17px);
  the match-row yellow **hover-shadow referenced an undefined `var(--y)`** (now `#f7df02`); and the
  build wizard's `.sb-scale-story` preview box had lost its `width/height/overflow` (restored
  283×503, 360×640 ≥601px).
- ✅ **ShareCard PNG export verified safe** — the export-critical card converts to utilities with
  identical computed styles; triggered the export on `/agenda` *and* the wizard share step:
  renders without error, offscreen card intact at 1080×1920, `--scf` type-scaling works (slab
  = `calc(25px×1.3)` = 32.5px). Every page browser-verified pixel-faithful (incl. the wizard's
  phone one-screen layout at 390px: `100dvh-72px`, sideways card swipe, pinned nav row).
- **`casey-tracker.css` kept** as the route-loaded map stylesheet — it carries casey-only fonts
  (Bebas Neue, JetBrains Mono) + JS-injected marker CSS that would bloat/leak if globalized.
  **Result: `src/styles/` holds one file; `styles.css` is 165 lines.**

## Verification status
- `npm run build` ✅ · `npm test` ✅ (23/23) · `npx tsc --noEmit` ✅ (**fully clean**,
  including previously-failing files) · SSR smoke-tested on `vite dev` (prior session):
  homepage, `/casey`, `/games`, `/game/$id`, `/venue/$id`, legacy redirects,
  `/api/bootstrap`, `/api/live`. Data-layer cleanup re-verified on the prod preview
  (`vite preview`): normal + TBD game pages render correctly, zero runtime errors.
  Casey-subtree cleanup re-verified on `vite dev`: `/casey/admin` (all 7 tabs + OPEN #N
  flow) and `/casey` Tournament Hub (Groups + Bracket with live ESPN data) — **0 console
  errors**. Tailwind v4 migration verified on `vite dev` + prod build: `/casey/admin` and
  `/casey` pixel-match the v3 baseline, `/games` (verbatim CSS) unaffected, built CSS
  asset carries the compiled utilities + custom CSS, 0 console errors. App-wide Tailwind
  migration re-verified end-to-end on `vite dev` + prod build (preflight enabled,
  PageCssGuard removed): all 8 marketing pages + casey admin + casey tracker render
  pixel-faithful, **0 console errors**, tsc clean.
- Self-hosted fonts + Tailwind-feature conversion verified on `vite dev` + prod build:
  fonts load self-hosted (no Google Fonts request), `/games` rows show their yellow accent
  bar + working hover-shadow, `/venue` chevrons rotate on open and the weather/hscroll
  scrollbars + accent bars render from compiled pseudo rules — all browser-checked,
  tsc clean, build green, 23/23 tests.
- Salvage-elimination verified end-to-end on `vite dev` + prod build (tsc clean, build green,
  23/23 tests): all six salvage files deleted, `styles.css` = 165 lines; `/`, `/games`, `/guide`,
  `/venues`, `/venue/$id`, `/game/$id`, `/agenda`, `/build` (desktop **and** 390px one-screen),
  `/casey` all render pixel-faithful; the `grid-overlay`/`diamond-bullets`/`wz-screen` `@utility`
  blocks + `drop`/`venue-scroll` keyframes resolve; ShareCard PNG export renders without error
  on both `/agenda` and the wizard share step.
- **Not committed** — working tree on branch `alex/dev`, no commits made this session.
</content>
