// ── @fold12 animations ───────────────────────────────────────────────────────
// Throughout this file, #page-11 is @fold12 — the closing statement card; the
// outro/credits card is @fold13 (#page-12) and follows it. Every *scroll*
// threshold here (gate, hand-off, sticky freeze) is measured off @fold12's
// offsetTop, so its own height never moves any of them. That height is 150vh
// (style.css): one viewport to bring the card to centre, then half a viewport
// of empty run so @fold13's near-full-height outro card doesn't rise into view
// while this one is still mid-screen. That only reads as spacing because
// #page-11's .page12-sticky-center is overridden to position:static — left
// sticky, extra height pins the card at centre instead of scrolling it away.
// Two independently-driven progress values, per explicit feedback: @fold11
// is "in position" the instant its interaction state is reached (the gate
// line) — from there, scrolling in *either* direction must visibly move
// @fold11's own panel/frame and @fold12's title with no dead scroll space,
// but the *extreme dots'* spread into freeform must still only play once the
// title fully stops at the top, as a proper animated flourish rather than
// something scroll-scrubbed.
//   - eScroll (fold13ScrollT below): a plain scroll-position readout over the
//     card-enters-to-card-arrived range, 0..1, moving continuously with every
//     scroll tick in both directions. Drives:
//       - tray (the pills' frame) fades out in place (inline opacity, transition:none)
//       - header title + subtitle fade out (page9HeaderEl opacity)
//       - extreme zone + dropped pill labels fade out (page9ZoneWrapEl opacity)
//       - canvas count numbers + legit dots fade out (p9.fold13OutT). The
//         camp dividing line does NOT — it rides eTrigger instead, so it
//         survives @fold12 under the standing dot columns (see page9.js).
//       - legend fades out (groupsOverlayEl opacity), and on mobile its מקרא
//         button too (fold6MobileLegendLayerEl opacity)
//       - fold12's own title card (frame included) fades out (page9TitleCardEl opacity)
//   - eTrigger (fold13Trigger): fires once, when @fold12's own
//     .page12-sticky-center reaches mid-viewport (checkFold13, frac 0.5,
//     js/groups.js), and plays out over a fixed GROUP_TRANSITION_MS regardless
//     of further scroll. Drives only the extreme dots' morph to freeform
//     (p9.fold13ExtremeMorphT) and, with it, the camp dividing line's fade-out.
//
// Both halves now belong to @fold12 and run BACK TO BACK, not together: the
// fade is compressed into the first half of the card's rise (FOLD13_FADE_SPAN)
// so it has finished by the time the card is halfway up, and the spread fires
// at exactly that point, onto an otherwise-clear screen. The two constants —
// FOLD13_FADE_SPAN here and checkFold13's frac there — are one decision.
// How much of the card's rise the fade-out occupies, as a fraction of
// fold13ScrollT. 0.5 = done by the time the card is halfway up, which is where
// the freeform spread fires (checkFold13's frac, js/groups.js). The two numbers
// are one decision — raise this and the fade runs under the spread.
const FOLD13_FADE_SPAN = 0.5;

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

  // The fade runs over the FIRST HALF of the card's rise and is fully done by
  // the time the card reaches mid-screen — which is exactly where the freeform
  // spread fires (checkFold13 watches @fold12's wrapper at frac 0.5,
  // js/groups.js). So the sequence reads as: everything fades out as the
  // closing statement climbs, and the instant it is halfway up — with the
  // screen otherwise clear — the extreme dots spread. The two never overlap.
  // FOLD13_FADE_SPAN and that 0.5 are one decision in two files.
  const tScroll = Math.min(1, fold13ScrollT() / FOLD13_FADE_SPAN);
  // p9Ease (sine in-out), NOT the ease-out cubic eTrigger uses: the cubic was
  // ~90% done a third of the way in, so the fade finished long before the card
  // it belongs to had arrived. Sine in-out finishes at t=1 — and t is the
  // card's own rise (see fold13ScrollT), so the fade IS the card coming up.
  const eScroll = p9Ease(tScroll);

  p9.fold13OutT = eScroll; // fades legit dots / counts in drawPage9 (not the divider)

  // When fully reversed (eScroll=0) clear inline opacity so CSS class rules
  // (engaged, is-active, etc.) take over — inline "1" would otherwise
  // override them and freeze elements in their @fold12 state.
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
  // explicitly — otherwise it stays visible through @fold12 while the rest
  // of the legend fades out.
  fold6NoteLayerEl.style.opacity = opacityVal;
  // Same for the mobile מקרא bar: it is the legend's *control* on a phone, in
  // its own fixed layer outside groupsOverlayEl, so without this it stayed
  // sitting on screen while the legend it opens faded away underneath it.
  // Fading the whole layer takes the panel with it if it happens to be open.
  if (fold6MobileLegendLayerEl) fold6MobileLegendLayerEl.style.opacity = opacityVal;
  // The shared #page9Tooltip too — on mobile it's the docked event frame,
  // which sat fully visible through @fold12 while everything around it faded.
  // Inline opacity only (the base rule has no opacity transition), cleared at
  // eScroll=0 like the rest so its normal show/hide styling takes back over.
  if (fold8TooltipEl) fold8TooltipEl.style.opacity = opacityVal;
  // page12TitleCardEl (the fold13 card) stays visible throughout.
  // fold6SquareEls' own opacity (updateGroups) reads p9.fold13OutT just set
  // above to fade a still-legit square out with the rest of the legit grid —
  // without this call it would only pick that up next time something else
  // happens to invoke updateGroups (e.g. a fold9 trigger tick), not on every
  // fold13ScrollT-driven scroll tick like every other @fold12 element here.
  updateGroups();
  draw();
}

// The fade-out is the title block's ARRIVAL, not a separate scroll range
// (explicit instruction): 0 the instant @fold12's card first pokes above the
// viewport's bottom edge, 1 when it has finished rising to its resting spot
// (scrollY = #page-11's offsetTop, where the static wrapper's padding-top
// leaves it). So the panel is going out for exactly as long as the card is
// coming up — no stretch of scroll where everything has faded and there is
// nothing on screen yet. The card is flush with its section top at every width
// (style.css), so that start lands exactly ON the gate line — the fade begins
// the instant the gate releases. That pairing is the whole dead-space fix:
// @fold11's panel is `.frozen` (motionless at top:0) through the hand-off, so
// any scroll before the card appears is a crossfade on a still image and reads
// as empty. Padding the card down inside its section re-opens that stretch.
// #page-11's height beyond the resting spot is trailing gap and doesn't
// stretch this range. A plain scroll readout, not a makeTrigger, since this
// must move continuously with scroll in both directions rather than play out
// over fixed real time.
function fold13ScrollT() {
  const page12 = document.getElementById("page-11");
  if (!page12) return 0;
  const card = page12.querySelector(".page12-sticky-center");
  const end  = page12.offsetTop;
  // How far down the section the card rests — 0 at every width now that the
  // trim (style.css) is unconditional. Still measured rather than assumed, so
  // any future padding on the wrapper shows up here as the gap it re-opens.
  const cardTop = card
    ? card.getBoundingClientRect().top + window.scrollY
    : end;
  const start = cardTop - window.innerHeight;
  if (end <= start) return window.scrollY >= end ? 1 : 0;
  return Math.max(0, Math.min(1, (window.scrollY - start) / (end - start)));
}

// ── @fold12 scroll gate ──────────────────────────────────────────────────────
// #page-11 is locked until at least one @dragcard has been dropped into the
// extreme zone. p9.sides (page9.js) is the source of truth.
function p13GateLocked() {
  return !p9.sides.some(s => s === "above");
}

// The gate position: keep #page-11's top at the viewport bottom (scrollY max =
// gateEl.offsetTop - innerHeight). Beyond this, #page-11 enters the viewport.
function p13GateMax() {
  const gateEl = document.getElementById("page-11");
  return gateEl ? gateEl.offsetTop - window.innerHeight : Infinity;
}

// #page-11's title is centred in a 100vh wrapper flush with the section top, so
// the *instant* real
// scrollY crosses the gate — even for a single momentum-phase wheel tick that
// ignores preventDefault (some browsers mark those non-cancelable, so the
// wheel handler below can't stop them) — it genuinely pins into view for at
// least one paint, before any scrollY-snapback JS gets a chance to run. An
// opacity toggle doesn't have that race: it isn't driven by scroll position at
// all, only by p9.sides actually changing (called from page9.js's commitDrop/
// p9ResetDrops, the only two places that happens), so the title stays fully
// invisible for the whole locked duration regardless of any transient
// overscroll — no per-frame lag window for it to peek through.
// Declared HERE, above the eager p13SyncGateVisibility() call below, not next
// to p13SyncTouchBlock: that call reaches p13SyncTouchBlock at load, and a `let`
// further down the file is still in its temporal dead zone at that moment — the
// throw killed the rest of this script, so the gate's wheel/key/scroll listeners
// were never registered and @fold12 could be scrolled past with no pill dropped.
let p13TouchBlockOn = false;

function p13SyncGateVisibility() {
  if (page12StickyEl) page12StickyEl.classList.toggle("gate-hidden", p13GateLocked());
  p13SyncTouchBlock?.();
}
p13SyncGateVisibility();

// Desktop: block downward mouse-wheel past the gate. Must also catch the
// single wheel tick that *crosses* the gate, not just ticks that land on/past
// it — checking only `scrollY >= max` let one large-delta tick scroll clean
// past the threshold (revealing #page-11's title for a frame until the
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
// Attached only while the gate is locked AND the reader is within a viewport of
// it, never for the page's whole life: a non-passive touchmove on window keeps
// mobile browsers from ever collapsing their URL/bottom bar (they can't know in
// advance the handler won't cancel the scroll, so the chrome stays pinned for
// every drag anywhere on the page). p13SyncTouchBlock is the single switch,
// driven by the scroll listener below and by gate-state changes.
function p13TouchBlock(e) {
  if (!p13GateLocked()) return;
  if (e.touches[0].clientY < p13TouchStartY &&
      window.scrollY >= p13GateMax() - 10) {
    e.preventDefault();
  }
}
function p13SyncTouchBlock() {
  const want = p13GateLocked() && window.scrollY >= p13GateMax() - window.innerHeight;
  if (want === p13TouchBlockOn) return;
  p13TouchBlockOn = want;
  if (want) window.addEventListener("touchmove", p13TouchBlock, { passive: false });
  else window.removeEventListener("touchmove", p13TouchBlock, { passive: false });
}

// Safety net: snap back if scroll somehow lands past the gate (momentum-phase
// wheel events that ignore preventDefault, scrollbar drags, etc). Corrects
// synchronously in the scroll handler itself rather than deferring to the next
// requestAnimationFrame — that extra frame of delay is exactly the window
// during which #page-11's title was visibly peeking up before snapping back.
window.addEventListener("scroll", () => {
  p13SyncTouchBlock();
  if (!p13GateLocked()) return;
  const max = p13GateMax();
  if (window.scrollY > max) {
    window.scrollTo({ top: max, behavior: "instant" });
  }
}, { passive: true });

// Freeze the page9 sticky panel in place while scrolled into @fold12 — once
// the user passes #page-11's scroll context, position:sticky releases and the
// panel would drift off. Switching to position:fixed keeps it locked at top:0.
// The sticky element unpins at scrollY = #page-11.offsetTop - window.innerHeight
// (one full viewport before #page-11 starts), so freeze at that same threshold,
// not at #page-11.offsetTop itself (that would be too late by a full vh).
const p13GateEl = document.getElementById("page-11");
window.addEventListener("scroll", () => {
  if (!p13GateEl) return;
  page9StickyEl.classList.toggle("frozen", window.scrollY >= p13GateEl.offsetTop - window.innerHeight);
}, { passive: true });

// Explicitly load both weights so canvas gets the real font on first draw
