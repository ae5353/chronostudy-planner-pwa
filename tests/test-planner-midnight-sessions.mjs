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

const { store, toLocalDateStr } = await import('../src/store.js');
const { timer } = await import('../src/timer.js');
const { ChronoUI } = await import('../src/ui.js');

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
const dailyTasks = store.getState().tasks.filter((t) => t.title === 'Daily Reading' && t.dueDate === '2026-11-16' && !t.completed);
assert.equal(dailyTasks.length, 1, 'Duplicate uncompleted recurring tasks on same day should be deduplicated');

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

// --- Test 5: Per-Day Checking for Daily / Routine Tasks Across Days ---
console.log('Test 5: Per-day checking for daily/routine tasks (including past days)...');
const routineTask = store.addTask({
  title: 'Morning Quran Reading',
  subject: null,
  recurrence: 'daily',
  dueDate: '2026-11-16'
});

const getSeriesTaskForDate = (title, dateStr) => {
  const matches = store.getState().tasks.filter((t) => t.title === title && store.doesTaskOccurOnDate(t, dateStr));
  if (matches.length === 0) return null;
  return matches.find((t) => t.dueDate === dateStr || (t.completed && t.completedAt && toLocalDateStr(t.completedAt) === dateStr)) || matches[0];
};

// Check off 2026-11-16 independently
store.toggleTaskForDate(routineTask.id, '2026-11-16');
const quran16 = getSeriesTaskForDate('Morning Quran Reading', '2026-11-16');
const quran17 = getSeriesTaskForDate('Morning Quran Reading', '2026-11-17');
assert.ok(quran16 && store.isTaskCompletedOnDate(quran16, '2026-11-16'), '2026-11-16 should be marked done');
assert.ok(quran17 && !store.isTaskCompletedOnDate(quran17, '2026-11-17'), '2026-11-17 must remain unchecked & visible on planner');

// Check off 2026-11-17 as well
store.toggleTaskForDate(quran17.id, '2026-11-17');
const quran17After = getSeriesTaskForDate('Morning Quran Reading', '2026-11-17');
const quran18 = getSeriesTaskForDate('Morning Quran Reading', '2026-11-18');
assert.ok(quran17After && store.isTaskCompletedOnDate(quran17After, '2026-11-17'), '2026-11-17 should now be marked done');
assert.ok(quran18 && !store.isTaskCompletedOnDate(quran18, '2026-11-18'), '2026-11-18 remains unchecked & visible');

// Uncheck 2026-11-16 without affecting 2026-11-17
store.toggleTaskForDate(quran16.id, '2026-11-16');
const quran16Reopened = getSeriesTaskForDate('Morning Quran Reading', '2026-11-16');
const quran17StillDone = getSeriesTaskForDate('Morning Quran Reading', '2026-11-17');
assert.ok(quran16Reopened && !store.isTaskCompletedOnDate(quran16Reopened, '2026-11-16'), '2026-11-16 should uncheck cleanly');
assert.ok(quran17StillDone && store.isTaskCompletedOnDate(quran17StillDone, '2026-11-17'), '2026-11-17 must remain checked');

// --- Test 6: Daily Rollover (Yesterday & Today in Task Bar + Relative Due Date Formatting) ---
console.log('Test 6: Daily rollover occurrences & Today/Yesterday labels...');
const nowLocal = new Date();
const todayLocalStr = toLocalDateStr(nowLocal);
const yestLocal = new Date(nowLocal);
yestLocal.setDate(yestLocal.getDate() - 1);
const yesterdayLocalStr = toLocalDateStr(yestLocal);
const tomLocal = new Date(nowLocal);
tomLocal.setDate(tomLocal.getDate() + 1);
const tomorrowLocalStr = toLocalDateStr(tomLocal);

const rolloverSeed = store.addTask({
  title: 'Rollover Habit Task',
  subject: null,
  recurrence: 'daily',
  dueDate: yesterdayLocalStr
});
assert.equal(rolloverSeed.dueDate, yesterdayLocalStr);

// Run rollover generation
store.ensureRecurringTaskOccurrences(store.state);

const seriesInstances = store.getState().tasks.filter((t) => t.title === 'Rollover Habit Task');
const yestInst = seriesInstances.find((t) => t.dueDate === yesterdayLocalStr);
const todayInst = seriesInstances.find((t) => t.dueDate === todayLocalStr);

assert.ok(yestInst && !yestInst.completed, 'Yesterday uncompleted daily occurrence should remain at dueDate = yesterday');
assert.ok(todayInst && !todayInst.completed, 'Today daily occurrence should be rolled/created at dueDate = today');

// Checking off yesterday must mark yesterday completed WITHOUT duplicating today's task
store.toggleTaskForDate(yestInst.id, yesterdayLocalStr);
const yestAfter = store.getState().tasks.find((t) => t.id === yestInst.id);
const todayCountAfter = store.getState().tasks.filter((t) => t.title === 'Rollover Habit Task' && t.dueDate === todayLocalStr).length;
assert.equal(yestAfter.completed, true, 'Checking yesterday task marks yesterday done');
assert.equal(todayCountAfter, 1, 'Checking yesterday task must NOT duplicate today occurrence');
assert.equal(todayInst.completed, false, 'Today task must remain unchecked when yesterday is checked');

// Relative due date label checks
const fmt = ChronoUI.prototype.formatRelativeDueDate;
assert.equal(fmt(todayLocalStr, todayLocalStr, { includePrefix: true }), 'Due: Today');
assert.equal(fmt(yesterdayLocalStr, todayLocalStr, { includePrefix: true }), 'Due: Yesterday');
assert.equal(fmt(tomorrowLocalStr, todayLocalStr, { includePrefix: true }), 'Due: Tomorrow');
assert.equal(fmt(yesterdayLocalStr, todayLocalStr, { includePrefix: false }), 'Yesterday');

// --- Test 7: Frequent Recurring vs Weekly/One-Time Overdue Expiration ---
console.log('Test 7: Frequent recurring expiration (>1 day old hidden from Task Bar Overdue) vs weekly/one-time...');
const twoDaysAgo = new Date(nowLocal);
twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
const twoDaysAgoStr = toLocalDateStr(twoDaysAgo);

assert.equal(store.isFrequentRecurringTask({ recurrence: 'daily' }), true);
assert.equal(store.isFrequentRecurringTask({ recurrence: 'weekdays' }), true);
assert.equal(store.isFrequentRecurringTask({ recurrence: 'custom_days', recurrenceInterval: 3 }), true);
assert.equal(store.isFrequentRecurringTask({ recurrence: 'weekly' }), false);
assert.equal(store.isFrequentRecurringTask({ recurrence: 'none' }), false);

const oldDaily = { id: 'old-d', recurrence: 'daily', dueDate: twoDaysAgoStr, completed: false };
const yestDaily = { id: 'yest-d', recurrence: 'daily', dueDate: yesterdayLocalStr, completed: false };
const oldWeekly = { id: 'old-w', recurrence: 'weekly', dueDate: twoDaysAgoStr, completed: false };
const oldOneOff = { id: 'old-o', recurrence: 'none', dueDate: twoDaysAgoStr, completed: false };

assert.equal(store.isExpiredFrequentTask(oldDaily, todayLocalStr), true, 'Daily task >= 2 days old must be excluded from Task Bar Overdue');
assert.equal(store.isExpiredFrequentTask(yestDaily, todayLocalStr), false, 'Yesterday daily task remains visible in Yesterday');
assert.equal(store.isExpiredFrequentTask(oldWeekly, todayLocalStr), false, 'Weekly task >= 2 days old must stay in Overdue');
assert.equal(store.isExpiredFrequentTask(oldOneOff, todayLocalStr), false, 'One-time task >= 2 days old must stay in Overdue');

// --- Test 8: Sync & Rollover Reconciliation Never Unchecks Completed Yesterday Tasks ---
console.log('Test 8: Cross-device sync race, duplicate IDs, and completedAt reconciliation...');

// 8A: Cross-device race where local auto-generated placeholder for yesterday has completed:false
//     while remote has real completion on yesterday (earlier updatedAt than local boot)
const yestMidTs = `${yesterdayLocalStr}T18:00:00.000Z`;
const raceTask = {
  id: 'task-occ-race-yest',
  title: 'Evening Sync Habit',
  subject: null,
  recurrence: 'daily',
  dueDate: yesterdayLocalStr,
  completed: false,
  autoGenerated: true,
  completedDates: {},
  createdAt: `${yesterdayLocalStr}T00:00:00.000Z`,
  updatedAt: new Date(Date.now() + 60000).toISOString(), // artificially newer local timestamp
  completedAt: null
};
store.state.tasks.unshift(raceTask);
store.mergeRemoteState({
  version: 12,
  tasks: [
    {
      id: 'task-occ-race-yest',
      title: 'Evening Sync Habit',
      subject: null,
      recurrence: 'daily',
      dueDate: yesterdayLocalStr,
      completed: true,
      autoGenerated: false,
      completedDates: { [yesterdayLocalStr]: yestMidTs },
      createdAt: `${yesterdayLocalStr}T00:00:00.000Z`,
      updatedAt: yestMidTs,
      completedAt: yestMidTs
    }
  ]
});
const resolvedRace = store.getState().tasks.find((t) => t.id === 'task-occ-race-yest');
assert.equal(resolvedRace.completed, true, 'Remote completion must win over autoGenerated placeholder even with older timestamp');
assert.equal(resolvedRace.completedDates[yesterdayLocalStr], yestMidTs);

// 8B: Different-ID duplicate sync for the same recurring series & date (completed task-A vs uncompleted task-B)
store.state.tasks.unshift({
  id: 'task-diff-A',
  title: 'Different ID Habit',
  subject: null,
  recurrence: 'daily',
  dueDate: yesterdayLocalStr,
  completed: true,
  completedDates: { [yesterdayLocalStr]: yestMidTs },
  createdAt: yestMidTs,
  updatedAt: yestMidTs,
  completedAt: yestMidTs
});
store.mergeRemoteState({
  version: 12,
  tasks: [
    {
      id: 'task-diff-B',
      title: 'Different ID Habit',
      subject: null,
      recurrence: 'daily',
      dueDate: yesterdayLocalStr,
      completed: false,
      autoGenerated: true,
      completedDates: {},
      createdAt: `${yesterdayLocalStr}T00:00:00.000Z`,
      updatedAt: new Date().toISOString()
    }
  ]
});
const diffSeriesYest = store.getState().tasks.filter((t) => t.title === 'Different ID Habit' && t.dueDate === yesterdayLocalStr);
assert.equal(diffSeriesYest.length, 1, 'Duplicate tasks on yesterday for same series must deduplicate to 1');
assert.equal(diffSeriesYest[0].completed, true, 'Completed task-A must win over uncompleted duplicate task-B');

// 8C: Task with older dueDate (2 days ago) completed yesterday (completedAt = yesterday)
//     must prevent uncompleted yesterday occurrence from staying in Yesterday
const olderCompletedState = {
  version: 12,
  tasks: [
    {
      id: 'task-older-completed',
      title: 'Was Completed Yesterday Habit',
      subject: null,
      recurrence: 'daily',
      dueDate: twoDaysAgoStr,
      completed: true,
      completedDates: {},
      createdAt: `${twoDaysAgoStr}T09:00:00.000Z`,
      updatedAt: `${yesterdayLocalStr}T21:00:00.000Z`,
      completedAt: new Date(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate() - 1, 21, 0, 0).toISOString()
    },
    {
      id: 'task-older-spawned-yest',
      title: 'Was Completed Yesterday Habit',
      subject: null,
      recurrence: 'daily',
      dueDate: yesterdayLocalStr,
      completed: false,
      autoGenerated: true,
      completedDates: {},
      createdAt: `${yesterdayLocalStr}T00:00:00.000Z`,
      updatedAt: `${yesterdayLocalStr}T00:00:00.000Z`
    }
  ],
  sessions: [],
  subjects: [],
  weeklyEvents: []
};
store.sanitizeState(olderCompletedState);
const reconciledYest = olderCompletedState.tasks.find((t) => t.id === 'task-older-spawned-yest');
assert.equal(reconciledYest.completed, true, 'Yesterday occurrence must automatically be marked completed when series was completed yesterday');

console.log('ALL PLANNER, MIDNIGHT, TASK-SUBJECT SYNC & SESSION COUNT TESTS PASSED!');
