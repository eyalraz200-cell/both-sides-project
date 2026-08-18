# Folds

`@foldN` is the canonical, 1-indexed on-screen numbering. **It is off by one from the
HTML id: `@foldN` = `id="page-(N-1)"`.** Verified against `project.html`'s sections and
`PAGES[]` in `js/core.js` — there are **11 folds** (`page-0` … `page-10`).

> Older notes (including CLAUDE.md's own table) describe 12 folds ending at `#page-11`.
> That is stale — the code has 11. This page is the source of truth.

## The table

| `@foldN` | id | `PAGES[]` draw fn | Title (Hebrew, truncated) | What plays |
|---|---|---|---|---|
| `@fold1` | `page-0` | `drawPage1` | קיצוניים משני הצדדים (cover) | Hero overlay (logo/title/subtitle) + the fixed dot columns; scroll-lag damping |
| `@fold2` | `page-1` | `drawBackground` | בשנים האחרונות התגבשו בישראל… | `fold2Trigger`, 4 beats: dots shrink → fly into the two 4×3 camp grids → each camp header types in |
| `@fold3` | `page-2` | `drawBackground` | בשני המחנות קיימות קבוצות… | `fold3Trigger`, 3 beats: filler rects shrink away → surviving rect per row flies into one column → group labels type in |
| `@fold4` | `page-3` | `drawFoldSplit` | בשל פעילותן בשטח… | `fold6Trigger`: the 6 groups glide into the persistent two-column mini-legend; the camp headers **un-type** (see below) |
| `@fold5` | `page-4` | `drawBackground` | אספנו תיעודים… (ACLED) | `squaresRevealTrigger`: 8 grey sample squares grow in at center + the ACLED source note fades in |
| `@fold6` | `page-5` | `drawFold7` | כל ריבוע מייצג פעולה פוליטית בשטח | `fold7LabelTrigger`: square labels appear; `fold8SquareDimTrigger` dims the rest while the fold-8 tooltip grows + types |
| `@fold7` | `page-6` | `drawFold9` | צבע הריבוע מציין את הקבוצה… | `fold9Trigger` colors square 0 + its tooltip border; `fold9FlyTrigger` colors all 8 and flies them to their real per-event dots |
| `@fold8` | `page-7` | `drawPage7` | *(no title — `page7-scrub`)* | The pinned real timeline — see [Timeline](Timeline.md) |
| `@fold9` | `page-8` | `drawPage8` | פעולות פוליטיות נבדלות זו מזו… | Bridge glide from timeline layout into page9's legit grid (`page8.js`) |
| `@fold10` | `page-9` | `drawPage9` | איפה עובר הגבול בעיניכם? | Drag-and-drop categorization — see [Drag-and-Drop](Drag-and-Drop.md) |
| `@fold11` | `page-10` | `drawPage12` | קיצוניים משני הצדדים (outro) | Scroll-gated outro card; `fold13Trigger`/`updateFold13` morph |

Symbol names (`fold6Trigger`, `drawFold7`, `page7TitleCardEl`…) carry **older, unrelated
numberings** and do not line up with `@foldN`. Don't infer a fold from a symbol name.

## Trigger → card wiring

Every fold trigger is armed by `watchCardThreshold(cardEl, frac, trigger)` — `frac` is
the fraction of viewport height the card's top must cross.

| Trigger | Card | `frac` |
|---|---|---|
| `fold2Trigger` | `#page-1 .text-card` | 0.5 |
| `fold3Trigger` | `#page-2 .text-card` | 0.5 |
| `fold6Trigger` | `#page-3 .text-card` | 0.5 |
| `squaresRevealTrigger` | `#page-4 .text-card` | 0.5 |
| `fold7LabelTrigger` | `#page-5 .text-card` | 0.5 |
| `fold8SquareDimTrigger` | `#page-5 .text-card` | 0.5 |
| `fold9Trigger` | `#page-6 .text-card` | 0.5 |
| `fold9FlyTrigger` | `#page-6 .text-card` | 0 (card fully offscreen) |
| `fold13Trigger` | `#page-10 .page12-sticky-center` | 0 |

## Notable per-fold details

**@fold2 — camp headers type in.** `FOLD2_BEATS` (js/groups.js) slices `FOLD2_ENTRANCE_MS`
(2400 ms) into `shrink` `{0, .198}`, `move` `{.073, .708}`, `headerCoalition`
`{.677, .219}`, `headerChange` `{.781, .219}`. The two headers have their **own** beats,
so one camp can start before the other.

**@fold4 — the headers un-type instead of traveling.** The mini-legend's two columns
carry no camp titles (explicit instruction). The headers stay exactly where @fold2 put
them and play their typing backwards: each header's `FOLD2_BEATS` window is *mirrored*
inside `fold6Trigger` (`start → 1-(start+len)`) and its progress inverted, so the camp
that typed in last disappears first. Retiming the entrance automatically retimes the
exit — there is no second pair of constants. Opacity only ramps over the beat's first
quarter (`Math.min(1, t*4, untype*4)`) so the first/last characters don't pop.

**@fold7 — the 8 squares fly to real dots, permanently.** `fold9FlyTrigger`
(`FOLD9_FLY_MS` 1500) colors each square by its own actor and flies it to the real
per-event dot it stands in for. The real cascade never draws its own dot for those 8
events (`p7GetClaimedEvents`), so the DOM square simply stays. The fly is independent of
`p7HasEngaged` — both fire off the same crossing. `draw()` runs unconditionally during
the fly so a fast scroll into `#page-7` doesn't strand it.
The tooltip holds `FOLD9_TOOLTIP_SHRINK_DELAY_MS` (500 ms) after square 0 lands, then
shrinks over `FOLD9_TOOLTIP_SHRINK_MS` (400 ms); reversing un-latches immediately and
cancels the pending timer.

