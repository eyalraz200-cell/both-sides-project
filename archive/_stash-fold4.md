# Stashed: the old @fold4 (split-into-3 fold)

Removed on request ("remove fold 4 — put it aside maybe I will use it later").
Everything needed to bring it back is here. Nothing in this file is loaded by
the site; it's a plain note.

When it existed, it sat between @fold3 (the group labels fading in) and @fold5
(the merge + mini-legend glide). Each of the 6 camp rects split into 3 stacked
dots in place — "each group contains a range of people" — and @fold5's entrance
merged them back before gliding into the mini-legend.

## project.html — the section (was `#page-3`, right after `#page-2`)

```html
      <section class="text-section" data-page="3" id="page-3">
        <div class="section-text text-card">
          <h2 class="section-title text-card-frame">כל אחת מהקבוצות כוללת בתוכה מגוון של אנשים, זרמים ודעות. לצורך ההשוואה, נתייחס לכל קבוצה כאל יחידה אחת.</h2>
        </div>
      </section>
```

Reinstating it means re-inserting this section and shifting every id/`data-page`
from there on back up by one (and the matching `currentPage` numbers in main.js /
page7.js / page8.js / page9.js, plus the `#page-N` selectors in style.css) — the
mirror of the removal diff. `PAGES` also carried `drawFoldNew3` at index 3:

```js
// Split fold (id #page-3) — just the split-dot animation, which runs entirely in
// DOM via updateGroups. Plain background only here.
function drawFoldNew3(ctx, W, H) {
  drawBackground(ctx, W, H);
}
```

## main.js — the trigger

```js
// @fold4 (#page-3) — the split-into-3 animation.
const pageNew3TitleCardEl = document.querySelector("#page-3 .text-card");

// New fold (@fold4, #page-3): dots split into 3 once, at the card's ordinary
// center crossing — same convention as every other fold trigger. The split no
// longer reverts on its own; it stays split for the rest of the fold and is
// merged back by @fold5's own entrance instead, so the dots read as "divide,
// then re-form right before spreading out."
const FOLD_NEW3_SPLIT_MS  = 700;
const SPLIT_DOT_SIZE      = 7;   // px — each of the 3 dots while split
const SPLIT_DOT_GAP       = 5;   // px — gap between stacked dots
const SPLIT_OFFSET        = SPLIT_DOT_SIZE + SPLIT_DOT_GAP; // center-to-center spacing
const foldNew3SplitTrigger  = makeTrigger(FOLD_NEW3_SPLIT_MS, updateGroups);
const checkFoldNew3Split  = watchCardThreshold(pageNew3TitleCardEl, 0.5, foldNew3SplitTrigger);
// ...and `checkFoldNew3Split();` first in checkGroupTriggers().
```

## main.js — the two satellite swatches (in the `groupItems` map)

```js
  // Two satellite swatches for the new-fold split animation — sit at top=0,
  // size=0 at rest; expand outward (above + below) as foldNew3SplitTrigger
  // fires. Same color as the main swatch.
  const satTop = document.createElement("span");
  satTop.className = "group-swatch-split";
  satTop.style.cssText = `background:${color};width:0;height:0;position:absolute;left:0;top:0`;
  const satBot = document.createElement("span");
  satBot.className = "group-swatch-split";
  satBot.style.cssText = `background:${color};width:0;height:0;position:absolute;left:0;top:0`;
  el.appendChild(swatch);
  el.appendChild(label);
  el.appendChild(satTop);
  el.appendChild(satBot);
  groupsOverlayEl.appendChild(el);
  return { el, label, swatch, satTop, satBot };
```

## main.js — `updateGroups`: @fold5's merge beat (replaced by a plain `const e6 = fold6Trigger.currentT();`)

```js
  // @fold5's entrance (fold6Trigger, its card's ordinary center crossing)
  // packs 2 sequential beats into one timeline, same raw/span-slicing
  // convention as @fold2's entrance below: (1) the @fold4 split merges back
  // into one rect, THEN (2) the rects glide into fold6's mini-legend.
  // Reversing (scrolling back up) runs both beats in reverse, last-to-first
  // — the rect re-splits only once it's back at its @fold4 column spot, not
  // immediately on scrolling up.
  const raw6 = fold6Trigger.currentRaw();
  const FOLD5_MERGE_SPAN = 0.18, FOLD5_GAP_SPAN = 0.12, FOLD5_GLIDE_SPAN = 0.7; // sums to 1
  const fold5MergeT = p9Ease(Math.max(0, Math.min(1, raw6 / FOLD5_MERGE_SPAN)));
  const e6 = p9Ease(Math.max(0, Math.min(1, (raw6 - FOLD5_MERGE_SPAN - FOLD5_GAP_SPAN) / FOLD5_GLIDE_SPAN)));
  const splitEased = foldNew3SplitTrigger.currentT() * (1 - fold5MergeT);
```

## main.js — `updateGroups`: the per-row swatch/satellite sizing (replaced by a plain swatchSize write)

```js
    // During the split the main swatch shrinks to SPLIT_DOT_SIZE. Offset its
    // top so its center stays at swatchSize/2 (= label center) rather than
    // drifting up toward 0 as it shrinks.
    const visualSwatchSize = swatchSize + (SPLIT_DOT_SIZE - swatchSize) * splitEased;
    item.swatch.style.width  = `${visualSwatchSize}px`;
    item.swatch.style.height = `${visualSwatchSize}px`;
    item.swatch.style.top    = `${(swatchSize - visualSwatchSize) / 2}px`;

    // Satellites: horizontal center on the swatch (left:0, width:visualSwatchSize),
    // vertical center on swatchSize/2 (= label center, = swatch center after the
    // top-offset above).
    const satPx = SPLIT_DOT_SIZE * splitEased;
    const satOffPx = SPLIT_OFFSET * splitEased;
    const swatchCy = swatchSize / 2;
    const satL = (visualSwatchSize - satPx) / 2;
    item.satTop.style.width  = `${satPx}px`;
    item.satTop.style.height = `${satPx}px`;
    item.satTop.style.left   = `${satL}px`;
    item.satTop.style.top    = `${swatchCy - satOffPx - satPx / 2}px`;
    item.satTop.style.opacity = String(popT);
    item.satBot.style.width  = `${satPx}px`;
    item.satBot.style.height = `${satPx}px`;
    item.satBot.style.left   = `${satL}px`;
    item.satBot.style.top    = `${swatchCy + satOffPx - satPx / 2}px`;
    item.satBot.style.opacity = String(popT);
```

## style.css — the satellite rule

```css
/* Satellite dots for the new-fold (@fold4) split animation — each starts at
   size 0, positioned at the main swatch's origin; JS expands them outward as
   foldNew3SplitTrigger fires. Inheriting position:absolute from .group-swatch
   is not needed since the inline style sets it; this class exists purely as a
   semantic hook and to ensure left:0 default matches the main swatch. */
.group-swatch-split {
  position: absolute;
  left: 0;
}
```

`page3.js` (the background-only stub `drawPage3`) is untouched and still loaded;
it now backs @fold3 rather than this fold.
