# Dev workflow

## Running it

```
python3 server.py     # → http://localhost:8080
```

Requires `openpyxl` (`pip install openpyxl`). The server sends no-cache headers and polls
the mtimes of every `.html`/`.css`/`.js` file at the project root **and under `js/`
(recursively)**; `reload.js` polls `/__mtime__` to auto-reload the browser on any change to
them. It rebuilds `events.json` from the xlsx at startup and rewrites the committed file when
the content changed (commit it — see [Data](Data.md)) — but does **not** watch the xlsx, so
spreadsheet edits need a restart. `--port` and `--watch` narrow a second
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

## The fold badge

A small fixed chip in the **top-left** corner of `project.html` showing which fold you're
on — `#foldNumberBadge` (`.fold-number-badge` in style.css, driven by
`updateFoldNumberBadge()` in js/nav.js off `currentPage + 1`).

**The number alone — that is the standard for fold numbers wherever they're shown on
screen.** No `@fold` prefix, no page id, no label, no control. It's `pointer-events:
none`, so it never eats a click on the canvas.

On by default; **Ctrl+Shift+F** toggles it and the choice persists in `localStorage`
(`foldNumberBadgeVisible`, read/written inside `try/catch` — browsers with storage blocked
throw a `SecurityError` on access, which would otherwise take the whole script down).
The first paint happens at load, since @fold1 is the starting state and never crosses
`setActivePage` (which returns early on `page === currentPage`).

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

- Floating, draggable, position remembered — and so are the **modes, slider values,
  toggles and active tab** (`localStorage`, per panel title, saved on every change and
  restored on boot): the dev server auto-reloads the page on every file edit, and a harness
  that forgot its state on reload made Copy report defaults the user never picked. Reset
  returns to the last checkpoint (the state at the last Copy, or the loaded state before any
  Copy) — never to the shipped values unless Shift is held. Buttons in fixed order: **Go · Copy · Reset ·
  Pop out · Hide** (`H` toggles hide; the chip is always clickable back).
- **`remoteOnly: true` is the default** in `CONFIG`: the harness injects and answers
  discovery as always, but paints nothing on the page — no panel, no chip. Its UI is the
  `_debug-panel.html` tab. On-page chrome lies on top of the very artwork being judged,
  and on a 390px phone viewport it covers most of it. `H` still summons the panel when no
  panel tab is open; once summoned it behaves normally (`H` again → chip). Set
  `remoteOnly: false` only for a harness you really want floating over the page.
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
- **Copy carries only the knobs that are live.** A slider may declare `when(mode, T)`; a
  false answer keeps it out of the payload, and the `summary()` bake line lists only the
  keys the current combination reads. Every knob in the paste is one the pick depends on.
  With `summaryOnly: true` the payload is the bake line alone — no mode list, no knob dump.
- **A knob whose `when()` is false is not drawn at all.** The host sends its inert keys as
  `off: [...]` on every `desc`/`state`, and both the on-page panel and the remote tab hide
  those rows, so the panel only ever shows sliders that move something in the current
  combination. Changing a mode re-renders the list.
- Gate the harness on the viewport it actually tunes — a desktop panel must not render on
  a phone. **The gate WAITS, it does not bail.** DevTools device emulation is normally
  switched on *after* the page has loaded, so a one-shot check at load time makes the
  harness silently never exist (and never answer the `harness:__all__` discovery ping, so
  it is missing from the panels tab too) until a reload. Wrap the body in a boot function
  and let a `matchMedia` listener start it the moment the window crosses the breakpoint.
- If a harness tunes *when* something fires, draw the threshold on the page: a short tick
  in the margin plus a live marker, colored by state. Never a full-width rule across the
  artwork being judged.
- Bake the **exact px** chosen. Never convert to vh/vw/clamp — the tuning viewport is
  unknown and a converted value re-evaluates differently.
- Delete the file **and** its `<script>` tag once the decision is made. It never ships.

### Pop out, and the remote panel tab

**Pop out** reopens the panel in a real `window.open()` window, so it can be dragged out
of the browser onto a second screen. Two things about that window are easy to get wrong:

- A freshly opened window is still loading `about:blank`, and until that finishes it is a
  **cross-origin frame** — reading `win.document`, or even `win.addEventListener`, throws
  `SecurityError`, and anything written synchronously (`document.write` included) is wiped
  when the load lands. The panel is therefore built from the DOM inside a guarded poll,
  never on a `load` listener.
- A popup blocker returns a **truthy** window object, so `if (!win)` never catches it. The
  in-page panel is hidden only *after* the popped-out panel actually builds — otherwise a
  silently blocked popup leaves nothing on screen.

**Sandboxed embedded browsers refuse `window.open` outright.** VS Code's built-in browser
is a webview, not Chromium: it has no `chrome://` settings page and no popup permission to
grant, so Pop out can never produce a window there. That is what `_debug-panel.html` is
for — the **remote panel**:

- It is a generic, project-agnostic page. Each harness sends it a descriptor (title, modes,
  toggles, knobs, ranges, `source` strings, Go label) and it renders whatever that
  describes, so the one file serves every harness.
- **One tab hosts every harness on the page.** It asks `who` on a shared
  `harness:__all__` channel; each harness answers with its title, and each answer becomes
  a collapsible section. The first section in is open and owns the keyboard; clicking a
  section makes it the one the keys drive. `?t=<title>` narrows the tab to one
  harness — an opt-in, never handed out: it silently hides every other harness, which
  reads as "only one harness showed up". The Pop-out clipboard URL is the bare one.
- Each section then talks to its harness over `harness:<panel title>`, which is why two
  harnesses on the same page never cross-drive each other.
- **One page per section.** The bus relays through the server, so every open copy of the
  page (phone, laptop tab, a headless probe) answers on the same title channel. Each
  harness tags its messages with a per-**tab** `inst` id (random once, then kept in
  `sessionStorage` so the dev server's auto-reload keeps the same id — a fresh id per load
  left the tab addressing a dead host for the 6s grace period, silently dropping every
  click in that window); the section locks onto the
  first page that answers, addresses every command `to` that id, and ignores the others'
  `desc`/`state` — otherwise the controls flip to whichever page spoke last. The other
  pages appear in the section bar as `also <id>` buttons; click one to drive that page
  instead. A silent host is replaced after ~6s. Pages drop commands addressed to another
  id (except `hello`, so the list stays current) and drop anything carrying an `inst`.

#### The transport: `_debug-bus.js` + `/__bus__`, not BroadcastChannel

Messages relay **through the dev server**, so the panel can run on the laptop while the
page runs on a phone — BroadcastChannel only ever reaches tabs in the same browser, which
made the real device the one place the panel could not reach.

- `_debug-bus.js` exposes `HBus(name)`, a drop-in with BroadcastChannel's shape
  (`postMessage` / `onmessage`). One long-poll per client fans out to every channel; a
  sender id drops the client's own echoes. It **replaces** BroadcastChannel rather than
  joining it — running both delivers every same-browser message twice.
- It must load **before** any `_debug-*.js`, and `_debug-panel.html` loads it too.
- `/__bus__` in `server.py` is the relay: `POST` appends, `GET ?since=N` long-polls up to
  25s. In-memory, capped at 400 entries, `since=-1` means "from now" so a freshly opened
  panel isn't replayed stale state. The server runs as a **`ThreadingHTTPServer`** because
  of those parked polls — single-threaded, one long-poll stalls every other request.
- The phone needs the LAN address, not `localhost`; the server prints it on startup.
- Delete `_debug-bus.js` with the last `_debug-*.js`; `/__bus__` and the threading server
  are harmless to leave, being dev-only.
- Open it at `_debug-panel.html`. When Pop out fails it puts that URL on the clipboard and
  says so — the browser that blocked the popup will not open a tab for us either.
- On a harness's first `hello` its in-page panel collapses to its chip; the mode/toggle
  keys work from the remote tab too. Closing the tab brings every panel back via a 2s
  heartbeat — except under `remoteOnly`, where it stays invisible and `H` is the way back (a closing tab's `beforeunload` message often never gets delivered), and each
  chip is always the manual way back. Per-harness **Dock** hands one back on its own.
- The discovery `who` repeats every 1.5s, so **reloading the project tab re-hands its
  harnesses to the remote** without reloading the remote. A title already known that
  answers again is a reloaded page and gets greeted a second time.
- Values echo both ways, but the remote never rebuilds its knob list while you are
  editing: "busy" is pointer-down on a knob **or** a local edit within the last 500ms.
  While busy, an incoming `state` (or a re-sent, unchanged `desc` — discovery re-greets
  every live harness every 1.5s) is patched into the existing inputs in place, sparing
  the key being edited, and the full rebuild is deferred until idle, re-checked on
  firing. Slider ticks are coalesced to one `set` per key per 40ms and carry a `seq`;
  the harness drops a `set` older than the last one it applied for that key (parallel
  HTTP connections do not preserve order) and throttles its own `state` echo to one per
  80ms. Mode buttons/keys repaint their own selection **optimistically** — waiting for
  the echo made every button feel dead.
- `server.py` speaks **HTTP/1.1** so the socket is reused between clicks; every response it
  writes by hand must therefore carry `Content-Length` or the client waits for an EOF that
  a kept-alive connection never sends.
- `_debug-panel.html` is scaffolding like the rest — delete it with the last `_debug-*.js`.

## Currently in the repo

- **`_debug-fold13-check.js`** — a `manual/` harness for **@fold13's selection mark**
  (2026-09-13). Mobile-gated (desktop shows a classification by moving the pill into
  `#page9ZoneAbove`, so `.page9-pill-check` is `display: none` there). Two knobs, written as
  custom properties onto `.page9-sticky` with the shipped values as CSS fallbacks:
  `--p9-check-size` (the square's side, 18px — note it sets the pill's content *height* once
  it outgrows the label's 12px line box, so the pill, the band, and everything derived from
  the band's height move with it) and `--p9-check-radius` (the corner, 4px — `0` is a hard
  square, half the size is back to a circle). The ⓘ beside it is deliberately left round and
  is **not** driven here. Toggle `t` ticks every mark so the selected look is what you judge;
  it only paints the class, it never calls `commitDropState`, so nothing downstream moves.
  `apply()` re-runs `p9MeasureTrayLayout()`. **Marker:** the mark's measured box, the pill's
  height and the band's height, bottom-left. Go → `#page-12`. Bake both as the fallbacks on
  `.page9-pill .page9-pill-check` and delete the file **and** its `<script>` tag.
- **`_debug-fold12-trigger.js`** — a `manual/` harness for **where @fold12 fires**
  (2026-09-12). Mobile-gated. One knob, `crossing (× viewport height)`, writing
  `window.FOLD12_CARD_FRAC` — the fraction of the viewport the title card's **centre** has to
  rise past (`fold12CardFrac`/`fold12TriggerY`, `js/page8-9-scroll.js`; shipped **0.5**, the
  house midpoint). **Smaller holds the fold back** (the line sits higher, so the card travels
  further), larger fires it earlier. It drives `.pills-in` — the pill band arriving a fold
  early, as a wrapped block on mobile — plus `p8Trigger`/`p8TriggerReverse`. `apply()` calls
  `page8CheckScroll()` directly, so dragging the slider past the card fires the fold under
  your finger rather than on the next scroll frame. **Marker** (on by default, `o` toggles —
  this knob tunes *when* something fires, so it may not ship feedback that is only the effect
  itself): a 26px tick in the LEFT margin at the crossing line with its fraction, and a
  second tick for the card's own centre, coloured **armed** (blue, still below) / **firing**
  (red, within 24px) / **fired** (grey, past) with the live gap in px. Go → `#page-11`. Bake
  the pick as the default on `window.FOLD12_CARD_FRAC` and delete the file **and** its
  `<script>` tag in `project.html`.
- **`_debug-mlegend-close.js`** — a `compare/` harness for **how long the mobile מקרא panel
  stays open** after @fold4's hand-off (2026-09-12). Mobile-gated. `0` = the shipped
  behaviour (closes on @fold5's `squaresRevealTrigger`); `1` = stays open to @fold7's **card**
  crossing (`fold7LabelTrigger`); `2` = stays open to @fold7's **established** crossing
  (`fold8TooltipTrigger`, the one the hover demo hangs off). It swaps only the `want`
  expression inside `fold6MLegendAutoBeat` (`js/groups.js`), keeping the memo, the
  reversibility and the "a reader's own tap wins until the next beat" rule intact; nothing
  is written to source. **Marker:** a small right-margin readout listing all three triggers
  with their live progress (armed / firing / fired) and the panel's own open state, so which
  trigger fired is seen rather than inferred. Go → `#page-3`. Delete it (file **and**
  `<script>` tag in `project.html`) once decided.





## Previously-built harnesses (all deleted)

What the harnesses baked into — so a rebuilt one knows where its numbers land. Each value
is the live one in code:

| Constant | Live value | File |
|---|---|---|
| `FOLD2_CAMP_CENTER_GAP_PX` (@fold2/@fold3 half-gap: each camp's centre sits this many px either side of screen centre; mobile computes its own from `FOLD2_CAMP_EDGE_GAP_MOBILE_PX`, and @fold3 from `FOLD3_CAMP_EDGE_GAP_MOBILE_PX` 82) | 162 | `js/groups.js` |
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
