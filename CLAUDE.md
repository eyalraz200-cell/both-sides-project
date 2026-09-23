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

One HTML entry point: **`index.html`** — the scrollytelling experience, served at the site
root. Uses `style.css`, the `js/` controller scripts, and the per-page `pageN.js` scripts. A
full-viewport `<canvas>` (`.graphic-col`) renders the visuals; a separate scroll column
(`.text-col`) drives scroll position and `IntersectionObserver`-based page activation.

**Removed — don't reintroduce:** the שקוף article/home page (the old `index.html` +
`trigger.css` + its three article images) that used to front the project. The root URL is
the project itself now. `project.html` is only a redirect stub to the root so old shared links keep working — never put content in it.

## Run / commands

- **Serve:** `python3 server.py` → http://localhost:8080 (no-cache headers; auto-reloads the browser on any `.html`/`.css`/`.js` change at the root or under `js/` via mtime polling — it does NOT watch the xlsx). `--port N` and `--watch a.js,dir` narrow that. Requires `openpyxl` (`pip install openpyxl`). Vanilla JS, **no build step, no npm, no tests** — edit files directly.
- **Never kill the dev server as a cleanup step** — leave `:8080` running. Restarting it on explicit request is fine.
- **Verify a JS edit:** `node --check <file>.js` then `curl -o /dev/null -w "%{http_code}" http://localhost:8080/` — a classic `<script>` that fails to parse takes every global in it down, and the visible symptom can surface in a different file.
- **Regenerate `events.json`:** rebuilt on every server start (`load_events()` in `server.py`) from `full_v3.xlsx` plus `Events_with_description_he_medium.xlsx` (the `crowd` column — both are live dependencies). **Both workbooks are ACLED-licensed, gitignored (`*.xlsx`) and must never be committed** — they exist only on local disks; a clone without them serves the committed `events.json` unchanged. `events.json` is the single committed derivative, pending ACLED's written OK (see [Data](wiki/Data.md)). `page7.js` fetches `events.json` at runtime. The server also **writes the committed static `events.json`** (what GitHub Pages serves) whenever the generated content differs (`_sync_static_events()`, `ensure_ascii=False`, single line) — an unchanged xlsx leaves git clean. After changing either xlsx: restart the server, then commit the rewritten `events.json`, or the deployed site drifts (a stale copy without `crowd` once made every dot tier 0, so @fold11 never resized).

## Files

`index.html` loads these via plain `<script>` tags (globals shared across all of them, resolved at call time — a symbol used in one file is often defined in another; that's intentional, not a missing import):

| File | Role |
|---|---|
| `js/*.js` (10 files) | The former `main.js`, split by concern — load order matters and is fixed in `index.html`: `core` (canvas/`PAGES`/`draw`/dash utils) → `nav` (`setActivePage`, fold badge) → `fold1-intro` → `page7-scrub` → `fold8-tooltip` → `groups` (`GROUPS` roster + **all fold triggers**) → `update-groups` (`updateGroups`) → `page8-9-scroll` → `fold11` → `bootstrap` (last, always). Full table in [Architecture](wiki/Architecture.md) |
| `page1.js` | `drawPage1` + page-0 decorative dot column builder |
| `page7.js` | Pinned real timeline: per-event square cascade + canvas year axis |
| `page8.js` | Bridge glide from timeline layout → page9 legit grid |
| `page9.js` | Drag-and-drop categorization + dot-migration animation |
| `page12.js` | `drawPage12` (@fold15's freeform spread) + `p12ShareInit` |
| `squareboundingbox.js` | Shared grid-geometry constants (`SBB`, `SBB_TIMELINE`, `CENTER_GAP`) |
| `reload.js` | Dev-only mtime poll → auto page reload |
| `server.py` | Local dev server + `full_v3.xlsx`→`events.json` generation (derives `side` from `main_actor`) |

`main.js` and the `main_*` scratch files do not exist; don't recreate them.

Figma source: file `QASHSt1u7b6m6ASgrUPswf` ("Design"). Screens are revised one at a time against Figma nodes, pixel-parity style — **only pages explicitly documented as revised should be treated as matching Figma**; everything else is still placeholder layout. See the wiki's per-fold notes and [Data](wiki/Data.md).

## Fold reference (`@foldN`)

`@foldN` is the canonical fold numbering — 1-indexed by on-screen order, **off by one from the HTML id** (`@foldN` = `id="page-(N-1)"`). Never resolve it by eyeballing ids or symbol names (many symbol names carry legacy numbering, e.g. `fold6Trigger` fires on `@fold4`). The full table with triggers and beat structure is in [Folds](wiki/Folds.md); the short version:

| `@foldN` | id | What plays |
|---|---|---|
| `@fold1` | `page-0` | Hero/intro cover; dot columns with scroll-lag damping |
| `@fold2` | `page-1` | Dots fly into the two 4×3 camp grids; camp headers type in — `fold2Trigger` |
| `@fold3` | `page-2` | Filler rects shrink; one rect per row survives; group labels type in — `fold3Trigger` |
| `@fold4` | `page-3` | Groups glide into the persistent mini-legend; camp headers un-type — `fold6Trigger` |
| `@fold5` | `page-4` | «כל ריבוע מייצג פעולה פוליטית פיזית של אחת הקבוצות.» + «ריחוף עם העכבר חושף את פרטי האירוע…» (**mobile has its own second sentence**, «לחיצה ממושכת על ריבוע…», `.copy-desktop`/`.copy-mobile`): phase 1, 8 sample squares grow in **already in their group colours** — `squaresRevealTrigger`; phase 2 (gated on the grow-in finishing, `fold5DemoGate`), the hover demo on this card's own crossing (`fold8TooltipCardFrac`; flat `FOLD8_MOBILE_CARD_FRAC` on mobile): cursor glide, square 0 swells to `FOLD8_DEMO_GROW_PX`, the other 7 dim, the tooltip grows-then-types, then user hover / press-and-hold — `fold7CursorTrigger`, `fold8TooltipTrigger`, `fold8DemoGrowTrigger`, `fold8SquareDimTrigger` |
| `@fold6` | `page-5` | **HIDDEN for now** (`hidden` section; number and `PAGES` slot kept). As built: ACLED methodology card (visible external link); the ACLED note fades into the mini-legend — `acledNoteTrigger` |
| `@fold7` | `page-6` | **HIDDEN for now** — its animation plays as @fold5's phase 2. As built: Square labels type in (card at 0.5), then «ריחוף העכבר מעל ריבוע…» (**mobile has its own copy**, «לחצו והחזיקו…», via the `.copy-desktop`/`.copy-mobile` span pair) — the hover demo on the fold's own established crossing (`fold8TooltipCardFrac`; flat `FOLD8_MOBILE_CARD_FRAC` on mobile): square 0 swells to `FOLD8_DEMO_GROW_PX`, the other 7 dim so the demo dot is singled out, and the tooltip grows-then-types (date + description) 250ms behind it — `fold7LabelTrigger`, `fold8TooltipTrigger`, `fold8DemoGrowTrigger`, `fold8SquareDimTrigger` |
| `@fold8` | `page-7` | Card: the ACLED methodology copy («תיאורי האירועים ומועדי התרחשותם לקוחים ממאגר ACLED, גוף מחקר בינלאומי. שיוך האירועים לקבוצות, סיווגם ותרגומם לעברית נעשו בעזרת מודלים של OpenAI.» — **mobile appends «פרטים במקרא.» on the same line**, a `.copy-mobile` span; visible external link). The (already coloured) squares fly to their real timeline dots — `fold9FlyTrigger` (`fold9Trigger` now only fades the demo cursor). The ACLED note types into the mini-legend on this card's 0.5 crossing (`acledNoteTrigger`). **DESKTOP: the legend stays open — labels + note — from @fold4 until the year axis has fully drawn** (`checkLegendCollapse`), then collapses — and re-opens when the reader scrolls back up out of the timeline into @fold8 (`legendAxisLatch`). **Mobile's מקרא drawer collapses at @fold4 as built** (`FOLD6_MLEGEND_HOLD_OPEN = false`) |
| `@fold9` | `page-8` | Card: «האירועים המוצגים התרחשו מתחילת 2023 ועד היום.» — the date-range block the whole timeline now hangs off. **Its 0.5 crossing draws the year axis in** (`fold9AxisTrigger` → `p7AxisShouldShow`, page7.js — both breakpoints, replacing @fold8's fly-gated rule and mobile's `p7AxisIntroCardAlmostOut`). **Once the card's vertical centre passes the top edge the axis starts filling** (`p7UpdateEngagement`, `P7_ENGAGE_CARD_OUT_FRAC_* = 0.5`) — the same line `js/page7-scrub.js` anchors its `t=0` to, so the dataset still begins at its first day. **The 8 sample squares fly on that same 0.5 crossing**, with the draw-in (`fold9FlyTrigger`) |
| `@fold10` | `page-9` | The real pinned timeline (`page7-scrub`, page7.js). Clicking a mini-legend row filters that group out — its dots shrink, the rest re-pack and fly (`p7FilterToggle`). **Both breakpoints**: desktop clicks the row's strip, mobile TAPS the matching card in the מקרא sheet (`fold6MLegendRowTap`, js/groups.js). The filter is set here and on @fold11, and stays in force through every later fold |
| `@fold11` | `page-10` | The size grid: the timeline undraws and every dot on screen morphs to its crowd tier, re-packed at the timeline's own gap (`p7SizeGridOnPage`, page7.js) |
| `@fold12` | `page-11` | **Size down, then fly** (`fold11SizeApply`): every square flattens to one uniform size in place, then the whole field glides to page9's legit zone (`p8Trigger`). The «הצגת גודל האירועים» pill (`p7ScopeBtnEl`) toggles the tiers from here until @fold15's fade-out. Its `PAGES` slot is `drawPage8` because this fold owns the glide |
| `@fold13` | `page-12` | Bridge glide (page8.js) — the fold it plays over, but @fold12 is what triggers it |
| `@fold14` | `page-13` | Drag-and-drop categorization (page9.js) |
| `@fold15` | `page-14` | Closing statement; owns the scroll gate + the fade-out (`fold13ScrollT`) — extreme dots stay in their columns. house 100vh section, **static** wrapper (height = spacing only while it isn't sticky); the share block trails it by the house gap (100vh minus this card) |
| `@fold16` | `page-15` | Share title block («שתפו עם אחרים» + share row, `p12ShareInit`); its 0.5 crossing pairs the camps off into domino couples on a full-bleed weave — fillers grow in by size, extras shrink away, then the field flies and recolours (`fold14PairTrigger` → `p12EnsurePairTargets`) |
| `@fold17` | `page-16` | Outro/credits card — near-viewport-tall, placed by its **top edge** (`p12SpacingFit()`) on a **static** wrapper; never centre it in 100vh. Its title is the one `.section-title` size exception (36px / 26px). **Removed — don't reintroduce:** the fixed drawer (`p13Drawer`, `#p13Back`) and the map (snapshot at commit `834ee0d`) |

**17 folds** (`page-0` … `page-16`) — `PAGES[]` has 17 slots, with 7 and 8 both `drawFold9` and 11 and 12 both `drawPage8`; see [Folds](wiki/Folds.md).

## Groups roster

`GROUPS` in `js/groups.js` is **6 groups**, three per camp:

- **קואליציית הימין (coalition):** תנועות התנחלות באיו״ש `#F9B624` (`settlers`), מפגינים חרדים `#454545` (`haredi jews`), קבוצות ימין לאומיות `#F024FF` (`right wing protesters`) (top→bottom)
- **גוש השינוי (change):** מתנגדי הרפורמה המשפטית `#6B89FF` (`protesters against government`), תומכי עסקת חטופים ומתנגדי המלחמה `#FF1A94` (`peace movements`), מפגינים ערבים ישראלים `#31CE1C` (`arab israelis`) (top→bottom)

The `actor` values are the xlsx's lowercase `main_actor` strings; the camp split is derived from them by `ACTOR_SIDE` in `server.py`, which must stay in sync with `FOLD4_*_ROWS` by hand. Dot color is `p7ActorColor(actor)` (`#888` fallback). Row order, colors and the rest are in [Groups-and-Legend](wiki/Groups-and-Legend.md).

## Hard rules (do not violate)

- **Dots never fade.** A dot (any per-event square, anywhere on the page) leaves or arrives by **size** — it shrinks to nothing or grows from nothing. Never animate a dot's opacity to hide, remove, filter, or reveal it. Fading is reserved for text, cards, rules and labels.
- **page9.js "state 1"** (the non-interrupting extreme-drop animation) **is FINALIZED — never touch it without explicit instruction.** See [Drag-and-Drop](wiki/Drag-and-Drop.md).
- Renaming a category pill in `P9_CATEGORIES` (`page9.js`) must also update `FOLD6_SQUARE_LABELS` (`js/groups.js`).
- "Removed — don't reintroduce" callouts in the wiki are binding: the page-1→fold-3 legend morph, the vertical dashed guide-line system on page-12, the anchor squares/`drawGroupLegend`, and the old `main_*` scratch files all stay gone.
- `.section-title` is one shared base rule (20px desktop, **16px under the 600px breakpoint**; HadassahFriedlaender Thin 100, a local `@font-face` in `style.css`, + `line-height: 1.5`; only Thin 100 and Regular 400 exist). No **per-page** font-size/weight overrides, with **one named exception**: `#page-16 .section-title` (@fold17's credits headline) is 36px desktop / 26px mobile. Any other differently-sized title at the same viewport width is a regression. On the scrolling cards the title and the frame are the *same* `<h2>`, so `.text-card-frame`'s `margin: 0 auto` already zeroes the base rule's bottom margin — see [Architecture](wiki/Architecture.md).
- Harness/scaffolding files are `_debug-*.js`, never ship, and follow the recipe + rules in [Dev-Workflow](wiki/Dev-Workflow.md).
- **A mobile change must never touch desktop, and vice versa.** Tuning asked for at one
  breakpoint applies to that breakpoint ONLY. Before editing any value, check whether the
  constant/function it lives in is shared: if it is, **split it per breakpoint** (a
  `*_MOBILE` / `*_DESKTOP` pair behind an `isMobile()` reader, the `p7Sq()` / `p7GapRatio()`
  convention) rather than overwriting the shared one. This applies to behaviour too, not
  just numbers — a new mechanism (a trigger replacing a ramp, dots drawn in a new state)
  gets gated the same way, with the other breakpoint left on its existing code path.
  A `_debug-*.js` harness being viewport-gated does **not** gate the values it drives.

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
