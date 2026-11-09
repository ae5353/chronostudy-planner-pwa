# StudyLog (minimal)

Session-first study tracker. One giant START/STOP button, a big timer, free-text topics with autocomplete of past ones, a timeline of everything you studied, a tiny to-do list, week heatmap, month calendar and streak. Single `index.html`, no build, no dependencies, works offline, installable as a PWA.

**Live:** https://raw.githack.com/ae5353/studylog-minimal/main/index.html
(GitHub Pages workflow in `.github/workflows/pages.yml` also deploys it once Pages is set to "GitHub Actions". Note: raw.githack serves without the service worker/manifest files, so install-as-app needs the Pages URL.)

## Features
- Timer stores its start timestamp, so it survives reloads and closed tabs.
- At stop: "what I learned", notes, progress slider (0–100).
- Dark/light theme, thumb-friendly layout, responsive desktop grid.
- Data in `localStorage`; JSON export/import (merge, de-duplicated).
- **Export report**: weekly/monthly (this/last) CSV or JSON, or POST to a pasted Google Apps Script URL.

### Report schema
```json
{"version":1,"period":{"type":"week","start":"YYYY-MM-DD","end":"YYYY-MM-DD"},
 "totals":{"minutes":0,"sessions":0,"tasksDone":0},
 "byTrack":[{"name":"","minutes":0,"sessions":0}],
 "daily":[{"date":"","minutes":0}],
 "sessions":[{"date":"","start":"HH:MM","end":"HH:MM","track":"","topic":"","rating":0,"notes":""}],
 "tasks":[{"title":"","track":"","done":false,"due":""}],
 "goals":[]}
```
`track` = the topic you typed; `topic` = the "what I learned" line. The POST is sent as `text/plain` with `no-cors` (Apps Script can't answer CORS preflights), so the browser can't read the reply; your `doPost(e)` should `JSON.parse(e.postData.contents)`.

## Tests
```
node --test tests/logic.test.js
```
Logic lives between `LOGIC:START` / `LOGIC:END` markers in `index.html`; tests extract and evaluate that block.
