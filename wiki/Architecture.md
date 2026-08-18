# Architecture

## Two unrelated entry points

- **`index.html`** — the article/home page ("שקוף" branding). Static content, uses
  `trigger.css`, links to `project.html` via `.shk-cta-button`. Shares no layout or JS
  with the scrollytelling page.
- **`project.html`** — the scrollytelling experience. Everything else in this wiki is
  about this page.

## `project.html`'s layout

```
.layout
├── .graphic-col          z-index 0 — its own stacking context
│   ├── #canvas           full-viewport canvas; all dot/square/axis rendering
│   ├── #groupsOverlay    the 6 persistent group DOM nodes (see Groups-and-Legend)
│   ├── #page0DotsOverlay @fold1's fixed decorative dot columns
│   ├── #fold6SquaresOverlay  the 8 sample squares
│   └── #page9Tooltip     shared hover tooltip (page7 + page9 + @fold6's demo)
├── #page9CatTooltip      tray-pill tooltip
├── #fold6NoteLayer       the ACLED source note is reparented here at init
└── .text-col             z-index 1 — the 11 <section.text-section> scroll drivers
```

**`.graphic-col` traps z-index.** Anything that must stack above `.text-col` has to be a
direct `.layout` child, not nested inside `.graphic-col` — that's why the category
tooltip and the ACLED note layer live where they do. Without it the ACLED
link was unclickable and the tooltips lost to the tray. Don't "tidy" them back inside.

## Scripts and shared globals

Loaded as plain `<script>` tags, in this order (`project.html`):

```
squareboundingbox.js → page1.js → page7.js → page8.js → page9.js → page12.js
→ js/core.js → js/nav.js → js/fold1-intro.js → js/page7-scrub.js
→ js/fold8-tooltip.js → js/groups.js → js/update-groups.js
→ js/page8-9-scroll.js → js/fold11.js → js/bootstrap.js → reload.js
```

There are no modules and no imports. Every file declares top-level `const`/`function`s
into the shared global scope, and cross-file references resolve **at call time**, not at
load time — so `page7.js` freely calls `GROUPS` (defined later, in `js/groups.js`) because it
only runs after everything has loaded. A symbol used in one file being defined in
another is intentional, not a missing import.

Two places load order does matter:

- `buildPage0AllDots()` (defined in `page1.js`) is *called from* `js/groups.js` right
  after `GROUPS` is declared, because it reads group colors that don't exist yet when
  `page1.js` itself is parsed.
- The fold triggers in `js/groups.js` pass their tick callbacks as **arrow wrappers** —
  `makeTrigger(MS, (...a) => updateGroups(...a))` — because `updateGroups`
  (`js/update-groups.js`) and `updateFold13` (`js/fold11.js`) are declared in files that
  load *after* `groups.js`. A bare identifier there evaluates at load time and throws a
  ReferenceError; the wrapper defers resolution to call time. Don't "simplify" the
  wrappers away, and don't fix it by reordering scripts instead — the dependency is
  circular (`update-groups.js`'s `scrollend` listener needs `checkGroupTriggers`, and
  `fold11.js`'s load-time `p13SyncGateVisibility()` needs `page12StickyEl`, both from
  `groups.js`).

| File | Role |
|---|---|
| `js/core.js` | Canvas + `ctx`, `PAGES[]` dispatch, `currentPage`, trivial draw fns, `draw`/`init`, dashed-frame SVG utilities |
| `js/nav.js` | `.text-section` roster, `setActivePage`, the IntersectionObserver |
| `js/fold1-intro.js` | @fold1 logo scroll-fade, title scroll-lag, page-load entrance |
| `js/page7-scrub.js` | `#page-7` scroll→date scrub + its scroll listener |
| `js/fold8-tooltip.js` | @fold6's tooltip typewriter demo (`fold8*` state + fns) |
| `js/groups.js` | `GROUPS` roster, fold2 grid tables, `groupItems` DOM, FOLD6 square tables/elements, title-card refs, `makeTrigger`, **all fold triggers**, `watchCardThreshold` + checkers, legend/fold4/fold6-note constants |
| `js/update-groups.js` | The `updateGroups` monolith, `layoutGroups`, groups/axis scroll wiring |
| `js/page8-9-scroll.js` | page8 title-center hold, page9 sticky/title scroll |
| `js/fold11.js` | Outro morph (`updateFold13`) + the scroll gate |
| `js/bootstrap.js` | Font-load bootstrap + resize handler — **must load last** |
| `page1.js` | `drawPage1` + the @fold1 decorative dot-column builder |
| `page7.js` | The pinned real timeline: per-event square cascade + canvas year axis + hover |
| `page8.js` | Bridge glide from timeline layout → page9's legit grid |
| `page9.js` | Drag-and-drop categorization + dot-migration animation |
| `page12.js` | `drawPage12` outro background |
| `squareboundingbox.js` | Shared grid geometry (`SBB` — only `.top` is read, `SBB_TIMELINE`, `CENTER_GAP`) |
| `reload.js` | Dev-only mtime poll → auto page reload |
| `server.py` | Local dev server + xlsx → `events.json` generation |

Deleted scaffolding that should not be recreated: `main_draft1.js`, `main_bands.js`,
`main_screens_backup.js` and the other `main_screen*.js` files.

## Page dispatch

```js
const PAGES = [drawPage1, drawBackground, drawBackground, drawFoldSplit, drawBackground,
               drawFold7, drawFold9, drawPage7, drawPage8, drawPage9, drawPage12];
```

`setActivePage(page)` is driven by an `IntersectionObserver` with
`rootMargin: "-50% 0px -50% 0px"` — i.e. a section becomes current when it crosses the
viewport's vertical midline. It also handles the cross-fold handoffs:

- `>=5 → <5`: `p7ResetForReplay()` — backstop only; the normal wipe happens in
  `drawFold7`/`drawFold9` once the reverse cascade finishes (see [Timeline](Timeline.md))
- `8 → 9`: seeds `p9.anim` from `p8CaptureBlendedPositions(W, H, 0)` (`plainGlide: true`)
- `8 → 7`: seeds `p7EntryAnim` from `p8CaptureBlendedPositions(W, H, 1)`

Both seed the glide's **endpoint** positions with a back-dated `start`, never the current
blended position with the remaining duration — see [Timeline](Timeline.md#handoff-to-page8page9).

then sets `currentPage`, and calls `updateGroups()` and `draw()`.

`draw()` dispatches to `PAGES[currentPage]`. Scroll-driven per-frame work is
rAF-throttled behind passive `scroll` listeners (`page7Ticking` and friends).

## Title blocks

Each scrolling section's text is a `.section-text.text-card` — a normal-flow, 480px-wide,
horizontally centered block that scrolls with the page (nothing pins). Visibility is an
`.is-visible` class toggled by a scroll-linked `IntersectionObserver`, independent of
`currentPage`.

The dashed white box is a **separate** class, `.text-card-frame`, applied only to the
`<h2 class="section-title">` — never to sibling content like a legend. The dash is not
`border-style: dashed` (too loose); it's a `border-image` sliced so the rounded corners
render unscaled and the 2px-dash/2px-gap edge tiles seamlessly. `DASH_PERIOD = 4` plus
`fitDashArray`/`updateTextCardFrameDashes` in `js/core.js` keep the repeat aligned.

`.section-title`'s base rule (20px, Hadassah Friedlaender, `font-weight: 600` faking
Medium — there is no true Medium OTF in `fonts/`) is shared by **every** card. No page
should override its font-size or weight; if one title looks differently sized, that's a
regression.

See also: [Folds](Folds.md), [Animation-System](Animation-System.md),
[Dev-Workflow](Dev-Workflow.md).
