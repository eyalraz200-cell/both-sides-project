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
let p8TriggerScrollY = null; // window.scrollY recorded at the forward trigger — scrolling back
                              // above this is what fires the reverse (see page8CheckScroll)

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
  if (currentPage === 9) draw();
  if (p8CurrentT() !== p8PhaseToT) {
    requestAnimationFrame(p8RunAnimLoop);
  } else {
    p8PhaseFromT = p8PhaseToT; // settle here — p8CurrentT() reads this once phaseStart is null
    p8PhaseStart = null;
    if (p8PhaseToT === 0) p8Engaged = false; // back at rest — forward can fire again later
    if (currentPage === 9) draw(); // final frame, locked at rest
  }
}

function p8StartPhase(toT) {
  p8PhaseFromT = p8CurrentT();
  p8PhaseToT   = toT;
  p8PhaseStart = performance.now();
  p8RunAnimLoop();
}

// Called once, the instant the title crosses the viewport's vertical center
// (see page8CheckScroll in main.js). Idempotent — safe to call again.
function p8Trigger() {
  if (p8Engaged) return;
  p8Engaged        = true;
  p8TriggerScrollY = window.scrollY;
  p8StartPhase(1);
}

// Called once scrolling back up has carried scrollY above p8TriggerScrollY again
// (see page8CheckScroll in main.js) — plays the glide back toward page7's layout.
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
  // center, since page-9 already overlaps the screen-center line earlier than
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
  const topY    = Math.round(H * SBB_TIMELINE.top);
  const rightX0 = W / 2 + CENTER_GAP / 2;

  function blendAndDraw(events, indexOf, offset, positions, x0) {
    events.forEach((e, i) => {
      const cell = positions[i];
      const col  = cell % cols;
      const row  = Math.floor(cell / cols);
      const fromX = x0 + col * CELL;
      const fromY = topY + row * CELL;

      const target = p9LegitPosOf(e, indexOf, offset, legitGeom);
      if (!target) return;

      const x = fromX + (target.x - fromX) * ease;
      const y = fromY + (target.y - fromY) * ease;
      // Fades to 0.12 alongside the move — matching drawPage9's fixed opacity for
      // the legit grid, so there's no opacity "pop" the instant currentPage flips.
      ctx.globalAlpha = 1 + (0.12 - 1) * ease;
      ctx.fillStyle = P7_COLORS[e.actor] || "#888";
      ctx.fillRect(x, y, SQ, SQ);
      ctx.globalAlpha = 1;
    });
  }

  blendAndDraw(p7.leftEvents,  p9.leftIndexOf,  0,                     p7.leftPos,  leftX0);
  blendAndDraw(p7.rightEvents, p9.rightIndexOf, p7.leftEvents.length,  p7.rightPos, rightX0);
}
