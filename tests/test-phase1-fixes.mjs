// tests/test-phase1-fixes.mjs — Regression tests for Phase 1 bug fixes, security hardening & server containment
import { strict as assert } from 'node:assert';
import { webcrypto } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

if (!globalThis.crypto || !globalThis.crypto.subtle) {
  globalThis.crypto = webcrypto;
}

const storageMap = new Map();
globalThis.localStorage = {
  getItem(k) { return storageMap.has(k) ? storageMap.get(k) : null; },
  setItem(k, v) { storageMap.set(k, String(v)); },
  removeItem(k) { storageMap.delete(k); },
  clear() { storageMap.clear(); }
};

const dispatchedEvents = [];
globalThis.window = {
  dispatchEvent(evt) { dispatchedEvents.push(evt.type); },
  addEventListener() {}
};
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
};
Object.defineProperty(globalThis, 'navigator', {
  value: { onLine: true, userAgent: 'Node Test' },
  configurable: true
});

const { store, toLocalDateStr } = await import('../src/store.js');
const { timer } = await import('../src/timer.js');
const { encryptPayload, decryptPayload } = await import('../src/sync.js');
const { ChronoUI } = await import('../src/ui.js');
const { createServer } = await import('../server.mjs');

console.log('Testing Phase 1 fixes...\n');

// 1. Sync error loop guard: updateSyncSettings must not set hasChanges or emit state-changed by default
store.markRecordsSynced();
dispatchedEvents.length = 0;
store.updateSyncSettings({ status: 'error', lastError: 'Network down' });
assert.equal(store.getUnsyncedChanges().hasChanges, false, 'updateSyncSettings must not mark workspace dirty by default');
assert.equal(dispatchedEvents.includes('chronostudy:state-changed'), false, 'updateSyncSettings must not trigger auto-sync loop');

// 2. Device-local settings excluded from sync payload & preserved on remote merge
store.updateSettings({ theme: 'oled', layoutFormat: 'mobile', volume: 0.2, ambientSound: 'rain' });
const payload = store.getSyncPayload();
assert.equal(payload.settings.theme, 'oled');
assert.equal('layoutFormat' in payload.settings, false, 'layoutFormat must stay device-local');
assert.equal('volume' in payload.settings, false, 'volume must stay device-local');
assert.equal('ambientSound' in payload.settings, false, 'ambientSound must stay device-local');

const futureIso = new Date(Date.now() + 120000).toISOString();
const mergeRes = store.mergeRemoteState({
  version: 12,
  tasks: [{ id: 'task-p1-new', title: 'Remote Task', updatedAt: futureIso }],
  sessions: [{ id: 'sess-p1-new', subject: 'General', topic: 'Remote', durationSec: 900, startTime: futureIso, endTime: futureIso, updatedAt: futureIso }],
  settings: { theme: 'oxford', layoutFormat: 'desktop', volume: 0.9, ambientSound: 'white', updatedAt: futureIso }
});
assert.equal(mergeRes.success, true);
assert.equal(mergeRes.addedTasks, 1, 'mergeRemoteState must report addedTasks');
assert.equal(mergeRes.addedSessions, 1, 'mergeRemoteState must report addedSessions');
assert.equal(store.getState().settings.theme, 'oxford', 'Syncable theme must update from newer remote');
assert.equal(store.getState().settings.layoutFormat, 'mobile', 'Device-local layoutFormat must be preserved');
assert.equal(store.getState().settings.volume, 0.2, 'Device-local volume must be preserved');
assert.equal(store.getState().settings.ambientSound, 'rain', 'Device-local ambientSound must be preserved');

// Session metadata update merge
const laterIso = new Date(Date.now() + 240000).toISOString();
store.mergeRemoteState({
  version: 12,
  sessions: [{ id: 'sess-p1-new', subject: 'MAT 287', topic: 'Renamed Remote Topic', durationSec: 900, startTime: futureIso, endTime: futureIso, updatedAt: laterIso }]
});
const updatedSess = store.getState().sessions.find((s) => s.id === 'sess-p1-new');
assert.equal(updatedSess.topic, 'Renamed Remote Topic', 'Session metadata updates with newer updatedAt must merge');

// 3. Entity updatedAt stamping on subject/event/lecture mutations
const sub = store.addSubject({ name: 'Signals & Systems', code: 'EHB 211' });
assert(sub.updatedAt, 'addSubject must stamp updatedAt');
const prevSubUpdated = sub.updatedAt;
await new Promise((r) => setTimeout(r, 15));
store.addLectureSlot(sub.id, { day: 2, start: '10:00', end: '12:00', label: 'Lecture' });
assert(sub.updatedAt > prevSubUpdated, 'addLectureSlot must bump subject updatedAt');

// 4. Deleting session removes ghost time from task
const timedStart = new Date();
timedStart.setHours(12, 0, 0, 0);
const timedEnd = new Date(timedStart.getTime() + 1800 * 1000);
const timedTask = store.addTask({ title: 'Ghost Time Check', targetMinutes: 60 });
const loggedSess = store.addSession({
  subject: 'General',
  topic: 'Ghost Time Check',
  taskId: timedTask.id,
  durationSec: 1800,
  startTime: timedStart.toISOString(),
  endTime: timedEnd.toISOString()
});
assert.equal(store.getTaskSessionStats(timedTask.id).totalSec, 1800);
store.deleteSession(loggedSess.id);
assert.equal(store.getTaskSessionStats(timedTask.id).totalSec, 0, 'deleteSession must clear linked task timeSpentSec');

// 5. E2EE Fail-Closed + Base64 v2 + Legacy v1 compatibility
const pass = 'test-secret-key-2026';
const encV2 = await encryptPayload({ secret: 'data' }, pass);
const parsedEnc = JSON.parse(encV2);
assert.equal(parsedEnc.encoding, 'base64', 'encryptPayload must use compact Base64 v2 format');
const decV2 = await decryptPayload(encV2, pass);
assert.equal(decV2.secret, 'data');

// Legacy v1 array payload check
const salt = webcrypto.getRandomValues(new Uint8Array(16));
const iv = webcrypto.getRandomValues(new Uint8Array(12));
const rawKey = await webcrypto.subtle.importKey('raw', new TextEncoder().encode(pass), { name: 'PBKDF2' }, false, ['deriveKey']);
const aesKey = await webcrypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, rawKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const ct = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, new TextEncoder().encode(JSON.stringify({ legacy: true })));
const legacyPayload = JSON.stringify({ isEncrypted: true, salt: Array.from(salt), iv: Array.from(iv), data: Array.from(new Uint8Array(ct)) });
assert.equal((await decryptPayload(legacyPayload, pass)).legacy, true, 'Legacy v1 byte-array ciphertext must still decrypt');

const savedCrypto = globalThis.crypto;
Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
await assert.rejects(() => encryptPayload({ a: 1 }, pass), /encryption requires/i, 'encryptPayload must fail closed if crypto.subtle unavailable');
Object.defineProperty(globalThis, 'crypto', { value: savedCrypto, configurable: true });

// 6. Timer pause/resume preserves sessionStartTime
timer.reset();
timer.start(true);
const initialStartMs = timer.sessionStartTime.getTime();
await new Promise((r) => setTimeout(r, 30));
timer.pause();
timer.elapsedSec = 10;
await new Promise((r) => setTimeout(r, 30));
timer.toggle(); // resume
assert.equal(timer.sessionStartTime.getTime(), initialStartMs, 'Resuming paused timer must preserve original sessionStartTime');
timer.reset();

// 7. Recurrence parity & month-end clamping
assert.equal(toLocalDateStr('2026-11-19'), '2026-11-19', 'Date-only string must not shift across timezones');
assert.equal(store.calculateNextRecurrenceDate('2026-01-31', 'monthly'), '2026-02-28', 'Jan 31 monthly must clamp to Feb 28');
assert.equal(store.calculateNextRecurrenceDate('2024-01-31', 'monthly'), '2024-02-29', 'Leap-year Jan 31 monthly must clamp to Feb 29');
const triTask = { id: 'tri-1', title: 'Triweekly Task', recurrence: 'triweekly', dueDate: '2026-11-01' };
assert.equal(store.doesTaskOccurOnDate(triTask, '2026-11-22'), true, 'doesTaskOccurOnDate must support triweekly');
assert.equal(store.doesTaskOccurOnDate(triTask, '2026-11-15'), false);
const jan31Monthly = { id: 'mon-31', title: 'Month End', recurrence: 'monthly', dueDate: '2026-01-31' };
assert.equal(store.doesTaskOccurOnDate(jan31Monthly, '2026-02-28'), true, 'Month-end monthly must match Feb 28');

// Weekly event biweekly cadence in Planner
const biEv = store.addWeeklyEvent({
  title: 'Biweekly Lab Seminar',
  day: 4,
  start: '16:00',
  end: '17:00',
  recurrence: 'biweekly',
  anchorDate: '2026-11-19'
});
const uiMock = Object.create(ChronoUI.prototype);
const week0Html = uiMock.renderDayClassLectures(4, '2026-11-19');
const week1Html = uiMock.renderDayClassLectures(4, '2026-11-26');
const week2Html = uiMock.renderDayClassLectures(4, '2026-12-03');
assert(week0Html.includes('Biweekly Lab Seminar'), 'Anchor week must display biweekly event');
assert(!week1Html.includes('Biweekly Lab Seminar'), 'Odd week must NOT display biweekly event');
assert(week2Html.includes('Biweekly Lab Seminar'), 'Second even week must display biweekly event');
store.deleteWeeklyEvent(biEv.id);

// 8. Exports (ICS + CSV formula protection) & XSS sanitizers
const formulaStart = new Date();
formulaStart.setHours(13, 0, 0, 0);
const formulaEnd = new Date(formulaStart.getTime() + 600 * 1000);
const formulaSess = store.addSession({
  subject: 'General',
  topic: '=CMD("calc")',
  durationSec: 600,
  startTime: formulaStart.toISOString(),
  endTime: formulaEnd.toISOString(),
  notes: 'Line 1\nLine 2; ok'
});
const csv = store.exportCSV();
assert(csv.startsWith('\uFEFF'), 'CSV export must start with UTF-8 BOM');
assert(csv.includes('"\'=CMD(""calc"")"'), 'CSV export must neutralize formula injection');
const ics = store.generateICS();
assert(!ics.includes('[Study] null:'), 'ICS summary must never contain null subject');
assert(ics.includes('RRULE:FREQ=WEEKLY'), 'ICS export must emit RRULE for weekly lectures/events');
store.deleteSession(formulaSess.id);

assert.equal(uiMock.sanitizeCssColor('#ff00aa'), '#ff00aa');
assert.equal(uiMock.sanitizeCssColor('red; background: url(evil)'), '#64748b');
assert.equal(uiMock.sanitizeGoogleEnableUrl('javascript:alert(1)'), '');
assert.equal(uiMock.sanitizeGoogleEnableUrl('https://evil.example.com/phish'), '');
assert.ok(uiMock.sanitizeGoogleEnableUrl('https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=123').startsWith('https://console.developers.google.com/'));

// 9. Service worker assets exist & include wakelock.js
const swContent = fs.readFileSync(path.join(rootDir, 'sw.js'), 'utf8');
assert(swContent.includes('./src/wakelock.js'), 'sw.js ASSETS must include ./src/wakelock.js');
assert(!swContent.includes('return null;'), 'sw.js must return a valid Response, never null');

// 10. Server path traversal & containment test on ephemeral port
const srv = createServer(0, '127.0.0.1', { quiet: true, autoIncrementPort: false });
await new Promise((resolve) => srv.once('listening', resolve));
const { port } = srv.address();
try {
  const base = `http://127.0.0.1:${port}`;
  const resOk = await fetch(`${base}/src/wakelock.js`);
  assert.equal(resOk.status, 200, 'Valid static module must return 200');
  assert.equal(resOk.headers.get('x-content-type-options'), 'nosniff');

  const resTrav1 = await fetch(`${base}/../../package.json`);
  assert.equal(resTrav1.status, 403, 'Path traversal must be rejected with 403');

  const resTrav2 = await fetch(`${base}/%2e%2e/server.mjs`);
  assert.equal(resTrav2.status, 403, 'Encoded path traversal must be rejected with 403');

  const resGit = await fetch(`${base}/.git/HEAD`);
  assert.equal(resGit.status, 403, 'Dotfiles like .git must be blocked');

  const resLegacy = await fetch(`${base}/_legacy_archive/src_legacy/main.js`);
  assert.equal(resLegacy.status, 403, 'Legacy archive must be blocked');

  const resBadUri = await fetch(`${base}/%ZZ`);
  assert.equal(resBadUri.status, 400, 'Malformed URI encoding must return 400');

  const resPost = await fetch(`${base}/index.html`, { method: 'POST' });
  assert.equal(resPost.status, 405, 'Non-GET/HEAD must return 405');
} finally {
  await new Promise((resolve) => srv.close(resolve));
}

console.log('✔ All Phase 1 fixes, security guards, and HTTP containment tests passed!');
