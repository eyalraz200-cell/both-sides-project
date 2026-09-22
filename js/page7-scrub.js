// ── Page 7's tall section (#page-9) is a pure scroll-driver: scroll position
// -> date. Its own intro title used to be fused in here as a static header
// above the timeline's month list — it's now its own earlier fold (#page-6,
// "כל ריבוע..."), with fold 9 ("צבע הריבוע...", #page-7) after it, so the
// real per-event reveal below doesn't engage until both have been scrolled
// past. ──
const page7Section = document.getElementById("page-9");
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

// How far (in viewports) before @fold11 takes the screen the dataset finishes.
// 0 would land t=1 exactly as #page-9's bottom leaves the viewport top, which is
// the same instant @fold11's card crosses its 0.5 threshold and the size grid
// takes over — too early: the year axis's own fill trails p7.currentDate by the
// p7AxisFillLagDamping() lerp (page7.js), so it would still be visibly filling
// when the grid started. Half a viewport of scroll past t=1 lets the fill settle
// first. Raise it to end the dataset earlier (more quiet scroll at the end),
// lower it to end later; keep the section height in step (desktop 510vh + lead·100vh)
// so the scrub range, and the pace, don't move.
const P7_SCRUB_END_LEAD_VH = 0.5;

function page7UpdateFromScroll() {
  const rect = page7Section.getBoundingClientRect();

  // t=0 the instant @fold9's date-range card's centre clears the top of the viewport
  // (the same instant p7HasEngaged flips true below) rather than when
  // #page-9's own top reaches the viewport top — #page-7 (fold 9) keeps
  // scrolling for a while after its title clears before #page-9 actually
  // begins, and anchoring t=0 to #page-9's own top left that whole stretch as
  // dead scroll space where engagement had already fired but the axis never
  // moved off 0%. `gap` (fold9AxisCardEl's top minus #page-9's own top, at
  // this same instant) is a pure document-layout constant regardless of
  // current scroll position, so recomputing it fresh here — instead of
  // caching it — keeps this correct across a resize too.
  //
  // t=1 is anchored to #page-9's bottom reaching P7_SCRUB_END_LEAD_VH of a
  // viewport above the viewport bottom — see that constant. It used to be the
  // bottom reaching the viewport BOTTOM (lead = 1), which left a whole viewport
  // of scroll where the dataset had already finished and @fold11's card hadn't
  // arrived yet — dead scroll. The section is shortened/lengthened in step with
  // the lead (style.css .text-section.page7-scrub), so the range — and with it
  // the scrub's pace — is unchanged whatever the lead is.
  // The card is @fold9's date-range card (fold9AxisCardEl, js/groups.js) — the
  // same element p7UpdateEngagement measures, so t=0 and engagement coincide.
  const titleTop = (typeof fold9AxisCardEl !== "undefined" && fold9AxisCardEl) ? fold9AxisCardEl.getBoundingClientRect().top : rect.top;
  const gap = rect.top - titleTop;
  const scrubRange = rect.height + gap - window.innerHeight * P7_SCRUB_END_LEAD_VH;
  // t=0 sits on the engagement line (p7EngageOffsetPx, page7.js — the card's
  // vertical centre past the top edge), not on titleTop = 0, so the first day lands
  // exactly when the timeline engages; t=1 stays where it was.
  const engageOff = p7EngageOffsetPx();
  const t = scrubRange > engageOff ? Math.max(0, Math.min(1, (-titleTop - engageOff) / (scrubRange - engageOff))) : 0;
  if (!p7.ready) return;

  // Refresh engagement state before checking it — without this, the check below
  // would use whatever the last draw call left, which can be one scroll event stale.
  p7UpdateEngagement();

  // Hold currentDate at the pre-start date (p7PreStartDate, page7.js — a day
  // before minDate, so NOTHING reads as reached) until engagement actually fires — otherwise
  // scroll position advances curMonthKey silently while !p7HasEngaged, so the
  // first months have no animStart and appear settled (instantly filled) the
  // moment the first draw call with p7HasEngaged===true hits them.
  if (!p7HasEngaged) {
    p7.currentDate = p7PreStartDate();
    if (currentPage === 9) { draw(); p7RecheckHover(); }
    return;
  }

  const minD = new Date(p7.minDate + "T00:00:00Z");
  const maxD = new Date(p7.maxDate + "T00:00:00Z");
  const totalDays = Math.round((maxD - minD) / 86400000);
  const cur = new Date(minD);
  cur.setUTCDate(cur.getUTCDate() + Math.round(p7ScrubEaseIn(t) * totalDays));
  p7.currentDate = cur.toISOString().slice(0, 10);

  if (currentPage === 9) { draw(); p7RecheckHover(); }
}

window.addEventListener("scroll", () => {
  if (page7Ticking) return;
  page7Ticking = true;
  requestAnimationFrame(() => { page7UpdateFromScroll(); page7Ticking = false; });
}, { passive: true });

