# Dev workflow

## Running it

```
python3 server.py     # → http://localhost:8080
```

Requires `openpyxl` (`pip install openpyxl`). The server sends no-cache headers and polls
the mtimes of every `.html`/`.css`/`.js` file at the project root **and under `js/`
(recursively)**; `reload.js` polls `/__mtime__` to auto-reload the browser on any change to
them. It rebuilds `events.json` in memory from the xlsx at startup — but does **not** watch
the xlsx, so spreadsheet edits need a restart. `--port` and `--watch` narrow a second
instance (next section).

### A second, narrower instance (`--port` / `--watch`)

```
python3 server.py --port 8081 --watch page9.js,style.css   # a narrower tab
```

`--watch` takes comma-separated paths relative to the project root (a file, or a directory
watched recursively) and is the **only** thing that instance's auto-reload reacts to;
without it the watch is the default root + `js/` html/css/js set. Both instances serve the
same files from the same directory and can run at once. This exists so a tab focused on one
area isn't reloaded out from under you by every unrelated edit — another
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
1200×630 card) shot of @fold1 at rest, taken headless with any dev-only chrome (a harness
panel, a fold chip) hidden; reshoot it the same way if the hero changes. `og:image` must be an absolute URL, so the
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
  `onGo(el)` to put the fold into the state worth looking at. The scroll is **animated** —
  an instant jump would latch the pins exactly as a load-time jump does. Fires on click
  only, never on load.
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

**None.** No `_debug-*.js` file exists and `project.html` loads no harness. Build one from
the recipe above when a value needs tuning, and delete it (file **and** `<script>` tag) once
the value is baked.

## Previously-built harnesses (all deleted)

What the harnesses baked into — so a rebuilt one knows where its numbers land. Each value
is the live one in code:

| Constant | Live value | File |
|---|---|---|
| `FOLD2_CAMP_CENTER_GAP_PX` (@fold2/@fold3 half-gap: each camp's centre sits this many px either side of screen centre; mobile computes its own from `FOLD2_CAMP_EDGE_GAP_MOBILE_PX`) | 162 | `js/groups.js` |
| `HOVER_DIM_OPACITY` (the shared hover-dim; `HOVER_DIM_BY_ACTOR` overrides per actor) | 0.27 | `js/core.js` |
| `FOLD8_TOOLTIP_CLEARANCE_PX` (@fold7's measured trigger crossing) | −20 | `js/groups.js` |
| `P7_VERT_SQ_BOOST` (desktop axis length) | 1.12 | `page7.js` |
| `TOOLTIP_DOCK_BOTTOM_PX` (mobile docked frame's bottom inset) | −18 | `js/fold8-tooltip.js` |
| `P7_VERT_MOBILE.slotTopPx` (mobile headline slot top) | 78 | `page7.js` |
| `SBB_TIMELINE_LEFT_PX` (@fold9 outer dot edge, desktop) | 190 | `squareboundingbox.js` |
| `P7_INSPECT_SCRIM` / `P7_INSPECT_HOLE_DOTS` (loupe halo-by-subtraction, `p7DrawInspectScrim`) | 0.76 / 1 | `page7.js` |
| `P7_SCOPE_BTN_GAP` (scope pill above the right-hand legend) | 22 | `js/groups.js` |
| `PAGE0_CUE_SCALE` / `PAGE0_CUE_DOT_MS` / `PAGE0_CUE_ROW_STAGGER_MS` (@fold1 idle scroll cue) | 0.3 / 940 / 22.5 | `js/fold1-intro.js` |
| `P12_PAIR_GAP` / `P12_PAIR_SPREAD` / `P12_DOT_COUNT` (@fold15 couples) | 3 / 2.3 / 9250 | `page12.js` |
| `FOLD3_BEAT_MS` (@fold3's beat windows, absolute ms) | see file | `js/groups.js` |
| Hero title/subtitle `font-size`, explicit `line-height`, `top: calc(50% - Npx)` | see file | `style.css` |
| `GROUPS[].color` + `FOLD4_COALITION_ROWS` / `FOLD4_CHANGE_ROWS` (resolve groups by hex — a missed hex goes `undefined`), `FOLD2_GROUP_CELL` (positions), `FOLD2_FILLER_COLORS` (fillers; a group moved onto a filler-override cell evicts it) | see file | `js/groups.js` |
| `PAGE0_GROUP_SLOTS` / `PAGE0_DOT_COLORS` (hero dot arrangement, `{col, row}` with column-local `row`; `buildPage0DotColorSet` walks group slots upward on a short viewport and dedups with one shared `claimed` set across columns) | see file | `page1.js` |

Tricks worth keeping for a rebuild: force a layout re-solve with `p7.lastH = -1;
p7UpdateLayout(W, H); layoutGroups(); draw()` (`p7UpdateLayout` early-returns on unchanged
W/H/count); wrap the writable global `draw` on `globalThis` to overdraw; hit-test by
coordinate against `p9.lastPositions` on `window` listeners (both dot layers are
`pointer-events: none`); and for independent top/bottom axis knobs, recompute
`p7VertTopY`'s centring against the *shipped* length and subtract the top knob rather than
wrapping it — its `Math.max(0, …)` otherwise pins the top and sends all growth downward.

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
