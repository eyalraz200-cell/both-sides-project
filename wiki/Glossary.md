# Glossary

Shorthand used in conversation about this project. Several terms collide across files —
those are called out.

**`@foldN`** — the canonical fold numbering: the visible folds, 1–16, no gaps, as shown on the dev badge. `@fold1`–`@fold5` = `page-0`–`page-4`; `@fold6`–`@fold16` = `page-7`–`page-17`. The hidden sections are `@hidden-acled` (`page-5`) and `@hidden-hover` (`page-6`).
Resolve it via [Folds](Folds.md), never by eyeballing an id or a symbol name.

**Title block** — a scrolling section's text content (title, sometimes a legend). In code
it's `.section-text` inside a `.text-section`, e.g. `#page-1 .section-text`. The dashed
white box around just the `<h2>` is `.text-card-frame`.

**`@legend`** — the persistent mini-legend: the 6 camp groups
(`GROUPS` / `#groupsOverlay`) in their final two-column resting state, established at
`@fold4` and alive through every later fold.

**`@dragcards` / "draggable events"** — the category **pills** (`.page9-pill`,
`P9_CATEGORIES`) in `@fold12`'s tray. **Not** the per-event canvas dots.

**"Axis events"** — the `P7_AXIS_EVENTS` headline events on the year axis (10 on desktop, 7 on
mobile — the `hideOnMobile` entries drop out): side plaques
beside the vertical axis on desktop (each with a `desc` that types in on hover — see
[Timeline](Timeline.md) "Description on hover"), the top slot on mobile. A passed event
stays on the axis until reverse scroll un-reaches it. **Not** the per-event canvas dots.

**"Axis appearing" vs "axis filling up"** — two distinct behaviors, easy to confuse:
*appearing* is the build-in wipe (`p7AxisIntroT`, `P7_AXIS_INTRO_DURATION_*` 1750 ms);
*filling up* is the dark "reached" bar growing as `p7.currentDate` advances. They are
**two separate crossings of @fold7's date-range card**: appearing when its top crosses the
0.75 trigger line (`fold9AxisTrigger`), filling once the card's vertical centre passes the
top edge (`p7HasEngaged`, `P7_ENGAGE_CARD_OUT_FRAC_*` = 0.5). Both run **top → bottom** down
the vertical centre axis, on desktop and on mobile alike (`P7_VERT_MOBILE.enabled` is true).

**"Band" / "widen"** — the two headline placements the desktop vertical axis supports
(`P7_VERT.eventMode`): *band* pauses the dot flow and prints the headline across the
reserved rows; *widen* makes the whole centre corridor wider (top to bottom) so the
headlines fit inside it. **`"widen"` is the one in use**; the band code is kept but unused.
See [Timeline](Timeline.md#the-vertical-layout-both-breakpoints--p7buildverticallayoutrows-cols-cell-visible--p7vert).

**"State 1" / "state 2" — page9** — the two extreme-drop animation modes.
State 1 = non-interrupting (reposition, *then* new dots fly; the reposition runs
`p9RepositionMs()`, tiered by how many dots the fuller extreme column holds — 2200 ms,
1650 ms for 2,001–5,000).
State 2 = interrupting (new dots fly concurrently, 3400 ms).
**State 1 is FINALIZED — never change it without explicit instruction.**

**"State 1/2/3" — page7 year axis** — a completely unrelated set of terms: unfilled /
filled / hover-highlight coloring. Ask which file is meant if it's ambiguous.

**Beat / beat window** — a `{start, len}` fraction of a trigger's raw linear timeline.
See [Animation-System](Animation-System.md).

**"Secondary attribute can snap, position never does"** — the project-wide rule that x/y
must always animate continuously, while color/opacity/label visibility may move on their
own timing.

**Camp headers** — קואליציית הימין / גוש השינוי (`.camp-header`). They type in at
`@fold2` and un-type in place at `@fold4`; they never travel into the legend.

**The 8 squares** — `#fold6SquaresOverlay`'s sample squares, which grow in at `@fold5`
already in their group colours, carry @fold5's hover demo, and fly to their real per-event
dots on `@fold7`'s crossing (`fold9FlyTrigger`).

**Legit grid / extreme grid** — page9's two dot fields, below and above the `P9_MID`
divider.

**Filler rects** — the 18 extra rects in `@fold2`'s 4×3 camp blocks that are really
`@fold1` decorative dots; they shrink away at `@fold3`, leaving each row's rightmost rect
as the persistent `.group-item`.

**Size grid** — what `@fold9` (`#page-10`, both breakpoints) does: arriving on the fold turns it on
(`p7SizeGridSet`/`p7SizeGridOnPage`, page7.js), the timeline undraws, and the visible squares
grow to their crowd-tier block size and re-pack into a gap-exact skyline grid per camp, at
the timeline's own gap. Scrolling back to `@fold8` flies them back. There is no button.
Distinct from the hover **bulge** (same tiers, different multipliers). See
[Timeline](Timeline.md#the-size-grid--p7sizegridset-page7js).
