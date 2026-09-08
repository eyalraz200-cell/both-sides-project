// @fold13's event map — drawn on the shared .graphic-col canvas, not scrolled
// in as a panel. Its build is a fold TRIGGER like every other fold's
// (`foldMapTrigger`, js/groups.js): the share card's centre crossing fires a
// fixed-duration 0→1 run (`p12map.t`) that plays three beats, so the map
// ARRIVES rather than slides up.
//
//   1. outlines wipe on   — the region's borders stroke themselves in, then
//                           the country fills fade up behind them
//   2. extreme dots FLY   — the dots left standing by @fold12's freeform
//                           spread travel from where they stand to their real
//                           coordinate (continuous position, per the house
//                           "position never snaps" rule)
//   3. legit dots POP     — every other event scales up in place at its own
//                           coordinate, staggered, since it has no previous
//                           position to fly from
//
// Data (both fetched once, lazily, when @fold12 comes near):
//   map/region.geojson      Natural Earth 10m outlines — Israel and Palestine
//                           plus the wider region, so a viewport-wide map has
//                           a filled horizon
//   map/event-points.json   {points: [[lat, lon] × 904], rows: [rowNum…],
//                           pt: [pointIdx…]} — ACLED geocodes to settlement
//                           centroids, so 14,451 events sit on 904 coordinates
//
// Because many events share a coordinate, every event gets its OWN cell in a
// cluster around that coordinate: the small dots coalesced into a bigger
// blob, never a circle with a number. Points within `cityKm` of a labelled
// city join that city's cluster, so a city never fragments. How a cluster's
// cells are laid out is the packer (`MAP_PACKERS[MAP_TUNE.shape]`): the
// `grow-*` packers GROW each cluster cell by cell into one shared lattice,
// claiming only cells inside the country outline its seed sits in — so blobs
// hug the coast and the borders and never cross a line, and neighbouring
// clusters abut instead of overlapping. Each event's cell is its fly/pop
// target, which is what lets beats 2 and 3 address dots individually.

// Every tunable of the map in one place (the _debug-map-clusters.js harness
// writes here live, then nulls p12map.layout).
const MAP_TUNE = {
  dot: 0.5,          // px per event dot at zoom 1
  dotGrow: 0.65,     // how the dot grows with the zoom: dot × z^dotGrow (1 = with the map, 0 = never)
  dotMax: 6,         // …but no bigger than this
  gapRatio: 0.45,    // gap between dots, as a share of the dot
  // ── Clustering: how the 904 coordinates group before they are packed ──────
  cluster: 'link',   // 'grid' (square buckets) | 'hex' (hex buckets, no cell-edge
                     // seams) | 'link' (greedy: a point joins any cluster whose
                     // centroid is within linkPx) | 'city' (every point joins its
                     // NEAREST labelled city — 16 blobs) | 'none' (one per coordinate)
  cellBase: 46,      // bucket size for 'grid'/'hex' — SCREEN px, so clusters re-form
                     // as the reader zooms (with cellKm on it is KM instead, and the
                     // same coordinates stay together at every zoom)
  cellKm: false,     // read cellBase as km on the ground rather than screen px
  linkPx: 38,        // 'link' only: join radius in screen px
  minCluster: 19,    // clusters smaller than this merge into their nearest neighbour (0 = off)
  cityKm: 0,         // points this close to a city join its cluster (0 = off; independent of `cluster`)
  jitter: 0,         // random-but-deterministic wobble per dot, as a share of the pitch (0 = a clean lattice)
  // ── The view ─────────────────────────────────────────────────────────────
  // The wheel does NOT zoom freely: it STEPS between the four stops in
  // MAP_ZOOM_LEVELS below, and every zoom-dependent decision (which counts,
  // which labels, whether the tooltip answers) reads off the current stop
  // rather than off its own zoom threshold. zoomLevel is the RESTING stop —
  // the one the map is built at — as a 1-based index into that table.
  zoomLevel: 2,
  startX: 0.5,       // the fit-view point (0–1 of its width) the resting view is centred on
  startY: 0.385,     // …and of its height (0.5/0.5 = centred; clamped like a pan)
  counts: true,      // write cluster counts at all (each level sets its own cutoff)
  shape: 'grow-square', // MAP_PACKERS key: 'square' | 'grow-hex' | 'grow-square' | 'disc'
  round: false,      // round dots (arcs) instead of squares
  crossBorder: true, // the grow packers treat Israel + Palestine as ONE region, so a
                     // blob grows straight through the line between them (the coast and
                     // the neighbours still stop it); off = a dot never crosses either
  roadW: 1.4,        // MAP_DETAILS.roads: screen-px width of a highway line
  sort: 'mix',       // colours inside a cluster: 'mix' (shuffled) | 'wedge' (blocks by angle) | 'ring' (by distance)
  hoverPad: 2,       // extra px of hit area around a dot for the hover tooltip
  hoverDim: 0.2,     // every OTHER dot's alpha while one is hovered (= HOVER_DIM_OPACITY in js/core.js, which loads after this file)
  morphMs: 600,      // dots glide to their new cells when the zoom re-packs the clusters
};
// The map's FOUR zoom stops — the wheel steps between them, one stop per
// gesture, and never lands anywhere in between. Each stop carries everything
// that used to be its own zoom threshold, so a level reads as one row instead
// of five numbers that have to be kept in order:
//   z         the zoom itself (1 = the fit-to-height view, the whole map)
//   countMin  a cluster is labelled with its size from this many events up
//   cities    how many city-label tiers are up (1 = the four majors only … 3 = all)
//   towns     MAP_DETAILS.labels' small towns are up
//   roads     MAP_DETAILS.roads' highways are drawn
//   hover     the dot tooltip answers
const MAP_ZOOM_LEVELS = [
  { z: 1,    countMin: 150, cities: 1, towns: false, roads: false, hover: false },
  { z: 2.35, countMin: 75,  cities: 3, towns: false, roads: true,  hover: false },
  { z: 6,    countMin: 120, cities: 3, towns: true,  roads: true,  hover: true  },
  { z: 16,   countMin: 120, cities: 3, towns: true,  roads: true,  hover: true  },
];
const p12MapClampLvl = i => Math.max(0, Math.min(MAP_ZOOM_LEVELS.length - 1, i));
// The stop the view is parked on, and the resting stop (MAP_TUNE.zoomLevel is 1-based).
const p12MapLevel = () => MAP_ZOOM_LEVELS[p12MapClampLvl(p12map.view.lvl)];
const p12MapRestIdx = () => p12MapClampLvl(MAP_TUNE.zoomLevel - 1);
// Optional map details, all off (unpicked compare/ candidates left behind their flags).
// All off = the shipped map.
const MAP_DETAILS = {
  water: false,   // Sea of Galilee + Dead Sea as filled shapes
  gaza: false,    // the Gaza Strip in its own tone
  labels: false,  // extra town labels that appear as the reader zooms in (MAP_TOWNS)
  scale: false,   // a km scale bar (bottom-left, screen space)
  count: true,    // the hover tooltip adds "N events at this spot" (cluster size)
  roads: false,   // the main highways (MAP_ROADS) — hand-traced, approximate
};
// Every colour the map paints. `bg` repaints the canvas ground under the map
// (the page's own is #FDFCFF, drawBackground in js/core.js); the dots keep their
// group colours from GROUPS and are not tunable here.
const MAP_COLORS = {
  bg: '#212121',
  israel: '#e8e8e8',
  palestine: '#e8e8e8',
  neighbour: '#454545',
  gaza: '#d6d6d6',
  border: '#c9c9c9',    // Israel/Palestine outline
  borderFar: '#363636', // the neighbours' outline
  water: '#dbe7f3',
  waterEdge: '#b9cde2',
  city: '#333',         // the tiered city labels
  town: '#666',         // MAP_DETAILS.labels towns
  count: '#222',        // the cluster counts
  road: '#e6ddcc',
};
// Main highways as hand-traced [lat, lon] polylines — COARSE, drawn from the
// route's shape at map scale, not from survey data. Never present them as exact.
const MAP_ROADS = [
  [[32.0700, 34.7900], [32.0300, 34.8800], [31.9500, 35.0000], [31.8400, 35.1200], [31.7800, 35.2000]],           // 1  Tel Aviv–Jerusalem
  [[32.8200, 34.9900], [32.5900, 34.9100], [32.3300, 34.8600], [32.1600, 34.8100], [32.0800, 34.7800]],           // 2  coastal, Haifa–Tel Aviv
  [[33.0000, 35.1000], [32.8200, 34.9900], [32.4400, 34.9200], [32.0200, 34.7700], [31.8000, 34.6800], [31.6700, 34.5700], [31.5200, 34.6000]], // 4
  [[32.4700, 35.0300], [32.1900, 34.9300], [31.9300, 34.9200], [31.7600, 34.8600], [31.6100, 34.8000]],           // 6  Cross-Israel
  [[33.2400, 35.5800], [32.7900, 35.5300], [32.5000, 35.5000], [31.8600, 35.4600], [31.4500, 35.4000], [30.9000, 35.1000], [29.5600, 34.9500]], // 90 Jordan Valley–Arava
  [[32.0900, 34.8900], [31.8900, 34.8100], [31.6100, 34.7700], [31.2500, 34.7900], [30.6100, 34.8000], [29.5600, 34.9500]], // 40
  [[32.2200, 35.2500], [31.9000, 35.2000], [31.7700, 35.2200], [31.7000, 35.2000], [31.5300, 35.0900]],           // 60 the spine, Nablus–Hebron
  [[31.2500, 34.7900], [31.2600, 35.2100], [31.2000, 35.3600]],                                                    // 31 Beer Sheva–Dead Sea
];
// Water bodies, hand-traced [lat, lon] rings (coarse — read at map scale only).
const MAP_WATER = [
  [[32.90, 35.59], [32.88, 35.63], [32.84, 35.65], [32.78, 35.64], [32.72, 35.60], [32.70, 35.57],
   [32.72, 35.54], [32.78, 35.52], [32.84, 35.53], [32.88, 35.56]],                       // Sea of Galilee
  [[31.77, 35.50], [31.73, 35.56], [31.62, 35.58], [31.50, 35.55], [31.40, 35.50], [31.33, 35.45],
   [31.25, 35.44], [31.15, 35.45], [31.05, 35.42], [31.05, 35.38], [31.15, 35.38], [31.25, 35.38],
   [31.35, 35.38], [31.45, 35.40], [31.55, 35.43], [31.65, 35.47], [31.72, 35.46]],       // Dead Sea
];
// Zoom-tiered towns: [minZoom, name, lat, lon] — shown from that zoom in.
const MAP_TOWNS = [
  [3, 'רמת גן', 32.07, 34.82], [3, 'פתח תקווה', 32.09, 34.89], [3, 'ראשון לציון', 31.97, 34.80],
  [3, 'אשקלון', 31.67, 34.57], [3, 'עכו', 32.93, 35.08], [3, 'הרצליה', 32.16, 34.84],
  [3, 'חולון', 32.02, 34.77], [3, 'מודיעין', 31.90, 35.01], [3, 'בית שמש', 31.75, 34.99],
  [3, 'קריית גת', 31.61, 34.77], [3, 'אום אל-פחם', 32.52, 35.15], [3, 'טול כרם', 32.31, 35.03],
  [3, 'יריחו', 31.86, 35.46], [3, 'דימונה', 31.07, 35.03], [3, 'עפולה', 32.61, 35.29],
  [3, 'כרמיאל', 32.92, 35.30], [3, 'צפת', 32.96, 35.50], [3, 'רהט', 31.39, 34.75],
  [3, 'חאן יונס', 31.34, 34.30], [3, 'רפיח', 31.29, 34.25], [3, 'מעלה אדומים', 31.78, 35.30],
  [3, 'אריאל', 32.10, 35.19], [3, 'ערד', 31.26, 35.21], [3, 'מצפה רמון', 30.61, 34.80],
  [5, 'שדרות', 31.52, 34.60], [5, 'כפר סבא', 32.18, 34.91], [5, 'רעננה', 32.18, 34.87],
  [5, 'קלקיליה', 32.19, 34.97], [5, 'סח׳נין', 32.86, 35.30], [5, 'באקה אל-גרבייה', 32.42, 35.04],
  [5, 'ג׳באליה', 31.53, 34.48], [5, 'קריית ארבע', 31.53, 35.12], [5, 'בת ים', 32.02, 34.75],
  [5, 'רחובות', 31.89, 34.81], [5, 'לוד', 31.95, 34.89], [5, 'רמלה', 31.93, 34.87],
  [5, 'חדרה', 32.44, 34.92], [5, 'נהריה', 33.01, 35.10], [5, 'טמרה', 32.85, 35.20],
  [5, 'קריית מלאכי', 31.73, 34.74], [5, 'נתיבות', 31.42, 34.59], [5, 'אופקים', 31.31, 34.62],
  [5, 'דיר אל-בלח', 31.42, 34.35], [5, 'בית ג׳אלא', 31.72, 35.19], [5, 'סלפית', 32.08, 35.18],
  [5, 'טובאס', 32.32, 35.37], [5, 'מטולה', 33.28, 35.58],
  [5, 'בית שאן', 32.50, 35.50], [5, 'יבנה', 31.88, 34.74], [5, 'גדרה', 31.81, 34.78],
  [5, 'קצרין', 32.99, 35.69], [5, 'עומר', 31.27, 34.85], [5, 'ירוחם', 30.99, 34.93],
];

// Build beats, as windows over p12map.t (raw progress, eased fresh per window).
const MAP_WIPE = { start: 0.00, len: 0.34 };   // outlines stroke on
const MAP_FILL = { start: 0.18, len: 0.26 };   // country fills come up
const MAP_FLY = { start: 0.30, len: 0.42 };   // extreme dots travel
const MAP_POP = { start: 0.55, len: 0.45 };   // legit dots scale up
const MAP_POP_STAGGER = 0.6;                  // share of the pop window spent staggering

// Hebrew labels, tiered by the build progress at which each appears (the map
// has one fixed scale, so the tiers are a reveal order, not a zoom level).
const MAP_CITIES = [
  [0.62, 'תל אביב', 32.0809, 34.7806], [0.62, 'ירושלים', 31.769, 35.2163],
  [0.62, 'חיפה', 32.8184, 34.9885], [0.62, 'באר שבע', 31.2518, 34.7913],
  [0.72, 'אילת', 29.5581, 34.9482], [0.72, 'שכם', 32.2211, 35.2544],
  [0.72, 'חברון', 31.5294, 35.0938], [0.72, 'עזה', 31.5017, 34.4668],
  [0.82, 'נתניה', 32.3329, 34.8599], [0.82, 'נצרת', 32.6993, 35.3048],
  [0.82, 'אשדוד', 31.7921, 34.6497], [0.82, 'רמאללה', 31.8996, 35.2042],
  [0.82, 'ג׳נין', 32.4594, 35.3009], [0.82, 'קריית שמונה', 33.2073, 35.572],
  [0.82, 'בית לחם', 31.7049, 35.2038], [0.82, 'טבריה', 32.7922, 35.5312],
];

const p12map = {
  ready: false,        // data fetched and parsed
  loading: false,
  geo: null,
  points: null,        // [[lat, lon], …] — the 904 distinct coordinates
  rowPt: null,         // Map(rowNum → point index)
  layout: null,        // built per canvas size + zoom by p12MapLayout
  t: 0,                // 0→1 build progress, written by foldMapTrigger's tick
  // The reader's view once the document has ended: screen = fit-view × z + pan.
  // The layout is built AT the zoom (clusters split as the reader zooms in,
  // dots grow up to MAP_TUNE.dotMax); the pan is a plain translate at draw time.
  view: { z: 1, px: 0, py: 0, lvl: 1 },   // lvl = index into MAP_ZOOM_LEVELS
  hovered: null,       // the dot ({e, x, y}) under the pointer on the finished map, or null
};

// ── Data ────────────────────────────────────────────────────────────────────

function p12MapLoad() {
  if (p12map.loading || p12map.ready) return;
  p12map.loading = true;
  Promise.all([
    fetch('map/region.geojson').then(r => r.json()),
    fetch('map/event-points.json').then(r => r.json()),
  ]).then(([geo, ev]) => {
    p12map.geo = geo;
    p12map.points = ev.points;
    p12map.rowPt = new Map();
    for (let i = 0; i < ev.rows.length; i++) p12map.rowPt.set(ev.rows[i], ev.pt[i]);
    p12map.ready = true;
    p12map.layout = null;
    if (currentPage === 12 || currentPage === 13) draw();
  }).catch(err => console.warn('map: data failed to load', err));
}

// The point index for one events.json event, via its stable `row-N` id.
function p12MapPointOf(e) {
  const n = parseInt(String(e.rowId).slice(4), 10);
  return p12map.rowPt.get(n);
}

// ── Clustering ──────────────────────────────────────────────────────────────
// The 904 distinct coordinates are grouped into the blobs the packer then fills.
// `places` are {x, y, events} in zoomed px; the result is {x, y, events} with x/y
// the event-weighted centroid. MAP_TUNE.cluster picks the method:
//   grid  square buckets of cellBase        hex   hex buckets of cellBase (no seams)
//   link  greedy join within linkPx         city  nearest labelled city, always
//   none  one cluster per coordinate
// cityKm (any method but 'city') pulls points that close to a city into it first,
// and minCluster then folds the leftovers under N events into their nearest neighbour.
function p12MapCluster(places, cities, kmPx) {
  const mode = MAP_TUNE.cluster;
  // The bucket in px: cellBase is screen px by default (clusters re-form as the
  // reader zooms), or km on the ground with cellKm on (the same points always
  // stay together, and the blobs just grow with the map).
  const cell = Math.max(1, MAP_TUNE.cellKm ? MAP_TUNE.cellBase * kmPx : MAP_TUNE.cellBase);
  const cityR2 = (MAP_TUNE.cityKm * kmPx) ** 2;
  const buckets = new Map();
  const add = (key, p) => {
    let b = buckets.get(key);
    if (!b) buckets.set(key, b = { events: [], x: 0, y: 0, n: 0 });
    b.events.push(...p.events);
    b.x += p.x * p.events.length; b.y += p.y * p.events.length; b.n += p.events.length;
  };
  const nearestCity = (p, r2) => {
    let key = null, best = r2;
    for (const c of cities) {
      const d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2;
      if (d < best) { best = d; key = 'city:' + c.name; }
    }
    return key;
  };
  let cl;
  if (mode === 'link') {
    // Greedy single-link: the biggest places seed the clusters, everything else
    // joins the first seed within linkPx (cheap, order-stable, no re-pass).
    const r2 = MAP_TUNE.linkPx ** 2, seeds = [];
    for (const p of [...places].sort((a, b) => b.events.length - a.events.length)) {
      let hit = null;
      for (const s of seeds) if ((s.x - p.x) ** 2 + (s.y - p.y) ** 2 < r2) { hit = s; break; }
      if (!hit) seeds.push(hit = { x: p.x, y: p.y, events: [], n: 0 });
      hit.events.push(...p.events); hit.n += p.events.length;
    }
    cl = seeds.map(s => ({ events: s.events, x: s.x, y: s.y }));
  } else {
    for (const p of places) {
      let key = mode === 'city' ? nearestCity(p, Infinity) : (cityR2 ? nearestCity(p, cityR2) : null);
      if (!key) {
        if (mode === 'none') key = 'p:' + p.x + ',' + p.y;
        else if (mode === 'hex') {
          // Pointy-top axial binning: no straight cell edges to cut a town in two.
          const s = cell / Math.sqrt(3);
          const q = (Math.sqrt(3) / 3 * p.x - p.y / 3) / s, r = (2 / 3 * p.y) / s;
          let [rq, rr, rs] = [Math.round(q), Math.round(r), Math.round(-q - r)];
          const [dq, dr, ds] = [Math.abs(rq - q), Math.abs(rr - r), Math.abs(rs + q + r)];
          if (dq > dr && dq > ds) rq = -rr - rs; else if (dr > ds) rr = -rq - rs;
          key = rq + ':' + rr;
        } else key = Math.floor(p.x / cell) + ',' + Math.floor(p.y / cell);
      }
      add(key, p);
    }
    cl = [...buckets.values()].map(b => ({ events: b.events, x: b.x / b.n, y: b.y / b.n }));
  }
  return MAP_TUNE.minCluster > 1 ? p12MapMergeSmall(cl, MAP_TUNE.minCluster) : cl;
}

// Clusters under `min` events fold into their nearest neighbour, smallest first,
// so a big blob isn't ringed by single stray dots.
function p12MapMergeSmall(cl, min) {
  const live = cl.map(c => ({ events: c.events, x: c.x, y: c.y, dead: false }));
  const small = live.filter(c => c.events.length < min).sort((a, b) => a.events.length - b.events.length);
  for (const c of small) {
    if (c.dead || c.events.length >= min) continue;
    let best = null, bd = Infinity;
    for (const o of live) {
      if (o === c || o.dead) continue;
      const d = (o.x - c.x) ** 2 + (o.y - c.y) ** 2;
      if (d < bd) { bd = d; best = o; }
    }
    if (!best) continue;
    const n1 = best.events.length, n2 = c.events.length;
    best.x = (best.x * n1 + c.x * n2) / (n1 + n2);
    best.y = (best.y * n1 + c.y * n2) / (n1 + n2);
    best.events.push(...c.events);
    c.dead = true;
  }
  return live.filter(c => !c.dead).map(c => ({ events: c.events, x: c.x, y: c.y }));
}

// The cluster size from which a count is written — the current zoom stop's own
// cutoff (MAP_ZOOM_LEVELS), not a threshold compared against the zoom number.
function p12MapCountMin() {
  if (!MAP_TUNE.counts) return Infinity;
  return p12MapLevel().countMin;
}

// ── Layout ──────────────────────────────────────────────────────────────────

// Everything geometric is rebuilt whenever the canvas size or the zoom
// changes: the projection, the country rings (with their path lengths, for the
// wipe), the clusters, and every event's own target cell inside its cluster's
// square. Coordinates come out in zoomed screen px, pan NOT applied.
function p12MapLayout(W, H) {
  // The extreme roster (p9.leftTopOrder) is filled by @fold11's categorisation
  // and can change after a first build, so it is part of the cache key — the
  // fly/pop split depends on it.
  const nx = (p9.leftTopOrder || []).length + (p9.rightTopOrder || []).length;
  const z = p12map.view.z;
  const L = p12map.layout;
  const same = L && L.W === W && L.H === H && L.nx === nx;
  if (same && L.z === z) return L;
  // Mid-gesture (p12MapZoomHold): the finished map keeps its last pack and is
  // drawn scaled (drawFoldMap) — the re-pack waits for the wheel to go quiet.
  if (same && p12MapZoomHold && p12map.t >= 1) return L;
  // A zoom re-pack on a finished map: remember where every dot is showing
  // RIGHT NOW (mid-glide included), scaled into the new zoom's px, so the new
  // layout can glide from there instead of snapping (p12MapMorph).
  let prev = null;
  if (L && L.W === W && L.H === H && L.nx === nx && p12map.t >= 1) {
    const k = z / L.z, mk = p12MapMorphK(), h = L.dot / 2;
    prev = new Map();
    for (const m of [L.pop, L.fly]) for (const [, dots] of m) for (const d of dots) {
      const x = d.fx == null ? d.x : d.fx + (d.x - d.fx) * mk;
      const y = d.fy == null ? d.y : d.fy + (d.y - d.fy) * mk;
      prev.set(d.e, [(x + h) * k, (y + h) * k]);   // dot centre, new-zoom px
    }
  }

  // Equirectangular with a cos(mid-latitude) correction, fit to the canvas
  // height at zoom 1; the width just decides how much sea and neighbour shows.
  const lat0 = 29.45, lat1 = 33.35, lon0 = 34.2, lon1 = 35.95;
  const kx = Math.cos((lat0 + lat1) / 2 * Math.PI / 180);
  const s0 = H / (lat1 - lat0) * z;
  const mapW = (lon1 - lon0) * kx * s0;
  const bx = lon => (lon - lon0) * kx * s0 + (W * z - mapW) / 2;
  const by = lat => (lat1 - lat) * s0;
  const kmPx = s0 / 111;   // 1° of latitude ≈ 111 km
  // Dots grow with the zoom (capped), the gap stays a fixed share of a dot.
  const DOT = Math.min(MAP_TUNE.dot * Math.pow(z, MAP_TUNE.dotGrow), MAP_TUNE.dotMax);
  const GAP = DOT * MAP_TUNE.gapRatio;

  // Neighbours first, so the two subjects' strokes sit on top of the shared
  // borders rather than under them. Each ring carries its own path length so
  // the wipe can dash it on at its own rate.
  const MAIN = { Israel: 1, Palestine: 1 };
  const polys = p12map.geo.features
    .slice()
    .sort((a, b) => (a.properties.name in MAIN) - (b.properties.name in MAIN))
    .map(f => ({
      name: f.properties.name,
      main: f.properties.name in MAIN,
      rings: (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates)
        .flat().map(r => {
          const pts = r.map(([lon, lat]) => [bx(lon), by(lat)]);
          let len = 0;
          for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
          // The Gaza Strip is the Palestine ring that lies west of lon 34.6 (MAP_DETAILS.gaza).
          const gaza = f.properties.name === 'Palestine' && r.every(([lon]) => lon < 34.6);
          return { pts, len: len || 1, gaza };
        }),
    }));

  const cities = MAP_CITIES.map(([at, name, lat, lon]) => ({ at, name, x: bx(lon), y: by(lat) }));
  // compare/ candidates (MAP_DETAILS): projected once per layout, drawn only when on.
  const towns = MAP_TOWNS.map(([minZ, name, lat, lon]) => ({ minZ, name, x: bx(lon), y: by(lat) }));
  const water = MAP_WATER.map(ring => ring.map(([lat, lon]) => [bx(lon), by(lat)]));
  const roads = MAP_ROADS.map(line => line.map(([lat, lon]) => [bx(lon), by(lat)]));

  // One place per coordinate, holding the events that sit on it.
  const byPoint = new Map();
  const all = [...(p7.leftEvents || []), ...(p7.rightEvents || [])];
  for (const e of all) {
    const pi = p12MapPointOf(e);
    if (pi === undefined) continue;
    let p = byPoint.get(pi);
    if (!p) byPoint.set(pi, p = { x: bx(p12map.points[pi][1]), y: by(p12map.points[pi][0]), events: [] });
    p.events.push(e);
  }
  const places = [...byPoint.values()];

  const cl = p12MapCluster(places, cities, kmPx);

  // Every event gets its own cell (top-left of the dot) from the packer,
  // ordered by group color so each group reads as a block within its cluster.
  const packer = MAP_PACKERS[MAP_TUNE.shape] || MAP_PACKERS['grow-hex'];
  const slots = packer(cl, { W: W * z, H: H * z, DOT, GAP, polys });
  // Cluster size per event, for the tooltip's "N events here" (MAP_DETAILS.count).
  const sizeOf = new Map();
  for (const c of cl) for (const e of c.events) sizeOf.set(e, c.events.length);
  // The big clusters' counts (the zoom tier's countMin*), written over their centroid.
  // EVERY cluster's centroid + size; the zoom tier's cutoff (p12MapCountMin) is
  // applied at draw time, so the count knobs act without a re-pack and the
  // numbers thin out live during a wheel gesture.
  const marks = cl.map(c => ({ x: c.x, y: c.y, n: c.events.length }));
  // Draw lists, built once and grouped by color: the build repaints 14,451
  // squares per frame, and setting fillStyle per square is what makes that
  // expensive — one fillStyle per color and a run of fillRects is not.
  // `pop` also carries each dot's own stagger offset, so the draw loop does no
  // hashing; `fly` carries its freeform start, resolved fresh each frame since
  // p12EnsureFreeformTargets rebuilds on resize.
  const extreme = new Set([...(p9.leftTopOrder || []), ...(p9.rightTopOrder || [])]);
  const pop = new Map(), fly = new Map();   // color → array of dots
  let i = 0;
  for (const [e, s] of slots) {
    const col = p7ActorColor(e.actor);
    const into = extreme.has(e) ? fly : pop;
    let arr = into.get(col);
    if (!arr) into.set(col, arr = []);
    // Deterministic scatter — a hash of the index, so the fill-in order looks
    // random but is identical on every replay.
    // MAP_TUNE.jitter loosens the lattice: a fixed pseudo-random offset per dot,
    // as a share of the pitch, so a cluster reads as a scatter rather than a grid.
    const h1 = (i * 374761393 + 668265263) % 1000, h2 = (i * 2246822519 + 3266489917) % 1000;
    const jx = MAP_TUNE.jitter ? (h1 / 1000 - 0.5) * (DOT + GAP) * MAP_TUNE.jitter : 0;
    const jy = MAP_TUNE.jitter ? (h2 / 1000 - 0.5) * (DOT + GAP) * MAP_TUNE.jitter : 0;
    const d = { e, x: s.x + jx, y: s.y + jy, n: sizeOf.get(e) || 1, off: ((i++ * 2654435761) % 1000) / 1000 };
    const p = prev && prev.get(e);
    if (p) { d.fx = p[0] - DOT / 2; d.fy = p[1] - DOT / 2; }
    arr.push(d);
  }
  if (prev) p12MapMorphStart();
  p12map.hovered = null;
  requestAnimationFrame(() => p12MapRecheckHover());

  return (p12map.layout = { W, H, nx, z, dot: DOT, kmPx, polys, cities, towns, water, roads, pop, fly, marks });
}

// ── Zoom morph ──────────────────────────────────────────────────────────────
// The layout is rebuilt at every zoom step, and clusters split/merge as the
// bucket size changes in map km — so a dot's cell can jump. Position never
// snaps: each dot carries the cell it was showing in (`fx`/`fy`, in the new
// zoom's px) and glides to its new one over MAP_TUNE.morphMs on p9Ease.
// Another zoom step mid-glide re-bases from the interpolated position.
let p12MapMorphT0 = 0;
function p12MapMorphK() {
  if (!p12MapMorphT0) return 1;
  const raw = (performance.now() - p12MapMorphT0) / MAP_TUNE.morphMs;
  return raw >= 1 ? 1 : p9Ease(Math.max(0, raw));
}
function p12MapMorphStart() {
  const running = p12MapMorphT0 > 0;
  p12MapMorphT0 = performance.now();
  if (running) return;
  const tick = () => {
    if (!p12MapMorphT0) return;
    if (performance.now() - p12MapMorphT0 >= MAP_TUNE.morphMs) { p12MapMorphT0 = 0; draw(); return; }
    draw();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ── Packers ─────────────────────────────────────────────────────────────────
//
// A packer turns the clusters ({events, x, y} — the seed is the events'
// centroid) into a Map(event → {x, y}) of dot top-lefts, in zoomed screen px.
// Every packer sorts a cluster's events by group colour first so each group
// reads as one block inside its cluster.

function p12MapSortByColor(events) {
  if (MAP_TUNE.sort === 'mix') {
    // Deterministic shuffle keyed on the stable row id, so the groups
    // intermingle inside a cluster and the mix is identical on every build.
    const key = e => (parseInt(String(e.rowId).slice(4), 10) * 2654435761) >>> 0;
    return events.slice().sort((a, b) => key(a) - key(b));
  }
  return events.slice().sort((a, b) => {
    const ca = p7ActorColor(a.actor), cb = p7ActorColor(b.actor);
    return ca < cb ? -1 : ca > cb ? 1 : 0;
  });
}

// 'square' — the packed-square reference: a ceil(√n)-sided grid centred on the
// seed. Squares that would touch merge into one (the pass repeats while
// anything merged, since a merge enlarges the square), so nothing overdraws —
// but a square knows nothing of borders and spills over the coast.
function p12MapPackSquare(clusters, g) {
  const { DOT, GAP } = g;
  const pitch = DOT + GAP;
  let cl = clusters.slice();
  const boxOf = n => Math.ceil(Math.sqrt(n)) * pitch - GAP;
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < cl.length; i++) {
      let a = cl[i];
      if (!a) continue;
      for (let j = i + 1; j < cl.length; j++) {
        const b = cl[j];
        if (!b) continue;
        const lim = (boxOf(a.events.length) + boxOf(b.events.length)) / 2 + GAP;
        if (Math.abs(a.x - b.x) < lim && Math.abs(a.y - b.y) < lim) {
          const na = a.events.length, nb = b.events.length, n = na + nb;
          a = cl[i] = {
            events: a.events.concat(b.events),
            x: (a.x * na + b.x * nb) / n, y: (a.y * na + b.y * nb) / n,
          };
          cl[j] = null; merged = true;
        }
      }
    }
    cl = cl.filter(Boolean);
  }
  const slots = new Map();
  for (const c of cl) {
    const ev = p12MapSortByColor(c.events);
    const side = Math.ceil(Math.sqrt(ev.length));
    const off = (side * pitch - GAP) / 2;
    ev.forEach((e, i) => {
      slots.set(e, { x: c.x - off + (i % side) * pitch, y: c.y - off + ((i / side) | 0) * pitch });
    });
  }
  return slots;
}

// 'disc' — a sunflower spiral per cluster: the i-th dot sits at angle i×137.5°
// and radius ∝ √i, so a cluster reads as a round blob of even density with no
// lattice rows at all. Like 'square' it ignores the coastline, and overlapping
// clusters simply interleave rather than merging.
function p12MapPackDisc(clusters, g) {
  const pitch = g.DOT + g.GAP;
  const GOLD = Math.PI * (3 - Math.sqrt(5));
  const slots = new Map();
  for (const c of clusters) {
    const ev = p12MapSortByColor(c.events);
    ev.forEach((e, i) => {
      const r = pitch * 0.62 * Math.sqrt(i), a = i * GOLD;
      slots.set(e, { x: c.x + r * Math.cos(a) - g.DOT / 2, y: c.y + r * Math.sin(a) - g.DOT / 2 });
    });
  }
  return slots;
}

// The region mask: which country each lattice cell's CENTRE lies in, read
// off one offscreen raster of the two main outlines (1 = Israel, 2 =
// Palestine, 0 = sea / neighbour). Rasterised at the lattice's own pitch — at
// twice the horizontal resolution for the hex lattice, whose odd rows sit
// half a pitch over — so point-in-polygon for 14k dots is an array lookup.
function p12MapRegionMask(g, pitch, hex) {
  const rowH = hex ? pitch * 0.8660254 : pitch;
  const cols = Math.ceil(g.W / pitch) + 2, rows = Math.ceil(g.H / rowH) + 2;
  const sub = hex ? 2 : 1;
  const cv = document.createElement('canvas');
  cv.width = cols * sub; cv.height = rows;
  const c = cv.getContext('2d', { willReadFrequently: true });
  // Raster pixel (i, j) has its centre at (i + .5, j + .5); lattice cell (i, j)
  // has its centre at (i · pitch/sub, j · rowH). Map one onto the other.
  c.setTransform(sub / pitch, 0, 0, 1 / rowH, 0.5, 0.5);
  const ids = { Israel: '#ff0000', Palestine: '#00ff00' };
  for (const p of g.polys) {
    if (!p.main) continue;
    c.fillStyle = ids[p.name] || '#0000ff';
    c.beginPath();
    for (const r of p.rings) { r.pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); }
    c.fill();
  }
  const px = c.getImageData(0, 0, cv.width, cv.height).data;
  const region = new Uint8Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = (j * cv.width + i * sub + (hex ? j & 1 : 0)) * 4;
      const r = px[k], gr = px[k + 1], b = px[k + 2];
      region[j * cols + i] = r > 127 ? 1 : gr > 127 ? 2 : b > 127 ? 3 : 0;
    }
  }
  return {
    cols, rows, rowH, hex, pitch, region,
    at: (i, j) => (i < 0 || j < 0 || i >= cols || j >= rows) ? 0 : region[j * cols + i],
    cx: (i, j) => (i + (hex && (j & 1) ? 0.5 : 0)) * pitch,
    cy: j => j * rowH,
  };
}

// A country's fill, resolved at DRAW time — MAP_COLORS is read every frame, so
// a palette change lands on the next repaint without a re-pack.
function p12MapFill(p) {
  return p.name === 'Israel' ? MAP_COLORS.israel
    : p.name === 'Palestine' ? MAP_COLORS.palestine
    : MAP_COLORS.neighbour;
}

// Binary min-heap of [key, i, j] — the growth frontier.
function p12MapHeap() {
  const a = [];
  const up = k => { for (let p; k > 0 && a[(p = (k - 1) >> 1)][0] > a[k][0]; k = p) [a[p], a[k]] = [a[k], a[p]]; };
  const down = k => {
    for (;;) {
      const l = 2 * k + 1, r = l + 1;
      let m = k;
      if (l < a.length && a[l][0] < a[m][0]) m = l;
      if (r < a.length && a[r][0] < a[m][0]) m = r;
      if (m === k) return;
      [a[m], a[k]] = [a[k], a[m]]; k = m;
    }
  };
  return {
    size: () => a.length,
    push: v => { a.push(v); up(a.length - 1); },
    pop: () => { const top = a[0], last = a.pop(); if (a.length) { a[0] = last; down(0); } return top; },
  };
}

// 'grow-hex' / 'grow-square' — each cluster grows from its seed cell outward
// across one shared lattice, always taking the free cell nearest its seed,
// but only cells inside the SAME country as the seed: a blob hugs the coast
// and the border instead of crossing them, and abuts its neighbours since a
// claimed cell is never claimed twice. Largest clusters first, so a city
// keeps its compact core. A seed off the land (a beach coordinate) is moved
// to the nearest land cell first. Inside a cluster the cells are handed to
// the colour-sorted events by angle (`wedge`) or distance (`ring`).
function p12MapPackGrow(hex) {
  return function (clusters, g) {
    const { DOT, GAP } = g;
    const pitch = DOT + GAP;
    const M = p12MapRegionMask(g, pitch, hex);
    const { cols, rows } = M;
    const claimed = new Uint8Array(cols * rows);
    const seen = new Int32Array(cols * rows).fill(-1);   // per (cluster, pass) visit stamp
    const slots = new Map();
    const half = DOT / 2;
    // Neighbour offsets: 4 on the square lattice; 6 on the hex one, where the
    // diagonal pair depends on the row's parity.
    const nb = hex
      ? [[[-1, 0], [1, 0], [-1, -1], [0, -1], [-1, 1], [0, 1]],     // even rows
         [[-1, 0], [1, 0], [0, -1], [1, -1], [0, 1], [1, 1]]]       // odd rows
      : [[[-1, 0], [1, 0], [0, -1], [0, 1]], [[-1, 0], [1, 0], [0, -1], [0, 1]]];

    const order = clusters.slice().sort((a, b) => b.events.length - a.events.length);
    order.forEach((c, ci) => {
      const n = c.events.length;
      const d2 = (i, j) => (M.cx(i, j) - c.x) ** 2 + (M.cy(j) - c.y) ** 2;
      // Seed cell: the nearest lattice cell to the centroid; if that is not
      // land, the nearest land cell in a widening square search.
      let si = Math.round(c.x / pitch), sj = Math.round(c.y / M.rowH);
      let region = M.at(si, sj);
      for (let r = 1; !region && r < 80; r++) {
        let best = Infinity, bi = 0, bj = 0;
        for (let j = sj - r; j <= sj + r; j++) {
          for (let i = si - r; i <= si + r; i++) {
            if (Math.abs(i - si) !== r && Math.abs(j - sj) !== r) continue;
            if (!M.at(i, j)) continue;
            const d = d2(i, j);
            if (d < best) { best = d; bi = i; bj = j; }
          }
        }
        if (best < Infinity) { si = bi; sj = bj; region = M.at(si, sj); }
      }
      // Growth in three widening passes: the seed's own country first; if
      // that fills up (at zoom 1 Israel holds ~12k cells for 14k events), any
      // land; and only then the sea — so a dot leaves its borders only when
      // there is truly no room inside them.
      const cells = [];
      for (let pass = 0; pass < 3 && cells.length < n; pass++) {
        // `crossBorder`: Israel (1) and Palestine (2) count as ONE region, so a
        // blob grows straight through the line between them and only the coast
        // and the neighbours still stop it.
        const IL = MAP_TUNE.crossBorder && region < 3
          ? r => r === 1 || r === 2
          : r => r === region;
        const ok = pass === 0 ? IL : pass === 1 ? r => r > 0 : () => true;
        const stamp = ci * 3 + pass;
        const heap = p12MapHeap();
        const visit = (i, j) => {
          if (i < 0 || j < 0 || i >= cols || j >= rows) return;
          const k = j * cols + i;
          if (seen[k] === stamp) return;
          seen[k] = stamp;
          if (!ok(M.region[k])) return;   // never step across a border in this pass
          heap.push([d2(i, j), i, j]);
        };
        visit(si, sj);
        while (cells.length < n && heap.size()) {
          const [, i, j] = heap.pop();
          const k = j * cols + i;
          if (!claimed[k]) { claimed[k] = 1; cells.push([i, j]); }
          for (const [di, dj] of nb[j & 1]) visit(i + di, j + dj);
        }
      }
      const key = MAP_TUNE.sort === 'ring'
        ? ([i, j]) => d2(i, j)
        : ([i, j]) => Math.atan2(M.cy(j) - c.y, M.cx(i, j) - c.x);
      cells.sort((a, b) => key(a) - key(b));
      p12MapSortByColor(c.events).forEach((e, q) => {
        const [i, j] = cells[q];
        slots.set(e, { x: M.cx(i, j) - half, y: M.cy(j) - half });
      });
    });
    return slots;
  };
}

const MAP_PACKERS = {
  'square': p12MapPackSquare,
  'grow-hex': p12MapPackGrow(true),
  'grow-square': p12MapPackGrow(false),
  'disc': p12MapPackDisc,
};

// ── Zoom + pan, once the document has ended ─────────────────────────────────
//
// The outro card scrolls past (its section is 200vh, style.css) and leaves one
// clear viewport of the finished map at the document's last pixel. THERE — and
// only there, with the build settled at 1 — the wheel stops scrolling and
// drives the map: wheel-down zooms in toward the cursor, wheel-up zooms out,
// and at zoom 1 a wheel-up is left alone so the page scrolls back up normally.
// Dragging pans while zoomed. Pan is clamped so the map always covers the
// viewport (no edge of nothing).
const p12MapAtEnd = () =>
  // `>= 12`, not `=== 13`: #page-13 is only padTop + peek tall now (the card
  // is a fixed drawer), so it never crosses the observer's centre line and
  // currentPage stays 12 at the document's end.
  currentPage >= 12 && p12map.ready && p12map.t >= 1 &&
  window.scrollY >= document.documentElement.scrollHeight - window.innerHeight - 1;

// The docked @fold14 drawer covers the viewport's bottom strip, so the pan
// may push the map up by that much beyond the edge: the covered part is reachable.
const p12MapPeek = () =>
  (typeof p13Drawer !== 'undefined' && window.innerWidth > 600) ? p13Drawer.peek() : 0;
function p12MapClampPan(W, H) {
  const v = p12map.view;
  v.px = Math.min(0, Math.max(W - W * v.z, v.px));
  v.py = Math.min(0, Math.max(H - H * v.z - p12MapPeek(), v.py));
}
// Is there anywhere to pan to? (zoomed in, or the drawer covers some map even at rest)
const p12MapCanPan = () =>
  p12MapAtEnd() && (p12map.view.z > 1 || p12MapPeek() > 0);

// A wheel gesture is dozens of events a second and a re-pack is 100–350ms of
// mask + growth packing, so the pack is held while the wheel is moving: the
// frames in between scale the last layout, and one re-pack (with its morph
// glide) runs MAP_ZOOM_SETTLE_MS after the last event.
const MAP_ZOOM_SETTLE_MS = 120;
let p12MapZoomHold = false, p12MapZoomTimer = 0;
function p12MapZoomTouch() {
  p12MapZoomHold = true;
  clearTimeout(p12MapZoomTimer);
  p12MapZoomTimer = setTimeout(() => { p12MapZoomHold = false; draw(); }, MAP_ZOOM_SETTLE_MS);
}
// The wheel STEPS between MAP_ZOOM_LEVELS, one stop per gesture: a trackpad
// flick is dozens of events, so a step arms a cooldown and the rest of the
// flick is swallowed. Wheel-UP steps in, wheel-down steps out; at the first
// stop a wheel-down is left alone (the way back up the page is #p13Back).
const MAP_STEP_MS = 320;
let p12MapStepAt = 0;
function p12MapWheel(e) {
  if (!p12MapAtEnd() || isMobile()) return;
  if (e.target.closest && e.target.closest('.hp')) return;   // a _debug-* harness panel scrolls itself
  const v = p12map.view, i = p12MapClampLvl(v.lvl);
  const dir = e.deltaY > 0 ? -1 : 1;
  if (dir < 0 && i === 0) return;
  e.preventDefault();
  const now = performance.now();
  if (now - p12MapStepAt < MAP_STEP_MS) return;              // still inside one gesture
  const j = p12MapClampLvl(i + dir);
  if (j === i) return;
  p12MapStepAt = now;
  p12MapGoLevel(j, e.clientX, e.clientY);
}

// Park the view on a stop. The point under the cursor stays under it (the
// resting stop re-centres instead, so backing off always lands on the same view).
function p12MapGoLevel(j, cx, cy) {
  const v = p12map.view, z1 = MAP_ZOOM_LEVELS[j].z, k = z1 / v.z;
  v.lvl = j;
  v.px = cx - (cx - v.px) * k;
  v.py = cy - (cy - v.py) * k;
  v.z = z1;
  p12MapZoomTouch();
  if (j === p12MapRestIdx()) { p12MapResetView(); return draw(); }
  p12MapClampPan(canvas.clientWidth, canvas.clientHeight);
  p12MapSyncCursor();
  draw();
}

let p12MapDrag = null;   // {x, y, px, py} while a pan drag is in flight
function p12MapPointerDown(e) {
  if (!p12MapCanPan() || e.button !== 0) return;
  if (e.target.closest && e.target.closest('#page-13 .text-card, .hp')) return;   // the drawer's own text / a _debug-* harness panel
  p12MapDrag = { x: e.clientX, y: e.clientY, px: p12map.view.px, py: p12map.view.py };
  document.documentElement.style.cursor = 'grabbing';
  e.preventDefault();
}
function p12MapPointerMove(e) {
  if (!p12MapDrag) return;
  p12map.view.px = p12MapDrag.px + (e.clientX - p12MapDrag.x);
  p12map.view.py = p12MapDrag.py + (e.clientY - p12MapDrag.y);
  p12MapClampPan(canvas.clientWidth, canvas.clientHeight);
  draw();
}
function p12MapPointerUp() {
  if (!p12MapDrag) return;
  p12MapDrag = null;
  p12MapSyncCursor();
}
function p12MapSyncCursor() {
  if (p12map.hovered) return;   // the hover owns the cursor while a dot is under it
  document.documentElement.style.cursor =
    p12MapCanPan() ? 'grab' : '';
}
// The resting view: the MAP_TUNE.zoomLevel stop, with the fit-view point (startX, startY)
// under the viewport's centre (then clamped like a pan).
function p12MapResetView() {
  const v = p12map.view, i = p12MapRestIdx(), z = MAP_ZOOM_LEVELS[i].z;
  v.lvl = i;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  v.z = z; v.px = W / 2 - MAP_TUNE.startX * W * z; v.py = H / 2 - MAP_TUNE.startY * H * z;
  p12MapClampPan(W, H);
  p12MapSyncCursor();
}

window.addEventListener('wheel', p12MapWheel, { passive: false });
window.addEventListener('scroll', p12MapSyncCursor, { passive: true });
window.addEventListener('pointerdown', p12MapPointerDown);
window.addEventListener('pointermove', p12MapPointerMove);
window.addEventListener('pointerup', p12MapPointerUp);
window.addEventListener('pointercancel', p12MapPointerUp);

// ── Hover ───────────────────────────────────────────────────────────────────
// On the finished map (t ≥ 1, @fold13/@fold14 on screen, desktop) every dot is
// a hover target: the shared #page9Tooltip shows its date + description, tinted
// in the group colour, and the dot itself gets a ring (drawFoldMap). The hit
// test walks the draw lists — 14k distance checks per move is cheap.
function p12MapHoverInit() {
  const tip = document.getElementById('page9Tooltip');
  if (!tip) return;
  const dateEl = tip.querySelector('.page9-tooltip-date');
  const descEl = tip.querySelector('.page9-tooltip-desc');
  const GAP = 5;          // px between the dot and the box
  const FLIP_Y = 295;     // the same line the timeline's tooltip flips on
  let lastX = null, lastY = null;

  const active = () => !isMobile() && p12map.ready && p12map.t >= 1 &&
    (currentPage === 12 || currentPage === 13) && !p12MapDrag && !p12MapZoomHold &&
    p12MapLevel().hover;

  function hide() {
    if (!p12map.hovered) return;
    p12map.hovered = null;
    tip.classList.remove('is-visible');
    tip.style.opacity = '';   // the fade writer takes it back on the next scroll
    p12MapSyncCursor();       // back to the pan hand
    draw();
  }

  function test() {
    if (!active() || lastX == null) { hide(); return; }
    const L = p12map.layout;
    if (!L) { hide(); return; }
    const rect = canvas.getBoundingClientRect();
    const mx = lastX - rect.left - p12map.view.px, my = lastY - rect.top - p12map.view.py;
    const half = L.dot / 2, r = half + MAP_TUNE.hoverPad;
    let best = null, bestD = r * r;
    for (const m of [L.pop, L.fly]) for (const [, dots] of m) for (const d of dots) {
      const dx = mx - (d.x + half), dy = my - (d.y + half);
      const dd = dx * dx + dy * dy;
      if (dd < bestD) { bestD = dd; best = d; }
    }
    if (!best) { hide(); return; }
    if (p12map.hovered !== best) { p12map.hovered = best; draw(); }
    document.documentElement.style.cursor = '';   // a normal arrow over a dot, not the pan hand

    const e = best.e;
    dateEl.textContent = p7FormatDateDMY(e.date);
    descEl.textContent = e.descHeMedium;
    // compare/ candidate (MAP_DETAILS.count): how many events share this cluster.
    if (MAP_DETAILS.count && best.n > 1) descEl.textContent += ` · ${best.n} אירועים במקום זה`;
    setTooltipColor(tip, p7ActorColor(e.actor));
    // @fold12's fade-out (js/fold11.js) leaves the shared tooltip at inline
    // opacity 0 once the map is on screen; the map's own hover overrides it.
    tip.style.opacity = '1';
    tip.classList.add('is-visible');
    const cx = rect.left + best.x + p12map.view.px + half;
    const cy = rect.top + best.y + p12map.view.py + half;
    // Opens to the right of the dot; to the left when it would not fit.
    let mirrored = cx + GAP + tip.offsetWidth > window.innerWidth - 8;
    tip.classList.toggle('is-mirrored', mirrored);
    const left = Math.max(8, mirrored ? cx - half - GAP - tip.offsetWidth : cx + half + GAP);
    const flipped = cy < FLIP_Y;
    tip.classList.toggle('is-flipped', flipped);
    const top = flipped ? cy + half + GAP : cy - half - GAP - tip.offsetHeight;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    updateTooltipDash(tip);
  }

  window.addEventListener('pointermove', e => { lastX = e.clientX; lastY = e.clientY; test(); }, { passive: true });
  window.addEventListener('pointerdown', () => { if (p12MapDrag) hide(); });
  window.addEventListener('scroll', () => { if (!active()) hide(); }, { passive: true });
  document.addEventListener('pointerleave', hide);
  p12MapRecheckHover = test;
}
let p12MapRecheckHover = () => {};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', p12MapHoverInit);
else p12MapHoverInit();

// ── Trigger → build progress ────────────────────────────────────────────────
//
// The build is a fold TRIGGER, not a scrub: `foldMapTrigger` (js/groups.js,
// with every other fold trigger) fires when @fold13's share card crosses the
// house 0.5 line, and plays the whole build — outlines, flight, pops — over
// FOLD_MAP_MS regardless of how the reader scrolls. Reversible: scrolling back
// above the crossing plays it backwards over the remaining distance. Its tick
// writes the RAW progress into p12map.t (each beat eases its own window).
const FOLD_MAP_MS = 5200;   // named exception to GROUP_TRANSITION_MS: three beats, 14k dots

function p12MapTick() {
  p12map.t = foldMapTrigger.currentRaw();
  // A reversed build (scrolled back above the crossing) plays at the resting
  // view (the MAP_TUNE.zoomLevel stop, centred); the extreme dots' flight starts from
  // @fold12's screen positions, offset into the view.
  if (p12map.t < 1) p12MapResetView();
  else p12MapSyncCursor();   // the finished map: the pan hand, if there is anywhere to pan
  if (currentPage === 12 || currentPage === 13) draw();
}

// Prefetch: start loading once @fold13 is within two viewports, so the build
// never waits on the network when the trigger fires.
const p12MapSection = document.getElementById('page-12');
function p12MapPrefetchCheck() {
  if (p12MapSection && p12MapSection.getBoundingClientRect().top < window.innerHeight * 2) p12MapLoad();
}
window.addEventListener('scroll', p12MapPrefetchCheck, { passive: true });
window.addEventListener('resize', () => { p12map.layout = null; p12MapResetView(); });

// ── Draw ────────────────────────────────────────────────────────────────────

// A beat's own 0→1, eased fresh from the RAW build progress (never eased twice).
function p12MapBeat(t, w) {
  return p9Ease(Math.max(0, Math.min(1, (t - w.start) / w.len)));
}

// PAGES[12] and PAGES[13]: @fold13 builds the map, @fold14 keeps it standing
// behind the credits card (the trigger has settled at 1 by then).
function drawFoldMap(ctx, W, H) {
  // Until the map data has arrived, keep painting @fold12's end frame (the
  // extreme dots in their freeform spread) so nothing blinks out meanwhile.
  if (!p12map.ready || !p7.ready) { drawPage12(ctx, W, H); return; }
  drawBackground(ctx, W, H);
  ctx.fillStyle = MAP_COLORS.bg; ctx.fillRect(0, 0, W, H);

  const L = p12MapLayout(W, H);
  const t = p12map.t;
  const wipe = p12MapBeat(t, MAP_WIPE);
  const fill = p12MapBeat(t, MAP_FILL);
  const DOT = L.dot;
  // The layout is at its own zoom L.z; the pan is the transform, plus — while a
  // wheel gesture holds the re-pack — the ratio to the live zoom (1 when settled).
  const zs = p12map.view.z / L.z;
  ctx.save();
  ctx.translate(p12map.view.px, p12map.view.py);
  ctx.scale(zs, zs);

  // Outlines stroke themselves on: each ring is dashed [len*wipe, len], so the
  // drawn part grows from nothing to the whole ring. The fills come up behind,
  // one beat later, so the border reads as drawn before the land arrives.
  for (const p of L.polys) {
    if (fill > 0) {
      ctx.globalAlpha = fill;
      ctx.beginPath();
      for (const r of p.rings) { r.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); }
      ctx.fillStyle = p12MapFill(p); ctx.fill();
    }
    if (wipe > 0) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = p.main ? MAP_COLORS.border : MAP_COLORS.borderFar;
      ctx.lineWidth = 1 / zs;
      for (const r of p.rings) {
        ctx.setLineDash(wipe >= 1 ? [] : [r.len * wipe, r.len]);
        ctx.beginPath();
        r.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }
  // compare/ candidates (MAP_DETAILS): Gaza's own tone and the water bodies,
  // both fading up with the country fills, under the outlines' stroke.
  if (fill > 0 && (MAP_DETAILS.gaza || MAP_DETAILS.water)) {
    ctx.globalAlpha = fill;
    if (MAP_DETAILS.gaza) {
      ctx.fillStyle = MAP_COLORS.gaza;
      for (const p of L.polys) for (const r of p.rings) {
        if (!r.gaza) continue;
        ctx.beginPath();
        r.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = MAP_COLORS.border; ctx.lineWidth = 1 / zs; ctx.stroke();
      }
    }
    if (MAP_DETAILS.water) {
      ctx.fillStyle = MAP_COLORS.water; ctx.strokeStyle = MAP_COLORS.waterEdge; ctx.lineWidth = 1 / zs;
      for (const ring of L.water) {
        ctx.beginPath();
        ring.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
  }
  // Main highways (MAP_DETAILS.roads) — hand-traced, approximate at map scale.
  if (fill > 0 && MAP_DETAILS.roads && p12MapLevel().roads) {
    ctx.globalAlpha = fill;
    ctx.strokeStyle = MAP_COLORS.road;
    ctx.lineWidth = MAP_TUNE.roadW / zs;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const line of L.roads) {
      ctx.beginPath();
      line.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }
  ctx.globalAlpha = 1;

  // The extreme dots are the ones @fold12 left standing in their freeform
  // spread; every other event is a "legit" dot with nowhere to fly from.
  const from = p12EnsureFreeformTargets(W, H);
  const flyT = p12MapBeat(t, MAP_FLY);
  const popRaw = Math.max(0, Math.min(1, (t - MAP_POP.start) / MAP_POP.len));

  // 3. Legit dots pop in place — scale up from their own centre, staggered
  //    across the pop window so the map fills in rather than flashing on.
  // Round dots go through one path per colour (arc per dot, a single fill) —
  // the same one-fillStyle-per-colour rule the fillRect runs follow.
  const round = MAP_TUNE.round;
  const mk = p12MapMorphK();   // zoom re-pack glide, 1 when idle
  // Hover: every other dot dims (snap, no easing — the timeline's convention),
  // the hovered one is redrawn on top at full alpha, same size, no ring.
  const hv = t >= 1 ? p12map.hovered : null;
  if (hv) ctx.globalAlpha = MAP_TUNE.hoverDim;
  if (popRaw > 0) {
    const span = 1 - MAP_POP_STAGGER;
    for (const [col, dots] of L.pop) {
      ctx.fillStyle = col;
      if (round) ctx.beginPath();
      for (const d of dots) {
        const k = p9Ease(Math.max(0, Math.min(1, (popRaw - d.off * MAP_POP_STAGGER) / span)));
        if (k <= 0) continue;
        const sz = DOT * k, c = (DOT - sz) / 2;
        const x = d.fx == null ? d.x : d.fx + (d.x - d.fx) * mk;
        const y = d.fy == null ? d.y : d.fy + (d.y - d.fy) * mk;
        if (round) {
          const cx = x + DOT / 2, cy = y + DOT / 2, r = sz / 2;
          ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        } else ctx.fillRect(x + c, y + c, sz, sz);
      }
      if (round) ctx.fill();
    }
  }

  // 2. Extreme dots fly from their freeform position to their coordinate.
  //    Drawn at @fold12's own size at the start, shrinking to the map's dot
  //    over the flight so size, like position, never snaps. Always drawn, even
  //    at t = 0: at that instant they ARE @fold12's end frame.
  const SQ0 = p9Metrics().SQ;
  const sz = SQ0 + (DOT - SQ0) * flyT;
  for (const [col, dots] of L.fly) {
    ctx.fillStyle = col;
    if (round) ctx.beginPath();
    for (const d of dots) {
      const f = from.get(d.e) || d;
      const tx = d.fx == null ? d.x : d.fx + (d.x - d.fx) * mk;
      const ty = d.fy == null ? d.y : d.fy + (d.y - d.fy) * mk;
      // @fold12's spread is in screen px; we're drawing inside the view's translate
      const f0x = f.x - p12map.view.px, f0y = f.y - p12map.view.py;
      const x = f0x + (tx - f0x) * flyT, y = f0y + (ty - f0y) * flyT;
      if (round) { const r = sz / 2; ctx.moveTo(x + sz, y + r); ctx.arc(x + r, y + r, r, 0, Math.PI * 2); }
      else ctx.fillRect(x, y, sz, sz);
    }
    if (round) ctx.fill();
  }

  if (hv) {
    ctx.globalAlpha = 1;
    const hx = hv.fx == null ? hv.x : hv.fx + (hv.x - hv.fx) * mk;
    const hy = hv.fy == null ? hv.y : hv.fy + (hv.y - hv.fy) * mk;
    ctx.fillStyle = p7ActorColor(hv.e.actor);
    if (round) { ctx.beginPath(); ctx.arc(hx + DOT / 2, hy + DOT / 2, DOT / 2, 0, Math.PI * 2); ctx.fill(); }
    else ctx.fillRect(hx, hy, DOT, DOT);
  }

  ctx.globalAlpha = 1;
  // Text stays its own size: back to the pan-only transform, positions scaled.
  ctx.restore(); ctx.save();
  ctx.translate(p12map.view.px, p12map.view.py);
  if (t >= 1) p12MapDrawCounts(ctx, L, zs);
  p12MapDrawCities(ctx, L, t, zs);
  ctx.restore();
  if (MAP_DETAILS.scale && t >= 1) p12MapDrawScale(ctx, L, H);
}

// compare/ candidate: a km scale bar, bottom-left in screen space, its length
// picked from a 1-2-5 series so it stays 60–150px at every zoom.
function p12MapDrawScale(ctx, L, H) {
  const steps = [1, 2, 5, 10, 20, 50, 100, 200];
  let km = steps[0];
  for (const s of steps) { km = s; if (s * L.kmPx >= 60) break; }
  const w = km * L.kmPx, x = 24, y = H - 24 - p12MapPeek();
  ctx.save();
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y - 5); ctx.lineTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y - 5);
  ctx.stroke();
  ctx.font = '11px Assistant, sans-serif'; ctx.fillStyle = '#333';
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.direction = 'rtl';
  ctx.fillText(km + ' ק״מ', x + w / 2, y - 4);
  ctx.restore();
}

// A count over every cluster of the zoom tier's countMin+ events, centred on its centroid, white-haloed like the labels.
function p12MapDrawCounts(ctx, L, zs = 1) {
  ctx.font = '600 11px Assistant, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'ltr';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3; ctx.fillStyle = MAP_COLORS.count;
  const min = p12MapCountMin();
  for (const m of L.marks) {
    if (m.n < min) continue;
    const txt = String(m.n);
    ctx.strokeText(txt, m.x * zs, m.y * zs); ctx.fillText(txt, m.x * zs, m.y * zs);
  }
}

function p12MapDrawCities(ctx, L, t, zs = 1) {
  const at = c => [c.x * zs, c.y * zs];
  ctx.font = '11px Assistant, sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
  ctx.lineJoin = 'round';
  // The live zoom STOP, not the layout's — the labels thin out on the step
  // itself rather than at the settle.
  const lvl = p12MapLevel();
  for (const c of L.cities) {
    // Each label fades in over the 0.08 of progress after its own tier, and the
    // two lesser tiers are also held back until the zoom stop says `cities` is
    // 2 or 3, so a zoomed-out map carries only the four majors.
    const tier = c.at >= 0.78 ? 3 : c.at >= 0.68 ? 2 : 1;
    if (tier > lvl.cities) continue;
    const a = Math.max(0, Math.min(1, (t - c.at) / 0.08));
    if (a <= 0) continue;
    ctx.globalAlpha = a;
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3;
    const q = at(c);
    ctx.strokeText(c.name, q[0] + 6, q[1]);
    ctx.fillStyle = MAP_COLORS.city; ctx.fillText(c.name, q[0] + 6, q[1]);
  }
  // compare/ candidate: zoom-tiered towns (MAP_DETAILS.labels), smaller and
  // greyer than the cities, each shown from its own zoom in.
  if (MAP_DETAILS.labels && lvl.towns && t >= 1) {
    ctx.font = '10px Assistant, sans-serif';
    ctx.globalAlpha = 1;
    for (const c of L.towns) {
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3;
      const q = at(c);
      ctx.strokeText(c.name, q[0] + 5, q[1]);
      ctx.fillStyle = MAP_COLORS.town; ctx.fillText(c.name, q[0] + 5, q[1]);
    }
  }
  ctx.globalAlpha = 1;
}
