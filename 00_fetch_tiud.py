#!/usr/bin/env python3
"""Export Tiud's new events into events.xlsx as Fortress rows (the monthly track's step 2).

  python3 00_fetch_tiud.py            # append new events, hide dropped ones; back up first
  python3 00_fetch_tiud.py --dry-run  # report only

Tiud (../Tiud, the Fortress gatherer we run here) keeps its events in a SQLite database;
its MAIN list (one Israeli source at least) is what ships. This script keys the sheet to
that database by Tiud's event `id`, kept in the sheet column `tiud_id` (added on first run;
the old rows are matched to Tiud once by date + the log's own line and get their id too —
`fortress_id` stays the legacy report-row number and is not used for new rows).

  main event with no sheet row   → appended as a fresh `row-N`: data_source = the fortress,
                                   date, location (Tiud's Hebrew place name), the FULL Hebrew
                                   account (`description_long`, else the short line) in
                                   `description_he_medium` — step 06 moves it to
                                   `description_he_original` and writes the house-style line —
                                   sources (`source`, ` · `-joined), links (`fortress_links`),
                                   fatalities (killed), Tiud categories if any. Every
                                   pipeline column blank, so 01→07 pick the row up.
  sheet row whose Tiud event left the main list (merged / dropped / demoted)
                                 → `hidden = tiud dropped <date>`
  sheet row whose Tiud text changed after we processed it
                                 → listed in _acled-filter/tiud-changes-<date>.csv, untouched
Records the appended row range in _acled-filter/last-tiud.json (notify.py reads it).
No model calls here. Next: 08_dedupe_fortress.py --direction fortress, then run_pipeline.py.
"""
import argparse
import csv
import datetime as dt
import json
import os
import shutil
import sqlite3
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent
XLSX = ROOT / "events.xlsx"
ARCHIVE = ROOT / "_xlsx-archive"
FILTER_DIR = ROOT / "_acled-filter"
LAST_FILE = FILTER_DIR / "last-tiud.json"
TIUD_DB = Path(os.environ.get("TIUD_DB_PATH") or
               os.path.expanduser("~/Library/Application Support/tiud/data/tiud.sqlite"))


def to_date(v):
    if isinstance(v, dt.datetime):
        return v.date()
    if isinstance(v, dt.date):
        return v
    return dt.date.fromisoformat(str(v)[:10])


def read_tiud():
    db = sqlite3.connect(TIUD_DB)
    ev = {}
    for row in db.execute("""
        SELECT e.id, e.occurred_on, e.list, e.description, e.description_long, e.killed,
               l.name_he
          FROM events e LEFT JOIN locations l ON l.id = e.location_id"""):
        eid, d, lst, desc, long, killed, loc = row
        ev[eid] = {"id": eid, "date": d, "list": lst, "short": (desc or "").strip(),
                   "long": (long or "").strip(), "killed": killed or 0, "loc": (loc or "").strip(),
                   "sources": [], "links": [], "cats": []}
    for eid, name, url in db.execute("""
        SELECT es.event_id, s.name_he, COALESCE(es.url, es.archive_url)
          FROM event_sources es JOIN sources s ON s.id = es.source_id ORDER BY es.id"""):
        if eid in ev:
            if name and name not in ev[eid]["sources"]:
                ev[eid]["sources"].append(name)
            if url:
                ev[eid]["links"].append(url)
    for eid, name in db.execute("""
        SELECT ec.event_id, c.name_he FROM event_categories ec JOIN categories c ON c.id = ec.category_id"""):
        if eid in ev and name not in ev[eid]["cats"]:
            ev[eid]["cats"].append(name)
    return ev


def account(e):
    """The Hebrew text we ship to the pipeline: Tiud's short line, then its long account
    when that adds something — the long field is sometimes only a remark ("the number of
    animals was not published"), so the short line is never dropped."""
    s, l = e["short"], e["long"]
    if not l or l == s or l.startswith(s):
        return l or s
    return f"{s}\n{l}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    today = dt.date.today()
    if not TIUD_DB.exists():
        raise SystemExit(f"Tiud database not found: {TIUD_DB}")
    tiud = read_tiud()
    main_ev = {k: v for k, v in tiud.items() if v["list"] == "main"}
    print(f"Tiud: {len(main_ev)} main events ({len(tiud)} total)")

    wb = openpyxl.load_workbook(XLSX)
    ws = wb.active
    header = [c.value for c in ws[1]]
    if "tiud_id" not in header:
        ws.cell(1, len(header) + 1, "tiud_id")
        header.append("tiud_id")
        print("added column tiud_id")
    c = {k: i + 1 for i, k in enumerate(header)}
    g = lambda r, k: ws.cell(r, c[k]).value

    # Old Fortress rows without a tiud_id: match once by date + the log's own line
    by_key = {}
    for e in tiud.values():
        by_key.setdefault((e["date"], e["short"]), e["id"])
    max_id, have, matched, unmatched = 0, {}, 0, 0
    for r in range(2, ws.max_row + 1):
        rid = g(r, "row_id")
        if rid:
            max_id = max(max_id, int(str(rid).split("-")[1]))
        if g(r, "data_source") != "the fortress":
            continue
        tid = g(r, "tiud_id")
        if not tid:
            line = (g(r, "description_he_original") or g(r, "description_he_medium") or "").strip()
            tid = by_key.get((str(to_date(g(r, "date"))), line))
            if tid:
                ws.cell(r, c["tiud_id"], tid); matched += 1
            else:
                unmatched += 1
        if tid:
            have[int(tid)] = r
    if matched or unmatched:
        print(f"old Fortress rows: {matched} matched to Tiud ids, {unmatched} left without (kept as they are)")

    new = [e for i, e in main_ev.items() if i not in have]
    gone = [(i, r) for i, r in have.items() if i in tiud and tiud[i]["list"] != "main" and not g(r, "hidden")]
    changed = []
    for i, r in have.items():
        e = tiud.get(i)
        if not e or e["list"] != "main" or not g(r, "description_he_original"):
            continue   # not processed by 06 yet — nothing of ours to protect
        # the old rows hold Tiud's SHORT line as their original; only a text that matches
        # neither Tiud's short line nor its long account counts as changed
        ours = (g(r, "description_he_original") or "").strip()
        if ours not in (e["short"], e["long"], account(e)):
            changed.append((g(r, "row_id"), i, ours[:200], (e["long"] or e["short"])[:300]))
    print(f"new {len(new)}, left Tiud's main list {len(gone)}, text changed after processing {len(changed)}")
    if args.dry_run:
        for e in sorted(new, key=lambda e: e["date"])[:10]:
            print(f"  + {e['date']} {e['loc']}: {(e['long'] or e['short'])[:100]}")
        return

    FILTER_DIR.mkdir(exist_ok=True)
    if changed:
        p = FILTER_DIR / f"tiud-changes-{today}.csv"
        with p.open("w", newline="", encoding="utf-8") as f:
            w = csv.writer(f); w.writerow(["row_id", "tiud_id", "sheet_original", "tiud_text_now"]); w.writerows(changed)
        print(f"changed texts → {p} (sheet untouched)")
    ARCHIVE.mkdir(exist_ok=True)
    shutil.copy2(XLSX, ARCHIVE / f"events-before-tiud-{today}.xlsx")
    for i, r in gone:
        ws.cell(r, c["hidden"], f"tiud dropped {today}")
    first_new = max_id + 1
    for e in sorted(new, key=lambda e: (e["date"], e["id"])):
        max_id += 1
        row = [None] * len(header)
        row[c["row_id"] - 1] = f"row-{max_id}"
        row[c["date"] - 1] = dt.datetime.fromisoformat(e["date"])
        row[c["description_he_medium"] - 1] = account(e)
        row[c["location"] - 1] = e["loc"]
        row[c["fatalities"] - 1] = int(e["killed"])
        row[c["source"] - 1] = " · ".join(e["sources"])
        row[c["fortress_links"] - 1] = " ".join(e["links"])
        row[c["fortress_categories"] - 1] = " · ".join(e["cats"]) or None
        row[c["data_source"] - 1] = "the fortress"
        row[c["tiud_id"] - 1] = e["id"]
        ws.append(row)
    wb.save(XLSX)
    LAST_FILE.write_text(json.dumps({"run": str(today), "new_rows": {"from": first_new, "to": max_id},
                                     "tiud_main": len(main_ev)}) + "\n")
    print(f"appended {len(new)} rows (row-{first_new}…row-{max_id}), hid {len(gone)}. "
          f"Next: python3 08_dedupe_fortress.py events.xlsx --direction fortress")


if __name__ == "__main__":
    main()
