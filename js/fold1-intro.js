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
      // Once popped, updateGroups()'s @fold2 shrink line owns this dot's
      // transform — this loop must stop writing it entirely. It used to keep
      // writing scale(1) every frame and rely on the updateGroups() call
      // below to synchronously overwrite it, but updateGroups is coalesced
      // to once per frame now, so a stale write here would win the frame and
      // the dots would never shrink.
      if (d.popped) return;
      const rowRaw = Math.max(0, Math.min(1, (elapsed - PAGE0_TITLE_MS - d.syncedRow * PAGE0_ROW_STAGGER_MS) / PAGE0_POP_MS));
      const rowT = p9Ease(rowRaw);
      d.el.style.opacity = String(rowT);
      d.el.style.transform = `scale(${rowT})`;
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
      if (elapsed >= totalMs) { page0EntranceDone = true; page0CueSchedule(PAGE0_CUE_IDLE_MS); }
    } else {
      page0ApplyLogoScrollFade();
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}


// ── @fold1 idle scroll cue (teacher review 2026-09-03, B1). A non-expert
// tester tapped the dots and never scrolled, so once the page-load entrance
// has finished and the user has done nothing for PAGE0_CUE_IDLE_MS, the two
// dot columns pulse in a gentle wave from the BOTTOM row up to the top —
// "look up here, this continues" — and repeat every PAGE0_CUE_REPEAT_MS until
// the first scroll, which cancels the cue for good and hands the dots back to
// updateGroups' own @fold2 shrink/fly. Both the decorative .page0-dot
// elements and the six group swatches (the legend items standing in for
// dots in the column) take part, so the wave reads as one column.
//
// Writes transforms directly rather than going through updateGroups: while
// the page sits idle at scrollY 0 nothing else repaints those dots, and the
// first scroll event both cancels the loop and restores the at-rest transform
// before updateGroups runs. Each dot's own pulse is p9Ease up then p9Ease back
// down (no new curve), row-staggered so the crest travels upward. ──
const PAGE0_CUE_IDLE_MS = 3500;       // quiet time after the entrance before the first pulse
const PAGE0_CUE_REPEAT_MS = 5000;     // between pulses while still idle
const PAGE0_CUE_ROW_STAGGER_MS = 30;  // per row, bottom → top
const PAGE0_CUE_DOT_MS = 520;         // one dot's grow-and-settle
const PAGE0_CUE_SCALE = 1.6;          // peak scale of a 7px dot (≈11px)
let page0CueTimer = null;
let page0CueCancelled = false;
let page0CueRunning = false;

function page0CueTargets() {
  const targets = [];
  PAGE0_DECORATIVE_DOT_ELS.forEach((d) => { if (d.popped) targets.push({ el: d.el, row: d.syncedRow, rest: "scale(1)" }); });
  GROUPS.forEach((g, i) => {
    const anchor = PAGE0_GROUP_DOT_ANCHORS[g.color];
    if (anchor) targets.push({ el: groupItems[i].swatch, row: anchor.syncedRow, rest: "" });
  });
  return targets;
}

function page0CueSchedule(delayMs) {
  if (page0CueCancelled || window.scrollY > 0) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  clearTimeout(page0CueTimer);
  page0CueTimer = setTimeout(page0CueRun, delayMs);
}

function page0CueRun() {
  if (page0CueCancelled || window.scrollY > 0 || page0CueRunning) return;
  const targets = page0CueTargets();
  if (!targets.length) return;
  const maxRow = Math.max(...targets.map((t) => t.row));
  const totalMs = maxRow * PAGE0_CUE_ROW_STAGGER_MS + PAGE0_CUE_DOT_MS;
  const start = performance.now();
  page0CueRunning = true;

  function frame() {
    if (page0CueCancelled) return; // page0CueCancel already restored the transforms
    const elapsed = performance.now() - start;
    targets.forEach((t) => {
      // Bottom row (largest syncedRow) leads; each row starts PAGE0_CUE_ROW_STAGGER_MS after the one below it.
      const local = Math.max(0, Math.min(1, (elapsed - (maxRow - t.row) * PAGE0_CUE_ROW_STAGGER_MS) / PAGE0_CUE_DOT_MS));
      const bump = local < 0.5 ? p9Ease(local * 2) : 1 - p9Ease((local - 0.5) * 2);
      t.el.style.transform = local <= 0 || local >= 1 ? t.rest : `scale(${1 + (PAGE0_CUE_SCALE - 1) * bump})`;
    });
    if (elapsed < totalMs) { requestAnimationFrame(frame); return; }
    page0CueRunning = false;
    page0CueSchedule(PAGE0_CUE_REPEAT_MS);
  }
  requestAnimationFrame(frame);
}

function page0CueCancel() {
  if (page0CueCancelled) return;
  page0CueCancelled = true;
  clearTimeout(page0CueTimer);
  if (page0CueRunning) {
    page0CueTargets().forEach((t) => { t.el.style.transform = t.rest; });
    page0CueRunning = false;
    updateGroups();
  }
}
window.addEventListener("scroll", page0CueCancel, { passive: true });
window.addEventListener("wheel", page0CueCancel, { passive: true });
window.addEventListener("touchmove", page0CueCancel, { passive: true });
