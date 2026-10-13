#!/usr/bin/env python3
"""Second-opinion review of each pipeline step's OUTPUT by a stronger model (gpt-6-astra).

  python3 review_prompts.py <samples dir> [--max 24]

For every sample-<step>.json in the dir (drawn from the sheet), the reviewer gets the
step's own INSTRUCTIONS verbatim as the rubric, plus the input and the step's output, and
grades each row: ok / problem, what is wrong, and — when it reflects a gap in the rubric
rather than a one-off slip — the rule to add. Output: review-<step>.json next to the samples
and a summary on stdout. Spend is bounded by --max rows per step (default 24, ~150 calls).
Writes nothing to the sheet.
"""
import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from openai import OpenAI

ROOT = Path(__file__).resolve().parent
MODEL = "gpt-6-astra"
STEP_FILES = {
    "01-actor": "01_identify_main_actor.py",
    "03-hebrew": "03_translate_hebrew_and_date.py",
    "04-split": "04_split_subactions.py",
    "05-crowd": "05_extract_crowd.py",
    "06-rewrite": "06_rewrite_fortress_desc.py",
    "07-enar": "07_short_english_and_arabic.py",
}
# which fields are the INPUT the step saw, which are its OUTPUT
IO = {
    "01-actor": (["Description"], ["main_actor", "main_actor_reason"]),
    "03-hebrew": (["main_actor", "Description"], ["description_he_medium"]),
    "04-split": (["main_actor", "description_original", "crowd_total"], ["Description", "crowd", "split_from", "split_reason"]),
    "05-crowd": (["main_actor", "Description", "description_he_medium"], ["crowd", "crowd_reason"]),
    "06-rewrite": (["main_actor", "event_type", "location", "fortress_categories", "description_he_original"], ["description_he_medium", "Description"]),
    "07-enar": (["actor", "he", "source_en"], ["en", "ar"]),
}
SCHEMA = {
    "type": "object", "additionalProperties": False,
    "properties": {
        "verdict": {"type": "string", "enum": ["ok", "minor", "problem"]},
        "issue": {"type": "string"},
        "corrected_output": {"type": "string"},
        "rule_gap": {"type": "string"},
    },
    "required": ["verdict", "issue", "corrected_output", "rule_gap"],
}


def instructions_of(pyfile):
    s = (ROOT / pyfile).read_text()
    m = re.search(r'INSTRUCTIONS = r?"""(.*?)\n"""', s, re.S)
    return m.group(1)


def main():
    d = Path(sys.argv[1])
    mx = int(sys.argv[sys.argv.index("--max") + 1]) if "--max" in sys.argv else 24
    client = OpenAI()
    for step, pyfile in STEP_FILES.items():
        f = d / f"sample-{step}.json"
        if not f.exists():
            continue
        rows = json.loads(f.read_text())[:mx]
        rubric = instructions_of(pyfile)
        ins, outs = IO[step]
        system = ("You are reviewing the output of one step of a data pipeline against the step's own "
                  "instructions (the RUBRIC). You read Hebrew, English and Arabic natively. Judge ONLY "
                  "whether the OUTPUT follows the RUBRIC given the INPUT: facts kept, nothing invented, "
                  "the rubric's wording/terminology/length rules, correct Hebrew/Arabic grammar and register. "
                  "verdict: ok / minor (cosmetic) / problem (a fact wrong or missing, a rule broken, a wrong "
                  "decision). issue: what exactly, in English, with the offending words quoted. corrected_output: "
                  "what the output should have been (empty if ok). rule_gap: ONLY if the mistake comes from "
                  "something the RUBRIC does not say or says unclearly — the one sentence to add to it; "
                  "empty if the rubric is fine and the model just slipped.\n\nRUBRIC:\n" + rubric)

        def ask(r):
            inp = "\n".join(f"{k}: {r.get(k, '')}" for k in ins)
            out = "\n".join(f"{k}: {r.get(k, '')}" for k in outs)
            try:
                resp = client.responses.create(
                    model=MODEL, instructions=system,
                    input=f"ROW {r['row_id']} ({r.get('date', '')})\n\nINPUT:\n{inp}\n\nOUTPUT:\n{out}",
                    reasoning={"effort": "medium"},
                    text={"format": {"type": "json_schema", "name": "review", "strict": True, "schema": SCHEMA}},
                    max_output_tokens=2500)
                res = json.loads(resp.output_text)
            except Exception as e:
                res = {"verdict": "error", "issue": str(e)[:200], "corrected_output": "", "rule_gap": ""}
            return {"row_id": r["row_id"], **res}

        with ThreadPoolExecutor(6) as ex:
            results = list(ex.map(ask, rows))
        (d / f"review-{step}.json").write_text(json.dumps(results, ensure_ascii=False, indent=1))
        counts = {v: sum(1 for x in results if x["verdict"] == v) for v in ("ok", "minor", "problem", "error")}
        gaps = [x["rule_gap"] for x in results if x["rule_gap"]]
        print(f"\n== {step}: {counts}")
        for x in results:
            if x["verdict"] in ("problem", "minor"):
                print(f"  [{x['verdict']}] {x['row_id']}: {x['issue'][:220]}")
        for gap in gaps:
            print(f"  RULE GAP: {gap[:250]}")


if __name__ == "__main__":
    main()
