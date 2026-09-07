let p12FreeformTargets = null;
let p12FreeformW = 0, p12FreeformH = 0;

function p12EnsureFreeformTargets(W, H) {
  if (p12FreeformTargets && p12FreeformW === W && p12FreeformH === H) {
    return p12FreeformTargets;
  }
  p12FreeformTargets = new Map();
  p12FreeformW = W; p12FreeformH = H;

  // Mobile scatters at @fold11's own pitch (p9Metrics: 2px) — the desktop
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
  // Same size the dots had in @fold11's extreme grid (1.5px on mobile, 3px on
  // desktop) — drawing the morph at a hardcoded P9_SQ doubled them on a phone.
  const SQ       = p9Metrics().SQ;

  for (const e of [...p9.leftTopOrder, ...p9.rightTopOrder]) {
    const to   = targets.get(e);
    if (!to) continue;
    const from = startPos?.get(e) ?? to;
    const x    = from.x + (to.x - from.x) * morphT;
    const y    = from.y + (to.y - from.y) * morphT;
    ctx.globalAlpha = 1;
    ctx.fillStyle   = p7ActorColor(e.actor);
    ctx.fillRect(x, y, SQ, SQ);
  }
  ctx.globalAlpha = 1;
}

// Share row on the @fold12 card (teacher review 2026-09-03, K2). The anchors
// ship with href="#" and get their real share URLs here, from the page's own
// location at load; the copy button writes the URL to the clipboard and flips
// its label for a moment as feedback. The row is @fold13's own title block
// (#page-12). Runs once from bootstrap (p12ShareInit).
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

// The @fold14 card's height comes from the viewport (100vh − 2×48px, style.css
// #page-13 .text-card-frame). Its WIDTH is solved here, because CSS can't: a
// narrower column is a taller one, so the narrowest width at which the copy
// still clears the bottom padding is also the width that FILLS the card — any
// wider and the leftover height opens as a void above and below the centred
// copy. Searched between P12_CARD_MIN_W and P12_CARD_MAX_W; the CSS width is
// the answer for a 982px-tall viewport and stands if this never runs.
const P12_CARD_MIN_W = 320;
const P12_CARD_MAX_W = 900;
function p12CardWidthFit() {
  const f = document.querySelector("#page-13 .text-card-frame");
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
// @fold12 → @fold13 spacing, the house rhythm made exact. Every other pair of
// title blocks is "card centred in a 100vh section", so consecutive card
// CENTRES are always exactly 100vh apart. @fold12's card is flush to the top
// of its section instead (the gate needs that — see #page-11 in style.css), so
// its section's height is what sets that distance: the next card's centre sits
// at (section height + 50vh) below this card's top, and that equals 100vh
// below this card's CENTRE only when the section is 50vh + half the card. The
// card's height depends on how its copy wraps, hence a solve rather than a
// fixed vh — every fixed value tried (45vh, 80vh, 100vh) was off by exactly
// the half-card it ignored.
function p12SpacingFit() {
  const H = window.innerHeight;
  const sec = document.getElementById("page-11");
  const card = sec && sec.querySelector(".text-card-frame");
  if (card) sec.style.minHeight = Math.round(H / 2 + card.offsetHeight / 2) + "px";

  // @fold13 → @fold14: the outro card is near-viewport-tall, so "centred in
  // 100vh" would put its TOP edge only 50vh − 400px under the share card —
  // visibly too close, even though the centres are 100vh apart. What reads as
  // the house distance is the air between card EDGES, which for two title
  // blocks is 100vh minus a title card. So the outro's top is placed where a
  // title card's top would be: 50vh − half the share card, measured from its
  // section top. The section then runs one full viewport past the card's
  // bottom, so the document ends on a clear viewport of map (see #page-13 in
  // style.css). Desktop only — the mobile outro is height:auto and just scrolls.
  const share = document.querySelector("#page-12 .page12-share-card");
  const sec13 = document.getElementById("page-13");
  if (!share || !sec13) return;
  if (window.innerWidth <= 600) { sec13.style.removeProperty("min-height"); return; }
  // On desktop the outro card is a fixed DRAWER (p13Drawer below), out of
  // flow: the section only has to be tall enough that the card's top enters
  // the viewport at the house distance and the document ends when its title
  // is docked — padTop + the peek. Scrolling past that is impossible, so the
  // wheel is the map's from there (map.js).
  const padTop = Math.round(H / 2 - share.offsetHeight / 2);
  sec13.style.minHeight = (padTop + p13Drawer.peek()) + "px";
  p13Drawer.place();
}

// @fold14 as a drawer (desktop). The credits card is `position: fixed` at the
// viewport's bottom edge, and JS drives its translateY from the distance left
// to the document's end: it rises 1:1 with the scroll, exactly as an in-flow
// card would, and DOCKS with only its title showing (`peek` px) at the last
// scrollable pixel — where the wheel switches to zooming the map behind it.
// Hovering the card slides the whole thing up into view (`open`, a
// short named tempo — it's a hover, not a fold beat); leaving slides it back.
// One transform, written by JS every frame — no CSS transition on it.
const P13_OPEN_MS = 420;
const p13Drawer = (() => {
  const card = document.querySelector("#page-13 .text-card");
  const frame = card && card.querySelector(".text-card-frame");
  const title = frame && frame.querySelector(".section-title");
  const scrollMax = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  // Visible height when docked: the frame's top edge down to just under the title.
  const peek = () => {
    if (!title) return 0;
    return Math.round(title.getBoundingClientRect().bottom - frame.getBoundingClientRect().top + 20);
  };
  // makeTrigger (js/groups.js) loads AFTER this file — build the trigger on first use.
  let open = null;
  const openT = () => (open ? open.currentRaw() : 0);
  const ensureOpen = () => open || (open = makeTrigger(P13_OPEN_MS, place));
  const place = () => {
    if (!card || window.innerWidth <= 600) { if (card) card.style.transform = ""; return; }
    const away = Math.max(0, scrollMax() - window.scrollY);   // px still to scroll
    const hidden = (frame.offsetHeight - peek()) * (1 - p9Ease(openT()));
    card.style.transform = `translate(-50%, ${Math.round(away + hidden)}px)`;
    if (back) back.hidden = away > 0;   // the way back, only once the wheel is the map's
  };
  const back = document.getElementById("p13Back");
  if (back) back.addEventListener("click", () => {
    p12MapResetView(); draw();
    window.scrollBy({ top: -window.innerHeight, behavior: "smooth" });
  });
  if (card) {
    card.addEventListener("mouseenter", () => { if (window.innerWidth > 600) ensureOpen().trigger(1); });
    card.addEventListener("mouseleave", () => { if (open) open.trigger(0); });
    window.addEventListener("scroll", place, { passive: true });
  }
  return { peek, place };
})();
// Web fonts land after bootstrap runs and change how the copy wraps, so solve again.
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { p12CardWidthFit(); p12SpacingFit(); });
let p12CardFitT = null;
window.addEventListener("resize", () => {
  clearTimeout(p12CardFitT);
  p12CardFitT = setTimeout(() => { p12CardWidthFit(); p12SpacingFit(); }, 120);
});
