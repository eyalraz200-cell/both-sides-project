const LEFT_LIGHT  = "#b8d9ff";
const LEFT_MID    = "#4e9af1";
const LEFT_DARK   = "#0d2d5e";

const RIGHT_LIGHT = "#ffd4a8";
const RIGHT_MID   = "#f97316";
const RIGHT_DARK  = "#7a2e00";

function lerpColor(a, b, t) {
  const r  = c => parseInt(c.slice(1,3), 16);
  const g  = c => parseInt(c.slice(3,5), 16);
  const bl = c => parseInt(c.slice(5,7), 16);
  return `rgb(${Math.round(r(a)+(r(b)-r(a))*t)},${Math.round(g(a)+(g(b)-g(a))*t)},${Math.round(bl(a)+(bl(b)-bl(a))*t)})`;
}

function severityColor(light, mid, dark, i) {
  const half = (SEVERITY.length - 1) / 2;
  return i <= half
    ? lerpColor(light, mid, i / half)
    : lerpColor(mid, dark, (i - half) / half);
}

const SEVERITY = [
  "Peaceful protest",
  "Road blocking",
  "Harassment",
  "Property destruction",
  "Land seizure",
  "Mob violence",
  "Physical assault",
  "Armed attack",
  "Abduction",
];

const COUNTS = {
  Left: {
    "Peaceful protest":    2470,
    "Road blocking":        470,
    "Harassment":             1,
    "Property destruction":  40,
    "Land seizure":           0,
    "Mob violence":          64,
    "Physical assault":       9,
    "Armed attack":           1,
    "Abduction":              0,
  },
  Right: {
    "Peaceful protest":      41,
    "Road blocking":         18,
    "Harassment":           107,
    "Property destruction": 1422,
    "Land seizure":         282,
    "Mob violence":        1206,
    "Physical assault":    1152,
    "Armed attack":         427,
    "Abduction":             20,
  },
};

const canvas = document.getElementById("canvas");
const ctx    = canvas.getContext("2d");

let dots = [];
let spacing = 6;

function generate() {
  const W   = canvas.width;
  const H   = canvas.height;
  const mid = W / 2;

  // Build flat list of dots per side, ordered by severity
  const leftDots  = [];
  const rightDots = [];

  SEVERITY.forEach((cat, i) => {
    const lColor = severityColor(LEFT_LIGHT,  LEFT_MID,  LEFT_DARK,  i);
    const rColor = severityColor(RIGHT_LIGHT, RIGHT_MID, RIGHT_DARK, i);
    for (let k = 0; k < (COUNTS.Left[cat]  || 0); k++) leftDots.push(lColor);
    for (let k = 0; k < (COUNTS.Right[cat] || 0); k++) rightDots.push(rColor);
  });

  const padTop       = 160;
  const padBot       = 40;
  const fullSectionH = (H - padTop - padBot) / SEVERITY.length;
  const sectionH     = fullSectionH * 0.85;

  // Spacing based on full section height — stays constant
  const maxSectionCount = Math.max(...SEVERITY.flatMap(cat =>
    [COUNTS.Left[cat] || 0, COUNTS.Right[cat] || 0]
  ));
  spacing = Math.floor(Math.sqrt((mid / 2) * fullSectionH / maxSectionCount));
  spacing = Math.max(3, spacing);

  // Rows fit within the smaller section height — overflow goes horizontal
  const rowsPerSection = Math.floor(sectionH / spacing);
  const cols = Math.max(...SEVERITY.flatMap(cat => [
    Math.ceil((COUNTS.Left[cat]  || 0) / rowsPerSection),
    Math.ceil((COUNTS.Right[cat] || 0) / rowsPerSection),
  ]));

  dots = [];

  SEVERITY.forEach((cat, i) => {
    const lColor      = severityColor(LEFT_LIGHT,  LEFT_MID,  LEFT_DARK,  i);
    const rColor      = severityColor(RIGHT_LIGHT, RIGHT_MID, RIGHT_DARK, i);
    const sectionBottom = padTop + (i + 1) * sectionH - 4;

    ["Left", "Right"].forEach(side => {
      const count  = COUNTS[side][cat] || 0;
      const color  = side === "Left" ? lColor : rColor;
      const gap    = 220;
      const startX = side === "Left" ? mid - gap / 2 - spacing / 2 : mid + gap / 2 + spacing / 2;

      for (let k = 0; k < count; k++) {
        const row      = k % rowsPerSection;
        const localCol = Math.floor(k / rowsPerSection);
        const x = side === "Left"
          ? startX - localCol * spacing
          : startX + localCol * spacing;
        const y = sectionBottom - row * spacing;
        dots.push({ x, y, color });
      }
    });
  });
}

function draw() {
  const W     = canvas.width;
  const H     = canvas.height;
  const mid   = W / 2;
  const r     = spacing / 2 - 0.5;
  const padTop = 160;
  const padBot = 40;

  ctx.clearRect(0, 0, W, H);

  // Top bar
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, padTop);
  ctx.font = "13px monospace";
  ctx.fillStyle = "#111";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Event Types", W / 2, padTop / 2);

  // Horizontal category dividers + labels (less severe at bottom)
  const sectionH = (H - padTop - padBot) / SEVERITY.length * 0.85;
  ctx.strokeStyle = "#eee";
  ctx.lineWidth = 1;
  ctx.font = "12px monospace";
  ctx.fillStyle = "#aaa";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  SEVERITY.forEach((cat, i) => {
    const y = padTop + i * sectionH + sectionH / 2;
    const t = i / (SEVERITY.length - 1);
    const v = Math.round(200 - t * 180);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillText(cat, mid, y);

  });


  for (const { x, y, color } of dots) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

function init() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  generate();
  draw();
}

init();
window.addEventListener("resize", init);
