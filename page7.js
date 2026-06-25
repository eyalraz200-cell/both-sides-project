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

function p7AnyAnimActive() {
  const now = performance.now();
  for (const k in p7MonthAnimStart) {
    if (now - p7MonthAnimStart[k] < P7_ANIM_TOTAL_DURATION) return true;
  }
  for (const k in p7MonthReverseStart) {
    if (now - p7MonthReverseStart[k] < P7_ANIM_TOTAL_DURATION) return true;
  }
  if (p7AxisEventsAnimActive()) return true;
  return false;
}

// page8 (index 9) renders by calling drawPage7 directly with currentDate forced to
// maxDate (see page8.js) — it's a continuation of page7's view, not a separate one, so
// the cascade must keep redrawing there too, or it freezes the instant the user
// scrolls into page8 mid-flight instead of finishing "off screen" as page7 intended.
// Folds 7/9 (#page-6/#page-7, before the real timeline) render drawFold7/drawFold9
// instead — no page7 content on screen there, so they're deliberately excluded.
function p7ShouldRedrawForAnim() { return currentPage === 8 || currentPage === 9; }

function p7StartAnimLoop() {
  if (p7AnimRunning) return;
  p7AnimRunning = true;
  function step() {
    if (p7ShouldRedrawForAnim()) draw();
    if (p7AnyAnimActive()) {
      requestAnimationFrame(step);
    } else {
      p7AnimRunning = false;
      if (p7ShouldRedrawForAnim()) draw(); // final frame, locked at rest position
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
function p7DrawSideSquares(ctx, events, positions, x0, topY, cols, CELL, SQ, monthEnd, settledCount, curMonthKey) {
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

    const size = SQ * scale;
    const off  = (SQ - size) / 2; // keep the shrink/grow centered on the cell
    ctx.globalAlpha = alpha;
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
  // scrolled into page7 at all — p7HasEngaged only flips true once fold 9's title
  // card has scrolled past the top of the viewport, so that first month's cascade
  // doesn't fire prematurely while the page is merely scrolling past page7 on its
  // way in from above.
  if (!p7HasEngaged && page7TitleCardEl && page7TitleCardEl.getBoundingClientRect().top <= 0) {
    p7HasEngaged = true;
  }
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
  // centered month, or a later month still retreating back toward the origin. Before
  // the section has been engaged, clamp it to the start of curMonthKey itself, so
  // nothing from the (still unreached) first month draws at all.
  const drawThroughMonthKey = Math.max(curMonthKey, p7MonthMaxReached);
  const nextMonthStartStr = p7HasEngaged
    ? p7MonthKeyToStartStr(drawThroughMonthKey + 1)
    : p7MonthKeyToStartStr(curMonthKey);
  const settledL  = p7BisectBefore(p7.leftEvents,  settledStr);
  const settledR  = p7BisectBefore(p7.rightEvents, settledStr);
  const monthEndL = p7BisectBefore(p7.leftEvents,  nextMonthStartStr);
  const monthEndR = p7BisectBefore(p7.rightEvents, nextMonthStartStr);

  // Draw left events.
  p7DrawSideSquares(ctx, p7.leftEvents, p7.leftPos, leftX0, topY, cols, CELL, SQ, monthEndL, settledL, curMonthKey);

  // Draw right events.
  p7DrawSideSquares(ctx, p7.rightEvents, p7.rightPos, rightX0, topY, cols, CELL, SQ, monthEndR, settledR, curMonthKey);

  p7DrawYearAxis(ctx, W, H);
}

// ── Date axis — a horizontal year strip drawn along the bottom of the canvas,
// growing from right to left as the user scrolls deeper into the dataset. Unlike
// the square cascade beside it, this has no animation state of its own: every
// frame it's recomputed straight from p7.currentDate, so scrolling backward
// just naturally shrinks it back — no separate reverse bookkeeping needed.
const P7_AXIS_MARGIN          = 48;   // px inset from each edge
const P7_AXIS_Y_FRAC          = 0.93;  // fraction of H — shared vertical center for the dashed line and year labels (Figma: both sit on one row, not stacked)
const P7_AXIS_LINE_THICKNESS  = 6;     // px — Figma's dash is a ~7px-tall band, not a hairline
const P7_AXIS_LABEL_PAD       = 6;     // px breathing room around a label's measured width

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
// reaches its date and fades back out some time later, rather than staying pinned
// once reached like the year ticks — so only one is ever on screen.
const P7_AXIS_EVENTS = [
  { date: "2023-01-01", label: "הצגת הרפורמה המשפטית" },
  { date: "2023-07-01", label: "אישור ביטול עילת הסבירות" },
  { date: "2023-10-07", label: "מתקפת 7 באוקטובר" },
  { date: "2024-06-01", label: "פסיקת בג\"ץ על גיוס חרדים" },
  { date: "2025-06-01", label: "מבצע עם כלביא" },
  { date: "2025-10-01", label: "הסכם הפסקת אש ושחרור חטופים בעזה" },
];

// Fixed real-time (wall-clock) durations, the same for every event regardless of
// how close together their dates are — this is a one-shot animation *triggered*
// the moment the growing edge reaches an event's date, not a value continuously
// recomputed from scroll position. Once triggered it plays out on its own clock
// (via p7StartAnimLoop/p7AnyAnimActive below) even if the user stops scrolling
// entirely, and resets only if they scroll back up above the event's date (so
// scrolling forward across it again replays the same animation from scratch).
const P7_AXIS_EVENT_FADE_IN_MS  = 400;
const P7_AXIS_EVENT_HOLD_MS     = 1200;
const P7_AXIS_EVENT_FADE_OUT_MS = 1000;
const P7_AXIS_EVENT_TOTAL_MS    = P7_AXIS_EVENT_FADE_IN_MS + P7_AXIS_EVENT_HOLD_MS + P7_AXIS_EVENT_FADE_OUT_MS;
const P7_AXIS_EVENT_LABEL_OFFSET = 18; // px above the axis line
const P7_AXIS_EVENT_FONT         = "14px 'Assistant', sans-serif";
const P7_AXIS_EVENT_LINE_GAP     = 4;   // px of clearance below the label's baseline before the tick starts
const P7_AXIS_EVENT_LINE_END_GAP = 8;   // px of clearance above the axis line — tick stops short, doesn't touch it

// triggeredAt is a performance.now() timestamp, set once when the event is first
// reached and cleared if the user scrolls back above its date — null means "not
// currently triggered" (either never reached yet, or reached-then-reversed).
const P7_AXIS_EVENT_STATE = P7_AXIS_EVENTS.map(() => ({ triggeredAt: null }));

// Checked every draw (see p7AnyAnimActive) so the animation loop keeps running —
// and labels keep fading — purely on elapsed time, with no further scrolling
// required.
function p7AxisEventsAnimActive() {
  const now = performance.now();
  return P7_AXIS_EVENT_STATE.some(s => s.triggeredAt !== null && now - s.triggeredAt < P7_AXIS_EVENT_TOTAL_MS);
}

// Fires each event's one-shot animation the instant p7.currentDate reaches its
// date, regardless of how the user got there (slow scroll, fast flick, or a
// direct jump) — and un-fires it if they scroll back above that date.
function p7UpdateAxisEventTriggers() {
  const curMs = new Date(p7.currentDate + "T00:00:00Z").getTime();
  P7_AXIS_EVENTS.forEach((ev, i) => {
    const state = P7_AXIS_EVENT_STATE[i];
    const reached = curMs >= new Date(ev.date + "T00:00:00Z").getTime();
    if (reached && state.triggeredAt === null) {
      state.triggeredAt = performance.now();
      p7StartAnimLoop();
    } else if (!reached && state.triggeredAt !== null) {
      state.triggeredAt = null;
    }
  });
}

function p7AxisEventOpacity(elapsedMs) {
  if (elapsedMs < P7_AXIS_EVENT_FADE_IN_MS) return elapsedMs / P7_AXIS_EVENT_FADE_IN_MS;
  const holdEnd = P7_AXIS_EVENT_FADE_IN_MS + P7_AXIS_EVENT_HOLD_MS;
  if (elapsedMs < holdEnd) return 1;
  if (elapsedMs < P7_AXIS_EVENT_TOTAL_MS) return 1 - (elapsedMs - holdEnd) / P7_AXIS_EVENT_FADE_OUT_MS;
  return 0;
}

function p7DrawAxisEvents(ctx, W, axisY) {
  p7UpdateAxisEventTriggers();
  const now = performance.now();
  ctx.save();
  ctx.font = P7_AXIS_EVENT_FONT;
  ctx.textBaseline = "alphabetic";
  P7_AXIS_EVENTS.forEach((ev, i) => {
    const state = P7_AXIS_EVENT_STATE[i];
    if (state.triggeredAt === null) return;
    const opacity = p7AxisEventOpacity(now - state.triggeredAt);
    if (opacity <= 0) return;
    const x = p7AxisX(ev.date, W);
    // Centered text would push past the canvas edge for an event anchored right
    // at it — the very first one sits at p7.minDate, the axis's own right anchor
    // — so fall back to right/left alignment (extending only inward) near either
    // edge instead of going out of frame.
    const textWidth = ctx.measureText(ev.label).width;
    let lineX = x; // the tick always marks the label's horizontal center...
    if (x + textWidth / 2 > W) ctx.textAlign = "right";
    else if (x - textWidth / 2 < 0) ctx.textAlign = "left";
    else ctx.textAlign = "center";
    // ...even when the edge cases above push the text itself off-center from `x`
    // (textAlign extends the label only inward from `x`, so its true center sits
    // half a text-width away from `x` on the side it grew toward).
    if (ctx.textAlign === "right") lineX = x - textWidth / 2;
    else if (ctx.textAlign === "left") lineX = x + textWidth / 2;
    ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
    ctx.fillText(ev.label, x, axisY - P7_AXIS_EVENT_LABEL_OFFSET);

    ctx.strokeStyle = `rgba(0, 0, 0, ${opacity})`; // matches the label's own fade
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lineX, axisY - P7_AXIS_EVENT_LABEL_OFFSET + P7_AXIS_EVENT_LINE_GAP);
    ctx.lineTo(lineX, axisY - P7_AXIS_EVENT_LINE_END_GAP);
    ctx.stroke();
  });
  ctx.restore();
}

function p7DrawYearAxis(ctx, W, H) {
  const ticks = p7AxisYearTicks();
  const curX  = p7AxisX(p7.currentDate, W);

  // A tick is "reached" once the growing edge has caught up to (or passed) its
  // x position — the start tick is always reached by definition.
  const visible = ticks.filter((tick, i) => i === 0 || p7AxisX(tick.dateStr, W) >= curX);

  const axisY = H * P7_AXIS_Y_FRAC;
  ctx.save();
  ctx.font = "18px 'Assistant', sans-serif"; // set before measuring so widths below are accurate
  // Labels are textAlign "right" — each one sits entirely to the *left* of its own
  // tick x, never to the right — so only that side needs clearance, sized to the
  // label's actual measured width rather than a guessed constant (a fixed 28px gap
  // here used to be narrower than a real 4-digit year at 18px, so the dashes ran
  // straight under the digits).
  const labelClearance = (tick) => ctx.measureText(String(tick.year)).width + P7_AXIS_LABEL_PAD;

  ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
  ctx.lineWidth   = P7_AXIS_LINE_THICKNESS;
  ctx.setLineDash([4, 4]);
  for (let i = 1; i < visible.length; i++) {
    const fromX = p7AxisX(visible[i - 1].dateStr, W) - labelClearance(visible[i - 1]);
    const toX   = p7AxisX(visible[i].dateStr, W) + P7_AXIS_LABEL_PAD;
    if (fromX <= toX) continue;
    ctx.beginPath();
    ctx.moveTo(fromX, axisY);
    ctx.lineTo(toX, axisY);
    ctx.stroke();
  }
  // The segment still growing into an unreached year.
  const lastTick = visible[visible.length - 1];
  const lastVisibleX = p7AxisX(lastTick.dateStr, W) - labelClearance(lastTick);
  if (lastVisibleX > curX) {
    ctx.beginPath();
    ctx.moveTo(lastVisibleX, axisY);
    ctx.lineTo(curX, axisY);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  ctx.fillStyle = "rgba(0, 0, 0, 0.46)";
  ctx.textAlign    = "right";
  ctx.textBaseline = "middle";
  for (const tick of visible) {
    ctx.fillText(String(tick.year), p7AxisX(tick.dateStr, W), axisY);
  }
  ctx.restore();

  p7DrawAxisEvents(ctx, W, axisY);
}
