#!/usr/bin/env python3
"""Pull new ACLED events into events.xlsx (step 00 of the pipeline).

  pip install openpyxl requests
  export ACLED_EMAIL="..." ACLED_PASSWORD="..."   # or put both in .env (gitignored)

  python3 00_fetch_acled.py            # fetch, filter, append; back up the workbook first
  python3 00_fetch_acled.py --dry-run  # report only, write nothing
  python3 00_fetch_acled.py --since 2026-07-01   # override the stored timestamp

What it does, in order:
  1. Logs in to ACLED (OAuth password grant) and reads only the Israel + Palestine events
     ADDED OR EDITED since the last run — ACLED's `timestamp` (last-edit time) > the value
     stored in _acled-filter/last-fetch.json (first run: the July 2026 export's newest edit,
     2026-07-10). Deletions come from ACLED's deleted-events list, by deletion time.
  2. Keeps only rows whose `actor1` is in KEEP_ACTORS — the rule reverse-engineered from the
     user's hand filter of the July 2026 export (wiki/Data.md, "ACLED fetch filter"). Step
     01 decides relevance per row; this is just the cheap net. Every actor1 value never seen
     before is printed with a count so a renamed/new ACLED actor cannot slip past silently.
  3. Matches on `event_id_cnty` (= the sheet's `acled_id`):
       new id            → appended as a fresh `row-N`, data_source=acled, blank pipeline
                           columns (steps 01→07 pick it up; `crowd` prefilled from ACLED's
                           `crowd size=` tag only when it is a figure, not a category)
       known id, text changed → listed in _acled-filter/changes-<date>.csv, sheet untouched
                           (hand stamps must survive; the user decides)
       known id, actor1 recoded out of KEEP_ACTORS → listed in the changes csv too
       id on ACLED's deleted list → `hidden` = "acled deleted <date>" (row kept, drops from site)
Nothing here calls OpenAI. Run `run_pipeline.py` next.
"""
import argparse
import csv
import json
import datetime as dt
import os
import re
import shutil
import sys
from pathlib import Path

import openpyxl
import requests

ROOT = Path(__file__).resolve().parent
XLSX = ROOT / "events.xlsx"
ARCHIVE = ROOT / "_xlsx-archive"
FILTER_DIR = ROOT / "_acled-filter"          # gitignored — ACLED rows never leave the disk
SEEN_ACTORS_FILE = FILTER_DIR / "seen-actors.txt"

TOKEN_URL = "https://acleddata.com/oauth/token"
READ_URL = "https://acleddata.com/api/acled/read"
DELETED_URL = "https://acleddata.com/api/deleted/read"
LAST_FETCH_FILE = FILTER_DIR / "last-fetch.json"
FIRST_RUN_TS = 1783631649     # 2026-07-10 00:14:09 local — newest edit in raw-israel/palestine.csv
COUNTRIES = ["Israel", "Palestine"]
PAGE = 5000

# The hand-filter rule (see wiki/Data.md). Misses 13 of ~12,400 live events — accepted 2026-10-07.
KEEP_ACTORS = {
    "Protesters (Israel)",
    "Rioters (Israel)",
    "Settlers (Israel)",
    "Settlement Emergency Squad",
    "Unidentified Armed Group (Israel)",
}

DATASET_START = "2023-01-01"   # the project starts here; ACLED edits to older events are noise
TRIAL_ENDS = dt.date(2027, 4, 6)   # Partner-tier trial; Open tier may not serve this endpoint


# ---------------------------------------------------------------- credentials / API
def load_env():
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def get_token():
    email, pw = os.environ.get("ACLED_EMAIL"), os.environ.get("ACLED_PASSWORD")
    if not (email and pw):
        sys.exit("ACLED_EMAIL / ACLED_PASSWORD missing (env or .env)")
    r = requests.post(TOKEN_URL, data={
        "username": email, "password": pw, "grant_type": "password", "client_id": "acled",
    }, timeout=60)
    if r.status_code != 200:
        sys.exit(f"ACLED login failed ({r.status_code}): {r.text[:300]}")
    return r.json()["access_token"]


def fetch(token, since_ts, url=READ_URL, ts_field="timestamp"):
    """Every row in COUNTRIES whose ts_field > since_ts, all pages."""
    hdr = {"Authorization": f"Bearer {token}"}
    out = []
    # One request for both countries: a second request on the same token came back 401
    # (2026-10-07), so never loop countries on one token.
    for country in ["|".join(COUNTRIES)]:
        page = 1
        while True:
            params = {
                "_format": "json", "country": country,
                ts_field: since_ts, f"{ts_field}_where": ">",
                **({"event_date": DATASET_START, "event_date_where": ">="} if url == READ_URL else {}),
                "limit": PAGE, "page": page,
            }
            r = requests.get(url, headers=hdr, params=params, timeout=180)
            if r.status_code != 200:
                sys.exit(f"ACLED read failed ({r.status_code}) — Partner trial ends {TRIAL_ENDS}: "
                         f"{r.text[:300]}")
            body = r.json()
            data = body.get("data", [])
            out.extend(data)
            print(f"  {country}: page {page}, {len(data)} rows")
            if len(data) < PAGE:
                break
            page += 1
    return out


# ---------------------------------------------------------------- workbook
def col_index(header):
    return {name: i for i, name in enumerate(header)}


def to_date(v):
    if isinstance(v, dt.datetime):
        return v.date()
    if isinstance(v, dt.date):
        return v
    return dt.date.fromisoformat(str(v)[:10])


# ACLED's tag used to carry a figure ("crowd size=about 2,000"); since 2026 it is mostly a
# category. A category is not a size — leave `crowd` blank so step 05 reads the text.
CROWD_CATEGORIES = {"very small", "small", "medium", "large", "very large", "massive"}


def crowd_from_tags(tags):
    m = re.search(r"crowd size=([^;]+)", tags or "")
    v = m.group(1).strip() if m else None
    return None if not v or v.lower() in CROWD_CATEGORIES else v


def new_row(header, row_id, ev):
    r = [None] * len(header)
    c = col_index(header)
    r[c["row_id"]] = row_id
    r[c["date"]] = dt.datetime.fromisoformat(ev["event_date"])
    r[c["Description"]] = ev["notes"]
    r[c["location"]] = ev["location"]
    r[c["fatalities"]] = int(ev.get("fatalities") or 0)
    r[c["source"]] = ev["source"]
    r[c["acled_id"]] = ev["event_id_cnty"]
    r[c["latitude"]] = float(ev["latitude"]) if ev.get("latitude") else None
    r[c["longitude"]] = float(ev["longitude"]) if ev.get("longitude") else None
    r[c["geo_precision"]] = int(ev["geo_precision"]) if ev.get("geo_precision") else None
    r[c["data_source"]] = "acled"
    r[c["crowd"]] = crowd_from_tags(ev.get("tags"))
    return r


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", help="YYYY-MM-DD edit date to read from (default: last run)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    load_env()
    today = dt.date.today()
    if today > TRIAL_ENDS - dt.timedelta(days=30):
        print(f"!! ACLED Partner trial ends {TRIAL_ENDS} — renew or the fetch stops working")

    print("Loading workbook…")
    wb = openpyxl.load_workbook(XLSX)
    ws = wb.active
    header = [c.value for c in ws[1]]
    c = col_index(header)
    by_acled = {}
    last_acled = dt.date(2023, 1, 1)
    max_id = 0
    for row in ws.iter_rows(min_row=2):
        vals = [x.value for x in row]
        rid = vals[c["row_id"]]
        if rid:
            max_id = max(max_id, int(str(rid).split("-")[1]))
        if vals[c["data_source"]] == "acled" and vals[c["acled_id"]]:
            by_acled.setdefault(vals[c["acled_id"]], []).append(row)
            if not vals[c["split_from"]]:
                last_acled = max(last_acled, to_date(vals[c["date"]]))
    FILTER_DIR.mkdir(exist_ok=True)
    if args.since:
        since_ts = int(dt.datetime.fromisoformat(args.since).timestamp())
    elif LAST_FETCH_FILE.exists():
        since_ts = json.loads(LAST_FETCH_FILE.read_text())["timestamp"]
    else:
        since_ts = FIRST_RUN_TS
    print(f"Sheet: {len(by_acled)} ACLED ids, last event {last_acled}; "
          f"reading edits after {dt.datetime.fromtimestamp(since_ts)}")

    token = get_token()
    events = fetch(token, since_ts)
    print(f"Added or edited since then: {len(events)} rows")
    try:
        deleted = fetch(token, since_ts, DELETED_URL, "deleted_timestamp")
    except SystemExit as e:
        print(f"!! deleted-events list unavailable ({e}); deletions not applied this run")
        deleted = []
    newest_ts = max([since_ts] + [int(e["timestamp"]) for e in events]
                    + [int(d["deleted_timestamp"]) for d in deleted])

    # New-actor watch
    seen = set(SEEN_ACTORS_FILE.read_text().splitlines()) if SEEN_ACTORS_FILE.exists() else set()
    counts = {}
    for ev in events:
        counts[ev["actor1"]] = counts.get(ev["actor1"], 0) + 1
    unseen = {a: n for a, n in counts.items() if a not in seen}
    if unseen:
        print("actor1 values never seen before (not kept unless in KEEP_ACTORS):")
        for a, n in sorted(unseen.items(), key=lambda x: -x[1]):
            print(f"  {n:5d}  {a}{'   <- KEPT' if a in KEEP_ACTORS else ''}")

    kept = [ev for ev in events if ev["actor1"] in KEEP_ACTORS]
    new, changed = [], []
    for ev in events:
        if ev["actor1"] not in KEEP_ACTORS:
            if ev["event_id_cnty"] in by_acled:     # ACLED recoded a row we already carry
                r0 = by_acled[ev["event_id_cnty"]][0]
                changed.append((r0[c["row_id"]].value, ev["event_id_cnty"],
                                "actor1 now outside the filter", f"{ev['actor1']}: {ev['notes']}"))
            continue
        rows = by_acled.get(ev["event_id_cnty"])
        if not rows:
            new.append(ev)
            continue
        parent = next((r for r in rows if not r[c["split_from"]].value), rows[0])
        old = parent[c["description_original"]].value or parent[c["Description"]].value or ""
        if old.strip() != ev["notes"].strip():
            changed.append((parent[c["row_id"]].value, ev["event_id_cnty"], old, ev["notes"]))
    gone = [d["event_id_cnty"] for d in deleted if d["event_id_cnty"] in by_acled
            and not any(r[c["hidden"]].value for r in by_acled[d["event_id_cnty"]])]

    print(f"\nKept by actor rule: {len(kept)}  →  new {len(new)}, text changed {len(changed)}, "
          f"gone from ACLED {len(gone)}")
    if args.dry_run:
        for ev in new[:15]:
            print(f"  + {ev['event_date']} {ev['actor1']}: {ev['notes'][:100]}")
        return

    if changed:
        p = FILTER_DIR / f"changes-{today}.csv"
        with p.open("w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["row_id", "acled_id", "sheet_text", "acled_text_now"])
            w.writerows(changed)
        print(f"Changed texts → {p} (sheet untouched; decide by hand)")

    def remember():
        LAST_FETCH_FILE.write_text(json.dumps({"timestamp": newest_ts, "run": str(today)}) + "\n")
        SEEN_ACTORS_FILE.write_text("\n".join(sorted(seen | set(counts))) + "\n")
    if not new and not gone:
        remember()
        print("Nothing to write.")
        return
    ARCHIVE.mkdir(exist_ok=True)
    backup = ARCHIVE / f"events-before-fetch-{today}.xlsx"
    shutil.copy2(XLSX, backup)
    print(f"Backup → {backup}")
    for aid in gone:
        for r in by_acled[aid]:
            r[c["hidden"]].value = f"acled deleted {today}"
    new.sort(key=lambda e: (e["event_date"], e["event_id_cnty"]))
    for ev in new:
        max_id += 1
        ws.append(new_row(header, f"row-{max_id}", ev))
    wb.save(XLSX)
    remember()
    print(f"Appended {len(new)} rows (row-{max_id - len(new) + 1}…row-{max_id}), hid {len(gone)}. "
          f"Next: python3 run_pipeline.py")


if __name__ == "__main__":
    main()
