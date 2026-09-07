Promise.all([
  document.fonts.load("400 24px 'HadassahFriedlaender'"),
  document.fonts.load("100 16px 'HadassahFriedlaender'"),
  document.fonts.load("400 16px 'Assistant'"),
  document.fonts.load("700 16px 'Assistant'"),
]).then(() => {
  initPage7().then(() => { draw(); });
  init();
  checkGroupTriggers();
  layoutGroups();
  // Only NOW is .groups-overlay allowed off its opacity:0 — every .group-item
  // has a real left/top for the first time. See the comment at groupsOverlayEl
  // in js/groups.js for why adding it there instead flashed the six legend
  // rows in the top-left corner during @fold1 on a refresh.
  groupsOverlayEl.classList.add("is-active");
  updateTextCardFrameDashes();
  playPage0Entrance();
  // document.fonts.load() above resolves once the font is fetched, but the
  // browser can still apply it to already-laid-out text a tick later — a
  // font swap changes label widths (and can reflow a title onto a different
  // number of lines, changing the title-card frame's height), so both are
  // re-measured once fonts.ready actually fires.
  document.fonts.ready.then(() => {
    layoutGroups();
    updateTextCardFrameDashes();
  });
  page7UpdateFromScroll();
  page8CheckScroll();
  page9UpdateFromScroll();
  updateFold13();
  p12ShareInit();
  p12MapPrefetchCheck();      // @fold13's map data (map.js) — lazy fetch, two viewports ahead
  p12CardWidthFit();
  p12SpacingFit();            // #page-11's height = 50vh + half its card (house rhythm, page12.js)
  // The sections are vh-sized, so a window resize changes the document's total
  // height — but the browser keeps the raw pixel scrollY, which lands the reader
  // at a *different point in the narrative* (titles visibly slide up/down as the
  // window is dragged). Track the reader's fractional position through the
  // scrollable range on every scroll, and restore that fraction after a resize.
  // Desktop only: mobile browsers fire resize on plain scrolling (address bar
  // show/hide — see the comment inside the handler below), and re-pinning the
  // fraction there would fight the user's own in-flight scroll.
  let scrollAnchorFrac = 0;
  const scrollMax = () =>
    Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const updateScrollAnchor = () => {
    const max = scrollMax();
    if (max > 0) scrollAnchorFrac = window.scrollY / max;
  };
  updateScrollAnchor();
  window.addEventListener("scroll", updateScrollAnchor, { passive: true });
  // A phone fires `resize` continuously while its URL/bottom bar slides, and the
  // full relayout below is heavy enough (a fresh full-viewport canvas backing
  // store, every page-0 dot element rebuilt, six labels re-measured) that
  // running it on those ticks stalls the main thread through the collapse —
  // the browser gives up and snaps the bar back, so it "refuses to collapse"
  // on every scroll after the first. Nothing in the relayout is needed for a
  // bar slide anyway: all scroll geometry is `vh` (fixed on mobile, it does
  // NOT track the bar), and draw() already re-syncs the canvas backing store
  // to the CSS box on every single paint. So a height-only resize on mobile
  // does nothing but repaint. A width change is a real rotation/breakpoint
  // crossing and still runs the whole thing.
  let lastResizeW = window.innerWidth;
  // Trailing re-place of the DOM overlays after a mobile bar slide has SETTLED.
  // .graphic-col is `position: fixed; inset: 0`, so canvas.clientHeight *is*
  // innerHeight and does move with the bar — the canvas re-reads it every paint
  // (so the vertical axis re-centres itself), but the 8 fold6 squares are DOM
  // elements that only move when layoutGroups() runs, which the cheap path
  // below deliberately skips. Left alone they keep the position solved for the
  // shorter viewport, which p7VertTopY centres half the bar's height too high —
  // the "first 8 dots sit above 2023" bug. Debounced so nothing heavy runs
  // *during* the slide (that stall is what made the bar refuse to collapse);
  // one layoutGroups() after it stops is imperceptible.
  let mobileHeightSettleT = 0;
  window.addEventListener("resize", () => {
    const w = window.innerWidth;
    const widthChanged = w !== lastResizeW;
    lastResizeW = w;
    if (isMobile() && !widthChanged) {
      draw();
      clearTimeout(mobileHeightSettleT);
      mobileHeightSettleT = setTimeout(() => { layoutGroups(); draw(); }, 180);
      return;
    }
    // buildPage0AllDots() must run before layoutGroups() — it repopulates
    // PAGE0_GROUP_DOT_ANCHORS (page1.js), which updateGroups() reads for the
    // fold1->fold2 legend entrance below.
    buildPage0AllDots();
    // ...and re-pick @fold2's filler rects out of the freshly-rebuilt dots.
    assignFold2Fillers();
    // buildPage0AllDots() recreates every decorative dot hidden/shrunk
    // (opacity 0, scale(0), popped: false) as if playPage0Entrance hadn't
    // run yet — but playPage0Entrance only ever runs once, at page load, so
    // without this these dots would stay invisible for the rest of the
    // session after any resize (mobile browsers fire resize on scroll, from
    // the address bar showing/hiding, so this could happen mid-scroll). If
    // the entrance already finished, snap the new dots straight to their
    // settled/popped state instead of waiting for an entrance that will
    // never replay.
    if (page0EntranceDone) {
      PAGE0_DECORATIVE_DOT_ELS.forEach((d) => {
        d.el.style.opacity = "1";
        d.el.style.transform = "scale(1)";
        d.popped = true;
      });
    }
    // Label widths and heights are cached per group color (groupLabelWidth /
    // groupLabelHeight, js/groups.js) and feed @fold3's column placement and
    // row pitch — but the mobile breakpoint changes the label's font-size and
    // lets it wrap, so cached desktop measurements would place both camps'
    // columns wrongly, and print their rows over each other, after a crossing.
    // Cheap to re-measure (6 labels), so clear unconditionally rather than
    // tracking the crossing.
    groupLabelWidths = {};
    groupLabelHeights = {};
    groupLabelInkShifts = {};
    init();
    layoutGroups();
    updateTextCardFrameDashes();
    // Restore the reader's fractional scroll position now that every layout
    // above has settled into the new viewport — instant, not smooth, so the
    // page doesn't animate through folds mid-drag of the window edge. The
    // scrollTo fires a scroll event, which re-runs every crossing check at the
    // equivalent point and also refreshes scrollAnchorFrac against the new
    // document height.
    if (!isMobile()) {
      window.scrollTo(0, scrollAnchorFrac * scrollMax());
    }
  });
});
