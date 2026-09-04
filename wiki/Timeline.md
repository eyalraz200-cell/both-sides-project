# The real timeline — `@fold9` (`#page-8`, `page7.js`)

The pinned, scroll-scrubbed section that renders all 14,451 events as per-event squares.
**Desktop:** the canvas year axis runs **vertically down the centre** between the two camps
and every dot's row is its date (see "The vertical axis" below). **Mobile:** the axis is
horizontal along the bottom and the fill order is the free `p7OrderFromCenter` jumble.

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
(`left 0.18, top 0.13, bottom 0.81`) plus the centre gap: `p7CenterGap()` is
`P7_AXIS_CORRIDOR_PX = 64` on desktop (the vertical axis's corridor — line, rings and
18px year labels) and `CENTER_GAP = 4` on mobile. `SBB` itself belongs to page9, **not**
here. The right camp's origin is mirrored (`W/2 + gap/2`) inside `p7GridGeometry` — there
is no `right` field.

`P7_SQ = 3.5`, `P7_GAP = 1.5`, `P7_CELL = 5` are the *ceiling*: on desktop the square is
**solved per viewport** like mobile (`p7SolveVerticalSq` → `p7DesktopSq`, read through
`p7Sq()`/`p7Cell()`, gap ratio kept at 1.5/3.5) — the largest square whose grid still holds
the busier camp once each day's events must sit in that day's rows (6% slack for the jitter
spill; band mode gives whole rows to the headlines, widen mode gives the corridor more
width, so both solve smaller than the ceiling). (page9 uses `P9_SQ 3 / P9_GAP 1` —
deliberately different; page8 lerps between them.)

`p7UpdateLayout(W, H)` early-returns unless the viewport (or the desktop/mobile branch)
changed, then recomputes `rows`, `cols`, and both `leftPos`/`rightPos` orderings. A "cell" is
an integer index: `col = cell % cols`, `row = floor(cell / cols)` — the contract every
reader (`p7DrawSideSquares`, `p7TargetForActorOccurrence`, page8's glide/capture) relies
on, unchanged by the vertical layout.

**Mobile fill order:** `p7OrderFromCenter(total, cols, seed, side, maxEvents)` builds it with
a seeded Park–Miller RNG (seeds 11111 left, 99999 right): distance from the center gap,
jittered by up to `P7_ORDER_JUMBLE_COLS = 14` columns, then sliced to
`min(total, maxEvents)` — so the fill grows outward from the center and permanently-empty
gaps remain at the edges.

### The vertical layout (desktop) — `p7BuildVerticalLayout(rows, cols, CELL)` → `p7.vert`

Rows are dates. Events are bucketed per **day** (`dayOf`, 1279 days for the current data);
each day gets `need[d] = max(rowsAvail / nDays, max(countL, countR) / cap)` fractional rows
(`cap = floor(cols × fillRatio)`), normalised so days (+ bands) exactly fill `rows`. So the
axis is linear in time except where a day has more events than one row holds (Oct 7 and its
week), which stretches taller. `rowStart[d]`/`rowsOf[d]` are the cumulative map;
`p7RowOfDate` (middle of the day's rows — ticks, hover marker, widen-mode dots),
`p7RowEndOfDate` (bottom — the fill edge, `p7CurRow()` for `currentDate`), `p7RowY(row, H)`
and `p7AxisY(dateStr, H)` read it. A date past `maxDate` clamps to the end.

Placement per side (same seeds): `row = round(rowStart + rng × rowsOf ± rowJitter)`, then the
first free cell walking **outward from the corridor** (`k` → `col = right ? k : cols−1−k`);
each cell is rolled a permanent gap with probability `1 − fillRatio` on first visit; a full
row spills to row±1, ±2… That keeps the old jumble — ragged outer edges, holes — while the
inner edge hugs the axis. Deterministic, so a resize/relayout reproduces itself.

The tunables live in `P7_VERT` (`page7.js`): `corridorPx` (band), `eventMode`, `eventLine`,
`bandPx` 60, `wideCorridorPx` 220, `fillRatio` 0.86, `rowJitter` 1.5. Changing
one needs a relayout (`p7.lastW = 0; draw()`), which also clears `p7TargetCellCache`.

**Headline placement is under comparison** (`_debug-axis.js`, review item A1/A2 — the
losing mode is deleted once picked):
- `eventMode: "band"` — `ceil(bandPx / CELL)` empty rows are reserved just *before* the
  event's day (the past-the-end event's band goes after the last day); the dot sits 1.5 rows
  into the band (`events[i].row`) and the headline + date hang under it, centred on the axis.
  `reachRow` = the band's top.
- `eventMode: "widen"` — no rows reserved and no per-event bump: the centre corridor is
  simply wider over its whole height (`p7CenterGap()` returns `wideCorridorPx` instead of
  `corridorPx`) so every headline block fits inside it beside the axis. Dot at the middle
  of the day's rows (past-the-end: `totalRows − 3`); `reachRow` = the dot's row.
- `eventLine` (A2) — a 1px `rgba(90,90,90,0.18)` rule from `leftX0` to `W − leftX0` at each
  event's dot row, drawn in `p7DrawTimelineSquares` *under* the dots. Persistent like the
  event's dot (`reachedT`, × the intro wipe), not tied to the label's crossfade.

### `p7TargetCellCache`

`Map` keyed `actor + "|" + occurrence` → `{side, cell}`, used by
`p7TargetForActorOccurrence` to tell @fold8's flying squares where to land.
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
that never draws the squares at all (`currentPage >= 6 && page < 6`).

**Don't wipe on the `7 → 6` crossing.** Those two draw functions deliberately keep
drawing and retreating the squares across that boundary, so resetting there made every
dot vanish in a single frame the instant the IntersectionObserver crossed the midline.

The rAF loop `p7StartAnimLoop()` runs while `p7AnyAnimActive()` — month timers, axis event
fades, the intro wipe, the axis fill lag, or `p7EntryAnim`. It redraws only while
`currentPage` is 5–8.

## Scroll scrub

`#page-8` is `min-height: 780vh`. `page7UpdateFromScroll()` measures from @fold8's title
card:

```
gap        = section.top - titleTop
scrubRange = section.height - innerHeight + gap
t          = clamp(-titleTop / scrubRange, 0, 1)
p7.currentDate = minDate + round(p7ScrubEaseIn(t) * totalDays) days
```

`t = 0` is the instant @fold8's title clears the top; `t = 1` is the section's bottom
hitting the viewport bottom. `p7ScrubEaseIn` smoothsteps the first
`P7_SCRUB_EASE_IN_SPAN = 0.15` and rejoins linear at the seam.

**Engagement** — `p7HasEngaged` is recomputed every call, with hysteresis, not latched:

```js
p7HasEngaged = p7HasEngaged ? top <= P7_ENGAGE_HYSTERESIS_PX   // 24
                            : top <= 0;   // top = #page-7 .text-card's top
```

While `!p7HasEngaged`, `currentDate` is hard-pinned to `minDate`.
`p7RealTimelineReached` is a separate flag that lets the retreat keep running on folds
6/7 after `currentPage` has already dropped below 7.

## The year axis

Canvas-drawn (`p7DrawYearAxis`), called from `drawPage7` and `drawFold9`. On desktop
`p7DrawYearAxis` dispatches straight to **`p7DrawYearAxisVertical`** (see "The vertical
axis" below); everything in this section describes the **mobile / horizontal** axis.
**Time runs right → left**: `p7.minDate` at `W - P7_AXIS_MARGIN`,
`p7.maxDate` at `P7_AXIS_MARGIN` (`P7_AXIS_MARGIN = 120`, widened from 48 to shorten the
axis so the first event's label can center over its own circle).

- **The line** is a single solid rule at `p7AxisYFrac()` of H — `P7_AXIS_Y_FRAC` 0.90
  desktop, `P7_AXIS_Y_FRAC_MOBILE` **0.94** (lower on a phone, where the grid above stops
  at `SBB_TIMELINE_MOBILE.bottom` 0.78 and the year label under it is only 14px): a faint full-span
  bar (`P7_AXIS_BG_ALPHA` 0.22; during hover-elsewhere it drops to
  `P7_AXIS_UNFILLED_HOVER_ALPHA` 0.14) with a black "reached" bar drawn from `curX` rightward.
  `curX` follows a damped lag (`P7_AXIS_FILL_LAG_DAMPING` 0.12) that self-restarts the
  anim loop and snaps within 0.0005.
- **Year ticks** are hollow ring markers (background disc punched out at
  `P7_AXIS_MARKER_RADIUS` 4, then a stroked circle) — first tick is `minDate` itself,
  then each `YYYY-01-01`. Labels sit **below** the line
  (`p7AxisYearLabelOffset()` — `P7_AXIS_YEAR_LABEL_OFFSET` 12 desktop,
  `P7_AXIS_YEAR_LABEL_OFFSET_MOBILE` **5**, so the year reads as attached to its own tick),
  faint until reached. Reachedness for rings uses the
  **raw** `currentDate` x, not the lagged `curX`.
- **Headline events** — `P7_AXIS_EVENTS`, 7 entries in chronological order
  (הצגת הרפורמה המשפטית 2023-01-04, מתקפת 7 באוקטובר 2023-10-07,
  פסיקת בג״ץ על גיוס חרדים 2024-06-25, נפילת משטר אסד 2024-12-08,
  מבצע ״עם כלביא״ 2025-06-13, שחרור החטופים מעזה 2025-10-13,
  התפזרות הכנסת ה-25 2026-07-17)
  — render as **filled dots at their true date x**, plus an optional
  per-event **`xOffset`** (screen px, − = left; via `p7AxisEventTrueX`) that nudges dot
  *and* label together purely to clear a year ring — `date` stays truthful for the
  printed date and the crossfade order, but the label's reached-test requires **both**
  the date AND the fill edge catching up to the DRAWN (xOffset-nudged) x, so a
  leftward-nudged event's label appears together with its circle rather than at its
  raw date (only binds on − nudges; + nudges still fire on the date). Three use one:
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
  `hoverT`s, since it moves when nothing on the axis is hovered — and because that ease
  steps once per FRAME, `p7HoverInit` calls `p7StartAnimLoop()` on every hover change
  (square gained and `hideSquare()` both), or a lone `draw()` would freeze the roster
  mid-fade at whatever alpha hovering had pumped it to. Events the scrub has not passed yet stay hidden — the roster
  never spoils what is ahead. "Reached" reuses the trigger state (`triggeredAt` set and
  `leavingAt` null), so scrolling back un-reveals in step. They render at their own
  `P7_AXIS_ROSTER_LABEL_ALPHA` (0.34) — a notch above the axis chrome's `P7_AXIS_BG_ALPHA`
  (0.22), so the roster stays readable as a key; the axis line's FILLED span dims to the
  same 0.34 (instead of vanishing into the faint background line), so the fill progress
  stays readable under the hover. An event whose date matches the hovered square
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
  the trigger plays the same wipe in reverse, quickly (`P7_AXIS_OUTRO_DURATION` 500 ms
  full-scale; an interrupted intro reverses over only its remaining distance —
  `p7AxisOutroStart`/`p7AxisOutroFromT`), then the axis is gone and the build-in replays
  from scratch on the next forward crossing. Re-crossing forward mid-reverse resumes the
  build-in from wherever the reverse wipe currently is — no snap in either direction.
  The same reverse wipe (`p7AxisReverseOut()`) also fires the moment @fold10's bridge glide
  starts: drawPage8's `t > 0` branch keeps drawing the axis itself (currentDate forced to
  maxDate) until the reverse wipe reaches 0, so the axis undraws right-to-left rather than
  vanishing with the timeline frame.

There is no dot-snapping anymore (`p7AxisEventX` caches each event's true date position), and the old
dashed-line helpers were removed when the line went solid. **The design reference is the
user's flat-line screenshot** — smooth line, rings above the years, filled current-edge
dot.

## The vertical axis (desktop) — `p7DrawYearAxisVertical`, `p7DrawAxisEventsVertical`

The same colours, radii, fonts, fill lag, hover states (state 1/2/3) and headline fade
logic as the horizontal axis, laid out **top → bottom at `x = W/2`** from the grid's `topY`
over `totalRows × CELL`:
- **Fill:** `p7AxisFillFracTarget()` is `p7CurRow() / totalRows` (the bottom of
  `currentDate`'s rows, so the dark span always covers that day's own dots), through the
  same `p7AxisUpdateFillLag` damping. Reached test for a tick: `p7RowOfDate(tick) ≤ p7CurRow()`.
- **Build-in wipe:** the intro clips to `rect(0, 0, W, topY + p7Ease(introT) × len)` — the
  axis (and its headlines) reveal downward; the reverse wipe undraws upward.
- **Year labels** sit directly under their ring, centred on the line (18px, `P7_VERT_YEAR_LABEL_GAP`
  6), on a punched `#FDFCFF` rect so the line doesn't run through the digits.
- **Headlines:** dot on the line at `p7RowY(events[i].row)`; "reached" = its y ≤ the fill
  edge. `p7UpdateAxisEventTriggers` uses one rule for all seven on desktop:
  `p7CurRow() ≥ events[i].reachRow`. Title lines (`p7WrapLabel`, `maxWidth` 320 in band
  mode, `p7CenterGap() − 16` in widen mode) and the date hang under the dot
  (`P7_VERT_EVENT_TEXT_GAP` 6), centred on the axis, on a punched background drawn at the
  label's opacity. **No de-collision** — the layout reserves the space.
- **Hover:** the hovered square's date marks the axis at `p7AxisY(date, H)` in its actor
  colour; `p7.axisEventPositions` is filled with `{x: axisX, y, radius}` so the existing
  circle hit-test works unchanged.

## Hover

`p7HoverInit()` runs at module load. `doHitTest()` bails unless `currentPage === 8` — and
also bails while @fold10's bridge glide is mid-flight in either direction (`p8PhaseStart`
non-null, page8.js): scrolling back up from @fold10 lands `currentPage` on 7 while the dots
are still flying back to their timeline spots, and a hover mid-flight latched a tooltip
onto a moving target. Otherwise it runs
`updateAxisHover` first, then brute-force scans `p7.lastPositions` with
`half = P7_SQ/2 = 1.75` and `HIT_PAD = 3` (a 9.5 px box), nearest-by-distance wins.

The tooltip is `#page9Tooltip`, **shared with page9 and @fold7's demo** — which is why
`hideSquare()` (clears only the square tooltip, guarded on `p7.hoveredEvent` being set)
is separate from `hide()` (clears both targets). `tooltipEl.style.color` is set to the
actor color and the dashed SVG border strokes `currentColor`; `.is-mirrored` flips the
box for `side === "left"` — except outside the two horizontal flip lines, which keep the
box off the mini-legends: a dot left of `P7_TIP_FLIP_L` (**475 px from the left edge**)
always opens rightward (`mirrored = false`), a dot within `P7_TIP_FLIP_R_INSET`
(**475 px from the right edge**) always opens leftward (`mirrored = true`); only between
them does the data-side rule decide. Both hand-tuned by eye at a 1900px-wide viewport,
exact px, not vw — but each is anchored to the edge its legend hangs off, so both lines
track a window resize (the right line reads `window.innerWidth - P7_TIP_FLIP_R_INSET`
live per hit-test). Below 950px window width the two bands overlap and the right rule
wins (it runs last); moot in practice since mobile docks the tooltip. The box opens upward by default; a dot above the
`P7_TIP_FLIP_Y` line (**295 viewport px** from the top — hand-tuned by eye, exact px, not
vh) toggles `.is-flipped` and opens downward from the dot instead
(`dotClientY + P7_SQ + TOOLTIP_GAP`), the same flip mechanism as @fold11's hover, whose
corner logic `updateTooltipDash` (js/core.js) already handles.

**On mobile the tooltip is docked, not anchored.** `tooltipDockMobile(el)`
(`js/fold8-tooltip.js`) adds `.page9-tooltip.is-docked` below the 600px breakpoint and
returns `true`, and every caller — `fold8PositionTooltip`, `fold8AdvanceSequence` and
page7's own hover placement — then skips its anchor math. The frame has two spots and glides between them: at @fold7 it sits just above the block
of 8 sample squares (measured off their rects by `tooltipDockTopPx` — but **frozen**
(`tooltipFold6TopFrozen`) the instant the fly starts, since those squares are themselves
flying to their real dots on the same trigger and a live measurement would make the frame
chase them; re-measured whenever the fly is fully reversed to t ≤ 0), and it
**animates up** to its final spot on `fold9FlyTrigger` — the same crossing that brings the
real timeline in and flies those squares out to their real dots — reversing back down on a
scroll up. Stacking: the docked frame is `z-index: 1000`, and @fold7's **and** @fold8's
title cards — plus @fold10's (`#page-9`), which scrolls up over the still-docked frame while
the timeline is pinned behind it — out-stack it
(`#page-6`/`#page-7`/`#page-9 > .section-text.text-card` plus @fold11's
`.page9-title-row .text-card`, all `{ z-index: 1001 }`, style.css mobile
block), so every title block that shares the screen with the frame paints OVER it —
@fold11's card scrolls up through the frame's dropped spot (`p9DockTopM()`) on its way to
pinning at the top, so without it the frame's white fill swallowed the title mid-pass.
The frame itself stays fully visible throughout that pass — the title simply paints over
it (a transit-hide that faded the frame out for the overlap was tried and reverted per
explicit instruction: nothing disappears). The frame keeps its white fill in every state,
including the empty hint state (making the empty frame's fill transparent was tried and
reverted per explicit instruction). @fold9
itself has no card to stack: `#page-8` is an empty scrub spacer. The final spot is above the timeline grid (`top: 62px`, centered, `width: min(300px, 100vw - 48px)`
— 300px was chosen by eye after measurement: ~76% of descriptions fit the 3 clamped lines (measured at 14px; type since bumped to 15px) (320px bought 82%, the 342px title-block width 87.5%, but both read too wide) — **fixed** `height: 100px`, with the overflow clipped on `.page9-tooltip-desc` — **never on
the frame**, whose dashed `<svg>` is inset `-2px` on every side and would be clipped clean
away, leaving the tooltip with no stroke; see "Long descriptions" below): Its SIZE never changes and its horizontal
placement never changes — only the text inside, plus the one scripted glide above. Consequences:
no `.is-mirrored` pointer corner (`updateTooltipDash` rounds all four when `.is-docked`),
and no pointer-corner origin for the grow — when `.is-docked`, `transform-origin` is
`bottom center` (set alongside desktop's `bottom right` in `js/update-groups.js`), so the
frame grows straight up from its bottom edge. It DOES still play the entrance pop, per
explicit instruction: `transform` is `translateX(-50%) scale(g)` with `g` =
`fold8TooltipGrowEase(growT)`, the same curve desktop uses — the centering translate first
so the scale happens about the already-centered box (a scale ahead of it would scale the
-50% offset and slide the frame sideways as it grew). Opacity rides the same `g`. That
scale is the ENTRANCE only and, unlike desktop, is **not** multiplied by the shrink: the
`fold9TooltipShrinkTrigger` beat is applied to the TEXT ONLY: when the square lands on its
real dot the docked frame does not leave, it stays put **empty**, ready for the next
selection. As it animates up to the timeline spot its stroke also fades from the demo
event's actor color back to the neutral resting gray (`FOLD8_TOOLTIP_REST_COLOR` #858585 —
the frame's own constant, a touch lighter than the squares' `FOLD6_SQUARE_REST_COLOR`
#767676 since a stroke reads heavier than a fill: `colorT * (1 - fold9FlyT)` into
`lerpFold6SquareColor` with the tooltip constant as its `base`, gated on `keepEmptyFrame`
so desktop is untouched). `updateGroups`' `keepEmptyFrame` (mobile and `currentPage <= 10`) is what holds
it there past the shrink; the bound is `<= 9` rather than page 7 alone so the frame carries
through the bridge (@fold10) into @fold11, which has its own picker, without blinking off in
between. Reversing
the whole fold back to elapsed 0 still fades the frame itself out, through `growT`. Page7's
own docked branch in `doHitTest` is still dead code — hover is disabled on mobile (below)
and the touch path goes through the picker instead — but it exists so the timeline can't
disagree with @fold7/@fold8 about where the frame is.

**Long descriptions — clamp, then open on demand.** `descHeMedium` runs 39–308 characters
(median 101, p90 164) and there is no shorter variant in the data, so the frame cannot hold
every event. Tooltip text is **14px on desktop, 15px on mobile** — the base
`.page9-tooltip-date`/`-desc` rules carry 14px (picked by eye against 12/13/15; 12px was the
original), and a ≤600px override raises those plus `.p7-inspect-hint` to 15px. The desktop box
is **275px wide** (`.page9-tooltip`), sized so @fold7's demo description (row-34, 109 chars)
lands on exactly 3 lines at 14px; mobile keeps `min(222px, 100vw - 32px)`. `.page9-tooltip.is-docked
.page9-tooltip-desc` clamps to **3 lines** at a pinned `line-height: 20px` via
`-webkit-line-clamp` (which needs `display: -webkit-box` +
`-webkit-box-orient: vertical`; `flex: 1` still applies, since that governs the box as its
parent's flex ITEM). 27px padding + the 18px date line (its line-height is pinned too) +
3 × 20 = 60px is what the 100px frame height is solved against — change one and re-solve
the others (and `P9_TOOLTIP_COLLAPSED_H` in page9.js, and the `62 + 100` in
`SBB_TIMELINE_MOBILE_TOP_PX`, squareboundingbox.js). A fourth line
made the frame too heavy a block at the top of a phone screen, given the toggle
below already covers the tail. The clamp prints an
**ellipsis**, so truncation is visible rather than a sentence stopping mid-word.

**During the press-and-hold picker the clip opens by itself**: `showEvent` adds
`is-expanded` whenever the hold is live (`p7Inspect.dragging`) and the description is
clipped, so the full text is readable while the finger sweeps — the reader can't tap the
toggle mid-hold. For that same reason the `עוד`/`פחות` label is hidden for the duration:
`showEvent` also adds `is-holding`, and `.page9-tooltip.is-holding .p7-tip-more` is
`display: none` (style.css). Releasing the finger (`onEnd`) removes both and collapses it back
to the 3-line frame.

**A reading lasts only as long as the gesture.** `onEnd` calls **`release()`**, so lifting
the finger drops the selection entirely and the frame returns to its resting state: the
`.p7-inspect-hint` line, the neutral gray stroke, no date, no description, `is-inspect` →
`is-picker`. (The gray comes back on its own — `updateGroups`' `keepEmptyFrame` branch
repaints `fold8TooltipEl.style.color` every frame it runs, and `release()` calls
`updateGroups()`.) An event's text and its actor-colored stroke left standing after the finger
lifts read as permanent page furniture, and kept covering the chart the gesture had just been
used to explore.

> **Removed — don't reintroduce:** release used to *keep* the selection, leaving the date,
> description and colored stroke on screen with `is-expandable` still on so a later tap could
> reopen the clip. That post-release reading is gone; `toggleMore`/`is-expandable` now only
> ever run mid-hold.

The toggle's own target is **the whole frame**, not the little label — card-width × 100px
rather than a 30px word,
which on a phone is the difference between a reliable tap and a fiddly one. `.p7-tip-more`
(a small grey `עוד` / `פחות` label built by `p7InspectInit`, page7.js, `pointer-events: none`;
grey rather than the frame's `currentColor` because it is interface, not content) is
only the affordance that says so; `toggleMore` is bound on `#page9Tooltip` itself and
early-returns unless the frame is expandable, and CSS grants `pointer-events: auto` only in
those two states — so in every other state a touch falls through to the chart as before.
It listens on **`touchend` as well as `click`**: the window-level touch handlers call
`preventDefault` while a hold is live, and a prevented sequence may never emit the synthetic
click at all. A 400ms `lastToggle` guard swallows the click that follows the same tap on
phones that emit both, so it can't toggle twice back to where it started.

Clipping is **measured**, never predicted: where the Hebrew wraps depends on the viewport's
width. It cannot be measured on the description element itself — `-webkit-line-clamp`
truncates that box's *layout*, so it reports its clamped height as its own `scrollHeight`
and every `scrollHeight > clientHeight` test reads "fits" no matter how long the text is
(this is what kept the toggle from ever appearing; lifting the clamp for one forced reflow
didn't survive every engine either). `syncMore()` instead lays the text out a **second time
in an offscreen div** that copies the description's computed font, line-height, direction
and `clientWidth` but has no clamp, and compares that honest height against the clamp's own
budget, `P7_TIP_CLAMP_LINES × line-height` — so the test never depends on the clamped box
reporting anything truthfully. `P7_TIP_CLAMP_LINES` (page7.js) must stay in sync with the
`-webkit-line-clamp` value in style.css.

**Order matters in `showEvent`: `sync()` must run BEFORE `syncMore()`.** `sync()` is what drops
`is-picker`, and `.page9-tooltip.is-docked.is-picker .page9-tooltip-desc` is `display: none` —
so measuring first measures a hidden box (zero width, no line boxes), the test reads "fits" for
every event, and the toggle never appears at all. This was the actual reason the feature looked
dead; the measurement technique was never the problem. `syncMore` now also falls back to the
frame's own inner width when the description reports none, so a mistimed call can't fail
silently as "fits" a second time.

The frame can only receive that tap because `#page9Tooltip` is a **direct `.layout` child**
(project.html) — it originally sat inside `.graphic-col`, whose stacking context (fixed,
z-index 0) trapped the tooltip's z-index 1000 under `.text-col`'s full-viewport sections, so
every touch landed on `section#page-8` instead. Same trap, same fix as `#page9CatTooltip`
and `#fold6NoteLayer` — see [Architecture](Architecture.md).

Expanding adds
`.is-expanded`, which drops the fixed height (`height: auto`, capped at
`calc(100vh - 62px - 24px)`, the description itself scrolling past that) and unclamps the
text. Two rules this state obeys:

- **It grows DOWNWARD over the chart, never pushing it.** `SBB_TIMELINE_MOBILE_TOP_PX` (and
  @fold11's `p9ExtremeTopY`, via `P9_TOOLTIP_COLLAPSED_H`) derive the grid's top clearance from the *collapsed* height,
  so a frame that resized the layout would shift every dot on screen mid-read. Covering a few
  dots while the text is open is the cheaper trade.
- **Selecting a new event collapses it** (`collapseMore()` in `showEvent`), so an open frame
  can't be left hanging over the chart around a description that fits.

`chartTouch` already ignores touches inside the frame, so the press-and-hold is unaffected
either way. The `click` handler calls `updateTooltipDash(tipEl)`: the dashed border is an
`<svg>` sized to the box's own pixels, and a box that just changed height would otherwise keep
the old outline.

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
speed over the current phase's clock — `P8_TRANSITION_DURATION` 3000 ms forward,
`P8_REVERSE_DURATION` 700 ms reverse (`p8PhaseDur`) — so a mid-flight reversal covers
only the remaining distance. The reverse is deliberately much faster: it fires while the
reader is already scrolling back up the multi-viewport scrub, and at 3000 ms the canvas
showed a crushed page9-blend band and the end-state axis deep into @fold9 for seconds. `drawPage8` at `t <= 0` delegates to `drawPage7` with `currentDate`
temporarily forced to `maxDate`; above that it lerps each dot from its timeline cell to
its page9 legit-grid target and lerps the square size 3.5 → 3 over the same ease (no
opacity fade). `p8CaptureBlendedPositions(W, H, tOverride)` feeds both `p9.anim` (forward) and
`p7EntryAnim` (backward) in `setActivePage`.

**The handoff replays the glide's own global clock — it does not restart one.** Both
call sites capture the glide's *endpoint* positions (`tOverride` 0 forward, 1 backward)
and back-date `start` by the elapsed fraction — each direction against its own clock
(forward `P8_TRANSITION_DURATION`, backward `P8_REVERSE_DURATION`) — so the continuation's
`p9Ease(elapsed / duration)` reproduces `p9Ease(p8CurrentT())` exactly
(verified to float precision at every handoff point). Do not "simplify" this back to
capturing the current blended position with the remaining duration: that eases an
already-eased slice — the standard mistake this project's easing rule names — so the
dots came to a **dead stop** at the handoff (sine-in-out starts at rest) and the path
deviated up to ~15% of total travel. Since the `IntersectionObserver` firing the handoff
crosses at a scroll-dependent moment, the visible symptom was the @fold10→@fold11 glide
stuttering and landing inconsistently *only when the user kept scrolling through it*.

## Mobile

Under the 600px breakpoint the fold keeps its shape — two camps mirrored around the
center gap, same cascade, same scrub — and changes only scale. Every value below is a
live `isMobile()` read at layout/draw time (`sbbTimeline()`, `p7Cell()`, `p7AxisMargin()`
and friends), so a resize across the boundary is picked up by the existing relayout with
no extra invalidation; desktop rendering is untouched.

| | Desktop | Mobile | Why |
|---|---|---|---|
| Square / gap (pitch) | 3.5 / 1.5 (5) | **solved per viewport**, gap = half the square | See "The solved square size" below |
| Box `left` | 0.18 | 0.03 | The 0.18 exists only to clear the *left*-pinned desktop legend; on mobile the legend is top-pinned, so this becomes a plain screen-edge inset (≈12px at 393, matching `FOLD6_LEGEND_INSET_MOBILE`) |
| Box `top` | 0.13 | **180px** (`SBB_TIMELINE_MOBILE_TOP_PX`) | The docked tooltip's bottom edge + `SBB_TIMELINE_MOBILE_GAP_PX` (18): `TOOLTIP_DOCK_TOP_PX` 62 + the frame's fixed 100px collapsed height (the expanded state is deliberately not counted — it overlays the grid). A px clearance, not a fraction — the thing being cleared is fixed-px, so a fraction wasted a band on a tall phone and collided on a short one |
| Box `bottom` | 0.81 | **axis − 64px** (`SBB_TIMELINE_MOBILE_AXIS_CLEAR_PX`) | `P7_AXIS_Y_FRAC_MOBILE`×H minus the tallest label block that can print above the axis — sized for what really prints: at the 220px wrap all seven titles fit on **one line**, so the block is offset 36 + ~10px cap height = 46 — minus the *same* 18px `SBB_TIMELINE_MOBILE_GAP_PX` used at the top, so the dots clear the labels by exactly as much as they clear the tooltip. Reserving spare lines left every real block floating in a hole; a longer title added later would wrap and eat 18px per extra line out of the gap. Three lines is the worst case |
| `P7_AXIS_MARGIN` | 120 | 28 | At 120 a 393px screen would leave ~150px of axis; 28 gives ~337px, year ticks ~90px apart |
| Year label | 18px | 14px | 4-digit years fit at that tick pitch — no 2-digit fallback needed |
| Title / date type | 14 / 14px | 14 / 14px | The date matches the year label, so the two lines under the axis read as one size |
| Label offset / date offset / line height | 34 / 18 / 19 | 36 / 15 / 15 | |
| Title `maxWidth` | all `null` | 220 default, per-event `maxWidthMobile` | Mobile prints one centred block (below), so the whole axis width is available — most titles come back to one or two lines, well inside the 3-line reserve |
| `.page7-scrub` | 780vh | 560**vh** | A touch flick covers far more page per gesture. `vh`, never `dvh`: `dvh` re-resolves when the URL/bottom bar collapses, which grew the section ~600px mid-scrub and jumped the visible date back by months |

`sbbTimeline(H)` takes the canvas height it is being used for and turns those two px
clearances into the `top`/`bottom` fractions the rest of the code already expects, so no
call site changed shape. Pass the same `H` you are laying out against — the default
(`window.innerHeight`) exists only for callers that have none.

### Headlines print in one centred slot (mobile)

On desktop each headline sits over its own dot and an `OVERLAP_PAD` de-collision pass
nudges neighbours apart. A phone-width axis has no room for that — the pass just shoved
blocks to the screen edges and the reading order stopped matching the axis.

On mobile `p7DrawAxisEvents` skips de-collision entirely and prints **every** headline in
one fixed slot centred on the canvas (`lineX = W/2`). One slot means one label, so when a
fast flick makes several entries visible in the same frame only the **most recently
triggered** one is kept (by `P7_AXIS_EVENT_STATE[i].triggeredAt`, ties broken by index) —
the older ones are the ones the scrub has already passed.

**The dots stay where they are.** The persistent circle pass runs before this and marks
each event at its true date position on the axis; only the text moves to the centre.

### The solved square size

The mobile square is **not a constant**. A fixed pitch has to be small enough for the
smallest phone, which left every larger one with capacity far above its event count — and
since `p7OrderFromCenter` sizes its usable pool to the side's own events, that surplus read
as a thin scatter of dots in a box mostly made of gaps.

`p7SolveMobileSq(sideW, sideH, maxEvents)` instead walks down from `P7_MOBILE_SQ_MAX` (3)
in `P7_MOBILE_SQ_STEP` (0.05) and returns the **first** size whose grid still holds the
bigger camp — `floor(sideW/cell) × floor(sideH/cell) × P7_MOBILE_FILL ≥ maxEvents`, with
`cell = sq × 1.5` (`P7_MOBILE_GAP_RATIO` 0.5, the ratio the old 1.5/0.75 already had).
`P7_MOBILE_FILL` = **0.86**: the bigger camp may occupy at most 86% of the cells, so the
remaining scatter of permanent gaps keeps the desktop grid's texture instead of packing the
box solid. The result lands in `p7MobileSq`, which `p7Sq()`/`p7Cell()` return.

Solved sizes (right camp 9,126, current clearances): 320×568 → **1.35**, 320×700 → 1.6,
360×740 → 1.75, 375×667 → 1.65, 393×852 → **2.05**, 430×932 → 2.25, 600×800 → 2.4. Fill
lands at 82–86% everywhere.

`P7_MOBILE_SQ_MIN` is **1.25** — only 320×568 comes near it. Below ~1.2 a square stops
reading as a mark, so the floor is the point at which truncation is preferred to
invisibility; `p7OrderFromCenter`'s `min(total, maxEvents)` does the truncating if it ever
happens.

**Timeline squares are painted on the device-pixel grid, on both breakpoints.** In
`p7DrawSideSquares` the fill rect's x/y/size are rounded to whole device pixels
(`Math.round(v * dpr) / dpr`). Two different reasons, one mechanism — and one difference:
desktop snaps only a **settled** square (`scale === 1`), mobile snaps throughout. Quantising
the pop's grow to whole device pixels collapses the scale ramp into two or three visible
steps and the cascade reads as stuttering, which is worse than the softness it fixes; on
mobile the loupe artifact is the louder of the two, so it snaps anyway. **Desktop:** on a display whose DPR isn't a whole number (a scaled
external monitor at 1.25×/1.5×) every fractional edge bleeds into the neighbouring device
pixel at partial alpha and the whole timeline reads soft — obvious beside the same page on
a 1×/2× screen, where the coordinates happen to land clean. The **year-axis ring markers**
snap for the same reason (`axisQ` in `p7DrawYearAxis` rounds `axisY`, each tick's `x`, and
the hover disc's center): at ~4px radius a fractional center smears their 1px stroke over
two device-pixel rows. The headline-event dots are deliberately left unsnapped — their `x`
is compared by equality against `highlightX`. **Mobile:** the square sizes are fractional CSS px at fractional positions, so on a DPR>1
phone each edge would land mid-device-pixel and the canvas would antialias it into a band
of partial-alpha pixels — invisible on its own, but the loupe below is a
**nearest-neighbour** 4× blit, which turns every one of those faint pixels into a 4×4
block: a pale ring that makes the dots look stroked. The fringe is removed at the source
rather than smoothed in the glass, so `imageSmoothingEnabled = false` and the
single-render-path rule both survive, and the un-magnified grid gets crisper too. Layout is
untouched; this is a rounding at paint
time only, so it is not a violation of "position never snaps". Cost: a mid-pop square's
grow quantises into a few discrete sizes, covered by the pop's own alpha fade.

**All three mobile dot-paint paths snap, not just that one.** The picker serves @fold11 as
well as @fold9, and it repaints the picked dot itself, so the same rounding has to happen
in each place a dot reaches a DPR>1 screen — otherwise the ring comes back on whichever
path was missed:

| Path | What it paints |
|---|---|
| `p7DrawSideSquares` (page7.js) | @fold9's timeline squares |
| `p9PlaceDot` (page9.js) | @fold11's dots — the `sizeOverride === undefined` branch. The `sizeOverride` branch snaps too, but for the unrelated legit-bar seam |
| `p7DrawInspectScrim` (page7.js) | the saturated repaint of the **picked** dot; unsnapped it put the stroke back on the one dot the halo exists to isolate |

All three are gated on `isMobile()`. One carve-out: at rest (no `p9.anim`) @fold11's legit
bar bypasses per-dot painting entirely — it draws one snapped `fillRect` per colour segment
instead (see [Drag-and-Drop](Drag-and-Drop.md), "The legit bar"), so the `sizeOverride`
snap only ever runs mid-animation there.

**`p7UpdateLayout`'s early-return guard includes the event count** (`p7.lastMaxEvents`), not
just W/H. The first layout runs before `events.json` lands (counts 0 → the floor), and
without that term the solved size would stay at the floor for the whole session on an
unchanged viewport.

**Hover is disabled on mobile** — `doHitTest` returns early on `isMobile()`. A 1.5px square
is far below a finger-sized target, and `pointermove` on touch would latch a tooltip that
nothing clears. The listeners stay attached so a resize back to desktop restores hover for
free. Its mobile branch also calls `p7InspectSync()` — `doHitTest` is the one thing already
running on every redraw, scroll and pointer event, so the picker's state sync hangs off it.

### The mobile event picker

`p7InspectInit` (page7.js, bottom) is touch's replacement for hover on **`#page-8`
(`@fold9`) and `#page-10` (`@fold11`)** — one picker serving both folds. Every entry point
gates on `p7InspectPage()`, which returns the current page only if it's mobile and one of
those two. On `@fold10`'s bridge (page 8, in between the two) the gesture is off but
`sync()` still keeps `is-picker` on the frame: `updateGroups`' `keepEmptyFrame` branch holds
the empty docked frame on screen while it glides down to `p9DockTopM()`, and without
`is-picker` the hint is `display:none`, so the frame would fly as an empty box; the fold it's running on is otherwise abstracted into `p7InspectSource()`, which
hands back `{positions, half, maxY}` — `p7.lastPositions`/`p7Sq()/2` on `@fold9`,
`p9.lastPositions`/`p9Metrics().SQ / 2` plus a `maxY` of `p9.midY` on `@fold11` (so only
extreme-side dots are pickable). `release()`'s fold-8 typewriter re-seed is gated on
`currentPage === 8`, and `chartTouch` additionally ignores touches landing on
`.page9-tray`. Its two DOM elements are
`display: none` outside the 600px query, so **desktop is unreachable, not merely
unaffected**.

**There is no button.** The gesture is the affordance — a press-and-hold anywhere on the
chart — and the docked frame's resting content is the line of text that names it. Two
states, both classes on `#page9Tooltip`:

| Class | Shows |
|---|---|
| `.is-picker` | `.p7-inspect-hint`, centered at the same 15px as the description it's replaced by, reading `לחצו והחזיקו על נקודה להצגת פרטי האירוע` — long enough to wrap to two lines in the 222px box, which the fixed frame height absorbs. At `rgba(0,0,0,0.8)`, darker than `.p7-tip-more`'s 0.55: it *is* the frame's content here, not chrome beside it. A label, not a control: the frame stays `pointer-events: none` and keeps its fixed 100px height |
| `.is-inspect` | The ordinary docked tooltip (date + description). There is no dismiss control — a selected event simply stays until the next hold replaces it, or until leaving `#page-8` releases the frame |

While dragging, `.p7-loupe` — a 96px circular canvas — rides
`P7_LOUPE_LIFT_PX` (60) above the fingertip. It is a `drawImage` blit of the main canvas at
`P7_LOUPE_ZOOM` (4×) with `imageSmoothingEnabled = false`, deliberately **not** a second
render path: nothing has to be kept in sync with `draw()`. Its ring is a `box-shadow`, not a
`border`, so the element's CSS size stays exactly 96px and matches the backing store the
blit scales to. The source rect is in device pixels (the main canvas is DPR-scaled, see
`draw()`), the destination in CSS px. The nearest event within `P7_INSPECT_SNAP_PX` (44) is
marked — snapped to the dot, not tracking the finger, so what the tooltip describes is
unambiguous — and that event is pushed into the frame continuously.

**Collision dodge — the frame gets out of the loupe's way.** A hold high on the chart runs
the glass straight into the docked frame's spot, so while the finger is high enough that
they'd overlap, the frame **snaps** to a dodge spot low on the viewport, and snaps back the
moment the finger drops below the threshold or lifts. The snap is a deliberate, explicitly
instructed exception to "position never snaps" — the dodge is a mode flip serving a live
finger, and an animated frame would pass through the very glass it's dodging. Two pieces:
`tooltipAvoidPx` (`js/fold8-tooltip.js`), which while `p7TipAvoidActive` overrides
`tooltipDockMobile`'s `top` with a spot low on the viewport, built off the same clearance
line the grid's bottom uses — the year-axis line (`P7_AXIS_Y_FRAC_MOBILE` of the viewport)
minus `SBB_TIMELINE_MOBILE_AXIS_CLEAR_PX` (squareboundingbox.js). The two folds anchor
differently (explicit instruction, `@fold11` only): on **`@fold9`** the frame's bottom edge
sits on that line, anchored off the **live** `offsetHeight`, so a hold-expanded description
grows upward and never touches the axis text; on **`@fold11`** (`currentPage === 10`) the
**collapsed** frame's bottom (`P9_TOOLTIP_COLLAPSED_H`, 100) sits `P7_TIP_AVOID_DROP_PX`
(32) **lower** — deliberately eating into the clearance — and a hold-expanded description
grows **downward** over the axis area instead of upward into the chart; and
`syncTipAvoid` (`drawLoupe`, `page7.js`), which sets the flag by comparing the loupe's top
edge (`fingerY − P7_LOUPE_LIFT_PX − P7_LOUPE_SIZE/2`) against the frame's **normal resting
bottom** for the current fold (`TOOLTIP_DOCK_TOP_PX` + the 100px collapsed height on
`@fold9`; `p9DockTopM()` + 100 on `@fold11`) plus a 24px margin (widened from 8 by
explicit instruction — the snap-down fires from a slightly lower finger) — a per-fold
constant, not
the frame's live rect, so a frame already mid-dodge can't drag the threshold down with it
and flip-flop — and re-docks the frame on every loupe frame (the dodge spot moves with the
frame's height as selections swap and descriptions expand). `hideLoupe` clears the flag and
re-docks, so releasing anywhere sends the frame straight home.

**The pick and blit re-run every frame while the hold is live** (`loupeTick`, a rAF loop
started when the hold timer fires and self-stopping when `p7Inspect.dragging` drops), at the
last known finger position — not only at timer-fire and on `touchmove`. A hold started while
the month cascade is still popping dots in would otherwise open on nothing and stay on
nothing under a still finger, even once dots had appeared right under it (this was the
"first hold needs two tries" bug); the per-frame pass also keeps the glass live while the
canvas animates instead of freezing on the last touchmove's blit. Cheap: `drawLoupe` is one
96px blit, and it only repaints the main canvas when the picked event actually changes.

**While dragging, the pick also marks the year axis, like desktop hover.** `p7DrawAxisLine`
treats `p7.hoveredEvent || (p7Inspect.dragging ? p7Inspect.event : null)` as the hovered
event, so a loupe-picked dot gets the full state-3 axis treatment — line and rings go
faint, the roster fades, and a filled disc in the group's colour marks the event's date.
Gated on `dragging`, for the same reason as the halo: it's an aiming aid, and release clears
the selection, so the axis eases back to normal along with everything else. `showEvent` and `hideLoupe` call `p7StartAnimLoop()` for the same reason
`p7HoverInit` does — the roster fade eases per frame (`p7AxisEventsAnimActive` includes the
dragging pick in its roster-target check). Desktop is untouched: `p7Inspect.event` is only
ever set ≤600px (`p7InspectPage`).

**The selection halo — drawn by subtraction, on the main canvas.** `p7DrawInspectScrim`
fills one even-odd path — the whole canvas, minus a disc at the selected dot — with
`rgba(255,255,255,0.76)` (`P7_INSPECT_SCRIM`). The exempt disc's radius is
`P7_INSPECT_HOLE_DOTS` (1) dot widths, floored at 1.5px so it survives `@fold11`'s 1px dots.
Everything dims; the selection alone keeps full colour.

**The picked dot is then repainted more saturated than its group colour** — the scrim's
hole only leaves it *un*-dimmed, and at 1–3px, ringed by a field gone pale, unchanged
doesn't read as chosen. `p7DrawInspectScrim` overpaints the square with
`p7Saturate(p7ActorColor(event.actor), P7_INSPECT_PICK_SAT)` (0.35), which pushes each
channel away from the colour's own luminance — hue-preserving, no HSL round trip.
Saturation, not lightness: a lift toward white would wash a dot this small out against the
scrim. `lerpFold6SquareColor` is not reused because it always blends against the fold6
rest gray. `GROUPS` is untouched: this is a transient selection state, and the roster's
colours are the legend's contract.

**The radius is then clamped to `(cell - half) * 0.9`, and never below `half * 1.42`.**
`cell - half` is the distance from the selected dot's centre to the nearest *edge of its
neighbour*, so anything at or past it exempts part of the adjacent dot too and the
selection's brightness appears to spread to the dots around it — the exact effect the halo
exists to prevent. The nominal radius landed *on* that edge at `@fold9`'s 1.5-dot pitch
(rounding leaked a sliver) and well past it at `@fold11`, where the 1.5px floor exceeded a
1.25px neighbour gap. The lower bound is the selected square's own half-diagonal, so a
grid tight enough to force a choice clips a neighbour before it clips the dot being
pointed at. `p7InspectSource` returns `cell` alongside `half` for this — `p7Cell()` on
`@fold9`, `p9Metrics().CELL` on `@fold11`.

It runs on the **main** canvas, not inside the loupe, so the dimming reaches every dot on
screen rather than only the handful under the glass — and since the loupe is a plain blit of
that canvas, it inherits the halo already magnified, with no marker of its own and no second
render path to keep in sync. It is called from both `drawPage7` and `drawPage9` (the picker
serves both folds), after the dots and after `lastPositions` is published — it reads that map
to find the hole. On `@fold9` it sits *before* the axis, which stays at full contrast as the
reading context for the selected date. A selected event that has fallen out of the draw range
scrims everything with nothing exempted.

**The 8 `fold6SquareEls` dim with it, separately.** They are DOM squares sitting *on top of*
the canvas, so a canvas scrim cannot reach them — left alone they stayed at full colour while
everything under them went pale, reading as 8 dots the halo had singled out. `updateGroups`
multiplies their opacity by `1 - P7_INSPECT_SCRIM` while the drag is live, exempting the
picked event exactly as the scrim's hole does. Because `draw()` doesn't touch DOM, the picker
calls `updateGroups()` beside each of its three scrim repaints (drag start in `armTimer`, a
changed pick in `drawLoupe`, and `hideLoupe`) — the same pairing its hover path already uses.

The halo is a **drag-time** aid, gated on `p7Inspect.dragging` — it shows which dot the
finger is on. Lifting the finger clears the selection outright (`onEnd` → `release`), so the
chart, the axis and the docked frame all return to neutral together — a halo left standing
would read as a persistent highlight rather than as aim.

Because it lives in the canvas, both `drawLoupe` (on a changed pick) and `hideLoupe()` call
`draw()` — nothing else is animating a settled fold, so without that the halo would lag a
frame behind the selection, or stay on screen after the finger lifts.

**Telling an inspect from a scroll.** With no armed mode, the hold does that job:
`touchstart` on the chart starts a `P7_LONGPRESS_MS` (300) timer, and movement past
`P7_LONGPRESS_SLOP_PX` (10) before it fires **re-anchors** it (`armTimer`) — the anchor
moves to the finger's new position and the 300ms clock restarts. A live scroll keeps
pushing the deadline back and is never interfered with; a scrolling finger that comes to
rest *without lifting* fires the hold right where it stopped — essential on the pinned
timeline, where the scrolling finger is what drives the month cascade, so "wait for the
dots then hold" naturally happens mid-gesture. (It used to cancel outright, which made a
mid-scroll hold impossible.) `touchstart` is therefore **passive**; only `touchmove` is
non-passive, and it `preventDefault`s solely after the hold has completed. A touch landing
inside the docked frame's own rect is ignored — it's reading the tooltip, not aiming at a
dot behind it. On `touchend` the loupe hides and `release()` clears the selection.

**Native momentum blocks the picker, so the picker folds don't use it.** While an iOS
fling is coasting, WebKit delivers **no touch or pointer events at all** to the page —
verified on-device with a trace harness: a finger planted on the coasting timeline and
held for two seconds produced no `touchstart`, no `pointerdown`, and no `touchcancel`.
There is nothing for `p7InspectInit` to hook during a native fling. The fix is
`p7BrakeInit` (page7.js, mobile-only, gated on `p7InspectPage()` so it covers exactly
@fold9 and @fold11): touch velocity is tracked through `touchmove`, and on a lift that
still carries speed (fresher than `P7_BRAKE_STALE_MS` 80 and above `P7_BRAKE_MIN_V`
0.05px/ms) the deceleration is taken over — the first programmatic `scrollTo` (to the
position the page already holds) cancels the imminent native fling, then a rAF glide
decays the velocity with `P7_BRAKE_FRICTION_MS` (260, e-folding) friction, far stronger
than iOS's own. Because the coast is now script-driven, touch events keep arriving during
it: a `touchstart` mid-glide cancels the glide (the page stops under the finger) and the
picker arms normally — "touch stops the page, then picks". A hold's own `touchend`
(`p7Inspect.dragging`) and multi-touch lifts never start a glide; every other fold keeps
native momentum untouched.

> **Removed — don't reintroduce:** a `touchcancel`-based "momentum steal" recovery
> (`P7_COAST_MS`/`P7_STEAL_MS`/`P7_HOLD_GRACE_MS`, `p7LastScrollAt`, `armedAfterCancel`,
> `p7InspectScrollGuard`, an arresting `scrollTo` in `touchstart`). It was built on the
> theory that iOS dispatches `touchcancel` when the scroller claims a coasting-page touch;
> the on-device traces show that event never fires (only `pointercancel` does, during the
> *flick* itself), so the whole mechanism was dead code. Any future attempt must start
> from the fact that the events don't arrive — e.g. a CSS-level change to how the page
> scrolls — not from event handlers.

**iOS steals the same gesture.** A press-and-hold is also the OS's select-text/callout
gesture, and it fires on the surrounding page even though `<canvas>` has no text — the
Copy / Browse-for-Me bar pops up over the loupe mid-drag. Killed under the 600px query with
`-webkit-touch-callout: none` + `user-select: none` on `.graphic-col`, `#canvas` **and
`#page-8`** — that last one matters: the scroll column's transparent section sits on top of
the canvas and is the element the finger actually lands on, so the canvas alone isn't
enough. No other section is listed, so the article keeps normal selection.

**Ownership.** `p7InspectOwnsTooltip` (declared in `js/fold8-tooltip.js`) is the picker's
claim on the shared frame — the same problem `fold8TooltipOwnsIt` solves against
page7/page9's hover. While set, `fold8AdvanceSequence` returns immediately and `updateGroups`
skips its `i === 0` tooltip block entirely. *Skipped*, not force-hidden: a hide would reset
the sequence and make it replay its grow+type from zero. Releasing (leaving
`#page-8`) re-seeds `fold8DateSpans`/`fold8DescSpans` via `fold8SetupTypewriter` rather than
restarting the sequence — the picker detached those spans when it wrote plain `textContent`
into the same two elements, but `fold8SeqElapsed` is still valid.

**The @fold10 handoff needs no mobile-specific work.** `p7TargetForActorOccurrence` reads
`p7.CELL/SQ/cols` *after* `p7UpdateLayout`, which already clears `p7TargetCellCache` on any
geometry change — so the 8 flying squares land on mobile cells automatically. `page8.js`
was pointed at `sbbTimeline()`/`p7GridGeometry().rightX0` for the same reason.

Both former tight spots (grid-top clearance under the legend, a three-line title grazing
the grid's bottom) are gone by construction — the box is now derived from those two
landmarks rather than guessed at as a fraction. The knobs, if the spacing wants tuning by
eye, are `SBB_TIMELINE_MOBILE_GAP_PX` — one shared 18px clearance used *both* above and
below, so the grid sits evenly inside the tooltip / dots / axis-label stack instead of
crooked — and the label-block height inside `SBB_TIMELINE_MOBILE_AXIS_CLEAR_PX`. Either one
shrinks the box, which the solver answers with a smaller square.

## Known stale comments

None currently — `p7UpdateAxisEventTriggers`' comment block was corrected to the real
`minDate` `2023-01-01` / first axis event `2023-01-04`.
