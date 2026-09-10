let p12FreeformTargets = null;
let p12FreeformW = 0, p12FreeformH = 0;

function p12EnsureFreeformTargets(W, H) {
  if (p12FreeformTargets && p12FreeformW === W && p12FreeformH === H) {
    return p12FreeformTargets;
  }
  p12FreeformTargets = new Map();
  p12FreeformW = W; p12FreeformH = H;

  // Mobile scatters at @fold13's own pitch (p9Metrics: 2px) — the desktop
  // P7_CELL pitch is more than double it and made the spread dots read
  // oversized/sparse on a phone. Desktop keeps P7_CELL as before.
  const CELL  = isMobile() ? p9Metrics().CELL : P7_CELL;
  const cols  = Math.floor(W / 2 / CELL);
  const rows  = Math.floor(H / CELL);
  const total = cols * rows;

  // Left half: col 0 is nearest to center (x = W/2 - CELL), grows leftward.
  const leftShuf = p7Shuffle(Array.from({ length: total }, (_, i) => i), 31337);
  p7.leftEvents.filter(e => {
    const idx = CATEGORY_TO_IDX[e.category];
    return idx !== undefined && p9.sides[idx] === "above";
  }).forEach((e, i) => {
    if (i >= total) return;
    const cell = leftShuf[i];
    const col  = Math.floor(cell / rows);
    const row  = cell % rows;
    p12FreeformTargets.set(e, { x: W / 2 - (col + 1) * CELL, y: row * CELL });
  });

  // Right half: col 0 is nearest to center (x = W/2), grows rightward.
  const rightShuf = p7Shuffle(Array.from({ length: total }, (_, i) => i), 42424);
  p7.rightEvents.filter(e => {
    const idx = CATEGORY_TO_IDX[e.category];
    return idx !== undefined && p9.sides[idx] === "above";
  }).forEach((e, i) => {
    if (i >= total) return;
    const cell = rightShuf[i];
    const col  = Math.floor(cell / rows);
    const row  = cell % rows;
    p12FreeformTargets.set(e, { x: W / 2 + col * CELL, y: row * CELL });
  });

  return p12FreeformTargets;
}

// ---------------------------------------------------------------------------
// @fold15 — the camps pair up.
// @fold14 leaves the extreme dots in a camp-SPLIT spread (above): left events
// left of W/2, right events right of it. @fold15 dissolves that divide — every
// visible dot couples with a dot from the other camp and the couples share the
// whole screen. A couple is two dots P12_PAIR_GAP apart, laid out like a
// domino — most lie flat (left dot, right dot), a share of them stand upright
// (a checkerboard weave) so the field doesn't read as one uniform grain. The gap
// INSIDE a couple always stays smaller than the gap around it, or the pair
// stops reading as a pair.
// The camps have different counts, so slots past the short camp's supply get a
// decorative filler dot — not a real event, coloured from a shuffled mix of the
// short camp's own group colours, and it enters BY SIZE (dots never fade).
// var, not let/const: they were tuned live through a manual/ harness (now
// removed) and are kept as globals so another one can drive them again.
var P12_PAIR_GAP  = 3;     // px between the couple's two dots
var P12_PAIR_SPREAD = 2.3; // couple-to-couple margin, as a multiple of the inside gap
// EXACTLY how many dots this fold shows — not a cap, a target: the field is
// always this many (rounded down to an even number, 2 per couple), whatever the
// data happens to supply. Short of it, newcomers GROW IN to fill the remaining
// slots; over it, the surplus real dots SHRINK AWAY. Both happen on the pop
// beat, in the same size-only vocabulary — dots never fade.
var P12_DOT_COUNT = 9250;
// WHO PAIRS WITH WHOM — decided (compare/, 2026-09-09): the camps stay the unit
// of the couple. Slot A always takes a left-camp dot and slot B a right-camp
// one, so every domino literally crosses the divide. The rejected alternative
// (one shuffled pool of both camps, couples formed from any two dots) is gone —
// don't reintroduce it.
let p12PairTargets = null;
let p12PairW = 0, p12PairH = 0, p12PairGapUsed = 0,
    p12PairSpreadUsed = 0, p12PairMaxUsed = 0;

// Lerp between two "#rrggbb" strings. @fold15's dots do not keep their group
// colour: they RECOLOUR as they fly (see the fly beat in drawPage12), so the
// finished field is a mix of all six group colours rather than two camp-shaped
// blocks of colour. Colour is a "secondary attribute" and may run on its own
// timing; position is the thing that must always animate continuously.
function p12MixColor(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const m = (sh) => Math.round(((pa >> sh) & 255) +
                              (((pb >> sh) & 255) - ((pa >> sh) & 255)) * t);
  return "rgb(" + m(16) + "," + m(8) + "," + m(0) + ")";
}

// Deterministic 0..1 hash — same input, same value every rebuild, but with no
// arithmetic relationship between consecutive n's (which is what a plain
// `n * a % b` has, and what made the fillers pop in along diagonals).
function p12Rand(n, salt) {
  let h = Math.imul(n ^ (salt * 0x9e3779b9), 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function p12PairVisible(events) {
  return events.filter(e => {
    const idx = CATEGORY_TO_IDX[e.category];
    return idx !== undefined && p9.sides[idx] === "above";
  });
}

function p12EnsurePairTargets(W, H) {
  if (p12PairTargets && p12PairW === W && p12PairH === H &&
      p12PairGapUsed === P12_PAIR_GAP && p12PairSpreadUsed === P12_PAIR_SPREAD && p12PairMaxUsed === P12_DOT_COUNT) {
    return p12PairTargets;
  }
  p12PairW = W; p12PairH = H;
  p12PairGapUsed = P12_PAIR_GAP;
  p12PairSpreadUsed = P12_PAIR_SPREAD; p12PairMaxUsed = P12_DOT_COUNT;

  const { SQ, CELL } = p9Metrics();
  // The slot is SQUARE and fits the couple's long axis either way round, so a
  // flat and an upright domino are interchangeable in any slot. The margin
  // around the couple is derived from the gap INSIDE it (never smaller, times
  // P12_PAIR_SPREAD) — the instant the outside gap stops beating the inside
  // one, the pair stops reading as a pair and the field reads as plain grain.
  const gap    = Math.max(CELL - SQ, P12_PAIR_GAP) * P12_PAIR_SPREAD;
  const SPAN   = 2 * SQ + P12_PAIR_GAP;
  const PAIR_W = SPAN + 2 * gap;
  const PAIR_H = PAIR_W;
  const cols = Math.max(1, Math.floor(W / PAIR_W));
  const rows = Math.max(1, Math.floor(H / PAIR_H));
  // Spread the leftover px so the grid spans the WHOLE screen edge to edge
  // instead of leaving a bare strip down the right and along the bottom.
  const stepX = W / cols, stepY = H / rows;
  const padX  = (stepX - PAIR_W) / 2, padY = (stepY - PAIR_H) / 2;
  const total = cols * rows;
  const shuf = p7Shuffle(Array.from({ length: total }, (_, i) => i), 54321);

  // Each camp shuffled on its own: the event lists arrive grouped by actor, so
  // taking index k of each in order handed whole runs of couples the same two
  // groups. Shuffling breaks those runs without touching the camp split.
  const left  = p7Shuffle(p12PairVisible(p7.leftEvents), 11111);
  const right = p7Shuffle(p12PairVisible(p7.rightEvents), 22222);
  // The couple count IS the dot count, halved — every couple spends two dots.
  // Not clamped to the data: if a camp runs out, the leftover slots become
  // newcomers; if there are more real dots than slots, the extras shrink away.
  // The screen itself is the only other limit (`total` slots fit on it).
  const pairs = Math.min(total, Math.floor(P12_DOT_COUNT / 2));
  // EACH CAMP FILLS ITS OWN SHORTFALL. A slot's newcomer always belongs to the
  // camp of that slot, so both halves grow newcomers whenever both camps are
  // short of `pairs` — but no real dot is ever thrown away to even the two
  // counts up. Decided 2026-09-09: strictly equal newcomer counts would mean
  // trimming both camps to the smaller one (4293 vs 332 visible at the time),
  // discarding ~3961 real dots and inventing 91% of the field.
  // **Removed — don't reintroduce.**

  // Filler palette, PER CAMP: that camp's own group colours, shuffled so the
  // mix reads mixed rather than striped. Built from the camp's WHOLE roster
  // (p7.leftEvents / p7.rightEvents), not from the visible subset — only one
  // category is dropped "above" at this point, so the visible dots of a camp
  // are usually all one group and the palette collapsed to a single colour
  // (the all-green fillers bug).
  const paletteOf = (events, seed) => p7Shuffle(
    [...new Set(events.map(e => p7ActorColor(e.actor)))], seed);
  const palettes = [paletteOf(p7.leftEvents, 13579),
                    paletteOf(p7.rightEvents, 24680)];

  // WHERE THE NEWCOMERS POP IN: FREE across their own camp's half of the
  // screen — a hashed x and y anywhere in the half, not a cell in a lattice.
  // Two earlier tries were both wrong in the same direction, from opposite
  // ends: hanging each newcomer off an existing dot clumped them around their
  // hosts (read as "shapes"), and handing each one a whole CELL cell out of a
  // shuffled list read as a raster — at ~7,100 newcomers over ~11,500 cells
  // that is 62% occupancy, dense enough that the lattice shows through no
  // matter how much sub-cell jitter is layered on. Uniform hashed placement has
  // neither problem: it is spread over the whole half like the grid was, but
  // nothing lines up, because nothing is snapped to anything.
  //
  // The hash is p12Rand(n, salt), never `n * const % const`: modular arithmetic
  // on a running index walks in lockstep with the slot order and pops the dots
  // in along diagonals.
  const halfX0 = [0, W / 2];   // slot 0 = left camp, slot 1 = right camp
  const halfW  = W / 2 - SQ;   // -SQ so a dot never hangs off its half's far edge
  const popH   = H - SQ;
  const nPopped = [0, 0];

  // The colour every dot RECOLOURS TO across the fly beat: one of all six group
  // colours, picked by hash so neighbours don't march through the roster in
  // order. Fillers get one too, on top of the pop-in colour they grow in with.
  const allColors = GROUPS.map(g => g.color);
  // The two dots of a couple must never land on the SAME colour — a same-colour
  // domino reads as one group sitting with itself, which is the opposite of
  // what the couple is for. So B is picked out of the roster MINUS A's colour.
  const flyPair = (k) => {
    const n = allColors.length;
    const a = Math.floor(p12Rand(k, 7) * n);
    const b = (a + 1 + Math.floor(p12Rand(k, 8) * (n - 1))) % n;
    return [allColors[a], allColors[b]];
  };

  const byEvent = new Map();
  const fillers = [];
  const step = SQ + P12_PAIR_GAP;      // one dot to the next inside a couple
  const mid  = gap + (SPAN - SQ) / 2;  // centre the short axis in the slot
  for (let k = 0; k < pairs; k++) {
    const cell = shuf[k];
    const col = Math.floor(cell / rows), row = cell % rows;
    const cx = col * stepX + padX;
    const cy = row * stepY + padY;
    // THE WEAVE: orientation alternates like a checkerboard, so every couple
    // lies across its four neighbours — one flat, one upright, one flat. Not a
    // random share (the old P12_PAIR_VERT): random reads as noise, the
    // criss-cross reads as a woven fabric, which is the point.
    const up = (col + row) % 2 === 0;
    const cols2 = flyPair(k);
    // Flat: the two dots side by side. Upright: one above the other.
    const x0 = up ? cx + mid : cx + gap;
    const y0 = up ? cy + gap : cy + mid;
    const slots = up
      ? [{ e: left[k], x: x0, y: y0 }, { e: right[k], x: x0, y: y0 + step }]
      : [{ e: left[k], x: x0, y: y0 }, { e: right[k], x: x0 + step, y: y0 }];
    for (let i = 0; i < 2; i++) {
      const s = slots[i];
      if (s.e) { byEvent.set(s.e, { x: s.x, y: s.y, c: cols2[i] }); continue; }
      // A partnerless slot: a newcomer from THAT SLOT'S OWN camp (slot 0 left,
      // slot 1 right) — which is what keeps the newcomers split evenly between
      // the two halves. It pops in at a fixed spot on its camp's half — its
      // cell in that half's pop grid, plus a hashed jitter inside the cell —
      // and only then flies to its slot with everything else. Free placement,
      // not a cell in a lattice — see the note above the halfX0 block.
      const pal = palettes[i];
      if (!pal.length) continue;
      const n = nPopped[i]++;
      fillers.push({
        x: s.x, y: s.y,
        px: halfX0[i] + p12Rand(n, 1 + i) * halfW,
        py: p12Rand(n, 3 + i) * popH,
        color: pal[Math.floor(p12Rand(n, 5 + i) * pal.length)],
        flyC: cols2[i],
      });
    }
  }
  p12PairTargets = { byEvent, fillers };
  return p12PairTargets;
}

function drawPage12(ctx, W, H) {
  if (!p7.ready) { drawBackground(ctx, W, H); return; }

  // drawPage9 handles background + legit dot fade, dividing line fade, and
  // count fade via p9.fold13OutT. drawBandedCols skips the clustered extreme
  // dots when fold13ExtremeMorphT > 0 so they don't ghost under the morph.
  drawPage9(ctx, W, H);

  const morphT = p9.fold13ExtremeMorphT ?? 0;
  if (morphT <= 0) return;

  // Overdraw extreme dots at their lerped freeform positions.
  const targets  = p12EnsureFreeformTargets(W, H);
  const startPos = p9.fold13StartPos;
  // Same size the dots had in @fold13's extreme grid (1.5px on mobile, 3px on
  // desktop) — drawing the morph at a hardcoded P9_SQ doubled them on a phone.
  const SQ       = p9Metrics().SQ;

  // @fold15, in two beats (both already eased per-window in updateFold14):
  // popT — the partner dots grow in beside the lonely dots, everything still
  // standing in @fold14's spread; then pairT — the whole field flies to the
  // couple slots. Nothing moves until every newcomer is fully there.
  const popT  = p9.fold14PopT ?? 0;
  const pairT = p9.fold14PairT ?? 0;
  const pairs = (popT > 0 || pairT > 0) ? p12EnsurePairTargets(W, H) : null;
  // Where a dot is right now, mid-morph — the filler's partner is one of these,
  // and the filler has to pop in beside it wherever it happens to be.
  // Where a dot stands in @fold14's spread alone, with @fold15 not applied —
  // the fillers pop in against THIS, so they don't inherit the pair flight.
  const spreadPosOf = (e) => {
    const to = targets.get(e); if (!to) return null;
    const from = startPos?.get(e) ?? to;
    return { x: from.x + (to.x - from.x) * morphT,
             y: from.y + (to.y - from.y) * morphT };
  };
  const posOf = (e) => {
    const p = spreadPosOf(e); if (!p) return null;
    const pair = pairs?.byEvent.get(e);
    if (pair) { p.x += (pair.x - p.x) * pairT; p.y += (pair.y - p.y) * pairT; }
    return p;
  };

  // A dot arriving from @fold13 may be wearing a crowd-tier size (the
  // «היקף האירועים» button, p9ScopeSet in page9.js) — up to nine cells across
  // where the spread wants a flat SQ. Lerp it down on the spread's own clock,
  // shrinking about the block's centre, so it eases into the field instead of
  // popping to 3px on the first frame. Size only, never opacity. A no-op
  // whenever the tiers are off, since startPos.sq is SQ there.
  const sizeOf = (e) => {
    const s0 = startPos?.get(e)?.sq;
    if (!(s0 > 0) || Math.abs(s0 - SQ) < 0.01) return SQ;
    return s0 + (SQ - s0) * morphT;
  };

  ctx.globalAlpha = 1;
  for (const e of [...p9.leftTopOrder, ...p9.rightTopOrder]) {
    const p = posOf(e);
    if (!p) continue;
    const sq  = sizeOf(e);
    const ctr = (SQ - sq) / 2;   // keep the shrink centred on the flat box
    const pair = pairs?.byEvent.get(e);
    // RECOLOUR ON THE FLY BEAT: a dot leaves @fold14's spread in its own group
    // colour and arrives at its couple slot in a colour drawn from the whole
    // six-group roster, so the finished field is a full mix instead of two
    // camp-coloured halves. Colour may run on its own timing; position can't.
    ctx.fillStyle = pair
      ? p12MixColor(p7ActorColor(e.actor), pair.c, pairT)
      : p7ActorColor(e.actor);
    // Over the P12_DOT_COUNT target: a dot with no couple slot shrinks away on
    // the pop beat — in place, in @fold14's spread, on the same clock the
    // newcomers grow in on. By size, never by opacity.
    if (pairs && !pair) {
      const s = sq * (1 - popT), off = (SQ - s) / 2;
      if (s > 0) ctx.fillRect(p.x + off, p.y + off, s, s);
      continue;
    }
    ctx.fillRect(p.x + ctr, p.y + ctr, sq, sq);
  }

  // Partnerless slots: a decorative dot from the short camp. It GROWS in
  // (never fades) among its OWN camp, on that camp's half of @fold14's still
  // split spread — then flies to its couple slot on the second beat, with
  // everything else.
  if (pairs) {
    const s   = SQ * popT;
    const off = (SQ - s) / 2;
    for (const f of pairs.fillers) {
      const x = f.px + (f.x - f.px) * pairT;
      const y = f.py + (f.y - f.py) * pairT;
      ctx.fillStyle = p12MixColor(f.color, f.flyC, pairT);
      ctx.fillRect(x + off, y + off, s, s);
    }
  }
  ctx.globalAlpha = 1;
}

// Share row on the @fold14 card (teacher review 2026-09-03, K2). The anchors
// ship with href="#" and get their real share URLs here, from the page's own
// location at load; the copy button writes the URL to the clipboard and flips
// its label for a moment as feedback. The row is @fold15's own title block
// (#page-14). Runs once from bootstrap (p12ShareInit).
function p12ShareInit() {
  const wrap = document.getElementById("page12Share");
  if (!wrap) return;
  const url   = location.href.split("#")[0];
  const title = document.title || "קיצוניים משני הצדדים";
  const enc   = encodeURIComponent;
  const hrefs = {
    whatsapp: `https://wa.me/?text=${enc(title + " " + url)}`,
    x:        `https://twitter.com/intent/tweet?text=${enc(title)}&url=${enc(url)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
  };
  wrap.querySelectorAll("[data-share]").forEach(el => {
    const kind = el.dataset.share;
    if (hrefs[kind]) { el.href = hrefs[kind]; return; }
    if (kind !== "copy") return;
    const label = el.textContent;
    el.addEventListener("click", () => {
      const done = () => {
        el.textContent = "הקישור הועתק";
        el.classList.add("is-copied");
        setTimeout(() => { el.textContent = label; el.classList.remove("is-copied"); }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, done);
      } else {
        window.prompt("העתיקו את הקישור:", url);
      }
    });
  });
}

// The @fold16 card's height comes from the viewport (100vh − 2×48px, style.css
// #page-15 .text-card-frame). Its WIDTH is solved here, because CSS can't: a
// narrower column is a taller one, so the narrowest width at which the copy
// still clears the bottom padding is also the width that FILLS the card — any
// wider and the leftover height opens as a void above and below the centred
// copy. Searched between P12_CARD_MIN_W and P12_CARD_MAX_W; the CSS width is
// the answer for a 982px-tall viewport and stands if this never runs.
const P12_CARD_MIN_W = 320;
const P12_CARD_MAX_W = 900;
function p12CardWidthFit() {
  const f = document.querySelector("#page-15 .text-card-frame");
  if (!f) return;
  if (window.innerWidth <= 600) { f.style.removeProperty("width"); return; }  // mobile card is height:auto
  const fits = (w) => {
    f.style.width = w + "px";
    const fr = f.getBoundingClientRect();
    const padB = parseFloat(getComputedStyle(f).paddingBottom);
    const last = f.lastElementChild.getBoundingClientRect();
    return last.bottom - fr.top <= fr.height - padB + 0.5;
  };
  if (fits(P12_CARD_MIN_W)) return;              // the copy fills even the narrowest card
  let lo = P12_CARD_MIN_W, hi = P12_CARD_MAX_W;
  if (!fits(hi)) return;                         // nothing in range holds the copy — keep the widest
  while (hi - lo > 1) { const mid = Math.round((lo + hi) / 2); if (fits(mid)) hi = mid; else lo = mid; }
  fits(hi);
}
// @fold14 → @fold15 spacing, the house rhythm made exact. Every other pair of
// title blocks is "card centred in a 100vh section", so consecutive card
// CENTRES are always exactly 100vh apart. @fold14's card is flush to the top
// of its section instead (the gate needs that — see #page-13 in style.css), so
// its section's height is what sets that distance: the next card's centre sits
// at (section height + 50vh) below this card's top, and that equals 100vh
// below this card's CENTRE only when the section is 50vh + half the card. The
// card's height depends on how its copy wraps, hence a solve rather than a
// fixed vh — every fixed value tried (45vh, 80vh, 100vh) was off by exactly
// the half-card it ignored.
// Air left under the outro card once the page is scrolled to its end — matches
// the 48px the card keeps off the viewport's top and bottom edges.
const P12_OUTRO_END = 48;
function p12SpacingFit() {
  const H = window.innerHeight;
  const sec = document.getElementById("page-13");
  const card = sec && sec.querySelector(".text-card-frame");
  if (card) sec.style.minHeight = Math.round(H / 2 + card.offsetHeight / 2) + "px";

  // @fold15 → @fold16: the outro card is near-viewport-tall (100vh − 96px), so
  // "centred in a 100vh section" reads WRONG — it leaves only 50vh − half the
  // share card + 48px of air above it, well short of the house distance. What
  // reads as the house gap is the air between card EDGES, which for two title
  // blocks is 100vh minus a title card. So the outro is placed by its TOP edge:
  // it starts where an ordinary centred card's top would start, 50vh − half the
  // share card into its own section, making the edge-to-edge gap exactly
  // 100vh − share card. The section is then just tall enough to scroll the card
  // to rest with P12_OUTRO_END px under it, and the document ends there.
  const share = document.querySelector("#page-14 .page12-share-card");
  const sec15 = document.getElementById("page-15");
  const outro = sec15 && sec15.querySelector(".text-card-frame");
  if (!share || !outro) return;
  if (window.innerWidth <= 600) {           // mobile: the card flows, no solve
    sec15.style.removeProperty("padding-top");
    sec15.style.removeProperty("min-height");
    return;
  }
  const padTop = Math.round(H / 2 - share.offsetHeight / 2);
  sec15.style.paddingTop = padTop + "px";
  sec15.style.minHeight = (padTop + outro.offsetHeight + P12_OUTRO_END) + "px";
}

// Web fonts land after bootstrap runs and change how the copy wraps, so solve again.
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { p12CardWidthFit(); p12SpacingFit(); });
let p12CardFitT = null;
window.addEventListener("resize", () => {
  clearTimeout(p12CardFitT);
  p12CardFitT = setTimeout(() => { p12CardWidthFit(); p12SpacingFit(); }, 120);
});
