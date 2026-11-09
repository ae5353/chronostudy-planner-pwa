"""SQLite data layer for ChronoStudy (stdlib only)."""
import glob
import json
import os
import sqlite3
import threading
import time
from datetime import date, datetime, timedelta

SCHEMA = """
CREATE TABLE IF NOT EXISTS tracks(
  id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL, color TEXT DEFAULT '#4f8cff',
  target_hours_week REAL DEFAULT 0);
CREATE TABLE IF NOT EXISTS sessions(
  id INTEGER PRIMARY KEY, track_id INTEGER REFERENCES tracks(id) ON DELETE SET NULL,
  topic TEXT DEFAULT '', start_ts REAL NOT NULL, end_ts REAL,
  paused_total REAL DEFAULT 0, paused_at REAL,
  state TEXT DEFAULT 'running', rating INTEGER, notes TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS notes(
  id INTEGER PRIMARY KEY, track_id INTEGER REFERENCES tracks(id) ON DELETE SET NULL,
  topic TEXT DEFAULT '', text TEXT DEFAULT '', progress INTEGER DEFAULT 0, created_ts REAL);
CREATE TABLE IF NOT EXISTS program(
  id INTEGER PRIMARY KEY, track_id INTEGER REFERENCES tracks(id) ON DELETE SET NULL,
  title TEXT DEFAULT '', weekday INTEGER NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS events(
  id INTEGER PRIMARY KEY, uid TEXT, title TEXT NOT NULL, start TEXT NOT NULL, end TEXT,
  track_id INTEGER REFERENCES tracks(id) ON DELETE SET NULL, source TEXT DEFAULT 'local');
CREATE TABLE IF NOT EXISTS tasks(
  id INTEGER PRIMARY KEY, title TEXT NOT NULL, track_id INTEGER REFERENCES tracks(id) ON DELETE SET NULL,
  priority INTEGER DEFAULT 2, due TEXT, tags TEXT DEFAULT '', parent_id INTEGER,
  done INTEGER DEFAULT 0, done_ts REAL, recur TEXT DEFAULT '', created_ts REAL);
CREATE TABLE IF NOT EXISTS settings(k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS ics_sources(
  id INTEGER PRIMARY KEY, url TEXT UNIQUE NOT NULL, last_refresh REAL, last_status TEXT DEFAULT '');
"""

TABLE_COLS = {
    "tracks": ["name", "color", "target_hours_week"],
    "notes": ["track_id", "topic", "text", "progress"],
    "program": ["track_id", "title", "weekday", "start_time", "end_time"],
    "events": ["uid", "title", "start", "end", "track_id", "source"],
    "tasks": ["title", "track_id", "priority", "due", "tags", "parent_id", "recur"],
}


def default_home():
    return os.environ.get("CHRONOSTUDY_HOME") or os.path.join(os.path.expanduser("~"), ".chronostudy-py")


def fmt_dt(ts):
    return datetime.fromtimestamp(ts).strftime("%Y-%m-%dT%H:%M:%S")


def init_db(path=None):
    """Convenience factory function to instantiate and initialize the SQLite DB."""
    return DB(path=path)


class DB:
    def __init__(self, path=None):
        if path is None:
            home = default_home()
            os.makedirs(home, exist_ok=True)
            path = os.path.join(home, "data.db")
        self.path = path
        self.lock = threading.RLock()
        self.conn = sqlite3.connect(path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys=ON")
        self.conn.executescript(SCHEMA)
        self.conn.commit()

    # ---- helpers
    def q(self, sql, args=()):
        with self.lock:
            return [dict(r) for r in self.conn.execute(sql, args).fetchall()]

    def one(self, sql, args=()):
        r = self.q(sql, args)
        return r[0] if r else None

    def x(self, sql, args=()):
        with self.lock:
            cur = self.conn.execute(sql, args)
            self.conn.commit()
            return cur.lastrowid

    # ---- generic CRUD
    def insert(self, table, data):
        cols = [c for c in TABLE_COLS[table] if c in data]
        if table == "tasks" or table == "notes":
            cols.append("created_ts")
            data = dict(data, created_ts=time.time())
        if table == "tasks" and "tags" in data and isinstance(data["tags"], list):
            data["tags"] = ",".join(data["tags"])
        sql = "INSERT INTO %s(%s) VALUES(%s)" % (table, ",".join(cols), ",".join("?" * len(cols)))
        return self.x(sql, [data[c] for c in cols])

    def update(self, table, id_, data):
        cols = [c for c in TABLE_COLS[table] if c in data]
        if table == "tasks" and isinstance(data.get("tags"), list):
            data = dict(data, tags=",".join(data["tags"]))
        if "done" in data and table == "tasks":
            cols.append("done")
        if not cols:
            return
        self.x("UPDATE %s SET %s WHERE id=?" % (table, ",".join(c + "=?" for c in cols)),
               [data[c] for c in cols] + [id_])

    def delete(self, table, id_):
        self.x("DELETE FROM %s WHERE id=?" % table, (id_,))

    def get_tracks(self):
        return self.q("SELECT * FROM tracks ORDER BY name")

    def track_id_by_name(self, name, create=False):
        if not name:
            return None
        r = self.one("SELECT id FROM tracks WHERE name=?", (name,))
        if r:
            return r["id"]
        return self.insert("tracks", {"name": name}) if create else None

    # ---- settings
    def get_setting(self, k, default=None):
        r = self.one("SELECT v FROM settings WHERE k=?", (k,))
        return json.loads(r["v"]) if r else default

    def set_setting(self, k, v):
        self.x("INSERT INTO settings(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v",
               (k, json.dumps(v)))

    # ---- sessions (server-side timer)
    @staticmethod
    def active_seconds(s, now=None):
        now = now or time.time()
        end = s["end_ts"] or now
        paused = s["paused_total"] or 0
        if s["state"] == "paused" and s["paused_at"]:
            paused += now - s["paused_at"]
        return max(0.0, end - s["start_ts"] - paused)

    def active_session(self):
        s = self.one("SELECT * FROM sessions WHERE state IN ('running','paused') ORDER BY id DESC LIMIT 1")
        if s:
            s["elapsed"] = self.active_seconds(s)
        return s

    def start_session(self, track_id=None, topic=""):
        if self.active_session():
            raise ValueError("a session is already active")
        return self.x("INSERT INTO sessions(track_id,topic,start_ts,state) VALUES(?,?,?, 'running')",
                      (track_id, topic, time.time()))

    def pause_session(self):
        s = self.active_session()
        if not s or s["state"] != "running":
            raise ValueError("no running session")
        self.x("UPDATE sessions SET state='paused', paused_at=? WHERE id=?", (time.time(), s["id"]))
        return s["id"]

    def resume_session(self):
        s = self.active_session()
        if not s or s["state"] != "paused":
            raise ValueError("no paused session")
        now = time.time()
        self.x("UPDATE sessions SET state='running', paused_total=paused_total+?, paused_at=NULL WHERE id=?",
               (now - s["paused_at"], s["id"]))
        return s["id"]

    def stop_session(self, rating=None, notes=""):
        s = self.active_session()
        if not s:
            raise ValueError("no active session")
        now = time.time()
        pt = s["paused_total"] or 0
        if s["state"] == "paused" and s["paused_at"]:
            pt += now - s["paused_at"]
        self.x("UPDATE sessions SET state='done', end_ts=?, paused_total=?, paused_at=NULL, rating=?, notes=? WHERE id=?",
               (now, pt, rating, notes or "", s["id"]))
        return s["id"]

    def add_manual_session(self, track_id, topic, start_ts, end_ts, rating=None, notes=""):
        if end_ts <= start_ts:
            raise ValueError("end must be after start")
        return self.x("INSERT INTO sessions(track_id,topic,start_ts,end_ts,state,rating,notes) VALUES(?,?,?,?, 'done',?,?)",
                      (track_id, topic, start_ts, end_ts, rating, notes))

    def update_session(self, id_, data):
        cols = [c for c in ("track_id", "topic", "rating", "notes", "start_ts", "end_ts") if c in data]
        if cols:
            self.x("UPDATE sessions SET %s WHERE id=?" % ",".join(c + "=?" for c in cols),
                   [data[c] for c in cols] + [id_])

    def sessions_between(self, start_d, end_d):
        """Sessions whose start falls on a local date in [start_d, end_d] (inclusive)."""
        a = datetime.combine(start_d, datetime.min.time()).timestamp()
        b = datetime.combine(end_d + timedelta(days=1), datetime.min.time()).timestamp()
        rows = self.q("""SELECT s.*, t.name AS track FROM sessions s LEFT JOIN tracks t ON t.id=s.track_id
                         WHERE s.start_ts>=? AND s.start_ts<? ORDER BY s.start_ts""", (a, b))
        for r in rows:
            r["seconds"] = self.active_seconds(r)
        return rows

    # ---- tasks
    def get_tasks(self, include_done=True):
        rows = self.q("""SELECT k.*, t.name AS track FROM tasks k LEFT JOIN tracks t ON t.id=k.track_id
                         ORDER BY k.done, k.priority, COALESCE(k.due,'9999'), k.id""")
        for r in rows:
            r["tags"] = [x for x in (r["tags"] or "").split(",") if x]
            r["done"] = bool(r["done"])
        return rows if include_done else [r for r in rows if not r["done"]]

    def complete_task(self, id_, done=True):
        t = self.one("SELECT * FROM tasks WHERE id=?", (id_,))
        if not t:
            raise KeyError(id_)
        self.x("UPDATE tasks SET done=?, done_ts=? WHERE id=?", (1 if done else 0, time.time() if done else None, id_))
        new_id = None
        if done and not t["done"] and t["recur"] in ("daily", "weekly", "monthly") and not t["parent_id"]:
            new_id = self.insert("tasks", {
                "title": t["title"], "track_id": t["track_id"], "priority": t["priority"],
                "due": next_due(t["due"], t["recur"]), "tags": t["tags"], "recur": t["recur"]})
            # clone subtasks as undone
            for st in self.q("SELECT * FROM tasks WHERE parent_id=?", (id_,)):
                self.insert("tasks", {"title": st["title"], "track_id": st["track_id"], "priority": st["priority"],
                                      "tags": st["tags"], "parent_id": new_id})
        return new_id

    # ---- calendar
    def program_occurrences(self, start_d, end_d):
        out = []
        prog = self.q("SELECT p.*, t.name AS track FROM program p LEFT JOIN tracks t ON t.id=p.track_id")
        d = start_d
        while d <= end_d:
            for p in prog:
                if p["weekday"] == d.weekday():
                    out.append({"kind": "program", "id": p["id"], "title": p["title"] or p["track"] or "Study",
                                "track": p["track"], "track_id": p["track_id"],
                                "start": "%sT%s:00" % (d.isoformat(), p["start_time"]),
                                "end": "%sT%s:00" % (d.isoformat(), p["end_time"])})
            d += timedelta(days=1)
        return out

    def calendar(self, start_d, end_d):
        items = self.program_occurrences(start_d, end_d)
        ev = self.q("""SELECT e.*, t.name AS track FROM events e LEFT JOIN tracks t ON t.id=e.track_id
                       WHERE substr(e.start,1,10)>=? AND substr(e.start,1,10)<=?""",
                    (start_d.isoformat(), end_d.isoformat()))
        for e in ev:
            items.append({"kind": "event", "id": e["id"], "title": e["title"], "start": e["start"],
                          "end": e["end"], "track": e["track"], "source": e["source"]})
        for s in self.sessions_between(start_d, end_d):
            items.append({"kind": "session", "id": s["id"], "title": (s["track"] or "Study") + (": " + s["topic"] if s["topic"] else ""),
                          "start": fmt_dt(s["start_ts"]),
                          "end": fmt_dt(s["end_ts"]) if s["end_ts"] else None, "track": s["track"]})
        for t in self.get_tasks():
            if t["due"] and start_d.isoformat() <= t["due"][:10] <= end_d.isoformat():
                items.append({"kind": "task", "id": t["id"], "title": t["title"], "start": t["due"],
                              "end": None, "done": t["done"], "track": t["track"]})
        items.sort(key=lambda i: i["start"])
        return items

    # ---- backups
    def backup(self, backup_dir=None, keep=14, force=False):
        backup_dir = backup_dir or os.path.join(os.path.dirname(self.path), "backups")
        os.makedirs(backup_dir, exist_ok=True)
        dest = os.path.join(backup_dir, "data-%s.db" % date.today().strftime("%Y%m%d"))
        if os.path.exists(dest) and not force:
            return None
        with self.lock:
            dst = sqlite3.connect(dest)
            self.conn.backup(dst)
            dst.close()
        for old in sorted(glob.glob(os.path.join(backup_dir, "data-*.db")))[:-keep]:
            os.remove(old)
        return dest


def next_due(due, recur):
    d = datetime.strptime(due[:10], "%Y-%m-%d").date() if due else date.today()
    if recur == "daily":
        d += timedelta(days=1)
    elif recur == "weekly":
        d += timedelta(days=7)
    else:
        y, m = (d.year + (d.month // 12), d.month % 12 + 1)
        day = d.day
        while True:
            try:
                d = date(y, m, day)
                break
            except ValueError:
                day -= 1
    return d.isoformat()
