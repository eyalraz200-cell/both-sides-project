function drawPage1(ctx, W, H) {
  drawBackground(ctx, W, H);
}

// Intro screen's vertical dot column (revised Figma node 167:90164 — was
// 146:105164) — 5px squares on a 17px step, stepping down from just below the
// title block toward the scroll prompt at the bottom. The orange column is
// shorter than the blue one (30 rows vs 36): Figma's own design clips the
// right-hand column away near the bottom, tapering the line to a single blue
// column right before the .page0-scroll arrow. Both columns are offset from
// the viewport's horizontal center (not the page's 480px text column) so they
// stay centered at any width. Reference frame was 982px tall.
// DOM elements (not canvas-drawn) appended into #page-0's own .page0-overlay
// — that box scrolls in normal flow with the rest of fold 1's content (see
// style.css), so these dots need to scroll away with it too, rather than
// staying pinned to the fixed canvas the way every other fold's graphics do.
const PAGE0_DOT_SQ = 5;
const PAGE0_DOT_BLUE_COUNT = 36;
const PAGE0_DOT_ORANGE_COUNT = 30;
const PAGE0_DOT_STEP_PCT = (17 / 982) * 100;
const PAGE0_DOT_START_PCT = -(94.5 / 982) * 100;

(function buildPage0Dots() {
  const container = document.querySelector("#page-0 .page0-overlay");
  for (let i = 0; i < PAGE0_DOT_BLUE_COUNT; i++) {
    const top = `calc(50% + ${(PAGE0_DOT_START_PCT + i * PAGE0_DOT_STEP_PCT).toFixed(4)}% - ${PAGE0_DOT_SQ / 2}px)`;

    const blue = document.createElement("div");
    blue.className = "page0-dot";
    blue.style.top = top;
    blue.style.left = `calc(50% - 12px - ${PAGE0_DOT_SQ / 2}px)`;
    blue.style.background = "#2563eb";
    container.appendChild(blue);

    if (i < PAGE0_DOT_ORANGE_COUNT) {
      const orange = document.createElement("div");
      orange.className = "page0-dot";
      orange.style.top = top;
      orange.style.left = `calc(50% + 4px - ${PAGE0_DOT_SQ / 2}px)`;
      orange.style.background = "#ea580c";
      container.appendChild(orange);
    }
  }
})();
