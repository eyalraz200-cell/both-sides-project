// ── Scrollytelling: which text section is active drives the pinned canvas ──
const sections = Array.from(document.querySelectorAll(".text-section"));

// ── The fold badge ──────────────────────────────────────────────────────────
// A small fixed chip in the TOP-LEFT corner showing the current @foldN — the
// NUMBER ALONE, nothing else. That is the standard for fold numbers anywhere
// they're displayed: no "@fold" prefix, no id, no label. @foldN is the project's
// canonical 1-indexed numbering (CLAUDE.md's fold reference), which is always
// currentPage's id + 1.
// Ctrl+Shift+F hides/shows it, and the choice persists in localStorage. The
// access is wrapped in try/catch — browsers with storage blocked (Safari's
// "Block all cookies", strict private browsing, some corporate policies) throw
// a SecurityError on access rather than failing quietly, which would otherwise
// kill this whole script and blank the page for anyone with those settings.
// DEV ONLY, and that is binding: the badge and its picker are a working aid and
// must NEVER appear on the deployed site (explicit instruction). isLocalHost()
// (js/core.js) is the gate — on any public host this resolves to null and the
// markup stays inert, since the element is `display: none` until .is-visible
// is added here. Nothing else can switch it on: the Ctrl+Shift+F listener and
// the mobile picker are both inside this branch.
const foldNumberBadge = isLocalHost() ? document.getElementById("foldNumberBadge") : null;
// Dismissed = GONE (no chip on the page). The way back on a phone is the
// harness panel tab's fold-badge switch, answered by _debug-bus.js so it works
// with no harness loaded. `is-dot` is still the off state's class; it just
// paints nothing now (style.css).
function setFoldBadgeVisible(visible) {
  if (!foldNumberBadge) return;
  foldNumberBadge.classList.toggle("is-visible", visible);
  foldNumberBadge.classList.toggle("is-dot", !visible);
  foldNumberBadge.title = visible ? "fold — click to jump (Ctrl+Shift+F hides)"
                                  : "show the fold number";
  try { localStorage.setItem("foldNumberBadgeVisible", visible ? "1" : "0"); } catch {}
}
if (foldNumberBadge) {
  let pref = null;
  try { pref = localStorage.getItem("foldNumberBadgeVisible"); } catch {}
  // Shown unless it was explicitly switched off — it's a reading aid you want
  // on by default while working on the folds.
  setFoldBadgeVisible(pref !== "0");
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "f") {
      e.preventDefault();
      setFoldBadgeVisible(!foldNumberBadge.classList.contains("is-visible"));
    }
  });
}

// ── The fold picker (both breakpoints) ──────────────────────────────────────
// Clicking or tapping the badge opens a list of all 16 folds and jumps to the
// one you pick. It was mobile-only on the grounds that Ctrl+Shift+F covered
// desktop, but that shortcut only TOGGLES the badge — it never navigates — so
// desktop had no way to jump to a fold at all. The badge is therefore clickable
// on both breakpoints now (see the `pointer-events` note in style.css).
//
// The panel's last row switches the badge off; the harness panel tab's own
// fold-badge switch is what brings it back.
//
// It is built from the sections themselves — number plus that fold's own title,
// with the `.copy-desktop` half of any breakpoint-split headline stripped out —
// so it cannot drift out of step with project.html the way a hand-written list
// would.
const FOLD_PICKER_SCROLL_MS = 700;

// What each fold IS, in the words we use for it in conversation and in the
// CLAUDE.md fold table — not the fold's own on-screen copy. The copy is a
// paragraph of Hebrew body text: it fills the row, reads as prose rather than a
// name, and two folds that share a phrasing become indistinguishable in the
// list. These are @fold1…@fold17 in order, so the row index is the fold number.
const FOLD_NAMES = [
  "hero / intro",
  "dots fly into the camp grids",
  "filler rects shrink, labels type in",
  "groups glide into the legend",
  "sample squares grow in",
  "ACLED methodology card",
  "square labels + hover tooltip demo",
  "ACLED methodology + credit note",
  "date range card — the axis draws in, then the squares fly",
  "the real pinned timeline",
  "size grid — dots morph to crowd tier",
  "size down, then fly to the legit zone",
  "bridge glide",
  "drag and drop categorisation",
  "closing statement",
  "share block + domino pairing",
  "outro / credits",
];

function foldPickerLabel(section, i) {
  return FOLD_NAMES[i] || section.id || "";
}

// Animated, never an instant jump. A jump skips every pinned/scrubbed section it
// passes, which latches those folds into their end state and leaves later ones
// stuck on screen — the page then looks broken because of the navigation aid.
// Fixed duration rather than fixed speed, so a jump across the whole page takes
// the same time as a jump to the next fold.
let foldPickerRaf = null;
function foldPickerScrollTo(y) {
  if (foldPickerRaf) cancelAnimationFrame(foldPickerRaf);
  const from = window.scrollY;
  const dist = y - from;
  if (Math.abs(dist) < 1) return;
  const start = performance.now();
  const ease = typeof p9Ease === "function" ? p9Ease : (t => t);
  const step = (now) => {
    const t = Math.min(1, (now - start) / FOLD_PICKER_SCROLL_MS);
    window.scrollTo(0, Math.round(from + dist * ease(t)));
    foldPickerRaf = t < 1 ? requestAnimationFrame(step) : null;
  };
  foldPickerRaf = requestAnimationFrame(step);
}

function foldPickerInit() {
  if (!foldNumberBadge) return;
  let panel = null;

  function build() {
    panel = document.createElement("div");
    panel.className = "fold-picker";
    panel.setAttribute("aria-hidden", "true");
    sections.forEach((section, i) => {
      if (section.hidden) return;   // folds parked with `hidden` keep their number, lose their row
      const row = document.createElement("button");
      row.type = "button";
      row.className = "fold-picker-row";
      row.dataset.fold = String(i + 1);
      const n = document.createElement("span");
      n.className = "fold-picker-n";
      n.textContent = String(i + 1);          // @foldN — the number alone, house style
      const t = document.createElement("span");
      t.className = "fold-picker-t";
      t.textContent = foldPickerLabel(section, i);
      row.append(n, t);
      row.addEventListener("click", (e) => {
        e.stopPropagation();
        close();
        const top = section.getBoundingClientRect().top + window.scrollY;
        foldPickerScrollTo(top);
      });
      panel.appendChild(row);
    });
    // …and the dismiss row. Not a fold, so it sits below a hairline and carries
    // the shortcut as its hint rather than a number.
    const hide = document.createElement("button");
    hide.type = "button";
    hide.className = "fold-picker-row fold-picker-hide";
    hide.textContent = "hide the fold number  ·  Ctrl+Shift+F";
    hide.addEventListener("click", (e) => {
      e.stopPropagation();
      close();
      setFoldBadgeVisible(false);
    });
    panel.appendChild(hide);
    // A direct .layout child for the same reason the badge is: .graphic-col is
    // its own stacking context and traps any z-index inside it.
    (document.querySelector(".layout") || document.body).appendChild(panel);
  }

  function open() {
    if (!panel) build();
    panel.classList.add("is-open");
    // Mark the fold you're on, so the list opens oriented rather than needing
    // to be read from the top.
    panel.querySelectorAll(".fold-picker-row").forEach(r => {
      r.classList.toggle("is-current", Number(r.dataset.fold) === currentPage + 1);
    });
    const cur = panel.querySelector(".fold-picker-row.is-current");
    if (cur) cur.scrollIntoView({ block: "center" });   // inside the panel only
  }
  function close() { if (panel) panel.classList.remove("is-open"); }
  function isOpen() { return !!panel && panel.classList.contains("is-open"); }

  foldNumberBadge.addEventListener("click", (e) => {
    e.stopPropagation();
    // Off (nothing painted): a stray click can still reach this element's box,
    // and bringing the number back is the friendlier reading of it.
    if (!foldNumberBadge.classList.contains("is-visible")) {
      setFoldBadgeVisible(true);
      return;
    }
    isOpen() ? close() : open();
  });
  // Any click/tap outside dismisses it, and so does Escape — the panel sits over
  // live artwork, so getting rid of it must never take aim.
  document.addEventListener("click", (e) => {
    if (isOpen() && !e.target.closest(".fold-picker")) close();
  });
  window.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
}
// The sections have to exist before the rows can be built from them, so the init
// waits rather than running at top level.
document.addEventListener("DOMContentLoaded", foldPickerInit);

function updateFoldNumberBadge() {
  if (foldNumberBadge) foldNumberBadge.textContent = String(currentPage + 1);
}
// First paint: @fold1 is the page's starting state and never crosses
// setActivePage (which returns early on page === currentPage), so the badge
// would sit empty until the first scroll without this.
updateFoldNumberBadge();

function setActivePage(page) {
  // @fold10's size-grid toggle (page7.js) lives on that page only — snapped
  // off before any handoff below reads the timeline's positions.
  if (typeof p7SizeGridOnPage === "function") p7SizeGridOnPage(page);
  if (page === currentPage) return;
  // Scrolling back out of the timeline toward a fold that doesn't draw the
  // per-event squares at all (anything before drawFold7 — @fold5 draws it too
  // now that @fold6/@fold7 are hidden — i.e. currentPage < 4)
  // — wipe all per-month animation state so the next entry replays from
  // scratch instead of showing the previously-settled dots hanging around.
  //
  // Deliberately NOT on the 7 -> 4 crossing (7 -> 6 while those folds are shown). drawFold9/drawFold7 (js/core.js)
  // keep drawing and retreating the squares while p7RealTimelineReached, so the
  // reverse cascade is *supposed* to play out across that boundary; wiping here
  // made every dot vanish in one frame the instant the IntersectionObserver
  // crossed. Those two draw functions run the wipe themselves once the retreat
  // has actually finished.
  if (currentPage >= 4 && page < 4) p7ResetForReplay();

  // Continuing into page9 (fold12) while page8's own timeline->legit-grid
  // glide (p8CurrentT, page8.js) hasn't actually finished yet — the
  // IntersectionObserver driving this can cross into page9's slot before
  // that glide reaches t=1. drawPage9 has no notion of that glide's
  // progress on its own, so without seeding p9.anim here the dots would
  // snap straight to their final legit position the instant page9 takes
  // over drawing instead of page8 — see p8CaptureBlendedPositions' own
  // comment (page8.js) for the full rationale.
  //
  // The continuation is seeded from the glide's *start* positions (t=0) with a
  // back-dated `start`, NOT from the current blended position with the
  // remaining duration. p9PlaceDot re-applies p9Ease to whatever window it's
  // given, so the latter eased an already-eased slice: velocity dropped to
  // exactly zero at the handoff (sine-in-out starts at rest) and the path
  // deviated up to ~15% of total travel before catching up at the end. Because
  // the IntersectionObserver that fires this handoff crosses at a
  // *scroll-dependent* moment, that showed up as the glide stuttering and
  // landing differently depending on whether the user kept scrolling through
  // it. Replaying the same global 0..1 clock makes the handoff invisible.
  if (currentPage === 12 && page === 13 && typeof p8CurrentT === "function" && p8Engaged && p8CurrentT() < 1) {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    p9.anim = {
      from: p8CaptureBlendedPositions(W, H, 0),
      start: performance.now() - p8ForwardMs() * p8CurrentT(),
      duration: p8ForwardMs(),   // the glide's own live clock (page8.js)
      plainGlide: true, // see p9PlaceDot (page9.js) — keeps this at page8's own pace, no tier stagger
      // The glide's starting SQUARE SIZE too, not just its positions: page8
      // shrinks the dots across the flight and drawPage9 has to keep doing so,
      // or the dots snap small at the handoff and the flight looks dimmer.
      // p8CaptureBlendedPositions above has just run p7UpdateLayout, so p7.SQ
      // is this viewport's real timeline size. Out of @fold11's size grid there
      // is no single start size — every dot leaves at its own tier size — so
      // the scalar is left OFF there and each captured entry's own `sq` drives
      // the lerp instead (p9PlaceDot's `from.sq` branch, page9.js).
      ...(typeof p7Grid !== "undefined" && p7Grid.on ? {} : { fromSQ: p7.SQ }),
    };
  }

  // Mirror of the above, the other direction: leaving page8's bridge back
  // toward the real timeline (#page-9, drawPage7) while page8's reverse glide
  // (p8CurrentT decreasing toward 0) hasn't finished yet. drawPage7 has no
  // notion of that glide's progress on its own — every square would
  // otherwise teleport straight to its resting timeline cell the instant
  // this section starts drawing instead of page8. See p7EntryAnim's own
  // comment (page7.js) for the full rationale.
  // Page 9 too: drawNow (js/core.js) keeps page8 painting the reverse glide on
  // @fold11, so the flip that reaches @fold10 can come from there with the
  // glide still in the air — without this hand-off drawPage7's first frame put
  // every dot at its row cursor and the field jumped.
  if ((currentPage === 10 || currentPage === 11 || currentPage === 12) && page === 9 && typeof p8CurrentT === "function" && p8CurrentT() > 0) {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    // Same back-dating as the forward handoff above, mirrored: this direction
    // runs t: p8CurrentT() -> 0 and its target IS the timeline layout, so the
    // "from" is the glide's other endpoint (t=1) and the elapsed time is
    // (1 - p8CurrentT()) of a full traverse. p9Ease is symmetric
    // (p9Ease(1-x) === 1 - p9Ease(x)), so that reproduces the glide's own curve
    // exactly, with no dead stop at the handoff. This direction continues the
    // REVERSE glide, so it replays the reverse's own (shorter) clock —
    // P8_REVERSE_DURATION, not the forward's 3000ms.
    p7EntryAnim = {
      from: p8CaptureBlendedPositions(W, H, 1),
      start: performance.now() - P8_REVERSE_DURATION * (1 - p8CurrentT()),
      duration: P8_REVERSE_DURATION,
    };
  }

  currentPage = page;
  // The picker's instruction band (page7.js) is painted from the timeline's own
  // draw loop, which stops the moment the timeline does — so the fold it leaves
  // on (@fold12's beat) has to tell it, or it stays frozen on screen fully
  // typed. AFTER the assignment above, deliberately: the band reads
  // currentPage, and running it first left it a whole fold behind.
  if (typeof p7HintBandApply === "function") p7HintBandApply();
  updateFoldNumberBadge();
  updateGroups();
  draw();

  // p9.anim (if just seeded above) only advances when something drives a
  // continuous per-frame loop — every other call site that sets p9.anim
  // follows it with this same call. Without it, the glide only progressed on
  // whatever incidental draw() calls scroll/hover happened to trigger, i.e.
  // it would stall the instant the user stopped scrolling and lurch forward
  // again on the next unrelated redraw, instead of playing smoothly.
  if (currentPage === 13 && p9.anim) p9RunAnimLoop();

  // Same reasoning, for p7EntryAnim's own continuous loop.
  if (currentPage === 9 && p7EntryAnim) p7StartAnimLoop();
}

const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) setActivePage(Number(entry.target.dataset.page));
  });
}, { rootMargin: "-50% 0px -50% 0px", threshold: 0 });

sections.forEach(sec => sectionObserver.observe(sec));

