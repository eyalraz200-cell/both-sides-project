// _debug-glide-perf.js — TEMPORARY instrumentation, never ships.
// Measures where frame time goes during @fold9's bridge glide (p8CurrentT
// mid-flight) so the "dots stutter while scrolling" report can be attributed
// instead of guessed at. Wraps the per-scroll-tick handlers + updateGroups +
// draw with self-time accounting, samples rAF frame deltas for the whole
// glide, and dumps a summary to the console (and clipboard) when the glide
// ends. Reproduce: scroll into fold 9, KEEP SCROLLING during the flight, then
// read/paste the console block.
(() => {
  "use strict";

  const acc = {};   // fnName -> total ms while glide active
  const calls = {}; // fnName -> call count while glide active
  let frames = [];  // rAF deltas while glide active
  let active = false;

  function wrap(name) {
    const fn = window[name];
    if (typeof fn !== "function") { console.warn("[glide-perf] missing", name); return; }
    acc[name] = 0; calls[name] = 0;
    window[name] = function (...args) {
      if (!active) return fn.apply(this, args);
      const t0 = performance.now();
      try { return fn.apply(this, args); }
      finally { acc[name] += performance.now() - t0; calls[name]++; }
    };
  }

  // The per-frame / per-scroll-tick suspects.
  ["draw", "updateGroups", "checkGroupTriggers", "page9UpdateFromScroll",
   "updateFold13", "page8CheckScroll", "page7UpdateFromScroll",
   "drawPage8", "drawPage9"].forEach(wrap);

  function report() {
    const total = frames.reduce((a, b) => a + b, 0);
    const long = frames.filter(d => d > 20);
    const rows = Object.keys(acc)
      .filter(k => calls[k] > 0)
      .map(k => ({ fn: k, ms: +acc[k].toFixed(1), calls: calls[k] }))
      .sort((a, b) => b.ms - a.ms);
    const summary = {
      glideMs: +total.toFixed(0),
      frames: frames.length,
      droppedOver20ms: long.length,
      worstFrameMs: +Math.max(...frames, 0).toFixed(1),
    };
    console.log("[glide-perf] ================================");
    console.log("[glide-perf]", JSON.stringify(summary));
    console.table(rows);
    const text = "glide-perf " + JSON.stringify(summary) + "\n" +
      rows.map(r => `${r.fn}: ${r.ms}ms over ${r.calls} calls`).join("\n");
    navigator.clipboard?.writeText(text).then(
      () => console.log("[glide-perf] summary copied to clipboard — paste it into chat"),
      () => {});
  }

  let last = null;
  function tick() {
    const gliding = typeof p8PhaseStart !== "undefined" && p8PhaseStart !== null;
    if (gliding && !active) {          // glide started — reset and arm
      active = true; frames = []; last = null;
      Object.keys(acc).forEach(k => { acc[k] = 0; calls[k] = 0; });
      console.log("[glide-perf] glide started, recording…");
    } else if (!gliding && active) {   // glide ended — report
      active = false; report();
    }
    if (active) {
      const now = performance.now();
      if (last !== null) frames.push(now - last);
      last = now;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
