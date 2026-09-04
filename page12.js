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
// its label for a moment as feedback. Runs once from bootstrap (p12ShareInit).
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
