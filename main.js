history.scrollRestoration = "manual";
window.scrollTo(0, 0);

const canvas = document.getElementById("canvas");
const ctx    = canvas.getContext("2d");

// drawFoldNew3/drawFold5/drawFold7/drawFold9 are tiny inline background-only
// functions (see below) — these folds' only visual content is the DOM overlay,
// like drawPage2/drawPage3/drawPage4.
const PAGES = [drawPage1, drawPage2, drawFoldNew3, drawPage3, drawPage4, drawFold5, drawPage5, drawFold7, drawFold9, drawPage7, drawPage8, drawPage9, drawPage12];
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

// New fold (id #page-2) — just the split-dot animation, which runs entirely in
// DOM via updateGroups. Plain background only here.
function drawFoldNew3(ctx, W, H) {
  drawBackground(ctx, W, H);
}

// Fold 5 (id #page-5) — see GROUPS/updateGroups below for its actual content,
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
  // Same reasoning as drawFold9 below (see p7RealTimelineReached's own
  // comment, page7.js): if a fast scroll-up carries the user all the way
  // past #page-8 (@fold9) and into this fold within a single continuous
  // motion, any per-event squares still mid-retreat should keep animating
  // out here too, instead of freezing the instant currentPage drops below 8.
  // No axis here (p7AxisTriggerIfNeeded isn't called) — the axis has never
  // shown this far back and shouldn't start now.
  if (p7.ready && p7RealTimelineReached) {
    p7DrawTimelineSquares(ctx, W, H);
    if (!p7HasEngaged && !p7AnyAnimActive()) p7RealTimelineReached = false;
  }
}

// Fold 9 (id #page-7, Figma node 162:63876) — see GROUPS/updateGroups below
// for its actual DOM-overlay content (the fold-6 squares losing their
// labels and gaining group colors). Background only, except the year axis
// (page7.js) — that one starts appearing here already, gated by
// p7AxisTriggerIfNeeded (its trigger is p7HasEngaged, i.e. this very fold's
// own title card passing fully offscreen, which also kicks off the axis's
// one-shot build-in wipe), rather than waiting until currentPage actually
// flips to fold 9/#page-8. p7DrawYearAxis itself is still also called from
// drawPage7, since the axis needs to keep drawing for the whole rest of the
// timeline.
function drawFold9(ctx, W, H) {
  drawBackground(ctx, W, H);
  if (!p7.ready) return;
  p7UpdateEngagement(); // keeps p7HasEngaged live while scrolling back through this fold too (page7.js)
  // Once the real timeline (drawPage7, #page-9) has actually been reached at
  // least once, keep drawing/animating its per-event squares here too — see
  // p7RealTimelineReached's own comment (page7.js) for why: without this, the
  // instant the user scrolls back up far enough for currentPage to drop from
  // 9 to 8, every still-retreating dot (and the year axis's own headline
  // events) just vanished in a single frame instead of finishing its reverse
  // cascade. Gated on p7RealTimelineReached rather than p7HasEngaged alone
  // (which flips true earlier, while still on this very fold) so the
  // *forward* reveal still only ever starts once #page-9 is actually reached
  // — this only smooths out the reverse crossing.
  if (p7RealTimelineReached) {
    p7DrawTimelineSquares(ctx, W, H);
    if (!p7HasEngaged && !p7AnyAnimActive()) p7RealTimelineReached = false;
  }
  if (p7AxisTriggerIfNeeded()) p7DrawYearAxis(ctx, W, H);
}

function draw() {
  const W = canvas.clientWidth, H = canvas.clientHeight;
  // While the fold13 dot morph is active (forward or reverse), keep calling
  // drawPage12 regardless of currentPage — drawPage9 suppresses the extreme
  // dots when morphT > 0 (to avoid ghosting under the overdraw), so if
  // currentPage has already flipped back to 11, those dots would vanish until
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
  updateFoldNumberBadge();
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

const foldNumberBadge = document.getElementById("foldNumberBadge");

// Populate once with one <option> per section (@foldN is this project's own
// canonical fold numbering — see CLAUDE.md's fold reference table — always
// currentPage's id + 1). Picking an option scrolls its section into view;
// the resulting scroll re-triggers the existing IntersectionObserver, which
// calls setActivePage/updateFoldNumberBadge on its own, so no extra state
// sync is needed here.
if (foldNumberBadge) {
  sections.forEach((sec, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = `@fold${i + 1}`;
    foldNumberBadge.appendChild(opt);
  });
  foldNumberBadge.addEventListener("change", () => {
    sections[Number(foldNumberBadge.value)].scrollIntoView({ behavior: "smooth" });
  });
}

function updateFoldNumberBadge() {
  if (foldNumberBadge) foldNumberBadge.value = String(currentPage);
}

function setActivePage(page) {
  if (page === currentPage) return;
  // Scrolling back out of the timeline toward an earlier fold — wipe all
  // per-month animation state so the next entry replays from scratch instead
  // of showing the previously-settled dots still hanging around.
  if (currentPage === 9 && page < 9) p7ResetForReplay();

  // Continuing into page9 (fold12) while page8's own timeline->legit-grid
  // glide (p8CurrentT, page8.js) hasn't actually finished yet — the
  // IntersectionObserver driving this can cross into page9's slot before
  // that glide reaches t=1. drawPage9 has no notion of that glide's
  // progress on its own, so without seeding p9.anim here the dots would
  // snap straight to their final legit position the instant page9 takes
  // over drawing instead of page8 — see p8CaptureBlendedPositions' own
  // comment (page8.js) for the full rationale.
  if (currentPage === 10 && page === 11 && typeof p8CurrentT === "function" && p8Engaged && p8CurrentT() < 1) {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    p9.anim = {
      from: p8CaptureBlendedPositions(W, H),
      start: performance.now(),
      duration: Math.max(1, P8_TRANSITION_DURATION * (1 - p8CurrentT())),
    };
  }

  currentPage = page;
  updateGroups();
  updateFoldNumberBadge();
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
// Logo/scroll-cue opacity lags its raw scroll-derived target via a per-frame
// lerp instead of snapping to it every scroll event — gives the fade a bit
// of trailing "after-action" momentum rather than tracking scroll 1:1.
//
// .page0-title/.page0-subtitle get a lagged, scroll-driven version of their
// own "scroll up and off" motion, once they're not being driven by the
// page-load entrance below (see page0TitleTakenOver there). Both are
// position: fixed (see their own comments in style.css) specifically so this
// motion is 100% JS-driven, not a JS transform layered on top of native
// scroll-driven document flow — an earlier version kept them position:
// absolute (scrolling away by normal flow) and tried to *compensate* on top
// of that with a JS transform, which meant two separate browser pipelines
// (layout/paint for the flow position, compositing for the transform) were
// fighting over the same element's position every frame; no amount of
// lerp/clamp tuning on the compensation math fixed the resulting jitter,
// because the mismatch was architectural, not a tuning problem. With a
// single pipeline in charge, the math is just: track a lagged copy of the
// scroll fraction (0..1 across one viewport, same normalized domain the
// opacity fade above uses) and translate by -laggedFraction * innerHeight,
// i.e. the element's entire position is a direct function of the smoothed
// value, nothing else moves it. The lagged fraction is capped at
// PAGE0_SCROLL_LAG_MAX_PX (in fraction terms) behind the live target so a
// big scroll jump can't leave the title lingering on-screen far longer than
// intended. parallaxPx (the small ±60px depth accent, title down / subtitle
// up) is layered on top, driven off the same lagged fraction so both terms
// move in phase.
//
// One-off pattern, not the project's usual fixed-duration trigger
// convention — meant to read as this fold's own weight, not a general
// scroll-smoothing effect applied project-wide.
const PAGE0_OPACITY_DAMPING = 0.12;
const PAGE0_SCROLL_LAG_DAMPING = 0.12; // same tempo as the opacity lag, so both read as one motion
const PAGE0_SCROLL_LAG_MAX_PX = 150; // caps how far the lag can trail behind the live scroll position
let page0LogoOpacity = null; // null until first driven, either by entrance or scroll fade
let page0LaggedScrollFrac = null;
let page0TitleTakenOver = false; // see playPage0Entrance below
let page0EntranceDone = false;
page0LogoEl.style.opacity = "0";
page0ScrollEl.style.opacity = "0";
// Starting position for the entrance below (full off-screen, same vh unit
// the rest of @fold1 already uses) — set synchronously here, before first
// paint, rather than via a CSS class, so there's no flash of the title at
// its final position before playPage0Entrance's first animation frame.
page0TitleEl.style.transform = "translateY(100vh)";
page0SubtitleEl.style.transform = "translateX(-100%) translateY(100vh)";

function page0OpacityTarget() {
  const raw = Math.max(0, Math.min(1, window.scrollY / (window.innerHeight * PAGE0_FADE_VH)));
  return 1 - p9Ease(raw);
}

function page0ScrollFracTarget() {
  return Math.max(0, Math.min(1, window.scrollY / window.innerHeight));
}

function page0ApplyTitleScrollLag() {
  const fracTarget = page0ScrollFracTarget();
  if (page0LaggedScrollFrac === null) {
    page0LaggedScrollFrac = fracTarget;
  } else {
    page0LaggedScrollFrac += (fracTarget - page0LaggedScrollFrac) * PAGE0_SCROLL_LAG_DAMPING;
    const maxFracGap = PAGE0_SCROLL_LAG_MAX_PX / window.innerHeight;
    page0LaggedScrollFrac = Math.max(fracTarget - maxFracGap, Math.min(fracTarget + maxFracGap, page0LaggedScrollFrac));
  }
  const scrollDrivenPx = page0LaggedScrollFrac * window.innerHeight;
  const parallaxPx = page0LaggedScrollFrac * 60;
  page0TitleEl.style.transform = `translateY(${-scrollDrivenPx + parallaxPx}px)`;
  page0SubtitleEl.style.transform = `translateX(-100%) translateY(${-scrollDrivenPx - parallaxPx}px)`;
}

function page0ApplyLogoScrollFade() {
  const opacityTarget = page0OpacityTarget();
  page0LogoOpacity = page0LogoOpacity === null
    ? opacityTarget
    : page0LogoOpacity + (opacityTarget - page0LogoOpacity) * PAGE0_OPACITY_DAMPING;
  page0LogoEl.style.opacity = String(page0LogoOpacity);
  page0ScrollEl.style.opacity = String(page0LogoOpacity);
}

// ── @fold1's page-load entrance, per explicit spec: title/subtitle slide up
// from off-screen first; once they're in place, the dot columns pop in one
// row at a time (both columns synced by syncedRow, see page1.js — the right
// column has 2 more rows than the left, so it starts popping 2 beats
// earlier); once every dot/group-swatch has popped, the logo and scroll cue
// fade in last.
//
// Scrolling can interrupt this early, but only the title/subtitle beat — per
// explicit instruction, scrolling during the entrance should let the user
// drag the title away immediately with their own scroll (via
// page0ApplyTitleScrollLag above) rather than waiting for the slide-in to
// finish first. The moment window.scrollY > 0 is seen, page0TitleTakenOver
// flips true (permanently — the entrance never reclaims the title once
// scroll has taken it) and this loop stops touching page0TitleEl/
// page0SubtitleEl at all, handing them over entirely. The dots and the
// logo/scroll-cue fade-in are untouched by this — they keep playing out on
// their own elapsed-time schedule regardless of an early title takeover,
// i.e. the rest of the entrance catches up on its own even if the title has
// already scrolled off. The logo/scroll-cue only switch over to their own
// scroll-driven fade (page0ApplyLogoScrollFade above) once *their* beat
// actually finishes (page0EntranceDone), independent of the title.
//
// Driven by one requestAnimationFrame loop, running forever (it becomes the
// permanent per-frame driver for whichever of title/subtitle and logo/
// scroll-cue have been handed to scroll), with p9Ease applied fresh to each
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

    if (!page0TitleTakenOver && window.scrollY > 0) page0TitleTakenOver = true;

    if (!page0TitleTakenOver) {
      const titleT = p9Ease(Math.max(0, Math.min(1, elapsed / PAGE0_TITLE_MS)));
      const titleOffsetVh = (1 - titleT) * 100;
      page0TitleEl.style.transform = `translateY(${titleOffsetVh}vh)`;
      const subtitleAlignPx = (107 * (1 - titleT)).toFixed(2);
      page0SubtitleEl.style.transform = `translateX(-100%) translateY(calc(${titleOffsetVh}vh - ${subtitleAlignPx}px))`;
    } else {
      page0ApplyTitleScrollLag();
    }

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

    if (!page0EntranceDone) {
      const logoT = p9Ease(Math.max(0, Math.min(1, (elapsed - dotsDoneMs) / PAGE0_LOGO_FADE_MS)));
      page0LogoOpacity = logoT;
      page0LogoEl.style.opacity = String(logoT);
      page0ScrollEl.style.opacity = String(logoT);
      if (elapsed >= totalMs) page0EntranceDone = true;
    } else {
      page0ApplyLogoScrollFade();
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

// ── Page 7's tall section (#page-9) is a pure scroll-driver: scroll position
// -> date. Its own intro title used to be fused in here as a static header
// above the timeline's month list — it's now its own earlier fold (#page-7,
// "כל ריבוע..."), with fold 9 ("צבע הריבוע...", #page-8) after it, so the
// real per-event reveal below doesn't engage until both have been scrolled
// past. ──
const page7Section = document.getElementById("page-9");
let page7Ticking = false;

function page7UpdateFromScroll() {
  const rect = page7Section.getBoundingClientRect();

  // t=0 the instant fold 9's own title card clears the top of the viewport
  // (the same instant p7HasEngaged flips true below) rather than when
  // #page-9's own top reaches the viewport top — #page-8 (fold 9) keeps
  // scrolling for a while after its title clears before #page-9 actually
  // begins, and anchoring t=0 to #page-9's own top left that whole stretch as
  // dead scroll space where engagement had already fired but the axis never
  // moved off 0%. `gap` (page7TitleCardEl's top minus #page-9's own top, at
  // this same instant) is a pure document-layout constant regardless of
  // current scroll position, so recomputing it fresh here — instead of
  // caching it — keeps this correct across a resize too. t=1 stays anchored
  // to the exact same endpoint as before (#page-9's bottom reaching the
  // viewport bottom); starting earlier just means that same endpoint is now
  // reached over a correspondingly longer scroll distance.
  const titleTop = page7TitleCardEl ? page7TitleCardEl.getBoundingClientRect().top : rect.top;
  const gap = rect.top - titleTop;
  const scrubRange = rect.height - window.innerHeight + gap;
  const t = scrubRange > 0 ? Math.max(0, Math.min(1, -titleTop / scrubRange)) : 0;

  if (!p7.ready) return;

  // Refresh engagement state before checking it — without this, the check below
  // would use whatever the last draw call left, which can be one scroll event stale.
  p7UpdateEngagement();

  // Hold currentDate at minDate until engagement actually fires — otherwise
  // scroll position advances curMonthKey silently while !p7HasEngaged, so the
  // first months have no animStart and appear settled (instantly filled) the
  // moment the first draw call with p7HasEngaged===true hits them.
  if (!p7HasEngaged) {
    p7.currentDate = p7.minDate;
    if (currentPage === 9) { draw(); p7RecheckHover(); }
    return;
  }

  const minD = new Date(p7.minDate + "T00:00:00Z");
  const maxD = new Date(p7.maxDate + "T00:00:00Z");
  const totalDays = Math.round((maxD - minD) / 86400000);
  const cur = new Date(minD);
  cur.setUTCDate(cur.getUTCDate() + Math.round(t * totalDays));
  p7.currentDate = cur.toISOString().slice(0, 10);

  if (currentPage === 9) { draw(); p7RecheckHover(); }
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
// `actor` (the 5 camp groups only) is the events.json/P7_COLORS join key —
// see p7ActorColor in page7.js, which reads this group's `color` directly
// so the real per-event canvas dots always match this legend, including
// after a future color edit here.
// Array order sets the two-column legend layout: indices 0-5 → right column,
// indices 6-11 → left column (LEGEND_PER_COL = ceil(12/2) = 6).
const GROUPS = [
  // — right column —
  { color: "#008C99", label: "ערבים ישראלים",            fold3: { x: 1088, y: 786 },
    fold4: { x: 1088, y: 786, dimmed: true,  swatchFirst: true }, row: true },
  { color: "#ea6c15", label: "מתיישבים",              actor: "settlers", fold3: { x: 908,  y: 321 },
    fold4: { x: 773,  y: 443, dimmed: false, swatchFirst: false }, fold6: { x: 31, y: 440 } },
  { color: "#7c3aed", label: "יוצאי אתיופיה",            fold3: { x: 1225, y: 167 },
    fold4: { x: 1225, y: 167, dimmed: true,  swatchFirst: true }, row: true },
  { color: "#FF00A6", label: "יוצאי ברית המועצות",       fold3: { x: 280,  y: 210 },
    fold4: { x: 280,  y: 210, dimmed: true,  swatchFirst: true }, row: true },
  { color: "#65a30d", label: "פעילי ימין",            actor: "Right-wing activists", fold3: { x: 936,  y: 602 },
    fold4: { x: 773,  y: 483, dimmed: false, swatchFirst: false }, fold6: { x: 31, y: 464 } },
  { color: "#3f76ed", label: "מתנגדי הרפורמה המשפטית", actor: "Protesters against the government", fold3: { x: 462,  y: 555 },
    fold4: { x: 713,  y: 464, dimmed: false, swatchFirst: true, label: "מתנגדי הרפורמה" }, fold6: { x: 31, y: 512 } },
  // — left column —
  { color: "#d946ef", label: "פעילי שמאל",            actor: "left wing activists", fold3: { x: 699,  y: 710 },
    fold4: { x: 713,  y: 502, dimmed: false, swatchFirst: true }, fold6: { x: 31, y: 536 } },
  { color: "#BB0055", label: "תושבי מזרח ירושלים",       fold3: { x: 380,  y: 370 },
    fold4: { x: 380,  y: 370, dimmed: true,  swatchFirst: true }, row: true },
  { color: "#EED600", label: "בדואים בנגב",              fold3: { x: 1370, y: 560 },
    fold4: { x: 1370, y: 560, dimmed: true,  swatchFirst: true }, row: true },
  { color: "#595151", label: "חרדים",                 actor: "Haredi Jews", fold3: { x: 352,  y: 469 },
    fold4: { x: 773,  y: 523, dimmed: false, swatchFirst: false }, fold6: { x: 31, y: 488 } },
  { color: "#27BCD3", label: "דרוזים",                fold3: { x: 242,  y: 825 },
    fold4: { x: 242,  y: 825, dimmed: true,  swatchFirst: true }, row: true },
  { color: "#AB740D", label: "מבקשי מקלט",               fold3: { x: 770,  y: 900 },
    fold4: { x: 770,  y: 900, dimmed: true,  swatchFirst: true }, row: true },
];

// @fold1's dot columns (buildPage0AllDots, page1.js) read 12 of their 200 dot
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
  // Two satellite swatches for the new-fold split animation — sit at top=0,
  // size=0 at rest; expand outward (above + below) as foldNew3SplitTrigger
  // fires. Same color as the main swatch.
  const satTop = document.createElement("span");
  satTop.className = "group-swatch-split";
  satTop.style.cssText = `background:${color};width:0;height:0;position:absolute;left:0;top:0`;
  const satBot = document.createElement("span");
  satBot.className = "group-swatch-split";
  satBot.style.cssText = `background:${color};width:0;height:0;position:absolute;left:0;top:0`;
  el.appendChild(swatch);
  el.appendChild(label);
  el.appendChild(satTop);
  el.appendChild(satBot);
  groupsOverlayEl.appendChild(el);
  return { el, label, swatch, satTop, satBot };
});

// Fold 5's row order (FOLD5_ROW_X/Y, the Figma anchor for #fold5-top-row,
// node 117:818/Frame 3169) — the 3 groups with no camp ("ערבים ישראלים",
// "יוצאי אתיופיה", "דרוזים") that move from fold 4's scatter into one line
// near the BOTTOM of the screen (not under the title — the class name is
// legacy from an earlier top-of-screen layout). Real layout (the
// label-width-dependent spacing) is resolved by an actual flexbox on a
// hidden measurement scaffold (.fold5-top-row, never painted — see
// updateFold5RowTargets), not hand-computed.
const FOLD5_ROW_ORDER = ["#27BCD3", "#FF00A6", "#7c3aed", "#AB740D", "#008C99", "#BB0055", "#EED600"];
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

// 8 small static squares (Figma node 258:2206, a 2-column x 4-row grid,
// all `#2d2d2d`) that fade in at the center, taking the cluster's vacated
// spot as it moves into fold6's left mini-legend. Positions below are each
// square's own {dx, dy} offset from the 8-square group's own bounding-box
// center (computed from Figma's absolute coords: columns x=741/766, rows
// y=470/486/502/518, each square 8px — group center at x=757.5, y=498) —
// offsets, not absolute coords, so layoutFold6Squares can re-center the
// whole group at the canvas's own center regardless of viewport size,
// rather than reproducing Figma's absolute frame position. Reading order is
// row-by-row, left-to-right (Figma assigns no meaningful order of its own).
// Offsets below are scaled ~1.3x from Figma's raw column/row deltas (kept
// relative to the same group center) to open up the gap between squares a
// bit more than Figma's own tight 258:2206 spacing reads on screen.
const FOLD6_SQUARES_OFFSET = [
  { dx: -21.5, dy: -36.4 },
  { dx:  11.0, dy: -36.4 },
  { dx: -21.5, dy: -15.6 },
  { dx:  11.0, dy: -15.6 },
  { dx: -21.5, dy:   5.2 },
  { dx:  11.0, dy:   5.2 },
  { dx: -21.5, dy:  26.0 },
  { dx:  11.0, dy:  26.0 },
];
// Not shown in Figma node 258:2206 (no label layers next to the squares) —
// kept only as inert element text content (fold6-square-label stays
// opacity:0, see the removed fold7Label-driven reveal in updateGroups
// below); harmless if never revealed.
const FOLD6_SQUARE_LABELS = [
  "הפגנה לא אלימה",
  "החזקה בכפייה",
  "הפרות סדר",
  "הטרדה ואיומים",
  "תקיפה פיזית",
  "ניכוס שטח",
  "פגיעה ברכוש",
  "חסימת כביש",
];
// Not shown in Figma node 258:2206 either (all 8 squares render flat
// #2d2d2d there — see lerpFold6SquareColor's own null-target case, same
// value) — these actor assignments only matter once fold 9 recolors/flies
// the squares out to their real per-event dots, a later beat this specific
// Figma frame doesn't depict. Reads GROUPS' own `color` (by `actor`, the
// same join key p7ActorColor in page7.js uses) rather than a second
// hardcoded hex list, so a future color edit on GROUPS updates these
// squares too.
function groupColorByActor(actor) {
  return GROUPS.find(g => g.actor === actor).color;
}
// Kept for the next @fold9 trigger to reuse: each square's actor is chosen to
// match its own column's political side — left column (even indices, dx
// -16.5) gets left-camp actors, right column (odd indices, dx +8.5, see
// FOLD6_SQUARES_OFFSET) gets right-camp actors. Only 2 left-camp actors exist
// vs 3 right-camp ones, so left alternates P/L twice each and right cycles
// H/R/S/H (uneven, but there's no 4th right-camp actor to reach for). Index 0
// is unchanged ("Protesters against the government") since @fold8's tooltip
// (below) targets that specific square/event, and it's already a left-camp
// actor in the left column.
// S=מתיישבים L=פעילי שמאל H=חרדים P=מתנגדי הרפורמה R=פעילי ימין
const FOLD6_SQUARE_ACTORS = [
  "Protesters against the government",   // 0 (L col) - P - blue
  "Haredi Jews",                         // 1 (R col) - H - grey
  "left wing activists",                 // 2 (L col) - L - pink
  "Right-wing activists",                // 3 (R col) - R - green
  "Protesters against the government",   // 4 (L col) - P - blue
  "settlers",                            // 5 (R col) - S - orange
  "left wing activists",                 // 6 (L col) - L - pink
  "Haredi Jews",                         // 7 (R col) - H - grey
];
const FOLD6_SQUARE_COLORS = FOLD6_SQUARE_ACTORS.map(groupColorByActor);
// Which occurrence (0 = first chronologically, 1 = second, ...) of its own
// actor each square stands in for, among left-side events sorted by date
// (p7.leftEvents' own order — see p7NthIndexOfActor/p7EventForActorOccurrence,
// page7.js) — auto-derived from FOLD6_SQUARE_ACTORS' own position (count of
// the same actor appearing earlier in the list), same as the original
// 10-square design, except index 0: overridden to 8 so @fold8's tooltip
// keeps pointing at its specific chosen event (the left-side "מחאה מחוץ
// לביתו של שר המשפטים יריב לוין במודיעין" protest dated 2023-01-14).
const FOLD6_SQUARE_OCCURRENCE = FOLD6_SQUARE_ACTORS.map((actor, i) =>
  FOLD6_SQUARE_ACTORS.slice(0, i).filter(a => a === actor).length
);
FOLD6_SQUARE_OCCURRENCE[0] = 8;

// @fold8's square shows the shared #page9Tooltip (page7.js/page9.js's own
// hover tooltip element) with a real event's date+description instead of a
// static action-type label — see the fold7LabelTrigger-driven block in
// updateGroups below. Kept visible unconditionally for the duration of that
// fold (not gated on hover), per explicit instruction.
const fold8TooltipEl     = document.getElementById("page9Tooltip");
const fold8TooltipDateEl = fold8TooltipEl.querySelector(".page9-tooltip-date");
const fold8TooltipDescEl = fold8TooltipEl.querySelector(".page9-tooltip-desc");
// Ownership flag, same pattern p7HoverInit/p9HoverInit use for the same
// shared element (hoveredEvent) — only hide/reset the tooltip below if this
// fold is the one that showed it, or updateGroups (which runs every frame on
// every page) would stomp an unrelated hover-driven tooltip on page-8/-11.
let fold8TooltipOwnsIt = false;

// The fold-8 tooltip's grow-then-type reveal is sequenced on wall-clock time,
// not on tooltipT (e7Label, see updateGroups below) directly — tying
// both the box's grow-in AND the typewriter to the same scroll-linked value
// meant they finished in the same instant regardless of scroll speed, so the
// box was never visibly "done growing" before text started. Instead:
// FOLD8_GROW_MS of wall-clock time grows the box to full scale and holds it
// there, THEN the typewriter (FOLD8_TYPE_MS_PER_CHAR/char) begins — a clean,
// guaranteed-visible beat between the two regardless of how fast the trigger
// itself ran.
//
// Bidirectional per explicit instruction — scrolling back up mid-sequence
// (even mid-typing) must reverse this exact same wall-clock animation
// (untype, then shrink) rather than freezing until the forward sequence
// finishes or hard-snapping to hidden. fold8SeqElapsed (0..total) is the
// single source of truth; fold8SeqDirection (+1/-1) flips the instant
// fold7LabelTrigger's own raw progress changes direction (sensed each tick
// by comparing to its previous value, fold8PrevTooltipRaw) — not tied to
// tooltipT's eased value, so the grow/type rate itself never speeds up or
// slows down with scroll speed, same "guaranteed rate regardless of scroll"
// reasoning as the original one-directional version. Reaching elapsed 0
// while reversing is what actually hides/resets the tooltip (fold8ResetTooltip),
// not a raw tooltipT threshold snap.
let fold8SequenceEvent      = null;
let fold8SeqElapsed         = 0;
let fold8SeqDirection       = 1;
let fold8PrevTooltipRaw     = 0;
let fold8SeqLastFrameTime   = null;
let fold8SequenceLoopRunning = false;
const FOLD8_GROW_MS          = 350; // wall-clock time to reach full scale and hold
const FOLD8_TYPE_MS_PER_CHAR = 15;  // typewriter speed — tuned snappy, not sluggish

// Repositions the tooltip against its anchor square each frame — pulled out
// so both updateGroups' own per-frame call (below) and the standalone
// sequence loop (fold8SequenceTick, needed because makeTrigger's runLoop
// stops firing once a trigger phase settles — see its own comment — leaving
// nothing to drive the grow/type sequence during the "resting" window after
// fold7LabelTrigger's own animation has already finished) can call it. Box
// size no longer changes once grown (see fold8SetupTypewriter's own comment
// on why), so in practice this only needs to run once the grow-in finishes —
// still called every frame regardless, it's cheap.
function fold8PositionTooltip(sq) {
  const sqRect = sq.getBoundingClientRect();
  const dotClientX = sqRect.left + sqRect.width / 2;
  const dotClientY = sqRect.top + sqRect.height / 2;
  const TOOLTIP_GAP = 5;
  const rawLeft = dotClientX - TOOLTIP_GAP - fold8TooltipEl.offsetWidth;
  const left = Math.max(8, Math.min(rawLeft, window.innerWidth - fold8TooltipEl.offsetWidth - 8));
  const top  = Math.max(dotClientY - TOOLTIP_GAP - fold8TooltipEl.offsetHeight, 8);
  fold8TooltipEl.style.left = `${left}px`;
  fold8TooltipEl.style.top  = `${top}px`;
}

// The typewriter reveal must not change the tooltip box's size while it
// plays — the box should already be at its final, max size once the grow-in
// finishes, with characters just appearing inside it (per explicit
// instruction), not the box growing further as more characters are added.
// Achieved by rendering the FULL text from the very start (so the box is
// laid out at its true final size immediately), split across two sibling
// spans: `revealed` (normal opacity, the typed-so-far prefix) and `hidden`
// (opacity 0 but still occupying its own layout space, the not-yet-typed
// remainder) — moving characters between them only changes color/opacity,
// never the total text or box size. dir="rtl" (inherited from .page9-tooltip)
// keeps the two spans' logical (DOM) order — revealed prefix first, hidden
// suffix second — rendering as one continuous right-to-left string, so it
// reads as typing in from the right exactly like plain text would.
function fold8SetupTypewriter(el, fullText) {
  el.textContent = "";
  const revealed = document.createElement("span");
  const hidden = document.createElement("span");
  hidden.style.opacity = "0";
  hidden.textContent = fullText;
  el.appendChild(revealed);
  el.appendChild(hidden);
  return { revealed, hidden, fullText };
}

function fold8UpdateTypewriter(spans, revealedCount) {
  spans.revealed.textContent = spans.fullText.slice(0, revealedCount);
  spans.hidden.textContent = spans.fullText.slice(revealedCount);
}

let fold8DateSpans = null;
let fold8DescSpans = null;

// Advances (or reverses) the grow-then-type sequence by one frame — shared by
// updateGroups' own per-frame call and this function's own self-rescheduling
// (see fold8PositionTooltip's comment on why the latter is needed at all).
// Direction is resolved fresh every call from fold7LabelTrigger's raw scroll
// progress (see fold8SeqDirection's own comment above), so a scroll reversal
// mid-grow or mid-typing takes effect on the very next frame, not just once
// the forward sequence happens to finish. shrinkT/shrinkRaw (fold 9's own,
// later, one-way "square arrived at its real dot" collapse) are read fresh
// here too and layered multiplicatively on top — unrelated to this reversal,
// untouched from the original implementation.
function fold8AdvanceSequence() {
  if (!fold8SequenceEvent) return;
  const event = fold8SequenceEvent;
  const now = performance.now();
  const dt = fold8SeqLastFrameTime === null ? 0 : now - fold8SeqLastFrameTime;
  fold8SeqLastFrameTime = now;

  const raw = fold7LabelTrigger.currentRaw();
  if (raw !== fold8PrevTooltipRaw) fold8SeqDirection = raw > fold8PrevTooltipRaw ? 1 : -1;
  fold8PrevTooltipRaw = raw;

  const totalChars = event.date.length + event.descHeMedium.length;
  const total = FOLD8_GROW_MS + totalChars * FOLD8_TYPE_MS_PER_CHAR;
  fold8SeqElapsed = Math.max(0, Math.min(total, fold8SeqElapsed + fold8SeqDirection * dt));

  const shrinkT = fold9TooltipShrinkTrigger.currentT();
  const growT = Math.min(1, fold8SeqElapsed / FOLD8_GROW_MS);
  fold8TooltipEl.style.transform = `scale(${fold8TooltipGrowEase(growT) * (1 - shrinkT)})`;

  if (growT < 1) {
    fold8TooltipDateEl.style.opacity = "0";
    fold8TooltipDescEl.style.opacity = "0";
  } else {
    const shown = Math.min(totalChars, Math.floor((fold8SeqElapsed - FOLD8_GROW_MS) / FOLD8_TYPE_MS_PER_CHAR));
    if (fold8DateSpans) fold8UpdateTypewriter(fold8DateSpans, Math.min(event.date.length, shown));
    if (fold8DescSpans) fold8UpdateTypewriter(fold8DescSpans, Math.max(0, shown - event.date.length));
    const FOLD9_TOOLTIP_TEXT_FADE_SPAN = 0.15;
    const shrinkRaw = fold9TooltipShrinkTrigger.currentRaw();
    const textOpacity = 1 - p9Ease(Math.max(0, Math.min(1, shrinkRaw / FOLD9_TOOLTIP_TEXT_FADE_SPAN)));
    fold8TooltipDateEl.style.opacity = String(textOpacity);
    fold8TooltipDescEl.style.opacity = String(textOpacity);
  }

  if (fold8AnchorSquareEl) fold8PositionTooltip(fold8AnchorSquareEl);
}

// Fully hides/resets the tooltip — called once the reversible sequence above
// has actually unwound all the way back to elapsed 0 (a real mirrored
// shrink-to-nothing), not on a raw tooltipT threshold snap.
function fold8ResetTooltip() {
  fold8TooltipOwnsIt = false;
  fold8TooltipEl.classList.remove("is-visible");
  fold8TooltipEl.classList.remove("is-mirrored");
  fold8TooltipEl.style.opacity = "";
  fold8TooltipEl.style.borderColor = "";
  fold8TooltipEl.style.transform = "";
  fold8TooltipEl.style.transformOrigin = "";
  fold8TooltipDateEl.style.opacity = "";
  fold8TooltipDescEl.style.opacity = "";
  fold8SequenceEvent = null;
  fold8SeqElapsed = 0;
  fold8SeqLastFrameTime = null;
  fold8AnchorSquareEl = null;
  fold8DateSpans = null;
  fold8DescSpans = null;
}

function fold8SequenceTick() {
  fold8SequenceLoopRunning = false;
  if (!fold8SequenceEvent) return;
  fold8AdvanceSequence();
  if (fold8SeqElapsed <= 0 && fold8SeqDirection === -1) {
    fold8ResetTooltip();
    return;
  }
  fold8SequenceLoopRunning = true;
  requestAnimationFrame(fold8SequenceTick);
}

function fold8EnsureSequenceRunning() {
  if (!fold8SequenceLoopRunning) {
    fold8SequenceLoopRunning = true;
    if (fold8SeqLastFrameTime === null) fold8SeqLastFrameTime = performance.now();
    requestAnimationFrame(fold8SequenceTick);
  }
}

let fold8AnchorSquareEl = null;

// Bespoke back-out curve for the fold-8 tooltip's grow-in (main.js
// only — page7.js/page9.js's own p7Ease/p9Ease are both monotonic and gentler),
// applied on top of tooltipT (itself already p9Ease'd via fold7LabelTrigger)
// for a punchier, more dynamic "pop" than a plain scale-from-0
// tween — cubic back-ease-out formula, but c1 is turned way down from its
// standard 1.70158 (which overshoots ~10%) to just a few percent, a subtle
// settle rather than a pronounced bounce.
function fold8TooltipGrowEase(t) {
  const c1 = 0.4;
  const c3 = c1 + 1;
  const x = t - 1;
  return 1 + c3 * x * x * x + c1 * x * x;
}

const fold6SquaresOverlayEl = document.getElementById("fold6SquaresOverlay");
const fold6SquareEls = FOLD6_SQUARES_OFFSET.map((_, i) => {
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

// Lerps a fold-6 square's background from its fold-8 resting color (#767676,
// lightened from Figma node 258:2206's original #2d2d2d fill per explicit
// instruction) toward a target group color as t goes 0->1 — null targetHex
// (the squares with no Figma-assigned color) just stays at that same
// #767676. Also the tooltip border's own gray-state color (see its
// borderColor assignment below), so both share one constant.
const FOLD6_SQUARE_REST_COLOR = [0x76, 0x76, 0x76];
function lerpFold6SquareColor(targetHex, t) {
  const [r0, g0, b0] = FOLD6_SQUARE_REST_COLOR;
  if (!targetHex) return `rgb(${r0}, ${g0}, ${b0})`;
  const n = parseInt(targetHex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const rr = Math.round(r0 + (r - r0) * t);
  const gg = Math.round(g0 + (g - g0) * t);
  const bb = Math.round(b0 + (b - b0) * t);
  return `rgb(${rr}, ${gg}, ${bb})`;
}

function layoutFold6Squares(W, H) {
  // Each square sits at its own {dx, dy} offset (FOLD6_SQUARES_OFFSET) from
  // the whole 8-square group's center, which itself is pinned to the
  // canvas's own center — so the group is centered as a unit rather than
  // reproducing Figma's absolute frame position.
  fold6SquareEls.forEach(({ wrap }, i) => {
    const { dx, dy } = FOLD6_SQUARES_OFFSET[i];
    wrap.style.left = `${W / 2 + dx}px`;
    wrap.style.top  = `${H / 2 + dy}px`;
  });
}

const page2TitleCardEl  = document.querySelector("#page-1 .text-card");
const pageNew3TitleCardEl = document.querySelector("#page-2 .text-card");
const page3TitleCardEl  = document.querySelector("#page-3 .text-card");
const page4TitleCardEl  = document.querySelector("#page-4 .text-card");
const page5TitleCardEl  = document.querySelector("#page-5 .text-card");
const page6TitleCardEl  = document.querySelector("#page-6 .text-card");
const page7TitleCardEl  = document.querySelector("#page-8 .text-card");
// Fold 7's own card (#page-7, "כל ריבוע מייצג..." — the timeline-intro title,
// not to be confused with page7TitleCardEl above, which is fold 9's #page-8
// card) drives the fold-6 squares' labels fading IN — previously this had no
// card of its own and just snapped on the instant fold6Trigger settled,
// which (now that that's a fixed ~1s tween instead of a scroll-coupled one)
// finishes long before the user actually reaches fold 7.
const fold7LabelCardEl  = document.querySelector("#page-7 .text-card");
const page12FrameEl     = document.querySelector("#page-12 .text-card-frame");
// Hoisted above checkFold13 (below), which needs it already resolved at
// definition time — also reused by p13SyncGateVisibility further down.
const page12StickyEl    = document.querySelector("#page-12 .page12-sticky-center");

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
  // Calls onTick() itself (trigger()/runLoop do too, via requestAnimationFrame)
  // so the jump is actually reflected immediately rather than leaving
  // whatever was last painted on screen stale until some other trigger
  // happens to repaint — harmless at page-init time (nothing's painted yet)
  // but load-bearing for any later instant reset (e.g. watchCardThreshold's
  // instantReverse).
  function set(target) {
    fromT = target;
    toT = target;
    phaseStart = null;
    onTick();
  }

  return { currentRaw, currentT: () => p9Ease(currentRaw()), trigger, set };
}

// Fold 3/4/5/6 each fire once, at their card's center crossing.
//
// All of these but fold5Trigger share one duration so the whole legend
// system reads as a single consistent tempo rather than each fold having its
// own slightly different feel — they used to range from 600ms to 1600ms.
const GROUP_TRANSITION_MS = 1900;
// fold2's entrance packs 3 sequential beats (shrink/move/label, see
// updateGroups) into one trigger instead of one — sharing GROUP_TRANSITION_MS
// like every single-beat fold made each beat read as a quick blip. Own
// duration instead, same precedent as FOLD5_TRANSITION_MS below.
const FOLD2_ENTRANCE_MS = 3400;
// fold5's exit packs 2 sequential beats (move-into-row, then shrink+fade
// out — see updateGroups) into one trigger, same reasoning as
// FOLD2_ENTRANCE_MS above — own duration instead of GROUP_TRANSITION_MS.
const FOLD5_TRANSITION_MS = 3600;
// fold3Trigger (bound to page3TitleCardEl, i.e. @fold4's own card — see the
// selector above) now also packs 2 sequential beats: the @fold3 split
// merging back into one dot, THEN the spread-across-the-screen move — same
// reasoning as FOLD2_ENTRANCE_MS/FOLD5_TRANSITION_MS above.
const FOLD4_ENTRANCE_MS = 3000;
const fold2Trigger      = makeTrigger(FOLD2_ENTRANCE_MS, updateGroups);
const fold3Trigger      = makeTrigger(FOLD4_ENTRANCE_MS, updateGroups);
const fold4Trigger      = makeTrigger(GROUP_TRANSITION_MS, updateGroups);
const fold5Trigger      = makeTrigger(FOLD5_TRANSITION_MS, updateGroups);
const fold6Trigger      = makeTrigger(GROUP_TRANSITION_MS, updateGroups);
const fold7LabelTrigger = makeTrigger(GROUP_TRANSITION_MS, updateGroups);
// Matches FOLD8_GROW_MS (the tooltip's own wall-clock grow-to-full-scale
// time, see its comment above) — not the typewriter that follows it — so the
// non-tooltip squares' dim-to-color fade finishes exactly as the tooltip
// reaches max scale, instead of tracking the shared GROUP_TRANSITION_MS tempo.
const FOLD8_SQUARE_DIM_MS = FOLD8_GROW_MS;
const fold8SquareDimTrigger = makeTrigger(FOLD8_SQUARE_DIM_MS, updateGroups);
// @fold9 trigger #1 — its title card's ordinary midpoint crossing. Colors in
// only the highlighted square (index 0) and its tooltip's border; the other
// 7 squares are untouched by this trigger.
const FOLD9_COLOR_MS = 500;
const fold9Trigger = makeTrigger(FOLD9_COLOR_MS, updateGroups);
// @fold9 trigger #2 — the same crossing that makes the year axis appear
// (its title card passing fully offscreen, top <= 0 — see p7AxisShouldShow/
// p7HasEngaged, page7.js). Colors in all 8 fold-6 squares (in their own
// actor's group color) and flies each one to the real per-event dot it's
// standing in for (FOLD6_SQUARE_ACTORS/FOLD6_SQUARE_OCCURRENCE below,
// p7TargetForActorOccurrence, page7.js) — permanently; the real per-event
// cascade never draws its own dot for these 8 events at all
// (p7GetClaimedEvents, page7.js), so this DOM square just stays visible once
// it arrives, no handoff to a separate real dot.
const FOLD9_FLY_MS = 1500;
const fold9FlyTrigger = makeTrigger(FOLD9_FLY_MS, () => {
  updateGroups();
  if (currentPage === 8) draw();
  checkFold9TooltipShrink();
});

// Keeps the fold-6 squares' blend toward page9's legit grid (see the
// p9LegitPosOf-based lerp in updateGroups) moving in lockstep with page8's
// own real-dot glide (p8CurrentT, page8.js) even once the user stops
// scrolling mid-glide — page8's own animation loop (p8RunAnimLoop) is a pure
// wall-clock requestAnimationFrame loop, not tied to further scroll events,
// but nothing besides a fresh "scroll" event otherwise re-runs updateGroups()
// for these squares, so without this they'd freeze wherever they were at the
// last scroll event while the real dots kept animating on to completion.
// Self-terminating: stops rescheduling once p8CurrentT() reaches 1, and is
// re-armed (see updateGroups above) the next time it's needed.
let fold9P8SyncLoopRunning = false;
function fold9EnsureP8SyncLoop() {
  if (fold9P8SyncLoopRunning) return;
  fold9P8SyncLoopRunning = true;
  (function tick() {
    updateGroups();
    if (typeof p8CurrentT === "function" && p8CurrentT() < 1) {
      requestAnimationFrame(tick);
    } else {
      fold9P8SyncLoopRunning = false;
    }
  })();
}

// Once square 0 (the tooltip's own square) actually arrives at its real dot
// (fold9FlyTrigger's raw progress reaching 1 — every square, including 0,
// finishes exactly at raw 1 regardless of its own stagger delay, see
// FOLD9_SQUARES_FLY_STAGGER's comment below), the tooltip holds fully shown
// for another FOLD9_TOOLTIP_SHRINK_DELAY_MS before it starts shrinking away
// on its own short trigger, so it doesn't feel like it vanishes the instant
// the dot lands. Un-latches (and reverses immediately, no delay) if
// fold9FlyTrigger ever drops back below raw 1 before the delay/shrink has
// finished — e.g. the user scrolls back up before this trigger has even
// fully settled from its own instant reverse — canceling any still-pending
// delay timer so it can't fire late into a reversed state.
const FOLD9_TOOLTIP_SHRINK_MS = 400;
const FOLD9_TOOLTIP_SHRINK_DELAY_MS = 500;
const fold9TooltipShrinkTrigger = makeTrigger(FOLD9_TOOLTIP_SHRINK_MS, updateGroups);
let fold9FlyReachedPast = null;
let fold9TooltipShrinkDelayTimer = null;
function checkFold9TooltipShrink() {
  const nowReached = fold9FlyTrigger.currentRaw() >= 1;
  if (fold9FlyReachedPast === null) { fold9FlyReachedPast = nowReached; fold9TooltipShrinkTrigger.set(nowReached ? 1 : 0); return; }
  if (nowReached !== fold9FlyReachedPast) {
    fold9FlyReachedPast = nowReached;
    if (fold9TooltipShrinkDelayTimer !== null) {
      clearTimeout(fold9TooltipShrinkDelayTimer);
      fold9TooltipShrinkDelayTimer = null;
    }
    if (nowReached) {
      fold9TooltipShrinkDelayTimer = setTimeout(() => {
        fold9TooltipShrinkDelayTimer = null;
        fold9TooltipShrinkTrigger.trigger(1);
      }, FOLD9_TOOLTIP_SHRINK_DELAY_MS);
    } else {
      fold9TooltipShrinkTrigger.trigger(0);
    }
  }
}
const fold13Trigger           = makeTrigger(GROUP_TRANSITION_MS, updateFold13);
let   fold13MorphStarted      = false;

// Watches one title card's top edge for crossing H*frac, firing trigger
// forward (1) on a downward crossing and reverse (0) on scrolling back up
// past the same point. The first ever call just primes isPast against
// whatever the starting scroll position already is (via trigger.set, no
// animation) — otherwise a page load/refresh mid-scroll would play every
// already-passed fold's animation from scratch on the first scroll tick.
//
// instantReverse (default false, every other caller keeps the normal
// animated-both-ways behavior): when true, scrolling back up snaps the
// reverse (0) straight to its end state via trigger.set instead of
// trigger.trigger.
function watchCardThreshold(cardEl, frac, trigger, instantReverse = false) {
  let isPast = null;
  return function check() {
    if (!cardEl) return;
    const nowPast = cardEl.getBoundingClientRect().top <= window.innerHeight * frac;
    if (isPast === null) { isPast = nowPast; trigger.set(nowPast ? 1 : 0); return; }
    if (nowPast !== isPast) {
      isPast = nowPast;
      if (!nowPast && instantReverse) trigger.set(0);
      else trigger.trigger(nowPast ? 1 : 0);
    }
  };
}

// New fold (@fold3, #page-2): dots split into 3 once, at the card's ordinary
// center crossing — same convention as every other fold trigger, instead of
// this fold's own bespoke pair of thresholds. The split no longer reverts on
// its own; it stays split for the rest of @fold3 and is merged back by
// @fold4's own entrance instead (fold3Trigger's first beat below), so the
// dots read as "divide, then re-form right before spreading out."
const FOLD_NEW3_SPLIT_MS  = 700;
const SPLIT_DOT_SIZE      = 7;   // px — each of the 3 dots while split
const SPLIT_DOT_GAP       = 5;   // px — gap between stacked dots
const SPLIT_OFFSET        = SPLIT_DOT_SIZE + SPLIT_DOT_GAP; // center-to-center spacing
const foldNew3SplitTrigger  = makeTrigger(FOLD_NEW3_SPLIT_MS, updateGroups);
const checkFoldNew3Split  = watchCardThreshold(pageNew3TitleCardEl, 0.5, foldNew3SplitTrigger);

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
const checkFold8SquareDim = watchCardThreshold(fold7LabelCardEl, 0.5, fold8SquareDimTrigger);
const checkFold9 = watchCardThreshold(page7TitleCardEl, 0.5, fold9Trigger);
// Same crossing as p7AxisShouldShow (page7.js) — title card fully offscreen,
// top <= 0. instantReverse: true, same reasoning as before removal — the fly
// covers real on-screen distance, so a fast scroll-past-then-back should
// snap the squares straight back to rest rather than being catchable
// mid-flight.
const checkFold9Fly = watchCardThreshold(page7TitleCardEl, 0, fold9FlyTrigger, true);
// Unlike every other fold trigger above, watches the *sticky wrapper*
// (.page12-sticky-center) at frac 0 (top <= 0) rather than the title card at
// its ordinary 0.5 — this fires exactly when the wrapper finishes sliding up
// and pins in place (title block stops moving, having reached its maximum
// point), not while it's still in transit and not late after it's already
// been sitting there a while. The gate physically can't be crossed while
// locked (scrollY is capped well short of this point until a pill's been
// dropped — see p13GateMax/p13GateLocked below), so no extra lock check is
// needed here.
const checkFold13 = watchCardThreshold(page12StickyEl, 0, fold13Trigger);

function checkGroupTriggers() {
  checkFoldNew3Split(); checkFold2(); checkFold3(); checkFold4(); checkFold5(); checkFold6(); checkFold7Label(); checkFold8SquareDim(); checkFold9(); checkFold9Fly(); checkFold13();
}

// Default (legend/fold3/fold4/fold5) swatch size + the swatch-to-label gap
// established earlier — vs. the smaller mini-legend ones (Figma node
// 120:1279/Frame 3219), interpolated continuously by fold6Trigger rather
// than snapped, same "seamless, no popping" rule as every other transition.
const CLUSTER_SWATCH_SIZE = 13, CLUSTER_LABEL_GAP = 12;
const LEFT_LEGEND_SWATCH_SIZE = 6, LEFT_LEGEND_LABEL_GAP = 6;

// Source-credit line under fold6's mini-legend (no Figma node — new content,
// not part of the original design). Fixed px width/font, same "position
// anchors are frame-scaled, sizing isn't" convention as .group-label's own
// hardcoded font sizes above. FOLD6_BOTTOM_ROW is the mini-legend's
// bottom-most row (highest fold6.y = פעילי שמאל) — the note hangs off it.
const FOLD6_NOTE_TEXT = "הפעולות נאספו ממאגר ACLED, האוסף מידע מדיווחים פומביים, ארגוני תיעוד וכלי תקשורת.";
const FOLD6_NOTE_WIDTH = 150;
// Divider (faint hairline) sits between the last row and the note, its own
// height folded into the gap math below like the note's own height is.
const FOLD6_DIVIDER_GAP_TOP = 10, FOLD6_DIVIDER_GAP_BOTTOM = 10, FOLD6_DIVIDER_HEIGHT = 1;
const FOLD6_BOTTOM_ROW_INDEX = GROUPS.findIndex(g => g.color === "#d946ef");
const FOLD6_BOTTOM_ROW = GROUPS[FOLD6_BOTTOM_ROW_INDEX];
const fold6NoteEl = document.createElement("div");
fold6NoteEl.className = "fold6-note";
fold6NoteEl.style.width = `${FOLD6_NOTE_WIDTH}px`;
fold6NoteEl.textContent = FOLD6_NOTE_TEXT;
groupsOverlayEl.appendChild(fold6NoteEl);
// Hidden, permanently off-screen clone of the bottom row's *settled* label
// (fixed 14px/400, matching fold6's post-lerp end state) — measuring this
// instead of the live groupItems[FOLD6_BOTTOM_ROW_INDEX].label lets the
// note/divider below compute their target position from where that row
// ENDS UP, not wherever it currently is mid-flight. Reading the live label's
// getBoundingClientRect() instead (an earlier version of this code did)
// made the note visibly trail the row in from its fold5 position instead of
// staying put and just fading in.
const fold6RowMeasureEl = document.createElement("span");
fold6RowMeasureEl.className = "group-label";
fold6RowMeasureEl.style.cssText = "visibility:hidden; left:-9999px; top:-9999px; font-size:14px; font-weight:400;";
fold6RowMeasureEl.textContent = FOLD6_BOTTOM_ROW.label;
groupsOverlayEl.appendChild(fold6RowMeasureEl);
const fold6NoteDividerEl = document.createElement("div");
fold6NoteDividerEl.className = "fold6-note-divider";
fold6NoteDividerEl.style.width = `${FOLD6_NOTE_WIDTH}px`;
groupsOverlayEl.appendChild(fold6NoteDividerEl);

const LEGEND_ROW_GAP = 78; // vertical gap between legend rows
const LEGEND_PER_COL = Math.ceil(GROUPS.length / 2); // groups per legend column (two columns)

// Every group's position is one continuous chain of lerps — legend → fold3 →
// fold4 → fold5 — driven by each stage's own t. Once a given t reaches 1 the
// position is exactly that stage's target (no residual blend), so this is
// equivalent to the old discrete per-fold layout at rest, but never snaps
// between two different DOM nodes to get there.
function updateGroups() {
  const W = canvas.clientWidth, H = canvas.clientHeight;
  // @fold4's entrance (fold3Trigger, its card's ordinary center crossing)
  // packs 2 sequential beats into one timeline, same raw/span-slicing
  // convention as @fold2's entrance/@fold5's exit above: (1) the @fold3 split
  // merges back into one dot, THEN (2) the dot spreads across the screen to
  // its fold3Pos target below. Reversing (scrolling back up) runs both beats
  // in reverse, last-to-first — the dot re-splits only once it's back near
  // its @fold3 spot, not immediately on scrolling up.
  const raw3 = fold3Trigger.currentRaw();
  const FOLD4_MERGE_SPAN = 0.22, FOLD4_GAP_SPAN = 0.1, FOLD4_SPREAD_SPAN = 0.68; // sums to 1
  const fold4MergeT = p9Ease(Math.max(0, Math.min(1, raw3 / FOLD4_MERGE_SPAN)));
  const e3 = p9Ease(Math.max(0, Math.min(1, (raw3 - FOLD4_MERGE_SPAN - FOLD4_GAP_SPAN) / FOLD4_SPREAD_SPAN)));
  const e4 = fold4Trigger.currentT(), e6 = fold6Trigger.currentT();
  const splitEased = foldNew3SplitTrigger.currentT() * (1 - fold4MergeT);
  const legendTop = H / 2 - ((LEGEND_PER_COL - 1) * LEGEND_ROW_GAP) / 2;

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

  // Measured live off the real (fixed-width) note element rather than a
  // hidden scaffold — its height only ever changes on a font swap/width
  // edit, both already covered by layoutGroups() re-running this function,
  // so re-reading it every tick costs nothing and can never go stale.
  const fold6NoteHeightPx = fold6NoteEl.offsetHeight;
  const fold6NoteBlockGapPx = FOLD6_DIVIDER_GAP_TOP + FOLD6_DIVIDER_HEIGHT + FOLD6_DIVIDER_GAP_BOTTOM;
  const fold6NoteShiftPx = (fold6NoteBlockGapPx + fold6NoteHeightPx) / 2;

  // Beats 2 and 3 each stagger the rows top-to-bottom within their own
  // third of the timeline, same makeTrigger-style "reaches target exactly at
  // local t=1" convention as every other staggered stage in this file.
  const ROW_STAGGER = 0.05;
  const ROW_SPAN = 1 - ROW_STAGGER * (LEGEND_PER_COL - 1);

  GROUPS.forEach((g, i) => {
    const item = groupItems[i];
    // Column/row within the two-column legend — stagger by row so both
    // columns fill top-to-bottom in sync rather than one column after the other.
    const legendCol = Math.floor(i / LEGEND_PER_COL);
    const legendRow = i % LEGEND_PER_COL;
    const moveT  = p9Ease(Math.max(0, Math.min(1, (moveBaseRaw  - legendRow * ROW_STAGGER) / ROW_SPAN)));
    const labelT = p9Ease(Math.max(0, Math.min(1, (labelBaseRaw - legendRow * ROW_STAGGER) / ROW_SPAN)));

    // Legend entrance originates from wherever this group's own dot landed
    // in @fold1's dot columns (PAGE0_GROUP_DOT_ANCHORS, page1.js), flying in
    // on moveT (beat 2 above) rather than the raw e2. Falls back to the
    // legend spot itself (a no-op lerp) if this group had no matching dot
    // this load (very short viewports can run out of dots before all
    // groups get one).
    const legendColOffset = W * 0.09;
    const legendTargetX = W / 2 - 13 + (legendCol * 2 - 1) * legendColOffset;
    const legendTargetY = legendTop + legendRow * LEGEND_ROW_GAP;
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
      // Shifted up by half the note's own (gap + height) so the rows+note
      // block stays centered on the same vertical anchor the 5 rows alone
      // used to occupy, instead of the note just tacking on below them and
      // reading off-center. Baked into the lerp target itself (not applied
      // as a separate post-hoc offset) so it eases in with the same e6 as
      // everything else, rather than popping once the rows finish settling.
      const fold6Pos = { x: (g.fold6.x / GROUPS_FRAME_W) * W, y: (g.fold6.y / GROUPS_FRAME_H) * H - fold6NoteShiftPx };
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

    // During the split the main swatch shrinks to SPLIT_DOT_SIZE. Offset its
    // top so its center stays at swatchSize/2 (= label center) rather than
    // drifting up toward 0 as it shrinks.
    const visualSwatchSize = swatchSize + (SPLIT_DOT_SIZE - swatchSize) * splitEased;
    item.swatch.style.width  = `${visualSwatchSize}px`;
    item.swatch.style.height = `${visualSwatchSize}px`;
    item.swatch.style.top    = `${(swatchSize - visualSwatchSize) / 2}px`;

    // Satellites: horizontal center on the swatch (left:0, width:visualSwatchSize),
    // vertical center on swatchSize/2 (= label center, = swatch center after the
    // top-offset above).
    const satPx = SPLIT_DOT_SIZE * splitEased;
    const satOffPx = SPLIT_OFFSET * splitEased;
    const swatchCy = swatchSize / 2;
    const satL = (visualSwatchSize - satPx) / 2;
    item.satTop.style.width  = `${satPx}px`;
    item.satTop.style.height = `${satPx}px`;
    item.satTop.style.left   = `${satL}px`;
    item.satTop.style.top    = `${swatchCy - satOffPx - satPx / 2}px`;
    item.satTop.style.opacity = String(fold5FadeMul);
    item.satBot.style.width  = `${satPx}px`;
    item.satBot.style.height = `${satPx}px`;
    item.satBot.style.left   = `${satL}px`;
    item.satBot.style.top    = `${swatchCy + satOffPx - satPx / 2}px`;
    item.satBot.style.opacity = String(fold5FadeMul);
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
      item.label.style.fontSize   = `${18 + (14 - 18) * e6}px`;
      item.label.style.fontWeight = "400";
      item.label.style.color      = `rgba(0, 0, 0, ${1 + (0.85 - 1) * e6})`;
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

  // The note and its divider just fade in at their final resting spot (same
  // e6 as the rows) rather than lerping in from anywhere — unlike the rows,
  // neither has an earlier fold to fly in from, so animating opacity alone
  // reads as part of the same settle instead of a second, separate motion.
  // Anchored off FOLD6_BOTTOM_ROW's own fold6 TARGET (already shifted up by
  // fold6NoteShiftPx above), same x as every mini-legend swatch — deliberately
  // NOT the live groupItems[FOLD6_BOTTOM_ROW_INDEX] position, which is still
  // mid-lerp for most of e6's range and would drag the note in from wherever
  // that row currently is instead of holding it still and just fading it in.
  //
  // dividerY is built from fold6RowMeasureEl's *settled* label height (not a
  // swatch-height estimate) — the label (14px text) is taller than the 6px
  // swatch it's centered on, so a swatch-based estimate undershoots the row's
  // real bottom edge and makes the top gap look smaller than the bottom one.
  const fold6X = (FOLD6_BOTTOM_ROW.fold6.x / GROUPS_FRAME_W) * W;
  const fold6TargetAnchorY = (FOLD6_BOTTOM_ROW.fold6.y / GROUPS_FRAME_H) * H - fold6NoteShiftPx;
  const lastRowLabelBottomTarget = fold6TargetAnchorY + LEFT_LEGEND_SWATCH_SIZE / 2 + fold6RowMeasureEl.offsetHeight / 2;
  const dividerY = lastRowLabelBottomTarget + FOLD6_DIVIDER_GAP_TOP;
  const noteY = dividerY + FOLD6_DIVIDER_HEIGHT + FOLD6_DIVIDER_GAP_BOTTOM;
  fold6NoteDividerEl.style.left = `${fold6X}px`;
  fold6NoteDividerEl.style.top = `${dividerY}px`;
  fold6NoteDividerEl.style.opacity = String(e6);
  fold6NoteEl.style.left = `${fold6X}px`;
  fold6NoteEl.style.top = `${noteY}px`;
  fold6NoteEl.style.opacity = String(e6);

  // (groupsOverlayEl's own "is-active" is set once at init, not toggled here
  // — see the comment by its declaration above.)
  fold6SquaresOverlayEl.style.opacity = "1";

  const e7Label = fold7LabelTrigger.currentT();
  // @fold9 trigger #1 (its title card's ordinary midpoint crossing, see
  // checkFold9 above) colors in only the highlighted square (index 0) and
  // its tooltip's border below — the other 7 squares stay base gray until a
  // later trigger is added.
  const fold9Phase1T = fold9Trigger.currentT();
  // @fold9 trigger #2 (title card fully offscreen, same crossing as the year
  // axis appearing — see checkFold9Fly above) colors in the other 7 squares
  // and flies all 8 to their real per-event dot.
  const fold9FlyT = fold9FlyTrigger.currentT();
  // Color-in reads faster than the fly itself — "secondary attribute can
  // snap, position never does" (see CLAUDE.md's animation-conventions note):
  // eased over just the first COLOR_SPAN of the trigger's raw timeline (own
  // re-eased span, same GROW_SPAN-style convention as growScale below), so
  // every square is already its real group color well before it finishes
  // traveling to its real dot, instead of the two finishing together.
  const FOLD9_COLOR_SPAN = 0.4;
  const fold9FlyColorT = p9Ease(Math.max(0, Math.min(1, fold9FlyTrigger.currentRaw() / FOLD9_COLOR_SPAN)));
  // Read raw (linear, un-eased) rather than fold9FlyTrigger's own currentT()
  // — that bakes in p9Ease, the gentle default, but a square arriving at (and
  // visually becoming) a real per-event dot is exactly the "materializing
  // dot" case the animation-conventions doc calls out for p7Ease (punchy
  // cubic ease-out) instead, same curve p7DrawSideSquares uses for the real
  // timeline's own per-event pop-in.
  const fold9FlyRaw = fold9FlyTrigger.currentRaw();
  // Squares arrive staggered rather than in lockstep, the same "many small
  // squares popping in as a batch" convention as p7DrawSideSquares' own
  // cascade (and page0's row stagger, page9's arrival stagger). Expressed as
  // a fraction of fold9FlyTrigger's own fixed raw span, so every square still
  // finishes exactly at raw 1 regardless of this internal stagger.
  const FOLD9_SQUARES_FLY_STAGGER = 0.4;
  // Scale from 0 -> 1 as e6 (fold 6's own trigger progress) advances, so the
  // square grows from nothing rather than fading in. Eased over just the
  // first GROW_SPAN of the trigger's raw timeline (own re-eased span, "position
  // never does" convention) so the pop finishes well before the mini-legend
  // glide (also driven by e6) settles, instead of taking the full duration.
  const GROW_SPAN = 0.55;
  const growScale = p9Ease(Math.max(0, Math.min(1, fold6Trigger.currentRaw() / GROW_SPAN)));

  // page8CheckScroll (the only thing that ever calls p8Trigger) is its own
  // separate window "scroll" listener, registered well after this one —
  // relying on it having already run for *this* scroll position, before the
  // squares below read p8CurrentT(), is a listener-ordering assumption a
  // fast/synthetic scroll can violate. Calling it directly here first removes
  // that dependency — idempotent (guarded by p8Engaged itself).
  if (typeof page8CheckScroll === "function") page8CheckScroll();
  // page8's own glide (p8CurrentT, page8.js) runs on a pure wall-clock
  // requestAnimationFrame loop (p8RunAnimLoop) independent of scrolling — it
  // calls draw() every frame to keep the real canvas dots animating, but
  // nothing else re-runs updateGroups() (what actually moves these DOM
  // squares) unless a fresh "scroll" event happens to fire too. If the user
  // stops scrolling before the 3000ms glide finishes (an entirely normal
  // pause-to-read), the real dots keep gliding to their final position while
  // these squares silently freeze wherever they were at the last scroll
  // event — exactly the "stuck" bug. fold9SyncWithP8Glide (own
  // self-scheduling rAF loop, started below) keeps calling updateGroups()
  // every frame for as long as the glide is still mid-flight, independent of
  // further scrolling, so the two always stay in lockstep.
  if (typeof p8Engaged !== "undefined" && p8Engaged && typeof p8CurrentT === "function" && p8CurrentT() < 1) {
    fold9EnsureP8SyncLoop();
  }

  fold6SquareEls.forEach(({ wrap, sq, label }, i) => {
    const colorT = i === 0 ? fold9Phase1T : fold9FlyColorT;
    sq.style.background = lerpFold6SquareColor(FOLD6_SQUARE_COLORS[i], colorT);
    // Figma node 258:2159: every square except the one with a tooltip (index
    // 0, kept at full opacity) renders at ~46% opacity while still gray —
    // only within @fold8's own trigger window (tooltipT, same value gating
    // the tooltip below): before that window starts, all 8 squares are still
    // uniform (as in fold 6's own Figma frame, 258:2206, where none of this
    // dimming shows).
    const tooltipT = e7Label; // tooltip stays once shown — see fold8TooltipEl's own comment below
    // Dim opacity lowered (0.46 -> 0.3) and driven by its own trigger
    // (fold8SquareDimTrigger, FOLD8_SQUARE_DIM_MS = FOLD8_GROW_MS) timed to
    // finish exactly as the tooltip reaches max scale, not the shared
    // GROUP_TRANSITION_MS tempo. Reads raw (linear), not currentT() (p9Ease's
    // sine ramp reads oddly over a short, plain opacity fade) — same
    // "opacity fades don't need easing" convention as HOVER_DIM_MS elsewhere.
    const FOLD6_SQUARE_DIM_OPACITY = 0.3;
    const dimT = fold8SquareDimTrigger.currentRaw();
    const dimFromFold8 = 1 - (1 - FOLD6_SQUARE_DIM_OPACITY) * dimT;
    // Restored to full opacity in step with @fold9 trigger #2 (fold9FlyT) —
    // once a square is colored in and flying to its real dot, the dimmed
    // ~30% opacity (which only ever fit its gray, pre-color state) no longer
    // applies; a real timeline dot is always full opacity.
    let opacity = i === 0 ? 1 : dimFromFold8 + (1 - dimFromFold8) * fold9FlyT;
    // Once this square IS a real timeline dot (fold9FlyT ~ 1), it must dim
    // the same way every other canvas dot does while a different dot is
    // hovered (p7.hoveredEvent, p7DrawSideSquares' own snap-to-0.35 dim) —
    // otherwise these 8 squares read as permanently full-opacity while the
    // rest of the grid dims around the hovered dot.
    if (typeof p7 !== "undefined" && p7.hoveredEvent && typeof p7EventForActorOccurrence === "function") {
      const hoverEvent = p7EventForActorOccurrence(FOLD6_SQUARE_ACTORS[i], FOLD6_SQUARE_OCCURRENCE[i]);
      if (hoverEvent && hoverEvent !== p7.hoveredEvent) opacity *= 0.35;
    }
    sq.style.opacity = String(opacity);

    // Real-event tooltip (shared #page9Tooltip, see fold8TooltipEl above),
    // shown unconditionally once @fold8's own window starts (e7Label ramping
    // in) — no hover required — until it shrinks away once its own square
    // arrives at its real dot (fold9TooltipShrinkTrigger, see above). Only
    // square 0 currently drives it; if more squares are ever added back,
    // each would need its own tooltip instance.
    const shrinkT = fold9TooltipShrinkTrigger.currentT();
    if (i === 0) {
      const event = p7EventForActorOccurrence(FOLD6_SQUARE_ACTORS[i], FOLD6_SQUARE_OCCURRENCE[i]);
      // shrinkT >= 1 (fold 9's own, later, one-way "arrived at its real dot"
      // collapse) or a missing event forces an immediate hide below —
      // unrelated to @fold8's own scroll reversal, which is handled entirely
      // by fold8SeqElapsed/fold8SeqDirection instead (see their own comments
      // above fold8SequenceEvent).
      const forceHide = !event || shrinkT >= 1;
      const wantShow = !forceHide && tooltipT > 0.001;

      if (wantShow && fold8SequenceEvent !== event) {
        // New event: (re)start the reversible grow-then-type sequence fresh
        // from elapsed 0 — see FOLD8_GROW_MS's own comment above for why this
        // isn't driven by tooltipT directly. Build the full-text spans now
        // (fold8SetupTypewriter), before any scaling happens, so the box is
        // already laid out at its true final size for the entire grow-in —
        // see that function's own comment for why.
        fold8SequenceEvent = event;
        fold8SeqElapsed = 0;
        fold8SeqDirection = 1;
        fold8SeqLastFrameTime = null;
        fold8PrevTooltipRaw = fold7LabelTrigger.currentRaw();
        fold8DateSpans = fold8SetupTypewriter(fold8TooltipDateEl, p7FormatDateDMY(event.date));
        fold8DescSpans = fold8SetupTypewriter(fold8TooltipDescEl, event.descHeMedium);
      }

      if (forceHide) {
        if (fold8TooltipOwnsIt) fold8ResetTooltip();
      } else if (fold8SequenceEvent) {
        fold8TooltipOwnsIt = true;
        // Colors in step with the highlighted square itself (both driven by
        // fold9Phase1T/@fold9 trigger #1) — gray until the title card's
        // midpoint crossing, then transitions to the actor's real group
        // color together with the square.
        fold8TooltipEl.style.borderColor = lerpFold6SquareColor(FOLD6_SQUARE_COLORS[0], colorT);
        fold8TooltipEl.classList.add("is-visible");
        // Opens toward the left of the square (mirrored corner, same convention
        // p9HoverInit/p7HoverInit use for left-side events), not the right —
        // its pointer corner (bottom-right when mirrored) is also the point
        // the grow-in below scales from.
        fold8TooltipEl.classList.add("is-mirrored");
        fold8TooltipEl.style.opacity = "1";
        fold8TooltipEl.style.transformOrigin = "bottom right";
        fold8AnchorSquareEl = sq;

        fold8AdvanceSequence();
        fold8EnsureSequenceRunning();

        // Reversing all the way back to elapsed 0 is a real mirrored
        // shrink-to-nothing (fold8AdvanceSequence already scaled the box to
        // ~0) — safe to fully hide/reset now.
        if (fold8SeqElapsed <= 0 && fold8SeqDirection === -1) fold8ResetTooltip();
      }
    }

    // Rest position (this square's plain fold6/fold9 anchor) -> target real
    // dot, lerped by flyT so it lands exactly as fold9FlyTrigger settles.
    // Left as a no-op translate/size if the target can't be resolved yet
    // (events.json still loading). growScale (0->1, driven by e6) is layered
    // on top of the translate either way, so the square always grows from
    // nothing regardless of whether the fly-out target has resolved.
    //
    // p7TargetForActorOccurrence is page7's own static grid — this square's
    // target *while the real timeline is still playing* (i.e. the previous,
    // correct behavior, reverted here after briefly trying to snap straight
    // to page9's grid, which showed these squares jumping to the wrong spot
    // mid-timeline before page8's own glide had even started). Only once the
    // timeline is actually finished and page8 starts its own real-dot glide
    // toward page9's legit grid (p8CurrentT(), page8.js) does this square
    // blend along with it too, via the exact same p9LegitPosOf/p9Ease math
    // blendAndDraw (page8.js) uses for every other real dot — so it "animates
    // down just like any other dot" instead of snapping the instant page9 is
    // reached.
    const target = p7TargetForActorOccurrence(FOLD6_SQUARE_ACTORS[i], FOLD6_SQUARE_OCCURRENCE[i], W, H);
    // currentPage reaching 11 (drawPage9, PAGES above) is a *harder* signal
    // than p8CurrentT() > 0: the section-level IntersectionObserver that
    // flips currentPage can cross into page9's own slot before page8's own
    // title-reaches-center trigger (page8CheckScroll, watching a narrower
    // condition) ever fires — and once currentPage is actually 11, drawPage9
    // is unconditionally drawing every real dot at its final legit position
    // already, no blend, full stop. Relying on p8CurrentT() alone left a
    // window there where the real grid had already jumped to its final
    // layout but this square hadn't moved at all yet. So: full weight (ease
    // 1) the instant currentPage reaches 11, otherwise follow page8's own
    // blend for as long as it's actually driving the real dots (currentPage
    // === 10). page8CheckScroll/fold9EnsureP8SyncLoop above make sure
    // p8CurrentT() below is both freshly triggered and kept moving even
    // without further scroll events.
    const ease = currentPage >= 11 ? 1 : p9Ease(typeof p8CurrentT === "function" ? p8CurrentT() : 0);
    if (target && ease > 0) {
      const targetEvent = p7EventForActorOccurrence(FOLD6_SQUARE_ACTORS[i], FOLD6_SQUARE_OCCURRENCE[i]);
      if (targetEvent) {
        p9EnsureIndex();
        const side = p9.leftIndexOf.has(targetEvent) ? "left" : "right";
        const indexOf = side === "left" ? p9.leftIndexOf : p9.rightIndexOf;
        const legitPos = p9LegitPosOf(targetEvent, indexOf, side, p9LegitGeometry(W, H));
        if (legitPos) {
          target.x = target.x + (legitPos.x - target.x) * ease;
          target.y = target.y + (legitPos.y - target.y) * ease;
        }
      }
    }
    if (target) {
      const delayFrac = fold6SquareEls.length > 1
        ? (i / (fold6SquareEls.length - 1)) * FOLD9_SQUARES_FLY_STAGGER
        : 0;
      const localRaw = Math.min(1, Math.max(0, (fold9FlyRaw - delayFrac) / (1 - delayFrac)));
      const flyT = p7Ease(localRaw);

      const restX = W / 2 + FOLD6_SQUARES_OFFSET[i].dx;
      const restY = H / 2 + FOLD6_SQUARES_OFFSET[i].dy;
      const dx = (target.x - restX) * flyT;
      const dy = (target.y - restY) * flyT;
      sq.style.transform = `translate(${dx}px, ${dy}px) scale(${growScale})`;
      const size = 8 + (target.size - 8) * flyT;
      sq.style.width = sq.style.height = `${size}px`;

      // This DOM square *is* the real dot for this event permanently — the
      // real per-event cascade skips it entirely (p7GetClaimedEvents,
      // page7.js), so there's no separate canvas dot to ever hand off to.
      // Stays visible once it arrives and just sits there like any other
      // timeline dot from then on.
      wrap.style.display = "";
    } else {
      sq.style.transform = `scale(${growScale})`;
      sq.style.width = sq.style.height = "8px";
      wrap.style.display = "";
    }
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

// A programmatic smooth scroll (the dev fold-jump dropdown's own
// scrollIntoView({behavior:"smooth"}), main.js above) can momentarily
// overshoot or coalesce its very last frame, letting a card's top transiently
// cross a watchCardThreshold boundary during the animated transit even though
// the scroll actually *settles* on the other side of that boundary — with no
// further "scroll" event firing afterward to correct it, the trigger is left
// stuck fired even though the true resting position never should have
// crossed it. "scrollend" (fires once, after any scroll — including animated
// ones — has fully settled) is a cheap, harmless-if-unsupported safety net:
// re-check every trigger against the actual final position once scrolling is
// truly done.
window.addEventListener("scrollend", checkGroupTriggers, { passive: true });

// drawFold9/drawFold7 (currentPage 8/7, #page-8/#page-7) used to be static
// background-only, so nothing redrew the canvas while scrolling within them.
// Now drawFold9 also draws the year axis preview (gated on p7AxisShouldShow,
// page7.js) once fold 9's title passes offscreen, and both keep drawing the
// real per-event squares for as long as p7RealTimelineReached is true (see
// its own comment, page7.js) — each needs its own scroll-driven redraw to
// actually pick up those changes while currentPage stays 7 or 8 the whole
// time it's happening.
let fold9AxisTicking = false;
window.addEventListener("scroll", () => {
  if (fold9AxisTicking) return;
  fold9AxisTicking = true;
  requestAnimationFrame(() => {
    if (currentPage === 7 || currentPage === 8) draw();
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
const page8TitleEl = document.querySelector("#page-10 .section-title");
let page8Ticking = false;

function page8CheckScroll() {
  if (!p8Engaged) {
    const rect = page8TitleEl.getBoundingClientRect();
    const titleCenter = rect.top + rect.height / 2;
    if (titleCenter <= window.innerHeight / 2) p8Trigger();
  } else if (currentPage === 10 && p8TriggerScrollY !== null && window.scrollY < p8TriggerScrollY) {
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
const page9TitleCardEl  = document.querySelector("#page-11 .text-card");
const page9TitleRowEl   = document.querySelector("#page-11 .page9-title-row");
const page9StickyEl     = document.querySelector("#page-11 .page9-sticky");
const page9TrayEl       = document.querySelector("#page-11 .page9-tray");
const page9HeaderEl     = document.querySelector("#page-11 .page9-header");
const page9ZoneWrapEl   = document.querySelector("#page-11 .page9-zone-wrap-extreme");
let page9Ticking = false;
let page9LinePast = false; // previous "title past center" state, so the line trigger only fires on the transition
let page9WasStuck = false; // tracks isStuck across frames to detect the stuck→unstuck transition
// Categories dropped into the extreme zone at the moment the user last
// scrolled up out of @fold12 — captured in #page9ZoneAbove's own DOM order
// (most-recently-dropped first) right before p9ResetDrops clears it, so
// p9RestoreDrops can put the exact same pills/dots back if they scroll back
// down into @fold12, rather than that choice being lost for the rest of the
// session the instant they scroll away.
let page9SavedAboveIdxs = null;

function page9UpdateFromScroll() {
  // Use the title *row* container's position rather than the card's own
  // getBoundingClientRect() — once the card switches to position:fixed its
  // top is permanently the fixed value and can never signal a scroll-back.
  const titleRowTop = page9TitleRowEl.getBoundingClientRect().top;

  // Card's natural center = titleRowTop + 50vh; crosses viewport center when
  // titleRowTop <= 0.
  const titlePastCenter = titleRowTop <= 0;
  if (titlePastCenter !== page9LinePast) {
    page9LinePast = titlePastCenter;
    p9TriggerLine(titlePastCenter ? 1 : 0);
  }

  // Card's natural sticky top = titleRowTop + 50vh - cardH/2 ≈ titleRowTop + 50vh.
  // Sticks when that value <= 4.4vh → titleRowTop <= (0.044 - 0.5) * H.
  const isStuck = titleRowTop <= window.innerHeight * (0.044 - 0.5);
  page9TitleCardEl.classList.toggle("is-stuck", isStuck);
  // Both tray and zone-wrap are position:fixed — always at their final viewport
  // position — so both can fire together the moment the title card sticks.
  page9StickyEl.classList.toggle("engaged", isStuck);

  // Scrolling back up past the stick threshold: animate all extreme dots back
  // down to the legit zone and return pills to the tray — but remember which
  // categories were dropped first, so scrolling back down can restore them
  // (see page9SavedAboveIdxs above) instead of this being a permanent reset.
  if (page9WasStuck && !isStuck && typeof p9ResetDrops === "function") {
    const zoneAboveEl = document.getElementById("page9ZoneAbove");
    const droppedIdxs = zoneAboveEl
      ? Array.from(zoneAboveEl.querySelectorAll(".page9-pill")).map(p => Number(p.dataset.idx))
      : [];
    page9SavedAboveIdxs = droppedIdxs.length ? droppedIdxs : null;
    p9ResetDrops(true);
  } else if (!page9WasStuck && isStuck && page9SavedAboveIdxs && typeof p9RestoreDrops === "function") {
    // Scrolling back down into @fold12 — replay the saved drops.
    p9RestoreDrops(page9SavedAboveIdxs);
    page9SavedAboveIdxs = null;
  }
  page9WasStuck = isStuck;
}

window.addEventListener("scroll", () => {
  if (page9Ticking) return;
  page9Ticking = true;
  // updateFold13's scroll-linked half (eScroll/fold13ScrollT) needs a fresh
  // read on every scroll tick, not just once via fold13Trigger's own firing —
  // see that function's own comment. updateFold13 is a plain function
  // declaration (hoisted), so it's callable here regardless of textual order.
  requestAnimationFrame(() => { page9UpdateFromScroll(); updateFold13(); page9Ticking = false; });
}, { passive: true });

// ── @fold13 animations ───────────────────────────────────────────────────────
// Two independently-driven progress values, per explicit feedback: @fold12
// is "in position" the instant its interaction state is reached (the gate
// line) — from there, scrolling in *either* direction must visibly move
// @fold12's own panel/frame and @fold13's title with no dead scroll space,
// but the *extreme dots'* spread into freeform must still only play once the
// title fully stops at the top, as a proper animated flourish rather than
// something scroll-scrubbed.
//   - eScroll (fold13ScrollT below): a plain scroll-position readout over the
//     gate-line-to-fully-arrived range, 0..1, moving continuously with every
//     scroll tick in both directions. Drives:
//       - tray slides down (inline style.transform, transition:none so it tracks scroll)
//       - header title + subtitle fade out (page9HeaderEl opacity)
//       - extreme zone + dropped pill labels fade out (page9ZoneWrapEl opacity)
//       - canvas count numbers + dividing line + legit dots fade out (p9.fold13OutT)
//       - legend fades out (groupsOverlayEl opacity)
//       - fold12's own title card (frame included) fades out (page9TitleCardEl opacity)
//   - eTrigger (fold13Trigger, unchanged): fires once, only when the title
//     card's wrapper (.page12-sticky-center) reaches top<=0 (fully stopped),
//     and plays out over a fixed GROUP_TRANSITION_MS regardless of further
//     scroll. Drives only the extreme dots' morph to freeform (p9.fold13ExtremeMorphT).
function updateFold13() {
  const tTrigger = fold13Trigger.currentT();
  const eTrigger = 1 - Math.pow(1 - tTrigger, 3); // ease-out cubic

  // Capture starting dot positions on the first morph frame — p9.lastPositions
  // holds the clustered positions from the previous (non-morphed) frame.
  if (eTrigger > 0 && !fold13MorphStarted) {
    fold13MorphStarted = true;
    p9.fold13StartPos  = new Map(p9.lastPositions);
    p12FreeformTargets = null; // force recompute with current W/H
  }
  if (eTrigger <= 0) {
    fold13MorphStarted = false;
    p9.fold13StartPos  = null;
  }
  p9.fold13ExtremeMorphT = eTrigger; // lerps extreme dots to freeform in drawPage12

  const tScroll = fold13ScrollT();
  const eScroll = 1 - Math.pow(1 - tScroll, 3); // same ease-out cubic, scroll-driven

  p9.fold13OutT = eScroll; // fades legit dots / dividing line / counts in drawPage9

  if (eScroll > 0) {
    page9TrayEl.style.transition = "none";
    page9TrayEl.style.transform  = `translate(-50%, ${eScroll * 100}%)`;
  } else {
    page9TrayEl.style.transition = "";
    page9TrayEl.style.transform  = "";
  }
  // When fully reversed (eScroll=0) clear inline opacity so CSS class rules
  // (engaged, is-active, etc.) take over — inline "1" would otherwise
  // override them and freeze elements in their @fold13 state.
  const opacityVal = eScroll > 0 ? String(1 - eScroll) : '';
  if (page9HeaderEl)    page9HeaderEl.style.opacity    = opacityVal;
  if (page9TitleCardEl) page9TitleCardEl.style.opacity = opacityVal;
  if (page9ZoneWrapEl)  page9ZoneWrapEl.style.opacity  = opacityVal;
  groupsOverlayEl.style.opacity = opacityVal;
  // page12TitleCardEl (the fold13 card) stays visible throughout.
  draw();
}

// Fraction of the way through @fold12's unavoidable one-viewport hand-off to
// @fold13 (the gate can't unlock any later than one viewport before #page-12
// arrives, and the sticky wrapper needs that same one viewport of scroll to
// finish pinning — see p13GateMax and #page-12's own min-height comment in
// style.css) — 0 at the gate line, 1 once fully arrived. A plain scroll
// readout, not a makeTrigger, since this half must move continuously with
// scroll in both directions rather than play out over fixed real time.
function fold13ScrollT() {
  const page12 = document.getElementById("page-12");
  if (!page12) return 0;
  const start = p13GateMax();
  const end   = page12.offsetTop;
  if (end <= start) return window.scrollY >= end ? 1 : 0;
  return Math.max(0, Math.min(1, (window.scrollY - start) / (end - start)));
}

// ── @fold13 scroll gate ──────────────────────────────────────────────────────
// #page-12 is locked until at least one @dragcard has been dropped into the
// extreme zone. p9.sides (page9.js) is the source of truth.
function p13GateLocked() {
  return !p9.sides.some(s => s === "above");
}

// The gate position: keep #page-12's top at the viewport bottom (scrollY max =
// gateEl.offsetTop - innerHeight). Beyond this, #page-12 enters the viewport.
function p13GateMax() {
  const gateEl = document.getElementById("page-12");
  return gateEl ? gateEl.offsetTop - window.innerHeight : Infinity;
}

// #page-12's title sits in a position:sticky wrapper, so the *instant* real
// scrollY crosses the gate — even for a single momentum-phase wheel tick that
// ignores preventDefault (some browsers mark those non-cancelable, so the
// wheel handler below can't stop them) — it genuinely pins into view for at
// least one paint, before any scrollY-snapback JS gets a chance to run. An
// opacity toggle doesn't have that race: it isn't driven by scroll position at
// all, only by p9.sides actually changing (called from page9.js's commitDrop/
// p9ResetDrops, the only two places that happens), so the title stays fully
// invisible for the whole locked duration regardless of any transient
// overscroll — no per-frame lag window for it to peek through.
function p13SyncGateVisibility() {
  if (page12StickyEl) page12StickyEl.classList.toggle("gate-hidden", p13GateLocked());
}
p13SyncGateVisibility();

// Desktop: block downward mouse-wheel past the gate. Must also catch the
// single wheel tick that *crosses* the gate, not just ticks that land on/past
// it — checking only `scrollY >= max` let one large-delta tick scroll clean
// past the threshold (revealing #page-12's title for a frame until the
// scroll-event safety net below caught up), instead of ever actually stopping
// right at the line.
window.addEventListener("wheel", (e) => {
  if (!p13GateLocked() || e.deltaY <= 0) return;
  const max = p13GateMax();
  if (window.scrollY >= max) {
    e.preventDefault();
  } else if (window.scrollY + e.deltaY > max) {
    e.preventDefault();
    window.scrollTo({ top: max, behavior: "instant" });
  }
}, { passive: false });

// Keyboard: block arrow-down / page-down / space / End at the gate
window.addEventListener("keydown", (e) => {
  if (!p13GateLocked()) return;
  if (["ArrowDown", "PageDown", "End", " "].includes(e.key) &&
      window.scrollY >= p13GateMax() - 1) {
    e.preventDefault();
  }
});

// Mobile: block downward touch-swipe past the gate
let p13TouchStartY = 0;
window.addEventListener("touchstart", (e) => {
  p13TouchStartY = e.touches[0].clientY;
}, { passive: true });
window.addEventListener("touchmove", (e) => {
  if (!p13GateLocked()) return;
  if (e.touches[0].clientY < p13TouchStartY &&
      window.scrollY >= p13GateMax() - 10) {
    e.preventDefault();
  }
}, { passive: false });

// Safety net: snap back if scroll somehow lands past the gate (momentum-phase
// wheel events that ignore preventDefault, scrollbar drags, etc). Corrects
// synchronously in the scroll handler itself rather than deferring to the next
// requestAnimationFrame — that extra frame of delay is exactly the window
// during which #page-12's title was visibly peeking up before snapping back.
window.addEventListener("scroll", () => {
  if (!p13GateLocked()) return;
  const max = p13GateMax();
  if (window.scrollY > max) {
    window.scrollTo({ top: max, behavior: "instant" });
  }
}, { passive: true });

// Freeze the page9 sticky panel in place while scrolled into @fold13 — once
// the user passes #page-11's scroll context, position:sticky releases and the
// panel would drift off. Switching to position:fixed keeps it locked at top:0.
// The sticky element unpins at scrollY = #page-12.offsetTop - window.innerHeight
// (one full viewport before #page-12 starts), so freeze at that same threshold,
// not at #page-12.offsetTop itself (that would be too late by a full vh).
const p13GateEl = document.getElementById("page-12");
window.addEventListener("scroll", () => {
  if (!p13GateEl) return;
  page9StickyEl.classList.toggle("frozen", window.scrollY >= p13GateEl.offsetTop - window.innerHeight);
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
  page7UpdateFromScroll();
  page8CheckScroll();
  page9UpdateFromScroll();
  updateFold13();
  window.addEventListener("resize", () => {
    // buildPage0AllDots() must run before layoutGroups() — it repopulates
    // PAGE0_GROUP_DOT_ANCHORS (page1.js), which updateGroups() reads for the
    // fold1->fold2 legend entrance below.
    buildPage0AllDots();
    // buildPage0AllDots() recreates every decorative dot hidden/shrunk
    // (opacity 0, scale(0), popped: false) as if playPage0Entrance hadn't
    // run yet — but playPage0Entrance only ever runs once, at page load, so
    // without this these dots would stay invisible for the rest of the
    // session after any resize (mobile browsers fire resize on scroll, from
    // the address bar showing/hiding, so this could happen mid-scroll). If
    // the entrance already finished, snap the new dots straight to their
    // settled/popped state instead of waiting for an entrance that will
    // never replay.
    if (page0EntranceDone) {
      PAGE0_DECORATIVE_DOT_ELS.forEach((d) => {
        d.el.style.opacity = "1";
        d.el.style.transform = "scale(1)";
        d.popped = true;
      });
    }
    init();
    layoutGroups();
    updateTextCardFrameDashes();
  });
});
