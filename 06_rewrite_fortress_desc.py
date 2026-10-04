#!/usr/bin/env python3
# Both Sides project — step 06: Fortress descriptions in ACLED's register, Hebrew + English.
# Reuses the Batch pipeline from 02 (import by file name).
#
#   python3 06_rewrite_fortress_desc.py submit events.xlsx
#   python3 06_rewrite_fortress_desc.py status | retry_failed | download
#
# Rows sent: live `the fortress` rows (not hidden, actor not "not relevant") whose
# `description_he_original` is still blank — i.e. not rewritten yet. download keeps
# the log's own line in `description_he_original`, writes the rewritten Hebrew to
# `description_he_medium` and the short English to `Description` (Fortress rows had
# none). Rows with a date in `description_hand` are skipped.

import importlib.util, os
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("step02", HERE / "02_classify_event_type_no_intimidation.py")
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)

m.STATE_FILE = "fortress_desc_state.json"
m.BATCH_DIR = "fortress_desc_batches"
m.REASONING_EFFORT = "low"

m.INSTRUCTIONS = r"""
You rewrite one line from a Hebrew settler-violence log so it reads like the other events
in a dataset whose Hebrew descriptions were derived from ACLED. You write the Hebrew line
and a short English line with the same facts.

You receive: MAIN ACTOR, DATE, PLACE (the log's location cell — a Palestinian village,
town, area or a settlement/outpost), SOURCE TAGS (the log's own labels), EVENT TYPE
(already decided — do not contradict it), and the ORIGINAL LINE.

TARGET REGISTER (examples of the dataset's Hebrew):
- מתנחלים ישראלים תקפו רועה צאן פלסטיני בוואדי קלט בעת שרעה את צאנו, וגנבו ממנו 250 כבשים.
- מתנחלים ישראלים הציבו קרוואן על אדמה בבעלות פלסטינית בכפר קוסרא.
- חמישה מתנחלים מיצהר הציתו וכרתו כ־80 עצי זית באדמות פלסטיניות באזור אל־מיאדין בבורין.
- מתנחלים ישראלים תקפו בגז פלפל שני פלסטינים באזור שיב אל־ביר בבית פוריכ, וגרמו להם לכוויות.

RULES FOR THE HEBREW (`description_he`)
1. One or two sentences, past tense, 70–110 characters. Never shorter than the original.
2. The ACTOR is the grammatical subject and is named explicitly, at the start: "מתנחלים
   ישראלים", "מתנחלים חמושים", "מתנחל", "פעילי ימין" (MAIN ACTOR = right wing protesters),
   "מתנחלים מהמאחז הסמוך" if the original says so. Turn passive originals ("בית נפרץ ורכוש
   נגנב", "בתים הותקפו") into active: "מתנחלים ישראלים פרצו לבית בכפר … וגנבו רכוש".
   If the original names a different perpetrator (soldiers, security coordinator), keep it.
3. Name the PLACE in the sentence, with the right preposition: "בכפר X", "ליד X", "באדמות X",
   "בח'רבת X", "במאחז X". Keep the log's Arabic transliteration exactly as given. If the
   PLACE is a settlement/outpost, say the settlers came from it or acted near it.
4. Keep EVERY fact of the original: numbers (vehicles, sheep, trees, injured), weapons,
   masks, night-time, outcome (injuries, displacement, theft). Add NOTHING the original and
   the tags do not say — no motive, no "according to reports", no colour.
5. Palestinian victims are "פלסטינים" / "תושבים פלסטיניים" / "רועה צאן פלסטיני". Add the
   word פלסטיני where the original says "תושבים" and the place is a Palestinian village.
6. Numbers as digits with the Hebrew prefix glued ("כ־80", "ארבעה כלי רכב" may stay as a
   word). Use ־ (maqaf) and ״ as the dataset does.
7. TERMINOLOGY (user's choices, 2026-10-03): Arab citizens of Israel = ערבים ישראלים (two words,
   no maqaf); Haredi draft refusers = עריקים / עריקות (never משתמטים); the judicial overhaul =
   הרפורמה המשפטית; quotations inside Hebrew use ״, never the ASCII " character.
8. Settlement re-establishment / outpost rows ("ההתנחלות גנים … הוקמה מחדש"): subject is
   "מתנחלים ישראלים הקימו מחדש את …".

ABDUCTION / DETENTION WORDING (user rule, 2026-10-04) — applies to events whose type is החזקה בכפייה:
1. "detained" / "held" / "seized and held" -> החזיקו בכפייה (NEVER עיכבו). Match grammar:
   "detained him" -> החזיקו אותו בכפייה; "detained a shepherd" -> החזיקו בכפייה רועה; a single
   settler -> החזיק בכפייה.
2. "abducted" / "kidnapped" -> חטפו ONLY when the text says WHERE they were taken (to an outpost,
   to a settlement, into a vehicle, to the hills) or HOW (forced into a car, tied up and dragged
   away). Otherwise -> לקחו בכפייה ("abducted two Palestinians from Jit" -> לקחו בכפייה שני
   פלסטינים מג'ית). Match number and gender (לקח / לקחו, חטף / חטפו).
Arabic follows the Hebrew: החזיקו בכפייה = احتجزوا بالقوة; חטפו = اختطفوا; לקחו בכפייה = اقتادوا بالقوة.


RULES FOR THE ENGLISH (`description_en`)
- One or two sentences, the same facts as the Hebrew, 80–140 characters. Do NOT start with
  the date. ACLED's vocabulary: "Israeli settlers", "Palestinian residents", "Palestinian-
  owned", "outpost", "Khirbet …", "al-…". Transliterate the place conventionally.
- No hedging, no additions.

`note`: "" normally; a short English remark only if the original is unclear or contradicts
its tags.
"""

m.SCHEMA = {
    "type": "object",
    "properties": {
        "description_he": {"type": "string"},
        "description_en": {"type": "string"},
        "note": {"type": "string"},
    },
    "required": ["description_he", "description_en", "note"],
    "additionalProperties": False,
}

_orig_request_body = m.request_body
def request_body(user_text):
    b = _orig_request_body(user_text)
    b["text"]["format"]["name"] = "fortress_desc"
    b["max_output_tokens"] = 2500
    return b
m.request_body = request_body


SOLE_SOURCE_EXCLUDE = {"plo negotiations affairs department"}   # same set as server.py: never shipped

def build_jobs(ws):
    headers = [c.value for c in ws[1]]
    col = lambda *names, req=False: m.find_col(headers, list(names), required=req)
    c_id, c_actor, c_he = col("row_id"), col("main_actor", req=True), col("description_he_medium", req=True)
    c_date, c_loc, c_tags, c_type = col("date"), col("location"), col("fortress_categories"), col("event_type")
    c_ds, c_hid, c_orig, c_hand = col("data_source"), col("hidden"), col("description_he_original"), col("description_hand")
    c_src = m.find_col(headers, ["source"], required=False)
    jobs = []
    for r in range(2, ws.max_row + 1):
        g = lambda c: m.norm(ws.cell(r, c).value) if c else ""
        srcs = {x.strip().lower() for x in g(c_src).split(";") if x.strip()}
        if srcs and srcs <= SOLE_SOURCE_EXCLUDE: continue
        actor = g(c_actor)
        if g(c_ds) != "the fortress" or not actor or actor == "not relevant" or g(c_hid): continue
        if g(c_orig) or g(c_hand) or not g(c_he): continue
        d = ws.cell(r, c_date).value if c_date else None
        date = d.strftime("%Y-%m-%d") if hasattr(d, "strftime") else str(d or "")[:10]
        jobs.append({
            "custom_id": g(c_id) or f"excel-row-{r}", "excel_row": r, "row_id": g(c_id),
            "user_text": (f"MAIN ACTOR:\n{actor}\n\nDATE:\n{date}\n\nPLACE:\n{g(c_loc) or '(blank)'}\n\n"
                          f"SOURCE TAGS:\n{g(c_tags) or '(none)'}\n\nEVENT TYPE:\n{g(c_type) or '(blank)'}\n\n"
                          f"ORIGINAL LINE:\n{g(c_he)}"),
        })
    return jobs
m.build_jobs = build_jobs


def command_download():
    from openai import OpenAI
    from openpyxl import load_workbook
    if not os.getenv("OPENAI_API_KEY"): raise EnvironmentError("OPENAI_API_KEY is not set.")
    base = Path.cwd(); state = m.load_state(base); client = OpenAI()
    m.refresh(client, state); m.save_state(base, state)
    if any(c.get("status") != "completed" for c in state["chunks"]): raise RuntimeError("Not all chunks are completed.")
    results, errors = {}, {}
    for c in state["chunks"]:
        b = client.batches.retrieve(c["batch_id"])
        parsed, errs = m.parse_output(client.files.content(b.output_file_id).content)
        results.update(parsed); errors.update(errs)

    source = Path(state["source_workbook"]); wb = load_workbook(source); ws = wb.active
    try:
        H = lambda n: m.find_or_add_col(ws, n)
        c_he, c_en, c_orig, c_note = H("description_he_medium"), H("Description"), H("description_he_original"), H("description_note")
        written = short = 0
        for cid, job in state["jobs"].items():
            res = results.get(cid)
            if not res: continue
            r = job["excel_row"]
            he, en = m.norm(res["description_he"]), m.norm(res["description_en"])
            if not he or not en: continue
            if not m.norm(ws.cell(r, c_orig).value):
                ws.cell(r, c_orig, ws.cell(r, c_he).value)
            ws.cell(r, c_he, m.xl_safe(he)); ws.cell(r, c_en, m.xl_safe(en))
            if res.get("note"): ws.cell(r, c_note, m.xl_safe(res["note"]))
            written += 1; short += len(he) < 50
        out = source.parent / (source.stem + " - fortress desc" + source.suffix); wb.save(out)
    finally:
        wb.close()
    print(f"\nFinished. Rewritten: {written:,} (Hebrew under 50 chars: {short}). Errors: {len(errors):,}\nOutput:\n{out}")
m.command_download = command_download

if __name__ == "__main__":
    m.main()
