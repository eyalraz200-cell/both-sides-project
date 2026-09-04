# Architecture

## Two unrelated entry points

- **`index.html`** — the article/home page ("שקוף" branding). Static content, uses
  `trigger.css`, links to `project.html` via `.shk-cta-button`. Shares no layout or JS
  with the scrollytelling page.
- **`project.html`** — the scrollytelling experience. Everything else in this wiki is
  about this page.

## `project.html`'s layout

```
.layout
├── .graphic-col          z-index 0 — its own stacking context
│   ├── #canvas           full-viewport canvas; all dot/square/axis rendering
│   ├── #groupsOverlay    the 6 persistent group DOM nodes (see Groups-and-Legend)
│   ├── #page0DotsOverlay @fold1's fixed decorative dot columns
│   └── #fold6SquaresOverlay  the 8 sample squares
├── #page9Tooltip         shared event tooltip (page7 + page9 + @fold7's demo)
├── #page9CatTooltip      tray-pill tooltip
├── #fold6NoteLayer       z-index 2 — the ACLED source note is reparented here at init
├── #fold6MobileLegendLayer  z-index 3 — the mobile מקרא bar (Groups-and-Legend)
└── .text-col             NO z-index (see below) — the 11 <section.text-section> scroll drivers
```

**`.graphic-col` traps z-index.** Anything that must stack above `.text-col` has to be a
direct `.layout` child, not nested inside `.graphic-col` — that's why the event
tooltip, the category tooltip and the ACLED note layer live where they do. Without it
the ACLED link was unclickable, the category tooltip lost to the tray, and the mobile
docked event frame was untappable (every touch landed on `section#page-8`, so the
עוד toggle looked dead). Don't "tidy" them back inside.

**`.text-col` carries no `z-index` on purpose.** Being positioned, it already paints above
`.graphic-col` on tree order; leaving it `auto` keeps it from opening a stacking context,
which is what lets `.text-card` lift itself (to 4) above the מקרא bar's layer on mobile.
Add a `z-index` here and every descendant gets trapped under that layer again.

## Scripts and shared globals

Loaded as plain `<script>` tags, in this order (`project.html`):

```
squareboundingbox.js → page1.js → page7.js → page8.js → page9.js → page12.js
→ js/core.js → js/nav.js → js/fold1-intro.js → js/page7-scrub.js
→ js/fold8-tooltip.js → js/groups.js → js/update-groups.js
→ js/page8-9-scroll.js → js/fold11.js → js/bootstrap.js → reload.js
```

There are no modules and no imports. Every file declares top-level `const`/`function`s
into the shared global scope, and cross-file references resolve **at call time**, not at
load time — so `page7.js` freely calls `GROUPS` (defined later, in `js/groups.js`) because it
only runs after everything has loaded. A symbol used in one file being defined in
another is intentional, not a missing import.

Two places load order does matter:

- `buildPage0AllDots()` (defined in `page1.js`) is *called from* `js/groups.js` right
  after `GROUPS` is declared, because it reads group colors that don't exist yet when
  `page1.js` itself is parsed.
- The fold triggers in `js/groups.js` pass their tick callbacks as **arrow wrappers** —
  `makeTrigger(MS, (...a) => updateGroups(...a))` — because `updateGroups`
  (`js/update-groups.js`) and `updateFold13` (`js/fold11.js`) are declared in files that
  load *after* `groups.js`. A bare identifier there evaluates at load time and throws a
  ReferenceError; the wrapper defers resolution to call time. Don't "simplify" the
  wrappers away, and don't fix it by reordering scripts instead — the dependency is
  circular (`update-groups.js`'s `scrollend` listener needs `checkGroupTriggers`, and
  `fold11.js`'s load-time `p13SyncGateVisibility()` needs `page12StickyEl`, both from
  `groups.js`).

| File | Role |
|---|---|
| `js/core.js` | Canvas + `ctx`, `PAGES[]` dispatch, `currentPage`, trivial draw fns, `draw`/`init`, dashed-frame SVG utilities |
| `js/nav.js` | `.text-section` roster, `setActivePage`, the IntersectionObserver |
| `js/fold1-intro.js` | @fold1 logo scroll-fade, title scroll-lag, page-load entrance |
| `js/page7-scrub.js` | `#page-8` scroll→date scrub + its scroll listener |
| `js/fold8-tooltip.js` | @fold7's tooltip typewriter demo (`fold8*` state + fns) |
| `js/groups.js` | `GROUPS` roster, fold2 grid tables, `groupItems` DOM, FOLD6 square tables/elements, title-card refs, `makeTrigger`, **all fold triggers**, `watchCardThreshold` + checkers, legend/fold4/fold6-note constants |
| `js/update-groups.js` | The `updateGroups` monolith, `layoutGroups`, groups/axis scroll wiring |
| `js/page8-9-scroll.js` | page8 title-center hold, page9 sticky/title scroll |
| `js/fold11.js` | Outro morph (`updateFold13`) + the scroll gate |
| `js/bootstrap.js` | Font-load bootstrap + resize handler — **must load last** |
| `page1.js` | `drawPage1` + the @fold1 decorative dot-column builder |
| `page7.js` | The pinned real timeline: per-event square cascade + canvas year axis + hover |
| `page8.js` | Bridge glide from timeline layout → page9's legit grid |
| `page9.js` | Drag-and-drop categorization + dot-migration animation |
| `page12.js` | `drawPage12` outro background; `p12ShareInit` fills the outro card's share links (called from `js/bootstrap.js` after fonts load) |
| `squareboundingbox.js` | Shared grid geometry (`SBB` — only `.top` is read, `SBB_TIMELINE`, `CENTER_GAP`) |
| `reload.js` | Dev-only mtime poll → auto page reload |
| `server.py` | Local dev server + xlsx → `events.json` generation |

Deleted scaffolding that should not be recreated: `main_draft1.js`, `main_bands.js`,
`main_screens_backup.js` and the other `main_screen*.js` files.

## Page dispatch

```js
const PAGES = [drawPage1, drawBackground, drawBackground, drawFoldSplit, drawBackground,
               drawFold7, drawFold9, drawPage7, drawPage8, drawPage9, drawPage12];
```

`setActivePage(page)` is driven by an `IntersectionObserver` with
`rootMargin: "-50% 0px -50% 0px"` — i.e. a section becomes current when it crosses the
viewport's vertical midline. It also handles the cross-fold handoffs:

- `>=5 → <5`: `p7ResetForReplay()` — backstop only; the normal wipe happens in
  `drawFold7`/`drawFold9` once the reverse cascade finishes (see [Timeline](Timeline.md))
- `8 → 9`: seeds `p9.anim` from `p8CaptureBlendedPositions(W, H, 0)` (`plainGlide: true`,
  plus `fromSQ: p7.SQ` — page8 shrinks the dots across the glide, so drawPage9 must keep
  lerping the size or they snap small at the handoff and the flight reads as dimmer)
- `8 → 7`: seeds `p7EntryAnim` from `p8CaptureBlendedPositions(W, H, 1)`

Both seed the glide's **endpoint** positions with a back-dated `start`, never the current
blended position with the remaining duration — see [Timeline](Timeline.md#handoff-to-page8page9).

then sets `currentPage`, and calls `updateGroups()` and `draw()`.

`draw()` dispatches to `PAGES[currentPage]`. Scroll-driven per-frame work is
rAF-throttled behind passive `scroll` listeners (`page7Ticking` and friends).

## Title blocks

Each scrolling section's text is a `.section-text.text-card` — a normal-flow, 480px-wide,
horizontally centered block that scrolls with the page (nothing pins). Visibility is an
`.is-visible` class toggled by a scroll-linked `IntersectionObserver`, independent of
`currentPage`.

The dashed white box is a **separate** class, `.text-card-frame`, applied only to the
`<h2 class="section-title">` — never to sibling content like a legend. The dash is not
`border-style: dashed` (too loose); it's a `border-image` sliced so the rounded corners
render unscaled and the 2px-dash/2px-gap edge tiles seamlessly. `DASH_PERIOD = 4` plus
`fitDashArray`/`updateTextCardFrameDashes` in `js/core.js` keep the repeat aligned. A
`ResizeObserver` on every frame re-runs the bake whenever a frame's border box changes —
it MUST observe with `{ box: "border-box" }`, not the default content-box: @fold11's
mobile `.is-stuck` transition animates *padding*, which moves the border box while the
content box stays put, so the default observer never fired for it. With the observer
silent, a mid-stuck re-bake (iOS address-bar `resize`) froze the stuck-size viewBox in,
and on scroll-back-up the dash faded back in stretched across the wider un-stuck frame
while the white fill tracked the real box — fill leaking outside a distorted stroke.

`.section-title`'s base rule (`font: 300 20px/1.5 'HadassahFriedlaender'`) is shared by
**every** card. No page should override its font-size or weight; if one title looks
differently sized, that's a regression. Only two faces exist in `fonts/` — Regular (400)
and Thin (100) — so **300 resolves down to the real Thin file** while anything from 500
up is browser-synthesized thickening of Regular. That is why 300 was picked over the
300-700 sweep: the synthesized weights read as one muddy face, 300 is genuinely drawn.
It also retires the `.latin-acronym` workaround, which now inherits the base weight
instead of forcing 400 — with no synthesis there is no filled-apex artifact to dodge,
and a 400 acronym would sit heavier than the Hebrew around it. The 600px breakpoint drops it to **16px** — that's a width override applied
to the same shared rule, so the titles stay uniform with each other at any given width;
it is not the per-page kind the rule forbids.

**The title *is* the frame.** On the scrolling cards, both classes sit on one element:
`<h2 class="section-title text-card-frame">`. So `.text-card-frame`'s `margin: 0 auto`
(later in the file, same specificity) already overrides the base rule's `margin: 0 0 8px`
— the computed bottom margin is `0`, and the frame's padding is the only vertical
spacing in play. Don't add a bottom margin to `.section-title` expecting it to sit inside
the frame; it lands outside, and only wherever the override doesn't apply.

See also: [Folds](Folds.md), [Animation-System](Animation-System.md),
[Dev-Workflow](Dev-Workflow.md).

## Mobile / responsive

One breakpoint, **600px**, declared in three places that must stay in sync: `MOBILE_BP` /
`isMobile()` (`js/core.js`), `@media (max-width: 600px)` (the block at the end of
`style.css`), and `trigger.css`'s existing article breakpoint.

`isMobile()` reads `window.innerWidth` **live** rather than caching — every caller runs
inside layout code that the existing `resize` handler (`js/bootstrap.js`) already re-runs,
so a desktop↔mobile crossing is picked up for free.

That same handler also **preserves the reader's fractional scroll position through a
resize** (desktop only): the vh-sized sections mean a window-height change changes the
document height while the browser keeps raw pixel `scrollY`, which visibly slid titles
up/down as the window was dragged. `js/bootstrap.js` tracks `scrollY / scrollable-range` on
every scroll and re-pins that fraction (instant `scrollTo`) at the end of its resize
handler, after all re-layout has settled. Skipped under `isMobile()` — mobile browsers fire
resize on plain scrolling (address-bar show/hide), and re-pinning there would fight the
user's own scroll.

**Canvas backing-store sync:** the canvas's pixel buffer is sized in `init()` (js/core.js)
and *re-checked on every `draw()` frame* against `clientWidth/Height × dpr` (rounded ints,
same basis in both places — a fractional `getBoundingClientRect` would disagree and
re-clear every frame). The per-frame check exists because iOS fires `resize` mid
browser-bar slide: `init()` alone could bake the buffer at a height the canvas only passed
through, after which every frame draws squeezed onto the stale buffer and its bottom band
keeps old pixels forever (seen on device as a ghost second row of year-axis labels and
crushed dot strips on scroll-up). Never size the buffer only from resize events.

Most of the page needed nothing: `.graphic-col`/`#canvas` are already full-viewport, the
canvas is DPR-aware, `SBB`/`SBB_TIMELINE` are fractions, every fold's Y is scaled from the
982px `GROUPS_FRAME_H`, the SVG dash frames measure live, and input is Pointer Events
throughout. What the breakpoint actually changes:

| Value | Desktop | Mobile |
|---|---|---|
| `--card-w` (`style.css`) | 480px | `min(480px, 100vw - 48px)` |
| `.text-section` gutter | 48px | 24px |
| `.section-title` | 20px | 16px |
| `.page0-title` (hero) | 42px, `top: calc(50% - 276px)` | 32px, `top: calc(50% - 240px)` — the top compensates for the 3 lines shrinking ~36px, holding the tuned title/subtitle dot-column gaps |
| `.text-card-frame` padding | `21px 29px` | `16px 22px` (holds the 1.38 h:v ratio); exception: @fold11's title frame (`.page9-title-row`) runs `padding-block: 8px` — its single short line read as an oversized fill at 16px. The subtitle's `-8px` margin-top is derived from it (gap − 10) |
| camp header → top swatch row (`js/update-groups.js`) | `FOLD4_HEADER_GAP` 44 frame-units center-to-center, `H`-scaled | `FOLD4_HEADER_GAP_MOBILE_PX` — a flat **24px visible** gap, measured off the header's rendered height |
| camp gap (`campCenterGapPx`, `js/groups.js`) | flat 160px half-gap | a fixed **80px visible** gap between the blocks' facing edges (`FOLD2_CAMP_EDGE_GAP_MOBILE_PX`), i.e. a 92px half-gap at the 4-wide shape — chosen by eye |
| `.group-label` | 18px, `nowrap` | 16px, wraps, `width: max-content` + `max-width: 100px`, `direction: rtl` |
| group-label font-size (inline, `js/update-groups.js`) | 18 column / 14 legend | 16 column / 12 legend — via `groupLabelColumnFontSize()` / `groupLabelLegendFontSize()` |
| @fold3 row pitch (`fold3RowPitch`) | 32px | measured — tallest wrapped label + 14px (`FOLD3_ROW_LABEL_GAP_PX`, mobile only; desktop keeps 16) |
| @fold7 legend row pitch (`fold6RowPitchPx()`) | 24px | measured — tallest wrapped legend label + 6px |
| Mini-legend + ACLED note | Six DOM group rows over the canvas; the note sits above their top row | **Both collapse into the מקרא bar** — camp names pinned top, legend + note in a drop-down panel; the six rows fly into the button at `@fold4`. See [Groups-and-Legend](Groups-and-Legend.md#the-mobile-מקרא-bar) |
| `#page-11` frame / title | 450px / 40px | `min(450px, 100vw-48px)` / 28px |

**The camp gap is the load-bearing one.** `FOLD2_CAMP_CENTER_GAP_PX` (160) puts two 104px
blocks *plus* @fold3's outward-trailing labels at ~500–600px of required width. Everything
that positions a camp — the @fold2 grid, @fold3's `campFold3X` column, and both camp
headers — now goes through `campAnchorX`, which reads `campCenterGapPx(W)`. Never
reintroduce a direct `W/2 ± FOLD2_CAMP_CENTER_GAP_PX` at a call site; the headers would
detach from their blocks on a phone.

**An inline style beats the stylesheet.** `updateGroups()` writes
`label.style.fontSize` on every frame, so the mobile `.group-label { font-size: 13px }`
rule was silently overridden and @fold3's labels rendered at the desktop 18px, wrapping
to three lines inside a 32px row pitch. Both sizes now come from
`groupLabelColumnFontSize()` / `groupLabelLegendFontSize()` (`js/groups.js`) — **the
single source of truth. Never re-inline the numbers at the call site.**

**Wrapped labels need a measured row pitch.** Once labels wrap, the flat pitches
(`FOLD3_MIN_ROW_PITCH_PX` 32, `FOLD6_ROW_PITCH` 24) print rows over each other. `fold3RowPitch`
(`js/update-groups.js`) and `fold6RowPitchPx()` (`js/groups.js`) take `Math.max(flat,
tallest measured label + gap)` and then re-center the row block on the span the *incoming*
layout occupies (@fold2's own grid, in `fold3RowPitch`'s case) — rows grow downward off a
top anchor, so a widened pitch would otherwise drag the whole group down. On desktop the
labels measure under the flat value and @fold2's row pitch is the same 32, so `max` leaves
both at exactly their tuned numbers and nothing shifts. On mobile @fold2's pitch is 29, so
the column lifts by half the difference — the surviving rect must not appear to jump when
the column forms.

**`width: max-content` on the mobile `.group-label` is load-bearing.** `.group-item` is
`position: absolute` with no width, so an absolutely-positioned child with only a
`max-width` shrink-to-fits against a ~0-wide containing block and collapses to its longest
word (~35px, four stacked lines). It also makes the hidden measuring span agree with what
actually renders, which the pitch math above depends on.

**The label cache is the subtle one.** `groupLabelWidth()` (`js/groups.js`) caches measured
widths per color, and @fold3's column placement is derived from them — but the breakpoint
changes the label's font-size and wrapping, so `js/bootstrap.js`'s resize handler clears
`groupLabelWidths`/`groupLabelHeights`/`groupLabelInkShifts` unconditionally.
(`groupLabelHeight()` keys per color, per font-size **and** per wrap cap, because the
column and the smaller mini-legend ask at different sizes and different caps — see
[Groups-and-Legend](Groups-and-Legend.md).) The hidden measuring span carries
the real `.group-label` class, so the wrapped width feeds the layout math automatically.

**Wrapped Hebrew needs both `direction` and `text-align`.** The document is `dir=ltr`, so
a label's *paragraph* direction is LTR even though its characters lay out RTL by bidi. On
desktop's single `nowrap` line that is invisible; once the labels wrap it breaks the run
in the wrong place and left-aligns the short lines. `direction: rtl` on the mobile
`.group-label` fixes the breaking. Alignment can't live in CSS with it, because it depends
on which side of the swatch the label currently sits on — the box is only as wide as its
longest line and is anchored on the edge facing the swatch, so swatch-first labels
(@fold2/@fold3's columns, the right legend column) must be flush **right** and the
label-leading left legend column flush **left**. `updateGroups` writes it inline off the
same `sideT` that drives the side-swap, snapped at 0.5 (`text-align` has no in-between).

`--card-top` and every `.text-section` `min-height` use **`vh`, never `dvh`**: on mobile
`vh` is pinned to the large viewport for the whole session, while `dvh` re-resolves each
time the URL/bottom bar collapses — which resized every section, shifted every later
fold's `offsetTop` by hundreds of px under a fixed `scrollY`, and threw the reader
backwards through folds 8–10 (the timeline date alone jumped ~10 months per collapse).

### No horizontal scroll, and no `overflow-x` guard

Neither page has an `overflow-x` rule on `html` or `body`, and one must not be added.
Both documents genuinely fit their viewport from 320px up — verified by measuring
`scrollWidth` at eight widths across the full scroll of each page (the recipe is in
[Dev-Workflow](Dev-Workflow.md#checking-mobile)). Clamping with `overflow-x: hidden` would
make that measurement useless and hide the next regression.

Three fixed-width things were what actually overflowed, each fixed at the element:

| Element | Was | Now (≤600px) |
|---|---|---|
| `.shk-utility-inner` (`trigger.css`, the article masthead) | `position: absolute; left: 24px` + 48px padding ⇒ 353px wide | static, wrapping flex row, 16px padding |
| `.page9-tray-row` (`style.css`) | 5 fixed grid columns of 20px pills | `display: contents`; all 10 pills form one `nowrap` horizontally-scrolling row on `#page9ZoneBelow`, 16px pills, one line — see [Folds](Folds.md) |
| `.page9-tray` (`style.css`) | bottom sheet: `bottom: 0`, slides up from below | band at `top: 112px` under the title card, slides down from above, no `.page9-tray-title`, rule on the bottom edge only; the docked tooltip frame drops below it (`p9TooltipDropTrigger`) — see [Folds](Folds.md) |
| `.page9-title-row .text-card-frame` (`style.css`) | title box centered by `margin: 0 auto` | centered while scrolling, then flushed right **in `.is-stuck` only** — a measured `translateX(--p9-title-flush)` (`page9UpdateTitleFlush`, `js/page8-9-scroll.js`), side padding zeroed alongside it — see [Folds](Folds.md#fold10s-tray-on-mobile) |
| `.page0-title` | flat `width: 185px` from `calc(50% + 8px)` | `min(185px, 50vw - 20px)` |

The article page is **RTL**, so its overflow ran off the *left* edge — `scrollWidth` still
catches it, but a check that only looks at `right > vw` does not.

Folds 8–10 are **not** adapted yet — see [Folds](Folds.md).
