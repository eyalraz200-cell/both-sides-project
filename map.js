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
// packed square grid around that coordinate: the small dots coalesced into a
// bigger square, never a circle with a number. Two rules shape those squares:
// points within MAP_CITY_KM of a labelled city join that city's square, so a
// city never fragments; and any two squares that would overlap merge, until
// nothing overdraws. Each event's cell is its fly/pop target, which is what
// lets beats 2 and 3 address dots individually.

const MAP_DOT = 2;          // px per event square at zoom 1
const MAP_DOT_MAX = 6;      // …growing with the zoom, but no bigger than this
const MAP_GAP = 1;          // px between packed squares at zoom 1 (half a dot)
const MAP_CELL_BASE = 24;   // SCREEN-px bucket for clustering neighbouring coordinates
const MAP_CITY_KM = 5;      // points this close to a city join its square
const MAP_ZOOM_MAX = 12;    // wheel zoom ceiling (1 = the fit-to-height view)
const MAP_ZOOM_RATE = 0.0018; // zoom factor per wheel px: exp(-deltaY × rate)

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
  // dots grow up to MAP_DOT_MAX); the pan is a plain translate at draw time.
  view: { z: 1, px: 0, py: 0 },
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
  if (L && L.W === W && L.H === H && L.nx === nx && L.z === z) return L;

  // Equirectangular with a cos(mid-latitude) correction, fit to the canvas
  // height at zoom 1; the width just decides how much sea and neighbour shows.
  const lat0 = 29.45, lat1 = 33.35, lon0 = 34.2, lon1 = 35.95;
  const kx = Math.cos((lat0 + lat1) / 2 * Math.PI / 180);
  const s0 = H / (lat1 - lat0) * z;
  const mapW = (lon1 - lon0) * kx * s0;
  const bx = lon => (lon - lon0) * kx * s0 + (W * z - mapW) / 2;
  const by = lat => (lat1 - lat) * s0;
  const kmPx = s0 / 111;   // 1° of latitude ≈ 111 km
  // Dots grow with the zoom (capped), the gap stays half a dot.
  const DOT = Math.min(MAP_DOT * z, MAP_DOT_MAX);
  const GAP = DOT / 2;

  // Neighbours first, so the two subjects' strokes sit on top of the shared
  // borders rather than under them. Each ring carries its own path length so
  // the wipe can dash it on at its own rate.
  const FILL = { Israel: '#f3f3f3', Palestine: '#e4e4e4' };
  const polys = p12map.geo.features
    .slice()
    .sort((a, b) => (a.properties.name in FILL) - (b.properties.name in FILL))
    .map(f => ({
      fill: FILL[f.properties.name] || '#fafafa',
      main: f.properties.name in FILL,
      rings: (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates)
        .flat().map(r => {
          const pts = r.map(([lon, lat]) => [bx(lon), by(lat)]);
          let len = 0;
          for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
          return { pts, len: len || 1 };
        }),
    }));

  const cities = MAP_CITIES.map(([at, name, lat, lon]) => ({ at, name, x: bx(lon), y: by(lat) }));

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

  // A point close to a labelled city joins that city's cluster, so a city is
  // one square instead of a scatter of neighbourhood fragments.
  const cityR2 = (MAP_CITY_KM * kmPx) ** 2;
  const buckets = new Map();
  for (const p of places) {
    let key = null, best = cityR2;
    for (const c of cities) {
      const d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2;
      if (d < best) { best = d; key = 'city:' + c.name; }
    }
    if (!key) key = Math.floor(p.x / MAP_CELL_BASE) + ',' + Math.floor(p.y / MAP_CELL_BASE);
    let b = buckets.get(key);
    if (!b) buckets.set(key, b = { events: [], x: 0, y: 0, n: 0 });
    b.events.push(...p.events);
    b.x += p.x * p.events.length; b.y += p.y * p.events.length; b.n += p.events.length;
  }
  let cl = [...buckets.values()].map(b => ({ events: b.events, x: b.x / b.n, y: b.y / b.n }));

  // Absorb overlaps: a cluster swallows every later cluster whose packed square
  // would touch its own, growing as it goes, and the pass repeats while
  // anything merged — a merge enlarges the square, which can then reach a
  // further neighbour. Nothing is ever drawn on top of anything else.
  const boxOf = n => Math.ceil(Math.sqrt(n)) * (DOT + GAP) - GAP;
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

  // Every event gets its own cell in its cluster's packed square, ordered by
  // group color so each group reads as a block within the square.
  const slots = new Map();
  const pitch = DOT + GAP;
  for (const c of cl) {
    const ev = c.events.slice().sort((a, b) => {
      const ca = p7ActorColor(a.actor), cb = p7ActorColor(b.actor);
      return ca < cb ? -1 : ca > cb ? 1 : 0;
    });
    const side = Math.ceil(Math.sqrt(ev.length));
    const off = (side * pitch - GAP) / 2;
    ev.forEach((e, i) => {
      slots.set(e, { x: c.x - off + (i % side) * pitch, y: c.y - off + ((i / side) | 0) * pitch });
    });
  }

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
    arr.push({ e, x: s.x, y: s.y, off: ((i++ * 2654435761) % 1000) / 1000 });
  }

  return (p12map.layout = { W, H, nx, z, dot: DOT, polys, cities, pop, fly });
}

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

function p12MapClampPan(W, H) {
  const v = p12map.view;
  v.px = Math.min(0, Math.max(W - W * v.z, v.px));
  v.py = Math.min(0, Math.max(H - H * v.z, v.py));
}

function p12MapWheel(e) {
  if (!p12MapAtEnd() || isMobile()) return;
  const v = p12map.view;
  if (e.deltaY < 0 && v.z <= 1) return;   // at the fit view, wheel-up is a page scroll
  e.preventDefault();
  const z1 = Math.min(MAP_ZOOM_MAX, Math.max(1, v.z * Math.exp(e.deltaY * MAP_ZOOM_RATE)));
  if (z1 === v.z) return;
  // Zoom about the cursor: the map point under it stays under it.
  const k = z1 / v.z;
  v.px = e.clientX - (e.clientX - v.px) * k;
  v.py = e.clientY - (e.clientY - v.py) * k;
  v.z = z1;
  if (z1 === 1) { v.px = 0; v.py = 0; }
  p12MapClampPan(canvas.clientWidth, canvas.clientHeight);
  p12MapSyncCursor();
  draw();
}

let p12MapDrag = null;   // {x, y, px, py} while a pan drag is in flight
function p12MapPointerDown(e) {
  if (!p12MapAtEnd() || p12map.view.z <= 1 || e.button !== 0) return;
  if (e.target.closest && e.target.closest('#page-13 .text-card')) return;   // the drawer's own text
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
  document.documentElement.style.cursor =
    p12MapAtEnd() && p12map.view.z > 1 ? 'grab' : '';
}
function p12MapResetView() {
  const v = p12map.view;
  if (v.z === 1 && !v.px && !v.py) return;
  v.z = 1; v.px = 0; v.py = 0;
  p12MapSyncCursor();
}

window.addEventListener('wheel', p12MapWheel, { passive: false });
window.addEventListener('scroll', p12MapSyncCursor, { passive: true });
window.addEventListener('pointerdown', p12MapPointerDown);
window.addEventListener('pointermove', p12MapPointerMove);
window.addEventListener('pointerup', p12MapPointerUp);
window.addEventListener('pointercancel', p12MapPointerUp);

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
  // A reversed build (scrolled back above the crossing) plays at the fit view —
  // the extreme dots' flight starts from @fold12's zoom-1 positions.
  if (p12map.t < 1) p12MapResetView();
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

  const L = p12MapLayout(W, H);
  const t = p12map.t;
  const wipe = p12MapBeat(t, MAP_WIPE);
  const fill = p12MapBeat(t, MAP_FILL);
  const DOT = L.dot;
  // The layout is already at the zoom; the pan is the only transform.
  ctx.save();
  ctx.translate(p12map.view.px, p12map.view.py);

  // Outlines stroke themselves on: each ring is dashed [len*wipe, len], so the
  // drawn part grows from nothing to the whole ring. The fills come up behind,
  // one beat later, so the border reads as drawn before the land arrives.
  for (const p of L.polys) {
    if (fill > 0) {
      ctx.globalAlpha = fill;
      ctx.beginPath();
      for (const r of p.rings) { r.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); }
      ctx.fillStyle = p.fill; ctx.fill();
    }
    if (wipe > 0) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = p.main ? '#999' : '#ccc';
      ctx.lineWidth = 1;
      for (const r of p.rings) {
        ctx.setLineDash(wipe >= 1 ? [] : [r.len * wipe, r.len]);
        ctx.beginPath();
        r.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }
  ctx.globalAlpha = 1;

  // The extreme dots are the ones @fold12 left standing in their freeform
  // spread; every other event is a "legit" dot with nowhere to fly from.
  const from = p12EnsureFreeformTargets(W, H);
  const flyT = p12MapBeat(t, MAP_FLY);
  const popRaw = Math.max(0, Math.min(1, (t - MAP_POP.start) / MAP_POP.len));

  // 3. Legit dots pop in place — scale up from their own centre, staggered
  //    across the pop window so the map fills in rather than flashing on.
  if (popRaw > 0) {
    const span = 1 - MAP_POP_STAGGER;
    for (const [col, dots] of L.pop) {
      ctx.fillStyle = col;
      for (const d of dots) {
        const k = p9Ease(Math.max(0, Math.min(1, (popRaw - d.off * MAP_POP_STAGGER) / span)));
        if (k <= 0) continue;
        const sz = DOT * k, c = (DOT - sz) / 2;
        ctx.fillRect(d.x + c, d.y + c, sz, sz);
      }
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
    for (const d of dots) {
      const f = from.get(d.e) || d;
      ctx.fillRect(f.x + (d.x - f.x) * flyT, f.y + (d.y - f.y) * flyT, sz, sz);
    }
  }

  p12MapDrawCities(ctx, L, t);
  ctx.restore();
}

function p12MapDrawCities(ctx, L, t) {
  ctx.font = '11px Assistant, sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
  ctx.lineJoin = 'round';
  for (const c of L.cities) {
    // Each label fades in over the 0.08 of progress after its own tier.
    const a = Math.max(0, Math.min(1, (t - c.at) / 0.08));
    if (a <= 0) continue;
    ctx.globalAlpha = a;
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3;
    ctx.strokeText(c.name, c.x + 6, c.y);
    ctx.fillStyle = '#333'; ctx.fillText(c.name, c.x + 6, c.y);
  }
  ctx.globalAlpha = 1;
}
