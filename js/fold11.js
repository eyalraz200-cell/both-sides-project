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
//       - tray (the pills' frame) fades out in place (inline opacity, transition:none)
//       - header title + subtitle fade out (page9HeaderEl opacity)
//       - extreme zone + dropped pill labels fade out (page9ZoneWrapEl opacity)
//       - canvas count numbers + dividing line + legit dots fade out (p9.fold13OutT)
//       - legend fades out (groupsOverlayEl opacity), and on mobile its מקרא
//         button too (fold6MobileLegendLayerEl opacity)
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

  // When fully reversed (eScroll=0) clear inline opacity so CSS class rules
  // (engaged, is-active, etc.) take over — inline "1" would otherwise
  // override them and freeze elements in their @fold11 state.
  const opacityVal = eScroll > 0 ? String(1 - eScroll) : '';
  // The tray (the pills' frame) fades out in place with everything else —
  // it used to slide off (up on mobile/V2, down in the old bottom-sheet
  // layout) while the rest of the fold faded, which made it the one element
  // exiting by motion. transition:none so the fade tracks scroll ticks, no
  // CSS opacity transition fighting it.
  page9TrayEl.style.transition = eScroll > 0 ? "none" : "";
  page9TrayEl.style.opacity    = opacityVal;
  if (page9HeaderEl)    page9HeaderEl.style.opacity    = opacityVal;
  if (page9TitleCardEl) page9TitleCardEl.style.opacity = opacityVal;
  if (page9ZoneWrapEl)  page9ZoneWrapEl.style.opacity  = opacityVal;
  groupsOverlayEl.style.opacity = opacityVal;
  // fold6NoteLayerEl (the ACLED source-credit note) lives outside
  // groupsOverlayEl now (see project.html) so it needs the same fade
  // explicitly — otherwise it stays visible through @fold11 while the rest
  // of the legend fades out.
  fold6NoteLayerEl.style.opacity = opacityVal;
  // Same for the mobile מקרא bar: it is the legend's *control* on a phone, in
  // its own fixed layer outside groupsOverlayEl, so without this it stayed
  // sitting on screen while the legend it opens faded away underneath it.
  // Fading the whole layer takes the panel with it if it happens to be open.
  if (fold6MobileLegendLayerEl) fold6MobileLegendLayerEl.style.opacity = opacityVal;
  // The shared #page9Tooltip too — on mobile it's the docked event frame,
  // which sat fully visible through @fold11 while everything around it faded.
  // Inline opacity only (the base rule has no opacity transition), cleared at
  // eScroll=0 like the rest so its normal show/hide styling takes back over.
  if (fold8TooltipEl) fold8TooltipEl.style.opacity = opacityVal;
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
