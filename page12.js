let p12FreeformTargets = null;
let p12FreeformW = 0, p12FreeformH = 0;

function p12EnsureFreeformTargets(W, H) {
  if (p12FreeformTargets && p12FreeformW === W && p12FreeformH === H) {
    return p12FreeformTargets;
  }
  p12FreeformTargets = new Map();
  p12FreeformW = W; p12FreeformH = H;

  // Mobile scatters at @fold10's own pitch (p9Metrics: 2px) — the desktop
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
  // Same size the dots had in @fold10's extreme grid (1.5px on mobile, 3px on
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
