#!/usr/bin/env python3
import http.server, os, json, time, threading
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
        else:
            super().do_GET()

    def end_headers(self):
        # Inject reload script into HTML responses
        if self.path.endswith(".html") or self.path == "/":
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # silence request logs

threading.Thread(target=watch, daemon=True).start()
print(f"Serving at http://localhost:{PORT}  (auto-reload on)")
http.server.HTTPServer(("", PORT), Handler).serve_forever()
