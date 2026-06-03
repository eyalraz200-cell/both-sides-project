// Screen 6: vertical bar chart — each severity category is a column band,
// dots grow upward from the bottom, mirrored left (blue) and right (orange/red)
// from the center. Category 0 (least severe) is closest to center.

let screen6Dots = [];
let screen6Spacing = 6;

function generateScreen6(W, H) {
  const mid         = W / 2;
  const sideW       = W / 2 - GAP / 2;
  const fullSecW    = sideW / SEVERITY.length;
  const secW        = fullSecW * 0.85;
  const availH      = H - PAD_TOP - PAD_BOT;
  const maxCount    = Math.max(...SEVERITY.flatMap(cat => [COUNTS.Left[cat] || 0, COUNTS.Right[cat] || 0]));
  const sp          = Math.max(3, Math.floor(Math.sqrt(secW * availH / maxCount)));
  screen6Spacing    = sp;
  const colsPerSec  = Math.max(1, Math.floor(secW / sp));

  screen6Dots = [];

  SEVERITY.forEach((cat, i) => {
    ["Left", "Right"].forEach(side => {
      const count = COUNTS[side][cat] || 0;
      if (count === 0) return;

      const color = side === "Left"
        ? severityColor(LEFT_LIGHT, LEFT_MID, LEFT_DARK,  i)
        : severityColor(RIGHT_LIGHT, RIGHT_MID, RIGHT_DARK, i);

      const bandInnerX = side === "Left"
        ? mid - GAP / 2 - i * fullSecW
        : mid + GAP / 2 + i * fullSecW;

      const startX = side === "Left"
        ? bandInnerX - sp / 2
        : bandInnerX + sp / 2;

      for (let k = 0; k < count; k++) {
        const col = k % colsPerSec;
        const row = Math.floor(k / colsPerSec);
        const x   = side === "Left" ? startX - col * sp : startX + col * sp;
        const y   = H - PAD_BOT - sp / 2 - row * sp;
        screen6Dots.push({ x, y, color });
      }
    });
  });
}

function drawScreen6() {
  const W          = canvas.width;
  const H          = canvas.height;
  const sp         = screen6Spacing;
  const dotR       = sp / 2 - 0.5;

  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, PAD_TOP);
  ctx.font = "13px monospace";
  ctx.fillStyle = "#111";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Event Types", W / 2, PAD_TOP / 2);

  for (const { x, y, color } of screen6Dots) {
    ctx.beginPath();
    ctx.arc(x, y, dotR, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}
