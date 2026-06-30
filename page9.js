const P9_CATEGORIES = [
  "הפגנה לא אלימה",
  "פוגרום",
  "הטרדה ואיומים",
  "חטיפה",
  "תקיפה חמושה של בלתי מעורב",
  "תקיפה פיזית של בלתי מעורב",
  "הפרות סדר",
  "השתלטות על שטח",
  "פגיעה ברכוש",
  "חסימת כביש",
];

// Each category's permanent (row, column) slot in the tray's #page9ZoneBelow
// — indexed in parallel with P9_CATEGORIES. Fixed regardless of which
// categories are currently dropped into #page9ZoneAbove: dragging one out
// just empties its cell instead of reflowing the others to fill the gap
// (see p9BuildPanel, which assigns these via each pill's own grid-column
// rather than relying on flex-wrap source order). Each row is its own
// independent grid (.page9-tray-row, one per `row` value here) rather than
// one grid shared across all 3 rows — sharing tracks would force every
// column wide enough to fit whichever row's pill in that column is widest
// (e.g. row 2's two long labels), leaving every shorter pill stranded with
// uneven left/right padding instead of an even gap to its neighbor. With
// independent per-row grids, every column is sized to just that row's own
// content, so the gap between any two adjacent pills is exactly the row's
// own `gap` value, never inflated by a different row's longer label.
const P9_TRAY_GRID = [
  { row: 1, col: 1 },
  { row: 1, col: 2 },
  { row: 1, col: 3 },
  { row: 1, col: 4 },
  { row: 2, col: 1 },
  { row: 2, col: 2 },
  { row: 3, col: 1 },
  { row: 3, col: 2 },
  { row: 3, col: 3 },
  { row: 3, col: 4 },
];

const P9_SQ      = 3;
const P9_GAP  = 1;
const P9_CELL = P9_SQ + P9_GAP;
const P9_MID  = 719 / 982; // divider position as fraction of H (~73.22vh) — Figma's own measured position; previously raised to 0.65 per an earlier explicit request to move it higher, now lowered back per a later one. Every grid (extreme above, legit below) derives its own geometry from H * P9_MID fresh each frame, so moving this one constant reflows both sides automatically — no other layout code needs to change.

// Fallback gap (before the real, text-derived gap below is measured) reserved
// at center between the extreme grid's two column-blocks — wide enough for the
// floating dropped-category labels (.page9-zone-wrap-extreme, centered at W/2)
// to sit without overlapping the squares, matching Figma's own reference (node
// 136:418305), whose two blocks sit ~415px apart on a 1512-wide frame to leave
// room for exactly this.
const P9_EXTREME_GAP = 320;

// Matches the dashed border-width of .page9-sticky.dragging #page9ZoneAbove
// (style.css) — needed below because the page-wide `* { box-sizing:
// border-box }` reset means a `height` set on that element is the *total*
// box height, border and padding included, not just the content area.
const P9_ZONE_DRAG_BORDER = 2;

// Padding added on top of the widest pill's own rendered width (see
// p9.maxPillWidth, set once in p9BuildPanel) to get the real gap width —
// breathing room on each side so the label isn't flush against the squares.
const P9_GAP_PADDING = 48;

// Maps English category names (from events.json) to P9_CATEGORIES index
const CATEGORY_EN_TO_IDX = {
  "Peaceful protest":                       0,
  "Pogrom":                                 1,
  "Threats and harassment":                 2,
  "Abduction":                              3,
  "Armed attack against uninvolved person": 4,
  "Physical assault of uninvolved person":  5,
  "Public disorder":                        6,
  "Land takeover":                          7,
  "Property damage":                        8,
  "Road blocking":                          9,
};

// 0..1 eased progress of the horizontal divider line growing in from the left —
// not scroll-driven: a fixed-duration animation triggered once the title card
// crosses the viewport's vertical center (see p9TriggerLine, called from
// page9UpdateFromScroll in main.js — same frac-0.5 convention as every other
// fold's title-driven animation, deliberately NOT tied to .page9-sticky's own
// pin state, see that function's comment), playing on its own clock the same
// way page8's dot-grid transition does. The reverse plays if the title
// scrolls back above center before settling.
let page9LineT       = 0;     // current eased value, read directly by drawPage9
let p9LineFromT       = 0;    // raw (un-eased) progress the current phase started from
let p9LineToT         = 0;    // raw progress the current phase is heading toward (1 or 0)
let p9LinePhaseStart  = null; // performance.now() when the current phase began; null = at rest
const P9_LINE_DURATION = 800; // ms — playback time of a full 0->1 traverse

function p9LineCurrentRaw() {
  if (p9LinePhaseStart === null) return p9LineFromT;
  const span = p9LineToT - p9LineFromT;
  if (span === 0) return p9LineToT;
  const localT = Math.min(1, (performance.now() - p9LinePhaseStart) / (P9_LINE_DURATION * Math.abs(span)));
  return p9LineFromT + span * localT;
}

function p9LineRunLoop() {
  if (p9LinePhaseStart === null) return;
  const raw = p9LineCurrentRaw();
  page9LineT = p9Ease(raw);
  if (currentPage === 10) draw();
  if (raw !== p9LineToT) {
    requestAnimationFrame(p9LineRunLoop);
  } else {
    p9LineFromT      = p9LineToT;
    p9LinePhaseStart = null;
    if (currentPage === 10) draw();
  }
}

// toT: 1 to grow in (title card just crossed viewport center), 0 to retract
// (title scrolled back above center). Idempotent — calling with the value
// already at rest is a no-op.
function p9TriggerLine(toT) {
  if (p9LinePhaseStart === null && p9LineCurrentRaw() === toT) return;
  p9LineFromT      = p9LineCurrentRaw();
  p9LineToT        = toT;
  p9LinePhaseStart = performance.now();
  p9LineRunLoop();
}

const p9 = {
  cols: 0,
  leftTopPos: [], leftBotPos: [],
  rightTopPos: [], rightBotPos: [],
  sides:       [],
  aboveReach:  0,
  belowReach:  0,
  lastW: 0, lastH: 0,
  // Shared column count for the extreme grid's two side-blocks — monotonic,
  // only ever grows (see drawPage9), so it doesn't reflow either side just to
  // shrink back down again.
  extremeColsSticky: 1,
  // Persistent draw order for the extreme grid — newcomers are appended to the
  // end (see p9SyncTopOrder) so already-placed dots keep the same column-major
  // slot they had before, and a newly-dropped category's dots build on top of
  // that existing structure instead of the whole block recomputing from scratch.
  leftTopOrder: [], rightTopOrder: [],
  // Per-event {x,y,alpha} from the most recently completed render — the "from"
  // side of the next transition, keyed by event object reference (stable across
  // renders, since p7.leftEvents/rightEvents are loaded once and only filtered/
  // reordered, never recreated).
  lastPositions: new Map(),
  // { from: Map, start: timestamp, duration } while a category is moving between
  // extreme/legit; null when at rest.
  anim: null,
  // The event currently under the pointer in #page-10 (set by p9HoverInit's
  // onMove), or null — read by p9PlaceDot to dim every other dot while one is
  // hovered.
  hoveredEvent: null,
  // Category index (P9_CATEGORIES) whose dropped pill is currently hovered in
  // #page9ZoneAbove, or null — all dots of that category stay full opacity,
  // the rest dim by the same 0.35 factor as dot-hover. Takes effect only when
  // hoveredEvent is null (dot-hover takes priority).
  hoveredCategoryIdx: null,
  // 0 = no dim, 1 = fully dimmed — animated by p9HoverDimAnimate in p9HoverInit
  // so the dimming fades in/out rather than snapping.
  hoverDimT: 0,
  // Keeps the last-highlighted category index alive during fade-out so dots
  // that were at full opacity don't jump dim the instant hoveredCategoryIdx clears.
  hoverDimCategoryIdx: null,
};

// Gentle sine-based ease-in-out — a soft, slow ramp up and down rather than the
// punchy cubic curve, applied manually since this drives canvas redraws rather
// than a CSS transition.
function p9Ease(t) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

// Drives the redraw loop while p9.anim is active — every frame just re-invokes
// the normal page draw (drawPage9 itself blends toward the live target using
// p9.anim), so this has no rendering logic of its own.
function p9RunAnimLoop() {
  if (!p9.anim) return;
  const t = (performance.now() - p9.anim.start) / p9.anim.duration;
  if (currentPage === 10) draw();
  if (t < 1) {
    requestAnimationFrame(p9RunAnimLoop);
  } else {
    p9.anim = null;
    if (currentPage === 10) draw();
  }
}

// Count-up animation for the extreme-zone labels — separate from p9.anim (dot
// movement). commitDrop sets start = drop time + dot-anim duration, so the
// labels stay frozen at the pre-drop count while dots travel, then count up
// once they've arrived. fromLeft/toLeft (and right) are the integer endpoints.
let p9CountAnim = null; // { fromLeft, toLeft, fromRight, toRight, start, duration }

function p9CountRunLoop() {
  if (!p9CountAnim) return;
  if (currentPage === 10) draw(); // draw() self-clears p9CountAnim via p9GetDisplayedCounts
  if (p9CountAnim) requestAnimationFrame(p9CountRunLoop);
}

// Bottom-to-top stacking order for the extreme grid: settlers (orange) lowest,
// then Right-wing activists (green), then Haredi Jews (black) — and on the
// other side, Protesters against the government (blue) below left wing
// activists (pink). This is a *global* ranking, not just "whatever order
// categories were dropped in".
const P9_ACTOR_ORDER = [
  "Protesters against the government",
  "left wing activists",
  "settlers",
  "Right-wing activists",
  "Haredi Jews",
];

// Assigns each event a permanent arrival sequence number the first time it's
// seen, so that within the same actor, dots keep their relative order (oldest
// stays lowest) even though the array gets fully re-sorted by actor every frame.
let p9NextSeq = 0;
const p9SeqOf = (() => {
  const seqMap = new WeakMap();
  return e => {
    if (!seqMap.has(e)) seqMap.set(e, p9NextSeq++);
    return seqMap.get(e);
  };
})();

// Keeps orderArr holding exactly currentSet's members, sorted globally by actor
// rank (ties broken by arrival order) — so the color stacking is always
// orange/blue-below, black/pink-above regardless of which category got dropped
// in which order. A newcomer whose actor outranks something already in the
// stack does shift that existing block up to make room — necessary to keep the
// color order correct, but it's the minimum reflow that requires, and existing
// same-actor dots never reorder relative to each other.
function p9SyncTopOrder(orderArr, currentSet) {
  for (let i = orderArr.length - 1; i >= 0; i--) {
    if (!currentSet.has(orderArr[i])) orderArr.splice(i, 1);
  }
  const existing = new Set(orderArr);
  for (const e of currentSet) if (!existing.has(e)) orderArr.push(e);
  orderArr.sort((a, b) => {
    const rankDiff = P9_ACTOR_ORDER.indexOf(a.actor) - P9_ACTOR_ORDER.indexOf(b.actor);
    return rankDiff !== 0 ? rankDiff : p9SeqOf(a) - p9SeqOf(b);
  });
}

function p9UpdateLayout(W, H) {
  if (W === p9.lastW && H === p9.lastH) return;

  // Dot grids
  const topY    = Math.round(H * SBB.top);
  const botY    = Math.round(H * SBB.bottom);
  const midY    = Math.round(H * P9_MID);
  const sideW   = W / 2 - 4 - W * SBB.left;
  const cols    = Math.floor(sideW / P9_CELL);
  const topRows = Math.floor((midY - topY) / P9_CELL);
  const botRows = Math.floor((botY - midY) / P9_CELL);
  const cells   = (n) => Array.from({ length: n }, (_, i) => i);
  p9.cols       = cols;
  p9.leftTopPos  = p7Shuffle(cells(cols * topRows), 21111);
  p9.leftBotPos  = p7Shuffle(cells(cols * botRows), 22222);
  p9.rightTopPos = p7Shuffle(cells(cols * topRows), 23333);
  p9.rightBotPos = p7Shuffle(cells(cols * botRows), 24444);

  // Category panel slots are computed dynamically in p9GetY

  // All categories start as "legitimate" (below), user drags up to mark as "extreme"
  if (p9.lastW === 0) {
    p9.sides = P9_CATEGORIES.map(() => "below");
  }

  p9.lastW = W;
  p9.lastH = H;
}


function p9GetY(i) {
  const H    = p9.lastH;
  const midY = Math.round(H * P9_MID);
  const GAP  = H * 0.015;
  const peers = p9.sides.map((s, j) => s === p9.sides[i] ? j : -1).filter(j => j >= 0);
  const rank  = peers.indexOf(i);
  const count = peers.length;
  if (p9.sides[i] === "above") {
    const lo = Math.round(H * SBB.top) + 24;
    const hi = midY - GAP;
    return lo + (rank + 0.5) * (hi - lo) / count;
  } else {
    const lo = midY + GAP;
    const hi = H - 16;
    return lo + (rank + 0.5) * (hi - lo) / count;
  }
}


// Builds the permanent per-event slot lookups the legit/extreme grids key off of —
// shared with page8, whose pre-page9 transition needs these same target positions
// before drawPage9 has ever actually run. The legit shuffle itself (sized to the
// grid's *oversized* cell budget, not just the event count) is built lazily by
// p9LegitGeometry below, once that budget is actually known.
function p9EnsureIndex() {
  if (p9.leftIndexOf) return;
  p9.leftIndexOf  = new Map(p7.leftEvents.map((e, i) => [e, i]));
  p9.rightIndexOf = new Map(p7.rightEvents.map((e, i) => [e, i]));
}

// The legit grid's own edge margin — deliberately separate from SBB_TIMELINE
// (the extreme grid's narrower-margin convention) since this spans the full
// physical frame, literally edge to edge (0 margin), rather than mirroring
// any other grid's margins. Pitch itself reuses P7_CELL (page7.js) directly —
// same 4px pitch as the real timeline, not a coarser one, so the gapped look
// below matches it stylistically rather than just sharing the same gap-
// creation mechanism.
const LEGIT_CELL   = P7_CELL;
const LEGIT_MARGIN = 0;

// The grid reaches all the way up to the divider line itself (just a 2px
// nudge so dots don't literally touch the stroke) — dots draw straight
// through the "פעולות לגיטימיות" label's own area too, ignoring it entirely.
const LEGIT_LINE_PAD = 2;

// Geometry for the legitimate (below-the-line) grid, factored out of drawPage9 so
// page8's pre-page9 transition can target the exact same layout — the state every
// event starts in before any category has been dragged to "extreme".
function p9LegitGeometry(W, H) {
  const midY     = Math.round(H * P9_MID);
  const gridTopY = midY + LEGIT_LINE_PAD;
  // Reaches all the way to the viewport's own bottom edge — unlike the
  // extreme grid above (which stops short for its own count-label/axis
  // clearance), the legit grid has nothing below it to clear, so per
  // explicit request it spreads all the way down instead of stopping short.
  const dashBotY = H;
  const visibleRows = Math.max(1, Math.floor((dashBotY - gridTopY) / LEGIT_CELL));

  const leftBoundX     = LEGIT_MARGIN;
  const rightBoundX    = W - LEGIT_MARGIN;
  const midX           = W / 2;
  const legitColsTotal = Math.max(2, Math.floor((rightBoundX - leftBoundX) / LEGIT_CELL));
  const legitLeftCols  = Math.floor(legitColsTotal / 2);
  const legitRightCols = legitColsTotal - legitLeftCols;

  // legitRows is purely physical (however many rows of real pixels are
  // available, period) — exactly how p7UpdateLayout sizes the real timeline's
  // own grid (page7.js: total = cols*rows from the available area, oblivious
  // to event count). At this pitch, across the full frame width, that's
  // already comfortably more cells than there are events in practice — the
  // Math.max fallback (now per side, see below) only kicks in as a safety net
  // on very small viewports, so dots still get *somewhere* to go rather than
  // being dropped outright. Both sides share whichever row count is taller,
  // not each their own, so the grid's row pitch stays aligned across the
  // center line even when one side has noticeably more events than the other.
  const leftRowsNeeded  = Math.ceil(p7.leftEvents.length  / legitLeftCols);
  const rightRowsNeeded = Math.ceil(p7.rightEvents.length / legitRightCols);
  const legitRows = Math.max(visibleRows, leftRowsNeeded, rightRowsNeeded);

  const geom = { gridTopY, legitRows, legitLeftCols, legitRightCols, midX };

  // Two independent cell pools, one per side — left events only ever land in
  // left-half columns, right events only in right-half columns, so the two
  // sides stay visually separated by screen side (same as the extreme grid
  // above) instead of mixing across the center line. Each pool still has more
  // cells than events (see above), so the per-side shuffle below — same
  // "more cells than events" mechanism p7OrderFromCenter (page7.js) uses for
  // the real timeline — leaves gaps scattered throughout that side rather
  // than filling every cell, while never crossing into the other side's
  // columns. Lazily (re)built only when a pool's own budget actually changes
  // (i.e. on resize) — a fresh shuffle every frame would make dots jump cell
  // to cell constantly.
  const leftTotalCells  = legitLeftCols  * legitRows;
  const rightTotalCells = legitRightCols * legitRows;
  if (!p9.legitShuffleLeft || p9.legitShuffleSizeLeft !== leftTotalCells) {
    p9.legitShuffleLeft     = p7Shuffle(Array.from({ length: leftTotalCells }, (_, i) => i), 25555);
    p9.legitShuffleSizeLeft = leftTotalCells;
  }
  if (!p9.legitShuffleRight || p9.legitShuffleSizeRight !== rightTotalCells) {
    p9.legitShuffleRight     = p7Shuffle(Array.from({ length: rightTotalCells }, (_, i) => i), 22222);
    p9.legitShuffleSizeRight = rightTotalCells;
  }

  return geom;
}

// A cell index's exact grid position (no jitter) within one side's own
// sub-grid — shared by the pool-building filter above and the real per-event
// lookup below. `side` picks which column count/growth-direction to use;
// the row pitch (gridTopY/legitRows) is shared by both sides.
function p9LegitCellXY(cell, geom, side) {
  const r = cell % geom.legitRows;
  const c = Math.floor(cell / geom.legitRows);
  const x = side === "left"
    ? geom.midX - (geom.legitLeftCols - c) * LEGIT_CELL
    : geom.midX + c * LEGIT_CELL;
  const y = geom.gridTopY + r * LEGIT_CELL;
  return { x, y };
}

// An event's target {x,y} in the legit grid — its shuffled cell's exact grid
// position within its own side's pool (see p9LegitGeometry above), so the
// result reads as gapped/free-form within that side, while every dot still
// sits on the grid and never crosses into the other side's columns.
function p9LegitPosOf(e, indexOf, side, geom) {
  const shuffle = side === "left" ? p9.legitShuffleLeft : p9.legitShuffleRight;
  const cell = shuffle[indexOf.get(e)];
  if (cell === undefined) return null;
  return p9LegitCellXY(cell, geom, side);
}

function drawPage9(ctx, W, H) {
  if (!p7.ready) {
    drawBackground(ctx, W, H);
    return;
  }

  p9UpdateLayout(W, H);

  drawBackground(ctx, W, H);

  const { cols } = p9;
  const topY   = Math.round(H * SBB.top);
  const midY   = Math.round(H * P9_MID);
  const botY   = Math.round(H * SBB.bottom);
  const leftX0  = W * SBB.left;
  const SQ = P9_SQ, CELL = P9_CELL;

  // Read by p9HoverInit (outside this function) to exclude below-the-line
  // ("legitimate") dots from the hover interaction entirely — only the
  // above-the-line ("extreme") block gets a tooltip/dim effect.
  p9.midY = midY;

  // Every event gets one permanent slot the first time this runs — keyed by its
  // stable index within p7.leftEvents/rightEvents (object identity doesn't change,
  // those arrays are loaded once) — instead of by its rank among whichever events
  // currently share its extreme/legit classification. Toggling one category only
  // ever shows/hides *that* category's own dots; every other event's cell is fixed
  // forever, so it just leaves a gap rather than the whole grid reflowing to close it.
  p9EnsureIndex();

  // Split events by category classification (p9.sides) — still needed for the
  // per-side event counts shown above each block.
  const leftTop = [], leftBot = [], rightTop = [], rightBot = [];
  for (const e of p7.leftEvents) {
    const idx  = CATEGORY_EN_TO_IDX[e.category];
    const side = (idx !== undefined && p9.sides[idx] === "below") ? "bot" : "top";
    (side === "top" ? leftTop : leftBot).push(e);
  }
  for (const e of p7.rightEvents) {
    const idx  = CATEGORY_EN_TO_IDX[e.category];
    const side = (idx !== undefined && p9.sides[idx] === "below") ? "bot" : "top";
    (side === "top" ? rightTop : rightBot).push(e);
  }

  p9SyncTopOrder(p9.leftTopOrder,  new Set(leftTop));
  p9SyncTopOrder(p9.rightTopOrder, new Set(rightTop));

  // The extreme dot grid is anchored at midY itself (touching the horizontal
  // divider, no gap) and sized to reach all the way up to 14vh, matching
  // .page9-zone-wrap-extreme's own top edge.
  const dividerTopY = Math.round(H * 0.14);
  const dashBotY    = H - 16;
  const extremeRows = Math.max(1, Math.floor((midY - dividerTopY) / CELL));

  // Unlike the legit grid below, the extreme blocks stay densely packed (built
  // outward from midY) rather than scattered across fixed slots — and both sides
  // are pinned to the same column count so neither looks wider than the other.
  // Filled row-major (not column-major) straight across the persistent, actor-
  // ranked order array — since that array is already sorted lowest-rank-first,
  // a row only ever contains more than one color right at a band boundary, and
  // every row except the very last is completely full. Band-by-band column
  // filling (each band rounding its own row count independently) used to leave
  // ragged gaps wherever a smaller band's rounding fell short of the shared
  // column count — this avoids that by never rounding per-band at all.
  //
  // That shared column count is sticky (p9.extremeColsSticky) — it only ever
  // grows, never shrinks — so a side's rows only get recomputed (and its dots
  // reflowed) when growth is actually forced by someone needing more room, not
  // on every minor fluctuation in either count.
  const neededCols = Math.max(
    Math.ceil(p9.leftTopOrder.length  / extremeRows) || 1,
    Math.ceil(p9.rightTopOrder.length / extremeRows) || 1,
  );
  p9.extremeColsSticky = Math.max(p9.extremeColsSticky || 1, neededCols);
  const extremeColsTotal = p9.extremeColsSticky;

  // Each side's *real* rendered column width — drawBandedCols below fills
  // row-major across the shared extremeColsTotal (column 0..colsTotal-1 in
  // row 0, then wraps to row 1, etc.), so a side only ever actually spans
  // min(extremeColsTotal, itsCount) columns: fewer than the shared width
  // when its count hasn't filled a whole row yet, the full shared width once
  // it has. Used only to keep each side's own event-count label centered
  // over its actually-drawn squares below — NOT to move the gap itself,
  // which stays fixed at literal viewport-center regardless of how lopsided
  // either side's count is (see centerX/rightX0 below).
  const leftRealCols  = p9.leftTopOrder.length  ? Math.min(extremeColsTotal, p9.leftTopOrder.length)  : 0;
  const rightRealCols = p9.rightTopOrder.length ? Math.min(extremeColsTotal, p9.rightTopOrder.length) : 0;

  // The gap is centered on literal viewport-center, always — independent of
  // either side's dot count — and wide enough for the *longest possible*
  // dropped-pill label (p9.maxPillWidth, measured once across all 10
  // categories in p9BuildPanel) plus breathing room, so the floating label
  // never overlaps the squares no matter which category that turns out to
  // be or how lopsided its left/right split is.
  const gapWidth = p9.maxPillWidth ? p9.maxPillWidth + P9_GAP_PADDING : P9_EXTREME_GAP;
  const centerX  = W / 2 - gapWidth / 2;
  const rightX0  = W / 2 + gapWidth / 2;

  // Records each event's *target* placement for next time (so a future transition
  // has a "from" to blend out of), and — while p9.anim is active — actually draws
  // it partway between its old recorded spot and that target instead of snapping
  // straight there. Color is invariant per event (actor-based) so only position
  // and the extreme/legit opacity need to move.
  const posMap = new Map();
  function p9PlaceDot(e, targetX, targetY, targetAlpha) {
    let drawX = targetX, drawY = targetY, drawAlpha = targetAlpha;
    if (p9.anim) {
      const from = p9.anim.from.get(e);
      if (from) {
        let t;
        if (p9.anim.newEventStagger && p9.anim.newEventStagger.has(e)) {
          // New extreme dot — departs once the reposition phase finishes.
          const dotArrival  = p9.anim.newEventStagger.get(e);
          const phase2Start = p9.anim.start + (p9.anim.repositionMs || 0);
          const dotDur      = dotArrival - phase2Start;
          t = p9Ease(Math.min(1, Math.max(0, (performance.now() - phase2Start) / dotDur)));
        } else {
          // Existing dot repositioning.
          // Dots whose actor rank is above "settlers" in the column (Right-wing
          // activists, Haredi Jews) get pushed upward by incoming new events —
          // they glide to their new spot arriving at the same moment the new
          // dots land (topDotArrivesAt), so it looks like the column grows as
          // one motion. Lower-rank dots (settlers and below) finish phase 1
          // on their own faster clock.
          const repoMs = p9.anim.repositionMs || p9.anim.duration;
          const now = performance.now();
          if (p9.anim.topDotArrivesAt !== undefined &&
              P9_ACTOR_ORDER.indexOf(e.actor) > P9_ACTOR_ORDER.indexOf("settlers")) {
            const dur = p9.anim.topDotArrivesAt - p9.anim.start;
            t = p9Ease(Math.min(1, (now - p9.anim.start) / dur));
          } else {
            t = p9Ease(Math.min(1, (now - p9.anim.start) / repoMs));
          }
        }
        drawX     = from.x     + (targetX     - from.x)     * t;
        drawY     = from.y     + (targetY     - from.y)     * t;
        drawAlpha = from.alpha + (targetAlpha - from.alpha) * t;
      }
    }
    // While one dot is hovered (p9.hoveredEvent), it's drawn fully opaque and
    // every other dot is dimmed. While a dropped pill is hovered instead
    // (p9.hoveredCategoryIdx, set by p9HoverInit's pill listener), ALL dots
    // of that category stay full opacity and the rest dim by the same factor.
    // Dot-hover takes priority so both states are never active simultaneously.
    if (p9.hoveredEvent) {
      drawAlpha = (e === p9.hoveredEvent) ? 1 : drawAlpha * 0.35;
    } else if (p9.hoveredCategoryIdx !== null) {
      const dimFactor = 1 - 0.65 * p9.hoverDimT;
      drawAlpha = (CATEGORY_EN_TO_IDX[e.category] === p9.hoveredCategoryIdx) ? 1 : drawAlpha * dimFactor;
    } else if (p9.hoverDimT > 0) {
      const dimFactor = 1 - 0.65 * p9.hoverDimT;
      drawAlpha = (p9.hoverDimCategoryIdx !== null && CATEGORY_EN_TO_IDX[e.category] === p9.hoverDimCategoryIdx)
        ? 1
        : drawAlpha * dimFactor;
    }

    ctx.globalAlpha = drawAlpha;
    ctx.fillStyle   = p7ActorColor(e.actor);
    ctx.fillRect(drawX, drawY, SQ, SQ);

    posMap.set(e, { x: targetX, y: targetY, alpha: targetAlpha });
  }

  function drawBandedCols(orderArr, rightAlign, colsTotal) {
    // Always full opacity by design (see the comment above where this and
    // drawJumbledBot are first invoked) — a literal 1, not a read of
    // ctx.globalAlpha: p9PlaceDot never restores that after dimming a dot
    // while one is hovered, so reading it here would pick up whatever dimmed
    // value the *previous* batch's last dot left behind and compound on top
    // of it, dimming each successive batch (right side, then both legit
    // sides) more than the last instead of every batch dimming by the same
    // flat amount.
    const targetAlpha = 1;
    orderArr.forEach((e, i) => {
      const r = Math.floor(i / colsTotal);
      const c = i % colsTotal;
      const x = rightAlign ? centerX - (c + 1) * CELL : rightX0 + c * CELL;
      const y = midY - (r + 1) * CELL;
      if (y < topY || y >= H - 16) return;
      p9PlaceDot(e, x, y, targetAlpha);
    });
    return Math.ceil(orderArr.length / colsTotal) || 1;
  }

  // The legitimate (below-the-line) grid keeps the same left/right screen-side
  // split the extreme grid above uses — left events only ever land left of
  // center, right events only right of center — but drops the *narrative*
  // clustering: within its own side, actors mix freely instead of grouping
  // into same-color blocks, built outward from the center, capped to a width
  // budget (mirrored from the gap kept against the floating text column's
  // dashed divider line, TEXT_COL_WIDTH in squareboundingbox.js) so it can
  // never grow into it. Sized per side, same fixed-slot reasoning as the
  // extreme grid above — reclassifying a category never reflows anyone
  // else's dot. The two sides butt up against each other with no gap.
  const legitGeom = p9LegitGeometry(W, H);

  function drawJumbledBot(poolEvents, indexOf, side, botSet) {
    // Same fix as drawBandedCols above, same reason — literal 1, not a read
    // of the (possibly already-dimmed-by-a-prior-batch) ctx.globalAlpha.
    const targetAlpha = 1;
    poolEvents.forEach(e => {
      if (!botSet.has(e)) return;
      const pos = p9LegitPosOf(e, indexOf, side, legitGeom);
      if (!pos) return; // guards a stale cache
      if (pos.y < topY || pos.y >= H) return;
      p9PlaceDot(e, pos.x, pos.y, targetAlpha);
    });
  }

  const leftBotSet = new Set(leftBot), rightBotSet = new Set(rightBot);

  // Both grids draw at full opacity — pixel-sampling Figma's flattened legit-
  // grid image (node 201:49243's image15/16) against the pure actor colors
  // gave ~0.93-0.95 (e.g. orange measured (235,99,28) vs pure #ea580c
  // (234,88,12)), the same ballpark as the extreme grid's own exact-color
  // match — the residual gap is screenshot/compression noise, not an
  // intentional dim. Previously drawn at 0.12 as a deliberate de-emphasis
  // that Figma's actual reference doesn't show.
  ctx.globalAlpha = 1;
  const leftTopRows  = drawBandedCols(p9.leftTopOrder,  true,  extremeColsTotal);
  const rightTopRows = drawBandedCols(p9.rightTopOrder, false, extremeColsTotal);
  drawJumbledBot(p7.leftEvents,  p9.leftIndexOf,  "left",  leftBotSet);
  drawJumbledBot(p7.rightEvents, p9.rightIndexOf, "right", rightBotSet);

  // p9PlaceDot leaves ctx.globalAlpha at whichever dimmed value (e.g. 0.35)
  // the last-drawn dot used while one dot is hovered — reset before anything
  // else below, or the count/label/divider line all inherit that same dim,
  // and (more importantly) it leaks into the next frame's drawBackground
  // clear too (see that function's own comment).
  ctx.globalAlpha = 1;

  // Event count above each side's block — centered over its own *actually
  // drawn* column span (leftRealCols/rightRealCols, not the shared sticky
  // extremeColsTotal — that shared width is reserved for layout but a side
  // with few events doesn't visually fill it, so centering over the full
  // width would float the label away from the squares it's labeling) and
  // sat just above wherever that side's tallest column actually reaches, not
  // a fixed shared height. Hidden entirely until something's actually been
  // dropped into the extreme zone — but once that's happened, both sides
  // show a count, "0" included, rather than only labeling whichever side
  // happens to have events.
  {
    let leftCount, rightCount;
    if (p9.hoveredCategoryIdx !== null) {
      // Pill hovered — show only that category's dot count, no animation.
      const catFilter = e => CATEGORY_EN_TO_IDX[e.category] === p9.hoveredCategoryIdx;
      leftCount  = leftTop.filter(catFilter).length;
      rightCount = rightTop.filter(catFilter).length;
    } else if (p9.anim && p9.anim.newEventStagger) {
      // Staggered extreme drop — count increments as each new dot arrives.
      const now = performance.now();
      let arrivedLeft = 0, arrivedRight = 0;
      for (const e of p7.leftEvents) {
        const dotArrival = p9.anim.newEventStagger.get(e);
        if (dotArrival !== undefined && now >= dotArrival) arrivedLeft++;
      }
      for (const e of p7.rightEvents) {
        const dotArrival = p9.anim.newEventStagger.get(e);
        if (dotArrival !== undefined && now >= dotArrival) arrivedRight++;
      }
      leftCount  = p9.anim.baseLeft  + arrivedLeft;
      rightCount = p9.anim.baseRight + arrivedRight;
    } else {
      // Legit drop (p9CountAnim ticking) or steady state.
      const displayed = p9GetDisplayedCounts();
      leftCount  = displayed ? displayed.left  : leftTop.length;
      rightCount = displayed ? displayed.right : rightTop.length;
    }

    // Suppress "0 / 0" while no dot has arrived yet (first drop, mid-flight).
    if (leftCount > 0 || rightCount > 0) {
      ctx.font         = "400 12px 'Assistant', sans-serif";
      ctx.textAlign    = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle    = "#111";
      ctx.fillText(String(leftCount),
        centerX - leftRealCols * CELL / 2,
        midY - leftTopRows * CELL - 16);
      ctx.fillText(String(rightCount),
        rightX0 + rightRealCols * CELL / 2,
        midY - rightTopRows * CELL - 16);
    }
  }

  // Dividing line between the "extreme" and "legitimate" dot-grid halves —
  // spans the full screen width edge-to-edge, growing in from the *right*
  // edge toward the left as the user scrolls (page9LineT, driven by
  // page9UpdateFromScroll in main.js — per explicit request, reversed from
  // the left-to-right direction every other fold's own grow-in uses),
  // reaching full width exactly when the title finishes docking at the top.
  // The category panel that classifies events into these halves lives as
  // real DOM/HTML in the text column (see p9BuildPanel below), not drawn
  // here on canvas.
  // Tapered via a linear gradient used as strokeStyle (canvas gradients paint
  // along the stroke directly, unlike CSS border-image — no cross-browser
  // ambiguity there) spanning the line's own *current* endpoints, so the
  // fade-in/fade-out stays proportional to however much has grown in so far
  // rather than fading relative to the final, fully-grown length.
  const dividerStartX = W * (1 - page9LineT);
  const dividerGrad  = ctx.createLinearGradient(dividerStartX, midY, W, midY);
  // Tapers down to a still-visible floor (0.15), not all the way to fully
  // transparent — per explicit request, the ends should read as thinner/
  // fainter, not vanish outright.
  dividerGrad.addColorStop(0,    "rgba(0, 0, 0, 0.15)");
  dividerGrad.addColorStop(0.2,  "rgba(0, 0, 0, 0.55)");
  dividerGrad.addColorStop(0.8,  "rgba(0, 0, 0, 0.55)");
  dividerGrad.addColorStop(1,    "rgba(0, 0, 0, 0.15)");
  ctx.strokeStyle = dividerGrad;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(dividerStartX, midY);
  ctx.lineTo(W, midY);
  ctx.stroke();

  p9.lastPositions = posMap;
}

// Current extreme event counts derived directly from p9.sides — used by
// commitDrop to capture before/after counts around a sides update.
function p9ExtremeCountsNow() {
  let left = 0, right = 0;
  if (p7.ready) {
    for (const e of p7.leftEvents) {
      const idx = CATEGORY_EN_TO_IDX[e.category];
      if (idx !== undefined && p9.sides[idx] === "above") left++;
    }
    for (const e of p7.rightEvents) {
      const idx = CATEGORY_EN_TO_IDX[e.category];
      if (idx !== undefined && p9.sides[idx] === "above") right++;
    }
  }
  return { left, right };
}

// What the extreme-zone count labels should display right now — frozen at the
// pre-drop count while dots are migrating, then counting toward the new totals.
// Returns null once the animation finishes (or was never started), so callers
// fall back to the actual leftTop.length/rightTop.length.
function p9GetDisplayedCounts() {
  if (!p9CountAnim) return null;
  const now = performance.now();
  if (now < p9CountAnim.start) {
    // Dot animation still running — freeze at the old count.
    return { left: p9CountAnim.fromLeft, right: p9CountAnim.fromRight };
  }
  const t = Math.min(1, (now - p9CountAnim.start) / p9CountAnim.duration);
  if (t >= 1) { p9CountAnim = null; return null; } // done — use actual counts
  const ease = p9Ease(t);
  return {
    left:  Math.round(p9CountAnim.fromLeft  + (p9CountAnim.toLeft  - p9CountAnim.fromLeft)  * ease),
    right: Math.round(p9CountAnim.fromRight + (p9CountAnim.toRight - p9CountAnim.fromRight) * ease),
  };
}

// ── Category panel — real DOM/HTML in the text column. Drag a pill between the
// "extreme" and "legitimate" zones to reclassify it; p9.sides drives which half of
// the canvas dot-grid (drawn above) each category's events land in. ──
function p9BuildPanel() {
  const zoneAbove   = document.getElementById("page9ZoneAbove");
  const zoneBelow   = document.getElementById("page9ZoneBelow");
  const panel       = document.querySelector(".page9-sticky");
  if (!zoneAbove || !zoneBelow || !panel || zoneAbove.childElementCount || zoneBelow.childElementCount) return;

  const dropTargets = [
    { el: zoneAbove, targetZone: zoneAbove, overClass: "dragover" },
    { el: zoneBelow, targetZone: zoneBelow, overClass: "dragover" },
  ];

  function resolveDropTarget(x, y) {
    const hit = document.elementFromPoint(x, y);
    if (!hit) return null;
    return dropTargets.find(dt => dt.el === hit || dt.el.contains(hit)) || null;
  }

  // One independent grid per tray row (see P9_TRAY_GRID above for why) —
  // dropping a pill back into "legitimate" has to land in *its own* row
  // wrapper, not directly in zoneBelow itself, or it'd never actually
  // re-enter a grid that gives it a fixed column.
  const trayRows = [1, 2, 3].map(rowNum => {
    const rowEl = document.createElement("div");
    rowEl.className = "page9-tray-row";
    zoneBelow.appendChild(rowEl);
    return rowEl;
  });

  function commitDrop(pill, targetZone) {
    const newCatIdx = Number(pill.dataset.idx);
    const nowMs     = performance.now();

    if (targetZone === zoneAbove) {
      // ── Dropping into extreme ──────────────────────────────────────────────
      // Dots arrive one by one in column order; the count increments as each lands.

      const { left: baseLeft, right: baseRight } = p9ExtremeCountsNow();

      // prepend so the newest card becomes the top of the stacked column.
      targetZone.prepend(pill);
      p9.sides[newCatIdx] = "above";

      // Sync the order arrays now (before the draw loop does it) so stagger
      // ranks already reflect the new events' final column positions.
      const makeSet = (pool) => new Set(pool.filter(e => {
        const i = CATEGORY_EN_TO_IDX[e.category];
        return i !== undefined && p9.sides[i] === "above";
      }));
      p9SyncTopOrder(p9.leftTopOrder,  makeSet(p7.leftEvents));
      p9SyncTopOrder(p9.rightTopOrder, makeSet(p7.rightEvents));

      // Phase 1: existing extreme dots reposition (settlers-rank and below settle
      // quickly; high-rank dots glide up over the full phase-1+phase-2 window).
      // Phase 2: new dots travel in once phase 1 ends.
      // Skip phase 1 entirely on the first drop (nothing to reposition).
      const REPOSITION_MS   = (baseLeft > 0 || baseRight > 0) ? 1200 : 0;
      const BASE_TRAVEL_MS     = 600;
      const ARRIVAL_STAGGER_MS = 4;    // ms/dot at the anchor count
      const ANCHOR_COUNT       = 1880; // "Physical assault" right-side count — calibration reference

      const newInLeft  = p9.leftTopOrder.filter(e => CATEGORY_EN_TO_IDX[e.category] === newCatIdx);
      const newInRight = p9.rightTopOrder.filter(e => CATEGORY_EN_TO_IDX[e.category] === newCatIdx);
      const maxNew     = Math.max(newInLeft.length, newInRight.length, 1);

      // sqrt scale: anchor and larger stay at 4ms/dot; smaller counts get proportionally
      // slower stagger so they don't feel too fast relative to the anchor.
      const effectiveStagger = ARRIVAL_STAGGER_MS * Math.max(1, Math.sqrt(ANCHOR_COUNT / maxNew));

      // Map stores each new dot's *arrival* timestamp (already offset by REPOSITION_MS).
      const stagger     = new WeakMap();
      const phase2Start = nowMs + REPOSITION_MS;
      newInLeft.forEach( (e, i) => stagger.set(e, phase2Start + BASE_TRAVEL_MS + effectiveStagger * i));
      newInRight.forEach((e, i) => stagger.set(e, phase2Start + BASE_TRAVEL_MS + effectiveStagger * i));

      const totalDur = REPOSITION_MS + BASE_TRAVEL_MS + effectiveStagger * (maxNew - 1);

      p9.anim = {
        from: new Map(p9.lastPositions),
        start: nowMs,
        duration: totalDur,
        repositionMs: REPOSITION_MS,
        topDotArrivesAt: REPOSITION_MS > 0 ? nowMs + totalDur : undefined,
        newCategoryIdx: newCatIdx,
        newEventStagger: stagger,
        baseLeft,
        baseRight,
      };
      p9CountAnim = null; // stagger drives the count directly — no separate count-up
      if (currentPage === 10) p9RunAnimLoop();

    } else {
      // ── Dropping back into legit ───────────────────────────────────────────
      // Dots migrate over 3 s; count ticks down once they've left.

      const prevDisplayed = p9GetDisplayedCounts();
      const prevActual    = p9ExtremeCountsNow();
      const fromLeft  = prevDisplayed ? prevDisplayed.left  : prevActual.left;
      const fromRight = prevDisplayed ? prevDisplayed.right : prevActual.right;

      trayRows[P9_TRAY_GRID[newCatIdx].row - 1].appendChild(pill);
      p9.sides[newCatIdx] = "below";

      const DOT_DURATION = 3000;
      p9.anim = { from: new Map(p9.lastPositions), start: nowMs, duration: DOT_DURATION };
      if (currentPage === 10) p9RunAnimLoop();

      const newCounts  = p9ExtremeCountsNow();
      const thisAnim   = p9CountAnim = {
        fromLeft, toLeft: newCounts.left,
        fromRight, toRight: newCounts.right,
        start: nowMs + DOT_DURATION,
        duration: 800,
      };
      setTimeout(() => { if (p9CountAnim === thisAnim) p9CountRunLoop(); }, DOT_DURATION);
    }
  }

  P9_CATEGORIES.forEach((label, idx) => {
    const pill = document.createElement("div");
    pill.className = "page9-pill";
    pill.dataset.idx = idx;

    // Permanent column within its own tray row (see P9_TRAY_GRID/trayRows
    // above) — applies only while the pill is actually inside its row
    // wrapper; harmless (just unused) once dragged into #page9ZoneAbove's
    // flex column. grid-row is pinned to 1 explicitly too, even though each
    // row wrapper only ever has one row: leaving it "auto" lets the CSS grid
    // spec's column-decrease rule kick in — re-appending a pill after a
    // sibling with a *higher* column number (e.g. dropping idx4, col 1, back
    // in after idx5, col 2, is already there) reads as "start of a new row"
    // and bumps it into a second implicit row instead of back into its own
    // slot, regardless of DOM order.
    pill.style.gridRow    = "1";
    pill.style.gridColumn = String(P9_TRAY_GRID[idx].col);

    // Handle first, label second: per explicit request, the grip dots sit on
    // the right edge of the pill — in this RTL flex row that means the handle
    // is the first DOM child, with the label trailing off to the left. Both
    // centered on the same flex line via align-items (see CSS), no manual
    // vertical-offset math needed.
    const handle = document.createElement("span");
    handle.className = "page9-handle";
    for (let i = 0; i < 6; i++) handle.appendChild(document.createElement("span"));
    pill.appendChild(handle);

    const labelEl = document.createElement("span");
    labelEl.className   = "page9-pill-label";
    labelEl.textContent = label;
    pill.appendChild(labelEl);

    // Manual pointer-based dragging instead of native HTML5 drag-and-drop —
    // once a native drag starts, the OS/browser takes over rendering the
    // cursor and CSS `cursor` on the dragged element has no effect for the
    // rest of the gesture (a real cross-browser limitation, not a bug here).
    // Doing it by hand keeps the cursor under our control the whole time —
    // set on <body> rather than the pill, since the pointer roams over many
    // different elements (other pills, drop zones, the canvas) during the drag.
    pill.addEventListener("pointerdown", e => {
      if (e.button !== 0) return;
      e.preventDefault();

      const rect    = pill.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;

      // Where the pill is coming from, captured before the drag moves it
      // anywhere — used below to only show the tray's dragover highlight
      // when this is actually a reclassification (extreme -> legit), not a
      // pill already in the tray just being dragged around within it.
      const draggingFromAbove = zoneAbove.contains(pill);

      // A free-floating clone is the actual visual being dragged — the original
      // stays exactly where it is in the DOM (just hidden via .dragging) so the
      // layout doesn't reflow mid-drag, and only actually moves on a successful drop.
      const ghost = pill.cloneNode(true);
      ghost.classList.add("page9-pill-ghost");
      ghost.style.left = `${rect.left}px`;
      ghost.style.top  = `${rect.top}px`;
      // Zone-above pills have a different computed width (no border, less padding,
      // hidden handle) than a tray pill — constraining the ghost to that width makes
      // it look pinched once it gets base .page9-pill styles in body context.
      // Let it auto-size naturally so it looks identical to a tray pill drag.
      if (!draggingFromAbove) ghost.style.width = `${rect.width}px`;
      document.body.appendChild(ghost);

      pill.classList.add("dragging");
      panel.classList.add("dragging");
      document.body.style.cursor = "grabbing";
      pill.setPointerCapture(e.pointerId);

      let activeDropTarget = null;

      function onMove(e2) {
        ghost.style.left = `${e2.clientX - offsetX}px`;
        ghost.style.top  = `${e2.clientY - offsetY}px`;

        // The ghost has pointer-events:none, but it can still be the element
        // elementFromPoint reports as topmost — hide it for the instant of the
        // hit-test so it never shadows the real drop target underneath.
        ghost.style.display = "none";
        const dt = resolveDropTarget(e2.clientX, e2.clientY);
        ghost.style.display = "";

        if (dt !== activeDropTarget) {
          if (activeDropTarget) activeDropTarget.el.classList.remove(activeDropTarget.overClass);
          // Suppress the highlight specifically for legit -> legit (a tray
          // pill dragged over the tray it's already in) — the drop itself
          // still commits normally either way, only the visual is skipped.
          const suppressHighlight = dt && dt.targetZone === zoneBelow && !draggingFromAbove;
          if (dt && !suppressHighlight) dt.el.classList.add(dt.overClass);
          activeDropTarget = dt;
        }
      }

      function onUp(e2) {
        pill.releasePointerCapture(e.pointerId);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        ghost.remove();
        document.body.style.cursor = "";
        pill.classList.remove("dragging");
        panel.classList.remove("dragging");
        if (activeDropTarget) {
          activeDropTarget.el.classList.remove(activeDropTarget.overClass);
          commitDrop(pill, activeDropTarget.targetZone);
        }
      }

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });

    trayRows[P9_TRAY_GRID[idx].row - 1].appendChild(pill); // every category starts out "legitimate"
  });

  // Sizes the tray's per-row grid tracks and the extreme-zone gap
  // (p9.maxPillWidth) from each pill's *real* rendered width — indexed by
  // each pill's own stable dataset.idx rather than its current DOM position,
  // so this stays correct even if it's re-run after some pills have already
  // moved to #page9ZoneAbove (see the document.fonts.ready call below:
  // 'Assistant' loads over the network with display:swap, so the very first
  // measurement, taken synchronously at script-load before the font has
  // necessarily finished downloading, may still be sized against the
  // fallback font's metrics — re-running this once the real font is
  // actually active corrects that).
  function p9MeasureTrayLayout() {
    const pillByIdx = [];
    document.querySelectorAll(".page9-pill").forEach(p => {
      pillByIdx[Number(p.dataset.idx)] = p;
    });

    p9.maxPillWidth = Math.max(...pillByIdx.map(p => p.offsetWidth));

    // Each tray row is its own independent grid (see P9_TRAY_GRID above for
    // why), sized to fit only that row's own pills — not "auto"/"max-content",
    // which would resize as pills get dragged in and out, but a fixed pixel
    // width per column computed once here, so the tray never changes size and
    // the gap between any two pills is always exactly the row's own `gap`,
    // never inflated by leftover space from a wider column elsewhere.
    const pillHeight = Math.ceil(Math.max(...pillByIdx.map(p => p.offsetHeight)));
    const rowColWidths = trayRows.map(() => []);
    P9_TRAY_GRID.forEach((slot, idx) => {
      rowColWidths[slot.row - 1][slot.col - 1] = pillByIdx[idx].offsetWidth;
    });
    // +2px: offsetWidth rounds to the nearest whole CSS px, but the actual
    // sub-pixel layout width (what wrapping is decided against) can come out
    // a hair over that under some device-pixel-ratio roundings — sizing the
    // column to *exactly* the rounded value occasionally wrapped a label to
    // two lines. 2px is well below "spread out" territory but always covers
    // the gap.
    trayRows.forEach((rowEl, i) => {
      rowEl.style.gridTemplateColumns = rowColWidths[i].map(w => `${w + 2}px`).join(" ");
      rowEl.style.height = `${pillHeight}px`;
    });

    // The extreme zone's own drop-target box (shown only while dragging, see
    // style.css) is sized to fit every single category stacked inside it —
    // not whatever happens to be dropped there at any given moment — so the
    // box never resizes as pills come and go mid-drag: tall enough for all
    // 10 stacked at once, wide enough for the single longest one. zoneGap/
    // zonePadX/Y read #page9ZoneAbove's own real gap/padding (style.css)
    // rather than duplicating those values here; the border is added
    // separately since it's only ever applied in the dragging state and so
    // isn't present yet to read back at measurement time.
    const zoneCs       = getComputedStyle(zoneAbove);
    const zoneGap       = parseFloat(zoneCs.rowGap) || 0;
    const zonePaddingX  = parseFloat(zoneCs.paddingLeft) + parseFloat(zoneCs.paddingRight);
    const zonePaddingY  = parseFloat(zoneCs.paddingTop) + parseFloat(zoneCs.paddingBottom);
    const stackContentHeight = P9_CATEGORIES.length * pillHeight + (P9_CATEGORIES.length - 1) * zoneGap;
    const stackHeight = stackContentHeight + zonePaddingY + P9_ZONE_DRAG_BORDER * 2;
    const stackWidth  = p9.maxPillWidth + zonePaddingX + P9_ZONE_DRAG_BORDER * 2;
    zoneAbove.style.setProperty("--page9-zone-stack-height", `${stackHeight}px`);
    zoneAbove.style.setProperty("--page9-zone-stack-width", `${stackWidth}px`);
  }

  p9MeasureTrayLayout();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(p9MeasureTrayLayout);
}

p9BuildPanel();

// Hover tooltip for a single event dot — date + Hebrew description. Every
// event has a `descHeMedium` by now (events.json/server.py borrow-backfills
// one from the same (actor, category) group for events with no real
// description of their own), so every dot is hoverable.
function p9HoverInit() {
  const canvasEl  = document.getElementById("canvas");
  const tooltipEl = document.getElementById("page9Tooltip");
  const dateEl    = tooltipEl.querySelector(".page9-tooltip-date");
  const descEl    = tooltipEl.querySelector(".page9-tooltip-desc");

  const HIT_PAD = 3; // px of extra hit area around each SQ=3 dot, in every direction
  const TOOLTIP_GAP = 5; // px of breathing room between the dot and the tooltip box, both axes
  const HOVER_DIM_MS = 80; // total fade-in or fade-out duration for the dim

  let hoverDimRaf = null;
  let hoverDimTarget = 0;
  function p9HoverDimAnimate(target) {
    hoverDimTarget = target;
    if (hoverDimRaf !== null) return;
    let lastTime = performance.now();
    function step(now) {
      const dt = now - lastTime;
      lastTime = now;
      const delta = dt / HOVER_DIM_MS;
      p9.hoverDimT = hoverDimTarget > p9.hoverDimT
        ? Math.min(hoverDimTarget, p9.hoverDimT + delta)
        : Math.max(hoverDimTarget, p9.hoverDimT - delta);
      if (currentPage === 10) draw();
      if (p9.hoverDimT !== hoverDimTarget) {
        hoverDimRaf = requestAnimationFrame(step);
      } else {
        hoverDimRaf = null;
        if (p9.hoverDimT === 0) {
          p9.hoverDimCategoryIdx = null;
          if (currentPage === 10) draw();
        }
      }
    }
    hoverDimRaf = requestAnimationFrame(step);
  }

  // The dropped pill (in #page9ZoneAbove) currently highlighted black to
  // call out the hovered dot's category — tracked so it can be un-highlighted
  // even if the hovered dot changes category or hover ends outright.
  const zoneAboveEl = document.getElementById("page9ZoneAbove");
  let highlightedPill = null;
  function setHighlightedPill(catIdx) {
    const next = catIdx !== undefined
      ? document.querySelector(`#page9ZoneAbove .page9-pill[data-idx="${catIdx}"]`)
      : null;
    if (next === highlightedPill) return;
    if (highlightedPill) highlightedPill.classList.remove("is-hover-highlighted");
    if (next) next.classList.add("is-hover-highlighted");
    highlightedPill = next;
    zoneAboveEl.classList.toggle("has-hover-highlight", !!next);
  }

  // Pill hover: when the pointer rests on a dropped pill in #page9ZoneAbove,
  // highlight all canvas dots of that category and dim the rest — same 0.35
  // dimming mechanic as dot-hover but applied category-wide. Dot-hover takes
  // priority (see p9PlaceDot); these listeners only engage when hoveredEvent
  // is null (pointer is over DOM, not a canvas dot).
  let hoveredCatPill = null;
  function setPillHover(pill) {
    if (pill === hoveredCatPill) return;
    if (hoveredCatPill) hoveredCatPill.classList.remove("is-hover-highlighted");
    hoveredCatPill = pill;
    if (pill) {
      pill.classList.add("is-hover-highlighted");
      p9.hoveredCategoryIdx = Number(pill.dataset.idx);
      p9.hoverDimCategoryIdx = p9.hoveredCategoryIdx;
      p9HoverDimAnimate(1);
    } else {
      // Keep hoverDimCategoryIdx alive so highlighted dots stay bright during fade-out.
      p9.hoveredCategoryIdx = null;
      p9HoverDimAnimate(0);
    }
    zoneAboveEl.classList.toggle("has-hover-highlight", !!pill);
  }

  zoneAboveEl.addEventListener("pointerover", e => {
    if (p9.hoveredEvent) return; // dot-hover takes priority
    const pill = e.target.closest(".page9-pill");
    setPillHover(pill && zoneAboveEl.contains(pill) ? pill : null);
  });
  zoneAboveEl.addEventListener("pointerleave", () => setPillHover(null));

  // #page9Tooltip is shared with page7.js's own hover (same element, see
  // p7HoverInit) — only clear it when this handler is the one that actually
  // showed it (p9.hoveredEvent set), or a stray pointermove/scroll on
  // whichever page page7's hover owns would stomp its tooltip right back
  // off the instant it appears, since both listen on window unconditionally.
  function hide() {
    if (!p9.hoveredEvent) return;
    tooltipEl.classList.remove("is-visible");
    p9.hoveredEvent = null;
    setHighlightedPill(undefined);
    draw();
  }

  function onMove(e) {
    if (currentPage !== 10 || p9.anim) { hide(); return; }

    const rect = canvasEl.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const half = P9_SQ / 2;

    // Brute-force nearest-dot scan — p9.lastPositions only holds the dots
    // actually drawn this frame (already in CSS-pixel space, same as
    // getBoundingClientRect, so no DPR conversion needed). Below-the-line
    // ("legitimate") dots are skipped entirely, per explicit request — only
    // the above-the-line ("extreme") block gets the tooltip/dim interaction.
    let bestEvent = null, bestPos = null, bestDist = Infinity;
    for (const [ev, pos] of p9.lastPositions) {
      if (pos.y >= p9.midY) continue;
      const cx = pos.x + half, cy = pos.y + half;
      const dx = mx - cx, dy = my - cy;
      if (Math.abs(dx) > half + HIT_PAD || Math.abs(dy) > half + HIT_PAD) continue;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) { bestDist = dist; bestEvent = ev; bestPos = pos; }
    }

    if (!bestEvent) { hide(); return; }

    // Redraw with this dot isolated (see p9PlaceDot's dimming check) only
    // when the hovered event actually changes — not on every pointermove
    // over the same dot, which would redraw the whole canvas needlessly.
    if (p9.hoveredEvent !== bestEvent) {
      p9.hoveredEvent = bestEvent;
      // Cancel any running pill-hover dim animation so hoverDimT is reset clean.
      hoverDimTarget = 0; p9.hoverDimT = 0;
      setHighlightedPill(CATEGORY_EN_TO_IDX[bestEvent.category]);
      draw();
      // draw() just rebuilt p9.lastPositions — bestPos (read below for
      // tooltip placement) still points at the same {x,y}, since dimming
      // only changes alpha, but refresh the reference for clarity/safety.
      bestPos = p9.lastPositions.get(bestEvent);
    }

    dateEl.textContent = bestEvent.date;
    descEl.textContent = bestEvent.descHeMedium;
    tooltipEl.style.borderColor = p7ActorColor(bestEvent.actor);
    tooltipEl.classList.add("is-visible");

    // Left-side events (event.side === "left", the grid's left column block)
    // open the tooltip toward the left of the dot instead of the right, so it
    // doesn't reach across the canvas's center gap into the opposite side's
    // column — mirrors which corner of the box anchors at the dot (see
    // .page9-tooltip.is-mirrored, style.css).
    const mirrored = bestEvent.side === "left";
    tooltipEl.classList.toggle("is-mirrored", mirrored);

    // Anchor the box's square corner (bottom-left normally, bottom-right
    // when mirrored — the design's pointer corner, see style.css) a small
    // gap away from the dot on both axes, growing up and away from the
    // canvas's center gap, rather than flush against it.
    const dotClientX = rect.left + bestPos.x;
    const dotClientY = rect.top  + bestPos.y;
    const rawLeft = mirrored
      ? dotClientX - TOOLTIP_GAP - tooltipEl.offsetWidth
      : dotClientX + TOOLTIP_GAP;
    const left = Math.max(8, Math.min(rawLeft, window.innerWidth - tooltipEl.offsetWidth - 8));
    const top  = Math.max(dotClientY - TOOLTIP_GAP - tooltipEl.offsetHeight, 8);
    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top  = `${top}px`;
  }

  // Listens on window, not the canvas — .page9-sticky (the DOM-based tray/
  // zone-label overlay, z-index 1) visually sits on top of the canvas
  // (z-index 0) over most of this page, so it — not the canvas — is the
  // actual pointermove target there. pointermove still bubbles to window
  // regardless of which element it targets, and the hit-test itself (using
  // clientX/Y against canvas.getBoundingClientRect(), not the event target)
  // already hides the tooltip whenever nothing's under the cursor — so a
  // separate pointerleave handler isn't needed either.
  window.addEventListener("pointermove", onMove);
  window.addEventListener("scroll", () => { if (currentPage !== 10) hide(); }, { passive: true });
}

p9HoverInit();
