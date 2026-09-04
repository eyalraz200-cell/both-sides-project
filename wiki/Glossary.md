# Glossary

Shorthand used in conversation about this project. Several terms collide across files —
those are called out.

**`@foldN`** — the canonical 1-indexed on-screen fold numbering. `@foldN` = `id="page-(N-1)"`.
Resolve it via [Folds](Folds.md), never by eyeballing an id or a symbol name.

**Title block** — a scrolling section's text content (title, sometimes a legend). In code
it's `.section-text` inside a `.text-section`, e.g. `#page-1 .section-text`. The dashed
white box around just the `<h2>` is `.text-card-frame`.

**`@legend`** — the persistent mini-legend: the 6 camp groups
(`GROUPS` / `#groupsOverlay`) in their final two-column resting state, established at
`@fold4` and alive through every later fold. Not the old page-1 list.

**`@dragcards` / "draggable events"** — the category **pills** (`.page9-pill`,
`P9_CATEGORIES`) in `@fold11`'s tray. **Not** the per-event canvas dots.

**"Axis events"** — the `P7_AXIS_EVENTS` headline labels/dates above the year axis (6 of
them). **Not** the per-event canvas dots.

**"Axis appearing" vs "axis filling up"** — two distinct behaviors, easy to confuse:
*appearing* is the 2800 ms build-in wipe (`p7AxisIntroT`); *filling up* is the dark
"reached" bar growing as `p7.currentDate` advances. Both are currently gated off the same
crossing. On desktop both run **top → bottom** down the vertical centre axis; on mobile
right → left along the bottom axis.

**"Band" / "widen"** — the two headline placements under comparison on the desktop
vertical axis (`P7_VERT.eventMode`): *band* pauses the dot flow and prints the headline
across the reserved rows; *widen* opens the centre corridor around the event's rows.
See [Timeline](Timeline.md#the-vertical-layout-desktop--p7buildverticallayoutrows-cols-cell--p7vert).

**"State 1" / "state 2" — page9** — the two extreme-drop animation modes.
State 1 = non-interrupting (reposition, *then* new dots fly, 2200 ms).
State 2 = interrupting (new dots fly concurrently, 3400 ms).
**State 1 is FINALIZED — never change it without explicit instruction.**

**"State 1/2/3" — page7 year axis** — a completely unrelated set of terms: unfilled /
filled / hover-highlight coloring. Ask which file is meant if it's ambiguous.

**Beat / beat window** — a `{start, len}` fraction of a trigger's raw linear timeline.
See [Animation-System](Animation-System.md).

**"Secondary attribute can snap, position never does"** — the project-wide rule that x/y
must always animate continuously, while color/opacity/label visibility may move on their
own timing.

**Camp headers** — מחנה הימין / גוש השינוי (`.fold4-column-title`). They type in at
`@fold2` and un-type in place at `@fold4`; they never travel into the legend.

**The 8 squares** — `#fold6SquaresOverlay`'s sample squares, which grow in at `@fold6`,
gain labels at `@fold7`, and gain colors + fly to their real per-event dots at `@fold8`.

**Legit grid / extreme grid** — page9's two dot fields, below and above the `P9_MID`
divider.

**Filler rects** — the 18 extra rects in `@fold2`'s 4×3 camp blocks that are really
`@fold1` decorative dots; they shrink away at `@fold3`, leaving each row's rightmost rect
as the persistent `.group-item`.
