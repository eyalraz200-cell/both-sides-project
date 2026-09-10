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
| `page12.js` | `drawPage12` (@fold14's freeform spread) + `p12ShareInit` |
| `squareboundingbox.js` | Shared grid-geometry constants (`SBB`, `SBB_TIMELINE`, `CENTER_GAP`) |
| `reload.js` | Dev-only mtime poll → auto page reload |
| `server.py` | Local dev server + `full_v3.xlsx`→`events.json` generation (derives `side` from `main_actor`) |

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
| `@fold5` | `page-4` | «כל ריבוע מייצג פעולה פוליטית…»: 8 grey sample squares grow in — `squaresRevealTrigger` |
| `@fold6` | `page-5` | ACLED methodology card (visible external link); the ACLED note fades into the mini-legend — `acledNoteTrigger` |
| `@fold7` | `page-6` | Square labels type in (card at 0.5), then «ריחוף העכבר מעל ריבוע…» — the hover demo on the fold's own established crossing (`fold8TooltipCardFrac`): square 0 swells to `FOLD8_DEMO_GROW_PX`, the other 7 dim so the demo dot is singled out, and the tooltip grows-then-types (date + description) 250ms behind it — `fold7LabelTrigger`, `fold8TooltipTrigger`, `fold8DemoGrowTrigger`, `fold8SquareDimTrigger` |
| `@fold8` | `page-7` | Squares gain colors and fly to their real timeline dots — `fold9Trigger`, `fold9FlyTrigger` |
| `@fold9` | `page-8` | The real pinned timeline (`page7-scrub`, page7.js). Clicking a mini-legend row filters that group out — its dots shrink, the rest re-pack and fly (`p7FilterToggle`, desktop only). The filter is set here and on @fold10, and stays in force through every later fold |
| `@fold10` | `page-9` | The size grid: the timeline undraws and every dot on screen morphs to its crowd tier, re-packed at the timeline's own gap (`p7SizeGridOnPage`, page7.js) |
| `@fold11` | `page-10` | **Size down, then fly** (`fold11SizeApply`): every square shrinks to one uniform size *in place* — a draw-time flatten, nothing moves — and only then does the whole field glide to page9's legit zone (`p8Trigger`) — the flatten runs on its own `P7_FLAT_*` clock, never @fold10's `P7_MORPH_*`; the wait between the beats is `fold11BeatGapMs()` (`FOLD11_BEAT_GAP_MS`, `null` = the full flatten clock, a number overlaps them, `0` = both at once) — that glide being two independent beats on two clocks, `P8_SHRINK_MS` (size) and `P8_FLY_MS` (position), staged by `P8_STAGING` (`together` by default: resize *during* flight). @fold10's morph in reverse, landing in the legit grid instead of on the timeline. The «היקף האירועים» pill above the right-hand mini-legend (`p7ScopeBtnEl`) toggles the tiers; it appears on this fold's crossing and stays until @fold14's fade-out takes it with everything else. Its `data-page="10"` is page8's `drawPage8` slot — the same draw function `@fold12` uses — because this fold owns the glide now |
| `@fold12` | `page-11` | Bridge glide (page8.js) — the fold it plays over, but @fold11 is what triggers it |
| `@fold13` | `page-12` | Drag-and-drop categorization (page9.js) |
| `@fold14` | `page-13` | Closing statement; owns the scroll gate + the fade-out (`fold13ScrollT`) — extreme dots stay in their columns. house 100vh section, **static** wrapper (height = spacing only while it isn't sticky); the share block trails it by the house gap (100vh minus this card) |
| `@fold15` | `page-14` | Share title block — «שתפו עם אחרים» over the WhatsApp/X/Facebook/copy-link row (`p12ShareInit`); its card's 0.5 crossing pairs the camps off — the centre split dissolves and every visible dot joins a domino couple with a dot from the other camp, orientation alternating in a checkerboard **weave** across a full-bleed grid. Two beats, in order: partnerless slots' mixed-colour fillers **grow in by size on their own camp's side** of the still-split spread first — free on their own camp's half — a hashed x/y anywhere in it, not a cell in a lattice and not beside a host dot — while any dot over the fixed `P12_DOT_COUNT` shrinks away on the same beat; then the whole field flies to the couple slots, **recolouring as it goes** to a mix of all six group colours (`fold14PairTrigger` → `p12EnsurePairTargets`) |
| `@fold16` | `page-15` | Outro/credits card — an ordinary title block, but near-viewport-tall, so it is placed by its **top edge**, not centred: `p12SpacingFit()` pads the section by `50vh − half the share card` so the @fold15→@fold16 edge gap is `100vh − share card`, on a **static** (non-sticky) wrapper on desktop. Never centre it in 100vh — that's the recurring gap bug. The document ends 48px under it. **Removed — don't reintroduce:** the fixed drawer (`p13Drawer`, `#p13Back`) and the map wheel-zoom, archived with the map on 2026-09-08 (`map-archive`) |

**16 folds** (`page-0` … `page-15`) — `PAGES[]` has 16 slots, with 10 and 11 both `drawPage8`; see [Folds](wiki/Folds.md).

## Groups roster

`GROUPS` in `js/groups.js` is **6 groups** — camp groups only (the old no-camp groups were removed on v2 and never appear anywhere):

- **מחנה הימין (coalition):** תנועות התנחלות באיו״ש `#F9B624` (`settlers`), מפגינים חרדים `#454545` (`haredi jews`), קבוצות ימין לאומיות `#F024FF` (`right wing protesters`) (top→bottom)
- **גוש השינוי (change):** מתנגדי הרפורמה המשפטית `#6B89FF` (`protesters against government`), תומכי עסקת חטופים ומתנגדי המלחמה `#FF1A94` (`peace movements`), מפגינים ערבים ישראלים `#31CE1C` (`arab israelis`) (top→bottom)

Row order is the sort of each camp's `fold6.y` (`legendRow`), not the `FOLD4_*_ROWS` declaration order — see [Groups-and-Legend](wiki/Groups-and-Legend.md).

The `actor` values are `full_v3.xlsx`'s own lowercase `main_actor` strings; the xlsx has no `side` column, so the camp split is derived from them by `ACTOR_SIDE` in `server.py`.

Timeline dot color is `p7ActorColor(actor)` — a lookup into `GROUPS` by its `actor` field, `#888` fallback. There is no `P7_COLORS` object. Full roster details in [Groups-and-Legend](wiki/Groups-and-Legend.md).

## Hard rules (do not violate)

- **Dots never fade.** A dot (any per-event square, anywhere on the page) leaves or arrives by **size** — it shrinks to nothing or grows from nothing. Never animate a dot's opacity to hide, remove, filter, or reveal it. Fading is reserved for text, cards, rules and labels.
- **page9.js "state 1"** (the non-interrupting extreme-drop animation) **is FINALIZED — never touch it without explicit instruction.** See [Drag-and-Drop](wiki/Drag-and-Drop.md).
- Renaming a category pill in `P9_CATEGORIES` (`page9.js`) must also update `FOLD6_SQUARE_LABELS` (`js/groups.js`).
- "Removed — don't reintroduce" callouts in the wiki are binding: the page-1→fold-3 legend morph, the vertical dashed guide-line system on page-11, the anchor squares/`drawGroupLegend`, and the old `main_*` scratch files all stay gone.
- `.section-title` is one shared base rule (20px desktop, **16px under the 600px breakpoint**; `font-weight: 300` + `line-height: 1.5` — 300 resolves down to the real Thin OTF, the only alternative face in `fonts/` besides Regular). No **per-page** font-size/weight overrides — a differently-sized title at the same viewport width is a regression. On the scrolling cards the title and the frame are the *same* `<h2>`, so `.text-card-frame`'s `margin: 0 auto` already zeroes the base rule's bottom margin — see [Architecture](wiki/Architecture.md).
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
