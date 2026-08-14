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
  window.addEventListener("resize", () => {
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
    init();
    layoutGroups();
    updateTextCardFrameDashes();
  });
});
