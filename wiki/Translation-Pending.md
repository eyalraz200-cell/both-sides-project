# Translation pending — Hebrew changed, English (and Arabic) not yet

> **Arabic** (`ar/index.html`, `I18N_AR`) is regenerated wholesale by `translate_ui_ar.py` —
> a pending row here means the Arabic is stale too, and clears for Arabic by re-running the script
> (see [Architecture](Architecture.md), «Arabic version»).
>
> **Hand-set Arabic words (2026-10-04) — a fresh API run would overwrite them; re-apply after one:**
> group גורמים ערבים ישראלים → «عناصر من مواطني إسرائيل العرب» (Arabic only; Hebrew unchanged); הפגנה לא אלימה → «مظاهرة سلمية»; פוגרום → «أعمال شغب» (label; «وأعمال الشغب» in the methodology list), and the הפרות סדר
> description uses «اضطرابات», not «أعمال شغب», so the two categories don't share a word.
> `--apply ar_translations.json` keeps them; they're already in that file.

The Hebrew page is where copy gets written first. This file is the **ledger of Hebrew
strings that have changed and whose English counterpart has not caught up yet**, so nothing
ships with a half-translated surface.

**The rule:** change Hebrew copy → add a row here in the same turn. Translate it → delete the
row. An empty table below means the two languages agree.

## Pending

| Changed | Where the Hebrew lives | What the English needs | Noted |
|---|---|---|---|
| The phone's title for the first axis event is now «הכרזת הרפורמה המשפטית» (desktop keeps «הכרזת הרפורמה») | `labelMobile` on the 2023-01-04 entry of `P7_AXIS_EVENTS_ALL`, `page7.js` | `I18N_EN` has the new key, but it still maps to the old English, "Judicial Overhaul". Decide whether the phone's English title should change to match. | 2026-09-29 |
| @fold13 closing line now ends «…להציב גבולות להקצנה - גם מהמחנה אותו הם מייצגים.» (was «גם במחנה שלהם») | second `.text-card-frame` title of `#page-14`, `index.html` | `en/index.html` still says "in their own camp" — reword to "including the camp they represent"; `ar/index.html` needs a `translate_ui_ar.py` re-run. | 2026-10-03 |
| New legend-note last line «לשיטת העבודה המלאה» (link to `methodology.html`) | `FOLD6_NOTE_MORE_TEXT`, `js/groups.js` | `I18N_EN` has "Full methodology"; `ar/` needs a `translate_ui_ar.py` re-run. | 2026-10-04 |
| @fold16 credits paragraph rewritten to seven lines (ליווי, הנחייה והכוונה / ייעוץ עיתונאי אורן פרסיקו / תודה לרקפת כנען / תודה לשנקר (link) / תודה לצוות המבצר (link) + names / «מסד נתונים: ACLED, המבצר») | `.page12-credits`, `index.html` | `en/index.html` updated by hand ("Fortress" for המבצר — confirm). `ar/index.html` needs a `translate_ui_ar.py` re-run. | 2026-10-04 |
| @fold16 credits: a closing paragraph linking «שיטת העבודה המלאה» | `#page-17 .page12-body`, `index.html` | `en/index.html` needs it; `ar/` re-run. | 2026-10-04 |
| New page `methodology.html` (Hebrew only) | repo root | An English page (`en/methodology.html`? or one bilingual page) is undecided; until then en/ and ar/ link to the Hebrew page. | 2026-10-04 |

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
