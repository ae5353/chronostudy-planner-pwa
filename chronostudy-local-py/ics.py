"""Minimal ICS parser/exporter + importer with auto-refresh."""
import threading
import time
import urllib.request
from datetime import date, datetime, timedelta, timezone

WD = {"MO": 0, "TU": 1, "WE": 2, "TH": 3, "FR": 4, "SA": 5, "SU": 6}


def unfold(text):
    lines = []
    for ln in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        if ln[:1] in (" ", "\t") and lines:
            lines[-1] += ln[1:]
        else:
            lines.append(ln)
    return lines


def unescape(v):
    return v.replace("\\n", "\n").replace("\\N", "\n").replace("\\,", ",").replace("\\;", ";").replace("\\\\", "\\")


def escape(v):
    return (v or "").replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def parse_dt(value, params=None):
    """Return (datetime in local naive time, all_day)."""
    value = value.strip()
    if len(value) == 8:
        d = datetime.strptime(value, "%Y%m%d")
        return d, True
    if value.endswith("Z"):
        dt = datetime.strptime(value, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
        return dt.astimezone().replace(tzinfo=None), False
    # floating / TZID: treated as local time (TZID not converted - stdlib only, no tz database guarantee)
    return datetime.strptime(value, "%Y%m%dT%H%M%S"), False


def parse_ics(text, horizon_days=366):
    """Parse VEVENTs into dicts {uid,title,start,end}; expands simple DAILY/WEEKLY/MONTHLY RRULEs."""
    events = []
    cur = None
    for ln in unfold(text):
        if ln == "BEGIN:VEVENT":
            cur = {}
        elif ln == "END:VEVENT" and cur is not None:
            ev = _finish(cur, horizon_days)
            events.extend(ev)
            cur = None
        elif cur is not None and ":" in ln:
            head, val = ln.split(":", 1)
            parts = head.split(";")
            cur[parts[0].upper()] = (val, dict(p.split("=", 1) for p in parts[1:] if "=" in p))
    return events


def _finish(c, horizon_days):
    if "DTSTART" not in c:
        return []
    try:
        start, allday = parse_dt(*c["DTSTART"])
        if "DTEND" in c:
            end, _ = parse_dt(*c["DTEND"])
        else:
            end = start + (timedelta(days=1) if allday else timedelta(0))
    except ValueError:
        return []
    uid = c.get("UID", ("",))[0]
    title = unescape(c.get("SUMMARY", ("(no title)",))[0])
    dur = end - start
    starts = [start]
    exdates = set()
    if "EXDATE" in c:
        for v in c["EXDATE"][0].split(","):
            try:
                exdates.add(parse_dt(v)[0])
            except ValueError:
                pass
    if "RRULE" in c:
        starts = _expand(start, c["RRULE"][0], horizon_days)
    out = []
    for i, s in enumerate(starts):
        if s in exdates:
            continue
        e = s + dur
        out.append({"uid": uid if i == 0 else "%s#%s" % (uid, s.strftime("%Y%m%dT%H%M%S")), "title": title,
                    "start": s.strftime("%Y-%m-%d") if allday else s.strftime("%Y-%m-%dT%H:%M:%S"),
                    "end": (e.strftime("%Y-%m-%d") if allday else e.strftime("%Y-%m-%dT%H:%M:%S")),
                    "all_day": allday})
    return out


def _expand(start, rule, horizon_days):
    r = dict(p.split("=", 1) for p in rule.split(";") if "=" in p)
    freq = r.get("FREQ", "")
    interval = int(r.get("INTERVAL", 1))
    count = int(r["COUNT"]) if "COUNT" in r else None
    until = None
    if "UNTIL" in r:
        try:
            until = parse_dt(r["UNTIL"])[0]
            if len(r["UNTIL"]) == 8:
                until += timedelta(days=1)
        except ValueError:
            pass
    limit = datetime.now() + timedelta(days=horizon_days)
    byday = [WD[x[-2:]] for x in r.get("BYDAY", "").split(",") if x[-2:] in WD]
    out = []
    if freq == "WEEKLY":
        base = start - timedelta(days=start.weekday())
        wk = 0
        days = byday or [start.weekday()]
        while True:
            for d in sorted(days):
                s = base + timedelta(weeks=wk * interval, days=d)
                if s < start:
                    continue
                if (until and s > until) or s > limit or (count and len(out) >= count):
                    return out
                out.append(s)
            wk += 1
            if wk > 5000:
                return out
    elif freq in ("DAILY", "MONTHLY", "YEARLY"):
        n = 0
        while n < 5000:
            if freq == "DAILY":
                s = start + timedelta(days=n * interval)
            else:
                months = n * interval * (12 if freq == "YEARLY" else 1)
                y, m = start.year + (start.month - 1 + months) // 12, (start.month - 1 + months) % 12 + 1
                try:
                    s = start.replace(year=y, month=m)
                except ValueError:
                    n += 1
                    continue
            if (until and s > until) or s > limit or (count and len(out) >= count):
                break
            out.append(s)
            n += 1
        return out
    return [start]


def import_events(db, events, source):
    """Replace all events from `source` with the given list. Returns count."""
    with db.lock:
        db.conn.execute("DELETE FROM events WHERE source=?", (source,))
        for e in events:
            db.conn.execute("INSERT INTO events(uid,title,start,end,source) VALUES(?,?,?,?,?)",
                            (e["uid"], e["title"], e["start"], e["end"], source))
        db.conn.commit()
    return len(events)


def fetch_url(url, timeout=30):
    if url.startswith("webcal://"):
        url = "https://" + url[9:]
    if not url.startswith(("http://", "https://")):
        raise ValueError("invalid URL")
    with urllib.request.urlopen(url, timeout=timeout) as r:
        return r.read(10_000_000).decode("utf-8", "replace")


def refresh_source(db, src, fetcher=fetch_url):
    try:
        n = import_events(db, parse_ics(fetcher(src["url"])), "ics:" + src["url"])
        status = "ok: %d events" % n
    except Exception as ex:  # noqa
        status = "error: %s" % ex
    db.x("UPDATE ics_sources SET last_refresh=?, last_status=? WHERE id=?", (time.time(), status, src["id"]))
    return status


def start_refresh_thread(db, stop_event, interval_s=None):
    def loop():
        while not stop_event.wait(60):
            val = db.get_setting("ics_refresh_minutes", 60)
            iv = interval_s or float(val if val is not None else 60) * 60
            for src in db.q("SELECT * FROM ics_sources"):
                if time.time() - (src["last_refresh"] or 0) >= iv:
                    refresh_source(db, src)
    t = threading.Thread(target=loop, daemon=True, name="ics-refresh")
    t.start()
    return t


def export_feed(db, weeks_ahead=8, weeks_back=1):
    """Build an ICS feed with local events, weekly program, sessions and dated tasks."""
    today = date.today()
    s, e = today - timedelta(weeks=weeks_back), today + timedelta(weeks=weeks_ahead)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ChronoStudy//EN", "CALSCALE:GREGORIAN",
         "X-WR-CALNAME:ChronoStudy"]
    for it in db.calendar(s, e):
        if it["kind"] == "event" and str(it.get("source", "")).startswith("ics:"):
            continue  # don't re-export imported feeds
        if it["kind"] == "task":
            L += ["BEGIN:VTODO", "UID:task-%s@chronostudy" % it["id"], "DTSTAMP:" + stamp,
                  "SUMMARY:" + escape(it["title"]), "DUE;VALUE=DATE:" + it["start"][:10].replace("-", ""),
                  "STATUS:" + ("COMPLETED" if it.get("done") else "NEEDS-ACTION"), "END:VTODO"]
            continue
        L += ["BEGIN:VEVENT", "UID:%s-%s-%s@chronostudy" % (it["kind"], it["id"], it["start"]), "DTSTAMP:" + stamp,
              "SUMMARY:" + escape(it["title"])]
        if len(it["start"]) == 10:
            L.append("DTSTART;VALUE=DATE:" + it["start"].replace("-", ""))
            if it.get("end") and len(it["end"]) == 10:
                L.append("DTEND;VALUE=DATE:" + it["end"].replace("-", ""))
        else:
            L.append("DTSTART:" + it["start"].replace("-", "").replace(":", ""))
            if it.get("end") and len(it["end"]) > 10:
                L.append("DTEND:" + it["end"].replace("-", "").replace(":", ""))
        L.append("END:VEVENT")
    L.append("END:VCALENDAR")
    return "\r\n".join(L) + "\r\n"
