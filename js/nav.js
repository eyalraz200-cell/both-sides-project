// ── Scrollytelling: which text section is active drives the pinned canvas ──
const sections = Array.from(document.querySelectorAll(".text-section"));

const foldNumberBadge = document.getElementById("foldNumberBadge");

// Populate once with one <option> per section (@foldN is this project's own
// canonical fold numbering — see CLAUDE.md's fold reference table — always
// currentPage's id + 1). Picking an option scrolls its section into view;
// the resulting scroll re-triggers the existing IntersectionObserver, which
// calls setActivePage/updateFoldNumberBadge on its own, so no extra state
// sync is needed here.
if (foldNumberBadge) {
  sections.forEach((sec, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = `@fold${i + 1}`;
    foldNumberBadge.appendChild(opt);
  });
  foldNumberBadge.addEventListener("change", () => {
    sections[Number(foldNumberBadge.value)].scrollIntoView({ behavior: "smooth" });
  });
  // Hidden by default (see style.css); Ctrl+Shift+F toggles it and persists
  // the choice in localStorage so it stays put across reloads. localStorage
  // access is wrapped in try/catch — browsers with storage blocked (Safari's
  // "Block all cookies", strict private-browsing modes, some corporate
  // policies) throw a SecurityError on access rather than failing quietly,
  // which would otherwise kill this whole (unrelated) script and blank the
  // entire page for anyone with those settings.
  const FOLD_BADGE_VISIBLE_KEY = "foldNumberBadgeVisible";
  // Visible on every load — force-shown regardless of any stale saved pref.
  // Ctrl+Shift+F still hides/shows it within the session.
  foldNumberBadge.classList.add("is-visible");
  try { localStorage.setItem(FOLD_BADGE_VISIBLE_KEY, "1"); } catch {}
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "f") {
      e.preventDefault();
      const visible = foldNumberBadge.classList.toggle("is-visible");
      try { localStorage.setItem(FOLD_BADGE_VISIBLE_KEY, visible ? "1" : "0"); } catch {}
    }
  });
}

function updateFoldNumberBadge() {
  if (foldNumberBadge) foldNumberBadge.value = String(currentPage);
}

function setActivePage(page) {
  if (page === currentPage) return;
  // Scrolling back out of the timeline toward an earlier fold — wipe all
  // per-month animation state so the next entry replays from scratch instead
  // of showing the previously-settled dots still hanging around.
  if (currentPage === 7 && page < 7) p7ResetForReplay();

  // Continuing into page9 (fold12) while page8's own timeline->legit-grid
  // glide (p8CurrentT, page8.js) hasn't actually finished yet — the
  // IntersectionObserver driving this can cross into page9's slot before
  // that glide reaches t=1. drawPage9 has no notion of that glide's
  // progress on its own, so without seeding p9.anim here the dots would
  // snap straight to their final legit position the instant page9 takes
  // over drawing instead of page8 — see p8CaptureBlendedPositions' own
  // comment (page8.js) for the full rationale.
  if (currentPage === 8 && page === 9 && typeof p8CurrentT === "function" && p8Engaged && p8CurrentT() < 1) {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    p9.anim = {
      from: p8CaptureBlendedPositions(W, H),
      start: performance.now(),
      duration: Math.max(1, P8_TRANSITION_DURATION * (1 - p8CurrentT())),
      plainGlide: true, // see p9PlaceDot (page9.js) — keeps this at page8's own pace, no tier stagger
    };
  }

  // Mirror of the above, the other direction: leaving page8's bridge back
  // toward the real timeline (#page-7, drawPage7) while page8's reverse glide
  // (p8CurrentT decreasing toward 0) hasn't finished yet. drawPage7 has no
  // notion of that glide's progress on its own — every square would
  // otherwise teleport straight to its resting timeline cell the instant
  // this section starts drawing instead of page8. See p7EntryAnim's own
  // comment (page7.js) for the full rationale.
  if (currentPage === 8 && page === 7 && typeof p8CurrentT === "function" && p8CurrentT() > 0) {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    p7EntryAnim = {
      from: p8CaptureBlendedPositions(W, H),
      start: performance.now(),
      duration: Math.max(1, P8_TRANSITION_DURATION * p8CurrentT()),
    };
  }

  currentPage = page;
  updateGroups();
  updateFoldNumberBadge();
  draw();

  // p9.anim (if just seeded above) only advances when something drives a
  // continuous per-frame loop — every other call site that sets p9.anim
  // follows it with this same call. Without it, the glide only progressed on
  // whatever incidental draw() calls scroll/hover happened to trigger, i.e.
  // it would stall the instant the user stopped scrolling and lurch forward
  // again on the next unrelated redraw, instead of playing smoothly.
  if (currentPage === 9 && p9.anim) p9RunAnimLoop();

  // Same reasoning, for p7EntryAnim's own continuous loop.
  if (currentPage === 7 && p7EntryAnim) p7StartAnimLoop();
}

const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) setActivePage(Number(entry.target.dataset.page));
  });
}, { rootMargin: "-50% 0px -50% 0px", threshold: 0 });

sections.forEach(sec => sectionObserver.observe(sec));

