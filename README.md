# ChronoStudy — Mobile-First Time, Weekly Program, Study & Task Planner PWA

ChronoStudy is an all-in-one, offline-capable Progressive Web Application (PWA) built for students, researchers, and self-directed learners who want **daily time-blocking**, **recurring weekly class/study timetables**, **Eisenhower 2×2 task prioritization**, **SuperMemo-2 (SM-2) spaced repetition**, and a **Deep Focus Pomodoro Studio with synthesized Web Audio soundscapes** in a single mobile-ready interface.

---

## Core Capabilities

### 1. Daily Command Center (`Today Hub`)
- **Time-Blocked Schedule**: Plan your day hour-by-hour with course color tags, categories (`Deep Work`, `Lecture`, `Review`, `Wellness`), and completion checkboxes.
- **One-Tap Routine Loader**: Populate any date's schedule automatically from your **Weekly Program** template for that day of the week.
- **Quick-Capture Task Bar**: Add tasks with course tags and Eisenhower quadrant priority in seconds.
- **Daily Habits & Streaks**: Track daily study and wellness habits with live streak counters.

### 2. Multi-View Task Engine (`Tasks & Matrix`)
- **3 Seamless Views**: Switch instantly between **List View**, **Eisenhower 2×2 Priority Matrix** (`Q1 Urgent & Important`, `Q2 Deep Work`, `Q3 Quick Batch`, `Q4 Someday`), and **Kanban Status Board** (`To Do`, `In Progress`, `Completed`).
- **Subtasks & Pomodoro Tracking**: Break complex assignments into checkable subtasks and track completed vs. estimated 25-minute Pomodoros.
- **One-Click Focus Launch**: Click **Focus** on any task to load it directly into the Deep Focus Studio.

### 3. Recurring 7-Day Program Builder (`Weekly Program`)
- Build your recurring Monday–Sunday academic and personal routine (Lectures, Labs, Deep Study blocks, Review sessions, Conditioning).
- Push any weekday's template directly into your live daily schedule with duplicate prevention.

### 4. Study & Spaced Repetition Hub (`Study & SM-2`)
- **Exam Countdown & Weekly Study Target Bars**: Visual progress bars comparing logged focus hours against weekly course targets, plus `T-minus` exam countdown badges.
- **SuperMemo-2 (SM-2) Active Recall Deck**: Review course flashcards and grade recall quality (`Again`, `Hard`, `Good`, `Easy`) to automatically compute optimal next review intervals (`interval`, `repetitions`, `easinessFactor`).
- **Syllabus Mastery Tracker**: Track every course topic across `Not Started`, `Learning`, `Reviewing`, and `Mastered`.

### 5. Deep Focus Studio (`Focus Studio`)
- **4 Timer Modes**: Pomodoro (`25m`), Deep Work (`50m`), Ultradian Rhythm (`90m`), and Rest Break (`5m`).
- **Automatic Course & Task Logging**: Completed or manually logged sessions automatically credit focus minutes to your active course and increment your task's Pomodoro count.
- **100% Offline Web Audio Soundscape Synthesizer**: Pure Web Audio API synthesis for **Warm Brown Noise**, **Soft Study Rain**, **40Hz Gamma Binaural Focus**, and harmonic completion chimes—requiring zero external audio files.

### 6. Mobile Portability, Calendar `.ICS` Export & Cloud Backup
- **Installable Mobile PWA**: Includes `manifest.json` and `sw.js` offline service worker. On iOS Safari or Android Chrome, tap **Add to Home Screen** for a native full-screen experience.
- **Apple / Google Calendar `.ICS` Export**: Export your scheduled time blocks and exam dates to a standard `.ics` calendar file.
- **JSON Snapshot Backup & Restore**: Export or import your entire planner state as JSON for Google Drive or GitHub backup.

---

## Running Locally

```bash
npm install
npm run dev
```
