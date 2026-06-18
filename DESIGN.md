# Design Rules

## Edge Gap
- All text and UI elements use **`W - 48`** as the right-edge anchor across every canvas screen.
- Applies to body text, legends, date lists, and any right-aligned content. (No longer applies to the title/subtitle, which moved to DOM — see below.)

## Layout & Scrollytelling
The site is one continuous scroll, not 10 discrete page-flips. `index.html` has a `.layout` flex row:
- **`.graphic-col`** — `position: sticky; top: 0; height: 100vh`, holds the single `<canvas>` (`width:100%; height:100%`). Stays pinned in the viewport while the user scrolls.
- **`.text-col`** — fixed `480px` width, sits beside it, holds 10 `<section class="text-section" data-page="N">` blocks in page order, each with the page's Hebrew title/subtitle as real DOM text (`.section-title` / `.section-subtitle`).

`main.js` runs an `IntersectionObserver` (`rootMargin: "-50% 0px -50% 0px"`) over `.text-section` elements: whichever section crosses the viewport's vertical center sets `currentPage` and triggers `draw()`, which still does `PAGES[currentPage](ctx, W, H)` — same per-page draw functions as before, just swapped on scroll instead of on wheel-tick. Switching is suppressed while a drag is in progress on pages 9/10 (`p9.dragging`/`p10.dragging`), so the canvas never changes out from under an active drag.

Because every page already draws everything as a fraction of its own `W`/`H`, narrowing the canvas to make room for `.text-col` requires no changes to that drawing code — only each page's old title/subtitle *drawing* was removed (it now lives in `.text-col`'s markup, same Hebrew strings, same order).

**Page 7 is a scroll-progress driver, not a normal section**: its section (`.page7-scrub`, `min-height: 400vh`) has no text of its own. A scroll listener in `main.js` (rAF-throttled) computes how far the user has scrolled through that section and sets `p7.currentDate` by linear day-interpolation between `p7.minDate`/`p7.maxDate` — replacing the old wheel-tick accumulation. `drawPage7`'s date-list rendering already recomputes purely from `p7.currentDate` on every call, so no other page7 changes were needed.

**Page 10 cross-cutting dependency**: `page10.js`'s `approxSubBottom` (originally just an estimate used to size the dot-grid rows) is now also reused as the canvas-side anchor for the dashed drop-zone geometry, standing in for where the old inline-drawn title block used to end. If `.text-col`'s title typography changes enough to visibly shift where the real DOM title block ends, `approxSubBottom`'s formula in `page10.js` may need re-tuning to match. `coverX = W - 280` in the same file is a fixed pixel inset (not a `W`-fraction) and is the most likely spot to need adjustment if the canvas gets meaningfully narrower.

## Title & Subtitle Typography (DOM)
Lives in `.text-section` (`style.css`), not canvas.

- **Font**: `'HadassahFriedlaender', serif` (loaded via `@font-face` in `style.css`, weights 400/Regular and 100/Thin).
- **Title** (`.section-title`): weight `400`, `24px`, color `#111`.
- **Subtitle** (`.section-subtitle`): weight `400`, `14px`, color `#111`, `opacity: 0.5`.
- RTL: `.text-section` sets `direction: rtl; text-align: right`.
- Each section is `min-height: 100vh; display: flex; align-items: center` — text is vertically centered by flexbox, not by a pixel formula. Wrapping is whatever the browser does at the fixed `480px` column width — no manual word-wrap loop needed anymore.

## squareboundingbox
- Defined in `squareboundingbox.js` as `SBB` (fractions of W/H).
- The center line (`W/2`) divides the box into left (left-wing events) and right (right-wing events).
- **Squares must never cross the center line.** Each side's grid width is computed as `W/2 - 15 - W*SBB.left` so dots are always contained within their half.
- A 4px gap is kept on each side of the center line.
