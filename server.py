#!/usr/bin/env python3
import http.server, os, json, time, threading, openpyxl
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

EVENTS_XLSX = "full_v2.xlsx"

# full_v2.xlsx has no `side` column — the camp split is derived from main_actor
# instead. These two rosters must stay in sync with FOLD4_COALITION_ROWS /
# FOLD4_CHANGE_ROWS in js/groups.js, which define the same membership by color.
ACTOR_SIDE = {
    # מחנה הימין (coalition)
    "haredi jews":                   "right",
    "settlers":                      "right",
    "right wing protesters":         "right",
    # גוש השינוי (change)
    "peace movements":               "left",
    "protesters against government": "left",
    "arab israelis":                 "left",
}

def load_events():
    wb = openpyxl.load_workbook(WATCH_DIR / EVENTS_XLSX, read_only=True, data_only=True)
    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    header = [str(h).strip() if h is not None else "" for h in next(rows)]
    col = {name: i for i, name in enumerate(header)}
    events = []
    unknown_actors = set()
    for row in rows:
        actor = row[col["main_actor"]]
        date  = row[col["date"]]
        if date is None or actor is None:
            continue
        side = ACTOR_SIDE.get(str(actor).strip().lower())
        if side is None:
            unknown_actors.add(actor)
            continue
        date_str = date.strftime("%Y-%m-%d") if hasattr(date, "strftime") else str(date)[:10]
        events.append({
            "side": side,
            "actor": actor,
            # Hebrew event_type — the join key into P9_CATEGORIES (page9.js).
            "category": row[col["event_type"]],
            "date": date_str,
            "descHeMedium": row[col["description_he_medium"]] or None,
        })
    wb.close()

    if unknown_actors:
        print(f"  WARNING: dropped rows with unmapped main_actor: {sorted(unknown_actors)}")
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
