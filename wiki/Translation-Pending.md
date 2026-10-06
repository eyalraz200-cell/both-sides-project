# Translation pending — Hebrew changed, English (and Arabic) not yet

> **Arabic** (`ar/index.html`, `I18N_AR`) is regenerated wholesale by `translate_ui_ar.py` —
> a pending row here means the Arabic is stale too, and clears for Arabic by re-running the script
> (see [Architecture](Architecture.md), «Arabic version»).
>
> **Hand-set Arabic words (2026-10-04) — a fresh API run would overwrite them; re-apply after one:**
> group גורמים ערבים ישראלים → «عناصر من مواطني إسرائيل العرب» (Arabic only; Hebrew unchanged); הפגנה לא אלימה → «مظاهرة سلمية»; פוגרום → «أعمال شغب» (label; «وأعمال الشغب» in the methodology list), and the הפרות סדר
> description uses «اضطرابات», not «أعمال شغب», so the two categories don't share a word.
> `--apply ar_translations.json` keeps them; they're already in that file.
> **Also hand-written (2026-10-05):** «مفتاح الرموز» for «מקרא» everywhere (cards @fold7 / @fold10
> too, never «وسيلة الإيضاح»), and every `I18N_AR` value added since the last API run — the
> screen-reader strings, the loading text and the reworded action-type tooltips. All are in
> `ar_translations.json`.
> **Also user-supplied (2026-10-06):** the English and Arabic of @fold13's four closing cards
> (`html:fold13-1`…`-4` in `ar_translations.json`).

The Hebrew page is where copy gets written first. This file is the **ledger of Hebrew
strings that have changed and whose English counterpart has not caught up yet**, so nothing
ships with a half-translated surface.

**The rule:** change Hebrew copy → add a row here in the same turn. Translate it → delete the
row. An empty table below means the two languages agree.

**Methodology pages:** `methodology.html` has twins, `en/methodology.html` and
`ar/methodology.html`. A Hebrew edit to it must be mirrored by hand in both (only the prompt
appendix is shared, via `build_methodology.py`) — log it here like any other copy change.

## Pending

| Changed | Where the Hebrew lives | What the English needs | Noted |
|---|---|---|---|
| The phone's title for the first axis event is now «הכרזת הרפורמה המשפטית» (desktop keeps «הכרזת הרפורמה») | `labelMobile` on the 2023-01-04 entry of `P7_AXIS_EVENTS_ALL`, `page7.js` | `I18N_EN` has the new key, but it still maps to the old English, "Judicial Overhaul". Decide whether the phone's English title should change to match. | 2026-09-29 |
| The two hidden sections' copy (`#page-5` @hidden-acled, `#page-6` @hidden-hover) is still Hebrew on `en/index.html` and `ar/index.html` — the lines are identical in all three files, so `translate_ui_ar.py` never pairs them | `index.html` `#page-5` / `#page-6` | English and Arabic for both cards (incl. `#page-6`'s `.copy-desktop` / `.copy-mobile` pair) before either section is un-hidden. | 2026-10-05 |
| The Arabic share card is still the Hebrew one: `og:image` / `twitter:image` on `ar/index.html` point at `og-image-v4.png` | `ar/index.html` head (the og:image lines come through `translate_ui_ar.py` unchanged) | An Arabic card (`_og-card.html` with Arabic copy, like `og-image-en-v2.png` for English) and a `HEAD_PATCHES` entry pointing both tags at it. | 2026-10-05 |

## The three surfaces English copy lives in

A Hebrew edit lands in one of these, and which one decides what "translate it" means:

1. **Markup in `index.html`** — the title blocks, the hero, the share block. The English
   text is written out longhand in **`en/index.html`**, the same line of the same section.
   Nothing derives it; both files carry their own copy.
2. **A string a script renders** — camp headers, group labels, legend controls, category
   pills, the tray tooltips (`P9_CATEGORY_DESC`), the @fold12 subtitle. These go through
   `tr()` in **`js/i18n.js`**, whose table `I18N_EN` is keyed **by the Hebrew string
   itself**. So renaming a Hebrew string *silently breaks its translation*: the key stops
   matching, `tr()` falls through, and the English page shows Hebrew. **Rename the key in
   the same edit as the string.**
3. **An `isEnglish()` ternary** — where the two languages need genuinely different text
   rather than a lookup, e.g. `FOLD6_NOTE_TEXT` (the ACLED note — one paragraph in each
   language). Both arms sit at the same declaration, so edit the Hebrew arm and the English
   arm is right there beside it. A sentence with numbers or names in it goes through
   `trf("… {n} …", { n })` instead — the Hebrew-with-slots is the key, and each language
   places the slots itself.

Surfaces 2 and 3 fail **loudly in Hebrew** on an English page, which is the easy case to
spot. Surface 1 fails **silently**: `en/index.html` simply keeps the old sentence, and the
English page reads as though nothing changed. That is the one this ledger exists for.

See [Architecture](Architecture.md#english-version--enindexhtml) for everything else the
English build changes (layout mirroring, LTR, the left-hand legend furniture).
