// Below this size (CSS px) a shrinking element is faded out rather than left
// to disappear on its own. Anything scaled toward zero spends its last frames
// covering a fraction of a device pixel, which the compositor renders as a
// faint speck instead of nothing at all — visible on a DPR>1 phone, and the
// reason @fold4 was leaving marks on screen after everything had "gone". One
// px, so the fade only ever runs inside the final, already-invisible pixel and
// no beat's visible timing changes.
const SWATCH_VANISH_PX = 1;

// Same per-frame coalescing as draw() (js/core.js) and for the same reason:
// every animating makeTrigger's own rAF loop plus fold9EnsureP8SyncLoop each
// call this global directly, which measured out at 2+ full DOM restyles per
// frame during @fold10's bridge glide. First call in a frame runs; later
// same-frame calls queue one rerun next frame so no state change is dropped.
let ugRanThisFrame = false;
let ugRerunQueued  = false;
function updateGroups() {
  if (ugRanThisFrame) {
    if (!ugRerunQueued) {
      ugRerunQueued = true;
      requestAnimationFrame(() => { ugRerunQueued = false; updateGroups(); });
    }
    return;
  }
  ugRanThisFrame = true;
  requestAnimationFrame(() => { ugRanThisFrame = false; });
  const W = canvas.clientWidth, H = canvas.clientHeight;
  // @fold4's entrance (fold6Trigger, its card's ordinary center crossing) —
  // a single beat now: the rects glide straight into fold6's mini-legend.
  // It used to open with a merge beat, undoing the split-into-3 that the
  // removed @fold4 played (see _stash-fold3.md); with nothing left to merge,
  // the whole trigger is just the glide.
  const e6 = fold6Trigger.currentT();
  // The mobile FLY hand-off's own progress: p7Ease (cubic OUT) over the same
  // raw trigger, per explicit instruction that the flight should have less
  // ease-in — it leaves at speed and brakes into the panel. Everything else on
  // this trigger (the un-type windows, the note fade, desktop's glide) stays on
  // the house sine in-out e6. Eased fresh from RAW, never a re-ease of e6.
  const e6Fly = p7Ease(fold6Trigger.currentRaw());
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
  // On DESKTOP the note hangs BELOW the right-hand mini-legend column,
  // absolutely positioned by the block further down; the legend rows center on
  // the viewport middle without it (fold6RowIndexY). On MOBILE there is no
  // on-canvas mini-legend at all any more — the legend collapsed into the מקרא
  // drop-down (js/groups.js), and the note was reparented INTO that panel,
  // where it flows. So every measured value here is desktop-only.
  fold6SyncNoteHome();
  const fold6MobileLegend = isMobile();
  const fold6NoteWidthPx = FOLD6_NOTE_WIDTH;
  let fold6NoteHeightPx = 0;
  if (!fold6MobileLegend) {
    fold6NoteEl.style.width = `${fold6NoteWidthPx}px`;
    fold6NoteHeightPx = fold6NoteEl.offsetHeight;
  }

  // Divider spans the note's FULL frame width, not the widest wrapped line —
  // the hairline reads as the note block's own edge, so it should match the
  // box, and a text-width hairline made its right end wander every time the
  // wrap changed. Both share the same left x (fold6X below), so they line up
  // on the left and both end at noteRightEdge.
  if (!fold6MobileLegend) fold6NoteDividerEl.style.width = `${fold6NoteWidthPx}px`;

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
  const fold2RowY = rowIdx => fold2TopRowY + rowIdx * fold2RowPitchPx();
  // @fold3's aligned column needs its OWN row pitch, separate from @fold2's
  // grid pitch above. @fold2's rows carry bare 11px rects, so 32px keeps that
  // 4x3 grid square; @fold3's rows carry the labels, and on mobile those wrap
  // to two or three lines inside .group-label's 100px cap — taller than 32px,
  // so consecutive rows printed over each other. Desktop labels are nowrap
  // one-liners and measure well under 32, so `max` leaves it at exactly the
  // tuned 32 there and this is a mobile-only widening.
  // Mobile only, and gated on isMobile() rather than left to the `max` below to
  // decide: the desktop pitch must stay exactly the tuned 32 whatever the
  // one-line labels happen to measure, so the mobile gap can be raised without
  // any chance of it leaking into the desktop column.
  const FOLD3_ROW_LABEL_GAP_PX = 12; // mobile only — see the max() below
  // ONE knob per breakpoint, nothing else has a vote.
  // Desktop: the pitch is this flat number, full stop — 34 = a 23px visible gap
  // + the 11px swatch. No max() against label heights: desktop labels are
  // nowrap one-liners, and the old max() meant editing the "pitch" constant
  // silently did nothing whenever tallest-label + gap outvoted it.
  // Mobile keeps the label-height max(): its labels wrap to 2-3 lines, so a
  // flat pitch would let rows print over each other there.
  const FOLD3_ROW_PITCH_DESKTOP_PX = 34;
  const FOLD3_MIN_ROW_PITCH_MOBILE_PX = 32;
  const fold3RowPitch = !isMobile() ? FOLD3_ROW_PITCH_DESKTOP_PX : Math.max(
    FOLD3_MIN_ROW_PITCH_MOBILE_PX,
    Math.max(...GROUPS.map(g =>
      groupLabelHeight(g, groupLabelColumnFontSize(), groupLabelColumnMaxWidth())))
      + FOLD3_ROW_LABEL_GAP_PX
  );
  // Both folds share ONE fixed top anchor; each pitch only spaces its own
  // rows downward from it. There used to be a re-centering term here
  // (fold2TopRowY - (fold3RowPitch - fold2RowPitchPx()) * rows / 2) that made
  // fold3's whole column — and the header riding topRowYNow — move whenever
  // EITHER fold's pitch was edited. Don't reintroduce it: the anchor is a
  // position, the pitches are gaps, and they must never feed each other.
  const fold3TopRowY = fold2TopRowY;
  const fold3RowY = rowIdx => fold3TopRowY + rowIdx * fold3RowPitch;
  const fold2BlockW = (FOLD2_GRID_COLS - 1) * fold2ColPitchPx() + CLUSTER_SWATCH_SIZE;
  // Each camp's anchor — screen center ± FOLD2_CAMP_CENTER_GAP_PX. Its camp
  // title sits centered on it, and BOTH fold layouts are centered on it too:
  // @fold2's 4×3 block (below) and @fold3's aligned rect-plus-label column
  // (campFold3X). So the title never moves between the two folds, and the
  // rects read as centered under it in both.
  // On a phone the desktop 160px gap puts the two blocks (104px each) plus
  // @fold3's outward-trailing labels well past a 393px viewport, so the gap
  // shrinks with W there — enough to still read as two separate camps, but
  // narrow enough that both blocks and their labels stay on screen.
  const campGapPx = campCenterGapPx(W);
  const campAnchorX = isCoalition =>
    W / 2 + (isCoalition ? campGapPx : -campGapPx);
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
    (isCoalition ? coalitionBlockX : changeBlockX) + col * fold2ColPitchPx();
  // Each group's own rect sits at its scattered FOLD2_GROUP_CELL cell — the
  // one it flies OUT of at @fold3, into that camp's aligned column.
  const fold2GroupX = i =>
    fold2CellX(FOLD4_COALITION_ROWS.includes(GROUPS[i]), fold2GroupCell(i).col);
  // @fold3's aligned column is ordered by the mini-legend's own top-to-bottom
  // order (each group's fold6.y within its camp), NOT by @fold2's scattered
  // cells — so the order the labels type in is already the order they'll hold
  // for the rest of the page, and @fold6's glide into the mini-legend never
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
    const rowIdx = fold2GroupCell(i).row;
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
    // with @fold2's flight and @fold6's glide like every other stage here.
    const fold3Row = legendRow(g);
    const fold3X = campFold3X(isCoalitionRow ? FOLD4_COALITION_ROWS : FOLD4_CHANGE_ROWS);
    const fold3Y = fold3RowY(fold3Row);
    x += (fold3X - x) * alignT;
    y += (fold3Y - y) * alignT;

    // Swatch starts at the real @fold1 dot's own 7px size (PAGE0_DOT_SQ) and
    // grows to the column's 13px (CLUSTER_SWATCH_SIZE) over the same moveT
    // as the position fly-in above.
    let swatchSize = PAGE0_DOT_SQ + (CLUSTER_SWATCH_SIZE - PAGE0_DOT_SQ) * moveT, labelGap = CLUSTER_LABEL_GAP;
    // The size the LABEL is centered on. Same as swatchSize everywhere except
    // mobile's @fold4 exit, where the swatch shrinks away under a label that
    // must not move — see the fold6MobileLegend branch below.
    let labelAnchorSwatch = null;
    // How far this row is through the mobile FLY hand-off (0 = @fold3's row,
    // 1 = landed inside the מקרא panel). 0 in the un-type variant and on
    // desktop. Font size, wrap cap, the first-line shift and the fade all ride
    // it — see the fold6MobileLegend branch below.
    let flyT = 0, flying = false, flyTgt = null;
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
      //
      // MOBILE has no on-canvas mini-legend to travel to (it collapsed into the
      // מקרא drop-down), and per explicit instruction the rows do NOT fly into
      // the button either: they leave from exactly where @fold3 left them — the
      // dot shrinks away and the label un-types (below). So there is no fold6
      // position target at all here, and no reshape: nothing about the row
      // changes on the way out except its size and its character count.
      if (!fold6MobileLegend) {
        const fold6X = isRightLegend
          ? (W - fold6LegendInsetRight() - LEFT_LEGEND_SWATCH_SIZE)
          : fold6LegendInsetLeft();
        const fold6Pos = { x: fold6X, y: fold6RowY(g, H) };
        x += (fold6Pos.x - x) * e6; y += (fold6Pos.y - y) * e6;
        // The row RESHAPES into a mini-legend row as it travels — 13px swatch
        // down to 6px, gap down to match.
        swatchSize += (LEFT_LEGEND_SWATCH_SIZE - CLUSTER_SWATCH_SIZE) * e6;
        labelGap   += (LEFT_LEGEND_LABEL_GAP - CLUSTER_LABEL_GAP) * e6;
      } else if (fold6MFlyEnabled() && fold6MFlyTargetOf(g)) {
        // MOBILE, fly variant: the row travels into the open מקרא panel, to
        // the exact spot its own panel row occupies (measured in viewport
        // coordinates, which is the same space .group-item's left/top lives
        // in — both layers are `position: fixed; inset: 0`). It reshapes on
        // the way exactly as the desktop row does into the mini-legend, just
        // toward the panel's own metrics instead.
        flyTgt = fold6MFlyTargetOf(g);
        const tgt = flyTgt;
        x += (tgt.x - x) * e6Fly; y += (tgt.y - y) * e6Fly;
        swatchSize += (FOLD6_MFLY_SWATCH_PX - swatchSize) * e6Fly;
        labelGap   += (FOLD6_MFLY_GAP_PX - labelGap) * e6Fly;
        // `flying` gates the wrap-cap quantisation and the first-line anchor
        // below, and it is deliberately FALSE at e6 = 0. This branch is live
        // from the moment @fold4's trigger exists, which means it also runs
        // during @fold2 and @fold3, where the fold is simply at rest. Letting
        // the fly-specific measuring run there changed @fold2/@fold3's resting
        // layout (the camp-header-to-row gap). At e6 = 0 every lerp above is a
        // no-op anyway, so taking the pre-fly path is exactly the old geometry.
        flyT = e6Fly; flying = e6Fly > 0;
      } else {
        // Shrinks to nothing in place. Scaled rather than faded so it reads as
        // the same "dot" gesture @fold1/@fold2 use for a dot leaving.
        // labelAnchorSwatch keeps the PRE-shrink size: the label's own `top` is
        // measured off the swatch's center, so letting it follow the shrink
        // would slide the text up ~6px while it un-types. Nothing about the
        // label moves on mobile — only its character count changes.
        labelAnchorSwatch = swatchSize;
        swatchSize *= 1 - e6;
      }
    }

    item.el.style.left = `${x}px`;
    item.el.style.top  = `${y}px`;

    // Swatch eases in (page0PopT, set by playPage0Entrance) once the @fold1
    // page-load entrance reaches this row — it's standing in for a real
    // @fold1 dot at rest, so once popped it should look identical to that
    // dot until it actually starts flying at @fold2. The label is @fold3's
    // own beat (labelT, fold3Trigger above).
    const popT = page0PopT[i];
    // ...faded out over the last CSS pixel of the shrink, because a box scaled
    // to (near) nothing is NOT reliably invisible: at a sub-pixel size on a
    // DPR>1 phone the compositor still antialiases it into a faint coloured
    // speck. Mobile's @fold4 exit shrinks the swatch to zero in place
    // (swatchSize *= 1 - e6 above) and left six of those specks sitting mid-
    // screen. Size alone can't be trusted to hide anything — opacity can.
    const swatchVanishT = Math.max(0, Math.min(1, swatchSize / SWATCH_VANISH_PX));
    // The travelling row never fades: it lands on the panel row's exact pixels
    // and the two SWAP in one frame (fold6MFlyArriveT / fold6MFlyPaintClone).
    item.swatch.style.opacity = String(popT * swatchVanishT);
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
    // On mobile the label leaves at @fold4 by UN-TYPING in place (per explicit
    // instruction — it doesn't fly anywhere). Same construction the camp headers
    // use: this row's own type-in window is MIRRORED inside fold6Trigger
    // (start → 1-(start+len)) and its progress inverted, so the row that typed
    // in last is the first to disappear and each loses characters end-to-start
    // at the tempo it gained them. Reusing the type-in window means retiming
    // @fold3 automatically retimes this.
    const untypeStart = typeSlot * FOLD3_TYPE_ROW_STAGGER;
    // ...but NOT in the fly variant: there the label keeps every character all
    // the way in — it is the same row arriving somewhere else, not a row being
    // spelled backwards out of existence.
    const labelUntypeT = (fold6MobileLegend && g.fold6 && !flying)
      ? 1 - p9Ease(Math.max(0, Math.min(1,
          (e6 - (1 - untypeStart - typeSpan)) / typeSpan)))
      : 1;
    const labelCharT = Math.max(0, Math.min(1, labelT)) * labelUntypeT;
    // On mobile the label WRAPS (100px cap), and a plain growing string re-breaks
    // its lines as it types — words visibly hopping down a line mid-animation. So
    // use the same two-span typewriter the camp headers use: the full string is
    // laid out from the first frame, characters only move between the visible and
    // the transparent span, and the label types inside its final wrapped shape.
    // Desktop labels are nowrap one-liners with nothing to re-break, so they keep
    // the plain textContent path — which also clears the spans on a resize down.
    if (isMobile()) {
      if (!item.labelSpans || item.labelSpans.fullText !== g.label)
        item.labelSpans = fold8SetupTypewriter(item.label, g.label);
      fold8UpdateTypewriter(item.labelSpans, Math.round(labelCharT * g.label.length));
    } else {
      item.labelSpans = null;
      item.label.textContent = typedText(g.label, labelT);
    }
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
    // How much of the row's RESHAPE into a mini-legend row has happened: font
    // size, wrap cap and which side the label sits on all ride this. It's e6 on
    // desktop and pinned to 0 on mobile, where the row never becomes a legend
    // row — it only flies into the מקרא button and fades. Position is NOT on
    // this: that always runs the full e6.
    const fold6ShapeT = fold6MobileLegend ? 0 : e6;
    const labelFsCol = groupLabelColumnFontSize(), labelFsLegend = groupLabelLegendFontSize();
    let labelFontSize = g.fold6 && raw2 >= FOLD2_BEATS.move.start + MOVE_SPAN
      ? labelFsCol + (labelFsLegend - labelFsCol) * fold6ShapeT : labelFsCol;
    // The fly variant reshapes toward the PANEL's type, not the desktop
    // mini-legend's — same idea as fold6ShapeT, different destination.
    // Continuous, per explicit instruction: rounding this to whole px cut the
    // re-layouts but turned the shrink into four visible steps. The stutter it
    // was aimed at is handled by the cheaper measures instead (the frozen wrap
    // cap below, the cssText memo in fold6MFlyCopyStyle, the park fix).
    if (flying) labelFontSize = labelFsCol + (FOLD6_MFLY_FONT_PX - labelFsCol) * flyT;
    // .group-label is translateY(-50%), so `top` centers the WHOLE box on the
    // swatch — on mobile, where the label wraps to 2-3 lines, that leaves the
    // swatch floating beside the middle of the block. @fold3 wants it beside the
    // FIRST line, so push the box down by half its extra height beyond one line
    // (one-line height = the same label measured with the wrap cap lifted).
    // Faded out over e6 rather than applied everywhere: the mini-legend keeps
    // its centered swatch, and lerping means the swatch slides up to center as
    // the row glides instead of jumping at the beat boundary.
    // Faded over fold6ShapeT, NOT e6: on desktop that is e6 (the mini-legend
    // wants its swatch back on the vertical center of the block, and lerping
    // means it slides there with the glide instead of jumping). On mobile
    // fold6ShapeT is pinned at 0 — the row never becomes a legend row, it
    // un-types where @fold3 left it — so the shift must hold. Riding e6 there
    // slid the whole label up by half its extra wrapped height as it untyped.
    // The wrap cap this frame — needed here, before the shift, and written onto
    // the element further down. FROZEN at the rest cap while flying: the real
    // label is hidden for the whole flight, nothing reads its layout, and a
    // moving cap would just be a pointless re-wrap-per-frame of an invisible
    // element. The VISIBLE unwrap is done by the stand-in's sliding line spans
    // instead (fold6MFlyPaintClone in js/groups.js) — a cap lerp re-breaks the
    // text, and however the box is anchored a re-break hops a word to another
    // line in one frame, which is the stutter this replaced.
    const capCol = groupLabelColumnMaxWidth(), capLegend = groupLabelLegendMaxWidth();
    const capNow = capCol == null || capLegend == null ? null
      : flying ? capCol
      : capCol + (capLegend - capCol) * (g.fold6 && raw2 >= FOLD2_BEATS.move.start + MOVE_SPAN ? fold6ShapeT : 0);
    // While FLYING the shift is recomputed from THIS frame's size and cap, and
    // is NOT faded out — that is what stops the re-wrap from being visible.
    // translateY(-50%) means the label's drawn position is a function of its own
    // HEIGHT, so every time the text loses a line (3 → 2 → 1 as the cap opens)
    // the whole block jumps up by half a line: the stutter, and the reason it
    // only showed on the label with the most lines to lose. Anchoring the FIRST
    // line instead pins the text that is already on screen and lets the block
    // shed lines downward, off the end nobody is looking at. It converges on its
    // own: at flyT = 1 the label is one line, so the shift is 0 and the landing
    // stays pixel-exact.
    //
    // NOT used while flying — see the is-mfly-topanchor block below, which drops
    // the -50% transform so the first line can be placed directly. Measuring the
    // wrapped height to compensate for it (the previous attempt) can't work: the
    // height is a step function of the line count, so the compensation is a step
    // function too and the label still visibly hops on every re-wrap.
    const firstLineShift = !isMobile() || flying ? 0
      : ((groupLabelHeight(g, groupLabelColumnFontSize(), groupLabelColumnMaxWidth())
          - groupLabelHeight(g, groupLabelColumnFontSize(), 9999)) / 2) * (1 - fold6ShapeT) * (1 - flyT);
    // The fly variant lerps the last stretch onto the panel row's MEASURED
    // label offset (flyTgt.ly) instead of trusting the two constructions to
    // agree: the canvas row centers its label on the swatch's middle, the panel
    // centers the swatch on the line box, so they land a pixel or two apart —
    // invisible under a cross-fade, not under the swap that replaced it.
    const labelBase = (labelAnchorSwatch ?? swatchSize) / 2
      + groupLabelInkShift(labelFontSize);
    const labelTop = labelBase + firstLineShift;
    if (flying) {
      // TOP-anchored for the flight (.is-mfly-topanchor drops the -50%), so
      // `top` is the box's top edge and the FIRST LINE can be placed directly.
      // labelBase is exactly where the resting first line already sits — with
      // the centered transform, center = base + (H - lineH)/2, so
      // firstLineCenter = center - H/2 + lineH/2 = base, height cancelling out.
      // So the flight is a plain lerp of that first-line center onto the panel
      // label's center (flyTgt.ly, one line, so its center IS its first line's).
      // Nothing here reads a wrapped height, which is the whole point: the label
      // can re-break as often as it likes and the visible line does not move.
      const lineH = labelFontSize * FOLD6_MFLY_LINE_H;
      const firstLineCenter = labelBase + ((flyTgt ? flyTgt.ly : labelBase) - labelBase) * flyT;
      item.label.classList.add("is-mfly-topanchor");
      item.label.style.top = `${firstLineCenter - lineH / 2}px`;
    } else {
      item.label.classList.remove("is-mfly-topanchor");
      item.label.style.top = `${flyTgt ? labelTop + (flyTgt.ly - labelTop) * flyT : labelTop}px`;
    }

    // The wrap cap lerps alongside the font-size (mobile: 100 → 150 over e6), so
    // the label widens gradually into the mini-legend instead of dropping a whole
    // line in one frame at the end of the glide. Both accessors return null on
    // desktop = "leave the stylesheet alone", so the inline value is cleared.
    item.label.style.maxWidth = capNow == null ? "" : `${capNow}px`;

    // fontSize/color have a meaningful in-between so they lerp continuously
    // over e6 — 18px/opaque-black is is-emphasized's resting state, so e6=0
    // reproduces the pre-fold6 look with no seam. Weight stays regular (400).
    const postFold2 = raw2 >= FOLD2_BEATS.move.start + MOVE_SPAN;
    const postFold6 = !!g.fold6 && fold6Trigger.currentRaw() >= 0.5;
    if (g.fold6 && postFold2) {
      item.label.style.fontSize   = `${labelFontSize}px`;
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
    // Driven by fold6ShapeT so it glides across the swatch with the rest of the
    // fold-4 legend move instead of snapping — and so it never happens on
    // mobile, where there are no two columns to mirror between: the row keeps
    // its column layout the whole way into the מקרא button.
    const sideT = g.fold6 && !isRightLegend ? fold6ShapeT : 0;
    // LAZY on purpose — `offsetWidth` is a forced synchronous layout, and this
    // frame has already written a new font-size and max-width onto this very
    // label, so the read cannot be served from the last layout: the browser has
    // to re-resolve the box, line breaking included, right here. Six of those
    // per frame is bad; the one that hurts is the label with the MOST line
    // breaking to redo, which on mobile is the single three-line label
    // (מפגינים ערבים ישראלים — see GROUP_LABEL_MAX_WIDTH_MOBILE's comment in
    // js/groups.js). That is why the stutter looked like it belonged to one
    // group rather than to the geometry: it was that row paying for a relayout
    // the others could largely skip. The flying path below does not use the
    // width at all (it anchors the box's right edge), so it must not pay for it.
    const labelLeftRest = () => {
      const labelWidth = item.label.offsetWidth;
      const leftAsSwatchFirst = -(labelGap + labelWidth);
      const leftAsLabelLeads  = swatchSize + labelGap;
      return leftAsSwatchFirst + (leftAsLabelLeads - leftAsSwatchFirst) * sideT;
    };
    // Same measured landing as `top` above (flyTgt.lx).
    if (flying) {
      // The OTHER half of the wrap stutter, and the bigger one. `labelLeft`
      // above is derived from `labelWidth` — the box's measured width — and on
      // mobile that box is `width: max-content; max-width: <cap>`. As the cap
      // opens during the flight the text re-breaks and the longest line (hence
      // the box) gets abruptly wider, so `left` lurches by that whole jump. It
      // is also read from the PREVIOUS frame's layout, so it lands late.
      // .is-mfly-topanchor carries `translateX(-100%)`, which anchors the box's
      // RIGHT edge — the edge that faces the swatch and that the text is flush
      // against anyway (textAlign: right at sideT 0, which is every mobile row).
      // The browser resolves the width at paint time, so extra width sheds
      // LEFTWARD, off the far end, and the visible text never moves. Nothing in
      // this path reads offsetWidth. Both ends still line up: at rest the right
      // edge sits at -labelGap (that is what leftAsSwatchFirst encodes), and
      // lxRight is the panel label's own right edge.
      const rightRest = -labelGap;
      const rightTgt  = flyTgt ? flyTgt.lxRight : rightRest;
      item.label.style.left  = `${rightRest + (rightTgt - rightRest) * flyT}px`;
      item.label.style.right = "";
    } else {
      const labelLeft = labelLeftRest();
      item.label.style.left  = `${flyTgt ? labelLeft + (flyTgt.lx - labelLeft) * flyT : labelLeft}px`;
      item.label.style.right = "";
    }
    // Which edge a WRAPPED label's short lines hug (mobile only in practice —
    // desktop labels are nowrap, where this is a no-op). The label box is only
    // as wide as its longest line, and its position is anchored on whichever
    // edge faces the swatch: swatch-first (sideT 0, @fold2/@fold3's columns and
    // the right legend column) anchors the box's RIGHT edge at the swatch, so
    // short lines must be flush right or they float away from it — which is
    // what the LTR default was doing. The left legend column (sideT 1) leads
    // with the label, anchored on its LEFT edge, so it flips. Snapped at the
    // halfway point rather than lerped: text-align has no in-between, and it's
    // a secondary attribute (position never snaps, this may).
    item.label.style.textAlign = sideT > 0.5 ? "left" : "right";

    item.el.classList.toggle("is-emphasized", postFold2 && !postFold6);

    // Last thing in the row, after every inline style is written: while flying,
    // the frame is handed to a stand-in living inside the מקרא layer, because
    // this element can't out-stack that panel from inside .graphic-col (see
    // fold6MFlyPaintClone in js/groups.js). The real item stays laid out —
    // item.label.offsetWidth above depends on it — just not painted.
    if (flying) fold6MFlyPaintClone(g, item, e6 >= 1, flyT, labelFontSize);
    else if (fold6MFlyClones.size) fold6MFlyHideClone(g, item);
  });

  // The other half of the fly hand-off: the panel's own rows appear the frame
  // the travelling ones land (a swap, not a fade), and the arrival is what starts
  // the panel's hold-then-close. Once per frame, not once per row.
  if (fold6MobileLegend && fold6MFlyEnabled()) fold6MFlyArrive(fold6MFlyArriveT(e6));

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
  // Desktop keeps the center-to-center measurement, now in plain px (see below).
  // Mobile instead sets the VISIBLE white directly, measured off the header's
  // own rendered height — see FOLD4_HEADER_GAP_MOBILE_PX for why.
  // The mobile gap is not one number: @fold2's 4×3 block wants the tighter 24px
  // it was tuned at, @fold3's aligned column wants more. So it LERPS between them
  // over alignT — the same beat that flies the rects into their column — rather
  // than being raised for both folds (which visibly opened up @fold2) or snapped
  // at the beat boundary (position never snaps).
  const headerGapMobile = FOLD4_HEADER_GAP_MOBILE_PX
    + (FOLD3_HEADER_GAP_MOBILE_PX - FOLD4_HEADER_GAP_MOBILE_PX) * alignT;
  // The gap is measured off the row the header sits above. Both folds now share
  // one top anchor (fold3TopRowY === fold2TopRowY), so this blend is a constant;
  // it's kept as the blend so the header keeps tracking row 0 if either anchor
  // ever moves again. The gap knobs are fully independent — keep it that way.
  const topRowYNow = fold2RowY(0) + (fold3RowY(0) - fold2RowY(0)) * alignT;
  // Desktop now tracks that blended row too, so the header-to-top-row gap is the
  // SAME in @fold2 and @fold3 (explicit instruction). It used to be pinned flat
  // to fold2RowY(0) while the rows lerped up to @fold3's taller pitch, so @fold3
  // silently ran a tighter gap than @fold2. The constant below is @fold3's gap —
  // FOLD4_HEADER_GAP still means what it always did at @fold2's row (that's the
  // value tuned by eye), and the (fold3 - fold2) term is what @fold3 was actually
  // showing; adopting it moves @fold2's header DOWN to match, leaving @fold3
  // exactly where it was.
  // @fold3 runs a slightly larger gap than @fold2 (per explicit instruction),
  // lerped over alignT like the mobile pair — position never snaps.
  const headerGapDesktop = FOLD4_HEADER_GAP
    + (FOLD3_HEADER_GAP - FOLD4_HEADER_GAP) * alignT;
  // No (fold3RowY(0) - fold2RowY(0)) term here: it was zero back when both
  // pitches were 32 and only existed to preserve that era's tuning — once
  // @fold3 got its own pitch it went nonzero and shoved @fold2's header.
  // topRowYNow already carries the row blend; the gap is just the constant.
  // Plain px, NOT frame-scaled (was `(gap / GROUPS_FRAME_H) * H`, which made
  // this the one distance in the scene that changed on window resize — per
  // explicit instruction it must hold constant like everything around it).
  const fold2HeaderGapDesktop =
    -CLUSTER_SWATCH_SIZE / 2 + headerGapDesktop;
  const fold2HeaderY = isMobile()
    ? topRowYNow - headerGapMobile
        - fold4ColumnTitleCoalitionEl.offsetHeight / 2
    : topRowYNow - fold2HeaderGapDesktop;

  // On DESKTOP they never leave that spot: the headers do NOT travel into the
  // @fold4 mini-legend (per explicit instruction — the legend's two columns
  // carry no camp titles). They stay put and type themselves back OUT over
  // @fold4's own trigger, which is why there's no e6 lerp on size or weight.
  //
  // MOBILE is the same: nothing of the camps stays on screen past @fold4 (per
  // explicit instruction) — the camp names live inside the מקרא panel as static
  // column headings (js/groups.js), so these headers un-type here too and the
  // bar is the only thing left, parked at its own fixed top inset.
  // …EXCEPT in mobile's fly variant, where the headers travel too: they fly
  // onto the panel's own camp headings (.fold6-mlegend-camp) exactly as the rows
  // fly onto its rows, shrinking 18px → FOLD6_MFLY_HEAD_PX on the way and
  // keeping every character (the un-typing below is suppressed for them). Both
  // ends are center anchors — .fold4-column-title is translate(-50%, -50%) and
  // the target is the heading's measured center — so this is a plain lerp.
  // `e6 > 0`, never merely "a target exists" — binding, and for the same reason
  // as `flying` on the rows above. This branch is live from the moment @fold4's
  // trigger exists, i.e. all through @fold2 and @fold3, where e6 = 0 and the
  // headers are just sitting there typing. At e6 = 0 the lerps are no-ops, but
  // the rest is not: it pinned an inline font-size on the header (so its
  // offsetHeight, which fold2HeaderY subtracts half of, stopped following the
  // stylesheet) and swapped the live typing element for a stand-in via
  // .is-mfly-hidden. Both changed @fold2/@fold3's resting header-to-row gap.
  const headFlying = e6 > 0 && fold6MFlyEnabled()
    && !!fold6MFlyHeadTargetOf(FOLD4_HEADER_TITLE_COALITION);
  const placeCampHeader = (el, fold2X, title) => {
    const tgt = headFlying ? fold6MFlyHeadTargetOf(title) : null;
    // Same e6Fly as the flying rows — the headers ride the flight's own
    // low-ease-in curve, not the house e6, so the whole convoy moves as one.
    const x = tgt ? fold2X + (tgt.x - fold2X) * e6Fly : fold2X;
    const y = tgt ? fold2HeaderY + (tgt.y - fold2HeaderY) * e6Fly : fold2HeaderY;
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
    el.style.fontSize = tgt ? `${18 + (FOLD6_MFLY_HEAD_PX - 18) * e6Fly}px` : "";
    if (tgt) fold6MFlyPaintHeadClone(title, el, e6 >= 1);
    else if (fold6MFlyClones.size) fold6MFlyHideHeadClone(title, el);
  };
  placeCampHeader(fold4ColumnTitleCoalitionEl, campAnchorX(true), FOLD4_HEADER_TITLE_COALITION);
  placeCampHeader(fold4ColumnTitleChangeEl, campAnchorX(false), FOLD4_HEADER_TITLE_CHANGE);
  if (isMobile()) fold6PlaceMobileLegend();

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
  // …and on mobile there is no un-typing at all: the headers stay as the מקרא
  // bar's camp names, so both factors are pinned to 1.
  // …and none of it happens in the fly variant: the header keeps every
  // character all the way into the panel, the same rule its rows follow.
  const untypeCoalition = headFlying ? 1 : 1 - fold6BeatT("headerCoalition");
  const untypeChange    = headFlying ? 1 : 1 - fold6BeatT("headerChange");

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
  // Anchored off the mini-legend's BOTTOM row target (last row index) — the
  // note hangs BELOW the right-hand column, which itself is centered on the
  // viewport middle without regard for the note. Deliberately NOT any live
  // groupItems[] position, which is still mid-lerp for most of e6's range and
  // would drag the note in from wherever that row currently is instead of
  // holding it still and just fading it in.
  //
  // The row's bottom edge is built from fold6RowMeasureEl's *settled* label
  // height (not a swatch-height estimate) — the label (14px text) is taller
  // than the 6px swatch it's centered on, so a swatch-based estimate
  // undershoots the row's real edge and makes the gap look smaller than it is.
  // Note lives under the RIGHT legend column (coalition/right-wing rows), NOT
  // the left one. Mirror the left column's inset the same way the rows do
  // (isRightLegend uses W - FOLD6_LEGEND_INSET_RIGHT): the note hugs the
  // left inset, and the note box (RTL, right-aligned text) hugs that edge and
  // extends leftward — so it can't run off the right screen edge the way a
  // left-anchored box would here.
  const noteRightEdge = W - fold6LegendInsetRight();
  const fold6X = noteRightEdge - fold6NoteWidthPx;
  const fold6BottomAnchorY = fold6RowIndexY(FOLD6_ROW_FRAME_YS.length - 1, H);
  // The settled label's box center sits at anchor + half the 6px swatch +
  // groupLabelInkShift — the same `top = swatchSize/2 + inkShift` the live
  // labels get in the loop above — so the row's true bottom edge is that
  // center plus half the measured label height.
  const lastRowLabelBottomTarget = fold6BottomAnchorY + LEFT_LEGEND_SWATCH_SIZE / 2
    + groupLabelInkShift(14) + fold6RowMeasureEl.offsetHeight / 2;
  // The stack reads DOWNWARD from the bottom row: rows, then the note at
  // GAP_TOP + divider + GAP_BOTTOM below, with the divider centered in the
  // white between them (see fold6NoteInkTop below).
  //
  // On a narrow screen watch this against the title card: #fold6NoteLayer is a
  // direct .layout child stacked ABOVE .text-col (so its ACLED link stays
  // clickable), which means it prints *through* the card rather than behind it.
  const noteY = lastRowLabelBottomTarget + FOLD6_DIVIDER_GAP_TOP
    + FOLD6_DIVIDER_HEIGHT + FOLD6_DIVIDER_GAP_BOTTOM;
  // The divider sits at the visual CENTER of the white between the rows and the
  // note — not at GAP_TOP flat. The note's own box top isn't its ink top: its
  // 14px/1.4 line box carries ~3px of transparent leading, so a box-edge
  // midpoint reads high. Compensate by centering on the note's ink instead
  // (1.4 must match .fold6-note's line-height in style.css).
  const fold6NoteInkTop = noteY + (1.4 * 14 - 14) / 2;
  const dividerY = (lastRowLabelBottomTarget + fold6NoteInkTop) / 2
    - FOLD6_DIVIDER_HEIGHT / 2;
  // Note + divider fade in on the ACLED fold (#page-5, @fold6) via
  // acledNoteTrigger — its own fold, one after the squares' grow-in fold
  // (#page-4, squaresRevealTrigger) and two after the split (fold6Trigger). The
  // note POSITION is still anchored to fold6's settled mini-legend target
  // above; only its reveal is deferred.
  // The note now stays up for the rest of the page on both viewports. The extra
  // mobile fade-out on fold9FlyTrigger existed only because the bottom pin sat
  // exactly where @fold8's year axis draws; anchored to the legend it no longer
  // does, so the fade went with the pin.
  //
  // Only the POSITION is desktop-only. On mobile the note flows inside the
  // מקרא panel, so it needs no left/top — but it keeps the same reveal ramp, so
  // opening the panel before @fold6 doesn't show a credit for squares that
  // haven't appeared yet.
  const noteRevealT = acledNoteTrigger.currentT();
  if (!fold6MobileLegend) {
    fold6NoteDividerEl.style.left = `${fold6X}px`;
    fold6NoteDividerEl.style.top = `${dividerY}px`;
    fold6NoteEl.style.left = `${fold6X}px`;
    fold6NoteEl.style.top = `${noteY}px`;
  }
  fold6NoteDividerEl.style.opacity = String(noteRevealT);
  fold6NoteEl.style.opacity = String(noteRevealT);
  // In the panel the note FLOWS, so an opacity-0 note still takes up its full
  // height and the מקרא frame opens with an empty gap under the rows before
  // @fold6 has revealed anything. Take it out of layout entirely until the
  // reveal starts, so the frame grows to fit the note only once it's there.
  // Desktop is absolutely positioned — nothing reserves space — so it stays
  // opacity-only.
  // ...and likewise for the whole of @fold4's hand-off demo
  // (fold6MLegendIntroActive): @fold6 can be crossed while that is still
  // playing, and the note appearing then would push the frame taller under rows
  // that are still typing. It joins the panel at the reader's first tap
  // instead.
  fold6NoteDividerEl.hidden = fold6NoteEl.hidden =
    fold6MobileLegend && (noteRevealT <= 0 || fold6MLegendIntroActive);

  // The מקרא bar appears with the same crossing that dissolves the six rows
  // into it (e6), and stays for the rest of the page — it is the mini-legend
  // from @fold4 onward. pointer-events only switch on past the halfway point so
  // a half-faded button can't be tapped mid-glide.
  fold6SetMobileLegendVisible(fold6MobileLegend ? e6 : 0);

  // (groupsOverlayEl's own "is-active" is set once at init, not toggled here
  // — see the comment by its declaration above.)
  fold6SquaresOverlayEl.style.opacity = "1";

  const e7Label = fold7LabelTrigger.currentT();
  // @fold10 trigger #1 (its title card's ordinary midpoint crossing, see
  // checkFold9 above) colors in only the highlighted square (index 0) and
  // its tooltip's border below — the other 7 squares stay base gray until a
  // later trigger is added.
  const fold9Phase1T = fold9Trigger.currentT();
  // @fold10 trigger #2 (title card fully offscreen, same crossing as the year
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
  // Grow-in is @fold5 (#page-4, «אספנו תיעודים…») via squaresRevealTrigger —
  // detached from fold6Trigger (the split) so the squares only appear on the
  // next fold, after the mini-legend split has settled.
  const growScale = p9Ease(Math.max(0, Math.min(1, squaresRevealTrigger.currentRaw() / GROW_SPAN)));
  // At growScale 0 the wraps are taken out of the layout entirely (display:none
  // below) rather than left standing at scale(0). A zero-scaled box is not
  // reliably invisible — on a DPR>1 phone each of the eight still painted a
  // sub-pixel speck, and since FOLD6_SQUARES_OFFSET arranges them 2 cols x 4
  // rows they read as two small wedges sitting mid-screen on every fold before
  // @fold6. display:none is safe here specifically because nothing measures
  // these wraps; layoutFold6Squares writes their left/top from constants.

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
      ? p7EventForActorOccurrence(FOLD6_SQUARE_ACTORS[i], fold6SquareOccurrence(i))
      : null;
    // Figma node 258:2159: every square except the one with a tooltip (index
    // 0, kept at full opacity) renders at ~46% opacity while still gray —
    // only within @fold9's own trigger window (tooltipT, same value gating
    // the tooltip below): before that window starts, all 8 squares are still
    // uniform (as in @fold6's own Figma frame, 258:2206, where none of this
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
    // Restored to full opacity in step with @fold10 trigger #2 (fold9FlyT) —
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
      if (targetEvent !== p7.hoveredEvent) opacity *= hoverDim(targetEvent.actor);
    }
    // Same parity for @fold11's own hover-dim (p9.hoveredEvent/hoveredCategoryIdx/
    // hoverDimT, page9.js's p9PlaceDot) — these squares are also drawn a second
    // time as an ordinary canvas dot in page9's legit/extreme grid (this DOM
    // square just sits on top of it once it arrives), so without this the
    // square underneath dims/highlights while the visible DOM square on top
    // stays frozen at full opacity, reading as "this dot never dims." Mirrors
    // p9PlaceDot's own three-branch priority (dot-hover > pill-hover >
    // lingering hover-dim tail) exactly, so the two stay visually identical.
    if (typeof p9 !== "undefined" && targetEvent) {
      if (p9.hoveredEvent) {
        if (targetEvent !== p9.hoveredEvent) opacity *= hoverDim(targetEvent.actor);
      } else if (p9.hoveredCategoryIdx !== null) {
        // Same per-actor hoverDim ramp as p9PlaceDot's pill-hover branch.
        const dimFactor = 1 - (1 - hoverDim(targetEvent.actor)) * p9.hoverDimT;
        if (CATEGORY_TO_IDX[targetEvent.category] !== p9.hoveredCategoryIdx) opacity *= dimFactor;
      } else if (p9.hoverDimT > 0) {
        const dimFactor = 1 - (1 - hoverDim(targetEvent.actor)) * p9.hoverDimT;
        const stillHighlighted = p9.hoverDimCategoryIdx !== null &&
          CATEGORY_TO_IDX[targetEvent.category] === p9.hoverDimCategoryIdx;
        if (!stillHighlighted) opacity *= dimFactor;
      }
    }
    // @fold12's own legit-dot fade-out (p9.fold13OutT, drawPage9) only ever
    // fades events whose category is still classified "below" (legitimate) —
    // extreme ("above") events morph away separately instead (p9.fold13ExtremeMorphT,
    // drawPage12). Same classification check, so a square whose category was
    // never dragged to extreme fades out with the rest of the legit grid
    // instead of sitting there alone after everything else has disappeared.
    if (typeof p9 !== "undefined" && targetEvent) {
      const idx = CATEGORY_TO_IDX[targetEvent.category];
      const isExtreme = idx !== undefined && p9.sides && p9.sides[idx] === "above";
      if (!isExtreme) opacity *= 1 - (p9.fold13OutT ?? 0);
      // Once @fold11 reclassifies this square's category to extreme, its
      // canvas twin flies up into the extreme column — but this DOM square
      // only ever blends to p9LegitPosOf (the legit band spot), so it stayed
      // parked on the band: exempt from the pill-hover dim (its category IS
      // the hovered one) and from fold13's legit fade (isExtreme), it read as
      // one permanently-bright dark dot on the band. Hide it and let the
      // canvas twin (drawn at the same pixel underneath) represent the event;
      // also hidden while any drop animation runs, so dragging the pill back
      // to legit can't pop the square onto the band before its twin's return
      // flight has landed there.
      if (currentPage >= 10 && (isExtreme || p9.anim)) opacity = 0;
    }
    // The mobile picker's selection halo (p7DrawInspectScrim, page7.js) is a
    // white scrim painted over the whole CANVAS — so it dims every canvas dot
    // but cannot touch these 8, which are DOM squares sitting on top of it.
    // Without this they stayed at full colour while the chart under them went
    // pale, reading as 8 dots the halo had singled out. Multiplying by
    // 1 - P7_INSPECT_SCRIM matches what the scrim does to a dot on the white
    // page. The picked dot is exempt, exactly as the scrim's own hole exempts
    // it. Drag-time only, like the scrim itself.
    if (typeof p7Inspect !== "undefined" && p7Inspect.dragging && targetEvent &&
        typeof p7InspectPage === "function" && p7InspectPage() !== null &&
        targetEvent !== p7Inspect.event) {
      opacity *= 1 - P7_INSPECT_SCRIM;
    }
    sq.style.opacity = String(opacity);

    // Real-event tooltip (shared #page9Tooltip, see fold8TooltipEl above),
    // shown unconditionally once @fold9's own window starts (e7Label ramping
    // in) — no hover required — until it shrinks away once its own square
    // arrives at its real dot (fold9TooltipShrinkTrigger, see above). Only
    // square 0 currently drives it; if more squares are ever added back,
    // each would need its own tooltip instance.
    const shrinkT = fold9TooltipShrinkTrigger.currentT();
    // p7InspectOwnsTooltip: the mobile picker has taken the docked frame over
    // to show a tapped event (see its comment in js/fold8-tooltip.js). Skipped
    // entirely rather than force-hidden — a hide would reset the sequence and
    // make it replay its grow+type from zero the moment the picker lets go.
    if (i === 0 && !p7InspectOwnsTooltip) {
      const event = targetEvent;
      // shrinkT >= 1 (fold 9's own, later, one-way "arrived at its real dot"
      // collapse) or a missing event forces an immediate hide below —
      // unrelated to @fold9's own scroll reversal, which is handled entirely
      // by fold8SeqElapsed/fold8SeqDirection instead (see their own comments
      // above fold8SequenceEvent).
      // Mobile keeps the EMPTY docked frame on screen after the shrink beat
      // has emptied it (see fold8AdvanceSequence's own opacity branch): the
      // frame is a designated fixture of @fold7/@fold8/the timeline, not a
      // callout that comes and goes with one event, so it holds its spot
      // through them and only stands down once the bridge (@fold10) takes the
      // squares over into page9's grid.
      // It now runs through @fold11 (page 9) as well: the press-and-hold event
      // picker serves that fold too on mobile (p7InspectPage, page7.js), and it
      // needs the same resting empty frame to write into. The bound is a plain
      // <= 10 rather than "7 or 9" so the frame doesn't blink off across the
      // bridge fold (page 8) in between — and it includes page 10 (@fold12)
      // because the IntersectionObserver flips currentPage to 10 partway
      // through @fold12's scroll-in: a <= 9 bound made forceHide fire
      // fold8ResetTooltip at that arbitrary flip point, display:none-ing the
      // frame mid-fade (the "tooltip snaps" bug). Through page 10 the frame's
      // exit belongs to updateFold13's scroll fade instead.
      const keepEmptyFrame = isMobile() && currentPage <= 11;
      const forceHide = !event || (shrinkT >= 1 && !keepEmptyFrame);
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
        fold8DescSpans = fold8SetupTypewriter(fold8TooltipDescEl, event.descHeMedium || "");
      }

      if (forceHide) {
        if (fold8TooltipOwnsIt) fold8ResetTooltip();
      } else if (fold8SequenceEvent) {
        fold8TooltipOwnsIt = true;
        // Colors in step with the highlighted square itself (both driven by
        // fold9Phase1T/@fold10 trigger #1) — gray until the title card's
        // midpoint crossing, then transitions to the actor's real group
        // color together with the square.
        // `color`, not `border-color` — the visible stroke is the dashed <svg>
        // overlay (updateTooltipDash above), which strokes currentColor.
        // Mobile only (keepEmptyFrame): as the docked frame animates up to its
        // timeline spot (fold9FlyT), the stroke fades back to the neutral
        // resting gray — the demo event's actor color leaves with the demo,
        // and the empty frame arrives neutral, ready for the picker.
        fold8TooltipEl.style.color = lerpFold6SquareColor(
          FOLD6_SQUARE_COLORS[0], colorT * (keepEmptyFrame ? 1 - fold9FlyT : 1),
          FOLD8_TOOLTIP_REST_COLOR);
        fold8TooltipEl.classList.add("is-visible");
        // Opens toward the left of the square (mirrored corner, same convention
        // p9HoverInit/p7HoverInit use for left-side events), not the right —
        // its pointer corner (bottom-right when mirrored) is also the point
        // the grow-in below scales from.
        fold8TooltipEl.classList.add("is-mirrored");
        // × (1 - fold13OutT): on mobile keepEmptyFrame keeps this sequence
        // alive through page 9, and updateFold13 calls updateGroups() right
        // after writing its own tooltip fade — an unconditional "1" here
        // stomped that fade every scroll tick (the "tooltip snaps" bug).
        fold8TooltipEl.style.opacity =
          String(1 - (typeof p9 !== "undefined" ? (p9.fold13OutT ?? 0) : 0));
        // Docked (mobile) frame has no pointer corner to scale from — it's a
        // centered box, so it grows straight up from its bottom edge instead
        // of skewing out of the bottom-right corner.
        fold8TooltipEl.style.transformOrigin =
          fold8TooltipEl.classList.contains("is-docked") ? "bottom center" : "bottom right";
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
    const target = p7TargetForActorOccurrence(FOLD6_SQUARE_ACTORS[i], fold6SquareOccurrence(i), W, H);
    // currentPage reaching 12 (drawPage9, PAGES above) is a *harder* signal
    // than p8CurrentT() > 0: the section-level IntersectionObserver that
    // flips currentPage can cross into page9's own slot before page8's own
    // title-reaches-center trigger (page8CheckScroll, watching a narrower
    // condition) ever fires — and once currentPage is actually 10, drawPage9
    // is unconditionally drawing every real dot at its final legit position
    // already, no blend, full stop. Relying on p8CurrentT() alone left a
    // window there where the real grid had already jumped to its final
    // layout but this square hadn't moved at all yet. So: full weight (ease
    // 1) the instant currentPage reaches 11, otherwise follow page8's own
    // blend for as long as it's actually driving the real dots (currentPage
    // === 10). page8CheckScroll/fold9EnsureP8SyncLoop above make sure
    // p8CurrentT() below is both freshly triggered and kept moving even
    // without further scroll events.
    const ease = currentPage >= 10 ? 1 : p9Ease(typeof p8CurrentT === "function" ? p8CurrentT() : 0);
    if (target && ease > 0) {
      if (targetEvent) {
        p9EnsureIndex();
        const side = p9.leftIndexOf.has(targetEvent) ? "left" : "right";
        const indexOf = side === "left" ? p9.leftIndexOf : p9.rightIndexOf;
        const legitGeom = p9LegitGeometry(W, H);
        const legitPos = p9LegitPosOf(targetEvent, indexOf, side, legitGeom);
        if (legitPos) {
          target.x = target.x + (legitPos.x - target.x) * ease;
          target.y = target.y + (legitPos.y - target.y) * ease;
          // Size blends down with the same glide: the legit grid draws at
          // legitSq (2px on ≤1600 desktop) / the bar's own cell on mobile —
          // same end-size rule page8.js uses for every canvas dot. Without
          // this the square kept its timeline size on the band forever,
          // reading as one oversized dot among the small legit dots (a no-op
          // on big desktop, where legitSq === the timeline size).
          const endSq = legitGeom.mode === "bar" ? legitGeom.cell : p9Metrics().legitSq;
          target.size = target.size + (endSq - target.size) * ease;
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
      wrap.style.display = growScale > 0 ? "" : "none";
    } else {
      sq.style.transform = `scale(${growScale})`;
      sq.style.width = sq.style.height = "8px";
      wrap.style.display = growScale > 0 ? "" : "none";
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

// drawFold9/drawFold7 (currentPage 6/5, #page-7/#page-6) used to be static
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
    if (currentPage === 6 || currentPage === 7) draw();
    fold9AxisTicking = false;
  });
}, { passive: true });

