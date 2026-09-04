# Folds

`@foldN` is the canonical, 1-indexed on-screen numbering. **It is off by one from the
HTML id: `@foldN` = `id="page-(N-1)"`.** Verified against `project.html`'s sections and
`PAGES[]` in `js/core.js` — there are **11 folds** (`page-0` … `page-11`).

> Older notes (including CLAUDE.md's own table) describe 12 folds ending at `#page-12`.
> That is stale — the code has 11. This page is the source of truth.

## The table

| `@foldN` | id | `PAGES[]` draw fn | Title (Hebrew, truncated) | What plays |
|---|---|---|---|---|
| `@fold1` | `page-0` | `drawPage1` | קיצוניים משני הצדדים (cover) | Hero overlay (logo/title/subtitle) + the fixed dot columns; scroll-lag damping. **Idle scroll cue:** 3.5s after the entrance finishes with no scroll, the dot columns (decorative dots + the six group swatches) pulse in a wave from the bottom row to the top (`page0CueRun`, js/fold1-intro.js: peak scale 1.6, 520ms per dot, 30ms per row), repeating every 5s; the first scroll/wheel/touchmove cancels it for good and restores the at-rest transforms. Skipped under `prefers-reduced-motion` |
| `@fold2` | `page-1` | `drawBackground` | בשנים האחרונות התגבשו בישראל… | `fold2Trigger`, 4 beats: dots shrink → fly into the two 4×3 camp grids → each camp header types in |
| `@fold3` | `page-2` | `drawBackground` | בשני המחנות קיימות קבוצות… | `fold3Trigger`, 3 beats: filler rects shrink away → surviving rect per row flies into one column → group labels type in |
| `@fold4` | `page-3` | `drawFoldSplit` | בשל פעילותן בשטח… | `fold6Trigger`: the 6 groups glide into the persistent two-column mini-legend; the camp headers **un-type** (see below) |
| `@fold5` | `page-4` | `drawBackground` | אספנו תיעודים… | `squaresRevealTrigger`: 8 grey sample squares grow in at center |
| `@fold6` | `page-5` | `drawBackground` | הנתונים לקוחים מגוף המחקר… (ACLED, with a visible external link in the card) | `acledNoteTrigger`: the ACLED source note + its divider fade into the mini-legend (on mobile: into the מקרא panel) |
| `@fold7` | `page-6` | `drawFold7` | כל ריבוע מייצג פעולה פוליטית בשטח | `fold7LabelTrigger`: square labels appear; `fold8SquareDimTrigger` dims the rest while the fold-8 tooltip grows + types (**mobile:** the tooltip is a docked frame above the timeline instead — see [Timeline](Timeline.md#hover)) |
| `@fold8` | `page-7` | `drawFold9` | צבע הריבוע מציין את הקבוצה… | `fold9Trigger` colors square 0 + its tooltip border; `fold9FlyTrigger` colors all 8 and flies them to their real per-event dots |
| `@fold9` | `page-8` | `drawPage7` | *(no title — `page7-scrub`)* | The pinned real timeline — see [Timeline](Timeline.md) |
| `@fold10` | `page-9` | `drawPage8` | פעולות פוליטיות נבדלות זו מזו… | Bridge glide from timeline layout into page9's legit grid (`page8.js`) |
| `@fold11` | `page-10` | `drawPage9` | איפה עובר הגבול בעיניכם? | Drag-and-drop categorization. Desktop runs **layout V2** (`P9_LAYOUT_V2`): bare pill band on top, horizontal drop zone under it, legit dots denser in a 150px bottom strip — see [Drag-and-Drop](Drag-and-Drop.md#desktop-layout-v2) |
| `@fold12` | `page-11` | `drawPage12` | קיצוניים משני הצדדים (outro) | Scroll-gated outro card; `fold13Trigger`/`updateFold13` morph. Under the methodology the card carries a share row (`.page12-share`: WhatsApp / X / Facebook intent links + copy-link, wired by `p12ShareInit` in page12.js) and a one-line credits paragraph (`.page12-credits`). Both are single lines on purpose — the card already fills a 900px-tall viewport, so `@media (max-height: 920px)` also trims their spacing |

Symbol names (`fold6Trigger`, `drawFold7`, `page7TitleCardEl`…) carry **older, unrelated
numberings** and do not line up with `@foldN`. Don't infer a fold from a symbol name.

## Trigger → card wiring

Every fold trigger is armed by `watchCardThreshold(cardEl, frac, trigger)` — `frac` is
the fraction of viewport height the card's top must cross. A **bigger** `frac` is an
**earlier** crossing. `frac` may be a function, re-read on every check, for a fold whose
crossing point differs by viewport.

| Trigger | Card | `frac` |
|---|---|---|
| `fold2Trigger` | `#page-1 .text-card` | 0.5 |
| `fold3Trigger` | `#page-2 .text-card` | **0.6 on mobile** (`FOLD3_CARD_FRAC`), 0.5 desktop |
| `fold6Trigger` | `#page-3 .text-card` | **0.7 on mobile** (`FOLD6_CARD_FRAC`, nudged later from 0.8 per explicit instruction), 0.5 desktop |
| `squaresRevealTrigger` | `#page-4 .text-card` | 0.5 |
| `acledNoteTrigger` | `#page-5 .text-card` | 0.5 |
| `fold7LabelTrigger` | `#page-6 .text-card` | 0.5 |
| `fold8SquareDimTrigger` | `#page-6 .text-card` | 0.5 |
| `fold9Trigger` | `#page-7 .text-card` | 0.5 |
| `fold9FlyTrigger` | `#page-7 .text-card` | 0 (card fully offscreen) |
| `fold13Trigger` | `#page-11 .page12-sticky-center` | 0 |

## Notable per-fold details

**@fold2 — camp headers type in.** `FOLD2_BEATS` (js/groups.js) slices `FOLD2_ENTRANCE_MS`
(2400 ms) into `shrink` `{0, .198}`, `move` `{.073, .708}`, `headerCoalition`
`{.677, .219}`, `headerChange` `{.781, .219}`. The two headers have their **own** beats,
so one camp can start before the other.

**@fold4 — the headers un-type instead of traveling (both viewports; on mobile the camp
names reappear as static headings inside the מקרא panel — see
[Groups-and-Legend](Groups-and-Legend.md#the-mobile-מקרא-bar)).** The mini-legend's two columns
carry no camp titles (explicit instruction). The headers stay exactly where @fold2 put
them and play their typing backwards: each header's `FOLD2_BEATS` window is *mirrored*
inside `fold6Trigger` (`start → 1-(start+len)`) and its progress inverted, so the camp
that typed in last disappears first. Retiming the entrance automatically retimes the
exit — there is no second pair of constants. Opacity only ramps over the beat's first
quarter (`Math.min(1, t*4, untype*4)`) so the first/last characters don't pop.

**@fold8 — the 8 squares fly to real dots, permanently.** `fold9FlyTrigger`
(`FOLD9_FLY_MS` 1500) colors each square by its own actor and flies it to the real
per-event dot it stands in for. The real cascade never draws its own dot for those 8
events (`p7GetClaimedEvents`), so the DOM square simply stays. The fly is independent of
`p7HasEngaged` — both fire off the same crossing. `draw()` runs unconditionally during
the fly so a fast scroll into `#page-8` doesn't strand it.
The tooltip holds `FOLD9_TOOLTIP_SHRINK_DELAY_MS` (500 ms) after square 0 lands, then
shrinks over `FOLD9_TOOLTIP_SHRINK_MS` (400 ms); reversing un-latches immediately and
cancels the pending timer.


## Mobile status

The 600px breakpoint and what it changes are documented in
[Architecture](Architecture.md#mobile--responsive). Per-fold state:

| Fold | Mobile |
|---|---|
| `@fold1` | ✅ Hero is center-relative already; the logo inset was tightened, the title capped/shrunk to 32px, and the whole hero (title, subtitle **and** both dot columns) pulled down by `PAGE0_MOBILE_DROP` = 1 dot step = 17px — `page0DotBaseOffsetY()` in `page1.js` plus the two `top:` overrides in `style.css`'s ≤600px block. All three must move together or the pixel-measured title→column / subtitle→column gaps break |
| `@fold2`–`@fold4` | ✅ Camp gap is a fixed 80px between the blocks' facing edges (`campCenterGapPx`); labels shrink + wrap to two lines, matching the Figma mobile frame. Wrapped labels forced @fold3 onto its own measured row pitch (`fold3RowPitch`) — see [Architecture](Architecture.md#mobile--responsive). At `@fold4` the six rows **and both camp headers fly into the open מקרא panel**, reshaping to its swatch/type/one-line labels on the way, and the panel's own rows take over in a single frame as they land (a swap, not a cross-fade — the landing is pixel-exact) (`window.FOLD4_FLY`, default on; setting it `false` from the console gets the older hand-off, where the rows don't travel at all — swatch shrinks in place, label un-types on mirrored `@fold3` windows) — the headers land on the panel's own camp headings, leaving only the מקרא button (with `FOLD4_FLY` off they un-type like desktop instead) |
| `@fold6`–`@fold8` | ✅ Fractional `SBB` geometry; tooltips clamped to the viewport. **There is no on-canvas mini-legend** — it, the camp names and the ACLED note all collapse into the מקרא bar pinned to the top of the viewport, which shows nothing but its button until tapped; see [Groups-and-Legend](Groups-and-Legend.md#the-mobile-מקרא-bar) |
| `@fold9`–`@fold10` | ✅ Camps stay mirrored side-by-side; the dot size is **solved per viewport** (`p7SolveMobileSq`) — the largest square whose grid still holds the bigger camp, ~1.35 at 320×568 up to ~2.4 at 600 wide — inside a box whose top/bottom are px clearances off the docked tooltip and the year axis (`sbbTimeline(H)`). Axis margin, type sizes and label wrapping have mobile values; the hover layer is **off** on mobile, replaced by the **event picker** — a press-and-hold anywhere on the chart opens a loupe you drag over the dots, prompted by a hint line in the docked frame (`p7InspectInit`). See [Timeline](Timeline.md#mobile). `page9.js` is 1.5px on mobile, so page8's bridge lerp usually *shrinks* dots across the glide (the solved ~1.35–2.4 → 1.5) rather than growing them as it does on desktop — on the narrowest phones, where the solve lands under 1.5, it grows them slightly instead |
| `@fold11` | ✅ **Tap to classify** — no dragging on mobile. A pill never leaves the tray: tapping toggles `.is-extreme` on it (filled black) and commits the same state change dragging would, so the FINALIZED "state 1" drop animation is reached untouched. `#page9ZoneAbove` and the drag handle are `display:none`; in the handle's place each pill grows a 14px **ⓘ button** that opens the category description (`#page9CatTooltip`) — the touch stand-in for the desktop pill hover, handled in the capture phase so it informs without classifying. Geometry swaps under `p9Metrics()`/`p9MidY()`/`p9ExtremeTopY()`: dot 1px, extreme pitch 2px, and the legit half is currently a **desktop-style spread strip** (`P9_LEGIT_SPREAD_M`, 54px tall, free shuffled 1px dots on a finer 1.5px pitch — under review); the Figma 290-409 **4px bar per camp** (solid, groups as contiguous colour segments, shrinking from its outer end) sits behind that flag — see [Drag-and-Drop](Drag-and-Drop.md#the-legit-bar). The count labels draw as the **bare number only** (no "אירועים"), and the tooltip→grid clearance reserves a label line's worth of room (`P9_COUNT_LABEL_ROOM_M` 20, inside `p9ExtremeTopY`) so even a full-height column leaves the line its own band under the docked frame; the divider stroke draws at `p9MidY` like desktop. Hover is off, replaced by the same press-and-hold loupe as `@fold9`. See [Drag-and-Drop](Drag-and-Drop.md#mobile) |
| `@fold12` | ✅ Outro card width + title size clamped; body copy 14px/1.55 and the sticky wrapper goes `position: static` with `min-height: 100vh` — the methodology text is taller than a phone viewport, so mobile scrolls the card instead of pinning and clipping it. `checkFold13` still fires (a static wrapper crosses `top <= 0` too) and the gate math is unchanged (`min-height` keeps the section a full viewport). |

### @fold11's tray on mobile

Under the breakpoint (`style.css`) the tray is **not a bottom sheet** — Figma node 294-1272
pins it as a full-bleed **band directly under the title card** (`top: 108px`, `bottom: auto`),
so @fold11's mobile stack reads top-to-bottom as **legend → title → pill band → docked tooltip
frame → dot grid → legit bar**. The band goes full-bleed (`width`/`max-width: 100vw`,
overriding the base rule's `width: max-content`), carries a rule on its **bottom edge only**
(`1px solid rgba(90, 90, 90, 0.18)` — nothing divides it from the subtitle above, which reads as
one header block with it), and hides by
sliding **up** off the top edge
(`translate(-50%, calc(-100% - 108px))` — its own height plus the 108px offset).
`104` is mirrored by `P9_TRAY_TOP_M` in `page9.js`, which derives both the tooltip's drop spot
and the grid's top from it, and by `js/fold11.js`'s slide-out; change one and you change all
three. Its padding is a tightened
`8px 0 10px` with a 10px gap (Figma's `23px 0 24px`/14 read too airy on device), and
`.page9-tray-title` ("סוגי פעולות") is **`display: none`** — the node has no label on the band,
the subtitle above already naming the gesture. It's hidden rather than dropped from
`p9BuildPanel` so desktop, which still shows it, keeps one code path.

**The title and subtitle are flushed right in the stuck state**, not centered (same node) —
but the flush is the *pinned* look, not the card's look. While the block is still scrolling
up it is an ordinary centered title like every other fold's, and it travels to the edge only
once it pins at the top, alongside the border fade. Everything below is scoped to
`.page9-title-row` and to the ≤600px query; desktop and every other fold stay centered
throughout.

`text-align` can't do the flush — `.text-card` already inherits `text-align: right`, and what
centers the title is the *box*: `.text-card-frame` is `width: fit-content; margin: 0 auto`.
Releasing that auto margin (`margin-inline: 0 auto`) would flush it, but **`auto` is not an
animatable value**, so the box could only snap sideways the frame `.is-stuck` lands. Instead
the frame stays centered and `.is-stuck` applies `transform: translateX(var(--p9-title-flush))`,
which joins the existing 0.35s transition and glides.

`--p9-title-flush` is written by **`page9UpdateTitleFlush`** (`js/page8-9-scroll.js`), called
from `page9UpdateFromScroll` just before the class toggle: half the slack between the card's
`clientWidth` and the frame's own zero-padding width. It needs JS because the frame is
`fit-content` — the distance depends on how the title happened to wrap at this viewport.
It measures **only while unstuck**: the value is needed before the class lands, and the
padding is mid-transition for 0.35s afterwards. Subtracting the *live computed*
`paddingInlineStart` rather than a hard-coded 29 keeps the reading self-consistent at any
point of that transition, so a reverse crossing can't poison it either.

The frame's 29px side padding is still zeroed in `.is-stuck` on top of the shift — that's the
state Figma shows and the one where the dashed border has faded — so the text ends up ~15px
off the glass rather than 53.

The subtitle sits under it on `margin-top: -16px`, against the base rule's `-21px` (which cancels
the frame's bottom padding outright and leaves the two line boxes overlapping by 3px — desktop
keeps that). The **title→subtitle gap is specified at 2px**, and the margin is derived from it:
the frame contributes `16px padding-block + 2px border` below the title's line box, so
`18 + margin = 2` → `-16px`. Change the spec, change this to `gap - 18`. It's a line-box
measurement — optically, title descender to the subtitle's cap height, it reads ~9px larger.

The pill run is **one pill tall and scrolls horizontally** (Figma node 293-947). Both
`.page9-tray-row` wrappers become `display: contents`, so all 10 pills are hoisted into
`#page9ZoneBelow` — flipped from the base rule's flex *column* to a single `flex-wrap: nowrap`
row with `overflow-x: auto` — and form one continuous run that overflows both screen edges.
The document is RTL, so the run starts scrolled to its right end: the first pill sits at the
right edge and the rest continue off to the left. The scrollbar is hidden
(`scrollbar-width: none` + `::-webkit-scrollbar`); the pill cut off at the edge is the
affordance. `.page9-pill` needs `flex-shrink: 0` + `white-space: nowrap` or flex squeezes the
run to fit and the labels wrap to two lines.

Because nothing has to fit the viewport any more, the pill is its Figma size (node 294-1279):
16px Assistant SemiBold, `padding: 8px 10px`, 6px gap — the height comes from
`line-height: 12px`, reproducing Figma's cap-height text-box trim, so 16px glyphs paint outside
their line box. It carries **no `box-shadow` in any state** — the base rule's rest/hover/
`.dragging` lifts are all zeroed under the breakpoint (all three selectors repeated, since
`.page9-tray .page9-pill:hover` outranks a bare `.page9-pill`): the node is a flat chip, hover
has no meaning on touch, and dragging is replaced by tap. The tray's own side padding is **0** so the run reaches the glass; the end
inset lives on `#page9ZoneBelow` instead, inside the scroller, so it scrolls with the content.
That inset is **logical and asymmetric**: `padding-inline: calc((100vw - min(480px, 100vw - 48px)) / 2) 12px`.
In an RTL document `start` is the right edge — the end the run rests at, and the only pill edge
the reader sees at rest — so it's set to the title card's own gutter, putting the first pill
exactly under the flush-right title. The gutter is re-derived from `--card-w`'s own `min()`
rather than hard-coded as 24, because between 528px and 600px the card stops growing and the
gutter widens. The far (left) end keeps a plain 12px; it scrolls off screen.

Two knock-on values in that stack:

- **`--card-top` is `52px` under the breakpoint** (base: `4.4vh`, `style.css:22`). At 4.4vh
  the pinned title card crowded the מקרא bar; 52 puts an 8px gap between the מקרא button's
  bottom edge (44px) and the card box (explicit instruction; the tray band rode down the same
  4px — `P9_TRAY_TOP_M` 104→108). It's flat px because the
  thing being cleared is itself fixed-px. The gap the eye actually reads is not `48 − 46`: once
  the card sticks its frame is transparent, so the measurement is bar-bottom to the first line
  of title *ink*, a further 2px border + 16px `padding-block` down — ≈22px.
  `page9UpdateFromScroll` no longer hard-codes the old
  `0.044` — it reads `getComputedStyle(page9TitleCardEl).top` back off the card, so the
  stick threshold follows the variable at either breakpoint and the card can't jump as it sticks.
  The card's natural top is computed exactly from the title row's measured box
  (`rowTop + (rowH − cardH)/2`), **never** approximated as `innerHeight * 0.5`: `innerHeight`
  is the *visual* viewport while the row is `100vh` (the large viewport), and on mobile the
  two disagree by the browser-bar height exactly while scrolling up (bars showing) — the
  approximation released `.is-stuck` ~100px before CSS sticky let go, pinning the
  white-filled dashed frame at the top of @fold11 in its un-stuck styling.
- **The extreme grid's rows are clipped at `midY`, not `H - 16`** (`drawBandedCols`, `page9.js`).
  On desktop the two are equivalent; on mobile `midY` is `H` minus the 4px legit bar, so the old
  floor culled the bottom rows and opened a ~12px gap between the dot columns and the bar they
  should rest on.

Dissolving the wrappers drops `P9_TRAY_GRID`'s hand-tuned slots entirely — order falls back to
plain DOM order (row 1's five, then row 2's five), and each pill's inline `grid-column` is
inert in a flex container. `p9MeasureTrayLayout` writes `""` for `gridTemplateColumns` and the
row `height` on mobile — cleared, not merely skipped, so crossing the breakpoint on a resize
can't strand a desktop track list. Desktop is untouched (the tray still measures 828×198 at
1440px).

With the tray at the top, the legit bar sits **flush with the viewport's bottom edge**
(`gridTopY` = `H - p9LegitBarH(W)`) and `p9MidY` is simply `H - p9LegitBarH(W)` — nothing is
below it any more.

**The docked tooltip frame slides down to make room.** The band lands exactly where the frame
has sat since @fold8 (`TOOLTIP_DOCK_TOP_PX` 62), so a third dock spot was added:
`p9DockTopM()` = `P9_TRAY_TOP_M + p9TrayH() + P9_TRAY_TOOLTIP_GAP_M` (20) — measured off the
live band, so the frame stays glued to it however the pills size. It runs on
`p9TooltipDropTrigger` (`js/groups.js`, 850ms, matching `.page9-tray`'s own slide), fired one
fold **early** — from `page8CheckScroll`'s @fold10 title crossing (`js/page8-9-scroll.js`),
the same crossing that drives `p8Trigger`/`p8TriggerReverse` — so the frame is already out of
the way before the band slides in, one move at a time instead of two at once. It's set on
every tick rather than only on the crossing (`trigger()` early-returns at rest, so that's
free), which also resolves it on the first tick and keeps it latched while scrolled past. It
blends into
`tooltipDockTopPx` via `tooltipDockDropPx` so all three spots stay one continuous lerp. It's a
trigger and not a CSS `transition: top` because that `top` is already rewritten every frame by
the @fold7→@fold8 dock lerp, which a transition would smear.

`p9ExtremeTopY` then trails the frame: `p9DockTopM() + P9_TOOLTIP_COLLAPSED_H (100) + 16` — the frame's **collapsed**
height, so tapping "עוד" overlays the grid instead of shoving it down.

The category tooltip (the ⓘ popover) flips **below** its pill whenever there's no room above
— which at the top of the screen is always — with `.is-below` moving its arrow to the box's
top edge.

On @fold12's exit (`js/fold11.js`) the tray does not slide out — it fades in place with
every other fold element (inline opacity over `fold13ScrollT`, same as the header, zone,
legend and title card), on both breakpoints. The mobile מקרא bar fades with them too —
its layer (`fold6MobileLegendLayerEl`) sits outside `groupsOverlayEl`, so `js/fold11.js`
writes the same opacity onto it by name. The shared `#page9Tooltip` (`fold8TooltipEl`)
gets the same treatment — on mobile it's the docked event frame, which otherwise sat
fully visible while everything around it faded. Because two other writers also set that
element's inline opacity, every writer multiplies in `1 - p9.fold13OutT`: the sequence
rAF's grow-in opacity (`js/fold8-tooltip.js`), `updateGroups`' show branch
(`js/update-groups.js`), and the mobile picker's `sync()`/`showEvent()` (page7.js) —
`sync()` in particular runs on every redraw/scroll while `currentPage` is still 9, so
its unconditional `"1"` fought the fade every frame (visible stutter). Without the
shared factor any one of them stomps the fade back to full opacity between scroll
ticks and the frame snaps/stutters instead of fading. The frame's
`keepEmptyFrame` lifetime bound (`js/update-groups.js`) is `currentPage <= 11`, not 9:
the IntersectionObserver flips `currentPage` to 10 partway through @fold12's scroll-in,
and a 9 bound made `forceHide` reset the frame (`display:none`) at that flip point
mid-fade — the fold11 scroll fade owns the frame's exit instead.

The extreme dots' freeform spread (`drawPage12`/`p12EnsureFreeformTargets`, page12.js)
draws at `p9Metrics().SQ` and, on mobile, spreads at `p9Metrics().CELL` — the same size
and pitch the dots had in @fold11's extreme grid (1.5px on 2px there); desktop keeps its
original `P7_CELL` spread pitch with 3px dots.

Hover-only affordances (the @fold10 square dim, the axis hover states) simply never activate
on touch. That's safe — they convey no information that isn't otherwise available. The one
that *did* carry unique information, the timeline's per-event tooltip, now has a touch
equivalent: the mobile event picker on `@fold9` (see
[Timeline](Timeline.md#the-mobile-event-picker)).
