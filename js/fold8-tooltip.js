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

