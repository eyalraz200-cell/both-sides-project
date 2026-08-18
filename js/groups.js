// ── Folds 2 through 4 (ids #page-1..#page-3) all show the same 6 camp
// groups — flying from @fold1's hero dot columns straight into the two-camp
// column layout (@fold2), gaining labels (@fold3), splitting into 3 (@fold4),
// then merging back + settling into the left mini-legend (@fold5). Rather
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
// written spec (not a Figma frame): coalition trio (מפגינים חרדים/תנועות
// התנחלות/קבוצות ימין לאומיות) at x=887 (screen-right), change trio (תנועות
// שלום ודו קיום/ארגוני מחאה נגד הממשלה/מפגינים ערבים ישראלים) at x=725
// (screen-left), both starting
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
    fold4: { x: 725,  y: 514, swatchFirst: true }, fold6: { x: 31, y: 536 } },
  { color: "#F9B624", label: "תנועות התנחלות באיו״ש",           actor: "settlers",
    fold4: { x: 887,  y: 488, swatchFirst: true }, fold6: { x: 31, y: 512 } },
  { color: "#F024FF", label: "קבוצות ימין לאומיות",      actor: "right wing protesters",
    fold4: { x: 887,  y: 514, swatchFirst: true }, fold6: { x: 31, y: 536 } },
  { color: "#6B89FF", label: "ארגוני מחאה נגד הממשלה", actor: "protesters against government",
    fold4: { x: 725,  y: 488, swatchFirst: true }, fold6: { x: 31, y: 512 } },
  { color: "#FF1A94", label: "ארגוני שלום ודו קיום",     actor: "peace movements",
    fold4: { x: 725,  y: 462, swatchFirst: true }, fold6: { x: 31, y: 560 } },
  { color: "#454545", label: "מפגינים חרדים",           actor: "haredi jews",
    fold4: { x: 887,  y: 462, swatchFirst: true }, fold6: { x: 31, y: 560 } },
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
// @fold3, where the column reads with its labels), rows at y=462/488/514
// (those rows live in GROUPS' own fold4.y, so they can't drift out of sync).
// Pitches are plain px (not frame-scaled) for the same reason
// FOLD2_CAMP_CENTER_GAP_PX below is — a grid must stay square at any viewport.
const FOLD2_GRID_COLS = 4;
const FOLD2_COL_PITCH_PX = 31, FOLD2_ROW_PITCH_PX = 32;
// Each camp block's center, as a fixed px distance either side of screen
// center (Figma: block centers at x=590 and x=913 about the frame's own 756).
// Symmetric on purpose — Figma's own two blocks are within ~5px of symmetric,
// and at @fold2 neither block carries a label to unbalance it.
const FOLD2_CAMP_CENTER_GAP_PX = 160;

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
  { row: 2, col: 0 },  // #6B89FF  ארגוני מחאה נגד הממשלה  (change)
  { row: 0, col: 0 },  // #FF1A94  תנועות שלום ודו קיום    (change)
  { row: 1, col: 1 },  // #454545  מפגינים חרדים           (coalition)
];
// Flat cell roster, parallel to fold2FillerDots: cell k sits in `camp`'s
// block at grid row/col (0 = top / leftmost) — every cell of both 4×3 blocks
// except the 6 FOLD2_GROUP_CELL gives the real .group-items.
const FOLD2_FILLER_CELLS = [true, false].flatMap((camp) =>
  Array.from({ length: FOLD2_GRID_COLS * 3 }, (_, k) => ({
    camp, row: Math.floor(k / FOLD2_GRID_COLS), col: k % FOLD2_GRID_COLS,
  })).filter(({ row, col }) => !GROUPS.some((g, i) =>
    FOLD4_COALITION_ROWS.includes(g) === camp &&
    FOLD2_GROUP_CELL[i].row === row && FOLD2_GROUP_CELL[i].col === col))
);
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
  const need = FOLD2_FILLER_CELLS.length;
  fold2FillerDots = [];
  pool.forEach((d) => { d.isFold2Filler = false; });
  if (!pool.length) return;
  const step = pool.length / need;
  const used = new Set();
  const cellColor = (cell) => {
    const hit = FOLD2_FILLER_COLORS.find(
      (o) => o.camp === cell.camp && o.row === cell.row && o.col === cell.col);
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
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => { groupLabelWidths = {}; groupLabelInkShifts = {}; updateGroups(); });
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
groupsOverlayEl.classList.add("is-active");

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
// opacity:0); harmless if never revealed.
const FOLD6_SQUARE_LABELS = [
  "הפגנה לא אלימה",
  "החזקה בכפייה",
  "הפרות סדר",
  "פוגרום", // was הטרדה ואיומים, retired from P9_CATEGORIES on the v3 dataset
  "תקיפה פיזית",
  "ניכוס שטח",
  "פגיעה ברכוש",
  "חסימת כביש",
];
// Not shown in Figma node 258:2206 either (all 8 squares render flat
// #2d2d2d there — see lerpFold6SquareColor's own null-target case, same
// value) — these actor assignments only matter once fold 9 recolors/flies
// the squares out to their real per-event dots, a later beat this specific
// Figma frame doesn't depict. Reads GROUPS' own `color` (by `actor`, the
// same join key p7ActorColor in page7.js uses) rather than a second
// hardcoded hex list, so a future color edit on GROUPS updates these
// squares too.
function groupColorByActor(actor) {
  return GROUPS.find(g => g.actor === actor).color;
}
// Kept for the next @fold9 trigger to reuse: each square's actor is chosen to
// match its own column's political side — left column (even indices, dx
// -16.5) gets left-camp actors, right column (odd indices, dx +8.5, see
// FOLD6_SQUARES_OFFSET) gets right-camp actors. Only 2 left-camp actors exist
// vs 3 right-camp ones, so left alternates P/L twice each and right cycles
// S/R/H/H (uneven, but there's no 4th right-camp actor to reach for — order
// swapped from the original H/R/S/H per explicit instruction, so the
// top-right square is now S/מתיישבים and the 3rd-from-top-right is
// H/חרדים). Index 0 is unchanged ("protesters against government")
// since @fold8's tooltip (below) targets that specific square/event, and
// it's already a left-camp actor in the left column.
// S=מתיישבים L=פעילי שמאל H=חרדים P=מתנגדי הרפורמה R=פעילי ימין
const FOLD6_SQUARE_ACTORS = [
  "protesters against government",       // 0 (L col) - P - blue
  "settlers",                            // 1 (R col) - S - orange  (top-right; swapped with 5 per explicit instruction)
  "peace movements",                     // 2 (L col) - L - pink
  "right wing protesters",               // 3 (R col) - R - red
  "protesters against government",       // 4 (L col) - P - blue
  "haredi jews",                         // 5 (R col) - H - grey  (3rd from top-right; swapped with 1 per explicit instruction)
  "peace movements",                     // 6 (L col) - L - pink
  "haredi jews",                         // 7 (R col) - H - grey
];
const FOLD6_SQUARE_COLORS = FOLD6_SQUARE_ACTORS.map(groupColorByActor);
// Which occurrence (0 = first chronologically, 1 = second, ...) of its own
// actor each square stands in for, among left-side events sorted by date
// (p7.leftEvents' own order — see p7NthIndexOfActor/p7EventForActorOccurrence,
// page7.js) — auto-derived from FOLD6_SQUARE_ACTORS' own position (count of
// the same actor appearing earlier in the list), same as the original
// 10-square design, except index 0 — see FOLD6_TOOLTIP_ROW_ID below.
const FOLD6_SQUARE_OCCURRENCE = FOLD6_SQUARE_ACTORS.map((actor, i) =>
  FOLD6_SQUARE_ACTORS.slice(0, i).filter(a => a === actor).length
);

// Square 0 is the tooltip square, so it must point at ONE chosen real event
// rather than "whichever event happens to be first". It names that event by the
// xlsx's own stable row_id (passed through by server.py) — "row-145", the
// 2023-02-04 "מחאה מחוץ לביתו של שר המשפטים יריב לוין במודיעין" הפגנה לא אלימה.
// The occurrence number the lookups actually need is derived from the loaded
// data at first use (p7OccurrenceOfRowId, page7.js) and cached, so adding or
// removing earlier events in the xlsx can no longer silently slide the tooltip
// onto a neighbouring event. Resolved lazily because events.json loads after
// this file parses.
const FOLD6_TOOLTIP_ROW_ID = "row-145";
let fold6TooltipOccurrence = null;
let fold6TooltipWarned = false;
function fold6SquareOccurrence(i) {
  if (i !== 0) return FOLD6_SQUARE_OCCURRENCE[i];
  if (fold6TooltipOccurrence === null) {
    const n = p7OccurrenceOfRowId(FOLD6_TOOLTIP_ROW_ID);
    if (n === -1) {
      // Data not loaded yet (retry next frame), or the row is gone from the
      // dataset — in which case fall back to the plain derived occurrence so
      // the square still has *an* event, and say so once.
      if (p7.ready && !fold6TooltipWarned) {
        fold6TooltipWarned = true;
        console.warn(`fold6 tooltip: row_id ${FOLD6_TOOLTIP_ROW_ID} not in events.json — pick a new one`);
      }
      return FOLD6_SQUARE_OCCURRENCE[0];
    }
    fold6TooltipOccurrence = n;
  }
  return fold6TooltipOccurrence;
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
// #767676. Also the tooltip border's own gray-state color (see its
// borderColor assignment below), so both share one constant.
const FOLD6_SQUARE_REST_COLOR = [0x76, 0x76, 0x76];
function lerpFold6SquareColor(targetHex, t) {
  const [r0, g0, b0] = FOLD6_SQUARE_REST_COLOR;
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
const page7TitleCardEl  = document.querySelector("#page-6 .text-card");
// Fold 6's own card (#page-5, "כל ריבוע מייצג..." — the timeline-intro title,
// not to be confused with page7TitleCardEl above, which is fold 8's #page-7
// card) drives the fold-6 squares' labels fading IN — previously this had no
// card of its own and just snapped on the instant fold6Trigger settled,
// which (now that that's a fixed ~1s tween instead of a scroll-coupled one)
// finishes long before the user actually reaches fold 7.
const fold7LabelCardEl  = document.querySelector("#page-5 .text-card");
// Phase-2 fold: the ACLED "אספנו תיעודים…" fold, now #page-4 after the mini-legend
// split fold at #page-3. This card drives the grey squares growing in at centre
// AND the ACLED bottom-legend note fading in — both were previously coupled to
// fold6Trigger (the split) and are now detached onto their own trigger so the
// split and the squares+note land on two separate folds.
const squaresRevealCardEl = document.querySelector("#page-4 .text-card");
// Hoisted above checkFold13 (below), which needs it already resolved at
// definition time — also reused by p13SyncGateVisibility further down.
const page12StickyEl    = document.querySelector("#page-10 .page12-sticky-center");

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
const fold6Trigger      = makeTrigger(GROUP_TRANSITION_MS, (...a) => updateGroups(...a));
// Phase 2 (grey squares grow-in + ACLED bottom-legend note fade-in), split off
// from fold6Trigger onto the inserted ACLED fold (#page-4). See
// squaresRevealCardEl above.
const squaresRevealTrigger = makeTrigger(GROUP_TRANSITION_MS, (...a) => updateGroups(...a));
const fold7LabelTrigger = makeTrigger(GROUP_TRANSITION_MS, (...a) => updateGroups(...a));
// Matches FOLD8_GROW_MS (the tooltip's own wall-clock grow-to-full-scale
// time, see its comment above) — not the typewriter that follows it — so the
// non-tooltip squares' dim-to-color fade finishes exactly as the tooltip
// reaches max scale, instead of tracking the shared GROUP_TRANSITION_MS tempo.
const FOLD8_SQUARE_DIM_MS = FOLD8_GROW_MS;
const fold8SquareDimTrigger = makeTrigger(FOLD8_SQUARE_DIM_MS, (...a) => updateGroups(...a));
// @fold9 trigger #1 — its title card's ordinary midpoint crossing. Colors in
// only the highlighted square (index 0) and its tooltip's border; the other
// 7 squares are untouched by this trigger.
const FOLD9_COLOR_MS = 500;
const fold9Trigger = makeTrigger(FOLD9_COLOR_MS, (...a) => updateGroups(...a));
// @fold9 trigger #2 — the same crossing that makes the year axis appear
// (its title card passing fully offscreen, top <= 0 — see p7AxisShouldShow/
// p7HasEngaged, page7.js). Colors in all 8 fold-6 squares (in their own
// actor's group color) and flies each one to the real per-event dot it's
// standing in for (FOLD6_SQUARE_ACTORS/FOLD6_SQUARE_OCCURRENCE below,
// p7TargetForActorOccurrence, page7.js) — permanently; the real per-event
// cascade never draws its own dot for these 8 events at all
// (p7GetClaimedEvents, page7.js), so this DOM square just stays visible once
// it arrives, no handoff to a separate real dot.
// This fly is INDEPENDENT of p7HasEngaged (page7.js, gates the real per-event
// cascade + the axis fill): both fire off the same crossing and simply play at
// the same time — the axis/cascade never waits for the squares to land. Since
// a fast scroll can carry currentPage on to the pinned real-timeline section
// (#page-7) before this 1500ms fly has finished, draw() below is called
// unconditionally (not just while currentPage === 6) so whichever page is now
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
    const nowPast = cardEl.getBoundingClientRect().top <= window.innerHeight * frac;
    if (isPast === null) { isPast = nowPast; trigger.set(nowPast ? 1 : 0); return; }
    if (nowPast !== isPast) {
      isPast = nowPast;
      if (!nowPast && instantReverse) trigger.set(0);
      else trigger.trigger(nowPast ? 1 : 0);
    }
  };
}

// Fold 2's legend (the groups overlay's first appearance) is tied to the title
// card directly — same 0.5 convention and makeTrigger/watchCardThreshold
// machinery as every other fold — so the legend's appearance stays in sync
// with its own title and gives it a t (below) to stagger the rows' entrance.
const checkFold2      = watchCardThreshold(page2TitleCardEl, 0.5, fold2Trigger);
const checkFold3      = watchCardThreshold(page3TitleCardEl, 0.5, fold3Trigger);
const checkFold6      = watchCardThreshold(page6TitleCardEl, 0.5, fold6Trigger);
const checkSquaresReveal = watchCardThreshold(squaresRevealCardEl, 0.5, squaresRevealTrigger);
const checkFold7Label = watchCardThreshold(fold7LabelCardEl, 0.5, fold7LabelTrigger);
const checkFold8SquareDim = watchCardThreshold(fold7LabelCardEl, 0.5, fold8SquareDimTrigger);
const checkFold9 = watchCardThreshold(page7TitleCardEl, 0.5, fold9Trigger);
// Same crossing as p7AxisShouldShow (page7.js) — title card fully offscreen,
// top <= 0. Used to instant-reverse (snap straight back to rest on scroll-up
// rather than being catchable mid-flight) — per explicit instruction, this is
// now a normal reversible trigger like every other fold's, so scrolling back
// up from @fold8 into @fold7 plays the same fly-out/color-in animation in
// reverse, covering only the remaining distance, instead of snapping.
const checkFold9Fly = watchCardThreshold(page7TitleCardEl, 0, fold9FlyTrigger);
// Unlike every other fold trigger above, watches the *sticky wrapper*
// (.page12-sticky-center) at frac 0 (top <= 0) rather than the title card at
// its ordinary 0.5 — this fires exactly when the wrapper finishes sliding up
// and pins in place (title block stops moving, having reached its maximum
// point), not while it's still in transit and not late after it's already
// been sitting there a while. The gate physically can't be crossed while
// locked (scrollY is capped well short of this point until a pill's been
// dropped — see p13GateMax/p13GateLocked below), so no extra lock check is
// needed here.
const checkFold13 = watchCardThreshold(page12StickyEl, 0, fold13Trigger);

function checkGroupTriggers() {
  checkFold2(); checkFold3(); checkFold6(); checkSquaresReveal(); checkFold7Label(); checkFold8SquareDim(); checkFold9(); checkFold9Fly(); checkFold13();
}

// Default (camp-column) swatch size + the swatch-to-label gap
// established earlier — vs. the smaller mini-legend ones (Figma node
// 120:1279/Frame 3219), interpolated continuously by fold6Trigger rather
// than snapped, same "seamless, no popping" rule as every other transition.
const CLUSTER_SWATCH_SIZE = 11, CLUSTER_LABEL_GAP = 12;
const LEFT_LEGEND_SWATCH_SIZE = 6, LEFT_LEGEND_LABEL_GAP = 6;
// Mini-legend geometry: each column's inset from ITS OWN screen edge, in px
// (not frame units — tuned by eye at one viewport, see CLAUDE.md's manual/
// rule), plus the row-to-row pitch. GROUPS' per-group fold6.y is now only
// read for row ORDER (via FOLD6_ROW_FRAME_YS below); the actual spacing all
// comes from FOLD6_ROW_PITCH, so the three rows can never drift apart.
const FOLD6_LEGEND_INSET_LEFT = 31, FOLD6_LEGEND_INSET_RIGHT = 31;
const FOLD6_ROW_PITCH = 24;

// @fold2's two camp-column headers + the divider between them (Figma node
// 277:1608, frame 1512×982: swatch columns at x=719/782 either side of the
// x=756 divider, rows at y=489/529/566, headers at y=414). Rows are read
// live off GROUPS' own fold4.x/y (by color) rather than re-declared here, so
// the header/divider position can never drift out of sync with the table
// above if it's ever tweaked.
// (FOLD4_COALITION_ROWS/FOLD4_CHANGE_ROWS themselves are declared up by
// GROUPS — @fold2's own grid roster needs them before this point.)
const FOLD4_HEADER_TITLE_COALITION = "מחנה הימין";
const FOLD4_HEADER_TITLE_CHANGE    = "גוש השינוי";
// Frame units from each column's own top-row center up to its header's
// center. Started at Figma's own 73 (row center 494.5, header center 421);
// tuned down to 44 by eye per explicit instruction, so this no longer
// matches the Figma frame — don't "fix" it back.
const FOLD4_HEADER_GAP = 44;
// Both camp blocks are placed symmetrically about screen center from
// FOLD2_CAMP_CENTER_GAP_PX (see the @fold2 grid block above) — there's no
// longer a center divider to hang either column off (Figma node 279:1342
// shows none), so the old FOLD4_DIVIDER_GAP_PX/FOLD4_COALITION_COL_GAP_PX
// pair (and .fold4-divider itself) are gone. Both blocs still read RTL the
// same way, so each group's own rect is its row's RIGHTMOST grid cell and
// @fold3's typed-in label trails left off it, over the space the row's 3
// filler rects vacate as they shrink.

const fold4ColumnTitleCoalitionEl = document.createElement("div");
fold4ColumnTitleCoalitionEl.className = "fold4-column-title";
fold4ColumnTitleCoalitionEl.textContent = FOLD4_HEADER_TITLE_COALITION;
groupsOverlayEl.appendChild(fold4ColumnTitleCoalitionEl);

const fold4ColumnTitleChangeEl = document.createElement("div");
fold4ColumnTitleChangeEl.className = "fold4-column-title";
fold4ColumnTitleChangeEl.textContent = FOLD4_HEADER_TITLE_CHANGE;
groupsOverlayEl.appendChild(fold4ColumnTitleChangeEl);

// Both camp headers TYPE in on @fold2's 3rd beat rather than just fading (same
// spec as @fold3's labels). They reuse fold8's two-span typewriter, not the
// plain typedText() the labels use, because these are CENTERED on their block:
// with plain text the box would grow outward from its own center and the whole
// header would visibly slide left as it typed. The two-span version lays the
// full string out from the first frame and only moves characters between the
// visible and the transparent span, so the header sits still.
const fold4HeaderSpansCoalition = fold8SetupTypewriter(
  fold4ColumnTitleCoalitionEl, FOLD4_HEADER_TITLE_COALITION);
const fold4HeaderSpansChange = fold8SetupTypewriter(
  fold4ColumnTitleChangeEl, FOLD4_HEADER_TITLE_CHANGE);

// Both headers are centered over their own camp block (Figma node 279:1342
// centers each title on its grid), so they override .fold4-column-title's
// default right-edge translate(-100%, -50%) anchor.
fold4ColumnTitleCoalitionEl.style.transform = "translate(-50%, -50%)";
fold4ColumnTitleChangeEl.style.transform = "translate(-50%, -50%)";

// @fold3's labels don't fade in — they TYPE in, character by character, over
// fold3Trigger's own eased progress (per explicit spec). Reverses cleanly
// (characters unwind) because labelT reverses like every other trigger.
function typedText(full, t) {
  return full.slice(0, Math.round(Math.max(0, Math.min(1, t)) * full.length));
}

// Source-credit line under fold6's mini-legend (no Figma node — new content,
// not part of the original design). Fixed px width/font, same "position
// anchors are frame-scaled, sizing isn't" convention as .group-label's own
// hardcoded font sizes above. FOLD6_BOTTOM_ROW is the mini-legend's
// bottom-most row (highest fold6.y — now ערבים ישראלים, since it joined the
// change bloc below פעילי שמאל) — the note hangs off it.
const FOLD6_NOTE_TEXT = "הנתונים לקוחים מגוף המחקר הבינלאומי ACLED, המתעד וממפה אירועי מחאה ואלימות פוליטית על בסיס דיווחים מכלי תקשורת ומקורות מקומיים.";
const FOLD6_NOTE_WIDTH = 155;
// Divider (faint hairline) sits between the last row and the note, its own
// height folded into the gap math below like the note's own height is.
const FOLD6_DIVIDER_GAP_TOP = 10, FOLD6_DIVIDER_GAP_BOTTOM = 10, FOLD6_DIVIDER_HEIGHT = 1;
// Highest fold6.y among the mini-legend rows — computed rather than hardcoded
// so adding a row below the change bloc (ערבים ישראלים) re-anchors the note.
const FOLD6_BOTTOM_ROW_INDEX = GROUPS.reduce(
  (best, g, i) => (g.fold6 && (best < 0 || g.fold6.y > GROUPS[best].fold6.y)) ? i : best,
  -1
);
const FOLD6_BOTTOM_ROW = GROUPS[FOLD6_BOTTOM_ROW_INDEX];

// Distinct mini-legend row y's, top→bottom — the ORDER of the rows only. The
// top one's frame y is the block's vertical anchor (scaled with H like every
// other frame coordinate); every row below it is FOLD6_ROW_PITCH px further
// down, so editing the pitch moves rows 2/3 without touching GROUPS.
const FOLD6_ROW_FRAME_YS = [...new Set(
  GROUPS.filter((g) => g.fold6).map((g) => g.fold6.y)
)].sort((a, b) => a - b);
// noteShift: the same fold6NoteShiftPx every fold6 target is pre-shifted by
// (see updateGroups) — passed in rather than closed over, since it's measured
// per tick.
function fold6RowY(g, H, noteShift) {
  return fold6RowIndexY(FOLD6_ROW_FRAME_YS.indexOf(g.fold6.y), H, noteShift);
}
function fold6RowIndexY(rowIndex, H, noteShift) {
  return (FOLD6_ROW_FRAME_YS[0] / GROUPS_FRAME_H) * H
    + rowIndex * FOLD6_ROW_PITCH - noteShift;
}
const fold6NoteEl = document.createElement("div");
fold6NoteEl.className = "fold6-note";
fold6NoteEl.style.width = `${FOLD6_NOTE_WIDTH}px`;
fold6NoteEl.innerHTML = FOLD6_NOTE_TEXT.replace(
  "ACLED",
  '<a href="https://acleddata.com/" target="_blank" rel="noopener" class="fold6-note-link">ACLED</a>'
);
const fold6NoteLayerEl = document.getElementById("fold6NoteLayer");
fold6NoteLayerEl.appendChild(fold6NoteEl);
// Hidden, permanently off-screen clone of the bottom row's *settled* label
// (fixed 14px/400, matching fold6's post-lerp end state) — measuring this
// instead of the live groupItems[FOLD6_BOTTOM_ROW_INDEX].label lets the
// note/divider below compute their target position from where that row
// ENDS UP, not wherever it currently is mid-flight. Reading the live label's
// getBoundingClientRect() instead (an earlier version of this code did)
// made the note visibly trail the row in from its pre-glide position instead of
// staying put and just fading in.
const fold6RowMeasureEl = document.createElement("span");
fold6RowMeasureEl.className = "group-label";
fold6RowMeasureEl.style.cssText = "visibility:hidden; left:-9999px; top:-9999px; font-size:14px; font-weight:400;";
fold6RowMeasureEl.textContent = FOLD6_BOTTOM_ROW.label;
groupsOverlayEl.appendChild(fold6RowMeasureEl);
const fold6NoteDividerEl = document.createElement("div");
fold6NoteDividerEl.className = "fold6-note-divider";
fold6NoteLayerEl.appendChild(fold6NoteDividerEl);

// Every group's position is one continuous chain of lerps — hero anchor →
// fold4 column → fold6 mini-legend — driven by each stage's own t. Once a
// given t reaches 1 the position is exactly that stage's target (no residual
// blend), so this is equivalent to a discrete per-fold layout at rest, but
// never snaps between two different DOM nodes to get there.
