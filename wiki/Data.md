# Data

## `events.json`

Fetched once by `initPage7()` (`page7.js`) and used by page7, page8 and page9 alike.
One object per event:

| Field | Meaning |
|---|---|
| `rowId` | The xlsx's own stable `row_id` (`"row-11"`). Lets JS pin to specific events by id — all 8 @fold5–@fold6 sample squares are addressed this way (`FOLD6_SQUARE_ROW_IDS` → `p7OccurrenceOfRowId`) |
| `date` | `YYYY-MM-DD`. Sorted lexicographically = chronologically |
| `side` | `"left"` or `"right"` — which camp column the dot lives in |
| `actor` | Join key into `GROUPS`' `actor` field → the dot's color (`p7ActorColor`) |
| `category` | Hebrew category string (the xlsx's `event_type`) → `CATEGORY_TO_IDX` (`page9.js`) |
| `descHeMedium` | Per-event Hebrew description, shown in the hover tooltip |
| `crowd` | Integer crowd estimate or `null` — from the **crowd size** column of a *second* workbook, see below. Drives the @fold8 hover bulge tier (`p7BulgeTier`, [Timeline](Timeline.md#the-hover-bulge--p7bulgetick--p7bulgelist--p7bulgeshift-page7js)) |

Committed dataset (`events.json` at the repo root, `crowd` field included): **12,401
events — 5,551 left, 6,850 right**, from **2023-01-01** to **2026-07-03** — the sheet rows
minus the 4,036 dropped by `SOLE_SOURCE_EXCLUDE`, the 1,418 marked in the `hidden` column,
and the 633 dated after the last ACLED event (`CUT_AFTER_LAST_ACLED`, all below).

**The timeline stops where ACLED stops, for now.** `load_events()` finds the latest date
among rows whose `data_source` is `acled` (2026-07-03 today) and drops every row dated after
it, whatever its source — The Fortress keeps posting weeks past ACLED's last export and
those fortress-only dots used to trail alone at the axis's end. `CUT_AFTER_LAST_ACLED = False`
in `server.py` ships the full tail again; a newer ACLED export moves the cut forward by itself.
`peace movements` (תומכי עסקת חטופים ומתנגדי המלחמה) has **no event before 2023-10-07** —
its first is 2023-10-14.

An unmatched `actor` falls back to `#888`. All six `GROUPS` actors — including `#31CE1C`
(גורמים ערבים ישראלים, `arab israelis`, 545 events) — are present in the data, so every
group appears on the timeline.

## `events-en.json` — English descriptions

`{ rowId: description }`: the workbook's `description_en_short` (step 07) where filled, else
the `Description` column (ACLED's original English text). `events-ar.json` is the same map
from `description_ar`, fetched only by the Arabic page. Written by `server.py` next to `events.json` on every start. Fetched
**only** by the English page (`p7LoadEnglishDescs`, page7.js), which stores it as
`descEn` on each event; `p7EventDesc(ev)` returns `descEn`, else `descHeMedium`.
**Committed alongside `events.json`**, so the deployed English page has it — after changing
the xlsx, restart the server and commit both. It is ACLED content verbatim, under the same
pending-approval status as `events.json`. If the file is missing the English page falls
back to the Hebrew descriptions.

## Data licensing — the xlsx are local-only, never committed

Every workbook (`events.xlsx`, the retired copies in `_xlsx-archive/`,
`archive/combined_V1_hebrew_summaries.xlsx`) and the raw ACLED exports (`raw-*.csv`) contain
ACLED-licensed rows. ACLED forbids giving the public direct access to its content, so they
are **gitignored (`*.xlsx`, `raw-*.csv`) and exist only on local disks** — the public repo's
history was rewritten on 2026-09-22 to remove every past copy (along with
`map/event-points.json` and `_debug-misclassified.json`, which carried per-event data).
A clone without the workbooks still runs: `server.py` serves the committed `events.json`
unchanged and skips `_sync_static_events()`.

`events.json` (date, actor, side, category, `descHeMedium`, crowd, rowId per event) is the
**single committed derivative**, because GitHub Pages needs it client-side. Its acceptability
under ACLED's "cannot be reverse-engineered" condition is **pending ACLED's written answer**;
if they refuse, the follow-up is a private backend or a description-less dataset. Never add
any other event-level export to the repo.

## Classification pipeline (`0N_*.py`, OpenAI Batch API)

Seven standalone scripts at the repo root, each `submit <xlsx>` → `status` → `download`
(writes `<name> - <step>.xlsx` next to the source; copy it back over `events.xlsx` by hand).
Run in this order on new rows (every step skips rows whose only source is in `SOLE_SOURCE_EXCLUDE` — they never ship, so they are never paid for):

| Step | Writes | Rows it touches |
|---|---|---|
| `01_identify_main_actor.py` | `main_actor` (+ certainty / needs_review / reason) | every row with a `Description` — run it only on a sheet of NEW rows |
| `04_split_subactions.py` | rewrites `Description` + `crowd` on the parent (originals kept in `description_original` / `crowd_total`), APPENDS one child row per extra action (`split_from` = parent `row_id`, fresh `row-N`), blanks `event_type` / `description_he_medium` on both and sets `reclassify = yes` | ACLED/manual rows whose text holds a second action by a subset of the main actor (two crowd figures, or "some / a group / dozens of the protesters"); never Fortress rows, hidden rows or PLO-only rows |
| `02_classify_event_type_no_intimidation.py` | `event_type` (+ certainty / needs_review / reason) | rows with a BLANK `event_type`, or `reclassify = yes`. **Rows with a date in `event_type_hand` are skipped** unless `reclassify = yes` |
| `03_translate_hebrew_and_date.py` | `date`, `description_he_medium`; clears `reclassify` | rows with no Hebrew yet, or `reclassify = yes` |
| `05_extract_crowd.py` | `crowd` in the sheet's own vocabulary (`about 2,000`, `dozens`, `2`) or the explicit `no report`, plus `crowd_reason` | live rows with a BLANK `crowd`: Fortress rows, split halves and manual rows always; ACLED rows only when the text carries a size cue (`CUE` regex) — the pre-2026-10-02 crowd run saw every ACLED row, so a cue-less blank is a decided unknown and gets `no report` by rule on download. A non-blank `crowd` cell is never touched (that is the hand override) |
| `06_rewrite_fortress_desc.py` | Fortress rows only: `description_he_medium` rewritten in the ACLED register (actor named as subject, place from `location`, 70–110 chars, every fact kept; the log's own line moves to `description_he_original`) and a short English `Description` (80–140 chars, no date prefix — the length the English pass will later bring every ACLED row down to), plus `description_note` | live `the fortress` rows with a blank `description_he_original`; a date in `description_hand` skips the row |
| `07_short_english_and_arabic.py` | `description_en_short` (the shipped English: the Hebrew line's facts at about its length, no date prefix, ACLED spellings) and `description_ar` (MSA translation of the Hebrew, fixed glossary in the prompt), plus `description_note`. `Description` is never touched — the classifiers read it | live rows with Hebrew and a blank `description_ar`; Fortress rows only after step 06 has rewritten them; a date in `description_hand` skips the row. Maps results back by `row_id` |

The prompts in 01 and 02 carry the hand-review rules of 2026-10-03 (see the `main_actor`
and `event_type` rows in the column table below). `crowd` after step 04 is the size of the
group that performed THAT event's action ("dozens" for the roadblock, "about 40,000" for the
rally it split from); a subset described only as "some" / "a group" gets a blank crowd.

## Source of truth: the xlsx

### `events.xlsx` — the ONE workbook (`EVENTS_XLSX`)

Since 2026-10-02 there is a single workbook at the repo root, `events.xlsx` (sheet
`raw-israel`, 14,456 data rows: 14,451 ACLED rows + 5 hand-added events,
`row-15392`…`row-15396`, that carry no `acled_id`/geodata). It is the former `full_v4.xlsx`
with the `crowd` column merged in from the former `Events_with_description_he_medium.xlsx`
(joined once, on the first 80 characters of the English `Description`; 2,811 rows carry a
figure). Those two, `full_v3.xlsx` and the 2026-09-27 backup are parked in `_xlsx-archive/`
(gitignored) and **nothing reads them** — edit `events.xlsx` only, and never reintroduce a
second workbook as a live dependency.

`parse_crowd(raw)` turns the cell's free text (`crowd size=about 2,000`,
`…=tens of thousands`, `no report`) into ONE integer estimate: the larger of any number in
the text and the first word bucket in `CROWD_WORDS` (hundreds of thousands 300,000 · tens
of thousands 30,000 · thousands 3,000 · hundreds 300 · dozens 50 · tens 30); blank → `null`. Distribution: < 100 — 837 · 100–999 — 985 · 1k–9,999 — 734 · ≥ 10k — 201.

Columns:

| Column | Used as |
|---|---|
| `main_actor` | `actor` — lowercase strings matched verbatim by `GROUPS`. **Hand overrides:** 7 pre-Oct-7 joint Arab-Jewish / left protests were moved `peace movements` → `arab israelis` on 2026-09-27 (the pink group starts 7 Oct 2023), and a 2026-10-03 review moved ~30 more (anti-aid / anti-deal rows out of `peace movements` into `right wing protesters`, October Council and anti-Iran-war rows into `protesters against government`, Jewish nationalist violence in Jerusalem out of `settlers`). The rules are in `01_identify_main_actor.py`'s prompt. Every hand-set row carries its date in `main_actor_hand`; a classifier rerun must skip those rows |
| `event_type` | `category` — Hebrew, 10 distinct values = `P9_CATEGORIES` one-to-one. **Hand overrides live only in this column** — the 2026-09-17 reclassification of 8 rows out of פוגרום (`row-7660`, `8108`, `8242`, `8717`, `9457`, `9715`, `12865`, `14679`; see commit `d43fcc3`) was lost once when the dataset moved to `full_v4.xlsx` and re-applied on 2026-10-03. A second hand pass on 2026-10-03 changed 63 more rows after an outlier review (stones at houses → נשק קר, "armed" without use → פיזית, eggs/smoke/objects → הפרות סדר, crowd + violence + fire → פוגרום, tear-gas launchers → נשק חם, etc. — the rules now live in `02_classify_event_type_no_intimidation.py`'s prompt). **Every hand-set row carries the date in column `event_type_hand`**; a classifier rerun must skip those rows |
| `date` | `date` |
| `description_he_medium` | `descHeMedium` (2 rows empty → `null`) |
| `row_id` | `rowId` — the stable per-row handle JS pins to, and what a harness reports back for marking rows in the sheet |
| `actor_type` | unused by code (hidden column J). Sub-type filled for three groups of rows: `anti judicial reform demonstrators` (2,094) and `anti government protesters` (373) — both `main_actor` `protesters against government` — and `hostage deal protesters` (2,146), whose `main_actor` is `peace movements` (so תומכי עסקת חטופים ומתנגדי המלחמה = left activists + hostage-deal protesters; the sub-type column keeps them distinguishable) |
| `Description`, `location`, `fatalities` | unused; columns G–J are hidden in the sheet |
| `data_source` | Column Q. Which dataset the row came from: `acled` (14,451), `manual` (the 5 hand-added rows), `the fortress` (3,778 rows, `row-15397`…`row-19174`, appended 2026-10-02 from `tiud-events-2026-09-29.xlsx` — a Hebrew settler-violence log, 2023-10-06 → 2026-09-28; `main_actor` was assigned by hand on 2026-10-02 — 3,746 `settlers`, 22 `right wing protesters` (aid-convoy blockades, Flag March assaults, Old City / al-Aqsa incidents), 10 `not relevant` (army- or state-led rows); 46 judgment calls carry `yes` in `main_actor_needs_review`, column U. `event_type` was filled by `02_classify_event_type_no_intimidation.py` on 2026-10-03 for the 2,352 live rows (57 flagged `event_type_needs_review = yes`); the model's Hebrew reasoning sits in `event_type_reason`. A sample review the same day moved 172 grazing incursions ניכוס שטח → הפרות סדר (appropriation now needs a tent/caravan/fence/outpost — rule added to the 02 prompt, with a passive-voice rule and a displacement-outcome rule) and fixed 8 sampled misfires; all stamped in `event_type_hand`. **Deduped against ACLED on 2026-10-03** by reading every pair within ±1 day (see `_dedupe/`, gitignored): 1,416 rows were `sure` duplicates of an ACLED event, 342 `unsure`, 2,020 have no ACLED counterpart; a second reading of the 342 the same day (`_dedupe/pass2/`, 12 readers, ±1-day ACLED window, told to prefer `sure` when place and act line up and nothing contradicts) resolved 293 `sure`, 38 `distinct`, 11 `unsure`, and the user decided those 11 (5 sure, 6 distinct; note ends `| user 2026-10-03`) — so 1,714 `sure` in all and no `unsure` left. **ACLED wins:** every `sure` Fortress row carries `dup of row-N` in its `hidden` column, so `load_events()` drops it; `distinct` and `unsure` rows stay live. `dedupe_note` holds both readers' reasons (`| pass2: …`).) Not read by the site yet; distinct from `source`, which is the news outlet |
| `acled_duplicate_of`, `acled_match`, `dedupe_note` | Columns V–X, Fortress rows only: the `row_id` of the ACLED row describing the same incident, `sure` / `unsure`, and the reader's one-line reason. The note also lists sibling Fortress rows that matched the same ACLED event — the Fortress sheet has ~145 internal duplicates (371 rows) |
| `fortress_id`, `fortress_categories`, `fortress_links` | Columns R–T, Fortress rows only: the log's own row number (never confuse with `row_id`), its `·`-separated tags (25 distinct, multi-label), and its source URLs |
| `crowd` | Column P. Free text (`about 2,000`, `tens of thousands`, `2`) or the explicit `no report` (= unknown, deliberate); **read by `load_events()`** via `parse_crowd` (`no report` → `null`). Filled by `05_extract_crowd.py`; the model's one-line quote sits in `crowd_reason` |
| `hidden` | Column O, optional. **Read by `load_events()`**: any non-empty cell keeps the row in the workbook but drops it from `events.json`. Marked rows are also filled yellow in the sheet. 2 hand-marked (`row-7707`, `row-2145`) plus the 1,416 Fortress rows that duplicate an ACLED event (`dup of row-N`) |
| `source` | `;`-separated outlet names, filled on every row (backfilled from the raw ACLED exports on 2026-09-23). **Read by `load_events()`**: a row whose *only* source(s) are in `SOLE_SOURCE_EXCLUDE` (`server.py`) is dropped. The set is `{plo negotiations affairs department}`: the sheet's largest source (5,056 rows, all settler events), and the 4,036 rows that cite nothing else are excluded; the 1,020 corroborated by another outlet stay. Empty the set to ship every row. Origin split of the 96 outlets: `sources-by-origin.csv` (untracked) |

### The four geodata columns

`events.xlsx` carries four geodata columns: `acled_id` (ACLED
`event_id_cnty`, e.g. `ISR13526`), `latitude`, `longitude`, `geo_precision` (ACLED's 1 =
named settlement, 2 = nearby stand-in, 3 = region centre only; 11,314 / 3,106 / 31 rows).
Each row was matched against the raw ACLED exports (`raw-israel.csv`, `raw-palestine .csv`,
repo root) on `(date, Description == notes, location)` — 14,451/14,451 matched, zero
unmatched. Coordinates are settlement centroids: 904 distinct points across all rows.
Two row pairs in the sheet are literal duplicates of one ACLED event and share an `acled_id`:
`row-4132`/`row-4134` (`ISR42882`), `row-8895`/`row-8896` (`PSE46925`). `server.py` reads this
file for events, but **nothing in the page consumes the geodata** (gitignored, see above).

> **Removed — don't reintroduce:** the @fold16 event map (`map.js`, `map/region.geojson`,
> `map/event-points.json`), snapshot at commit `834ee0d`; its geodata came from
> the workbook's `latitude`/`longitude` columns.

**There is no `side` column.** The camp split is derived from `main_actor` via
`ACTOR_SIDE` in `server.py`, which must stay in sync with `FOLD4_COALITION_ROWS` /
`FOLD4_CHANGE_ROWS` in `js/groups.js`. Every row maps to a known actor — zero rows are
dropped; a row with an unmapped actor is skipped and reported as a startup warning.

`server.py`'s `load_events()` rebuilds the JSON **in memory on every server start**, and
`/events.json` serves that — so local dev is always current with the xlsx.

**The committed static `events.json` is auto-written on server start** (`_sync_static_events()`)
whenever the generated content differs from the file on disk — same bytes as `/events.json`
(`ensure_ascii=False`, single line), so an unchanged xlsx leaves git clean. Deployments that
don't run `server.py` (GitHub Pages) read that file: after editing either xlsx, restart the
server and **commit the rewritten `events.json`**. A stale copy with no `crowd` field makes
`p7BulgeTier` return 0 for every event, and @fold9's size grid then never resizes anything.

Note that `server.py`'s mtime watcher polls `.html`/`.css`/`.js` files only (at the root
and under `js/`) — it does **not** watch the xlsx. Editing the spreadsheet requires a server
restart, not just a reload.

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
