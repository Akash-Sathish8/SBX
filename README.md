# SBX — TanStack Start mirror

A faithful, **pixel-identical** port of the static Snapback World Cup 2026 site
(`../arcade-demo`) onto **TanStack Start** (React 19 + Vite + SSR + server functions).
The original static site is untouched; this is a parallel mirror.

## Run it

The Ticketmaster API key is read from the environment only (never committed):

```bash
npm install
TICKETMASTER_API_KEY=your_key_here npm run dev
# opens on http://localhost:3000 (or the next free port)
```

Without a key the site loads; only the live `/games` fixtures are disabled.

```bash
npm run build && npm run preview   # production preview
```

## How parity is achieved

The hard requirement was "exact same — format, font, look." The trick:

- **CSS is never rewritten.** Each page's original `<style>` block lives verbatim in
  `src/pages/<page>.css` and is attached per-route via a render-blocking `<link>`
  (`head: () => ({ links: [...] })`). Navigating swaps the whole stylesheet exactly like
  loading a different static HTML file, so there is zero cross-page bleed and zero drift.
  Tailwind (and its preflight reset) was removed from the scaffold for this reason.
- **DOM is faithful JSX.** The markup mirrors the originals 1:1.
- **Behavior is ported to React:** hamburger nav (`src/components/SiteNav.tsx`),
  the home hero slideshow, the games filter/search, the venues country filter, and the
  venue detail fetch — all the original inline `<script>` logic.
- **Fonts** (Anton + Barlow) are loaded globally in `src/routes/__root.tsx`.
- **The `/api/games` Node proxy** became a server function (`src/server/games.ts`,
  `createServerFn`) — same Ticketmaster logic, 15-min cache, env-only key.
- **All images responsive:** background images already scale (cover); a global
  `img{max-width:100%;height:auto}` rule was added to every page for safety.

## Structure

```
src/
├── routes/
│   ├── __root.tsx     # html shell, global fonts/favicon
│   ├── index.tsx      # home (/)            — hero slideshow, marquee, sections
│   ├── guide.tsx      # /guide
│   ├── games.tsx      # /games              — live fixtures (server fn)
│   ├── venues.tsx     # /venues             — country filter
│   ├── venue.tsx      # /venue?id=…         — data-driven detail page
│   └── casey.tsx      # /casey
├── pages/*.css        # verbatim per-page stylesheets (one per route)
├── components/SiteNav.tsx
└── server/games.ts    # Ticketmaster proxy as a server function
public/
├── img/…              # logo, celebration*, stadiums/* (copied from the static site)
└── data/venues/*.json # 16 venue datasets
```
