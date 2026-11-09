# ChronoStudy — Personal Study Tracker & Planner

A focused, distraction-free study companion designed **PC-first**, responsive for mobile, and built specifically for personal use.

---

## 🌟 Why ChronoStudy?

Plain stopwatches and separate to-do apps make it difficult to remember **what** you studied, **when**, **for how long**, and **what you learned**. 

**ChronoStudy unifies everything in one clean dashboard:**
1. **Focus Timer & Live Scratchpad**: Start a stopwatch or focus countdown block. Type notes, formulas, questions, or chapter progress right alongside the timer as you study.
2. **"What I Must Study" (Study To-Do List)**: Keep track of upcoming topics and assignments. Each task has a **`▶ Study Now`** button that immediately primes your timer and links your notes.
3. **Session History & Activity Log**: Automatic timeline of past study sessions with exact times, durations, subjects, and your saved study notes.
4. **Manual Offline Logging**: Studied away from the computer with a physical book? Quickly log past study sessions with "+ Log Past Study".
5. **No Clutter & 100% Private**: Zero logins, zero third-party tracking, zero bloated dependencies. All data is saved on your device with instant 1-click JSON backup and CSV export for Excel / Google Sheets.

---

## 🚀 Getting Started on PC

You can run ChronoStudy instantly using Node.js:

```bash
# Start the local server
npm start
```
Then open your browser to:
👉 **[http://localhost:3000](http://localhost:3000)**

*(Alternatively, you can open `index.html` directly in Google Chrome, Microsoft Edge, or Firefox!)*

---

## ⌨️ Desktop Keyboard Shortcuts

- `Space`: Start / Pause the active study timer (when not typing in an input field).
- `Ctrl + F`: Finish current study session and open review modal.
- `Esc`: Close any open modal.

---

## 📱 Using on Mobile

ChronoStudy is a Progressive Web App (PWA) with responsive breakpoints:
1. On PC / Desktop, it provides a spacious multi-column dashboard.
2. On mobile screens (under 768px), it automatically switches to an intuitive bottom navigation bar (`⏱ Timer`, `📋 To-Do`, `📜 History`).
3. To install it as a standalone app on your phone or PC:
   - **Chrome / Edge (PC)**: Click the install icon in the address bar (or Menu → "Install ChronoStudy").
   - **Safari (iOS)**: Tap Share → "Add to Home Screen".
   - **Chrome (Android)**: Tap Menu (three dots) → "Install App".

---

## 🎧 Calming Ambient Sound Generator

Need background focus sound? ChronoStudy includes a procedural Web Audio noise generator:
- **Soft Rain**
- **White Noise**
- **Gentle Stream**

Zero audio files to download—runs 100% offline using your browser's audio synthesizer.

---

## 💾 Data Backups & Spreadsheets

Click the **💾** icon in the header to:
- **Download Full Backup (.json)**: Safe offline archive of your tasks, sessions, and notes.
- **Export Study Log to CSV**: Opens directly in Microsoft Excel, Google Sheets, or Apple Numbers with exact dates, start/end times, durations, subjects, and notes.
- **Restore / Import**: Effortlessly restore your data on any device.
