// ── Page 7's tall section (#page-8) is a pure scroll-driver: scroll position
// -> date. Its own intro title used to be fused in here as a static header
// above the timeline's month list — it's now its own earlier fold (#page-6,
// "כל ריבוע..."), with fold 9 ("צבע הריבוע...", #page-7) after it, so the
// real per-event reveal below doesn't engage until both have been scrolled
// past. ──
const page7Section = document.getElementById("page-8");
let page7Ticking = false;

// The scrub's opening is deliberately slower than the rest: over the first
// P7_SCRUB_EASE_IN_SPAN of the scroll range the date creeps in from a standstill
// and ramps up to the normal rate, so the axis doesn't lurch the moment the
// timeline engages. Shape is smoothstep on the local 0..1 (h = 2u²-u³): it
// starts at zero speed and hits exactly speed 1 at the seam, and since h(1)=1
// the eased value rejoins the linear one there — so nothing past the ramp
// changes, and t=1 still lands on the same end date.
const P7_SCRUB_EASE_IN_SPAN = 0.15;
function p7ScrubEaseIn(t) {
  if (t >= P7_SCRUB_EASE_IN_SPAN) return t;
  const u = t / P7_SCRUB_EASE_IN_SPAN;
  return P7_SCRUB_EASE_IN_SPAN * u * u * (2 - u);
}

function page7UpdateFromScroll() {
  const rect = page7Section.getBoundingClientRect();

  // t=0 the instant fold 9's own title card clears the top of the viewport
  // (the same instant p7HasEngaged flips true below) rather than when
  // #page-8's own top reaches the viewport top — #page-7 (fold 9) keeps
  // scrolling for a while after its title clears before #page-8 actually
  // begins, and anchoring t=0 to #page-8's own top left that whole stretch as
  // dead scroll space where engagement had already fired but the axis never
  // moved off 0%. `gap` (page7TitleCardEl's top minus #page-8's own top, at
  // this same instant) is a pure document-layout constant regardless of
  // current scroll position, so recomputing it fresh here — instead of
  // caching it — keeps this correct across a resize too. t=1 stays anchored
  // to the exact same endpoint as before (#page-8's bottom reaching the
  // viewport bottom); starting earlier just means that same endpoint is now
  // reached over a correspondingly longer scroll distance.
  const titleTop = page7TitleCardEl ? page7TitleCardEl.getBoundingClientRect().top : rect.top;
  const gap = rect.top - titleTop;
  const scrubRange = rect.height - window.innerHeight + gap;
  const t = scrubRange > 0 ? Math.max(0, Math.min(1, -titleTop / scrubRange)) : 0;

  if (!p7.ready) return;

  // Refresh engagement state before checking it — without this, the check below
  // would use whatever the last draw call left, which can be one scroll event stale.
  p7UpdateEngagement();

  // Hold currentDate at minDate until engagement actually fires — otherwise
  // scroll position advances curMonthKey silently while !p7HasEngaged, so the
  // first months have no animStart and appear settled (instantly filled) the
  // moment the first draw call with p7HasEngaged===true hits them.
  if (!p7HasEngaged) {
    p7.currentDate = p7.minDate;
    if (currentPage === 8) { draw(); p7RecheckHover(); }
    return;
  }

  const minD = new Date(p7.minDate + "T00:00:00Z");
  const maxD = new Date(p7.maxDate + "T00:00:00Z");
  const totalDays = Math.round((maxD - minD) / 86400000);
  const cur = new Date(minD);
  cur.setUTCDate(cur.getUTCDate() + Math.round(p7ScrubEaseIn(t) * totalDays));
  p7.currentDate = cur.toISOString().slice(0, 10);

  if (currentPage === 8) { draw(); p7RecheckHover(); }
}

window.addEventListener("scroll", () => {
  if (page7Ticking) return;
  page7Ticking = true;
  requestAnimationFrame(() => { page7UpdateFromScroll(); page7Ticking = false; });
}, { passive: true });

