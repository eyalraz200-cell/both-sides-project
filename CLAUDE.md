# Project overview

> ## The wiki is the source of truth — read it first, and keep it updated
>
> `wiki/` documents the **current state** of this project: [Home](wiki/Home.md) ·
> [Folds](wiki/Folds.md) · [Architecture](wiki/Architecture.md) ·
> [Animation-System](wiki/Animation-System.md) · [Groups-and-Legend](wiki/Groups-and-Legend.md) ·
> [Timeline](wiki/Timeline.md) · [Drag-and-Drop](wiki/Drag-and-Drop.md) · [Data](wiki/Data.md) ·
> [Dev-Workflow](wiki/Dev-Workflow.md) · [Glossary](wiki/Glossary.md).
>
> **Every change that alters behavior, geometry, timing, or naming must update the
> matching wiki page in the same turn as the code edit.** No "I'll document it later."
>
> The wiki describes what is true *now* — no history narration, no "this used to be…"
> except in the explicit "Removed — don't reintroduce" callouts. If a wiki page and the
> code disagree, **the code wins** — fix the page.

Two separate, unrelated HTML entry points sharing no layout:

- **`index.html`** — the article/home page ("שקוף" branding). Static content with a CTA button (`.shk-cta-button`) linking to `project.html`. Uses `trigger.css`.
- **`project.html`** — the scrollytelling experience. Uses `style.css`, the `js/` controller scripts (formerly one `main.js`), and the per-page `pageN.js` scripts. A full-viewport `<canvas>` (`.graphic-col`) renders the visuals; a separate scroll column (`.text-col`) drives scroll position and `IntersectionObserver`-based page activation.

## Run / commands

- **Serve:** `python3 server.py` → http://localhost:8080 (no-cache headers; auto-reloads the browser on `.html`/`.css`/`.js` change via mtime polling — note it does NOT watch the xlsx). Requires `openpyxl` (`pip install openpyxl`). Vanilla JS, **no build step, no npm, no tests** — edit files directly.
- **Never kill the dev server as a cleanup step** — leave `:8080` running. Restarting it on explicit request is fine.
- **Verify a JS edit:** `node --check <file>.js` then `curl -o /dev/null -w "%{http_code}" http://localhost:8080/project.html` — a classic `<script>` that fails to parse takes every global in it down, and the visible symptom can surface in a different file.
- **Regenerate `events.json`:** rebuilt in-memory from the xlsx on every server start (`load_events()` in `server.py`), so local dev is always current. The committed static `events.json` (used by deployments not running `server.py`) is NOT auto-written — if the xlsx changes and a deployment needs it, dump `server.py`'s `/events.json` output to the file manually.

## Files

`project.html` loads these via plain `<script>` tags (globals shared across all of them, resolved at call time — a symbol used in one file is often defined in another; that's intentional, not a missing import):

| File | Role |
|---|---|
| `js/*.js` (10 files) | The former `main.js`, split by concern — load order matters and is fixed in `project.html`: `core` (canvas/`PAGES`/`draw`/dash utils) → `nav` (`setActivePage`, fold badge) → `fold1-intro` → `page7-scrub` → `fold8-tooltip` → `groups` (`GROUPS` roster + **all fold triggers**) → `update-groups` (`updateGroups`) → `page8-9-scroll` → `fold11` → `bootstrap` (last, always). Full table in [Architecture](wiki/Architecture.md) |
| `page1.js` | `drawPage1` + page-0 decorative dot column builder |
| `page7.js` | Pinned real timeline: per-event square cascade + canvas year axis |
| `page8.js` | Bridge glide from timeline layout → page9 legit grid |
| `page9.js` | Drag-and-drop categorization + dot-migration animation |
| `page12.js` | `drawPage12` outro |
| `squareboundingbox.js` | Shared grid-geometry constants (`SBB`, `SBB_TIMELINE`, `CENTER_GAP`) |
| `reload.js` | Dev-only mtime poll → auto page reload |
| `server.py` | Local dev server + xlsx→`events.json` generation |

`index.html`/`trigger.css` are the separate article page. Old `main_*` scratch files were deleted; don't recreate them.

Figma source: file `QASHSt1u7b6m6ASgrUPswf` ("Design"). Screens are revised one at a time against Figma nodes, pixel-parity style — **only pages explicitly documented as revised should be treated as matching Figma**; everything else is still placeholder layout. See the wiki's per-fold notes and [Data](wiki/Data.md).

## Fold reference (`@foldN`)

`@foldN` is the canonical fold numbering — 1-indexed by on-screen order, **off by one from the HTML id** (`@foldN` = `id="page-(N-1)"`). Never resolve it by eyeballing ids or symbol names (many symbol names carry legacy numbering, e.g. `fold6Trigger` fires on `@fold4`). The full table with triggers and beat structure is in [Folds](wiki/Folds.md); the short version:

| `@foldN` | id | What plays |
|---|---|---|
| `@fold1` | `page-0` | Hero/intro cover; dot columns with scroll-lag damping |
| `@fold2` | `page-1` | Dots fly into the two 4×3 camp grids; camp headers type in — `fold2Trigger` |
| `@fold3` | `page-2` | Filler rects shrink; one rect per row survives; group labels type in — `fold3Trigger` |
| `@fold4` | `page-3` | Groups glide into the persistent mini-legend; camp headers un-type — `fold6Trigger` |
| `@fold5` | `page-4` | 8 grey sample squares grow in + ACLED note — `squaresRevealTrigger` |
| `@fold6` | `page-5` | Square labels + tooltip demo — `fold7LabelTrigger`, `fold8*` triggers |
| `@fold7` | `page-6` | Squares gain colors and fly to their real timeline dots — `fold9Trigger`, `fold9FlyTrigger` |
| `@fold8` | `page-7` | The real pinned timeline (`page7-scrub`, page7.js) |
| `@fold9` | `page-8` | Bridge glide (page8.js) |
| `@fold10` | `page-9` | Drag-and-drop categorization (page9.js) |
| `@fold11` | `page-10` | Scroll-gated outro (`fold13Trigger`) |

**11 folds total.** Dev shortcut: **Ctrl+Shift+F** toggles the fold-number badge/jump menu.

## Groups roster

`GROUPS` in `js/groups.js` is **6 groups** — camp groups only (the old no-camp groups were removed on v2 and never appear anywhere):

- **מחנה הימין (coalition):** מפגינים חרדים `#4A4A4A`, תנועות התנחלות באיו״ש `#FFAC11`, קבוצות ימין לאומיות `#CC0000` (top→bottom)
- **גוש השינוי (change):** ארגוני שלום ודו קיום `#CD00CD`, ארגוני מחאה נגד הממשלה `#0073FF`, מפגינים ערבים ישראלים `#00B00C` (top→bottom)

Timeline dot color is `p7ActorColor(actor)` — a lookup into `GROUPS` by its `actor` field, `#888` fallback. There is no `P7_COLORS` object. Full roster details in [Groups-and-Legend](wiki/Groups-and-Legend.md).

## Hard rules (do not violate)

- **page9.js "state 1"** (the non-interrupting extreme-drop animation) **is FINALIZED — never touch it without explicit instruction.** See [Drag-and-Drop](wiki/Drag-and-Drop.md).
- Renaming a category pill in `P9_CATEGORIES` (`page9.js`) must also update `FOLD6_SQUARE_LABELS` (`js/groups.js`).
- "Removed — don't reintroduce" callouts in the wiki are binding: the page-1→fold-3 legend morph, the vertical dashed guide-line system on page-9, the anchor squares/`drawGroupLegend`, and the old `main_*` scratch files all stay gone.
- `.section-title` is one shared base rule (20px, weight 600 faked on the Regular Hadassah Friedlaender face — no true Medium OTF exists in `fonts/`). No per-page font-size/weight overrides — a differently-sized title is a regression.
- Harness/scaffolding files are `_debug-*.js`, never ship, and follow the recipe + rules in [Dev-Workflow](wiki/Dev-Workflow.md).

## Conventions (short form — details in [Animation-System](wiki/Animation-System.md))

- Two easing curves cover everything hand-rolled: `p9Ease` (sine in-out, the default) and `p7Ease` (cubic out — timeline square pops and little else). Don't invent new curves.
- Fold animations are fixed-duration 0↔1 triggers (`makeTrigger` + `watchCardThreshold`) fired by a scroll **crossing**, not live scroll readouts; all are reversible mid-flight covering only the remaining distance.
- Multi-beat folds slice the trigger's **raw** progress into `{start, len}` windows and re-apply `p9Ease` fresh per window — never ease an already-eased slice.
- **"Secondary attribute can snap, position never does":** x/y always animates continuously; color/opacity/label visibility may run on their own timing.
- Elements JS repaints every frame deliberately have **no** CSS transition; CSS transitions are reserved for pure state flips.
- Shared tempo: `GROUP_TRANSITION_MS` (1900ms) for legend-system beats; named exceptions get their own constant with a reason.
- The title block system (`.text-card` 480px centered, `.text-card-frame` border-image dash) is documented in [Architecture](wiki/Architecture.md).
- Overlays needing to sit above the canvas must be direct `.layout` children — `.graphic-col`'s stacking context traps z-index.

## Glossary pointers

Conversation shorthand (`@legend`, `@dragcards`, "axis events", the two unrelated "state 1/2" term sets, "axis appearing" vs "axis filling up", "title block") is defined in [Glossary](wiki/Glossary.md) — check it before assuming what a term means.
