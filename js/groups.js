// ── Folds 2 through 4 (ids #page-1..#page-3) all show the same 6 camp
// groups — flying from @fold1's hero dot columns straight into the two-camp
// column layout (@fold2), gaining labels (@fold3), splitting into 3 (@fold4),
// then merging back + settling into the left mini-legend (@fold6). Rather
// than a separate overlay per fold crossfading into the next (which made the
// handoffs visibly "pop" — two different DOM nodes for the same group,
// swapped at the exact instant their positions matched), there's ONE
// persistent .group-item per group here, continuously repositioned and
// restyled as the user scrolls. Matched across stages by color, not label.
// All coordinates are read straight off the shared 1512×982 Figma frame and
// rescaled to the canvas's actual size. ──
const GROUPS_FRAME_H = 982; // Figma frame height the y-coordinates below are authored against

// fold4.x is always the SWATCH's own anchor point (matching every other
// coordinate in this file) — NOT the container's left edge. The 6 camp
// groups split into two clean top-aligned columns, hand-placed per explicit
// written spec (not a Figma frame): the coalition trio at x=887 (screen-right)
// and the change trio at x=725 (screen-left), both starting
// at y=443 with a 40-unit row gap. The two columns are placed with enough
// clearance on each side of the frame's own horizontal center (x=756, i.e.
// always screen-center regardless of viewport width). Only the y values are
// still read off this fold4 block — the x/grid geometry now comes from the
// @fold2 grid constants (FOLD2_CAMP_CENTER_GAP_PX etc., Figma 279:1342),
// placed symmetrically about screen center in plain px.
//
// fold6 (Figma node 120:1279/Frame 3219) is the persistent mini-legend the
// groups settle into for good at @fold4 (#page-3, fold6Trigger — legacy name).
//
// `actor` is the events.json join key — see p7ActorColor in page7.js, which
// reads this group's `color` directly so the real per-event canvas dots always
// match this legend, including after a future color edit here. The values are
// full_v3.xlsx's own lowercase `main_actor` strings, matched verbatim; the
// camp membership they imply is duplicated as ACTOR_SIDE in server.py, which
// derives each event's `side` from them (full_v3.xlsx has no side column).
const GROUPS = [
  { color: "#31CE1C", label: "מפגינים ערבים ישראלים",  actor: "arab israelis",
    fold4: { x: 725,  y: 514, swatchFirst: true }, fold6: { x: 31, y: 560 } },
  { color: "#F9B624", label: "תנועות התנחלות באיו״ש",           actor: "settlers",
    fold4: { x: 887,  y: 488, swatchFirst: true }, fold6: { x: 31, y: 512 } },
  { color: "#F024FF", label: "קבוצות ימין לאומיות",      actor: "right wing protesters",
    fold4: { x: 887,  y: 514, swatchFirst: true }, fold6: { x: 31, y: 560 } },
  { color: "#6B89FF", label: "מתנגדי הרפורמה ותומכי עסקת החטופים", actor: "protesters against government",
    fold4: { x: 725,  y: 488, swatchFirst: true }, fold6: { x: 31, y: 512 } },
  { color: "#FF1A94", label: "פעילי שמאל",             actor: "peace movements",
    fold4: { x: 725,  y: 462, swatchFirst: true }, fold6: { x: 31, y: 536 } },
  { color: "#454545", label: "מפגינים חרדים",           actor: "haredi jews",
    fold4: { x: 887,  y: 462, swatchFirst: true }, fold6: { x: 31, y: 536 } },
];

// @fold1's dot columns (buildPage0AllDots, page1.js) read 12 of their 200 dot
// colors live from GROUPS above — called from here, not from page1.js
// itself, since page1.js's <script> tag loads before this one and GROUPS
// doesn't exist yet at that point.
buildPage0AllDots();

// Which camp each group belongs to, top-to-bottom in that camp's own column
// order. Declared here (rather than down by the camp headers, where they used
// to live) because @fold2's grid roster below already needs them.
const FOLD4_COALITION_ROWS = ["#454545", "#F9B624", "#F024FF"].map(c => GROUPS.find(g => g.color === c));
const FOLD4_CHANGE_ROWS    = ["#FF1A94", "#6B89FF", "#31CE1C"].map(c => GROUPS.find(g => g.color === c));

// ── @fold2's camp grids (Figma node 279:1342, frame 1512×982) ──
// Each camp is no longer a single column of 3 labelled rows — it's a 4-col ×
// 3-row block of 12 plain rects, no labels and no center divider (per Figma).
// The 3 GROUPS rows are still the block's rows; each row is simply 4 rects
// wide, all in that group's color, and only the row's RIGHTMOST rect is the
// persistent .group-item. The other 3 per row ("fillers") are real @fold1
// decorative dots that fly in alongside it instead of shrinking away, then
// shrink out at @fold3 as that row's label types itself in — which is why the
// surviving rect never moves between @fold2 and @fold3.
//
// Measured off the RENDERED Figma frame (its two blocks' own layer x/y are
// mutually inconsistent; the render is a clean regular grid both sides):
// 11px rects, 31px column pitch, 32px row pitch (row pitch tuned by eye at
// @fold3, where the column reads with its labels) — desktop only; mobile
// authors a flat 16px visible gap instead, see the pitch functions below.
// That @fold3 tuning is preserved separately as FOLD3_MIN_ROW_PITCH_PX in
// js/update-groups.js, so retuning @fold2's grid at either breakpoint can't
// drag @fold3's labelled column with it. Rows at y=462/488/514
// (those rows live in GROUPS' own fold4.y, so they can't drift out of sync).
// Pitches are plain px (not frame-scaled) for the same reason
// FOLD2_CAMP_CENTER_GAP_PX below is — a grid must stay square at any viewport.
// 12 cells, laid out 4 wide. Change this one number and the whole roster
// reflows (see fold2CellOf below) — nothing caches a cell's row/col.
const FOLD2_GRID_COLS = 4;
const FOLD2_CELL_COUNT = 12;
// Hoisted from the mini-legend block near the bottom of this file (where its
// sibling CLUSTER_LABEL_GAP still lives) because the pitches just below derive
// from it at module scope. Default (camp-column) swatch size — vs. the smaller
// mini-legend one (Figma node 120:1279/Frame 3219), interpolated continuously
// by fold6Trigger rather than snapped.
const CLUSTER_SWATCH_SIZE = 11;
// Desktop pitches are harness-tuned by eye — 29 across, 29 down (an 18px
// visible gap around the 11px rect both ways). Mobile instead authors the
// VISIBLE gap directly at a flat 18px both ways, so the pitch is derived as
// 18 + CLUSTER_SWATCH_SIZE = 29 and the block comes out literally square.
// Functions, not consts, for two reasons: isMobile() lives in js/core.js, a
// *later* <script>, so nothing here may read it at module scope; and the
// breakpoint has to be re-read live on every resize anyway.
const FOLD2_COL_PITCH_DESKTOP_PX = 29, FOLD2_ROW_PITCH_DESKTOP_PX = 29;
const FOLD2_RECT_GAP_MOBILE_PX = 18;
function fold2ColPitchPx() {
  return isMobile() ? FOLD2_RECT_GAP_MOBILE_PX + CLUSTER_SWATCH_SIZE : FOLD2_COL_PITCH_DESKTOP_PX;
}
function fold2RowPitchPx() {
  return isMobile() ? FOLD2_RECT_GAP_MOBILE_PX + CLUSTER_SWATCH_SIZE : FOLD2_ROW_PITCH_DESKTOP_PX;
}
// Each camp block's center, as a fixed px distance either side of screen
// center (Figma: block centers at x=590 and x=913 about the frame's own 756).
// Symmetric on purpose — Figma's own two blocks are within ~5px of symmetric,
// and at @fold2 neither block carries a label to unbalance it.
// 180, not Figma's measured 160 — widened by eye with the `manual/` @fold3
// harness on 2026-09-04. @fold3's rows trail a LABEL out of each column, which
// @fold2's bare rect blocks don't, so the Figma gap that reads right at @fold2
// let the two camps' label runs close on each other at @fold3. One constant
// anchors both folds (and the camp headers) on purpose, so this is the value
// that has to satisfy the tighter of the two.
const FOLD2_CAMP_CENTER_GAP_PX = 180;
// Live gap for a given viewport width. Desktop keeps the Figma-measured 160px
// flat; on mobile (isMobile, js/core.js) the flat 160 would need ~500-600px of
// width, so the two blocks are instead set to a fixed 80px of VISIBLE space
// between their facing edges — chosen by eye on a 393px phone. It's a fixed px
// gap rather than a fraction of W because the blocks themselves are fixed px:
// a fraction made the visual gap drift against the grid's own 31px column
// pitch, and once it got tight the pair read as one continuous 8-column band
// instead of two camps. Both blocks plus the gap come to 288px, so it still
// fits the narrowest phones.
const FOLD2_CAMP_EDGE_GAP_MOBILE_PX = 80;
function campCenterGapPx(W) {
  if (!isMobile()) return FOLD2_CAMP_CENTER_GAP_PX;
  // The caller wants the HALF-gap (each camp anchors at W/2 ± this), and the
  // anchor is a block's CENTER — so half the block width is inside the gap.
  const blockW = (FOLD2_GRID_COLS - 1) * fold2ColPitchPx() + CLUSTER_SWATCH_SIZE;
  return (FOLD2_CAMP_EDGE_GAP_MOBILE_PX + blockW) / 2;
}

// 18 of @fold1's decorative dots (3 per group row) are picked out here to
// become @fold2's filler rects. Chosen by even spread across the whole dot
// sequence rather than the first 18, so the columns don't visibly gut one
// stretch of themselves when all the others shrink away. Deterministic per
// viewport height, same as the dot colors themselves. Re-run after every
// buildPage0AllDots() (initial load + resize), which recreates the dot els.
// Which cell of its camp's 4×3 block each group's own rect occupies at
// @fold2, by GROUPS index. Scattered on purpose (per explicit instruction:
// the 6 group colors sit *among* the @fold1-colored rects, "not in any
// particular order") rather than lining the blocks' right edge up into a
// readable column of its own. Deliberately NOT one per row either — a row
// may hold two group colors or none, which is what keeps the scatter reading
// as organic rather than as a disguised column. Nothing downstream depends
// on the row spread: at @fold3 every group flies out of this cell into its
// own row of the block's rightmost column (see the align beat in
// updateGroups), so the labels still get one clean line each.
const FOLD2_GROUP_CELL = [
  { row: 0, col: 1 },  // #31CE1C  מפגינים ערבים ישראלים   (change)
  { row: 0, col: 3 },  // #F9B624  תנועות התנחלות          (coalition)
  { row: 2, col: 0 },  // #F024FF  קבוצות ימין לאומיות     (coalition)
  { row: 2, col: 0 },  // #6B89FF  מתנגדי הרפורמה ותומכי עסקת החטופים (change)
  { row: 0, col: 0 },  // #FF1A94  פעילי שמאל              (change)
  { row: 1, col: 1 },  // #454545  מפגינים חרדים           (coalition)
];
// The scatter above is AUTHORED in the canonical 4-wide reading order; a cell's
// live (row, col) is derived from that flat index and the CURRENT block shape,
// so the same 12-cell roster lays out 4x3 or 3x4 without re-authoring it. This
// is also why nothing may cache a cell's row/col across a shape change.
const FOLD2_AUTHORED_COLS = 4;
const FOLD2_GROUP_CELL_INDEX =
  FOLD2_GROUP_CELL.map(c => c.row * FOLD2_AUTHORED_COLS + c.col);
function fold2CellOf(flatIdx) {
  return { row: Math.floor(flatIdx / FOLD2_GRID_COLS), col: flatIdx % FOLD2_GRID_COLS };
}
function fold2GroupCell(i) { return fold2CellOf(FOLD2_GROUP_CELL_INDEX[i]); }
// Flat cell roster, parallel to fold2FillerDots: cell k sits in `camp`'s
// block at grid row/col (0 = top / leftmost) — every cell of both blocks
// except the 6 FOLD2_GROUP_CELL gives the real .group-items.
function fold2FillerCells() {
  return [true, false].flatMap((camp) =>
    Array.from({ length: FOLD2_CELL_COUNT }, (_, k) =>
      ({ camp, flat: k, ...fold2CellOf(k) })
    ).filter(({ flat }) => !GROUPS.some((g, i) =>
      FOLD4_COALITION_ROWS.includes(g) === camp &&
      FOLD2_GROUP_CELL_INDEX[i] === flat))
  );
}
let FOLD2_FILLER_CELLS = fold2FillerCells();
// Per-cell color overrides for the filler dots, picked by eye at @fold2.
// Keyed by CELL, not by dot: which decorative dot lands in which cell depends
// on the viewport height (see the even-spaced pick below), so a per-dot record
// wouldn't survive a resize. A filler is a real @fold1 decorative dot flown
// into the grid — the SAME element in both folds — so overriding it here
// recolors the hero dot too, which is the point. Cells not listed keep their
// PAGE0_PALETTE color (page1.js) — but every cell is listed here on purpose,
// so which decorative dot the even-spaced pick happens to hand a cell no
// longer shows: the grid's 18 filler colors are fixed by cell at any viewport.
const FOLD2_FILLER_COLORS = [
  { camp: true,  row: 0, col: 0, color: "#E58415" },
  { camp: true,  row: 0, col: 1, color: "#757EFF" },
  { camp: true,  row: 0, col: 2, color: "#6754F8" },
  { camp: true,  row: 1, col: 0, color: "#009988" },
  { camp: true,  row: 1, col: 2, color: "#9900CC" },
  { camp: true,  row: 1, col: 3, color: "#7DBC01" },
  { camp: true,  row: 2, col: 1, color: "#FF6600" },
  { camp: true,  row: 2, col: 2, color: "#32CD8A" },
  { camp: true,  row: 2, col: 3, color: "#43C5E5" },
  { camp: false, row: 0, col: 2, color: "#F79940" },
  { camp: false, row: 0, col: 3, color: "#B522D3" },
  { camp: false, row: 1, col: 0, color: "#7D4EFD" },
  { camp: false, row: 1, col: 1, color: "#3E82CC" },
  { camp: false, row: 1, col: 2, color: "#EE3311" },
  { camp: false, row: 1, col: 3, color: "#E65B5B" },
  { camp: false, row: 2, col: 1, color: "#4422DD" },
  { camp: false, row: 2, col: 2, color: "#007755" },
  { camp: false, row: 2, col: 3, color: "#EE8800" },
];

let fold2FillerDots = [];
function assignFold2Fillers() {
  const pool = PAGE0_DECORATIVE_DOT_ELS;
  // Re-derived here rather than once at load, so a change to FOLD2_GRID_COLS is
  // picked up by the same call the resize handler already makes.
  FOLD2_FILLER_CELLS = fold2FillerCells();
  const need = FOLD2_FILLER_CELLS.length;
  fold2FillerDots = [];
  pool.forEach((d) => { d.isFold2Filler = false; });
  if (!pool.length) return;
  const step = pool.length / need;
  const used = new Set();
  // Matched on the AUTHORED flat index, not the live row/col, so a cell keeps
  // its hand-picked color when the block is reshaped (4x3 <-> 3x4).
  const cellColor = (cell) => {
    const hit = FOLD2_FILLER_COLORS.find(
      (o) => o.camp === cell.camp &&
        o.row * FOLD2_AUTHORED_COLS + o.col === cell.flat);
    return hit && hit.color;
  };
  // BY COLOR first: @fold1's dots are hand-arranged (PAGE0_DOT_COLORS,
  // page1.js) and several of them are deliberately carrying a filler cell's
  // color, so a cell takes the dot that already IS its color — otherwise the
  // spaced walk below would pick some other dot and repaint it, silently
  // undoing the hero arrangement. A dot is the same element in both folds, so
  // this is also the only pick that needs no repaint at all.
  for (let k = 0; k < need; k++) {
    const want = cellColor(FOLD2_FILLER_CELLS[k]);
    if (!want) continue;
    const idx = pool.findIndex(
      (d, i) => !used.has(i) && d.color.toLowerCase() === want.toLowerCase());
    if (idx < 0) continue;
    used.add(idx);
    fold2FillerDots[k] = pool[idx];
  }
  // Anything still unmatched (a cell color that no hero dot carries, e.g. an
  // unarranged slot below the hand-placed rows) falls back to the original
  // evenly-spaced walk over whatever dots are left, and IS repainted.
  for (let k = 0; k < need; k++) {
    if (fold2FillerDots[k]) continue;
    let idx = Math.min(pool.length - 1, Math.floor(k * step));
    while (used.has(idx) && idx < pool.length - 1) idx++;
    if (used.has(idx)) break; // very short viewport: fewer dots than cells
    used.add(idx);
    fold2FillerDots[k] = pool[idx];
    // Both the element and the record's `color` (read by the @fold2 flight in
    // js/update-groups.js) have to move together, and it has to happen here
    // rather than in page1.js — which dot is a filler isn't known until this
    // function has run.
    const want = cellColor(FOLD2_FILLER_CELLS[k]);
    if (!want) continue;
    pool[idx].color = want;
    pool[idx].el.style.background = want;
  }
  // A short viewport can leave holes; fold2FillerDots is indexed by cell, and
  // everything downstream tests each entry, so compact it back to a dense list
  // only if nothing was skipped.
  fold2FillerDots = fold2FillerDots.slice(0, need);
  fold2FillerDots.forEach((d) => { if (d) d.isFold2Filler = true; });
}
assignFold2Fillers();

// Parallel to GROUPS — group i's own @fold1 entrance progress (0..1, eased),
// continuously updated by playPage0Entrance's animation frame. Read by
// updateGroups() to keep every group-colored dot's swatch invisible/popping
// in (regardless of what labelT etc. would otherwise say) until its
// own beat of the @fold1 entrance, then stays at 1 forever after.
const page0PopT = GROUPS.map(() => 0);

// Hidden measuring span for the group labels at their @fold3 size (the plain
// .group-label 18px state). The camp grids' own horizontal placement is
// derived from these widths (see campFold3X/changeBlockX in
// updateGroups), and a label's rendered width can't be read off the live
// item — mid-@fold3 it only holds the characters typed so far. Cached by
// color, and re-measured once the webfont has actually loaded, since a
// fallback-face measurement would place the grids a few px off.
const groupLabelMeasureEl = document.createElement("span");
groupLabelMeasureEl.className = "group-label";
groupLabelMeasureEl.style.cssText = "visibility:hidden;left:-9999px;top:0";
let groupLabelWidths = {};
function groupLabelWidth(g) {
  if (groupLabelWidths[g.color] == null) {
    groupLabelMeasureEl.textContent = g.label;
    groupLabelWidths[g.color] = groupLabelMeasureEl.offsetWidth;
  }
  return groupLabelWidths[g.color];
}
// Same span, same cache lifetime — but the HEIGHT, which only says anything
// under the breakpoint: desktop labels are `white-space: nowrap` one-liners, so
// this is a constant there. On mobile .group-label wraps inside a 100px cap, so
// a label can be two or three lines tall and @fold3's row pitch has to be told
// about it (see fold3RowPitch in update-groups.js).
// Cached per color AND per font-size, because the two places that need it ask
// at different sizes — @fold3's camp column and the smaller mini-legend.
// maxWidth (px, or null for "whatever the stylesheet says") is part of the key
// too: the mini-legend gives its labels a WIDER cap than @fold3's columns do on
// mobile (see groupLabelLegendMaxWidth), and the cap is what decides the line
// count that this height is measuring.
let groupLabelHeights = {};
function groupLabelHeight(g, fontSize, maxWidth) {
  const key = `${g.color}@${fontSize}@${maxWidth == null ? "css" : maxWidth}`;
  if (groupLabelHeights[key] == null) {
    groupLabelMeasureEl.textContent = g.label;
    groupLabelMeasureEl.style.fontSize = `${fontSize}px`;
    if (maxWidth != null) groupLabelMeasureEl.style.maxWidth = `${maxWidth}px`;
    groupLabelHeights[key] = groupLabelMeasureEl.offsetHeight;
    groupLabelMeasureEl.style.fontSize = "";
    groupLabelMeasureEl.style.maxWidth = "";
  }
  return groupLabelHeights[key];
}

// The two type sizes a group label lerps between — its @fold3 camp-column size
// and the size it settles at in the mini-legend. They exist as functions rather
// than as the plain 18/14 literals that used to be inlined at the call sites
// because updateGroups writes `label.style.fontSize` INLINE on every frame, and
// an inline style beats the stylesheet: the `.group-label { font-size: 14px }`
// mobile rule was being silently overridden, so phones drew desktop-sized 18px
// labels that wrapped to three lines and collided. Keep these as the single
// source of truth — never re-inline the numbers.
// On mobile the two states keep DIFFERENT sizes: 14px in the @fold3 camp column,
// 12px in the mini-legend, which is the legend's finalized look — don't unify
// them. The cost is that a wrapped label's line breaks depend on its font-size
// and its wrap cap, so the label does reflow across the @fold4 glide; the cap is
// lerped alongside the size (js/update-groups.js) so that reflow is gradual
// rather than a line dropping all at once at the end.
function groupLabelColumnFontSize() { return isMobile() ? 16 : 18; }
function groupLabelLegendFontSize() { return isMobile() ? 12 : 14; }
// The wrap caps. null on desktop = "leave the stylesheet alone" (labels are
// nowrap one-liners there). On mobile @fold3 is capped at 100px because the two
// camps plus their outward-trailing labels must fit side by side across a 393px
// phone; the mini-legend can afford 150px, since each legend column owns a half
// width on its own, and the extra room drops the longest labels from three lines
// to two — which is what keeps the legend's rows tight (see fold6RowPitchPx).
const GROUP_LABEL_MAX_WIDTH_MOBILE = 100;   // must match .group-label's mobile cap in style.css
const FOLD6_LABEL_MAX_WIDTH_MOBILE = 150;
function groupLabelColumnMaxWidth() { return isMobile() ? GROUP_LABEL_MAX_WIDTH_MOBILE : null; }
function groupLabelLegendMaxWidth() { return isMobile() ? FOLD6_LABEL_MAX_WIDTH_MOBILE : null; }
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => { groupLabelWidths = {}; groupLabelHeights = {}; groupLabelInkShifts = {}; fold6MFlyLineCache.clear(); updateGroups(); });
}

// How far a label's INK center sits from its line box's own center, at a
// given font-size. `transform: translateY(-50%)` centers the line BOX, but a
// line box is sized from the font's full ascent/descent — and Hebrew type
// uses almost none of the descent, so box-centering leaves the visible text
// sitting low and the swatch reading as if it were aligned to the label's
// top rather than its middle. Measured off a fixed reference string (not
// each row's own text) so every row shifts by the same amount, and cached
// per font-size since it's a pure property of the face.
const GROUP_LABEL_INK_REF = "אבגדהוזחט";
let groupLabelInkShifts = {};
const groupLabelInkCtx = document.createElement("canvas").getContext("2d");
function groupLabelInkShift(fontSize) {
  const key = fontSize.toFixed(2);
  if (groupLabelInkShifts[key] == null) {
    groupLabelInkCtx.font = `${fontSize}px 'Assistant', sans-serif`;
    const m = groupLabelInkCtx.measureText(GROUP_LABEL_INK_REF);
    // Both pairs are distances from the baseline; the ink center and the box
    // center are each their own midpoint, and we want the gap between them.
    const inkCenter = (m.actualBoundingBoxDescent - m.actualBoundingBoxAscent) / 2;
    const boxCenter = (m.fontBoundingBoxDescent - m.fontBoundingBoxAscent) / 2;
    groupLabelInkShifts[key] = boxCenter - inkCenter;
  }
  return groupLabelInkShifts[key];
}

const groupsOverlayEl = document.getElementById("groupsOverlay");
// Active from page load, not just once fold2Trigger fires — each group's
// item sits at its @fold1 dot anchor (PAGE0_GROUP_DOT_ANCHORS, page1.js)
// from the very start, standing in for that dot among #page0DotsOverlay's
// other (decorative) dots. Like that overlay, this is fixed-position, so it
// stays put on screen as @fold1's title/subtitle scroll past underneath it
// — only moving once fold2Trigger actually fires (see updateGroups below).
//
// The `is-active` class that lifts this overlay off its shipped `opacity: 0`
// is NOT added here, at parse time: a .group-item carries no left/top until
// the first layoutGroups(), so it resolves to the overlay's own origin and all
// six rows paint stacked in the TOP-LEFT corner. That's a real visible flash,
// because bootstrap.js gates its first layoutGroups() behind
// Promise.all(document.fonts.load(...)) — ~70ms of hero on a refresh with six
// labels piled in the corner. bootstrap.js adds the class immediately after
// that first layout instead, so the overlay's first painted frame is already
// positioned. (layoutGroups also runs on resize; classList.add is idempotent.)

// The decorative (non-group) dots have nothing further to do once @fold2's
// legend starts arriving — each one shrinks to nothing in place (scaled
// individually, not the whole overlay, so every dot shrinks around its own
// center rather than toward one shared point) by fold2Trigger's own progress
// in updateGroups below, same trigger driving the legend's entrance, so both
// happen in lockstep.

const groupItems = GROUPS.map(({ color, label: labelText }) => {
  const el = document.createElement("div");
  el.className = "group-item";
  const swatch = document.createElement("span");
  swatch.className = "group-swatch";
  swatch.style.background = color;
  const label = document.createElement("span");
  label.className = "group-label";
  label.textContent = labelText;
  el.appendChild(swatch);
  el.appendChild(label);
  groupsOverlayEl.appendChild(el);
  return { el, label, swatch };
});
groupsOverlayEl.appendChild(groupLabelMeasureEl);

// 8 small static squares (Figma node 258:2206, a 2-column x 4-row grid,
// all `#2d2d2d`) that fade in at the center, taking the cluster's vacated
// spot as it moves into fold6's left mini-legend. Positions below are each
// square's own {dx, dy} offset from the 8-square group's own bounding-box
// center (computed from Figma's absolute coords: columns x=741/766, rows
// y=470/486/502/518, each square 8px — group center at x=757.5, y=498) —
// offsets, not absolute coords, so layoutFold6Squares can re-center the
// whole group at the canvas's own center regardless of viewport size,
// rather than reproducing Figma's absolute frame position. Reading order is
// row-by-row, left-to-right (Figma assigns no meaningful order of its own).
// Offsets below are scaled ~1.3x from Figma's raw column/row deltas (kept
// relative to the same group center) to open up the gap between squares a
// bit more than Figma's own tight 258:2206 spacing reads on screen.
const FOLD6_SQUARES_OFFSET = [
  { dx: -21.5, dy: -36.4 },
  { dx:  11.0, dy: -36.4 },
  { dx: -21.5, dy: -15.6 },
  { dx:  11.0, dy: -15.6 },
  { dx: -21.5, dy:   5.2 },
  { dx:  11.0, dy:   5.2 },
  { dx: -21.5, dy:  26.0 },
  { dx:  11.0, dy:  26.0 },
];
// Not shown in Figma node 258:2206 (no label layers next to the squares) —
// kept only as inert element text content (fold6-square-label stays
// opacity:0); harmless if never revealed. Index-aligned with
// FOLD6_SQUARE_ROW_IDS and carrying each pinned event's OWN category, so the
// label can't contradict the dot the square becomes; every one is a real
// P9_CATEGORIES pill (page9.js).
const FOLD6_SQUARE_LABELS = [
  "הפגנה לא אלימה",  // 0  row-11
  "הפרות סדר",       // 1  row-5
  "הפגנה לא אלימה",  // 2  row-7
  "פגיעה ברכוש",     // 3  row-6
  "חסימת כביש",      // 4  row-10
  "ניכוס שטח",       // 5  row-6794
  "הפגנה לא אלימה",  // 6  row-12
  "פגיעה ברכוש",     // 7  row-6795
];
// Reads GROUPS' own `color` (by `actor`, the same join key p7ActorColor in
// page7.js uses) rather than a second hardcoded hex list, so a future color
// edit on GROUPS updates these squares too.
function groupColorByActor(actor) {
  return GROUPS.find(g => g.actor === actor).color;
}
// Each square stands in for ONE specific real event, named by the xlsx's own
// stable row_id (passed through by server.py). The squares are the timeline's
// VERY FIRST events (explicit instruction): the 4 earliest left-camp events go
// in the left column (even indices, dx -16.5) and the 4 earliest right-camp
// ones in the right column (odd indices, dx +8.5, see FOLD6_SQUARES_OFFSET), so
// the two columns still read as the two camps.
//   0  row-11    2023-01-06  protesters against government   ← the tooltip square
//   1  row-5     2023-01-01  haredi jews
//   2  row-7     2023-01-02  arab israelis
//   3  row-6     2023-01-01  settlers
//   4  row-10    2023-01-05  protesters against government
//   5  row-6794  2023-01-01  settlers
//   6  row-12    2023-01-06  arab israelis
//   7  row-6795  2023-01-01  settlers
// The earliest rows are lopsided, so this leaves the right column one grey and
// three identical yellows, and neither פעילי שמאל (first event only 2023-02-27)
// nor קבוצות ימין לאומיות (2023-01-10) appears among the squares at all — a fact
// of the data, accepted. Swapping an id here is the whole edit; keep
// FOLD6_SQUARE_ACTORS and FOLD6_SQUARE_LABELS in step with it.
const FOLD6_SQUARE_ROW_IDS = [
  "row-11", "row-5", "row-7", "row-6",
  "row-10", "row-6794", "row-12", "row-6795",
];
// Index 0 is the tooltip square — @fold7's demo shows that one specific event
// (chosen by eye: the 2023-01-06 lawyers' protest outside the justice
// minister's Modi'in home, whose description fills the docked frame cleanly).
const FOLD6_TOOLTIP_ROW_ID = FOLD6_SQUARE_ROW_IDS[0];
// Not shown in Figma node 258:2206 either (all 8 squares render flat
// #2d2d2d there — see lerpFold6SquareColor's own null-target case, same
// value) — the actors only matter once @fold8 recolors/flies the squares out to
// their real per-event dots, a later beat that Figma frame doesn't depict. This
// list MUST mirror FOLD6_SQUARE_ROW_IDS' own rows: it can't be read off the
// data, because FOLD6_SQUARE_COLORS is computed at parse time, long before
// events.json has loaded.
// S=מתיישבים A=ערבים ישראלים H=חרדים P=מתנגדי הרפורמה
const FOLD6_SQUARE_ACTORS = [
  "protesters against government",       // 0 (L col) - P - blue
  "haredi jews",                         // 1 (R col) - H - grey
  "arab israelis",                       // 2 (L col) - A - green
  "settlers",                            // 3 (R col) - S - yellow
  "protesters against government",       // 4 (L col) - P - blue
  "settlers",                            // 5 (R col) - S - yellow
  "arab israelis",                       // 6 (L col) - A - green
  "settlers",                            // 7 (R col) - S - yellow
];
const FOLD6_SQUARE_COLORS = FOLD6_SQUARE_ACTORS.map(groupColorByActor);

// The lookups downstream (p7TargetForActorOccurrence / p7EventForActorOccurrence,
// page7.js) address an event as (actor, occurrence) — which occurrence of its own
// actor it is within its side's date-sorted list. That fragile positional number
// is DERIVED from the row id at first use (p7OccurrenceOfRowId) and cached, so
// adding or removing earlier events in the xlsx can't silently slide a square
// onto a neighbouring event. Resolved lazily because events.json loads after
// this file parses.
const fold6SquareOccurrences = new Array(FOLD6_SQUARE_ROW_IDS.length).fill(null);
const fold6SquareWarned = new Set();
function fold6SquareOccurrence(i) {
  if (fold6SquareOccurrences[i] !== null) return fold6SquareOccurrences[i];
  const rowId = FOLD6_SQUARE_ROW_IDS[i];
  const n = p7OccurrenceOfRowId(rowId);
  if (n === -1) {
    // Data not loaded yet (retry next frame), or the row is gone from the
    // dataset — in which case fall back to that actor's first event so the
    // square still has *an* event, and say so once.
    if (p7.ready && !fold6SquareWarned.has(rowId)) {
      fold6SquareWarned.add(rowId);
      console.warn(`fold6 square ${i}: row_id ${rowId} not in events.json — pick a new one`);
    }
    return 0;
  }
  fold6SquareOccurrences[i] = n;
  return n;
}

const fold6SquaresOverlayEl = document.getElementById("fold6SquaresOverlay");
const fold6SquareEls = FOLD6_SQUARES_OFFSET.map((_, i) => {
  const wrap = document.createElement("div");
  wrap.className = "fold6-square-wrap";
  const sq = document.createElement("div");
  sq.className = "fold6-square";
  const label = document.createElement("span");
  label.className = "fold6-square-label";
  label.textContent = FOLD6_SQUARE_LABELS[i];
  wrap.appendChild(sq);
  wrap.appendChild(label);
  fold6SquaresOverlayEl.appendChild(wrap);
  return { wrap, sq, label };
});

// Lerps a fold-6 square's background from its fold-8 resting color (#767676,
// lightened from Figma node 258:2206's original #2d2d2d fill per explicit
// instruction) toward a target group color as t goes 0->1 — null targetHex
// (the squares with no Figma-assigned color) just stays at that same
// #767676.
const FOLD6_SQUARE_REST_COLOR = [0x76, 0x76, 0x76];
// The tooltip frame's own neutral stroke — a touch lighter than the squares'
// resting fill (was the same #767676; lightened per explicit instruction). A
// stroke reads heavier than a fill at the same value, so the two constants
// deliberately diverge. Passed as `base` below by updateGroups' tooltip
// color lerp only.
const FOLD8_TOOLTIP_REST_COLOR = [0x85, 0x85, 0x85];
function lerpFold6SquareColor(targetHex, t, base = FOLD6_SQUARE_REST_COLOR) {
  const [r0, g0, b0] = base;
  if (!targetHex) return `rgb(${r0}, ${g0}, ${b0})`;
  const n = parseInt(targetHex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const rr = Math.round(r0 + (r - r0) * t);
  const gg = Math.round(g0 + (g - g0) * t);
  const bb = Math.round(b0 + (b - b0) * t);
  return `rgb(${rr}, ${gg}, ${bb})`;
}

function layoutFold6Squares(W, H) {
  // Each square sits at its own {dx, dy} offset (FOLD6_SQUARES_OFFSET) from
  // the whole 8-square group's center, which itself is pinned to the
  // canvas's own center — so the group is centered as a unit rather than
  // reproducing Figma's absolute frame position.
  fold6SquareEls.forEach(({ wrap }, i) => {
    const { dx, dy } = FOLD6_SQUARES_OFFSET[i];
    wrap.style.left = `${W / 2 + dx}px`;
    wrap.style.top  = `${H / 2 + dy}px`;
  });
}

const page2TitleCardEl  = document.querySelector("#page-1 .text-card");
// @fold3 (#page-2) — the group labels fading in next to their rects.
const page3TitleCardEl  = document.querySelector("#page-2 .text-card");
const page6TitleCardEl  = document.querySelector("#page-3 .text-card");
const page7TitleCardEl  = document.querySelector("#page-7 .text-card");
// Fold 6's own card (#page-6, "כל ריבוע מייצג..." — the timeline-intro title,
// not to be confused with page7TitleCardEl above, which is fold 8's #page-8
// card) drives the fold-6 squares' labels fading IN — previously this had no
// card of its own and just snapped on the instant fold6Trigger settled,
// which (now that that's a fixed ~1s tween instead of a scroll-coupled one)
// finishes long before the user actually reaches fold 7.
const fold7LabelCardEl  = document.querySelector("#page-6 .text-card");
// @fold5 (#page-4, «אספנו תיעודים…»): this card drives the 8 grey squares
// growing in at centre. @fold6 (#page-5, the ACLED methodology card) then
// drives the ACLED bottom-legend note fading in. They used to be one fold
// (and, before that, coupled to fold6Trigger, the split) — split per the
// 2026-09-03 review so the collection statement and the source stand alone.
const squaresRevealCardEl = document.querySelector("#page-4 .text-card");
const acledNoteCardEl     = document.querySelector("#page-5 .text-card");
// Hoisted above checkFold13 (below), which needs it already resolved at
// definition time — also reused by p13SyncGateVisibility further down.
// #page-11 is @fold12, the closing statement — NOT the outro/credits card,
// which sits behind it at #page-12 and shares the same wrapper class. The two
// halves of the old single hand-off are split across them on purpose:
//   - @fold12 (page12StickyEl) owns the scroll GATE and the scroll-linked fade
//     (fold13ScrollT) — everything fades away, but the extreme dots stay in
//     their columns;
//   - @fold13 (fold13OutroStickyEl) owns the freeform MORPH — the dots only
//     spread once the final card arrives.
const page12StickyEl       = document.querySelector("#page-11 .page12-sticky-center");
const fold13OutroStickyEl  = document.querySelector("#page-12 .page12-sticky-center");

// Generic discrete trigger: a fixed-duration 0<->1 phase fired once by
// crossing a scroll threshold (see watchCardThreshold below), exactly like
// p8Trigger/p8TriggerReverse (page8.js) and p9TriggerLine (page9.js) — never
// re-derives progress from live scroll position, so reversing mid-flight
// covers only the remaining distance rather than restarting.
function makeTrigger(duration, onTick, onSettle) {
  let fromT = 0, toT = 0, phaseStart = null;
  function currentRaw() {
    if (phaseStart === null) return fromT;
    const span = toT - fromT;
    if (span === 0) return toT;
    const localT = Math.min(1, (performance.now() - phaseStart) / (duration * Math.abs(span)));
    return fromT + span * localT;
  }

  function runLoop() {
    if (phaseStart === null) return;
    onTick();
    if (currentRaw() !== toT) {
      requestAnimationFrame(runLoop);
    } else {
      fromT = toT;
      phaseStart = null;
      onTick();
      // Fires once, the instant a phase reaches its target — lets one trigger
      // chain the next.
      if (onSettle) onSettle(toT);
    }
  }

  function trigger(target) {
    if (phaseStart === null && currentRaw() === target) return;
    fromT = currentRaw();
    toT = target;
    phaseStart = performance.now();
    runLoop();
  }

  // Instant, no animation — for priming initial state from the page's
  // starting scroll position (e.g. a reload mid-scroll), not a real trigger.
  // Calls onTick() itself (trigger()/runLoop do too, via requestAnimationFrame)
  // so the jump is actually reflected immediately rather than leaving
  // whatever was last painted on screen stale until some other trigger
  // happens to repaint — harmless at page-init time (nothing's painted yet)
  // but load-bearing for any later instant reset (e.g. watchCardThreshold's
  // instantReverse).
  function set(target) {
    fromT = target;
    toT = target;
    phaseStart = null;
    onTick();
  }

  return { currentRaw, currentT: () => p9Ease(currentRaw()), trigger, set };
}

// Fold triggers each fire once, at their card's center crossing.
//
// Most share one duration so the whole legend system reads as a single
// consistent tempo rather than each fold having its own slightly different
// feel — they used to range from 600ms to 1600ms.
const GROUP_TRANSITION_MS = 1900;
// fold2's entrance packs 3 sequential beats (shrink/move/headers, see
// updateGroups) into one trigger — sharing GROUP_TRANSITION_MS like every
// single-beat fold made each beat read as a quick blip. Own duration instead.
const FOLD2_ENTRANCE_MS = 2400;
// The 3 beats' windows on that one duration, as {start, len} fractions of the
// trigger's raw 0..1 timeline — shrink (@fold1's decorative dots collapsing),
// move (everything flying into the camp grids), header (the two camp titles
// typing in). Windows, not a sequential split, so beats may overlap: header
// currently shares move's exact window, i.e. the titles type as the rects fly.
// `let`, not `const`, only so the compare/manual harness
// (_debug-fold2-fly.js) can retune the sequencing live; production never
// writes to it.
// Tuned by eye on a live timeline harness, hence the un-round fractions —
// they're the ms windows (in the trailing comments) divided by
// FOLD2_ENTRANCE_MS. The dots' shrink and the flight deliberately overlap
// slightly, and the two camp headers type a beat apart rather than together.
const FOLD2_BEATS = {
  shrink:          { start: 0,     len: 0.198 },  //    0 →  475ms
  move:            { start: 0.073, len: 0.708 },  //  175 → 1875ms
  headerCoalition: { start: 0.677, len: 0.219 },  // 1625 → 2150ms
  headerChange:    { start: 0.781, len: 0.219 },  // 1875 → 2400ms
};
const fold2Trigger      = makeTrigger(FOLD2_ENTRANCE_MS, (...a) => updateGroups(...a));
// @fold3 (#page-2): the same 3-beat shape as @fold2 above — (1) the 18
// filler rects shrink away, (2) each row's surviving rect flies sideways so
// all 3 of a camp's rects line up in ONE vertical column, (3) the labels
// type in, cascading one rect at a time (see FOLD3_TYPE_ORDER below).
//
// Tuned by eye at @fold3 (manual/ harness), so the beats are now their own
// absolute MS windows rather than @fold2's fractions rescaled. The trigger
// still works in 0..1, so FOLD3_BEATS below is derived from the ms table —
// and the total is derived too, from whichever beat ends last, so there's
// never a stretch of dead timeline hanging off the end.
const FOLD3_BEAT_MS = {
  shrink: { start:   0, len:  376 },  //    0 →  376ms  filler rects shrink away
  align:  { start: 140, len: 1000 },  //  140 → 1140ms  rects fly into one column
  type:   { start: 750, len: 1140 },  //  750 → 1890ms  labels type in
};
const FOLD3_ENTRANCE_MS = Math.max(
  ...Object.values(FOLD3_BEAT_MS).map((b) => b.start + b.len));
const FOLD3_BEATS = Object.fromEntries(Object.entries(FOLD3_BEAT_MS).map(
  ([k, b]) => [k, { start: b.start / FOLD3_ENTRANCE_MS, len: b.len / FOLD3_ENTRANCE_MS }]));
// How much of `type` each row's own typing is delayed by, as a fraction of
// that beat — same "stagger inside one shared window" convention as @fold2's
// row-by-row flight (ROW_STAGGER below), so the last row still finishes
// exactly at the beat's end.
const FOLD3_TYPE_ROW_STAGGER = 0.10;
// Which order the labels type in. "rows": both camps' same-height rows type
// together, top to bottom (the original). "right"/"left": one whole camp
// top to bottom, then the other. "rtl": row by row down the screen, the
// right camp's row typing just before the left camp's.
const FOLD3_TYPE_ORDER = "right";
// The label's slot in that order, and how many slots there are — the stagger
// below is one shared window sliced by slot, so the last slot always finishes
// exactly at the beat's end whichever order is picked.
function fold3TypeSlot(row, isCoalition, rowCount) {
  if (FOLD3_TYPE_ORDER === "right") return (isCoalition ? 0 : rowCount) + row;
  if (FOLD3_TYPE_ORDER === "left")  return (isCoalition ? rowCount : 0) + row;
  if (FOLD3_TYPE_ORDER === "rtl")   return row * 2 + (isCoalition ? 0 : 1);
  return row;
}
const fold3TypeSlotCount = rowCount =>
  FOLD3_TYPE_ORDER === "rows" ? rowCount : rowCount * 2;
const fold3Trigger      = makeTrigger(FOLD3_ENTRANCE_MS, (...a) => updateGroups(...a));
// @fold4 (#page-3): 2 sequential beats on one trigger — the split
// merging back into one rect first, THEN the glide into the left mini-legend
// (see the raw-slice spans in updateGroups).
// onSettle chains the desktop label un-type: the labels stay for the whole
// glide (they ARE the thing being carried into the legend) and only spell
// themselves away once the row has landed — @fold4's end state on desktop is
// six bare swatches (explicit instruction). Reverses on a scroll back up,
// because settling at 0 resets it.
const fold6Trigger      = makeTrigger(GROUP_TRANSITION_MS, (...a) => updateGroups(...a),
  (target) => {
    if (isMobile()) return;   // mobile already un-types inside the glide itself
    if (target >= 1) fold6LabelUntypeTrigger.trigger(1);
    else fold6LabelUntypeTrigger.set(0);
  });
// The un-type after the glide, and its counterpart: hovering anywhere over the
// mini-legend types every label back in, BOTH columns at once (explicit
// instruction — the legend is one object, so it answers as one). Separate
// triggers so a hover part-way through the un-type still crossfades cleanly:
// the visible character count is max(1 - untype, hover), never their sum.
const FOLD6_LABEL_UNTYPE_MS = 900;
const FOLD6_LABEL_HOVER_MS  = 420;
const fold6LabelUntypeTrigger = makeTrigger(FOLD6_LABEL_UNTYPE_MS, (...a) => updateGroups(...a));
const fold6LabelHoverTrigger  = makeTrigger(FOLD6_LABEL_HOVER_MS,  (...a) => updateGroups(...a));
// Two invisible hit boxes, one per legend column, positioned per frame by
// updateGroups (they can't be CSS-only: the rows are laid out in JS against
// the live viewport). They live on .layout rather than inside .groups-overlay,
// whose `pointer-events: none` would otherwise have to be undone per child.
const fold6LegendHoverEls = [0, 1].map(() => {
  const el = document.createElement("div");
  el.className = "fold6-legend-hover";
  el.addEventListener("mouseenter", () => {
    fold6LabelHoverTrigger.trigger(1);
    fold6NoteHoverTrigger.trigger(1);
  });
  el.addEventListener("mouseleave", () => {
    fold6LabelHoverTrigger.trigger(0);
    fold6NoteHoverTrigger.trigger(0);
  });
  document.querySelector(".layout").appendChild(el);
  return el;
});
// Grey squares grow-in (@fold5, #page-4) and the ACLED bottom-legend note
// fade-in (@fold6, #page-5) — see squaresRevealCardEl / acledNoteCardEl above.
const squaresRevealTrigger = makeTrigger(GROUP_TRANSITION_MS, (...a) => updateGroups(...a));
// The note's own un-type: once @fold6's card has half left the top of the
// screen the note spells itself away from the end, leaving the title and the
// hairline behind. Hovering the legend types it back
// (fold6NoteHoverTrigger, declared just below). Desktop only —
// mobile has no hover, so an un-typed note there would be unrecoverable, so
// checkNoteUntype simply doesn't run under the breakpoint.
const FOLD6_NOTE_UNTYPE_MS = 900;
// The note's hover-retype is its OWN trigger rather than riding the labels'
// (explicit instruction): it doesn't have to land with them, and it wants more
// breathing time — there is a great deal more text here than in a group label,
// and the card is opening underneath it at the same time. Fired from exactly
// the same two places as fold6LabelHoverTrigger, so hovering the legend or the
// note itself still brings both back; only the tempo differs.
const FOLD6_NOTE_HOVER_MS = 700;
const fold6NoteHoverTrigger = makeTrigger(FOLD6_NOTE_HOVER_MS, (...a) => updateGroups(...a));
const acledNoteTrigger     = makeTrigger(GROUP_TRANSITION_MS, (...a) => updateGroups(...a));
const fold6NoteUntypeTrigger = makeTrigger(FOLD6_NOTE_UNTYPE_MS, (...a) => updateGroups(...a));
const fold7LabelTrigger = makeTrigger(GROUP_TRANSITION_MS, (...a) => updateGroups(...a));
// Matches FOLD8_GROW_MS (the tooltip's own wall-clock grow-to-full-scale
// time, see its comment above) — not the typewriter that follows it — so the
// non-tooltip squares' dim-to-color fade finishes exactly as the tooltip
// reaches max scale, instead of tracking the shared GROUP_TRANSITION_MS tempo.
const FOLD8_SQUARE_DIM_MS = FOLD8_GROW_MS;
const fold8SquareDimTrigger = makeTrigger(FOLD8_SQUARE_DIM_MS, (...a) => updateGroups(...a));
// @fold7 trigger #2 (teacher review 2026-09-03, F1): the tooltip demo used to
// ride fold7LabelTrigger, so it grew + typed at the very moment the title
// card was passing over the squares — the two collided. It now has its own
// trigger, crossed once the card has cleared the tooltip's own top edge (see
// fold8TooltipCardFrac below), i.e. the card has moved on above the tooltip
// before it pops. Trigger #1 (the 0.5 crossing shared with the labels) only
// dims the 7 non-demo squares so square 0 stands out.
// The eased t gates the tooltip; its raw progress is what the reversible
// grow-then-type sequence senses direction from (fold8AdvanceSequence).
//
// The gap the card keeps above the tooltip's measured top edge. This is the
// only hand-tuned number left in this crossing — everything else is measured
// off the real box, so the crossing tracks the tooltip's actual size and spot
// on any viewport instead of assuming them.
const FOLD8_TOOLTIP_CLEARANCE_PX = 30;
// Fallback only, for the frames before events.json has loaded (the demo
// event's text is what gives the box its height) or if the demo square isn't
// built yet — the old fixed offset, kept so the crossing still has somewhere
// sane to sit rather than snapping to the house 0.5 and colliding again.
const FOLD8_TOOLTIP_ABOVE_PX = 400;
const fold8TooltipTrigger = makeTrigger(GROUP_TRANSITION_MS, (...a) => updateGroups(...a));
// @fold10 trigger #1 — its title card's ordinary midpoint crossing. Colors in
// only the highlighted square (index 0) and its tooltip's border; the other
// 7 squares are untouched by this trigger.
const FOLD9_COLOR_MS = 500;
const fold9Trigger = makeTrigger(FOLD9_COLOR_MS, (...a) => updateGroups(...a));
// @fold10 trigger #2 — the same crossing that makes the year axis appear
// (its title card passing fully offscreen, top <= 0 — see p7AxisShouldShow/
// p7HasEngaged, page7.js). Colors in all 8 fold-6 squares (in their own
// actor's group color) and flies each one to the real per-event dot it's
// standing in for (FOLD6_SQUARE_ROW_IDS/FOLD6_SQUARE_ACTORS below,
// p7TargetForActorOccurrence, page7.js) — permanently; the real per-event
// cascade never draws its own dot for these 8 events at all
// (p7GetClaimedEvents, page7.js), so this DOM square just stays visible once
// it arrives, no handoff to a separate real dot.
// This fly is INDEPENDENT of p7HasEngaged (page7.js, gates the real per-event
// cascade + the axis fill): both fire off the same crossing and simply play at
// the same time — the axis/cascade never waits for the squares to land. Since
// a fast scroll can carry currentPage on to the pinned real-timeline section
// (#page-8) before this 1500ms fly has finished, draw() below is called
// unconditionally (not just while currentPage === 7) so whichever page is now
// active keeps re-running the fly's own per-frame work.
const FOLD9_FLY_MS = 1500;
const fold9FlyTrigger = makeTrigger(FOLD9_FLY_MS, () => {
  updateGroups();
  draw();
  checkFold9TooltipShrink();
});

// Keeps the fold-6 squares' blend toward page9's legit grid (see the
// p9LegitPosOf-based lerp in updateGroups) moving in lockstep with page8's
// own real-dot glide (p8CurrentT, page8.js) even once the user stops
// scrolling mid-glide — page8's own animation loop (p8RunAnimLoop) is a pure
// wall-clock requestAnimationFrame loop, not tied to further scroll events,
// but nothing besides a fresh "scroll" event otherwise re-runs updateGroups()
// for these squares, so without this they'd freeze wherever they were at the
// last scroll event while the real dots kept animating on to completion.
// Self-terminating: stops rescheduling once p8CurrentT() reaches 1, and is
// re-armed (see updateGroups above) the next time it's needed.
let fold9P8SyncLoopRunning = false;
function fold9EnsureP8SyncLoop() {
  if (fold9P8SyncLoopRunning) return;
  fold9P8SyncLoopRunning = true;
  (function tick() {
    updateGroups();
    if (typeof p8CurrentT === "function" && p8CurrentT() < 1) {
      requestAnimationFrame(tick);
    } else {
      fold9P8SyncLoopRunning = false;
    }
  })();
}

// Once square 0 (the tooltip's own square) actually arrives at its real dot
// (fold9FlyTrigger's raw progress reaching 1 — every square, including 0,
// finishes exactly at raw 1 regardless of its own stagger delay, see
// FOLD9_SQUARES_FLY_STAGGER's comment below), the tooltip holds fully shown
// for another FOLD9_TOOLTIP_SHRINK_DELAY_MS before it starts shrinking away
// on its own short trigger, so it doesn't feel like it vanishes the instant
// the dot lands. Un-latches (and reverses immediately, no delay) if
// fold9FlyTrigger ever drops back below raw 1 before the delay/shrink has
// finished — e.g. the user scrolls back up before this trigger has even
// fully settled from its own instant reverse — canceling any still-pending
// delay timer so it can't fire late into a reversed state.
const FOLD9_TOOLTIP_SHRINK_MS = 400;
const FOLD9_TOOLTIP_SHRINK_DELAY_MS = 500;
const fold9TooltipShrinkTrigger = makeTrigger(FOLD9_TOOLTIP_SHRINK_MS, (...a) => updateGroups(...a));
let fold9FlyReachedPast = null;
let fold9TooltipShrinkDelayTimer = null;
function checkFold9TooltipShrink() {
  const nowReached = fold9FlyTrigger.currentRaw() >= 1;
  if (fold9FlyReachedPast === null) { fold9FlyReachedPast = nowReached; fold9TooltipShrinkTrigger.set(nowReached ? 1 : 0); return; }
  if (nowReached !== fold9FlyReachedPast) {
    fold9FlyReachedPast = nowReached;
    if (fold9TooltipShrinkDelayTimer !== null) {
      clearTimeout(fold9TooltipShrinkDelayTimer);
      fold9TooltipShrinkDelayTimer = null;
    }
    if (nowReached) {
      fold9TooltipShrinkDelayTimer = setTimeout(() => {
        fold9TooltipShrinkDelayTimer = null;
        fold9TooltipShrinkTrigger.trigger(1);
      }, FOLD9_TOOLTIP_SHRINK_DELAY_MS);
    } else {
      fold9TooltipShrinkTrigger.trigger(0);
    }
  }
}
// @fold11 on mobile pins the pill tray as a band under the titles, right where
// the docked tooltip frame has been sitting since @fold8 — so the frame steps
// down to p9DockTopM() (page9.js) to make room, and back up on the way out.
// Fired from page9UpdateFromScroll's `isStuck` crossing, the same one that
// slides the band in; matches .page9-tray's own 850ms slide so the two move as
// one gesture. A trigger rather than a CSS `transition: top` because the frame's
// `top` is already rewritten every frame by the @fold7→@fold8 dock lerp, and a
// transition would smear that.
const P9_TOOLTIP_DROP_MS = 850;
const p9TooltipDropTrigger = makeTrigger(P9_TOOLTIP_DROP_MS, () => {
  if (typeof fold8TooltipEl !== "undefined" && fold8TooltipEl) tooltipDockMobile(fold8TooltipEl);
});

const fold13Trigger           = makeTrigger(GROUP_TRANSITION_MS, (...a) => updateFold13(...a));
let   fold13MorphStarted      = false;

// Watches one title card's top edge for crossing H*frac, firing trigger
// forward (1) on a downward crossing and reverse (0) on scrolling back up
// past the same point. The first ever call just primes isPast against
// whatever the starting scroll position already is (via trigger.set, no
// animation) — otherwise a page load/refresh mid-scroll would play every
// already-passed fold's animation from scratch on the first scroll tick.
//
// instantReverse (default false, every other caller keeps the normal
// animated-both-ways behavior): when true, scrolling back up snaps the
// reverse (0) straight to its end state via trigger.set instead of
// trigger.trigger.
function watchCardThreshold(cardEl, frac, trigger, instantReverse = false) {
  let isPast = null;
  return function check() {
    if (!cardEl) return;
    // frac may be a function, read fresh each check, for folds whose crossing
    // point differs by viewport (see FOLD6_CARD_FRAC below).
    const f = typeof frac === "function" ? frac() : frac;
    const cardTop = cardEl.getBoundingClientRect().top;
    const threshold = window.innerHeight * f;
    const nowPast = cardTop <= threshold;
    if (isPast === null) { isPast = nowPast; trigger.set(nowPast ? 1 : 0); return; }
    if (nowPast !== isPast) {
      isPast = nowPast;
      // An instant jump (iOS status-bar tap, Home key, anchor) can put the
      // crossing point a whole screen or more behind by the time the check
      // runs. Playing the ~2s animated transition then means the fold's fixed
      // overlays (מקרא panel demo, fold8 tooltip, group labels un-typing…)
      // visibly play out on top of whatever fold the reader actually landed
      // on. If the card is over a viewport past its threshold, the reader
      // never saw the crossing — snap to the end state instead of animating.
      // A normal scroll always checks within a few px of the threshold, so
      // this never fires there.
      const overshoot = nowPast ? threshold - cardTop : cardTop - threshold;
      if ((!nowPast && instantReverse) || overshoot > window.innerHeight) {
        trigger.set(nowPast ? 1 : 0);
      } else trigger.trigger(nowPast ? 1 : 0);
    }
  };
}

// Fold 2's legend (the groups overlay's first appearance) is tied to the title
// card directly — same 0.5 convention and makeTrigger/watchCardThreshold
// machinery as every other fold — so the legend's appearance stays in sync
// with its own title and gives it a t (below) to stagger the rows' entrance.
// House 0.5, tuned by eye against a live harness AFTER #page-1's card was
// pulled up + its section shortened (style.css, G1): the card now enters the
// viewport early enough on its own that the earlier 0.75 crossing fired the
// dot flight while the hero title was still on screen. The gap after @fold1
// is closed by the card's position, not by an early trigger.
const FOLD2_CARD_FRAC = 0.5;
const checkFold2      = watchCardThreshold(
  page2TitleCardEl, () => (isMobile() ? 0.5 : FOLD2_CARD_FRAC), fold2Trigger);
// @fold3 fires earlier than the house 0.5 on mobile, same reason as @fold4
// below: the shrink + the labels typing in need more of the fold still on
// screen there. A bigger fraction = an earlier crossing. Desktop keeps 0.5.
const FOLD3_CARD_FRAC = 0.6;
const checkFold3      = watchCardThreshold(
  page3TitleCardEl, () => (isMobile() ? FOLD3_CARD_FRAC : 0.5), fold3Trigger);
// @fold4 fires EARLIER than the house 0.5 on mobile: the crossing has to leave
// room for the whole hand-off — the rows and camp headers flying into the מקרא
// panel, its 1s hold and its shrink back into the button — to play while the
// fold is still on screen. A bigger fraction is an earlier crossing (the card's
// top only has to reach further down the viewport); 0.8 fires it as the card
// is still coming up, per explicit instruction (0.75 → 0.85 → 0.8, tuned by
// eye; then 0.8 → 0.7, a bit later, per explicit instruction).
// Desktop keeps 0.5: it has no panel demo, and its glide is settled.
const FOLD6_CARD_FRAC = 0.7;
const checkFold6      = watchCardThreshold(
  page6TitleCardEl, () => (isMobile() ? FOLD6_CARD_FRAC : 0.5), fold6Trigger);
const checkSquaresReveal = watchCardThreshold(squaresRevealCardEl, 0.5, squaresRevealTrigger);
const checkAcledNote     = watchCardThreshold(acledNoteCardEl, 0.5, acledNoteTrigger);
// The note un-types on @fold7's crossing (explicit instruction) — the same
// card and fraction as fold7LabelTrigger / fold8SquareDimTrigger below, so the
// note clears exactly as the square labels fold takes over. Wrapped rather
// than chained off fold7LabelTrigger so mobile can opt out: there is no hover
// there to type it back.
const checkNoteUntype    = () => { if (!isMobile()) watchNoteUntype(); };
const watchNoteUntype    = watchCardThreshold(
  fold7LabelCardEl, 0.5, fold6NoteUntypeTrigger);
const checkFold7Label = watchCardThreshold(fold7LabelCardEl, 0.5, fold7LabelTrigger);
const checkFold8SquareDim = watchCardThreshold(fold7LabelCardEl, 0.5, fold8SquareDimTrigger);
// The demo tooltip's height, measured off a real (hidden, offscreen) copy of
// #page9Tooltip carrying the demo event's own date + description — the box is
// `display: none` until it's shown, so it can't be measured in place, and its
// height depends on how many lines that description wraps to at this width.
// Cached; invalidated on resize, since a width change can re-wrap the text.
// Returns null while the data (or the element) isn't there yet.
let fold8TooltipHeightCache = null;
window.addEventListener("resize", () => { fold8TooltipHeightCache = null; });
function fold8MeasureTooltipHeight() {
  if (fold8TooltipHeightCache !== null) return fold8TooltipHeightCache;
  if (typeof fold8TooltipEl === "undefined" || !fold8TooltipEl) return null;
  const event = typeof p7EventForActorOccurrence === "function"
    ? p7EventForActorOccurrence(FOLD6_SQUARE_ACTORS[0], fold6SquareOccurrence(0))
    : null;
  if (!event) return null;
  const probe = fold8TooltipEl.cloneNode(true);
  probe.removeAttribute("id");
  // .is-visible is what flips it to display:flex; .is-mirrored matches the
  // variant @fold7 actually shows (same border-radius, same box width).
  probe.classList.add("is-visible", "is-mirrored");
  probe.style.cssText += ";visibility:hidden;left:-9999px;top:-9999px;opacity:1;transform:none;";
  const dateEl = probe.querySelector(".page9-tooltip-date");
  const descEl = probe.querySelector(".page9-tooltip-desc");
  if (dateEl) dateEl.textContent = p7FormatDateDMY(event.date);
  if (descEl) descEl.textContent = event.descHeMedium || "";
  document.body.appendChild(probe);
  const h = probe.getBoundingClientRect().height;
  probe.remove();
  if (h > 0) fold8TooltipHeightCache = h;
  return h > 0 ? h : null;
}

// Desktop: fire once the title card's BOTTOM has risen clear of the top edge
// of where the demo tooltip is about to appear, plus FOLD8_TOOLTIP_CLEARANCE_PX
// of breathing room. Both ends of that are measured rather than assumed — the
// tooltip's top is derived from square 0's own live rect exactly the way
// fold8PositionTooltip (js/fold8-tooltip.js) derives it, and the card's height
// from the card itself — so the crossing follows the tooltip on any viewport
// instead of riding a fixed 400px guess that only held at one window size.
// watchCardThreshold compares the card's TOP against frac * innerHeight, hence
// subtracting the card's own height here to express "the card's bottom".
// Mobile keeps 0.5: its tooltip is docked at a fixed spot, nothing to collide.
function fold8TooltipCardFrac() {
  if (isMobile()) return 0.5;
  const fallback = 0.5 - FOLD8_TOOLTIP_ABOVE_PX / window.innerHeight;
  const entry = typeof fold6SquareEls !== "undefined" ? fold6SquareEls[0] : null;
  const sq = entry ? entry.sq : null;
  const tipH = fold8MeasureTooltipHeight();
  if (!sq || tipH === null || !fold7LabelCardEl) return fallback;
  const sqRect = sq.getBoundingClientRect();
  if (!sqRect.height) return fallback;
  // Mirrors fold8PositionTooltip's own math: the box's bottom edge sits
  // TOOLTIP_GAP above the square's centre, clamped 8px off the viewport top.
  const TOOLTIP_GAP = 5;
  const tipTop = Math.max(sqRect.top + sqRect.height / 2 - TOOLTIP_GAP - tipH, 8);
  const cardH = fold7LabelCardEl.getBoundingClientRect().height;
  const frac = (tipTop - FOLD8_TOOLTIP_CLEARANCE_PX - cardH) / window.innerHeight;
  // A frac at or below 0 would need the card fully offscreen to ever cross —
  // on a short viewport the tooltip can sit that high. Clamp so the trigger
  // stays reachable; it just fires as the card's top leaves the screen.
  return Math.max(frac, 0);
}
const checkFold8Tooltip = watchCardThreshold(
  fold7LabelCardEl, fold8TooltipCardFrac, fold8TooltipTrigger);
const checkFold9 = watchCardThreshold(page7TitleCardEl, 0.5, fold9Trigger);
// Same crossing as p7AxisShouldShow (page7.js) — title card fully offscreen,
// top <= 0. Used to instant-reverse (snap straight back to rest on scroll-up
// rather than being catchable mid-flight) — per explicit instruction, this is
// now a normal reversible trigger like every other fold's, so scrolling back
// up from @fold9 into @fold8 plays the same fly-out/color-in animation in
// reverse, covering only the remaining distance, instead of snapping.
const checkFold9Fly = watchCardThreshold(page7TitleCardEl, 0, fold9FlyTrigger);
// Watches the *sticky wrapper* (.page12-sticky-center), not the title card —
// the card is centred inside a 100vh wrapper flush with the section top, so
// the wrapper's own top is the section's arrival.
//
// It watches @fold13's wrapper, not @fold12's: the freeform spread belongs to
// the FINAL card. @fold12's own arrival fades everything out but deliberately
// leaves the extreme dots standing in their columns — that half is
// fold13ScrollT, which is scroll-linked and measured off #page-11 separately.
//
// frac 0.5, the house convention — NOT 0. @fold13 is the last section on the
// page, exactly one viewport tall, so its wrapper's top reaches 0 only at
// scrollY === document bottom: frac 0 made the spread (and with it the camp
// divider's fade, which rides the same progress) fire at the very last
// scrollable pixel, if subpixel rounding let it fire at all. Half a viewport
// in is comfortably reachable and gives the morph its full
// GROUP_TRANSITION_MS on screen. The gate physically can't be crossed while
// locked (scrollY is capped a whole fold short of here — see p13GateMax/
// p13GateLocked), so no extra lock check is needed.
const checkFold13 = watchCardThreshold(fold13OutroStickyEl, 0.5, fold13Trigger);

function checkGroupTriggers() {
  checkFold2(); checkFold3(); checkFold6(); checkSquaresReveal(); checkAcledNote(); checkNoteUntype(); checkFold7Label(); checkFold8SquareDim(); checkFold8Tooltip(); checkFold9(); checkFold9Fly(); checkFold13();
}

// Default (camp-column) swatch size + the swatch-to-label gap
// established earlier — vs. the smaller mini-legend ones (Figma node
// 120:1279/Frame 3219), interpolated continuously by fold6Trigger rather
// than snapped, same "seamless, no popping" rule as every other transition.
// CLUSTER_SWATCH_SIZE itself is hoisted to the @fold2 grid block far above —
// its pitches are DERIVED from it at module scope, and a `const` can't be read
// before its own declaration (temporal dead zone). Same reason FOLD4_*_ROWS
// live up there rather than beside @fold4's own code.
const CLUSTER_LABEL_GAP = 12;
const LEFT_LEGEND_SWATCH_SIZE = 6, LEFT_LEGEND_LABEL_GAP = 6;
// Mini-legend geometry: each column's inset from ITS OWN screen edge, in px
// (not frame units — tuned by eye at one viewport, see CLAUDE.md's manual/
// rule), plus the row-to-row pitch. GROUPS' per-group fold6.y is now only
// read for row ORDER (via FOLD6_ROW_FRAME_YS below); the actual spacing all
// comes from FOLD6_ROW_PITCH, so the three rows can never drift apart.
const FOLD6_LEGEND_INSET_LEFT = 31, FOLD6_LEGEND_INSET_RIGHT = 31;
// Hover hit box per legend column (see fold6LegendHoverEls). Wide enough to
// cover the longest label plus its swatch; the pad gives the top/bottom rows
// and the outer edge a little slack so the labels don't flicker off when the
// pointer sits just outside the text.
const FOLD6_LEGEND_HOVER_W = 230, FOLD6_LEGEND_HOVER_PAD = 14;
// Mobile: 31px off each edge of a 393px phone spends 16% of the width on
// margins the desktop frame could afford and a phone can't — the two columns
// read as floating well inboard of the screen. Both columns use this instead.
const FOLD6_LEGEND_INSET_MOBILE = 12;
function fold6LegendInsetLeft()  { return isMobile() ? FOLD6_LEGEND_INSET_MOBILE : FOLD6_LEGEND_INSET_LEFT; }
function fold6LegendInsetRight() { return isMobile() ? FOLD6_LEGEND_INSET_MOBILE : FOLD6_LEGEND_INSET_RIGHT; }
const FOLD6_ROW_PITCH = 24;
// Mobile only: top inset of the mini-legend's FIRST row, in px off the top of
// the viewport (see fold6RowIndexY). Desktop keeps the frame-scaled, roughly
// vertically-centered anchor.
const FOLD6_LEGEND_TOP_MOBILE = 24;

// @fold2's two camp-column headers + the divider between them (Figma node
// 277:1608, frame 1512×982: swatch columns at x=719/782 either side of the
// x=756 divider, rows at y=489/529/566, headers at y=414). Rows are read
// live off GROUPS' own fold4.x/y (by color) rather than re-declared here, so
// the header/divider position can never drift out of sync with the table
// above if it's ever tweaked.
// (FOLD4_COALITION_ROWS/FOLD4_CHANGE_ROWS themselves are declared up by
// GROUPS — @fold2's own grid roster needs them before this point.)
const CAMP_HEADER_TITLE_COALITION = "מחנה הימין";
const CAMP_HEADER_TITLE_CHANGE    = "גוש השינוי";
// Plain px from each column's own top-row center up to its header's center —
// fixed, NOT frame-scaled (it used to multiply by H/GROUPS_FRAME_H, which made
// the gap breathe on window resize while everything around it held; per
// explicit instruction it stays constant). Started at Figma's own 73 (row
// center 494.5, header center 421); tuned down by eye per explicit
// instruction, so this no longer matches the Figma frame — don't "fix" it back.
const FOLD4_HEADER_GAP = 36;
// Desktop only: @fold3's own header gap, slightly larger than @fold2's (per
// explicit instruction). Same px units as FOLD4_HEADER_GAP; updateGroups
// lerps between the two over alignT, mirroring the mobile pair below.
const FOLD3_HEADER_GAP = 42;
// Mobile only: plain px of VISIBLE white between the header's text box and the
// top edge of its top swatch row — not a frame-scaled center-to-center
// distance like the desktop value above. Both the header line box and the 11px
// swatch are fixed px, so on a phone an H-scaled distance would let the visible
// gap drift with viewport height (and the URL bar). Tuned by eye.
const FOLD4_HEADER_GAP_MOBILE_PX = 20;
// Mobile only: the same visible gap once @fold3's align beat has pulled the
// rects into one column per camp. Currently equal to @fold2's, per explicit
// instruction — the header sits the same distance off the top row in both folds,
// so the lerp updateGroups runs between them over alignT is inert at these
// values. It stays a separate constant (and a lerp) so the two folds can diverge
// again without @fold3's value leaking back into @fold2.
const FOLD3_HEADER_GAP_MOBILE_PX = FOLD4_HEADER_GAP_MOBILE_PX;
// Mobile only: the מקרא bar's distance from the TOP EDGE of the viewport. The
// button is the ONLY thing left on screen from @fold4 on (per explicit
// instruction) — the camp names live inside the panel, not on the page — so
// this single number positions the whole bar and never changes after @fold4.
const FOLD6_MLEGEND_TOP_MOBILE_PX = 16;
// Both camp blocks are placed symmetrically about screen center from
// FOLD2_CAMP_CENTER_GAP_PX (see the @fold2 grid block above) — there's no
// longer a center divider to hang either column off (Figma node 279:1342
// shows none), so the old FOLD4_DIVIDER_GAP_PX/FOLD4_COALITION_COL_GAP_PX
// pair (and .fold4-divider itself) are gone. Both blocs still read RTL the
// same way, so each group's own rect is its row's RIGHTMOST grid cell and
// @fold3's typed-in label trails left off it, over the space the row's 3
// filler rects vacate as they shrink.

const campHeaderCoalitionEl = document.createElement("div");
campHeaderCoalitionEl.className = "camp-header";
campHeaderCoalitionEl.textContent = CAMP_HEADER_TITLE_COALITION;
groupsOverlayEl.appendChild(campHeaderCoalitionEl);

const campHeaderChangeEl = document.createElement("div");
campHeaderChangeEl.className = "camp-header";
campHeaderChangeEl.textContent = CAMP_HEADER_TITLE_CHANGE;
groupsOverlayEl.appendChild(campHeaderChangeEl);

// Both camp headers TYPE in on @fold2's 3rd beat rather than just fading (same
// spec as @fold3's labels). They reuse fold8's two-span typewriter, not the
// plain typedText() the labels use, because these are CENTERED on their block:
// with plain text the box would grow outward from its own center and the whole
// header would visibly slide left as it typed. The two-span version lays the
// full string out from the first frame and only moves characters between the
// visible and the transparent span, so the header sits still.
const fold4HeaderSpansCoalition = fold8SetupTypewriter(
  campHeaderCoalitionEl, CAMP_HEADER_TITLE_COALITION);
const fold4HeaderSpansChange = fold8SetupTypewriter(
  campHeaderChangeEl, CAMP_HEADER_TITLE_CHANGE);

// Both headers are centered over their own camp block (Figma node 279:1342
// centers each title on its grid), so they override .camp-header's
// default right-edge translate(-100%, -50%) anchor.
campHeaderCoalitionEl.style.transform = "translate(-50%, -50%)";
campHeaderChangeEl.style.transform = "translate(-50%, -50%)";

// @fold3's labels don't fade in — they TYPE in, character by character, over
// fold3Trigger's own eased progress (per explicit spec). Reverses cleanly
// (characters unwind) because labelT reverses like every other trigger.
function typedText(full, t) {
  return full.slice(0, Math.round(Math.max(0, Math.min(1, t)) * full.length));
}

// Source-credit line under fold6's mini-legend (no Figma node — new content,
// not part of the original design). Fixed px width/font, same "position
// anchors are frame-scaled, sizing isn't" convention as .group-label's own
// hardcoded font sizes above. FOLD6_TOP_ROW is the mini-legend's top-most row
// of the RIGHT (coalition) column — the column the note hangs below.
const FOLD6_NOTE_TEXT = "הנתונים לקוחים מגוף המחקר הבינלאומי ACLED, המתעד וממפה אירועי מחאה ואלימות פוליטית על בסיס דיווחים מכלי תקשורת ומקורות מקומיים.";
const FOLD6_NOTE_WIDTH = 155;
// Heading over the note (explicit instruction). Same 14px/1.4 box as the note
// so the divider's ink-top math below keeps working unchanged — only the
// weight separates them.
const FOLD6_NOTE_TITLE_TEXT = "איסוף הנתונים";
const FOLD6_NOTE_TITLE_GAP = 4;   // px between the title's box and the note's
// Divider (faint hairline) sits between the last row and the note. The two
// gaps are EQUAL on purpose — that's what keeps the divider in the middle of
// the rows→note gap (explicit instruction); widen/narrow them together.
// The horizontal hairline under the rows is GONE (explicit instruction),
// replaced by a VERTICAL rule down the right (reading-start) edge of the note
// block that grows and shrinks with the typing. FOLD6_NOTE_TOP_GAP is the old
// 8+1+8 stack collapsed into one number so the note's distance from the rows
// is unchanged.
const FOLD6_NOTE_TOP_GAP = 17;
const FOLD6_RULE_W = 1;      // the rule's thickness
const FOLD6_RULE_GAP = 8;    // px between the rule and the text's right edge
// The vertical rule runs a little past the note's last line so it sticks out at
// the bottom rather than stopping flush with the ink (explicit instruction).
const FOLD6_RULE_OVERHANG = 5;
// Lowest fold6.y among the coalition (right-column) mini-legend rows —
// computed rather than hardcoded so adding a row above the coalition bloc
// re-anchors the note.
const FOLD6_TOP_ROW_INDEX = GROUPS.reduce(
  (best, g, i) =>
    (g.fold6 && FOLD4_COALITION_ROWS.includes(g) && (best < 0 || g.fold6.y < GROUPS[best].fold6.y)) ? i : best,
  -1
);
const FOLD6_TOP_ROW = GROUPS[FOLD6_TOP_ROW_INDEX];

// Distinct mini-legend row y's, top→bottom — the ORDER of the rows only. The
// top one's frame y is the block's vertical anchor (scaled with H like every
// other frame coordinate); every row below it is FOLD6_ROW_PITCH px further
// down, so editing the pitch moves rows 2/3 without touching GROUPS.
const FOLD6_ROW_FRAME_YS = [...new Set(
  GROUPS.filter((g) => g.fold6).map((g) => g.fold6.y)
)].sort((a, b) => a - b);
function fold6RowY(g, H) {
  return fold6RowIndexY(FOLD6_ROW_FRAME_YS.indexOf(g.fold6.y), H);
}
// Live row pitch. Desktop keeps the tuned 24px flat — its labels are nowrap
// one-liners well under that. On mobile .group-label wraps inside its 150px
// legend cap, so a mini-legend row can be two lines tall and 24px printed the
// rows on top of each other; widen to fit the tallest measured label.
// Same shape as fold3RowPitch in update-groups.js — see that comment.
const FOLD6_ROW_LABEL_GAP_PX = 6;
function fold6RowPitchPx() {
  return Math.max(
    FOLD6_ROW_PITCH,
    Math.max(...GROUPS.filter(g => g.fold6)
      .map(g => groupLabelHeight(g, groupLabelLegendFontSize(), groupLabelLegendMaxWidth())))
      + FOLD6_ROW_LABEL_GAP_PX
  );
}
function fold6RowIndexY(rowIndex, H) {
  const pitch = fold6RowPitchPx();
  // Mobile: both mini-legend columns sit at the TOP of the viewport rather
  // than on the vertically-centered desktop anchor. A phone's short viewport
  // has the title card and @fold6's sample squares occupying the middle band,
  // and a centered anchor printed the legend rows straight over them. Anchored
  // flat off the top edge, and with no re-centering — the rows are meant to
  // hang off the top, so a taller pitch should grow downward.
  if (isMobile()) return FOLD6_LEGEND_TOP_MOBILE + rowIndex * pitch;
  // Desktop: the 3-row block is centered on the viewport's vertical middle —
  // the ACLED note deliberately does NOT factor in (it hangs below the
  // right-hand column; see updateGroups). Each row y is the ROW ANCHOR (swatch
  // center), so centering the anchors centers the block.
  return H / 2 - (pitch * (FOLD6_ROW_FRAME_YS.length - 1)) / 2 + rowIndex * pitch;
}
const fold6NoteEl = document.createElement("div");
fold6NoteEl.className = "fold6-note";
fold6NoteEl.style.width = `${FOLD6_NOTE_WIDTH}px`;
// The note TYPES in at @fold6 (explicit instruction — it used to fade), using
// fold8's two-span typewriter so the wrapped 155px block keeps its final line
// breaks from the first frame instead of re-flowing as characters arrive. The
// one wrinkle is the live "ACLED" link in the middle of the string: a single
// revealed/hidden span pair would flatten it, so the text is split into three
// SEGMENTS (before / the <a> / after), each with its own span pair, and
// fold6UpdateNoteTypewriter walks one running character count across them.
const fold6NoteTitleEl = document.createElement("div");
fold6NoteTitleEl.className = "fold6-note-title";
const fold6NoteSegments = (() => {
  const [before, after] = FOLD6_NOTE_TEXT.split("ACLED");
  const mk = (tag, text, cls) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (tag === "a") {
      el.href = "https://acleddata.com/";
      el.target = "_blank";
      el.rel = "noopener";
    }
    fold6NoteEl.appendChild(el);
    return fold8SetupTypewriter(el, text);
  };
  // The title is the FIRST segment, so the whole block types as one continuous
  // stream — heading first, then the note under it — rather than two things
  // typing at once.
  return [
    fold8SetupTypewriter(fold6NoteTitleEl, FOLD6_NOTE_TITLE_TEXT),
    mk("span", before), mk("a", "ACLED", "fold6-note-link"), mk("span", after),
  ];
})();
const FOLD6_NOTE_CHAR_COUNT = FOLD6_NOTE_TITLE_TEXT.length + FOLD6_NOTE_TEXT.length;
// Two counts, not one: the title (segment 0) and the body (the rest) are fed
// separately, because the later un-type takes only the body — the title STAYS
// (explicit instruction). The initial reveal still reads as one stream: the
// caller derives both counts from the same running total.
function fold6UpdateNoteTypewriter(titleCount, bodyCount) {
  const [title, ...body] = fold6NoteSegments;
  fold8UpdateTypewriter(title, Math.max(0, Math.min(title.fullText.length, titleCount)));
  let left = bodyCount;
  for (const seg of body) {
    const n = Math.max(0, Math.min(seg.fullText.length, left));
    fold8UpdateTypewriter(seg, n);
    left -= n;
  }
}
const FOLD6_NOTE_TITLE_LEN = FOLD6_NOTE_TITLE_TEXT.length;
// The reveal is two beats on acledNoteTrigger's RAW progress (same
// {start,len} window shape as FOLD2_BEATS, p9Ease re-applied per window):
// the divider DRAWS — a line growing right→left, the reading direction — and
// the note types under it. Both START together (explicit instruction); the
// line just finishes sooner.
const FOLD6_NOTE_BEATS = {
  type: { start: 0, len: 1 },  // 0 → 1900ms (GROUP_TRANSITION_MS)
};
const fold6NoteLayerEl = document.getElementById("fold6NoteLayer");
// The CARD the note sits in. Deliberately a SIBLING drawn behind the title and
// the body, not a wrapper around them: the two are absolutely positioned and
// their left/top/width are written per frame by updateGroups, and on mobile
// they are re-parented one by one into the מקרא panel (fold6SyncNoteHome) where
// they flow instead. Reparenting them under a wrapper would have meant redoing
// both of those; as a sibling the card just tracks the block it frames, sized
// from the very numbers that already drive the vertical rule. Appended FIRST so
// it paints underneath (these are all position:absolute in one layer, so DOM
// order is paint order — no z-index needed).
const fold6NoteCardEl = document.createElement("div");
fold6NoteCardEl.className = "fold6-note-card";
fold6NoteLayerEl.appendChild(fold6NoteCardEl);
fold6NoteLayerEl.appendChild(fold6NoteEl);
fold6NoteLayerEl.appendChild(fold6NoteTitleEl);
// How much card there is around the text block, on each side. `let` rather
// than `const` only so a manual/ harness can turn it live — updateGroups reads
// it every frame, so an assignment shows up on the next repaint.
let FOLD6_CARD_PAD = 8;

// The card opens in two steps: HEIGHT first, then WIDTH. Both are windows into
// the BODY's typing progress (0..1), not seconds — the card belongs to the
// typewriter, so it opens at whatever speed the reader scrolls it at. See the
// comment at the sizing code in js/update-groups.js for why they end this early.
// The card opens BEFORE any body text exists: it takes this share of the body's
// beat for itself, and the text types over the remaining 1 - share. That's what
// buys the opening its duration — a body line is the full 155px, so text can't
// arrive while the width is still travelling.
const FOLD6_CARD_OPEN_SHARE = 0.3;
// Within that share: height first, then width. The width gets the longer half —
// the height step is a quick establishing beat (it opens one line's worth), the
// width is the one that's meant to read as an opening.
const FOLD6_CARD_OPEN = {
  h: { start: 0,    len: 0.3 },
  w: { start: 0.3,  len: 0.7 },
};
// ...except on the note's FIRST appearance at @fold6, where the order is
// reversed: width first, then height (explicit instruction). Nothing has been
// collapsed yet at that point — there is no earlier state for the card to be
// opening OUT of — so leading with the height would show the title-only pose
// as if it meant something, and the card would read as un-collapsing rather
// than arriving. The width there isn't sliced out of the body's beat at all:
// it runs on the TITLE's typing (see updateGroups), so the card widens as the
// title writes itself and only the height is left for the body's share — hence
// `w` below is unused on that path and `h` gets the whole window.
const FOLD6_CARD_INTRO = {
  w: { start: 0,    len: 1 },
  h: { start: 0,    len: 1 },
};

// The card also collapses HORIZONTALLY, down to what the title row needs, which
// means knowing how wide the title's TEXT actually is. It can't be read off
// fold6NoteTitleEl: that box is a fixed 155px, and mid-type it holds only some
// of the characters, so the card would breathe in and out one letter at a time.
// So: an off-screen twin carrying the full title, styled by the same class, and
// measured. Kept in the DOM (not created per call) and re-measured on demand so
// that editing the title's font live still lands.
const fold6NoteTitleMeasureEl = document.createElement("div");
fold6NoteTitleMeasureEl.className = "fold6-note-title";
fold6NoteTitleMeasureEl.setAttribute("aria-hidden", "true");
fold6NoteTitleMeasureEl.style.cssText =
  "position:absolute;left:-9999px;top:0;width:auto;white-space:nowrap;opacity:0;pointer-events:none";
fold6NoteTitleMeasureEl.textContent = FOLD6_NOTE_TITLE_TEXT;
fold6NoteLayerEl.appendChild(fold6NoteTitleMeasureEl);
// Hidden, permanently off-screen clone of the TOP row's *settled* label
// (fixed 14px/400, matching fold6's post-lerp end state) — measuring this
// instead of the live groupItems[FOLD6_TOP_ROW_INDEX].label lets the
// note/divider above compute their target position from where that row
// ENDS UP, not wherever it currently is mid-flight. Reading the live label's
// getBoundingClientRect() instead (an earlier version of this code did)
// made the note visibly trail the row in from its pre-glide position instead of
// staying put and just fading in.
const fold6RowMeasureEl = document.createElement("span");
fold6RowMeasureEl.className = "group-label";
fold6RowMeasureEl.style.cssText = "visibility:hidden; left:-9999px; top:-9999px; font-size:14px; font-weight:400;";
fold6RowMeasureEl.textContent = FOLD6_TOP_ROW.label;
groupsOverlayEl.appendChild(fold6RowMeasureEl);
const fold6NoteRuleEl = document.createElement("div");
fold6NoteRuleEl.className = "fold6-note-rule";
fold6NoteLayerEl.appendChild(fold6NoteRuleEl);
// Hovering the note block itself types the body back in, on the same trigger
// as the legend rows (explicit instruction) — the note is part of the legend,
// so it answers to a hover over either.
[fold6NoteEl, fold6NoteTitleEl, fold6NoteCardEl].forEach((el) => {
  el.addEventListener("mouseenter", () => {
    if (isMobile()) return;
    fold6LabelHoverTrigger.trigger(1);
    fold6NoteHoverTrigger.trigger(1);
  });
  el.addEventListener("mouseleave", () => {
    if (isMobile()) return;
    fold6LabelHoverTrigger.trigger(0);
    fold6NoteHoverTrigger.trigger(0);
  });
});

/* ---------------------------------------------------------------------------
   Mobile mini-legend: camp names + a מקרא disclosure
   ---------------------------------------------------------------------------
   On a phone the six-row, two-column mini-legend eats the whole top third of
   the viewport for the rest of the page. So under the breakpoint it collapses
   (per explicit instruction) to a persistent top bar carrying only the two CAMP
   names, with a מקרא button above them that drops the full legend — all six
   group rows plus the ACLED note — down underneath it on tap.

   This is a separate, static set of nodes, NOT the animated `groupItems`: those
   six keep flying through @fold2/@fold3 exactly as they do on desktop and then,
   on mobile, converge on this button and fade out there (see updateGroups), so
   the button visibly *receives* the legend at @fold4. Reusing the same nodes for
   both jobs would mean the panel's contents were mid-flight whenever the panel
   was closed.

   The bar lives in its own layer rather than in #fold6NoteLayer because it must
   be reachable by assistive tech and by taps — that layer is aria-hidden and
   pointer-events:none, both correct for a decorative credit line. */
const fold6MobileLegendLayerEl = document.getElementById("fold6MobileLegendLayer");
const fold6MobileLegendEl = document.createElement("div");
fold6MobileLegendEl.className = "fold6-mlegend";
const FOLD6_MOBILE_LEGEND_LABEL = "מקרא";
const fold6MobileLegendBtnEl = document.createElement("button");
fold6MobileLegendBtnEl.type = "button";
fold6MobileLegendBtnEl.className = "fold6-mlegend-btn";
fold6MobileLegendBtnEl.textContent = FOLD6_MOBILE_LEGEND_LABEL;
fold6MobileLegendBtnEl.setAttribute("aria-expanded", "false");
fold6MobileLegendEl.appendChild(fold6MobileLegendBtnEl);

// Nothing but the button shows on screen. The camp names are INSIDE the panel,
// heading their own column (per explicit instruction) — the real @fold2 headers
// (campHeaderCoalitionEl / ChangeEl) un-type at @fold4 on mobile exactly
// as they do on desktop, so these static copies can't double them.
//
// The panel. Two columns of rows, mirroring the desktop mini-legend's own
// split — coalition on the right, change on the left — each headed by its camp
// name and each row ordered by fold6.y like every other legend layout in this
// file, so the panel reads in the same order the rows typed in at @fold3.
const fold6MobilePanelEl = document.createElement("div");
fold6MobilePanelEl.className = "fold6-mlegend-panel";
fold6MobilePanelEl.hidden = true;
const fold6MobileRowsEl = document.createElement("div");
fold6MobileRowsEl.className = "fold6-mlegend-rows";
const fold6MobileRowEls = [];
const fold6MobileCampHeadEls = {};
[
  [FOLD4_COALITION_ROWS, CAMP_HEADER_TITLE_COALITION],
  [FOLD4_CHANGE_ROWS, CAMP_HEADER_TITLE_CHANGE],
].forEach(([camp, campTitle]) => {
  const col = document.createElement("div");
  col.className = "fold6-mlegend-col";
  const head = document.createElement("p");
  head.className = "fold6-mlegend-camp";
  head.textContent = campTitle;
  // Kept for the FLY hand-off: the on-canvas camp headers fly onto these.
  fold6MobileCampHeadEls[campTitle] = head;
  col.appendChild(head);
  camp.slice().sort((a, b) => a.fold6.y - b.fold6.y).forEach((g) => {
    const row = document.createElement("div");
    row.className = "fold6-mlegend-row";
    const swatch = document.createElement("span");
    swatch.className = "fold6-mlegend-swatch";
    swatch.style.background = g.color;
    const label = document.createElement("span");
    label.className = "fold6-mlegend-label";
    label.textContent = g.label;
    row.appendChild(swatch);
    row.appendChild(label);
    col.appendChild(row);
    // Kept for the @fold4 hand-off intro below, which pops and types every row
    // on one shared clock. The label is set up with the tooltip's own two-span
    // typewriter (fold8SetupTypewriter): the untyped tail stays in the DOM at
    // opacity 0, so the row is its FINAL width from the first frame. Slicing
    // textContent instead let each label grow as it typed, which widened the
    // column and shoved the dots sideways under their own text.
    // `g` and `label` are kept for the FLY hand-off below, which has to match
    // each on-canvas row to its own panel row and measure where that row sits.
    fold6MobileRowEls.push({ g, swatch, label, spans: fold8SetupTypewriter(label, g.label) });
  });
  fold6MobileRowsEl.appendChild(col);
});
fold6MobilePanelEl.appendChild(fold6MobileRowsEl);
fold6MobileLegendEl.appendChild(fold6MobilePanelEl);
fold6MobileLegendLayerEl.appendChild(fold6MobileLegendEl);

// The note and its divider are MOVED into the panel on mobile rather than
// duplicated — one set of nodes, one ACLED link, so the credit can't drift out
// of sync between the two viewports. Their desktop selves are absolutely
// positioned with inline left/top/width written every tick by updateGroups;
// inside the panel they flow, so the inline values have to be cleared on the
// way in (and are simply re-written on the way back out).
let fold6NoteHome = "layer";
function fold6SyncNoteHome() {
  const want = isMobile() ? "panel" : "layer";
  if (want === fold6NoteHome) return;
  fold6NoteHome = want;
  const parent = want === "panel" ? fold6MobilePanelEl : fold6NoteLayerEl;
  // The card is NOT in this list — it stays in the layer. Inside the panel the
  // note flows and the panel is its own frame already, so the card hides there
  // (.fold6-note-card.is-in-panel), exactly as the rule does.
  [fold6NoteRuleEl, fold6NoteTitleEl, fold6NoteEl].forEach((el) => {
    el.style.left = el.style.top = el.style.width = el.style.opacity = "";
    parent.appendChild(el);
  });
  fold6NoteEl.classList.toggle("is-in-panel", want === "panel");
  fold6NoteTitleEl.classList.toggle("is-in-panel", want === "panel");
  fold6NoteRuleEl.classList.toggle("is-in-panel", want === "panel");
  fold6NoteCardEl.classList.toggle("is-in-panel", want === "panel");
}
fold6SyncNoteHome();

// The bar never moves: it parks at FOLD6_MLEGEND_TOP_MOBILE_PX below the top of
// the viewport and only fades. Still written from updateGroups (rather than as a
// static CSS `top`) so the one constant above stays the single source of truth.
function fold6PlaceMobileLegend() {
  fold6MobileLegendEl.style.top = `${FOLD6_MLEGEND_TOP_MOBILE_PX}px`;
}

// vis is fold6Trigger's eased progress (0 off, 1 fully present). Below the
// breakpoint the bar simply never shows, and any panel left open on a resize up
// to desktop is closed — the legend is back on the canvas there.
// This runs from updateGroups, i.e. once per scroll frame, but `vis` is at 0 or
// 1 for all but the ~1.9s of fold6Trigger's own ramp. Writing the same inline
// opacity again on every one of those frames is not free: with the panel open
// the bar subtree is a full-width white card with a 20px-blur shadow, and each
// redundant style write dirties it for repaint on top of the canvas that is
// already repainting — which is what made scrolling stutter while the מקרא
// panel was down. Skip the no-op writes.
// The bar does NOT ride fold6Trigger's full ~1.9s ramp — fading a single small
// button over that long makes it feel like it never arrives. It runs its own
// front-loaded slice (FOLD6_MLEGEND_IN_SPAN of the trigger) and POPS in with
// @fold7's tooltip curve, so it lands early and with a gesture, while the
// on-canvas rows are still leaving behind it. The intro below still waits for
// the full trigger.
const FOLD6_MLEGEND_IN_SPAN = 0.3;
let fold6MobileLegendVis = null;
function fold6SetMobileLegendVisible(vis) {
  const barT = Math.max(0, Math.min(1, vis / FOLD6_MLEGEND_IN_SPAN));
  if (barT !== fold6MobileLegendVis) {
    fold6MobileLegendVis = barT;
    fold6MobileLegendEl.style.opacity = String(barT);
    fold6MobileLegendEl.style.pointerEvents = barT > 0.5 ? "auto" : "none";
    // The button, not the bar: the bar is also the panel's container, and
    // scaling it would scale an open panel along with it.
    fold6MobileLegendBtnEl.style.transform =
      barT >= 1 ? "" : `scale(${fold8TooltipGrowEase(barT)})`;
  }
  // Fired the INSTANT fold6Trigger starts, not when it finishes: the panel's
  // rows type in while the on-canvas rows are un-typing, which is the whole
  // point — one hand-off, seen at both ends at once. Waiting for the trigger to
  // complete made it read as two separate events with a 1.9s gap. One-shot;
  // going back above @fold4 re-arms it.
  if (vis > 0) {
    fold6PlayMLegendIntro();
    // Scrolling back UP through the fold after the demo closed: reopen the
    // frame so the reverse flight has a panel to fly out of. Only on a
    // decreasing vis — riding downward past a tap-dismissed demo must not
    // resurrect it.
    if (vis < fold6MFlyPrevVis && fold6MLegendIntroPlayed) fold6MFlyMaybeReopen();
  } else {
    if (fold6MLegendIntroActive && fold6MFlyEnabled() && !fold6MobilePanelEl.hidden) {
      // The reverse hand-off's last beat: the rows are back on the canvas,
      // the frame empties out the way it arrived (a fade, not the close's
      // shrink — mirror of fold6PlayMLegendFlyIntro).
      fold6FadeOutMLegendFlyIntro();
    } else if (fold6MLegendIntroPlayed) fold6StopMLegendIntro();
    fold6MLegendIntroPlayed = false;
  }
  fold6MFlyPrevVis = vis;
  if (vis <= 0 && !fold6MobilePanelEl.hidden && !fold6MFlyFadeOut)
    fold6SetMobileLegendOpen(false);
}

function fold6SetMobileLegendOpen(open) {
  fold6MobilePanelEl.hidden = !open;
  fold6MobileLegendBtnEl.setAttribute("aria-expanded", String(open));
  fold6MobileLegendEl.classList.toggle("is-open", open);
  // The LAYER (not the bar) carries the open flag too: it's the stacking
  // context, so only lifting it can put the open panel above the title block —
  // which it must be, since the panel is what the reader just asked to see.
  // Closed, it drops back under the card again.
  fold6MobileLegendLayerEl.classList.toggle("is-open", open);
}
/* The @fold4 hand-off intro.
   ---------------------------------------------------------------------------
   On mobile the six on-canvas rows leave by shrinking and un-typing in place,
   which says "gone" but not "gone THERE". So the instant fold6Trigger completes,
   the מקרא panel opens by itself and plays the same gesture in reverse inside
   itself — swatch pops in, label types in, row by row — then holds and closes.
   The reader sees the legend arrive somewhere before the panel goes back to
   being a button they have to know to press.

   One-shot per crossing: the flag clears when fold6Trigger's progress returns to
   0 (scrolled back above @fold4), so coming down again replays it. Any tap
   aborts it — a reader who reaches for the button mid-demo wants the panel, not
   the show. */
const FOLD6_MLEGEND_INTRO_GROW_MS = 350;  // panel scale 0 -> 1, from its top edge
const FOLD6_MLEGEND_INTRO_POP_MS  = 400;  // swatch scale 0 -> 1
// label 0 -> all characters. It is the fold's OWN tempo, so the panel's rows
// finish typing on the same frame the on-canvas rows finish un-typing — the two
// halves of the hand-off start together (vis > 0) and land together.
const FOLD6_MLEGEND_INTRO_TYPE_MS = GROUP_TRANSITION_MS;
const FOLD6_MLEGEND_INTRO_HOLD_MS = 300; // whole legend on screen before closing
const FOLD6_MLEGEND_INTRO_CLOSE_MS = 300; // and the shrink back up into the button
let fold6MLegendIntroRaf = 0;
let fold6MLegendIntroTimer = 0;
let fold6MLegendIntroPlayed = false;
// True for the whole demo (grow + hold + shrink). @fold6's own reveal
// (squaresRevealTrigger) can land in the middle of it on a fast scroll, and the
// ACLED note flowing into the panel mid-demo would grow the frame under the
// rows while they are still typing. updateGroups keeps the note + divider out
// of the panel's layout entirely while this is set, so the credit first turns
// up when the reader TAPS מקרא — which is also when it makes sense to read it.
let fold6MLegendIntroActive = false;

// Clearing the flag alone isn't enough: updateGroups (which writes the note's
// `hidden`) only runs on scroll frames, and the demo typically ends with the
// page standing still. So put the note back into the panel's layout here and
// now — subject to its own @fold6 ramp, which is the only other thing that
// gates it.
function fold6EndMLegendIntro() {
  fold6MLegendIntroActive = false;
  if (isMobile() && acledNoteTrigger.currentT() > 0) {
    fold6NoteRuleEl.hidden = fold6NoteEl.hidden = false;
  }
}

function fold6MLegendPaintRow(r, popT, typeT) {
  r.swatch.style.transform = `scale(${popT})`;
  fold8UpdateTypewriter(r.spans, Math.round(typeT * r.spans.fullText.length));
}

// The panel at rest: full size, full text, unscaled swatches. Also the abort
// target, so a panel opened by hand is never caught mid-animation. The panel's
// transform is cleared rather than set to scale(1) so the stylesheet's
// `translateZ(0)` (its compositor-layer promotion — see .fold6-mlegend-panel)
// takes over again.
function fold6MLegendRestRows() {
  fold6MobilePanelEl.style.transform = "";
  fold6MobilePanelEl.style.opacity = "";
  fold6MobileRowEls.forEach((r) => {
    r.swatch.style.transform = "";
    // The fly hand-off keeps the rows built but invisible until the flight
    // lands (fold6MFlySetRowsShown) — resting has to hand them back to CSS.
    r.swatch.style.opacity = r.label.style.opacity = "";
    fold8UpdateTypewriter(r.spans, r.spans.fullText.length);
  });
  // …and the camp headings the same, for the same reason.
  Object.keys(fold6MobileCampHeadEls).forEach((title) => {
    fold6MobileCampHeadEls[title].style.opacity = "";
  });
}

function fold6StopMLegendIntro() {
  if (fold6MLegendIntroRaf) cancelAnimationFrame(fold6MLegendIntroRaf);
  if (fold6MLegendIntroTimer) clearTimeout(fold6MLegendIntroTimer);
  fold6MLegendIntroRaf = fold6MLegendIntroTimer = 0;
  fold6MFlyFadeOut = false; // an aborted reverse fade must not wedge the flag
  // Cleared here too: an abort is usually a tap on מקרא, and that tap is
  // exactly the moment the note is allowed back.
  fold6EndMLegendIntro();
  fold6MLegendRestRows();
}

/* ── The @fold4 hand-off, FLY variant ────────────────────────────────────────
   Same hand-off, told as one move instead of two: rather than the on-canvas
   rows un-typing where @fold3 left them while the panel types its own copies
   in, the panel opens as an EMPTY frame and the six rows travel into it —
   each one flying from its @fold3 spot to the exact place it occupies in the
   panel, shrinking its swatch (13px → 6px), its type (18px → 14px) and
   unwrapping to the panel's one-line labels on the way. The panel's own rows
   only fade up over the last sliver of the flight, so the reader never sees
   two copies of the same row at once.

   Two things differ from the typed intro on purpose:
     - the frame FADES in, it does not scale in. The flight's targets are read
       off the panel's real layout with getBoundingClientRect, and a scaled
       frame reports scaled rects — the rows would aim at a moving target.
     - the hold-then-close is started by the ARRIVAL (fold6MFlyArrive, called
       from updateGroups), not by a rAF clock of its own: the flight rides
       fold6Trigger's e6, so it lands when the scroll animation lands.
   Toggle with window.FOLD4_FLY = false to get the typed hand-off back. */
let fold6MFlyTargets = null;
let fold6MFlyHeadTargets = null;
let fold6MFlyPanelRect = null;
let fold6MFlyTargetsViewport = "";
const FOLD6_MFLY_SWATCH_PX = 6;   // .fold6-mlegend-swatch
const FOLD6_MFLY_GAP_PX    = 6;   // .fold6-mlegend-row gap
const FOLD6_MFLY_FONT_PX   = 14;  // .fold6-mlegend-label
const FOLD6_MFLY_HEAD_PX   = 14;  // .fold6-mlegend-camp
// There is no wrap-cap lerp anymore. The visible unwrap is done by the
// stand-in: its label is laid out `nowrap` as one span per REST line, and each
// line below the first is translated from its wrapped rest position (flush
// right, i lines down) to its inline position, lerped by flyT — the line
// SLIDES into the sentence instead of re-breaking. A cap lerp can't do that:
// however the re-break is anchored, the moment the browser re-wraps, the words
// that change line hop there in one frame ("position never snaps" says no).
// See fold6MFlyRestLines/fold6MFlyPaintClone below.
// .group-label's mobile line-height (style.css). Used to place the label by its
// FIRST LINE during the flight — see the is-mfly-topanchor block in
// js/update-groups.js. Keep the two in sync; it's the one number here that is a
// copy of a stylesheet value rather than the source of one.
const FOLD6_MFLY_LINE_H    = 1.15;
const FOLD6_MFLY_FRAME_MS  = 350; // empty frame fades in

function fold6MFlyEnabled() {
  return isMobile() && window.FOLD4_FLY !== false;
}

// Where each row and each camp heading lands, in viewport coordinates —
// directly usable as a .group-item's / .camp-header's left/top, since
// .groups-overlay and .fold6-mlegend-layer are both `position: fixed; inset: 0`.
// Measured once per viewport size (a dozen getBoundingClientRect reads per
// scroll frame would be a dozen forced reflows on top of a canvas that already
// repaints every frame) and kept after the panel closes, since the landed rows
// stay parked on those coordinates.
function fold6MFlyMeasure() {
  const key = `${window.innerWidth}x${window.innerHeight}`;
  if (fold6MFlyTargets && fold6MFlyTargetsViewport === key) return true;
  if (fold6MobilePanelEl.hidden) return false;
  const m = new Map();
  fold6MobileRowEls.forEach((r) => {
    const s = r.swatch.getBoundingClientRect();
    const l = r.label.getBoundingClientRect();
    // lx/ly are the label's offset from the swatch's top-left — exactly the
    // frame .group-item positions its own label in. Lerping toward them lands
    // the text on the panel row's pixels instead of merely near them, which is
    // what lets the two swap without a cross-fade to hide the difference.
    // ly is the label's CENTER, not its top: .group-label is translateY(-50%),
    // so its `top` addresses the box's middle. Aiming its middle at the panel
    // label's TOP flew the text half a line too high and snapped down on the
    // swap — and made the tallest label (the 3-line one) crawl as it unwrapped.
    // lxRight is the label's RIGHT edge in the same frame. The flight anchors
    // the label on that edge instead of on `left` — see the is-mfly-topanchor
    // block in js/update-groups.js. `left` is derived from the box's measured
    // WIDTH, which jumps every time the opening wrap cap re-breaks the text.
    m.set(r.g, {
      x: s.left, y: s.top,
      lx: l.left - s.left, lxRight: l.right - s.left,
      ly: l.top + l.height / 2 - s.top,
    });
  });
  fold6MFlyHeadTargets = new Map();
  Object.keys(fold6MobileCampHeadEls).forEach((title) => {
    const h = fold6MobileCampHeadEls[title].getBoundingClientRect();
    // .camp-header is translate(-50%, -50%) — its left/top IS its
    // center, so the target is the heading's center too.
    fold6MFlyHeadTargets.set(title, { x: h.left + h.width / 2, y: h.top + h.height / 2 });
  });
  fold6MFlyPanelRect = fold6MobilePanelEl.getBoundingClientRect();
  fold6MFlyTargets = m;
  fold6MFlyTargetsViewport = key;
  return true;
}

function fold6MFlyTargetOf(g) {
  if (!fold6MFlyMeasure()) return null;
  return fold6MFlyTargets.get(g) || null;
}

function fold6MFlyHeadTargetOf(title) {
  if (!fold6MFlyMeasure()) return null;
  return fold6MFlyHeadTargets.get(title) || null;
}

// The hand-over is a SWAP, not a cross-fade: 0 for the whole flight, 1 the
// frame it lands. A fade between two copies of the same row reads as one thing
// dissolving and another appearing; since the travelling row lands on the panel
// row's exact pixels (see lx/ly above), showing one and hiding the other in the
// same frame is invisible — "secondary attribute can snap, position never does".
function fold6MFlyArriveT(e6) {
  return e6 >= 1 ? 1 : 0;
}

/* The flight can't be drawn by the .group-item / .camp-header elements
   themselves: they live in .groups-overlay, inside .graphic-col, which is
   `position: fixed; z-index: 0` and therefore a stacking context — every
   z-index in it is trapped below BOTH the title block (z-index 4 on mobile)
   and the open מקרא layer (1002). So the flight is drawn by stand-ins, and the
   ask ("the title block above the groups, the open legend above the title
   block, and the rows landing on top of the panel") is a z-index cycle: it can
   only be satisfied per element, by WHERE that element currently is. Hence two
   parking layers, and each stand-in is moved between them every frame:

     - UNDER (z-index 1, a direct .layout child): above the canvas, below the
       title block. Where a stand-in sits for most of its flight — it passes
       behind the card, as asked.
     - OVER (inside the open מקרא layer, after the panel): once the stand-in
       actually overlaps the panel's rect, i.e. only for the landing, where the
       ask is the other way round.

   The switch happens at the panel's own top edge, so it is never visible: a
   stand-in can only be occluded by the thing it is not overlapping yet.
   Coordinates need no translating between the two — every layer involved is
   `position: fixed; inset: 0`, so the viewport left/top updateGroups computes
   means the same thing in all of them. The real element stays in place, laid
   out and measured (updateGroups reads its label width) but hidden. */
const fold6MFlyLayerEl = document.createElement("div");
fold6MFlyLayerEl.className = "fold6-mfly-layer";
fold6MFlyLayerEl.setAttribute("aria-hidden", "true");
fold6MobileLegendLayerEl.appendChild(fold6MFlyLayerEl);
const fold6MFlyUnderLayerEl = document.createElement("div");
fold6MFlyUnderLayerEl.className = "fold6-mfly-layer fold6-mfly-layer-under";
fold6MFlyUnderLayerEl.setAttribute("aria-hidden", "true");
fold6MobileLegendLayerEl.parentNode.insertBefore(fold6MFlyUnderLayerEl, fold6MobileLegendLayerEl);
const fold6MFlyClones = new Map();

function fold6MFlyCloneFor(key, build) {
  let c = fold6MFlyClones.get(key);
  if (!c) {
    c = build();
    fold6MFlyUnderLayerEl.appendChild(c.el);
    fold6MFlyClones.set(key, c);
  }
  return c;
}

function fold6MFlyRowCloneFor(g) {
  return fold6MFlyCloneFor(g, () => {
    const el = document.createElement("div");
    el.className = "group-item";
    const swatch = document.createElement("span");
    swatch.className = "group-swatch";
    swatch.style.background = g.color;
    const label = document.createElement("span");
    label.className = "group-label";
    label.textContent = g.label;
    el.appendChild(swatch);
    el.appendChild(label);
    return { el, swatch, label };
  });
}

// The camp headers fly too, onto the panel's own camp headings. Their stand-in
// is a single element (no swatch), and .camp-header's own
// translate(-50%, -50%) has to be reproduced by hand: updateGroups sets it as an
// inline style on the real header, so it rides along in the copied cssText.
function fold6MFlyHeadCloneFor(title) {
  return fold6MFlyCloneFor(title, () => {
    const el = document.createElement("div");
    el.className = "camp-header";
    el.textContent = title;
    return { el };
  });
}

// Which parking layer this stand-in belongs in THIS frame — see the block
// comment above. Decided from the y updateGroups just computed, NOT from a
// getBoundingClientRect on the stand-in: that would be one forced reflow per
// row per scroll frame, which is exactly the kind of thing that makes the
// longest label crawl. FOLD6_MFLY_PARK_SLACK covers the ink that sits above
// the anchor point (a wrapped label is centered on its swatch), so the switch
// happens as the row starts to overlap the panel rather than after.
// The test is "is this element INSIDE the panel's box", both edges — not
// "below its top". The bar hangs from the top of the screen
// (FOLD6_MLEGEND_TOP_MOBILE_PX), so its panel's top edge is above almost the
// whole canvas: a one-sided test put every stand-in in the OVER layer for its
// entire flight, i.e. over the title block, which is the opposite of the ask.
// 30 originally — flipped rows to the OVER layer a visible beat before they
// touched the panel; tightened to the real one-line ink overhang.
const FOLD6_MFLY_PARK_SLACK = 6;
function fold6MFlyPark(el, y) {
  const r = fold6MFlyPanelRect;
  const inPanel = !!r && y + FOLD6_MFLY_PARK_SLACK >= r.top && y - FOLD6_MFLY_PARK_SLACK <= r.bottom;
  const want = inPanel ? fold6MFlyLayerEl : fold6MFlyUnderLayerEl;
  if (el.parentNode !== want) want.appendChild(el);
}

// Hand this element's frame to its stand-in. Called after updateGroups has
// written the frame onto the real one, so the two are never a frame apart.
// `landed` = the flight is over and the panel's own row/heading is showing: the
// stand-in goes away, and the real element stays hidden (it is sitting on the
// panel's pixels — unhiding it would double the row).
// Assigning cssText re-parses the whole declaration and invalidates the
// element even when the string is identical, so each of these is compared
// first — at rest (and on the many frames where only x/y moved) that is the
// difference between one style recalc and three.
// Hiding a stand-in writes `display: none` straight onto its style, which the
// memo above doesn't know about — so the memo is cleared with it, or the next
// paint would skip the (unchanged) cssText and leave the stand-in hidden.
function fold6MFlyHideCloneEl(c) {
  c.el.style.display = "none";
  c._el = c._swatch = c._label = null;
}

// How the resting label actually breaks into lines, read off the browser's own
// layout rather than re-implemented: the measure span is given the rest cap and
// font, and a Range per word reports which line box each word landed in. Words
// are the only break opportunities in these labels, so grouping words by line
// reproduces the wrap exactly — if the two ever disagreed, the stand-in's
// takeoff frame would differ from the real resting label by a word.
// `dx[i]` is how far line i's right edge sits LEFT of the box's right edge once
// the text is laid out on one line (= the nowrap width of everything before it,
// separating space included — measured as full-width minus suffix-width so no
// trailing-space collapse can skew it). Measured once per label at the rest
// font; the paint scales it by the frame's lerped font-size.
const fold6MFlyLineCache = new Map();
function fold6MFlyRestLines(g) {
  const fs = groupLabelColumnFontSize(), cap = groupLabelColumnMaxWidth();
  const key = `${g.label}@${fs}@${cap}`;
  let v = fold6MFlyLineCache.get(key);
  if (v) return v;
  const m = groupLabelMeasureEl;
  m.textContent = g.label;
  m.style.fontSize = `${fs}px`;
  if (cap != null) m.style.maxWidth = `${cap}px`;
  const node = m.firstChild;
  const range = document.createRange();
  const lines = [];
  let idx = 0, lineTop = null;
  for (const w of g.label.split(" ")) {
    range.setStart(node, idx);
    range.setEnd(node, idx + w.length);
    const top = range.getBoundingClientRect().top;
    if (lineTop == null || top - lineTop > fs * 0.5) { lines.push([w]); lineTop = top; }
    else lines[lines.length - 1].push(w);
    idx += w.length + 1;
  }
  const texts = lines.map(ws => ws.join(" "));
  m.style.maxWidth = "none";
  m.style.whiteSpace = "nowrap";
  // Fractional widths on purpose (offsetWidth rounds): a whole-px error here
  // seats the sliding line a pixel off the real rest layout on the swap frames.
  const nowrapW = t => { m.textContent = t; return m.getBoundingClientRect().width; };
  const fullW = nowrapW(g.label);
  const dx = texts.map((t, i) => i === 0 ? 0 : fullW - nowrapW(texts.slice(i).join(" ")));
  m.style.fontSize = "";
  m.style.maxWidth = "";
  m.style.whiteSpace = "";
  m.textContent = "";
  v = { texts, dx, fs };
  fold6MFlyLineCache.set(key, v);
  return v;
}

function fold6MFlyCopyStyle(dst, src, key, memo) {
  const s = src.style.cssText;
  if (memo[key] === s) return;
  memo[key] = s;
  dst.style.cssText = s;
}

function fold6MFlyPaintClone(g, item, landed, flyT, fontPx) {
  const c = fold6MFlyRowCloneFor(g);
  item.el.classList.add("is-mfly-hidden");
  if (landed) { fold6MFlyHideCloneEl(c); return; }
  fold6MFlyCopyStyle(c.el,     item.el,     "_el",     c);
  fold6MFlyCopyStyle(c.swatch, item.swatch, "_swatch", c);
  fold6MFlyCopyStyle(c.label,  item.label,  "_label",  c);
  // The continuous unwrap lives HERE, on the stand-in, because the stand-in is
  // what's on screen. Its label never wraps: it holds one span per REST line
  // (as the real resting label breaks them — fold6MFlyRestLines), laid out
  // nowrap, and each line after the first is translated from its wrapped rest
  // spot (right edge flush with the box, i line-heights down) to its inline
  // spot (dx[i] left of the box's right edge, first line), lerped by flyT. At
  // flyT≈0 that renders pixel-identically to the wrapped real label it
  // replaces; at flyT=1 the transforms are 0 and it IS the panel's one-liner —
  // and in between the second line visibly slides up into the sentence, which
  // is the whole point: a wrap-cap lerp re-breaks, and a re-break hops a word
  // to another line in one frame no matter how the box is anchored.
  // The offsets scale with the frame's lerped font-size (widths are linear in
  // it); the vertical stride is the same line-height the first-line anchor
  // uses. The nowrap/maxWidth overrides are re-asserted every frame because the
  // cssText copy above clobbers them whenever the real label's style changed.
  const L = fold6MFlyRestLines(g);
  if (c._lines !== L) {
    c._lines = L;
    c.label.textContent = "";
    c.lineSpans = L.texts.map((t, i) => {
      if (i) c.label.appendChild(document.createTextNode(" "));
      const s = document.createElement("span");
      s.textContent = t;
      if (i) s.style.display = "inline-block"; // transform needs a box; line 0 never moves
      c.label.appendChild(s);
      return s;
    });
  }
  c.label.style.whiteSpace = "nowrap";
  c.label.style.maxWidth = "none";
  const k = 1 - flyT, scale = fontPx / L.fs;
  for (let i = 1; i < c.lineSpans.length; i++) {
    c.lineSpans[i].style.transform =
      `translate(${L.dx[i] * scale * k}px, ${fontPx * FOLD6_MFLY_LINE_H * i * k}px)`;
  }
  // className, not just cssText. The stand-in is what is actually ON SCREEN
  // during the flight (the real row is visibility:hidden), so anything driven
  // by a CLASS rather than an inline style has to come across too — cssText
  // carries none of it. .is-mfly-topanchor is exactly that: it changes what the
  // `top`/`left` numbers being copied here MEAN (top edge / right edge instead
  // of centre / left edge), so a stand-in without it renders those same numbers
  // against the base rule's transform and lands a whole label-width to the
  // right, still anchored on the measurements the class exists to avoid.
  if (c.label.className !== item.label.className) c.label.className = item.label.className;
  c.el.style.display     = "";
  fold6MFlyPark(c.el, parseFloat(item.el.style.top) || 0);
}

function fold6MFlyPaintHeadClone(title, headEl, landed) {
  const c = fold6MFlyHeadCloneFor(title);
  headEl.classList.add("is-mfly-hidden");
  if (landed) { fold6MFlyHideCloneEl(c); return; }
  fold6MFlyCopyStyle(c.el, headEl, "_el", c);
  c.el.style.display = "";
  fold6MFlyPark(c.el, parseFloat(headEl.style.top) || 0);
}

function fold6MFlyHideHeadClone(title, headEl) {
  const c = fold6MFlyClones.get(title);
  if (c) fold6MFlyHideCloneEl(c);
  headEl.classList.remove("is-mfly-hidden");
}

function fold6MFlyHideClone(g, item) {
  const c = fold6MFlyClones.get(g);
  if (c) fold6MFlyHideCloneEl(c);
  item.el.classList.remove("is-mfly-hidden");
}

// The panel's OWN contents — rows and camp headings alike. The headings are in
// here for the same reason the rows are: whatever is already showing in the
// panel when the flight starts is the thing that is supposed to be arriving, so
// seeing it sitting there first gives the whole move away.
function fold6MFlySetRowsShown(t) {
  const o = String(Math.max(0, Math.min(1, t)));
  fold6MobileRowEls.forEach((r) => {
    r.swatch.style.opacity = o;
    r.label.style.opacity  = o;
  });
  Object.keys(fold6MobileCampHeadEls).forEach((title) => {
    fold6MobileCampHeadEls[title].style.opacity = o;
  });
}

// Called every frame from updateGroups with the flight's arrival progress.
// Owns the hold timer too — the flight's own end is the only moment that can
// start it, and that moment is scroll-driven.
function fold6MFlyArrive(t) {
  if (!fold6MLegendIntroActive) return;
  fold6MFlySetRowsShown(t);
  if (t >= 1 && !fold6MLegendIntroTimer) {
    fold6MLegendIntroTimer = setTimeout(() => {
      fold6MLegendIntroTimer = 0;
      fold6CloseMLegendIntro();
    }, FOLD6_MLEGEND_INTRO_HOLD_MS);
  } else if (t < 1 && fold6MLegendIntroTimer) {
    // Scrolling back up mid-hold: the rows have taken off again (arriveT
    // dropped to 0), so the pending close must not fire under the reverse
    // flight. Scrolling down again re-lands and re-arms it above.
    clearTimeout(fold6MLegendIntroTimer);
    fold6MLegendIntroTimer = 0;
  }
}

/* The hand-off played BACKWARDS — scroll back up and the legend visibly
   returns its rows to the canvas instead of the panel blinking off:
   - mid-flight or mid-hold, the trigger's own reversal already flies the rows
     back (every lerp rides e6Fly); the panel frame stays open under them and
     fold6FadeOutMLegendFlyIntro fades it out once the trigger is back at 0.
   - AFTER the close (panel already shrunk into the button), a reversing
     trigger reopens the frame first (fold6MFlyMaybeReopen) so the rows have a
     panel to fly out of — the intro's own fade-in, re-entered.
   Reopen fires only while vis is DECREASING: a tap-dismissed demo followed by
   more downward scroll must stay dismissed. */
let fold6MFlyFadeOut = false;
let fold6MFlyPrevVis = 0;

function fold6MFlyMaybeReopen() {
  if (!fold6MFlyEnabled() || fold6MLegendIntroActive) return;
  if (!fold6MobilePanelEl.hidden) return; // hand-opened panel: leave it be
  fold6MLegendIntroActive = true;
  fold6NoteRuleEl.hidden = fold6NoteEl.hidden = true;
  fold6PlayMLegendFlyIntro();
}

function fold6FadeOutMLegendFlyIntro() {
  if (fold6MFlyFadeOut) return;
  fold6MFlyFadeOut = true;
  if (fold6MLegendIntroRaf) cancelAnimationFrame(fold6MLegendIntroRaf);
  if (fold6MLegendIntroTimer) clearTimeout(fold6MLegendIntroTimer);
  fold6MLegendIntroRaf = fold6MLegendIntroTimer = 0;
  // Picked up from wherever the frame currently is — the reverse can start
  // while the fade-IN is still running on a fast flick back up.
  const from = parseFloat(fold6MobilePanelEl.style.opacity);
  const o0 = Number.isFinite(from) ? from : 1;
  const t0 = performance.now();
  const tick = () => {
    fold6MLegendIntroRaf = 0;
    if (!fold6MFlyFadeOut) return; // interrupted by a re-entering fade-in
    const t = Math.min(1, (performance.now() - t0) / FOLD6_MFLY_FRAME_MS);
    fold6MobilePanelEl.style.opacity = String(o0 * (1 - p9Ease(t)));
    if (t < 1) { fold6MLegendIntroRaf = requestAnimationFrame(tick); return; }
    fold6MFlyFadeOut = false;
    fold6SetMobileLegendOpen(false);
    fold6EndMLegendIntro();
    fold6MLegendRestRows();
  };
  tick();
}

function fold6PlayMLegendFlyIntro() {
  // A reverse fade-out may still be mid-flight (scrolled up, then straight
  // back down): its rAF is cancelled and its self-check flag cleared so the
  // fade-in below owns the panel's opacity alone.
  if (fold6MLegendIntroRaf) cancelAnimationFrame(fold6MLegendIntroRaf);
  fold6MLegendIntroRaf = 0;
  fold6MFlyFadeOut = false;
  // Full text, final swatches, zero opacity: the panel must be at its FINAL
  // layout from the first frame or the targets measured off it are wrong —
  // it's invisible, not unbuilt.
  fold6MobileRowEls.forEach((r) => fold8UpdateTypewriter(r.spans, r.spans.fullText.length));
  fold6MobileRowEls.forEach((r) => { r.swatch.style.transform = ""; });
  fold6MFlySetRowsShown(0);
  fold6MobilePanelEl.style.transform = "translateZ(0)"; // no scale — see above
  fold6MobilePanelEl.style.opacity = "0";
  fold6SetMobileLegendOpen(true);
  fold6MFlyTargets = null; // this panel has just been laid out — measure it fresh
  const t0 = performance.now();
  const tick = () => {
    fold6MLegendIntroRaf = 0;
    const t = Math.min(1, (performance.now() - t0) / FOLD6_MFLY_FRAME_MS);
    fold6MobilePanelEl.style.opacity = String(p9Ease(t));
    if (t < 1) fold6MLegendIntroRaf = requestAnimationFrame(tick);
  };
  tick();
}

function fold6PlayMLegendIntro() {
  if (!isMobile() || fold6MLegendIntroPlayed) return;
  fold6MLegendIntroPlayed = true;
  fold6MLegendIntroActive = true;
  if (fold6MFlyEnabled()) {
    fold6NoteRuleEl.hidden = fold6NoteEl.hidden = true;
    fold6PlayMLegendFlyIntro();
    return;
  }
  // Pulled out of the panel's layout right here for the same reason
  // fold6EndMLegendIntro puts it back by hand: replaying the demo after @fold6
  // has already revealed the note (scrolled back up and down again) would
  // otherwise leave it in the frame until the next updateGroups frame.
  fold6NoteRuleEl.hidden = fold6NoteEl.hidden = true;
  // Zeroed BEFORE the panel is unhidden, so it never shows a full-size frame
  // for the one frame between opening and the first tick.
  fold6MobilePanelEl.style.transform = "translateZ(0) scale(0)";
  fold6MobilePanelEl.style.opacity = "0";
  fold6MobileRowEls.forEach((r) => fold6MLegendPaintRow(r, 0, 0));
  fold6SetMobileLegendOpen(true);
  const t0 = performance.now();
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const tick = () => {
    fold6MLegendIntroRaf = 0;
    const el = performance.now() - t0;
    // The frame grows from its TOP edge with @fold7's own tooltip curve
    // (fold8TooltipGrowEase, the subtle back-out pop) — same gesture, so the
    // panel dropping open reads as the same kind of object as the tooltip the
    // reader met one fold earlier. transform-origin is set in CSS; translateZ(0)
    // is repeated here because an inline transform replaces the stylesheet's.
    const growT = fold8TooltipGrowEase(clamp(el / FOLD6_MLEGEND_INTRO_GROW_MS));
    fold6MobilePanelEl.style.transform = `translateZ(0) scale(${growT})`;
    fold6MobilePanelEl.style.opacity = String(Math.min(1, growT));
    // Everything runs on the SAME clock (per explicit instruction) — no per-row
    // stagger and no wait for the frame: the panel opens, the dots pop and the
    // labels type all at once, which is what makes it read as the legend
    // arriving in one move rather than being rebuilt row by row.
    let done = el >= FOLD6_MLEGEND_INTRO_GROW_MS;
    fold6MobileRowEls.forEach((r) => {
      const popT  = p9Ease(clamp(el / FOLD6_MLEGEND_INTRO_POP_MS));
      const typeT = p9Ease(clamp(el / FOLD6_MLEGEND_INTRO_TYPE_MS));
      if (popT < 1 || typeT < 1) done = false;
      fold6MLegendPaintRow(r, popT, typeT);
    });
    if (!done) { fold6MLegendIntroRaf = requestAnimationFrame(tick); return; }
    fold6MLegendRestRows();
    fold6MLegendIntroTimer = setTimeout(() => {
      fold6MLegendIntroTimer = 0;
      fold6CloseMLegendIntro();
    }, FOLD6_MLEGEND_INTRO_HOLD_MS);
  };
  tick();
}

// Leaves the way it arrived: the frame shrinks back UP into the button (same
// top-edge origin) instead of the panel blinking out of existence, so the demo
// visibly returns the legend to the control that now holds it. Plain p9Ease —
// the back-out pop belongs to things appearing, and overshooting on the way out
// would push the frame briefly BIGGER as it leaves.
function fold6CloseMLegendIntro() {
  // Drop the pressed chip NOW, not when the panel finishes hiding: the button
  // un-fills over the same 300ms as the shrink (the base .fold6-mlegend-btn
  // rule carries that transition; the .is-open rule has none, so opening still
  // flips instantly), so the black->white and the frame leaving are one move.
  fold6MobileLegendEl.classList.remove("is-open");
  const t0 = performance.now();
  const tick = () => {
    fold6MLegendIntroRaf = 0;
    const t = Math.min(1, (performance.now() - t0) / FOLD6_MLEGEND_INTRO_CLOSE_MS);
    const g = 1 - p9Ease(t);
    fold6MobilePanelEl.style.transform = `translateZ(0) scale(${g})`;
    fold6MobilePanelEl.style.opacity = String(g);
    if (t < 1) { fold6MLegendIntroRaf = requestAnimationFrame(tick); return; }
    fold6SetMobileLegendOpen(false);
    // Only after it's hidden: a hand-opened panel must come back at full size,
    // and the ACLED note is allowed back into the panel's layout (its own
    // @fold6 ramp still decides whether it's actually visible).
    fold6EndMLegendIntro();
    fold6MLegendRestRows();
  };
  tick();
}

fold6MobileLegendBtnEl.addEventListener("click", (e) => {
  e.stopPropagation();
  fold6StopMLegendIntro();
  fold6SetMobileLegendOpen(fold6MobilePanelEl.hidden);
});
// Tap anywhere else — including on the page behind the bar, which is why this
// listens on the document rather than on a backdrop element (there is none; the
// artwork stays visible and interactive while the panel is open).
document.addEventListener("click", (e) => {
  if (!fold6MobilePanelEl.hidden && !fold6MobileLegendEl.contains(e.target)) {
    fold6StopMLegendIntro();
    fold6SetMobileLegendOpen(false);
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !fold6MobilePanelEl.hidden) {
    fold6StopMLegendIntro();
    fold6SetMobileLegendOpen(false);
  }
});

// Every group's position is one continuous chain of lerps — hero anchor →
// fold4 column → fold6 mini-legend — driven by each stage's own t. Once a
// given t reaches 1 the position is exactly that stage's target (no residual
// blend), so this is equivalent to a discrete per-fold layout at rest, but
// never snaps between two different DOM nodes to get there.
