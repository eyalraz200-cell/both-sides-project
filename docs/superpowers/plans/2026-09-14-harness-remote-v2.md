# Harness remote panel v2 + reload isolation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** A remote panel tab that never rebuilds under the user's hand, with an own colour picker, one harness at a time, mode-scoped knobs and per-knob reset; plus per-chat reload isolation.

**Architecture:** Page-side template (`harness-panel.js`) keeps its protocol and gains two things: a declarative `modes:` knob filter and a `{t:'reset', key, ship}` message. The remote page (`harness-panel.html`) is rewritten: descriptor → DOM once, echoes → in-place patch. Project copies are regenerated from the templates.

**Tech Stack:** vanilla JS, python http.server, playwright-core (`~/.claude/tools/pw`) for probes.

**Spec:** docs/superpowers/specs/2026-09-14-harness-remote-and-reload-isolation-design.md

## Global Constraints
- Scaffolding only: `_debug-*.js`, `_debug-panel.html` never ship.
- Button order Go · Copy · Reset · Dock. Never scroll the page on load.
- Knob `label` = plain words of what changes; CSS name + file:line in `source`.

---

### Task 1: Page template — `modes:` filter + per-key reset
**Files:** Modify `~/.claude/templates/harness-panel.js` (`applies()` ~L283, CHAN.onmessage ~L1040, config comments ~L50).
- [ ] `applies(s)`: also false when `Array.isArray(s.modes)` and no active mode id (any group) is in `s.modes`.
- [ ] `resetKey(key, ship)`: value = ship ? DEFAULTS bag : CK.V bag (fallback DEFAULTS); assign into `bag(key)`; `syncInputs(); run();`.
- [ ] Handle `m.t === 'reset'` → `resetKey(m.key, !!m.ship)`.
- [ ] Document `modes:` and the message in the CONFIG comment.
- [ ] `node --check`; commit template dir is outside git — verify via a Node smoke: load file with a stub `document`? (Skip: covered by Task 5 probe.)

### Task 2: Remote panel rewrite
**Files:** Rewrite `~/.claude/templates/harness-panel.html`.
- [ ] Keep: HBus discovery (`harness:__all__` who/iam every 1.5s), per-title channel, host election (`inst`/`to`), `hello`/`ping`/`bye`, `set` with `seq`, `mode`/`toggle`/`tab`/`btn` messages, `payload` → clipboard.
- [ ] Harness strip at top (one button per title, remembered in localStorage `hp:remote:active`); only active harness's section is in the DOM.
- [ ] `build(desc)` runs only when `JSON.stringify(desc)` changes. `patch(state)` updates: mode button `aria-selected`, toggle checkboxes, slider values (skip focused/dragging input), colour swatches, knob visibility (`off` list + `modes` derived client-side from desc.knobs[].modes).
- [ ] Layout: toolbar (Go, Copy, Reset, Dock, host indicator) → tabs strip → mode groups as segmented rows → toggles → knob groups (`<details>` per `group`, first open) → grid 2 cols at ≥700px.
- [ ] Knob row: label · value · ↺ (click = `{t:'reset',key}`, shift = `ship:true`) · source (small). Range input for sliders.
- [ ] Colour picker: swatch button → popover with hue strip (canvas or gradient div + pointer), SL square, hex input; emits `set` on pointer move; closes on outside click / Esc; never uses `<input type=color>`.
- [ ] Keys drive the active harness (mode keys, toggles, `0`), ignored while typing.

### Task 3: Project copies + renames
**Files:** `_debug-panel.html` (copy), `_debug-axis-intro.js`, `_debug-mlegend-fill.js` (regenerate from template: splice each file's CONFIG block onto the new template body), relabel knobs in plain words; add `modes:` where a knob only serves some modes.
- [ ] `node --check` each; `curl` project.html → 200.

### Task 4: Reload isolation
**Files:** `reload.js`, `server.py` (`--port 0` → free port; print URL), `wiki/Dev-Workflow.md`, `~/.claude/CLAUDE.md` (naming rule + per-knob reset + modes).
- [ ] `reload.js`: before `location.reload()` set `sessionStorage['reload:y'] = scrollY`; on load, if present, `scrollTo(0,y)` after `load` + 2 rAF, then `ScrollTrigger.refresh()` if defined; delete key.
- [ ] `server.py`: `--port 0` binds port 0, prints actual port + LAN URL.
- [ ] Wiki: worktree-per-chat recipe (`git worktree add ../bs-<topic> -b <topic>`, run server there, own port).

### Task 5: Probe
**Files:** `/scratchpad/probe.js` (throwaway).
- [ ] Playwright: server on spare port; page A = project.html with harness; page B = _debug-panel.html. Assert: desc received, one build (count `data-built` attr) across 5 s; `set` colour reaches page (`window.__hp` API value); per-key reset restores; mode change hides a `modes:`-scoped knob.
