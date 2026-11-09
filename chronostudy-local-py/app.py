#!/usr/bin/env python3
"""ChronoStudy local server: REST API + web UI. Stdlib only.

Run:  python app.py [--host 0.0.0.0] [--port 8787]
Env:  CHRONOSTUDY_TOKEN (optional bearer token), CHRONOSTUDY_HOME (data dir)
"""
import argparse
import hmac
import json
import mimetypes
import os
import re
import threading
from datetime import date, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import ics
import reports
from db import DB

STATIC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")


def pdate(s, default=None):
    return datetime.strptime(s[:10], "%Y-%m-%d").date() if s else (default or date.today())


def to_ts(v):
    """Accept epoch number or ISO string (local)."""
    if isinstance(v, (int, float)):
        return float(v)
    return datetime.fromisoformat(v).timestamp()


class HTTPError(Exception):
    def __init__(self, code, msg):
        self.code, self.msg = code, msg


class Handler(BaseHTTPRequestHandler):
    server_version = "ChronoStudy/1.0"
    db = None
    token = None

    def log_message(self, *a):
        if os.environ.get("CHRONOSTUDY_VERBOSE"):
            super().log_message(*a)

    # ---- plumbing
    def send(self, code, body, ctype="application/json", headers=None):
        if isinstance(body, (dict, list)):
            body = json.dumps(body)
        if isinstance(body, str):
            body = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype + ("; charset=utf-8" if ctype.startswith("text") or "json" in ctype else ""))
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def authorized(self, qs):
        if not self.token:
            return True
        h = self.headers.get("Authorization", "")
        given = h[7:] if h.startswith("Bearer ") else (qs.get("token", [""])[0])
        return hmac.compare_digest(given, self.token)

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > 20_000_000:
            raise HTTPError(413, "too large")
        raw = self.rfile.read(n) if n else b""
        if not raw:
            return {}
        try:
            return json.loads(raw)
        except ValueError:
            raise HTTPError(400, "invalid JSON")

    def handle_any(self, method):
        u = urlparse(self.path)
        qs = parse_qs(u.query)
        path = u.path
        try:
            if method == "OPTIONS":
                return self.send(204, b"")
            if not path.startswith("/api/") and path != "/feed.ics":
                return self.static(path)
            if not self.authorized(qs):
                return self.send(401, {"error": "unauthorized"}, headers={"WWW-Authenticate": "Bearer"})
            res = self.route(method, path, qs)
            if res is not None:
                if isinstance(res, tuple):
                    return self.send(*res)
                return self.send(200, res)
        except HTTPError as e:
            return self.send(e.code, {"error": e.msg})
        except (ValueError, KeyError) as e:
            return self.send(400, {"error": str(e)})
        except Exception as e:  # noqa
            return self.send(500, {"error": "%s: %s" % (type(e).__name__, e)})

    do_GET = lambda s: s.handle_any("GET")  # noqa
    do_POST = lambda s: s.handle_any("POST")  # noqa
    do_PUT = lambda s: s.handle_any("PUT")  # noqa
    do_DELETE = lambda s: s.handle_any("DELETE")  # noqa
    do_OPTIONS = lambda s: s.handle_any("OPTIONS")  # noqa

    def static(self, path):
        rel = "index.html" if path in ("/", "") else path.lstrip("/")
        full = os.path.realpath(os.path.join(STATIC, rel))
        if not full.startswith(os.path.realpath(STATIC) + os.sep) or not os.path.isfile(full):
            return self.send(404, {"error": "not found"})
        with open(full, "rb") as f:
            data = f.read()
        self.send(200, data, mimetypes.guess_type(full)[0] or "application/octet-stream")

    # ---- routes
    def route(self, method, path, qs):
        db = self.db
        q1 = lambda k, d=None: qs.get(k, [d])[0]  # noqa
        parts = path.strip("/").split("/")
        if path == "/feed.ics":
            return 200, ics.export_feed(db), "text/calendar"
        res = parts[1] if len(parts) > 1 else ""
        rid = int(parts[2]) if len(parts) > 2 and parts[2].isdigit() else None
        sub = parts[3] if len(parts) > 3 else (parts[2] if len(parts) > 2 and rid is None else "")
        b = self.body() if method in ("POST", "PUT") else {}

        if res == "health":
            return {"ok": True, "auth": bool(self.token), "time": datetime.now().isoformat(timespec="seconds")}

        if res == "tracks":
            if method == "GET":
                return db.get_tracks()
            if method == "POST":
                if not (b.get("name") or "").strip():
                    raise HTTPError(400, "name required")
                try:
                    return {"id": db.insert("tracks", b)}
                except Exception as e:
                    raise HTTPError(409, str(e))
            if method == "PUT" and rid:
                db.update("tracks", rid, b)
                return {"ok": True}
            if method == "DELETE" and rid:
                db.delete("tracks", rid)
                return {"ok": True}

        if res == "sessions":
            if method == "GET" and rid is None and sub == "":
                s, e = pdate(q1("start"), date.min.replace(year=2000)), pdate(q1("end"), date(2999, 1, 1))
                return db.sessions_between(s, e)
            if method == "GET" and sub == "active":
                return {"session": db.active_session()}
            if method == "POST" and sub == "start":
                tid = b.get("track_id")
                if b.get("track"):
                    tid = db.track_id_by_name(b["track"], create=True)
                return {"id": db.start_session(tid, b.get("topic", "")), "session": db.active_session()}
            if method == "POST" and sub in ("pause", "resume"):
                getattr(db, sub + "_session")()
                return {"session": db.active_session()}
            if method == "POST" and sub == "stop":
                sid = db.stop_session(b.get("rating"), b.get("notes", ""))
                return {"id": sid}
            if method == "POST" and rid is None and sub == "":
                tid = b.get("track_id")
                return {"id": db.add_manual_session(tid, b.get("topic", ""), to_ts(b["start"]), to_ts(b["end"]),
                                                    b.get("rating"), b.get("notes", ""))}
            if method == "PUT" and rid:
                for k in ("start_ts", "end_ts"):
                    if k in b:
                        b[k] = to_ts(b[k])
                db.update_session(rid, b)
                return {"ok": True}
            if method == "DELETE" and rid:
                db.delete("sessions", rid)
                return {"ok": True}

        if res in ("notes", "program", "events", "tasks"):
            if res == "tasks" and method == "POST" and sub == "done" and rid:
                return {"next_id": db.complete_task(rid, b.get("done", True))}
            if res == "tasks" and method == "POST" and len(parts) == 4 and parts[3] == "done":
                return {"next_id": db.complete_task(rid, b.get("done", True))}
            if method == "GET":
                if res == "tasks":
                    return db.get_tasks()
                tbl = {"notes": "notes", "program": "program", "events": "events"}[res]
                where, args = "", []
                if res == "notes" and q1("track_id"):
                    where, args = "WHERE x.track_id=?", [int(q1("track_id"))]
                order = {"notes": "x.created_ts DESC", "program": "x.weekday, x.start_time", "events": "x.start"}[res]
                return db.q("SELECT x.*, t.name AS track FROM %s x LEFT JOIN tracks t ON t.id=x.track_id %s ORDER BY %s"
                            % (tbl, where, order), args)
            if method == "POST":
                if res == "tasks" and not (b.get("title") or "").strip():
                    raise HTTPError(400, "title required")
                if b.get("track") and not b.get("track_id"):
                    b["track_id"] = db.track_id_by_name(b["track"], create=False)
                if res == "events" and not b.get("title"):
                    raise HTTPError(400, "title required")
                return {"id": db.insert(res, b)}
            if method == "PUT" and rid:
                if res == "tasks" and "done" in b:
                    db.complete_task(rid, bool(b["done"]))
                    b.pop("done")
                db.update(res, rid, b)
                return {"ok": True}
            if method == "DELETE" and rid:
                if res == "tasks":
                    db.x("DELETE FROM tasks WHERE parent_id=?", (rid,))
                db.delete(res, rid)
                return {"ok": True}

        if res == "calendar" and method == "GET":
            return db.calendar(pdate(q1("start")), pdate(q1("end"), pdate(q1("start"))))

        if res == "report":
            ptype = q1("type", "week")
            if method == "POST" and sub == "push":
                url = b.get("url") or db.get_setting("apps_script_url")
                if not url:
                    raise HTTPError(400, "no Apps Script URL configured")
                rep = reports.build_report(db, b.get("type", "week"), pdate(b.get("date")))
                try:
                    st, body = reports.push_report(url, rep)
                except Exception as e:
                    raise HTTPError(502, "push failed: %s" % e)
                return {"status": st, "response": body}
            if method == "GET":
                rep = reports.build_report(db, ptype, pdate(q1("date")))
                fmt = q1("format", "json")
                if fmt == "csv":
                    return 200, reports.report_csv(rep), "text/csv", {"Content-Disposition": "attachment; filename=report.csv"}
                if fmt == "html":
                    return 200, reports.report_html(rep), "text/html"
                return rep

        if res == "ics":
            if method == "GET" and sub in ("", "sources"):
                return db.q("SELECT * FROM ics_sources")
            if method == "POST" and sub == "import":
                if b.get("url"):
                    url = b["url"]
                    db.x("INSERT OR IGNORE INTO ics_sources(url) VALUES(?)", (url,)) if b.get("subscribe", True) else None
                    src = db.one("SELECT * FROM ics_sources WHERE url=?", (url,))
                    if src:
                        return {"status": ics.refresh_source(db, src)}
                    n = ics.import_events(db, ics.parse_ics(ics.fetch_url(url)), "ics:" + url)
                    return {"status": "ok: %d events" % n}
                if b.get("text"):
                    return {"imported": ics.import_events(db, ics.parse_ics(b["text"]), "ics:upload")}
                raise HTTPError(400, "url or text required")
            if method == "POST" and sub == "refresh":
                return {"results": {s["url"]: ics.refresh_source(db, s) for s in db.q("SELECT * FROM ics_sources")}}
            if method == "DELETE" and rid:
                src = db.one("SELECT * FROM ics_sources WHERE id=?", (rid,))
                if src:
                    db.x("DELETE FROM events WHERE source=?", ("ics:" + src["url"],))
                    db.delete("ics_sources", rid)
                return {"ok": True}

        if res == "settings":
            keys = ("apps_script_url", "ics_refresh_minutes")
            if method == "GET":
                return {k: db.get_setting(k) for k in keys}
            if method == "PUT":
                for k in keys:
                    if k in b:
                        db.set_setting(k, b[k])
                return {"ok": True}

        if res == "backup" and method == "POST":
            return {"path": db.backup(force=True)}

        raise HTTPError(404, "no such route")


def make_server(db, host="127.0.0.1", port=0, token=None):
    h = type("H", (Handler,), {"db": db, "token": token})
    return ThreadingHTTPServer((host, port), h)


def start_backup_thread(db, stop):
    def loop():
        while True:
            try:
                db.backup()
            except Exception as e:  # noqa
                print("backup failed:", e)
            if stop.wait(3600):
                return
    t = threading.Thread(target=loop, daemon=True, name="backup")
    t.start()
    return t


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default=os.environ.get("CHRONOSTUDY_HOST", "0.0.0.0"))
    ap.add_argument("--port", type=int, default=int(os.environ.get("CHRONOSTUDY_PORT", 8787)))
    ap.add_argument("--token", default=os.environ.get("CHRONOSTUDY_TOKEN"))
    a = ap.parse_args()
    db = DB()
    stop = threading.Event()
    start_backup_thread(db, stop)
    ics.start_refresh_thread(db, stop)
    srv = make_server(db, a.host, a.port, a.token)
    print("ChronoStudy on http://%s:%d  data=%s  auth=%s" % (a.host, a.port, db.path, "token" if a.token else "OFF"))
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        stop.set()


if __name__ == "__main__":
    main()
