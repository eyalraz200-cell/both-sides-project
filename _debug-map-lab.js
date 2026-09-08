/* ============================================================================
   _debug-map-lab.js — SCAFFOLDING for @fold13/@fold14's event map (map.js).
   manual/ + compare/ in one panel: every dot, cluster, colour, detail and
   zoom-threshold knob the map has. Delete this file and its <script> tag in
   project.html once the values are baked. Desktop only; never scrolls the page.

   Groups (the second pill strip): dots · order · cluster · zoom (the 4 stops) · map
   ========================================================================== */
(function () {
  if (window.innerWidth < 900) return;              // desktop harness, desktop only
  if (typeof MAP_TUNE === 'undefined') return;      // map.js not loaded

  // Structural knobs force a re-pack (p12map.layout = null); everything else is
  // draw-only and repaints instantly. The re-pack is debounced so dragging a
  // structural slider doesn't queue a 100–350ms pack per input event.
  var STRUCTURAL = {
    dot: 1, dotGrow: 1, dotMax: 1, gapRatio: 1, jitter: 1,
    cellBase: 1, linkPx: 1, minCluster: 1, cityKm: 1
  };
  var VIEW = { zoomLevel: 1, startX: 1, startY: 1 };
  var LEVEL_FIELDS = { z: 'z', count: 'countMin', cities: 'cities', towns: 'towns', roads: 'roads', hover: 'hover' };
  var LEVEL_KEY = /^L([1-4])(z|count|cities|towns|roads|hover)$/;

  var CONFIG = {
    title: 'map lab',
    tabs: [],
    width: 340,

    // ── independent switches (always visible: they decide WHAT is drawn) ──
    toggles: [
      { key: 't', id: 'notitle', label: 'hide the title blocks (@fold13 + @fold14)', on: false },
      { key: '1', id: 'counts', label: 'cluster counts', on: !!MAP_TUNE.counts },
      { key: '2', id: 'roads', label: 'main roads (hand-traced, approximate)', on: !!MAP_DETAILS.roads },
      { key: '3', id: 'water', label: 'water bodies', on: !!MAP_DETAILS.water },
      { key: '4', id: 'gaza', label: 'Gaza in its own tone', on: !!MAP_DETAILS.gaza },
      { key: '5', id: 'labels', label: 'town labels (zoom-tiered)', on: !!MAP_DETAILS.labels },
      { key: '6', id: 'scale', label: 'km scale bar', on: !!MAP_DETAILS.scale },
      { key: '7', id: 'tipcount', label: 'tooltip says "N events here"', on: !!MAP_DETAILS.count },
      { key: '8', id: 'cellkm', label: 'bucket in KM, not screen px (stable clusters)', on: !!MAP_TUNE.cellKm },
      { key: '9', id: 'round', label: 'round dots', on: !!MAP_TUNE.round },
      { key: 'p', id: 'crossborder', label: 'ignore the Israel/Palestine border when packing', on: !!MAP_TUNE.crossBorder }
    ],

    // ── exclusive picks, one list per group ──
    modes: [
      { group: 'dots', key: 'q', id: 'grow-square', label: 'grow-square — square lattice, inside the borders' },
      { group: 'dots', key: 'w', id: 'grow-hex', label: 'grow-hex — hex lattice, inside the borders' },
      { group: 'dots', key: 'e', id: 'square', label: 'square — √n block, spills over the coast' },
      { group: 'dots', key: 'r', id: 'disc', label: 'disc — sunflower spiral, round blobs' },

      { group: 'order', key: 'a', id: 'mix', label: 'mix — groups intermingle' },
      { group: 'order', key: 's', id: 'wedge', label: 'wedge — colour blocks by angle' },
      { group: 'order', key: 'd', id: 'ring', label: 'ring — colour bands by distance' },

      { group: 'cluster', key: 'z', id: 'grid', label: 'grid — square buckets of cellBase' },
      { group: 'cluster', key: 'x', id: 'hex', label: 'hex — hex buckets, no cell-edge seams' },
      { group: 'cluster', key: 'c', id: 'link', label: 'link — greedy join within linkPx' },
      { group: 'cluster', key: 'v', id: 'city', label: 'city — every point to its nearest city' },
      { group: 'cluster', key: 'b', id: 'none', label: 'none — one blob per coordinate' }
    ],
    mode: { dots: MAP_TUNE.shape, order: MAP_TUNE.sort, cluster: MAP_TUNE.cluster },
    offLabels: { dots: 'off / current', order: 'off / current', cluster: 'off / current' },

    sliders: [
      // dots
      { group: 'dots', key: 'dot', label: 'dot px at zoom 1', min: 0.2, max: 4, step: 0.05, value: MAP_TUNE.dot, source: 'map.js MAP_TUNE.dot' },
      { group: 'dots', key: 'dotGrow', label: 'dot growth with zoom (1 = with the map)', min: 0, max: 1, step: 0.05, value: MAP_TUNE.dotGrow, source: 'MAP_TUNE.dotGrow' },
      { group: 'dots', key: 'dotMax', label: 'dot px ceiling', min: 1, max: 20, step: 0.5, value: MAP_TUNE.dotMax, source: 'MAP_TUNE.dotMax' },
      { group: 'dots', key: 'gapRatio', label: 'gap, as a share of a dot', min: 0, max: 2, step: 0.05, value: MAP_TUNE.gapRatio, source: 'MAP_TUNE.gapRatio' },
      { group: 'dots', key: 'jitter', label: 'jitter (0 = a clean lattice)', min: 0, max: 1.5, step: 0.05, value: MAP_TUNE.jitter, source: 'MAP_TUNE.jitter' },

      // clustering
      { group: 'cluster', key: 'cellBase', label: 'bucket size (px, or km with 8 on)', min: 4, max: 200, step: 1, value: MAP_TUNE.cellBase, source: 'MAP_TUNE.cellBase' },
      { group: 'cluster', key: 'linkPx', label: 'link radius px (cluster = link)', min: 4, max: 200, step: 1, value: MAP_TUNE.linkPx, source: 'MAP_TUNE.linkPx' },
      { group: 'cluster', key: 'minCluster', label: 'merge clusters under N events (0 = off)', min: 0, max: 60, step: 1, value: MAP_TUNE.minCluster, source: 'MAP_TUNE.minCluster' },
      { group: 'cluster', key: 'cityKm', label: 'pull points within N km into a city (0 = off)', min: 0, max: 25, step: 0.5, value: MAP_TUNE.cityKm, source: 'MAP_TUNE.cityKm' },

      // the four zoom stops (MAP_ZOOM_LEVELS) — one row of knobs per stop,
      // plus which stop the view is parked on right now
      { group: 'zoom', key: 'lvl', label: 'JUMP the view to stop N (1–4)', min: 1, max: 4, step: 1, value: MAP_TUNE.zoomLevel, source: 'p12map.view.lvl' },
      { group: 'zoom', key: 'zoomLevel', label: 'which stop the map RESTS at', min: 1, max: 4, step: 1, value: MAP_TUNE.zoomLevel, source: 'MAP_TUNE.zoomLevel' },
      { group: 'zoom', key: 'startX', label: 'resting centre X (0–1)', min: 0, max: 1, step: 0.005, value: MAP_TUNE.startX, source: 'MAP_TUNE.startX' },
      { group: 'zoom', key: 'startY', label: 'resting centre Y (0–1)', min: 0, max: 1, step: 0.005, value: MAP_TUNE.startY, source: 'MAP_TUNE.startY' },
      { group: 'zoom', key: 'L1z', label: 'stop 1 — zoom', min: 1, max: 40, step: 0.05, value: MAP_ZOOM_LEVELS[0].z, source: 'MAP_ZOOM_LEVELS[0].z' },
      { group: 'zoom', key: 'L1count', label: 'stop 1 — count from N events', min: 1, max: 400, step: 1, value: MAP_ZOOM_LEVELS[0].countMin, source: 'MAP_ZOOM_LEVELS[0].countMin' },
      { group: 'zoom', key: 'L1cities', label: 'stop 1 — city label tiers (1–3)', min: 1, max: 3, step: 1, value: MAP_ZOOM_LEVELS[0].cities, source: 'MAP_ZOOM_LEVELS[0].cities' },
      { group: 'zoom', key: 'L1towns', label: 'stop 1 — town labels (0/1)', min: 0, max: 1, step: 1, value: +MAP_ZOOM_LEVELS[0].towns, source: 'MAP_ZOOM_LEVELS[0].towns' },
      { group: 'zoom', key: 'L1roads', label: 'stop 1 — roads (0/1)', min: 0, max: 1, step: 1, value: +MAP_ZOOM_LEVELS[0].roads, source: 'MAP_ZOOM_LEVELS[0].roads' },
      { group: 'zoom', key: 'L1hover', label: 'stop 1 — tooltip (0/1)', min: 0, max: 1, step: 1, value: +MAP_ZOOM_LEVELS[0].hover, source: 'MAP_ZOOM_LEVELS[0].hover' },
      { group: 'zoom', key: 'L2z', label: 'stop 2 — zoom', min: 1, max: 40, step: 0.05, value: MAP_ZOOM_LEVELS[1].z, source: 'MAP_ZOOM_LEVELS[1].z' },
      { group: 'zoom', key: 'L2count', label: 'stop 2 — count from N events', min: 1, max: 400, step: 1, value: MAP_ZOOM_LEVELS[1].countMin, source: 'MAP_ZOOM_LEVELS[1].countMin' },
      { group: 'zoom', key: 'L2cities', label: 'stop 2 — city label tiers (1–3)', min: 1, max: 3, step: 1, value: MAP_ZOOM_LEVELS[1].cities, source: 'MAP_ZOOM_LEVELS[1].cities' },
      { group: 'zoom', key: 'L2towns', label: 'stop 2 — town labels (0/1)', min: 0, max: 1, step: 1, value: +MAP_ZOOM_LEVELS[1].towns, source: 'MAP_ZOOM_LEVELS[1].towns' },
      { group: 'zoom', key: 'L2roads', label: 'stop 2 — roads (0/1)', min: 0, max: 1, step: 1, value: +MAP_ZOOM_LEVELS[1].roads, source: 'MAP_ZOOM_LEVELS[1].roads' },
      { group: 'zoom', key: 'L2hover', label: 'stop 2 — tooltip (0/1)', min: 0, max: 1, step: 1, value: +MAP_ZOOM_LEVELS[1].hover, source: 'MAP_ZOOM_LEVELS[1].hover' },
      { group: 'zoom', key: 'L3z', label: 'stop 3 — zoom', min: 1, max: 40, step: 0.05, value: MAP_ZOOM_LEVELS[2].z, source: 'MAP_ZOOM_LEVELS[2].z' },
      { group: 'zoom', key: 'L3count', label: 'stop 3 — count from N events', min: 1, max: 400, step: 1, value: MAP_ZOOM_LEVELS[2].countMin, source: 'MAP_ZOOM_LEVELS[2].countMin' },
      { group: 'zoom', key: 'L3cities', label: 'stop 3 — city label tiers (1–3)', min: 1, max: 3, step: 1, value: MAP_ZOOM_LEVELS[2].cities, source: 'MAP_ZOOM_LEVELS[2].cities' },
      { group: 'zoom', key: 'L3towns', label: 'stop 3 — town labels (0/1)', min: 0, max: 1, step: 1, value: +MAP_ZOOM_LEVELS[2].towns, source: 'MAP_ZOOM_LEVELS[2].towns' },
      { group: 'zoom', key: 'L3roads', label: 'stop 3 — roads (0/1)', min: 0, max: 1, step: 1, value: +MAP_ZOOM_LEVELS[2].roads, source: 'MAP_ZOOM_LEVELS[2].roads' },
      { group: 'zoom', key: 'L3hover', label: 'stop 3 — tooltip (0/1)', min: 0, max: 1, step: 1, value: +MAP_ZOOM_LEVELS[2].hover, source: 'MAP_ZOOM_LEVELS[2].hover' },
      { group: 'zoom', key: 'L4z', label: 'stop 4 — zoom', min: 1, max: 40, step: 0.05, value: MAP_ZOOM_LEVELS[3].z, source: 'MAP_ZOOM_LEVELS[3].z' },
      { group: 'zoom', key: 'L4count', label: 'stop 4 — count from N events', min: 1, max: 400, step: 1, value: MAP_ZOOM_LEVELS[3].countMin, source: 'MAP_ZOOM_LEVELS[3].countMin' },
      { group: 'zoom', key: 'L4cities', label: 'stop 4 — city label tiers (1–3)', min: 1, max: 3, step: 1, value: MAP_ZOOM_LEVELS[3].cities, source: 'MAP_ZOOM_LEVELS[3].cities' },
      { group: 'zoom', key: 'L4towns', label: 'stop 4 — town labels (0/1)', min: 0, max: 1, step: 1, value: +MAP_ZOOM_LEVELS[3].towns, source: 'MAP_ZOOM_LEVELS[3].towns' },
      { group: 'zoom', key: 'L4roads', label: 'stop 4 — roads (0/1)', min: 0, max: 1, step: 1, value: +MAP_ZOOM_LEVELS[3].roads, source: 'MAP_ZOOM_LEVELS[3].roads' },
      { group: 'zoom', key: 'L4hover', label: 'stop 4 — tooltip (0/1)', min: 0, max: 1, step: 1, value: +MAP_ZOOM_LEVELS[3].hover, source: 'MAP_ZOOM_LEVELS[3].hover' },
      // map surface
      { group: 'map', key: 'roadW', label: 'road width px', min: 0.2, max: 6, step: 0.1, value: MAP_TUNE.roadW, source: 'MAP_TUNE.roadW' }
    ],

    colors: [
      { group: 'map', key: 'bg', label: 'canvas ground', value: MAP_COLORS.bg, source: 'MAP_COLORS.bg' },
      { group: 'map', key: 'israel', label: 'Israel fill', value: MAP_COLORS.israel, source: 'MAP_COLORS.israel' },
      { group: 'map', key: 'palestine', label: 'Palestine fill', value: MAP_COLORS.palestine, source: 'MAP_COLORS.palestine' },
      { group: 'map', key: 'neighbour', label: 'neighbours fill', value: MAP_COLORS.neighbour, source: 'MAP_COLORS.neighbour' },
      { group: 'map', key: 'gaza', label: 'Gaza fill', value: MAP_COLORS.gaza, source: 'MAP_COLORS.gaza' },
      { group: 'map', key: 'border', label: 'main outline', value: MAP_COLORS.border, source: 'MAP_COLORS.border' },
      { group: 'map', key: 'borderFar', label: 'neighbours outline', value: MAP_COLORS.borderFar, source: 'MAP_COLORS.borderFar' },
      { group: 'map', key: 'water', label: 'water fill', value: MAP_COLORS.water, source: 'MAP_COLORS.water' },
      { group: 'map', key: 'waterEdge', label: 'water edge', value: MAP_COLORS.waterEdge, source: 'MAP_COLORS.waterEdge' },
      { group: 'map', key: 'road', label: 'road', value: MAP_COLORS.road, source: 'MAP_COLORS.road' },
      { group: 'map', key: 'city', label: 'city label', value: MAP_COLORS.city, source: 'MAP_COLORS.city' },
      { group: 'map', key: 'town', label: 'town label', value: MAP_COLORS.town, source: 'MAP_COLORS.town' },
      { group: 'map', key: 'count', label: 'cluster count', value: MAP_COLORS.count, source: 'MAP_COLORS.count' }
    ],

    apply: function (v, mode, tab, on) {
      // 1. the page's own chrome
      CONFIG.style.textContent = on.notitle
        ? '#page-12 .section-text.text-card, #page-13 .section-text.text-card{visibility:hidden}'
        : '';

      // 2. flags
      MAP_TUNE.counts = on.counts;
      MAP_TUNE.cellKm = on.cellkm;
      MAP_TUNE.round = on.round;
      MAP_TUNE.crossBorder = on.crossborder;
      MAP_DETAILS.roads = on.roads;
      MAP_DETAILS.water = on.water;
      MAP_DETAILS.gaza = on.gaza;
      MAP_DETAILS.labels = on.labels;
      MAP_DETAILS.scale = on.scale;
      MAP_DETAILS.count = on.tipcount;

      // 3. exclusive picks (null = leave whatever the file ships with)
      if (mode.dots) MAP_TUNE.shape = mode.dots;
      if (mode.order) MAP_TUNE.sort = mode.order;
      if (mode.cluster) MAP_TUNE.cluster = mode.cluster;

      // 4. numbers + colours
      var structural = last.cellkm !== on.cellkm || last.cross !== on.crossborder || last.dots !== mode.dots ||
        last.order !== mode.order || last.cluster !== mode.cluster;
      Object.keys(v).forEach(function (k) {
        if (k in MAP_COLORS) { MAP_COLORS[k] = v[k]; return; }
        var m = LEVEL_KEY.exec(k);                       // a MAP_ZOOM_LEVELS cell
        if (m) {
          var L = MAP_ZOOM_LEVELS[+m[1] - 1], f = LEVEL_FIELDS[m[2]];
          var val = (f === 'z' || f === 'countMin' || f === 'cities') ? v[k] : !!v[k];
          if (L[f] !== val) { L[f] = val; if (f === 'z') reView = true; }
          return;
        }
        if (k === 'lvl') return;                         // handled below (view, not tune)
        if (MAP_TUNE[k] !== v[k]) {
          if (STRUCTURAL[k]) structural = true;
          if (VIEW[k]) reView = true;
          MAP_TUNE[k] = v[k];
        }
      });
      // The stop the view is parked on — a jump, so the level's own rules can be
      // judged without spinning the wheel to get there.
      if (typeof p12map !== 'undefined' && p12map.view && v.lvl - 1 !== p12map.view.lvl) {
        p12map.view.lvl = v.lvl - 1;
        if (typeof p12MapGoLevel === 'function') {
          p12MapGoLevel(v.lvl - 1, window.innerWidth / 2, window.innerHeight / 2);
        }
        structural = true;
      }
      last = { cellkm: on.cellkm, cross: on.crossborder, dots: mode.dots, order: mode.order, cluster: mode.cluster };
      repaint(structural);
    },

    // A live zoom ruler: where the reader's zoom sits against every threshold
    // that fires off it, so a crossing is SEEN and not inferred from the result.
    custom: function (box, api, doc) {
      box.innerHTML = '<div style="opacity:.6">zoom vs. its thresholds</div>' +
        '<div class="ml-ruler" style="position:relative;height:34px;margin-top:4px;' +
        'border-bottom:1px solid #444"></div>';
      var ruler = box.querySelector('.ml-ruler');
      return function () { drawRuler(ruler, api); };
    },

    collapseSliders: false,
    knobCols: 1,

    summary: function (v, mode) {
      var out = ['// MAP_TUNE'];
      Object.keys(v).forEach(function (k) {
        if (k in MAP_COLORS || LEVEL_KEY.test(k) || k === 'lvl') return;
        out.push('  ' + k + ': ' + v[k] + ',');
      });
      out.push("  shape: '" + MAP_TUNE.shape + "', sort: '" + MAP_TUNE.sort +
        "', cluster: '" + MAP_TUNE.cluster + "',");
      out.push('  counts: ' + MAP_TUNE.counts + ', cellKm: ' + MAP_TUNE.cellKm +
        ', round: ' + MAP_TUNE.round + ',');
      out.push('// MAP_ZOOM_LEVELS');
      MAP_ZOOM_LEVELS.forEach(function (L) {
        out.push('  { z: ' + L.z + ', countMin: ' + L.countMin + ', cities: ' + L.cities +
          ', towns: ' + !!L.towns + ', roads: ' + !!L.roads + ', hover: ' + !!L.hover + ' },');
      });
      out.push('// MAP_COLORS');
      Object.keys(v).forEach(function (k) {
        if (k in MAP_COLORS) out.push("  " + k + ": '" + v[k] + "',");
      });
      out.push('// MAP_DETAILS: ' + Object.keys(MAP_DETAILS)
        .filter(function (k) { return MAP_DETAILS[k]; }).join(' + ') || '// MAP_DETAILS: (none)');
      return out.join('\n');
    }
  };

  var last = { cellkm: MAP_TUNE.cellKm, cross: MAP_TUNE.crossBorder, dots: MAP_TUNE.shape, order: MAP_TUNE.sort, cluster: MAP_TUNE.cluster };
  var reView = false, packTimer = 0;

  // A structural change re-packs 14k dots (100–350ms), so it is debounced: the
  // drag stays smooth and one pack runs when the slider goes quiet.
  function repaint(structural) {
    if (reView && typeof p12MapResetView === 'function') { reView = false; p12MapResetView(); structural = true; }
    if (!structural) { if (typeof draw === 'function') draw(); return; }
    clearTimeout(packTimer);
    packTimer = setTimeout(function () {
      if (typeof p12map !== 'undefined') p12map.layout = null;
      if (typeof draw === 'function') draw();
    }, 90);
  }

  // ── the ruler + its on-page twin ────────────────────────────────────────
  // Ticks: every zoom threshold, plus a marker for the live zoom. Green = the
  // threshold has fired at this zoom, grey = still armed.
  function stops() {
    return MAP_ZOOM_LEVELS.map(function (L, i) {
      return ['stop ' + (i + 1), L.z, L];
    });
  }
  function drawRuler(ruler, api) {
    var doc = ruler.ownerDocument;
    var v = (typeof p12map !== 'undefined' && p12map.view) ? p12map.view : { z: 1, lvl: 0 };
    var lo = MAP_ZOOM_LEVELS[0].z, hi = MAP_ZOOM_LEVELS[MAP_ZOOM_LEVELS.length - 1].z;
    var at = function (val) {   // log scale — the stops are decades apart
      var k = (Math.log(Math.max(lo, Math.min(hi, val))) - Math.log(lo)) / (Math.log(hi / lo) || 1);
      return (k * 100).toFixed(1) + '%';
    };
    var html = '';
    stops().forEach(function (t, i) {
      var here = i === v.lvl;
      html += '<div style="position:absolute;left:' + at(t[1]) + ';top:' + (i % 2) * 15 + 'px;' +
        'border-left:1px solid ' + (here ? '#5cd67a' : '#666') + ';height:14px;padding-left:3px;' +
        'font-size:9px;white-space:nowrap;color:' + (here ? '#5cd67a' : '#888') + '">' +
        (i + 1) + ' · z' + t[1] + '</div>';
    });
    html += '<div style="position:absolute;left:' + at(v.z) + ';bottom:-5px;width:0;height:0;' +
      'border-left:4px solid transparent;border-right:4px solid transparent;border-bottom:6px solid #fff"></div>';
    html += '<div style="position:absolute;right:0;bottom:-16px;font-size:10px;color:#fff">z ' + v.z.toFixed(2) + '</div>';
    ruler.innerHTML = html;
    if (doc === document) pageChip(v);
  }

  // The same stepping, marked ON THE PAGE — a small block in the top-left
  // margin, never a rule across the artwork being judged.
  var chip = null;
  function pageChip(v) {
    if (!chip) {
      chip = document.createElement('div');
      chip.style.cssText = 'position:fixed;left:10px;top:10px;z-index:2147483646;pointer-events:none;' +
        'font:10px/1.5 ui-monospace,monospace;color:#666;background:rgba(255,255,255,.75);' +
        'padding:4px 7px;border-radius:5px';
      document.body.appendChild(chip);
    }
    var rows = stops().map(function (t, i) {
      var here = i === v.lvl;
      return '<span style="color:' + (here ? '#1f9d3d' : '#aaa') + '">' +
        (here ? '●' : '○') + ' ' + (i + 1) + ' z' + t[1] + ' · ≥' + t[2].countMin +
        ' · cities ' + t[2].cities + (t[2].towns ? '+towns' : '') +
        (t[2].roads ? ' · roads' : '') + (t[2].hover ? ' · tip' : '') + '</span>';
    });
    chip.innerHTML = '<b>stop ' + (v.lvl + 1) + ' — z ' + v.z.toFixed(2) + '</b><br>' + rows.join('<br>');
  }

  // The zoom changes from the page (wheel), not from the panel — keep the ruler
  // and the chip honest with a light rAF poll instead of patching p12MapWheel.
  CONFIG.init = function (api) {
    var lastZ = '';
    (function tick() {
      var v = (typeof p12map !== 'undefined' && p12map.view) ? p12map.view : null;
      var z = v ? v.z + ':' + v.lvl : '1';
      if (z !== lastZ) {
        lastZ = z;
        if (v) api.set('lvl', v.lvl + 1); else api.refresh();
      }
      requestAnimationFrame(tick);
    })();
  };

  // ---- panel base: ~/.claude/templates/harness-panel.js, verbatim below ----
  window.__HARNESS_CONFIG = CONFIG;
})();

/* The canonical panel, driven by the CONFIG built above. */
(function () {
  var CONFIG = window.__HARNESS_CONFIG;
  if (!CONFIG) return;
  delete window.__HARNESS_CONFIG;

  var style = document.createElement('style');
  document.head.appendChild(style);
  CONFIG.style = style;

  CONFIG.colors = CONFIG.colors || [];
  CONFIG.tabs = CONFIG.tabs || [];
  var KNOBS = CONFIG.sliders.concat(CONFIG.colors);

  var PERTAB = KNOBS.filter(function (s) { return !s.global; });
  var GLOBAL = KNOBS.filter(function (s) { return s.global; });
  var IS_GLOBAL = {};
  GLOBAL.forEach(function (s) { IS_GLOBAL[s.key] = true; });

  function freshSet(list) {
    var o = {};
    (list || KNOBS).forEach(function (s) { o[s.key] = s.value; });
    return o;
  }
  var V, DEFAULTS;
  if (CONFIG.tabs.length) {
    V = { __global: freshSet(GLOBAL) };
    DEFAULTS = { __global: freshSet(GLOBAL) };
    CONFIG.tabs.forEach(function (t) {
      V[t.id] = freshSet(PERTAB); DEFAULTS[t.id] = freshSet(PERTAB);
    });
  } else {
    V = freshSet(); DEFAULTS = freshSet();
  }
  if (CONFIG.values) {
    Object.keys(CONFIG.values).forEach(function (id) {
      if (!V[id]) return;
      Object.keys(CONFIG.values[id]).forEach(function (k) {
        V[id][k] = DEFAULTS[id][k] = CONFIG.values[id][k];
      });
    });
  }

  var tab = CONFIG.tabs.length ? (CONFIG.tab || CONFIG.tabs[0].id) : null;
  function cur() { return tab ? V[tab] : V; }
  function bag(k) { return (tab && IS_GLOBAL[k]) ? V.__global : cur(); }

  CONFIG.modes = CONFIG.modes || [];
  var MODE_GROUPED = CONFIG.modes.some(function (m) { return !!m.group; });
  var MODE_GROUPS = [];
  CONFIG.modes.forEach(function (m) {
    var g = m.group || 'main';
    if (MODE_GROUPS.indexOf(g) < 0) MODE_GROUPS.push(g);
  });
  var DEFAULT_MODE, mode;
  if (MODE_GROUPED) {
    DEFAULT_MODE = {};
    MODE_GROUPS.forEach(function (g) { DEFAULT_MODE[g] = null; });
    if (CONFIG.mode && typeof CONFIG.mode === 'object') {
      Object.keys(CONFIG.mode).forEach(function (g) { DEFAULT_MODE[g] = CONFIG.mode[g]; });
    }
    mode = {};
    MODE_GROUPS.forEach(function (g) { mode[g] = DEFAULT_MODE[g]; });
  } else {
    DEFAULT_MODE = CONFIG.mode || null;
    mode = DEFAULT_MODE;
  }
  function modeOf(g) { return MODE_GROUPED ? mode[g] || null : mode; }
  function setMode(g, id) {
    if (MODE_GROUPED) mode[g] = id || null; else mode = id || null;
    syncInputs(); run();
  }
  function resetModes() {
    if (MODE_GROUPED) MODE_GROUPS.forEach(function (g) { mode[g] = DEFAULT_MODE[g]; });
    else mode = DEFAULT_MODE;
  }

  CONFIG.toggles = CONFIG.toggles || [];
  var T = {}, TDEFAULT = {};
  CONFIG.toggles.forEach(function (t) { T[t.id] = TDEFAULT[t.id] = !!t.on; });

  var LSKEY = 'harness:' + CONFIG.title;

  var TRIMKEY = LSKEY + ':trim';
  var HIDDEN = {};
  try {
    (JSON.parse(localStorage.getItem(TRIMKEY)) || []).forEach(function (k) { HIDDEN[k] = true; });
  } catch (e) {}
  function saveTrim() {
    try {
      localStorage.setItem(TRIMKEY, JSON.stringify(Object.keys(HIDDEN).filter(function (k) { return HIDDEN[k]; })));
    } catch (er) {}
  }
  function rowVisible(row) {
    if (HIDDEN[row.dataset.knob]) return false;
    if (HAS_GROUPS && row.dataset.group !== group) return false;
    return true;
  }
  function applyTrim() {
    eachDoc(function (doc, el) {
      Array.prototype.forEach.call(el.querySelectorAll('.hp-row[data-knob]'), function (r) {
        r.style.display = rowVisible(r) ? '' : 'none';
      });
    });
  }
  var win = null;

  function run() {
    CONFIG.apply(V, mode, tab, T);
    renderReadout();
  }

  function payload() {
    var lines = ['[' + CONFIG.title + ']'];
    if (CONFIG.modes.length) {
      if (MODE_GROUPED) MODE_GROUPS.forEach(function (g) {
        lines.push(g + ' mode: ' + (mode[g] || 'off/current'));
      });
      else lines.push('mode: ' + (mode || 'off/current'));
    }
    if (CONFIG.toggles.length) {
      lines.push('on: ' + (CONFIG.toggles.filter(function (t) { return T[t.id]; })
        .map(function (t) { return t.id; }).join(' + ') || '(none)'));
    }
    if (CONFIG.tabs.length) {
      GLOBAL.forEach(function (s) {
        lines.push(s.label + ': ' + V.__global[s.key] + (s.source ? '   (' + s.source + ')' : ''));
      });
      CONFIG.tabs.forEach(function (t) {
        lines.push('', '· ' + t.label);
        PERTAB.forEach(function (s) {
          lines.push('  ' + s.label + ': ' + V[t.id][s.key] + (s.source ? '   (' + s.source + ')' : ''));
        });
      });
    } else {
      KNOBS.forEach(function (s) {
        lines.push(s.label + ': ' + V[s.key] + (s.source ? '   (' + s.source + ')' : ''));
      });
    }
    var extra = CONFIG.summary(V, mode);
    if (extra) lines.push('', extra);
    return lines.join('\n');
  }

  function copy(btn) {
    var text = payload();
    var done = function (label) {
      btn.textContent = label || 'Copied';
      setTimeout(function () { btn.textContent = 'Copy'; }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(); },
        function () { manualSheet(text); done('Select it'); });
    } else {
      manualSheet(text);
      done('Select it');
    }
  }

  function manualSheet(text) {
    var old = document.querySelector('.hp-manual');
    if (old) old.remove();
    var wrap = document.createElement('div');
    wrap.className = 'hp-manual';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#000;' +
      'color:#eee;font:12px/1.5 ui-monospace,monospace;padding:12px;box-sizing:border-box;' +
      'display:flex;flex-direction:column;gap:8px';
    var hint = document.createElement('div');
    hint.textContent = 'long-press the text → Copy';
    hint.style.cssText = 'opacity:.6;flex:0 0 auto';
    var pre = document.createElement('pre');
    pre.textContent = text;
    pre.style.cssText = 'flex:1 1 auto;margin:0;overflow:auto;white-space:pre-wrap;' +
      'font:11px/1.45 ui-monospace,monospace;color:#9fe;' +
      'user-select:text;-webkit-user-select:text;-webkit-touch-callout:default';
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;flex:0 0 auto';
    function selectAll() {
      try {
        var r = document.createRange();
        r.selectNodeContents(pre);
        var s = window.getSelection();
        s.removeAllRanges();
        s.addRange(r);
        return true;
      } catch (e) { return false; }
    }
    function mkBtn(label, fn) {
      var b = document.createElement('button');
      b.className = 'hp-btn';
      b.textContent = label;
      var fired = false;
      b.addEventListener('pointerup', function (e) { e.preventDefault(); fired = true; fn(b); });
      b.addEventListener('click', function (e) {
        e.preventDefault();
        if (fired) { fired = false; return; }
        fn(b);
      });
      return b;
    }
    var copyBtn = mkBtn('Copy', function (b) {
      function flash(msg) {
        b.textContent = msg;
        setTimeout(function () { b.textContent = 'Copy'; }, 1600);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          function () { flash('Copied ✓'); },
          function () { flash(selectAll() ? 'Selected — long-press → Copy' : 'Select by hand'); }
        );
        return;
      }
      flash(selectAll() ? 'Selected — long-press → Copy' : 'Select by hand');
    });
    var close = mkBtn('Close', function () { wrap.remove(); });
    row.appendChild(copyBtn); row.appendChild(close);
    wrap.appendChild(hint); wrap.appendChild(pre); wrap.appendChild(row);
    document.body.appendChild(wrap);
    try {
      var r = document.createRange();
      r.selectNodeContents(pre);
      var s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    } catch (e) {}
  }

  var KNOB_GROUPS = [];
  KNOBS.forEach(function (s) {
    var g = s.group || 'main';
    if (KNOB_GROUPS.indexOf(g) < 0) KNOB_GROUPS.push(g);
  });
  CONFIG.modes.forEach(function (m) {
    if (m.group && KNOB_GROUPS.indexOf(m.group) < 0) KNOB_GROUPS.push(m.group);
  });
  var HAS_GROUPS = KNOB_GROUPS.length > 1;
  var group = KNOB_GROUPS[0];

  var CSS =
    '.hp{position:fixed;right:16px;bottom:16px;z-index:2147483647;width:320px;' +
    'max-height:calc(100vh - 32px);display:flex;flex-direction:column;' +
    'font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;background:rgba(0,0,0,.9);' +
    'color:#eee;border:1px solid #444;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.5)}' +
    '.hp-bar{display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid #333;cursor:move;touch-action:none;flex:0 0 auto}' +
    '.hp-title{flex:1;opacity:.6}' +
    '.hp-body{padding:10px 12px;flex:1 1 auto;min-height:0;overflow:auto}' +
    '.hp-btn{background:#222;color:#ddd;border:1px solid #444;border-radius:5px;' +
    'padding:6px 12px;min-height:32px;font:inherit;font-size:13px;cursor:pointer;' +
    'touch-action:manipulation}' +
    '.hp-btn:hover{background:#333}' +
    '.hp-row{margin:0 0 8px}.hp-src{opacity:.45;font-size:10px;line-height:1.35}.hp-v{color:#fff}' +
    '.hp input[type=range]{width:100%;margin-top:2px}' +
    '.hp-tabs{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 10px}' +
    '.hp-tab{background:#1a1a1a;color:#999;border:1px solid #3a3a3a;border-radius:99px;' +
    'padding:3px 9px;font:inherit;cursor:pointer}' +
    '.hp-tab:hover{background:#2a2a2a}' +
    '.hp-modebox>summary{cursor:pointer;opacity:.7;list-style:revert;margin:0 0 6px}' +
    '.hp-modebox[open]>summary{opacity:1}' +
    '.hp-mode{display:block;width:100%;text-align:left;border-radius:6px;padding:7px 10px}' +
    '.hp-mode b{display:inline-block;width:1.2em;opacity:.6}' +
    '.hp-mode[aria-selected=true] b{opacity:1}' +
    '.hp-tab[aria-selected=true]{background:#eee;color:#111;border-color:#eee}' +
    '.hp-knobs{margin:0 0 8px;border-top:1px solid #333;padding-top:8px}' +
    '.hp-knobs>summary{cursor:pointer;opacity:.6;list-style:revert;margin-bottom:8px}' +
    '.hp-knobgrid{display:grid;grid-template-columns:repeat(var(--hp-cols,1),minmax(0,1fr));' +
    'gap:0 14px}' +
    '.hp-outbox{margin-top:8px;padding-top:8px;border-top:1px solid #333}' +
    '.hp-outbox>summary{cursor:pointer;opacity:.5;list-style:revert}' +
    '.hp-out{margin-top:6px;color:#9fe;user-select:all;white-space:pre-wrap}' +
    '.hp-chip{position:fixed;right:16px;bottom:16px;z-index:2147483647;cursor:pointer;' +
    'font:11px ui-monospace,monospace;background:rgba(0,0,0,.85);color:#bbb;' +
    'border:1px solid #444;border-radius:14px;padding:5px 10px}' +
    '@media (max-width:600px){.hp{max-height:34vh}}';

  function buildPanel(doc, popped) {
    var st = doc.createElement('style'); st.textContent = CSS; doc.head.appendChild(st);

    var el = doc.createElement('div');
    el.className = 'hp';
    if (CONFIG.width) el.style.width = CONFIG.width + 'px';
    if (popped) el.style.cssText = 'position:static;width:auto;border:0;box-shadow:none';

    var bar = doc.createElement('div');
    bar.className = 'hp-bar';
    bar.innerHTML = '<span class="hp-title">' + CONFIG.title + '</span>';
    el.appendChild(bar);

    var btns = [
      ['Copy', function (b) { copy(b); }],
      ['Reset', function () {
        if (CONFIG.tabs.length) {
          CONFIG.tabs.forEach(function (t) {
            Object.keys(DEFAULTS[t.id]).forEach(function (k) { V[t.id][k] = DEFAULTS[t.id][k]; });
          });
          Object.keys(DEFAULTS.__global).forEach(function (k) { V.__global[k] = DEFAULTS.__global[k]; });
        } else {
          Object.keys(DEFAULTS).forEach(function (k) { V[k] = DEFAULTS[k]; });
        }
        Object.keys(TDEFAULT).forEach(function (k) { T[k] = TDEFAULT[k]; });
        resetModes(); syncInputs(); run();
      }],
      [popped ? 'Dock' : 'Pop out', function () { popped ? dock() : popOut(); }],
      ['Hide', function () { hide(); }]
    ];
    btns.forEach(function (b) {
      var el2 = doc.createElement('button');
      el2.className = 'hp-btn'; el2.textContent = b[0];
      var fired = false;
      el2.addEventListener('pointerup', function (e) {
        e.preventDefault(); e.stopPropagation();
        fired = true; b[1](el2);
      });
      el2.addEventListener('click', function (e) {
        e.preventDefault();
        if (fired) { fired = false; return; }
        b[1](el2);
      });
      bar.appendChild(el2);
    });

    var body = doc.createElement('div');
    body.className = 'hp-body';
    body.setAttribute('data-lenis-prevent', '');
    body.addEventListener('wheel', function (e) { e.stopPropagation(); }, { passive: true });
    body.addEventListener('touchmove', function (e) { e.stopPropagation(); }, { passive: true });
    el.appendChild(body);

    if (CONFIG.tabs.length) {
      var strip = doc.createElement('div');
      strip.className = 'hp-tabs';
      CONFIG.tabs.forEach(function (t) {
        var b = doc.createElement('button');
        b.className = 'hp-tab'; b.textContent = t.label;
        b.dataset.tab = t.id;
        b.setAttribute('aria-selected', t.id === tab);
        b.onclick = function () { selectTab(t.id); };
        strip.appendChild(b);
      });
      body.appendChild(strip);
    }

    if (HAS_GROUPS) {
      var gstrip = doc.createElement('div');
      gstrip.className = 'hp-tabs hp-groups';
      KNOB_GROUPS.forEach(function (g) {
        var b = doc.createElement('button');
        b.className = 'hp-tab'; b.textContent = g;
        b.dataset.group = g;
        b.setAttribute('aria-selected', g === group);
        b.onclick = function () { selectGroup(g); };
        gstrip.appendChild(b);
      });
      body.appendChild(gstrip);
    }

    MODE_GROUPS.forEach(function (g) {
      var set = CONFIG.modes.filter(function (m) { return (m.group || 'main') === g; });
      if (!set.length) return;
      var legend = doc.createElement('div');
      legend.className = 'hp-row';
      legend.dataset.group = g;
      if (HAS_GROUPS && g !== group) legend.style.display = 'none';
      var det = doc.createElement('details');
      det.className = 'hp-modebox';
      det.dataset.mgroup = g;
      var sum = doc.createElement('summary');
      sum.innerHTML = '<span class="hp-msum" data-mgroup="' + g + '"></span>';
      det.appendChild(sum);
      var mstrip = doc.createElement('div');
      mstrip.className = 'hp-tabs hp-modes';
      var offLabel = (CONFIG.offLabels && CONFIG.offLabels[g]) || 'off / current';
      set.concat([{ key: '0', id: '', label: offLabel }]).forEach(function (m) {
        var b = doc.createElement('button');
        b.className = 'hp-tab hp-mode';
        b.innerHTML = '<b>' + m.key.toUpperCase() + '</b> ' + m.label;
        b.dataset.mode = m.id;
        b.dataset.mgroup = g;
        b.setAttribute('aria-selected', (modeOf(g) || '') === m.id);
        b.onclick = function () { setMode(g, m.id); };
        mstrip.appendChild(b);
      });
      det.appendChild(mstrip);
      legend.appendChild(det);
      body.appendChild(legend);
    });

    if (CONFIG.toggles.length) {
      var trow = doc.createElement('div');
      trow.className = 'hp-row';
      trow.innerHTML = '<div style="opacity:.6">toggles (key)</div>';
      CONFIG.toggles.forEach(function (t) {
        var lab = doc.createElement('label');
        lab.style.cssText = 'display:flex;gap:6px;align-items:center;cursor:pointer';
        var cb = doc.createElement('input');
        cb.type = 'checkbox'; cb.checked = T[t.id]; cb.dataset.t = t.id;
        cb.onchange = function () { T[t.id] = cb.checked; syncInputs(cb); run(); };
        lab.appendChild(cb);
        lab.insertAdjacentHTML('beforeend',
          '<span><b>' + t.key.toUpperCase() + '</b> ' + t.label + '</span>');
        trow.appendChild(lab);
      });
      body.appendChild(trow);
    }

    if (CONFIG.custom) {
      var cbox = doc.createElement('div');
      cbox.className = 'hp-row hp-custom';
      body.appendChild(cbox);
      var csync = CONFIG.custom(cbox, API, doc);
      if (csync) CUSTOM_SYNC.push(csync);
    }

    var knobHost = body;
    if (CONFIG.collapseSliders) {
      var kbox = doc.createElement('details');
      kbox.className = 'hp-knobs';
      var ksum = doc.createElement('summary');
      ksum.textContent = 'sliders — exact values';
      kbox.appendChild(ksum);
      knobHost = doc.createElement('div');
      knobHost.className = 'hp-knobgrid';
      knobHost.style.setProperty('--hp-cols', CONFIG.knobCols || 1);
      kbox.appendChild(knobHost);
      body.appendChild(kbox);
    }

    CONFIG.colors.forEach(function (s) {
      var row = doc.createElement('div');
      row.className = 'hp-row';
      row.dataset.group = s.group || 'main';
      row.dataset.knob = s.key;
      if (!rowVisible(row)) row.style.display = 'none';
      row.innerHTML = '<div>' + s.label + ': <b class="hp-v" data-v="' + s.key + '"></b></div>' +
        (s.source ? '<div class="hp-src">' + s.source + '</div>' : '');
      var inp = doc.createElement('input');
      inp.type = 'color'; inp.value = bag(s.key)[s.key]; inp.dataset.k = s.key;
      inp.style.cssText = 'width:100%;height:26px;margin-top:2px;background:none;border:1px solid #444;border-radius:4px';
      inp.oninput = function () { bag(s.key)[s.key] = inp.value; syncInputs(inp); run(); };
      row.appendChild(inp);
      knobHost.appendChild(row);
    });

    CONFIG.sliders.forEach(function (s) {
      var row = doc.createElement('div');
      row.className = 'hp-row';
      row.dataset.group = s.group || 'main';
      row.dataset.knob = s.key;
      if (!rowVisible(row)) row.style.display = 'none';
      row.innerHTML = '<div>' + s.label + ': <b class="hp-v" data-v="' + s.key + '"></b></div>' +
        (s.source ? '<div class="hp-src">' + s.source + '</div>' : '');
      var inp = doc.createElement('input');
      inp.type = 'range'; inp.min = s.min; inp.max = s.max; inp.step = s.step; inp.value = bag(s.key)[s.key];
      inp.dataset.k = s.key;
      inp.oninput = function () { bag(s.key)[s.key] = +inp.value; syncInputs(inp); run(); };
      row.appendChild(inp);
      knobHost.appendChild(row);
    });

    if (KNOBS.length > 3) {
      var tbox = doc.createElement('details');
      tbox.className = 'hp-outbox';
      var tsum = doc.createElement('summary');
      tsum.textContent = 'trim panel — tick to remove';
      tbox.appendChild(tsum);
      KNOBS.forEach(function (s) {
        var lab = doc.createElement('label');
        lab.style.cssText = 'display:flex;gap:6px;align-items:center;cursor:pointer;margin-top:4px';
        var cb = doc.createElement('input');
        cb.type = 'checkbox'; cb.checked = !!HIDDEN[s.key]; cb.dataset.trim = s.key;
        cb.onchange = function () {
          HIDDEN[s.key] = cb.checked;
          saveTrim();
          eachDoc(function (doc2, el2) {
            var other = el2.querySelector('[data-trim="' + s.key + '"]');
            if (other) other.checked = cb.checked;
          });
          applyTrim();
        };
        lab.appendChild(cb);
        lab.insertAdjacentHTML('beforeend', '<span style="opacity:.7">' + s.label + '</span>');
        tbox.appendChild(lab);
      });
      body.appendChild(tbox);
    }

    var box = doc.createElement('details');
    box.className = 'hp-outbox';
    var sum = doc.createElement('summary');
    sum.textContent = 'payload';
    var out = doc.createElement('div');
    out.className = 'hp-out';
    box.appendChild(sum); box.appendChild(out);
    body.appendChild(box);

    if (!popped) dragify(el, bar);
    return el;
  }

  var API = {
    get: function (k) { return bag(k)[k]; },
    set: function (k, val) { bag(k)[k] = val; syncInputs(); run(); },
    values: function () { return cur(); },
    mode: function (g) { return modeOf(g); },
    toggles: function () { return T; },
    selectTab: function (id) { selectTab(id); },
    tab: function () { return tab; },
    refresh: function () { syncInputs(); run(); }
  };
  var CUSTOM_SYNC = [];

  function eachDoc(fn) {
    fn(document, panel);
    if (win && !win.closed && win.__panel) fn(win.document, win.__panel);
  }

  function selectGroup(g) {
    group = g;
    eachDoc(function (doc, root) {
      if (!root) return;
      root.querySelectorAll('.hp-groups .hp-tab').forEach(function (b) {
        b.setAttribute('aria-selected', b.dataset.group === g);
      });
      root.querySelectorAll('.hp-row[data-group]').forEach(function (r) {
        r.style.display = rowVisible(r) ? '' : 'none';
      });
    });
  }

  function selectTab(id) {
    tab = id;
    eachDoc(function (doc, root) {
      if (!root) return;
      root.querySelectorAll('.hp-tab').forEach(function (b) {
        b.setAttribute('aria-selected', b.dataset.tab === id);
      });
    });
    if (CONFIG.onTab) CONFIG.onTab(id);
    syncInputs(); run();
  }

  function syncInputs(except) {
    eachDoc(function (doc, root) {
      if (!root) return;
      root.querySelectorAll('input[type=range],input[type=color]').forEach(function (i) {
        if (i !== except) i.value = bag(i.dataset.k)[i.dataset.k];
      });
      root.querySelectorAll('input[type=checkbox][data-t]').forEach(function (i) {
        if (i !== except) i.checked = T[i.dataset.t];
      });
      root.querySelectorAll('.hp-mode').forEach(function (b) {
        b.setAttribute('aria-selected', (modeOf(b.dataset.mgroup) || '') === b.dataset.mode);
      });
      root.querySelectorAll('.hp-msum').forEach(function (el) {
        var g = el.dataset.mgroup, id = modeOf(g);
        var m = CONFIG.modes.filter(function (x) { return x.id === id; })[0];
        var off = (CONFIG.offLabels && CONFIG.offLabels[g]) || 'off / current';
        el.innerHTML = (MODE_GROUPED ? g : 'mode') + ': <b style="color:#fff">' +
          (m ? m.label : off) + '</b>';
      });
    });
  }

  function renderReadout() {
    eachDoc(function (doc, root) {
      if (!root) return;
      root.querySelectorAll('b[data-v]').forEach(function (b) { b.textContent = bag(b.dataset.v)[b.dataset.v]; });
      var o = root.querySelector('.hp-out');
      if (o) o.textContent = payload();
    });
    CUSTOM_SYNC.forEach(function (f) { try { f(); } catch (e) {} });
  }

  function dragify(el, handle) {
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(LSKEY)); } catch (e) {}
    if (saved) { el.style.left = saved.x + 'px'; el.style.top = saved.y + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto'; }
    handle.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button')) return;
      var r = el.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
      function move(ev) {
        var x = ev.clientX - dx, y = ev.clientY - dy;
        el.style.left = x + 'px'; el.style.top = y + 'px';
        el.style.right = 'auto'; el.style.bottom = 'auto';
        try { localStorage.setItem(LSKEY, JSON.stringify({ x: x, y: y })); } catch (er) {}
      }
      function up() { removeEventListener('pointermove', move); removeEventListener('pointerup', up); }
      addEventListener('pointermove', move); addEventListener('pointerup', up);
      e.preventDefault();
    });
  }

  function popOut() {
    win = window.open('', CONFIG.title, 'width=380,height=560');
    if (!win) { alert('Popup blocked — allow popups to pop the panel out.'); return; }
    win.document.write('<!doctype html><title>' + CONFIG.title + '</title>' +
      '<body style="margin:0;background:#111;color:#eee"></body>');
    win.document.close();
    var p = buildPanel(win.document, true);
    win.document.body.appendChild(p);
    win.__panel = p;
    win.addEventListener('beforeunload', function () { win = null; show(); });
    win.addEventListener('keydown', keyHandler);
    panel.style.display = 'none';
    syncInputs(); renderReadout();
  }
  function dock() { if (win) { var w = win; win = null; w.close(); } show(); }

  function hide() { panel.style.display = 'none'; chip.style.display = 'block'; }
  function show() { chip.style.display = 'none'; if (!win) panel.style.display = ''; syncInputs(); renderReadout(); }

  function keyHandler(e) {
    var k = (e.key || '').toLowerCase();
    if (k === 'h') { panel.style.display === 'none' && !win ? show() : hide(); return; }
    var t = CONFIG.toggles.filter(function (x) { return x.key.toLowerCase() === k; })[0];
    if (t) { T[t.id] = !T[t.id]; syncInputs(); run(); return; }
    if (!CONFIG.modes.length) {
      if (k === '0' && CONFIG.toggles.length) {
        CONFIG.toggles.forEach(function (x) { T[x.id] = false; });
        syncInputs(); run();
      }
      return;
    }
    if (k === '0') {
      if (MODE_GROUPED) mode[MODE_GROUPS.indexOf(group) < 0 ? MODE_GROUPS[0] : group] = null;
      else mode = null;
      syncInputs(); run(); return;
    }
    var m = CONFIG.modes.filter(function (x) { return x.key.toLowerCase() === k; })[0];
    if (m) setMode(m.group || 'main', m.id);
  }

  var panel = buildPanel(document, false);
  document.body.appendChild(panel);

  var chip = document.createElement('div');
  chip.className = 'hp-chip';
  chip.textContent = CONFIG.title + ' ▸';
  chip.style.display = 'none';
  chip.onclick = show;
  document.body.appendChild(chip);

  addEventListener('keydown', keyHandler);
  syncInputs();
  run();

  if (CONFIG.init) CONFIG.init(API);
})();
