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
