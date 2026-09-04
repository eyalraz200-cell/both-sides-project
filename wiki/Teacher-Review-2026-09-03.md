# Teacher review — 3 Sep 2026 (Zoom with Mushon)

Action items distilled from `GMT20260903-124842_Recording.transcript.vtt`. Tick items off
here as they land; each done item must also update its matching wiki page in the same turn.

Overall verdict: "one of the best projects to come out of this course". Almost everything is
small polish. **One big change: the timeline layout.** Mushon will pitch the project to
Shaul Amsterdamski (כאן) once these are tightened — Eyal asked for the weekend to do a pass first.

Legend: 🔴 must · 🟡 should · 🟢 nice-to-have / "not critical" · 📱 mobile-specific · 🖥 desktop-specific

---

## A. The big one — @fold9 timeline layout 🔴

- [ ] **A1. Move the year axis vertically between the two camps.** Instead of the horizontal
  axis under two side-by-side grids, the axis runs top→bottom down the centre gap and the two
  camps sit on either side of it. Fill each camp's dots **by date along the axis** (outward from
  the centre), not randomly from the middle. Rationale: right now the fill "has aesthetic beauty
  but no information"; the time distribution (e.g. what happens around Oct 7, rising/falling
  protest periods) becomes readable, and on mobile there is more height to work with.
  Files: `page7.js` (grid + axis), `squareboundingbox.js` (`SBB_TIMELINE`, `CENTER_GAP`),
  `page8.js` (bridge glide targets), `js/page8-9-scroll.js`. Wiki: [Timeline](Timeline.md),
  [Folds](Folds.md). Check edge cases + whether the pattern reads as time-based.
- [ ] **A2. Axis events become full-width bars.** Once the axis is vertical the "axis events"
  (headline labels, `P7_AXIS_EVENTS`) may stop being ticks and become horizontal bands across
  the whole width, so the dots on both sides can be compared against each event directly.
  Explore, not mandated.
- [ ] **A3. Legend placement under the new layout.** With the camps flanking a centre axis the
  two-sided @legend may not have room — consider moving it to the top (the mobile מקרא bar
  approach was "a nice solution"). Could also be collapsible behind a button, but people
  distrust the data and want the legend visible, so if collapsed keep a small always-visible
  version. Wiki: [Groups-and-Legend](Groups-and-Legend.md).
- [ ] **A4. Timeline end date.** Data currently stops at ~June 2026 (ACLED export). Leave the
  copy "ועד היום" for now; a newsroom partner can refresh the data.

## B. @fold1 hero (`page-0`) 

- [x] **B1. Scroll indicator 🔴 📱🖥.** Non-expert user (Galia) tapped the dots and never
  scrolled. Add a subtle, delayed cue: after a timeout with no scroll, something very gentle
  pulses (a small arrow, or a hint on the dots/squares themselves, e.g. dots lifting/growing
  slightly). Applies to desktop too.
- [ ] **B2. Title/subtitle baseline 🟢.** The relationship between `.page0-title` and
  `.page0-subtitle` isn't clear in layout/baseline terms. Eyal wanted the sides to share a
  baseline but it collided with the dot column spacing. "Check it, not critical."

## C. Group names (`GROUPS`, `js/groups.js`) 🟡

- [x] **C1. Renamed "ארגוני שלום ודו קיום" → «ארגוני שמאל».** Reads as editorial approval
  ("you're selling me too well") — the other five are neutral/identity labels. Settled on the
  plain political-bloc label rather than either anti-occupation candidate, mirroring the
  right-side «קבוצות ימין לאומיות». The `actor` key stays `peace movements` (it is the xlsx's
  own `main_actor` string and is not display text).
- [x] **C2. Sharpened "ארגוני מחאה נגד הממשלה" → «מתנגדי הרפורמה ותומכי עסקת החטופים».** Too
  vague — every group here is "against the government". The new name spells out both strands it
  spans, the judicial-overhaul protests and the hostages movement, and reads as distinct from
  C1's «ארגוני שמאל». The `actor` key stays `protesters against government` (xlsx `main_actor`
  string, not display text). It is now by far the longest label in `GROUPS` — see the width
  note in the mobile `.group-label` block of `style.css`.
- Sync: renaming touches `GROUPS`, `FOLD6_SQUARE_LABELS` if any label references them, the
  @fold3 typed labels, and the wiki roster in CLAUDE.md + [Groups-and-Legend](Groups-and-Legend.md).

## D. Typography of the title cards (`.section-title`, `style.css:1316`) 🔴

- [x] **D1. Lighter weight + more leading.** Hadassah at faked 600 is "too heavy"; Galia skipped
  the ACLED card entirely because the box was big and uninviting. Agreed values:
  **`font-weight: 300`, `line-height: 1.5`** — for *all* title cards, not just the long one.
  Check whether a true Light face exists in `fonts/`; if not, decide between Regular (400) and a
  synthetic light. This edits the one shared base rule — keep the "no per-page overrides" rule.
  Wiki: [Architecture](Architecture.md).

## E. Split the ACLED card (@fold6, `page-5`) into two folds 🔴

- [x] **E1. New fold before the ACLED one:** "אספנו תיעודים של פעולות פוליטיות משני צדי המפה,
  מתחילת 2023 ועד היום." (the data-collection statement alone).
- [x] **E2. The ACLED/methodology fold:** short text on where the data comes from, with the
  ACLED link as a **visible external link** ("go check me" — most won't click, but it signals
  verifiability). Methodology should surface *earlier* than it does now; on mobile the ACLED
  note is hidden inside the מקרא bar, which is why Galia asked "how can we know this".
- Adding a fold shifts every `@foldN` after it → renumber [Folds](Folds.md), CLAUDE.md table,
  trigger names' comments, the fold badge in `js/nav.js`.

## F. @fold7 tooltip demo (`page-6`, `js/fold8-tooltip.js`) 🟡

- [x] **F1. Tooltip fires exactly when the card covers the squares** — they collide graphically.
  Fix options discussed (pick one, test): (a) fire earlier so the tooltip is already waiting
  before the card arrives; (b) split into two triggers — first just darkens square 0, then a
  second trigger slightly higher pops the tooltip; (c) move the bubble further from the squares. *(Done: (b), desktop trigger #2 is 400px above — `fold8TooltipTrigger`.)*
- [ ] **F2. Tooltip style 🟢.** Options: bubble in *negative* (fill = the group colour, white
  text) if it stays accessible; or drop the dashed border for a thin light-grey / translucent
  solid line. Eyal already tried solid and disliked it in the regular tooltip — revisit but
  not critical. Whatever is chosen must apply to *all* tooltips, not just the demo.

## G. Empty / dead-scroll states 🟡

- [x] **G1. Between-fold voids.** *(Desktop: `#page-1` card pulled up to 32vh, `fold2Trigger` crosses at 0.75.)* Mushon hit a state after @fold1 where "I don't know what's
  happening and there's no reason for me to be here". Whatever fold/trigger was late there
  should fire earlier so the user always sees a response to scrolling.
- [x] **G2. @fold10 bridge (`page-9`)** *(Desktop: `#page-9` is 60vh.)* shows a mostly empty screen ("70–80% blank"). Reduce the
  dead run before the card arrives.
- [ ] **G3. 📱 Hero → first bubble.** On mobile, "the moment I start scrolling, bring me the
  bubble" — the first card should already be waiting right there so even an accidental scroll
  teaches the mechanic. Also a trigger there fires wrong on mobile (Eyal: "that's a bug, I know
  why").

## H. @fold10 → @fold11 copy (`page-9`, `page-10`) 🔴

- [ ] **H1. Make the question stand alone.** "איפה עובר הגבול בעיניכם?" currently depends on
  the previous card ("…הגבול אינו תמיד מוסכם") and reads as "the border passes here". It's the
  key question and the interactive pivot of the whole piece — rewrite so it is self-contained
  and concrete, e.g. **"מתי פעולת מחאה הופכת לבלתי לגיטימית?"** / "מה הופך מחאה ציבורית ללא
  לגיטימית?".
- [ ] **H2. @fold10→@fold11 transition 🟢.** "A bit clumsy but livable." Idea: pills enter from
  the side and the previous text turns into the title (there is something nice in that).

## I. @fold11 drag-and-drop (`page-10`, `page9.js`)

- [ ] **I1. Click as well as drag 🔴 🖥.** Keep dragging, but a click on a pill should also
  classify it and run the move animation automatically. Support both.
- [ ] **I2. Three visual hierarchies look the same 🔴.** Storytelling text, data tooltips, and
  *system messages* (usage hints like «לחצו והחזיקו על נקודה להצגת פרטי האירוע») all look alike,
  so the eye filters the hint out ("the gorilla"). Give usage hints their own, lower, visual
  register — **no frame** around them (the frame disconnects them from what they refer to).
- [ ] **I3. Drop the redundant hint on @fold11.** The "press and hold a dot" hint was already
  taught on the timeline; at @fold11 it's out of context and competes with the pills. Either
  remove it, collapse it (X / auto-hide after the user has done it once), or move it directly
  under the dots it refers to. "It takes too much room, looks too similar — solve it."
- [ ] **I4. 📱 Tap-to-classify affordance.** The ⓘ button is so prominent that it's unclear the
  pill itself is a toggle. Replace with a subtle **checkbox** on each pill (shows ✓ when
  extreme), and change the instruction to «סמנו את סוגי הפעולה הנחשבות קיצוניות בעיניכם».
- [ ] **I4b. 📱 Feature discovery instead of ⓘ 🟢.** Mushon's alternative: open one category
  description by default when @fold11 arrives (with an X) so the user discovers that pills have
  descriptions; closing it can show a short message. Pair with I4 or pick one.
- [ ] **I5. 📱 Docked tooltip needs a close X**, and consider tap-to-dismiss. Galia was left
  with it open and got confused. Look at reference patterns for dismissable tooltips/coach
  marks rather than inventing one ("you didn't invent this — adopt something that works").
- [x] **I6. Accessibility check 🟡.** The «גררו סוגי פעולות…» subtitle looks too transparent —
  check contrast (done: `.page9-header-subtitle` 0.3 → 0.55 alpha). Run a general a11y pass (Mushon: "tell Claude to check what's happening
  here").
- [ ] **I7. "There's a bug that fires every second" 🟡** — something in @fold11 logs/loops
  each second; find and fix.
- [ ] **I9. 📱 User-test the press-and-hold loupe 🟡.** Galia managed it, but it blurred
  into scrolling for her. Run a few more people through this specific interaction before
  deciding how much of the hint (I3) can go.
- [ ] **I8. Position-lock tooltip while pills are open 🟢.** The tooltip staying in one place
  so you can move between dots — Mushon liked it ("elegant solution to a non-obvious problem").
  Keep; just make sure it doesn't add to the confusion in I2/I3.

## J. 📱 Mobile מקרא bar (`js/groups.js`, `fold6MobileLegendLayer`) 🟡

- [ ] **J1. On/off state unclear.** When opened it needs an **X**; consider making the whole
  box the toggle (the legend + "מקרא" title live inside one box that collapses), or a tab that
  is visibly attached to the panel, so open/closed reads as one object.

## K. Outro (@fold12, `page-11`, `page12.js`) 🔴

- [ ] **K1. A value statement before the methodology.** After the results, add one more
  authorial paragraph: the flip side of the opening — about political involvement and the
  limits of discourse and action; e.g. "in a period of radicalisation we are obligated to
  examine together what legitimate discourse is, which actions we accept" (perhaps
  enforcement too). Give the point without stating the obvious conclusion.
- [x] **K2. Bottom line + share.** After the chart the reader needs an easy landing: a short
  bottom-line summary → big **share buttons** → methodology → credits. *(Share row landed on the
  @fold12 card; the bottom-line summary belongs to a future, not-yet-created fold.)*
- [x] **K3. Credits.** Add credits, including Mushon (Eyal: "the first fix is your credit").
- [x] **K4. "ניכוס שטח" heading 🟢** is an odd title; the body text carries it. Reconsider. *(Decided: keep as is.)*

## L. Distribution (not code)

- Mushon will approach Shaul Amsterdamski (כאן) — they co-taught the ancestor of this course
  at Shenkar. Target a large outlet (כאן / ynet), not Haaretz; שקוף is a fallback. A partner
  may want their own font and can keep the data current. Eyal takes the weekend first.

---

## Suggested order

1. K3 credits (trivial, promised) · D1 typography · H1 copy · C1/C2 names
2. E split the ACLED fold (renumbering ripple — do before anything trigger-related)
3. B1 scroll cue · G1–G3 dead states · F1 tooltip timing
4. I1 click-to-classify · I2/I3 hint hierarchy · I4/I5/J1 mobile affordances · I6/I7
5. K1/K2 outro content
6. **A. Vertical timeline** — biggest, riskiest; touches page7/page8/page9 geometry. Do last, on
   its own branch, after the rest is stable.
