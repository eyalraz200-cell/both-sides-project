#!/usr/bin/env python3
import http.server, os, sys, json, re, time, threading, openpyxl
from pathlib import Path

WATCH_DIR = Path(__file__).parent
WATCH_EXTS = {".html", ".css", ".js"}

# Flags — the defaults are the everyday server:
#   python3 server.py                     → :8080, reloads on any html/css/js at the
#     project root or under js/ (the xlsx is NOT watched — restart after editing it)
#   python3 server.py --port 8081 --watch page9.js,js  → a SECOND instance serving the
#     same files, whose auto-reload only fires for those paths. Point one browser tab
#     at :8081 to work on one fold without every unrelated edit (another chat, another
#     fold) reloading it. Both instances can run at once; they share the directory.
# --watch takes comma-separated names relative to the project root: a file, or a
# directory (watched recursively).
def _flag(name, default=None):
    if name in sys.argv:
        return sys.argv[sys.argv.index(name) + 1]
    return default

PORT = int(_flag("--port", "8080"))
WATCH_ONLY = [w.strip() for w in _flag("--watch", "").split(",") if w.strip()]

last_modified = 0

def _watched_paths():
    if not WATCH_ONLY:
        top = [p for p in WATCH_DIR.iterdir() if p.suffix in WATCH_EXTS]
        js = WATCH_DIR / "js"
        if js.is_dir():
            top.extend(q for q in js.rglob("*") if q.suffix in WATCH_EXTS)
        return top
    out = []
    for name in WATCH_ONLY:
        p = WATCH_DIR / name
        if p.is_dir():
            out.extend(q for q in p.rglob("*") if q.is_file())
        elif p.exists():
            out.append(p)
    return out

def get_mtime():
    return max((p.stat().st_mtime for p in _watched_paths()), default=0)

def watch():
    global last_modified
    last_modified = get_mtime()
    while True:
        time.sleep(0.5)
        t = get_mtime()
        if t > last_modified:
            last_modified = t

EVENTS_XLSX = "full_v3.xlsx"

# full_v3.xlsx has no `side` column — the camp split is derived from main_actor
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

# The crowd-size column lives in a DIFFERENT workbook from EVENTS_XLSX
# (full_v3.xlsx has no such column), so it is joined in. The only key that
# survives across the two files is the English `Description` text: joining on
# (date, main_actor, description) hits only 57%, description alone hits
# 13,075 / 14,451 (90%). Unmatched rows get crowd = None, which reads as the
# small/no-halo tier in JS.
CROWD_XLSX = "Events_with_description_he_medium.xlsx"

# "crowd size=about 2,000" / "…=tens of thousands" → one integer ESTIMATE.
# The estimate is what ships; the small/medium/large cutoffs are a JS-side
# decision (P7_BULGE_CUTS, page7.js) so they can be retuned without a server
# restart. Word buckets take the geometric middle of their decade band; a
# range ("dozens to hundreds") resolves to its larger end, since every number
# in the sheet is an eyewitness lower bound.
CROWD_WORDS = [
    ("hundreds of thousands", 300000),
    ("tens of thousands",      30000),
    ("thousands",               3000),
    ("hundreds",                 300),
    ("dozens",                    50),
    ("tens",                      30),
]

def parse_crowd(raw):
    if raw is None:
        return None
    t = str(raw).lower().replace("crowd size=", "").strip()
    if not t or t.startswith("no report"):
        return None
    best = None
    for n in re.findall(r"\d{1,3}(?:,\d{3})+|\d+", t):
        v = int(n.replace(",", ""))
        best = v if best is None else max(best, v)
    for word, v in CROWD_WORDS:          # longest phrases first — "tens of
        if word in t:                    # thousands" must not match "tens"
            best = v if best is None else max(best, v)
            break
    return best

def load_crowd():
    """description text -> crowd estimate (int), for the rows that report one."""
    path = WATCH_DIR / CROWD_XLSX
    if not path.exists():
        print(f"  WARNING: {CROWD_XLSX} missing — every event ships crowd=None")
        return {}
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    header = [str(h).strip() if h is not None else "" for h in next(rows)]
    col = {name: i for i, name in enumerate(header)}
    out = {}
    for row in rows:
        desc = row[col["description"]]
        n = parse_crowd(row[col["crowd size"]])
        if desc and n is not None:
            out[str(desc).strip()[:80]] = n
    wb.close()
    return out

def load_events():
    wb = openpyxl.load_workbook(WATCH_DIR / EVENTS_XLSX, read_only=True, data_only=True)
    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    header = [str(h).strip() if h is not None else "" for h in next(rows)]
    col = {name: i for i, name in enumerate(header)}
    events = []
    unknown_actors = set()
    crowd = load_crowd()
    matched = 0
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
        desc_en = row[col["Description"]]
        n = crowd.get(str(desc_en).strip()[:80]) if desc_en else None
        if n is not None:
            matched += 1
        events.append({
            # The xlsx's own stable row_id ("row-145"). Passed through so JS can
            # pin to one specific event by id instead of by its position in the
            # date-sorted list — see FOLD6_SQUARE_ROW_IDS (js/groups.js).
            "rowId": row[col["row_id"]],
            "side": side,
            "actor": actor,
            # Hebrew event_type — the join key into P9_CATEGORIES (page9.js).
            "category": row[col["event_type"]],
            "date": date_str,
            "descHeMedium": row[col["description_he_medium"]] or None,
            # Reported crowd size as an integer estimate, or None when the
            # source says "no report" / the description didn't join. Drives the
            # bulge tier on the timeline dots (p7BulgeTier, page7.js).
            "crowd": n,
        })
    wb.close()

    print(f"  crowd size: {matched}/{len(events)} events carry a reported figure")

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
print(f"Serving at http://localhost:{PORT}  "
      f"(auto-reload on: {', '.join(WATCH_ONLY) if WATCH_ONLY else 'all html/css/js'})")
http.server.HTTPServer(("", PORT), Handler).serve_forever()
