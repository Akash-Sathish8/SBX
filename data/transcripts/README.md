# Snapback expert-notes transcripts

Drop YouTube/video transcripts here (one file per game or venue the team actually
attended) and list them in `manifest.json`. `npm run db:expert-notes` runs each
through Claude (Opus 4.8) and extracts concrete, source-quoted gameday notes into
`db/seed.expert-notes.generated.sql`, which you then apply to D1.

These notes are **editorial** — Snapback's own first-party knowledge, kept separate
from the crowdsourced fan tips/reviews. Every note keeps the source URL + the
verbatim quote it came from, so it stays checkable. Nothing is invented.

## Files
- Plain text (`.txt`), or YouTube `.vtt` / `.srt` captions — timestamps are stripped automatically.

## manifest.json
An array, one entry per transcript file:

```json
[
  {
    "file": "wrigley-field-2026-06-10.vtt",
    "scope": "venue",
    "targetId": "3809",
    "sourceUrl": "https://www.youtube.com/watch?v=XXXXXXXXXXX"
  },
  {
    "file": "yankees-redsox-2026-06-14.txt",
    "scope": "event",
    "targetId": "mlb:401581234",
    "sourceUrl": "https://www.youtube.com/watch?v=YYYYYYYYYYY"
  }
]
```

- `scope`: `"venue"` or `"event"`.
- `targetId`:
  - venue → the ESPN venue id (the `?id=` on a `/venue` page).
  - event → `"<league>:<gameId>"` (the `league` + `id` on a `/game` page, e.g. `mlb:401581234`).
- `sourceUrl`: the video the transcript came from (kept on every note).

## Run
```bash
ANTHROPIC_API_KEY=sk-ant-... npm run db:expert-notes   # extract -> seed + review file
#  → review data/expert-notes.review.json (eyeball the notes + quotes)
npm run db:seed:notes:local                            # apply to local D1
# prod (after wrangler d1 create): npm run db:seed:notes:remote
```

> Transcripts can be large/copyrighted — consider keeping the raw files out of git
> (add `data/transcripts/*.vtt` etc. to `.gitignore`); the generated seed + review
> JSON are what the app actually uses.
