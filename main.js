const canvas = document.getElementById("canvas");
const ctx    = canvas.getContext("2d");

const PAGES = [drawPage1, drawPage2, drawPage3, drawPage4, drawPage5, drawPage7, drawPage8, drawPage9];
let currentPage = 0;

function drawBackground(ctx, W, H) {
  ctx.fillStyle = "#FFFFFC";
  ctx.fillRect(0, 0, W, H);
  // The vignette is a single CSS layer (.vignette in style.css) spanning the whole
  // viewport — canvas + text column together — so there's no seam at the column edge.
}

function draw() {
  const W = canvas.clientWidth, H = canvas.clientHeight;
  PAGES[currentPage](ctx, W, H);
}

function init() {
  const dpr  = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

// ── Scrollytelling: which text section is active drives the pinned canvas ──
const sections = Array.from(document.querySelectorAll(".text-section"));

function setActivePage(page) {
  if (page === currentPage) return;
  currentPage = page;
  draw();
  // Re-sync immediately rather than waiting for the next scroll event — currentPage
  // can flip here slightly out of step with scroll position, and without this the
  // overlay can stay visible a frame too long when leaving page 3 for page 4 (or
  // page 4 for page 5/6).
  page4UpdateFromScroll();
}

const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) setActivePage(Number(entry.target.dataset.page));
  });
}, { rootMargin: "-50% 0px -50% 0px", threshold: 0 });

sections.forEach(sec => sectionObserver.observe(sec));

// ── Page 7's tall section is a pure scroll-driver: scroll position -> date.
// It also opens with page 6's old intro title (the two "כל ריבוע..." /
// "הצבע מציין..." lines, fused in here instead of being its own scroll step,
// see .page6-intro in index.html/style.css) — a static header sitting above
// the timeline's month list the whole time it's pinned, no animation. ──
const page7Section = document.getElementById("page-5");
let page7Ticking = false;

function page7UpdateFromScroll() {
  const rect = page7Section.getBoundingClientRect();

  // t=0 when the section's top reaches the viewport top, t=1 one scrub-range of scrolling
  // later. The scrub range is the section height minus one viewport height — that trailing
  // viewport height is slack reserved for the sticky timeline (#page7Timeline) to release
  // from its pinned position without affecting the date (see .page7-scrub in style.css).
  const scrubRange = rect.height - window.innerHeight;
  const t = scrubRange > 0 ? Math.max(0, Math.min(1, -rect.top / scrubRange)) : 0;

  if (!p7.ready) return;
  const minD = new Date(p7.minDate + "T00:00:00Z");
  const maxD = new Date(p7.maxDate + "T00:00:00Z");
  const totalDays = Math.round((maxD - minD) / 86400000);
  const cur = new Date(minD);
  cur.setUTCDate(cur.getUTCDate() + Math.round(t * totalDays));
  p7.currentDate = cur.toISOString().slice(0, 10);
  p7RenderTimeline();

  if (currentPage === 5) draw();
}

window.addEventListener("scroll", () => {
  if (page7Ticking) return;
  page7Ticking = true;
  requestAnimationFrame(() => { page7UpdateFromScroll(); page7Ticking = false; });
}, { passive: true });

// ── Page 2's title glides up from below into a pinned, centered spot, then the
// legend's group swatches reveal one by one as scrolling continues — two scroll-
// driven phases sharing the section's slack (see .page2-panel in style.css). ──
const page2Section     = document.getElementById("page-1");
const page2TitleEl      = document.querySelector("#page-1 .section-title");
const page2LegendItems  = Array.from(document.querySelectorAll("#page-1 .page2-legend-item"));
const PAGE2_TITLE_TRAVEL  = 180; // px the title glides upward before locking in place
const PAGE2_LEGEND_STAGGER = 140; // px of additional scroll between each legend item revealing — wide enough that
                                   // a single wheel/trackpad tick can't skip past more than one item's threshold
let page2Ticking = false;

function page2UpdateFromScroll() {
  const rect = page2Section.getBoundingClientRect();
  const scrolled = -rect.top;

  const titleT = Math.max(0, Math.min(1, scrolled / PAGE2_TITLE_TRAVEL));
  page2TitleEl.style.transform = `translateY(${(1 - titleT) * PAGE2_TITLE_TRAVEL}px)`;

  // Not clamped to 0: items must stay hidden until scrolling has gone past the
  // title's full travel distance, not just until the (clamped) value reaches 0.
  const legendScroll = scrolled - PAGE2_TITLE_TRAVEL;
  page2LegendItems.forEach((item, i) => {
    item.classList.toggle("is-visible", legendScroll > i * PAGE2_LEGEND_STAGGER);
  });
}

window.addEventListener("scroll", () => {
  if (page2Ticking) return;
  page2Ticking = true;
  requestAnimationFrame(() => { page2UpdateFromScroll(); page2Ticking = false; });
}, { passive: true });

// ── Once every legend swatch has fully appeared, continued scrolling sends them
// all gliding together into their spots in page 3's centered list — the legend's
// reveal stays a clean, finished moment first, and only afterward does the page 3
// approach take over. A DOM overlay duplicates each legend item (the real one
// hides once the glide starts, so there's only one visible copy) and tweens it
// via transform from a snapshot of its dock position to the row position page 3
// would otherwise draw on canvas. ──
const PAGE3_GROUPS = [
  { label: "מתיישבים",             color: "#F9880D" },
  { label: "מתנגדי הרפורמה המשפטית", color: "#0C7AE0" },
  { label: "חרדים",                color: "#16181D" },
  { label: "פעילי ימין",           color: "#69DB12" },
  { label: "יוצאי אתיופיה",        color: "#9B30D9" },
  { label: "פעילי שמאל",           color: "#EF3890" },
  { label: "ערבים ישראלים",        color: "#0E7A14" },
];

const groupsOverlayEl = document.getElementById("groupsOverlay");

const groupItems = PAGE3_GROUPS.map(({ label, color }) => {
  const legendEl = document.querySelector(`#page-1 .page2-legend-item[data-group="${label}"]`);

  const el = document.createElement("div");
  el.className = "group-item";
  const swatch = document.createElement("span");
  swatch.className = "group-swatch";
  swatch.style.background = color;
  el.appendChild(swatch);
  el.appendChild(document.createTextNode(label));
  groupsOverlayEl.appendChild(el);

  return { legendEl, el };
});

// Scroll position at which the last legend item finishes revealing — the glide
// to page 3 only starts past this point, never before every item has appeared.
const PAGE2_REVEAL_END = PAGE2_TITLE_TRAVEL + (PAGE3_GROUPS.length - 1) * PAGE2_LEGEND_STAGGER;
// Extra scroll, past PAGE2_REVEAL_END, during which the title and the fully-revealed
// row of groups just sit still — a deliberate pause before the cascade to page 3
// starts, instead of the glide beginning the instant the last item finishes revealing.
const PAGE2_GLIDE_HOLD = 420;
const GROUP_GLIDE_START = PAGE2_REVEAL_END + PAGE2_GLIDE_HOLD;
const page2StickyEl = document.querySelector("#page-1 .page2-sticky");
let groupMorphStartRects = null; // snapshot of each legend item's dock rect, captured the instant the glide begins
let groupMorphTicking = false;

// The next item's window starts very soon after the current one (HANDOFF below) —
// not once the current item is mostly done, but while it's still near the start of
// its own eased motion (eased = HANDOFF * GROUP_GLIDE_SPEED ≈ 0.24) — so the cascade
// reads as a continuous flow instead of each item visibly racing ahead before the
// next one even begins. Collisions are avoided not by keeping items out of each
// other's way in time, but in space: each item's own horizontal and vertical motion
// are eased so vertical separation grows from the very first frame (never flat at
// zero while only x is changing), so by the time two overlapping items are both
// near the same x, they already have meaningfully different y.
const GROUP_GLIDE_HANDOFF = 0.12;
const GROUP_GLIDE_WINDOW = 1 / (GROUP_GLIDE_HANDOFF * (PAGE3_GROUPS.length - 1) + 1);
const GROUP_GLIDE_STRIDE = GROUP_GLIDE_HANDOFF * GROUP_GLIDE_WINDOW;
const GROUP_GLIDE_SPEED = 2; // each item finishes its own motion at 1/this fraction of its window, then holds

let page2to3T = 0; // last t computed below, read by page3to4UpdateFromScroll's is-active check

function page2to3UpdateFromScroll() {
  const scrolled = -page2Section.getBoundingClientRect().top;
  const sectionHeight = page2Section.offsetHeight;
  const runway = Math.max(1, sectionHeight - GROUP_GLIDE_START);
  const t = Math.max(0, Math.min(1, (scrolled - GROUP_GLIDE_START) / runway));
  page2to3T = t;

  if (t > 0 && !groupMorphStartRects) {
    // Store each item's offset from the sticky wrapper's own top edge, rather than
    // its raw viewport position — the wrapper is still mid-pin at GROUP_GLIDE_START
    // in ordinary scrolling, but a fast fling or programmatic jump can land the
    // first t>0 frame after the wrapper has already started releasing (sliding up
    // with the rest of the section), which would otherwise bake in an off-screen
    // position and leave every item invisible for the rest of the glide.
    const stickyTop = page2StickyEl.getBoundingClientRect().top;
    groupMorphStartRects = groupItems.map(({ legendEl }) => {
      const r = legendEl.getBoundingClientRect();
      return { left: r.left, width: r.width, height: r.height, top: r.top - stickyTop };
    });
  } else if (t === 0) {
    groupMorphStartRects = null;
    // Restore every real legend item's CSS-driven opacity — without this, an item
    // hidden during a previous glide (t > 0) stays stuck at opacity 0 forever,
    // since the loop that would normally reset it never runs once t is back to 0.
    groupItems.forEach(({ legendEl }) => { legendEl.style.opacity = ""; });
  }

  groupsOverlayEl.classList.toggle("is-active", (t > 0 && currentPage === 1) || currentPage === 2);

  if (!groupMorphStartRects) return;

  // Re-add the sticky wrapper's current top so the dock position tracks it even
  // while it's mid-release, instead of being frozen to wherever it was at capture.
  const stickyTop = page2StickyEl.getBoundingClientRect().top;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  const itemH = 36, totalH = PAGE3_GROUPS.length * itemH, startY = H / 2 - totalH / 2, centerX = W / 2;

  groupItems.forEach(({ legendEl, el }, i) => {
    const start = groupMorphStartRects[i];
    const startTop = start.top + stickyTop;
    const rowY = startY + i * itemH + itemH / 2;
    const endLeft = centerX + 6 - start.width; // square's right edge (centerX+6) anchors the item's right edge
    const endTop  = rowY - start.height / 2;

    // Each item gets its own overlapping window for its left-then-down journey —
    // bottom row (last item) goes first, and the next one starts well before the
    // current one finishes (GROUP_GLIDE_STRIDE), so the cascade keeps flowing
    // instead of waiting for each item to settle. Within its own window, an item
    // still leans toward "left, then down" (tx outpaces ty early on), but ty is
    // never flat at zero — it's already easing in from the first frame — so two
    // overlapping items always have some vertical separation, not just a shared
    // horizontal line.
    const slot = PAGE3_GROUPS.length - 1 - i; // bottom row (last item) goes first
    const windowStart = slot * GROUP_GLIDE_STRIDE;
    const localT = Math.max(0, Math.min(1, (t - windowStart) / GROUP_GLIDE_WINDOW));
    // Reach the final position well before the window ends (GROUP_GLIDE_SPEED), then
    // hold there — the staggered start is what keeps the cascade flowing, this just
    // makes each item's own motion snap into place quickly instead of drifting for
    // its whole window.
    const eased = Math.min(1, localT * GROUP_GLIDE_SPEED);
    const tx = 1 - (1 - eased) * (1 - eased); // ease-out: fast early, leads the vertical leg
    const ty = eased * eased;                 // ease-in: slower early, but never zero once moving

    el.style.left = `${start.left}px`;
    el.style.top  = `${startTop}px`;
    el.style.transform = `translate(${(endLeft - start.left) * tx}px, ${(endTop - startTop) * ty}px)`;
    el.style.opacity = 1;

    // Only one copy should be visible at a time: hide the real legend item once
    // the glide starts, restore CSS-driven opacity once we scroll back above it.
    legendEl.style.opacity = t > 0 ? 0 : "";
  });
}

window.addEventListener("scroll", () => {
  if (groupMorphTicking) return;
  groupMorphTicking = true;
  requestAnimationFrame(() => { page2to3UpdateFromScroll(); groupMorphTicking = false; });
}, { passive: true });

// ── Page 3's title locks in place once its section is pinned, and during that hold
// the canvas's centered list rearranges into page 4's scattered layout. The two
// groups page 4 doesn't use (יוצאי אתיופיה, ערבים ישראלים) settle into a small
// centered list below the cluster instead of vanishing. Same DOM-overlay approach
// as the page 2 → page 3 handoff, but simpler: both endpoints here (page 3's
// centered-list math and page4.js's sqX/sqY/labelSide table) are pure functions of
// canvas size, so there's no live DOM snapshot to capture — just two formulas to
// interpolate between. ──
const PAGE4_GROUPS = [
  { label: "מתיישבים",             color: "#F9880D", sqX: 884, sqY: 524, labelSide: "right" },
  { label: "פעילי ימין",           color: "#69DB12", sqX: 884, sqY: 558, labelSide: "right" },
  { label: "חרדים",                color: "#16181D", sqX: 884, sqY: 592, labelSide: "right" },
  { label: "מתנגדי הרפורמה המשפטית", color: "#0C7AE0", sqX: 837, sqY: 541, labelSide: "left"  },
  { label: "פעילי שמאל",           color: "#EF3890", sqX: 837, sqY: 575, labelSide: "left"  },
];
const PAGE4_LABELS = new Set(PAGE4_GROUPS.map(g => g.label));
const PAGE4_LEFTOVER_GROUPS = PAGE3_GROUPS.filter(g => !PAGE4_LABELS.has(g.label));
const PAGE4_BY_LABEL = new Map(PAGE4_GROUPS.map(g => [g.label, g]));
const PAGE4_LEFTOVER_INDEX = new Map(PAGE4_LEFTOVER_GROUPS.map((g, i) => [g.label, i]));

const page3Section = document.getElementById("page-2");
const PAGE3_MORPH_HOLD = 200;   // px of scroll the title sits stuck before the rearrange starts
const PAGE3_MORPH_RUNWAY = 550; // px of scroll the rearrange itself plays out over
const leftoverSettled = {}; // label -> { left, top, width }, filled in below, read by page4UpdateFromScroll
let page3to4Ticking = false;

function page3to4UpdateFromScroll() {
  // Sets the baseline (page 3 centered-list) position for every item — this phase
  // only overrides that baseline once its own t is past 0.
  page2to3UpdateFromScroll();

  const scrolled = -page3Section.getBoundingClientRect().top;
  const t = Math.max(0, Math.min(1, (scrolled - PAGE3_MORPH_HOLD) / PAGE3_MORPH_RUNWAY));

  groupsOverlayEl.classList.toggle("is-active",
    (page2to3T > 0 && currentPage === 1) || currentPage === 2 || currentPage === 3 || currentPage === 4);

  if (t === 0) {
    // Restore plain RTL layout in case a "right" labelSide item had flipped to ltr,
    // for when we've scrolled back above this phase.
    groupItems.forEach(({ el }) => { el.style.direction = ""; });
    return;
  }

  const W = canvas.clientWidth, H = canvas.clientHeight;
  const rx = x => x / 1728 * W, ry = y => y / 1117 * H;
  const itemH = 36, totalH3 = PAGE3_GROUPS.length * itemH, startY3 = H / 2 - totalH3 / 2, centerX3 = W / 2;
  const leftoverY = ry(592) + 3 + 100; // below page 4's lowest row, both leftovers share this row

  // Both leftover items sit side by side on that one row, centered as a pair —
  // need both widths up front to lay them out, rather than each anchoring to
  // centerX3 independently (which would stack them on top of each other).
  const leftoverGap = 24;
  const leftoverWidths = PAGE4_LEFTOVER_GROUPS.map(g =>
    groupItems[PAGE3_GROUPS.findIndex(p3 => p3.label === g.label)].el.getBoundingClientRect().width
  );
  const leftoverTotalWidth = leftoverWidths.reduce((sum, w) => sum + w, 0) + leftoverGap * (leftoverWidths.length - 1);
  let leftoverRightEdge = centerX3 + leftoverTotalWidth / 2; // rightmost item starts here, in RTL order

  groupItems.forEach(({ el }, i) => {
    const label = PAGE3_GROUPS[i].label;
    const rect = el.getBoundingClientRect();
    const width = rect.width, height = rect.height;

    // Where this item sits in page 3's centered list — same formula
    // page2to3UpdateFromScroll uses for its own endLeft/endTop.
    const rowY3 = startY3 + i * itemH + itemH / 2;
    const fromLeft = centerX3 + 6 - width;
    const fromTop = rowY3 - height / 2;

    let toLeft, toTop, ltr = false;
    const p4 = PAGE4_BY_LABEL.get(label);
    if (p4) {
      const sqLeft = rx(p4.sqX), centerY = ry(p4.sqY) + 3;
      if (p4.labelSide === "right") {
        toLeft = sqLeft; // swatch flush with the container's left edge once it's ltr
        ltr = true;
      } else {
        toLeft = sqLeft + 6 - width; // square's right edge (sqLeft+6) anchors the item's right edge
      }
      toTop = centerY - height / 2;
    } else {
      const leftoverIndex = PAGE4_LEFTOVER_INDEX.get(label);
      if (leftoverIndex > 0) leftoverRightEdge -= leftoverWidths[leftoverIndex - 1] + leftoverGap;
      toLeft = leftoverRightEdge - width;
      toTop = leftoverY - height / 2;
      // Stashed for page4UpdateFromScroll, which slides these two further left once
      // page 4's own hold ends — avoids recomputing this side-by-side layout there.
      leftoverSettled[label] = { left: toLeft, top: toTop, width };
    }

    el.style.direction = ltr ? "ltr" : "";
    el.style.left = `${fromLeft}px`;
    el.style.top  = `${fromTop}px`;
    el.style.transform = `translate(${(toLeft - fromLeft) * t}px, ${(toTop - fromTop) * t}px)`;
  });
}

window.addEventListener("scroll", () => {
  if (page3to4Ticking) return;
  page3to4Ticking = true;
  requestAnimationFrame(() => { page3to4UpdateFromScroll(); page3to4Ticking = false; });
}, { passive: true });

// ── Page 4's title locks in place once its section is pinned, and during that hold
// the two leftover groups (still sitting below the cluster, settled there by
// page3to4UpdateFromScroll) slide out past the left edge of the screen instead of
// lingering once they're no longer relevant to what's on screen. ──
const page4Section = document.getElementById("page-3");
const PAGE4_EXIT_HOLD = 200;   // px of scroll the title sits stuck before the exit starts
const PAGE4_EXIT_RUNWAY = 400; // px of scroll the exit itself plays out over
let page4Ticking = false;

function page4UpdateFromScroll() {
  // Sets the baseline (settled page 3→4 position) for every item, including the
  // leftover pair's leftoverSettled entries this phase slides further left.
  page3to4UpdateFromScroll();

  const scrolled = -page4Section.getBoundingClientRect().top;
  const t = Math.max(0, Math.min(1, (scrolled - PAGE4_EXIT_HOLD) / PAGE4_EXIT_RUNWAY));

  if (t === 0) return;

  PAGE4_LEFTOVER_GROUPS.forEach(({ label }) => {
    const settled = leftoverSettled[label];
    if (!settled) return;
    const el = groupItems[PAGE3_GROUPS.findIndex(p3 => p3.label === label)].el;
    const exitLeft = -(settled.width + 100); // fully past the left edge, regardless of viewport width
    el.style.left = `${settled.left}px`;
    el.style.top  = `${settled.top}px`;
    el.style.transform = `translate(${(exitLeft - settled.left) * t}px, 0px)`;
  });
}

window.addEventListener("scroll", () => {
  if (page4Ticking) return;
  page4Ticking = true;
  requestAnimationFrame(() => { page4UpdateFromScroll(); page4Ticking = false; });
}, { passive: true });

// ── Page 8 holds page7's final layout until its title actually reaches the
// viewport's vertical center — not just whenever currentPage flips to 6, which
// (via the -50% IntersectionObserver above) can fire slightly before the title
// has visually settled there. That crossing triggers p8Trigger (page8.js), which
// plays a fixed-duration glide toward page9's starting layout entirely on its
// own clock — scrolling is never blocked, so the title is free to keep scrolling
// past while the glide plays in the background. Scrolling back up past that same
// point (recorded as p8TriggerScrollY) plays the glide back in reverse via
// p8TriggerReverse, once currentPage has made it back to 6. ──
const page8TitleEl = document.querySelector("#page-6 .section-title");
let page8Ticking = false;

function page8CheckScroll() {
  if (!p8Engaged) {
    const rect = page8TitleEl.getBoundingClientRect();
    const titleCenter = rect.top + rect.height / 2;
    if (titleCenter <= window.innerHeight / 2) p8Trigger();
  } else if (currentPage === 6 && p8TriggerScrollY !== null && window.scrollY < p8TriggerScrollY) {
    p8TriggerReverse();
  }
}

window.addEventListener("scroll", () => {
  if (page8Ticking) return;
  page8Ticking = true;
  requestAnimationFrame(() => { page8CheckScroll(); page8Ticking = false; });
}, { passive: true });

// ── Page 9's title glides up into its docked spot (matching the canvas legend's y
// line) over the section's scroll slack, instead of snapping there instantly —
// position:sticky alone has no travel distance here since the title sits flush
// with its sticky wrapper's edge the moment that wrapper engages. ──
const page9Section  = document.getElementById("page-7");
const page9TitleEl  = document.querySelector("#page-7 .section-text");
const page9StickyEl = document.querySelector("#page-7 .page9-sticky");
const PAGE9_TITLE_TRAVEL = 220; // px the title glides upward before locking in place
let page9Ticking = false;
let page9LinePast = false; // previous "title past the horizontal line" state, so the line
                            // trigger only fires on the transition

function page9UpdateFromScroll() {
  const rect = page9Section.getBoundingClientRect();
  const t = Math.max(0, Math.min(1, -rect.top / PAGE9_TITLE_TRAVEL));
  page9TitleEl.style.transform = `translateY(${(1 - t) * PAGE9_TITLE_TRAVEL}px)`;
  // The vertical dashed divider lines (.page9-divider-line, in style.css) only
  // fade in once the title has fully finished gliding up into its docked spot —
  // they belong to the resting layout, not something the title travels past.
  page9StickyEl.classList.toggle("docked", t >= 1);

  // The canvas-drawn horizontal divider (page9.js) triggers on a different
  // condition entirely: not the title's own glide finishing, but the title
  // element having scrolled up past the line's actual on-screen position
  // (P9_MID, page9.js — the same fraction of viewport height drawPage9 draws
  // the line at). It's a fixed-duration animation once triggered (and reverses
  // if the title scrolls back below the line before settling), not scroll-driven.
  const lineY = window.innerHeight * P9_MID;
  const titlePastLine = page9TitleEl.getBoundingClientRect().bottom <= lineY;
  if (titlePastLine !== page9LinePast) {
    page9LinePast = titlePastLine;
    p9TriggerLine(titlePastLine ? 1 : 0);
  }
}

window.addEventListener("scroll", () => {
  if (page9Ticking) return;
  page9Ticking = true;
  requestAnimationFrame(() => { page9UpdateFromScroll(); page9Ticking = false; });
}, { passive: true });

// Explicitly load both weights so canvas gets the real font on first draw
Promise.all([
  document.fonts.load("400 24px 'HadassahFriedlaender'"),
  document.fonts.load("100 16px 'HadassahFriedlaender'"),
  document.fonts.load("400 16px 'Assistant'"),
  document.fonts.load("700 16px 'Assistant'"),
]).then(() => {
  initPage7().then(() => { draw(); p7RenderTimeline(); });
  init();
  page7UpdateFromScroll();
  page2UpdateFromScroll();
  page4UpdateFromScroll();
  page8CheckScroll();
  page9UpdateFromScroll();
  window.addEventListener("resize", () => { init(); p7RenderTimeline(); });
});
