// visual-edit v2 — building step by step
(function () {
  "use strict";
  if (window.__ve2) { window.__ve2.destroy(); }

  // OFF by default. Nothing below runs until the first Cmd+Ctrl chord — no
  // stage wrap, no document-wide listeners, no chrome in the DOM. The chord
  // boots the editor with its panels open; after boot the same chord toggles
  // the panels (onKey), and Exit tears everything down and re-arms the chord.
  function bootEditor() {

  var NS = "ve2";
  var selected = null;
  var expanded = new Set();        // elements whose children are shown in the tree
  var rowOf = new Map();           // element -> its tree row node (current render)
  var undoStack = [];              // [{el, from, to}] inline-style snapshots
  var redoStack = [];
  var origCss = new Map();         // el -> its inline cssText before the first edit
  var baseCss = "";                // selected el's cssText since last commit
  var origOrder = new Map();       // flex/grid parent -> original child order (for reorder diff)
  var dragArm = null, dragging = false, suppressClick = false;
  var origText = new Map();         // el -> original textContent (for text-edit diff)
  var editingText = null;           // element currently in contentEditable text-edit mode
  var inserted = new Map();         // clone el -> {anchor} (Cmd+D duplicates → op:"insert")
  var deleted = [];                 // [{selector, tag, text, el, parent, next}] (op:"delete")
  var htmlEdits = new Map();         // el -> {selector, from} (raw HTML rewrites → op:"html")

  // UI state persisted across injections (sessionStorage; fine to lose)
  var state = {};
  try { state = JSON.parse(sessionStorage.getItem("ve2-state") || "{}") || {}; } catch (err) { state = {}; }
  var collapsedSecs = {};           // inspector section title -> collapsed
  (state.secs || []).forEach(function (t) { collapsedSecs[t] = true; });
  var breakpoint = state.bp || 0;   // 0 = full width; else stage is capped at this px
  function saveState() {
    try {
      sessionStorage.setItem("ve2-state", JSON.stringify({
        leftOff: leftOff, leftW: LEFT_W, rightW: RIGHT_W,
        secs: Object.keys(collapsedSecs).filter(function (t) { return collapsedSecs[t]; }),
        bp: breakpoint
      }));
    } catch (err) { }
  }
  // true while the event target is a place where typing is expected — new
  // shortcuts must not fire there (except the Cmd+Ctrl chord and Esc).
  function isTyping(e) {
    var t = e.target;
    if (!t || t.nodeType !== 1) return false;
    return t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" || t.isContentEditable;
  }

  // --- styles ---
  var style = document.createElement("style");
  style.textContent =
    "." + NS + "-hover{position:fixed;pointer-events:none;z-index:2147483640;border:1px solid #6ea8ff;box-sizing:border-box}" +
    "." + NS + "-sel{position:fixed;pointer-events:none;z-index:2147483641;border:1.5px solid #2d7bff;box-shadow:0 0 0 1px rgba(45,123,255,.35);box-sizing:border-box}" +
    "." + NS + "-h{position:absolute;width:7px;height:7px;margin:-4px 0 0 -4px;background:#fff;border:1px solid #2d7bff;border-radius:1px;pointer-events:auto;box-sizing:border-box}" +
    "." + NS + "-tag{position:fixed;z-index:2147483642;background:#2d7bff;color:#fff;font:11px/1.4 ui-monospace,monospace;padding:1px 6px;border-radius:3px;pointer-events:none;white-space:nowrap}" +
    // left layers panel (Figma-style)
    "." + NS + "-panel{position:fixed;top:0;left:0;width:248px;height:100vh;z-index:2147483645;background:#1e1e1e;border-right:1px solid #333;color:#e6e6e6;font:12px/1.4 ui-sans-serif,system-ui,sans-serif;display:flex;flex-direction:column}" +
    "." + NS + "-panel *{box-sizing:border-box}" +
    "." + NS + "-phead{flex:0 0 auto;padding:9px 10px 9px 14px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#8a8a8a;border-bottom:1px solid #2c2c2c;display:flex;align-items:center;justify-content:space-between}" +
    "." + NS + "-pbtn{flex:0 0 auto;width:22px;height:22px;padding:0;background:#2a2a2a;border:1px solid #3a3a3a;border-radius:5px;color:#c8c8c8;font:16px/1 ui-sans-serif,system-ui,sans-serif;cursor:pointer}" +
    "." + NS + "-pbtn:hover{background:#333;color:#fff}" +
    "." + NS + "-ptab{position:fixed;top:10px;left:10px;z-index:2147483645;width:26px;height:26px;padding:0;background:#1e1e1e;border:1px solid #333;border-radius:6px;color:#c8c8c8;font:16px/1 ui-sans-serif,system-ui,sans-serif;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3)}" +
    "." + NS + "-ptab:hover{background:#2a2d31;color:#fff}" +
    "." + NS + "-tree{flex:1 1 auto;overflow:auto;padding:6px 0}" +
    "." + NS + "-row{display:flex;align-items:center;height:24px;padding-right:8px;cursor:default;white-space:nowrap;user-select:none}" +
    "." + NS + "-row:hover{background:#2a2d31}" +
    "." + NS + "-row.sel{background:#2d7bff33;box-shadow:inset 2px 0 0 #2d7bff}" +
    "." + NS + "-caret{flex:0 0 14px;text-align:center;color:#8a8a8a;font-size:9px;cursor:pointer}" +
    "." + NS + "-ico{flex:0 0 16px;color:#8a8a8a;font:10px/1 ui-monospace,monospace;text-align:center}" +
    "." + NS + "-lbl{overflow:hidden;text-overflow:ellipsis}" +
    "." + NS + "-lbl b{color:#e6e6e6;font-weight:500}" +
    "." + NS + "-lbl i{color:#6ea8ff;font-style:normal}" +
    // right inspector panel
    "." + NS + "-insp{position:fixed;top:0;right:0;width:264px;height:100vh;z-index:2147483645;background:#1e1e1e;border-left:1px solid #333;color:#e6e6e6;font:12px/1.4 ui-sans-serif,system-ui,sans-serif;display:flex;flex-direction:column;overflow:auto}" +
    "." + NS + "-insp *{box-sizing:border-box}" +
    // stage = wrapper the page content lives in so it can be docked beside the panels.
    // transform establishes a containing block so the page's position:fixed/sticky
    // layers dock to the stage box instead of the raw viewport.
    "." + NS + "-stage{transform:translateZ(0);transition:margin .18s ease,width .18s ease;box-sizing:border-box}" +
    "." + NS + "-ihead{flex:0 0 auto;padding:12px 14px;border-bottom:1px solid #2c2c2c}" +
    "." + NS + "-ihead b{font-size:13px;font-weight:600}" +
    "." + NS + "-ihead span{color:#6ea8ff;font-size:11px;font-family:ui-monospace,monospace}" +
    "." + NS + "-sec{padding:12px 14px;border-bottom:1px solid #2c2c2c}" +
    "." + NS + "-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#8a8a8a;margin-bottom:9px}" +
    "." + NS + "-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}" +
    "." + NS + "-fld{display:flex;align-items:center;gap:6px;min-width:0}" +
    "." + NS + "-fld label{flex:0 0 auto;width:14px;color:#8a8a8a;font-size:11px}" +
    "." + NS + "-scrub{cursor:ew-resize;user-select:none}" +
    "." + NS + "-hint{font:10px/1.3 ui-sans-serif,system-ui,sans-serif;color:#c8a24a;margin:-3px 0 9px;display:flex;gap:4px}" +
    "." + NS + "-code{position:relative}" +
    "." + NS + "-codelbl{font:10px/1 ui-sans-serif,system-ui,sans-serif;color:#8a8a8a;text-transform:uppercase;letter-spacing:.06em;margin:0 0 4px}" +
    "." + NS + "-codepre{margin:0 0 8px;max-height:180px;overflow:auto;background:#1c1c1c;border:1px solid #333;border-radius:6px;padding:8px 9px;color:#d4d4d4;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre;tab-size:2}" +
    "." + NS + "-codepre .k{color:#7cc7ff}" + "." + NS + "-codepre .v{color:#c8e6a0}" + "." + NS + "-codepre .p{color:#e6b85c}" +
    "." + NS + "-codecp{position:absolute;top:0;right:0;background:#2a2a2a;border:1px solid #3a3a3a;border-radius:5px;color:#c8c8c8;font:10px/1 ui-sans-serif,system-ui,sans-serif;padding:4px 7px;cursor:pointer}" +
    "." + NS + "-codecp:hover{background:#333}" +
    "." + NS + "-fld input{flex:1 1 auto;min-width:0;background:#2a2a2a;border:1px solid #3a3a3a;border-radius:5px;color:#e6e6e6;font:11px/1 ui-monospace,monospace;padding:6px 7px}" +
    "." + NS + "-fld input:focus{outline:none;border-color:#2d7bff}" +
    "." + NS + "-fld select{flex:1 1 auto;min-width:0;background:#2a2a2a;border:1px solid #3a3a3a;border-radius:5px;color:#e6e6e6;font:11px/1 ui-sans-serif,system-ui,sans-serif;padding:6px 7px;cursor:pointer}" +
    "." + NS + "-fld select:focus{outline:none;border-color:#2d7bff}" +
    "." + NS + "-algrow{display:flex;gap:6px}" +
    "." + NS + "-alg{flex:1 1 0;display:flex;align-items:center;justify-content:center;height:28px;background:#2a2a2a;border:1px solid #3a3a3a;border-radius:5px;color:#b8b8b8;cursor:pointer;font-size:13px}" +
    "." + NS + "-alg:hover{background:#333}" +
    "." + NS + "-alg.on{background:#2d7bff;border-color:#2d7bff;color:#fff}" +
    "input." + NS + "-sw{flex:0 0 auto;width:22px;height:22px;padding:0;min-width:22px;border:1px solid #3a3a3a;border-radius:4px;background:none;cursor:pointer;-webkit-appearance:none;appearance:none}" +
    "input." + NS + "-sw::-webkit-color-swatch-wrapper{padding:0}" +
    "input." + NS + "-sw::-webkit-color-swatch{border:none;border-radius:3px}" +
    // copy button
    "." + NS + "-copy{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:2147483646;background:#1e1e1e;color:#e6e6e6;font:600 13px/1 ui-sans-serif,system-ui,sans-serif;border:1px solid #333;border-radius:8px;padding:11px 18px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.3)}" +
    "." + NS + "-copy:hover{background:#2a2d31}" +
    "." + NS + "-copy:disabled{opacity:.5;cursor:default}" +
    "." + NS + "-glayer{position:fixed;inset:0;z-index:2147483643;pointer-events:none}" +
    "." + NS + "-gh{position:fixed;background:rgba(217,43,168,.12);pointer-events:auto;z-index:2147483643}" +
    "." + NS + "-gh:hover,." + NS + "-gh.on{background:rgba(217,43,168,.24)}" +
    "." + NS + "-gb{position:fixed;transform:translate(-50%,-50%);background:rgba(217,43,168,.75);color:#fff;font:600 11px/1 ui-monospace,monospace;padding:2px 6px;border-radius:4px;pointer-events:none;z-index:2147483644;white-space:nowrap}" +
    // peek-copy toast (Cmd+Alt click → copy element HTML)
    "." + NS + "-toast{position:fixed;z-index:2147483647;background:#111;color:#fff;font:600 12px/1.3 ui-sans-serif,system-ui,sans-serif;padding:8px 12px;border-radius:8px;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,.35);max-width:340px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    // bottom toolbar (Framer-style pill)
    "." + NS + "-tbar{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483646;display:flex;align-items:center;gap:6px;background:#1e1e1e;border:1px solid #333;border-radius:10px;padding:6px;box-shadow:0 4px 16px rgba(0,0,0,.35);color:#e6e6e6;font:12px/1 ui-sans-serif,system-ui,sans-serif}" +
    "." + NS + "-tbar *{box-sizing:border-box}" +
    "." + NS + "-tbtn{display:flex;align-items:center;justify-content:center;height:28px;min-width:28px;padding:0 6px;background:none;border:none;border-radius:6px;color:#c8c8c8;cursor:pointer;font:12px/1 ui-sans-serif,system-ui,sans-serif}" +
    "." + NS + "-tbtn:hover{background:#2a2d31;color:#fff}" +
    "." + NS + "-tbtn:disabled{opacity:.35;cursor:default}" +
    "." + NS + "-tbtn:disabled:hover{background:none;color:#c8c8c8}" +
    "." + NS + "-tsep{width:1px;height:18px;background:#333;flex:0 0 auto}" +
    "." + NS + "-tseg{display:flex;background:#141414;border:1px solid #3a3a3a;border-radius:6px;overflow:hidden}" +
    "." + NS + "-tseg button{height:26px;padding:0 9px;background:none;border:none;color:#b8b8b8;font:11px/1 ui-sans-serif,system-ui,sans-serif;cursor:pointer}" +
    "." + NS + "-tseg button:hover{background:#2a2d31;color:#fff}" +
    "." + NS + "-tseg button.on{background:#2d7bff;color:#fff}" +
    "." + NS + "-tcopy{height:28px;padding:0 13px;background:#2d7bff;border:none;border-radius:6px;color:#fff;font:600 12px/1 ui-sans-serif,system-ui,sans-serif;cursor:pointer}" +
    "." + NS + "-tcopy:hover{background:#4a8dff}" +
    // changes review popover (anchored above the toolbar)
    "." + NS + "-chpanel{position:fixed;left:50%;bottom:62px;transform:translateX(-50%);z-index:2147483646;width:360px;max-height:46vh;overflow:auto;background:#1e1e1e;border:1px solid #333;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.45);color:#e6e6e6;font:12px/1.4 ui-sans-serif,system-ui,sans-serif;padding:4px 0 6px}" +
    "." + NS + "-chpanel *{box-sizing:border-box}" +
    "." + NS + "-chhead{padding:8px 12px 6px;font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#8a8a8a;border-bottom:1px solid #2c2c2c}" +
    "." + NS + "-chrow{display:flex;align-items:center;gap:8px;padding:7px 8px 7px 12px;cursor:pointer}" +
    "." + NS + "-chrow:hover{background:#2a2d31}" +
    "." + NS + "-chsel{color:#6ea8ff;font:11px/1.3 ui-monospace,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:0 1 auto}" +
    "." + NS + "-chsum{color:#b8b8b8;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1 1 auto}" +
    "." + NS + "-chx{flex:0 0 auto;width:20px;height:20px;padding:0;background:none;border:none;border-radius:4px;color:#8a8a8a;font:13px/1 ui-sans-serif,system-ui,sans-serif;cursor:pointer}" +
    "." + NS + "-chx:hover{background:#3a2a2a;color:#ff7b7b}" +
    // keyboard cheatsheet overlay
    "." + NS + "-keys{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center}" +
    "." + NS + "-keycard{background:#1e1e1e;border:1px solid #333;border-radius:12px;padding:16px 20px 18px;color:#e6e6e6;font:12px/1.5 ui-sans-serif,system-ui,sans-serif;max-height:82vh;overflow:auto;min-width:380px;box-shadow:0 12px 40px rgba(0,0,0,.5)}" +
    "." + NS + "-keycard h3{margin:10px 0 6px;font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#8a8a8a}" +
    "." + NS + "-keyrow{display:flex;justify-content:space-between;align-items:center;gap:28px;padding:2px 0}" +
    "." + NS + "-keyrow span{color:#c8c8c8}" +
    "." + NS + "-kbd{font:600 11px/1 ui-monospace,monospace;background:#2a2a2a;border:1px solid #3a3a3a;border-bottom-width:2px;border-radius:4px;padding:3px 6px;color:#e6e6e6;white-space:nowrap}" +
    // measure mode (Alt-hover with a selection)
    "." + NS + "-mline{position:fixed;background:#ff4d67;z-index:2147483643;pointer-events:none}" +
    "." + NS + "-mbadge{position:fixed;transform:translate(-50%,-50%);background:#ff4d67;color:#fff;font:600 10px/1 ui-monospace,monospace;padding:2px 5px;border-radius:3px;z-index:2147483644;pointer-events:none;white-space:nowrap}" +
    // floating code window (mini-tool: edit the selected element's HTML + CSS live)
    "." + NS + "-cw{position:fixed;z-index:2147483646;width:420px;background:#1e1e1e;border:1px solid #3a3a3a;border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.5);color:#e6e6e6;font:12px/1.4 ui-sans-serif,system-ui,sans-serif;display:flex;flex-direction:column;overflow:hidden}" +
    "." + NS + "-cw *{box-sizing:border-box}" +
    "." + NS + "-cwbar{display:flex;align-items:center;gap:8px;padding:8px 10px;background:#242424;border-bottom:1px solid #333;cursor:move;user-select:none}" +
    "." + NS + "-cwbar b{font-size:11px;font-weight:600}" +
    "." + NS + "-cwsel{flex:1 1 auto;min-width:0;color:#6ea8ff;font:11px/1 ui-monospace,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    "." + NS + "-cwx{flex:0 0 auto;width:22px;height:22px;padding:0;background:none;border:none;border-radius:5px;color:#9a9a9a;font:15px/1 ui-sans-serif,system-ui,sans-serif;cursor:pointer}" +
    "." + NS + "-cwx:hover{background:#3a3a3a;color:#fff}" +
    "." + NS + "-cwbody{padding:10px;display:flex;flex-direction:column;gap:9px}" +
    "." + NS + "-cwgrp{display:flex;flex-direction:column;gap:4px}" +
    "." + NS + "-cwlbl{display:flex;align-items:center;gap:8px;font:10px/1 ui-sans-serif,system-ui,sans-serif;color:#8a8a8a;text-transform:uppercase;letter-spacing:.06em}" +
    "." + NS + "-cwta{width:100%;resize:vertical;background:#151515;border:1px solid #333;border-radius:6px;color:#d4d4d4;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;padding:8px 9px;white-space:pre;tab-size:2;min-height:52px}" +
    "." + NS + "-cwta:focus{outline:none;border-color:#2d7bff}" +
    "." + NS + "-cwta.bad{border-color:#ff5c5c}" +
    "." + NS + "-cwapply{margin-left:auto;background:#2a2a2a;border:1px solid #3a3a3a;border-radius:5px;color:#c8c8c8;font:10px/1 ui-sans-serif,system-ui,sans-serif;padding:4px 9px;cursor:pointer}" +
    "." + NS + "-cwapply:hover{background:#2d7bff;border-color:#2d7bff;color:#fff}" +
    "." + NS + "-cwhint{font:10px/1.3 ui-sans-serif,system-ui,sans-serif;color:#6a6a6a}" +
    "." + NS + "-cwempty{padding:22px 12px;text-align:center;color:#7a7a7a;font-size:11px}" +
    // layers-panel search + row eye toggle
    "." + NS + "-psearch{flex:0 0 auto;margin:8px 10px 2px;display:flex}" +
    "." + NS + "-psearch input{flex:1 1 auto;min-width:0;background:#2a2a2a;border:1px solid #3a3a3a;border-radius:5px;color:#e6e6e6;font:11px/1 ui-sans-serif,system-ui,sans-serif;padding:6px 8px}" +
    "." + NS + "-psearch input:focus{outline:none;border-color:#2d7bff}" +
    "." + NS + "-eye{flex:0 0 auto;width:20px;height:20px;padding:0;margin-left:auto;background:none;border:none;border-radius:4px;color:#8a8a8a;cursor:pointer;display:none;align-items:center;justify-content:center}" +
    "." + NS + "-row:hover ." + NS + "-eye{display:flex}" +
    "." + NS + "-eye:hover{background:#3a3a3a;color:#fff}" +
    "." + NS + "-eye.off{display:flex;color:#d9832b}" +
    "." + NS + "-row.ghost ." + NS + "-lbl{opacity:.45}" +
    // panel-edge resize strips
    "." + NS + "-rz{position:fixed;top:0;width:6px;height:100vh;z-index:2147483646;cursor:col-resize}" +
    "." + NS + "-rz:hover{background:rgba(45,123,255,.35)}" +
    // right-inspector restore tab (mirror of the left ptab)
    "." + NS + "-itab{position:fixed;top:10px;right:10px;z-index:2147483645;width:26px;height:26px;padding:0;background:#1e1e1e;border:1px solid #333;border-radius:6px;color:#c8c8c8;font:16px/1 ui-sans-serif,system-ui,sans-serif;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3)}" +
    "." + NS + "-itab:hover{background:#2a2d31;color:#fff}" +
    // collapsible inspector sections
    "." + NS + "-sect{cursor:pointer;user-select:none;display:flex;align-items:center;gap:5px}" +
    "." + NS + "-sect ." + NS + "-scaret{color:#6a6a6a;font-size:8px}" +
    // mini 4-side spacing fields
    "." + NS + "-mini{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:5px}" +
    "." + NS + "-mini ." + NS + "-fld label{width:10px}" +
    "." + NS + "-mini ." + NS + "-fld input{padding:5px 4px;font-size:10px}" +
    "." + NS + "-lnk{flex:0 0 auto;width:22px;height:22px;padding:0;background:#2a2a2a;border:1px solid #3a3a3a;border-radius:4px;color:#8a8a8a;font:11px/1 ui-sans-serif,system-ui,sans-serif;cursor:pointer}" +
    "." + NS + "-lnk.on{background:#2d7bff;border-color:#2d7bff;color:#fff}" +
    "." + NS + "-hidden{display:none!important}";
  document.head.appendChild(style);

  // Load webfonts the editor offers but the page may not include, so they preview live.
  (function () {
    var fl = document.createElement("link");
    fl.rel = "stylesheet";
    fl.href = "https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&family=Inter:wght@100..900&display=swap";
    document.head.appendChild(fl);
  })();

  // --- canvas overlay chrome ---
  function box(cls) { var e = document.createElement("div"); e.className = NS + "-" + cls + " " + NS + "-hidden"; document.body.appendChild(e); return e; }
  var hoverBox = box("hover");
  var selBox = box("sel");
  var tag = box("tag");
  var gapLayer = document.createElement("div"); gapLayer.className = NS + "-glayer";
  document.body.appendChild(gapLayer);
  var toast = box("toast");
  var toastT = null;
  function showToast(msg, x, y) {
    toast.textContent = msg;
    toast.style.left = Math.min(x + 14, window.innerWidth - 20) + "px";
    toast.style.top = Math.max(8, y - 34) + "px";
    show(toast, true);
    if (toastT) clearTimeout(toastT);
    toastT = setTimeout(function () { show(toast, false); }, 1400);
  }

  // --- left panel ---
  var panel = document.createElement("div");
  panel.className = NS + "-panel";
  var phead = document.createElement("div"); phead.className = NS + "-phead";
  var ptitle = document.createElement("span"); ptitle.textContent = "Layers"; phead.appendChild(ptitle);
  var pcollapse = document.createElement("button"); pcollapse.className = NS + "-pbtn"; pcollapse.textContent = "‹"; pcollapse.title = "Hide panel";
  phead.appendChild(pcollapse);
  // search box filters the layers tree by tag/id/class/text
  var psearch = document.createElement("div"); psearch.className = NS + "-psearch";
  var searchInp = document.createElement("input"); searchInp.type = "search"; searchInp.placeholder = "Search layers…";
  psearch.appendChild(searchInp);
  var treeFilter = "";
  searchInp.oninput = function () { treeFilter = searchInp.value.trim().toLowerCase(); renderTree(); };
  searchInp.onkeydown = function (e) {
    e.stopPropagation();
    if (e.key === "Escape") { searchInp.value = ""; treeFilter = ""; renderTree(); searchInp.blur(); }
  };
  var tree = document.createElement("div"); tree.className = NS + "-tree";
  panel.appendChild(phead); panel.appendChild(psearch); panel.appendChild(tree);
  panel.style.width = LEFT_W + "px";
  document.body.appendChild(panel);
  // little tab that brings the collapsed left panel back
  var ptab = document.createElement("button"); ptab.className = NS + "-ptab " + NS + "-hidden"; ptab.textContent = "›"; ptab.title = "Show Layers";
  document.body.appendChild(ptab);
  var leftOff = state.leftOff !== undefined ? !!state.leftOff : true;   // left panel starts collapsed to its restore tab
  function setLeftPanel(on) {
    leftOff = !on;
    show(panel, on); show(ptab, !on);
    reflow(); saveState();
  }
  pcollapse.onclick = function () { setLeftPanel(false); };
  ptab.onclick = function () { setLeftPanel(true); };

  // right inspector collapse (mirror of the left panel's tab)
  var rightOff = false;
  var itab = document.createElement("button"); itab.className = NS + "-itab " + NS + "-hidden"; itab.textContent = "‹"; itab.title = "Show Inspector";
  document.body.appendChild(itab);
  function setRightPanel(on) {
    rightOff = !on;
    show(insp, on && !uiHidden && !!selected);
    show(itab, !on && !uiHidden && !!selected);
    reflow();
  }
  itab.onclick = function () { setRightPanel(true); };

  // drag strips on the panels' inner edges → resize (min 200 / max 400)
  function makeStrip(side) {
    var s = document.createElement("div"); s.className = NS + "-rz " + NS + "-hidden";
    s.onpointerdown = function (e) {
      e.preventDefault();
      var startX = e.clientX, startW = side === "l" ? LEFT_W : RIGHT_W;
      s.setPointerCapture(e.pointerId);
      s.onpointermove = function (ev) {
        var d = ev.clientX - startX;
        var w = Math.max(200, Math.min(400, side === "l" ? startW + d : startW - d));
        if (side === "l") { LEFT_W = w; panel.style.width = w + "px"; }
        else { RIGHT_W = w; insp.style.width = w + "px"; }
        reflow(); redraw();
      };
      s.onpointerup = function () { s.onpointermove = null; s.onpointerup = null; saveState(); };
    };
    document.body.appendChild(s);
    return s;
  }
  var lStrip = makeStrip("l"), rStrip = makeStrip("r");
  function placeStrips() {
    var lOn = !uiHidden && !leftOff;
    var rOn = !uiHidden && !rightOff && !!selected;
    show(lStrip, lOn); show(rStrip, rOn);
    if (lOn) lStrip.style.left = (LEFT_W - 3) + "px";
    if (rOn) rStrip.style.right = (RIGHT_W - 3) + "px";
  }

  // --- right inspector panel (contextual: shown on selection) ---
  var insp = document.createElement("div");
  insp.className = NS + "-insp " + NS + "-hidden";
  insp.style.width = RIGHT_W + "px";
  document.body.appendChild(insp);
  var fieldRefs = {}; // prop -> input element (current render)

  // --- bottom toolbar ---
  var tbar = document.createElement("div");
  tbar.className = NS + "-tbar " + NS + "-hidden";
  function tbtn(html, title) {
    var b = document.createElement("button"); b.className = NS + "-tbtn";
    b.innerHTML = html; b.title = title; tbar.appendChild(b); return b;
  }
  function tsep() { var s = document.createElement("div"); s.className = NS + "-tsep"; tbar.appendChild(s); }
  var ARROW = "<svg width='14' height='14' viewBox='0 0 16 16' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M6 3.5 3 6.5l3 3'/><path d='M3 6.5h6.5a3 3 0 0 1 0 6H8'/></svg>";
  var undoBtn = tbtn(ARROW, "Undo (⌘Z)");
  var redoBtn = tbtn("<span style='display:inline-flex;transform:scaleX(-1)'>" + ARROW + "</span>", "Redo (⇧⌘Z)");
  undoBtn.onclick = undo; redoBtn.onclick = redo;
  tsep();
  // breakpoint preview segmented control
  var BPS = [[0, "Desktop"], [960, "960"], [620, "620"], [375, "375"]];
  var tseg = document.createElement("div"); tseg.className = NS + "-tseg";
  var bpBtns = BPS.map(function (bp) {
    var b = document.createElement("button"); b.textContent = bp[1];
    b.title = bp[0] ? "Preview stage at " + bp[0] + "px wide" : "Full width";
    if (bp[0] === breakpoint) b.className = "on";
    b.onclick = function () { setBreakpoint(bp[0]); };
    tseg.appendChild(b); return b;
  });
  tbar.appendChild(tseg);
  function setBreakpoint(bp) {
    breakpoint = bp;
    bpBtns.forEach(function (b, i) { b.className = BPS[i][0] === bp ? "on" : ""; });
    reflow(); redraw(); saveState();
    // let page JS that rebuilds on resize react to the new stage width
    window.dispatchEvent(new Event("resize"));
    if (bp) showToast("Stage capped at " + bp + "px — @media queries still see the real viewport", window.innerWidth / 2 - 160, window.innerHeight - 90);
  }
  tsep();
  var chip = tbtn("0 changes", "Review pending changes");
  chip.onclick = function () { toggleChanges(); };
  var copyBtn = document.createElement("button");
  copyBtn.className = NS + "-tcopy";
  copyBtn.textContent = "Copy";
  copyBtn.title = "Copy the change-list for Claude (Cmd+S)";
  tbar.appendChild(copyBtn);
  tsep();
  var helpBtn = tbtn("?", "Keyboard shortcuts (?)");
  helpBtn.onclick = function () { keysToggle(); };
  var exitBtn = tbtn("✕", "Exit visual editor");
  exitBtn.onclick = function () { window.__ve2 && window.__ve2.destroy(); };
  document.body.appendChild(tbar);

  // --- changes review popover ---
  var chpanel = document.createElement("div");
  chpanel.className = NS + "-chpanel " + NS + "-hidden";
  document.body.appendChild(chpanel);
  var changesOpen = false;
  function toggleChanges(on) {
    changesOpen = on !== undefined ? on : !changesOpen;
    if (changesOpen) renderChanges();
    show(chpanel, changesOpen);
  }
  // revert every recorded change on one element (granularity is per-ELEMENT: style,
  // text, order, insert/delete are each undone whole — stated in the panel header)
  function revertEl(en) {
    var el = en.el;
    if (en.op === "style" && origCss.has(el)) {
      el.style.cssText = origCss.get(el); origCss.delete(el);
      if (el === selected) baseCss = el.style.cssText;
    } else if (en.op === "text" && origText.has(el)) {
      el.textContent = origText.get(el); origText.delete(el);
    } else if (en.op === "reorder") {
      var p = el.parentElement, orig = p && origOrder.get(p);
      if (orig) {
        var idx = orig.indexOf(el), ref = null;
        for (var i = idx + 1; i < orig.length; i++) if (orig[i].parentElement === p) { ref = orig[i]; break; }
        p.insertBefore(el, ref);
      }
    } else if (en.op === "insert") {
      el.remove(); inserted.delete(el); origCss.delete(el); origText.delete(el);
      if (el === selected) selectEl(null);
    } else if (en.op === "delete") {
      for (var d = 0; d < deleted.length; d++) {
        if (deleted[d].el === el) {
          var rec = deleted[d];
          rec.parent.insertBefore(rec.el, rec.next && rec.next.parentElement === rec.parent ? rec.next : null);
          deleted.splice(d, 1);
          break;
        }
      }
    } else if (en.op === "html" && htmlEdits.has(el)) {
      var hr = htmlEdits.get(el), tmp = document.createElement("div");
      tmp.innerHTML = hr.from; var back = tmp.firstElementChild;
      if (back && el.parentNode) { el.parentNode.insertBefore(back, el.nextSibling); el.parentNode.removeChild(el); }
      htmlEdits.delete(el);
      if (el === selected) selectEl(back || null);
    }
    // purge this element's history entries so undo/redo can't resurrect the change
    function keep(s) { return s.el !== el && !(s.rec && s.rec.el === el) && s.newNode !== el && s.oldNode !== el; }
    undoStack = undoStack.filter(keep);
    redoStack = redoStack.filter(keep);
    if (el === selected && document.body.contains(el)) selectEl(el, true);
    renderTree(); redraw(); updateCount();
  }
  function renderChanges() {
    var list = buildChangeList();
    chpanel.innerHTML = "";
    var head = document.createElement("div"); head.className = NS + "-chhead";
    head.textContent = list.length ? "Pending changes — ✕ reverts the whole element" : "No pending changes";
    chpanel.appendChild(head);
    list.forEach(function (en) {
      var row = document.createElement("div"); row.className = NS + "-chrow" + (en.el === selected ? " " + NS + "-chsel" : "");
      var sum = document.createElement("span"); sum.className = NS + "-chsum"; sum.textContent = humanize(en);
      var x = document.createElement("button"); x.className = NS + "-chx"; x.textContent = "✕"; x.title = "Revert this element";
      x.onclick = function (e) { e.stopPropagation(); revertEl(en); };
      row.onclick = function () {
        if (!document.body.contains(en.el)) return;   // deleted — nothing to show
        selectEl(en.el, false);
        en.el.scrollIntoView({ block: "center", behavior: "smooth" });
        renderChanges();
      };
      row.appendChild(sum); row.appendChild(x); chpanel.appendChild(row);
    });
  }

  // --- keyboard cheatsheet overlay ---
  var keysOv = document.createElement("div");
  keysOv.className = NS + "-keys " + NS + "-hidden";
  var keysOpen = false;
  (function buildKeys() {
    var card = document.createElement("div"); card.className = NS + "-keycard";
    var GROUPS = [
      ["General", [
        ["⌘ + Ctrl", "Show / hide the editor UI"],
        ["Esc", "Deselect · close popover"],
        ["?", "This cheatsheet"],
        ["⌘Z / ⇧⌘Z", "Undo / redo"],
        ["⌘S", "Copy change-list"]]],
      ["Select & navigate", [
        ["Click", "Select element"],
        ["Enter / ⇧Enter", "Into first child / up to parent"],
        ["Tab / ⇧Tab", "Next / previous sibling"],
        ["Double-click", "Edit text in place"]]],
      ["Edit", [
        ["Arrows / ⇧Arrows", "Nudge 1px / 10px"],
        ["⌘D", "Duplicate element"],
        ["Delete", "Delete element"],
        ["Drag", "Reorder in flex/grid · handles resize"],
        ["Drag a label", "Scrub any numeric field"]]],
      ["Inspect", [
        ["C", "Floating code window (edit HTML/CSS)"],
        ["⌥ hover", "Measure distances from selection"],
        ["⌘⌥ click", "Copy element HTML (peek-copy)"]]]
    ];
    GROUPS.forEach(function (g) {
      var h = document.createElement("h3"); h.textContent = g[0]; card.appendChild(h);
      g[1].forEach(function (k) {
        var row = document.createElement("div"); row.className = NS + "-keyrow";
        var s = document.createElement("span"); s.textContent = k[1];
        var kbd = document.createElement("span"); kbd.className = NS + "-kbd"; kbd.textContent = k[0];
        row.appendChild(s); row.appendChild(kbd); card.appendChild(row);
      });
    });
    keysOv.appendChild(card);
  })();
  keysOv.onclick = function (e) { if (e.target === keysOv) keysToggle(false); };
  document.body.appendChild(keysOv);
  function keysToggle(on) {
    keysOpen = on !== undefined ? on : !keysOpen;
    show(keysOv, keysOpen);
  }

  // --- measure layer (Alt-hover distances) ---
  var mLayer = document.createElement("div"); mLayer.className = NS + "-glayer";
  document.body.appendChild(mLayer);

  // --- floating Code window (mini-tool): live-editable HTML + CSS of the selection ---
  var cwOpen = false, cwHtmlTA, cwCssTA, cwSel, cwBody, cwEmpty, cwMoved = false;
  var codeWin = document.createElement("div");
  codeWin.className = NS + "-cw " + NS + "-hidden";
  (function buildCodeWin() {
    var bar = document.createElement("div"); bar.className = NS + "-cwbar";
    var title = document.createElement("b"); title.textContent = "Code";
    cwSel = document.createElement("span"); cwSel.className = NS + "-cwsel";
    var x = document.createElement("button"); x.className = NS + "-cwx"; x.textContent = "✕"; x.title = "Close (C)";
    x.onclick = function () { toggleCodeWin(false); };
    bar.appendChild(title); bar.appendChild(cwSel); bar.appendChild(x);

    cwBody = document.createElement("div"); cwBody.className = NS + "-cwbody";
    cwEmpty = document.createElement("div"); cwEmpty.className = NS + "-cwempty";
    cwEmpty.textContent = "Select an element to see its HTML & CSS.";

    function group(lbl, hintTxt, apply) {
      var g = document.createElement("div"); g.className = NS + "-cwgrp";
      var head = document.createElement("div"); head.className = NS + "-cwlbl";
      var name = document.createElement("span"); name.textContent = lbl;
      var btn = document.createElement("button"); btn.className = NS + "-cwapply"; btn.textContent = "Apply";
      var ta = document.createElement("textarea"); ta.className = NS + "-cwta"; ta.spellcheck = false;
      ta.rows = lbl === "HTML" ? 6 : 5;
      btn.onclick = function () { apply(ta); };
      // Cmd/Ctrl+Enter applies; typing in the field never triggers page shortcuts (isTyping guard)
      ta.addEventListener("keydown", function (e) {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); apply(ta); }
      });
      head.appendChild(name); head.appendChild(btn);
      g.appendChild(head); g.appendChild(ta);
      if (hintTxt) { var h = document.createElement("div"); h.className = NS + "-cwhint"; h.textContent = hintTxt; g.appendChild(h); }
      return { group: g, ta: ta };
    }
    var htmlG = group("HTML", "⌘↵ to apply · replaces the element", applyHtmlEdit);
    var cssG = group("CSS", "⌘↵ to apply · these become inline styles", applyCssEdit);
    cwHtmlTA = htmlG.ta; cwCssTA = cssG.ta;
    cwBody.appendChild(cwEmpty); cwBody.appendChild(htmlG.group); cwBody.appendChild(cssG.group);

    codeWin.appendChild(bar); codeWin.appendChild(cwBody);
    // drag by the title bar
    bar.addEventListener("pointerdown", function (e) {
      if (e.target === x) return;
      var r = codeWin.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
      bar.setPointerCapture(e.pointerId);
      function mv(ev) {
        cwMoved = true;
        codeWin.style.left = Math.max(0, Math.min(window.innerWidth - 60, ev.clientX - ox)) + "px";
        codeWin.style.top = Math.max(0, Math.min(window.innerHeight - 30, ev.clientY - oy)) + "px";
        codeWin.style.right = "auto"; codeWin.style.bottom = "auto";
      }
      function up() { bar.releasePointerCapture(e.pointerId); bar.removeEventListener("pointermove", mv); bar.removeEventListener("pointerup", up); }
      bar.addEventListener("pointermove", mv); bar.addEventListener("pointerup", up);
    });
  })();
  document.body.appendChild(codeWin);

  function toggleCodeWin(on) {
    cwOpen = on !== undefined ? on : !cwOpen;
    if (cwOpen && !cwMoved) {   // first open: park it bottom-right, clear of the inspector
      codeWin.style.left = ""; codeWin.style.top = "";
      codeWin.style.right = (RIGHT_W + 24) + "px"; codeWin.style.bottom = "72px";
    }
    show(codeWin, cwOpen && !uiHidden);
    if (cwOpen) refreshCodeWin();
  }
  function refreshCodeWin() {
    if (!cwOpen) return;
    var has = !!selected && document.body.contains(selected);
    show(cwEmpty, !has);
    cwHtmlTA.parentNode.style.display = has ? "" : "none";
    cwCssTA.parentNode.style.display = has ? "" : "none";
    if (!has) { cwSel.textContent = ""; return; }
    cwSel.textContent = selectorFor(selected);
    if (document.activeElement !== cwHtmlTA) { cwHtmlTA.value = elHTML(selected); cwHtmlTA.classList.remove("bad"); }
    if (document.activeElement !== cwCssTA) { cwCssTA.value = elCSS(selected); cwCssTA.classList.remove("bad"); }
  }
  function applyCssEdit(ta) {
    if (!selected) return;
    var m = ta.value.match(/\{([\s\S]*)\}/);
    var decls = m ? m[1] : ta.value;   // tolerate the user deleting the selector wrapper
    var from = selected.style.cssText;
    var test = document.createElement("div");
    test.style.cssText = decls;
    if (!test.style.cssText && decls.replace(/[\s;]/g, "")) { ta.classList.add("bad"); return; }
    selected.style.cssText = test.style.cssText;
    ta.classList.remove("bad");
    commitEl(selected, from);
    redrawFull(); updateGapHandles();
    if (!rightOff && !uiHidden) buildInspector(selected);   // reflect edits in the docked panel
  }
  function applyHtmlEdit(ta) {
    if (!selected || !selected.parentNode) return;
    var tmp = document.createElement("div");
    try { tmp.innerHTML = ta.value.trim(); } catch (err) { ta.classList.add("bad"); return; }
    var neu = tmp.firstElementChild;
    if (!neu || tmp.children.length !== 1) { ta.classList.add("bad"); return; }  // must be exactly one root
    ta.classList.remove("bad");
    var old = selected, parent = old.parentNode, next = old.nextSibling;
    var rec = htmlEdits.get(old) || { selector: cssPath(old), from: old.outerHTML };
    parent.insertBefore(neu, next);
    parent.removeChild(old);
    htmlEdits.delete(old);
    htmlEdits.set(neu, rec);
    undoStack.push({ type: "html", parent: parent, oldNode: old, newNode: neu, next: next });
    redoStack.length = 0;
    selectEl(neu);
    renderTree(); updateCount();
  }

  // resize handles on the selection box (hx/hy: -1 left/top, 0 mid, 1 right/bottom)
  // edges = invisible hit-strips (side resize, no square); corners = visible squares.
  // edges appended first so the corner squares sit on top at the corners.
  var HANDLES = [
    { hx: 0, hy: -1, cur: "ns" }, { hx: 1, hy: 0, cur: "ew" }, { hx: 0, hy: 1, cur: "ns" }, { hx: -1, hy: 0, cur: "ew" },
    { hx: -1, hy: -1, cur: "nwse" }, { hx: 1, hy: -1, cur: "nesw" }, { hx: 1, hy: 1, cur: "nwse" }, { hx: -1, hy: 1, cur: "nesw" }
  ];
  HANDLES.forEach(function (h) {
    var el = document.createElement("div");
    el.className = NS + "-hs";                       // ve2- prefix so isChrome() ignores it
    el.style.position = "absolute"; el.style.pointerEvents = "auto"; el.style.boxSizing = "border-box";
    el.style.cursor = h.cur + "-resize";
    if (h.hx !== 0 && h.hy !== 0) {                 // corner square
      el.className = NS + "-h";
      el.style.left = ((h.hx + 1) * 50) + "%";
      el.style.top = ((h.hy + 1) * 50) + "%";
    } else if (h.hy === 0) {                        // left/right edge strip
      el.style.top = "0"; el.style.height = "100%"; el.style.width = "9px";
      el.style.left = h.hx < 0 ? "0" : "100%"; el.style.marginLeft = "-4.5px";
    } else {                                        // top/bottom edge strip
      el.style.left = "0"; el.style.width = "100%"; el.style.height = "9px";
      el.style.top = h.hy < 0 ? "0" : "100%"; el.style.marginTop = "-4.5px";
    }
    el.onpointerdown = function (e) { startResize(e, h, el); };
    selBox.appendChild(el);
  });

  // The page reflows into the space beside the panels (docking, not overlay). The
  // content is wrapped in a `stage` element (built at the end of init) that reserves
  // left/right space; its `transform` makes fixed/sticky layers dock to it too.
  var LEFT_W = Math.max(200, Math.min(400, state.leftW || 248));
  var RIGHT_W = Math.max(200, Math.min(400, state.rightW || 264));
  var stage = null;
  function reflow() {
    if (!stage) return;
    var l = uiHidden ? 0 : (leftOff ? 0 : LEFT_W);
    var r = (uiHidden || rightOff || !selected) ? 0 : RIGHT_W;
    var avail = Math.max(320, window.innerWidth - l - r);
    // breakpoint preview: cap the stage width and center it in the docked area.
    // (Media queries still see the real viewport — this covers fluid/clamp layout.)
    var w = (!uiHidden && breakpoint) ? Math.min(breakpoint, avail) : avail;
    var extra = (avail - w) / 2;
    stage.style.marginLeft = (l + extra) + "px";
    stage.style.marginRight = (r + extra) + "px";
    stage.style.width = w + "px";
    placeStrips();
  }

  function isChrome(node) {
    if (!node || node.nodeType !== 1) return false;
    if (("" + node.className).indexOf(NS + "-") === 0) return true;
    return !!(node.closest && node.closest("." + NS + "-panel, ." + NS + "-insp, ." + NS + "-tbar, ." + NS + "-chpanel, ." + NS + "-keys"));
  }
  function show(el, on) { el.classList.toggle(NS + "-hidden", !on); }
  function place(el, r) { el.style.left = r.left + "px"; el.style.top = r.top + "px"; el.style.width = r.width + "px"; el.style.height = r.height + "px"; }

  var SKIP = { SCRIPT: 1, STYLE: 1, LINK: 1, META: 1, NOSCRIPT: 1, TEMPLATE: 1, HEAD: 1, TITLE: 1 };
  var EXT = /protonpass|grammarly|lastpass|1password|dashlane|bitwarden|honey|metamask/i;
  function isExtension(node) {
    return EXT.test(node.tagName) || EXT.test("" + node.id) || EXT.test("" + node.className) ||
      (node.tagName.indexOf("-") > -1 && !!node.shadowRoot);   // custom elements w/ shadow DOM (extension widgets)
  }
  function renderable(node) { return node.nodeType === 1 && !isChrome(node) && !SKIP[node.tagName] && !isExtension(node); }
  function kids(node) { return Array.prototype.filter.call(node.children, renderable); }
  function pageRoot() { return stage || document.body; }   // real page-content root (stage once wrapped)

  // --- tree ---
  function label(node) {
    var name = node.tagName.toLowerCase();
    var id = node.id ? "#" + node.id : "";
    var cls = !id && node.classList && node.classList.length ? "." + node.classList[0] : "";
    var txt = "";
    if (!kids(node).length) { var t = (node.textContent || "").trim().replace(/\s+/g, " "); if (t) txt = "  " + (t.length > 18 ? t.slice(0, 18) + "…" : t); }
    return { tag: name, extra: id || cls, txt: txt };
  }

  // per-kind 12px stroke icons (Figma-style layer glyphs)
  var ICONS = {
    frame: "<path d='M4 1v10M8 1v10M1 4h10M1 8h10'/>",
    box: "<rect x='1.5' y='1.5' width='9' height='9' rx='1'/>",
    text: "<path d='M2.5 3V1.5h7V3M6 1.5v9M4.5 10.5h3'/>",
    image: "<rect x='1.5' y='1.5' width='9' height='9' rx='1'/><circle cx='4.3' cy='4.3' r='.9' fill='currentColor' stroke='none'/><path d='M1.5 9.2 4.8 6l2 1.9L8.8 6l1.7 1.7'/>",
    button: "<rect x='1' y='3.5' width='10' height='5' rx='2.5'/><path d='M4 6h4'/>",
    link: "<path d='M4.5 2H10v5.5M10 2 2 10'/>",
    vector: "<path d='M1.5 10.5C3 5 7 3 10.5 1.5'/><circle cx='1.5' cy='10.5' r='1.1'/><circle cx='10.5' cy='1.5' r='1.1'/>",
    list: "<path d='M4.5 2.5H11M4.5 6H11M4.5 9.5H11'/><circle cx='1.8' cy='2.5' r='.9' fill='currentColor' stroke='none'/><circle cx='1.8' cy='6' r='.9' fill='currentColor' stroke='none'/><circle cx='1.8' cy='9.5' r='.9' fill='currentColor' stroke='none'/>",
    form: "<rect x='1' y='3' width='10' height='6' rx='1'/><path d='M3.2 5v2'/>",
    video: "<rect x='1.5' y='2' width='9' height='8' rx='1.5'/><path d='M5 4.5v3l2.6-1.5z' fill='currentColor' stroke='none'/>"
  };
  function icon(kind) {
    return "<svg width='12' height='12' viewBox='0 0 12 12' fill='none' stroke='currentColor' stroke-width='1.1' stroke-linecap='round' stroke-linejoin='round'>" + (ICONS[kind] || ICONS.box) + "</svg>";
  }
  function kindOf(node) {
    var t = node.tagName;
    if (/^(SECTION|HEADER|FOOTER|NAV|MAIN|ARTICLE|ASIDE)$/.test(t)) return "frame";
    if (/^(IMG|PICTURE|CANVAS|FIGURE)$/.test(t)) return "image";
    if (t === "BUTTON") return "button";
    if (t === "A") return "link";
    if (t.toLowerCase() === "svg") return "vector";
    if (t === "UL" || t === "OL") return "list";
    if (/^(FORM|INPUT|TEXTAREA|SELECT|LABEL)$/.test(t)) return "form";
    if (/^(VIDEO|AUDIO|IFRAME)$/.test(t)) return "video";
    if (isTextEl(node) || /^(H[1-6]|P|SPAN|EM|STRONG|BLOCKQUOTE|LI|FIGCAPTION|SMALL|CODE)$/.test(t)) return "text";
    return "box";
  }
  function eyeIco(off) {
    var open = "<path d='M1 6c1.7-2.6 8.3-2.6 10 0-1.7 2.6-8.3 2.6-10 0z'/><circle cx='6' cy='6' r='1.3'/>";
    return "<svg width='12' height='12' viewBox='0 0 12 12' fill='none' stroke='currentColor' stroke-width='1.1' stroke-linecap='round' stroke-linejoin='round'>" + open + (off ? "<path d='M2 10.5 10 1.5'/>" : "") + "</svg>";
  }

  function nodeMatches(node) {
    if (!treeFilter) return true;
    var s = node.tagName.toLowerCase() + " " + ("" + node.id) + " " + ("" + node.className);
    if (!kids(node).length) s += " " + (node.textContent || "").slice(0, 120);
    return s.toLowerCase().indexOf(treeFilter) > -1;
  }
  function renderTree() {
    tree.innerHTML = ""; rowOf.clear();
    var showSet = null;
    if (treeFilter) {
      // keep only matching nodes + their ancestors, force-expanded
      showSet = new Set();
      (function mark(n) {
        var any = false;
        kids(n).forEach(function (c) { if (mark(c)) any = true; });
        if (any || nodeMatches(n)) { showSet.add(n); return true; }
        return false;
      })(pageRoot());
    }
    kids(pageRoot()).forEach(function (n) { renderNode(n, 0, showSet); });
  }
  function renderNode(node, depth, showSet) {
    if (showSet && !showSet.has(node)) return;
    var children = kids(node);
    var hidden = node.style.display === "none";
    var row = document.createElement("div");
    row.className = NS + "-row" + (node === selected ? " sel" : "") + (hidden ? " ghost" : "");
    row.style.paddingLeft = (6 + depth * 14) + "px";

    var open = showSet ? true : expanded.has(node);
    var caret = document.createElement("span"); caret.className = NS + "-caret";
    if (children.length) {
      caret.textContent = open ? "▾" : "▸";
      caret.onclick = function (e) { e.stopPropagation(); if (expanded.has(node)) expanded.delete(node); else expanded.add(node); renderTree(); };
    }
    var ico = document.createElement("span"); ico.className = NS + "-ico";
    ico.innerHTML = icon(kindOf(node));

    var info = label(node);
    var lbl = document.createElement("span"); lbl.className = NS + "-lbl";
    lbl.innerHTML = "<b>" + info.tag + "</b><i>" + (info.extra ? " " + escapeHTML(info.extra) : "") + "</i>" + (info.txt ? "<span style='color:#7a7a7a'>" + escapeHTML(info.txt) + "</span>" : "");

    // eye: toggle display:none inline (flows into the change-list like any style edit)
    var eye = document.createElement("button");
    eye.className = NS + "-eye" + (hidden ? " off" : "");
    eye.innerHTML = eyeIco(hidden);
    eye.title = hidden ? "Show" : "Hide (display:none)";
    eye.onclick = function (e) {
      e.stopPropagation();
      var from = node.style.cssText;
      node.style.display = hidden ? "" : "none";
      commitEl(node, from);
      renderTree(); redrawFull();
    };

    row.appendChild(caret); row.appendChild(ico); row.appendChild(lbl); row.appendChild(eye);
    row.onmouseenter = function () { place(hoverBox, node.getBoundingClientRect()); show(hoverBox, node !== selected && !hidden); };
    row.onmouseleave = function () { show(hoverBox, false); };
    row.onclick = function () { selectEl(node); };
    tree.appendChild(row);
    rowOf.set(node, row);

    if (children.length && open) children.forEach(function (c) { renderNode(c, depth + 1, showSet); });
  }
  function escapeHTML(s) { return s.replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }

  // --- history ---
  function commit(node) {
    if (!node || node.style.cssText === baseCss) return;
    if (!origCss.has(node)) origCss.set(node, baseCss);
    undoStack.push({ el: node, from: baseCss, to: node.style.cssText });
    redoStack.length = 0;
    baseCss = node.style.cssText;
    updateCount();
  }
  // like commit() but with an explicit "from" snapshot — for edits made outside
  // the selected-element flow (eye toggle, keyboard nudge, …)
  function commitEl(node, fromCss) {
    if (node.style.cssText === fromCss) return;
    if (!origCss.has(node)) origCss.set(node, fromCss);
    undoStack.push({ el: node, from: fromCss, to: node.style.cssText });
    redoStack.length = 0;
    if (node === selected) baseCss = node.style.cssText;
    updateCount();
  }
  function applyStep(step, dir) {
    if (step.type === "move") {
      var ref = dir === "undo" ? step.undoNext : step.redoNext;
      step.parent.insertBefore(step.el, ref && ref.parentElement === step.parent ? ref : null);
      selectEl(step.el, true);
      return;
    }
    if (step.type === "insert") {
      if (dir === "undo") { step.el.remove(); selectEl(null); }
      else {
        step.parent.insertBefore(step.el, step.next && step.next.parentElement === step.parent ? step.next : null);
        selectEl(step.el, true);
      }
      renderTree();
      return;
    }
    if (step.type === "delete") {
      var rec = step.rec;
      if (dir === "undo") {
        rec.parent.insertBefore(rec.el, rec.next && rec.next.parentElement === rec.parent ? rec.next : null);
        if (step.wasInserted) inserted.set(rec.el, step.wasInserted);
        else { var i = deleted.indexOf(rec); if (i > -1) deleted.splice(i, 1); }
        selectEl(rec.el, true);
      } else {
        rec.el.remove();
        if (step.wasInserted) inserted.delete(rec.el);
        else deleted.push(rec);
        selectEl(null);
      }
      renderTree();
      return;
    }
    if (step.type === "html") {
      var keep = dir === "undo" ? step.oldNode : step.newNode;
      var drop = dir === "undo" ? step.newNode : step.oldNode;
      step.parent.insertBefore(keep, drop.nextSibling);
      step.parent.removeChild(drop);
      htmlEdits.delete(drop);
      if (dir === "redo") { htmlEdits.set(step.newNode, htmlEdits.get(step.newNode) || { selector: cssPath(step.oldNode), from: step.oldNode.outerHTML }); }
      selectEl(keep, true);
      renderTree();
      return;
    }
    var css = dir === "undo" ? step.from : step.to;
    step.el.style.cssText = css;
    selectEl(step.el, true);   // rebuilds inspector + resets baseCss to this css
    baseCss = css;
  }
  function undo() { var s = undoStack.pop(); if (!s) return; redoStack.push(s); applyStep(s, "undo"); updateCount(); }
  function redo() { var s = redoStack.pop(); if (!s) return; undoStack.push(s); applyStep(s, "redo"); updateCount(); }
  // Cmd+D: clone the selected element, insert right after it, select the clone.
  function duplicateSel() {
    if (!selected) return;
    var orig = selected, clone = orig.cloneNode(true);
    orig.parentElement.insertBefore(clone, orig.nextSibling);
    inserted.set(clone, { anchor: cssPath(orig) });
    undoStack.push({ type: "insert", el: clone, parent: orig.parentElement, next: clone.nextSibling });
    redoStack.length = 0;
    selectEl(clone, true);
    renderTree();
    updateCount();
  }
  // Delete/Backspace: remove the selected element (recorded for undo + change-list).
  function deleteSel() {
    if (!selected) return;
    var el = selected;
    var txt = (el.textContent || "").trim().replace(/\s+/g, " ");
    var rec = {
      selector: cssPath(el), tag: el.tagName.toLowerCase(),
      text: txt && txt.length <= 40 ? txt : undefined,
      el: el, parent: el.parentElement, next: el.nextSibling
    };
    var wasInserted = inserted.get(el) || null;
    if (wasInserted) inserted.delete(el); else deleted.push(rec);
    el.remove();
    undoStack.push({ type: "delete", rec: rec, wasInserted: wasInserted });
    redoStack.length = 0;
    selectEl(null);
    renderTree();
    updateCount();
  }
  // Arrow keys: nudge the selection's translate by dx/dy px.
  function nudge(dx, dy) {
    if (!selected) return;
    var from = selected.style.cssText;
    var t = getTranslate(selected);
    selected.style.transform = "translate(" + (t[0] + dx) + "px, " + (t[1] + dy) + "px)";
    commitEl(selected, from);
    if (fieldRefs.translateX) fieldRefs.translateX.value = t[0] + dx;
    if (fieldRefs.translateY) fieldRefs.translateY.value = t[1] + dy;
    redrawFull();
  }

  // --- inspector ---
  function px(v) { return Math.round(parseFloat(v)) + "px"; }
  function fld(prop, lbl, value, apply, swatch) {
    var wrap = document.createElement("div"); wrap.className = NS + "-fld";
    if (lbl) { var l = document.createElement("label"); l.textContent = lbl; wrap.appendChild(l); }
    var node = selected;
    var sw;
    if (swatch) {
      sw = document.createElement("input"); sw.type = "color"; sw.className = NS + "-sw";
      sw.value = /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000";
      sw.oninput = function () { inp.value = sw.value; apply(sw.value); redrawFull(); };
      sw.onchange = function () { commit(node); };
      wrap.appendChild(sw);
    }
    var inp = document.createElement("input"); inp.value = value || "";
    inp.oninput = function () { apply(inp.value); if (swatch && /^#[0-9a-f]{6}$/i.test(inp.value)) sw.value = inp.value; redrawFull(); };
    inp.onchange = function () { commit(node); };
    wrap.appendChild(inp);
    fieldRefs[prop] = inp;
    return wrap;
  }
  function opacityField() {
    var node = selected;
    var wrap = document.createElement("div"); wrap.className = NS + "-fld";
    var l = document.createElement("label"); l.textContent = "Op"; l.className = NS + "-scrub"; wrap.appendChild(l);
    var inp = document.createElement("input");
    function cur() { return Math.round(parseFloat(getComputedStyle(node).opacity) * 100); }
    inp.value = cur() + "%";
    function setPct(p) { p = Math.max(0, Math.min(100, Math.round(p))); node.style.opacity = p / 100; inp.value = p + "%"; redrawFull(); }
    inp.oninput = function () { var p = parseFloat(inp.value); if (!isNaN(p)) { node.style.opacity = Math.max(0, Math.min(100, p)) / 100; redrawFull(); } };
    inp.onchange = function () { setPct(parseFloat(inp.value) || 0); commit(node); };
    l.onpointerdown = function (e) {
      e.preventDefault();
      var startX = e.clientX, startP = cur();
      l.setPointerCapture(e.pointerId);
      l.onpointermove = function (ev) { setPct(startP + (ev.clientX - startX)); };
      l.onpointerup = function () { l.onpointermove = null; l.onpointerup = null; commit(node); };
    };
    wrap.appendChild(inp);
    fieldRefs.opacity = inp;
    return wrap;
  }
  function section(title, rows, grid, hint) {
    var s = document.createElement("div"); s.className = NS + "-sec";
    var t = document.createElement("div"); t.className = NS + "-sect";
    var car = document.createElement("span"); car.className = NS + "-scaret"; car.textContent = collapsedSecs[title] ? "▸" : "▾";
    var tt = document.createElement("span"); tt.textContent = title;
    t.appendChild(car); t.appendChild(tt); s.appendChild(t);
    var h = null;
    if (hint) { h = document.createElement("div"); h.className = NS + "-hint"; h.textContent = "↳ " + hint; s.appendChild(h); }
    var body = document.createElement("div");
    if (grid) body.className = NS + "-grid";
    else { body.style.display = "flex"; body.style.flexDirection = "column"; body.style.gap = "8px"; }
    rows.forEach(function (r) { body.appendChild(r); }); s.appendChild(body);
    function applyCollapse() {
      var off = !!collapsedSecs[title];
      car.textContent = off ? "▸" : "▾";
      body.style.display = off ? "none" : (grid ? "grid" : "flex");
      if (h) h.style.display = off ? "none" : "flex";
    }
    applyCollapse();
    t.onclick = function () { collapsedSecs[title] = !collapsedSecs[title]; applyCollapse(); saveState(); };
    return s;
  }
  // generic scrub-label numeric field (drag the label to scrub, type to set)
  function scrubFld(key, lblTxt, node, get, set, opts) {
    opts = opts || {};
    var wrap = document.createElement("div"); wrap.className = NS + "-fld";
    var l = document.createElement("label"); l.textContent = lblTxt; l.className = NS + "-scrub";
    if (opts.wide) l.style.width = "auto";
    wrap.appendChild(l);
    var inp = document.createElement("input");
    function clampV(v) {
      if (opts.min !== undefined) v = Math.max(opts.min, v);
      if (opts.max !== undefined) v = Math.min(opts.max, v);
      return v;
    }
    function fmt(v) { return opts.fixed ? +v.toFixed(opts.fixed) : Math.round(v); }
    inp.value = fmt(get());
    function setV(v) { v = clampV(v); set(fmt(v)); inp.value = fmt(v); redrawFull(); }
    inp.oninput = function () { var v = parseFloat(inp.value); if (!isNaN(v)) { set(clampV(v)); redrawFull(); } };
    inp.onchange = function () { var v = parseFloat(inp.value); setV(isNaN(v) ? get() : v); commit(node); };
    l.onpointerdown = function (e) {
      e.preventDefault();
      var startX = e.clientX, startV = parseFloat(inp.value) || 0;
      l.setPointerCapture(e.pointerId);
      var perPx = opts.drag || 1;   // value units per pixel dragged
      l.onpointermove = function (ev) { setV(startV + (ev.clientX - startX) * perPx); };
      l.onpointerup = function () { l.onpointermove = null; l.onpointerup = null; commit(node); };
    };
    wrap.appendChild(inp);
    if (key) fieldRefs[key] = inp;
    return wrap;
  }
  function labeled(txt, el) {
    var w = document.createElement("div");
    var l = document.createElement("div");
    l.style.cssText = "font-size:10px;color:#8a8a8a;margin-bottom:4px";
    l.textContent = txt;
    w.appendChild(l); w.appendChild(el);
    return w;
  }
  // row of icon buttons setting one property (Figma-style option row)
  function optRow(node, prop, opts) {
    var row = document.createElement("div"); row.className = NS + "-algrow";
    var cur = getComputedStyle(node)[prop];
    opts.forEach(function (o) {
      var b = document.createElement("div"); b.className = NS + "-alg"; b.innerHTML = o[1]; b.title = o[2] || o[0];
      if (cur === o[0] || (o[3] && o[3].indexOf(cur) > -1)) b.classList.add("on");
      b.onclick = function () {
        node.style[prop] = o[0];
        Array.prototype.forEach.call(row.children, function (c) { c.classList.remove("on"); });
        b.classList.add("on"); redrawFull(); updateGapHandles(); commit(node);
      };
      row.appendChild(b);
    });
    return row;
  }
  var FSVG = "<svg width='14' height='14' viewBox='0 0 14 14' fill='currentColor'>";
  var FLEX_ICO = {
    row: FSVG + "<path fill='none' stroke='currentColor' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round' d='M2 7h9M8 4l3 3-3 3'/></svg>",
    column: FSVG + "<path fill='none' stroke='currentColor' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round' d='M7 2v9M4 8l3 3 3-3'/></svg>",
    jStart: FSVG + "<rect x='1' y='2' width='1.3' height='10'/><rect x='4' y='3.5' width='2.6' height='7' rx='.8'/><rect x='7.6' y='3.5' width='2.6' height='7' rx='.8'/></svg>",
    jCenter: FSVG + "<rect x='3.2' y='3.5' width='2.6' height='7' rx='.8'/><rect x='8.2' y='3.5' width='2.6' height='7' rx='.8'/></svg>",
    jEnd: FSVG + "<rect x='11.7' y='2' width='1.3' height='10'/><rect x='8.4' y='3.5' width='2.6' height='7' rx='.8'/><rect x='4.8' y='3.5' width='2.6' height='7' rx='.8'/></svg>",
    jBetween: FSVG + "<rect x='1' y='2' width='1.3' height='10'/><rect x='11.7' y='2' width='1.3' height='10'/><rect x='3.4' y='3.5' width='2.6' height='7' rx='.8'/><rect x='8' y='3.5' width='2.6' height='7' rx='.8'/></svg>",
    aStart: FSVG + "<rect x='2' y='1.5' width='10' height='1.2'/><rect x='4' y='3.6' width='2.6' height='6' rx='.8'/><rect x='7.4' y='3.6' width='2.6' height='4' rx='.8'/></svg>",
    aCenter: FSVG + "<rect x='4' y='4' width='2.6' height='6' rx='.8'/><rect x='7.4' y='5' width='2.6' height='4' rx='.8'/></svg>",
    aEnd: FSVG + "<rect x='2' y='11.3' width='10' height='1.2'/><rect x='4' y='4.4' width='2.6' height='6' rx='.8'/><rect x='7.4' y='6.4' width='2.6' height='4' rx='.8'/></svg>",
    aStretch: FSVG + "<rect x='2' y='1.5' width='10' height='1.2'/><rect x='2' y='11.3' width='10' height='1.2'/><rect x='4' y='3.6' width='2.6' height='6.8' rx='.8'/><rect x='7.4' y='3.6' width='2.6' height='6.8' rx='.8'/></svg>"
  };
  function flexRows(node) {
    return [
      labeled("Direction", optRow(node, "flexDirection", [
        ["row", FLEX_ICO.row, "row", ["row-reverse"]],
        ["column", FLEX_ICO.column, "column", ["column-reverse"]]])),
      labeled("Justify", optRow(node, "justifyContent", [
        ["flex-start", FLEX_ICO.jStart, "flex-start", ["normal", "start"]],
        ["center", FLEX_ICO.jCenter, "center"],
        ["flex-end", FLEX_ICO.jEnd, "flex-end", ["end"]],
        ["space-between", FLEX_ICO.jBetween, "space-between"]])),
      labeled("Align", optRow(node, "alignItems", [
        ["flex-start", FLEX_ICO.aStart, "flex-start", ["start"]],
        ["center", FLEX_ICO.aCenter, "center"],
        ["flex-end", FLEX_ICO.aEnd, "flex-end", ["end"]],
        ["stretch", FLEX_ICO.aStretch, "stretch", ["normal"]]])),
      labeled("Wrap", optRow(node, "flexWrap", [
        ["nowrap", "No wrap"], ["wrap", "Wrap"]])),
      (function () { var g = document.createElement("div"); g.className = NS + "-grid"; g.appendChild(gapField(node)); return g; })()
    ];
  }
  // margin/padding: 4 mini scrub fields (T/R/B/L) + link-all toggle
  function spacingRow(node, prop) {
    var linked = false;
    var SIDES = ["Top", "Right", "Bottom", "Left"];
    var row = document.createElement("div");
    row.style.cssText = "display:flex;gap:5px;align-items:center";
    var mini = document.createElement("div"); mini.className = NS + "-mini"; mini.style.flex = "1 1 auto";
    var inputs = [];
    SIDES.forEach(function (side) {
      var f = scrubFld(null, side[0], node,
        function () { return Math.round(parseFloat(getComputedStyle(node)[prop + side]) || 0); },
        function (v) {
          if (linked) SIDES.forEach(function (s2, i) { node.style[prop + s2] = v + "px"; if (inputs[i]) inputs[i].value = v; });
          else node.style[prop + side] = v + "px";
        }, prop === "padding" ? { min: 0 } : {});
      inputs.push(f.querySelector("input"));
      mini.appendChild(f);
    });
    var lnk = document.createElement("button"); lnk.className = NS + "-lnk"; lnk.textContent = "⧉"; lnk.title = "Link all sides";
    lnk.onclick = function () { linked = !linked; lnk.classList.toggle("on", linked); };
    row.appendChild(mini); row.appendChild(lnk);
    return row;
  }
  // border-radius: uniform scrub + expandable per-corner grid
  function radiusRows(node) {
    var wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;flex-direction:column;gap:6px";
    var top = document.createElement("div");
    top.style.cssText = "display:flex;gap:5px;align-items:center";
    var uni = scrubFld("borderRadius", "R", node,
      function () { return Math.round(parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0); },
      function (v) { node.style.borderRadius = v + "px"; }, { min: 0 });
    uni.style.flex = "1 1 auto";
    var exp = document.createElement("button"); exp.className = NS + "-lnk"; exp.textContent = "⌵"; exp.title = "Per-corner radii";
    var corners = document.createElement("div"); corners.className = NS + "-mini " + NS + "-hidden";
    [["TopLeft", "TL"], ["TopRight", "TR"], ["BottomRight", "BR"], ["BottomLeft", "BL"]].forEach(function (c) {
      corners.appendChild(scrubFld(null, c[1], node,
        function () { return Math.round(parseFloat(getComputedStyle(node)["border" + c[0] + "Radius"]) || 0); },
        function (v) { node.style["border" + c[0] + "Radius"] = v + "px"; }, { min: 0 }));
    });
    exp.onclick = function () { var on = corners.classList.toggle(NS + "-hidden"); exp.classList.toggle("on", !on); };
    top.appendChild(uni); top.appendChild(exp);
    wrap.appendChild(top); wrap.appendChild(corners);
    return wrap;
  }
  // border: width scrub + style select + color swatch
  function borderRow(node) {
    var cs = getComputedStyle(node);
    var row = document.createElement("div");
    row.style.cssText = "display:flex;gap:5px;align-items:center";
    var w = scrubFld(null, "B", node,
      function () { return Math.round(parseFloat(getComputedStyle(node).borderTopWidth) || 0); },
      function (v) {
        node.style.borderWidth = v + "px";
        if (v > 0 && getComputedStyle(node).borderTopStyle === "none") node.style.borderStyle = "solid";
      }, { min: 0 });
    w.style.flex = "0 0 76px";
    var sel = document.createElement("select");
    ["none", "solid", "dashed", "dotted"].forEach(function (st) {
      var op = document.createElement("option"); op.value = st; op.textContent = st;
      if (cs.borderTopStyle === st) op.selected = true;
      sel.appendChild(op);
    });
    sel.onchange = function () { node.style.borderStyle = sel.value; redrawFull(); commit(node); };
    var selWrap = document.createElement("div"); selWrap.className = NS + "-fld"; selWrap.style.flex = "1 1 auto"; selWrap.appendChild(sel);
    var swatch = document.createElement("input"); swatch.type = "color"; swatch.className = NS + "-sw";
    swatch.value = /^#/.test(rgbToHex(cs.borderTopColor)) ? rgbToHex(cs.borderTopColor) : "#000000";
    swatch.oninput = function () { node.style.borderColor = swatch.value; redrawFull(); };
    swatch.onchange = function () { commit(node); };
    row.appendChild(w); row.appendChild(selWrap); row.appendChild(swatch);
    return row;
  }
  // box-shadow builder: on/off + X/Y/Blur/Spread scrubs + color
  function shadowRows(node) {
    var raw = getComputedStyle(node).boxShadow;
    var m = /(rgba?\([^)]+\)|#[0-9a-f]+)\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px(?:\s+(-?[\d.]+)px)?/i.exec(raw === "none" ? "" : raw);
    var sh = { on: !!m, x: m ? +m[2] : 0, y: m ? +m[3] : 4, blur: m ? +m[4] : 16, spread: m && m[5] ? +m[5] : 0, color: m ? m[1] : "rgba(0,0,0,0.25)" };
    function apply() {
      node.style.boxShadow = sh.on ? sh.x + "px " + sh.y + "px " + sh.blur + "px " + sh.spread + "px " + sh.color : "none";
    }
    var wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;flex-direction:column;gap:6px";
    var top = document.createElement("div");
    top.style.cssText = "display:flex;gap:5px;align-items:center";
    var tog = document.createElement("button"); tog.className = NS + "-lnk" + (sh.on ? " on" : ""); tog.textContent = "◐"; tog.title = "Shadow on/off";
    var lbl = document.createElement("span"); lbl.style.cssText = "font-size:10px;color:#8a8a8a"; lbl.textContent = "Shadow";
    var swatch = document.createElement("input"); swatch.type = "color"; swatch.className = NS + "-sw"; swatch.style.marginLeft = "auto";
    swatch.value = /^#/.test(rgbToHex(sh.color)) ? rgbToHex(sh.color) : "#000000";
    swatch.oninput = function () { sh.color = swatch.value; if (sh.on) { apply(); redrawFull(); } };
    swatch.onchange = function () { commit(node); };
    top.appendChild(tog); top.appendChild(lbl); top.appendChild(swatch);
    var grid = document.createElement("div"); grid.className = NS + "-mini";
    if (!sh.on) grid.classList.add(NS + "-hidden");
    [["x", "X"], ["y", "Y"], ["blur", "B"], ["spread", "S"]].forEach(function (p) {
      grid.appendChild(scrubFld(null, p[1], node,
        function () { return sh[p[0]]; },
        function (v) { sh[p[0]] = v; apply(); },
        p[0] === "blur" ? { min: 0 } : {}));
    });
    tog.onclick = function () {
      sh.on = !sh.on; tog.classList.toggle("on", sh.on);
      grid.classList.toggle(NS + "-hidden", !sh.on);
      apply(); redrawFull(); commit(node);
    };
    wrap.appendChild(top); wrap.appendChild(grid);
    return wrap;
  }

  // --- typography (shown only for text-bearing elements) ---
  function isTextEl(node) {
    for (var i = 0; i < node.childNodes.length; i++) {
      var c = node.childNodes[i];
      if (c.nodeType === 3 && c.nodeValue.trim()) return true;   // a non-empty text node
    }
    return false;
  }
  var FONTS = [
    ["Manrope", "Manrope"],
    ["Inter", "Inter"], ["Roboto", "Roboto"], ["Roboto Serif", "Roboto Serif"],
    ["Source Serif Pro", "Source Serif Pro"], ["Arial", "Arial"], ["Helvetica", "Helvetica"],
    ["Georgia", "Georgia"], ["Times New Roman", "Times New Roman"],
    ["Courier New", "Courier New"], ["Verdana", "Verdana"], ["Tahoma", "Tahoma"],
    ["system-ui", "System UI"], ["ui-monospace", "Monospace"]];
  var WEIGHTS = [["100", "Thin"], ["200", "Extra Light"], ["300", "Light"], ["400", "Regular"],
    ["500", "Medium"], ["600", "Semi Bold"], ["700", "Bold"], ["800", "Extra Bold"], ["900", "Black"]];
  function selFld(lbl, options, current, apply, previewFont) {
    var node = selected;
    var wrap = document.createElement("div"); wrap.className = NS + "-fld";
    if (lbl) { var l = document.createElement("label"); l.textContent = lbl; l.style.width = "auto"; wrap.appendChild(l); }
    var sel = document.createElement("select");
    var has = false;
    options.forEach(function (o) {
      var val = o[0] !== undefined ? o[0] : o, txt = o[1] !== undefined ? o[1] : o;
      var op = document.createElement("option"); op.value = val; op.textContent = txt;
      if (previewFont) op.style.fontFamily = /\s/.test(val) ? '"' + val + '"' : val;
      if (val.toLowerCase() === (current || "").toLowerCase()) { op.selected = true; has = true; }
      sel.appendChild(op);
    });
    if (!has && current) { var op = document.createElement("option"); op.value = current; op.textContent = current; op.selected = true; sel.insertBefore(op, sel.firstChild); }
    sel.onchange = function () { apply(sel.value); redrawFull(); commit(node); };
    wrap.appendChild(sel);
    return wrap;
  }
  function fontField(node) {
    var fam = (getComputedStyle(node).fontFamily || "").split(",")[0].replace(/["']/g, "").trim();
    return selFld("", FONTS, fam, function (v) { node.style.fontFamily = /\s/.test(v) ? '"' + v + '"' : v; }, true);
  }
  function availWeights(fam) {
    // Collect the weights actually declared for this family via loaded @font-face rules.
    var set = {}, want = (fam || "").replace(/["']/g, "").toLowerCase();
    try {
      document.fonts.forEach(function (ff) {
        if (ff.family.replace(/["']/g, "").toLowerCase() !== want) return;
        var w = "" + ff.weight;
        if (w === "normal") w = "400"; else if (w === "bold") w = "700";
        var range = w.split(/\s+/).map(Number);           // variable fonts give "100 900"
        var lo = range[0], hi = range[1] || range[0];
        WEIGHTS.forEach(function (p) { var n = +p[0]; if (n >= lo && n <= hi) set[p[0]] = 1; });
      });
    } catch (e) { }
    var out = WEIGHTS.filter(function (p) { return set[p[0]]; });
    return out.length ? out : WEIGHTS;   // system font / not in document.fonts → show all
  }
  function weightField(node) {
    var fam = (getComputedStyle(node).fontFamily || "").split(",")[0];
    return selFld("", availWeights(fam), getComputedStyle(node).fontWeight, function (v) { node.style.fontWeight = v; });
  }
  function sizeField(node) {
    var wrap = document.createElement("div"); wrap.className = NS + "-fld";
    var l = document.createElement("label"); l.textContent = "S"; l.className = NS + "-scrub"; wrap.appendChild(l);
    var inp = document.createElement("input");
    function cur() { return Math.round(parseFloat(getComputedStyle(node).fontSize) || 0); }
    inp.value = cur();
    function setV(v) { v = Math.max(1, Math.round(v)); node.style.fontSize = v + "px"; inp.value = v; redrawFull(); }
    inp.oninput = function () { var v = parseFloat(inp.value); if (!isNaN(v)) { node.style.fontSize = Math.max(1, v) + "px"; redrawFull(); } };
    inp.onchange = function () { setV(parseFloat(inp.value) || cur()); commit(node); };
    l.onpointerdown = function (e) {
      e.preventDefault();
      var startX = e.clientX, startV = cur();
      l.setPointerCapture(e.pointerId);
      l.onpointermove = function (ev) { setV(startV + (ev.clientX - startX)); };
      l.onpointerup = function () { l.onpointermove = null; l.onpointerup = null; commit(node); };
    };
    wrap.appendChild(inp);
    return wrap;
  }
  function alignRow(node) {
    var row = document.createElement("div"); row.className = NS + "-algrow";
    var cur = getComputedStyle(node).textAlign;
    if (cur === "start") cur = "left"; if (cur === "end") cur = "right";
    function alignIco(kind) {
      var rows = { left: [12, 8, 12, 8], center: [12, 8, 12, 8], right: [12, 8, 12, 8] };
      var w = rows[kind], y = [4, 7.5, 11, 14.5], svg = "";
      for (var i = 0; i < 4; i++) {
        var len = w[i], x = kind === "center" ? (16 - len) / 2 : kind === "right" ? 16 - len : 0;
        svg += "<rect x='" + x + "' y='" + y[i] + "' width='" + len + "' height='1.6' rx='.8'/>";
      }
      return "<svg width='16' height='16' viewBox='0 0 16 16' fill='currentColor'>" + svg + "</svg>";
    }
    [["left"], ["center"], ["right"]].forEach(function (a) {
      var b = document.createElement("div"); b.className = NS + "-alg"; b.innerHTML = alignIco(a[0]);
      if (a[0] === cur) b.classList.add("on");
      b.onclick = function () {
        node.style.textAlign = a[0];
        Array.prototype.forEach.call(row.children, function (c) { c.classList.remove("on"); });
        b.classList.add("on"); redrawFull(); commit(node);
      };
      row.appendChild(b);
    });
    return row;
  }

  // --- position (transform: translate) ---
  function autoLayout(node) {
    var p = node.parentElement; if (!p) return null;
    var d = getComputedStyle(p).display;
    if (/flex/.test(d)) return "flex"; if (/grid/.test(d)) return "grid"; return null;
  }
  function getTranslate(node) {
    var t = getComputedStyle(node).transform;
    if (!t || t === "none") return [0, 0];
    var m = t.match(/matrix\(([^)]+)\)/);
    if (m) { var p = m[1].split(","); return [Math.round(parseFloat(p[4]) || 0), Math.round(parseFloat(p[5]) || 0)]; }
    return [0, 0];
  }
  function posField(lbl, idx) {
    var node = selected;
    var wrap = document.createElement("div"); wrap.className = NS + "-fld";
    var l = document.createElement("label"); l.textContent = lbl; l.className = NS + "-scrub"; wrap.appendChild(l);
    var inp = document.createElement("input"); inp.value = getTranslate(node)[idx];
    function setV(v) { var t = getTranslate(node); t[idx] = Math.round(v); node.style.transform = "translate(" + t[0] + "px, " + t[1] + "px)"; inp.value = t[idx]; redrawFull(); }
    inp.oninput = function () { var v = parseFloat(inp.value); if (!isNaN(v)) { var t = getTranslate(node); t[idx] = v; node.style.transform = "translate(" + t[0] + "px, " + t[1] + "px)"; redrawFull(); } };
    inp.onchange = function () { setV(parseFloat(inp.value) || 0); commit(node); };
    l.onpointerdown = function (e) {
      e.preventDefault();
      var startX = e.clientX, startV = getTranslate(node)[idx];
      l.setPointerCapture(e.pointerId);
      l.onpointermove = function (ev) { setV(startV + (ev.clientX - startX)); };
      l.onpointerup = function () { l.onpointermove = null; l.onpointerup = null; commit(node); };
    };
    wrap.appendChild(inp);
    fieldRefs["translate" + lbl] = inp;
    return wrap;
  }
  function containerLayout(node) {
    var d = getComputedStyle(node).display;
    if (/flex/.test(d)) return "flex"; if (/grid/.test(d)) return "grid"; return null;
  }
  function getGap(p) {
    var g = getComputedStyle(p).columnGap || getComputedStyle(p).gap || "0px";
    return Math.round(parseFloat(g) || 0);
  }
  function gapField(p) {
    var wrap = document.createElement("div"); wrap.className = NS + "-fld";
    var l = document.createElement("label"); l.textContent = "Gap"; l.className = NS + "-scrub"; wrap.appendChild(l);
    var inp = document.createElement("input"); inp.value = getGap(p); fieldRefs.gap = inp;
    function setV(v) { v = Math.max(0, Math.round(v)); p.style.gap = v + "px"; inp.value = v; redrawFull(); updateGapHandles(); }
    inp.oninput = function () { var v = parseFloat(inp.value); if (!isNaN(v)) { p.style.gap = Math.max(0, v) + "px"; redrawFull(); updateGapHandles(); } };
    inp.onchange = function () { setV(parseFloat(inp.value) || 0); commit(p); };
    l.onpointerdown = function (e) {
      e.preventDefault();
      var startX = e.clientX, startV = getGap(p);
      l.setPointerCapture(e.pointerId);
      l.onpointermove = function (ev) { setV(startV + (ev.clientX - startX)); };
      l.onpointerup = function () { l.onpointermove = null; l.onpointerup = null; commit(p); };
    };
    wrap.appendChild(inp);
    return wrap;
  }
  // --- Code section: the selected element's HTML + its inline/edited CSS ---
  function selectorFor(node) {
    var s = node.tagName.toLowerCase();
    if (node.id) return s + "#" + node.id;
    if (node.classList.length) s += "." + Array.prototype.slice.call(node.classList).join(".");
    return s;
  }
  function elHTML(node) {
    // opening tag + a short inner preview, so big subtrees don't flood the panel
    var open = node.cloneNode(false).outerHTML.replace(/><\/[a-z0-9-]+>$/i, ">");
    var inner = node.innerHTML.trim();
    if (!inner) return node.outerHTML;
    if (inner.length > 240 || node.children.length > 3) inner = "  …" + node.children.length + " children…";
    else inner = "  " + inner.replace(/\n/g, "\n  ");
    return open + "\n" + inner + "\n</" + node.tagName.toLowerCase() + ">";
  }
  function elCSS(node) {
    // the styles the editor has authored on this element (live inline decls)
    var st = node.style, decls = [];
    for (var i = 0; i < st.length; i++) {
      var p = st[i];
      decls.push("  " + p + ": " + st.getPropertyValue(p) + ";");
    }
    if (!decls.length) return selectorFor(node) + " {\n  /* no edited styles yet */\n}";
    return selectorFor(node) + " {\n" + decls.join("\n") + "\n}";
  }
  var codePres = [];   // {pre, get} — refreshed live from redrawFull
  function codeBlock(lbl, getText) {
    var wrap = document.createElement("div"); wrap.className = NS + "-code";
    var l = document.createElement("div"); l.className = NS + "-codelbl"; l.textContent = lbl;
    var pre = document.createElement("pre"); pre.className = NS + "-codepre"; pre.textContent = getText();
    codePres.push({ pre: pre, get: getText });
    var cp = document.createElement("button"); cp.className = NS + "-codecp"; cp.textContent = "Copy";
    cp.onclick = function () {
      var t = getText();
      if (navigator.clipboard) navigator.clipboard.writeText(t);
      cp.textContent = "Copied"; setTimeout(function () { cp.textContent = "Copy"; }, 900);
    };
    wrap.appendChild(l); wrap.appendChild(cp); wrap.appendChild(pre);
    return wrap;
  }
  function codeSection(node) {
    codePres = [];
    return section("Code", [
      codeBlock("HTML", function () { return elHTML(node); }),
      codeBlock("CSS", function () { return elCSS(node); })
    ], false);
  }

  function buildInspector(node) {
    insp.innerHTML = ""; fieldRefs = {};
    baseCss = node.style.cssText;
    var cs = getComputedStyle(node), r = node.getBoundingClientRect();
    var info = label(node);

    var head = document.createElement("div"); head.className = NS + "-ihead";
    head.style.cssText += "display:flex;align-items:center;gap:6px";
    var ht = document.createElement("div"); ht.style.cssText = "flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
    ht.innerHTML = "<b>" + info.tag + "</b> <span>" + escapeHTML(info.extra) + "</span>";
    var hc = document.createElement("button"); hc.className = NS + "-pbtn"; hc.textContent = "›"; hc.title = "Hide inspector";
    hc.onclick = function () { setRightPanel(false); };
    head.appendChild(ht); head.appendChild(hc);
    insp.appendChild(head);

    var al = autoLayout(node);
    insp.appendChild(section("Position", [
      posField("X", 0), posField("Y", 1)
    ], true, al ? "in " + al + " layout — X/Y is a visual offset" : null));

    var self = containerLayout(node);
    if (self === "flex") insp.appendChild(section("Flex layout", flexRows(node), false,
      "drag the gap on the canvas too"));
    else if (self === "grid") insp.appendChild(section("Grid layout", [gapField(node)], true,
      "drag the gap on the canvas too"));

    insp.appendChild(section("Layout", [
      fld("width", "W", Math.round(r.width) + "", function (v) { node.style.width = parseFloat(v) + "px"; }),
      fld("height", "H", Math.round(r.height) + "", function (v) { node.style.height = parseFloat(v) + "px"; })
    ], true));

    insp.appendChild(section("Spacing", [
      labeled("Margin", spacingRow(node, "margin")),
      labeled("Padding", spacingRow(node, "padding"))
    ], false));

    if (isTextEl(node)) {
      var weightSize = document.createElement("div"); weightSize.className = NS + "-grid";
      weightSize.appendChild(weightField(node)); weightSize.appendChild(sizeField(node));
      var lhLs = document.createElement("div"); lhLs.className = NS + "-grid";
      lhLs.appendChild(scrubFld("lineHeight", "LH", node,
        function () {
          var lh = getComputedStyle(node).lineHeight;
          return lh === "normal" ? Math.round(parseFloat(getComputedStyle(node).fontSize) * 1.2) : Math.round(parseFloat(lh));
        },
        function (v) { node.style.lineHeight = v + "px"; }, { min: 0 }));
      lhLs.appendChild(scrubFld("letterSpacing", "LS", node,
        function () {
          var ls = getComputedStyle(node).letterSpacing;
          return ls === "normal" ? 0 : parseFloat(ls);
        },
        function (v) { node.style.letterSpacing = v + "px"; }, { drag: 0.1, fixed: 1 }));
      var colorFld = fld("color", "A", rgbToHex(cs.color), function (v) { node.style.color = v; }, true);
      var caseSel = selFld("Case", [["none", "None"], ["uppercase", "UPPERCASE"], ["lowercase", "lowercase"], ["capitalize", "Capitalize"]],
        cs.textTransform, function (v) { node.style.textTransform = v; });
      insp.appendChild(section("Typography", [fontField(node), weightSize, lhLs, alignRow(node), caseSel, colorFld], false));
    }

    var bgOpacity = document.createElement("div"); bgOpacity.className = NS + "-grid";
    bgOpacity.appendChild(fld("background", "Bg", rgbToHex(cs.backgroundColor), function (v) { node.style.background = v; }, true));
    bgOpacity.appendChild(opacityField());
    insp.appendChild(section("Appearance", [
      bgOpacity,
      labeled("Radius", radiusRows(node)),
      labeled("Border", borderRow(node)),
      shadowRows(node)
    ], false));

    collapsedSecs["Code"] = collapsedSecs.hasOwnProperty("Code") ? collapsedSecs["Code"] : true;
    insp.appendChild(codeSection(node));
  }
  function rgbToHex(rgb) {
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb || "");
    if (!m) return rgb || "";
    return "#" + [1, 2, 3].map(function (i) { return ("0" + (+m[i]).toString(16)).slice(-2); }).join("");
  }
  function redrawFull() {
    if (!selected) return;
    var r = selected.getBoundingClientRect();
    place(selBox, r);
    tag.textContent = selected.tagName.toLowerCase() + "  " + Math.round(r.width) + "×" + Math.round(r.height);
    tag.style.left = r.left + "px"; tag.style.top = Math.max(0, r.top - 20) + "px";
    updateGapHandles();
    for (var i = 0; i < codePres.length; i++) {
      var t = codePres[i].get();
      if (codePres[i].pre.textContent !== t) codePres[i].pre.textContent = t;
    }
  }
  // On-canvas gap handles: a draggable band sitting in each gap between children.
  var gapDragging = false;
  function updateGapHandles() {
    if (gapDragging) return;                       // don't rebuild mid-drag
    gapLayer.innerHTML = "";
    if (!selected || !containerLayout(selected)) return;
    var cs = getComputedStyle(selected);
    var col = /column/.test(cs.flexDirection);     // flex column stacks vertically
    var kids = [], i, c = selected.children;
    for (i = 0; i < c.length; i++) if (!isChrome(c[i]) && getComputedStyle(c[i]).display !== "none") kids.push(c[i]);
    if (kids.length < 2) return;
    var rects = kids.map(function (k) { return k.getBoundingClientRect(); });
    for (i = 0; i < rects.length - 1; i++) {
      var a = rects[i], b = rects[i + 1];
      var h = document.createElement("div"); h.className = NS + "-gh";
      var cx, cy;
      if (col) {                                   // vertical gap → horizontal band
        var top = a.bottom, bot = b.top; if (bot <= top) continue;
        h.style.left = Math.min(a.left, b.left) + "px";
        h.style.width = Math.max(a.width, b.width) + "px";
        h.style.top = top + "px"; h.style.height = (bot - top) + "px";
        h.style.cursor = "row-resize";
        cx = Math.min(a.left, b.left) + Math.max(a.width, b.width) / 2; cy = (top + bot) / 2;
      } else {                                      // horizontal gap → vertical band
        var lft = a.right, rgt = b.left; if (rgt <= lft) continue;
        h.style.top = Math.min(a.top, b.top) + "px";
        h.style.height = Math.max(a.height, b.height) + "px";
        h.style.left = lft + "px"; h.style.width = (rgt - lft) + "px";
        h.style.cursor = "col-resize";
        cx = (lft + rgt) / 2; cy = Math.min(a.top, b.top) + Math.max(a.height, b.height) / 2;
      }
      h.onpointerdown = (function (isCol, hEl) {
        return function (e) { startGapDrag(e, isCol, hEl); };
      })(col, h);
      gapLayer.appendChild(h);
    }
  }
  function startGapDrag(e, col, hEl) {
    e.preventDefault(); e.stopPropagation();
    var node = selected, startG = getGap(node);
    var start = col ? e.clientY : e.clientX;
    gapDragging = true; hEl.classList.add("on");
    baseCss = node.style.cssText;
    var badge = document.createElement("div"); badge.className = NS + "-gb"; gapLayer.appendChild(badge);
    hEl.setPointerCapture(e.pointerId);
    function draw() {
      var r = hEl.getBoundingClientRect();
      badge.textContent = getGap(node);
      badge.style.left = (r.left + r.width / 2) + "px";
      badge.style.top = (r.top + r.height / 2) + "px";
    }
    draw();
    hEl.onpointermove = function (ev) {
      var d = (col ? ev.clientY : ev.clientX) - start;
      var v = Math.max(0, Math.round(startG + d));
      node.style.gap = v + "px";
      redrawFull(); if (fieldRefs.gap) fieldRefs.gap.value = v; draw();
    };
    hEl.onpointerup = function () {
      hEl.onpointermove = null; hEl.onpointerup = null; gapDragging = false;
      badge.remove(); commit(node); updateGapHandles();
    };
  }
  function syncSizeFields() {
    if (!selected) return;
    var r = selected.getBoundingClientRect();
    if (fieldRefs.width) fieldRefs.width.value = Math.round(r.width);
    if (fieldRefs.height) fieldRefs.height.value = Math.round(r.height);
  }
  function startResize(e, h, handleEl) {
    if (!selected) return;
    e.preventDefault(); e.stopPropagation();
    var node = selected, cs = getComputedStyle(node), r = node.getBoundingClientRect();
    var startX = e.clientX, startY = e.clientY, startW = r.width, startH = r.height;
    baseCss = node.style.cssText;                 // anchor for the history diff
    handleEl.setPointerCapture(e.pointerId);
    handleEl.onpointermove = function (ev) {
      var dx = ev.clientX - startX, dy = ev.clientY - startY;
      // Every edge just resizes width/height, anchored to the element's own top-left.
      // No margin shifting — that made the element slide sideways in flow/flex layouts.
      if (h.hx === 1) node.style.width = Math.max(8, startW + dx) + "px";
      else if (h.hx === -1) node.style.width = Math.max(8, startW - dx) + "px";
      if (h.hy === 1) node.style.height = Math.max(8, startH + dy) + "px";
      else if (h.hy === -1) node.style.height = Math.max(8, startH - dy) + "px";
      redrawFull(); syncSizeFields();
    };
    handleEl.onpointerup = function () { handleEl.onpointermove = null; handleEl.onpointerup = null; commit(node); };
  }

  // --- selection ---
  function selectEl(node, fromCanvas) {
    selected = node;
    // canvas overlay
    if (!node) { show(selBox, false); show(tag, false); show(insp, false); show(itab, false); gapLayer.innerHTML = ""; clearMeasure(); reflow(); }
    else {
      var r = node.getBoundingClientRect();
      place(selBox, r); show(selBox, true);
      tag.textContent = node.tagName.toLowerCase() + "  " + Math.round(r.width) + "×" + Math.round(r.height);
      tag.style.left = r.left + "px"; tag.style.top = Math.max(0, r.top - 20) + "px"; show(tag, true);
      buildInspector(node); show(insp, !uiHidden && !rightOff); show(itab, !uiHidden && rightOff);
      updateGapHandles();
      reflow();
      // expand ancestors so the row is reachable in the tree
      var p = node.parentElement;
      while (p && p !== document.body && p !== stage) { expanded.add(p); p = p.parentElement; }
    }
    renderTree();
    refreshCodeWin();
    var row = rowOf.get(node);
    if (row && fromCanvas) row.scrollIntoView({ block: "nearest" });
  }

  function peeking(e) { return e.metaKey && e.altKey; }   // Cmd+Alt held → peek-copy mode
  // measure mode: with a selection, Alt-hover another element → red distance lines
  function clearMeasure() { if (mLayer.innerHTML) mLayer.innerHTML = ""; }
  function drawMeasure(other) {
    clearMeasure();
    if (!selected || !other || other === selected) return;
    var a = selected.getBoundingClientRect(), b = other.getBoundingClientRect();
    function seg(x, y, len, horiz, txt) {
      if (len < 1) return;
      var ln = document.createElement("div"); ln.className = NS + "-mline";
      ln.style.left = x + "px"; ln.style.top = y + "px";
      if (horiz) { ln.style.width = len + "px"; ln.style.height = "1px"; }
      else { ln.style.width = "1px"; ln.style.height = len + "px"; }
      mLayer.appendChild(ln);
      var bd = document.createElement("div"); bd.className = NS + "-mbadge";
      bd.textContent = txt;
      bd.style.left = (horiz ? x + len / 2 : x + 4) + "px";
      bd.style.top = (horiz ? y - 18 : y + len / 2 - 8) + "px";
      if (horiz) bd.style.transform = "translateX(-50%)";
      mLayer.appendChild(bd);
    }
    // horizontal gap between nearest vertical edges (at the selection's vertical centre)
    var midY = Math.max(Math.min(a.top + a.height / 2, b.bottom), b.top);
    if (b.left >= a.right) seg(a.right, midY, b.left - a.right, true, Math.round(b.left - a.right) + "px");
    else if (a.left >= b.right) seg(b.right, midY, a.left - b.right, true, Math.round(a.left - b.right) + "px");
    // vertical gap between nearest horizontal edges (at the selection's horizontal centre)
    var midX = Math.max(Math.min(a.left + a.width / 2, b.right), b.left);
    if (b.top >= a.bottom) seg(midX, a.bottom, b.top - a.bottom, false, Math.round(b.top - a.bottom) + "px");
    else if (a.top >= b.bottom) seg(midX, b.bottom, a.top - b.bottom, false, Math.round(a.top - b.bottom) + "px");
  }
  function onHover(e) {
    var t = e.target;
    // peek-copy: frame elements even when the UI is hidden, as long as Cmd+Alt is held
    if (peeking(e)) {
      clearMeasure();
      if (isChrome(t)) { show(hoverBox, false); return; }
      place(hoverBox, t.getBoundingClientRect()); show(hoverBox, true);
      return;
    }
    // measure: Alt (no Cmd) + a selection → distance lines to the hovered element
    if (e.altKey && !e.metaKey && selected && !uiHidden && !editingText) {
      if (isChrome(t)) { clearMeasure(); show(hoverBox, false); return; }
      drawMeasure(t);
      place(hoverBox, t.getBoundingClientRect()); show(hoverBox, true);
      return;
    }
    clearMeasure();
    if (uiHidden || editingText) { show(hoverBox, false); return; }
    if (isChrome(t) || t === selected) { show(hoverBox, false); return; }
    place(hoverBox, t.getBoundingClientRect()); show(hoverBox, true);
  }
  function onKeyUp(e) { if (e.key === "Alt") clearMeasure(); }
  function onClick(e) {
    if (suppressClick) { suppressClick = false; e.preventDefault(); e.stopPropagation(); return; }
    // peek-copy: Cmd+Alt click copies the element's HTML (works even with the UI hidden)
    if (peeking(e)) {
      var t = e.target;
      if (isChrome(t)) return;
      e.preventDefault(); e.stopPropagation();
      var html = t.outerHTML || "";
      navigator.clipboard.writeText(html).then(
        function () { showToast("Copied <" + t.tagName.toLowerCase() + "> HTML — " + html.length + " chars", e.clientX, e.clientY); },
        function () { showToast("Copy failed", e.clientX, e.clientY); }
      );
      return;
    }
    if (uiHidden) return;   // UI hidden → clicks pass through to the page
    if (editingText && editingText.contains(e.target)) return;   // let clicks position the caret
    if (isChrome(e.target)) return;
    e.preventDefault(); e.stopPropagation();
    show(hoverBox, false);
    selectEl(e.target, true);
  }
  function onDblClick(e) {
    if (uiHidden) return;   // editor off → double-clicks belong to the page
    if (isChrome(e.target) || !isTextEl(e.target)) return;
    e.preventDefault(); e.stopPropagation();
    startTextEdit(e.target);
  }
  function startTextEdit(el) {
    if (editingText) stopTextEdit();
    editingText = el;
    if (!origText.has(el)) origText.set(el, el.textContent);
    show(hoverBox, false);
    selectEl(el, true);
    el.setAttribute("contenteditable", "true");
    el.style.cursor = "text";
    el.focus();
    // select all the text so typing replaces it
    var rng = document.createRange(); rng.selectNodeContents(el);
    var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(rng);
    el.addEventListener("blur", onEditBlur, true);
    el.addEventListener("keydown", onEditKey, true);
  }
  function stopTextEdit() {
    var el = editingText; if (!el) return;
    editingText = null;
    el.removeAttribute("contenteditable");
    el.style.cursor = "";
    el.removeEventListener("blur", onEditBlur, true);
    el.removeEventListener("keydown", onEditKey, true);
    el.blur();
    updateCount();
    if (selected === el) redraw();
  }
  function onEditBlur() { stopTextEdit(); }
  function onEditKey(e) {
    e.stopPropagation();   // keep editor shortcuts from firing while typing
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); stopTextEdit(); }
    else if (e.key === "Escape") {
      e.preventDefault();
      if (editingText && origText.has(editingText)) editingText.textContent = origText.get(editingText);
      stopTextEdit();
    }
  }
  function redraw() { if (selected) { var r = selected.getBoundingClientRect(); place(selBox, r); tag.style.left = r.left + "px"; tag.style.top = Math.max(0, r.top - 20) + "px"; updateGapHandles(); } }

  // --- drag to reorder inside a flex/grid parent ---
  function siblings(p) {
    return Array.prototype.filter.call(p.children, function (c) {
      return !isChrome(c) && getComputedStyle(c).display !== "none";
    });
  }
  function onPointerDown(e) {
    if (uiHidden) return;   // editor off → drags belong to the page
    if (e.button !== 0 || isChrome(e.target)) return;
    if (peeking(e)) return;   // peek-copy mode: don't arm a move/resize drag
    if (editingText && editingText.contains(e.target)) return;   // don't arm a drag while typing
    // climb to the element that is a direct child of a flex/grid container
    var el = e.target;
    while (el && el !== document.body && el !== stage && !(el.parentElement && containerLayout(el.parentElement))) el = el.parentElement;
    if (!el || el === document.body || el === stage) return;
    dragArm = { el: el, p: el.parentElement, x: e.clientX, y: e.clientY, startNext: el.nextElementSibling };
  }
  function onPointerMove(e) {
    if (!dragArm) return;
    if (!dragging) {
      if (Math.abs(e.clientX - dragArm.x) + Math.abs(e.clientY - dragArm.y) < 5) return;
      dragging = true;
      if (!origOrder.has(dragArm.p)) origOrder.set(dragArm.p, siblings(dragArm.p));
      selectEl(dragArm.el, true);
      dragArm.el.style.opacity = dragArm.el.style.opacity || "";
      dragArm.savedOp = dragArm.el.style.opacity;
      dragArm.el.style.opacity = "0.5";
    }
    e.preventDefault();
    var p = dragArm.p, drag = dragArm.el;
    var vertical = containerLayout(p) === "flex" && /column/.test(getComputedStyle(p).flexDirection);
    var sibs = siblings(p).filter(function (s) { return s !== drag; });
    var best = null, bestD = Infinity, insertAfter = false;
    sibs.forEach(function (s) {
      var r = s.getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var d = Math.abs(e.clientX - cx) + Math.abs(e.clientY - cy);
      if (d < bestD) { bestD = d; best = s; insertAfter = vertical ? e.clientY > cy : e.clientX > cx; }
    });
    if (best) {
      var ref = insertAfter ? best.nextElementSibling : best;
      if (ref !== drag) p.insertBefore(drag, ref);
      redrawFull();
    }
  }
  function onPointerUp() {
    if (!dragArm) return;
    var a = dragArm; dragArm = null;
    if (!dragging) return;
    dragging = false; suppressClick = true;
    a.el.style.opacity = a.savedOp || "";
    var afterNext = a.el.nextElementSibling;
    if (afterNext !== a.startNext) {
      undoStack.push({ type: "move", el: a.el, parent: a.p, undoNext: a.startNext, redoNext: afterNext });
      redoStack.length = 0;
    }
    updateCount();
  }

  // --- change-list / copy ---
  function cssPath(el) {
    if (el.id) return "#" + el.id;
    var parts = [];
    while (el && el.nodeType === 1 && el !== document.body && el !== stage) {
      var sel = el.tagName.toLowerCase();
      if (el.classList.length) sel += "." + Array.prototype.join.call(el.classList, ".");
      var parent = el.parentElement;
      if (parent) {
        var same = Array.prototype.filter.call(parent.children, function (c) { return c.tagName === el.tagName; });
        if (same.length > 1) sel += ":nth-of-type(" + (Array.prototype.indexOf.call(parent.children, el) + 1) + ")";
      }
      parts.unshift(sel);
      if (document.querySelectorAll(parts.join(" > ")).length === 1) break;
      el = parent;
    }
    return parts.join(" > ");
  }
  function parseCss(txt) {
    var o = {};
    (txt || "").split(";").forEach(function (d) {
      var i = d.indexOf(":"); if (i > 0) o[d.slice(0, i).trim()] = d.slice(i + 1).trim();
    });
    return o;
  }
  function camel(p) { return p.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); }); }
  function buildChangeList() {
    var out = [];
    origCss.forEach(function (orig, el) {
      if (!document.body.contains(el) || inserted.has(el) || htmlEdits.has(el)) return;   // inserted/html-rewritten els ship whole
      var from = parseCss(orig), to = parseCss(el.style.cssText);
      var keys = {}, changes = {};
      Object.keys(from).forEach(function (k) { keys[k] = 1; });
      Object.keys(to).forEach(function (k) { keys[k] = 1; });
      Object.keys(keys).forEach(function (k) {
        var f = from[k] || "", t = to[k] || "";
        if (f !== t) changes[camel(k)] = [f, t];
      });
      if (!Object.keys(changes).length) return;
      // record the stage width (NOT window.innerWidth — the docked/breakpoint stage is
      // what the user was looking at) so Claude can rebuild responsive values (clamp/vw).
      var entry = { selector: cssPath(el), tag: el.tagName.toLowerCase(), op: "style", changes: changes, viewportPx: stage ? stage.clientWidth : window.innerWidth, el: el };
      var txt = (el.textContent || "").trim().replace(/\s+/g, " ");
      if (txt && txt.length <= 40) entry.text = txt;
      out.push(entry);
    });
    // text edits: any element whose textContent changed via double-click editing
    origText.forEach(function (orig, el) {
      if (!document.body.contains(el) || el === editingText || inserted.has(el) || htmlEdits.has(el)) return;
      var now = el.textContent;
      if (now !== orig) {
        out.push({
          selector: cssPath(el), tag: el.tagName.toLowerCase(),
          op: "text", textChange: [orig.trim().replace(/\s+/g, " "), now.trim().replace(/\s+/g, " ")], el: el
        });
      }
    });
    // reorders: any element whose index among its siblings changed from the original
    origOrder.forEach(function (orig, p) {
      if (!document.body.contains(p)) return;
      var now = siblings(p);
      now.forEach(function (el, i) {
        if (orig.indexOf(el) !== i && orig.indexOf(el) !== -1) {
          out.push({ selector: cssPath(el), tag: el.tagName.toLowerCase(), op: "reorder", reorder: i, reorderFrom: orig.indexOf(el), el: el });
        }
      });
    });
    // duplicated elements: ship the whole clone as an insert-after-anchor
    inserted.forEach(function (info, el) {
      if (!document.body.contains(el)) return;
      out.push({
        selector: cssPath(el), tag: el.tagName.toLowerCase(), op: "insert",
        insert: { anchor: info.anchor, position: "after", html: el.outerHTML }, el: el
      });
    });
    // deleted elements
    deleted.forEach(function (rec) {
      if (document.body.contains(rec.el)) return;   // restored via undo
      var entry = { selector: rec.selector, tag: rec.tag, op: "delete", el: rec.el };
      if (rec.text) entry.text = rec.text;
      out.push(entry);
    });
    // raw HTML rewrites from the floating code window (ship the whole new markup)
    htmlEdits.forEach(function (rec, el) {
      if (!document.body.contains(el)) return;
      out.push({ selector: rec.selector, tag: el.tagName.toLowerCase(), op: "html", html: el.outerHTML, el: el });
    });
    return out;
  }
  // one-line human description of a change-list entry (changes panel + payload)
  function humanize(en) {
    var who = en.selector.split(" > ").pop();
    if (en.op === "text") return who + " text: “" + en.textChange[1].slice(0, 40) + "”";
    if (en.op === "reorder") return who + " moved " + ((en.reorderFrom + 1) || "?") + " → " + (en.reorder + 1);
    if (en.op === "insert") return who + " duplicated (insert after " + en.insert.anchor.split(" > ").pop() + ")";
    if (en.op === "delete") return who + " deleted";
    if (en.op === "html") return who + " HTML rewritten";
    var parts = Object.keys(en.changes).map(function (k) { return k + " " + (en.changes[k][0] || "∅") + " → " + (en.changes[k][1] || "∅"); });
    var s = parts.slice(0, 3).join(", ");
    if (parts.length > 3) s += " +" + (parts.length - 3) + " more";
    return who + ": " + s;
  }
  function onCopy() {
    var list = buildChangeList();
    if (!list.length) { flashBtn("Nothing to copy"); return; }
    var vw = stage ? stage.clientWidth : window.innerWidth;
    var summary = list.map(function (en) { return "- " + humanize(en); }).join("\n");
    var payload = "Visual edits (" + list.length + " change" + (list.length > 1 ? "s" : "") + ") — apply to source.\n" +
      summary + "\n\n" +
      "Values are px measured at viewport width " + vw + "px (the edit stage). If the source uses a responsive value " +
      "(clamp/vw/%/min/max), preserve that idiom — recompute it to hit the new px at this width, don't flatten to a fixed px.\n\n" +
      "```json\n" + JSON.stringify(list, function (k, v) { return k === "el" ? undefined : v; }, 2) + "\n```";
    navigator.clipboard.writeText(payload).then(function () { flashBtn("Copied ✓"); }, function () { flashBtn("Copy failed"); });
  }
  var flashT = null;
  function updateCount() {
    var n = buildChangeList().length;
    if (!flashT) copyBtn.textContent = "Copy" + (n ? " (" + n + ")" : "");
    chip.textContent = n + (n === 1 ? " change" : " changes");
    undoBtn.disabled = !undoStack.length;
    redoBtn.disabled = !redoStack.length;
    if (changesOpen) renderChanges();
  }
  function flashBtn(msg) {
    copyBtn.textContent = msg;
    if (flashT) clearTimeout(flashT);
    flashT = setTimeout(function () { flashT = null; updateCount(); }, 1400);
  }
  copyBtn.onclick = onCopy;

  var uiHidden = true;   // default: panels collapsed — reveal with Cmd+Ctrl
  function togglePanels() {
    uiHidden = !uiHidden;
    show(panel, !uiHidden && !leftOff);
    show(ptab, !uiHidden && leftOff);
    show(insp, !uiHidden && !rightOff && !!selected);
    show(itab, !uiHidden && rightOff && !!selected);
    show(tbar, !uiHidden);
    show(codeWin, cwOpen && !uiHidden);
    if (uiHidden) { toggleChanges(false); keysToggle(false); clearMeasure(); }
    // selection chrome only lives while the panels do
    show(selBox, !uiHidden && !!selected);
    show(tag, !uiHidden && !!selected);
    show(hoverBox, false);
    if (uiHidden) gapLayer.innerHTML = ""; else updateGapHandles();
    reflow();
  }
  // select a relative of the current selection (Enter/Tab navigation)
  function selectRel(node) { if (node && node !== stage && node !== document.body && !isChrome(node)) selectEl(node, true); }
  function onKey(e) {
    // the Cmd+Ctrl chord works everywhere, even while typing
    if ((e.key === "Meta" || e.key === "Control") && e.metaKey && e.ctrlKey && !e.altKey && !e.shiftKey && !e.repeat) {
      e.preventDefault();
      togglePanels();
      return;
    }
    if (e.key === "Escape") {
      // close the topmost thing first: cheatsheet → changes popover → text edit → selection
      if (keysOpen) { keysToggle(false); return; }
      if (changesOpen) { toggleChanges(false); return; }
      if (isTyping(e)) return;   // in-place text edit has its own Esc handler
      if (selected && !uiHidden) { selectEl(null); return; }
      return;
    }
    if (isTyping(e)) return;
    if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z")) {
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && (e.key === "d" || e.key === "D")) {
      if (uiHidden || !selected) return;
      e.preventDefault();
      duplicateSel();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "S")) {
      e.preventDefault();   // always eat it, or the browser save dialog opens
      if (!uiHidden) onCopy();
      return;
    }
    if (uiHidden) return;
    if (e.key === "?") { e.preventDefault(); keysToggle(); return; }
    if (e.key === "c" || e.key === "C") { e.preventDefault(); toggleCodeWin(); return; }
    if (!selected) return;
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSel(); return; }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      var step = e.shiftKey ? 10 : 1;
      nudge(e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0,
            e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) selectRel(selected.parentElement);
      else selectRel(kids(selected)[0]);
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      var sibs = selected.parentElement ? kids(selected.parentElement) : [];
      var i = sibs.indexOf(selected);
      if (i > -1 && sibs.length > 1) selectRel(sibs[(i + (e.shiftKey ? -1 : 1) + sibs.length) % sibs.length]);
      return;
    }
  }

  document.addEventListener("mousemove", onHover, true);
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("pointermove", onPointerMove, true);
  document.addEventListener("pointerup", onPointerUp, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("dblclick", onDblClick, true);
  document.addEventListener("keydown", onKey, true);
  document.addEventListener("keyup", onKeyUp, true);
  window.addEventListener("scroll", redraw, true);
  // margins/width are computed in px, so a real window resize must re-run reflow
  function onResize() { reflow(); redraw(); }
  window.addEventListener("resize", onResize, true);

  // Wrap the page content in the stage so it can be docked beside the panels.
  // Our own chrome (ve2-*) stays a direct child of <body> — outside the stage —
  // so it keeps positioning against the viewport, not the pushed-in stage box.
  stage = document.createElement("div");
  stage.className = NS + "-stage";
  Array.prototype.slice.call(document.body.childNodes).forEach(function (n) {
    if (n === stage) return;
    if (n.nodeType === 1 && ("" + n.className).indexOf(NS + "-") === 0) return; // chrome stays out
    stage.appendChild(n);
  });
  document.body.appendChild(stage);

  // The stage's `transform` turns it into the containing block for every
  // position:fixed descendant — on a page whose visuals ARE fixed layers (a
  // full-viewport canvas, fixed overlays), that re-anchors them to a
  // document-tall box and they scroll away offscreen: the page looks blank the
  // moment the editor boots. Detect that case and drop the transform; flow
  // content still docks via the margins, fixed layers keep the real viewport.
  var hasFixed = Array.prototype.some.call(stage.querySelectorAll("*"), function (n) {
    return getComputedStyle(n).position === "fixed";
  });
  if (hasFixed) stage.style.transform = "none";

  show(panel, false);   // default collapsed (uiHidden=true) — panel hidden until Cmd+Ctrl
  reflow();

  // seed: expand the first level
  kids(stage).forEach(function (n) { expanded.add(n); });
  renderTree();

  window.__ve2 = {
    destroy: function () {
      document.removeEventListener("mousemove", onHover, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("dblclick", onDblClick, true);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("scroll", redraw, true);
      window.removeEventListener("resize", onResize, true);
      // unwrap the stage: move the page content back onto <body>, then drop the wrapper
      if (stage) {
        while (stage.firstChild) document.body.insertBefore(stage.firstChild, stage);
        stage.remove();
      }
      [style, hoverBox, selBox, tag, gapLayer, toast, panel, ptab, insp,
        tbar, chpanel, keysOv, mLayer, codeWin, itab, lStrip, rStrip].forEach(function (el) { el.remove(); });
      arm();   // back to the inert armed state — Cmd+Ctrl boots it again
    }
  };
  togglePanels();   // booted via the chord → come up ON, panels visible
  console.log("visual-edit v2: editor on");
  }

  // --- armed-state peek (no boot required) ---
  // While ARMED (script loaded, panels never turned on), holding Cmd alone
  // frames whatever element is under the cursor — a quick "what is this" peek
  // without turning the editor on. Stays fully inert until Cmd goes down: no
  // hoverBox in the DOM, no mousemove listener, until then. Adding Ctrl (the
  // chord) boots the editor, which tears this down via disarm().
  var peekBox = null, peekStyle = null, peekOn = false;
  var peekWin = null;
  function isPeekChrome(t) { return !!(t && t.closest && t.closest(".ve2-armhover,.ve2-peekwin")); }
  function armPeekMove(e) {
    if (!peekBox) return;
    var t = document.elementFromPoint(e.clientX, e.clientY);
    if (!t || isPeekChrome(t)) { peekBox.style.display = "none"; return; }
    var r = t.getBoundingClientRect();
    peekBox.style.left = r.left + "px"; peekBox.style.top = r.top + "px";
    peekBox.style.width = r.width + "px"; peekBox.style.height = r.height + "px";
    peekBox.style.display = "block";
  }
  // The element's actually-applied styling: getComputedStyle, filtered to a
  // curated set of meaningful properties (the full dump is ~350 props of
  // noise). Read-only — this is the resolved result, not the source rules.
  var ARM_CSS_PROPS = [
    "display", "position", "top", "right", "bottom", "left", "z-index", "float",
    "flex-direction", "flex-wrap", "justify-content", "align-items", "flex", "gap",
    "grid-template-columns", "grid-template-rows",
    "width", "height", "min-width", "max-width", "margin", "padding", "box-sizing", "overflow",
    "color", "background-color", "background-image", "opacity",
    "font-family", "font-size", "font-weight", "line-height", "letter-spacing",
    "text-align", "text-transform", "text-decoration-line", "white-space",
    "border-width", "border-style", "border-color", "border-radius", "box-shadow",
    "transform", "transition", "cursor"
  ];
  // computed values that mean "not set / default" — hidden to cut noise
  var ARM_CSS_SKIP = { "none": 1, "normal": 1, "auto": 1, "0px": 1, "visible": 1, "rgba(0, 0, 0, 0)": 1, "0": 1 };
  // text/font props are inherited, so getComputedStyle reports them even on a
  // wrapper with no text — only show them when the element has its own text.
  var ARM_CSS_TEXT = { "color": 1, "font-family": 1, "font-size": 1, "font-weight": 1, "line-height": 1, "letter-spacing": 1, "text-align": 1, "text-transform": 1, "text-decoration-line": 1, "white-space": 1 };
  function hasOwnText(el) {
    for (var n = el.firstChild; n; n = n.nextSibling) { if (n.nodeType === 3 && n.nodeValue.trim()) return true; }
    return false;
  }
  function armComputedCss(el) {
    var cs = getComputedStyle(el);
    var out = [];
    var textish = hasOwnText(el);
    ARM_CSS_PROPS.forEach(function (p) {
      if (ARM_CSS_TEXT[p] && !textish) return;   // inherited font/text noise on textless elements
      var v = cs.getPropertyValue(p);
      if (v && !ARM_CSS_SKIP[v]) out.push("  " + p + ": " + v + ";");
    });
    var cls = el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : el.tagName.toLowerCase();
    return out.length ? cls + " {\n" + out.join("\n") + "\n}" : "/* nothing notable computed */";
  }
  function armPeekWin(el) {
    if (!peekWin) {
      peekWin = document.createElement("div");
      peekWin.className = "ve2-peekwin";
      peekWin.style.cssText = "position:fixed;top:16px;right:16px;width:460px;max-height:calc(100vh - 32px);z-index:2147483646;background:#1e1e1e;color:#e6e6e6;border:1px solid #3a3a3a;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.5);font:12px/1.5 ui-sans-serif,system-ui,sans-serif;display:flex;flex-direction:column;overflow:hidden";
      document.body.appendChild(peekWin);
    }
    var tag = el.tagName.toLowerCase();
    var cls = el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : "";
    var esc = function (s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); };
    var taSt = "width:100%;box-sizing:border-box;margin:0;padding:8px;background:#141414;border:1px solid #2c2c2c;border-radius:5px;resize:none;overflow:hidden;font:11px/1.5 ui-monospace,monospace;color:#e6e6e6;outline:none";
    var btnSt = "background:#2a2a2a;border:1px solid #3a3a3a;border-radius:4px;color:#c8c8c8;font-size:10px;padding:2px 7px;cursor:pointer";
    peekWin.innerHTML =
      "<div class='ve2-pw-bar' style='flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:8px 10px;background:#252525;border-bottom:1px solid #333;cursor:move'>" +
        "<span class='ve2-pw-title' style='flex:1 1 auto;font:11px/1.4 ui-monospace,monospace;color:#6ea8ff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'>" + esc(tag + cls) + "</span>" +
        "<button class='ve2-pw-x' style='flex:0 0 auto;width:22px;height:22px;padding:0;background:#2a2a2a;border:1px solid #3a3a3a;border-radius:5px;color:#c8c8c8;font-size:14px;cursor:pointer'>✕</button>" +
      "</div>" +
      "<div style='flex:1 1 auto;overflow:auto;padding:10px'>" +
        "<div style='display:flex;align-items:center;justify-content:space-between;margin:0 0 4px'><span style='font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#8a8a8a'>HTML</span><button class='ve2-pw-ch' style='" + btnSt + "'>Copy</button></div>" +
        "<textarea class='ve2-pw-html' spellcheck='false' style='" + taSt + ";margin-bottom:14px'>" + esc(el.outerHTML || "") + "</textarea>" +
        "<div style='display:flex;align-items:center;justify-content:space-between;margin:0 0 4px'><span style='font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#8a8a8a'>CSS · computed</span><button class='ve2-pw-cc' style='" + btnSt + "'>Copy</button></div>" +
        "<div class='ve2-pw-swatches' style='display:flex;flex-wrap:wrap;gap:10px;margin:0 0 8px'></div>" +
        "<textarea class='ve2-pw-css' spellcheck='false' style='" + taSt + "'>" + esc(armComputedCss(el)) + "</textarea>" +
      "</div>";
    peekWin.style.display = "flex";
    var htmlTa = peekWin.querySelector(".ve2-pw-html");
    var cssTa = peekWin.querySelector(".ve2-pw-css");
    var title = peekWin.querySelector(".ve2-pw-title");
    var origInline = el.style.cssText;   // reset anchor so removing a line reverts it
    // grow each textarea to fit its content so nothing has to be scrolled/resized
    var fit = function (ta) { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + 2 + "px"; };
    fit(htmlTa); fit(cssTa);
    peekWin.querySelector(".ve2-pw-x").onclick = function () { peekWin.style.display = "none"; };
    var cp = function (txt, btn) { try { navigator.clipboard.writeText(txt); btn.textContent = "Copied"; setTimeout(function () { btn.textContent = "Copy"; }, 1000); } catch (e) { } };
    peekWin.querySelector(".ve2-pw-ch").onclick = function () { cp(htmlTa.value, this); };
    peekWin.querySelector(".ve2-pw-cc").onclick = function () { cp(cssTa.value, this); };
    // Live CSS: on every keystroke, reset to the element's original inline style
    // then apply the declarations inside the { } as inline overrides. Resetting
    // first means deleting a line un-applies it — and native textarea undo/redo
    // (Cmd+Z / Cmd+Shift+Z) fires input, so the page follows the reverted text.
    function liveCss() {
      var txt = cssTa.value, a = txt.indexOf("{"), b = txt.lastIndexOf("}");
      var decls = (a >= 0 && b > a) ? txt.slice(a + 1, b) : txt;
      var test = document.createElement("div");
      test.style.cssText = decls;
      if (!test.style.length && decls.replace(/[\s;]/g, "")) { cssTa.style.borderColor = "#c0392b"; return; }
      el.style.cssText = origInline;
      for (var i = 0; i < test.style.length; i++) { var p = test.style[i]; el.style.setProperty(p, test.style.getPropertyValue(p), test.style.getPropertyPriority(p)); }
      cssTa.style.borderColor = "#2c2c2c";
    }
    // Live HTML: on every keystroke, if the markup parses to exactly one root,
    // swap it in place. We DON'T rebuild the window (that would steal focus mid-
    // type) — we just re-point `el` at the new node and refresh the title. While
    // the markup is mid-edit (0 or 2+ roots) we leave the page as-is.
    function liveHtml() {
      var tmp = document.createElement("div");
      tmp.innerHTML = htmlTa.value.trim();
      if (tmp.children.length !== 1) { htmlTa.style.borderColor = "#c0392b"; return; }
      htmlTa.style.borderColor = "#2c2c2c";
      var nu = tmp.children[0];
      el.replaceWith(nu);
      el = nu;
      origInline = el.style.cssText;
      var c = el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : "";
      title.textContent = el.tagName.toLowerCase() + c;
    }
    htmlTa.addEventListener("input", function () { fit(htmlTa); liveHtml(); });
    cssTa.addEventListener("input", function () { fit(cssTa); liveCss(); });
    // Set (or insert) one property inside the CSS block, then apply via liveCss —
    // keeps the textarea the single source of truth so undo/redo still works.
    function setCssProp(prop, val) {
      var txt = cssTa.value, a = txt.indexOf("{"), b = txt.lastIndexOf("}");
      var head = a >= 0 ? txt.slice(0, a + 1) : "{", body = (a >= 0 && b > a) ? txt.slice(a + 1, b) : "", tail = b > a ? txt.slice(b) : "\n}";
      var re = new RegExp("(?:^|\\n)\\s*" + prop + "\\s*:[^;]*;?");
      var decl = "\n  " + prop + ": " + val + ";";
      body = re.test(body) ? body.replace(re, decl) : body.replace(/\s*$/, "") + decl + "\n";
      cssTa.value = head + body + tail;
      fit(cssTa); liveCss();
    }
    // color-picker swatches for the color-type properties present on the element
    function rgbToHex(v) {
      var m = ("" + v).match(/rgba?\(([^)]+)\)/); if (!m) return "#000000";
      var p = m[1].split(",").map(function (x) { return parseFloat(x); });
      return "#" + p.slice(0, 3).map(function (n) { return ("0" + Math.round(n).toString(16)).slice(-2); }).join("");
    }
    (function buildSwatches() {
      var wrap = peekWin.querySelector(".ve2-pw-swatches");
      var cs = getComputedStyle(el);
      [["color", "text"], ["background-color", "bg"], ["border-color", "border"]].forEach(function (pair) {
        var prop = pair[0], v = cs.getPropertyValue(prop);
        if (!v || ARM_CSS_SKIP[v]) return;   // skip transparent / unset
        if (prop === "color" && !hasOwnText(el)) return;
        var cell = document.createElement("label");
        cell.style.cssText = "display:inline-flex;align-items:center;gap:5px;font:10px/1 ui-monospace,monospace;color:#a8a8a8;cursor:pointer";
        var inp = document.createElement("input");
        inp.type = "color"; inp.value = rgbToHex(v);
        inp.style.cssText = "width:22px;height:22px;padding:0;border:1px solid #3a3a3a;border-radius:4px;background:none;cursor:pointer";
        inp.addEventListener("input", function () { setCssProp(prop, inp.value); });
        cell.appendChild(inp);
        cell.appendChild(document.createTextNode(pair[1]));
        wrap.appendChild(cell);
      });
    })();
    // drag by the titlebar
    peekWin.querySelector(".ve2-pw-bar").onmousedown = function (e) {
      if (e.target.className === "ve2-pw-x") return;
      var r = peekWin.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
      peekWin.style.right = "auto";
      function mv(ev) {
        peekWin.style.left = Math.max(0, Math.min(window.innerWidth - 60, ev.clientX - ox)) + "px";
        peekWin.style.top = Math.max(0, Math.min(window.innerHeight - 30, ev.clientY - oy)) + "px";
      }
      function up() { document.removeEventListener("mousemove", mv, true); document.removeEventListener("mouseup", up, true); }
      document.addEventListener("mousemove", mv, true); document.addEventListener("mouseup", up, true);
      e.preventDefault();
    };
  }
  // pre-boot toast (the editor's own showToast doesn't exist until it boots)
  function armToast(msg, x, y) {
    var d = document.createElement("div");
    d.className = "ve2-armtoast";
    d.textContent = msg;
    d.style.cssText = "position:fixed;z-index:2147483646;left:" + Math.max(8, x - 60) + "px;top:" + Math.max(8, y - 34) +
      "px;background:#1e1e1e;color:#e6e6e6;font:11px/1.5 ui-monospace,monospace;padding:4px 8px;border-radius:4px;pointer-events:none";
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 1600);
  }
  function armPeekClick(e) {
    if (!peekOn || !e.metaKey) return;           // only while Cmd-peeking
    var t = document.elementFromPoint(e.clientX, e.clientY);
    if (!t || isPeekChrome(t)) return;           // clicks inside our own chrome pass through
    e.preventDefault(); e.stopPropagation();     // don't navigate/activate the page
    // Cmd+Alt+click → copy outerHTML, same as the editor's peek-copy, but with
    // no editor booted (which is what makes it safe on pages the stage wrap
    // would disturb).
    if (e.altKey) {
      var html = t.outerHTML || "";
      navigator.clipboard.writeText(html).then(
        function () { armToast("Copied <" + t.tagName.toLowerCase() + "> HTML — " + html.length + " chars", e.clientX, e.clientY); },
        function () { armToast("Copy failed", e.clientX, e.clientY); }
      );
      return;
    }
    armPeekWin(t);
  }
  function startPeek() {
    if (peekOn) return;
    peekOn = true;
    if (!peekStyle) {
      peekStyle = document.createElement("style");
      peekStyle.textContent = ".ve2-armhover{position:fixed;pointer-events:none;z-index:2147483640;border:1px solid #6ea8ff;box-sizing:border-box;display:none}";
      document.documentElement.appendChild(peekStyle);
      peekBox = document.createElement("div");
      peekBox.className = "ve2-armhover";
      document.body.appendChild(peekBox);
    }
    document.addEventListener("mousemove", armPeekMove, true);
  }
  function stopPeek() {
    if (!peekOn) return;
    peekOn = false;
    document.removeEventListener("mousemove", armPeekMove, true);
    if (peekBox) peekBox.style.display = "none";
  }
  function armPeekDown(e) {
    // Cmd alone (no other modifiers) → peek. Cmd+Ctrl is the boot chord (armChord).
    // Alt allowed: Cmd+Alt is the peek-COPY variant (same as inside the editor).
    if (e.metaKey && !e.ctrlKey && !e.shiftKey) startPeek();
    else stopPeek();
  }
  function armPeekUp(e) { if (!e.metaKey) stopPeek(); }

  function armChord(e) {
    if ((e.key === "Meta" || e.key === "Control") && e.metaKey && e.ctrlKey && !e.altKey && !e.shiftKey && !e.repeat) {
      e.preventDefault();
      disarm();
      bootEditor();
    }
  }
  function disarm() {
    document.removeEventListener("keydown", armChord, true);
    document.removeEventListener("keydown", armPeekDown, true);
    document.removeEventListener("keyup", armPeekUp, true);
    document.removeEventListener("click", armPeekClick, true);
    window.removeEventListener("blur", stopPeek, true);
    stopPeek();
    if (peekBox) { peekBox.remove(); peekBox = null; }
    if (peekStyle) { peekStyle.remove(); peekStyle = null; }
    if (peekWin) { peekWin.remove(); peekWin = null; }
  }
  function arm() {
    document.addEventListener("keydown", armChord, true);
    document.addEventListener("keydown", armPeekDown, true);
    document.addEventListener("keyup", armPeekUp, true);
    document.addEventListener("click", armPeekClick, true);
    window.addEventListener("blur", stopPeek, true);
    window.__ve2 = {
      armed: true,
      destroy: function () { disarm(); window.__ve2 = null; }
    };
  }
  arm();
  console.log("visual-edit v2: armed (off) — Cmd+Ctrl to turn on · Cmd+click to inspect · Cmd+Alt+click to copy HTML");
})();
