"""Weekly/monthly reports: JSON, CSV, printable HTML, and Google Apps Script push."""
import csv
import calendar as _cal
import html
import io
import json
import urllib.request
from datetime import date, datetime, timedelta

from db import fmt_dt


def period_bounds(ptype, ref):
    """Return (start, end) inclusive dates for the week (Mon-Sun) or month containing ref."""
    if ptype == "week":
        s = ref - timedelta(days=ref.weekday())
        return s, s + timedelta(days=6)
    if ptype == "month":
        s = ref.replace(day=1)
        return s, ref.replace(day=_cal.monthrange(ref.year, ref.month)[1])
    raise ValueError("type must be week or month")


def build_report(db, ptype="week", ref=None):
    ref = ref or date.today()
    start, end = period_bounds(ptype, ref)
    sessions = [s for s in db.sessions_between(start, end) if s["state"] == "done"]
    tracks = {}
    daily = {}
    d = start
    while d <= end:
        daily[d.isoformat()] = 0.0
        d += timedelta(days=1)
    for s in sessions:
        name = s["track"] or "(none)"
        m = s["seconds"] / 60.0
        t = tracks.setdefault(name, {"name": name, "minutes": 0.0, "sessions": 0})
        t["minutes"] += m
        t["sessions"] += 1
        k = datetime.fromtimestamp(s["start_ts"]).date().isoformat()
        daily[k] = daily.get(k, 0.0) + m
    tasks = []
    for t in db.get_tasks():
        due_in = t["due"] and start.isoformat() <= t["due"][:10] <= end.isoformat()
        done_in = t["done"] and datetime.fromtimestamp(t["done_ts"] or 0).date().isoformat() >= start.isoformat() \
            and datetime.fromtimestamp(t["done_ts"] or 0).date().isoformat() <= end.isoformat()
        if due_in or done_in:
            tasks.append({"title": t["title"], "track": t["track"] or "", "done": t["done"], "due": (t["due"] or "")[:10]})
    weeks = ((end - start).days + 1) / 7.0
    goals = []
    for tr in db.get_tracks():
        if tr["target_hours_week"]:
            mins = tracks.get(tr["name"], {"minutes": 0})["minutes"]
            goals.append({"track": tr["name"], "targetHoursPerWeek": tr["target_hours_week"],
                          "actualHours": round(mins / 60.0 / weeks, 2)})  # average hours per week
    return {
        "version": 1,
        "period": {"type": ptype, "start": start.isoformat(), "end": end.isoformat()},
        "totals": {"minutes": round(sum(s["seconds"] for s in sessions) / 60.0, 1), "sessions": len(sessions),
                   "tasksDone": sum(1 for t in tasks if t["done"])},
        "byTrack": [dict(t, minutes=round(t["minutes"], 1)) for t in sorted(tracks.values(), key=lambda x: -x["minutes"])],
        "daily": [{"date": k, "minutes": round(v, 1)} for k, v in sorted(daily.items())],
        "sessions": [{"date": datetime.fromtimestamp(s["start_ts"]).date().isoformat(),
                      "start": fmt_dt(s["start_ts"]), "end": fmt_dt(s["end_ts"]),
                      "track": s["track"] or "", "topic": s["topic"] or "", "rating": s["rating"],
                      "notes": s["notes"] or ""} for s in sessions],
        "tasks": tasks,
        "goals": goals,
    }


def report_csv(rep):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["date", "start", "end", "track", "topic", "rating", "notes"])
    for s in rep["sessions"]:
        w.writerow([s["date"], s["start"], s["end"], s["track"], s["topic"],
                    "" if s["rating"] is None else s["rating"], s["notes"]])
    return buf.getvalue()


def report_html(rep):
    e = html.escape
    p = rep["period"]
    rows = "".join("<tr><td>%s</td><td>%.0f</td><td>%d</td></tr>" % (e(t["name"]), t["minutes"], t["sessions"]) for t in rep["byTrack"])
    mx = max([d["minutes"] for d in rep["daily"]] + [1])
    bars = "".join('<div class="b"><div style="height:%dpx"></div><span>%s</span></div>' % (d["minutes"] / mx * 100, d["date"][-2:]) for d in rep["daily"])
    ses = "".join("<tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>" % (
        e(s["date"]), e(s["track"]), e(s["topic"]), "" if s["rating"] is None else s["rating"], e(s["notes"])) for s in rep["sessions"])
    tsk = "".join("<li>%s %s <small>%s</small></li>" % ("&#9745;" if t["done"] else "&#9744;", e(t["title"]), e(t["due"])) for t in rep["tasks"])
    gl = "".join("<tr><td>%s</td><td>%s</td><td>%s</td></tr>" % (e(g["track"]), g["targetHoursPerWeek"], g["actualHours"]) for g in rep["goals"])
    return """<!doctype html><html><head><meta charset="utf-8"><title>ChronoStudy report</title><style>
body{font-family:sans-serif;max-width:800px;margin:20px auto;padding:0 10px}table{border-collapse:collapse;width:100%%;margin:8px 0}
td,th{border:1px solid #ccc;padding:4px 8px;text-align:left}.c{display:flex;align-items:flex-end;gap:3px;height:120px}
.b{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;font-size:10px}.b div{background:#4f8cff;width:100%%}
@media print{button{display:none}}</style></head><body><button onclick="print()">Print</button>
<h1>Study report (%s)</h1><p>%s &ndash; %s</p><p><b>%.0f min</b> in <b>%d sessions</b>; tasks done: <b>%d</b></p>
<h2>By track</h2><table><tr><th>Track</th><th>Minutes</th><th>Sessions</th></tr>%s</table>
<h2>Daily minutes</h2><div class="c">%s</div>
<h2>Goals (hours/week)</h2><table><tr><th>Track</th><th>Target</th><th>Actual</th></tr>%s</table>
<h2>Sessions</h2><table><tr><th>Date</th><th>Track</th><th>Topic</th><th>Rating</th><th>Notes</th></tr>%s</table>
<h2>Tasks</h2><ul>%s</ul></body></html>""" % (
        e(p["type"]), p["start"], p["end"], rep["totals"]["minutes"], rep["totals"]["sessions"],
        rep["totals"]["tasksDone"], rows, bars, gl, ses, tsk)


def push_report(url, rep, timeout=30):
    """POST the report JSON to a Google Apps Script web-app URL. Returns (status, body)."""
    if not url.startswith(("http://", "https://")):
        raise ValueError("invalid URL")
    req = urllib.request.Request(url, data=json.dumps(rep).encode(), method="POST",
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, r.read(4096).decode("utf-8", "replace")
