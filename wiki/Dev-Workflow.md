# Dev workflow

## Running it

```
python3 server.py     # → http://localhost:8080
```

Requires `openpyxl` (`pip install openpyxl`). The server sends no-cache headers, polls
`.html`/`.css`/`.js` mtimes, and `reload.js` polls `/__mtime__` to auto-reload the
browser. It rebuilds `events.json` in memory from the xlsx at startup — but does **not**
watch the xlsx, so spreadsheet edits need a restart.

> **Never kill the dev server as a cleanup step.** Leave `:8080` running after verifying
> something. Restarting it on explicit request is fine.

**No build step, no npm, no tests.** Edit the files directly.

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
   `apply(v, mode, tab, on)`, `init(api)`, `custom(box, api, doc)`, `summary(v, mode)`.
3. Insert `if (window.innerWidth < 900) return;   // desktop-only layout` immediately
   after `(function () {`.
4. Add `<script src="_debug-<thing>.js"></script>` at the end of `project.html`'s script
   list.
5. Verify with `node --check` + `curl`.

**Rules (non-negotiable):**

- Floating, draggable, position remembered. Buttons in fixed order: **Copy · Reset ·
  Pop out · Hide** (`H` toggles hide; the chip is always clickable back).
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

`_debug-glide-perf.js` — `@fold10` glide-stutter attribution.

`_debug-note-style.js`, the `manual/` for the @fold6 ACLED note's chevron and title, was
deleted after its bake on 2026-09-04, as were `_debug-note-chevron.js` (rule vs chevron),
`_debug-note-card.js` (the card-style `compare/`) and `_debug-pill-x.js` (the `compare/` for
the dropped-pill ✕ placement). Baked values live in `style.css` and `js/groups.js`.

`_debug-fold-badge.js` — all-viewport corner chip printing the active `@foldN`, its
`#page-(N-1)` id and a one-line name for what plays there. Tracks the same 50%-viewport
crossing the real `IntersectionObserver` uses, so it always agrees with `currentPage`.
Click it or press `B` to collapse it to just `@foldN`. Not a panel harness — no knobs.

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

- **@fold9/@fold11 loupe marker** (`compare/`: crosshair vs halo-by-subtraction vs
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
- **@fold11 row picking** — not a tuning harness: it collected `rowId`s off the page to
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
