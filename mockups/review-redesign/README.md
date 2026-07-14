# Review Page Redesign — 20 concept mockups

Images-first redesigns of the venue review page. Today, photos are trapped in the
"Fan Reviews" sidebar (`src/components/Reviews.tsx`); every concept here pulls them
out and puts them next to the seats / food they show, and where it fits, tells the
gameday as a story.

**These are throwaway mockups, not wired into the app.** They exist to pick a
direction before building.

## How to view
Open **`index.html`** in a browser — it's a gallery of all 20 with live previews and
Yes / Maybe / No buttons (saved in localStorage). Hit "Copy verdicts" to export the
picks as text.

If local images don't load from `file://` in your browser, serve the repo root:
```
python3 -m http.server 8791
# then open http://localhost:8791/mockups/review-redesign/index.html
```

Rendered PNGs of every concept are in `/tmp/sbx-shots/` (regenerate anytime).

## The content is real
- Venue: **Madison Square Garden / Knicks**. All tips are **Jack's real seeded MSG
  notes** (`scripts/seed-jack.mjs`) so he recognizes his own words.
- Photos are **placeholders** from an existing field report
  (`public/img/reports/citi/robby/`) — judge the *layout*, not the pictures.

## The 20 directions
| # | Concept | Idea |
|--|--|--|
| 01 | Gameday Timeline | Night told top-to-bottom; photos are the spine |
| 02 | Editorial Feature | Long-form report; photos float beside their section |
| 03 | Illustrated Section Cards | Today's grid, but each card leads with its photo |
| 04 | Split-Screen Sticky | Pinned photo stage swaps as you scroll the tips |
| 05 | Chaptered Deck | Full-screen cinematic chapters you swipe through |
| 06 | Bento Grid | Interlocking mosaic; seat + food heroes anchor it |
| 07 | Stadium Diagram | Pins on a seating-bowl map open photo + tip |
| 08 | Photo Grid | Instagram-style grid; tap a photo for its tip |
| 09 | Ticket Stubs | Each section is a die-cut ticket stub |
| 10 | Scrollytelling | Full-bleed scenes; tips drift over them |
| 11 | Field Guide | Printed pocket itinerary you'd screenshot |
| 12 | Gallery + Thumb Rail | Product-page gallery: hero + thumbs + tip |
| 13 | Tabbed Sections | Photo-led panel per topic, one click away |
| 14 | Masonry Feed | Pinterest-style feed mixing photos + tips |
| 15 | Rating Dashboard | Each pillar score backed by a photo + quote |
| 16 | Side-Rail Essay | Docs-style nav beside a calm photo essay |
| 17 | Story Reel | Mobile Stories: tap through each topic |
| 18 | Zine Collage | Maximalist poster — taped photos, huge headlines |
| 19 | Guide + Photo Dock | Readable guide + ever-present photo dock |
| 20 | Ask-a-Local Chat | Text a local; every answer arrives with a photo |

Shared brand system: `_shared.css` (mirrors `src/styles.css` tokens). Shared content:
`_data.js`.
