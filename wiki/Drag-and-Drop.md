# Drag-and-drop categorization — `@fold11` (`#page-10`, `page9.js`)

"איפה עובר הגבול בעיניכם?" — the reader drags category pills into an "extreme" zone and
the matching event dots migrate above the divider line.

> **Two desktop layouts.** The section below describes the *legacy* desktop layout
> (bottom tray, tall legit shuffle). The layout actually shipping on desktop today is
> **[Desktop layout V2](#desktop-layout-v2)** — `P9_LAYOUT_V2 = true`. Mobile is
> unaffected by the switch in either direction.

## Layout

`<section class="text-section page9-panel" data-page="10" id="page-10">`, `min-height: 200vh`
= 100vh scrolling title row + 100vh sticky panel.

- `.page9-title-row` — the normal scrolling title card plus `.page9-header-subtitle`
  — whose text is set from JS (`p9SyncSubtitle`, re-run on resize), because the gesture it
  names differs by breakpoint: `P9_SUBTITLE_DESKTOP` "גררו סוגי פעולות הנחשבות
  קיצוניות בעיניכם" / `P9_SUBTITLE_MOBILE` "בחרו סוגי פעולות הנחשבות קיצוניות בעיניכם". The desktop
  string is also `project.html`'s literal markup; JS overwrites it.
- `.page9-sticky` — `position: sticky; top: 0; height: 100vh`. Gains `.engaged` once the
  title card sticks, `.dragging` during a pointer drag, and `.frozen`
  (`position: fixed`) at the outro fold.
- `.page9-zone-wrap-extreme` — `position: fixed`, centered, `top: 14vh; bottom: 28.78vh`,
  bottom-anchored flex column. **That `28.78vh` is hand-synced to `P9_MID`** — change one
  and you must change the other. **Legacy layout only** — V2 overrides both offsets with
  values derived from measured CSS vars, precisely to avoid a second hand-synced copy.
  Desktop only: on mobile the divider's y is derived, not a
  vh fraction (see [Mobile](#mobile)).
- `#page9ZoneAbove` — the extreme drop target (`display: none` on mobile — nothing is
  dragged there). Its box shows when `:empty`, on
  `.tray-pill-hover`, or while dragging, sized by CSS vars
  `--page9-zone-stack-height` / `--page9-zone-stack-width`. Empty hint via
  `:empty::after`.
- `.page9-tray` — `position: fixed; bottom: 0`, slides up from `translateY(100%)` under
  `.engaged` over `0.85s cubic-bezier(0.22, 1, 0.36, 1)`. Holds `.page9-tray-title`
  ("סוגי פעולות") and `#page9ZoneBelow`, whose two `.page9-tray-row` grids are built in
  JS. On mobile it is instead a **band at `top: 108px`**, under the title card and above the
  docked tooltip frame (which has already dropped clear of it back at @fold10's title crossing,
  `p9TooltipDropTrigger`), sliding in from *above*, with `.page9-tray-title` hidden and a rule on
  its bottom edge only; the two wrappers are `display: contents` and
  `#page9ZoneBelow` is one `nowrap`, horizontally-scrolling flex row of all 10 pills, one pill
  tall — see [Folds](Folds.md#fold10s-tray-on-mobile). The flex row follows the **desktop
  reading order**, not `data-idx` DOM order: each pill carries an inline `order` set from
  `P9_TRAY_GRID_V2`'s single-row column (p9BuildPanel) — inert in both desktop grids, where
  every pill is explicitly placed.
- Pills are built in JS: `div.page9-pill[data-idx]` > `span.page9-handle` (6 grip dots) +
  `span.page9-pill-label`. Dropped pills lose their border/background and take
  `width: var(--page9-max-pill-width)` with 1px hairline separators via `::before`/`::after`.

## Categories

`P9_CATEGORIES` is **10 pills** (index = `data-idx`): 0 הפגנה לא אלימה · 1 פוגרום ·
2 החזקה בכפייה · 3 תקיפה בנשק קר · 4 תקיפה בנשק חם · 5 תקיפה פיזית ·
6 הפרות סדר · 7 ניכוס שטח · 8 פגיעה ברכוש · 9 חסימת כביש.

These strings ARE the join key into the data — they must match `full_v3.xlsx`'s
`event_type` values verbatim, and all 10 of the dataset's event types are represented
one-to-one.

> **Removed — don't reintroduce:** `הטרדה ואיומים`. It was retired on the v2→v3 dataset;
> its 104 rows were hand-reclassified (51 הפגנה לא אלימה, 43 הפרות סדר, 8 חסימת כביש,
> 1 תקיפה פיזית, 1 תקיפה בנשק חם) and the type no longer exists in `full_v3.xlsx`.
> Its tray slot (row 1, col 2) went to תקיפה בנשק חם, which puts row 1 back at 5 columns.

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

`page12.js` reads the same lookup to decide which events join @fold12's freeform
spread (`p12EnsureFreeformTargets` keeps only events whose category is `"above"`).
Its old name `CATEGORY_EN_TO_IDX` is gone — a stale reference there throws a
`ReferenceError` inside `drawPage12` and the extreme dots silently never spread.

## Drag mechanics

**Desktop only** — the `pointerdown` handler returns immediately under `isMobile()`, where
a `click` handler classifies instead (see [Mobile](#mobile)).

**Click-to-classify (desktop).** Both gestures are supported. The same `pointerdown`
handler tracks a `moved` flag: a press whose pointer never travels more than
`P9_CLICK_SLOP_PX` (4px) before release is a click, and `onUp` then calls
`commitDrop(pill, <the other zone>)` — tray pill → `#page9ZoneAbove`, docked pill → tray —
instead of the drop-target path. It is the exact commit path a drop takes, so the FINALIZED
state-1 animation runs untouched. A press that does move is a normal drag.

No HTML5 drag-and-drop — manual pointer events. `pointerdown` on a pill (left button
only) clones it into a `.page9-pill-ghost` on `<body>`, hides the original with
`.dragging`, sets `pointerCapture`, and registers `pointermove`/`pointerup` on `window`.
Hit-testing is `document.elementFromPoint` with the ghost temporarily `display: none`.
Legit→legit drops still commit but suppress the highlight.

`commitDrop` = `placePillInZone` then `commitDropState`, in that order — **the chip always
docks instantly even if a previous animation is still running.** Into the extreme zone the
pill is `prepend`ed (newest on top); back to the tray it returns to its `P9_TRAY_GRID`
cell. Desktop's V2 zone stacks bottom-up in **drop order** — first drop at the bottom,
each new pill on top. That relies on `#page9ZoneAbove .page9-pill { order: 0 !important; }`
in style.css: every pill carries an inline `order` (its tray column, for the mobile tray's
flex row), and without the override that inline value would re-sort the zone's flex column
by tray position instead of drop order. `commitDropState` is the only writer of `p9.sides[idx]`.

`p9MeasureTrayLayout()` (run at `DOMContentLoaded` and again on `document.fonts.ready`)
sets `p9.maxPillWidth`, per-row `gridTemplateColumns`, row heights, and the three CSS vars.
It is deferred rather than called inline because it now branches on `isMobile()`, which
lives in `js/core.js` — a *later* `<script>` than `page9.js`, and function declarations
don't hoist across separate classic scripts. Same reason for `p9SyncSubtitle`.

## Canvas rendering — `drawPage9`

`P9_SQ = 3`, `P9_GAP = 1`, `P9_CELL = 4`. `P9_MID = 719/982 ≈ 0.7322` is the divider's
position as a fraction of H; every grid derives its geometry from `H * P9_MID` fresh each
frame, so moving that one constant reflows both sides. Mobile substitutes different numbers
through the same three accessors — `p9Metrics()`, `p9MidY(H, W)`, `p9ExtremeTopY(H)` — and
nothing below changes shape; see [Mobile](#mobile).

- **Extreme grid** (above the line) fills row-major upward from `midY`, right-aligned on
  the left side and left-aligned on the right. Its column count `p9.extremeColsSticky` is
  **monotonic** (`max(prev, ceil(len/rows))`) so columns never collapse back mid-session.
- **Center gap** = `p9.maxPillWidth + P9_GAP_PADDING` (190), falling back to
  `P9_EXTREME_GAP` (320) — always centered on the literal viewport middle regardless of
  side counts, so the floating dropped-category labels clear the squares.
  On mobile it's `max(P9_EXTREME_GAP_M (64), needed)` where `needed` is what keeps the
  two column-centered count labels `P9_COUNT_LABEL_CLEAR_M` (12) px apart — each label's
  half-width (widest of the number / `אירועים` at 13px) minus half of that side's real
  column span. Narrow columns widen the gap; wide columns fall back to the 64px floor.
  Measured off the total per-side counts, not the hover-filtered ones, so hovering a
  pill never re-flows the grid.
- **Legit grid** (below the line) is column-major over two half-width halves, each with
  its own seeded shuffle (`p7Shuffle`, seeds 25555 / 22222) rebuilt only when the cell
  budget changes. `p9LegitPosOf` maps event → shuffled cell → xy; page8 imports this
  directly as its glide target. **Desktop only** — mobile replaces the shuffle with the
  bar pack, same function, see [Mobile](#mobile).
- Dot color is `p7ActorColor(e.actor)` and is invariant per event — only position and
  alpha ever animate.
- **Count labels**: `"אירועים"` and the number are two separate `fillText` calls
  (`P9_EVENTS_GAP` 4) to dodge bidi reordering. Positions glide over `P9_COUNT_POS_MS`
  500; visibility crossfades over `P9_COUNT_LABEL_FADE_MS` 400 at the 0↔nonzero boundary.
  While a pill is hovered the labels show only that category's counts, unanimated.
  Drawn at both breakpoints; mobile shows a **two-line centered block** — the number
  with `אירועים` under it (two single-script `fillText` runs, so no bidi problem),
  both at **13px** (desktop's side-by-side line stays 12px), line pitch
  `P9_COUNT_LINE_H_M` (15). `p9ExtremeTopY` reserves
  `P9_COUNT_LABEL_ROOM_M` (20 + `P9_COUNT_LINE_H_M` = 35) of the tooltip→grid clearance
  for the block — the grid ceiling sits one line lower than the old single-line layout,
  so the max column is 15px shorter and every gap in the stack is unchanged. The
  column-top→baseline gap is 16px on desktop, 12px on mobile (2 dot-rows tighter,
  `countsGap` in drawPage9, per explicit request). The clamp
  floors the bottom baseline at `topY - P9_COUNT_LABEL_ROOM_M + P9_COUNT_LINE_H_M` so
  the number line above it also stays inside the band at the full-column boundary.
  Labels always sit centered over their own column block — they are never nudged off
  it; on mobile the *gap* widens instead when they'd collide (see the gap bullet).
- The divider grows in from the right over `P9_LINE_DURATION` 800 ms (`p9TriggerLine`,
  fired when the title row crosses viewport center; reverse covers the remaining distance
  only).
- `drawPage9` ends by assigning `p9.lastPositions` — the **actually-drawn** interpolated
  x/y/alpha per event, which is what makes an interrupting drop retarget smoothly.
  Legit dots packed **below the viewport bottom** (the grid takes `legitRows` = however
  many rows its events need, which on V2's 150px strip exceeds what fits) are still put
  on record via `p9PlaceDot`'s `recordOnly` flag — painted nothing, but present in
  `p9.lastPositions`, so a later drop has a start point to fly them from instead of
  snapping them into their column.

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
a cascade. `FAST_ARRIVAL_CATEGORIES = {0, 3, 5, 8}` (the four largest categories) get `FAST_ARRIVAL_FACTOR = 0.75`.
In state 2, dots still mid-flight from the interrupted animation are carried forward with
their **original** arrival times.

`p9PlaceDot` has three interpolation branches:

1. **New dot** — `t` over `arrival - phase2Start`.
2. **`plainGlide`** — page8's mid-flight handoff, deliberately unstaggered so it keeps
   page8's pace. It also carries `fromSQ`, and `p9PlaceDot` lerps each dot's size from it
   to the legit size on the same eased clock — continuing page8's own shrink instead of
   dropping to the final size at the handoff.
3. **Existing-dot reposition** — staggered *within the dot's own actor rank tier*
   (`P9_ACTOR_ORDER`), `STAGGER_FRACTION` 0.6 of the window for stagger, 0.4 for travel.

**All branches lerp size, not just `plainGlide`.** `p9.lastPositions` records each dot's
drawn size (`sq`, pre-DPR-snap) alongside `x`/`y`/`alpha`, and `p9PlaceDot` lerps from
`from.sq` to the target size (`sizeOverride ?? SQ`) on the same per-dot eased clock as
position. Without it, a dropped category's dots snapped from the legit resting size
(`p9Metrics().legitSq` — 2px on ≤1600px desktop, 1px mobile) to the extreme grid's `SQ`
on the first frame, before the flight began, and mirror-image on un-drop. On big desktop
`legitSq === SQ`, so it's a no-op there — which is why the snap was only visible on the
regular-desktop tier and mobile.

**Dropping back to legit** is much simpler: a flat `DOT_DURATION = 3000` ms plain glide
with no stagger, and an 800 ms count-down animation running concurrently (started
`COUNT_DELAY` 300 ms in, so the dots visibly launch first) — not after the flight, which
left the numbers on screen ~4 s past the drop.

Scroll-driven reset/restore (`p9ResetDrops` / `p9RestoreDrops`, driven from
`page9UpdateFromScroll` with `page9SavedAboveIdxs`) both seed a plain 3000 ms glide.

**Scrolling into @fold12 does not freeze a running migration.** Every page9 animation
loop (`p9RunAnimLoop`, `p9LineRunLoop`, both count loops, the count-position animator)
paints while `p9PageVisible()` — currentPage 9 **or** 10 — because `drawPage12` renders
through `drawPage9`, so a mid-flight drop keeps flying and finishes on @fold12's canvas.
If @fold12's title block reaches the top mid-flight, `fold13Trigger`'s morph wins
regardless: `updateFold13` snapshots the live `p9.lastPositions` (mid-flight spots) as
the scatter's start, and `drawBandedCols` stops painting the clustered/flying extreme
dots the moment `fold13ExtremeMorphT > 0`, so the dots scatter from wherever they were.

## Hover

**Dot hover** (`p9HoverInit`): bails when `currentPage !== 10` or an animation is running;
brute-force scans `p9.lastPositions` with `HIT_PAD` 3 and **skips any dot at or below
`p9.midY`** — legit dots are not hoverable. A hit highlights the matching dropped pill
(`.is-hover-highlighted`) and shows `#page9Tooltip` with the date, `descHeMedium`, and
the actor color driving the dashed SVG border. That border's width is one knob,
`TOOLTIP_BORDER_W` (2, `js/core.js`): `updateTooltipDash` writes it to both the SVG
stroke and the tooltip's `--tip-border-w` (the transparent CSS border holding the
box-model space open), and derives the path inset/radius from it.

The tooltip normally opens **upward** from the dot (square anchor corner bottom-left,
bottom-right for left-side events via `.is-mirrored`). On desktop, when the upward box
would poke above the column area's fixed ceiling (`p9ExtremeTopY(H)` — the same boundary
the grid grows up to, under the drop zone / pill row), it **flips downward** instead:
`.is-flipped` hangs the box below the dot and moves the square anchor corner to the top
edge (top-left, or top-right when also mirrored), both in the CSS `border-radius` and in
`updateTooltipDash`'s SVG path. The tooltip element is shared with `p7HoverInit` and the
mobile docked frame, which always clear `.is-flipped` when they take it over.

Dimming: a dot hover drops everything else to `hoverDim(actor)` — `HOVER_DIM_OPACITY` 0.2
unless that group overrides it in `HOVER_DIM_BY_ACTOR` (`js/core.js`); a pill hover drops
non-matching dots to the same per-actor floor, only ramped: `1 - (1 - hoverDim(actor)) *
hoverDimT` over `HOVER_DIM_MS` 80 with no easing curve at all — at `hoverDimT = 1` the two
hover kinds dim identically. `p9HoverDimAnimate` also calls `updateGroups()` so the fold-6
squares dim in step (their parity branch in `js/update-groups.js` mirrors the same formula).
A fold-6 DOM square whose event's category is currently classified extreme is hidden
outright on this fold (`opacity = 0` in that same branch, `currentPage >= 10`, also while any
`p9.anim` runs) — the square only ever blends to its `p9LegitPosOf` band spot, so when its
canvas twin flies to the extreme column it otherwise stays parked on the band as one
permanently-bright dot (exempt from both the pill-hover dim and fold13's legit fade). The
canvas twin, drawn at the same pixel underneath, represents the event instead.
The dot tooltip/hover is fully suppressed mid-drag (`.dragging` on `.page9-sticky` bails
`p9HoverInit`'s `onMove`) — a pill carried across the canvas doesn't light up dots under it.
`commitDrop` is a no-op past re-docking the chip when the drop doesn't actually reclassify
(extreme pill released back in the extreme zone, tray pill back in the tray) — running
`commitDropState` there replayed the whole drop sequence for dots that weren't moving and
scrambled any animation still in flight.
A pill grabbed OUT of the extreme zone additionally **holds** the canvas half of its hover
state (dim + category-only counts) for the whole drag via `p9.holdPillHoverDim`
(`p9HoverInit`), released on pointerup by `p9.releasePillHoverDim` (not `setPillHover(null)`,
whose `hoveredCatPill` early-return no-ops when the hold bypassed it) — otherwise the dots and count labels sprang back to
their unhovered state the instant the drag started, before anything was reclassified.

**Tray-pill hover** (`p9CategoryTooltipInit`) is scoped to `#page9ZoneBelow` only, shows
`P9_CATEGORY_DESC` in `#page9CatTooltip` 10px above the pill, and previews the drop box by
adding `tray-pill-hover` to `#page9ZoneAbove`. Suppressed while dragging. Dot hover wins
over pill hover.

The `pointerover` half is **desktop-only** (`if (isMobile()) return;`). On mobile the same
`show()`/`hide()` pair is driven by a per-pill **ⓘ button** instead — see below.

## Desktop layout V2

The desktop layout in force today. The pills move to a bare band under the titles — no tray
card, just a rule beneath them — the drop zone stays **vertical, in the center gap between the
two extreme column-blocks** (as in the legacy layout), and the legit shuffle keeps its ordinary free-dot grid in a **shorter strip**, so the same
dots simply read denser. **Interaction, animation timing and the finalized state-1 drop are
unchanged** — only geometry moves.

> V2 is **not** mobile's packed `mode: "bar"` legit bar, and a dropped pill **keeps the exact
> appearance it had in the band** — dropping changes only where a pill is, never how it looks.

### The switch

`const P9_LAYOUT_V2 = true` (page9.js) and `p9IsV2() { return P9_LAYOUT_V2 && !isMobile(); }`.
Flip the constant to `false` to get the legacy desktop layout back, byte-identical — no
legacy rule was edited, only overridden.

`p9SyncLayoutV2Class()` toggles `page9-layout-v2` on `.page9-sticky`; **every V2 CSS rule is
scoped under `.page9-sticky.page9-layout-v2`**, so no V2 rule can reach mobile. Synced at
`DOMContentLoaded` (before the first measure — the class decides the tray's height, which
the measure reads back) and on every `resize`, which also re-runs `p9MeasureTrayLayout`
(exposed as `p9RemeasureTray`).

### Constants

| Constant | Value | What it sets |
|---|---|---|
| `P9_LEGIT_H_V2` | 150 | height in px of the legit-dot strip, measured up from the bottom edge |
| `P9_EXTREME_GAP_V2` | 120 | fallback center gap, used only until the drop zone's box is measured |
| `P9_ZONE_GAP_SLACK_V2` | 64 | px of clear air on each side of the drop zone inside the center gap |
| `P9_TRAY_TOP_V2` | 120 | the pill band's top, as a floor |
| `P9_TRAY_HEADER_GAP_V2` | 20 | min clear air under `.page9-header` |
| `P9_ZONE_GRID_GAP_V2` | 26 | px between the pill band and a full-height extreme column |
| `P9_TRAY_ZONE_GAP_V2` | 18 | pill band → drop zone |
| `P9_COUNT_LABEL_ROOM_V2` | 28 | count-label line above the extreme grid |

`p9TrayTopV2()` is `max(P9_TRAY_TOP_V2, header bottom + P9_TRAY_HEADER_GAP_V2)` — `--card-top`
is a `vh` fraction, so the header's own bottom outgrows the constant on a tall viewport.

### Geometry

Every V2 arm sits beside the existing mobile arm in the same four accessors; **no mobile arm
was touched**.

- `p9LegitGeometry` → **unchanged for V2**: `const bar = mobile`, so V2 falls through to the
  ordinary desktop free-dot grid hanging off the divider (`gridTopY = midY + LEGIT_LINE_PAD`,
  running to the bottom edge; the mobile spread strip halves that divider
  clearance to 1px — its finer 1px dots make the full 2px read as a blank band).
  `p9LegitBarH` stays mobile-only.
- `p9MidY` → `max(p9ExtremeTopY(H) + P9_CELL*8, H - P9_LEGIT_H_V2)`; `P9_MID` is unused in V2.
  That is the *only* legit-grid change: a shorter strip, so `visibleRows` drops and the
  shuffle packs denser in the same pitch. The divider stroke still draws at `midY`.
- `p9ExtremeTopY` → `p9TrayTopV2() + p9TrayH() + P9_TRAY_ZONE_GAP_V2 + P9_ZONE_GRID_GAP_V2 +
  P9_COUNT_LABEL_ROOM_V2` — the grid hangs off the pill band. The drop zone's height is **not**
  part of this stack: the zone sits in the columns' own center gap, not between the band and
  the grid, so a column at its maximum height clears it by construction.
- `p9ExtremeRowsFor` → uses `p9ExtremeTopY(H)` as the row budget's ceiling, not the legacy
  hardcoded `H * 0.18`, or prediction and real layout would disagree.
- Center gap → the drop zone's measured box plus slack, `p9ZoneStackWV2() +
  P9_ZONE_GAP_SLACK_V2 * 2` (`p9ZoneStackWV2()` reads `--page9-zone-stack-width` back off
  `#page9ZoneAbove`), so the two blocks part exactly wide enough for the zone between them.
  Falls back to the flat `P9_EXTREME_GAP_V2` until that box has been measured.

### Tray and drop zone

- `P9_TRAY_GRID_V2` is derived from `P9_TRAY_GRID`: all 10 pills in **row 1**, columns 1–5
  keeping row 1's hand-tuned order and 6–10 taking row 2's. **All grid reads go through
  `p9TrayGrid()`** (build loop, `p9MeasureTrayLayout`, `placePillInZone`, `p9ResetDrops`) —
  never the constant directly.
- **Regular-desktop tier (≤1600px):** `window.innerWidth <= P9_DESKTOP_REGULAR_MAX` (1600,
  `p9IsRegularDesktop()`). **TRIAL under judgment:** the tier currently keeps the single-row
  `P9_TRAY_GRID_V2` with pills shrunk to **18px** by the `@media (max-width: 1600px)` rule in
  style.css's V2 block (tray and zone pills both — the zone reserve is measured off tray
  pills). The previously-baked alternative — legacy **5/5 two-row** `P9_TRAY_GRID` at 20px,
  row gap 18px→10px — is the documented fallback inside `p9TrayGrid()` if the trial is
  rejected. The JS and CSS 1600s must stay in sync. Crossing the cutoff on resize
  re-slots live via the existing resize → `p9RemeasureTray` → `p9ApplyTrayGrid` chain.
  The tier also shrinks the **legit strip**: height `P9_LEGIT_H_V2_REGULAR` (110) instead of
  `P9_LEGIT_H_V2` (150), read everywhere through `p9LegitHV2()`, **paired** with a finer legit
  pitch via `p9Metrics()` — `P9_LEGIT_CELL_REGULAR` 3 / `P9_LEGIT_SQ_REGULAR` 2 (base: 4/3).
  The two must move together: at the base 4px pitch the ~14.5k events already need ≈150px on a
  ~1500px-wide viewport, and the shuffle never drops dots when short on room (`legitRows =
  max(visibleRows, rowsNeeded)`) — overflow rows clip invisibly below the viewport, so a
  shorter strip alone silently loses dots. Capacity goes with 1/cell², so 110px at 3px holds
  more cells than 150px at 4px. All consumers (page8's glide end-size, the fold-11 handoff,
  the shuffle pools) read the pitch through `p9Metrics().legitCell`/`.legitSq` or the geometry
  object, so the tier propagates without per-consumer changes; the shuffle pools rebuild
  automatically when the cell count changes on resize.
- **Tight tier (measured, no breakpoint):** when even the 18px single row is wider than
  the viewport, pills drop to **16px** via `.page9-pills-tight`, toggled by
  `p9MeasureTrayLayout` on `.page9-sticky` **and** on `<body>` (the drag ghost lives on
  `<body>`, outside the panel's class scope — same reason the 18px media rule lists the
  ghost separately; both 16px rules sit right after that media block in style.css).
  There is deliberately no media query: the overflow point depends on the ten Hebrew
  labels' rendered widths, so the measure pass reads `trayRows[0].offsetWidth` with
  `white-space: nowrap` forced on the rows (tray pills can wrap, so a constrained grid
  would otherwise compress to fit and never report an overflow) and compares it to
  `document.documentElement.clientWidth`. The class is always **removed before the read**,
  so the decision is made at the regular font in both directions — deciding from a 16px
  measurement on the way back up would fit again and flap. The nowrap is **held through
  the track bake** and released only after the fixed tracks are written: releasing it
  right after the tight read let viewport pressure wrap the labels during the per-pill
  offsetWidth reads, and the bake then sealed those narrow wrapped widths into the tracks
  permanently — the same too-narrow-columns trap as the stale-track clearing above, via
  viewport pressure instead of stale tracks. V2/desktop only (`p9IsV2()` gate); mobile
  keeps its own 16px rule and scrolling row. Pills never wrap in any tier; below the
  16px row's own natural width (~1300px viewport) the centered row overflows both screen
  edges instead.
- Both `.page9-tray-row` wrappers are still built in every layout; V2 just leaves row 2
  empty and `.page9-layout-v2 .page9-tray-row:empty { display: none }` hides it, so a resize
  across 600px never has to rebuild DOM. `p9ApplyTrayGrid()` (called at the top of
  `p9MeasureTrayLayout`) re-assigns each tray pill's `grid-column` and row wrapper, so a
  variant flip re-lays the tray live.
- `.page9-tray` in V2: `top: var(--p9-v2-tray-top); bottom: auto`, and it does **not**
  slide — its transform is `translate(-50%, 0)` in both states; the base rule's
  visibility/opacity gate keeps it unseen until `.engaged`. The entrance is the **pill
  pop-in** instead: each tray pill rests at `scale(0)` and pops to `scale(1)` over 280ms
  (sine in-out — the hero dots' own pop) delayed by `--p9-pop-i × 60ms`, where
  `--p9-pop-i` is set by `p9BuildPanel` from `P9_TRAY_GRID_V2[idx].col − 1` (0 = the
  rightmost pill, first in RTL reading order), so the crest travels **right → left**.
  Un-engaging mirrors the delays (leftmost shrinks first). The bottom rule is a
  `.page9-tray::after` (1px `rgba(90,90,90,0.18)`, full-bleed) scaled from
  `transform-origin: right` over `9×60+280 = 820ms` **linear**, so its leading edge keeps
  pace with the constant pill stagger. The rules are scoped to `.page9-tray .page9-pill`
  so a pill docked in `#page9ZoneAbove` is unaffected; `prefers-reduced-motion` drops both
  transitions. **No card chrome** (per explicit request): full-bleed `width: 100vw`,
  transparent background, no radius and no border other than that rule — the same
  treatment the ≤600px block gives the mobile band. `.page9-tray-title` is hidden, padding is `14px 0`, and the
  `:has(.dragover)` card tint is neutralized (there's no card to tint) — **except while
  dragging a pill OUT of the extreme zone**: `p9BuildPanel`'s pointerdown puts
  `.dragging-from-above` on `.page9-sticky` for that direction, and then the legit band is
  the destination and gets the fill ladder instead (tray `rgb(239,238,248)`, dragover
  `rgb(230,229,244)`), while the extreme zone's own drag fills are suppressed via
  `:not(.dragging-from-above)` on their selectors — plus an explicit
  `.dragging.dragging-from-above` transparent-background override (specificity-bumped to
  (1,4,0)), since the legacy base layout's `.dragging #page9ZoneAbove` fill would otherwise
  show through the gap the standing-down V2 rules leave.
- `.page9-zone-wrap-extreme` in V2: `top: calc(var(--p9-v2-tray-top) + var(--page9-tray-height)
  + 18px); bottom: calc(var(--p9-v2-legit-h) + 24px); justify-content: center` — the band it
  lives in runs from under the pill row down to 24px above the legit strip (the clearance keeps
  the dashed box from touching the strip on regular-height viewports), and the zone centers in
  it so it sits level with the columns it divides. The zone box also carries `max-height: 100%`,
  so when the full ten-pill reserve is taller than the band, it clamps to the band instead of
  poking past both ends. `--p9-v2-legit-h` is published by
  `p9MeasureTrayLayout` from `P9_LEGIT_H_V2`, never hand-synced. `#page9ZoneAbove`'s
  `margin-bottom: 20px` (axis-label clearance in the legacy layout) goes to 0.
- **When the clamped box is shorter than its stack, the zone scrolls** — `overflow-y: auto`
  on the V2 zone rule, active only in that circumstance (a short viewport where
  `max-height: 100%` cuts the box under the ten-pill reserve; while everything fits, `auto`
  renders and changes nothing). The bottom anchoring can't ride on `justify-content:
  flex-end` for this — a flex container only scrolls toward its end edge, so flex-end
  overflow pokes past the top unreachable. V2 therefore overrides to `flex-start` and
  bottom-anchors with `margin-top: auto` on `.page9-pill:first-child` instead: identical
  resting layout (the auto margin soaks up the spare height), collapsing to 0 the moment
  the stack overflows, leaving a normally scrollable column. The `.page9-pill` in that
  selector keeps auto margins off the `:empty` hint `::after` (absolutely centered, and the
  only "child" then). `placePillInZone` sets `zone.scrollTop = 0` on every zone drop, so
  the just-landed (prepended, topmost) pill is on screen — a no-op when nothing scrolls.
- `#page9ZoneAbove` in V2 is a **vertical** stack, inheriting the base rule's
  `flex-direction: column` / `min-width` (`justify-content` is overridden — see the scroll
  bullet above); V2 also changes
  `gap: 8px` (real gaps, not the legacy flush 0), `padding: 18px 16px` (tuned by eye — the
  measured reserve width and the canvas center gap both follow it) and `min-width: 0` (the base
  260px floor would otherwise override a narrower measured width). In its **very first state**
  only — `:empty`, showing the "גררו…" hint — the sides open to `26px`, so the hint line isn't
  near the dashed edge, **and the box itself grows by 32px on each axis**
  (`calc(var(--page9-zone-stack-*) + 32px)`), snapping back to the exact reserve on the first
  drop; safe against the canvas because the center gap derives from the un-padded reserve var
  and extreme columns only exist once the zone is no longer `:empty` (the base rule's
  `max-height: 100%` still clamps the taller empty box inside the band).
  `.tray-pill-hover` is excluded so the inset can't jump on hover (the class co-exists with
  `:empty` before any drop, so hovering doesn't shrink the enlarged empty box either). Its dropped pills override the whole legacy dropped-chip treatment back to the base
  `.page9-pill` look — border, 4px radius, white fill, shadow, natural width — and the
  `::before`/`::after` seam hairlines are `display: none` (they exist only to join a flush
  vertical stack).
- **The V2 zone's dashed stroke and its box are both unconditional** — `border-color`,
  `border-radius`, `height: var(--page9-zone-stack-height)` and `width:
  var(--page9-zone-stack-width)` all sit on the base V2 rule, not only under `:empty` /
  `.tray-pill-hover` / `.dragging` as in the legacy layout. Otherwise the zone shrink-wraps
  to its contents on the first drop and the outline collapses onto the pills; V2 keeps one
  stable frame that pills fill up inside. Safe because the reserve is sized for all ten
  regardless (see the bullet below) and `p9ExtremeTopY` budgets for it either way.
  The state rules only deepen the stroke (0.08 always-on → 0.18 empty/pill-hover → 0.22 dragging), never
  clear it. **Fill escalates in three small steps** of opaque near-white walking toward the
  panel's lilac, each darker than the last, so a pill actually held over the zone reads as the
  darkest state: empty/pill-hover `rgb(245,245,251)` → dragging `rgb(239,238,248)` → dragover
  `rgb(230,229,244)`. The fourth state — **pills in it, nothing hovered — carries no fill at
  all** (transparent): the dashed stroke is enough on its own, and a resting fill competed with
  the dropped pills sitting inside it. Both drag fills carry
  `:not(.dragging-from-above)` — see the tray bullet above. The dragover rule needs all of
  `.page9-sticky.page9-layout-v2.dragging:not(.dragging-from-above) #page9ZoneAbove.dragover`
  to out-specify the base layout's own dragover rule, which sits later in the file. Hovering
  a dropped pill lifts it with the tray's own hover shadow (`0 2px 8px rgba(0,0,0,0.15)`).
- **V2's ordinary dots snap to whole device pixels too.** `p9PlaceDot`'s no-`sizeOverride`
  branch rounds `x`/`y`/size to `1/devicePixelRatio` when `isMobile() || p9IsV2()`. Mobile's
  reason is the loupe (below); V2's is fractional DPR — on a 1.25x/1.5x scaled monitor a 3px
  square at a fractional CSS position spreads over 4–5 device pixels at partial alpha and the
  dots read soft, while the same page on a 1x/2x screen looks sharp. The legacy desktop
  layout is deliberately left unsnapped.
- All three — fill, stroke and the
  `::after` hint colour — **switch instantly**: the V2 base rule sets `transition: none`,
  overriding the shared `.page9-zone`'s `transition: background 0.15s` so the fill can't lag a
  frame behind the border. `#page9ZoneBelow` and the legacy layout keep the transition.
- `p9MeasureTrayLayout`'s reserve sizing is the **same in V2 as in the legacy layout** — ten
  pills deep by the longest one wide, read against `#page9ZoneAbove`'s own computed gap and
  padding, so the reserved box never resizes mid-drag. (V2 pills keep their natural widths
  visually; the reserve still uses `maxPillWidth`, which is the widest of them.)
- `p9MeasureTrayLayout` **releases the tray rows' fixed grid tracks before measuring**:
  the tracks it writes are baked px widths from the previous run, and a resize that grows
  the pill font (crossing 1600px upward, 18px→20px, or 600px, 16px→20px) leaves labels wider
  than their old track — they'd wrap and `offsetWidth` would re-bake the clamped wrapped
  width. Clearing first restores natural one-line widths for the reads; the tracks are
  re-applied from the fresh numbers at the end.
- `p9MeasureTrayLayout` writes `--p9-v2-tray-top` and `--page9-tray-height` onto
  `.page9-sticky`, so those two CSS offsets are **derived from JS, not hand-synced** to it.

### Handoffs

- **page8's bridge glide** lerps its end dot size to `legitGeom.cell` whenever
  `legitGeom.mode === "bar"` (was hardcoded `P9_SQ`), so dots land on the bar at exactly the
  size `drawPage9` keeps drawing them — no 1px pop. That's a **mobile-only** path today
  (V2 isn't a bar); V2 lands at `P9_SQ` like the legacy desktop layout, and needed nothing
  either way since page8 targets via `p9LegitGeometry`/`p9LegitPosOf`.
- **`updateFold13`'s tray slide-out** (js/fold11.js) exits **upward** whenever the tray is a
  top band — `isMobile() || p9IsV2()` — using `p9TrayTopV2()` as the offset in V2 (mobile
  keeps its 112).

## Mobile

Under the 600px breakpoint the fold keeps **one** render path — `drawPage9`, `p9LegitPosOf`,
the drop animation (including the FINALIZED state 1), page8's bridge glide and page12's
spread are all unchanged. Only *where* the two grids sit is swapped, through three
accessors:

**Text selection is suppressed across the whole tray.** `.page9-sticky` (and `.page9-pill`
again, for its own hit area) carry `-webkit-touch-callout: none` +
`-webkit-user-select`/`user-select: none`. The **`-webkit-` prefixes are the load-bearing
half** — iOS WebKit ignores the unprefixed property alone, so a press-and-hold on a pill
used to raise selection handles and the Copy bar *over* the drag. Nothing in the tray is
reading material; the title card lives in `.text-col`, outside it, and stays selectable.
This is the same suppression the graphic column carries for @fold9's loupe.

- `p9Metrics()` → `{ SQ: 1, CELL: 2, legitCell: 1.5, legitSq: 1 }` with the spread flag on
  (bar mode: `legitCell`/`legitSq` both `LEGIT_CELL_M` 1; desktop `{3, 4, LEGIT_CELL, 3}`).
  `legitSq` is the legit grid's own dot size — `drawJumbledBot` passes it through
  `p9PlaceDot`'s `sizeOverride`, and page8's glide lands its dots on it.
- `p9ExtremeTopY(H)` → `p9DockTopM() + P9_TOOLTIP_COLLAPSED_H (100) + P9_TOOLTIP_GRID_GAP_M (20) + P9_COUNT_LABEL_ROOM_M (35)`,
  trailing the docked tooltip frame in its dropped-for-@fold11 spot. The frame's expanded
  state overlays this grid rather than moving it (hence the *collapsed* height) — see
  [Timeline](Timeline.md).
- `p9DockTopM()` → `P9_TRAY_TOP_M (104) + p9TrayH() + P9_TRAY_TOOLTIP_GAP_M (20)` — where the
  frame comes to rest below the pill band. (Matches `P9_TOOLTIP_GRID_GAP_M` (20) — one rhythm; change them together.) The extreme grid follows the frame since it derives from this. The tray height is read with `offsetHeight`, which
  is transform-independent, so this is right even while the band is still off-screen.
- `p9MidY(H, W)` → `H - P9_LEGIT_H_M` (54) with `P9_LEGIT_SPREAD_M` on (the current state —
  see the callout under "The legit bar"), or `H - p9LegitBarH(W)` in bar mode — either way
  flush with the viewport's bottom edge, floored so the extreme grid always keeps 8 cells of
  height.

### The pill ⓘ button

Every pill is built with a `<button class="page9-pill-info">` after its label (`p9BuildPanel`),
`display: none` on desktop and an 18px circle under the breakpoint — with an invisible
`::before` hit extender (`inset: -4px`, ~26px touchable) so a near-miss opens the tooltip
instead of classifying the pill; hit-testing on a pseudo-element targets the button itself,
so every `closest(".page9-pill-info")` guard covers it unchanged — so crossing the breakpoint
on a resize needs no rebuild. It replaces the hover as the only way to reach
`P9_CATEGORY_DESC` on touch, opening the very same `#page9CatTooltip` through
`p9CategoryTooltipInit`'s `show()`.

**The button gives no feedback of its own** — the tooltip is the feedback. `all: unset` covers
its resting UA styling but not its tap-time behaviour, so two more things are cancelled
explicitly: `-webkit-tap-highlight-color: transparent` (the flash mobile browsers paint over a
tapped `<button>`) and a `:focus`/`:focus-visible`/`:active` rule pinning `outline: none`,
`background: none` and the resting `opacity: 0.75` (a tap leaves a `<button>` focused, so the
ring would otherwise persist after the finger lifts).

The listener is on `#page9ZoneBelow` in the **capture** phase and calls `stopPropagation()`:
the button sits *inside* the pill whose own bubble-phase `click` toggles `.is-extreme`, so a
bubbling listener would classify first and inform second. Tapping ⓘ must never classify.
State is one `openInfoPill` reference, and **only one frame is ever on screen**: while it is
set, *any* ⓘ tap closes — the same button or another pill's. The tooltip never hops from pill
to pill, so "tap to open, tap to close" holds anywhere in the run. A bubble-phase `document`
click dismisses it on any outside tap too (another pill's classify tap still goes through;
only the tooltip closes), and so does a **`scroll` on `#page9ZoneBelow`**: the popover is
positioned once from the pill's rect and then lives in viewport coordinates, so scrolling the
run horizontally would slide the pill out from under a frame that stayed put. It closes
instead of tracking. The tray's `pointerleave` → `hide()` is **desktop-only**: a touch
pointer is destroyed at `pointerup`, so `pointerleave` fires *before* the `click` and used to
null `openInfoPill` a beat before the click handler read it — every second tap re-opened
instead of closing. On touch there is no "left the tray" to detect anyway. `show()` also adds `tray-pill-hover` to
`#page9ZoneAbove`, which is inert here — that zone is `display: none` on mobile.

**It paints above everything, on both breakpoints** — `z-index: 1006`, clearing the docked
event tooltip (1000), the cards bumped over it (1001) and the open מקרא panel (1002). The
number only bites because `#page9CatTooltip` is a direct `.layout` child rather than
nested in `.graphic-col`, whose stacking context would trap it. Being
`pointer-events: none`, sitting on top costs the card underneath nothing. The desktop
ladder otherwise inverts (explicit instruction: title blocks over every tooltip) — the
`min-width: 601px` block at the end of style.css raises all title cards to 1004 and the
dragged pill's ghost (`.page9-pill-ghost`) to 1005, so the event hover tooltip paints under
them. **This category tooltip is the one exception**, by a later explicit instruction: it
must stay on top of everything, because in V2 it hangs down over the drop zone.

The popover sits above its pill only on the legacy desktop layout, and only when there's
room. It hangs below **unconditionally on mobile and in desktop V2**
(`p9IsV2() || isMobile() || above < 8`) — both bands sit high, but not always so high that
the fits-above test fails on its own; on mobile a one-line description used to pass it and
angle up over the title while taller ones angled down (explicit instruction: all angle
down).
`.is-below` moves its arrow from the box's bottom edge to its top so it still points at the
pill.

### The legit bar

> **Currently switched OFF — `P9_LEGIT_SPREAD_M = true` (page9.js).** Under review per
> explicit request, the mobile legit half is a **desktop-style spread strip** instead of
> this bar: the same free, individually-shuffled dot grid the desktop V2 strip uses,
> at its own finer pitch (`legitCell` = `P9_LEGIT_CELL_SPREAD_M` 1.5, dots
> `P9_LEGIT_SQ_SPREAD_M` 1 — exposed as `p9Metrics().legitCell`/`.legitSq`),
> hanging off the divider into a `P9_LEGIT_H_M` (54px) bottom strip. Every bar-mode
> consumer keys off the geometry's `mode === "bar"`, so flipping the flag back to `false`
> restores everything below verbatim (including page8's landed rect handoff).

Figma node 290-409: two ~7px bars, one per camp, meeting at the viewport centre and running
to the edges along the bottom. `p9LegitGeometry` returns a second shape for it —
`mode: "bar"` — and `p9LegitPosOf` branches on that; everything downstream (page8's glide,
the fold9 square lerp, fold11's outro) keeps calling the same two functions.

- **Height is fixed, not derived:** `LEGIT_BAR_ROWS_M` 4 rows × `LEGIT_CELL_M` 1px = 4px, so
  `p9LegitBarH()` is a constant (it still takes `W`, ignored, so callers needn't branch).
  It sits flush with the viewport's bottom edge — `gridTopY` is `H - p9LegitBarH(W)`, with no
  tray term, the tray being a top band on mobile — and needs no CSS var; nothing in
  `style.css` reads the bar height.
- **Real dots, oversubscribed.** Each half holds `cols × 4` ≈ 790 cells against 5,325 /
  9,126 events, so several events share a cell and overdraw. That overdraw is what makes the
  bar read as solid, and it lets the height be a design choice rather than a consequence of
  the dataset size.
- **Bar dots draw at the pitch, not at `P9_SQ_M`.** `p9PlaceDot` takes a `sizeOverride`
  (last param) and `drawJumbledBot` passes `legitGeom.cell` (1px) in bar mode. `P9_SQ_M`'s
  1.5 is sized for the extreme grid's 2px pitch; in the bar it made every dot bleed ¼px into
  the columns either side, which reads as a ragged colour boundary and as stray dots of one
  group sitting inside the next. At the pitch the segments are solid with exact seams.
- **…and snapped to whole device pixels.** With `sizeOverride` set, `p9PlaceDot` rounds the
  drawn `x`/`y`/size to `1/devicePixelRatio` before `fillRect`. The canvas is DPR-scaled
  (`js/core.js`) and `midX` is `W/2` — a half pixel on any odd-width phone — so a 1px cell
  otherwise landed on fractional device coordinates and antialiased into its neighbours;
  at a group boundary that blend *is* the ragged seam. Snapped, consecutive columns tile
  exactly. The snap is applied **after** `posMap.set`, so recorded positions (and therefore
  the next animation's `from`) stay unquantized.
- **At rest the bar isn't dots at all — it's one solid rect per segment.** Even with the
  pitch + snap above, ~14k individually painted 1px dots all have to tile perfectly for a
  colour boundary to read as one vertical line, and residual per-dot artifacts kept the
  seams ragged. So when `p9.anim` is null (`barAtRest` in `drawPage9`), `drawJumbledBot`
  passes `p9PlaceDot` a `recordOnly` flag — the full interpolation/`posMap` bookkeeping
  runs (the next drop's `p9.anim.from` and the picker's nearest-dot scan both need every
  position on record) but nothing is painted — and a separate pass, `p9DrawBarRects`
  (page9.js), draws each `colSegs[side]` entry as **one `fillRect`** (colour from the
  `actor` the segment carries, added in `p9SyncLegitRank`), both x edges snapped to whole
  device pixels, full bar height. Hard vertical seams by construction. Per-dot painting
  only ever runs while `p9.anim` is live, where motion masks it; `p9RunAnimLoop` nulls
  `p9.anim` on completion and redraws, so the handoff back to rects is automatic and lands
  on the dots' exact footprint. `drawPage8` calls the same `p9DrawBarRects` once its glide
  lands (`ease >= 1` in bar mode) — it keeps painting until `@fold11`'s `drawPage9` takes
  over, and its landed per-dot frame would otherwise show the ragged seams again — so the
  @fold10→@fold11 handoff is pixel-identical.
- **Shared cells resolve by rank, not by date.** `drawJumbledBot` iterates
  `p9.legitRank[side].keys()` in bar mode instead of the chronological pool array. Whichever
  event draws last owns a shared cell; in pool order that winner was effectively random with
  respect to group, sprinkling one colour into its neighbour along every seam.
- **Groups are contiguous.** `p9SyncLegitRank` sorts each camp's still-legit events by
  *group segment* (the camp's legend order — a sort of `fold6.y`, the same rule the legend's
  own `legendRow` uses), then `P9_CATEGORIES` index, then event index. So each of the three
  groups per camp is one colour block, and each category a run inside it. Both bars fill
  **outward from the centre line**, so reading away from midX the left bar is
  blue → green → pink (i.e. right-to-left on screen) and the right bar orange → magenta →
  grey. `p9LegitCellXY` numbers the left half's columns from the *screen edge*, so bar mode
  mirrors the left column index; without that the left bar reads backwards and retreats from
  the centre instead of the edge. The actor→`fold6.y`
  map is built **lazily** (`p9BarActorRankOf`) — `GROUPS` lives in `js/groups.js`, a later
  `<script>` than `page9.js`.
- **Each group owns a whole number of columns.** `p9SyncLegitRank` records, per side, both a
  per-event `{r, s}` (rank + segment index) and a `p9.legitSegs[side]` array of
  `{g, r0, rn}` (group rank, rank span). `p9LegitGeometry`'s bar branch turns those spans
  into `colSegs[side]` = `{c0, c1}` column ranges by rounding the cumulative rank scale to
  whole columns, so group *i* ends on exactly the column group *i+1* starts on and every
  colour change is a straight vertical line. A group with any events gets at least one
  column. Previously the boundary fell wherever a continuous `rank → cell` map put it,
  leaving the boundary column half one colour and half the next.
- **The bar shrinks from its outer end.** Those column edges are rounded against `N0`, the
  camp's **original** legit count, not its current one. An untouched camp therefore fills its
  whole half; as events go extreme the surviving segments compress against the same width and
  the outer end retreats. Within a group's block, `local = floor((r − r0) × cols × rows / rn)`
  fills column-major and skips no cell, so holes can't open inside the bar.
- **The reflow animates for free.** Those surviving dots are already in `p9.anim.from`
  (a copy of `p9.lastPositions`, which `p9PlaceDot` fills for legit dots too), so they glide
  through `p9PlaceDot`'s "existing dot repositioning" branch; with no `orderIndex` passed it
  degrades to an unstaggered glide. **No change to the FINALIZED state 1 was needed.**
- The rank cache is keyed on `p9.sides.join(",")` — rebuilt on a tap, not on a resize
  (rank is resize-independent) and not per frame. The seeded shuffles are never built on
  mobile; `p9LegitGeometry` returns before them.

The extreme grid's fill logic is untouched — `p9ExtremeRowsFor` yields ~220 rows at a 2px
pitch, so `ceil(len/rows)` stays small and each camp's block fills to full height before
widening. That's the tall thin bar the mobile frame shows, for free. (`p9ExtremeRowsFor`
still uses a tighter `0.18` ceiling than `drawPage9`'s `SBB.top` on desktop — a deliberately
conservative row *budget*, not a bug.)

**Tap to classify.** A `click` handler on each pill (registered before the desktop
`pointerdown`, which bails on mobile) toggles `.is-extreme` — filled black, in place — and
calls `commitDropState(pill, goingExtreme ? zoneAbove : zoneBelow)`. `commitDropState` stays
the only writer of `p9.sides[idx]` on both paths, so the animation machinery can't tell the
two apart. The pill never moves; `#page9ZoneAbove` and the handle are `display: none` — the
latter written as `.page9-pill .page9-handle`, matching the base rule's two-class selector,
since a media query adds no specificity and a bare `.page9-handle` loses the cascade.

Because the dropped set is no longer recorded by DOM parentage, **`p9DroppedIdxs()`** is the
single reader: `#page9ZoneAbove`'s children on desktop, `.page9-pill.is-extreme` in the tray
on mobile. `p9ResetDrops` / `p9RestoreDrops` / `js/page8-9-scroll.js`'s scroll-out reset all
go through it — querying `#page9ZoneAbove` directly would silently no-op on mobile.

The **divider stroke draws on mobile too** (same right-to-left grow-in via
`p9TriggerLine`/`page9LineT`), sitting at `p9MidY` on the top edge of the legit strip.
`p9HoverInit` is off; the touch equivalent is the
same press-and-hold loupe as `@fold9`, generalized from fold-8-only via `p7InspectPage()`
(pages 7 **and** 9) and `p7InspectSource()` (which positions/half-size/`maxY` to read).
`drawPage9` therefore ends with `p7InspectSync?.()`, and `keepEmptyFrame` in
`js/update-groups.js` is `currentPage <= 10` so the docked empty tooltip frame carries through
the bridge fold into `@fold11`.

## Removed — don't reintroduce

The vertical dashed guide-line system (`.page9-divider-line`/`-top`/`-bottom`,
`.page9-divider-highlight`, `p9SyncBottomDivider`/`p9SyncExtremeGap`/
`p9SyncTopDividerHighlight`) was deleted — neither Figma frame shows it. The drop
affordance is `#page9ZoneAbove` itself.

**Both breakpoints: the tray is `visibility: hidden` until `.engaged`.** Its hidden resting
state is a percentage of its OWN height (`translate(-50%, 100%)` on desktop,
`translate(-50%, calc(-100% - 112px))` on mobile), and on a refresh that height isn't final
yet: `p9MeasureTrayLayout` writes the rows' pixel height at `DOMContentLoaded` and **again**
at `document.fonts.ready` (Assistant loads `display: swap`). Until then the box is too short
for 100% to clear the edge, so the pill rows peek past it — and when the corrected height
re-resolves the translate, the 0.85s `transform` transition *animates* that difference, so
the tray visibly slides away while @fold1 is still on screen. `.page9-tray` therefore carries
`visibility: hidden` with a `visibility 0s linear 0.85s` delay (so it outlasts the
slide-out — `updateFold13` never removes `.engaged`), and `.page9-sticky.engaged .page9-tray`
flips it visible with no delay. The ≤600px block re-declares both halves for the band. Don't
drop the delay — the tray would vanish instantly mid-slide-out.

**The tray also ships at `opacity: 0`, lifted by `.is-measured`.** The `visibility` guard
above is necessary but was observed *not sufficient* on mobile: on a phone refresh the tray,
`#page9ZoneBelow` and the pills all painted over @fold1 and dropped out one at a time as each
measurement landed. So `.page9-tray` carries a second, independent gate — `opacity: 0` in the
base rule, `.page9-tray.is-measured { opacity: 1 }` — and `p9RevealTray` (page9.js) adds that
class one `requestAnimationFrame` after the `document.fonts.ready` measure pass, i.e. once the
corrected height has actually been committed. Opacity specifically, **not** `display: none`:
`p9MeasureTrayLayout` reads `offsetWidth`/`offsetHeight` off the pills, which `display: none`
would zero out. If `document.fonts` is missing the reveal falls back to `window load`, so the
tray can never be stranded invisible. `.is-measured` is deliberately separate from `.engaged`
— it only asserts "the hidden transform now really hides"; whether the tray is on screen stays
`.engaged`'s job. Nothing writes an inline opacity on the tray (`updateFold13` fades the
header, title card, zone wrap and legend, never this), so nothing competes with it.
