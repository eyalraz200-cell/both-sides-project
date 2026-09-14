# Harness remote panel v2 + per-chat reload isolation

## Problem

1. The remote panel tab (`_debug-panel.html`) rebuilds a harness's whole knob DOM on every
   state echo / discovery ping. Native `<input type=color>` opens an OS dialog that holds no
   pointer, so the input is torn down under the open dialog → the colour picker never works.
   The same rebuild makes buttons flicker and the list shift.
2. Every knob of every harness renders in one stacked column; sliders that only matter for
   one mode are always shown.
3. Knob labels are CSS names, not what the user sees change.
4. No per-knob reset.
5. Several chats edit one checkout served on `:8080`; every chat's edit reloads every tab.

## Design

### Remote panel (`~/.claude/templates/harness-panel.html` → `_debug-panel.html`)

- **Build once, patch forever.** DOM for a harness is built once per descriptor hash. State
  echoes patch values into existing inputs (never the one being dragged/focused). No timed
  rebuilds. A changed descriptor (harness edited + page reloaded) rebuilds once.
- **Own colour picker.** Swatch → inline popover: hue strip, saturation/lightness square,
  hex field. Pure DOM, no native dialog. Emits hex on every pointer move.
- **One harness at a time.** Top strip of harness names (tabs). Only the selected one renders;
  keyboard drives it. Selection remembered in `localStorage`.
- **Modes first, relevant knobs under them.** Mode groups render as segmented controls.
  Knobs carrying `modes: [...]` appear only while one of those modes is picked (page-side
  computes this into the existing `off` list). Knobs are bucketed by `group` into collapsible
  sections; first open, rest collapsed. Two columns ≥ 700px.
- **Per-knob reset.** Each knob row has `↺`: click → last checkpoint value, Shift-click →
  shipped value. Sends `{t:'reset', key, ship}`.
- Toolbar unchanged: Go · Copy · Reset · Dock.

### Page template (`~/.claude/templates/harness-panel.js`)

- New knob field `modes: ['id', …]` → knob is inert unless the active mode (in its group, or
  any group) is in the list. Feeds `offKeys()` alongside `when()`.
- New message `{t:'reset', key, ship}` → resets one key to checkpoint / shipped value,
  applies, echoes state.
- Copy output unchanged (label, value, source).

### Naming rule (global CLAUDE.md, "The harness panel")

Knob `label` = what you see change, plain words ("gap between dots"). CSS name + `file:line`
live in `source` only. Existing project harnesses renamed to comply.

### Reload isolation

- Recipe in wiki/Dev-Workflow.md: one git worktree per chat, `python3 server.py --port 0`
  picks a free port and prints it. Each worktree's tabs only reload on that chat's edits.
- `reload.js`: store `scrollY` in `sessionStorage` before `location.reload()`, restore after
  load (after fonts/layout settle, with `ScrollTrigger.refresh()` if present).

## Testing

- `node --check` on every JS file; `curl` the page.
- Headless Playwright: page + panel tab on a spare port; assert a colour `set` reaches the
  page, per-knob reset restores the value, mode change hides/shows knobs, no DOM rebuild
  across 5 s of echoes.
- Manual: colour picker in the VS Code webview and Chrome.

## Out of scope

The on-page (non-remote) panel's look; the bus transport; the mobile launcher.
