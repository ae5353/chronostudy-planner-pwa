// tests/test-move-tomorrow.mjs — Regression tests for Move to Tomorrow across Today tasks, recurring tasks, sessions & views
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
const { ensureRecurringTaskOccurrences } = await import('../src/domain/recurrence.js');

console.log('Testing Move to Tomorrow across Today tasks, daily routines & UI wiring...\n');

const today = new Date();
today.setHours(0, 0, 0, 0);
const todayStr = toLocalDateStr(today);
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);
const tomorrowStr = toLocalDateStr(tomorrow);

// 1. One-time Today task with logged session preserves sessions/stats and survives reconciliation
const oneTimeTask = store.addTask({
  title: 'Ampul Alma Dernege',
  dueDate: todayStr,
  recurrence: 'none',
  targetMinutes: 60
});
assert(oneTimeTask, 'One-time task must be created');

const logged = store.addSession({
  subject: 'General',
  topic: oneTimeTask.title,
  taskId: oneTimeTask.id,
  durationSec: 1200
});
assert(logged, 'Logged session must attach cleanly');

store.markRecordsSynced();
store.updateTask(oneTimeTask.id, { dueDate: tomorrowStr });

const reloadedOneTime = store.getState().tasks.find((t) => t.id === oneTimeTask.id);
assert.equal(reloadedOneTime.dueDate, tomorrowStr, 'dueDate must update to tomorrowStr');
assert.equal(reloadedOneTime.synced, false, 'Moving to tomorrow must mark task dirty for sync');

store.reconcileTasksAndSessions(store.getState());
const statsAfterReconcile = store.getTaskSessionStats(reloadedOneTime);
assert.equal(statsAfterReconcile.sessionCount, 1, 'Logged session count must remain intact');
assert.equal(statsAfterReconcile.totalSec, 1200, 'Logged session duration must remain intact');
console.log('✔ One-time Today task moves to Tomorrow without losing sessions or reconciliation integrity.');

// 2. Daily recurring Today task moves to Tomorrow without respawning a duplicate for Today
const dailyTask = store.addTask({
  title: 'Gunluk Okuma',
  dueDate: todayStr,
  recurrence: 'daily',
  targetMinutes: 30
});
assert(dailyTask, 'Daily recurring task must be created');

const taskCountBeforeMove = store.getState().tasks.filter((t) => t.title === 'Gunluk Okuma').length;
store.updateTask(dailyTask.id, { dueDate: tomorrowStr });
ensureRecurringTaskOccurrences(store.getState());
store.reconcileTasksAndSessions(store.getState());

const matchingDailyTasks = store.getState().tasks.filter((t) => t.title === 'Gunluk Okuma');
assert.equal(matchingDailyTasks.length, taskCountBeforeMove, 'Moving a daily Today task to Tomorrow must not respawn a duplicate for Today');
assert.equal(matchingDailyTasks[0].dueDate, tomorrowStr, 'Daily recurring task dueDate must stay tomorrowStr');
console.log('✔ Daily recurring Today task moves to Tomorrow without spawning a duplicate Today instance.');

// 3. UI & CSS & Service Worker wiring verification
const tasksViewSrc = fs.readFileSync(path.join(rootDir, 'src', 'ui', 'tasks-view.js'), 'utf8');
assert(tasksViewSrc.includes('.btn-move-tomorrow'), 'tasks-view.js must delegate .btn-move-tomorrow clicks');
assert(tasksViewSrc.includes('.btn-sidebar-move-tomorrow'), 'tasks-view.js must delegate .btn-sidebar-move-tomorrow clicks');
assert(tasksViewSrc.includes('title="Move to Tomorrow"'), 'tasks-view.js must render Move to Tomorrow button');

const plannerViewSrc = fs.readFileSync(path.join(rootDir, 'src', 'ui', 'planner-view.js'), 'utf8');
assert(plannerViewSrc.includes('.btn-cal-move-tomorrow'), 'planner-view.js must delegate .btn-cal-move-tomorrow clicks');
assert(plannerViewSrc.includes('title="Move to Tomorrow"'), 'planner-view.js must render Move to Tomorrow button');

const plannerCssSrc = fs.readFileSync(path.join(rootDir, 'src', 'styles', 'planner.css'), 'utf8');
assert(plannerCssSrc.includes('.btn-move-tomorrow'), 'planner.css must style .btn-move-tomorrow');
assert(plannerCssSrc.includes('.btn-cal-move-tomorrow'), 'planner.css must style .btn-cal-move-tomorrow');

const tasksCssSrc = fs.readFileSync(path.join(rootDir, 'src', 'styles', 'tasks.css'), 'utf8');
assert(tasksCssSrc.includes('flex-wrap: wrap'), 'tasks.css .task-actions must wrap gracefully');

const swSrc = fs.readFileSync(path.join(rootDir, 'sw.js'), 'utf8');
assert(swSrc.includes('chronostudy-clean-v41'), 'sw.js CACHE_NAME must be chronostudy-clean-v41');

console.log('✔ UI delegation, CSS styling, and Service Worker v41 wiring verified.');
console.log('\n✔ All Move to Tomorrow regression tests passed!');
