# Figma Parity Report — index.html Fold 1 (cover screen)

**Figma node:** 167:90164 (file QASHSt1u7b6m6ASgrUPswf, "MacBook Pro 14\" - 137")
**Code file(s):** index.html, trigger.css
**Audit date:** 2026-06-24

## Summary

- **Critical:** 0 drifts
- **Major:** 1 drift
- **Minor:** 0 drifts
- **Token-level:** 0 drifts (Figma has no bound variables on this node — `get_variable_defs` returned empty — all values are literals on both sides)
- **Match:** 9 properties/elements verified equal (see below)

Implementation matches the design closely. The only drift found was a wrong text-alignment value on the scroll-down caption, found by measuring per-line ink bounding boxes against the Figma screenshot pixel-for-pixel rather than eyeballing it.

---

## Major drifts

### `.fold1-scroll-text` — text-align

- **Figma:** left-aligned (each of the 3 wrapped lines — "גללו למטה" / "בשביל לצפות" / "בפרויקט" — shares the same left edge at x≈777-778 in the 1512-wide frame; right edges vary with line length: 848, 867, 833). Confirmed by measuring ink columns directly on the Figma render, not by description.
- **Code:** `text-align: center` (trigger.css:124)
- **Magnitude:** Major — wrong alignment family (center vs left) would visibly shift two of the three lines off the intended column.
- **Proposed fix:**
  ```diff
    .fold1-scroll-text {
      ...
  -   text-align: center;
  +   text-align: left;
      ...
    }
  ```

---

## Items verified as matching

- `.fold1-logo`: position (`calc(50% - 0.5px)`/`calc(50% - 445.5px)`), size 81×47, source asset (pixel-sampled logo ink ≈ RGB(24,64,143), matches the Figma-exported asset directly — no CSS color involved) ✓
- `.fold1-title`: position (`bottom: calc(50% + 129px)`, `translateX(calc(-50% + 25.5px))`), width 209px, font 600 42px HadassahFriedlaender, color `#000`, **text-align: left** — confirmed correct by ink measurement (left edges 761-762 flush, right edges vary) ✓
- `.fold1-subtitle`: width 155px, font 300 18px Assistant, color `#000`, **text-align: right** — confirmed correct by ink measurement (right edges flush at 747, left edges vary) ✓
- `.fold1-text` gap (11px) and flex direction/DOM order (title right, subtitle left) ✓
- `.fold1-dots-blue` / `.fold1-dots-orange`: colors pixel-sampled at `#2563EB` / `#EA580C` — exact match to Figma's literal fill values; vertical extents (600px / 510px, tapering the orange column away at y≈904 before the arrow) verified by re-deriving the gradient's last rendered square against Figma's own dot-grid coordinates ✓
- `.fold1-scroll-link` bounding box (128×62, centered at `calc(50% + 65px)`/`calc(50% + 446px)`) and the arrow/text positions inside it (6,23 / 20,0) — re-derived independently from raw node metadata, both match ✓
- Scroll-text color `rgba(0,0,0,0.44)` — pixel-sampled ink (142,141,143) over the page's near-white background is consistent with 44% black ✓
- Scroll-text line breaks ("גללו למטה" / "בשביל לצפות" / "בפרויקט") ✓
- Down arrow: SVG path copied verbatim from Figma's own exported asset, rotated 90° per the original wrapper ✓

## Other observations

- `.fold1-title`'s Medium weight is faked as `font-weight: 600` on the Regular HadassahFriedlaender face — same documented limitation as `.page0-title`/`#page-3`/`#page-4` in style.css (no true Medium OTF in `fonts/`). Not a drift to fix here, just carrying forward the existing project-wide caveat.
- This node has no Figma variables/tokens bound to any property (`get_variable_defs` → `{}`), so there's nothing to flag at the token level.

---

# Figma Parity Report — Page-10 dropped pill (@dragcards, extreme zone)

**Figma node:** 136:433215 ("Frame 3218", the dropped-into-extreme chip for "הפרות סדר") vs. tray pill 136:410819 ("Frame 3211", same label)
**Code file(s):** style.css (`.page9-pill`, `#page9ZoneAbove`)
**Audit date:** 2026-06-24

## Summary

- **Critical:** 1 drift
- **Major:** 2 drifts
- **Minor:** 2 drifts
- **Token-level:** 0 drifts
- **Match:** padding (10px), font (600 22px Assistant), text-align (right), handle hidden ✓

`#page9ZoneAbove` only overrode the drag-handle's `display`, so a dropped pill inherited `.page9-pill` verbatim — i.e. the tray's chrome. Figma's dropped-chip frame (136:433215) uses different chrome from the tray frame (136:410819), not the same chrome minus the handle: top/bottom-only border instead of all 4 sides, full opacity instead of the tray's 0.78, and darker label text (27% vs the tray's 20% black) — together these are what reads as "darker" once dropped.

*Note: the text-color drift below was found in the original pass but dropped from the first version of this report by mistake — caught and fixed after the user asked to make the dropped pill darker still.*

---

## Critical drifts

### `#page9ZoneAbove .page9-pill` — border

- **Figma:** `border-top: 2px solid rgba(130,130,130,0.14)`, `border-bottom: 2px solid rgba(130,130,130,0.14)`, no left/right border.
- **Code:** inherited `.page9-pill` border — `1px solid rgba(130,130,130,0.3)` on all 4 sides (style.css:378 at time of audit).
- **Magnitude:** Critical — wrong side count (4 vs 2), wrong width (1px vs 2px), and wrong color alpha (0.3 vs 0.14).
- **Fix applied:**
  ```diff
  + #page9ZoneAbove .page9-pill {
  +   border: none;
  +   border-top: 2px solid rgba(130, 130, 130, 0.14);
  +   border-bottom: 2px solid rgba(130, 130, 130, 0.14);
  + }
  ```

---

## Major drifts

### `#page9ZoneAbove .page9-pill` — opacity

- **Figma:** `1` (no opacity set on the dropped-chip frame).
- **Code:** inherited `.page9-pill { opacity: 0.78; }` (style.css:381 at time of audit).
- **Magnitude:** Major — the single biggest contributor to the reported "darker once dropped" look; 78% vs 100% opacity is visible at a glance.
- **Fix applied:**
  ```diff
  + #page9ZoneAbove .page9-pill {
  +   opacity: 1;
  + }
  ```

### `#page9ZoneAbove .page9-pill` — text color

- **Figma:** `rgba(0,0,0,0.27)` on the dropped-chip's label (136:433217).
- **Code:** inherited `.page9-pill { color: rgba(0, 0, 0, 0.2); }` — same as the tray pill's label color (style.css:376 at time of audit).
- **Magnitude:** Major — visible darkening of the label text, on top of the opacity change above.
- **Fix applied:**
  ```diff
  + #page9ZoneAbove .page9-pill {
  +   color: rgba(0, 0, 0, 0.27);
  + }
  ```

---

## Minor drifts (not applied — user chose Critical + Major only)

| Element | Property | Figma | Code (inherited) | Fix |
| --- | --- | --- | --- | --- |
| `#page9ZoneAbove .page9-pill` | background | `#fdfcff` | `#fff` | `background: #fdfcff;` |
| `#page9ZoneAbove .page9-pill` | border-radius | `0` (no rounding) | `2px` | `border-radius: 0;` |

---

## Other observations

- The tray pill itself (136:410819) has its own small drift not in scope here: Figma shows `opacity: 0.67` on the tray chip, code's base `.page9-pill` uses `0.78`. Flagging for awareness, not fixed — out of scope for this audit (only the dropped state was requested).

## Items verified as matching

- Padding (10px), font (600 22px Assistant SemiBold), text-align (right), handle hidden in the extreme zone ✓
