import assert from 'node:assert/strict';

function setupBrowserMocks(initialState = null) {
  const storage = new Map();
  if (initialState) {
    storage.set('chronostudy_v3_state', JSON.stringify(initialState));
  }
  globalThis.localStorage = {
    getItem(k) { return storage.has(k) ? storage.get(k) : null; },
    setItem(k, v) { storage.set(k, String(v)); },
    removeItem(k) { storage.delete(k); },
    clear() { storage.clear(); }
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
}

// Seed initial state simulating the exact user bugs:
// 1. "dergi yazısı için çalışma" task with subject: null, plus split sessions across General & Circuit Analysis
// 2. Duplicate uncompleted recurring task + duplicate weekly event
setupBrowserMocks({
  version: 12,
  groups: ['İTÜ Courses (Fall 2026)', 'Kardeşlik ve İhya'],
  subjects: [
    {
      id: 'sub-eef211',
      code: 'EEF 211E',
      name: 'Circuit Analysis',
      group: 'İTÜ Courses (Fall 2026)',
      color: '#e06d43',
      schedule: [
        { day: 1, start: '08:30', end: '11:29', label: 'Lecture' },
        { day: 1, start: '08:30', end: '11:29', label: 'Lecture' }
      ]
    }
  ],
  weeklyEvents: [
    { id: 'wev-1', title: 'İhya', day: 4, start: '19:00', end: '21:30', category: 'Kardeşlik ve İhya', recurrence: 'weekly' },
    { id: 'wev-2', title: 'İhya', day: 4, start: '19:00', end: '21:30', category: 'Kardeşlik ve İhya', recurrence: 'weekly' }
  ],
  tasks: [
    {
      id: 'task-dergi',
      title: 'dergi yazısı için çalışma',
      subject: null,
      recurrence: 'none',
      dueDate: '2026-11-16',
      completed: false,
      createdAt: '2026-11-16T12:00:00.000Z',
      updatedAt: '2026-11-16T12:00:00.000Z'
    },
    {
      id: 'task-rec-1',
      title: 'Daily Reading',
      subject: null,
      recurrence: 'daily',
      dueDate: '2026-11-16',
      completed: false,
      createdAt: '2026-11-16T10:00:00.000Z',
      updatedAt: '2026-11-16T10:00:00.000Z'
    },
    {
      id: 'task-rec-dup',
      title: 'Daily Reading',
      subject: null,
      recurrence: 'daily',
      dueDate: '2026-11-16',
      completed: false,
      createdAt: '2026-11-16T10:05:00.000Z',
      updatedAt: '2026-11-16T10:05:00.000Z'
    }
  ],
  sessions: [
    {
      id: 'sess-d1',
      subject: 'Circuit Analysis',
      topic: 'dergi yazısı için çalışma',
      taskId: null,
      durationSec: 1800,
      startTime: '2026-11-16T15:00:00.000Z',
      endTime: '2026-11-16T15:30:00.000Z',
      createdAt: '2026-11-16T15:30:00.000Z'
    },
    {
      id: 'sess-d2',
      subject: 'General',
      topic: 'dergi yazısı için çalışma',
      taskId: 'task-dergi',
      durationSec: 1200,
      startTime: '2026-11-16T16:00:00.000Z',
      endTime: '2026-11-16T16:20:00.000Z',
      createdAt: '2026-11-16T16:20:00.000Z'
    }
  ],
  activeTimer: {
    isRunning: false,
    mode: 'stopwatch',
    targetSec: 1500,
    elapsedSec: 0,
    startedAt: null,
    subject: 'Circuit Analysis',
    topic: '',
    linkedTaskId: null
  }
});

const { store } = await import('../src/store.js');
const { timer } = await import('../src/timer.js');

// --- Test 1: Split Subject Reconciliation & No Circuit Analysis Default Leak ---
console.log('Test 1: Reconciling split-subject task & timer defaults...');
const dergiSessions = store.getState().sessions.filter((s) => s.topic === 'dergi yazısı için çalışma');
assert.equal(dergiSessions.length, 2);
assert.ok(dergiSessions.every((s) => s.subject === 'General'), 'All sessions for General task must be unified to General');
assert.ok(dergiSessions.every((s) => s.taskId === 'task-dergi'), 'Unlinked matching session should be auto-linked to task-dergi');
assert.equal(store.getState().activeTimer.subject, '', 'Idle activeTimer should not default to Circuit Analysis');
assert.equal(timer.getState().subject, '', 'StudyTimer idle default subject should be empty string (General), not Circuit Analysis');

// Test auto-link in addSession + cascade on updateTask
const dergiSess3 = store.addSession({
  subject: 'Circuit Analysis', // even if stale UI passed Circuit Analysis
  topic: 'dergi yazısı için çalışma',
  taskId: null,
  durationSec: 600,
  startTime: '2026-11-16T18:00:00.000Z',
  endTime: '2026-11-16T18:10:00.000Z'
});
assert.equal(dergiSess3.taskId, 'task-dergi', 'addSession should auto-link by topic title');
assert.equal(dergiSess3.subject, 'General', 'Linked General task must resolve Circuit Analysis leak back to General');

// Cascade subject change from updateTask to all linked sessions
store.updateTask('task-dergi', { subject: 'LÜGÂT', title: 'dergi yazısı düzenleme' });
const updatedDergiSessions = store.getState().sessions.filter((s) => s.taskId === 'task-dergi');
assert.equal(updatedDergiSessions.length, 3);
assert.ok(updatedDergiSessions.every((s) => s.subject === 'LÜGÂT'), 'updateTask should cascade new subject to all linked sessions');
assert.ok(updatedDergiSessions.every((s) => s.topic === 'dergi yazısı düzenleme'), 'updateTask should cascade new title to all linked sessions');

// --- Test 2: Task Session Stats Count ---
console.log('Test 2: Task session counts via store.getTaskSessionStats...');
const dergiStats = store.getTaskSessionStats('task-dergi');
assert.equal(dergiStats.sessionCount, 3, 'Task should report 3 completed sessions');
assert.equal(dergiStats.totalSec, 3600, 'Total duration across 3 sessions should be 3600s');
assert.equal(dergiStats.totalMins, 60);

// --- Test 3: Midnight Boundary Separation (Sessions & Tasks) ---
console.log('Test 3: Midnight-crossing session splitting & midnight completion detection...');
const day1Start = new Date(2026, 10, 16, 23, 30, 0); // 2026-11-16 23:30 local
const day2End = new Date(2026, 10, 17, 0, 30, 0);   // 2026-11-17 00:30 local
store.addSession({
  subject: 'LÜGÂT',
  topic: 'dergi yazısı düzenleme',
  taskId: 'task-dergi',
  durationSec: 3600,
  startTime: day1Start.toISOString(),
  endTime: day2End.toISOString()
});

const splitDay1 = store.getState().sessions.find((s) => store.getSessionDateStr(s) === '2026-11-16' && s.startTime === day1Start.toISOString());
const splitDay2 = store.getState().sessions.find((s) => store.getSessionDateStr(s) === '2026-11-17' && s.isMidnightSplit);
assert.ok(splitDay1, 'Midnight-crossing session should record pre-midnight segment on 2026-11-16');
assert.ok(splitDay2, 'Midnight-crossing session should record post-midnight segment on 2026-11-17');
assert.equal(splitDay1.durationSec + splitDay2.durationSec, 3600, 'Split segment durations must sum exactly to 3600s');

// Midnight-split single session should count as 1 logical session in getTaskSessionStats (3 + 1 = 4)
const dergiStatsAfterMidnight = store.getTaskSessionStats('task-dergi');
assert.equal(dergiStatsAfterMidnight.sessionCount, 4, 'Midnight-split logical session counts as 1 session (total 4)');

assert.equal(store.isMidnightTimestamp(new Date(2026, 10, 17, 1, 15, 0)), true, '01:15 AM should be detected as midnight completion');
assert.equal(store.isMidnightTimestamp(new Date(2026, 10, 17, 4, 59, 0)), true, '04:59 AM should be detected as midnight completion');
assert.equal(store.isMidnightTimestamp(new Date(2026, 10, 17, 9, 30, 0)), false, '09:30 AM should NOT be midnight');
assert.equal(store.isMidnightTimestamp(new Date(2026, 10, 16, 22, 0, 0)), false, '22:00 PM should NOT be midnight');

// --- Test 4: Planner Deduplication & Completed Recurring Tasks ---
console.log('Test 4: Planner deduplication & completed recurring task projection...');
const circuitSub = store.getState().subjects.find((s) => s.id === 'sub-eef211');
assert.equal(circuitSub.schedule.length, 1, 'Duplicate lecture slot should be deduplicated');
assert.equal(store.getState().weeklyEvents.length, 1, 'Duplicate weekly event should be deduplicated');
const dailyTasks = store.getState().tasks.filter((t) => t.title === 'Daily Reading' && !t.completed);
assert.equal(dailyTasks.length, 1, 'Duplicate uncompleted recurring tasks should be deduplicated');

const completedRecTask = {
  id: 'task-done-rec',
  title: 'Completed Daily',
  recurrence: 'daily',
  dueDate: '2026-11-16',
  completed: true,
  completedAt: new Date(2026, 10, 16, 14, 0, 0).toISOString()
};
assert.equal(store.doesTaskOccurOnDate(completedRecTask, '2026-11-16'), true, 'Completed recurring task appears on its completion day');
assert.equal(store.doesTaskOccurOnDate(completedRecTask, '2026-11-17'), false, 'Completed recurring task must NOT project onto future days');

// finishSession resets topic & linkedTaskId
timer.setContext({ subject: 'MAT 287', topic: 'Temp', linkedTaskId: 'task-dergi' });
timer.start(true);
const finished = timer.finishSession();
assert.equal(finished.linkedTaskId || finished.taskId, 'task-dergi');
assert.equal(timer.getState().linkedTaskId, null, 'finishSession must reset linkedTaskId');
assert.equal(timer.getState().topic, '', 'finishSession must reset topic');
assert.equal(timer.getState().subject, '', 'finishSession must reset subject to empty string');

console.log('ALL PLANNER, MIDNIGHT, TASK-SUBJECT SYNC & SESSION COUNT TESTS PASSED!');
