# Home explore-blocks — redesign mockups

Throwaway mockups (like `mockups/review-redesign/`). **Not wired into the app.**

## The problem (content-creator review)
The homepage hero has six "explore doors" (`src/routes/index.tsx`, the `door`/`doorStub`/`doorMain`
consts + the six `<Link>`s):

**Been there? Rank it** · **Near you** · **By sport & team** · **Upcoming events** · **By venue** · **Top ranked**

Two issues:
1. **Indistinguishable** — every door is the same cream ticket with a `Rank`/`Explore` vertical
   stub. Nothing signals what each does.
2. **Truncated** — `door` is `min-h-[78px] overflow-hidden`, so on the 2-col mobile grid the second
   line clips (e.g. the `/rank` door's "Review your experiences").

## The fix (shared by every concept)
- A distinct **accent colour + icon** per block: Rank = brand yellow, Near you = blue,
  By sport & team = green, Upcoming = orange, By venue = purple, Top ranked = crimson.
- Room for the **full label + description** (block-stacked, flexible height) — no clipping.

## View
Open `index.html` in a browser, **or** serve it:

```bash
cd mockups/home-blocks && python3 -m http.server 8791
# → http://localhost:8791/index.html
```

The gallery shows the **current** doors (reference) plus all six concepts, each rendered on the real
dark hero backdrop at **desktop (6-up)** and **~372px mobile (2-up)** — the spot where the
truncation bites.

## Concepts
| # | Concept | Idea |
|---|---------|------|
| — | Current | Reference: identical cream tickets, clipped text |
| 1 | **Colored stubs** | Keep the ticket + perforated stub, fill the stub with the block's colour + icon. Smallest change. |
| 2 | **Left accent bar + icon** | Cream card, thick coloured left bar + accent icon. Colour-coded without going loud. |
| 3 | **Solid color blocks** | Each block filled with its colour (Rank yellow/ink). Boldest separation. |
| 4 | **Header-strip cards** | White card, coloured header strip (kicker + icon), body = label + full description. |
| 5 | **Icon-badge cards** | White card, rounded coloured icon badge, bold title, description. Cleanest/scannable. |
| 6 | **Primary banner + accent row** | "Rank it" is one big yellow primary; the five explore tiles are colour-coded icon cards. |

Pick a direction → a follow-up task maps it onto the `door`* consts + the six `<Link>`s in
`src/routes/index.tsx`.

## Files
- `index.html` — the gallery (self-contained; blocks generated from the real labels via inline JS)
- `_shared.css` — Snapback tokens + the per-block accent palette
