# ChronoStudy v2.0 — Multi-Platform Time, Program, Study, Cornell Notes & Task Planner Suite

ChronoStudy v2.0 is a complete, offline-first, multi-platform productivity and academic mastery suite designed for mobile, tablet, desktop, and terminal workflows.

---

## Multi-Platform Ecosystem

| Platform / Target | Entry Point | Capabilities |
| :--- | :--- | :--- |
| **1. Mobile & Desktop PWA** | [index.html](file:///home/antigravity/chronostudy/index.html) + [sw.js](file:///home/antigravity/chronostudy/sw.js) | Installable iOS/Android Home Screen PWA, offline service worker cache, Screen WakeLock API, Lock-Screen MediaSession controls, 6 responsive views. |
| **2. Single-File Mobile Portable App** | [ChronoStudy-Mobile-Portable.html](file:///home/antigravity/chronostudy/ChronoStudy-Mobile-Portable.html) | 100% self-contained single-file HTML bundle (all CSS, state, SM-2, and Web Audio synthesizer inlined). Open directly from Google Drive, iCloud, or local phone storage with zero server required. |
| **3. Terminal / CLI Companion** | [cli/chronostudy-cli.mjs](file:///home/antigravity/chronostudy/cli/chronostudy-cli.mjs) | Zero-dependency Node.js CLI for Linux, macOS, Windows, and Android Termux (`dashboard`, `add`, `auto-schedule`, `grades`, `export-ics`). |
| **4. Self-Hosted Sync & Calendar Server** | [server/sync-server.mjs](file:///home/antigravity/chronostudy/server/sync-server.mjs) + [Dockerfile](file:///home/antigravity/chronostudy/Dockerfile) | Serves the PWA + REST state sync (`/api/state`) + live subscribable RFC-5545 calendar feed (`/api/calendar.ics`) for Apple/Google Calendar. |
| **5. Native iOS / Android Wrapper** | [capacitor.config.json](file:///home/antigravity/chronostudy/capacitor.config.json) | Ready for native iOS & Android compilation via Capacitor (`app.chronostudy.planner`). |

---

## Core v2.0 Capabilities

### 1. Daily Command Center (`Today Hub`)
- **Smart Natural-Language Task Capture**: Type shorthand tokens like `"Prove SVD theorem #MATH-204 !Q1 ~3p @tomorrow"` to automatically assign the course (`MATH-204`), Eisenhower quadrant (`Q1`), Pomodoro estimate (`3`), and due date (`tomorrow`).
- **⚡ Smart Auto-Scheduler (`computeAutoScheduleBlocks`)**: Automatically finds open gaps (`>= 45m`) in your daily schedule between `08:00` and `21:30`, inserts 15-minute recovery buffers, and schedules your highest-priority uncompleted `Q1`/`Q2` tasks.
- **Live Overlap Conflict Detection (`detectScheduleConflicts`)**: Automatically highlights overlapping time blocks on your schedule.

### 2. Multi-View Task Engine (`Tasks & Matrix`)
- Switch seamlessly between **List View**, **Eisenhower 2×2 Priority Matrix** (`Q1 Urgent & Important`, `Q2 Deep Work`, `Q3 Quick Batch`, `Q4 Someday`), and **Kanban Status Board** (`To Do`, `In Progress`, `Completed`) with checkable subtasks.

### 3. Recurring 7-Day Program Builder (`Weekly Program`)
- Build your reusable Monday–Sunday academic and personal timetable and push any day's template directly into your live schedule with duplicate prevention.

### 4. Study, SM-2 Active Recall & Cornell Notes (`Study & Notes`)
- **SuperMemo-2 (SM-2) Active Recall Deck**: Dynamically schedules review intervals (`1d → 3d → round(I × EF)`) with an easiness factor floor of `1.3`.
- **Cornell Note-Taking System**: Structured **Cue Column**, **Lecture/Reading Notes Column**, and **Synthesis Summary Row**, with 1-click **⚡ Convert to SM-2 Card** synthesis.
- **Syllabus Topic Mastery Matrix**: Track confidence and status across `Not Started`, `Learning`, `Reviewing`, and `Mastered`.

### 5. Deep Focus Studio (`Focus Studio`)
- **4 Timer Modes**: Pomodoro (`25m`), Deep Work (`50m`), Ultradian (`90m`), and Rest Break (`5m`).
- **Mobile WakeLock & MediaSession APIs**: Keeps your mobile screen awake while focusing and displays session info on your phone's lock screen.
- **Offline Web Audio Synthesizer ([src/audio.js](file:///home/antigravity/chronostudy/src/audio.js))**: Generates **Warm Brown Noise**, **Soft Study Rain**, **40Hz Gamma Binaural Focus**, and harmonic completion chimes in pure JavaScript.

### 6. Analytics & Final Exam Target Score Calculator (`Analytics & GPA`)
- **7-Day Focus Velocity Chart**: Visualizes daily focus minutes across the week.
- **Weighted Final Exam Score Calculator (`calculateRequiredExamScore`)**: Enter your current coursework grade, final exam weight `%`, and target grade to see the exact exam score needed.

---

## Quick Start & Commands

```bash
# Run automated unit & integration test suite (17+ tests)
npm test

# Run the Terminal CLI Companion
node cli/chronostudy-cli.mjs dashboard
node cli/chronostudy-cli.mjs add "Implement Raft log compaction #CS-412 !Q1 ~3p @tomorrow"
node cli/chronostudy-cli.mjs auto-schedule
node cli/chronostudy-cli.mjs grades

# Start the Sync + Live Calendar Feed Server (default port 4173)
npm start
```
