#!/usr/bin/env python3
import http.server, os, socket, sys, json, re, time, threading, openpyxl
from pathlib import Path

WATCH_DIR = Path(__file__).parent
WATCH_EXTS = {".html", ".css", ".js"}

# Flags — the defaults are the everyday server:
#   python3 server.py                     → :8080, reloads on any html/css/js at the
#     project root or under js/ (the xlsx is NOT watched — restart after editing it)
#   python3 server.py --port 0               → a free port (one server PER WORKTREE / chat)
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

EVENTS_XLSX = "events.xlsx"

# events.xlsx has no `side` column — the camp split is derived from main_actor
# instead. These two rosters must stay in sync with FOLD4_COALITION_ROWS /
# FOLD4_CHANGE_ROWS in js/groups.js, which define the same membership by color.
ACTOR_SIDE = {
    # קואליציית הימין (coalition)
    "haredi jews":                   "right",
    "settlers":                      "right",
    "right wing protesters":         "right",
    # גוש השינוי (change)
    "peace movements":               "left",
    "protesters against government": "left",
    "arab israelis":                 "left",
}

# Rows whose ONLY cited source(s) are in this set are dropped from the dataset;
# rows that also cite any other outlet are kept. Multi-source cells are
# ";"-separated, matched lowercase. The PLO Negotiations Affairs Department is
# the sheet's largest source (5,056 rows, all settler events); the 4,036 rows
# that cite nothing else are dropped, the 1,020 corroborated by another outlet
# stay. Empty the set to ship every row.
SOLE_SOURCE_EXCLUDE = {"plo negotiations affairs department"}

# The timeline ends where the ACLED data ends, for now: rows dated after the
# latest `data_source == "acled"` row are dropped (The Fortress keeps posting
# weeks past ACLED's last export, which left a tail of fortress-only dots on the
# axis). Set to False to ship every row again.
CUT_AFTER_LAST_ACLED = True

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

def load_events():
    wb = openpyxl.load_workbook(WATCH_DIR / EVENTS_XLSX, read_only=True, data_only=True)
    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    header = [str(h).strip() if h is not None else "" for h in next(rows)]
    col = {name: i for i, name in enumerate(header)}
    events = []
    unknown_actors = set()
    matched = 0
    sole_dropped = 0
    hidden_dropped = 0
    # Optional `hidden` column: any non-empty cell keeps the row in the workbook
    # but out of the project. Absent in older copies of the sheet, hence .get().
    hidden_col = col.get("hidden")
    rows = list(rows)
    # Last ACLED-sourced date (see CUT_AFTER_LAST_ACLED).
    last_acled = ""
    if CUT_AFTER_LAST_ACLED and "data_source" in col:
        for row in rows:
            d = row[col["date"]]
            if d is not None and str(row[col["data_source"]] or "").strip().lower() == "acled":
                ds = d.strftime("%Y-%m-%d") if hasattr(d, "strftime") else str(d)[:10]
                last_acled = max(last_acled, ds)
    tail_dropped = 0
    for row in rows:
        actor = row[col["main_actor"]]
        date  = row[col["date"]]
        if date is None or actor is None:
            continue
        if hidden_col is not None and hidden_col < len(row) and str(row[hidden_col] or "").strip():
            hidden_dropped += 1
            continue
        sources = {x.strip().lower() for x in str(row[col["source"]] or "").split(";") if x.strip()}
        if sources and sources <= SOLE_SOURCE_EXCLUDE:
            sole_dropped += 1
            continue
        side = ACTOR_SIDE.get(str(actor).strip().lower())
        if side is None:
            unknown_actors.add(actor)
            continue
        date_str = date.strftime("%Y-%m-%d") if hasattr(date, "strftime") else str(date)[:10]
        if last_acled and date_str > last_acled:
            tail_dropped += 1
            continue
        # Shipped English: the short line from step 07 when present, else ACLED's
        # full Description (which stays in the sheet for the classifiers).
        desc_en = (row[col["description_en_short"]] if "description_en_short" in col else None) or row[col["Description"]]
        desc_ar = row[col["description_ar"]] if "description_ar" in col else None
        # `crowd` column: "about 2,000" / "tens of thousands" / blank.
        n = parse_crowd(row[col["crowd"]]) if "crowd" in col else None
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
            # ACLED's own English text. NOT shipped in events.json — split off
            # into events-en.json below, which only the English page fetches.
            "descEn": str(desc_en).strip() if desc_en else None,
            # Arabic translation (column `description_ar`, step 07). Same split:
            # events-ar.json, fetched only by ar/index.html.
            "descAr": str(desc_ar).strip() if desc_ar else None,
            # Reported crowd size as an integer estimate, or None when the
            # sheet has no figure for the row. Drives the
            # bulge tier on the timeline dots (p7BulgeTier, page7.js).
            "crowd": n,
        })
    wb.close()

    print(f"  crowd size: {matched}/{len(events)} events carry a reported figure")
    print(f"  dropped {sole_dropped} rows whose only source is in SOLE_SOURCE_EXCLUDE")
    print(f"  dropped {hidden_dropped} rows marked in the `hidden` column")
    if last_acled:
        print(f"  dropped {tail_dropped} rows dated after the last ACLED event ({last_acled})")

    if unknown_actors:
        print(f"  WARNING: dropped rows with unmapped main_actor: {sorted(unknown_actors)}")
    return events

# The workbooks are ACLED-licensed and gitignored (local-only). A clone without
# them serves the committed events.json as-is instead of crashing.
if (WATCH_DIR / EVENTS_XLSX).exists():
    _events = load_events()
    # rowId -> English description, for en/index.html (p7LoadEnglishDescs,
    # page7.js). Kept out of events.json so the Hebrew page's payload is unchanged.
    EVENTS_EN_JSON = json.dumps(
        {e["rowId"]: e.pop("descEn") for e in _events}, ensure_ascii=False
    ).encode()
    EVENTS_AR_JSON = json.dumps(
        {e["rowId"]: e.pop("descAr") for e in _events}, ensure_ascii=False
    ).encode()
    EVENTS_JSON = json.dumps(_events, ensure_ascii=False).encode()
    _EVENTS_FROM_XLSX = True
else:
    EVENTS_JSON = (WATCH_DIR / "events.json").read_bytes()
    _EVENTS_FROM_XLSX = False
    print(f"  NOTE: {EVENTS_XLSX} not found — serving the committed events.json unchanged")

# Keep the committed static events.json (what GitHub Pages serves) in sync with
# the xlsx: the deployed file once shipped without the `crowd` column, so every
# dot read as tier 0 and @fold8's size grid never resized. Write only when the
# content actually differs, so an unchanged xlsx leaves git status clean.
def _sync_static_events():
    if not _EVENTS_FROM_XLSX:
        return
    path = WATCH_DIR / "events.json"
    try:
        current = path.read_bytes()
    except FileNotFoundError:
        current = None
    if current != EVENTS_JSON:
        path.write_bytes(EVENTS_JSON)
        print("  events.json rewritten from the xlsx — commit it so the deployed site matches")
    en_path = WATCH_DIR / "events-en.json"
    if not en_path.exists() or en_path.read_bytes() != EVENTS_EN_JSON:
        en_path.write_bytes(EVENTS_EN_JSON)
        print("  events-en.json rewritten from the xlsx")
    ar_path = WATCH_DIR / "events-ar.json"
    if not ar_path.exists() or ar_path.read_bytes() != EVENTS_AR_JSON:
        ar_path.write_bytes(EVENTS_AR_JSON)
        print("  events-ar.json rewritten from the xlsx")

_sync_static_events()

# ---------------------------------------------------------------- harness bus --
# Dev-only message relay for the `_debug-*.js` harness panels. BroadcastChannel only
# reaches tabs in the SAME browser, so it cannot carry a panel on the laptop driving
# the page on a phone — this endpoint does, by making the LAN server the middleman.
# Purely in-memory, dev-only, and it disappears with the harnesses.
BUS_LOCK = threading.Condition()
BUS_LOG = []            # [{"i": seq, "ch": str, "from": str, "msg": {...}}]
BUS_SEQ = 0
BUS_KEEP = 400          # ring cap — a client that falls this far behind resyncs
BUS_WAIT = 25           # seconds a long-poll parks before answering empty


def bus_post(entry):
    global BUS_SEQ
    with BUS_LOCK:
        BUS_SEQ += 1
        entry["i"] = BUS_SEQ
        BUS_LOG.append(entry)
        del BUS_LOG[:-BUS_KEEP]
        BUS_LOCK.notify_all()


def bus_read(since):
    """Long-poll. since < 0 means 'from now on' — it returns the cursor immediately
    rather than replaying a backlog of stale state into a freshly opened panel."""
    deadline = time.time() + BUS_WAIT
    with BUS_LOCK:
        if since < 0:
            return {"n": BUS_SEQ, "msgs": []}
        while True:
            msgs = [e for e in BUS_LOG if e["i"] > since]
            if msgs:
                return {"n": msgs[-1]["i"], "msgs": msgs}
            left = deadline - time.time()
            if left <= 0:
                return {"n": max(since, BUS_SEQ), "msgs": []}
            BUS_LOCK.wait(left)


class Handler(http.server.SimpleHTTPRequestHandler):
    # Keep-alive. The default HTTP/1.0 closes the socket after every response, so
    # each harness-panel click paid for a fresh TCP handshake — cheap on loopback,
    # not cheap over Wi-Fi to a phone. Every response here sets Content-Length.
    protocol_version = "HTTP/1.1"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WATCH_DIR), **kwargs)

    def _json(self, payload):
        body = json.dumps(payload).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        route = self.path.split("?")[0]
        n = int(self.headers.get("Content-Length") or 0)
        try:
            entry = json.loads(self.rfile.read(n) or b"{}")
        except ValueError:
            self.send_error(400)
            return
        if route == "/__bus__":
            bus_post({"ch": entry.get("ch", ""), "from": entry.get("from", ""),
                      "msg": entry.get("msg")})
            self._json({"ok": True})
        elif route == "/__copy__":
            # The panel's Copy button, mirrored: the payload also lands in
            # _debug-copy.json so Claude sees it on its next message without
            # the user pasting. Newest last; the hook empties it after reading.
            self._json({"ok": True, "queued": copy_queue(entry)})
        elif route == "/__flags__":
            # The misclassified-dot list, written straight to disk so a refresh,
            # a cleared cache or another browser cannot lose it.
            self._json({"ok": True, "n": flags_write(entry)})
        elif route == "/__trash__":
            # The harness panel's Delete button. Nothing is deleted here: the
            # request is queued in _debug-trash.json, which a Claude Code hook
            # shows Claude at the start of every message, so the harness file,
            # its <script> tag and its docs all go together, from the repo side.
            self._json({"ok": True, "queued": trash_queue(entry)})
        else:
            self.send_error(404)

    def do_GET(self):
        if self.path.split("?")[0] == "/__bus__":
            q = self.path.split("?", 1)[1] if "?" in self.path else ""
            since = -1
            for part in q.split("&"):
                if part.startswith("since="):
                    try:
                        since = int(part[6:])
                    except ValueError:
                        since = -1
            self._json(bus_read(since))
        elif self.path == "/__flags__":
            self._json(flags_read())
        elif self.path == "/__harnesses__":
            # The harness files index.html loads RIGHT NOW, from disk. The
            # panel hides any row whose file is not in this list, so a page tab
            # loaded before a deletion (auto-reload is off) cannot keep a
            # deleted harness on screen by still announcing it.
            self._json({"files": _harness_files()})
        elif self.path == "/__who__":
            # WHO IS THIS SERVER — the harness panel tab shows it next to the
            # buttons, so a panel driving one of several worktrees says which
            # chat's work it is editing. One worktree per chat is the setup
            # (see wiki/Dev-Workflow.md), which makes the branch that identity.
            self._json({"branch": _git_branch(), "dir": WATCH_DIR.name, "port": PORT})
        elif self.path == "/__mtime__":
            self._json({"t": last_modified})
        elif self.path == "/events.json":
            # Raw bytes, not _json's re-encode — but Content-Length is mandatory
            # now that keep-alive is on, or the client waits for an EOF that the
            # reused connection never sends.
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(EVENTS_JSON)))
            self.end_headers()
            self.wfile.write(EVENTS_JSON)
        else:
            super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass

TRASH = WATCH_DIR / "_debug-trash.json"


def trash_queue(entry):
    """Append a harness-deletion request; one line per harness, keyed by file."""
    try:
        q = json.loads(TRASH.read_text()) if TRASH.exists() else []
    except ValueError:
        q = []
    rec = {"file": entry.get("file"), "title": entry.get("title"),
           "label": entry.get("label"), "fold": entry.get("fold"),
           "when": time.strftime("%Y-%m-%d %H:%M")}
    q = [r for r in q if r.get("file") != rec["file"] or r.get("title") != rec["title"]]
    q.append(rec)
    TRASH.write_text(json.dumps(q, ensure_ascii=False, indent=1) + "\n")
    return q


FLAGS = WATCH_DIR / "_debug-misclassified.json"


def flags_write(entry):
    """The whole flagged-dot list, replaced wholesale.

    localStorage would be lost to a cleared cache, a different browser, or a
    phone — and this list is research, gathered over sessions, not a knob that
    can be re-tuned in a minute. On disk it also means Claude can just read it
    instead of the user pasting a hundred row ids.
    """
    rows = entry.get("rows")
    if not isinstance(rows, list):
        return 0
    FLAGS.write_text(json.dumps(
        {"when": time.strftime("%Y-%m-%d %H:%M"), "rows": rows},
        ensure_ascii=False, indent=1) + "\n")
    return len(rows)


def flags_read():
    try:
        return json.loads(FLAGS.read_text()) if FLAGS.exists() else {"rows": []}
    except ValueError:
        return {"rows": []}


COPYQ = WATCH_DIR / "_debug-copy.json"


def copy_queue(entry):
    """Append a Copy payload; one entry per press, same harness replaces its older one."""
    try:
        q = json.loads(COPYQ.read_text()) if COPYQ.exists() else []
    except ValueError:
        q = []
    rec = {"from": entry.get("from"), "label": entry.get("label"), "fold": entry.get("fold"),
           "file": entry.get("file"), "when": time.strftime("%Y-%m-%d %H:%M"),
           "text": entry.get("text", "")}
    q = [r for r in q if r.get("from") != rec["from"]]
    q.append(rec)
    COPYQ.write_text(json.dumps(q, ensure_ascii=False, indent=1) + "\n")
    return len(q)


def _harness_files():
    try:
        html = (WATCH_DIR / "index.html").read_text()
    except OSError:
        return []
    # Either form index.html has used: a plain <script src="_debug-x.js"> tag,
    # or a name in the dev-host-only loader's array ("_debug-x.js" strings the
    # inline script document.write()s) — the latter is what it uses now, so a
    # tag-only scan came back empty and the panel hid every harness.
    names = re.findall(r'["\'](_debug-[A-Za-z0-9_.-]+\.js)["\']', html)
    seen, out = set(), []
    for f in names:
        if f in seen or not (WATCH_DIR / f).exists():
            continue
        seen.add(f); out.append(f)
    return out


def _git_branch():
    try:
        import subprocess
        return subprocess.run(["git", "rev-parse", "--abbrev-ref", "HEAD"],
                              cwd=str(WATCH_DIR), capture_output=True, text=True,
                              timeout=2).stdout.strip() or None
    except Exception:
        return None


def _lan_ip():
    """The address a phone on the same Wi-Fi can reach. The UDP socket picks the
    interface the default route uses without sending a packet."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


threading.Thread(target=watch, daemon=True).start()
# ThreadingHTTPServer, not HTTPServer: /__bus__ long-polls park for up to 25s and a
# single-threaded server would stall every other request behind them.
# `--port 0` asks the OS for a free port — one server per git worktree / chat, so
# an edit in one worktree never reloads another's tabs (see wiki/Dev-Workflow.md).
_srv = http.server.ThreadingHTTPServer(("", PORT), Handler)
PORT = _srv.server_address[1]
print(f"Serving at http://localhost:{PORT}  "
      f"(auto-reload on: {', '.join(WATCH_ONLY) if WATCH_ONLY else 'all html/css/js'})")
_ip = _lan_ip()
if _ip:
    print(f"  on your phone (same Wi-Fi):  http://{_ip}:{PORT}/")
    print(f"  harness panel tab:           http://{_ip}:{PORT}/_debug-panel.html")
_srv.serve_forever()
