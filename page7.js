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

// True once the given date's whole month has fully finished its own
// staggered cascade (p7MonthAnimStart, P7_ANIM_TOTAL_DURATION below) — i.e.
// its real per-event square is guaranteed to already be drawn, not just
// "the month has started." Currently unused — @fold9's fold-6 squares no
// longer hand off to a separate real dot at all (p7GetClaimedEvents above
// excludes their events from the cascade permanently), but kept since it may
// be useful again for other month-cascade-timing needs.
function p7IsMonthSettled(dateStr) {
  const mk = p7MonthKeyOf(dateStr);
  const start = p7MonthAnimStart[mk];
  return start !== undefined && performance.now() - start >= P7_ANIM_TOTAL_DURATION;
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

// Wipes all per-month animation state so the next entry into the timeline
// replays the cascade from scratch instead of showing settled dots.
// Called from setActivePage (main.js) when the user scrolls back out of
// @fold10 toward an earlier fold.
function p7ResetForReplay() {
  for (const k in p7MonthAnimStart)    delete p7MonthAnimStart[k];
  for (const k in p7MonthReverseStart) delete p7MonthReverseStart[k];
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

// True once the real timeline (drawPage7, #page-9) has actually been reached
// at least once this "visit" — set by drawPage7 itself, cleared by drawFold9
// (main.js) once fully retreated back out (p7HasEngaged false again and
// nothing left animating). Lets drawFold9 keep drawing/animating the
// per-event squares (p7DrawTimelineSquares below) for as long as there's
// still something to retreat when the user scrolls back up from #page-9 into
// #page-8, without changing when the *forward* reveal itself first starts —
// that still only ever happens via drawPage7, i.e. once #page-9 is actually
// reached, same as before this flag existed.
let p7RealTimelineReached = false;

// Updates p7HasEngaged — called from drawPage7 (currentPage 9) and drawFold9
// (main.js, currentPage 8) alike, since the title card this depends on
// belongs to fold 9/#page-8. p7HasEngaged is recomputed fresh every call, not
// a one-way latch, so scrolling back up un-engages it again and scrolling
// forward replays the same axis-then-squares sequence — calling this from
// both draw functions (rather than only drawPage7) is what makes that
// reversal actually take effect immediately while currentPage is 8, instead
// of freezing at whatever it last was the moment currentPage left 9.
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
function p7UpdateEngagement() {
  p7HasEngaged = !!(page7TitleCardEl && page7TitleCardEl.getBoundingClientRect().top <= 0);
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
  p7AxisLaggedFillFrac = p7AxisLaggedFillFrac === null
    ? target
    : p7AxisLaggedFillFrac + (target - p7AxisLaggedFillFrac) * P7_AXIS_FILL_LAG_DAMPING;
  if (p7AxisFillLagActive()) p7StartAnimLoop();
  return p7AxisLaggedFillFrac;
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
  if (p7AxisFillLagActive()) return true;
  return false;
}

// page8 (index 10) renders by calling drawPage7 directly with currentDate forced to
// maxDate (see page8.js) — it's a continuation of page7's view, not a separate one, so
// the cascade must keep redrawing there too, or it freezes the instant the user
// scrolls into page8 mid-flight instead of finishing "off screen" as page7 intended.
// Fold 9 (#page-8, currentPage 8 — drawFold9 in main.js, just before the real
// timeline) is included too, now that its own axis build-in (p7AxisIntroT
// above) can be playing while it's on screen. Fold 7 (#page-7, currentPage 7 —
// drawFold7 in main.js) is included too, now that it also keeps drawing
// p7DrawTimelineSquares for as long as p7RealTimelineReached is true (see that
// flag's own comment) — a fast enough scroll-up can carry the user past
// #page-8 into this fold within a single continuous motion while squares are
// still mid-retreat.
function p7ShouldRedrawForAnim() { return currentPage === 7 || currentPage === 8 || currentPage === 9 || currentPage === 10; }

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
  const claimedEvents = p7GetClaimedEvents();

  for (let i = 0; i < monthEnd; i++) {
    const cell = positions[i];
    const col  = cell % cols;
    const row  = Math.floor(cell / cols);
    const destX = x0 + col * CELL;
    const destY = topY + row * CELL;

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

// The 8 real events @fold9's fold-6 squares fly to/become (FOLD6_SQUARE_ACTORS/
// FOLD6_SQUARE_OCCURRENCE, main.js — referenced here only inside this function
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
    const event = p7EventForActorOccurrence(actor, FOLD6_SQUARE_OCCURRENCE[i]);
    if (event) p7ClaimedEvents.add(event);
  });
  return p7ClaimedEvents;
}

// Extracted from drawPage7 below so drawFold9 (main.js, #page-8, currentPage
// 8) can keep this running too — see p7RealTimelineReached's own comment
// above for why: without this, scrolling back up from #page-9 into #page-8
// (crossing back over @fold9's own title) made every still-retreating square
// (and the year axis's own headline events, p7DrawAxisEvents) vanish in a
// single frame the instant currentPage dropped, instead of finishing their
// reverse cascade like they do while scrolling backward *within* #page-9
// itself. Callers must call p7UpdateEngagement() themselves first (drawPage7/
// drawFold9 both already do, since the axis needs a fresh p7HasEngaged too).
function p7DrawTimelineSquares(ctx, W, H) {
  p7UpdateLayout(W, H);

  const { CELL, SQ, cols, leftX0 } = p7;
  const topY    = Math.round(H * SBB_TIMELINE.top);
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
  // scrolled past the top of the viewport, AND the year axis's own build-in
  // wipe (p7AxisIntroT) has fully finished.
  const isNewTerritory = p7HasEngaged && curMonthKey > p7MonthMaxReached;
  if (p7HasEngaged && p7MonthAnimStart[curMonthKey] === undefined) {
    p7MonthAnimStart[curMonthKey] = isNewTerritory ? now : now - P7_ANIM_TOTAL_DURATION;
  }
  if (isNewTerritory) p7StartAnimLoop();

  if (p7HasEngaged) {
    // Scrolling back onto a month cancels any retreat it had started — it just
    // resumes showing at rest (its original forward cascade, started long ago,
    // is already done).
    delete p7MonthReverseStart[curMonthKey];
  } else if (p7MonthMaxReached > -1 && p7MonthReverseStart[curMonthKey] === undefined) {
    // Disengaged (scrolled back up past this fold's own title — see
    // p7UpdateEngagement): the "current" month itself now needs to retreat
    // too, not just months ahead of it (the loop below already handles those
    // unconditionally) — otherwise it just sits at rest until
    // nextMonthStartStr's clamp further down cuts it away in a single frame
    // instead of playing the same reverse cascade every other month gets.
    p7MonthReverseStart[curMonthKey] = now;
    p7StartAnimLoop();
  }

  if (p7HasEngaged && curMonthKey > p7MonthMaxReached) p7MonthMaxReached = curMonthKey;

  // Scrolled backward past months that were previously reached: start their retreat
  // (each flies back out the same way it flew in) unless it's already retreating.
  // Unconditional on p7HasEngaged (always was) — once disengaged, curMonthKey is
  // pinned at the first month (p7.currentDate = p7.minDate, page7UpdateFromScroll),
  // so this still correctly covers every later month up through p7MonthMaxReached.
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
  // Once disengaged and the current month's own retreat (started above) has
  // also fully finished, drop it too — otherwise p7MonthMaxReached would get
  // stuck one month above curMonthKey forever (the loop above only ever pops
  // months *strictly ahead* of curMonthKey).
  if (
    !p7HasEngaged &&
    p7MonthMaxReached === curMonthKey &&
    p7MonthReverseStart[curMonthKey] !== undefined &&
    now - p7MonthReverseStart[curMonthKey] >= P7_ANIM_TOTAL_DURATION
  ) {
    delete p7MonthReverseStart[curMonthKey];
    delete p7MonthAnimStart[curMonthKey];
    p7MonthMaxReached--;
  }

  // Walk backward from the centered month while previous months are still mid-cascade,
  // to find the earliest month that must still be drawn with animation applied. Once
  // disengaged, everything still in flight (including the current month, see above) is
  // retreating, so there's no "settled, at-rest" range at all — clamp straight to
  // minDate instead.
  let settledStr = p7.minDate;
  if (p7HasEngaged) {
    let earliestActiveMonthKey = curMonthKey;
    for (let k = curMonthKey - 1; p7MonthAnimStart[k] !== undefined && now - p7MonthAnimStart[k] < P7_ANIM_TOTAL_DURATION; k--) {
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

  // groupReverse (p7DrawSideSquares) is decided by comparing a group's own
  // month key against the value passed here — while disengaged, the current
  // month's own group must also read as "reverse" (it's retreating too, see
  // above), which plain curMonthKey can't express since a month is never
  // "ahead of itself." -1 always sorts below every real month key
  // (curY*12+curM, always a large positive number), so passing it here
  // instead makes every real month — including the current one — compare as
  // reverse. Only ever used for this numeric comparison, never fed into
  // p7MonthKeyToStartStr.
  const drawCurMonthKey = p7HasEngaged ? curMonthKey : -1;

  // Draw left events.
  p7DrawSideSquares(ctx, p7.leftEvents, p7.leftPos, leftX0, topY, cols, CELL, SQ, monthEndL, settledL, drawCurMonthKey, posMap);

  // Draw right events.
  p7DrawSideSquares(ctx, p7.rightEvents, p7.rightPos, rightX0, topY, cols, CELL, SQ, monthEndR, settledR, drawCurMonthKey, posMap);

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

// The year axis's build-in (p7AxisIntroT, via p7AxisTriggerIfNeeded below)
// just piggybacks on p7HasEngaged (the real timeline's own engagement flag,
// also gated on fold 9's title card passing fully offscreen — see
// p7UpdateEngagement above) rather than recomputing the same geometry itself.
// @fold9's own speculative color-in/fly-out triggers (main.js) were removed
// this session — this axis gate is intentionally the simple, original
// version, not tied to any of that.
function p7AxisShouldShow() {
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
  { date: "2023-01-11", label: "הצגת הרפורמה המשפטית" },
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
const P7_AXIS_EVENT_LINE_END_GAP = 8;   // px short of the dot's dead center the tick stops at
const P7_AXIS_DATE_FONT          = "600 14px 'Assistant', sans-serif";
const P7_AXIS_DATE_OFFSET        = 18;  // px above the label baseline

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
const P7_AXIS_EVENT_STATE = P7_AXIS_EVENTS.map(() => ({ triggeredAt: null, leavingAt: null }));

// Checked every draw (see p7AnyAnimActive) so the animation loop keeps running —
// and labels keep fading — purely on elapsed time, with no further scrolling
// required.
function p7AxisEventsAnimActive() {
  const now = performance.now();
  return P7_AXIS_EVENT_STATE.some((state, i) => {
    if (state.triggeredAt === null) return false;
    if (now - state.triggeredAt < P7_AXIS_EVENT_FADE_IN_MS) return true;
    if (state.leavingAt !== null && now - state.leavingAt < P7_AXIS_EVENT_FADE_OUT_MS) return true;
    const next = P7_AXIS_EVENT_STATE[i + 1];
    return !!next && next.triggeredAt !== null && now - next.triggeredAt < P7_AXIS_EVENT_FADE_OUT_MS;
  });
}

// Computes where event `ev`'s label actually renders — its tick's own x
// (snapped to the nearest real dot, p7AxisEventSnappedX, so the tick lands
// exactly on a dot's center rather than in the gap between two — falls back
// to the raw date position if this event hasn't been matched to a segment
// yet, e.g. the very first frame) — and the label's rendered left/right
// extent given a near-edge alignment fallback (centered text would push past
// the canvas edge for an event anchored right at it, so it falls back to
// right/left alignment, extending only inward). Requires ctx.font already
// set to P7_AXIS_EVENT_FONT.
function p7AxisEventBounds(ctx, ev, i, W) {
  const x = p7AxisEventSnappedX[i] !== undefined ? p7AxisEventSnappedX[i] : p7AxisX(ev.date, W);
  const textWidth = ctx.measureText(ev.label).width;
  let align = "center", left, right;
  if (x + textWidth / 2 > W)      { align = "right"; left = x - textWidth; right = x; }
  else if (x - textWidth / 2 < 0) { align = "left";  left = x; right = x + textWidth; }
  else                             { left = x - textWidth / 2; right = x + textWidth / 2; }
  const lineX = align === "right" ? x - textWidth / 2
              : align === "left"  ? x + textWidth / 2
              : x;
  return { x, left, right, align, lineX };
}

// Fires each event's one-shot animation the instant p7.currentDate reaches its
// date, regardless of how the user got there (slow scroll, fast flick, or a
// direct jump) — and un-fires it if they scroll back above that date. Requires
// p7.currentDate to have actually advanced past p7.minDate first: the pinned
// scrub section (page7UpdateFromScroll, main.js) starts every visit at exactly
// t=0 → currentDate=minDate, before the user has scrolled within it at all, and
// the first event's own date (2023-01-01) sits *before* the dataset's actual
// minDate (2023-01-10) — so without this, "reached" would already be true on
// arrival and the event would show before any scrolling happened. Every event,
// including the first, uses this same plain date-based rule (and renders at
// this same date's axis position, p7AxisEventBounds below) — per explicit
// instruction, no special-cased extra delay for the first one.
function p7UpdateAxisEventTriggers() {
  const curMs = new Date(p7.currentDate + "T00:00:00Z").getTime();
  const minMs = new Date(p7.minDate + "T00:00:00Z").getTime();
  const hasScrolled = curMs > minMs;
  const now = performance.now();
  P7_AXIS_EVENTS.forEach((ev, i) => {
    const state = P7_AXIS_EVENT_STATE[i];
    const reached = hasScrolled && curMs >= new Date(ev.date + "T00:00:00Z").getTime();
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
    const fadeOut = 1 - (now - next.triggeredAt) / P7_AXIS_EVENT_FADE_OUT_MS;
    opacity = Math.min(opacity, Math.max(0, fadeOut));
  }
  return opacity;
}

function p7DrawAxisEvents(ctx, W, axisY, curX) {
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
    const { x, left, right, align, lineX } = p7AxisEventBounds(ctx, ev, i, W);
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

    // Date below the label — same color as the axis's own filled dots/tick
    // (P7_AXIS_FILLED_COLOR, via globalAlpha rather than string-parsing its
    // own alpha, same pattern as the tick line below), bold, rather than a
    // dimmer black — ties it visually to the dot it belongs to instead of
    // reading as a de-emphasized caption under the label.
    const dateLabel = p7FormatDateDMY(ev.date, ".");
    ctx.font = P7_AXIS_DATE_FONT;
    ctx.textAlign = "center";
    ctx.fillStyle = P7_AXIS_FILLED_COLOR;
    ctx.globalAlpha = opacity;
    ctx.fillText(dateLabel, lineX, axisY - yOff + P7_AXIS_DATE_OFFSET);
    ctx.globalAlpha = 1;

    // Runs down to just shy of axisY — the exact vertical center of the dot
    // lineX is snapped to (p7AxisEventSnappedX/p7AxisEventBounds) — a small
    // trim (P7_AXIS_EVENT_LINE_END_GAP) short of dead center rather than
    // reaching it exactly, so it still reads as plugging into the dot
    // without the line's own end poking out past the far side of the
    // repainted dot patch below. Same color as the axis's own filled dots
    // (P7_AXIS_FILLED_COLOR, via globalAlpha rather than string-parsing its
    // own alpha) so a future edit to that color updates this tick too —
    // modulated by this event's own crossfade opacity on top, same as the
    // label/date above it.
    ctx.strokeStyle = P7_AXIS_FILLED_COLOR;
    ctx.globalAlpha = opacity;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lineX, axisY - yOff + P7_AXIS_DATE_OFFSET + P7_AXIS_EVENT_LINE_GAP);
    ctx.lineTo(lineX, axisY - P7_AXIS_EVENT_LINE_END_GAP);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // The line's own semi-transparent stroke and the dot's own semi-transparent
    // fill would otherwise double up right where they overlap (both drawn with
    // alpha < 1, so the overlap composites darker than either alone) — wipe
    // that one dot's own small patch back to the plain frame background first
    // (same solid color drawBackground, main.js, fills the whole canvas with
    // at the start of every frame) before repainting it, so the repaint is a
    // single normal blend against a clean base rather than a third layer
    // stacked on top of the other two (which would only compound the problem).
    ctx.fillStyle = "#FDFCFF";
    ctx.beginPath();
    ctx.arc(lineX, axisY, P7_AXIS_LINE_THICKNESS / 2 + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = lineX >= curX ? P7_AXIS_FILLED_COLOR : P7_AXIS_BG_COLOR;
    ctx.beginPath();
    ctx.arc(lineX, axisY, P7_AXIS_LINE_THICKNESS / 2, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

// Same spacing math p7DrawAxisDots uses to actually place dots (nudged so a
// dot lands exactly on *both* fromX and toX) — factored out so a headline
// event's tick can be snapped to whichever of these exact x's is nearest,
// rather than drawn at its own free-running date-interpolated x, which
// almost never lands exactly on a real dot.
function p7AxisDotPositions(fromX, toX) {
  const length = Math.abs(toX - fromX);
  if (length <= 0) return [];
  const count = Math.max(2, Math.round(length / P7_AXIS_DOT_GAP) + 1);
  const step  = length / (count - 1);
  const dir   = toX > fromX ? 1 : -1;
  const positions = [];
  for (let i = 0; i < count; i++) positions.push(fromX + dir * i * step);
  return positions;
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
  for (const x of p7AxisDotPositions(fromX, toX)) {
    ctx.fillStyle = x >= curX ? P7_AXIS_FILLED_COLOR : P7_AXIS_BG_COLOR;
    ctx.beginPath();
    ctx.arc(x, axisY, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Snaps `x` to whichever actual dot (see p7AxisDotPositions) between fromX
// and toX sits closest to it.
function p7AxisNearestDotX(fromX, toX, x) {
  let best = null, bestDist = Infinity;
  for (const dx of p7AxisDotPositions(fromX, toX)) {
    const dist = Math.abs(dx - x);
    if (dist < bestDist) { bestDist = dist; best = dx; }
  }
  return best;
}

// A headline event's tick/label position (see p7AxisEventBounds), snapped to
// the nearest real dot — filled in below by p7DrawYearAxis's own dot-segment
// loop, the only place that has each segment's exact fromX/toX (and the 18px
// tick font active, needed for labelClearance) on hand. Keyed by index into
// P7_AXIS_EVENTS; rebuilt fresh every frame, so a resize or date-range change
// can't leave a stale snap behind.
let p7AxisEventSnappedX = [];

function p7DrawYearAxis(ctx, W, H) {
  const ticks = p7AxisYearTicks();
  const rawCurX = p7AxisX(p7.currentDate, W);

  // A tick is "reached" once the growing edge has caught up to (or passed) its
  // x position — the start tick is always reached by definition.
  const visible = ticks.filter((tick, i) => i === 0 || p7AxisX(tick.dateStr, W) >= rawCurX);

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

  // The "2023" text itself isn't part of the fillable timeline — the first
  // actual dot sits to its left, past labelClearance. Rather than clamping
  // rawCurX to that dot's position (which would pin the fill there for the
  // whole span of real progress it takes rawCurX to close that small label
  // gap on its own — reading as fake/stuck, not actually filling), the fill's
  // own x-mapping is rescaled to run from the first dot's position down to
  // the left edge, instead of from the label's own position — the exact same
  // frac (0 at p7.minDate, 1 at p7.maxDate) p7AxisX uses, just applied to a
  // shorter span that starts where the dots actually start. So curX begins
  // exactly at that first dot and moves continuously from there with every
  // bit of real forward progress, rather than sitting artificially pinned.
  // fillFrac itself is lagged (p7AxisUpdateFillLag), not the raw scroll-driven
  // value, so the fill trails a beat behind rather than snapping to scroll 1:1.
  const axisStartX = p7AxisX(ticks[0].dateStr, W) - labelClearance(ticks[0]);
  const leftX = P7_AXIS_MARGIN;
  const fillFrac = p7AxisUpdateFillLag();
  const curX = axisStartX - fillFrac * (axisStartX - leftX);

  // Snaps each headline event to its nearest real dot across *all* segments
  // (see p7AxisNearestDotX), not just whichever segment strictly contains its
  // raw date — an event whose date sits inside a year label's own reserved
  // clearance gap (no dots there at all, e.g. the very first event, only ~10
  // days into the dataset and still within the "2023" label's own space)
  // would otherwise never match any segment and never get snapped. Must
  // happen here, segment by segment, since only here do we have each
  // segment's exact fromX/toX (and the 18px tick font active, needed by
  // labelClearance) on hand. Read by p7AxisEventBounds below.
  p7AxisEventSnappedX = [];
  const snapDist = [];
  function snapEventsInSegment(fromX, toX) {
    P7_AXIS_EVENTS.forEach((ev, ei) => {
      const evX = p7AxisX(ev.date, W);
      const nearest = p7AxisNearestDotX(fromX, toX, evX);
      if (nearest === null) return;
      const dist = Math.abs(nearest - evX);
      if (snapDist[ei] === undefined || dist < snapDist[ei]) {
        snapDist[ei] = dist;
        p7AxisEventSnappedX[ei] = nearest;
      }
    });
  }

  // One continuous dotted line spanning the full p7.minDate-to-p7.maxDate span,
  // present from the very first frame — each dot picks its own filled/faint
  // color (see p7DrawAxisDots) based on curX, so the line itself reads as
  // filling up rather than as a faint line with a separate dark one laid over it.
  for (let i = 1; i < ticks.length; i++) {
    const fromX = p7AxisX(ticks[i - 1].dateStr, W) - labelClearance(ticks[i - 1]);
    const toX   = p7AxisX(ticks[i].dateStr, W) + P7_AXIS_LABEL_PAD;
    if (fromX <= toX) continue;
    p7DrawAxisDots(ctx, fromX, toX, axisY, curX);
    snapEventsInSegment(fromX, toX);
  }
  // The remainder past the last whole-year tick, out to the axis's true left edge
  // (p7.maxDate itself rarely falls exactly on a January 1st).
  const finalTick  = ticks[ticks.length - 1];
  const finalTickX = p7AxisX(finalTick.dateStr, W) - labelClearance(finalTick);
  const axisLeftX  = P7_AXIS_MARGIN;
  if (finalTickX > axisLeftX) {
    p7DrawAxisDots(ctx, finalTickX, axisLeftX, axisY, curX);
    snapEventsInSegment(finalTickX, axisLeftX);
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

  p7DrawAxisEvents(ctx, W, axisY, curX);
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
    // The 8 @fold9 squares' own opacity (a DOM style, not part of the canvas
    // draw() above) also dims/undims with hover — see updateGroups' own
    // p7.hoveredEvent check — so it needs its own refresh here too.
    if (typeof updateGroups === "function") updateGroups();
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
      // Same DOM-opacity refresh as hide() above — see that comment.
      if (typeof updateGroups === "function") updateGroups();
      // draw() just rebuilt p7.lastPositions — bestPos (read below for
      // tooltip placement) still points at the same {x,y}, since dimming
      // only changes alpha, but refresh the reference for clarity/safety.
      bestPos = p7.lastPositions.get(bestEvent);
    }

    dateEl.textContent = p7FormatDateDMY(bestEvent.date);
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
