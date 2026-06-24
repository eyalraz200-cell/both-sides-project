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

const P9_SQ      = 3;
const P9_GAP  = 1;
const P9_CELL = P9_SQ + P9_GAP;
const P9_MID  = 0.65; // divider position as fraction of H — raised from Figma's measured 719/982 (~73.22vh) per explicit request to move the extreme/legit dividing line higher up the screen

// Gap reserved at center between the extreme grid's two column-blocks — wide
// enough for the floating dropped-category labels (.page9-zone-wrap-extreme,
// centered at W/2) to sit without overlapping the squares, matching Figma's own
// reference (node 136:418305), whose two blocks sit ~415px apart on a 1512-wide
// frame to leave room for exactly this.
const P9_EXTREME_GAP = 320;

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
// before drawPage9 has ever actually run.
function p9EnsureIndex() {
  if (p9.leftIndexOf) return;
  p9.leftIndexOf  = new Map(p7.leftEvents.map((e, i) => [e, i]));
  p9.rightIndexOf = new Map(p7.rightEvents.map((e, i) => [e, i]));
  const combinedCap = p7.leftEvents.length + p7.rightEvents.length;
  p9.legitShuffle = p7Shuffle(Array.from({ length: combinedCap }, (_, i) => i), 25555);
}

// Geometry for the legitimate (below-the-line) grid, factored out of drawPage9 so
// page8's pre-page9 transition can target the exact same layout — the state every
// event starts in before any category has been dragged to "extreme".
function p9LegitGeometry(W, H) {
  const midY         = Math.round(H * P9_MID);
  const dashBotY      = H - 16;
  let legitRows       = Math.max(1, Math.floor((dashBotY - (midY + 26)) / P9_CELL));
  const dividerLineX  = W - TEXT_COL_WIDTH + 48;
  const rightBoundX   = dividerLineX - 24;
  const midX          = W / 2;
  const maxSideWidth  = rightBoundX - midX;
  const maxColsPerSide = Math.max(1, Math.floor(maxSideWidth / P9_CELL));
  const combinedCap   = p7.leftEvents.length + p7.rightEvents.length;
  if (Math.ceil(combinedCap / legitRows) > maxColsPerSide * 2) {
    legitRows = Math.ceil(combinedCap / (maxColsPerSide * 2));
  }
  const legitColsTotal = Math.max(1, Math.ceil(combinedCap / legitRows));
  const legitLeftCols  = Math.floor(legitColsTotal / 2);
  return { midY, legitRows, legitColsTotal, legitLeftCols, midX };
}

// An event's target {x,y} in the legit grid, or null if its slot fell outside the
// grid's column budget (a stale-cache guard — see legitColsTotal above).
function p9LegitPosOf(e, indexOf, offset, geom) {
  const slot = p9.legitShuffle[offset + indexOf.get(e)];
  const r = slot % geom.legitRows;
  const c = Math.floor(slot / geom.legitRows);
  if (c >= geom.legitColsTotal) return null;
  const x = c < geom.legitLeftCols
    ? geom.midX - (geom.legitLeftCols - c) * P9_CELL
    : geom.midX + (c - geom.legitLeftCols) * P9_CELL;
  const y = geom.midY + r * P9_CELL;
  return { x, y };
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
  const rightX0 = W / 2 + P9_EXTREME_GAP / 2;
  const SQ = P9_SQ, CELL = P9_CELL;

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

  const centerX = W / 2 - P9_EXTREME_GAP / 2;

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
    ctx.globalAlpha = drawAlpha;
    ctx.fillStyle   = P7_COLORS[e.actor] || "#888";
    ctx.fillRect(drawX, drawY, SQ, SQ);
    posMap.set(e, { x: targetX, y: targetY, alpha: targetAlpha });
  }

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

  // Event count above each side's block — centered over its own column span
  // (extremeColsTotal wide, shared by both) and sat just above wherever that
  // side's tallest column actually reaches, not a fixed shared height. Hidden
  // entirely until something's actually been dropped into the extreme zone —
  // but once that's happened, both sides show a count, "0" included, rather
  // than only labeling whichever side happens to have events.
  if (leftTop.length > 0 || rightTop.length > 0) {
    ctx.font         = "400 12px 'Assistant', sans-serif";
    ctx.textAlign    = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle    = "#111";
    ctx.fillText(String(leftTop.length),
      centerX - extremeColsTotal * CELL / 2,
      midY - leftTopRows * CELL - 16);
    ctx.fillText(String(rightTop.length),
      rightX0 + extremeColsTotal * CELL / 2,
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
  ctx.globalAlpha = 1;
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

  function commitDrop(pill, targetZone) {
    targetZone.appendChild(pill);
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

    zoneBelow.appendChild(pill); // every category starts out "legitimate"
  });
}

p9BuildPanel();
