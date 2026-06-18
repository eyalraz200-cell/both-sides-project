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

// Shared left-grid geometry — leftX0 is rounded (not raw W*SBB.left) because that raw
// float can land just under a whole px (e.g. 392.00000000000006 on some widths), which
// previously made Math.floor(sideW/CELL) silently drop a whole column and leave the
// grid's near-center edge a few px further from center than intended. drawAnchorActions
// (squareboundingbox.js) calls this too, so the anchor squares always land exactly on
// the real grid's near-center column edge instead of using an independent formula that
// can drift out of sync with it.
function p7GridGeometry(W, H) {
  const leftX0 = Math.round(W * SBB.left);
  const sideW  = W / 2 - CENTER_GAP / 2 - leftX0;
  const cols   = Math.floor(sideW / P7_CELL);
  return { leftX0, cols, CELL: P7_CELL };
}

const P7_COLORS = {
  "settlers":                           "#F9880D",
  "Protesters against the government":  "#0C7AE0",
  "Haredi Jews":                        "#16181D",
  "Right-wing activists":               "#69DB12",
  "left wing activists":                "#EF3890",
};

const P7_LEGEND = [
  { label: "פעילי ימין",           color: "#69DB12" },
  { label: "מתיישבים",             color: "#F9880D" },
  { label: "חרדים",                color: "#16181D" },
  { label: "מתנגדי הרפורמה המשפטית",   color: "#0C7AE0" },
  { label: "פעילי שמאל",           color: "#EF3890" },
];

const P7_MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני",
                   "יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

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

// True once the page-5 section (page7's scrub section — fused with what used to
// be a standalone page6 intro title, see index.html's .page6-intro) has actually
// been scrolled to (not just intersected from below — see the IntersectionObserver
// rootMargin in main.js, which flips currentPage to page7 well before the section's
// top reaches the viewport top). Gates the very first month's cascade so it doesn't
// fire while page7 is merely scrolling into view from below, before the user has
// engaged with it at all.
const p7SectionEl = document.getElementById("page-5");
let p7HasEngaged = false;

function p7AnyAnimActive() {
  const now = performance.now();
  for (const k in p7MonthAnimStart) {
    if (now - p7MonthAnimStart[k] < P7_ANIM_TOTAL_DURATION) return true;
  }
  for (const k in p7MonthReverseStart) {
    if (now - p7MonthReverseStart[k] < P7_ANIM_TOTAL_DURATION) return true;
  }
  return false;
}

// page8 (index 6) renders by calling drawPage7 directly with currentDate forced to
// maxDate (see page8.js) — it's a continuation of page7's view, not a separate one, so
// the cascade must keep redrawing there too, or it freezes the instant the user
// scrolls into page8 mid-flight instead of finishing "off screen" as page7 intended.
function p7ShouldRedrawForAnim() { return currentPage === 5 || currentPage === 6; }

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

  for (let i = ANCHOR_COUNT_PER_SIDE; i < monthEnd; i++) {
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
    ctx.fillStyle = P7_COLORS[events[i].actor] || "#888";
    ctx.fillRect(destX + off, destY + off, size, size);
  }
  ctx.globalAlpha = 1;
}

async function initPage7() {
  try {
    const res  = await fetch("/events.json");
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

  const topY   = Math.round(H * SBB.top);
  const botY   = Math.round(H * SBB.bottom);
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
  drawAnchorActions(ctx, W, H);

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
  const topY    = Math.round(H * SBB.top);
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
  // scrolled into page7 at all — p7HasEngaged only flips true once the section has
  // actually been scrolled to (its top reaching the viewport top), so that first
  // month's cascade doesn't fire prematurely while the page is merely scrolling past
  // page7 on its way in from above.
  if (!p7HasEngaged && p7SectionEl && p7SectionEl.getBoundingClientRect().top <= 0) {
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

  // Draw left events — the first ANCHOR_COUNT_PER_SIDE are already on screen as the
  // static anchor squares drawn above, so the shuffled grid reveal starts past them.
  p7DrawSideSquares(ctx, p7.leftEvents, p7.leftPos, leftX0, topY, cols, CELL, SQ, monthEndL, settledL, curMonthKey);

  // Draw right events — same anchor-square offset as the left side.
  p7DrawSideSquares(ctx, p7.rightEvents, p7.rightPos, rightX0, topY, cols, CELL, SQ, monthEndR, settledR, curMonthKey);

  drawGroupLegend(ctx, W, H);
}

// ── Date timeline — a continuous month strip that scrolls past a fixed center,
// rendered as real DOM/HTML inside the text column, not on canvas ──
const P7_ENTRY_H      = 36; // month row height
const P7_YEAR_ENTRY_H = 56; // year row height — taller, to fit its bigger text without overlap
const p7TimelineEl = document.getElementById("page7Timeline");
let p7TimelineTrackEl   = null;
let p7TimelineEntryEls  = null;   // flat list of row elements: month entries with a year row spliced in before each new year
let p7TimelineEntryTops = null;   // px top, parallel to p7TimelineEntryEls
let p7TimelineEntryHs   = null;   // px height, parallel to p7TimelineEntryEls
let p7TimelineMonthTop  = null;   // calendar idx -> px top, for month rows only
let p7TimelineMonthSpan = null;   // calendar idx -> px span to interpolate dayFrac across
let p7TimelineBaseIndex = 0;      // baseYear*12 + baseMonth, index 0 of the strip
let p7TimelineCurrent   = -1;

function p7BuildTimeline() {
  if (p7TimelineTrackEl || !p7.ready || !p7TimelineEl) return;

  const minD = new Date(p7.minDate + "T00:00:00Z");
  const maxD = new Date(p7.maxDate + "T00:00:00Z");
  const baseIdx = minD.getUTCFullYear() * 12 + minD.getUTCMonth();
  const maxIdx  = maxD.getUTCFullYear() * 12 + maxD.getUTCMonth();
  p7TimelineBaseIndex = baseIdx;

  const track = document.createElement("div");
  track.className = "page7-timeline-track";

  p7TimelineEntryEls  = [];
  p7TimelineEntryTops = [];
  p7TimelineEntryHs   = [];
  p7TimelineMonthTop  = {};
  p7TimelineMonthSpan = {};
  let yPx = 0;
  let lastYear = null;

  for (let idx = baseIdx; idx <= maxIdx; idx++) {
    const y = Math.floor(idx / 12), m = idx % 12;
    // December rolls into a new year right after, so stretch its interpolation span across
    // the upcoming year row's height too — otherwise the date->pixel mapping would jump
    // straight from December to January, skipping over the year row's pixel range entirely
    // (and making it "current" prematurely, since nothing ever scrolls smoothly into it).
    const span = (m === 11 && idx < maxIdx) ? P7_ENTRY_H + P7_YEAR_ENTRY_H : P7_ENTRY_H;

    if (y !== lastYear) {
      const yearEntry = document.createElement("div");
      yearEntry.className = "entry entry-year";
      yearEntry.style.top = `${yPx}px`;

      const year = document.createElement("span");
      year.className = "year";
      year.textContent = String(y);
      yearEntry.appendChild(year);

      track.appendChild(yearEntry);
      p7TimelineEntryEls.push(yearEntry);
      p7TimelineEntryTops.push(yPx);
      p7TimelineEntryHs.push(P7_YEAR_ENTRY_H);
      yPx += P7_YEAR_ENTRY_H;
      lastYear = y;
    }

    const entry = document.createElement("div");
    entry.className = "entry";
    entry.style.top = `${yPx}px`;

    const month = document.createElement("span");
    month.className = "month";
    month.textContent = P7_MONTHS[m];
    entry.appendChild(month);

    if (idx === baseIdx) {
      const note = document.createElement("span");
      note.className = "note";
      note.textContent = "תחילת איסוף הנתונים";
      entry.appendChild(note);
    }

    track.appendChild(entry);
    p7TimelineEntryEls.push(entry);
    p7TimelineEntryTops.push(yPx);
    p7TimelineEntryHs.push(P7_ENTRY_H);
    p7TimelineMonthTop[idx]  = yPx;
    p7TimelineMonthSpan[idx] = span;
    yPx += P7_ENTRY_H;
  }

  p7TimelineEl.appendChild(track);
  p7TimelineTrackEl = track;
}

function p7UpdateTimelinePosition() {
  if (!p7TimelineTrackEl) return;

  const { y, m, dayFrac } = p7DateDayFrac(p7.currentDate);
  // currentDate (and the events it bisects against) is wholly unaffected by row layout —
  // this only converts it to a pixel position so the taller year rows fit inline in the strip.
  const calIdx  = y * 12 + m;
  const indexPx = p7TimelineMonthTop[calIdx] + dayFrac * p7TimelineMonthSpan[calIdx];

  const centerPx = window.innerHeight / 2;
  const offsetPx = centerPx - (indexPx + P7_ENTRY_H / 2);
  p7TimelineTrackEl.style.transform = `translateY(${offsetPx}px)`;

  // Once currentDate is clamped at maxDate, indexPx (and the transform above) freezes —
  // but the sticky container keeps scrolling during its release slack. Fold that extra
  // movement into the position so the last entry passes through the exact same "nearest"
  // logic as every other row, instead of being treated as a permanent special case.
  const containerTop  = p7TimelineEl.getBoundingClientRect().top;
  const visualPx       = indexPx - containerTop;
  // Bias the "current" pick toward the row below: without this, an entry only gets
  // highlighted once it's scrolled exactly to center (the midpoint between it and the
  // previous entry), which reads as laggy. Shifting the comparison point down by a few
  // px makes the switch happen a bit before that exact midpoint.
  const P7_CURRENT_BIAS_PX = 14;
  let nearestIdx = 0, bestDist = Infinity;
  for (let i = 0; i < p7TimelineEntryEls.length; i++) {
    const center = p7TimelineEntryTops[i] + p7TimelineEntryHs[i] / 2;
    const dist   = Math.abs(center - (visualPx + P7_CURRENT_BIAS_PX));
    if (dist < bestDist) { bestDist = dist; nearestIdx = i; }
  }

  // There's no entry after the last one to hand the highlight to, so the loop above
  // would otherwise keep picking it as "nearest" forever during the trailing release
  // slack. Once scroll has carried us past its own center by more than half its
  // height — the same margin any other entry would have lost "current" at — treat it
  // as passed too, via a one-past-the-end sentinel index, so it fades out exactly
  // like every other month instead of staying highlighted indefinitely.
  const lastIdx    = p7TimelineEntryEls.length - 1;
  const lastCenter = p7TimelineEntryTops[lastIdx] + p7TimelineEntryHs[lastIdx] / 2;
  if (nearestIdx === lastIdx && (visualPx + P7_CURRENT_BIAS_PX) - lastCenter > p7TimelineEntryHs[lastIdx] / 2) {
    nearestIdx = p7TimelineEntryEls.length;
  }

  if (nearestIdx !== p7TimelineCurrent) {
    if (p7TimelineCurrent >= 0 && p7TimelineCurrent < p7TimelineEntryEls.length) {
      p7TimelineEntryEls[p7TimelineCurrent].classList.remove("current");
    }
    if (nearestIdx < p7TimelineEntryEls.length) {
      p7TimelineEntryEls[nearestIdx].classList.add("current");
    }
    p7TimelineCurrent = nearestIdx;
  }

  // Rows already scrolled past sit at a flat, strongly transparent opacity; rows not yet
  // reached stay at the (less transparent) default — year rows start out dimmer than month
  // rows, but fade to the exact same transparency once passed, like any other row. The "note"
  // (data-start label) stays fully black until it passes center too, then fades the same way.
  p7TimelineEntryEls.forEach((el, idx) => {
    const target = el.querySelector(".month, .year");
    const note   = el.querySelector(".note");
    if (idx === nearestIdx) {
      if (target) target.style.opacity = "";
      if (note)   note.style.opacity   = "";
      return;
    }
    const passed = idx < nearestIdx;
    if (passed) {
      if (target) target.style.opacity = "0.06";
      if (note)   note.style.opacity   = "0.06";
      return;
    }
    if (target) target.style.opacity = el.classList.contains("entry-year") ? "0.08" : "0.25";
  });
}

function p7RenderTimeline() {
  p7BuildTimeline();
  p7UpdateTimelinePosition();
}
