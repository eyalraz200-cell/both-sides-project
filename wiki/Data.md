# Data

## `events.json`

Fetched once by `initPage7()` (`page7.js`) and used by page7, page8 and page9 alike.
One object per event:

| Field | Meaning |
|---|---|
| `rowId` | The xlsx's own stable `row_id` (`"row-145"`). Lets JS pin to one specific event by id — see `FOLD6_TOOLTIP_ROW_ID` / `p7OccurrenceOfRowId` |
| `date` | `YYYY-MM-DD`. Sorted lexicographically = chronologically |
| `side` | `"left"` or `"right"` — which camp column the dot lives in |
| `actor` | Join key into `GROUPS`' `actor` field → the dot's color (`p7ActorColor`) |
| `category` | Hebrew category string (the xlsx's `event_type`) → `CATEGORY_TO_IDX` (`page9.js`) |
| `descHeMedium` | Per-event Hebrew description, shown in the hover tooltip |

Committed dataset: **14,451 events — 5,325 left, 9,126 right**, from **2023-01-01** to
**2026-07-03**.

An unmatched `actor` falls back to `#888`. All six `GROUPS` actors — including `#31CE1C`
(מפגינים ערבים ישראלים, `arab israelis`, 537 events) — are present in the data, so every
group appears on the timeline.

## Source of truth: the xlsx

`full_v3.xlsx` at the repo root (sheet `raw-israel`, 14,451 data rows). Columns:

| Column | Used as |
|---|---|
| `main_actor` | `actor` — lowercase strings matched verbatim by `GROUPS` |
| `event_type` | `category` — Hebrew, 10 distinct values = `P9_CATEGORIES` one-to-one |
| `date` | `date` |
| `description_he_medium` | `descHeMedium` (2 rows empty → `null`) |
| `row_id` | `rowId` — the stable per-row handle JS pins to, and what a harness reports back for marking rows in the sheet |
| `Description`, `location`, `fatalities`, `source`, `actor_type` | unused |

**There is no `side` column.** The camp split is derived from `main_actor` via
`ACTOR_SIDE` in `server.py`, which must stay in sync with `FOLD4_COALITION_ROWS` /
`FOLD4_CHANGE_ROWS` in `js/groups.js`. Every row maps to a known actor — zero rows are
dropped; a row with an unmapped actor is skipped and reported as a startup warning.

`server.py`'s `load_events()` rebuilds the JSON **in memory on every server start**, and
`/events.json` serves that — so local dev is always current with the xlsx.

**The committed static `events.json` is NOT auto-written.** Deployments that don't run
`server.py` read that file. If the xlsx changes and a deployment needs it, dump
`server.py`'s `/events.json` output to the file manually.

Note that `server.py`'s mtime watcher polls `.html`/`.css`/`.js` only — it does **not**
watch the xlsx. Editing the spreadsheet requires a server restart, not just a reload.

## Category mapping

`CATEGORY_TO_IDX` (`page9.js`) maps an event's `category` to its `P9_CATEGORIES` index.
It is **derived** — `Object.fromEntries(P9_CATEGORIES.map((c, i) => [c, i]))` — because
the pill labels and the xlsx's `event_type` values are now the same Hebrew strings, so
the two lists can't drift. See [Drag-and-Drop](Drag-and-Drop.md) for the full table.

Two Hebrew label lists must stay in sync with each other:
`P9_CATEGORIES` (`page9.js`) and `FOLD6_SQUARE_LABELS` (`js/groups.js`).

## Design source

Figma file `QASHSt1u7b6m6ASgrUPswf` ("Design"). Screens are revised one at a time to
pixel parity — **only pages explicitly documented as revised should be treated as matching
Figma**; everything else is still an older placeholder layout.
