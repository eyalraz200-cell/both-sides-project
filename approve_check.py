#!/usr/bin/env python3
"""Hourly: publish a pending refresh once the user has approved it on its GitHub issue.

  python3 approve_check.py

Reads _acled-filter/pending-issue.json (written by notify.py). Looks at the issue's
comments; the newest comment by OWNER decides:
  approve / אשר / go / publish / yes  → commit events.json, events-en.json, events-ar.json,
                                        push, comment "published", close the issue
  no / hold / לא                      → close the issue, nothing published
Anything else, or no comment yet → do nothing; try again next hour.
Only comments by OWNER count — the repo is public and anyone can comment.
"""
import datetime as dt
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PENDING = ROOT / "_acled-filter" / "pending-issue.json"
OWNER = "eyalraz200-cell"
YES = re.compile(r"^\s*(approve|approved|go|publish|yes|אשר|מאשר|אישור|כן)\b", re.I)
NO = re.compile(r"^\s*(no|hold|reject|wait|לא|עצור)\b", re.I)


def sh(*cmd, check=False):
    r = subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True)
    if check and r.returncode:
        sys.exit(f"{' '.join(cmd[:3])} failed: {r.stderr.strip()[:300]}")
    return r.stdout.strip()


def main():
    if not PENDING.exists():
        return
    p = json.loads(PENDING.read_text())
    n = str(p["number"])
    data = json.loads(sh("gh", "issue", "view", n, "--json", "state,comments"))
    if data.get("state") != "OPEN":
        PENDING.unlink()
        return
    mine = [c for c in data.get("comments", []) if c.get("author", {}).get("login") == OWNER]
    if not mine:
        return
    text = mine[-1].get("body", "")
    if NO.search(text):
        sh("gh", "issue", "close", n, "--comment", "Held — nothing published.")
        PENDING.unlink()
        print("held")
        return
    if not YES.search(text):
        return
    changed = sh("git", "status", "--porcelain", "--", "events.json", "events-en.json", "events-ar.json")
    if changed:
        sh("git", "add", "events.json", "events-en.json", "events-ar.json", check=True)
        msg = (f"Data refresh {p.get('opened', dt.date.today())} (approved on #{n})\n\n"
               "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>")
        sh("git", "commit", "-q", "-m", msg, check=True)
    for attempt in range(3):
        r = subprocess.run(["git", "push", "origin", "main"], cwd=ROOT, text=True, capture_output=True)
        if r.returncode == 0:
            break
    else:
        sh("gh", "issue", "comment", n, "--body", f"Push failed, will retry next hour:\n```\n{r.stderr[-400:]}\n```")
        return
    sha = sh("git", "rev-parse", "--short", "HEAD")
    sh("gh", "issue", "comment", n, "--body", f"Published — commit `{sha}` pushed; GitHub Pages will update in a minute.")
    sh("gh", "issue", "close", n)
    PENDING.unlink()
    print(f"published {sha}")


if __name__ == "__main__":
    main()
