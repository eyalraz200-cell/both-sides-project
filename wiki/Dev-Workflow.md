# Dev workflow

## Running it

```
python3 server.py     # → http://localhost:8080
```

Requires `openpyxl` (`pip install openpyxl`). The server sends no-cache headers, polls
`.html`/`.css`/`.js` mtimes, and `reload.js` polls `/__mtime__` to auto-reload the
browser. It rebuilds `events.json` in memory from the xlsx at startup — but does **not**
watch the xlsx, so spreadsheet edits need a restart.

### A second, narrower instance (`--port` / `--watch`)

```
python3 server.py --port 8081 --watch page9.js,style.css   # a narrower tab
```

`--watch` takes comma-separated paths relative to the project root (a file, or a directory
watched recursively) and is the **only** thing that instance's auto-reload reacts to;
without it the watch is the usual "every top-level html/css/js". Both instances serve the
same files from the same directory and can run at once. This exists so a tab focused on one
area (the map, say) isn't reloaded out from under you by every unrelated edit — another
Claude session working on another fold, a CSS tweak, a wiki-driven refactor. Keep the tab on
`:8081` while working there; `:8080` stays the everyday server.

`reload.js` **self-gates to local hosts** (`localhost`, `127.0.0.1`, `[::1]`, `file://`,
`*.local`, **and the private LAN ranges `10.*` / `192.168.*` / `172.16-31.*`**) and returns
immediately anywhere else. The LAN ranges are load-bearing for on-device testing: a phone
hitting `http://192.168.x.x:8080` is otherwise outside the gate, the poller never runs, and
the phone keeps showing a stale page through every edit — a symptom that reads as "the
change didn't work". Only `server.py` serves `/__mtime__`, so
on a deployed host every poll 404s — once per 800ms, forever, with no user action — which
buried the deployed console's real errors under a climbing pile of identical 404s. The
`.catch(() => {})` silences the promise rejection but **not** the browser's own
network-error log line, so swallowing it is not enough: the poller itself must not run.
Don't remove the gate.

> **Never kill the dev server as a cleanup step.** Leave `:8080` running after verifying
> something. Restarting it on explicit request is fine.

**No build step, no npm, no tests.** Edit the files directly.

## Link previews (Open Graph)

Both entry points carry `og:*` + `twitter:*` meta tags in `<head>` so WhatsApp/X/Facebook
render a preview card. `og-image.png` at the repo root is a **2400×1260** (2× of the
1200×630 card) shot of @fold1 at rest, taken headless with `#debug-fold-badge` hidden;
reshoot it the same way if the hero changes. `og:image` must be an absolute URL, so the
tags hardcode the live GitHub Pages base — `https://eyalraz200-cell.github.io/both-sides-project/`.
If the site ever moves, those four URLs (two per file) are the only things to update; the
@fold15 share buttons build their URLs from `location.href` (`p12ShareInit`, page12.js) and
follow the deploy automatically.

## Verifying a change

There's no test suite, so the habit is:

```
node --check js/update-groups.js          # (or whichever file was edited)
curl -o /dev/null -w "%{http_code}" http://localhost:8080/project.html
```

`node --check` catches the syntax errors that would otherwise silently blank the whole
page — a classic `<script>` tag that fails to parse takes every global in it down with
it, and since cross-file references resolve at call time, the visible symptom can appear
in a completely different file.

## Harnesses — `manual/` and `compare/`

When tuning values by eye, build a temporary on-page control panel rather than guessing
numbers in the source.

**Recipe:**

1. Copy `~/.claude/templates/harness-panel.js` → `_debug-<thing>.js` in the project root.
2. Splice the new CONFIG between `var CONFIG = {` and the `END CONFIG` marker line.
   Fields: `title`, `sliders[{key, label, min, max, step, value, source}]`,
   `apply(v, mode, tab, on)`, `init(api)`, `custom(box, api, doc)`, `summary(v, mode)`,
   plus `goTo` / `goLabel` / `onGo` for the Go button (always fill these in).
3. Insert `if (window.innerWidth < 900) return;   // desktop-only layout` immediately
   after `(function () {`.
4. Add `<script src="_debug-<thing>.js"></script>` at the end of `project.html`'s script
   list.
5. Verify with `node --check` + `curl`.

**Rules (non-negotiable):**

- Floating, draggable, position remembered. Buttons in fixed order: **Go · Copy · Reset ·
  Pop out · Hide** (`H` toggles hide; the chip is always clickable back).
- **Every harness gets a Go button** — it teleports the page to the fold being tuned.
  Config: `goTo` (selector or fn, e.g. `'#page-12'`), `goLabel` (`'@fold13'`), optional
  `onGo(el)` to put the fold into the state worth looking at. The scroll is **animated**
  and followed by `ScrollTrigger.refresh()` once it settles — an instant jump would latch
  the pins exactly as a load-time jump does. Fires on click only, never on load.
- **Never scroll or jump the page on load.** No `scrollIntoView`, no `scrollTo`, no hash
  jump in `init`. An instant jump skips pinned/scrubbed sections and latches them into
  their end state, so later folds sit stuck on screen and the page looks broken *because
  of the harness*.
- Each knob is labeled with its `file:line` + current value; **Copy** puts a paste-ready
  summary on the clipboard so numbers are never read off the screen by hand.
- Gate the harness on the viewport it actually tunes — a desktop panel must not render on
  a phone.
- If a harness tunes *when* something fires, draw the threshold on the page: a short tick
  in the margin plus a live marker, colored by state. Never a full-width rule across the
  artwork being judged.
- Bake the **exact px** chosen. Never convert to vh/vw/clamp — the tuning viewport is
  unknown and a converted value re-evaluates differently.
- Delete the file **and** its `<script>` tag once the decision is made. It never ships.

## Currently in the repo

`_debug-fold-badge.js` — the bottom-left `@foldN` chip (`@foldN · #page-(N-1) · short
name`; click or `B` collapses it to just `@foldN`). Reinstated on 2026-09-06 with a `TEMP`
`<script>` tag after `reload.js` in `project.html`; delete both together. The map harnesses (`_debug-map-lab.js`, `_debug-map-details.js`, `_debug-map-dots.js`, `_debug-map-columns.js`, `_debug-map-dot.js`, `_debug-map.js`, `_debug-map-view.js`, `_debug-map-clusters.js`) went with the @fold15/@fold16 event map when it was **archived on 2026-09-08** — the map itself, its data and the last live lab are on the `map-archive` branch (snapshot `834ee0d`); nothing map-related is loaded by `project.html` any more. `_debug-camp-gap.js` —
the `manual/` slider that picked the gap between the two camps at @fold2 **and** @fold3 (they share
one anchor): `FOLD2_CAMP_CENTER_GAP_PX` 180 → **162**, re-laying out live with `updateGroups();
draw()`. The knob was the HALF-gap — each camp's centre sits that many px either side of screen
centre — so one step moved the camps 2px apart. It never touched mobile, which computes its own gap
from `FOLD2_CAMP_EDGE_GAP_MOBILE_PX`. Deleted on 2026-09-07 once baked. Three @fold9 axis-plaque
`compare/` panels — `_debug-axis-align.js` (picked the description's alignment: flush to the
card's axis-side edge), `_debug-axis-others.js` (picked the other plaques collapsing into the
axis on hover, over dimming them) and `_debug-axis-title.js` (kept the title's fade-in over
typing it) — were all deleted on 2026-09-07 once baked. `_debug-hero-title.js` was **deleted on 2026-09-10** (file + `<script>` tag), its values long since baked into `style.css`. Baked on 2026-09-07: title `line-height: 1.31` (what `normal` already resolved
to, now stated), subtitle `line-height: 1.52` with `top: calc(50% - 189.1px)` desktop /
`172.1px` mobile, trimmed gaps 23.73px / 20px. The `manual/` panel for @fold1's hero titles, two tabs
(title / subtitle) × three knobs: font-size, line-height, and the gap from the element's box
bottom to the top dot of the column it sits over. That gap is **not** a CSS property: it is
derived from the element's live measured box height against the `page1.js` dot lattice
(`page0DotBaseOffsetY()`, `PAGE0_DOT_STEP`, `PAGE0_DOT_SQ`), so `top` is recomputed whenever
size, line-height, the webfonts or the viewport change — hence the `init` that refreshes on
`document.fonts.ready` and `resize` (without it the fallback face wraps the subtitle to an
extra line and the panel moves it on load). Each tab carries its own starting values, since
the subtitle ships with a different font, line count and gap. It bakes back into `style.css`
as `font-size`, an explicit `line-height`, and `top: calc(50% - Npx)`. Two toggles — `R`
(title) and `S` (subtitle) — draw a full-width dashed rule per rendered line, plus a live
line-count readout. A line box has no element to measure, so the rules come from a `Range` over the
element's contents (`getClientRects()` = one rect per rendered line), re-synced in a rAF loop since
the hero texts are `fixed` and `page0ApplyTitleScrollLag` nudges them every frame. Both the rules
and the gap knob use each line's **trimmed** bottom — its alphabetic baseline, `rect.top +
half-leading + ascent` with ascent/descent read off a canvas `TextMetrics` — not the line box's
bottom, which carries the descender plus half-leading and grows with line-height. Untrimmed, the
gap knob moved whenever line-height moved and the two elements' numbers were incomparable
(9.7 vs 19.7 for what the eye reads as one distance; trimmed the same shipped layout reads
23.73 vs 24.71). The baseline is taken as an **offset from the element's own box top**, never as
an absolute y: @fold1's intro parks the title at `translateY(100vh)`, so absolute rects are a
viewport off until the slide-in finishes. Everything else
was removed earlier (`_debug-glide-perf.js`, `_debug-mlegend-width.js`,
`_debug-vert-mobile.js`, `_debug-fold5.js` and the `_debug-hero-*.html` probes). `_debug-axis-desc.js` — the
`compare/` that picked @fold9's hover-description card width (keep the plaque width, not
widen over the grid) — was deleted on 2026-09-07 once baked. The mobile
vertical-axis `compare/`+`manual/` (`_debug-vert-mobile.js`, modes band / widen / slot with
`P7_VERT_MOBILE` knobs) was deleted before its bake; rebuild it from the template if the
mobile axis is picked up again. `_debug-vert-order.js` — the `compare/` panel that picked the
mobile @fold9 vertical order (מקרא bar / axis headline / grid / docked tooltip) — was deleted
on 2026-09-05 once that order was baked. `_debug-axis-len.js` — the `manual/` that picked
`P7_VERT_SQ_BOOST` (1.08) and `TOOLTIP_DOCK_BOTTOM_PX` (0) — was deleted the same day. It
tuned the axis length by **wrapping the writable global `p7SolveVerticalSq`** and forcing a
re-solve with `p7.lastH = -1; p7UpdateLayout(W, H); layoutGroups(); draw()`, since
`p7UpdateLayout` early-returns on unchanged W/H/count. `_debug-axis-geo.js` — its successor,
which re-picked the boost (1.12) plus `TOOLTIP_DOCK_BOTTOM_PX` (−18) and
`P7_VERT_MOBILE.slotTopPx` (78) — was deleted the same day. Its one non-obvious trick: to
give the axis **independent** top and bottom knobs, don't wrap `p7VertTopY` and lean on its
centring — the boosted span overflows the box, so its `Math.max(0, …)` pins the top and
silently sends all growth downward. Recompute the centring against the *shipped* length and
subtract the top knob, so 0/0 reproduces the shipped geometry exactly.

Delete each file **and** its `<script>` tag when it is no longer wanted.


*(`_debug-fold3.js`, the `manual/` that picked `@fold3`'s per-camp row order and the 180px
camp gap — it permuted `fold6.y` among a camp's three groups rather than turning any order
field, since `legendRow` derives the order from those y values,
`_debug-tooltip-style.js`, the `compare/` that picked the desktop tooltip's group-colour
fill over the old white-box-with-dashed-stroke, `_debug-tooltip-weight.js`, the `manual/`
sliders that picked the tooltip description's 550 weight, `_debug-fold4-handoff.js`, the `@fold4`
hand-off compare, `_debug-edge.js`, the `@fold9`
outer-dot-edge `manual/` slider that picked `SBB_TIMELINE_LEFT_PX`, and `_debug-axis.js`,
the `@fold9` vertical-axis knobs that picked `P7_VERT`, were all deleted once their work was
done.)*

## Previously-built harnesses (all deleted)

The tuning harnesses that existed are gone; what's worth keeping is what each one *baked into*, so a rebuilt
version knows where its numbers land:

- **@fold9/@fold13 loupe marker** (`compare/`: crosshair vs halo-by-subtraction vs
  grow-the-selection) — halo won, and it moved out of the loupe onto the main canvas:
  `P7_INSPECT_SCRIM` / `P7_INSPECT_HOLE_DOTS` + `p7DrawInspectScrim` in `page7.js`.
- **@fold2 dot colours/positions** — group colours → `GROUPS[].color` **plus** the
  hex-literal lookups `FOLD4_COALITION_ROWS` / `FOLD4_CHANGE_ROWS` (they resolve groups by
  hex and go `undefined` if missed); positions → `FOLD2_GROUP_CELL`; filler colours →
  `FOLD2_FILLER_COLORS`. Moving a group onto a cell with a filler override evicts it.
- **@fold1 hero dot arrangement** — group slots → `PAGE0_GROUP_SLOTS`; decorative
  moves/recolours → `PAGE0_DOT_COLORS` (both `page1.js`, `{col, row}` with column-local
  `row`). Two things a bake must survive, both already handled in `buildPage0DotColorSet`:
  a short viewport ending a column above an arranged row (group slots walk upward, stray
  decorative rows are skipped and rejoin the palette), and palette dedup being **one
  shared `claimed` set**, not one per column — otherwise an arranged colour carried across
  columns gets dealt twice.
- **@fold13 row picking** — not a tuning harness: it collected `rowId`s off the page to
  paste back into `full_v3.xlsx`. Its two reusable tricks: hit-test by coordinate against
  `p9.lastPositions` on `window` listeners (both dot layers are `pointer-events: none`),
  and overdraw by **wrapping the global `draw`**, which is a writable property of
  `globalThis`.

## Making a constant live-tunable

Flip `const` → `let` for the duration of the harness — a top-level `let` in a classic
script lives in the shared global lexical environment, so `_debug-*.js` can assign it.
Revert to `const` when baking the value.

## Reading the code

Files are large and heavily commented. Prefer `grep -n` plus line-ranged reads over
reading a file end to end — the comments carry a lot of "why", so grepping for a constant
name usually lands directly on its rationale.

## Checking mobile

There's no device lab, so visual mobile verification is done in the browser's own device
emulation at **393×852** (the size the Figma mobile frames are drawn at). The breakpoint is
600px — see [Architecture](Architecture.md#mobile--responsive).

### Horizontal-overflow check (headless)

Layout overflow is measurable rather than eyeballed, and worth re-running after any width
change. There's no browser in the repo, but `npm i puppeteer` into a scratch directory
(never into the project — there is no `package.json` here and there must not be one) gives
a headless Chromium. The check that matters, per viewport width and at ~20 scroll positions
down each page:

- `document.documentElement.scrollWidth > clientWidth` → the document itself scrolls
  sideways. This is the bug the user actually feels.
- any element whose `getBoundingClientRect()` crosses either viewport edge → paints
  off-screen. A `position: fixed` ancestor means it can't extend document scroll, but it's
  still visibly clipped, and mobile browsers can pan to it.

Sweep **320 / 360 / 393 / 430 / 600 / 768 / 1024 / 1440** on both `index.html` and
`project.html`. 320 is the useful floor — it catches fixed-width rows that survive 393.
Remember the article page is RTL, so overflow extends *left*: `getBoundingClientRect().left
< 0` is as much a failure as `right > vw`.

Fix the offending element's own width; don't reach for `overflow-x: hidden` on `html`/`body`
— it hides the symptom and makes the next one invisible to this check.

What to actually check, since most regressions here are directional:

- Scroll folds 1–7 and 11 **both ways**. Every fold animation is a reversible trigger, so a
  layout value that only looks right scrolling down is still broken.
- Resize across 600px **mid-session**. The resize handler rebuilds the dot columns, re-picks
  the @fold2 fillers and clears the label-width cache; a value cached on the wrong side of
  the breakpoint shows up as @fold3's two camps sitting off-center.
- Confirm **desktop at 1440px is pixel-identical** to before. Everything mobile is gated on
  the breakpoint, so any desktop movement is a bug in the gate, not a tradeoff.
