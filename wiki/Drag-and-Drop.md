# Drag-and-drop categorization — `@fold10` (`#page-9`, `page9.js`)

"איפה עובר הגבול בעיניכם?" — the reader drags category pills into an "extreme" zone and
the matching event dots migrate above the divider line.

## Layout

`<section class="text-section page9-panel" data-page="9" id="page-9">`, `min-height: 200vh`
= 100vh scrolling title row + 100vh sticky panel.

- `.page9-title-row` — the normal scrolling title card plus `.page9-header-subtitle`
  ("גררו סוגי פעולות שנחשבות בעיניכם לקיצוניות").
- `.page9-sticky` — `position: sticky; top: 0; height: 100vh`. Gains `.engaged` once the
  title card sticks, `.dragging` during a pointer drag, and `.frozen`
  (`position: fixed`) at the outro fold.
- `.page9-zone-wrap-extreme` — `position: fixed`, centered, `top: 14vh; bottom: 28.78vh`,
  bottom-anchored flex column. **That `28.78vh` is hand-synced to `P9_MID`** — change one
  and you must change the other.
- `#page9ZoneAbove` — the extreme drop target. Its box shows when `:empty`, on
  `.tray-pill-hover`, or while dragging, sized by CSS vars
  `--page9-zone-stack-height` / `--page9-zone-stack-width`. Empty hint via
  `:empty::after`.
- `.page9-tray` — `position: fixed; bottom: 0`, slides up from `translateY(100%)` under
  `.engaged` over `0.85s cubic-bezier(0.22, 1, 0.36, 1)`. Holds `.page9-tray-title`
  ("סוגי פעולות") and `#page9ZoneBelow`, whose two `.page9-tray-row` grids are built in
  JS.
- Pills are built in JS: `div.page9-pill[data-idx]` > `span.page9-handle` (6 grip dots) +
  `span.page9-pill-label`. Dropped pills lose their border/background and take
  `width: var(--page9-max-pill-width)` with 1px hairline separators via `::before`/`::after`.

## Categories

`P9_CATEGORIES` is **11 pills** (index = `data-idx`): 0 הפגנה לא אלימה · 1 פוגרום ·
2 הטרדה ואיומים · 3 החזקה בכפייה · 4 תקיפה בנשק קר · 5 תקיפה בנשק חם · 6 תקיפה פיזית ·
7 הפרות סדר · 8 ניכוס שטח · 9 פגיעה ברכוש · 10 חסימת כביש.

These strings ARE the join key into the data — they must match `full_v1.xlsx`'s
`event_type` values verbatim, and all 11 of the dataset's event types are represented
one-to-one.

`P9_CATEGORY_DESC` is index-aligned and used only by the tray tooltip.
`P9_TRAY_GRID` gives each index a fixed `{row, col}` slot, applied as inline grid
placement — so a pill always returns to its own cell.

`CATEGORY_TO_IDX` maps `events.json`'s `category` to those indices. It is **derived**
from `P9_CATEGORIES` (`Object.fromEntries(P9_CATEGORIES.map((c, i) => [c, i]))`), not
hand-written, so the pill list and the lookup can't drift.

Flow: `e.category` → `CATEGORY_TO_IDX` → index into `p9.sides[]` → `"above"` (extreme)
or `"below"` (legit). `p9.sides` starts all `"below"`. An unknown category yields
`undefined` and is treated as extreme.

> Renaming a pill in `P9_CATEGORIES` must also update `FOLD6_SQUARE_LABELS` in `js/groups.js`.

## Drag mechanics

No HTML5 drag-and-drop — manual pointer events. `pointerdown` on a pill (left button
only) clones it into a `.page9-pill-ghost` on `<body>`, hides the original with
`.dragging`, sets `pointerCapture`, and registers `pointermove`/`pointerup` on `window`.
Hit-testing is `document.elementFromPoint` with the ghost temporarily `display: none`.
Legit→legit drops still commit but suppress the highlight.

`commitDrop` = `placePillInZone` then `commitDropState`, in that order — **the chip always
docks instantly even if a previous animation is still running.** Into the extreme zone the
pill is `prepend`ed (newest on top); back to the tray it returns to its `P9_TRAY_GRID`
cell. `commitDropState` is the only writer of `p9.sides[idx]`.

`p9MeasureTrayLayout()` (run at init and again on `document.fonts.ready`) sets
`p9.maxPillWidth`, per-row `gridTemplateColumns`, row heights, and the three CSS vars.

## Canvas rendering — `drawPage9`

`P9_SQ = 3`, `P9_GAP = 1`, `P9_CELL = 4`. `P9_MID = 719/982 ≈ 0.7322` is the divider's
position as a fraction of H; every grid derives its geometry from `H * P9_MID` fresh each
frame, so moving that one constant reflows both sides.

- **Extreme grid** (above the line) fills row-major upward from `midY`, right-aligned on
  the left side and left-aligned on the right. Its column count `p9.extremeColsSticky` is
  **monotonic** (`max(prev, ceil(len/rows))`) so columns never collapse back mid-session.
- **Center gap** = `p9.maxPillWidth + P9_GAP_PADDING` (190), falling back to
  `P9_EXTREME_GAP` (320) — always centered on the literal viewport middle regardless of
  side counts, so the floating dropped-category labels clear the squares.
- **Legit grid** (below the line) is column-major over two half-width halves, each with
  its own seeded shuffle (`p7Shuffle`, seeds 25555 / 22222) rebuilt only when the cell
  budget changes. `p9LegitPosOf` maps event → shuffled cell → xy; page8 imports this
  directly as its glide target.
- Dot color is `p7ActorColor(e.actor)` and is invariant per event — only position and
  alpha ever animate.
- **Count labels**: `"אירועים"` and the number are two separate `fillText` calls
  (`P9_EVENTS_GAP` 4) to dodge bidi reordering. Positions glide over `P9_COUNT_POS_MS`
  500; visibility crossfades over `P9_COUNT_LABEL_FADE_MS` 400 at the 0↔nonzero boundary.
  While a pill is hovered the labels show only that category's counts, unanimated.
- The divider grows in from the right over `P9_LINE_DURATION` 800 ms (`p9TriggerLine`,
  fired when the title row crosses viewport center; reverse covers the remaining distance
  only).
- `drawPage9` ends by assigning `p9.lastPositions` — the **actually-drawn** interpolated
  x/y/alpha per event, which is what makes an interrupting drop retarget smoothly.

## Dot migration — the two states

`p9.anim` holds `{from, start, duration, repositionMs, phase2Start, topDotArrivesAt,
newCategoryIdx, newEventStagger, staggerEvents, baseLeft, baseRight}`.
`wasInterrupting = !!p9.anim` captured **before** reassignment is what selects the state:

| | State 1 | State 2 |
|---|---|---|
| Condition | `p9.anim` was null at drop time | a previous drop was still animating |
| Reposition | `STATE1_REPOSITION_MS` 2200 | `STATE2_REPOSITION_MS` 3400 |
| Sequencing | reposition finishes, *then* new dots fly (`phase2Start = now + REPOSITION_MS`) | new dots fly immediately, concurrent with the reposition (`phase2Start = now`) |

> **State 1 is FINALIZED. Never touch it without explicit instruction.**

`REPOSITION_MS` is 0 on the very first drop, and a reposition only happens when the
column count actually grows (`neededColsNow > prevColsSticky`).

Arrival timing: `BASE_TRAVEL_MS = 600 * factor`, `ARRIVAL_STAGGER_MS = 4 * factor` per dot,
sqrt-scaled against `ANCHOR_COUNT = 1880`
(`effectiveStagger = 4 * max(1, sqrt(1880 / maxNew))`) so a small category still reads as
a cascade. `FAST_ARRIVAL_CATEGORIES = {0, 4, 6, 9}` (the four largest categories) get `FAST_ARRIVAL_FACTOR = 0.75`.
In state 2, dots still mid-flight from the interrupted animation are carried forward with
their **original** arrival times.

`p9PlaceDot` has three interpolation branches:

1. **New dot** — `t` over `arrival - phase2Start`.
2. **`plainGlide`** — page8's mid-flight handoff, deliberately unstaggered so it keeps
   page8's pace.
3. **Existing-dot reposition** — staggered *within the dot's own actor rank tier*
   (`P9_ACTOR_ORDER`), `STAGGER_FRACTION` 0.6 of the window for stagger, 0.4 for travel.

**Dropping back to legit** is much simpler: a flat `DOT_DURATION = 3000` ms plain glide
with no stagger, and a count-down animation scheduled to start after it.

Scroll-driven reset/restore (`p9ResetDrops` / `p9RestoreDrops`, driven from
`page9UpdateFromScroll` with `page9SavedAboveIdxs`) both seed a plain 3000 ms glide.

## Hover

**Dot hover** (`p9HoverInit`): bails when `currentPage !== 9` or an animation is running;
brute-force scans `p9.lastPositions` with `HIT_PAD` 3 and **skips any dot at or below
`p9.midY`** — legit dots are not hoverable. A hit highlights the matching dropped pill
(`.is-hover-highlighted`) and shows `#page9Tooltip` with the date, `descHeMedium`, and
the actor color driving the dashed SVG border.

Dimming: a dot hover drops everything else to `HOVER_DIM_OPACITY` 0.2; a pill hover drops
non-matching dots to `1 - 0.65 * hoverDimT`, ramped over `HOVER_DIM_MS` 80 with no easing
curve at all. `p9HoverDimAnimate` also calls `updateGroups()` so the fold-6 squares dim in
step.

**Tray-pill hover** (`p9CategoryTooltipInit`) is scoped to `#page9ZoneBelow` only, shows
`P9_CATEGORY_DESC` in `#page9CatTooltip` 10px above the pill, and previews the drop box by
adding `tray-pill-hover` to `#page9ZoneAbove`. Suppressed while dragging. Dot hover wins
over pill hover.

## Removed — don't reintroduce

The vertical dashed guide-line system (`.page9-divider-line`/`-top`/`-bottom`,
`.page9-divider-highlight`, `p9SyncBottomDivider`/`p9SyncExtremeGap`/
`p9SyncTopDividerHighlight`) was deleted — neither Figma frame shows it. The drop
affordance is `#page9ZoneAbove` itself.
