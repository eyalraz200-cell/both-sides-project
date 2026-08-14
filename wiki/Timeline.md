# The real timeline — `@fold8` (`#page-7`, `page7.js`)

The pinned, scroll-scrubbed section that renders all 13,523 events as per-event squares
with a canvas year axis along the bottom.

## Data and state

`initPage7()` fetches `events.json`, sorts by `date` (lexicographic on `YYYY-MM-DD` =
chronological), and splits by `e.side` into `p7.leftEvents` / `p7.rightEvents`.
Committed dataset: **13,523 events — 4,872 left, 8,651 right**, spanning
`p7.minDate` **2023-01-01** → `p7.maxDate` **2026-05-29**. A fetch error is swallowed to
`console.error` and `p7.ready` stays false (every draw path early-returns to just the
background).

Key `p7` fields: `ready`, `leftEvents`/`rightEvents`, `currentDate`, `minDate`/`maxDate`,
`leftPos`/`rightPos` (event index → grid cell), `cols`, `CELL`, `SQ`,
`lastPositions` (`Map<event, {x,y,alpha}>`, rebuilt every frame — settled positions, not
mid-animation blends), `hoveredEvent`, `axisEventPositions`, `hoveredAxisEvent`.

## The square grid

Geometry comes from `SBB_TIMELINE` in `squareboundingbox.js`
(`left 0.18, top 0.13, bottom 0.81`) plus `CENTER_GAP = 8`.
`SBB` itself belongs to page9, **not** here. The right camp's origin is mirrored
(`W/2 + CENTER_GAP/2`) at each call site — there is no `right` field.

`P7_SQ = 3.5`, `P7_GAP = 1.5`, `P7_CELL = 5`. (page9 uses `P9_SQ 3 / P9_GAP 1` —
deliberately different; page8 lerps between them.)

`p7UpdateLayout(W, H)` early-returns unless the viewport changed, then recomputes
`rows`, `cols`, and both `leftPos`/`rightPos` orderings. A "cell" is an integer index:
`col = cell % cols`, `row = floor(cell / cols)`.

`p7OrderFromCenter(total, cols, seed, side, maxEvents)` builds the fill order with a
seeded Park–Miller RNG (seeds 11111 left, 99999 right): distance from the center gap,
jittered by up to `P7_ORDER_JUMBLE_COLS = 14` columns, then sliced to
`min(total, maxEvents)` — so the fill grows outward from the center and permanently-empty
gaps remain at the edges.

### `p7TargetCellCache`

`Map` keyed `actor + "|" + occurrence` → `{side, cell}`, used by
`p7TargetForActorOccurrence` to tell @fold7's flying squares where to land.
**It is cleared in exactly one place** — `p7UpdateLayout`, whenever `leftPos`/`rightPos`
are recomputed. Cell numbers are meaningless across a differently-sized grid, so a
missing clear here is what made those squares land outside the grid on other viewports.

## The month-by-month cascade

`p7DrawSideSquares` animates one month's worth of squares at a time:
`stagger = P7_ANIM_TOTAL_DURATION - P7_POP_DURATION` (2200 − 220 = 1980 ms) spread across
the month's events, each popping over `P7_POP_DURATION` with `p7Ease`
(`scale = 0.5 + 0.5*presence`, `alpha = presence`).

Orchestration lives in `p7DrawTimelineSquares`:

- **Forward into new territory** (`curMonthKey > p7MonthMaxReached`): backfills
  `p7MonthAnimStart` for every *skipped* month to `now`, so a fast scroll doesn't make
  months pop in instantly.
- **Landing on a month while scrolling backward**: `p7MonthAnimStart[k] = now - 2200`, so
  it appears already settled.
- **Retreat**: months above the current one get `p7MonthReverseStart[k] = now`; the
  cascade mirrors its order on reverse (`orderIdx = count-1-localIdx`) rather than
  restarting cold. Fully-retreated months are popped by decrementing
  `p7MonthMaxReached`.
- When disengaged, `drawCurMonthKey = -1` makes *every* month compare as reverse.

`p7ResetForReplay()` wipes both timing maps; called from `setActivePage` on `7 → <7`.

The rAF loop `p7StartAnimLoop()` runs while `p7AnyAnimActive()` — month timers, axis event
fades, the intro wipe, the axis fill lag, or `p7EntryAnim`. It redraws only while
`currentPage` is 5–8.

## Scroll scrub

`#page-7` is `min-height: 780vh`. `page7UpdateFromScroll()` measures from @fold7's title
card:

```
gap        = section.top - titleTop
scrubRange = section.height - innerHeight + gap
t          = clamp(-titleTop / scrubRange, 0, 1)
p7.currentDate = minDate + round(p7ScrubEaseIn(t) * totalDays) days
```

`t = 0` is the instant @fold7's title clears the top; `t = 1` is the section's bottom
hitting the viewport bottom. `p7ScrubEaseIn` smoothsteps the first
`P7_SCRUB_EASE_IN_SPAN = 0.15` and rejoins linear at the seam.

**Engagement** — `p7HasEngaged` is recomputed every call, with hysteresis, not latched:

```js
p7HasEngaged = p7HasEngaged ? top <= P7_ENGAGE_HYSTERESIS_PX   // 24
                            : top <= 0;   // top = #page-6 .text-card's top
```

While `!p7HasEngaged`, `currentDate` is hard-pinned to `minDate`.
`p7RealTimelineReached` is a separate flag that lets the retreat keep running on folds
6/7 after `currentPage` has already dropped below 7.

## The year axis

Canvas-drawn along the bottom (`p7DrawYearAxis`), called from `drawPage7` and
`drawFold9`. **Time runs right → left**: `p7.minDate` at `W - P7_AXIS_MARGIN`,
`p7.maxDate` at `P7_AXIS_MARGIN` (`P7_AXIS_MARGIN = 120`, widened from 48 to shorten the
axis so the first event's label can center over its own circle).

- **The line** is a single solid rule at `P7_AXIS_Y_FRAC = 0.90` of H: a faint full-span
  bar (`P7_AXIS_BG_ALPHA` 0.22) with a black "reached" bar drawn from `curX` rightward.
  `curX` follows a damped lag (`P7_AXIS_FILL_LAG_DAMPING` 0.12) that self-restarts the
  anim loop and snaps within 0.0005.
- **Year ticks** are hollow ring markers (background disc punched out at
  `P7_AXIS_MARKER_RADIUS` 4, then a stroked circle) — first tick is `minDate` itself,
  then each `YYYY-01-01`. Labels sit **below** the line
  (`P7_AXIS_YEAR_LABEL_OFFSET` 12), faint until reached. Reachedness for rings uses the
  **raw** `currentDate` x, not the lagged `curX`.
- **Headline events** — `P7_AXIS_EVENTS`, 6 entries (הצגת הרפורמה המשפטית 2023-01-11,
  אישור ביטול עילת הסבירות 2023-07-01, מתקפת 7 באוקטובר 2023-10-07, פסיקת בג"ץ על גיוס
  חרדים 2024-06-01, מבצע עם כלביא 2025-06-01, הסכם הפסקת אש ושחרור חטופים בעזה
  2025-10-01) — render as **filled dots at their true date x** with a crossfading label +
  date above. Labels fade in over 400 ms, hold, and are capped by the *next* event's own
  fade (1000 ms); label collisions are resolved newest-first with `OVERLAP_PAD = 8`.
- **The dot persists** after its label fades, shrinking from radius 4 to
  `P7_AXIS_MARKER_RADIUS_FADED` 2. **Hovering it re-shows the label** (`updateAxisHover`,
  `AXIS_HIT_PAD` 6) — an independent hover target from the squares.
- **Intro wipe** — `P7_AXIS_INTRO_DURATION` 2800 ms, a right-to-left `ctx.clip()` reveal
  covering line, rings, labels and events alike. Gated by `p7AxisShouldShow()` =
  `fold9FlyTrigger.currentRaw() > 0`, falling back to `p7HasEngaged`. Scrolling back above
  the trigger nulls `p7AxisIntroStart`, so the wipe replays.

There is no dot-snapping anymore (`p7AxisEventX` caches each event's true date position), and the old
dashed-line helpers were removed when the line went solid. **The design reference is the
user's flat-line screenshot** — smooth line, rings above the years, filled current-edge
dot.

## Hover

`p7HoverInit()` runs at module load. `doHitTest()` bails unless `currentPage === 7`, runs
`updateAxisHover` first, then brute-force scans `p7.lastPositions` with
`half = P7_SQ/2 = 1.75` and `HIT_PAD = 3` (a 9.5 px box), nearest-by-distance wins.

The tooltip is `#page9Tooltip`, **shared with page9 and @fold6's demo** — which is why
`hideSquare()` (clears only the square tooltip, guarded on `p7.hoveredEvent` being set)
is separate from `hide()` (clears both targets). `tooltipEl.style.color` is set to the
actor color and the dashed SVG border strokes `currentColor`; `.is-mirrored` flips the
box for `side === "left"`.

**Page7's hover dim is a snap**, not a timed fade: non-hovered squares draw at
`alpha * HOVER_DIM_OPACITY` (0.2, `js/core.js`). `HOVER_DIM_MS` 80 is page9-only. Every
hover change also calls `updateGroups()` so the 8 fold-6 DOM squares dim in step.

## Handoff to page8/page9

`page8.js` is the bridge and imports page9's geometry as the source of truth
(`p9EnsureIndex`, `p9LegitGeometry`, `p9LegitPosOf`). `p8CurrentT()` runs at constant
speed over `P8_TRANSITION_DURATION` 3000 ms, so a mid-flight reversal covers only the
remaining distance. `drawPage8` at `t <= 0` delegates to `drawPage7` with `currentDate`
temporarily forced to `maxDate`; above that it lerps each dot from its timeline cell to
its page9 legit-grid target and lerps the square size 3.5 → 3 over the same ease (no
opacity fade). `p8CaptureBlendedPositions()` feeds both `p9.anim` (forward) and
`p7EntryAnim` (backward) in `setActivePage`.

## Known stale comments

`page7.js` ~1026 claims `minDate` is `2023-01-10` and the first axis event `2023-01-01`.
Both are wrong — the real values are `2023-01-01` and `2023-01-11`.
