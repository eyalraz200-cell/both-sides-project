# Animation system

Almost nothing here is a live readout of scroll position. Nearly every fold animation is
a **fixed-duration 0↔1 phase fired once by a scroll-position crossing**, reversible
mid-flight.

## The two easing curves

Use one of these rather than inventing a curve.

| Curve | Formula | Where |
|---|---|---|
| `p9Ease` (`page9.js`) | `-(Math.cos(Math.PI*t) - 1) / 2` — sine in/out | **The default.** Every `makeTrigger` `currentT()`, the page0 entrance, page8's blend, page9's line reveal and dot migration |
| `p7Ease` (`page7.js`) | `1 - (1-t)**3` — cubic out | **Only** the timeline's per-event square pop in/out, and the year-axis intro wipe's clip. Deliberately punchier than `p9Ease` |

`updateFold13` (js/fold11.js) applies `p9Ease` a second time *on top of*
`fold13Trigger.currentT()` (already `p9Ease`'d). Two stacked easing passes, on purpose —
not a bug to flatten. The curve is the symmetric one so the reverse spread lands as gently
as the forward one.

## Triggers

```js
const t = makeTrigger(duration, onTick, onSettle);
// → { currentRaw(), currentT(), target(), trigger(target), set(value) }
const check = watchCardThreshold(cardEl, frac, t, instantReverse = false, gate = null);
```

- `duration` (ms) may also be a **function**, resolved per frame rather than captured, for a
  tempo tuned live by a harness (`fold8DemoGrowTrigger`).
- `currentRaw()` is the linear 0..1 progress; `currentT()` is that through `p9Ease`.
- `watchCardThreshold` fires the trigger when `cardEl`'s top crosses `frac * innerHeight`
  — bigger is earlier. `frac` may be a **function**, re-read every check, and every fold
  passes one: `foldFrac(key)` (js/groups.js) reads the per-breakpoint tables
  `FOLD_FRAC_DESKTOP` / `FOLD_FRAC_MOBILE` (0.75 everywhere, except mobile `fold4` 0.29).
  The one literal is `checkFold7Label`'s `0.5`. Deviations are listed in [Folds](Folds.md).
- `gate` (optional function) is an extra condition the crossing must **also** satisfy, so a
  phase can't start before an earlier one on the same card is done: @fold5's demo
  watchers (`checkFold7Label`, `checkFold8Tooltip`, `checkFold8SquareDim`,
  `checkFold8DemoGrow`, `checkFold7Cursor`) pass `fold5DemoGate`, which opens once the
  squares' grow-in (`SQUARES_GROW_SPAN` of `squaresRevealTrigger`) has finished.
- **Reversal covers only the remaining distance.** Scrolling back up doesn't restart from
  0; it plays the same distance backwards from wherever it currently sits.
- **Instant-jump snap:** if at crossing time the card is **more than one viewport past
  its threshold** (an instant jump — iOS status-bar tap, Home key, anchor — not a real
  scroll, which always checks within a few px of the threshold), `watchCardThreshold`
  calls `trigger.set()` instead of `trigger.trigger()`, in **both directions**. Without
  this, a jump to the top would play ~2s of @fold4/@fold5 fixed overlays (open מקרא panel,
  demo tooltip, group labels un-typing) on top of the hero. @fold5's demo-tooltip sequence
  runs on wall-clock, so it mirrors the snap itself: in `fold8AdvanceSequence`
  (js/fold8-tooltip.js), a one-tick `fold8TooltipTrigger.currentRaw()` drop of >0.5 down
  to ≤0 (impossible for an animated reverse, which moves ~0.01/frame) triggers an
  immediate `fold8ResetTooltip()`.
- `page7.js`/`page8.js` hand-roll the same shape locally — page8 with `p8CurrentT`/`p8StartPhase`;
  page7 per cascade month with `p7MonthPhase` (`monthKey → {fromC, toC, start}`), read by
  `p7MonthCursor(k)` (the month's cursor right now, linear on wall-clock; `undefined` = never
  reached), re-aimed by `p7MonthAim(k, toC)` (idempotent, starts from the current cursor) and
  dropped straight to rest by `p7MonthSettle(k, c)` (no animation — months landed on while
  scrolling backward).
- `makeTrigger`'s own rAF loop **stops once a phase settles**. Anything that must keep
  running afterwards (@fold5's demo-tooltip sequence, page8's glide sync) needs its own
  loop — see `fold8SequenceTick` and `fold9EnsureP8SyncLoop`.
- Because several of these loops legitimately run at once and each calls the same
  globals, **`draw()` (js/core.js) and `updateGroups()` (js/update-groups.js) are
  coalesced to once per rAF frame**: the first call in a frame runs; any later
  same-frame call queues exactly one rerun on the next frame (so a state change made
  between the two calls still paints, one frame late at worst — never dropped). New
  loops may therefore call them freely without stacking duplicate per-frame work.
  Corollary: a loop must NOT write a style it has handed off to `updateGroups` and
  rely on its own synchronous `updateGroups()` call to overwrite it — that call may
  be deferred, letting the stale write win the frame. Example: @fold1's entrance loop
  stops writing a dot's transform once that dot is `popped`, because from then on
  `updateGroups()`'s @fold2 shrink owns it.
- **Handing an element from a timed animation to a scroll-driven one needs a
  position handover.** @fold1's title/subtitle are driven by the page-load entrance
  (a timed slide from 100vh) until the first scroll, then permanently by
  `page0ApplyTitleScrollLag`, whose position is a pure function of scroll fraction.
  The two disagree about where the element is, so an unbridged switch would snap the
  title a full viewport in one frame. `page0BeginTitleHandover` (js/fold1-intro.js) records
  the px gap between the two at the switch instant into `page0HandoverTitlePx` /
  `page0HandoverSubtitlePx`, added to the driver's output and decayed by
  `PAGE0_SCROLL_LAG_DAMPING` per frame (snapped to 0 under 0.5px). Separate values
  per element: the parallax term pushes them opposite ways and the entrance adds the
  subtitle's 107px alignment offset. **Guard:** above scroll fraction 0.5 the handover
  is skipped and the switch snaps, on purpose — both positions are off-screen
  there (a reload restoring a scrolled position), so easing between them would drag
  the title back across the viewport.

## Beat windows

A fold that packs several visual beats into one trigger slices the trigger's **raw**
(linear) progress into `{start, len}` windows and re-applies `p9Ease` **fresh to each
local 0..1 slice**. Windows may overlap.

```js
const beatT = (b) => {
  const w = BEATS[b];
  return p9Ease(clamp01((raw - w.start) / w.len));
};
```

Never ease the whole span once and then carve it up: an already-eased curve's middle
third looks near-linear (steep) while its first/last thirds barely move, so the beats
visibly run at different speeds.

`FOLD2_BEATS` is expressed as fractions of the @fold2 entrance (`fold2EntranceMs()`);
`FOLD3_BEAT_MS_DESKTOP` / `FOLD3_BEAT_MS_MOBILE` are expressed in absolute ms (tuned by eye with a `manual/` harness) and the trigger's total
is *derived* from whichever beat ends last, so there's never dead timeline hanging off
the end. Prefer the ms form for new work.

**Mirroring a beat** (playing a choreography backwards on a later fold) = mirror the
window inside the new trigger (`start → 1 - (start + len)`) and invert the progress.
When the exit should instead stay locked to something else that moves, read that motion's
own progress: @fold4's camp headers un-type on the rows' flight (`fold6BeatT = () => e6Fly`,
js/update-groups.js), so they stay together in both directions and through a mid-flight
reversal.

## Duration tiers

**~1900 ms — the shared "legend tempo"** (`GROUP_TRANSITION_MS`). One deliberate tempo
so the legend system reads as one piece. Used by `fold7LabelTrigger` and
`FOLD6_MLEGEND_INTRO_TYPE_MS`. `fold13Trigger` (@fold13's spread) has its own `FOLD13_SPREAD_MS` (1150). `P7_AXIS_OUTRO_DURATION` is 800.

**@fold4, @fold5 and @fold6 own their durations**: `fold4GlideMs()` **1250 desktop / 1603 mobile** (`fold6Trigger`; mobile's is the SUM of its
hand-off phases, which js/groups.js cuts from it as shares — `FOLD6_MLEGEND_WIDTH_MS`
210 + `FOLD6_MLEGEND_OPEN_MS` 270 + `FOLD6_MFLY_HOLD_MS` 263 + `FOLD6_MFLY_MS` 860; a
clock shorter than that sum clamps the flight, `fold6MFlyLen`),
`fold5SquaresMs()` **1000** (`squaresRevealTrigger`; the visible grow-in is its first
`SQUARES_GROW_SPAN` = 550ms, and `fold5DemoGate` opens there), `FOLD5_TOOLTIP_MS` 1900
(`fold8TooltipTrigger`) and `FOLD8_NOTE_MS` 1900 (`acledNoteTrigger`).

**Per-breakpoint readers** (a `*_DESKTOP`/`*_MOBILE` `var` pair behind `isMobile()`;
mobile matches desktop, and the pairs exist so either side can be retuned alone): `page0TitleMs()` 1308,
`page0RowStaggerMs()` 31, `page0PopMs()` 215, `page0LogoFadeMs()` 692 (@fold1, ≈3200ms
in all), `fold2EntranceMs()` 1600, `fold3EntranceMs()` / `fold3Beats()` (derived from
`FOLD3_BEAT_MS_DESKTOP`/`_MOBILE` by `fold3BeatsRebuild()`, 1600), `fold4GlideMs()`,
`fold5SquaresMs()`. Also paired, mobile matched to desktop for now: `fold8TypeMsPerChar()` 9 (the demo tooltip's typewriter, js/fold8-tooltip.js), `p7AxisIntroDuration()` 1750 and `p7AxisIntroDotMs()` 300 (the year-axis wipe, page7.js). **Genuinely different:** `p7AnimTotalMs()` 1400 desktop / 550 mobile and `p7PopMs()` 140 / 40 (a month's cascade — the phone's was tuned faster on purpose). Every fold duration up to @fold8 is a
`var` read through a thunk (`makeTrigger(() => xMs(), …)` resolves per frame), so a
harness can drive it live.

Named exceptions, each because the shared tempo read wrong for that specific beat:

| Constant | ms | Why |
|---|---|---|
| `fold2EntranceMs()` | 1600 | Multi-beat entrance |
| `fold3EntranceMs()` | derived (1600) | From `FOLD3_BEAT_MS_*`'s last-ending beat |
| `FOLD8_GROW_MS` (js/fold8-tooltip.js) | 400 | Demo tooltip grows to full scale and holds before the typewriter starts |
| `FOLD8_SQUARE_DIM_MS` (js/groups.js) | 350 | Its own value: a quick singling-out of the demo square, not a legend beat; runs after the fake cursor's glide (`fold7CursorDelayMs()`) |
| `fold8TypeMsPerChar()` | 9 desktop / 9 mobile | Typewriter, tuned snappy |
| `FOLD9_COLOR_MS` | 500 | A plain background-color swap read as sluggish at 1900 |
| `fold9FlyMs()` — `FOLD9_FLY_MS` (mobile) / `FOLD9_FLY_MS_DESKTOP` | 1500 / 1200 | Squares fly to their real dots |
| `FOLD9_TOOLTIP_SHRINK_MS` / `_DELAY_MS` | 400 / 500 | Hold, then shrink |
| `page0TitleMs()` / `page0PopMs()` / `page0LogoFadeMs()` (js/fold1-intro.js) | 1308 / 215 / 692 | Cover entrance |
| `PAGE0_CHROME_FADE_MS` (js/fold1-intro.js) | 692 | Partner logo + language button fade in once the title has landed (`page0TitleMs()` in), both breakpoints; hidden at parse time so they never flash |

**Bigger canvas glides:** `p7AnimTotalMs()` 1400 desktop / 550 mobile (one cascade unit —
a row on the desktop vertical axis, a month on mobile; see [Timeline](Timeline.md)),
`p7PopMs()` 140 / 40 (one square), the @fold10 glide's two beats — `P8_SHRINK_MS` 1450 (desktop `P8_SHRINK_MS_DESKTOP` 1700)
(each square morphing down to the legit-grid size) and `P8_FLY_MS` 1450 (desktop `P8_FLY_MS_DESKTOP` 1700; its position
travelling to the legit cell), staged by `P8_STAGING` (`"together"` — both from 0, each
on its own ms, the shipped look; `"shrink-then-fly"`; `"fly-then-shrink"`) with
`p8ForwardMs()` the resulting full traverse and `p8Beats(t)` slicing the phase's **raw**
progress and re-easing each beat fresh; forward only — the reverse runs on
`P8_REVERSE_DURATION` 700 as one undivided traverse, because it fires while the reader is
already flicking back up @fold8's scrub, and a longer reverse leaves a crushed
page9-blend band on the canvas several folds away, `P9_LINE_DURATION` 800, page9's dot migration (600 ms travel per dot plus
stagger; 2200/3400 ms reposition; flat 3000 ms back to legit) — see
[Drag-and-Drop](Drag-and-Drop.md).

**Deliberately un-eased/linear:** `HOVER_DIM_MS` 80 (page9's plain per-frame increment),
`P7_AXIS_EVENT_FADE_IN_MS`/`_OUT_MS` 400/1000, `p7AxisIntroDuration()` 1750 — a wipe
reads as a wipe, not a moving object, so easing it looks wrong.

**Damped exponential lag** (not a trigger at all): `PAGE0_OPACITY_DAMPING` /
`PAGE0_SCROLL_LAG_DAMPING` 0.12 with `PAGE0_SCROLL_LAG_MAX_PX` 150, and
`p7AxisFillLagDamping()` (`P7_AXIS_FILL_LAG_DAMPING_DESKTOP` / `_MOBILE`) 0.5 desktop / 0.12 mobile. Mobile shares the tempo on purpose so each pair reads as one motion.

## Stagger

Row- or dot-level delays layered on a shared timeline, never separate triggers:
`page0RowStaggerMs()` 31, the legend's `ROW_STAGGER`, page7's per-month cascade
(`stagger = p7AnimTotalMs() - p7PopMs()`, mirrored in order on reverse), and
page9's `ARRIVAL_STAGGER_MS` — sqrt-scaled against `ANCHOR_COUNT` so a small category's
handful of dots don't snap in next to the anchor category's visible cascade.

## Project-wide rules

**"Secondary attribute can snap, position never does."** x/y always animates continuously
on one of the two curves; color, opacity and label visibility are free to move on their
own independent trigger/timing when that reads better.

**CSS-transition tier** — reserved for pure DOM state flips, not continuous scroll-driven
motion: `0.15s` drop-zone hover, `0.2s ease-out` legend overlay reveal, `0.35s ease-out`
page9 stuck-state fades, `0.5s`/`0.7s ease-out` engage fades, and one bespoke
`0.85s cubic-bezier(0.22, 1, 0.36, 1)` for the page9 tray slide-in. The flip side:
elements JS already repaints every frame with a continuous value (`.fold6-square`,
`.fold6-square-label`) deliberately have **no** CSS transition — one would lag behind or
double up with the JS motion.

## Reduced motion

`prefersReducedMotion()` (`js/core.js`) reads a live `MediaQueryList`, so flipping the OS
setting mid-session takes effect on the next beat. Consumers:

- **`makeTrigger`'s `currentRaw()`** (`js/groups.js`) returns `toT` immediately when it's
  true, so the beat lands on its end state on the first frame. Same `onTick`/`onSettle`,
  same order — a fold reached with reduced motion on is in exactly the state it would have
  animated to. It returns early rather than dividing by a 0 duration: `runLoop()` is called
  synchronously from `trigger()`, where `performance.now() - phaseStart` can still be 0, and
  `0/0` is `NaN`, which never equals `toT` — the rAF loop would never settle.
- **`page0CueSchedule`** (`js/fold1-intro.js`) skips the intro scroll cue.
- **`fold6MLegendLeave`** (`js/groups.js`) runs the mobile מקרא's leave over 0ms instead
  of `FOLD6_MLEGEND_LEAVE_MS`.
- **`fold12GhostFlashLevel`** (`js/page8-9-scroll.js`) holds @fold12's ghost steady
  instead of flashing it.
- **`p9TrainToggle`** (`page9.js`) just flips the `engaged` class, skipping mobile's
  animated pill train.
- **`playPage0Entrance`** (`js/fold1-intro.js`) jumps @fold1's entrance to its last frame;
  **`page0LagDamping()` / `page0OpacityDamping()`** return 1, so the hero title sits exactly
  where the scroll puts it instead of trailing it.
- **`p7SizeGridSet`** (`page7.js`) forces `instant` — @fold9's size morph and @fold10's
  size-down land at once.
- **`p7FilterToggle`** and its restore (`page7.js`) leave `p7FilterMorph` null — the legend
  filter's shrink-and-fly lands re-packed; **`p9FilterSnapshot`** (`page9.js`) skips @fold12's
  re-pack flight the same way.
- **`p8CurrentT`** (`page8.js`) returns the phase's target — the @fold10→@fold11 bridge glide
  lands at once both ways; **`setActivePage`** (`js/nav.js`) skips `p7EntryAnim`, the reverse
  glide's continuation onto the timeline.

The CSS half is the blanket `@media (prefers-reduced-motion: reduce)` block in `style.css`,
which collapses every transition/animation to `0.01ms` with `animation-iteration-count: 1`.
Near-zero rather than `none` so `transitionend`/`animationend` still fire and the end state
still lands. It's safe to apply that broadly only because of the rule above — JS-repainted
elements carry no CSS transition to fight with.

**Rule:** time-based autoplay snaps; motion whose position *is* the scroll position stays.

**Deliberately NOT reduced:** @fold8's scrubbed timeline *is* the scroll position — the
content, not decoration around it, and freezing it would leave nothing to read. Nor
page9.js's finalized state-1 drop/migration animation on @fold12 (`p9.anim` set inside the
drop commit) — finalized, so it still plays.

## Dots never fade

A dot — any per-event square, on any fold — enters and leaves by **size**: it grows
from nothing or shrinks to nothing. Never animate a dot's opacity to hide, remove,
filter or reveal it. Opacity is for text, cards, rules and labels. (The @fold8
legend filter is the reference case: filtered-out dots shrink to zero, they do not
fade — see [Timeline](Timeline.md#the-legend-filter-fold8-both-breakpoints--p7filtertoggle-page7js).)
