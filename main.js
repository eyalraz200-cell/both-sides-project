const canvas = document.getElementById("canvas");
const ctx    = canvas.getContext("2d");

// drawFold5/drawFold7/drawFold9 are tiny inline background-only functions
// (see below) — these folds' only visual content is the DOM overlay, like
// drawPage2/drawPage3/drawPage4.
const PAGES = [drawPage1, drawPage2, drawPage3, drawPage4, drawFold5, drawPage5, drawFold7, drawFold9, drawPage7, drawPage8, drawPage9];
let currentPage = 0;

function drawBackground(ctx, W, H) {
  ctx.fillStyle = "#FDFCFF";
  ctx.fillRect(0, 0, W, H);
  // The vignette is a single CSS layer (.vignette in style.css) spanning the whole
  // viewport — canvas + text column together — so there's no seam at the column edge.
}

// Fold 5 (id #page-4) — see GROUPS/updateGroups below for its actual content,
// all DOM overlay, nothing canvas-drawn.
function drawFold5(ctx, W, H) {
  drawBackground(ctx, W, H);
}

// Fold 7 (id #page-6, Figma node 120:1299) — just the timeline's intro title
// now. The real pinned scrub section (drawPage7/page7-scrub) lives at
// #page-8, *after* fold 9, specifically so the real per-event reveal
// doesn't engage until then — bundling them together (the original
// structure) meant the real dot-grid started growing the instant this
// title appeared, clashing with fold 6-9's own curated squares for the
// entire ~7-viewport scrub range. Plain background only here.
function drawFold7(ctx, W, H) {
  drawBackground(ctx, W, H);
}

// Fold 9 (id #page-7, Figma node 162:63876) — see GROUPS/updateGroups below
// for its actual DOM-overlay content (the fold-6 squares losing their
// labels and gaining group colors). Plain background only here too, same
// reasoning as fold 7 above.
function drawFold9(ctx, W, H) {
  drawBackground(ctx, W, H);
}

function draw() {
  const W = canvas.clientWidth, H = canvas.clientHeight;
  PAGES[currentPage](ctx, W, H);
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
// The rect's path is inset 2px (half the 4px stroke-width) so the stroke
// straddles the frame's true outer edge, same as a normal CSS border. Its
// own rx/ry is therefore 8-2=6, not 8: CSS `border-radius: 8px` centers its
// corner arc 8px in from the box's true edge, but a path already inset by
// 2px with rx=8 would center its arc 10px in — drawing a visibly different
// curve from the white background's actual border-radius clip at every
// corner. rx=6 on the inset path puts the stroke's *outer* edge (path
// radius + the 2px the stroke extends outward) back on radius 8, matching
// the background's curve exactly.
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
      rect.setAttribute("stroke-width", "4");
      rect.setAttribute("stroke-dasharray", "2 2");
      rect.setAttribute("rx", "6");
      rect.setAttribute("ry", "6");
      svg.appendChild(rect);
      frame.insertBefore(svg, frame.firstChild);
    } else {
      rect = svg.firstElementChild;
    }
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    rect.setAttribute("x", 2);
    rect.setAttribute("y", 2);
    rect.setAttribute("width", Math.max(0, w - 4));
    rect.setAttribute("height", Math.max(0, h - 4));
  });
}

// ── Scrollytelling: which text section is active drives the pinned canvas ──
const sections = Array.from(document.querySelectorAll(".text-section"));

// Dev-only @foldN tag (see CLAUDE.md's fold reference table) — sections are
// already in page-0..page-10 DOM order, which is exactly @foldN's own
// 1-indexed order, so the array index needs no further mapping.
sections.forEach((sec, i) => {
  const marker = document.createElement("span");
  marker.className = "fold-marker";
  marker.textContent = String(i + 1);
  sec.appendChild(marker);
});

function setActivePage(page) {
  if (page === currentPage) return;
  currentPage = page;
  updateGroups();
  draw();
}

const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) setActivePage(Number(entry.target.dataset.page));
  });
}, { rootMargin: "-50% 0px -50% 0px", threshold: 0 });

sections.forEach(sec => sectionObserver.observe(sec));

// ── Page 7's tall section (#page-8) is a pure scroll-driver: scroll position
// -> date. Its own intro title used to be fused in here as a static header
// above the timeline's month list — it's now its own earlier fold (#page-6,
// "כל ריבוע..."), with fold 9 ("צבע הריבוע...", #page-7) after it, so the
// real per-event reveal below doesn't engage until both have been scrolled
// past. ──
const page7Section = document.getElementById("page-8");
let page7Ticking = false;

function page7UpdateFromScroll() {
  const rect = page7Section.getBoundingClientRect();

  // t=0 when the section's top reaches the viewport top, t=1 one scrub-range of scrolling
  // later. The scrub range is the section height minus one viewport height — that trailing
  // viewport height is slack reserved so the date axis (p7DrawYearAxis in page7.js) finishes
  // growing before the section releases (see .page7-scrub in style.css).
  const scrubRange = rect.height - window.innerHeight;
  const t = scrubRange > 0 ? Math.max(0, Math.min(1, -rect.top / scrubRange)) : 0;

  if (!p7.ready) return;
  const minD = new Date(p7.minDate + "T00:00:00Z");
  const maxD = new Date(p7.maxDate + "T00:00:00Z");
  const totalDays = Math.round((maxD - minD) / 86400000);
  const cur = new Date(minD);
  cur.setUTCDate(cur.getUTCDate() + Math.round(t * totalDays));
  p7.currentDate = cur.toISOString().slice(0, 10);

  if (currentPage === 8) draw();
}

window.addEventListener("scroll", () => {
  if (page7Ticking) return;
  page7Ticking = true;
  requestAnimationFrame(() => { page7UpdateFromScroll(); page7Ticking = false; });
}, { passive: true });

// ── Folds 2 through 5 (ids #page-1..#page-4) all show the same 9 political
// groups — first as fold 2's legend, then scattered (fold 3), then split into
// a cluster + dimmed scatter (fold 4), then cluster + a horizontal row (fold
// 5). Rather than a separate overlay per fold crossfading into the next
// (which made the handoffs visibly "pop" — two different DOM nodes for the
// same group, swapped at the exact instant their positions matched), there's
// ONE persistent .group-item per group here, continuously repositioned and
// restyled as the user scrolls. GROUPS below holds each group's Figma-derived
// coordinate at each stage (fold3/fold4; the legend and fold-5-row stages are
// computed, not stored — see LEGEND_X/Y and the fold5 row scaffold). Matched
// across stages by color, not label: a group's label text gets abbreviated
// between folds (e.g. fold 3's "מתנגדי הרפורמה המשפטית" is fold 4's
// "מתנגדי הרפורמה"), but its color never changes. All coordinates are read
// straight off the shared 1512×982 Figma frame and rescaled to the canvas's
// actual size. ──
const GROUPS_FRAME_W = 1512, GROUPS_FRAME_H = 982;

// fold4.x is always the SWATCH's own anchor point (matching every other
// coordinate in this file), computed from Figma's metadata (117:788) as
// container-left + the swatch sub-node's own offset within it — NOT the
// container's left edge itself, which for label-first items is the
// label's position, not the swatch's. swatchFirst reflects which side the
// swatch actually renders on (derived from absolute x: swatch-x vs
// label-x), which is the opposite of "which child comes first in Figma's
// node tree" — only the 3 right-wing items (מתיישבים/פעילי ימין/חרדים) flip
// away from fold 3's universal swatch-right/label-left; everything else,
// including the 4 dimmed/unaffiliated groups, keeps that same default.
//
// fold6 (Figma node 120:1279/Frame 3219 — "fold 7" in the user-facing/Figma
// numbering, but driven by the pre-existing page6TitleCardEl, hence the
// name) is the persistent mini-legend the 5 camp groups settle into for
// good: only those 5 groups have it, the 4 no-camp groups stay wherever
// fold 5 faded them out and are simply never visible again.
//
// @nosidegroups (the 4 row:true groups — see CLAUDE.md) deliberately have
// fold3 set equal to their own fold4 coordinates, NOT Figma's own fold-3-frame
// scatter position for them — per explicit instruction, these 4 should already
// be at their fold4 spot by the time @fold2→@fold3 finishes, and sit still
// (a no-op lerp) through @fold3→@fold4, rather than visibly relocating twice.
// Only the 5 camp groups still move fold3→fold4 as two distinct Figma frames.
//
// Reusing Figma's own fold4 numbers verbatim for @nosidegroups (the first cut
// at the rule above) put two of them almost on top of two camp groups' own
// fold3 spots — fine in isolation in either frame, but the two frames were
// never designed to be shown blended together like @fold3 now does. These 4
// shared x/y pairs are hand-placed instead: pulled toward the four corners,
// clear of the 5 camp groups' fold3 positions below AND away from the camp
// cluster's fold4 center (~709-773, ~443-523) — satisfying both "scattered,
// dimmed, away from the cluster" (fold4) and "reads as one naturally spread
// set of 9 dots, no clumps" (fold3) at once, since one pair of coordinates
// now has to serve both frames.
const GROUPS = [
  { color: "#0f766e", label: "ערבים ישראלים",         fold3: { x: 1088, y: 786 },
    fold4: { x: 1088, y: 786, dimmed: true,  swatchFirst: true }, row: true },
  { color: "#7c3aed", label: "יוצאי אתיופיה",         fold3: { x: 1225, y: 167 },
    fold4: { x: 1225, y: 167, dimmed: true,  swatchFirst: true }, row: true },
  // `actor` (the 5 camp groups only) is the events.json/P7_COLORS join key —
  // see p7ActorColor in page7.js, which reads this group's `color` directly
  // so the real per-event canvas dots always match this legend, including
  // after a future color edit here.
  { color: "#65a30d", label: "פעילי ימין",            actor: "Right-wing activists", fold3: { x: 936,  y: 602 },
    fold4: { x: 773,  y: 483, dimmed: false, swatchFirst: false }, fold6: { x: 31, y: 488 } },
  { color: "#6b4f3a", label: "חרדים",                 actor: "Haredi Jews", fold3: { x: 352,  y: 469 },
    fold4: { x: 773,  y: 523, dimmed: false, swatchFirst: false }, fold6: { x: 31, y: 440 } },
  { color: "#2563eb", label: "מתנגדי הרפורמה המשפטית", actor: "Protesters against the government", fold3: { x: 462,  y: 555 },
    // fold4.x nudged from Figma's measured 709 to 713 (matching פעילי שמאל,
    // the other label-leading camp item) — Figma's own frame really does
    // place this swatch ~4-64px left of its neighbors, but per explicit
    // instruction this one diverges from spec to sit flush with its peer.
    fold4: { x: 713,  y: 464, dimmed: false, swatchFirst: true, label: "מתנגדי הרפורמה" }, fold6: { x: 31, y: 464 } },
  { color: "#d946ef", label: "פעילי שמאל",            actor: "left wing activists", fold3: { x: 699,  y: 710 },
    fold4: { x: 713,  y: 502, dimmed: false, swatchFirst: true }, fold6: { x: 31, y: 512 } },
  { color: "#ea580c", label: "מתיישבים",              actor: "settlers", fold3: { x: 908,  y: 321 },
    fold4: { x: 773,  y: 443, dimmed: false, swatchFirst: false }, fold6: { x: 31, y: 536 } },
  { color: "#1b0cea", label: "יוצאי ברית המועצות",     fold3: { x: 197,  y: 236 },
    fold4: { x: 197,  y: 236, dimmed: true,  swatchFirst: true }, row: true },
  { color: "#eacc0c", label: "דרוזים",                fold3: { x: 242,  y: 825 },
    fold4: { x: 242,  y: 825, dimmed: true,  swatchFirst: true }, row: true },
];

const groupsOverlayEl = document.getElementById("groupsOverlay");

const groupItems = GROUPS.map(({ color }) => {
  const el = document.createElement("div");
  el.className = "group-item";
  const swatch = document.createElement("span");
  swatch.className = "group-swatch";
  swatch.style.background = color;
  const label = document.createElement("span");
  label.className = "group-label";
  el.appendChild(swatch);
  el.appendChild(label);
  groupsOverlayEl.appendChild(el);
  return { el, label, swatch };
});

// Fold 5's row order (FOLD5_ROW_X/Y, the Figma anchor for #fold5-top-row,
// node 117:818/Frame 3169) — the 4 groups with no camp ("ערבים ישראלים",
// "יוצאי אתיופיה", "יוצאי ברית המועצות", "דרוזים") that move from fold 4's
// scatter into one line near the BOTTOM of the screen (not under the title —
// the class name is legacy from an earlier top-of-screen layout). Real layout
// (the label-width-dependent spacing) is resolved by an actual flexbox on a
// hidden measurement scaffold (.fold5-top-row, never painted — see
// updateFold5RowTargets), not hand-computed.
const FOLD5_ROW_ORDER = ["#1b0cea", "#eacc0c", "#7c3aed", "#0f766e"];
const FOLD5_ROW_X = 417, FOLD5_ROW_Y = 896;

const fold5RowEl = document.createElement("div");
fold5RowEl.className = "fold5-top-row";
groupsOverlayEl.appendChild(fold5RowEl);
const fold5RowGhosts = FOLD5_ROW_ORDER.map(color => {
  const g = GROUPS.find(it => it.color === color);
  const item = document.createElement("div");
  item.className = "fold5-row-ghost-item";
  const label = document.createElement("span");
  label.textContent = g.fold4.label || g.label;
  const swatch = document.createElement("span");
  swatch.className = "fold5-row-ghost-swatch";
  swatch.style.background = color;
  item.appendChild(label);
  item.appendChild(swatch);
  fold5RowEl.appendChild(item);
  return swatch;
});

let fold5RowTargets = {};
function updateFold5RowTargets(W, H) {
  fold5RowEl.style.left = `${(FOLD5_ROW_X / GROUPS_FRAME_W) * W}px`;
  fold5RowEl.style.top  = `${(FOLD5_ROW_Y / GROUPS_FRAME_H) * H}px`;
  // Scale the whole row (font, swatches, gaps — all authored at Figma's raw
  // pixel values) by the same W/1512 factor as its left/top anchor above,
  // anchored at its own top-left corner (transform-origin), so its rendered
  // width tracks Figma's 600-unit-wide Frame 3169 proportionally instead of
  // staying fixed-size while only its anchor point moves — which used to
  // drag the whole row visibly left of Figma's intended (near-center)
  // position on any viewport wider than the 1512px Figma frame.
  fold5RowEl.style.transform = `scale(${W / GROUPS_FRAME_W})`;
  fold5RowTargets = {};
  fold5RowGhosts.forEach((swatch, i) => {
    const r = swatch.getBoundingClientRect();
    fold5RowTargets[FOLD5_ROW_ORDER[i]] = { x: r.left, y: r.top };
  });
}

// 10 small static squares (Figma node 120:1279, fold 6; labeled in node
// 120:1299, fold 7) that fade in at the center, taking the cluster's vacated
// spot as it moves into fold6's left mini-legend. One fixed column, x
// constant, y values copied straight off Figma (not a uniform formula —
// the real gaps vary by half a pixel here and there). Each one is
// unlabeled through fold 6, gains its action-type label once fold 7
// (#page-6, the timeline's intro title) is actually reached, then loses
// that label again and gains a group color in fold 9 (Figma node 162:63876
// only assigns colors to the first 5 — see FOLD6_SQUARE_COLORS/fold9Trigger
// for why all 10 get one anyway) — same "secondary attribute can snap,
// position never does" rule as everywhere else, since nothing here needs to
// move for any of it.
// The 10th (פוגרום/Pogrom) has no entry in fold 7's own Figma frame — it was
// initially dropped as a stray duplicate node, but the real events dataset
// (events.json, "event category") confirmed it as a genuine 10th category,
// so it's kept at Figma's original last-row position.
const FOLD6_SQUARES_X = 754;
const FOLD6_SQUARES_Y = [386.5, 415.5, 444.5, 473.5, 502.5, 531.5, 560.5, 589.5, 618.5, 648];
const FOLD6_SQUARE_LABELS = [
  "הפגנה בלתי אלימה",
  "חטיפה",
  "הפרות סדר",
  "הטרדה ואיומים",
  "תקיפה פיזית של בלתי מעורב",
  "השתלטות על שטח",
  "פגיעה ברכוש",
  "חסימת כביש",
  "תקיפה חמושה של בלתי מעורב",
  "פוגרום",
];
// Figma (node 162:63876) only explicitly colors the first 5 — the other 5
// have no entry there. Per explicit instruction all 10 still get a group
// color rather than staying black, so squares 5-9 just cycle back through
// the same 5 colors (index i+5 mirrors index i) — a deviation from Figma,
// not a gap in it. Reads GROUPS' own `color` (by `actor`, the same join key
// p7ActorColor in page7.js uses) rather than a second hardcoded hex list, so
// a future color edit on GROUPS updates these squares too.
function groupColorByActor(actor) {
  return GROUPS.find(g => g.actor === actor).color;
}
const FOLD6_SQUARE_COLORS_5 = [
  groupColorByActor("Haredi Jews"),               // חרדים
  groupColorByActor("Right-wing activists"),      // פעילי ימין
  groupColorByActor("settlers"),                  // מתיישבים
  groupColorByActor("Protesters against the government"), // מתנגדי הרפורמה
  groupColorByActor("left wing activists"),       // פעילי שמאל
];
const FOLD6_SQUARE_COLORS = [...FOLD6_SQUARE_COLORS_5, ...FOLD6_SQUARE_COLORS_5];

const fold6SquaresOverlayEl = document.getElementById("fold6SquaresOverlay");
const fold6SquareEls = FOLD6_SQUARES_Y.map((_, i) => {
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

// Lerps a fold-6 square's background from its fold-8 black (.9 alpha) toward
// a target group color (full opacity) as t goes 0->1 — null targetHex (the 5
// squares with no Figma-assigned color) just stays at that same black.
function lerpFold6SquareColor(targetHex, t) {
  if (!targetHex) return "rgba(0, 0, 0, 0.9)";
  const n = parseInt(targetHex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const a = 0.9 + (1 - 0.9) * t;
  return `rgba(${Math.round(r * t)}, ${Math.round(g * t)}, ${Math.round(b * t)}, ${a})`;
}

function layoutFold6Squares(W, H) {
  const x = (FOLD6_SQUARES_X / GROUPS_FRAME_W) * W;
  fold6SquareEls.forEach(({ wrap }, i) => {
    wrap.style.left = `${x}px`;
    wrap.style.top  = `${(FOLD6_SQUARES_Y[i] / GROUPS_FRAME_H) * H}px`;
  });
}

const page2TitleCardEl = document.querySelector("#page-1 .text-card");
const page3TitleCardEl = document.querySelector("#page-2 .text-card");
const page4TitleCardEl = document.querySelector("#page-3 .text-card");
const page5TitleCardEl = document.querySelector("#page-4 .text-card");
const page6TitleCardEl = document.querySelector("#page-5 .text-card");
const page7TitleCardEl = document.querySelector("#page-7 .text-card");
// Fold 7's own card (#page-6, "כל ריבוע מייצג..." — the timeline-intro title,
// not to be confused with page7TitleCardEl above, which is fold 9's #page-7
// card) drives the fold-6 squares' labels fading IN, mirroring fold9Trigger
// fading them back out below — previously this had no card of its own and
// just snapped on the instant fold6Trigger settled, which (now that that's a
// fixed ~1s tween instead of a scroll-coupled one) finishes long before the
// user actually reaches fold 7.
const fold7LabelCardEl = document.querySelector("#page-6 .text-card");

// Generic discrete trigger: a fixed-duration 0<->1 phase fired once by
// crossing a scroll threshold (see watchCardThreshold below), exactly like
// p8Trigger/p8TriggerReverse (page8.js) and p9TriggerLine (page9.js) — never
// re-derives progress from live scroll position, so reversing mid-flight
// covers only the remaining distance rather than restarting.
function makeTrigger(duration, onTick) {
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
  function set(target) {
    fromT = target;
    toT = target;
    phaseStart = null;
  }

  return { currentRaw, currentT: () => p9Ease(currentRaw()), trigger, set };
}

// Fold 3/4/6/9 each fire once, at their card's center crossing. Fold 5 fires
// twice — see FOLD5_ROW_ORDER above and watchCardThreshold below — once as
// its card enters the viewport (the row-enter glide) and again at center
// (that row's fade-out), since CLAUDE.md's fold 5 already specs those as two
// sequential, non-overlapping phases.
//
// All 8 share one duration so the whole legend system reads as a single
// consistent tempo rather than each fold having its own slightly different
// feel — they used to range from 600ms to 1600ms.
const GROUP_TRANSITION_MS = 1900;
const fold2Trigger      = makeTrigger(GROUP_TRANSITION_MS, updateGroups);
const fold3Trigger      = makeTrigger(GROUP_TRANSITION_MS, updateGroups);
const fold4Trigger      = makeTrigger(GROUP_TRANSITION_MS, updateGroups);
const fold5EnterTrigger = makeTrigger(GROUP_TRANSITION_MS, updateGroups);
const fold5FadeTrigger  = makeTrigger(GROUP_TRANSITION_MS, updateGroups);
const fold6Trigger      = makeTrigger(GROUP_TRANSITION_MS, updateGroups);
const fold7LabelTrigger = makeTrigger(GROUP_TRANSITION_MS, updateGroups);

// Fold 9's own two beats are real triggers too (same makeTrigger/
// watchCardThreshold machinery as every fold above), but deliberately don't
// share GROUP_TRANSITION_MS — that 1900ms is tuned for beats that only need
// to *start* at the right scroll position and can keep animating loosely
// after that. Fold 9's beats are pinned to a specific screen position
// ("before the midpoint", "as the card leaves the screen"), and at any
// realistic scroll speed 1900ms is long enough that the user scrolls well
// past that position before the tween finishes — confirmed by scrolling
// through it: the color was still barely-tinted black by the time the card
// reached center. A short, dedicated duration plus firing with a real buffer
// before the target position is what actually gets the tween to *finish*
// where it's supposed to, not just start there.
const FOLD9_TRANSITION_MS = 120;
const fold9Trigger            = makeTrigger(FOLD9_TRANSITION_MS, updateGroups);
const fold9SquaresFadeTrigger = makeTrigger(FOLD9_TRANSITION_MS, updateGroups);

// Watches one title card's top edge for crossing H*frac, firing trigger
// forward (1) on a downward crossing and reverse (0) on scrolling back up
// past the same point. The first ever call just primes isPast against
// whatever the starting scroll position already is (via trigger.set, no
// animation) — otherwise a page load/refresh mid-scroll would play every
// already-passed fold's animation from scratch on the first scroll tick.
function watchCardThreshold(cardEl, frac, trigger) {
  let isPast = null;
  return function check() {
    if (!cardEl) return;
    const nowPast = cardEl.getBoundingClientRect().top <= window.innerHeight * frac;
    if (isPast === null) { isPast = nowPast; trigger.set(nowPast ? 1 : 0); return; }
    if (nowPast !== isPast) { isPast = nowPast; trigger.trigger(nowPast ? 1 : 0); }
  };
}

// Fold 2's legend (the groups overlay's first appearance) used to fade in via
// the generic section-level IntersectionObserver (currentPage >= 1), which
// fires at the .page2-panel section's own midpoint rather than the title
// card's — those don't line up since the section carries extra scroll-height
// for choreography. Tying it to the title card directly (same 0.5 convention
// and makeTrigger/watchCardThreshold machinery as every other fold) keeps the
// legend's appearance in sync with its own title, and gives it a t (below) to
// stagger the 9 rows' entrance off of.
const checkFold2      = watchCardThreshold(page2TitleCardEl, 0.5, fold2Trigger);
const checkFold3      = watchCardThreshold(page3TitleCardEl, 0.5, fold3Trigger);
const checkFold4      = watchCardThreshold(page4TitleCardEl, 0.5, fold4Trigger);
const checkFold5Enter = watchCardThreshold(page5TitleCardEl, 1.0, fold5EnterTrigger);
const checkFold5Fade  = watchCardThreshold(page5TitleCardEl, 0.5, fold5FadeTrigger);
const checkFold6      = watchCardThreshold(page6TitleCardEl, 0.5, fold6Trigger);
const checkFold7Label = watchCardThreshold(fold7LabelCardEl, 0.5, fold7LabelTrigger);
// Fires while the card is still well below center (frac=0.7, vs. every
// other fold's 0.5) — FOLD9_TRANSITION_MS is very short (120ms) specifically
// so it can actually finish in the time it takes to scroll the rest of the
// way to the midpoint, but that only works if it's given enough of a head
// start; firing right at/just-before center (like the first version of this
// did) leaves no runway and the tween visibly finishes well past it.
const checkFold9 = watchCardThreshold(page7TitleCardEl, 0.7, fold9Trigger);
// Mirrors checkFold9's reasoning for the squares' disappearance: fires with
// real margin before the card is fully gone (frac=0.2, not frac≈0 like the
// very first version), so the short tween has room to land by the time the
// card actually crosses the top of the screen.
const checkFold9SquaresFade = watchCardThreshold(page7TitleCardEl, 0.2, fold9SquaresFadeTrigger);

function checkGroupTriggers() {
  checkFold2(); checkFold3(); checkFold4(); checkFold5Enter(); checkFold5Fade(); checkFold6(); checkFold7Label(); checkFold9(); checkFold9SquaresFade();
}

// Default (legend/fold3/fold4/fold5) swatch size + the swatch-to-label gap
// established earlier — vs. the smaller mini-legend ones (Figma node
// 120:1279/Frame 3219), interpolated continuously by fold6Trigger rather
// than snapped, same "seamless, no popping" rule as every other transition.
const CLUSTER_SWATCH_SIZE = 13, CLUSTER_LABEL_GAP = 12;
const LEFT_LEGEND_SWATCH_SIZE = 6, LEFT_LEGEND_LABEL_GAP = 6;

const LEGEND_TOP_FRAC = 267 / 982; // Figma node 119:969's top, in the 982px-tall fold-2 frame
const LEGEND_ROW_GAP = 59; // 13px swatch + 46px gap, matches the legend's old static layout

// Fold 2's entrance staggers the 9 rows bottom-to-top rather than fading the
// whole legend in as one block — each row's own fade window is offset from
// the previous by FOLD2_STAGGER along fold2Trigger's shared 0..1 timeline, so
// row i (0 = top row) starts at (GROUPS.length-1-i)*FOLD2_STAGGER — the
// bottom row (highest index) starts first — and (like every row) takes up
// FOLD2_SPAN of that timeline to reach full opacity. FOLD2_SPAN is whatever's
// left once all 8 gaps between 9 rows are accounted for, so the top row still
// finishes exactly at t=1, same "reaches its target exactly at t=1" rule
// every other stage's lerps already follow.
const FOLD2_STAGGER = 0.08;
const FOLD2_SPAN = 1 - FOLD2_STAGGER * (GROUPS.length - 1);

// Every group's position is one continuous chain of lerps — legend → fold3 →
// fold4 → fold5 — driven by each stage's own t. Once a given t reaches 1 the
// position is exactly that stage's target (no residual blend), so this is
// equivalent to the old discrete per-fold layout at rest, but never snaps
// between two different DOM nodes to get there.
function updateGroups() {
  const W = canvas.clientWidth, H = canvas.clientHeight;
  const e2 = fold2Trigger.currentT();
  const e3 = fold3Trigger.currentT(), e4 = fold4Trigger.currentT(), e5 = fold5EnterTrigger.currentT(),
        e5Fade = fold5FadeTrigger.currentT(), e6 = fold6Trigger.currentT();
  const legendX = W / 2 - 13, legendTop = LEGEND_TOP_FRAC * H;

  GROUPS.forEach((g, i) => {
    const item = groupItems[i];

    let x = legendX, y = legendTop + i * LEGEND_ROW_GAP;
    const fold3Pos = { x: (g.fold3.x / GROUPS_FRAME_W) * W, y: (g.fold3.y / GROUPS_FRAME_H) * H };
    x += (fold3Pos.x - x) * e3; y += (fold3Pos.y - y) * e3;
    const fold4Pos = { x: (g.fold4.x / GROUPS_FRAME_W) * W, y: (g.fold4.y / GROUPS_FRAME_H) * H };
    x += (fold4Pos.x - x) * e4; y += (fold4Pos.y - y) * e4;
    const fold5Pos = g.row ? fold5RowTargets[g.color] : fold4Pos;
    if (fold5Pos) { x += (fold5Pos.x - x) * e5; y += (fold5Pos.y - y) * e5; }

    // Only the 5 camp groups have a fold6 target (the mini-legend) — the 4
    // no-camp groups stay wherever fold 5 already faded them out to.
    let swatchSize = CLUSTER_SWATCH_SIZE, labelGap = CLUSTER_LABEL_GAP;
    if (g.fold6) {
      const fold6Pos = { x: (g.fold6.x / GROUPS_FRAME_W) * W, y: (g.fold6.y / GROUPS_FRAME_H) * H };
      x += (fold6Pos.x - x) * e6; y += (fold6Pos.y - y) * e6;
      swatchSize += (LEFT_LEGEND_SWATCH_SIZE - CLUSTER_SWATCH_SIZE) * e6;
      labelGap   += (LEFT_LEGEND_LABEL_GAP - CLUSTER_LABEL_GAP) * e6;
    }

    item.el.style.left = `${x}px`;
    item.el.style.top  = `${y}px`;
    // Entrance: row i fades in over its own slice of fold2Trigger's timeline,
    // top row first. Once that's resolved, only the 4 no-camp row groups fade
    // back out at fold 5 — the cluster of 5 stays visible into the mini-legend
    // and beyond — so the two fades multiply rather than override each other.
    const entranceT = Math.max(0, Math.min(1, (e2 - (GROUPS.length - 1 - i) * FOLD2_STAGGER) / FOLD2_SPAN));
    item.el.style.opacity = String(entranceT * (g.row ? 1 - e5Fade : 1));

    item.swatch.style.width  = `${swatchSize}px`;
    item.swatch.style.height = `${swatchSize}px`;
    // Label's vertical anchor must track the swatch's own shrinking center
    // (13px cluster -> 6px mini-legend, same e6 lerp as swatchSize above) —
    // a fixed CSS top would stay centered on the swatch's *original* size
    // and drift off-center as the swatch shrinks.
    item.label.style.top = `${swatchSize / 2}px`;

    // Text content still only changes at the postFold3 threshold — a true
    // binary with no in-between (a label can't partially become a different
    // string). fontSize/fontWeight/color DO have a meaningful in-between
    // though, so they lerp continuously over e6 instead of snapping —
    // 18px/400/opaque-black is is-emphasized's resting state, so e6 = 0
    // reproduces the old pre-fold6 look exactly, with no seam.
    const postFold3 = fold4Trigger.currentRaw() >= 0.5;
    const postFold6 = !!g.fold6 && fold6Trigger.currentRaw() >= 0.5;
    item.label.textContent = postFold3 ? (g.fold4.label || g.label) : g.label;
    if (g.fold6 && postFold3) {
      item.label.style.fontSize   = `${18 + (14 - 18) * e6}px`;
      item.label.style.fontWeight = String(400 + (300 - 400) * e6);
      item.label.style.color      = `rgba(0, 0, 0, ${1 + (0.46 - 1) * e6})`;
    } else {
      item.label.style.fontSize   = "";
      item.label.style.fontWeight = "";
      item.label.style.color      = "";
    }

    // Which side the label sits on is just another continuous lerp now too —
    // sideT 0 is the legend's universal "label trails the swatch" layout, 1
    // is "label leads, swatch trails", chained through fold4's per-item
    // layout (e4) and, for the 5 camp groups, fold6's mini-legend layout
    // (e6) — same chaining as x/y above — instead of snapping at the
    // postFold3/postFold6 thresholds. Both endpoints are expressed as the
    // label's own `left` (reading its actual rendered width, since the
    // swatch-first endpoint has no explicit width to anchor from) so it
    // glides across the swatch instead of teleporting to the other side.
    let sideT = 0;
    sideT += ((g.fold4.swatchFirst ? 0 : 1) - sideT) * e4;
    if (g.fold6) sideT += (1 - sideT) * e6;
    const labelWidth = item.label.offsetWidth;
    const leftAsSwatchFirst = -(labelGap + labelWidth);
    const leftAsLabelLeads  = swatchSize + labelGap;
    item.label.style.left  = `${leftAsSwatchFirst + (leftAsLabelLeads - leftAsSwatchFirst) * sideT}px`;
    item.label.style.right = "";

    item.el.classList.toggle("is-dimmed", postFold3 && g.fold4.dimmed && !postFold6);
    item.el.classList.toggle("is-emphasized", postFold3 && !g.fold4.dimmed && !postFold6);
  });

  groupsOverlayEl.classList.toggle("is-active", fold2Trigger.currentRaw() > 0);
  // Fades the whole curated-squares overlay out as fold 9's own card finally
  // scrolls past (fold9SquaresFadeTrigger, see its comment above), rather
  // than snapping to 0 — these curated squares have nothing further to do by
  // then, and leaving them up would clash with the real per-event squares
  // appearing in the same spot, but the handoff itself should still glide.
  const e9SquaresFade = fold9SquaresFadeTrigger.currentT();
  fold6SquaresOverlayEl.style.opacity = String(e6 * (1 - e9SquaresFade));

  // Labels fade in via their own trigger (fold7LabelTrigger, fold 7's own
  // card) once that title is reached, then fade back out as fold 9's
  // color-in (e9) takes over — both happen together, one beat: the square
  // gains its color exactly as its label disappears. The squares'
  // *complete* disappearance is a separate, later beat — see
  // fold9SquaresFadeTrigger/e9SquaresFade above, not this one.
  const e7Label = fold7LabelTrigger.currentT();
  const e9 = fold9Trigger.currentT();
  fold6SquareEls.forEach(({ sq, label }, i) => {
    label.style.opacity = String(e7Label * (1 - e9));
    sq.style.background = lerpFold6SquareColor(FOLD6_SQUARE_COLORS[i], e9);
  });
}

function layoutGroups() {
  const W = canvas.clientWidth, H = canvas.clientHeight;
  updateFold5RowTargets(W, H);
  layoutFold6Squares(W, H);
  updateGroups();
}

let groupsTicking = false;
window.addEventListener("scroll", () => {
  if (groupsTicking) return;
  groupsTicking = true;
  requestAnimationFrame(() => { checkGroupTriggers(); groupsTicking = false; });
}, { passive: true });

// ── Page 8 holds page7's final layout until its title actually reaches the
// viewport's vertical center — not just whenever currentPage flips to 9, which
// (via the -50% IntersectionObserver above) can fire slightly before the title
// has visually settled there. That crossing triggers p8Trigger (page8.js), which
// plays a fixed-duration glide toward page9's starting layout entirely on its
// own clock — scrolling is never blocked, so the title is free to keep scrolling
// past while the glide plays in the background. Scrolling back up past that same
// point (recorded as p8TriggerScrollY) plays the glide back in reverse via
// p8TriggerReverse, once currentPage has made it back to 9. ──
const page8TitleEl = document.querySelector("#page-9 .section-title");
let page8Ticking = false;

function page8CheckScroll() {
  if (!p8Engaged) {
    const rect = page8TitleEl.getBoundingClientRect();
    const titleCenter = rect.top + rect.height / 2;
    if (titleCenter <= window.innerHeight / 2) p8Trigger();
  } else if (currentPage === 9 && p8TriggerScrollY !== null && window.scrollY < p8TriggerScrollY) {
    p8TriggerReverse();
  }
}

window.addEventListener("scroll", () => {
  if (page8Ticking) return;
  page8Ticking = true;
  requestAnimationFrame(() => { page8CheckScroll(); page8Ticking = false; });
}, { passive: true });

// ── Page 9's title (.page9-title-row) is a normal-flow, continuously-scrolling
// card like every other fold's — no JS positioning of its own. It still drives
// the panel's reveal though, same as every other title card triggers its own
// fold's content (e.g. page8TitleEl/p8Trigger above): once *this* title's own
// center crosses the viewport's vertical center, the canvas-drawn horizontal
// divider (page9.js) plays its fixed-duration grow-in (reverses if scrolled
// back up past that point before settling), and the rest of the panel (axis
// labels, the dragcards tray, the dropped-pill stack) fades in with it — even
// though by then the title itself has already scrolled most of the way past. ──
const page9TitleEl  = document.querySelector("#page-10 .page9-title-row .section-title");
const page9StickyEl = document.querySelector("#page-10 .page9-sticky");
let page9Ticking = false;
let page9LinePast = false; // previous "title past center" state, so the trigger only fires on the transition

function page9UpdateFromScroll() {
  const rect = page9TitleEl.getBoundingClientRect();
  const titleCenter = rect.top + rect.height / 2;
  const titlePastCenter = titleCenter <= window.innerHeight / 2;
  if (titlePastCenter !== page9LinePast) {
    page9LinePast = titlePastCenter;
    p9TriggerLine(titlePastCenter ? 1 : 0);
  }
  page9StickyEl.classList.toggle("engaged", titlePastCenter);
}

window.addEventListener("scroll", () => {
  if (page9Ticking) return;
  page9Ticking = true;
  requestAnimationFrame(() => { page9UpdateFromScroll(); page9Ticking = false; });
}, { passive: true });

// Explicitly load both weights so canvas gets the real font on first draw
Promise.all([
  document.fonts.load("400 24px 'HadassahFriedlaender'"),
  document.fonts.load("100 16px 'HadassahFriedlaender'"),
  document.fonts.load("400 16px 'Assistant'"),
  document.fonts.load("700 16px 'Assistant'"),
]).then(() => {
  initPage7().then(() => { draw(); });
  init();
  checkGroupTriggers();
  layoutGroups();
  updateTextCardFrameDashes();
  // document.fonts.load() above resolves once the font is fetched, but the
  // browser can still apply it to already-laid-out text a tick later — the
  // fold-5 row's measurement scaffold (updateFold5RowTargets) is sensitive
  // to that, since a font swap changes label widths and so the flex gap
  // math, silently leaving fold5RowTargets stale (measured against the
  // fallback font) if not re-measured once fonts.ready actually fires. The
  // title cards' dash overlay has the same sensitivity (a font swap can
  // reflow a title onto a different number of lines, changing the frame's
  // height), so it's re-measured on the same trigger.
  document.fonts.ready.then(() => {
    layoutGroups();
    updateTextCardFrameDashes();
  });
  page7UpdateFromScroll();
  page8CheckScroll();
  page9UpdateFromScroll();
  window.addEventListener("resize", () => {
    init();
    layoutGroups();
    updateTextCardFrameDashes();
  });
});
