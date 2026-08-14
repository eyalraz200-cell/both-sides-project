# Data

## `events.json`

Fetched once by `initPage7()` (`page7.js`) and used by page7, page8 and page9 alike.
One object per event:

| Field | Meaning |
|---|---|
| `date` | `YYYY-MM-DD`. Sorted lexicographically = chronologically |
| `side` | `"left"` or `"right"` — which camp column the dot lives in |
| `actor` | Join key into `GROUPS`' `actor` field → the dot's color (`p7ActorColor`) |
| `category` | English category string → `CATEGORY_EN_TO_IDX` (`page9.js`) |
| `descHeMedium` | Per-event Hebrew description, shown in the hover tooltip |

Committed dataset: **13,523 events — 4,872 left, 8,651 right**, from **2023-01-01** to
**2026-05-29**.

An unmatched `actor` falls back to `#888`. `#00B00C` (מפגינים ערבים ישראלים) has no
`actor` at all — the dataset has no Israeli-Arab events, so that group never appears on
the timeline.

## Source of truth: the xlsx

`Events_with_description_he_medium.xlsx` at the repo root. Its `main actor` and
`event category` columns map directly onto the field names and English strings the code
already expects; `description_he_medium` (a real per-event Hebrew translation for all
13,523 rows) becomes `descHeMedium`.

`server.py`'s `load_events()` rebuilds the JSON **in memory on every server start**, and
`/events.json` serves that — so local dev is always current with the xlsx.

**The committed static `events.json` is NOT auto-written.** Deployments that don't run
`server.py` read that file. If the xlsx changes and a deployment needs it, dump
`server.py`'s `/events.json` output to the file manually.

Note that `server.py`'s mtime watcher polls `.html`/`.css`/`.js` only — it does **not**
watch the xlsx. Editing the spreadsheet requires a server restart, not just a reload.

## Category mapping

`CATEGORY_EN_TO_IDX` (`page9.js`) is the only place English category strings are
translated. See [Drag-and-Drop](Drag-and-Drop.md) for the full table and the Hebrew pill
names.

Two Hebrew label lists must stay in sync with each other:
`P9_CATEGORIES` (`page9.js`) and `FOLD6_SQUARE_LABELS` (`js/groups.js`).

## Design source

Figma file `QASHSt1u7b6m6ASgrUPswf` ("Design"). Screens are revised one at a time to
pixel parity — **only pages explicitly documented as revised should be treated as matching
Figma**; everything else is still an older placeholder layout.
