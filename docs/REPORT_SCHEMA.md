# ChronoStudy report payload (v1)

Produced by `buildReport()` in `src/reports.js`. Exported as `.xlsx`, CSV, or POSTed as JSON to a
user-supplied **Google Apps Script web-app URL** (`https://script.google.com/macros/s/.../exec`).

## Transport

- `POST <url>`, body = JSON string, `Content-Type: text/plain;charset=utf-8` (avoids a CORS preflight,
  which Apps Script cannot answer). In `doPost(e)` parse with `JSON.parse(e.postData.contents)`.
- If the browser blocks reading the response, the app retries with `mode: 'no-cors'` (opaque; success
  can't be confirmed client-side). Return JSON like `{"ok":true}` from the script when possible.

## Schema

```json
{
  "version": 1,
  "period": { "type": "week", "start": "2026-11-09", "end": "2026-11-15" },
  "totals": { "minutes": 540, "sessions": 9, "tasksDone": 4 },
  "byTrack": [ { "name": "string", "minutes": 300, "sessions": 5 } ],
  "daily": [ { "date": "2026-11-09", "minutes": 60 } ],
  "sessions": [
    { "date": "2026-11-09", "start": "09:00", "end": "10:00", "track": "string",
      "topic": "string", "rating": 4, "notes": "string" }
  ],
  "tasks": [ { "title": "string", "track": "string", "done": true, "due": "2026-11-12" } ],
  "goals": [ { "track": "string", "targetHoursPerWeek": 5, "actualHours": 4.5 } ]
}
```

## Field notes

| Field | Notes |
|---|---|
| `period.type` | `"week"` (Mon–Sun) or `"month"` (calendar month). `start`/`end` are inclusive local dates `YYYY-MM-DD`. |
| `totals.tasksDone` | Tasks whose completion time falls inside the period. |
| `byTrack` | Sorted by minutes desc. Sessions without a track are grouped under `"Unassigned"`. |
| `daily` | One entry for **every** day in the period (zero-minute days included) – heatmap-ready. |
| `sessions[].start/end` | `HH:MM` local time, or `null` for sessions logged without times. `rating` is 1–5 or `null`. |
| `sessions[].notes` | "what was covered" and free notes joined with ` \| `. |
| `tasks` | Tasks completed in the period plus open tasks due in the period. `due` may be `null`. |
| `goals[].actualHours` | Hours **per week**: for month reports it is `period hours / (days/7)`, so it is directly comparable to `targetHoursPerWeek`. Only tracks with a target are included. |

Track names are used (not ids) so the sheet is self-describing. Unknown future fields must be ignored by
consumers; breaking changes bump `version`.

## Minimal Apps Script receiver

```js
function doPost(e) {
  const r = JSON.parse(e.postData.contents);
  if (r.version !== 1) return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'version' }))
    .setMimeType(ContentService.MimeType.JSON);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('Sessions') || ss.insertSheet('Sessions');
  r.sessions.forEach(s => sh.appendRow([s.date, s.start, s.end, s.track, s.topic, s.rating, s.notes]));
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}
```
