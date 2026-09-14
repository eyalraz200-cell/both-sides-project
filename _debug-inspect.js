/* ============================================================================
   ELEMENT INSPECTOR — page side. SCAFFOLDING, never ships.
   Copy into the project as _debug-inspect.js, load it after _debug-bus.js,
   delete it with the last _debug-*.js.

   What it does: Cmd + click (desktop) or a double-tap (phone) on any
   element opens an "Element" tab in the harness panel (_debug-panel.html) with
   the element's NESTING CHAIN — pick which level you are styling — and live
   style controls. Edits land as inline overrides here; Copy hands back the
   visual-edit change-list (op:"style", camelCase props, [from, to] pairs) for
   Claude to write into the real stylesheet.

   Why it lives on the bus and not on the page: the panel is the UI, on the
   laptop, also when the page runs on a phone. The only thing drawn on the page
   is the selection outline, which an inspector cannot do without.
   ========================================================================== */
(function () {
  if (!window.HBus) return;
  var CH = HBus('harness:__inspect__');
  var DISC = HBus('harness:__all__');
  /* INSTANCE ID — several pages share one bus (a phone, a desktop tab, a headless
     probe). Every message out carries `inst`; commands in carry `to`, and one
     addressed to another page is ignored. Otherwise a slider dragged for one
     page restyled every page, and every page answered a Copy. Per tab, not per
     load, so a reload keeps the panel talking to the same page. */
  var INST = null;
  try { INST = sessionStorage.getItem('harness:inst'); } catch (e) {}
  if (!INST) {
    INST = Math.random().toString(36).slice(2, 8);
    try { sessionStorage.setItem('harness:inst', INST); } catch (e) {}
  }
  function post(m) { m.inst = INST; CH.postMessage(m); }

  // Own chrome and the dev aids never get picked.
  var IGNORE = '#foldNumberBadge, .fold-picker, .hp-panel, .hp-chip, .hp-manual, #hpInspectBox';

  // The properties the panel can edit, camelCase (the change-list's key) → css.
  var PROPS = {
    fontSize: 'font-size', fontWeight: 'font-weight', lineHeight: 'line-height',
    letterSpacing: 'letter-spacing', textAlign: 'text-align', textTransform: 'text-transform',
    color: 'color', backgroundColor: 'background-color', opacity: 'opacity',
    borderRadius: 'border-radius', borderWidth: 'border-width', borderColor: 'border-color',
    borderStyle: 'border-style',
    paddingTop: 'padding-top', paddingRight: 'padding-right',
    paddingBottom: 'padding-bottom', paddingLeft: 'padding-left',
    marginTop: 'margin-top', marginRight: 'margin-right',
    marginBottom: 'margin-bottom', marginLeft: 'margin-left',
    width: 'width', height: 'height', gap: 'gap', display: 'display'
  };

  // --------------------------------------------------------------- state --
  var chain = [];          // elements, innermost first
  var sel = -1;            // index into chain
  var edits = new Map();   // element → { camel: [from, to] }
  var texts = new Map();   // element → [from, to]  (its own text, edited in the panel)
  var STORE = 'inspect:edits';

  // ----------------------------------------------------------- selectors --
  function cssEsc(s) { return (window.CSS && CSS.escape) ? CSS.escape(s) : s.replace(/[^\w-]/g, '\\$&'); }
  function classesOf(el) {
    return Array.prototype.filter.call(el.classList || [], function (c) {
      return !/^(is-|has-|hp-|active|open)/.test(c);   // state classes are not identity
    }).slice(0, 2);
  }
  function step(el) {
    if (el.id) return '#' + cssEsc(el.id);
    var s = el.tagName.toLowerCase();
    classesOf(el).forEach(function (c) { s += '.' + cssEsc(c); });
    return s;
  }
  function unique(s) { try { return document.querySelectorAll(s).length === 1; } catch (e) { return false; } }
  /* Shortest selector that hits exactly this element: its own step; else
     parent steps prefixed until unique; else nth-of-type on the last step. */
  function selectorFor(el) {
    var parts = [], cur = el;
    while (cur && cur !== document.body && cur.nodeType === 1) {
      var st = step(cur);
      parts.unshift(st);
      var s = parts.join(' > ');
      if (unique(s)) return s;
      if (cur.id) break;
      cur = cur.parentElement;
    }
    var s2 = parts.join(' > ');
    if (unique(s2)) return s2;
    var p = el.parentElement, idx = 1;
    if (p) {
      var same = Array.prototype.filter.call(p.children, function (c) { return c.tagName === el.tagName; });
      idx = same.indexOf(el) + 1;
      parts[parts.length - 1] += ':nth-of-type(' + idx + ')';
    }
    return parts.join(' > ');
  }
  function ownText(el) {
    var t = '';
    Array.prototype.forEach.call(el.childNodes, function (n) { if (n.nodeType === 3) t += n.textContent; });
    t = t.replace(/\s+/g, ' ').trim();
    if (!t) t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    return t.length > 40 ? t.slice(0, 40) + '…' : t;
  }
  function describe(el, i) {
    return { i: i, tag: el.tagName.toLowerCase(), id: el.id || '', cls: classesOf(el).join(' '),
             sel: selectorFor(el), text: ownText(el) };
  }

  // ------------------------------------------------------------- outline --
  var box = document.createElement('div');
  box.id = 'hpInspectBox';
  box.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483000;display:none;' +
    'outline:2px solid #4fd2ff;outline-offset:-1px;box-shadow:0 0 0 1px rgba(0,0,0,.4)';
  var tag = document.createElement('div');
  tag.style.cssText = 'position:absolute;left:-1px;top:-18px;background:#4fd2ff;color:#06101a;' +
    'font:600 10px/16px ui-monospace,monospace;padding:0 5px;border-radius:3px 3px 0 0;white-space:nowrap';
  box.appendChild(tag);
  function mountBox() { if (!box.parentNode && document.body) document.body.appendChild(box); }
  var raf = null;
  function track() {
    raf = null;
    var el = chain[sel];
    if (!el || !el.isConnected) { box.style.display = 'none'; return; }
    var r = el.getBoundingClientRect();
    box.style.display = 'block';
    box.style.left = r.left + 'px'; box.style.top = r.top + 'px';
    box.style.width = r.width + 'px'; box.style.height = r.height + 'px';
    tag.textContent = step(el) + '  ' + Math.round(r.width) + '×' + Math.round(r.height);
    tag.style.top = r.top < 20 ? '100%' : '-18px';
    raf = requestAnimationFrame(track);
  }
  function startTrack() { mountBox(); if (!raf) raf = requestAnimationFrame(track); }
  function stopTrack() { if (raf) cancelAnimationFrame(raf); raf = null; box.style.display = 'none'; }

  // ---------------------------------------------------------------- pick --
  function pick(el) {
    if (!el || el.nodeType !== 1) return;
    if (el.closest(IGNORE)) return;
    chain = [];
    var cur = el;
    while (cur && cur !== document.body && cur !== document.documentElement) { chain.push(cur); cur = cur.parentElement; }
    if (!chain.length) return;
    sel = 0;
    startTrack();
    sendPicked();
    sendProps();
  }
  // Desktop: Cmd + click. Captured on mousedown so the page's own handlers
  // (drag-and-drop, the legend filter, links) never see it — a pick must not
  // also act on the thing picked. The paired click is swallowed too.
  var swallowClick = false;
  addEventListener('mousedown', function (e) {
    if (!e.metaKey || e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    swallowClick = true;
    pick(document.elementFromPoint(e.clientX, e.clientY));
  }, true);
  addEventListener('click', function (e) {
    if (!swallowClick) return;
    swallowClick = false;
    e.preventDefault(); e.stopPropagation();
  }, true);
  // Phone: two taps within 350ms and 30px. touchend, not click — a synthetic
  // click on a phone comes 300ms late and dblclick is unreliable on iOS.
  var lastTap = null;
  addEventListener('touchend', function (e) {
    var t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    var now = Date.now();
    if (lastTap && now - lastTap.t < 350 && Math.hypot(t.clientX - lastTap.x, t.clientY - lastTap.y) < 30) {
      lastTap = null;
      var el = document.elementFromPoint(t.clientX, t.clientY);
      if (el && !el.closest(IGNORE)) { e.preventDefault(); pick(el); }
      return;
    }
    lastTap = { t: now, x: t.clientX, y: t.clientY };
  }, { passive: false, capture: true });

  // --------------------------------------------------------------- state --
  /* The element's OWN text — its direct text nodes, not its children's. That is
     what the panel lets you edit; a wrapper with children keeps them. */
  function fullOwnText(el) {
    var t = '';
    Array.prototype.forEach.call(el.childNodes, function (n) { if (n.nodeType === 3) t += n.textContent; });
    return t;
  }
  function hasOwnText(el) { return /\S/.test(fullOwnText(el)); }
  function setText(el, value) {
    var rec = texts.get(el);
    if (!rec) rec = [fullOwnText(el), value]; else rec[1] = value;
    texts.set(el, rec);
    // First text node takes the new value; the others go, children stay.
    var first = null;
    Array.prototype.slice.call(el.childNodes).forEach(function (n) {
      if (n.nodeType !== 3) return;
      if (!first) first = n; else el.removeChild(n);
    });
    if (first) first.textContent = value; else el.insertBefore(document.createTextNode(value), el.firstChild);
    persist();
  }
  function unsetText(el) {
    var rec = texts.get(el); if (!rec) return;
    setText(el, rec[0]); texts.delete(el); persist();
  }
  function computedOf(el) {
    var cs = getComputedStyle(el), out = {};
    Object.keys(PROPS).forEach(function (k) { out[k] = cs.getPropertyValue(PROPS[k]); });
    // The panel wants to know whether gap means anything here.
    out.__display = cs.display;
    return out;
  }
  function editsOf(el) { return edits.get(el) || {}; }
  function sendPicked() {
    post({ t: 'picked', chain: chain.map(describe), i: sel });
  }
  function sendProps() {
    var el = chain[sel]; if (!el) return;
    var r = el.getBoundingClientRect();
    post({ t: 'props', i: sel, sel: selectorFor(el), computed: computedOf(el),
           edits: editsOf(el), rect: { w: Math.round(r.width), h: Math.round(r.height) },
           text: hasOwnText(el) || texts.has(el) ? fullOwnText(el) : null,
           textEdited: texts.has(el) });
  }
  function setProp(el, camel, val) {
    if (!PROPS[camel]) return;
    var e = edits.get(el) || {};
    if (!e[camel]) e[camel] = [getComputedStyle(el).getPropertyValue(PROPS[camel]), val];
    else e[camel][1] = val;
    edits.set(el, e);
    el.style.setProperty(PROPS[camel], val);
    persist();
  }
  function unsetProp(el, camel) {
    var e = edits.get(el); if (!e || !e[camel]) return;
    delete e[camel];
    el.style.removeProperty(PROPS[camel]);
    if (!Object.keys(e).length) edits.delete(el);
    persist();
  }
  function revert(el) {
    var e = edits.get(el);
    if (e) { Object.keys(e).forEach(function (k) { el.style.removeProperty(PROPS[k]); }); edits.delete(el); }
    if (texts.has(el)) unsetText(el);
    persist();
  }
  /* Edits survive the dev auto-reload: stored by selector, re-applied on load.
     The `from` values are kept so the change-list stays honest after a reload. */
  function persist() {
    var out = {};
    edits.forEach(function (e, el) { if (el.isConnected) { var k = selectorFor(el); out[k] = out[k] || { sel: k }; out[k].edits = e; } });
    texts.forEach(function (t, el) { if (el.isConnected) { var k = selectorFor(el); out[k] = out[k] || { sel: k }; out[k].text = t; } });
    try { sessionStorage.setItem(STORE, JSON.stringify(Object.keys(out).map(function (k) { return out[k]; }))); } catch (er) {}
  }
  function restore() {
    var saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(STORE)); } catch (er) {}
    if (!saved) return;
    saved.forEach(function (rec) {
      var el = null; try { el = document.querySelector(rec.sel); } catch (er) {}
      if (!el) return;
      if (rec.edits) {
        edits.set(el, rec.edits);
        Object.keys(rec.edits).forEach(function (k) { el.style.setProperty(PROPS[k], rec.edits[k][1]); });
      }
      if (rec.text) { setText(el, rec.text[1]); texts.set(el, rec.text); }
    });
  }

  // ---------------------------------------------------------------- copy --
  function payload() {
    var lines = ['[element edits]'], json = [];
    var all = [];
    edits.forEach(function (e, el) { if (all.indexOf(el) < 0) all.push(el); });
    texts.forEach(function (t, el) { if (all.indexOf(el) < 0) all.push(el); });
    all.forEach(function (el) {
      if (!el.isConnected) return;
      var e = edits.get(el) || {}, tx = texts.get(el);
      if (!Object.keys(e).length && !tx) return;
      var d = describe(el, 0);
      lines.push('· ' + d.sel + (d.text ? '  "' + d.text + '"' : ''));
      Object.keys(e).forEach(function (k) { lines.push('    ' + PROPS[k] + ': ' + e[k][0] + ' → ' + e[k][1]); });
      if (tx) lines.push('    text: "' + tx[0].trim() + '" → "' + tx[1].trim() + '"');
      var entry = { selector: d.sel, tag: d.tag, text: d.text, op: 'style', changes: e, viewportPx: innerWidth };
      if (tx) entry.textChange = [tx[0], tx[1]];
      json.push(entry);
    });
    if (!json.length) return '[element edits]\n(none)';
    return lines.join('\n') + '\n\n' + JSON.stringify(json, null, 1);
  }

  // ------------------------------------------------------------ messages --
  CH.onmessage = function (ev) {
    var m = ev.data || {};
    if (m.inst) return;                                   // another page's echo
    if (m.to && m.to !== INST) return;                    // addressed elsewhere
    var el = chain[sel];
    if (m.t === 'hello') { if (chain.length) { sendPicked(); sendProps(); } else post({ t: 'none' }); return; }
    if (m.t === 'select') {
      if (chain[m.i]) { sel = m.i; startTrack(); sendProps(); }
      return;
    }
    if (!el) return;
    if (m.t === 'set')   { setProp(el, m.prop, m.val); sendProps(); return; }
    if (m.t === 'unset') { unsetProp(el, m.prop); sendProps(); return; }
    if (m.t === 'text')  { setText(el, String(m.value)); sendProps(); return; }
    if (m.t === 'untext'){ unsetText(el); sendProps(); return; }
    if (m.t === 'revert'){ revert(el); sendProps(); return; }
    if (m.t === 'copy')  { post({ t: 'payload', text: payload() }); return; }
    if (m.t === 'clear') { chain = []; sel = -1; stopTrack(); post({ t: 'none' }); return; }
  };
  DISC.onmessage = function (ev) {
    if ((ev.data || {}).t === 'who') {
      try { DISC.postMessage({ t: 'iam', title: '__inspect__', inspect: true, inst: INST, hasSelection: chain.length > 0 }); } catch (e) {}
    }
  };
  addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && chain.length) { chain = []; sel = -1; stopTrack(); post({ t: 'none' }); }
  });

  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', restore); else restore();
})();
