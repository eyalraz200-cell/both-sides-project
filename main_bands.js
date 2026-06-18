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

  const bandW    = mid / SEVERITY.length;
  const countMax = Math.max(...SEVERITY.flatMap(cat =>
    [COUNTS.Left[cat] || 0, COUNTS.Right[cat] || 0]
  ));

  // Largest spacing where all dots fit within their band
  spacing = Math.floor(Math.sqrt(bandW * H / countMax));
  spacing = Math.max(4, spacing);

  const cols = Math.floor(bandW / spacing);

  dots = [];

  SEVERITY.forEach((cat, i) => {
    const leftColor  = severityColor(LEFT_LIGHT,  LEFT_MID,  LEFT_DARK,  i);
    const rightColor = severityColor(RIGHT_LIGHT, RIGHT_MID, RIGHT_DARK, i);

    ["Left", "Right"].forEach(side => {
      const count = COUNTS[side][cat] || 0;
      const color = side === "Left" ? leftColor : rightColor;

      const numRows = Math.ceil(count / cols);
      const startY  = H / 2 - (numRows * spacing) / 2 + spacing / 2;

      const innerEdge = side === "Left"
        ? mid - i * bandW
        : mid + i * bandW;

      for (let k = 0; k < count; k++) {
        const localCol = k % cols;
        const row      = Math.floor(k / cols);

        const x = side === "Left"
          ? innerEdge - (localCol + 0.5) * spacing
          : innerEdge + (localCol + 0.5) * spacing;
        const y = startY + row * spacing;

        dots.push({ x, y, color });
      }
    });
  });
}

function draw() {
  const W   = canvas.width;
  const H   = canvas.height;
  const mid = W / 2;
  const r   = spacing / 2 - 0.5;

  ctx.clearRect(0, 0, W, H);

  // Band dividers
  const bandW = mid / SEVERITY.length;
  ctx.strokeStyle = "#eee";
  ctx.lineWidth = 1;
  for (let i = 1; i < SEVERITY.length; i++) {
    [mid - i * bandW, mid + i * bandW].forEach(x => {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    });
  }

  // Center line
  ctx.strokeStyle = "#ccc";
  ctx.beginPath();
  ctx.moveTo(mid, 0);
  ctx.lineTo(mid, H);
  ctx.stroke();

  // Dots
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
