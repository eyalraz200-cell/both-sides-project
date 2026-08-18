# The real timeline — `@fold8` (`#page-7`, `page7.js`)

The pinned, scroll-scrubbed section that renders all 14,451 events as per-event squares
with a canvas year axis along the bottom.

## Data and state

`initPage7()` fetches `events.json`, sorts by `date` (lexicographic on `YYYY-MM-DD` =
chronological), and splits by `e.side` into `p7.leftEvents` / `p7.rightEvents`.
Committed dataset: **14,451 events — 5,325 left, 9,126 right**, spanning
`p7.minDate` **2023-01-01** → `p7.maxDate` **2026-07-03**. A fetch error is swallowed to
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

### One cursor per month

Each month owns a single number — a **cascade cursor** `c`, in ms, from 0 (month
entirely absent) to `P7_ANIM_TOTAL_DURATION` (every square settled). State lives in
`p7MonthPhase[k] = {fromC, toC, start}`, read through `p7MonthCursor(k)` and steered by
`p7MonthAim(k, toC)` / `p7MonthSettle(k, c)`. `undefined` means the month was never
reached (or was fully retreated and cleaned up) — distinct from a cursor of 0.

A square's presence is a **pure function of the cursor**:
`p7Ease(clamp((c - delay) / P7_POP_DURATION))`, `delay = (localIdx/(count-1)) * stagger`.
So there is no forward path and no reverse path — the cursor rising plays the month in,
the cursor falling plays it out, and mirrored order (last in, first out) falls out for
free because the last squares are the ones with the largest `delay`.

Phases run at a constant 1 ms of cursor per 1 ms of clock, exactly like page8's
`p8CurrentT`, so **reversing mid-flight covers only the remaining distance** and every
square continues from precisely the presence it had. This is what makes the
scroll-up-then-down-again cases work: a half-generated month retreats from half-grown,
never showing squares that hadn't appeared, and turning around mid-vanish resumes from
where it was. **Don't reintroduce separate forward/reverse start timestamps** — two
independent clocks can't express "half-grown, now shrinking", so every interrupted
direction change snapped the month to full (or empty) for a frame.

Orchestration lives in `p7DrawTimelineSquares`:

- **Forward into new territory** (`curMonthKey > p7MonthMaxReached`): every *skipped*
  month with no phase yet is aimed at full from cursor 0, so a fast scroll doesn't make
  months pop in instantly.
- **Landing on a month while scrolling backward**: `p7MonthSettle(k, TOTAL)` — it appears
  already settled rather than firing a fresh entrance.
- **Retreat**: months above the current one are aimed at 0. Fully-retreated months
  (cursor 0) are popped by decrementing `p7MonthMaxReached`.
- **Scrolling back down**: *every* month at or below the centered one is re-aimed at
  full, not just `curMonthKey` — one scroll tick can re-enter several at once.
  `p7MonthAim` is a no-op when the target is unchanged, so this runs safely per frame.
- When disengaged, the centered month is aimed at 0 too, so it retreats like the rest
  instead of sitting until the draw-range clamp cuts it away.

`p7ResetForReplay()` wipes `p7MonthPhase` and `p7MonthMaxReached`. It runs **when the
retreat has finished**, not on a fold crossing: `drawFold7`/`drawFold9` (`js/core.js`)
call it alongside clearing `p7RealTimelineReached`, once `!p7HasEngaged &&
!p7AnyAnimActive()`. `setActivePage` only calls it as a backstop when leaving for a fold
that never draws the squares at all (`currentPage >= 5 && page < 5`).

**Don't wipe on the `7 → 6` crossing.** Those two draw functions deliberately keep
drawing and retreating the squares across that boundary, so resetting there made every
dot vanish in a single frame the instant the IntersectionObserver crossed the midline.

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
- **Headline events** — `P7_AXIS_EVENTS`, 7 entries in chronological order
  (הצגת הרפורמה המשפטית 2023-01-04, מתקפת 7 באוקטובר 2023-10-07,
  פסיקת בג״ץ על גיוס חרדים 2024-06-25, נפילת משטר אסד 2024-12-08,
  מבצע ״עם כלביא״ 2025-06-13, שחרור החטופים מעזה 2025-10-13,
  התפזרות הכנסת ה-25 2026-07-17)
  — render as **filled dots at their true date x**, plus an optional
  per-event **`xOffset`** (screen px, − = left; via `p7AxisEventTrueX`) that nudges dot
  *and* label together purely to clear a year ring — `date` stays truthful and still
  drives every trigger, the printed date, and the crossfade order. Three use one:
  the first (`-14`, to clear the "2023" anchor), נפילת משטר אסד (`+12`, breathing room from
  its neighbours) and the last (`+26`, see below).
- **Events past `maxDate`** — an event dated after the dataset's last event (only
  התפזרות הכנסת ה-25 2026-07-17, vs `maxDate` 2026-07-03) is **clamped at both ends**:
  `p7AxisEventTrueX` clamps its x into `[P7_AXIS_MARGIN, W - P7_AXIS_MARGIN]` so it parks
  at the axis's left end instead of floating past it, and `p7UpdateAxisEventTriggers(W)`
  switches that event's reached-test from dates to **x**: reached once the growing fill
  edge has caught up to its DRAWN position (`p7AxisX(currentDate, W) <= p7AxisEventTrueX`
  — time runs right → left, so `<=`). A date clamp alone does not work: it fires only on
  the single frame where `currentDate === maxDate`, so the label never actually shows.
  Consequence: changing such an event's `xOffset` also changes *when* it appears. Its
  printed date stays the real one.
- Each event carries a crossfading label +
  date above. Labels fade in over 400 ms, hold, and are capped by the *next* event's own
  fade (1000 ms).
- **Label collisions** — resolved newest-first with `OVERLAP_PAD = 8`, sliding older
  blocks sideways (never to a second vertical tier). Three things make that work:
  the collision extent is the whole **title + date block** (`max` of every wrapped
  title line and the date's own width, measured in `P7_AXIS_DATE_FONT`), a shifted
  block is **re-clamped** to `[0, W]` so it can't be pushed off-canvas, and each event
  carries an optional **`maxWidth`** (px) at which its title wraps via `p7WrapLabel`.
  Wrapped lines stack **upward** at `P7_AXIS_EVENT_LINE_HEIGHT` 19 — the last line keeps
  the single-line baseline, so the date never moves. `maxWidth: null` = one line.
  Every line and the date are drawn `textAlign: "center"` on the block centre `lineX`.
  Widths are hand-tuned per event; harness recipe in [Dev-Workflow](Dev-Workflow.md).
- **Hovering a regular timeline square reveals the whole roster** — while
  `hoverActive` (`p7.hoveredEvent` set, i.e. a per-event square is hovered, NOT an axis
  dot), every **already-reached** headline event's **label** is forced visible, so the
  axis reads as a reference key for placing that square among the headlines so far. **Every
  dot shrinks to `P7_AXIS_MARKER_RADIUS_FADED`** for the duration — including the
  most-recently-passed event, whose dot is normally full size — so all the circles read
  small and equal and the revealed labels are the only thing the roster adds; the axis
  never pops or competes with the square being hovered. Both the label reveal and the dot
  shrink ride one shared eased amount, `p7AxisRosterT` (module-level, lerped toward
  `hoverActive ? 1 : 0` at `P7_AXIS_HOVER_ANIM_SPEED` once per frame at the top of
  `p7DrawAxisEvents`, snapping under 0.001) — `prominence` is scaled by `(1 - p7AxisRosterT)`
  and the roster opacity is `p7AxisRosterT` itself, so it animates in and back out rather
  than snapping. `p7AxisEventsAnimActive` checks that ease separately from the per-event
  `hoverT`s, since it moves when nothing on the axis is hovered. Events the scrub has not passed yet stay hidden — the roster
  never spoils what is ahead. "Reached" reuses the trigger state (`triggeredAt` set and
  `leavingAt` null), so scrolling back un-reveals in step. They render at the faint state3
  alpha like the rest of the dimmed axis; an event whose date matches the hovered square
  stays full-strength. Ending the hover returns each to its own crossfade state.
- **The dot persists** after its label fades, shrinking from radius 4 to
  `P7_AXIS_MARKER_RADIUS_FADED` 2. **Hovering it re-shows the label** (`updateAxisHover`,
  `AXIS_HIT_PAD` 6) — an independent hover target from the squares.
- **The dot's presence itself animates**, both ways. Whether the fill edge has passed an
  event is a boolean (`x >= curX`), but it drives a per-event eased `reachedT`
  (`P7_AXIS_EVENT_STATE[i].reachedT`, lerped at `P7_AXIS_HOVER_ANIM_SPEED` like `hoverT`)
  that multiplies `markerRadius`, so a dot grows out of the axis on the way down and
  shrinks back into it on the way **up** instead of vanishing in one frame mid-label-fade.
  Below `reachedT` 0.001 the event stops drawing and stops registering in
  `p7.axisEventPositions` (so it is not hit-testable). `p7AxisEventsAnimActive` checks
  `reachedT` separately — a shrinking dot outlives its label's fade. The background wipe
  that punches the line out from under the dot uses `markerRadius + reachedT`, not the full
  radius (and not a flat `+1` pad, which left a 2px hole closing in one frame), so **the line behind heals continuously as the dot shrinks** rather than
  snapping closed the frame the dot disappears.
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
`alpha * hoverDim(actor)` (`js/core.js`) — the shared `HOVER_DIM_OPACITY` 0.2 unless that
group has its own entry in `HOVER_DIM_BY_ACTOR`, keyed by the **dimmed** dot's actor, not
the hovered one's. Three do: `settlers` and `right wing protesters` at 0.15,
`protesters against government` at 0.11 — the loud colors, pushed further back so the
whole grid reads as one even dim. `HOVER_DIM_MS` 80 is page9-only. Every
hover change also calls `updateGroups()` so the 8 fold-6 DOM squares dim in step.

## Handoff to page8/page9

`page8.js` is the bridge and imports page9's geometry as the source of truth
(`p9EnsureIndex`, `p9LegitGeometry`, `p9LegitPosOf`). `p8CurrentT()` runs at constant
speed over `P8_TRANSITION_DURATION` 3000 ms, so a mid-flight reversal covers only the
remaining distance. `drawPage8` at `t <= 0` delegates to `drawPage7` with `currentDate`
temporarily forced to `maxDate`; above that it lerps each dot from its timeline cell to
its page9 legit-grid target and lerps the square size 3.5 → 3 over the same ease (no
opacity fade). `p8CaptureBlendedPositions(W, H, tOverride)` feeds both `p9.anim` (forward) and
`p7EntryAnim` (backward) in `setActivePage`.

**The handoff replays the glide's own global clock — it does not restart one.** Both
call sites capture the glide's *endpoint* positions (`tOverride` 0 forward, 1 backward)
and back-date `start` by the elapsed fraction, so the continuation's
`p9Ease(elapsed / P8_TRANSITION_DURATION)` reproduces `p9Ease(p8CurrentT())` exactly
(verified to float precision at every handoff point). Do not "simplify" this back to
capturing the current blended position with the remaining duration: that eases an
already-eased slice — the standard mistake this project's easing rule names — so the
dots came to a **dead stop** at the handoff (sine-in-out starts at rest) and the path
deviated up to ~15% of total travel. Since the `IntersectionObserver` firing the handoff
crosses at a scroll-dependent moment, the visible symptom was the @fold9→@fold10 glide
stuttering and landing inconsistently *only when the user kept scrolling through it*.

## Known stale comments

None currently — `p7UpdateAxisEventTriggers`' comment block was corrected to the real
`minDate` `2023-01-01` / first axis event `2023-01-04`.
