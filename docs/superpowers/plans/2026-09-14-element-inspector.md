# Element inspector in the harness panel — Implementation Plan

**Goal:** Cmd+right-click (desktop) or double-tap (mobile) on any page element opens an
"Element" tab in the harness panel with a nesting-level breadcrumb and live style controls;
Copy emits the visual-edit change-list so Claude applies it to source.

**Architecture:** `_debug-inspect.js` (page side, template `~/.claude/templates/harness-inspect.js`)
picks the element, builds the ancestor chain, draws a selection outline, applies inline overrides,
and talks to the panel on bus channel `harness:__inspect__`. The panel gets a pinned rail row
"Element" and a section built once per pick, patched per level change. Change-list format =
visual-edit skill (`op:"style"`, camelCase `changes: {prop:[from,to]}`, `viewportPx`).

**Spec:** this file (bounded task; approved without questions — user away).

### Task 1: page-side picker (`harness-inspect.js` → `_debug-inspect.js`)
- Gate on `window.HBus`. Desktop: `contextmenu` with `metaKey` → preventDefault, pick target.
  Mobile: two `touchend` within 350ms / 30px → `elementFromPoint`. Ignore own chrome, badge, picker.
- Chain = element → … → child of body (exclude html/body). Row: `{i, tag, id, cls, sel, text}`;
  `sel` = id, else tag+classes, disambiguated with `:nth-of-type` up to a unique ancestor.
- Outline overlay (fixed, pointer-events none, accent 2px + tag chip) tracks selected el each rAF
  while a selection exists.
- Messages out: `picked{chain,i}`, `props{i, sel, computed, edits, rect}`, `payload{text}`, `iam`.
  In: `hello`, `select{i}`, `set{prop,val}`, `unset{prop}`, `revert`, `copy`, `clear`.
- Edits per element: `{prop: [from, to]}`; applied as inline style; persisted to sessionStorage
  by selector and re-applied on load (auto-reload safe).
- Props: fontSize fontWeight lineHeight letterSpacing textAlign textTransform color
  backgroundColor opacity borderRadius borderWidth borderColor padding×4 margin×4 width height
  gap display.

### Task 2: panel section
- Rail: pinned "Element" row (appears on first pick, auto-activates). Section: toolbar
  Copy · Revert · Clear; breadcrumb pills outer→inner (keys `[` `]`, Esc = clear);
  summary line (selector · text · w×h); groups Text / Fill & border / Spacing / Size / Visibility.
- Shared colour control extracted from `H.buildColor` → `colorControl()`.
- Row: label · value · ↺; edited rows carry an accent dot.

### Task 3: verify + docs
- Playwright: contextmenu+meta on desktop, two taps on mobile; select level 1; set fontSize;
  computed style changes; copy payload JSON parses; revert restores.
- Wiki Dev-Workflow + global CLAUDE.md harness section; `project.html` script tag.
