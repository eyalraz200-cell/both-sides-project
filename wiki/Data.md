# Data

## `events.json`

Fetched once by `initPage7()` (`page7.js`) and used by page7, page8 and page9 alike.
One object per event:

| Field | Meaning |
|---|---|
| `rowId` | The xlsx's own stable `row_id` (`"row-11"`). Lets JS pin to specific events by id — all 8 @fold5–@fold8 sample squares are addressed this way (`FOLD6_SQUARE_ROW_IDS` → `p7OccurrenceOfRowId`) |
| `date` | `YYYY-MM-DD`. Sorted lexicographically = chronologically |
| `side` | `"left"` or `"right"` — which camp column the dot lives in |
| `actor` | Join key into `GROUPS`' `actor` field → the dot's color (`p7ActorColor`) |
| `category` | Hebrew category string (the xlsx's `event_type`) → `CATEGORY_TO_IDX` (`page9.js`) |
| `descHeMedium` | Per-event Hebrew description, shown in the hover tooltip |
| `crowd` | Integer crowd estimate or `null` — from the **crowd size** column of a *second* workbook, see below. Drives the @fold9 hover bulge tier (`p7BulgeTier`, [Timeline](Timeline.md#the-hover-bulge)) |

Committed dataset: **14,451 events — 5,325 left, 9,126 right**, from **2023-01-01** to
**2026-07-03**.

An unmatched `actor` falls back to `#888`. All six `GROUPS` actors — including `#31CE1C`
(מפגינים ערבים ישראלים, `arab israelis`, 537 events) — are present in the data, so every
group appears on the timeline.

## Source of truth: the xlsx

### `Events_with_description_he_medium.xlsx` — the crowd-size column (`CROWD_XLSX`)

`full_v3.xlsx` has no crowd column; the reported figure lives in this second workbook
(sheet `Sheet1`: side, main actor, event category, description, date, fatalities,
**crowd size**, description_he_medium — 13,523 rows). `load_crowd()` (`server.py`) joins it
to the v3 rows on the **first 80 characters of the English `Description`** — the only text
shared verbatim by both files. 2,757 of 14,451 events end up with a figure; the rest are
`null`. If the file is missing the server warns and every `crowd` is `null`.

`parse_crowd(raw)` turns the cell's free text (`crowd size=about 2,000`,
`…=tens of thousands`, `no report`) into ONE integer estimate: the larger of any number in
the text and the first word bucket in `CROWD_WORDS` (hundreds of thousands 300,000 · tens
of thousands 30,000 · thousands 3,000 · hundreds 300 · dozens 50 · tens 30); blank / "no
report" → `null`. Distribution: < 100 — 837 · 100–999 — 985 · 1k–9,999 — 734 · ≥ 10k — 201.

`full_v3.xlsx` at the repo root (sheet `raw-israel`, 14,451 data rows). Columns:

| Column | Used as |
|---|---|
| `main_actor` | `actor` — lowercase strings matched verbatim by `GROUPS` |
| `event_type` | `category` — Hebrew, 10 distinct values = `P9_CATEGORIES` one-to-one |
| `date` | `date` |
| `description_he_medium` | `descHeMedium` (2 rows empty → `null`) |
| `row_id` | `rowId` — the stable per-row handle JS pins to, and what a harness reports back for marking rows in the sheet |
| `actor_type` | unused by code (hidden column J). Sub-type filled only for the former `protesters against government` rows: `anti judicial reform demonstrators` (2,094), `anti government protesters` (373) — both still `protesters against government` — and `hostage deal protesters` (2,146), whose `main_actor` was **reassigned to `peace movements`** in the sheet on 2026-09-06 (so תומכי עסקת חטופים ומתנגדי המלחמה = left activists + hostage-deal protesters; the sub-type column keeps them distinguishable) |
| `Description`, `location`, `fatalities`, `source` | unused; columns G–J are hidden in the sheet |

### `full_v4.xlsx` — v3 + geodata (source of `map/event-points.json`)

`full_v4.xlsx` is `full_v3.xlsx` with four columns appended: `acled_id` (ACLED
`event_id_cnty`, e.g. `ISR13526`), `latitude`, `longitude`, `geo_precision` (ACLED's 1 =
named settlement, 2 = nearby stand-in, 3 = region centre only; 11,314 / 3,106 / 31 rows).
Each row was matched against the raw ACLED exports (`raw-israel.csv`, `raw-palestine .csv`,
repo root) on `(date, Description == notes, location)` — 14,451/14,451 matched, zero
unmatched. Coordinates are settlement centroids: 904 distinct points across all rows.
Two row pairs in the sheet are literal duplicates of one ACLED event and share an `acled_id`:
`row-4132`/`row-4134` (`ISR42882`), `row-8895`/`row-8896` (`PSE46925`). `server.py` still
reads `full_v3.xlsx`; the page consumes the geodata only through `map/event-points.json` (see `map/` below).

## `map/` — archived with the event map

The @fold14 event map was archived on **2026-09-08** (branch `map-archive`, snapshot commit
`834ee0d`). `map.js`, `map/region.geojson` (Natural Earth 10m admin-0 outlines for the region)
and `map/event-points.json` (904 distinct settlement coordinates + a per-event index into them,
covering all 14,451 rows) all live there, not in the working tree. Restore with
`git checkout map-archive -- map map.js` if the map ever comes back; the geodata is keyed by the
xlsx `row_id` number, so it must be rebuilt from `full_v4.xlsx`'s `latitude`/`longitude` columns
if the rows change.

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
