// squareboundingbox.js — shared grid-geometry constants for the event-square grids.

// Only .top is still read (page9.js's extreme-grid ceiling); kept as an object so a
// future re-widening has an obvious home. Historical full box: left 0.28 / right 0.72 /
// bottom 0.92.
const SBB = {
  top: 0.08,   // fraction of H
};

// The real timeline's own box (page7.js/page8.js, #page-7) — kept separate from SBB
// above (used by page9.js's drag-and-drop grid, #page-9) so widening or reshaping the
// timeline's grid doesn't also move that unrelated page's layout.
// left is wider than the old SBB.left but still clears the persistent mini-legend pinned
// at the screen's left edge (GROUPS' fold6 position in main.js) — measured ~0.07-0.10
// of W at typical desktop widths, so 0.18 leaves a comfortable margin. The right edge
// mirrors left automatically (see p7GridGeometry), so no `right` field.
// DESKTOP `left` is a fixed px (SBB_TIMELINE_LEFT_PX), not a fraction — picked by eye
// with the `manual/` edge harness on 2026-09-04 at 1920 wide (was 0.18 ≈ 346px there).
// Read it through sbbTimelineLeftX(W, H), never W * box.left, so the exact px survives
// every viewport width. Mobile stays a fraction (SBB_TIMELINE_MOBILE_LEFT).
let SBB_TIMELINE_LEFT_PX = 200; // `let` so a harness can drive it live
const SBB_TIMELINE = {
  left:   0.18,   // fraction of W — MOBILE-ONLY fallback; desktop uses SBB_TIMELINE_LEFT_PX
  top:    0.07,   // fraction of H
  bottom: 0.93,   // fraction of H
};

// Mobile variant (≤600px). `left` is a screen-edge inset (0.03×393≈12px,
// matching FOLD6_LEGEND_INSET_MOBILE) — the legend is top-pinned there, not
// left-pinned, so nothing has to be cleared horizontally.
//
// top/bottom are NOT fractions: on a phone the two things the grid has to clear
// are both fixed-px objects — the docked tooltip frame above it and the axis
// event labels below it — so a fraction of H either wasted a band of screen on a
// tall phone or collided on a short one. They're plain px clearances instead,
// turned into fractions against the live H by sbbTimeline() below:
//
//   top    = the docked tooltip's own bottom edge + SBB_TIMELINE_MOBILE_GAP_PX
//            (TOOLTIP_DOCK_TOP_PX 62 + its 100px collapsed height, see
//            `.page9-tooltip.is-docked` in style.css) — read as constants here
//            rather than measured, because the frame isn't in the DOM flow and
//            its size is fixed by that rule. The frame's ONE growing state
//            (.is-expanded, a reader opening a clipped description) is
//            deliberately NOT accounted for here: it overlays the grid instead
//            of moving it, so this clearance stays constant.
//   bottom = the year axis line (P7_AXIS_Y_FRAC_MOBILE of H) minus the tallest
//            axis-event label block that can print above it, minus the SAME
//            SBB_TIMELINE_MOBILE_GAP_PX. The grid is the middle of a three-part
//            stack (tooltip / dots / axis labels) so it breathes equally on both
//            sides — a different gap top and bottom reads as the grid sitting
//            crooked in its band.
//            Block height is measured for what actually prints: at the 220px
//            wrap all seven P7_AXIS_EVENTS titles fit on ONE line, so it is
//            P7_AXIS_EVENT_LABEL_OFFSET_MOBILE (36, that line's baseline) + ~10px
//            cap height (14px Assistant) = 46. Reserving extra lines "just in
//            case" pushed the dots that far off every block that really prints,
//            and the fold read as having a hole in it. If a longer title is ever
//            added it wraps and eats 18px per extra line out of the gap
//            (P7_AXIS_EVENT_LINE_HEIGHT_MOBILE) — check it by eye then.
const SBB_TIMELINE_MOBILE_LEFT          = 0.03;  // fraction of W
const SBB_TIMELINE_MOBILE_GAP_PX        = 18;    // shared clearance above AND below the grid
const SBB_TIMELINE_MOBILE_TOP_PX        = 62 + 100 + SBB_TIMELINE_MOBILE_GAP_PX;
const SBB_TIMELINE_MOBILE_AXIS_CLEAR_PX = 36 + 10 + SBB_TIMELINE_MOBILE_GAP_PX;


// Live-read at layout/draw time (isMobile() reads innerWidth), so a resize
// across the 600px boundary picks the right box on the next relayout. H is the
// canvas height the caller is laying out against — passed in rather than read
// off window.innerHeight so the box can never disagree with the geometry it's
// being used for.
function sbbTimeline(H) {
  if (!isMobile()) return SBB_TIMELINE;
  const h = H || window.innerHeight;
  return {
    left:   SBB_TIMELINE_MOBILE_LEFT,
    top:    SBB_TIMELINE_MOBILE_TOP_PX / h,
    bottom: (P7_AXIS_Y_FRAC_MOBILE * h - SBB_TIMELINE_MOBILE_AXIS_CLEAR_PX) / h,
  };
}

// The box's outer x edge (left grid's leftX0; the right grid mirrors it at W − this).
// Desktop: the exact SBB_TIMELINE_LEFT_PX. Mobile: rounded fraction of W (rounded so a
// float just under a whole px can't drop a column — see p7GridGeometry).
function sbbTimelineLeftX(W, H) {
  return isMobile() ? Math.round(W * sbbTimeline(H).left) : SBB_TIMELINE_LEFT_PX;
}

// Standard horizontal gap (px) left empty at the canvas's center, between any
// left-side and right-side event/action grid (timeline + page9's grids) — keeps them
// visually consistent as one continuous two-sided dataset.
const CENTER_GAP = 4;

// DESKTOP ONLY (page7.js's p7VerticalAxis branch): the year axis runs
// VERTICALLY down the centre of the timeline, so the centre gap there is a
// corridor wide enough for the line, its year rings and the year labels
// (18px "2026" ≈ 40px) — replaces CENTER_GAP in p7GridGeometry on desktop.
// Mobile keeps CENTER_GAP and the horizontal bottom axis.
const P7_AXIS_CORRIDOR_PX = 64;
