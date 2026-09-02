// page8.js — bridge between page7's timeline and page9's extreme/legit grid.
// Holds at page7's final (maxDate) layout until this section's title actually
// reaches the viewport's vertical center (see page8CheckScroll in main.js, which
// calls p8Trigger here) — at which point every dot glides, on its own clock and
// not tied to further scrolling, toward the position it'll occupy on page9: the
// legit grid, since nothing has been classified as "extreme" yet (see
// p9LegitGeometry/p9LegitPosOf in page9.js, the shared source of truth for that
// target layout). Scrolling is never blocked — the title is free to scroll past
// as normal while the glide plays out on its own clock in the background.
// Scrolling back up past the original trigger point plays the same glide in
// reverse (see p8TriggerReverse), the same interruptible-cascade pattern
// page7.js uses for its month-by-month reveal.
const P8_TRANSITION_DURATION = 3000; // ms — playback time of a full 0->1 traverse
let p8Engaged       = false; // true from the forward trigger until fully reversed back to rest
let p8PhaseStart    = null;  // performance.now() when the current phase (forward/reverse) began
let p8PhaseFromT    = 0;     // t value the current phase started from
let p8PhaseToT      = 0;     // t value the current phase is heading toward (1 forward, 0 reverse)

// Current eased-progress value, mid-phase or at rest. Speed is constant (full
// 0..1 takes P8_TRANSITION_DURATION) regardless of where a phase starts from, so
// reversing mid-flight covers only the remaining distance — same logic as page7's
// month cascade, which mirrors its order on reverse rather than restarting cold.
function p8CurrentT() {
  if (p8PhaseStart === null) return p8PhaseFromT;
  const span = p8PhaseToT - p8PhaseFromT;
  if (span === 0) return p8PhaseToT;
  const localT = Math.min(1, (performance.now() - p8PhaseStart) / (P8_TRANSITION_DURATION * Math.abs(span)));
  return p8PhaseFromT + span * localT;
}

function p8RunAnimLoop() {
  if (p8PhaseStart === null) return;
  if (currentPage === 8) draw();
  if (p8CurrentT() !== p8PhaseToT) {
    requestAnimationFrame(p8RunAnimLoop);
  } else {
    p8PhaseFromT = p8PhaseToT; // settle here — p8CurrentT() reads this once phaseStart is null
    p8PhaseStart = null;
    if (p8PhaseToT === 0) p8Engaged = false; // back at rest — forward can fire again later
    if (currentPage === 8) draw(); // final frame, locked at rest
  }
}

function p8StartPhase(toT) {
  p8PhaseFromT = p8CurrentT();
  p8PhaseToT   = toT;
  p8PhaseStart = performance.now();
  p8RunAnimLoop();
}

// Called once, the instant the title crosses the viewport's vertical center
// (see page8CheckScroll in main.js — tracks the crossing itself, not just a
// static position check, so this can't refire while already engaged).
// Idempotent — safe to call again.
function p8Trigger() {
  if (p8Engaged) return;
  p8Engaged        = true;
  p8StartPhase(1);
}

// Called once the title's crossing (see page8CheckScroll in main.js) reverses
// back below the threshold — plays the glide back toward page7's layout.
function p8TriggerReverse() {
  if (!p8Engaged) return;
  p8StartPhase(0);
}

function drawPage8(ctx, W, H) {
  if (!p7.ready) {
    drawBackground(ctx, W, H);
    return;
  }

  // Deliberately no fallback trigger here: currentPage flips to 9 (via the -50%
  // IntersectionObserver in main.js) well before the title visually reaches
  // center, since page-8 already overlaps the screen-center line earlier than
  // that. Triggering on that flip would fire too early — page8CheckScroll
  // (main.js) is the only thing that calls p8Trigger/p8TriggerReverse, exactly
  // when the title crosses center (or scroll retreats back past that point).
  const t = p8CurrentT();
  if (t <= 0) {
    const saved = p7.currentDate;
    p7.currentDate = p7.maxDate;
    drawPage7(ctx, W, H);
    p7.currentDate = saved;
    return;
  }

  const ease = p9Ease(t);

  drawBackground(ctx, W, H);

  p7UpdateLayout(W, H);
  p9EnsureIndex();
  const legitGeom = p9LegitGeometry(W, H);

  const { CELL, SQ, cols, leftX0 } = p7;
  const topY    = Math.round(H * sbbTimeline(H).top);
  const rightX0 = p7GridGeometry(W, H).rightX0;

  function blendAndDraw(events, indexOf, side, positions, x0) {
    events.forEach((e, i) => {
      const cell = positions[i];
      const col  = cell % cols;
      const row  = Math.floor(cell / cols);
      const fromX = x0 + col * CELL;
      const fromY = topY + row * CELL;

      const target = p9LegitPosOf(e, indexOf, side, legitGeom);
      if (!target) return;

      const x = fromX + (target.x - fromX) * ease;
      const y = fromY + (target.y - fromY) * ease;
      // Shrink each dot from the (now enlarged) real-timeline square size (p7.SQ)
      // down to page9's legit-grid size (P9_SQ) across the glide, so the dots
      // visibly get smaller on the way into @fold11 and land at exactly the size
      // drawPage9 will keep drawing them — no size jump at the handoff. Both
      // endpoints are top-left anchored (fromX/Y and target.x/y are cell corners),
      // so a plain linear size lerp lines up at both ends.
      // In a bar layout (mobile) the legit grid draws its dots
      // at the bar's own cell size, not P9_SQ — land on that instead, or the
      // dots pop a pixel at the handoff.
      const endSQ  = legitGeom.mode === "bar" ? legitGeom.cell : p9Metrics().legitSq;
      const drawSQ = SQ + (endSQ - SQ) * ease;
      // No opacity fade — drawPage9 draws the legit grid at full opacity (see the
      // comment above its own drawBandedCols/drawJumbledBot calls; it used to be a
      // deliberate 0.12 de-emphasis, which this glide matched, but Figma's actual
      // reference doesn't show that dimming, so it was dropped). Glide only moves
      // position now, so there's no fade-to-faint here for fold11's draw to "pop" out of.
      ctx.fillStyle = p7ActorColor(e.actor);
      ctx.fillRect(x, y, drawSQ, drawSQ);
    });
  }

  // Once the glide has fully landed on a bar layout (mobile), stop drawing
  // dot-by-dot: thousands of 1px dots at fractionally-lerped positions leave
  // ragged colour seams the moment motion stops masking them, and this
  // function keeps drawing at t=1 until @fold10's own drawPage9 takes over.
  // Same solid-rect pass drawPage9's at-rest bar uses (p9DrawBarRects,
  // page9.js), so the handoff is pixel-identical.
  if (ease >= 1 && legitGeom.mode === "bar") {
    p9DrawBarRects(ctx, legitGeom, H, 1);
  } else {
    blendAndDraw(p7.leftEvents,  p9.leftIndexOf,  "left",  p7.leftPos,  leftX0);
    blendAndDraw(p7.rightEvents, p9.rightIndexOf, "right", p7.rightPos, rightX0);
  }

  // The year axis undraws in reverse of its build-in wipe (quick, 500ms —
  // p7AxisReverseOut/P7_AXIS_OUTRO_DURATION in page7.js) as this glide starts,
  // instead of vanishing with the timeline frame. Once the reverse wipe hits 0
  // this returns false and the axis stops being drawn; scrolling back to t<=0
  // hands drawing back to drawPage7, whose p7AxisTriggerIfNeeded replays the
  // build-in.
  if (p7AxisReverseOut()) {
    const saved = p7.currentDate;
    p7.currentDate = p7.maxDate;   // same forcing as the t<=0 branch above
    p7DrawYearAxis(ctx, W, H);
    p7.currentDate = saved;
  }
}

// Called once, right when currentPage flips from 10 to 11 while this glide is
// still mid-flight (see setActivePage in main.js) — the section-level
// IntersectionObserver driving currentPage can cross into page9's slot before
// p8CurrentT() actually reaches 1, and drawPage9 has no notion of this
// glide's progress on its own, so without capturing it here the dots would
// otherwise jump straight to their final legit-grid position the instant
// page9 starts drawing instead of this section. Reuses page9's own p9.anim
// entrance mechanism (the same shape p9.js seeds for its other "animate from
// wherever these dots currently are" entrances) — just seeded once here with
// this glide's current on-screen (blended) position as the "from", identical
// math to blendAndDraw above.
// `tOverride` asks for the positions the glide would have at some *other* t
// than right now — the handoffs in setActivePage (js/nav.js) pass the glide's
// own endpoint (0 or 1) and back-date the animation's `start` instead of
// capturing the current blend, so the continuation replays this exact curve
// rather than re-easing a fresh 0..1 on top of an already-eased position. See
// that call site for why that distinction is load-bearing.
function p8CaptureBlendedPositions(W, H, tOverride) {
  const ease = p9Ease(tOverride === undefined ? p8CurrentT() : tOverride);

  p7UpdateLayout(W, H);
  p9EnsureIndex();
  const legitGeom = p9LegitGeometry(W, H);

  const { CELL, cols, leftX0 } = p7;
  const topY    = Math.round(H * sbbTimeline(H).top);
  const rightX0 = p7GridGeometry(W, H).rightX0;

  const out = new Map();
  function capture(events, indexOf, side, positions, x0) {
    events.forEach((e, i) => {
      const cell = positions[i];
      const col  = cell % cols;
      const row  = Math.floor(cell / cols);
      const fromX = x0 + col * CELL;
      const fromY = topY + row * CELL;

      const target = p9LegitPosOf(e, indexOf, side, legitGeom);
      if (!target) return;

      out.set(e, {
        x: fromX + (target.x - fromX) * ease,
        y: fromY + (target.y - fromY) * ease,
        alpha: 1,
      });
    });
  }
  capture(p7.leftEvents,  p9.leftIndexOf,  "left",  p7.leftPos,  leftX0);
  capture(p7.rightEvents, p9.rightIndexOf, "right", p7.rightPos, rightX0);
  return out;
}
