# Groups and the legend

## The roster

`GROUPS` (`js/groups.js`) is **6 groups** — camp groups only; no no-camp group appears
anywhere, hero dots included. Any doc claiming 8/10/12 groups is stale.
**Removed — don't reintroduce:** the no-camp groups (אתיופיה, סביבתיים, להט"ב, דרוזים…).

`GROUPS` is the source of truth for colors, labels and the `actor` join key.

**מחנה הימין (coalition column, screen-right), top → bottom:**

| Color | Label | `actor` |
|---|---|---|
| `#F9B624` | תנועות התנחלות באיו״ש | `settlers` |
| `#454545` | מפגינים חרדים | `haredi jews` |
| `#F024FF` | קבוצות ימין לאומיות | `right wing protesters` |

**גוש השינוי (change column, screen-left), top → bottom:**

| Color | Label | `actor` |
|---|---|---|
| `#6B89FF` | מתנגדי הרפורמה המשפטית | `protesters against government` |
| `#FF1A94` | תומכי עסקת חטופים ומתנגדי המלחמה | `peace movements` |
| `#31CE1C` | מפגינים ערבים ישראלים | `arab israelis` |

Row order in **both** columns is the sort of that camp's `fold6.y` values (`legendRow` in
`js/update-groups.js`), not the declaration order of `FOLD4_COALITION_ROWS` /
`FOLD4_CHANGE_ROWS` — those two arrays define camp *membership* only. One consequence:
the order is shared by @fold3's aligned column, @fold4 and the mini-legend, so the rows
never reshuffle past each other on the glide. Reordering a camp = swapping two `fold6.y`
values in `GROUPS`.

**Mobile swaps two pairs.** Under the breakpoint the order is the desktop sort with
`MOBILE_ROW_SWAPS` (`js/groups.js`) applied — מתנגדי הרפורמה המשפטית ↔ תומכי עסקת חטופים
ומתנגדי המלחמה in גוש השינוי, and מפגינים חרדים ↔ קבוצות ימין לאומיות in מחנה הימין — so
mobile reads **תנועות התנחלות / קבוצות ימין / מפגינים חרדים** and **תומכי עסקת חטופים /
מתנגדי הרפורמה / מפגינים ערבים**, top→bottom. Everything that derives the order goes
through one helper, `campRowOrder(camp, mobile)`: @fold3's column (`legendRow`) and the
מקרא panel's rows both call it, which is why the @fold4 fly still lands each row on its own
panel row with none of them crossing. It is a swap of the shared *order*, **not** a second
set of `fold6.y` values — those are the real geometry of the desktop on-canvas mini-legend
(`fold6RowY`), which this must not touch.

The `actor` values are `full_v3.xlsx`'s own lowercase `main_actor` strings, matched
verbatim. All six are present in the data, so every group appears on the real timeline.
The camp membership they imply is duplicated as `ACTOR_SIDE` in `server.py`, which
derives each event's `side` from `main_actor` (the xlsx has no `side` column).
`FOLD4_COALITION_ROWS` / `FOLD4_CHANGE_ROWS` define the camp membership and row order in
JS, **resolved by `actor` through `groupByActor()`** — as is `MOBILE_ROW_SWAPS`. Both
rosters used to name their groups by COLOUR and match with `g.color === c`, a
case-sensitive compare against a hand-retyped hex: re-casing or nudging any value in
`GROUPS` silently returned `undefined` and the camps came back full of holes with no
error. `actor` is already the join key into the data and is never restyled.
`groupByActor` logs an error for an unknown actor but does **not** throw — this is a
classic `<script>`, so an exception at parse time would take every global in the file
down with it.

**There is no `P7_COLORS` object.** The name survives only in stale comments. Colors come
from `p7ActorColor(actor)` = `GROUPS.find(g => g.actor === actor)?.color || "#888"`, so
editing a color in `GROUPS` updates the timeline dots, page8's glide, page9's grid and
every tooltip at once (its desktop fill, its mobile dashed border).

## One persistent DOM set

The 6 groups are **one set of DOM nodes** (`#groupsOverlay`, `groupItems`) continuously
repositioned and restyled from `updateGroups()` as the user scrolls — not per-fold
overlays crossfading. Their whole journey:

**Boot gate.** `.groups-overlay` ships at `opacity: 0`; the `is-active` class that lifts it
is added in `js/bootstrap.js` immediately after the **first** `layoutGroups()`, never at
`js/groups.js` parse time. A `.group-item` has no `left`/`top` until that first layout, so
it resolves to the overlay's own origin — adding the class earlier painted all six rows
stacked in the viewport's top-left corner for the ~70ms that `bootstrap.js` spends waiting
on `Promise.all(document.fonts.load(...))`, a visible flash over @fold1 on every refresh.
`.fold6-square` ships at `opacity: 0` for the same reason — its `.fold6-square-wrap` is
also unpositioned until that layout, and `updateGroups()` rewrites each square's inline
opacity every frame, so nothing has to switch it back on.

1. **@fold1** — 6 of @fold1's decorative dots (~58–70 total, the count derives from the
   viewport height) read their color from `GROUPS` (`buildPage0AllDots`, called from
   `js/groups.js` because `page1.js` parses before `GROUPS` exists). Which slot each group
   sits on is the hand-arranged `PAGE0_GROUP_SLOTS`; hand-placed decorative colors are
   `PAGE0_DOT_COLORS`; everything else falls back to a sequential `PAGE0_PALETTE` walk. See
   [Dev-Workflow](Dev-Workflow.md) for the harness that arranges them.
2. **@fold2** — the dots fly into two 4×3 blocks of plain rects (Figma `279:1342`), no
   labels, no divider. Spacing comes from `fold2ColPitchPx()` / `fold2RowPitchPx()`
   (`js/groups.js`) and **differs by breakpoint**. Desktop pitches are flat px
   — **29px across, 29px down** around the 11px rect, i.e. an 18px visible gap both ways.
   Mobile instead authors the **visible gap** directly at a flat `FOLD2_RECT_GAP_MOBILE_PX`
   = **18px** both ways, so its pitch derives as `18 + CLUSTER_SWATCH_SIZE` = **29px** and
   the block comes out literally square. They're functions rather than consts because
   `isMobile()` lives in `js/core.js`, a *later* `<script>` — nothing in `js/groups.js` may
   read the breakpoint at module scope — and because resize has to re-read it live.
   Only each row's **rightmost** rect is the persistent
   `.group-item`; the other 3 per row are real @fold1 dots flying in as "fillers". Then
   the two camp headers type in on their own beats.
   Which cell each group's own rect occupies is `FOLD2_GROUP_CELL`; **all 18** filler
   cells set the flying dot's color via `FOLD2_FILLER_COLORS` (`js/groups.js`, resolved in
   `assignFold2Fillers`). Both are keyed by **cell**, not by dot — which decorative dot
   lands in which cell depends on the viewport height, and listing every cell means that
   pick never shows: the grid reads identically at any height.
   Both tables are **authored** in the canonical 4-wide reading order, but a cell's live
   `(row, col)` is derived from that flat index and `FOLD2_GRID_COLS` (`fold2CellOf` /
   `fold2GroupCell` / `fold2FillerCells`, `js/groups.js`), so the same 12-cell roster lays
   out at whatever `FOLD2_GRID_COLS` says (4×3 today) without re-authoring it. The filler
   roster is re-derived inside `assignFold2Fillers()`, and `cellColor` matches on the
   authored flat index — **nothing may cache a cell's row/col across a shape change.**
   `assignFold2Fillers` picks in two passes: **by color first** — a cell claims the hero dot
   that already *is* its `FOLD2_FILLER_COLORS` hex — then an evenly-spaced index walk for
   whatever is left, repainting those. The by-color pass exists because a filler is the same
   DOM element in @fold1 and @fold2: without it the spaced walk would grab some other dot
   and repaint it, silently undoing the hand-arranged hero colors. A cell left unlisted
   falls back to its `PAGE0_PALETTE` color.
3. **@fold3** — the 18 fillers shrink away, each surviving rect flies sideways so a camp's
   3 rects line up in one vertical column, then the labels type in
   (`FOLD3_TYPE_ORDER`).
4. **@fold4** — the 6 rects glide into the persistent two-column mini-legend at the screen
   edges, and the camp headers un-type. On **desktop** the group labels then un-type too,
   chained off `fold6Trigger`'s `onSettle` (they are carried in by the glide, so they only
   spell away once the row has landed): the legend's resting state is six bare swatches.
   Hovering either column's hit box (`fold6LegendHoverEls`, geometry written per frame by
   `updateGroups`, `FOLD6_LEGEND_HOVER_W`/`_PAD`) types **every** label back in, both
   columns at once — the legend answers as one object. The two are combined as
   `max(1 - untype, hover)`, never summed, so a hover part-way through the un-type re-fills
   from the count already on screen. The **un-type** runs from opposite ends per column — the
   right column drops its head, the left column its tail — so each dissolves away from the
   screen edge it is anchored to. The **hover re-type** is head-first on both columns; the
   flip is gated on the un-type term winning the `max()`. `FOLD6_LABEL_UNTYPE_MS` 900, `FOLD6_LABEL_HOVER_MS` 420.
  **A hovered dot wins over the legend's hover box** (`fold6LegendHoverSync`, js/groups.js):
  the hover boxes sit over the canvas but the dot hit-test runs on window `mousemove`, so a
  dot right next to the legend used to open both its tooltip and the whole legend. One
  function decides `want = pointerOver && !fold6DotHoverActor`, called from the box's
  enter/leave and from `fold6DotHover` — a dot picked up inside the box drops the legend,
  letting go of it (still inside the box) brings it back. The dot wins **outright** there: its
  own single-row open (`fold6DotHoverTriggers`) is held back too while the pointer is inside a
  hover box, and types in the moment the pointer leaves with the dot still hovered. **Hovering a row's click strip also lights up that group's dots**
  (`fold6LegendHoverActor` + `fold6LegendHoverDimTrigger`, 90ms, js/groups.js): every other
  dot on the canvas dims to `hoverDim(actor)`, the same floor a hovered dot uses, on all
  four dim sites — page7's `p7DrawSideSquares`, page8's bridge (`blendAndDraw`, @fold12),
  page9's `p9PlaceDot`, and the 8 claimed DOM squares in `updateGroups` — as the lowest-priority rule (a hovered dot or pill wins).
  The actor is kept through the fade-out so its dots stay bright while the rest come back.
  A row whose group is **filtered out** (`p7FilterOff`) gets no highlight, and filtering a
  group out under the pointer drops the highlight it had.
  **Hovering a row's click strip
  strikes its label through** (`.is-filter-hover .group-label { text-decoration:
  line-through }`, desktop-only media block) — a preview of the click — and a filtered-out row
  (`.is-filtered-off`) keeps the line for as long as it stays out. Scrolling back up **reverses** the un-type on its own 900ms (`fold6LabelUntypeTrigger.trigger(0)` from the same `onSettle`) — it used to `set(0)`, which put every character back on screen in a single frame and snapped the labels in on the way out of @fold4.
   **@fold8 auto-peeks it**: on @fold8's crossing the legend plays its own hover state
   unprompted — labels type in (the ACLED note stays closed), hold `FOLD9_LEGEND_PEEK_HOLD_MS`
   (2000ms, timed from when the type-in lands), then un-type — so the fold's title line
   about the מקרא demonstrates itself. It drives the same label-hover trigger rather than a
   new one, and is skipped/cancelled while `fold6LegendPointerOver` is true, so a real
   hover during the demo simply takes over. Desktop only. See [Folds](Folds.md).
   **Hovering a DOT opens just that dot's row.** Any per-event square, on any fold whose
   hover layer is live (`p7HoverInit` on @fold9/@fold10 — including the 8 claimed DOM
   squares — and `p9HoverInit` on @fold13) calls `fold6DotHover(actor)` (js/groups.js)
   alongside setting its own `hoveredEvent`. That drives a **per-group** trigger
   (`fold6DotHoverTriggers`, one per actor, also `FOLD6_LABEL_HOVER_MS` 420) which joins the
   same combination in `updateGroups` (js/update-groups.js): `restT = Math.max(untypeVisibleT,
   hoverVisibleT, dotT)`, where `untypeVisibleT = 1 - p9Ease(fold6LabelUntypeTrigger)`,
   `hoverVisibleT = p9Ease(fold6LabelHoverTrigger)` and `dotT` is this row's own eased
   `fold6DotHoverTriggers` value (0 when the actor has none). Only the
   hovered dot's group opens; moving between dots of different groups reverses the outgoing
   row rather than snapping it shut, so the two labels crossfade. `fold6DotHover(null)` on
   un-hover. Desktop only.
   Mobile is unaffected — it un-types inside the glide already. This is the legend's final
   resting state for the rest of the page.
   Once a row's glide has fully landed (`e6 === 1`, desktop only) its label carries `.is-plated`: an
   opaque `var(--bg)` background plus a 4px `box-shadow` spread of the same colour. It is
   the page's own background colour, so it changes nothing visually — it exists purely so a
   label expanding back out on hover **occludes** whatever canvas content it lands on
   instead of tangling with it. It is deliberately off for the whole flight into the legend,
   where the labels travel over the dot grids and a plate would punch a hole in them.

Camp x positions come from the @fold2 grid constants (`FOLD2_CAMP_CENTER_GAP_PX` etc.),
placed symmetrically about screen center in plain px — so they hold at any viewport
width. Only the y values are still read off the `fold4` block in `GROUPS`.

## Mini-legend geometry

```js
const CLUSTER_SWATCH_SIZE = 11;  // @fold3 state — declared up with the @fold2
                                 // grid block, which derives its mobile pitch
                                 // from it at module scope (TDZ)
const CLUSTER_LABEL_GAP = 12;
const LEFT_LEGEND_SWATCH_SIZE = 6, LEFT_LEGEND_LABEL_GAP = 6; // @fold4 state
const FOLD6_LEGEND_INSET_LEFT = 31, FOLD6_LEGEND_INSET_RIGHT = 31;
const FOLD6_ROW_PITCH = 24;
```

Each column is inset from **its own** screen edge, in px (tuned by eye at one viewport —
never converted to vh/vw). Row y's are derived from a single top anchor plus
`FOLD6_ROW_PITCH`, so the three rows can never drift apart:

```js
FOLD6_ROW_FRAME_YS  // the distinct fold6.y values, sorted — used for ROW ORDER ONLY
fold6RowY(g, H)        // → centered anchor + rowIndex * pitch
```

`GROUPS`' per-group `fold6.y` is now read **only** to establish row order. All actual
spacing comes from `FOLD6_ROW_PITCH`. **Desktop centers the 3-row block on the viewport's
vertical middle** (`H / 2 - pitch * (rows - 1) / 2 + rowIndex * pitch`) — the ACLED note
deliberately does **not** factor into the centering (it hangs below the right column; see
the ACLED note section), so there is no `noteShift` anywhere in the row math anymore.

**Mobile (`isMobile()`, ≤600px):** both columns hang off the **top** of the viewport
instead of the vertical center — `fold6RowIndexY` returns
`FOLD6_LEGEND_TOP_MOBILE (24px) + rowIndex * pitch`, with no pitch
re-centering (the rows are anchored at the top, so a widened pitch grows downward). This applies to
the legend for its whole life from @fold4 on, not just @fold6: on a phone the centered
desktop anchor printed the rows over the title card and @fold6's sample squares.

Mobile also tightens the two knobs that made the legend read as floating inboard with
airy rows:

| Knob | Desktop | Mobile |
|---|---|---|
| edge inset (`fold6LegendInsetLeft/Right()`) | 31 | `FOLD6_LEGEND_INSET_MOBILE` = 12 |
| label wrap cap (`groupLabelLegendMaxWidth()`) | none (nowrap) | `FOLD6_LABEL_MAX_WIDTH_MOBILE` = 150 (a `var`, harness-drivable; the real panel wrap width the flight uses is measured live by `fold6MFlyMeasure`, ~118 at 390px) |
| label size (`groupLabelLegendFontSize()`) | 14 | 12 |

**The mini-legend's own mobile look — 12px labels, the 150px cap, the 6px row gap — is
finalized. Don't retune it,** and in particular don't unify it with the @fold3 column state
(16px / `GROUP_LABEL_MAX_WIDTH_MOBILE` = 100) to kill the mid-glide reflow: that trade was
tried and rejected.

The wrap cap is the real lever on the row gap: `fold6RowPitchPx` is
`max(24, tallest measured label + FOLD6_ROW_LABEL_GAP_PX)` with the gap at **6**, so at
@fold3's 100px cap the longest labels wrapped to **three** lines and every row inherited
that height. 150px (each legend column owns a half-width — @fold3's 100px exists because
both camps must fit side by side) drops them to two. Two groups override the column cap:
מתנגדי הרפורמה המשפטית and תומכי עסקת חטופים ומתנגדי המלחמה carry `labelCapMobile: 140` on
their `GROUPS` entries, read by `groupLabelColumnMaxWidth(g)` (per-group, always pass the
group) and applied inline by `updateGroups` and by the hidden measurer, so the pink label
(226px at 16px — three lines at 100px) lands on two lines at @fold3. The blue one (163px)
sits on two lines at either cap, so its override is presently inert but stays wired. The cap is **lerped from the column cap → 150 over `e6`** on the label's inline `max-width` (`js/update-groups.js`), alongside the
16 → 12 font-size lerp, so the text reflows gradually through the glide rather than
dropping a line all at once at the end.

@fold3's pitch is **one knob per breakpoint, nothing else has a vote**
(`js/update-groups.js`). Desktop: a flat `FOLD3_ROW_PITCH_DESKTOP_PX` = **34px** (a 23px
visible gap around the 11px swatch) — no `max()` against label heights, because desktop
labels are nowrap one-liners and a `max()` would mean editing the pitch constant silently
does nothing whenever tallest-label + gap outvotes it. Mobile has no flat pitch at all:
its labels wrap to 1-3 lines with the **first line** on the row y and the rest hanging
below it (`firstLineShift`), so the **visible gap** is the constant instead. Each step
from row *k* to *k+1* is
`max(FOLD3_MIN_ROW_PITCH_MOBILE_PX = 32, rowH(k) + FOLD3_ROW_LABEL_GAP_PX = 13)`
(`fold3RowStep`), where `rowH(k)` is the tallest label at row index *k* across **both**
camps — so the two side-by-side columns keep their rows on shared lines, and the gap
between any two rows is the same whatever their line counts. `fold3RowY` is the prefix
sum of those steps.

**Both folds share one fixed top anchor** — `fold3TopRowY === fold2TopRowY`; each pitch
only spaces its own rows downward from it. **Removed — don't reintroduce:** a
re-centering term (`fold2TopRowY - (fold3RowStep - fold2RowPitchPx()) * rows / 2`) that made
@fold3's whole column, and the header riding `topRowYNow`, move whenever *either* fold's
pitch was edited — worst on mobile, where fold3's pitch is label-height-derived. The anchor
is a position; the pitches are gaps; they must never feed each other.
`groupLabelHeight(g, fontSize, maxWidth)` keys its cache on the cap too — the cap is what
decides the line count it measures.

The note's own width/right edge read the same inset functions, so it stays flush with the
right column at either breakpoint.

## The «הצגת גודל האירועים» button above the right column

@fold11's manual switch for the crowd-size tiers (`p7ScopeBtnEl`, js/groups.js;
`.p7-scope-btn`, style.css; 14px Assistant, **no letter-spacing** — matching `.group-label`'s settled mini-legend type exactly). It is **not a pill**:
borderless text with a **10px ring** 8px to its right (`::before`, `flex-direction:
row-reverse` so the ring lands on the RTL row's right) — empty when off, **filled dark** under
`.is-on`, with no tick inside it (at 10px a checkmark is a smudge, so the fill alone carries
the state). It reads as part of the mini-legend, and it is aligned by its **ring**, not by its box:
the circle's center sits on the swatch column's center line (`W − fold6LegendInsetRight() −
LEFT_LEGEND_SWATCH_SIZE / 2`), which puts the button's `left` at that x minus its own width
plus `P7_SCOPE_RING_PX / 2` (10px, js/groups.js — must stay in step with the `::before`'s
`width`, which is `box-sizing: border-box` because the `*` reset doesn't reach pseudo-elements).
The ring itself is centered on the label's **ink**, not its line box: `--p7-scope-ring-ink`
is `groupLabelInkShift(14)`, the same measurement the legend rows use for their swatches,
applied as a `translateY` alongside the pop's `scale`. And because the label TYPES in, the
button pins `line-height: 17px` / `min-height: 25px` — without it an empty box measures short
and the placement (which subtracts `btnH`) jerked the control 5px upward on the first typed
character. Vertically, `P7_SCOPE_BTN_GAP` (22px) above the **top**
row's centre line **−10px**, all written every frame by `updateGroups` — but it is **not**
a `.groups-overlay` child. The overlay is `pointer-events: none` *and*
`z-index: 0` with its own stacking context, so a button inside it would sit under
`.text-col` and never see a click; the button is a direct `.layout` child at
`z-index: 3` instead (`.fold6-note-link` gets away with living in the overlay
only because `.fold6-note-layer` is a separate `z-index: 2` layer). Appears on @fold11's crossing — the fold whose copy points at it — and it **never fades in**:
the ring **pops** in on `p7Ease` over `P7_SCOPE_RING_POP_MS` (260) and the label **types** in
behind it at `P7_SCOPE_TYPE_MS_PER_CHAR` (22) per character on `p9Ease` (`typedText`), the same
grow-then-type order the @fold7 tooltip uses. One `p7ScopeRevealTrigger` (js/groups.js) fired
from `fold11SizeApply`, its raw progress sliced into the two windows and re-eased fresh, so a
reverse crossing un-types the label and pops the ring back out. **Hover / pressed look:** the ring swells by `P7_SCOPE_HOVER_GROW` px (on top of
its 10px, as a second multiplier `--p7-scope-ring-hover` on the same transform — never a width
change, the button is placed off the ring's box) and the label darkens from 0.81 to
`P7_SCOPE_HOVER_TEXT_ALPHA`, both written per frame by `updateGroups` off
`p7ScopeHoverTrigger` (enter/leave) and `p7ScopeOnTrigger` (flipped where `is-on` is decided),
`P7_SCOPE_HOVER_MS` 180 — the look is `max(hover, pressed)`, so a pressed button keeps it after
the pointer leaves and hovering a pressed one changes nothing. `P7_SCOPE_HOVER_FORCE` holds it
for a harness. Values (manual/-baked 2026-09-16): grow **3.5**px, text alpha **1**; `P7_SCOPE_RING_DY` **-1.5**px lifts the ring against the label (px, + = down), on top of the ink correction. The ring's scale rides a
`--p7-scope-ring-t` custom property written per frame (hence no CSS transition on the
transform), and the typed label is measured *before* the button's right-edge placement each
frame, so the ring holds still while the characters grow leftward. The accessible name comes
from a static `aria-label`, since the visible text is sliced. Then it stays for every fold
after it, fading out with everything else on @fold14's `p9.fold13OutT` clock;
`hidden` before that. Desktop only. Behaviour and what it
toggles: [Timeline](Timeline.md#the-size-grid--p7sizegridset-page7js).

The click is **page-gated** (js/groups.js): `currentPage < 12` → page7's
`p7SizeGridSet(true, {uniform: !p7GridUniform})`; `currentPage === 12` →
page9's own `p9ScopeSet(!p7GridUniform)`, which tiers **both the extreme columns
and the legit strip** on @fold13 (see Drag-and-Drop); any later page → inert. `p7GridUniform` stays the single
source of truth for "tiers showing" on both paths, so the pressed look
(`!p7GridUniform && (p7Grid.on || p9PageVisible())`, js/update-groups.js) is
one formula covering both folds.

## Camp headers

The two headers (`.camp-header`, 18px Assistant 660, `direction: rtl`, base
`opacity: 0`, `transform: translate(-50%, -50%)` set once at creation) type in at @fold2
and **un-type in place** at @fold4. They do **not** travel into the mini-legend — the
legend's columns carry no camp titles. There is no `e6` lerp on their position, size or
weight; see [Folds](Folds.md) for the beat-mirroring mechanism.

The gap down to the camp's top swatch row is measured two different ways. Desktop uses
`FOLD4_HEADER_GAP` (36) as **plain px, header center → swatch center** — fixed, NOT
frame-scaled (per explicit instruction it holds constant rather than multiplying by `H/982`
— ~19px of visible white at any height, the one distance in the scene that must not change
on window resize).
Like mobile, the desktop header is placed off the top row's **current (blended) y**, not a
flat `fold2RowY(0)` anchor. @fold3 runs a slightly larger gap than @fold2 (per explicit
instruction): `FOLD3_HEADER_GAP` (42, same px units), lerped from `FOLD4_HEADER_GAP`
over `alignT` — mirroring the mobile pair below. `fold2HeaderGapDesktop` is just that
lerped constant minus half the swatch; it carries **no**
`fold3RowY(0) - fold2RowY(0)` term — that term was zero when both pitches were 32, and
once @fold3 got its own pitch it went nonzero and shoved @fold2's header. Don't
reintroduce it: the row blend already lives in `topRowYNow`.
Mobile instead sets the **visible** gap directly, and uses two values: `FOLD4_HEADER_GAP_MOBILE_PX` (20px) for @fold2's 4×3 block and `FOLD3_HEADER_GAP_MOBILE_PX` (currently aliased to the same 20px, so the two folds read identically) once @fold3's column has formed, lerped between them over `alignT`, and measured off the top row's own current (blended) y rather than @fold2's flat row-0 anchor — so this gap and `FOLD3_ROW_LABEL_GAP_PX` are independent knobs; before that fix, changing the row gap moved the header gap by the same amount in the opposite direction,
measured off the header's own rendered height: the header line box and the 11px swatch
are both fixed px, so on a phone an H-scaled distance would swing with the URL bar.

## The 8 sample squares

`#fold6SquaresOverlay` holds 8 plain divs (`FOLD6_SQUARE_REST_COLOR` = `#767676`), which:

- **grow in at @fold5** at screen center, taking the cluster's vacated spot
  (`squaresRevealTrigger`); the ACLED note follows on @fold8's card, 0.5 (`acledNoteTrigger` — @fold6, its old home, is hidden for now);
- **gain labels at @fold7** (`FOLD6_SQUARE_LABELS`), while square 0 shows the shared
  `#page9Tooltip` with a real event's date + description, grown and typed on its own
  wall-clock sequence;
- **gain colors and fly at @fold8** — `FOLD6_SQUARE_ACTORS` (via `groupColorByActor`) gives
  each its group color, and `fold6SquareOccurrence(i)` says which chronological occurrence
  of that actor it stands in for. The real cascade never draws those 8 events
  (`p7GetClaimedEvents`), so the DOM square just stays once it lands.
- **shrink with the @fold12 glide** — as page8's blend carries them down to the legit
  band, both position *and size* lerp by the same ease (`js/update-groups.js`): the end
  size is the band's own rule (`legitGeom.cell` in bar mode, else `p9Metrics().legitSq`),
  matching what page8.js uses for canvas dots. On big desktop that's a no-op (legitSq =
  timeline size); on ≤1600 desktop and mobile it is what keeps the squares from landing at
  timeline size and reading as oversized dots on the band.

**All 8 squares are pinned to specific events by id.** `FOLD6_SQUARE_ROW_IDS`
(`js/groups.js`) is the roster — the xlsx's own `row_id` per square, in square order:

| i | col | rowId | date | actor | color |
|---|-----|-------|------|-------|-------|
| 0 | left  | `row-11`   | 2023-01-06 | protesters against government | `#6B89FF` blue — **tooltip square** |
| 1 | right | `row-5`    | 2023-01-01 | haredi jews    | `#454545` grey |
| 2 | left  | `row-7`    | 2023-01-02 | arab israelis  | `#31CE1C` green |
| 3 | right | `row-6`    | 2023-01-01 | settlers       | `#F9B624` yellow |
| 4 | left  | `row-10`   | 2023-01-05 | protesters against government | `#6B89FF` blue |
| 5 | right | `row-6794` | 2023-01-01 | settlers       | `#F9B624` yellow |
| 6 | left  | `row-12`   | 2023-01-06 | arab israelis  | `#31CE1C` green |
| 7 | right | `row-6795` | 2023-01-01 | settlers       | `#F9B624` yellow |

They are **the timeline's 4 earliest events per side** — even indices are the left column,
odd the right, the same convention `FOLD6_SQUARES_OFFSET` lays out. `FOLD6_TOOLTIP_ROW_ID`
is just an alias for `FOLD6_SQUARE_ROW_IDS[0]`, whose text (עשרות פעילים ישראלים, בהם עורכי
דין… פסקת ההתגברות) is what the @fold7 demo tooltip shows.

**A consequence of the "earliest" rule, not a bug:** the opening days are lopsided, so the
right column is 1 grey + 3 identical yellows, and two of the six group colors never appear
among the squares at all — תומכי עסקת חטופים ומתנגדי המלחמה's first event is 2023-02-27 and קבוצות ימין לאומיות's
is 2023-01-10. Swapping indices 5/7 for `row-22` / `row-377` is a one-line roster change if
that ever reads badly.

`FOLD6_SQUARE_ACTORS` must **mirror** the roster's rows: it stays a static array because
`FOLD6_SQUARE_COLORS` is computed from it at parse time, before events.json exists. The
occurrence number the lookups actually need is derived from the loaded data at first use
(`fold6SquareOccurrence(i)` → `p7OccurrenceOfRowId`, `page7.js`) and cached per slot, so
**editing the xlsx cannot silently slide a square onto a neighbouring event** — it
follows the row. Every consumer must go through `fold6SquareOccurrence(i)`, or
`p7GetClaimedEvents` and the tooltip disagree and the real cascade draws a duplicate dot. If
a row is deleted from the dataset the console warns once per id and that square falls back to
the first event of its actor.

`FOLD6_SQUARE_LABELS` must stay in sync with `P9_CATEGORIES` — renaming a category pill
means renaming the label here too.

The squares also dim on hover-elsewhere, mirroring the canvas dots. That needs the
opacity formula in `js/update-groups.js` **and** the `updateGroups()` calls from `page7.js`/`page9.js`
hover handlers to stay in sync — the squares are DOM, outside `draw()`.

## ACLED note

`FOLD6_NOTE_TEXT` (`js/groups.js`) is rendered into `#fold6NoteLayer` with "ACLED" wrapped as a
link. **On mobile the note is not positioned at all** — it is reparented into the מקרא
panel (below) and flows there; everything in this section is the desktop layout.

**Mobile also toggles `hidden` on the note and its rule** (`js/update-groups.js`, right
after the opacity write) while `acledNoteTrigger.currentT()` is 0. Flowing content at
opacity 0 still occupies its full height, so the מקרא frame would open with an empty gap
under the rows before @fold6 has revealed anything. Desktop is absolutely positioned and
reserves nothing, so it stays opacity-only and never sets `hidden`.

On desktop it hangs **below** the right (coalition) mini-legend column (per explicit
instruction; mobile's bottom-of-viewport pin and its `fold9FlyTrigger` fade-out stay
gone). It's anchored to that column's **bottom** row target — the settled label's bottom
edge is computed as `bottom anchor + LEFT_LEGEND_SWATCH_SIZE/2 + groupLabelInkShift(14) +
fold6RowMeasureEl.offsetHeight/2` (the same swatch-half + ink-shift offset the live labels
get) — at `noteRightEdge = W - FOLD6_LEGEND_INSET_RIGHT`, and reveals on
`acledNoteTrigger` (@fold8's card, `#page-7`, at 0.5 — it carries the ACLED copy while @fold6 is hidden) by **typing in** character by character over the
trigger's whole raw span (`FOLD6_NOTE_BEATS`, `js/groups.js`, `p9Ease`). The note is four typewriter
segments (the title / text / the live `ACLED` link / text, `fold6NoteSegments`, each a `fold8SetupTypewriter`
span pair) so the link survives and the 155px block keeps its final wrap from the first frame;
one running character count is walked across all four, so the whole block types as a single
continuous stream — heading first, then the note under it — rather than two things typing at once;
opacity is a hard 0/1 gate (a `min(1, t·4)` ramp was tried and read as a fade). It never fades.

The note sits inside a **card** (`fold6NoteCardEl`, `.fold6-note-card`) that **expands to
the body text**: closed it is just the title row, and it grows as the body types in. The card
is a **sibling painted behind** the title and the body, not a wrapper around them — those two
are absolutely positioned with left/top/width written per frame, and on mobile
the מקרא panel builds its own «איסוף הנתונים» section instead (`fold6MobileDataHeadEl` /
`fold6MobileDataBodyEl`), so wrapping them would have meant redoing both. (Until 2026-09 a
`fold6SyncNoteHome()` re-parented them one by one into the panel — **removed, don't
reintroduce**; see the callout at the foot of this page.) It is appended **first** into `#fold6NoteLayer`, and since everything
in that layer is `position: absolute`, DOM order is paint order — no z-index. Its rect comes
from the same numbers the rule uses: `fold6X - FOLD6_CARD_PAD` / `noteTitleY - FOLD6_CARD_PAD`,
with **no ink trim** (unlike the rule: the card frames the text *box*, so it wants the whole
line boxes; the height itself is built below). It collapses **horizontally** too: closed its
content width is the title row — the title's text, `--note-chevron-gap` (16px), the chevron, and `--note-chevron-inset` (6px) of room from
the card's edge — and it widens to the note's full 155px.

When it **re-opens** (after an un-type, or on hover) it opens in **two steps — height first,
then width** (explicit instruction), and it opens **before any body text exists**. `FOLD6_CARD_OPEN_SHARE` (0.3) gives the card the first 30% of
the body's beat to itself; the text types over the remaining 70%. That share is what buys the
opening its duration, and nothing else can: a body line is the full 155px, so text arriving
while the width is still travelling would hang outside the tint — so the text waits instead.
Within the share, `FOLD6_CARD_OPEN` slices height over 0→0.3 and width over 0.3→1, each
re-eased from its own raw slice; the width gets the longer half, since it is the step meant to
read as an opening.

**The first appearance is different** (`noteCardIntro` — nothing has un-typed and nothing is
being hovered back, i.e. `fold6NoteUntypeTrigger` and `fold6NoteHoverTrigger` both at 0; the
moment either is in play the card really is re-opening from the collapsed pose and the
accordion behaviour above applies).

It **reverses the two steps** — width first, then height (explicit instruction). Nothing has
been collapsed yet at that point, so there is no earlier state for the card to be opening *out
of*: leading with the height would show the title-only pose as though it meant something, and
the card would read as un-collapsing rather than arriving.

And the width there **runs on the title's typing**, not on the body's beat (explicit
instruction): `cardWT` is `p9Ease(titleP)`, so the card widens as the title writes itself and
arrives *with* it. Only the height is left for the body's opening share — which is why
`FOLD6_CARD_INTRO.w` is unused on that path and `.h` gets the whole window. The title's own
height does **not** grow in alongside that (explicit instruction): on this path `titleHP` is a
`0`/`1` flip, so the card takes its full title height the moment there is a character to hold
and does nothing but widen from there. Otherwise the intro would read as both axes at once
rather than width-then-height.

The height step opens **one line** of body, not the whole block. The rest of the height then
**fits the text**, growing with it as it types rather than waiting in an empty box: a line
appears, the card widens to hold it, and from there the card and the text grow together
(`titleH·titleP + (titleGap + lineH)·heightT + (bodyH - lineH)·textP`). Reversed, the card
shrinks back down with the un-typing text and closes on the last of it. The **right** edge is
the fixed one (it hugs the legend's right edge at `noteRightEdge`), so it grows leftward.
The collapsed width needs the title's real text width, which can't be read off
`fold6NoteTitleEl` — that box is a fixed 155px and mid-type holds only some of the characters,
so the card would breathe one letter at a time. An off-screen twin carrying the full title
(`fold6NoteTitleMeasureEl`, same class, `left: -9999px`) is measured instead.
`FOLD6_CARD_PAD` (8px, in `js/groups.js`) is a `let` purely so a `manual/` harness can turn it
live. The look is three custom properties — `--note-card-radius` (16px), `--note-card-border`
(**none**), `--note-card-bg` (`rgba(0,0,0,0.035)`): a `compare/` pass picked the plain tint
over a dashed frame and two hairline-box variants, because a drawn frame competed with the
legend rows above it. Inside the panel the panel is already the frame, so
`.fold6-note-card.is-in-panel` is `display: none`. The card is part of the note's hover target
along with the title and the body.

**The horizontal hairline under the rows is gone** (explicit instruction), replaced by a
**vertical rule** (`fold6NoteRuleEl`, `.fold6-note-rule`) in the same colour and 1px weight
running down the **right** — reading-start — edge of the note block. The note's **text**
takes the legend's right-edge alignment with the dot rows (`fold6X = noteRightEdge - 155`)
and the rule steps **outside** that edge, `FOLD6_RULE_GAP` (8px) further right at
`noteRightEdge + FOLD6_RULE_GAP` — chosen over the mirror arrangement (rule on the dots'
edge, text pushed left) in a `compare/` pass, along with a horizontal-line family under the
title, which lost. Its
`height` is written per frame and **grows and shrinks with the typing**, measured
geometrically rather than as a share of the character count: the title's height is filled by
the title's progress and the body's by the body's, so when the body un-types away the rule
shrinks back to exactly the title's height rather than to nothing. It also runs
`FOLD6_RULE_OVERHANG` (5px) past the last line so it **sticks out at the bottom**; that
overhang scales in with the title's progress so it never pops in ahead of the block. The top
is deliberately NOT trimmed to the letters' cap — trimming to the cap was tried and reverted.
Both ends are trimmed by
the ~3px of transparent leading a 14px/1.4 line box carries, so it spans the text's **ink**
(the 1.4 in `js/update-groups.js` must match `.fold6-note`'s line-height). Desktop only —
in the מקרא panel the note flows full-width with no column edge to run down, so
`.fold6-note-rule.is-in-panel` is `display: none`.

**The rule is currently OFF** — `.fold6-note-rule` is `display: none`, superseded by the card
plus the chevron below (a chevron says "this opens"; a hairline only says "this is a block").
The whole mechanism above is kept intact and comes back by removing that one declaration.

An **accordion chevron** on the title (`.fold6-note-title::after`) is the note's affordance.
It is a pseudo-element so the title's typewriter, which rewrites
the element's own spans every frame, can't disturb it. It is **absolutely positioned on the
card's left edge**, not flowed after the text, so it stays on the frame as the card collapses
and reopens: `--note-chevron-x` is that edge expressed in the title box's own coordinates
(`155 - contentW + inset`), written per frame, and `top: 50%` plus a translate centres it on
the title's line. `--note-chevron-gap` and `--note-chevron-inset` are therefore **not read by
any declaration** — only `js/update-groups.js` uses them, since both decide how narrow the
collapsed card may be. Its colour is its own grey, `#919191`, not `currentColor`: the chevron
is the affordance and the title (`#949494`) is the label, and the two were tuned separately in
a `manual/` pass. The
shape is the two-border square — `border-left` + `border-bottom` rotated `-45deg` reads as a
chevron pointing down; the centring translate and that rotation share one `transform`, since a
second declaration would replace both. Both come from custom properties written per frame by
`updateGroups`. The **rotation runs on the card's width step and nothing else** (explicit
instruction): `--note-open` is `cardWT`, the eased progress of the width window, so the chevron
turns exactly while the card is widening and is still while the height fills with text. It does
*not* track the typing — that read as a slow sweep, and a hard `0`/`1` snap is too abrupt;
tying it to the one beat it belongs to is the middle ground. Because the chevron exists on both
breakpoints, `cardWindows`/`cardOpen`/`cardWT` are computed **above** the desktop-only card
block in `updateGroups`, not inside it. The **fade** is still continuous, from `--note-title-p`
(title typed 0..1), so the chevron doesn't show before its own title has typed.

**Then it un-types itself** — on a scroll crossing, not a timer (explicit instruction): the
note spells itself away **from the end** over `FOLD6_NOTE_UNTYPE_MS` = 900ms
(`fold6NoteUntypeTrigger`, `checkNoteUntype`) on **@fold7's crossing** — the same card and
0.5 fraction as `fold7LabelTrigger` and `fold8SquareDimTrigger` — so the note clears exactly
as the square-labels fold takes over. **The title stays** (explicit instruction), and so does
the rule, shrunk back to the title's height. `fold6UpdateNoteTypewriter` therefore takes
**two** counts, title and body: the title follows the reveal alone, the body follows the
un-type; both are slices of the same running total, so the first type-in still reads as one
stream. **Hovering the mini-legend types the body back** — and so does hovering **the note or
its title**, which are their own hit target (explicit instruction; `.fold6-note` /
`.fold6-note-title` opt back into `pointer-events` inside the otherwise click-through note
layer, and the typewriter keeps the block at full size so the hit area never shrinks; the
**card** is part of that target too). It runs on its **own** trigger,
`fold6NoteHoverTrigger` / `FOLD6_NOTE_HOVER_MS` = **700ms**, rather than the group labels'
`fold6LabelHoverTrigger` (420ms) — explicit instruction: it doesn't have to land with them and
wants more breathing time, there being far more text here than in a label and a card opening
underneath it at the same time. Both triggers fire from exactly the same two places (the
legend columns' hit boxes and the note itself), so hovering either still brings both back;
only the tempo differs. It is combined the same way: the visible count is `min(reveal, max(1 - untype, hover))`, so a hover caught
mid-un-type re-fills from where the count already is. Un-typing from the end is just the
character count running back down — no slice flip (unlike the left legend column's labels).
**Desktop only**: mobile has no hover, so an un-typed note there would be unrecoverable, and
`checkNoteUntype` returns early under `isMobile()`. Scrolling back up re-crosses the
threshold and types it back on its own.

**A title sits over the note** (explicit instruction): `FOLD6_NOTE_TITLE_TEXT` = «איסוף הנתונים»,
`fold6NoteTitleEl` / `.fold6-note-title`. It is deliberately the **same 14px/1.4 box** as
`.fold6-note` — only `font-weight: 660` and a full-black colour separate them — because the
rule's ink trim is measured against that line-height. On mobile it takes the same `hidden`
gate as the note and the rule — the panel carries its own «איסוף הנתונים» section rather
than re-parenting these nodes into it.

The stack reads downward from the bottom row: the **title** sits `FOLD6_NOTE_TOP_GAP`
(**17px**) below the
rows with the note `FOLD6_NOTE_TITLE_GAP` (**4px**) under the title's measured box, and
the rule runs alongside all of it.

The note box is a fixed `FOLD6_NOTE_WIDTH` = **155px** wrap width (`js/groups.js`); in the
mobile panel it has no width at all and fills the panel. It is RTL and right-aligned, so it hugs the rule and extends leftward. Editing `FOLD6_NOTE_WIDTH` re-wraps the
note and changes its height; the legend rows do not move with it — the note just extends
further down. **Removed — don't reintroduce:** a `fold6NoteShiftPx` row pre-shift.

## The mobile מקרא bar — a full-bleed bottom sheet

**Under 600px there is no on-canvas mini-legend.** From `@fold4` on, the legend is a
persistent **full-bleed bottom sheet** flush to the bottom edge of the viewport, closing
into the מקרא button that spans the screen's foot (`js/groups.js`, `.fold6-mlegend`;
`FOLD6_MLEGEND_POSE = "sheet"`). The constant also carries a floating top-right `"card"`
branch — **that is not the shipped pose**; every description below is the sheet.

```
 ╭───────────────────────────────────╮  ← open: bottom edge FIXED to the screen's
 │ ×             מקרא                │     foot, TOP edge rising out of the button
 │ 3 coalition rows │ 3 change rows  │
 │ איסוף הנתונים ⌄                   │  ← the ACLED credit, collapsible, INSIDE
 ╰───────────────────────────────────╯
 ╰───────────────────────────────────╯  ← closed: the same full-width bar, which
              מקרא                        IS the button it grew out of
```

**It is a full-bleed BOTTOM SHEET.** The pose lives behind one switch,
`FOLD6_MLEGEND_POSE` (js/groups.js) — `"sheet"` ships; `"card"` restores a floating card
inset from the top-right. Both branches stay live because this has been moved between them
more than once; the switch drives the edge, the alignment, the edge gap and the overhang
together, with a matching `is-sheet` / `is-card` class for the side gaps and corners.
As a sheet it is flush to the screen's bottom, spans the full width, rounds its top corners
only, and centres מקרא on itself.

The skin is the desktop ACLED note's (`.fold6-note-card`): **a tint, no border**. The tint is
applied **opaque** (`--mlg-fill`, `#F4F3F6`) rather than the note's own `rgba(0,0,0,.035)` —
this card covers the title block and the canvas behind it, and a translucent one let the
dashed frame show straight through, which read as the title sitting on top. Corners are
`--mlg-radius`, **lerped 8 → 20** across the height step by `fold6MLegendPaintCard`: swapping
them on `.is-open` snapped, because that class lands on `pointerdown`, before anything has
moved. The closed button carries a hairline along its top edge
(`0 -1px 0 rgba(0,0,0,.2)`), the open sheet a soft lift (`0 -4px 6.2px rgba(0,0,0,.07)`),
both from the Figma sheet (345:2295 / 342:1891).

**Everything inside it lines up on the group cards' box** — `--mlg-content-inset` (16px, the
bar's own side padding plus the rows panel's). The one exception is the hairline under the
title, which is **full bleed** (the card's `::before`, 45px down): it closes off the title
band, so it reads as the sheet's own rule rather than as content. Both rules share
`--mlg-rule` and `--mlg-rule-w`.

*Removed — don't reintroduce:* the **grab handle** on the title
(`.fold6-mlegend-btn::before`, a 28×1.5px `#d4d3d8` pill) and the chevron judged against it;
`.fold6-mlegend-tab` / `fold6MobileTabEl`, the pill as a separate element joined to the
card's top edge like a tab; and the **camp headings** inside the panel
(`.fold6-mlegend-camp`) — which is also what takes the two on-canvas camp headers out of the
`@fold4` flight, since their targets are built from that map.

**The page behind it is dimmed while it is open** (`.fold6-mlegend-veil`,
`fold6MobileVeilEl` — first child of the layer, so it paints under the card and over
everything the layer already out-stacks). Picked in a `compare/` pass: the veil is a
**darkened page ground** (`rgba(40,36,52,.35)`) rather than neutral black, which cast the
warm `#FDFCFF` page grey, and there is **no backdrop blur** — it lost, and it would cost a
full-viewport filter over a canvas that repaints every frame. Its opacity rides the card's
**raw** progress, not the height step, so it starts darkening the moment the card moves,
including under a finger mid-drag. `pointer-events` stay off: a tap outside the card
already closes it, and a veil that ate that tap would break it. **The six group rows are `#fff`**, not the tint they used to carry: the card
behind them is that tint now, and tint-on-tint left six invisible cards.

It keeps the desktop note's 14px/600/`#767676` title type and carries **nothing but the
title and a `×`** (explicit instruction): no chevron, no grab handle, no group swatches on
the title line. The **close button** (`.fold6-mlegend-close`, `fold6MobileCloseBtnEl`) sits
at the open card's **top-left**, opposite the מקרא title and centred on its line, in the
same grey at the same size — a quiet way out, not a second piece of chrome competing with
the title. It belongs to the OPEN pose: its opacity rides the height step and it is
pointer-dead below full, so a tap on the closed pill can never land on it. **Its opacity is
written as an explicit number every frame, never `""`** — the CSS base is `opacity: 0` so
it cannot flash before the first paint, and clearing the inline value falls straight back
to that and leaves the button permanently invisible. **A tapped `×` is resolved in
`fold6MLegendDragEnd`, not by its own `click` handler**: the bar captures the pointer on
`pointerdown`, which retargets the resulting click to the bar, so the button's listener
never sees a real tap — it is kept only for keyboard activation (`e.detail === 0`, the same
test the title button uses). *Removed — don't reintroduce:* the handle
(`.fold6-mlegend-btn::before`, a 28×1.5px `#d4d3d8` pill centred 4px above the button's box)
and the chevron that was judged against it. **`.fold6-mlegend-card` is the ONE frame in every state** (explicit instruction — "it should
just be part of the frame"): closed, that card IS the מקרא pill; open, the same box has
grown. **The edge it is pinned to never moves; the opposite edge travels** — at the top its
`height` grows from `closedH` to the bar's, at the bottom its `top` rises from
`barH − closedH` to `0`. Either way that is the height step, after the width step has
widened it from `closedW` to the bar, so the card literally grows out of the button that
was pressed. The **drag follows the edge** too: a top card opens as the finger comes
*down* (`FOLD6_MLEGEND_EDGE` flips the sign on `dy`). Horizontally, `FOLD6_MLEGEND_ALIGN`
places the closed pill — right, left or centred — and every alignment converges on
`left: 0` once open, so it only decides which corner the card unfurls from; the title is
nudged onto the pill's own centre while closed, since it is `text-align: center` in a
full-width bar.
The **title rides inside its top band**, and its distance from the card's top edge is itself
lerped: centred in the pill while closed, at the bar's own `padding-top` once open, where it
heads a card full of rows. The rows ride the same shift (`translateY` on
`.fold6-mlegend-panel`) so frame, title and rows move as one piece — without it the rows
hang in the air above a frame that has not reached them yet. `offsetTop` of the
relatively-positioned button includes its own shift, so the paint strips it first, and
`fold6MFlyMeasure` strips the same shift from every y it measures (it runs while the card is
still opening, and the flight aims at the rows' REST positions).

> *Removed — don't reintroduce:* `.fold6-mlegend-tab` / `fold6MobileTabEl`, the pill as a
> SEPARATE element sitting on the card's top edge like a tab, with its bottom corners
> squared off via `.is-open` and a 1px overlap to hide the seam. One element does it now.

> **Removed, but keep it restorable — the flush white bottom sheet.** The user may go back
> to it. It was: `.fold6-mlegend` full bleed (`left/right: 0`, `FOLD6_MLEGEND_BOTTOM_MOBILE_PX
> = 0`); card and pill `background: #fff`, `border: 0.5px solid #d6d6d6` with `border-bottom:
> 0`, `box-shadow: 0 -4px 24px rgba(0,0,0,.06)` — and that shadow suppressed on the pill while
> `.is-open`, or it fell on the card below as a grey band that read as a seam; `border-radius:
> 16px 16px 0 0` (top corners only, because the bottom edge WAS the screen edge);
> and `.fold6-mlegend-row` on the ACLED tint
> `rgba(0,0,0,.035)`. Everything else — the geometry, the width-then-height opening, the
> drag — is unchanged between the two and needs no work either way.

- It lives in its **own** layer, `#fold6MobileLegendLayer` (a direct `.layout` child, like
  `#fold6NoteLayer` and `#page9CatTooltip`). It is *not* in `#fold6NoteLayer`: that one is
  `aria-hidden` + `pointer-events: none`, which a button cannot be. The layer passes clicks
  through; only `.fold6-mlegend` takes pointer events, and only once `updateGroups` has
  faded it past halfway.
- **Stacking — the mobile stack, bottom to top** (explicit instruction): the **מקרא bar
  (1002) → the groups (1003) → the title blocks (1004, and 1005 on the folds whose cards
  have to clear the docked tooltip)**. So a title block paints over both, and the group rows
  paint over the legend. Mobile only, with `.text-section > .section-text.text-card`
  supplying the `position: relative` — the child combinator leaves `@fold13`/`@fold14`'s
  sticky/fixed cards alone. The bar keeps a four-digit number (rather than being dropped to
  a low one) purely to stay above the docked event tooltip's 1000, exactly as it was; the
  cards were lifted past it instead, which leaves every other tooltip relationship alone.
  `.groups-overlay` can take part at all only because it is a **direct `.layout` child**
  (project.html) — inside `.graphic-col` its z-index was trapped in that column's stacking
  context. Out-stacking the full-viewport `.text-section` boxes is also what keeps the מקרא
  button tappable. The cards' lift only counts because **`.text-col` deliberately carries no
  `z-index`** — giving it one re-opens a stacking context and traps every descendant.
  The number must live on the **layer**: it is the stacking context, so a z-index on
  `.fold6-mlegend` inside it could never climb past it.
  **The panel card is opaque** (`.fold6-mlegend-card` background `--mlg-fill`, the ACLED
  tint composited over `--bg` rather than the translucent `rgba(0,0,0,.035)` itself) — kept
  from when the legend sat on top, and still what stops the artwork behind it showing
  through.
  *Removed — don't reintroduce:* the `.fold6-mlegend-layer.is-open { z-index: 5 }` flip that
  left the layer at 3 while closed and only lifted it while the panel was down (its
  `is-open` class went with it; the bar still gets its own), and — superseded — the older
  **"the legend is ALWAYS above the title blocks, open or closed"** rule that the flip was
  replaced by. `@fold4`'s flight rides in the groups' own band now
  (`.fold6-mfly-layer-under`, 1003), not below everything.
- **The card is a sibling painted behind the content, sized by JS** — the desktop
  construction (`fold6NoteCardEl`) carried over. `fold6MobileCardEl` is the bar's first
  child, `position: absolute`, and `fold6MLegendPaintCard(raw)` (`js/groups.js`) writes its
  `left/width/top` per frame of an open or close, **anchored to the bar's bottom**
  (`bottom: 0` always; `top` is the thing that travels, and `height` is left empty so the
  two edges define it and the card follows the bar when the note grows it), so the height
  step raises the card's top rather than pushing its bottom anywhere. It measures only the **button** and the **bar**: the bar's padding is the card's
  outset — `FOLD6_CARD_PAD` (8) above the title, `FOLD6_MLEGEND_PAD_BOTTOM_PX` (6, the
  bar's CSS bottom padding — keep the two in sync; the bar's top padding is 4) below it.
  The **pill** (`FOLD6_MLEGEND_COMPACT_CLOSED = true`) is the measured title plus
  `FOLD6_MLEGEND_COMPACT_PAD_X` (**21**) each side, **36** high (`FOLD6_MLEGEND_COMPACT_H`,
  exact tuned px; `FOLD6_MLEGEND_COMPACT_W` is a fixed-width override when non-zero, and
  `_H = 0` falls back to the measured height), centred horizontally on the bar — and that
  pill IS `.fold6-mlegend-card` at `hT = 0`, not a second element. Opening keeps the card's
  **bottom edge fixed** and raises its top to `0`; the title and the rows ride the same
  shift so the whole thing moves as one piece. See the frame paragraph above for the
  details, including why `offsetTop` has to be stripped of last frame's shift and why the
  close's final paint runs after the panel is hidden (hiding it changes the bar height
  everything is placed off). At rest open the card spans the bar, so the ACLED note flowing
  into the panel at `@fold6` grows it for free.
- **The two columns are SOLVED from the card's width, never a literal**
  (`.fold6-mlegend-col.is-coalition` / `.is-change`, style.css). The card is exactly
  `--card-w` wide — its side gaps are the title blocks' own gutter, which is defined as
  half of what is left over — so each column is half of that minus the chrome between them:
  the bar's 12px side padding twice, the panel's 4px twice and the 12px column gap, i.e.
  `--mlg-col-chrome` (44px). Keep that in step if any of the three moves. The flat **160px**
  it replaced was wider than half the card once the card was inset to the gutter: two
  columns plus the gap came to 332 inside 318, so the left column hung 6px outside the card
  and **clipped its three group cards**. Both `width` and `max-width` are set, and both in
  px rather than a percentage, because `fold6MFlyMeasure` reads this computed `max-width` to
  work out the wrap the `@fold4` flight freezes the labels at — a percentage comes back
  un-resolved. Verified: nothing clips and the flight still lands exactly, at 390 and 560.
- **The title drags.** A press on the button scrubs `fold6MLegendOpenRaw` with the finger
  (up = opening, over the bar's open height minus the closed pill), painting each frame,
  and release snaps to the nearer pose through `fold6SetMobileLegendOpen`; a press that
  moved under 6px (`FOLD6_MLEGEND_DRAG_SLOP_PX`) is a tap and toggles as before, and one
  that moved swallows its own compatibility click so a drag never double-toggles. The
  pointer is captured on the **button** (capturing on the bar re-targets the click and
  kills the tap), and the bar's `touch-action: none` keeps the page from scrolling under
  the swipe.
- **Opening: width, then height. Closing: height, then width.** `fold6SetMobileLegendOpen
  (open, {instant, onDone})` drives one raw progress `fold6MLegendOpenRaw` (0 closed … 1
  open) toward its target over `FOLD6_MLEGEND_OPEN_MS` (**550**) for the full trip, sliced
  into `FOLD6_MLEGEND_OPEN` = `{ w: {0, 0.45}, h: {0.45, 0.55} }` and re-eased with `p9Ease`
  per window (house rule: raw slices, eased fresh). A reversal mid-flight — a second tap, a
  scroll back over `@fold4` — turns the raw value around from wherever it is at the same
  rate, so closing walks the same path backwards. **The panel's opacity rides the height
  step** (`hT`): the rows fade in as the card makes room for them and are gone before it
  shrinks back to the title; `pointer-events` is off on the panel until the step lands.
  `fold6MLegendOpenWant` (the *target*) is the "is the panel open" truth for every guard —
  the tap toggle, the outside tap, Escape, the fly reopen; `panel.hidden` is only flipped
  at the ends (unhidden at once on open, so the card can measure the height it is opening to
  and the fly hand-off can measure its targets; hidden when the close lands). `.is-open` on
  the bar and the layer follow the same ends.
- **There is no pressed chip** — the card opening *is* the open state. Being a
  real `<button>`, it still gets the UA's tap highlight and a focus ring that outlives the
  tap; both are cancelled explicitly (`-webkit-tap-highlight-color: transparent`, and
  `outline: none` on `:focus`/`:focus-visible`), the same treatment the pill ⓘ needs — see
  [Drag-and-Drop](Drag-and-Drop.md#the-pill--button).
- **The panel spans the bar's full width** — the screen less `.fold6-mlegend`'s 12px
  insets (per explicit instruction — not shrink-wrapped to the mini-legend). It
  carries **no frame of its own** (no background, border or shadow — the card behind the
  bar is the frame); just the 8px gap under the title row and `padding: 2px 4px 0`.
- **Scroll cost while open — keep both guards.** The open panel sits in a
  `position: fixed` full-viewport layer over a canvas that repaints every frame; scrolling
  with it down would stutter. Two things prevent
  it and both are load-bearing: `.fold6-mlegend-panel` carries `transform: translateZ(0)`
  + `contain: paint` so it is composited rather than re-rasterised with the canvas, and
  `fold6SetMobileLegendVisible` caches its last `vis` and skips the write when unchanged —
  it runs from `updateGroups`, i.e. once per scroll frame, and `vis` is pinned at 0 or 1
  outside `fold6Trigger`'s own ~1.9s ramp, so nearly all of those writes would be no-ops that
  still dirty the subtree for repaint.
- **Inside, the layout mirrors `@fold3` on screen.** Only the **camp title** is centered
  (over its own column, `align-self: stretch` + `text-align: center`). The **group rows are
  not** — `.fold6-mlegend-col` is `align-items: flex-start`, so every row shares the
  column's start (right, under `dir: rtl`) edge, swatches in one vertical run and labels
  right-aligned, exactly as `updateGroups` leaves them at `@fold3`. The two columns sit
  `justify-content: space-around` — one per half of the full-width panel — with a 12px gap.
  **Labels wrap as necessary** (explicit instruction, replacing an earlier one-line-per-group
  rule): each column is `flex: 0 1 auto` + `min-width: 0` under a **per-camp `max-width`** —
  `.is-coalition` **124px**, `.is-change` **160px** (the modifier class is set in
  `js/groups.js` when the column is built) — and a long group name stacks lines inside that
  cap instead of widening the column and squeezing the other camp.
  Which labels wrap was specified by hand: only «תומכי עסקת חטופים ומתנגדי המלחמה» and
  «תנועות התנחלות באיו״ש» do («מתנגדי הרפורמה המשפטית», 143px at 14px Assistant,
  fits the 160px change cap on one line). **That cannot be done with one
  shared width**: at 14px Assistant those measure 198px and 124.5px, but «מפגינים ערבים
  ישראלים» — which must stay on one line — is 123.4px, ~1px under the settlers label. So each camp is capped on its own
  longest *keeper* instead (coalition: קבוצות ימין לאומיות 101px; change: מפגינים ערבים
  ישראלים 123px), which leaves both caps a wide, device-proof margin. Each cap is the label
  width **+12px** for the 6px swatch and the 6px row gap. Retune a cap only against those
  measured widths — a cap set by eye on one phone will flip a label on another.
  The swatch stays on the label's **first** line (`.fold6-mlegend-row` is
  `align-items: flex-start`), exactly as the canvas rows sit at `@fold3`. No
  `overflow-x` guard is needed — nothing can out-measure the panel.
- **The six `groupItems` don't go anywhere** *(typed hand-off only — with `FOLD4_FLY` on,
  the default, they fly into the panel instead; see the two-versions bullet below)*. At
  `@fold4` they leave from exactly where
  `@fold3` left them (per explicit instruction — they do not fly into the button): the
  swatch **shrinks to nothing** in place (`swatchSize *= 1 - e6`) and the label **un-types**.
  The shrink is paired with an opacity fade over the last CSS pixel
  (`SWATCH_VANISH_PX` = 1, `js/update-groups.js`) — see **Shrinking to zero doesn't hide
  anything** below.
  The un-typing mirrors each row's own `@fold3` type-in window inside `fold6Trigger`
  (`start → 1-(start+len)`, progress inverted), so the row that typed in last disappears
  first and retiming `@fold3` retimes this automatically — the same construction the camp
  headers use on desktop. There's no fold6 position target and no reshape at all on mobile:
  swatch size, label gap, font-size, wrap cap and label side all stay at their column
  values, via `fold6ShapeT` (`js/update-groups.js`) = `e6` on desktop, **0** on mobile.
  **The label must not move a pixel while it un-types**, and two separate terms of its
  `top` would otherwise slide it up: the swatch's own center (`swatchSize / 2`, following the
  shrink) and `firstLineShift` (faded over `e6`). Both are fixed —
  `labelAnchorSwatch` holds the pre-shrink size for the label's anchor only, and
  `firstLineShift` fades over `fold6ShapeT` instead of `e6`, so on mobile it holds.
- **The camp names live inside the panel** (per explicit instruction — they do not rise
  onto the screen). Each column is headed by a static `.fold6-mlegend-camp` carrying
  `CAMP_HEADER_TITLE_COALITION` / `_CHANGE`, with a **12px** gap below it (double the 6px
  pitch between the group rows, so the camp → groups split reads at a glance). On screen, `campHeaderCoalitionEl`/
  `ChangeEl` un-type at `@fold4` **exactly as on desktop** — there is no mobile branch on
  the untype factors and no mobile glide — so past `@fold4` the button is the only thing
  left of the camps.
- **One number positions the bar:** `FOLD6_MLEGEND_BOTTOM_MOBILE_PX` (**0**), its distance
  from the bottom edge. It never moves; `fold6PlaceMobileLegend()` writes that
  constant as the `bottom` each frame, which is why `.fold6-mlegend` has none in the stylesheet.
- **The button arrives early and pops.** It does *not* ride `fold6Trigger`'s full ~1.9s ramp
  — fading one small button over that long reads as never arriving. `fold6SetMobileLegendVisible`
  re-maps the progress onto a front-loaded slice, `FOLD6_MLEGEND_IN_SPAN` (**0.3**), and
  scales the **button and the collapsed card** (not the bar — the bar contains the panel;
  an open or opening card is left alone) in with
  `fold8TooltipGrowEase`, the same pop the `@fold7` tooltip uses. So it lands
  while the on-canvas rows are still leaving behind it. The `@fold4` intro below still waits
  for the *unmapped* progress to reach 1.
- **MOBILE: the מקרא drawer collapses at `@fold4`, as built** (explicit instruction). `FOLD6_MLEGEND_HOLD_OPEN` (js/groups.js) is **`false`**: `fold6MFlyArrive` shuts the panel `FOLD6_MFLY_CLOSE_GAP_MS` after the rows land, `fold6MLegendAutoBeat`'s `want` is `squaresRevealTrigger.currentT() <= 0` (so `@fold5` keeps it shut and nothing reopens it), scrolling closes a hand-opened panel, and the ACLED note arrives collapsed inside the closed drawer. **Everything below about the panel being HELD open until the year axis has drawn describes the flag's `true` state and is not what ships on mobile** — holding open is the DESKTOP behaviour (labels + note staying typed, `checkLegendCollapse`).
- **The close is LATCHED** (desktop; mobile too when `FOLD6_MLEGEND_HOLD_OPEN` is on) (`legendAxisLatch`, js/groups.js): once the axis has fully drawn and the legend has closed it stays closed — the axis un-wiping later (@fold10's undraw, the bridge) does not reopen it. **Desktop reopens it on the way UP out of the timeline into @fold8**: the moment `fold9FlyTrigger`'s reverse crossing fires (its target back at 0 — the same line the axis un-wipes on, `currentPage < 9`) the latch releases and the labels + note type back; drawing the axis again re-collapses it. On mobile only going back above @fold4 (`currentPage < 3`, where the legend doesn't exist yet and the sequence re-arms) releases the latch. Hover (desktop) and a tap on מקרא (mobile) still open it by hand.
- **Desktop collapse = the year axis fully drawn, not @fold4's landing.** `fold6Trigger`'s settle no longer fires `fold6LabelUntypeTrigger` forward (it still reverses it on the way up). `checkLegendCollapse` (js/groups.js) — two `watchFlag`s on `legendAxisDrawn()` (`p7AxisIntroT() >= 1`, desktop only, rAF-polled while the wipe is mid-flight) — un-types the six labels **and** the ACLED note together, and types them back when the axis un-wipes. Hover re-typing a collapsed legend is unchanged. Any older line on this page saying the labels un-type when the glide lands, or the note un-types on @fold7, is superseded by this.
- **The panel's own beats after the hand-off** (`fold6MLegendAutoBeat`, called from
  `updateGroups` right after `fold6SetMobileLegendVisible`). **The panel STAYS OPEN from the
  rows landing at `@fold4` until the year axis has fully drawn** (explicit instruction): the
  six group rows, and then the ACLED note that joins them on `@fold8`'s crossing, are
  readable for as long as the folds that introduce them are on screen. `want` is
  `!(p7AxisIntroT() >= 1)` (page7.js). Three things make that hold:
  `fold6MFlyArrive` no longer shuts the panel `FOLD6_MFLY_CLOSE_GAP_MS` after the rows land
  while the beat wants it open — it ends the intro (`fold6EndMLegendIntro`,
  `fold6MLegendRestRows`) and leaves the frame up, setting `fold6MLegendAutoHeldOpen`; the
  **scroll-closes-it listener is skipped** while `fold6MLegendAutoHeldOpen &&
  fold6MLegendAutoWantsOpen()`; and `fold6MFlyMaybeReopen` re-arms the reverse flight off an
  auto-held panel (only a *hand*-opened one is left alone). The axis wipe runs on its own
  wall clock with nothing calling `updateGroups` per frame, so the beat **polls it by rAF
  while `0 < p7AxisIntroT() < 1`** (`fold6MLegendAxisPoll`). When the note becomes available
  inside a held-open panel, **its «איסוף הנתונים» section expands itself**
  (`fold6MDataSetAvailable` → `fold6MDataToggle(true)`); in a closed panel it keeps its
  collapsed default. `want` is
  *derived from that live progress every frame*, not latched on a crossing, so scrolling
  back up — the axis un-wiping below 1 — reopens it; only the **changes** are acted on, so a reader who taps
  the button mid-fold keeps what they chose until the next beat. The memo
  (`fold6MLegendAutoWant`) clears whenever the bar is gone, which re-arms the sequence.
  Two things follow from the fold not opening the card, both in `js/update-groups.js`:
  `noteOpenShift` is **0** (there is no card-open to wait for, so the note types on the
  trigger's own beats), and the note's `hidden` gate is `fold6MLegendOpenWant &&
  fold6MLegendOpenRaw < 1` — mid-open only. On the raw alone a permanently-closed card sits
  at 0 and would keep the note hidden forever, so the frame would open empty on the tap.
- The panel's rows are a **separate static copy** of the six groups, not the animated
  `groupItems` — those are mid-flight whenever the panel is closed. Same two-column split,
  same sides (coalition right, by `dir: rtl` + source order), each column in `campRowOrder`'s
  mobile order (see the roster section — it passes `mobile: true` outright, since the panel is
  built once at parse time and only ever shown under the breakpoint).
- **«הצגת גודל האירועים» row** (`fold6MobileScopeEl`) directly under the group rows, shown from @fold11's crossing (`fold11SizePast()`, js/update-groups.js) — the desktop `p7ScopeBtnEl`'s mobile twin, same `p7ScopeToggle` (@fold11–@fold12 via `p7SizeGridSet`, @fold13 via `p9ScopeSet`). Tap resolved in `fold6MLegendDragEnd` (`d.onScope`).
- **«איסוף הנתונים» — a collapsible section at the bottom of the מקרא panel**, under the
  group rows behind `.fold6-mlegend-divider`. **Only from @fold6 on** — `fold6MDataSetAvailable(noteRevealT > 0)` (js/update-groups.js) hides it above that fold's `acledNoteTrigger` crossing and resets it collapsed. **Collapsed by default.** Header
  `.fold6-mlegend-data-head` (the desktop note title's type + its chevron, turned by
  `--note-open`); body `.fold6-mlegend-data-body` holds `FOLD6_NOTE_TEXT` with ACLED as a link.
  `fold6MDataToggle` (js/groups.js) eases it open/closed over `FOLD6_MDATA_MS` (350ms, `p9Ease`),
  writing the body's height/opacity per frame and repainting the card with it. The bar
  captures every pointer, so the header tap and the link are resolved in `fold6MLegendDragEnd`
  (`d.onData`, `d.link` → `window.open`), not by their own clicks.
  **Removed — don't reintroduce:** the mobile corner link (`fold6MobileAcledLinkEl`,
  `.fold6-macled-link`).
  The **desktop note is untouched** — every one of its nodes, its chevron and its typing
  still work exactly as before; only mobile's copy of the credit changed.

  *Removed — don't reintroduce:* `fold6SyncNoteHome()`, which re-parented
  `fold6NoteRuleEl` / `fold6NoteTitleEl` / `fold6NoteEl` between the note layer and the
  panel and toggled `.is-in-panel` on all four note elements; and
  `fold6MobileNoteDividerEl` (`.fold6-mlegend-divider`), the 1px `rgba(0,0,0,.12)` hairline
  that separated the six rows from that note. `.fold6-note-title.is-in-panel::after`'s
  `content: none` (no chevron in the panel) went with them.
- Open/close: tap the button, tap **anywhere** outside it, **scroll the page**, or Escape.
  Resizing to desktop closes it (`fold6SetMobileLegendVisible(0)`). The scroll listener is
  **gated on the hand-off not being in flight** (`fold6MLegendIntroActive`), on the auto-beat
  **not holding the panel open** (`fold6MLegendAutoHeldOpen` — @fold4 through the axis's
  build-in, see the auto-beat above) and on no drag being in progress: `@fold4` opens the panel *while the reader is scrolling* — that is the
  whole point of the flight — so an ungated listener would slam it shut on the very next
  scroll frame and the six rows would land in a card that is already closing. It is
  `passive`, since it only reads state.
- **The `@fold4` hand-off has two versions, switched by `window.FOLD4_FLY`** (default
  **on** = the fly version). `fold6MFlyEnabled()` (`js/groups.js`) is the single gate; the
  only gate — set the global from the console to compare. Everything in the two bullets
  above (rows shrinking and un-typing in place) describes the **typed** version; the fly
  version replaces it as follows:
  - The panel opens as an **empty frame** and the six `groupItems` **travel into it**,
    each to the exact spot its own panel row occupies. Targets are the panel swatches'
    `getBoundingClientRect()` — directly usable as a `.group-item`'s `left/top`, since
    `.groups-overlay` and `.fold6-mlegend-layer` are both `position: fixed; inset: 0`.
    Measured once per viewport size and cached (`fold6MFlyTargetOf`): six rect reads per
    scroll frame would be six forced reflows on top of a canvas already repainting every
    frame. The cache survives the panel closing — the landed rows stay on those pixels.
  - **The flight rides its own curve, `e6Fly = p7Ease(fold6Trigger.currentRaw())`**
    (`js/update-groups.js`, top of `updateGroups`) — cubic OUT, per explicit instruction
    that the flight should have less ease-in: it leaves at speed and brakes into the
    panel. Everything else on the trigger (the un-type windows, the note fade, desktop's
    glide) stays on the house sine in-out `e6`. Eased fresh from RAW, never a re-ease of
    `e6`. Endpoints agree (`e6Fly = 1` ⇔ `e6 = 1`), so the binary arrival tests below
    are unchanged.
  - The row **reshapes on the way**, the same way the desktop row reshapes into the
    mini-legend, just toward the panel's own metrics: swatch 13px → `FOLD6_MFLY_SWATCH_PX`
    (6), gap → `FOLD6_MFLY_GAP_PX` (6), font 18px → `FOLD6_MFLY_FONT_PX` (14). The label
    **does not unwrap at all** (explicit instruction, replacing an earlier sliding-line-span
    animation that joined a wrapped label into one line over `flyT`): the stand-in is a plain
    wrapping label, so it flies with one fixed shape and swaps into the panel row without
    re-breaking. **That shape is the PANEL's, from the first frame** (explicit instruction —
    "the wrapping should happen at the start not the end"): the LINE BREAKS are frozen for
    the whole flight at the panel's wrap, `flyTgt.cap`, which `fold6MFlyMeasure` reads off
    the column's per-camp `max-width` minus the row's own padding (the width the panel
    label really wraps inside; a group with `labelCapLegend` in `GROUPS` — קבוצות ימין
    לאומיות, 100 — gets its own narrower cap instead, so it wraps in the legend while
    the other five don't). So a label that will be two lines in the panel re-breaks once,
    on the frame the flight starts, under motion; at the landing nothing changes, where a
    re-break would be a static snap with nothing to hide it. **The cap number itself is
    not constant, though: the sizes animate during the flight** (explicit instruction —
    no snap at take-off). The font lerps 16 → 14 and the cap each frame is
    `flyTgt.cap × (fontSize / FOLD6_MFLY_FONT_PX)` — scaled with the type, so the box
    shrinks in step with the glyphs and the same words break at the same places every
    frame (text width is linear in font size). Never freeze one without the other: a
    frozen cap under a lerping font is tighter than either end (תומכי עסקת חטופים went to
    3 lines mid-flight), and a frozen font snaps the size on frame one. A cap that slid
    *independently* of the font would re-break every few frames, and a re-break hops a
    word to another line in one frame no matter how the box is anchored ("position never
    snaps"). What makes a same-shape flight land
    correctly is that nothing reads a wrapped **height**: the flight aims the label's FIRST
    LINE at the panel row's first line (`fold6MFlyMeasure`'s `ly`, the
    `is-mfly-topanchor` block in `js/update-groups.js`), so either end may be one, two or
    three lines and the line the swatch sits on still lands pixel-exact.
    The first-line shift fades out over the same `flyT`. The label keeps **every character**:
    no un-typing, it is the same row arriving somewhere else.
  - **The frame opens with the card's own two-step open** (`fold6SetMobileLegendOpen(true)`
    — width, then height, `FOLD6_MLEGEND_OPEN_MS`); it is never scaled — a scaled frame
    reports scaled rects, so the rows would be aiming at a moving target. The panel is at
    its final layout (unhidden, rows at opacity 0) from the first frame, which is what the
    targets are measured off.
  - The panel's own rows are built at full size and full text from the first frame at
    **opacity 0** (`fold6MFlySetRowsShown`) and appear in **one frame** when the flight
    lands, as the travelling row disappears in the same frame (`fold6MFlyArriveT` is a
    binary `e6 >= 1`). It is a **swap, not a cross-fade**: fading one copy of a row out
    while the identical copy fades in reads as two different things, one dissolving and one
    arriving. The swap is invisible only because the landing is pixel-exact — which is why
    `fold6MFlyMeasure` also measures each panel label's offset from its swatch (`lx`/`ly`)
    and `updateGroups` lerps the label's own `left`/`top` onto it over `flyT`. **`ly` is the
    panel label's CENTER, not its top**: `.group-label` is `translateY(-50%)`, so its `top`
    addresses the box's middle — aiming that at the target's top flew the text half a line
    too high and snapped it down on the swap, and made the tallest (3-line) label crawl.
    The two
    constructions otherwise disagree by a pixel or two (the canvas row centers its label on
    the swatch's middle; the panel centers the swatch on the line box).
  - **The two camp headers fly too** (`placeCampHeader`, `js/update-groups.js`): they travel
    onto the panel's own `.fold6-mlegend-camp` headings (kept in `fold6MobileCampHeadEls` as
    the panel is built), 18px → `FOLD6_MFLY_HEAD_PX` (14), keeping every character — the
    heading is styled as `.camp-header`'s exact face and ink (660 / `#000`) so the landing
    swap changes only the size, never the weight or colour — the
    mirrored un-typing (`fold6BeatT("headerCoalition"/"headerChange")`) is suppressed while
    flying. Both ends are center anchors (`.camp-header` is `translate(-50%, -50%)`,
    the target is the heading's measured center), so it is a plain `e6Fly` lerp with the same
    stand-in + swap treatment as the rows. The panel's own headings are held at **opacity 0**
    alongside its rows (`fold6MFlySetRowsShown` covers both) and appear on the same landing
    frame — a heading already sitting in the panel gives the arrival away.
  - **The flight is painted by stand-ins in TWO parking layers**, not by the `groupItems`
    themselves (`fold6MFlyPaintClone`/`.fold6-mfly-layer`). Six bare `.group-item` copies parked in a
    `pointer-events: none` layer appended **after** the panel therefore wear the frame
    instead: `updateGroups` writes the row as usual, then copies its three `cssText`s onto
    the stand-in and hides the real one with `.is-mfly-hidden` (`visibility: hidden`, so it
    stays laid out — `item.label.offsetWidth` is read from it every frame). No coordinate
    translation is needed: every layer involved is `position: fixed; inset: 0`.
    **Which** layer a stand-in sits in is decided per frame, per element (`fold6MFlyPark`).
    `.fold6-mfly-layer-under` (inserted before the מקרא layer, `position: fixed`, mobile
    `z-index: 1003` — the groups' own band: over the legend, under the title block) carries
    the flight; `.fold6-mfly-layer` inside the מקרא layer carries the landing, so it paints
    after the panel within the panel's own layer. The swap used to be load-bearing, because
    the old order was a z-index **cycle** (title block above the rows, open legend above the
    title block, rows landing on the panel); with the stack now a plain bar → groups → cards
    order, both spots satisfy it and the hand-over is belt-and-braces. The test is **"is this element inside the panel's box"** — both
    edges, `fold6MFlyPanelRect.top`/`.bottom` ± `FOLD6_MFLY_PARK_SLACK` (6, the ink above a
    wrapped row's anchor). A one-sided "below the top" test is wrong and was corrected: it
    put every stand-in in the OVER layer for its whole flight — i.e. over the title block,
    the opposite of the ask. With both edges the switch can never be seen: an element only changes layer over a region it
    does not overlap yet. It is decided from the `y` `updateGroups` just wrote, never from a
    `getBoundingClientRect` on the stand-in — that would be a forced reflow per element per
    scroll frame.
  - **The stutter budget**: during the flight the hidden real label's line breaks are
    **frozen** (the cap only scales with the font; nothing reads its layout mid-flight) and the stand-in's text is written
    once, not per frame — with no unwrap to animate, the flight costs no text re-layout at
    all, only the `top`/`left`/`font-size` writes every row makes. The `fontSize` itself stays **continuous** (per
    explicit instruction): rounding it to whole px cut more re-layouts still, but 18 → 14
    in four steps reads as the text snapping down in size.
    **The anchors below only work if `.group-label.is-mfly-topanchor` actually parses.**
    The historical "one group stutters" bug (מפגינים ערבים ישראלים lurching on every
    re-break, all labels sitting a full width right of their swatch) was ultimately a
    stray `*/` in the comment above that rule in `style.css`: CSS error recovery ate the
    junk *and the selector after it*, so `translateX(-100%)` never applied and every
    re-break moved the visible text. If the flight ever stutters again, verify that rule
    reaches the browser before redesigning the animation. And a stand-in's
    `cssText` copies are skipped when the string is unchanged (`fold6MFlyCopyStyle`,
    memoised on the clone) — assigning `cssText` re-parses and invalidates even when nothing
    changed. Hiding a stand-in clears that memo (`fold6MFlyHideCloneEl`), since
    `display: none` is written outside it.
  - **No `offsetWidth` read while flying** — binding, and the reason the stutter looked like
    it belonged to *one group* rather than to the geometry. The resting `left` is derived
    from the label box's measured width, and `offsetWidth` is a **forced synchronous
    layout**: the same frame has already written a new `font-size` and `max-width` onto that
    label, so the browser cannot serve the read from the last layout — it re-resolves the
    box, line breaking included, right there. Done inside `GROUPS.forEach` that is six
    layout flushes per frame, interleaved with the writes so none of them can be batched.
    The row that pays most is the one with the most line breaking to redo, i.e. the single
    3-line mobile label (מפגינים ערבים ישראלים) — everything else re-wraps trivially, so
    only that row visibly stuttered. The measurement is therefore behind
    `labelLeftRest()` in `js/update-groups.js` and called **only on the non-flying branch**;
    the flying branch anchors the box's right edge and never needs a width. If a future
    edit hoists that read back out of the closure "for clarity", the stutter comes back on
    exactly that one row.
  - **The first-line anchor during the flight** — the other half of that label's jump,
    and it is solved by *removing* a measurement, not by adding one. `.group-label` is
    `translateY(-50%)`, so its drawn position is a function of its own **height**; every
    time the opening cap lets the text drop a line (3 → 2 → 1) the whole block shifts by
    half a line. For the flight the label wears **`.is-mfly-topanchor`** (`style.css`,
    mobile block), which drops the transform so `top` addresses the box's **top edge**, and
    `updateGroups` places the **first line** directly:
    `top = firstLineCenter - labelFontSize * FOLD6_MFLY_LINE_H / 2`, with
    `firstLineCenter = labelBase + (flyTgt.ly - labelBase) * flyT`. `labelBase` (the
    swatch-center + ink shift, *without* `firstLineShift`) is exactly where the resting
    first line already sits — under the centered transform the height cancels out of
    `center - H/2 + lineH/2` — so the takeoff is seamless, and `flyTgt.ly` is a one-line
    label's center, i.e. its own first line, so the landing is too. **No wrapped height is
    read anywhere in that path**, which is the point: the label may re-break as often as it
    likes and the visible line does not move. `firstLineShift` is therefore skipped while
    flying (its resting form is unchanged).
    **Don't go back to compensating by measurement** — the wrapped height is a *step*
    function of the line count, so the correction is a step function too and the label
    still hops on every re-wrap. That attempt was tried and reverted.
    `FOLD6_MFLY_LINE_H` (1.15) is a copy of `.group-label`'s mobile `line-height`; keep the
    two in sync.
  - **The horizontal half of the same stutter — the larger one.** `left` is normally
    derived from `labelWidth = item.label.offsetWidth` (`leftAsSwatchFirst =
    -(labelGap + labelWidth)`), and the mobile label is `width: max-content` under the cap.
    So every re-break makes the longest line — and the box — abruptly wider, and `left`
    lurches by that whole jump; worse, `offsetWidth` is read from the *previous* frame's
    layout, so it lands late. `.is-mfly-topanchor` therefore also carries
    `translateX(-100%)`, anchoring the box's **right** edge (the swatch-facing edge, which
    the text is already flush against — `textAlign: right` at `sideT 0`, i.e. every mobile
    row). The browser resolves the width at paint time, so the extra width sheds *leftward*
    off the far end. While flying, `left` is a plain lerp `-labelGap → flyTgt.lxRight`
    (the panel label's own right edge, measured alongside `lx` in `fold6MFlyMeasure`) and
    **`offsetWidth` is not read at all**.
  - **The stand-in copies `className`, not only `cssText` — binding.** During the flight the
    real row is `visibility: hidden` and the **stand-in is the thing on screen**, so any
    behaviour driven by a CLASS has to cross over; `cssText` carries none of it. That makes
    it the first place to look when a fix to the row's geometry appears to do *nothing*.
    `.is-mfly-topanchor` is the sharp case: it changes what the copied `top`/`left` numbers
    **mean** (top edge / right edge instead of centre / left edge), so a stand-in missing it
    renders them against the base rule's transform and sits a whole label-width to the
    right — while still being anchored on exactly the measurements the class exists to
    avoid.
  - **Every fly gate is `e6 > 0`, never "a target exists" — binding.** This holds for the
    rows (`flying`) *and* the camp headers (`headFlying`). The header gate is the one that
    actually moved `@fold2`: at `e6 = 0` it pinned an inline `font-size` on
    `.camp-header` (so its `offsetHeight`, half of which `fold2HeaderY` subtracts on
    mobile, stopped following the stylesheet) and swapped the live typing element for a
    stand-in via `.is-mfly-hidden`. Both are no-ops for the flight and both changed the
    resting header-to-row gap.
  - **`flying` is `e6 > 0`, never `true` at rest.** The fly branch in
    `updateGroups` is live from the moment `@fold4`'s trigger exists, which means it also
    runs during **`@fold2` and `@fold3`**, where `e6 = 0` and the rows are simply sitting
    still. Every lerp is a no-op there, but the fly-specific *measuring* is not: snapping
    the cap to an absolute 4px grid, or `Math.round`-ing the absolute font-size, re-wrapped
    the resting labels and visibly moved them — it changed `@fold2`'s camp-header-to-row
    gap. Gating on `e6 > 0` makes `@fold2`/`@fold3` take the pre-fly path, i.e. their exact
    original geometry. (The quantisations themselves are gone — the cap is frozen and the
    font lerp is continuous — but the gate stays: the fly branch still swaps in stand-ins
    and freezes the cap, both wrong at rest.)
  - **Nothing follows the arrival.** `fold6MFlyArrive` (called once per frame from
    `updateGroups`) only fades the panel's own rows in on the landing frame — the panel is
    **left open** at `@fold4` (explicit instruction) and is the legend from there on.
  - A wrapped panel label is aimed at its **first line's** middle, not the box's:
    `fold6MFlyMeasure`'s `ly` is `min(height, line-height) / 2`, which is the box middle for
    a one-liner and the first line for a wrapped one — the line the swatch and the (still
    one-line) stand-in both sit on.
  - **The hand-off plays in REVERSE on scrolling back up** (`js/groups.js`,
    `fold6MFlyMaybeReopen` / `fold6FadeOutMLegendFlyIntro`, wired in
    `fold6SetMobileLegendVisible`):
    - Mid-flight, the trigger's own reversal already flies the rows back
      (every lerp rides `e6Fly`, and `makeTrigger` reverses over the remaining
      distance); the panel frame stays open under them.
    - **After a tap-dismissed demo** (panel shrunk into the button), a *decreasing* `vis`
      reopens the frame first (`fold6MFlyMaybeReopen` → the intro's own
      `fold6PlayMLegendFlyIntro` card open, rows at opacity 0) so the reverse flight has a
      panel to fly out of. Decreasing-only is binding: riding downward past a
      tap-dismissed demo must not resurrect it, and a hand-opened panel is left alone
      (`fold6MLegendOpenWant` guard).
    - Once `vis` is back at 0 the empty frame **closes** — `fold6FadeOutMLegendFlyIntro`,
      which is just the card's own close (height, then width) with an `onDone` that rests
      the intro state. The close picks up from wherever the card is (a fast flick can
      reverse while the open is still running), the `fold6MFlyFadeOut` flag marks it so the
      instant `vis <= 0` close is suppressed while it runs, and a re-entering open or
      `fold6StopMLegendIntro` clears the flag.
- **The `@fold4` typed hand-off intro** (`fold6PlayMLegendIntro`, `js/groups.js`): the on-canvas
  rows leave by shrinking and un-typing *in place*, which reads as "gone" but not as "gone
  **there**". So the moment `fold6SetMobileLegendVisible` is handed any `vis > 0` — i.e.
  `fold6Trigger` has *started* — the panel opens by itself and plays the same gesture in
  reverse inside itself, **while the on-canvas rows are still un-typing**. Firing it on
  `vis >= 1` instead (waiting for the rows to finish leaving) is wrong and was corrected: it
  put a ~1.9s gap in the middle of the hand-off, so it read as two unrelated events instead
  of one move seen at both ends at once.
- **It all runs on one clock** (per explicit instruction) — no per-row stagger, and the rows
  do not wait for the frame. The frame is the card's own open (width, then height, over
  `FOLD6_MLEGEND_OPEN_MS` — exactly the move a tap makes) started on the same frame; then
  every swatch pops `scale(0 → 1)` over `FOLD6_MLEGEND_INTRO_POP_MS` (400), and every label
  types in over `FOLD6_MLEGEND_INTRO_TYPE_MS` — which **is** `GROUP_TRANSITION_MS`, so the
  panel's rows finish typing on the same frame the on-canvas rows finish un-typing. The two
  halves of the hand-off start together and land together; the legend arrives in one move
  rather than being rebuilt row by row.
- **Nothing in the panel moves while it plays.** The labels use the tooltip's own two-span
  typewriter (`fold8SetupTypewriter`/`fold8UpdateTypewriter`, `js/fold8-tooltip.js`), so the
  untyped tail stays in the DOM at opacity 0 and every row is its final width from the first
  frame; the swatches animate by `transform: scale()`, which doesn't affect layout. Slicing
  `textContent` instead — the first attempt — grew each label as it typed, widening the
  column and shoving the dots sideways under their own text. The dots must appear where they
  land.
- **`@fold3` also fires earlier on mobile** — `FOLD3_CARD_FRAC` (**0.6**, vs the house 0.5;
  `js/groups.js`, same `watchCardThreshold` function-frac form) — so the filler shrink and the
  group labels typing in get more of the fold on screen. Desktop keeps 0.5.
- **THE HAND-OFF IS SEQUENTIAL, AND EVERY STEP HAS ITS OWN DURATION** (explicit
  instruction — "first legend opens, then groups fly"). In order: the מקרא button arrives
  (`FOLD6_MLEGEND_ARRIVE_MS`, **0** — skipped, so the sheet's open is the first thing seen);
  the sheet widens (`FOLD6_MLEGEND_WIDTH_MS`, **170**) then grows
  (`FOLD6_MLEGEND_OPEN_MS`, **410**); it holds (`FOLD6_MFLY_HOLD_MS`, **400**); the rows fly
  (`FOLD6_MFLY_MS`, **1900**); and `FOLD6_MFLY_CLOSE_GAP_MS` (**500**) later the intro ends — the
  sheet **stays open** (the auto-beat holds it until the year axis has drawn). The flight is a `{start, len}` window on the trigger's **raw** progress
  (`fold6MFlyStart()` / `fold6MFlyLen()`), derived from those durations against
  `GROUP_TRANSITION_MS`, so retiming any step retimes the release. **The arrival is measured
  in EASED progress while the window is cut from RAW** — `fold6MFlyStart` converts through
  the inverse sine ease; adding them directly released the rows ~0.06 early, while the sheet
  was still growing.
  - **A TAP GETS ITS OWN, FASTER PAIR** — `FOLD6_MLEGEND_TAP_WIDTH_MS` (**90**) /
    `FOLD6_MLEGEND_TAP_OPEN_MS` (**190**), picked by `fold6MLegendWidthMs()` /
    `fold6MLegendOpenMs()` off `fold6MLegendIntroActive`. The numbers above are tuned for a
    scripted entrance; a tap that borrowed them took 505ms to answer and read as the button
    lagging the finger.
  - **The rows never un-type in the fly variant.** That guard is `!fold6MFlyEnabled()`, not
    `!flying` — since the flight starts late, the rows sit at zero progress through the
    opening beat, and on the old test that read as "not flying", so they spent it spelling
    themselves backwards before setting off.
  - **The camp headers' exit is its own window** on mobile — `FOLD6_HEAD_UNTYPE_AT` (**0**)
    and `FOLD6_HEAD_UNTYPE_MS` (**500**) — rather than mirroring whenever each camp typed in
    at `@fold2`. They are the one thing at this fold that still leaves by un-typing.
  - **The flight paints IN FRONT of the legend the whole way**, from one parking layer
    inside `#fold6MobileLegendLayer` after the panel. *Removed — don't reintroduce:*
    `.fold6-mfly-layer-under`, a second layer at z-index 1003 — above the legend's old 1002,
    but silently behind it once the legend went to 1006.
- **THE GROUP LABELS BREAK EXACTLY AS THEY DO AT `@fold3`** (explicit instruction). The card
  gets no wrap of its own: each label inherits `@fold3`'s cap for that group
  (`labelCapMobile`, else `GROUP_LABEL_MAX_WIDTH_MOBILE`) **scaled by the type**, since the
  card sets the same text at 14px where the column sets it at 16. Text width is linear in
  font size, so the same words land on the same lines — 2, 2, 1, 2, 2, 2 in both places.
  The two sizes are **literals** in the row builder, not the constants holding them: that
  builder runs at parse time, above where `FOLD6_MFLY_FONT_PX` is declared, and reading it
  there threw on `const`'s temporal dead zone — which takes every global in the file down
  with it. *Removed — don't reintroduce:* the per-group `labelCapLegend` this replaced.
- **THE SIZE BUTTON AND THE ACLED NOTE ARE OUTLINE CARDS** in the group cards' shape —
  1px `#c9c9c9`, 10px radius, 12/13 padding, on the same 16..377 box. Both chosen in
  `compare/` passes against a filled card and against a rule above them; **no rule ships**
  (`fold6MobileDataDividerEl` is still built but not appended, so restoring it is one
  `append` away). `box-sizing: border-box` is load-bearing on both: they are `<button>`s,
  and without it the outline pushes them past the cards they line up with. The ACLED card
  (`.fold6-mlegend-data-card`, `fold6MobileDataCardEl`) is a real WRAPPER around the heading
  AND the body — the two are siblings, and a border on each drew two boxes with a seam,
  where the wrapper hugs the heading while collapsed and grows around the text as it opens,
  because the body's own height animates to 0. Its chevron sits 12px in, being inside the
  card's own padding now.
- **The group rows dim in 140ms, not the legend system's 260** — they are buttons the reader
  taps, and the slower tempo read as the card lagging the finger. Mobile only:
  `.group-item` keeps 260 on desktop, where it fades rather than being pressed.
- **`@fold4` itself fires LATE on mobile** — `FOLD6_CARD_FRAC` (**0.23**, vs the house 0.5;
  bigger is earlier, so this is well below it and the card's top has to climb almost all the
  way up before the hand-off starts), picked by eye with the `manual/` trigger harness on
  2026-09-14. The whole hand-off — the six rows flying into the מקרא sheet, which then stays
  open — therefore plays out as @fold5
  comes up rather than while this fold is still centred. Desktop keeps 0.5.
- **The rows' flight starts late going DOWN, but takes the whole unwind coming BACK**
  (`fold6MFlyT`, js/update-groups.js). Forward, the flight is the `{fold6MFlyStart(),
  fold6MFlyLen()}` window on the trigger's raw progress — the sheet opens first, then the
  rows fly. That window is deliberately **not** mirrored on the reverse: played backwards a
  late window is an early one, and the rows flew out of the still-closed pill in the first
  half of the unwind and then sat parked at their `@fold3` spot, mid-screen, for the rest —
  on a fast scroll that spot is whatever fold the reader has reached (they popped in over
  `@fold6` and over the hero). Going back the flight is `p7Ease(raw)` over the full unwind,
  so the rows keep travelling until the trigger lands. Each leg re-bases on wherever the
  previous one left the rows (`fold6Trigger.target()` flips → capture `raw0, fly0`), so a
  reversal mid-flight is continuous — position never snaps.
- **The fly targets survive a viewport height change while the panel is closed**
  (`fold6MFlyMeasure`, js/groups.js). The targets are cached per `WxH`; a closed panel cannot
  be re-measured, and returning "no target" there dropped the rows into the no-fly branch,
  which un-hid them at their `@fold3` spot mid-screen — on whatever fold the reader was on.
  Safari's URL bar does exactly that every time it collapses or expands. On a hidden-panel
  miss the stale map is kept and every `y` shifted by the height delta (the pill is
  bottom-anchored); a width change leaves `x` stale until the panel next opens and
  re-measures (`fold6MFlyTargets = null` on open). Reproduce headless with
  `page.setViewportSize` mid-scroll — a wheel-only probe never sees it.
- **Then it stays open** (explicit instruction): the rows land, `FOLD6_MFLY_CLOSE_GAP_MS`
  later `fold6MFlyArrive` ends the intro and `fold6MLegendRestRows` hands the rows back to
  CSS — without closing. The close belongs to `fold6MLegendAutoBeat` (the year axis fully
  drawn). `fold6MFlyArrive`'s own close survives only for the case the beat does not want the
  panel open.
- **The ACLED note is ADDED on `@fold8`'s card** (`#page-7`, which carries the ACLED copy
  while `@fold6` is hidden): `checkAcledNote` is a plain
  `watchCardThreshold(page7TitleCardEl, 0.5, …)` on **both** viewports, and the note's
  section opens itself in the held-open panel.
  *Removed — don't reintroduce:* the mobile-only early wiring that crossed this trigger on
  `@fold5`'s card (`#page-4`) at `FOLD3_CARD_FRAC`.
  `fold6MLegendIntroActive` does not gate it — that flag stays true for as long as the
  rows can still fly back out. `updateGroups` keeps the note + rule `hidden` (out of layout,
  not just transparent) only while `fold6MLegendOpenRaw < 1`, i.e. while the card is still
  opening: the one moment the note could grow the frame under rows that are still arriving,
  reachable only on a fast scroll that lands both crossings at once.
- The rows use the house `p9Ease`; the card's steps do too. The panel's stylesheet
  `translateZ(0)` is never overwritten — the intro never writes a transform on the panel.
- It is **one-shot per crossing**: the `fold6MLegendIntroPlayed` flag clears when `vis`
  returns to 0 (scrolled back above `@fold4`), so coming down again replays it. Any tap —
  the button, outside, Escape — calls `fold6StopMLegendIntro()`, which cancels the rAF and
  restores every row to full text and an unscaled swatch, so a panel
  opened by hand is never caught mid-animation; the card's own open/close is *not*
  cancelled by it — the tap that follows just turns the card toward its new target.
  Desktop never runs it (`isMobile()` guard).
- `FOLD6_LEGEND_TOP_MOBILE` (**24**, js/groups.js) is `fold6RowIndexY`'s mobile branch — a
  flat top inset for the on-canvas rows. With no on-canvas legend under 600px nothing visible
  reads it; the hover boxes and the note anchors that call `fold6RowIndexY` are desktop-only.

**The מקרא hand-off intro re-arms only above @fold4.** `fold6SetMobileLegendVisible`
plays `fold6PlayMLegendIntro` once (`fold6MLegendIntroPlayed`) and re-arms it when the
bar's `vis` drops to 0 — but `vis` also reads 0 on a DESKTOP viewport, so a phone
rotated to landscape and back re-armed it at @fold11 and replayed the whole intro there:
the sheet opening itself for 1.2s on a fold where it has no business. The re-arm is now
gated on `currentPage <= 3` (@fold4 and above). A rotation at any later fold leaves the
memo set.


**Desktop is unchanged** by any of this.

**@fold3's labels type inside their final wrapped shape.** On mobile the group labels
wrap, and a plain growing string re-breaks its lines as it types — words hop down a line
mid-animation. So `updateGroups` types them through `fold8SetupTypewriter` /
`fold8UpdateTypewriter` (the same two-span visible/transparent pair the camp headers use):
the full string is laid out from the first frame, only the split between the spans moves.
The spans are cached on `item.labelSpans`; the desktop branch keeps the plain
`typedText()` textContent path (nowrap, nothing to re-break) and clearing it is also what
tears the spans down on a resize back up past 600px.

**Mobile @fold3 hangs the swatch off the label's FIRST line.** `.group-label` is
`translateY(-50%)`, so its `top` centers the whole box on the swatch — fine for desktop's
one-liners, but a 2-3 line mobile label left the swatch beside the middle of the block.
`updateGroups` adds `firstLineShift` = half the label's height beyond one line (the same
label re-measured with the wrap cap lifted), faded out over **`fold6ShapeT`** so the
mini-legend keeps its centered swatch and the swatch slides to center during the glide
rather than jumping. It is `fold6ShapeT` and not `e6` precisely so that mobile — where
`fold6ShapeT` is pinned at 0 — holds the shift instead of sliding the label up as it
un-types at `@fold4`.

## Shrinking to zero doesn't hide anything

Dots enter and leave by **size**, never opacity — the project-wide rule is [Animation-System → Dots never fade](Animation-System.md#dots-never-fade); its sub-pixel corollaries here are `SWATCH_VANISH_PX` (**1**, `js/update-groups.js` — the mobile swatch shrink's opacity is multiplied by `swatchSize / SWATCH_VANISH_PX`, so the fade lives entirely inside an already-invisible pixel) and the 8 sample squares' wraps going `display: none` at `growScale` 0 (safe only because `layoutFold6Squares` never measures them).

## Clicking a legend row — the @fold9 filter

On the real timeline (@fold9) each legend row is also a **filter toggle** (`.fold6-legend-filter` strips, built by `fold6LegendFilterEl(g)` and positioned per frame by `updateGroups`; desktop only): click it and that group leaves the graph by size, and the filter stays in force through every later fold.
Mechanics, hover/filtered-off styling and how the 8 claimed squares follow it: [Timeline](Timeline.md#the-legend-filter-fold9-desktop-only--p7filtertoggle-page7js).

## The מקרא sheet's gesture (mobile)

One pointer pass on the whole bar is **both** the drag and the tap — they cannot be
separate handlers, because a row tap that starts with 2px of travel is still a tap and a
drag that begins on a row is still a drag. `pointerdown`/`move`/`up` on
`fold6MobileLegendEl` decide between them at release by distance:
`FOLD6_MLEGEND_DRAG_SLOP_PX` (6) apart.

- **Listening on the bar, not the title**, is what makes the whole sheet draggable. The
  cost: capturing here re-targets the compatibility click to the bar, so the title's own
  `click` can no longer carry pointer input. Every pointer activation is resolved in
  `pointerup`; the `click` handler is left for KEYBOARD only (`detail === 0`), and
  double-firing is what the guard there prevents.
- **The scrub is rAF-coalesced.** `pointermove` fires faster than the display and arrives
  in coalesced bursts, so painting the card straight from the handler re-laid it several
  times per frame and the sheet stuttered under the finger. The handler records the
  finger; one rAF paints the latest position.
- **The tap target is read at pointerDOWN**, not at release: the sheet moves during a
  drag, so the element under the release point may not be the one aimed at.
- **A row tap wins over the sheet toggle** — tapping a group must never also close the
  panel out from under the thing it just changed.

### The rows are the mobile filter buttons

`fold6MLegendRowTap` calls the same `p7FilterToggle` the desktop strips do, gated to the
same folds (`currentPage` 8–12), then `p9FilterKick()` + `updateGroups()`. `p7FilterToggle`
used to early-return on `isMobile()`; that gate is **gone** — everything downstream (the
shrink, the re-pack, the fly, @fold10's grid repack) was already breakpoint-agnostic and
only the entry point was closed. `p7.vert` still gates it: with no vertical layout there is
nothing to re-pack.

`updateGroups` writes two classes onto each card, off the same conditions the desktop
strips use so the breakpoints can never disagree:

| class | meaning |
|---|---|
| `.is-armed` | this fold will answer a tap (@fold9…@fold13) — `cursor: pointer`, nothing else, since a phone has no hover |
| `.is-filtered-off` | this group is out. **Outlives** the armed state: past @fold13 the filter still applies, so the panel keeps saying which groups are missing even though tapping can no longer change it. 0.28, matching `.group-item.is-filtered-off` exactly |
| `.is-pressed` | the finger is on it. Written on **pointerdown** by the sheet's own pointer handler (js/groups.js), no transition, `#d2d2d2`; gone the moment the gesture turns into a drag of the sheet (`FOLD6_MLEGEND_DRAG_SLOP_PX`) or on release. It exists because the real state can only be decided at pointerup — the same gesture may be a drag — so without it a row answered only after the finger lifted plus a 140ms fade, which read as a slow button. `fold6MLegendRowTap` also writes `.is-filtered-off` itself on the tap, rather than waiting for `updateGroups()` (once per frame, so its own call can be re-queued to the next) |
