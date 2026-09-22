// squareboundingbox.js — shared grid-geometry constants for the event-square grids.

// Only .top is still read (page9.js's extreme-grid ceiling); kept as an object so a
// future re-widening has an obvious home. Historical full box: left 0.28 / right 0.72 /
// bottom 0.92.
const SBB = {
  top: 0.08,   // fraction of H
};

// The real timeline's own box (page7.js/page8.js, #page-9) — kept separate from SBB
// above (used by page9.js's drag-and-drop grid, #page-13) so widening or reshaping the
// timeline's grid doesn't also move that unrelated page's layout.
// left is wider than the old SBB.left but still clears the persistent mini-legend pinned
// at the screen's left edge (GROUPS' fold6 position in js/groups.js) — measured ~0.07-0.10
// of W at typical desktop widths, so 0.18 leaves a comfortable margin. The right edge
// mirrors left automatically (see p7GridGeometry), so no `right` field.
// DESKTOP `left` is a fixed px (SBB_TIMELINE_LEFT_PX), not a fraction — picked by eye
// with the `manual/` edge harness on 2026-09-04 at 1920 wide (was 0.18 ≈ 346px there),
// re-tuned to 190 by eye on 2026-09-05, then to 120 (manual/, 2026-09-19 at 1492 wide).
// Read it through sbbTimelineLeftX(W, H), never W * box.left, so the exact px survives
// every viewport width. Mobile stays a fraction (SBB_TIMELINE_MOBILE_LEFT).
const SBB_TIMELINE_LEFT_PX = 120;
const SBB_TIMELINE = {
  left:   0.18,   // fraction of W — MOBILE-ONLY fallback; desktop uses SBB_TIMELINE_LEFT_PX
  top:    0.07,   // fraction of H — unread: desktop uses SBB_TIMELINE_TOP_PX, mobile solves its own
  bottom: 0.93,   // fraction of H — unread, same reason (SBB_TIMELINE_BOTTOM_PX)
};
// DESKTOP top/bottom are fixed px insets off the viewport's edges, manual/-baked
// 2026-09-19 at 835 tall (were 0.07 / 0.93 ≈ 58px there) — the vertical axis is glued
// to the field, so these two ARE how tall the axis stands. Exact px, not a fraction,
// so the tuned clearance survives every viewport height (the LEFT_PX rule above).
const SBB_TIMELINE_TOP_PX    = 32;
const SBB_TIMELINE_BOTTOM_PX = 32;

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
//   top    = whatever actually prints above the grid, + SBB_TIMELINE_MOBILE_GAP_PX.
//            TWO CASES, picked at call time by sbbTimelineMobileTopPx():
//              • headline in a TOP-ANCHORED slot — its own bottom edge
//                (P7_VERT_MOBILE.slotTopPx 64 + one 19px title line, page7.js),
//                read as constants rather than measured, because it is canvas
//                text with no DOM box to ask.
//              • headline anchored anywhere else ('side'/'dot'/'dotAbove', the
//                shipping config) — nothing prints up there at all, so the only
//                thing to clear is the fold badge. Reserving the slot's 83px
//                regardless left a ~100px band of empty screen above the axis.
//   bottom = the DOCKED TOOLTIP's top edge minus the same gap. The frame is the
//            last thing in the mobile stack now (bar / headline / grid /
//            frame), bottom-anchored by tooltipDockRestPx()
//            (js/fold8-tooltip.js), so the clearance it needs is a plain inset
//            from the screen's bottom edge. Its ONE growing state
//            (.is-expanded, a reader opening a clipped description) is
//            deliberately NOT accounted for: it overlays the grid instead of
//            moving it, so this clearance stays constant.
//   (horizontal-axis fallback) = the year axis line (P7_AXIS_Y_FRAC_MOBILE of H) minus the tallest
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
let   SBB_TIMELINE_MOBILE_TOP_PX        = 64 + 19 + SBB_TIMELINE_MOBILE_GAP_PX;  // top-anchored headline slot; `let` only so a manual/ harness can drive it live
// The fold badge is the only thing above the grid when the headline is not
// top-anchored: it runs 12..33px, so 36 clears it with a hair to spare.
const SBB_TIMELINE_MOBILE_TOP_BADGE_PX  = 36 + SBB_TIMELINE_MOBILE_GAP_PX;
const SBB_TIMELINE_MOBILE_AXIS_CLEAR_PX = 36 + 10 + SBB_TIMELINE_MOBILE_GAP_PX;
// Vertical axis on mobile (P7_VERT_MOBILE.enabled, page7.js): there is no
// bottom axis to clear, so the box's bottom is a plain inset from the viewport
// bottom — whatever the docked tooltip frame occupies down there, plus the
// shared gap. The headline slot costs nothing here: it is anchored to the TOP
// of the viewport (slotAnchor 'top'), and only the 'grid' anchor reserves a
// band under the dots.
// See the `top =` note above: the slot reservation only applies when the
// headline actually prints at the top of the viewport.
function sbbTimelineMobileTopPx() {
  const V = typeof P7_VERT_M === "undefined" ? null : P7_VERT_M;
  const topAnchored = V && V.enabled && V.headline === 'slot'
    && (V.slotAnchor === 'top' || V.slotAnchor === 'fill');
  // ...plus the picker's instruction band when it sits ABOVE the timeline
  // (p7HintBandTopH, page7.js). 0 on the other placement. Held from before the
  // sentence types (it arrives at 2024) so the box never moves when it does.
  const band = (typeof p7HintBandTopH === "function") ? p7HintBandTopH() : 0;
  return (topAnchored ? SBB_TIMELINE_MOBILE_TOP_PX : SBB_TIMELINE_MOBILE_TOP_BADGE_PX) + band;
}

function sbbTimelineMobileBottomPx() {
  const V = typeof P7_VERT_M === "undefined" ? null : P7_VERT_M;
  if (!V || !V.enabled) return null;
  const slot = (V.headline === 'slot' && V.slotAnchor === 'grid') ? V.slotPx : 0;
  // The docked frame is NOT reserved for any more. It used to carry the
  // «לחצו והחזיקו» instruction line at rest, which had to stay clear of the
  // grid — that line is removed, and its whole band went to the timeline. What
  // is left is the frame's picked state, which is a TOOLTIP: it may sit over
  // the chart like every other one. So the box just stops short of the screen
  // edge by V.bottomInsetPx, and the axis runs all the way down to it.
  // ...and the same band when it sits BELOW (the shipped placement).
  const frame = V.bottomInsetPx
    + ((typeof p7HintBandBottomH === "function") ? p7HintBandBottomH() : 0);
  // ...plus whatever the LAST axis plaque hangs below the axis end. Its dot sits
  // on the final row, which the camera brings down to this very edge, so without
  // this the plaque prints over the docked frame's instruction line at the end
  // of every scrub. 0 unless the roster has a `mobileBelow` event.
  const plaque = (typeof p7AxisLastPlaqueOverhangPx === "function")
    ? p7AxisLastPlaqueOverhangPx() : 0;
  return Math.max(V.bottomInsetPx, frame) + slot + plaque;
}


// Live-read at layout/draw time (isMobile() reads innerWidth), so a resize
// across the 600px boundary picks the right box on the next relayout. H is the
// canvas height the caller is laying out against — passed in rather than read
// off window.innerHeight so the box can never disagree with the geometry it's
// being used for.
function sbbTimeline(H) {
  const h = H || window.innerHeight;
  if (!isMobile()) return { left: SBB_TIMELINE.left, top: SBB_TIMELINE_TOP_PX / h, bottom: (h - SBB_TIMELINE_BOTTOM_PX) / h };
  const vertBottom = sbbTimelineMobileBottomPx();
  return {
    left:   SBB_TIMELINE_MOBILE_LEFT,
    top:    sbbTimelineMobileTopPx() / h,
    bottom: vertBottom !== null ? (h - vertBottom) / h
          : (P7_AXIS_Y_FRAC_MOBILE * h - SBB_TIMELINE_MOBILE_AXIS_CLEAR_PX) / h,
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
