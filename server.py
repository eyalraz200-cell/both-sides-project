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

def load_events():
    wb = openpyxl.load_workbook(WATCH_DIR / "combined_event type.xlsx", read_only=True, data_only=True)
    ws = wb.active
    events = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        side, actor, cat, desc, date, fatal, crowd = row
        if date is None or side is None:
            continue
        date_str = date.strftime("%Y-%m-%d") if hasattr(date, "strftime") else str(date)[:10]
        events.append({"side": side, "actor": actor, "cat": cat, "date": date_str})
    wb.close()
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
