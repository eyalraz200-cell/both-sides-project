# Translation pending — Hebrew changed, English (and Arabic) not yet

> **Arabic** (`ar/index.html`, `I18N_AR`) is regenerated wholesale by `translate_ui_ar.py` —
> a pending row here means the Arabic is stale too, and clears for Arabic by re-running the script
> (see [Architecture](Architecture.md), «Arabic version»).

The Hebrew page is where copy gets written first. This file is the **ledger of Hebrew
strings that have changed and whose English counterpart has not caught up yet**, so nothing
ships with a half-translated surface.

**The rule:** change Hebrew copy → add a row here in the same turn. Translate it → delete the
row. An empty table below means the two languages agree.

## Pending

| Changed | Where the Hebrew lives | What the English needs | Noted |
|---|---|---|---|
| The phone's title for the first axis event is now «הכרזת הרפורמה המשפטית» (desktop keeps «הכרזת הרפורמה») | `labelMobile` on the 2023-01-04 entry of `P7_AXIS_EVENTS_ALL`, `page7.js` | `I18N_EN` has the new key, but it still maps to the old English, "Judicial Overhaul". Decide whether the phone's English title should change to match. | 2026-09-29 |

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
   rather than a lookup, e.g. `FOLD6_NOTE_TEXT` (the ACLED note, whose English splits into
   three paragraphs where the Hebrew runs two). Both arms sit at the same declaration, so
   edit the Hebrew arm and the English arm is right there beside it.

Surfaces 2 and 3 fail **loudly in Hebrew** on an English page, which is the easy case to
spot. Surface 1 fails **silently**: `en/index.html` simply keeps the old sentence, and the
English page reads as though nothing changed. That is the one this ledger exists for.

See [Architecture](Architecture.md#english-version--enindexhtml) for everything else the
English build changes (layout mirroring, LTR, the left-hand legend furniture).
