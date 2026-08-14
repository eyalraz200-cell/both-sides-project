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
const SBB_TIMELINE = {
  left:   0.18,   // fraction of W
  top:    0.13,   // fraction of H
  bottom: 0.81,   // fraction of H
};

// Standard horizontal gap (px) left empty at the canvas's center, between any
// left-side and right-side event/action grid (timeline + page9's grids) — keeps them
// visually consistent as one continuous two-sided dataset.
const CENTER_GAP = 8;
