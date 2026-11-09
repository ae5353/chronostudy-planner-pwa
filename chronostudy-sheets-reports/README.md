# ChronoStudy Google Sheets Reports

Receive beautifully styled weekly and monthly study reports directly into your personal Google Sheet from **ChronoStudy Web**, **StudyLog Minimal**, **ChronoStudy Termux TUI**, or the **Python Local App**.

---

## 3-Minute Setup

1. Open [Google Sheets](https://sheets.new) and create a new blank spreadsheet (e.g. named `My Study & Progress Reports`).
2. In the top menu, click **Extensions** → **Apps Script**.
3. Replace the default code with the contents of [`src/Code.gs`](./src/Code.gs).
4. Click **Deploy** → **New deployment**:
   - **Select type**: Web app
   - **Execute as**: Me
   - **Who has access**: Anyone (or Anyone with Google Account)
5. Copy the **Web App URL** (e.g. `https://script.google.com/macros/s/.../exec`).
6. Paste this URL into your ChronoStudy app under **Reports → Google Sheets Webhook URL** and tap **Export / Push Report**.

---

## Features

- **Automatic Tab Creation**: Generates neat tabs like `Week 2026-11-09` or `Month 2026-11`.
- **KPI Summary Cards**: Total focus hours, completed sessions count, tasks finished, and average session duration.
- **Track Breakdown**: Summary table of focus time per track or subject.
- **Daily Heat Strip**: Daily minutes log across the week.
- **Detailed Session Log**: Chronological table of study sessions with timestamps, topics, ratings, and notes.
- **Idempotent**: Re-pushing a report updates and refreshes the tab without creating messy duplicate sheets.
