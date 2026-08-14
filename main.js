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
    if (!p7HasEngaged && !p7AnyAnimActive()) p7RealTimelineReached = false;
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
    if (!p7HasEngaged && !p7AnyAnimActive()) p7RealTimelineReached = false;
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
  updateFoldNumberBadge();
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
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-dasharray", "2 2");
    svg.appendChild(path);
    tip.insertBefore(svg, tip.firstChild);
  } else {
    path = svg.firstElementChild;
  }
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  // Inset by 1 (half the 2px stroke) so the stroke's outer edge lands on the
  // box's true edge; r=7 then puts that outer edge back on the background's
  // own 8px radius, same as the title cards' rx=7.
  const r = 7, i = 1, R = w - 1, B = h - 1;
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
  // Hidden by default (see style.css); Ctrl+Shift+F toggles it and persists
  // the choice in localStorage so it stays put across reloads. localStorage
  // access is wrapped in try/catch — browsers with storage blocked (Safari's
  // "Block all cookies", strict private-browsing modes, some corporate
  // policies) throw a SecurityError on access rather than failing quietly,
  // which would otherwise kill this whole (unrelated) script and blank the
  // entire page for anyone with those settings.
  const FOLD_BADGE_VISIBLE_KEY = "foldNumberBadgeVisible";
  // Visible on every load — force-shown regardless of any stale saved pref.
  // Ctrl+Shift+F still hides/shows it within the session.
  foldNumberBadge.classList.add("is-visible");
  try { localStorage.setItem(FOLD_BADGE_VISIBLE_KEY, "1"); } catch {}
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "f") {
      e.preventDefault();
      const visible = foldNumberBadge.classList.toggle("is-visible");
      try { localStorage.setItem(FOLD_BADGE_VISIBLE_KEY, visible ? "1" : "0"); } catch {}
    }
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
  if (currentPage === 7 && page < 7) p7ResetForReplay();

  // Continuing into page9 (fold12) while page8's own timeline->legit-grid
  // glide (p8CurrentT, page8.js) hasn't actually finished yet — the
  // IntersectionObserver driving this can cross into page9's slot before
  // that glide reaches t=1. drawPage9 has no notion of that glide's
  // progress on its own, so without seeding p9.anim here the dots would
  // snap straight to their final legit position the instant page9 takes
  // over drawing instead of page8 — see p8CaptureBlendedPositions' own
  // comment (page8.js) for the full rationale.
  if (currentPage === 8 && page === 9 && typeof p8CurrentT === "function" && p8Engaged && p8CurrentT() < 1) {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    p9.anim = {
      from: p8CaptureBlendedPositions(W, H),
      start: performance.now(),
      duration: Math.max(1, P8_TRANSITION_DURATION * (1 - p8CurrentT())),
      plainGlide: true, // see p9PlaceDot (page9.js) — keeps this at page8's own pace, no tier stagger
    };
  }

  // Mirror of the above, the other direction: leaving page8's bridge back
  // toward the real timeline (#page-7, drawPage7) while page8's reverse glide
  // (p8CurrentT decreasing toward 0) hasn't finished yet. drawPage7 has no
  // notion of that glide's progress on its own — every square would
  // otherwise teleport straight to its resting timeline cell the instant
  // this section starts drawing instead of page8. See p7EntryAnim's own
  // comment (page7.js) for the full rationale.
  if (currentPage === 8 && page === 7 && typeof p8CurrentT === "function" && p8CurrentT() > 0) {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    p7EntryAnim = {
      from: p8CaptureBlendedPositions(W, H),
      start: performance.now(),
      duration: Math.max(1, P8_TRANSITION_DURATION * p8CurrentT()),
    };
  }

  currentPage = page;
  updateGroups();
  updateFoldNumberBadge();
  draw();

  // p9.anim (if just seeded above) only advances when something drives a
  // continuous per-frame loop — every other call site that sets p9.anim
  // follows it with this same call. Without it, the glide only progressed on
  // whatever incidental draw() calls scroll/hover happened to trigger, i.e.
  // it would stall the instant the user stopped scrolling and lurch forward
  // again on the next unrelated redraw, instead of playing smoothly.
  if (currentPage === 9 && p9.anim) p9RunAnimLoop();

  // Same reasoning, for p7EntryAnim's own continuous loop.
  if (currentPage === 7 && p7EntryAnim) p7StartAnimLoop();
}

const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) setActivePage(Number(entry.target.dataset.page));
  });
}, { rootMargin: "-50% 0px -50% 0px", threshold: 0 });

sections.forEach(sec => sectionObserver.observe(sec));

// ── @fold1's logo fades out in place as soon as the user starts scrolling,
// rather than scrolling away with the rest of @fold1 (per explicit
// instruction — title/subtitle still scroll normally, only the logo is
// exempted). It's position: fixed (style.css), so without this it'd just
// sit frozen on screen forever; this is what actually clears it. Fully
// faded by PAGE0_FADE_VH of scrolling.
//
// Gated on page0EntranceDone (set by playPage0Entrance below) so this
// scroll-driven control doesn't fight the page-load entrance animation,
// which owns both elements' opacity (fading them in from 0) until it
// finishes — see playPage0Entrance. ──
const page0LogoEl = document.querySelector(".page0-logo");
const page0TitleEl = document.querySelector(".page0-title");
const page0SubtitleEl = document.querySelector(".page0-subtitle");
const PAGE0_FADE_VH = 0.4; // fraction of one viewport height
// Logo opacity lags its raw scroll-derived target via a per-frame
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
}

// ── @fold1's page-load entrance, per explicit spec: title/subtitle slide up
// from off-screen first; once they're in place, the dot columns pop in one
// row at a time (both columns synced by syncedRow, see page1.js — the right
// column has 2 more rows than the left, so it starts popping 2 beats
// earlier); once every dot/group-swatch has popped, the logo fades in last.
//
// Scrolling can interrupt this early, but only the title/subtitle beat — per
// explicit instruction, scrolling during the entrance should let the user
// drag the title away immediately with their own scroll (via
// page0ApplyTitleScrollLag above) rather than waiting for the slide-in to
// finish first. The moment window.scrollY > 0 is seen, page0TitleTakenOver
// flips true (permanently — the entrance never reclaims the title once
// scroll has taken it) and this loop stops touching page0TitleEl/
// page0SubtitleEl at all, handing them over entirely. The dots and the
// logo fade-in is untouched by this — they keep playing out on
// their own elapsed-time schedule regardless of an early title takeover,
// i.e. the rest of the entrance catches up on its own even if the title has
// already scrolled off. The logo only switches over to its own
// scroll-driven fade (page0ApplyLogoScrollFade above) once *their* beat
// actually finishes (page0EntranceDone), independent of the title.
//
// Driven by one requestAnimationFrame loop, running forever (it becomes the
// permanent per-frame driver for whichever of title/subtitle and logo
// have been handed to scroll), with p9Ease applied fresh to each
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
      if (elapsed >= totalMs) page0EntranceDone = true;
    } else {
      page0ApplyLogoScrollFade();
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

// ── Page 7's tall section (#page-7) is a pure scroll-driver: scroll position
// -> date. Its own intro title used to be fused in here as a static header
// above the timeline's month list — it's now its own earlier fold (#page-5,
// "כל ריבוע..."), with fold 9 ("צבע הריבוע...", #page-6) after it, so the
// real per-event reveal below doesn't engage until both have been scrolled
// past. ──
const page7Section = document.getElementById("page-7");
let page7Ticking = false;

// The scrub's opening is deliberately slower than the rest: over the first
// P7_SCRUB_EASE_IN_SPAN of the scroll range the date creeps in from a standstill
// and ramps up to the normal rate, so the axis doesn't lurch the moment the
// timeline engages. Shape is smoothstep on the local 0..1 (h = 2u²-u³): it
// starts at zero speed and hits exactly speed 1 at the seam, and since h(1)=1
// the eased value rejoins the linear one there — so nothing past the ramp
// changes, and t=1 still lands on the same end date.
const P7_SCRUB_EASE_IN_SPAN = 0.15;
function p7ScrubEaseIn(t) {
  if (t >= P7_SCRUB_EASE_IN_SPAN) return t;
  const u = t / P7_SCRUB_EASE_IN_SPAN;
  return P7_SCRUB_EASE_IN_SPAN * u * u * (2 - u);
}

function page7UpdateFromScroll() {
  const rect = page7Section.getBoundingClientRect();

  // t=0 the instant fold 9's own title card clears the top of the viewport
  // (the same instant p7HasEngaged flips true below) rather than when
  // #page-7's own top reaches the viewport top — #page-6 (fold 9) keeps
  // scrolling for a while after its title clears before #page-7 actually
  // begins, and anchoring t=0 to #page-7's own top left that whole stretch as
  // dead scroll space where engagement had already fired but the axis never
  // moved off 0%. `gap` (page7TitleCardEl's top minus #page-7's own top, at
  // this same instant) is a pure document-layout constant regardless of
  // current scroll position, so recomputing it fresh here — instead of
  // caching it — keeps this correct across a resize too. t=1 stays anchored
  // to the exact same endpoint as before (#page-7's bottom reaching the
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
    if (currentPage === 7) { draw(); p7RecheckHover(); }
    return;
  }

  const minD = new Date(p7.minDate + "T00:00:00Z");
  const maxD = new Date(p7.maxDate + "T00:00:00Z");
  const totalDays = Math.round((maxD - minD) / 86400000);
  const cur = new Date(minD);
  cur.setUTCDate(cur.getUTCDate() + Math.round(p7ScrubEaseIn(t) * totalDays));
  p7.currentDate = cur.toISOString().slice(0, 10);

  if (currentPage === 7) { draw(); p7RecheckHover(); }
}

window.addEventListener("scroll", () => {
  if (page7Ticking) return;
  page7Ticking = true;
  requestAnimationFrame(() => { page7UpdateFromScroll(); page7Ticking = false; });
}, { passive: true });

// ── Folds 2 through 4 (ids #page-1..#page-3) all show the same 6 camp
// groups — flying from @fold1's hero dot columns straight into the two-camp
// column layout (@fold2), gaining labels (@fold3), splitting into 3 (@fold4),
// then merging back + settling into the left mini-legend (@fold5). Rather
// than a separate overlay per fold crossfading into the next (which made the
// handoffs visibly "pop" — two different DOM nodes for the same group,
// swapped at the exact instant their positions matched), there's ONE
// persistent .group-item per group here, continuously repositioned and
// restyled as the user scrolls. Matched across stages by color, not label.
// All coordinates are read straight off the shared 1512×982 Figma frame and
// rescaled to the canvas's actual size. ──
const GROUPS_FRAME_H = 982; // Figma frame height the y-coordinates below are authored against

// fold4.x is always the SWATCH's own anchor point (matching every other
// coordinate in this file) — NOT the container's left edge. The 6 camp
// groups split into two clean top-aligned columns, hand-placed per explicit
// written spec (not a Figma frame): coalition trio (מפגינים חרדים/תנועות
// התנחלות/קבוצות ימין לאומיות) at x=887 (screen-right), change trio (תנועות
// שלום ודו קיום/ארגוני מחאה נגד הממשלה/מפגינים ערבים ישראלים) at x=725
// (screen-left), both starting
// at y=443 with a 40-unit row gap. The two columns are placed with enough
// clearance on each side of the frame's own horizontal center (x=756, i.e.
// always screen-center regardless of viewport width). Only the y values are
// still read off this fold4 block — the x/grid geometry now comes from the
// @fold2 grid constants (FOLD2_CAMP_CENTER_GAP_PX etc., Figma 279:1342),
// placed symmetrically about screen center in plain px.
//
// fold6 (Figma node 120:1279/Frame 3219) is the persistent mini-legend the
// groups settle into for good at @fold4 (#page-3, fold6Trigger — legacy name).
//
// `actor` is the events.json/P7_COLORS join key — see p7ActorColor in
// page7.js, which reads this group's `color` directly so the real per-event
// canvas dots always match this legend, including after a future color edit
// here. #00B00C has no `actor` — the dataset has no Israeli-Arab events, so
// it never appears on the real timeline.
const GROUPS = [
  { color: "#00B00C", label: "מפגינים ערבים ישראלים",
    fold4: { x: 725,  y: 514, swatchFirst: true }, fold6: { x: 31, y: 560 } },
  { color: "#FFAC11", label: "תנועות התנחלות באיו״ש",           actor: "settlers",
    fold4: { x: 887,  y: 488, swatchFirst: true }, fold6: { x: 31, y: 512 } },
  { color: "#CC0000", label: "קבוצות ימין לאומיות",      actor: "Right-wing activists",
    fold4: { x: 887,  y: 514, swatchFirst: true }, fold6: { x: 31, y: 536 } },
  { color: "#0073FF", label: "ארגוני מחאה נגד הממשלה", actor: "Protesters against the government",
    fold4: { x: 725,  y: 488, swatchFirst: true }, fold6: { x: 31, y: 512 } },
  { color: "#CD00CD", label: "ארגוני שלום ודו קיום",     actor: "left wing activists",
    fold4: { x: 725,  y: 462, swatchFirst: true }, fold6: { x: 31, y: 536 } },
  { color: "#4A4A4A", label: "מפגינים חרדים",           actor: "Haredi Jews",
    fold4: { x: 887,  y: 462, swatchFirst: true }, fold6: { x: 31, y: 560 } },
];

// @fold1's dot columns (buildPage0AllDots, page1.js) read 12 of their 200 dot
// colors live from GROUPS above — called from here, not from page1.js
// itself, since page1.js's <script> tag loads before this one and GROUPS
// doesn't exist yet at that point.
buildPage0AllDots();

// Which camp each group belongs to, top-to-bottom in that camp's own column
// order. Declared here (rather than down by the camp headers, where they used
// to live) because @fold2's grid roster below already needs them.
const FOLD4_COALITION_ROWS = ["#4A4A4A", "#FFAC11", "#CC0000"].map(c => GROUPS.find(g => g.color === c));
const FOLD4_CHANGE_ROWS    = ["#CD00CD", "#0073FF", "#00B00C"].map(c => GROUPS.find(g => g.color === c));

// ── @fold2's camp grids (Figma node 279:1342, frame 1512×982) ──
// Each camp is no longer a single column of 3 labelled rows — it's a 4-col ×
// 3-row block of 12 plain rects, no labels and no center divider (per Figma).
// The 3 GROUPS rows are still the block's rows; each row is simply 4 rects
// wide, all in that group's color, and only the row's RIGHTMOST rect is the
// persistent .group-item. The other 3 per row ("fillers") are real @fold1
// decorative dots that fly in alongside it instead of shrinking away, then
// shrink out at @fold3 as that row's label types itself in — which is why the
// surviving rect never moves between @fold2 and @fold3.
//
// Measured off the RENDERED Figma frame (its two blocks' own layer x/y are
// mutually inconsistent; the render is a clean regular grid both sides):
// 11px rects, 31px column pitch, 28px row pitch (row pitch tuned by eye at
// @fold3, where the column reads with its labels), rows at y=462/488/514
// (those rows live in GROUPS' own fold4.y, so they can't drift out of sync).
// Pitches are plain px (not frame-scaled) for the same reason
// FOLD2_CAMP_CENTER_GAP_PX below is — a grid must stay square at any viewport.
const FOLD2_GRID_COLS = 4;
const FOLD2_COL_PITCH_PX = 31, FOLD2_ROW_PITCH_PX = 28;
// Each camp block's center, as a fixed px distance either side of screen
// center (Figma: block centers at x=590 and x=913 about the frame's own 756).
// Symmetric on purpose — Figma's own two blocks are within ~5px of symmetric,
// and at @fold2 neither block carries a label to unbalance it.
const FOLD2_CAMP_CENTER_GAP_PX = 160;

// 18 of @fold1's decorative dots (3 per group row) are picked out here to
// become @fold2's filler rects. Chosen by even spread across the whole dot
// sequence rather than the first 18, so the columns don't visibly gut one
// stretch of themselves when all the others shrink away. Deterministic per
// viewport height, same as the dot colors themselves. Re-run after every
// buildPage0AllDots() (initial load + resize), which recreates the dot els.
// Which cell of its camp's 4×3 block each group's own rect occupies at
// @fold2, by GROUPS index. Scattered on purpose (per explicit instruction:
// the 6 group colors sit *among* the @fold1-colored rects, "not in any
// particular order") rather than lining the blocks' right edge up into a
// readable column of its own. Deliberately NOT one per row either — a row
// may hold two group colors or none, which is what keeps the scatter reading
// as organic rather than as a disguised column. Nothing downstream depends
// on the row spread: at @fold3 every group flies out of this cell into its
// own row of the block's rightmost column (see the align beat in
// updateGroups), so the labels still get one clean line each.
const FOLD2_GROUP_CELL = [
  { row: 2, col: 3 },  // #00B00C  מפגינים ערבים ישראלים   (change)
  { row: 0, col: 3 },  // #FFAC11  תנועות התנחלות          (coalition)
  { row: 2, col: 2 },  // #CC0000  קבוצות ימין לאומיות     (coalition)
  { row: 2, col: 0 },  // #0073FF  ארגוני מחאה נגד הממשלה  (change)
  { row: 1, col: 2 },  // #CD00CD  תנועות שלום ודו קיום    (change)
  { row: 0, col: 1 },  // #4A4A4A  מפגינים חרדים           (coalition)
];
// Flat cell roster, parallel to fold2FillerDots: cell k sits in `camp`'s
// block at grid row/col (0 = top / leftmost) — every cell of both 4×3 blocks
// except the 6 FOLD2_GROUP_CELL gives the real .group-items.
const FOLD2_FILLER_CELLS = [true, false].flatMap((camp) =>
  Array.from({ length: FOLD2_GRID_COLS * 3 }, (_, k) => ({
    camp, row: Math.floor(k / FOLD2_GRID_COLS), col: k % FOLD2_GRID_COLS,
  })).filter(({ row, col }) => !GROUPS.some((g, i) =>
    FOLD4_COALITION_ROWS.includes(g) === camp &&
    FOLD2_GROUP_CELL[i].row === row && FOLD2_GROUP_CELL[i].col === col))
);
let fold2FillerDots = [];
function assignFold2Fillers() {
  const pool = PAGE0_DECORATIVE_DOT_ELS;
  const need = FOLD2_FILLER_CELLS.length;
  fold2FillerDots = [];
  pool.forEach((d) => { d.isFold2Filler = false; });
  if (!pool.length) return;
  const step = pool.length / need;
  const used = new Set();
  for (let k = 0; k < need; k++) {
    let idx = Math.min(pool.length - 1, Math.floor(k * step));
    while (used.has(idx) && idx < pool.length - 1) idx++;
    if (used.has(idx)) break; // very short viewport: fewer dots than cells
    used.add(idx);
    pool[idx].isFold2Filler = true;
    fold2FillerDots.push(pool[idx]);
  }
}
assignFold2Fillers();

// Parallel to GROUPS — group i's own @fold1 entrance progress (0..1, eased),
// continuously updated by playPage0Entrance's animation frame. Read by
// updateGroups() to keep every group-colored dot's swatch invisible/popping
// in (regardless of what labelT etc. would otherwise say) until its
// own beat of the @fold1 entrance, then stays at 1 forever after.
const page0PopT = GROUPS.map(() => 0);

// Hidden measuring span for the group labels at their @fold3 size (the plain
// .group-label 18px state). The camp grids' own horizontal placement is
// derived from these widths (see campFold3X/changeBlockX in
// updateGroups), and a label's rendered width can't be read off the live
// item — mid-@fold3 it only holds the characters typed so far. Cached by
// color, and re-measured once the webfont has actually loaded, since a
// fallback-face measurement would place the grids a few px off.
const groupLabelMeasureEl = document.createElement("span");
groupLabelMeasureEl.className = "group-label";
groupLabelMeasureEl.style.cssText = "visibility:hidden;left:-9999px;top:0";
let groupLabelWidths = {};
function groupLabelWidth(g) {
  if (groupLabelWidths[g.color] == null) {
    groupLabelMeasureEl.textContent = g.label;
    groupLabelWidths[g.color] = groupLabelMeasureEl.offsetWidth;
  }
  return groupLabelWidths[g.color];
}
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => { groupLabelWidths = {}; groupLabelInkShifts = {}; updateGroups(); });
}

// How far a label's INK center sits from its line box's own center, at a
// given font-size. `transform: translateY(-50%)` centers the line BOX, but a
// line box is sized from the font's full ascent/descent — and Hebrew type
// uses almost none of the descent, so box-centering leaves the visible text
// sitting low and the swatch reading as if it were aligned to the label's
// top rather than its middle. Measured off a fixed reference string (not
// each row's own text) so every row shifts by the same amount, and cached
// per font-size since it's a pure property of the face.
const GROUP_LABEL_INK_REF = "אבגדהוזחט";
let groupLabelInkShifts = {};
const groupLabelInkCtx = document.createElement("canvas").getContext("2d");
function groupLabelInkShift(fontSize) {
  const key = fontSize.toFixed(2);
  if (groupLabelInkShifts[key] == null) {
    groupLabelInkCtx.font = `${fontSize}px 'Assistant', sans-serif`;
    const m = groupLabelInkCtx.measureText(GROUP_LABEL_INK_REF);
    // Both pairs are distances from the baseline; the ink center and the box
    // center are each their own midpoint, and we want the gap between them.
    const inkCenter = (m.actualBoundingBoxDescent - m.actualBoundingBoxAscent) / 2;
    const boxCenter = (m.fontBoundingBoxDescent - m.fontBoundingBoxAscent) / 2;
    groupLabelInkShifts[key] = boxCenter - inkCenter;
  }
  return groupLabelInkShifts[key];
}

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

const groupItems = GROUPS.map(({ color, label: labelText }) => {
  const el = document.createElement("div");
  el.className = "group-item";
  const swatch = document.createElement("span");
  swatch.className = "group-swatch";
  swatch.style.background = color;
  const label = document.createElement("span");
  label.className = "group-label";
  label.textContent = labelText;
  el.appendChild(swatch);
  el.appendChild(label);
  groupsOverlayEl.appendChild(el);
  return { el, label, swatch };
});
groupsOverlayEl.appendChild(groupLabelMeasureEl);

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
// opacity:0); harmless if never revealed.
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
// S/R/H/H (uneven, but there's no 4th right-camp actor to reach for — order
// swapped from the original H/R/S/H per explicit instruction, so the
// top-right square is now S/מתיישבים and the 3rd-from-top-right is
// H/חרדים). Index 0 is unchanged ("Protesters against the government")
// since @fold8's tooltip (below) targets that specific square/event, and
// it's already a left-camp actor in the left column.
// S=מתיישבים L=פעילי שמאל H=חרדים P=מתנגדי הרפורמה R=פעילי ימין
const FOLD6_SQUARE_ACTORS = [
  "Protesters against the government",   // 0 (L col) - P - blue
  "settlers",                            // 1 (R col) - S - orange  (top-right; swapped with 5 per explicit instruction)
  "left wing activists",                 // 2 (L col) - L - pink
  "Right-wing activists",                // 3 (R col) - R - green
  "Protesters against the government",   // 4 (L col) - P - blue
  "Haredi Jews",                         // 5 (R col) - H - grey  (3rd from top-right; swapped with 1 per explicit instruction)
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
// every page) would stomp an unrelated hover-driven tooltip on page-7/-9.
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
  // Same dashed stroke the hover tooltip gets — redrawn per frame because the
  // box's height settles as the typewriter's spans lay out.
  updateTooltipDash(fold8TooltipEl);
}

// Fully hides/resets the tooltip — called once the reversible sequence above
// has actually unwound all the way back to elapsed 0 (a real mirrored
// shrink-to-nothing), not on a raw tooltipT threshold snap.
function fold8ResetTooltip() {
  fold8TooltipOwnsIt = false;
  fold8TooltipEl.classList.remove("is-visible");
  fold8TooltipEl.classList.remove("is-mirrored");
  fold8TooltipEl.style.opacity = "";
  fold8TooltipEl.style.color = "";
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
// @fold3 (#page-2) — the group labels fading in next to their rects.
const page3TitleCardEl  = document.querySelector("#page-2 .text-card");
const page6TitleCardEl  = document.querySelector("#page-3 .text-card");
const page7TitleCardEl  = document.querySelector("#page-6 .text-card");
// Fold 6's own card (#page-5, "כל ריבוע מייצג..." — the timeline-intro title,
// not to be confused with page7TitleCardEl above, which is fold 8's #page-7
// card) drives the fold-6 squares' labels fading IN — previously this had no
// card of its own and just snapped on the instant fold6Trigger settled,
// which (now that that's a fixed ~1s tween instead of a scroll-coupled one)
// finishes long before the user actually reaches fold 7.
const fold7LabelCardEl  = document.querySelector("#page-5 .text-card");
// Phase-2 fold: the ACLED "אספנו תיעודים…" fold, now #page-4 after the mini-legend
// split fold at #page-3. This card drives the grey squares growing in at centre
// AND the ACLED bottom-legend note fading in — both were previously coupled to
// fold6Trigger (the split) and are now detached onto their own trigger so the
// split and the squares+note land on two separate folds.
const squaresRevealCardEl = document.querySelector("#page-4 .text-card");
// Hoisted above checkFold13 (below), which needs it already resolved at
// definition time — also reused by p13SyncGateVisibility further down.
const page12StickyEl    = document.querySelector("#page-10 .page12-sticky-center");

// Generic discrete trigger: a fixed-duration 0<->1 phase fired once by
// crossing a scroll threshold (see watchCardThreshold below), exactly like
// p8Trigger/p8TriggerReverse (page8.js) and p9TriggerLine (page9.js) — never
// re-derives progress from live scroll position, so reversing mid-flight
// covers only the remaining distance rather than restarting.
function makeTrigger(duration, onTick, onSettle) {
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
      // Fires once, the instant a phase reaches its target — lets one trigger
      // chain the next.
      if (onSettle) onSettle(toT);
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

// Fold triggers each fire once, at their card's center crossing.
//
// Most share one duration so the whole legend system reads as a single
// consistent tempo rather than each fold having its own slightly different
// feel — they used to range from 600ms to 1600ms.
const GROUP_TRANSITION_MS = 1900;
// fold2's entrance packs 3 sequential beats (shrink/move/headers, see
// updateGroups) into one trigger — sharing GROUP_TRANSITION_MS like every
// single-beat fold made each beat read as a quick blip. Own duration instead.
const FOLD2_ENTRANCE_MS = 2400;
// The 3 beats' windows on that one duration, as {start, len} fractions of the
// trigger's raw 0..1 timeline — shrink (@fold1's decorative dots collapsing),
// move (everything flying into the camp grids), header (the two camp titles
// typing in). Windows, not a sequential split, so beats may overlap: header
// currently shares move's exact window, i.e. the titles type as the rects fly.
// `let`, not `const`, only so the compare/manual harness
// (_debug-fold2-fly.js) can retune the sequencing live; production never
// writes to it.
// Tuned by eye on a live timeline harness, hence the un-round fractions —
// they're the ms windows (in the trailing comments) divided by
// FOLD2_ENTRANCE_MS. The dots' shrink and the flight deliberately overlap
// slightly, and the two camp headers type a beat apart rather than together.
const FOLD2_BEATS = {
  shrink:          { start: 0,     len: 0.198 },  //    0 →  475ms
  move:            { start: 0.073, len: 0.708 },  //  175 → 1875ms
  headerCoalition: { start: 0.677, len: 0.219 },  // 1625 → 2150ms
  headerChange:    { start: 0.781, len: 0.219 },  // 1875 → 2400ms
};
const fold2Trigger      = makeTrigger(FOLD2_ENTRANCE_MS, updateGroups);
// @fold3 (#page-2): the same 3-beat shape as @fold2 above — (1) the 18
// filler rects shrink away, (2) each row's surviving rect flies sideways so
// all 3 of a camp's rects line up in ONE vertical column, (3) the labels
// type in, cascading one rect at a time (see FOLD3_TYPE_ORDER below).
//
// Tuned by eye at @fold3 (manual/ harness), so the beats are now their own
// absolute MS windows rather than @fold2's fractions rescaled. The trigger
// still works in 0..1, so FOLD3_BEATS below is derived from the ms table —
// and the total is derived too, from whichever beat ends last, so there's
// never a stretch of dead timeline hanging off the end.
const FOLD3_BEAT_MS = {
  shrink: { start:   0, len:  376 },  //    0 →  376ms  filler rects shrink away
  align:  { start: 140, len: 1000 },  //  140 → 1140ms  rects fly into one column
  type:   { start: 750, len: 1140 },  //  750 → 1890ms  labels type in
};
const FOLD3_ENTRANCE_MS = Math.max(
  ...Object.values(FOLD3_BEAT_MS).map((b) => b.start + b.len));
const FOLD3_BEATS = Object.fromEntries(Object.entries(FOLD3_BEAT_MS).map(
  ([k, b]) => [k, { start: b.start / FOLD3_ENTRANCE_MS, len: b.len / FOLD3_ENTRANCE_MS }]));
// How much of `type` each row's own typing is delayed by, as a fraction of
// that beat — same "stagger inside one shared window" convention as @fold2's
// row-by-row flight (ROW_STAGGER below), so the last row still finishes
// exactly at the beat's end.
const FOLD3_TYPE_ROW_STAGGER = 0.10;
// Which order the labels type in. "rows": both camps' same-height rows type
// together, top to bottom (the original). "right"/"left": one whole camp
// top to bottom, then the other. "rtl": row by row down the screen, the
// right camp's row typing just before the left camp's.
const FOLD3_TYPE_ORDER = "right";
// The label's slot in that order, and how many slots there are — the stagger
// below is one shared window sliced by slot, so the last slot always finishes
// exactly at the beat's end whichever order is picked.
function fold3TypeSlot(row, isCoalition, rowCount) {
  if (FOLD3_TYPE_ORDER === "right") return (isCoalition ? 0 : rowCount) + row;
  if (FOLD3_TYPE_ORDER === "left")  return (isCoalition ? rowCount : 0) + row;
  if (FOLD3_TYPE_ORDER === "rtl")   return row * 2 + (isCoalition ? 0 : 1);
  return row;
}
const fold3TypeSlotCount = rowCount =>
  FOLD3_TYPE_ORDER === "rows" ? rowCount : rowCount * 2;
const fold3Trigger      = makeTrigger(FOLD3_ENTRANCE_MS, updateGroups);
// @fold4 (#page-3): 2 sequential beats on one trigger — the split
// merging back into one rect first, THEN the glide into the left mini-legend
// (see the raw-slice spans in updateGroups).
const fold6Trigger      = makeTrigger(GROUP_TRANSITION_MS, updateGroups);
// Phase 2 (grey squares grow-in + ACLED bottom-legend note fade-in), split off
// from fold6Trigger onto the inserted ACLED fold (#page-4). See
// squaresRevealCardEl above.
const squaresRevealTrigger = makeTrigger(GROUP_TRANSITION_MS, updateGroups);
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
// This fly is INDEPENDENT of p7HasEngaged (page7.js, gates the real per-event
// cascade + the axis fill): both fire off the same crossing and simply play at
// the same time — the axis/cascade never waits for the squares to land. Since
// a fast scroll can carry currentPage on to the pinned real-timeline section
// (#page-7) before this 1500ms fly has finished, draw() below is called
// unconditionally (not just while currentPage === 6) so whichever page is now
// active keeps re-running the fly's own per-frame work.
const FOLD9_FLY_MS = 1500;
const fold9FlyTrigger = makeTrigger(FOLD9_FLY_MS, () => {
  updateGroups();
  draw();
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

// Fold 2's legend (the groups overlay's first appearance) is tied to the title
// card directly — same 0.5 convention and makeTrigger/watchCardThreshold
// machinery as every other fold — so the legend's appearance stays in sync
// with its own title and gives it a t (below) to stagger the rows' entrance.
const checkFold2      = watchCardThreshold(page2TitleCardEl, 0.5, fold2Trigger);
const checkFold3      = watchCardThreshold(page3TitleCardEl, 0.5, fold3Trigger);
const checkFold6      = watchCardThreshold(page6TitleCardEl, 0.5, fold6Trigger);
const checkSquaresReveal = watchCardThreshold(squaresRevealCardEl, 0.5, squaresRevealTrigger);
const checkFold7Label = watchCardThreshold(fold7LabelCardEl, 0.5, fold7LabelTrigger);
const checkFold8SquareDim = watchCardThreshold(fold7LabelCardEl, 0.5, fold8SquareDimTrigger);
const checkFold9 = watchCardThreshold(page7TitleCardEl, 0.5, fold9Trigger);
// Same crossing as p7AxisShouldShow (page7.js) — title card fully offscreen,
// top <= 0. Used to instant-reverse (snap straight back to rest on scroll-up
// rather than being catchable mid-flight) — per explicit instruction, this is
// now a normal reversible trigger like every other fold's, so scrolling back
// up from @fold8 into @fold7 plays the same fly-out/color-in animation in
// reverse, covering only the remaining distance, instead of snapping.
const checkFold9Fly = watchCardThreshold(page7TitleCardEl, 0, fold9FlyTrigger);
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
  checkFold2(); checkFold3(); checkFold6(); checkSquaresReveal(); checkFold7Label(); checkFold8SquareDim(); checkFold9(); checkFold9Fly(); checkFold13();
}

// Default (camp-column) swatch size + the swatch-to-label gap
// established earlier — vs. the smaller mini-legend ones (Figma node
// 120:1279/Frame 3219), interpolated continuously by fold6Trigger rather
// than snapped, same "seamless, no popping" rule as every other transition.
const CLUSTER_SWATCH_SIZE = 11, CLUSTER_LABEL_GAP = 16;
const LEFT_LEGEND_SWATCH_SIZE = 6, LEFT_LEGEND_LABEL_GAP = 6;
// Mini-legend geometry: each column's inset from ITS OWN screen edge, in px
// (not frame units — tuned by eye at one viewport, see CLAUDE.md's manual/
// rule), plus the row-to-row pitch. GROUPS' per-group fold6.y is now only
// read for row ORDER (via FOLD6_ROW_FRAME_YS below); the actual spacing all
// comes from FOLD6_ROW_PITCH, so the three rows can never drift apart.
const FOLD6_LEGEND_INSET_LEFT = 31, FOLD6_LEGEND_INSET_RIGHT = 31;
const FOLD6_ROW_PITCH = 24;

// @fold2's two camp-column headers + the divider between them (Figma node
// 277:1608, frame 1512×982: swatch columns at x=719/782 either side of the
// x=756 divider, rows at y=489/529/566, headers at y=414). Rows are read
// live off GROUPS' own fold4.x/y (by color) rather than re-declared here, so
// the header/divider position can never drift out of sync with the table
// above if it's ever tweaked.
// (FOLD4_COALITION_ROWS/FOLD4_CHANGE_ROWS themselves are declared up by
// GROUPS — @fold2's own grid roster needs them before this point.)
const FOLD4_HEADER_TITLE_COALITION = "מחנה הימין";
const FOLD4_HEADER_TITLE_CHANGE    = "גוש השינוי";
// Frame units from each column's own top-row center up to its header's
// center. Started at Figma's own 73 (row center 494.5, header center 421);
// tuned down to 44 by eye per explicit instruction, so this no longer
// matches the Figma frame — don't "fix" it back.
const FOLD4_HEADER_GAP = 44;
// Both camp blocks are placed symmetrically about screen center from
// FOLD2_CAMP_CENTER_GAP_PX (see the @fold2 grid block above) — there's no
// longer a center divider to hang either column off (Figma node 279:1342
// shows none), so the old FOLD4_DIVIDER_GAP_PX/FOLD4_COALITION_COL_GAP_PX
// pair (and .fold4-divider itself) are gone. Both blocs still read RTL the
// same way, so each group's own rect is its row's RIGHTMOST grid cell and
// @fold3's typed-in label trails left off it, over the space the row's 3
// filler rects vacate as they shrink.

const fold4ColumnTitleCoalitionEl = document.createElement("div");
fold4ColumnTitleCoalitionEl.className = "fold4-column-title";
fold4ColumnTitleCoalitionEl.textContent = FOLD4_HEADER_TITLE_COALITION;
groupsOverlayEl.appendChild(fold4ColumnTitleCoalitionEl);

const fold4ColumnTitleChangeEl = document.createElement("div");
fold4ColumnTitleChangeEl.className = "fold4-column-title";
fold4ColumnTitleChangeEl.textContent = FOLD4_HEADER_TITLE_CHANGE;
groupsOverlayEl.appendChild(fold4ColumnTitleChangeEl);

// Both camp headers TYPE in on @fold2's 3rd beat rather than just fading (same
// spec as @fold3's labels). They reuse fold8's two-span typewriter, not the
// plain typedText() the labels use, because these are CENTERED on their block:
// with plain text the box would grow outward from its own center and the whole
// header would visibly slide left as it typed. The two-span version lays the
// full string out from the first frame and only moves characters between the
// visible and the transparent span, so the header sits still.
const fold4HeaderSpansCoalition = fold8SetupTypewriter(
  fold4ColumnTitleCoalitionEl, FOLD4_HEADER_TITLE_COALITION);
const fold4HeaderSpansChange = fold8SetupTypewriter(
  fold4ColumnTitleChangeEl, FOLD4_HEADER_TITLE_CHANGE);

// Both headers are centered over their own camp block (Figma node 279:1342
// centers each title on its grid), so they override .fold4-column-title's
// default right-edge translate(-100%, -50%) anchor.
fold4ColumnTitleCoalitionEl.style.transform = "translate(-50%, -50%)";
fold4ColumnTitleChangeEl.style.transform = "translate(-50%, -50%)";

// @fold3's labels don't fade in — they TYPE in, character by character, over
// fold3Trigger's own eased progress (per explicit spec). Reverses cleanly
// (characters unwind) because labelT reverses like every other trigger.
function typedText(full, t) {
  return full.slice(0, Math.round(Math.max(0, Math.min(1, t)) * full.length));
}

// Source-credit line under fold6's mini-legend (no Figma node — new content,
// not part of the original design). Fixed px width/font, same "position
// anchors are frame-scaled, sizing isn't" convention as .group-label's own
// hardcoded font sizes above. FOLD6_BOTTOM_ROW is the mini-legend's
// bottom-most row (highest fold6.y — now ערבים ישראלים, since it joined the
// change bloc below פעילי שמאל) — the note hangs off it.
const FOLD6_NOTE_TEXT = "הנתונים לקוחים מגוף המחקר הבינלאומי ACLED, המתעד וממפה אירועי מחאה ואלימות פוליטית על בסיס דיווחים מכלי תקשורת, ארגונים ומקורות מקומיים";
const FOLD6_NOTE_WIDTH = 150;
// Divider (faint hairline) sits between the last row and the note, its own
// height folded into the gap math below like the note's own height is.
const FOLD6_DIVIDER_GAP_TOP = 10, FOLD6_DIVIDER_GAP_BOTTOM = 10, FOLD6_DIVIDER_HEIGHT = 1;
// Highest fold6.y among the mini-legend rows — computed rather than hardcoded
// so adding a row below the change bloc (ערבים ישראלים) re-anchors the note.
const FOLD6_BOTTOM_ROW_INDEX = GROUPS.reduce(
  (best, g, i) => (g.fold6 && (best < 0 || g.fold6.y > GROUPS[best].fold6.y)) ? i : best,
  -1
);
const FOLD6_BOTTOM_ROW = GROUPS[FOLD6_BOTTOM_ROW_INDEX];

// Distinct mini-legend row y's, top→bottom — the ORDER of the rows only. The
// top one's frame y is the block's vertical anchor (scaled with H like every
// other frame coordinate); every row below it is FOLD6_ROW_PITCH px further
// down, so editing the pitch moves rows 2/3 without touching GROUPS.
const FOLD6_ROW_FRAME_YS = [...new Set(
  GROUPS.filter((g) => g.fold6).map((g) => g.fold6.y)
)].sort((a, b) => a - b);
// noteShift: the same fold6NoteShiftPx every fold6 target is pre-shifted by
// (see updateGroups) — passed in rather than closed over, since it's measured
// per tick.
function fold6RowY(g, H, noteShift) {
  return fold6RowIndexY(FOLD6_ROW_FRAME_YS.indexOf(g.fold6.y), H, noteShift);
}
function fold6RowIndexY(rowIndex, H, noteShift) {
  return (FOLD6_ROW_FRAME_YS[0] / GROUPS_FRAME_H) * H
    + rowIndex * FOLD6_ROW_PITCH - noteShift;
}
const fold6NoteEl = document.createElement("div");
fold6NoteEl.className = "fold6-note";
fold6NoteEl.style.width = `${FOLD6_NOTE_WIDTH}px`;
fold6NoteEl.innerHTML = FOLD6_NOTE_TEXT.replace(
  "ACLED",
  '<a href="https://acleddata.com/" target="_blank" rel="noopener" class="fold6-note-link">ACLED</a>'
);
const fold6NoteLayerEl = document.getElementById("fold6NoteLayer");
fold6NoteLayerEl.appendChild(fold6NoteEl);
// Hidden, permanently off-screen clone of the bottom row's *settled* label
// (fixed 14px/400, matching fold6's post-lerp end state) — measuring this
// instead of the live groupItems[FOLD6_BOTTOM_ROW_INDEX].label lets the
// note/divider below compute their target position from where that row
// ENDS UP, not wherever it currently is mid-flight. Reading the live label's
// getBoundingClientRect() instead (an earlier version of this code did)
// made the note visibly trail the row in from its pre-glide position instead of
// staying put and just fading in.
const fold6RowMeasureEl = document.createElement("span");
fold6RowMeasureEl.className = "group-label";
fold6RowMeasureEl.style.cssText = "visibility:hidden; left:-9999px; top:-9999px; font-size:14px; font-weight:400;";
fold6RowMeasureEl.textContent = FOLD6_BOTTOM_ROW.label;
groupsOverlayEl.appendChild(fold6RowMeasureEl);
const fold6NoteDividerEl = document.createElement("div");
fold6NoteDividerEl.className = "fold6-note-divider";
fold6NoteLayerEl.appendChild(fold6NoteDividerEl);

// Every group's position is one continuous chain of lerps — hero anchor →
// fold4 column → fold6 mini-legend — driven by each stage's own t. Once a
// given t reaches 1 the position is exactly that stage's target (no residual
// blend), so this is equivalent to a discrete per-fold layout at rest, but
// never snaps between two different DOM nodes to get there.
function updateGroups() {
  const W = canvas.clientWidth, H = canvas.clientHeight;
  // @fold4's entrance (fold6Trigger, its card's ordinary center crossing) —
  // a single beat now: the rects glide straight into fold6's mini-legend.
  // It used to open with a merge beat, undoing the split-into-3 that the
  // removed @fold4 played (see _stash-fold3.md); with nothing left to merge,
  // the whole trigger is just the glide.
  const e6 = fold6Trigger.currentT();
  // @fold3 (#page-2): 3 beats on fold3Trigger's one timeline — shrink the
  // fillers, fly the survivors into one vertical column per camp, type the
  // labels (see FOLD3_BEATS). Same {start,len} window model as @fold2's, and
  // the same raw-slice-then-re-ease convention: carve currentRaw() (linear)
  // into windows and apply p9Ease fresh to each local 0..1, never ease once
  // and then slice.
  const fold3Raw = fold3Trigger.currentRaw();
  const fold3BeatRaw = b =>
    Math.max(0, Math.min(1, (fold3Raw - FOLD3_BEATS[b].start) / FOLD3_BEATS[b].len));
  const fillerShrinkT = p9Ease(fold3BeatRaw("shrink"));
  const alignT        = p9Ease(fold3BeatRaw("align"));
  const typeBaseRaw   = fold3BeatRaw("type");

  // @fold2's whole entrance is 3 sequential beats sharing fold2Trigger's one
  // timeline, not 3 things happening at once — per explicit spec:
  // (1) the decorative dots shrink away, (2) THEN the 6 group dots fly/grow
  // into their two camp columns (top row first), (3) THEN the camp headers
  // + divider fade in. The move beat (2) is the busiest (grow + fly, all
  // rows) so it gets the biggest share of FOLD2_ENTRANCE_MS rather than an
  // equal third; reversing (scrolling back up) runs the same 3 beats in
  // reverse, last-to-first.
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
  // Each beat is its own {start, len} window on the trigger's raw timeline
  // rather than a share of a strictly sequential split, so beats are free to
  // overlap (the headers currently type ALONGSIDE the flight, per explicit
  // instruction) — see FOLD2_BEATS.
  const fold2BeatRaw = b =>
    Math.max(0, Math.min(1, (raw2 - FOLD2_BEATS[b].start) / FOLD2_BEATS[b].len));
  const SHRINK_SPAN = FOLD2_BEATS.shrink.len;
  const MOVE_SPAN   = FOLD2_BEATS.move.len;
  const shrinkT          = p9Ease(fold2BeatRaw("shrink"));
  const moveBaseRaw      = fold2BeatRaw("move");
  const headerCoalitionT = p9Ease(fold2BeatRaw("headerCoalition"));
  const headerChangeT    = p9Ease(fold2BeatRaw("headerChange"));

  // @fold1's decorative (non-group) dots shrink to nothing, staying exactly
  // where they are — the first of the 3 beats above. Skips any dot whose
  // own page-load entrance pop (playPage0Entrance) hasn't happened yet —
  // this runs continuously from page init onward, well before that, and
  // would otherwise stomp the entrance's scale(0) hidden state with
  // decorScale's at-rest value (1) before the user ever sees the pop-in.
  // — except the 18 picked out as @fold2's filler rects (assignFold2Fillers
  // above), which fly into the camp grids instead; they're driven separately
  // after the main GROUPS loop below.
  const decorScale = 1 - shrinkT;
  PAGE0_DECORATIVE_DOT_ELS.forEach(({ el, popped, isFold2Filler }) => {
    if (popped && !isFold2Filler) el.style.transform = `scale(${decorScale})`;
  });

  // Measured live off the real (fixed-width) note element rather than a
  // hidden scaffold — its height only ever changes on a font swap/width
  // edit, both already covered by layoutGroups() re-running this function,
  // so re-reading it every tick costs nothing and can never go stale.
  const fold6NoteHeightPx = fold6NoteEl.offsetHeight;
  const fold6NoteBlockGapPx = FOLD6_DIVIDER_GAP_TOP + FOLD6_DIVIDER_HEIGHT + FOLD6_DIVIDER_GAP_BOTTOM;
  const fold6NoteShiftPx = (fold6NoteBlockGapPx + fold6NoteHeightPx) / 2;

  // Divider fits the note's own rendered text, not its 150px wrap container
  // — the container is just a wrap width, and the note's wrapped lines don't
  // actually reach its full 150px (greedy word-wrap breaks short of the
  // edge), so sizing off the container left the hairline visibly wider than
  // the text under it. A Range over the note's text node gives one rect per
  // wrapped line (standard trick for measuring wrap results without
  // reimplementing word-wrap by hand); take the widest of those. Read live
  // off the real element each tick, same reasoning as fold6NoteHeightPx above.
  const fold6NoteRange = document.createRange();
  fold6NoteRange.selectNodeContents(fold6NoteEl);
  const fold6NoteLineWidths = Array.from(fold6NoteRange.getClientRects(), r => r.width);
  const fold6NoteMaxLineWidth = Math.max(...fold6NoteLineWidths);
  fold6NoteDividerEl.style.width = `${fold6NoteMaxLineWidth}px`;

  // Beat 2 staggers the rows top-to-bottom within its own slice of the
  // timeline, same makeTrigger-style "reaches target exactly at local t=1"
  // convention as every other staggered stage in this file. Row index is the
  // group's own fold4 column row (both camp columns share the same 3 rows).
  const FOLD4_ROW_YS = [...new Set(GROUPS.map((g) => g.fold4.y))].sort((a, b) => a - b);
  const ROW_STAGGER = 0.05;
  const ROW_SPAN = 1 - ROW_STAGGER * (FOLD4_ROW_YS.length - 1);

  // The two camp grids' geometry (see the @fold2 grid block by
  // FOLD2_CAMP_CENTER_GAP_PX above), computed ahead of the main loop below so
  // the group items, the filler rects and the headers all key off one source.
  // Only the block CENTERS are frame-independent px offsets from screen
  // center; the top row's vertical anchor is still frame-scaled like every
  // other coordinate here, with the 2nd/3rd rows stepped off it in
  // plain px so the grid stays square at any viewport height.
  const fold2TopRowY = (FOLD4_ROW_YS[0] / GROUPS_FRAME_H) * H;
  const fold2RowY = rowIdx => fold2TopRowY + rowIdx * FOLD2_ROW_PITCH_PX;
  const fold2BlockW = (FOLD2_GRID_COLS - 1) * FOLD2_COL_PITCH_PX + CLUSTER_SWATCH_SIZE;
  // Each camp's anchor — screen center ± FOLD2_CAMP_CENTER_GAP_PX. Its camp
  // title sits centered on it, and BOTH fold layouts are centered on it too:
  // @fold2's 4×3 block (below) and @fold3's aligned rect-plus-label column
  // (campFold3X). So the title never moves between the two folds, and the
  // rects read as centered under it in both.
  const campAnchorX = isCoalition =>
    W / 2 + (isCoalition ? FOLD2_CAMP_CENTER_GAP_PX : -FOLD2_CAMP_CENTER_GAP_PX);
  // Left edge of each block's leftmost cell.
  const changeBlockX    = campAnchorX(false) - fold2BlockW / 2;
  const coalitionBlockX = campAnchorX(true)  - fold2BlockW / 2;
  // @fold3's rect x, per camp: the rect's label trails CLUSTER_LABEL_GAP to
  // its left, so the pair spans [x - gap - labelW, x + swatch] and centering
  // that midpoint on the anchor puts the rect RIGHT of it by half the label
  // run. Not a grid column any more — the labels are what has to look
  // centered under the title at @fold3, not the (by then vanished) cells.
  // labelW is the camp's WIDEST label, so all 3 rows share one rect column.
  const campFold3X = (rows) => {
    const labelW = Math.max(...rows.map(groupLabelWidth));
    return campAnchorX(rows === FOLD4_COALITION_ROWS)
      + (CLUSTER_LABEL_GAP + labelW - CLUSTER_SWATCH_SIZE) / 2;
  };
  const fold2CellX = (isCoalition, col) =>
    (isCoalition ? coalitionBlockX : changeBlockX) + col * FOLD2_COL_PITCH_PX;
  // Each group's own rect sits at its scattered FOLD2_GROUP_CELL cell — the
  // one it flies OUT of at @fold3, into that camp's aligned column.
  const fold2GroupX = i =>
    fold2CellX(FOLD4_COALITION_ROWS.includes(GROUPS[i]), FOLD2_GROUP_CELL[i].col);
  // @fold3's aligned column is ordered by the mini-legend's own top-to-bottom
  // order (each group's fold6.y within its camp), NOT by @fold2's scattered
  // cells — so the order the labels type in is already the order they'll hold
  // for the rest of the page, and @fold5's glide into the mini-legend never
  // has to reshuffle the rows past each other.
  const legendRow = (g) => {
    const camp = FOLD4_COALITION_ROWS.includes(g) ? FOLD4_COALITION_ROWS : FOLD4_CHANGE_ROWS;
    return camp.slice().sort((a, b) => a.fold6.y - b.fold6.y).indexOf(g);
  };

  GROUPS.forEach((g, i) => {
    const item = groupItems[i];
    // Row this group's rect occupies in @fold2's scattered grid — also the
    // stagger key, so both blocks fill top-to-bottom in sync rather than one
    // block after the other.
    const rowIdx = FOLD2_GROUP_CELL[i].row;
    const moveT = p9Ease(Math.max(0, Math.min(1, (moveBaseRaw - rowIdx * ROW_STAGGER) / ROW_SPAN)));

    // The camp grids don't use each group's own (now-unused) fold4.x as the
    // swatch anchor — x comes from the grid geometry above (block center ±
    // FOLD2_CAMP_CENTER_GAP_PX from screen center, plus this group's own
    // FOLD2_GROUP_CELL cell), so the two camps stay symmetric at any viewport
    // width. Labels trail left off the swatch in both camps (swatchFirst).
    const isCoalitionRow = FOLD4_COALITION_ROWS.includes(g);
    const fold4Pos = { x: fold2GroupX(i), y: fold2RowY(rowIdx) };

    // @fold2's entrance originates from wherever this group's own dot landed
    // in @fold1's dot columns (PAGE0_GROUP_DOT_ANCHORS, page1.js), flying
    // straight into its camp-column spot on moveT (beat 2 above). Falls back
    // to the column spot itself (a no-op lerp) if this group had no matching
    // dot this load (very short viewports can run out of dots before all
    // groups get one).
    const anchor = PAGE0_GROUP_DOT_ANCHORS[g.color] || { left: fold4Pos.x - W / 2, top: fold4Pos.y };
    const fold1X = W / 2 + anchor.left, fold1Y = anchor.top;

    let x = fold1X + (fold4Pos.x - fold1X) * moveT;
    let y = fold1Y + (fold4Pos.y - fold1Y) * moveT;

    // @fold3's 2nd beat: each group's rect flies out of its scattered @fold2
    // cell into its own row of the camp's aligned column (campFold3X, placed
    // so rect + label read centered under the camp title), so a camp's 3
    // rects end up on one vertical line, one per row — both blocks read RTL,
    // so the typed label trails left off that line. Both axes
    // move here, not just x — the @fold2 scatter is deliberately not one rect
    // per row. Chained onto x/y above (not a separate target) so it composes
    // with @fold2's flight and @fold5's glide like every other stage here.
    const fold3Row = legendRow(g);
    const fold3X = campFold3X(isCoalitionRow ? FOLD4_COALITION_ROWS : FOLD4_CHANGE_ROWS);
    const fold3Y = fold2RowY(fold3Row);
    x += (fold3X - x) * alignT;
    y += (fold3Y - y) * alignT;

    // Swatch starts at the real @fold1 dot's own 7px size (PAGE0_DOT_SQ) and
    // grows to the column's 13px (CLUSTER_SWATCH_SIZE) over the same moveT
    // as the position fly-in above.
    let swatchSize = PAGE0_DOT_SQ + (CLUSTER_SWATCH_SIZE - PAGE0_DOT_SQ) * moveT, labelGap = CLUSTER_LABEL_GAP;
    const isRightLegend = g.fold6 && isCoalitionRow;
    if (g.fold6) {
      // Shifted up by half the note's own (gap + height) so the rows+note
      // block stays centered on the same vertical anchor the 5 rows alone
      // used to occupy, instead of the note just tacking on below them and
      // reading off-center. Baked into the lerp target itself (not applied
      // as a separate post-hoc offset) so it eases in with the same e6 as
      // everything else, rather than popping once the rows finish settling.
      // Coalition/right-wing rows mirror to the RIGHT edge; change/left-wing
      // rows keep the same left inset. Both columns share the same rows (y).
      const fold6X = isRightLegend
        ? (W - FOLD6_LEGEND_INSET_RIGHT - LEFT_LEGEND_SWATCH_SIZE)
        : FOLD6_LEGEND_INSET_LEFT;
      const fold6Pos = { x: fold6X, y: fold6RowY(g, H, fold6NoteShiftPx) };
      x += (fold6Pos.x - x) * e6; y += (fold6Pos.y - y) * e6;
      swatchSize += (LEFT_LEGEND_SWATCH_SIZE - CLUSTER_SWATCH_SIZE) * e6;
      labelGap   += (LEFT_LEGEND_LABEL_GAP - CLUSTER_LABEL_GAP) * e6;
    }

    item.el.style.left = `${x}px`;
    item.el.style.top  = `${y}px`;

    // Swatch eases in (page0PopT, set by playPage0Entrance) once the @fold1
    // page-load entrance reaches this row — it's standing in for a real
    // @fold1 dot at rest, so once popped it should look identical to that
    // dot until it actually starts flying at @fold2. The label is @fold3's
    // own beat (labelT, fold3Trigger above).
    const popT = page0PopT[i];
    item.swatch.style.opacity = String(popT);
    // @fold3's labels TYPE in rather than fading (see typedText above) — full
    // opacity from the first character, the reveal is the text itself. They
    // cascade top row → bottom row inside the shared `type` beat (both camps'
    // same-height rows type together), each row re-eased over its own local
    // 0..1 so every row runs at the same speed.
    const typeSlots = fold3TypeSlotCount(FOLD4_ROW_YS.length);
    const typeSpan = 1 - FOLD3_TYPE_ROW_STAGGER * (typeSlots - 1);
    const typeSlot = fold3TypeSlot(fold3Row, isCoalitionRow, FOLD4_ROW_YS.length);
    const labelT = p9Ease(Math.max(0, Math.min(1,
      (typeBaseRaw - typeSlot * FOLD3_TYPE_ROW_STAGGER) / typeSpan)));
    item.label.textContent = typedText(g.label, labelT);
    item.label.style.opacity = String(popT);

    item.swatch.style.width  = `${swatchSize}px`;
    item.swatch.style.height = `${swatchSize}px`;
    item.swatch.style.top    = "0px";
    // Label's vertical anchor must track the swatch's own shrinking center
    // (13px cluster -> 6px mini-legend, same e6 lerp as swatchSize above) —
    // a fixed CSS top would stay centered on the swatch's *original* size
    // and drift off-center as the swatch shrinks.
    // ...plus the optical correction for the line box's unused descent (see
    // groupLabelInkShift above), so the swatch reads centered on the text
    // itself rather than on its taller-than-the-ink line box.
    const labelFontSize = g.fold6 && raw2 >= FOLD2_BEATS.move.start + MOVE_SPAN
      ? 18 + (14 - 18) * e6 : 18;
    item.label.style.top = `${swatchSize / 2 + groupLabelInkShift(labelFontSize)}px`;

    // fontSize/color have a meaningful in-between so they lerp continuously
    // over e6 — 18px/opaque-black is is-emphasized's resting state, so e6=0
    // reproduces the pre-fold6 look with no seam. Weight stays regular (400).
    const postFold2 = raw2 >= FOLD2_BEATS.move.start + MOVE_SPAN;
    const postFold6 = !!g.fold6 && fold6Trigger.currentRaw() >= 0.5;
    if (g.fold6 && postFold2) {
      item.label.style.fontSize   = `${18 + (14 - 18) * e6}px`;
      item.label.style.fontWeight = "400";
      item.label.style.color      = `rgba(0, 0, 0, ${1 + (0.85 - 1) * e6})`;
    } else {
      item.label.style.fontSize   = "";
      item.label.style.fontWeight = "";
      item.label.style.color      = "";
    }

    // Which side the label sits on is just another continuous lerp now too —
    // sideT 0 is the columns' universal "label trails the swatch" layout, 1
    // is "label leads, swatch trails", chained through fold6's mini-legend
    // layout (e6) — same chaining as x/y above — instead of snapping at the
    // postFold6 threshold. Both endpoints are expressed as the label's own
    // `left` (reading its actual rendered width, since the swatch-first
    // endpoint has no explicit width to anchor from) so it glides across the
    // swatch instead of teleporting to the other side.
    // Per Figma 277:1507 the camp columns (folds 2-3) use RTL reading order —
    // swatch at the right, label trailing left — so sideT is 0 for all of
    // them. From @fold4 on, only the LEFT-edge half of the mini-legend (the
    // change rows) mirrors: at the screen's left edge the swatch reads better
    // outboard with its label to the right of it, while the right-edge
    // coalition rows keep the swatch outboard on their own side, i.e. sideT 0.
    // Driven by e6 so it glides across the swatch with the rest of the fold-4
    // legend move instead of snapping.
    const sideT = g.fold6 && !isRightLegend ? e6 : 0;
    const labelWidth = item.label.offsetWidth;
    const leftAsSwatchFirst = -(labelGap + labelWidth);
    const leftAsLabelLeads  = swatchSize + labelGap;
    item.label.style.left  = `${leftAsSwatchFirst + (leftAsLabelLeads - leftAsSwatchFirst) * sideT}px`;
    item.label.style.right = "";

    item.el.classList.toggle("is-emphasized", postFold2 && !postFold6);
  });

  // @fold2's filler rects: the 18 @fold1 decorative dots that fly into the
  // camp grids' remaining cells instead of shrinking away with the rest.
  // Same beat-2 flight, row stagger, 7px→11px grow and start anchor as the
  // real group items above — but they KEEP their own @fold1 color (explicit
  // instruction), so each grid reads as the hero's palette with the 6 group
  // colors scattered in among it (FOLD2_GROUP_CELL). At @fold3 they shrink to
  // nothing in place over that fold's FIRST beat (fillerShrinkT) — the labels
  // only start typing once they're gone — leaving just the 6 group rects,
  // which then fly into their aligned column on the next beat.
  fold2FillerDots.forEach((dot, k) => {
    const { camp, row, col } = FOLD2_FILLER_CELLS[k];
    const moveT = p9Ease(Math.max(0, Math.min(1, (moveBaseRaw - row * ROW_STAGGER) / ROW_SPAN)));
    const targetX = fold2CellX(camp, col);
    const targetY = fold2RowY(row);
    const fromX = W / 2 + dot.anchor.left, fromY = dot.anchor.top;
    const size = PAGE0_DOT_SQ + (CLUSTER_SWATCH_SIZE - PAGE0_DOT_SQ) * moveT;
    const el = dot.el;
    el.style.left = `${fromX + (targetX - fromX) * moveT}px`;
    el.style.top  = `${fromY + (targetY - fromY) * moveT}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    if (dot.popped) el.style.transform = `scale(${1 - fillerShrinkT})`;
  });

  // The two camp headers — fade in as @fold2's 3rd beat (headerT, once the
  // grids have formed) and back out once fold6's mini-legend takeover
  // completes (e6), same "opacity-only, no separate flight" reasoning as
  // fold6NoteEl below (no earlier fold for these to fly in from). Per Figma
  // node 279:1342 each header is CENTERED over its camp (the
  // translate(-50%, -50%) override set where the elements are created), not
  // right-aligned to a swatch column — there's no divider to read them
  // against any more. What it centers on is the camp's own anchor (screen
  // center ± FOLD2_CAMP_CENTER_GAP_PX), i.e. the center of the @fold3
  // rect-column-plus-labels layout; @fold2's 4×3 block is placed to share
  // that same center (see campFold3Offset above), so the title stays put
  // across both folds.
  const fold4HeaderGapPx = (FOLD4_HEADER_GAP / GROUPS_FRAME_H) * H;
  const fold2HeaderY = fold2RowY(0) + CLUSTER_SWATCH_SIZE / 2 - fold4HeaderGapPx;

  // ...and they never leave that spot: the headers do NOT travel into the
  // @fold4 mini-legend (per explicit instruction — the legend's two columns
  // carry no camp titles). They just stay put and type themselves back OUT
  // over @fold4's own trigger, which is why there's no e6 lerp on position,
  // size or weight here at all.
  const placeCampHeader = (el, fold2X) => {
    el.style.left = `${fold2X}px`;
    el.style.top  = `${fold2HeaderY}px`;
  };
  placeCampHeader(fold4ColumnTitleCoalitionEl, W / 2 + FOLD2_CAMP_CENTER_GAP_PX);
  placeCampHeader(fold4ColumnTitleChangeEl, W / 2 - FOLD2_CAMP_CENTER_GAP_PX);

  // The two headers type on their OWN beats (FOLD2_BEATS.headerCoalition /
  // .headerChange) rather than sharing one — so one camp can start typing
  // before, with, or after the other.
  //
  // The un-typing at @fold4 is that same choreography played backwards: each
  // header's beat window is MIRRORED within the trigger (start → 1-(start+len))
  // and its own progress inverted, so the camp that typed in last is the first
  // to disappear, and each one loses characters from its end back to its
  // start at the same tempo it gained them. Reusing FOLD2_BEATS' own windows
  // (rather than a second pair of constants) means retiming the entrance
  // automatically retimes the exit to match.
  const fold6BeatT = (b) => {
    const w = FOLD2_BEATS[b];
    return p9Ease(Math.max(0, Math.min(1,
      (e6 - (1 - w.start - w.len)) / w.len)));
  };
  const untypeCoalition = 1 - fold6BeatT("headerCoalition");
  const untypeChange    = 1 - fold6BeatT("headerChange");

  fold8UpdateTypewriter(fold4HeaderSpansCoalition, Math.round(
    headerCoalitionT * untypeCoalition * FOLD4_HEADER_TITLE_COALITION.length));
  fold8UpdateTypewriter(fold4HeaderSpansChange, Math.round(
    headerChangeT * untypeChange * FOLD4_HEADER_TITLE_CHANGE.length));

  // The reveal itself is the typing, so opacity only ramps over the beat's
  // first quarter (enough that the first characters don't pop) and holds —
  // then mirrors that on the way out, over the last quarter of the un-typing,
  // so the final couple of characters don't pop off either.
  fold4ColumnTitleCoalitionEl.style.opacity =
    String(Math.min(1, headerCoalitionT * 4, untypeCoalition * 4));
  fold4ColumnTitleChangeEl.style.opacity =
    String(Math.min(1, headerChangeT * 4, untypeChange * 4));

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
  // Note lives under the RIGHT legend column (coalition/right-wing rows), NOT
  // the left one. Mirror the left column's inset the same way the rows do
  // (isRightLegend uses W - FOLD6_LEGEND_INSET_RIGHT): the note hugs the
  // left inset, and the note box (RTL, right-aligned text) hugs that edge and
  // extends leftward — so it can't run off the right screen edge the way a
  // left-anchored box would here.
  const noteRightEdge = W - FOLD6_LEGEND_INSET_RIGHT;
  const fold6X = noteRightEdge - FOLD6_NOTE_WIDTH;
  const fold6TargetAnchorY = fold6RowY(FOLD6_BOTTOM_ROW, H, fold6NoteShiftPx);
  const lastRowLabelBottomTarget = fold6TargetAnchorY + LEFT_LEGEND_SWATCH_SIZE / 2 + fold6RowMeasureEl.offsetHeight / 2;
  const dividerY = lastRowLabelBottomTarget + FOLD6_DIVIDER_GAP_TOP;
  const noteY = dividerY + FOLD6_DIVIDER_HEIGHT + FOLD6_DIVIDER_GAP_BOTTOM;
  // Note + divider fade in on PHASE 2 (the inserted ACLED fold, #page-4) via
  // squaresRevealTrigger — NOT e6 (fold6Trigger, phase 1 = the split). The note
  // POSITION is still anchored to fold6's settled mini-legend target above; only
  // its reveal is deferred to the second fold.
  const noteRevealT = squaresRevealTrigger.currentT();
  fold6NoteDividerEl.style.left = `${noteRightEdge - fold6NoteMaxLineWidth}px`;
  fold6NoteDividerEl.style.top = `${dividerY}px`;
  fold6NoteDividerEl.style.opacity = String(noteRevealT);
  fold6NoteEl.style.left = `${fold6X}px`;
  fold6NoteEl.style.top = `${noteY}px`;
  fold6NoteEl.style.opacity = String(noteRevealT);

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
  // axis appearing — see checkFold9Fly above) colors in the other 7 squares,
  // resizes all 8 to their real per-event dot's size, and only once that's
  // done flies them to that dot's position — two sequential beats, not
  // simultaneous (see FOLD9_FLY_RESIZE_SPAN below).
  const fold9FlyT = fold9FlyTrigger.currentT();
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
  // Each square's own staggered local raw timeline (localRaw, computed per
  // square below) is sliced into two sequential sub-spans — color-in +
  // resize, then fly — each re-eased independently via p7Ease rather than
  // easing the whole span once and carving it up (CLAUDE.md's "Multi-beat
  // sequencing" convention: easing an already-eased curve's middle third
  // looks close to linear while the first/last thirds barely move).
  const FOLD9_FLY_RESIZE_SPAN = 0.4;
  // Color-in itself reads much faster than the resize it's paired with —
  // "secondary attribute can snap, position never does" (CLAUDE.md) — so a
  // square is already its real group color well before it's finished
  // growing/shrinking to its real dot's size, instead of the two finishing
  // together. Own sub-span of the same local timeline, well inside
  // FOLD9_FLY_RESIZE_SPAN.
  const FOLD9_FLY_COLOR_SPAN = 0.12;
  // Scale from 0 -> 1 as e6 (fold 6's own trigger progress) advances, so the
  // square grows from nothing rather than fading in. Eased over just the
  // first GROW_SPAN of the trigger's raw timeline (own re-eased span, "position
  // never does" convention) so the pop finishes well before the mini-legend
  // glide (also driven by e6) settles, instead of taking the full duration.
  const GROW_SPAN = 0.55;
  // Grow-in is PHASE 2 (inserted ACLED fold, #page-4) via squaresRevealTrigger —
  // detached from fold6Trigger (phase 1 = the split) so the squares only appear
  // on the second fold, after the mini-legend split has settled.
  const growScale = p9Ease(Math.max(0, Math.min(1, squaresRevealTrigger.currentRaw() / GROW_SPAN)));

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
  // event — exactly the "stuck" bug. fold9EnsureP8SyncLoop (own
  // self-scheduling rAF loop, started below) keeps calling updateGroups()
  // every frame for as long as the glide is still mid-flight, independent of
  // further scrolling, so the two always stay in lockstep.
  if (typeof p8Engaged !== "undefined" && p8Engaged && typeof p8CurrentT === "function" && p8CurrentT() < 1) {
    fold9EnsureP8SyncLoop();
  }

  fold6SquareEls.forEach(({ wrap, sq, label }, i) => {
    // delayFrac/localRaw only depend on i and the trigger's own raw progress
    // (not on whether the real-dot target has resolved yet), so they're
    // computed here, before colorT, and reused again below for size/position.
    const delayFrac = fold6SquareEls.length > 1
      ? (i / (fold6SquareEls.length - 1)) * FOLD9_SQUARES_FLY_STAGGER
      : 0;
    const localRaw = Math.min(1, Math.max(0, (fold9FlyRaw - delayFrac) / (1 - delayFrac)));
    // Beat 1 (color + resize): first FOLD9_FLY_RESIZE_SPAN of this square's
    // own local timeline (color itself finishing much sooner within it, see
    // FOLD9_FLY_COLOR_SPAN). Beat 2 (fly): the remainder — 0 until beat 1 is
    // fully done, so the square never starts moving mid-resize.
    const colorPhaseT = p7Ease(Math.max(0, Math.min(1, localRaw / FOLD9_FLY_COLOR_SPAN)));
    const resizeT = p7Ease(Math.max(0, Math.min(1, localRaw / FOLD9_FLY_RESIZE_SPAN)));
    const moveT = p7Ease(Math.max(0, Math.min(1, (localRaw - FOLD9_FLY_RESIZE_SPAN) / (1 - FOLD9_FLY_RESIZE_SPAN))));

    const colorT = i === 0 ? fold9Phase1T : colorPhaseT;
    sq.style.background = lerpFold6SquareColor(FOLD6_SQUARE_COLORS[i], colorT);

    // This square's own real event, resolved once and reused below (hover-dim,
    // the fold8 tooltip, fold13's legit fade, and the fly target) instead of
    // calling p7EventForActorOccurrence four separate times.
    const targetEvent = typeof p7EventForActorOccurrence === "function"
      ? p7EventForActorOccurrence(FOLD6_SQUARE_ACTORS[i], FOLD6_SQUARE_OCCURRENCE[i])
      : null;
    // Figma node 258:2159: every square except the one with a tooltip (index
    // 0, kept at full opacity) renders at ~46% opacity while still gray —
    // only within @fold8's own trigger window (tooltipT, same value gating
    // the tooltip below): before that window starts, all 8 squares are still
    // uniform (as in @fold5's own Figma frame, 258:2206, where none of this
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
    // hovered (p7.hoveredEvent, p7DrawSideSquares' own snap-to-HOVER_DIM_OPACITY dim) —
    // otherwise these 8 squares read as permanently full-opacity while the
    // rest of the grid dims around the hovered dot.
    if (typeof p7 !== "undefined" && p7.hoveredEvent && targetEvent) {
      if (targetEvent !== p7.hoveredEvent) opacity *= HOVER_DIM_OPACITY;
    }
    // Same parity for @fold10's own hover-dim (p9.hoveredEvent/hoveredCategoryIdx/
    // hoverDimT, page9.js's p9PlaceDot) — these squares are also drawn a second
    // time as an ordinary canvas dot in page9's legit/extreme grid (this DOM
    // square just sits on top of it once it arrives), so without this the
    // square underneath dims/highlights while the visible DOM square on top
    // stays frozen at full opacity, reading as "this dot never dims." Mirrors
    // p9PlaceDot's own three-branch priority (dot-hover > pill-hover >
    // lingering hover-dim tail) exactly, so the two stay visually identical.
    if (typeof p9 !== "undefined" && targetEvent) {
      if (p9.hoveredEvent) {
        if (targetEvent !== p9.hoveredEvent) opacity *= HOVER_DIM_OPACITY;
      } else if (p9.hoveredCategoryIdx !== null) {
        const dimFactor = 1 - 0.65 * p9.hoverDimT;
        if (CATEGORY_EN_TO_IDX[targetEvent.category] !== p9.hoveredCategoryIdx) opacity *= dimFactor;
      } else if (p9.hoverDimT > 0) {
        const dimFactor = 1 - 0.65 * p9.hoverDimT;
        const stillHighlighted = p9.hoverDimCategoryIdx !== null &&
          CATEGORY_EN_TO_IDX[targetEvent.category] === p9.hoverDimCategoryIdx;
        if (!stillHighlighted) opacity *= dimFactor;
      }
    }
    // @fold11's own legit-dot fade-out (p9.fold13OutT, drawPage9) only ever
    // fades events whose category is still classified "below" (legitimate) —
    // extreme ("above") events morph away separately instead (p9.fold13ExtremeMorphT,
    // drawPage12). Same classification check, so a square whose category was
    // never dragged to extreme fades out with the rest of the legit grid
    // instead of sitting there alone after everything else has disappeared.
    if (typeof p9 !== "undefined" && targetEvent) {
      const idx = CATEGORY_EN_TO_IDX[targetEvent.category];
      const isExtreme = idx !== undefined && p9.sides && p9.sides[idx] === "above";
      if (!isExtreme) opacity *= 1 - (p9.fold13OutT ?? 0);
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
      const event = targetEvent;
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
        // `color`, not `border-color` — the visible stroke is the dashed <svg>
        // overlay (updateTooltipDash above), which strokes currentColor.
        fold8TooltipEl.style.color = lerpFold6SquareColor(FOLD6_SQUARE_COLORS[0], colorT);
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
    // dot, lerped by moveT (beat 2, after color+resize) so it lands exactly
    // as fold9FlyTrigger settles.
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
    const ease = currentPage >= 9 ? 1 : p9Ease(typeof p8CurrentT === "function" ? p8CurrentT() : 0);
    if (target && ease > 0) {
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
      const restX = W / 2 + FOLD6_SQUARES_OFFSET[i].dx;
      const restY = H / 2 + FOLD6_SQUARES_OFFSET[i].dy;
      const dx = (target.x - restX) * moveT;
      const dy = (target.y - restY) * moveT;
      sq.style.transform = `translate(${dx}px, ${dy}px) scale(${growScale})`;
      const size = 8 + (target.size - 8) * resizeT;
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

// drawFold9/drawFold7 (currentPage 6/5, #page-6/#page-5) used to be static
// background-only, so nothing redrew the canvas while scrolling within them.
// Now drawFold9 also draws the year axis preview (gated on p7AxisShouldShow,
// page7.js) once fold 9's title passes offscreen, and both keep drawing the
// real per-event squares for as long as p7RealTimelineReached is true (see
// its own comment, page7.js) — each needs its own scroll-driven redraw to
// actually pick up those changes while currentPage stays 6 or 7 the whole
// time it's happening.
let fold9AxisTicking = false;
window.addEventListener("scroll", () => {
  if (fold9AxisTicking) return;
  fold9AxisTicking = true;
  requestAnimationFrame(() => {
    if (currentPage === 5 || currentPage === 6) draw();
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
// point plays the glide back in reverse via
// p8TriggerReverse, once currentPage has made it back to 9. ──
const page8TitleEl = document.querySelector("#page-8 .section-title");
let page8Ticking = false;

// Tracks the title's own crossing state (same isPast pattern as
// watchCardThreshold above) instead of re-checking "is the title currently
// past the threshold" on every tick. That static re-check was the bug: once a
// reverse glide finished (p8Engaged flips back to false, p8RunAnimLoop in
// page8.js), the very next scroll tick would see the title still sitting past
// the threshold (scrolling up doesn't un-cross it instantly) and immediately
// re-fire p8Trigger — which a following tick's scrollY-based reverse check
// would then immediately undo again, thrashing forward/reverse every couple
// of scroll events for as long as the title lingered near the threshold.
// Crossing-based detection only fires once per actual direction change.
let page8TitleWasPast = null;

function page8CheckScroll() {
  const rect = page8TitleEl.getBoundingClientRect();
  const nowPast = rect.top + rect.height / 2 <= window.innerHeight / 2;
  if (page8TitleWasPast === null) {
    page8TitleWasPast = nowPast;
    if (nowPast) p8Trigger();
    return;
  }
  if (nowPast !== page8TitleWasPast) {
    page8TitleWasPast = nowPast;
    if (nowPast) p8Trigger();
    else p8TriggerReverse();
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
const page9TitleCardEl  = document.querySelector("#page-9 .text-card");
const page9TitleRowEl   = document.querySelector("#page-9 .page9-title-row");
const page9StickyEl     = document.querySelector("#page-9 .page9-sticky");
const page9TrayEl       = document.querySelector("#page-9 .page9-tray");
const page9HeaderEl     = document.querySelector("#page-9 .page9-header");
const page9ZoneWrapEl   = document.querySelector("#page-9 .page9-zone-wrap-extreme");
let page9Ticking = false;
let page9LinePast = false; // previous "title past center" state, so the line trigger only fires on the transition
let page9WasStuck = false; // tracks isStuck across frames to detect the stuck→unstuck transition
// Categories dropped into the extreme zone at the moment the user last
// scrolled up out of @fold10 — captured in #page9ZoneAbove's own DOM order
// (most-recently-dropped first) right before p9ResetDrops clears it, so
// p9RestoreDrops can put the exact same pills/dots back if they scroll back
// down into @fold10, rather than that choice being lost for the rest of the
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
    // Scrolling back down into @fold10 — replay the saved drops.
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

// ── @fold11 animations ───────────────────────────────────────────────────────
// Two independently-driven progress values, per explicit feedback: @fold10
// is "in position" the instant its interaction state is reached (the gate
// line) — from there, scrolling in *either* direction must visibly move
// @fold10's own panel/frame and @fold11's title with no dead scroll space,
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
  // override them and freeze elements in their @fold11 state.
  const opacityVal = eScroll > 0 ? String(1 - eScroll) : '';
  if (page9HeaderEl)    page9HeaderEl.style.opacity    = opacityVal;
  if (page9TitleCardEl) page9TitleCardEl.style.opacity = opacityVal;
  if (page9ZoneWrapEl)  page9ZoneWrapEl.style.opacity  = opacityVal;
  groupsOverlayEl.style.opacity = opacityVal;
  // fold6NoteLayerEl (the ACLED source-credit note) lives outside
  // groupsOverlayEl now (see project.html) so it needs the same fade
  // explicitly — otherwise it stays visible through @fold11 while the rest
  // of the legend fades out.
  fold6NoteLayerEl.style.opacity = opacityVal;
  // page12TitleCardEl (the fold13 card) stays visible throughout.
  // fold6SquareEls' own opacity (updateGroups) reads p9.fold13OutT just set
  // above to fade a still-legit square out with the rest of the legit grid —
  // without this call it would only pick that up next time something else
  // happens to invoke updateGroups (e.g. a fold9 trigger tick), not on every
  // fold13ScrollT-driven scroll tick like every other @fold11 element here.
  updateGroups();
  draw();
}

// Fraction of the way through @fold10's unavoidable one-viewport hand-off to
// @fold11 (the gate can't unlock any later than one viewport before #page-10
// arrives, and the sticky wrapper needs that same one viewport of scroll to
// finish pinning — see p13GateMax and #page-10's own min-height comment in
// style.css) — 0 at the gate line, 1 once fully arrived. A plain scroll
// readout, not a makeTrigger, since this half must move continuously with
// scroll in both directions rather than play out over fixed real time.
function fold13ScrollT() {
  const page12 = document.getElementById("page-10");
  if (!page12) return 0;
  const start = p13GateMax();
  const end   = page12.offsetTop;
  if (end <= start) return window.scrollY >= end ? 1 : 0;
  return Math.max(0, Math.min(1, (window.scrollY - start) / (end - start)));
}

// ── @fold11 scroll gate ──────────────────────────────────────────────────────
// #page-10 is locked until at least one @dragcard has been dropped into the
// extreme zone. p9.sides (page9.js) is the source of truth.
function p13GateLocked() {
  return !p9.sides.some(s => s === "above");
}

// The gate position: keep #page-10's top at the viewport bottom (scrollY max =
// gateEl.offsetTop - innerHeight). Beyond this, #page-10 enters the viewport.
function p13GateMax() {
  const gateEl = document.getElementById("page-10");
  return gateEl ? gateEl.offsetTop - window.innerHeight : Infinity;
}

// #page-10's title sits in a position:sticky wrapper, so the *instant* real
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
// past the threshold (revealing #page-10's title for a frame until the
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
// during which #page-10's title was visibly peeking up before snapping back.
window.addEventListener("scroll", () => {
  if (!p13GateLocked()) return;
  const max = p13GateMax();
  if (window.scrollY > max) {
    window.scrollTo({ top: max, behavior: "instant" });
  }
}, { passive: true });

// Freeze the page9 sticky panel in place while scrolled into @fold11 — once
// the user passes #page-10's scroll context, position:sticky releases and the
// panel would drift off. Switching to position:fixed keeps it locked at top:0.
// The sticky element unpins at scrollY = #page-10.offsetTop - window.innerHeight
// (one full viewport before #page-10 starts), so freeze at that same threshold,
// not at #page-10.offsetTop itself (that would be too late by a full vh).
const p13GateEl = document.getElementById("page-10");
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
  // browser can still apply it to already-laid-out text a tick later — a
  // font swap changes label widths (and can reflow a title onto a different
  // number of lines, changing the title-card frame's height), so both are
  // re-measured once fonts.ready actually fires.
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
    // ...and re-pick @fold2's filler rects out of the freshly-rebuilt dots.
    assignFold2Fillers();
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
