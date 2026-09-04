// ── Page 8 holds page7's final layout until its title actually reaches the
// viewport's vertical center — not just whenever currentPage flips to 10, which
// (via the -50% IntersectionObserver above) can fire slightly before the title
// has visually settled there. That crossing triggers p8Trigger (page8.js), which
// plays a fixed-duration glide toward page9's starting layout entirely on its
// own clock — scrolling is never blocked, so the title is free to keep scrolling
// past while the glide plays in the background. Scrolling back up past that same
// point plays the glide back in reverse via
// p8TriggerReverse, once currentPage has made it back to 9. ──
const page8TitleEl = document.querySelector("#page-9 .section-title");
let page8Ticking = false;

// Tracks the title's own crossing state (same isPast pattern as
// watchCardThreshold above) instead of re-checking "is the title currently
// past the threshold" on every tick. That static re-check was the bug: once a
// reverse glide finished (p8Engaged flips back to false, p8RunAnimLoop in
// page8.js), the very next scroll tick would see the title still sitting past
// the threshold (scrolling up doesn't un-cross it instantly) and immediately
// re-fire p8Trigger — which a following tick's scrollY-based reverse check
// would then immediately undo again, thrashing forward/reverse every couple
// of scroll events for as long as the title lingered near the threshold.
// Crossing-based detection only fires once per actual direction change.
let page8TitleWasPast = null;

function page8CheckScroll() {
  const rect = page8TitleEl.getBoundingClientRect();
  const nowPast = rect.top + rect.height / 2 <= window.innerHeight / 2;
  // Mobile only: @fold11's pill band lands where the docked tooltip frame has
  // been sitting, so the frame steps down to p9DockTopM() (page9.js) to clear
  // it. That drop rides @fold10's own crossing rather than @fold11's stick, so
  // the frame is already out of the way by the time the band slides in — one
  // move at a time instead of two at once. Set unconditionally (not just on a
  // crossing) so it also resolves on the first tick and stays latched while
  // scrolled past; trigger() early-returns when already at rest at the target,
  // so calling it every tick is free.
  if (typeof p9TooltipDropTrigger !== "undefined") {
    p9TooltipDropTrigger.trigger(nowPast && isMobile() ? 1 : 0);
  }
  if (page8TitleWasPast === null) {
    page8TitleWasPast = nowPast;
    if (nowPast) p8Trigger();
    return;
  }
  if (nowPast !== page8TitleWasPast) {
    page8TitleWasPast = nowPast;
    if (nowPast) p8Trigger();
    else p8TriggerReverse();
  }
}

window.addEventListener("scroll", () => {
  if (page8Ticking) return;
  page8Ticking = true;
  requestAnimationFrame(() => { page8CheckScroll(); page8Ticking = false; });
}, { passive: true });

// ── Page 9's title (.page9-title-row) is a normal-flow, continuously-scrolling
// card like every other fold's — no JS positioning of its own. It drives two
// *separate* things, deliberately on two different conditions, not one shared
// trigger:
//  - The canvas-drawn divider line (p9TriggerLine) starts growing in once the
//    title card's own top crosses viewport-center — same frac-0.5 convention
//    every other fold's title-driven animation uses (briefly moved to 2/3,
//    reverted back to center per a later explicit request). Safe to fire
//    this early: the canvas is a full-viewport fixed overlay, not a
//    scrolling DOM node, so there's no "still scrolling" artifact to worry
//    about.
const page9TitleCardEl  = document.querySelector("#page-10 .text-card");
const page9TitleRowEl   = document.querySelector("#page-10 .page9-title-row");
const page9StickyEl     = document.querySelector("#page-10 .page9-sticky");
const page9TrayEl       = document.querySelector("#page-10 .page9-tray");
const page9HeaderEl     = document.querySelector("#page-10 .page9-header");
const page9ZoneWrapEl   = document.querySelector("#page-10 .page9-zone-wrap-extreme");
let page9Ticking = false;
let page9LinePast = false; // previous "title past center" state, so the line trigger only fires on the transition
let page9WasStuck = false; // tracks isStuck across frames to detect the stuck→unstuck transition
// Categories dropped into the extreme zone at the moment the user last
// scrolled up out of @fold11 — captured in #page9ZoneAbove's own DOM order
// (most-recently-dropped first) right before p9ResetDrops clears it, so
// p9RestoreDrops can put the exact same pills/dots back if they scroll back
// down into @fold11, rather than that choice being lost for the rest of the
// session the instant they scroll away.
let page9SavedAboveIdxs = null;

// @fold11's title block is an ordinary centered card while it scrolls up, and
// only travels to the right edge once it pins at the top (mobile only — desktop
// stays centered throughout). CSS can't animate that trip on its own: the flush
// is `margin-inline: 0 auto` and `auto` doesn't interpolate, so the box would
// snap sideways the frame the class lands. Instead the frame stays centered and
// .is-stuck applies translateX(--p9-title-flush), measured here.
//
// The distance is half the slack between the card and the frame's own
// zero-padding width — the frame is `width: fit-content`, so that width depends
// on how the title happened to wrap at this viewport.
//
// Measured ONLY while unstuck, for two reasons: the value is needed *before*
// the class lands, and the padding is mid-transition for 0.35s after it does,
// which would drift the number. Subtracting the live computed padding (rather
// than a hard-coded 29) makes the reading self-consistent at any point of that
// transition anyway, so a reverse crossing can't poison the cache either.
function page9UpdateTitleFlush(isStuck) {
  if (!isMobile()) { page9TitleCardEl.style.removeProperty("--p9-title-flush"); return; }
  if (isStuck) return;
  const frame = page9TitleCardEl.querySelector(".text-card-frame");
  if (!frame) return;
  const padX = parseFloat(getComputedStyle(frame).paddingInlineStart) || 0;
  const flushW = frame.offsetWidth - padX * 2;
  const shift = Math.max(0, (page9TitleCardEl.clientWidth - flushW) / 2);
  page9TitleCardEl.style.setProperty("--p9-title-flush", `${shift}px`);
}

function page9UpdateFromScroll() {
  // Use the title *row* container's position rather than the card's own
  // getBoundingClientRect() — once the card switches to position:fixed its
  // top is permanently the fixed value and can never signal a scroll-back.
  const titleRowTop = page9TitleRowEl.getBoundingClientRect().top;

  // Card's natural center = titleRowTop + 50vh; crosses viewport center when
  // titleRowTop <= 0.
  const titlePastCenter = titleRowTop <= 0;
  if (titlePastCenter !== page9LinePast) {
    page9LinePast = titlePastCenter;
    p9TriggerLine(titlePastCenter ? 1 : 0);
  }

  // Card's natural (un-pinned) top = row top + (rowH - cardH)/2 — the flex
  // centering inside the 100vh row, computed from the row's own measured box.
  // Sticks when that value reaches --card-top, the resting offset the CSS
  // actually pins it at. Read from the variable rather than hard-coded, because
  // that offset differs per breakpoint (mobile pushes it down to clear the מקרא
  // bar) and a threshold out of step with it makes the card jump as it sticks.
  // Do NOT approximate the centering as window.innerHeight * 0.5: innerHeight
  // is the *visual* viewport, while the row is 100vh (the large viewport). On
  // mobile the two disagree by the browser-bar height exactly when the bars are
  // showing — i.e. while scrolling UP — which released .is-stuck ~100px before
  // CSS sticky let go of the card, leaving the white-filled dashed frame pinned
  // at the top of @fold11 in its un-stuck styling.
  const cardTopPx = parseFloat(getComputedStyle(page9TitleCardEl).top) || 0;
  const rowRect = page9TitleRowEl.getBoundingClientRect();
  const naturalTop = rowRect.top + (rowRect.height - page9TitleCardEl.offsetHeight) / 2;
  const isStuck = naturalTop <= cardTopPx;
  page9UpdateTitleFlush(isStuck);
  page9TitleCardEl.classList.toggle("is-stuck", isStuck);
  // Both tray and zone-wrap are position:fixed — always at their final viewport
  // position — so both can fire together the moment the title card sticks.
  page9StickyEl.classList.toggle("engaged", isStuck);
  // (The mobile docked-tooltip drop that clears room for the tray band is NOT
  // fired here — it rides @fold10's title crossing in page8CheckScroll above.)

  // Scrolling back up past the stick threshold: animate all extreme dots back
  // down to the legit zone and return pills to the tray — but remember which
  // categories were dropped first, so scrolling back down can restore them
  // (see page9SavedAboveIdxs above) instead of this being a permanent reset.
  if (page9WasStuck && !isStuck && typeof p9ResetDrops === "function") {
    // p9DroppedIdxs (page9.js) reads whichever record this breakpoint keeps —
    // #page9ZoneAbove's DOM order on desktop, the .is-extreme flag on mobile,
    // where tapped pills never leave the tray.
    const droppedIdxs = typeof p9DroppedIdxs === "function" ? p9DroppedIdxs() : [];
    page9SavedAboveIdxs = droppedIdxs.length ? droppedIdxs : null;
    p9ResetDrops(true);
  } else if (!page9WasStuck && isStuck && page9SavedAboveIdxs && typeof p9RestoreDrops === "function") {
    // Scrolling back down into @fold11 — replay the saved drops.
    p9RestoreDrops(page9SavedAboveIdxs);
    page9SavedAboveIdxs = null;
  }
  page9WasStuck = isStuck;
}

window.addEventListener("scroll", () => {
  if (page9Ticking) return;
  page9Ticking = true;
  // updateFold13's scroll-linked half (eScroll/fold13ScrollT) needs a fresh
  // read on every scroll tick, not just once via fold13Trigger's own firing —
  // see that function's own comment. updateFold13 is a plain function
  // declaration (hoisted), so it's callable here regardless of textual order.
  requestAnimationFrame(() => { page9UpdateFromScroll(); updateFold13(); page9Ticking = false; });
}, { passive: true });

