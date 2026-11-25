// tests/test-task-study-logs.mjs — Regression tests for logging separate dated study sessions per task
import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const storageMap = new Map();
globalThis.localStorage = {
  getItem(k) { return storageMap.has(k) ? storageMap.get(k) : null; },
  setItem(k, v) { storageMap.set(k, String(v)); },
  removeItem(k) { storageMap.delete(k); },
  clear() { storageMap.clear(); }
};

globalThis.window = {
  dispatchEvent() {},
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

console.log('Testing separate dated study logs when editing a task...\n');

const shiftDateStr = (daysDelta) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + daysDelta);
  return toLocalDateStr(d);
};

const dayMinus3 = shiftDateStr(-3);
const dayMinus1 = shiftDateStr(-1);
const todayStr = shiftDateStr(0);

// 1. Create a task originally due 3 days ago, log Day -3 session, move task to today, log Day -1 & Today sessions
const task = store.addTask({
  title: 'Folland Chapter 2 Exercises',
  subject: 'Advanced Calculus',
  dueDate: dayMinus3,
  targetMinutes: 120
});
assert(task, 'Task must be created');

const s1 = store.addTaskSession(task.id, {
  dateStr: dayMinus3,
  durationMins: 35,
  notes: 'Problems 1-4'
});
assert(s1, 'First dated study log must be created');
assert.equal(store.getSessionDateStr(s1), dayMinus3, 'First session must be recorded on dayMinus3');
assert.equal(s1.durationSec, 35 * 60);

// Move task to today (simulating user postponing across days)
store.updateTask(task.id, { dueDate: todayStr });

// Log a separate untimed session for yesterday (day in between!) and another for today
const s2 = store.addTaskSession(task.id, {
  dateStr: dayMinus1,
  durationMins: 40,
  notes: 'Problems 5-8'
});
const s3 = store.addTaskSession(task.id, {
  dateStr: todayStr,
  durationMins: 25,
  notes: 'Review proofs'
});

assert(s2 && s3, 'Second and third dated study logs must be created');
assert.notEqual(s1.id, s2.id, 'Each logged session must have a distinct session ID');
assert.notEqual(s2.id, s3.id, 'Each logged session must have a distinct session ID');

// Verify first session was NEVER mutated
const s1Reloaded = store.getState().sessions.find((s) => s.id === s1.id);
const s2Reloaded = store.getState().sessions.find((s) => s.id === s2.id);
const s3Reloaded = store.getState().sessions.find((s) => s.id === s3.id);

assert.equal(s1Reloaded.durationSec, 35 * 60, 'Original day session duration must remain 35m');
assert.equal(store.getSessionDateStr(s1Reloaded), dayMinus3, 'Original session must stay on dayMinus3');
assert.equal(s2Reloaded.durationSec, 40 * 60, 'Second session must be 40m');
assert.equal(store.getSessionDateStr(s2Reloaded), dayMinus1, 'Second session must stay on dayMinus1');
assert.equal(s3Reloaded.durationSec, 25 * 60, 'Third session must be 25m');
assert.equal(store.getSessionDateStr(s3Reloaded), todayStr, 'Third session must stay on todayStr');

// Verify task totals aggregate all 3 separate sessions accurately
const stats = store.getTaskSessionStats(task.id);
assert.equal(stats.sessionCount, 3, 'Task must report 3 separate sessions');
assert.equal(stats.totalMins, 100, 'Task total must equal 35 + 40 + 25 = 100m');
console.log('✔ Separate dated study logs record onto their respective days without mutating earlier sessions.');

// 2. Deleting a single dated session preserves the other days' logs and recalculates total
store.deleteSession(s2.id);
const statsAfterDel = store.getTaskSessionStats(task.id);
assert.equal(statsAfterDel.sessionCount, 2, 'Deleting middle session must leave 2 sessions');
assert.equal(statsAfterDel.totalMins, 60, 'Remaining total must be 35 + 25 = 60m');
assert(store.getState().sessions.some((s) => s.id === s1.id), 'Day -3 session must remain intact');
assert(store.getState().sessions.some((s) => s.id === s3.id), 'Today session must remain intact');
console.log('✔ Deleting an individual study log removes only that entry and recalculates task total.');

// 3. Programmatic updateTask({ timeSpentSec }) with positive delta appends a new session rather than mutating s1
store.updateTask(task.id, { timeSpentSec: 80 * 60 }); // +20m
const s1AfterUpdate = store.getState().sessions.find((s) => s.id === s1.id);
assert.equal(s1AfterUpdate.durationSec, 35 * 60, 'updateTask timeSpentSec delta must never mutate original day session');
assert.equal(store.getTaskSessionStats(task.id).sessionCount, 3, 'Positive timeSpentSec delta must append a separate session');
console.log('✔ Programmatic updateTask timeSpentSec delta creates a new session instead of mutating historical logs.');

// 4. HTML, UI controller & Service Worker wiring checks
const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
assert(html.includes('id="edit-task-log-date"'), 'index.html must include #edit-task-log-date');
assert(html.includes('id="edit-task-log-mins"'), 'index.html must include #edit-task-log-mins');
assert(html.includes('id="btn-edit-task-add-session"'), 'index.html must include #btn-edit-task-add-session');
assert(html.includes('id="edit-task-sessions-list"'), 'index.html must include #edit-task-sessions-list');

const tasksViewSrc = fs.readFileSync(path.join(rootDir, 'src', 'ui', 'tasks-view.js'), 'utf8');
assert(tasksViewSrc.includes('addStudySessionFromEditModal'), 'tasks-view.js must implement addStudySessionFromEditModal');
assert(tasksViewSrc.includes('btn-delete-task-session'), 'tasks-view.js must wire per-session delete in edit modal');

const swSrc = fs.readFileSync(path.join(rootDir, 'sw.js'), 'utf8');
assert(swSrc.includes('chronostudy-clean-v42'), 'sw.js CACHE_NAME must be chronostudy-clean-v42');

console.log('✔ HTML modal controls, tasks-view wiring, and Service Worker v42 verified.');
console.log('\n✔ All Task Separate Study Logs tests passed!');
