// page7.js — scroll-driven event timeline
// ── Appearance controls ──────────────────
// Square size/gap were originally matched to page9.js (P9_SQ 3 / P9_GAP 1) since
// page7 and page9 will later be cross-animated. This revision deliberately makes
// the timeline dots BIGGER and their GAPS BIGGER — the grid auto-fits the same
// box (cols/rows = floor(box / P7_CELL) in p7GridGeometry), so the box
// boundaries (SBB_TIMELINE/leftX0) are unchanged; only the dot count drops.
// NOTE: page9 still uses 3/1, so the two no longer agree — reconcile before any
// page7↔page9 cross-animation. Placement builds outward from the center gap
// (see p7OrderFromCenter), not page9's column-major grid.
const P7_SQ  = 3.5;  // square size in px (was 3)
const P7_GAP = 1.5;  // gap between squares in px (was 1)
const P7_CELL = P7_SQ + P7_GAP; // grid cell size
// ─────────────────────────────────────────

// Shared left-grid geometry — leftX0 is rounded (not raw W*SBB_TIMELINE.left) because that raw
// float can land just under a whole px (e.g. 392.00000000000006 on some widths), which
// previously made Math.floor(sideW/CELL) silently drop a whole column and leave the
// grid's near-center edge a few px further from center than intended.
function p7GridGeometry(W, H) {
  const leftX0 = Math.round(W * SBB_TIMELINE.left);
  const sideW  = W / 2 - CENTER_GAP / 2 - leftX0;
  const cols   = Math.floor(sideW / P7_CELL);
  return { leftX0, cols, CELL: P7_CELL };
}

// Looks up an event's color via GROUPS (main.js) rather than a separate
// hardcoded palette, by events.json's actor string — the same join key
// stored on GROUPS' 5 camp entries as `actor` — so every real per-event
// square (here, page8.js's transition glide, and page9.js's grids) always
// matches the legend's current color, including after a future edit to
// GROUPS. main.js loads after this file, but GROUPS only needs to exist by
// the time a square is actually drawn, long after all scripts have run.
function p7ActorColor(actor) {
  const group = GROUPS.find(g => g.actor === actor);
  return (group && group.color) || "#888";
}

// events.json stores dates as YYYY-MM-DD; both the per-event hover tooltip
// (page7.js/page9.js) and the axis event labels below display them as
// DD.MM.YYYY instead.
function p7FormatDateDMY(dateStr, sep = "-") {
  const [y, m, d] = dateStr.split('-');
  return `${d}${sep}${m}${sep}${y}`;
}

const p7 = {
  ready: false,
  leftEvents:  [],
  rightEvents: [],
  currentDate: "",
  minDate: "",
  maxDate: "",
  leftPos:  [],
  rightPos: [],
  CELL: 6, SQ: 4,
  cols: 0,
  lastW: 0, lastH: 0,
  // Per-event {x,y,alpha} from the most recently drawn frame (page9.js's
  // p9.lastPositions pattern) — built fresh in drawPage7 every frame, read by
  // p7HoverInit below to hit-test the mouse against the real timeline's
  // squares. x/y is each square's settled grid-cell position (not its
  // mid-animation blended position — same "store the target, not the
  // transient" convention p9PlaceDot uses), so hit-testing stays stable
  // while a square is still popping in/out.
  lastPositions: new Map(),
  // The event currently under the pointer in #page-7 (set by p7HoverInit's
  // onMove), or null — read by p7DrawSideSquares to dim every other square
  // while one is hovered.
  hoveredEvent: null,
  // Per-axis-event {x,y,radius} (CSS px) of the persistent circle markers drawn
  // on the year axis this frame — built by p7DrawAxisEvents, read by p7HoverInit
  // to hit-test the pointer against those circles. Only reached events (whose
  // circle is actually on the axis) get an entry.
  axisEventPositions: new Map(),
  // The axis event (an entry of P7_AXIS_EVENTS) whose persistent circle is under
  // the pointer, or null — forces that event's headline label + date to re-show
  // at full opacity even after it has crossfaded away. Distinct from
  // hoveredEvent above, which tracks the timeline squares, not axis circles.
  hoveredAxisEvent: null,
};

// Park-Miller seeded RNG
function p7Rng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; };
}

function p7Shuffle(arr, seed) {
  const rng = p7Rng(seed);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Orders a side's grid cells by distance from the center gap, nearest-first, so that
// as events accumulate over time the dots build outward from the center divider toward
// the side's outer edge, one band of columns at a time ("vertical line by vertical
// line") — rather than scattering randomly across the whole grid. A wide random jitter
// is mixed into the distance itself (not just used as a same-column tiebreak), so
// nearby columns' cells interleave and the growing edge reads as organic/free-form,
// not a perfectly solid rectangular block advancing column by column.
//
// The usable-cell pool is sized to exactly this side's own event count (maxEvents),
// not the grid's full physical capacity. Two things fall out of that: (1) since the
// pool is sampled uniformly across the *entire* column range before being distance-
// sorted, using up the whole pool by the time all of a side's events have been placed
// reaches the same final column — i.e. the same width — on both sides, even though
// the left and right datasets have very different total event counts; (2) since the
// pool is always smaller than total physical cells, visible gaps remain throughout
// (including the long-settled core) instead of the grid fusing into a solid block.
const P7_ORDER_JUMBLE_COLS = 14; // how many columns' worth of cells interleave at the edge
function p7OrderFromCenter(total, cols, seed, side, maxEvents) {
  const rng = p7Rng(seed);
  const usableCount = Math.min(total, maxEvents);

  const items = [];
  for (let c = 0; c < total; c++) {
    const col      = c % cols;
    const baseDist = side === "left" ? (cols - 1 - col) : col;
    const jitter   = (rng() * 2 - 1) * P7_ORDER_JUMBLE_COLS;
    items.push({ c, key: baseDist + jitter, gapRoll: rng() });
  }

  // Pick the permanently-empty cells via a random roll (independent of distance), then
  // order only the remaining usable cells by distance-from-center for the actual fill.
  items.sort((a, b) => a.gapRoll - b.gapRoll);
  const usable = items.slice(0, usableCount);
  usable.sort((a, b) => a.key - b.key);
  return usable.map(o => o.c);
}

// Binary search: how many events have date < target
function p7BisectBefore(events, target) {
  let lo = 0, hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid].date < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// Year/month/in-month-fraction for a date string, shared by the timeline position
// logic and the square fly-in animation so both agree on the same date math.
function p7DateDayFrac(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
  const daysInM = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return { y, m, dayFrac: (day - 1) / daysInM };
}

// ease-out — fast start, gentle settle. Right for entrances/exits that don't travel
// anywhere (just scale + fade in place), per the usual "entering -> ease-out" rule.
function p7Ease(t) { return 1 - Math.pow(1 - t, 3); }

// Calendar-month index (year*12+month) for a date string, via string slicing (no
// Date allocation) since this runs per-event, every frame, during a cascade.
function p7MonthKeyOf(dateStr) {
  return parseInt(dateStr.slice(0, 4), 10) * 12 + (parseInt(dateStr.slice(5, 7), 10) - 1);
}
function p7MonthKeyToStartStr(monthKey) {
  const y = Math.floor(monthKey / 12), m = monthKey % 12;
  return `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

// A month's squares fly in one after another (not all at once), in a slow cascade,
// the moment that month becomes the centered/highlighted one — a real elapsed-time
// animation, independent of further scrolling (unlike the rest of page7, which is
// otherwise purely scroll-driven). Each event gets its own start delay, spread across
// P7_ANIM_TOTAL_DURATION in chronological order, then pops into place over P7_POP_DURATION
// (a quick scale+fade at its final grid cell — no flight, no travel).
// Each month owns ONE number — a cascade cursor `c`, in ms, from 0 (the month is
// entirely absent) to P7_ANIM_TOTAL_DURATION (every square settled). A square's
// presence is a pure function of it, `p7Ease((c - itsDelay) / P7_POP_DURATION)`,
// so the cursor advancing plays the cascade in and the cursor retreating plays it
// back out — squares with the largest delay (the last to arrive) reaching 0 first,
// i.e. last in, first out, for free.
//
// This is deliberately the same shape as page8's p8CurrentT: a phase runs at a
// constant 1ms of cursor per 1ms of clock toward a target, so REVERSING MID-FLIGHT
// COVERS ONLY THE REMAINING DISTANCE and every square continues from exactly the
// presence it had. Don't reintroduce separate forward/reverse start timestamps —
// two independent clocks can't express "half-grown, now shrinking", so every
// interrupted direction change snapped the month to full (or empty) for a frame.
//
// p7MonthMaxReached is the highest month ever reached, so the draw loop knows to
// keep rendering (and retracting) months ahead of the current one instead of just
// snapping them away.
const P7_ANIM_TOTAL_DURATION = 2200; // ms — full span of a month's staggered cascade
const P7_POP_DURATION        = 220;  // ms — each individual square's own pop in/out
const p7MonthPhase = {};        // monthKey -> { fromC, toC, start } | undefined (never reached)
let p7MonthMaxReached = -1;     // highest monthKey ever reached, forward
let p7AnimRunning = false;

// Where a month's cascade is right now. undefined = the month has never been
// reached at all (or was fully retreated and cleaned up) — callers treat that as
// "not part of the animated range", distinct from a cursor of 0.
function p7MonthCursor(k) {
  const ph = p7MonthPhase[k];
  if (ph === undefined) return undefined;
  const span = ph.toC - ph.fromC;
  if (span === 0) return ph.toC;
  const t = Math.min(1, (performance.now() - ph.start) / Math.abs(span));
  return ph.fromC + span * t;
}

// Point a month at a new cursor target, starting from wherever it is now (0 for a
// month being reached for the first time). Idempotent — re-aiming at the target
// it's already heading for is a no-op, so this is safe to call every frame.
function p7MonthAim(k, toC) {
  const ph = p7MonthPhase[k];
  if (ph !== undefined && ph.toC === toC) return false;
  const fromC = p7MonthCursor(k) ?? 0;
  p7MonthPhase[k] = { fromC, toC, start: performance.now() };
  return true;
}

// Drop a month straight to a resting cursor with no animation (used for months
// landed on while scrolling backward, which should just already be there).
function p7MonthSettle(k, c) {
  p7MonthPhase[k] = { fromC: c, toC: c, start: performance.now() };
}

// Set once, the instant currentPage flips from 9 to 8 (leaving page8's
// bridge) while page8's own timeline<->legit-grid glide (p8CurrentT,
// page8.js) hasn't reached 0 yet — see setActivePage, main.js. Without this,
// p7DrawSideSquares below has no notion of that glide's progress and would
// draw every square straight at its resting timeline cell the instant this
// section starts drawing instead of page8, i.e. an instant teleport back to
// the @fold9/10 layout mid-reverse-glide. { from: Map<event,{x,y}>, start,
// duration } — same shape/plain-glide convention as p9.anim's plainGlide
// flag (page9.js), just for this one entry point instead of a persistent
// per-frame system.
let p7EntryAnim = null;

// Wipes all per-month animation state so the next entry into the timeline
// replays the cascade from scratch instead of showing settled dots.
// Called from setActivePage (main.js) when the user scrolls back out of
// @fold10 toward an earlier fold.
function p7ResetForReplay() {
  for (const k in p7MonthPhase) delete p7MonthPhase[k];
  p7MonthMaxReached = -1;
}

// True once fold 9's own title card (#page-6 .text-card, page7TitleCardEl in
// main.js) has scrolled all the way past the top of the viewport — not once
// #page-7 itself reaches the top, which (since #page-6's card sits vertically
// centered in its own 100vh-tall section) only happens half a viewport-height
// *after* the card is already gone, leaving a stretch of scrolling where
// nothing visibly happens before the real per-event reveal kicks in. Tying
// engagement directly to the card's own exit instead means the timeline
// starts exactly when the title that introduces it leaves the screen, no
// matter how main.js ends up sizing #page-6's section.
let p7HasEngaged = false;

// True once the real timeline (drawPage7, #page-7) has actually been reached
// at least once this "visit" — set by drawPage7 itself, cleared by drawFold9
// (main.js) once fully retreated back out (p7HasEngaged false again and
// nothing left animating). Lets drawFold9 keep drawing/animating the
// per-event squares (p7DrawTimelineSquares below) for as long as there's
// still something to retreat when the user scrolls back up from #page-7 into
// #page-6, without changing when the *forward* reveal itself first starts —
// that still only ever happens via drawPage7, i.e. once #page-7 is actually
// reached, same as before this flag existed.
let p7RealTimelineReached = false;

// Updates p7HasEngaged — called from drawPage7 (currentPage 7) and drawFold9
// (main.js, currentPage 6) alike, since the title card this depends on
// belongs to fold 9/#page-6. p7HasEngaged is recomputed fresh every call, not
// a one-way latch, so scrolling back up un-engages it again and scrolling
// forward replays the same axis-then-squares sequence — calling this from
// both draw functions (rather than only drawPage7) is what makes that
// reversal actually take effect immediately while currentPage is 6, instead
// of freezing at whatever it last was the moment currentPage left 7.
//
// Engagement (the real per-event squares + the axis's own scroll-driven fill,
// both of which read p7HasEngaged/p7.currentDate) no longer waits for the
// axis's build-in wipe (p7AxisIntroT) to finish — per explicit instruction,
// if the real timeline starts filling in while the wipe is still playing,
// both just play at once rather than forcing the fill to wait. That's safe
// to let overlap: the wipe is a pure right-to-left reveal *clip* over
// whatever p7DrawYearAxis would otherwise draw, and the fill is an
// independent right-to-left color change on the same dots — two continuous,
// same-direction reveals composing under one clip, not a hard cut between
// two states.
// Small hysteresis gap so a decelerating/momentum scroll settling right at
// (or bouncing a couple px around) the exact top<=0 boundary can't flicker
// p7HasEngaged true/false frame-to-frame. That flicker used to be visible as a
// blank frame followed by the current month popping back to full and restarting
// its retreat, once per flicker: engagement flips the month's cursor target
// between 0 and P7_ANIM_TOTAL_DURATION, and back when it flips back. (The cursor
// now makes that merely a tiny jitter rather than a full replay, but the
// hysteresis stays — a month shouldn't twitch direction on scroll noise.)
// Once engaged, disengaging requires the
// title to clear this small buffer past 0, not just barely cross it.
const P7_ENGAGE_HYSTERESIS_PX = 24;
function p7UpdateEngagement() {
  if (!page7TitleCardEl) { p7HasEngaged = false; return; }
  const top = page7TitleCardEl.getBoundingClientRect().top;
  // Engagement is deliberately NOT gated on @fold8's squares finishing their
  // fly-in (fold9FlyTrigger, main.js — legacy name). Per explicit instruction
  // the two are unrelated animations that simply run at the same time: the
  // axis fills and the per-event dots appear on the card's own exit, whether
  // or not the flying squares have landed. (An earlier `flyDone` gate here
  // made both wait — don't reintroduce it.)
  p7HasEngaged = p7HasEngaged ? top <= P7_ENGAGE_HYSTERESIS_PX : top <= 0;
}

// The year axis's own scroll-driven fill (curX, p7DrawYearAxis) trails its raw
// scroll-derived target via a per-frame lerp instead of snapping to it every
// scroll event — same "after-action" trailing feel, and the same damping
// tempo, as @fold1's logo/title scroll-lag (PAGE0_SCROLL_LAG_DAMPING/
// PAGE0_OPACITY_DAMPING, main.js), just applied to this fold's own fill
// fraction instead of a scroll-derived pixel offset. p7.currentDate itself
// (which drives the real per-event cascade's month timing) is untouched —
// only the axis's own visual fill lags, not the timeline's actual engagement.
const P7_AXIS_FILL_LAG_DAMPING = 0.12;
let p7AxisLaggedFillFrac = null;

function p7AxisFillFracTarget() {
  const minMs = new Date(p7.minDate + "T00:00:00Z").getTime();
  const maxMs = new Date(p7.maxDate + "T00:00:00Z").getTime();
  const curMs = new Date(p7.currentDate + "T00:00:00Z").getTime();
  return maxMs === minMs ? 0 : (curMs - minMs) / (maxMs - minMs);
}

// True while the lag still has meaningfully further to go — checked by
// p7AnyAnimActive so the redraw loop (p7StartAnimLoop) keeps running until it
// settles, even if the user has stopped scrolling.
function p7AxisFillLagActive() {
  return p7AxisLaggedFillFrac !== null && Math.abs(p7AxisFillFracTarget() - p7AxisLaggedFillFrac) > 0.0005;
}

// Advances the lag by one frame's worth and returns its current value — called
// once per p7DrawYearAxis call, which is what actually drives it forward
// (there's no independent per-frame ticker; drawing and lag-advancing are the
// same event here, same as every other per-frame value in this file).
function p7AxisUpdateFillLag() {
  const target = p7AxisFillFracTarget();
  if (p7AxisLaggedFillFrac === null) {
    p7AxisLaggedFillFrac = target;
  } else {
    const next = p7AxisLaggedFillFrac + (target - p7AxisLaggedFillFrac) * P7_AXIS_FILL_LAG_DAMPING;
    // An exponential lerp only ever asymptotically approaches its target —
    // once within the same epsilon p7AxisFillLagActive uses to decide the lag
    // has "settled," snap the rest of the way there instead of leaving a
    // permanent sub-pixel residual. At fillFrac === 1 (scroll fully reached
    // p7.maxDate) that residual left curX a sub-pixel short of the axis's left
    // edge, so the dark line never quite finished filling even after scrolling
    // all the way to the end.
    p7AxisLaggedFillFrac = Math.abs(target - next) <= 0.0005 ? target : next;
  }
  if (p7AxisFillLagActive()) p7StartAnimLoop();
  return p7AxisLaggedFillFrac;
}

function p7AnyAnimActive() {
  const now = performance.now();
  for (const k in p7MonthPhase) {
    if (p7MonthCursor(k) !== p7MonthPhase[k].toC) return true; // still travelling
  }
  if (p7AxisEventsAnimActive()) return true;
  if (p7AxisIntroStart !== null && p7AxisIntroT() < 1) return true;
  if (p7AxisFillLagActive()) return true;
  if (p7EntryAnim && now - p7EntryAnim.start < p7EntryAnim.duration) return true;
  return false;
}

// page8 (index 8) renders by calling drawPage7 directly with currentDate forced to
// maxDate (see page8.js) — it's a continuation of page7's view, not a separate one, so
// the cascade must keep redrawing there too, or it freezes the instant the user
// scrolls into page8 mid-flight instead of finishing "off screen" as page7 intended.
// Fold 9 (#page-6, currentPage 6 — drawFold9 in main.js, just before the real
// timeline) is included too, now that its own axis build-in (p7AxisIntroT
// above) can be playing while it's on screen. Fold 7 (#page-5, currentPage 5 —
// drawFold7 in main.js) is included too, now that it also keeps drawing
// p7DrawTimelineSquares for as long as p7RealTimelineReached is true (see that
// flag's own comment) — a fast enough scroll-up can carry the user past
// #page-6 into this fold within a single continuous motion while squares are
// still mid-retreat.
function p7ShouldRedrawForAnim() { return currentPage === 5 || currentPage === 6 || currentPage === 7 || currentPage === 8; }

function p7StartAnimLoop() {
  if (p7AnimRunning) return;
  p7AnimRunning = true;
  function step() {
    if (p7ShouldRedrawForAnim()) { draw(); p7RecheckHover(); }
    if (p7AnyAnimActive()) {
      requestAnimationFrame(step);
    } else {
      p7AnimRunning = false;
      if (p7ShouldRedrawForAnim()) { draw(); p7RecheckHover(); } // final frame, locked at rest position
    }
  }
  requestAnimationFrame(step);
}

// Draws events[settledCount..monthEnd). Events strictly before settledCount are drawn
// at rest by the caller. Events in range may belong to several different months (if
// the user scrolled through more than one month within P7_ANIM_TOTAL_DURATION) — since
// events are date-sorted, each month's events are contiguous, so the per-month cascade
// cursor is read only when the month actually changes while scanning, not on every
// single event.
//
// There is no separate forward/reverse code path: a square's presence is a pure
// function of its month's cursor (p7MonthCursor), which the tick in
// p7DrawTimelineSquares aims at P7_ANIM_TOTAL_DURATION going forward and at 0 going
// back. A cursor sliding backward retracts the month's squares in mirrored order (the
// last to arrive is the first to leave) simply because they're the ones with the
// largest delay.
function p7DrawSideSquares(ctx, events, positions, x0, topY, cols, CELL, SQ, monthEnd, settledCount, posMap) {
  const stagger = Math.max(0, P7_ANIM_TOTAL_DURATION - P7_POP_DURATION);
  let groupMonthKey = null, groupStart = 0, groupEnd = 0;
  let groupCursor = P7_ANIM_TOTAL_DURATION; // months with no phase at all read as settled
  const claimedEvents = p7GetClaimedEvents();

  for (let i = 0; i < monthEnd; i++) {
    const cell = positions[i];
    const col  = cell % cols;
    const row  = Math.floor(cell / cols);
    const destX = x0 + col * CELL;
    const destY = topY + row * CELL;

    // Continuing page8's reverse glide into its resting timeline cell (see
    // p7EntryAnim's own comment above) — blended position only, layered
    // underneath this loop's existing scale/alpha cascade below, which is
    // otherwise untouched (squares never move once placed here outside of
    // this one entry blend).
    let drawX = destX, drawY = destY;
    if (p7EntryAnim) {
      const from = p7EntryAnim.from.get(events[i]);
      if (from) {
        const glideT = p9Ease(Math.min(1, Math.max(0, (performance.now() - p7EntryAnim.start) / p7EntryAnim.duration)));
        drawX = from.x + (destX - from.x) * glideT;
        drawY = from.y + (destY - from.y) * glideT;
      }
    }

    // Claimed events (FOLD6_SQUARE_ACTORS/OCCURRENCE, main.js) are never
    // drawn here at all — the fold-9 flying square *is* this dot, permanently,
    // not a stand-in for a separate real one. Still recorded in posMap (full
    // alpha, no animation) so downstream consumers that look up an event's
    // on-screen position (page8's grid blend, page9's drag-and-drop, fold13's
    // morph) still find one — just skips this loop's own drawing/stagger
    // bookkeeping for it.
    if (claimedEvents && claimedEvents.has(events[i])) {
      posMap.set(events[i], { x: destX, y: destY, alpha: 1 });
      continue;
    }

    let scale = 1, alpha = 1;
    if (i >= settledCount) {
      const mk = p7MonthKeyOf(events[i].date);
      if (mk !== groupMonthKey) {
        groupMonthKey  = mk;
        groupStart     = i;
        groupEnd       = p7BisectBefore(events, p7MonthKeyToStartStr(mk + 1));
        // No phase at all = a month below the animated range, i.e. long settled.
        groupCursor    = p7MonthCursor(mk) ?? P7_ANIM_TOTAL_DURATION;
      }

      const countInGroup = groupEnd - groupStart;
      const localIdx = i - groupStart;
      // Each square's own slot in the month's cascade. Because presence is read off
      // the shared cursor rather than off "time since the cascade started", a square
      // is wherever the cursor says — mid-grow, mid-shrink or settled — no matter how
      // many times the user reversed direction on the way here.
      const delay = countInGroup > 1 ? (localIdx / (countInGroup - 1)) * stagger : 0;
      const presence = p7Ease(Math.min(1, Math.max(0, (groupCursor - delay) / P7_POP_DURATION)));
      if (presence <= 0) continue; // not popped in yet, or fully retreated
      // Nothing pops from nothing: start at a visible (if small) size rather than 0.
      scale = 0.5 + 0.5 * presence;
      alpha = presence;
    }

    posMap.set(events[i], { x: drawX, y: drawY, alpha });

    // While one square is hovered (p7.hoveredEvent, set by p7HoverInit — see
    // below), it's drawn fully opaque and every other square is dimmed, so it
    // reads as isolated against the grid — same convention as page9.js's
    // p9PlaceDot.
    let drawAlpha = alpha;
    if (p7.hoveredEvent) drawAlpha = (events[i] === p7.hoveredEvent) ? 1 : alpha * hoverDim(events[i].actor);

    const size = SQ * scale;
    const off  = (SQ - size) / 2; // keep the shrink/grow centered on the cell
    ctx.globalAlpha = drawAlpha;
    ctx.fillStyle = p7ActorColor(events[i].actor);
    ctx.fillRect(drawX + off, drawY + off, size, size);
  }
  ctx.globalAlpha = 1;
}

async function initPage7() {
  try {
    const res  = await fetch("events.json");
    const data = await res.json();
    data.sort((a, b) => a.date.localeCompare(b.date));

    p7.leftEvents  = data.filter(e => e.side === "left");
    p7.rightEvents = data.filter(e => e.side === "right");
    p7.minDate     = data[0].date;
    p7.maxDate     = data[data.length - 1].date;
    p7.currentDate = p7.minDate;
    p7.ready       = true;
  } catch (err) {
    console.error("Failed to load events:", err);
  }
}

function p7UpdateLayout(W, H) {
  if (W === p7.lastW && H === p7.lastH) return;

  const topY   = Math.round(H * SBB_TIMELINE.top);
  const botY   = Math.round(H * SBB_TIMELINE.bottom);
  const sideH  = botY - topY;
  const { leftX0, cols, CELL } = p7GridGeometry(W, H);
  p7.leftX0 = leftX0;
  p7.CELL = CELL;
  p7.SQ   = P7_SQ;
  p7.cols = cols;

  const rows  = Math.floor(sideH / P7_CELL);
  const total = p7.cols * rows;
  p7.leftPos  = p7OrderFromCenter(total, p7.cols, 11111, "left",  p7.leftEvents.length);
  p7.rightPos = p7OrderFromCenter(total, p7.cols, 99999, "right", p7.rightEvents.length);

  // p7ResolveActorOccurrenceCell's own cache (p7TargetCellCache) maps an
  // event to a *cell number* within p7.leftPos/p7.rightPos — meaningless on
  // its own, since the same cell number means a different row/col (or even
  // references a differently-sized grid entirely) once cols/rows/total
  // change here, e.g. on a resize or a different viewport at load time.
  // Clearing it whenever leftPos/rightPos are recomputed forces every
  // actor+occurrence lookup to re-resolve against the grid that's actually
  // current, instead of handing back a stale cell number sized for whatever
  // viewport was active the first time it was ever resolved.
  p7TargetCellCache.clear();

  p7.lastW = W;
  p7.lastH = H;
}

// Index (into `events`, chronologically sorted) of the nth (0-based)
// occurrence of `actor` — used below to find which real event a fold-9
// curated square (main.js) should stand in for. A plain linear scan, not a
// precomputed per-actor index, because it only ever runs once per
// actor/occurrence pair (see p7TargetCellCache) rather than every frame.
function p7NthIndexOfActor(events, actor, n) {
  let seen = 0;
  for (let i = 0; i < events.length; i++) {
    if (events[i].actor === actor) {
      if (seen === n) return i;
      seen++;
    }
  }
  return -1;
}

// Caches the (expensive: scans up to several thousand events) actor+occurrence
// -> {side, cell} lookup below, keyed by "actor|n" — the lookup itself never
// changes once events.json is loaded, only the cell's on-screen pixel
// position does (as W/H change), so the frame-by-frame path
// (p7TargetForActorOccurrence, called every animation frame while fold 9's
// squares are flying out) only ever needs to redo the cheap pixel math.
const p7TargetCellCache = new Map();

function p7ResolveActorOccurrenceCell(actor, n) {
  const key = actor + "|" + n;
  if (p7TargetCellCache.has(key)) return p7TargetCellCache.get(key);

  let side = "left", idx = p7NthIndexOfActor(p7.leftEvents, actor, n);
  if (idx === -1) {
    side = "right";
    idx = p7NthIndexOfActor(p7.rightEvents, actor, n);
  }
  const positions = side === "left" ? p7.leftPos : p7.rightPos;
  const result = (idx === -1 || positions[idx] === undefined) ? null : { side, cell: positions[idx] };
  p7TargetCellCache.set(key, result);
  return result;
}

// Returns the top-left {x, y, size} (viewport-pixel space, same coordinate
// system every other page7 square uses) of the grid cell where the nth
// chronological event by `actor` will eventually settle, or null if there is
// no such event — used by main.js's fold-9 squares fly-out to send each
// curated square to the exact real dot it's standing in for, rather than
// just fading away in place.
function p7TargetForActorOccurrence(actor, n, W, H) {
  if (!p7.ready) return null;
  // Must run before resolving/caching below — p7.leftPos/rightPos (which the
  // resolve step reads to build its cached result) are empty until this has
  // run at least once, and a premature resolve would cache a false "no such
  // event" null forever.
  p7UpdateLayout(W, H);
  const resolved = p7ResolveActorOccurrenceCell(actor, n);
  if (!resolved) return null;

  const topY = Math.round(H * SBB_TIMELINE.top);
  const x0  = resolved.side === "left" ? p7.leftX0 : W / 2 + CENTER_GAP / 2;
  const col = resolved.cell % p7.cols;
  const row = Math.floor(resolved.cell / p7.cols);
  return { x: x0 + col * p7.CELL, y: topY + row * p7.CELL, size: p7.SQ };
}

// Returns the real event object (date/descHeMedium/actor/...) for the nth
// chronological event by `actor`, or null if there is no such event / data
// isn't loaded yet — same actor+occurrence join key as
// p7TargetForActorOccurrence above, but returns the event itself rather than
// its eventual on-screen cell, for main.js's fold-8 square tooltip (shows a
// real event's own date+description instead of a static label).
function p7EventForActorOccurrence(actor, n) {
  if (!p7.ready) return null;
  let idx = p7NthIndexOfActor(p7.leftEvents, actor, n);
  if (idx !== -1) return p7.leftEvents[idx];
  idx = p7NthIndexOfActor(p7.rightEvents, actor, n);
  if (idx !== -1) return p7.rightEvents[idx];
  return null;
}

// Inverse of p7NthIndexOfActor for one specific event, identified by the xlsx's
// own stable `rowId`: returns which occurrence (0-based) of its actor that event
// is, within its own side's date-sorted list — i.e. exactly the `n` the two
// lookups above expect. -1 if the data isn't loaded or no row carries that id.
// Lets a curated pin (FOLD6_TOOLTIP_ROW_ID, js/groups.js) name an event by id and
// have the fragile positional number derived at runtime, so editing the xlsx
// can't silently repoint it at a neighbouring event.
function p7OccurrenceOfRowId(rowId) {
  if (!p7.ready) return -1;
  for (const events of [p7.leftEvents, p7.rightEvents]) {
    const idx = events.findIndex(e => e.rowId === rowId);
    if (idx === -1) continue;
    let seen = 0;
    for (let i = 0; i < idx; i++) if (events[i].actor === events[idx].actor) seen++;
    return seen;
  }
  return -1;
}

// The 8 real events @fold9's fold-6 squares fly to/become (FOLD6_SQUARE_ACTORS/
// fold6SquareOccurrence, js/groups.js — referenced here only inside this function
// body, never at load time, since page7.js loads before main.js in
// project.html) are never drawn by the real per-event cascade below — the
// flying DOM square *is* that dot permanently, not a stand-in that hands off
// to a separately-popping-in real one once it arrives. Resolved once
// (event objects are stable references once events.json is loaded) and
// cached, same pattern as p7TargetCellCache above.
let p7ClaimedEvents = null;
function p7GetClaimedEvents() {
  if (p7ClaimedEvents) return p7ClaimedEvents;
  if (!p7.ready || typeof FOLD6_SQUARE_ACTORS === "undefined") return null;
  p7ClaimedEvents = new Set();
  FOLD6_SQUARE_ACTORS.forEach((actor, i) => {
    const event = p7EventForActorOccurrence(actor, fold6SquareOccurrence(i));
    if (event) p7ClaimedEvents.add(event);
  });
  return p7ClaimedEvents;
}

// Extracted from drawPage7 below so drawFold9 (main.js, #page-6, currentPage
// 6) can keep this running too — see p7RealTimelineReached's own comment
// above for why: without this, scrolling back up from #page-7 into #page-6
// (crossing back over @fold9's own title) made every still-retreating square
// (and the year axis's own headline events, p7DrawAxisEvents) vanish in a
// single frame the instant currentPage dropped, instead of finishing their
// reverse cascade like they do while scrolling backward *within* #page-7
// itself. Callers must call p7UpdateEngagement() themselves first (drawPage7/
// drawFold9 both already do, since the axis needs a fresh p7HasEngaged too).
function p7DrawTimelineSquares(ctx, W, H) {
  p7UpdateLayout(W, H);

  // Cleared once finished rather than left to just clamp at t=1 forever —
  // matches every other one-shot anim object's own null-when-done convention
  // (p9.anim, page9.js) instead of silently doing pointless per-event lookups
  // every frame for the rest of the session.
  if (p7EntryAnim && performance.now() - p7EntryAnim.start >= p7EntryAnim.duration) p7EntryAnim = null;

  const { CELL, SQ, cols, leftX0 } = p7;
  const topY    = Math.round(H * SBB_TIMELINE.top);
  const rightX0 = W / 2 + CENTER_GAP / 2;

  // Events from months whose cascade has already fully finished are settled (drawn
  // at rest, no animation); events from the centered month, or from any earlier month
  // whose cascade is still mid-flight (the user scrolled past it before it finished),
  // keep animating on their own clock — see p7DrawSideSquares/p7MonthCursor. The
  // loop's upper bound must cover the *whole* centered month (monthEndL/monthEndR),
  // not just events whose date has already been reached, so the full cascade can play.
  const { y: curY, m: curM } = p7DateDayFrac(p7.currentDate);
  const curMonthKey = curY * 12 + curM;

  // Only a month that's genuinely beyond anything reached before gets a fresh forward
  // cascade. A month can have no forward-start yet without being new territory — e.g.
  // it was scrolled past quickly and skipped while moving forward, and we're now
  // landing on it while moving *backward* — in which case it should just appear
  // settled, not fire off a brand new entrance while the user is scrolling the other way.
  //
  // The very first month (minDate's month) starts out "current" before the user has
  // scrolled into page7 at all — p7HasEngaged (updated by p7UpdateEngagement,
  // called from both here and drawFold9 in main.js so it stays accurate even
  // while currentPage is 7) only flips true once fold 9's title card has
  // scrolled past the top of the viewport, AND the year axis's own build-in
  // wipe (p7AxisIntroT) has fully finished.
  const isNewTerritory = p7HasEngaged && curMonthKey > p7MonthMaxReached;
  if (isNewTerritory) {
    // A single engaged tick can jump curMonthKey forward by more than one
    // month at once — e.g. @fold9's fly-then-engage gate (p7UpdateEngagement,
    // main.js) lets scroll position race ahead of curMonthKey while
    // engagement is still pending, so the moment it fires, `t` (and the date
    // it maps to) can already be several months past minDate. Without
    // backfilling every skipped month here, each one falls straight into
    // "settled" below (no phase of its own at all) and pops in
    // instantly, fully-formed, with no cascade — the exact "instant jump"
    // this loop exists to prevent. All backfilled months start their cursor at
    // the same instant (simpler than staggering month-to-month, and each month's
    // own events still cascade individually within it via p7DrawSideSquares'
    // own per-event delay), rather than one after another.
    for (let k = Math.max(p7MonthMaxReached + 1, p7MonthKeyOf(p7.minDate)); k <= curMonthKey; k++) {
      if (p7MonthPhase[k] === undefined) p7MonthAim(k, P7_ANIM_TOTAL_DURATION); // from cursor 0
    }
    p7StartAnimLoop();
  } else if (p7HasEngaged && p7MonthPhase[curMonthKey] === undefined) {
    // Not new territory: curMonthKey was already skipped over earlier while
    // moving forward, and we're now landing on it while scrolling backward —
    // it should just appear settled, not fire off a brand new entrance while
    // the user is scrolling the other way.
    p7MonthSettle(curMonthKey, P7_ANIM_TOTAL_DURATION);
  }

  if (p7HasEngaged) {
    // Scrolling back down onto months that had started retreating turns them
    // around. Every month at or below the centered one gets re-aimed, not just
    // curMonthKey: one scroll tick can re-enter several at once, and a month
    // left aimed at 0 while no longer ahead of curMonthKey would keep vanishing
    // under the user. Aiming is enough to make each square resume growing from
    // the exact presence it had — that's the whole point of the shared cursor;
    // there is no snapshot to take and no "was it mid-flight?" case to special-case.
    for (const key in p7MonthPhase) {
      const k = Number(key);
      if (k <= curMonthKey && p7MonthAim(k, P7_ANIM_TOTAL_DURATION)) p7StartAnimLoop();
    }
  } else if (p7MonthMaxReached > -1) {
    // Disengaged (scrolled back up past this fold's own title — see
    // p7UpdateEngagement): the "current" month itself now needs to retreat
    // too, not just months ahead of it (the loop below already handles those
    // unconditionally) — otherwise it just sits at rest until
    // nextMonthStartStr's clamp further down cuts it away in a single frame
    // instead of playing the same reverse cascade every other month gets.
    if (p7MonthPhase[curMonthKey] !== undefined && p7MonthAim(curMonthKey, 0)) p7StartAnimLoop();
  }

  if (p7HasEngaged && curMonthKey > p7MonthMaxReached) p7MonthMaxReached = curMonthKey;

  // Scrolled backward past months that were previously reached: start their retreat
  // (each flies back out the same way it flew in) unless it's already retreating.
  // Unconditional on p7HasEngaged (always was) — once disengaged, curMonthKey is
  // pinned at the first month (p7.currentDate = p7.minDate, page7UpdateFromScroll),
  // so this still correctly covers every later month up through p7MonthMaxReached.
  for (let k = curMonthKey + 1; k <= p7MonthMaxReached; k++) {
    if (p7MonthPhase[k] !== undefined && p7MonthAim(k, 0)) p7StartAnimLoop();
  }
  // Once every month ahead of the centered one has fully retreated, stop tracking
  // (and drawing) them — otherwise we'd iterate them forever.
  while (p7MonthMaxReached > curMonthKey && (p7MonthCursor(p7MonthMaxReached) ?? 0) <= 0) {
    delete p7MonthPhase[p7MonthMaxReached];
    p7MonthMaxReached--;
  }
  // curMonthKey's own phase is deliberately left in place once its retreat
  // finishes (unlike the loop above, which drops months strictly ahead of it):
  // it rests at cursor 0, drawing nothing, and the retreat branch above can't
  // re-arm off it because p7MonthAim is a no-op when the target is already 0.
  //
  // ...with one exception: once we're fully DISENGAGED and that last month's
  // retreat has finished, there is nothing left on screen, so the whole
  // cascade must reset to its virgin state — otherwise scrolling back down
  // re-engages with curMonthKey's phase still present and p7MonthMaxReached
  // still === curMonthKey, so `isNewTerritory` reads false and the first
  // month's dots appear instantly, fully settled, with no cascade.
  if (!p7HasEngaged && p7MonthMaxReached === curMonthKey && (p7MonthCursor(curMonthKey) ?? 0) <= 0) {
    delete p7MonthPhase[curMonthKey];
    p7MonthMaxReached = -1;
  }

  // Walk backward from the centered month while previous months are still mid-cascade,
  // to find the earliest month that must still be drawn with animation applied. Once
  // disengaged, everything still in flight (including the current month, see above) is
  // retreating, so there's no "settled, at-rest" range at all — clamp straight to
  // minDate instead.
  let settledStr = p7.minDate;
  if (p7HasEngaged) {
    let earliestActiveMonthKey = curMonthKey;
    for (let k = curMonthKey - 1; p7MonthPhase[k] !== undefined && p7MonthCursor(k) < P7_ANIM_TOTAL_DURATION; k--) {
      earliestActiveMonthKey = k;
    }
    settledStr = p7MonthKeyToStartStr(earliestActiveMonthKey);
  }

  // The draw range's upper bound covers through whichever is further out: the
  // centered month, or a later month still retreating back toward the origin.
  // Before anything has ever been reached this visit (p7MonthMaxReached still
  // -1), clamp to p7.minDate itself so nothing draws regardless of how far
  // curMonthKey has silently raced ahead pre-engagement (p7.currentDate is
  // driven straight off raw scroll position with no engagement gating of its
  // own — see p7HasEngaged's own definition, gated on the title card's exit,
  // not on the axis). But once something HAS been reached, keep drawing
  // through p7MonthMaxReached even after disengaging, so the current month's
  // own retreat (started above) can actually finish playing out instead of
  // being hard-cut the instant engagement ends.
  const drawThroughMonthKey = Math.max(curMonthKey, p7MonthMaxReached);
  const nextMonthStartStr = (p7HasEngaged || p7MonthMaxReached > -1)
    ? p7MonthKeyToStartStr(drawThroughMonthKey + 1)
    : p7.minDate;
  const settledL  = p7BisectBefore(p7.leftEvents,  settledStr);
  const settledR  = p7BisectBefore(p7.rightEvents, settledStr);
  const monthEndL = p7BisectBefore(p7.leftEvents,  nextMonthStartStr);
  const monthEndR = p7BisectBefore(p7.rightEvents, nextMonthStartStr);

  const posMap = new Map();


  // Draw left events.
  p7DrawSideSquares(ctx, p7.leftEvents, p7.leftPos, leftX0, topY, cols, CELL, SQ, monthEndL, settledL, posMap);

  // Draw right events.
  p7DrawSideSquares(ctx, p7.rightEvents, p7.rightPos, rightX0, topY, cols, CELL, SQ, monthEndR, settledR, posMap);

  p7.lastPositions = posMap;
}

function drawPage7(ctx, W, H) {
  drawBackground(ctx, W, H);

  if (!p7.ready) {
    ctx.fillStyle = "#111";
    ctx.font = "16px 'Assistant', sans-serif";
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("טוען נתונים...", W / 2, H / 2);
    return;
  }

  p7UpdateEngagement();
  p7RealTimelineReached = true;
  p7DrawTimelineSquares(ctx, W, H);

  if (p7AxisTriggerIfNeeded()) p7DrawYearAxis(ctx, W, H);
}

// The axis *appearing* (the one-shot build-in wipe) and the axis *filling up*
// (p7HasEngaged advancing p7.currentDate) are two separate trigger points —
// this is the appearing one. Per explicit instruction it fires the moment
// @fold8's fly trigger is activated (fold9FlyTrigger — legacy name, it's the
// squares' fly-out on id #page-7), NOT after the squares land: p7HasEngaged
// additionally waits for that fly to finish (`flyDone` in p7UpdateEngagement),
// which made the wipe start late. Falls back to p7HasEngaged if main.js hasn't
// defined the trigger yet, so this still degrades safely.
function p7AxisShouldShow() {
  if (typeof fold9FlyTrigger !== "undefined" && fold9FlyTrigger.currentRaw() > 0) return true;
  return p7HasEngaged;
}

// Latches p7AxisIntroStart the instant p7AxisShouldShow() first goes true,
// kicking off the build-in wipe (p7AxisIntroT) on its own wall clock — and
// un-latches if the user scrolls back above that trigger point, so scrolling
// forward across it again replays the same build-in from scratch. Same
// interruptible-replay pattern as the axis's own headline events (see
// p7UpdateAxisEventTriggers above), just for the axis's first appearance
// instead of a single event.
function p7AxisTriggerIfNeeded() {
  if (!p7AxisShouldShow()) {
    p7AxisIntroStart = null;
    return false;
  }
  if (p7AxisIntroStart === null) {
    p7AxisIntroStart = performance.now();
    p7StartAnimLoop();
  }
  return true;
}

// ── Date axis — a horizontal year strip drawn along the bottom of the canvas.
// The full span (every year from p7.minDate to p7.maxDate, plus all labels) is
// drawn faint from the very first frame (Figma node 206:908) — what actually
// grows right to left as the user scrolls deeper into the dataset is a darker
// "filled" overlay on top of it. Unlike the square cascade beside it, neither
// layer has animation state of its own: every frame both are recomputed straight
// from p7.currentDate, so scrolling backward just naturally shrinks the dark
// overlay back — no separate reverse bookkeeping needed.
const P7_AXIS_MARGIN          = 120;  // px inset from each edge — widened from 48 to SHORTEN the whole axis (both ends move inward symmetrically). The right anchor (p7.minDate/"2023") now sits far enough from the screen edge that the first axis event's label can center over its own circle with clearance instead of falling back to right-alignment (see p7AxisEventBounds' x+textWidth/2 > W test).
const P7_AXIS_Y_FRAC          = 0.90;  // fraction of H — vertical center of the solid line; the year labels now sit BELOW it (P7_AXIS_YEAR_LABEL_OFFSET), not on the same row
const P7_AXIS_LINE_THICKNESS  = 1;     // px — the solid line's stroke height
const P7_AXIS_MARKER_RADIUS   = 4;     // px — radius of the year-tick ring markers AND the headline-event dots at full size (shared so they read as one system)
const P7_AXIS_MARKER_RADIUS_FADED = 2; // px — shrunk radius a headline-event dot settles to once its label has crossfaded away (grows back to _RADIUS on hover)
const P7_AXIS_MARKER_STROKE   = 1;     // px — ring line width for the hollow year markers
const P7_AXIS_YEAR_LABEL_OFFSET = 12;  // px gap from the marker's bottom edge down to the year label's top
const P7_AXIS_BG_ALPHA        = 0.22;  // faint full-span line's alpha, under the dark "filled" overlay — also reused to dim the axis event label during state3 (hover elsewhere)
const P7_AXIS_BG_COLOR        = `rgba(0, 0, 0, ${P7_AXIS_BG_ALPHA})`;
const P7_AXIS_FILLED_COLOR    = "rgba(0, 0, 0, 1)";    // the portion scroll has already reached
const P7_AXIS_HOVER_COLOR     = P7_AXIS_FILLED_COLOR;  // the single dash highlighted while a matching dot elsewhere is hovered — same solid black as the "filled" state now that it's already fully opaque, no room to go darker
const P7_AXIS_LABEL_FAINT_COLOR = "rgba(0, 0, 0, 0.12)"; // unreached year label — same faint/filled ratio as the dots
// Reached year label + axis event date text — close to state2's solid black
// but a touch lighter, on their own constant rather than tied to
// P7_AXIS_FILLED_COLOR, so the axis's own dashes can stay pure black while
// this text reads a bit brighter/less heavy.
const P7_AXIS_LABEL_COLOR       = "rgba(0, 0, 0, 0.65)";

// One-shot build-in animation for the axis's first appearance (separate from
// the scroll-driven faint/filled reveal above, which keeps working exactly
// the same once this has played) — a right-to-left wipe, on its own wall
// clock, starting from p7.minDate's anchor (the "2023" end) since that's
// where the scroll-driven reveal above starts from too. p7AxisIntroStart is
// null when not yet triggered (or reset back to it, see p7AxisTriggerIfNeeded).
const P7_AXIS_INTRO_DURATION = 2800; // ms — full right-edge-to-left-edge wipe
let p7AxisIntroStart = null;

function p7AxisIntroT() {
  if (p7AxisIntroStart === null) return 0;
  return Math.min(1, (performance.now() - p7AxisIntroStart) / P7_AXIS_INTRO_DURATION);
}

// Maps a date string to an x position along the axis: p7.minDate anchors the
// right edge, p7.maxDate the left edge, linear in elapsed days — the same
// fraction page7UpdateFromScroll derives currentDate from, just recomputed
// here from the date string so the axis has a single source of truth.
function p7AxisX(dateStr, W) {
  const minMs = new Date(p7.minDate + "T00:00:00Z").getTime();
  const maxMs = new Date(p7.maxDate + "T00:00:00Z").getTime();
  const rightX = W - P7_AXIS_MARGIN;
  const leftX  = P7_AXIS_MARGIN;
  if (maxMs === minMs) return rightX;
  const frac = (new Date(dateStr + "T00:00:00Z").getTime() - minMs) / (maxMs - minMs);
  return rightX - frac * (rightX - leftX);
}

// One tick per calendar year spanned by the data: the first is always p7.minDate
// itself (the start anchor, shown from the very first frame), the rest are each
// subsequent year's January 1st.
function p7AxisYearTicks() {
  const minD = new Date(p7.minDate + "T00:00:00Z");
  const maxYear = new Date(p7.maxDate + "T00:00:00Z").getUTCFullYear();
  const minYear = minD.getUTCFullYear();
  const ticks = [{ year: minYear, dateStr: p7.minDate }];
  for (let y = minYear + 1; y <= maxYear; y++) {
    ticks.push({ year: y, dateStr: `${y}-01-01` });
  }
  return ticks;
}

// Headline events called out along the axis — title only, no date (the axis's own
// year ticks already carry that). Each one appears right as the growing edge
// reaches its date and stays on screen — unlike a one-shot toast — until the
// *next* event's date is reached, at which point it crossfades into that one.
// So only one is ever on screen, but which one is showing tracks scroll position
// directly rather than a wall-clock timer.
//
// `maxWidth` (px) is a per-event cap on how wide the title may render: over it,
// the title wraps onto extra lines that stack UPWARD from the date, so a long
// headline gets narrow-and-tall instead of wide — which is what actually keeps
// two neighbouring events from colliding, since the de-collision pass below can
// only slide labels sideways within a fixed axis width. `null` = no cap, draw
// on one line. Tuned by eye per event, so they're hand-set numbers, not derived.
const P7_AXIS_EVENTS = [
  // Nudged left to clear the "2023" year ring — 04.01 sits only 3 days from
  // minDate, so at its true x its dot all but touches the axis's right anchor.
  { date: "2023-01-04", label: "הצגת הרפורמה המשפטית", maxWidth: null, xOffset: -14 },
  { date: "2023-10-07", label: "מתקפת 7 באוקטובר", maxWidth: null },
  { date: "2024-06-25", label: "פסיקת בג״ץ על גיוס חרדים", maxWidth: null },
  { date: "2024-12-08", label: "נפילת משטר אסד", maxWidth: null, xOffset: 12 },
  { date: "2025-06-13", label: "מבצע ״עם כלביא״", maxWidth: null },
  { date: "2025-10-13", label: "שחרור החטופים מעזה", maxWidth: null },
  // Past maxDate (2026-07-03) — parks at the axis's left end (see the clamp in
  // p7AxisEventTrueX); the +26 holds it clear of that end rather than flush to it.
  { date: "2026-07-17", label: "התפזרות הכנסת ה-25", maxWidth: null, xOffset: 26 },
];

// Fixed real-time (wall-clock) fade durations — these only govern the crossfade
// itself, not how long an event stays fully visible (that's driven by scroll: it
// holds at full opacity for as long as the next event remains unreached). Once a
// fade starts it plays out on its own clock (via p7StartAnimLoop/p7AnyAnimActive
// below) even if the user stops scrolling entirely.
const P7_AXIS_EVENT_FADE_IN_MS  = 400;
const P7_AXIS_EVENT_FADE_OUT_MS = 1000;
const P7_AXIS_EVENT_LABEL_OFFSET = 34; // px above the axis line (lifted to give date room below)
const P7_AXIS_EVENT_FONT         = "500 14px 'Assistant', sans-serif";
const P7_AXIS_DATE_FONT          = "400 14px 'Assistant', sans-serif";
const P7_AXIS_DATE_OFFSET        = 18;  // px above the label baseline
const P7_AXIS_EVENT_LINE_HEIGHT  = 19;  // px between wrapped title lines

// triggeredAt is a performance.now() timestamp, set once when the event is first
// reached, and cleared only once its own reverse fade-out (leavingAt below) has
// fully finished — null means "not currently triggered or shown" (either never
// reached yet, or reached-then-reversed-then-fully-faded). Scrolling back above
// the *next* event's date clears that next one's own triggeredAt/leavingAt,
// which is what un-does this event's forward-triggered fade-out (see
// p7AxisEventOpacity) and brings it back to full opacity — no separate reverse
// bookkeeping needed for that particular case.
//
// leavingAt is a separate timestamp, set the instant *this* event itself is
// scrolled back above its own date — driving its own reverse fade-out
// (P7_AXIS_EVENT_FADE_OUT_MS) symmetrically with the forward crossfade,
// instead of just snapping triggeredAt to null and disappearing in one frame.
// Re-reaching the event before that fade finishes cancels it (leavingAt reset
// to null), same "reversible mid-flight" convention as p7DrawSideSquares' own
// month cascade.
// hoverT (0 → 1) is a per-frame-eased hover amount: 1 while this event's axis
// circle is hovered, decaying back to 0 when it isn't, easing the dot's
// grow/shrink (and its label's re-show) instead of snapping. Kept on the same
// state object so the anim loop (p7AxisEventsAnimActive) can see it settle.
// reachedT (0 → 1) is the eased "the fill edge has passed me" amount, driving the
// circle's radius in and OUT. Without it the marker's existence was a hard
// boolean on the fill edge, so scrolling back up made every dot vanish in one
// frame while its label was still fading — position never snaps, and neither
// should a dot's presence. Same lerp speed as hoverT so the axis has one tempo.
const P7_AXIS_HOVER_ANIM_SPEED = 0.18; // per-frame lerp toward the hover target
const P7_AXIS_EVENT_STATE = P7_AXIS_EVENTS.map(() => ({ triggeredAt: null, leavingAt: null, hoverT: 0, reachedT: 0 }));

// Eased 0 → 1 amount of the "roster" state: 1 while a regular timeline square is
// hovered, decaying back to 0 when it is not. ONE shared value rather than a
// per-event one, because the roster is a single whole-axis state — every reached
// label fades in and every dot shrinks together on the same clock. Eased with the
// same P7_AXIS_HOVER_ANIM_SPEED lerp as an individual dot's hoverT, so both hover
// behaviours move at one tempo instead of snapping.
let p7AxisRosterT = 0;

// Checked every draw (see p7AnyAnimActive) so the animation loop keeps running —
// and labels keep fading — purely on elapsed time, with no further scrolling
// required.
function p7AxisEventsAnimActive() {
  const now = performance.now();
  // A hover grow/shrink still easing toward its target keeps the loop alive even
  // for an event whose label has otherwise fully faded (triggeredAt cleared).
  const hoverAnimating = P7_AXIS_EVENT_STATE.some((state, i) => {
    const target = P7_AXIS_EVENTS[i] === p7.hoveredAxisEvent ? 1 : 0;
    return Math.abs(state.hoverT - target) > 0.001;
  });
  if (hoverAnimating) return true;
  // A circle still growing in or shrinking out (p7DrawAxisEvents' reachedT)
  // outlives its label's fade in the scroll-back case, so it needs its own check.
  const markerAnimating = P7_AXIS_EVENT_STATE.some((state) => state.reachedT > 0.001 && state.reachedT < 0.999);
  if (markerAnimating) return true;
  // The shared roster ease has to keep the loop alive on its own: it moves even
  // when no individual event's hoverT does (nothing on the axis is hovered — a
  // regular timeline square is).
  if (Math.abs((p7.hoveredEvent ? 1 : 0) - p7AxisRosterT) > 0.001) return true;
  return P7_AXIS_EVENT_STATE.some((state, i) => {
    if (state.triggeredAt === null) return false;
    if (now - state.triggeredAt < P7_AXIS_EVENT_FADE_IN_MS) return true;
    if (state.leavingAt !== null && now - state.leavingAt < P7_AXIS_EVENT_FADE_OUT_MS) return true;
    const next = P7_AXIS_EVENT_STATE[i + 1];
    return !!next && next.triggeredAt !== null && now - next.triggeredAt < P7_AXIS_EVENT_FADE_OUT_MS;
  });
}

// Computes where event `ev`'s label actually renders — its tick's own x
// (the event's true date position on the axis, cached in p7AxisEventX —
// falls back to computing p7AxisX fresh if the cache hasn't been built
// yet, e.g. the very first frame) — and the label's rendered left/right
// extent given a near-edge alignment fallback (centered text would push past
// the canvas edge for an event anchored right at it, so it falls back to
// right/left alignment, extending only inward). Requires ctx.font already
// set to P7_AXIS_EVENT_FONT.
// Greedy word wrap of `text` into lines no wider than `maxWidth` (in whatever
// font ctx currently carries). A single word longer than the cap is left on its
// own over-long line rather than being broken mid-word. maxWidth null/0 → one
// line, unchanged. Hebrew bidi is handled by the canvas per drawn string, so
// wrapping on plain spaces and drawing each line separately keeps word order
// correct within every line.
function p7WrapLabel(ctx, text, maxWidth) {
  if (!maxWidth) return [text];
  const words = text.split(" ");
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const candidate = line ? line + " " + word : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function p7AxisEventBounds(ctx, ev, i, W) {
  const x = p7AxisEventX[i] !== undefined ? p7AxisEventX[i] : p7AxisEventTrueX(ev, i, W);
  const lines = p7WrapLabel(ctx, ev.label, ev.maxWidth);
  // The collision extent is the whole title+date BLOCK, not just the title:
  // the date renders in its own (narrower) font but centred on the same axis,
  // so for a short title it can be the wider of the two — measuring only the
  // title would let two blocks clear each other while their dates overlap.
  ctx.save();
  ctx.font = P7_AXIS_DATE_FONT;
  const dateWidth = ctx.measureText(p7FormatDateDMY(ev.date, ".")).width;
  ctx.restore();
  const textWidth = Math.max(
    dateWidth,
    ...lines.map((l) => ctx.measureText(l).width)
  );
  let align = "center", left, right;
  if (x + textWidth / 2 > W)      { align = "right"; left = x - textWidth; right = x; }
  else if (x - textWidth / 2 < 0) { align = "left";  left = x; right = x + textWidth; }
  else                             { left = x - textWidth / 2; right = x + textWidth / 2; }
  const lineX = align === "right" ? x - textWidth / 2
              : align === "left"  ? x + textWidth / 2
              : x;
  return { x, left, right, align, lineX, lines };
}

// Fires each event's one-shot animation the instant p7.currentDate reaches its
// date, regardless of how the user got there (slow scroll, fast flick, or a
// direct jump) — and un-fires it if they scroll back above that date. Requires
// p7.currentDate to have actually advanced past p7.minDate first: the pinned
// scrub section (page7UpdateFromScroll, main.js) starts every visit at exactly
// t=0 → currentDate=minDate, before the user has scrolled within it at all —
// so a `>=` comparison would count minDate itself as "reached" on arrival,
// and any event dated at the dataset's very start (minDate is 2023-01-01;
// the first axis event is 2023-01-04) could show before any scrolling
// happened. The strict `>` guard requires real scroll progress. Every event,
// including the first, uses this same plain date-based rule (and renders at
// this same date's axis position, p7AxisEventBounds below) — per explicit
// instruction, no special-cased extra delay for the first one.
function p7UpdateAxisEventTriggers(W) {
  const curMs = new Date(p7.currentDate + "T00:00:00Z").getTime();
  const minMs = new Date(p7.minDate + "T00:00:00Z").getTime();
  const maxMs = new Date(p7.maxDate + "T00:00:00Z").getTime();
  const hasScrolled = curMs > minMs;
  const now = performance.now();
  P7_AXIS_EVENTS.forEach((ev, i) => {
    const state = P7_AXIS_EVENT_STATE[i];
    const evMs = new Date(ev.date + "T00:00:00Z").getTime();
    let reached;
    if (evMs > maxMs) {
      // An event dated past the dataset's end has no date the scrub can ever
      // reach — clamping its compare date to maxDate fired it only on the one
      // final frame where currentDate === maxDate exactly, so in practice it
      // never showed. Instead it uses the same rule everything else does, just
      // expressed in x: reached once the growing fill edge has caught up to the
      // dot's actual DRAWN position (p7AxisEventTrueX — the clamped end of the
      // axis plus its xOffset gap). Time runs right → left, so "caught up"
      // is <=. Nudging its xOffset therefore moves when it appears, too.
      reached = hasScrolled && p7AxisX(p7.currentDate, W) <= p7AxisEventTrueX(ev, i, W);
    } else {
      reached = hasScrolled && curMs >= evMs;
    }
    if (reached) {
      if (state.triggeredAt === null) {
        state.triggeredAt = now;
        state.leavingAt = null;
        p7StartAnimLoop();
      } else if (state.leavingAt !== null) {
        // Scrolled forward again before this event's own reverse fade-out
        // finished — cancel it, same reversible-mid-flight convention as
        // everywhere else in the project.
        state.leavingAt = null;
      }
    } else if (state.triggeredAt !== null && state.leavingAt === null) {
      state.leavingAt = now;
      p7StartAnimLoop();
    }
  });
  // Once a leaving event's own reverse fade-out has fully played out, forget
  // it entirely — otherwise it would linger in P7_AXIS_EVENT_STATE forever at
  // opacity 0 instead of being eligible to fade back in cleanly next time.
  P7_AXIS_EVENT_STATE.forEach((state) => {
    if (state.leavingAt !== null && now - state.leavingAt >= P7_AXIS_EVENT_FADE_OUT_MS) {
      state.triggeredAt = null;
      state.leavingAt = null;
    }
  });
}

// Fades in on its own trigger, then holds at full opacity indefinitely — until
// either the next event triggers (fading this one out on *that* event's clock,
// a crossfade) or the user scrolls back above this event's own date (fading it
// out on its own clock instead, via leavingAt).
function p7AxisEventOpacity(i, now) {
  const state = P7_AXIS_EVENT_STATE[i];
  if (state.triggeredAt === null) return 0;
  let opacity = Math.min(1, (now - state.triggeredAt) / P7_AXIS_EVENT_FADE_IN_MS);
  if (state.leavingAt !== null) {
    const fadeOut = 1 - (now - state.leavingAt) / P7_AXIS_EVENT_FADE_OUT_MS;
    opacity = Math.min(opacity, Math.max(0, fadeOut));
  }
  const next = P7_AXIS_EVENT_STATE[i + 1];
  if (next && next.triggeredAt !== null) {
    let cap;
    if (next.leavingAt !== null) {
      // The next event is itself now reversing out (scrolled back above its
      // own date) — let this (earlier) event fade back IN in lockstep with
      // next's own leavingAt fade-out, over the same P7_AXIS_EVENT_FADE_OUT_MS
      // clock, instead of staying suppressed by next's old triggeredAt-based
      // timer (irrelevant now — that was from whenever next was first
      // reached, possibly long ago) which previously kept this event pinned
      // at opacity 0 for the entire time next was fading out, then made it
      // pop in at full opacity the instant next's fade finished.
      cap = Math.min(1, (now - next.leavingAt) / P7_AXIS_EVENT_FADE_OUT_MS);
    } else {
      cap = 1 - (now - next.triggeredAt) / P7_AXIS_EVENT_FADE_OUT_MS;
    }
    opacity = Math.min(opacity, Math.max(0, cap));
  }
  return opacity;
}

function p7DrawAxisEvents(ctx, W, axisY, curX, hoverActive, highlightX) {
  p7UpdateAxisEventTriggers(W);
  const now = performance.now();
  ctx.save();
  ctx.font = P7_AXIS_EVENT_FONT;
  ctx.textBaseline = "alphabetic";

  // Persistent circle markers: every event the growing edge has reached keeps a
  // circle on the axis even after its headline label has crossfaded away (per
  // the "keep its circle on the axis, upon hover it reappears" requirement).
  // "Reached" is tied to the current fill edge (event x >= curX), so a circle
  // appears the moment scroll passes its date and disappears again if the user
  // scrolls back above it — the same reached/unreached signal the year rings use.
  // The circles are drawn here (rather than only per-visible-entry below) and
  // their positions cached for p7HoverInit's hit-test. hoveredAxisEvent's own
  // circle is highlighted; while a timeline square is hovered elsewhere
  // (hoverActive) they all dim like the rest of the axis.
  p7.axisEventPositions = new Map();
  const hoveredAxisEvent = p7.hoveredAxisEvent;
  // Eased once per frame, before anything reads it below.
  const rosterTarget = hoverActive ? 1 : 0;
  p7AxisRosterT += (rosterTarget - p7AxisRosterT) * P7_AXIS_HOVER_ANIM_SPEED;
  if (Math.abs(rosterTarget - p7AxisRosterT) < 0.001) p7AxisRosterT = rosterTarget;
  P7_AXIS_EVENTS.forEach((ev, i) => {
    const x = p7AxisEventX[i] !== undefined ? p7AxisEventX[i] : p7AxisEventTrueX(ev, i, W);
    const reached = x >= curX;
    const state = P7_AXIS_EVENT_STATE[i];
    // Ease presence rather than switching it: scrolling back up now shrinks the
    // dot away over the same handful of frames it grew in over, instead of
    // deleting it mid-fade. Below ~0 it stops drawing (and stops being
    // hit-testable) entirely.
    const reachedTarget = reached ? 1 : 0;
    state.reachedT += (reachedTarget - state.reachedT) * P7_AXIS_HOVER_ANIM_SPEED;
    if (Math.abs(reachedTarget - state.reachedT) < 0.001) state.reachedT = reachedTarget;
    if (!reached) state.hoverT = 0;
    if (state.reachedT <= 0.001) return;
    const isAxisHovered = hoveredAxisEvent === ev;
    // Ease hoverT toward its target (1 hovered, 0 not) once per frame — this is
    // what makes the hover grow/shrink animate instead of snap.
    const hoverTarget = isAxisHovered ? 1 : 0;
    state.hoverT += (hoverTarget - state.hoverT) * P7_AXIS_HOVER_ANIM_SPEED;
    if (Math.abs(hoverTarget - state.hoverT) < 0.001) state.hoverT = hoverTarget;
    // The circle shrinks as its label crossfades away, and grows back to full
    // size when the label is showing (freshly reached / mid-crossfade) or the
    // circle itself is hovered — so a faded event reads as a smaller dot until
    // pointed at. "Prominence" (0 faded → 1 full) is the larger of the label's
    // own opacity and the eased hover amount, interpolating the radius between
    // P7_AXIS_MARKER_RADIUS_FADED and P7_AXIS_MARKER_RADIUS.
    // The roster SHRINKS every dot rather than growing any: while a square is
    // hovered, all the axis circles read small and equal — including the one
    // whose label is currently showing at full size — so the revealed labels
    // are the only thing the roster adds, and nothing competes with the square
    // actually being hovered. Scaled by (1 - p7AxisRosterT) so the shrink and
    // its regrow animate rather than snap.
    const prominence = Math.max(p7AxisEventOpacity(i, now), state.hoverT) * (1 - p7AxisRosterT);
    const markerRadius = (P7_AXIS_MARKER_RADIUS_FADED +
      (P7_AXIS_MARKER_RADIUS - P7_AXIS_MARKER_RADIUS_FADED) * prominence) * state.reachedT;
    p7.axisEventPositions.set(ev, { x, y: axisY, radius: markerRadius });
    // Wipe the line under the marker back to the frame background (see the
    // per-visible dot below for why), then fill. The wipe tracks the CURRENT
    // radius, not the full one: a fixed full-size hole left the line gapped
    // under a shrinking dot and then healed it in a single frame the moment the
    // dot vanished. Scaling it means the line closes back up continuously as the
    // dot shrinks. Safe because the canvas is fully repainted every frame, so
    // there are no leftover pixels from the previous, larger dot to cover.
    ctx.fillStyle = "#FDFCFF";
    ctx.beginPath();
    // The +1 breathing room is scaled by reachedT too — left at a flat +1 it was
    // still a 2px hole in the line at radius 0, which then closed in one frame.
    ctx.arc(x, axisY, markerRadius + state.reachedT, 0, Math.PI * 2);
    ctx.fill();
    const color = hoverActive
      ? (highlightX !== null && x === highlightX ? P7_AXIS_HOVER_COLOR : P7_AXIS_BG_COLOR)
      : (isAxisHovered ? P7_AXIS_HOVER_COLOR : P7_AXIS_FILLED_COLOR);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, axisY, markerRadius, 0, Math.PI * 2);
    ctx.fill();
  });

  // Collect all currently-visible entries with their horizontal extents so we
  // can detect overlap and nudge colliding labels before drawing anything. An
  // event whose persistent circle is hovered is forced visible at full opacity
  // even if its label had already crossfaded away.
  const visible = [];
  P7_AXIS_EVENTS.forEach((ev, i) => {
    // The eased hover amount re-shows a faded label (and holds it while the
    // hover fades back out), so include any event whose hoverT is still lifting
    // its opacity — not just currently-triggered ones.
    // While a regular timeline square is hovered (hoverActive), every ALREADY
    // REACHED headline event's label is forced on, not just the one currently
    // crossfading — the hover turns the axis into a reference key for reading
    // where that square sits among the headlines so far. Events the scrub has
    // not passed yet stay hidden: the roster must never spoil what is still
    // ahead. "Reached" is the trigger state's own definition (triggeredAt set
    // and not currently reversing out), so scrolling back un-reveals in step.
    // They render at the same faint state3 alpha as the rest of the dimmed axis
    // (see labelAlpha below) — a quiet roster, not seven full-black labels.
    const st = P7_AXIS_EVENT_STATE[i];
    const rosterOn = st.triggeredAt !== null && st.leavingAt === null;
    const opacity = Math.max(
      p7AxisEventOpacity(i, now),
      st.hoverT,
      rosterOn ? p7AxisRosterT : 0
    );
    if (opacity <= 0) return;
    const { x, left, right, lineX, lines } = p7AxisEventBounds(ctx, ev, i, W);
    visible.push({ ev, i, x, lineX, left, right, opacity, lines, textWidth: right - left });
  });

  // When two labels' horizontal extents collide, shift the older one
  // sideways — away from the newer one — rather than stacking it to a second
  // vertical tier above. A fast flick-scroll can cross several event dates
  // within a single frame (p7UpdateAxisEventTriggers gives them all the same
  // triggeredAt), so more than 2 labels can be visible at once — resolved
  // newest-first: the most recently triggered label keeps its natural
  // position, and each older label is pushed away from *every*
  // already-placed (newer) label it collides with, chained rather than
  // pairwise, so two older labels shifted toward the same side don't just
  // land on top of each other instead.
  const OVERLAP_PAD = 8; // minimum horizontal clearance between labels
  for (let idx = visible.length - 1; idx >= 0; idx--) {
    const entry = visible[idx];
    let { left, right } = entry;
    let moved = true, guard = 0;
    while (moved && guard++ < visible.length) {
      moved = false;
      for (let j = idx + 1; j < visible.length; j++) {
        const p = visible[j];
        if (right + OVERLAP_PAD < p.left || p.right + OVERLAP_PAD < left) continue;
        if (entry.x >= p.x) { left = p.right + OVERLAP_PAD; right = left + entry.textWidth; }
        else                { right = p.left - OVERLAP_PAD; left = right - entry.textWidth; }
        moved = true;
      }
    }
    // Re-clamp after shifting: without this a block pushed toward an edge can
    // run off the canvas, and the next one then lands on top of what is
    // visually pinned at that edge instead of clearing it.
    if (left < 0)      { left = 0; right = entry.textWidth; }
    else if (right > W) { right = W; left = W - entry.textWidth; }
    entry.left = left; entry.right = right;
    entry.lineX = (left + right) / 2;
  }

  visible.forEach((entry) => {
    const { ev, lineX, opacity, lines } = entry;
    const yOff = P7_AXIS_EVENT_LABEL_OFFSET;
    // Every line is centred on the block's own centre (lineX) rather than
    // anchored to the event's real x — lineX is recomputed from left/right
    // after de-collision, so it stays correct however far a collision above
    // has pushed the block from its anchor, and it keeps a wrapped title's
    // lines centred on each other and on the date below them.
    ctx.textAlign = "center";

    // In state3 (a dot elsewhere is hovered), the label dims to the same
    // faint alpha as every other non-highlighted axis element — unless this
    // very event's own marker is the one being highlighted (see markerColor
    // below), in which case it stays fully visible.
    const isHoverHighlighted = hoverActive && highlightX !== null && lineX === highlightX;
    const labelAlpha = (hoverActive && !isHoverHighlighted) ? P7_AXIS_BG_ALPHA : 1;
    ctx.font = P7_AXIS_EVENT_FONT;
    ctx.fillStyle = `rgba(0, 0, 0, ${labelAlpha * opacity})`;
    // Wrapped lines stack UPWARD: the LAST line keeps the single-line baseline
    // (axisY - yOff) so the date underneath never moves, and earlier lines are
    // lifted a line-height each above it.
    lines.forEach((text, li) => {
      const y = axisY - yOff - (lines.length - 1 - li) * P7_AXIS_EVENT_LINE_HEIGHT;
      ctx.fillText(text, lineX, y);
    });

    // Date below the label — same color as the axis's own reached year labels
    // (P7_AXIS_LABEL_COLOR, via globalAlpha rather than string-parsing its
    // own alpha, same pattern as the marker circle below). In state3, dims to
    // the exact same faint alpha as the label above it (rather than a
    // proportional dim of its own already-lighter color, which would land
    // dimmer than the label instead of matching it).
    const dateLabel = p7FormatDateDMY(ev.date, ".");
    ctx.font = P7_AXIS_DATE_FONT;
    ctx.textAlign = "center";
    ctx.fillStyle = (hoverActive && !isHoverHighlighted) ? `rgba(0, 0, 0, ${P7_AXIS_BG_ALPHA})` : P7_AXIS_LABEL_COLOR;
    ctx.globalAlpha = opacity;
    ctx.fillText(dateLabel, lineX, axisY - yOff + P7_AXIS_DATE_OFFSET);
    ctx.globalAlpha = 1;
    // The event's own FILLED dot on the line is drawn once, up front, in the
    // persistent-circle pass above (it stays put whether or not this label is
    // showing) — nothing to redraw here.
  });

  ctx.restore();
}

// A headline event's tick/label position (see p7AxisEventBounds) — each
// event's true date x along the continuous line (no dot-snapping now that the
// line is solid rather than a row of discrete dots). Keyed by index into
// P7_AXIS_EVENTS; rebuilt fresh every frame, so a resize or date-range change
// can't leave a stale snap behind.
let p7AxisEventX = [];

// An event's rendered x = its true date position plus its own optional
// `xOffset` (screen px, − = left / later on this RTL axis, + = right). The
// offset is PURELY a rendering nudge to keep a dot from crowding a year ring
// it happens to land next to — `date` stays the truthful one and is what
// every trigger, the printed date label, and the crossfade order still use.
// Dot and label both read this, so they never separate.
function p7AxisEventTrueX(ev, i, W) {
  // An event dated past p7.maxDate (the dataset's last event) has no position
  // of its own on the line — p7AxisX would put it beyond the left end, floating
  // off the axis. Clamped to the span so it parks AT the end instead; give it an
  // xOffset to hold a gap there. Its printed date stays the real one.
  const x = Math.min(Math.max(p7AxisX(ev.date, W), P7_AXIS_MARGIN), W - P7_AXIS_MARGIN);
  return x + (ev.xOffset || 0);
}

function p7DrawYearAxis(ctx, W, H) {
  const ticks = p7AxisYearTicks();
  const rawCurX = p7AxisX(p7.currentDate, W);

  // A tick is "reached" once the growing edge has caught up to (or passed) its
  // x position — the start tick is always reached by definition.
  const visible = ticks.filter((tick, i) => i === 0 || p7AxisX(tick.dateStr, W) >= rawCurX);

  const axisY = H * P7_AXIS_Y_FRAC;
  ctx.save();

  // Build-in wipe (p7AxisIntroT, triggered by p7AxisTriggerIfNeeded) — clips
  // everything this function draws (line, markers, labels, headline events alike) to
  // [revealX, right edge] so the whole axis reveals right to left on its own
  // clock the first time it appears, starting from the same right-edge anchor
  // (p7.minDate/"2023") the scroll-driven fill above grows from. A no-op once
  // the wipe finishes (revealX reaches the left edge) or if it's not playing.
  const introT = p7AxisIntroT();
  if (introT < 1) {
    const rightEdge = W - P7_AXIS_MARGIN;
    const leftEdge   = P7_AXIS_MARGIN;
    const revealX = rightEdge - p7Ease(introT) * (rightEdge - leftEdge);
    ctx.beginPath();
    ctx.rect(revealX, 0, W - revealX, H);
    ctx.clip();
  }

  // The axis spans from p7.minDate's anchor (the right edge, "2023") to the
  // left margin (p7.maxDate). Year labels now sit BELOW the line, so the line
  // is one uninterrupted span with no label-clearance gaps — the fill can
  // start right at the right anchor rather than past a "2023" label's width.
  const rightAnchorX = p7AxisX(ticks[0].dateStr, W); // == W - P7_AXIS_MARGIN, the p7.minDate ("2023") end
  const leftEdgeX    = P7_AXIS_MARGIN;

  // Scroll-driven fill edge — the same lagged frac (0 at p7.minDate, 1 at
  // p7.maxDate) as before, mapped straight across the full span now that
  // there's no first-dot offset to rescale past. fillFrac is lagged
  // (p7AxisUpdateFillLag), not the raw scroll value, so the fill trails a beat
  // behind rather than snapping to scroll 1:1.
  const fillFrac = p7AxisUpdateFillLag();
  const curX = rightAnchorX - fillFrac * (rightAnchorX - leftEdgeX);

  // Events (and the hover highlight) render at their true date x on the
  // continuous line — no dot-snapping now that the line is solid, not a row of
  // discrete dots. p7AxisEventX is read by p7AxisEventBounds below.
  p7AxisEventX = P7_AXIS_EVENTS.map((ev, i) => p7AxisEventTrueX(ev, i, W));
  const hoveredEvent = p7.hoveredEvent;
  const hoverActive  = !!hoveredEvent;
  const hoverAxisX   = hoverActive ? p7AxisX(hoveredEvent.date, W) : null;

  // The line itself: one faint full-span base drawn first, then the dark
  // "reached" portion grown right-to-left from the right anchor to curX laid
  // on top — so it reads as a single line filling up, not a faint line with a
  // separate dark one beside it. While a dot elsewhere is hovered, the fill is
  // suspended (whole line stays faint) and the hovered event's own marker pops
  // instead (p7DrawAxisEvents).
  const lineTop = axisY - P7_AXIS_LINE_THICKNESS / 2;
  ctx.fillStyle = P7_AXIS_BG_COLOR;
  ctx.fillRect(leftEdgeX, lineTop, rightAnchorX - leftEdgeX, P7_AXIS_LINE_THICKNESS);
  if (!hoverActive) {
    ctx.fillStyle = P7_AXIS_FILLED_COLOR;
    ctx.fillRect(curX, lineTop, rightAnchorX - curX, P7_AXIS_LINE_THICKNESS);
  }

  // Hollow ring marker on the line at each year tick — faint until the growing
  // edge reaches it, then dark (same reached/unreached signal the labels use).
  // The line behind each ring is punched back to the frame background first so
  // the marker reads as a clean hollow O, not a filled disc with the line
  // showing through. In state3 (hover), every ring goes faint; the hovered
  // event's own position is drawn as a filled dot by p7DrawAxisEvents instead.
  const reachedTicks = new Set(visible);
  for (const tick of ticks) {
    const x = p7AxisX(tick.dateStr, W);
    const ringColor = hoverActive
      ? P7_AXIS_BG_COLOR
      : (reachedTicks.has(tick) ? P7_AXIS_FILLED_COLOR : P7_AXIS_BG_COLOR);
    ctx.fillStyle = "#FDFCFF";
    ctx.beginPath();
    ctx.arc(x, axisY, P7_AXIS_MARKER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth   = P7_AXIS_MARKER_STROKE;
    ctx.strokeStyle = ringColor;
    ctx.beginPath();
    ctx.arc(x, axisY, P7_AXIS_MARKER_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Year labels centered directly below each ring. Every label shows from the
  // start — but, like the line, stays faint until scroll actually reaches it,
  // then switches to the darker color. In state3, every label (reached or not)
  // drops to the same faint alpha as the dimmed axis event label/date.
  ctx.font = "18px 'Assistant', sans-serif";
  ctx.textAlign    = "center";
  ctx.textBaseline = "top";
  const labelY = axisY + P7_AXIS_MARKER_RADIUS + P7_AXIS_YEAR_LABEL_OFFSET;
  for (const tick of ticks) {
    ctx.fillStyle = hoverActive
      ? `rgba(0, 0, 0, ${P7_AXIS_BG_ALPHA})`
      : (reachedTicks.has(tick) ? P7_AXIS_LABEL_COLOR : P7_AXIS_LABEL_FAINT_COLOR);
    ctx.fillText(String(tick.year), p7AxisX(tick.dateStr, W), labelY);
  }
  ctx.restore();

  p7DrawAxisEvents(ctx, W, axisY, curX, hoverActive, hoverAxisX);

  // Hovering any timeline square marks that event's own date on the axis with a
  // filled circle in its group color (p7ActorColor) — a positional read-out of
  // where the hovered dot falls in time. Drawn last so it sits on top of the
  // (dimmed, state3) line/rings/event dots. Punch the line back to the frame
  // background first so the marker reads as a clean disc, same as every other
  // axis marker.
  if (hoverActive) {
    ctx.save();
    ctx.fillStyle = "#FDFCFF";
    ctx.beginPath();
    ctx.arc(hoverAxisX, axisY, P7_AXIS_MARKER_RADIUS + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p7ActorColor(hoveredEvent.actor);
    ctx.beginPath();
    ctx.arc(hoverAxisX, axisY, P7_AXIS_MARKER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Exposed so scroll and animation-loop redraws can re-test the cursor against
// newly drawn dots without requiring pointer movement — assigned inside
// p7HoverInit below (no-op until then, safe to call at any time).
let p7RecheckHover = () => {};

// Hover tooltip for a single event square in the real timeline (#page-7) — date
// + Hebrew description, reusing the exact same DOM element/styling as page9.js's
// hover (#page9Tooltip is generic markup, not page9-specific), and isolating the
// hovered square the same way p9PlaceDot does (see p7DrawSideSquares above).
function p7HoverInit() {
  const canvasEl  = document.getElementById("canvas");
  const tooltipEl = document.getElementById("page9Tooltip");
  const dateEl    = tooltipEl.querySelector(".page9-tooltip-date");
  const descEl    = tooltipEl.querySelector(".page9-tooltip-desc");

  const HIT_PAD = 3; // px of extra hit area around each P7_SQ=3 square, in every direction
  const AXIS_HIT_PAD = 6; // px of extra hit area around each axis event circle (small target, generous pad)
  const TOOLTIP_GAP = 5; // px of breathing room between the square and the tooltip box, both axes

  // Last pointer position in client (viewport) coordinates — updated on every
  // pointermove, read by doHitTest so re-checks after redraws don't need an event.
  let lastCX = null, lastCY = null;

  // #page9Tooltip is shared with page9.js's own hover (same element, see
  // p9HoverInit) — only clear it when this handler is the one that actually
  // showed it (p7.hoveredEvent set), or a stray pointermove/scroll on
  // whichever page page9's hover owns would stomp its tooltip right back
  // off the instant it appears, since both listen on window unconditionally.
  // Axis event circles are a separate, independent hover target from the
  // timeline squares above: hovering a persistent circle re-shows that event's
  // faded headline label (p7DrawAxisEvents forces its opacity to 1 while
  // hoveredAxisEvent points at it). Only a redraw is needed — no tooltip DOM,
  // since the label/date reappear on the canvas itself.
  function setAxisHover(ev) {
    if (p7.hoveredAxisEvent === ev) return;
    p7.hoveredAxisEvent = ev;
    // Drive the grow/shrink through the anim loop (hoverT eases per frame) rather
    // than a single snap redraw — p7AxisEventsAnimActive keeps it alive until the
    // ease settles.
    p7StartAnimLoop();
  }
  function updateAxisHover(mx, my) {
    let hit = null;
    for (const [ev, pos] of p7.axisEventPositions) {
      const dx = mx - pos.x, dy = my - pos.y;
      const r = pos.radius + AXIS_HIT_PAD;
      if (dx * dx + dy * dy <= r * r) { hit = ev; break; }
    }
    setAxisHover(hit);
  }

  // Clears only the timeline-square tooltip/hover — leaves any axis-circle hover
  // untouched, so moving the pointer off a square onto (or still over) an axis
  // circle doesn't stomp the reappeared label.
  function hideSquare() {
    if (!p7.hoveredEvent) return;
    tooltipEl.classList.remove("is-visible");
    p7.hoveredEvent = null;
    draw();
    // The 8 @fold9 squares' own opacity (a DOM style, not part of the canvas
    // draw() above) also dims/undims with hover — see updateGroups' own
    // p7.hoveredEvent check — so it needs its own refresh here too.
    if (typeof updateGroups === "function") updateGroups();
  }

  // Full clear (square + axis) — for leaving #page-7 entirely.
  function hide() {
    setAxisHover(null);
    hideSquare();
  }

  // Runs the hit-test against p7.lastPositions using the cached cursor
  // position. Called both from onMove (pointer moved) and from p7RecheckHover
  // (canvas just redrew — new dots may have appeared under a stationary cursor).
  function doHitTest() {
    if (lastCX === null || currentPage !== 7) { hide(); return; }

    const rect = canvasEl.getBoundingClientRect();
    const mx = lastCX - rect.left;
    const my = lastCY - rect.top;

    // Axis event circles first — independent of the square scan below (a circle
    // sits on the axis line, well clear of the squares), so both can be checked
    // every move without one masking the other.
    updateAxisHover(mx, my);

    const half = P7_SQ / 2;

    // Brute-force nearest-square scan — p7.lastPositions only holds the
    // squares actually drawn this frame, already in CSS-pixel space (same as
    // getBoundingClientRect, so no DPR conversion needed).
    let bestEvent = null, bestPos = null, bestDist = Infinity;
    for (const [ev, pos] of p7.lastPositions) {
      const cx = pos.x + half, cy = pos.y + half;
      const dx = mx - cx, dy = my - cy;
      if (Math.abs(dx) > half + HIT_PAD || Math.abs(dy) > half + HIT_PAD) continue;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) { bestDist = dist; bestEvent = ev; bestPos = pos; }
    }

    if (!bestEvent) { hideSquare(); return; }

    // Redraw with this square isolated only when the hovered event actually
    // changes — not on every check over the same square.
    if (p7.hoveredEvent !== bestEvent) {
      p7.hoveredEvent = bestEvent;
      draw();
      // Same DOM-opacity refresh as hide() above — see that comment.
      if (typeof updateGroups === "function") updateGroups();
      // draw() just rebuilt p7.lastPositions — bestPos (read below for
      // tooltip placement) still points at the same {x,y}, since dimming
      // only changes alpha, but refresh the reference for clarity/safety.
      bestPos = p7.lastPositions.get(bestEvent);
    }

    dateEl.textContent = p7FormatDateDMY(bestEvent.date);
    descEl.textContent = bestEvent.descHeMedium;
    // `color`, not `border-color`: the visible stroke is the dashed <svg>
    // overlay (updateTooltipDash, main.js), which strokes currentColor.
    tooltipEl.style.color = p7ActorColor(bestEvent.actor);
    tooltipEl.classList.add("is-visible");

    // Left-side events open the tooltip toward the left of the square instead
    // of the right, so it doesn't reach across the canvas's center gap into
    // the opposite side's column — same mirroring convention as page9.js.
    const mirrored = bestEvent.side === "left";
    tooltipEl.classList.toggle("is-mirrored", mirrored);

    const dotClientX = rect.left + bestPos.x;
    const dotClientY = rect.top  + bestPos.y;
    const rawLeft = mirrored
      ? dotClientX - TOOLTIP_GAP - tooltipEl.offsetWidth
      : dotClientX + TOOLTIP_GAP;
    const left = Math.max(8, Math.min(rawLeft, window.innerWidth - tooltipEl.offsetWidth - 8));
    const top  = Math.max(dotClientY - TOOLTIP_GAP - tooltipEl.offsetHeight, 8);
    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top  = `${top}px`;
    // After sizing/mirroring are settled — the dash path is drawn to the box's
    // actual pixel size, which changes with the description's line count.
    updateTooltipDash(tooltipEl);
  }

  function onMove(e) {
    lastCX = e.clientX;
    lastCY = e.clientY;
    doHitTest();
  }

  // Expose so callers outside this closure (scroll handler, animation loop)
  // can re-run the hit-test after the canvas redraws.
  p7RecheckHover = doHitTest;

  // Listens on window for the same reason page9.js's p9HoverInit does: other
  // DOM overlays can sit on top of the canvas depending on scroll position.
  window.addEventListener("pointermove", onMove);
  window.addEventListener("scroll", () => {
    if (currentPage !== 7) hide();
  }, { passive: true });
}

p7HoverInit();
