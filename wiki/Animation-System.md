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

`updateFold13` re-derives the cubic-out formula inline and applies it *on top of*
`fold13Trigger.currentT()` (already `p9Ease`'d). Two stacked easing passes, on purpose —
not a bug to flatten.

## Triggers

```js
const t = makeTrigger(durationMs, onTick, onSettle);
// → { currentRaw(), currentT(), trigger(target), set(value) }
const check = watchCardThreshold(cardEl, frac, t, instantReverse = false);
```

- `currentRaw()` is the linear 0..1 progress; `currentT()` is that through `p9Ease`.
- `watchCardThreshold` fires the trigger when `cardEl`'s top crosses `frac * innerHeight`
  — almost always `frac = 0.5`; bigger is earlier. `frac` may also be a **function**,
  re-read every check, for a fold that crosses at a different point per viewport (only
  `fold6Trigger` does, see `FOLD6_CARD_FRAC`). Deviations are listed in [Folds](Folds.md).
- **Reversal covers only the remaining distance.** Scrolling back up doesn't restart from
  0; it plays the same distance backwards from wherever it currently sits.
- **Instant-jump snap:** if at crossing time the card is **more than one viewport past
  its threshold** (an instant jump — iOS status-bar tap, Home key, anchor — not a real
  scroll, which always checks within a few px of the threshold), `watchCardThreshold`
  calls `trigger.set()` instead of `trigger.trigger()`, in **both directions**. Without
  this, a jump to the top played ~2s of fold-6/8 fixed overlays (open מקרא panel, demo
  tooltip, group labels un-typing) on top of the hero. The fold8 demo-tooltip sequence
  runs on wall-clock, so it mirrors the snap itself: in `fold8AdvanceSequence`, a
  one-tick `fold7LabelTrigger` raw drop of >0.5 down to ≤0 (impossible for an animated
  reverse, which moves ~0.01/frame) triggers an immediate `fold8ResetTooltip()`.
- `page7.js`/`page8.js` hand-roll the same shape locally (`p8CurrentT`/`p8StartPhase`,
  `p7MonthAnimStart`/`p7MonthReverseStart`) — they pre-date `makeTrigger`.
- `makeTrigger`'s own rAF loop **stops once a phase settles**. Anything that must keep
  running afterwards (the @fold6 tooltip sequence, page8's glide sync) needs its own
  loop — see `fold8SequenceTick` and `fold9EnsureP8SyncLoop`.
- Because several of these loops legitimately run at once and each calls the same
  globals, **`draw()` (js/core.js) and `updateGroups()` (js/update-groups.js) are
  coalesced to once per rAF frame**: the first call in a frame runs; any later
  same-frame call queues exactly one rerun on the next frame (so a state change made
  between the two calls still paints, one frame late at worst — never dropped). New
  loops may therefore call them freely without stacking duplicate per-frame work.
  Corollary: a loop must NOT write a style it has handed off to `updateGroups` and
  rely on its own synchronous `updateGroups()` call to overwrite it — that call may
  be deferred, letting the stale write win the frame (this is exactly how @fold1's
  entrance loop briefly broke the @fold2 dot shrink; it now stops writing a dot's
  transform once `popped`).

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

`FOLD2_BEATS` is expressed as fractions of `FOLD2_ENTRANCE_MS`; `FOLD3_BEAT_MS` is
expressed in absolute ms (tuned by eye with a `manual/` harness) and the trigger's total
is *derived* from whichever beat ends last, so there's never dead timeline hanging off
the end. Prefer the ms form for new work.

**Mirroring a beat** (playing a choreography backwards on a later fold) = mirror the
window inside the new trigger (`start → 1 - (start + len)`) and invert the progress.
@fold4's header un-typing reuses `FOLD2_BEATS` this way, so retiming the entrance
retimes the exit automatically.

## Duration tiers

**~1900 ms — the shared "legend tempo"** (`GROUP_TRANSITION_MS`). One deliberate tempo
so the legend system reads as one piece. Used by `fold3Trigger`, `fold6Trigger`,
`squaresRevealTrigger`, `fold7LabelTrigger`, `fold13Trigger`.

Named exceptions, each because the shared tempo read wrong for that specific beat:

| Constant | ms | Why |
|---|---|---|
| `FOLD2_ENTRANCE_MS` | 2400 | Multi-beat entrance |
| `FOLD3_ENTRANCE_MS` | derived (~1890) | From `FOLD3_BEAT_MS`'s last-ending beat |
| `FOLD8_GROW_MS` / `FOLD8_SQUARE_DIM_MS` | 350 | Tooltip grow-in; the dim finishes exactly as the tooltip reaches full scale |
| `FOLD8_TYPE_MS_PER_CHAR` | 15 | Typewriter, tuned snappy |
| `FOLD9_COLOR_MS` | 500 | A plain background-color swap read as sluggish at 1900 |
| `FOLD9_FLY_MS` | 1500 | Squares fly to their real dots |
| `FOLD9_TOOLTIP_SHRINK_MS` / `_DELAY_MS` | 400 / 500 | Hold, then shrink |
| `PAGE0_TITLE_MS` / `PAGE0_POP_MS` / `PAGE0_LOGO_FADE_MS` | 1700 / 280 / 900 | Cover entrance |

**Bigger canvas glides:** `P7_ANIM_TOTAL_DURATION` 2200 (one month's cascade),
`P7_POP_DURATION` 220 (one square), `P8_TRANSITION_DURATION` 3000 (full blend into
page9's grid), `P9_LINE_DURATION` 800, page9's dot migration (600 ms travel per dot plus
stagger; 2200/3400 ms reposition; flat 3000 ms back to legit) — see
[Drag-and-Drop](Drag-and-Drop.md).

**Deliberately un-eased/linear:** `HOVER_DIM_MS` 80 (page9's plain per-frame increment),
`P7_AXIS_EVENT_FADE_IN_MS`/`_OUT_MS` 400/1000, `P7_AXIS_INTRO_DURATION` 2800 — a wipe
reads as a wipe, not a moving object, so easing it looks wrong.

**Damped exponential lag** (not a trigger at all): `PAGE0_OPACITY_DAMPING` /
`PAGE0_SCROLL_LAG_DAMPING` 0.12 with `PAGE0_SCROLL_LAG_MAX_PX` 150, and
`P7_AXIS_FILL_LAG_DAMPING` 0.12. Same tempo on purpose so each pair reads as one motion.

## Stagger

Row- or dot-level delays layered on a shared timeline, never separate triggers:
`PAGE0_ROW_STAGGER_MS` 40, the legend's `ROW_STAGGER`, page7's per-month cascade
(`stagger = P7_ANIM_TOTAL_DURATION - P7_POP_DURATION`, mirrored in order on reverse), and
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
