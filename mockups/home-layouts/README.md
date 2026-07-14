# Home — completely new layouts (mockups)

Throwaway mockups exploring **whole-page homepage structures**, not variations of the current
block-grid. (The colour/separation block treatments live in `../home-blocks/`.) **Not wired in.**

## View
```bash
cd mockups/home-layouts && python3 -m http.server 8791
# → http://localhost:8791/index.html   (gallery: each layout in a desktop + mobile frame)
```
Open the individual files for the full page: `1-split.html` … `5-sidebar.html`.

## The five layouts
| # | Layout | The idea |
|---|--------|----------|
| 1 | **Split hero** | Above-the-fold split — brand + headline + search + "Rank a game" and explore chips on the left; a live "tonight" panel over a photo on the right. |
| 2 | **Bento dashboard** | App control-panel — a big yellow Rank tile, a Top-ranked list tile, colour-filled destination tiles, a photo band. Asymmetric sizing = hierarchy. |
| 3 | **Editorial feed** | Slim photo hero, then scroll into content sections: tonight's slate, the explore doors, a featured Top-ranked spread. A sports-media homepage. |
| 4 | **Search-first minimal** | The search bar is the hero — giant centred headline + oversized search, destinations as colour-dot pills, a thin trending strip. Google-simple. |
| 5 | **Sidebar app** | Web-app shell — a left colour-coded nav rail of the six destinations + a main area (featured card, games, rankings). Top rail on mobile. |

All five keep the **colour-coded, non-truncated** explore entries from the block review.

## Files
- `index.html` — the gallery (embeds each layout at desktop + 390px mobile)
- `1-split.html` · `2-bento.html` · `3-feed.html` · `4-search.html` · `5-sidebar.html` — full pages
- `_shared.css` — tokens + shared chrome (nav, search, buttons, cards, rows)
- `_ui.js` — shared data (destinations, sample games, top-ranked) + icons/render helpers
