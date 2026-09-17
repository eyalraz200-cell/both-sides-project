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
var   FOLD8_GROW_MS          = 400; // wall-clock time to reach full scale and hold
var   FOLD8_TOOLTIP_DELAY_MS = 250; // dead time after the crossing, before the grow
// The dead time the CURRENT run of the sequence uses: the 250ms plus the
// @fold7 fake cursor's glide for the scripted demo (set when the sequence
// restarts, js/update-groups.js); a hover-driven restart keeps only the 250ms.
let fold8SeqDelayMs = FOLD8_TOOLTIP_DELAY_MS;
// Which side of its dot the callout hangs: "left" (mirrored) or "right".
let fold8TooltipSide = "left";
var   FOLD8_TYPE_MS_PER_CHAR = 15;  // typewriter speed — tuned snappy, not sluggish

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
//   @fold8 onward — tooltipDockRestPx(), hard against the BOTTOM of the
//     viewport. The mobile stack is מקרא bar / axis headline / grid / frame
//     (top to bottom), so the frame closes the screen rather than opening it,
//     and the grid's bottom clearance (sbbTimelineMobileBottomPx,
//     squareboundingbox.js) is derived from it instead of its top.
//   @fold13 engaged — p9DockTopM() (page9.js): pushed further down to clear the
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
const TOOLTIP_DOCK_H_PX = 100;          // the collapsed frame's height (.page9-tooltip.is-docked, style.css)
const TOOLTIP_DOCK_BOTTOM_PX = -18;     // px the frame keeps off the viewport's bottom edge — NEGATIVE: it     // px the frame keeps off the viewport's bottom edge — NEGATIVE: it
                                        // hangs 18px past the edge, so the frame's border reads as an open
                                        // bottom rather than a floating box (picked by eye 2026-09-05).
                                        // sbbTimelineMobileBottomPx() reads this live, so it also sets the
                                        // timeline grid's bottom clearance (now 100).
// @fold7's two spots — var, driven live by a manual/ harness.
var TOOLTIP_DOCK_TOP_MIN_PX = 16;       // the demo spot can never climb above this
var TOOLTIP_DOCK_SQUARES_GAP_PX = 16;   // demo spot: gap between the frame's bottom edge and the topmost sample square
// Which side of the squares the EXAMPLE's spot sits on ("above" | "below") —
// compare/-driven. The reader's own frame is not solved off the squares at all
// (see tooltipFold7ReaderPx below).
var TOOLTIP_DOCK_DEMO_SIDE = "above";
// THE READER'S FRAME OPENS ABOVE THE BLOCK, like every other @fold7 frame
// (compare/ 2026-09-17: all above beat the mixed sides it was tried against).
// It still has one gap per HALF of the block — the four top squares read the
// first, the four bottom ones the second — because a hold near the top of the
// block leaves less room under the glass than one near its bottom. Both are
// measured off the block as a whole, never off the held square, so each half is
// ONE fixed place rather than a frame that follows the dot.
// Letting go, the frame FLIES from the hold's spot back to the example's over
// this many ms (p9Ease, the house curve) instead of snapping — position, per the
// house rule, animates continuously. var: a manual/ harness drives it.
var FOLD7_TIP_FLY_MS = 260;
let fold7TipFlyFrom = null;   // the top it left, px — null when nothing is in the air
let fold7TipFlyAt   = 0;
// Blends the live target with where the frame was when the finger lifted. The
// TARGET is re-read every frame rather than frozen, so a spot that moves under
// the flight (a longer description, a resize) is followed, never fought.
function tooltipFold7FlyPx(target) {
  if (fold7TipFlyFrom === null) return target;
  const t = (performance.now() - fold7TipFlyAt) / Math.max(1, FOLD7_TIP_FLY_MS);
  if (t >= 1) { fold7TipFlyFrom = null; return target; }
  return fold7TipFlyFrom + (target - fold7TipFlyFrom) * p9Ease(t);
}
// Self-driven: nothing else repaints the docked frame once the hold's own loop
// has stopped, so the flight owns its frames until it lands.
function tooltipFold7FlyTick() {
  if (fold7TipFlyFrom === null) return;
  tooltipDockMobile(fold8TooltipEl);
  requestAnimationFrame(tooltipFold7FlyTick);
}
function tooltipFold7FlyStart(fromTop) {
  if (!isMobile() || !isFinite(fromTop) || FOLD7_TIP_FLY_MS <= 0) { fold7TipFlyFrom = null; return; }
  fold7TipFlyFrom = fromTop;
  fold7TipFlyAt   = performance.now();
  requestAnimationFrame(tooltipFold7FlyTick);
}
function tooltipFold7FlyCancel() { fold7TipFlyFrom = null; }
var TOOLTIP_DOCK_HOLD_TOP_GAP_PX    = 108;  // holding a TOP dot → gap over the block     (manual/-baked 2026-09-17)
var TOOLTIP_DOCK_HOLD_BOTTOM_GAP_PX = 94;   // holding a BOTTOM dot → gap over the block  (manual/-baked 2026-09-17)
// The 8 sample squares' extent AT REST — centres ± half the resting side, not the
// live boxes: the active square SWELLS (FOLD7_SQUARE_SIZES, up to 20px), so a
// live read made the block breathe and the frame hanging off it move from dot to
// dot. null before layout.
const TOOLTIP_DOCK_SQUARE_REST_PX = 8;   // .fold6-square's resting side (style.css)
function tooltipFold7SquaresRect() {
  if (typeof fold6SquareEls === "undefined") return null;
  const half = TOOLTIP_DOCK_SQUARE_REST_PX / 2;
  let top = Infinity, bottom = -Infinity;
  for (const { sq } of fold6SquareEls) {
    const r = sq.getBoundingClientRect();
    if (!r.height) continue;
    const cy = r.top + r.height / 2;
    top = Math.min(top, cy - half); bottom = Math.max(bottom, cy + half);
  }
  return top === Infinity ? null : { top, bottom };
}
// Is square `i` in the top half of the block? Derived from the offsets, so it
// follows FOLD6_SQUARES_OFFSET rather than hard-coding 0-3.
function tooltipFold7IsTopSquare(i) {
  if (typeof FOLD6_SQUARES_OFFSET === "undefined" || !FOLD6_SQUARES_OFFSET[i]) return true;
  const dys = FOLD6_SQUARES_OFFSET.map(o => o.dy).sort((a, b) => a - b);
  return FOLD6_SQUARES_OFFSET[i].dy <= dys[Math.floor((dys.length - 1) / 2)];
}
// A frame `h` tall on `side` of the squares, `gap` px off them, never above the floor.
function tooltipFold7SpotPx(side, gap, h) {
  const sq = tooltipFold7SquaresRect();
  if (!sq) return null;
  return Math.max(TOOLTIP_DOCK_TOP_MIN_PX, side === "below" ? sq.bottom + gap : sq.top - gap - h);
}
// The reader's spot, held only while a finger is down: further over the block
// than the example's, its gap chosen by which half the held square is in.
// `above` pins the frame's BOTTOM edge (tooltipFold7SpotPx), so a longer
// description extends upward, away from the squares — as at the example's spot.
function tooltipFold7ReaderPx(h) {
  const i = (typeof fold7Hold !== "undefined" && fold7Hold) ? fold7Hold.idx : -1;
  if (i === undefined || i < 0) return null;
  return tooltipFold7SpotPx("above", tooltipFold7IsTopSquare(i)
    ? TOOLTIP_DOCK_HOLD_TOP_GAP_PX : TOOLTIP_DOCK_HOLD_BOTTOM_GAP_PX, h);
}

// The resting spot, bottom-anchored: measured off the LIVE innerHeight rather
// than baked as one number, because the frame is the last thing in the stack
// and a bar-collapse resize moves the edge it hangs from.
function tooltipDockRestPx() {
  // viewportH(), not window.innerHeight — same cached value, refreshed on the
  // same resize (js/core.js). This runs every frame; the live read was 4.1% of
  // the timeline profile on a throttled phone.
  //
  // On every PICKER fold this is one of two spots (p7TipSpotTopPx) — top by
  // default, bottom when the glass comes near it. Only the @fold7 -> @fold8
  // handover still reads the old bottom-anchored line, so its geometry is
  // untouched.
  if (p7TipTwoSpotFold()) {
    return p7TipSpotTopPx(typeof fold8TooltipEl === "undefined" ? null : fold8TooltipEl);
  }
  return viewportH() - TOOLTIP_DOCK_BOTTOM_PX - TOOLTIP_DOCK_H_PX;
}
// The folds the two-spot frame serves: the ones the picker is live on
// (@fold9, @fold10, @fold13). Mobile only — desktop has hover and no docked frame.
function p7TipTwoSpotFold() {
  return isMobile() && typeof currentPage !== "undefined" &&
         (currentPage === 8 || currentPage === 9 || currentPage === 12);
}

// Blends @fold13's drop onto whatever spot the earlier two produced, so the
// three-way lerp stays continuous even if the user scrolls back up mid-drop.
//
// It only runs DURING the step-down now. At d >= 1 the spot function owns the
// position outright — and because @fold13's top spot IS p9DockTopM(), `base` at
// that point is the very number this lerp was heading for, so the hand-over is
// continuous and invisible. Left as a lerp all the way to 1 it pinned the frame
// to p9DockTopM() regardless of the spot, and the flip to the bottom spot simply
// did nothing on that fold.
function tooltipDockDropPx(base) {
  if (typeof p9TooltipDropTrigger === "undefined" || typeof p9DockTopM !== "function") return base;
  const d = p9TooltipDropTrigger.currentT();
  if (d <= 0 || d >= 1) return base;
  return base + (p7TipTopSpotPx() - base) * d;
}

// The @fold7 resting spot, frozen the moment the @fold8→@fold9 fly starts.
// It CANNOT be re-measured live mid-fly: the 8 sample squares it's measured
// against are themselves flying to their real timeline dots on the very same
// trigger, so a live measurement makes the lerp's start point chase the
// moving squares and the frame wobbles along with them instead of gliding
// straight to its dock spot. Re-measured whenever the fly is fully reversed
// (t <= 0), so a resize while resting on @fold7 still tracks the layout.
let tooltipFold6TopFrozen = null;
let tooltipFold6FrozenH   = 0;      // the frame height that spot was solved for

// The @fold7 frame is content-sized (.is-fit — height:auto, no clamp, like the
// desktop tooltip) for as long as it sits at the @fold7 spot: up to the
// handover, where it collapses and the fixed 100px bar takes over at the rest
// spot (whose geometry, TOOLTIP_DOCK_H_PX, assumes that height).
function tooltipFitFold7() {
  if (!isMobile() || typeof fold9FlyTrigger === "undefined") return false;
  return fold9FlyTrigger.currentT() < TOOLTIP_DOCK_HANDOVER;
}

function tooltipDockTopPx(el) {
  const t = typeof fold9FlyTrigger === "undefined" ? 1 : fold9FlyTrigger.currentT();
  if (t >= 1 || typeof fold6SquareEls === "undefined") return tooltipDockDropPx(tooltipDockRestPx());
  // The fit frame's height follows its text (empty before the demo, then the
  // demo's, then whatever square the reader holds): re-solve the spot whenever
  // it changes, or the frame's bottom would run into the squares.
  if (tooltipFold6TopFrozen !== null && el.offsetHeight !== tooltipFold6FrozenH) tooltipFold6TopFrozen = null;
  if (t <= 0 || tooltipFold6TopFrozen === null) {
    // Measured off `sq`, NOT `wrap`: the wrap is a deliberately zero-size anchor
    // (its left/top IS the square's position — same convention as .group-item),
    // so it reports height 0 and any "is this laid out yet" guard against its
    // height rejects all 8. `sq` is the real 8px box.
    // @fold7's spot can never push the frame off the top of the screen: on a
    // short phone the squares may sit high enough that there's no room above
    // them. The floor is its own small constant, NOT the resting spot — the
    // rest is at the bottom of the screen now, and clamping to it would drag
    // every @fold7 frame down there too.
    const spot = tooltipFold7SpotPx(TOOLTIP_DOCK_DEMO_SIDE, TOOLTIP_DOCK_SQUARES_GAP_PX, el.offsetHeight);
    // Nothing laid out yet — no squares to sit against.
    if (spot === null) return tooltipDockDropPx(tooltipDockRestPx());
    tooltipFold6FrozenH   = el.offsetHeight;
    tooltipFold6TopFrozen = spot;
  }
  // NO TRAVEL. The frame used to lerp from its @fold7 spot down to the dock over
  // the fly — it flew. It now COLLAPSES in place at the @fold7 spot over the
  // first half of the beat and the docked bar grows back in at the bottom over
  // the second (tooltipDockHandoverScale), so the position simply SWITCHES at
  // the handover, while the frame is scaled to nothing and nothing is visible
  // to jump. Two strict phases, never blended.
  return tooltipDockDropPx(t < TOOLTIP_DOCK_HANDOVER ? tooltipFold6TopFrozen
                                                     : tooltipDockRestPx());
}

// The collapse/grow that replaces the glide: 1 at rest on @fold7, down to 0 at
// the handover, back to 1 by the end of the fly. Multiplied into the docked
// frame's scale, so the @fold7 example tooltip shuts and the bottom bar opens
// as two separate beats on one element.
const TOOLTIP_DOCK_HANDOVER = 0.5;
// The docked frame's transform, for every writer of it. page7.js's picker sync()
// re-asserts this element's transform on EVERY redraw, so without a shared
// helper it stomped the handover collapse flat — harmless when the frame used to
// arrive full-size off a glide, fatal now that the grow-back IS the arrival.
// Desktop is never scaled here: the handover only exists for the docked layout.
function tooltipDockTransform() {
  const s = isMobile() ? p9Ease(tooltipDockHandoverScale()) : 1;
  return s >= 1 ? "translateX(-50%)" : `translateX(-50%) scale(${s})`;
}
function tooltipDockHandoverScale() {
  if (typeof fold9FlyTrigger === "undefined") return 1;
  // An event IS in the frame — the picker has one open, or @fold7's demo is
  // still running. Full size, whatever the fly is doing.
  if (typeof p7Inspect !== "undefined" && p7Inspect.event) return 1;
  // @fold13 (page 12) is the frame's other home: the picker serves that fold
  // too, and the frame carries its own «לחצו והחזיקו» line there (`.is-hint`,
  // page7.js) — so it is open at rest here, whatever the timeline's fly left
  // behind. The timeline's own collapse below is untouched.
  if (typeof currentPage !== "undefined" && currentPage === 12) return 1;
  const t = fold9FlyTrigger.currentT();
  if (t <= 0) return 1;
  // ...and it does NOT grow back. The frame collapses at its @fold7 spot and
  // STAYS collapsed for the whole of the timeline: there is nothing left for it
  // to say at rest — the «לחצו והחזיקו» line moved out to its own band at the
  // top of the screen (p7HintBandInit, page7.js) — so the old second phase grew
  // an EMPTY frame back in at the bottom of the timeline and left it sitting
  // there. It reappears only when a dot is actually picked, above.
  const H = TOOLTIP_DOCK_HANDOVER;
  return t < H ? 1 - t / H : 0;
}

// Picker collision dodge — @fold7 ONLY now.
//
// While the reader holds a finger on the 8 sample squares the frame sits right
// where the lifted glass would cover it, so it dodges to just BELOW them for the
// length of the hold. A deliberate exception to "position never snaps": the dodge
// serves a live finger, and an animated frame would pass through the very glass
// it is dodging.
//
// Every LATER fold used to have its own dodge here — @fold9 up to the grid's top
// clearance, @fold13 down onto its bottom one. Both are gone: those folds have
// two spots of their own now and FLIP between them (p7TipSpotTopPx), which is the
// same idea done once instead of per fold. `p7TipAvoidActive` is therefore
// written by @fold7's hold and by nothing else — and it is STICKY: the first
// hold turns it on, release leaves it on (the frame stays where the reader's
// hold put it), and only rewinding the demo (fold7HoverReset, js/groups.js)
// turns it off and gives the scripted example its own spot back.
let p7TipAvoidActive = false;

// ── The picker's TWO tooltip spots (mobile) ─────────────────────────────────
// The docked frame has two resting places on every fold the picker serves, and
// flips between them rather than moving: TOP by default, BOTTOM when the glass
// gets close to the top one. A flip, not a glide — the frame would otherwise
// travel through the very glass it is getting out of the way of (the same
// reasoning the older dodge was built on).
//
// They anchor at OPPOSITE edges, which is the point of having two: the top spot
// is pinned by its TOP, so a longer description grows DOWNWARD into the chart;
// the bottom spot is pinned by its BOTTOM, so a longer one grows UPWARD. Either
// way the frame expands away from the edge it is sitting on and never off-screen.
// The bottom spot therefore has to be solved from the LIVE offsetHeight.
//
// All three are `let` for the manual/ harness.
let P7_TIP_TOP_PX    = 72;   // the top spot's TOP edge, px from the top of the screen
let P7_TIP_BOTTOM_PX = 66;    // the bottom spot's BOTTOM edge, px up from the screen bottom
// The switch line: while the glass's top edge is ABOVE this y, the frame sits at
// the BOTTOM. A line on the screen, not a distance from the frame — it is the
// reader's own "am I working up here" boundary, and it is what the harness draws.
let P7_TIP_SWITCH_Y  = 248;
let p7TipAtBottom = false;   // which spot is live right now (written by syncTipAvoid)

// The TOP spot, per fold. @fold13's frame is packed against the pill tray and
// the whole grid below it is measured off that same line (p9ExtremeTopY), so its
// top spot is p9DockTopM() — which is also exactly where the frame already rests
// there today, so adopting the two-spot model changes nothing at rest on that
// fold. @fold9/@fold10 use the tuned P7_TIP_TOP_PX.
//
// p9DockTopM() stays the GRID's anchor and must never learn about p7TipAtBottom:
// the dots would jump every time the frame flipped.
function p7TipTopSpotPx() {
  if (typeof currentPage !== "undefined" && currentPage === 12 &&
      typeof p9DockTopM === "function") return p9DockTopM();
  return P7_TIP_TOP_PX;
}
// The switch LINE, per fold. A fixed y per fold, never a distance from the live
// frame: the frame moves, so measuring against it makes the threshold chase its
// own result and chatter at the boundary. @fold13's frame rests much higher than
// the timeline's, so its line is derived from its own top spot plus the COLLAPSED
// frame height (the same height p9ExtremeTopY reserves) and a margin.
const P7_TIP_SWITCH_MARGIN_PX = 24;
function p7TipSwitchY() {
  if (typeof currentPage !== "undefined" && currentPage === 12) {
    return p7TipTopSpotPx() + TOOLTIP_DOCK_H_PX + P7_TIP_SWITCH_MARGIN_PX;
  }
  return P7_TIP_SWITCH_Y;
}

// The spot, resolved. `el` is needed for the bottom anchor's height.
function p7TipSpotTopPx(el) {
  const H = viewportH();
  if (!p7TipAtBottom) return p7TipTopSpotPx();
  const h = (el && el.offsetHeight) || TOOLTIP_DOCK_H_PX;
  return H - P7_TIP_BOTTOM_PX - h;
}

function tooltipAvoidPx(el, top) {
  if (!p7TipAvoidActive) return top;
  // @fold7 (the reader's own hold on the 8 squares, js/groups.js): the example's
  // spot sits close over the squares, where the glass lifted above the finger
  // would cover it, so FOR THE LENGTH OF THE HOLD the frame moves further up
  // (tooltipFold7ReaderPx) and snaps back on release — p7TipAvoidActive is that
  // hold. Only while the frame is still at its @fold7 spot: past the handover
  // the squares are flying and the frame belongs to the bottom bar.
  if (tooltipFitFold7()) {
    const spot = tooltipFold7ReaderPx(el.offsetHeight);
    if (spot !== null) return spot;
  }
  // Every later fold: nothing to dodge. They have two spots of their own and FLIP
  // between them on the switch line, resolved in tooltipDockRestPx before this
  // ever runs. **Removed — don't reintroduce:** @fold13's dodge-down onto the
  // grid's bottom clearance (P7_TIP_AVOID_DROP_PX, 32), which fought the flip.
  return top;
}

function tooltipDockMobile(el) {
  const docked = isMobile();
  el.classList.toggle("is-docked", docked);
  // Before the spot is solved: the fit frame's height is what it subtracts.
  const fit = docked && tooltipFitFold7();
  el.classList.toggle("is-fit", fit);
  // IN FRONT OF THE TITLE BLOCK, not under it: every @fold7 frame (they all open
  // upward, so a long description grows toward that card), and the docked frame
  // on @fold10/@fold11, whose cards scroll over the pinned timeline. style.css
  // gives those cards 1004/1005, deliberately above the frame's usual 1000, so
  // the class out-stacks them.
  const overCard = docked && (fit
    || (typeof currentPage !== "undefined" && (currentPage === 9 || currentPage === 10)));
  el.classList.toggle("is-over-card", overCard);
  if (docked) {
    // Horizontal centering is the transform's job, so whatever the floating
    // layout wrote into `left` has to be cleared or it would shove the frame
    // off its spot. `top` is owned outright by tooltipDockTopPx above.
    el.style.left = "";
    // …and, on the way back from a hold, the flight between the two @fold7 spots.
    el.style.top = `${tooltipFold7FlyPx(tooltipAvoidPx(el, tooltipDockTopPx(el)))}px`;
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
  let sqRect = sq.getBoundingClientRect();
  // A @fold7 hover: anchor to the square's FINAL swollen size around its
  // centre, so the callout sits still while the swell animates.
  if (fold7HoverIdx !== null && fold9FlyTrigger.currentRaw() <= 0) {
    const cx = (sqRect.left + sqRect.right) / 2, cy = (sqRect.top + sqRect.bottom) / 2;
    const h = FOLD7_SQUARE_SIZES[fold7HoverIdx] / 2;
    sqRect = { left: cx - h, right: cx + h, top: cy - h, bottom: cy + h };
  }
  // Measured off the square's EDGES, not its centre: the demo square swells on
  // @fold7 (FOLD8_DEMO_GROW_PX) and a centre-anchored offset would let the box
  // eat into it as it grows. Edge-anchored, the gap is the same 5px at every
  // size — which is also what the 8px resting dot always wanted.
  const TOOLTIP_GAP = 5;
  // Hangs toward the dot's camp side (fold8TooltipSide, set by updateGroups).
  const rawLeft = fold8TooltipSide === "right"
    ? sqRect.right + TOOLTIP_GAP
    : sqRect.left - TOOLTIP_GAP - fold8TooltipEl.offsetWidth;
  const left = Math.max(8, Math.min(rawLeft, window.innerWidth - fold8TooltipEl.offsetWidth - 8));
  // Position lerps continuously between the two hangs (house rule: position
  // never snaps); the pointer CORNER is a secondary attribute, so it may snap,
  // and does — at the halfway point, where the box straddles the dot anyway.
  const downT   = fold8FlyMoveT;
  const upTop   = sqRect.top - TOOLTIP_GAP - fold8TooltipEl.offsetHeight;
  const downTop = sqRect.bottom + TOOLTIP_GAP;
  const top = Math.max(upTop + (downTop - upTop) * downT, 8);
  const flipped = downT >= 0.5;
  fold8TooltipEl.classList.toggle("is-flipped", flipped);
  // The grow-in scales from the pointer corner, which moves with the flip.
  // Skipped while docked — that branch returned above — so this only ever
  // overrides the "bottom right" updateGroups wrote for the floating callout.
  const corner = fold8TooltipSide === "right" ? "left" : "right";
  fold8TooltipEl.style.transformOrigin = (flipped ? "top " : "bottom ") + corner;
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
  const total = fold8SeqDelayMs + FOLD8_GROW_MS + totalChars * FOLD8_TYPE_MS_PER_CHAR;
  fold8SeqElapsed = Math.max(0, Math.min(total, fold8SeqElapsed + fold8SeqDirection * dt));

  const shrinkT = fold9TooltipShrinkTrigger.currentT();
  // The delay is dead time at the head of the sequence: the box stays at scale
  // 0 through it, so the tooltip and the swell can start apart while sharing
  // one crossing. Subtracting it here (rather than shifting fold8SeqElapsed)
  // keeps the reverse direction symmetric for free.
  const seqT = fold8SeqElapsed - fold8SeqDelayMs;
  const growT = Math.max(0, Math.min(1, seqT / FOLD8_GROW_MS));
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
    // × the handover collapse: the frame shuts at its @fold7 spot and reopens at
    // the dock rather than flying between the two (tooltipDockHandoverScale).
    const g = fold8TooltipGrowEase(growT) * p9Ease(tooltipDockHandoverScale());
    fold8TooltipEl.style.transform = `translateX(-50%) scale(${g})`;
    // NOT multiplied by (1 - shrinkT), unlike the desktop scale below: when
    // the square lands on its real dot the docked frame does not leave. It
    // stays put, EMPTY — the text inside fades out (the shrinkRaw-driven
    // textOpacity further down) while the frame itself holds its spot, ready
    // for the next selection. Only reversing the whole fold back to elapsed 0
    // fades the frame itself, through growT.
    // × (1 - fold13OutT): the sequence rAF keeps running while @fold14's
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
    const shown = Math.min(totalChars, Math.floor((seqT - FOLD8_GROW_MS) / FOLD8_TYPE_MS_PER_CHAR));
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
  fold8TooltipEl.style.removeProperty("--tip-fill");
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

// Bespoke back-out curve for the fold-8 tooltip's grow-in (this file
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

