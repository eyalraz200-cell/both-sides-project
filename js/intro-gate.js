// ── THE WORK-IN-PROGRESS GATE ──────────────────────────────────────────────
// A one-button notice over a darkened page, shown before anything else on a
// visitor's first load: the project is still being worked on and shouldn't be
// passed around yet. Pressing the button dismisses it and only THEN does
// @fold1's entrance play — the reveal is the whole first impression, so it
// must not run behind a modal (or worse, finish behind one).
//
// The hold works by inversion of control rather than by a flag someone has to
// remember to check: js/bootstrap.js hands its playPage0Entrance call to
// shkGateWait() instead of calling it, and this file decides when that runs.
// Markup lives in project.html (see .shk-gate there); styling in style.css.
//
// SHOWN ONCE PER BROWSER. The flag below is also read by an inline <head>
// script in project.html — that one is what prevents a returning visitor
// seeing the gate flash before this file executes — so the two names must
// stay in sync.
const SHK_GATE_KEY = "shk-gate-seen";

const shkGateEl = document.getElementById("shkGate");
const shkGateBtnEl = document.getElementById("shkGateBtn");

// How long the gate takes to clear, in ms. Must match the .shk-gate opacity
// transition in style.css: the entrance is fired at the END of it, so the
// first thing the reveal plays against is the bare page, not a half-lit one.
const SHK_GATE_FADE_MS = 240;

// Queued callbacks (in practice exactly one: playPage0Entrance). A queue
// rather than a single slot because bootstrap runs behind document.fonts.load
// — the button can easily be pressed BEFORE the caller ever registers, in
// which case shkGateWait runs it on the spot.
let shkGateDone = false;
const shkGateQueue = [];

function shkGateSeen() {
  try { return localStorage.getItem(SHK_GATE_KEY) === "1"; } catch (e) { return false; }
}

// Never shown, or already dismissed → nothing to wait for.
if (!shkGateEl || shkGateSeen()) {
  shkGateDone = true;
  if (shkGateEl) shkGateEl.remove();
} else {
  shkGateEl.classList.add("is-open");
  // Scroll is locked on the ELEMENTS, not by a scroll listener: the page's
  // whole animation system is scroll-position-driven, so anything that lets
  // the document scroll behind the gate would advance folds the visitor can't
  // see and leave them mid-fold on dismissal.
  document.documentElement.classList.add("shk-gate-open");
  window.scrollTo(0, 0);
  shkGateBtnEl?.addEventListener("click", () => shkGateDismiss());
  // NOT focused on open. The button is the page's only control while the gate
  // is up, so a keyboard user reaches it with one Tab — and a programmatic
  // focus() paints :focus-visible for everyone else, ringing the filled button
  // in a second black outline that reads as a double border.
}

function shkGateDismiss() {
  if (shkGateDone) return;
  shkGateDone = true;
  try { localStorage.setItem(SHK_GATE_KEY, "1"); } catch (e) {}
  shkGateEl.classList.remove("is-open");
  document.documentElement.classList.remove("shk-gate-open");
  // A browser can restore a scroll position on reload; the entrance assumes
  // the top of the document, so re-assert it now that scrolling is possible.
  window.scrollTo(0, 0);
  setTimeout(() => {
    shkGateEl.remove();
    while (shkGateQueue.length) shkGateQueue.shift()();
  }, SHK_GATE_FADE_MS);
}

// Run `fn` once the gate is out of the way — immediately when there is no gate.
function shkGateWait(fn) {
  if (shkGateDone && !shkGateEl?.isConnected) fn();
  else shkGateQueue.push(fn);
}

// DEV ONLY — the _debug-gate.js harness re-opens the gate to tune it without a
// reload, and clears the flag so a plain refresh shows it again.
function shkGateReopen() {
  try { localStorage.removeItem(SHK_GATE_KEY); } catch (e) {}
  // BOTH halves of the "already seen" state have to go, not just the flag: on
  // any load after the first dismissal the inline <head> script has already
  // stamped .shk-gate-seen onto <html>, and that rule is a display:none —
  // without this the gate is re-attached and re-opened but never paints, and
  // every knob in the harness silently drives an invisible element.
  document.documentElement.classList.remove("shk-gate-seen");
  if (!shkGateEl || shkGateEl.isConnected) {
    shkGateEl?.classList.add("is-open");
    document.documentElement.classList.add("shk-gate-open");
    return;
  }
  document.body.appendChild(shkGateEl);
  shkGateDone = false;
  shkGateEl.classList.add("is-open");
  document.documentElement.classList.add("shk-gate-open");
  window.scrollTo(0, 0);
}
