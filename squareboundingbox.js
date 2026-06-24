// squareboundingbox.js — defines the area where event squares are drawn
// Edit these fractions to resize or reposition the box.

const SBB = {
  left:   0.28,   // fraction of W
  right:  0.72,   // fraction of W
  top:    0.08,   // fraction of H
  bottom: 0.92,   // fraction of H
};

// The real timeline's own box (page7.js/page8.js, #page-8) — kept separate from SBB
// above (still used as-is by page9.js's drag-and-drop grid, #page-10) so widening or
// reshaping the timeline's grid doesn't also move that unrelated page's layout.
// left is wider than SBB.left but still clears the persistent mini-legend pinned at
// the screen's left edge (GROUPS' fold6 position in main.js) — measured ~0.07-0.10
// of W at typical desktop widths, so 0.18 leaves a comfortable margin.
const SBB_TIMELINE = {
  left:   0.18,   // fraction of W
  right:  0.82,   // fraction of W (unused — the right edge mirrors left automatically, see p7GridGeometry)
  top:    0.16,   // fraction of H
  bottom: 0.84,   // fraction of H
};

// Standard horizontal gap (px) left empty at the canvas's center, between any
// left-side and right-side event/action grid (page6, page7, page9) — keeps them
// visually consistent as one continuous two-sided dataset.
const CENTER_GAP = 8;

// Width of the floating text column (.text-col in style.css). The canvas now spans the
// full viewport (W = true screen width) so the dot-grid visualizations are genuinely
// centered, but auxiliary UI (legends, lists, panels, buttons) must still avoid sitting
// under the floating text — those should compute against `W - TEXT_COL_WIDTH`, not raw W.
const TEXT_COL_WIDTH = 480;
