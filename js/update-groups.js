function updateGroups() {
  const W = canvas.clientWidth, H = canvas.clientHeight;
  // @fold4's entrance (fold6Trigger, its card's ordinary center crossing) —
  // a single beat now: the rects glide straight into fold6's mini-legend.
  // It used to open with a merge beat, undoing the split-into-3 that the
  // removed @fold4 played (see _stash-fold3.md); with nothing left to merge,
  // the whole trigger is just the glide.
  const e6 = fold6Trigger.currentT();
  // @fold3 (#page-2): 3 beats on fold3Trigger's one timeline — shrink the
  // fillers, fly the survivors into one vertical column per camp, type the
  // labels (see FOLD3_BEATS). Same {start,len} window model as @fold2's, and
  // the same raw-slice-then-re-ease convention: carve currentRaw() (linear)
  // into windows and apply p9Ease fresh to each local 0..1, never ease once
  // and then slice.
  const fold3Raw = fold3Trigger.currentRaw();
  const fold3BeatRaw = b =>
    Math.max(0, Math.min(1, (fold3Raw - FOLD3_BEATS[b].start) / FOLD3_BEATS[b].len));
  const fillerShrinkT = p9Ease(fold3BeatRaw("shrink"));
  const alignT        = p9Ease(fold3BeatRaw("align"));
  const typeBaseRaw   = fold3BeatRaw("type");

  // @fold2's whole entrance is 3 sequential beats sharing fold2Trigger's one
  // timeline, not 3 things happening at once — per explicit spec:
  // (1) the decorative dots shrink away, (2) THEN the 6 group dots fly/grow
  // into their two camp columns (top row first), (3) THEN the camp headers
  // + divider fade in. The move beat (2) is the busiest (grow + fly, all
  // rows) so it gets the biggest share of FOLD2_ENTRANCE_MS rather than an
  // equal third; reversing (scrolling back up) runs the same 3 beats in
  // reverse, last-to-first.
  //
  // Sliced from currentRaw() (linear), not currentT() (already eased over
  // the FULL 0..1 span) — easing an already-eased curve's middle third looks
  // close to linear (steep) while its first/last thirds look like they
  // barely move, so the 3 beats would visibly run at 3 different speeds.
  // Every sub-slice below (this one and each row's own stagger window
  // further down) re-applies p9Ease fresh to its own local 0..1 span
  // instead, so every beat gets the same gentle ease-in-out shape — the same
  // animation style as every other trigger in this file.
  const raw2 = fold2Trigger.currentRaw();
  // Each beat is its own {start, len} window on the trigger's raw timeline
  // rather than a share of a strictly sequential split, so beats are free to
  // overlap (the headers currently type ALONGSIDE the flight, per explicit
  // instruction) — see FOLD2_BEATS.
  const fold2BeatRaw = b =>
    Math.max(0, Math.min(1, (raw2 - FOLD2_BEATS[b].start) / FOLD2_BEATS[b].len));
  const SHRINK_SPAN = FOLD2_BEATS.shrink.len;
  const MOVE_SPAN   = FOLD2_BEATS.move.len;
  const shrinkT          = p9Ease(fold2BeatRaw("shrink"));
  const moveBaseRaw      = fold2BeatRaw("move");
  const headerCoalitionT = p9Ease(fold2BeatRaw("headerCoalition"));
  const headerChangeT    = p9Ease(fold2BeatRaw("headerChange"));

  // @fold1's decorative (non-group) dots shrink to nothing, staying exactly
  // where they are — the first of the 3 beats above. Skips any dot whose
  // own page-load entrance pop (playPage0Entrance) hasn't happened yet —
  // this runs continuously from page init onward, well before that, and
  // would otherwise stomp the entrance's scale(0) hidden state with
  // decorScale's at-rest value (1) before the user ever sees the pop-in.
  // — except the 18 picked out as @fold2's filler rects (assignFold2Fillers
  // above), which fly into the camp grids instead; they're driven separately
  // after the main GROUPS loop below.
  const decorScale = 1 - shrinkT;
  PAGE0_DECORATIVE_DOT_ELS.forEach(({ el, popped, isFold2Filler }) => {
    if (popped && !isFold2Filler) el.style.transform = `scale(${decorScale})`;
  });

  // Measured live off the real (fixed-width) note element rather than a
  // hidden scaffold — its height only ever changes on a font swap/width
  // edit, both already covered by layoutGroups() re-running this function,
  // so re-reading it every tick costs nothing and can never go stale.
  const fold6NoteHeightPx = fold6NoteEl.offsetHeight;
  const fold6NoteBlockGapPx = FOLD6_DIVIDER_GAP_TOP + FOLD6_DIVIDER_HEIGHT + FOLD6_DIVIDER_GAP_BOTTOM;
  const fold6NoteShiftPx = (fold6NoteBlockGapPx + fold6NoteHeightPx) / 2;

  // Divider fits the note's own rendered text, not its 150px wrap container
  // — the container is just a wrap width, and the note's wrapped lines don't
  // actually reach its full 150px (greedy word-wrap breaks short of the
  // edge), so sizing off the container left the hairline visibly wider than
  // the text under it. A Range over the note's text node gives one rect per
  // wrapped line (standard trick for measuring wrap results without
  // reimplementing word-wrap by hand); take the widest of those. Read live
  // off the real element each tick, same reasoning as fold6NoteHeightPx above.
  const fold6NoteRange = document.createRange();
  fold6NoteRange.selectNodeContents(fold6NoteEl);
  const fold6NoteLineWidths = Array.from(fold6NoteRange.getClientRects(), r => r.width);
  const fold6NoteMaxLineWidth = Math.max(...fold6NoteLineWidths);
  fold6NoteDividerEl.style.width = `${fold6NoteMaxLineWidth}px`;

  // Beat 2 staggers the rows top-to-bottom within its own slice of the
  // timeline, same makeTrigger-style "reaches target exactly at local t=1"
  // convention as every other staggered stage in this file. Row index is the
  // group's own fold4 column row (both camp columns share the same 3 rows).
  const FOLD4_ROW_YS = [...new Set(GROUPS.map((g) => g.fold4.y))].sort((a, b) => a - b);
  const ROW_STAGGER = 0.05;
  const ROW_SPAN = 1 - ROW_STAGGER * (FOLD4_ROW_YS.length - 1);

  // The two camp grids' geometry (see the @fold2 grid block by
  // FOLD2_CAMP_CENTER_GAP_PX above), computed ahead of the main loop below so
  // the group items, the filler rects and the headers all key off one source.
  // Only the block CENTERS are frame-independent px offsets from screen
  // center; the top row's vertical anchor is still frame-scaled like every
  // other coordinate here, with the 2nd/3rd rows stepped off it in
  // plain px so the grid stays square at any viewport height.
  const fold2TopRowY = (FOLD4_ROW_YS[0] / GROUPS_FRAME_H) * H;
  const fold2RowY = rowIdx => fold2TopRowY + rowIdx * FOLD2_ROW_PITCH_PX;
  const fold2BlockW = (FOLD2_GRID_COLS - 1) * FOLD2_COL_PITCH_PX + CLUSTER_SWATCH_SIZE;
  // Each camp's anchor — screen center ± FOLD2_CAMP_CENTER_GAP_PX. Its camp
  // title sits centered on it, and BOTH fold layouts are centered on it too:
  // @fold2's 4×3 block (below) and @fold3's aligned rect-plus-label column
  // (campFold3X). So the title never moves between the two folds, and the
  // rects read as centered under it in both.
  const campAnchorX = isCoalition =>
    W / 2 + (isCoalition ? FOLD2_CAMP_CENTER_GAP_PX : -FOLD2_CAMP_CENTER_GAP_PX);
  // Left edge of each block's leftmost cell.
  const changeBlockX    = campAnchorX(false) - fold2BlockW / 2;
  const coalitionBlockX = campAnchorX(true)  - fold2BlockW / 2;
  // @fold3's rect x, per camp: the rect's label trails CLUSTER_LABEL_GAP to
  // its left, so the pair spans [x - gap - labelW, x + swatch] and centering
  // that midpoint on the anchor puts the rect RIGHT of it by half the label
  // run. Not a grid column any more — the labels are what has to look
  // centered under the title at @fold3, not the (by then vanished) cells.
  // labelW is the camp's WIDEST label, so all 3 rows share one rect column.
  const campFold3X = (rows) => {
    const labelW = Math.max(...rows.map(groupLabelWidth));
    return campAnchorX(rows === FOLD4_COALITION_ROWS)
      + (CLUSTER_LABEL_GAP + labelW - CLUSTER_SWATCH_SIZE) / 2;
  };
  const fold2CellX = (isCoalition, col) =>
    (isCoalition ? coalitionBlockX : changeBlockX) + col * FOLD2_COL_PITCH_PX;
  // Each group's own rect sits at its scattered FOLD2_GROUP_CELL cell — the
  // one it flies OUT of at @fold3, into that camp's aligned column.
  const fold2GroupX = i =>
    fold2CellX(FOLD4_COALITION_ROWS.includes(GROUPS[i]), FOLD2_GROUP_CELL[i].col);
  // @fold3's aligned column is ordered by the mini-legend's own top-to-bottom
  // order (each group's fold6.y within its camp), NOT by @fold2's scattered
  // cells — so the order the labels type in is already the order they'll hold
  // for the rest of the page, and @fold5's glide into the mini-legend never
  // has to reshuffle the rows past each other.
  const legendRow = (g) => {
    const camp = FOLD4_COALITION_ROWS.includes(g) ? FOLD4_COALITION_ROWS : FOLD4_CHANGE_ROWS;
    return camp.slice().sort((a, b) => a.fold6.y - b.fold6.y).indexOf(g);
  };

  GROUPS.forEach((g, i) => {
    const item = groupItems[i];
    // Row this group's rect occupies in @fold2's scattered grid — also the
    // stagger key, so both blocks fill top-to-bottom in sync rather than one
    // block after the other.
    const rowIdx = FOLD2_GROUP_CELL[i].row;
    const moveT = p9Ease(Math.max(0, Math.min(1, (moveBaseRaw - rowIdx * ROW_STAGGER) / ROW_SPAN)));

    // The camp grids don't use each group's own (now-unused) fold4.x as the
    // swatch anchor — x comes from the grid geometry above (block center ±
    // FOLD2_CAMP_CENTER_GAP_PX from screen center, plus this group's own
    // FOLD2_GROUP_CELL cell), so the two camps stay symmetric at any viewport
    // width. Labels trail left off the swatch in both camps (swatchFirst).
    const isCoalitionRow = FOLD4_COALITION_ROWS.includes(g);
    const fold4Pos = { x: fold2GroupX(i), y: fold2RowY(rowIdx) };

    // @fold2's entrance originates from wherever this group's own dot landed
    // in @fold1's dot columns (PAGE0_GROUP_DOT_ANCHORS, page1.js), flying
    // straight into its camp-column spot on moveT (beat 2 above). Falls back
    // to the column spot itself (a no-op lerp) if this group had no matching
    // dot this load (very short viewports can run out of dots before all
    // groups get one).
    const anchor = PAGE0_GROUP_DOT_ANCHORS[g.color] || { left: fold4Pos.x - W / 2, top: fold4Pos.y };
    const fold1X = W / 2 + anchor.left, fold1Y = anchor.top;

    let x = fold1X + (fold4Pos.x - fold1X) * moveT;
    let y = fold1Y + (fold4Pos.y - fold1Y) * moveT;

    // @fold3's 2nd beat: each group's rect flies out of its scattered @fold2
    // cell into its own row of the camp's aligned column (campFold3X, placed
    // so rect + label read centered under the camp title), so a camp's 3
    // rects end up on one vertical line, one per row — both blocks read RTL,
    // so the typed label trails left off that line. Both axes
    // move here, not just x — the @fold2 scatter is deliberately not one rect
    // per row. Chained onto x/y above (not a separate target) so it composes
    // with @fold2's flight and @fold5's glide like every other stage here.
    const fold3Row = legendRow(g);
    const fold3X = campFold3X(isCoalitionRow ? FOLD4_COALITION_ROWS : FOLD4_CHANGE_ROWS);
    const fold3Y = fold2RowY(fold3Row);
    x += (fold3X - x) * alignT;
    y += (fold3Y - y) * alignT;

    // Swatch starts at the real @fold1 dot's own 7px size (PAGE0_DOT_SQ) and
    // grows to the column's 13px (CLUSTER_SWATCH_SIZE) over the same moveT
    // as the position fly-in above.
    let swatchSize = PAGE0_DOT_SQ + (CLUSTER_SWATCH_SIZE - PAGE0_DOT_SQ) * moveT, labelGap = CLUSTER_LABEL_GAP;
    const isRightLegend = g.fold6 && isCoalitionRow;
    if (g.fold6) {
      // Shifted up by half the note's own (gap + height) so the rows+note
      // block stays centered on the same vertical anchor the 5 rows alone
      // used to occupy, instead of the note just tacking on below them and
      // reading off-center. Baked into the lerp target itself (not applied
      // as a separate post-hoc offset) so it eases in with the same e6 as
      // everything else, rather than popping once the rows finish settling.
      // Coalition/right-wing rows mirror to the RIGHT edge; change/left-wing
      // rows keep the same left inset. Both columns share the same rows (y).
      const fold6X = isRightLegend
        ? (W - FOLD6_LEGEND_INSET_RIGHT - LEFT_LEGEND_SWATCH_SIZE)
        : FOLD6_LEGEND_INSET_LEFT;
      const fold6Pos = { x: fold6X, y: fold6RowY(g, H, fold6NoteShiftPx) };
      x += (fold6Pos.x - x) * e6; y += (fold6Pos.y - y) * e6;
      swatchSize += (LEFT_LEGEND_SWATCH_SIZE - CLUSTER_SWATCH_SIZE) * e6;
      labelGap   += (LEFT_LEGEND_LABEL_GAP - CLUSTER_LABEL_GAP) * e6;
    }

    item.el.style.left = `${x}px`;
    item.el.style.top  = `${y}px`;

    // Swatch eases in (page0PopT, set by playPage0Entrance) once the @fold1
    // page-load entrance reaches this row — it's standing in for a real
    // @fold1 dot at rest, so once popped it should look identical to that
    // dot until it actually starts flying at @fold2. The label is @fold3's
    // own beat (labelT, fold3Trigger above).
    const popT = page0PopT[i];
    item.swatch.style.opacity = String(popT);
    // @fold3's labels TYPE in rather than fading (see typedText above) — full
    // opacity from the first character, the reveal is the text itself. They
    // cascade top row → bottom row inside the shared `type` beat (both camps'
    // same-height rows type together), each row re-eased over its own local
    // 0..1 so every row runs at the same speed.
    const typeSlots = fold3TypeSlotCount(FOLD4_ROW_YS.length);
    const typeSpan = 1 - FOLD3_TYPE_ROW_STAGGER * (typeSlots - 1);
    const typeSlot = fold3TypeSlot(fold3Row, isCoalitionRow, FOLD4_ROW_YS.length);
    const labelT = p9Ease(Math.max(0, Math.min(1,
      (typeBaseRaw - typeSlot * FOLD3_TYPE_ROW_STAGGER) / typeSpan)));
    item.label.textContent = typedText(g.label, labelT);
    item.label.style.opacity = String(popT);

    item.swatch.style.width  = `${swatchSize}px`;
    item.swatch.style.height = `${swatchSize}px`;
    item.swatch.style.top    = "0px";
    // Label's vertical anchor must track the swatch's own shrinking center
    // (13px cluster -> 6px mini-legend, same e6 lerp as swatchSize above) —
    // a fixed CSS top would stay centered on the swatch's *original* size
    // and drift off-center as the swatch shrinks.
    // ...plus the optical correction for the line box's unused descent (see
    // groupLabelInkShift above), so the swatch reads centered on the text
    // itself rather than on its taller-than-the-ink line box.
    const labelFontSize = g.fold6 && raw2 >= FOLD2_BEATS.move.start + MOVE_SPAN
      ? 18 + (14 - 18) * e6 : 18;
    item.label.style.top = `${swatchSize / 2 + groupLabelInkShift(labelFontSize)}px`;

    // fontSize/color have a meaningful in-between so they lerp continuously
    // over e6 — 18px/opaque-black is is-emphasized's resting state, so e6=0
    // reproduces the pre-fold6 look with no seam. Weight stays regular (400).
    const postFold2 = raw2 >= FOLD2_BEATS.move.start + MOVE_SPAN;
    const postFold6 = !!g.fold6 && fold6Trigger.currentRaw() >= 0.5;
    if (g.fold6 && postFold2) {
      item.label.style.fontSize   = `${18 + (14 - 18) * e6}px`;
      item.label.style.fontWeight = "400";
      item.label.style.color      = `rgba(0, 0, 0, ${1 + (0.85 - 1) * e6})`;
    } else {
      item.label.style.fontSize   = "";
      item.label.style.fontWeight = "";
      item.label.style.color      = "";
    }

    // Which side the label sits on is just another continuous lerp now too —
    // sideT 0 is the columns' universal "label trails the swatch" layout, 1
    // is "label leads, swatch trails", chained through fold6's mini-legend
    // layout (e6) — same chaining as x/y above — instead of snapping at the
    // postFold6 threshold. Both endpoints are expressed as the label's own
    // `left` (reading its actual rendered width, since the swatch-first
    // endpoint has no explicit width to anchor from) so it glides across the
    // swatch instead of teleporting to the other side.
    // Per Figma 277:1507 the camp columns (folds 2-3) use RTL reading order —
    // swatch at the right, label trailing left — so sideT is 0 for all of
    // them. From @fold4 on, only the LEFT-edge half of the mini-legend (the
    // change rows) mirrors: at the screen's left edge the swatch reads better
    // outboard with its label to the right of it, while the right-edge
    // coalition rows keep the swatch outboard on their own side, i.e. sideT 0.
    // Driven by e6 so it glides across the swatch with the rest of the fold-4
    // legend move instead of snapping.
    const sideT = g.fold6 && !isRightLegend ? e6 : 0;
    const labelWidth = item.label.offsetWidth;
    const leftAsSwatchFirst = -(labelGap + labelWidth);
    const leftAsLabelLeads  = swatchSize + labelGap;
    item.label.style.left  = `${leftAsSwatchFirst + (leftAsLabelLeads - leftAsSwatchFirst) * sideT}px`;
    item.label.style.right = "";

    item.el.classList.toggle("is-emphasized", postFold2 && !postFold6);
  });

  // @fold2's filler rects: the 18 @fold1 decorative dots that fly into the
  // camp grids' remaining cells instead of shrinking away with the rest.
  // Same beat-2 flight, row stagger, 7px→11px grow and start anchor as the
  // real group items above — but they KEEP their own @fold1 color (explicit
  // instruction), so each grid reads as the hero's palette with the 6 group
  // colors scattered in among it (FOLD2_GROUP_CELL). At @fold3 they shrink to
  // nothing in place over that fold's FIRST beat (fillerShrinkT) — the labels
  // only start typing once they're gone — leaving just the 6 group rects,
  // which then fly into their aligned column on the next beat.
  fold2FillerDots.forEach((dot, k) => {
    const { camp, row, col } = FOLD2_FILLER_CELLS[k];
    const moveT = p9Ease(Math.max(0, Math.min(1, (moveBaseRaw - row * ROW_STAGGER) / ROW_SPAN)));
    const targetX = fold2CellX(camp, col);
    const targetY = fold2RowY(row);
    const fromX = W / 2 + dot.anchor.left, fromY = dot.anchor.top;
    const size = PAGE0_DOT_SQ + (CLUSTER_SWATCH_SIZE - PAGE0_DOT_SQ) * moveT;
    const el = dot.el;
    el.style.left = `${fromX + (targetX - fromX) * moveT}px`;
    el.style.top  = `${fromY + (targetY - fromY) * moveT}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    if (dot.popped) el.style.transform = `scale(${1 - fillerShrinkT})`;
  });

  // The two camp headers — fade in as @fold2's 3rd beat (headerT, once the
  // grids have formed) and back out once fold6's mini-legend takeover
  // completes (e6), same "opacity-only, no separate flight" reasoning as
  // fold6NoteEl below (no earlier fold for these to fly in from). Per Figma
  // node 279:1342 each header is CENTERED over its camp (the
  // translate(-50%, -50%) override set where the elements are created), not
  // right-aligned to a swatch column — there's no divider to read them
  // against any more. What it centers on is the camp's own anchor (screen
  // center ± FOLD2_CAMP_CENTER_GAP_PX), i.e. the center of the @fold3
  // rect-column-plus-labels layout; @fold2's 4×3 block is placed to share
  // that same center (see campFold3Offset above), so the title stays put
  // across both folds.
  const fold4HeaderGapPx = (FOLD4_HEADER_GAP / GROUPS_FRAME_H) * H;
  const fold2HeaderY = fold2RowY(0) + CLUSTER_SWATCH_SIZE / 2 - fold4HeaderGapPx;

  // ...and they never leave that spot: the headers do NOT travel into the
  // @fold4 mini-legend (per explicit instruction — the legend's two columns
  // carry no camp titles). They just stay put and type themselves back OUT
  // over @fold4's own trigger, which is why there's no e6 lerp on position,
  // size or weight here at all.
  const placeCampHeader = (el, fold2X) => {
    el.style.left = `${fold2X}px`;
    el.style.top  = `${fold2HeaderY}px`;
  };
  placeCampHeader(fold4ColumnTitleCoalitionEl, W / 2 + FOLD2_CAMP_CENTER_GAP_PX);
  placeCampHeader(fold4ColumnTitleChangeEl, W / 2 - FOLD2_CAMP_CENTER_GAP_PX);

  // The two headers type on their OWN beats (FOLD2_BEATS.headerCoalition /
  // .headerChange) rather than sharing one — so one camp can start typing
  // before, with, or after the other.
  //
  // The un-typing at @fold4 is that same choreography played backwards: each
  // header's beat window is MIRRORED within the trigger (start → 1-(start+len))
  // and its own progress inverted, so the camp that typed in last is the first
  // to disappear, and each one loses characters from its end back to its
  // start at the same tempo it gained them. Reusing FOLD2_BEATS' own windows
  // (rather than a second pair of constants) means retiming the entrance
  // automatically retimes the exit to match.
  const fold6BeatT = (b) => {
    const w = FOLD2_BEATS[b];
    return p9Ease(Math.max(0, Math.min(1,
      (e6 - (1 - w.start - w.len)) / w.len)));
  };
  const untypeCoalition = 1 - fold6BeatT("headerCoalition");
  const untypeChange    = 1 - fold6BeatT("headerChange");

  fold8UpdateTypewriter(fold4HeaderSpansCoalition, Math.round(
    headerCoalitionT * untypeCoalition * FOLD4_HEADER_TITLE_COALITION.length));
  fold8UpdateTypewriter(fold4HeaderSpansChange, Math.round(
    headerChangeT * untypeChange * FOLD4_HEADER_TITLE_CHANGE.length));

  // The reveal itself is the typing, so opacity only ramps over the beat's
  // first quarter (enough that the first characters don't pop) and holds —
  // then mirrors that on the way out, over the last quarter of the un-typing,
  // so the final couple of characters don't pop off either.
  fold4ColumnTitleCoalitionEl.style.opacity =
    String(Math.min(1, headerCoalitionT * 4, untypeCoalition * 4));
  fold4ColumnTitleChangeEl.style.opacity =
    String(Math.min(1, headerChangeT * 4, untypeChange * 4));

  // The note and its divider just fade in at their final resting spot (same
  // e6 as the rows) rather than lerping in from anywhere — unlike the rows,
  // neither has an earlier fold to fly in from, so animating opacity alone
  // reads as part of the same settle instead of a second, separate motion.
  // Anchored off FOLD6_BOTTOM_ROW's own fold6 TARGET (already shifted up by
  // fold6NoteShiftPx above), same x as every mini-legend swatch — deliberately
  // NOT the live groupItems[FOLD6_BOTTOM_ROW_INDEX] position, which is still
  // mid-lerp for most of e6's range and would drag the note in from wherever
  // that row currently is instead of holding it still and just fading it in.
  //
  // dividerY is built from fold6RowMeasureEl's *settled* label height (not a
  // swatch-height estimate) — the label (14px text) is taller than the 6px
  // swatch it's centered on, so a swatch-based estimate undershoots the row's
  // real bottom edge and makes the top gap look smaller than the bottom one.
  // Note lives under the RIGHT legend column (coalition/right-wing rows), NOT
  // the left one. Mirror the left column's inset the same way the rows do
  // (isRightLegend uses W - FOLD6_LEGEND_INSET_RIGHT): the note hugs the
  // left inset, and the note box (RTL, right-aligned text) hugs that edge and
  // extends leftward — so it can't run off the right screen edge the way a
  // left-anchored box would here.
  const noteRightEdge = W - FOLD6_LEGEND_INSET_RIGHT;
  const fold6X = noteRightEdge - FOLD6_NOTE_WIDTH;
  const fold6TargetAnchorY = fold6RowY(FOLD6_BOTTOM_ROW, H, fold6NoteShiftPx);
  const lastRowLabelBottomTarget = fold6TargetAnchorY + LEFT_LEGEND_SWATCH_SIZE / 2 + fold6RowMeasureEl.offsetHeight / 2;
  const dividerY = lastRowLabelBottomTarget + FOLD6_DIVIDER_GAP_TOP;
  const noteY = dividerY + FOLD6_DIVIDER_HEIGHT + FOLD6_DIVIDER_GAP_BOTTOM;
  // Note + divider fade in on PHASE 2 (the inserted ACLED fold, #page-4) via
  // squaresRevealTrigger — NOT e6 (fold6Trigger, phase 1 = the split). The note
  // POSITION is still anchored to fold6's settled mini-legend target above; only
  // its reveal is deferred to the second fold.
  const noteRevealT = squaresRevealTrigger.currentT();
  fold6NoteDividerEl.style.left = `${noteRightEdge - fold6NoteMaxLineWidth}px`;
  fold6NoteDividerEl.style.top = `${dividerY}px`;
  fold6NoteDividerEl.style.opacity = String(noteRevealT);
  fold6NoteEl.style.left = `${fold6X}px`;
  fold6NoteEl.style.top = `${noteY}px`;
  fold6NoteEl.style.opacity = String(noteRevealT);

  // (groupsOverlayEl's own "is-active" is set once at init, not toggled here
  // — see the comment by its declaration above.)
  fold6SquaresOverlayEl.style.opacity = "1";

  const e7Label = fold7LabelTrigger.currentT();
  // @fold9 trigger #1 (its title card's ordinary midpoint crossing, see
  // checkFold9 above) colors in only the highlighted square (index 0) and
  // its tooltip's border below — the other 7 squares stay base gray until a
  // later trigger is added.
  const fold9Phase1T = fold9Trigger.currentT();
  // @fold9 trigger #2 (title card fully offscreen, same crossing as the year
  // axis appearing — see checkFold9Fly above) colors in the other 7 squares,
  // resizes all 8 to their real per-event dot's size, and only once that's
  // done flies them to that dot's position — two sequential beats, not
  // simultaneous (see FOLD9_FLY_RESIZE_SPAN below).
  const fold9FlyT = fold9FlyTrigger.currentT();
  // Read raw (linear, un-eased) rather than fold9FlyTrigger's own currentT()
  // — that bakes in p9Ease, the gentle default, but a square arriving at (and
  // visually becoming) a real per-event dot is exactly the "materializing
  // dot" case the animation-conventions doc calls out for p7Ease (punchy
  // cubic ease-out) instead, same curve p7DrawSideSquares uses for the real
  // timeline's own per-event pop-in.
  const fold9FlyRaw = fold9FlyTrigger.currentRaw();
  // Squares arrive staggered rather than in lockstep, the same "many small
  // squares popping in as a batch" convention as p7DrawSideSquares' own
  // cascade (and page0's row stagger, page9's arrival stagger). Expressed as
  // a fraction of fold9FlyTrigger's own fixed raw span, so every square still
  // finishes exactly at raw 1 regardless of this internal stagger.
  const FOLD9_SQUARES_FLY_STAGGER = 0.4;
  // Each square's own staggered local raw timeline (localRaw, computed per
  // square below) is sliced into two sequential sub-spans — color-in +
  // resize, then fly — each re-eased independently via p7Ease rather than
  // easing the whole span once and carving it up (CLAUDE.md's "Multi-beat
  // sequencing" convention: easing an already-eased curve's middle third
  // looks close to linear while the first/last thirds barely move).
  const FOLD9_FLY_RESIZE_SPAN = 0.4;
  // Color-in itself reads much faster than the resize it's paired with —
  // "secondary attribute can snap, position never does" (CLAUDE.md) — so a
  // square is already its real group color well before it's finished
  // growing/shrinking to its real dot's size, instead of the two finishing
  // together. Own sub-span of the same local timeline, well inside
  // FOLD9_FLY_RESIZE_SPAN.
  const FOLD9_FLY_COLOR_SPAN = 0.12;
  // Scale from 0 -> 1 as e6 (fold 6's own trigger progress) advances, so the
  // square grows from nothing rather than fading in. Eased over just the
  // first GROW_SPAN of the trigger's raw timeline (own re-eased span, "position
  // never does" convention) so the pop finishes well before the mini-legend
  // glide (also driven by e6) settles, instead of taking the full duration.
  const GROW_SPAN = 0.55;
  // Grow-in is PHASE 2 (inserted ACLED fold, #page-4) via squaresRevealTrigger —
  // detached from fold6Trigger (phase 1 = the split) so the squares only appear
  // on the second fold, after the mini-legend split has settled.
  const growScale = p9Ease(Math.max(0, Math.min(1, squaresRevealTrigger.currentRaw() / GROW_SPAN)));

  // page8CheckScroll (the only thing that ever calls p8Trigger) is its own
  // separate window "scroll" listener, registered well after this one —
  // relying on it having already run for *this* scroll position, before the
  // squares below read p8CurrentT(), is a listener-ordering assumption a
  // fast/synthetic scroll can violate. Calling it directly here first removes
  // that dependency — idempotent (guarded by p8Engaged itself).
  if (typeof page8CheckScroll === "function") page8CheckScroll();
  // page8's own glide (p8CurrentT, page8.js) runs on a pure wall-clock
  // requestAnimationFrame loop (p8RunAnimLoop) independent of scrolling — it
  // calls draw() every frame to keep the real canvas dots animating, but
  // nothing else re-runs updateGroups() (what actually moves these DOM
  // squares) unless a fresh "scroll" event happens to fire too. If the user
  // stops scrolling before the 3000ms glide finishes (an entirely normal
  // pause-to-read), the real dots keep gliding to their final position while
  // these squares silently freeze wherever they were at the last scroll
  // event — exactly the "stuck" bug. fold9EnsureP8SyncLoop (own
  // self-scheduling rAF loop, started below) keeps calling updateGroups()
  // every frame for as long as the glide is still mid-flight, independent of
  // further scrolling, so the two always stay in lockstep.
  if (typeof p8Engaged !== "undefined" && p8Engaged && typeof p8CurrentT === "function" && p8CurrentT() < 1) {
    fold9EnsureP8SyncLoop();
  }

  fold6SquareEls.forEach(({ wrap, sq, label }, i) => {
    // delayFrac/localRaw only depend on i and the trigger's own raw progress
    // (not on whether the real-dot target has resolved yet), so they're
    // computed here, before colorT, and reused again below for size/position.
    const delayFrac = fold6SquareEls.length > 1
      ? (i / (fold6SquareEls.length - 1)) * FOLD9_SQUARES_FLY_STAGGER
      : 0;
    const localRaw = Math.min(1, Math.max(0, (fold9FlyRaw - delayFrac) / (1 - delayFrac)));
    // Beat 1 (color + resize): first FOLD9_FLY_RESIZE_SPAN of this square's
    // own local timeline (color itself finishing much sooner within it, see
    // FOLD9_FLY_COLOR_SPAN). Beat 2 (fly): the remainder — 0 until beat 1 is
    // fully done, so the square never starts moving mid-resize.
    const colorPhaseT = p7Ease(Math.max(0, Math.min(1, localRaw / FOLD9_FLY_COLOR_SPAN)));
    const resizeT = p7Ease(Math.max(0, Math.min(1, localRaw / FOLD9_FLY_RESIZE_SPAN)));
    const moveT = p7Ease(Math.max(0, Math.min(1, (localRaw - FOLD9_FLY_RESIZE_SPAN) / (1 - FOLD9_FLY_RESIZE_SPAN))));

    const colorT = i === 0 ? fold9Phase1T : colorPhaseT;
    sq.style.background = lerpFold6SquareColor(FOLD6_SQUARE_COLORS[i], colorT);

    // This square's own real event, resolved once and reused below (hover-dim,
    // the fold8 tooltip, fold13's legit fade, and the fly target) instead of
    // calling p7EventForActorOccurrence four separate times.
    const targetEvent = typeof p7EventForActorOccurrence === "function"
      ? p7EventForActorOccurrence(FOLD6_SQUARE_ACTORS[i], FOLD6_SQUARE_OCCURRENCE[i])
      : null;
    // Figma node 258:2159: every square except the one with a tooltip (index
    // 0, kept at full opacity) renders at ~46% opacity while still gray —
    // only within @fold8's own trigger window (tooltipT, same value gating
    // the tooltip below): before that window starts, all 8 squares are still
    // uniform (as in @fold5's own Figma frame, 258:2206, where none of this
    // dimming shows).
    const tooltipT = e7Label; // tooltip stays once shown — see fold8TooltipEl's own comment below
    // Dim opacity lowered (0.46 -> 0.3) and driven by its own trigger
    // (fold8SquareDimTrigger, FOLD8_SQUARE_DIM_MS = FOLD8_GROW_MS) timed to
    // finish exactly as the tooltip reaches max scale, not the shared
    // GROUP_TRANSITION_MS tempo. Reads raw (linear), not currentT() (p9Ease's
    // sine ramp reads oddly over a short, plain opacity fade) — same
    // "opacity fades don't need easing" convention as HOVER_DIM_MS elsewhere.
    const FOLD6_SQUARE_DIM_OPACITY = 0.3;
    const dimT = fold8SquareDimTrigger.currentRaw();
    const dimFromFold8 = 1 - (1 - FOLD6_SQUARE_DIM_OPACITY) * dimT;
    // Restored to full opacity in step with @fold9 trigger #2 (fold9FlyT) —
    // once a square is colored in and flying to its real dot, the dimmed
    // ~30% opacity (which only ever fit its gray, pre-color state) no longer
    // applies; a real timeline dot is always full opacity.
    let opacity = i === 0 ? 1 : dimFromFold8 + (1 - dimFromFold8) * fold9FlyT;
    // Once this square IS a real timeline dot (fold9FlyT ~ 1), it must dim
    // the same way every other canvas dot does while a different dot is
    // hovered (p7.hoveredEvent, p7DrawSideSquares' own snap-to-HOVER_DIM_OPACITY dim) —
    // otherwise these 8 squares read as permanently full-opacity while the
    // rest of the grid dims around the hovered dot.
    if (typeof p7 !== "undefined" && p7.hoveredEvent && targetEvent) {
      if (targetEvent !== p7.hoveredEvent) opacity *= HOVER_DIM_OPACITY;
    }
    // Same parity for @fold10's own hover-dim (p9.hoveredEvent/hoveredCategoryIdx/
    // hoverDimT, page9.js's p9PlaceDot) — these squares are also drawn a second
    // time as an ordinary canvas dot in page9's legit/extreme grid (this DOM
    // square just sits on top of it once it arrives), so without this the
    // square underneath dims/highlights while the visible DOM square on top
    // stays frozen at full opacity, reading as "this dot never dims." Mirrors
    // p9PlaceDot's own three-branch priority (dot-hover > pill-hover >
    // lingering hover-dim tail) exactly, so the two stay visually identical.
    if (typeof p9 !== "undefined" && targetEvent) {
      if (p9.hoveredEvent) {
        if (targetEvent !== p9.hoveredEvent) opacity *= HOVER_DIM_OPACITY;
      } else if (p9.hoveredCategoryIdx !== null) {
        const dimFactor = 1 - 0.65 * p9.hoverDimT;
        if (CATEGORY_EN_TO_IDX[targetEvent.category] !== p9.hoveredCategoryIdx) opacity *= dimFactor;
      } else if (p9.hoverDimT > 0) {
        const dimFactor = 1 - 0.65 * p9.hoverDimT;
        const stillHighlighted = p9.hoverDimCategoryIdx !== null &&
          CATEGORY_EN_TO_IDX[targetEvent.category] === p9.hoverDimCategoryIdx;
        if (!stillHighlighted) opacity *= dimFactor;
      }
    }
    // @fold11's own legit-dot fade-out (p9.fold13OutT, drawPage9) only ever
    // fades events whose category is still classified "below" (legitimate) —
    // extreme ("above") events morph away separately instead (p9.fold13ExtremeMorphT,
    // drawPage12). Same classification check, so a square whose category was
    // never dragged to extreme fades out with the rest of the legit grid
    // instead of sitting there alone after everything else has disappeared.
    if (typeof p9 !== "undefined" && targetEvent) {
      const idx = CATEGORY_EN_TO_IDX[targetEvent.category];
      const isExtreme = idx !== undefined && p9.sides && p9.sides[idx] === "above";
      if (!isExtreme) opacity *= 1 - (p9.fold13OutT ?? 0);
    }
    sq.style.opacity = String(opacity);

    // Real-event tooltip (shared #page9Tooltip, see fold8TooltipEl above),
    // shown unconditionally once @fold8's own window starts (e7Label ramping
    // in) — no hover required — until it shrinks away once its own square
    // arrives at its real dot (fold9TooltipShrinkTrigger, see above). Only
    // square 0 currently drives it; if more squares are ever added back,
    // each would need its own tooltip instance.
    const shrinkT = fold9TooltipShrinkTrigger.currentT();
    if (i === 0) {
      const event = targetEvent;
      // shrinkT >= 1 (fold 9's own, later, one-way "arrived at its real dot"
      // collapse) or a missing event forces an immediate hide below —
      // unrelated to @fold8's own scroll reversal, which is handled entirely
      // by fold8SeqElapsed/fold8SeqDirection instead (see their own comments
      // above fold8SequenceEvent).
      const forceHide = !event || shrinkT >= 1;
      const wantShow = !forceHide && tooltipT > 0.001;

      if (wantShow && fold8SequenceEvent !== event) {
        // New event: (re)start the reversible grow-then-type sequence fresh
        // from elapsed 0 — see FOLD8_GROW_MS's own comment above for why this
        // isn't driven by tooltipT directly. Build the full-text spans now
        // (fold8SetupTypewriter), before any scaling happens, so the box is
        // already laid out at its true final size for the entire grow-in —
        // see that function's own comment for why.
        fold8SequenceEvent = event;
        fold8SeqElapsed = 0;
        fold8SeqDirection = 1;
        fold8SeqLastFrameTime = null;
        fold8PrevTooltipRaw = fold7LabelTrigger.currentRaw();
        fold8DateSpans = fold8SetupTypewriter(fold8TooltipDateEl, p7FormatDateDMY(event.date));
        fold8DescSpans = fold8SetupTypewriter(fold8TooltipDescEl, event.descHeMedium);
      }

      if (forceHide) {
        if (fold8TooltipOwnsIt) fold8ResetTooltip();
      } else if (fold8SequenceEvent) {
        fold8TooltipOwnsIt = true;
        // Colors in step with the highlighted square itself (both driven by
        // fold9Phase1T/@fold9 trigger #1) — gray until the title card's
        // midpoint crossing, then transitions to the actor's real group
        // color together with the square.
        // `color`, not `border-color` — the visible stroke is the dashed <svg>
        // overlay (updateTooltipDash above), which strokes currentColor.
        fold8TooltipEl.style.color = lerpFold6SquareColor(FOLD6_SQUARE_COLORS[0], colorT);
        fold8TooltipEl.classList.add("is-visible");
        // Opens toward the left of the square (mirrored corner, same convention
        // p9HoverInit/p7HoverInit use for left-side events), not the right —
        // its pointer corner (bottom-right when mirrored) is also the point
        // the grow-in below scales from.
        fold8TooltipEl.classList.add("is-mirrored");
        fold8TooltipEl.style.opacity = "1";
        fold8TooltipEl.style.transformOrigin = "bottom right";
        fold8AnchorSquareEl = sq;

        fold8AdvanceSequence();
        fold8EnsureSequenceRunning();

        // Reversing all the way back to elapsed 0 is a real mirrored
        // shrink-to-nothing (fold8AdvanceSequence already scaled the box to
        // ~0) — safe to fully hide/reset now.
        if (fold8SeqElapsed <= 0 && fold8SeqDirection === -1) fold8ResetTooltip();
      }
    }

    // Rest position (this square's plain fold6/fold9 anchor) -> target real
    // dot, lerped by moveT (beat 2, after color+resize) so it lands exactly
    // as fold9FlyTrigger settles.
    // Left as a no-op translate/size if the target can't be resolved yet
    // (events.json still loading). growScale (0->1, driven by e6) is layered
    // on top of the translate either way, so the square always grows from
    // nothing regardless of whether the fly-out target has resolved.
    //
    // p7TargetForActorOccurrence is page7's own static grid — this square's
    // target *while the real timeline is still playing* (i.e. the previous,
    // correct behavior, reverted here after briefly trying to snap straight
    // to page9's grid, which showed these squares jumping to the wrong spot
    // mid-timeline before page8's own glide had even started). Only once the
    // timeline is actually finished and page8 starts its own real-dot glide
    // toward page9's legit grid (p8CurrentT(), page8.js) does this square
    // blend along with it too, via the exact same p9LegitPosOf/p9Ease math
    // blendAndDraw (page8.js) uses for every other real dot — so it "animates
    // down just like any other dot" instead of snapping the instant page9 is
    // reached.
    const target = p7TargetForActorOccurrence(FOLD6_SQUARE_ACTORS[i], FOLD6_SQUARE_OCCURRENCE[i], W, H);
    // currentPage reaching 11 (drawPage9, PAGES above) is a *harder* signal
    // than p8CurrentT() > 0: the section-level IntersectionObserver that
    // flips currentPage can cross into page9's own slot before page8's own
    // title-reaches-center trigger (page8CheckScroll, watching a narrower
    // condition) ever fires — and once currentPage is actually 11, drawPage9
    // is unconditionally drawing every real dot at its final legit position
    // already, no blend, full stop. Relying on p8CurrentT() alone left a
    // window there where the real grid had already jumped to its final
    // layout but this square hadn't moved at all yet. So: full weight (ease
    // 1) the instant currentPage reaches 11, otherwise follow page8's own
    // blend for as long as it's actually driving the real dots (currentPage
    // === 10). page8CheckScroll/fold9EnsureP8SyncLoop above make sure
    // p8CurrentT() below is both freshly triggered and kept moving even
    // without further scroll events.
    const ease = currentPage >= 9 ? 1 : p9Ease(typeof p8CurrentT === "function" ? p8CurrentT() : 0);
    if (target && ease > 0) {
      if (targetEvent) {
        p9EnsureIndex();
        const side = p9.leftIndexOf.has(targetEvent) ? "left" : "right";
        const indexOf = side === "left" ? p9.leftIndexOf : p9.rightIndexOf;
        const legitPos = p9LegitPosOf(targetEvent, indexOf, side, p9LegitGeometry(W, H));
        if (legitPos) {
          target.x = target.x + (legitPos.x - target.x) * ease;
          target.y = target.y + (legitPos.y - target.y) * ease;
        }
      }
    }
    if (target) {
      const restX = W / 2 + FOLD6_SQUARES_OFFSET[i].dx;
      const restY = H / 2 + FOLD6_SQUARES_OFFSET[i].dy;
      const dx = (target.x - restX) * moveT;
      const dy = (target.y - restY) * moveT;
      sq.style.transform = `translate(${dx}px, ${dy}px) scale(${growScale})`;
      const size = 8 + (target.size - 8) * resizeT;
      sq.style.width = sq.style.height = `${size}px`;

      // This DOM square *is* the real dot for this event permanently — the
      // real per-event cascade skips it entirely (p7GetClaimedEvents,
      // page7.js), so there's no separate canvas dot to ever hand off to.
      // Stays visible once it arrives and just sits there like any other
      // timeline dot from then on.
      wrap.style.display = "";
    } else {
      sq.style.transform = `scale(${growScale})`;
      sq.style.width = sq.style.height = "8px";
      wrap.style.display = "";
    }
  });
}

function layoutGroups() {
  const W = canvas.clientWidth, H = canvas.clientHeight;
  layoutFold6Squares(W, H);
  updateGroups();
}

let groupsTicking = false;
window.addEventListener("scroll", () => {
  if (groupsTicking) return;
  groupsTicking = true;
  requestAnimationFrame(() => { checkGroupTriggers(); groupsTicking = false; });
}, { passive: true });

// A programmatic smooth scroll (the dev fold-jump dropdown's own
// scrollIntoView({behavior:"smooth"}), main.js above) can momentarily
// overshoot or coalesce its very last frame, letting a card's top transiently
// cross a watchCardThreshold boundary during the animated transit even though
// the scroll actually *settles* on the other side of that boundary — with no
// further "scroll" event firing afterward to correct it, the trigger is left
// stuck fired even though the true resting position never should have
// crossed it. "scrollend" (fires once, after any scroll — including animated
// ones — has fully settled) is a cheap, harmless-if-unsupported safety net:
// re-check every trigger against the actual final position once scrolling is
// truly done.
window.addEventListener("scrollend", checkGroupTriggers, { passive: true });

// drawFold9/drawFold7 (currentPage 6/5, #page-6/#page-5) used to be static
// background-only, so nothing redrew the canvas while scrolling within them.
// Now drawFold9 also draws the year axis preview (gated on p7AxisShouldShow,
// page7.js) once fold 9's title passes offscreen, and both keep drawing the
// real per-event squares for as long as p7RealTimelineReached is true (see
// its own comment, page7.js) — each needs its own scroll-driven redraw to
// actually pick up those changes while currentPage stays 6 or 7 the whole
// time it's happening.
let fold9AxisTicking = false;
window.addEventListener("scroll", () => {
  if (fold9AxisTicking) return;
  fold9AxisTicking = true;
  requestAnimationFrame(() => {
    if (currentPage === 5 || currentPage === 6) draw();
    fold9AxisTicking = false;
  });
}, { passive: true });

