// @fold9's square shows the shared #page9Tooltip (page7.js/page9.js's own
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
// every page) would stomp an unrelated hover-driven tooltip on page-8/-9.
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
// fold8TooltipTrigger's own raw progress changes direction (sensed each tick
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
// fold8TooltipTrigger's own animation has already finished) can call it. Box
// size no longer changes once grown (see fold8SetupTypewriter's own comment
// on why), so in practice this only needs to run once the grow-in finishes —
// still called every frame regardless, it's cheap.
// MOBILE ONLY — @fold7, @fold8 and the real timeline (#page-8) don't float the
// tooltip beside its dot at all: a ~2px square on a 393px screen leaves no
// room for a 222px callout to sit next to it without covering the very dot it
// describes (and, on the timeline, half the grid). Instead the tooltip becomes
// a DOCKED frame — one designated spot above the timeline grid, the same
// position and the same fixed size for every event; only the text inside
// changes as the selection moves. Everything that varies with the anchor
// (left/top, .is-mirrored's pointer corner, the grow-from-the-corner scale)
// is therefore skipped on mobile — see .page9-tooltip.is-docked in style.css
// for the geometry, and Timeline.md.
//
// Returns true when the docked layout is in force, so each of the three
// callers can skip its own anchor math. Read live (isMobile() reads
// innerWidth), so a resize across the breakpoint restores the floating
// callout on the next tick.
// The docked frame has THREE resting spots, and glides between them:
//
//   @fold7 — just above the block of 8 sample squares (measured live off their
//     own rects, so it tracks them at any viewport height instead of being
//     pinned to a guessed fraction). The tooltip belongs to one of those
//     squares there, so it should read as sitting over them.
//   @fold8 onward — TOOLTIP_DOCK_TOP_PX, its final spot above the timeline
//     grid (SBB_TIMELINE_MOBILE_TOP_PX, which is derived from this constant plus the frame's own 100px collapsed height) and clear of the מקרא bar.
//   @fold11 engaged — p9DockTopM() (page9.js): pushed further down to clear the
//     pill tray band, which on mobile pins itself under the titles rather than
//     sitting at the bottom of the screen. Runs on p9TooltipDropTrigger
//     (js/groups.js), fired from the same `isStuck` crossing that slides the
//     tray in, so the frame steps down as the band arrives and back up on the
//     way out.
//
// The move between the first two runs on fold9FlyTrigger — the same crossing that
// brings the real timeline in and flies the 8 squares out to their real dots —
// so the frame animates up exactly as the timeline hits, and reverses back
// down with it on a scroll up. Position, per the house rule, lerps
// continuously; it never snaps.
const TOOLTIP_DOCK_TOP_PX = 62;         // final spot: below the מקרא bar (~46), above the grid (SBB_TIMELINE_MOBILE_TOP_PX is derived from this)
const TOOLTIP_DOCK_SQUARES_GAP_PX = 16; // gap between the frame's bottom edge and the topmost sample square

// Blends @fold11's drop onto whatever spot the earlier two produced, so the
// three-way lerp stays continuous even if the user scrolls back up mid-drop.
function tooltipDockDropPx(base) {
  if (typeof p9TooltipDropTrigger === "undefined" || typeof p9DockTopM !== "function") return base;
  const d = p9TooltipDropTrigger.currentT();
  return d <= 0 ? base : base + (p9DockTopM() - base) * d;
}

// The @fold7 resting spot, frozen the moment the @fold8→@fold9 fly starts.
// It CANNOT be re-measured live mid-fly: the 8 sample squares it's measured
// against are themselves flying to their real timeline dots on the very same
// trigger, so a live measurement makes the lerp's start point chase the
// moving squares and the frame wobbles along with them instead of gliding
// straight to its dock spot. Re-measured whenever the fly is fully reversed
// (t <= 0), so a resize while resting on @fold7 still tracks the layout.
let tooltipFold6TopFrozen = null;

function tooltipDockTopPx(el) {
  const t = typeof fold9FlyTrigger === "undefined" ? 1 : fold9FlyTrigger.currentT();
  if (t >= 1 || typeof fold6SquareEls === "undefined") return tooltipDockDropPx(TOOLTIP_DOCK_TOP_PX);
  if (t <= 0 || tooltipFold6TopFrozen === null) {
    // Measured off `sq`, NOT `wrap`: the wrap is a deliberately zero-size anchor
    // (its left/top IS the square's position — same convention as .group-item),
    // so it reports height 0 and any "is this laid out yet" guard against its
    // height rejects all 8. `sq` is the real 8px box.
    let squaresTop = Infinity;
    for (const { sq } of fold6SquareEls) {
      const r = sq.getBoundingClientRect();
      if (r.height) squaresTop = Math.min(squaresTop, r.top);
    }
    // Nothing laid out yet — no squares to sit above.
    if (squaresTop === Infinity) return tooltipDockDropPx(TOOLTIP_DOCK_TOP_PX);
    // @fold7's spot can never push the frame off the top of the screen: on a
    // short phone the squares may sit high enough that there's no room above
    // them, in which case the final spot is already the best available.
    tooltipFold6TopFrozen = Math.max(TOOLTIP_DOCK_TOP_PX,
      squaresTop - TOOLTIP_DOCK_SQUARES_GAP_PX - el.offsetHeight);
  }
  const fold6Top = tooltipFold6TopFrozen;
  return tooltipDockDropPx(fold6Top + (TOOLTIP_DOCK_TOP_PX - fold6Top) * t);
}

// Picker collision dodge — while the loupe would overlap the docked frame
// (finger held high on the chart), the frame SNAPS to a spot low on the
// viewport, and snaps back when the finger drops below the threshold or lifts.
// A deliberate exception to "position never snaps", per explicit instruction —
// the dodge is a mode flip serving a live finger, and an animated frame would
// pass through the very glass it's dodging.
//
// The dodge spot sits on the clearance line the timeline grid's bottom uses:
// the year-axis line (P7_AXIS_Y_FRAC_MOBILE of the viewport) minus
// SBB_TIMELINE_MOBILE_AXIS_CLEAR_PX (squareboundingbox.js — the one-line
// axis-event label block plus the shared 18px gap), keeping the frame clear of
// BOTH the axis and the event headline/date printed above it.
//
// The two folds anchor differently — explicit instruction, @fold11 ONLY:
// - @fold9 (the real timeline): the frame's BOTTOM edge, off the LIVE
//   offsetHeight, so a hold-expanded description grows UPWARD from the line
//   and never touches the axis text.
// - @fold11 (currentPage === 10): the COLLAPSED frame's bottom edge sits
//   P7_TIP_AVOID_DROP_PX lower still (eating into the clearance, by
//   instruction), and expansion grows DOWNWARD instead of upward.
let p7TipAvoidActive = false;

// @fold11-only extra drop below the clearance line, per explicit instruction
// ("snap to a bit lower position", then "lower still"). Deliberately eats into
// the axis/label clearance described above — raise back toward 0 if the frame
// starts crowding the axis text.
const P7_TIP_AVOID_DROP_PX = 32;

function tooltipAvoidPx(el, top) {
  if (!p7TipAvoidActive) return top;
  const frac = typeof P7_AXIS_Y_FRAC_MOBILE === "undefined" ? 0.94 : P7_AXIS_Y_FRAC_MOBILE;
  const clear = typeof SBB_TIMELINE_MOBILE_AXIS_CLEAR_PX === "undefined" ? 64 : SBB_TIMELINE_MOBILE_AXIS_CLEAR_PX;
  const line = window.innerHeight * frac - clear;
  if (typeof currentPage !== "undefined" && currentPage === 10) {
    const collapsedH = typeof P9_TOOLTIP_COLLAPSED_H === "undefined" ? 100 : P9_TOOLTIP_COLLAPSED_H;
    return line + P7_TIP_AVOID_DROP_PX - collapsedH;
  }
  return line - el.offsetHeight;
}

function tooltipDockMobile(el) {
  const docked = isMobile();
  el.classList.toggle("is-docked", docked);
  if (docked) {
    // Horizontal centering is the transform's job, so whatever the floating
    // layout wrote into `left` has to be cleared or it would shove the frame
    // off its spot. `top` is owned outright by tooltipDockTopPx above.
    el.style.left = "";
    el.style.top = `${tooltipAvoidPx(el, tooltipDockTopPx(el))}px`;
  }
  return docked;
}

// Square 0's own beat-2 "fly" progress, published each frame by updateGroups
// (js/update-groups.js) rather than re-derived here. It is what swings the demo
// callout from hanging ABOVE its square (@fold7) to hanging BELOW it, so it is
// angled down by the time the square lands on the real timeline.
//
// fold9FlyTrigger's whole span is NOT the flight: its first
// FOLD9_FLY_RESIZE_SPAN is beat 1 (color + resize), during which the square
// hasn't moved at all — riding the whole trigger swung the callout down before
// the flight had even started. Ride beat 2 only.
let fold8FlyMoveT = 0;

function fold8PositionTooltip(sq) {
  if (tooltipDockMobile(fold8TooltipEl)) return;
  const sqRect = sq.getBoundingClientRect();
  const dotClientX = sqRect.left + sqRect.width / 2;
  const dotClientY = sqRect.top + sqRect.height / 2;
  const TOOLTIP_GAP = 5;
  const rawLeft = dotClientX - TOOLTIP_GAP - fold8TooltipEl.offsetWidth;
  const left = Math.max(8, Math.min(rawLeft, window.innerWidth - fold8TooltipEl.offsetWidth - 8));
  // Position lerps continuously between the two hangs (house rule: position
  // never snaps); the pointer CORNER is a secondary attribute, so it may snap,
  // and does — at the halfway point, where the box straddles the dot anyway.
  const downT   = fold8FlyMoveT;
  const upTop   = dotClientY - TOOLTIP_GAP - fold8TooltipEl.offsetHeight;
  const downTop = dotClientY + TOOLTIP_GAP;
  const top = Math.max(upTop + (downTop - upTop) * downT, 8);
  const flipped = downT >= 0.5;
  fold8TooltipEl.classList.toggle("is-flipped", flipped);
  // The grow-in scales from the pointer corner, which moves with the flip.
  // Skipped while docked — that branch returned above — so this only ever
  // overrides the "bottom right" updateGroups wrote for the floating callout.
  fold8TooltipEl.style.transformOrigin = flipped ? "top right" : "bottom right";
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
// Direction is resolved fresh every call from fold8TooltipTrigger's raw scroll
// progress (see fold8SeqDirection's own comment above), so a scroll reversal
// mid-grow or mid-typing takes effect on the very next frame, not just once
// the forward sequence happens to finish. shrinkT/shrinkRaw (fold 9's own,
// later, one-way "square arrived at its real dot" collapse) are read fresh
// here too and layered multiplicatively on top — unrelated to this reversal,
// untouched from the original implementation.
// Set by the mobile event picker (p7InspectInit, page7.js) while IT is the one
// filling the docked frame. @fold7/@fold8's scripted sequence and the picker
// are two owners of the same element (the same problem fold8TooltipOwnsIt
// solves against page7/page9's hover), and the picker's ownership is the
// stronger of the two: it only ever engages on the real timeline, where this
// fold's own sequence has already played out and is holding an empty frame.
// While it's true, the sequence writes nothing — no position, no opacity, no
// typewriter — so the two can't stomp each other frame to frame.
let p7InspectOwnsTooltip = false;

function fold8AdvanceSequence() {
  if (!fold8SequenceEvent || p7InspectOwnsTooltip) return;
  const event = fold8SequenceEvent;
  const now = performance.now();
  const dt = fold8SeqLastFrameTime === null ? 0 : now - fold8SeqLastFrameTime;
  fold8SeqLastFrameTime = now;

  const raw = fold8TooltipTrigger.currentRaw();
  if (raw !== fold8PrevTooltipRaw) fold8SeqDirection = raw > fold8PrevTooltipRaw ? 1 : -1;
  // A SNAPPED trigger (watchCardThreshold's over-a-viewport jump path — e.g.
  // iOS status-bar tap back to the hero) lands raw at 0 in one tick instead of
  // animating down. The wall-clock unwind below would then keep the tooltip
  // fading over the hero for ~1.5s after everything else has snapped away —
  // so mirror the snap: reset instantly. An animated reverse moves raw only
  // ~0.01 per frame, so a 0.5 jump can only be a snap.
  if (raw <= 0 && fold8PrevTooltipRaw - raw > 0.5) {
    fold8PrevTooltipRaw = raw;
    fold8ResetTooltip();
    return;
  }
  fold8PrevTooltipRaw = raw;

  // `|| ""` — two rows in full_v3.xlsx have an empty description_he_medium,
  // which server.py passes through as null.
  const totalChars = event.date.length + (event.descHeMedium || "").length;
  const total = FOLD8_GROW_MS + totalChars * FOLD8_TYPE_MS_PER_CHAR;
  fold8SeqElapsed = Math.max(0, Math.min(total, fold8SeqElapsed + fold8SeqDirection * dt));

  const shrinkT = fold9TooltipShrinkTrigger.currentT();
  const growT = Math.min(1, fold8SeqElapsed / FOLD8_GROW_MS);
  // The docked frame can't grow from its pointer CORNER — it has no pointer,
  // and its spot is fixed — but it does play the same grow-in pop as desktop,
  // scaled about its own center so the frame lands exactly on its dock spot
  // (per explicit instruction: @fold7's tooltip should expand here too, not
  // just fade). The centering translate has to come FIRST in the transform
  // list so the scale happens about the already-centered box; a scale ahead of
  // it would scale the -50% offset too and slide the frame sideways as it
  // grows. Fades on the same beat as well, so a partly-grown frame isn't a
  // hard-edged shrunken card.
  if (tooltipDockMobile(fold8TooltipEl)) {
    const g = fold8TooltipGrowEase(growT);
    fold8TooltipEl.style.transform = `translateX(-50%) scale(${g})`;
    // NOT multiplied by (1 - shrinkT), unlike the desktop scale below: when
    // the square lands on its real dot the docked frame does not leave. It
    // stays put, EMPTY — the text inside fades out (the shrinkRaw-driven
    // textOpacity further down) while the frame itself holds its spot, ready
    // for the next selection. Only reversing the whole fold back to elapsed 0
    // fades the frame itself, through growT.
    // × (1 - fold13OutT): the sequence rAF keeps running while @fold12's
    // scroll fade is active (mobile keeps the docked frame alive through
    // page 9), so without this factor each animation frame snapped the
    // frame back to full grow-in opacity between fold13 scroll ticks.
    fold8TooltipEl.style.opacity =
      String(g * (1 - (typeof p9 !== "undefined" ? (p9.fold13OutT ?? 0) : 0)));
  } else {
    fold8TooltipEl.style.transform = `scale(${fold8TooltipGrowEase(growT) * (1 - shrinkT)})`;
  }

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
  fold8TooltipEl.classList.remove("is-flipped");
  fold8TooltipEl.classList.remove("is-docked");
  fold8TooltipEl.style.opacity = "";
  fold8TooltipEl.style.color = "";
  fold8TooltipEl.style.transform = "";
  fold8TooltipEl.style.transformOrigin = "";
  fold8TooltipDateEl.style.opacity = "";
  fold8TooltipDescEl.style.opacity = "";
  fold8SequenceEvent = null;
  fold8SeqElapsed = 0;
  fold8FlyMoveT = 0;
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
// applied on top of tooltipT (itself already p9Ease'd via fold8TooltipTrigger)
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

