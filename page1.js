function drawPage1(ctx, W, H) {
  drawBackground(ctx, W, H);
}

// @fold1's two dot columns — two independent single-file columns, 7x7px
// squares on a 10px gap (17px step). Col. 1's square-centers sit 13.5px
// right of the frame's horizontal center, col. 2's 13.5px left of it (27px
// apart) — derived from Figma's literal left edges (766px / 739px in the
// 1512-wide reference frame) plus half the square. Vertically, col. 1's
// first square-center sits 97.77px above the frame's vertical center; col.
// 2 starts 34px (2 steps) lower. Each column stops at the bottom of the
// first viewport.
//
// Per explicit instruction, none of these dots scroll away with the rest of
// @fold1's content (unlike the title/subtitle/logo/scroll-cue, which do) —
// they're built into #page0DotsOverlay, a position:fixed layer (see
// style.css), with left/top expressed the same vh/2-relative way .page0-dot
// always has been, so the exact same numbers that used to describe a
// position *within the scrolling page* now describe a fixed point *in the
// viewport* instead. main.js shrinks each decorative dot down to nothing in
// place (PAGE0_DECORATIVE_DOT_ELS below) once @fold2's title card reaches
// center, since those dots have nothing further to do at that point — the
// group-colored ones (PAGE0_GROUP_DOT_ANCHORS) fly to the legend instead.
const PAGE0_DOT_SQ = 7;
const PAGE0_DOT_STEP = 17;

const PAGE0_DOT_COLS = [
  { centerX: "calc(50% + 13.5px)", offsetX: 13.5, startOffsetY: 0 },
  { centerX: "calc(50% - 13.5px)", offsetX: -13.5, startOffsetY: 2 * PAGE0_DOT_STEP },
];
const PAGE0_DOT_BASE_OFFSET_Y = 97.77; // px above viewport center, col. 1

// Where each of GROUPS' 9 colors landed among @fold1's dots, keyed by color —
// left/top match .group-item's own anchor convention (top-left corner, left
// relative to viewport center), not the dot's center, so main.js's
// updateGroups() can lerp a legend swatch directly from this anchor to its
// resting spot with no extra conversion. syncedRow (see buildPage0AllDots)
// is which "step down the screen" this dot sits at, counting both columns
// together — col. 2's own row i sits at the same height as col. 1's row
// i+2 (col. 2 starts 2 steps lower), so syncedRow lets main.js's page0
// entrance animation (playPage0Entrance) pop both columns in row-by-row in
// sync, rather than column-by-column. Rebuilt every buildPage0AllDots() call
// (initial load + resize), since which dot a color lands on depends on
// vh-dependent dot counts.
let PAGE0_GROUP_DOT_ANCHORS = {};

// Every decorative (non-group) dot, paired with its syncedRow (see above) —
// main.js's updateGroups() uses just the element to scale each one down
// individually at @fold2 (transform-origin defaults to each dot's own
// center, so it shrinks in place rather than toward some shared point);
// playPage0Entrance uses syncedRow to pop them in row-by-row on page load.
// Rebuilt alongside PAGE0_GROUP_DOT_ANCHORS above.
let PAGE0_DECORATIVE_DOT_ELS = [];

// Fixed palette for decorative (non-group) dots — assigned in order, cycling
// if the viewport is tall enough to need more than 40 slots. Any color that
// also appears in GROUPS is skipped so it never lands on a decorative dot.
// Full-saturation hues interleaved; ~10 darker anchors keep it from feeling
// neon-flat. Each hue family (R, B, G, P, O, T, M, YG…) alternates.
const PAGE0_PALETTE = [
  "#DD1111", "#0044EE", "#00AA22", "#9900CC", "#FF6600",
  "#00AAAA", "#CC0088", "#88CC00", "#6611CC", "#EE4411",
  "#00BB33", "#4422DD", "#BB0055", "#009988", "#DDAA00",
  "#0077CC", "#FF2244", "#006622", "#AA00BB", "#FF8800",
  "#44BB00", "#EE1166", "#1133BB", "#007755", "#DD0066",
  "#0055DD", "#EE8800", "#009900", "#7722BB", "#CC2200",
  "#00BBCC", "#DD3300", "#2244AA", "#BB00AA", "#00AA55",
  "#3311CC", "#EE3311", "#006688", "#FF3377", "#880000",
];

// Builds dot colors for both columns. Group colors occupy evenly-spaced slots
// across the full sequence. Decorative slots in each column draw from their
// own non-overlapping half of PAGE0_PALETTE, so no color ever appears in both
// columns. Cycling within a half only if a column needs more than ~20 slots.
// Deterministic: same viewport height → same colors every load.
//
// Only ever called from main.js's buildPage0AllDots(), never from this file
// directly — GROUPS doesn't exist yet when page1.js itself runs.
function buildPage0DotColorSet(counts) {
  const total = counts[0] + counts[1];
  const groupCount = Math.min(GROUPS.length, total);
  const groupSlots = new Set();
  for (let i = 0; i < groupCount; i++) {
    groupSlots.add(Math.round((i * (total - 1)) / (groupCount - 1)));
  }

  const groupColors = new Set(GROUPS.map((g) => g.color.toLowerCase()));
  const half = Math.ceil(PAGE0_PALETTE.length / 2);
  const colPools = [
    PAGE0_PALETTE.slice(0, half).filter((c) => !groupColors.has(c.toLowerCase())),
    PAGE0_PALETTE.slice(half).filter((c) => !groupColors.has(c.toLowerCase())),
  ];

  const colors = new Array(total);
  let gi = 0;
  const pi = [0, 0];
  for (let i = 0; i < total; i++) {
    if (groupSlots.has(i)) {
      colors[i] = GROUPS[gi++].color;
    } else {
      const col = i < counts[0] ? 0 : 1;
      const pool = colPools[col];
      colors[i] = pool[pi[col]++ % pool.length];
    }
  }
  return colors;
}

// Rebuilds the dot columns (in #page0DotsOverlay, a fixed one-viewport-tall
// layer — see the comment above) from the current window.innerHeight —
// re-run on resize (see main.js) since how many dots fit depends on vh.
function buildPage0AllDots() {
  const vh = window.innerHeight;
  const overlay = document.getElementById("page0DotsOverlay");

  overlay.querySelectorAll(".page0-dot").forEach((el) => el.remove());
  PAGE0_GROUP_DOT_ANCHORS = {};
  PAGE0_DECORATIVE_DOT_ELS = [];

  const counts = PAGE0_DOT_COLS.map(({ startOffsetY }) => {
    const firstCenterY = vh / 2 - PAGE0_DOT_BASE_OFFSET_Y + startOffsetY;
    return Math.max(0, Math.ceil((vh - firstCenterY) / PAGE0_DOT_STEP));
  });
  const total = counts.reduce((a, b) => a + b, 0);
  const allColors = buildPage0DotColorSet(counts);

  let consumed = 0;
  PAGE0_DOT_COLS.forEach(({ centerX, offsetX, startOffsetY }, colIndex) => {
    const firstCenterY = vh / 2 - PAGE0_DOT_BASE_OFFSET_Y + startOffsetY;
    const count = counts[colIndex];
    const colors = allColors.slice(consumed, consumed + count);
    consumed += count;

    colors.forEach((color, i) => {
      const centerY = firstCenterY + i * PAGE0_DOT_STEP;
      const syncedRow = startOffsetY / PAGE0_DOT_STEP + i;

      // A group-colored slot isn't rendered as a real (scrolling) .page0-dot
      // at all — main.js's persistent .group-item overlay (fixed position,
      // see groupsOverlayEl) renders it instead, sitting at this exact spot
      // from page load so it reads as part of the column, but staying put
      // on screen (not scrolling away) until fold2Trigger flies it into the
      // legend. Only record the anchor here; only non-group (decorative,
      // randomly-colored) dots get an actual scrolling element below.
      const matched = GROUPS.find((g) => g.color.toLowerCase() === color.toLowerCase());
      if (matched) {
        PAGE0_GROUP_DOT_ANCHORS[matched.color] = {
          left: offsetX - PAGE0_DOT_SQ / 2,
          top: centerY - PAGE0_DOT_SQ / 2,
          syncedRow,
        };
        return;
      }

      const dot = document.createElement("div");
      dot.className = "page0-dot";
      dot.style.left = `calc(${centerX} - ${PAGE0_DOT_SQ / 2}px)`;
      dot.style.top = `${(centerY - PAGE0_DOT_SQ / 2).toFixed(2)}px`;
      dot.style.background = color;
      // Hidden/shrunk until playPage0Entrance (main.js) pops it in on page
      // load, row by row — see syncedRow above.
      dot.style.opacity = "0";
      dot.style.transform = "scale(0)";
      overlay.appendChild(dot);
      // popped (flipped by playPage0Entrance, main.js) guards updateGroups()'s
      // @fold2 shrink line below from touching this dot's transform before
      // its entrance pop has happened — without it, updateGroups() already
      // runs once during init (well before the entrance's first setTimeout
      // fires) and would unconditionally overwrite this hidden scale(0) with
      // scale(1) (decorScale's own at-rest value), defeating the pop-in.
      PAGE0_DECORATIVE_DOT_ELS.push({ el: dot, syncedRow, popped: false });
    });
  });
}
