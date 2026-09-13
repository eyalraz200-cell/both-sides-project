// page7.js — scroll-driven event timeline
// ── Appearance controls ──────────────────
// Square size/gap were originally matched to page9.js (P9_SQ 3 / P9_GAP 1) since
// page7 and page9 will later be cross-animated. This revision deliberately makes
// the timeline dots BIGGER and their GAPS BIGGER — the grid auto-fits the same
// box (cols/rows = floor(box / P7_CELL) in p7GridGeometry), so the box
// boundaries (SBB_TIMELINE/leftX0) are unchanged; only the dot count drops.
// NOTE: page9 still uses 3/1, so the two no longer agree — reconcile before any
// page7↔page9 cross-animation. Placement builds outward from the center gap
// (see p7OrderFromCenter), not page9's column-major grid.
const P7_SQ  = 3.5;  // square size in px (was 3)
const P7_GAP = 1.5;  // gap between squares in px (was 1)
const P7_CELL = P7_SQ + P7_GAP; // grid cell size
// On mobile the square size is SOLVED per viewport, not fixed. A fixed pitch
// has to be small enough for the smallest phone, which left every larger one
// with capacity far above its event count — and since p7OrderFromCenter sizes
// its usable pool to the side's own events, that surplus showed up as a thin
// scatter of dots in a box mostly made of gaps. p7SolveMobileSq instead picks
// the LARGEST square whose grid still holds the bigger camp, so the dots grow
// to fill whatever box the phone actually has.
//
// P7_MOBILE_FILL is how much of the grid the bigger camp is allowed to occupy
// at most — the remainder is the deliberate scatter of permanent gaps, so 0.86
// keeps the texture the desktop grid has rather than packing the box solid.
// The gap stays half the square (1.5/0.75 was the same ratio) so the density
// reads the same at every solved size.
const P7_MOBILE_FILL      = 0.86;
// 1.25 is only ever reached by the very smallest phones (320×568 needs ~1.35 to
// hold the right camp inside the taller axis clearance); every phone from
// 320×700 up solves well above it. Below ~1.2 a square stops reading as a mark
// at all, so the floor is where truncation is preferred to invisibility.
let   P7_MOBILE_SQ_MIN    = 1.25;  // `let` only so a manual/ harness can drive it live
const P7_MOBILE_SQ_MAX    = 3;     // just under desktop's 3.5
const P7_MOBILE_GAP_RATIO = 0.45;  // manual/ pick 2026-09-13, tuned with P7_VERT_SQ_BOOST + zoom
const P7_MOBILE_SQ_STEP   = 0.05;
let p7MobileSq = P7_MOBILE_SQ_MIN;  // rewritten by p7UpdateLayout

// sideW/sideH are one camp's box in px; maxEvents the bigger camp's count.
// Walks down from the max because the first size that fits is the biggest one.
function p7SolveMobileSq(sideW, sideH, maxEvents) {
  if (!maxEvents) return P7_MOBILE_SQ_MIN;
  for (let sq = P7_MOBILE_SQ_MAX; sq >= P7_MOBILE_SQ_MIN; sq -= P7_MOBILE_SQ_STEP) {
    const cell = sq * (1 + P7_MOBILE_GAP_RATIO);
    const cap  = Math.floor(sideW / cell) * Math.floor(sideH / cell);
    if (cap * P7_MOBILE_FILL >= maxEvents) return Math.round(sq * 100) / 100;
  }
  // Nothing fits even at the floor: keep the floor and let p7OrderFromCenter's
  // own min(total, maxEvents) clamp truncate, rather than shrinking below the
  // size at which a square is still visible.
  return P7_MOBILE_SQ_MIN;
}

// Live reads (isMobile() reads innerWidth), same convention as sbbTimeline().
// Desktop's square is solved too now that rows are dates (p7SolveVerticalSq):
// null until the first layout, then whatever size lets every day's events fit
// their rows — P7_SQ when the box is big enough.
let p7DesktopSq = null;
function p7Sq()   { return isMobile() ? p7MobileSq : (p7DesktopSq || P7_SQ); }
function p7GapRatio() { return isMobile() ? P7_MOBILE_GAP_RATIO : P7_GAP / P7_SQ; }
function p7Cell() { return p7Sq() * (1 + p7GapRatio()); }
// Bounds of the vertical square solve (p7SolveVerticalSq) per breakpoint.
function p7SqMax()  { return isMobile() ? P7_MOBILE_SQ_MAX  : P7_SQ; }
function p7SqMin()  { return isMobile() ? P7_MOBILE_SQ_MIN  : 1.5; }
function p7SqStep() { return isMobile() ? P7_MOBILE_SQ_STEP : 0.1; }
// ─────────────────────────────────────────

// Shared left-grid geometry — leftX0 comes from sbbTimelineLeftX (a fixed px on desktop,
// a rounded fraction on mobile; rounding matters because a raw float just under a whole
// px, e.g. 392.00000000000006, makes Math.floor(sideW/CELL) silently drop a column).
// DESKTOP: the year axis runs vertically down the centre (see the VERTICAL
// AXIS block below), so the centre gap is the wider P7_AXIS_CORRIDOR_PX
// corridor rather than CENTER_GAP. Mobile keeps CENTER_GAP + the horizontal axis.
// Mobile joins the vertical path behind P7_VERT_MOBILE.enabled (Phase 1 —
// a compare/ harness flips it; off = the old horizontal axis).
function p7VerticalAxis() { return !isMobile() || P7_VERT_M.enabled; }
function p7CenterGap() {
  if (!p7VerticalAxis()) return CENTER_GAP;
  const V = p7V();
  if (V.headline !== 'widen') return V.corridorPx;
  // Mobile's widen corridor is SOLVED from the headline copy (p7SolveMobileCorridor).
  return isMobile() ? (p7.mobileCorridorPx || V.wideCorridorPx) : V.wideCorridorPx;
}
function p7GridGeometry(W, H) {
  const outerX  = sbbTimelineLeftX(W, H);
  const gap     = p7CenterGap();
  const rightX0 = W / 2 + gap / 2;
  const sideW   = W / 2 - gap / 2 - outerX;
  const CELL    = p7Cell();
  const cols    = Math.floor(sideW / CELL);
  // Desktop: both grids HUG the corridor, so the corridor edges sit at exactly
  // W/2 ± gap/2 and the floor()'s leftover px goes to the outer edge on both
  // sides (mirror-symmetric). Mobile keeps the left grid anchored at outerX.
  const leftX0  = p7VerticalAxis() ? W / 2 - gap / 2 - cols * CELL : outerX;
  return { leftX0, rightX0, cols, CELL };
}

// Looks up an event's color via GROUPS (js/groups.js) rather than a separate
// hardcoded palette, by events.json's actor string — the same join key
// stored on GROUPS' 5 camp entries as `actor` — so every real per-event
// square (here, page8.js's transition glide, and page9.js's grids) always
// matches the legend's current color, including after a future edit to
// GROUPS. js/groups.js loads after this file, but GROUPS only needs to exist by
// the time a square is actually drawn, long after all scripts have run.
function p7ActorColor(actor) {
  const group = GROUPS.find(g => g.actor === actor);
  return (group && group.color) || "#888";
}

// events.json stores dates as YYYY-MM-DD; both the per-event hover tooltip
// (page7.js/page9.js) and the axis event labels below display them as
// DD.MM.YYYY instead.
function p7FormatDateDMY(dateStr, sep = "-") {
  const [y, m, d] = dateStr.split('-');
  return `${d}${sep}${m}${sep}${y}`;
}

const p7 = {
  ready: false,
  leftEvents:  [],
  rightEvents: [],
  currentDate: "",
  minDate: "",
  maxDate: "",
  leftPos:  [],
  rightPos: [],
  // Solved geometry, at zoom-out 1. Never read these directly for drawing —
  // read p7.CELL / p7.SQ / p7.leftX0, the getters defined beside p7Fit, which
  // blend these toward @fold9's end-of-fill fitted layout.
  cellBase: 6, sqBase: 4, leftX0Base: 0,
  cols: 0, rows: 0,
  vert: null,   // p7BuildVerticalLayout result on desktop (see VERTICAL AXIS), null on mobile
  lastW: 0, lastH: 0, lastMaxEvents: -1, lastVertical: null,
  // Per-event {x,y,alpha} from the most recently drawn frame (page9.js's
  // p9.lastPositions pattern) — built fresh in drawPage7 every frame, read by
  // p7HoverInit below to hit-test the mouse against the real timeline's
  // squares. x/y is each square's settled grid-cell position (not its
  // mid-animation blended position — same "store the target, not the
  // transient" convention p9PlaceDot uses), so hit-testing stays stable
  // while a square is still popping in/out.
  lastPositions: new Map(),
  // The event currently under the pointer in #page-8 (set by p7HoverInit's
  // onMove), or null — read by p7DrawSideSquares to dim every other square
  // while one is hovered.
  hoveredEvent: null,
  hoverDimT: 0,        // 0..1 ramp of the hover dim — see P7_HOVER_DIM_MS
  // Per-axis-event {x,y,radius} (CSS px) of the persistent circle markers drawn
  // on the year axis this frame — built by p7DrawAxisEvents, read by p7HoverInit
  // to hit-test the pointer against those circles. Only reached events (whose
  // circle is actually on the axis) get an entry.
  axisEventPositions: new Map(),
  // The axis event (an entry of P7_AXIS_EVENTS) whose persistent circle is under
  // the pointer, or null — forces that event's headline label + date to re-show
  // at full opacity even after it has crossfaded away. Distinct from
  // hoveredEvent above, which tracks the timeline squares, not axis circles.
  hoveredAxisEvent: null,
};

// Park-Miller seeded RNG
function p7Rng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; };
}

function p7Shuffle(arr, seed) {
  const rng = p7Rng(seed);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Orders a side's grid cells by distance from the center gap, nearest-first, so that
// as events accumulate over time the dots build outward from the center divider toward
// the side's outer edge, one band of columns at a time ("vertical line by vertical
// line") — rather than scattering randomly across the whole grid. A wide random jitter
// is mixed into the distance itself (not just used as a same-column tiebreak), so
// nearby columns' cells interleave and the growing edge reads as organic/free-form,
// not a perfectly solid rectangular block advancing column by column.
//
// The usable-cell pool is sized to exactly this side's own event count (maxEvents),
// not the grid's full physical capacity. Two things fall out of that: (1) since the
// pool is sampled uniformly across the *entire* column range before being distance-
// sorted, using up the whole pool by the time all of a side's events have been placed
// reaches the same final column — i.e. the same width — on both sides, even though
// the left and right datasets have very different total event counts; (2) since the
// pool is always smaller than total physical cells, visible gaps remain throughout
// (including the long-settled core) instead of the grid fusing into a solid block.
const P7_ORDER_JUMBLE_COLS = 14; // how many columns' worth of cells interleave at the edge
function p7OrderFromCenter(total, cols, seed, side, maxEvents) {
  const rng = p7Rng(seed);
  const usableCount = Math.min(total, maxEvents);

  const items = [];
  for (let c = 0; c < total; c++) {
    const col      = c % cols;
    const baseDist = side === "left" ? (cols - 1 - col) : col;
    const jitter   = (rng() * 2 - 1) * P7_ORDER_JUMBLE_COLS;
    items.push({ c, key: baseDist + jitter, gapRoll: rng() });
  }

  // Pick the permanently-empty cells via a random roll (independent of distance), then
  // order only the remaining usable cells by distance-from-center for the actual fill.
  items.sort((a, b) => a.gapRoll - b.gapRoll);
  const usable = items.slice(0, usableCount);
  usable.sort((a, b) => a.key - b.key);
  return usable.map(o => o.c);
}

/* =========================================================================
   VERTICAL AXIS (desktop, p7VerticalAxis) — date-driven row layout
   =========================================================================
   The year axis is a vertical line at W/2 running top → bottom through the
   corridor between the two camps. Every dot's ROW is its date, and each camp
   grows OUTWARD from the axis along that row, so the dots follow the axis's
   fill edge down the screen. Every row stands for the same fixed span of
   days (p7V().daysPerRow, counted from minDate), so the axis is linear in
   time and a row's fill width IS its event count. A day with more events
   than its row can hold spills DOWN into the next row, never up, so a row
   never shows anything from before its span.

   Within a row the fill starts at the corridor and walks outward in date
   order; a random roll can leave permanent gaps (1 − fillRatio of the cells,
   off at fillRatio 1). Deterministic (p7Rng) so the layout is stable across
   frames and resizes.

   P7_VERT is the tunable bundle (edited live by a compare/ harness while the
   headline placement is being compared — see wiki/Timeline.md):
     eventMode "band"  — the dot flow pauses at each headline event: bandRows
                          empty rows are reserved and the headline + date sit
                          in that band, centred on the axis.
     eventMode "widen" — no rows reserved; instead the whole corridor is
                          wider (wideCorridorPx, top to bottom) so every
                          headline fits inside it beside the axis.
     eventLine         — A2: a faint full-width line at each reached event's row.
   ------------------------------------------------------------------------- */
// Tooltip horizontal flip lines (screen px): a hovered dot left of P7_TIP_FLIP_L
// never mirrors; one within P7_TIP_FLIP_R_INSET of the right edge always does.
// One mirrored inset, picked by eye with a manual/ harness on 2026-09-05 —
// exact px, never vw. Used in the hover closure (search "P7_TIP_FLIP_L") and,
// deliberately shared rather than re-tuned, by @fold13's dot hover in page9.js
// — the two tooltips must never disagree about which way they open.
const P7_TIP_FLIP_L = 327;
const P7_TIP_FLIP_R_INSET = 327;

const P7_VERT = {
  corridorPx: P7_AXIS_CORRIDOR_PX,
  eventMode:  "widen", // picked 2026-09-04 (harness deleted; band code kept, unused)
  headline:   'widen', // where the headline copy lives: 'widen' (card in a wide corridor) | 'band' (rule + band across the grids) | 'slot' (one line under the grid)
  yearLabelPx: 14,     // the year label's font size (its block height is this + 3) — 14 bold beside the line (2026-09-06)
  yearLabelWeight: 700, // the year label's font weight
  // Alpha of a REACHED year label when the digits sit beside the line
  // (yearSide 'left'/'right'): the year is a quiet reference next to the line,
  // not a heading, so it never goes as dark as the centred label's
  // P7_AXIS_LABEL_COLOR. Unreached stays P7_AXIS_LABEL_FAINT_COLOR.
  yearSideAlpha: 0.3,
  bottomInsetPx: 0,    // mobile-only: px between the box's bottom and the viewport bottom
  slotPx: 0,           // 'slot' headline mode: band height reserved under the grid
  // 'slot' mode: fill null = bare copy on the page background; a colour = a
  // plaque behind the block, sized to the wrapped lines. Declared as a full
  // object rather than null because p7VertMerge only recurses into keys the BASE
  // already holds as objects — a null here would silently swallow the mobile
  // override.
  slotCard: { fill: null, color: '#000000', dateColor: 'rgba(0, 0, 0, 0.3)', padX: 12, padY: 8, radius: 4 },
  slotAnchor: 'grid',  // 'slot' mode: where the line prints — 'grid' (centred in the reserved band under the grid) | 'bottom' (pinned to the viewport's bottom edge) | 'top' (pinned to the viewport's top edge) | 'fill' (centred on the axis, slotFillGapPx under the fill edge; flips above it when the box has no room below) | 'dot' (EVERY reached event keeps a card on its own dot, riding the camera — p7DrawVertDotCards) | 'dotAbove' (only the NEWEST reached event has a card, fading in above its dot; the previous one fades away) | 'side' (desktop-style: every reached event's plaque fades in BESIDE its dot, alternating sides, wrapped to sideWrapPx; the dots in the rows it covers are pushed outward so they stay uncovered)
  dotGapPx: 6,         // 'dot' anchor: px between the dot's edge and its card; 'side': px between the plaque's far edge and the pushed dots
  sideWrapPx: 150,     // 'side' anchor: the plaque's wrap width (mobile has no corridor to wrap to)
  sidePush: false,     // 'side' anchor: true = the dots in the rows a plaque covers slide outward past it (p7VertCardPush); false = the plaque prints over them
  sidePlace: 'alternate', // 'side' anchor: where the plaque sits vs its dot — 'alternate' | 'left' | 'right' | 'above'
  sideLeadPx: 80,      // sidePhase 'before': the plaque fades out over the last sideLeadPx of the fill edge's approach, gone by the time it reaches the dot (scroll-driven, reversible)
  sidePhase: 'after',  // 'side' anchor: 'after' = plaque fades in once the fill reaches the dot (desktop); 'before' = plaque (and a lead marker) stand at the dot ahead of the fill and fade OUT when it arrives; 'fly' = same lead, but never fades: when the fill reaches the dot the plaque glides from beside it to above it
  sideFlyGapPx: 10,    // sidePhase 'fly': gap between the flown plaque's bottom and the dot
  sideFlyFadePx: 150,  // sidePhase 'fly': once the fill edge is past the dot, the flown plaque fades out over this much further travel (scroll-driven, reversible)
  slotBottomPx: 0,     // 'bottom' anchor only: px from the viewport bottom to the BOTTOM of the text block
  slotTopPx: 0,        // 'top' anchor only: px from the viewport top to the TOP of the text block
  minSidePx: 96,       // mobile-only: a camp grid never gets narrower than this when the corridor is solved
  // ── Camera (mobile compare/, 2026-09-11 — _debug-mobile-zoom.js drives these) ──
  // zoom: the row plan is solved against `zoom` box heights instead of one, so
  // the square grows and the field runs taller than the box; the box then shows
  // a window onto it. 1 = the field fits the box (today).
  zoom: 1,
  // camera: how the window moves when the field is taller than the box —
  // 'none' (the field's top pins to the box top, the rest hangs below; today) |
  // 'fill' (the fill edge is held at fillAnchorFrac of the box; the field
  // scrolls up under it) | 'pan' (the window slides from the field's top to its
  // bottom in step with the fill fraction). A pure offset inside p7VertTopY,
  // derived from the same LAGGED fill fraction the axis draws with, so the
  // camera and the fill line never disagree. No effect while the field fits.
  camera: 'none',
  fillAnchorFrac: 0.6, // 'fill' camera: the fill edge's resting spot, 0 = box top … 1 = box bottom
  slotFillGapPx: 14,   // slotAnchor 'fill': px between the fill edge and the headline plaque
  eventLine:  false,
  bandPx:     60,    // band mode: height reserved per headline (title line(s) + date)
  wideCorridorPx: 256, // widen mode: the corridor, full height (208 by eye 2026-09-05; +24 each side for the zig-zag side cards, 2026-09-06)
  fillRatio:  1,     // no permanent gaps — picked 2026-09-04
  // What one grid row stands for: a fixed span of this many days, counted
  // from minDate — picked 2026-09-04 (8 days: 160 rows fit the box at 3.3px;
  // one-week rows needed 183 and shrank the square to 2.9px). A day with more
  // events than its row holds spills DOWN into the next row, never up.
  daysPerRow: 8,
  // Where the year digits and the headline blocks sit relative to the axis
  // line — since 2026-09-06 (from the user's Figma draft 327:1654): the years
  // beside the line on its RIGHT and the headline cards alternating sides
  // (zig-zag), so the line itself runs unbroken top to bottom with a ring at
  // every 1 January. 'center' for both (everything centred on the line, the
  // line breaking around each year block) is kept as a live code path.
  // yearSide / eventSide 'left' | 'right' = beside the line, text aligned
  // toward it; eventSide 'alternate' = flips per event; dateSide 'left' |
  // 'right' = the date on its own side of the line.
  yearSide:  'right',
  eventSide: 'alternate',
  dateSide:  'with',   // 'with' = in the title block
  dateAbove: true,     // true = the date line sits ABOVE the title; false = under it (and under the bar, see bar.dateBelow) (only when dateSide is 'with')
  sideGap:   8,        // px between the line's marker edge and side-placed text
  // px of breathing room above and below the year digits inside the line's
  // break. The line breaks at every 1 January (and at the top, above the first
  // year); the break is centred on the year boundary and the digits (plus the
  // ring when on) sit centred in it. Purely visual: the dot rows run on
  // unbroken and the break eats the ends of the neighbouring line segments.
  yearGapPad: 3,
  yearRing:   true,    // a hollow ring ON the line at every 1 January (the digits sit beside it, see yearSide)
  // Headline card (centred blocks only). null = bare text on a punched
  // background. Shipped: style 'plain' — white card, no stroke, accent bar
  // along its bottom AND top edge (`barTop`), the dot cut to its outer half on
  // the dot-facing edge and a mirrored outward half-dot on the far edge (`halfDots`).
  // The other styles ('bar' = bare text + bar, 'outline', 'fill', 'dashed',
  // 'shadow', 'accent' = card + faint outline + bar) are kept as code paths.
  // { style, padX, padTop, padBottom, radius, gap (px from the dot's edge to the block),
  //   stem (true = the line stays visible between dot and card; 'bar' always
  //   clears that gap) }.
  //   radiusBottom (the two bottom corners; null = same as radius), bar (true = accent bar along the
  //   card's bottom edge, full card width, for any style), anchor ('edge' =
  //   the card sits `gap` past the dot's edge; 'center' = the card's
  //   dot-facing edge runs through the dot's centre and the dot is redrawn
  //   on top of it).
  card: { style: 'plain', fill: '#FDFCFF', stroke: 'rgba(0, 0, 0, 0.3)', strokeWidth: 1, padX: 16, padTop: 6, padBottom: 6, radius: 4, radiusBottom: 0,
          gap: 0, stem: false, bar: true, barTop: true, sides: false, sidesAlpha: 1, halfDots: true, anchor: 'center' }, // sides = a full rounded border (bar line style, at sidesAlpha) instead of the two bars
  // Side-placed cards (eventSide 'left'/'right'/'alternate') do NOT reuse
  // `card`: they are a plain grey plaque after the Figma draft 327:1654 —
  // flat fill, all four corners rounded, no bars/stroke/half-dots, floating
  // `gap` px off the line (the dot stays whole and uncovered), centred
  // vertically on its dot, the copy centred inside it. Its own smaller type.
  sideCard: { fill: '#ECEBEB', radius: 4, gap: 8, padX: 8, padTop: 4, padBottom: 4,
              type: { size: 12, weight: 400, lh: 19, color: 'rgba(0, 0, 0, 1)' } },
  // The accent bar under a headline: h px tall, `gap` px below the text's
  // last line, `padX` px wider than the text on each side, `alpha` opacity of
  // `color`, `round` = rounded ends.
  // `dateBelow` = the bar sits between the title and the date (title, bar,
  // then the date `dateGap` px under the bar); false = the bar closes the
  // whole block under the date.
  // Same style as the year axis line: 1px (= P7_AXIS_LINE_THICKNESS, declared
  // further down so it can't be referenced here), solid black, square ends.
  bar: { h: 1, gap: 1, padX: 6, color: '#000000', alpha: 1, alphaTop: 0.3, alphaBottom: 0.3, round: false, dateBelow: false, dateGap: 3,
         inset: 0, dash: 0, dashGap: 0 }, // inset = px shorter than the card, each side; dash > 0 = dash length (dashGap px between)
  // Type of the centred headline block (desktop only — the mobile axis keeps
  // the P7_AXIS_*_FONT constants). `lh` = line height of each face's lines;
  // `color` may carry alpha. `gap` = extra px between the title and the date.
  type: {
    title: { size: 14, weight: 500, lh: 19, color: 'rgba(0, 0, 0, 1)' },
    date:  { size: 14, weight: 400, lh: 19, color: 'rgba(0, 0, 0, 0.3)' },
    gap: 0,
    showDate: false,  // false = the headline block is the title alone (no date line; the axis's own years give the time)
  },
  // Headlines hang UNDER their dot by default (the card opens downward);
  // an event with `above: true` in P7_AXIS_EVENTS opens upward instead
  // (the year dodge can still flip either).
};
// ── The mobile variant of the block above, and the one accessor both sides read ──
// Every reader of the vertical-axis config goes through p7V(), never P7_VERT
// directly, so one call decides which breakpoint's numbers apply. P7_VERT_MOBILE
// holds ONLY what a phone needs different; p7VertMerge deep-merges it over a
// clone of the desktop block to build P7_VERT_M, so every key exists on both
// and a key added above needs no mirror here.
//
// Deep, not a spread: `card`, `bar` and `type` are nested objects, and a
// shallow merge would replace them wholesale (losing every desktop key the
// override doesn't restate) as well as leave the un-overridden ones pointing at
// the SAME objects as desktop, so the harness dragging a mobile card knob would
// silently retune the desktop card too.
const P7_VERT_MOBILE = {
  // Phase 1: the vertical axis is ON for mobile; a compare/ harness can
  // flip it back to the old horizontal axis for comparison.
  enabled:       true,
  corridorPx:    44,   // 'band'/'slot': no room for the desktop corridor between two phone-width grids
  bottomInsetPx: 24,   // no bottom axis to clear — the box just stops short of the screen edge
  slotPx:        48,   // 'slot' with slotAnchor 'grid' ONLY — the reserved band under the grid. Mobile anchors 'top' instead, so nothing is reserved down there.
  minSidePx:     96,   // a camp grid never gets narrower than this when 'widen' solves its corridor
  yearLabelPx:   14,   // 4-digit years fit the mobile tick pitch at 14
  yearLabelWeight: 400,
  // The phone keeps the centred year blocks (the line breaking around them,
  // no ring): a 44px corridor has no room for digits beside the line, and the
  // headline never sits on the axis there ('slot'), so eventSide is moot.
  yearSide: 'center', eventSide: 'center', yearRing: false,
  card: { padX: 8 },
  // On a phone the headline copy does NOT travel with its dot — there is no
  // room beside a phone-width axis for a card, and one hung off the dot covers
  // the grid it is describing. 'slot' prints ONE line instead, the most
  // recently reached event, in a single fixed place; the axis itself carries
  // only the circles, exactly as it did under 'none'. Anchored to the TOP of
  // the VIEWPORT, directly under the מקרא bar: the mobile stack is bar /
  // headline / grid / docked tooltip, so the copy reads with the legend that
  // colours it and the frame closes the screen. No card, no date line
  // (type.showDate is false) — just the title, on the page background.
  headline: 'slot',
  slotAnchor: 'side',
  // Started as 16 (FOLD6_MLEGEND_TOP_MOBILE_PX) + the bar's own 30px + one
  // SBB_TIMELINE_MOBILE_GAP_PX = 64, then nudged to 78 by eye (2026-09-05) for
  // the air it wanted under the מקרא bar. SBB_TIMELINE_MOBILE_TOP_PX no longer
  // continues from this number — the grid top was NOT moved with it, and the
  // slot has clearance to spare, so the two are independent now.
  slotTopPx: 78,
  // Camera + plaque knobs (see P7_VERT). compare/ pick 2026-09-12, zoom re-tuned
  // 2026-09-13: a 1.85× field whose fill edge is HELD at 0.6 of the box (the
  // zoom was picked together with P7_VERT_SQ_BOOST and P7_MOBILE_GAP_RATIO —
  // change them as a set), and no single top-slot headline —
  // every event's plaque stands beside its own dot ahead of the fill, then flies
  // to sit above the dot when the fill reaches it and fades out 150px later.
  zoom: 1.85, camera: 'fill', fillAnchorFrac: 0.6, slotFillGapPx: 15, dotGapPx: 6, sideWrapPx: 150, sidePush: false, sidePlace: 'alternate', sidePhase: 'fly', sideLeadPx: 80, sideFlyGapPx: 10, sideFlyFadePx: 150,
  // The mobile headline is the only copy on a screen that is otherwise a field
  // of small coloured dots, so it gets a black plaque instead of sitting bare on
  // the page: it reads as a label of the axis rather than as body text, and it
  // stays legible when a dense run of dots crowds up under it. Inverted type,
  // and the date line (unused here — type.showDate is false) would invert with it.
  slotCard: { fill: '#000000', color: '#FDFCFF', dateColor: 'rgba(253, 252, 255, 0.6)', padX: 12, padY: 8, radius: 4 },
  // maxWidth is mobile-only: 'widen' solves the corridor FROM the wrapped copy
  // (p7SolveMobileCorridor), so the wrap width is the input, not the result.
  // Desktop has no such key — it wraps to its fixed corridor instead.
  type: { maxWidth: 220, title: { size: 14, lh: 19 }, date: { size: 14, lh: 19 } },
};
function p7VertMerge(base, over) {
  const out = Array.isArray(base) ? base.slice() : {};
  for (const k in base) out[k] = (base[k] && typeof base[k] === "object")
    ? p7VertMerge(base[k], (over && over[k]) || {}) : base[k];
  for (const k in over) {
    if (!(k in out)) out[k] = over[k];
    else if (!(over[k] && typeof over[k] === "object")) out[k] = over[k];
  }
  return out;
}
const P7_VERT_M = p7VertMerge(P7_VERT, P7_VERT_MOBILE);

function p7V() { return isMobile() ? P7_VERT_M : P7_VERT; }

// 'widen' on mobile can't use a fixed corridor: the desktop card's width is a
// design constant, but a phone's is whatever is left after two camp grids, and
// the copy has to fit it. So the corridor is SOLVED from the copy instead —
// the widest wrapped headline line at type.maxWidth, plus the card's own side
// padding and the gap to the dots on each side. Clamped so each camp still
// keeps minSidePx: a corridor wide enough for the longest title is worth
// nothing if it leaves two slivers of grid beside it.
function p7SolveMobileCorridor(W, H) {
  const V = P7_VERT_M;
  const ctx2 = typeof ctx !== "undefined" ? ctx : null;
  let widest = 0;
  if (ctx2) {
    ctx2.save();
    ctx2.font = p7VertFont(V.type.title);
    P7_AXIS_EVENTS.forEach((ev) => {
      p7WrapLabel(ctx2, ev.label, V.type.maxWidth).forEach((line) => {
        widest = Math.max(widest, ctx2.measureText(line).width);
      });
    });
    ctx2.restore();
  }
  const want = Math.ceil(widest || V.type.maxWidth) + 2 * V.card.padX + 2 * V.sideGap;
  // What's actually available: the full width minus both screen-edge insets
  // minus the two grids at their floor.
  const room = W - 2 * sbbTimelineLeftX(W, H) - 2 * V.minSidePx;
  return Math.max(V.corridorPx, Math.min(want, room));
}

// The row plan of the fixed-span layout: every P7_VERT.daysPerRow days take
// one row, counted afresh from each 1 January (the rows themselves run on
// unbroken — the year marker is a break in the drawn line only). Shared by
// the solver (row count) and the layout builder (row of each day).
// Mobile `zoom` divides the span: the plan is date-driven, so the row COUNT is
// what sets the field's height — a 2× field is one with half the days per row,
// not a bigger square alone (the square is capacity-bound by the camp's width
// and would only grow √zoom). Fractional spans are fine: rowStart is already
// fractional within a row.
function p7VertDaysPerRow() {
  return p7V().daysPerRow / (isMobile() ? (p7V().zoom || 1) : 1);
}
function p7VertRowPlan(CELL) {
  const minMs = p7DayMs(p7.minDate), maxMs = p7DayMs(p7.maxDate);
  const nDays = Math.max(1, Math.round((maxMs - minMs) / 86400000) + 1);
  const dpr   = p7VertDaysPerRow();
  const rowStart = new Float64Array(nDays + 1);
  const rowsOf   = new Float64Array(nDays);
  const yearRow = new Map();   // year -> the integer row its 1 January starts (the line break)
  let segDay = 0, segStart = 0;
  for (let d = 0; d < nDays; d++) {
    const date = new Date(minMs + d * 86400000);
    const jan1 = date.getUTCMonth() === 0 && date.getUTCDate() === 1;
    if (d === 0 || jan1) {
      if (d > 0) segStart = segStart + Math.ceil(segDay / dpr);
      yearRow.set(date.getUTCFullYear(), segStart);
      segDay = 0;
    }
    rowStart[d] = segStart + Math.floor(segDay / dpr) + (segDay % dpr) / dpr;
    rowsOf[d]   = 1 / dpr;
    segDay++;
  }
  const totalRows = Math.ceil(rowStart[nDays - 1] + rowsOf[nDays - 1]);
  rowStart[nDays] = totalRows;
  return { nDays, minMs, maxMs, rowStart, rowsOf, yearRow, totalRows };
}
// Vertical layout result (p7.vert) — null on mobile / before layout.
function p7DayMs(dateStr) { return new Date(dateStr + "T00:00:00Z").getTime(); }

function p7VertBandRows(CELL) { return Math.ceil(p7V().bandPx / CELL); }

// Deliberate TRIM of the solve below. The solver returns the largest square that
// still PACKS, and that square reads too heavy for this field — the dots crowd
// their own gaps and the camps lose their texture. manual/ pick 2026-09-13
// (_debug-tl-zoom.js, since deleted): 0.88, alongside zoom 1.85 and gap 0.45,
// the three tuned together against each other.
//
// It is applied on the way OUT of p7SolveVerticalSq, so it deliberately breaks
// the solver's own fit test — below 1 the grid comes out SHORTER than the box it
// was solved for, and p7VertTopY's centring takes up the slack. That is the look
// that was picked, not a rounding artefact.
//
// > It was 1.12 (an overshoot) until 2026-09-13, tuned at 390×721 against a
// > docked tooltip. Same knob, opposite direction — don't assume the name means
// > it must be > 1.
//
// MOBILE ONLY — desktop shares this solver and was never part of either tuning.
const P7_VERT_SQ_BOOST = 0.88;
function p7VertSqBoost() { return isMobile() ? P7_VERT_SQ_BOOST : 1; }

// Largest square (≤ P7_SQ, the mobile-style solve) whose grid holds the
// busier camp once each day's events must sit in that day's rows: a date-
// driven layout cannot pack as tightly as the old free permutation, and band
// mode gives whole rows away to the headlines. 6% slack for the jitter spill.
// The winner is scaled by P7_VERT_SQ_BOOST on the way out.
function p7SolveVerticalSq(sideW, sideH, maxEvents) {
  const gapRatio = p7GapRatio();
  const bands = p7V().eventMode === "band" ? P7_AXIS_EVENTS.length : 0;
  const sqMin = p7SqMin();
  // `zoom` (mobile camera) exists to make the dots BIGGER, so the ceiling scales
  // with it — capped at P7_MOBILE_SQ_MAX every zoom level solved to the same
  // square and the field only grew as tall as the row plan's fixed spans.
  const sqMax = p7SqMax() * (isMobile() ? (p7V().zoom || 1) : 1);
  for (let sq = sqMax; sq >= sqMin - 1e-9; sq -= p7SqStep()) {
    const CELL = sq * (1 + gapRatio);
    const cols = Math.floor(sideW / CELL), rows = Math.floor(sideH / CELL);
    const cap  = Math.max(1, Math.floor(cols * p7V().fillRatio));
    const avail = rows - bands * Math.ceil(p7V().bandPx / CELL);
    // Every fixed-span row, plus the first year's header label above row 0,
    // must fit the box (so p7VertTopY can centre the axis in it).
    if (sideH < p7VertRowPlan(CELL).totalRows * CELL + p7VertYearHeaderH()) continue;
    if (avail * cap >= maxEvents * 1.06) return Math.round(sq * p7VertSqBoost() * 100) / 100;
  }
  return Math.round(sqMin * p7VertSqBoost() * 100) / 100;
}

// `visible` (optional) — the legend filter's predicate. Events it rejects are
// left out of the packing entirely (positions[i] = -1) so the survivors close
// the gaps; the caller keeps the UNFILTERED layout too, and reads the filtered
// one only for destinations. See the LEGEND FILTER section below.
function p7BuildVerticalLayout(rows, cols, CELL, visible) {
  const minMs  = p7DayMs(p7.minDate);
  const maxMs  = p7DayMs(p7.maxDate);
  const nDays  = Math.max(1, Math.round((maxMs - minMs) / 86400000) + 1);
  const dayOf  = (dateStr) => Math.min(nDays - 1, Math.max(0, Math.round((p7DayMs(dateStr) - minMs) / 86400000)));
  const countL = new Int32Array(nDays), countR = new Int32Array(nDays);
  p7.leftEvents.forEach(e => countL[dayOf(e.date)]++);
  p7.rightEvents.forEach(e => countR[dayOf(e.date)]++);

  const band   = p7V().eventMode === "band";
  const cap    = Math.max(1, Math.floor(cols * p7V().fillRatio));
  // Band reservations: the band for an event sits just BEFORE that day's rows;
  // an event dated past the data (the last one) gets its band after the last day.
  const bandDay = new Map(); // dayIndex (or nDays for "after the end") -> [eventIdx]
  P7_AXIS_EVENTS.forEach((ev, i) => {
    const d = p7DayMs(ev.date) > maxMs ? nDays : dayOf(ev.date);
    if (!bandDay.has(d)) bandDay.set(d, []);
    bandDay.get(d).push(i);
  });
  const bandRows  = band ? p7VertBandRows(CELL) : 0;
  const plan     = p7VertRowPlan(CELL);
  const rowStart = plan.rowStart;
  const rowsOf   = plan.rowsOf;
  const events   = P7_AXIS_EVENTS.map(() => ({ row: 0, reachRow: 0, bandStart: 0, bandEnd: 0 }));
  let cursor = 0;
  const placeBands = (d) => {
    (bandDay.get(d) || []).forEach((i) => {
      events[i].bandStart = cursor;
      events[i].bandEnd   = cursor + bandRows;
      cursor += bandRows;
    });
  };
  // Rows come from p7VertRowPlan (one row per P7_VERT.daysPerRow days, counted
  // afresh each year). NOTE: the unused "band" eventMode reserves no rows here
  // any more (placeBands is not called) — bands would overlap dots.
  cursor = plan.totalRows;
  const totalRows = cursor;

  const rowMid = (d) => rowStart[d] + rowsOf[d] / 2;
  P7_AXIS_EVENTS.forEach((ev, i) => {
    const past = p7DayMs(ev.date) > maxMs;
    const e = events[i];
    if (band) {
      // Dot 1.5 rows into the band, text below it; reached once the fill edge
      // enters the band.
      e.row      = e.bandStart + 1.5;
      e.reachRow = e.bandStart;
    } else {
      // Past-the-end event parks a few rows short of the bottom (the vertical
      // counterpart of the horizontal +26px xOffset) so it can still be reached.
      e.row      = past ? totalRows - 3 : rowMid(dayOf(ev.date));
      e.reachRow = e.row;
    }
  });


  const lastRow = rows - 1;
  function placeSide(evs, seed, side) {
    const rng  = p7Rng(seed);
    const used = []; // row -> Uint8Array(cols), lazily
    const cellRow = (r) => used[r] || (used[r] = new Uint8Array(cols));
    const positions = new Array(evs.length);
    const rowRank   = new Int32Array(evs.length); // rank within the row, corridor-first
    const rowCount  = new Int32Array(rows);
    // Tries to claim a free k in `row` walking outward from the corridor;
    // returns k or -1. Cells rolled as permanent gaps are marked used (2).
    function claim(row) {
      const u = cellRow(row);
      for (let k = 0; k < cols; k++) {
        if (u[k]) continue;
        if (rng() > p7V().fillRatio) { u[k] = 2; continue; } // permanent gap
        u[k] = 1;
        return k;
      }
      return -1;
    }
    evs.forEach((e, i) => {
      if (visible && !visible(e)) { positions[i] = -1; return; }
      const d = dayOf(e.date);
      // The day's own row, spilling DOWN only, so a row never holds anything
      // from before its span.
      const base = Math.min(lastRow, Math.max(0, Math.floor(rowStart[d])));
      let k = -1, row = base;
      for (let step = 0; k < 0 && step <= lastRow; step++) {
        const cand = base + step;
        if (cand < 0 || cand > lastRow) continue;
        k = claim(cand); row = cand;
      }
      if (k < 0) { k = 0; row = base; } // grid genuinely full — overlap rather than drop
      const col = side === "right" ? k : cols - 1 - k;
      positions[i] = row * cols + col;
    });
    // Row cascade order (p7DrawSideSquares): rank by distance from the corridor
    // within each row, date order as the tiebreak.
    const byRow = [];
    positions.forEach((cell, i) => { if (cell < 0) return; const r = Math.floor(cell / cols); (byRow[r] || (byRow[r] = [])).push(i); });
    byRow.forEach((idxs, r) => {
      const kOf = i => { const c = positions[i] % cols; return side === "right" ? c : cols - 1 - c; };
      idxs.sort((a, b) => kOf(a) - kOf(b) || a - b);
      idxs.forEach((i, rank) => { rowRank[i] = rank; });
      rowCount[r] = idxs.length;
    });
    return { positions, rowRank, rowCount };
  }

  const left  = placeSide(p7.leftEvents,  11111, "left");
  const right = placeSide(p7.rightEvents, 99999, "right");
  return {
    rows, cols, totalRows, nDays, minMs, maxMs, rowStart, rowsOf, dayOf, events,
    yearRow: plan.yearRow,
    leftPos: left.positions, rightPos: right.positions, left, right,
  };
}

// Fractional row of a date on the vertical axis — the MIDDLE of that day's
// rows (ticks, hover marker, widen-mode event dots); p7RowEndOfDate is the
// bottom of the day's rows (the fill edge, so it covers the day's own dots).
// A date past the data clamps to the end. Both fall back to 0 before layout.
function p7RowOfDate(dateStr) {
  const v = p7.vert; if (!v) return 0;
  if (p7DayMs(dateStr) > v.maxMs) return v.totalRows;
  const d = v.dayOf(dateStr);
  return v.rowStart[d] + v.rowsOf[d] / 2;
}
function p7RowEndOfDate(dateStr) {
  const v = p7.vert; if (!v) return 0;
  if (p7DayMs(dateStr) > v.maxMs) return v.totalRows;
  const d = v.dayOf(dateStr);
  return v.rowStart[d] + v.rowsOf[d];
}
// Row → canvas y (top of that row) and the axis line's own extent.
// Row 0's y. Mobile: the box's top. Desktop (vertical axis): the axis — the
// first year's header label above it plus totalRows of line — is centred
// vertically in the box, so the slack between the solved cell size and the
// box height splits evenly above and below instead of pooling at the bottom.
// The dot grids share this origin (their rows are dates), so they move with it.
function p7VertYearHeaderH() {
  const ring = p7V().yearRing;
  // Years beside the line: the first year's ring sits ON the line's top end,
  // so only its upper half pokes above topY — no header block at all.
  // (Raised by P7_VERT_FIRST_YEAR_RAISE_PX so the first event's dot, days
  // after 1 January, doesn't sit on the ring.)
  if (p7V().yearSide !== 'center') return (ring ? P7_AXIS_MARKER_RADIUS : 0) + P7_VERT_FIRST_YEAR_RAISE_PX;
  return (ring ? P7_AXIS_MARKER_RADIUS * 2 + P7_VERT_YEAR_LABEL_GAP : 0) + (p7V().yearLabelPx + 3) + p7V().yearGapPad * 2
       + (p7AxisHasMobileAbove() ? P7_VERT_FIRST_EV_HEADROOM_PX : 0);
}
function p7VertTopY(H) {
  const box  = sbbTimeline(H);
  const boxT = Math.round(H * box.top);
  if (!p7VerticalAxis() || !p7.vert || !p7.CELL) return boxT;
  const boxB = Math.round(H * box.bottom);
  const len  = p7VertFieldLen() + p7VertYearHeaderH();
  // The slack normally splits evenly above and below. As the end-of-fill
  // zoom-out lands, the field's top edge is lerped all the way to
  // P7_ZOOMOUT_FIT_TOP_PX — above the box's own top — so the squashed timeline
  // takes the height rather than floating in the middle of a box sized for a
  // fold that still had a badge and a legend chip to clear.
  const slack = Math.max(0, (boxB - boxT - len) / 2);
  const top   = p7ZoomOutT ? p7ZoomLerp(boxT + slack, P7_ZOOMOUT_FIT_TOP_PX) : boxT + slack;
  return Math.round(top + p7VertYearHeaderH())
       - p7VertCameraOffset(boxB - boxT, len);
}
// The drawn height of the row field — the live length under the beat's vertical
// squash. Everything that measures the field (p7VertTopY, p7VertCameraOffset,
// p7FillEdgeY, p7VertOverflows, p7RowY) reads this, so the axis and the dots
// compress by exactly the same amount and stay aligned.
function p7VertFieldLen() {
  if (!p7.vert) return 0;
  return p7.vert.totalRows * p7.cellBase * p7ZoomOutYScale();
}
// THE camera: every vertical y (dots, axis, rings, event circles, the page8
// glide's captured positions, the inspect hit-test) goes through p7VertTopY, so
// this one offset moves the whole field as a unit. px the field is shifted UP
// by; 0 whenever it fits the box (`zoom` 1) or camera is 'none'. Stateless —
// read from the lagged fill fraction so it is the same on every call in a frame.
function p7VertCameraOffset(boxH, len) {
  const V = p7V(), over = len - boxH;
  if (V.camera === 'none' || over <= 0) return 0;
  const frac = p7AxisLaggedFillFrac ?? p7AxisFillFracTarget();
  let off;
  if (V.camera === 'pan') off = frac * over;
  else off = p7VertYearHeaderH() + frac * p7VertFieldLen() - V.fillAnchorFrac * boxH;
  off = Math.max(0, Math.min(over, off));
  // The camera exists only to window an over-tall `zoom > 1` field, so it retires
  // with the end-of-fill squash: without this it keeps holding the field up by
  // `over` px and fights p7VertTopY's own P7_ZOOMOUT_FIT_TOP_PX anchor, landing
  // the squashed timeline at y 2 instead of 40. Note the squashed field is sized
  // against the SCREEN (it starts above the box's top), so it can still measure
  // as taller than the box and leave `over` positive at t = 1 — hence a lerp to
  // zero rather than relying on `over` going non-positive by itself.
  return Math.round(p7ZoomOutT ? p7ZoomLerp(off, 0) : off);
}
// ── @fold9 end-of-fill ZOOM-OUT (mobile) ────────────────────────────────
// The phone ships at P7_VERT.zoom 3 with the 'pan' camera, so the field is
// three box-heights tall and only ever a window of it is on screen. Once the
// fill reaches the last event there is nothing left to pan toward, so the whole
// field scales down to fit the box in one beat — the timeline is finally seen
// whole — and @fold10's title block rises over that.
//
// It is a VERTICAL-ONLY SQUASH of the real layout — not a zoom, and not a
// re-solve. It does not have to be a faithful miniature; it is a VIEW of the
// whole timeline. Two other mechanisms were built and rejected, and the reasons
// are the design:
//
//  - A UNIFORM scale needs k ~ 0.35 to fit, which narrows each camp from the
//    full 160px of available width to 56px and takes the square to 1.04px —
//    under p7SolveMobileSq's 1.25px floor, "where a square stops reading as a
//    mark at all". A small picture of the timeline, not a view of it.
//  - RE-SOLVING the layout at zoom 1 gives legible dots and full width, but the
//    packer spills dense days down into later rows, so a dot's y stops meaning
//    its date: the busy camp runs hundreds of px past its own year label and the
//    dots no longer line up with the axis at all.
//
// Squashing y only keeps the row plan exactly as solved, so the date -> y mapping
// stays linear and every dot stays beside its own date — the dots and the dates
// spread across the axis together, which is the entire point. The camps already
// span the full width at the live layout (campW 160px of 160px available), so x
// is left completely alone. The square does not scale with the squash either
// (P7_ZOOMOUT_FIT_SQ_PX): rows overlap at k ~ 0.3, and that is fine and expected.
//
// The camera unwinds itself: p7VertCameraOffset returns 0 once `over` goes
// non-positive, and it does as the field shortens — one beat, not two fighting.
// A house fixed-duration makeTrigger, like every other fold beat — NOT a scrub.
// It fires on a crossing and runs on its own clock; reversing mid-flight covers
// only the remaining distance. Deliberate, and it has been tried the other way:
// don't "fix" this into a scroll-linked ramp.
//
// The cost is that ORDERING (finished before @fold10's title block crosses
// mid-screen) is bought with scroll DISTANCE rather than guaranteed by the
// mechanism: the beat needs P7_ZOOMOUT_MS to elapse inside the runway between
// full fill and that crossing. So the two numbers are a pair — this duration and
// #page-9's mobile padding-top (style.css, max-width 600px) — and neither can be
// changed alone. Measured at 393×852: the 75vh nudge leaves ~960px between full
// fill and the crossing, which a deliberate scroll (~1500px/s) covers in ~640ms,
// so 600ms lands the beat exactly on the title block's arrival. A hard flick can
// still outrun it and reach @fold10 mid-zoom; that is the accepted trade for
// keeping the beat on the house trigger system rather than scrubbing it.
// Armed in ROWS from the end, not on a fill fraction. p7AxisFillFracTarget() is
// p7CurRow() / totalRows and the cursor stops half a row short of the last one,
// so the fraction plateaus just under 1 (0.9988 at 403 rows / 393×852) and any
// fixed fraction threshold is both unreachable and viewport-dependent — the
// plateau moves with the row count. Rows are the honest unit: arm once the
// cursor is within ARM rows of the end, disarm at DISARM for hysteresis so a
// scroll parked at the end can't chatter the beat.
const P7_ZOOMOUT_ARM_ROWS    = 1;
const P7_ZOOMOUT_DISARM_ROWS = 4;
// Short for a fold beat (GROUP_TRANSITION_MS is 1900) because it is racing the
// title block down the runway — see the note above before changing it.
const P7_ZOOMOUT_MS = 600;

// Where the squashed field's top edge lands, in px from the top of the viewport.
// sbbTimeline starts ~101px down to clear the fold badge and the legend chip, but
// at the end of the fill nothing is competing for that space, so the field is
// allowed to climb out of the box and take the height. Only the squashed end of
// the beat uses it; at t = 0 the field sits in the box exactly as before.
const P7_ZOOMOUT_FIT_TOP_PX = 40;
// The square at the squashed end. It does NOT scale with the squash: at k ~ 0.3 a
// proportional square lands at ~1px, under p7SolveMobileSq's 1.25px floor, and
// the field stops reading as marks at all. Held at a flat legible size instead —
// the rows overlap, which is fine and expected: this is a VIEW of the whole
// timeline, not a faithful miniature of it.
const P7_ZOOMOUT_FIT_SQ_PX = 1.8;

// 0 = the live layout, 1 = fully squashed. Eased by the trigger; read by the
// geometry getters, p7VertFieldLen and the destY squash in p7DrawSideSquares.
let p7ZoomOutT = 0;
function p7ZoomLerp(a, b) { return a + (b - a) * p7ZoomOutT; }

// The VERTICAL-ONLY squash factor. y is compressed to fit the available height;
// x and the column pitch are left completely alone.
//
// That asymmetry is the whole design, and two rejected alternatives say why:
//
//  - A UNIFORM scale (k on both axes) narrows each camp from the full 160px of
//    available width down to 56px and takes the square to 1.04px. It makes a
//    small picture of the timeline instead of a view of it.
//  - RE-SOLVING the layout at zoom 1 gives legible dots and full width, but the
//    packer spills dense days down into later rows, so a dot's y stops meaning
//    its date: the busy camp runs hundreds of px past its own year label and the
//    dots no longer line up with the axis.
//
// Squashing y only keeps the row plan exactly as it is, so the date -> y mapping
// stays linear and every dot stays beside its own date on the axis — which is
// what this beat is for. The camps already span the full width at the live
// layout (campW 160px of 160px available), so x needs nothing done to it.
function p7ZoomOutKY(H) {
  if (!p7.vert || !p7.cellBase) return 1;
  const box  = sbbTimeline(H);
  const avail = Math.round(H * box.bottom) - P7_ZOOMOUT_FIT_TOP_PX - p7VertYearHeaderH();
  const live  = p7.vert.totalRows * p7.cellBase;
  if (avail <= 0 || live <= 0) return 1;
  return Math.min(1, avail / live);
}
// The live -> squashed y factor for this frame. 1 whenever the beat is idle.
function p7ZoomOutYScale() {
  return p7ZoomOutT ? p7ZoomLerp(1, p7ZoomOutKY(window.innerHeight)) : 1;
}

// Built on first use, not at parse time: makeTrigger lives in js/groups.js,
// which project.html loads AFTER this file. Same lazy-resolve-at-call-time rule
// every other cross-file global here follows.
let p7ZoomOutTrig = null;
function p7ZoomOutTrigger() {
  if (!p7ZoomOutTrig) {
    p7ZoomOutTrig = makeTrigger(P7_ZOOMOUT_MS, () => {
      p7ZoomOutT = p7ZoomOutTrig.currentT();
      p7StartAnimLoop();
    });
  }
  return p7ZoomOutTrig;
}

// Called once per frame from p7AxisUpdateFillLag (the axis's own per-frame
// tick), off the SCROLL-derived cursor rather than the lagged fill: the beat is
// a crossing, and the lag is a trailing visual that would arm it late.
function p7ZoomOutSync() {
  if (!isMobile() || !p7VerticalAxis() || !p7.vert) return;
  const left = p7.vert.totalRows - p7CurRow();
  if (left <= P7_ZOOMOUT_ARM_ROWS) p7ZoomOutTrigger().trigger(1);
  else if (left > P7_ZOOMOUT_DISARM_ROWS) p7ZoomOutTrigger().trigger(0);
}

// Geometry as DRAWN. Only the SQUARE changes with the beat — the cell pitch and
// leftX0 are the live solve untouched, because the squash is vertical only (see
// p7ZoomOutKY) and x is already correct. The vertical side is carried by
// p7VertFieldLen / p7RowY / the destY squash instead, not by these.
Object.defineProperties(p7, {
  CELL:   { get() { return p7.cellBase; } },
  SQ:     { get() { return p7ZoomOutT ? p7ZoomLerp(p7.sqBase, P7_ZOOMOUT_FIT_SQ_PX) : p7.sqBase; } },
  leftX0: { get() { return p7.leftX0Base; } },
});

// True when the field runs taller than the box (zoom > 1, or a phone too short
// for the plan): drawing is then clipped so the rows the camera has scrolled
// past the bottom never paint over the docked tooltip.
function p7VertOverflows(H) {
  if (!p7VerticalAxis() || !p7.vert || !p7.CELL || !isMobile()) return false;
  const box = sbbTimeline(H);
  return p7VertFieldLen() + p7VertYearHeaderH() > Math.round(H * box.bottom) - Math.round(H * box.top);
}
// The clip runs from the TOP OF THE SCREEN to the box's bottom, not from the
// box's top: rows the camera carries upward must keep going under the legend
// chip and off the screen, like a list scrolling, not stop dead at the box
// edge with a band of white above them. The bottom stays the box's — the
// tooltip dock lives below it.
function p7VertClipToBox(ctx, W, H) {
  if (!p7VertOverflows(H)) return false;
  const b = Math.round(H * sbbTimeline(H).bottom);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, b); ctx.clip();
  return true;
}
// The fill edge on screen — the y the axis's drawn fill has reached (lagged,
// like the line itself). What the 'fill' camera holds still and what the
// 'fill' headline slot hangs under.
function p7FillEdgeY(H) {
  const frac = p7AxisLaggedFillFrac ?? p7AxisFillFracTarget();
  return p7VertTopY(H) + frac * p7VertFieldLen();
}
// Row -> y. Expressed as a FRACTION of the field rather than row × CELL so the
// axis, its year rings and its ticks stay glued to the field's drawn height
// while the end-of-fill zoom-out is mid-beat: `row` is always a LIVE-layout row,
// but the field is on its way to the fitted layout's shorter one, and row × CELL
// would have the axis overshoot the dots by ~3x at t=1. Identical to row × CELL
// whenever the beat is not running (len is exactly totalRows × cellBase then).
function p7RowY(row, H) {
  const v = p7.vert;
  if (!v || !v.totalRows) return p7VertTopY(H);
  return p7VertTopY(H) + (row / v.totalRows) * p7VertFieldLen();
}
function p7AxisY(dateStr, H) { return p7RowY(p7RowOfDate(dateStr), H); }
// The fill edge in rows — the bottom of currentDate's rows.
function p7CurRow() { return p7RowEndOfDate(p7.currentDate); }

// Binary search: how many events have date < target
function p7BisectBefore(events, target) {
  let lo = 0, hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid].date < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// Year/month/in-month-fraction for a date string, shared by the timeline position
// logic and the square fly-in animation so both agree on the same date math.
function p7DateDayFrac(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
  const daysInM = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return { y, m, dayFrac: (day - 1) / daysInM };
}

// ease-out — fast start, gentle settle. Right for entrances/exits that don't travel
// anywhere (just scale + fade in place), per the usual "entering -> ease-out" rule.
function p7Ease(t) { return 1 - Math.pow(1 - t, 3); }

// Calendar-month index (year*12+month) for a date string, via string slicing (no
// Date allocation) since this runs per-event, every frame, during a cascade.
function p7MonthKeyOf(dateStr) {
  return parseInt(dateStr.slice(0, 4), 10) * 12 + (parseInt(dateStr.slice(5, 7), 10) - 1);
}
function p7MonthKeyToStartStr(monthKey) {
  const y = Math.floor(monthKey / 12), m = monthKey % 12;
  return `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

// A month's squares fly in one after another (not all at once), in a slow cascade,
// the moment that month becomes the centered/highlighted one — a real elapsed-time
// animation, independent of further scrolling (unlike the rest of page7, which is
// otherwise purely scroll-driven). Each event gets its own start delay, spread across
// p7AnimTotalMs() in chronological order, then pops into place over p7PopMs()
// (a quick scale+fade at its final grid cell — no flight, no travel).
// Each month owns ONE number — a cascade cursor `c`, in ms, from 0 (the month is
// entirely absent) to p7AnimTotalMs() (every square settled). A square's
// presence is a pure function of it, `p7Ease((c - itsDelay) / p7PopMs())`,
// so the cursor advancing plays the cascade in and the cursor retreating plays it
// back out — squares with the largest delay (the last to arrive) reaching 0 first,
// i.e. last in, first out, for free.
//
// This is deliberately the same shape as page8's p8CurrentT: a phase runs at a
// constant 1ms of cursor per 1ms of clock toward a target, so REVERSING MID-FLIGHT
// COVERS ONLY THE REMAINING DISTANCE and every square continues from exactly the
// presence it had. Don't reintroduce separate forward/reverse start timestamps —
// two independent clocks can't express "half-grown, now shrinking", so every
// interrupted direction change snapped the month to full (or empty) for a frame.
//
// p7MonthMaxReached is the highest month ever reached, so the draw loop knows to
// keep rendering (and retracting) months ahead of the current one instead of just
// snapping them away.
// PER BREAKPOINT — these are NOT one shared pair. The mobile values came out of
// a manual/ pass on 2026-09-12 (a fast, tight cascade: the dots snap in almost
// individually, because the old swell read as sluggish once the phone's field
// was this dense). Desktop was never part of that tuning and keeps its own
// numbers. Live reads through p7AnimTotalMs()/p7PopMs(), same isMobile()
// convention as p7Sq()/p7GapRatio() — never reference the constants directly.
const P7_ANIM_TOTAL_MS_DESKTOP = 2200; // ms — full span of a month's staggered cascade
const P7_POP_MS_DESKTOP        = 220;  // ms — each individual square's own pop in/out
const P7_ANIM_TOTAL_MS_MOBILE  = 550;
const P7_POP_MS_MOBILE         = 40;
function p7AnimTotalMs() { return isMobile() ? P7_ANIM_TOTAL_MS_MOBILE : P7_ANIM_TOTAL_MS_DESKTOP; }
function p7PopMs()       { return isMobile() ? P7_POP_MS_MOBILE       : P7_POP_MS_DESKTOP; }
const p7MonthPhase = {};        // monthKey -> { fromC, toC, start } | undefined (never reached)
let p7MonthMaxReached = -1;     // highest monthKey ever reached, forward
let p7AnimRunning = false;

// Where a month's cascade is right now. undefined = the month has never been
// reached at all (or was fully retreated and cleaned up) — callers treat that as
// "not part of the animated range", distinct from a cursor of 0.
function p7MonthCursor(k) {
  const ph = p7MonthPhase[k];
  if (ph === undefined) return undefined;
  const span = ph.toC - ph.fromC;
  if (span === 0) return ph.toC;
  const t = Math.min(1, (performance.now() - ph.start) / Math.abs(span));
  return ph.fromC + span * t;
}

// Point a month at a new cursor target, starting from wherever it is now (0 for a
// month being reached for the first time). Idempotent — re-aiming at the target
// it's already heading for is a no-op, so this is safe to call every frame.
function p7MonthAim(k, toC) {
  const ph = p7MonthPhase[k];
  if (ph !== undefined && ph.toC === toC) return false;
  const fromC = p7MonthCursor(k) ?? 0;
  p7MonthPhase[k] = { fromC, toC, start: performance.now() };
  return true;
}

// Drop a month straight to a resting cursor with no animation (used for months
// landed on while scrolling backward, which should just already be there).
function p7MonthSettle(k, c) {
  p7MonthPhase[k] = { fromC: c, toC: c, start: performance.now() };
}

// Set once, the instant currentPage flips from 9 to 8 (leaving page8's
// bridge) while page8's own timeline<->legit-grid glide (p8CurrentT,
// page8.js) hasn't reached 0 yet — see setActivePage, js/nav.js. Without this,
// p7DrawSideSquares below has no notion of that glide's progress and would
// draw every square straight at its resting timeline cell the instant this
// section starts drawing instead of page8, i.e. an instant teleport back to
// the @fold12/10 layout mid-reverse-glide. { from: Map<event,{x,y}>, start,
// duration } — same shape/plain-glide convention as p9.anim's plainGlide
// flag (page9.js), just for this one entry point instead of a persistent
// per-frame system.
let p7EntryAnim = null;

// ---- Desktop: one cursor per ROW, gated by the visible axis edge ----
// On the vertical axis the animation unit is a grid row, not a month. A row's
// cascade starts the moment the axis's visible fill edge (the lagged one the
// user actually sees, p7AxisLaggedFillFrac) passes its middle, and plays its
// squares centre → side over p7AnimTotalMs(); rows overlap freely — a
// row never waits for the one above it to finish, it waits for the axis. The
// edge moves monotonically with scroll, so rows fire strictly top → bottom, and
// a jump sweeps the (damped) edge through the rows in order instead of lighting
// the whole span at once. Same cursor shape and reversibility as the month
// phases: rows the edge has left aim back at 0 and retract mirrored.
const p7RowPhase = {};          // row -> { fromC, toC, start } | undefined (never reached)

// `now` is passed in so a whole frame can share one timestamp — see the row
// memo in p7DrawSideSquares. Reading performance.now() per dot was 4.5% of the
// draw on a throttled phone, and a single frame wants one clock anyway.
function p7RowCursorAt(r, now) {
  const ph = p7RowPhase[r];
  if (ph === undefined) return undefined;
  const span = ph.toC - ph.fromC;
  if (span === 0) return ph.toC;
  const t = Math.min(1, (now - ph.start) / Math.abs(span));
  return ph.fromC + span * t;
}
function p7RowCursor(r) { return p7RowCursorAt(r, performance.now()); }

function p7RowAim(r, toC) {
  const ph = p7RowPhase[r];
  if (ph !== undefined && ph.toC === toC) return false;
  const fromC = p7RowCursor(r) ?? 0;
  p7RowPhase[r] = { fromC, toC, start: performance.now() };
  return true;
}

// The row the visible axis edge has reached (fractional). Reads the lagged
// fill so the dots follow the edge the user sees, not the raw scroll readout.
function p7EdgeRow() {
  const v = p7.vert; if (!v) return 0;
  const frac = p7AxisLaggedFillFrac ?? p7AxisFillFracTarget();
  return frac * v.totalRows;
}

// Per-tick orchestration for the row system (desktop). Rows whose middle the
// edge has passed aim at full while engaged; every other row (and every row
// once disengaged) aims at 0. Fully-retreated rows are dropped so the phase
// table stays small and p7AnyAnimActive stays cheap.
function p7OrchestrateRows() {
  const v = p7.vert; if (!v) return;
  const edge = p7HasEngaged ? p7EdgeRow() : -1;
  const reachedThrough = Math.min(v.rows - 1, Math.floor(edge - 0.5));
  const animMs = p7AnimTotalMs();   // hoisted: reads isMobile() -> innerWidth
  for (let r = 0; r <= reachedThrough; r++) {
    if (p7RowAim(r, animMs)) p7StartAnimLoop();
  }
  for (const key in p7RowPhase) {
    const r = Number(key);
    if (r > reachedThrough) {
      if (p7RowAim(r, 0)) p7StartAnimLoop();
      if (p7RowCursor(r) <= 0) delete p7RowPhase[r];
    }
  }
}

// Wipes all per-month animation state so the next entry into the timeline
// replays the cascade from scratch instead of showing settled dots.
// Called from setActivePage (js/nav.js) when the user scrolls back out of
// @fold13 toward an earlier fold.
function p7ResetForReplay() {
  for (const k in p7MonthPhase) delete p7MonthPhase[k];
  for (const r in p7RowPhase) delete p7RowPhase[r];
  p7MonthMaxReached = -1;
}

// True once fold 9's own title card (#page-7 .text-card, page7TitleCardEl in
// js/groups.js) has scrolled all the way past the top of the viewport — not once
// #page-8 itself reaches the top, which (since #page-7's card sits vertically
// centered in its own 100vh-tall section) only happens half a viewport-height
// *after* the card is already gone, leaving a stretch of scrolling where
// nothing visibly happens before the real per-event reveal kicks in. Tying
// engagement directly to the card's own exit instead means the timeline
// starts exactly when the title that introduces it leaves the screen, no
// matter how #page-7's section ends up being sized.
let p7HasEngaged = false;

// True once the real timeline (drawPage7, #page-8) has actually been reached
// at least once this "visit" — set by drawPage7 itself, cleared by drawFold9
// (js/core.js) once fully retreated back out (p7HasEngaged false again and
// nothing left animating). Lets drawFold9 keep drawing/animating the
// per-event squares (p7DrawTimelineSquares below) for as long as there's
// still something to retreat when the user scrolls back up from #page-8 into
// #page-7, without changing when the *forward* reveal itself first starts —
// that still only ever happens via drawPage7, i.e. once #page-8 is actually
// reached, same as before this flag existed.
let p7RealTimelineReached = false;

// Updates p7HasEngaged — called from drawPage7 (currentPage 7) and drawFold9
// (js/core.js, currentPage 6) alike, since the title card this depends on
// belongs to fold 9/#page-7. p7HasEngaged is recomputed fresh every call, not
// a one-way latch, so scrolling back up un-engages it again and scrolling
// forward replays the same axis-then-squares sequence — calling this from
// both draw functions (rather than only drawPage7) is what makes that
// reversal actually take effect immediately while currentPage is 6, instead
// of freezing at whatever it last was the moment currentPage left 7.
//
// Engagement (the real per-event squares + the axis's own scroll-driven fill,
// both of which read p7HasEngaged/p7.currentDate) no longer waits for the
// axis's build-in wipe (p7AxisIntroT) to finish — per explicit instruction,
// if the real timeline starts filling in while the wipe is still playing,
// both just play at once rather than forcing the fill to wait. That's safe
// to let overlap: the wipe is a pure right-to-left reveal *clip* over
// whatever p7DrawYearAxis would otherwise draw, and the fill is an
// independent right-to-left color change on the same dots — two continuous,
// same-direction reveals composing under one clip, not a hard cut between
// two states.
// Small hysteresis gap so a decelerating/momentum scroll settling right at
// (or bouncing a couple px around) the exact top<=0 boundary can't flicker
// p7HasEngaged true/false frame-to-frame. That flicker used to be visible as a
// blank frame followed by the current month popping back to full and restarting
// its retreat, once per flicker: engagement flips the month's cursor target
// between 0 and p7AnimTotalMs(), and back when it flips back. (The cursor
// now makes that merely a tiny jitter rather than a full replay, but the
// hysteresis stays — a month shouldn't twitch direction on scroll noise.)
// Once engaged, disengaging requires the
// title to clear this small buffer past 0, not just barely cross it.
const P7_ENGAGE_HYSTERESIS_PX = 24;
function p7UpdateEngagement() {
  if (!page7TitleCardEl) { p7HasEngaged = false; return; }
  const top = page7TitleCardEl.getBoundingClientRect().top;
  // Engagement is deliberately NOT gated on @fold9's squares finishing their
  // fly-in (fold9FlyTrigger, js/groups.js — legacy name). Per explicit instruction
  // the two are unrelated animations that simply run at the same time: the
  // axis fills and the per-event dots appear on the card's own exit, whether
  // or not the flying squares have landed. (An earlier `flyDone` gate here
  // made both wait — don't reintroduce it.)
  p7HasEngaged = p7HasEngaged ? top <= P7_ENGAGE_HYSTERESIS_PX : top <= 0;
}

// The year axis's own scroll-driven fill (curX, p7DrawYearAxis) trails its raw
// scroll-derived target via a per-frame lerp instead of snapping to it every
// scroll event — same "after-action" trailing feel, and the same damping
// tempo, as @fold1's logo/title scroll-lag (PAGE0_SCROLL_LAG_DAMPING/
// PAGE0_OPACITY_DAMPING, js/fold1-intro.js), just applied to this fold's own fill
// fraction instead of a scroll-derived pixel offset. p7.currentDate itself
// (which drives the real per-event cascade's month timing) is untouched —
// only the axis's own visual fill lags, not the timeline's actual engagement.
const P7_AXIS_FILL_LAG_DAMPING = 0.12;
let p7AxisLaggedFillFrac = null;

function p7AxisFillFracTarget() {
  if (p7VerticalAxis()) return p7.vert ? p7CurRow() / p7.vert.totalRows : 0;
  const minMs = new Date(p7.minDate + "T00:00:00Z").getTime();
  const maxMs = new Date(p7.maxDate + "T00:00:00Z").getTime();
  const curMs = new Date(p7.currentDate + "T00:00:00Z").getTime();
  return maxMs === minMs ? 0 : (curMs - minMs) / (maxMs - minMs);
}

// True while the lag still has meaningfully further to go — checked by
// p7AnyAnimActive so the redraw loop (p7StartAnimLoop) keeps running until it
// settles, even if the user has stopped scrolling.
function p7AxisFillLagActive() {
  return p7AxisLaggedFillFrac !== null && Math.abs(p7AxisFillFracTarget() - p7AxisLaggedFillFrac) > 0.0005;
}

// Advances the lag by one frame's worth and returns its current value — called
// once per p7DrawYearAxis call, which is what actually drives it forward
// (there's no independent per-frame ticker; drawing and lag-advancing are the
// same event here, same as every other per-frame value in this file).
function p7AxisUpdateFillLag() {
  const target = p7AxisFillFracTarget();
  if (p7AxisLaggedFillFrac === null) {
    p7AxisLaggedFillFrac = target;
  } else {
    const next = p7AxisLaggedFillFrac + (target - p7AxisLaggedFillFrac) * P7_AXIS_FILL_LAG_DAMPING;
    // An exponential lerp only ever asymptotically approaches its target —
    // once within the same epsilon p7AxisFillLagActive uses to decide the lag
    // has "settled," snap the rest of the way there instead of leaving a
    // permanent sub-pixel residual. At fillFrac === 1 (scroll fully reached
    // p7.maxDate) that residual left curX a sub-pixel short of the axis's left
    // edge, so the dark line never quite finished filling even after scrolling
    // all the way to the end.
    p7AxisLaggedFillFrac = Math.abs(target - next) <= 0.0005 ? target : next;
  }
  // Arm/disarm the end-of-fill zoom-out off the same per-frame tick. Deliberately
  // after the lag update but off the unlagged target — see p7ZoomOutSync.
  p7ZoomOutSync();
  if (p7AxisFillLagActive()) p7StartAnimLoop();
  return p7AxisLaggedFillFrac;
}

function p7AnyAnimActive() {
  const now = performance.now();
  for (const k in p7MonthPhase) {
    if (p7MonthCursor(k) !== p7MonthPhase[k].toC) return true; // still travelling
  }
  for (const r in p7RowPhase) {
    if (p7RowCursor(r) !== p7RowPhase[r].toC) return true;
  }
  if (p7AxisEventsAnimActive()) return true;
  if (p7BulgeActive()) return true;
  if (p7AxisIntroStart !== null && p7AxisIntroT() < 1) return true;
  if (p7AxisOutroStart !== null && p7AxisIntroT() > 0) return true;
  if (p7AxisFillLagActive()) return true;
  if (p7EntryAnim && now - p7EntryAnim.start < p7EntryAnim.duration) return true;
  if (p7GridMorph && now - p7GridMorph.start < p7MorphTotalMs()) return true;
  if (p7FilterMorph && now - p7FilterMorph.start < P7_FILTER_MORPH_MS) return true;
  return false;
}

// page8 (index 8) renders by calling drawPage7 directly with currentDate forced to
// maxDate (see page8.js) — it's a continuation of page7's view, not a separate one, so
// the cascade must keep redrawing there too, or it freezes the instant the user
// scrolls into page8 mid-flight instead of finishing "off screen" as page7 intended.
// Fold 9 (#page-7, currentPage 6 — drawFold9 in js/core.js, just before the real
// timeline) is included too, now that its own axis build-in (p7AxisIntroT
// above) can be playing while it's on screen. Fold 7 (#page-6, currentPage 5 —
// drawFold7 in js/core.js) is included too, now that it also keeps drawing
// p7DrawTimelineSquares for as long as p7RealTimelineReached is true (see that
// flag's own comment) — a fast enough scroll-up can carry the user past
// #page-7 into this fold within a single continuous motion while squares are
// still mid-retreat.
// ...plus @fold13 (currentPage 12) while the axis's reverse wipe is still
// running: it can outlive @fold12 now that it runs at the build-in's speed, and
// drawPage9 finishes drawing it (see the tail of drawPage9, page9.js).
function p7ShouldRedrawForAnim() { return currentPage === 6 || currentPage === 7 || currentPage === 8 || currentPage === 9 || currentPage === 10 || currentPage === 11 || (currentPage === 12 && p7AxisOutroStart !== null); }

// The 8 claimed squares are DOM, repositioned only by updateGroups() — which
// nothing calls per frame. Same freeze page8's glide hits: without this they
// jump to wherever the morph had got to at the next scroll event instead of
// flying. Only while a grid morph is actually running (updateGroups is not
// cheap enough to run unconditionally every frame).
function p7SyncClaimedSquares() {
  if (p7GridMorph && typeof updateGroups === "function") updateGroups();
}

function p7StartAnimLoop() {
  if (p7AnimRunning) return;
  p7AnimRunning = true;
  function step() {
    if (p7ShouldRedrawForAnim()) { draw(); p7RecheckHover(); p7SyncClaimedSquares(); }
    if (p7AnyAnimActive()) {
      requestAnimationFrame(step);
    } else {
      p7AnimRunning = false;
      if (p7ShouldRedrawForAnim()) { draw(); p7RecheckHover(); p7SyncClaimedSquares(); } // final frame, locked at rest position
    }
  }
  requestAnimationFrame(step);
}

// Draws events[settledCount..monthEnd). Events strictly before settledCount are drawn
// at rest by the caller. Events in range may belong to several different months (if
// the user scrolled through more than one month within p7AnimTotalMs()) — since
// events are date-sorted, each month's events are contiguous, so the per-month cascade
// cursor is read only when the month actually changes while scanning, not on every
// single event.
//
// There is no separate forward/reverse code path: a square's presence is a pure
// function of its month's cursor (p7MonthCursor), which the tick in
// p7DrawTimelineSquares aims at p7AnimTotalMs() going forward and at 0 going
// back. A cursor sliding backward retracts the month's squares in mirrored order (the
// last to arrive is the first to leave) simply because they're the ones with the
// largest delay.
// ----------------------------------------------------------- HOVER BULGE --
// Hovering a timeline square swells it to a size set by its crowd (ev.crowd,
// server.py's join of the crowd-size column) and PUSHES the neighbours away
// so every gap around it stays exactly P7_GAP: the grown square's extra width
// is split in two, and every other square shifts by half of it, away from the
// hovered centre, on each axis it sits off-centre on. The push is full
// strength out to P7_BULGE_HOLD cells (Chebyshev distance) and eases back to
// nothing by P7_BULGE_REACH, so the grid absorbs the shove locally instead of
// the whole side sliding. Each bulge is a per-event 0..1 (p7BulgeT) eased
// toward its target on wall-clock — an outgoing bulge keeps collapsing while
// the next one opens, so skating across dots never snaps.
const P7_BULGE_MS    = 120;
const P7_BULGE_HOLD  = 12;   // cells with the gap kept exact
const P7_BULGE_REACH = 30;   // cells where the push has faded to zero
// The hover dim (every other square drops to hoverDim(actor)) ramps instead of
// flipping. A binary dim flickered when leaving a BIG square: the bulge pushes
// its neighbours away, so the pointer crosses a ring of bare canvas with no dot
// under it, hover drops, the dim snaps off, and the next pixel snaps it back
// on. Same device as page9.js's p9.hoverDimT.
const P7_HOVER_DIM_MS = 90;
// Grown side in units of SQ, by crowd tier. P7_BULGE_CUTS are the ascending
// crowd thresholds; tier = how many of them ev.crowd reaches, so
// P7_BULGE_MULT has one more entry than CUTS. Tier 0 (no figure, or below the
// first cut) is 1 — it does not swell at all. Tiers, not a continuous scale —
// a few sizes read, a ramp doesn't.
//
// These are the SIZE GRID's own ratios (`compare/`-baked 2026-09-09, mode
// "grid", scale 1): @fold10 draws a tier-k dot as a block of
// P7_GRID_TIER_CELLS[k] cells, i.e. n·CELL − GAP = (n·(1+r) − r)·SQ with
// r = p7GapRatio(). The hover used to run its own ladder (1/2.25/4/6/7.5/9),
// so the same event was one size on the timeline and another in the grid —
// the top tier 9x against nearly 20x. Keep the two in step: changing
// P7_GRID_TIER_CELLS means recomputing these.
const P7_BULGE_CUTS = [100, 2500, 25100, 100000, 250000];
const P7_BULGE_MULT = [1, 2.43, 3.86, 8.14, 12.43, 19.57];
const P7_MAX_TIER   = P7_BULGE_CUTS.length;   // the top tier's index
function p7BulgeTier(ev) {
  const n = ev && ev.crowd;
  if (!n) return 0;
  let t = 0;
  while (t < P7_BULGE_CUTS.length && n >= P7_BULGE_CUTS[t]) t++;
  return t;
}
const p7BulgeT = new Map();   // event -> { t, last }
let p7BulgeLastTick = 0;
// Advance every bulge one frame; drop the ones fully collapsed. Called once per
// draw before the squares are laid out.
function p7BulgeTick() {
  const now = performance.now();
  const dt  = p7BulgeLastTick ? Math.min(100, now - p7BulgeLastTick) : 0;
  p7BulgeLastTick = now;
  const hovered = p7Grid.on ? null : (p7.hoveredEvent || (p7Inspect && p7Inspect.dragging ? p7Inspect.event : null));
  if (hovered && p7BulgeTier(hovered) && !p7BulgeT.has(hovered)) p7BulgeT.set(hovered, { t: 0 });
  for (const [ev, b] of p7BulgeT) {
    const target = ev === hovered ? 1 : 0;
    const step = dt / P7_BULGE_MS;
    b.t = target > b.t ? Math.min(1, b.t + step) : Math.max(0, b.t - step);
    if (b.t === 0 && target === 0) p7BulgeT.delete(ev);
  }
  // The dim rides the same frame clock, but on its own (shorter) duration and
  // for EVERY hover — tier-0 squares never enter p7BulgeT, yet they dim too.
  const dimTarget = (p7.hoveredEvent || (p7Inspect && p7Inspect.dragging ? p7Inspect.event : null)) ? 1 : 0;
  if (dt) {
    const ds = dt / P7_HOVER_DIM_MS;
    p7.hoverDimT = dimTarget > p7.hoverDimT ? Math.min(1, p7.hoverDimT + ds)
                                            : Math.max(0, p7.hoverDimT - ds);
  }
  if (p7BulgeT.size === 0 && p7.hoverDimT === dimTarget) p7BulgeLastTick = 0;
}
function p7BulgeActive() {
  for (const [ev, b] of p7BulgeT) {
    const target = ev === (p7.hoveredEvent || null) ? 1 : 0;
    if (b.t !== target) return true;
  }
  // The dim ramp needs frames of its own — a tier-0 hover has no bulge at all.
  if (p7.hoverDimT !== (p7.hoveredEvent ? 1 : 0)) return true;
  return false;
}
// The bulges that touch this side, resolved to centre + half-extra push + grown
// size — one small array per draw call, not per square.
function p7BulgeList(posMap0, positions, events, cols, x0, topY, CELL, SQ) {
  p7BulgeTick(); // both sides call this per frame; the second call sees dt≈0
  const out = [];
  if (!p7BulgeT.size) return out;
  for (let i = 0; i < events.length && i < positions.length; i++) {
    const ev = events[i], b = p7BulgeT.get(ev);
    if (!b) continue;
    const cell = positions[i];
    const e = p9Ease(b.t);
    const size = SQ * (1 + (P7_BULGE_MULT[p7BulgeTier(ev)] - 1) * e);
    out.push({ ev, col: cell % cols, row: Math.floor(cell / cols), size, push: (size - SQ) / 2 });
  }
  return out;
}
// Displacement of the square at (col,row) from every bulge on this side.
function p7BulgeShift(bulges, col, row) {
  let dx = 0, dy = 0;
  for (const b of bulges) {
    const dc = col - b.col, dr = row - b.row;
    if (!dc && !dr) continue;
    const d = Math.max(Math.abs(dc), Math.abs(dr));
    const w = d <= P7_BULGE_HOLD ? 1
            : d >= P7_BULGE_REACH ? 0
            : 1 - p9Ease((d - P7_BULGE_HOLD) / (P7_BULGE_REACH - P7_BULGE_HOLD));
    if (!w) continue;
    dx += Math.sign(dc) * b.push * w;
    dy += Math.sign(dr) * b.push * w;
  }
  return { dx, dy };
}

// -------------------------------------------------------------- SIZE GRID --
// @fold10 (#page-9) IS the size grid — there is no control: arriving on the
// fold turns it on and scrolling back up to @fold9 turns it off
// (p7SizeGridOnPage, called from setActivePage in js/nav.js). ON: the timeline
// undraws (no year axis, no date meaning) and every square on screen grows to
// its crowd tier (p7BulgeTier) and flies to a cell in a packed grid where
// nothing overlaps and every neighbour gap is the timeline's own gap. OFF:
// everything flies back to its timeline cell. Size and position only — alpha
// never fades.
//
// Tiers as CELL BLOCKS: a tier-k square spans P7_GRID_TIER_CELLS[k] unit cells
// (size = n·CELL − GAP), so the gap between any two neighbours is exactly the
// unit gap — the hover's P7_BULGE_MULT ratios (1/2.25/4/6/7.5/9) become
// 1/2.43/3.86/6.71/8.14/11. The unit is P7_GRID_UNIT_PX, a design choice, not a
// solve: at 4.2px a tier-4 block is ~34px.
//
// Packing: lazy, per side, in the order squares are drawn — see p7GridCell
// below. Only what is on screen takes a cell, so the block has no holes.
// Claimed events get a cell too (fold 9's flying square reads p7.lastPositions).
// The layout is dropped and repacked on every press and on any viewport change.
let P7_GRID_TIER_CELLS = [1, 2, 3, 6, 9, 14];   // per tier, `manual/`-baked 2026-09-08
// @fold11 flattens the ladder: every square is drawn at the unit size instead
// of its tier's. Deliberately a DRAW-time override and not a different pack —
// the layout stays the tiered one, so each square shrinks on the spot, centred
// in the cell block it already occupies. Repacking at one cell each would move
// every dot as well, and the fold's first beat is a pure size-down with nothing
// travelling (the flight is the second beat, into the legit zone). It is also
// not "the grid off": off means the dots fly home to the timeline.
let p7GridUniform = false;
function p7GridCellsFor(ev) { return P7_GRID_TIER_CELLS[p7BulgeTier(ev)]; }
// The drawn cell — same centre, unit size while flattened.
function p7GridFlatten(g, L) {
  return (g && p7GridUniform) ? { cx: g.cx, cy: g.cy, sq: L.SQ } : g;
}
// How much of a side's width the block is allowed to use (it still hugs the
// corridor). 1 = the whole side. Narrower reads as a block rather than a
// full-bleed field — but width and square size trade off directly: the pack
// always fills the box height, so halving the width shrinks the unit ~√2.
let P7_GRID_WIDTH_FRAC = 0.7;    // manual/-baked 2026-09-08
// The empty corridor between the two camps' blocks, in CSS px (0 = they meet
// on the centre line). Each camp gives up half of it.
let P7_GRID_CAMP_GAP = 4;    // manual/-baked 2026-09-08
// The gap BETWEEN dots inside a camp is the timeline's own gap (p7GapRatio()),
// so a dot's spacing reads the same in both modes — only its size changes.
// The unit square, in CSS px. 0 = SOLVE it from the frame width: the pack
// always fills the box height, so the unit is whatever makes the wider camp
// come out exactly P7_GRID_WIDTH_FRAC of its side (p7SizeGridLayout). A fixed
// unit makes the width a RESULT instead — the block just widens until it fits
// everything, off screen if it must (at 1440×900, 4.5px ran ~150px past the
// left edge).
let P7_GRID_UNIT_PX = 0;
// There is deliberately NO "dot fills x% of its cell" knob (the old
// P7_GRID_DOT_FRAC, removed 2026-09-09): a fractional shrink scales with the
// block, so a 14-cell block gave up 0.42 cell a side and a 1-cell block 0.03,
// and the gap between neighbours then depended on which tiers touched (1.5 →
// 2.8px at 1440×900). Every block fills its cells exactly, so every gap is
// L.GAP — and L.GAP/L.CELL are whole device pixels (see p7BuildSizeGrid).
// Growing UP, the capped axis is the HEIGHT: how much of the box height the
// block is allowed to reach, measured from the bottom edge. The WIDTH is
// capped by P7_GRID_WIDTH_FRAC there too. Ignored when P7_GRID_GROW is "side".
let P7_GRID_HEIGHT_FRAC = 1;    // manual/-baked 2026-09-08
// Mobile gets its own pair, `manual/`-baked 2026-09-12 at 390x844 (the harness
// tuned the frame in px: 316px wide, 554px tall of the 520px box). A phone has
// the same 14451 dots in a third of the width, so the desktop 0.7 x 1 frame is
// too small to breathe: the width goes nearly full-bleed, and the height passes
// 1 deliberately — the block is ALLOWED to grow 5% past the timeline box's top
// edge, which is empty there once the axis has undrawn. The camp gap is shared
// (4px reads the same at both sizes).
let P7_GRID_MOBILE_WIDTH_FRAC  = 0.808;
let P7_GRID_MOBILE_HEIGHT_FRAC = 1.065;
// Always read the frame through these, never the constants: `isMobile()` is read
// live, so a resize across the 600px breakpoint re-solves the unit for free.
function p7GridWidthFrac()  { return isMobile() ? P7_GRID_MOBILE_WIDTH_FRAC  : P7_GRID_WIDTH_FRAC; }
function p7GridHeightFrac() { return isMobile() ? P7_GRID_MOBILE_HEIGHT_FRAC : P7_GRID_HEIGHT_FRAC; }
// Headroom left to the lazy pack's order-dependent frontier, in cells — see the
// solve in p7SizeGridLayout. Small: it costs a hair of unit size, and without it
// HEIGHT_FRAC = 1 clips.
let P7_GRID_PACK_SLACK_CELLS = 3;
// How ragged the block's OUTER edge is, 0..1. The packing itself never
// loosens — squares always drop into the shallowest run, so the block stays
// solid with one uniform gap. Jitter instead gives each row a per-row WALL:
// the block's own width minus a seeded noise contour, and a square may not
// cross its rows' wall. Short rows fill and stop; the overflow goes to the
// long ones. So only the outer edge moves, and it moves as chunky teeth, not
// per-row static (the noise is interpolated over P7_GRID_JITTER_WAVE rows).
let P7_GRID_EDGE_JITTER = 0.7;   // compare/-baked 2026-09-08
let P7_GRID_JITTER_CELLS = 25;   // deepest tooth, in cells, at jitter = 1
let P7_GRID_JITTER_WAVE  = 2;    // rows per noise control point (tooth width)
// HOW the pack is arranged — both are `compare/` axes,
// and both feed p7GridKey, so changing either rebuilds the layout from scratch.
//   order:    the sequence squares claim cells in, inside their bucket.
//             arrival = the order they are drawn (date order) — the original.
//   grouping: how a camp's block is subdivided into side-by-side column bands.
//             camp = not at all, one block per camp — the original.
// WHICH WAY a camp's block grows.
//   side = the original: lanes are rows, the block fills the box height first
//          and then widens away from the corridor. P7_GRID_WIDTH_FRAC is how
//          much of the side's width it ends up using.
//   up   = lanes are columns: the block fills the camp's width first and then
//          grows UPWARD from the bottom of the box. The camp gap is untouched
//          (each block still starts at its own side of the corridor), the
//          jitter contour becomes the block's TOP edge, P7_GRID_WIDTH_FRAC
//          caps the width (fewer lanes = a taller, narrower block) and
//          P7_GRID_HEIGHT_FRAC caps how far up it may reach.
//   spread = the only mode that does NOT pack. One cell lattice spans
//          P7_GRID_SPREAD_FRAC of the SCREEN, centred; each camp owns its half
//          of it out from the corridor, and every square takes a RANDOM free
//          n×n spot anywhere in that region (p7GridScatter). So the dots are
//          scattered freeform over the whole width — on the lattice, never
//          overlapping, but with no block, no frontier and no columns being
//          pushed outward. How dense the scatter is comes from the unit, which
//          is solved by AREA (p7SpreadUnit) rather than by packing.
//          P7_GRID_WIDTH_FRAC, the jitter contour and the big-block repulsion
//          are all ignored here — none of them mean anything without a pack.
let P7_GRID_GROW = "up";          // side | up | spread
// `spread` only: how much of the box width the lattice spans, centred. 1 = the
// full box. The unit is solved against HALF of it (one camp's reach).
let P7_GRID_SPREAD_FRAC = 0.8;
// `spread` only: HOW spread out. It divides the fill fraction the unit is
// solved for, so the same dots cover the same region with smaller squares and
// more air between them. 1 = P7_GRID_SPREAD_FILL of the region covered.
let P7_GRID_SPREAD_LOOSE = 1;
// What share of a camp's region the squares' cells add up to at loose 1.
// Scatter placement cannot approach 1 — above ~0.7 the rejection sampler runs
// out of free spots and the sweep fallback starts filling the region corner
// first, which reads as a pack again.
const P7_GRID_SPREAD_FILL = 0.6;
let P7_GRID_ORDER    = "random";    // arrival | size | small | random — baked 2026-09-08
let P7_GRID_GROUPING = "camp";      // camp | none | group | tier | random
// How many bands the `random` grouping cuts each block into.
const P7_GRID_RANDOM_BANDS = 3;
let P7_GRID_SEED = 20260908;      // fixed, so "random" is the same every rebuild
const p7Grid = { on: false, layout: null, solveVis: null, packVis: null };
// The size grid PACKS over the survivors but is SIZED over everyone. The unit
// is deliberately filter-independent: both camps share one unit (the fuller camp
// wins the solve), so letting the filter into it meant hiding a group in one camp
// resized every dot in the OTHER camp too. Sizing off the full roster keeps a
// survivor exactly the size it already was; the filter only ever re-packs.
// Read at call time, so it doesn't matter that the filter state is declared
// further down.
function p7GridRosterAll() {
  return [...(p7.leftEvents || []), ...(p7.rightEvents || [])];
}
function p7GridRoster() {
  const all = p7GridRosterAll();
  return (typeof p7FilterHiddenEv === "function") ? all.filter(e => !p7FilterHiddenEv(e)) : all;
}
// Re-pack ONE camp, keeping the other's cells exactly as they are. The layout
// object (and so the unit) survives; only this side's skyline, bands and cached
// cells are dropped, and p7GridCell re-claims them lazily on the next frame.
function p7GridClearSide(side) {
  const L = p7Grid.layout;
  if (!L) return;
  // `none` puts both camps on one shared skyline, so there is no "one side" to
  // clear — fall back to the full rebuild.
  if (P7_GRID_GROUPING === "none") { p7Grid.layout = null; return; }
  L.done[side] = false;
  L.bucket[side].clear();
  if (L.scat) L.scat[side] = null;
  for (const e of (side === "left" ? p7.leftEvents : p7.rightEvents) || []) L.pos.delete(e);
}

// Packing is LAZY and arrival-ordered, and that is the point: a square gets a
// cell the first time it is actually DRAWN (p7GridCell, called from
// p7DrawSideSquares *after* the visibility gate). Packing the whole ~14k
// roster up front reserved a cell for every square the scroll had not revealed
// yet, and every reserved cell rendered as a hole in the block.
// Each side keeps a live skyline — widths[row] = how far out that row already
// reaches. A new square takes the run of n rows whose furthest-out column is
// nearest the centre line, so the block stays solid with one uniform gap, fills
// top-to-bottom before it widens, and nothing already placed ever moves.
// The jitter's teeth: a per-row NOTCH depth (0 … P7_GRID_JITTER_CELLS cells),
// smooth seeded noise so the bites are chunky, not per-row static. The wall a
// row actually enforces is `sky.limit - notch[r]`, and `limit` grows as the
// block fills — so the contour slides outward keeping its shape instead of
// being filled in. All zeros when jitter is 0 (a flat outer edge).
function p7GridNotch(rows, rnd) {
  const notch = new Int32Array(rows);
  const depth = P7_GRID_EDGE_JITTER * P7_GRID_JITTER_CELLS;
  if (depth <= 0) return notch;
  const pts = Math.ceil(rows / P7_GRID_JITTER_WAVE) + 2;
  const ctrl = new Float64Array(pts);
  for (let i = 0; i < pts; i++) ctrl[i] = rnd();
  for (let r = 0; r < rows; r++) {
    const f = r / P7_GRID_JITTER_WAVE, i = Math.floor(f), t = f - i;
    const v = ctrl[i] + (ctrl[i + 1] - ctrl[i]) * (t * t * (3 - 2 * t));   // smoothstep
    notch[r] = Math.round(v * depth);
  }
  return notch;
}
function p7GridSky(rows) {
  const rnd = p7GridRng();
  return {
    widths: new Int32Array(rows), maxW: 0, limit: 0, rnd,
    notch: p7GridNotch(rows, rnd),
    holes: [],   // dead cells an n>1 block stepped over — backfilled, see below
    // Big-block repulsion (see P7_GRID_BIG_SPREAD). bigCol[lane] = how far out
    // the last big block covering that lane reaches; `field` is its Chebyshev
    // cone spread over every lane (a 2-pass distance transform), so asking
    // "how close is this candidate to a big block" is one array read per lane
    // instead of a scan over every big block placed so far — which matters now
    // that "big" means everything but the smallest tier (thousands of them).
    bigCol: new Float64Array(rows).fill(-1e9),
    field:  new Float64Array(rows).fill(-1e9),
    fieldDirty: false,
  };
}
// F[i] = max_j (bigCol[j] − |i − j|): the cone of influence of every big block,
// in one forward and one backward pass.
function p7GridField(sky) {
  const F = sky.field, B = sky.bigCol, N = F.length;
  F[0] = B[0];
  for (let i = 1; i < N; i++) F[i] = Math.max(B[i], F[i - 1] - 1);
  for (let i = N - 2; i >= 0; i--) F[i] = Math.max(F[i], F[i + 1] - 1);
  sky.fieldDirty = false;
}
// How far apart the big blocks are kept, 0..1 (0 = the old behaviour: pure
// skyline, so the big ones clump wherever the frontier happens to be lowest).
// A candidate run is charged a penalty for sitting within
// P7_GRID_BIG_REACH cells of an already-placed big block, which pushes the
// next one somewhere else; it is a nudge on the CHOICE of run, never a
// loosening of the pack — the block still lands on the skyline, so no dead
// space is created by spreading.
let P7_GRID_BIG_SPREAD = 1;
let P7_GRID_BIG_MIN     = 5;    // cells: the smallest block that counts as "big"
                                // (2 = everything but the smallest tier — see the wiki:
                                //  at 2 the big blocks are ~3/4 of the area and spreading
                                //  them can only be paid for in holes)
const P7_GRID_BIG_REACH = 6;    // cells: how far the penalty reaches at spread 1
const P7_GRID_BIG_WEIGHT = 20;  // how hard that penalty bites against the reach term
function p7GridPlace(sky, n, rows) {
  // Backfill first: a 1-cell square goes into a hole an earlier big block left
  // behind, so the interior never shows black. (Only n = 1 — a bigger square
  // would need the same free columns on n consecutive rows, which a hole
  // almost never has, and looking for it costs more than it saves.)
  if (n === 1 && sky.holes.length) {
    const h = sky.holes[sky.holes.length - 1];
    const col = h.from++;
    if (h.from >= h.to) sky.holes.pop();
    return { k: col, row: h.r };
  }
  const spread = P7_GRID_BIG_SPREAD > 0 && n >= P7_GRID_BIG_MIN ? P7_GRID_BIG_SPREAD : 0;
  const reach  = spread * P7_GRID_BIG_REACH;
  if (reach > 0 && sky.fieldDirty) p7GridField(sky);
  let bestRow = 0, bestK = Infinity, freeRow = 0, freeK = Infinity;
  for (;;) {
    let bestCost = Infinity;
    bestK = Infinity; freeK = Infinity;
    for (let r = 0; r + n <= rows; r++) {
      let w = 0, sum = 0, cap = Infinity;
      for (let j = r; j < r + n; j++) {
        if (sky.widths[j] > w) w = sky.widths[j];
        sum += sky.widths[j];
        const c = sky.limit - sky.notch[j];
        if (c < cap) cap = c;
      }
      if (w < freeK) { freeK = w; freeRow = r; }         // the notch-blind shallowest
      if (w + n > cap) continue;
      // Cost = how far out the run reaches, plus the dead cells stepping over
      // an uneven run would strand (w·n − Σwidths, per row), plus the
      // big-block repulsion. The waste term is what keeps holes rare in the
      // first place; the backfill above mops up the rest.
      let cost = w + (w * n - sum) / n;
      if (reach > 0) {
        let f = -1e9;
        for (let j = r; j < r + n; j++) if (sky.field[j] > f) f = sky.field[j];
        const gap = w - f;                            // cells of clear space to the nearest big block
        if (gap < reach) cost += (reach - gap) * spread * P7_GRID_BIG_WEIGHT;
      }
      if (cost < bestCost) { bestCost = cost; bestK = w; bestRow = r; }
    }
    if (bestK !== Infinity) break;
    if (freeK === Infinity) { bestK = sky.maxW; bestRow = 0; break; }   // block taller than the box
    sky.limit++;   // block full to its contour — slide the whole contour out a cell
  }
  for (let j = bestRow; j < Math.min(rows, bestRow + n); j++) {
    if (sky.widths[j] < bestK) sky.holes.push({ r: j, from: sky.widths[j], to: bestK });
    sky.widths[j] = bestK + n;
  }
  if (n >= P7_GRID_BIG_MIN) {
    for (let j = bestRow; j < Math.min(rows, bestRow + n); j++)
      if (sky.bigCol[j] < bestK + n) sky.bigCol[j] = bestK + n;
    sky.fieldDirty = true;
  }
  if (bestK + n > sky.maxW) sky.maxW = bestK + n;
  return { k: bestK, row: bestRow };
}
// The cell for one event — placed on first ask, then cached for good.
// Which column band an event belongs to, under the current grouping. `camp` is
// one band per side (the original single block); the others split the side.
function p7GridBucketOf(ev) {
  if (P7_GRID_GROUPING === "group") return ev.actor || "?";
  if (P7_GRID_GROUPING === "tier")  return p7BulgeTier(ev);
  if (P7_GRID_GROUPING === "random") {
    // Hashed off the event's own fields, not off a counter — a square that
    // scrolls in after the pre-claim pass must land in the same band it would
    // have got had it been on screen at the flip. This is the control for the
    // `group`/`tier` bands: same band count, no meaning.
    const str = `${ev.date}|${ev.actor}|${ev.crowd}`;
    let h = 2166136261 ^ P7_GRID_SEED;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) % P7_GRID_RANDOM_BANDS;
  }
  return "all";
}
// Band order, corridor outward: legend row order for groups, biggest tier first
// for tiers — so either grouping reads as a deliberate sequence, not a shuffle.
function p7GridBucketRank(id) {
  if (P7_GRID_GROUPING === "group") {
    const g = typeof GROUPS !== "undefined" ? GROUPS.find(x => x.actor === id) : null;
    return g ? g.fold6.y : 9999;
  }
  if (P7_GRID_GROUPING === "tier") return -id;
  if (P7_GRID_GROUPING === "random") return id;
  return 0;
}
// Deterministic shuffle (mulberry32 off P7_GRID_SEED) — "random" must be the
// same pack every rebuild, or comparing it against anything is meaningless.
function p7GridRng() {
  let a = P7_GRID_SEED >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function p7GridShuffle(arr) {
  const rnd = p7GridRng();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
// The pre-claim pass — what makes `order` and `grouping` possible at all.
// Lazy arrival-order packing (the original) can't sort or bucket, because it
// only ever sees one square at a time. So on the first ask for a side we take
// the squares that are ACTUALLY ON SCREEN (p7.lastPositions, i.e. exactly the
// visibility gate's own answer from the last frame), bucket them, size each
// bucket's column band by its share of the total area, and place them in the
// chosen order. Squares that scroll in afterwards still land lazily, in their
// own band. With order=arrival + grouping=camp this is byte-identical to the
// original lazy pack: one band, list order, same skyline.
function p7GridPreclaim(L, isLeft) {
  // `none` = no camp split at all: one block for the whole roster, packed from
  // the box's left edge across the centre line. Both sides share one skyline
  // and one pre-claim pass, so the camps interleave instead of meeting in the
  // middle — the corridor (P7_GRID_CAMP_GAP) is not drawn either.
  const flat = P7_GRID_GROUPING === "none";
  const side = flat ? "right" : (isLeft ? "left" : "right");
  if (L.done[side]) return;
  L.done[side] = true;
  if (flat) L.done.left = L.done.right = true;
  const events = flat
    ? p7GridRoster().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    : ((isLeft ? p7.leftEvents : p7.rightEvents) || []);
  // packVis (set by the legend filter) stands in for the on-screen gate: a group
  // being RESTORED isn't drawn yet, so p7.lastPositions doesn't have it, and its
  // dots would then trickle in lazily and clump onto the frontier as one solid
  // block of that colour. Pre-claiming the whole survivor set instead re-lays the
  // camp in list order, so a restored group comes back shuffled through the rest.
  const gate = p7Grid.solveVis || p7Grid.packVis;
  const vis = gate ? events.filter(e => gate.has(e)) : events.filter(e => p7.lastPositions.has(e));
  if (!vis.length) return;

  const byId = new Map();
  for (const e of vis) {
    const id = p7GridBucketOf(e);
    if (!byId.has(id)) byId.set(id, { id, list: [] });
    byId.get(id).list.push(e);
  }
  // Bands are laid out by PACKING, not by estimating: a band starts one cell
  // past how far out the previous one actually reached (sky.maxW). Sizing them
  // up front from each bucket's area looked right and wasn't — a band whose
  // skyline outgrew its allotted width spilled into its neighbour and the two
  // overlapped. Packed sequentially, they can't.
  const buckets = [...byId.values()].sort((a, b) => p7GridBucketRank(a.id) - p7GridBucketRank(b.id));
  let off = 0;
  for (const b of buckets) {
    b.colOff = off;
    b.sky = p7GridSky(L.lanes);
    L.bucket[side].set(b.id, b);
    // Scatter places biggest-first whatever P7_GRID_ORDER says: a 14-cell
    // block dropped into an already-speckled region has almost nowhere to
    // land, and the fallback sweep then has to overlap it. Big first, and
    // every later square is a 1-cell one that fits anywhere.
    if (L.spread || P7_GRID_ORDER === "size") b.list.sort((x, y) => p7BulgeTier(y) - p7BulgeTier(x));
    else if (P7_GRID_ORDER === "small")  b.list.sort((x, y) => p7BulgeTier(x) - p7BulgeTier(y));
    else if (P7_GRID_ORDER === "random") p7GridShuffle(b.list);
    const singles = [];
    const cell = {};
    for (const e of b.list) {
      p7GridClaim(L, b, e, isLeft, cell);
      if (!L.spread && cell.n === 1) singles.push({ e, k: cell.k, row: cell.row });
    }
    // Close the leftover holes. A block of n cells has to sit at the furthest-out
    // column across its n lanes, so it steps over the shallower ones and strands
    // dead cells behind it; p7GridPlace backfills those with the next 1-cell
    // square, but the ones opened after the LAST 1-cell square of the band had
    // nothing left to fill them and stayed as visible black gaps in the middle
    // of the field. So once the band is packed, pull 1-cell squares back OFF the
    // outer frontier into whatever holes remain: only ever a square that IS the
    // tip of its lane (pulling one out of the middle would open a new hole where
    // it stood) and only inward (k > the hole), so the block gets shorter, never
    // longer. Each move exposes the next square down that lane, which may be a
    // tip in its turn, so the sweep keeps going until the holes run out or
    // nothing movable is left further out than the deepest hole.
    if (!L.spread) {
      const sky = b.sky;
      // Per lane, its 1-cell squares by depth — the last one is the candidate
      // tip, and popping it exposes the one under it.
      const lane = new Map();
      singles.sort((x, y) => x.k - y.k);
      for (const s1 of singles) {
        if (!lane.has(s1.row)) lane.set(s1.row, []);
        lane.get(s1.row).push(s1);
      }
      while (sky.holes.length) {
        const h = sky.holes[sky.holes.length - 1];
        // The movable square furthest out — taking the outermost first is what
        // makes the frontier come in rather than just shuffle.
        let best = null, bestLane = null;
        for (const [r, list] of lane) {
          const s1 = list[list.length - 1];
          if (!s1 || s1.k !== sky.widths[r] - 1 || s1.k <= h.from) continue;
          if (!best || s1.k > best.k) { best = s1; bestLane = list; }
        }
        if (!best) break;
        bestLane.pop();
        const k = h.from++;
        if (h.from >= h.to) sky.holes.pop();
        L.pos.set(best.e, p7GridRect(L, b, 1, k, h.r, isLeft));
        sky.widths[best.row] = best.k;                // the contour comes in a cell
      }
      sky.maxW = 0;
      for (let r = 0; r < sky.widths.length; r++) if (sky.widths[r] > sky.maxW) sky.maxW = sky.widths[r];
    }
    off += b.sky.maxW + 1;   // +1 = the empty cell between two bands
  }
}
// ---- `spread`: freeform scatter, not a pack -------------------------------
// A camp's region is its half of the lattice (out from the corridor) by the
// full box height, in cells. Each square takes a RANDOM free n×n spot in it —
// rejection sampling, which is what makes the result look scattered rather
// than arranged. Squares still land on lattice cells and still never overlap;
// what's gone is the frontier, so nothing is pushed outward and the dots cover
// the whole width from the first one placed.
function p7GridScatterState(L, side) {
  let S = L.scat[side];
  if (S) return S;
  const cols = Math.max(1, Math.floor((L.latCols * L.CELL / 2 - L.campHalf) / L.CELL));
  S = { cols, rows: L.lanes, occ: new Uint8Array(cols * L.lanes), rnd: p7GridRng(), scan: 0 };
  L.scat[side] = S;
  return S;
}
function p7GridScatterFree(S, c, r, n) {
  for (let j = r; j < r + n; j++)
    for (let i = c; i < c + n; i++) if (S.occ[j * S.cols + i]) return false;
  return true;
}
function p7GridScatter(S, n) {
  const cw = S.cols - n + 1, rw = S.rows - n + 1;
  if (cw <= 0 || rw <= 0) return { k: 0, row: 0 };   // block bigger than the region
  let c = 0, r = 0, got = false;
  for (let t = 0; t < 60 && !got; t++) {
    c = (S.rnd() * cw) | 0; r = (S.rnd() * rw) | 0;
    got = p7GridScatterFree(S, c, r, n);
  }
  if (!got) {
    // Nearly full — 60 darts all missed. Sweep on from where the last sweep
    // stopped (amortised O(1)) for the first spot that does fit.
    const N = cw * rw;
    for (let t = 0; t < N && !got; t++) {
      const i = (S.scan + t) % N;
      c = i % cw; r = (i / cw) | 0;
      if (p7GridScatterFree(S, c, r, n)) { S.scan = i; got = true; }
    }
  }
  for (let j = r; j < r + n; j++)
    for (let i = c; i < c + n; i++) S.occ[j * S.cols + i] = 1;
  return { k: c, row: r };
}
// Place one event in its band and cache the rest cell.
function p7GridClaim(L, b, ev, isLeft, out) {
  const n = p7GridCellsFor(ev);
  const sSide = isLeft && P7_GRID_GROUPING !== "none" ? "left" : "right";
  const { k, row } = L.spread ? p7GridScatter(p7GridScatterState(L, sSide), n)
                              : p7GridPlace(b.sky, n, L.lanes);
  const g = p7GridRect(L, b, n, k, row, isLeft);
  L.pos.set(ev, g);
  // The caller (p7GridPreclaim's hole sweep) needs the lattice cell, not just
  // the rect, to be able to move this square later.
  if (out) { out.n = n; out.k = k; out.row = row; }
  return g;
}
// The rect for a block of n cells at lane `row`, depth `k` — one formula for the
// first claim and for the hole-fill move (p7GridPreclaim), so both land on the
// same lattice. The dot fills its cells exactly (n·CELL − GAP): that is what
// makes every gap between any two neighbours the same L.GAP.
function p7GridRect(L, b, n, k, row, isLeft) {
  const sSide = isLeft && P7_GRID_GROUPING !== "none" ? "left" : "right";
  // Scattered squares are placed in absolute region cells, so the band offset
  // (which only exists to stack packed bands) does not apply to them.
  const depth = L.spread ? k : b.colOff + k;
  const sq = n * L.CELL - L.GAP;
  if (L.up) return {
    // Lanes run ACROSS the camp (from the corridor outward); depth runs UP from
    // the bottom edge of the box.
    cx: P7_GRID_GROUPING === "none" ? L.boxLeft + (row + n / 2) * L.CELL
      : isLeft ? L.leftEdge - (row + n / 2) * L.CELL
      : L.rightX0 + (row + n / 2) * L.CELL,
    cy: L.top + L.boxH - (depth + n / 2) * L.CELL,
    sq,
  };
  if (L.spread) return {
    // `depth` is a free cell somewhere in the camp's half of the lattice, not a
    // distance a frontier reached — the square sits wherever the scatter put
    // it. Both camps count cells from the same middle column (left leftward,
    // right rightward), so however sparse it gets everything stays on one grid.
    cx: sSide === "left"
      ? L.latMid - L.campHalf - (depth + n / 2) * L.CELL
      : L.latMid + L.campHalf + (depth + n / 2) * L.CELL,
    cy: L.top + (row + n / 2) * L.CELL,
    sq,
  };
  return {
    cx: P7_GRID_GROUPING === "none" ? L.boxLeft + (depth + n / 2) * L.CELL
      : isLeft ? L.leftEdge - (depth + n / 2) * L.CELL
      : L.rightX0 + (depth + n / 2) * L.CELL,
    cy: L.top + (row + n / 2) * L.CELL,
    sq,
  };
}
// The cell for one event — placed on first ask, then cached for good.
function p7GridCell(ev, isLeft) {
  const L = p7Grid.layout;
  if (!L) return null;
  p7GridPreclaim(L, isLeft);
  let g = L.pos.get(ev);
  if (g) return p7GridFlatten(g, L);
  const side = P7_GRID_GROUPING === "none" ? "right" : (isLeft ? "left" : "right");
  const id = p7GridBucketOf(ev);
  let b = L.bucket[side].get(id);
  if (!b) {                                   // a band nothing was visible from yet
    b = { id, colOff: 0, width: L.cols, sky: p7GridSky(L.lanes) };
    L.bucket[side].set(id, b);
  }
  return p7GridFlatten(p7GridClaim(L, b, ev, isLeft), L);
}
function p7GridKey(W, H) {
  return `${W}x${H}@${window.devicePixelRatio || 1}:${P7_GRID_GROW}:${P7_GRID_SPREAD_FRAC}:${P7_GRID_SPREAD_LOOSE}:${P7_GRID_BIG_MIN}:${p7GridWidthFrac()}:${p7GridHeightFrac()}:${P7_GRID_UNIT_PX}:${P7_GRID_CAMP_GAP}:${P7_GRID_ORDER}:${P7_GRID_GROUPING}:${P7_GRID_EDGE_JITTER}:${P7_GRID_BIG_SPREAD}:${P7_GRID_TIER_CELLS.join("/")}`;
}
// The empty grid: geometry only (unit, rows, the two camps' inner edges) plus
// the two empty skylines p7GridCell fills in as squares arrive.
function p7BuildSizeGrid(W, H, unit, cellPx) {
  const box   = sbbTimeline(H);
  const top   = box.top * H;
  const boxH  = (box.bottom - box.top) * H;
  const half  = P7_GRID_CAMP_GAP / 2;                                     // the corridor each camp gives up
  const up    = P7_GRID_GROW === "up";
  const spread = P7_GRID_GROW === "spread";
  // Half the SCREEN, minus the camp's half-corridor — not the timeline box:
  // the size grid is full-bleed, so P7_GRID_WIDTH_FRAC = 1 must mean "out to
  // the edge of the window". Measuring from the box inset left a ~150px white
  // margin down each side that no knob could close.
  const full  = W / 2 - half;
  // The `spread` lattice: one grid of latCols columns from latLeft, shared by
  // both camps. Each packs inward from its own end; the leftover in the middle
  // is the corridor, and it moves.
  // The full VIEWPORT width, not the timeline box: `spread` exists so the two
  // camps reach the sides of the screen, and the box inset would stop them
  // ~150px short of each edge.
  const latW  = W * P7_GRID_SPREAD_FRAC;
  const latLeft = W / 2 - latW / 2;
  // Growing sideways, WIDTH_FRAC caps the width and the depth axis is
  // horizontal; growing up, the block uses the full width and HEIGHT_FRAC caps
  // the height — the depth axis is vertical. `depthPx` is whichever axis is
  // capped, and it is what p7SizeGridLayout solves the unit against.
  // P7_GRID_WIDTH_FRAC is the max WIDTH in every mode, including `up` (where
  // it caps how many lanes the block gets, so it grows taller instead of
  // wider); HEIGHT_FRAC only ever caps `up`'s depth axis.
  const sideW = full * p7GridWidthFrac();
  // ---- the lattice is quantised to DEVICE pixels --------------------------
  // p7DrawSideSquares snaps every square to the device grid on its own
  // (`q()`), one dot at a time. On a lattice whose CELL and GAP are fractional
  // device pixels that snap lands differently for each dot, so identical gaps
  // came out 2 device px here and 3 there and block edges wobbled half a pixel
  // — an even grid that renders uneven. Solve it once, for the whole lattice:
  //   • CELL floors to a whole device px, never up, so a solved unit is only
  //     ever SHORTENED and p7SizeGridLayout's "undershoot only" promise holds.
  //   • GAP is a whole device px, at least one, leaving the square at least one.
  //   • every square's edge is origin ± k·CELL ± GAP/2, so it is the origin
  //     PLUS HALF A GAP that has to land on the device grid — `qh` snaps that,
  //     which is why an odd gap costs nothing (forcing GAP even instead made
  //     the dots 1px with a 2px gap at dpr 1).
  // Then every rect edge is already on the device grid and `q()` is a no-op.
  const dpr   = window.devicePixelRatio || 1;
  const sq0   = unit || (P7_GRID_UNIT_PX > 0 ? P7_GRID_UNIT_PX : p7Sq());
  // cellPx (the solve loop) is already a whole device px and is used verbatim:
  // re-deriving the cell from a quantised SQ would drift it a pixel smaller
  // every round trip.
  const CELL  = cellPx || Math.max(2 / dpr, Math.floor(sq0 * (1 + p7GapRatio()) * dpr) / dpr);
  // The gap is the timeline's own gap RATIO of the cell, rounded to a whole
  // device px — derived from CELL, never from sq0, so a cell the solve grew or
  // shrank keeps the same dot-to-gap proportion instead of putting all of the
  // change into the gap.
  const GAP   = Math.min(CELL - 1 / dpr,
                         Math.max(1, Math.round(CELL * p7GapRatio() / (1 + p7GapRatio()) * dpr)) / dpr);
  const sq    = CELL - GAP;
  // A lattice origin: snapped so that origin + GAP/2 (a square's actual edge)
  // is on the device grid.
  const qd    = v => Math.round((v + GAP / 2) * dpr) / dpr - GAP / 2;
  const rows  = Math.max(1, Math.floor(boxH / CELL));
  const wide  = P7_GRID_GROUPING === "none"
    ? (W - 2 * sbbTimelineLeftX(W, H)) * p7GridWidthFrac() : sideW;
  return {
    key: p7GridKey(W, H), SQ: sq, CELL, GAP, rows, sideW, up, spread,
    cols: Math.max(1, Math.floor(sideW / CELL)),
    lanes: up ? Math.max(1, Math.floor(wide / CELL)) : rows,
    depthPx: up ? boxH * p7GridHeightFrac() : spread ? latW / 2 - half : sideW,
    // Snapped to a whole cell: an arbitrary px corridor would put the two camps
    // half a cell out of phase with each other, and the whole point of `spread`
    // is that both blocks live on ONE grid.
    campHalf: spread ? Math.round(half / CELL) * CELL : half,
    // `spread` only: the per-camp scatter occupancy, built on first claim.
    scat: { left: null, right: null },
    latLeft: qd(latLeft), latCols: Math.max(1, Math.floor(latW / CELL)),
    // The lattice's middle column — snapped to a whole cell so both camps sit
    // on the same columns. The corridor (P7_GRID_CAMP_GAP) still opens around
    // it, half to each camp, exactly as in `side`.
    latMid: qd(latLeft + Math.round(latW / 2 / CELL) * CELL),
    // Every lattice origin sits on a device pixel too — `up` counts depth from
    // top + boxH, so that sum is what gets snapped, not boxH on its own.
    top: qd(top), leftEdge: qd(W / 2 - half), rightX0: qd(W / 2 + half),
    boxLeft: qd(sbbTimelineLeftX(W, H)), boxRight: W - sbbTimelineLeftX(W, H),
    boxH: qd(top + boxH) - qd(top),
    pos: new Map(),
    bucket: { left: new Map(), right: new Map() },
    done: { left: false, right: false },
  };
}
// The `spread` unit. The squares' cells have to add up to a fixed SHARE of the
// camp's region (P7_GRID_SPREAD_FILL, divided by P7_GRID_SPREAD_LOOSE) — that
// share is what "how dense the scatter is" means, and it is one closed-form
// solve instead of the pack-measure-rescale loop the other modes need. The
// fuller camp wins, so both share one unit and neither overflows.
function p7SpreadUnit(W, H) {
  const box  = sbbTimeline(H);
  const boxH = (box.bottom - box.top) * H;
  const span = W * P7_GRID_SPREAD_FRAC / 2 - P7_GRID_CAMP_GAP / 2;
  const vis = p7.lastPositions.size ? [...p7.lastPositions.keys()] : p7GridRosterAll();
  const leftSet = new Set(p7.leftEvents || []);
  const cells = { left: 0, right: 0 };
  for (const e of vis) {
    const n = p7GridCellsFor(e);
    cells[P7_GRID_GROUPING !== "none" && leftSet.has(e) ? "left" : "right"] += n * n;
  }
  const fill = P7_GRID_SPREAD_FILL / Math.max(1, P7_GRID_SPREAD_LOOSE);
  let CELL = Infinity;
  for (const side of ["left", "right"])
    if (cells[side]) CELL = Math.min(CELL, Math.sqrt(fill * span * boxH / cells[side]));
  return isFinite(CELL) ? CELL / (1 + p7GapRatio()) : 0;
}
function p7SizeGridLayout(W, H) {
  const key = p7GridKey(W, H);
  if (!p7Grid.layout || p7Grid.layout.key !== key) {
    let unit = P7_GRID_UNIT_PX > 0 ? P7_GRID_UNIT_PX : 0;
    // `spread` has no frontier to measure, so its unit is solved by AREA
    // instead of by packing — see p7SpreadUnit.
    if (!unit && P7_GRID_GROW === "spread") unit = p7SpreadUnit(W, H);
    if (!unit) {
      // Solve the unit for the width, on throwaway layouts: pack what is on
      // screen (the whole roster if nothing is yet — a cold jump onto the
      // fold), measure how far out the wider camp reached, rescale. Area is
      // conserved (rows × maxW ≈ const), so the width used goes as CELL² and
      // a few rounds land within 2%. The real layout is then built fresh at
      // that unit, so it still packs lazily.
      // The FULL roster, never just what is on screen: the unit has to make the
      // FINISHED block fit. Solving from p7.lastPositions sized it for whatever
      // had arrived at press time (at 1440x900, 8790 of the right camp's 9126),
      // and the stragglers then pushed the taller camp ~8px past the frame top,
      // where it read as clipped. The pack itself is still lazy — this only
      // feeds the throwaway solve layouts.
      p7Grid.solveVis = new Set(p7GridRosterAll());
      let L = p7BuildSizeGrid(W, H);
      // The lattice is quantised to whole device pixels, so the unit can only
      // move in steps — a ratio rescale often lands back on the same cell.
      // Track the largest cell that actually FITS and use that one; the loop
      // may otherwise end on a rebuild that overshoots the frame (at 1440×900
      // it left ~1200 dots clipped above the top edge).
      const dprS = window.devicePixelRatio || 1;
      let bestCell = 0;
      for (let i = 0; i < 8; i++) {
        p7Grid.layout = L;
        p7GridPreclaim(L, true); p7GridPreclaim(L, false);
        let reach = 0;
        for (const side of ["left", "right"]) for (const b of L.bucket[side].values()) reach = Math.max(reach, b.colOff + b.sky.maxW);
        if (!reach) break;
        // Aim a few cells SHORT of the frame. The real pack is lazy and fills in
        // the order the dots arrive, which is not the order these throwaway
        // solve layouts use, and an order-dependent frontier lands a cell or
        // two either way — so solving for "exactly the frame" let the taller
        // camp poke past its top edge and read as clipped.
        const want = (L.depthPx - P7_GRID_PACK_SLACK_CELLS * L.CELL) / (reach * L.CELL);
        // Only an UNDERshoot is acceptable. The tolerance used to be two-sided,
        // so a converged unit could sit up to 2% over the frame — invisible
        // while HEIGHT_FRAC left slack, but at 1 the taller camp's jitter
        // spikes ran off the top edge and the block came out clipped.
        if (want >= 1 && L.CELL > bestCell) bestCell = L.CELL;
        if (want >= 1 && want - 1 < 0.02) break;
        let next = Math.floor(L.CELL * Math.sqrt(want) * dprS) / dprS;
        // A rescale that rounds back onto the current cell would spin in place:
        // take one device pixel in the direction it asked for instead.
        if (next === L.CELL) next = L.CELL + (want < 1 ? -1 : 1) / dprS;
        // The rescale is a RATIO, so a frame far too small for the roster can
        // ask for a sub-pixel cell in a single jump. Clamp to the floor and
        // try it instead of bailing: bailing left `bestCell` unset and fell
        // through to `L.SQ` of the LAST build — the biggest cell tried — so
        // shrinking the frame made the dots grow and run off the top edge.
        // Only give up once the floor itself is what we just built, i.e. the
        // lattice cannot get any finer and the frame is genuinely too small.
        const floorCell = 2 / dprS;
        if (next < floorCell) next = floorCell;
        if (next === L.CELL) break;
        L = p7BuildSizeGrid(W, H, 0, next);
      }
      unit = L.SQ;
      if (bestCell) { p7Grid.layout = null; p7Grid.solveVis = null;
        p7Grid.layout = p7BuildSizeGrid(W, H, 0, bestCell); return p7Grid.layout; }
      p7Grid.solveVis = null;
    }
    p7Grid.layout = p7BuildSizeGrid(W, H, unit);
  }
  return p7Grid.layout;
}

// The toggle's animation: every square on screen keeps existing and flies
// centre-to-centre from where it is (mid-morph included — a click mid-flight
// continues from the blend) to its new cell while resizing. One clock of
// p7MorphTotalMs(), p9Ease per window. { from: Map<event,{cx,cy,sq}>, start,
// dir: "on"|"off" } — null when done.
let p7GridMorph = null;
// ---- The morph's choreography (`manual/`-tuned, harness deleted 2026-09-08) ----
// The flight has TWO channels — the square's centre and its size — each with
// its own {start, len} window in MILLISECONDS on one wall clock. Every window
// is eased FRESH with p9Ease off the raw clock (the house rule: never ease an
// already-eased slice). ON: the flight runs first, then the sizes grow in tier
// waves, biggest crowd first, each tier P7_MORPH_TIER_STAGGER_MS after the one
// before. OFF (scrolling back up) is the exact MIRROR of that clock: what grew
// last shrinks first, and the flight home comes at the end.
let P7_MORPH_FLY_MS          = 1400;   // the flight
let P7_MORPH_SIZE_MS         = 450;   // one tier's grow
let P7_MORPH_SIZE_START_MS   = 1200;   // when the first tier starts growing (= FLY: strictly after)
let P7_MORPH_TIER_STAGGER_MS = 140;   // tier-to-tier delay, biggest first
// Squares that finish growing before they have flown would sit on their
// neighbours; see the throttle in p7MorphBlend.
let P7_MORPH_PUSH = true;
let P7_MORPH_PUSH_MAX = 2;   // how far a dot may outgrow its current spacing
// @fold11's flatten is a DIFFERENT move on the same machinery and gets its OWN
// clock — the four above belong to @fold10's grow only. The late size start up
// there buys the dots room before they inflate (see P7_MORPH_PUSH_MAX); the
// flatten only ever shrinks, so it can never collide and has no reason to wait.
// Tune the two folds separately — one shared value always spoils one of them.
let P7_FLAT_FLY_MS           = 1400;
let P7_FLAT_SIZE_MS          = 450;
let P7_FLAT_SIZE_START_MS    = 0;    // the flatten only shrinks — nothing to wait for
let P7_FLAT_TIER_STAGGER_MS  = 50;
// Which set of four is live. `flat` defaults to the morph currently running
// (p7GridMorph.flat, set in p7SizeGridSet: true when only the flatten flag
// moved — @fold11 either way — false when the grid itself came on or off).
function p7MorphKnobs(flat) {
  const f = flat === undefined ? !!(p7GridMorph && p7GridMorph.flat) : !!flat;
  return f
    ? { fly: P7_FLAT_FLY_MS,  size: P7_FLAT_SIZE_MS,  start: P7_FLAT_SIZE_START_MS,  stag: P7_FLAT_TIER_STAGGER_MS }
    : { fly: P7_MORPH_FLY_MS, size: P7_MORPH_SIZE_MS, start: P7_MORPH_SIZE_START_MS, stag: P7_MORPH_TIER_STAGGER_MS };
}
function p7MorphTotalMs(flat) {
  const k = p7MorphKnobs(flat);
  return Math.max(k.fly, k.start + P7_MAX_TIER * k.stag + k.size);
}
// The two windows for one tier, in ms, on the ON clock.
//
// The stagger runs in OPPOSITE directions for the two folds, and it has to.
// @fold10's grow leads with the top tier ((P7_MAX_TIER - tier) * stag), which
// is fine there because the dots are also travelling — pos runs [0, fly], so
// the screen is moving from frame 0 regardless of which tier is mid-swell.
// @fold11's flatten has NO position beat (nothing travels — it's a draw-time
// flatten in place), so size is the only thing on screen, and the crowd is
// almost entirely tier 0. Leading with the top tier meant tier 0 started at
// P7_MAX_TIER * stag — 700ms of a completely frozen field after the crossing,
// which reads as the trigger being broken. The flatten leads with tier 0
// instead: the field starts collapsing on the first frame and the handful of
// big dots trail it.
function p7MorphWindows(tier, flat) {
  const k = p7MorphKnobs(flat);
  const f = flat === undefined ? !!(p7GridMorph && p7GridMorph.flat) : !!flat;
  const step = f ? tier : (P7_MAX_TIER - tier);
  return {
    pos:  [0, k.fly],
    size: [k.start + step * k.stag, k.size],
  };
}
function p7GridMorphMs() {
  return p7GridMorph ? Math.min(p7MorphTotalMs(), performance.now() - p7GridMorph.start) : p7MorphTotalMs();
}
function p7MorphWin(ms, w) {
  return p9Ease(Math.min(1, Math.max(0, (ms - w[0]) / Math.max(1, w[1]))));
}
// Blend one square from `from` to its rest cell under the current plan.
// Returns { cx, cy, sq }.
function p7MorphBlend(ev, from, cx, cy, sq, isLeft) {
  const ms = p7GridMorphMs();
  const w = p7MorphWindows(p7BulgeTier(ev));
  // Turning OFF plays the same clock backwards: a window [s, len] on the ON
  // clock is [T − s − len, len] on the OFF clock, so what grew last shrinks
  // first and the flight home comes at the end.
  if (p7GridMorph && p7GridMorph.dir === "off") {
    const T = p7MorphTotalMs();
    w.pos  = [T - w.pos[0]  - w.pos[1],  w.pos[1]];
    w.size = [T - w.size[0] - w.size[1], w.size[1]];
  }
  const tPos = p7MorphWin(ms, w.pos), tSize = p7MorphWin(ms, w.size);
  let outSq = from.sq + (sq - from.sq) * tSize;
  const outX = from.cx + (cx - from.cx) * tPos;
  const outY = from.cy + (cy - from.cy) * tPos;
  // "Grow into the room you have." Both packings are gap-exact, so a shared
  // clock can never collide; the moment size leads position, dots at timeline
  // spacing wearing grid sizes overlap badly. Spreading them apart to make room
  // is not an option — the timeline box is already full, so any spread throws
  // the outermost dots off screen. Instead the growth itself is throttled to
  // P7_MORPH_PUSH_MAX x the size the dot would have at its CURRENT position,
  // so a square only outgrows its neighbours by a bounded factor and catches up
  // to its full tier size as it flies. Nothing leaves the box.
  if (P7_MORPH_PUSH && tSize > tPos) {
    const posSq = from.sq + (sq - from.sq) * tPos;
    outSq = Math.min(outSq, posSq * P7_MORPH_PUSH_MAX);
  }
  return { cx: outX, cy: outY, sq: outSq };
}
// `opts.uniform` picks WHICH grid: the tiered crowd-size one (@fold10) or the
// flat one-cell-each one (@fold11). Omit it to keep whichever is current.
// Changing it while the grid is already up is a real morph too — the dots
// re-pack in place, they don't visit the timeline in between.
function p7SizeGridSet(on, opts) {
  on = !!on;
  const uniform = opts && "uniform" in opts ? !!opts.uniform : p7GridUniform;
  if (on === p7Grid.on && uniform === p7GridUniform) return;
  const instant = opts && opts.instant;
  const from = new Map();
  // 10 (@fold11) is in the range because that fold's size-down runs on page8's
  // slot, and without this the morph would have no `from` map and every square
  // would snap instead of shrinking.
  if (!instant && p7.vert && currentPage >= 8 && currentPage <= 10) {
    // posMap entries carry their own drawn size (sq) — blended mid-morph.
    for (const [ev, pos] of p7.lastPositions) {
      const sq = pos.sq ?? p7.SQ;
      from.set(ev, { cx: pos.x + sq / 2, cy: pos.y + sq / 2, sq });
    }
  }
  const wasOn = p7Grid.on;
  const sameGrid = on && wasOn;   // only the flatten flag moved
  p7Grid.on = on;
  p7GridUniform = uniform;
  if (!sameGrid) {
    p7Grid.layout = null;   // repacked from whatever is on screen at this press
    p7Grid.packVis = null;  // back to the on-screen gate — the filter's own pre-claim is stale
  }
  p7GridMorph = (!instant && from.size) ? { from, start: performance.now(), dir: (on || !wasOn) ? "on" : "off", flat: sameGrid } : null;
  p7BulgeT.clear();
  // Drop any open tooltip through the hover layer, not by hand: clearing
  // p7.hoveredEvent directly leaves the tooltip element's .is-visible class on
  // (hideSquare early-returns once nothing is hovered), so the box hung over
  // the flying dots for the whole morph. doHitTest bails on p7GridMorph and
  // hides properly; the direct clear stays as the mobile/no-hover fallback.
  if (typeof p7RecheckHover === "function") p7RecheckHover();
  p7.hoveredEvent = null;
  if (typeof draw === "function") draw();
  if (typeof p7StartAnimLoop === "function") p7StartAnimLoop();
}
// An event's grid cell honouring a morph still in flight (p7GridMorph): the
// square's blended centre + size right now, not where it will come to rest.
// page8's glide starts from THIS, so @fold11's two beats can overlap — the
// re-pack keeps playing underneath the flight instead of snapping to the
// flattened rest cell the instant drawPage8 takes over the canvas.
function p7GridLiveRect(ev, isLeft) {
  if (!p7Grid.on || !p7Grid.layout) return null;
  const g = p7GridCell(ev, isLeft);
  if (!g) return null;
  if (p7GridMorph && p7GridMorph.from) {
    const from = p7GridMorph.from.get(ev);
    if (from) {
      const b = p7MorphBlend(ev, from, g.cx, g.cy, g.sq, isLeft);
      return { x: b.cx - b.sq / 2, y: b.cy - b.sq / 2, sq: b.sq };
    }
  }
  return { x: g.cx - g.sq / 2, y: g.cy - g.sq / 2, sq: g.sq };
}

// The grid's ON/OFF is owned by @fold10's title card crossing mid-screen
// (`checkFold10Grid`, js/groups.js — the house 0.5, same as every other fold),
// not by this page hook. setActivePage (js/nav.js) calls this only to keep the
// grid consistent where that watcher can't speak:
//   • mobile — never on;
//   • @fold9/@fold10/@fold11/@fold12 — re-sync to where the cards actually
//     are, for re-entry from below (scrolling up, they never cross the line
//     again, so the watchers stay silent). The grid is on only in the band
//     BETWEEN @fold10's card and @fold11's: past @fold11 the squares are
//     uniform again and the «הצגת גודל האירועים» button is what turns it back on,
//     so this hook must not fight the button — it only ever runs on a section
//     crossing, never while the reader sits still inside one;
//   • anything past @fold12 — off, instantly.
// @fold12 (#page-11) deliberately KEEPS it on: its bridge glide flies the dots
// down out of the grid, shrinking them to page9's legit size on the way
// (p7GridLiveRect is that glide's start — see page8.js), so the reader never
// sees them snap back onto the timeline in between.
function p7SizeGridOnPage(page) {
  // The filter is SET on @fold9 but LIVES from there on — every fold after the
  // timeline keeps the filtered groups out (@fold10's size grid packs from what
  // is drawn, so it inherits it for free; page8/page9 skip the hidden events
  // themselves). Only scrolling back ABOVE the timeline clears it, since the
  // legend rows stop being clickable there and a filter with no way to undo it
  // is a trap.
  if (page < 9) p7FilterReset();
  // NOT skipped on mobile. This used to force the grid OFF here on every page
  // flip, back when the size grid was desktop-only. It isn't any more —
  // checkFold10Grid/checkFold11Size fire on a phone too — so that blanket off
  // fought its own triggers: the flip into @fold11 (and again into @fold12)
  // snapped the whole field home to the timeline a moment before the fold's
  // own beat flattened it. Mobile takes the same re-sync as desktop below.
  // @fold11's reverse is TWO beats — glide home, then grow the tiers back — and
  // the flip back to @fold10 lands ~0ms into the first one. Re-syncing here
  // would set the end state of both beats INSTANTLY, under a field that is
  // still flying: the squares snapped to their tiered rest cells mid-glide and
  // the whole thing read as the field snapping back to the timeline. While a
  // beat is still pending, fold11SizeApply owns the flags — stand down; it
  // finishes the sequence on its own clock and the next flip re-syncs.
  if (typeof fold11SizeBeatPending === "function" && fold11SizeBeatPending()) return;
  if (page >= 9 && page <= 12) {
    const past10  = typeof fold10GridPast === "function" && fold10GridPast();
    const past11 = typeof fold11SizePast === "function" && fold11SizePast();
    p7SizeGridSet(past10, { instant: true, uniform: past11 });
  } else p7SizeGridSet(false, { instant: true });
  // @fold13's own tier morph (page9.js) is per-fold: a page flip resets the
  // flag above, so page9's cached pack and in-flight morph go with it.
  if (typeof p9ScopeSync === "function") p9ScopeSync();
}

// ---------------------------------------------------------------------------
// LEGEND FILTER (@fold9, the real pinned timeline)
// Clicking a group's row in the mini-legend takes that group OUT of the graph:
// its dots shrink to nothing where they stand, and every surviving dot flies to
// the cell it would have had if that group had never been in the data — the
// same packing (p7BuildVerticalLayout), just handed a `visible` predicate, so
// the survivors close the gaps instead of leaving holes. Click again to bring
// it back. Desktop only, and only while @fold9 is the live page: the size grid
// packs lazily from what is drawn, so a filter left on would print holes in it.
//
// The UNFILTERED layout stays authoritative for VISIBILITY — which rows have
// been reached is a scroll fact, not a filter fact — the filtered layout is
// read for destinations only.
const p7FilterOff = new Set();   // actor keys currently hidden
let p7FilterLayout = null;       // {leftPos, rightPos} or null when nothing is filtered
let p7FilterMorph  = null;       // {from: Map(ev -> {cx,cy,sq}), start, restoring}
// Where each shrunk-away dot collapsed. It is deliberately NOT in
// p7.lastPositions (that map is the hover hit-test's scan list), but a restore
// still has to grow it back FROM somewhere — without this the returning dots
// have no `from` entry and snap straight to full size at their new cell.
const p7FilterGhosts = new Map();
// Two windows, in sequence: the filtered-out dots SHRINK away first, and only
// once the space is empty do the survivors FLY into it — the gap is seen being
// vacated before it is closed. Removing a group runs shrink→fly; bringing one
// back runs the same clock in the other order (fly→grow), so the returning dots
// arrive at a spot that has already been opened for them.
const P7_FILTER_SHRINK_MS = 380;
const P7_FILTER_FLY_MS = 900;
const P7_FILTER_MORPH_MS = P7_FILTER_SHRINK_MS + P7_FILTER_FLY_MS;
// Size channel and position channel, run back to back. Each channel keeps its
// OWN duration wherever it lands in the order — a size change is a short beat
// and a flight is a long one, so swapping the order must not also swap the
// tempos: a grow stretched over the flight's 900ms reads as a slow, detached
// pop rather than a square appearing.
function p7FilterChannels() {
  if (!p7FilterMorph) return { size: 1, pos: 1 };
  const e = performance.now() - p7FilterMorph.start;
  const win = (start, len) => p9Ease(Math.min(1, Math.max(0, (e - start) / len)));
  // Nothing on this camp has to CLOSE RANKS (see p7FilterSoloOnSide): the flight
  // is a no-op, so charging its 900ms is dead time the user just waits through.
  // Collapse the two beats onto one short window instead of dropping the
  // position channel — a dot's own destination can still differ from where it
  // stands (the filtered layout re-indexes it), and position never snaps.
  if (p7FilterMorph.skipFly) {
    const t = win(0, P7_FILTER_SHRINK_MS);
    return { pos: t, size: t };
  }
  return p7FilterMorph.restoring
    // Bringing a group back: the space opens first, then the dots grow into it.
    ? { pos: win(0, P7_FILTER_FLY_MS), size: win(P7_FILTER_FLY_MS, P7_FILTER_SHRINK_MS) }
    // Filtering out: the dots shrink away first, then the gap closes.
    : { size: win(0, P7_FILTER_SHRINK_MS), pos: win(P7_FILTER_SHRINK_MS, P7_FILTER_FLY_MS) };
}
function p7FilterActive()      { return p7FilterOff.size > 0; }
function p7FilterHiddenEv(ev)  { return p7FilterOff.has(ev.actor); }
// How big a dot should be RIGHT NOW as a fraction of its normal size, purely
// because of the filter — 1 normally, 0 once hidden, and the shrink/grow ramp in
// between. page7's own draw loop blends size itself (it has a full from/to
// snapshot); this is for the folds after it, which only need the scalar.
// Only the group that was just toggled is ever in flight: every other hidden
// group is already at rest at 0.
function p7FilterSizeFactor(ev) {
  const hidden = p7FilterActive() && p7FilterHiddenEv(ev);
  if (!p7FilterMorphActive() || p7FilterMorph.actor !== ev.actor) return hidden ? 0 : 1;
  const t = p7FilterChannels().size;
  return p7FilterMorph.restoring ? t : 1 - t;
}
function p7FilterMorphDur(m) {
  return m && m.skipFly ? P7_FILTER_SHRINK_MS : P7_FILTER_MORPH_MS;
}
function p7FilterMorphActive() {
  return !!p7FilterMorph && performance.now() - p7FilterMorph.start < p7FilterMorphDur(p7FilterMorph);
}
// Repacked from scratch on every toggle and on every layout rebuild (a resize
// changes rows/cols, so a stale filtered layout would point at other cells).
function p7FilterRebuild() {
  p7FilterLayout = (p7.ready && p7.vert && p7FilterActive())
    // cellBase, not CELL: this re-packs the grid when a group is filtered out,
    // and a solve must never see the zoom-out's scale or the repack would land
    // on different cells depending on how far the beat had run.
    ? p7BuildVerticalLayout(p7.rows, p7.cols, p7.cellBase, (ev) => !p7FilterHiddenEv(ev))
    : null;
}
// Snapshot where everything is RIGHT NOW (p7.lastPositions carries each
// square's drawn size), then re-pack and blend from it — the same "morph from
// wherever it was when you pressed" contract p7SizeGridSet uses, so a second
// click mid-flight is caught cleanly instead of snapping.
// Which camp a group belongs to, read off the split page7 already has
// (p7.leftEvents / p7.rightEvents, derived from ACTOR_SIDE server-side).
function p7FilterSideOf(actor) {
  return (p7.leftEvents || []).some(e => e.actor === actor) ? "left" : "right";
}
// Is `actor` the only VISIBLE group of its camp — i.e. does the camp hold no
// other dot that could close ranks or open a space? Counted off p7FilterOff as
// it stands after the toggle, ignoring `actor` itself, so it answers the same
// question in both directions: hiding the last visible group, or bringing the
// first one back into an empty camp.
function p7FilterSoloOnSide(actor) {
  const evs = p7FilterSideOf(actor) === "left" ? p7.leftEvents : p7.rightEvents;
  return !(evs || []).some(e => e.actor !== actor && !p7FilterOff.has(e.actor));
}
function p7FilterCommit(restoring, actor) {
  // @fold13 snapshots at the same moment, and for the same reason — see
  // p9FilterSnapshot (page9.js).
  if (typeof p9FilterSnapshot === "function") p9FilterSnapshot();
  const from = new Map();
  for (const [ev, g] of p7FilterGhosts) from.set(ev, { cx: g.cx, cy: g.cy, sq: g.sq });
  for (const [ev, pos] of p7.lastPositions) {
    const sq = pos.sq ?? p7.SQ;
    from.set(ev, { cx: pos.x + sq / 2, cy: pos.y + sq / 2, sq });
  }
  p7FilterRebuild();
  // With the size grid on (@fold10) the destination comes from p7GridCell, not
  // from the timeline layout — so the grid has to repack over the new survivor
  // set. Only the toggled group's OWN camp is cleared: nulling the whole layout
  // rebuilt both, and the lazy pack is arrival-ordered, so the untouched camp
  // came out in different cells and visibly reshuffled for no reason. The
  // snapshot above is what the dots then fly from, so this stays continuous.
  if (p7Grid.on) {
    p7Grid.packVis = new Set(p7GridRoster());
    p7GridClearSide(p7FilterSideOf(actor));
  }
  p7FilterMorph = from.size
    ? { from, start: performance.now(), restoring: !!restoring, actor, skipFly: p7FilterSoloOnSide(actor) }
    : null;
  p7BulgeT.clear();
  p7.hoveredEvent = null;
  if (typeof draw === "function") draw();
  if (typeof p7StartAnimLoop === "function") p7StartAnimLoop();
}
function p7FilterToggle(actor) {
  // No longer desktop-only. The מקרא panel's group rows are the mobile filter
  // buttons (fold6MLegendRowTap, js/groups.js), so a phone reaches this the
  // same way a click on a mini-legend row does. Everything downstream — the
  // shrink, the re-pack, the fly, the @fold10 grid repack — was already
  // breakpoint-agnostic; only the entry point was closed.
  // `p7.vert` still gates it: without the vertical layout there is nothing to
  // re-pack.
  if (!p7.vert) return;
  const restoring = p7FilterOff.has(actor);
  if (restoring) p7FilterOff.delete(actor);
  else p7FilterOff.add(actor);
  p7FilterCommit(restoring, actor);
}
// Leaving @fold9 drops the filter instantly — no morph, nothing to watch.
function p7FilterReset() {
  if (!p7FilterOff.size) return;
  p7FilterOff.clear();
  p7FilterLayout = null;
  p7FilterMorph  = null;
  p7FilterGhosts.clear();
  p7Grid.packVis = null;
  if (typeof draw === "function") draw();
}

function p7DrawSideSquares(ctx, events, positions, x0, topY, cols, CELL, SQ, monthEnd, settledCount, posMap) {
  const bulges = p7BulgeList(posMap, positions, events, cols, x0, topY, CELL, SQ);
  // Hoisted: both read isMobile(), which reads window.innerWidth — a
  // layout-flushing read. Called per dot in the loop below they ran ~4.4k times
  // per frame on a phone and dominated the draw. Per breakpoint, not per square.
  const animMs = p7AnimTotalMs(), popMs = p7PopMs();
  const stagger = Math.max(0, animMs - popMs);
  let groupMonthKey = null, groupStart = 0, groupEnd = 0;
  let groupCursor = animMs; // months with no phase at all read as settled
  // Desktop: per-event rank within its row + per-row counts (p7BuildVerticalLayout).
  const vertSide = p7.vert ? (positions === p7.rightPos ? p7.vert.right : p7.vert.left) : null;
  const rowRank  = vertSide ? vertSide.rowRank  : null;
  const rowCount = vertSide ? vertSide.rowCount : null;
  const claimedEvents = p7GetClaimedEvents();
  const gridOn = p7Grid.on;
  const isLeft = positions !== p7.rightPos;
  // Destinations only — see the LEGEND FILTER section above.
  const filtSide = p7FilterLayout ? (isLeft ? p7FilterLayout.leftPos : p7FilterLayout.rightPos) : null;
  // The end-of-fill zoom-out's vertical squash (1 while the beat is idle).
  const yScale  = p7ZoomOutYScale();
  // Mobile squares are ~1.25–3 CSS px (p7SolveMobileSq) sitting at fractional
  // positions, so on a DPR>1 phone every edge lands mid-device-pixel and the
  // canvas antialiases it into a band of partial-alpha pixels. The loupe is a
  // nearest-neighbour 4x blit of this canvas (drawLoupe below), so that band
  // magnifies into a pale ring and the dots read as if they were stroked.
  // Snapping the rect onto the device-pixel grid leaves nothing to antialias —
  // in the glass and in the un-magnified grid alike. Hoisted out of the loop
  // because this runs over every event, every frame.
  //
  // Desktop snaps too: the squares are small enough that on a display whose
  // DPR isn't a whole number (a scaled external monitor at 1.25x/1.5x) every
  // fractional edge bleeds into the neighbouring device pixel at partial alpha
  // and the whole timeline reads soft — next to the same page on a 1x/2x
  // screen, where the coordinates happen to land clean, the difference is
  // obvious.
  const snapPx = true;
  const isMob  = isMobile();   // hoisted: innerWidth read, was running per dot
  // actor -> colour, built ONCE per call instead of a GROUPS.find() per dot
  // (a linear scan over the roster, 14k+ times a frame). Rebuilt every call
  // rather than cached across frames, so a live GROUPS colour edit still takes
  // effect on the very next frame — p7ActorColor's contract is preserved.
  const colorOf = new Map();
  for (let gi = 0; gi < GROUPS.length; gi++) colorOf.set(GROUPS[gi].actor, GROUPS[gi].color || '#888');
  // Canvas re-parses the colour string on every fillStyle assignment, so skip
  // the ones that don't change anything. Dots are drawn in row order and only
  // ever carry one of six colours, so this collapses almost all of them.
  let lastFill = null, lastAlpha = -1;
  // Row cursor memo. Every dot in a row shares one cursor, but this was being
  // recomputed (with its own performance.now()) per dot — 13.4% + 4.5% of the
  // draw. One timestamp and one value per ROW instead of per square.
  // Opaque squares are accumulated into one Path2D per colour and filled in a
  // single call: 14k+ individual fillRect()s were ~48% of the draw. The batch is
  // FLUSHED whenever the colour changes or a translucent square comes up, so the
  // painting order is byte-for-byte the order it was before. Only alpha-1
  // squares are batched — at full opacity a merged path and separate rects are
  // identical even where they overlap, which is not true below 1.
  let batch = null, batchFill = null;
  const flush = () => {
    if (!batch) return;
    if (lastAlpha !== 1) { ctx.globalAlpha = 1; lastAlpha = 1; }
    if (lastFill !== batchFill) { ctx.fillStyle = batchFill; lastFill = batchFill; }
    ctx.fill(batch);
    batch = null; batchFill = null;
  };
  const rowNow = performance.now(), rowCur = new Map();
  // Vertical cull band. With the mobile camera (P7_VERT.zoom > 1) the field is
  // several box-heights tall and most of it is off screen behind
  // p7VertClipToBox — but every square was still being measured into a path and
  // handed to the rasteriser. Only the PAINT is skipped: posMap, the filter
  // ghosts and every other bit of bookkeeping below still run for culled
  // squares, so hit-testing and page8's glide (which read p7.lastPositions for
  // events that are nowhere near the viewport) are unaffected.
  const cullTop = -8, cullBot = (typeof viewportH === 'function' ? viewportH() : window.innerHeight) + 8;
  const rowCursorOf = (r) => {
    if (rowCur.has(r)) return rowCur.get(r);
    const v = p7RowCursorAt(r, rowNow); rowCur.set(r, v); return v;
  };
  const dpr    = window.devicePixelRatio || 1;
  const q      = v => Math.round(v * dpr) / dpr;

  for (let i = 0; i < monthEnd; i++) {
    const cell = positions[i];
    // `row` is the UNFILTERED row and stays that way: it is what gates
    // visibility (p7RowCursor) and drives the row cascade, both of which are
    // facts about the scroll, not about the filter.
    const row  = Math.floor(cell / cols);
    const evHidden = p7FilterActive() && p7FilterHiddenEv(events[i]);
    const destCell = (filtSide && !evHidden && filtSide[i] >= 0) ? filtSide[i] : cell;
    const col   = destCell % cols;
    const drow  = Math.floor(destCell / cols);
    let destX = x0 + col * CELL;
    let destY = topY + drow * CELL;
    // End-of-fill zoom-out: the row offset is compressed about the field's top
    // edge. x is deliberately untouched — see p7ZoomOutKY. Because this is the
    // same factor p7VertFieldLen applies to the axis, a dot stays beside its own
    // date all the way through the beat.
    if (yScale !== 1) destY = topY + (destY - topY) * yScale;
    // Mobile 'side' plaques (p7VertCardPush): dots in the rows a plaque covers
    // slide outward past it, following its fade, so it never hides a dot.
    for (let c = 0; c < p7VertCardPush.length; c++) {
      const pc = p7VertCardPush[c];
      if (pc.side === (isLeft ? 'left' : 'right') && destY + SQ > pc.top && destY < pc.bottom) destX += isLeft ? -pc.dx : pc.dx;
    }
    // Hover bulge: shoved aside by any swelling neighbour (p7BulgeShift), or —
    // for the swelling square itself — kept centred on its cell and grown.
    let bulgeSize = 0;
    if (bulges.length) {
      const own = bulges.find(b => b.ev === events[i]);
      if (own) bulgeSize = own.size;
      else { const sh = p7BulgeShift(bulges, col, drow); destX += sh.dx; destY += sh.dy; }
    }

    // Continuing page8's reverse glide into its resting timeline cell (see
    // p7EntryAnim's own comment above) — blended position only, layered
    // underneath this loop's existing scale/alpha cascade below, which is
    // otherwise untouched (squares never move once placed here outside of
    // this one entry blend).
    let drawX = destX, drawY = destY;
    if (p7EntryAnim) {
      const from = p7EntryAnim.from.get(events[i]);
      if (from) {
        const glideT = p9Ease(Math.min(1, Math.max(0, (performance.now() - p7EntryAnim.start) / p7EntryAnim.duration)));
        drawX = from.x + (destX - from.x) * glideT;
        drawY = from.y + (destY - from.y) * glideT;
      }
    }

    // Claimed events (FOLD6_SQUARE_ROW_IDS, js/groups.js) are never
    // drawn here at all — the fold-9 flying square *is* this dot, permanently,
    // not a stand-in for a separate real one. Still recorded in posMap (full
    // alpha, no animation) so downstream consumers that look up an event's
    // on-screen position (page8's grid blend, page9's drag-and-drop, fold13's
    // morph) still find one — just skips this loop's own drawing/stagger
    // bookkeeping for it.
    if (claimedEvents && claimedEvents.has(events[i])) {
      const g = gridOn ? p7GridCell(events[i], isLeft) : null;
      posMap.set(events[i], g ? { x: g.cx - g.sq / 2, y: g.cy - g.sq / 2, alpha: 1, sq: g.sq } : { x: destX, y: destY, alpha: 1, sq: SQ });
      continue;
    }

    let scale = 1, alpha = 1;
    if (rowRank) {
      // Desktop row system (p7RowPhase): presence is a pure function of the
      // row's cursor; the slot is the square's rank within its row by distance
      // from the corridor, so each row plays centre → side.
      const rowCursor = rowCursorOf(row);
      if (rowCursor === undefined) continue;          // row never reached
      const n = rowCount[row];
      const delay = n > 1 ? (rowRank[i] / (n - 1)) * stagger : 0;
      const presence = p7Ease(Math.min(1, Math.max(0, (rowCursor - delay) / popMs)));
      if (presence <= 0) continue;
      scale = 0.5 + 0.5 * presence;
      alpha = presence;
    } else if (i >= settledCount) {
      const mk = p7MonthKeyOf(events[i].date);
      if (mk !== groupMonthKey) {
        groupMonthKey  = mk;
        groupStart     = i;
        groupEnd       = p7BisectBefore(events, p7MonthKeyToStartStr(mk + 1));
        // No phase at all = a month below the animated range, i.e. long settled.
        groupCursor    = p7MonthCursor(mk) ?? animMs;
      }

      const countInGroup = groupEnd - groupStart;
      const localIdx = i - groupStart;
      // Each square's own slot in the month's cascade. Because presence is read off
      // the shared cursor rather than off "time since the cascade started", a square
      // is wherever the cursor says — mid-grow, mid-shrink or settled — no matter how
      // many times the user reversed direction on the way here.
      const delay = countInGroup > 1 ? (localIdx / (countInGroup - 1)) * stagger : 0;
      const presence = p7Ease(Math.min(1, Math.max(0, (groupCursor - delay) / popMs)));
      if (presence <= 0) continue; // not popped in yet, or fully retreated
      // Nothing pops from nothing: start at a visible (if small) size rather than 0.
      scale = 0.5 + 0.5 * presence;
      alpha = presence;
    }

    // Rest position/size: the timeline cell, or — size grid ON (p7Grid) — the
    // packed cell at the tier's block size, claimed HERE, past the visibility
    // gate, so only squares that are really drawn take up a cell. The toggle's
    // morph (p7GridMorph) blends centre and size from wherever the square was
    // when it fired.
    let restSize = evHidden ? 0 : SQ;   // filtered out: shrink away in place
    let cx = drawX + SQ / 2, cy = drawY + SQ / 2;
    const baseCx = cx, baseCy = cy;   // the timeline cell, before any grid override
    // …but a filtered-out dot never claims a grid cell and never takes the
    // tier size — otherwise the grid would hand restSize back to it and undo
    // the shrink (@fold10/@fold12).
    if (gridOn && !evHidden) {
      const g = p7GridCell(events[i], isLeft);
      if (g) { cx = g.cx; cy = g.cy; restSize = g.sq; }
    }
    if (p7GridMorph && !evHidden) {
      // A square that had not popped in yet when the morph fired has NO
      // snapshot: it was never drawn, so p7.lastPositions never held it. With
      // no `from` it used to land straight on its grid cell the frame its pop
      // cursor reached it — a snap, mid-flight, while every neighbour was still
      // travelling. Fall back to the timeline cell it would have stood in, at
      // zero size, so it grows out of its own place on the timeline and flies
      // the same path as the rest.
      const from = p7GridMorph.from.get(events[i]) || { cx: baseCx, cy: baseCy, sq: 0 };
      const b = p7MorphBlend(events[i], from, cx, cy, restSize, isLeft);
      cx = b.cx; cy = b.cy; restSize = b.sq;
    }
    // A filtered-out dot shrinks away IN PLACE, so its destination is where it
    // already stands — not the base cell `destCell` fell back to. Reading that
    // cell sent it flying home on the way out (any dot that had since moved: the
    // size grid, or an earlier group filtered out from under it). Harmless while
    // the position beat ran after the shrink had finished; visible now that the
    // solo case runs the two concurrently. Same rule as the claimed DOM squares
    // (p7TargetForActorOccurrence).
    if (evHidden && p7FilterMorph) {
      const parked = p7FilterMorph.from.get(events[i]);
      if (parked) { cx = parked.cx; cy = parked.cy; }
    }
    // The toggled group's OWN dots never travel: they leave and arrive by size
    // alone, at the cell fixed above (where it stands, on the way out; where it
    // belongs, on the way in). Blending their centre made a restore fly the dot
    // in from the spot it was hidden at — visible in the solo case, where the
    // position beat runs alongside the grow instead of behind it. The rest of
    // the camp still flies, closing ranks or opening the space.
    const evToggled = p7FilterMorph && events[i].actor === p7FilterMorph.actor;

    // The filter's own flight: one shared window for centre and size, blended
    // from the snapshot taken at the click. Applied last so it wins over a
    // grid morph that happens to still be running.
    if (p7FilterMorph) {
      const from = p7FilterMorph.from.get(events[i]);
      if (from) {
        const ch = p7FilterChannels();
        const pt = evToggled ? 1 : ch.pos;
        cx = from.cx + (cx - from.cx) * pt;
        cy = from.cy + (cy - from.cy) * pt;
        restSize = from.sq + (restSize - from.sq) * ch.size;
      }
    }

    // Shrunk past the point of being a dot — nothing left to paint, and it
    // stays OUT of posMap: p7.lastPositions is what the hover hit-test scans,
    // so a filtered-out dot must not be there or it still answers the tooltip
    // from a zero-size square.
    if (restSize < 0.15) { p7FilterGhosts.set(events[i], { cx, cy, sq: restSize }); continue; }
    p7FilterGhosts.delete(events[i]);
    posMap.set(events[i], { x: cx - restSize / 2, y: cy - restSize / 2, alpha, sq: restSize });

    // While one square is hovered (p7.hoveredEvent, set by p7HoverInit — see
    // below), it's drawn fully opaque and every other square is dimmed, so it
    // reads as isolated against the grid — same convention as page9.js's
    // p9PlaceDot.
    let drawAlpha = alpha;
    if (p7.hoverDimT > 0) {
      const t = p7.hoverDimT;
      drawAlpha = events[i] === p7.hoveredEvent
        ? alpha + (1 - alpha) * t
        : alpha * (1 - (1 - hoverDim(events[i].actor)) * t);
    }

    const size = (bulgeSize || restSize) * scale;
    drawX = cx - size / 2; drawY = cy - size / 2;   // shrink/grow stays centred
    const off  = 0;
    const fill = colorOf.get(events[i].actor) || '#888';
    // The 1/dpr floor is a guard, not a routine path: the smallest real square
    // is scale 0.5 on sq 1.25, still ~2 device px.
    // Desktop snaps only once a square is SETTLED. Mid-pop, quantising the
    // grow to whole device pixels turns the smooth scale ramp into two or
    // three visible steps and the cascade reads as stuttering — worse than the
    // softness it fixes. Mobile still snaps throughout: the loupe magnifies
    // any fractional edge into a pale ring, which is the louder artifact there.
    const snap = snapPx && (scale === 1 || isMob);
    const rx = snap ? q(drawX + off) : drawX + off;
    const ry = snap ? q(drawY + off) : drawY + off;
    const rw = snap ? Math.max(1 / dpr, q(size)) : size;
    const rh = snap ? Math.max(1 / dpr, q(size)) : size;
    if (ry + rh < cullTop || ry > cullBot) continue;   // off screen — nothing to paint
    if (drawAlpha >= 1) {
      // Fully opaque squares are BATCHED — see the flush() note above.
      if (fill !== batchFill) { flush(); batch = new Path2D(); batchFill = fill; }
      batch.rect(rx, ry, rw, rh);
    } else {
      // Anything mid-fade is drawn on its own, in order, so a translucent
      // square never gets reordered past an opaque one behind it.
      flush();
      if (drawAlpha !== lastAlpha) { ctx.globalAlpha = drawAlpha; lastAlpha = drawAlpha; }
      if (fill !== lastFill) { ctx.fillStyle = fill; lastFill = fill; }
      ctx.fillRect(rx, ry, rw, rh);
    }
  }
  flush();
  ctx.globalAlpha = 1;
}

async function initPage7() {
  try {
    const res  = await fetch("events.json");
    const data = await res.json();
    data.sort((a, b) => a.date.localeCompare(b.date));

    p7.leftEvents  = data.filter(e => e.side === "left");
    p7.rightEvents = data.filter(e => e.side === "right");
    p7.minDate     = data[0].date;
    p7.maxDate     = data[data.length - 1].date;
    p7.currentDate = p7.minDate;
    p7.ready       = true;
    p7BuildDataSummary(data);
  } catch (err) {
    console.error("Failed to load events:", err);
  }
}

// Text alternative for <canvas> — see the #canvasA11ySummary comment in
// project.html. The scrolling <h2> cards are already real DOM, so a screen
// reader gets the argument of the piece for free; what it can't get is
// anything the canvas draws. That's what this supplies: who the six groups
// are and which camp each sits in, how many documented actions each has, the
// date range, and the category breakdown.
//
// Derived from the events array, never hardcoded: the xlsx is regenerated on
// every server start (load_events, server.py), so any figure written by hand
// here would silently go stale the next time the data changes.
function p7BuildDataSummary(data) {
  const host = document.getElementById("canvasA11ySummary");
  if (!host || typeof GROUPS === "undefined") return;

  const he = (n) => n.toLocaleString("he-IL");
  // events.json stores YYYY-MM-DD; the rest of the page shows DD-MM-YYYY.
  const date = (iso) => iso.split("-").reverse().join("-");

  const byActor    = new Map();
  const byCategory = new Map();
  for (const e of data) {
    byActor.set(e.actor, (byActor.get(e.actor) || 0) + 1);
    byCategory.set(e.category, (byCategory.get(e.category) || 0) + 1);
  }

  // FOLD4_COALITION_ROWS/FOLD4_CHANGE_ROWS are the same camp split the legend
  // renders, so the spoken roster and the drawn one can't disagree.
  const camps = [
    { name: "מחנה הימין",  rows: FOLD4_COALITION_ROWS, side: "right" },
    { name: "גוש השינוי", rows: FOLD4_CHANGE_ROWS,    side: "left"  },
  ];

  const campList = camps.map(c => {
    const total = data.filter(e => e.side === c.side).length;
    const items = c.rows.map(g =>
      `<li>${g.label}: ${he(byActor.get(g.actor) || 0)} פעולות מתועדות</li>`).join("");
    return `<h3>${c.name} — ${he(total)} פעולות מתועדות</h3><ul>${items}</ul>`;
  }).join("");

  const catList = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cat, n]) => `<li>${cat}: ${he(n)}</li>`)
    .join("");

  host.innerHTML =
    `<h2>תיאור מילולי של הנתונים</h2>` +
    `<p>הפרויקט מציג ${he(data.length)} פעולות פוליטיות מתועדות שהתרחשו במרחב הציבורי ` +
    `בישראל ובשטחים, בין ${date(p7.minDate)} ל־${date(p7.maxDate)}. ` +
    `הנתונים מגיעים מ־ACLED. כל ריבוע בהדמיה מייצג פעולה אחת, וצבעו מציין את הקבוצה שביצעה אותה.</p>` +
    `<h3>חלוקה למחנות ולקבוצות</h3>` + campList +
    `<h3>חלוקה לפי סוג הפעולה</h3><ul>${catList}</ul>`;
}

function p7UpdateLayout(W, H) {
  // The event count joins W/H in the guard because the mobile square size is
  // solved FROM it: the first layout runs before events.json has landed
  // (counts 0 → the floor size), and without this the solved size would stay
  // at that floor for the whole session on an unchanged viewport.
  const maxEvents = Math.max(p7.leftEvents.length, p7.rightEvents.length);
  // A call with no dimensions must never re-lay the page. The desktop branch
  // below nulls p7Grid.layout (the size grid is per-viewport), so a W/H-less
  // call would throw away the packed cells every dot is standing on and
  // re-solve the whole geometry from NaN. The one caller that can arrive
  // without them is p7TargetForActorOccurrence — the 8 claimed DOM squares'
  // target — so this guard is what keeps those 8 from wrecking the field.
  if (!Number.isFinite(W) || !Number.isFinite(H)) return;
  if (W === p7.lastW && H === p7.lastH && maxEvents === p7.lastMaxEvents && p7.lastVertical === p7VerticalAxis()) return;
  // Mobile: a height-only change is the URL/bottom bar sliding, not a new
  // viewport. Re-solving the square against the shorter/taller box would make
  // every dot visibly resize on each scroll that moves the bar, so the layout
  // solved for the first height stands until the width changes (rotation /
  // breakpoint) — same rule as the scroll geometry (vh, never dvh). The
  // camera in p7VertTopY still reads the live H, so the field re-centres.
  if (isMobile() && W === p7.lastW && p7.lastH && H !== p7.lastH && maxEvents === p7.lastMaxEvents && p7.lastVertical === p7VerticalAxis()) return;
  p7.lastVertical = p7VerticalAxis();
  p7.lastMaxEvents = maxEvents;

  const box    = sbbTimeline(H);
  const topY   = Math.round(H * box.top);
  const botY   = Math.round(H * box.bottom);
  // `zoom` (P7_VERT) lets the row plan be that many boxes tall: the square is
  // solved and the rows counted against the VIRTUAL height, and the camera in
  // p7VertTopY shows a box-sized window onto the result.
  const sideH  = (botY - topY) * (p7VerticalAxis() ? (p7V().zoom || 1) : 1);
  // Solved before any geometry is read: p7GridGeometry/p7Sq below go through
  // p7Cell(), which returns this. The box itself doesn't depend on the square
  // size, so there's no circularity — sideW is the same measurement
  // p7GridGeometry makes.
  if (!p7VerticalAxis()) {
    const sideW = W / 2 - CENTER_GAP / 2 - sbbTimelineLeftX(W, H);
    p7MobileSq = p7SolveMobileSq(sideW, sideH, maxEvents);
  } else {
    if (isMobile()) p7.mobileCorridorPx = p7SolveMobileCorridor(W, H);
    const sideW = W / 2 - p7CenterGap() / 2 - sbbTimelineLeftX(W, H);
    const sq = p7.ready ? p7SolveVerticalSq(sideW, sideH, maxEvents) : p7SqMax();
    if (isMobile()) p7MobileSq = sq; else p7DesktopSq = sq;
    p7Grid.layout = null;   // size grid (p7BuildSizeGrid) is per-viewport — rebuilt on demand
  }
  const { leftX0, cols, CELL } = p7GridGeometry(W, H);
  // The BASE geometry — p7.leftX0/CELL/SQ are getters that scale these by the
  // end-of-fill fitted layout (see p7Fit). p7GridGeometry solves against the
  // unscaled p7Cell(), which is what keeps `cols` fixed while the beat runs.
  p7.leftX0Base = leftX0;
  p7.cellBase = CELL;
  p7.sqBase   = p7Sq();
  p7.cols = cols;

  const rows  = Math.floor(sideH / CELL);
  p7.rows = rows;
  if (p7VerticalAxis() && p7.ready) {
    // Desktop: rows are dates (see VERTICAL AXIS above).
    const v = p7BuildVerticalLayout(rows, p7.cols, CELL);
    // Rows the box can't hold even at the solved size (0 when it fits) —
    // surfaced by a mobile harness's summary; the smallest phones hit it.
    v.overflowRows = Math.max(0, Math.ceil((v.totalRows * CELL + p7VertYearHeaderH() - sideH) / CELL));
    p7.vert     = v;
    p7.leftPos  = v.leftPos;
    p7.rightPos = v.rightPos;
  } else {
    p7.vert = null;
    const total = p7.cols * rows;
    p7.leftPos  = p7OrderFromCenter(total, p7.cols, 11111, "left",  p7.leftEvents.length);
    p7.rightPos = p7OrderFromCenter(total, p7.cols, 99999, "right", p7.rightEvents.length);
  }

  // p7ResolveActorOccurrenceCell's own cache (p7TargetCellCache) maps an
  // event to a *cell number* within p7.leftPos/p7.rightPos — meaningless on
  // its own, since the same cell number means a different row/col (or even
  // references a differently-sized grid entirely) once cols/rows/total
  // change here, e.g. on a resize or a different viewport at load time.
  // Clearing it whenever leftPos/rightPos are recomputed forces every
  // actor+occurrence lookup to re-resolve against the grid that's actually
  // current, instead of handing back a stale cell number sized for whatever
  // viewport was active the first time it was ever resolved.
  p7TargetCellCache.clear();
  // rows/cols/CELL just changed — a filtered layout built against the old grid
  // points at the wrong cells.
  if (typeof p7FilterRebuild === "function") p7FilterRebuild();

  p7.lastW = W;
  p7.lastH = H;
}

// Index (into `events`, chronologically sorted) of the nth (0-based)
// occurrence of `actor` — used below to find which real event a fold-9
// curated square (FOLD6_SQUARE_ROW_IDS, js/groups.js) should stand in for. A plain linear scan, not a
// precomputed per-actor index, because it only ever runs once per
// actor/occurrence pair (see p7TargetCellCache) rather than every frame.
function p7NthIndexOfActor(events, actor, n) {
  let seen = 0;
  for (let i = 0; i < events.length; i++) {
    if (events[i].actor === actor) {
      if (seen === n) return i;
      seen++;
    }
  }
  return -1;
}

// Caches the (expensive: scans up to several thousand events) actor+occurrence
// -> {side, cell} lookup below, keyed by "actor|n" — the lookup itself never
// changes once events.json is loaded, only the cell's on-screen pixel
// position does (as W/H change), so the frame-by-frame path
// (p7TargetForActorOccurrence, called every animation frame while fold 9's
// squares are flying out) only ever needs to redo the cheap pixel math.
const p7TargetCellCache = new Map();

function p7ResolveActorOccurrenceCell(actor, n) {
  const key = actor + "|" + n;
  if (p7TargetCellCache.has(key)) return p7TargetCellCache.get(key);

  let side = "left", idx = p7NthIndexOfActor(p7.leftEvents, actor, n);
  if (idx === -1) {
    side = "right";
    idx = p7NthIndexOfActor(p7.rightEvents, actor, n);
  }
  const positions = side === "left" ? p7.leftPos : p7.rightPos;
  const result = (idx === -1 || positions[idx] === undefined) ? null : { side, cell: positions[idx] };
  p7TargetCellCache.set(key, result);
  return result;
}

// Returns the top-left {x, y, size} (viewport-pixel space, same coordinate
// system every other page7 square uses) of the grid cell where the nth
// chronological event by `actor` will eventually settle, or null if there is
// no such event — used by the fold-9 squares fly-out (fold9FlyTrigger,
// js/groups.js) to send each
// curated square to the exact real dot it's standing in for, rather than
// just fading away in place.
function p7TargetForActorOccurrence(actor, n, W, H) {
  if (!p7.ready) return null;
  // Must run before resolving/caching below — p7.leftPos/rightPos (which the
  // resolve step reads to build its cached result) are empty until this has
  // run at least once, and a premature resolve would cache a false "no such
  // event" null forever.
  p7UpdateLayout(W, H);
  const resolved = p7ResolveActorOccurrenceCell(actor, n);
  if (!resolved) return null;

  const topY = p7VertTopY(H);
  const x0  = resolved.side === "left" ? p7.leftX0 : p7GridGeometry(W, H).rightX0;
  const col = resolved.cell % p7.cols;
  const row = Math.floor(resolved.cell / p7.cols);
  let cx = x0 + col * p7.CELL + p7.SQ / 2;
  let cy = topY + row * p7.CELL + p7.SQ / 2;
  let sq = p7.SQ;
  // @fold10's size grid. These 8 are DOM squares (js/update-groups.js), not
  // canvas dots — p7DrawSideSquares skips them (p7GetClaimedEvents) — so they
  // only move when this target moves. Without this they stayed parked on their
  // timeline cell while every other dot flew to its packed cell. Same packed
  // cell + same p7GridMorph blend the canvas path uses, so they fly with the
  // crowd rather than snapping when the toggle fires.
  const ev = p7EventForActorOccurrence(actor, n);
  const isLeft = resolved.side === "left";
  if (ev) {
    // The legend filter re-packs the survivors into a shorter grid, and these 8
    // are DOM squares that only move when this target moves — same reason the
    // size-grid block below exists. Without it a surviving claimed square stayed
    // parked on its unfiltered cell while every canvas dot around it closed
    // ranks, and a filtered-out one held its old cell (invisible, but still
    // reserving the spot a real dot was flying into). A hidden square keeps its
    // current cell, exactly as the canvas does — it shrinks away in place.
    const filtSide = p7FilterLayout ? (isLeft ? p7FilterLayout.leftPos : p7FilterLayout.rightPos) : null;
    // A hidden square shrinks in place, so its destination is where it already
    // STANDS — not the cell it would occupy in the unfiltered grid. Reading the
    // base cell instead sent it flying back to its original spot on the way out
    // (visible whenever it had since moved: the size grid, or an earlier group
    // already filtered out from under it).
    // Nothing below may move it either: a filtered-out dot never claims a grid
    // cell (same rule the canvas path states) and must not ride a grid morph.
    const parked = p7FilterHiddenEv(ev) && p7FilterMorph && p7FilterMorph.from.get(ev);
    if (parked) return { x: parked.cx - sq / 2, y: parked.cy - sq / 2, size: sq };
    if (filtSide) {
      const idx = (isLeft ? p7.leftEvents : p7.rightEvents).indexOf(ev);
      const destCell = idx >= 0 ? filtSide[idx] : -1;
      if (destCell >= 0) {
        cx = x0 + (destCell % p7.cols) * p7.CELL + p7.SQ / 2;
        cy = topY + Math.floor(destCell / p7.cols) * p7.CELL + p7.SQ / 2;
      }
    }
    if (p7Grid.on) {
      const g = p7GridCell(ev, isLeft);
      if (g) { cx = g.cx; cy = g.cy; sq = g.sq; }
    }
    if (p7GridMorph) {
      const from = p7GridMorph.from.get(ev);
      if (from) {
        const b = p7MorphBlend(ev, from, cx, cy, sq, isLeft);
        cx = b.cx; cy = b.cy; sq = b.sq;
      }
    }
    // The filter's own flight, applied last so it wins over a grid morph still
    // running. Position only: the size half of the filter is layoutFold6Squares'
    // `scaleT` (js/update-groups.js), which scales about the element's centre.
    // …but never for the toggled group's own square: like the canvas dots, it
    // arrives by size at the cell it belongs in, rather than flying in from
    // wherever it was parked while hidden.
    if (p7FilterMorph && p7FilterMorph.actor !== ev.actor) {
      const from = p7FilterMorph.from.get(ev);
      if (from) {
        const t = p7FilterChannels().pos;
        cx = from.cx + (cx - from.cx) * t;
        cy = from.cy + (cy - from.cy) * t;
      }
    }
  }
  return { x: cx - sq / 2, y: cy - sq / 2, size: sq };
}

// Returns the real event object (date/descHeMedium/actor/...) for the nth
// chronological event by `actor`, or null if there is no such event / data
// isn't loaded yet — same actor+occurrence join key as
// p7TargetForActorOccurrence above, but returns the event itself rather than
// its eventual on-screen cell, for the fold-8 square tooltip
// (js/fold8-tooltip.js — shows a
// real event's own date+description instead of a static label).
// CACHED, and unlike p7TargetCellCache this one is never cleared: it resolves to
// an EVENT OBJECT, which is pure data — it does not depend on cols/rows/viewport
// the way a cell number does, and event objects are stable references once
// events.json is loaded. (p7.ready gates population, so nothing is cached from
// before the load.)
//
// It has to be cached: this is called every frame while the fold-8 tooltip is
// up, and each miss is a linear scan over several thousand events. Uncached it
// ran 3216 times in a 40-step scroll and was ~7% of all CPU on a throttled
// phone — the profile entry read as p7NthIndexOfActor, whose own comment
// claimed it "only ever runs once per actor/occurrence pair". It didn't.
const p7EventForActorCache = new Map();
function p7EventForActorOccurrence(actor, n) {
  if (!p7.ready) return null;
  const key = actor + "|" + n;
  if (p7EventForActorCache.has(key)) return p7EventForActorCache.get(key);
  let out = null;
  let idx = p7NthIndexOfActor(p7.leftEvents, actor, n);
  if (idx !== -1) out = p7.leftEvents[idx];
  else {
    idx = p7NthIndexOfActor(p7.rightEvents, actor, n);
    if (idx !== -1) out = p7.rightEvents[idx];
  }
  p7EventForActorCache.set(key, out);
  return out;
}

// Inverse of p7NthIndexOfActor for one specific event, identified by the xlsx's
// own stable `rowId`: returns which occurrence (0-based) of its actor that event
// is, within its own side's date-sorted list — i.e. exactly the `n` the two
// lookups above expect. -1 if the data isn't loaded or no row carries that id.
// Lets the curated roster (FOLD6_SQUARE_ROW_IDS, js/groups.js) name events by id and
// have the fragile positional number derived at runtime, so editing the xlsx
// can't silently repoint it at a neighbouring event.
function p7OccurrenceOfRowId(rowId) {
  if (!p7.ready) return -1;
  for (const events of [p7.leftEvents, p7.rightEvents]) {
    const idx = events.findIndex(e => e.rowId === rowId);
    if (idx === -1) continue;
    let seen = 0;
    for (let i = 0; i < idx; i++) if (events[i].actor === events[idx].actor) seen++;
    return seen;
  }
  return -1;
}

// The 8 real events @fold12's fold-6 squares fly to/become (FOLD6_SQUARE_ROW_IDS/
// fold6SquareOccurrence, js/groups.js — referenced here only inside this function
// body, never at load time, since page7.js loads before js/groups.js in
// project.html) are never drawn by the real per-event cascade below — the
// flying DOM square *is* that dot permanently, not a stand-in that hands off
// to a separately-popping-in real one once it arrives. Resolved once
// (event objects are stable references once events.json is loaded) and
// cached, same pattern as p7TargetCellCache above.
let p7ClaimedEvents = null;
function p7GetClaimedEvents() {
  if (p7ClaimedEvents) return p7ClaimedEvents;
  if (!p7.ready || typeof FOLD6_SQUARE_ACTORS === "undefined") return null;
  p7ClaimedEvents = new Set();
  FOLD6_SQUARE_ACTORS.forEach((actor, i) => {
    const event = p7EventForActorOccurrence(actor, fold6SquareOccurrence(i));
    if (event) p7ClaimedEvents.add(event);
  });
  return p7ClaimedEvents;
}

// Extracted from drawPage7 below so drawFold9 (js/core.js, #page-7, currentPage
// 6) can keep this running too — see p7RealTimelineReached's own comment
// above for why: without this, scrolling back up from #page-8 into #page-7
// (crossing back over @fold12's own title) made every still-retreating square
// (and the year axis's own headline events, p7DrawAxisEvents) vanish in a
// single frame the instant currentPage dropped, instead of finishing their
// reverse cascade like they do while scrolling backward *within* #page-8
// itself. Callers must call p7UpdateEngagement() themselves first (drawPage7/
// drawFold9 both already do, since the axis needs a fresh p7HasEngaged too).
// A2 (desktop vertical axis): a faint full-width rule across both camps at
// each REACHED headline event's row, drawn under the dots. Persistent like
// the event's own dot (reachedT), not tied to the label's crossfade — the
// rule is a landmark that stays once passed. Wiped in by the axis intro.
function p7DrawVertEventLines(ctx, W, H, leftX0) {
  // 'band' headline mode (mobile candidate A) needs the rule: the band hangs off it.
  if (!(p7VerticalAxis() && (p7V().eventLine || p7V().headline === 'band') && p7.vert && p7AxisTriggerIfNeeded())) return;
  const introT = p7AxisIntroT();
  ctx.save();
  P7_AXIS_EVENTS.forEach((ev, i) => {
    const t = P7_AXIS_EVENT_STATE[i].reachedT * p7Ease(introT);
    if (t <= 0.001) return;
    const y = Math.round(p7RowY(p7.vert.events[i].row, H)) + 0.5;
    ctx.strokeStyle = `rgba(90, 90, 90, ${P7_VERT_EVENT_LINE_ALPHA * t})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftX0, y);
    ctx.lineTo(W - leftX0, y);
    ctx.stroke();
  });
  ctx.restore();
}

function p7DrawTimelineSquares(ctx, W, H) {
  p7UpdateLayout(W, H);

  // Cleared once finished rather than left to just clamp at t=1 forever —
  // matches every other one-shot anim object's own null-when-done convention
  // (p9.anim, page9.js) instead of silently doing pointless per-event lookups
  // every frame for the rest of the session.
  if (p7EntryAnim && performance.now() - p7EntryAnim.start >= p7EntryAnim.duration) p7EntryAnim = null;

  const { CELL, SQ, cols, leftX0 } = p7;
  const topY    = p7VertTopY(H);
  const rightX0 = p7GridGeometry(W, H).rightX0;

  // Events from months whose cascade has already fully finished are settled (drawn
  // at rest, no animation); events from the centered month, or from any earlier month
  // whose cascade is still mid-flight (the user scrolled past it before it finished),
  // keep animating on their own clock — see p7DrawSideSquares/p7MonthCursor. The
  // loop's upper bound must cover the *whole* centered month (monthEndL/monthEndR),
  // not just events whose date has already been reached, so the full cascade can play.
  // Hoisted once per draw: p7AnimTotalMs() reads isMobile() -> window.innerWidth,
  // a layout-flushing read, and the month loops below would call it per month.
  const animTotalMs = p7AnimTotalMs();
  const { y: curY, m: curM } = p7DateDayFrac(p7.currentDate);
  const curMonthKey = curY * 12 + curM;

  if (p7VerticalAxis() && p7.vert) {
    // Desktop: rows, gated by the axis edge — see p7RowPhase. Every event is
    // handed to p7DrawSideSquares; presence comes from its row's cursor.
    if (p7GridMorph && performance.now() - p7GridMorph.start >= p7MorphTotalMs()) p7GridMorph = null;
    if (p7FilterMorph && performance.now() - p7FilterMorph.start >= p7FilterMorphDur(p7FilterMorph)) p7FilterMorph = null;
    if (p7Grid.on) p7SizeGridLayout(W, H);
    p7OrchestrateRows();
    const posMap = new Map();
    p7DrawVertEventLines(ctx, W, H, leftX0);
    p7DrawSideSquares(ctx, p7.leftEvents,  p7.leftPos,  leftX0,  topY, cols, CELL, SQ, p7.leftEvents.length,  0, posMap);
    p7DrawSideSquares(ctx, p7.rightEvents, p7.rightPos, rightX0, topY, cols, CELL, SQ, p7.rightEvents.length, 0, posMap);
    p7.lastPositions = posMap;
    return;
  }

  // Only a month that's genuinely beyond anything reached before gets a fresh forward
  // cascade. A month can have no forward-start yet without being new territory — e.g.
  // it was scrolled past quickly and skipped while moving forward, and we're now
  // landing on it while moving *backward* — in which case it should just appear
  // settled, not fire off a brand new entrance while the user is scrolling the other way.
  //
  // The very first month (minDate's month) starts out "current" before the user has
  // scrolled into page7 at all — p7HasEngaged (updated by p7UpdateEngagement,
  // called from both here and drawFold9 in js/core.js so it stays accurate even
  // while currentPage is 7) only flips true once fold 9's title card has
  // scrolled past the top of the viewport, AND the year axis's own build-in
  // wipe (p7AxisIntroT) has fully finished.
  const isNewTerritory = p7HasEngaged && curMonthKey > p7MonthMaxReached;
  if (isNewTerritory) {
    // A single engaged tick can jump curMonthKey forward by more than one
    // month at once — e.g. @fold12's fly-then-engage gate (p7UpdateEngagement
    // above) lets scroll position race ahead of curMonthKey while
    // engagement is still pending, so the moment it fires, `t` (and the date
    // it maps to) can already be several months past minDate. Without
    // backfilling every skipped month here, each one falls straight into
    // "settled" below (no phase of its own at all) and pops in
    // instantly, fully-formed, with no cascade — the exact "instant jump"
    // this loop exists to prevent. All backfilled months start their cursor at
    // the same instant (simpler than staggering month-to-month, and each month's
    // own events still cascade individually within it via p7DrawSideSquares'
    // own per-event delay), rather than one after another.
    const backfillMs = p7AnimTotalMs();   // hoisted out of the loop, see p7PopMs
    for (let k = Math.max(p7MonthMaxReached + 1, p7MonthKeyOf(p7.minDate)); k <= curMonthKey; k++) {
      if (p7MonthPhase[k] === undefined) p7MonthAim(k, backfillMs); // from cursor 0
    }
    p7StartAnimLoop();
  } else if (p7HasEngaged && p7MonthPhase[curMonthKey] === undefined) {
    // Not new territory: curMonthKey was already skipped over earlier while
    // moving forward, and we're now landing on it while scrolling backward —
    // it should just appear settled, not fire off a brand new entrance while
    // the user is scrolling the other way.
    p7MonthSettle(curMonthKey, p7AnimTotalMs());
  }

  if (p7HasEngaged) {
    // Scrolling back down onto months that had started retreating turns them
    // around. Every month at or below the centered one gets re-aimed, not just
    // curMonthKey: one scroll tick can re-enter several at once, and a month
    // left aimed at 0 while no longer ahead of curMonthKey would keep vanishing
    // under the user. Aiming is enough to make each square resume growing from
    // the exact presence it had — that's the whole point of the shared cursor;
    // there is no snapshot to take and no "was it mid-flight?" case to special-case.
    for (const key in p7MonthPhase) {
      const k = Number(key);
      if (k <= curMonthKey && p7MonthAim(k, animTotalMs)) p7StartAnimLoop();
    }
  } else if (p7MonthMaxReached > -1) {
    // Disengaged (scrolled back up past this fold's own title — see
    // p7UpdateEngagement): the "current" month itself now needs to retreat
    // too, not just months ahead of it (the loop below already handles those
    // unconditionally) — otherwise it just sits at rest until
    // nextMonthStartStr's clamp further down cuts it away in a single frame
    // instead of playing the same reverse cascade every other month gets.
    if (p7MonthPhase[curMonthKey] !== undefined && p7MonthAim(curMonthKey, 0)) p7StartAnimLoop();
  }

  if (p7HasEngaged && curMonthKey > p7MonthMaxReached) p7MonthMaxReached = curMonthKey;

  // Scrolled backward past months that were previously reached: start their retreat
  // (each flies back out the same way it flew in) unless it's already retreating.
  // Unconditional on p7HasEngaged (always was) — once disengaged, curMonthKey is
  // pinned at the first month (p7.currentDate = p7.minDate, page7UpdateFromScroll),
  // so this still correctly covers every later month up through p7MonthMaxReached.
  for (let k = curMonthKey + 1; k <= p7MonthMaxReached; k++) {
    if (p7MonthPhase[k] !== undefined && p7MonthAim(k, 0)) p7StartAnimLoop();
  }
  // Once every month ahead of the centered one has fully retreated, stop tracking
  // (and drawing) them — otherwise we'd iterate them forever.
  while (p7MonthMaxReached > curMonthKey && (p7MonthCursor(p7MonthMaxReached) ?? 0) <= 0) {
    delete p7MonthPhase[p7MonthMaxReached];
    p7MonthMaxReached--;
  }
  // curMonthKey's own phase is deliberately left in place once its retreat
  // finishes (unlike the loop above, which drops months strictly ahead of it):
  // it rests at cursor 0, drawing nothing, and the retreat branch above can't
  // re-arm off it because p7MonthAim is a no-op when the target is already 0.
  //
  // ...with one exception: once we're fully DISENGAGED and that last month's
  // retreat has finished, there is nothing left on screen, so the whole
  // cascade must reset to its virgin state — otherwise scrolling back down
  // re-engages with curMonthKey's phase still present and p7MonthMaxReached
  // still === curMonthKey, so `isNewTerritory` reads false and the first
  // month's dots appear instantly, fully settled, with no cascade.
  if (!p7HasEngaged && p7MonthMaxReached === curMonthKey && (p7MonthCursor(curMonthKey) ?? 0) <= 0) {
    delete p7MonthPhase[curMonthKey];
    p7MonthMaxReached = -1;
  }

  // Walk backward from the centered month while previous months are still mid-cascade,
  // to find the earliest month that must still be drawn with animation applied. Once
  // disengaged, everything still in flight (including the current month, see above) is
  // retreating, so there's no "settled, at-rest" range at all — clamp straight to
  // minDate instead.
  let settledStr = p7.minDate;
  if (p7HasEngaged) {
    let earliestActiveMonthKey = curMonthKey;
    for (let k = curMonthKey - 1; p7MonthPhase[k] !== undefined && p7MonthCursor(k) < animTotalMs; k--) {
      earliestActiveMonthKey = k;
    }
    settledStr = p7MonthKeyToStartStr(earliestActiveMonthKey);
  }

  // The draw range's upper bound covers through whichever is further out: the
  // centered month, or a later month still retreating back toward the origin.
  // Before anything has ever been reached this visit (p7MonthMaxReached still
  // -1), clamp to p7.minDate itself so nothing draws regardless of how far
  // curMonthKey has silently raced ahead pre-engagement (p7.currentDate is
  // driven straight off raw scroll position with no engagement gating of its
  // own — see p7HasEngaged's own definition, gated on the title card's exit,
  // not on the axis). But once something HAS been reached, keep drawing
  // through p7MonthMaxReached even after disengaging, so the current month's
  // own retreat (started above) can actually finish playing out instead of
  // being hard-cut the instant engagement ends.
  const drawThroughMonthKey = Math.max(curMonthKey, p7MonthMaxReached);
  const nextMonthStartStr = (p7HasEngaged || p7MonthMaxReached > -1)
    ? p7MonthKeyToStartStr(drawThroughMonthKey + 1)
    : p7.minDate;
  const settledL  = p7BisectBefore(p7.leftEvents,  settledStr);
  const settledR  = p7BisectBefore(p7.rightEvents, settledStr);
  const monthEndL = p7BisectBefore(p7.leftEvents,  nextMonthStartStr);
  const monthEndR = p7BisectBefore(p7.rightEvents, nextMonthStartStr);

  const posMap = new Map();

  // Draw left events.
  p7DrawSideSquares(ctx, p7.leftEvents, p7.leftPos, leftX0, topY, cols, CELL, SQ, monthEndL, settledL, posMap);

  // Draw right events.
  p7DrawSideSquares(ctx, p7.rightEvents, p7.rightPos, rightX0, topY, cols, CELL, SQ, monthEndR, settledR, posMap);

  p7.lastPositions = posMap;
}

function drawPage7(ctx, W, H) {
  drawBackground(ctx, W, H);

  if (!p7.ready) {
    ctx.fillStyle = "#111";
    ctx.font = "16px 'Assistant', sans-serif";
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("טוען נתונים...", W / 2, H / 2);
    return;
  }

  p7UpdateEngagement();
  p7RealTimelineReached = true;
  const clipped = p7VertClipToBox(ctx, W, H);
  p7DrawTimelineSquares(ctx, W, H);
  p7DrawInspectScrim(ctx, W, H);
  if (clipped) ctx.restore();

  if (p7AxisTriggerIfNeeded()) p7DrawYearAxis(ctx, W, H);
}

// The mobile picker's selection halo, drawn by SUBTRACTION: one even-odd path —
// the whole canvas, minus a disc at the selected dot — filled with a white
// scrim. Everything else dims; the selection alone keeps its full colour.
//
// It runs on the MAIN canvas, not inside the loupe, so the dimming reaches
// every dot on screen rather than only the handful under the glass. The loupe
// is a plain blit of this canvas, so it inherits the halo already magnified and
// needs no marker of its own.
//
// Placed after the squares and before the axis deliberately: the axis is the
// reading context for the selected date and stays at full contrast.
//
// It is a DRAG-TIME aid, gated on p7Inspect.dragging: it exists to show which
// dot the finger is currently on. Lifting the finger clears the selection
// outright (onEnd -> release), so the chart, the axis and the docked frame all
// return to neutral together — a halo left standing would read as a persistent
// highlight rather than as aim.
function p7DrawInspectScrim(ctx, W, H) {
  if (!p7InspectPage() || !p7Inspect.dragging || !p7Inspect.event) return;
  // Same source the hit-test uses, so the hole lands on the dot that was picked
  // in whichever fold the picker is currently serving (@fold9 or @fold13).
  const { positions, half, cell } = p7InspectSource();
  const pos = positions.get(p7Inspect.event);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  // No position means the selected event isn't in this frame's draw range (the
  // cascade retreated past it) — the scrim then covers everything, with nothing
  // exempted, which is the honest reading: there is nothing to point at.
  if (pos) {
    // The hole is measured in dot widths so it tracks the per-viewport solved
    // square size (p7SolveMobileSq) instead of drifting at either end. The 1.5px
    // floor keeps it from vanishing at @fold13's 1px dots.
    //
    // Then capped so the hole can never reach a NEIGHBOUR. The grid pitch is
    // 1.5 dots, so the nearest edge of the adjacent dot sits `cell - half` from
    // this dot's centre; at the nominal 1 dot-width the hole landed exactly on
    // that edge, and any rounding let a sliver of each neighbour through
    // undimmed — the selection's brightness looked like it was spreading to the
    // dots around it, which is the one thing the halo exists to prevent. The 0.9
    // keeps a real margin. The floor below it is the selected square's own
    // half-diagonal (half * √2), so a tight grid clips a neighbour before it
    // ever clips the dot being pointed at.
    const r = Math.max(half * 1.42,
                       Math.min((cell - half) * 0.9,
                                Math.max(1.5, P7_INSPECT_HOLE_DOTS * half * 2)));
    ctx.arc(pos.x + half, pos.y + half, r, 0, Math.PI * 2);
  }
  ctx.fillStyle = `rgba(255,255,255,${P7_INSPECT_SCRIM})`;
  ctx.fill("evenodd");
  ctx.restore();

  // Then repaint the picked dot at a slightly more saturated version of its own
  // group colour. Inside the hole it was merely *un*-dimmed — correct, but at
  // 1–3px, ringed by a field gone pale, "same as it always was" doesn't read as
  // chosen. Saturation, not lightness: pushing toward white would wash a small
  // dot out against the scrim, while pushing the channels away from their own
  // grey point makes the hue itself more insistent at the same weight.
  // Deliberately not a change to GROUPS: this is a transient selection state,
  // and the roster's colours are the legend's contract.
  // Snapped onto the device-pixel grid for the same reason p7DrawSideSquares
  // snaps (see its comment): this repaint lands on the fractional position the
  // dot was solved at, so unsnapped it antialiases into a partial-alpha band
  // that the loupe's nearest-neighbour blit magnifies into a pale ring. That
  // would put the "extra stroke" back on the ONE dot the halo exists to show
  // clearly, while every dot around it — drawn by the snapping path — stayed
  // clean. Mobile only; the picker is a mobile gesture and desktop's
  // rendering is settled at full-size squares.
  if (pos) {
    ctx.fillStyle = p7Saturate(p7ActorColor(p7Inspect.event.actor),
                               P7_INSPECT_PICK_SAT);
    const size = half * 2;
    if (isMobile()) {
      const dpr = window.devicePixelRatio || 1;
      const q   = v => Math.round(v * dpr) / dpr;
      ctx.fillRect(q(pos.x), q(pos.y), Math.max(1 / dpr, q(size)), Math.max(1 / dpr, q(size)));
    } else {
      ctx.fillRect(pos.x, pos.y, size, size);
    }
  }
}

// #rrggbb -> a more saturated rgb(), by pushing each channel away from the
// colour's own luminance by `amt` (0 = unchanged). Cheap and hue-preserving —
// no HSL round trip. Local to the picker; lerpFold6SquareColor (js/groups.js)
// parses hex the same way but always blends against the fold6 rest gray.
function p7Saturate(hex, amt) {
  const n = parseInt(String(hex).slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const push = v => Math.round(Math.max(0, Math.min(255, lum + (v - lum) * (1 + amt))));
  return `rgb(${push(r)}, ${push(g)}, ${push(b)})`;
}

// The axis *appearing* (the one-shot build-in wipe) and the axis *filling up*
// (p7HasEngaged advancing p7.currentDate) are two separate trigger points —
// this is the appearing one. Per explicit instruction it fires the moment
// @fold9's fly trigger is activated (fold9FlyTrigger — legacy name, it's the
// squares' fly-out on id #page-8), NOT after the squares land: p7HasEngaged
// additionally waits for that fly to finish (`flyDone` in p7UpdateEngagement),
// which made the wipe start late. Falls back to p7HasEngaged if js/groups.js
// (which loads after this file) hasn't defined the trigger yet, so this still degrades safely.
function p7AxisShouldShow() {
  // @fold10's size grid has no dates, so the axis goes — but through the same
  // reverse wipe every other exit uses (p7AxisReverseOut, via
  // p7AxisTriggerIfNeeded), not by vanishing on the trigger frame.
  if (p7Grid.on) return false;
  // ...and for as long as the grid's OFF morph is still flying the dots back
  // onto the timeline. The two beats are strictly ordered on the way up: the
  // DOTS fly first, and only once they have landed does the axis draw itself
  // in. Starting the build-in wipe on the frame the grid switched off had it
  // wiping through a field still in the air.
  if (p7GridMorph && p7GridMorph.dir === "off"
      && performance.now() - p7GridMorph.start < p7MorphTotalMs(p7GridMorph.flat)) return false;
  if (typeof fold9FlyTrigger !== "undefined" && fold9FlyTrigger.currentRaw() > 0) return true;
  return p7HasEngaged;
}

// Latches p7AxisIntroStart the instant p7AxisShouldShow() first goes true,
// kicking off the build-in wipe (p7AxisIntroT) on its own wall clock — and
// un-latches if the user scrolls back above that trigger point, so scrolling
// forward across it again replays the same build-in from scratch. Same
// interruptible-replay pattern as the axis's own headline events (see
// p7UpdateAxisEventTriggers above), just for the axis's first appearance
// instead of a single event.
// Don't snap the axis away — hand whatever wipe progress it had to a quick
// reverse wipe (p7AxisOutroStart) and keep it drawable until that reaches 0.
// Shared exit path: called both when the fly trigger un-fires (scrolling back
// up out of the timeline, via p7AxisTriggerIfNeeded) and the moment @fold12's
// bridge glide starts (drawPage8, which draws the axis itself during the
// reverse wipe so it undraws instead of vanishing with the timeline frame).
// Returns true while there is still reverse-wipe progress worth drawing.
function p7AxisReverseOut() {
  if (p7AxisIntroStart !== null) {
    const t = p7AxisIntroT();
    p7AxisIntroStart = null;
    if (t > 0) {
      p7AxisOutroStart = performance.now();
      p7AxisOutroFromT = t;
      p7StartAnimLoop();
    }
  }
  if (p7AxisOutroStart !== null && p7AxisIntroT() <= 0) p7AxisOutroStart = null;
  return p7AxisOutroStart !== null;
}

function p7AxisTriggerIfNeeded() {
  if (!p7AxisShouldShow()) return p7AxisReverseOut();
  if (p7AxisOutroStart !== null) {
    // Re-triggered mid-reverse: resume the build-in from wherever the reverse
    // wipe currently is (back-date the start so introT continues seamlessly).
    const t = p7AxisIntroT();
    p7AxisOutroStart = null;
    p7AxisIntroStart = performance.now() - t * P7_AXIS_INTRO_DURATION;
    p7StartAnimLoop();
  } else if (p7AxisIntroStart === null) {
    p7AxisIntroStart = performance.now();
    p7StartAnimLoop();
  }
  return true;
}

// ── Date axis — a horizontal year strip drawn along the bottom of the canvas.
// The full span (every year from p7.minDate to p7.maxDate, plus all labels) is
// drawn faint from the very first frame (Figma node 206:908) — what actually
// grows right to left as the user scrolls deeper into the dataset is a darker
// "filled" overlay on top of it. Unlike the square cascade beside it, neither
// layer has animation state of its own: every frame both are recomputed straight
// from p7.currentDate, so scrolling backward just naturally shrinks the dark
// overlay back — no separate reverse bookkeeping needed.
const P7_AXIS_MARGIN          = 120;  // px inset from each edge — widened from 48 to SHORTEN the whole axis (both ends move inward symmetrically). The right anchor (p7.minDate/"2023") now sits far enough from the screen edge that the first axis event's label can center over its own circle with clearance instead of falling back to right-alignment (see p7AxisEventBounds' x+textWidth/2 > W test).
const P7_AXIS_MARGIN_MOBILE   = 28;   // px — the desktop 120 would leave only ~150px of axis on a 393px phone; 28 keeps the year ticks ~90px apart while still giving the end labels room off the screen edges.
function p7AxisMargin() { return isMobile() ? P7_AXIS_MARGIN_MOBILE : P7_AXIS_MARGIN; }
const P7_AXIS_Y_FRAC          = 0.90; // fraction of H — vertical center of the solid line; the year labels now sit BELOW it (P7_AXIS_YEAR_LABEL_OFFSET), not on the same row
const P7_AXIS_Y_FRAC_MOBILE   = 0.94; // fraction of H — the axis sits lower on a phone: the grid above it ends higher (sbbTimeline()'s mobile bottom reserves SBB_TIMELINE_MOBILE_AXIS_CLEAR_PX under it) and the year label under it is 14px rather than 18, so 0.90 left a conspicuous empty band under the axis while the grid felt crowded.
function p7AxisYFrac() { return isMobile() ? P7_AXIS_Y_FRAC_MOBILE : P7_AXIS_Y_FRAC; }
const P7_AXIS_LINE_THICKNESS  = 1;     // px — the solid line's stroke height
const P7_AXIS_MARKER_RADIUS   = 4;     // px — radius of the year-tick ring markers AND the headline-event dots at full size (shared so they read as one system)
const P7_AXIS_MARKER_RADIUS_FADED = 2;
// Hovered square's mirror dot when it falls inside an open headline card (over the fill, under the text).
const P7_AXIS_HOVER_MARKER_ALPHA = 0.5; // px — shrunk radius a headline-event dot settles to once its label has crossfaded away (grows back to _RADIUS on hover)
const P7_AXIS_MARKER_STROKE   = 1;     // px — ring line width for the hollow year markers
const P7_AXIS_YEAR_LABEL_OFFSET = 12;  // px gap from the marker's bottom edge down to the year label's top
const P7_AXIS_YEAR_LABEL_OFFSET_MOBILE = 5; // px — the same gap tightened on a phone, so the year reads as attached to its own tick rather than floating below the axis
function p7AxisYearLabelOffset() { return isMobile() ? P7_AXIS_YEAR_LABEL_OFFSET_MOBILE : P7_AXIS_YEAR_LABEL_OFFSET; }
const P7_AXIS_BG_ALPHA        = 0.22;  // faint full-span line's alpha, under the dark "filled" overlay — also reused to dim the axis event label during state3 (hover elsewhere)
const P7_AXIS_BG_COLOR        = `rgba(0, 0, 0, ${P7_AXIS_BG_ALPHA})`;
// STRICTLY during state3 (hover elsewhere): the UNFILLED span of the axis line
// drops below the shared BG_ALPHA, widening its contrast with the (0.34-dimmed)
// filled span so the fill edge stays legible under the hover. Un-hovered, the
// unfilled line uses the plain BG_COLOR like everything else.
const P7_AXIS_UNFILLED_HOVER_ALPHA = 0.14;
// The dimmed headline labels + dates during state3 (hover elsewhere) get their
// own, slightly higher alpha than the axis chrome — at BG_ALPHA the roster read
// too faint to actually serve as a reference key.
const P7_AXIS_ROSTER_LABEL_ALPHA = 0.34;
const P7_AXIS_FILLED_COLOR    = "rgba(0, 0, 0, 1)";    // the portion scroll has already reached
const P7_AXIS_HOVER_COLOR     = P7_AXIS_FILLED_COLOR;  // the single dash highlighted while a matching dot elsewhere is hovered — same solid black as the "filled" state now that it's already fully opaque, no room to go darker
const P7_AXIS_LABEL_FAINT_COLOR = "rgba(0, 0, 0, 0.12)"; // unreached year label — same faint/filled ratio as the dots
// Reached year label + axis event date text — close to state2's solid black
// but a touch lighter, on their own constant rather than tied to
// P7_AXIS_FILLED_COLOR, so the axis's own dashes can stay pure black while
// this text reads a bit brighter/less heavy.
const P7_AXIS_LABEL_COLOR       = "rgba(0, 0, 0, 0.65)";

// One-shot build-in animation for the axis's first appearance (separate from
// the scroll-driven faint/filled reveal above, which keeps working exactly
// the same once this has played) — a right-to-left wipe, on its own wall
// clock, starting from p7.minDate's anchor (the "2023" end) since that's
// where the scroll-driven reveal above starts from too. p7AxisIntroStart is
// null when not yet triggered (or reset back to it, see p7AxisTriggerIfNeeded).
const P7_AXIS_INTRO_DURATION = 2800; // ms — full right-edge-to-left-edge wipe
// Reverse wipe on EVERY exit the axis has — @fold10's size grid (p7Grid.on
// makes p7AxisShouldShow false, so p7AxisTriggerIfNeeded hands off to
// p7AxisReverseOut), scrolling back up past the fly trigger, and @fold12's
// bridge glide. The same wipe plays backwards, but FASTER than the build-in —
// its own constant, tuned by eye on a harness. 500ms snapped away the moment
// @fold12's title block hit and read as a glitch; the intro's full 2800 was the
// other extreme, the axis still undrawing well into the bridge glide. 1500 was
// the first setting between them and still lagged @fold10's morph. This is the
// FULL-wipe time; an interrupted intro reverses over only its remaining
// distance (duration scaled by how far it had got), per convention.
const P7_AXIS_OUTRO_DURATION = 1250; // ms — full left-edge-back-to-right-edge un-wipe
let p7AxisIntroStart = null;
let p7AxisOutroStart = null; // non-null while the reverse wipe is running
let p7AxisOutroFromT = 0;    // introT captured at the moment the reverse began

function p7AxisIntroT() {
  if (p7AxisOutroStart !== null) {
    const dur = P7_AXIS_OUTRO_DURATION * p7AxisOutroFromT;
    if (dur <= 0) return 0;
    const gone = (performance.now() - p7AxisOutroStart) / dur;
    return p7AxisOutroFromT * (1 - Math.min(1, gone));
  }
  if (p7AxisIntroStart === null) return 0;
  return Math.min(1, (performance.now() - p7AxisIntroStart) / P7_AXIS_INTRO_DURATION);
}

// Maps a date string to an x position along the axis: p7.minDate anchors the
// right edge, p7.maxDate the left edge, linear in elapsed days — the same
// fraction page7UpdateFromScroll derives currentDate from, just recomputed
// here from the date string so the axis has a single source of truth.
function p7AxisX(dateStr, W) {
  const minMs = new Date(p7.minDate + "T00:00:00Z").getTime();
  const maxMs = new Date(p7.maxDate + "T00:00:00Z").getTime();
  const rightX = W - p7AxisMargin();
  const leftX  = p7AxisMargin();
  if (maxMs === minMs) return rightX;
  const frac = (new Date(dateStr + "T00:00:00Z").getTime() - minMs) / (maxMs - minMs);
  return rightX - frac * (rightX - leftX);
}

// One tick per calendar year spanned by the data: the first is always p7.minDate
// itself (the start anchor, shown from the very first frame), the rest are each
// subsequent year's January 1st.
function p7AxisYearTicks() {
  const minD = new Date(p7.minDate + "T00:00:00Z");
  const maxYear = new Date(p7.maxDate + "T00:00:00Z").getUTCFullYear();
  const minYear = minD.getUTCFullYear();
  const ticks = [{ year: minYear, dateStr: p7.minDate }];
  for (let y = minYear + 1; y <= maxYear; y++) {
    ticks.push({ year: y, dateStr: `${y}-01-01` });
  }
  return ticks;
}

// Headline events called out along the axis — title only, no date (the axis's own
// year ticks already carry that). Each one appears right as the growing edge
// reaches its date and stays on screen — unlike a one-shot toast — until the
// *next* event's date is reached, at which point it crossfades into that one.
// So only one is ever on screen, but which one is showing tracks scroll position
// directly rather than a wall-clock timer.
//
// `maxWidth` (px) is a per-event cap on how wide the title may render: over it,
// the title wraps onto extra lines that stack UPWARD from the date, so a long
// headline gets narrow-and-tall instead of wide — which is what actually keeps
// two neighbouring events from colliding, since the de-collision pass below can
// only slide labels sideways within a fixed axis width. `null` = no cap, draw
// on one line. Tuned by eye per event, so they're hand-set numbers, not derived.
// `desc` is the description that types into the plaque on hover (desktop side
// plaques only — see P7_AXIS_DESC_* below); the source's trailing «מקור» is
// deliberately omitted.
const P7_AXIS_EVENTS_ALL = [
  // Nudged left to clear the "2023" year ring — 04.01 sits only 3 days from
  // minDate, so at its true x its dot all but touches the axis's right anchor.
  // mobileAbove: this one sits 3 days after minDate, i.e. hard against the top
  // of the axis, where a side plaque has the year label and the screen edge to
  // fight. It is placed ABOVE its dot from the start instead of flying in from
  // the side — see p7AxisEvMobileAbove.
  { date: "2023-01-04", label: "הכרזת הרפורמה", maxWidth: null, xOffset: -14, mobileAbove: true,
    desc: "הצגת תוכניתו של שר המשפטים יריב לוין לשינויים במערכת המשפט." },
  // hideOnMobile: the phone's axis carries fewer plaques than the desktop one.
  // At the mobile square/zoom the cards crowd each other, so the roster is
  // thinned to the events the story actually needs — three are dropped
  // (2026-09-13), leaving 6 of 9.
  { date: "2023-06-20", label: "הפיגוע בעלי", maxWidth: null, hideOnMobile: true,
    desc: "פיגוע ירי סמוך ליישוב עלי, שבו נהרגו ארבעה ישראלים." },
  { date: "2023-07-24", label: "ביטול עילת הסבירות", maxWidth: null, hideOnMobile: true,
    desc: "אישור התיקון שמנע ביקורת שיפוטית על סבירות החלטות הממשלה והשרים." },
  { date: "2023-10-07", label: "מתקפת 7 באוקטובר", maxWidth: null,
    desc: "מתקפה בהובלת חמאס על יישובים ובסיסים בדרום ישראל, שכללה הרג וחטיפת אזרחים ואנשי ביטחון." },
  { date: "2024-09-01", label: "מות ששת החטופים", maxWidth: null,
    desc: "הודעת צה״ל על חילוץ גופותיהם של שישה חטופים שנרצחו בשבי ברפיח." },
  { date: "2025-03-18", label: "חידוש הלחימה בעזה", maxWidth: null,
    desc: "חידוש התקיפות הישראליות הנרחבות בעזה לאחר כחודשיים של הפסקת אש." },
  { date: "2025-06-13", label: "מבצע ״עם כלביא״", maxWidth: null, hideOnMobile: true,
    desc: "פתיחת המבצע הישראלי נגד מטרות גרעין וצבא באיראן, ובעקבותיו ירי איראני לעבר ישראל." },
  { date: "2025-10-13", label: "שחרור החטופים מעזה", maxWidth: null,
    desc: "שחרור עשרים החטופים החיים שנותרו בעזה במסגרת הסכם הפסקת אש." },
  // Past maxDate (2026-07-03) — parks at the axis's left end (see the clamp in
  // p7AxisEventTrueX); the +26 holds it clear of that end rather than flush to it.
  // `above` because it's the LAST event: parked at the axis's far end, a
  // downward card would open into (and past) that end with nothing below it
  // to hold it. Opening upward keeps the whole card on the axis.
  { date: "2026-07-17", label: "התפזרות הכנסת ה-25", maxWidth: null, xOffset: 26, above: true,
    desc: "אישור התפזרות הכנסת לקראת הבחירות באוקטובר." },
];

// The list the whole file actually uses — `hideOnMobile` entries dropped under
// the 600px breakpoint.
//
// Filtered HERE, at declaration, and not per draw: P7_AXIS_EVENT_STATE,
// p7AxisEventSpans, p7SideCardDy, p7.vert.events and every label/marker pass are
// all index-parallel to this array, so the set has to be fixed before any of
// them are built. A per-frame skip would leave those arrays holding a slot for
// an event that never draws, and every `i` in this file would mean two things.
//
// The literal 600 duplicates MOBILE_BP rather than calling isMobile(): both live
// in js/core.js, which project.html loads AFTER page7.js, so neither exists yet
// at this line. Keep the two in step by hand.
//
// A browser dragged across the breakpoint mid-session keeps the set it loaded
// with until a reload — the same reload-scoped treatment the layout already
// gives a desktop<->mobile crossing.
const P7_AXIS_EVENTS = P7_AXIS_EVENTS_ALL.filter(
  (ev) => !(ev.hideOnMobile && window.innerWidth <= 600));

// Fixed real-time (wall-clock) fade durations — these only govern the crossfade
// itself, not how long an event stays fully visible (that's driven by scroll: it
// holds at full opacity for as long as the next event remains unreached). Once a
// fade starts it plays out on its own clock (via p7StartAnimLoop/p7AnyAnimActive
// below) even if the user stops scrolling entirely.
const P7_AXIS_EVENT_FADE_IN_MS  = 400;
// Desktop half-dot card: the label's fade-in clock is instead a 3-beat reveal
// (dot pop → accent bar draws out → card opens, see P7_VERT_CARD_BEATS), so it
// gets a longer clock. The fade-out (and the reverse scroll) plays the same
// beats backwards over P7_AXIS_EVENT_FADE_OUT_MS.
const P7_VERT_CARD_OPEN_MS = 900;
function p7AxisFadeInMs() {
  const c = p7V().card;
  // Both card reveals run on the 900ms clock: the centred half-dot card's
  // 3-beat unfold, and the side card's single unfold out from the line.
  return p7VerticalAxis() && p7V().headline === 'widen' && c && c.anchor === 'center'
    && (p7V().eventSide !== 'center' || c.halfDots)
    ? P7_VERT_CARD_OPEN_MS : P7_AXIS_EVENT_FADE_IN_MS;
}
// Windows of the reveal's raw progress (p9Ease re-applied per window):
// bar = the accent bar grows out from the dot; open = the card unfolds from
// the dot edge, carrying the far bar and the far half-dot with it.
const P7_VERT_CARD_BEATS = { bar: { start: 0, len: 0.35 }, open: { start: 0.35, len: 0.65 } };
const P7_AXIS_EVENT_FADE_OUT_MS = 1000;

// ── Axis-event presentation knobs ───────────────────────────────────────
// compare/ + manual/ picks, 2026-09-12 (_debug-zoomed-axis.js, since deleted).
// See wiki/Timeline.md.
//
// Where the event fires, in ROWS relative to its own dot. 0 = the dot itself
// (p7BuildVerticalLayout's reachRow). Positive fires LATER — the fill edge has
// to travel this many rows PAST the dot first; negative fires early, above it.
// MOBILE ONLY — desktop keeps 0 (fires at the dot). Same for every knob in this
// block: the compare/manual pass that produced these ran under the 600px
// breakpoint and desktop was never part of it.
const P7_AXIS_TRIGGER_ROW_OFFSET_MOBILE = 25;
function p7AxisTriggerRowOffset() { return isMobile() ? P7_AXIS_TRIGGER_ROW_OFFSET_MOBILE : 0; }
// How a headline card LEAVES. It is a trigger-driven beat either way; the modes
// differ in what the beat does to the card.
//   'fade'         — the old behaviour: opacity to 0 in place.
//   'collapse'     — scales into its own axis dot, no fade. The card visibly
//                    goes back where it came from.
//   'collapseY'    — collapses vertically into the dot's line only.
//   'collapseX'    — collapses horizontally into the axis only.
//   'collapseFade' — collapses AND fades, for when the pure collapse reads too
//                    heavy against a busy field.
const P7_AXIS_LEAVE_MODE_MOBILE = 'collapse';
function p7AxisLeaveMode() { return isMobile() ? P7_AXIS_LEAVE_MODE_MOBILE : 'fade'; }
// Draw an event's marker BEFORE the fill reaches it, in the unfilled axis
// line's own colour and alpha (P7_AXIS_BG_ALPHA), turning solid black as the
// fill arrives. The dot then reads as part of the axis all along rather than
// appearing out of nothing on its trigger.
const P7_AXIS_MARKER_UNREACHED_MOBILE = true;
function p7AxisMarkerUnreached() { return isMobile() && P7_AXIS_MARKER_UNREACHED_MOBILE; }
// What the marker does on its trigger, given the above.
//   'grow' — starts small (P7_AXIS_MARKER_GROW_FROM of its resting radius) and
//            grows to full as it is reached, recolouring on the way.
//   'full' — already at its resting size before the fill arrives; ONLY the
//            colour changes, so nothing on the axis moves when an event fires.
// compare/ pick 2026-09-12: 'full'. The axis is a fixed row of dots that simply
// darken as the fill passes them — nothing on it jumps or resizes on a trigger.
const P7_AXIS_MARKER_ENTER_MOBILE = 'full';
function p7AxisMarkerEnter() { return isMobile() ? P7_AXIS_MARKER_ENTER_MOBILE : 'grow'; }
const P7_AXIS_MARKER_GROW_FROM = 1;    // 'grow' mode's starting fraction — unused (mobile is 'full', desktop never draws unreached markers)

// The page ground the axis is painted on (--bg in style.css). Needed because
// the marker colour below is composited by hand rather than by the canvas.
const P7_PAPER_RGB = [253, 252, 255];

// An axis marker's colour for a given reach progress: matching the unfilled
// axis line at 0, solid black at 1.
//
// OPAQUE, not rgba. The marker sits ON the axis line, and a translucent fill
// over an already-translucent line COMPOSITES — the two alphas stack and the
// unreached dot shows up as a darker blob on the line instead of matching it.
// So the equivalent flat colour is computed against the paper and painted at
// full alpha: it reads exactly like the line where it overlaps, and there is
// nothing to build up. (At t = 1 this is pure black either way.)
function p7AxisMarkerColorAt(t) {
  const a = P7_AXIS_BG_ALPHA + (1 - P7_AXIS_BG_ALPHA) * Math.min(1, Math.max(0, t));
  const c = P7_PAPER_RGB.map(v => Math.round(v * (1 - a)));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

// Applies P7_AXIS_LEAVE_MODE to ctx for one headline card. The caller must have
// ctx.save()d. `op` is the card's 0..1 presence; (dotX, dotY) its own axis dot,
// which is what every collapse mode scales toward.
function p7AxisLeaveApply(ctx, op, dotX, dotY) {
  const M = p7AxisLeaveMode();
  if (M === 'fade') { ctx.globalAlpha = op; return; }
  // Never scale to exactly 0 — a zero-determinant transform makes the whole
  // path non-invertible and Chrome drops the draw entirely rather than
  // rendering nothing, which on a reversal flashes the card back at full size.
  const k = Math.max(0.0001, p9Ease(op));
  ctx.globalAlpha = M === 'collapseFade' ? op : 1;
  ctx.translate(dotX, dotY);
  ctx.scale(M === 'collapseY' ? 1 : k, M === 'collapseX' ? 1 : k);
  ctx.translate(-dotX, -dotY);
}
const P7_AXIS_EVENT_LABEL_OFFSET = 34; // px above the axis line (lifted to give date room below)
const P7_AXIS_EVENT_FONT         = "500 14px 'Assistant', sans-serif";
const P7_AXIS_DATE_FONT          = "400 14px 'Assistant', sans-serif";
const P7_AXIS_DATE_OFFSET        = 18;  // px above the label baseline
const P7_AXIS_EVENT_LINE_HEIGHT  = 19;  // px between wrapped title lines

// Mobile (≤600px): smaller type and tighter stacking. The lines stack upward
// toward the grid, whose bottom is set to clear a 3-line block
// (SBB_TIMELINE_MOBILE_AXIS_CLEAR_PX).
const P7_AXIS_EVENT_LABEL_OFFSET_MOBILE = 36;
const P7_AXIS_EVENT_FONT_MOBILE         = "500 14px 'Assistant', sans-serif";
const P7_AXIS_DATE_FONT_MOBILE          = "400 14px 'Assistant', sans-serif";
const P7_AXIS_DATE_OFFSET_MOBILE        = 16;
const P7_AXIS_EVENT_LINE_HEIGHT_MOBILE  = 18;
// Every title gets a cap on mobile (desktop leaves them all uncapped). It used
// to be a narrow 120 so the de-collision pass could fit several blocks side by
// side on a ~300px axis; now that mobile prints ONE centred block (see
// p7DrawAxisEvents) the whole width is available, so it widens to 220 and most
// titles come back to one or two lines. Per-event `maxWidthMobile` overrides it.
const P7_AXIS_EVENT_MAXWIDTH_MOBILE     = 220;

function p7AxisEventFont()       { return isMobile() ? P7_AXIS_EVENT_FONT_MOBILE : P7_AXIS_EVENT_FONT; }
// The vertical (desktop) headline faces come from P7_VERT.type instead.
function p7VertFont(t)           { return `${t.weight} ${t.size}px 'Assistant', sans-serif`; }
// Draw one headline line so its INK (cap/Hebrew letter height, measured on a
// fixed reference so lines don't jitter with descenders) is centred in its
// line box — with textBaseline 'top' the glyphs sit high in the box and the
// block reads as more padding below than above. Uses the current ctx.font.
function p7VertLineText(ctx, text, x, lineTop, lh) {
  const prev = ctx.textBaseline;
  // measureText's bounding boxes are relative to the CURRENT baseline —
  // switch to alphabetic first or the ascent comes back negative under 'top'.
  ctx.textBaseline = "alphabetic";
  const m = ctx.measureText("0א");
  const a = m.actualBoundingBoxAscent, d = m.actualBoundingBoxDescent;
  ctx.fillText(text, x, lineTop + (lh - (a + d)) / 2 + a);
  ctx.textBaseline = prev;
}
function p7AxisDateFont()        { return isMobile() ? P7_AXIS_DATE_FONT_MOBILE  : P7_AXIS_DATE_FONT; }
function p7AxisEventLabelOffset(){ return isMobile() ? P7_AXIS_EVENT_LABEL_OFFSET_MOBILE : P7_AXIS_EVENT_LABEL_OFFSET; }
function p7AxisDateOffset()      { return isMobile() ? P7_AXIS_DATE_OFFSET_MOBILE : P7_AXIS_DATE_OFFSET; }
function p7AxisEventLineHeight() { return isMobile() ? P7_AXIS_EVENT_LINE_HEIGHT_MOBILE : P7_AXIS_EVENT_LINE_HEIGHT; }
function p7AxisEventMaxWidth(ev) {
  if (!isMobile()) return ev.maxWidth;
  return ev.maxWidthMobile != null ? ev.maxWidthMobile : P7_AXIS_EVENT_MAXWIDTH_MOBILE;
}

// triggeredAt is a performance.now() timestamp, set once when the event is first
// reached, and cleared only once its own reverse fade-out (leavingAt below) has
// fully finished — null means "not currently triggered or shown" (either never
// reached yet, or reached-then-reversed-then-fully-faded). Scrolling back above
// the *next* event's date clears that next one's own triggeredAt/leavingAt,
// which is what un-does this event's forward-triggered fade-out (see
// p7AxisEventOpacity) and brings it back to full opacity — no separate reverse
// bookkeeping needed for that particular case.
//
// leavingAt is a separate timestamp, set the instant *this* event itself is
// scrolled back above its own date — driving its own reverse fade-out
// (P7_AXIS_EVENT_FADE_OUT_MS) symmetrically with the forward crossfade,
// instead of just snapping triggeredAt to null and disappearing in one frame.
// Re-reaching the event before that fade finishes cancels it (leavingAt reset
// to null), same "reversible mid-flight" convention as p7DrawSideSquares' own
// month cascade.
// hoverT (0 → 1) is a per-frame-eased hover amount: 1 while this event's axis
// circle is hovered, decaying back to 0 when it isn't, easing the dot's
// grow/shrink (and its label's re-show) instead of snapping. Kept on the same
// state object so the anim loop (p7AxisEventsAnimActive) can see it settle.
// reachedT (0 → 1) is the eased "the fill edge has passed me" amount, driving the
// circle's radius in and OUT. Without it the marker's existence was a hard
// boolean on the fill edge, so scrolling back up made every dot vanish in one
// frame while its label was still fading — position never snaps, and neither
// should a dot's presence. Same lerp speed as hoverT so the axis has one tempo.
const P7_AXIS_HOVER_ANIM_SPEED = 0.18; // per-frame lerp toward the hover target
// descT (raw 0 → 1, linear in time) is the hover-description reveal of a desktop
// side plaque: it advances toward 1 while the plaque (dot or card) is hovered
// AND the event is on the roster (reached, not leaving), and retreats otherwise
// — a fixed-tempo, reversible-mid-flight beat like the ACLED note's hover
// (FOLD6_NOTE_HOVER_MS) rather than the per-frame lerp hoverT uses, so the
// card-open and typing beats below can slice it into windows.
const P7_AXIS_EVENT_STATE = P7_AXIS_EVENTS.map(() => ({ triggeredAt: null, leavingAt: null, hoverT: 0, reachedT: 0, descT: 0, othersT: 0, aboveT: 0, outT: 0 }));

// Hover description (desktop side plaques). Same shape as the ACLED note: the
// card opens first, then the description types in over the rest; a hard
// opacity gate, no fade. Beats slice the RAW descT and re-ease per window.
const P7_AXIS_DESC_MS = 700;                                          // = FOLD6_NOTE_HOVER_MS
const P7_AXIS_DESC_BEATS = { open: { start: 0, len: 0.3 }, type: { start: 0.3, len: 0.7 } };
// The card keeps the plaque's wrap width and only grows taller ("keep" won the
// compare/ over widening outward over the grid, 2026-09-07).
const P7_AXIS_DESC_GAP = 2;                                           // title block → description
const P7_AXIS_DESC_TYPE = { size: 12, weight: 400, lh: 17, color: 'rgba(0, 0, 0, 0.75)' };
// While one plaque is hovered every OTHER open plaque folds back into its near
// edge — the reveal played backwards, dots untouched (compare/ pick over dimming
// them, 2026-09-07). Driven by othersT, reversible at P7_AXIS_DESC_MS.
let p7AxisDescLastNow = null;                                          // dt source for descT

// Eased 0 → 1 amount of the "roster" state: 1 while a regular timeline square is
// hovered, decaying back to 0 when it is not. ONE shared value rather than a
// per-event one, because the roster is a single whole-axis state — every reached
// label fades in and every dot shrinks together on the same clock. Eased with the
// same P7_AXIS_HOVER_ANIM_SPEED lerp as an individual dot's hoverT, so both hover
// behaviours move at one tempo instead of snapping.
let p7AxisRosterT = 0;

// Checked every draw (see p7AnyAnimActive) so the animation loop keeps running —
// and labels keep fading — purely on elapsed time, with no further scrolling
// required.
function p7AxisEventsAnimActive() {
  // The size grid draws no axis at all (p7DrawAxisEvents / p7DrawVertEventLines
  // both bail on p7Grid.on), so none of the states below can advance while it is
  // on — and a target they can never reach keeps this true forever. That pinned
  // the animation loop open for the whole of @fold10: every frame redrew all
  // ~14k squares (~4-5ms each) with the pointer standing still, which is what
  // read as the hover stuttering. The roster clause was the one that latched:
  // hovering a square sets its target to 1 while p7AxisRosterT stays at 0.
  // ...except while the axis is still un-wiping itself off the screen: that
  // outro is bounded (P7_AXIS_OUTRO_DURATION) and needs frames of its own.
  if (p7Grid.on && p7AxisOutroStart === null) return false;
  const now = performance.now();
  // A hover grow/shrink still easing toward its target keeps the loop alive even
  // for an event whose label has otherwise fully faded (triggeredAt cleared).
  const hoverAnimating = P7_AXIS_EVENT_STATE.some((state, i) => {
    const target = P7_AXIS_EVENTS[i] === p7.hoveredAxisEvent ? 1 : 0;
    return Math.abs(state.hoverT - target) > 0.001;
  });
  if (hoverAnimating) return true;
  // A description still opening or closing (descT off its target).
  if (P7_AXIS_EVENT_STATE.some((state, i) => Math.abs(state.descT - (p7AxisDescTarget(i) ? 1 : 0)) > 0.0001)) return true;
  if (P7_AXIS_EVENT_STATE.some((state, i) => Math.abs(state.othersT - (p7AxisOthersTarget(i) ? 1 : 0)) > 0.0001)) return true;
  // A circle still growing in or shrinking out (p7DrawAxisEvents' reachedT)
  // outlives its label's fade in the scroll-back case, so it needs its own check.
  const markerAnimating = P7_AXIS_EVENT_STATE.some((state) => state.reachedT > 0.001 && state.reachedT < 0.999);
  if (markerAnimating) return true;
  // The shared roster ease has to keep the loop alive on its own: it moves even
  // when no individual event's hoverT does (nothing on the axis is hovered — a
  // regular timeline square is).
  if (Math.abs(((p7.hoveredEvent || (p7Inspect.dragging && p7Inspect.event)) ? 1 : 0) - p7AxisRosterT) > 0.001) return true;
  return P7_AXIS_EVENT_STATE.some((state, i) => {
    if (state.triggeredAt === null) return false;
    if (now - state.triggeredAt < p7AxisFadeInMs()) return true;
    return state.leavingAt !== null && now - state.leavingAt < P7_AXIS_EVENT_FADE_OUT_MS;
  });
}

// True while event i's description should be open: its plaque (dot or card) is
// hovered and it is on the roster (reached, not leaving). Desktop only — the
// mobile slot has no hover layer.
function p7AxisDescTarget(i) {
  const st = P7_AXIS_EVENT_STATE[i];
  return !isMobile() && p7.hoveredAxisEvent === P7_AXIS_EVENTS[i] && st.triggeredAt !== null && st.leavingAt === null;
}

// True while event i should react as a "bystander": some OTHER reached event
// is hovered (its description is opening) and i is on the roster itself.
function p7AxisOthersTarget(i) {
  if (p7AxisDescTarget(i)) return false;
  const st = P7_AXIS_EVENT_STATE[i];
  if (st.triggeredAt === null || st.leavingAt !== null) return false;
  return P7_AXIS_EVENTS.some((_, j) => j !== i && p7AxisDescTarget(j));
}

// Computes where event `ev`'s label actually renders — its tick's own x
// (the event's true date position on the axis, cached in p7AxisEventX —
// falls back to computing p7AxisX fresh if the cache hasn't been built
// yet, e.g. the very first frame) — and the label's rendered left/right
// extent given a near-edge alignment fallback (centered text would push past
// the canvas edge for an event anchored right at it, so it falls back to
// right/left alignment, extending only inward). Requires ctx.font already
// set to P7_AXIS_EVENT_FONT.
// Greedy word wrap of `text` into lines no wider than `maxWidth` (in whatever
// font ctx currently carries). A single word longer than the cap is left on its
// own over-long line rather than being broken mid-word. maxWidth null/0 → one
// line, unchanged. Hebrew bidi is handled by the canvas per drawn string, so
// wrapping on plain spaces and drawing each line separately keeps word order
// correct within every line.
function p7WrapLabel(ctx, text, maxWidth) {
  if (!maxWidth) return [text];
  const words = text.split(" ");
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const candidate = line ? line + " " + word : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function p7AxisEventBounds(ctx, ev, i, W) {
  const x = p7AxisEventX[i] !== undefined ? p7AxisEventX[i] : p7AxisEventTrueX(ev, i, W);
  const lines = p7WrapLabel(ctx, ev.label, p7AxisEventMaxWidth(ev));
  // The collision extent is the whole title+date BLOCK, not just the title:
  // the date renders in its own (narrower) font but centred on the same axis,
  // so for a short title it can be the wider of the two — measuring only the
  // title would let two blocks clear each other while their dates overlap.
  ctx.save();
  ctx.font = p7AxisDateFont();
  const dateWidth = ctx.measureText(p7FormatDateDMY(ev.date, ".")).width;
  ctx.restore();
  const textWidth = Math.max(
    dateWidth,
    ...lines.map((l) => ctx.measureText(l).width)
  );
  let align = "center", left, right;
  if (x + textWidth / 2 > W)      { align = "right"; left = x - textWidth; right = x; }
  else if (x - textWidth / 2 < 0) { align = "left";  left = x; right = x + textWidth; }
  else                             { left = x - textWidth / 2; right = x + textWidth / 2; }
  const lineX = align === "right" ? x - textWidth / 2
              : align === "left"  ? x + textWidth / 2
              : x;
  return { x, left, right, align, lineX, lines };
}

// Fires each event's one-shot animation the instant p7.currentDate reaches its
// date, regardless of how the user got there (slow scroll, fast flick, or a
// direct jump) — and un-fires it if they scroll back above that date. Requires
// p7.currentDate to have actually advanced past p7.minDate first: the pinned
// scrub section (page7UpdateFromScroll, js/page7-scrub.js) starts every visit at exactly
// t=0 → currentDate=minDate, before the user has scrolled within it at all —
// so a `>=` comparison would count minDate itself as "reached" on arrival,
// and any event dated at the dataset's very start (minDate is 2023-01-01;
// the first axis event is 2023-01-04) could show before any scrolling
// happened. The strict `>` guard requires real scroll progress. Every event,
// including the first, uses this same rule: date reached AND the fill edge
// has caught up to the drawn (xOffset-nudged) position — see the comment at
// the x test below. No special-cased extra delay for the first one.
function p7UpdateAxisEventTriggers(W) {
  const now0 = performance.now();
  // While the axis is UNDRAWING, every headline event that is still up is
  // leaving — including the last one, which would otherwise sit there fully
  // typed until the wipe's clip happened to cut it off (explicit instruction:
  // it should collapse). The reach test is skipped entirely on this path, since
  // the exit branches force currentDate to maxDate, which reads as "reached"
  // and would cancel the fade the frame after it started.
  if (p7AxisOutroStart !== null) {
    P7_AXIS_EVENT_STATE.forEach((state) => {
      if (state.triggeredAt !== null && state.leavingAt === null) {
        state.leavingAt = now0;
        p7StartAnimLoop();
      }
      if (state.leavingAt !== null && now0 - state.leavingAt >= P7_AXIS_EVENT_FADE_OUT_MS) {
        state.triggeredAt = null;
        state.leavingAt = null;
      }
    });
    return;
  }
  const curMs = new Date(p7.currentDate + "T00:00:00Z").getTime();
  const minMs = new Date(p7.minDate + "T00:00:00Z").getTime();
  const maxMs = new Date(p7.maxDate + "T00:00:00Z").getTime();
  const hasScrolled = curMs > minMs;
  const now = performance.now();
  P7_AXIS_EVENTS.forEach((ev, i) => {
    const state = P7_AXIS_EVENT_STATE[i];
    const evMs = new Date(ev.date + "T00:00:00Z").getTime();
    let reached, atDot = null;
    if (p7VerticalAxis()) {
      // Vertical: one rule for every event — the fill edge (bottom of
      // currentDate's rows) has come down to the event's own reach row (the
      // band's top in band mode, the dot's row in widen mode).
      // Symmetric: the same row opens it and closes it, so scrolling back past
      // an event collapses THAT event immediately (explicit instruction). The
      // old reverse hysteresis — an open headline held until the fill edge had
      // retreated to the PREVIOUS event's reach row — left a passed headline
      // sitting up through most of the way back; don't reintroduce it.
      const rows = p7.vert ? p7.vert.events : null;
      // atDot fires the FLY; `reached` (offset) fires the LEAVE. Two rows, two
      // triggers — see p7AxisFlyTrigger.
      atDot = hasScrolled && !!p7.vert && !!rows && p7CurRow() >= rows[i].reachRow;
      reached = hasScrolled && !!p7.vert && !!rows && p7CurRow() >= rows[i].reachRow + p7AxisTriggerRowOffset();
    } else if (evMs > maxMs) {
      // An event dated past the dataset's end has no date the scrub can ever
      // reach — clamping its compare date to maxDate fired it only on the one
      // final frame where currentDate === maxDate exactly, so in practice it
      // never showed. Instead it uses the same rule everything else does, just
      // expressed in x: reached once the growing fill edge has caught up to the
      // dot's actual DRAWN position (p7AxisEventTrueX — the clamped end of the
      // axis plus its xOffset gap). Time runs right → left, so "caught up"
      // is <=. Nudging its xOffset therefore moves when it appears, too.
      reached = hasScrolled && p7AxisX(p7.currentDate, W) <= p7AxisEventTrueX(ev, i, W);
    } else {
      // Besides the date, the fill edge must also have caught up to the dot's
      // DRAWN x — an event nudged LEFT by xOffset (the first one, −14) draws
      // later along the axis than its date, and its persistent circle
      // (p7DrawAxisEvents' `x >= curX`) grows in at that drawn position. Without
      // this the label faded in at the date while the circle was still ahead of
      // the fill. For rightward nudges the x test passes before the date does,
      // so the date still governs and nothing changes.
      reached = hasScrolled && curMs >= evMs
        && p7AxisX(p7.currentDate, W) <= p7AxisEventTrueX(ev, i, W);
    }
    // The fly is its own trigger on its own row; null atDot (the horizontal
    // axis) falls back to the leave signal so nothing changes off this path.
    if (isMobile()) p7AxisFlyTrigger(i).trigger((atDot === null ? reached : atDot) ? 1 : 0);
    if (reached) {
      if (state.triggeredAt === null) {
        state.triggeredAt = now;
        state.leavingAt = null;
        p7AxisCardTrigger(i).trigger(1);
        p7StartAnimLoop();
      } else if (state.leavingAt !== null) {
        // Scrolled forward again before this event's own reverse fade-out
        // finished — cancel it, same reversible-mid-flight convention as
        // everywhere else in the project.
        state.leavingAt = null;
        p7AxisCardTrigger(i).trigger(1);
      }
    } else if (state.triggeredAt !== null && state.leavingAt === null) {
      state.leavingAt = now;
      p7AxisCardTrigger(i).trigger(0);
      p7StartAnimLoop();
    }
  });
  // Once a leaving event's own reverse fade-out has fully played out, forget
  // it entirely — otherwise it would linger in P7_AXIS_EVENT_STATE forever at
  // opacity 0 instead of being eligible to fade back in cleanly next time.
  P7_AXIS_EVENT_STATE.forEach((state) => {
    // Keyed to the trigger's own duration now, not the old fade constant: the
    // state must not be forgotten while its beat is still playing out.
    if (state.leavingAt !== null && now - state.leavingAt >= (isMobile() ? p7AxisCardMs() : P7_AXIS_EVENT_FADE_OUT_MS)) {
      state.triggeredAt = null;
      state.leavingAt = null;
    }
  });
}

// How long a card's arrive/leave beat runs. manual/ pick 2026-09-12.
const P7_AXIS_CARD_MS_MOBILE = 480;
function p7AxisCardMs() { return P7_AXIS_CARD_MS_MOBILE; }
// TWO INDEPENDENT TRIGGERS per axis event, fired at two different rows:
//
//   FLY   — fired by reaching the DOT (reachRow, no offset). The plaque glides
//           from beside the dot to above it, and the marker recolours to black.
//   LEAVE — fired at reachRow + P7_AXIS_TRIGGER_ROW_OFFSET. The card leaves
//           (P7_AXIS_LEAVE_MODE: collapses into its dot).
//
// Not one trigger sliced into two windows: the offset knob has to move the
// LEAVE point without dragging the fly with it, which a single clock can't do.

// One house makeTrigger PER axis event — a fixed-duration 0<->1 beat fired by
// the reach CROSSING, exactly like every other fold animation on the page.
//
// It replaces a wall-clock ramp read off `triggeredAt`/`leavingAt`, which was
// re-derived from the live fill edge every frame and so behaved as a SCRUB:
// nudging the scroll back and forth around an event's own row dragged its card
// in and out with the scroll instead of playing one beat. Built lazily because
// makeTrigger lives in js/groups.js, which project.html loads after this file.
const p7AxisCardTrigs = [], p7AxisFlyTrigs = [];
// The LEAVE trigger — fired at reachRow + P7_AXIS_TRIGGER_ROW_OFFSET.
function p7AxisCardTrigger(i) {
  if (!p7AxisCardTrigs[i]) {
    p7AxisCardTrigs[i] = makeTrigger(() => p7AxisCardMs(), () => p7StartAnimLoop());
  }
  return p7AxisCardTrigs[i];
}
// The FLY trigger — fired by reaching the dot itself.
function p7AxisFlyTrigger(i) {
  if (!p7AxisFlyTrigs[i]) {
    p7AxisFlyTrigs[i] = makeTrigger(() => p7AxisCardMs(), () => p7StartAnimLoop());
  }
  return p7AxisFlyTrigs[i];
}

// A card's 0..1 presence — the trigger's eased progress, nothing else. Reversing
// mid-flight covers only the remaining distance, per the house convention.
function p7AxisEventOpacity(i, now) {
  // DESKTOP keeps the original wall-clock ramp off triggeredAt/leavingAt. Only
  // mobile moved to the trigger — the compare/manual pass that asked for it ran
  // under the 600px breakpoint and desktop was never part of it.
  if (!isMobile()) {
    const state = P7_AXIS_EVENT_STATE[i];
    if (state.triggeredAt === null) return 0;
    let opacity = Math.min(1, (now - state.triggeredAt) / p7AxisFadeInMs());
    if (state.leavingAt !== null) {
      const fadeOut = 1 - (now - state.leavingAt) / P7_AXIS_EVENT_FADE_OUT_MS;
      opacity = Math.min(opacity, Math.max(0, fadeOut));
    }
    return opacity;
  }
  return p7AxisFlyTrigger(i).currentT();
}
// Reaching the dot: the plaque glides beside -> above, the marker recolours.
function p7AxisFlyT(i)   { return p7AxisFlyTrigger(i).currentT(); }
// The trigger point: the card leaves.
function p7AxisLeaveT(i) { return p7AxisCardTrigger(i).currentT(); }

function p7DrawAxisEvents(ctx, W, axisY, curX, hoverActive, highlightX) {
  p7UpdateAxisEventTriggers(W);
  const now = performance.now();
  ctx.save();
  ctx.font = p7AxisEventFont();
  ctx.textBaseline = "alphabetic";

  // Persistent circle markers: every event the growing edge has reached keeps a
  // circle on the axis even after its headline label has crossfaded away (per
  // the "keep its circle on the axis, upon hover it reappears" requirement).
  // "Reached" is tied to the current fill edge (event x >= curX), so a circle
  // appears the moment scroll passes its date and disappears again if the user
  // scrolls back above it — the same reached/unreached signal the year rings use.
  // The circles are drawn here (rather than only per-visible-entry below) and
  // their positions cached for p7HoverInit's hit-test. hoveredAxisEvent's own
  // circle is highlighted; while a timeline square is hovered elsewhere
  // (hoverActive) they all dim like the rest of the axis.
  p7.axisEventPositions = new Map();
  const hoveredAxisEvent = p7.hoveredAxisEvent;
  // Eased once per frame, before anything reads it below.
  const rosterTarget = hoverActive ? 1 : 0;
  p7AxisRosterT += (rosterTarget - p7AxisRosterT) * P7_AXIS_HOVER_ANIM_SPEED;
  if (Math.abs(rosterTarget - p7AxisRosterT) < 0.001) p7AxisRosterT = rosterTarget;
  P7_AXIS_EVENTS.forEach((ev, i) => {
    const x = p7AxisEventX[i] !== undefined ? p7AxisEventX[i] : p7AxisEventTrueX(ev, i, W);
    const reached = x >= curX;
    const state = P7_AXIS_EVENT_STATE[i];
    // Ease presence rather than switching it: scrolling back up now shrinks the
    // dot away over the same handful of frames it grew in over, instead of
    // deleting it mid-fade. Below ~0 it stops drawing (and stops being
    // hit-testable) entirely.
    const reachedTarget = reached ? 1 : 0;
    state.reachedT += (reachedTarget - state.reachedT) * P7_AXIS_HOVER_ANIM_SPEED;
    if (Math.abs(reachedTarget - state.reachedT) < 0.001) state.reachedT = reachedTarget;
    if (!reached) state.hoverT = 0;
    if (state.reachedT <= 0.001 && !p7AxisMarkerUnreached()) return;
    const isAxisHovered = hoveredAxisEvent === ev;
    // Ease hoverT toward its target (1 hovered, 0 not) once per frame — this is
    // what makes the hover grow/shrink animate instead of snap.
    const hoverTarget = isAxisHovered ? 1 : 0;
    state.hoverT += (hoverTarget - state.hoverT) * P7_AXIS_HOVER_ANIM_SPEED;
    if (Math.abs(hoverTarget - state.hoverT) < 0.001) state.hoverT = hoverTarget;
    // The circle shrinks as its label crossfades away, and grows back to full
    // size when the label is showing (freshly reached / mid-crossfade) or the
    // circle itself is hovered — so a faded event reads as a smaller dot until
    // pointed at. "Prominence" (0 faded → 1 full) is the larger of the label's
    // own opacity and the eased hover amount, interpolating the radius between
    // P7_AXIS_MARKER_RADIUS_FADED and P7_AXIS_MARKER_RADIUS.
    // The roster SHRINKS every dot rather than growing any: while a square is
    // hovered, all the axis circles read small and equal — including the one
    // whose label is currently showing at full size — so the revealed labels
    // are the only thing the roster adds, and nothing competes with the square
    // actually being hovered. Scaled by (1 - p7AxisRosterT) so the shrink and
    // its regrow animate rather than snap.
    const prominence = Math.max(p7AxisEventOpacity(i, now), state.hoverT) * (1 - p7AxisRosterT);
    const markerRadius = (P7_AXIS_MARKER_RADIUS_FADED +
      (P7_AXIS_MARKER_RADIUS - P7_AXIS_MARKER_RADIUS_FADED) * prominence) * state.reachedT;
    p7.axisEventPositions.set(ev, { x, y: axisY, radius: markerRadius });
    // Wipe the line under the marker back to the frame background (see the
    // per-visible dot below for why), then fill. The wipe tracks the CURRENT
    // radius, not the full one: a fixed full-size hole left the line gapped
    // under a shrinking dot and then healed it in a single frame the moment the
    // dot vanished. Scaling it means the line closes back up continuously as the
    // dot shrinks. Safe because the canvas is fully repainted every frame, so
    // there are no leftover pixels from the previous, larger dot to cover.
    ctx.fillStyle = "#FDFCFF";
    ctx.beginPath();
    // The +1 breathing room is scaled by reachedT too — left at a flat +1 it was
    // still a 2px hole in the line at radius 0, which then closed in one frame.
    ctx.arc(x, axisY, markerRadius + state.reachedT, 0, Math.PI * 2);
    ctx.fill();
    const color = hoverActive
      ? (highlightX !== null && x === highlightX ? P7_AXIS_HOVER_COLOR : P7_AXIS_BG_COLOR)
      : (isAxisHovered ? P7_AXIS_HOVER_COLOR : P7_AXIS_FILLED_COLOR);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, axisY, markerRadius, 0, Math.PI * 2);
    ctx.fill();
  });

  // Collect all currently-visible entries with their horizontal extents so we
  // can detect overlap and nudge colliding labels before drawing anything. An
  // event whose persistent circle is hovered is forced visible at full opacity
  // even if its label had already crossfaded away.
  const visible = [];
  P7_AXIS_EVENTS.forEach((ev, i) => {
    // The eased hover amount re-shows a faded label (and holds it while the
    // hover fades back out), so include any event whose hoverT is still lifting
    // its opacity — not just currently-triggered ones.
    // While a regular timeline square is hovered (hoverActive), every ALREADY
    // REACHED headline event's label is forced on, not just the one currently
    // crossfading — the hover turns the axis into a reference key for reading
    // where that square sits among the headlines so far. Events the scrub has
    // not passed yet stay hidden: the roster must never spoil what is still
    // ahead. "Reached" is the trigger state's own definition (triggeredAt set
    // and not currently reversing out), so scrolling back un-reveals in step.
    // They render at the same faint state3 alpha as the rest of the dimmed axis
    // (see labelAlpha below) — a quiet roster, not seven full-black labels.
    const st = P7_AXIS_EVENT_STATE[i];
    const rosterOn = st.triggeredAt !== null && st.leavingAt === null;
    const opacity = Math.max(
      p7AxisEventOpacity(i, now),
      st.hoverT,
      rosterOn ? p7AxisRosterT : 0
    );
    if (opacity <= 0) return;
    const { x, left, right, lineX, lines } = p7AxisEventBounds(ctx, ev, i, W);
    visible.push({ ev, i, x, lineX, left, right, opacity, lines, textWidth: right - left });
  });

  // When two labels' horizontal extents collide, shift the older one
  // sideways — away from the newer one — rather than stacking it to a second
  // vertical tier above. A fast flick-scroll can cross several event dates
  // within a single frame (p7UpdateAxisEventTriggers gives them all the same
  // triggeredAt), so more than 2 labels can be visible at once — resolved
  // newest-first: the most recently triggered label keeps its natural
  // position, and each older label is pushed away from *every*
  // already-placed (newer) label it collides with, chained rather than
  // pairwise, so two older labels shifted toward the same side don't just
  // land on top of each other instead.
  // MOBILE: the headline text does not travel with its dot. There is no room on
  // a phone-width axis for a title block to sit over its own date position —
  // de-collision just shoved blocks to the edges and the reading order stopped
  // matching the axis. Instead every headline prints in ONE fixed slot centred
  // on the canvas, and only the dot marks where on the axis it happened (drawn
  // in the persistent-circle pass above, untouched by this).
  //
  // One slot means one label: a fast flick can trigger several events in the
  // same frame, and at full opacity they would print on top of each other. Only
  // the most recently triggered visible entry is kept — the older ones are the
  // ones the scrub has already passed, and their dots still stand on the axis.
  if (isMobile()) {
    if (visible.length > 1) {
      const firedAt = (e) => {
        const t = P7_AXIS_EVENT_STATE[e.i].triggeredAt;
        return t === null || t === undefined ? -Infinity : t;
      };
      let best = visible[0];
      for (const e of visible) {
        if (firedAt(e) > firedAt(best) || (firedAt(e) === firedAt(best) && e.i > best.i)) best = e;
      }
      visible.length = 0;
      visible.push(best);
    }
    visible.forEach((e) => {
      e.lineX = W / 2;
      e.left  = W / 2 - e.textWidth / 2;
      e.right = W / 2 + e.textWidth / 2;
    });
  } else {
    const OVERLAP_PAD = 8; // minimum horizontal clearance between labels
    for (let idx = visible.length - 1; idx >= 0; idx--) {
      const entry = visible[idx];
      let { left, right } = entry;
      let moved = true, guard = 0;
      while (moved && guard++ < visible.length) {
        moved = false;
        for (let j = idx + 1; j < visible.length; j++) {
          const p = visible[j];
          if (right + OVERLAP_PAD < p.left || p.right + OVERLAP_PAD < left) continue;
          if (entry.x >= p.x) { left = p.right + OVERLAP_PAD; right = left + entry.textWidth; }
          else                { right = p.left - OVERLAP_PAD; left = right - entry.textWidth; }
          moved = true;
        }
      }
      // Re-clamp after shifting: without this a block pushed toward an edge can
      // run off the canvas, and the next one then lands on top of what is
      // visually pinned at that edge instead of clearing it.
      if (left < 0)      { left = 0; right = entry.textWidth; }
      else if (right > W) { right = W; left = W - entry.textWidth; }
      entry.left = left; entry.right = right;
      entry.lineX = (left + right) / 2;
    }
  }

  visible.forEach((entry) => {
    const { ev, lineX, opacity, lines } = entry;
    const yOff = p7AxisEventLabelOffset();
    // Every line is centred on the block's own centre (lineX) rather than
    // anchored to the event's real x — lineX is recomputed from left/right
    // after de-collision, so it stays correct however far a collision above
    // has pushed the block from its anchor, and it keeps a wrapped title's
    // lines centred on each other and on the date below them.
    ctx.textAlign = "center";

    // In state3 (a dot elsewhere is hovered), the label dims to the same
    // faint alpha as every other non-highlighted axis element — unless this
    // very event's own marker is the one being highlighted (see markerColor
    // below), in which case it stays fully visible.
    const isHoverHighlighted = hoverActive && highlightX !== null && lineX === highlightX;
    const labelAlpha = (hoverActive && !isHoverHighlighted) ? P7_AXIS_ROSTER_LABEL_ALPHA : 1;
    ctx.font = p7AxisEventFont();
    ctx.fillStyle = `rgba(0, 0, 0, ${labelAlpha * opacity})`;
    // Wrapped lines stack UPWARD: the LAST line keeps the single-line baseline
    // (axisY - yOff) so the date underneath never moves, and earlier lines are
    // lifted a line-height each above it.
    lines.forEach((text, li) => {
      const y = axisY - yOff - (lines.length - 1 - li) * p7AxisEventLineHeight();
      ctx.fillText(text, lineX, y);
    });

    // Date below the label — same color as the axis's own reached year labels
    // (P7_AXIS_LABEL_COLOR, via globalAlpha rather than string-parsing its
    // own alpha, same pattern as the marker circle below). In state3, dims to
    // the exact same faint alpha as the label above it (rather than a
    // proportional dim of its own already-lighter color, which would land
    // dimmer than the label instead of matching it).
    const dateLabel = p7FormatDateDMY(ev.date, ".");
    ctx.font = p7AxisDateFont();
    ctx.textAlign = "center";
    ctx.fillStyle = (hoverActive && !isHoverHighlighted) ? `rgba(0, 0, 0, ${P7_AXIS_ROSTER_LABEL_ALPHA})` : P7_AXIS_LABEL_COLOR;
    ctx.globalAlpha = opacity;
    ctx.fillText(dateLabel, lineX, axisY - yOff + p7AxisDateOffset());
    ctx.globalAlpha = 1;
    // The event's own FILLED dot on the line is drawn once, up front, in the
    // persistent-circle pass above (it stays put whether or not this label is
    // showing) — nothing to redraw here.
  });

  ctx.restore();
}

// A headline event's tick/label position (see p7AxisEventBounds) — each
// event's true date x along the continuous line (no dot-snapping now that the
// line is solid rather than a row of discrete dots). Keyed by index into
// P7_AXIS_EVENTS; rebuilt fresh every frame, so a resize or date-range change
// can't leave a stale snap behind.
let p7AxisEventX = [];

// An event's rendered x = its true date position plus its own optional
// `xOffset` (screen px, − = left / later on this RTL axis, + = right). The
// offset is PURELY a rendering nudge to keep a dot from crowding a year ring
// it happens to land next to — `date` stays the truthful one and is what
// every trigger, the printed date label, and the crossfade order still use.
// Dot and label both read this, so they never separate.
function p7AxisEventTrueX(ev, i, W) {
  // An event dated past p7.maxDate (the dataset's last event) has no position
  // of its own on the line — p7AxisX would put it beyond the left end, floating
  // off the axis. Clamped to the span so it parks AT the end instead; give it an
  // xOffset to hold a gap there. Its printed date stays the real one.
  const x = Math.min(Math.max(p7AxisX(ev.date, W), p7AxisMargin()), W - p7AxisMargin());
  return x + (ev.xOffset || 0);
}

function p7DrawYearAxis(ctx, W, H) {
  if (p7VerticalAxis()) return p7DrawYearAxisVertical(ctx, W, H);
  const ticks = p7AxisYearTicks();
  const rawCurX = p7AxisX(p7.currentDate, W);

  // A tick is "reached" once the growing edge has caught up to (or passed) its
  // x position — the start tick is always reached by definition.
  const visible = ticks.filter((tick, i) => i === 0 || p7AxisX(tick.dateStr, W) >= rawCurX);

  // Snapped onto the device-pixel grid for the same reason p7DrawSideSquares
  // snaps its squares: at ~4px radius the ring markers are small enough that a
  // fractional center smears their 1px stroke across two device-pixel rows,
  // and on a display whose DPR isn't a whole number that happens on every
  // frame — the circles read soft next to the same page on a 1x/2x screen.
  const axisDpr = window.devicePixelRatio || 1;
  const axisQ   = v => Math.round(v * axisDpr) / axisDpr;
  const axisY   = axisQ(H * p7AxisYFrac());
  ctx.save();

  // Build-in wipe (p7AxisIntroT, triggered by p7AxisTriggerIfNeeded) — clips
  // everything this function draws (line, markers, labels, headline events alike) to
  // [revealX, right edge] so the whole axis reveals right to left on its own
  // clock the first time it appears, starting from the same right-edge anchor
  // (p7.minDate/"2023") the scroll-driven fill above grows from. A no-op once
  // the wipe finishes (revealX reaches the left edge) or if it's not playing.
  const introT = p7AxisIntroT();
  if (introT < 1) {
    const rightEdge = W - p7AxisMargin();
    const leftEdge   = p7AxisMargin();
    const revealX = rightEdge - p7Ease(introT) * (rightEdge - leftEdge);
    ctx.beginPath();
    ctx.rect(revealX, 0, W - revealX, H);
    ctx.clip();
  }

  // The axis spans from p7.minDate's anchor (the right edge, "2023") to the
  // left margin (p7.maxDate). Year labels now sit BELOW the line, so the line
  // is one uninterrupted span with no label-clearance gaps — the fill can
  // start right at the right anchor rather than past a "2023" label's width.
  const rightAnchorX = p7AxisX(ticks[0].dateStr, W); // == W - P7_AXIS_MARGIN, the p7.minDate ("2023") end
  const leftEdgeX    = p7AxisMargin();

  // Scroll-driven fill edge — the same lagged frac (0 at p7.minDate, 1 at
  // p7.maxDate) as before, mapped straight across the full span now that
  // there's no first-dot offset to rescale past. fillFrac is lagged
  // (p7AxisUpdateFillLag), not the raw scroll value, so the fill trails a beat
  // behind rather than snapping to scroll 1:1.
  const fillFrac = p7AxisUpdateFillLag();
  const curX = rightAnchorX - fillFrac * (rightAnchorX - leftEdgeX);

  // Events (and the hover highlight) render at their true date x on the
  // continuous line — no dot-snapping now that the line is solid, not a row of
  // discrete dots. p7AxisEventX is read by p7AxisEventBounds below.
  p7AxisEventX = P7_AXIS_EVENTS.map((ev, i) => p7AxisEventTrueX(ev, i, W));
  // The mobile picker counts as a hover here — a loupe-picked dot marks its
  // date on the axis with the same state-3 treatment desktop hover gets — but
  // only WHILE the finger is down (dragging), same gating as the selection
  // halo: it's an aiming aid, and the axis returns to normal on release even
  // though the selection itself persists in the docked frame.
  const hoveredEvent = p7.hoveredEvent || (p7Inspect.dragging ? p7Inspect.event : null);
  const hoverActive  = !!hoveredEvent;
  const hoverAxisX   = hoverActive ? p7AxisX(hoveredEvent.date, W) : null;

  // The line itself: one faint full-span base drawn first, then the dark
  // "reached" portion grown right-to-left from the right anchor to curX laid
  // on top — so it reads as a single line filling up, not a faint line with a
  // separate dark one beside it. While a dot elsewhere is hovered, the fill
  // dims (see below) and the hovered event's own marker pops instead
  // (p7DrawAxisEvents).
  const lineTop = axisY - P7_AXIS_LINE_THICKNESS / 2;
  ctx.fillStyle = hoverActive
    ? `rgba(0, 0, 0, ${P7_AXIS_UNFILLED_HOVER_ALPHA})`
    : P7_AXIS_BG_COLOR;
  ctx.fillRect(leftEdgeX, lineTop, rightAnchorX - leftEdgeX, P7_AXIS_LINE_THICKNESS);
  // In state3 (hover elsewhere) the filled span doesn't vanish into the faint
  // line — it dims to the same lifted alpha the roster labels use, so how far
  // the timeline has filled stays readable under the hover.
  ctx.fillStyle = hoverActive
    ? `rgba(0, 0, 0, ${P7_AXIS_ROSTER_LABEL_ALPHA})`
    : P7_AXIS_FILLED_COLOR;
  ctx.fillRect(curX, lineTop, rightAnchorX - curX, P7_AXIS_LINE_THICKNESS);

  // Hollow ring marker on the line at each year tick — faint until the growing
  // edge reaches it, then dark (same reached/unreached signal the labels use).
  // The line behind each ring is punched back to the frame background first so
  // the marker reads as a clean hollow O, not a filled disc with the line
  // showing through. In state3 (hover), every ring goes faint; the hovered
  // event's own position is drawn as a filled dot by p7DrawAxisEvents instead.
  const reachedTicks = new Set(visible);
  for (const tick of ticks) {
    const x = axisQ(p7AxisX(tick.dateStr, W));
    const ringColor = hoverActive
      ? P7_AXIS_BG_COLOR
      : (reachedTicks.has(tick) ? P7_AXIS_FILLED_COLOR : P7_AXIS_BG_COLOR);
    ctx.fillStyle = "#FDFCFF";
    ctx.beginPath();
    ctx.arc(x, axisY, P7_AXIS_MARKER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth   = P7_AXIS_MARKER_STROKE;
    ctx.strokeStyle = ringColor;
    ctx.beginPath();
    ctx.arc(x, axisY, P7_AXIS_MARKER_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Year labels centered directly below each ring. Every label shows from the
  // start — but, like the line, stays faint until scroll actually reaches it,
  // then switches to the darker color. In state3, every label (reached or not)
  // drops to the same faint alpha as the dimmed axis event label/date.
  ctx.font = `${isMobile() ? 14 : 18}px 'Assistant', sans-serif`;
  ctx.textAlign    = "center";
  ctx.textBaseline = "top";
  const labelY = axisY + P7_AXIS_MARKER_RADIUS + p7AxisYearLabelOffset();
  for (const tick of ticks) {
    ctx.fillStyle = hoverActive
      ? `rgba(0, 0, 0, ${P7_AXIS_BG_ALPHA})`
      : (reachedTicks.has(tick) ? P7_AXIS_LABEL_COLOR : P7_AXIS_LABEL_FAINT_COLOR);
    ctx.fillText(String(tick.year), p7AxisX(tick.dateStr, W), labelY);
  }
  ctx.restore();

  p7DrawAxisEvents(ctx, W, axisY, curX, hoverActive, hoverAxisX);

  // Hovering any timeline square marks that event's own date on the axis with a
  // filled circle in its group color (p7ActorColor) — a positional read-out of
  // where the hovered dot falls in time. Drawn last so it sits on top of the
  // (dimmed, state3) line/rings/event dots. Punch the line back to the frame
  // background first so the marker reads as a clean disc, same as every other
  // axis marker.
  if (hoverActive) {
    ctx.save();
    ctx.fillStyle = "#FDFCFF";
    ctx.beginPath();
    ctx.arc(axisQ(hoverAxisX), axisY, P7_AXIS_MARKER_RADIUS + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p7ActorColor(hoveredEvent.actor);
    ctx.beginPath();
    ctx.arc(axisQ(hoverAxisX), axisY, P7_AXIS_MARKER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/* ---- VERTICAL AXIS drawing (desktop) ---------------------------------------
   The vertical counterpart of p7DrawYearAxis above: same colours, radii,
   fonts, fill lag, hover states and headline fade logic, laid out top → bottom
   at x = W/2. Year labels sit directly under their ring, centred on the line;
   headline blocks (title lines + date) hang under their dot, centred on the
   line, in the band / opened corridor. No de-collision — the layout already
   reserves the space (bands are empty rows; widen blocks the inner cells).
   ------------------------------------------------------------------------- */
const P7_VERT_EVENT_LINE_ALPHA  = 0.18; // A2 rule across the camps
const P7_VERT_EVENT_TEXT_GAP    = 6;    // px between the dot's edge and the title's first line
const P7_VERT_YEAR_LABEL_GAP    = 6;    // px between a year ring and its label
// Years beside the line only: the FIRST year's ring (and digits) sit this many
// px ABOVE the line's top (row 0) instead of on it, and the line extends up to
// the ring. The first headline event (2023-01-04) lands 3 days — a fraction of
// a row — under row 0, so a ring ON the top end collided with its dot.
const P7_VERT_FIRST_YEAR_RAISE_PX = 14;
// Extra header space reserved above row 0 on mobile when the first event is
// `mobileAbove`: its plaque stands above the dot, so the year label has to clear
// the PLAQUE, not just the ring, or the card prints straight over "2023".
// A flat constant rather than a measured height on purpose — p7VertYearHeaderH
// feeds the square solve and p7VertTopY, so it has to be stable geometry, not a
// per-frame text measurement that changes as a label wraps.
const P7_VERT_FIRST_EV_HEADROOM_PX = 34;
// True when this event should be pinned above its dot instead of beside it.
// MOBILE ONLY — desktop's side plaques are unaffected.
function p7AxisEvMobileAbove(ev) { return isMobile() && !!ev && !!ev.mobileAbove; }
// Does the roster have such an event at all? (Drives the header reserve above.)
function p7AxisHasMobileAbove() {
  return isMobile() && P7_AXIS_EVENTS.some((ev) => ev.mobileAbove);
}
const P7_AXIS_DOT_CATCHUP_PX    = 80;   // px of axis over which the fill edge, having skipped a headline circle/card, eases back into step with the true edge
// Per headline event, the axis span its circle currently occupies — the dot
// alone (±R) while closed, the whole open card while the circle has opened
// into one (the card's dot-facing edge sits on the dot centre; its far edge
// travels). Written by p7DrawAxisEventsVertical each frame, read by the next
// frame's p7DrawYearAxisVertical so the fill skips it. null = dot only.
const p7AxisEventSpans = [];
// Per-event vertical offset (px) of a side plaque that slid off its date to
// clear a year label; the dot pass applies it so the dot follows the card.
const p7SideCardDy = [];

function p7DrawYearAxisVertical(ctx, W, H) {
  if (!p7.vert) return;
  const v      = p7.vert;
  const ticks  = p7AxisYearTicks();
  const yearSpans = []; // filled below; the headline blocks dodge these
  const axisDpr = window.devicePixelRatio || 1;
  const axisQ   = x => Math.round(x * axisDpr) / axisDpr;
  const axisX   = axisQ(W / 2);
  const topY    = p7VertTopY(H);
  const len     = v.totalRows * p7.CELL;
  const botY    = topY + len;
  const clipped = p7VertClipToBox(ctx, W, H); // line + years only; the headline slot draws unclipped
  ctx.save();

  const introT = p7AxisIntroT();

  const fillFrac = p7AxisUpdateFillLag();
  const curY     = topY + fillFrac * len;
  const curRow   = p7CurRow();

  const hoveredEvent = p7.hoveredEvent || (p7Inspect.dragging ? p7Inspect.event : null);
  const hoverActive  = !!hoveredEvent;
  const hoverAxisY   = hoverActive ? axisQ(p7AxisY(hoveredEvent.date, H)) : null;

  // Year marker geometry: each year's block (digits, plus ring above them when
  // on) is centred on the line at its 1 January row boundary, and the line
  // breaks around it by `yearGapPad` on both sides.
  const ring   = p7V().yearRing;
  const R      = ring ? P7_AXIS_MARKER_RADIUS : 0;
  const blockH = (ring ? R * 2 + P7_VERT_YEAR_LABEL_GAP : 0) + (p7V().yearLabelPx + 3);
  const pad    = p7V().yearGapPad;
  // Years beside the line (yearSide 'left'/'right'): the line never breaks —
  // every 1 January, the first included, is a ring sitting ON the line at its
  // row boundary (the first year's ring caps the line's top end), and the
  // digits hang beside it. `top`/`bottom` are then the ring alone.
  const sideYears = p7V().yearSide !== 'center';
  const marks  = ticks.filter(t => v.yearRow.has(t.year)).map(t => {
    const row = v.yearRow.get(t.year);
    if (sideYears) {
      const yc = axisQ(p7RowY(row, H) - (row === 0 ? P7_VERT_FIRST_YEAR_RAISE_PX : 0));
      return { tick: t, row, yc, top: yc - R, bottom: yc + R };
    }
    // The first year (its 1 January is row 0, the line's top) sits as a header
    // ABOVE the line instead of breaking it: the line alone is the time count,
    // so an event on the first days of the range lands on the line, not in a
    // label gap. Its block hangs `yearGapPad` above topY.
    // Row 0 also clears the first event's plaque when that plaque is pinned
    // above its dot (mobileAbove): the dot is only days off the top of the axis,
    // so the card lands in exactly the band this label wants. The lift is the
    // same P7_VERT_FIRST_EV_HEADROOM_PX that p7VertYearHeaderH already reserved,
    // so the year ends up ABOVE the card and nothing else moves.
    const firstLift = row === 0 && p7AxisHasMobileAbove() ? P7_VERT_FIRST_EV_HEADROOM_PX : 0;
    const yc  = row === 0 ? axisQ(topY - pad - blockH / 2 - firstLift) : axisQ(p7RowY(row, H));
    return { tick: t, row, yc, top: yc - blockH / 2 - pad, bottom: yc + blockH / 2 + pad };
  });

  // Build-in wipe, top → bottom (same clock as the horizontal wipe).
  if (introT < 1) {
    ctx.beginPath();
    ctx.rect(0, 0, W, topY + p7Ease(introT) * len);
    ctx.clip();
  }

  // Base line + filled portion from the top, drawn only between the year
  // breaks (one unbroken run when the years sit beside the line).
  const lineLeft = axisX - P7_AXIS_LINE_THICKNESS / 2;
  const segs = [];
  // Side years: one unbroken run, starting at the raised first ring's centre.
  let segTop = sideYears && marks.length && marks[0].row === 0 ? marks[0].yc : topY;
  if (!sideYears) marks.forEach(m => {
    if (m.top > segTop) segs.push([segTop, m.top]);
    segTop = Math.max(segTop, m.bottom);
  });
  if (botY > segTop) segs.push([segTop, botY]);
  // The headline-event circles are not axis length: the instant the true
  // edge touches a circle's top the DRAWN edge appears at its bottom and
  // keeps moving, so no scroll is spent crossing the diameter. It then eases
  // back into step with the true edge over the next P7_AXIS_DOT_CATCHUP_PX
  // (running at catchup/(2R+catchup) of scroll speed), so nothing below is
  // offset for good. Pure function of curY — reverse scroll retraces it
  // exactly, jumping back out at the top the same way.
  // The span skipped is whatever the circle is right now: the dot alone, or
  // the card it has opened into (p7AxisEventSpans) — the fill enters at the
  // card's top edge and comes out under it at once, growing with the card.
  let fillY = curY;
  const C = P7_AXIS_DOT_CATCHUP_PX;
  // While the axis is UNDRAWING the dots shrink away on the cards' fade clock
  // (outroShrink, same formula as the dot draw below). The skipped spans
  // shrink with them: a full-size gap around a dot that is already gone left
  // the grey base line showing through as a lighter patch where the circle was.
  const spanShrink = p7AxisOutroStart === null ? 1
    : 1 - p9Ease(Math.min(1, (performance.now() - p7AxisOutroStart) / P7_AXIS_EVENT_FADE_OUT_MS));
  const dotR = P7_AXIS_MARKER_RADIUS * spanShrink;
  const dotSpans = P7_AXIS_EVENTS.map((ev, i) => {
    const y = p7RowY(v.events[i].row, H), sp = p7AxisEventSpans[i];
    // The span always starts at the dot's top: a card that opens ABOVE its
    // dot sits on line the fill has already passed, so it must not shove the
    // drawn edge forward when it appears — only card below the dot is skipped.
    const cardExtra = sp ? Math.max(0, sp.bottom - (y + P7_AXIS_MARKER_RADIUS)) * spanShrink : 0;
    return [y - dotR, y + dotR + cardExtra];
  }).sort((p, q) => p[0] - q[0]);
  dotSpans.forEach(([top, bottom]) => {
    const gap = bottom - top;
    if (fillY > top && fillY < top + gap + C) fillY = top + gap + (fillY - top) * C / (gap + C);
  });
  // The filled line is never painted inside a circle's span: the circle grows
  // in over a few frames after the fill reaches it, and a dark line showing
  // through the half-grown dot read as the fill "running through" it. The
  // grey base line stays continuous so unreached circles aren't given away.
  segs.forEach(([a, b]) => {
    ctx.fillStyle = hoverActive ? `rgba(0, 0, 0, ${P7_AXIS_UNFILLED_HOVER_ALPHA})` : P7_AXIS_BG_COLOR;
    ctx.fillRect(lineLeft, a, P7_AXIS_LINE_THICKNESS, b - a);
    if (fillY > a) {
      ctx.fillStyle = hoverActive ? `rgba(0, 0, 0, ${P7_AXIS_ROSTER_LABEL_ALPHA})` : P7_AXIS_FILLED_COLOR;
      let from = a;
      const to = Math.min(fillY, b);
      dotSpans.forEach(([t, u]) => {
        if (u <= from || t >= to) return;
        if (t > from) ctx.fillRect(lineLeft, from, P7_AXIS_LINE_THICKNESS, t - from);
        from = Math.max(from, u);
      });
      if (to > from) ctx.fillRect(lineLeft, from, P7_AXIS_LINE_THICKNESS, to - from);
    }
  });

  // Year rings + labels. A tick is reached once the fill edge is past its row.
  ctx.font = `${p7V().yearLabelWeight || 400} ${p7V().yearLabelPx}px 'Assistant', sans-serif`;
  ctx.textAlign = "center";
  // measureText's ink boxes are relative to the CURRENT baseline — measure
  // under 'alphabetic' (under 'top' the first label's ascent came back wrong
  // and it drew ~14px too high; later labels measured right only because the
  // loop below had already switched the baseline).
  ctx.textBaseline = "alphabetic";
  // The year rings + digits leave WITH the axis event cards, on the cards' own
  // outro clock (spanShrink, below), not by waiting for the reverse wipe to
  // reach them: the first year is drawn as a header at the very TOP of the
  // span, which the wipe consumes LAST, so it stood alone on an empty screen
  // for the whole outro and then snapped off. Rings shrink (they are markers),
  // digits fade (text — allowed).
  ctx.globalAlpha *= spanShrink;
  const yearR = P7_AXIS_MARKER_RADIUS * spanShrink;
  for (const m of marks) {
    const { tick, row } = m;
    // Ring (when on) at the top of the centred block; with the ring off R is
    // 0 so the label maths below (digits hung off the ring's edge) still hold.
    // Ring on: the ring sits at the top of the centred block; ring off: the
    // digits alone are centred on the boundary.
    const y   = ring && p7V().yearSide === 'center' ? axisQ(m.yc - blockH / 2 + R) : m.yc;
    const reached = row <= curRow;
    const ringColor = hoverActive ? P7_AXIS_BG_COLOR : (reached ? P7_AXIS_FILLED_COLOR : P7_AXIS_BG_COLOR);
    if (ring) {
      ctx.fillStyle = "#FDFCFF";
      ctx.beginPath(); ctx.arc(axisX, y, yearR, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = P7_AXIS_MARKER_STROKE;
      ctx.strokeStyle = ringColor;
      ctx.beginPath(); ctx.arc(axisX, y, yearR, 0, Math.PI * 2); ctx.stroke();
    }
    const label = String(tick.year);
    const met = ctx.measureText(label);
    const tw = met.width;
    // Ink box of the digits (cap height, no descenders): the digits are
    // centred by their ink, not by the font's line box, so they sit exactly
    // mid-break — the line box would leave them riding high.
    const inkA = met.actualBoundingBoxAscent || 13, inkD = met.actualBoundingBoxDescent || 0;
    const inkH = inkA + inkD;
    const labelColor = hoverActive
      ? `rgba(0, 0, 0, ${P7_AXIS_BG_ALPHA})`
      : (reached ? (sideYears ? `rgba(0, 0, 0, ${p7V().yearSideAlpha})` : P7_AXIS_LABEL_COLOR) : P7_AXIS_LABEL_FAINT_COLOR);
    if (p7V().yearSide === 'center') {
      // Label under the ring, on a punched background so the line doesn't run
      // through the digits.
      // `ly` is the top of the digits' ink: under the ring, or centred on y.
      const ly = ring ? y + R + P7_VERT_YEAR_LABEL_GAP : y - inkH / 2;
      // Ring + label as one vertical span, for the headline blocks to dodge.
      yearSpans.push({ top: ring ? y - R : ly - 2, bottom: ly + inkH + 2, side: 'center' });
      // The punch starts at the ring's edge so no sliver of line shows between
      // the ring and its digits.
      ctx.fillStyle = "#FDFCFF";
      ctx.fillRect(axisX - tw / 2 - 3, ring ? y + R : ly - 2, tw + 6, ly + inkH + 2 - (ring ? y + R : ly - 2));
      // Hover dot landing in this year's block: over the punch, under the
      // digits, at half opacity — same treatment as inside a headline card.
      if (hoverActive && hoverAxisY >= m.top && hoverAxisY <= m.bottom) {
        p7DrawHoverMarker(ctx, axisX, hoverAxisY, p7ActorColor(hoveredEvent.actor), P7_AXIS_HOVER_MARKER_ALPHA);
      }
      ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      ctx.fillStyle = labelColor;
      ctx.fillText(label, axisX, ly + inkA);
    } else {
      // Label beside the ring, its ink centred on the ring, aligned toward
      // the line. It sits off the line, so nothing is punched — the span is
      // only for same-side headline cards to dodge.
      const dir = p7V().yearSide === 'right' ? 1 : -1;
      const lx  = axisX + dir * (R + p7V().sideGap);
      const half = Math.max(inkH / 2, R) + 2;
      yearSpans.push({ top: y - half, bottom: y + half, side: p7V().yearSide });
      ctx.textAlign = dir > 0 ? "left" : "right"; ctx.textBaseline = "alphabetic";
      ctx.fillStyle = labelColor;
      ctx.fillText(label, lx, y - inkH / 2 + inkA);
      // Hover dot landing on this ring: whole, over the ring.
      if (hoverActive && hoverAxisY >= m.top && hoverAxisY <= m.bottom) {
        p7DrawHoverMarker(ctx, axisX, hoverAxisY, p7ActorColor(hoveredEvent.actor), 1);
      }
    }
  }
  ctx.restore();
  if (clipped) ctx.restore();

  // Dots pop on the DRAWN edge (fillY): the circle appears the instant the
  // fill reaches its top, never sitting on unfilled line.
  p7DrawAxisEventsVertical(ctx, W, H, axisX, fillY, hoverActive, hoverAxisY, yearSpans);

  if (hoverActive) {
    // The hovered square's mirror dot: whole and on top of everything when it
    // is on bare axis. Inside an open headline card it is drawn by the card
    // pass instead — over the card's fill, under its text and split dots, at
    // P7_AXIS_HOVER_MARKER_ALPHA — and inside a year block by the year loop
    // above (over the punch, under the digits), so skip it here.
    let inCard = marks.some(m => hoverAxisY >= m.top && hoverAxisY <= m.bottom);
    for (let i = 0; i < p7AxisEventSpans.length; i++) {
      const sp = p7AxisEventSpans[i];
      if (sp && hoverAxisY >= sp.top && hoverAxisY <= sp.bottom) { inCard = true; break; }
    }
    if (!inCard) p7DrawHoverMarker(ctx, axisX, hoverAxisY, p7ActorColor(hoveredEvent.actor), 1);
  }
}

// The hovered square's axis dot (white halo + actor colour) at a given alpha.
function p7DrawHoverMarker(ctx, x, y, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#FDFCFF";
  ctx.beginPath(); ctx.arc(x, y, P7_AXIS_MARKER_RADIUS + 1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, P7_AXIS_MARKER_RADIUS, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// One axis-event dot: the bare marker, no halo — the card (or the punch) is
// what separates it from the line.
function p7DrawAxisMarker(ctx, x, y, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
}

// One headline card (P7_VERT.card) — the rounded rect behind a centred block.
// `radii` (optional, [TL, TR, BR, BL]) overrides the card's own radius/radiusBottom
// pair — the side cards round only their far corners.
function p7DrawHeadlineCard(ctx, card, x, y, w, h, radii) {
  const r = Math.min(card.radius || 0, w / 2, h / 2);
  const rb = Math.min(card.radiusBottom == null ? r : card.radiusBottom, w / 2, h / 2);
  const rr = radii ? radii.map(v => Math.min(v, w / 2, h / 2)) : [r, r, rb, rb];
  const path = () => { ctx.beginPath(); ctx.roundRect(x, y, w, h, rr); };
  ctx.save();
  if (card.style === 'bar') {
    // No card: bare punched text with the accent bar under it.
    ctx.fillStyle = '#FDFCFF'; ctx.fillRect(x, y, w, h);
  } else {
    // Every card style paints card.fill; 'shadow' adds the drop shadow.
    if (card.style === 'shadow') { ctx.shadowColor = 'rgba(0, 0, 0, 0.14)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3; }
    ctx.fillStyle = card.fill || '#FDFCFF'; path(); ctx.fill();
    ctx.shadowColor = 'transparent';
  }
  if (card.style === 'outline' || card.style === 'dashed' || card.style === 'accent') {
    ctx.lineWidth = card.strokeWidth || 1;
    ctx.strokeStyle = card.style === 'accent' ? 'rgba(0, 0, 0, 0.12)' : (card.stroke || 'rgba(0, 0, 0, 0.3)');
    if (card.style === 'dashed') ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, rr); ctx.stroke();
    ctx.setLineDash([]);
  }
  if (card.style === 'accent' || card.style === 'bar' || (card.bar && !card.sides)) {
    // The accent bar, always along the bottom of the text (P7_VERT.bar).
    // card.bar = along the card's whole bottom edge instead.
    const b = p7V().bar;
    const bw = card.bar ? w : card.style === 'bar' ? w - (Math.max(card.padX, b.padX) - b.padX) * 2 : w - r * 2;
    p7DrawAccentBar(ctx, x + w / 2, y + h - b.h, bw, b.alphaBottom ?? 1);
    // card.barTop = the same bar along the card's top edge too.
    if (card.bar && card.barTop) p7DrawAccentBar(ctx, x + w / 2, y, bw, b.alphaTop ?? 1);
  }
  // card.sides = a full border in the bar's line style (rounded by the card's
  // radii) instead of the two flat bars, at card.sidesAlpha.
  if (card.bar && card.sides) {
    const b = p7V().bar;
    ctx.save();
    ctx.globalAlpha *= b.alpha * (card.sidesAlpha ?? 1);
    ctx.strokeStyle = b.color; ctx.lineWidth = b.h;
    ctx.beginPath(); ctx.roundRect(x + b.h / 2, y + b.h / 2, w - b.h, h - b.h, rr); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

// One accent bar (P7_VERT.bar style) of width `w`, centred on `cx`, its top at
// `y`: `inset` px trimmed each side, rounded or square ends, solid or dashed.
// `alpha` is the per-edge opacity (P7_VERT.bar.alphaTop / alphaBottom),
// multiplied into the shared bar.alpha.
function p7DrawAccentBar(ctx, cx, y, w, alpha = 1) {
  const b = p7V().bar;
  const bw = w - (b.inset || 0) * 2;
  if (bw <= 0 || b.h <= 0) return;
  ctx.save();
  ctx.globalAlpha *= b.alpha * alpha;
  if (b.dash > 0) {
    ctx.strokeStyle = b.color; ctx.lineWidth = b.h;
    ctx.lineCap = b.round ? 'round' : 'butt';
    ctx.setLineDash([b.dash, b.dashGap]);
    ctx.beginPath(); ctx.moveTo(cx - bw / 2, y + b.h / 2); ctx.lineTo(cx + bw / 2, y + b.h / 2); ctx.stroke();
  } else {
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.roundRect(cx - bw / 2, y, bw, b.h, b.round ? b.h / 2 : 0); ctx.fill();
  }
  ctx.restore();
}

function p7DrawAxisEventsVertical(ctx, W, H, axisX, curY, hoverActive, highlightY, yearSpans) {
  p7UpdateAxisEventTriggers(W);
  const now = performance.now();
  const v = p7.vert;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  // Width available to a headline block: the whole band in band mode, the
  // corridor (minus a margin) in widen mode.
  const evSide = p7V().eventSide;
  const evDir  = evSide === 'right' ? 1 : -1;
  // Mobile candidates (P7_VERT_MOBILE.headline): 'widen' = the desktop card,
  // 'band' = rule + band across both grids, 'slot' = one line under the grid.
  const hl = p7V().headline;
  const leftX0 = p7.leftX0;
  const maxWidth = hl === 'band' ? W - 2 * leftX0 - 2 * p7V().card.padX
    : isMobile() ? p7V().type.maxWidth
    : p7V().eventMode === "band" ? 320
    : evSide === 'center' ? p7CenterGap() - 16
    // Side blocks: half the corridor less the plaque's gap + two pads (or,
    // bare, the dot + sideGap) and a 4px margin to the grid.
    : p7CenterGap() / 2 - (p7V().sideCard ? p7V().sideCard.gap + 2 * p7V().sideCard.padX : P7_AXIS_MARKER_RADIUS + p7V().sideGap) - 4;
  // A mode switch (harness) must not leave a stale span from the other mode.
  for (let i = 0; i < p7AxisEventSpans.length; i++) p7AxisEventSpans[i] = null;

  p7.axisEventPositions = new Map();
  p7.axisCardRects = new Map();   // side plaque rects for the hover hit-test (p7HoverInit)
  const hoveredAxisEvent = p7.hoveredAxisEvent;
  // descT advances at a fixed tempo on wall-clock dt (capped so a stalled
  // tab doesn't jump), toward 1 while the description should be open.
  const descDt = Math.min(50, now - (p7AxisDescLastNow ?? now));
  p7AxisDescLastNow = now;
  P7_AXIS_EVENT_STATE.forEach((st, i) => {
    const dir = p7AxisDescTarget(i) ? 1 : -1;
    st.descT = Math.min(1, Math.max(0, st.descT + dir * descDt / P7_AXIS_DESC_MS));
    const odir = p7AxisOthersTarget(i) ? 1 : -1;
    st.othersT = Math.min(1, Math.max(0, st.othersT + odir * descDt / P7_AXIS_DESC_MS));
  });
  const rosterTarget = hoverActive ? 1 : 0;
  p7AxisRosterT += (rosterTarget - p7AxisRosterT) * P7_AXIS_HOVER_ANIM_SPEED;
  if (Math.abs(rosterTarget - p7AxisRosterT) < 0.001) p7AxisRosterT = rosterTarget;

  // Persistent dots (same easing as the horizontal pass).
  const evY = P7_AXIS_EVENTS.map((ev, i) => p7RowY(v.events[i].row, H));
  P7_AXIS_EVENTS.forEach((ev, i) => {
    // A side plaque that slid to clear a year label takes its dot with it
    // (p7SideCardDy, written by the label pass below — one frame behind).
    const y = evY[i] + (p7SideCardDy[i] || 0);
    const state = P7_AXIS_EVENT_STATE[i];
    // reachedT IS the event's trigger, not a second opinion about it.
    //
    // It used to be a per-frame lerp toward `y <= curY` — a live readout of the
    // fill edge, i.e. a SCRUB: the marker grew and shrank continuously as the
    // scroll moved, and it ignored P7_AXIS_TRIGGER_ROW_OFFSET entirely, because
    // that offset lives in p7UpdateAxisEventTriggers' row test. So the page had
    // TWO disagreeing reach points — the card on its trigger, the marker on the
    // raw fill edge — and moving the trigger point only moved one of them.
    // Reading the trigger's own eased progress makes the marker, the card and
    // the side-plaque fly one beat off one trigger point.
    let reached;
    if (isMobile()) {
      state.reachedT = p7AxisFlyTrigger(i).currentT();
      reached = state.triggeredAt !== null && state.leavingAt === null;
    } else {
      // DESKTOP: unchanged — the original lerp toward the live fill edge.
      reached = y <= curY || (state.triggeredAt !== null && state.leavingAt === null);
      const reachedTarget = reached ? 1 : 0;
      state.reachedT += (reachedTarget - state.reachedT) * P7_AXIS_HOVER_ANIM_SPEED;
      if (Math.abs(reachedTarget - state.reachedT) < 0.001) state.reachedT = reachedTarget;
    }
    if (!reached) state.hoverT = 0;
    if (state.reachedT <= 0.001 && !p7AxisMarkerUnreached()) return;
    const isAxisHovered = hoveredAxisEvent === ev;
    const hoverTarget = isAxisHovered ? 1 : 0;
    state.hoverT += (hoverTarget - state.hoverT) * P7_AXIS_HOVER_ANIM_SPEED;
    if (Math.abs(hoverTarget - state.hoverT) < 0.001) state.hoverT = hoverTarget;
    // While a timeline square is hovered the roster reveal opens every reached
    // card, and its split half-dots must stay at FULL size — the roster only
    // shrinks bare (closed-card) dots, so p7AxisRosterT is added back for the
    // half-dot cards below (same ease, so it grows with the reveal).
    const halfCard = hl === 'widen' && p7V().card && p7V().card.halfDots && p7V().card.anchor === 'center' && evSide === 'center';
    const prominence = Math.max(
      Math.max(p7AxisEventOpacity(i, now), state.hoverT) * (1 - p7AxisRosterT),
      halfCard ? p7AxisRosterT : 0);
    // While the axis is UNDRAWING (@fold12's glide, or scrolling back out)
    // every dot shrinks away on the cards' own fade clock (P7_AXIS_EVENT_FADE_OUT_MS
    // from the outro start — the same instant the cards' leavingAt is set)
    // instead of sitting at full size until the wipe's clip cuts it: the exit
    // path forces currentDate to maxDate, which reads every dot as reached.
    // reachedT itself is left alone so a cancelled outro resumes seamlessly.
    const outroShrink = p7AxisOutroStart === null ? 1
      : 1 - p9Ease(Math.min(1, (now - p7AxisOutroStart) / P7_AXIS_EVENT_FADE_OUT_MS));
    // The end-of-fill zoom-out takes the axis markers with it: once the field
    // scales down to be seen whole they are a row of black dots down a corridor
    // that is no longer the point, so they shrink away with the beat and grow
    // back if it reverses. By SIZE, like every other dot on the page — never a
    // fade. Desktop / any phone that never zooms out holds p7ZoomOutT at 0, so
    // this is a no-op there.
    // Resting radius for this event's current prominence — what "full size"
    // means for it right now.
    const restR = P7_AXIS_MARKER_RADIUS_FADED +
      (P7_AXIS_MARKER_RADIUS - P7_AXIS_MARKER_RADIUS_FADED) * prominence;
    // p7AxisMarkerEnter(): 'full' holds the resting size from before the fill
    // arrives so only colour moves; 'grow' ramps up from GROW_FROM. With
    // unreached markers off, the old behaviour (scale straight off reachedT) is
    // preserved exactly.
    // The size an UNREACHED marker sits at. It must be measured off
    // P7_AXIS_MARKER_RADIUS, never off restR: prominence is 0 before the event
    // fires, so restR has already collapsed to _FADED (2px) and scaling that
    // gave 0.7px ('grow') vs 2px ('full') — both invisible on a phone, which is
    // why the two modes looked identical. 'full' now means the marker's real
    // full size (4px) before the fill arrives, so only colour moves on trigger.
    const unreachedR = p7AxisMarkerEnter() === 'full'
      ? P7_AXIS_MARKER_RADIUS
      : P7_AXIS_MARKER_RADIUS * P7_AXIS_MARKER_GROW_FROM;
    const markerRadius = (p7AxisMarkerUnreached()
        ? unreachedR + (restR - unreachedR) * state.reachedT
        : restR * state.reachedT) * outroShrink * (1 - p7ZoomOutT);
    const isHighlighted = highlightY !== null && Math.abs(y - highlightY) < 0.5;
    const markerColor = hoverActive
      ? (isHighlighted ? P7_AXIS_HOVER_COLOR : P7_AXIS_BG_COLOR)
      : isAxisHovered ? P7_AXIS_HOVER_COLOR
      : p7AxisMarkerUnreached() ? p7AxisMarkerColorAt(state.reachedT)
      : P7_AXIS_FILLED_COLOR;
    p7.axisEventPositions.set(ev, { x: axisX, y, radius: markerRadius, color: markerColor });
    // Half-dot cards draw the dot themselves (only its inner half); the full
    // dot here fades out as the card fades in, so a faded event keeps its dot.
    // headline 'none': no card ever opens, so the dot is never cut in half.
    if (halfCard) {
      const st = P7_AXIS_EVENT_STATE[i], rosterOn = st.triggeredAt !== null && st.leavingAt === null;
      const labelOp = Math.min(1, Math.max(p7AxisEventOpacity(i, now), st.hoverT, rosterOn ? p7AxisRosterT : 0));
      if (labelOp >= 1) return;
      ctx.save(); ctx.globalAlpha *= 1 - labelOp;
      p7DrawAxisMarker(ctx, axisX, y, markerRadius, markerColor);
      ctx.restore();
      return;
    }
    p7DrawAxisMarker(ctx, axisX, y, markerRadius, markerColor);
  });

  // Labels: title lines then the date, hanging under the dot, centred on the
  // line. The block's background is punched so the line (and, in widen mode,
  // any stray dot) doesn't run through the text.
  // A plaque with an open (or opening/closing) description is drawn LAST so it
  // overlays its neighbours instead of being painted under them.
  const labelOrder = P7_AXIS_EVENTS.map((_, i) => i)
    .sort((a, b) => (P7_AXIS_EVENT_STATE[a].descT > 0) - (P7_AXIS_EVENT_STATE[b].descT > 0));
  labelOrder.forEach((i) => {
    const ev = P7_AXIS_EVENTS[i];
    const st = P7_AXIS_EVENT_STATE[i];
    const rosterOn = st.triggeredAt !== null && st.leavingAt === null;
    const opacity = Math.max(p7AxisEventOpacity(i, now), st.hoverT, rosterOn ? p7AxisRosterT : 0);
    p7AxisEventSpans[i] = null;
    if (hl === 'none') return;          // circles only — no headline copy on the axis
    if (hl === 'slot') return;          // drawn once, below the grid — p7DrawVertHeadlineSlot
    if (opacity <= 0) return;
    const TY = p7V().type;
    // 'alternate' flips the side per event (even index left, odd right).
    const evSideI = p7V().eventSide === 'alternate' ? (i % 2 ? 'right' : 'left') : evSide;
    const evDirI  = evSideI === 'right' ? 1 : -1;
    const onSide = evSideI !== 'center';
    // Side plaque (P7_VERT.sideCard): its own type; the centred card keeps TY.
    const SC = onSide ? p7V().sideCard || null : null;
    const sideCard = !!SC;
    const titleType = sideCard ? SC.type : TY.title;
    ctx.font = p7VertFont(titleType);
    const lines = p7WrapLabel(ctx, ev.label, maxWidth);
    if (hl === 'band') {
      // Candidate A: a translucent band hanging under the event's rule
      // (p7DrawVertEventLines), full grid width, copy right-aligned at the
      // grids' right edge. Same crossfade as the card; the fill skips it.
      const C = p7V().card;
      const bandH = C.padTop + lines.length * TY.title.lh + (TY.showDate ? TY.date.lh + TY.gap : 0) + C.padBottom;
      const y0 = Math.round(evY[i]) + 1;
      ctx.globalAlpha = opacity;
      ctx.fillStyle = 'rgba(253, 252, 255, 0.86)';
      ctx.fillRect(leftX0, y0, W - 2 * leftX0, bandH);
      p7AxisEventSpans[i] = { top: y0, bottom: y0 + bandH };
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      const tx = W - leftX0 - C.padX;
      let ty = y0 + C.padTop;
      ctx.fillStyle = TY.title.color;
      lines.forEach(t => { p7VertLineText(ctx, t, tx, ty, TY.title.lh); ty += TY.title.lh; });
      if (TY.showDate) {
        ctx.font = p7VertFont(TY.date); ctx.fillStyle = TY.date.color;
        p7VertLineText(ctx, p7FormatDateDMY(ev.date, "."), tx, ty + TY.gap, TY.date.lh);
      }
      ctx.textAlign = 'center';
      ctx.globalAlpha = 1;
      return;
    }
    const lh = titleType.lh, dlh = TY.date.lh;
    const dateLabel = p7FormatDateDMY(ev.date, ".");
    let tw = 0;
    lines.forEach(t => { tw = Math.max(tw, ctx.measureText(t).width); });
    const noDate = !TY.showDate;
    if (!noDate) { ctx.font = p7VertFont(TY.date); tw = Math.max(tw, ctx.measureText(dateLabel).width); }
    // The date can sit on its own side of the line (split): then the title
    // block loses its date line and the date is drawn beside the dot alone.
    const dateSide = p7V().dateSide === 'with' ? evSideI : p7V().dateSide;
    const split = !noDate && dateSide !== evSideI;
    const dateFirst = !split && !noDate && p7V().dateAbove;
    // The centred card (P7_VERT.card) never applies to a side block.
    const card = sideCard ? null : p7V().card || null;
    const cpx = sideCard ? SC.padX : card ? Math.max(card.padX, card.style === 'bar' ? p7V().bar.padX : 0) : 0;
    const cpt = sideCard ? SC.padTop : card ? card.padTop : 0, cpb = sideCard ? SC.padBottom : card ? card.padBottom : 0;
    const barExtra = card && (card.style === 'bar' || card.style === 'accent') ? p7V().bar.gap + p7V().bar.h : 0;
    // Bar between title and date: the card (and its bar) covers the title
    // only; the date hangs `dateGap` px under the bar, punched separately.
    const dateBelowBar = !!(barExtra && !split && !dateFirst && p7V().bar.dateBelow);
    const dateGap = dateBelowBar ? p7V().bar.dateGap : 0;
    const blockH = lines.length * lh + (split || noDate ? 0 : dlh + TY.gap) + barExtra + dateGap;
    // The block always hangs UNDER the dot (the dot is always above its text).
    // If it would run into a year ring or its label, it is pushed down to just
    // past that label instead.
    // Side placement: the block sits beside the dot, its first line centred
    // on the dot, aligned toward the line; it only dodges year labels that
    // live on the same side (or on the line itself, whose span is below the ring).
    // Dot-to-text gap: the card's own gap plus whichever pad faces the dot.
    const centred = !!(card && card.anchor === 'center');
    let textClip = null; // set by the animated card: text is clipped to the open part
    // anchor 'center': the dot-facing card edge sits ON the dot's centre.
    const textGapBelow = card ? (centred ? -P7_AXIS_MARKER_RADIUS : card.gap) + cpt : P7_VERT_EVENT_TEXT_GAP;
    const textGapAbove = card ? (centred ? -P7_AXIS_MARKER_RADIUS : card.gap) + cpb : P7_VERT_EVENT_TEXT_GAP;
    const textGap = textGapBelow;
    const spans = (yearSpans || []).filter(s => !(onSide && s.side !== 'center' && s.side !== evSideI));
    const hits = (top) => spans.some(s => top - 2 - cpt < s.bottom && top + blockH + 2 + cpb > s.top);
    const below = sideCard ? evY[i] - blockH / 2 : onSide ? evY[i] - lh / 2 : evY[i] + P7_AXIS_MARKER_RADIUS + textGap;
    const above = evY[i] - P7_AXIS_MARKER_RADIUS - textGapAbove - blockH;
    // Default: under the dot. If that runs into a year label the block flips
    // ABOVE its dot; only if both sides collide is it pushed down past the year.
    // Default side: under the dot, unless the event asks for `above`
    // (P7_AXIS_EVENTS); side blocks always start beside the dot.
    const preferAbove = !onSide && !!ev.above;
    let y0 = preferAbove ? above : below, flipped = preferAbove;
    if (sideCard) {
      // Side plaque: if centred on its date it would cross a same-side year
      // label, slide it by the smallest amount that clears the label (up if
      // shorter, else down) — and the DOT follows the plaque (p7SideCardDy,
      // applied in the dot pass) so the two always stay centred on each
      // other.
      const s = hits(y0) ? spans.find(s => y0 - 2 - cpt < s.bottom && y0 + blockH + 2 + cpb > s.top) : null;
      if (s) {
        const up = s.top - 2 - cpb - blockH, down = s.bottom + 2 + cpt;
        y0 = (y0 - up <= down - y0) ? up : down;
      }
      p7SideCardDy[i] = y0 + blockH / 2 - evY[i];
    } else if (hits(y0)) {
      const alt = preferAbove ? below : above;
      if (!hits(alt)) { y0 = alt; flipped = !preferAbove; }
      else spans.forEach(s => { if (hits(y0)) y0 = s.bottom + textGap; });
    }
    ctx.globalAlpha = opacity;
    ctx.fillStyle = "#FDFCFF";
    // Side plaque: the copy is centred in the card, so tx is the card's centre.
    const tx = sideCard ? axisX + evDirI * (SC.gap + cpx + tw / 2)
      : onSide ? axisX + evDirI * (P7_AXIS_MARKER_RADIUS + p7V().sideGap) : axisX;
    if (sideCard) {
      // One-beat reveal: `opacity` is the raw progress, the plaque unfolds out
      // from its near edge (`gap` px off the line; that edge stays put, the far
      // edge travels) and the copy fades in clipped to the open part;
      // reversing plays it back. The line and the dot are never covered, so no
      // span is registered and the fill runs past it untouched.
      // Bystander fold: while another event is hovered this plaque plays its
      // reveal backwards into its near edge (othersT). Position never moves,
      // and the dot is drawn outside this branch so it stays put.
      const foldMul = 1 - p9Ease(st.othersT);
      const openT = p9Ease(Math.min(1, Math.max(0, opacity))) * foldMul;
      const cwF = cpx + tw + cpx, chF = blockH + cpt + cpb, cyF = y0 - cpt;
      const near = axisX + evDirI * SC.gap;
      // Hover description (P7_AXIS_DESC_*): the plaque grows from its closed
      // size to hold `desc`, then the copy types in. Windows re-ease the RAW
      // descT so reversing plays the same beats backwards. The near edge never
      // moves; growth is downward at the plaque's wrap width — unless the
      // grown card would run off the canvas bottom, then it grows upward and
      // the description sits above the title instead.
      const dwin = (w) => p9Ease(Math.min(1, Math.max(0, (st.descT - w.start) / w.len)));
      const DT = P7_AXIS_DESC_TYPE;
      const descWrap = maxWidth;
      ctx.font = p7VertFont(DT);
      const descLines = ev.desc && st.descT > 0 ? p7WrapLabel(ctx, ev.desc, descWrap) : [];
      const descH = descLines.length ? P7_AXIS_DESC_GAP + descLines.length * DT.lh : 0;
      const descW = descLines.length ? Math.max(...descLines.map(t => ctx.measureText(t).width)) : 0;
      const cwD = descLines.length ? Math.max(cwF, Math.min(descWrap, descW) + 2 * cpx) : cwF;
      const openRaw = Math.min(1, Math.max(0, (st.descT - P7_AXIS_DESC_BEATS.open.start) / P7_AXIS_DESC_BEATS.open.len));
      // Height and (the small wrap-driven) width grow together.
      const hT = p9Ease(openRaw);
      const wT = hT;
      const growUp = cyF + chF + descH > H - 8;
      const cwA = cwF * openT + (cwD - cwF) * wT;
      const chA = chF + descH * hT;
      const cyA = growUp ? cyF - descH * hT : cyF;
      const cxA = evDirI > 0 ? near : near - cwA;
      ctx.globalAlpha = 1;
      if (cwA > 0) p7DrawHeadlineCard(ctx, SC, cxA, cyA, cwA, chA);
      if (cwA > 0) p7.axisCardRects.set(ev, { x: cxA, y: cyA, w: cwA, h: chA });
      textClip = { x: cxA, y: cyA, w: cwA, h: chA, alpha: openT };
      // Typing beat: a prefix of the wrapped copy, right-aligned (RTL) inside
      // the card's pad, clipped to the open card. Hard 0/1 gate, no fade.
      const typeT = dwin(P7_AXIS_DESC_BEATS.type);
      if (typeT > 0 && descLines.length) {
        const total = descLines.reduce((n, t) => n + t.length, 0);
        let left = Math.round(typeT * total);
        ctx.save();
        ctx.beginPath(); ctx.rect(cxA, cyA, cwA, chA); ctx.clip();
        // RTL paragraph direction so a trailing «.» lands at the END of the
        // Hebrew run (its left), not flung to the right like in an LTR context.
        ctx.direction = 'rtl';
        // Right-side plaques sit flush to their axis-side (left) edge; the
        // left-side ones stay right-aligned (compare/ pick, 2026-09-07).
        const alignLeft = evDirI > 0;
        ctx.textAlign = alignLeft ? 'left' : 'right';
        ctx.fillStyle = DT.color;
        const dx = alignLeft ? cxA + cpx : cxA + cwA - cpx;
        const dy0 = growUp ? cyA + cpt : y0 + blockH + P7_AXIS_DESC_GAP;
        descLines.forEach((t, li) => {
          if (left <= 0) return;
          const part = t.slice(0, left); left -= t.length;
          p7VertLineText(ctx, part, dx, dy0 + li * DT.lh, DT.lh);
        });
        ctx.restore();
      }
      ctx.font = p7VertFont(titleType);
    } else if (onSide) {
      ctx.fillRect(evDirI > 0 ? tx - 3 : tx - tw - 3, y0 - 2, tw + 6, blockH + 4);
    } else if (card) {
      // Card: no punch between dot and card when it has a stem (the line is
      // the connector); otherwise clear that gap too.
      if (!centred && (!card.stem || card.style === 'bar')) {
        const a = flipped ? y0 + blockH : evY[i] - P7_AXIS_MARKER_RADIUS;
        const b = flipped ? evY[i] - P7_AXIS_MARKER_RADIUS : y0;
        ctx.fillRect(axisX - 2, Math.min(a, b), 4, Math.abs(b - a));
      }
      const cardH = dateBelowBar ? lines.length * lh + barExtra : blockH;
      const halfCard = centred && card.halfDots;
      // 3-beat reveal (halfCard only): `opacity` is the raw progress; the
      // geometry animates instead of the alpha, so reversing plays the same
      // beats backwards. Dot pop = the marker's own reachedT, before this.
      const win = (w) => p9Ease(Math.min(1, Math.max(0, (opacity - w.start) / w.len)));
      const barT = halfCard ? win(P7_VERT_CARD_BEATS.bar) : 1;
      const openT = halfCard ? win(P7_VERT_CARD_BEATS.open) : 1;
      const cxF = axisX - tw / 2 - cpx, cyF = y0 - cpt, cwF = tw + cpx * 2, chF = cardH + cpt + cpb;
      // Animated rect: the dot-facing edge stays put, the far edge travels.
      const chA = halfCard ? chF * openT : chF;
      const cyA = flipped ? cyF + chF - chA : cyF;
      if (centred) p7AxisEventSpans[i] = { top: cyA, bottom: cyA + chA };
      if (halfCard) {
        ctx.globalAlpha = 1;
        if (openT <= 0) {
          // Beat 2: a single bar draws out from the dot along the card edge.
          const B = p7V().bar;
          // Beat 2's lone bar is the dot-facing edge: bottom when flipped, else top.
          p7DrawAccentBar(ctx, axisX, flipped ? cyF + chF - B.h : cyF, cwF * barT, (flipped ? B.alphaBottom : B.alphaTop) ?? 1);
        } else p7DrawHeadlineCard(ctx, card, cxF, cyA, cwF, chA);
        textClip = { x: cxF, y: cyA, w: cwF, h: chA, alpha: openT };
      } else p7DrawHeadlineCard(ctx, card, cxF, cyF, cwF, chF);
      if (centred && hoverActive && highlightY >= cyA && highlightY <= cyA + chA) {
        // The hovered square's date falls inside this card: its dot goes over
        // the fill, under the text and split dots, at half opacity.
        p7DrawHoverMarker(ctx, axisX, highlightY, p7ActorColor((p7.hoveredEvent || p7Inspect.event).actor), P7_AXIS_HOVER_MARKER_ALPHA);
      }
      if (dateBelowBar) {
        ctx.fillStyle = "#FDFCFF";
        ctx.fillRect(axisX - tw / 2 - 4, y0 + cardH + cpb, tw + 8, blockH - cardH + 2);
      }
      if (centred) {
        // The card overlaps the dot — put the dot back on top of it.
        const mk = p7.axisEventPositions.get(ev);
        const cx = cxF, cy = cyA, cw = cwF, ch = chA;
        if (mk && card.halfDots) {
          // Half dots: the dot's centre sits on the dot-facing edge, so
          // clipping it to everything OUTSIDE the card leaves the outer half
          // (top half above the top bar, bottom half below the bottom bar);
          // the far edge gets a matching outward half-dot of its own. While
          // the card is closed both halves coincide — one whole dot — and the
          // far half rides out with the opening edge: the circle splits.
          ctx.save();
          ctx.beginPath();
          ctx.rect(cx - 20, cy - 20, cw + 40, 20);
          ctx.rect(cx - 20, cy + ch, cw + 40, 20);
          ctx.clip();
          p7DrawAxisMarker(ctx, mk.x, mk.y, mk.radius, mk.color);
          p7DrawAxisMarker(ctx, mk.x, flipped ? cy : cy + ch, mk.radius, mk.color);
          ctx.restore();
        } else if (mk) p7DrawAxisMarker(ctx, mk.x, mk.y, mk.radius, mk.color);
      }
    } else if (flipped) {
      // Above the dot: punch from the block's top edge down to the dot's edge.
      ctx.fillRect(axisX - tw / 2 - 4, y0 - 2, tw + 8, evY[i] - P7_AXIS_MARKER_RADIUS - y0 + 2);
    } else {
      // Punch from the dot's edge (or, when pushed past a year label, from that
      // label's bottom) to the block's far edge — no line between dot and text.
      const punchTop = y0 - P7_VERT_EVENT_TEXT_GAP;
      ctx.fillRect(axisX - tw / 2 - 4, punchTop, tw + 8, y0 + blockH - punchTop);
    }
    if (textClip) {
      if (textClip.alpha <= 0) { ctx.globalAlpha = 1; return; }
      ctx.save();
      ctx.beginPath(); ctx.rect(textClip.x, textClip.y, textClip.w, textClip.h); ctx.clip();
      ctx.globalAlpha = textClip.alpha;
    }
    ctx.textAlign = onSide && !sideCard ? (evDirI > 0 ? "left" : "right") : "center";
    const titleY0 = y0 + (dateFirst ? dlh + TY.gap : 0);
    const isHoverHighlighted = hoverActive && highlightY !== null && Math.abs(evY[i] - highlightY) < 0.5;
    const labelAlpha = (hoverActive && !isHoverHighlighted) ? P7_AXIS_ROSTER_LABEL_ALPHA : 1;
    const dimmed = hoverActive && !isHoverHighlighted;
    ctx.font = p7VertFont(titleType);
    ctx.fillStyle = dimmed ? `rgba(0, 0, 0, ${labelAlpha})` : titleType.color;
    lines.forEach((text, li) => p7VertLineText(ctx, text, tx, titleY0 + li * lh, lh));
    ctx.font = p7VertFont(TY.date);
    ctx.fillStyle = dimmed ? `rgba(0, 0, 0, ${P7_AXIS_ROSTER_LABEL_ALPHA})` : TY.date.color;
    if (noDate) {
      // no date line
    } else if (!split) {
      p7VertLineText(ctx, dateLabel, tx, dateFirst ? y0 : y0 + lines.length * lh + TY.gap + (dateBelowBar ? barExtra + dateGap : 0), dlh);
    } else {
      // Split date: its own side, centred on the dot, dodging same-side year labels.
      const dOn  = dateSide !== 'center';
      const dDir = dateSide === 'right' ? 1 : -1;
      const dw   = ctx.measureText(dateLabel).width;
      let dy = dOn ? evY[i] - lh / 2 : evY[i] + P7_AXIS_MARKER_RADIUS + P7_VERT_EVENT_TEXT_GAP;
      (yearSpans || []).forEach(s => {
        if (dOn && s.side !== 'center' && s.side !== dateSide) return;
        if (dy - 2 < s.bottom && dy + lh + 2 > s.top) dy = s.bottom + P7_VERT_EVENT_TEXT_GAP;
      });
      const dx = dOn ? axisX + dDir * (P7_AXIS_MARKER_RADIUS + p7V().sideGap) : axisX;
      const fill = ctx.fillStyle;
      ctx.fillStyle = "#FDFCFF";
      if (dOn) ctx.fillRect(dDir > 0 ? dx - 3 : dx - dw - 3, dy - 2, dw + 6, lh + 4);
      else ctx.fillRect(axisX - dw / 2 - 4, dy - P7_VERT_EVENT_TEXT_GAP, dw + 8, lh + P7_VERT_EVENT_TEXT_GAP + 2);
      ctx.fillStyle = fill;
      ctx.textAlign = dOn ? (dDir > 0 ? "left" : "right") : "center";
      ctx.fillText(dateLabel, dx, dy);
    }
    if (textClip) ctx.restore();
    ctx.globalAlpha = 1;
  });
  if (hl === 'slot') p7DrawVertHeadlineSlot(ctx, W, H, now);
  ctx.restore();
}

// Candidate C ('slot'): the corridor holds only the dots; ONE headline prints
// centred in the slotPx band under the grid (sbbTimeline reserves it). Like the
// old mobile slot: the most recently triggered visible event wins (ties → the
// higher index), older ones stay as dots. Reads reachedT, never eases it.
function p7DrawVertHeadlineSlot(ctx, W, H, now) {
  const V = p7V(), TY = V.type;
  p7VertCardPush = [];   // rebuilt by p7DrawVertDotCards in 'side' mode; empty otherwise
  if (V.slotAnchor === 'dot' || V.slotAnchor === 'dotAbove' || V.slotAnchor === 'side') { p7DrawVertDotCards(ctx, W, H, now); return; }
  let best = -1, bestAt = -Infinity, bestOp = 0;
  P7_AXIS_EVENTS.forEach((ev, i) => {
    const st = P7_AXIS_EVENT_STATE[i];
    const op = Math.max(p7AxisEventOpacity(i, now), st.hoverT);
    if (op <= 0 || st.reachedT <= 0.001) return;
    const at = st.triggeredAt === null ? -Infinity : st.triggeredAt;
    if (at > bestAt || (at === bestAt && i > best)) { best = i; bestAt = at; bestOp = op; }
  });
  if (best < 0) return;
  const ev = P7_AXIS_EVENTS[best];
  ctx.font = p7VertFont(TY.title);
  const lines = p7WrapLabel(ctx, ev.label, W - 2 * p7.leftX0);
  const blockH = lines.length * TY.title.lh + (TY.showDate ? TY.date.lh + TY.gap : 0);
  // Two anchors (V.slotAnchor): 'grid' centres the block in the slotPx band
  // reserved under the grid (squareboundingbox.js:71 keeps that band clear);
  // 'bottom' — mobile — ignores the grid entirely and hangs the block off the
  // viewport's bottom edge, so the copy holds ONE screen position however the
  // grid above it solves. slotPx is still reserved in that case: it is what
  // keeps the grid's last row from reaching down into these lines.
  // 'fill' — mobile compare/ — hangs the block slotFillGapPx under the fill
  // edge (its plaque's top edge, when there is one), so the copy follows the
  // fill down the box; when the box has no room left below the edge the block
  // flips above it instead, and it never leaves the box.
  const padY = V.slotCard && V.slotCard.fill ? V.slotCard.padY : 0;
  let ty = V.slotAnchor === 'bottom' ? H - V.slotBottomPx - blockH
    : V.slotAnchor === 'top'         ? V.slotTopPx
    : V.slotAnchor === 'fill'        ? (() => {
        const box = sbbTimeline(H), bT = Math.round(H * box.top), bB = Math.round(H * box.bottom);
        const edge = p7FillEdgeY(H);
        let y = edge + V.slotFillGapPx + padY;
        if (y + blockH + padY > bB) y = edge - V.slotFillGapPx - padY - blockH;
        return Math.round(Math.min(bB - blockH - padY, Math.max(bT + padY, y)));
      })()
    : Math.round(H * sbbTimeline(H).bottom) + Math.max(0, (V.slotPx - blockH) / 2);
  ctx.globalAlpha = bestOp;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  // V.slotCard (mobile): a black plaque behind the copy so the headline reads as
  // a label of its own rather than page text that happens to sit above the grid.
  // Sized to the WRAPPED lines, not to slotPx, and centred on the same W/2 the
  // text uses — so a one-line and a three-line headline both stay centred and the
  // card only ever grows downward from `ty`. Drawn inside the same globalAlpha,
  // so card and text crossfade as one when the headline swaps.
  const SC = V.slotCard && V.slotCard.fill ? V.slotCard : null;
  if (SC) {
    let tw = 0;
    lines.forEach(t => { tw = Math.max(tw, ctx.measureText(t).width); });
    if (TY.showDate) {
      ctx.font = p7VertFont(TY.date);
      tw = Math.max(tw, ctx.measureText(p7FormatDateDMY(ev.date, ".")).width);
      ctx.font = p7VertFont(TY.title);
    }
    const cw = Math.round(tw) + SC.padX * 2, ch = blockH + SC.padY * 2;
    const cx = Math.round(W / 2 - cw / 2), cy = Math.round(ty - SC.padY);
    ctx.fillStyle = SC.fill;
    ctx.beginPath(); ctx.roundRect(cx, cy, cw, ch, Math.min(SC.radius, cw / 2, ch / 2)); ctx.fill();
  }
  ctx.fillStyle = SC ? SC.color : TY.title.color;
  lines.forEach(t => { p7VertLineText(ctx, t, W / 2, ty, TY.title.lh); ty += TY.title.lh; });
  if (TY.showDate) {
    ctx.font = p7VertFont(TY.date);
    ctx.fillStyle = SC ? SC.dateColor : TY.date.color;
    p7VertLineText(ctx, p7FormatDateDMY(ev.date, "."), W / 2, ty + TY.gap, TY.date.lh);
  }
  ctx.globalAlpha = 1;
}

// slotAnchor 'dot' (mobile compare/, 2026-09-12): instead of ONE headline in a
// fixed place, EVERY reached event keeps its own card, hung on its own dot, so
// the cards ride the camera with the field like the dots do. The card is the
// desktop side plaque's look (V.sideCard: grey, all corners rounded, 12px copy)
// centred on the axis — a phone corridor has no room beside the line.
// The NEWEST reached event's card fades in BELOW its dot, in the unfilled run
// under the fill edge; the moment a later event is reached it glides up over
// its dot and stays there — "sticks above" — so the spot under the edge is
// always the latest headline's and the older ones stack above their dots.
// Position moves continuously (p9Ease over P7_VERT_DOT_CARD_MS on the raw
// aboveT); reversing the scroll plays it back. Cards fade; dots never do.
// Clipped to the box like the field, so a card scrolled off rides out with it.
// 'dotAbove' variant: only the newest reached event has a card, fading in
// ABOVE its dot and staying; the previous card fades away (P7_VERT_DOT_CARD_MS,
// per-event `outT`), never moving.
const P7_VERT_DOT_CARD_MS = 400;
// 'side' anchor: this frame's plaques as {side, top, bottom, dx} — the rows a
// plaque spans push their same-side dots dx px outward (p7DrawSideSquares).
let p7VertCardPush = [];
let p7DotCardLastNow = null;
function p7DrawVertDotCards(ctx, W, H, now) {
  const V = p7V(), SC = V.sideCard, v = p7.vert;
  if (!v || !SC) return;
  const dt = Math.min(50, now - (p7DotCardLastNow ?? now));
  p7DotCardLastNow = now;
  let best = -1, bestAt = -Infinity;
  // 'side' + sidePhase 'before': the plaque LEADS the fill — full while the
  // event is unreached, fading out over the same window the desktop label
  // fades in (p7AxisEventOpacity), back in when the scroll reverses.
  // 'fly': the same lead, but the plaque never fades — on arrival it glides
  // from beside the dot to above it (position on p9Ease(reachedT), never a snap).
  const flies = V.slotAnchor === 'side' && V.sidePhase === 'fly';
  const leads = (V.slotAnchor === 'side' && V.sidePhase === 'before') || flies;
  const edgeY = leads ? p7FillEdgeY(H) : 0;
  const ops = P7_AXIS_EVENTS.map((ev, i) => {
    const st = P7_AXIS_EVENT_STATE[i];
    if (flies) {
      // Full until the event's TRIGGER fires, then out over beat 2 — one beat on
      // its own clock, reversible mid-flight, like every other fold animation.
      //
      // This used to be `past / V.sideFlyFadePx`: the plaque's presence read
      // straight off the live fill edge over 150px of scroll travel, so the card
      // was dragged in and out BY THE SCROLL. That is the scrub — and note it
      // never called p7AxisEventOpacity, so putting the cards on a trigger did
      // nothing for the shipping config (sidePhase 'fly') until this changed too.
      return Math.max(1 - p7AxisLeaveT(i), st.hoverT);
    }
    if (leads) {
      // Scroll-driven: full while the (lagged) fill edge is sideLeadPx or more
      // above the dot, out by the time it arrives; the time fade only caps it.
      const ahead = p7RowY(v.events[i].row, H) - edgeY;
      const lead = Math.min(1, Math.max(0, ahead / Math.max(1, V.sideLeadPx)));
      return Math.max(Math.min(p9Ease(lead), 1 - p7AxisEventOpacity(i, now)), st.hoverT);
    }
    const op = Math.max(p7AxisEventOpacity(i, now), st.hoverT);
    if (op <= 0 || st.reachedT <= 0.001) return 0;
    const at = st.triggeredAt === null ? -Infinity : st.triggeredAt;
    if (at > bestAt || (at === bestAt && i > best)) { best = i; bestAt = at; }
    return op;
  });
  const onlyNewest = V.slotAnchor === 'dotAbove';
  // 'side': the desktop side plaque on the phone — beside its dot, SC.gap off
  // the line, alternating sides per event (even index left, odd right, as
  // desktop's eventSide 'alternate'), centred on the dot, plain fade. The
  // rows it covers push their same-side dots outward past its far edge
  // (p7VertCardPush, read by p7DrawSideSquares one frame behind) so the
  // plaque never hides a dot and no dot ever prints over the plaque.
  const onSide = V.slotAnchor === 'side';
  const axisX = Math.round(W / 2);
  const maxW = onSide ? Math.min(V.sideWrapPx, W / 2 - SC.gap - 2 * SC.padX - 8)
    : Math.min(V.type.maxWidth, W - 2 * p7.leftX0 - 2 * SC.padX);
  const clipped = p7VertClipToBox(ctx, W, H);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  P7_AXIS_EVENTS.forEach((ev, i) => {
    const st = P7_AXIS_EVENT_STATE[i];
    let op = ops[i];
    // Above its dot once a newer event has been reached; back below when it
    // is the newest again (reverse scroll) or has faded out entirely.
    const dir = op > 0 && i !== best ? 1 : -1;
    st.aboveT = Math.min(1, Math.max(0, st.aboveT + dir * dt / P7_VERT_DOT_CARD_MS));
    // 'dotAbove': superseded cards fade away (outT 0→1) instead of stacking.
    const outDir = onlyNewest && op > 0 && i !== best ? 1 : -1;
    st.outT = Math.min(1, Math.max(0, (st.outT || 0) + outDir * dt / P7_VERT_DOT_CARD_MS));
    if (onlyNewest) op *= 1 - p9Ease(st.outT);
    if (op <= 0) return;
    const dotY = p7RowY(v.events[i].row, H);
    ctx.font = p7VertFont(SC.type);
    const lines = p7WrapLabel(ctx, ev.label, maxW);
    let tw = 0;
    lines.forEach(t => { tw = Math.max(tw, ctx.measureText(t).width); });
    const cw = Math.round(tw) + 2 * SC.padX, ch = lines.length * SC.type.lh + SC.padTop + SC.padBottom;
    const below = dotY + P7_AXIS_MARKER_RADIUS + V.dotGapPx;
    const above = dotY - P7_AXIS_MARKER_RADIUS - V.dotGapPx - ch;
    const place = onSide ? V.sidePlace : '';
    // `mobileAbove` opts an event out of the side placement entirely: sideDir 0
    // centres it on the axis and puts it above the dot, and because the fly
    // below is gated on sideDir it never travels — it is simply there, at the
    // top of its dot, from the moment it appears.
    const pinAbove = p7AxisEvMobileAbove(ev);
    const sideDir = pinAbove ? 0
      : place === 'alternate' ? (i % 2 ? 1 : -1) : place === 'left' ? -1 : place === 'right' ? 1 : 0;
    let cy = onSide && sideDir ? Math.round(dotY - ch / 2)
      : pinAbove || onlyNewest || place === 'above' ? Math.round(above) : Math.round(below + (above - below) * p9Ease(st.aboveT));
    let cx = sideDir ? Math.round(sideDir > 0 ? axisX + SC.gap : axisX - SC.gap - cw) : Math.round(axisX - cw / 2);
    if (flies && sideDir) {
      // Side → above on arrival: both coordinates ride the FLY trigger.
      const k = p7AxisFlyT(i);
      const flyY = dotY - P7_AXIS_MARKER_RADIUS - V.sideFlyGapPx - ch;
      cx = Math.round(cx + (axisX - cw / 2 - cx) * k);
      cy = Math.round(cy + (flyY - cy) * k);
    }
    if (onSide) {
      // Push the dots the plaque would cover: one side for a side plaque, both
      // for an 'above' plaque straddling the line.
      const reach = sideDir ? SC.gap + cw + V.dotGapPx : cw / 2 + V.dotGapPx;
      const dx = Math.max(0, reach - p7CenterGap() / 2) * p9Ease(op);
      if (dx > 0 && V.sidePush) {
        if (sideDir >= 0) p7VertCardPush.push({ side: 'right', top: cy, bottom: cy + ch, dx });
        if (sideDir <= 0) p7VertCardPush.push({ side: 'left', top: cy, bottom: cy + ch, dx });
      }
      // Lead marker: the event's axis dot shown AHEAD of the fill. It only ever
      // existed because the main marker pass drew nothing until an event was
      // reached — so with p7AxisMarkerUnreached() on, that pass now owns the
      // unreached dot and this one must not draw at all.
      //
      // It was painting a SECOND dot on top of the knob-driven one, at a
      // hardcoded P7_AXIS_MARKER_RADIUS in solid #000, which is why
      // p7AxisMarkerEnter() / _GROW_FROM / the unreached colour all appeared to
      // do nothing: the tuned marker was there, just hidden under this.
      if (leads && !p7AxisMarkerUnreached() && st.reachedT < 0.999) {
        ctx.beginPath();
        // (1 - p7ZoomOutT): goes with the real markers when the end-of-fill
        // zoom-out runs — see the markerRadius note above.
        ctx.arc(axisX, dotY, P7_AXIS_MARKER_RADIUS * p9Ease(op) * (1 - p7ZoomOutT), 0, Math.PI * 2);
        ctx.fillStyle = '#000';
        ctx.fill();
      }
    }
    // The card arrives and leaves by P7_AXIS_LEAVE_MODE — by default it
    // COLLAPSES into its own axis dot rather than fading in place, so the beat
    // reads as the card going back where it came from. Wrapped in its own
    // save/restore because the collapse modes install a transform.
    ctx.save();
    p7AxisLeaveApply(ctx, op, axisX, dotY);
    p7DrawHeadlineCard(ctx, SC, cx, cy, cw, ch);
    ctx.fillStyle = SC.type.color;
    lines.forEach((t, li) => p7VertLineText(ctx, t, cx + cw / 2, cy + SC.padTop + li * SC.type.lh, SC.type.lh));
    ctx.restore();
  });
  ctx.restore();
  if (clipped) ctx.restore();
}

// Exposed so scroll and animation-loop redraws can re-test the cursor against
// newly drawn dots without requiring pointer movement — assigned inside
// p7HoverInit below (no-op until then, safe to call at any time).
let p7RecheckHover = () => {};

// Hover tooltip for a single event square in the real timeline (#page-8) — date
// + Hebrew description, reusing the exact same DOM element/styling as page9.js's
// hover (#page9Tooltip is generic markup, not page9-specific), and isolating the
// hovered square the same way p9PlaceDot does (see p7DrawSideSquares above).
function p7HoverInit() {
  const canvasEl  = document.getElementById("canvas");
  const tooltipEl = document.getElementById("page9Tooltip");
  const dateEl    = tooltipEl.querySelector(".page9-tooltip-date");
  const descEl    = tooltipEl.querySelector(".page9-tooltip-desc");

  const HIT_PAD = 3; // px of extra hit area around each P7_SQ=3 square, in every direction
  const AXIS_HIT_PAD = 6; // px of extra hit area around each axis event circle (small target, generous pad)
  const TOOLTIP_GAP = 5; // px of breathing room between the square and the tooltip box, both axes
  // Viewport-px line: a hovered dot above it opens its tooltip DOWNWARD
  // (.is-flipped) instead of the default upward. 295 was tuned by eye with a
  // manual/ harness — exact px per explicit instruction, don't
  // convert to vh (the choice was made at one viewport size).
  const P7_TIP_FLIP_Y = 295;
  // Horizontal counterparts (viewport px): outside these two lines the tooltip
  // side is forced away from the nearer mini-legend, overriding the data-side
  // mirroring. Tuned by eye with a manual/ harness — exact px, see the
  // comment where they're used in doHitTest. Each line is measured from the
  // edge its legend hangs off: L from the left edge, R as an INSET from the
  // right edge — one mirrored 327px inset since 2026-09-05. The R line used to
  // be an absolute screen-X — on any window narrower than it no dot could
  // ever cross the line, so the rightward flip silently died after a resize.
  // Declared at module level next to P7_VERT.

  // Last pointer position in client (viewport) coordinates — updated on every
  // pointermove, read by doHitTest so re-checks after redraws don't need an event.
  let lastCX = null, lastCY = null;

  // #page9Tooltip is shared with page9.js's own hover (same element, see
  // p9HoverInit) — only clear it when this handler is the one that actually
  // showed it (p7.hoveredEvent set), or a stray pointermove/scroll on
  // whichever page page9's hover owns would stomp its tooltip right back
  // off the instant it appears, since both listen on window unconditionally.
  // Axis event circles are a separate, independent hover target from the
  // timeline squares above: hovering a persistent circle re-shows that event's
  // faded headline label (p7DrawAxisEvents forces its opacity to 1 while
  // hoveredAxisEvent points at it). Only a redraw is needed — no tooltip DOM,
  // since the label/date reappear on the canvas itself.
  function setAxisHover(ev) {
    if (p7.hoveredAxisEvent === ev) return;
    p7.hoveredAxisEvent = ev;
    // Drive the grow/shrink through the anim loop (hoverT eases per frame) rather
    // than a single snap redraw — p7AxisEventsAnimActive keeps it alive until the
    // ease settles.
    p7StartAnimLoop();
  }
  function updateAxisHover(mx, my) {
    let hit = null;
    for (const [ev, pos] of p7.axisEventPositions) {
      const dx = mx - pos.x, dy = my - pos.y;
      const r = pos.radius + AXIS_HIT_PAD;
      if (dx * dx + dy * dy <= r * r) { hit = ev; break; }
    }
    // Side plaques (desktop): the card itself is a hover target too, so the
    // description (P7_AXIS_DESC_*) opens from the card and stays open while the
    // pointer is anywhere on the grown card. Rects are the last frame's.
    if (!hit && p7.axisCardRects) {
      for (const [ev, r] of p7.axisCardRects) {
        if (mx >= r.x - AXIS_HIT_PAD && mx <= r.x + r.w + AXIS_HIT_PAD &&
            my >= r.y - AXIS_HIT_PAD && my <= r.y + r.h + AXIS_HIT_PAD) { hit = ev; break; }
      }
    }
    setAxisHover(hit);
  }

  // Clears only the timeline-square tooltip/hover — leaves any axis-circle hover
  // untouched, so moving the pointer off a square onto (or still over) an axis
  // circle doesn't stomp the reappeared label.
  function hideSquare() {
    if (!p7.hoveredEvent) return;
    tooltipEl.classList.remove("is-visible");
    p7.hoveredEvent = null;
    // Close this dot's group label in the mini-legend (js/groups.js).
    if (typeof fold6DotHover === "function") fold6DotHover(null);
    draw();
    // The axis-event roster (p7AxisRosterT) eases one step per FRAME, and this
    // single draw() is only one frame — without the loop the roster froze
    // mid-fade at whatever alpha hovering had pumped it up to.
    // p7AxisEventsAnimActive keeps the loop alive until it settles back to 0.
    p7StartAnimLoop();
    // The 8 @fold12 squares' own opacity (a DOM style, not part of the canvas
    // draw() above) also dims/undims with hover — see updateGroups' own
    // p7.hoveredEvent check — so it needs its own refresh here too.
    if (typeof updateGroups === "function") updateGroups();
  }

  // Full clear (square + axis) — for leaving #page-8 entirely.
  function hide() {
    setAxisHover(null);
    hideSquare();
  }

  // Runs the hit-test against p7.lastPositions using the cached cursor
  // position. Called both from onMove (pointer moved) and from p7RecheckHover
  // (canvas just redrew — new dots may have appeared under a stationary cursor).
  function doHitTest() {
    // No hover layer on mobile: a ~2px square is far below a finger-sized
    // target, and pointermove on touch would latch a tooltip that nothing
    // clears. Tap-to-inspect is a separate future addition. Read live, so a
    // resize back over the 600px boundary restores hover (and clears anything
    // still showing on the way in).
    // MOBILE: no hover layer, but the docked frame still has to keep its
    // picker/selected state in step with the page (p7InspectInit below) —
    // doHitTest is the one thing that already runs on every redraw, scroll and
    // pointer event, so it's where that sync is hung.
    if (isMobile()) { hide(); p7InspectSync(); return; }
    // Also fully off while @fold12's bridge glide (page8.js) is mid-flight in
    // either direction (p8PhaseStart non-null): scrolling back up from @fold12
    // lands currentPage on 7 while the dots are still flying back to their
    // timeline spots, and hovering one mid-flight latched a tooltip onto a
    // moving target.
    // Same reason for @fold10's size-grid morph (p7GridMorph): while the dots
    // are flying to (or back from) their packed cells, every square is a moving
    // target and the tooltip latched onto whatever passed under the pointer.
    if (lastCX === null || (currentPage !== 8 && currentPage !== 9) ||
        (typeof p8PhaseStart !== "undefined" && p8PhaseStart !== null) ||
        p7GridMorph !== null) { hide(); return; }

    const rect = canvasEl.getBoundingClientRect();
    const mx = lastCX - rect.left;
    const my = lastCY - rect.top;

    // Axis event circles first — independent of the square scan below (a circle
    // sits on the axis line, well clear of the squares), so both can be checked
    // every move without one masking the other.
    updateAxisHover(mx, my);

    const half = p7.SQ / 2;
    const SQ_BULGE = ev => p7.SQ * P7_BULGE_MULT[p7BulgeTier(ev)];

    // Brute-force nearest-square scan — p7.lastPositions only holds the
    // squares actually drawn this frame, already in CSS-pixel space (same as
    // getBoundingClientRect, so no DPR conversion needed).
    let bestEvent = null, bestPos = null, bestDist = Infinity;
    // The hovered square may be SWOLLEN (hover bulge, p7DrawSideSquares): its
    // hit box is its current grown size, not P7_SQ — otherwise the pointer
    // leaves the 3.5px core while still inside the big square, the hover
    // drops, every dot snaps back to full opacity, and the next pixel re-hovers
    // it: the jitter. The grown square stays centred on its cell, so only the
    // half-extent changes. Its own hits win outright (dist -1) so a pushed
    // neighbour's box can never steal the pointer from inside the big square.
    // The bulge's extra half-extent, measured from the square's OWN drawn size —
    // not from `half` (p7.SQ/2, the timeline square). In the size grid every
    // square has its own size, and anchoring the hovered one's hit box to
    // p7.SQ collapsed it to ~1.5px the moment it became hovered: the pointer
    // was instantly outside its own box, the hover dropped, the un-hovered box
    // (full size) caught it again on the next pixel, and it flip-flopped —
    // the @fold10 stutter, worst on the biggest squares because they have the
    // most room to move inside. Fixed 2026-09-08.
    const hov = p7.hoveredEvent, hovB = hov && p7BulgeT.get(hov);
    const hovGrow = hovB ? (SQ_BULGE(hov) - p7.SQ) * p9Ease(hovB.t) / 2 : 0;
    for (const [ev, pos] of p7.lastPositions) {
      // pos.sq is the square's own drawn size (size grid / mid-morph); the
      // timeline's squares all share p7.SQ.
      const ownHalf = (pos.sq ?? p7.SQ) / 2;
      const cx = pos.x + ownHalf, cy = pos.y + ownHalf;
      const dx = mx - cx, dy = my - cy;
      const h  = ev === hov ? ownHalf + hovGrow : ownHalf;
      if (Math.abs(dx) > h + HIT_PAD || Math.abs(dy) > h + HIT_PAD) continue;
      const dist = ev === hov ? -1 : dx * dx + dy * dy;
      if (dist < bestDist) { bestDist = dist; bestEvent = ev; bestPos = pos; }
    }

    if (!bestEvent) { hideSquare(); return; }

    // Redraw with this square isolated only when the hovered event actually
    // changes — not on every check over the same square.
    if (p7.hoveredEvent !== bestEvent) {
      p7.hoveredEvent = bestEvent;
      // Open this dot's own group label in the mini-legend (js/groups.js).
      if (typeof fold6DotHover === "function") fold6DotHover(bestEvent.actor);
      draw();
      // Same reason as hideSquare(): the roster fade-in needs frames, not one
      // draw — run the loop until p7AxisRosterT settles at 1.
      p7StartAnimLoop();
      // Same DOM-opacity refresh as hide() above — see that comment.
      if (typeof updateGroups === "function") updateGroups();
      // draw() just rebuilt p7.lastPositions — bestPos (read below for
      // tooltip placement) still points at the same {x,y}, since dimming
      // only changes alpha, but refresh the reference for clarity/safety.
      bestPos = p7.lastPositions.get(bestEvent);
    }

    dateEl.textContent = p7FormatDateDMY(bestEvent.date);
    descEl.textContent = bestEvent.descHeMedium;
    // setTooltipColor (js/core.js), not a bare style.color: the dashed <svg>
    // overlay strokes currentColor, while desktop's filled box paints from
    // --tip-fill, the contrast-floored version of the same colour.
    setTooltipColor(tooltipEl, p7ActorColor(bestEvent.actor));
    tooltipEl.classList.add("is-visible");

    // Left-side events open the tooltip toward the left of the square instead
    // of the right, so it doesn't reach across the canvas's center gap into
    // the opposite side's column — same mirroring convention as page9.js.
    // Mobile: one docked frame above the grid instead of a callout beside the
    // dot — no mirroring, no anchor math, only the contents change (see
    // tooltipDockMobile in js/fold8-tooltip.js). The hit-test above bails out
    // on mobile today (no finger-sized hover target), so this branch only
    // comes alive once tap-to-select lands; it's here so the timeline's own
    // tooltip can never disagree with @fold7/@fold8's about where the frame is.
    const docked = tooltipDockMobile(tooltipEl);
    // Two vertical screen-X lines keep the tooltip off the mini-legends: a dot
    // left of P7_TIP_FLIP_L always opens rightward, a dot within
    // P7_TIP_FLIP_R_INSET of the RIGHT edge always opens leftward; between them
    // the data-side rule holds. Both tuned by eye with a manual/
    // harness — exact px per explicit instruction, don't convert to vw. Each is
    // a px distance from the edge its legend hangs off, so both lines follow a
    // window resize (an absolute right-line screen-X died on narrow windows).
    // On windows narrower than 950px the bands overlap; the right rule runs
    // last, so it wins there — moot in practice, mobile docks the tooltip.
    const dotCX = rect.left + bestPos.x;
    let mirrored = !docked && bestEvent.side === "left";
    if (!docked && dotCX < P7_TIP_FLIP_L) mirrored = false;
    if (!docked && dotCX > window.innerWidth - P7_TIP_FLIP_R_INSET) mirrored = true;
    tooltipEl.classList.toggle("is-mirrored", mirrored);
    if (docked) {
      tooltipEl.classList.remove("is-flipped");
      updateTooltipDash(tooltipEl);
      return;
    }

    // The tooltip hangs off the square's own DRAWN box, not off its top-left
    // corner. On the timeline every square is p7.SQ (3.5px) so corner and edge
    // are the same thing to the eye, but in @fold10's size grid a block can be
    // 68.5px wide: anchoring the rightward tooltip to bestPos.x put it on top
    // of the block instead of beside it (the left/mirrored side looked right
    // only because bestPos.x IS that side's edge). Half-extent includes the
    // hover bulge, same as the hit box above.
    const ownSq  = bestPos.sq ?? p7.SQ;
    const bestB  = p7BulgeT.get(bestEvent);
    const halfX  = ownSq / 2 + (bestB ? (SQ_BULGE(bestEvent) - p7.SQ) * p9Ease(bestB.t) / 2 : 0);
    const centerX = rect.left + bestPos.x + ownSq / 2;
    const centerY = rect.top  + bestPos.y + ownSq / 2;
    const dotClientY = centerY - halfX;   // the drawn box's TOP edge
    const rawLeft = mirrored
      ? centerX - halfX - TOOLTIP_GAP - tooltipEl.offsetWidth
      : centerX + halfX + TOOLTIP_GAP;
    const left = Math.max(8, Math.min(rawLeft, window.innerWidth - tooltipEl.offsetWidth - 8));
    // Opens upward by default; a dot above the P7_TIP_FLIP_Y line flips the box
    // downward instead — same .is-flipped mechanism as @fold13's hover, whose
    // corner logic updateTooltipDash (js/core.js) already understands.
    const rawTop  = dotClientY - TOOLTIP_GAP - tooltipEl.offsetHeight;
    const flipped = dotClientY < P7_TIP_FLIP_Y;
    tooltipEl.classList.toggle("is-flipped", flipped);
    const top = flipped
      ? centerY + halfX + TOOLTIP_GAP
      : rawTop;
    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top  = `${top}px`;
    // After sizing/mirroring are settled — the dash path is drawn to the box's
    // actual pixel size, which changes with the description's line count.
    updateTooltipDash(tooltipEl);
  }

  function onMove(e) {
    lastCX = e.clientX;
    lastCY = e.clientY;
    doHitTest();
  }

  // Expose so callers outside this closure (scroll handler, animation loop)
  // can re-run the hit-test after the canvas redraws.
  p7RecheckHover = doHitTest;

  // Listens on window for the same reason page9.js's p9HoverInit does: other
  // DOM overlays can sit on top of the canvas depending on scroll position.
  window.addEventListener("pointermove", onMove);
  window.addEventListener("scroll", () => {
    if (currentPage !== 8 && currentPage !== 9) hide();
    p7InspectSync();
  }, { passive: true });
}

p7HoverInit();

/* =========================================================================
   MOBILE EVENT PICKER (#page-8 only) — the touch counterpart to p7HoverInit
   =========================================================================
   Touch has no hover, and a solved mobile dot (p7SolveMobileSq: ~1.35px at
   320 wide) is two orders of magnitude below a fingertip, so the timeline had
   no way at all to show an event on a phone. This is the tap-to-inspect layer
   the mobile notes have been deferring.

   Two states, both inside the existing docked tooltip frame — there is no
   button to press first. The gesture itself is the affordance, and the frame's
   resting content is the line of text that names it:

     hint  — the empty frame reads P7_INSPECT_HINT.
     event — the ordinary docked tooltip (date + description). There is no
             dismiss control: the selection stands until the next hold replaces
             it, or until leaving #page-8 releases the frame.

   A press-and-hold anywhere on the chart (P7_LONGPRESS_MS with the finger
   inside P7_LONGPRESS_SLOP_PX) opens a 96px circular loupe riding 60px above
   the finger, blitting the main canvas at 4x (drawImage — there is
   deliberately no second render path to keep in sync with draw()). The nearest
   event is marked by p7DrawInspectScrim's halo, which is painted onto the main
   canvas and so arrives in the blit already magnified. Only that gesture blocks page
   scroll (preventDefault on a non-passive touchmove); a touch that moves
   before the hold completes is a scroll and is left entirely alone. */

const P7_LOUPE_SIZE      = 96; // px, matches .p7-loupe
const P7_LOUPE_ZOOM      = 4;  // magnification
const P7_LOUPE_LIFT_PX   = 60; // how far above the fingertip the loupe centre sits
const P7_INSPECT_SNAP_PX = 44; // furthest a dot can be from the finger and still be picked
const P7_LONGPRESS_MS      = 300; // hold this long, without moving, to open the loupe
const P7_LONGPRESS_SLOP_PX = 10;  // move further than this first and it's a scroll, not a hold
const P7_INSPECT_HINT      = "לחצו והחזיקו על נקודה להצגת פרטי האירוע";
// The hint's own type-in/out tempo. Its own constant rather than
// GROUP_TRANSITION_MS: that 1900ms is the legend system's beat, and a single
// 39-character line reading itself out over nearly two seconds drags — this is
// roughly the fold8 tooltip's per-line feel. Driven by p7InspectHintTrigger
// (js/groups.js), which owns WHEN it plays.
const P7_INSPECT_HINT_TYPE_MS = 900;
// The typewriter's revealed/hidden span pair, built by p7InspectInit below.
// Module-level so the trigger can drive it without reaching into the closure.
let p7HintSpans = null;
// 0 = fully untyped, 1 = fully typed. Safe to call before p7InspectInit has
// run (and on desktop, where the hint is display:none) — it simply no-ops.
function p7InspectHintApply(t) {
  if (!p7HintSpans) return;
  fold8UpdateTypewriter(p7HintSpans, Math.round(p7HintSpans.fullText.length * t));
}
// The clipped-description toggle's two labels (p7-tip-more).
const P7_TIP_MORE          = "עוד";
const P7_TIP_LESS          = "פחות";
// Must match `-webkit-line-clamp` on `.page9-tooltip.is-docked
// .page9-tooltip-desc` (style.css) — syncMore measures the text against this
// budget instead of against the clamped box, which misreports its own height.
const P7_TIP_CLAMP_LINES   = 3;
// The selection halo (p7DrawInspectScrim): how far back everything but the
// picked dot is scrimmed, and the exempt disc's radius in dot widths. Both
// tuned by eye on device.
const P7_INSPECT_SCRIM     = 0.76;
const P7_INSPECT_HOLE_DOTS = 1;
// How much the picked dot's own colour is saturated, 0 = unchanged. Deliberately
// small: it should read as the same group colour, just more insistent.
const P7_INSPECT_PICK_SAT = 0.35;

const p7Inspect = { dragging: false, event: null };

// Assigned by p7InspectInit; a no-op until then so doHitTest/the scroll
// handler above can call it unconditionally (and harmlessly on desktop).
let p7InspectSync = () => {};

// Which fold the picker is currently serving, or null. @fold9's pinned timeline
// (page 7) is where it started; @fold13's drag-and-drop grid (page 9) reuses the
// exact same gesture, loupe and docked frame, since its dots are 1px there and
// touch has no hover to fall back on. Everything below that differs between the
// two folds reads this rather than testing currentPage inline.
function p7InspectPage() {
  if (!isMobile()) return null;
  return (currentPage === 8 || currentPage === 12) ? currentPage : null;
}

// The dot map the picker hit-tests against, per fold — same shape either way:
// a Map of event -> {x, y} in CSS-pixel canvas space, recorded by that fold's
// own draw. `maxY` excludes dots the fold doesn't consider inspectable (page 9's
// legit band below the divider, matching desktop p9HoverInit's own exclusion).
function p7InspectSource() {
  if (currentPage === 12) {
    return { positions: p9.lastPositions, half: p9Metrics().SQ / 2, cell: p9Metrics().CELL, maxY: p9.midY ?? Infinity };
  }
  return { positions: p7.lastPositions, half: p7Sq() / 2, cell: p7Cell(), maxY: Infinity };
}

function p7InspectInit() {
  const tipEl    = document.getElementById("page9Tooltip");
  const dateEl   = tipEl.querySelector(".page9-tooltip-date");
  const descEl   = tipEl.querySelector(".page9-tooltip-desc");
  const canvasEl = document.getElementById("canvas");

  // --- the resting content: one line of text, no control -------------------
  // Typed rather than printed: the line is a gesture instruction, and the
  // gesture is only live on the two folds the picker serves, so it types itself
  // in and out with them (p7InspectHintTrigger, js/groups.js — untyped on
  // @fold11's crossing, typed back on @fold13's stick). Same two-span
  // revealed/hidden rig every other typewriter on the page uses, so the line's
  // box never reflows as the characters arrive.
  const hintEl = document.createElement("div");
  hintEl.className = "p7-inspect-hint";
  p7HintSpans = fold8SetupTypewriter(hintEl, P7_INSPECT_HINT);

  // --- "read the rest" -----------------------------------------------------
  // Most descriptions fit the frame's three clamped lines; the long tail does
  // not, and ends in an ellipsis (see .page9-tooltip.is-docked .page9-tooltip-desc
  // in style.css). This is the way out of that clip: it appears ONLY when the
  // text is actually clipped, and opening it grows the frame downward over the
  // chart — never pushing the grid, whose top clearance is derived from the
  // collapsed height (SBB_TIMELINE_MOBILE_TOP_PX).
  // A label, not a <button>: the tap target is the whole frame (the click
  // handler below), so a nested control that can't be clicked would only be a
  // second, misleading target.
  const moreEl = document.createElement("div");
  moreEl.className = "p7-tip-more";

  tipEl.append(hintEl, moreEl);

  // Truncation can only be MEASURED, not predicted — it depends on where the
  // Hebrew wraps at this viewport's width. But it cannot be measured on the
  // description element itself: -webkit-line-clamp truncates that box's LAYOUT
  // rather than merely hiding overflow, so a clamped element reports its
  // clamped height as `scrollHeight` and every scrollHeight > clientHeight test
  // reads "fits" no matter how long the text is. (Lifting the clamp for one
  // forced reflow and reading it back doesn't survive every engine either.)
  //
  // So the text is laid out a second time, offscreen, in a box that is a copy
  // of the description's own width and type but has no clamp to lie about:
  // whatever height it comes to is the honest one.
  const measEl = document.createElement("div");
  measEl.setAttribute("aria-hidden", "true");
  Object.assign(measEl.style, {
    position: "absolute", left: "-9999px", top: "0",
    visibility: "hidden", pointerEvents: "none", whiteSpace: "normal",
  });
  document.body.appendChild(measEl);

  function syncMore() {
    const expanded = tipEl.classList.contains("is-expanded");
    let clipped = false;
    // The description spans the frame's content box, so the frame's own inner
    // width stands in whenever the description itself can't be measured (it is
    // display:none in the picker's resting state). Without that fallback a
    // mistimed call fails SILENTLY as "fits" — which is exactly how this went
    // unnoticed before.
    const width = descEl.clientWidth ||
      (tipEl.clientWidth - 20 /* .page9-tooltip padding, style.css */);
    if (!expanded && width > 0) {
      const cs = getComputedStyle(descEl);
      measEl.style.font       = cs.font;
      measEl.style.lineHeight = cs.lineHeight;
      measEl.style.direction  = cs.direction;
      measEl.style.width      = `${width}px`;
      measEl.textContent      = descEl.textContent;
      // Compared against the clamp's own budget (lines × line-height) rather
      // than the live box's clientHeight, so the test never depends on the
      // clamped element reporting anything truthfully.
      const line = parseFloat(cs.lineHeight) || 17;
      clipped = measEl.offsetHeight > line * P7_TIP_CLAMP_LINES + 1;
    }
    tipEl.classList.toggle("is-expandable", clipped || expanded);
    moreEl.textContent = expanded ? P7_TIP_LESS : P7_TIP_MORE;
  }

  function collapseMore() {
    tipEl.classList.remove("is-expanded", "is-expandable");
  }

  // The whole FRAME is the target, not the little label — a full-width tap area
  // instead of a 30px word. It only accepts events at all while there is
  // something to open (.is-expandable / .is-expanded opt back into
  // pointer-events; see style.css), so in every other state a touch here falls
  // through to the chart exactly as before.
  //
  // It listens on touchend as well as click, not instead of it: the window-level
  // touch handlers further down call preventDefault while a hold is live, and a
  // touch sequence that has been prevented may never emit the synthetic click at
  // all. `lastToggle` swallows the click that normally follows the same tap, so
  // a phone that does emit both doesn't toggle twice and land back where it was.
  let lastToggle = 0;
  function toggleMore(e) {
    if (!tipEl.classList.contains("is-expandable") &&
        !tipEl.classList.contains("is-expanded")) return;
    const now = performance.now();
    if (now - lastToggle < 400) return;
    lastToggle = now;
    // The frame sits over the chart and the tray; without this the tap reaches
    // whatever is behind it (a category pill on @fold13).
    e.stopPropagation();
    tipEl.classList.toggle("is-expanded");
    syncMore();
    // The dashed border is an <svg> sized to the box's own pixel dimensions, so
    // a box that just changed height has to have it rebuilt or the stroke keeps
    // the old outline (js/core.js).
    updateTooltipDash(tipEl);
  }
  tipEl.addEventListener("click", toggleMore);
  tipEl.addEventListener("touchend", toggleMore);

  // --- the loupe ----------------------------------------------------------
  // A sibling of the tooltip in .layout for the same reason #page9Tooltip is
  // one: .graphic-col's stacking context traps any z-index declared inside it.
  const loupeEl = document.createElement("canvas");
  loupeEl.className = "p7-loupe";
  loupeEl.setAttribute("aria-hidden", "true");
  tipEl.parentNode.appendChild(loupeEl);
  const lctx = loupeEl.getContext("2d");

  function hideLoupe() {
    p7Inspect.dragging = false;
    window.removeEventListener("touchmove", loupeMove, { passive: false });
    // The dodge belongs to the live finger — lifting it snaps the frame
    // straight back to its resting spot.
    if (p7TipAvoidActive) {
      p7TipAvoidActive = false;
      tooltipDockMobile(tipEl);
    }
    // Dragging is what holds the axis in its hover/state-3 treatment (see
    // p7DrawAxisLine), so the release is where its fade-out has to start.
    p7StartAnimLoop();
    loupeEl.classList.remove("is-visible");
    // The halo is painted into the canvas and only lives for the drag, so
    // lifting the finger has to repaint — nothing else is animating a settled
    // fold, and the chart would otherwise stay dimmed.
    draw();
    // Same for the 8 DOM squares that carry the scrim's dim themselves.
    if (typeof updateGroups === "function") updateGroups();
  }

  // Hands the frame back to @fold7/@fold8's scripted sequence. Its typewriter
  // spans are rebuilt rather than its whole sequence restarted: the spans were
  // detached the moment this picker wrote plain textContent into the same two
  // elements, but fold8SeqElapsed is still valid, so re-seeding them leaves the
  // sequence exactly where it was instead of replaying its grow+type from zero
  // (which would read as the empty frame flickering back in).
  function release() {
    p7Inspect.event = null;
    hideLoupe();
    p7InspectOwnsTooltip = false;
    collapseMore();
    dateEl.textContent = "";
    descEl.textContent = "";
    // Back to the neutral resting grey. The picker state has no fill or border
    // any more (style.css, `.is-docked.is-picker`) — the hint line prints on
    // the bare page in `currentColor`, so whatever group colour the released
    // event left on the element would tint the instruction text. updateGroups'
    // keepEmptyFrame branch writes this same grey, but only while it runs.
    setTooltipColor(tipEl, `rgb(${FOLD8_TOOLTIP_REST_COLOR.join(",")})`);
    // @fold9 only — page 9 has no scripted typewriter sequence sharing these
    // two elements, so there is nothing to hand the frame back to there.
    if (currentPage === 8 && typeof fold8SequenceEvent !== "undefined" && fold8SequenceEvent) {
      fold8DateSpans = fold8SetupTypewriter(dateEl, p7FormatDateDMY(fold8SequenceEvent.date));
      fold8DescSpans = fold8SetupTypewriter(descEl, fold8SequenceEvent.descHeMedium || "");
    }
    if (typeof updateGroups === "function") updateGroups();
  }

  function showEvent(ev) {
    p7Inspect.event = ev;
    p7InspectOwnsTooltip = true;
    // The selection marks its date on the year axis with the hover treatment
    // (see p7DrawAxisLine) — the roster fade eases per frame, so the loop has
    // to be running, same as p7HoverInit does when a hover starts.
    p7StartAnimLoop();
    dateEl.textContent = p7FormatDateDMY(ev.date);
    descEl.textContent = ev.descHeMedium || "";
    // The sequence's own inline fades are still on these two elements from the
    // @fold8 shrink beat that emptied the frame — clear them or the text this
    // picker just wrote is invisible.
    dateEl.style.opacity = "1";
    descEl.style.opacity = "1";
    // setTooltipColor (js/core.js) — the dashed stroke is the <svg> overlay on
    // currentColor; --tip-fill rides along for the desktop filled box. This
    // picker is mobile-only, so only the stroke is visible here, but the two
    // properties are kept in step everywhere so no writer can drift.
    setTooltipColor(tipEl, p7ActorColor(ev.actor));
    // Same fold13 factor as sync() below — every writer of this element's
    // opacity must agree during @fold14's scroll fade.
    tipEl.style.opacity =
      String(1 - (typeof p9 !== "undefined" ? (p9.fold13OutT ?? 0) : 0));
    tipEl.style.transform = "translateX(-50%)";
    tipEl.classList.remove("is-mirrored");
    tipEl.classList.remove("is-flipped");
    tipEl.classList.add("is-visible");
    // A new event is a new read: the frame goes back to its collapsed size
    // before the toggle is re-tested, so an open frame can't be left open (and
    // covering the chart) around a description that fits.
    collapseMore();
    tooltipDockMobile(tipEl);
    updateTooltipDash(tipEl);
    // sync() BEFORE syncMore(), and the order is load-bearing: sync() is what
    // drops `is-picker`, and `.is-picker .page9-tooltip-desc` is display:none.
    // Measuring the description while that class is still on measures a hidden
    // box — zero width, no line boxes — so the clip test always reads "fits"
    // and the toggle never appears.
    sync();
    syncMore();
    // While the finger is still down (the loupe is live), a clipped
    // description opens in full immediately — the reader can't tap the
    // frame mid-hold, and the point of the picker is reading the event
    // under the finger. The release (onEnd below) collapses it again; a
    // tap afterwards reopens it through the normal toggle.
    // `is-holding` hides the עוד/פחות label for the duration (style.css):
    // mid-hold it isn't a control — the finger is on the chart — and a
    // "פחות" on a frame that will collapse by itself on release is noise.
    if (p7Inspect.dragging && tipEl.classList.contains("is-expandable")) {
      tipEl.classList.add("is-expanded", "is-holding");
      syncMore();
      updateTooltipDash(tipEl);
    }
  }

  // Nearest dot to a canvas-space point, within P7_INSPECT_SNAP_PX. Same
  // brute-force scan over p7.lastPositions doHitTest uses — that map holds only
  // the squares actually drawn this frame, already in CSS-pixel space.
  function nearestEvent(mx, my) {
    const { positions, half, maxY } = p7InspectSource();
    if (!positions) return null;
    let best = null, bestDist = P7_INSPECT_SNAP_PX * P7_INSPECT_SNAP_PX, bestPos = null;
    for (const [ev, pos] of positions) {
      if (pos.y >= maxY) continue;
      const dx = mx - (pos.x + half), dy = my - (pos.y + half);
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) { bestDist = dist; best = ev; bestPos = pos; }
    }
    return best ? { event: best, x: bestPos.x + half, y: bestPos.y + half } : null;
  }

  // Flips p7TipAvoidActive (js/fold8-tooltip.js) from the finger's height: if
  // the loupe's glass would reach into the docked frame's NORMAL spot, the
  // frame snaps to its dodge spot above the year axis (tooltipAvoidPx). The
  // threshold is computed against where the frame RESTS on this fold — a
  // constant per fold, not the frame's live rect — so a frame already
  // mid-dodge can't drag the threshold down with it and flip-flop. 100 is the
  // collapsed frame height (style.css solves it against the 15px type); an
  // expanded frame reaches lower, but the dodge only needs the common case.
  // Re-docks every call, not just on the flip: the dodge spot is
  // bottom-anchored on the frame's live height, which changes mid-hold as
  // selections swap and descriptions expand.
  function syncTipAvoid(fingerY) {
    const onFold12 = currentPage === 12 && typeof p9DockTopM === "function";
    const frameTop = onFold12 ? p9DockTopM() : tooltipDockRestPx();
    const frameBottom = frameTop + 100;
    // The threshold sits a bit past the frame's edge (explicit instruction,
    // first on @fold13 then @fold9 too) — the finger doesn't have to travel as
    // far before the frame snaps clear.
    const AVOID_MARGIN_PX = 24;
    if (onFold12) {
      // Frame high, loupe rising into it from below.
      const loupeTop = fingerY - P7_LOUPE_LIFT_PX - P7_LOUPE_SIZE / 2;
      p7TipAvoidActive = loupeTop < frameBottom + AVOID_MARGIN_PX;
    } else {
      // @fold9: the frame rests at the BOTTOM of the screen, so the collision
      // is a finger held LOW — the loupe's bottom edge reaching down into the
      // frame's top edge. Testing the top edge here (as the @fold13 branch
      // does) would be true for almost any finger and leave the frame
      // permanently dodged.
      const loupeBottom = fingerY - P7_LOUPE_LIFT_PX + P7_LOUPE_SIZE / 2;
      p7TipAvoidActive = loupeBottom > frameTop - AVOID_MARGIN_PX;
    }
    tooltipDockMobile(tipEl);
  }

  function drawLoupe(cx, cy) {
    syncTipAvoid(cy);
    const rect = canvasEl.getBoundingClientRect();
    const mx = cx - rect.left, my = cy - rect.top;
    const dpr = window.devicePixelRatio || 1;
    const src = P7_LOUPE_SIZE / P7_LOUPE_ZOOM; // CSS px of canvas sampled, per side

    if (loupeEl.width !== P7_LOUPE_SIZE * dpr) {
      loupeEl.width  = P7_LOUPE_SIZE * dpr;
      loupeEl.height = P7_LOUPE_SIZE * dpr;
    }
    // Pick the dot BEFORE blitting, and repaint the main canvas if the pick
    // changed: the selection halo (p7DrawInspectScrim) lives on that canvas, and
    // the loupe is a plain blit of it. Painting the halo first is what puts it in
    // the glass — magnified along with everything else, with no second render
    // path to keep in sync. Without the repaint the loupe would show the previous
    // frame's halo, since nothing else is animating a settled timeline.
    const hit = nearestEvent(mx, my);
    // updateGroups() alongside it: the 8 fold6 DOM squares carry the same
    // scrim dim as the canvas dots under them (see updateGroups' own
    // P7_INSPECT_SCRIM clause), and draw() alone doesn't touch DOM.
    if (hit && hit.event !== p7Inspect.event) {
      showEvent(hit.event);
      draw();
      if (typeof updateGroups === "function") updateGroups();
    }

    lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lctx.clearRect(0, 0, P7_LOUPE_SIZE, P7_LOUPE_SIZE);
    lctx.fillStyle = "#fff";
    lctx.fillRect(0, 0, P7_LOUPE_SIZE, P7_LOUPE_SIZE);
    // The main canvas's backing store is DPR-scaled (see draw() in js/core.js),
    // so the source rect is in device pixels while the destination is CSS px.
    const sx = (mx - src / 2) * dpr, sy = (my - src / 2) * dpr;
    lctx.imageSmoothingEnabled = false; // dots are 1–2px; smoothing turns them to mush
    lctx.drawImage(canvasEl, sx, sy, src * dpr, src * dpr, 0, 0, P7_LOUPE_SIZE, P7_LOUPE_SIZE);

    // Held above the fingertip so the finger isn't covering what's being read,
    // and clamped so it stays fully on screen near the edges.
    const half = P7_LOUPE_SIZE / 2;
    const left = Math.max(4, Math.min(cx - half, window.innerWidth - P7_LOUPE_SIZE - 4));
    const top  = Math.max(4, cy - P7_LOUPE_LIFT_PX - half);
    loupeEl.style.left = `${left}px`;
    loupeEl.style.top  = `${top}px`;
    loupeEl.classList.add("is-visible");
  }

  // Keeps the frame's three states in step with the page. Cheap and
  // idempotent — called from doHitTest (i.e. every redraw/scroll) as well as
  // from the interactions below.
  function sync() {
    const active = p7InspectPage() !== null;
    if (!active) {
      if (p7Inspect.event || p7InspectOwnsTooltip) release();
      // @fold10, @fold11 and @fold12's bridge (pages 9–11) sit BETWEEN the two
      // folds the picker serves, and updateGroups' keepEmptyFrame branch
      // deliberately keeps the docked frame on screen through them (gliding
      // down to p9DockTopM()). Without is-picker the hint is display:none AND
      // the frame regains its fill, so it would sit there as a blank grey slab
      // (the @fold10 "grey frame at the bottom" bug when page 9 was left out
      // of this range) — keep the hint's class on, gesture still off.
      tipEl.classList.toggle("is-picker", isMobile() && currentPage >= 9 && currentPage <= 11);
      tipEl.classList.remove("is-inspect");
      return;
    }
    const hasEvent = !!p7Inspect.event;
    tipEl.classList.toggle("is-picker", !hasEvent);
    tipEl.classList.toggle("is-inspect", hasEvent);
    // The frame is normally held open (empty) by updateGroups' keepEmptyFrame
    // branch; assert it here too so the control can never be invisible inside
    // a frame that happens to be down.
    if (!hasEvent) {
      tipEl.classList.add("is-visible");
      // × (1 - fold13OutT): sync() runs on every redraw/scroll while the
      // picker's page is active, which is still true through @fold14's
      // scroll-in (currentPage stays 9 until the observer flips) — an
      // unconditional "1" here re-asserted full opacity between updateFold13's
      // fade writes every frame, making the frame stutter instead of fading.
      tipEl.style.opacity =
        String(1 - (typeof p9 !== "undefined" ? (p9.fold13OutT ?? 0) : 0));
      tipEl.style.transform = "translateX(-50%)";
      tooltipDockMobile(tipEl);
      updateTooltipDash(tipEl);
    }
  }
  p7InspectSync = sync;
  // Prime the hint from the page's starting scroll position — set(), not
  // trigger(), so a reload deep in the page doesn't play a type-in nobody asked
  // for (and a reload at the top doesn't start with an empty frame).
  if (typeof p7SyncInspectHint === "function") p7SyncInspectHint(true);

  // --- the press-and-hold gesture -----------------------------------------
  // There is no armed mode to enter, so the hold itself has to distinguish
  // "inspect" from "scroll". A touch on the chart starts a timer; movement past
  // P7_LONGPRESS_SLOP_PX doesn't kill it — it RE-ANCHORS it (armTimer below at
  // the new position), so a finger that drag-scrolls the pinned timeline and
  // then comes to rest WITHOUT lifting still opens the loupe after
  // P7_LONGPRESS_MS of stillness. (It used to cancel outright, which made a
  // hold impossible mid-scroll — precisely when the cascade is popping dots in,
  // since on the pinned fold the scrolling finger is what drives it.) While the
  // finger keeps moving the re-anchors keep pushing the deadline back, so a
  // live scroll never opens it. Only once the hold completes does touchmove
  // start calling preventDefault — up to that point the page scrolls exactly
  // as it does today.
  //
  // The one case the re-anchor can't reach is iOS momentum, and it can't be
  // reached from here at all: while a fling is coasting, WebKit delivers NO
  // touch or pointer events to the page whatsoever. Verified on-device with a
  // trace harness — a finger planted on a coasting timeline and held for two
  // seconds produced not one touchstart, not one pointerdown, not one
  // touchcancel. So no handler in this file can arm, re-arm or rescue a hold
  // during a coast; the events simply don't exist until the page settles.
  // Machinery that tried to (P7_COAST_MS/P7_STEAL_MS/armedAfterCancel/
  // P7_HOLD_GRACE_MS, keyed on a touchcancel that never fires) was removed —
  // don't reintroduce it. The reader lifting and pressing again once the page
  // has stopped is, for now, the only path that works.
  let pendingTimer = null, startX = 0, startY = 0;

  function cancelPending() {
    if (pendingTimer !== null) { clearTimeout(pendingTimer); pendingTimer = null; }
  }

  function armTimer(x, y) {
    cancelPending();
    startX = x;
    startY = y;
    pendingTimer = setTimeout(() => {
      pendingTimer = null;
      p7Inspect.dragging = true;
      window.addEventListener("touchmove", loupeMove, { passive: false });
      loupeX = startX;
      loupeY = startY;
      drawLoupe(loupeX, loupeY);
      // The scrim arrives with `dragging`; the 8 DOM squares only learn about
      // it here (drawLoupe repaints the canvas, not the DOM) — and won't at all
      // if the first hit is already the selected event.
      if (typeof updateGroups === "function") updateGroups();
      requestAnimationFrame(loupeTick);
    }, P7_LONGPRESS_MS);
  }

  function chartTouch(e) {
    if (p7InspectPage() === null) return null;
    const t = e.touches[0];
    if (!t) return null;
    const inside = el => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return t.clientY >= r.top && t.clientY <= r.bottom &&
             t.clientX >= r.left && t.clientX <= r.right;
    };
    // The docked frame is opaque and sits over the chart's top strip — a hold
    // there is reading the tooltip, not aiming at a dot behind it. Same for
    // @fold13's tray: a hold on a pill is a (mis-timed) classification tap, and
    // opening the loupe over it would swallow the tap's own click.
    if (inside(tipEl)) return null;
    if (currentPage === 12 && inside(document.querySelector(".page9-tray"))) return null;
    return t;
  }

  window.addEventListener("touchstart", (e) => {
    cancelPending();
    const t = chartTouch(e);
    if (!t) return;
    armTimer(t.clientX, t.clientY);
  }, { passive: true });

  // Re-run the pick + loupe blit every frame while the hold is live, at the
  // last known finger position. The pick otherwise only happens at timer fire
  // and on touchmove — so a hold started while the month cascade is still
  // popping dots in would open on nothing and STAY on nothing under a still
  // finger, even once dots have appeared right under it (this was the "first
  // hold needs two tries" bug). The per-frame pass also keeps the loupe glass
  // itself live while the canvas animates, instead of freezing on the blit
  // from the moment the finger last moved. drawLoupe is cheap (one 96px blit;
  // it only repaints the main canvas when the picked dot actually changes).
  // loupeX/loupeY are what touchmove keeps current below.
  let loupeX = 0, loupeY = 0;
  function loupeTick() {
    if (!p7Inspect.dragging) return;
    drawLoupe(loupeX, loupeY);
    requestAnimationFrame(loupeTick);
  }

  // Two listeners, deliberately: the always-on one is PASSIVE. A non-passive
  // touchmove bound to window for the page's whole life stops mobile browsers
  // from collapsing their URL/bottom bar (the browser can't know in advance
  // that the handler won't cancel the scroll, so it treats every drag as
  // possibly-cancelled and keeps the chrome pinned). The half that actually
  // calls preventDefault is therefore attached only while a hold is live —
  // added in armTimer's timeout, removed by hideLoupe — so outside the gesture
  // the page scrolls with nothing non-passive listening.
  window.addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    if (!t) return;
    if (pendingTimer !== null) {
      // Finger is scrolling: re-anchor at the new position and restart the
      // clock, instead of giving up. A finger that then stays within slop for
      // P7_LONGPRESS_MS — i.e. comes to rest without lifting — fires the hold
      // right where it stopped; a finger that keeps moving keeps pushing the
      // deadline back and the scroll stays untouched.
      if (Math.abs(t.clientX - startX) > P7_LONGPRESS_SLOP_PX ||
          Math.abs(t.clientY - startY) > P7_LONGPRESS_SLOP_PX)
        armTimer(t.clientX, t.clientY);
      return;
    }
  }, { passive: true });

  // The hold-time half: only bound while p7Inspect.dragging.
  function loupeMove(e) {
    const t = e.touches[0];
    if (!t) return;
    if (!p7Inspect.dragging) return;
    e.preventDefault();
    loupeX = t.clientX;
    loupeY = t.clientY;
    drawLoupe(loupeX, loupeY);
  }

  // Release drops the selection entirely — the frame goes back to its resting
  // state: the "לחצו והחזיקו" hint, the neutral gray stroke (restored by
  // updateGroups' keepEmptyFrame branch, which repaints the color every frame
  // it runs), no date, no description. The reading belongs to the gesture, not
  // to the page: an event's text and its actor-colored stroke parked there
  // after the finger lifts read as permanent furniture, and kept covering the
  // chart the gesture had just been used to explore.
  //
  // release() does the whole teardown (event, tooltip ownership, text, and
  // @fold9's handback to its scripted typewriter) and calls hideLoupe() itself.
  // Then sync() flips the frame is-inspect -> is-picker.
  const onEnd = () => {
    cancelPending();
    if (p7Inspect.dragging) {
      tipEl.classList.remove("is-expanded", "is-holding");
      release();
      // sync()'s resting branch re-docks the frame and redraws the dashed
      // stroke for its collapsed height, so no separate updateTooltipDash here.
      sync();
    }
  };
  window.addEventListener("touchend", onEnd);
  window.addEventListener("touchcancel", onEnd);

  sync();
}

// --- Removed: the momentum brake (2026-09-05) --------------------------------
// p7BrakeInit used to take over a flick's deceleration on the picker folds
// (@fold9/@fold13, mobile): on touchend it cancelled the imminent native fling
// with a programmatic scrollTo and ran its own faster rAF glide, so that touch
// events kept arriving during the coast and a finger landing on the moving
// timeline could stop it and start a hold (iOS delivers NO touch events while
// a native fling coasts, so that gesture is impossible otherwise).
//
// It cost the browser's URL/bottom bar: a scrollTo-driven coast isn't
// user-driven scrolling, so the bar never collapsed on the two longest folds
// of the page. The bar won, by explicit decision. Don't reintroduce a
// scroll-driving glide — if the mid-coast hold is ever wanted back, it needs a
// mechanism that doesn't move the page from script.

// page7.js is the FIRST script on the page (before js/core.js — see
// project.html), so unlike p7HoverInit above this can't run inline: it reads
// isMobile()/currentPage/tooltipDockMobile at init, none of which exist yet.
// The scripts all sit at the end of <body>, so DOMContentLoaded is after them.
document.addEventListener("DOMContentLoaded", p7InspectInit);
