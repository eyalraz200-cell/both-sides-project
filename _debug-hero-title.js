/* ============================================================================
   CANONICAL HARNESS PANEL — base for every `manual/` and `compare/` harness.
   SCAFFOLDING. Copy into the project as _debug-<thing>.js, fill in CONFIG,
   add <script src="_debug-<thing>.js"></script>, delete both when done.

   Guarantees (see ~/.claude/CLAUDE.md "The harness panel"):
     - floating, draggable, position remembered
     - Copy · Reset · Pop out · Hide  — always these four, always this order
     - H toggles hide; hidden state collapses to a chip, never un-dismissable
     - Pop out reopens in a real window that can leave the browser
   ========================================================================== */
(function () {
  if (window.innerWidth < 900) return;   // desktop-only layout
  // ---------------------------------------------------------------- CONFIG --
  var CONFIG = {
    title: 'hero titles (@fold1)',

    // One tab per hero text element — they have different fonts, line counts
    // and dot columns, so each keeps its own three values.
    tabs: [
      { id: 'title', label: 'title' },
      { id: 'subtitle', label: 'subtitle' },
    ],
    tab: 'title',
    onTab: null,

    sliders: [
      { key: 'size', label: 'font-size (px)', min: 10, max: 72, step: 0.5, value: 42,
        source: 'style.css:2265 .page0-title / :2292 .page0-subtitle — the `font:` shorthand' },
      { key: 'lh', label: 'line-height (× size)', min: 0.8, max: 2.2, step: 0.01, value: 1.31,
        source: 'style.css — neither rule sets one today (browser `normal`); a bake adds line-height' },
      { key: 'gap', label: 'gap: last baseline → top dot (px)', min: -20, max: 80, step: 0.5, value: 23.7,
        source: 'style.css:2253 .page0-title top / :2290 .page0-subtitle top — bakes back as calc(50% - Npx)' },
    ],
    // Per-tab starting values — the subtitle ships with a different font, line
    // count and gap, so it can't inherit the title's slider defaults (doing so
    // moved it 10px on load, which is exactly what a harness must never do).
    // Kept in sync with what style.css actually ships, so re-enabling the
    // panel reproduces the baked hero exactly (baked 2026-09-07).
    values: {
      title:    { size: 42, lh: 1.31, gap: 23.73 },
      subtitle: { size: 18, lh: 1.52, gap: 20 },
    },

    colors: [], modes: [], mode: null,

    // One switch for ALL rulers — the user asked to flip them together, not
    // per element. `R` (or the panel checkbox) toggles the whole set.
    toggles: [
      { id: 'rTitle',    label: 'rulers: title',    key: 'R', on: true },
      { id: 'rSubtitle', label: 'rulers: subtitle', key: 'S', on: true },
    ],

    // The gap is not a CSS property, and it is measured from the text's own
    // TRIMMED bottom edge — the last line's alphabetic baseline — not from the
    // element's box bottom. A line box is taller than its ink: it carries the
    // descender plus half-leading above and below, and BOTH grow with
    // line-height. Measuring the box bottom therefore made the gap knob move
    // whenever line-height moved, and made the title's and subtitle's numbers
    // incomparable (9.7 vs 19.7 for what the eye reads as the same distance;
    // trimmed, the same shipped layout reads 23.7 vs 24.7). Trimmed, the knob
    // is pure ink-to-dot spacing and the two elements align on one scale.
    apply: function (v, mode, tab, on) {
      var SUBS = {
        title:    { sel: '.page0-title',    startOffsetY: 0 },
        subtitle: { sel: '.page0-subtitle', startOffsetY: 2 * PAGE0_DOT_STEP },
      };
      Object.keys(SUBS).forEach(function (id) {
        var el = document.querySelector(SUBS[id].sel);
        if (!el) return;
        var vals = v[id];
        el.style.fontSize = vals.size + 'px';
        el.style.lineHeight = vals.lh;
        // .page0-dot centres sit on the 17px lattice; its TOP edge is half a
        // square above the first centre. Same math as page1.js's buildPage0Dots.
        var dotTop = window.innerHeight / 2 - page0DotBaseOffsetY()
                   + SUBS[id].startOffsetY - PAGE0_DOT_SQ / 2;
        // Measure the last baseline as an OFFSET from the element's own box
        // top, never as an absolute y: @fold1's intro parks the title at
        // `transform: translateY(100vh)` and slides it in, so absolute rects
        // are a full viewport off until that finishes — placing against them
        // threw the hero ~900px up on load.
        var r = el.getBoundingClientRect();
        var bl = window.__heroBaselines ? window.__heroBaselines(el) : null;
        var off = (bl && bl.length) ? bl[bl.length - 1] - r.top : r.height;
        el.style.top = (dotTop - vals.gap - off) + 'px';
      });
      window.__heroRulersOn = on || null;
      if (window.__heroSyncRulers) window.__heroSyncRulers();
    },

    // The gap is computed from a MEASURED height, so it has to be recomputed
    // whenever that height can change: once the webfonts land (before they do,
    // the fallback face wraps the subtitle to 5 lines and the gap lands a whole
    // line off) and on every resize (the dot lattice is anchored to vh/2).
    init: function (api) {
      document.fonts.ready.then(function () { api.refresh(); });
      window.addEventListener('resize', function () { api.refresh(); });

      /* ---- rulers ---------------------------------------------------------
         A line box has no element of its own, so there is nothing to measure
         with getBoundingClientRect. A Range over the element's text DOES
         expose one rect per rendered line (getClientRects), which is the only
         way to find where each line actually sits after wrapping. Each rule is
         drawn at that line's TRIMMED bottom — its alphabetic baseline, i.e.
         rect.top + half-leading + ascent, with the font's own ascent/descent
         read off a canvas TextMetrics — so the rules sit on the ink the eye
         aligns to, not on the invisible descender + leading below it.
         The hero texts are position:fixed and page0ApplyTitleScrollLag nudges
         them every frame, so the rules are re-synced in a rAF loop rather
         than only when a knob moves. */
      var layer = document.createElement('div');
      layer.id = 'hero-ruler-layer';
      layer.style.cssText = 'position:fixed;inset:0;z-index:99998;pointer-events:none';
      document.body.appendChild(layer);
      var pool = [];

      var mctx = document.createElement('canvas').getContext('2d');

      function lineRects(el) {
        if (!el) return [];
        var r = document.createRange();
        r.selectNodeContents(el);
        // Sub-pixel duplicates: two rects on the same line are one line.
        var out = [], seen = {};
        Array.prototype.forEach.call(r.getClientRects(), function (rc) {
          if (rc.height < 1) return;
          var k = Math.round(rc.bottom * 2);
          if (seen[k]) return;
          seen[k] = 1; out.push(rc);
        });
        return out;
      }
      window.__heroLineCount = function (sel) {
        return lineRects(document.querySelector(sel)).length;
      };
      /* One alphabetic baseline y per rendered line — the trimmed bottom. */
      window.__heroBaselines = function (el) {
        var rects = lineRects(el);
        if (!rects.length) return [];
        var cs = getComputedStyle(el);
        mctx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
        var tm = mctx.measureText('Hg');
        var asc = tm.fontBoundingBoxAscent, desc = tm.fontBoundingBoxDescent;
        if (!asc) { asc = parseFloat(cs.fontSize) * 0.8; desc = parseFloat(cs.fontSize) * 0.2; }
        return rects.map(function (rc) {
          return rc.top + (rc.height - (asc + desc)) / 2 + asc;   // half-leading + ascent
        });
      };

      window.__heroSyncRulers = function () {
        var on = window.__heroRulersOn || {};
        var rows = [];
        [['.page0-title', '#e0245e', 'rTitle'], ['.page0-subtitle', '#1f8fff', 'rSubtitle']]
          .forEach(function (row) {
            if (on[row[2]] === false) return;
            var el = document.querySelector(row[0]);
            window.__heroBaselines(el).forEach(function (y, i) {
              rows.push({ y: y, color: row[1], label: row[0].slice(6) + ' L' + (i + 1) });
            });
          });
        while (pool.length < rows.length) {
          var d = document.createElement('div');
          d.style.cssText = 'position:absolute;left:0;right:0;height:0;'
            + 'border-top:1px dashed currentColor;opacity:.65';
          d.innerHTML = '<span style="position:absolute;left:4px;top:-13px;'
            + 'font:10px/1 ui-monospace,Menlo,monospace;direction:ltr"></span>';
          layer.appendChild(d); pool.push(d);
        }
        pool.forEach(function (d, i) {
          if (i >= rows.length) { d.style.display = 'none'; return; }
          d.style.display = '';
          d.style.top = rows[i].y + 'px';
          d.style.color = rows[i].color;
          d.firstChild.textContent = rows[i].label;
        });
      };

      (function tick() { window.__heroSyncRulers(); requestAnimationFrame(tick); })();
    },

    /* Live line counts — the wrap point is what the line-height and size knobs
       actually move, so it's a readout, not a knob. */
    custom: function (box, api, doc) {
      var el = doc.createElement('div');
      el.style.cssText = 'margin-top:8px;opacity:.75;direction:ltr;font:11px/1.6 ui-monospace,Menlo,monospace';
      box.appendChild(el);
      (function tick() {
        if (!el.isConnected) return;
        // custom() runs while the panel is being built, BEFORE init() — so the
        // measuring helper may not exist for the first few frames.
        var n = window.__heroLineCount;
        el.textContent = !n ? 'lines — …'
          : 'lines — title: ' + n('.page0-title') + '   subtitle: ' + n('.page0-subtitle');
        requestAnimationFrame(tick);
      })();
    },
    width: 360, collapseSliders: false, knobCols: 1,

    // Copy emits both subjects, and the `top` each one resolves to at the
    // tuning viewport — the value that actually gets baked.
    summary: function (v) {
      var out = [];
      [['title', '.page0-title', 0], ['subtitle', '.page0-subtitle', 2 * PAGE0_DOT_STEP]]
        .forEach(function (row) {
          var el = document.querySelector(row[1]);
          var top = el ? Math.round(el.getBoundingClientRect().top * 10) / 10 : null;
          var above = Math.round((window.innerHeight / 2 - top) * 10) / 10;
          out.push(row[1] + ' { font-size: ' + v[row[0]].size + 'px; line-height: '
                 + v[row[0]].lh + '; top: calc(50% - ' + above + 'px); }'
                 + '   /* gap ' + v[row[0]].gap + 'px, measured at '
                 + window.innerWidth + '×' + window.innerHeight + ', '
                 + (window.__heroLineCount ? window.__heroLineCount(row[1]) : '?') + ' lines */');
        });
      return out.join('\n');
    }
  };
  // ------------------------------------------------------------ END CONFIG --

  var style = document.createElement('style');
  document.head.appendChild(style);
  CONFIG.style = style;   // handy inside apply()

  CONFIG.colors = CONFIG.colors || [];
  CONFIG.tabs = CONFIG.tabs || [];
  var KNOBS = CONFIG.sliders.concat(CONFIG.colors);

  /* `global: true` knobs are shared by every tab. They live on V.__global; the
     per-tab sets hold only the rest. With no tabs everything is flat anyway. */
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
  /* PER-TAB seeds. `CONFIG.values = { tabId: { key: value } }` overrides the
     slider's own default for that tab only — how a harness starts from the
     values already baked into the stylesheet instead of from a flat default. */
  if (CONFIG.values) {
    Object.keys(CONFIG.values).forEach(function (id) {
      if (!V[id]) return;
      Object.keys(CONFIG.values[id]).forEach(function (k) {
        V[id][k] = DEFAULTS[id][k] = CONFIG.values[id][k];
      });
    });
  }

  var tab = CONFIG.tabs.length ? (CONFIG.tab || CONFIG.tabs[0].id) : null;
  /* The knob values the panel is editing right now — the active tab's set, or
     the flat set when the harness has no tabs. */
  function cur() { return tab ? V[tab] : V; }
  /* The bag a single knob lives in — globals never go per-tab. */
  function bag(k) { return (tab && IS_GLOBAL[k]) ? V.__global : cur(); }

  /* Modes: flat (one exclusive list) or GROUPED (one exclusive list per knob
     group). Grouped harnesses hand apply() a { group: id|null } map. */
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

  /* Independent switches. T is the live { id: bool } map handed to apply(). */
  CONFIG.toggles = CONFIG.toggles || [];
  var T = {}, TDEFAULT = {};
  CONFIG.toggles.forEach(function (t) { T[t.id] = TDEFAULT[t.id] = !!t.on; });

  var LSKEY = 'harness:' + CONFIG.title;

  /* TRIM — knobs the user has ticked away. A harness accretes knobs, and a long
     list makes the two you are actually judging hard to find. Trimming only
     HIDES a row: its value stays live and stays in the Copy payload, so nothing
     silently changes when you tidy the panel. Persisted next to the position,
     per panel title. */
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
  /* A row is visible only if it is neither trimmed away nor filtered out by the
     active knob group — both conditions have to be re-tested on every change,
     which is why this is one function rather than a bare display flip. */
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
  var win = null;          // popped-out window, if any

  function run() {
    CONFIG.apply(V, mode, tab, T);
    renderReadout();
  }

  // ------------------------------------------------------------------ copy --
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
    /* navigator.clipboard exists only in a SECURE CONTEXT — https or localhost.
       A harness opened on a phone over http://<lan-ip>:8080 (the normal way to
       test a mobile-only panel) has no clipboard API at all. There is NO
       scripted substitute there: iOS's execCommand('copy') returns true and
       copies nothing, so trying it just reports a success that never happened.
       When the API is missing we go straight to the manual sheet, which always
       works, instead of pretending. */
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(); },
        function () { manualSheet(text); done('Select it'); });
    } else {
      manualSheet(text);
      done('Select it');
    }
  }

  /* The payload, full-screen and pre-selected, for the reader to copy by hand.
     The whole text is put in the document selection on open, so ONE long-press
     inside it raises Safari's Copy straight away — no Select All step. */
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
    /* -webkit-user-select/-webkit-touch-callout are forced back ON: the mobile
       stylesheet kills both page-wide to stop iOS hijacking the press-and-hold
       picker, and inherited `none` would make this sheet impossible to select. */
    var pre = document.createElement('pre');
    pre.textContent = text;
    pre.style.cssText = 'flex:1 1 auto;margin:0;overflow:auto;white-space:pre-wrap;' +
      'font:11px/1.45 ui-monospace,monospace;color:#9fe;' +
      'user-select:text;-webkit-user-select:text;-webkit-touch-callout:default';
    /* Copy · Close, in that order, mirroring the panel bar. Copy re-tries the
       clipboard API (a sheet opened after a rejected write may still succeed on
       a later user gesture) and otherwise re-selects the whole payload — the
       selection made on open is lost the moment the reader scrolls the pane or
       taps a word, and re-making it by hand on a phone is the fiddly part. Both
       buttons run on pointerup for the same reason the panel's do. */
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

  /* Knob KNOB_GROUPS. Any slider/colour may carry `group: 'shadow'`; when at least one
     does, the body shows a second pill strip that filters rows to one group at a
     time — the cure for a panel taller than the viewport. Ungrouped knobs fall
     into 'main'. Groups are independent of CONFIG.tabs (which switch TARGETS). */
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

  // ------------------------------------------------------------------- UI ---
  var CSS =
    /* The panel is capped to the viewport and column-flexed so the BODY takes
   the overflow — otherwise a long knob list runs off the bottom edge
   (and dragging it upward just moved the clipping). */
    '.hp{position:fixed;right:16px;bottom:16px;z-index:2147483647;width:320px;' +
    'max-height:calc(100vh - 32px);display:flex;flex-direction:column;' +
    'font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;background:rgba(0,0,0,.9);' +
    'color:#eee;border:1px solid #444;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.5)}' +
    '.hp-bar{display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid #333;cursor:move;touch-action:none;flex:0 0 auto}' +
    '.hp-title{flex:1;opacity:.6}' +
    '.hp-body{padding:10px 12px;flex:1 1 auto;min-height:0;overflow:auto}' +
    '.hp-btn{background:#222;color:#ddd;border:1px solid #444;border-radius:5px;' +
    // Sized for a thumb, not a mouse: 32px tall clears iOS's tap-target floor,
    // so the bar buttons can be hit on a phone without zooming or catching the
    // drag bar underneath.
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
    /* CONFIG.collapseSliders — the knob rows fold into one <details> so a wide
       panel leads with its custom UI instead of a wall of sliders. */
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
    /* On a phone the panel shares the screen with the very thing it tunes, so
       cap it at a third of the viewport and let the body scroll inside that.
       Last in the sheet so it wins over .hp's own max-height without !important. */
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

    // FIXED button order: Copy · Reset · Pop out · Hide
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
      // Fire on pointerup, not click. iOS withholds the synthesized click when
      // the tap overlaps page-level touch handling (and the bar is itself a drag
      // handle), which makes a bar button need several presses on a phone.
      // pointerup arrives regardless; the flag swallows any click that follows
      // so a desktop mouse doesn't run the action twice.
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
    /* Lenis (and any other smooth-scroll wrapper) swallows wheel events page-wide
       and drives ONE scroller, so a scrollable overlay silently refuses to move.
       data-lenis-prevent tells it to leave this subtree alone; the stopPropagation
       fallback covers the same case for libraries without that opt-out. Harmless
       on a page with no smooth-scroll at all. */
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

    /* One list per mode group, each COLLAPSED to its current pick — an open
       dozen-option list is the thing that makes a panel unreadable. */
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

    /* Independent switches: a checkbox each, labelled with its keyboard key.
       Rendered above the knobs — they decide WHAT runs; the sliders tune it. */
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

    /* OPTIONAL custom UI (a timeline, a curve editor, a preview) — built into
       the panel body itself, so it drags, pops out and hides with everything
       else instead of being a second floating thing. */
    if (CONFIG.custom) {
      var cbox = doc.createElement('div');
      cbox.className = 'hp-row hp-custom';
      body.appendChild(cbox);
      var csync = CONFIG.custom(cbox, API, doc);
      if (csync) CUSTOM_SYNC.push(csync);
    }

    /* Where the knob rows go: straight into the body, or into a collapsed
       <details> with an optional multi-column grid (CONFIG.collapseSliders /
       CONFIG.knobCols). */
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

    /* TRIM list — one tick per knob, "remove this row". Collapsed, and last
       before the payload, so it never competes with the knobs themselves. */
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
          /* Mirror the tick into a popped-out copy, then re-test every row. */
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

    /* The full paste-ready payload is the tallest thing in the panel, and it is
       only read at bake time — so it lives in a COLLAPSED <details>. Copy still
       puts the same text on the clipboard whether it is open or shut. */
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

  /* Handed to CONFIG.init() and CONFIG.custom() — the harness's only supported
     way to read/write knob values from its own UI. */
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
  /* Redraw callbacks returned by CONFIG.custom(), one per live panel copy
     (the docked one and any popped-out one) — called on every value change so
     custom UI stays in step with the sliders. */
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
      /* rowVisible, not a bare group test — otherwise switching groups would
         un-hide rows the user trimmed away. */
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

  // ---------------------------------------------------------------- drag ----
  function dragify(el, handle) {
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(LSKEY)); } catch (e) {}
    if (saved) { el.style.left = saved.x + 'px'; el.style.top = saved.y + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto'; }
    /* Pointer events, not mouse — so the panel drags on a phone too. */
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

  // ------------------------------------------------------------- pop out ----
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

  // ---------------------------------------------------------- hide / show ---
  function hide() { panel.style.display = 'none'; chip.style.display = 'block'; }
  function show() { chip.style.display = 'none'; if (!win) panel.style.display = ''; syncInputs(); renderReadout(); }

  function keyHandler(e) {
    var k = (e.key || '').toLowerCase();
    if (k === 'h') { panel.style.display === 'none' && !win ? show() : hide(); return; }
    var t = CONFIG.toggles.filter(function (x) { return x.key.toLowerCase() === k; })[0];
    if (t) { T[t.id] = !T[t.id]; syncInputs(); run(); return; }
    if (!CONFIG.modes.length) {
      /* With toggles but no modes, 0 still means "everything off". */
      if (k === '0' && CONFIG.toggles.length) {
        CONFIG.toggles.forEach(function (x) { T[x.id] = false; });
        syncInputs(); run();
      }
      return;
    }
    if (k === '0') {
      /* Clears the list you're looking at (all of them, when ungrouped). */
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
