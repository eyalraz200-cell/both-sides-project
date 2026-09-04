// These strings ARE the join key into the data — they must match full_v3.xlsx's
// `event_type` values verbatim (see CATEGORY_TO_IDX below, and load_events in
// server.py). All 10 of the dataset's event types are represented one-to-one.
// (הטרדה ואיומים was retired on the v2→v3 dataset: its 104 rows were
// hand-reclassified into the categories below, so the type no longer exists
// in the data and its pill is gone.)
const P9_CATEGORIES = [
  "הפגנה לא אלימה",
  "פוגרום",
  "החזקה בכפייה",
  "תקיפה בנשק קר",
  "תקיפה בנשק חם",
  "תקיפה פיזית",
  "הפרות סדר",
  "ניכוס שטח",
  "פגיעה ברכוש",
  "חסימת כביש",
];

// Short category descriptions shown by the tray's hover tooltip (p9CategoryTooltipInit
// below) — index-aligned with P9_CATEGORIES, not with the (slightly differently
// worded) category headings they were sourced from.
const P9_CATEGORY_DESC = [
  "הפגנה, עצרת, צעדה או נוכחות מחאתית ללא אלימות מצד המפגינים.",
  "התקפה המונית על קהילה, שכונה או אזור מגורים, הכוללת פגיעה באנשים, ברכוש או במרחב האזרחי.",
  "לקיחה או החזקה של אדם בלתי מעורב בניגוד לרצונו.",
  "שימוש באבנים, מקלות, סכינים או אמצעי תקיפה חדים ומקהים אחרים נגד בלתי מעורבים.",
  "ירי בנשק חם, שימוש בחומרי נפץ או הצתה נגד בלתי מעורבים.",
  "פגיעה ישירה בבלתי מעורב, בידיים חשופות או באמצעות חפצים.",
  "עימותים, התפרעויות, או פעולות שמפרות את הסדר הציבורי.",
  "ביסוס שליטה בשטח שאינו שייך לקבוצה הפועלת, באמצעות גידור, עיבוד, בנייה, הצבת מבנים או הקמת מאחז.",
  "גרימת נזק למבנים, כלי רכב, תשתיות, שטחים חקלאיים או רכוש אחר.",
  "חסימה של כבישים, צמתים או דרכי גישה כחלק ממחאה או עימות.",
];

// Each category's permanent (row, column) slot in the tray's #page9ZoneBelow
// — indexed in parallel with P9_CATEGORIES. Fixed regardless of which
// categories are currently dropped into #page9ZoneAbove: dragging one out
// just empties its cell instead of reflowing the others to fill the gap
// (see p9BuildPanel, which assigns these via each pill's own grid-column
// rather than relying on flex-wrap source order). Each row is its own
// independent grid (.page9-tray-row, one per `row` value here) rather than
// one grid shared across all 2 rows — sharing tracks would force every
// column wide enough to fit whichever row's pill in that column is widest,
// leaving every shorter pill stranded with
// uneven left/right padding instead of an even gap to its neighbor. With
// independent per-row grids, every column is sized to just that row's own
// content, so the gap between any two adjacent pills is exactly the row's
// own `gap` value, never inflated by a different row's longer label.
const P9_TRAY_GRID = [
  { row: 1, col: 5 }, // הפגנה לא אלימה — moved to the row's left end, out of the first (rightmost) slot
  { row: 1, col: 3 }, // פוגרום — swapped with החזקה בכפייה below
  { row: 2, col: 1 }, // החזקה בכפייה — swapped with פוגרום above
  { row: 1, col: 4 }, // תקיפה בנשק קר — the old single תקיפה חמושה slot
  { row: 1, col: 2 }, // תקיפה בנשק חם — took the slot the retired הטרדה ואיומים pill
                      // vacated, which puts row 1 back at 5 columns (it had been
                      // extended to 6 only to fit an 11th pill); every other
                      // hand-tuned slot keeps its exact position.
  { row: 1, col: 1 }, // תקיפה פיזית — moved to the row's right end (first slot)
  { row: 2, col: 2 },
  { row: 2, col: 5 }, // ניכוס שטח — swapped with חסימת כביש below to free up the bottom-middle slot
  { row: 2, col: 4 },
  { row: 2, col: 3 }, // חסימת כביש — moved to row 2's middle column
];

// Desktop layout V2's tray grid: one single row of all 10 pills. Column order
// keeps the hand-tuned reading order of the old two-row tray — row 1's slots
// right-to-left first (cols 1..5), then row 2's (cols 6..10). Indexed in
// parallel with P9_CATEGORIES, same as P9_TRAY_GRID. Read through p9TrayGrid()
// (below), never directly, so the variant switch has one place to live.
const P9_TRAY_GRID_V2 = P9_TRAY_GRID.map(g => ({
  row: 1,
  col: g.row === 1 ? g.col : 5 + g.col,
}));

// The tray grid for the layout currently in force. Regular-width desktops
// (≤ P9_DESKTOP_REGULAR_MAX) can't fit all 10 pills in one 20px row, so V2
// falls back to the legacy hand-tuned 5/5 two-row arrangement there — the
// rendering picked in the pill-row compare ("two rows at 20px", not shrunk
// pills). Re-resolved by p9ApplyTrayGrid on every resize, so crossing the
// cutoff re-slots the pills live.
function p9TrayGrid() {
  if (!p9IsV2()) return P9_TRAY_GRID;
  // TRIAL under judgment: regular desktop keeps the single V2 row too, with
  // the pills shrunk to 18px by the ≤1600px media rule in style.css — instead
  // of the earlier two-row fallback (return p9IsRegularDesktop() ?
  // P9_TRAY_GRID : P9_TRAY_GRID_V2). Revert to that line if rejected.
  return P9_TRAY_GRID_V2;
}
// Both row wrappers are always built, in every layout — V2 simply leaves row 2
// empty (all 10 pills sit in row 1), and `.page9-tray-row:empty` hides it. That
// keeps a resize across the 600px breakpoint from having to rebuild the DOM.

// A pointer press on a pill that moves less than this before release counts
// as a click (desktop click-to-classify, see the pointerdown handler in
// p9BuildPanel) rather than a drag.
const P9_CLICK_SLOP_PX = 4;

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

// --- Mobile (@fold11 touch adaptation) ---------------------------------------
// Under the 600px breakpoint the fold keeps ONE render path — only the geometry
// swaps. Every consumer (p9PlaceDot's three interpolation branches, the
// finalized state-1 drop, page8's bridge glide, page12's freeform spread) reads
// positions through p9LegitPosOf / drawPage9's extreme math, so changing where
// those two grids sit is enough; none of that machinery is touched.
//
// Vertical stack on mobile, top to bottom (Figma node 294-1272):
//   מקרא bar -> title card -> tray band -> docked tooltip frame -> extreme grid
//   -> divider (p9MidY) -> legit bar, flush with the viewport's bottom edge
// The tray is a band pinned under the titles, NOT a bottom sheet — and the
// docked tooltip frame slides DOWN from its @fold9 spot to make room for it as
// @fold11 engages (p9TooltipDropTrigger, js/groups.js).
// Dot size — both grids, so p9PlaceDot needs no extra param. 1.5 against a pitch
// of 2 leaves a 0.5px gap: the dots read denser and bolder without touching grid
// capacity. The pitch is what caps the dot, not taste — at pitch 3 one side's
// 176×509 box holds ~9.8k cells against the right camp's 9,126 events, which a
// shorter phone (360×640 → ~5.4k) doesn't clear, and an oversubscribed extreme
// grid widens its monotonic columns straight across the center gap.
const P9_SQ_M          = 1.5;
const P9_CELL_M        = 2;   // extreme-grid pitch
const LEGIT_CELL_M     = 1;   // legit-bar pitch: real dots, packed until they read as a solid bar
const P9_EXTREME_GAP_M = 64;  // no floating pill labels on mobile, so the gap is purely visual (widened from 40 — one-column sides sat too close to center)
// The tray band's top rule (Figma's Line 15) — must match `top` in .page9-tray's
// ≤600px rule, which is the thing that actually positions it.
const P9_TRAY_TOP_M          = 108; // 104 + 4: rode down with --card-top 48→52 (legend→title gap widened to 8px)
const P9_TRAY_TOOLTIP_GAP_M  = 20; // band's bottom rule -> docked frame's top (Figma had 28; tightened by eye)
const P9_TOOLTIP_COLLAPSED_H = 100; // the docked frame's collapsed height (`.page9-tooltip.is-docked` in style.css); the "עוד" expansion overlays rather than pushing
const P9_TOOLTIP_GRID_GAP_M  = 20; // collapsed frame's bottom -> the count-label block (matches P9_TRAY_TOOLTIP_GAP_M — change them together)
// The mobile count label is a TWO-line block (the number with "אירועים" under
// it), so the reserved band above the grid is the old one-line 20 plus one
// extra line's height — the grid ceiling (p9ExtremeTopY) moves down by that
// line, shortening the max column so every gap in the stack stays what it was.
const P9_COUNT_LINE_H_M      = 15; // baseline-to-baseline for the 13px label lines
const P9_COUNT_LABEL_ROOM_M  = 20 + P9_COUNT_LINE_H_M; // label block -> the extreme grid's first row
// The mobile legit bar is a FIXED 4 rows of LEGIT_CELL_M — 4px, a hair under
// Figma node 290-409's ~7px bars. It is deliberately not derived from the event
// count: at 1px pitch each camp's half only holds ~800 cells against 5.3k/9.1k
// events, so the dots oversubscribe their cells and overdraw. That overdraw is
// exactly what makes the bar read as solid, and it lets the height be a design
// decision instead of a consequence of the dataset size.
const LEGIT_BAR_ROWS_M = 4;
// Mobile legit-half variant under review: desktop-style spread strip (free
// individually-shuffled dots at the extreme grid's own 2px pitch, hanging off
// the divider into a fixed-height bottom strip, exactly the V2 desktop look)
// instead of the packed 4px `mode:"bar"`. Flip to false to restore the bar —
// every bar-mode consumer keys off `mode === "bar"` in the geometry, so the
// whole pipeline (drawJumbledBot, the at-rest rect pass, page8's landed
// handoff) follows this one switch.
const P9_LEGIT_SPREAD_M = true;
const P9_LEGIT_H_M      = 54; // the strip's height, up from the viewport's bottom edge
// The spread strip gets its own, smaller dot/pitch than the extreme grid
// (1 on 1.5 vs 1.5 on 2) — the finer texture is what lets the band be this
// short while still reading as spread dots rather than a solid bar.
const P9_LEGIT_SQ_SPREAD_M   = 1;
const P9_LEGIT_CELL_SPREAD_M = 1.5;

// --- Desktop layout V2 (pills on top, drop zone below, dense bottom band) ----
// Flip P9_LAYOUT_V2 to false to restore the old desktop layout (bottom tray,
// tall legit shuffle). Mobile is untouched either way — p9IsV2() is always
// false under the 600px breakpoint. The class `page9-layout-v2` on
// .page9-sticky (synced at boot + on resize, see the resize listener near
// p9SyncSubtitle) scopes every V2 CSS rule; old rules stay as-is.
const P9_LAYOUT_V2 = true;
// The typeof guard is the same cross-script ordering caveat p9MeasureTrayLayout
// documents: isMobile() lives in js/core.js, a LATER <script> than page9.js, so
// anything reachable from page9.js's own top-level run has to survive it being
// undefined. Falling back to "not V2" is safe — every such call site is
// re-resolved from the DOMContentLoaded pass.
function p9IsV2() { return P9_LAYOUT_V2 && typeof isMobile === "function" && !isMobile(); }

// --- Regular-desktop tier (V2 at ≤1600px) ------------------------------------
// Everything above this width is the "big screen" desktop the V2 layout was
// built on; at or under it the fold re-tunes itself (two-row pill band via
// p9TrayGrid; matching CSS lives under `@media (max-width: 1600px)` in the V2
// block of style.css — keep the two 1600s in sync).
const P9_DESKTOP_REGULAR_MAX = 1600;
function p9IsRegularDesktop() {
  return p9IsV2() && window.innerWidth <= P9_DESKTOP_REGULAR_MAX;
}

// V2 keeps the ordinary desktop legit grid — free, individually-shuffled dots
// hanging off the divider, NOT mobile's packed `mode:"bar"` — it just gets a
// shorter strip to live in, so the same dots read denser. This is the strip's
// height in px, measured up from the viewport's bottom edge; p9MidY derives
// the divider from it (the old layout's H * P9_MID fraction is ~240px on a
// 900px viewport, so this is a real compression, not a rename).
const P9_LEGIT_H_V2 = 150;
// Regular-desktop tier: a shorter strip, paired with a finer legit pitch
// (P9_LEGIT_CELL_REGULAR below via p9Metrics) — the two MUST move together.
// At the base 4px pitch the ~14.5k events already need ≈150px on a ~1500px
// viewport, and the shuffle never drops dots when short on room (legitRows =
// max(visibleRows, rowsNeeded)); overflow rows just clip invisibly below the
// viewport. Shrinking the height alone would silently lose dots off-screen.
const P9_LEGIT_H_V2_REGULAR = 110;
function p9LegitHV2() {
  return p9IsRegularDesktop() ? P9_LEGIT_H_V2_REGULAR : P9_LEGIT_H_V2;
}
// The finer pitch itself: 2px dots on a 3px pitch (base: 3 on 4). Capacity
// scales with 1/cell², so the 110px strip at 3px holds more cells than the
// 150px strip does at 4px. Same asymmetry-vs-extreme-dots precedent as
// mobile's spread strip (1px on 1.5px).
const P9_LEGIT_CELL_REGULAR = 3;
const P9_LEGIT_SQ_REGULAR   = 2;
// Fallback center gap for the first frames, before the drop zone's box has
// been measured — normally the gap is derived from that measured width (see
// P9_ZONE_GAP_SLACK_V2 and the gapWidth block in drawPage9).
const P9_EXTREME_GAP_V2 = 120;
// Top of the V2 pill row — the single source; also written to the CSS var
// --p9-v2-tray-top (p9SyncLayoutV2Class) so .page9-tray's V2 rule and the
// drop-zone wrap position derive from the same number instead of a
// hand-synced twin (the 28.78vh trap).
const P9_TRAY_TOP_V2 = 120;
const P9_TRAY_HEADER_GAP_V2 = 20; // floor: this much clear air under .page9-header

// Where the V2 pill band's top edge actually lands: P9_TRAY_TOP_V2, but never
// closer than P9_TRAY_HEADER_GAP_V2 under the pinned header — --card-top is a
// vh fraction, so on a tall viewport the header's own bottom can outgrow the
// constant. Written to --p9-v2-tray-top (p9MeasureTrayLayout) and read back by
// p9ExtremeTopY, so the CSS and the canvas ceiling never disagree.
function p9TrayTopV2() {
  const header = document.querySelector(".page9-header");
  const headerBottom = header ? header.offsetTop + header.offsetHeight : 0;
  return Math.round(Math.max(P9_TRAY_TOP_V2, headerBottom + P9_TRAY_HEADER_GAP_V2));
}
// V2 vertical rhythm below the pill row: tray -> drop zone gap, then the
// reserved drop-zone stack (FULL height always, so the extreme grid's ceiling
// never moves as pills dock), then room for the count labels.
// The V2 drop zone is a VERTICAL stack again, sitting in the center gap
// between the two extreme column-blocks (it briefly lived as a horizontal box
// under the pill row). Its box is therefore sized exactly like the legacy
// layout's — ten pills deep, the longest one wide — and this is the clear air
// left on EACH side of it inside the canvas gap.
const P9_ZONE_GAP_SLACK_V2 = 64; // widened from 40 — a one-column-wide side sat too close to the zone
const P9_TRAY_ZONE_GAP_V2   = 18;
const P9_COUNT_LABEL_ROOM_V2 = 28; // one 12px count line + breathing room above the grid
// Clear air between the pill row and the TOP of a full-height extreme column
// (i.e. above the count label, which sits at the grid's ceiling). Separate
// from P9_COUNT_LABEL_ROOM_V2 because that one is the label's own line box —
// this is the gap the tallest possible column keeps from the band above it, so
// the two never read as touching.
const P9_ZONE_GRID_GAP_V2 = 26;

// The full drop-zone stack height (--page9-zone-stack-height, written by
// p9MeasureTrayLayout) in px — the always-reserved vertical budget for
// #page9ZoneAbove in V2. 0 until first measure.
function p9ZoneStackHV2() {
  const zone = document.getElementById("page9ZoneAbove");
  if (!zone) return 0;
  const v = getComputedStyle(zone).getPropertyValue("--page9-zone-stack-height");
  return parseFloat(v) || 0;
}

// Its width twin (--page9-zone-stack-width) — the canvas center gap is sized
// off this in V2 so the two extreme blocks part exactly wide enough for the
// zone that sits between them. 0 until first measure.
function p9ZoneStackWV2() {
  const zone = document.getElementById("page9ZoneAbove");
  if (!zone) return 0;
  const v = getComputedStyle(zone).getPropertyValue("--page9-zone-stack-width");
  return parseFloat(v) || 0;
}

// Per-breakpoint dot/pitch metrics. Read fresh (not cached) so a resize across
// the breakpoint reflows on the very next frame.
function p9Metrics() {
  return isMobile()
    ? { SQ: P9_SQ_M, CELL: P9_CELL_M,
        legitCell: P9_LEGIT_SPREAD_M ? P9_LEGIT_CELL_SPREAD_M : LEGIT_CELL_M,
        legitSq:   P9_LEGIT_SPREAD_M ? P9_LEGIT_SQ_SPREAD_M   : LEGIT_CELL_M }
    : p9IsRegularDesktop()
      ? { SQ: P9_SQ, CELL: P9_CELL,
          legitCell: P9_LEGIT_CELL_REGULAR, legitSq: P9_LEGIT_SQ_REGULAR }
      : { SQ: P9_SQ,   CELL: P9_CELL,   legitCell: LEGIT_CELL, legitSq: P9_SQ };
}

// Height of the mobile legit bar. Constant by design (see LEGIT_BAR_ROWS_M) —
// takes W only so callers don't have to care which breakpoint they're in.
function p9LegitBarH(_W) {
  return LEGIT_BAR_ROWS_M * LEGIT_CELL_M;
}

// The tray's own height. offsetHeight is transform-independent, so this is
// correct even while the tray still sits at translateY(100%) before .engaged —
// the divider doesn't jump when the tray slides up.
function p9TrayH() {
  return document.querySelector(".page9-tray")?.offsetHeight || 0;
}

// Where the docked tooltip frame comes to rest on mobile at @fold11 — directly
// under the tray band. Measuring the band (rather than hard-coding Figma's 259)
// keeps the frame glued to it however the pills end up sizing.
function p9DockTopM() {
  return P9_TRAY_TOP_M + p9TrayH() + P9_TRAY_TOOLTIP_GAP_M;
}

// The divider's y — the single source both grids derive from. On desktop it's
// the Figma-measured fraction of H; on mobile the legit bar sits flush with the
// viewport's bottom edge (the tray is a top band now), so everything above it
// is extreme-grid territory.
function p9MidY(H, W) {
  const w = W || p9.lastW || window.innerWidth;
  // V2: same free-dot grid as the old desktop layout, just given a shorter
  // strip — the divider sits P9_LEGIT_H_V2 above the bottom edge instead of at
  // the H * P9_MID fraction. The max() keeps the extreme grid its minimum 8
  // rows if a very short viewport would otherwise squeeze it out.
  if (p9IsV2()) {
    return Math.max(
      p9ExtremeTopY(H) + P9_CELL * 8,
      Math.round(H - p9LegitHV2()),
    );
  }
  if (!isMobile()) return Math.round(H * P9_MID);
  return Math.max(
    p9ExtremeTopY(H) + P9_CELL_M * 8,
    Math.round(H - (P9_LEGIT_SPREAD_M ? P9_LEGIT_H_M : p9LegitBarH(w))),
  );
}

// The extreme grid's top clearance — shared by drawPage9 and p9ExtremeRowsFor.
// On mobile it trails the docked tooltip frame, using the frame's *collapsed*
// height so tapping "עוד" overlays the grid instead of shoving it down.
function p9ExtremeTopY(H) {
  // V2: the grid hangs off the bottom of the pill row — the drop zone no
  // longer sits between the two, it lives in the columns' own center gap, so
  // its height is not part of this stack. Pill row, the gap under it, the
  // clear air, then the count-label line.
  if (p9IsV2()) {
    return Math.round(
      p9TrayTopV2() + p9TrayH() + P9_TRAY_ZONE_GAP_V2 +
        P9_ZONE_GRID_GAP_V2 + P9_COUNT_LABEL_ROOM_V2,
    );
  }
  if (!isMobile()) return Math.round(H * SBB.top);
  return Math.round(
    p9DockTopM() + P9_TOOLTIP_COLLAPSED_H + P9_TOOLTIP_GRID_GAP_M + P9_COUNT_LABEL_ROOM_M,
  );
}

// Matches the dashed border-width of .page9-sticky.dragging #page9ZoneAbove
// (style.css) — needed below because the page-wide `* { box-sizing:
// border-box }` reset means a `height` set on that element is the *total*
// box height, border and padding included, not just the content area.
const P9_ZONE_DRAG_BORDER = 2;

// Padding added on top of the widest pill's own rendered width (see
// p9.maxPillWidth, set once in p9BuildPanel) to get the real gap width —
// breathing room on each side so the label isn't flush against the squares.
const P9_GAP_PADDING = 190;

// Maps an event's `category` (full_v3.xlsx's Hebrew `event_type`, passed
// through verbatim by server.py) to its P9_CATEGORIES index. Derived rather
// than hand-written: the pill labels and the data's event types are now the
// same strings, so a typo can't silently desync the two lists.
// (Was CATEGORY_EN_TO_IDX, a hand-written English→index table, back when the
// dataset carried English category names.)
const CATEGORY_TO_IDX = Object.fromEntries(P9_CATEGORIES.map((c, i) => [c, i]));

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

// @fold11's canvas stays visible into @fold12 (drawPage12 renders through
// drawPage9), so every animation loop below must keep painting on page 10
// too — guarding on currentPage === 10 alone froze a mid-flight drop
// animation the instant @fold12 was entered, leaving dots hanging in the
// air until the user scrolled back.
function p9PageVisible() {
  return currentPage === 10 || currentPage === 11;
}

function p9LineRunLoop() {
  if (p9LinePhaseStart === null) return;
  const raw = p9LineCurrentRaw();
  page9LineT = p9Ease(raw);
  if (p9PageVisible()) draw();
  if (raw !== p9LineToT) {
    requestAnimationFrame(p9LineRunLoop);
  } else {
    p9LineFromT      = p9LineToT;
    p9LinePhaseStart = null;
    if (p9PageVisible()) draw();
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
  sides:       [],
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
  if (p9PageVisible()) draw();
  if (t < 1) {
    requestAnimationFrame(p9RunAnimLoop);
  } else {
    p9.anim = null;
    if (p9PageVisible()) draw();
  }
}

// Count-up animation for the extreme-zone labels — separate from p9.anim (dot
// movement). commitDrop sets start = drop time + dot-anim duration, so the
// labels stay frozen at the pre-drop count while dots travel, then count up
// once they've arrived. fromLeft/toLeft (and right) are the integer endpoints.
let p9CountAnim = null; // { fromLeft, toLeft, fromRight, toRight, start, duration }

function p9CountRunLoop() {
  if (!p9CountAnim) return;
  if (p9PageVisible()) draw(); // draw() self-clears p9CountAnim via p9GetDisplayedCounts
  if (p9CountAnim) requestAnimationFrame(p9CountRunLoop);
}

// The "X אירועים" labels above each side's extreme column fade in/out at the
// 0<->nonzero displayed-count boundary (drawPage9 detects the crossing every
// frame and calls p9CountLabelAnimate) instead of snapping instantly — i.e.
// when the very first dropped pill's first dot actually arrives, or the last
// one leaves, per explicit feedback. Same per-frame linear-rate approach as
// p9HoverDimAnimate (HOVER_DIM_MS) further down, just a much longer duration
// since this is a rare standalone appear/disappear, not a fast hover response.
let p9CountLabelAlpha  = 0;
let p9CountLabelWasOn  = false;
let p9CountLabelTarget = 0;
let p9CountLabelRaf    = null;
const P9_COUNT_LABEL_FADE_MS = 400;
function p9CountLabelAnimate(target) {
  p9CountLabelTarget = target;
  if (p9CountLabelRaf !== null) return;
  let lastTime = performance.now();
  function step(now) {
    const dt    = now - lastTime;
    lastTime    = now;
    const delta = dt / P9_COUNT_LABEL_FADE_MS;
    p9CountLabelAlpha = p9CountLabelTarget > p9CountLabelAlpha
      ? Math.min(p9CountLabelTarget, p9CountLabelAlpha + delta)
      : Math.max(p9CountLabelTarget, p9CountLabelAlpha - delta);
    if (p9PageVisible()) draw();
    if (p9CountLabelAlpha !== p9CountLabelTarget) {
      p9CountLabelRaf = requestAnimationFrame(step);
    } else {
      p9CountLabelRaf = null;
    }
  }
  p9CountLabelRaf = requestAnimationFrame(step);
}

// The count labels' own (x, y) position — shared vertical line (whichever
// side is currently taller, see drawPage9's own comment on countsY) plus a
// per-side horizontal center — used to jump instantly whenever a drop
// changes either side's row count or column span. Glides to a new spot
// instead, one independent animator per side (a drop landing only on one
// side shouldn't force the other label to move on the same clock). Fixed-
// duration elapsed/eased tween — the project's usual trigger shape (see
// CLAUDE.md's animation-conventions note) — rather than a per-frame linear
// rate: a rate expressed as "fraction of duration per frame" isn't a valid
// per-pixel step size once distance enters the picture, so re-deriving x/y
// fresh from elapsed time each call sidesteps that unit mismatch entirely.
const P9_COUNT_POS_MS = 500;
function makeP9CountPosAnimator() {
  let pos   = null; // current interpolated {x,y}, returned every call
  let from  = null, to = null, start = null;
  let raf   = null;

  function currentT() {
    if (start === null) return 1;
    return Math.min(1, (performance.now() - start) / P9_COUNT_POS_MS);
  }

  function ensureLoop() {
    if (raf !== null) return;
    function step() {
      if (p9PageVisible()) draw();
      raf = currentT() < 1 ? requestAnimationFrame(step) : null;
    }
    raf = requestAnimationFrame(step);
  }

  return function animate(targetX, targetY) {
    if (pos === null) { pos = { x: targetX, y: targetY }; return pos; }
    if (!to || to.x !== targetX || to.y !== targetY) {
      from  = pos;
      to    = { x: targetX, y: targetY };
      start = performance.now();
      ensureLoop();
    }
    const e = p9Ease(currentT());
    pos = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e };
    return pos;
  };
}
const p9AnimateLeftCountPos  = makeP9CountPosAnimator();
const p9AnimateRightCountPos = makeP9CountPosAnimator();

// Bottom-to-top stacking order for the extreme grid: settlers (orange) lowest,
// then right wing protesters (red), then haredi jews (grey) — and on the
// other side, protesters against government (blue) below arab israelis
// (green), which sits below peace movements (pink). This is a *global* ranking,
// not just "whatever order categories were dropped in".
// Names are full_v3.xlsx's own lowercase `main_actor` values (see GROUPS).
const P9_ACTOR_ORDER = [
  "protesters against government",
  "arab israelis",
  "peace movements",
  "settlers",
  "right wing protesters",
  "haredi jews",
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

// How many rows the extreme dot grid has room for at a given canvas height —
// shared by drawPage9 (actual layout) and commitDropState (predicting,
// before any frame renders, whether a drop needs the "existing dot
// reposition" phase at all — see needsReposition there, state-1-only per
// user instruction).
function p9ExtremeRowsFor(H) {
  const midY        = p9MidY(H);
  // Deliberately a tighter ceiling than drawPage9's own SBB.top clip (0.08) —
  // this is the row *budget*, kept conservative on desktop. On mobile the two
  // agree, since there the docked tooltip is the real ceiling either way.
  const dividerTopY = (isMobile() || p9IsV2()) ? p9ExtremeTopY(H) : Math.round(H * 0.18);
  return Math.max(1, Math.floor((midY - dividerTopY) / p9Metrics().CELL));
}

function p9UpdateLayout(W, H) {
  if (W === p9.lastW && H === p9.lastH) return;

  // All categories start as "legitimate" (below), user drags up to mark as "extreme"
  if (p9.lastW === 0) {
    p9.sides = P9_CATEGORIES.map(() => "below");
  }

  p9.lastW = W;
  p9.lastH = H;
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
// any other grid's margins. Pitch is pinned to the ORIGINAL 4px timeline pitch
// (P9_CELL = P9_SQ 3 + P9_GAP 1) — it used to reuse P7_CELL directly, but the
// real timeline's dots were later enlarged (P7_SQ/P7_GAP in page7.js) and these
// @fold13 dots must NOT follow: they settle at this size as the target of the
// @fold12 animation, so their pitch is decoupled and fixed here.
const LEGIT_CELL   = P9_CELL;
const LEGIT_MARGIN = 0;

// The grid reaches all the way up to the divider line itself (just a 2px
// nudge so dots don't literally touch the stroke) — dots draw straight
// through the "פעולות לגיטימיות" label's own area too, ignoring it entirely.
const LEGIT_LINE_PAD = 2;

// Geometry for the legitimate (below-the-line) grid, factored out of drawPage9 so
// page8's pre-page9 transition can target the exact same layout — the state every
// event starts in before any category has been dragged to "extreme".
// Segment order inside a mobile bar: the camp's own legend order, top row
// first. That's the sort of fold6.y (js/groups.js) — the same rule the legend
// itself uses (legendRow, js/update-groups.js) — and within one camp the three
// y values are distinct, so it's a total order per side.
// Built lazily, NOT at load time: GROUPS lives in js/groups.js, a *later*
// <script> in project.html, so it doesn't exist yet while page9.js is running.
let p9BarActorRank = null;
function p9BarActorRankOf(actor) {
  if (!p9BarActorRank) p9BarActorRank = new Map(GROUPS.map(g => [g.actor, g.fold6.y]));
  return p9BarActorRank.get(actor) ?? 9999;
}

// Rebuilds p9.legitRank: for each side, every event that is *still legit*, in
// bar order — group segment first, then category, then the event's own index.
// Stable, so each group is one contiguous colour block and each category is a
// contiguous run inside it. Keyed on the classification state, so it only
// rebuilds when a pill is actually tapped.
function p9SyncLegitRank() {
  p9EnsureIndex();
  const key = p9.sides.join(",");
  if (p9.legitRank && p9.legitRankKey === key) return;
  const build = (pool, indexOf) => {
    const legit = pool.filter(e => {
      const i = CATEGORY_TO_IDX[e.category];
      return i === undefined || p9.sides[i] !== "above";
    });
    legit.sort((a, b) =>
      p9BarActorRankOf(a.actor)          - p9BarActorRankOf(b.actor)          ||
      (CATEGORY_TO_IDX[a.category] ?? 99) - (CATEGORY_TO_IDX[b.category] ?? 99) ||
      (indexOf.get(a) ?? 0)               - (indexOf.get(b) ?? 0));
    // Each event carries its group's SEGMENT index alongside its rank, and the
    // segments carry their own rank spans. That's what lets p9LegitGeometry
    // give every group a whole number of columns: without the spans it could
    // only place a rank on a continuous scale, and a group boundary landing
    // mid-column left that column half one colour and half the next.
    const rank = new Map();
    const segs = [];
    let cur = null;
    legit.forEach((e, i) => {
      const g = p9BarActorRankOf(e.actor);
      // `actor` rides along so the at-rest bar pass (drawPage9) can colour a
      // whole segment without digging an event back out of the rank map.
      if (!cur || cur.g !== g) { cur = { g, actor: e.actor, r0: i, rn: 0 }; segs.push(cur); }
      cur.rn++;
      rank.set(e, { r: i, s: segs.length - 1 });
    });
    return { rank, segs };
  };
  const L = build(p7.leftEvents,  p9.leftIndexOf);
  const R = build(p7.rightEvents, p9.rightIndexOf);
  p9.legitRank    = { left: L.rank, right: R.rank };
  p9.legitSegs    = { left: L.segs, right: R.segs };
  p9.legitRankKey = key;
}

function p9LegitGeometry(W, H) {
  const CELL     = p9Metrics().legitCell;
  const mobile   = isMobile();
  const midY     = p9MidY(H, W);
  // Desktop: the grid hangs off the divider and runs to the bottom edge.
  // Mobile: it detaches from the divider entirely and becomes a 4px bar sitting
  // flush with the viewport's bottom edge — Figma node 294-1272 (the tray is a
  // top band there, so nothing sits below the bar). See the `mode: "bar"`
  // branch below; p9LegitPosOf's signature (and so page8's glide target) is
  // unchanged, only the packing behind it.
  // Desktop V2 is NOT a bar: it keeps this same free-dot grid and only gets a
  // shorter strip to fill (p9MidY, see P9_LEGIT_H_V2), so the dots stay
  // individually shuffled and simply read denser.
  const bar      = mobile && !P9_LEGIT_SPREAD_M;
  // Mobile's spread strip halves the divider clearance — its dots are 1px on a
  // 1.5px pitch, so desktop's 2px LEGIT_LINE_PAD reads as a visible blank band
  // above the strip rather than a hairline of breathing room.
  const gridTopY = bar ? H - p9LegitBarH(W) : midY + (mobile ? 1 : LEGIT_LINE_PAD);
  // Reaches all the way to the viewport's own bottom edge — unlike the
  // extreme grid above (which stops short for its own count-label/axis
  // clearance), the legit grid has nothing below it to clear, so per
  // explicit request it spreads all the way down instead of stopping short.
  const dashBotY = H;
  const visibleRows = Math.max(1, Math.floor((dashBotY - gridTopY) / CELL));

  const leftBoundX     = LEGIT_MARGIN;
  const rightBoundX    = W - LEGIT_MARGIN;
  const midX           = W / 2;
  const legitColsTotal = Math.max(2, Math.floor((rightBoundX - leftBoundX) / CELL));
  const legitLeftCols  = Math.floor(legitColsTotal / 2);
  const legitRightCols = legitColsTotal - legitLeftCols;

  // ── Mobile: the bar ──────────────────────────────────────────────────────
  // A fixed 8-row rectangle per camp, filled column-major from midX outward.
  // Each camp's ORIGINAL legit count maps onto its full cell pool, so an
  // untouched camp fills its whole half of the screen; as events go extreme
  // the surviving ranks compress against the same pool and the bar's outer end
  // retreats. That's what makes classifying read as "the bar shrinks from the
  // edge" instead of "holes open up inside it" — no cell is ever skipped, and
  // events oversubscribe cells rather than needing one each.
  if (bar) {
    p9SyncLegitRank();
    // Column budget per group. Boundaries are computed on the CUMULATIVE rank
    // scale and then rounded to whole columns, so consecutive groups share an
    // edge exactly (group i ends on the column group i+1 starts on) and every
    // colour change in the bar is a straight vertical line. Rounding against
    // n0 — the camp's ORIGINAL legit count, not its current one — is what keeps
    // the bar retreating from its outer end as events go extreme rather than
    // re-spreading to fill the width.
    const colSegsFor = (side, totalCols, n0) => {
      const segs = p9.legitSegs?.[side] || [];
      const out = [];
      let prevEnd = 0;
      for (const s of segs) {
        const c0 = Math.min(totalCols, Math.max(prevEnd, Math.round(s.r0 / n0 * totalCols)));
        // A group with events always gets at least one column — better a 1-column
        // sliver than a camp member silently vanishing from the bar.
        const c1 = Math.min(totalCols, Math.max(c0 + (s.rn ? 1 : 0),
                                                Math.round((s.r0 + s.rn) / n0 * totalCols)));
        out.push({ c0, c1, r0: s.r0, rn: s.rn, actor: s.actor });
        prevEnd = c1;
      }
      return out;
    };
    const n0L = p7.leftEvents.length  || 1;
    const n0R = p7.rightEvents.length || 1;
    return {
      mode: "bar",
      gridTopY, midX, cell: CELL,
      legitRows: LEGIT_BAR_ROWS_M,
      legitLeftCols, legitRightCols,
      colSegs: { left:  colSegsFor("left",  legitLeftCols,  n0L),
                 right: colSegsFor("right", legitRightCols, n0R) },
    };
  }

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

  // `cell` travels with the geometry so every consumer (p9LegitCellXY here,
  // page8's glide) lays out at whichever pitch this breakpoint chose.
  const geom = { gridTopY, legitRows, legitLeftCols, legitRightCols, midX, cell: CELL };

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
  const CELL = geom.cell ?? LEGIT_CELL;
  const x = side === "left"
    ? geom.midX - (geom.legitLeftCols - c) * CELL
    : geom.midX + c * CELL;
  const y = geom.gridTopY + r * CELL;
  return { x, y };
}

// An event's target {x,y} in the legit grid — its shuffled cell's exact grid
// position within its own side's pool (see p9LegitGeometry above), so the
// result reads as gapped/free-form within that side, while every dot still
// sits on the grid and never crosses into the other side's columns.
function p9LegitPosOf(e, indexOf, side, geom) {
  if (geom.mode === "bar") {
    const rec = p9.legitRank?.[side]?.get(e);
    if (!rec) return null;                 // classified extreme — not in the bar
    const seg = geom.colSegs?.[side]?.[rec.s];
    if (!seg) return null;
    const rows = geom.legitRows;
    const cols = seg.c1 - seg.c0;
    if (cols <= 0) return null;            // group rounded down to no width
    // Within the group's own block of whole columns, the same oversubscribed
    // linear map as before: many events share a cell (there are far more events
    // than the bar has cells), no cell is ever skipped, and the block fills
    // column-major so it grows outward one clean column at a time.
    const pool  = cols * rows;
    const local = Math.min(Math.floor((rec.r - seg.r0) * pool / seg.rn), pool - 1);
    const col   = seg.c0 + Math.floor(local / rows);
    const row   = local % rows;
    // Both bars fill OUTWARD from the center line, so column 0 sits against midX
    // and the far end is where the bar retreats from. The right side already
    // does that (p9LegitCellXY grows its column index rightward from midX), but
    // the left side's columns are numbered left-to-right from the screen edge,
    // so its column index is mirrored here. Without this the left bar reads
    // pink-green-blue right-to-left and shrinks from the center instead of the
    // edge. Bar mode only — the desktop shuffle wants the raw numbering.
    const cellOut = side === "left"
      ? (geom.legitLeftCols - 1 - col) * rows + row
      : col * rows + row;
    return p9LegitCellXY(cellOut, geom, side);
  }
  const shuffle = side === "left" ? p9.legitShuffleLeft : p9.legitShuffleRight;
  const cell = shuffle[indexOf.get(e)];
  if (cell === undefined) return null;
  return p9LegitCellXY(cell, geom, side);
}

// The at-rest mobile bar as solid rects: one rect per colour segment per side.
// Shared by drawPage9 (its barAtRest pass) and drawPage8 (page8.js), which
// paints it the moment its glide has fully landed — the glide's own per-dot
// pass at 1px cells leaves ragged colour seams the instant motion stops
// masking them. Both edges snapped to whole DEVICE pixels with the same
// rounding the dots use, so adjacent segments (and the two camps at midX)
// share the exact device-pixel boundary — no gap, no overlap, one hard
// vertical seam.
function p9DrawBarRects(ctx, legitGeom, H, alpha) {
  const dpr = window.devicePixelRatio || 1;
  const q   = v => Math.round(v * dpr) / dpr;
  const barCell = legitGeom.cell;
  const yTop = q(legitGeom.gridTopY);
  ctx.globalAlpha = alpha;
  for (const side of ["left", "right"]) {
    for (const seg of legitGeom.colSegs[side]) {
      if (seg.c1 <= seg.c0) continue;
      const x0 = side === "left"
        ? q(legitGeom.midX - seg.c1 * barCell)
        : q(legitGeom.midX + seg.c0 * barCell);
      const x1 = side === "left"
        ? q(legitGeom.midX - seg.c0 * barCell)
        : q(legitGeom.midX + seg.c1 * barCell);
      ctx.fillStyle = p7ActorColor(seg.actor);
      ctx.fillRect(x0, yTop, x1 - x0, H - yTop);
    }
  }
  ctx.globalAlpha = 1;
}

function drawPage9(ctx, W, H) {
  if (!p7.ready) {
    drawBackground(ctx, W, H);
    return;
  }

  p9UpdateLayout(W, H);

  drawBackground(ctx, W, H);

  const mobile = isMobile();
  const topY   = p9ExtremeTopY(H);
  const midY   = p9MidY(H, W);
  // One SQ for both grids at either breakpoint (mobile 1px, desktop 3px), so
  // p9PlaceDot's closure needs no per-grid size parameter.
  const { SQ, CELL } = p9Metrics();


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
    const idx  = CATEGORY_TO_IDX[e.category];
    const side = (idx !== undefined && p9.sides[idx] === "below") ? "bot" : "top";
    (side === "top" ? leftTop : leftBot).push(e);
  }
  for (const e of p7.rightEvents) {
    const idx  = CATEGORY_TO_IDX[e.category];
    const side = (idx !== undefined && p9.sides[idx] === "below") ? "bot" : "top";
    (side === "top" ? rightTop : rightBot).push(e);
  }

  p9SyncTopOrder(p9.leftTopOrder,  new Set(leftTop));
  p9SyncTopOrder(p9.rightTopOrder, new Set(rightTop));

  // The extreme dot grid is anchored at midY itself (touching the horizontal
  // divider, no gap) and sized to reach all the way up to 14vh, matching
  // .page9-zone-wrap-extreme's own top edge.
  const dashBotY    = H - 16;
  const extremeRows = p9ExtremeRowsFor(H);

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
  // On mobile there are no floating dropped-pill labels to clear (the pills
  // stay in the tray and highlight in place), so the gap shrinks to a plain
  // visual separator instead of being sized to the widest label — but never
  // below what the two count labels need. Each label is centered over its own
  // column block, so when both sides are only a column or two wide the two
  // "אירועים" blocks would meet across a bare-minimum gap; the gap widens
  // (P9_EXTREME_GAP_M stays the floor) until the label centers — sitting at
  // half of each side's real column span off the gap edges — clear each other
  // by P9_COUNT_LABEL_CLEAR_M. Wide columns push the centers apart on their
  // own, so `needed` goes negative and the floor takes over. Measured off the
  // total per-side counts (not the hover-filtered ones) so hovering a pill
  // never re-flows the whole grid.
  let gapWidth;
  if (mobile) {
    ctx.font = "400 13px 'Assistant', sans-serif"; // the mobile count-label font
    const wordW  = ctx.measureText("אירועים").width;
    const halfL  = Math.max(wordW, ctx.measureText(String(p9.leftTopOrder.length)).width)  / 2;
    const halfR  = Math.max(wordW, ctx.measureText(String(p9.rightTopOrder.length)).width) / 2;
    const P9_COUNT_LABEL_CLEAR_M = 12; // min px between the two label blocks
    const needed = halfL + halfR + P9_COUNT_LABEL_CLEAR_M
                 - (leftRealCols + rightRealCols) * CELL / 2;
    gapWidth = Math.max(P9_EXTREME_GAP_M, Math.ceil(needed));
  } else if (p9IsV2()) {
    // V2: the drop zone itself sits in this gap, so the blocks have to part
    // wide enough for its measured box plus slack on each side. Falls back to
    // the flat visual gap until that box has been measured.
    const zoneW = p9ZoneStackWV2();
    gapWidth = zoneW ? Math.round(zoneW + P9_ZONE_GAP_SLACK_V2 * 2) : P9_EXTREME_GAP_V2;
  } else {
    gapWidth = p9.maxPillWidth ? p9.maxPillWidth + P9_GAP_PADDING : P9_EXTREME_GAP;
  }
  const centerX  = W / 2 - gapWidth / 2;
  const rightX0  = W / 2 + gapWidth / 2;

  // Records each event's *target* placement for next time (so a future transition
  // has a "from" to blend out of), and — while p9.anim is active — actually draws
  // it partway between its old recorded spot and that target instead of snapping
  // straight there. Color is invariant per event (actor-based) so only position
  // and the extreme/legit opacity need to move.
  const posMap = new Map();
  // orderIndex/orderCount: this dot's position within the column it's being
  // drawn into right now (drawBandedCols passes its own forEach index/
  // orderArr.length; callers that don't care — legit dots, which never hit
  // the "existing dot repositioning" branch below — just omit them).
  // lowRankCount: how many of that column's entries rank settlers-or-below
  // (drawBandedCols precomputes this once, since the array is already
  // rank-sorted) — used to rescale orderIndex/orderCount down to a position
  // *within this dot's own rank tier* below, rather than within the whole
  // (often much larger) column.
  // sizeOverride: the mobile legit BAR draws at exactly its own cell pitch
  // instead of the shared SQ. SQ (1.5) is wider than that pitch (1) on purpose
  // for the extreme grid, but in the bar it made every dot bleed a quarter of a
  // pixel into the columns either side of it — which at a colour boundary reads
  // as dots of one group scattered into the next, and as a ragged rather than
  // straight edge between them. At the pitch the segments are solid blocks with
  // exact vertical seams.
  // recordOnly: run the full interpolation/posMap bookkeeping but paint
  // nothing — used by the at-rest mobile bar, which paints itself as solid
  // per-segment rects instead (see the barAtRest pass below) but still needs
  // every event's position on record for the next drop's p9.anim.from and the
  // picker's nearest-dot scan.
  function p9PlaceDot(e, targetX, targetY, targetAlpha, orderIndex, orderCount, lowRankCount, sizeOverride, recordOnly) {
    let drawX = targetX, drawY = targetY, drawAlpha = targetAlpha;
    // The animation's own eased progress for this dot, kept for the size lerp
    // below. 1 (= fully arrived, draw at the target size) whenever nothing is
    // animating this dot.
    let animT = 1;
    const from = p9.anim ? p9.anim.from.get(e) : null;
    {
      if (from) {
        let t;
        if (p9.anim.newEventStagger && p9.anim.newEventStagger.has(e)) {
          // New extreme dot — departs once the reposition phase finishes
          // (phase2Start === start+repositionMs), or immediately/concurrently
          // with it when this drop interrupted a still-running animation
          // (phase2Start === start). Read directly rather than recomputed —
          // it no longer has a fixed relationship to start/repositionMs, see
          // the comment in commitDropState where it's resolved.
          const dotArrival  = p9.anim.newEventStagger.get(e);
          const phase2Start = p9.anim.phase2Start;
          const dotDur      = dotArrival - phase2Start;
          t = p9Ease(Math.min(1, Math.max(0, (performance.now() - phase2Start) / dotDur)));
        } else if (p9.anim.plainGlide) {
          // Plain, unstaggered glide over the animation's full duration — used
          // when picking up page8's timeline->legit-grid glide mid-flight (see
          // setActivePage, main.js) to continue at the same visual speed it
          // was already moving at. The tier-staggered branch below compresses
          // actual travel into only 40% of its given duration (by design, for
          // the extreme-zone reposition case it's built for) — reusing it here
          // made the glide visibly speed up ~2.5x the instant this section's
          // title card appeared and this continuation kicked in.
          t = p9Ease(Math.min(1, Math.max(0, (performance.now() - p9.anim.start) / p9.anim.duration)));
        } else {
          // Existing dot repositioning.
          // Dots whose actor rank is above "settlers" in the column (right wing
          // protesters, haredi jews) get pushed upward by incoming new events —
          // they glide to their new spot, high-rank dots timed to finish at the
          // same moment the new dots land (topDotArrivesAt); lower-rank dots
          // (settlers and below) finish phase 1 on their own faster clock.
          const isHighRank = P9_ACTOR_ORDER.indexOf(e.actor) > P9_ACTOR_ORDER.indexOf("settlers");
          const repoMs   = p9.anim.repositionMs || p9.anim.duration;
          const windowMs = (p9.anim.topDotArrivesAt !== undefined && isHighRank)
            ? p9.anim.topDotArrivesAt - p9.anim.start
            : repoMs;
          const STAGGER_FRACTION = 0.6;
          const staggerSpan = windowMs * STAGGER_FRACTION;
          const travelDur   = windowMs - staggerSpan;
          // Staggered by this dot's position *within its own rank tier*, not
          // its raw position in the full column — usually only a handful of
          // dots (typically the whole high-rank tail, pushed up to make room
          // for a lower-rank insertion elsewhere) actually have a target that
          // moved at all; anchoring the stagger to the full column instead
          // left that handful scheduled almost entirely at the tail end of
          // the window regardless (their raw index was already close to the
          // column's own length), so they'd barely start moving — well after
          // the new dots flying in beside them already had — instead of
          // "leaving space" for them throughout, per explicit feedback.
          const low         = lowRankCount ?? 0;
          const tierIndex   = isHighRank ? (orderIndex ?? 0) - low : (orderIndex ?? 0);
          const tierCount   = isHighRank ? (orderCount ?? 1) - low : (low || (orderCount ?? 1));
          const denom       = Math.max(1, tierCount - 1);
          const dotStart    = p9.anim.start + staggerSpan * (tierIndex / denom);
          t = p9Ease(Math.min(1, Math.max(0, (performance.now() - dotStart) / travelDur)));
        }
        drawX     = from.x     + (targetX     - from.x)     * t;
        drawY     = from.y     + (targetY     - from.y)     * t;
        drawAlpha = from.alpha + (targetAlpha - from.alpha) * t;
        animT     = t;
      }
    }
    // Recorded here — the actually-drawn, mid-interpolation position/alpha,
    // not the target — so a *new* animation starting while this dot is still
    // mid-flight blends from where it visually is right now instead of from
    // where the previous animation was heading. Using targetX/Y/Alpha here
    // (the old behavior) made a dot dropped on top of another still-arriving
    // one snap to the earlier target for a frame before continuing on to its
    // real one. Captured before hover-dimming below, which is a transient
    // display-only effect that shouldn't get baked into the next animation's
    // starting alpha.
    let sq = sizeOverride ?? SQ;
    // page8's glide doesn't only move the dots, it SHRINKS them from the real
    // timeline's square size down to the legit grid's across the flight
    // (blendAndDraw, page8.js). When @fold11's title scrolls up mid-glide,
    // drawPage9 takes the flight over (p9.anim.plainGlide, seeded in
    // setActivePage) — and it used to paint them at their final size from that
    // frame on. A still-spread cloud of dots suddenly drawn small covers much
    // less ground, which reads as the whole animation dropping opacity at the
    // handoff. Continuing the same size lerp on the same clock keeps it
    // invisible, like the position handoff already was.
    if (p9.anim && p9.anim.plainGlide && p9.anim.fromSQ !== undefined) {
      sq = p9.anim.fromSQ + (sq - p9.anim.fromSQ) * animT;
    } else if (from && from.sq !== undefined) {
      // Every other animation lerps size on the dot's own clock too, from the
      // size it was last DRAWN at (recorded in posMap below). Without this, a
      // dropped category's dots snapped from the legit resting size (2px on
      // ≤1600px desktop, 1px mobile) to the extreme grid's SQ on the first
      // frame, before the flight even started — and mirror-image on un-drop.
      // On big desktop legitSq === SQ so this is a no-op there.
      sq = from.sq + (sq - from.sq) * animT;
    }
    posMap.set(e, { x: drawX, y: drawY, alpha: drawAlpha, sq: sq });

    if (recordOnly) return;

    // While one dot is hovered (p9.hoveredEvent), it's drawn fully opaque and
    // every other dot is dimmed. While a dropped pill is hovered instead
    // (p9.hoveredCategoryIdx, set by p9HoverInit's pill listener), ALL dots
    // of that category stay full opacity and the rest dim by the same factor.
    // Dot-hover takes priority so both states are never active simultaneously.
    if (p9.hoveredEvent) {
      drawAlpha = (e === p9.hoveredEvent) ? 1 : drawAlpha * hoverDim(e.actor);
    } else if (p9.hoveredCategoryIdx !== null) {
      // Same per-actor floor as dot-hover (hoverDim, js/core.js), only
      // animated: hoverDimT ramps 0→1 so each dot fades from full down to
      // exactly the opacity a dot-hover would give it, not a lighter flat one.
      const dimFactor = 1 - (1 - hoverDim(e.actor)) * p9.hoverDimT;
      drawAlpha = (CATEGORY_TO_IDX[e.category] === p9.hoveredCategoryIdx) ? 1 : drawAlpha * dimFactor;
    } else if (p9.hoverDimT > 0) {
      const dimFactor = 1 - (1 - hoverDim(e.actor)) * p9.hoverDimT;
      drawAlpha = (p9.hoverDimCategoryIdx !== null && CATEGORY_TO_IDX[e.category] === p9.hoverDimCategoryIdx)
        ? 1
        : drawAlpha * dimFactor;
    }

    ctx.globalAlpha = drawAlpha;
    ctx.fillStyle   = p7ActorColor(e.actor);
    if (sizeOverride === undefined && (isMobile() || p9IsV2())) {
      // The ordinary dots get the same device-pixel snap for a DIFFERENT
      // reason than the bar cells below: not the seam, but the loupe. The
      // mobile picker (p7InspectInit, page7.js) serves this fold too, and its
      // glass is a nearest-neighbour 4x blit of this canvas — so a dot left at
      // a fractional position antialiases into a partial-alpha band that
      // magnifies into a pale ring, and the dots read as if they were stroked.
      // p7DrawSideSquares snaps for exactly this; @fold11 was the path it
      // never reached.
      //
      // V2 desktop snaps for a third reason: on a display whose DPR isn't a
      // whole number (1.25 / 1.5 — a scaled external monitor) a 3px square at
      // a fractional CSS position spreads across 4-5 device pixels at partial
      // alpha and the dots read soft, visibly so beside the same page on a 1x
      // or 2x screen where those same coordinates happen to land clean. The
      // legacy desktop layout keeps its unsnapped smoothness, as before.
      const dpr = window.devicePixelRatio || 1;
      drawX = Math.round(drawX * dpr) / dpr;
      drawY = Math.round(drawY * dpr) / dpr;
      sq    = Math.max(1 / dpr, Math.round(sq * dpr) / dpr);
    } else if (sizeOverride !== undefined) {
      // Snap the bar's cells to whole DEVICE pixels. The canvas is scaled by
      // devicePixelRatio (js/core.js), and midX is W/2 — a half-pixel on any
      // odd-width phone — so a 1px cell landed on fractional device
      // coordinates and every dot got antialiased across its neighbours. At a
      // group boundary that blend IS the ragged seam: the two colours mix over
      // the shared pixel column instead of meeting on it. Snapping both the
      // origin and the size means consecutive columns tile exactly, with no
      // gap and no overlap, so the seam is one hard vertical edge.
      const dpr = window.devicePixelRatio || 1;
      drawX = Math.round(drawX * dpr) / dpr;
      drawY = Math.round(drawY * dpr) / dpr;
      sq    = Math.max(1 / dpr, Math.round(sq * dpr) / dpr);
    }
    ctx.fillRect(drawX, drawY, sq, sq);
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
    // During @fold14 morph, drawPage12 overdraws at freeform positions.
    if ((p9.fold13ExtremeMorphT ?? 0) > 0) {
      return Math.ceil(orderArr.length / colsTotal) || 1;
    }
    const targetAlpha = 1;
    // orderArr is already sorted rank-ascending (p9SyncTopOrder), so every
    // settlers-or-below entry sits before every Right-wing/Haredi one — one
    // findIndex locates that boundary for the whole column, see p9PlaceDot's
    // tierIndex/tierCount.
    const lowRankCount = (() => {
      const i = orderArr.findIndex(e => P9_ACTOR_ORDER.indexOf(e.actor) > P9_ACTOR_ORDER.indexOf("settlers"));
      return i === -1 ? orderArr.length : i;
    })();
    orderArr.forEach((e, i) => {
      const r = Math.floor(i / colsTotal);
      const c = i % colsTotal;
      const x = rightAlign ? centerX - (c + 1) * CELL : rightX0 + c * CELL;
      const y = midY - (r + 1) * CELL;
      // Clipped at midY, the grid's own anchor — NOT at H - 16. On desktop the
      // two are equivalent (midY is 0.6H, far above H - 16, and no row can sit
      // at or below midY by construction), but on mobile midY is H minus the
      // 4px legit bar, so an H - 16 floor culled the bottom rows and opened a
      // ~12px gap between the columns and the bar they should be resting on.
      if (y < topY || y >= midY) return;
      p9PlaceDot(e, x, y, targetAlpha, i, orderArr.length, lowRankCount);
    });
    return Math.ceil(orderArr.length / colsTotal) || 1;
  }

  // The legitimate (below-the-line) grid keeps the same left/right screen-side
  // split the extreme grid above uses — left events only ever land left of
  // center, right events only right of center — but drops the *narrative*
  // clustering: within its own side, actors mix freely instead of grouping
  // into same-color blocks, built outward from the center, capped to a width
  // budget (mirrored from the gap kept against the floating 480px text
  // column) so it can
  // never grow into it. Sized per side, same fixed-slot reasoning as the
  // extreme grid above — reclassifying a category never reflows anyone
  // else's dot. The two sides butt up against each other with no gap.
  //
  // On mobile both of those last two properties invert: the grid is a 4px bar
  // in which actors DO cluster into contiguous colour segments, and a
  // reclassification reflows every surviving dot inward so the bar shrinks
  // from its outer end with no holes (p9LegitGeometry's `mode: "bar"` branch).
  // Those reflowing dots animate for free — they're already in p9.anim.from
  // (it's a copy of p9.lastPositions, which p9PlaceDot fills for legit dots
  // too), so they glide via p9PlaceDot's "existing dot repositioning" branch;
  // with no orderIndex passed that degrades to an unstaggered glide, which is
  // what we want here.
  const legitGeom = p9LegitGeometry(W, H);

  // At rest the mobile bar is NOT drawn dot-by-dot: ~14k 1px dots would all
  // have to tile perfectly for a colour boundary to read as one vertical
  // line, and any residual per-dot artifact (rounding, overdraw order) shows
  // up as a ragged seam. Instead each group segment is painted as ONE solid
  // rect (see the pass after drawJumbledBot) — a hard vertical edge by
  // construction. Per-dot painting remains only while p9.anim runs, where the
  // motion masks it; p9RunAnimLoop nulls p9.anim on completion and redraws,
  // so the handoff back to rects is automatic and lands on the same footprint.
  const barAtRest = legitGeom.mode === "bar" && !p9.anim;

  function drawJumbledBot(poolEvents, indexOf, side, botSet) {
    // Same fix as drawBandedCols above, same reason — literal 1 (or its
    // fold13 fade equivalent), not a read of ctx.globalAlpha.
    const targetAlpha = 1 - (p9.fold13OutT ?? 0);
    const bar = legitGeom.mode === "bar";
    // In bar mode several events share each cell (the bar has far fewer cells
    // than events), so whichever is drawn LAST is the one you see. Iterating the
    // pool in its own chronological order made that winner effectively random
    // with respect to group, which at every segment boundary sprinkled one
    // group's colour into its neighbour. p9.legitRank is inserted in rank order,
    // so iterating its keys instead resolves every shared cell in favour of the
    // higher-ranked group — consistently, on the same side of every boundary.
    const order = bar ? [...(p9.legitRank?.[side]?.keys() ?? [])] : poolEvents;
    // The legit grid's own dot size — in bar mode the packed cell, otherwise
    // the per-breakpoint legitSq (desktop P9_SQ; the mobile spread strip's
    // finer P9_LEGIT_SQ_SPREAD_M).
    const sq    = bar ? legitGeom.cell : p9Metrics().legitSq;
    order.forEach(e => {
      if (!botSet.has(e)) return;
      const pos = p9LegitPosOf(e, indexOf, side, legitGeom);
      if (!pos) return; // guards a stale cache
      // Offscreen dots are still PUT ON RECORD, only not painted. The legit
      // grid packs however many rows its events need (legitRows), which on the
      // V2 desktop strip is more rows than the 150px band can show — skipping
      // those outright left them absent from p9.lastPositions, so the next
      // drop's p9.anim.from had no start point for them and they snapped
      // straight into their extreme column instead of flying. Same reasoning
      // as the mobile bar's recordOnly use.
      const offscreen = pos.y < topY || pos.y >= H;
      p9PlaceDot(e, pos.x, pos.y, targetAlpha, undefined, undefined, undefined, sq,
                 barAtRest || offscreen);
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

  // The at-rest bar itself (see the barAtRest comment above). Column→x maths
  // in p9DrawBarRects mirrors p9LegitCellXY exactly — right side's column c
  // starts at midX + c*CELL; the left side's bar-mode numbering (0 =
  // innermost, per p9LegitPosOf's mirror) puts column c at midX - (c+1)*CELL,
  // so a segment's cols c0..c1 span [midX - c1*CELL, midX - c0*CELL].
  if (barAtRest) p9DrawBarRects(ctx, legitGeom, H, 1 - (p9.fold13OutT ?? 0));

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
  // width would float the label away from the squares it's labeling)
  // horizontally, but both sides sit on one shared vertical line — whichever
  // side's column is currently taller decides it — rather than each hovering
  // just above its own column independently, per explicit request. Hidden
  // entirely until something's actually been dropped into the extreme zone —
  // but once that's happened, both sides show a count, "0" included, rather
  // than only labeling whichever side happens to have events.
  {
    let leftCount, rightCount;
    if (p9.hoveredCategoryIdx !== null) {
      // Pill hovered — show only that category's dot count, no animation.
      const catFilter = e => CATEGORY_TO_IDX[e.category] === p9.hoveredCategoryIdx;
      leftCount  = leftTop.filter(catFilter).length;
      rightCount = rightTop.filter(catFilter).length;
    } else {
      const c = p9CurrentExtremeDisplayedCounts();
      leftCount  = c.left;
      rightCount = c.right;
    }

    // Suppress "0 / 0" while no dot has arrived yet (first drop, mid-flight) —
    // still a hard boundary (what the count *is*), but crossing it now fades
    // the labels in/out (p9CountLabelAnimate) instead of snapping, per
    // explicit feedback — the fade itself is p9CountLabelAlpha, updated here
    // since this is the one place both sides' counts are already resolved.
    const anyCount = leftCount > 0 || rightCount > 0;
    if (anyCount !== p9CountLabelWasOn) {
      p9CountLabelWasOn = anyCount;
      p9CountLabelAnimate(anyCount ? 1 : 0);
    }

    if (p9CountLabelAlpha > 0) {
      // 13px on mobile per explicit request (tried 14, settled on 13) — the
      // bare number is the column's only caption there, and 12px read too
      // small at arm's length.
      ctx.font         = mobile ? "400 13px 'Assistant', sans-serif"
                                : "400 12px 'Assistant', sans-serif";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle    = `rgba(17,17,17,${p9CountLabelAlpha * (1 - (p9.fold13OutT ?? 0))})`;

      // Mixed Hebrew+digit text in one fillText call left the visual order up
      // to each browser's own bidi heuristics (ctx.direction="ltr" didn't even
      // pin it down consistently) — drawing the word and the number as two
      // separately-positioned calls sidesteps bidi entirely, so "word left of
      // number" is guaranteed regardless of engine.
      const P9_EVENTS_WORD = "אירועים";
      const P9_EVENTS_GAP  = 4; // px between the word and the number
      function drawEventsCount(count, targetCenterX, y) {
        const numStr = String(count);
        // Mobile: the number with "אירועים" stacked UNDER it, per explicit
        // request — the narrow columns can't carry the whole line side by
        // side. Two single-script runs (digits / Hebrew), so no bidi problem
        // to dodge either. `y` is the block's BOTTOM baseline (the word), kept
        // 16px above the column top like the old single line; the number rides
        // one line above it, inside the room P9_COUNT_LABEL_ROOM_M reserves.
        if (mobile) {
          ctx.textAlign = "center";
          ctx.fillText(numStr, targetCenterX, y - P9_COUNT_LINE_H_M);
          ctx.fillText(P9_EVENTS_WORD, targetCenterX, y);
          return;
        }
        const wordWidth   = ctx.measureText(P9_EVENTS_WORD).width;
        const numWidth    = ctx.measureText(numStr).width;
        const leftX       = targetCenterX - (wordWidth + P9_EVENTS_GAP + numWidth) / 2;
        ctx.textAlign = "left";
        ctx.fillText(P9_EVENTS_WORD, leftX, y);
        ctx.fillText(numStr, leftX + wordWidth + P9_EVENTS_GAP, y);
      }
      // Shared y — the taller of the two sides' column heights decides the
      // one line both labels sit on (see this block's own opening comment).
      // Glided to (p9AnimateLeftCountPos/p9AnimateRightCountPos, above) —
      // this target can jump the instant a drop changes either side's row
      // count or column span, but the label itself shouldn't.
      // On mobile the columns can legally grow all the way up to topY, and the
      // tooltip→grid clearance explicitly reserves a label line's worth of room
      // above that ceiling (P9_COUNT_LABEL_ROOM_M inside p9ExtremeTopY) — so a
      // full column puts this baseline exactly at the top of that reserved
      // band. The clamp is a safety net for the same boundary, never the
      // normal path.
      // Mobile pulls the column 2 dot-rows (2 * P9_CELL_M = 4px) closer to the
      // label than desktop's 16px baseline gap, per explicit request.
      const countsGap  = mobile ? 16 - 2 * P9_CELL_M : 16;
      const countsYRaw = midY - Math.max(leftTopRows, rightTopRows) * CELL - countsGap;
      // Floor at the reserved band's top PLUS one line: countsY is the block's
      // bottom baseline, and the number line above it has to stay inside the
      // band too, clear of the docked frame.
      const countsY    = mobile
        ? Math.max(countsYRaw, topY - P9_COUNT_LABEL_ROOM_M + P9_COUNT_LINE_H_M)
        : countsYRaw;
      const leftPos  = p9AnimateLeftCountPos(centerX - leftRealCols * CELL / 2, countsY);
      const rightPos = p9AnimateRightCountPos(rightX0 + rightRealCols * CELL / 2, countsY);
      drawEventsCount(leftCount,  leftPos.x,  leftPos.y);
      drawEventsCount(rightCount, rightPos.x, rightPos.y);
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
  // Untapered per explicit request — one flat color/alpha along the whole
  // stroke (previously a linear gradient fading toward each end, still
  // scaled by lineAlpha below for fold13's fade-out). Color matches the
  // tray's own border (.page9-tray, style.css) exactly — rgba(90,90,90,0.45).
  // Drawn on both breakpoints. (It used to be skipped on mobile, back when the
  // tray sat immediately below midY and was itself the boundary — the tray now
  // lives in a band at the top and the legit half is a bottom strip, so the
  // divider is the only edge between the two grids there, same as desktop.)
  {
    const dividerStartX = W * (1 - page9LineT);
    const lineAlpha = 1 - (p9.fold13OutT ?? 0);
    // Mobile draws it a bit lighter (explicit request) — desktop keeps the
    // tray-border-matching 0.45.
    const baseAlpha = mobile ? 0.32 : 0.45;
    ctx.strokeStyle = `rgba(90,90,90,${baseAlpha * lineAlpha})`;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(dividerStartX, midY);
    ctx.lineTo(W, midY);
    ctx.stroke();
  }

  p9.lastPositions = posMap;

  // The picker's selection halo — dims every dot except the picked one. Drawn
  // after the dots and after posMap is published, since it reads that map to
  // find the hole. See p7DrawInspectScrim (page7.js).
  p7DrawInspectScrim(ctx, W, H);

  // The mobile event picker (p7InspectInit, page7.js) serves this fold too —
  // its state is kept in step from the owning fold's own draw, exactly as
  // @fold9 does it from doHitTest. Cheap and idempotent.
  p7InspectSync?.();
}

// The extreme-zone counts as currently *displayed* — mid-stagger this is the
// partial (arrived-so-far) count, not the full post-drop total. Used both by
// drawPage9's own label and by commitDropState when a new drop lands while a
// previous one's dots are still arriving: capturing baseLeft/baseRight from
// this instead of the raw p9ExtremeCountsNow() means the label continues
// from what's actually on screen rather than jumping straight to the
// previous category's full count the instant it's dropped.
function p9CurrentExtremeDisplayedCounts() {
  if (p9.anim && p9.anim.newEventStagger) {
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
    return { left: p9.anim.baseLeft + arrivedLeft, right: p9.anim.baseRight + arrivedRight };
  }
  return p9GetDisplayedCounts() || p9ExtremeCountsNow();
}

// Current extreme event counts derived directly from p9.sides — used by
// commitDrop to capture before/after counts around a sides update.
function p9ExtremeCountsNow() {
  let left = 0, right = 0;
  if (p7.ready) {
    for (const e of p7.leftEvents) {
      const idx = CATEGORY_TO_IDX[e.category];
      if (idx !== undefined && p9.sides[idx] === "above") left++;
    }
    for (const e of p7.rightEvents) {
      const idx = CATEGORY_TO_IDX[e.category];
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

// Moves all extreme-zone pills back to their tray rows and resets p9.sides.
// Called by main.js when the @fold14 reverse animation fully completes so the
// drag-and-drop state reverts to the @fold13 starting point.
// animate=true  → 3s dot migration (scroll-back from @fold13)
// animate=false → instant reset    (@fold14 reverse completion)
// The currently-extreme categories, newest-first. On desktop that's
// #page9ZoneAbove's own DOM order; on mobile pills never leave the tray (they
// highlight in place), so the .is-extreme flag is the record instead — order is
// meaningless there, since there is no dropped-pill stack to rebuild.
function p9DroppedIdxs() {
  const sel = isMobile()
    ? "#page9ZoneBelow .page9-pill.is-extreme"
    : "#page9ZoneAbove .page9-pill";
  return Array.from(document.querySelectorAll(sel)).map(p => Number(p.dataset.idx));
}

function p9ResetDrops(animate = false) {
  const zoneAbove = document.getElementById("page9ZoneAbove");
  if (!zoneAbove) return;
  const mobile = isMobile();
  const pills = mobile
    ? Array.from(document.querySelectorAll("#page9ZoneBelow .page9-pill.is-extreme"))
    : Array.from(zoneAbove.querySelectorAll(".page9-pill"));
  if (!pills.length) return;
  const trayRows = Array.from(document.querySelectorAll("#page9ZoneBelow .page9-tray-row"));
  const nowMs = performance.now();
  pills.forEach(pill => {
    const idx = Number(pill.dataset.idx);
    // Mobile: the pill is already in its own tray slot — only the selected
    // look and the classification come off.
    if (mobile) {
      pill.classList.remove("is-extreme");
      p9.sides[idx] = "below";
      return;
    }
    const rowCfg = p9TrayGrid()[idx];
    if (!rowCfg || !trayRows[rowCfg.row - 1]) return;
    trayRows[rowCfg.row - 1].appendChild(pill);
    p9.sides[idx] = "below";
  });
  p13SyncGateVisibility?.();
  p9CountAnim = null;
  if (animate && p9.lastPositions && p9.lastPositions.size > 0) {
    p9.anim = { from: new Map(p9.lastPositions), start: nowMs, duration: 3000 };
    if (currentPage === 10) p9RunAnimLoop();
  } else {
    p9.anim = null;
  }
}

// Reverses the *visual* effect of p9ResetDrops(true) — moves the given
// categories' pills from the tray back into the extreme zone and restores
// p9.sides, so scrolling back into @fold13 (main.js's page9UpdateFromScroll)
// puts the dots/pills right back where the user left them, rather than
// requiring them to be re-dropped by hand. `idxs` must be in the DOM order
// #page9ZoneAbove had right before p9ResetDrops ran (most-recently-dropped
// pill first) — processed oldest-first here, re-prepending each one, so the
// stack rebuilds in that same visual order.
function p9RestoreDrops(idxs) {
  if (!idxs || !idxs.length) return;
  const zoneAbove = document.getElementById("page9ZoneAbove");
  if (!zoneAbove) return;
  const mobile = isMobile();
  const nowMs = performance.now();
  [...idxs].reverse().forEach(idx => {
    const pill = document.querySelector(`#page9ZoneBelow .page9-pill[data-idx="${idx}"]`);
    if (!pill) return;
    // Mobile: re-flag in place rather than moving the pill into the (hidden)
    // extreme zone — see p9DroppedIdxs.
    if (mobile) pill.classList.add("is-extreme");
    else zoneAbove.prepend(pill);
    p9.sides[idx] = "above";
  });
  p13SyncGateVisibility?.();
  if (p9.lastPositions && p9.lastPositions.size > 0) {
    p9.anim = { from: new Map(p9.lastPositions), start: nowMs, duration: 3000 };
    if (currentPage === 10) p9RunAnimLoop();
  }
}

// ── Category panel — real DOM/HTML in the text column. Drag a pill between the
// "extreme" and "legitimate" zones to reclassify it; p9.sides drives which half of
// the canvas dot-grid (drawn above) each category's events land in. ──
// Set by p9BuildPanel to its own nested p9MeasureTrayLayout, so the resize
// hook further down can re-measure (and re-apply the active tray grid) when a
// resize crosses the 600px breakpoint and flips the layout variant.
let p9RemeasureTray = null;

// Keeps `page9-layout-v2` on .page9-sticky in sync with p9IsV2() — the class
// every V2 CSS rule is scoped under. Never present under 600px, so the mobile
// layout can't be reached by a V2 rule.
function p9SyncLayoutV2Class() {
  const panel = document.querySelector(".page9-sticky");
  if (!panel) return;
  const on = p9IsV2();
  if (panel.classList.contains("page9-layout-v2") === on) return false;
  panel.classList.toggle("page9-layout-v2", on);
  return true; // changed — caller re-measures
}

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
  const trayRows = [1, 2].map(rowNum => {
    const rowEl = document.createElement("div");
    rowEl.className = "page9-tray-row";
    zoneBelow.appendChild(rowEl);
    return rowEl;
  });

  // Moves the pill chip itself into its new zone right away, regardless of
  // whether a previous drop's dot animation is still playing — a drop should
  // always visibly dock the instant it happens. Only the dot/count state
  // change below (commitDropState) waits its turn; see commitDrop.
  function placePillInZone(pill, targetZone) {
    if (targetZone === zoneAbove) {
      // prepend so the newest card becomes the top of the stacked column.
      targetZone.prepend(pill);
      // If the zone is in its scrolling state (short viewport, stack taller
      // than the clamped box — see overflow-y in style.css's V2 zone rule),
      // snap to the top so the pill that just landed is the one on screen.
      // A no-op whenever the stack fits (scrollTop is already 0).
      targetZone.scrollTop = 0;
    } else {
      const idx = Number(pill.dataset.idx);
      trayRows[p9TrayGrid()[idx].row - 1].appendChild(pill);
    }
  }

  // Drops that land while a previous drop's dot animation (p9.anim) is still
  // playing no longer wait their turn — the pill docks immediately
  // (placePillInZone, above) and its dot/count state change (below) starts
  // right away too, redirecting whatever's still mid-flight from the
  // previous drop toward the newly-recomputed layout instead of finishing it
  // first. p9PlaceDot's "from" is always the *currently drawn* (interpolated)
  // position, never a stale target, so replacing p9.anim mid-flight retargets
  // smoothly rather than snapping — see the "from" comment there.
  function commitDrop(pill, targetZone) {
    placePillInZone(pill, targetZone);
    // A drop that doesn't actually reclassify — an extreme pill released back
    // in the extreme zone (or a tray pill back in the tray) — only re-docks
    // the chip. Running commitDropState anyway would replay the whole
    // drop-into-extreme sequence (counts re-baselined, order arrays resynced,
    // p9.anim reseeded) for dots that aren't going anywhere, visibly
    // scrambling any animation still in flight.
    const side = targetZone === zoneAbove ? "above" : "below";
    if (p9.sides[Number(pill.dataset.idx)] === side) return;
    commitDropState(pill, targetZone);
  }

  function commitDropState(pill, targetZone) {
    const newCatIdx = Number(pill.dataset.idx);
    const nowMs     = performance.now();

    if (targetZone === zoneAbove) {
      // ── Dropping into extreme ──────────────────────────────────────────────
      // Dots arrive one by one in column order; the count increments as each lands.
      // Reads the currently *displayed* counts, not the raw p9.sides-derived
      // total — if a previous drop's dots are still mid-stagger, that total
      // would already silently include them in full, jumping the label ahead
      // of what's actually on screen the instant this new drop lands.

      // Captured before p9.anim is reassigned below — true when this drop
      // lands while a previous drop's dot animation (either direction) is
      // still actively running, in which case the new dots fly in
      // concurrently with the existing-dot reposition instead of waiting for
      // it (see phase2Start below). A plain drop, landed only after the
      // previous animation already finished, keeps the normal sequential
      // "reposition first, then fly in" behavior.
      const wasInterrupting = !!p9.anim;

      const { left: baseLeft, right: baseRight } = p9CurrentExtremeDisplayedCounts();

      p9.sides[newCatIdx] = "above";
      p13SyncGateVisibility?.();

      const prevColsSticky = p9.extremeColsSticky || 1;

      // Sync the order arrays now (before the draw loop does it) so stagger
      // ranks already reflect the new events' final column positions.
      const makeSet = (pool) => new Set(pool.filter(e => {
        const i = CATEGORY_TO_IDX[e.category];
        return i !== undefined && p9.sides[i] === "above";
      }));
      p9SyncTopOrder(p9.leftTopOrder,  makeSet(p7.leftEvents));
      p9SyncTopOrder(p9.rightTopOrder, makeSet(p7.rightEvents));

      // Does this drop actually widen the shared column count? A new
      // category's actor-rank insertion can nudge a handful of existing
      // dots' index without widening it at all (e.g. settlers-rank events
      // inserting just before a small higher-rank tail) — that shift is
      // small enough to be visually negligible, so it does NOT count here;
      // only an actual column-count growth (a real, visible reflow) does.
      // If it doesn't grow, there's nothing worth making the new dots wait
      // on, so state 1 (see wasInterrupting above) skips the ~2.2s wait
      // before they start flying in below instead of sitting on a
      // dead-looking screen for it — per explicit feedback ("if the column
      // doesn't get wider, nothing should appear to wait"). State 2's
      // phase2Start is unaffected either way (already always immediate) —
      // but state 2's totalDur below borrows this same needsReposition read
      // to stop flooring the *overall* animation length at REPOSITION_MS
      // when nothing actually needs that ~2.2s window, so p9.anim doesn't
      // linger alive well past the point everything has visibly settled.
      // REPOSITION_MS/repositionMs/topDotArrivesAt themselves stay
      // unconditional in both states (those handful of nudged dots still
      // reposition via the always-running "existing dot" branch in
      // p9PlaceDot, just concurrently with the new dots instead of gating
      // them).
      const extremeRowsNow = p9ExtremeRowsFor(p9.lastH);
      const neededColsNow  = Math.max(
        Math.ceil(p9.leftTopOrder.length  / extremeRowsNow) || 1,
        Math.ceil(p9.rightTopOrder.length / extremeRowsNow) || 1,
      );
      const needsReposition = neededColsNow > prevColsSticky;

      // Existing extreme dots reposition (settlers-rank and below settle
      // quickly; high-rank dots glide up over the full reposition+arrival
      // window, see topDotArrivesAt below) to make room for the new dots.
      // On a plain drop (not interrupting anything), new dots wait for this
      // to finish first — phase2Start below — same "make room, then fly in"
      // sequence as always. On a drop that *interrupts* a still-running
      // animation, new dots instead start flying in immediately, running
      // concurrently with this reposition instead of waiting for it — see
      // wasInterrupting above and phase2Start below. Skipped entirely (0ms)
      // on the very first drop (nothing to reposition). Also the window a
      // dot interrupted mid-flight by an overlapping drop repositions in
      // (see p9PlaceDot's "existing dot" branch) — those can still have most
      // of a long legit-to-extreme journey left to cover, so this needs real
      // travel time, not just enough to nudge an already-settled column up a
      // few rows. Raised from 1200 (read as a rushed snap for that case) per
      // explicit feedback.
      //
      // State 2 (interrupting) gets its own, longer value than state 1's
      // 2200ms — per explicit feedback, the already-placed dots' own
      // rearrangement read too fast while running concurrently with a new
      // pill's dots flying in. State 1's 2200ms (below) is untouched.
      const STATE1_REPOSITION_MS = 2200;
      const STATE2_REPOSITION_MS = 3400;
      const REPOSITION_MS = (baseLeft > 0 || baseRight > 0)
        ? (wasInterrupting ? STATE2_REPOSITION_MS : STATE1_REPOSITION_MS)
        : 0;
      // The 4 categories with by far the most events dataset-wide
      // (הפגנה לא אלימה idx0/4625, פגיעה ברכוש idx8/2943, תקיפה בנשק קר
      // idx3/2136, תקיפה פיזית idx5/1907 — see CATEGORY_TO_IDX; the next
      // largest, חסימת כביש, is only 909) fly in a bit faster than every
      // other category's drop, per explicit feedback. Scales both the
      // per-dot travel time and the stagger interval, so the whole cascade
      // finishes proportionally sooner rather than just compressing the
      // stagger (which would bunch the dots up instead of reading as an
      // across-the-board faster version of the same motion).
      const FAST_ARRIVAL_CATEGORIES = new Set([0, 3, 5, 8]);
      const FAST_ARRIVAL_FACTOR     = 0.75;
      const arrivalSpeedFactor = FAST_ARRIVAL_CATEGORIES.has(newCatIdx) ? FAST_ARRIVAL_FACTOR : 1;

      const BASE_TRAVEL_MS     = 600 * arrivalSpeedFactor;
      const ARRIVAL_STAGGER_MS = 4 * arrivalSpeedFactor;    // ms/dot at the anchor count
      const ANCHOR_COUNT       = 1880; // תקיפה פיזית right-side count (1875) — calibration reference

      const newInLeft  = p9.leftTopOrder.filter(e => CATEGORY_TO_IDX[e.category] === newCatIdx);
      const newInRight = p9.rightTopOrder.filter(e => CATEGORY_TO_IDX[e.category] === newCatIdx);
      const maxNew     = Math.max(newInLeft.length, newInRight.length, 1);

      // sqrt scale: anchor and larger stay at 4ms/dot; smaller counts get proportionally
      // slower stagger so they don't feel too fast relative to the anchor.
      const effectiveStagger = ARRIVAL_STAGGER_MS * Math.max(1, Math.sqrt(ANCHOR_COUNT / maxNew));

      // Map stores each new dot's *arrival* timestamp (already offset by
      // phase2Start). phase2Start is nowMs+REPOSITION_MS normally (wait for
      // reposition to finish), just nowMs when interrupting (start right
      // away, concurrent with reposition — see wasInterrupting above), OR
      // also just nowMs on a plain, non-interrupting drop when
      // needsReposition is false — nothing would be visibly repositioning
      // for the new dots to wait on in that case, so state 1 skips the wait
      // instead of sitting on an apparently-dead screen for it.
      const stagger       = new WeakMap();
      // Plain-array mirror of stagger's keys — a WeakMap can't be iterated,
      // but a *later* interrupting drop needs to enumerate "everything
      // currently mid-flight" to carry it forward (see wasInterrupting below
      // on the next drop). Recorded for every drop (both states), since a
      // state-1 drop's own new dots can just as easily still be mid-flight
      // when a *later* drop interrupts them — this array itself changes
      // nothing about what state 1 looks like, only what a future state-2
      // drop can see.
      const staggerEvents = [];
      const phase2Start  = wasInterrupting || !needsReposition ? nowMs : nowMs + REPOSITION_MS;
      newInLeft.forEach( (e, i) => { stagger.set(e, phase2Start + BASE_TRAVEL_MS + effectiveStagger * i); staggerEvents.push(e); });
      newInRight.forEach((e, i) => { stagger.set(e, phase2Start + BASE_TRAVEL_MS + effectiveStagger * i); staggerEvents.push(e); });

      // How long the new dots alone take to finish arriving, from
      // phase2Start — used both for the overall animation duration below and
      // to pin topDotArrivesAt (when high-rank existing dots are timed to
      // finish repositioning).
      const newArrivalDur = BASE_TRAVEL_MS + effectiveStagger * (maxNew - 1);

      // State 2 only: carry forward any dots from the *interrupted*
      // animation that were themselves still mid-flight (either a still-
      // arriving new drop, or dots already carried forward once before by
      // that animation) — added to *this* drop's own stagger map with their
      // original arrival time preserved untouched, so they keep gliding
      // smoothly toward their (possibly retargeted) spot instead of falling
      // into the "existing dot" bucket below, which assumes a stationary
      // start and would otherwise freeze them until their tier-local
      // reposition slot comes up — read as a visible stutter right when the
      // new pill lands, per explicit feedback. State 1 never has a mid-flight
      // predecessor to carry forward from (it only ever fires once the
      // previous animation has fully finished), so this is a no-op there.
      let maxCarriedArrivalDur = 0;
      if (wasInterrupting && p9.anim.newEventStagger && p9.anim.staggerEvents) {
        for (const e of p9.anim.staggerEvents) {
          const at = p9.anim.newEventStagger.get(e);
          if (at !== undefined && at > nowMs && !stagger.has(e)) {
            stagger.set(e, at);
            staggerEvents.push(e);
            maxCarriedArrivalDur = Math.max(maxCarriedArrivalDur, at - nowMs);
          }
        }
      }

      // Sequential when not interrupting and something actually needs to
      // reposition (today's formula, unchanged); when nothing needs
      // repositioning, there's no separate reposition leg to sum/floor in
      // (state-1's needsReposition affordance, ported here — see
      // needsReposition above) — the whole animation is just as long as the
      // new dots take. Interrupting AND needsReposition still floors on
      // REPOSITION_MS (whichever of the two finishes last), since the
      // existing-dot reposition genuinely has its own ~2.2s of real travel
      // to cover there, same as state 1's needsReposition-true branch. Also
      // floored against maxCarriedArrivalDur (state 2 only, 0 otherwise) so
      // a carried-forward dot's own original, untouched arrival time is
      // never cut off by this drop's own (possibly shorter) duration.
      const totalDur = wasInterrupting
        ? Math.max(needsReposition ? Math.max(newArrivalDur, REPOSITION_MS) : newArrivalDur, maxCarriedArrivalDur)
        : needsReposition ? REPOSITION_MS + newArrivalDur : newArrivalDur;

      p9.anim = {
        from: new Map(p9.lastPositions),
        start: nowMs,
        duration: totalDur,
        repositionMs: REPOSITION_MS,
        // phase2Start resolved once here (not derived from start+repositionMs
        // elsewhere) since it no longer has a fixed relationship to those —
        // see p9PlaceDot's "new dot" branch, which reads this directly.
        phase2Start,
        topDotArrivesAt: REPOSITION_MS > 0 ? phase2Start + newArrivalDur : undefined,
        newCategoryIdx: newCatIdx,
        newEventStagger: stagger,
        staggerEvents,
        baseLeft,
        baseRight,
      };
      p9CountAnim = null; // stagger drives the count directly — no separate count-up
      if (currentPage === 10) p9RunAnimLoop();

    } else {
      // ── Dropping back into legit ───────────────────────────────────────────
      // Dots migrate over 3 s; count ticks down as they leave (see COUNT_DELAY).

      const prevDisplayed = p9GetDisplayedCounts();
      const prevActual    = p9ExtremeCountsNow();
      const fromLeft  = prevDisplayed ? prevDisplayed.left  : prevActual.left;
      const fromRight = prevDisplayed ? prevDisplayed.right : prevActual.right;

      p9.sides[newCatIdx] = "below";
      p13SyncGateVisibility?.();

      const DOT_DURATION = 3000;
      p9.anim = { from: new Map(p9.lastPositions), start: nowMs, duration: DOT_DURATION };
      if (currentPage === 10) p9RunAnimLoop();

      // Ticks down WHILE the dots leave, not after — waiting out the full 3s
      // flight before an 800ms count-down (and only then the label fade for
      // an emptied zone) read as the numbers hanging around for ~4s past the
      // drop, per explicit feedback. The short start delay keeps it causal:
      // the dots visibly launch first, then the count follows them down.
      const COUNT_DELAY = 300;
      const newCounts  = p9ExtremeCountsNow();
      const thisAnim   = p9CountAnim = {
        fromLeft, toLeft: newCounts.left,
        fromRight, toRight: newCounts.right,
        start: nowMs + COUNT_DELAY,
        duration: 800,
      };
      setTimeout(() => { if (p9CountAnim === thisAnim) p9CountRunLoop(); }, COUNT_DELAY);
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
    // Deliberately the legacy grid, not p9TrayGrid(): this build loop runs at
    // page9.js's own top level, before js/core.js defines isMobile() (which
    // p9IsV2 needs). p9ApplyTrayGrid, run from the DOMContentLoaded measure,
    // re-assigns the column from the ACTIVE grid a moment later.
    pill.style.gridColumn = String(P9_TRAY_GRID[idx].col);
    // Mobile's tray is one nowrap FLEX row (display: contents wrappers), where
    // grid-column is inert and DOM order would rule — putting idx 0 (הפגנה לא
    // אלימה) first. `order` re-sequences the flex row to the desktop reading
    // order (V2's single-row column order), per explicit instruction; both
    // desktop grids ignore it because every pill is explicitly placed.
    pill.style.order = String(P9_TRAY_GRID_V2[idx].col);
    // Desktop V2 pop-in index (teacher review 2026-09-03, H2): the pills pop
    // in one after another from the RIGHT end of the band (col 1, the first
    // in RTL reading order) to the left, the band's rule drawing under them
    // in step — see the .page9-layout-v2.engaged rules in style.css, which
    // read this as the per-pill transition delay.
    pill.style.setProperty("--p9-pop-i", String(P9_TRAY_GRID_V2[idx].col - 1));

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

    // Mobile-only ⓘ affordance: touch has no hover, so the category description
    // that desktop reveals by hovering the pill needs an explicit target. Built
    // for every pill and hidden by CSS on desktop (see .page9-pill-info), so
    // crossing the breakpoint on a resize needs no rebuild. Its taps are caught
    // in the capture phase by p9CategoryTooltipInit — it sits INSIDE the pill,
    // whose own bubble-phase click classifies.
    const infoEl = document.createElement("button");
    infoEl.type        = "button";
    infoEl.className   = "page9-pill-info";
    infoEl.textContent = "i";
    infoEl.setAttribute("aria-label", `מידע על ${label}`);
    pill.appendChild(infoEl);

    // Manual pointer-based dragging instead of native HTML5 drag-and-drop —
    // once a native drag starts, the OS/browser takes over rendering the
    // cursor and CSS `cursor` on the dragged element has no effect for the
    // rest of the gesture (a real cross-browser limitation, not a bug here).
    // Doing it by hand keeps the cursor under our control the whole time —
    // set on <body> rather than the pill, since the pointer roams over many
    // different elements (other pills, drop zones, the canvas) during the drag.
    // Mobile: tapping replaces dragging entirely, per explicit request. The
    // pill never leaves #page9ZoneBelow — it toggles .is-extreme in place and
    // commits through commitDropState, the same and only writer of
    // p9.sides[idx] the drag path uses, so every downstream animation
    // (including the finalized state-1 drop) is reached identically.
    // #page9ZoneAbove is hidden by CSS under the breakpoint, so a "dropped"
    // pill has nowhere to go and no ghost/hit-testing is needed.
    pill.addEventListener("click", () => {
      if (!isMobile()) return;
      const goingExtreme = !pill.classList.contains("is-extreme");
      pill.classList.toggle("is-extreme", goingExtreme);
      commitDropState(pill, goingExtreme ? zoneAbove : zoneBelow);
    });

    pill.addEventListener("pointerdown", e => {
      if (e.button !== 0) return;
      // Drag (and desktop click — see `moved` below) is desktop-only; the
      // click handler above owns mobile.
      if (isMobile()) return;
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
      // Origin marker for CSS: a drag OUT of the extreme zone highlights the
      // legit band below as the destination (and suppresses the extreme
      // zone's own dragging fill) — see the .dragging-from-above rules in
      // style.css's V2 block.
      panel.classList.toggle("dragging-from-above", draggingFromAbove);
      document.body.style.cursor = "grabbing";
      pill.setPointerCapture(e.pointerId);
      // Clears any active pill-hover highlight (see setPillHover's own
      // comment, p9HoverInit) — the pointer was almost certainly resting on
      // this exact pill just now (that's how it got grabbed), so without
      // this it stays visually "hovered" while invisible for the rest of
      // the drag.
      p9.setPillHover?.(null);
      // …but a pill grabbed OUT of the extreme zone keeps the canvas side of
      // that hover (dim + category counts) frozen for the whole drag — see
      // p9.holdPillHoverDim (p9HoverInit). Only the DOM pill highlight
      // clears (the pill itself is invisible mid-drag anyway).
      if (draggingFromAbove) p9.holdPillHoverDim?.(Number(pill.dataset.idx));
      // Starting the drag can re-fire a synthetic pointerover on this same
      // pill (see p9CategoryTooltipInit's own "dragging" guard) instead of
      // ever reaching #page9ZoneBelow's pointerleave — hide the category
      // tooltip explicitly rather than leaving it stuck visible mid-drag.
      document.getElementById("page9CatTooltip")?.classList.remove("is-visible");

      let activeDropTarget = null;
      // Click-to-classify (teacher review 2026-09-03, I1): a press that never
      // travels more than P9_CLICK_SLOP_PX before release is a click, not a
      // drag, and classifies the pill into the OTHER zone through the exact
      // same commitDrop path a drop takes — the finalized state-1 animation
      // is reached identically. Both gestures stay supported.
      let moved = false;

      function onMove(e2) {
        if (!moved && Math.hypot(e2.clientX - e.clientX, e2.clientY - e.clientY) > P9_CLICK_SLOP_PX) moved = true;
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
        panel.classList.remove("dragging-from-above");
        if (activeDropTarget) activeDropTarget.el.classList.remove(activeDropTarget.overClass);
        if (!moved) {
          // A click: flip the pill to the opposite zone (see `moved` above).
          commitDrop(pill, draggingFromAbove ? zoneBelow : zoneAbove);
        } else if (activeDropTarget) {
          commitDrop(pill, activeDropTarget.targetZone);
        }
        // Release the held hover-dim from drag-start (extreme-origin drags
        // only — see holdPillHoverDim above). After a real drop the fade-out
        // runs under the dot-migration animation; after a cancelled drag the
        // pointer, if still resting on the pill, simply re-hovers it.
        if (draggingFromAbove) p9.releasePillHoverDim?.();
      }

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });

    trayRows[P9_TRAY_GRID[idx].row - 1].appendChild(pill); // every category starts out "legitimate" — legacy grid here, see the gridColumn note above
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
  // (Re-)applies the ACTIVE tray grid to every pill still sitting in the tray:
  // its permanent column, and its row wrapper. Called from p9MeasureTrayLayout
  // so a resize that flips the layout variant (crossing 600px turns V2 off and
  // back on) re-lays the tray instead of leaving it in the other layout's
  // slots. Pills currently docked in #page9ZoneAbove are left alone — they get
  // their slot back from p9TrayGrid() when they're dropped back.
  function p9ApplyTrayGrid() {
    const grid = p9TrayGrid();
    document.querySelectorAll("#page9ZoneBelow .page9-pill").forEach(pill => {
      const idx  = Number(pill.dataset.idx);
      const slot = grid[idx];
      if (!slot) return;
      pill.style.gridColumn = String(slot.col);
      const row = trayRows[slot.row - 1];
      if (row && pill.parentElement !== row) row.appendChild(pill);
    });
  }

  function p9MeasureTrayLayout() {
    p9ApplyTrayGrid();
    // Release the fixed grid tracks BEFORE measuring: the tracks written at the
    // bottom of this function are baked pixel widths from the previous run, and
    // a resize that grows the pill font (crossing 1600px upward flips 18px→20px,
    // crossing 600px flips 16px→20px) leaves labels wider than their old track —
    // they wrap, and offsetWidth then reads the clamped wrapped width, re-baking
    // the too-narrow columns forever. Clearing first lets every pill lay out at
    // its natural one-line width for the reads below; the tracks are re-applied
    // from those fresh numbers at the end as before.
    trayRows.forEach(rowEl => {
      rowEl.style.gridTemplateColumns = "";
      rowEl.style.height = "";
    });
    // Tight tier: when even the ≤1600px 18px row is wider than the viewport,
    // the centered row runs off both screen edges — drop the pills to 16px
    // (.page9-pills-tight in style.css). Decided by MEASURING the row at the
    // un-tight font, never by a hand-picked breakpoint: the overflow point is
    // a function of ten Hebrew labels' rendered widths plus gaps, and a px
    // twin of that here would rot the first time a label changes. The class
    // is removed before the read so the decision is always made at the
    // regular size in both directions — measuring at 16px on the way back up
    // would fit again and flap. Mirrored onto <body> for the drag ghost,
    // which lives there, outside the panel's class scope (same reason the
    // ≤1600px media rule lists the ghost separately). This read happens
    // before the width reads below, so every measurement they bake reflects
    // the font the pills will actually wear. nowrap is forced for the read:
    // tray pills can wrap their labels, so under a too-narrow viewport the
    // grid compresses to fit instead of overflowing and offsetWidth would
    // never exceed the screen — nowrap makes the row take its true
    // one-line-per-pill width, which is the width being judged. The nowrap
    // is held until AFTER the track bake below, not just for this read: the
    // same compression would otherwise feed the per-pill offsetWidth reads
    // wrapped (narrower, taller) boxes, and the baked tracks would seal that
    // wrap in permanently — the exact too-narrow-columns trap the clearing
    // comment above describes, arriving through viewport pressure instead of
    // stale tracks. Desktop only: mobile's flex row wraps by flex-wrap and
    // its pills are already nowrap by CSS.
    const mobile = isMobile();
    if (!mobile) trayRows.forEach(rowEl => { rowEl.style.whiteSpace = "nowrap"; });
    panel.classList.remove("page9-pills-tight");
    const pillsTight = p9IsV2() && trayRows[0].offsetWidth > document.documentElement.clientWidth;
    panel.classList.toggle("page9-pills-tight", pillsTight);
    document.body.classList.toggle("page9-pills-tight", pillsTight);

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
    p9TrayGrid().forEach((slot, idx) => {
      rowColWidths[slot.row - 1][slot.col - 1] = pillByIdx[idx].offsetWidth;
    });
    // +2px: offsetWidth rounds to the nearest whole CSS px, but the actual
    // sub-pixel layout width (what wrapping is decided against) can come out
    // a hair over that under some device-pixel-ratio roundings — sizing the
    // column to *exactly* the rounded value occasionally wrapped a label to
    // two lines. 2px is well below "spread out" territory but always covers
    // the gap.
    // Mobile rows are a wrapping flexbox, not a grid (style.css) — a fixed
    // track list and a one-line height would both fight the wrap, so neither
    // inline value is written under the breakpoint. Cleared rather than merely
    // skipped, so crossing the breakpoint on a resize doesn't leave a stale one.
    trayRows.forEach((rowEl, i) => {
      rowEl.style.gridTemplateColumns = mobile ? "" : rowColWidths[i].map(w => `${w + 2}px`).join(" ");
      rowEl.style.height = mobile ? "" : `${pillHeight}px`;
      // Release the measurement nowrap only now that the tracks are baked at
      // natural one-line width (+2px) — with those tracks in place the labels
      // fit on one line without it.
      rowEl.style.whiteSpace = "";
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
    let stackContentHeight = P9_CATEGORIES.length * pillHeight + (P9_CATEGORIES.length - 1) * zoneGap;
    let stackContentWidth  = p9.maxPillWidth;
    const stackHeight = stackContentHeight + zonePaddingY + P9_ZONE_DRAG_BORDER * 2;
    const stackWidth  = stackContentWidth + zonePaddingX + P9_ZONE_DRAG_BORDER * 2;
    zoneAbove.style.setProperty("--page9-zone-stack-height", `${stackHeight}px`);
    zoneAbove.style.setProperty("--page9-zone-stack-width", `${stackWidth}px`);
    // Read by #page9ZoneAbove .page9-pill (style.css) — every dropped pill is
    // forced to this same width (the tray's own longest label, הפגנה לא אלימה)
    // rather than sizing to its own shorter text, so every dropped pill's
    // top/bottom line (spanning the full pill width) lines up at one shared
    // standard width instead of each being only as wide as its own label.
    zoneAbove.style.setProperty("--page9-max-pill-width", `${p9.maxPillWidth}px`);

    // V2 stacks the drop zone UNDER the pill row, so its CSS `top` needs the
    // tray's real measured height. Published as a var rather than duplicated
    // as a hand-tuned length (the old layout's `bottom: 28.78vh` twin of
    // P9_MID is exactly the trap this avoids).
    panel.style.setProperty("--page9-tray-height", `${document.querySelector(".page9-tray")?.offsetHeight || 0}px`);
    panel.style.setProperty("--p9-v2-tray-top", `${p9TrayTopV2()}px`);
    // The legit band's height, so the drop-zone wrap's CSS can end above the
    // divider without a second hand-synced copy of P9_LEGIT_H_V2.
    panel.style.setProperty("--p9-v2-legit-h", `${p9LegitHV2()}px`);
  }

  // The tray ships at opacity:0 (style.css) because its resting hidden
  // transform is -100% of its OWN height, and that height isn't real until the
  // measure above has run against the loaded font — until then the band doesn't
  // clear the edge and paints over @fold1 on a refresh. Lifting the gate is
  // deferred one frame past the measure so the corrected transform is committed
  // before the tray can be painted at all.
  function p9RevealTray() {
    p9MeasureTrayLayout();
    requestAnimationFrame(() => {
      document.querySelector(".page9-tray")?.classList.add("is-measured");
    });
  }
  // Deferred to DOMContentLoaded, not run inline: the measure now branches on
  // isMobile(), which lives in js/core.js — a *later* <script> in
  // project.html. Function declarations don't hoist across separate classic
  // scripts, so calling it during page9.js's own top-level run would throw.
  // The variant class has to land BEFORE the first measure — the V2 CSS is
  // what decides the tray's height/width, which the measure then reads back.
  document.addEventListener("DOMContentLoaded", () => {
    p9SyncLayoutV2Class();
    p9MeasureTrayLayout();
  });
  p9RemeasureTray = p9MeasureTrayLayout; // see the resize hook below
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(p9RevealTray);
  // No document.fonts at all (or a font that never resolves): don't strand the
  // tray invisible forever — window load is late enough that the DOMContentLoaded
  // measure above has certainly run.
  else addEventListener("load", p9RevealTray);
}

p9BuildPanel();

// The header subtitle names the gesture, and the gesture differs by
// breakpoint — drag on desktop, tap on mobile. Kept in JS rather than as two
// CSS-toggled <p>s so there is exactly one copy of each string, and re-synced
// on resize so crossing the breakpoint corrects it live.
const P9_SUBTITLE_DESKTOP = "גררו סוגי פעולות הנחשבות קיצוניות בעיניכם";
const P9_SUBTITLE_MOBILE  = "בחרו סוגי פעולות הנחשבות קיצוניות בעיניכם";
function p9SyncSubtitle() {
  const el = document.querySelector(".page9-header-subtitle");
  if (el) el.textContent = isMobile() ? P9_SUBTITLE_MOBILE : P9_SUBTITLE_DESKTOP;
}
// Same cross-script ordering caveat as p9MeasureTrayLayout above — isMobile()
// isn't defined yet while page9.js is still running.
document.addEventListener("DOMContentLoaded", p9SyncSubtitle);
window.addEventListener("resize", p9SyncSubtitle);
// A resize that crosses the 600px breakpoint flips the layout variant (one
// tray row vs two, a different measured height); and even within V2, the
// header's --card-top is a vh fraction, so p9TrayTopV2's floor moves with the
// viewport. Both are re-resolved by re-measuring, so just always do it.
window.addEventListener("resize", () => {
  p9SyncLayoutV2Class();
  p9RemeasureTray?.();
});

// Hover tooltip for a single event dot — date + Hebrew description. Every
// event has its own real `descHeMedium` (events.json/server.py, sourced from
// Events_with_description_he_medium.xlsx), so every dot is hoverable.
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
      // updateGroups (main.js) re-reads p9.hoverDimT/hoveredCategoryIdx to dim
      // the 8 fold6 squares in step with every other canvas dot — they're not
      // part of drawPage9's own dot loop, so draw() alone doesn't touch them.
      if (currentPage === 10) { draw(); if (typeof updateGroups === "function") updateGroups(); }
      if (p9.hoverDimT !== hoverDimTarget) {
        hoverDimRaf = requestAnimationFrame(step);
      } else {
        hoverDimRaf = null;
        if (p9.hoverDimT === 0) {
          p9.hoverDimCategoryIdx = null;
          if (currentPage === 10) { draw(); if (typeof updateGroups === "function") updateGroups(); }
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
  // Exposed on the shared p9 object so p9BuildPanel's pointerdown handler
  // (a separate closure — see its own call to this below) can clear the
  // hover highlight the instant a drag starts. Grabbing a pill almost always
  // means the pointer was already resting on it (that's how it got hovered
  // enough to grab), so without this the now-invisible (.dragging,
  // opacity:0) pill stays "is-hover-highlighted" — which style.css's
  // sibling-lookahead hover rule then uses to darken a neighboring pill's
  // own line for a highlight nobody can actually see.
  p9.setPillHover = setPillHover;
  // Holds the canvas-side half of a pill hover (dim + category-only counts)
  // WITHOUT a pill being DOM-hovered — used by the drag handler when a pill
  // is grabbed OUT of the extreme zone: releasing the hover on grab made the
  // dots un-dim and the count labels jump back to totals the instant the drag
  // started, when nothing has actually been reclassified yet. The hold keeps
  // that state frozen for the whole drag; pointerup releases it via
  // setPillHover(null) (a real drop then animates on top of the fade-out).
  p9.holdPillHoverDim = idx => {
    p9.hoveredCategoryIdx = idx;
    p9.hoverDimCategoryIdx = idx;
    p9HoverDimAnimate(1);
  };
  // Explicit counterpart for the drag handler's pointerup: setPillHover(null)
  // can't release the hold — hoveredCatPill is already null (the hold sets
  // p9.hoveredCategoryIdx directly, bypassing setPillHover), so its
  // `pill === hoveredCatPill` early-return fires and the dim never fades.
  p9.releasePillHoverDim = () => {
    p9.hoveredCategoryIdx = null;
    p9HoverDimAnimate(0);
  };

  zoneAboveEl.addEventListener("pointerover", e => {
    if (p9.hoveredEvent) return; // dot-hover takes priority
    const pill = e.target.closest(".page9-pill");
    // A pill being dragged (setPointerCapture at drag-start, page9.js's own
    // pointerdown handler) can re-fire a synthetic pointerover on itself —
    // same underlying quirk noted by p9CategoryTooltipInit's own "dragging"
    // guard elsewhere. Without this, the dragged (opacity:0, per .dragging)
    // pill still ends up marked .is-hover-highlighted, which style.css's
    // sibling-lookahead hover rule then uses to darken the *previous*
    // pill's own line — a highlight nobody can see land on a pill that's
    // itself invisible.
    if (pill && pill.classList.contains("dragging")) return;
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
    if (typeof updateGroups === "function") updateGroups(); // see p9HoverDimAnimate's own comment
  }

  function onMove(e) {
    // Mobile has no hover: the tooltip is driven by the press-and-hold loupe
    // (p7InspectInit, page7.js) into the same docked #page9Tooltip, and a
    // synthetic mouse move from a tap would fight it for the element.
    // Also fully off mid-drag (.dragging on .page9-sticky): the pointer
    // carrying a pill across the canvas shouldn't light up dot tooltips
    // under the ghost on its way to a zone.
    if (currentPage !== 10 || p9.anim || isMobile() ||
        document.querySelector(".page9-sticky")?.classList.contains("dragging")) { hide(); return; }

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
      setHighlightedPill(CATEGORY_TO_IDX[bestEvent.category]);
      draw();
      if (typeof updateGroups === "function") updateGroups(); // see p9HoverDimAnimate's own comment
      // draw() just rebuilt p9.lastPositions — bestPos (read below for
      // tooltip placement) still points at the same {x,y}, since dimming
      // only changes alpha, but refresh the reference for clarity/safety.
      bestPos = p9.lastPositions.get(bestEvent);
    }

    dateEl.textContent = p7FormatDateDMY(bestEvent.date);
    descEl.textContent = bestEvent.descHeMedium;
    // `color`, not `border-color`: the visible stroke is the dashed <svg>
    // overlay (updateTooltipDash, main.js), which strokes currentColor.
    tooltipEl.style.color = p7ActorColor(bestEvent.actor);
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
    // Flip downward when opening upward would poke above the column area's
    // fixed ceiling (p9ExtremeTopY — the same boundary the grid itself grows
    // up to, under the drop zone / pill row), per explicit request: near the
    // top of a tall column the box hangs below the dot instead, its square
    // anchor corner moving to the TOP (see .is-flipped in style.css and the
    // matching corner logic in updateTooltipDash, js/core.js).
    const rawTop  = dotClientY - TOOLTIP_GAP - tooltipEl.offsetHeight;
    const flipped = rawTop < rect.top + p9ExtremeTopY(canvasEl.clientHeight);
    tooltipEl.classList.toggle("is-flipped", flipped);
    const top = flipped
      ? dotClientY + P9_SQ + TOOLTIP_GAP
      : Math.max(rawTop, 8);
    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top  = `${top}px`;
    // After sizing/mirroring are settled — the dash path is drawn to the box's
    // actual pixel size, which changes with the description's line count.
    updateTooltipDash(tooltipEl);
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

// Hover tooltip for a category pill in the tray (#page9ZoneBelow) — a short
// description of what the category covers. Deliberately scoped to the tray
// only, per explicit request: dropped pills in #page9ZoneAbove (the extreme
// zone) already have their own hover behavior (setPillHover, p9HoverInit
// above) and don't get this description tooltip.
function p9CategoryTooltipInit() {
  const tooltipEl = document.getElementById("page9CatTooltip");
  const descEl    = tooltipEl.querySelector(".page9-cat-tooltip-desc");
  const zoneBelow = document.getElementById("page9ZoneBelow");
  const zoneAbove = document.getElementById("page9ZoneAbove");
  const panel     = document.querySelector(".page9-sticky");

  const GAP = 10; // px between the pill's top edge and the tooltip's arrow tip

  function show(pill) {
    // Starting a drag (panel.classList "dragging", set in p9BuildPanel's
    // pointerdown handler) re-fires a synthetic pointerover on the same pill
    // as a side effect of the DOM mutations it makes (ghost insertion,
    // .dragging's opacity:0) — even though the pointer itself hasn't moved.
    // Ignore it, or the tooltip would pop back up mid-drag right after this
    // same gesture is what should dismiss it.
    if (panel.classList.contains("dragging")) return;
    descEl.textContent = P9_CATEGORY_DESC[Number(pill.dataset.idx)];
    tooltipEl.classList.add("is-visible");

    const rect     = pill.getBoundingClientRect();
    const rawLeft  = rect.left + rect.width / 2 - tooltipEl.offsetWidth / 2;
    const left     = Math.max(8, Math.min(rawLeft, window.innerWidth - tooltipEl.offsetWidth - 8));
    // Above the pill by default on legacy desktop; below when there isn't
    // room above. `is-below` flips the arrow to match.
    // V2 and MOBILE are always below, unconditionally: both bands sit high
    // but not always so high that the fits-above test fails — on mobile a
    // one-line description could pass it and angle up over the title while
    // taller ones angled down (explicit instruction: all angle down).
    // On V2 it hangs downward per explicit request, painting over the drop
    // zone (z-index 1006, see style.css).
    const above    = rect.top - tooltipEl.offsetHeight - GAP;
    const isBelow  = p9IsV2() || isMobile() || above < 8;
    tooltipEl.classList.toggle("is-below", isBelow);
    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top  = `${isBelow ? rect.bottom + GAP : above}px`;

    // Previews the drop target — same idle (:empty) box treatment (dashed
    // border, light fill) even though the zone already has pills dropped in
    // it, minus the "גררו..." hint text (that stays tied to :empty::after
    // alone, see style.css, so it naturally won't show once non-empty). Just
    // hovering a tray pill, not yet dragging it.
    zoneAbove.classList.add("tray-pill-hover");
  }
  function hide() {
    tooltipEl.classList.remove("is-visible");
    zoneAbove.classList.remove("tray-pill-hover");
    openInfoPill = null;
  }

  // Which pill's ⓘ is currently open (mobile). Hover has no such state — it is
  // implied by the pointer — but a tap does: the second tap on the same button
  // must close it.
  let openInfoPill = null;

  zoneBelow.addEventListener("pointerover", e => {
    // Mobile drives the tooltip from the ⓘ button alone. Without this guard a
    // classify-tap also fires pointerover and would raise the tooltip as a
    // side effect of tapping anywhere on the pill.
    if (isMobile()) return;
    const pill = e.target.closest(".page9-pill");
    if (pill && zoneBelow.contains(pill)) show(pill); else hide();
  });
  // Desktop only, for the same reason as the pointerover guard above — and one
  // sharper one. A touch pointer is destroyed at pointerup, which fires
  // pointerleave BEFORE the click: on mobile this handler ran on every tap and
  // cleared `openInfoPill` a beat before the click handler read it, so the
  // close branch never saw an open tooltip and every second tap re-opened
  // instead of closing. On touch there is no "left the tray" to detect anyway —
  // the ⓘ, an outside tap and a tray scroll are what dismiss it.
  zoneBelow.addEventListener("pointerleave", () => { if (!isMobile()) hide(); });

  // Capture phase, and stopPropagation: the button is a child of the pill, so a
  // bubbling listener would run only AFTER the pill's own click handler had
  // already toggled .is-extreme. Tapping ⓘ must inform, never classify.
  zoneBelow.addEventListener("click", e => {
    const btn = e.target.closest(".page9-pill-info");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const pill = btn.closest(".page9-pill");
    // Any ⓘ tap while one is open closes it — the same button or a different
    // pill's. It does NOT hop the tooltip over to the newly tapped pill: with
    // one frame on screen at a time, "tap to open, tap to close" is a single
    // rule the finger can rely on anywhere in the run.
    if (openInfoPill) { hide(); return; }
    show(pill);
    openInfoPill = pill;
  }, true);

  // Tap anywhere else dismisses it (including on another pill, whose classify
  // tap still goes through — only the tooltip closes).
  document.addEventListener("click", e => {
    if (openInfoPill && !e.target.closest(".page9-pill-info")) hide();
  });

  // Scrolling the tray dismisses it too. The tooltip is positioned once, from
  // the pill's rect at open time, and then sits in viewport coordinates — so a
  // horizontal scroll of the run slides the pill out from under a tooltip that
  // stays put. Rather than track the pill every frame, close it: the gesture
  // is the user moving on from that pill anyway.
  zoneBelow.addEventListener("scroll", () => { if (openInfoPill) hide(); }, { passive: true });

  window.addEventListener("scroll", () => { if (currentPage !== 10) hide(); }, { passive: true });
}

p9CategoryTooltipInit();
