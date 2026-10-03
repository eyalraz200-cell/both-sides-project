// The language switch — one button (globe + the current language's letters)
// in the top-left corner that opens a menu of the three languages. Markup is
// static in each page's HTML (#langWrap / #langSwitch / #langMenu); this only
// opens, closes and dismisses it.
//
// The menu is a drop-down inside the button's own card (the legend note's
// look) — compare/ pick 2026-10-03 over an outlined box / a bare glyph and a
// darkened-page dialog.
(function () {
  const wrap = document.getElementById("langWrap");
  const btn = document.getElementById("langSwitch");
  const menu = document.getElementById("langMenu");
  if (!wrap || !btn || !menu) return;

  function isOpen() { return wrap.classList.contains("is-open"); }
  function setOpen(on) {
    wrap.classList.toggle("is-open", on);
    // The card animates open/closed in CSS (grid rows), so `hidden` would cut
    // the transition — aria-hidden carries the state instead.
    menu.hidden = false;
    menu.setAttribute("aria-hidden", on ? "false" : "true");
    btn.setAttribute("aria-expanded", on ? "true" : "false");
    if (on) {
      // The current language's row is not selectable (pointer-events: none,
      // style.css), so focus lands on the first OTHER language.
      const first = menu.querySelector(".lang-menu-row:not(.is-current)") || menu.querySelector(".lang-menu-row");
      first?.focus({ preventScroll: true });
    }
  }

  btn.addEventListener("click", (e) => { e.stopPropagation(); setOpen(!isOpen()); });
  // Click outside closes; so does Escape.
  document.addEventListener("click", (e) => {
    if (isOpen() && !wrap.contains(e.target)) setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) { setOpen(false); btn.focus(); }
  });
})();
