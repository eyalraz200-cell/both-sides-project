# Groups and the legend

## The roster

`GROUPS` (`js/groups.js`) is **6 groups** — camp groups only. The old no-camp groups
(אתיופיה, סביבתיים, להט"ב, דרוזים…) were removed entirely on v2 and appear nowhere,
hero dots included. Any doc claiming 8/10/12 groups is stale.

`GROUPS` is the source of truth for colors, labels and the `actor` join key.

**מחנה הימין (coalition column, screen-right), top → bottom:**

| Color | Label | `actor` |
|---|---|---|
| `#4A4A4A` | מפגינים חרדים | `Haredi Jews` |
| `#FFAC11` | תנועות התנחלות באיו״ש | `settlers` |
| `#CC0000` | קבוצות ימין לאומיות | `Right-wing activists` |

**גוש השינוי (change column, screen-left), top → bottom:**

| Color | Label | `actor` |
|---|---|---|
| `#CD00CD` | ארגוני שלום ודו קיום | `left wing activists` |
| `#0073FF` | ארגוני מחאה נגד הממשלה | `Protesters against the government` |
| `#00B00C` | מפגינים ערבים ישראלים | *(none)* |

`#00B00C` deliberately has no `actor`: the dataset contains no Israeli-Arab events, so it
never appears on the real timeline. `FOLD4_COALITION_ROWS` / `FOLD4_CHANGE_ROWS` define
the camp membership and row order, resolved by color.

**There is no `P7_COLORS` object.** The name survives only in stale comments. Colors come
from `p7ActorColor(actor)` = `GROUPS.find(g => g.actor === actor)?.color || "#888"`, so
editing a color in `GROUPS` updates the timeline dots, page8's glide, page9's grid and
every tooltip border at once.

## One persistent DOM set

The 6 groups are **one set of DOM nodes** (`#groupsOverlay`, `groupItems`) continuously
repositioned and restyled from `updateGroups()` as the user scrolls — not per-fold
overlays crossfading. Their whole journey:

1. **@fold1** — 12 of @fold1's 200 decorative dots read their color from `GROUPS`
   (`buildPage0AllDots`, called from `js/groups.js` because `page1.js` parses before `GROUPS`
   exists).
2. **@fold2** — the dots fly into two 4×3 blocks of plain rects (Figma `279:1342`), no
   labels, no divider. Only each row's **rightmost** rect is the persistent
   `.group-item`; the other 3 per row are real @fold1 dots flying in as "fillers". Then
   the two camp headers type in on their own beats.
3. **@fold3** — the 18 fillers shrink away, each surviving rect flies sideways so a camp's
   3 rects line up in one vertical column, then the labels type in
   (`FOLD3_TYPE_ORDER`).
4. **@fold4** — the 6 rects glide into the persistent two-column mini-legend at the screen
   edges, and the camp headers un-type. This is the legend's final resting state for the
   rest of the page.

Camp x positions come from the @fold2 grid constants (`FOLD2_CAMP_CENTER_GAP_PX` etc.),
placed symmetrically about screen center in plain px — so they hold at any viewport
width. Only the y values are still read off the `fold4` block in `GROUPS`.

## Mini-legend geometry

```js
const CLUSTER_SWATCH_SIZE = 11, CLUSTER_LABEL_GAP = 16;      // @fold3 state
const LEFT_LEGEND_SWATCH_SIZE = 6, LEFT_LEGEND_LABEL_GAP = 6; // @fold4 state
const FOLD6_LEGEND_INSET_LEFT = 31, FOLD6_LEGEND_INSET_RIGHT = 31;
const FOLD6_ROW_PITCH = 24;
```

Each column is inset from **its own** screen edge, in px (tuned by eye at one viewport —
never converted to vh/vw). Row y's are derived from a single top anchor plus
`FOLD6_ROW_PITCH`, so the three rows can never drift apart:

```js
FOLD6_ROW_FRAME_YS  // the distinct fold6.y values, sorted — used for ROW ORDER ONLY
fold6RowY(g, H, noteShift)        // → top anchor + rowIndex * FOLD6_ROW_PITCH - noteShift
```

`GROUPS`' per-group `fold6.y` is now read **only** to establish row order. All actual
spacing comes from `FOLD6_ROW_PITCH`. Rows are pre-shifted up by `fold6NoteShiftPx` so
the not-yet-visible ACLED note's space is already reserved — no jump when it fades in.

## Camp headers

The two headers (`.fold4-column-title`, 18px Assistant 700, `direction: rtl`, base
`opacity: 0`, `transform: translate(-50%, -50%)` set once at creation) type in at @fold2
and **un-type in place** at @fold4. They do **not** travel into the mini-legend — the
legend's columns carry no camp titles. There is no `e6` lerp on their position, size or
weight; see [Folds](Folds.md) for the beat-mirroring mechanism.

## The 8 sample squares

`#fold6SquaresOverlay` holds 8 plain divs (`FOLD6_SQUARE_REST_COLOR` = `#767676`), which:

- **grow in at @fold5** at screen center, taking the cluster's vacated spot
  (`squaresRevealTrigger`), alongside the ACLED note;
- **gain labels at @fold6** (`FOLD6_SQUARE_LABELS`), while square 0 shows the shared
  `#page9Tooltip` with a real event's date + description, grown and typed on its own
  wall-clock sequence;
- **gain colors and fly at @fold7** — `FOLD6_SQUARE_ACTORS` (via `groupColorByActor`) gives
  each its group color, and `FOLD6_SQUARE_OCCURRENCE` says which chronological occurrence
  of that actor it stands in for. The real cascade never draws those 8 events
  (`p7GetClaimedEvents`), so the DOM square just stays once it lands.

`FOLD6_SQUARE_LABELS` must stay in sync with `P9_CATEGORIES` — renaming a category pill
means renaming the label here too.

The squares also dim on hover-elsewhere, mirroring the canvas dots. That needs the
opacity formula in `js/update-groups.js` **and** the `updateGroups()` calls from `page7.js`/`page9.js`
hover handlers to stay in sync — the squares are DOM, outside `draw()`.

## ACLED note

`FOLD6_NOTE_TEXT` (`js/groups.js`) is rendered into `#fold6NoteLayer` with "ACLED" wrapped as a
link. It's anchored to the right column's bottom row
(`noteRightEdge = W - FOLD6_LEGEND_INSET_RIGHT`) and fades in on
`squaresRevealTrigger.currentT()`.
