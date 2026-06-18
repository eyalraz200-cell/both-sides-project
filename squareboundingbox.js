// squareboundingbox.js — defines the area where event squares are drawn
// Edit these fractions to resize or reposition the box.

const SBB = {
  left:   0.28,   // fraction of W
  right:  0.72,   // fraction of W
  top:    0.08,   // fraction of H
  bottom: 0.92,   // fraction of H
};

// Standard horizontal gap (px) left empty at the canvas's center, between any
// left-side and right-side event/action grid (page6, page7, page9) — keeps them
// visually consistent as one continuous two-sided dataset.
const CENTER_GAP = 8;

// The 6 "headline" action squares first shown in page6 — they persist unchanged into
// page7 (and stay on screen through every page after), so the transition reads as
// continuous rather than a reset. ANCHOR_COUNT_PER_SIDE lets page7 treat these 3-per-side
// squares as already-drawn: its data-driven reveal counter starts past them instead of
// re-drawing (and double-counting) the same events at new, shuffled grid positions.
const ANCHOR_SQ = 3;
const ANCHOR_ACTIONS = [
  { color: "#0C7AE0", side: "left",  sqY: 527 },
  { color: "#EF3890", side: "left",  sqY: 556 },
  { color: "#0C7AE0", side: "left",  sqY: 585 },
  { color: "#69DB12", side: "right", sqY: 527 },
  { color: "#16181D", side: "right", sqY: 556 },
  { color: "#F9880D", side: "right", sqY: 585 },
];
const ANCHOR_COUNT_PER_SIDE = ANCHOR_ACTIONS.filter(a => a.side === "left").length;

function drawAnchorActions(ctx, W, H, alpha = 1) {
  // Reference frame: 1117 (vertical positions only — horizontal columns are derived
  // from the real grid's own geometry, p7GridGeometry in page7.js, so these squares
  // always land exactly on the left grid's near-center column edge instead of an
  // independent formula that can drift a few px out of sync with it.
  const ry = y => y / 1117 * H;
  const { leftX0, cols, CELL } = p7GridGeometry(W, H);
  const leftX  = leftX0 + cols * CELL - ANCHOR_SQ;
  const rightX = W / 2 + CENTER_GAP / 2;

  if (alpha <= 0) return;
  ctx.globalAlpha = alpha;
  ANCHOR_ACTIONS.forEach(({ color, side, sqY }) => {
    const x = side === "left" ? leftX : rightX;
    const y = ry(sqY);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, ANCHOR_SQ, ANCHOR_SQ);
  });
  ctx.globalAlpha = 1;
}

// Width of the floating text column (.text-col in style.css). The canvas now spans the
// full viewport (W = true screen width) so the dot-grid visualizations are genuinely
// centered, but auxiliary UI (legends, lists, panels, buttons) must still avoid sitting
// under the floating text — those should compute against `W - TEXT_COL_WIDTH`, not raw W.
const TEXT_COL_WIDTH = 480;

// Shared top-left group-color legend — used from page6 onward for visual continuity
// between pages. Relies on P7_LEGEND (defined in page7.js).
function drawGroupLegend(ctx, W, H, sqL = 6) {
  ctx.font         = "400 12px 'Assistant', sans-serif";
  ctx.textBaseline = "middle";
  ctx.direction    = "ltr";
  ctx.textAlign    = "left";

  const lgap = 6, itemGap = 20;
  const legByLabel = Object.fromEntries(P7_LEGEND.map(l => [l.label, l]));
  const legOrder = [
    "מתנגדי הרפורמה המשפטית",
    "פעילי שמאל",
    "מתיישבים",
    "פעילי ימין",
    "חרדים",
  ];
  const legItems = legOrder.map(label => ({ label, color: legByLabel[label].color }));
  const legY = Math.round(H * 0.045);
  let legX   = 48;

  legItems.forEach(({ label, color }) => {
    const labelW = ctx.measureText(label).width;
    ctx.globalAlpha = 0.35;
    ctx.fillStyle   = "#111";
    ctx.fillText(label, legX, legY);
    ctx.globalAlpha = 1;
    ctx.fillStyle   = color;
    ctx.fillRect(legX + labelW + lgap, legY - sqL / 2, sqL, sqL);
    legX += labelW + lgap + sqL + itemGap;
  });
  ctx.globalAlpha = 1;
}
