// ── @fold13 animations ───────────────────────────────────────────────────────
// Throughout this file, #page-14 is @fold13 — the closing statement card; the
// share block (@fold15, #page-16) and the outro/credits card (@fold16,
// #page-17) follow it. Every *scroll*
// threshold here (gate, hand-off, sticky freeze) is measured off @fold13's
// offsetTop, so its own height never moves any of them. That height is 150vh
// (style.css): one viewport to bring the card to centre, then half a viewport
// of empty run so the next card doesn't rise into view
// while this one is still mid-screen. That only reads as spacing because
// #page-14's .page12-sticky-center is overridden to position:static — left
// sticky, extra height pins the card at centre instead of scrolling it away.
// Two independently-driven progress values, per explicit feedback: @fold12
// is "in position" the instant its interaction state is reached (the gate
// line) — from there, scrolling in *either* direction must visibly move
// @fold12's own panel/frame and @fold13's title with no dead scroll space,
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
//         survives @fold13 under the standing dot columns (see page9.js).
//       - legend fades out (groupsOverlayEl opacity), and on mobile its מקרא
//         button too (fold6MobileLegendLayerEl opacity)
//       - fold12's own title card (frame included) fades out (page9TitleCardEl opacity)
//   - eTrigger (fold13Trigger): fires once, when @fold13's own
//     .page12-sticky-center reaches mid-viewport (checkFold13, frac 0.5,
//     js/groups.js), and plays out over a fixed GROUP_TRANSITION_MS regardless
//     of further scroll. Drives only the extreme dots' morph to freeform
//     (p9.fold13ExtremeMorphT) and, with it, the camp dividing line's fade-out.
//
// Both halves belong to @fold13 and run BACK TO BACK, not together: the fade
// occupies the first part of the card's rise and has finished by the time the
// card reaches its trigger line, where the spread fires onto an otherwise-clear
// screen. The span is DERIVED from that line (foldFracNow("fold13"),
// js/groups.js: 0.75 → the first quarter of the rise), so the two cannot drift.
function fold13FadeSpan() {
  return Math.max(0.05, 1 - foldFracNow("fold13"));
}
let fold13TooltipFaded = false;
// העין השביעית's corner logo link — faded by updateFold13 on desktop.
const seventhEyeEl = document.querySelector(".seventh-eye");
const langWrapEl    = document.getElementById("langWrap"); // the language switch card

function updateFold13() {
  const tTrigger = fold13Trigger.currentT();
  // p9Ease (sine in-out), NOT the ease-out cubic this used to be: a curve that
  // is fast at 0 is an ease-IN when the trigger plays it backward, so the
  // reverse spread accelerated into the columns and stopped dead at full
  // speed — ~10px in the last frame, which read as the columns snapping. The
  // symmetric curve lands gently in both directions.
  const eTrigger = p9Ease(tTrigger);

  // Capture starting dot positions on the first morph frame — p9.lastPositions
  // holds the clustered positions from the previous (non-morphed) frame. Only a
  // FALLBACK for drawPage12: its near end is the live p9.lastPositions, which
  // drawBandedCols keeps recording (paint-free) under the spread.
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
  // spread fires (checkFold13 watches @fold13's wrapper at frac 0.5,
  // js/groups.js). So the sequence reads as: everything fades out as the
  // closing statement climbs, and the instant it is halfway up — with the
  // screen otherwise clear — the extreme dots spread. The two never overlap.
  // FOLD13_FADE_SPAN and that 0.5 are one decision in two files.
  const tScroll = Math.min(1, fold13ScrollT() / fold13FadeSpan());
  // p9Ease (sine in-out), NOT the ease-out cubic eTrigger uses: the cubic was
  // ~90% done a third of the way in, so the fade finished long before the card
  // it belongs to had arrived. Sine in-out finishes at t=1 — and t is the
  // card's own rise (see fold13ScrollT), so the fade IS the card coming up.
  const eScroll = p9Ease(tScroll);

  p9.fold13OutT = eScroll; // fades legit dots / counts in drawPage9 (not the divider)

  // When fully reversed (eScroll=0) clear inline opacity so CSS class rules
  // (engaged, is-active, etc.) take over — inline "1" would otherwise
  // override them and freeze elements in their @fold13 state.
  const opacityVal = eScroll > 0 ? String(1 - eScroll) : '';
  // The tray (the pills' frame) fades out in place with everything else —
  // it used to slide off (up on mobile/V2, down in the old bottom-sheet
  // layout) while the rest of the fold faded, which made it the one element
  // exiting by motion. transition:none so the fade tracks scroll ticks, no
  // CSS opacity transition fighting it.
  page9TrayEl.style.transition = eScroll > 0 ? "none" : "";
  page9TrayEl.style.opacity    = opacityVal;
  // The whole panel is position:fixed (.frozen) from the gate onward and never
  // leaves the screen, so once it is faded it still sat invisibly over the
  // folds behind it — its tray band (pointer-events:auto) ate the hover on
  // @fold15's share buttons whenever the card scrolled through it. Inert while
  // anything is faded; cleared with the rest at eScroll=0.
  page9StickyEl.style.pointerEvents = eScroll > 0 ? "none" : "";
  if (page9HeaderEl)    page9HeaderEl.style.opacity    = opacityVal;
  if (page9TitleCardEl) page9TitleCardEl.style.opacity = opacityVal;
  if (page9ZoneWrapEl)  page9ZoneWrapEl.style.opacity  = opacityVal;
  groupsOverlayEl.style.opacity = opacityVal;
  // fold6NoteLayerEl (the ACLED source-credit note) lives outside
  // groupsOverlayEl now (see index.html) so it needs the same fade
  // explicitly — otherwise it stays visible through @fold13 while the rest
  // of the legend fades out.
  fold6NoteLayerEl.style.opacity = opacityVal;
  // Same for the mobile מקרא bar: it is the legend's *control* on a phone, in
  // its own fixed layer outside groupsOverlayEl, so without this it stayed
  // sitting on screen while the legend it opens faded away underneath it.
  // Fading the whole layer takes the panel with it if it happens to be open.
  if (fold6MobileLegendLayerEl) fold6MobileLegendLayerEl.style.opacity = opacityVal;
  // The shared #page9Tooltip too — on mobile it's the docked event frame,
  // which sat fully visible through @fold13 while everything around it faded.
  // Inline opacity only (the base rule has no opacity transition), cleared at
  // eScroll=0 like the rest so its normal show/hide styling takes back over.
  // Cleared ONCE, on the way back from a fade — never re-cleared while eScroll
  // sits at 0. This runs on every scroll tick from the very top of the page,
  // and an unconditional '' wiped @hidden-hover's grow-in opacity (fold8AdvanceSequence)
  // between frames, so the docked frame strobed at full opacity as it opened.
  if (fold8TooltipEl && (eScroll > 0 || fold13TooltipFaded)) {
    fold8TooltipEl.style.opacity = opacityVal;
    fold13TooltipFaded = eScroll > 0;
  }
  // העין השביעית's corner logo + its «פרויקט בשיתוף» line (.seventh-eye, a
  // fixed link in the top-right) fade with everything else — DESKTOP ONLY: the
  // phone already hides it once scrolling starts (.is-scrolled, js/nav.js), and
  // an inline opacity here would override that class back to visible.
  if (seventhEyeEl && !isMobile()) {
    // Not before @fold1's own fade-in has finished (page0ChromeShown) — at
    // eScroll 0 this writes '' and would snap the corner to full mid-fade.
    if (page0ChromeShown) seventhEyeEl.style.opacity = opacityVal;
    seventhEyeEl.style.pointerEvents = eScroll > 0 ? "none" : "";
  }
  // The language switch (#langWrap, fixed top-left on BOTH breakpoints — nothing
  // else ever hides it) fades with the rest of the chrome; pointer-events off
  // while faded so a tap on the empty corner can't open the menu.
  if (langWrapEl) {
    if (page0ChromeShown) langWrapEl.style.opacity = opacityVal;
    langWrapEl.style.pointerEvents = eScroll > 0 ? "none" : "";
  }
  // page12TitleCardEl (the fold13 card) stays visible throughout.
  // fold6SquareEls' own opacity (updateGroups) reads p9.fold13OutT just set
  // above to fade a still-legit square out with the rest of the legit grid —
  // without this call it would only pick that up next time something else
  // happens to invoke updateGroups (e.g. a fold9 trigger tick), not on every
  // fold13ScrollT-driven scroll tick like every other @fold13 element here.
  updateGroups();
  draw();
}

// @fold14 + @fold15 — the camps pair up, in TWO folds. A SECOND move on top of
// @fold13's spread: @fold13's camp-split freeform positions are the from, the
// couple slots (p12EnsurePairTargets, page12.js) are the to. p9Ease (sine
// in-out, the house default), fully reversible — scrolling back up walks the
// couples home (out of @fold15) and shrinks the filler dots away (out of @fold14).
//   pop  — @fold14 (the partner credit card's crossing, fold14PopTrigger):
//          the newcomers grow in on their own camp's side, surplus dots shrink
//          away, everything still standing in @fold13's spread
//   fly  — @fold15 (the share card's crossing, fold14PairTrigger): the whole
//          field travels to the couple slots and recolours
// Each beat is its own trigger with its own duration, so each is a plain
// currentT() readout (already p9Ease'd — no slicing). Named exceptions to
// GROUP_TRANSITION_MS because the beats are deliberately uneven — a quick pop,
// then a long flight.
// var, not const: tuned live through a manual/ harness (since removed).
var FOLD14_POP_MS_DESKTOP = 450;   // nudged slower 2026-10-02 (was 371, manual/-baked 2026-09-19) — @fold14, newcomers grow in
var FOLD14_POP_MS_MOBILE  = 371;   // matched to desktop for now (explicit instruction); tune on its own later
function fold14PopMs() { return isMobile() ? FOLD14_POP_MS_MOBILE : FOLD14_POP_MS_DESKTOP; }
var FOLD14_FLY_MS = 1729;  // @fold15 — the field flies to the couple slots

function updateFold14Pop() {
  const t = fold14PopTrigger.currentT();
  if (t > 0 && !fold14PopStarted) {
    fold14PopStarted = true;
    p12PairTargets = null; // force recompute with current W/H
  }
  if (t <= 0) fold14PopStarted = false;
  p9.fold14PopT = t;
  draw();
}
let fold14PopStarted = false;

function updateFold14() {
  p9.fold14PairT = fold14PairTrigger.currentT();
  draw();
}

// The fade-out is the title block's ARRIVAL, not a separate scroll range
// (explicit instruction): 0 the instant @fold13's card first pokes above the
// viewport's bottom edge, 1 when it has finished rising to its resting spot
// (scrollY = #page-14's offsetTop, where the static wrapper's padding-top
// leaves it). So the panel is going out for exactly as long as the card is
// coming up — no stretch of scroll where everything has faded and there is
// nothing on screen yet. The card is flush with its section top at every width
// (style.css), so that start lands exactly ON the gate line — the fade begins
// the instant the gate releases. That pairing is the whole dead-space fix:
// @fold12's panel is `.frozen` (motionless at top:0) through the hand-off, so
// any scroll before the card appears is a crossfade on a still image and reads
// as empty. Padding the card down inside its section re-opens that stretch.
// #page-14's height beyond the resting spot is trailing gap and doesn't
// stretch this range. A plain scroll readout, not a makeTrigger, since this
// must move continuously with scroll in both directions rather than play out
// over fixed real time.
function fold13ScrollT() {
  const page12 = document.getElementById("page-14");
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

// ── @fold13 scroll gate ──────────────────────────────────────────────────────
// #page-14 is locked until at least one @dragcard has been dropped into the
// extreme zone. p9.sides (page9.js) is the source of truth.
function p13GateLocked() {
  return !p9.sides.some(s => s === "above");
}

// The gate position: keep #page-14's top at the viewport bottom (scrollY max =
// gateEl.offsetTop - innerHeight). Beyond this, #page-14 enters the viewport.
function p13GateMax() {
  const gateEl = document.getElementById("page-14");
  return gateEl ? gateEl.offsetTop - window.innerHeight : Infinity;
}

// #page-14's title is centred in a 100vh wrapper flush with the section top, so
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
// were never registered and @fold13 could be scrolled past with no pill dropped.
let p13TouchBlockOn = false;

// Everything past the gate — @fold13's own #page-14 (its card is the
// gate-hidden one) through @fold16's #page-17. While locked it can't be scrolled
// to, so it must not be reachable by Tab or a screen reader's virtual cursor
// either (the share row and the credits links would otherwise take focus
// off-screen, WCAG 2.4.3 / 2.4.11). `inert` is behaviour-only: no paint change.
// The fixed corner chrome (.seventh-eye, #langWrap) is page-wide, not these
// folds', and stays reachable.
const P13_GATED_SECTION_IDS = ["page-14", "page-15", "page-16", "page-17"];
// One «classify something to go on» hint per lock — reset on unlock, so a
// reader who pulls every pill back out hears it again at the next blocked key.
let p13GateHintSaid = false;
function p13SyncGateInert() {
  const locked = p13GateLocked();
  for (const id of P13_GATED_SECTION_IDS) {
    const el = document.getElementById(id);
    if (el) el.inert = locked;
  }
  if (!locked) p13GateHintSaid = false;
}

function p13SyncGateVisibility() {
  if (page12StickyEl) page12StickyEl.classList.toggle("gate-hidden", p13GateLocked());
  p13SyncGateInert();
  p13SyncTouchBlock?.();
  checkFold13Peek?.();
}

// ── @fold13 peek ──
// Once fold13PeekPills() @dragcards sit in the extreme zone, the closing
// statement's title block peeks over the bottom edge — "there is more
// underneath". It is the REAL card, not a copy. While the page's own scroll has
// not yet brought it FOLD13_PEEK_PX into view it is HELD: taken out of the flow
// with position:fixed at (bottom edge − peek), text hidden. The moment its
// natural place is at or above that line it goes back into the flow and simply
// scrolls. Position animates (never a snap), both ways: pulling pills back out
// slides it down again. Both breakpoints, each on its own numbers
// (fold13PeekPx / fold13PeekPills) — mobile counts tapped pills, and its band
// sits at the top of the screen, so the bottom edge is free for the peek.
//
// Held with position:fixed, NOT a translateY recomputed on scroll: scrolling is
// painted before the scroll event runs, so a transform chasing it is always a
// frame behind and the card jittered up and down on a slow scroll. A fixed box
// does not move with the scroll at all, so there is nothing to chase.
// The wrapper keeps its own solved height (p12SpacingFit), so lifting the card
// out of the flow moves nothing else.
var FOLD13_PEEK_PX_DESKTOP    = 24;
var FOLD13_PEEK_PX_MOBILE     = 24;
var FOLD13_PEEK_PILLS_DESKTOP = 3;
var FOLD13_PEEK_PILLS_MOBILE  = 3;
function fold13PeekPx()    { return isMobile() ? FOLD13_PEEK_PX_MOBILE : FOLD13_PEEK_PX_DESKTOP; }
function fold13PeekPills() { return isMobile() ? FOLD13_PEEK_PILLS_MOBILE : FOLD13_PEEK_PILLS_DESKTOP; }
// Named exception to GROUP_TRANSITION_MS: one small slide, not a legend beat.
const FOLD13_PEEK_MS  = 500;
const fold13PeekCardEl = document.querySelector("#page-14 .page12-sticky-center .text-card");
let fold13PeekHeld = false;
function fold13PeekRelease() {
  if (!fold13PeekHeld) return;
  fold13PeekHeld = false;
  const s = fold13PeekCardEl.style;
  s.position = s.top = s.left = s.width = s.margin = "";
  const frame = fold13PeekCardEl.querySelector(".text-card-frame");
  if (frame) frame.style.color = "";
}
function fold13PeekUpdate() {
  if (!fold13PeekCardEl || !page12StickyEl) return;
  const t = p9Ease(fold13PeekTrigger.currentRaw());
  if (t <= 0) { fold13PeekRelease(); return; }
  // The card's place in the flow, read off the WRAPPER (which never leaves it).
  const padTop = parseFloat(getComputedStyle(page12StickyEl).paddingTop) || 0;
  const naturalTop = page12StickyEl.getBoundingClientRect().top + padTop;
  const heldTop = window.innerHeight - fold13PeekPx() * t;
  if (naturalTop <= heldTop) { fold13PeekRelease(); return; }
  const s = fold13PeekCardEl.style;
  if (!fold13PeekHeld) {
    // Measured while still in the flow, so the held box lands on the same x.
    const r = fold13PeekCardEl.getBoundingClientRect();
    fold13PeekHeld = true;
    s.position = "fixed";
    s.margin   = "0";
    s.left     = r.left + "px";
    s.width    = r.width + "px";
    const frame = fold13PeekCardEl.querySelector(".text-card-frame");
    if (frame) frame.style.color = "transparent";
  }
  s.top = heldTop + "px";
}
const fold13PeekTrigger = makeTrigger(FOLD13_PEEK_MS, fold13PeekUpdate);
const checkFold13PeekFlag = watchFlag(() => {
  if (typeof page9StickyEl === "undefined" || !page9StickyEl ||
      !page9StickyEl.classList.contains("engaged")) return false;
  return p9.sides.filter(s => s === "above").length >= fold13PeekPills();
}, fold13PeekTrigger);
function checkFold13Peek() { checkFold13PeekFlag(); fold13PeekUpdate(); }
window.addEventListener("scroll", checkFold13Peek, { passive: true });
window.addEventListener("resize", () => { fold13PeekRelease(); checkFold13Peek(); });

p13SyncGateVisibility();

// Desktop: block downward mouse-wheel past the gate. Must also catch the
// single wheel tick that *crosses* the gate, not just ticks that land on/past
// it — checking only `scrollY >= max` let one large-delta tick scroll clean
// past the threshold (revealing #page-14's title for a frame until the
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
    // Nothing visible happens at the gate, so say why (p9Announce: page9.js's
    // shared polite live region).
    if (!p13GateHintSaid && typeof p9Announce === "function") {
      p13GateHintSaid = true;
      p9Announce(tr("כדי להמשיך, סווגו לפחות סוג פעולה אחד כקיצוני."));
    }
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
// during which #page-14's title was visibly peeking up before snapping back.
window.addEventListener("scroll", () => {
  p13SyncTouchBlock();
  if (!p13GateLocked()) return;
  const max = p13GateMax();
  if (window.scrollY > max) {
    window.scrollTo({ top: max, behavior: "instant" });
  }
}, { passive: true });

// Freeze the page9 sticky panel in place while scrolled into @fold13 — once
// the user passes #page-14's scroll context, position:sticky releases and the
// panel would drift off. Switching to position:fixed keeps it locked at top:0.
// The sticky element unpins at scrollY = #page-14.offsetTop - window.innerHeight
// (one full viewport before #page-14 starts), so freeze at that same threshold,
// not at #page-14.offsetTop itself (that would be too late by a full vh).
const p13GateEl = document.getElementById("page-14");
window.addEventListener("scroll", () => {
  if (!p13GateEl) return;
  page9StickyEl.classList.toggle("frozen", window.scrollY >= p13GateEl.offsetTop - window.innerHeight);
}, { passive: true });

// Explicitly load both weights so canvas gets the real font on first draw
