# Architecture

## Entry points

**`index.html`** — the scrollytelling experience, served at the site root — plus its two
language twins, **`en/index.html`** and **`ar/index.html`** (each with `<base href="../">`,
so all three load the same `style.css`, scripts and `events.json`). Three static methodology pages
sit beside them (`methodology.html`, `en/methodology.html`, `ar/methodology.html`), and
`project.html` is a redirect stub. The story pages pull Assistant from Google Fonts;
`style.css` declares the one local face (`@font-face`, top of the file): **Discordia**
(Regular only), the face the title blocks and hero title use.

> **Removed — don't reintroduce:** the שקוף article/home page (the old `index.html` +
> `trigger.css` + `images/protest.webp`, `related-knesset.jpg`, `related-march.jpg`) that
> used to front the project behind a `.shk-cta-button`. The root URL is the project now; `project.html` is a redirect stub to the root that
> keeps old shared links alive — never put content in it.

## Arabic version — `ar/index.html`

Served at `/ar/`. **Generated, not hand-edited:** `translate_ui_ar.py` (repo root) builds it
from `index.html` — the page is a copy with `<html lang="ar" class="lang-ar">`, `<base
href="../">`, Arabic copy on every line that differs between the Hebrew and English pages,
canonical / `og:url` at `/ar/`, Tajawal + IBM Plex Sans Arabic linked from Google Fonts, and the
Hebrew page's og image (no Arabic share card has been shot yet — see
[Dev-Workflow](Dev-Workflow.md)). The same run fills `I18N_AR` in `js/i18n.js` (between the
`I18N_AR_START` / `I18N_AR_END` markers), keyed by the Hebrew string like `I18N_EN`; `tr()`
picks the map by the page class (`isArabic()`). The @fold6 ACLED note (`FOLD6_NOTE_TEXT`,
js/groups.js) is wrapped in `tr()` so the Arabic lives in that map too. The raw result is
kept in `ar_translations.json`; `--apply ar_translations.json` re-applies it without the API.

**How it translates:** every string goes to OpenAI (`gpt-5.5-pro`, high reasoning) as a
Hebrew/English PAIR — the Hebrew is authoritative, the English a second reading of the
meaning — with a project brief and neutrality rules (balanced Arabic news-desk terminology,
one word for «קיצוני» — متطرف — throughout, formal plural address). The HTML items go out as
whole lines and come back with the Hebrew line's markup verbatim.

**Layout:** none of its own. Arabic is RTL, so the page runs on the Hebrew code path
(`isEnglish()` is false everywhere); the only `.lang-ar` CSS is the font family, because
Discordia / Assistant carry no Arabic glyphs: **Tajawal** wherever the Hebrew
page uses Discordia (`.section-title`, the hero title), **IBM Plex Sans Arabic** wherever it
uses Assistant (both Google Fonts, foot of `style.css`), plus one size override: the Arabic
face sits ~13% shorter than Discordia at equal px (Hebrew letters 0.68em vs the Arabic body
0.39em / alefs 0.63em, measured on Beiruti; 21/18 kept by eye for Tajawal), so **`.lang-ar .section-title` is 21px desktop / 18px
under 600px** — the one language-gated exception to the single `.section-title` size.
The hero title is not resized, but the hero title + subtitle sit higher as one (`.lang-ar .page0-title` / `.page0-subtitle` `top`: 8px up on desktop, 6px on the phone). Canvas-drawn text still uses the Hebrew faces (falls back
to the system Arabic font).

**Hero line breaks** match the Hebrew's at both breakpoints — title 3 lines, subtitle 4 —
by explicit `<br />`s in `ar_translations.json` (one word per title line, «متطرفون / من /
الجانبين»; subtitle «تحليل نشاط / المعسكرات / السياسية / في إسرائيل»), measured in the
Arabic faces against the shared 185px / 139px (desktop) and 175px / 125px (phone) boxes. The
Hebrew `top` solves (3-line title, 4-line subtitle) therefore hold unchanged. A different
Arabic wording means re-measuring the lines, not re-tuning `top`.

**Axis-event titles (desktop):** the side cards' corridor is 100px at 14px type, so the four
Arabic titles that overran it were shortened to one line — «التعديلات القضائية», «الهجوم في
عيلي», «الأسد الصاعد», «إطلاق سراح الرهائن» (measured in IBM Plex Sans Arabic 500 14px: 81 /
70 / 74 / 92px). The phone's cap is 220px, so `labelMobile` keeps the long form. Canvas text on
the Arabic page draws in IBM Plex Sans Arabic through `CANVAS_FACE` (js/i18n.js) — every
`ctx.font` that used to name Assistant goes through it.

**Language menu:** the generated page gets `is-current` on its own row; the hrefs stay
root-relative (`./`, `en/`, `ar/` — `<base href="../">` resolves them), via `HEAD_PATCHES` in the
script. Lines are re-applied by **content**, so an unrelated edit elsewhere in `index.html`
doesn't break `--apply`. `HEAD_PATCHES` adds only the Arabic faces' stylesheet (index.html
already preconnects to both Google Fonts hosts) and rewrites only the `canonical` and `og:url`
lines to `/ar/`.

**hreflang:** all three pages carry the same four `<link rel="alternate" hreflang>` lines under
`canonical` — `he` (the root), `en` (`/en/`), `ar` (`/ar/`) and `x-default` (the Hebrew root),
absolute like canonical. They pass through `translate_ui_ar.py` unchanged. `sitemap.xml` lists
all three pages and the three `methodology.html` pages.

**Event descriptions are translated too**, outside this script: pipeline step 07
(`07_short_english_and_arabic.py`, see [Data](Data.md)) writes a short English line
(`description_en_short`) and an Arabic line (`description_ar`) per event, and `server.py`
splits them into **`events-en.json`** / **`events-ar.json`** — `{ rowId: description }` maps next
to `events.json`, which itself stays Hebrew-only. `initPage7()` (page7.js) awaits
`p7LoadEnglishDescs(data)` before sorting: on a translated page it fetches the matching file
(`isEnglish()` → `events-en.json`, `isArabic()` → `events-ar.json`; the Hebrew page fetches
neither) and stores each description on its event as `descEn` — the "not Hebrew" slot for
both languages; only the English text is run through `p7StripLeadingDate`. Every tooltip reads
`p7EventDesc(ev)`, which returns `descEn` and falls back to the Hebrew `descHeMedium` if the
file failed to load or a row has no translation.

**Screen-reader and canvas strings** go through the same maps: the `#canvasA11ySummary` text
(`p7BuildDataSummary`, page7.js), the canvas «טוען נתונים...», and @fold12's live
announcement and ⓘ `aria-label` (page9.js). Sentences with a number or name in them use
`trf(key, vars)` (js/i18n.js) — the key is the Hebrew with `{name}` slots, each language's
value places the slots where its grammar wants them.

**After a Hebrew copy change** the Arabic page is stale until the script is re-run — log it in
[Translation-Pending](Translation-Pending.md) like the English.

## English version — `en/index.html`

Served at `/en/`. A copy of `index.html` with `<html lang="en" class="lang-en">` and
`<base href="../">`, so it loads the **same** `style.css`, scripts and `events.json` as the
Hebrew page — there is no second stylesheet or script set. Its canonical / `og:url` point
at `/en/`, so the @fold15 share row shares the English link.

All three pages carry a **language switch**: ONE button in the top-left corner (`#langWrap` → `.lang-switch`, a globe glyph + the current language's letters — «עב» / «EN» / «ع»; fixed, its TOP edge on the corner logo's top edge — 8px down / 12px in on the phone, where it is the globe alone (the letters are hidden), a 16px glyph with 6px around it (manual/-baked 2026-10-03), no tap highlight and no colour change on touch; 24px down / 24px in on desktop, globe + letters. At both breakpoints the card GROWS open over 180ms (grid-rows 0fr→1fr; `aria-hidden` + visibility instead of `hidden`, which would cut the transition); z-index 1007, above the mobile legend layer, below the gate). Clicking it opens a drop-down of the three languages (`#langMenu`, rows «עברית» / «English» / «العربية»; `js/lang-switch.js` — click outside or Escape closes). The look is the legend note's card (compare/ pick 2026-10-03 over an outlined box, a bare glyph and a darkened-page dialog): the tint over `--bg`, 16px corners, the note title's 600 `#767676` type (13px phone / 12px desktop), no chevron; the rows sit INSIDE the card, which grows around them. Each row is styled as the «הצגת גודל האירועים» control: 14px Assistant at rgba(0,0,0,.6), black on hover (180ms), with a 10px empty ring that fills dark for the current language and darkens its edge on hover — but never swells. The current language's row is black at rest and **not selectable** (`pointer-events: none`, `aria-current="page"`, `tabindex=-1`); opening the menu focuses the first other row. **Semantics: a disclosure, not an ARIA menu** — `#langWrap` is itself a `<nav>` (localized `aria-label`: «שפה» / «Language» / «اللغة»; being the positioned card, it adds no box), the button carries `aria-expanded` + `aria-controls` and an `aria-label` that STARTS with its visible letters («עב – בחירת שפה» / «EN – Choose a language» / «عر – اختيار اللغة», WCAG 2.5.3), and the rows are plain links. Focus leaving the switch closes it (`focusout`; a press inside the card or a window blur doesn't). The hrefs are `./`, `en/`, `ar/` on every page (the subpages carry `<base href="../">`).

All three pages also carry **העין השביעית's logo** in the top-RIGHT corner (a `div.seventh-eye` holding two links — the 7eye mark and the Shenkar mark, each reddening on its own desktop hover — followed by a thin divider `.shenkar-rule` and **Shenkar's logo** `.shenkar-mark`, `shenkar-logo.png` as a grey mask, 29px tall, 16px either side of the divider; on the phone the lockup is a grid with **no caption** (`.seventh-eye-caption` is `display: none` under 600px, all three languages) — two equal halves either side of the divider (`1fr auto 1fr`, `--se-rule-gap`), so the divider sits at the centre; each logo hugs it, both exactly `--se-rule-gap` (16px) from the line, 16px under «בשיתוף») (`.seventh-eye`, a fixed link to the7eye.org.il, `z-index: 1007` like the switch; 24px from the top and right on desktop, 8px from the top on the phone). **The desktop edge gap is one number, 24px**: the logo's `--se-right`, the language switch's `left` (`.lang-wrap`) and the legend columns' `FOLD6_LEGEND_INSET_LEFT/RIGHT` (js/groups.js — the ACLED note follows the right column) all sit 24px off their edge. The artwork is a CSS **mask** (alpha-only PNG) over `.seventh-eye-mark`, so the mark's colour is its `background-color`; the `<a>` is an optional backing plate. Every value is a `--se-*` custom property set **per breakpoint** (phone in the base rule, desktop in the 601px block). **Hebrew page:** the wide lockup (`seventh-eye-logo-wide.png`) with the line «בשיתוף» (`.seventh-eye-caption`) to its RIGHT, vertically centred (`--se-dir: row`; `--se-cap-y` is an optical nudge for Assistant's Hebrew letter body) — 120px wide / 14px text; this is the **desktop** layout and it stays on every fold until @fold13, where it fades out with the rest of the screen on the closing card's rise (`updateFold13`, js/fold11.js) and comes back when scrolling up. **Phone (both languages):** the same wide lockup, centred at the top of the screen with the line above it (`--se-dir: column`), 120px wide / 14px text (weight 400), 8px apart; it **fades out once scrolling starts** — `js/nav.js` flips `.is-scrolled` past `SEVENTH_EYE_FADE_SCROLL_PX` (8px) and the 600px block transitions opacity over `--se-fade-ms` (300ms), back in at the top. **English page, desktop:** the same wide lockup, `direction: ltr` so "In partnership with" sits to its LEFT (**removed — don't reintroduce:** the cropped stacked mark, `--se-crop`). Mark and line are both `#393239` at rest; on desktop, hovering turns the **mark only** to `#EC2A2C` over 150ms (`(hover: hover)` pointers). `--se-cap-display: none` switches the line off.

What differs, all gated on `.lang-en` / `isEnglish()` (js/i18n.js):

- **Title blocks and the event tooltip read left-to-right** (`.lang-en .text-card`,
  `.lang-en .page9-tooltip`, foot of `style.css`). Everything else keeps the shared look.
- **Tooltips show ACLED's English description** — `p7EventDesc(ev)` (page7.js) is the one
  reader every tooltip uses; see [Data](Data.md).

- **The hero text is `direction: ltr`** (`.lang-en .page0-title, .page0-subtitle`) — same
  boxes and positions as the Hebrew hero; a word wider than the title box spills right, so
  the title's lines share one left edge.
- **@fold2/@fold3 rows read swatch-then-label on desktop** (`fold3SwatchLeads()`,
  js/update-groups.js): the rect sits on the left of its label, and `campFold3X` centres
  that mirrored pair on the camp anchor. Into @fold4 the change rows stay that way; the
  coalition rows glide back to label-then-swatch for the right-edge legend column. Mobile
  keeps the shared layout.
- **Tooltip descriptions drop their leading date** (`p7StripLeadingDate`, page7.js) — the
  tooltip already shows the date on its own line. `events-en.json` itself stays verbatim.
- **Desktop legend furniture sits on the LEFT**: the ACLED note hangs under the left legend
  column, pinned by its left edge and growing rightward (`fold6NoteOnLeft`), heading on the
  left and chevron on the card's right edge; the «Show event scale» button sits over that
  same column, ring first, its ring centred on the swatch line. The note is 270px wide
  (`FOLD6_NOTE_WIDTH_EN`). Swatches and ring centre on Latin ink (`GROUP_LABEL_INK_REF`).
- **Phone hero title is 24px and subtitle 16px** (`.lang-en .page0-title` /
  `.page0-subtitle` in the ≤600px block; the Hebrew phone hero is 32px / 18px), each with
  its own `top`, solved so the last baseline lands on the same
  line as the Hebrew one. The title carries explicit `<br>`s, so it always breaks
  «Extremists / on Both / Sides». Desktop keeps the shared 40px.
- **Phone camp names run on two lines** («The Right-Wing / Coalition», «The Change /
  Bloc») — the `\n` in the `I18N_EN` string, honoured by `.lang-en .camp-header`'s
  `pre` under 600px and collapsed to a space everywhere else. The gap under them is
  `FOLD4_HEADER_GAP_MOBILE_EN_PX` (`fold4HeaderGapMobilePx()`).
- **The phone reads left-to-right too.** @fold3/@fold4 rows are swatch-then-label with
  the label ranged left (`fold3SwatchLeads()` is true at both breakpoints; the FLY
  hand-off anchors the label's LEFT edge, and `.lang-en .group-label.is-mfly-topanchor`
  drops the shared `translateX(-100%)`). The legend sheet's rows are `direction: ltr`
  per row, so the camps keep their sides. At @fold12 the pill row starts at the left and
  scrolls rightward (`.lang-en #page9ZoneBelow`), and the ghost title block, the stuck
  title and the action prompt range left — the stuck title travels to the LEFT edge, by
  `--p9-title-flush` negated. The phone's @fold12 title is «What is an extreme action to
  you?», short enough to stay on one line.
- **Phone @fold12's left edge is 12px**, the language button's — the pinned title
  (its stick transform carries the extra 12px), the action prompt and the first pill all
  start on it, not on the card column's 24px.
- **Copy is English.** The title blocks, hero and share block are translated in
  `en/index.html` itself. Strings the scripts render (camp headers, group labels, legend
  controls, category pills, the @fold12 subtitle) go through `tr()` in `js/i18n.js` —
  loaded first on both pages, a Hebrew → English table (`I18N_EN`). `tr()` is
  **display-only**: the Hebrew strings remain the keys (`category`, `P9_CATEGORIES`,
  `GROUPS` labels), and on the Hebrew page it returns its argument unchanged. A new
  script-rendered string needs a `tr()` at its render site and a row in `I18N_EN`.

**A markup change to `index.html` must be repeated in `en/index.html`.**

## `methodology.html` — the full methodology page

A second, static HTML page at the root: the complete methodology write-up (sources, filters,
grouping, classification, crowd, translation, dedupe, review, limits, prompts). Hebrew,
`dir="rtl"`, self-contained styles, and one inline script that opens the `<details>` matching
the URL hash (so a link to a prompt lands on its text). Documented in [Data](Data.md#the-methodology-page--methodologyhtml);
regenerate its prompt appendix with `python3 build_methodology.py`. Linked from the legend
note and the @fold16 credits. The English and Arabic story pages link their own twins,
`en/methodology.html` and `ar/methodology.html` (`FOLD6_NOTE_MORE_HREF`, js/groups.js, and
the credits card's link in each page's markup).

## Search / discoverability

The site is served by GitHub Pages at `https://eyalraz200-cell.github.io/both-sides-project/`
(no `CNAME`). The page carries a `<title>`, a `<meta name="description">`, a
self-referencing absolute `<link rel="canonical">`, the OG/Twitter card set, a favicon and
`lang="he"`. `robots.txt` (allow-all + the `Sitemap:` line) and `sitemap.xml` (the root and `methodology.html`)
sit at the repo root.

Two things that are easy to get wrong here:

- **`og:description` is not a search description.** Google ignores it and writes its own
  snippet unless a real `<meta name="description">` exists. Both are present on purpose.
- **Do not add `.nojekyll`.** Its absence is load-bearing: Jekyll refuses to serve any
  path beginning with `_`, which is exactly what keeps every `_debug-*.js` out of
  production. See the comment in `index.html`.

`index.html` is a canvas app: a crawler sees its ~16 `.section-title` scroll cards and
nothing else, since all 12,283 events are painted. Anything that must be findable has to
exist as real markup on the page (the hero `<h1>`, the `<meta name="description">`).

## `index.html`'s layout

```
.layout
├── .graphic-col          z-index 0 — its own stacking context
│   ├── #canvas           full-viewport canvas; all dot/square/axis rendering
│   ├── #page0DotsOverlay @fold1's fixed decorative dot columns
│   └── #fold6SquaresOverlay  the 8 sample squares
├── #groupsOverlay        z-index 0, mobile 1003 — the 6 persistent group DOM nodes (see Groups-and-Legend)
├── #langWrap             .lang-wrap, z-index 1007 — the language switch (js/lang-switch.js)
├── .seventh-eye          z-index 1007 — העין השביעית's corner logo link
├── #page9Tooltip         shared event tooltip (page7 + page9 + @fold5's phase-2 demo)
├── #page9CatTooltip      tray-pill tooltip
├── .fold6-legend-hover ×2  z-index 3 — the desktop legend hover boxes + filter strips (js/groups.js); inserted BEFORE .text-col so the strips come early in the tab order
├── .p7-scope-btn         z-index 3 — «הצגת גודל האירועים» (desktop); also before .text-col, after the boxes
├── #fold6NoteLayer       z-index 2, desktop 1005 (above the 1004 title cards — the note paints in front of whatever it meets) — the ACLED source note is reparented here at init
├── #fold6MobileLegendLayer  z-index 5, mobile 1006 — the mobile מקרא bar (Groups-and-Legend)
└── main.text-col        NO z-index (see below) — the page's `<main>` landmark; the 18 <section.text-section> scroll drivers (`#page-0` … `#page-17`)
```

**`.graphic-col` traps z-index.** Anything that must stack above `.text-col` has to be a
direct `.layout` child, not nested inside `.graphic-col` — that's why the event
tooltip, the category tooltip, the ACLED note layer, the language switch, the corner logo,
@fold5's demo cursor (`.fold7-cursor`, appended by js/groups.js; z-index **1003** on
desktop, and the phone's hand `.fold7-touch` is 1003 too — so the title block's 1004/1005
paints in front of it) and **`#groupsOverlay`** live where they do. The mobile stack is
**groups 1003 → title blocks 1004/1005 → מקרא layer 1006**; the groups overlay is
`position: fixed; inset: 0` and sits before `.text-col` in source order, so its desktop
`z-index: 0` paints under the cards. Nested inside `.graphic-col`, the ACLED link would be
unclickable, the category tooltip would lose to the tray, and the mobile docked event frame
would be untappable (every touch landing on `section#page-9`). Don't "tidy" them back inside.

**`.text-col` carries no `z-index` on purpose.** Being positioned, it already paints above
`.graphic-col` on tree order; leaving it `auto` keeps it from opening a stacking context,
which is what lets `.text-card` lift itself (to 1004 on mobile, 1005 for the cards that
share the screen with the docked tooltip) into the same stacking order as the groups overlay
and the מקרא layer — above the groups, below the מקרא. Add a `z-index` here and every
descendant gets trapped inside it.

## Scripts and shared globals

Loaded as plain `<script>` tags, in this order (`index.html`):

```
js/i18n.js → squareboundingbox.js → page1.js → page7.js → page8.js → page9.js → page12.js
→ js/core.js → js/nav.js → js/lang-switch.js → js/fold1-intro.js → js/page7-scrub.js
→ js/fold8-tooltip.js → js/groups.js → js/update-groups.js
→ js/page8-9-scroll.js → js/fold11.js → js/bootstrap.js → reload.js
```

`en/index.html` and `ar/index.html` load the same list in the same order.

There are no modules and no imports. Every file declares top-level `const`/`function`s
into the shared global scope, and cross-file references resolve **at call time**, not at
load time — so `page7.js` freely calls `GROUPS` (defined later, in `js/groups.js`) because it
only runs after everything has loaded. A symbol used in one file being defined in
another is intentional, not a missing import.

Two places load order does matter:

- `buildPage0AllDots()` (defined in `page1.js`) is *called from* `js/groups.js` right
  after `GROUPS` is declared, because it reads group colors that don't exist yet when
  `page1.js` itself is parsed.
- The fold triggers in `js/groups.js` pass their tick callbacks as **arrow wrappers** —
  `makeTrigger(MS, (...a) => updateGroups(...a))` — because `updateGroups`
  (`js/update-groups.js`) and `updateFold13` (`js/fold11.js`) are declared in files that
  load *after* `groups.js`. A bare identifier there evaluates at load time and throws a
  ReferenceError; the wrapper defers resolution to call time. Don't "simplify" the
  wrappers away, and don't fix it by reordering scripts instead — the dependency is
  circular (`update-groups.js`'s `scrollend` listener needs `checkGroupTriggers`, and
  `fold11.js`'s load-time `p13SyncGateVisibility()` needs `page12StickyEl`, both from
  `groups.js`).

| File | Role |
|---|---|
| `js/i18n.js` | `tr()`, `isEnglish()` / `isArabic()`, the `I18N_EN` / `I18N_AR` tables — **must load first** |
| `js/core.js` | Canvas + `ctx`, `PAGES[]` dispatch, `currentPage`, trivial draw fns, `draw`/`init`, dashed-frame SVG utilities |
| `js/nav.js` | `.text-section` roster, `setActivePage`, the IntersectionObserver |
| `js/lang-switch.js` | Opens / closes / dismisses the language menu (`#langWrap`) |
| `js/fold1-intro.js` | @fold1 title scroll-lag, page-load entrance (a logo-fade timing still paces its end; `page0LogoEl` is null) |
| `js/page7-scrub.js` | `#page-9` scroll→date scrub + its scroll listener |
| `js/fold8-tooltip.js` | @fold5's (phase 2) tooltip typewriter demo (`fold8*` state + fns) |
| `js/groups.js` | `GROUPS` roster, fold2 grid tables, `groupItems` DOM, FOLD6 square tables/elements, title-card refs, `makeTrigger`, **all fold triggers**, `watchCardThreshold` + checkers, legend/fold4/fold6-note constants |
| `js/update-groups.js` | The `updateGroups` monolith, `layoutGroups`, groups/axis scroll wiring |
| `js/page8-9-scroll.js` | page8 title-center hold, page9 sticky/title scroll |
| `js/fold11.js` | Outro morph (`updateFold13`) + the scroll gate |
| `js/bootstrap.js` | Font-load bootstrap + resize handler — **must load last** |
| `page1.js` | `drawPage1` + the @fold1 decorative dot-column builder |
| `page7.js` | The pinned real timeline: per-event square cascade + canvas year axis + hover |
| `page8.js` | Bridge glide from timeline layout → page9's legit grid |
| `page9.js` | Drag-and-drop categorization + dot-migration animation |
| `page12.js` | `drawPage12` outro background; `p12ShareInit` fills **@fold15's** share block (`#page-16`) — not the @fold16 outro card (called from `js/bootstrap.js` after fonts load) |
| `squareboundingbox.js` | Shared grid geometry (`SBB` — only `.top` is read, `SBB_TIMELINE`, `CENTER_GAP`) |
| `reload.js` | Dev-only mtime poll → auto page reload |
| `server.py` | Local dev server + xlsx → `events.json` generation |
| `translate_ui_ar.py` | Generates `ar/index.html` + `I18N_AR` from the Hebrew/English pair (see the Arabic section above) |
| `methodology.html`, `en/methodology.html`, `ar/methodology.html` | The static methodology pages (see above) |
| `build_methodology.py` | Injects the `0N_*.py` prompts verbatim into all three methodology pages' appendix — run after every prompt edit |

## Removed — don't reintroduce: the work-in-progress gate

The first-visit notice («הפרויקט נמצא בתהליך עבודה…» with its «הבנתי, להמשך
הפרויקט» button, `.shk-gate`, `js/intro-gate.js`, the `shk-gate-seen` flag) is gone
from all three pages, in every look. @fold1's entrance plays on load
(`playPage0Entrance()` in `js/bootstrap.js`).

## Page dispatch

```js
// index = HTML section id (`page-N`), not the fold number
const PAGES = [drawPage1,      // 0  @fold1
               drawBackground, // 1  @fold2
               drawBackground, // 2  @fold3
               drawFoldSplit,  // 3  @fold4
               drawFold7,      // 4  @fold5
               drawBackground, // 5  @hidden-acled
               drawFold7,      // 6  @hidden-hover
               drawFold9,      // 7  @fold6
               drawFold9,      // 8  @fold7
               drawPage7,      // 9  @fold8  — the pinned timeline
               drawPage7,      // 10 @fold9  — the size grid
               drawPage8,      // 11 @fold10 — owns the glide
               drawPage8,      // 12 @fold11 — the glide plays over it
               drawPage9,      // 13 @fold12 — drag-and-drop
               drawPage12,     // 14 @fold13
               drawPage12,     // 15 @fold14 — the partner credit
               drawPage12,     // 16 @fold15
               drawPage12];    // 17 @fold16
```

18 slots, one per `.text-section`, in `js/core.js`.

`setActivePage(page)` is driven by an `IntersectionObserver` with
`rootMargin: "-50% 0px -50% 0px"` — i.e. a section becomes current when it crosses the
viewport's vertical midline. It also handles the cross-fold handoffs:

- `>=4 → <4` (leaving @fold5 or later for @fold4 or earlier): `p7ResetForReplay()` —
  backstop only; the normal wipe happens in `drawFold7`/`drawFold9` once the reverse
  cascade finishes (see [Timeline](Timeline.md))
- `12 → 13` (@fold11 → @fold12) while the glide is still mid-flight: seeds `p9.anim` from
  `p8CaptureBlendedPositions(W, H, 0)` (`plainGlide: true`, plus `fromSQ: p7.SQ` unless the size grid is on — page8
  shrinks the dots across the glide, so drawPage9 must keep lerping the size or they snap
  small at the handoff and the flight reads as dimmer)
- `10|11|12 → 9` (@fold9/@fold10/@fold11 → @fold8) while the glide has started: seeds `p7EntryAnim`
  from `p8CaptureBlendedPositions(W, H, 1)`

Both seed the glide's **endpoint** positions with a back-dated `start`, never the current
blended position with the remaining duration — see [Timeline](Timeline.md#handoff-to-page8page9).

It then sets `currentPage`, and calls `updateGroups()` and `draw()`.

`draw()` dispatches to `PAGES[currentPage]`. Scroll-driven per-frame work is
rAF-throttled behind passive `scroll` listeners (`page7Ticking` and friends).

## Design tokens

`style.css`'s top `:root` block holds the values the file repeats; rules use the `var()`, not
the literal. Group colours, `#fff`/`#000`, `#F4F3F6`, z-indices, radii and one-off values stay
literal.

| Token | Value | Used for |
|---|---|---|
| `--bg` | `#FDFCFF` | page paper. Also read **once at load** by JS: `P7_PAPER` (page7.js — keep it a 6-digit hex, `P7_PAPER_RGB` parses it) and `FOLD12_GHOST_FILL` / `_MOBILE` (js/page8-9-scroll.js) |
| `--card-w` | `min(456px, 100vw - 48px)` | title-card column (the mobile `min(480px, …)` values are separate literals) |
| `--card-top` | `4.4vh` (mobile `:root` override: `40px`) | pinned title-card / page9-header top |
| `--ink` | `#111` | `.section-title`, dark buttons, share/gate fills, `--pl-color` |
| `--ink-soft` | `rgba(0,0,0,.81)` | group labels, the scope button and its filled state, current language row |
| `--ink-note` | `rgba(0,0,0,.85)` | legend note / מקרא body text (not the loupe's ring shadow, which stays literal) |
| `--muted-ui` | `#767676` | note titles, מקרא buttons, language switch |
| `--line-light` | `#E1E1E1` | mobile: extreme pill fill/edge, מקרא row fill |
| `--font-body` | `'Assistant', sans-serif` | every body/UI line, incl. `--se-cap-font` |
| `--font-title` | `'Discordia', serif` | title blocks and the hero title |
| `--font-ar` | `'IBM Plex Sans Arabic', 'Assistant', sans-serif` | Arabic body/UI text |
| `--ui-fade-ms` | `180ms` | small CSS state flips: hover colours, language menu open/close, scope button |
| `--tray-ms` / `--tray-ease` | `.85s` / `cubic-bezier(0.22, 1, 0.36, 1)` | @fold12 pill tray slide and its matching visibility delay (the gate squares' 520ms use the same curve as a literal) |
| `--fade-ms` | `.35s` | @fold12 title card's stick fade (frame, fill, subtitle, mobile padding) |

`.seventh-eye` carries its own `--se-ink: #393239`, feeding `--se-color` and `--se-cap-color` at
both breakpoints. The `--se-*` and `--pl-*` blocks still restate every value per breakpoint on
purpose (tuning one breakpoint never moves the other).

## Title blocks

No text on the story pages is selectable, at either breakpoint: a `*, *::before, *::after` rule in `style.css` sets `user-select: none !important` (plus `-webkit-touch-callout: none`) on every element. The methodology pages (`methodology.html` and its `en/` / `ar/` twins) don't load `style.css`, so their text stays selectable. **Removed — don't reintroduce:** making the story text selectable.

Each scrolling section's text is a `.section-text.text-card` — a normal-flow,
`var(--card-w)`-wide (`min(456px, 100vw - 48px)`), horizontally centered block that scrolls
with the page.

The dashed white box is a **separate** class, `.text-card-frame`, applied only to the
`<h2 class="section-title">` — never to sibling content like a legend. The dash is not
`border-style: dashed` (too loose) and not a `border-image` (unreliable on wide, short
boxes); it's a transparent CSS border of `--frame-border-w` (**1.25px at both breakpoints**) plus an inline
`<svg class="text-card-frame-dash">` rect drawn against a 1:1 viewBox, stroke
`frameStrokeW()` (`FRAME_STROKE_W_DESKTOP` / `FRAME_STROKE_W_MOBILE`, both **1.25**; **mobile snaps it to whole device pixels** (`frameStrokeW()`: 4/3px on a 3× phone, 1.5px on 2×) and writes that width inline as `--frame-border-w` on each frame — a fractional stroke anti-aliases differently per side and read as a border thicker along the top and left; **the svg is placed and sized in JS** (`updateTextCardFrameDashes`: inline `top`/`left` = minus the frame's *computed* border width, `width`/`height` and the viewBox = the frame's real fractional size) — the browser snaps a fractional border (1.25px computes to 1px), so a stylesheet `calc()` off `--frame-border-w` would sit the svg a fraction of a px up-left of the box and a fraction too big; desktop also has `FRAME_STROKE_OPACITY_DESKTOP`, **1**, written as the rect's `stroke-opacity`; `fitDashArray` keys its perimeter cache on a rect's own geometry, so a re-stroked frame re-fits its dashes instead of joining two where the path wraps;
`js/core.js` — each must equal `--frame-border-w` at its breakpoint; the stroke attrs are
rewritten on every bake so a resize across the breakpoint re-strokes), 2px-dash/2px-gap,
inset by half the stroke with rx = 8 − half-stroke
so the outer edge sits on the box's 8px radius. `DASH_PERIOD = 4` plus
`fitDashArray`/`updateTextCardFrameDashes` in `js/core.js` keep the repeat aligned. A
`ResizeObserver` on every frame re-runs the bake whenever a frame's border box changes —
it MUST observe with `{ box: "border-box" }`, not the default content-box: @fold12's
mobile `.is-stuck` transition animates *padding*, which moves the border box while the
content box stays put, so a content-box observer never fires for it — and a mid-stuck
re-bake (iOS address-bar `resize`) would freeze the stuck-size viewBox in, leaving the dash
stretched across the wider un-stuck frame on scroll-back-up.

`.section-title`'s base rule is shared by **every** card. **Desktop: `font: 400 18.5px/1.5 'Discordia'`**
(Discordia Regular, a local `@font-face` at the top of `style.css`, `fonts/Discordia-Regular.otf`;
Naipe Foundry, licensed via Hafontia). **Phone (≤600px): `font: 400 16px/1.5 'Discordia'`**. No page overrides font-size or weight — with **one named
exception: @fold16's credits card, `#page-17 .section-title`, is 36px on desktop and 26px under
the 600px breakpoint** (`style.css`), because it is the piece's closing headline over a
near-viewport-tall card, not a caption. Any other title that looks differently sized at the same
viewport width is a regression. The card column `--card-w` is `min(456px, 100vw - 48px)` at
both breakpoints (phones resolve the `100vw - 48px` arm).

**@fold1's hero title** (`.page0-title`, `style.css`) follows the title blocks' face per breakpoint.
**Desktop:** Discordia 400, 40px/1.35, 185 wide, `left: calc(50% +
8.5px)`, `top: calc(50% - 270.8px)` (last baseline 22px above its dots, trimmed). Subtitle
(`.page0-subtitle`): Assistant 300, 18px/1.48, 139 wide, `left: calc(50% - 11.5px)`, `top: calc(50% -
186.7px)` (20px), wrapping on its own `<br>`s (4 lines). **The dot columns' gap is per breakpoint
too:** `page0DotColX()` in `page1.js` — `PAGE0_DOT_COL_X_DESKTOP` 16.5 (a 26px gap between the
columns' inner edges) / `PAGE0_DOT_COL_X_MOBILE` 13.5 (20px, the Figma-literal value);
`buildPage0AllDots()` re-derives `PAGE0_DOT_COLS` from it on every build. The texts sit relative to
their column's inner edge (title box 1.5px inside the right column's edge, subtitle's right edge
1.5px inside the left column's), so a gap change moves them with it.
**Phone (≤600px block):** title Discordia 400, 32px/1.45,
`width: min(185px, 50vw - 20px)`, left +8px, top −230.1px (last baseline 20px above its dots);
subtitle 125 wide, left −10px, line-height 1.41, top −165.9px (20.5px); the phone keeps the 20px
column gap; both mobile tops are anchored to **`--page0-half`** (half the viewport height pinned at the hero's first build, `page0BuildHeight()` in page1.js — so the bar collapsing moves nothing) and add `var(--page0-trim)` (the top-trimmed column's offset, `PAGE0_TRIM_MOBILE` in page1.js) plus `var(--page0-drop)` (0 on the phone). The tops are solved for each font's metrics,
so re-solve them whenever a face, size or leading changes.

The 600px breakpoint's 16px is a width override applied
to the same shared rule, so the titles stay uniform with each other at any given width;
it is not the per-page kind the rule forbids.

**The title *is* the frame.** On the scrolling cards, both classes sit on one element:
`<h2 class="section-title text-card-frame">`. So `.text-card-frame`'s `margin: 0 auto`
(later in the file, same specificity) already overrides the base rule's `margin: 0 0 8px`
— the computed bottom margin is `0`, and the frame's padding is the only vertical
spacing in play. Don't add a bottom margin to `.section-title` expecting it to sit inside
the frame; it lands outside, and only wherever the override doesn't apply.

See also: [Folds](Folds.md), [Animation-System](Animation-System.md),
[Dev-Workflow](Dev-Workflow.md).

## Mobile / responsive

One breakpoint, **600px**, declared in two places that must stay in sync: `MOBILE_BP` /
`isMobile()` (`js/core.js`), and the `@media (max-width: 600px)` blocks in `style.css`.
`isMobile()` is cached — see [Per-frame cost](#per-frame-cost--the-layout-read-rule). The cache refreshes in `js/core.js`'s resize listener, but the `page*.js` files load before `core.js`, so a resize listener registered in one of them runs first and must call `refreshBreakpointCache()` itself before reading `isMobile()` (page9.js does — without it @fold12 fell back to the bottom-tray layout after a resize across 600px and back).

The `resize` handler (`js/bootstrap.js`) **preserves the reader's fractional scroll
position**: the vh-sized sections mean a window-height change changes the document height
while the browser keeps raw pixel `scrollY`. `js/bootstrap.js` tracks `scrollY /
scrollable-range` on every scroll and re-pins that fraction (instant `scrollTo`) at the end
of its resize handler, after all re-layout has settled, at both breakpoints. Mobile
height-only resizes (the URL bar) return early before it (below), so on a phone it runs
only on a width change — a rotation or breakpoint crossing, which rebuilds a document of a
different height (portrait ~20,000px, landscape ~9,700px); the fraction is what survives
that. **Removed — don't reintroduce:** an `!isMobile()` guard on that restore (a phone
rotated out and back landed four folds earlier).

**A height-only resize on mobile skips the relayout entirely.** A phone fires
`resize` continuously while its URL/bottom bar slides, and the handler's work — a fresh
full-viewport canvas backing store, every page-0 dot element rebuilt, six labels
re-measured — would stall the main thread long enough that the browser abandons the
collapse and snaps the bar back. `js/bootstrap.js` compares `window.innerWidth` against the
previous resize: under `isMobile()`, an unchanged width means bar movement and the handler
only calls `draw()`, plus one debounced settle (180ms after the last tick) that runs
`page0ApplyDrop()`, `layoutGroups()` and `draw()` so the hero follows the new bottom edge.
Nothing is lost — scroll geometry is `vh` (fixed on mobile, it does not track the
bar) and `draw()` re-syncs the canvas backing store on every paint anyway. A width change
is a real rotation/breakpoint crossing and still runs the full handler. The timeline's
layout cache applies the same rule: `p7UpdateLayout` (page7.js) returns early on mobile
when only `H` changed, so the solved square, rows and corridor never re-solve on a bar
slide — the dots would otherwise visibly resize on every scroll that moves the bar. The
field still re-centres because `p7VertTopY` reads the live height each paint.

**Canvas backing-store sync:** the canvas's pixel buffer is sized in `init()` (js/core.js)
and *re-checked on every `draw()` frame* against `clientWidth/Height × dpr` (rounded ints,
same basis in both places — a fractional `getBoundingClientRect` would disagree and
re-clear every frame). The per-frame check exists because iOS fires `resize` mid
browser-bar slide: `init()` alone could bake the buffer at a height the canvas only passed
through, after which every frame would draw squeezed onto the stale buffer with old pixels
left in its bottom band. Never size the buffer only from resize events.

Most of the page is breakpoint-agnostic: `.graphic-col`/`#canvas` are full-viewport, the
canvas is DPR-aware, `SBB`/`SBB_TIMELINE` are fractions, every fold's Y is scaled from the
982px `GROUPS_FRAME_H`, the SVG dash frames measure live, and input is Pointer Events
throughout. What the breakpoint actually changes:

| Value | Desktop | Mobile |
|---|---|---|
| `--card-w` (`style.css`) | `min(456px, 100vw - 48px)` | same rule (resolves to `100vw - 48px` on phones) |
| `.text-section` gutter | 48px | 24px |
| `.section-title` | Discordia 400 18.5px/1.5 (`#page-17`: 36px) | Discordia 400 16px/1.5 (`#page-17`: 26px) |
| `.page0-title` / `.page0-subtitle` (hero) | title Discordia 40px/`1.35`, `top: calc(50% - 270.8px)`; subtitle 18px/`1.48`, `top: calc(50% - 186.7px)` | title Discordia 32px/`1.45`, `top` off `--page0-half` − 230.1px; subtitle 18px/`1.41`, − 165.9px — see [@fold1's hero title](#title-blocks) above. Each `top` is solved so that text's **last baseline** sits a fixed gap above its own dot column. **Leading and `top` are one setting** — move either and re-solve the other |
| `.text-card-frame` padding | `21px 29px` | `16px 22px` (holds the 1.38 h:v ratio); exception: @fold12's title frame (`.page9-title-row`) runs `padding-block: 8px` — its single short line read as an oversized fill at 16px. The subtitle's `-8px` margin-top is derived from it (gap − 10) |
| camp header → top swatch row (constants in `js/groups.js`, applied in `js/update-groups.js`) | `FOLD4_HEADER_GAP` **36px** center-to-center (plain px, not `H`-scaled), lerped to @fold3's `FOLD3_HEADER_GAP` 42 over `alignT` | `FOLD4_HEADER_GAP_MOBILE_PX` — a flat **20px visible** gap, measured off the header's rendered height (`FOLD3_HEADER_GAP_MOBILE_PX` equals it; the English page's two-line headers use `FOLD4_HEADER_GAP_MOBILE_EN_PX`) |
| camp gap (`campCenterGapPx`, `js/groups.js`) | flat 180px half-gap | a fixed **90px visible** gap between the blocks' facing edges (`FOLD2_CAMP_EDGE_GAP_MOBILE_PX`), i.e. a 94px half-gap at the 4-wide, 98px block — chosen by eye. **@fold3 has its own**, `FOLD3_CAMP_EDGE_GAP_MOBILE_PX` **82**, lerped from @fold2's over `alignT` — see below |
| `.group-label` | 18px, `nowrap` | 16px, wraps, `width: max-content` + `max-width: 100px`, `direction: rtl` |
| group-label font-size (inline, `js/update-groups.js`) | 18 column / 14 legend | 16 column / 12 legend — via `groupLabelColumnFontSize()` / `groupLabelLegendFontSize()` |
| @fold3 row step (`fold3RowStep`) | 34px flat (`FOLD3_ROW_PITCH_DESKTOP_PX`, inside `updateGroups`) | per row: this row's tallest wrapped label + **13px** (`FOLD3_ROW_LABEL_GAP_PX`), floored at 32 (`FOLD3_MIN_ROW_PITCH_MOBILE_PX`) — equal visible gaps. Both mobile numbers are module-scope `var`s at the top of js/update-groups.js so a manual/ harness can drive them live; the desktop pitch deliberately stays a function-local `const`, so raising the mobile gap cannot reach it |
| mini-legend row pitch (`fold6RowPitchPx()`) | 24px (`FOLD6_ROW_PITCH`) | measured — tallest wrapped legend label + 6px (`FOLD6_ROW_LABEL_GAP_PX`), floored at 24 |
| Mini-legend + ACLED note | Six DOM group rows over the canvas; the note sits above their top row | **The legend collapses into the מקרא sheet** — a **full-bleed bottom sheet** (`FOLD6_MLEGEND_POSE = "sheet"`, js/groups.js), not a floating corner card, whose title row is the מקרא button; the six group rows fly into it at `@fold4` and it **closes itself** shortly after they land. The ACLED credit lives **inside** the sheet as a collapsible «איסוף הנתונים» section (`fold6MobileDataHeadEl` / `fold6MobileDataBodyEl`) — **removed, don't reintroduce:** the bare `acleddata.com` link that used to sit in the opposite top-left corner. See [Groups-and-Legend](Groups-and-Legend.md#the-mobile-מקרא-bar--a-full-bleed-bottom-sheet) |
| `#page-17` (@fold16, the credits card) frame / title | sized from the viewport edges: `height: calc(100vh - 44px)` (22px gap top and bottom), width solved in JS by `p12CardWidthFit()` (page12.js, at load, on `document.fonts.ready` and on a debounced resize) — the narrowest width in 320–900px at which the copy still clears the bottom padding, which is also the width that FILLS the fixed height, since a narrower column is a taller one; the CSS `width: 520px` is that answer for a 982px-tall viewport and the fallback if the script never runs. 40px side padding, 42px top/bottom, copy vertically centred in whatever height is left over (`#page-17 .text-card` is `fit-content` so it stays centred) / 36px, 42px under it; the «נתונים ושיטת עבודה» heading (`.page12-body-heading`) is 600 with 8px under it at both widths | `min(450px, 100vw-48px)` border-box, height auto / 26px, 26px under it |

**The camp gap is the load-bearing one.** `FOLD2_CAMP_CENTER_GAP_PX` (180) puts two 98px
blocks *plus* @fold3's outward-trailing labels at ~500–600px of required width. Everything
that positions a camp — the @fold2 grid, @fold3's `campFold3X` column, and both camp
headers — goes through `campAnchorX`, which reads `campCenterGapPx(W)`. Never
reintroduce a direct `W/2 ± FOLD2_CAMP_CENTER_GAP_PX` at a call site; the headers would
detach from their blocks on a phone.

**On mobile @fold3 runs a tighter gap than @fold2.** By @fold3 the blocks are gone and it's
two label runs facing each other, where the shared 90px reads too wide.
`FOLD3_CAMP_EDGE_GAP_MOBILE_PX` (**82**) is passed to
`campCenterGapPx(W, edgeGapMobile)` as a lerp from @fold2's value over **`alignT`**, the beat
that flies the rects into their column. So @fold2 keeps its own tuned number, the anchors
never snap, and the camp headers (which ride `campAnchorX` at @fold2 and the column's dot
edge at @fold3) follow along. Desktop passes no override and keeps one gap for both folds.

**An inline style beats the stylesheet.** `updateGroups()` writes
`label.style.fontSize` on every frame, so the stylesheet's `.group-label` font-size is
overridden at both breakpoints. The sizes come from `groupLabelColumnFontSize()` /
`groupLabelLegendFontSize()` (`js/groups.js`) — **the single source of truth. Never
re-inline the numbers at the call site.**

**Wrapped labels need a measured row pitch.** Once labels wrap, a flat pitch prints rows
over each other. `fold6RowPitchPx()` (`js/groups.js`) takes `Math.max(FOLD6_ROW_PITCH,
tallest measured legend label + FOLD6_ROW_LABEL_GAP_PX)`; `fold3RowStep`
(`js/update-groups.js`) sizes each mobile step off that row's own wrapped label (whose first
line sits on the row y, the rest hanging below) plus `FOLD3_ROW_LABEL_GAP_PX`, floored at
`FOLD3_MIN_ROW_PITCH_MOBILE_PX`, so the visible gap is equal between every pair of rows.
Desktop's step is the flat `FOLD3_ROW_PITCH_DESKTOP_PX` (34) with no `max()` — its labels
are `nowrap` one-liners. Rows grow downward off a fixed top anchor shared with @fold2
(`fold3TopRowY = fold2TopRowY`, no re-centering — see Groups-and-Legend).

**`width: max-content` on the mobile `.group-label` is load-bearing.** `.group-item` is
`position: absolute` with no width, so an absolutely-positioned child with only a
`max-width` shrink-to-fits against a ~0-wide containing block and collapses to its longest
word (~35px, four stacked lines). It also makes the hidden measuring span agree with what
actually renders, which the pitch math above depends on.

**The label cache is the subtle one.** `groupLabelWidth()` (`js/groups.js`) caches measured
widths per color, and @fold3's column placement is derived from them — but the breakpoint
changes the label's font-size and wrapping, so `js/bootstrap.js`'s resize handler clears
`groupLabelWidths`/`groupLabelHeights`/`groupLabelInkShifts` unconditionally.
(`groupLabelHeight()` keys per color, per font-size **and** per wrap cap, because the
column and the smaller mini-legend ask at different sizes and different caps — see
[Groups-and-Legend](Groups-and-Legend.md).) The hidden measuring span carries
the real `.group-label` class, so the wrapped width feeds the layout math automatically.

**A wrapped label measures by its widest LINE, not its box.** On mobile `.group-label` is
`width: max-content` capped at 100px (140px for the two groups carrying `labelCapMobile`),
so a label that wraps has an `offsetWidth` of exactly the cap while its lines each break
short of it. `campFold3X` centres the rect-plus-label column on the camp anchor using that width, so box-width left the
column visibly off-centre — worst in גוש השינוי, whose two long labels both run
the 140px cap. `groupLabelWidth()` therefore measures a `Range` over the span's text node
and takes the widest of its per-line client rects (`groupLabelInkWidth()`), falling back to
`offsetWidth` if the API yields nothing. Desktop labels are `white-space: nowrap`, so the
two numbers are identical there and nothing above the breakpoint moves.

**Wrapped Hebrew needs both `direction` and `text-align`.** The document is `dir=ltr`, so
a label's *paragraph* direction is LTR even though its characters lay out RTL by bidi. On
desktop's single `nowrap` line that is invisible; once the labels wrap it breaks the run
in the wrong place and left-aligns the short lines. `direction: rtl` on the mobile
`.group-label` fixes the breaking. Alignment can't live in CSS with it, because it depends
on which side of the swatch the label currently sits on — the box is only as wide as its
longest line and is anchored on the edge facing the swatch, so swatch-first labels
(@fold2/@fold3's columns, the right legend column) must be flush **right** and the
label-leading left legend column flush **left**. `updateGroups` writes it inline off the
same `sideT` that drives the side-swap, snapped at 0.5 (`text-align` has no in-between).

`--card-top` and every `.text-section` `min-height` use **`vh`, never `dvh`**: on mobile
`vh` is pinned to the large viewport for the whole session, while `dvh` re-resolves each
time the URL/bottom bar collapses — which would resize every section and shift every later
fold's `offsetTop` by hundreds of px under a fixed `scrollY`, throwing the reader backwards
through the timeline folds (@fold8–@fold10).

### No horizontal scroll, and no `overflow-x` guard

No story page has an `overflow-x` rule on `html` or `body`, and one must not be added.
The documents genuinely fit their viewport from 320px up — verified by measuring
`scrollWidth` at eight widths across the full scroll of each page (the recipe is in
[Dev-Workflow](Dev-Workflow.md#checking-mobile)). Clamping with `overflow-x: hidden` would
make that measurement useless and hide the next regression.

The fixed-width elements are kept inside the viewport at the element (≤600px):

- **`.page9-tray-row`** is `display: contents`; all 10 pills form one `nowrap`
  horizontally-scrolling row on `#page9ZoneBelow` (`overflow-x: auto`), 16px pills, one
  line — see [Folds](Folds.md#fold12s-tray-on-mobile).
- **`.page9-tray`** is a band at `top: 96px` (`P9_TRAY_TOP_M`, page9.js) under the title
  card; the docked tooltip frame drops below it (`p9TooltipDropTrigger`).
- **`.page9-title-row .text-card-frame`** is centered while scrolling, then flushed right
  **in `.is-stuck` only** — a measured `translateX(--p9-title-flush)`
  (`page9UpdateTitleFlush`, `js/page8-9-scroll.js`), side padding zeroed alongside it —
  see [Folds](Folds.md#fold12s-tray-on-mobile).
- **`.page0-title`** is `min(185px, 50vw - 20px)` wide from `calc(50% + 8px)`.

RTL blocks overflow off the *left* edge — `scrollWidth` still catches it, but a check that
only looks at `right > vw` does not.

Per-fold mobile state is the table in [Folds](Folds.md#mobile-status).

## Accessibility

What holds today:

- **`index.html` is `lang="he"`** and deliberately has **no root `dir="rtl"`** — the stylesheet declares `direction: rtl`
  per block, and the flex rows that don't (`.page9-zone`, `.page9-tray-row`) would reverse
  their inline order under a root RTL. Setting it is the right end state but needs an
  eyeball pass over @fold12–@fold16 first; the reason is commented at the `<html>` tag.
- **One `<h1>` per document: the visible hero title** (`h1.page0-title`, @fold1). Every
  other visible heading is an `<h2>` in a scrolling title card; @fold16's «נתונים ושיטת
  עבודה» is a `<p class="page12-body-heading" role="heading" aria-level="3">` (a real `<h3>`
  would pick up UA/heading styles and lose `.page12-body p`'s). `.page0-title` sets font,
  line-height and margin itself, so the tag carries no style. No hidden `.a11y-only` `<h1>`.
- **Landmarks:** `<main class="text-col">` (the story) and `<nav class="lang-wrap">` (the
  language switch). No skip link — only the switch and the corner logo precede `<main>`.
- **Focus rings:** every control that zeroes its outline (`all: unset`, `outline: none`)
  keeps one on `:focus-visible` only (`outline: 2px solid var(--ink)`, `currentColor` where
  the control sits on a dark ground — the ⓘ on an extreme pill, the dev fold picker), so a
  mouse or a tap never draws a ring.
- **Hidden means hidden.** `#fold6NoteLayer` is exposed (the note text + its three links)
  but `inert` whenever the note is off screen (`fold6NoteLayerSyncInert`, js/groups.js — a
  MutationObserver on the note's and the layer's inline `opacity`/`hidden`, since two files
  write them), and a note link with no character typed yet is `tabindex=-1`. Its card and
  rule are `aria-hidden`. `.p7-scope-btn[hidden]` is `display: none` (its own
  `display: flex` used to beat the UA rule). The dashed card frame SVG
  (`.text-card-frame-dash`, js/core.js) is `aria-hidden` + `focusable="false"`.
- **Landmarks (axe `region`), all without moving a pixel:** `.graphic-col` gets
  `role="region"` + `aria-labelledby="canvas"` (`p7KeyInit`); `.seventh-eye` is wrapped at
  init in a `display: contents` `<aside>` named by its own label (js/nav.js); the pill
  descriptions `#p9PillDesc*`, the `p9Announce` live region and `#p7KeyHint` are appended to
  `<main>`; `.p7-hint-band` (the touch-gesture line) is `aria-hidden`.
- **`.a11y-only`** (`style.css`, next to the `*` reset) is the off-screen utility: a clipped
  1px box, **not** `display: none`/`visibility: hidden`, which would drop the element from
  the accessibility tree too.
- **`<canvas id="canvas">` carries `role="img"` + an `aria-label`**, and its text
  alternative is `#canvasA11ySummary` — an `.a11y-only` `<section>` right after it, filled by
  `p7BuildDataSummary(data)` at the end of `initPage7` (`page7.js`). The scrolling `<h2>`
  cards are already real DOM, so the argument of the piece is readable for free; the summary
  supplies only what the canvas draws — the camp/group roster (read off
  `FOLD4_COALITION_ROWS`/`FOLD4_CHANGE_ROWS`, so it can't disagree with the legend), the
  per-group and per-category counts, the total, the date range, and the nine axis events
  (`P7_AXIS_EVENTS_ALL`: date, label, description — all nine, though the phone draws six).
  While the timeline is live the canvas is keyboard-operable instead (see
  [Timeline](Timeline.md) → Keyboard access). **Every figure is derived
  from the loaded `events.json`, never hardcoded** — the xlsx is rebuilt on each server start,
  so a hand-written number would go stale silently.
- **Text contrast clears AA 4.5:1.** The two greys closest to the line carry their ratio in a
  comment at the declaration: the ACLED note title `#767676` and its chevron `#7a7a7a`.
  Tooltip fills go through `tooltipFill()` — see [Timeline](Timeline.md).

- **Accepted exception — the group palette is kept as designed.** Against `--bg` two group
  colours sit under the 3:1 non-text line (WCAG 1.4.11): תנועות התנחלות `#F9B624` 1.75:1 and
  גורמים ערבים ישראלים `#31CE1C` 2.06:1 (the other four pass, `#6B89FF` at 3.09). This is a
  deliberate decision (2026-10-06): the palette stays, no outlines. The non-colour path to a
  group is the legend filter (keyboard-operable on both breakpoints), plus the legend labels.
  If it is ever revisited, the nearest 3:1 shades at the same hue are `#C38805` and `#28A817`.

- **Accepted exception — no reflow fix for 601–959px desktop windows** (a laptop zoomed to
  150–200%; WCAG 1.4.10). There, @fold12's pills overflow the window and the @fold16 credits
  card is clipped. Judged an edge case (2026-10-06) and left as is.

- **@fold12 is keyboard-operable.** Pills are focusable `role="button"` toggles; Enter/Space
  routes through the same `commitDrop`/`commitDropState` the pointer paths use, with an
  `aria-live` announcer and a `:focus-visible` ring — see
  [Drag-and-Drop](Drag-and-Drop.md#keyboard-path). This is also what makes @fold13–@fold16
  reachable at all without a pointer, since `p13GateLocked()` (`js/fold11.js`) gates
  scrolling on a pill being classified.

## Per-frame cost — the layout-read rule

Anything called from a draw loop, a scroll handler or `updateGroups` runs tens of thousands
of times a second. Two classes of call are forbidden there, both because they force the
browser to flush style/layout:

- **`window.innerWidth` / `window.innerHeight`.** `isMobile()` and `viewportH()` (js/core.js)
  are **cached**, refreshed on `resize`/`orientationchange` by a listener registered in
  `js/core.js`. It runs before every resize handler registered from `core.js` onward, but
  **after** the ones `page9.js` and `page12.js` register at load (those files load earlier),
  so a breakpoint-crossing resize hands `page9.js`'s `p9SyncSubtitle` the previous
  `isMobile()` value. A mobile URL-bar collapse fires resize with the width unchanged, so
  `isMobile()` correctly holds. Never go back to reading `innerWidth` live: on a throttled
  phone it is the single largest entry in the scroll profile.
  **One named exception:** `p7ZoomOutH()` (page7.js) reads `window.innerHeight` live on
  mobile — iOS updates it as the bottom bar collapses but its `resize` can land after the
  last scroll frame, so a cached height would leave the zoomed-out axis a bar short. It is a
  few reads per frame, never per dot, and only while @fold8's zoom-out is engaged.
- **Linear scans and DOM measurement** — `GROUPS.find()` per dot, `getTotalLength()` per
  frame, `offsetWidth` per row. Memoise, or hoist out of the loop.

What keeps the early folds inside the frame budget on a phone: cached `isMobile()` and
`viewportH()`; a cache on `p7EventForActorOccurrence` (otherwise a linear scan over the
events per call); breakpoint reads hoisted out of
`p7DrawSideSquares`/`p7OrchestrateRows`/`p7DrawTimelineSquares`; a per-row memo for the row
cursor with one frame-wide timestamp; opaque squares batched into one `Path2D` per colour;
memoised `fitDashArray()`.

The pinned timeline (@fold8) is the heaviest fold, and its cost is dominated by **browser
rasterisation of the full-screen canvas**, not by JS: 12,283 squares on a phone-sized
backing store (1179×2556 on a 3× phone). Further gains there need a rendering change, not
another micro-optimisation. See [Timeline](Timeline.md) for the draw-loop specifics.
