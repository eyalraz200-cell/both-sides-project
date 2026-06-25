function drawPage1(ctx, W, H) {
  drawBackground(ctx, W, H);
}

// Intro screen's vertical dot column (revised again per node 181:168) — 5px
// squares on a 17px step, stepping down from just below the title block
// toward the scroll prompt at the bottom. Both columns now run the full
// length paired together (the older design's blue-only taper near the bottom
// is gone — node 181:168 pairs orange with blue all the way down). Both
// columns are offset from the viewport's horizontal center (not the page's
// 480px text column) so they stay centered at any width. Reference frame was
// 982px tall.
// DOM elements (not canvas-drawn) appended into #page-0's own .page0-overlay
// — that box scrolls in normal flow with the rest of fold 1's content (see
// style.css), so these dots need to scroll away with it too, rather than
// staying pinned to the fixed canvas the way every other fold's graphics do.
const PAGE0_DOT_SQ = 5;
const PAGE0_DOT_COUNT = 36;
const PAGE0_DOT_STEP_PCT = (17 / 982) * 100;
const PAGE0_DOT_START_PCT = -(94.5 / 982) * 100;

// Shared by both the visible column (buildPage0Dots) and its off-screen
// continuation (buildPage0DotsExtra) below — same horizontal offsets, same
// square size, just a different `top` value/unit from each caller.
function appendPage0DotPair(container, top) {
  const blue = document.createElement("div");
  blue.className = "page0-dot";
  blue.style.top = top;
  blue.style.left = `calc(50% - 12px - ${PAGE0_DOT_SQ / 2}px)`;
  blue.style.background = "#2563eb";
  container.appendChild(blue);

  const orange = document.createElement("div");
  orange.className = "page0-dot";
  orange.style.top = top;
  orange.style.left = `calc(50% + 4px - ${PAGE0_DOT_SQ / 2}px)`;
  orange.style.background = "#ea580c";
  container.appendChild(orange);
}

(function buildPage0Dots() {
  const container = document.querySelector("#page-0 .page0-overlay");
  for (let i = 0; i < PAGE0_DOT_COUNT; i++) {
    const top = `calc(50% + ${(PAGE0_DOT_START_PCT + i * PAGE0_DOT_STEP_PCT).toFixed(4)}% - ${PAGE0_DOT_SQ / 2}px)`;
    appendPage0DotPair(container, top);
  }
})();

// Continues the same two columns past the bottom of the first viewport —
// .page0-dots-extra is a normal block-flow element (see style.css), so unlike
// the viewport-relative column above, this one actually adds scroll height to
// #page-0 and pushes fold2 down, rather than just drawing more dots in space
// that was already there. Count is a third of a reference-frame's worth of
// scrolling (982px / 17px step / 3), just enough of a pause before fold2
// arrives without the long gap a full extra viewport gave.
const PAGE0_DOT_EXTRA_COUNT = Math.round(982 / 17 / 3);
const PAGE0_DOT_EXTRA_STEP = 17;

// The visible column's dot centers are at vh/2 + (-94.5 + i*17) — viewport-
// relative, so where the *last* one (i = PAGE0_DOT_COUNT - 1) actually lands
// depends on vh, while .page0-dots-extra always starts exactly at vh (right
// after .page0-overlay's own height: 100vh). Phase-locking the extra column's
// first dot to "17px after wherever the last visible one actually landed"
// (rather than just resetting to a fixed 0) keeps the two columns reading as
// one continuous line instead of overlapping/gapping at the seam — re-run on
// resize (see main.js) since vh can change after load.
function buildPage0DotsExtra() {
  const container = document.querySelector("#page-0 .page0-dots-extra");
  container.innerHTML = "";

  const vh = window.innerHeight;
  const lastVisibleCenter = vh / 2 + PAGE0_DOT_START_PCT / 100 * 982 + (PAGE0_DOT_COUNT - 1) * 17;
  const firstExtraCenter = (lastVisibleCenter - vh) + PAGE0_DOT_EXTRA_STEP;

  for (let i = 0; i < PAGE0_DOT_EXTRA_COUNT; i++) {
    const center = firstExtraCenter + i * PAGE0_DOT_EXTRA_STEP;
    const top = `${(center - PAGE0_DOT_SQ / 2).toFixed(4)}px`;
    appendPage0DotPair(container, top);
  }
  container.style.height = `${PAGE0_DOT_EXTRA_COUNT * PAGE0_DOT_EXTRA_STEP}px`;
}
buildPage0DotsExtra();
