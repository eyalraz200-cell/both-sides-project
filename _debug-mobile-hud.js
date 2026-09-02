// _debug-mobile-hud.js — TEMPORARY diagnostic overlay (never ships).
// Prints the live internal state that headless Chrome can't reproduce
// (visual-viewport vs 100vh, glide clock, active page) so a phone
// screenshot carries the evidence. No scrolling, no layout impact.
(function () {
  const hud = document.createElement("div");
  hud.style.cssText =
    "position:fixed;top:4px;left:4px;z-index:2147483647;" +
    "background:rgba(0,0,0,.72);color:#0f0;font:11px/1.45 monospace;" +
    "padding:6px 8px;border-radius:6px;pointer-events:none;" +
    "white-space:pre;direction:ltr;text-align:left;";
  document.body.appendChild(hud);

  // Measures what CSS 100vh resolves to, independent of innerHeight.
  const vhProbe = document.createElement("div");
  vhProbe.style.cssText =
    "position:fixed;top:0;left:0;width:0;height:100vh;visibility:hidden;pointer-events:none;";
  document.body.appendChild(vhProbe);

  // Top-level `let`/`const` in classic scripts are NOT window properties —
  // resolve them as real identifiers instead.
  function g(name) {
    try {
      const v = new Function("return " + name)();
      if (typeof v === "function") return v();
      return v;
    } catch (e) { return "ERR"; }
  }
  const f2 = (v) => (typeof v === "number" ? v.toFixed(2) : String(v));

  function tick() {
    const vv = window.visualViewport;
    const cardEl = document.querySelector("#page-9 .text-card");
    hud.textContent =
      "scrollY " + Math.round(scrollY) +
      "  innerH " + innerHeight +
      "\n100vh " + Math.round(vhProbe.getBoundingClientRect().height) +
      "  visualVp " + (vv ? Math.round(vv.height) : "?") +
      "\ncanvas cssH " + canvas.clientHeight +
      "  backing " + canvas.height +
      "  dpr " + (window.devicePixelRatio || 1) +
      "\npage " + g("currentPage") +
      "  p8Engaged " + g("p8Engaged") +
      "  p8T " + f2(g("p8CurrentT")) +
      "\ntitleWasPast " + (typeof page8TitleWasPast !== "undefined" ? page8TitleWasPast : "?") +
      "  p7Reached " + g("p7RealTimelineReached") +
      "\nf10 stuck " + (cardEl ? cardEl.classList.contains("is-stuck") : "?") +
      "  p7EntryAnim " + (typeof p7EntryAnim !== "undefined" && p7EntryAnim ? "on" : "off");
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
