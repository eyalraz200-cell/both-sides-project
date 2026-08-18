history.scrollRestoration = "manual";
window.scrollTo(0, 0);

const canvas = document.getElementById("canvas");
const ctx    = canvas.getContext("2d");

// drawFoldSplit/drawFold7/drawFold9 are tiny inline background-only
// functions (see below) — these folds' only visual content is the DOM overlay.
// Folds whose canvas is *purely* background use drawBackground directly.
const PAGES = [drawPage1, drawBackground, drawBackground, drawFoldSplit, drawBackground, drawFold7, drawFold9, drawPage7, drawPage8, drawPage9, drawPage12];
let currentPage = 0;

// How far every OTHER dot/square drops in opacity while one event is hovered
// and its tooltip is up — the hover-dim factor, multiplied into the dot's own
// current alpha. Shared by the timeline squares (p7DrawSideSquares, page7.js),
// page9's grid dots (p9PlaceDot, page9.js) and the fold-9 curated squares
// drawn over them (updateGroups, below), so the whole screen dims by one
// consistent amount. `var`, not `let`, deliberately: it stays overridable
// from the console/a tuning harness.
var HOVER_DIM_OPACITY = 0.2;

// Per-group override of the factor above, keyed by the DIMMED dot's own
// `actor` (GROUPS' events.json join key) — not the hovered one's. The six
// group colors don't read alike at one shared opacity (the near-black
// #454545 disappears where the yellow #F9B624 still shouts), so each may
// carry its own. An actor with no entry here falls back to
// HOVER_DIM_OPACITY, so this staying empty = the old single-value behavior.
// `var` for the same reason as above: overridable from a tuning harness.
// Only the three groups that needed to go FURTHER back than the shared 0.2 are
// listed — tuned by eye on the real timeline; the other three read right at the
// default and are deliberately absent rather than restating 0.2.
var HOVER_DIM_BY_ACTOR = {
  "settlers": 0.15,                       // תנועות התנחלות באיו״ש
  "right wing protesters": 0.15,          // קבוצות ימין לאומיות
  "protesters against government": 0.11,  // ארגוני מחאה נגד הממשלה
};
function hoverDim(actor) {
  const v = HOVER_DIM_BY_ACTOR[actor];
  return v === undefined ? HOVER_DIM_OPACITY : v;
}

// Stroke width of the event tooltip's dashed frame, in px. One knob for both
// halves of that frame: the transparent CSS border holding the box-model
// space open (--tip-border-w, .page9-tooltip in style.css, set from
// updateTooltipDash below) and the SVG stroke actually drawn over it.
var TOOLTIP_BORDER_W = 2;

function drawBackground(ctx, W, H) {
  // p9PlaceDot (page9.js) leaves ctx.globalAlpha at a dimmed value (0.35) on
  // a hovered frame and never restores it — without resetting here first,
  // this "clear" itself draws translucent, so the previous frame's pixels
  // partially survive underneath and visibly compound on every subsequent
  // redraw (the "opacity builds up while hovering" bug).
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#FDFCFF";
  ctx.fillRect(0, 0, W, H);
  // The vignette is a single CSS layer (.vignette in style.css) spanning the whole
  // viewport — canvas + text column together — so there's no seam at the column edge.
}

// Split-phase fold (id #page-3) — the groups split into the left/right corner
// mini-legends (driven by fold6Trigger via updateGroups). The grey squares +
// ACLED note were moved to the next fold (#page-4). All DOM overlay;
// plain background only here.
function drawFoldSplit(ctx, W, H) {
  drawBackground(ctx, W, H);
}

// Timeline-intro fold (id #page-5, Figma node 120:1299) — just the timeline's
// intro title now. The real pinned scrub section (drawPage7/page7-scrub) lives
// at #page-7, *after* fold 9, specifically so the real per-event reveal
// doesn't engage until then — bundling them together (the original
// structure) meant the real dot-grid started growing the instant this
// title appeared, clashing with fold 6-9's own curated squares for the
// entire ~7-viewport scrub range. Plain background only here.
function drawFold7(ctx, W, H) {
  drawBackground(ctx, W, H);
  // Same reasoning as drawFold9 below (see p7RealTimelineReached's own
  // comment, page7.js): if a fast scroll-up carries the user all the way
  // past #page-6 (the fold-9 colors fold) and into this fold within a single
  // continuous motion, any per-event squares still mid-retreat should keep
  // animating out here too, instead of freezing the instant currentPage drops.
  // No axis here (p7AxisTriggerIfNeeded isn't called) — the axis has never
  // shown this far back and shouldn't start now.
  if (p7.ready && p7RealTimelineReached) {
    p7DrawTimelineSquares(ctx, W, H);
    // Fully retreated — this is where the per-month state gets wiped (see
    // setActivePage, js/nav.js), i.e. once the reverse cascade has finished
    // rather than the moment currentPage dropped.
    if (!p7HasEngaged && !p7AnyAnimActive()) { p7RealTimelineReached = false; p7ResetForReplay(); }
  }
}

// Fold 9 (id #page-6, Figma node 162:63876) — see GROUPS/updateGroups below
// for its actual DOM-overlay content (the fold-6 squares losing their
// labels and gaining group colors). Background only, except the year axis
// (page7.js) — that one starts appearing here already, gated by
// p7AxisTriggerIfNeeded (its trigger is p7HasEngaged, i.e. this very fold's
// own title card passing fully offscreen, which also kicks off the axis's
// one-shot build-in wipe), rather than waiting until currentPage actually
// flips to the real timeline/#page-7. p7DrawYearAxis itself is still also called from
// drawPage7, since the axis needs to keep drawing for the whole rest of the
// timeline.
function drawFold9(ctx, W, H) {
  drawBackground(ctx, W, H);
  if (!p7.ready) return;
  p7UpdateEngagement(); // keeps p7HasEngaged live while scrolling back through this fold too (page7.js)
  // Once the real timeline (drawPage7, #page-7) has actually been reached at
  // least once, keep drawing/animating its per-event squares here too — see
  // p7RealTimelineReached's own comment (page7.js) for why: without this, the
  // instant the user scrolls back up far enough for currentPage to drop from
  // 8 to 7, every still-retreating dot (and the year axis's own headline
  // events) just vanished in a single frame instead of finishing its reverse
  // cascade. Gated on p7RealTimelineReached rather than p7HasEngaged alone
  // (which flips true earlier, while still on this very fold) so the
  // *forward* reveal still only ever starts once #page-7 is actually reached
  // — this only smooths out the reverse crossing.
  if (p7RealTimelineReached) {
    p7DrawTimelineSquares(ctx, W, H);
    // Same as drawFold7 above: wipe only once the reverse cascade has actually
    // finished, never on the currentPage crossing itself.
    if (!p7HasEngaged && !p7AnyAnimActive()) { p7RealTimelineReached = false; p7ResetForReplay(); }
  }
  if (p7AxisTriggerIfNeeded()) p7DrawYearAxis(ctx, W, H);
}

function draw() {
  const W = canvas.clientWidth, H = canvas.clientHeight;
  // While the fold13 dot morph is active (forward or reverse), keep calling
  // drawPage12 regardless of currentPage — drawPage9 suppresses the extreme
  // dots when morphT > 0 (to avoid ghosting under the overdraw), so if
  // currentPage has already flipped back to 10, those dots would vanish until
  // morphT hits 0 and snap back instead of animating.
  if ((p9?.fold13ExtremeMorphT ?? 0) > 0) {
    drawPage12(ctx, W, H);
  } else {
    PAGES[currentPage](ctx, W, H);
  }
}

function init() {
  const dpr  = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

// .text-card-frame's dashed border (see style.css for why this isn't plain
// CSS `border: dashed` or a border-image 9-slice) — sizes/inserts an inline
// SVG <rect> per frame whose viewBox always matches that frame's own actual
// pixel box, so the 2px-dash/2px-gap stroke and 8px radius render exactly,
// with no scaling distortion regardless of the frame's aspect ratio.
//
// The rect's path is inset 1px (half the 2px stroke-width) so the stroke
// straddles the frame's true outer edge, same as a normal CSS border. Its
// own rx/ry is therefore 8-1=7, not 8: CSS `border-radius: 8px` centers its
// corner arc 8px in from the box's true edge, but a path already inset by
// 1px with rx=8 would center its arc 9px in — drawing a visibly different
// curve from the white background's actual border-radius clip at every
// corner. rx=7 on the inset path puts the stroke's *outer* edge (path
// radius + the 1px the stroke extends outward) back on radius 8, matching
// the background's curve exactly.
// A 2px-dash/2px-gap pattern only closes cleanly if the outline's perimeter
// happens to be a whole multiple of the 4px period — otherwise the run that
// wraps past the path's start point lands on top of the first dash, which
// reads as a thick blot at the top-left corner (where both these shapes
// start). So the period is stretched/squeezed to the nearest exact fit
// instead: the deviation from 2px is under a couple of percent on any real
// box, and invisible, where the collision was not.
const DASH_PERIOD = 4;
function fitDashArray(geomEl) {
  const len = geomEl.getTotalLength ? geomEl.getTotalLength() : 0;
  if (!len) return `${DASH_PERIOD / 2} ${DASH_PERIOD / 2}`;
  const period = len / Math.max(1, Math.round(len / DASH_PERIOD));
  return `${period / 2} ${period / 2}`;
}

function updateTextCardFrameDashes() {
  document.querySelectorAll(".text-card-frame").forEach((frame) => {
    const w = frame.offsetWidth, h = frame.offsetHeight;
    if (w === 0 || h === 0) return;
    let svg = frame.querySelector(":scope > svg.text-card-frame-dash");
    let rect;
    if (!svg) {
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "text-card-frame-dash");
      rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("fill", "none");
      rect.setAttribute("stroke", "#000");
      rect.setAttribute("stroke-width", "2");
      rect.setAttribute("stroke-dasharray", "2 2");
      rect.setAttribute("rx", "7");
      rect.setAttribute("ry", "7");
      svg.appendChild(rect);
      frame.insertBefore(svg, frame.firstChild);
    } else {
      rect = svg.firstElementChild;
    }
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    rect.setAttribute("x", 1);
    rect.setAttribute("y", 1);
    rect.setAttribute("width", Math.max(0, w - 2));
    rect.setAttribute("height", Math.max(0, h - 2));
    rect.setAttribute("stroke-dasharray", fitDashArray(rect));
  });
}

// The event-dot hover tooltip's dash, drawn exactly like the title cards'
// above (same 2px stroke, same 2 2 dasharray, same 1:1 viewBox trick — see
// .page9-tooltip in style.css for why a native dashed border won't do). Two
// differences: it's a <path>, not a <rect>, because one corner is square (the
// anchor that sits at the hovered dot — bottom-left normally, bottom-right
// when mirrored), and it strokes currentColor so the per-hover group color
// set by p7HoverInit/p9HoverInit carries through. Called on every hover, since
// the box's height changes with the description's line count.
function updateTooltipDash(tip) {
  // Before measuring, not after — the border is part of the box the offsets
  // report, so a width change has to land first or the viewBox is one call stale.
  tip.style.setProperty("--tip-border-w", TOOLTIP_BORDER_W + "px");
  const w = tip.offsetWidth, h = tip.offsetHeight;
  if (w === 0 || h === 0) return;
  let svg = tip.querySelector(":scope > svg.page9-tooltip-dash");
  let path;
  if (!svg) {
    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "page9-tooltip-dash");
    path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-dasharray", "2 2");
    svg.appendChild(path);
    tip.insertBefore(svg, tip.firstChild);
  } else {
    path = svg.firstElementChild;
  }
  path.setAttribute("stroke-width", TOOLTIP_BORDER_W);
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  // Inset by half the stroke so its outer edge lands on the box's true edge;
  // the radius then puts that outer edge back on the background's own 8px
  // border-radius, same as the title cards' rx=7 against a 2px stroke.
  const i = TOOLTIP_BORDER_W / 2, r = Math.max(0, 8 - i), R = w - i, B = h - i;
  const mirrored = tip.classList.contains("is-mirrored");
  const br = mirrored ? 0 : r, bl = mirrored ? r : 0;
  const arc = (rad, dx, dy) => (rad ? `a${rad},${rad} 0 0 1 ${dx},${dy}` : "");
  path.setAttribute(
    "d",
    `M${i + r},${i}` +
      `H${R - r}${arc(r, r, r)}` +
      `V${B - br}${arc(br, -br, br)}` +
      `H${i + bl}${arc(bl, -bl, -bl)}` +
      `V${i + r}${arc(r, r, -r)}Z`
  );
  path.setAttribute("stroke-dasharray", fitDashArray(path));
}

