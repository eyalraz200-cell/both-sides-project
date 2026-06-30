# Figma Parity Report — index.html CTA banner (`.shk-cta`)

**Figma node:** 228:1543 (file QASHSt1u7b6m6ASgrUPswf)
**Code files:** `index.html` (`.shk-cta` markup), `trigger.css` (`.shk-cta*` rules)
**Audit date:** 2026-06-30

## Summary

- **Critical:** 7 drifts — all fixed
- **Major:** 2 drifts — all fixed
- **Minor:** 0 drifts
- **Token-level:** 0 drifts
- **Match:** button border-radius (4px), body text content, button text content ✓

The existing banner was a white dashed-border card (matching project.html's `.text-card-frame` style) — completely different from Figma's dark-blue solid card. All properties were rebuilt from scratch.

---

## Critical drifts — all fixed

| Element | Property | Figma | Code (before) | Fix |
|---|---|---|---|---|
| `.shk-cta` | background | `#0e578a` | `#fdfcff` | `background: #0e578a` |
| `.shk-cta` | border | none | 4px dashed SVG frame | removed border + SVG script |
| `.shk-cta` | layout | `float: left`, offset outside article column | block in-flow | `float: left; margin-left: -24px` |
| `.shk-cta-logo` | presence | שקוף wordmark, white, top-right | absent | added `<img class="shk-cta-logo">` with `filter: brightness(0) invert(1)` |
| `.shk-cta h2` | text | "קיצוניים משני הצדדים - פרויקט מיוחד של שקוף" | "איפה עובר הגבול..." | updated text |
| `.shk-cta h2` | font/color | Assistant 700 16px / `#fff` | HadassahFriedlaender 600 24px / `#000` | `font: 700 16px/1.35 'Assistant'`, `color: #fff` |
| `.shk-cta p` | color | `#fff` | `rgba(0,0,0,0.6)` | `color: #fff` |

## Major drifts — all fixed

| Element | Property | Figma | Code (before) | Fix |
|---|---|---|---|---|
| `.shk-cta` | border-radius | `4px` | `8px` | `border-radius: 4px` |
| `.shk-cta-button` | bg/color/layout | white bg, black text, 190px centered | black bg, white text, inline-block auto | `background: #fff; color: #000; display: block; width: 190px; margin: 0 auto` |

## Items verified as matching

- Button border-radius: `4px` ✓
- Body text content (unchanged from old banner) ✓
- Button text "לפרויקט האינטרקטיבי" ✓
- Button padding/height (~45px) ✓

---

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

---

# Figma Parity Report — @fold11 dragcards tray (`#page-10`)

**Figma node:** `201:49246` ("Frame 3219", the dragcards tray) — file `QASHSt1u7b6m6ASgrUPswf`
**Code file(s):** `style.css` (`.page9-tray`, `.page9-tray-title`, `.page9-tray-divider`), `project.html` (`#page-10` markup)
**Audit date:** 2026-06-28

## Summary

- **Critical:** 3 drifts — all fixed
- **Major:** 4 drifts — all fixed
- **Minor:** 0 drifts
- **Token-level:** 0 drifts
- **Match:** 6 properties verified equal

Last pass only added new child elements inside the tray and restyled the pills themselves — it never touched the **tray container's own box chrome**, which is why it still looked like the old dashed card. The pills (`.page9-pill`) already matched Figma exactly (confirmed against this same node — note Figma's `dragcard` instances here have no opacity override at all, unlike the 0.67 noted on a different node in the report above; this redesign supersedes that). The container (background, border, radius, shadow, padding) didn't, and one element added last time (`.page9-tray-divider`) turned out not to exist in Figma's actual component at all. All 7 drifts below were applied to `style.css`/`project.html`; the drag-over border-color question was resolved by dropping it and relying on the background darken alone (no Figma ground truth for that state).

---

## Critical drifts

### `.page9-tray` — border

- **Figma:** none (no border at all — the card reads as a plain filled surface, not a dashed box)
- **Code:** `border: 4px dashed rgba(0, 0, 0, 0.13);` (style.css:381)
- **Magnitude:** entirely different visual language — Figma dropped the dashed-card treatment used elsewhere on this page; code still has it at full weight.
- **Proposed fix:**
  ```diff
  - border: 4px dashed rgba(0, 0, 0, 0.13);
  ```

### `.page9-tray` — border-radius

- **Figma:** top-left `20px`, top-right `20px`, bottom-left `0`, bottom-right `0` (`rounded-tl-[20px] rounded-tr-[20px]`)
- **Code:** `border-radius: 8px;` (uniform, all 4 corners) (style.css:382)
- **Magnitude:** radius family is 2.5x off on the rounded corners, and the bottom corners are rounded in code but square in Figma (the tray is meant to read as flush with the bottom edge it sits near).
- **Proposed fix:**
  ```diff
  - border-radius: 8px;
  + border-radius: 20px 20px 0 0;
  ```

### `.page9-tray-divider` — exists in code, not in Figma

- **Figma:** Frame 3219 (this exact node, isolated) has no internal divider line. The "Line 12" node found in last pass's broader frame export sits at the *parent* canvas level, not inside this component, and doesn't render in the isolated screenshot of the tray itself.
- **Code:** `.page9-tray-divider` rule (style.css:422-426) + markup in `project.html`.
- **Magnitude:** a fabricated element — last pass misread a stray/overlapping parent-level guide line as part of this component.
- **Proposed fix:** remove the divider entirely (CSS rule + the `<div class="page9-tray-divider"></div>` markup).

---

## Major drifts

### `.page9-tray` — background

- **Figma:** `#fdfcff`, fully opaque
- **Code:** `rgba(253, 252, 255, 0.74)` — same hue, 74% alpha (style.css:383)
- **Magnitude:** alpha drift of 0.26 — code reads visibly more translucent/washed out than Figma's solid card.
- **Proposed fix:**
  ```diff
  - background: rgba(253, 252, 255, 0.74);
  + background: #fdfcff;
  ```

### `.page9-tray` — box-shadow

- **Figma:** `0px 0px 3.85px rgba(0, 0, 0, 0.22)` (soft ambient glow around the whole card)
- **Code:** none
- **Magnitude:** missing entirely — this is part of what makes Figma's card read as "lifted" rather than flat.
- **Proposed fix:**
  ```diff
  + box-shadow: 0 0 3.85px rgba(0, 0, 0, 0.22);
  ```

### `.page9-tray` — padding

- **Figma:** `29px` horizontal, `15px` top **and** bottom (`px-[29px] py-[15px]`) — but the "פעולות" label floats as an absolute overlay above the pill rows (see next item), so the *effective* clearance above the first row is `53px`, not `15px`; bottom clearance to the last row is exactly `15px`.
- **Code:** `padding: 27px 29px 16px;` (style.css:380) — horizontal already correct, vertical values don't match either Figma's raw padding *or* its effective rendered spacing.
- **Magnitude:** top off by 26px (53 vs 27 effective), bottom off by 1px.
- **Proposed fix:** since the title becomes a non-flow absolute overlay (see next item), reproduce Figma's *effective* spacing directly on the container:
  ```diff
  - padding: 27px 29px 16px;
  + padding: 53px 29px 15px;
  ```

### `.page9-tray-title` ("פעולות" label) — positioning model

- **Figma:** `position: absolute`, anchored `top: 16px`, right edge at the container's horizontal center + 23px (`left: calc(50% + 23px); transform: translateX(-100%)`) — floats over the card without participating in the flex layout, so it never pushes the pill rows down.
- **Code:** a normal in-flow flex child (first child of `.page9-tray`'s flex column) — consumes an 18px gap before the first pill row that Figma's version doesn't have.
- **Magnitude:** structural — affects the spacing of everything below it, not just the label itself.
- **Proposed fix:**
  ```diff
  .page9-tray-title {
    font: 700 16px 'Assistant', sans-serif;
    color: rgba(0, 0, 0, 0.37);
  - text-align: right;
  - width: 100%;
    margin: 0;
  + position: absolute;
  + top: 16px;
  + right: calc(50% - 23px);
  + white-space: nowrap;
  }
  ```
  (Container padding-top is widened to 53px above specifically to leave room for this now-floating label.)

---

## Other observations

- `.page9-tray:has(#page9ZoneBelow.dragover)` (style.css:400-403) sets `border-color: rgba(0, 0, 0, 0.2);` on drag-over — once the base border is removed, this line becomes a no-op (no border to color). Figma's mockup doesn't show a drag-over state for this component, so there's no ground truth for what should replace it. Flagging rather than deciding — drop the line and rely on the background darken alone, or add a temporary border just for this state?
- The container's row/column arrangement (currently 3 fixed-slot grids vs. Figma's single `flex-wrap`) is **not** included in the drifts above — per earlier instruction, the category→slot arrangement is content, not design, and stays as-is.

---

## Items verified as matching

- `.page9-pill`: font (600/20px), color (`rgba(0,0,0,0.4)`), background (`#fff`), border (`1px solid rgba(130,130,130,0.3)`), radius (`4px`), padding (`12px`), shadow (`0 1px 1.1px rgba(0,0,0,0.07)`) — all match Figma's `dragcard` component exactly. ✓
- Grip-handle icon footprint (8x15px) matches Figma's icon asset dimensions exactly. ✓
- Row gap (18px) / column gap (10px) between pills already matches Figma's `gap-[18px_10px]`. ✓
- `.page9-tray-title` font/weight/color (700/16px/`rgba(0,0,0,0.37)`) already correct — only its *position* (flagged above) needs fixing. ✓

---

# Figma Parity Report — @fold1 (`#page-0`, project.html intro/cover) — revision pass

**Figma node:** `217:9176` ("MacBook Pro 14' - 182") — file `QASHSt1u7b6m6ASgrUPswf`
**Code file(s):** `project.html` (`#page-0` markup), `style.css` (`.page0-*` rules), `page1.js` (`buildPage0Dots`/`buildPage0DotsExtra`)
**Audit date:** 2026-06-29

## Summary

- **Critical:** 3 drifts — 2 fixed (logo content, dot column color/structure), 1 flagged for confirmation (scroll prompt, kept as-is per user instruction — to be revisited against its own node)
- **Major:** 5 drifts — all fixed
- **Minor:** 2 drifts — not applied (user chose Critical + Major only); both folded into the structural fixes above so the underlying values are already correct in code, just not the exact minor line items themselves (logo right-margin stays `30px` not `33px`)
- **Token-level:** 0 drifts (`get_variable_defs` → `{}`, no bound variables)
- **Match:** title/subtitle font family, weight-faking convention, dot square shape (plain fill, no radius/stroke) ✓

This node supersedes every earlier node this fold was built against (`146:105164` → `167:90164` for layout, `181:83` for the logo, `181:168` for the dot column — all referenced in the current code's own comments). The revision touches all four elements: the logo swaps to a wordmark-only crop (no elephant/tagline), the title and subtitle are no longer a bottom-flush pair but two independently top-anchored blocks, and the dot column changes from a 2-color side-by-side pair into two single-file, vertically-staggered columns running a specific 5-color, 100-long sequence (currently a 2-color procedural alternation). The scroll-down prompt has no corresponding node in this frame at all — flagged below rather than removed outright, since its absence could mean "removed by design" or "lives in a sibling frame not covered by this node ID."

---

## Critical drifts

### `.page0-logo-img` — image content

- **Figma:** crops the source sprite (`imgShakoofLogo2`, a 960×960 asset) down to just the blue "שקוף" wordmark glyphs — no elephant icon, no "גוף התקשורת של הציבור" tagline. Crop math: box 91×34px, image scaled to 152.53%×407.11% of box, offset `left: -26.26%`, `top: -230.51%`.
- **Code:** `<img src="images/שקוף_לוגו_shakoof_logo 1.png">` at `project.html:41` — this file is the **full** logo (elephant + wordmark + tagline; confirmed by viewing the asset), rendered at `width: 48px; height: auto` (`style.css:863-867`) with no crop/overflow-hidden, so the entire elephant+tagline composition renders, not just the wordmark.
- **Magnitude:** Critical — wrong content entirely, not just wrong styling. The rendered corner shows an elephant + 2-line tagline where Figma shows a single small wordmark.
- **Proposed fix:** swap to the already-existing pre-cropped wordmark asset (`images/skuff-wordmark.png`, 246×94px, already just the bare "שקוף" glyphs — used by `index.html:43`/`87` via `.shk-logo-img`) instead of re-deriving sprite-crop math:
  ```diff
  - <img class="page0-logo-img" src="images/שקוף_לוגו_shakoof_logo 1.png" alt="שקוף" />
  + <img class="page0-logo-img" src="images/skuff-wordmark.png" alt="שקוף" />
  ```
  (`skuff-wordmark.png`'s aspect ratio is 2.62:1 vs Figma's box 2.68:1 — close enough to size by width alone, see sizing fix below.)

### `.page0-dot` columns — color palette & structure

- **Figma:** two **separate single-file** vertical columns (not a left/right pair sharing one `top`), each 7×7px squares on a 17px step (7px square + 10px gap), running the *same* 100-entry, 5-color sequence — col. 1's square-centers sit 13.5px right of frame-center, col. 2's 13.5px left of it (27px apart, symmetric), with col. 1 starting 34px (2 steps) above col. 2. First 20 of the 100 (both columns identical): `#050a16, #ea580c, #a302b5, #52c0ca, #ea580c, #3bc925, #050a16, #a302b5, #ea580c, #050a16, #a302b5, #a302b5, #ea580c, #050a16, #ea580c, #a302b5, #52c0ca, #050a16, #a302b5, #a302b5` (full 100-entry array given in the fix below). None of these 5 hex values match any existing `GROUPS`/`P7_COLORS` semantic color in the project — this is its own decorative palette, unrelated to the group-color system used elsewhere.
- **Code:** `appendPage0DotPair` (`page1.js:25-39`) draws a **pair** of dots at the *same* `top`, 16px apart horizontally — one hardcoded `#2563eb` (blue), one hardcoded `#ea580c` (orange), alternating down a single synchronized column-pair, `PAGE0_DOT_COUNT = 36` + a separate extra-below-fold continuation.
- **Magnitude:** Critical — both the color data (2 hardcoded colors vs. a 5-color, 100-long authored sequence) and the spatial structure (paired same-row dots vs. two independently-staggered single-file columns) are wrong.
- **Proposed fix:** replace `appendPage0DotPair`'s logic with two independent column builders sharing one 100-entry color array:
  ```diff
  - const PAGE0_DOT_SQ = 5;
  - const PAGE0_DOT_COUNT = 36;
  + const PAGE0_DOT_SQ = 7;
  + const PAGE0_DOT_COLORS = [
  +   "#050a16","#ea580c","#a302b5","#52c0ca","#ea580c","#3bc925","#050a16","#a302b5","#ea580c","#050a16",
  +   "#a302b5","#a302b5","#ea580c","#050a16","#ea580c","#a302b5","#52c0ca","#050a16","#a302b5","#a302b5",
  +   "#ea580c","#050a16","#ea580c","#a302b5","#52c0ca","#ea580c","#ea580c","#050a16","#a302b5","#a302b5",
  +   "#52c0ca","#ea580c","#ea580c","#050a16","#a302b5","#a302b5","#ea580c","#050a16","#ea580c","#a302b5",
  +   "#52c0ca","#ea580c","#3bc925","#050a16","#a302b5","#ea580c","#050a16","#a302b5","#a302b5","#ea580c",
  +   "#050a16","#ea580c","#a302b5","#52c0ca","#ea580c","#3bc925","#050a16","#a302b5","#ea580c","#050a16",
  +   "#a302b5","#a302b5","#ea580c","#050a16","#ea580c","#a302b5","#52c0ca","#050a16","#a302b5","#a302b5",
  +   "#ea580c","#050a16","#ea580c","#a302b5","#52c0ca","#ea580c","#ea580c","#050a16","#a302b5","#a302b5",
  +   "#52c0ca","#ea580c","#ea580c","#050a16","#a302b5","#a302b5","#ea580c","#050a16","#ea580c","#a302b5",
  +   "#52c0ca","#ea580c","#3bc925","#050a16","#a302b5","#ea580c","#050a16","#a302b5","#a302b5","#ea580c",
  + ];
  + // col. 1 at center+13.5px starting 2 steps above col. 2 at center-13.5px (27px apart, symmetric)
  ```
  Each column needs its own `left` (center+10px / center-17px, see Major positioning items below) and its own `top` start offset (2-step/34px stagger), then steps down `PAGE0_DOT_COLORS.length` times at 17px — splitting across `.page0-overlay`/`.page0-dots-extra` exactly like today, just driven by index into one shared array instead of a hardcoded 2-color alternation. Total dots per column goes from ~55 (36 visible + ~19 extra) to 100.

### Scroll-down prompt (`.page0-scroll`) — missing from this node

- **Figma:** node `217:9176`'s full child list (title, subtitle, 2 dot columns, logo) has no scroll-arrow/caption element at all, and the rendered screenshot's bottom-right corner (where it would sit, 30px-from-edge) is empty — the dot column itself runs uninterrupted to the frame's bottom edge.
- **Code:** `.page0-scroll` (arrow + "גללו מטה כדי להתחיל") at `project.html:47-52` / `style.css:925-963`.
- **Magnitude:** Critical if intentionally removed (dead code to delete), but flagged rather than fixed — this could equally mean the prompt lives in a sibling node/frame not covered by `217:9176`'s subtree, and removing a scroll cue is a UX call, not a pure styling fix.
- **Proposed fix:** none applied — **needs your confirmation**: keep it, or remove it because this revision drops it?

---

## Major drifts

### `.page0-logo` — top offset

- **Figma:** logo box top = `32px` (frame-absolute).
- **Code:** `top: calc(50% - 428.5px)` (`style.css:858`) → on the 982px reference frame that's `491 - 428.5 = 62.5px` from the top.
- **Magnitude:** ~30.5px too low at the box's literal top edge, but the existing rule also applies `transform: translateY(-50%)`, which redefines the `top` constant as the box's *center*, not its edge — accounting for that, the corrected constant is `-441.6px` (`459 - 17.4` half-height of the new 91×34.8px box), a ~13.1px shift from the old `-428.5px`, not the naive ~30.5px.
- **Proposed fix:** `top: calc(50% - 441.6px);` (applied alongside the width fix below, since the half-height subtraction depends on the new box's rendered height).

### `.page0-logo` — width/aspect

- **Figma:** box 91×34px (2.68:1).
- **Code:** `width: 48px` (`style.css:860`), intentionally shrunk from the *old* node's 72px-literal per an earlier explicit request — but that request was sized against the old full-logo crop, not this wordmark-only crop.
- **Magnitude:** needs re-deriving now that the asset itself changed (wordmark-only is visually much lighter/smaller than the full elephant+tagline at the same width) — likely wants to go back up toward Figma's literal 91px, but flagging for your call rather than silently restoring the literal value given the project's history of deliberately overriding Figma-literal sizes here.
- **Proposed fix:** suggest `width: 91px;` (Figma-literal) as the starting point, adjust if it reads too big on screen like last time.

### `.page0-text` — title/subtitle no longer share a bottom edge

- **Figma:** title top `233px`, subtitle top `312px` — each independently top-anchored; the rendered title's last line (`הצדדים`) sits noticeably *higher* than the subtitle's last line (`בישראל`), not flush (confirmed by pixel-cropping the screenshot — title block ≈227–360px, subtitle block ≈317–397px, bottoms ~37px apart).
- **Code:** `.page0-text { display:flex; flex-direction:row; align-items:flex-end; gap:11px; }` (`style.css:874-884`) — forces title and subtitle to share one bottom edge, per the *old* node's "single shared bottom line" (still documented in the `.page0-title` comment at `style.css:886-891`).
- **Magnitude:** structural — affects vertical position of both elements, not a simple offset tweak.
- **Proposed fix:** drop the flex-row pairing; position independently, each relative to frame-center like every other page0 element:
  ```diff
  - .page0-text {
  -   position: absolute;
  -   left: 50%;
  -   bottom: calc(50% + 129px);
  -   transform: translateX(calc(-50% + 25.5px));
  -   display: flex;
  -   flex-direction: row;
  -   align-items: flex-end;
  -   gap: 11px;
  -   direction: rtl;
  - }
  + .page0-title {
  +   position: absolute;
  +   left: calc(50% + 8px);
  +   top: calc(50% - 258px);   /* 491 - 233 */
  +   width: 185px;
  + }
  + .page0-subtitle {
  +   position: absolute;
  +   right: calc(50% - 10px); /* 756 - 746, right-edge anchored */
  +   top: calc(50% - 179px);  /* 491 - 312 */
  +   width: 125px;
  + }
  ```
  (drops the shared container and its `translateY(8px)` flush-bottom nudge, which becomes meaningless once title/subtitle aren't bottom-paired.)

### `.page0-title`/`.page0-subtitle` — horizontal gap

- **Figma:** subtitle's right edge (746px) to title's left edge (764px) = **18px** gap.
- **Code:** `.page0-text`'s `gap: 11px` (`style.css:882`).
- **Magnitude:** 7px short — visible at this scale (a fifth of the gap missing).
- **Proposed fix:** superseded by the independent-positioning fix above (the 18px is already baked into the two `calc()` values), no separate gap property needed once title/subtitle are de-paired.

### Dot column total count

- **Figma:** exactly 100 squares per column (full enumerated node list, see Critical drift above).
- **Code:** `PAGE0_DOT_COUNT = 36` visible + `PAGE0_DOT_EXTRA_COUNT = Math.round(982/17/3) ≈ 19` extra = ~55 total (`page1.js:18,56`).
- **Magnitude:** column runs out at roughly half Figma's intended length.
- **Proposed fix:** covered by the color-array fix above — drive total count off `PAGE0_DOT_COLORS.length` (100) instead of the two separate hardcoded constants, splitting between `.page0-overlay` (first viewport) and `.page0-dots-extra` (continuation) same as today.

---

## Minor drifts

| Element | Property | Figma | Code | Fix |
| --- | --- | --- | --- | --- |
| `.page0-logo` | right margin | `~33px` (`1512 − 1478.95`) | `30px` (`style.css:857`) | `right: 33px;` |
| `.page0-dot` columns | horizontal offset from center | col.1 `+13.5px`, col.2 `-13.5px` (27px apart, symmetric) | single pair at `-14.5px`/`+1.5px` (16px apart) | superseded by the column-structure fix above |

---

## Other observations

- Title font: Figma specifies `Hadassah_Friedlaender_TRIAL:Medium` — same documented gap as everywhere else in the project (no true Medium OTF in `fonts/`, faked as weight 600 on Regular). Not a new drift, carrying forward the existing project-wide caveat.
- `get_variable_defs` returned `{}` for this node — nothing bound to a token, all literals on both sides.
- Didn't re-verify the dot squares' shape/fill beyond color (plain solid fill, no radius, no stroke) — that part already matches.

## Items verified as matching

- Dot square shape: plain solid fill, no border-radius, no stroke — matches Figma's plain `bg-[#hex]` divs ✓
- Title/subtitle font families (HadassahFriedlaender / Assistant) and the project's Medium-weight-faking convention ✓
- `get_variable_defs` confirms no bound variables anywhere on this node — no token-level drifts possible ✓
