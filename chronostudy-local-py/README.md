# ChronoStudy Local (Python + SQLite)

A local-first, zero-dependency Python study planner with REST API and web UI. Runs anywhere Python 3 is installed (Windows, Mac, Linux, Android/Termux).

## Features
- **Zero external dependencies**: Built entirely with Python standard library (`http.server`, `sqlite3`, `json`).
- **Web UI & REST API**: Single-page dashboard served directly on `http://localhost:8787`.
- **SQLite Storage**: Sessions, tracks, and tasks stored in local SQLite database.
- **Reports & Calendar**: Built-in CSV/Excel report generation and `.ics` calendar sync endpoints.

## Running
```bash
python app.py --port 8787
```
Open `http://localhost:8787` in your browser.
