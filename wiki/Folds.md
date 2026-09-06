# Folds

`@foldN` is the canonical, 1-indexed on-screen numbering. **It is off by one from the
HTML id: `@foldN` = `id="page-(N-1)"`.** Verified against `project.html`'s sections and
`PAGES[]` in `js/core.js` — there are **14 folds** (`page-0` … `page-13`), matching the
14 entries in `PAGES[]` and the 14 `.text-section`s in `project.html`.

> Older notes describe 11, 12 or 13 folds. All are stale — the code has 14, ending at
> `#page-13`. This page is the source of truth.

## The table

| `@foldN` | id | `PAGES[]` draw fn | Title (Hebrew, truncated) | What plays |
|---|---|---|---|---|
| `@fold1` | `page-0` | `drawPage1` | קיצוניים משני הצדדים (cover) | Hero overlay (logo/title/subtitle) + the fixed dot columns; scroll-lag damping. **Idle scroll cue:** 2s after the entrance finishes with no scroll, the dot columns (decorative dots + the six group swatches) pulse in a wave from the top row down to the bottom (`page0CueRun`, js/fold1-intro.js). The pulse **shrinks** each dot rather than growing it — trough scale 0.3 (a 7px dot to ≈2.1px), 940ms per dot, 22.5ms per row, so ≈42 rows are mid-pulse at once and the wave is a broad swell rather than a thin band (all three tuned by eye on a `manual/` harness, 2026-09-06). Repeats every 3s; the first scroll/wheel/touchmove cancels it for good and restores the at-rest transforms. Skipped under `prefers-reduced-motion` |
| `@fold2` | `page-1` | `drawBackground` | בשנים האחרונות התגבשו בישראל… | `fold2Trigger`, 4 beats: dots shrink → fly into the two 4×3 camp grids → each camp header types in |
| `@fold3` | `page-2` | `drawBackground` | בשני המחנות קיימות קבוצות… | `fold3Trigger`, 3 beats: filler rects shrink away → surviving rect per row flies into one column → group labels type in |
| `@fold4` | `page-3` | `drawFoldSplit` | בשל פעילותן בשטח… | `fold6Trigger`: the 6 groups glide into the persistent two-column mini-legend; the camp headers **un-type** (see below). On desktop the group labels un-type once the glide has landed (`fold6LabelUntypeTrigger`, chained off `onSettle`), leaving bare swatches — hovering either legend column types them all back in (`fold6LabelHoverTrigger`) |
| `@fold5` | `page-4` | `drawBackground` | אספנו תיעודים… | `squaresRevealTrigger`: 8 grey sample squares grow in at center |
| `@fold6` | `page-5` | `drawBackground` | הנתונים לקוחים מגוף המחקר… (ACLED, with a visible external link in the card) | `acledNoteTrigger`: the title «איסוף הנתונים» and then the ACLED source note **type in** character by character as one continuous stream (`FOLD6_NOTE_BEATS`), with a **vertical hairline** down the block's right edge growing and shrinking with it, then **un-type from the end** on @fold7's crossing (`fold6NoteUntypeTrigger`, desktop only; the title and the rule stay, hovering the legend or the note itself types the body back) under the mini-legend (on mobile: inside the מקרא panel) |
| `@fold7` | `page-6` | `drawFold7` | כל ריבוע מייצג פעולה פוליטית בשטח | Two crossings on desktop: at 0.5 `fold7LabelTrigger` types the square labels in and `fold8SquareDimTrigger` dims the 7 non-demo squares (square 0 stands out); then `fold8TooltipTrigger` grows + types the demo tooltip, once the card's bottom has cleared the tooltip's own top edge plus `FOLD8_TOOLTIP_CLEARANCE_PX` (30px) (**mobile:** the tooltip is a docked frame above the timeline instead — see [Timeline](Timeline.md#hover)) |
| `@fold8` | `page-7` | `drawFold9` | צבע הריבוע מציין את הקבוצה… | `fold9Trigger` colors square 0 + its tooltip (desktop: the fill; mobile: the dashed border); `fold9FlyTrigger` colors all 8 and flies them to their real per-event dots — the 4 earliest events per side, pinned by row id (`FOLD6_SQUARE_ROW_IDS`, see [Groups-and-Legend](Groups-and-Legend.md#the-8-sample-squares)). **Desktop:** the demo callout swings from hanging above square 0 to hanging below it (`.is-flipped`) as that square travels, so it is angled down when it lands on the timeline — driven by `fold8FlyMoveT`, square 0's beat-2 progress, **not** by `fold9FlyTrigger` as a whole (whose first `FOLD9_FLY_RESIZE_SPAN` is color+resize, before the square has moved) |
| `@fold9` | `page-8` | `drawPage7` | *(no title — `page7-scrub`)* | The pinned real timeline — desktop: vertical centre axis, rows are dates; mobile: horizontal bottom axis — see [Timeline](Timeline.md) |
| `@fold10` | `page-9` | `drawPage8` | פעולות פוליטיות נבדלות זו מזו במטרה, באמצעים ובאופן הפעולה. אבל הגבול בין פעולה לגיטימית לפעולה קיצונית אינו תמיד מוסכם. | Bridge glide from timeline layout into page9's legit grid (`page8.js`). Card sits at the section top (`padding-top: 48px`); the section is the house **100vh** on desktop (`@media (min-width:601px) #page-9`), so @fold11's title card only enters the viewport once the bridge card has left — the two title blocks never share the screen. **Don't trim it below 100vh** (60vh was tried: both cards parked on screen together) |
| `@fold11` | `page-10` | `drawPage9` | מה נחשב בעיניכם לפעולה לגיטימית, ומה לפעולה קיצונית? | Headline is forced to **one line** at ≥640px (`.page9-title-row .text-card` `width: max-content` + `white-space: nowrap` on the frame, style.css) — it wraps at the 480px `--card-w`; under 640px it wraps as normal. Drag-and-drop categorization. **Desktop section is 150vh, not the house 200vh** (`.page9-title-row` 50vh, sticky still 100vh): the panel engages when the title card sticks and the @fold12 gate is one viewport before `#page-11`, so the 100vh row left ~55vh of pinned, motionless panel before the closing card could rise; the card now sticks ~17vh in and the gate is at 50vh — see [Drag-and-Drop](Drag-and-Drop.md). Desktop runs **layout V2** (`P9_LAYOUT_V2`): bare pill band on top (its pills **pop in right → left** on `.engaged`, the band's rule drawing under them in step), horizontal drop zone under it, pills classified by **drag or click**, legit dots denser in a 150px bottom strip — see [Drag-and-Drop](Drag-and-Drop.md#desktop-layout-v2) |
| `@fold12` | `page-11` | `drawPage12` | בתקופה של מחלוקות עמוקות, חשוב שנסתכל מעבר למטרות הפוליטיות של שני המחנות, אלא גם על האמצעים להשגתן: אילו פעולות אנחנו מוכנים לקבל במרחב הציבורי, ואילו פעולות חוצות את הגבול. | The closing statement — **this**, not the credits card, is what @fold11's interaction resolves into. It owns the scroll gate (`p13GateLocked`/`p13GateMax`, unlocked once one @dragcard is extreme; **`let p13TouchBlockOn` must stay declared above the eager `p13SyncGateVisibility()` call** — below it, that call hits the `let` in its temporal dead zone, the throw kills the rest of js/fold11.js, and the wheel/keydown/scroll listeners never register, so the gate silently does nothing and @fold13/@fold14 can be reached with no pill dropped) and **both halves of the hand-off, run back to back across its card's rise**. First the scroll-linked fade-out (`fold13ScrollT`): tray, header, extreme zone, legend, ACLED note, legit dots and counts all fade — but the **extreme dots stay standing in their columns, and the camp dividing line stays with them** (it's what those columns sit on; the line rides `fold13ExtremeMorphT`, not `fold13OutT` — see `page9.js`). That fade is compressed into the **first half** of the rise by `FOLD13_FADE_SPAN` (0.5, js/fold11.js), so it is finished by the time the card reaches mid-screen. Then, at exactly that point, `checkFold13` fires the **freeform spread** onto an otherwise-clear screen (`fold13Trigger`, frac 0.5 on this fold's own wrapper). `FOLD13_FADE_SPAN` and that frac are **one decision in two files** — raise the span and the fade runs under the spread. The section is **45vh** (every width) and its `.page12-sticky-center` is overridden to `position: static` (style.css): the card rises a full viewport to rest flush at the top, and @fold13's share card trails 45vh under its top like a footnote (the share section is 80vh so the outro still starts 125vh after `#page-11`). **@fold12 waits directly under @fold11, with no empty run between them, at every width.** The card is pulled flush to the section top (`align-items: flex-start` + `padding-top: 0`). That zero is load-bearing: the gate holds scroll at `#page-11.offsetTop - 100vh` and can't move later (any later and the section is on screen while still locked), so only a card at the very top of its section has its first pixel at the viewport's bottom edge at the exact scroll position the gate unlocks. **Any `padding-top` here re-opens the gap by its own height** — an earlier 25vh did exactly that, and the symptom is easy to misread, because @fold11's own panel is `.frozen` (pinned at top) through the hand-off: with the card still below the fold, the only thing happening for that stretch is an opacity crossfade on a motionless panel. **The fade IS the card's rise:** `fold13ScrollT` measures from the moment the card's top clears the viewport's bottom edge (now the gate line itself) to the moment it reaches its resting spot (`scrollY = #page-11.offsetTop`, flush at the viewport top), and runs on **`p9Ease`** (sine in-out), which finishes at `t=1`, exactly where the card lands. The outro card (@fold14, then directly after this one) is near-full-height, so at the house 100vh it was already climbing into view while this card sat mid-screen. **The two changes are a pair** — extra height under a *sticky* wrapper is hold time, not spacing (a 200vh sticky attempt read as the card being stuck dead centre). None of the scroll machinery cares: `p13GateMax`, `fold13ScrollT` and the `.frozen` threshold all measure `#page-11`'s `offsetTop`, and nothing needs this wrapper to pin any more (`checkFold13` moved off the outro's). An ordinary `.section-title.text-card-frame` title block, wrapped in `.page12-sticky-center` only because `page12StickyEl` — the `gate-hidden` toggle (`p13SyncGateVisibility`) — hangs off that wrapper |
| `@fold13` | `page-12` | `drawPage12` | שתפו | The share block as its own title block (moved out of the outro card on 2026-09-06). An **80vh**, top-aligned `.text-section` (`align-items: flex-start`, no padding — the card sits 45vh under @fold12's card top, and the outro starts 125vh after `#page-11` as before) with a plain `.text-card-frame` card (`.page12-share-card`, rtl, centred): the «שתפו» `.section-title` (the shared 20px/16px rule, no override) over the button row `.page12-share` (`#page12Share`: WhatsApp / X / Facebook intent links + copy-link, wired by `p12ShareInit` in page12.js; centred flex row, 8px gap, 16px under the title; **no hairline** — the row is the card's only content). **No trigger** — `drawPage12` keeps painting the spread extreme dots behind it |
| `@fold14` | `page-13` | `drawPage12` | קיצוניים משני הצדדים (outro) | Outro/credits card. **No trigger of its own** — the freeform spread and the camp divider's fade both fire back on @fold12 (`checkFold13` watches `#page-11`'s wrapper), so the dots have already spread by the time this card rises. Under the methodology the card carries a four-line credits paragraph (`.page12-credits`: research/design, mentor, Shenkar thanks, data — the data line links out as `acleddata.com`; one `<br>` per line; centred, 14px/1.5, 0.04em tracking, 70% black, under a hairline divider). **The hairline sits in the middle of its gap** — a 38px gap split 19px above the line (`margin-top`) and 19px below it (`padding-top`). The card already fills a 900px-tall viewport, so `@media (max-height: 920px)` also trims that spacing (9px/9px — still centred). The share row used to sit above the credits with a matching hairline; it is @fold13 now |

Symbol names (`fold6Trigger`, `drawFold7`, `page7TitleCardEl`…) carry **older, unrelated
numberings** and do not line up with `@foldN`. Don't infer a fold from a symbol name.

## Trigger → card wiring

Every fold trigger is armed by `watchCardThreshold(cardEl, frac, trigger)` — `frac` is
the fraction of viewport height the card's top must cross. A **bigger** `frac` is an
**earlier** crossing. `frac` may be a function, re-read on every check, for a fold whose
crossing point differs by viewport.

| Trigger | Card | `frac` |
|---|---|---|
| `fold2Trigger` | `#page-1 .text-card` | **0.5** (`FOLD2_CARD_FRAC`, same on mobile). On desktop `#page-1`'s card is pulled up to `padding-top: 10vh` AND the section is shortened to `min-height: 67vh` by the same ~33vh the card moved (style.css), so the card enters while the hero title is still leaving while the @fold2→@fold3 distance stays exactly the house rhythm; every other fold keeps the shared 100vh centered section. Don't reintroduce: pulling MORE cards up (only relocates the gap to the next centered fold) or shrinking sections below 100vh (two title cards end up on screen together — one card alone needs a gap ≥ 100vh, i.e. section ≥ 100vh + card). |
| `fold3Trigger` | `#page-2 .text-card` | **0.6 on mobile** (`FOLD3_CARD_FRAC`), 0.5 desktop |
| `fold6Trigger` | `#page-3 .text-card` | **0.7 on mobile** (`FOLD6_CARD_FRAC`, nudged later from 0.8 per explicit instruction), 0.5 desktop |
| `squaresRevealTrigger` | `#page-4 .text-card` | 0.5 |
| `acledNoteTrigger` | `#page-5 .text-card` (both viewports; on mobile this crossing also reopens the מקרא panel, `fold6MLegendAutoBeat`) | 0.5 |
| `fold7LabelTrigger` | `#page-6 .text-card` | 0.5 |
| `fold8SquareDimTrigger` | `#page-6 .text-card` | 0.5 — @fold7 trigger #1: only dims the 7 non-demo squares so square 0 stands out |
| `fold8TooltipTrigger` | `#page-6 .text-card` | **desktop: measured, `fold8TooltipCardFrac()`** — fires when the card's *bottom* has risen `FOLD8_TOOLTIP_CLEARANCE_PX` (30px) above the top edge of where the demo tooltip will appear. That top is derived live from square 0's rect the same way `fold8PositionTooltip` derives it (centre − 5px gap − the box's height), and the box's height is measured off a hidden offscreen clone carrying the demo event's real text (`fold8MeasureTooltipHeight`, cached, invalidated on resize). Clamped to frac ≥ 0. Falls back to the old `0.5 − FOLD8_TOOLTIP_ABOVE_PX/vh` (400px) only before events.json has loaded or if the square isn't built. 0.5 mobile. @fold7 trigger #2 — the tooltip demo used to share the labels' crossing and collided with the card |
| `fold9Trigger` | `#page-7 .text-card` | 0.5 |
| `fold9FlyTrigger` | `#page-7 .text-card` | 0 (card fully offscreen) |
| `fold13Trigger` | `#page-11 .page12-sticky-center` (@fold12's own wrapper) | **0.5** — the halfway point of the closing card's rise (frac 1 = its top at the viewport bottom, 0 = at the top), i.e. the moment it reaches mid-screen. Kept in lockstep with `FOLD13_FADE_SPAN` (js/fold11.js), which ends the fade there so the spread lands on a clear screen. Watched on **@fold12**, not @fold13 — the spread is the closing statement's flourish. Never use frac 0 on the outro's wrapper (@fold14): it is the last section and exactly one viewport tall, so its top only reaches 0 at the document's final scrollable pixel and the morph effectively never played. |

## Notable per-fold details

**@fold2 — camp headers type in.** `FOLD2_BEATS` (js/groups.js) slices `FOLD2_ENTRANCE_MS`
(2400 ms) into `shrink` `{0, .198}`, `move` `{.073, .708}`, `headerCoalition`
`{.677, .219}`, `headerChange` `{.781, .219}`. The two headers have their **own** beats,
so one camp can start before the other.

**@fold4 — the headers un-type instead of traveling (both viewports; on mobile the camp
names reappear as static headings inside the מקרא panel — see
[Groups-and-Legend](Groups-and-Legend.md#the-mobile-מקרא-bar)).** The mini-legend's two columns
carry no camp titles (explicit instruction). The headers stay exactly where @fold2 put
them and play their typing backwards: each header's `FOLD2_BEATS` window is *mirrored*
inside `fold6Trigger` (`start → 1-(start+len)`) and its progress inverted, so the camp
that typed in last disappears first. Retiming the entrance automatically retimes the
exit — there is no second pair of constants. Opacity only ramps over the beat's first
quarter (`Math.min(1, t*4, untype*4)`) so the first/last characters don't pop.

**@fold8 — the 8 squares fly to real dots, permanently.** `fold9FlyTrigger`
(`FOLD9_FLY_MS` 1500) colors each square by its own actor and flies it to the real
per-event dot it stands in for. The real cascade never draws its own dot for those 8
events (`p7GetClaimedEvents`), so the DOM square simply stays. The fly is independent of
`p7HasEngaged` — both fire off the same crossing. `draw()` runs unconditionally during
the fly so a fast scroll into `#page-8` doesn't strand it.
The tooltip holds `FOLD9_TOOLTIP_SHRINK_DELAY_MS` (500 ms) after square 0 lands, then
shrinks over `FOLD9_TOOLTIP_SHRINK_MS` (400 ms); reversing un-latches immediately and
cancels the pending timer.


## Mobile status

The 600px breakpoint and what it changes are documented in
[Architecture](Architecture.md#mobile--responsive). Per-fold state:

| Fold | Mobile |
|---|---|
| `@fold1` | ✅ Hero is center-relative already; the logo inset was tightened, the title capped/shrunk to 32px, and the whole hero (title, subtitle **and** both dot columns) pulled down by `PAGE0_MOBILE_DROP` = 1 dot step = 17px — `page0DotBaseOffsetY()` in `page1.js` plus the two `top:` overrides in `style.css`'s ≤600px block. All three must move together or the pixel-measured title→column / subtitle→column gaps break |
| `@fold2`–`@fold4` | ✅ Camp gap is a fixed 90px between the blocks' facing edges (`campCenterGapPx`); labels shrink + wrap to two lines, matching the Figma mobile frame. Wrapped labels forced @fold3 onto its own measured row steps (`fold3RowStep` — equal visible gaps, whatever each label's line count) — see [Architecture](Architecture.md#mobile--responsive). At `@fold4` the six rows **and both camp headers fly into the open מקרא panel**, reshaping to its swatch/type/one-line labels on the way, and the panel's own rows take over in a single frame as they land (a swap, not a cross-fade — the landing is pixel-exact) (`window.FOLD4_FLY`, default on; setting it `false` from the console gets the older hand-off, where the rows don't travel at all — swatch shrinks in place, label un-types on mirrored `@fold3` windows) — the headers land on the panel's own camp headings, leaving only the מקרא button (with `FOLD4_FLY` off they un-type like desktop instead) |
| `@fold6`–`@fold8` | ✅ Fractional `SBB` geometry; tooltips clamped to the viewport. **There is no on-canvas mini-legend** — it, the camp names and the ACLED note all collapse into the מקרא bar pinned to the top of the viewport — a chevron-less card in the desktop ACLED note's style that opens width-first, height-second like that note. `@fold4`'s hand-off **leaves it open**, `@fold5` **closes it** (its grey squares are the subject; an open panel covers them) and `@fold6` **opens it again** to add the ACLED note into it (`fold6MLegendAutoBeat`; see the trigger table's mobile note on `acledNoteTrigger`); see [Groups-and-Legend](Groups-and-Legend.md#the-mobile-מקרא-bar) |
| `@fold9`–`@fold10` | ✅ Camps stay mirrored side-by-side; the dot size is **solved per viewport** (`p7SolveMobileSq`) — the largest square whose grid still holds the bigger camp, ~1.35 at 320×568 up to ~2.4 at 600 wide — inside a box whose top/bottom are px clearances off the docked tooltip and the year axis (`sbbTimeline(H)`). Axis margin, type sizes and label wrapping have mobile values; the hover layer is **off** on mobile, replaced by the **event picker** — a press-and-hold anywhere on the chart opens a loupe you drag over the dots, prompted by a hint line in the docked frame (`p7InspectInit`). See [Timeline](Timeline.md#mobile). `page9.js` is 1.5px on mobile, so page8's bridge lerp usually *shrinks* dots across the glide (the solved ~1.35–2.4 → 1.5) rather than growing them as it does on desktop — on the narrowest phones, where the solve lands under 1.5, it grows them slightly instead |
| `@fold11` | ✅ **Tap to classify** — no dragging on mobile. A pill never leaves the tray: tapping toggles `.is-extreme` on it (filled black) and commits the same state change dragging would, so the FINALIZED "state 1" drop animation is reached untouched. `#page9ZoneAbove` and the drag handle are `display:none`; in the handle's place each pill grows a 14px **ⓘ button** that opens the category description (`#page9CatTooltip`) — the touch stand-in for the desktop pill hover, handled in the capture phase so it informs without classifying. Geometry swaps under `p9Metrics()`/`p9MidY()`/`p9ExtremeTopY()`: dot 1px, extreme pitch 2px, and the legit half is currently a **desktop-style spread strip** (`P9_LEGIT_SPREAD_M`, 54px tall, free shuffled 1px dots on a finer 1.5px pitch — under review); the Figma 290-409 **4px bar per camp** (solid, groups as contiguous colour segments, shrinking from its outer end) sits behind that flag — see [Drag-and-Drop](Drag-and-Drop.md#the-legit-bar). The count labels draw as the **bare number only** (no "אירועים"), and the tooltip→grid clearance reserves a label line's worth of room (`P9_COUNT_LABEL_ROOM_M` 20, inside `p9ExtremeTopY`) so even a full-height column leaves the line its own band under the docked frame; the divider stroke draws at `p9MidY` like desktop. Hover is off, replaced by the same press-and-hold loupe as `@fold9`. See [Drag-and-Drop](Drag-and-Drop.md#mobile) |
| `@fold12` | ✅ Short title card. Its wrapper is `position: static` at every width (the desktop `#page-11` override; the mobile `#page-13` override doesn't reach it), so it reads the same on a phone, dead-scroll trim included: 45vh section, card flush to its top, and the fixed מקרא bar + docked event frame that occupy that top edge are on `fold13ScrollT`'s fade, so they are gone by the time the card lands there. |
| `@fold13` | ✅ Plain title block; the share buttons wrap to a second line inside the card as needed. |
| `@fold14` | ✅ Outro card width + title size clamped; body copy 14px/1.55 and the sticky wrapper goes `position: static` with `min-height: 100vh` — the methodology text is taller than a phone viewport, so mobile scrolls the card instead of pinning and clipping it. That override is scoped `#page-13 .page12-sticky-center` on purpose — @fold12 shares the class and must not grow. |

### @fold11's tray on mobile

Under the breakpoint (`style.css`) the tray is **not a bottom sheet** — Figma node 294-1272
pins it as a full-bleed **band directly under the title card** (`top: 116px`, `bottom: auto`),
so @fold11's mobile stack reads top-to-bottom as **legend → title → pill band → docked tooltip
frame → dot grid → legit bar**. The band goes full-bleed (`width`/`max-width: 100vw`,
overriding the base rule's `width: max-content`), carries a rule on its **bottom edge only**
(`1px solid rgba(90, 90, 90, 0.18)` — nothing divides it from the subtitle above, which reads as
one header block with it), and hides by
sliding **up** off the top edge
(`translate(-50%, calc(-100% - 116px))` — its own height plus the 116px offset).
`116` is mirrored by `P9_TRAY_TOP_M` in `page9.js`, which derives both the tooltip's drop spot
and the grid's top from it, and by `js/fold11.js`'s slide-out; change one and you change all
three. Its padding is a tightened
`8px 0 10px` with a 10px gap (Figma's `23px 0 24px`/14 read too airy on device), and
`.page9-tray-title` ("סוגי פעולות") is **`display: none`** — the node has no label on the band,
the subtitle above already naming the gesture. It's hidden rather than dropped from
`p9BuildPanel` so desktop, which still shows it, keeps one code path.

**The title and subtitle are flushed right in the stuck state**, not centered (same node) —
but the flush is the *pinned* look, not the card's look. While the block is still scrolling
up it is an ordinary centered title like every other fold's, and it travels to the edge only
once it pins at the top, alongside the border fade. Everything below is scoped to
`.page9-title-row` and to the ≤600px query; desktop and every other fold stay centered
throughout.

`text-align` can't do the flush — `.text-card` already inherits `text-align: right`, and what
centers the title is the *box*: `.text-card-frame` is `width: fit-content; margin: 0 auto`.
Releasing that auto margin (`margin-inline: 0 auto`) would flush it, but **`auto` is not an
animatable value**, so the box could only snap sideways the frame `.is-stuck` lands. Instead
the frame stays centered and `.is-stuck` applies `transform: translateX(var(--p9-title-flush))`,
which joins the existing 0.35s transition and glides.

`--p9-title-flush` is written by **`page9UpdateTitleFlush`** (`js/page8-9-scroll.js`), called
from `page9UpdateFromScroll` just before the class toggle: half the slack between the card's
`clientWidth` and the frame's own zero-padding width. It needs JS because the frame is
`fit-content` — the distance depends on how the title happened to wrap at this viewport.
It measures **only while unstuck**: the value is needed before the class lands, and the
padding is mid-transition for 0.35s afterwards. Subtracting the *live computed*
`paddingInlineStart` rather than a hard-coded 29 keeps the reading self-consistent at any
point of that transition, so a reverse crossing can't poison it either.

The frame's 29px side padding is still zeroed in `.is-stuck` on top of the shift — that's the
state Figma shows and the one where the dashed border has faded — so the text ends up ~15px
off the glass rather than 53.

The subtitle sits under it on `margin-top: -16px`, against the base rule's `-21px` (which cancels
the frame's bottom padding outright and leaves the two line boxes overlapping by 3px — desktop
keeps that). The **title→subtitle gap is specified at 2px**, and the margin is derived from it:
the frame contributes `16px padding-block + 2px border` below the title's line box, so
`18 + margin = 2` → `-16px`. Change the spec, change this to `gap - 18`. It's a line-box
measurement — optically, title descender to the subtitle's cap height, it reads ~9px larger.

The pill run is **one pill tall and scrolls horizontally** (Figma node 293-947). Both
`.page9-tray-row` wrappers become `display: contents`, so all 10 pills are hoisted into
`#page9ZoneBelow` — flipped from the base rule's flex *column* to a single `flex-wrap: nowrap`
row with `overflow-x: auto` — and form one continuous run that overflows both screen edges.
The document is RTL, so the run starts scrolled to its right end: the first pill sits at the
right edge and the rest continue off to the left. The scrollbar is hidden
(`scrollbar-width: none` + `::-webkit-scrollbar`); the pill cut off at the edge is the
affordance. `.page9-pill` needs `flex-shrink: 0` + `white-space: nowrap` or flex squeezes the
run to fit and the labels wrap to two lines.

Because nothing has to fit the viewport any more, the pill is its Figma size (node 294-1279):
16px Assistant SemiBold, `padding: 8px 10px`, 6px gap — the height comes from
`line-height: 12px`, reproducing Figma's cap-height text-box trim, so 16px glyphs paint outside
their line box. It carries **no `box-shadow` in any state** — the base rule's rest/hover/
`.dragging` lifts are all zeroed under the breakpoint (all three selectors repeated, since
`.page9-tray .page9-pill:hover` outranks a bare `.page9-pill`): the node is a flat chip, hover
has no meaning on touch, and dragging is replaced by tap. The tray's own side padding is **0** so the run reaches the glass; the end
inset lives on `#page9ZoneBelow` instead, inside the scroller, so it scrolls with the content.
That inset is **logical and asymmetric**: `padding-inline: calc((100vw - min(480px, 100vw - 48px)) / 2) 12px`.
In an RTL document `start` is the right edge — the end the run rests at, and the only pill edge
the reader sees at rest — so it's set to the title card's own gutter, putting the first pill
exactly under the flush-right title. The gutter is re-derived from `--card-w`'s own `min()`
rather than hard-coded as 24, because between 528px and 600px the card stops growing and the
gutter widens. The far (left) end keeps a plain 12px; it scrolls off screen.

Two knock-on values in that stack:

- **`--card-top` is `60px` under the breakpoint** (base: `4.4vh`, `style.css:22`). At 4.4vh
  the pinned title card crowded the מקרא bar; 60 puts an 8px gap between the collapsed מקרא
  card's bottom edge (52px: top 16 + ~20px title row + 2×8px card outset) and the card box
  (explicit instruction; the tray band sits the same distance down — `P9_TRAY_TOP_M` 116).
  It's flat px because the
  thing being cleared is itself fixed-px. The gap the eye actually reads is not `60 − 52`: once
  the card sticks its frame is transparent, so the measurement is bar-bottom to the first line
  of title *ink*, a further 2px border + 16px `padding-block` down — ≈22px.
  `page9UpdateFromScroll` no longer hard-codes the old
  `0.044` — it reads `getComputedStyle(page9TitleCardEl).top` back off the card, so the
  stick threshold follows the variable at either breakpoint and the card can't jump as it sticks.
  The card's natural top is computed exactly from the title row's measured box
  (`rowTop + (rowH − cardH)/2`), **never** approximated as `innerHeight * 0.5`: `innerHeight`
  is the *visual* viewport while the row is `100vh` (the large viewport), and on mobile the
  two disagree by the browser-bar height exactly while scrolling up (bars showing) — the
  approximation released `.is-stuck` ~100px before CSS sticky let go, pinning the
  white-filled dashed frame at the top of @fold11 in its un-stuck styling.
- **The extreme grid's rows are clipped at `midY`, not `H - 16`** (`drawBandedCols`, `page9.js`).
  On desktop the two are equivalent; on mobile `midY` is `H` minus the 4px legit bar, so the old
  floor culled the bottom rows and opened a ~12px gap between the dot columns and the bar they
  should rest on.

Dissolving the wrappers drops `P9_TRAY_GRID`'s hand-tuned slots entirely — order falls back to
plain DOM order (row 1's five, then row 2's five), and each pill's inline `grid-column` is
inert in a flex container. `p9MeasureTrayLayout` writes `""` for `gridTemplateColumns` and the
row `height` on mobile — cleared, not merely skipped, so crossing the breakpoint on a resize
can't strand a desktop track list. Desktop is untouched (the tray still measures 828×198 at
1440px).

With the tray at the top, the legit bar sits **flush with the viewport's bottom edge**
(`gridTopY` = `H - p9LegitBarH(W)`) and `p9MidY` is simply `H - p9LegitBarH(W)` — nothing is
below it any more.

**The docked tooltip frame moves to make room.** The band lands in the upper part of the
screen, where the frame has to end up on this fold, so a third dock spot was added (the
@fold8/@fold9 rest is at the *bottom* of the viewport — `tooltipDockRestPx()`, see
[Timeline](Timeline.md) — so this is a move **up** and then down onto the band):
`p9DockTopM()` = `P9_TRAY_TOP_M + p9TrayH() + P9_TRAY_TOOLTIP_GAP_M` (20) — measured off the
live band, so the frame stays glued to it however the pills size. It runs on
`p9TooltipDropTrigger` (`js/groups.js`, 850ms, matching `.page9-tray`'s own slide), fired one
fold **early** — from `page8CheckScroll`'s @fold10 title crossing (`js/page8-9-scroll.js`),
the same crossing that drives `p8Trigger`/`p8TriggerReverse` — so the frame is already out of
the way before the band slides in, one move at a time instead of two at once. It's set on
every tick rather than only on the crossing (`trigger()` early-returns at rest, so that's
free), which also resolves it on the first tick and keeps it latched while scrolled past. It
blends into
`tooltipDockTopPx` via `tooltipDockDropPx` so all three spots stay one continuous lerp. It's a
trigger and not a CSS `transition: top` because that `top` is already rewritten every frame by
the @fold7→@fold8 dock lerp, which a transition would smear.

`p9ExtremeTopY` then trails the frame: `p9DockTopM() + P9_TOOLTIP_COLLAPSED_H (100) + 16` — the frame's **collapsed**
height, so tapping "עוד" overlays the grid instead of shoving it down.

The category tooltip (the ⓘ popover) flips **below** its pill whenever there's no room above
— which at the top of the screen is always — with `.is-below` moving its arrow to the box's
top edge.

On @fold12's exit (`js/fold11.js`) the tray does not slide out — it fades in place with
every other fold element (inline opacity over `fold13ScrollT`, same as the header, zone,
legend and title card), on both breakpoints. The mobile מקרא bar fades with them too —
its layer (`fold6MobileLegendLayerEl`) sits outside `groupsOverlayEl`, so `js/fold11.js`
writes the same opacity onto it by name. The shared `#page9Tooltip` (`fold8TooltipEl`)
gets the same treatment — on mobile it's the docked event frame, which otherwise sat
fully visible while everything around it faded. Because two other writers also set that
element's inline opacity, every writer multiplies in `1 - p9.fold13OutT`: the sequence
rAF's grow-in opacity (`js/fold8-tooltip.js`), `updateGroups`' show branch
(`js/update-groups.js`), and the mobile picker's `sync()`/`showEvent()` (page7.js) —
`sync()` in particular runs on every redraw/scroll while `currentPage` is still 9, so
its unconditional `"1"` fought the fade every frame (visible stutter). Without the
shared factor any one of them stomps the fade back to full opacity between scroll
ticks and the frame snaps/stutters instead of fading. The frame's
`keepEmptyFrame` lifetime bound (`js/update-groups.js`) is `currentPage <= 11`, not 9:
the IntersectionObserver flips `currentPage` to 10 partway through @fold12's scroll-in,
and a 9 bound made `forceHide` reset the frame (`display:none`) at that flip point
mid-fade — the fold11 scroll fade owns the frame's exit instead.

The extreme dots' freeform spread (`drawPage12`/`p12EnsureFreeformTargets`, page12.js)
draws at `p9Metrics().SQ` and, on mobile, spreads at `p9Metrics().CELL` — the same size
and pitch the dots had in @fold11's extreme grid (1.5px on 2px there); desktop keeps its
original `P7_CELL` spread pitch with 3px dots.

Hover-only affordances (the @fold10 square dim, the axis hover states) simply never activate
on touch. That's safe — they convey no information that isn't otherwise available. The one
that *did* carry unique information, the timeline's per-event tooltip, now has a touch
equivalent: the mobile event picker on `@fold9` (see
[Timeline](Timeline.md#the-mobile-event-picker)).
