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
const P9_MID  = 0.65; // divider position as fraction of H — raised from Figma's measured 719/982 (~73.22vh) per explicit request to move the extreme/legit dividing line higher up the screen

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
const P9_ZONE_DRAG_BORDER = 4;

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
// not scroll-driven: a fixed-duration animation triggered once the title docks
// above it (see p9TriggerLine, called from page9UpdateFromScroll in main.js),
// playing on its own clock the same way page8's dot-grid transition does. The
// reverse plays if the title un-docks (scrolled back below it) before settling.
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

// toT: 1 to grow in (title just docked above the line), 0 to retract (title
// scrolled back below it). Idempotent — calling with the value already at rest
// is a no-op.
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
  const dashBotY = H - 16;
  const visibleRows = Math.max(1, Math.floor((dashBotY - gridTopY) / LEGIT_CELL));

  const leftBoundX     = LEGIT_MARGIN;
  const rightBoundX    = W - LEGIT_MARGIN;
  const midX           = W / 2;
  const legitColsTotal = Math.max(2, Math.floor((rightBoundX - leftBoundX) / LEGIT_CELL));
  const legitLeftCols  = Math.floor(legitColsTotal / 2);

  // legitRows is purely physical (however many rows of real pixels are
  // available, period) — exactly how p7UpdateLayout sizes the real timeline's
  // own grid (page7.js: total = cols*rows from the available area, oblivious
  // to event count). At this pitch, across the full frame width, that's
  // already comfortably more cells than there are events in practice — the
  // Math.max fallback only kicks in as a safety net on very small viewports,
  // so dots still get *somewhere* to go rather than being dropped outright.
  const combinedCap = p7.leftEvents.length + p7.rightEvents.length;
  const legitRows   = Math.max(visibleRows, Math.ceil(combinedCap / legitColsTotal));

  const geom = { gridTopY, legitRows, legitColsTotal, legitLeftCols, midX };

  // The cell budget naturally exceeds the event count (see above), so the
  // shuffle below — same "more cells than events" mechanism p7OrderFromCenter
  // (page7.js) uses for the real timeline — only ever uses a random subset of
  // it, leaving gaps scattered throughout rather than every cell filled.
  // Lazily (re)built only when the budget actually changes (i.e. on resize) —
  // a fresh shuffle every frame would make dots jump cell to cell constantly.
  const totalCells = legitRows * legitColsTotal;
  if (!p9.legitShuffle || p9.legitShuffleSize !== totalCells) {
    p9.legitShuffle = p7Shuffle(Array.from({ length: totalCells }, (_, i) => i), 25555);
    p9.legitShuffleSize = totalCells;
  }

  return geom;
}

// A cell index's exact grid position (no jitter) — shared by the pool-building
// filter above and the real per-event lookup below.
function p9LegitCellXY(cell, geom) {
  const r = cell % geom.legitRows;
  const c = Math.floor(cell / geom.legitRows);
  const x = c < geom.legitLeftCols
    ? geom.midX - (geom.legitLeftCols - c) * LEGIT_CELL
    : geom.midX + (c - geom.legitLeftCols) * LEGIT_CELL;
  const y = geom.gridTopY + r * LEGIT_CELL;
  return { x, y };
}

// An event's target {x,y} in the legit grid — its shuffled cell's exact grid
// position, but that cell is one of many more than there are events (see
// p9LegitGeometry above), so the result reads as gapped/free-form rather
// than a solid filled block, while every dot still sits on the grid.
function p9LegitPosOf(e, indexOf, offset, geom) {
  const cell = p9.legitShuffle[offset + indexOf.get(e)];
  return p9LegitCellXY(cell, geom);
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
      const t    = p9Ease(Math.min(1, (performance.now() - p9.anim.start) / p9.anim.duration));
      const from = p9.anim.from.get(e);
      if (from) {
        drawX     = from.x     + (targetX     - from.x)     * t;
        drawY     = from.y     + (targetY     - from.y)     * t;
        drawAlpha = from.alpha + (targetAlpha - from.alpha) * t;
      }
    }
    // While one dot is hovered (p9.hoveredEvent, set by p9HoverInit — only
    // ever an above-the-line/"extreme" event, see there), it's drawn fully
    // opaque and every other dot is dimmed, so it reads as isolated against
    // the grid.
    if (p9.hoveredEvent) drawAlpha = (e === p9.hoveredEvent) ? 1 : drawAlpha * 0.35;

    ctx.globalAlpha = drawAlpha;
    ctx.fillStyle   = p7ActorColor(e.actor);
    ctx.fillRect(drawX, drawY, SQ, SQ);

    posMap.set(e, { x: targetX, y: targetY, alpha: targetAlpha });
  }

  function drawBandedCols(orderArr, rightAlign, colsTotal) {
    const targetAlpha = ctx.globalAlpha;
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

  // The legitimate (below-the-line) grid drops the left/right narrative split
  // entirely — actors mix freely instead of clustering in same-color blocks —
  // and is built outward from the center, capped to a width budget (mirrored
  // from the gap kept against the floating text column's dashed divider line,
  // TEXT_COL_WIDTH in squareboundingbox.js) so it can never grow into it. Sized
  // from the *total* combined pool, same fixed-slot reasoning as the extreme
  // grid above — reclassifying a category never reflows anyone else's dot.
  // no CENTER_GAP in the legit grid — the two sides butt up against each other with
  // no gap, since they're one shuffled pool split only for width-balance.
  const legitGeom = p9LegitGeometry(W, H);

  function drawJumbledBot(poolEvents, indexOf, offset, botSet) {
    const targetAlpha = ctx.globalAlpha;
    poolEvents.forEach(e => {
      if (!botSet.has(e)) return;
      const pos = p9LegitPosOf(e, indexOf, offset, legitGeom);
      if (!pos) return; // guards a stale cache
      if (pos.y < topY || pos.y >= H - 16) return;
      p9PlaceDot(e, pos.x, pos.y, targetAlpha);
    });
  }

  const leftBotSet = new Set(leftBot), rightBotSet = new Set(rightBot);

  ctx.globalAlpha = 1;
  const leftTopRows  = drawBandedCols(p9.leftTopOrder,  true,  extremeColsTotal);
  const rightTopRows = drawBandedCols(p9.rightTopOrder, false, extremeColsTotal);
  ctx.globalAlpha = 0.12;
  drawJumbledBot(p7.leftEvents,  p9.leftIndexOf,  0,                     leftBotSet);
  drawJumbledBot(p7.rightEvents, p9.rightIndexOf, p7.leftEvents.length,  rightBotSet);
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
  if (leftTop.length > 0 || rightTop.length > 0) {
    ctx.font         = "400 12px 'Assistant', sans-serif";
    ctx.textAlign    = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle    = "#111";
    ctx.fillText(String(leftTop.length),
      centerX - leftRealCols * CELL / 2,
      midY - leftTopRows * CELL - 16);
    ctx.fillText(String(rightTop.length),
      rightX0 + rightRealCols * CELL / 2,
      midY - rightTopRows * CELL - 16);
  }


  // Dividing line between the "extreme" and "legitimate" dot-grid halves — drawn
  // growing in from the left as the user scrolls (see page9LineT, driven by
  // page9UpdateFromScroll in main.js), reaching full width exactly when the title
  // finishes docking at the top. The category panel that classifies events into
  // these halves lives as real DOM/HTML in the text column (see p9BuildPanel
  // below), not drawn here on canvas.
  ctx.strokeStyle = "#000";
  ctx.lineWidth   = 1;
  ctx.globalAlpha = 0.12;
  ctx.beginPath();
  ctx.moveTo(0,  midY);
  ctx.lineTo(W * page9LineT, midY);
  ctx.stroke();
  ctx.globalAlpha = 1;

  p9.lastPositions = posMap;
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
    if (targetZone === zoneBelow) {
      trayRows[P9_TRAY_GRID[Number(pill.dataset.idx)].row - 1].appendChild(pill);
    } else {
      targetZone.appendChild(pill);
    }
    p9.sides[Number(pill.dataset.idx)] = targetZone.dataset.zone;
    // Reclassifying a category moves its dots between the extreme/legit grids —
    // animate that move (from wherever they were last drawn) instead of having
    // them snap straight to their new spot.
    p9.anim = { from: new Map(p9.lastPositions), start: performance.now(), duration: 3000 };
    if (currentPage === 10) p9RunAnimLoop();
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

      // A free-floating clone is the actual visual being dragged — the original
      // stays exactly where it is in the DOM (just hidden via .dragging) so the
      // layout doesn't reflow mid-drag, and only actually moves on a successful drop.
      const ghost = pill.cloneNode(true);
      ghost.classList.add("page9-pill-ghost");
      ghost.style.left  = `${rect.left}px`;
      ghost.style.top   = `${rect.top}px`;
      ghost.style.width = `${rect.width}px`;
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
          if (dt) dt.el.classList.add(dt.overClass);
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

  function hide() {
    tooltipEl.classList.remove("is-visible");
    if (p9.hoveredEvent) { p9.hoveredEvent = null; draw(); }
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
