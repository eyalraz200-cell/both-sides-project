const canvas = document.getElementById("canvas");
const ctx    = canvas.getContext("2d");

const LEFT_COLOR      = "#4e9af1";
const LEFT_EXT_COLOR  = "#2060a8";
const RIGHT_COLOR     = "#f97316";
const RIGHT_EXT_COLOR = "#d44a08";

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

const HEBREW = {
  "Peaceful protest":    "הפגנה שקטה",
  "Harassment":          "הטרדה",
  "Property destruction":"הרס רכוש",
  "Land seizure":        "תפיסת קרקע",
  "Road blocking":       "חסימת כביש",
  "Mob violence":        "אלימות המונית",
  "Physical assault":    "תקיפה פיזית",
  "Armed attack":        "תקיפה חמושה",
  "Abduction":           "חטיפה",
};

const TIERS = [
  { label: "Not Extreme", cats: ["Peaceful protest", "Harassment"] },
  { label: "Middle",      cats: ["Property destruction", "Land seizure", "Road blocking"] },
  { label: "Extreme",     cats: ["Mob violence", "Physical assault", "Armed attack", "Abduction"] },
];

let S    = 4;
let dots = [];

function buildPool(xStart, xEnd, xStep, yTop, yBot, s) {
  const pool = [];
  for (let x = xStart; xStep > 0 ? x < xEnd : x > xEnd; x += xStep)
    for (let y = yTop; y < yBot; y += s)
      pool.push({ x: Math.round(x), y: Math.round(y) });
  return pool;
}

function generateDots(W, H) {
  dots = [];
  const cx  = W / 2;
  const pad = 60;

  const totalH  = H - pad * 2;
  const bandH   = Math.floor(totalH / 3);

  const maxTierCount = Math.max(...TIERS.map(tier =>
    Math.max(
      tier.cats.reduce((a, c) => a + (COUNTS.Left[c]  || 0), 0),
      tier.cats.reduce((a, c) => a + (COUNTS.Right[c] || 0), 0)
    )
  ));

  S = Math.floor(Math.sqrt((W / 2) * bandH / maxTierCount));
  if (S < 1) S = 1;

  TIERS.forEach((tier, ti) => {
    const yTop = pad + ti * bandH;
    const yBot = yTop + bandH;

    const leftPool  = buildPool(cx - S, pad,  -S, yTop, yBot, S);
    const rightPool = buildPool(cx,     W - pad, S, yTop, yBot, S);

    ["Left", "Right"].forEach(side => {
      const pool  = side === "Left" ? leftPool : rightPool;
      const color = side === "Left" ? LEFT_COLOR : RIGHT_COLOR;
      let pi = 0;
      tier.cats.forEach(cat => {
        const count = COUNTS[side][cat] || 0;
        for (let i = 0; i < count; i++) {
          const pos = pool[pi++];
          if (pos) dots.push({ x: pos.x, y: pos.y, color });
        }
      });
    });
  });
}

function render() {
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const cx         = W / 2;
  const barH       = 80;
  const categories = TIERS.flatMap(t => t.cats).reverse();

  const maxCount = Math.max(
    ...categories.flatMap(cat => [COUNTS.Left[cat] || 0, COUNTS.Right[cat] || 0])
  );

  const s_auto = Math.max(2, Math.floor(Math.sqrt((cx - 60) * 100 / maxCount)));
  const sq     = Math.max(1, Math.floor(s_auto * 0.75));
  const s      = sq + Math.max(1, Math.round(s_auto * 0.3));
  const snapH  = Math.max(s, Math.floor(barH / s) * s);
  const gap    = 0;

  const totalH = categories.length * snapH;
  const startY = (H - totalH) / 2;

  const r = Math.max(0.5, s / 2 - 0.5);

  categories.forEach((cat, i) => {
    const yTop = startY + i * snapH;
    const yBot = yTop + snapH;

    ["Left", "Right"].forEach(side => {
      const count     = COUNTS[side][cat] || 0;
      const isExtreme = TIERS[2].cats.includes(cat);
      const baseColor = side === "Left" ? LEFT_COLOR : RIGHT_COLOR;
      let drawn = 0;

      const total    = COUNTS[side][cat] || 0;
      const altColor = n => {
        if (side !== "Right") return baseColor;
        const pct = total > 0 ? n / total : 0;
        if (pct < 0.70) return baseColor;
        if (pct < 0.85) return "#dc2626";
        return "#111111";
      };

      const lineGap = s - sq;
      const xStart  = side === "Left" ? cx - lineGap - sq : cx + lineGap;
      outer: for (let x = xStart; side === "Left" ? x > W / 10 : x < W * 9 / 10; x += side === "Left" ? -s : s) {
        for (let y = yBot - s / 2; y >= yTop; y -= s) {
          if (drawn >= count) break outer;
          const color = altColor(drawn);
          const isMiddle = TIERS[1].cats.includes(cat);
          if (TIERS[0].cats.includes(cat)) ctx.globalAlpha = 0.1;
          ctx.fillStyle = color;
          ctx.fillRect(x, y - sq / 2, sq, sq);
          if (TIERS[0].cats.includes(cat)) ctx.globalAlpha = 1;
          drawn++;
        }
      }
    });
  });

  ctx.globalAlpha  = 0.3;
  ctx.font         = "13px sans-serif";
  ctx.textAlign    = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle    = "#111111";
  ctx.direction    = "rtl";

  categories.forEach((cat, i) => {
    const yTop = startY + i * snapH;
    const yBot = yTop + snapH;
    ctx.fillText(HEBREW[cat], W * 9 / 10 + 10, (yTop + yBot) / 2);
  });

  ctx.globalAlpha = 1;
}

let currentScreen = 0;
const NUM_SCREENS = 4;
let screen1Dots   = [];
let screen1Sq     = 2;

function generateScreen1(W, H) {
  screen1Dots = [];
  const cx  = W / 2;
  const pad = 60;
  const totalLeft  = Object.values(COUNTS.Left).reduce((a, b) => a + b, 0);
  const totalRight = Object.values(COUNTS.Right).reduce((a, b) => a + b, 0);
  const maxCount   = Math.max(...Object.values(COUNTS.Left), ...Object.values(COUNTS.Right));
  const s_auto     = Math.max(2, Math.floor(Math.sqrt((cx - 60) * 100 / maxCount)));
  screen1Sq        = Math.max(1, Math.floor(s_auto * 0.75));
  const s2         = screen1Sq + Math.max(1, Math.round(s_auto * 0.3));
  const snapH2     = Math.max(s2, Math.floor(80 / s2) * s2);
  const categories = TIERS.flatMap(t => t.cats);
  const totalH2    = categories.length * snapH2;
  const startY2    = (H - totalH2) / 2;

  ["Left", "Right"].forEach(side => {
    const color = side === "Left" ? LEFT_COLOR : RIGHT_COLOR;
    const count = side === "Left" ? totalLeft : totalRight;
    const lineGap = s2 - screen1Sq;
    const xMin  = side === "Left" ? pad                        : cx + lineGap;
    const xMax  = side === "Left" ? cx - lineGap - screen1Sq  : W - pad;

    const pool = [];
    for (let x = xMin; x + screen1Sq <= xMax; x += s2)
      for (let y = startY2; y + screen1Sq <= startY2 + totalH2; y += s2)
        pool.push({ x, y });
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    for (let i = 0; i < Math.min(count, pool.length); i++) {
      const { x, y } = pool[i];
      const r = Math.random();
      const c = side === "Right" && r < 0.15 ? "#dc2626"
              : side === "Right" && r < 0.30 ? "#111111"
              : color;
      screen1Dots.push({ x, y, color: c });
    }
  });
}

function renderScreen1() {
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  screen1Dots.forEach(d => {
    ctx.fillStyle = d.color;
    ctx.fillRect(d.x, d.y, screen1Sq, screen1Sq);
  });
}

let screen2Dots = [];

function generateScreen2(W, H) {
  screen2Dots = [];
  const cx       = W / 2;
  const pad      = 60;
  const maxCount = Math.max(...Object.values(COUNTS.Left), ...Object.values(COUNTS.Right));
  const s_auto   = Math.max(2, Math.floor(Math.sqrt((cx - 60) * 100 / maxCount)));
  const sq       = Math.max(1, Math.floor(s_auto * 0.75));
  const s2       = sq + Math.max(1, Math.round(s_auto * 0.3));
  const snapH2   = Math.max(s2, Math.floor(30 / s2) * s2);
  const totalH2  = TIERS.flatMap(t => t.cats).length * snapH2;
  const startY2  = (H - totalH2) / 2;
  const lineGap  = s2 - sq;

  const totalLeft  = Object.values(COUNTS.Left).reduce((a, b) => a + b, 0);
  const totalRight = Object.values(COUNTS.Right).reduce((a, b) => a + b, 0);

  ["Left", "Right"].forEach(side => {
    const color  = side === "Left" ? LEFT_COLOR : RIGHT_COLOR;
    const count  = side === "Left" ? totalLeft : totalRight;
    const xStart = side === "Left" ? cx - lineGap - sq : cx + lineGap;
    let drawn = 0;
    outer: for (let x = xStart; side === "Left" ? x > 10 : x < W - 10; x += side === "Left" ? -s2 : s2) {
      for (let y = startY2 + totalH2 - s2 / 2; y >= startY2; y -= s2) {
        if (drawn >= count) break outer;
        const pct = count > 0 ? drawn / count : 0;
        const c = side === "Right" && pct >= 0.85 ? "#111111"
                : side === "Right" && pct >= 0.70 ? "#dc2626"
                : color;
        screen2Dots.push({ x, y: y - sq / 2, color: c, sq });
        drawn++;
      }
    }
  });
}

function renderScreen2() {
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  screen2Dots.forEach(d => {
    ctx.fillStyle = d.color;
    ctx.fillRect(d.x, d.y, d.sq, d.sq);
  });
}

let screen4Dots = [];

function generateScreen4(W, H) {
  screen4Dots = [];
  const cx   = W / 2;
  const cy   = H / 2;
  const halfW = W * 0.48;
  const halfH = H * 0.08;
  const x1   = cx - halfW;
  const x2   = cx + halfW;
  const y1   = cy - halfH;
  const y2   = cy + halfH;

  const maxCount = Math.max(...Object.values(COUNTS.Left), ...Object.values(COUNTS.Right));
  const s_auto   = Math.max(2, Math.floor(Math.sqrt((cx - 60) * 100 / maxCount)));
  const sq       = Math.max(1, Math.floor(s_auto * 0.75));
  const s        = sq + Math.max(1, Math.round(s_auto * 0.3));
  const gap      = s - sq;

  // quadrants: [side, tier, xStart, xEnd, xStep, yStart, yEnd, yStep]
  const quadrants = [
    { side: "Left",  cats: TIERS[0].cats, xS: cx - gap - sq, xE: x1, xSt: -s, yS: cy,  yE: y2, ySt: s  },
    { side: "Right", cats: TIERS[0].cats, xS: cx + gap,      xE: x2, xSt:  s, yS: cy,  yE: y2, ySt: s  },
    { side: "Left",  cats: TIERS[2].cats, xS: cx - gap - sq, xE: x1, xSt: -s, yS: cy,  yE: y1, ySt: -s },
    { side: "Right", cats: TIERS[2].cats, xS: cx + gap,      xE: x2, xSt:  s, yS: cy,  yE: y1, ySt: -s },
  ];

  quadrants.forEach(({ side, cats, xS, xE, xSt, yS, yE, ySt }) => {
    const color = side === "Left" ? LEFT_COLOR : RIGHT_COLOR;
    const count = cats.reduce((a, c) => a + (COUNTS[side][c] || 0), 0);
    let drawn = 0;
    outer: for (let x = xS; xSt > 0 ? x < xE : x > xE; x += xSt) {
      for (let y = yS; ySt > 0 ? y < yE : y > yE; y += ySt) {
        if (drawn >= count) break outer;
        const alpha = cats === TIERS[0].cats ? 0.15 : 1;
        screen4Dots.push({ x, y: y - sq / 2, color, sq, alpha });
        drawn++;
      }
    }
  });
}

function renderScreen4() {
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const cx    = W / 2;
  const cy    = H / 2;
  const halfW = W * 0.48;
  const halfH = H * 0.08;

  screen4Dots.forEach(d => {
    ctx.globalAlpha = d.alpha ?? 1;
    ctx.fillStyle   = d.color;
    ctx.fillRect(d.x, d.y, d.sq, d.sq);
  });
  ctx.globalAlpha = 1;

  ctx.strokeStyle = "#000000";
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.moveTo(cx, cy - halfH); ctx.lineTo(cx, cy + halfH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - halfW, cy); ctx.lineTo(cx + halfW, cy); ctx.stroke();
}

function drawScreen(screen) {
  if (screen === 0) renderScreen1();
  else if (screen === 1) renderScreen2();
  else if (screen === 2) render();
  else renderScreen4();
}

function init() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  generateDots(canvas.width, canvas.height);
  generateScreen1(canvas.width, canvas.height);
  generateScreen2(canvas.width, canvas.height);
  generateScreen4(canvas.width, canvas.height);
  drawScreen(currentScreen);
}

window.addEventListener("wheel", e => {
  if (e.deltaY > 0 && currentScreen < NUM_SCREENS - 1) currentScreen++;
  else if (e.deltaY < 0 && currentScreen > 0) currentScreen--;
  drawScreen(currentScreen);
}, { passive: true });

init();
window.addEventListener("resize", init);
