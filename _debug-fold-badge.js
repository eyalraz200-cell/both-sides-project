// Dev scaffolding — shows the canonical @foldN numbering on screen.
// @foldN is 1-indexed by on-screen order; id="page-(N-1)". Delete with its
// <script> tag in project.html when no longer needed.
(function () {
  const NAMES = {
    1: "hero / dot columns",
    2: "dots → camp grids",
    3: "filler rects shrink",
    4: "groups → mini-legend",
    5: "8 grey squares",
    6: "ACLED card",
    7: "labels + tooltip",
    8: "colors + fly to timeline",
    9: "real pinned timeline",
    10: "bridge glide",
    11: "drag & drop",
    12: "outro",
  };

  const el = document.createElement("div");
  el.id = "debug-fold-badge";
  el.style.cssText = [
    "position:fixed", "left:12px", "bottom:12px", "z-index:99999",
    "font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace",
    "background:rgba(20,20,20,.85)", "color:#fff", "padding:6px 10px",
    "border-radius:6px", "pointer-events:auto", "cursor:pointer",
    "direction:ltr", "text-align:left", "user-select:none",
    "box-shadow:0 2px 8px rgba(0,0,0,.3)",
  ].join(";");
  document.body.appendChild(el);

  let hidden = false;
  const render = (n, id) => {
    el.textContent = hidden ? `@fold${n}` : `@fold${n}  ·  #${id}  ·  ${NAMES[n] || ""}`;
  };
  el.addEventListener("click", () => { hidden = !hidden; render(cur, `page-${cur - 1}`); });
  addEventListener("keydown", e => {
    if (e.key === "b" || e.key === "B") { hidden = !hidden; render(cur, `page-${cur - 1}`); }
  });

  let cur = 1;
  const sections = Array.from(document.querySelectorAll(".text-section"));
  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      cur = Number(entry.target.dataset.page) + 1;
      render(cur, entry.target.id);
    });
  }, { rootMargin: "-50% 0px -50% 0px", threshold: 0 });
  sections.forEach(s => obs.observe(s));
  render(1, "page-0");
})();
