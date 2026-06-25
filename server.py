#!/usr/bin/env python3
import http.server, os, json, time, threading, openpyxl
from collections import defaultdict
from pathlib import Path

PORT = 8080
WATCH_DIR = Path(__file__).parent
WATCH_EXTS = {".html", ".css", ".js"}

last_modified = 0

def get_mtime():
    return max(
        (p.stat().st_mtime for p in WATCH_DIR.iterdir()
         if p.suffix in WATCH_EXTS),
        default=0
    )

def watch():
    global last_modified
    last_modified = get_mtime()
    while True:
        time.sleep(0.5)
        t = get_mtime()
        if t > last_modified:
            last_modified = t

def load_events():
    wb = openpyxl.load_workbook(WATCH_DIR / "combined_V1_hebrew_summaries.xlsx", read_only=True, data_only=True)
    ws = wb.active
    events = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        side, actor, cat, desc, date, fatal, crowd, desc_he_med, desc_he_short = row
        if date is None or side is None:
            continue
        date_str = date.strftime("%Y-%m-%d") if hasattr(date, "strftime") else str(date)[:10]
        events.append({
            "side": side,
            "actor": actor,
            "category": cat,
            "date": date_str,
            "descHeMedium": desc_he_med or None,
        })
    wb.close()

    # Borrow-backfill: most events have no real Hebrew description (only
    # ~1,800 of 13,523 do). Every (actor, category) combo has at least one
    # real description though, so an event missing its own borrows one from
    # its own (actor, category) group instead of going without — round-robin
    # per group so repeated borrows within a group aren't all the same
    # sentence.
    by_group = defaultdict(list)
    for e in events:
        if e["descHeMedium"]:
            by_group[(e["actor"], e["category"])].append(e["descHeMedium"])
    borrow_idx = defaultdict(int)
    for e in events:
        if not e["descHeMedium"]:
            group = (e["actor"], e["category"])
            pool = by_group[group]
            e["descHeMedium"] = pool[borrow_idx[group] % len(pool)]
            borrow_idx[group] += 1

    return events

EVENTS_JSON = json.dumps(load_events()).encode()

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WATCH_DIR), **kwargs)

    def do_GET(self):
        if self.path == "/__mtime__":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"t": last_modified}).encode())
        elif self.path == "/events.json":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(EVENTS_JSON)
        else:
            super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass

threading.Thread(target=watch, daemon=True).start()
print(f"Serving at http://localhost:{PORT}  (auto-reload on)")
http.server.HTTPServer(("", PORT), Handler).serve_forever()
