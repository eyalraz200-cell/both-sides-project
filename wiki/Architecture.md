# Architecture

## One entry point

**`index.html`** — the scrollytelling experience, served at the site root. Everything in
this wiki is about this page. It pulls Assistant from Google Fonts and declares the two
local Hadassah faces (`@font-face` in `style.css`).

> **Removed — don't reintroduce:** the שקוף article/home page (the old `index.html` +
> `trigger.css` + `images/protest.webp`, `related-knesset.jpg`, `related-march.jpg`) that
> used to front the project behind a `.shk-cta-button`. The root URL is the project now; `project.html` is a redirect stub to the root that
> keeps old shared links alive — never put content in it.

## Search / discoverability

The site is served by GitHub Pages at `https://eyalraz200-cell.github.io/both-sides-project/`
(no `CNAME`). The page carries a `<title>`, a `<meta name="description">`, a
self-referencing absolute `<link rel="canonical">`, the OG/Twitter card set, a favicon and
`lang="he"`. `robots.txt` (allow-all + the `Sitemap:` line) and `sitemap.xml` (both URLs)
sit at the repo root; `index.html` also carries a JSON-LD `NewsArticle` block whose
headline, author and date **mirror the visible `<h1>` and `.shk-byline`** — change one and
change the other, or the markup contradicts the page.

Two things that are easy to get wrong here:

- **`og:description` is not a search description.** Google ignores it and writes its own
  snippet unless a real `<meta name="description">` exists. Both are present on purpose.
- **Do not add `.nojekyll`.** Its absence is load-bearing: Jekyll refuses to serve any
  path beginning with `_`, which is exactly what keeps every `_debug-*.js` out of
  production. See the comment in `index.html`.

`index.html` is a canvas app: a crawler sees its ~16 `.section-title` scroll cards and
nothing else, since all 14,451 events are painted. Anything that must be findable has to
exist as real markup on the page (the `.a11y-only` `<h1>`, the `<meta name="description">`).

## `index.html`'s layout

```
.layout
├── .graphic-col          z-index 0 — its own stacking context
│   ├── #canvas           full-viewport canvas; all dot/square/axis rendering
│   ├── #page0DotsOverlay @fold1's fixed decorative dot columns
│   └── #fold6SquaresOverlay  the 8 sample squares
├── #groupsOverlay        z-index 0, mobile 1003 — the 6 persistent group DOM nodes (see Groups-and-Legend)
├── #page9Tooltip         shared event tooltip (page7 + page9 + @fold7's demo)
├── #page9CatTooltip      tray-pill tooltip
├── #fold6NoteLayer       z-index 2 — the ACLED source note is reparented here at init
├── #fold6MobileLegendLayer  z-index 3 — the mobile מקרא bar (Groups-and-Legend)
└── .text-col             NO z-index (see below) — the 16 <section.text-section> scroll drivers (`#page-0` … `#page-16`)
```

**`.graphic-col` traps z-index.** Anything that must stack above `.text-col` has to be a
direct `.layout` child, not nested inside `.graphic-col` — that's why the event
tooltip, the category tooltip, the ACLED note layer, @fold7's fake cursor (`.fold7-cursor`, z-index 1006, appended by js/groups.js) and **`#groupsOverlay`** live where they
do. The groups moved out so the mobile stack could be **bar → groups → title blocks**; the
overlay is `position: fixed; inset: 0`, so nothing about where its rows land changed, and it
sits before `.text-col` in source order so its desktop `z-index: 0` still paints under the
cards exactly as it did from inside the column. Without it
the ACLED link was unclickable, the category tooltip lost to the tray, and the mobile
docked event frame was untappable (every touch landed on `section#page-9`, so the
עוד toggle looked dead). Don't "tidy" them back inside.

**`.text-col` carries no `z-index` on purpose.** Being positioned, it already paints above
`.graphic-col` on tree order; leaving it `auto` keeps it from opening a stacking context,
which is what lets `.text-card` lift itself (to 4) above the מקרא bar's layer on mobile.
Add a `z-index` here and every descendant gets trapped under that layer again.

## Scripts and shared globals

Loaded as plain `<script>` tags, in this order (`index.html`):

```
squareboundingbox.js → page1.js → page7.js → page8.js → page9.js → page12.js
→ js/core.js → js/nav.js → js/fold1-intro.js → js/page7-scrub.js
→ js/fold8-tooltip.js → js/groups.js → js/update-groups.js
→ js/intro-gate.js → js/page8-9-scroll.js → js/fold11.js → js/bootstrap.js → reload.js
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
| `js/fold1-intro.js` | @fold1 title scroll-lag, page-load entrance (the old logo fade timing still paces its end; `page0LogoEl` is null) |
| `js/page7-scrub.js` | `#page-9` scroll→date scrub + its scroll listener |
| `js/fold8-tooltip.js` | @fold7's tooltip typewriter demo (`fold8*` state + fns) |
| `js/groups.js` | `GROUPS` roster, fold2 grid tables, `groupItems` DOM, FOLD6 square tables/elements, title-card refs, `makeTrigger`, **all fold triggers**, `watchCardThreshold` + checkers, legend/fold4/fold6-note constants |
| `js/update-groups.js` | The `updateGroups` monolith, `layoutGroups`, groups/axis scroll wiring |
| `js/intro-gate.js` | The work-in-progress gate — holds @fold1's entrance until the notice is dismissed |
| `js/page8-9-scroll.js` | page8 title-center hold, page9 sticky/title scroll |
| `js/fold11.js` | Outro morph (`updateFold13`) + the scroll gate |
| `js/bootstrap.js` | Font-load bootstrap + resize handler — **must load last** |
| `page1.js` | `drawPage1` + the @fold1 decorative dot-column builder |
| `page7.js` | The pinned real timeline: per-event square cascade + canvas year axis + hover |
| `page8.js` | Bridge glide from timeline layout → page9's legit grid |
| `page9.js` | Drag-and-drop categorization + dot-migration animation |
| `page12.js` | `drawPage12` outro background; `p12ShareInit` fills **@fold16's** share block (`#page-15`) — not the @fold17 outro card (called from `js/bootstrap.js` after fonts load) |
| `squareboundingbox.js` | Shared grid geometry (`SBB` — only `.top` is read, `SBB_TIMELINE`, `CENTER_GAP`) |
| `reload.js` | Dev-only mtime poll → auto page reload |
| `server.py` | Local dev server + xlsx → `events.json` generation |

## The work-in-progress gate

A first-time visitor lands on a darkened page behind a one-button notice
(«הפרויקט נמצא בתהליך עבודה…» / «הבנתי, להמשך הפרויקט») and presses through it
before anything plays. Markup: `.shk-gate` at the foot of `<body>`
(`index.html`); behaviour: `js/intro-gate.js`; styling: the `.shk-gate` block
at the end of `style.css`.

- **@fold1's entrance is held, not restarted.** `js/bootstrap.js` hands
  `playPage0Entrance` to `shkGateWait()` instead of calling it; the gate runs the
  queued callback `SHK_GATE_FADE_MS` (240ms) after the button, once the backdrop
  has finished clearing. That constant **mirrors the `.shk-gate` opacity
  transition in `style.css`** — change one and change the other. With no gate,
  `shkGateWait` runs its callback synchronously, exactly as the bare call did.
- **Scroll is locked** via `html.shk-gate-open { overflow: hidden }` on both
  `html` and `body`, plus a `scrollTo(0, 0)`. Not a scroll listener: every fold
  is a function of scroll position, so letting the document move behind the gate
  would burn through folds nobody saw.
- **Once per browser.** `localStorage["shk-gate-seen"]`. The flag is read twice —
  by `js/intro-gate.js`, and by an **inline `<head>` script** in `index.html`
  that adds `.shk-gate-seen` to `<html>` before first paint so a returning
  visitor never sees the notice flash. Keep the two key names in sync.
- **The button is inside the frame**, under the sentence — the notice is one
  title block, not a card with a control parked below it. It is @fold16's
  dark-fill share button (`.page12-share.is-filled`): `#111` fill, `#fff` text,
  a 1.5px `#111` edge, `#444` on hover over 180ms, set in the 14px Assistant the
  mini-legend and `.p7-scope-btn` use. The `dark` and `min` styles swap it for
  the outline half of the same button (white edge, fills white on hover), and
  re-state `color: #fff` **on the `<h2>`** — `.section-title` sets `color: #111`
  there, so a colour inherited from the frame never reaches the text.
  Nothing is focused on open: a programmatic `focus()` paints `:focus-visible`
  for mouse users too, ringing the filled button in a second black outline.
- **Four looks**, switched by `data-gate-style` on `.shk-gate`: `doc` (default —
  the piece's own dashed title card, `.section-title` + `.text-card-frame`, so
  `updateTextCardFrameDashes()` draws its dash for free), `dark` (inverted card),
  `squares` (light card under the six group colours **growing** in — never
  fading, per the dot rule) and `min` (no card; text on the darkened page). Each
  ships its own `--gate-dark` / `--gate-blur` backdrop defaults.

## Page dispatch

```js
// index = HTML page id (`page-N`); @fold(N+1)
const PAGES = [drawPage1,      // 0  @fold1
               drawBackground, // 1  @fold2
               drawBackground, // 2  @fold3
               drawFoldSplit,  // 3  @fold4
               drawBackground, // 4  @fold5
               drawBackground, // 5  @fold6
               drawFold7,      // 6  @fold7
               drawFold9,      // 7  @fold8
               drawPage7,      // 8  @fold10  — the pinned timeline
               drawPage7,      // 9  @fold11 — the size grid
               drawPage8,      // 10 @fold12 — owns the glide
               drawPage8,      // 11 @fold13 — the glide plays over it
               drawPage9,      // 12 @fold14 — drag-and-drop
               drawPage12,     // 13 @fold15
               drawPage12,     // 14 @fold16
               drawPage12];    // 15 @fold17
```

17 slots, one per `.text-section`, in `js/core.js`.

`setActivePage(page)` is driven by an `IntersectionObserver` with
`rootMargin: "-50% 0px -50% 0px"` — i.e. a section becomes current when it crosses the
viewport's vertical midline. It also handles the cross-fold handoffs:

- `>=6 → <6` (leaving @fold7 or later for @fold6 or earlier): `p7ResetForReplay()` —
  backstop only; the normal wipe happens in `drawFold7`/`drawFold9` once the reverse
  cascade finishes (see [Timeline](Timeline.md))
- `11 → 12` (@fold13 → @fold14) while the glide is still mid-flight: seeds `p9.anim` from
  `p8CaptureBlendedPositions(W, H, 0)` (`plainGlide: true`, plus `fromSQ: p7.SQ` — page8
  shrinks the dots across the glide, so drawPage9 must keep lerping the size or they snap
  small at the handoff and the flight reads as dimmer)
- `10|11 → 8` (@fold12/@fold13 → @fold10) while the glide has started: seeds `p7EntryAnim`
  from `p8CaptureBlendedPositions(W, H, 1)`

Both seed the glide's **endpoint** positions with a back-dated `start`, never the current
blended position with the remaining duration — see [Timeline](Timeline.md#handoff-to-page8page9).

It then sets `currentPage`, and calls `updateGroups()` and `draw()`.

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
it MUST observe with `{ box: "border-box" }`, not the default content-box: @fold14's
mobile `.is-stuck` transition animates *padding*, which moves the border box while the
content box stays put, so the default observer never fired for it. With the observer
silent, a mid-stuck re-bake (iOS address-bar `resize`) froze the stuck-size viewBox in,
and on scroll-back-up the dash faded back in stretched across the wider un-stuck frame
while the white fill tracked the real box — fill leaking outside a distorted stroke.

`.section-title`'s base rule (`font: 300 20px/1.5 'IBM Plex Sans Hebrew'`, Google Fonts,
weight 300 only — request another weight in `index.html`'s font link before using it) is
shared by **every** card. No page overrides its font-size or weight — with **one named
exception: @fold17's credits card, `#page-16 .section-title`, is 40px on desktop and 28px
under the 600px breakpoint** (`style.css`), because it is the piece's closing headline over
a near-viewport-tall card, not a caption. Any other title that looks differently sized at
the same viewport width is a regression. The face was picked by eye in the
`_debug-title-font.js` compare harness (David Libre, Miriam Libre, IBM Plex Sans Hebrew,
Assistant, vs. HadassahFriedlaender Thin); that harness is still wired in for revisiting.
**Going back to Hadassah:** `font: 100 20px/1.5 'HadassahFriedlaender', serif` on the rule, and
preload `"100 16px 'HadassahFriedlaender'"` instead of Plex in `js/bootstrap.js` — the steps
are spelled out in the comment above `.section-title` in `style.css`.

**@fold1's hero title** (`.page0-title`, `style.css`) and its subtitle (`.page0-subtitle`, was Assistant 300) are IBM Plex Sans Hebrew 300 too — the
same face and weight as the cards (was HadassahFriedlaender 400). Its `top` (desktop and the
≤600px block) is solved for the font's metrics, so re-solve it with `_debug-hero-title.js`
whenever the face changes. **Desktop hero (baked 2026-09-22):** title 48px/1.17, width 172, `left: calc(50% + 6.5px)`,
`top: calc(50% - 281.6px)` (last baseline 22px above its dots); subtitle 16px/1.73, width 106,
`left: calc(50% - 8px)`, `top: calc(50% - 189.8px)` (20px). On desktop the subtitle wraps by
width — its `<br>`s are hidden (`@media (min-width: 601px)`) and each has a real space before it
in `index.html`; phones keep the `<br>`s and the pre-bake left/width/size, pinned in the ≤600px
block. HadassahFriedlaender's `@font-face` rules stay in `style.css`
for going back.

The 600px breakpoint drops it to **16px** — that's a width override applied
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

One breakpoint, **600px**, declared in two places that must stay in sync: `MOBILE_BP` /
`isMobile()` (`js/core.js`), `@media (max-width: 600px)` (the block at the end of
`style.css`).

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

**A height-only resize on mobile skips the relayout entirely.** A phone fires
`resize` continuously while its URL/bottom bar slides, and the handler's work — a fresh
full-viewport canvas backing store, every page-0 dot element rebuilt, six labels
re-measured — stalls the main thread long enough that the browser abandons the collapse and
snaps the bar back, so it appeared to "refuse to collapse" on every scroll after the first.
`js/bootstrap.js` compares `window.innerWidth` against the previous resize: under
`isMobile()`, an unchanged width means bar movement and the handler does nothing but
`draw()`. Nothing is lost — scroll geometry is `vh` (fixed on mobile, it does not track the
bar) and `draw()` re-syncs the canvas backing store on every paint anyway. A width change
is a real rotation/breakpoint crossing and still runs the full handler. The timeline's
layout cache applies the same rule: `p7UpdateLayout` (page7.js) returns early on mobile
when only `H` changed, so the solved square, rows and corridor never re-solve on a bar
slide — the dots would otherwise visibly resize on every scroll that moves the bar. The
field still re-centres because `p7VertTopY` reads the live height each paint.

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
| `.section-title` | 20px (`#page-16`: 40px) | 16px (`#page-16`: 28px) |
| `.page0-title` / `.page0-subtitle` (hero) | title 42px/`1.31`, `top: calc(50% - 276px)`; subtitle 18px/`1.52`, `top: calc(50% - 189.1px)` | title 32px/**`1.45`**, `top: calc(50% - 228.6px)`; subtitle 18px (unchanged) /**`1.465`**, `top: calc(50% - 168.8px)` — baked 2026-09-12. **Mobile overrides the leading too, and must.** `line-height` is unitless, so dropping the title to 32px alone took its leading to 41.92 against the subtitle's unchanged 27.36: the desktop **2:1 nest** (55.02 / 27.36 = 2.011) that locks the two baseline grids fell to 1.532 and the subtitle's lines walked against the title's by ~12.8px per line down the block. The shipped pair is 46.4 / 26.37 = **1.760**, ~6.3px per line — picked by eye against live baseline rulers, not solved to a whole ratio. Each `top` is solved so that text's **last baseline** sits a trimmed gap above its own dot column (title 18.5px, subtitle 20.5px); the `50%` cancels viewport height out, so only the 390px width it was tuned at matters. **Leading and `top` are one setting** — move either and re-solve the other |
| `.text-card-frame` padding | `21px 29px` | `16px 22px` (holds the 1.38 h:v ratio); exception: @fold14's title frame (`.page9-title-row`) runs `padding-block: 8px` — its single short line read as an oversized fill at 16px. The subtitle's `-8px` margin-top is derived from it (gap − 10) |
| camp header → top swatch row (`js/update-groups.js`) | `FOLD4_HEADER_GAP` 44 frame-units center-to-center, `H`-scaled | `FOLD4_HEADER_GAP_MOBILE_PX` — a flat **24px visible** gap, measured off the header's rendered height |
| camp gap (`campCenterGapPx`, `js/groups.js`) | flat 162px half-gap | a fixed **90px visible** gap between the blocks' facing edges (`FOLD2_CAMP_EDGE_GAP_MOBILE_PX`), i.e. a 97px half-gap at the 4-wide shape — chosen by eye. **@fold3 has its own**, `FOLD3_CAMP_EDGE_GAP_MOBILE_PX` **82**, lerped from @fold2's over `alignT` — see below |
| `.group-label` | 18px, `nowrap` | 16px, wraps, `width: max-content` + `max-width: 100px`, `direction: rtl` |
| group-label font-size (inline, `js/update-groups.js`) | 18 column / 14 legend | 16 column / 12 legend — via `groupLabelColumnFontSize()` / `groupLabelLegendFontSize()` |
| @fold3 row step (`fold3RowStep`) | 34px flat (`FOLD3_ROW_PITCH_DESKTOP_PX`, inside `updateGroups`) | per row: this row's tallest wrapped label + **13px** (`FOLD3_ROW_LABEL_GAP_PX`), floored at 32 (`FOLD3_MIN_ROW_PITCH_MOBILE_PX`) — equal visible gaps. Both mobile numbers are module-scope `var`s at the top of js/update-groups.js so a manual/ harness can drive them live; the desktop pitch deliberately stays a function-local `const`, so raising the mobile gap cannot reach it |
| @fold7 legend row pitch (`fold6RowPitchPx()`) | 24px | measured — tallest wrapped legend label + 6px |
| Mini-legend + ACLED note | Six DOM group rows over the canvas; the note sits above their top row | **The legend collapses into the מקרא sheet** — a **full-bleed bottom sheet** (`FOLD6_MLEGEND_POSE = "sheet"`, js/groups.js), not a floating corner card, whose title row is the מקרא button; the six group rows fly into it at `@fold4` and it **closes itself** shortly after they land. The ACLED credit lives **inside** the sheet as a collapsible «איסוף הנתונים» section (`fold6MobileDataHeadEl` / `fold6MobileDataBodyEl`) — **removed, don't reintroduce:** the bare `acleddata.com` link that used to sit in the opposite top-left corner. See [Groups-and-Legend](Groups-and-Legend.md#the-mobile-מקרא-bar) |
| `#page-16` (@fold17, the credits card) frame / title | sized from the viewport edges: `height: calc(100vh - 96px)` (48px gap top and bottom), width solved in JS by `p12CardWidthFit()` (page12.js, at load, on `document.fonts.ready` and on a debounced resize) — the narrowest width in 320–900px at which the copy still clears the bottom padding, which is also the width that FILLS the fixed height, since a narrower column is a taller one; the CSS `width: 520px` is that answer for a 982px-tall viewport and the fallback if the script never runs. 40px side padding, 42px top/bottom, copy vertically centred in whatever height is left over (`#page-16 .text-card` is `fit-content` so it stays centred) / 40px | `min(450px, 100vw-48px)` border-box, height auto / 28px |

**The camp gap is the load-bearing one.** `FOLD2_CAMP_CENTER_GAP_PX` (162) puts two 104px
blocks *plus* @fold3's outward-trailing labels at ~500–600px of required width. Everything
that positions a camp — the @fold2 grid, @fold3's `campFold3X` column, and both camp
headers — now goes through `campAnchorX`, which reads `campCenterGapPx(W)`. Never
reintroduce a direct `W/2 ± FOLD2_CAMP_CENTER_GAP_PX` at a call site; the headers would
detach from their blocks on a phone.

**On mobile @fold3 runs a tighter gap than @fold2.** By @fold3 the blocks are gone and it's
two label runs facing each other, where the shared 90px reads too wide.
`FOLD3_CAMP_EDGE_GAP_MOBILE_PX` (**82**, picked by eye with a `manual/` harness on
2026-09-12 — 48px of visible corridor on a 390px phone, down from 56) is passed to
`campCenterGapPx(W, edgeGapMobile)` as a lerp from @fold2's value over **`alignT`**, the beat
that flies the rects into their column. So @fold2 keeps its own tuned number, the anchors
never snap, and the camp headers (which ride `campAnchorX` too) stay centred over their camp
throughout. Desktop passes no override and keeps one gap for both folds.

**An inline style beats the stylesheet.** `updateGroups()` writes
`label.style.fontSize` on every frame, so the mobile `.group-label { font-size: 13px }`
rule was silently overridden and @fold3's labels rendered at the desktop 18px, wrapping
to three lines inside a 32px row pitch. Both sizes now come from
`groupLabelColumnFontSize()` / `groupLabelLegendFontSize()` (`js/groups.js`) — **the
single source of truth. Never re-inline the numbers at the call site.**

**Wrapped labels need a measured row pitch.** Once labels wrap, the flat pitches
(`FOLD3_MIN_ROW_PITCH_PX` 32, `FOLD6_ROW_PITCH` 24) print rows over each other. `fold6RowPitchPx()`
(`js/groups.js`) takes `Math.max(flat, tallest measured label + gap)`; `fold3RowStep`
(`js/update-groups.js`) goes one further and sizes each step off that row's own wrapped label (whose first line
sits on the row y, the rest hanging below), so the visible gap is equal between every
pair of rows. Rows grow downward off a
fixed top anchor shared with @fold2 (no re-centering — see Groups-and-Legend). On desktop the
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

**A wrapped label measures by its widest LINE, not its box.** On mobile `.group-label` is
`width: max-content` capped at 100px (140px for the two groups carrying `labelCapMobile`),
so a label that wraps has an `offsetWidth` of exactly the cap while its lines each break
short of it. `campFold3X` centres the camp title over that width, so box-width left the
title visibly off-centre from the ink — worst in גוש השינוי, whose two long labels both run
the 140px cap. `groupLabelWidth()` therefore measures a `Range` over the span's text node
and takes the widest of its per-line client rects (`groupLabelInkWidth()`), falling back to
`offsetWidth` if the API yields nothing. Desktop labels are `white-space: nowrap`, so the
two numbers are identical there and nothing above the breakpoint moves.

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
| `.page9-tray-row` (`style.css`) | 5 fixed grid columns of 20px pills | `display: contents`; all 10 pills form one `nowrap` horizontally-scrolling row on `#page9ZoneBelow`, 16px pills, one line — see [Folds](Folds.md) |
| `.page9-tray` (`style.css`) | bottom sheet: `bottom: 0`, slides up from below | band at `top: 112px` under the title card, slides down from above, no `.page9-tray-title`, rule on the bottom edge only; the docked tooltip frame drops below it (`p9TooltipDropTrigger`) — see [Folds](Folds.md) |
| `.page9-title-row .text-card-frame` (`style.css`) | title box centered by `margin: 0 auto` | centered while scrolling, then flushed right **in `.is-stuck` only** — a measured `translateX(--p9-title-flush)` (`page9UpdateTitleFlush`, `js/page8-9-scroll.js`), side padding zeroed alongside it — see [Folds](Folds.md#fold13s-tray-on-mobile) |
| `.page0-title` | flat `width: 185px` from `calc(50% + 8px)` | `min(185px, 50vw - 20px)` |

RTL blocks overflow off the *left* edge — `scrollWidth` still catches it, but a check that
only looks at `right > vw` does not.

Per-fold mobile state is the table in [Folds](Folds.md#mobile-status).

## Accessibility

What holds today:

- **`index.html` is `lang="he"`** and deliberately has **no root `dir="rtl"`** — the stylesheet declares `direction: rtl`
  per block, and the flex rows that don't (`.page9-zone`, `.page9-tray-row`) would reverse
  their inline order under a root RTL. Setting it is the right end state but needs an
  eyeball pass over @fold14–@fold17 first; the reason is commented at the `<html>` tag.
- **One `<h1>` per document,** `.a11y-only` (every visible heading is an `<h2>` in a
  scrolling title card).
- **`.a11y-only`** (`style.css`, next to the `*` reset) is the off-screen utility: a clipped
  1px box, **not** `display: none`/`visibility: hidden`, which would drop the element from
  the accessibility tree too.
- **`<canvas id="canvas">` carries `role="img"` + an `aria-label`**, and its text
  alternative is `#canvasA11ySummary` — an `.a11y-only` `<section>` right after it, filled by
  `p7BuildDataSummary(data)` at the end of `initPage7` (`page7.js`). The scrolling `<h2>`
  cards are already real DOM, so the argument of the piece is readable for free; the summary
  supplies only what the canvas draws — the camp/group roster (read off
  `FOLD4_COALITION_ROWS`/`FOLD4_CHANGE_ROWS`, so it can't disagree with the legend), the
  per-group and per-category counts, the total, and the date range. **Every figure is derived
  from the loaded `events.json`, never hardcoded** — the xlsx is rebuilt on each server start,
  so a hand-written number would go stale silently.
- **Text contrast clears AA 4.5:1.** The two that didn't were fixed at the declaration and
  carry their ratio in a comment: the ACLED note title `#767676` (was `#949494`, 3.03:1), its chevron `#7a7a7a` (was `#919191`).
  Tooltip fills go through `tooltipFill()` — see [Timeline](Timeline.md).

- **@fold14 is keyboard-operable.** Pills are focusable `role="button"` toggles; Enter/Space
  routes through the same `commitDrop`/`commitDropState` the pointer paths use, with an
  `aria-live` announcer and a `:focus-visible` ring — see
  [Drag-and-Drop](Drag-and-Drop.md#keyboard-path). This is also what makes @fold15–@fold17
  reachable at all without a pointer, since `p13GateLocked()` (`js/fold11.js`) gates
  scrolling on a pill being classified.

## Per-frame cost — the layout-read rule

Anything called from a draw loop, a scroll handler or `updateGroups` runs tens of thousands
of times a second. Two classes of call are forbidden there, both because they force the
browser to flush style/layout:

- **`window.innerWidth` / `window.innerHeight`.** `isMobile()` and `viewportH()` (js/core.js)
  are **cached**, refreshed from the same comparison on `resize`/`orientationchange`. The
  listener is registered in `core.js`, the first `js/` file `index.html` loads, so it
  updates before any other resize handler and no consumer sees a stale value. A mobile
  URL-bar collapse fires resize with the width unchanged, so `isMobile()` correctly holds.
  Never go back to reading `innerWidth` live: it was **14.4% of all CPU** on a throttled
  phone scrolling the early folds — the single largest entry in the profile.
- **Linear scans and DOM measurement** — `GROUPS.find()` per dot, `getTotalLength()` per
  frame, `offsetWidth` per row. Memoise, or hoist out of the loop.

Measured on a 393×852 phone profile at 6× CPU throttle, scrolling folds 1–5: median frame
**27.1ms → ~9ms**, frames over the 16.7ms budget **94% → ~13%**. The fixes, largest first:
cached `isMobile()`; a cache on `p7EventForActorOccurrence` (uncached it ran 3216 times in a
40-step scroll, each a linear scan over several thousand events); hoisting breakpoint reads
out of `p7DrawSideSquares`/`p7OrchestrateRows`/`p7DrawTimelineSquares`; a per-row memo for
the row cursor with one frame-wide timestamp; batching opaque squares into one `Path2D` per
colour; cached `viewportH()` and memoised `fitDashArray()`.

The pinned timeline (@fold10) stays the heaviest fold — ~22ms/frame at 6× throttle — but it is
now dominated by **browser rasterisation of the full-screen canvas**, not by JS: 14,451
squares on a 1179×2556 backing store. Further gains there need a rendering change, not
another micro-optimisation. See [Timeline](Timeline.md) for the draw-loop specifics.


**Resize keeps the reader's place on every breakpoint.** `js/bootstrap.js`'s resize
handler restores `scrollAnchorFrac * scrollMax()` after the relayout. It used to do so
only `if (!isMobile())`. Reaching that line already means the WIDTH changed — height-only
mobile resizes (the URL bar) return early above it — i.e. a rotation or a breakpoint
crossing, and those rebuild a document of a different height (portrait ~20,000px,
landscape ~9,700px). The browser scales `scrollY` down on the way to landscape but never
back up, so with the restore guarded to desktop a phone rotated out and back landed four
folds earlier and stayed there. The fraction is what survives the change of height.
**Removed — don't reintroduce:** the `!isMobile()` guard on that restore.
