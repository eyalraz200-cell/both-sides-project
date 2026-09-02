// ── Scrollytelling: which text section is active drives the pinned canvas ──
const sections = Array.from(document.querySelectorAll(".text-section"));

function setActivePage(page) {
  if (page === currentPage) return;
  // Scrolling back out of the timeline toward a fold that doesn't draw the
  // per-event squares at all (anything before drawFold7, i.e. currentPage < 5)
  // — wipe all per-month animation state so the next entry replays from
  // scratch instead of showing the previously-settled dots hanging around.
  //
  // Deliberately NOT on the 7 -> 6 crossing. drawFold9/drawFold7 (js/core.js)
  // keep drawing and retreating the squares while p7RealTimelineReached, so the
  // reverse cascade is *supposed* to play out across that boundary; wiping here
  // made every dot vanish in one frame the instant the IntersectionObserver
  // crossed. Those two draw functions run the wipe themselves once the retreat
  // has actually finished.
  if (currentPage >= 5 && page < 5) p7ResetForReplay();

  // Continuing into page9 (fold12) while page8's own timeline->legit-grid
  // glide (p8CurrentT, page8.js) hasn't actually finished yet — the
  // IntersectionObserver driving this can cross into page9's slot before
  // that glide reaches t=1. drawPage9 has no notion of that glide's
  // progress on its own, so without seeding p9.anim here the dots would
  // snap straight to their final legit position the instant page9 takes
  // over drawing instead of page8 — see p8CaptureBlendedPositions' own
  // comment (page8.js) for the full rationale.
  //
  // The continuation is seeded from the glide's *start* positions (t=0) with a
  // back-dated `start`, NOT from the current blended position with the
  // remaining duration. p9PlaceDot re-applies p9Ease to whatever window it's
  // given, so the latter eased an already-eased slice: velocity dropped to
  // exactly zero at the handoff (sine-in-out starts at rest) and the path
  // deviated up to ~15% of total travel before catching up at the end. Because
  // the IntersectionObserver that fires this handoff crosses at a
  // *scroll-dependent* moment, that showed up as the glide stuttering and
  // landing differently depending on whether the user kept scrolling through
  // it. Replaying the same global 0..1 clock makes the handoff invisible.
  if (currentPage === 8 && page === 9 && typeof p8CurrentT === "function" && p8Engaged && p8CurrentT() < 1) {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    p9.anim = {
      from: p8CaptureBlendedPositions(W, H, 0),
      start: performance.now() - P8_TRANSITION_DURATION * p8CurrentT(),
      duration: P8_TRANSITION_DURATION,
      plainGlide: true, // see p9PlaceDot (page9.js) — keeps this at page8's own pace, no tier stagger
      // The glide's starting SQUARE SIZE too, not just its positions: page8
      // shrinks the dots across the flight and drawPage9 has to keep doing so,
      // or the dots snap small at the handoff and the flight looks dimmer.
      // p8CaptureBlendedPositions above has just run p7UpdateLayout, so p7.SQ
      // is this viewport's real timeline size.
      fromSQ: p7.SQ,
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
    // Same back-dating as the forward handoff above, mirrored: this direction
    // runs t: p8CurrentT() -> 0 and its target IS the timeline layout, so the
    // "from" is the glide's other endpoint (t=1) and the elapsed time is
    // (1 - p8CurrentT()) of a full traverse. p9Ease is symmetric
    // (p9Ease(1-x) === 1 - p9Ease(x)), so that reproduces the glide's own curve
    // exactly, with no dead stop at the handoff. This direction continues the
    // REVERSE glide, so it replays the reverse's own (shorter) clock —
    // P8_REVERSE_DURATION, not the forward's 3000ms.
    p7EntryAnim = {
      from: p8CaptureBlendedPositions(W, H, 1),
      start: performance.now() - P8_REVERSE_DURATION * (1 - p8CurrentT()),
      duration: P8_REVERSE_DURATION,
    };
  }

  currentPage = page;
  updateGroups();
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

