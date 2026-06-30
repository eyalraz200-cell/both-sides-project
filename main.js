history.scrollRestoration = "manual";
window.scrollTo(0, 0);

const canvas = document.getElementById("canvas");
const ctx    = canvas.getContext("2d");

// drawFold5/drawFold7/drawFold9 are tiny inline background-only functions
// (see below) — these folds' only visual content is the DOM overlay, like
// drawPage2/drawPage3/drawPage4.
const PAGES = [drawPage1, drawPage2, drawPage3, drawPage4, drawFold5, drawPage5, drawFold7, drawFold9, drawPage7, drawPage8, drawPage9];
let currentPage = 0;

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
// labels and gaining group colors). Background only, except the year axis
// (page7.js) — that one starts appearing here already, gated by
// p7AxisTriggerIfNeeded (its trigger is this very fold's own title card
// reaching viewport center, which also kicks off the axis's one-shot build-in
// wipe), rather than waiting until currentPage actually flips to fold 9/#page-8.
// p7DrawYearAxis itself is still also called from drawPage7, since the axis
// needs to keep drawing for the whole rest of the timeline.
function drawFold9(ctx, W, H) {
  drawBackground(ctx, W, H);
  if (!p7.ready) return;
  p7UpdateEngagement(); // keeps p7HasEngaged live while scrolling back through this fold too (page7.js)
  if (p7AxisTriggerIfNeeded()) p7DrawYearAxis(ctx, W, H);
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

// ── @fold1's logo and scroll-down cue fade out in place as soon as the user
// starts scrolling, rather than scrolling away with the rest of @fold1 (per
// explicit instruction — title/subtitle still scroll normally, only these
// two are exempted). Both are position: fixed (style.css), so without this
// they'd just sit frozen on screen forever; this is what actually clears
// them. Fully faded by PAGE0_FADE_VH of scrolling — short on purpose, since
// the scroll cue's only job is done the instant the user acts on it.
//
// Gated on page0EntranceDone (set by playPage0Entrance below) so this
// scroll-driven control doesn't fight the page-load entrance animation,
// which owns both elements' opacity (fading them in from 0) until it
// finishes — see playPage0Entrance. ──
const page0LogoEl = document.querySelector(".page0-logo");
const page0ScrollEl = document.querySelector(".page0-scroll");
const page0TitleEl = document.querySelector(".page0-title");
const page0SubtitleEl = document.querySelector(".page0-subtitle");
const PAGE0_FADE_VH = 0.4; // fraction of one viewport height
let page0Ticking = false;
let page0EntranceDone = false;
page0LogoEl.style.opacity = "0";
page0ScrollEl.style.opacity = "0";
// Starting position for the entrance below (full off-screen, same vh unit
// the rest of @fold1 already uses) — set synchronously here, before first
// paint, rather than via a CSS class, so there's no flash of the title at
// its final position before playPage0Entrance's first animation frame.
page0TitleEl.style.transform = "translateY(100vh)";
page0SubtitleEl.style.transform = "translateX(-100%) translateY(100vh)";

function page0UpdateFromScroll() {
  if (!page0EntranceDone) return;
  const raw = Math.max(0, Math.min(1, window.scrollY / (window.innerHeight * PAGE0_FADE_VH)));
  const opacity = String(1 - p9Ease(raw));
  page0LogoEl.style.opacity = opacity;
  page0ScrollEl.style.opacity = opacity;
  const scrollFrac = Math.max(0, Math.min(1, window.scrollY / window.innerHeight));
  const parallaxPx = scrollFrac * 60;
  page0TitleEl.style.transform = `translateY(${parallaxPx}px)`;
  page0SubtitleEl.style.transform = `translateX(-100%) translateY(${-parallaxPx}px)`;
}

window.addEventListener("scroll", () => {
  if (page0Ticking) return;
  page0Ticking = true;
  requestAnimationFrame(() => { page0UpdateFromScroll(); page0Ticking = false; });
}, { passive: true });

// ── @fold1's page-load entrance, per explicit spec: title/subtitle slide up
// from off-screen first; once they're in place, the dot columns pop in one
// row at a time (both columns synced by syncedRow, see page1.js — the right
// column has 2 more rows than the left, so it starts popping 2 beats
// earlier); once every dot/group-swatch has popped, the logo and scroll cue
// fade in last. All one-shot, page-load-only — has nothing to do with
// scrolling (that's page0UpdateFromScroll above, which stays off until this
// finishes, via page0EntranceDone).
//
// Driven by one requestAnimationFrame loop with p9Ease applied fresh to each
// beat's own local 0..1 progress — same style as every other animation in
// this file (makeTrigger/updateGroups) — rather than CSS transitions, so the
// easing curve and "continuous, recompute every frame" feel actually match
// the rest of the site instead of relying on the browser's own transition
// timing function. Durations are deliberately slow/visible, same register as
// FOLD2_ENTRANCE_MS's multi-beat pacing — this is the user's very first
// impression of the page, not a transition between two states they've
// already seen.
const PAGE0_TITLE_MS = 1700;
const PAGE0_ROW_STAGGER_MS = 40;
const PAGE0_POP_MS = 280;
const PAGE0_LOGO_FADE_MS = 900;
// page0PopT (parallel to GROUPS — each group's own entrance progress, 0..1)
// is declared further down, right after GROUPS itself, since GROUPS doesn't
// exist yet at this point in the script.

function playPage0Entrance() {
  const decorRows = PAGE0_DECORATIVE_DOT_ELS.map((d) => d.syncedRow);
  const groupRows = GROUPS.map((g) => PAGE0_GROUP_DOT_ANCHORS[g.color] && PAGE0_GROUP_DOT_ANCHORS[g.color].syncedRow)
    .filter((r) => r !== undefined);
  const allRows = decorRows.concat(groupRows);
  const maxRow = allRows.length ? Math.max(...allRows) : 0;
  const dotsDoneMs = PAGE0_TITLE_MS + maxRow * PAGE0_ROW_STAGGER_MS + PAGE0_POP_MS;
  const totalMs = dotsDoneMs + PAGE0_LOGO_FADE_MS;
  const start = performance.now();

  function frame() {
    const elapsed = performance.now() - start;

    const titleT = p9Ease(Math.max(0, Math.min(1, elapsed / PAGE0_TITLE_MS)));
    const titleOffsetVh = (1 - titleT) * 100;
    page0TitleEl.style.transform = `translateY(${titleOffsetVh}vh)`;
    const subtitleAlignPx = (107 * (1 - titleT)).toFixed(2);
    page0SubtitleEl.style.transform = `translateX(-100%) translateY(calc(${titleOffsetVh}vh - ${subtitleAlignPx}px))`;

    PAGE0_DECORATIVE_DOT_ELS.forEach((d) => {
      const rowRaw = Math.max(0, Math.min(1, (elapsed - PAGE0_TITLE_MS - d.syncedRow * PAGE0_ROW_STAGGER_MS) / PAGE0_POP_MS));
      const rowT = p9Ease(rowRaw);
      d.el.style.opacity = String(rowT);
      d.el.style.transform = `scale(${rowT})`;
      // Once true, updateGroups()'s @fold2 shrink line (below) takes over
      // this dot's transform every frame instead — needs to land instantly
      // there, not ease through this entrance's own per-row timing.
      if (rowRaw >= 1) d.popped = true;
    });

    GROUPS.forEach((g, i) => {
      const anchor = PAGE0_GROUP_DOT_ANCHORS[g.color];
      // No matching dot this load (very short viewport) — just appear with
      // the rest of the legend system rather than blocking on a row that
      // doesn't exist.
      const syncedRow = anchor ? anchor.syncedRow : 0;
      const rowRaw = Math.max(0, Math.min(1, (elapsed - PAGE0_TITLE_MS - syncedRow * PAGE0_ROW_STAGGER_MS) / PAGE0_POP_MS));
      page0PopT[i] = p9Ease(rowRaw);
    });
    updateGroups();

    const logoT = p9Ease(Math.max(0, Math.min(1, (elapsed - dotsDoneMs) / PAGE0_LOGO_FADE_MS)));
    page0LogoEl.style.opacity = String(logoT);
    page0ScrollEl.style.opacity = String(logoT);

    if (elapsed < totalMs) {
      requestAnimationFrame(frame);
    } else {
      // Handoff to the scroll-driven fade above — harmless even if the user
      // has already scrolled during the entrance, since this just syncs
      // opacity to wherever scroll actually is right now.
      page0EntranceDone = true;
      page0UpdateFromScroll();
    }
  }

  requestAnimationFrame(frame);
}

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

  if (currentPage === 8) { draw(); p7RecheckHover(); }
}

window.addEventListener("scroll", () => {
  if (page7Ticking) return;
  page7Ticking = true;
  requestAnimationFrame(() => { page7UpdateFromScroll(); page7Ticking = false; });
}, { passive: true });

// ── Folds 2 through 5 (ids #page-1..#page-4) all show the same 8 political
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
// including the 3 dimmed/unaffiliated groups, keeps that same default.
//
// fold6 (Figma node 120:1279/Frame 3219 — "fold 7" in the user-facing/Figma
// numbering, but driven by the pre-existing page6TitleCardEl, hence the
// name) is the persistent mini-legend the 5 camp groups settle into for
// good: only those 5 groups have it, the 3 no-camp groups stay wherever
// fold 5 faded them out and are simply never visible again.
//
// @nosidegroups (the 3 row:true groups — see CLAUDE.md) deliberately have
// fold3 set equal to their own fold4 coordinates, NOT Figma's own fold-3-frame
// scatter position for them — per explicit instruction, these 4 should already
// be at their fold4 spot by the time @fold2→@fold3 finishes, and sit still
// (a no-op lerp) through @fold3→@fold4, rather than visibly relocating twice.
// Only the 5 camp groups still move fold3→fold4 as two distinct Figma frames.
//
// Reusing Figma's own fold4 numbers verbatim for @nosidegroups (the first cut
// at the rule above) put two of them almost on top of two camp groups' own
// fold3 spots — fine in isolation in either frame, but the two frames were
// never designed to be shown blended together like @fold3 now does. These 3
// shared x/y pairs are hand-placed instead: pulled toward the corners,
// clear of the 5 camp groups' fold3 positions below AND away from the camp
// cluster's fold4 center (~709-773, ~443-523) — satisfying both "scattered,
// dimmed, away from the cluster" (fold4) and "reads as one naturally spread
// set of 8 dots, no clumps" (fold3) at once, since one pair of coordinates
// now has to serve both frames.
const GROUPS = [
  { color: "#008C99", label: "ערבים ישראלים",         fold3: { x: 1088, y: 786 },
    fold4: { x: 1088, y: 786, dimmed: true,  swatchFirst: true }, row: true },
  { color: "#7c3aed", label: "יוצאי אתיופיה",         fold3: { x: 1225, y: 167 },
    fold4: { x: 1225, y: 167, dimmed: true,  swatchFirst: true }, row: true },
  // `actor` (the 5 camp groups only) is the events.json/P7_COLORS join key —
  // see p7ActorColor in page7.js, which reads this group's `color` directly
  // so the real per-event canvas dots always match this legend, including
  // after a future color edit here.
  { color: "#65a30d", label: "פעילי ימין",            actor: "Right-wing activists", fold3: { x: 936,  y: 602 },
    fold4: { x: 773,  y: 483, dimmed: false, swatchFirst: false }, fold6: { x: 31, y: 464 } },
  { color: "#57534c", label: "חרדים",                 actor: "Haredi Jews", fold3: { x: 352,  y: 469 },
    fold4: { x: 773,  y: 523, dimmed: false, swatchFirst: false }, fold6: { x: 31, y: 488 } },
  { color: "#2563eb", label: "מתנגדי הרפורמה המשפטית", actor: "Protesters against the government", fold3: { x: 462,  y: 555 },
    // fold4.x nudged from Figma's measured 709 to 713 (matching פעילי שמאל,
    // the other label-leading camp item) — Figma's own frame really does
    // place this swatch ~4-64px left of its neighbors, but per explicit
    // instruction this one diverges from spec to sit flush with its peer.
    fold4: { x: 713,  y: 464, dimmed: false, swatchFirst: true, label: "מתנגדי הרפורמה" }, fold6: { x: 31, y: 512 } },
  { color: "#d946ef", label: "פעילי שמאל",            actor: "left wing activists", fold3: { x: 699,  y: 710 },
    fold4: { x: 713,  y: 502, dimmed: false, swatchFirst: true }, fold6: { x: 31, y: 536 } },
  { color: "#ea580c", label: "מתיישבים",              actor: "settlers", fold3: { x: 908,  y: 321 },
    fold4: { x: 773,  y: 443, dimmed: false, swatchFirst: false }, fold6: { x: 31, y: 440 } },
  { color: "#eacc0c", label: "דרוזים",                fold3: { x: 242,  y: 825 },
    fold4: { x: 242,  y: 825, dimmed: true,  swatchFirst: true }, row: true },
];

// @fold1's dot columns (buildPage0AllDots, page1.js) read 8 of their 200 dot
// colors live from GROUPS above — called from here, not from page1.js
// itself, since page1.js's <script> tag loads before this one and GROUPS
// doesn't exist yet at that point.
buildPage0AllDots();

// Parallel to GROUPS — group i's own @fold1 entrance progress (0..1, eased),
// continuously updated by playPage0Entrance's animation frame. Read by
// updateGroups() to keep every group-colored dot's swatch invisible/popping
// in (regardless of what fold5FadeMul etc. would otherwise say) until its
// own beat of the @fold1 entrance, then stays at 1 forever after.
const page0PopT = GROUPS.map(() => 0);

const groupsOverlayEl = document.getElementById("groupsOverlay");
// Active from page load, not just once fold2Trigger fires — each group's
// item sits at its @fold1 dot anchor (PAGE0_GROUP_DOT_ANCHORS, page1.js)
// from the very start, standing in for that dot among #page0DotsOverlay's
// other (decorative) dots. Like that overlay, this is fixed-position, so it
// stays put on screen as @fold1's title/subtitle scroll past underneath it
// — only moving once fold2Trigger actually fires (see updateGroups below).
groupsOverlayEl.classList.add("is-active");

// The decorative (non-group) dots have nothing further to do once @fold2's
// legend starts arriving — each one shrinks to nothing in place (scaled
// individually, not the whole overlay, so every dot shrinks around its own
// center rather than toward one shared point) by fold2Trigger's own progress
// in updateGroups below, same trigger driving the legend's entrance, so both
// happen in lockstep.

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
// node 117:818/Frame 3169) — the 3 groups with no camp ("ערבים ישראלים",
// "יוצאי אתיופיה", "דרוזים") that move from fold 4's scatter into one line
// near the BOTTOM of the screen (not under the title — the class name is
// legacy from an earlier top-of-screen layout). Real layout (the
// label-width-dependent spacing) is resolved by an actual flexbox on a
// hidden measurement scaffold (.fold5-top-row, never painted — see
// updateFold5RowTargets), not hand-computed.
const FOLD5_ROW_ORDER = ["#eacc0c", "#7c3aed", "#008C99"];
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
  // Horizontally center the row at W/2 — the left anchor above places the
  // row's left edge, not its center, so the visual midpoint drifts off-center
  // as label widths vary. Shift all x targets so the midpoint of the
  // outermost swatches lands at the canvas center instead.
  const xs = Object.values(fold5RowTargets).map(p => p.x);
  const shift = W / 2 - (Math.min(...xs) + Math.max(...xs)) / 2;
  for (const k of Object.keys(fold5RowTargets)) fold5RowTargets[k].x += shift;
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
// Each of the 5 camp-group colors appears exactly twice across the 10 squares.
// Order is manually shuffled so no two adjacent squares share a color and
// the sequence doesn't read as two identical runs.
// S=מתיישבים L=פעילי שמאל H=חרדים P=מתנגדי הרפורמה R=פעילי ימין
// Each color appears twice; pair gaps are 7,5,3,6,4 — no mirror, no pattern.
const FOLD6_SQUARE_COLORS = [
  groupColorByActor("Protesters against the government"),   // P - blue
  groupColorByActor("Haredi Jews"),                         // H - grey
  groupColorByActor("Right-wing activists"),                // R - green
  groupColorByActor("settlers"),                            // S - orange
  groupColorByActor("left wing activists"),                 // L - pink
  groupColorByActor("Right-wing activists"),                // R - green
  groupColorByActor("Haredi Jews"),                         // H - grey
  groupColorByActor("Protesters against the government"),   // P - blue
  groupColorByActor("left wing activists"),                 // L - pink
  groupColorByActor("settlers"),                            // S - orange
];

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

// Fold 3/4/5/6/9 each fire once, at their card's center crossing. Fold 9 also
// fires a second time — see checkFold9/checkFold9SquaresFade below.
//
// All of these but fold9Trigger/fold5Trigger share one duration so the whole
// legend system reads as a single consistent tempo rather than each fold
// having its own slightly different feel — they used to range from 600ms to
// 1600ms.
const GROUP_TRANSITION_MS = 1900;
// fold2's entrance packs 3 sequential beats (shrink/move/label, see
// updateGroups) into one trigger instead of one — sharing GROUP_TRANSITION_MS
// like every single-beat fold made each beat read as a quick blip. Own
// duration instead, same precedent as FOLD9_COLOR_MS below.
const FOLD2_ENTRANCE_MS = 3400;
// fold5's exit packs 2 sequential beats (move-into-row, then shrink+fade
// out — see updateGroups) into one trigger, same reasoning as
// FOLD2_ENTRANCE_MS above — own duration instead of GROUP_TRANSITION_MS.
const FOLD5_TRANSITION_MS = 3600;
const fold2Trigger      = makeTrigger(FOLD2_ENTRANCE_MS, updateGroups);
const fold3Trigger      = makeTrigger(GROUP_TRANSITION_MS, updateGroups);
const fold4Trigger      = makeTrigger(GROUP_TRANSITION_MS, updateGroups);
const fold5Trigger      = makeTrigger(FOLD5_TRANSITION_MS, updateGroups);
const fold6Trigger      = makeTrigger(GROUP_TRANSITION_MS, updateGroups);
const fold7LabelTrigger = makeTrigger(GROUP_TRANSITION_MS, updateGroups);
// Square color-in is its own, much quicker beat — the shared tempo above read
// as sluggish for a plain background-color swap, per explicit feedback.
const FOLD9_COLOR_MS = 500;
const fold9Trigger            = makeTrigger(FOLD9_COLOR_MS, updateGroups);
// p7AxisShouldShow (page7.js) gates the year-axis build-in on this trigger
// having fully settled at raw 1, not on scroll position directly — so unlike
// every other group trigger, settling has to also force a canvas redraw
// itself (not just rely on the next scroll event), or the axis would never
// appear if the user stops scrolling exactly as the fade finishes.
const fold9SquaresFadeTrigger = makeTrigger(GROUP_TRANSITION_MS, () => {
  updateGroups();
  if (currentPage === 7) draw();
});

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

// Fold 2's legend (the groups overlay's first appearance) is tied to the title
// card directly — same 0.5 convention and makeTrigger/watchCardThreshold
// machinery as every other fold — so the legend's appearance stays in sync
// with its own title and gives it a t (below) to stagger the rows' entrance.
const checkFold2      = watchCardThreshold(page2TitleCardEl, 0.5, fold2Trigger);
const checkFold3      = watchCardThreshold(page3TitleCardEl, 0.5, fold3Trigger);
const checkFold4      = watchCardThreshold(page4TitleCardEl, 0.5, fold4Trigger);
const checkFold5      = watchCardThreshold(page5TitleCardEl, 0.5, fold5Trigger);
const checkFold6      = watchCardThreshold(page6TitleCardEl, 0.5, fold6Trigger);
const checkFold7Label = watchCardThreshold(fold7LabelCardEl, 0.5, fold7LabelTrigger);
// Fires at the title card's ordinary center crossing — same convention as
// fold3/4/6. Colors the squares in; does not touch the labels (see e9 below).
const checkFold9 = watchCardThreshold(page7TitleCardEl, 0.5, fold9Trigger);
// Fires once the card's top reaches 1/12 of viewport height — well past
// center, a distinct, later beat from the color-in above, not the same
// moment. Fades the squares and labels out together; the year axis build-in
// (p7AxisShouldShow, page7.js) only starts once this fade-out tween has fully
// settled, so the two effects play in sequence, not at once.
const checkFold9SquaresFade = watchCardThreshold(page7TitleCardEl, 1 / 12, fold9SquaresFadeTrigger);

function checkGroupTriggers() {
  checkFold2(); checkFold3(); checkFold4(); checkFold5(); checkFold6(); checkFold7Label(); checkFold9(); checkFold9SquaresFade();
}

// Default (legend/fold3/fold4/fold5) swatch size + the swatch-to-label gap
// established earlier — vs. the smaller mini-legend ones (Figma node
// 120:1279/Frame 3219), interpolated continuously by fold6Trigger rather
// than snapped, same "seamless, no popping" rule as every other transition.
const CLUSTER_SWATCH_SIZE = 13, CLUSTER_LABEL_GAP = 12;
const LEFT_LEGEND_SWATCH_SIZE = 6, LEFT_LEGEND_LABEL_GAP = 6;

const LEGEND_TOP_FRAC = 267 / 982; // Figma node 119:969's top, in the 982px-tall fold-2 frame
const LEGEND_ROW_GAP = 59; // 13px swatch + 46px gap, matches the legend's old static layout

// Every group's position is one continuous chain of lerps — legend → fold3 →
// fold4 → fold5 — driven by each stage's own t. Once a given t reaches 1 the
// position is exactly that stage's target (no residual blend), so this is
// equivalent to the old discrete per-fold layout at rest, but never snaps
// between two different DOM nodes to get there.
function updateGroups() {
  const W = canvas.clientWidth, H = canvas.clientHeight;
  const e3 = fold3Trigger.currentT(), e4 = fold4Trigger.currentT(), e6 = fold6Trigger.currentT();
  const legendX = W / 2 - 13, legendTop = LEGEND_TOP_FRAC * H;

  // @fold2's whole entrance is 3 sequential beats sharing fold2Trigger's one
  // timeline, not 3 things happening at once — per explicit spec:
  // (1) the decorative dots shrink away, (2) THEN the 9 group dots fly/grow
  // into the legend (top row first), (3) THEN the labels appear (top row
  // first again). The move beat (2) is the busiest (grow + fly, all rows) so
  // it gets the biggest share of FOLD2_ENTRANCE_MS rather than an equal
  // third; reversing (scrolling back up) runs the same 3 beats in reverse,
  // last-to-first.
  //
  // Sliced from currentRaw() (linear), not currentT() (already eased over
  // the FULL 0..1 span) — easing an already-eased curve's middle third looks
  // close to linear (steep) while its first/last thirds look like they
  // barely move, so the 3 beats would visibly run at 3 different speeds.
  // Every sub-slice below (this one and each row's own stagger window
  // further down) re-applies p9Ease fresh to its own local 0..1 span
  // instead, so every beat gets the same gentle ease-in-out shape — the same
  // animation style as every other trigger in this file.
  const raw2 = fold2Trigger.currentRaw();
  const raw4 = fold4Trigger.currentRaw();
  const SHRINK_SPAN = 0.22, MOVE_SPAN = 0.5, LABEL_SPAN = 0.28; // sums to 1
  const shrinkT      = p9Ease(Math.max(0, Math.min(1, raw2 / SHRINK_SPAN)));
  const moveBaseRaw  = Math.max(0, Math.min(1, (raw2 - SHRINK_SPAN) / MOVE_SPAN));
  const labelBaseRaw = Math.max(0, Math.min(1, (raw2 - SHRINK_SPAN - MOVE_SPAN) / LABEL_SPAN));

  // @fold1's decorative (non-group) dots shrink to nothing, staying exactly
  // where they are — the first of the 3 beats above. Skips any dot whose
  // own page-load entrance pop (playPage0Entrance) hasn't happened yet —
  // this runs continuously from page init onward, well before that, and
  // would otherwise stomp the entrance's scale(0) hidden state with
  // decorScale's at-rest value (1) before the user ever sees the pop-in.
  const decorScale = 1 - shrinkT;
  PAGE0_DECORATIVE_DOT_ELS.forEach(({ el, popped }) => { if (popped) el.style.transform = `scale(${decorScale})`; });

  // Beats 2 and 3 each stagger the rows top-to-bottom within their own
  // third of the timeline, same makeTrigger-style "reaches target exactly at
  // local t=1" convention as every other staggered stage in this file.
  const ROW_STAGGER = 0.05;
  const ROW_SPAN = 1 - ROW_STAGGER * (GROUPS.length - 1);

  GROUPS.forEach((g, i) => {
    const item = groupItems[i];
    const moveT  = p9Ease(Math.max(0, Math.min(1, (moveBaseRaw  - i * ROW_STAGGER) / ROW_SPAN)));
    const labelT = p9Ease(Math.max(0, Math.min(1, (labelBaseRaw - i * ROW_STAGGER) / ROW_SPAN)));

    // Legend entrance originates from wherever this group's own dot landed
    // in @fold1's dot columns (PAGE0_GROUP_DOT_ANCHORS, page1.js), flying in
    // on moveT (beat 2 above) rather than the raw e2. Falls back to the
    // legend spot itself (a no-op lerp) if this group had no matching dot
    // this load (very short viewports can run out of dots before all
    // groups get one).
    const legendTargetX = legendX, legendTargetY = legendTop + i * LEGEND_ROW_GAP;
    const anchor = PAGE0_GROUP_DOT_ANCHORS[g.color] || { left: legendTargetX - W / 2, top: legendTargetY };
    const fold1X = W / 2 + anchor.left, fold1Y = anchor.top;

    let x = fold1X + (legendTargetX - fold1X) * moveT;
    let y = fold1Y + (legendTargetY - fold1Y) * moveT;
    const fold3Pos = { x: (g.fold3.x / GROUPS_FRAME_W) * W, y: (g.fold3.y / GROUPS_FRAME_H) * H };
    x += (fold3Pos.x - x) * e3; y += (fold3Pos.y - y) * e3;
    const fold4Pos = { x: (g.fold4.x / GROUPS_FRAME_W) * W, y: (g.fold4.y / GROUPS_FRAME_H) * H };
    x += (fold4Pos.x - x) * e4; y += (fold4Pos.y - y) * e4;
    // @fold5's exit (the 3 no-camp dots) packs 2 sequential beats into
    // fold5Trigger's one timeline — move into the row, THEN shrink+fade out
    // — same raw/span-slicing convention as @fold2's entrance above, just
    // with no per-row stagger (only 3 dots, moving as one unit reads fine
    // without it).
    const raw5 = fold5Trigger.currentRaw();
    const FOLD5_MOVE_SPAN = 0.45, FOLD5_GAP_SPAN = 0.14, FOLD5_EXIT_SPAN = 0.41; // sums to 1
    const fold5MoveT = p9Ease(Math.max(0, Math.min(1, raw5 / FOLD5_MOVE_SPAN)));
    const fold5ExitT = p9Ease(Math.max(0, Math.min(1, (raw5 - FOLD5_MOVE_SPAN - FOLD5_GAP_SPAN) / FOLD5_EXIT_SPAN)));

    const fold5Pos = g.row ? fold5RowTargets[g.color] : fold4Pos;
    if (fold5Pos) { x += (fold5Pos.x - x) * fold5MoveT; y += (fold5Pos.y - y) * fold5MoveT; }

    // Only the 5 camp groups have a fold6 target (the mini-legend) — the 4
    // no-camp groups stay wherever fold 5 already faded them out to.
    // Swatch starts at the real @fold1 dot's own 7px size (PAGE0_DOT_SQ) and
    // grows to the legend's 13px (CLUSTER_SWATCH_SIZE) over the same moveT
    // as the position fly-in above.
    let swatchSize = PAGE0_DOT_SQ + (CLUSTER_SWATCH_SIZE - PAGE0_DOT_SQ) * moveT, labelGap = CLUSTER_LABEL_GAP;
    if (g.row) swatchSize *= 1 - fold5ExitT;
    if (g.fold6) {
      const fold6Pos = { x: (g.fold6.x / GROUPS_FRAME_W) * W, y: (g.fold6.y / GROUPS_FRAME_H) * H };
      x += (fold6Pos.x - x) * e6; y += (fold6Pos.y - y) * e6;
      swatchSize += (LEFT_LEGEND_SWATCH_SIZE - CLUSTER_SWATCH_SIZE) * e6;
      labelGap   += (LEFT_LEGEND_LABEL_GAP - CLUSTER_LABEL_GAP) * e6;
    }

    item.el.style.left = `${x}px`;
    item.el.style.top  = `${y}px`;

    // Swatch eases in (page0PopT, set by playPage0Entrance) once the @fold1
    // page-load entrance reaches this row — it's standing in for a real
    // @fold1 dot at rest, so once popped it should look identical to that
    // dot until it actually starts flying at @fold2. The label is the 3rd
    // beat (labelT), appearing only once a row's own flight (beat 2) has
    // finished.
    //
    // @fold5's exit no longer fades the swatch itself — swatchSize shrinking
    // to 0 above is what makes it disappear now, mirroring @fold2's entrance
    // grow-in technique in reverse. Only the label gets an extra exit-fade
    // multiplier, and only for the 3 row groups.
    const fold5FadeMul = page0PopT[i];
    item.swatch.style.opacity = String(fold5FadeMul);
    item.label.style.opacity = String(labelT * fold5FadeMul * (g.row ? 1 - fold5ExitT : 1));

    item.swatch.style.width  = `${swatchSize}px`;
    item.swatch.style.height = `${swatchSize}px`;
    // Label's vertical anchor must track the swatch's own shrinking center
    // (13px cluster -> 6px mini-legend, same e6 lerp as swatchSize above) —
    // a fixed CSS top would stay centered on the swatch's *original* size
    // and drift off-center as the swatch shrinks.
    item.label.style.top = `${swatchSize / 2}px`;

    // fontSize/color have a meaningful in-between so they lerp continuously
    // over e6 — 18px/opaque-black is is-emphasized's resting state, so e6=0
    // reproduces the pre-fold6 look with no seam. Weight stays regular (400).
    const postFold3 = raw4 >= 0.5;
    const postFold6 = !!g.fold6 && fold6Trigger.currentRaw() >= 0.5;
    // Groups with a shorter fold4 label (only "מתנגדי הרפורמה המשפטית" → "מתנגדי הרפורמה"):
    // fade out just the suffix word as a <span> so the base text stays visible throughout.
    if (g.fold4.label && g.fold4.label !== g.label) {
      const suffix = g.label.slice(g.fold4.label.length);
      const suffixOpacity = 1 - p9Ease(Math.max(0, Math.min(1, raw4 / 0.5)));
      if (suffixOpacity > 0.005) {
        item.label.innerHTML = `${g.fold4.label}<span style="opacity:${suffixOpacity.toFixed(3)}">${suffix}</span>`;
      } else {
        item.label.textContent = g.fold4.label;
      }
    } else {
      item.label.textContent = g.label;
    }
    if (g.fold6 && postFold3) {
      item.label.style.fontSize   = `${18 + (16 - 18) * e6}px`;
      item.label.style.fontWeight = "400";
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

  // (groupsOverlayEl's own "is-active" is set once at init, not toggled here
  // — see the comment by its declaration above.)
  // Fades the whole curated-squares overlay out as fold 9's own card finally
  // scrolls past (fold9SquaresFadeTrigger, see its comment above), rather
  // than snapping to 0 — these curated squares have nothing further to do by
  // then, and leaving them up would clash with the real per-event squares
  // appearing in the same spot, but the handoff itself should still glide.
  const e9SquaresFade = fold9SquaresFadeTrigger.currentT();
  fold6SquaresOverlayEl.style.opacity = String(e6 * (1 - e9SquaresFade));

  // Labels fade in via their own trigger (fold7LabelTrigger, fold 7's own
  // card) once that title is reached, and just stay put through fold 9's
  // color-in (e9) — the square gains its color while the label stays fully
  // visible alongside it. Labels only disappear later, together with the
  // squares, via the overlay-level fade (e9SquaresFade above) — there's no
  // separate per-label fade-out tied to e9 anymore.
  const e7Label = fold7LabelTrigger.currentT();
  const e9 = fold9Trigger.currentT();
  fold6SquareEls.forEach(({ sq, label }, i) => {
    label.style.opacity = String(e7Label);
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

// drawFold9 (currentPage 7, #page-7) used to be static background-only, so
// nothing redrew the canvas while scrolling within it. Now that it also draws
// the year axis preview (gated on p7AxisShouldShow, page7.js) once that title
// crosses center, it needs its own scroll-driven redraw to actually pick that
// crossing up while currentPage stays 7 the whole time it's happening.
let fold9AxisTicking = false;
window.addEventListener("scroll", () => {
  if (fold9AxisTicking) return;
  fold9AxisTicking = true;
  requestAnimationFrame(() => {
    if (currentPage === 7) draw();
    fold9AxisTicking = false;
  });
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
// card like every other fold's — no JS positioning of its own. It drives two
// *separate* things, deliberately on two different conditions, not one shared
// trigger:
//  - The canvas-drawn divider line (p9TriggerLine) starts growing in once the
//    title card's own top crosses viewport-center — same frac-0.5 convention
//    every other fold's title-driven animation uses (briefly moved to 2/3,
//    reverted back to center per a later explicit request). Safe to fire
//    this early: the canvas is a full-viewport fixed overlay, not a
//    scrolling DOM node, so there's no "still scrolling" artifact to worry
//    about.
//  - The DOM panel itself (.engaged on .page9-sticky — axis labels, dragcards
//    tray, dropped-pill stack) stays gated on .page9-sticky actually being
//    pinned (rect.top <= 0), not on the title card. .page9-title-row's
//    text-card is centered via inset:0/margin:auto within a row exactly 100vh
//    tall, so the title crosses center the instant the row is entered — long
//    before .page9-sticky itself starts sticking. Revealing real DOM content
//    that early sits fully visible-but-still-in-normal-flow (not yet pinned),
//    reading as the dragcards scrolling up the page instead of being revealed
//    in a fixed position — tried it, reverted it. Pinning is a hard
//    requirement for this one, the title-card threshold is not. ──
const page9TitleCardEl = document.querySelector("#page-10 .text-card");
const page9StickyEl = document.querySelector("#page-10 .page9-sticky");
const page9TrayEl = document.querySelector("#page-10 .page9-tray");
let page9Ticking = false;
let page9LinePast = false; // previous "title past center" state, so the line trigger only fires on the transition

// How many px of scroll, just before .page9-sticky actually pins, the tray's
// own slide-up tracks across — per explicit request, this one should scroll
// up continuously with the page like normal-flow content, not reveal on a
// discrete .engaged trigger the way the axis/header/zone-wrap do.
const PAGE9_TRAY_RANGE = 900;

function page9UpdateFromScroll() {
  const titlePastCenter = page9TitleCardEl.getBoundingClientRect().top <= window.innerHeight * 0.5;
  if (titlePastCenter !== page9LinePast) {
    page9LinePast = titlePastCenter;
    p9TriggerLine(titlePastCenter ? 1 : 0);
  }
  const stickyTop = page9StickyEl.getBoundingClientRect().top;
  page9StickyEl.classList.toggle("engaged", stickyTop <= 0);
  // 0 while .page9-sticky is still PAGE9_TRAY_RANGE+ px from pinning, ramping
  // continuously to 1 exactly as it pins (stickyTop hits 0) — read directly
  // by .page9-tray's transform (style.css), no CSS transition involved.
  const trayT = Math.max(0, Math.min(1, 1 - stickyTop / PAGE9_TRAY_RANGE));
  page9TrayEl.style.setProperty("--page9-tray-t", trayT);
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
  playPage0Entrance();
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
  page0UpdateFromScroll();
  page7UpdateFromScroll();
  page8CheckScroll();
  page9UpdateFromScroll();
  window.addEventListener("resize", () => {
    // buildPage0AllDots() must run before layoutGroups() — it repopulates
    // PAGE0_GROUP_DOT_ANCHORS (page1.js), which updateGroups() reads for the
    // fold1->fold2 legend entrance below.
    buildPage0AllDots();
    init();
    layoutGroups();
    updateTextCardFrameDashes();
  });
});
