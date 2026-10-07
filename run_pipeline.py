#!/usr/bin/env python3
"""Run the whole classification pipeline over whatever rows need it, unattended.

  export OPENAI_API_KEY="..."        # (.env works too)
  python3 run_pipeline.py            # all steps, in order
  python3 run_pipeline.py --from 02  # resume from a step
  python3 run_pipeline.py --only 07
  python3 run_pipeline.py --dry-run  # show which rows each step would send, submit nothing

Per step: `submit events.xlsx` → poll `status` every POLL_S until every chunk is completed →
`download` → copy the step's "events - <suffix>.xlsx" over events.xlsx (the previous workbook
is kept in _xlsx-archive/). A step that finds nothing to send is skipped. Each step already
skips hand-stamped rows, hidden rows and rows that never ship, so rerunning is safe.
Order (wiki/Data.md): actor → split → type → Hebrew → crowd → Fortress rewrite → short EN/AR.
When every step is through, server.py's loader rewrites events.json / events-en.json /
events-ar.json and the summary of what changed is printed — review, then commit.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import time
import datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parent
XLSX = ROOT / "events.xlsx"
ARCHIVE = ROOT / "_xlsx-archive"
POLL_S = 120
MAX_WAIT_S = 6 * 3600          # OpenAI Batch promises 24h; in practice minutes–hours

# (script, state file, download suffix) in run order
STEPS = [
    ("01_identify_main_actor.py",                 "main_actor_state.json",    "actors"),
    ("04_split_subactions.py",                    "split_state.json",         "split"),
    ("02_classify_event_type_no_intimidation.py", "event_type_state.json",    "event types"),
    ("03_translate_hebrew_and_date.py",           "date_hebrew_state.json",   "date hebrew"),
    ("05_extract_crowd.py",                       "crowd_state.json",         "crowd"),
    ("06_rewrite_fortress_desc.py",               "fortress_desc_state.json", "fortress desc"),
    ("07_short_english_and_arabic.py",            "short_en_ar_state.json",   "short en ar"),
]


def load_env():
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def run(script, *args):
    cmd = [sys.executable, str(ROOT / script), *args]
    print(f"$ {' '.join(a if ' ' not in a else repr(a) for a in cmd[1:])}", flush=True)
    r = subprocess.run(cmd, cwd=XLSX.parent, text=True, capture_output=True)   # steps keep state in cwd
    sys.stdout.write(r.stdout)
    if r.returncode:
        sys.stdout.write(r.stderr)
        raise SystemExit(f"{script} {args[0]} failed (exit {r.returncode})")
    return r.stdout


def state_of(state_file):
    p = XLSX.parent / state_file
    return json.loads(p.read_text()) if p.exists() else None


def run_step(script, state_file, suffix, dry_run):
    print(f"\n==== {script}", flush=True)
    if dry_run:
        # build_jobs runs inside submit; the cheapest honest preview is the OpenAI-free path:
        # submit writes the jsonl + state before contacting OpenAI, so count via a fresh state.
        print("  (dry-run: steps have no preview mode; see each script's row rules in wiki/Data.md)")
        return
    st = state_of(state_file)
    in_flight = (st and st.get("source_workbook") == str(XLSX.resolve()) and not st.get("downloaded")
                 and any(c.get("batch_id") for c in st.get("chunks", [])))
    if in_flight:
        print("  batch already submitted for this workbook — resuming, not resubmitting")
    else:
        run(script, "submit", str(XLSX))
        st = state_of(state_file)
    n = st.get("rows_submitted", 0) if st else 0
    if n == 0:
        print("  nothing to send — skipped")
        return
    print(f"  {n} rows in {len(st['chunks'])} chunk(s); polling every {POLL_S}s")
    t0 = time.time()
    while True:
        time.sleep(POLL_S)
        run(script, "status")
        st = state_of(state_file)
        statuses = [c.get("status") for c in st["chunks"]]
        if all(s == "completed" for s in statuses):
            break
        if any(s in ("failed", "expired", "cancelled") for s in statuses):
            run(script, "retry_failed")
        if time.time() - t0 > MAX_WAIT_S:
            raise SystemExit(f"{script}: still not complete after {MAX_WAIT_S // 3600}h — "
                             f"resume with: python3 run_pipeline.py --from {script[:2]}")
    run(script, "download")
    st = state_of(state_file); st["downloaded"] = True
    (XLSX.parent / state_file).write_text(json.dumps(st, ensure_ascii=False, indent=2))
    out = XLSX.parent / f"{XLSX.stem} - {suffix}{XLSX.suffix}"
    if not out.exists():
        raise SystemExit(f"{script}: expected {out.name} after download")
    archive = XLSX.parent / ARCHIVE.name
    archive.mkdir(exist_ok=True)
    shutil.move(XLSX, archive / f"{XLSX.stem}-before-{suffix.replace(' ', '-')}-{dt.date.today()}.xlsx")
    shutil.move(out, XLSX)
    print(f"  {out.name} → events.xlsx")


def regenerate_and_report():
    print("\n==== regenerating events*.json", flush=True)
    # server.py writes the three committed json files when they differ; --sync-only skips serving
    subprocess.run([sys.executable, "server.py", "--sync-only"], cwd=ROOT, check=True)
    diff = subprocess.run(["git", "diff", "--stat", "--", "events.json", "events-en.json", "events-ar.json"],
                          cwd=ROOT, text=True, capture_output=True).stdout
    print(diff or "  json unchanged")
    try:
        import openpyxl
        ws = openpyxl.load_workbook(XLSX, read_only=True).active
        rows = list(ws.iter_rows(values_only=True)); h = rows[0]
        c = {k: i for i, k in enumerate(h)}
        live = [r for r in rows[1:] if not r[c["hidden"]] and r[c["main_actor"]] not in (None, "not relevant")]
        pending = [r for r in live if not r[c["event_type"]] or not r[c["description_he_medium"]]]
        review = [r for r in live if r[c["event_type_needs_review"]] == "yes" or r[c["main_actor_needs_review"]] == "yes"]
        print(f"live rows {len(live)}, still missing type/Hebrew {len(pending)}, flagged for review {len(review)}")
    except Exception as e:  # reporting only
        print("  (summary skipped:", e, ")")
    print("Next: look at the review flags, restart the dev server, commit events*.json.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="from_", help="two-digit step to resume from")
    ap.add_argument("--only", help="run one step")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--xlsx", help="run on another workbook (a test copy); skips the json rebuild")
    a = ap.parse_args()
    global XLSX
    if a.xlsx:
        XLSX = Path(a.xlsx).resolve()
    load_env()
    if not a.dry_run and not os.getenv("OPENAI_API_KEY"):
        sys.exit("OPENAI_API_KEY missing (env or .env)")
    steps = STEPS
    if a.only:
        steps = [s for s in STEPS if s[0].startswith(a.only)]
    elif a.from_:
        idx = next(i for i, s in enumerate(STEPS) if s[0].startswith(a.from_))
        steps = STEPS[idx:]
    for script, state_file, suffix in steps:
        run_step(script, state_file, suffix, a.dry_run)
    if not a.dry_run and not a.xlsx:
        regenerate_and_report()


if __name__ == "__main__":
    main()
