/* ============================================================================
   HARNESS — SCAFFOLDING, never ships. Built from ~/.claude/templates/harness-panel.js.
   ========================================================================== */
(function () {
  // ---------------------------------------------------------------- CONFIG --
  var CONFIG = {
    title: 'pick13-size',
    label: 'fold 13: how big the picked dot grows',
    fold: '@fold13',
    viewport: 'mobile',
    remoteOnly: true,
    tabs: [], tab: null, onTab: null,
    modes: [], mode: null, toggles: [],

    /* On this fold every pick grows to ONE size (not the crowd ladder — size
       means nothing here). The dots sit on a 2px pitch, so 12px covers a 6x6
       neighbourhood; the glass zooms out a little as it grows. Press and hold a
       dot in a column to see it. */
    sliders: [
      { key: 'sq', label: 'the picked dot: how big it grows (px on the canvas)', min: 2, max: 24, step: 0.5, value: 12,
        source: 'page9.js — P9_PICK_SQ_M' },
    ],
    colors: [],

    apply: function (v) {
      P9_PICK_SQ_M = v.sq;
      if (typeof draw === 'function') draw();
    },

    init: null, custom: null, timeline: null,
    goTo: '#page-12', goLabel: '@fold13',
    /* Drop two categories so there are columns to pick from. */
    onGo: function () {
      if (typeof p9 !== 'undefined' && typeof p9RestoreDrops === 'function' &&
          p9.sides && p9.sides.every(function (s) { return s !== 'above'; })) p9RestoreDrops([0, 4]);
    },
    width: 0, collapseSliders: false, knobCols: 1,
    summary: function (v) { return 'var   P9_PICK_SQ_M     = ' + v.sq + ';'; }
  };
  // ------------------------------------------------------------ END CONFIG --

  /* The file this harness lives in — what the panel's Delete button reports, so
     Claude knows which _debug-*.js (and <script> tag) to remove. Read now, while
     the script is still executing: currentScript is null afterwards. Lives
     BELOW the config-end marker on purpose — a harness is regenerated as its
     own head (up to that marker) plus this template's tail, so anything above
     the marker never reaches an existing harness. */
  var FILE = (document.currentScript && document.currentScript.src)
    ? document.currentScript.src.split('/').pop().split('?')[0] : null;

  // ------------------------------------------------------------- VIEWPORT --
  var MQ_MOBILE = '(max-width: 600px)';
  (function (boot) {
    var want = CONFIG.viewport || 'both';
    if (want === 'both') return boot();
    var mq = window.matchMedia(MQ_MOBILE);
    var ok = function () { return want === 'mobile' ? mq.matches : !mq.matches; };
    if (ok()) return boot();
    /* DORMANT: the wrong breakpoint for this harness. It does not inject, but it
       still answers discovery — as dormant, with its breakpoint — so the panel
       can list it greyed out ("mobile only") instead of showing an empty rail
       that reads as "nothing exists". */
    var dormant = null;
    try { if (window.HBus) dormant = HBus('harness:__all__'); } catch (e) {}
    if (dormant) dormant.onmessage = function (ev) {
      if ((ev.data || {}).t !== 'who') return;
      try {
        dormant.postMessage({ t: 'iam', title: CONFIG.title, dormant: true, viewport: want,
                              label: CONFIG.label || CONFIG.title,
      file: FILE,
                              fold: CONFIG.fold || ((/@fold\s*\d+/i.exec(CONFIG.goLabel || '') || [null])[0]) });
      } catch (e) {}
    };
    var onMQ = function () {
      if (!ok()) return;
      mq.removeEventListener('change', onMQ);
      if (dormant) { dormant.onmessage = null; }
      boot();
    };
    mq.addEventListener('change', onMQ);
  })(function () {

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
  var lastModeGroup = null;   // the mode group the last key/click touched — what `0` clears
  function setMode(g, id) {
    lastModeGroup = g;
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

  /* STATE PERSISTENCE — modes, slider values, toggles and the active tab are
     saved per panel title on every change and restored on boot. Without this a
     dev-server auto-reload (every file edit!) silently reset the harness to the
     shipped defaults, and the next Copy reported a pick the user never made. */
    var STATEKEY = LSKEY + ':state';
  function saveState() {
    try { localStorage.setItem(STATEKEY, JSON.stringify({ V: V, mode: mode, T: T, tab: tab })); } catch (er) {}
  }
  function restoreState() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(STATEKEY)); } catch (er) {}
    if (!s || typeof s !== 'object') return;
    function merge(dst, src) {
      if (!dst || !src) return;
      Object.keys(dst).forEach(function (k) {
        if (!(k in src)) return;
        if (dst[k] && typeof dst[k] === 'object' && !Array.isArray(dst[k])) merge(dst[k], src[k]);
        else dst[k] = src[k];
      });
    }
    merge(V, s.V);
    if (MODE_GROUPED) {
      /* A harness whose modes were UNGROUPED when this state was written saved
         `mode` as a bare id STRING. Merging that into the {group: id} map threw
         ("Cannot use 'in' operator to search for 'frame' in note") and took the
         whole harness down on load — it rendered as mode 0, with none of its
         CSS applied and no error the user could connect to it. Re-home a legacy
         id onto whichever group declares it; drop it if none does. */
      var sm = s.mode;
      if (typeof sm === 'string') {
        var owner = CONFIG.modes.filter(function (m) { return m.id === sm; })[0];
        var re = {};
        if (owner) re[owner.group || 'main'] = sm;
        sm = re;
      }
      merge(mode, sm || {});
    } else if ('mode' in s) mode = s.mode;
    merge(T, s.T);
    if (s.tab && CONFIG.tabs.some(function (t) { return t.id === s.tab; })) tab = s.tab;
  }

  function run() {
    CONFIG.apply(V, mode, tab, T);
    renderReadout();
    postState();
    saveState();
  }

  // ------------------------------------------------------------------ copy --
  /* A slider may declare when(mode, T) — false means it has no effect right now. */
  function applies(s) {
    if (typeof s.when === 'function' && !s.when(mode, T)) return false;
    /* `modes: ['a','b']` — declarative: the knob only matters while one of those
       modes is picked (in any group). No list = always relevant. */
    if (Array.isArray(s.modes) && s.modes.length) {
      var picked = MODE_GROUPED ? MODE_GROUPS.map(function (g) { return mode[g]; }) : [mode];
      if (!s.modes.some(function (id) { return picked.indexOf(id) >= 0; })) return false;
    }
    return true;
  }
  /* Knobs whose when() is false right now: the remote hides their sliders, so the
     panel only ever shows the controls that actually do something in the current
     combination. A dead slider on screen is a knob you turn and nothing moves. */
  function offKeys() {
    return KNOBS.filter(function (s) { return !applies(s); }).map(function (s) { return s.key; });
  }
  function payload() {
    /* `summaryOnly: true` — Copy is just the bake line. The mode list and the
       knob-by-knob dump are the harness talking about itself; what gets pasted
       into chat is the pick. */
    if (CONFIG.summaryOnly) return CONFIG.summary(V, mode) || '';
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
      /* Only the knobs that DO something in the current mode. A payload that
         lists every knob buries the pick under settings the modes ignore. */
      KNOBS.filter(applies).forEach(function (s) {
        lines.push(s.label + ': ' + V[s.key]);
      });
    }
    var extra = CONFIG.summary(V, mode, tab, T);
    if (extra) lines.push('', extra);
    return lines.join('\n');
  }

  function copy(btn) {
    checkpoint();
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
  // Which bottom corner the panel and its hidden chip start in. Bottom-right by
  // default (the house corner); set CONFIG.dock = 'left' when the fold's own UI
  // lives on the right — a panel parked over it silently eats every click on it.
  var DOCK = CONFIG.dock === 'left' ? 'left' : 'right';
  var CSS =
    /* The panel is capped to the viewport and column-flexed so the BODY takes
   the overflow — otherwise a long knob list runs off the bottom edge
   (and dragging it upward just moved the clipping). */
    '.hp{position:fixed;' + DOCK + ':16px;bottom:16px;z-index:2147483647;width:320px;' +
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
    '.hp-chip{position:fixed;' + DOCK + ':16px;bottom:16px;z-index:2147483647;cursor:pointer;' +
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

    // FIXED button order: Go · Copy · Reset · Pop out · Hide
    // (Go is present only when CONFIG.goTo is set.)
    var btns = [];
    if (CONFIG.goTo) {
      btns.push([CONFIG.goLabel || 'Go', function (b) { goToTarget(b); }]);
    }
    btns = btns.concat([
      ['Copy', function (b) { copy(b); }],
      ['Reset', function (b, ev) { doReset(!!(ev && ev.shiftKey)); }],
      [popped ? 'Dock' : 'Pop out', function () { popped ? dock() : popOut(); }],
      ['Hide', function () { hide(); }]
    ]);
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
        fired = true; b[1](el2, e);
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
      /* A mode list only follows the knob tabs if its group IS one of them.
         Ungrouped modes (the common case) belong to no tab and must stay
         visible under every one of them — hiding them left a panel whose knobs
         were tabbed and whose modes could not be reached at all. */
      if (KNOB_GROUPS.indexOf(g) >= 0) {
        legend.dataset.group = g;
        if (HAS_GROUPS && g !== group) legend.style.display = 'none';
      }
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
      var dead = offKeys();
      root.querySelectorAll('input[type=range],input[type=color]').forEach(function (i) {
        if (i !== except) i.value = bag(i.dataset.k)[i.dataset.k];
        /* Same rule as the remote: an inert knob's row is not on screen. */
        var row = i.closest('.hp-row') || i.parentNode;
        if (row) row.hidden = dead.indexOf(i.dataset.k) >= 0;
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

  // ------------------------------------------------------------ teleport ----
  // Scroll to the fold this harness tunes. ANIMATED, never an instant jump: a
  // jump skips every pinned/scrubbed ScrollTrigger it passes and latches those
  // sections into their end state, so later folds sit stuck on screen and the
  // page looks broken because of the harness. ScrollTrigger.refresh() after the
  // scroll settles puts the pins back in sync. Only ever runs on a click.
  function goTarget() {
    var t = CONFIG.goTo;
    var el = typeof t === 'function' ? t() : document.querySelector(t);
    if (!el) return null;
    return el;
  }
  function goToTarget(btn) {
    var base = (btn && btn.textContent) || CONFIG.goLabel || 'Go';
    var say = function (m) {
      if (!btn) return;
      btn.textContent = m;
      setTimeout(function () { btn.textContent = base; }, 1200);
    };
    var el = goTarget();
    if (!el) { say('not found'); return; }
    var top = el.getBoundingClientRect().top + scrollY;
    scrollTo({ top: top, behavior: 'smooth' });
    // Settle detection: refresh once the page stops moving.
    var last = -1, still = 0;
    (function tick() {
      if (scrollY === last) { still++; } else { still = 0; last = scrollY; }
      if (still < 8) return requestAnimationFrame(tick);
      if (window.ScrollTrigger && ScrollTrigger.refresh) ScrollTrigger.refresh();
      if (typeof CONFIG.onGo === 'function') { try { CONFIG.onGo(el); } catch (er) {} }
      say('there ✓');
    })();
  }

  // ------------------------------------------------------------- pop out ----
  // --------------------------------------------------------- remote panel --
  // Pop out needs window.open, and some embedded browsers (VS Code's built-in
  // one above all) are sandboxed webviews that refuse it outright — there is no
  // popup permission to grant there, so the button can never produce a window.
  // The remote panel is the way out: a SECOND TAB at _debug-panel.html renders
  // the same controls and drives this page over the _debug-bus.js relay. That
  // relay goes through the dev server, NOT BroadcastChannel, so the panel can
  // live on the laptop while this page runs on a phone. Two clients
  // side by side puts the panel fully outside the emulated device, which is the
  // whole point of Pop out, without needing a separate window.
  /* No `?t=` here on purpose. That parameter narrows the tab to ONE named harness,
     and handing it out meant the tab silently hid every other harness on the page.
     The bare URL hosts them all; add ?t=<title> by hand for the rare solo case. */
  var REMOTE_URL = '_debug-panel.html';
  var remoteOn = false;
  var CHAN = null;
  try { if (window.HBus) CHAN = HBus('harness:' + CONFIG.title); } catch (e) {}
  /* Discovery. A page can carry several harnesses at once, and opening one tab
     per panel is exactly the chore the remote was meant to remove — so the
     remote tab asks 'who is here' on one shared channel and every harness
     answers with its title. One tab then hosts them all. */
  var DISC = null, TRASHED = false;
  try { if (window.HBus) DISC = HBus('harness:__all__'); } catch (e) {}
  function announce() {
    if (TRASHED) return;
    var a = readAuto();
    try {
      DISC.postMessage({ t: 'iam', title: CONFIG.title, inst: INST,
                         foldBadge: foldBadgeState(),
                         autoReload: a ? a.on : null, behind: a ? a.behind : 0 });
    } catch (e) {}
  }
  /* PAGE-WIDE controls ride the discovery channel rather than a harness's own:
     they belong to the page, not to one panel, and the remote tab shows them
     once. `foldbadge` drives the dev fold badge (js/nav.js) — the number in the
     top-left corner sits over the artwork, so it has to be switchable from the
     tab like anything else the harness paints. */
  function foldBadgeState() {
    var b = document.getElementById('foldNumberBadge');
    return b ? b.classList.contains('is-visible') : null;
  }
  /* The dev auto-reload (reload.js) is the other page-wide switch: several
     sessions edit one checkout, so every save reloads every tab — including the
     one being tuned. Off freezes this page; reload.js paints its own "N changes"
     chip so a frozen tab is never silently stale. */
  function readAuto() {
    try { return window.autoReloadState ? window.autoReloadState() : null; } catch (e) { return null; }
  }
  if (DISC) DISC.onmessage = function (ev) {
    var m = ev.data || {};
    if (m.t === 'who') announce();
    if (m.t === 'foldbadge' && typeof setFoldBadgeVisible === 'function') {
      setFoldBadgeVisible(!!m.on);
      announce();
    }
    if (m.t === 'reloadnow' && window.reloadNow) { window.reloadNow(); return; }
    if (m.t === 'autoreload' && window.setAutoReload) {
      // Switching it back ON reloads the page immediately when it is behind, so
      // this may well be the last thing this instance ever does.
      window.setAutoReload(!!m.on);
      announce();
    }
  };

  /* INSTANCE ID. Every page running this harness on the same dev server (the
     phone, a laptop tab, a headless probe) shares one bus channel. Without an
     id the panel tab adopted whichever page echoed its state last and the
     controls "moved on their own". Every message out carries `inst`; commands
     in carry `to`, and a command addressed to another page is ignored. */
  /* Per-TAB, not per-load: the remote addresses commands to this id, and the
     dev server reloads the page on every file edit. A fresh id per load left the
     remote talking to a dead host for its 6s grace period — every click in that
     window silently dropped, its buttons drifting from the page. */
  var INST = null;
  try { INST = sessionStorage.getItem('harness:inst'); } catch (er) {}
  if (!INST) {
    INST = Math.random().toString(36).slice(2, 8);
    try { sessionStorage.setItem('harness:inst', INST); } catch (er) {}
  }
  function post(m) { m.inst = INST; if (CHAN) try { CHAN.postMessage(m); } catch (e) {} }
  /* Trailing-throttled: a slider drag runs apply() dozens of times a second and
     each echo was its own POST — a storm the remote then had to survive. */
  var stateT = null;
  function postState() {
    if (!remoteOn || stateT) return;
    stateT = setTimeout(function () {
      stateT = null;
      if (remoteOn) post({ t: 'state', V: V, mode: mode, T: T, tab: tab, group: group, off: offKeys() });
    }, 80);
  }
  /* Drop a 'set' that arrives after a newer one for the same key. */
  var setSeq = {};
  function staleSet(m) {
    if (typeof m.seq !== 'number') return false;
    if (setSeq[m.key] !== undefined && m.seq < setSeq[m.key]) return true;
    setSeq[m.key] = m.seq; return false;
  }
  /* Everything the remote tab needs to draw the panel. It knows nothing about
     this project — it renders whatever this describes, so one generic page
     serves every harness. */
  function descriptor() {
    return {
      title: CONFIG.title,
      /* What the rail calls this harness. A NAME FOR A PERSON — "axis draw-in",
         "legend sheet colour" — not the file's slug. CONFIG.title stays the bus
         channel and the Copy header; this is the label a human reads. */
      label: CONFIG.label || CONFIG.title,
      file: FILE,
      viewport: CONFIG.viewport || 'both',
      /* The fold this harness tunes — shown on its pill in the remote tab, so a
         strip of harnesses reads as folds, not just names. Taken from
         CONFIG.fold when set, else lifted out of the Go label ("@fold8 fly"). */
      fold: CONFIG.fold || ((/@fold\s*\d+/i.exec(CONFIG.goLabel || '') || [null])[0]),
      goLabel: CONFIG.goTo ? (CONFIG.goLabel || 'Go') : null,
      tabs: CONFIG.tabs.map(function (t) { return { id: t.id, label: t.label }; }),
      modeGrouped: MODE_GROUPED,
      modeGroups: MODE_GROUPS,
      offLabels: CONFIG.offLabels || {},
      modes: CONFIG.modes.map(function (m) {
        return { key: m.key, id: m.id, label: m.label, group: m.group || 'main' };
      }),
      toggles: CONFIG.toggles.map(function (t) {
        return { id: t.id, key: t.key, label: t.label };
      }),
      knobs: KNOBS.map(function (s) {
        return {
          key: s.key, label: s.label, source: s.source || '',
          color: CONFIG.colors.indexOf(s) >= 0,
          min: s.min, max: s.max, step: s.step,
          group: s.group || null, global: !!s.global,
          modes: Array.isArray(s.modes) ? s.modes : null
        };
      }),
      timeline: CONFIG.timeline || null
    };
  }
  /* CHECKPOINT — Reset returns to the last point the user COPIED (the pick they
     reported), not to the shipped values: tuning is incremental, and "reset"
     means "undo my fiddling since the last pick". Until the first Copy the
     checkpoint is the state the page loaded with (persisted state or ship).
     Persisted with the state so a reload keeps it. Ship values stay reachable
     with Shift+Reset. */
  var CKKEY = LSKEY + ':ck', CK = null;
  try { CK = JSON.parse(localStorage.getItem(CKKEY)); } catch (er) {}
  function snapshot() { return JSON.parse(JSON.stringify({ V: V, mode: mode, T: T, tab: tab })); }
  function checkpoint() {
    CK = snapshot();
    try { localStorage.setItem(CKKEY, JSON.stringify(CK)); } catch (er) {}
  }
  function restoreCheckpoint() {
    if (!CK) return false;
    var deep = function (dst, src) {
      Object.keys(src || {}).forEach(function (k) {
        if (src[k] && typeof src[k] === 'object' && dst[k] && typeof dst[k] === 'object') deep(dst[k], src[k]);
        else if (k in dst) dst[k] = src[k];
      });
    };
    deep(V, CK.V);
    if (MODE_GROUPED) deep(mode, CK.mode || {}); else mode = CK.mode;
    deep(T, CK.T || {});
    if (CONFIG.tabs.length && CK.tab) tab = CK.tab;
    syncInputs(); run();
    return true;
  }
  function doReset(toShip) {
    if (!toShip && restoreCheckpoint()) return;
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
  }
  /* Per-knob reset: one key back to the checkpoint (or, with ship, to the
     shipped default). The remote's per-row reset button sends {t:'reset', key}. */
  function resetKey(key, toShip) {
    var b = bag(key);
    var ckBag = null;
    if (!toShip && CK && CK.V) ckBag = (tab && IS_GLOBAL[key]) ? CK.V.__global : (tab ? CK.V[tab] : CK.V);
    var defBag = (tab && IS_GLOBAL[key]) ? DEFAULTS.__global : (tab ? DEFAULTS[tab] : DEFAULTS);
    var v = (ckBag && key in ckBag) ? ckBag[key] : defBag[key];
    if (v === undefined) return;
    b[key] = v; syncInputs(); run();
  }
  if (CHAN) CHAN.onmessage = function (ev) {
    var m = ev.data || {};
    if (m.inst) return;                        // another page's echo, not a command
    if (m.to && m.to !== INST && m.t !== 'hello') return;   // addressed to another page
    if (m.t === 'hello') {
      // The remote tab only takes over once it actually answers. A panel hidden
      // on the mere HOPE of a remote — the Pop out bug all over again — leaves
      // nothing on screen when the second tab was never opened.
      remoteOn = true;
      lastPing = Date.now();
      post({ t: 'desc', desc: descriptor(), V: V, mode: mode, T: T, tab: tab, group: group, off: offKeys() });
      // An on-page harness (remoteOnly: false) keeps its panel when a tab answers.
      if (CONFIG.remoteOnly) hide();
      return;
    }
    if (!remoteOn) return;
    if (m.t === 'set')    { if (staleSet(m)) return; bag(m.key)[m.key] = m.val; syncInputs(); run(); return; }
    if (m.t === 'reset')  { resetKey(m.key, !!m.ship); return; }
    if (m.t === 'mode')   { setMode(m.group, m.id); return; }
    if (m.t === 'toggle') { T[m.id] = !!m.on; syncInputs(); run(); return; }
    if (m.t === 'tab')    { selectTab(m.id); postState(); return; }
    if (m.t === 'btn') {
      if (m.name === 'go')    goToTarget();
      if (m.name === 'reset') doReset(!!m.ship);
      if (m.name === 'copy')  { checkpoint(); post({ t: 'payload', text: payload() }); }
      return;
    }
    if (m.t === 'ping') { lastPing = Date.now(); return; }
    if (m.t === 'bye') { remoteOn = false; show(); return; }
    /* Deleted from the panel. The file is still loaded in this page until the
       next reload, so stop answering discovery and paint nothing — otherwise
       the row it was deleted from keeps coming back. */
    if (m.t === 'trashed') { TRASHED = true; remoteOn = false; hide(); if (DISC) DISC.onmessage = null; return; }
  };
  /* A closing tab cannot be relied on to say goodbye — beforeunload often never
     delivers its message — and a panel that stays hidden after its remote is
     gone looks like the harness broke. The remote pings; silence brings the
     in-page panel back. (The chip is always there as the manual way back.) */
  var lastPing = 0;
  setInterval(function () {
    if (remoteOn && lastPing && Date.now() - lastPing > 6000) { remoteOn = false; show(); }
  }, 2000);
  /* Offered whenever a real window is impossible. The URL goes on the clipboard
     because the sandboxed browser that blocked the popup will not open a tab
     for us either — pasting it into a second tab is the one move left. */
  function remoteHint(why) {
    var full = location.origin + location.pathname.replace(/[^/]*$/, '') + REMOTE_URL;
    try { navigator.clipboard.writeText(full); } catch (e) {}
    alert(why + '\n\nThe panel URL is now on your clipboard:\n' + full
        + '\n\nOpen a second browser tab and paste it — that tab becomes the '
        + 'panel and drives this page live.');
  }

  function popOut() {
    win = window.open('', CONFIG.title, 'width=380,height=560');
    if (!win) {
      remoteHint('This browser refused to open a window '
               + '(VS Code\'s built-in browser always does).');
      return;
    }
    // A freshly opened window is still loading about:blank, and until that
    // finishes it is a CROSS-ORIGIN frame: reading win.document — or even
    // win.addEventListener — throws SecurityError, and anything written
    // synchronously (document.write included) is wiped when the load lands.
    // So: never touch the window outside a try, don't attach a load listener
    // (attaching one is itself a cross-origin read), and poll until the
    // document is ours. __panel makes the build happen exactly once.
    function fill() {
      if (!win || win.closed) return false;
      try {
        if (win.__panel) return true;
        var d = win.document;
        if (!d || !d.body || d.readyState === 'loading') return false;
        d.title = CONFIG.title;
        d.body.style.cssText = 'margin:0;background:#111;color:#eee';
        var p = buildPanel(d, true);
        d.body.appendChild(p);
        win.__panel = p;
        win.addEventListener('beforeunload', function () { win = null; show(); });
        win.addEventListener('keydown', keyHandler);
        // Only NOW is there something to pop out to — hiding the in-page panel
        // any earlier leaves nothing on screen when a blocker silently kills
        // the window (it returns a real object, so `if (!win)` never catches it).
        panel.style.display = 'none';
        syncInputs(); renderReadout();
        return true;
      } catch (e) { return false; }
    }
    var tries = 0;
    var iv = setInterval(function () {
      if (fill()) { clearInterval(iv); return; }
      if (++tries > 60) {
        clearInterval(iv);
        win = null;
        show();
        remoteHint('The popped-out window never opened.');
      }
    }, 50);
    fill();
  }
  function dock() { if (win) { var w = win; win = null; w.close(); } show(); }

  // ---------------------------------------------------------- hide / show ---
  /* remoteOnly: the harness still injects (it has to, to answer discovery and to
     drive the page) but never paints — not the panel, not even the chip. Its UI
     is the _debug-panel.html tab. On-page chrome sits on top of the artwork being
     judged, which is exactly what a compare/ harness must not do. `H` is the
     escape hatch for when no panel tab is open. */
  var forceVisible = false;
  function quiet() { return CONFIG.remoteOnly && !forceVisible; }
  function hide() { panel.style.display = 'none'; chip.style.display = quiet() ? 'none' : 'block'; }
  function show() {
    if (quiet()) { panel.style.display = 'none'; chip.style.display = 'none'; return; }
    chip.style.display = 'none'; if (!win) panel.style.display = ''; syncInputs(); renderReadout();
  }

  function keyHandler(e) {
    var k = (e.key || '').toLowerCase();
    if (k === 'h') {
      if (quiet()) { forceVisible = true; show(); return; }
      panel.style.display === 'none' && !win ? show() : hide(); return;
    }
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
      if (MODE_GROUPED) mode[MODE_GROUPS.indexOf(lastModeGroup) < 0 ? MODE_GROUPS[0] : lastModeGroup] = null;
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
  if (CONFIG.remoteOnly) hide();
  document.body.appendChild(chip);

  addEventListener('keydown', keyHandler);
  restoreState();
  if (!CK) CK = snapshot();   // first checkpoint = the state we loaded with (after restore, so never the ship defaults)
  syncInputs();
  run();

  if (CONFIG.init) CONFIG.init(API);
});
})();
