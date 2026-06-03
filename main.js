const LEFT_LIGHT  = "#b8d9ff";
const LEFT_MID    = "#4e9af1";
const LEFT_DARK   = "#0d2d5e";

const RIGHT_LIGHT = "#ffd4a8";
const RIGHT_MID   = "#f97316";
const RIGHT_DARK  = "#7a2e00";

const PAD_TOP    = 160;
const PAD_BOT    = 40;
const GAP        = 220;
const CENTER_PAD  = 6;
const S3_LABEL_H   = 20;
const S3_LABEL_GAP = 8;
const S3_CAT_GAP   = 24;

function lerpColor(a, b, t) {
  const r  = c => parseInt(c.slice(1,3), 16);
  const g  = c => parseInt(c.slice(3,5), 16);
  const bl = c => parseInt(c.slice(5,7), 16);
  return `rgb(${Math.round(r(a)+(r(b)-r(a))*t)},${Math.round(g(a)+(g(b)-g(a))*t)},${Math.round(bl(a)+(bl(b)-bl(a))*t)})`;
}

function severityColor(light, mid, dark, i) {
  const half = (SEVERITY.length - 1) / 2;
  const t = Math.min(Math.max(i, 0), SEVERITY.length - 1);
  return t <= half
    ? lerpColor(light, mid, t / half)
    : lerpColor(mid, dark, (t - half) / half);
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

const WEAPONS = ["Stones", "Gas", "Arson", "Firearm", "Explosive"];

const WEAPON_COUNTS = {
  Left: {
    "Stones":    { "Road blocking": 1, "Mob violence": 2 },
    "Gas":       { "Peaceful protest": 1, "Mob violence": 1, "Armed attack": 1 },
    "Arson":     {},
    "Firearm":   {},
    "Explosive": {},
  },
  Right: {
    "Stones":    { "Road blocking": 5, "Harassment": 11, "Property destruction": 140, "Land seizure": 1, "Mob violence": 818, "Physical assault": 309, "Armed attack": 1 },
    "Gas":       { "Harassment": 1, "Property destruction": 5, "Land seizure": 1, "Mob violence": 35, "Physical assault": 15, "Armed attack": 11 },
    "Arson":     { "Road blocking": 1, "Harassment": 1, "Property destruction": 314, "Land seizure": 3, "Mob violence": 42, "Physical assault": 34, "Armed attack": 16, "Abduction": 1 },
    "Firearm":   { "Road blocking": 2, "Harassment": 6, "Property destruction": 26, "Land seizure": 3, "Mob violence": 41, "Physical assault": 40, "Armed attack": 396, "Abduction": 1 },
    "Explosive": { "Property destruction": 1, "Armed attack": 2 },
  },
};

const TARGET_TYPES = [
  "Government",
  "Civilians",
  "Property",
  "Israeli forces",
  "Activists",
];

// Counts broken down by severity within each target type
const TARGET_COUNTS = {
  Left: {
    "Activists":      {},
    "Civilians":      { "Peaceful protest": 1 },
    "Government":     { "Peaceful protest": 2446, "Road blocking": 466, "Harassment": 1, "Property destruction": 39, "Mob violence": 62, "Physical assault": 8, "Armed attack": 1 },
    "Israeli forces": { "Peaceful protest": 21, "Road blocking": 4, "Mob violence": 2, "Physical assault": 1 },
    "Property":       { "Peaceful protest": 2, "Property destruction": 1 },
  },
  Right: {
    "Activists":      { "Peaceful protest": 1, "Harassment": 1, "Land seizure": 1, "Physical assault": 9, "Armed attack": 2 },
    "Civilians":      { "Road blocking": 15, "Harassment": 99, "Property destruction": 204, "Land seizure": 5, "Mob violence": 1043, "Physical assault": 1127, "Armed attack": 395, "Abduction": 20 },
    "Government":     { "Peaceful protest": 13 },
    "Israeli forces": { "Peaceful protest": 1, "Property destruction": 1, "Land seizure": 1, "Mob violence": 4, "Physical assault": 2 },
    "Property":       { "Peaceful protest": 2, "Road blocking": 2, "Harassment": 1, "Property destruction": 1217, "Land seizure": 275, "Mob violence": 159, "Physical assault": 14, "Armed attack": 30 },
  },
};

const STRUCTURE_TYPES = [
  "Trees",
  "Vehicle",
  "Home",
  "Privately owned property",
  "Infrastructure",
];

const STRUCTURE_COUNTS = {
  Left: {
    "Trees":                   {},
    "Vehicle":                 { "Mob violence": 2, "Peaceful protest": 2, "Property destruction": 2 },
    "Home":                    { "Property destruction": 1 },
    "Privately owned property":{ "Mob violence": 1 },
    "Infrastructure":          { "Armed attack": 1, "Mob violence": 26, "Peaceful protest": 3, "Physical assault": 1, "Property destruction": 36, "Road blocking": 14 },
  },
  Right: {
    "Trees":                   { "Abduction": 1, "Armed attack": 21, "Land seizure": 14, "Mob violence": 92, "Physical assault": 48, "Property destruction": 642, "Road blocking": 1 },
    "Vehicle":                 { "Armed attack": 59, "Mob violence": 134, "Physical assault": 82, "Property destruction": 242, "Road blocking": 1 },
    "Home":                    { "Armed attack": 37, "Harassment": 1, "Land seizure": 12, "Mob violence": 74, "Physical assault": 31, "Property destruction": 129 },
    "Privately owned property":{ "Abduction": 1, "Armed attack": 15, "Harassment": 2, "Land seizure": 5, "Mob violence": 20, "Physical assault": 55, "Property destruction": 224 },
    "Infrastructure":          { "Armed attack": 9, "Land seizure": 3, "Mob violence": 6, "Physical assault": 6, "Property destruction": 78 },
  },
};

const canvas = document.getElementById("canvas");
const ctx    = canvas.getContext("2d");

const IDF_GREEN = "#22c55e";

const SEVERITY_HE = {
  "Peaceful protest":    "הפגנה לא אלימה",
  "Road blocking":       "חסימת כביש",
  "Harassment":          "הטרדה",
  "Property destruction":"הרס רכוש",
  "Land seizure":        "תפיסת קרקע",
  "Mob violence":        "התפרעות",
  "Physical assault":    "תקיפה פיזית",
  "Armed attack":        "תקיפה עם כלי נשק חם",
  "Abduction":           "חטיפה",
};
const IDF_COUNTS = {
  "Mob violence": 130, "Physical assault": 117, "Property destruction": 110,
  "Armed attack": 72, "Land seizure": 28, "Harassment": 19,
  "Abduction": 3, "Road blocking": 3, "Peaceful protest": 1,
};
const IDF_TARGET_COUNTS = {
  "Civilians": 360, "Property": 116, "Israeli forces": 1, "Activists": 3, "Government": 0,
};
const IDF_STRUCTURE_COUNTS = {
  "Trees": 59, "Vehicle": 36, "Home": 65, "Privately owned property": 26, "Infrastructure": 8,
};
const IDF_WEAPON_COUNTS = {
  "Stones": 62, "Gas": 55, "Arson": 24, "Firearm": 145, "Explosive": 1,
};

let screen1Dots = [];
let screen1bDots = [];
let screen2Dots = [];
let screen3Dots = [];
let screen3Bounds = { left: 0, right: 0 };
let screen4Dots = [];
let screen5Dots = [];
let spacing = 6;


function computeSpacing(W, H) {
  const fullSectionH = (H - PAD_TOP - PAD_BOT) / SEVERITY.length;
  const maxSectionCount = Math.max(...SEVERITY.flatMap(cat =>
    [COUNTS.Left[cat] || 0, COUNTS.Right[cat] || 0]
  ));
  let s = Math.floor(Math.sqrt((W / 2 / 2) * fullSectionH / maxSectionCount));
  return Math.max(3, s);
}

function generateScreen1(W, H) {
  const mid        = W / 2;
  const leftCount  = Object.values(COUNTS.Left).reduce((a, b) => a + b, 0);
  const rightCount = Object.values(COUNTS.Right).reduce((a, b) => a + b, 0);
  const maxRows    = Math.floor((H - PAD_TOP - PAD_BOT) / spacing);
  const cols       = Math.ceil(Math.max(leftCount, rightCount) / maxRows);

  screen1Dots = [];

  [
    { side: "Left",  count: leftCount,  color: LEFT_MID  },
    { side: "Right", count: rightCount, color: RIGHT_MID },
  ].forEach(({ side, count, color }) => {
    const startX = side === "Left"
      ? mid - spacing / 2 - CENTER_PAD
      : mid + spacing / 2 + CENTER_PAD;

    for (let k = 0; k < count; k++) {
      const row = Math.floor(k / cols);
      const col = k % cols;
      const x = side === "Left"
        ? startX - col * spacing
        : startX + col * spacing;
      const y = H - PAD_BOT - spacing / 2 - row * spacing;
      screen1Dots.push({ x, y, color });
    }
  });
}

function generateScreen1b(W, H) {
  const mid        = W / 2;
  const leftCount  = Object.values(COUNTS.Left).reduce((a, b) => a + b, 0);
  const rightCount = Object.values(COUNTS.Right).reduce((a, b) => a + b, 0);
  const maxRows    = Math.floor((H - PAD_TOP - PAD_BOT) / spacing);
  const cols       = Math.ceil(Math.max(leftCount, rightCount) / maxRows);
  const idfTotal   = Object.values(IDF_COUNTS).reduce((a, b) => a + b, 0);

  screen1bDots = [];

  // Left side — same as screen1
  const leftStartX = mid - spacing / 2 - CENTER_PAD;
  for (let k = 0; k < leftCount; k++) {
    const row = Math.floor(k / cols);
    const col = k % cols;
    screen1bDots.push({
      x: leftStartX - col * spacing,
      y: H - PAD_BOT - spacing / 2 - row * spacing,
      color: LEFT_MID,
    });
  }

  // Right side — non-IDF first (orange), IDF last (green → they end up at top)
  const rightStartX = mid + spacing / 2 + CENTER_PAD;
  const nonIdf = rightCount - idfTotal;
  for (let k = 0; k < rightCount; k++) {
    const row  = Math.floor(k / cols);
    const col  = k % cols;
    screen1bDots.push({
      x: rightStartX + col * spacing,
      y: H - PAD_BOT - spacing / 2 - row * spacing,
      color: k < nonIdf ? RIGHT_MID : IDF_GREEN,
    });
  }
}

function generateScreen2(W, H) {
  const mid          = W / 2;
  const fullSectionH = (H - PAD_TOP - PAD_BOT) / SEVERITY.length;
  const rowsPerSec   = Math.floor(fullSectionH / spacing);

  screen2Dots = [];

  SEVERITY.forEach((cat, i) => {
    const lColor        = severityColor(LEFT_LIGHT,  LEFT_MID,  LEFT_DARK,  i);
    const rColor        = severityColor(RIGHT_LIGHT, RIGHT_MID, RIGHT_DARK, i);
    const sectionBottom = PAD_TOP + (i + 1) * rowsPerSec * spacing;

    ["Left", "Right"].forEach(side => {
      const count  = COUNTS[side][cat] || 0;
      const baseColor = side === "Left" ? lColor : rColor;
      const idf    = side === "Right" ? (IDF_COUNTS[cat] || 0) : 0;
      const startX = side === "Left"
        ? mid - spacing / 2 - CENTER_PAD
        : mid + spacing / 2 + CENTER_PAD;

      for (let k = 0; k < count; k++) {
        const row      = k % rowsPerSec;
        const localCol = Math.floor(k / rowsPerSec);
        const x = side === "Left"
          ? startX - localCol * spacing
          : startX + localCol * spacing;
        const y     = sectionBottom - row * spacing;
        const color = (side === "Right" && k >= count - idf) ? IDF_GREEN : baseColor;
        screen2Dots.push({ x, y, color });
      }
    });
  });
}

function weaponsForSide(side) {
  return WEAPONS.filter(w =>
    Object.values(WEAPON_COUNTS[side][w] || {}).reduce((a, b) => a + b, 0) > 0
  );
}

const WEAPON_GAP = 24;

function weaponCount(side, weapon) {
  return Object.values(WEAPON_COUNTS[side][weapon] || {}).reduce((a, b) => a + b, 0);
}

function screen5Layout(W, H) {
  const leftWeapons  = weaponsForSide("Left");
  const rightWeapons = weaponsForSide("Right");
  const maxCount     = Math.max(
    ...leftWeapons.map(w  => weaponCount("Left",  w)),
    ...rightWeapons.map(w => weaponCount("Right", w)),
  );
  const sideW    = (W / 2 - CENTER_PAD - spacing / 2) * 0.65;
  const secW     = sideW / Math.max(leftWeapons.length, rightWeapons.length);
  const cols     = Math.max(Math.floor(secW / spacing), 1);
  const rows     = Math.max(Math.ceil(maxCount / cols), 1);
  return { leftWeapons, rightWeapons, rows };
}

function weaponOffset(weapons, side, targetIdx, rows) {
  let offset = 0;
  for (let i = 0; i < targetIdx; i++) {
    const count = weaponCount(side, weapons[i]);
    const cols  = Math.max(Math.ceil(count / rows), 1);
    offset += cols * spacing + WEAPON_GAP;
  }
  if (side === "Left" && weapons[targetIdx] === "Gas") offset += 20;
  return offset;
}

function screen3CategoryTop(tt, W, H) {
  const maxCols = Math.min(Math.floor((W / 2 - CENTER_PAD - spacing / 2) / spacing), 80);
  const totalForTarget = (side, t) =>
    Object.values(TARGET_COUNTS[side][t] || {}).reduce((a, b) => a + b, 0);

  const catH = t => {
    const maxCount = Math.max(totalForTarget("Left", t), totalForTarget("Right", t));
    const rows     = Math.max(Math.ceil(maxCount / maxCols), 1);
    return S3_LABEL_H + S3_LABEL_GAP + rows * spacing;
  };

  const totalContent = TARGET_TYPES.reduce((s, t) => s + catH(t), 0);
  const availH       = (H || canvas.height) - PAD_TOP - PAD_BOT - 60;
  const gap          = Math.max((availH - totalContent) / (TARGET_TYPES.length - 1), S3_CAT_GAP);

  let y = PAD_TOP;
  for (const t of TARGET_TYPES) {
    if (t === tt) return y;
    y += catH(t) + gap;
  }
  return y;
}

function generateScreen3(W, H) {
  const mid = W / 2;

  const totalForTarget = (side, tt) =>
    Object.values(TARGET_COUNTS[side][tt] || {}).reduce((a, b) => a + b, 0);

  screen3Dots = [];

  const maxCols = Math.min(
    Math.floor((W / 2 - CENTER_PAD - spacing / 2) / spacing),
    80
  );

  TARGET_TYPES.forEach((tt, i) => {
    const catTop  = screen3CategoryTop(tt, W, H);
    const dotsTop = catTop + S3_LABEL_H + S3_LABEL_GAP;

    ["Left", "Right"].forEach(side => {
      const total  = totalForTarget(side, tt);
      const startX = side === "Left"
        ? mid - spacing / 2 - CENTER_PAD
        : mid + spacing / 2 + CENTER_PAD;
      const startY = dotsTop + spacing / 2;

      const idf          = side === "Right" ? (IDF_TARGET_COUNTS[tt] || 0) : 0;
      const rowsForBlock = Math.max(Math.ceil(total / maxCols), 1);
      let k = 0;
      SEVERITY.forEach((sev, si) => {
        const count = (TARGET_COUNTS[side][tt] || {})[sev] || 0;
        const baseColor = side === "Left"
          ? severityColor(LEFT_LIGHT, LEFT_MID, LEFT_DARK,  si)
          : severityColor(RIGHT_LIGHT, RIGHT_MID, RIGHT_DARK, si);

        for (let j = 0; j < count; j++, k++) {
          const col   = Math.floor(k / rowsForBlock);
          const row   = k % rowsForBlock;
          const x     = side === "Left"
            ? startX - col * spacing
            : startX + col * spacing;
          const y     = startY + row * spacing;
          const color = (side === "Right" && k >= total - idf) ? IDF_GREEN : baseColor;
          screen3Dots.push({ x, y, color });
        }
      });
    });
  });
}

function drawScreen3() {
  const W   = canvas.width;
  const H   = canvas.height;
  const mid = W / 2;

  const r = spacing / 2 - 0.5;

  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, PAD_TOP);
  ctx.font = "13px monospace";
  ctx.fillStyle = "#111";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("קיצוניים משני הצדדים", W / 2, PAD_TOP / 2 - 12);
  ctx.font = "11px monospace";
  ctx.fillStyle = "#555";
  ctx.fillText("סוג מטרה", W / 2, PAD_TOP / 2 + 12);

  const TARGET_HE = {
    "Government":     "ממשל",
    "Property":       "רכוש",
    "Israeli forces": "כוחות ישראליים",
    "Activists":      "פעילים",
    "Civilians":      "אזרחים",
  };

  ctx.font = "12px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#111";
  TARGET_TYPES.forEach((label, i) => {
    const y = screen3CategoryTop(label, W, H) + (S3_LABEL_H - 12) / 2;
    ctx.fillText(TARGET_HE[label] || label, mid, y);
  });

  for (const { x, y, color } of screen3Dots) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

function screen4CategoryTop(tt, W, H) {
  const maxCols = Math.min(Math.floor((W / 2 - CENTER_PAD - spacing / 2) / spacing), 80);
  const totalFor = (side, t) =>
    Object.values(STRUCTURE_COUNTS[side][t] || {}).reduce((a, b) => a + b, 0);
  const catH = t => {
    const maxCount = Math.max(totalFor("Left", t), totalFor("Right", t));
    const rows     = Math.max(Math.ceil(maxCount / maxCols), 1);
    return S3_LABEL_H + S3_LABEL_GAP + rows * spacing;
  };
  const totalContent = STRUCTURE_TYPES.reduce((s, t) => s + catH(t), 0);
  const availH       = (H || canvas.height) - PAD_TOP - PAD_BOT - 60;
  const gap          = Math.max((availH - totalContent) / (STRUCTURE_TYPES.length - 1), S3_CAT_GAP);
  let y = PAD_TOP;
  for (const t of STRUCTURE_TYPES) {
    if (t === tt) return y;
    y += catH(t) + gap;
  }
  return y;
}

function generateScreen4(W, H) {
  const mid = W / 2;
  const maxCols = Math.min(Math.floor((W / 2 - CENTER_PAD - spacing / 2) / spacing), 80);
  const totalFor = (side, tt) =>
    Object.values(STRUCTURE_COUNTS[side][tt] || {}).reduce((a, b) => a + b, 0);

  screen4Dots = [];

  STRUCTURE_TYPES.forEach((tt, i) => {
    const catTop  = screen4CategoryTop(tt, W, H);
    const dotsTop = catTop + S3_LABEL_H + S3_LABEL_GAP;

    ["Left", "Right"].forEach(side => {
      const total          = totalFor(side, tt);
      const rowsForBlock   = Math.max(Math.ceil(total / maxCols), 1);
      const startX         = side === "Left"
        ? mid - spacing / 2 - CENTER_PAD
        : mid + spacing / 2 + CENTER_PAD;
      const startY         = dotsTop + spacing / 2;

      const idf = side === "Right" ? (IDF_STRUCTURE_COUNTS[tt] || 0) : 0;
      let k = 0;
      SEVERITY.forEach((sev, si) => {
        const count = (STRUCTURE_COUNTS[side][tt] || {})[sev] || 0;
        const baseColor = side === "Left"
          ? severityColor(LEFT_LIGHT, LEFT_MID, LEFT_DARK,  si)
          : severityColor(RIGHT_LIGHT, RIGHT_MID, RIGHT_DARK, si);

        for (let j = 0; j < count; j++, k++) {
          const col   = Math.floor(k / rowsForBlock);
          const row   = k % rowsForBlock;
          const x     = side === "Left"
            ? startX - col * spacing
            : startX + col * spacing;
          const y     = startY + row * spacing;
          const color = (side === "Right" && k >= total - idf) ? IDF_GREEN : baseColor;
          screen4Dots.push({ x, y, color });
        }
      });
    });
  });
}

const STRUCTURE_HE = {
  "Trees":                   "עצים",
  "Vehicle":                 "רכבים",
  "Home":                    "בתים",
  "Privately owned property":"רכוש פרטי",
  "Infrastructure":          "תשתיות",
};

function drawScreen4() {
  const W   = canvas.width;
  const H   = canvas.height;
  const mid = W / 2;
  const r   = spacing / 2 - 0.5;

  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, PAD_TOP);
  ctx.font = "13px monospace";
  ctx.fillStyle = "#111";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("קיצוניים משני הצדדים", W / 2, PAD_TOP / 2 - 12);
  ctx.font = "11px monospace";
  ctx.fillStyle = "#555";
  ctx.fillText("נזק לרכוש", W / 2, PAD_TOP / 2 + 12);

  ctx.font = "12px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#111";
  STRUCTURE_TYPES.forEach((tt) => {
    const y = screen4CategoryTop(tt, W, H) + (S3_LABEL_H - 12) / 2;
    ctx.fillText(STRUCTURE_HE[tt] || tt, mid, y);
  });

  for (const { x, y, color } of screen4Dots) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

function generateScreen5(W, H) {
  const mid = W / 2;
  const { leftWeapons, rightWeapons, rows } = screen5Layout(W, H);

  screen5Dots = [];

  [
    { side: "Left",  weapons: leftWeapons  },
    { side: "Right", weapons: rightWeapons },
  ].forEach(({ side, weapons }) => {
    weapons.forEach((weapon, wi) => {
      const offset = weaponOffset(weapons, side, wi, rows);
      const startX = side === "Left"
        ? mid - CENTER_PAD - spacing / 2 - offset
        : mid + CENTER_PAD + spacing / 2 + offset;
      const startY = H / 2 - (rows * spacing) / 2 + spacing / 2;

      const total = Object.values(WEAPON_COUNTS[side][weapon] || {}).reduce((a, b) => a + b, 0);
      const idf   = side === "Right" ? (IDF_WEAPON_COUNTS[weapon] || 0) : 0;
      let k = 0;
      SEVERITY.forEach((sev, si) => {
        const count = (WEAPON_COUNTS[side][weapon] || {})[sev] || 0;
        const baseColor = side === "Left"
          ? severityColor(LEFT_LIGHT, LEFT_MID, LEFT_DARK, si)
          : severityColor(RIGHT_LIGHT, RIGHT_MID, RIGHT_DARK, si);

        for (let j = 0; j < count; j++, k++) {
          const col   = Math.floor(k / rows);
          const row   = k % rows;
          const x     = side === "Left"
            ? startX - col * spacing
            : startX + col * spacing;
          const y     = startY + row * spacing;
          const color = (side === "Right" && k >= total - idf) ? IDF_GREEN : baseColor;
          screen5Dots.push({ x, y, color });
        }
      });
    });
  });
}

function drawScreen5() {
  const W = canvas.width;
  const H = canvas.height;
  const mid = W / 2;
  const r = spacing / 2 - 0.5;
  const { leftWeapons, rightWeapons, rows } = screen5Layout(W, H);
  const bandTop = H / 2 - (rows * spacing) / 2;

  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, PAD_TOP);
  const WEAPONS_HE = {
    "Stones":    "אבנים",
    "Gas":       "גז",
    "Arson":     "הצתה",
    "Firearm":   "נשק חם",
    "Explosive": "נפץ",
  };

  ctx.font = "13px monospace";
  ctx.fillStyle = "#111";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("קיצוניים משני הצדדים", W / 2, PAD_TOP / 2 - 12);
  ctx.font = "11px monospace";
  ctx.fillStyle = "#555";
  ctx.fillText("נשק בשימוש", W / 2, PAD_TOP / 2 + 12);

  ctx.font = "12px monospace";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = "#111";

  leftWeapons.forEach((weapon, wi) => {
    const offset = weaponOffset(leftWeapons, "Left", wi, rows);
    ctx.textAlign = "right";
    ctx.fillText(WEAPONS_HE[weapon] || weapon, mid - CENTER_PAD - spacing / 2 - offset, bandTop - 8);
  });
  rightWeapons.forEach((weapon, wi) => {
    const offset = weaponOffset(rightWeapons, "Right", wi, rows);
    ctx.textAlign = "left";
    ctx.fillText(WEAPONS_HE[weapon] || weapon, mid + CENTER_PAD + spacing / 2 + offset, bandTop - 8);
  });

  for (const { x, y, color } of screen5Dots) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

}

function drawScreen1() {
  const W   = canvas.width;
  const H   = canvas.height;
  const r   = spacing / 2 - 0.5;

  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, PAD_TOP);
  ctx.font = "13px monospace";
  ctx.fillStyle = "#111";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("קיצוניים משני הצדדים", W / 2, PAD_TOP / 2 - 12);
  ctx.font = "11px monospace";
  ctx.fillStyle = "#555";
  ctx.fillText("אירועים מדווחים מ1.1.2023 - 2.6.2025", W / 2, PAD_TOP / 2 + 12);

  for (const { x, y, color } of screen1Dots) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  const mid        = W / 2;
  const leftCount  = Object.values(COUNTS.Left).reduce((a, b) => a + b, 0);
  const rightCount = Object.values(COUNTS.Right).reduce((a, b) => a + b, 0);
  const maxRows    = Math.floor((H - PAD_TOP - PAD_BOT) / spacing);
  const cols       = Math.ceil(Math.max(leftCount, rightCount) / maxRows);

  const leftTopY  = H - PAD_BOT - spacing / 2 - (Math.ceil(leftCount  / cols) - 1) * spacing;
  const rightTopY = H - PAD_BOT - spacing / 2 - (Math.ceil(rightCount / cols) - 1) * spacing;
  const leftCenterX  = mid - spacing / 2 - CENTER_PAD - ((cols - 1) * spacing) / 2;
  const rightCenterX = mid + spacing / 2 + CENTER_PAD + ((cols - 1) * spacing) / 2;

  ctx.font = "11px monospace";
  ctx.fillStyle = "#333";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(leftCount.toLocaleString(),  leftCenterX,  leftTopY  - 8);
  ctx.fillText(rightCount.toLocaleString(), rightCenterX, rightTopY - 8);

  const leftOuterX  = mid - spacing / 2 - CENTER_PAD - (cols - 1) * spacing;
  const rightOuterX = mid + spacing / 2 + CENTER_PAD + (cols - 1) * spacing;
  ctx.font = "11px monospace";
  ctx.fillStyle = "#555";
  ctx.textBaseline = "bottom";
  ctx.textAlign = "right";
  ctx.fillText("הפגנות השמאל נגד הממשלה",      leftOuterX - 12,  H - PAD_BOT - spacing / 2);
  ctx.textAlign = "left";
  ctx.fillText("פעילות מתיישבים נגד פלסטינים", rightOuterX + 12, H - PAD_BOT - spacing / 2);
}

function drawScreen1b() {
  const W   = canvas.width;
  const H   = canvas.height;
  const r   = spacing / 2 - 0.5;

  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, PAD_TOP);
  ctx.font = "13px monospace";
  ctx.fillStyle = "#111";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("קיצוניים משני הצדדים", W / 2, PAD_TOP / 2 - 12);
  ctx.font = "11px monospace";
  ctx.fillStyle = "#555";
  ctx.fillText("אירועים מדווחים מ1.1.2023 - 2.6.2025", W / 2, PAD_TOP / 2 + 12);

  for (const { x, y, color } of screen1bDots) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  const mid       = W / 2;
  const leftCount  = Object.values(COUNTS.Left).reduce((a, b) => a + b, 0);
  const rightCount = Object.values(COUNTS.Right).reduce((a, b) => a + b, 0);
  const maxRows    = Math.floor((H - PAD_TOP - PAD_BOT) / spacing);
  const cols       = Math.ceil(Math.max(leftCount, rightCount) / maxRows);
  const leftOuterX  = mid - spacing / 2 - CENTER_PAD - (cols - 1) * spacing;
  const rightOuterX = mid + spacing / 2 + CENTER_PAD + (cols - 1) * spacing;
  const rightTopY   = H - PAD_BOT - spacing / 2 - (Math.ceil(rightCount / cols) - 1) * spacing;

  ctx.font = "11px monospace";
  ctx.fillStyle = "#555";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText("הפגנות השמאל נגד הממשלה",         leftOuterX - 12,  H - PAD_BOT - spacing / 2);
  ctx.textAlign = "left";
  ctx.fillText("פעילות מתיישבים נגד פלסטינים",    rightOuterX + 12, H - PAD_BOT - spacing / 2);
  ctx.textBaseline = "middle";
  ctx.fillText("אירועים בשיתוף פעולה עם כוחות הביטחון", rightOuterX + 12, rightTopY);
}

function drawScreen2() {
  const W   = canvas.width;
  const H   = canvas.height;
  const mid = W / 2;
  const r   = spacing / 2 - 0.5;
  const fullSectionH = (H - PAD_TOP - PAD_BOT) / SEVERITY.length;
  const rowsPerSec   = Math.floor(fullSectionH / spacing);

  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, PAD_TOP);
  ctx.font = "13px monospace";
  ctx.fillStyle = "#111";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("קיצוניים משני הצדדים", W / 2, PAD_TOP / 2 - 12);
  ctx.font = "11px monospace";
  ctx.fillStyle = "#555";
  ctx.fillText("סוג אירוע", W / 2, PAD_TOP / 2 + 12);

  ctx.font = "12px monospace";
  ctx.textBaseline = "middle";
  const GAP_LABEL = 80;
  const sharedLabelX = Math.max(...SEVERITY.map(cat => {
    const count   = COUNTS.Right[cat] || 0;
    const numCols = count > 0 ? Math.ceil(count / rowsPerSec) : 1;
    return (mid + spacing / 2) + (numCols - 1) * spacing;
  })) + GAP_LABEL;

  SEVERITY.forEach((cat, i) => {
    const count     = COUNTS.Right[cat] || 0;
    const numCols   = count > 0 ? Math.ceil(count / rowsPerSec) : 1;
    const rightmost = (mid + spacing / 2) + (numCols - 1) * spacing;
    const y = PAD_TOP + (i + 0.5) * rowsPerSec * spacing;
    const t = i / (SEVERITY.length - 1);
    const v = Math.round(200 - t * 180);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.textAlign = "left";
    ctx.fillText(SEVERITY_HE[cat], sharedLabelX, y);
  });

  for (const { x, y, color } of screen2Dots) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

}

function init() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  spacing = computeSpacing(canvas.width, canvas.height);
  generateScreen1(canvas.width, canvas.height);
  generateScreen1b(canvas.width, canvas.height);
  generateScreen2(canvas.width, canvas.height);
  generateScreen3(canvas.width, canvas.height);
  generateScreen4(canvas.width, canvas.height);
  generateScreen5(canvas.width, canvas.height);
  generateScreenInjury(canvas.width, canvas.height);
  generateScreenInjury2(canvas.width, canvas.height);
  generateScreenInjury3(canvas.width, canvas.height);
  generateScreen10();
  render();
}

function drawScreen0() {
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.font = "28px monospace";
  ctx.fillStyle = "#111";
  ctx.fillText("קיצוניים משני הצדדים", W / 2, H / 2 - 20);

  ctx.font = "15px monospace";
  ctx.fillStyle = "#555";
  ctx.fillText("ביטויי קיצוניות פוליטית מימין ומשמאל", W / 2, H / 2 + 20);
}

function drawScreen0b() {
  const W   = canvas.width;
  const H   = canvas.height;
  const mid = W / 2;
  const r   = spacing / 2 - 0.5;

  ctx.clearRect(0, 0, W, H);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.font = "28px monospace";
  ctx.fillStyle = "#111";
  ctx.fillText("קיצוניים משני הצדדים", mid, H / 2 - 20);

  ctx.font = "15px monospace";
  ctx.fillStyle = "#555";
  ctx.fillText("ביטויי קיצוניות פוליטית מימין ומשמאל", mid, H / 2 + 20);

  ctx.font = "12px monospace";
  ctx.fillStyle = "#555";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("כל עיגול מייצג אירוע מתועד מהקצה הפוליטי", mid, H / 2 + 160);

  ctx.beginPath();
  ctx.arc(mid - spacing / 2 - CENTER_PAD, H / 2 + 160 + r + 12, r, 0, Math.PI * 2);
  ctx.fillStyle = LEFT_MID;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(mid + spacing / 2 + CENTER_PAD, H / 2 + 160 + r + 12, r, 0, Math.PI * 2);
  ctx.fillStyle = RIGHT_MID;
  ctx.fill();
}

const INJURY_LEFT_BY_CAT = {
  "Peaceful protest": 16, "Road blocking": 14, "Property destruction": 1, "Mob violence": 29, "Physical assault": 10,
};
const INJURY_RIGHT_BY_CAT = {
  "Property destruction": 68, "Land seizure": 11, "Mob violence": 251, "Physical assault": 537, "Armed attack": 219, "Abduction": 3,
};
const IDF_INJURY_COUNTS = {
  "Physical assault": 163, "Mob violence": 115, "Armed attack": 90, "Property destruction": 48, "Land seizure": 11, "Abduction": 2,
};

let screenInjuryDots = [];

function generateScreenInjury(W, H) {
  const mid      = W / 2;
  const byCat    = { Left: INJURY_LEFT_BY_CAT, Right: INJURY_RIGHT_BY_CAT };
  const totalFor = side => Object.values(byCat[side]).reduce((a, b) => a + b, 0);
  const leftTotal  = totalFor("Left");
  const rightTotal = totalFor("Right");
  const maxRows    = Math.floor((H - PAD_TOP - PAD_BOT) / spacing);
  const cols       = Math.ceil(Math.max(leftTotal, rightTotal) / maxRows);

  screenInjuryDots = [];

  ["Left", "Right"].forEach(side => {
    const startX = side === "Left"
      ? mid - spacing / 2 - CENTER_PAD
      : mid + spacing / 2 + CENTER_PAD;
    let k = 0;
    // Non-IDF dots first
    SEVERITY.forEach((cat, si) => {
      const count     = byCat[side][cat] || 0;
      const idf       = side === "Right" ? (IDF_INJURY_COUNTS[cat] || 0) : 0;
      const nonIdf    = count - idf;
      const baseColor = side === "Left"
        ? severityColor(LEFT_LIGHT, LEFT_MID, LEFT_DARK, si)
        : severityColor(RIGHT_LIGHT, RIGHT_MID, RIGHT_DARK, si);
      for (let j = 0; j < nonIdf; j++, k++) {
        const row = Math.floor(k / cols);
        const col = k % cols;
        const x   = side === "Left" ? startX - col * spacing : startX + col * spacing;
        const y   = H - PAD_BOT - spacing / 2 - row * spacing;
        screenInjuryDots.push({ x, y, color: baseColor });
      }
    });
    // IDF dots last (appear at top)
    SEVERITY.forEach((cat, si) => {
      const idf = side === "Right" ? (IDF_INJURY_COUNTS[cat] || 0) : 0;
      for (let j = 0; j < idf; j++, k++) {
        const row = Math.floor(k / cols);
        const col = k % cols;
        const x   = side === "Left" ? startX - col * spacing : startX + col * spacing;
        const y   = H - PAD_BOT - spacing / 2 - row * spacing;
        screenInjuryDots.push({ x, y, color: IDF_GREEN });
      }
    });
  });
}

function drawScreenInjury() {
  const W   = canvas.width;
  const H   = canvas.height;
  const mid = W / 2;
  const r   = spacing / 2 - 0.5;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, PAD_TOP);

  ctx.font = "13px monospace";
  ctx.fillStyle = "#111";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("קיצוניים משני הצדדים", W / 2, PAD_TOP / 2 - 12);
  ctx.font = "11px monospace";
  ctx.fillStyle = "#555";
  ctx.fillText("אירועים עם נפגעים", W / 2, PAD_TOP / 2 + 12);

  for (const { x, y, color } of screenInjuryDots) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  const leftTotal  = Object.values(INJURY_LEFT_BY_CAT).reduce((a, b) => a + b, 0);
  const rightTotal = Object.values(INJURY_RIGHT_BY_CAT).reduce((a, b) => a + b, 0);
  const maxRows    = Math.floor((H - PAD_TOP - PAD_BOT) / spacing);
  const cols       = Math.ceil(Math.max(leftTotal, rightTotal) / maxRows);
  const leftTopY   = H - PAD_BOT - spacing / 2 - (Math.ceil(leftTotal  / cols) - 1) * spacing;
  const rightTopY  = H - PAD_BOT - spacing / 2 - (Math.ceil(rightTotal / cols) - 1) * spacing;
  const leftCenterX  = mid - spacing / 2 - CENTER_PAD - ((cols - 1) * spacing) / 2;
  const rightCenterX = mid + spacing / 2 + CENTER_PAD + ((cols - 1) * spacing) / 2;

  ctx.font = "11px monospace";
  ctx.fillStyle = "#333";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(leftTotal.toLocaleString(),  leftCenterX,  leftTopY  - 8);
  ctx.fillText(rightTotal.toLocaleString(), rightCenterX, rightTopY - 8);
}

const INJURY_BY_CAT_LIGHT = {
  Left:  { "Peaceful protest":12, "Road blocking":7, "Property destruction":0, "Mob violence":27, "Physical assault":6 },
  Right: { "Property destruction":51, "Land seizure":10, "Mob violence":179, "Physical assault":376, "Armed attack":86, "Abduction":2 },
};
const INJURY_BY_CAT_SEVERE = {
  Left:  { "Peaceful protest":4, "Road blocking":7, "Property destruction":1, "Mob violence":2, "Physical assault":4 },
  Right: { "Property destruction":16, "Land seizure":1, "Mob violence":68, "Physical assault":160, "Armed attack":119, "Abduction":1 },
};
const INJURY_BY_CAT_FATAL = {
  Left:  {},
  Right: { "Property destruction":1, "Mob violence":4, "Physical assault":1, "Armed attack":14 },
};

// Events with injuries by category (total, not split by severity)
const EVENTS_LEFT_BY_CAT  = { "Mob violence":13, "Peaceful protest":8, "Road blocking":12, "Physical assault":3, "Property destruction":1 };
const EVENTS_RIGHT_BY_CAT = { "Physical assault":280, "Property destruction":22, "Armed attack":87, "Mob violence":104, "Land seizure":2, "Abduction":3 };
const IDF_EVENTS_BY_CAT   = { "Physical assault":38, "Armed attack":25, "Mob violence":29, "Property destruction":9, "Land seizure":2, "Abduction":2 };

let screenInjury2Dots = [];
let groupOffsets = [];

function generateScreenInjury2(W, H) {
  const mid      = W / 2;
  const GAP_ROWS = 3;
  const leftTotal  = Object.values(INJURY_LEFT_BY_CAT).reduce((a, b) => a + b, 0);
  const rightTotal = Object.values(INJURY_RIGHT_BY_CAT).reduce((a, b) => a + b, 0);
  const maxRows    = Math.floor((H - PAD_TOP - PAD_BOT) / spacing);
  const cols       = Math.ceil(Math.max(leftTotal, rightTotal) / maxRows);

  screenInjury2Dots = [];

  // Pre-compute group offsets based on max(left,right) so both sides align
  groupOffsets = [];
  let ro = 0;
  [INJURY_BY_CAT_LIGHT, INJURY_BY_CAT_SEVERE, INJURY_BY_CAT_FATAL].forEach(byGroup => {
    groupOffsets.push(ro);
    const lc = Object.values(byGroup.Left  || {}).reduce((a, b) => a + b, 0);
    const rc = Object.values(byGroup.Right || {}).reduce((a, b) => a + b, 0);
    ro += Math.ceil(Math.max(lc, rc) / cols) + GAP_ROWS;
  });

  ["Left", "Right"].forEach(side => {
    const startX = side === "Left"
      ? mid - spacing / 2 - CENTER_PAD
      : mid + spacing / 2 + CENTER_PAD;

    [INJURY_BY_CAT_LIGHT, INJURY_BY_CAT_SEVERE, INJURY_BY_CAT_FATAL].forEach((byGroup, gi) => {
      const rowOffset = groupOffsets[gi];
      let groupK = 0;

      // Pass 1: non-IDF dots
      SEVERITY.forEach((cat, si) => {
        const count = (byGroup[side] || {})[cat] || 0;
        const idf   = gi === 0 ? Math.round((IDF_INJURY_COUNTS[cat] || 0) * 0.64)
                    : gi === 1 ? Math.round((IDF_INJURY_COUNTS[cat] || 0) * 0.35)
                    : (IDF_INJURY_COUNTS[cat] || 0) - Math.round((IDF_INJURY_COUNTS[cat] || 0) * 0.64) - Math.round((IDF_INJURY_COUNTS[cat] || 0) * 0.35);
        const nonIdf = count - (side === "Right" ? idf : 0);
        const baseColor = side === "Left"
          ? severityColor(LEFT_LIGHT, LEFT_MID, LEFT_DARK, si)
          : severityColor(RIGHT_LIGHT, RIGHT_MID, RIGHT_DARK, si);
        for (let j = 0; j < nonIdf; j++, groupK++) {
          const localRow = Math.floor(groupK / cols);
          const col      = groupK % cols;
          const x = side === "Left" ? startX - col * spacing : startX + col * spacing;
          const y = H - PAD_BOT - spacing / 2 - (rowOffset + localRow) * spacing;
          screenInjury2Dots.push({ x, y, color: baseColor });
        }
      });

      // Pass 2: IDF dots last → appear at top of group
      SEVERITY.forEach((cat, si) => {
        const count = (byGroup[side] || {})[cat] || 0;
        const idf   = gi === 0 ? Math.round((IDF_INJURY_COUNTS[cat] || 0) * 0.64)
                    : gi === 1 ? Math.round((IDF_INJURY_COUNTS[cat] || 0) * 0.35)
                    : (IDF_INJURY_COUNTS[cat] || 0) - Math.round((IDF_INJURY_COUNTS[cat] || 0) * 0.64) - Math.round((IDF_INJURY_COUNTS[cat] || 0) * 0.35);
        const idfCount = side === "Right" ? Math.min(idf, count) : 0;
        for (let j = 0; j < idfCount; j++, groupK++) {
          const localRow = Math.floor(groupK / cols);
          const col      = groupK % cols;
          const x = side === "Left" ? startX - col * spacing : startX + col * spacing;
          const y = H - PAD_BOT - spacing / 2 - (rowOffset + localRow) * spacing;
          screenInjury2Dots.push({ x, y, color: IDF_GREEN });
        }
      });

    });
  });
}

function drawScreenInjury2() {
  const W   = canvas.width;
  const H   = canvas.height;
  const r   = spacing / 2 - 0.5;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, PAD_TOP);

  ctx.font = "13px monospace";
  ctx.fillStyle = "#111";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("קיצוניים משני הצדדים", W / 2, PAD_TOP / 2 - 12);
  ctx.font = "11px monospace";
  ctx.fillStyle = "#555";
  ctx.fillText("אירועים עם נפגעים", W / 2, PAD_TOP / 2 + 12);

  for (const { x, y, color } of screenInjury2Dots) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  // Labels per group
  const mid        = W / 2;
  const leftTotal  = Object.values(INJURY_LEFT_BY_CAT).reduce((a, b) => a + b, 0);
  const rightTotal = Object.values(INJURY_RIGHT_BY_CAT).reduce((a, b) => a + b, 0);
  const maxRows    = Math.floor((H - PAD_TOP - PAD_BOT) / spacing);
  const cols       = Math.ceil(Math.max(leftTotal, rightTotal) / maxRows);
  const GAP_ROWS   = 3;

  const GROUPS_DATA = [
    { label: "פציעות קלות", data: INJURY_BY_CAT_LIGHT  },
    { label: "פציעות קשות", data: INJURY_BY_CAT_SEVERE },
    { label: "הרוגים",      data: INJURY_BY_CAT_FATAL  },
  ];

  ctx.font = "11px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#333";

  GROUPS_DATA.forEach(({ label, data }, gi) => {
    const lc        = Object.values(data.Left  || {}).reduce((a, b) => a + b, 0);
    const rc        = Object.values(data.Right || {}).reduce((a, b) => a + b, 0);
    const groupRows = Math.max(Math.ceil(Math.max(lc, rc) / cols), 1);
    const groupCols = Math.min(rc, cols);
    const rowOffset = groupOffsets[gi];
    const centerRow = rowOffset + groupRows / 2;
    const centerY   = H - PAD_BOT - spacing / 2 - centerRow * spacing;
    const labelX    = mid + spacing / 2 + CENTER_PAD + (groupCols - 1) * spacing + spacing * 3;
    ctx.fillText(label, labelX, centerY);
  });
}

let screenInjury3Dots = [];

function generateScreenInjury3(W, H) {
  const mid     = W / 2;
  const ROWS    = 3;
  const centerY = (PAD_TOP + H) / 2;
  const byCat   = { Left: EVENTS_LEFT_BY_CAT, Right: EVENTS_RIGHT_BY_CAT };

  screenInjury3Dots = [];

  ["Left", "Right"].forEach(side => {
    const startX = side === "Left"
      ? mid - spacing / 2 - CENTER_PAD
      : mid + spacing / 2 + CENTER_PAD;
    let k = 0;

    const place = (color) => {
      const col = Math.floor(k / ROWS);
      const row = k % ROWS;
      const x   = side === "Left" ? startX - col * spacing : startX + col * spacing;
      const y   = centerY - (ROWS - 1) / 2 * spacing + row * spacing;
      screenInjury3Dots.push({ x, y, color });
      k++;
    };

    SEVERITY.forEach((cat, si) => {
      const count     = byCat[side][cat] || 0;
      const idf       = side === "Right" ? (IDF_EVENTS_BY_CAT[cat] || 0) : 0;
      const nonIdf    = count - idf;
      const baseColor = side === "Left"
        ? severityColor(LEFT_LIGHT, LEFT_MID, LEFT_DARK, si)
        : severityColor(RIGHT_LIGHT, RIGHT_MID, RIGHT_DARK, si);
      for (let j = 0; j < nonIdf; j++) place(baseColor);
    });
    SEVERITY.forEach((cat) => {
      const idf = side === "Right" ? (IDF_EVENTS_BY_CAT[cat] || 0) : 0;
      for (let j = 0; j < idf; j++) place(IDF_GREEN);
    });
  });
}

function drawScreenInjury3() {
  const W   = canvas.width;
  const H   = canvas.height;
  const mid = W / 2;
  const r   = spacing / 2 - 0.5;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, PAD_TOP);

  ctx.font = "13px monospace";
  ctx.fillStyle = "#111";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("קיצוניים משני הצדדים", W / 2, PAD_TOP / 2 - 12);
  ctx.font = "11px monospace";
  ctx.fillStyle = "#555";
  ctx.fillText("אירועים עם נפגעים", W / 2, PAD_TOP / 2 + 12);

  for (const { x, y, color } of screenInjury3Dots) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  const ROWS       = 3;
  const centerY    = (PAD_TOP + H) / 2;
  const leftTotal  = Object.values(EVENTS_LEFT_BY_CAT).reduce((a, b) => a + b, 0);
  const rightTotal = Object.values(EVENTS_RIGHT_BY_CAT).reduce((a, b) => a + b, 0);
  const leftCols   = Math.ceil(leftTotal  / ROWS);
  const rightCols  = Math.ceil(rightTotal / ROWS);
  const topY       = centerY - spacing;
  const leftEndX   = mid - spacing / 2 - CENTER_PAD - (leftCols  - 1) * spacing;
  const rightEndX  = mid + spacing / 2 + CENTER_PAD + (rightCols - 1) * spacing;

  ctx.font = "11px monospace";
  ctx.fillStyle = "#333";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(leftTotal.toLocaleString(),  leftEndX,  topY - 8);
  ctx.fillText(rightTotal.toLocaleString(), rightEndX, topY - 8);
}

// Screen 10: single scrollable column, one dot = one injured person, colored by who got hurt
const VICTIM_BLUE     = "#4e9af1";
const VICTIM_ORANGE   = "#f97316";
const VICTIM_RED      = "#c0392b";
const VICTIM_PINK     = "#f9a8d4";
const VICTIM_DKGREEN  = "#166534";

// Who got hurt, split by severity group
const HURT_GROUPS = [
  {
    label: "פצועים קל",
    entries: [
      { color: VICTIM_RED,     count: 657 },
      { color: VICTIM_PINK,    count: 32  },
      { color: VICTIM_DKGREEN, count: 10  },
      { color: VICTIM_BLUE,    count: 4   },
      { color: VICTIM_ORANGE,  count: 11  },
    ]
  },
  {
    label: "פצועים קשה",
    entries: [
      { color: VICTIM_RED,     count: 347 },
      { color: VICTIM_PINK,    count: 17  },
      { color: VICTIM_BLUE,    count: 1   },
    ]
  },
  {
    label: "נהרגו",
    entries: [
      { color: VICTIM_RED,     count: 17  },
      { color: VICTIM_PINK,    count: 1   },
      { color: VICTIM_ORANGE,  count: 1   },
    ]
  },
];

const SCREEN10_GROUP_GAP = 6; // extra dot-spacings between groups

let screen10Dots = [];   // array of { color, groupLabel? }
let screen10Groups = []; // [{label, startIndex, count}]
let screen10ScrollY = 0;

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function generateScreen10() {
  screen10Dots = [];
  screen10Groups = [];

  HURT_GROUPS.forEach(({ label, entries }) => {
    const groupDots = [];
    entries.forEach(({ color, count }) => {
      for (let i = 0; i < count; i++) groupDots.push(color);
    });
    shuffle(groupDots);

    const startIndex = screen10Dots.length;
    screen10Groups.push({ label, startIndex, count: groupDots.length });
    screen10Dots.push(...groupDots);
    // gap: push null entries
    for (let g = 0; g < SCREEN10_GROUP_GAP; g++) screen10Dots.push(null);
  });
}

function drawScreen10() {
  const W = canvas.width;
  const H = canvas.height;
  const r = spacing / 2 - 0.5;
  const x = W / 2;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, PAD_TOP);

  ctx.font = "13px monospace";
  ctx.fillStyle = "#111";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("קיצוניים משני הצדדים", W / 2, PAD_TOP / 2 - 12);
  ctx.font = "11px monospace";
  ctx.fillStyle = "#555";
  ctx.fillText("נפגעים", W / 2, PAD_TOP / 2 + 12);

  // Draw dots
  for (let i = 0; i < screen10Dots.length; i++) {
    if (!screen10Dots[i]) continue;
    const y = PAD_TOP + spacing / 2 + i * spacing - screen10ScrollY;
    if (y + r < PAD_TOP || y - r > H) continue;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = screen10Dots[i];
    ctx.fill();
  }

  // Draw group labels
  ctx.font = "11px monospace";
  ctx.fillStyle = "#333";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const labelX = x + spacing + 8;
  screen10Groups.forEach(({ label, startIndex }) => {
    const y = PAD_TOP + spacing / 2 + startIndex * spacing - screen10ScrollY;
    if (y > PAD_TOP && y < H) ctx.fillText(label, labelX, y);
  });
}

let currentScreen = 0;

function render() {
  if (currentScreen === 0) drawScreen0();
  else if (currentScreen === 1) drawScreen0b();
  else if (currentScreen === 2) drawScreen1();
  else if (currentScreen === 3) drawScreen1b();
  else if (currentScreen === 4) drawScreen2();
  else if (currentScreen === 5) drawScreen3();
  else if (currentScreen === 6) drawScreen5();
  else if (currentScreen === 7) drawScreen4();
  else if (currentScreen === 8) drawScreenInjury3();
  else drawScreen10();
}

init();
window.addEventListener("resize", init);
window.addEventListener("wheel", (e) => {
  if (currentScreen === 9) {
    const maxScroll = Math.max(0, screen10Dots.length * spacing - (canvas.height - PAD_TOP - PAD_BOT));
    if (e.deltaY > 0) {
      screen10ScrollY = Math.min(maxScroll, screen10ScrollY + 80);
    } else {
      if (screen10ScrollY <= 0) {
        currentScreen--;
        screen10ScrollY = 0;
      } else {
        screen10ScrollY = Math.max(0, screen10ScrollY - 80);
      }
    }
    render();
  } else if (e.deltaY > 0 && currentScreen < 9) {
    currentScreen++;
    render();
  } else if (e.deltaY < 0 && currentScreen > 0) {
    currentScreen--;
    render();
  }
});
