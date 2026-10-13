#!/usr/bin/env python3
"""Audit: is every shipped event's type justified by an act of the MAIN ACTOR?

  python3 audit_event_types.py              # all shipped events → _acled-filter/type-audit-<date>.csv
  python3 audit_event_types.py --limit 200  # a sample

One cheap call per event (gpt-5.6-luna, synchronous, THREADS at a time): the model gets the
source text, the main actor and the current type, and must QUOTE the main actor's own act
that justifies the type — or say there is none and name the type the main actor's own acts
support. Rows where the type rests on someone else's act (a driver, police, soldiers,
Palestinians, a counter-protester, a single participant) come out flagged.
Writes nothing to the sheet. Read-only on events.xlsx + events.json.
"""
import csv
import datetime as dt
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import openpyxl
from openai import OpenAI

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "_acled-filter" / f"type-audit-{dt.date.today()}.csv"
MODEL = "gpt-5.6-luna"
THREADS = 12

TYPES = """הפגנה לא אלימה — a demonstration, rally, march or vigil in which the main actor does nothing more severe.
חסימת כביש — the main actor blocks a road, junction, entrance or access route.
הפרות סדר — riot / disorder by the main actor: breaking through barriers, burning tyres or bins, fireworks with no stated human target, scuffles, refusing to disperse — without a described attack on a person or property damage.
פגיעה ברכוש — the main actor deliberately damages, destroys, steals or loots property.
ניכוס שטח — the main actor takes or fences land, sets up an outpost/tent/caravan, takes over a house.
תקיפה פיזית — the main actor assaults a person with hands, feet or body, no weapon.
החזקה בכפייה — the main actor detains, abducts or holds a person against their will.
תקיפה בנשק קר — the main actor throws stones/bottles/objects at people, houses or vehicles, uses sticks, knives, pepper spray or tear gas on people, or rams/attempts to ram with a vehicle.
תקיפה בנשק חם — the main actor shoots, uses explosives, Molotov cocktails, or launches fireworks/flares AT a stated person.
פוגרום — a crowd of dozens or more attacks a community with injuries/deaths, fire and property destruction."""

INSTRUCTIONS = f"""You audit event classifications. Each event has a MAIN ACTOR (the group the dataset
attributes the event to) and a CURRENT TYPE. The rule of the dataset: the type is decided ONLY
by what the MAIN ACTOR itself did. Acts by anyone else — police, soldiers, a passing driver,
Palestinians, counter-protesters, bystanders, a person the text calls "a demonstrator" who acts
AGAINST the main actor's crowd — never count. A single participant's act inside a mass
demonstration ("one protester spat on an MK") does not make the crowd's event an assault
(הפרות סדר at most). "Clashed with police" with no act of the main actor described counts
only as a clash (הפרות סדר), never as an attack. Severity is ranked top to bottom in the list
below; the type is the most severe act the MAIN ACTOR itself performed.

TYPES:
{TYPES}

Answer:
- justified: true if the CURRENT TYPE is supported by an act of the MAIN ACTOR in the text.
- main_actor_act: the shortest quote from the text of the main actor's act that supports the
  CURRENT TYPE ("" if none).
- supported_type: the type the main actor's OWN acts support (equal to CURRENT TYPE when justified).
- set_by: who performed the act that the CURRENT TYPE seems to rest on, when not justified
  ("driver", "police", "soldiers", "palestinians", "counter-protester", "single participant",
  "nobody — no such act in the text", …); "" when justified.
- note: one short sentence."""

SCHEMA = {
    "type": "object", "additionalProperties": False,
    "properties": {
        "justified": {"type": "boolean"},
        "main_actor_act": {"type": "string"},
        "supported_type": {"type": "string"},
        "set_by": {"type": "string"},
        "note": {"type": "string"},
    },
    "required": ["justified", "main_actor_act", "supported_type", "set_by", "note"],
}


def main():
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None
    shipped = {e["rowId"]: e for e in json.loads((ROOT / "events.json").read_text())}
    ws = openpyxl.load_workbook(ROOT / "events.xlsx", read_only=True).active
    rows = list(ws.iter_rows(values_only=True))
    h = rows[0]; c = {k: i for i, k in enumerate(h)}
    items = []
    for r in rows[1:]:
        rid = r[c["row_id"]]
        if rid not in shipped:
            continue
        text = r[c["Description"]] or r[c["description_he_original"]] or r[c["description_he_medium"]] or ""
        items.append({"row_id": rid, "date": str(r[c["date"]])[:10], "actor": r[c["main_actor"]],
                      "type": r[c["event_type"]], "hand": r[c["event_type_hand"]] or "",
                      "text": text, "he": r[c["description_he_medium"]] or ""})
    if limit:
        items = items[:limit]
    print(f"auditing {len(items)} shipped events with {MODEL}")
    client = OpenAI()

    def ask(it):
        try:
            r = client.responses.create(
                model=MODEL, instructions=INSTRUCTIONS,
                input=f"MAIN ACTOR: {it['actor']}\nCURRENT TYPE: {it['type']}\nDATE: {it['date']}\n\nTEXT:\n{it['text']}",
                reasoning={"effort": "low"},
                text={"format": {"type": "json_schema", "name": "type_audit", "strict": True, "schema": SCHEMA}},
                max_output_tokens=1200)
            return it, json.loads(r.output_text)
        except Exception as e:
            return it, {"justified": None, "main_actor_act": "", "supported_type": "", "set_by": "", "note": f"ERROR {str(e)[:120]}"}

    OUT.parent.mkdir(exist_ok=True)
    n_flag = n_err = 0
    with OUT.open("w", newline="", encoding="utf-8") as f, ThreadPoolExecutor(THREADS) as ex:
        w = csv.writer(f)
        w.writerow(["row_id", "date", "actor", "current_type", "hand", "justified", "supported_type", "set_by", "main_actor_act", "note", "hebrew"])
        for i, (it, res) in enumerate(ex.map(ask, items), 1):
            if res["justified"] is None: n_err += 1
            elif not res["justified"]: n_flag += 1
            w.writerow([it["row_id"], it["date"], it["actor"], it["type"], it["hand"], res["justified"],
                        res["supported_type"], res["set_by"], res["main_actor_act"], res["note"], it["he"]])
            if i % 500 == 0:
                f.flush(); print(f"  {i}/{len(items)}  flagged {n_flag}  errors {n_err}", flush=True)
    print(f"done: {len(items)} audited, {n_flag} flagged, {n_err} errors → {OUT}")


if __name__ == "__main__":
    main()
