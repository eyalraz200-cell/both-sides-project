// The language switch — one button (globe + the current language's letters)
// in the top-left corner that opens a menu of the three languages. Markup is
// static in each page's HTML (#langWrap / #langSwitch / #langMenu); this only
// opens, closes and dismisses it.
//
// The menu is a drop-down inside the button's own card (the legend note's
// look) — compare/ pick 2026-10-03 over an outlined box / a bare glyph and a
// darkened-page dialog.
//
// Semantically it is a DISCLOSURE, not an ARIA menu: a button with
// aria-expanded + aria-controls, and a plain list of links (the current
// language's link carries aria-current="page"). So Tab/Shift+Tab move through
// it like any links, and focus leaving the switch closes it.
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
  // Focus leaving the switch (Tab past the last row, Shift+Tab before the
  // button) closes it. Checked a tick later, once focus has landed; a window
  // blur (switching apps) leaves document.hasFocus() false and the menu as is.
  // A press INSIDE the card (its padding, the inert current row) also blurs the
  // focused row onto <body> — that one is the pointer's, and the click handler
  // above already decides it, so it's ignored here and mouse behaviour is as before.
  let pressedInsideAt = -1;
  wrap.addEventListener("pointerdown", () => { pressedInsideAt = performance.now(); });
  wrap.addEventListener("focusout", () => {
    if (performance.now() - pressedInsideAt < 500) return;
    setTimeout(() => {
      if (isOpen() && document.hasFocus() && !wrap.contains(document.activeElement)) setOpen(false);
    }, 0);
  });
  // Click outside closes; so does Escape.
  document.addEventListener("click", (e) => {
    if (isOpen() && !wrap.contains(e.target)) setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) { setOpen(false); btn.focus(); }
  });
})();
