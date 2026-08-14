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
├── #foldNumberBadge      dev fold picker
├── #page9CatTooltip      tray-pill tooltip
├── #fold6NoteLayer       the ACLED source note is reparented here at init
└── .text-col             z-index 1 — the 11 <section.text-section> scroll drivers
```

**`.graphic-col` traps z-index.** Anything that must stack above `.text-col` has to be a
direct `.layout` child, not nested inside `.graphic-col` — that's why the badge, the
category tooltip and the ACLED note layer live where they do. Without it the ACLED
link was unclickable and the tooltips lost to the tray. Don't "tidy" them back inside.

## Scripts and shared globals

Loaded as plain `<script>` tags, in this order (`project.html`):

```
squareboundingbox.js → page1.js → page7.js → page8.js → page9.js → page12.js
→ main.js → reload.js
```

There are no modules and no imports. Every file declares top-level `const`/`function`s
into the shared global scope, and cross-file references resolve **at call time**, not at
load time — so `page7.js` freely calls `GROUPS` (defined later, in `main.js`) because it
only runs after everything has loaded. A symbol used in one file being defined in
another is intentional, not a missing import.

The one place load order does matter: `buildPage0AllDots()` (defined in `page1.js`) is
*called from* `main.js` right after `GROUPS` is declared, because it reads group colors
that don't exist yet when `page1.js` itself is parsed.

| File | Role |
|---|---|
| `main.js` | Scroll controller, `PAGES[]` dispatch, `GROUPS`, all fold triggers, `updateGroups`, the fold-6 squares + @fold8 tooltip sequence, page0 dots, fold13 outro |
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

- `7 → <7`: `p7ResetForReplay()`
- `8 → 9`: seeds `p9.anim` from `p8CaptureBlendedPositions` (`plainGlide: true`)
- `8 → 7`: seeds `p7EntryAnim` from the same capture

then sets `currentPage`, and calls `updateGroups()`, `updateFoldNumberBadge()`, `draw()`.

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
`fitDashArray`/`updateTextCardFrameDashes` in `main.js` keep the repeat aligned.

`.section-title`'s base rule (20px, Hadassah Friedlaender, `font-weight: 600` faking
Medium — there is no true Medium OTF in `fonts/`) is shared by **every** card. No page
should override its font-size or weight; if one title looks differently sized, that's a
regression.

See also: [Folds](Folds.md), [Animation-System](Animation-System.md),
[Dev-Workflow](Dev-Workflow.md).
