// page7.js — scroll-driven event timeline
// ── Appearance controls ──────────────────
// Square size/gap matched to page9.js (P9_SQ/P9_GAP) — page7 and page9 will
// later be cross-animated, so dot geometry must agree between them. Placement
// builds outward from the center gap (see p7OrderFromCenter), not page9's
// column-major grid.
const P7_SQ  = 3;  // square size in px
const P7_GAP = 1;  // gap between squares in px
const P7_CELL = P7_SQ + P7_GAP; // grid cell size (do not edit)
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
  // The event currently under the pointer in #page-8 (set by p7HoverInit's
  // onMove), or null — read by p7DrawSideSquares to dim every other square
  // while one is hovered.
  hoveredEvent: null,
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

// Binary search: how many events have date <= target
function p7Bisect(events, target) {
  let lo = 0, hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid].date <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
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
// p7MonthAnimStart records a start time per month (not just "the current one"), so a
// month's cascade keeps playing to completion on its own clock even after the user
// scrolls past it and it's no longer centered — nothing here ever gets force-settled.
//
// Scrolling backward past a month reverses it: p7MonthReverseStart records when that
// retreat began, and p7MonthMaxReached is the highest month ever reached so the draw
// loop knows to keep rendering (and retracting) months ahead of the current one
// instead of just snapping them away. See p7DrawSideSquares for how forward/reverse
// share the same pop, just shrinking/fading out instead of growing/fading in.
const P7_ANIM_TOTAL_DURATION = 2200; // ms — full span of a month's staggered cascade
const P7_POP_DURATION        = 220;  // ms — each individual square's own pop in/out
const p7MonthAnimStart    = {}; // monthKey -> performance.now() timestamp (forward)
const p7MonthReverseStart = {}; // monthKey -> performance.now() timestamp (retreat)
let p7MonthMaxReached = -1;     // highest monthKey ever reached, forward
let p7AnimRunning = false;

// True once fold 9's own title card (#page-7 .text-card, page7TitleCardEl in
// main.js) has scrolled all the way past the top of the viewport — not once
// #page-8 itself reaches the top, which (since #page-7's card sits vertically
// centered in its own 100vh-tall section) only happens half a viewport-height
// *after* the card is already gone, leaving a stretch of scrolling where
// nothing visibly happens before the real per-event reveal kicks in. Tying
// engagement directly to the card's own exit instead means the timeline
// starts exactly when the title that introduces it leaves the screen, no
// matter how main.js ends up sizing #page-7's section.
let p7HasEngaged = false;

// window.scrollY snapshot of the moment the year axis itself became ready
// (fold9SquaresFadeTrigger settled, see p7AxisShouldShow) — null whenever it
// isn't ready right now. A *fixed* extra scroll distance past the axis's own
// position threshold doesn't work here: that threshold is a 1900ms tween, not
// an instant position check, so for any normal continuous scroll the position
// requirement alone is satisfied well before the tween itself settles —
// making the tween the only real bottleneck either way, with no actual gap
// between axis and squares. Anchoring the push to wherever the tween actually
// finished avoids that.
let p7AxisReadyScrollY = null;
const P7_ENGAGE_EXTRA_PUSH_PX = 100; // small extra scroll past axis-ready before squares engage

// Updates p7AxisReadyScrollY and p7HasEngaged — called from drawPage7
// (currentPage 9) and drawFold9 (main.js, currentPage 8) alike, since the
// title card this depends on belongs to fold 9/#page-8. p7HasEngaged is
// recomputed fresh every call, not a one-way latch, so scrolling back up
// un-engages it again and scrolling forward replays the same
// axis-then-squares sequence — calling this from both draw functions (rather
// than only drawPage7) is what makes that reversal actually take effect
// immediately while currentPage is 8, instead of freezing at whatever it last
// was the moment currentPage left 9.
function p7UpdateEngagement() {
  if (fold9SquaresFadeTrigger.currentRaw() === 1) {
    if (p7AxisReadyScrollY === null) p7AxisReadyScrollY = window.scrollY;
  } else {
    p7AxisReadyScrollY = null;
  }
  p7HasEngaged = !!(page7TitleCardEl && page7TitleCardEl.getBoundingClientRect().top <= 0 &&
      p7AxisReadyScrollY !== null &&
      Math.abs(window.scrollY - p7AxisReadyScrollY) >= P7_ENGAGE_EXTRA_PUSH_PX);
}

function p7AnyAnimActive() {
  const now = performance.now();
  for (const k in p7MonthAnimStart) {
    if (now - p7MonthAnimStart[k] < P7_ANIM_TOTAL_DURATION) return true;
  }
  for (const k in p7MonthReverseStart) {
    if (now - p7MonthReverseStart[k] < P7_ANIM_TOTAL_DURATION) return true;
  }
  if (p7AxisEventsAnimActive()) return true;
  if (p7AxisIntroStart !== null && p7AxisIntroT() < 1) return true;
  return false;
}

// page8 (index 10) renders by calling drawPage7 directly with currentDate forced to
// maxDate (see page8.js) — it's a continuation of page7's view, not a separate one, so
// the cascade must keep redrawing there too, or it freezes the instant the user
// scrolls into page8 mid-flight instead of finishing "off screen" as page7 intended.
// Fold 9 (#page-8, currentPage 8 — drawFold9 in main.js, just before the real
// timeline) is included too, now that its own axis build-in (p7AxisIntroT
// above) can be playing while it's on screen. Fold 7 (#page-7, drawFold7) has
// no page7 content on screen at all, so it's still deliberately excluded.
function p7ShouldRedrawForAnim() { return currentPage === 8 || currentPage === 9 || currentPage === 10; }

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
// events are date-sorted, each month's events are contiguous, so the per-month group
// boundaries (cascade start time, forward vs. reverse) are recomputed only when the
// month actually changes while scanning, not on every single event.
//
// A group is "reverse" when its month is ahead of curMonthKey (the user scrolled back
// past it): its cascade order is mirrored (the last square to arrive is the first to
// leave), shrinking/fading out the same way the entrance grew/faded in.
function p7DrawSideSquares(ctx, events, positions, x0, topY, cols, CELL, SQ, monthEnd, settledCount, curMonthKey, posMap) {
  const stagger = Math.max(0, P7_ANIM_TOTAL_DURATION - P7_POP_DURATION);
  let groupMonthKey = null, groupStart = 0, groupEnd = 0, groupStartTime = 0, groupReverse = false;

  for (let i = 0; i < monthEnd; i++) {
    const cell = positions[i];
    const col  = cell % cols;
    const row  = Math.floor(cell / cols);
    const destX = x0 + col * CELL;
    const destY = topY + row * CELL;

    let scale = 1, alpha = 1;
    if (i >= settledCount) {
      const mk = p7MonthKeyOf(events[i].date);
      if (mk !== groupMonthKey) {
        groupMonthKey  = mk;
        groupStart     = i;
        groupEnd       = p7BisectBefore(events, p7MonthKeyToStartStr(mk + 1));
        groupReverse   = mk > curMonthKey;
        groupStartTime = groupReverse ? p7MonthReverseStart[mk] : p7MonthAnimStart[mk];
      }

      const elapsed = groupStartTime !== undefined ? performance.now() - groupStartTime : Infinity;
      const countInGroup = groupEnd - groupStart;
      const localIdx = i - groupStart;
      const orderIdx = groupReverse ? (countInGroup - 1 - localIdx) : localIdx;
      const delay = countInGroup > 1 ? (orderIdx / (countInGroup - 1)) * stagger : 0;
      const t = Math.min(1, Math.max(0, (elapsed - delay) / P7_POP_DURATION));
      if (groupReverse ? t >= 1 : t <= 0) continue; // fully gone, or not popped in yet
      const e = p7Ease(t);
      const presence = groupReverse ? 1 - e : e; // 0 = gone, 1 = fully popped in

      // Nothing pops from nothing: start at a visible (if small) size rather than 0.
      scale = 0.5 + 0.5 * presence;
      alpha = presence;
    }

    posMap.set(events[i], { x: destX, y: destY, alpha });

    // While one square is hovered (p7.hoveredEvent, set by p7HoverInit — see
    // below), it's drawn fully opaque and every other square is dimmed, so it
    // reads as isolated against the grid — same convention as page9.js's
    // p9PlaceDot.
    let drawAlpha = alpha;
    if (p7.hoveredEvent) drawAlpha = (events[i] === p7.hoveredEvent) ? 1 : alpha * 0.35;

    const size = SQ * scale;
    const off  = (SQ - size) / 2; // keep the shrink/grow centered on the cell
    ctx.globalAlpha = drawAlpha;
    ctx.fillStyle = p7ActorColor(events[i].actor);
    ctx.fillRect(destX + off, destY + off, size, size);
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

  p7.lastW = W;
  p7.lastH = H;
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

  p7UpdateLayout(W, H);

  const { CELL, SQ, cols, leftX0 } = p7;
  const topY    = Math.round(H * SBB_TIMELINE.top);
  const centerX = W / 2;
  const rightX0 = W / 2 + CENTER_GAP / 2;

  // Events from months whose cascade has already fully finished are settled (drawn
  // at rest, no animation); events from the centered month, or from any earlier month
  // whose cascade is still mid-flight (the user scrolled past it before it finished),
  // keep animating on their own clock — see p7DrawSideSquares/p7MonthAnimStart. The
  // loop's upper bound must cover the *whole* centered month (monthEndL/monthEndR),
  // not just events whose date has already been reached, so the full cascade can play.
  const { y: curY, m: curM } = p7DateDayFrac(p7.currentDate);
  const curMonthKey = curY * 12 + curM;
  const now = performance.now();

  // Only a month that's genuinely beyond anything reached before gets a fresh forward
  // cascade. A month can have no forward-start yet without being new territory — e.g.
  // it was scrolled past quickly and skipped while moving forward, and we're now
  // landing on it while moving *backward* — in which case it should just appear
  // settled, not fire off a brand new entrance while the user is scrolling the other way.
  //
  // The very first month (minDate's month) starts out "current" before the user has
  // scrolled into page7 at all — p7HasEngaged (updated by p7UpdateEngagement,
  // called from both here and drawFold9 in main.js so it stays accurate even
  // while currentPage is 8) only flips true once fold 9's title card has
  // scrolled P7_ENGAGE_EXTRA_PUSH_PX past the top of the viewport, AND
  // fold9SquaresFadeTrigger (the same gate the axis itself waits for) has settled.
  p7UpdateEngagement();
  const isNewTerritory = p7HasEngaged && curMonthKey > p7MonthMaxReached;
  if (p7HasEngaged && p7MonthAnimStart[curMonthKey] === undefined) {
    p7MonthAnimStart[curMonthKey] = isNewTerritory ? now : now - P7_ANIM_TOTAL_DURATION;
  }
  if (isNewTerritory) p7StartAnimLoop();
  // Scrolling back onto a month cancels any retreat it had started — it just resumes
  // showing at rest (its original forward cascade, started long ago, is already done).
  delete p7MonthReverseStart[curMonthKey];

  if (p7HasEngaged && curMonthKey > p7MonthMaxReached) p7MonthMaxReached = curMonthKey;

  // Scrolled backward past months that were previously reached: start their retreat
  // (each flies back out the same way it flew in) unless it's already retreating.
  for (let k = curMonthKey + 1; k <= p7MonthMaxReached; k++) {
    if (p7MonthReverseStart[k] === undefined) {
      p7MonthReverseStart[k] = now;
      p7StartAnimLoop();
    }
  }
  // Once every month ahead of the centered one has fully retreated, stop tracking
  // (and drawing) them — otherwise we'd iterate them forever.
  while (
    p7MonthMaxReached > curMonthKey &&
    p7MonthReverseStart[p7MonthMaxReached] !== undefined &&
    now - p7MonthReverseStart[p7MonthMaxReached] >= P7_ANIM_TOTAL_DURATION
  ) {
    delete p7MonthReverseStart[p7MonthMaxReached];
    delete p7MonthAnimStart[p7MonthMaxReached];
    p7MonthMaxReached--;
  }

  // Walk backward from the centered month while previous months are still mid-cascade,
  // to find the earliest month that must still be drawn with animation applied.
  let earliestActiveMonthKey = curMonthKey;
  for (let k = curMonthKey - 1; p7MonthAnimStart[k] !== undefined && now - p7MonthAnimStart[k] < P7_ANIM_TOTAL_DURATION; k--) {
    earliestActiveMonthKey = k;
  }
  const settledStr = p7MonthKeyToStartStr(earliestActiveMonthKey);

  // The draw range's upper bound covers through whichever is further out: the
  // centered month, or a later month still retreating back toward the origin.
  // Before the section has actually engaged, clamp to p7.minDate itself — not
  // curMonthKey's own start — so nothing draws at all regardless of how far
  // curMonthKey has already raced ahead: p7.currentDate is driven straight off
  // raw scroll position (page7UpdateFromScroll, main.js) with no engagement
  // gating of its own, so curMonthKey can be well past the first month before
  // p7HasEngaged ever flips (see its own definition above — it's now
  // deliberately delayed past the year axis's own appearance). Clamping to
  // curMonthKey's start instead of p7.minDate used to work only because
  // engagement used to flip almost immediately, keeping curMonthKey pinned at
  // (or near) the first month for the entire time it was false.
  const drawThroughMonthKey = Math.max(curMonthKey, p7MonthMaxReached);
  const nextMonthStartStr = p7HasEngaged
    ? p7MonthKeyToStartStr(drawThroughMonthKey + 1)
    : p7.minDate;
  const settledL  = p7BisectBefore(p7.leftEvents,  settledStr);
  const settledR  = p7BisectBefore(p7.rightEvents, settledStr);
  const monthEndL = p7BisectBefore(p7.leftEvents,  nextMonthStartStr);
  const monthEndR = p7BisectBefore(p7.rightEvents, nextMonthStartStr);

  const posMap = new Map();

  // Draw left events.
  p7DrawSideSquares(ctx, p7.leftEvents, p7.leftPos, leftX0, topY, cols, CELL, SQ, monthEndL, settledL, curMonthKey, posMap);

  // Draw right events.
  p7DrawSideSquares(ctx, p7.rightEvents, p7.rightPos, rightX0, topY, cols, CELL, SQ, monthEndR, settledR, curMonthKey, posMap);

  p7.lastPositions = posMap;

  if (p7AxisTriggerIfNeeded()) p7DrawYearAxis(ctx, W, H);
}

// The year axis (dotted line, year labels, headline events — everything
// p7DrawYearAxis draws) is sequenced *after* the fold-6 squares' fade-out, not
// driven by its own independent scroll point: fold9SquaresFadeTrigger
// (main.js) fades the squares+labels out once @fold8's own title card reaches
// the upper quarter of the viewport, and only once that fade tween has fully
// settled at its target (currentRaw() === 1 — exact, not an epsilon check,
// since makeTrigger's targets are always exactly 0 or 1) does the axis start
// its build-in. Recomputed fresh every frame — scrolling back up before the
// fade settles (or after, restarting the reverse) hides the axis again with
// no extra reverse bookkeeping needed (see p7AxisTriggerIfNeeded below for
// the one-shot build-in animation this gates).
function p7AxisShouldShow() {
  return fold9SquaresFadeTrigger.currentRaw() === 1;
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
const P7_AXIS_MARGIN          = 48;   // px inset from each edge
const P7_AXIS_Y_FRAC          = 0.93;  // fraction of H — shared vertical center for the dashed line and year labels (Figma: both sit on one row, not stacked)
const P7_AXIS_LINE_THICKNESS  = 6;     // px — also the dot diameter (round line cap)
const P7_AXIS_DOT_GAP         = 10;    // px between dot centers
const P7_AXIS_LABEL_PAD       = 12;    // px breathing room around a label's measured width
const P7_AXIS_BG_COLOR        = "rgba(0, 0, 0, 0.08)"; // faint full-span line, under the dark "filled" overlay
const P7_AXIS_FILLED_COLOR    = "rgba(0, 0, 0, 0.4)";  // the portion scroll has already reached
const P7_AXIS_LABEL_FAINT_COLOR = "rgba(0, 0, 0, 0.12)"; // unreached year label — same faint/filled ratio as the dots
const P7_AXIS_LABEL_COLOR       = "rgba(0, 0, 0, 0.46)"; // reached year label

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
const P7_AXIS_EVENTS = [
  { date: "2023-01-01", label: "הצגת הרפורמה המשפטית" },
  { date: "2023-07-01", label: "אישור ביטול עילת הסבירות" },
  { date: "2023-10-07", label: "מתקפת 7 באוקטובר" },
  { date: "2024-06-01", label: "פסיקת בג\"ץ על גיוס חרדים" },
  { date: "2025-06-01", label: "מבצע עם כלביא" },
  { date: "2025-10-01", label: "הסכם הפסקת אש ושחרור חטופים בעזה" },
];

// Fixed real-time (wall-clock) fade durations — these only govern the crossfade
// itself, not how long an event stays fully visible (that's driven by scroll: it
// holds at full opacity for as long as the next event remains unreached). Once a
// fade starts it plays out on its own clock (via p7StartAnimLoop/p7AnyAnimActive
// below) even if the user stops scrolling entirely.
const P7_AXIS_EVENT_FADE_IN_MS  = 400;
const P7_AXIS_EVENT_FADE_OUT_MS = 1000;
const P7_AXIS_EVENT_LABEL_OFFSET = 44; // px above the axis line (lifted to give date room below)
const P7_AXIS_EVENT_FONT         = "14px 'Assistant', sans-serif";
const P7_AXIS_EVENT_LINE_GAP     = 8;   // px of clearance below the label's baseline before the tick starts
const P7_AXIS_EVENT_LINE_END_GAP = 8;   // px of clearance above the axis line — tick stops short, doesn't touch it
const P7_AXIS_EVENT_LINE_OPACITY_SCALE = 0.35; // tick is fainter than its own label, not an equal match
const P7_AXIS_DATE_FONT          = "14px 'Assistant', sans-serif";
const P7_AXIS_DATE_OFFSET        = 18;  // px above the label baseline
const P7_AXIS_DATE_OPACITY_SCALE = 0.5; // date is dimmer than its label

// triggeredAt is a performance.now() timestamp, set once when the event is first
// reached and cleared if the user scrolls back above its date — null means "not
// currently triggered" (either never reached yet, or reached-then-reversed).
// Scrolling back above the *next* event's date clears that next one's own
// triggeredAt, which is what un-does this event's fade-out (see p7AxisEventOpacity)
// and brings it back to full opacity — no separate reverse bookkeeping needed.
const P7_AXIS_EVENT_STATE = P7_AXIS_EVENTS.map(() => ({ triggeredAt: null }));

// Checked every draw (see p7AnyAnimActive) so the animation loop keeps running —
// and labels keep fading — purely on elapsed time, with no further scrolling
// required.
function p7AxisEventsAnimActive() {
  const now = performance.now();
  return P7_AXIS_EVENT_STATE.some((state, i) => {
    if (state.triggeredAt === null) return false;
    if (now - state.triggeredAt < P7_AXIS_EVENT_FADE_IN_MS) return true;
    const next = P7_AXIS_EVENT_STATE[i + 1];
    return !!next && next.triggeredAt !== null && now - next.triggeredAt < P7_AXIS_EVENT_FADE_OUT_MS;
  });
}

// Fires each event's one-shot animation the instant p7.currentDate reaches its
// date, regardless of how the user got there (slow scroll, fast flick, or a
// direct jump) — and un-fires it if they scroll back above that date. Requires
// p7.currentDate to have actually advanced past p7.minDate first: the pinned
// scrub section (page7UpdateFromScroll, main.js) starts every visit at exactly
// t=0 → currentDate=minDate, before the user has scrolled within it at all, and
// the first event's own date (2023-01-01) sits *before* the dataset's actual
// minDate (2023-01-10) — so without this, "reached" would already be true on
// arrival and the event would show before any scrolling happened.
function p7UpdateAxisEventTriggers() {
  const curMs = new Date(p7.currentDate + "T00:00:00Z").getTime();
  const minMs = new Date(p7.minDate + "T00:00:00Z").getTime();
  const hasScrolled = curMs > minMs;
  P7_AXIS_EVENTS.forEach((ev, i) => {
    const state = P7_AXIS_EVENT_STATE[i];
    const reached = hasScrolled && curMs >= new Date(ev.date + "T00:00:00Z").getTime();
    if (reached && state.triggeredAt === null) {
      state.triggeredAt = performance.now();
      p7StartAnimLoop();
    } else if (!reached && state.triggeredAt !== null) {
      state.triggeredAt = null;
    }
  });
}

// Fades in on its own trigger, then holds at full opacity indefinitely — until
// the next event triggers, at which point it fades out on *that* event's clock
// (a crossfade, not a fixed-duration toast).
function p7AxisEventOpacity(i, now) {
  const state = P7_AXIS_EVENT_STATE[i];
  if (state.triggeredAt === null) return 0;
  let opacity = Math.min(1, (now - state.triggeredAt) / P7_AXIS_EVENT_FADE_IN_MS);
  const next = P7_AXIS_EVENT_STATE[i + 1];
  if (next && next.triggeredAt !== null) {
    const fadeOut = 1 - (now - next.triggeredAt) / P7_AXIS_EVENT_FADE_OUT_MS;
    opacity = Math.min(opacity, Math.max(0, fadeOut));
  }
  return opacity;
}

function p7DrawAxisEvents(ctx, W, axisY) {
  p7UpdateAxisEventTriggers();
  const now = performance.now();
  ctx.save();
  ctx.font = P7_AXIS_EVENT_FONT;
  ctx.textBaseline = "alphabetic";

  // Collect all currently-visible entries with their horizontal extents so we
  // can detect overlap and nudge colliding labels before drawing anything.
  const visible = [];
  P7_AXIS_EVENTS.forEach((ev, i) => {
    if (P7_AXIS_EVENT_STATE[i].triggeredAt === null) return;
    const opacity = p7AxisEventOpacity(i, now);
    if (opacity <= 0) return;
    const x = p7AxisX(ev.date, W);
    const textWidth = ctx.measureText(ev.label).width;
    // Centered text would push past the canvas edge for an event anchored right
    // at it — fall back to right/left alignment (extending only inward) near
    // either edge instead of going out of frame.
    let align = "center", left, right;
    if (x + textWidth / 2 > W)      { align = "right"; left = x - textWidth; right = x; }
    else if (x - textWidth / 2 < 0) { align = "left";  left = x; right = x + textWidth; }
    else                             { left = x - textWidth / 2; right = x + textWidth / 2; }
    // Tick always marks the label's horizontal center, even when textAlign shifts
    // the glyphs off-center from x near the canvas edges.
    const lineX = align === "right" ? x - textWidth / 2
                : align === "left"  ? x + textWidth / 2
                : x;
    visible.push({ ev, i, x, lineX, align, left, right, opacity });
  });

  // Assign y offsets — when two labels' horizontal extents collide, push the
  // lower-indexed one (the outgoing event, fading out during a crossfade) to a
  // second tier so they don't overlap on screen. The higher-indexed (incoming)
  // event stays at the natural base position.
  const OVERLAP_PAD = 8; // minimum horizontal clearance between labels
  const BASE_Y = P7_AXIS_EVENT_LABEL_OFFSET;
  const BUMP_Y = BASE_Y + 22; // ~14px font height + 8px gap clears BASE_Y tier
  const yOffsets = visible.map(() => BASE_Y);
  for (let a = 0; a < visible.length; a++) {
    for (let b = a + 1; b < visible.length; b++) {
      const A = visible[a], B = visible[b];
      if (A.right + OVERLAP_PAD < B.left || B.right + OVERLAP_PAD < A.left) continue;
      yOffsets[a] = BUMP_Y; // a is the older (outgoing) event — bump it up
    }
  }

  visible.forEach((entry, idx) => {
    const { ev, x, lineX, align, opacity } = entry;
    const yOff = yOffsets[idx];
    ctx.textAlign = align;

    ctx.font = P7_AXIS_EVENT_FONT;
    ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
    ctx.fillText(ev.label, x, axisY - yOff);

    // Date below the label, lower opacity
    const [y, m, d] = ev.date.split('-');
    const dateLabel = `${d}.${m}.${y}`;
    ctx.font = P7_AXIS_DATE_FONT;
    ctx.fillStyle = `rgba(0, 0, 0, ${opacity * P7_AXIS_DATE_OPACITY_SCALE})`;
    ctx.fillText(dateLabel, x, axisY - yOff + P7_AXIS_DATE_OFFSET);

    ctx.strokeStyle = `rgba(0, 0, 0, ${opacity * P7_AXIS_EVENT_LINE_OPACITY_SCALE})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lineX, axisY - yOff + P7_AXIS_DATE_OFFSET + P7_AXIS_EVENT_LINE_GAP);
    ctx.lineTo(lineX, axisY - P7_AXIS_EVENT_LINE_END_GAP);
    ctx.stroke();
  });

  ctx.restore();
}

// Draws filled circles roughly every P7_AXIS_DOT_GAP px between fromX and toX
// (direction-agnostic — the axis grows right-to-left, but this is called with
// both orderings) — spacing is nudged so a dot lands exactly on *both* fromX and
// toX, not just fromX. Every label sits between two independently-called
// segments, so without this, one side's gap to the label was always a precise
// P7_AXIS_LABEL_PAD while the other had up to a full P7_AXIS_DOT_GAP of extra
// slack (whichever end happened to be that segment's free-running far end) —
// flush endpoints make both sides of every label match.
// Each dot's own color is decided here (filled vs faint) by comparing its x to
// curX, rather than the caller drawing two separately-phased dotted lines (a
// faint one for the whole span, a dark one for the reached portion) layered on
// top of each other — those two lines didn't share a phase, so the dots didn't
// line up and the seam between them was visible. One dot sequence that changes
// color partway through reads as a single line filling up, not two lines.
// Drawn manually with arc() rather than ctx.setLineDash([0, gap]) + a round cap
// (the usual canvas dotted-line trick) — that combination froze/crashed the tab
// on this axis's line lengths, so plain per-dot fills it is.
function p7DrawAxisDots(ctx, fromX, toX, axisY, curX) {
  const radius = P7_AXIS_LINE_THICKNESS / 2;
  const length = Math.abs(toX - fromX);
  if (length <= 0) return;
  const count = Math.max(2, Math.round(length / P7_AXIS_DOT_GAP) + 1);
  const step  = length / (count - 1);
  const dir   = toX > fromX ? 1 : -1;
  for (let i = 0; i < count; i++) {
    const x = fromX + dir * i * step;
    ctx.fillStyle = x >= curX ? P7_AXIS_FILLED_COLOR : P7_AXIS_BG_COLOR;
    ctx.beginPath();
    ctx.arc(x, axisY, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function p7DrawYearAxis(ctx, W, H) {
  const ticks = p7AxisYearTicks();
  const curX  = p7AxisX(p7.currentDate, W);

  // A tick is "reached" once the growing edge has caught up to (or passed) its
  // x position — the start tick is always reached by definition.
  const visible = ticks.filter((tick, i) => i === 0 || p7AxisX(tick.dateStr, W) >= curX);

  const axisY = H * P7_AXIS_Y_FRAC;
  ctx.save();

  // Build-in wipe (p7AxisIntroT, triggered by p7AxisTriggerIfNeeded) — clips
  // everything this function draws (dots, labels, headline events alike) to
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

  ctx.font = "18px 'Assistant', sans-serif"; // set before measuring so widths below are accurate
  // Labels are textAlign "right" — each one sits entirely to the *left* of its own
  // tick x, never to the right — so only that side needs clearance, sized to the
  // label's actual measured width rather than a guessed constant (a fixed 28px gap
  // here used to be narrower than a real 4-digit year at 18px, so the dashes ran
  // straight under the digits).
  const labelClearance = (tick) => ctx.measureText(String(tick.year)).width + P7_AXIS_LABEL_PAD;

  // One continuous dotted line spanning the full p7.minDate-to-p7.maxDate span,
  // present from the very first frame — each dot picks its own filled/faint
  // color (see p7DrawAxisDots) based on curX, so the line itself reads as
  // filling up rather than as a faint line with a separate dark one laid over it.
  for (let i = 1; i < ticks.length; i++) {
    const fromX = p7AxisX(ticks[i - 1].dateStr, W) - labelClearance(ticks[i - 1]);
    const toX   = p7AxisX(ticks[i].dateStr, W) + P7_AXIS_LABEL_PAD;
    if (fromX <= toX) continue;
    p7DrawAxisDots(ctx, fromX, toX, axisY, curX);
  }
  // The remainder past the last whole-year tick, out to the axis's true left edge
  // (p7.maxDate itself rarely falls exactly on a January 1st).
  const finalTick  = ticks[ticks.length - 1];
  const finalTickX = p7AxisX(finalTick.dateStr, W) - labelClearance(finalTick);
  const axisLeftX  = P7_AXIS_MARGIN;
  if (finalTickX > axisLeftX) {
    p7DrawAxisDots(ctx, finalTickX, axisLeftX, axisY, curX);
  }

  // Every year label shows from the start now that the full axis is always
  // visible — but, like the dotted line itself, stays faint until scroll
  // actually reaches it, then switches to the normal darker color.
  const reachedTicks = new Set(visible);
  ctx.textAlign    = "right";
  ctx.textBaseline = "middle";
  for (const tick of ticks) {
    ctx.fillStyle = reachedTicks.has(tick) ? P7_AXIS_LABEL_COLOR : P7_AXIS_LABEL_FAINT_COLOR;
    ctx.fillText(String(tick.year), p7AxisX(tick.dateStr, W), axisY);
  }
  ctx.restore();

  p7DrawAxisEvents(ctx, W, axisY);
}

// Exposed so scroll and animation-loop redraws can re-test the cursor against
// newly drawn dots without requiring pointer movement — assigned inside
// p7HoverInit below (no-op until then, safe to call at any time).
let p7RecheckHover = () => {};

// Hover tooltip for a single event square in the real timeline (#page-8) — date
// + Hebrew description, reusing the exact same DOM element/styling as page9.js's
// hover (#page9Tooltip is generic markup, not page9-specific), and isolating the
// hovered square the same way p9PlaceDot does (see p7DrawSideSquares above).
function p7HoverInit() {
  const canvasEl  = document.getElementById("canvas");
  const tooltipEl = document.getElementById("page9Tooltip");
  const dateEl    = tooltipEl.querySelector(".page9-tooltip-date");
  const descEl    = tooltipEl.querySelector(".page9-tooltip-desc");

  const HIT_PAD = 3; // px of extra hit area around each P7_SQ=3 square, in every direction
  const TOOLTIP_GAP = 5; // px of breathing room between the square and the tooltip box, both axes

  // Last pointer position in client (viewport) coordinates — updated on every
  // pointermove, read by doHitTest so re-checks after redraws don't need an event.
  let lastCX = null, lastCY = null;

  // #page9Tooltip is shared with page9.js's own hover (same element, see
  // p9HoverInit) — only clear it when this handler is the one that actually
  // showed it (p7.hoveredEvent set), or a stray pointermove/scroll on
  // whichever page page9's hover owns would stomp its tooltip right back
  // off the instant it appears, since both listen on window unconditionally.
  function hide() {
    if (!p7.hoveredEvent) return;
    tooltipEl.classList.remove("is-visible");
    p7.hoveredEvent = null;
    draw();
  }

  // Runs the hit-test against p7.lastPositions using the cached cursor
  // position. Called both from onMove (pointer moved) and from p7RecheckHover
  // (canvas just redrew — new dots may have appeared under a stationary cursor).
  function doHitTest() {
    if (lastCX === null || currentPage !== 9) { hide(); return; }

    const rect = canvasEl.getBoundingClientRect();
    const mx = lastCX - rect.left;
    const my = lastCY - rect.top;
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

    if (!bestEvent) { hide(); return; }

    // Redraw with this square isolated only when the hovered event actually
    // changes — not on every check over the same square.
    if (p7.hoveredEvent !== bestEvent) {
      p7.hoveredEvent = bestEvent;
      draw();
      // draw() just rebuilt p7.lastPositions — bestPos (read below for
      // tooltip placement) still points at the same {x,y}, since dimming
      // only changes alpha, but refresh the reference for clarity/safety.
      bestPos = p7.lastPositions.get(bestEvent);
    }

    dateEl.textContent = bestEvent.date;
    descEl.textContent = bestEvent.descHeMedium;
    tooltipEl.style.borderColor = p7ActorColor(bestEvent.actor);
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
    if (currentPage !== 9) hide();
  }, { passive: true });
}

p7HoverInit();
