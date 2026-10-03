#!/usr/bin/env python3
# Both Sides project — step 05: crowd size for every event, read out of the text.
# Reuses the Batch pipeline from 02 (import by file name) and only changes the
# prompt, the schema, which rows are sent, and what `download` writes back.
#
#   python3 05_extract_crowd.py submit events.xlsx
#   python3 05_extract_crowd.py status | retry_failed | download
#
# Rows sent (crowd blank, not hidden, actor not "not relevant"): Fortress rows,
# split halves and manual rows (never sized before), and ACLED rows whose text
# carries a size cue — the pre-2026-10-02 crowd run saw every ACLED row, so a
# blank ACLED row with no cue is a decided unknown and gets "no report" on
# download without a call. The post-ACLED tail is included.
# download writes `crowd` in the sheet's own vocabulary ("about 2,000", "dozens",
# "tens of thousands", "2") or the explicit "no report", so server.py's
# parse_crowd() reads it unchanged, plus `crowd_reason`. Hand-set crowds
# (any non-blank cell) are never touched.

import importlib.util, os, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("step02", HERE / "02_classify_event_type_no_intimidation.py")
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)

m.STATE_FILE = "crowd_state.json"
m.BATCH_DIR = "crowd_batches"
m.REASONING_EFFORT = "low"

m.INSTRUCTIONS = r"""
You read one political-event record and report HOW MANY PEOPLE TOOK PART ON THE MAIN
ACTOR'S SIDE. Nothing else.

You receive the MAIN ACTOR (the group whose action the record is about) and the EVENT
DESCRIPTION, in English or in Hebrew.

WHAT COUNTS
Only the participants on the MAIN ACTOR's side: the protesters, marchers, settlers,
attackers, activists who did the thing. If the record names them in numbers or in a size
word, report that.

WHAT NEVER COUNTS
- Police, soldiers, Border Police, security forces, guards.
- Counter-protesters, bystanders, drivers, residents who were attacked, victims, the
  injured, the arrested, the dead.
- Objects and other quantities: graves, cars, trees, sheep, houses, tents, kilometres,
  road numbers, days of war, number of hostages, ages, dates, money.
- Figures for a DIFFERENT event mentioned as context ("a week after 100,000 marched...",
  "the weekly rally, which usually draws thousands"). Only this event's own crowd.
- A reporter's or organiser's claim about a different place or the whole country when
  the record is about one location — unless that total is the only figure given for
  this event.

HOW TO WRITE IT — use the sheet's own vocabulary, exactly these forms:
- A figure: "about 2,000", "at least 1,000", "over 500", "about 40" — keep the record's
  own qualifier (about / around / some / an estimated → "about"; at least / more than /
  over → "at least"). Thousands separated with a comma. A bare figure with no qualifier
  ("200 settlers") → "about 200".
- A size word: "tens", "dozens", "hundreds", "thousands", "tens of thousands",
  "hundreds of thousands". A range in words → "dozens to hundreds",
  "hundreds to thousands".
- A small exact count of named individuals: "2" (two settlers), "3", "1" (a single
  assailant, a lone driver, one activist).
- Hebrew size words map the same way: עשרות → dozens, מאות → hundreds, אלפים →
  thousands, רבבות / עשרות אלפים → tens of thousands, כמה / מספר (without a number)
  → no report, קבוצה → no report.
- NOTHING in the text about the size of the main actor's group ("protesters",
  "settlers", "a group", "some activists", "demonstrators blocked the road", "residents
  marched") → write exactly "no report".

When the record gives two figures for the same crowd (police estimate vs organisers),
take the organisers' / larger one. When it gives one figure for the whole crowd and a
smaller one for a subset ("thousands marched; dozens blocked the road") and the record
is about the whole event, report the whole crowd's figure. If the record is clearly ONLY
about the subset action (it opens with "Following the main demonstration, dozens blocked..."),
report the subset's figure.

Do not guess from the kind of event. A pogrom, a raid or a march with no stated size is
"no report". Do not round a size word up or down into a number.

`reason`: one short sentence quoting the words the figure came from, or "no size given".
"""

m.SCHEMA = {
    "type": "object",
    "properties": {
        "crowd_text": {"type": "string"},
        "reason": {"type": "string"},
    },
    "required": ["crowd_text", "reason"],
    "additionalProperties": False,
}

_orig_request_body = m.request_body
def request_body(user_text):
    b = _orig_request_body(user_text)
    b["text"]["format"]["name"] = "crowd_result"
    b["max_output_tokens"] = 400
    return b
m.request_body = request_body


import re
CUE = re.compile(r"\b(dozens|hundreds|thousands|tens of thousands|a dozen|(about|around|some|over|at least|nearly|more than|an estimated|estimated) [\d,]+|\d[\d,]* (people|protesters|demonstrators|activists|settlers|residents|israelis|marchers|participants|men|women|youths|families|students|reservists|teenagers|rioters|worshippers|attackers|masked|armed)|\b(two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|fifty) (settlers|activists|protesters|men|israelis|masked|armed|youths|people))\b", re.I)

def build_jobs(ws):
    headers = [c.value for c in ws[1]]
    col = lambda *names, req=False: m.find_col(headers, list(names), required=req)
    c_id, c_actor = col("row_id"), col("main_actor", req=True)
    c_desc, c_he, c_crowd, c_hid = col("Description", req=True), col("description_he_medium"), col("crowd"), col("hidden")
    c_ds, c_split, c_orig = col("data_source"), col("split_from"), col("description_original")
    jobs = []
    for r in range(2, ws.max_row + 1):
        g = lambda c: m.norm(ws.cell(r, c).value) if c else ""
        actor = g(c_actor)
        if not actor or actor == "not relevant" or g(c_hid): continue
        if g(c_crowd): continue                       # already has a figure (or "no report")
        desc = g(c_desc) or g(c_he)                  # Fortress rows: Hebrew only
        if not desc: continue
        seen_before = g(c_ds) == "acled" and not g(c_split) and not g(c_orig)
        if seen_before and not CUE.search(desc): continue     # decided unknown by the earlier run
        jobs.append({
            "custom_id": g(c_id) or f"excel-row-{r}", "excel_row": r, "row_id": g(c_id),
            "user_text": f"MAIN ACTOR:\n{actor}\n\nEVENT DESCRIPTION:\n{desc}",
        })
    return jobs
m.build_jobs = build_jobs

ALLOWED_WORDS = {"tens", "dozens", "hundreds", "thousands", "tens of thousands", "hundreds of thousands",
                 "dozens to hundreds", "hundreds to thousands", "no report"}
import re
FIG = re.compile(r"^(about|at least|over) \d{1,3}(,\d{3})*( to \d{1,3}(,\d{3})*)?$|^\d{1,3}(,\d{3})*$")

def clean(t):
    t = m.norm(t).lower().replace("crowd size=", "").strip().rstrip(".")
    t = re.sub(r"\b(around|some|approximately|roughly|an estimated|estimated)\b", "about", t)
    t = re.sub(r"\b(more than)\b", "at least", t)
    t = re.sub(r"\s+", " ", t)
    t = re.sub(r"(\d)\s*[-–]\s*(\d)", r"\1 to \2", t)          # "150-200" -> "150 to 200"
    if t in ALLOWED_WORDS or FIG.match(t): return t
    return None                                       # off-vocabulary → leave blank, listed in the log

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
        c_crowd, c_reason = m.find_or_add_col(ws, "crowd"), m.find_or_add_col(ws, "crowd_reason")
        written = noreport = odd = 0; oddities = []
        for cid, job in state["jobs"].items():
            res = results.get(cid)
            if not res: continue
            r = job["excel_row"]
            if m.norm(ws.cell(r, c_crowd).value): continue     # filled by hand since submit — keep it
            t = clean(res["crowd_text"])
            if t is None:
                odd += 1; oddities.append((job["row_id"], res["crowd_text"]))
                ws.cell(r, c_reason, m.xl_safe("off-vocabulary, check by hand: " + str(res["crowd_text"]))); continue
            ws.cell(r, c_crowd, t); ws.cell(r, c_reason, m.xl_safe(res.get("reason")))
            written += 1; noreport += (t == "no report")
        # Every live row still blank was a decided unknown (see header): say so explicitly.
        headers = [x.value for x in ws[1]]
        c_actor, c_hid = m.find_col(headers, ["main_actor"], required=True), m.find_col(headers, ["hidden"])
        filled = 0
        for r in range(2, ws.max_row + 1):
            a = m.norm(ws.cell(r, c_actor).value)
            if not a or a == "not relevant" or (c_hid and m.norm(ws.cell(r, c_hid).value)): continue
            if not m.norm(ws.cell(r, c_crowd).value) and not m.norm(ws.cell(r, c_reason).value):
                ws.cell(r, c_crowd, "no report"); ws.cell(r, c_reason, "no size given (earlier crowd run)"); filled += 1
        print(f"Blank live rows marked 'no report' by rule: {filled:,}")
        out = source.parent / (source.stem + " - crowd" + source.suffix); wb.save(out)
    finally:
        wb.close()
    print(f"\nFinished. Written: {written:,} (of which 'no report': {noreport:,}). Off-vocabulary, left blank: {odd}")
    for row_id, t in oddities[:40]: print(f"  {row_id}: {t!r}")
    print(f"Errors: {len(errors):,}\nOutput:\n{out}")
m.command_download = command_download

if __name__ == "__main__":
    m.main()
