# Groups and the legend

## The roster

`GROUPS` (`js/groups.js`) is **6 groups** — camp groups only. The old no-camp groups
(אתיופיה, סביבתיים, להט"ב, דרוזים…) were removed entirely on v2 and appear nowhere,
hero dots included. Any doc claiming 8/10/12 groups is stale.

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
| `#6B89FF` | מתנגדי הרפורמה ותומכי עסקת החטופים | `protesters against government` |
| `#FF1A94` | פעילי שמאל | `peace movements` |
| `#31CE1C` | מפגינים ערבים ישראלים | `arab israelis` |

Row order in **both** columns is the sort of that camp's `fold6.y` values (`legendRow` in
`js/update-groups.js`), not the declaration order of `FOLD4_COALITION_ROWS` /
`FOLD4_CHANGE_ROWS` — those two arrays define camp *membership* only. One consequence:
the order is shared by @fold3's aligned column, @fold4 and the mini-legend, so the rows
never reshuffle past each other on the glide. Reordering a camp = swapping two `fold6.y`
values in `GROUPS`.

The `actor` values are `full_v3.xlsx`'s own lowercase `main_actor` strings, matched
verbatim. All six are present in the data, so every group appears on the real timeline.
The camp membership they imply is duplicated as `ACTOR_SIDE` in `server.py`, which
derives each event's `side` from `main_actor` (the xlsx has no `side` column).
`FOLD4_COALITION_ROWS` / `FOLD4_CHANGE_ROWS` define the camp membership and row order in
JS, resolved by color.

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
   (`js/groups.js`) and **differs by breakpoint**. Desktop pitches are harness-tuned by eye
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
   pick no longer shows: the grid reads identically at any height.
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
| label wrap cap (`groupLabelLegendMaxWidth()`) | none (nowrap) | `FOLD6_LABEL_MAX_WIDTH_MOBILE` = 150 |
| label size (`groupLabelLegendFontSize()`) | 14 | 12 |

**The mini-legend's own mobile look — 12px labels, the 150px cap, the 6px row gap — is
finalized. Don't retune it,** and in particular don't unify it with the @fold3 column state
(16px / `GROUP_LABEL_MAX_WIDTH_MOBILE` = 100) to kill the mid-glide reflow: that trade was
tried and rejected.

The wrap cap is the real lever on the row gap: `fold6RowPitchPx` is
`max(24, tallest measured label + FOLD6_ROW_LABEL_GAP_PX)` with the gap at **6**, so at
@fold3's 100px cap the longest labels wrapped to **three** lines and every row inherited
that height. 150px (each legend column owns a half-width — @fold3's 100px exists because
both camps must fit side by side) drops them to two. The cap is **lerped from 100 → 150
over `e6`** on the label's inline `max-width` (`js/update-groups.js`), alongside the
16 → 12 font-size lerp, so the text reflows gradually through the glide rather than
dropping a line all at once at the end.

@fold3's pitch is **one knob per breakpoint, nothing else has a vote**
(`js/update-groups.js`). Desktop: a flat `FOLD3_ROW_PITCH_DESKTOP_PX` = **34px** (a 23px
visible gap around the 11px swatch) — no `max()` against label heights, because desktop
labels are nowrap one-liners and the old `max()` meant editing the pitch constant silently
did nothing whenever tallest-label + gap outvoted it. Mobile keeps
`max(FOLD3_MIN_ROW_PITCH_MOBILE_PX = 32, tallest label + FOLD3_ROW_LABEL_GAP_PX = 12)`,
since its labels wrap to 2-3 lines; there, anything that changes line count changes every
row.

**Both folds share one fixed top anchor** — `fold3TopRowY === fold2TopRowY`; each pitch
only spaces its own rows downward from it. **Removed — don't reintroduce:** the old
re-centering term (`fold2TopRowY - (fold3RowPitch - fold2RowPitchPx()) * rows / 2`) made
@fold3's whole column, and the header riding `topRowYNow`, move whenever *either* fold's
pitch was edited — worst on mobile, where fold3's pitch is label-height-derived. The anchor
is a position; the pitches are gaps; they must never feed each other.
`groupLabelHeight(g, fontSize, maxWidth)` keys its cache on the cap too — the cap is what
decides the line count it measures.

The note's own width/right edge read the same inset functions, so it stays flush with the
right column at either breakpoint.

## Camp headers

The two headers (`.camp-header`, 18px Assistant 660, `direction: rtl`, base
`opacity: 0`, `transform: translate(-50%, -50%)` set once at creation) type in at @fold2
and **un-type in place** at @fold4. They do **not** travel into the mini-legend — the
legend's columns carry no camp titles. There is no `e6` lerp on their position, size or
weight; see [Folds](Folds.md) for the beat-mirroring mechanism.

The gap down to the camp's top swatch row is measured two different ways. Desktop uses
`FOLD4_HEADER_GAP` (36) as **plain px, header center → swatch center** — fixed, NOT
frame-scaled (it used to multiply by `H/982`, which made this the one distance in the
scene that changed on window resize; per explicit instruction it holds constant — ~19px
of visible white at any height).
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
  (`squaresRevealTrigger`); the ACLED note follows one fold later, at @fold6 (`acledNoteTrigger`);
- **gain labels at @fold7** (`FOLD6_SQUARE_LABELS`), while square 0 shows the shared
  `#page9Tooltip` with a real event's date + description, grown and typed on its own
  wall-clock sequence;
- **gain colors and fly at @fold8** — `FOLD6_SQUARE_ACTORS` (via `groupColorByActor`) gives
  each its group color, and `fold6SquareOccurrence(i)` says which chronological occurrence
  of that actor it stands in for. The real cascade never draws those 8 events
  (`p7GetClaimedEvents`), so the DOM square just stays once it lands.
- **shrink with the @fold10 glide** — as page8's blend carries them down to the legit
  band, both position *and size* lerp by the same ease (`js/update-groups.js`): the end
  size is the band's own rule (`legitGeom.cell` in bar mode, else `p9Metrics().legitSq`),
  matching what page8.js uses for canvas dots. On big desktop that's a no-op (legitSq =
  timeline size); on ≤1600 desktop and mobile the squares used to stay at timeline size
  and read as oversized dots on the band.

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
among the squares at all — פעילי שמאל's first event is 2023-02-27 and קבוצות ימין לאומיות's
is 2023-01-10. Swapping indices 5/7 for `row-22` / `row-377` is a one-line roster change if
that ever reads badly.

`FOLD6_SQUARE_ACTORS` must **mirror** the roster's rows: it stays a static array because
`FOLD6_SQUARE_COLORS` is computed from it at parse time, before events.json exists. The
occurrence number the lookups actually need is derived from the loaded data at first use
(`fold6SquareOccurrence(i)` → `p7OccurrenceOfRowId`, `page7.js`) and cached per slot, so
**editing the xlsx can no longer silently slide a square onto a neighbouring event** — it
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
`acledNoteTrigger` (@fold6, the ACLED card) by **typing in** character by character over the
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
`fold6SyncNoteHome()` re-parents them one by one into the מקרא panel, so wrapping them would
have meant redoing both. It is appended **first** into `#fold6NoteLayer`, and since everything
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
*not* track the typing — that read as a slow sweep, and was briefly a hard `0`/`1` snap instead;
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
rule's ink trim is measured against that line-height. It reparents into the מקרא panel
with the note and the rule (`fold6SyncNoteHome`) and takes the same `hidden` gate on mobile.

The stack reads downward from the bottom row: the **title** sits `FOLD6_NOTE_TOP_GAP`
(**17px** — the old 8+1+8 collapsed into one number, so the distance is unchanged) below the
rows with the note `FOLD6_NOTE_TITLE_GAP` (**4px**) under the title's measured box, and
the rule runs alongside all of it.

The note box is a fixed `FOLD6_NOTE_WIDTH` = **155px** wrap width (`js/groups.js`); in the
mobile panel it has no width at all and fills the panel. It is RTL and right-aligned, so it hugs the rule and extends leftward. Editing `FOLD6_NOTE_WIDTH` re-wraps the
note and changes its height; the legend rows no longer move with it (the old
`fold6NoteShiftPx` row pre-shift is gone) — the note just extends further down.

## The mobile מקרא bar

**Under 600px there is no on-canvas mini-legend.** From `@fold4` on, the legend is a
persistent bar pinned to the top of the viewport (`js/groups.js`, `.fold6-mlegend`):

```
        [ מקרא ]          ← button, centered
מחנה הימין        גוש השינוי   ← the REAL @fold2 camp headers, risen into place
┌───────────────────────────┐  ← the panel, only while open
│ 3 coalition rows │ 3 change rows │
│ איסוף הנתונים / ACLED note …          │
└───────────────────────────┘
```

- It lives in its **own** layer, `#fold6MobileLegendLayer` (a direct `.layout` child, like
  `#fold6NoteLayer` and `#page9CatTooltip`). It is *not* in `#fold6NoteLayer`: that one is
  `aria-hidden` + `pointer-events: none`, which a button cannot be. The layer passes clicks
  through; only `.fold6-mlegend` takes pointer events, and only once `updateGroups` has
  faded it past halfway.
- **Stacking — the title block wins, but the button stays tappable.** The layer is
  `z-index: 3`: it *has* to out-stack the full-viewport `.text-section` boxes, or no tap
  ever reaches the button. The title block still paints over the bar because
  `.section-text.text-card` lifts itself to **4** (mobile only, with
  `.text-section > .section-text.text-card` supplying the `position: relative` — the child
  combinator leaves `@fold11`/`@fold12`'s sticky/fixed cards alone). That lift only escapes
  because **`.text-col` deliberately carries no `z-index`** — giving it one re-opens a
  stacking context and traps every descendant under the bar again. Side effect of the same
  change: `.page9-tooltip`/`.page9-pill-ghost` (`z-index: 1000`) now really are above
  everything, matching `#page9CatTooltip`. **While the panel is open that flips:**
  `fold6SetMobileLegendOpen` puts `.is-open` on the **layer** as well as the bar, and
  `.fold6-mlegend-layer.is-open` goes to `z-index: 5` — over the card, since the reader
  just asked to see the panel. It must be the layer: the layer is the stacking context, so
  a z-index on `.fold6-mlegend` could never climb past its 3.
- **The button's only state is `.is-open`'s filled chip.** Being a real `<button>`, it also
  got the UA's tap highlight — a grey halo overflowing the 999px pill shape — plus a focus
  ring that outlived the tap. Both are cancelled explicitly
  (`-webkit-tap-highlight-color: transparent`, and `outline: none` on `:focus`/`:focus-visible`),
  the same treatment the pill ⓘ needs — see [Drag-and-Drop](Drag-and-Drop.md#the-pill-ⓘ-button).
- **The panel spans the bar's full width** — the screen less `.fold6-mlegend`'s 12px
  insets (per explicit instruction; it was briefly shrink-wrapped to the mini-legend).
- **Scroll cost while open — keep both guards.** The open panel is a full-width white card
  with a 20px-blur `box-shadow`, sitting in a `position: fixed` full-viewport layer over a
  canvas that repaints every frame; scrolling with it down used to stutter. Two things fix
  it and both are load-bearing: `.fold6-mlegend-panel` carries `transform: translateZ(0)`
  + `contain: paint` so it is composited rather than re-rasterised with the canvas, and
  `fold6SetMobileLegendVisible` caches its last `vis` and skips the write when unchanged —
  it runs from `updateGroups`, i.e. once per scroll frame, and `vis` is pinned at 0 or 1
  outside `fold6Trigger`'s own ~1.9s ramp, so nearly all of those writes were no-ops that
  still dirtied the subtree for repaint.
- **Inside, the layout mirrors `@fold3` on screen.** Only the **camp title** is centered
  (over its own column, `align-self: stretch` + `text-align: center`). The **group rows are
  not** — `.fold6-mlegend-col` is `align-items: flex-start`, so every row shares the
  column's start (right, under `dir: rtl`) edge, swatches in one vertical run and labels
  right-aligned, exactly as `updateGroups` leaves them at `@fold3`. The two columns sit
  `justify-content: space-around` — one per half of the full-width panel — with a 12px gap.
  Labels are `white-space: nowrap` and each column is `flex: none`, so a column widens to
  its longest group name instead of wrapping (explicit instruction; the on-canvas rows still
  wrap at their 120px cap). `.fold6-mlegend-rows` is `overflow-x: auto` as a guard for the
  narrowest phones, where the two unwrapped columns can out-measure the panel.
- **The six `groupItems` don't go anywhere** *(typed hand-off only — with `FOLD4_FLY` on,
  the default, they fly into the panel instead; see the two-versions bullet below)*. At
  `@fold4` they leave from exactly where
  `@fold3` left them (per explicit instruction — they used to fly into the button): the
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
  `top` used to slide it up: the swatch's own center (`swatchSize / 2`, following the
  shrink) and `firstLineShift` (faded over `e6`). Both are fixed —
  `labelAnchorSwatch` holds the pre-shrink size for the label's anchor only, and
  `firstLineShift` fades over `fold6ShapeT` instead of `e6`, so on mobile it holds.
- **The camp names live inside the panel** (per explicit instruction — they used to rise
  onto the screen). Each column is headed by a static `.fold6-mlegend-camp` carrying
  `CAMP_HEADER_TITLE_COALITION` / `_CHANGE`, with a **12px** gap below it (double the 6px
  pitch between the group rows, so the camp → groups split reads at a glance). On screen, `campHeaderCoalitionEl`/
  `ChangeEl` un-type at `@fold4` **exactly as on desktop** — there is no mobile branch on
  the untype factors and no mobile glide — so past `@fold4` the button is the only thing
  left of the camps.
- **One number positions the bar:** `FOLD6_MLEGEND_TOP_MOBILE_PX` (**16px**), its distance
  from the top edge. It never moves; `fold6PlaceMobileLegend()` writes that
  constant as the `top` each frame, which is why `.fold6-mlegend` has none in the stylesheet.
- **The button arrives early and pops.** It does *not* ride `fold6Trigger`'s full ~1.9s ramp
  — fading one small button over that long reads as never arriving. `fold6SetMobileLegendVisible`
  re-maps the progress onto a front-loaded slice, `FOLD6_MLEGEND_IN_SPAN` (**0.3**), and
  scales the **button** (not the bar — the bar contains the panel) in with
  `fold8TooltipGrowEase`, the same pop the panel and the `@fold7` tooltip use. So it lands
  while the on-canvas rows are still leaving behind it. The `@fold4` intro below still waits
  for the *unmapped* progress to reach 1.
- The panel's rows are a **separate static copy** of the six groups, not the animated
  `groupItems` — those are mid-flight whenever the panel is closed. Same two-column split,
  same sides (coalition right, by `dir: rtl` + source order), each column sorted by `fold6.y`.
- The ACLED note and its title are **moved**, not duplicated, into the panel by
  `fold6SyncNoteHome()` — one set of nodes, one ACLED link. Crossing the breakpoint reparents
  them back; `.is-in-panel` undoes their `position: absolute`, and the inline
  `left/top/width/opacity` are cleared on the way in. They still fade on
  `acledNoteTrigger`, so opening the panel before `@fold6` shows no credit.
- Open/close: tap the button, tap outside, or Escape. Resizing to desktop closes it
  (`fold6SetMobileLegendVisible(0)`).
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
    **unwraps continuously**: the stand-in's label is laid out `nowrap` as one span per
    rest line (`fold6MFlyRestLines` reads the real wrap off the browser via a Range per
    word), and each line after the first is translated from its wrapped rest spot (flush
    right, `i` line-heights down) to its inline spot, lerped by `flyT` — the second line
    visibly **slides up into the sentence** instead of re-breaking. There is no wrap-cap
    lerp: a cap change re-breaks the text, and a re-break hops a word to another line in
    one frame no matter how the box is anchored ("position never snaps"). The hidden real
    label's cap is frozen at the rest cap for the whole flight. The
    first-line shift fades out over the same `flyT`. The label keeps **every character**:
    no un-typing, it is the same row arriving somewhere else.
  - **The frame fades in, it does not scale in** (`FOLD6_MFLY_FRAME_MS` = 350) — a scaled
    frame reports scaled rects, so the rows would be aiming at a moving target.
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
    too high and snapped it down on the swap, and made the tallest (3-line) label crawl as
    it unwrapped. The two
    constructions otherwise disagree by a pixel or two (the canvas row centers its label on
    the swatch's middle; the panel centers the swatch on the line box).
  - **The two camp headers fly too** (`placeCampHeader`, `js/update-groups.js`): they travel
    onto the panel's own `.fold6-mlegend-camp` headings (kept in `fold6MobileCampHeadEls` as
    the panel is built), 18px → `FOLD6_MFLY_HEAD_PX` (14), keeping every character — the
    mirrored un-typing (`fold6BeatT("headerCoalition"/"headerChange")`) is suppressed while
    flying. Both ends are center anchors (`.camp-header` is `translate(-50%, -50%)`,
    the target is the heading's measured center), so it is a plain `e6Fly` lerp with the same
    stand-in + swap treatment as the rows. The panel's own headings are held at **opacity 0**
    alongside its rows (`fold6MFlySetRowsShown` covers both) and appear on the same landing
    frame — a heading already sitting in the panel gives the arrival away.
  - **The flight is painted by stand-ins in TWO parking layers**, not by the `groupItems`
    themselves (`fold6MFlyPaintClone`/`.fold6-mfly-layer`). `.groups-overlay` lives inside
    `.graphic-col` (`position: fixed; z-index: 0` = a stacking context), so no z-index it
    or its children carry can climb past the open layer's mobile `z-index: 1002` — the
    rows flew *behind* the panel. Six bare `.group-item` copies parked in a
    `pointer-events: none` layer appended **after** the panel therefore wear the frame
    instead: `updateGroups` writes the row as usual, then copies its three `cssText`s onto
    the stand-in and hides the real one with `.is-mfly-hidden` (`visibility: hidden`, so it
    stays laid out — `item.label.offsetWidth` is read from it every frame). No coordinate
    translation is needed: every layer involved is `position: fixed; inset: 0`.
    **Which** layer a stand-in sits in is decided per frame, per element (`fold6MFlyPark`),
    because the requested order is a z-index cycle — title block above the rows, open legend
    above the title block, rows landing on top of the panel. `.fold6-mfly-layer-under`
    (inserted before the מקרא layer, `position: fixed; z-index: 1` — above the canvas, below
    the mobile card's 4) carries the flight; `.fold6-mfly-layer` inside the open מקרא layer
    carries the landing. The test is **"is this element inside the panel's box"** — both
    edges, `fold6MFlyPanelRect.top`/`.bottom` ± `FOLD6_MFLY_PARK_SLACK` (6, the ink above a
    wrapped row's anchor). A one-sided "below the top" test is wrong and was corrected: the
    bar hangs from the **top** of the screen (`FOLD6_MLEGEND_TOP_MOBILE_PX` = 16), so its
    panel's top edge sits above nearly the whole canvas and every stand-in stayed in the OVER
    layer for its whole flight — i.e. over the title block, the opposite of the ask. With
    both edges the switch can never be seen: an element only changes layer over a region it
    does not overlap yet. It is decided from the `y` `updateGroups` just wrote, never from a
    `getBoundingClientRect` on the stand-in — that would be a forced reflow per element per
    scroll frame.
  - **The stutter budget**: during the flight the hidden real label's wrap cap is
    **frozen** (nothing reads its layout mid-flight) and the stand-in never wraps at all —
    its sliding line spans (above) are the only re-layout the unwrap costs, and their
    per-frame writes are two `transform` strings. The `fontSize` itself stays **continuous** (per
    explicit instruction): rounding it to whole px cut more re-layouts still, but 18 → 14
    in four steps reads as the text snapping down in size.
    **The anchors below only work if `.group-label.is-mfly-topanchor` actually parses.**
    The historical "one group stutters" bug (מפגינים ערבים ישראלים lurching on every
    re-break, all labels sitting a full width right of their swatch) was ultimately a
    stray `*/` in the comment above that rule in `style.css`: CSS error recovery ate the
    junk *and the selector after it*, so `translateX(-100%)` never applied and every
    re-break moved the visible text. If the unwrap ever stutters again, verify that rule
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
  - The **arrival** starts the hold-then-close (`fold6MFlyArrive`, called once per frame
    from `updateGroups`), not a rAF clock of its own: the flight rides `fold6Trigger`'s
    `e6Fly`, so it lands when the scroll animation lands. The same function **cancels the
    pending close if the arrival progress drops back below 1** — a reader scrolling up
    mid-hold takes the rows back off, and the close must not fire under that reverse
    flight.
  - **The hand-off plays in REVERSE on scrolling back up** (`js/groups.js`,
    `fold6MFlyMaybeReopen` / `fold6FadeOutMLegendFlyIntro`, wired in
    `fold6SetMobileLegendVisible`):
    - Mid-flight or mid-hold, the trigger's own reversal already flies the rows back
      (every lerp rides `e6Fly`, and `makeTrigger` reverses over the remaining
      distance); the panel frame stays open under them.
    - **After the close** (panel already shrunk into the button), a *decreasing* `vis`
      reopens the frame first (`fold6MFlyMaybeReopen` → the intro's own
      `fold6PlayMLegendFlyIntro` fade-in, rows at opacity 0) so the reverse flight has a
      panel to fly out of. Decreasing-only is binding: riding downward past a
      tap-dismissed demo must not resurrect it, and a hand-opened panel is left alone
      (`fold6MobilePanelEl.hidden` guard).
    - Once `vis` is back at 0 the empty frame **fades out** over the same
      `FOLD6_MFLY_FRAME_MS` (350) — `fold6FadeOutMLegendFlyIntro`, the mirror of the
      fade-in, not the close's shrink — then the panel closes and the intro state rests.
      The fade-out picks up the frame's current opacity (a fast flick can reverse while
      the fade-in is still running), self-terminates via the `fold6MFlyFadeOut` flag if
      a re-entering fade-in or `fold6StopMLegendIntro` interrupts it, and the instant
      `vis <= 0` close is suppressed while it runs.
- **The `@fold4` typed hand-off intro** (`fold6PlayMLegendIntro`, `js/groups.js`): the on-canvas
  rows leave by shrinking and un-typing *in place*, which reads as "gone" but not as "gone
  **there**". So the moment `fold6SetMobileLegendVisible` is handed any `vis > 0` — i.e.
  `fold6Trigger` has *started* — the panel opens by itself and plays the same gesture in
  reverse inside itself, **while the on-canvas rows are still un-typing**. Firing it on
  `vis >= 1` instead (waiting for the rows to finish leaving) is wrong and was corrected: it
  put a ~1.9s gap in the middle of the hand-off, so it read as two unrelated events instead
  of one move seen at both ends at once.
- **It all runs on one clock** (per explicit instruction) — no per-row stagger, and the rows
  do not wait for the frame. From a single `t0`: the panel scales `0 → 1` over
  `FOLD6_MLEGEND_INTRO_GROW_MS` (350) **from its top edge**
  (`transform-origin: top center`, since it hangs off the button and must grow downward),
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
- **`@fold4` itself fires earlier on mobile** — `FOLD6_CARD_FRAC` (**0.8**, vs the house
  0.5; bigger is earlier) — so the whole hand-off, hold and shrink fit while the fold is
  still on screen. Desktop keeps 0.5.
- Then it holds the finished legend for `FOLD6_MLEGEND_INTRO_HOLD_MS` (**300**) and
  **shrinks back up into the button** over `FOLD6_MLEGEND_INTRO_CLOSE_MS` (300) —
  `fold6CloseMLegendIntro`, same top-edge origin, so the demo visibly returns the legend to
  the control that now holds it instead of blinking out. The close uses plain `p9Ease`, not
  the back-out curve: overshoot belongs to things appearing, and on the way out it would
  push the frame briefly *bigger* as it leaves. Rows are restored to full size only after
  the panel is hidden, so a hand-opened panel always comes back whole.
- **The ACLED note never joins the panel mid-demo.** `fold6MLegendIntroActive` is true for
  the whole intro (grow + hold + shrink), and `updateGroups` keeps the note + rule
  `hidden` — out of layout, not just transparent — while it is. On a fast scroll @fold6
  (`acledNoteTrigger`) can be crossed while the demo is still playing, and the note
  flowing in would grow the frame taller under rows that are still typing. It first appears
  when the reader **taps מקרא**: any tap aborts the intro, and both the abort and the
  natural end go through `fold6EndMLegendIntro`, which un-hides it by hand — `updateGroups`
  only runs on scroll frames, and the demo usually ends with the page standing still. The
  note's own @fold6 ramp still gates it, so tapping before @fold6 shows no credit.
- **The מקרא button un-fills *with* that shrink, not after it.** `fold6CloseMLegendIntro`
  removes `.is-open` from the bar at the *start* of the close, and `.fold6-mlegend-btn`
  carries a 300ms `background`/`border-color`/`color` transition matching
  `FOLD6_MLEGEND_INTRO_CLOSE_MS`, so black→white and the frame leaving are one move. The
  `.is-open` rule sets `transition: none`, so *pressing* the button still fills it
  instantly — a transition declared on the base state only runs when the element returns
  to it. Keep the two durations in step if either changes.
- **The frame's curve is `fold8TooltipGrowEase`** (`js/fold8-tooltip.js`), the same subtle
  back-out pop `@fold7`'s tooltip grows with — the panel should read as the same kind of
  object the reader met one fold earlier. The rows use the house `p9Ease`. The inline
  transform the intro writes **replaces** the stylesheet's `translateZ(0)` compositor-layer
  promotion, so it repeats it (`translateZ(0) scale(g)`) and clears the property outright at
  rest rather than writing `scale(1)`.
- It is **one-shot per crossing**: the `fold6MLegendIntroPlayed` flag clears when `vis`
  returns to 0 (scrolled back above `@fold4`), so coming down again replays it. Any tap —
  the button, outside, Escape — calls `fold6StopMLegendIntro()`, which cancels the rAF and
  the hold timer and restores every row to full text and an unscaled swatch, so a panel
  opened by hand is never caught mid-animation. Desktop never runs it (`isMobile()` guard).
- `fold6NoteShiftPx` is **0** on mobile (no rows on screen to shift), which also makes
  `FOLD6_LEGEND_TOP_MOBILE` inert.

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

**An element scaled or sized toward zero is not reliably invisible.** Its last frames
cover a fraction of a device pixel, and on a DPR>1 phone the compositor renders that as a
faint speck rather than as nothing. Both places that retire an element by size alone were
leaving marks on screen at `@fold4`, most visibly on the way back up:

- **The six group swatches** shrink in place on mobile (`swatchSize *= 1 - e6`). Their
  opacity is now multiplied by `swatchSize / SWATCH_VANISH_PX` (clamped), so the last CSS
  pixel of the shrink is also a fade to 0. `SWATCH_VANISH_PX` is **1** — the fade runs
  entirely inside a pixel that was already invisible, so no beat's visible timing moves.
- **The 8 sample squares** rest at `scale(growScale)`, and at `growScale` 0 the eight
  specks sat in `FOLD6_SQUARES_OFFSET`'s 2×4 arrangement, reading as two small wedges
  mid-screen on every fold before `@fold6`. Their wraps are now `display: none` whenever
  `growScale` is 0. `display: none` is safe here **only** because nothing measures these
  wraps — `layoutFold6Squares` writes their `left`/`top` from constants. Anything that
  needs measuring must use the opacity form instead.

Same family as the timeline dots' phantom stroke ([Timeline](Timeline.md)): sub-pixel
geometry on a high-DPR screen paints something, not nothing.
