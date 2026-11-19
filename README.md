# ChronoStudy — Personal Study Tracker & Planner

A focused, distraction-free study companion designed **PC-first**, responsive for mobile, and built with zero runtime dependencies.

---

## Why ChronoStudy?

Plain stopwatches and separate to-do apps make it difficult to remember **what** you studied, **when**, **for how long**, and **what you learned**.

**ChronoStudy unifies everything in one dashboard:**
1. **Horology Focus Timer & Live Scratchpad**: Start a stopwatch or focus countdown block (with Zen Fullscreen Theater & Picture-in-Picture mini-timer). Type notes, formulas, or questions alongside the timer.
2. **Study Tasks & Backlog**: Track upcoming topics, due dates, and recurring routines (`daily`, `weekdays`, `weekly`, `biweekly`, `triweekly`, `monthly`). Each task links directly into the timer.
3. **Weekly & Monthly Academic Planner**: View course lecture slots, recurring commitments, day-by-day tasks, and logged focus sessions together.
4. **Analytics & Manual Logging**: Inspect weekly history trends, subject hour targets, and session logs, or add offline study sessions via `+ Log Past`.
5. **100% Local-First + Optional E2EE Cloud Sync**: Zero third-party tracking. Sync optionally via Google Drive, Supabase, or offline JSON snapshots with AES-GCM encryption, plus `.json`, `.csv`, and `.ics` exports.

---

## Getting Started

Run ChronoStudy locally using Node.js (required for ES modules & Service Worker; opening `index.html` over `file://` is blocked by browser ES module CORS rules):

```bash
# Start the local server (binds to 127.0.0.1:3000 by default)
npm start

# Run the automated test suite
npm test
```

Open **[http://localhost:3000](http://localhost:3000)** in Chrome, Edge, Firefox, or Safari.
To expose on your LAN for mobile testing, pass `HOST=0.0.0.0 npm start`.

---

## Desktop Keyboard Shortcuts

- `Space`: Start / Pause the active study timer (when not typing or inside a modal).
- `Alt + Shift + F`: Finish current study session (once >= 5s elapsed) and open review modal.
- `Z`: Toggle Zen Focus Theater Mode.
- `Alt + T`: Toggle the Study Tasks drawer.
- `Esc`: Exit Zen mode or close open modals/drawer.

---

## Calming Ambient Sound Generator

Built-in Web Audio API synthesizer runs 100% offline with seamless looped noise textures (**Soft Rain**, **White Noise**, **Gentle Stream**).

---

## Data Backups & Exports

Click **⚙** in the header to:
- **Download Backup (.json)**: Full archive of tasks, courses, events, and sessions.
- **Export Logs to CSV**: UTF-8 BOM & formula-safe CSV for Excel and Google Sheets.
- **Restore from Backup (.json)**: Safely sanitize and restore an exported archive.
- **Calendar Sync (.ics)**: Export tasks, lectures, and recurring events in iCalendar format.
