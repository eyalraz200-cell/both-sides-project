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
// On mobile the square size is SOLVED per viewport, not fixed. A fixed pitch
// has to be small enough for the smallest phone, which left every larger one
// with capacity far above its event count — and since p7OrderFromCenter sizes
// its usable pool to the side's own events, that surplus showed up as a thin
// scatter of dots in a box mostly made of gaps. p7SolveMobileSq instead picks
// the LARGEST square whose grid still holds the bigger camp, so the dots grow
// to fill whatever box the phone actually has.
//
// P7_MOBILE_FILL is how much of the grid the bigger camp is allowed to occupy
// at most — the remainder is the deliberate scatter of permanent gaps, so 0.86
// keeps the texture the desktop grid has rather than packing the box solid.
// The gap stays half the square (1.5/0.75 was the same ratio) so the density
// reads the same at every solved size.
const P7_MOBILE_FILL      = 0.86;
// 1.25 is only ever reached by the very smallest phones (320×568 needs ~1.35 to
// hold the right camp inside the taller axis clearance); every phone from
// 320×700 up solves well above it. Below ~1.2 a square stops reading as a mark
// at all, so the floor is where truncation is preferred to invisibility.
const P7_MOBILE_SQ_MIN    = 1.25;
const P7_MOBILE_SQ_MAX    = 3;     // just under desktop's 3.5
const P7_MOBILE_GAP_RATIO = 0.5;
const P7_MOBILE_SQ_STEP   = 0.05;
let p7MobileSq = P7_MOBILE_SQ_MIN;  // rewritten by p7UpdateLayout

// sideW/sideH are one camp's box in px; maxEvents the bigger camp's count.
// Walks down from the max because the first size that fits is the biggest one.
function p7SolveMobileSq(sideW, sideH, maxEvents) {
  if (!maxEvents) return P7_MOBILE_SQ_MIN;
  for (let sq = P7_MOBILE_SQ_MAX; sq >= P7_MOBILE_SQ_MIN; sq -= P7_MOBILE_SQ_STEP) {
    const cell = sq * (1 + P7_MOBILE_GAP_RATIO);
    const cap  = Math.floor(sideW / cell) * Math.floor(sideH / cell);
    if (cap * P7_MOBILE_FILL >= maxEvents) return Math.round(sq * 100) / 100;
  }
  // Nothing fits even at the floor: keep the floor and let p7OrderFromCenter's
  // own min(total, maxEvents) clamp truncate, rather than shrinking below the
  // size at which a square is still visible.
  return P7_MOBILE_SQ_MIN;
}

// Live reads (isMobile() reads innerWidth), same convention as sbbTimeline().
// Desktop's square is solved too now that rows are dates (p7SolveVerticalSq):
// null until the first layout, then whatever size lets every day's events fit
// their rows — P7_SQ when the box is big enough.
let p7DesktopSq = null;
function p7Sq()   { return isMobile() ? p7MobileSq : (p7DesktopSq || P7_SQ); }
function p7Cell() { return isMobile() ? p7MobileSq * (1 + P7_MOBILE_GAP_RATIO) : p7Sq() * (1 + P7_GAP / P7_SQ); }
// ─────────────────────────────────────────

// Shared left-grid geometry — leftX0 comes from sbbTimelineLeftX (a fixed px on desktop,
// a rounded fraction on mobile; rounding matters because a raw float just under a whole
// px, e.g. 392.00000000000006, makes Math.floor(sideW/CELL) silently drop a column).
// DESKTOP: the year axis runs vertically down the centre (see the VERTICAL
// AXIS block below), so the centre gap is the wider P7_AXIS_CORRIDOR_PX
// corridor rather than CENTER_GAP. Mobile keeps CENTER_GAP + the horizontal axis.
function p7VerticalAxis() { return !isMobile(); }
function p7CenterGap()    { return p7VerticalAxis() ? (P7_VERT.eventMode === "widen" ? P7_VERT.wideCorridorPx : P7_VERT.corridorPx) : CENTER_GAP; }
function p7GridGeometry(W, H) {
  const leftX0  = sbbTimelineLeftX(W, H);
  const gap     = p7CenterGap();
  const rightX0 = W / 2 + gap / 2;
  const sideW   = W / 2 - gap / 2 - leftX0;
  const CELL    = p7Cell();
  const cols    = Math.floor(sideW / CELL);
  return { leftX0, rightX0, cols, CELL };
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
  cols: 0, rows: 0,
  vert: null,   // p7BuildVerticalLayout result on desktop (see VERTICAL AXIS), null on mobile
  lastW: 0, lastH: 0, lastMaxEvents: -1, lastVertical: null,
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

/* =========================================================================
   VERTICAL AXIS (desktop, p7VerticalAxis) — date-driven row layout
   =========================================================================
   The year axis is a vertical line at W/2 running top → bottom through the
   corridor between the two camps. Every dot's ROW is its date, and each camp
   grows OUTWARD from the axis along that row, so the dots follow the axis's
   fill edge down the screen. Rows are handed out per DAY: a day gets its
   linear share of the rows (span/days), stretched to more rows when either
   camp has more events that day than one row holds (Oct 2023 needs ~3× its
   linear share) — dense periods read taller, the axis stays monotonic.

   Within a row the placement keeps the old p7OrderFromCenter texture: the
   fill starts at the corridor and walks outward, a random roll leaves
   permanent gaps (1 − fillRatio of the cells) and the day's events are
   spread over the day's rows with ±jitter, so the outer edge stays ragged
   rather than a neat bar chart. Deterministic (p7Rng) so the layout is stable
   across frames and resizes.

   P7_VERT is the tunable bundle (edited live by _debug-axis.js while the
   headline placement is being compared — see wiki/Timeline.md):
     eventMode "band"  — the dot flow pauses at each headline event: bandRows
                          empty rows are reserved and the headline + date sit
                          in that band, centred on the axis.
     eventMode "widen" — no rows reserved; instead the whole corridor is
                          wider (wideCorridorPx, top to bottom) so every
                          headline fits inside it beside the axis.
     eventLine         — A2: a faint full-width line at each reached event's row.
   ------------------------------------------------------------------------- */
const P7_VERT = {
  corridorPx: P7_AXIS_CORRIDOR_PX,
  eventMode:  "widen", // picked 2026-09-04 (harness kept for now)
  eventLine:  false,
  bandPx:     60,    // band mode: height reserved per headline (title line(s) + date)
  wideCorridorPx: 170, // widen mode: the corridor, full height
  fillRatio:  1,     // no permanent gaps — picked 2026-09-04
  rowJitter:  0,     // picked 2026-09-04 — ± rows a dot may drift from its day's own rows
};
// Vertical layout result (p7.vert) — null on mobile / before layout.
function p7DayMs(dateStr) { return new Date(dateStr + "T00:00:00Z").getTime(); }

function p7VertBandRows(CELL) { return Math.ceil(P7_VERT.bandPx / CELL); }

// Largest square (≤ P7_SQ, the mobile-style solve) whose grid holds the
// busier camp once each day's events must sit in that day's rows: a date-
// driven layout cannot pack as tightly as the old free permutation, and band
// mode gives whole rows away to the headlines. 6% slack for the jitter spill.
function p7SolveVerticalSq(sideW, sideH, maxEvents) {
  const gapRatio = P7_GAP / P7_SQ;
  const bands = P7_VERT.eventMode === "band" ? P7_AXIS_EVENTS.length : 0;
  for (let sq = P7_SQ; sq >= 1.5; sq -= 0.1) {
    const CELL = sq * (1 + gapRatio);
    const cols = Math.floor(sideW / CELL), rows = Math.floor(sideH / CELL);
    const cap  = Math.max(1, Math.floor(cols * P7_VERT.fillRatio));
    const avail = rows - bands * Math.ceil(P7_VERT.bandPx / CELL);
    if (avail * cap >= maxEvents * 1.06) return sq;
  }
  return 1.5;
}

function p7BuildVerticalLayout(rows, cols, CELL) {
  const minMs  = p7DayMs(p7.minDate);
  const maxMs  = p7DayMs(p7.maxDate);
  const nDays  = Math.max(1, Math.round((maxMs - minMs) / 86400000) + 1);
  const dayOf  = (dateStr) => Math.min(nDays - 1, Math.max(0, Math.round((p7DayMs(dateStr) - minMs) / 86400000)));
  const countL = new Int32Array(nDays), countR = new Int32Array(nDays);
  p7.leftEvents.forEach(e => countL[dayOf(e.date)]++);
  p7.rightEvents.forEach(e => countR[dayOf(e.date)]++);

  const band   = P7_VERT.eventMode === "band";
  const cap    = Math.max(1, Math.floor(cols * P7_VERT.fillRatio));
  // Band reservations: the band for an event sits just BEFORE that day's rows;
  // an event dated past the data (the last one) gets its band after the last day.
  const bandDay = new Map(); // dayIndex (or nDays for "after the end") -> [eventIdx]
  P7_AXIS_EVENTS.forEach((ev, i) => {
    const d = p7DayMs(ev.date) > maxMs ? nDays : dayOf(ev.date);
    if (!bandDay.has(d)) bandDay.set(d, []);
    bandDay.get(d).push(i);
  });
  const bandRows  = band ? p7VertBandRows(CELL) : 0;
  const rowsAvail = Math.max(1, rows - bandRows * P7_AXIS_EVENTS.length);
  const linear    = rowsAvail / nDays;
  const need      = new Float64Array(nDays);
  let sum = 0;
  for (let d = 0; d < nDays; d++) {
    // Fractional rows: there are ~10× more days than rows, so quiet days
    // share a row and only a day with more events than one row holds
    // (Oct 7th and its week) stretches beyond its linear share.
    need[d] = Math.max(linear, Math.max(countL[d], countR[d]) / cap);
    sum += need[d];
  }
  // Normalise so the days + bands exactly fill `rows`. Days that needed more
  // than their linear share keep proportionally more; the squeeze lands on the
  // sparse days.
  const scale = rowsAvail / sum;
  const rowStart = new Float64Array(nDays + 1);
  const rowsOf   = new Float64Array(nDays);
  const events   = P7_AXIS_EVENTS.map(() => ({ row: 0, reachRow: 0, bandStart: 0, bandEnd: 0 }));
  let cursor = 0;
  const placeBands = (d) => {
    (bandDay.get(d) || []).forEach((i) => {
      events[i].bandStart = cursor;
      events[i].bandEnd   = cursor + bandRows;
      cursor += bandRows;
    });
  };
  for (let d = 0; d < nDays; d++) {
    placeBands(d);
    rowStart[d] = cursor;
    rowsOf[d]   = need[d] * scale;
    cursor     += rowsOf[d];
  }
  placeBands(nDays);
  rowStart[nDays] = cursor;
  const totalRows = cursor;

  const rowMid = (d) => rowStart[d] + rowsOf[d] / 2;
  P7_AXIS_EVENTS.forEach((ev, i) => {
    const past = p7DayMs(ev.date) > maxMs;
    const e = events[i];
    if (band) {
      // Dot 1.5 rows into the band, text below it; reached once the fill edge
      // enters the band.
      e.row      = e.bandStart + 1.5;
      e.reachRow = e.bandStart;
    } else {
      // Past-the-end event parks a few rows short of the bottom (the vertical
      // counterpart of the horizontal +26px xOffset) so it can still be reached.
      e.row      = past ? totalRows - 3 : rowMid(dayOf(ev.date));
      e.reachRow = e.row;
    }
  });


  const lastRow = rows - 1;
  function placeSide(evs, seed, side) {
    const rng  = p7Rng(seed);
    const used = []; // row -> Uint8Array(cols), lazily
    const cellRow = (r) => used[r] || (used[r] = new Uint8Array(cols));
    const positions = new Array(evs.length);
    // Tries to claim a free k in `row` walking outward from the corridor;
    // returns k or -1. Cells rolled as permanent gaps are marked used (2).
    function claim(row) {
      const u = cellRow(row);
      for (let k = 0; k < cols; k++) {
        if (u[k]) continue;
        if (rng() > P7_VERT.fillRatio) { u[k] = 2; continue; } // permanent gap
        u[k] = 1;
        return k;
      }
      return -1;
    }
    evs.forEach((e, i) => {
      const d = dayOf(e.date);
      const want = rowStart[d] + rng() * rowsOf[d] + (rng() * 2 - 1) * P7_VERT.rowJitter;
      const base = Math.min(lastRow, Math.max(0, Math.round(want)));
      let k = -1, row = base;
      // Spill outward: base, base+1, base-1, base+2, ...
      for (let step = 0; k < 0 && step <= lastRow; step++) {
        const cand = step === 0 ? base : (step % 2 ? base + (step + 1) / 2 : base - step / 2);
        if (cand < 0 || cand > lastRow) continue;
        k = claim(cand); row = cand;
      }
      if (k < 0) { k = 0; row = base; } // grid genuinely full — overlap rather than drop
      const col = side === "right" ? k : cols - 1 - k;
      positions[i] = row * cols + col;
    });
    return positions;
  }

  return {
    rows, cols, totalRows, nDays, minMs, maxMs, rowStart, rowsOf, dayOf, events,
    leftPos:  placeSide(p7.leftEvents,  11111, "left"),
    rightPos: placeSide(p7.rightEvents, 99999, "right"),
  };
}

// Fractional row of a date on the vertical axis — the MIDDLE of that day's
// rows (ticks, hover marker, widen-mode event dots); p7RowEndOfDate is the
// bottom of the day's rows (the fill edge, so it covers the day's own dots).
// A date past the data clamps to the end. Both fall back to 0 before layout.
function p7RowOfDate(dateStr) {
  const v = p7.vert; if (!v) return 0;
  if (p7DayMs(dateStr) > v.maxMs) return v.totalRows;
  const d = v.dayOf(dateStr);
  return v.rowStart[d] + v.rowsOf[d] / 2;
}
function p7RowEndOfDate(dateStr) {
  const v = p7.vert; if (!v) return 0;
  if (p7DayMs(dateStr) > v.maxMs) return v.totalRows;
  const d = v.dayOf(dateStr);
  return v.rowStart[d] + v.rowsOf[d];
}
// Row → canvas y (top of that row) and the axis line's own extent.
function p7VertTopY(H) { return Math.round(H * sbbTimeline(H).top); }
function p7RowY(row, H) { return p7VertTopY(H) + row * p7.CELL; }
function p7AxisY(dateStr, H) { return p7RowY(p7RowOfDate(dateStr), H); }
// The fill edge in rows — the bottom of currentDate's rows.
function p7CurRow() { return p7RowEndOfDate(p7.currentDate); }

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
// the @fold10/10 layout mid-reverse-glide. { from: Map<event,{x,y}>, start,
// duration } — same shape/plain-glide convention as p9.anim's plainGlide
// flag (page9.js), just for this one entry point instead of a persistent
// per-frame system.
let p7EntryAnim = null;

// Wipes all per-month animation state so the next entry into the timeline
// replays the cascade from scratch instead of showing settled dots.
// Called from setActivePage (main.js) when the user scrolls back out of
// @fold11 toward an earlier fold.
function p7ResetForReplay() {
  for (const k in p7MonthPhase) delete p7MonthPhase[k];
  p7MonthMaxReached = -1;
}

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

// True once the real timeline (drawPage7, #page-8) has actually been reached
// at least once this "visit" — set by drawPage7 itself, cleared by drawFold9
// (main.js) once fully retreated back out (p7HasEngaged false again and
// nothing left animating). Lets drawFold9 keep drawing/animating the
// per-event squares (p7DrawTimelineSquares below) for as long as there's
// still something to retreat when the user scrolls back up from #page-8 into
// #page-7, without changing when the *forward* reveal itself first starts —
// that still only ever happens via drawPage7, i.e. once #page-8 is actually
// reached, same as before this flag existed.
let p7RealTimelineReached = false;

// Updates p7HasEngaged — called from drawPage7 (currentPage 7) and drawFold9
// (main.js, currentPage 6) alike, since the title card this depends on
// belongs to fold 9/#page-7. p7HasEngaged is recomputed fresh every call, not
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
  // Engagement is deliberately NOT gated on @fold9's squares finishing their
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
  if (p7VerticalAxis()) return p7.vert ? p7CurRow() / p7.vert.totalRows : 0;
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
  if (p7AxisOutroStart !== null && p7AxisIntroT() > 0) return true;
  if (p7AxisFillLagActive()) return true;
  if (p7EntryAnim && now - p7EntryAnim.start < p7EntryAnim.duration) return true;
  return false;
}

// page8 (index 8) renders by calling drawPage7 directly with currentDate forced to
// maxDate (see page8.js) — it's a continuation of page7's view, not a separate one, so
// the cascade must keep redrawing there too, or it freezes the instant the user
// scrolls into page8 mid-flight instead of finishing "off screen" as page7 intended.
// Fold 9 (#page-7, currentPage 6 — drawFold9 in main.js, just before the real
// timeline) is included too, now that its own axis build-in (p7AxisIntroT
// above) can be playing while it's on screen. Fold 7 (#page-6, currentPage 5 —
// drawFold7 in main.js) is included too, now that it also keeps drawing
// p7DrawTimelineSquares for as long as p7RealTimelineReached is true (see that
// flag's own comment) — a fast enough scroll-up can carry the user past
// #page-7 into this fold within a single continuous motion while squares are
// still mid-retreat.
function p7ShouldRedrawForAnim() { return currentPage === 6 || currentPage === 7 || currentPage === 8 || currentPage === 9; }

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
  // Mobile squares are ~1.25–3 CSS px (p7SolveMobileSq) sitting at fractional
  // positions, so on a DPR>1 phone every edge lands mid-device-pixel and the
  // canvas antialiases it into a band of partial-alpha pixels. The loupe is a
  // nearest-neighbour 4x blit of this canvas (drawLoupe below), so that band
  // magnifies into a pale ring and the dots read as if they were stroked.
  // Snapping the rect onto the device-pixel grid leaves nothing to antialias —
  // in the glass and in the un-magnified grid alike. Hoisted out of the loop
  // because this runs over every event, every frame.
  //
  // Desktop snaps too: the squares are small enough that on a display whose
  // DPR isn't a whole number (a scaled external monitor at 1.25x/1.5x) every
  // fractional edge bleeds into the neighbouring device pixel at partial alpha
  // and the whole timeline reads soft — next to the same page on a 1x/2x
  // screen, where the coordinates happen to land clean, the difference is
  // obvious.
  const snapPx = true;
  const dpr    = window.devicePixelRatio || 1;
  const q      = v => Math.round(v * dpr) / dpr;

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
    // The 1/dpr floor is a guard, not a routine path: the smallest real square
    // is scale 0.5 on sq 1.25, still ~2 device px.
    // Desktop snaps only once a square is SETTLED. Mid-pop, quantising the
    // grow to whole device pixels turns the smooth scale ramp into two or
    // three visible steps and the cascade reads as stuttering — worse than the
    // softness it fixes. Mobile still snaps throughout: the loupe magnifies
    // any fractional edge into a pale ring, which is the louder artifact there.
    if (snapPx && (scale === 1 || isMobile())) ctx.fillRect(q(drawX + off), q(drawY + off), Math.max(1 / dpr, q(size)), Math.max(1 / dpr, q(size)));
    else        ctx.fillRect(drawX + off, drawY + off, size, size);
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
  // The event count joins W/H in the guard because the mobile square size is
  // solved FROM it: the first layout runs before events.json has landed
  // (counts 0 → the floor size), and without this the solved size would stay
  // at that floor for the whole session on an unchanged viewport.
  const maxEvents = Math.max(p7.leftEvents.length, p7.rightEvents.length);
  if (W === p7.lastW && H === p7.lastH && maxEvents === p7.lastMaxEvents && p7.lastVertical === p7VerticalAxis()) return;
  p7.lastVertical = p7VerticalAxis();
  p7.lastMaxEvents = maxEvents;

  const box    = sbbTimeline(H);
  const topY   = Math.round(H * box.top);
  const botY   = Math.round(H * box.bottom);
  const sideH  = botY - topY;
  // Solved before any geometry is read: p7GridGeometry/p7Sq below go through
  // p7Cell(), which returns this. The box itself doesn't depend on the square
  // size, so there's no circularity — sideW is the same measurement
  // p7GridGeometry makes.
  if (isMobile()) {
    const sideW = W / 2 - CENTER_GAP / 2 - sbbTimelineLeftX(W, H);
    p7MobileSq = p7SolveMobileSq(sideW, sideH, maxEvents);
  } else {
    const sideW = W / 2 - p7CenterGap() / 2 - sbbTimelineLeftX(W, H);
    p7DesktopSq = p7.ready ? p7SolveVerticalSq(sideW, sideH, maxEvents) : P7_SQ;
  }
  const { leftX0, cols, CELL } = p7GridGeometry(W, H);
  p7.leftX0 = leftX0;
  p7.CELL = CELL;
  p7.SQ   = p7Sq();
  p7.cols = cols;

  const rows  = Math.floor(sideH / CELL);
  p7.rows = rows;
  if (p7VerticalAxis() && p7.ready) {
    // Desktop: rows are dates (see VERTICAL AXIS above).
    const v = p7BuildVerticalLayout(rows, p7.cols, CELL);
    p7.vert     = v;
    p7.leftPos  = v.leftPos;
    p7.rightPos = v.rightPos;
  } else {
    p7.vert = null;
    const total = p7.cols * rows;
    p7.leftPos  = p7OrderFromCenter(total, p7.cols, 11111, "left",  p7.leftEvents.length);
    p7.rightPos = p7OrderFromCenter(total, p7.cols, 99999, "right", p7.rightEvents.length);
  }

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

  const topY = Math.round(H * sbbTimeline(H).top);
  const x0  = resolved.side === "left" ? p7.leftX0 : p7GridGeometry(W, H).rightX0;
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

// The 8 real events @fold10's fold-6 squares fly to/become (FOLD6_SQUARE_ACTORS/
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

// Extracted from drawPage7 below so drawFold9 (main.js, #page-7, currentPage
// 6) can keep this running too — see p7RealTimelineReached's own comment
// above for why: without this, scrolling back up from #page-8 into #page-7
// (crossing back over @fold10's own title) made every still-retreating square
// (and the year axis's own headline events, p7DrawAxisEvents) vanish in a
// single frame the instant currentPage dropped, instead of finishing their
// reverse cascade like they do while scrolling backward *within* #page-8
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
  const topY    = Math.round(H * sbbTimeline(H).top);
  const rightX0 = p7GridGeometry(W, H).rightX0;

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
    // month at once — e.g. @fold10's fly-then-engage gate (p7UpdateEngagement,
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

  // A2 (desktop vertical axis): a faint full-width rule across both camps at
  // each REACHED headline event's row, drawn under the dots. Persistent like
  // the event's own dot (reachedT), not tied to the label's crossfade — the
  // rule is a landmark that stays once passed. Wiped in by the axis intro.
  if (p7VerticalAxis() && P7_VERT.eventLine && p7.vert && p7AxisTriggerIfNeeded()) {
    const introT = p7AxisIntroT();
    ctx.save();
    P7_AXIS_EVENTS.forEach((ev, i) => {
      const t = P7_AXIS_EVENT_STATE[i].reachedT * p7Ease(introT);
      if (t <= 0.001) return;
      const y = Math.round(p7RowY(p7.vert.events[i].row, H)) + 0.5;
      ctx.strokeStyle = `rgba(90, 90, 90, ${P7_VERT_EVENT_LINE_ALPHA * t})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(leftX0, y);
      ctx.lineTo(W - leftX0, y);
      ctx.stroke();
    });
    ctx.restore();
  }

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
  p7DrawInspectScrim(ctx, W, H);

  if (p7AxisTriggerIfNeeded()) p7DrawYearAxis(ctx, W, H);
}

// The mobile picker's selection halo, drawn by SUBTRACTION: one even-odd path —
// the whole canvas, minus a disc at the selected dot — filled with a white
// scrim. Everything else dims; the selection alone keeps its full colour.
//
// It runs on the MAIN canvas, not inside the loupe, so the dimming reaches
// every dot on screen rather than only the handful under the glass. The loupe
// is a plain blit of this canvas, so it inherits the halo already magnified and
// needs no marker of its own.
//
// Placed after the squares and before the axis deliberately: the axis is the
// reading context for the selected date and stays at full contrast.
//
// It is a DRAG-TIME aid, gated on p7Inspect.dragging: it exists to show which
// dot the finger is currently on. Lifting the finger clears the selection
// outright (onEnd -> release), so the chart, the axis and the docked frame all
// return to neutral together — a halo left standing would read as a persistent
// highlight rather than as aim.
function p7DrawInspectScrim(ctx, W, H) {
  if (!p7InspectPage() || !p7Inspect.dragging || !p7Inspect.event) return;
  // Same source the hit-test uses, so the hole lands on the dot that was picked
  // in whichever fold the picker is currently serving (@fold9 or @fold11).
  const { positions, half, cell } = p7InspectSource();
  const pos = positions.get(p7Inspect.event);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  // No position means the selected event isn't in this frame's draw range (the
  // cascade retreated past it) — the scrim then covers everything, with nothing
  // exempted, which is the honest reading: there is nothing to point at.
  if (pos) {
    // The hole is measured in dot widths so it tracks the per-viewport solved
    // square size (p7SolveMobileSq) instead of drifting at either end. The 1.5px
    // floor keeps it from vanishing at @fold11's 1px dots.
    //
    // Then capped so the hole can never reach a NEIGHBOUR. The grid pitch is
    // 1.5 dots, so the nearest edge of the adjacent dot sits `cell - half` from
    // this dot's centre; at the nominal 1 dot-width the hole landed exactly on
    // that edge, and any rounding let a sliver of each neighbour through
    // undimmed — the selection's brightness looked like it was spreading to the
    // dots around it, which is the one thing the halo exists to prevent. The 0.9
    // keeps a real margin. The floor below it is the selected square's own
    // half-diagonal (half * √2), so a tight grid clips a neighbour before it
    // ever clips the dot being pointed at.
    const r = Math.max(half * 1.42,
                       Math.min((cell - half) * 0.9,
                                Math.max(1.5, P7_INSPECT_HOLE_DOTS * half * 2)));
    ctx.arc(pos.x + half, pos.y + half, r, 0, Math.PI * 2);
  }
  ctx.fillStyle = `rgba(255,255,255,${P7_INSPECT_SCRIM})`;
  ctx.fill("evenodd");
  ctx.restore();

  // Then repaint the picked dot at a slightly more saturated version of its own
  // group colour. Inside the hole it was merely *un*-dimmed — correct, but at
  // 1–3px, ringed by a field gone pale, "same as it always was" doesn't read as
  // chosen. Saturation, not lightness: pushing toward white would wash a small
  // dot out against the scrim, while pushing the channels away from their own
  // grey point makes the hue itself more insistent at the same weight.
  // Deliberately not a change to GROUPS: this is a transient selection state,
  // and the roster's colours are the legend's contract.
  // Snapped onto the device-pixel grid for the same reason p7DrawSideSquares
  // snaps (see its comment): this repaint lands on the fractional position the
  // dot was solved at, so unsnapped it antialiases into a partial-alpha band
  // that the loupe's nearest-neighbour blit magnifies into a pale ring. That
  // would put the "extra stroke" back on the ONE dot the halo exists to show
  // clearly, while every dot around it — drawn by the snapping path — stayed
  // clean. Mobile only; the picker is a mobile gesture and desktop's
  // rendering is settled at full-size squares.
  if (pos) {
    ctx.fillStyle = p7Saturate(p7ActorColor(p7Inspect.event.actor),
                               P7_INSPECT_PICK_SAT);
    const size = half * 2;
    if (isMobile()) {
      const dpr = window.devicePixelRatio || 1;
      const q   = v => Math.round(v * dpr) / dpr;
      ctx.fillRect(q(pos.x), q(pos.y), Math.max(1 / dpr, q(size)), Math.max(1 / dpr, q(size)));
    } else {
      ctx.fillRect(pos.x, pos.y, size, size);
    }
  }
}

// #rrggbb -> a more saturated rgb(), by pushing each channel away from the
// colour's own luminance by `amt` (0 = unchanged). Cheap and hue-preserving —
// no HSL round trip. Local to the picker; lerpFold6SquareColor (js/groups.js)
// parses hex the same way but always blends against the fold6 rest gray.
function p7Saturate(hex, amt) {
  const n = parseInt(String(hex).slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const push = v => Math.round(Math.max(0, Math.min(255, lum + (v - lum) * (1 + amt))));
  return `rgb(${push(r)}, ${push(g)}, ${push(b)})`;
}

// The axis *appearing* (the one-shot build-in wipe) and the axis *filling up*
// (p7HasEngaged advancing p7.currentDate) are two separate trigger points —
// this is the appearing one. Per explicit instruction it fires the moment
// @fold9's fly trigger is activated (fold9FlyTrigger — legacy name, it's the
// squares' fly-out on id #page-8), NOT after the squares land: p7HasEngaged
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
// Don't snap the axis away — hand whatever wipe progress it had to a quick
// reverse wipe (p7AxisOutroStart) and keep it drawable until that reaches 0.
// Shared exit path: called both when the fly trigger un-fires (scrolling back
// up out of the timeline, via p7AxisTriggerIfNeeded) and the moment @fold10's
// bridge glide starts (drawPage8, which draws the axis itself during the
// reverse wipe so it undraws instead of vanishing with the timeline frame).
// Returns true while there is still reverse-wipe progress worth drawing.
function p7AxisReverseOut() {
  if (p7AxisIntroStart !== null) {
    const t = p7AxisIntroT();
    p7AxisIntroStart = null;
    if (t > 0) {
      p7AxisOutroStart = performance.now();
      p7AxisOutroFromT = t;
      p7StartAnimLoop();
    }
  }
  if (p7AxisOutroStart !== null && p7AxisIntroT() <= 0) p7AxisOutroStart = null;
  return p7AxisOutroStart !== null;
}

function p7AxisTriggerIfNeeded() {
  if (!p7AxisShouldShow()) return p7AxisReverseOut();
  if (p7AxisOutroStart !== null) {
    // Re-triggered mid-reverse: resume the build-in from wherever the reverse
    // wipe currently is (back-date the start so introT continues seamlessly).
    const t = p7AxisIntroT();
    p7AxisOutroStart = null;
    p7AxisIntroStart = performance.now() - t * P7_AXIS_INTRO_DURATION;
    p7StartAnimLoop();
  } else if (p7AxisIntroStart === null) {
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
const P7_AXIS_MARGIN_MOBILE   = 28;   // px — the desktop 120 would leave only ~150px of axis on a 393px phone; 28 keeps the year ticks ~90px apart while still giving the end labels room off the screen edges.
function p7AxisMargin() { return isMobile() ? P7_AXIS_MARGIN_MOBILE : P7_AXIS_MARGIN; }
const P7_AXIS_Y_FRAC          = 0.90; // fraction of H — vertical center of the solid line; the year labels now sit BELOW it (P7_AXIS_YEAR_LABEL_OFFSET), not on the same row
const P7_AXIS_Y_FRAC_MOBILE   = 0.94; // fraction of H — the axis sits lower on a phone: the grid above it ends higher (sbbTimeline()'s mobile bottom reserves SBB_TIMELINE_MOBILE_AXIS_CLEAR_PX under it) and the year label under it is 14px rather than 18, so 0.90 left a conspicuous empty band under the axis while the grid felt crowded.
function p7AxisYFrac() { return isMobile() ? P7_AXIS_Y_FRAC_MOBILE : P7_AXIS_Y_FRAC; }
const P7_AXIS_LINE_THICKNESS  = 1;     // px — the solid line's stroke height
const P7_AXIS_MARKER_RADIUS   = 4;     // px — radius of the year-tick ring markers AND the headline-event dots at full size (shared so they read as one system)
const P7_AXIS_MARKER_RADIUS_FADED = 2; // px — shrunk radius a headline-event dot settles to once its label has crossfaded away (grows back to _RADIUS on hover)
const P7_AXIS_MARKER_STROKE   = 1;     // px — ring line width for the hollow year markers
const P7_AXIS_YEAR_LABEL_OFFSET = 12;  // px gap from the marker's bottom edge down to the year label's top
const P7_AXIS_YEAR_LABEL_OFFSET_MOBILE = 5; // px — the same gap tightened on a phone, so the year reads as attached to its own tick rather than floating below the axis
function p7AxisYearLabelOffset() { return isMobile() ? P7_AXIS_YEAR_LABEL_OFFSET_MOBILE : P7_AXIS_YEAR_LABEL_OFFSET; }
const P7_AXIS_BG_ALPHA        = 0.22;  // faint full-span line's alpha, under the dark "filled" overlay — also reused to dim the axis event label during state3 (hover elsewhere)
const P7_AXIS_BG_COLOR        = `rgba(0, 0, 0, ${P7_AXIS_BG_ALPHA})`;
// STRICTLY during state3 (hover elsewhere): the UNFILLED span of the axis line
// drops below the shared BG_ALPHA, widening its contrast with the (0.34-dimmed)
// filled span so the fill edge stays legible under the hover. Un-hovered, the
// unfilled line uses the plain BG_COLOR like everything else.
const P7_AXIS_UNFILLED_HOVER_ALPHA = 0.14;
// The dimmed headline labels + dates during state3 (hover elsewhere) get their
// own, slightly higher alpha than the axis chrome — at BG_ALPHA the roster read
// too faint to actually serve as a reference key.
const P7_AXIS_ROSTER_LABEL_ALPHA = 0.34;
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
// Reverse wipe when the trigger un-fires (scrolling back up past the fly
// trigger): the same wipe plays backwards, much quicker than the build-in.
// 500ms is the FULL-wipe time; an interrupted intro reverses over only its
// remaining distance (duration scaled by how far it had got), per convention.
const P7_AXIS_OUTRO_DURATION = 500; // ms — full left-edge-back-to-right-edge un-wipe
let p7AxisIntroStart = null;
let p7AxisOutroStart = null; // non-null while the reverse wipe is running
let p7AxisOutroFromT = 0;    // introT captured at the moment the reverse began

function p7AxisIntroT() {
  if (p7AxisOutroStart !== null) {
    const dur = P7_AXIS_OUTRO_DURATION * p7AxisOutroFromT;
    if (dur <= 0) return 0;
    const gone = (performance.now() - p7AxisOutroStart) / dur;
    return p7AxisOutroFromT * (1 - Math.min(1, gone));
  }
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
  const rightX = W - p7AxisMargin();
  const leftX  = p7AxisMargin();
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

// Mobile (≤600px): smaller type and tighter stacking. The lines stack upward
// toward the grid, whose bottom is set to clear a 3-line block
// (SBB_TIMELINE_MOBILE_AXIS_CLEAR_PX).
const P7_AXIS_EVENT_LABEL_OFFSET_MOBILE = 36;
const P7_AXIS_EVENT_FONT_MOBILE         = "500 14px 'Assistant', sans-serif";
const P7_AXIS_DATE_FONT_MOBILE          = "400 14px 'Assistant', sans-serif";
const P7_AXIS_DATE_OFFSET_MOBILE        = 16;
const P7_AXIS_EVENT_LINE_HEIGHT_MOBILE  = 18;
// Every title gets a cap on mobile (desktop leaves them all uncapped). It used
// to be a narrow 120 so the de-collision pass could fit several blocks side by
// side on a ~300px axis; now that mobile prints ONE centred block (see
// p7DrawAxisEvents) the whole width is available, so it widens to 220 and most
// titles come back to one or two lines. Per-event `maxWidthMobile` overrides it.
const P7_AXIS_EVENT_MAXWIDTH_MOBILE     = 220;

function p7AxisEventFont()       { return isMobile() ? P7_AXIS_EVENT_FONT_MOBILE : P7_AXIS_EVENT_FONT; }
function p7AxisDateFont()        { return isMobile() ? P7_AXIS_DATE_FONT_MOBILE  : P7_AXIS_DATE_FONT; }
function p7AxisEventLabelOffset(){ return isMobile() ? P7_AXIS_EVENT_LABEL_OFFSET_MOBILE : P7_AXIS_EVENT_LABEL_OFFSET; }
function p7AxisDateOffset()      { return isMobile() ? P7_AXIS_DATE_OFFSET_MOBILE : P7_AXIS_DATE_OFFSET; }
function p7AxisEventLineHeight() { return isMobile() ? P7_AXIS_EVENT_LINE_HEIGHT_MOBILE : P7_AXIS_EVENT_LINE_HEIGHT; }
function p7AxisEventMaxWidth(ev) {
  if (!isMobile()) return ev.maxWidth;
  return ev.maxWidthMobile != null ? ev.maxWidthMobile : P7_AXIS_EVENT_MAXWIDTH_MOBILE;
}

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
  if (Math.abs(((p7.hoveredEvent || (p7Inspect.dragging && p7Inspect.event)) ? 1 : 0) - p7AxisRosterT) > 0.001) return true;
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
  const lines = p7WrapLabel(ctx, ev.label, p7AxisEventMaxWidth(ev));
  // The collision extent is the whole title+date BLOCK, not just the title:
  // the date renders in its own (narrower) font but centred on the same axis,
  // so for a short title it can be the wider of the two — measuring only the
  // title would let two blocks clear each other while their dates overlap.
  ctx.save();
  ctx.font = p7AxisDateFont();
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
// including the first, uses this same rule: date reached AND the fill edge
// has caught up to the drawn (xOffset-nudged) position — see the comment at
// the x test below. No special-cased extra delay for the first one.
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
    if (p7VerticalAxis()) {
      // Vertical: one rule for every event — the fill edge (bottom of
      // currentDate's rows) has come down to the event's own reach row (the
      // band's top in band mode, the dot's row in widen mode).
      reached = hasScrolled && !!p7.vert && p7CurRow() >= p7.vert.events[i].reachRow;
    } else if (evMs > maxMs) {
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
      // Besides the date, the fill edge must also have caught up to the dot's
      // DRAWN x — an event nudged LEFT by xOffset (the first one, −14) draws
      // later along the axis than its date, and its persistent circle
      // (p7DrawAxisEvents' `x >= curX`) grows in at that drawn position. Without
      // this the label faded in at the date while the circle was still ahead of
      // the fill. For rightward nudges the x test passes before the date does,
      // so the date still governs and nothing changes.
      reached = hasScrolled && curMs >= evMs
        && p7AxisX(p7.currentDate, W) <= p7AxisEventTrueX(ev, i, W);
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
  ctx.font = p7AxisEventFont();
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
  // MOBILE: the headline text does not travel with its dot. There is no room on
  // a phone-width axis for a title block to sit over its own date position —
  // de-collision just shoved blocks to the edges and the reading order stopped
  // matching the axis. Instead every headline prints in ONE fixed slot centred
  // on the canvas, and only the dot marks where on the axis it happened (drawn
  // in the persistent-circle pass above, untouched by this).
  //
  // One slot means one label: a fast flick can trigger several events in the
  // same frame, and at full opacity they would print on top of each other. Only
  // the most recently triggered visible entry is kept — the older ones are the
  // ones the scrub has already passed, and their dots still stand on the axis.
  if (isMobile()) {
    if (visible.length > 1) {
      const firedAt = (e) => {
        const t = P7_AXIS_EVENT_STATE[e.i].triggeredAt;
        return t === null || t === undefined ? -Infinity : t;
      };
      let best = visible[0];
      for (const e of visible) {
        if (firedAt(e) > firedAt(best) || (firedAt(e) === firedAt(best) && e.i > best.i)) best = e;
      }
      visible.length = 0;
      visible.push(best);
    }
    visible.forEach((e) => {
      e.lineX = W / 2;
      e.left  = W / 2 - e.textWidth / 2;
      e.right = W / 2 + e.textWidth / 2;
    });
  } else {
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
  }

  visible.forEach((entry) => {
    const { ev, lineX, opacity, lines } = entry;
    const yOff = p7AxisEventLabelOffset();
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
    const labelAlpha = (hoverActive && !isHoverHighlighted) ? P7_AXIS_ROSTER_LABEL_ALPHA : 1;
    ctx.font = p7AxisEventFont();
    ctx.fillStyle = `rgba(0, 0, 0, ${labelAlpha * opacity})`;
    // Wrapped lines stack UPWARD: the LAST line keeps the single-line baseline
    // (axisY - yOff) so the date underneath never moves, and earlier lines are
    // lifted a line-height each above it.
    lines.forEach((text, li) => {
      const y = axisY - yOff - (lines.length - 1 - li) * p7AxisEventLineHeight();
      ctx.fillText(text, lineX, y);
    });

    // Date below the label — same color as the axis's own reached year labels
    // (P7_AXIS_LABEL_COLOR, via globalAlpha rather than string-parsing its
    // own alpha, same pattern as the marker circle below). In state3, dims to
    // the exact same faint alpha as the label above it (rather than a
    // proportional dim of its own already-lighter color, which would land
    // dimmer than the label instead of matching it).
    const dateLabel = p7FormatDateDMY(ev.date, ".");
    ctx.font = p7AxisDateFont();
    ctx.textAlign = "center";
    ctx.fillStyle = (hoverActive && !isHoverHighlighted) ? `rgba(0, 0, 0, ${P7_AXIS_ROSTER_LABEL_ALPHA})` : P7_AXIS_LABEL_COLOR;
    ctx.globalAlpha = opacity;
    ctx.fillText(dateLabel, lineX, axisY - yOff + p7AxisDateOffset());
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
  const x = Math.min(Math.max(p7AxisX(ev.date, W), p7AxisMargin()), W - p7AxisMargin());
  return x + (ev.xOffset || 0);
}

function p7DrawYearAxis(ctx, W, H) {
  if (p7VerticalAxis()) return p7DrawYearAxisVertical(ctx, W, H);
  const ticks = p7AxisYearTicks();
  const rawCurX = p7AxisX(p7.currentDate, W);

  // A tick is "reached" once the growing edge has caught up to (or passed) its
  // x position — the start tick is always reached by definition.
  const visible = ticks.filter((tick, i) => i === 0 || p7AxisX(tick.dateStr, W) >= rawCurX);

  // Snapped onto the device-pixel grid for the same reason p7DrawSideSquares
  // snaps its squares: at ~4px radius the ring markers are small enough that a
  // fractional center smears their 1px stroke across two device-pixel rows,
  // and on a display whose DPR isn't a whole number that happens on every
  // frame — the circles read soft next to the same page on a 1x/2x screen.
  const axisDpr = window.devicePixelRatio || 1;
  const axisQ   = v => Math.round(v * axisDpr) / axisDpr;
  const axisY   = axisQ(H * p7AxisYFrac());
  ctx.save();

  // Build-in wipe (p7AxisIntroT, triggered by p7AxisTriggerIfNeeded) — clips
  // everything this function draws (line, markers, labels, headline events alike) to
  // [revealX, right edge] so the whole axis reveals right to left on its own
  // clock the first time it appears, starting from the same right-edge anchor
  // (p7.minDate/"2023") the scroll-driven fill above grows from. A no-op once
  // the wipe finishes (revealX reaches the left edge) or if it's not playing.
  const introT = p7AxisIntroT();
  if (introT < 1) {
    const rightEdge = W - p7AxisMargin();
    const leftEdge   = p7AxisMargin();
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
  const leftEdgeX    = p7AxisMargin();

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
  // The mobile picker counts as a hover here — a loupe-picked dot marks its
  // date on the axis with the same state-3 treatment desktop hover gets — but
  // only WHILE the finger is down (dragging), same gating as the selection
  // halo: it's an aiming aid, and the axis returns to normal on release even
  // though the selection itself persists in the docked frame.
  const hoveredEvent = p7.hoveredEvent || (p7Inspect.dragging ? p7Inspect.event : null);
  const hoverActive  = !!hoveredEvent;
  const hoverAxisX   = hoverActive ? p7AxisX(hoveredEvent.date, W) : null;

  // The line itself: one faint full-span base drawn first, then the dark
  // "reached" portion grown right-to-left from the right anchor to curX laid
  // on top — so it reads as a single line filling up, not a faint line with a
  // separate dark one beside it. While a dot elsewhere is hovered, the fill
  // dims (see below) and the hovered event's own marker pops instead
  // (p7DrawAxisEvents).
  const lineTop = axisY - P7_AXIS_LINE_THICKNESS / 2;
  ctx.fillStyle = hoverActive
    ? `rgba(0, 0, 0, ${P7_AXIS_UNFILLED_HOVER_ALPHA})`
    : P7_AXIS_BG_COLOR;
  ctx.fillRect(leftEdgeX, lineTop, rightAnchorX - leftEdgeX, P7_AXIS_LINE_THICKNESS);
  // In state3 (hover elsewhere) the filled span doesn't vanish into the faint
  // line — it dims to the same lifted alpha the roster labels use, so how far
  // the timeline has filled stays readable under the hover.
  ctx.fillStyle = hoverActive
    ? `rgba(0, 0, 0, ${P7_AXIS_ROSTER_LABEL_ALPHA})`
    : P7_AXIS_FILLED_COLOR;
  ctx.fillRect(curX, lineTop, rightAnchorX - curX, P7_AXIS_LINE_THICKNESS);

  // Hollow ring marker on the line at each year tick — faint until the growing
  // edge reaches it, then dark (same reached/unreached signal the labels use).
  // The line behind each ring is punched back to the frame background first so
  // the marker reads as a clean hollow O, not a filled disc with the line
  // showing through. In state3 (hover), every ring goes faint; the hovered
  // event's own position is drawn as a filled dot by p7DrawAxisEvents instead.
  const reachedTicks = new Set(visible);
  for (const tick of ticks) {
    const x = axisQ(p7AxisX(tick.dateStr, W));
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
  ctx.font = `${isMobile() ? 14 : 18}px 'Assistant', sans-serif`;
  ctx.textAlign    = "center";
  ctx.textBaseline = "top";
  const labelY = axisY + P7_AXIS_MARKER_RADIUS + p7AxisYearLabelOffset();
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
    ctx.arc(axisQ(hoverAxisX), axisY, P7_AXIS_MARKER_RADIUS + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p7ActorColor(hoveredEvent.actor);
    ctx.beginPath();
    ctx.arc(axisQ(hoverAxisX), axisY, P7_AXIS_MARKER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/* ---- VERTICAL AXIS drawing (desktop) ---------------------------------------
   The vertical counterpart of p7DrawYearAxis above: same colours, radii,
   fonts, fill lag, hover states and headline fade logic, laid out top → bottom
   at x = W/2. Year labels sit directly under their ring, centred on the line;
   headline blocks (title lines + date) hang under their dot, centred on the
   line, in the band / opened corridor. No de-collision — the layout already
   reserves the space (bands are empty rows; widen blocks the inner cells).
   ------------------------------------------------------------------------- */
const P7_VERT_EVENT_LINE_ALPHA  = 0.18; // A2 rule across the camps
const P7_VERT_EVENT_TEXT_GAP    = 6;    // px between the dot's edge and the title's first line
const P7_VERT_YEAR_LABEL_GAP    = 6;    // px between a year ring and its label

function p7DrawYearAxisVertical(ctx, W, H) {
  if (!p7.vert) return;
  const v      = p7.vert;
  const ticks  = p7AxisYearTicks();
  const yearSpans = []; // filled below; the headline blocks dodge these
  const axisDpr = window.devicePixelRatio || 1;
  const axisQ   = x => Math.round(x * axisDpr) / axisDpr;
  const axisX   = axisQ(W / 2);
  const topY    = p7VertTopY(H);
  const len     = v.totalRows * p7.CELL;
  const botY    = topY + len;
  ctx.save();

  // Build-in wipe, top → bottom (same clock as the horizontal wipe).
  const introT = p7AxisIntroT();
  if (introT < 1) {
    const revealY = topY + p7Ease(introT) * len;
    ctx.beginPath();
    ctx.rect(0, 0, W, revealY);
    ctx.clip();
  }

  const fillFrac = p7AxisUpdateFillLag();
  const curY     = topY + fillFrac * len;
  const curRow   = p7CurRow();

  const hoveredEvent = p7.hoveredEvent || (p7Inspect.dragging ? p7Inspect.event : null);
  const hoverActive  = !!hoveredEvent;
  const hoverAxisY   = hoverActive ? axisQ(p7AxisY(hoveredEvent.date, H)) : null;

  // Base line + filled portion from the top.
  const lineLeft = axisX - P7_AXIS_LINE_THICKNESS / 2;
  ctx.fillStyle = hoverActive ? `rgba(0, 0, 0, ${P7_AXIS_UNFILLED_HOVER_ALPHA})` : P7_AXIS_BG_COLOR;
  ctx.fillRect(lineLeft, topY, P7_AXIS_LINE_THICKNESS, len);
  ctx.fillStyle = hoverActive ? `rgba(0, 0, 0, ${P7_AXIS_ROSTER_LABEL_ALPHA})` : P7_AXIS_FILLED_COLOR;
  ctx.fillRect(lineLeft, topY, P7_AXIS_LINE_THICKNESS, curY - topY);

  // Year rings + labels. A tick is reached once the fill edge is past its row.
  ctx.font = `18px 'Assistant', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (const tick of ticks) {
    const row = p7RowOfDate(tick.dateStr);
    const y   = axisQ(p7RowY(row, H));
    const reached = row <= curRow;
    const ringColor = hoverActive ? P7_AXIS_BG_COLOR : (reached ? P7_AXIS_FILLED_COLOR : P7_AXIS_BG_COLOR);
    ctx.fillStyle = "#FDFCFF";
    ctx.beginPath(); ctx.arc(axisX, y, P7_AXIS_MARKER_RADIUS, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = P7_AXIS_MARKER_STROKE;
    ctx.strokeStyle = ringColor;
    ctx.beginPath(); ctx.arc(axisX, y, P7_AXIS_MARKER_RADIUS, 0, Math.PI * 2); ctx.stroke();
    // Label under the ring, on a punched background so the line doesn't run
    // through the digits.
    const label = String(tick.year);
    const tw = ctx.measureText(label).width;
    const ly = y + P7_AXIS_MARKER_RADIUS + P7_VERT_YEAR_LABEL_GAP;
    // Ring + label as one vertical span, for the headline blocks to dodge.
    yearSpans.push({ top: y - P7_AXIS_MARKER_RADIUS, bottom: ly + 21 });
    // The punch starts at the ring's edge so no sliver of line shows between
    // the ring and its digits.
    ctx.fillStyle = "#FDFCFF";
    ctx.fillRect(axisX - tw / 2 - 3, y + P7_AXIS_MARKER_RADIUS, tw + 6, ly + 21 - (y + P7_AXIS_MARKER_RADIUS));
    ctx.fillStyle = hoverActive
      ? `rgba(0, 0, 0, ${P7_AXIS_BG_ALPHA})`
      : (reached ? P7_AXIS_LABEL_COLOR : P7_AXIS_LABEL_FAINT_COLOR);
    ctx.fillText(label, axisX, ly);
  }
  ctx.restore();

  p7DrawAxisEventsVertical(ctx, W, H, axisX, curY, hoverActive, hoverAxisY, yearSpans);

  if (hoverActive) {
    ctx.save();
    ctx.fillStyle = "#FDFCFF";
    ctx.beginPath(); ctx.arc(axisX, hoverAxisY, P7_AXIS_MARKER_RADIUS + 1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p7ActorColor(hoveredEvent.actor);
    ctx.beginPath(); ctx.arc(axisX, hoverAxisY, P7_AXIS_MARKER_RADIUS, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function p7DrawAxisEventsVertical(ctx, W, H, axisX, curY, hoverActive, highlightY, yearSpans) {
  p7UpdateAxisEventTriggers(W);
  const now = performance.now();
  const v = p7.vert;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  // Width available to a headline block: the whole band in band mode, the
  // corridor (minus a margin) in widen mode.
  const maxWidth = P7_VERT.eventMode === "band" ? 320 : p7CenterGap() - 16;

  p7.axisEventPositions = new Map();
  const hoveredAxisEvent = p7.hoveredAxisEvent;
  const rosterTarget = hoverActive ? 1 : 0;
  p7AxisRosterT += (rosterTarget - p7AxisRosterT) * P7_AXIS_HOVER_ANIM_SPEED;
  if (Math.abs(rosterTarget - p7AxisRosterT) < 0.001) p7AxisRosterT = rosterTarget;

  // Persistent dots (same easing as the horizontal pass).
  const evY = P7_AXIS_EVENTS.map((ev, i) => p7RowY(v.events[i].row, H));
  P7_AXIS_EVENTS.forEach((ev, i) => {
    const y = evY[i];
    const reached = y <= curY;
    const state = P7_AXIS_EVENT_STATE[i];
    const reachedTarget = reached ? 1 : 0;
    state.reachedT += (reachedTarget - state.reachedT) * P7_AXIS_HOVER_ANIM_SPEED;
    if (Math.abs(reachedTarget - state.reachedT) < 0.001) state.reachedT = reachedTarget;
    if (!reached) state.hoverT = 0;
    if (state.reachedT <= 0.001) return;
    const isAxisHovered = hoveredAxisEvent === ev;
    const hoverTarget = isAxisHovered ? 1 : 0;
    state.hoverT += (hoverTarget - state.hoverT) * P7_AXIS_HOVER_ANIM_SPEED;
    if (Math.abs(hoverTarget - state.hoverT) < 0.001) state.hoverT = hoverTarget;
    const prominence = Math.max(p7AxisEventOpacity(i, now), state.hoverT) * (1 - p7AxisRosterT);
    const markerRadius = (P7_AXIS_MARKER_RADIUS_FADED +
      (P7_AXIS_MARKER_RADIUS - P7_AXIS_MARKER_RADIUS_FADED) * prominence) * state.reachedT;
    p7.axisEventPositions.set(ev, { x: axisX, y, radius: markerRadius });
    ctx.fillStyle = "#FDFCFF";
    ctx.beginPath(); ctx.arc(axisX, y, markerRadius + state.reachedT, 0, Math.PI * 2); ctx.fill();
    const isHighlighted = highlightY !== null && Math.abs(y - highlightY) < 0.5;
    ctx.fillStyle = hoverActive
      ? (isHighlighted ? P7_AXIS_HOVER_COLOR : P7_AXIS_BG_COLOR)
      : (isAxisHovered ? P7_AXIS_HOVER_COLOR : P7_AXIS_FILLED_COLOR);
    ctx.beginPath(); ctx.arc(axisX, y, markerRadius, 0, Math.PI * 2); ctx.fill();
  });

  // Labels: title lines then the date, hanging under the dot, centred on the
  // line. The block's background is punched so the line (and, in widen mode,
  // any stray dot) doesn't run through the text.
  P7_AXIS_EVENTS.forEach((ev, i) => {
    const st = P7_AXIS_EVENT_STATE[i];
    const rosterOn = st.triggeredAt !== null && st.leavingAt === null;
    const opacity = Math.max(p7AxisEventOpacity(i, now), st.hoverT, rosterOn ? p7AxisRosterT : 0);
    if (opacity <= 0) return;
    ctx.font = p7AxisEventFont();
    const lines = p7WrapLabel(ctx, ev.label, maxWidth);
    const lh = p7AxisEventLineHeight();
    const dateLabel = p7FormatDateDMY(ev.date, ".");
    let tw = 0;
    lines.forEach(t => { tw = Math.max(tw, ctx.measureText(t).width); });
    ctx.font = p7AxisDateFont();
    tw = Math.max(tw, ctx.measureText(dateLabel).width);
    const blockH = lines.length * lh + lh;
    // The block always hangs UNDER the dot (the dot is always above its text).
    // If it would run into a year ring or its label, it is pushed down to just
    // past that label instead.
    const below = evY[i] + P7_AXIS_MARKER_RADIUS + P7_VERT_EVENT_TEXT_GAP;
    let y0 = below;
    (yearSpans || []).forEach(s => {
      if (y0 - 2 < s.bottom && y0 + blockH + 2 > s.top) y0 = s.bottom + P7_VERT_EVENT_TEXT_GAP;
    });
    ctx.globalAlpha = opacity;
    // Punch from the dot's edge (or, when pushed past a year label, from that
    // label's bottom) to the block's far edge — no line between dot and text.
    ctx.fillStyle = "#FDFCFF";
    const punchTop = y0 - P7_VERT_EVENT_TEXT_GAP;
    ctx.fillRect(axisX - tw / 2 - 4, punchTop, tw + 8, y0 + blockH - punchTop);
    const isHoverHighlighted = hoverActive && highlightY !== null && Math.abs(evY[i] - highlightY) < 0.5;
    const labelAlpha = (hoverActive && !isHoverHighlighted) ? P7_AXIS_ROSTER_LABEL_ALPHA : 1;
    ctx.font = p7AxisEventFont();
    ctx.fillStyle = `rgba(0, 0, 0, ${labelAlpha})`;
    lines.forEach((text, li) => ctx.fillText(text, axisX, y0 + li * lh));
    ctx.font = p7AxisDateFont();
    ctx.fillStyle = (hoverActive && !isHoverHighlighted) ? `rgba(0, 0, 0, ${P7_AXIS_ROSTER_LABEL_ALPHA})` : P7_AXIS_LABEL_COLOR;
    ctx.fillText(dateLabel, axisX, y0 + lines.length * lh);
    ctx.globalAlpha = 1;
  });
  ctx.restore();
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
  const AXIS_HIT_PAD = 6; // px of extra hit area around each axis event circle (small target, generous pad)
  const TOOLTIP_GAP = 5; // px of breathing room between the square and the tooltip box, both axes
  // Viewport-px line: a hovered dot above it opens its tooltip DOWNWARD
  // (.is-flipped) instead of the default upward. 295 was tuned by eye with the
  // _debug-tip-flip.js harness — exact px per explicit instruction, don't
  // convert to vh (the choice was made at one viewport size).
  const P7_TIP_FLIP_Y = 295;
  // Horizontal counterparts (viewport px): outside these two lines the tooltip
  // side is forced away from the nearer mini-legend, overriding the data-side
  // mirroring. Tuned by eye with _debug-tip-flip-x.js — exact px, see the
  // comment where they're used in doHitTest. Each line is measured from the
  // edge its legend hangs off: L from the left edge, R as an INSET from the
  // right edge (475 = 1900 − the 1425 screen-X picked at the 1900px-wide
  // tuning viewport). The R line used to be that absolute 1425 — on any
  // window narrower than it no dot could ever cross the line, so the
  // rightward flip silently died after a resize.
  const P7_TIP_FLIP_L = 475;
  const P7_TIP_FLIP_R_INSET = 475;

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
    // The axis-event roster (p7AxisRosterT) eases one step per FRAME, and this
    // single draw() is only one frame — without the loop the roster froze
    // mid-fade at whatever alpha hovering had pumped it up to.
    // p7AxisEventsAnimActive keeps the loop alive until it settles back to 0.
    p7StartAnimLoop();
    // The 8 @fold10 squares' own opacity (a DOM style, not part of the canvas
    // draw() above) also dims/undims with hover — see updateGroups' own
    // p7.hoveredEvent check — so it needs its own refresh here too.
    if (typeof updateGroups === "function") updateGroups();
  }

  // Full clear (square + axis) — for leaving #page-8 entirely.
  function hide() {
    setAxisHover(null);
    hideSquare();
  }

  // Runs the hit-test against p7.lastPositions using the cached cursor
  // position. Called both from onMove (pointer moved) and from p7RecheckHover
  // (canvas just redrew — new dots may have appeared under a stationary cursor).
  function doHitTest() {
    // No hover layer on mobile: a ~2px square is far below a finger-sized
    // target, and pointermove on touch would latch a tooltip that nothing
    // clears. Tap-to-inspect is a separate future addition. Read live, so a
    // resize back over the 600px boundary restores hover (and clears anything
    // still showing on the way in).
    // MOBILE: no hover layer, but the docked frame still has to keep its
    // picker/selected state in step with the page (p7InspectInit below) —
    // doHitTest is the one thing that already runs on every redraw, scroll and
    // pointer event, so it's where that sync is hung.
    if (isMobile()) { hide(); p7InspectSync(); return; }
    // Also fully off while @fold10's bridge glide (page8.js) is mid-flight in
    // either direction (p8PhaseStart non-null): scrolling back up from @fold10
    // lands currentPage on 7 while the dots are still flying back to their
    // timeline spots, and hovering one mid-flight latched a tooltip onto a
    // moving target.
    if (lastCX === null || currentPage !== 8 ||
        (typeof p8PhaseStart !== "undefined" && p8PhaseStart !== null)) { hide(); return; }

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
      // Same reason as hideSquare(): the roster fade-in needs frames, not one
      // draw — run the loop until p7AxisRosterT settles at 1.
      p7StartAnimLoop();
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
    // Mobile: one docked frame above the grid instead of a callout beside the
    // dot — no mirroring, no anchor math, only the contents change (see
    // tooltipDockMobile in js/fold8-tooltip.js). The hit-test above bails out
    // on mobile today (no finger-sized hover target), so this branch only
    // comes alive once tap-to-select lands; it's here so the timeline's own
    // tooltip can never disagree with @fold7/@fold8's about where the frame is.
    const docked = tooltipDockMobile(tooltipEl);
    // Two vertical screen-X lines keep the tooltip off the mini-legends: a dot
    // left of P7_TIP_FLIP_L always opens rightward, a dot within
    // P7_TIP_FLIP_R_INSET of the RIGHT edge always opens leftward; between them
    // the data-side rule holds. Both tuned by eye with the _debug-tip-flip-x.js
    // harness — exact px per explicit instruction, don't convert to vw. Each is
    // a px distance from the edge its legend hangs off, so both lines follow a
    // window resize (an absolute right-line screen-X died on narrow windows).
    // On windows narrower than 950px the bands overlap; the right rule runs
    // last, so it wins there — moot in practice, mobile docks the tooltip.
    const dotCX = rect.left + bestPos.x;
    let mirrored = !docked && bestEvent.side === "left";
    if (!docked && dotCX < P7_TIP_FLIP_L) mirrored = false;
    if (!docked && dotCX > window.innerWidth - P7_TIP_FLIP_R_INSET) mirrored = true;
    tooltipEl.classList.toggle("is-mirrored", mirrored);
    if (docked) {
      tooltipEl.classList.remove("is-flipped");
      updateTooltipDash(tooltipEl);
      return;
    }

    const dotClientX = rect.left + bestPos.x;
    const dotClientY = rect.top  + bestPos.y;
    const rawLeft = mirrored
      ? dotClientX - TOOLTIP_GAP - tooltipEl.offsetWidth
      : dotClientX + TOOLTIP_GAP;
    const left = Math.max(8, Math.min(rawLeft, window.innerWidth - tooltipEl.offsetWidth - 8));
    // Opens upward by default; a dot above the P7_TIP_FLIP_Y line flips the box
    // downward instead — same .is-flipped mechanism as @fold11's hover, whose
    // corner logic updateTooltipDash (js/core.js) already understands.
    const rawTop  = dotClientY - TOOLTIP_GAP - tooltipEl.offsetHeight;
    const flipped = dotClientY < P7_TIP_FLIP_Y;
    tooltipEl.classList.toggle("is-flipped", flipped);
    const top = flipped
      ? dotClientY + P7_SQ + TOOLTIP_GAP
      : rawTop;
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
    if (currentPage !== 8) hide();
    p7InspectSync();
  }, { passive: true });
}

p7HoverInit();

/* =========================================================================
   MOBILE EVENT PICKER (#page-8 only) — the touch counterpart to p7HoverInit
   =========================================================================
   Touch has no hover, and a solved mobile dot (p7SolveMobileSq: ~1.35px at
   320 wide) is two orders of magnitude below a fingertip, so the timeline had
   no way at all to show an event on a phone. This is the tap-to-inspect layer
   the mobile notes have been deferring.

   Two states, both inside the existing docked tooltip frame — there is no
   button to press first. The gesture itself is the affordance, and the frame's
   resting content is the line of text that names it:

     hint  — the empty frame reads P7_INSPECT_HINT.
     event — the ordinary docked tooltip (date + description). There is no
             dismiss control: the selection stands until the next hold replaces
             it, or until leaving #page-8 releases the frame.

   A press-and-hold anywhere on the chart (P7_LONGPRESS_MS with the finger
   inside P7_LONGPRESS_SLOP_PX) opens a 96px circular loupe riding 60px above
   the finger, blitting the main canvas at 4x (drawImage — there is
   deliberately no second render path to keep in sync with draw()). The nearest
   event is marked by p7DrawInspectScrim's halo, which is painted onto the main
   canvas and so arrives in the blit already magnified. Only that gesture blocks page
   scroll (preventDefault on a non-passive touchmove); a touch that moves
   before the hold completes is a scroll and is left entirely alone. */

const P7_LOUPE_SIZE      = 96; // px, matches .p7-loupe
const P7_LOUPE_ZOOM      = 4;  // magnification
const P7_LOUPE_LIFT_PX   = 60; // how far above the fingertip the loupe centre sits
const P7_INSPECT_SNAP_PX = 44; // furthest a dot can be from the finger and still be picked
const P7_LONGPRESS_MS      = 300; // hold this long, without moving, to open the loupe
const P7_LONGPRESS_SLOP_PX = 10;  // move further than this first and it's a scroll, not a hold
const P7_INSPECT_HINT      = "לחצו והחזיקו על נקודה להצגת פרטי האירוע";
// The clipped-description toggle's two labels (p7-tip-more).
const P7_TIP_MORE          = "עוד";
const P7_TIP_LESS          = "פחות";
// Must match `-webkit-line-clamp` on `.page9-tooltip.is-docked
// .page9-tooltip-desc` (style.css) — syncMore measures the text against this
// budget instead of against the clamped box, which misreports its own height.
const P7_TIP_CLAMP_LINES   = 3;
// The selection halo (p7DrawInspectScrim): how far back everything but the
// picked dot is scrimmed, and the exempt disc's radius in dot widths. Both
// tuned by eye on device.
const P7_INSPECT_SCRIM     = 0.76;
const P7_INSPECT_HOLE_DOTS = 1;
// How much the picked dot's own colour is saturated, 0 = unchanged. Deliberately
// small: it should read as the same group colour, just more insistent.
const P7_INSPECT_PICK_SAT = 0.35;

const p7Inspect = { dragging: false, event: null };

// Assigned by p7InspectInit; a no-op until then so doHitTest/the scroll
// handler above can call it unconditionally (and harmlessly on desktop).
let p7InspectSync = () => {};

// Which fold the picker is currently serving, or null. @fold9's pinned timeline
// (page 7) is where it started; @fold11's drag-and-drop grid (page 9) reuses the
// exact same gesture, loupe and docked frame, since its dots are 1px there and
// touch has no hover to fall back on. Everything below that differs between the
// two folds reads this rather than testing currentPage inline.
function p7InspectPage() {
  if (!isMobile()) return null;
  return (currentPage === 8 || currentPage === 10) ? currentPage : null;
}

// The dot map the picker hit-tests against, per fold — same shape either way:
// a Map of event -> {x, y} in CSS-pixel canvas space, recorded by that fold's
// own draw. `maxY` excludes dots the fold doesn't consider inspectable (page 9's
// legit band below the divider, matching desktop p9HoverInit's own exclusion).
function p7InspectSource() {
  if (currentPage === 10) {
    return { positions: p9.lastPositions, half: p9Metrics().SQ / 2, cell: p9Metrics().CELL, maxY: p9.midY ?? Infinity };
  }
  return { positions: p7.lastPositions, half: p7Sq() / 2, cell: p7Cell(), maxY: Infinity };
}

function p7InspectInit() {
  const tipEl    = document.getElementById("page9Tooltip");
  const dateEl   = tipEl.querySelector(".page9-tooltip-date");
  const descEl   = tipEl.querySelector(".page9-tooltip-desc");
  const canvasEl = document.getElementById("canvas");

  // --- the resting content: one line of text, no control -------------------
  const hintEl = document.createElement("div");
  hintEl.className = "p7-inspect-hint";
  hintEl.textContent = P7_INSPECT_HINT;

  // --- "read the rest" -----------------------------------------------------
  // Most descriptions fit the frame's three clamped lines; the long tail does
  // not, and ends in an ellipsis (see .page9-tooltip.is-docked .page9-tooltip-desc
  // in style.css). This is the way out of that clip: it appears ONLY when the
  // text is actually clipped, and opening it grows the frame downward over the
  // chart — never pushing the grid, whose top clearance is derived from the
  // collapsed height (SBB_TIMELINE_MOBILE_TOP_PX).
  // A label, not a <button>: the tap target is the whole frame (the click
  // handler below), so a nested control that can't be clicked would only be a
  // second, misleading target.
  const moreEl = document.createElement("div");
  moreEl.className = "p7-tip-more";

  tipEl.append(hintEl, moreEl);

  // Truncation can only be MEASURED, not predicted — it depends on where the
  // Hebrew wraps at this viewport's width. But it cannot be measured on the
  // description element itself: -webkit-line-clamp truncates that box's LAYOUT
  // rather than merely hiding overflow, so a clamped element reports its
  // clamped height as `scrollHeight` and every scrollHeight > clientHeight test
  // reads "fits" no matter how long the text is. (Lifting the clamp for one
  // forced reflow and reading it back doesn't survive every engine either.)
  //
  // So the text is laid out a second time, offscreen, in a box that is a copy
  // of the description's own width and type but has no clamp to lie about:
  // whatever height it comes to is the honest one.
  const measEl = document.createElement("div");
  measEl.setAttribute("aria-hidden", "true");
  Object.assign(measEl.style, {
    position: "absolute", left: "-9999px", top: "0",
    visibility: "hidden", pointerEvents: "none", whiteSpace: "normal",
  });
  document.body.appendChild(measEl);

  function syncMore() {
    const expanded = tipEl.classList.contains("is-expanded");
    let clipped = false;
    // The description spans the frame's content box, so the frame's own inner
    // width stands in whenever the description itself can't be measured (it is
    // display:none in the picker's resting state). Without that fallback a
    // mistimed call fails SILENTLY as "fits" — which is exactly how this went
    // unnoticed before.
    const width = descEl.clientWidth ||
      (tipEl.clientWidth - 20 /* .page9-tooltip padding, style.css */);
    if (!expanded && width > 0) {
      const cs = getComputedStyle(descEl);
      measEl.style.font       = cs.font;
      measEl.style.lineHeight = cs.lineHeight;
      measEl.style.direction  = cs.direction;
      measEl.style.width      = `${width}px`;
      measEl.textContent      = descEl.textContent;
      // Compared against the clamp's own budget (lines × line-height) rather
      // than the live box's clientHeight, so the test never depends on the
      // clamped element reporting anything truthfully.
      const line = parseFloat(cs.lineHeight) || 17;
      clipped = measEl.offsetHeight > line * P7_TIP_CLAMP_LINES + 1;
    }
    tipEl.classList.toggle("is-expandable", clipped || expanded);
    moreEl.textContent = expanded ? P7_TIP_LESS : P7_TIP_MORE;
  }

  function collapseMore() {
    tipEl.classList.remove("is-expanded", "is-expandable");
  }

  // The whole FRAME is the target, not the little label — a full-width tap area
  // instead of a 30px word. It only accepts events at all while there is
  // something to open (.is-expandable / .is-expanded opt back into
  // pointer-events; see style.css), so in every other state a touch here falls
  // through to the chart exactly as before.
  //
  // It listens on touchend as well as click, not instead of it: the window-level
  // touch handlers further down call preventDefault while a hold is live, and a
  // touch sequence that has been prevented may never emit the synthetic click at
  // all. `lastToggle` swallows the click that normally follows the same tap, so
  // a phone that does emit both doesn't toggle twice and land back where it was.
  let lastToggle = 0;
  function toggleMore(e) {
    if (!tipEl.classList.contains("is-expandable") &&
        !tipEl.classList.contains("is-expanded")) return;
    const now = performance.now();
    if (now - lastToggle < 400) return;
    lastToggle = now;
    // The frame sits over the chart and the tray; without this the tap reaches
    // whatever is behind it (a category pill on @fold11).
    e.stopPropagation();
    tipEl.classList.toggle("is-expanded");
    syncMore();
    // The dashed border is an <svg> sized to the box's own pixel dimensions, so
    // a box that just changed height has to have it rebuilt or the stroke keeps
    // the old outline (js/core.js).
    updateTooltipDash(tipEl);
  }
  tipEl.addEventListener("click", toggleMore);
  tipEl.addEventListener("touchend", toggleMore);

  // --- the loupe ----------------------------------------------------------
  // A sibling of the tooltip in .layout for the same reason #page9Tooltip is
  // one: .graphic-col's stacking context traps any z-index declared inside it.
  const loupeEl = document.createElement("canvas");
  loupeEl.className = "p7-loupe";
  loupeEl.setAttribute("aria-hidden", "true");
  tipEl.parentNode.appendChild(loupeEl);
  const lctx = loupeEl.getContext("2d");

  function hideLoupe() {
    p7Inspect.dragging = false;
    // The dodge belongs to the live finger — lifting it snaps the frame
    // straight back to its resting spot.
    if (p7TipAvoidActive) {
      p7TipAvoidActive = false;
      tooltipDockMobile(tipEl);
    }
    // Dragging is what holds the axis in its hover/state-3 treatment (see
    // p7DrawAxisLine), so the release is where its fade-out has to start.
    p7StartAnimLoop();
    loupeEl.classList.remove("is-visible");
    // The halo is painted into the canvas and only lives for the drag, so
    // lifting the finger has to repaint — nothing else is animating a settled
    // fold, and the chart would otherwise stay dimmed.
    draw();
    // Same for the 8 DOM squares that carry the scrim's dim themselves.
    if (typeof updateGroups === "function") updateGroups();
  }

  // Hands the frame back to @fold7/@fold8's scripted sequence. Its typewriter
  // spans are rebuilt rather than its whole sequence restarted: the spans were
  // detached the moment this picker wrote plain textContent into the same two
  // elements, but fold8SeqElapsed is still valid, so re-seeding them leaves the
  // sequence exactly where it was instead of replaying its grow+type from zero
  // (which would read as the empty frame flickering back in).
  function release() {
    p7Inspect.event = null;
    hideLoupe();
    p7InspectOwnsTooltip = false;
    collapseMore();
    dateEl.textContent = "";
    descEl.textContent = "";
    // @fold9 only — page 9 has no scripted typewriter sequence sharing these
    // two elements, so there is nothing to hand the frame back to there.
    if (currentPage === 8 && typeof fold8SequenceEvent !== "undefined" && fold8SequenceEvent) {
      fold8DateSpans = fold8SetupTypewriter(dateEl, p7FormatDateDMY(fold8SequenceEvent.date));
      fold8DescSpans = fold8SetupTypewriter(descEl, fold8SequenceEvent.descHeMedium || "");
    }
    if (typeof updateGroups === "function") updateGroups();
  }

  function showEvent(ev) {
    p7Inspect.event = ev;
    p7InspectOwnsTooltip = true;
    // The selection marks its date on the year axis with the hover treatment
    // (see p7DrawAxisLine) — the roster fade eases per frame, so the loop has
    // to be running, same as p7HoverInit does when a hover starts.
    p7StartAnimLoop();
    dateEl.textContent = p7FormatDateDMY(ev.date);
    descEl.textContent = ev.descHeMedium || "";
    // The sequence's own inline fades are still on these two elements from the
    // @fold8 shrink beat that emptied the frame — clear them or the text this
    // picker just wrote is invisible.
    dateEl.style.opacity = "1";
    descEl.style.opacity = "1";
    // `color`, not `border-color` — the dashed stroke is the <svg> overlay,
    // which strokes currentColor (see .page9-tooltip in style.css).
    tipEl.style.color = p7ActorColor(ev.actor);
    // Same fold13 factor as sync() below — every writer of this element's
    // opacity must agree during @fold12's scroll fade.
    tipEl.style.opacity =
      String(1 - (typeof p9 !== "undefined" ? (p9.fold13OutT ?? 0) : 0));
    tipEl.style.transform = "translateX(-50%)";
    tipEl.classList.remove("is-mirrored");
    tipEl.classList.remove("is-flipped");
    tipEl.classList.add("is-visible");
    // A new event is a new read: the frame goes back to its collapsed size
    // before the toggle is re-tested, so an open frame can't be left open (and
    // covering the chart) around a description that fits.
    collapseMore();
    tooltipDockMobile(tipEl);
    updateTooltipDash(tipEl);
    // sync() BEFORE syncMore(), and the order is load-bearing: sync() is what
    // drops `is-picker`, and `.is-picker .page9-tooltip-desc` is display:none.
    // Measuring the description while that class is still on measures a hidden
    // box — zero width, no line boxes — so the clip test always reads "fits"
    // and the toggle never appears.
    sync();
    syncMore();
    // While the finger is still down (the loupe is live), a clipped
    // description opens in full immediately — the reader can't tap the
    // frame mid-hold, and the point of the picker is reading the event
    // under the finger. The release (onEnd below) collapses it again; a
    // tap afterwards reopens it through the normal toggle.
    // `is-holding` hides the עוד/פחות label for the duration (style.css):
    // mid-hold it isn't a control — the finger is on the chart — and a
    // "פחות" on a frame that will collapse by itself on release is noise.
    if (p7Inspect.dragging && tipEl.classList.contains("is-expandable")) {
      tipEl.classList.add("is-expanded", "is-holding");
      syncMore();
      updateTooltipDash(tipEl);
    }
  }

  // Nearest dot to a canvas-space point, within P7_INSPECT_SNAP_PX. Same
  // brute-force scan over p7.lastPositions doHitTest uses — that map holds only
  // the squares actually drawn this frame, already in CSS-pixel space.
  function nearestEvent(mx, my) {
    const { positions, half, maxY } = p7InspectSource();
    if (!positions) return null;
    let best = null, bestDist = P7_INSPECT_SNAP_PX * P7_INSPECT_SNAP_PX, bestPos = null;
    for (const [ev, pos] of positions) {
      if (pos.y >= maxY) continue;
      const dx = mx - (pos.x + half), dy = my - (pos.y + half);
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) { bestDist = dist; best = ev; bestPos = pos; }
    }
    return best ? { event: best, x: bestPos.x + half, y: bestPos.y + half } : null;
  }

  // Flips p7TipAvoidActive (js/fold8-tooltip.js) from the finger's height: if
  // the loupe's glass would reach into the docked frame's NORMAL spot, the
  // frame snaps to its dodge spot above the year axis (tooltipAvoidPx). The
  // threshold is computed against where the frame RESTS on this fold — a
  // constant per fold, not the frame's live rect — so a frame already
  // mid-dodge can't drag the threshold down with it and flip-flop. 100 is the
  // collapsed frame height (style.css solves it against the 15px type); an
  // expanded frame reaches lower, but the dodge only needs the common case.
  // Re-docks every call, not just on the flip: the dodge spot is
  // bottom-anchored on the frame's live height, which changes mid-hold as
  // selections swap and descriptions expand.
  function syncTipAvoid(fingerY) {
    const frameTop = currentPage === 10 && typeof p9DockTopM === "function"
      ? p9DockTopM() : TOOLTIP_DOCK_TOP_PX;
    const frameBottom = frameTop + 100;
    const loupeTop = fingerY - P7_LOUPE_LIFT_PX - P7_LOUPE_SIZE / 2;
    // The threshold sits a bit lower than the frame's edge (explicit
    // instruction, first on @fold11 then @fold9 too) — the finger doesn't have
    // to climb as high before the frame snaps down.
    const AVOID_MARGIN_PX = 24;
    p7TipAvoidActive = loupeTop < frameBottom + AVOID_MARGIN_PX;
    tooltipDockMobile(tipEl);
  }

  function drawLoupe(cx, cy) {
    syncTipAvoid(cy);
    const rect = canvasEl.getBoundingClientRect();
    const mx = cx - rect.left, my = cy - rect.top;
    const dpr = window.devicePixelRatio || 1;
    const src = P7_LOUPE_SIZE / P7_LOUPE_ZOOM; // CSS px of canvas sampled, per side

    if (loupeEl.width !== P7_LOUPE_SIZE * dpr) {
      loupeEl.width  = P7_LOUPE_SIZE * dpr;
      loupeEl.height = P7_LOUPE_SIZE * dpr;
    }
    // Pick the dot BEFORE blitting, and repaint the main canvas if the pick
    // changed: the selection halo (p7DrawInspectScrim) lives on that canvas, and
    // the loupe is a plain blit of it. Painting the halo first is what puts it in
    // the glass — magnified along with everything else, with no second render
    // path to keep in sync. Without the repaint the loupe would show the previous
    // frame's halo, since nothing else is animating a settled timeline.
    const hit = nearestEvent(mx, my);
    // updateGroups() alongside it: the 8 fold6 DOM squares carry the same
    // scrim dim as the canvas dots under them (see updateGroups' own
    // P7_INSPECT_SCRIM clause), and draw() alone doesn't touch DOM.
    if (hit && hit.event !== p7Inspect.event) {
      showEvent(hit.event);
      draw();
      if (typeof updateGroups === "function") updateGroups();
    }

    lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lctx.clearRect(0, 0, P7_LOUPE_SIZE, P7_LOUPE_SIZE);
    lctx.fillStyle = "#fff";
    lctx.fillRect(0, 0, P7_LOUPE_SIZE, P7_LOUPE_SIZE);
    // The main canvas's backing store is DPR-scaled (see draw() in js/core.js),
    // so the source rect is in device pixels while the destination is CSS px.
    const sx = (mx - src / 2) * dpr, sy = (my - src / 2) * dpr;
    lctx.imageSmoothingEnabled = false; // dots are 1–2px; smoothing turns them to mush
    lctx.drawImage(canvasEl, sx, sy, src * dpr, src * dpr, 0, 0, P7_LOUPE_SIZE, P7_LOUPE_SIZE);

    // Held above the fingertip so the finger isn't covering what's being read,
    // and clamped so it stays fully on screen near the edges.
    const half = P7_LOUPE_SIZE / 2;
    const left = Math.max(4, Math.min(cx - half, window.innerWidth - P7_LOUPE_SIZE - 4));
    const top  = Math.max(4, cy - P7_LOUPE_LIFT_PX - half);
    loupeEl.style.left = `${left}px`;
    loupeEl.style.top  = `${top}px`;
    loupeEl.classList.add("is-visible");
  }

  // Keeps the frame's three states in step with the page. Cheap and
  // idempotent — called from doHitTest (i.e. every redraw/scroll) as well as
  // from the interactions below.
  function sync() {
    const active = p7InspectPage() !== null;
    if (!active) {
      if (p7Inspect.event || p7InspectOwnsTooltip) release();
      // @fold10's bridge (page 8) sits BETWEEN the two folds the picker serves,
      // and updateGroups' keepEmptyFrame branch deliberately keeps the docked
      // frame on screen through it (gliding down to p9DockTopM()). Without
      // is-picker the hint is display:none, so the frame would make that whole
      // glide as an empty box — keep the hint's class on, gesture still off.
      tipEl.classList.toggle("is-picker", isMobile() && currentPage === 9);
      tipEl.classList.remove("is-inspect");
      return;
    }
    const hasEvent = !!p7Inspect.event;
    tipEl.classList.toggle("is-picker", !hasEvent);
    tipEl.classList.toggle("is-inspect", hasEvent);
    // The frame is normally held open (empty) by updateGroups' keepEmptyFrame
    // branch; assert it here too so the control can never be invisible inside
    // a frame that happens to be down.
    if (!hasEvent) {
      tipEl.classList.add("is-visible");
      // × (1 - fold13OutT): sync() runs on every redraw/scroll while the
      // picker's page is active, which is still true through @fold12's
      // scroll-in (currentPage stays 9 until the observer flips) — an
      // unconditional "1" here re-asserted full opacity between updateFold13's
      // fade writes every frame, making the frame stutter instead of fading.
      tipEl.style.opacity =
        String(1 - (typeof p9 !== "undefined" ? (p9.fold13OutT ?? 0) : 0));
      tipEl.style.transform = "translateX(-50%)";
      tooltipDockMobile(tipEl);
      updateTooltipDash(tipEl);
    }
  }
  p7InspectSync = sync;

  // --- the press-and-hold gesture -----------------------------------------
  // There is no armed mode to enter, so the hold itself has to distinguish
  // "inspect" from "scroll". A touch on the chart starts a timer; movement past
  // P7_LONGPRESS_SLOP_PX doesn't kill it — it RE-ANCHORS it (armTimer below at
  // the new position), so a finger that drag-scrolls the pinned timeline and
  // then comes to rest WITHOUT lifting still opens the loupe after
  // P7_LONGPRESS_MS of stillness. (It used to cancel outright, which made a
  // hold impossible mid-scroll — precisely when the cascade is popping dots in,
  // since on the pinned fold the scrolling finger is what drives it.) While the
  // finger keeps moving the re-anchors keep pushing the deadline back, so a
  // live scroll never opens it. Only once the hold completes does touchmove
  // start calling preventDefault — up to that point the page scrolls exactly
  // as it does today.
  //
  // The one case the re-anchor can't reach is iOS momentum, and it can't be
  // reached from here at all: while a fling is coasting, WebKit delivers NO
  // touch or pointer events to the page whatsoever. Verified on-device with a
  // trace harness — a finger planted on a coasting timeline and held for two
  // seconds produced not one touchstart, not one pointerdown, not one
  // touchcancel. So no handler in this file can arm, re-arm or rescue a hold
  // during a coast; the events simply don't exist until the page settles.
  // Machinery that tried to (P7_COAST_MS/P7_STEAL_MS/armedAfterCancel/
  // P7_HOLD_GRACE_MS, keyed on a touchcancel that never fires) was removed —
  // don't reintroduce it. The reader lifting and pressing again once the page
  // has stopped is, for now, the only path that works.
  let pendingTimer = null, startX = 0, startY = 0;

  function cancelPending() {
    if (pendingTimer !== null) { clearTimeout(pendingTimer); pendingTimer = null; }
  }

  function armTimer(x, y) {
    cancelPending();
    startX = x;
    startY = y;
    pendingTimer = setTimeout(() => {
      pendingTimer = null;
      p7Inspect.dragging = true;
      loupeX = startX;
      loupeY = startY;
      drawLoupe(loupeX, loupeY);
      // The scrim arrives with `dragging`; the 8 DOM squares only learn about
      // it here (drawLoupe repaints the canvas, not the DOM) — and won't at all
      // if the first hit is already the selected event.
      if (typeof updateGroups === "function") updateGroups();
      requestAnimationFrame(loupeTick);
    }, P7_LONGPRESS_MS);
  }

  function chartTouch(e) {
    if (p7InspectPage() === null) return null;
    const t = e.touches[0];
    if (!t) return null;
    const inside = el => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return t.clientY >= r.top && t.clientY <= r.bottom &&
             t.clientX >= r.left && t.clientX <= r.right;
    };
    // The docked frame is opaque and sits over the chart's top strip — a hold
    // there is reading the tooltip, not aiming at a dot behind it. Same for
    // @fold11's tray: a hold on a pill is a (mis-timed) classification tap, and
    // opening the loupe over it would swallow the tap's own click.
    if (inside(tipEl)) return null;
    if (currentPage === 10 && inside(document.querySelector(".page9-tray"))) return null;
    return t;
  }

  window.addEventListener("touchstart", (e) => {
    cancelPending();
    const t = chartTouch(e);
    if (!t) return;
    armTimer(t.clientX, t.clientY);
  }, { passive: true });

  // Re-run the pick + loupe blit every frame while the hold is live, at the
  // last known finger position. The pick otherwise only happens at timer fire
  // and on touchmove — so a hold started while the month cascade is still
  // popping dots in would open on nothing and STAY on nothing under a still
  // finger, even once dots have appeared right under it (this was the "first
  // hold needs two tries" bug). The per-frame pass also keeps the loupe glass
  // itself live while the canvas animates, instead of freezing on the blit
  // from the moment the finger last moved. drawLoupe is cheap (one 96px blit;
  // it only repaints the main canvas when the picked dot actually changes).
  // loupeX/loupeY are what touchmove keeps current below.
  let loupeX = 0, loupeY = 0;
  function loupeTick() {
    if (!p7Inspect.dragging) return;
    drawLoupe(loupeX, loupeY);
    requestAnimationFrame(loupeTick);
  }

  window.addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    if (!t) return;
    if (pendingTimer !== null) {
      // Finger is scrolling: re-anchor at the new position and restart the
      // clock, instead of giving up. A finger that then stays within slop for
      // P7_LONGPRESS_MS — i.e. comes to rest without lifting — fires the hold
      // right where it stopped; a finger that keeps moving keeps pushing the
      // deadline back and the scroll stays untouched.
      if (Math.abs(t.clientX - startX) > P7_LONGPRESS_SLOP_PX ||
          Math.abs(t.clientY - startY) > P7_LONGPRESS_SLOP_PX)
        armTimer(t.clientX, t.clientY);
      return;
    }
    if (!p7Inspect.dragging) return;
    e.preventDefault();
    loupeX = t.clientX;
    loupeY = t.clientY;
    drawLoupe(loupeX, loupeY);
  }, { passive: false });

  // Release drops the selection entirely — the frame goes back to its resting
  // state: the "לחצו והחזיקו" hint, the neutral gray stroke (restored by
  // updateGroups' keepEmptyFrame branch, which repaints the color every frame
  // it runs), no date, no description. The reading belongs to the gesture, not
  // to the page: an event's text and its actor-colored stroke parked there
  // after the finger lifts read as permanent furniture, and kept covering the
  // chart the gesture had just been used to explore.
  //
  // release() does the whole teardown (event, tooltip ownership, text, and
  // @fold9's handback to its scripted typewriter) and calls hideLoupe() itself.
  // Then sync() flips the frame is-inspect -> is-picker.
  const onEnd = () => {
    cancelPending();
    if (p7Inspect.dragging) {
      tipEl.classList.remove("is-expanded", "is-holding");
      release();
      // sync()'s resting branch re-docks the frame and redraws the dashed
      // stroke for its collapsed height, so no separate updateTooltipDash here.
      sync();
    }
  };
  window.addEventListener("touchend", onEnd);
  window.addEventListener("touchcancel", onEnd);

  sync();
}

// --- The momentum brake ------------------------------------------------------
// iOS delivers NO touch events while a native fling coasts (see the note above
// p7InspectInit's pendingTimer), so a finger landing mid-coast is invisible to
// the picker and the hold can't start until the page settles on its own. The
// only way around it is to not let the native fling run: on the picker folds
// (@fold9/@fold11, mobile only) a flick's deceleration is taken over the moment
// the finger lifts — the first programmatic scrollTo cancels the imminent
// native momentum, and a short rAF glide with much stronger friction plays out
// instead. Because the motion is now script-driven, touch events keep arriving
// during it: a finger landing mid-glide stops it dead (the touchstart below)
// and the picker's own touchstart arms the hold — "touch stops the page, then
// picks", which the native fling made impossible.
function p7BrakeInit() {
  // e-folding time of the glide's velocity. Native iOS friction is far weaker
  // (a hard flick coasts for seconds); 180ms stops the same flick in well under
  // half a second and a couple hundred px — enough drift to feel like throw,
  // short enough that the picker is reachable almost immediately.
  const P7_BRAKE_FRICTION_MS = 260;
  // px/ms. Below this the glide ends (and a lift slower than it never starts
  // one — a slow drag just stops where the finger left it, like native).
  const P7_BRAKE_MIN_V = 0.05;
  // A lift more than this after the last move means the finger came to rest
  // first — the stored velocity is stale, not a throw.
  const P7_BRAKE_STALE_MS = 80;

  let lastY = 0, lastT = 0, vy = 0;
  let raf = null;
  const stopGlide = () => {
    if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
  };

  window.addEventListener("touchstart", (e) => {
    stopGlide();
    const t = e.touches[0];
    if (!t) return;
    lastY = t.clientY;
    lastT = performance.now();
    vy = 0;
  }, { passive: true });

  window.addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    if (!t) return;
    const now = performance.now();
    const dt = now - lastT;
    if (dt > 0) {
      // Page velocity is opposite the finger's. Lightly smoothed so one jittery
      // sample at the lift doesn't decide the whole throw.
      const inst = (lastY - t.clientY) / dt;
      vy = vy * 0.4 + inst * 0.6;
    }
    lastY = t.clientY;
    lastT = now;
  }, { passive: true });

  window.addEventListener("touchend", (e) => {
    if (p7InspectPage() === null) return;   // other folds keep native momentum
    if (e.touches.length) return;           // another finger is still down
    if (p7Inspect.dragging) return;         // that was a hold ending, not a throw
    if (performance.now() - lastT > P7_BRAKE_STALE_MS) return;
    if (Math.abs(vy) < P7_BRAKE_MIN_V) return;

    let v = vy;
    let y = window.scrollY;
    let prev = performance.now();
    const step = () => {
      raf = null;
      const now = performance.now();
      const dt = now - prev;
      prev = now;
      y += v * dt;
      v *= Math.exp(-dt / P7_BRAKE_FRICTION_MS);
      window.scrollTo(0, y);
      if (Math.abs(v) >= P7_BRAKE_MIN_V) raf = requestAnimationFrame(step);
    };
    // The first scrollTo — to the position the page already holds — is what
    // cancels the native fling before it gets going; the glide owns it from here.
    window.scrollTo(0, y);
    raf = requestAnimationFrame(step);
  }, { passive: true });
}

// page7.js is the FIRST script on the page (before js/core.js — see
// project.html), so unlike p7HoverInit above this can't run inline: it reads
// isMobile()/currentPage/tooltipDockMobile at init, none of which exist yet.
// The scripts all sit at the end of <body>, so DOMContentLoaded is after them.
document.addEventListener("DOMContentLoaded", p7InspectInit);
document.addEventListener("DOMContentLoaded", p7BrakeInit);
