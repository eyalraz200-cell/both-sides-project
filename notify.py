#!/usr/bin/env python3
"""Open the review issue for a finished refresh run (the last step of run_pipeline.py).

  python3 notify.py            # open the issue, remember its number
  python3 notify.py --dry-run  # print the issue body only

The issue goes to the project's GitHub repo (label `refresh`), so GitHub e-mails the
user's notification address. `approve_check.py` polls it: a comment saying approve
publishes, a comment saying no closes it.

The repo is PUBLIC, so the body carries nothing ACLED-licensed: counts, row ids, our own
Hebrew lines (already public in events.json), actors and types — never ACLED's text.
"""
import datetime as dt
import json
import subprocess
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent
XLSX = ROOT / "events.xlsx"
FILTER_DIR = ROOT / "_acled-filter"
PENDING = FILTER_DIR / "pending-issue.json"
LABEL = "refresh"


def sh(*cmd):
    return subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True).stdout.strip()


def build_body():
    today = dt.date.today()
    ws = openpyxl.load_workbook(XLSX, read_only=True).active
    rows = list(ws.iter_rows(values_only=True))
    h = rows[0]
    c = {k: i for i, k in enumerate(h)}
    last = FILTER_DIR / "last-fetch.json"
    since = json.loads(last.read_text()).get("run") if last.exists() else None

    def live(r):
        return not r[c["hidden"]] and r[c["main_actor"]] not in (None, "not relevant")

    today_s = str(today)
    # the row ranges the latest ACLED fetch and the latest Tiud export appended (today's runs only)
    ranges = []
    for f in (last, FILTER_DIR / "last-tiud.json"):
        if f.exists():
            d = json.loads(f.read_text())
            if d.get("run") == today_s and d.get("new_rows"):
                ranges.append((d["new_rows"]["from"], d["new_rows"]["to"]))
    def rid(r):
        v = str(r[c["row_id"]] or "")
        return int(v.split("-")[1]) if v.startswith("row-") else -1
    def in_run(n):
        return any(lo <= n <= hi for lo, hi in ranges)
    new = [r for r in rows[1:] if in_run(rid(r)) or (r[c["split_from"]] and in_run(int(str(r[c["split_from"]]).split("-")[1])))]
    new_live = [r for r in new if live(r)]
    flagged = [r for r in new_live if r[c["event_type_needs_review"]] == "yes" or r[c["main_actor_needs_review"]] == "yes"]
    unsure = [r for r in rows[1:] if r[c["acled_match"]] == "unsure" and today_s in str(r[c["dedupe_note"]] or "")]
    missing = [r for r in new_live if not r[c["description_en_short"]] or not r[c["description_ar"]]]
    changes = sorted(FILTER_DIR.glob(f"changes-{today}.csv"))
    n_changes = sum(1 for _ in open(changes[-1], encoding="utf-8")) - 1 if changes else 0
    diff = sh("git", "diff", "--shortstat", "--", "events.json", "events-en.json", "events-ar.json")
    try:
        total = len(json.loads((ROOT / "events.json").read_text()))
    except Exception:
        total = "?"

    def line(r):
        return (f"- `{r[c['row_id']]}` {str(r[c['date']])[:10]} · {r[c['main_actor']]} · "
                f"{r[c['event_type']] or '—'} — {r[c['description_he_medium']] or '(no Hebrew yet)'}")

    body = [f"## Refresh {today}",
            f"- **{len(new_live)} new events** on the site (of {len(new)} rows fetched since {since or '—'})",
            f"- site total now **{total}** events",
            f"- {len(flagged)} flagged for review · {len(unsure)} unsure Fortress twins · "
            f"{len(missing)} without short EN/AR · {n_changes} ACLED edits to old rows (in `_acled-filter/`)",
            f"- json diff: {diff or 'unchanged'}", ""]
    if flagged:
        body += ["### Flagged for review"] + [line(r) for r in flagged[:40]] + [""]
    if unsure:
        body += ["### Unsure Fortress twins (left live)"] + [
            f"- `{r[c['row_id']]}` ~ `{r[c['acled_duplicate_of']]}` — {r[c['description_he_medium']] or ''}" for r in unsure[:40]] + [""]
    body += ["---", "Comment **approve** to publish (commit + push the json), or **no** to hold. "
             "Checked hourly by `approve_check.py`."]
    return f"Data refresh {today}: {len(new_live)} new events", "\n".join(body)


def main():
    title, body = build_body()
    if "--dry-run" in sys.argv:
        print(title); print(body); return
    if PENDING.exists():
        old = json.loads(PENDING.read_text())
        sh("gh", "issue", "close", str(old["number"]), "--comment", "Superseded by a newer refresh.")
    labels = sh("gh", "label", "list", "--json", "name", "-q", ".[].name").split()
    if LABEL not in labels:
        sh("gh", "label", "create", LABEL, "--color", "0E8A16", "--description", "weekly data refresh awaiting approval")
    url = sh("gh", "issue", "create", "--title", title, "--body", body, "--label", LABEL)
    number = int(url.rstrip("/").split("/")[-1])
    FILTER_DIR.mkdir(exist_ok=True)
    PENDING.write_text(json.dumps({"number": number, "url": url, "opened": str(dt.date.today())}) + "\n")
    print(f"Issue opened: {url}")


if __name__ == "__main__":
    main()
