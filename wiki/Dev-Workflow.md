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

### One worktree + one server per chat (`--port 0`)

Several Claude chats editing one checkout all feed the same `:8080`, so every chat's edit
reloads every tab. The fix is isolation, not a narrower watch:

```
git worktree add ../both-sides-<topic> -b <topic>   # one per chat / task
cd ../both-sides-<topic> && python3 server.py --port 0   # prints its own free port
```

Each worktree has its own files and its own server, so a tab only reloads for the edits of
the chat that owns it, and two chats can never half-apply edits to the same `style.css`.
Merge the branch when the task is done (`git merge <topic>` from `main`, then
`git worktree remove ../both-sides-<topic>`). The harness bus (`/__bus__`) is per server too:
open that worktree's `_debug-panel.html` on the same port.

### Auto-reload is OFF by default (`reload.js`)

Several Claude sessions edit this one checkout at once, and every save used to reload every
open tab — so reading or tuning in one tab was interrupted by work happening in another.
A tab now reloads itself **only** while its auto-reload switch is on:

- The switch lives at the foot of the harness panel's rail, and as
  `window.setAutoReload(on)` on the page. It is **per tab** (`sessionStorage`), so one tab
  can be frozen while another keeps up.
- A frozen tab is showing stale code, and a silently stale tab is a trap — you report a bug
  that is already fixed, or tune against values that have moved. The warning therefore
  lives in the **panel's rail**: a small yellow NUMBER beside the switch, the count of
  changes this tab has not taken (the number alone, house style — noticeable, not a
  banner). Clicking it reloads the
  page without switching auto-reload on — the one-off "show me the latest". **Nothing is
  drawn on the page itself**: the page is the artwork being judged, and a badge over it is
  exactly what harnesses are forbidden from doing. `window.autoReloadState()` exposes
  `{on, behind}`; `window.reloadNow()` is what the badge calls, over the bus.
- Switching auto-reload back on reloads immediately when the tab is behind.
- `reload.js` saves `scrollY` before reloading and restores it after `load` (then
  `ScrollTrigger.refresh()`), so catching up lands back on the fold under review.

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

`og:description` / `twitter:description` are the **same sentence on both pages**, and it
quotes the event count as a **hardcoded number** (currently 14,451 — `len(events.json)`).
Nothing recomputes it, so re-check it whenever either xlsx is regenerated or the preview
card starts advertising a count the timeline no longer holds.

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

Switched off it is **gone — no dot, no chip** (**removed — don't reintroduce**: the 7px dot that used to stand in for it, invisible on the near-white page); the way back is the harness panel tab's fold-badge switch, which `_debug-bus.js` answers so it survives the last harness being deleted.

**DEV ONLY — it must NEVER appear on the deployed site** (explicit, binding instruction).
The gate is `isLocalHost()` (js/core.js): js/nav.js only looks the element up when that is
true, so on any public host `foldNumberBadge` is `null`, neither `.is-visible` nor
`.is-dot` is ever added, and the base rule's `display: none` holds. Both the Ctrl+Shift+F
listener and the picker live inside that same branch, so nothing can switch it back on — a
stale `foldNumberBadgeVisible: "1"` in a visitor's `localStorage` included. `isLocalHost()`
counts loopback, `file://`, `.local` Bonjour names and the private LAN ranges (a phone
hitting the Mac at `http://192.168.x.x:8080` is still development); everything else is not
local. `reload.js` keeps its **own** copy of that test on purpose — it is what picks up the
fix when js/core.js is the file that failed to parse, so it must not depend on js/core.js
having run. Keep the two in sync.

**The number alone — that is the standard for fold numbers wherever they're shown on
screen.** No `@fold` prefix, no page id, no label.

**Clicking or tapping it opens the fold PICKER, on BOTH breakpoints** — a list of all 16
folds that jumps to the one you pick (`foldPickerInit`, js/nav.js). It used to be
mobile-only because Ctrl+Shift+F "covered" desktop, but that shortcut only toggles the
badge and never navigates, so desktop had no fold jump at all. The badge is therefore
`pointer-events: auto` now; it is a ~30×20 chip in a corner where no canvas interaction
lives (the drag zone, the timeline and the legend all sit further in). Rows are built from
the sections themselves — the number plus that fold's own `.section-title`, with the
`.copy-desktop` half of any breakpoint-split headline stripped out, falling back to the
section id for the folds that carry no title card (@fold1 and @fold9) — so the list cannot
drift out of step with `project.html`. The current fold is marked and scrolled to inside
the panel, so it opens oriented. A click outside, Escape, or picking a row dismisses it.
The panel is capped at **340px** wide on desktop (a fixed box shrink-to-fits, and the long
Hebrew titles stretched it most of the way across the viewport); mobile keeps its
`calc(100vw - 24px)`.

**Dismissing leaves a 7px dot, never nothing.** The panel's last row hides the badge and
Ctrl+Shift+F still toggles it, but either way it collapses to a dot in the same corner
rather than vanishing — clicking the dot brings the number back. Without that there was no
way to switch the badge on again on a phone, which has neither Ctrl nor Shift. Same rule
the harness panel's chip follows: never un-dismissable. The state persists in
`localStorage` under `foldNumberBadgeVisible`.

The jump is **animated** (`FOLD_PICKER_SCROLL_MS`, 700ms, fixed duration rather than fixed
speed), never an instant `scrollTo`, for the same reason harnesses must not jump on load: an
instant jump skips every pinned/scrubbed section it passes and latches those folds into their
end state, leaving later ones stuck on screen — the page then looks broken because of the
navigation aid.

## Harnesses — `manual/` and `compare/`

When tuning values by eye, build a temporary on-page control panel rather than guessing
numbers in the source.

**Recipe:**

1. Copy `~/.claude/templates/harness-panel.js` → `_debug-<thing>.js` in the project root.
   **Regenerating an existing harness from a newer template** = its head up to `END CONFIG`
   + the template's tail — but a viewport-gated harness ends in `});`, not the template's
   `})();`. Get that wrong and every global in the file dies with an opaque
   "(intermediate value) is not a function" on load.
2. Splice the new CONFIG between `var CONFIG = {` and the `END CONFIG` marker line.
   Fields: `title`, `sliders[{key, label, min, max, step, value, source}]`,
   `apply(v, mode, tab, on)`, `init(api)`, `custom(box, api, doc)`, `summary(v, mode)`,
   plus `goTo` / `goLabel` / `onGo` for the Go button (always fill these in).
   **`timeline`** (optional) draws the ms knobs as lanes of segments in the panel tab —
   `{ lanes: [{ label, offset: [{key, mul|mulKey}], segs: [{ key, label, mul|mulKey, after, derived }], marks: [{ label, at: [...] }] }] }`.
   Every key is also a slider (the timeline is a second view over the same values, so
   Copy / Reset / ↺ / undo need nothing extra); a segment's right edge drags its knob,
   the fields under the lanes take a typed ms. It is plain data, so it crosses the bus —
   unlike `custom`, which only the on-page panel can run.
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
- **Declare the breakpoint, don't hand-roll the gate.** `CONFIG.viewport` is `'mobile'`,
  `'desktop'` or `'both'` (the default), and the template injects the harness only where
  its knobs mean something. The gate **waits** for the breakpoint rather than bailing —
  DevTools device emulation is switched on after load, and a one-shot check made the
  harness silently never exist (and never answer discovery, so it was missing from the
  panel too) until a reload. The panel's rail marks anything that is not `'both'`. A
  harness on the page but gated to the OTHER breakpoint still answers discovery as
  **dormant**, and the rail lists it greyed with `mobile only` / `desktop only` — so an
  empty-looking rail says why instead of reading as "nothing exists". The main area keeps
  a hint (inspect an element) whenever nothing is open.
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
- **One tab hosts every harness on the page, one at a time, from a LEFT RAIL.** It asks
  `who` on a shared `harness:__all__` channel; each harness answers with its title and
  becomes a row in the rail, **labelled with its fold** above its name (`@fold9` /
  `dot size and glow`) — `CONFIG.fold`, or lifted out of the Go label when that names one.
  A vertical list stays readable as harnesses accumulate; the old top strip wrapped into a
  block.
- **Name a harness for a person, not for the filesystem.** `CONFIG.label` is what the rail
  shows — plain words for the thing being tuned (`axis draw-in`, `legend sheet colour`).
  `CONFIG.title` stays the bus channel and the Copy header, and stands in when no label is
  set, but a rail full of file slugs is a rail you have to decode.
- **Delete** (right end of a harness's toolbar) means "this harness is done, take it out of
  the repo". The panel cannot touch files: it POSTs `/__trash__` and `server.py` appends the
  request (file, title, label, fold, time) to **`_debug-trash.json`** (untracked). A
  `UserPromptSubmit` hook in `.claude/settings.json` prints that queue to Claude at the
  start of every message, so Claude removes the `_debug-*.js`, its `<script>` tag in
  `project.html` and its wiki mentions together, then empties the queue to `[]`. The rail
  strikes the row through meanwhile and the harness hands itself back. A harness knows its
  own file from `document.currentScript` (captured below the config-end marker, so the
  splice recipe carries it).
- **Copy is mirrored to Claude too.** Besides the clipboard, every Copy POSTs `/__copy__`
  and lands in **`_debug-copy.json`** (untracked); the same hook shows it at the start of the
  next message, so a pick reaches the chat without a paste. **Routing:** a queue cannot
  know which chat built a harness, so the rule is on the reader — each chat acts only on
  entries for harnesses it built itself (matched by file/label), removes just those from the
  file, and leaves the rest, saying so in a line. Delete entries may be acted on by any chat.
- **The rail shows what exists on disk, not what a tab remembers.** The panel polls
  `/__harnesses__` (the `_debug-*.js` files `project.html` loads right now — `_harness_files()` in server.py scans the HTML for any quoted `_debug-*.js` name, so it reads both a plain `<script src>` tag and the name in the dev-host-only loader's array; a tag-only scan came back empty once the loader arrived and the rail hid every harness) every 3s and
  hides — or drops — any row, live or dormant, whose file is not in that list. Auto-reload
  is off, so a page tab loaded before a deletion keeps announcing the deleted harness until
  it reloads; without this the ghost row came straight back.
- **Regenerating a harness from the template**: the file's head up to the config-end
  marker + the template's tail. Match that marker with `grep … | head -1` — a comment that
  merely mentions the marker's words once broke the splice.
- **Open in browser** (foot of the rail) reopens the panel outside VS Code's Simple
  Browser. That webview refuses `window.open` outright and has no popup permission to
  grant, so when the window does not appear the button puts the URL on the clipboard
  instead — paste it into a real browser.
- **The panel's own look is themeable** (`Look` at the foot of the rail): 12 palettes and 6
  type styles. **No ALL CAPS anywhere** — a capital goes where a capital belongs, on the
  first letter of a label, via `--label-cap` on `::first-letter`. That pseudo-element only
  takes on a BLOCK container, so a label wrapped for it must be `inline-block`, and it must
  wrap the WORD: on a mode button it would otherwise capitalise the key letter in front. Every rule in the panel reads from tokens on
  `:root` (`--bg`, `--bg-rail`, `--bg-el`, `--line`, `--text`, `--text-dim`, `--accent`,
  `--warn`, `--font`, `--fs`, `--label-tt`…), so a new theme is a row in the `PALETTES` /
  `TYPES` table and nothing else — anything hard-coded in the CSS is a bug, because it will
  not follow the theme. Digits 1-9 pick a palette and `q w e t y u` a type style (**`r` reloads the page being driven** — the site, not the panel — without switching auto-reload on), but a key
  the open harness claims for a mode or toggle always wins, and `0` is never taken (it
  clears the modes). Light palettes flip `color-scheme` so the native controls follow. The
  pick persists in `localStorage`.
- **Nothing on the toolbar but the buttons** — no harness name, no branch, no port, no
  host id. The rail already says which harness is open, and the id only ever mattered when
  a second page was running the same harness, which is what the `drive <id> instead`
  button that appears then already says. No section headings either, over the knobs, the
  toggles or the rail's switches: labelled controls do not need a word above them.
- **A knob's `source` is not drawn.** `file:line` under every row made the panel a wall of
  grey code paths. It is for the bake, not the eye — **Copy** still carries it, which is
  where it is read.
- **Page-wide switches live at the foot of the rail**, not inside a harness: the dev
  **fold number** badge and **auto-reload**. Both ride the `harness:__all__` channel
  (`{t:'foldbadge'|'autoreload', on}`), every harness on the page applies it
  (`setFoldBadgeVisible()` / `window.setAutoReload()`), and each `iam` answer reports the
  state back so the checkboxes self-correct. See the auto-reload section under Running
  it. Only the picked harness is rendered and the keys drive it (the pick is
  remembered in `localStorage`). `?t=<title>` narrows the tab to one
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
- **Build once, patch forever.** The remote builds a harness's DOM once per descriptor
  (a changed descriptor = an edited harness after a reload) and never rebuilds on a
  timer. Every `state` echo (and the unchanged `desc` re-sent on each 1.5s discovery
  round) is patched into the existing inputs in place, skipping any knob under the
  pointer or edited locally in the last 600ms. This is what makes the colour picker
  work: v1 rebuilt on every echo and tore the input down under the open dialog.
- **Own colour picker** — a swatch opens an inline hue strip + saturation/value square +
  hex field + preset swatches (the six group colours, white, black, grey). Never
  `<input type=color>`: the native dialog is unreliable in webviews and on phones.
- **Knobs are scoped and grouped.** A knob with `modes: ['a', 'b']` only shows while one
  of those modes is picked (the page computes it into `off`; the remote applies the same
  rule locally so a mode click reshapes the list before the echo lands). Knobs with a
  `group` sit in collapsible sections, the first open, each showing its live count. Two
  columns from 700px.
- **Per-knob reset.** Every row has `↺`: click = that knob back to the last checkpoint
  (`{t:'reset', key}`), Shift-click = its shipped value (`ship: true`). The toolbar Reset
  still does the whole harness.
- **Labels are what you see change**, in plain words (`gap between dots`, `wipe
  duration`), never CSS names; the property and `file:line` live in `source`, shown small
  under the knob and included in Copy.
- Slider ticks are coalesced to one `set` per key per 40ms and carry a `seq`;
  the harness drops a `set` older than the last one it applied for that key (parallel
  HTTP connections do not preserve order) and throttles its own `state` echo to one per
  80ms. Mode buttons/keys repaint their own selection **optimistically** — waiting for
  the echo made every button feel dead.
- `server.py` speaks **HTTP/1.1** so the socket is reused between clicks; every response it
  writes by hand must therefore carry `Content-Length` or the client waits for an EOF that
  a kept-alive connection never sends.
- **There is no "Dock"/"Hand back" button.** It used to return a harness to its in-page
  panel, but with `remoteOnly: true` the default there is no in-page panel to return to —
  pressing it just made the harness vanish. Close the tab (or press `H` on the page) to get
  the in-page panel back.
- `_debug-panel.html` is scaffolding like the rest — delete it with the last `_debug-*.js`.

**Live right now:** `_debug-hint-band.js` (@fold9, mobile) — the picker's instruction band.
A `compare/` mode pair for the placement (`above` the timeline, shipped, vs `below`) driving
`P7_HINT_PLACE_MOBILE`, and two `manual/` sliders: `P7_HINT_Y_MOBILE` (the hint up/down) and
`P7_FIELD_Y_MOBILE` (the whole timeline up/down). Both nudges are positive = down.
Both invalidate `p7.lastH` before redrawing: the band is reserved out of the timeline's box, and
`p7UpdateLayout` early-returns on an unchanged W/H, so without it the grid would not re-pack and
the timeline would not move with the band.

### The element inspector (`_debug-inspect.js` + the panel's Element tab)

**Cmd + click** an element on the desktop page, or **double-tap** it on a phone, and
the panel opens an **Element** row above the harness list with that element's **nesting
chain** as a breadcrumb — `div.layout › section#page-1 › div.section-text › h2` — because
the padding you want is rarely on the thing you hit. Pick the level (click, or `[` out /
`]` in), then edit: Text (size, weight, line height, letter spacing, align, case, colour),
Fill & border (fill, opacity, radius, border), Spacing (padding ×4, margin ×4, gap when the
element is flex/grid), Size (width, height, hidden). Every row has ↺ back to the
stylesheet value; edited rows carry an accent dot. `Esc` or **Clear** drops the selection.

- **Text elements get a Text field** at the top of the Text group — the element's OWN
  text (its direct text nodes; children stay). Every keystroke lands on the page live;
  ↺ restores the original. Copy carries it as `textChange: [from, to]`.
- **Cmd+Z / Cmd+Shift+Z** (Ctrl elsewhere) undo and redo across the whole panel —
  inspector edits, text edits and harness knobs alike, one stack. Consecutive edits to the
  same control within 800ms merge, so a slider drag is one step. An undo re-aims the
  inspector at the level the edit was made on before re-sending it.
- Page side is `_debug-inspect.js` (template `~/.claude/templates/harness-inspect.js`),
  loaded right after `_debug-bus.js`. It draws the selection outline on the page (the one
  piece of chrome an inspector cannot do without), applies edits as **inline overrides**,
  and keeps them in `sessionStorage` by selector so an auto-reload does not wipe them.
- **Copy** hands back the **visual-edit change-list** — a bullet summary plus a JSON array
  of `{selector, tag, text, op:"style", changes:{camelProp:[from,to]}, viewportPx}` — which
  Claude applies to the real stylesheet the way the visual-edit skill describes
  (shared rules over one-off overrides, responsive units preserved, `left`/`right` back to
  `start`/`end` on this RTL page). Nothing here writes to source.
- Align values are **physical** (`left`/`right`) because that is what `getComputedStyle`
  reports; the stylesheet uses logical ones.
- It rides the bus like everything else (`harness:__inspect__`), so it works with the page
  on a phone and the panel on the laptop. Its discovery answer carries `inspect: true` and
  the panel does not list it as a harness. Messages are **addressed per page** (`inst` /
  `to`, the harness convention): the page you picked on last is the one being edited, and
  the phone, a desktop tab and a headless probe on the same bus never restyle each other.
- **Copy never falls back to an alert.** VS Code's Simple Browser refuses the clipboard
  API; when the write fails the payload opens in a selectable sheet inside the panel,
  pre-selected and copied via `execCommand` where that still works. Same for a harness Copy.

**The page-wide switches live in `_debug-bus.js`, not in a harness.** The rail's foot
(dev fold badge, auto-reload) drives `js/nav.js`'s `setFoldBadgeVisible` and `reload.js`
over the shared `harness:__all__` channel. That answer used to come from inside each
`_debug-<thing>.js`, so deleting the last baked harness left the switches dead with
nothing on the page listening; it is answered by the transport now (`page: true`, which
the panel applies without listing a rail row). Same change in the templates.

## Currently in the repo

Nothing but the transport and the inspector. `_debug-bus.js`, `_debug-inspect.js` (both
loaded by `project.html`) and `_debug-panel.html`
stay until the last harness is gone for good; every `manual/`/`compare/` harness built so far
has been baked and deleted.



## Previously-built harnesses (all deleted)

What the harnesses baked into — so a rebuilt one knows where its numbers land. Each value
is the live one in code:

| Constant | Live value | File |
|---|---|---|
| `FOLD2_CAMP_CENTER_GAP_PX` (@fold2/@fold3 half-gap: each camp's centre sits this many px either side of screen centre; mobile computes its own from `FOLD2_CAMP_EDGE_GAP_MOBILE_PX`, and @fold3 from `FOLD3_CAMP_EDGE_GAP_MOBILE_PX` 82) | 162 | `js/groups.js` |
| `HOVER_DIM_OPACITY` (the shared hover-dim; `HOVER_DIM_BY_ACTOR` overrides per actor) | 0.27 | `js/core.js` |
| `FOLD8_TOOLTIP_CLEARANCE_PX` (@fold7's measured trigger crossing) | −20 | `js/groups.js` |
| `P7_VERT_SQ_BOOST` (desktop axis length) | 0.88 | `page7.js` |
| `TOOLTIP_DOCK_BOTTOM_PX` (mobile docked frame's bottom inset) | −18 | `js/fold8-tooltip.js` |
| `P7_VERT_MOBILE.slotTopPx` (mobile headline slot top) | 78 | `page7.js` |
| `SBB_TIMELINE_LEFT_PX` (@fold9 outer dot edge, desktop) | 190 | `squareboundingbox.js` |
| `P7_INSPECT_SCRIM` / `P7_INSPECT_HOLE_DOTS` (loupe halo-by-subtraction, `p7DrawInspectScrim`) | 0.76 / 1 | `page7.js` |
| `P7_SCOPE_BTN_GAP` (scope pill above the right-hand legend) | 22 | `js/groups.js` |
| `PAGE0_CUE_SCALE` / `PAGE0_CUE_DOT_MS` / `PAGE0_CUE_ROW_STAGGER_MS` / `PAGE0_CUE_EXIT_MS` (@fold1 idle scroll cue) | 0.3 / 940 / 22.5 / 260 | `js/fold1-intro.js` |
| `P12_PAIR_GAP` / `P12_PAIR_SPREAD` / `P12_DOT_COUNT` (@fold15 couples) | 3 / 2.3 / 9250 | `page12.js` |
| `FOLD3_BEAT_MS` (@fold3's beat windows, absolute ms) | see file | `js/groups.js` |
| Hero title/subtitle `font-size`, explicit `line-height`, `top: calc(50% - Npx)` | see file | `style.css` |
| `GROUPS[].color` + `FOLD4_COALITION_ROWS` / `FOLD4_CHANGE_ROWS` (resolve groups by `actor` through `groupByActor()`, which logs an unknown actor; they keyed off a retyped hex until 2026-09-17, where a re-cased colour silently went `undefined`), `FOLD2_GROUP_CELL` (positions), `FOLD2_FILLER_COLORS` (fillers; a group moved onto a filler-override cell evicts it) | see file | `js/groups.js` |
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
