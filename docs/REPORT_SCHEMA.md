# ChronoStudy Data & Export Formats

## Active App Exports (`src/store.js`)

ChronoStudy currently exports data directly from the client store:

1. **JSON Backup (`store.exportJSON()`)**: Full local workspace export (`appName`, `version`, `exportedAt`, `groups`, `subjects`, `weeklyEvents`, `tasks`, `sessions`, `settings`).
2. **CSV Session Log (`store.exportCSV()` / `store.generateCSV()`)**: RFC 4180 CSV with UTF-8 BOM (`\uFEFF`) and spreadsheet formula-injection neutralization (`Session ID,Date,Start Time,End Time,Duration (Minutes),Subject,Topic,Notes`).
3. **iCalendar Export (`store.generateICS()`)**: RFC 5545 `VCALENDAR` containing scheduled tasks (`RRULE` for recurring items), weekly course lecture slots, and recurring weekly events.
4. **Cloud Sync Payload (`store.getSyncPayload()`)**: Synchronizable state (with 5-entity tombstone maps and excluding device-local preferences `layoutFormat`, `volume`, `ambientSound`), optionally wrapped in AES-GCM + PBKDF2 Base64 envelopes via `encryptPayload()` in `src/sync.js`.

---

## Legacy Reports Payload (Archived)

The historical Google Apps Script report payload v1 (`buildReport()` from `_legacy_archive/src_legacy/reports.js` and `_legacy_archive/chronostudy-sheets-reports`) is archived under `_legacy_archive/chronostudy-sheets-reports/`.
