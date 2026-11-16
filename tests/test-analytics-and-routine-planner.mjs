import assert from 'node:assert/strict';

function setupBrowserMocks() {
  const storage = new Map();
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

setupBrowserMocks();

const { store, toLocalDateStr } = await import('../src/store.js');

// --- Test 1: Routine / Recurring Task Date Matching for Daily Planner ---
console.log('Testing store.doesTaskOccurOnDate...');

const oneOff = { id: 't1', title: 'Exam prep', recurrence: 'none', dueDate: '2026-11-17' };
assert.equal(store.doesTaskOccurOnDate(oneOff, '2026-11-17'), true);
assert.equal(store.doesTaskOccurOnDate(oneOff, '2026-11-18'), false);

const dailyTask = { id: 't2', title: 'Daily Arabic Vocab', recurrence: 'daily', dueDate: '2026-11-17' };
assert.equal(store.doesTaskOccurOnDate(dailyTask, '2026-11-16'), false, 'Daily task should not project before dueDate');
assert.equal(store.doesTaskOccurOnDate(dailyTask, '2026-11-17'), true);
assert.equal(store.doesTaskOccurOnDate(dailyTask, '2026-11-18'), true);
assert.equal(store.doesTaskOccurOnDate(dailyTask, '2026-11-22'), true);

// 2026-11-17 is Tuesday; 2026-11-21 is Saturday, 2026-11-22 is Sunday, 2026-11-23 is Monday
const weekdayTask = { id: 't3', title: 'Weekday Review', recurrence: 'weekdays', dueDate: '2026-11-17' };
assert.equal(store.doesTaskOccurOnDate(weekdayTask, '2026-11-20'), true, 'Friday should match weekdays');
assert.equal(store.doesTaskOccurOnDate(weekdayTask, '2026-11-21'), false, 'Saturday should NOT match weekdays');
assert.equal(store.doesTaskOccurOnDate(weekdayTask, '2026-11-22'), false, 'Sunday should NOT match weekdays');
assert.equal(store.doesTaskOccurOnDate(weekdayTask, '2026-11-23'), true, 'Monday should match weekdays');

const weeklyTask = { id: 't4', title: 'Weekly Lab Prep', recurrence: 'weekly', dueDate: '2026-11-17' };
assert.equal(store.doesTaskOccurOnDate(weeklyTask, '2026-11-18'), false);
assert.equal(store.doesTaskOccurOnDate(weeklyTask, '2026-11-24'), true, '7 days later should match weekly');

const monthlyTask = { id: 't5', title: 'Monthly Review', recurrence: 'monthly', dueDate: '2026-11-17' };
assert.equal(store.doesTaskOccurOnDate(monthlyTask, '2026-12-17'), true, 'Same day next month should match monthly');
assert.equal(store.doesTaskOccurOnDate(monthlyTask, '2026-12-18'), false);

// --- Test 2: Analytics Detailed Subject Breakdown & Previous Weeks History ---
console.log('Testing store.getAnalyticsData with weekly history & subject details...');

store.state.subjects = [
  { id: 'sub-1', name: 'EHB 208E', code: 'EHB 208E', group: 'İTÜ Courses (Fall 2026)', color: '#60a5fa', targetWeeklyHours: 4 },
  { id: 'sub-2', name: 'LÜGÂT', code: 'LÜGÂT', group: 'LÜGÂT', color: '#f59e0b', targetWeeklyHours: 2 }
];

const now = new Date();
const day = now.getDay();
const distToMon = (day + 6) % 7;
const thisMonday = new Date(now);
thisMonday.setDate(now.getDate() - distToMon);
thisMonday.setHours(10, 0, 0, 0);

const lastMonday = new Date(thisMonday);
lastMonday.setDate(thisMonday.getDate() - 7);

const twoWeeksAgoMonday = new Date(thisMonday);
twoWeeksAgoMonday.setDate(thisMonday.getDate() - 14);

store.state.sessions = [
  {
    id: 's-cur-1',
    subject: 'EHB 208E',
    topic: 'Signals Lab',
    durationSec: 3600, // 1h
    startTime: thisMonday.toISOString(),
    endTime: new Date(thisMonday.getTime() + 3600000).toISOString(),
    createdAt: thisMonday.toISOString()
  },
  {
    id: 's-cur-2',
    subject: 'EHB 208E',
    topic: 'Signals HW',
    durationSec: 1800, // 30m
    startTime: new Date(thisMonday.getTime() + 7200000).toISOString(),
    endTime: new Date(thisMonday.getTime() + 9000000).toISOString(),
    createdAt: thisMonday.toISOString()
  },
  {
    id: 's-prev-1',
    subject: 'LÜGÂT',
    topic: 'Vocabulary',
    durationSec: 5400, // 1.5h
    startTime: lastMonday.toISOString(),
    endTime: new Date(lastMonday.getTime() + 5400000).toISOString(),
    createdAt: lastMonday.toISOString()
  },
  {
    id: 's-prev2-1',
    subject: 'EHB 208E',
    topic: 'Midterm Review',
    durationSec: 7200, // 2h
    startTime: twoWeeksAgoMonday.toISOString(),
    endTime: new Date(twoWeeksAgoMonday.getTime() + 7200000).toISOString(),
    createdAt: twoWeeksAgoMonday.toISOString()
  }
];

// Current week (weekOffset: 0, subjectScope: 'week')
const curWeek = store.getAnalyticsData({ weekOffset: 0, subjectScope: 'week' });
assert.equal(curWeek.weekSec, 5400);
assert.equal(curWeek.prevWeekSec, 5400);
assert.equal(curWeek.weekSessionsCount, 2);
assert.equal(curWeek.totalSec, 18000);
assert.equal(curWeek.subjectBreakdown.length, 1);
assert.equal(curWeek.subjectBreakdown[0].name, 'EHB 208E');
assert.equal(curWeek.subjectBreakdown[0].sessionCount, 2);
assert.equal(curWeek.subjectBreakdown[0].avgSessionMins, 45);
assert.equal(curWeek.subjectBreakdown[0].formattedTime, '1h 30m');
assert.equal(curWeek.subjectBreakdown[0].goalPct, 38); // 1.5 / 4 = 37.5% -> 38%

// Last week (weekOffset: -1, subjectScope: 'week')
const prevWeek = store.getAnalyticsData({ weekOffset: -1, subjectScope: 'week' });
assert.equal(prevWeek.weekSec, 5400);
assert.equal(prevWeek.prevWeekSec, 7200);
assert.equal(prevWeek.subjectBreakdown.length, 1);
assert.equal(prevWeek.subjectBreakdown[0].name, 'LÜGÂT');
assert.equal(prevWeek.subjectBreakdown[0].formattedTime, '1h 30m');

// Weekly history contains recorded weeks
const twoWeeksBucket = curWeek.weeklyHistory.find((w) => w.weekOffset === -2);
assert.ok(twoWeeksBucket, 'Two weeks ago bucket should be recorded in weeklyHistory');
assert.equal(twoWeeksBucket.durationSec, 7200);
assert.equal(twoWeeksBucket.subjectTotals['EHB 208E'], 7200);

// All-time subject scope
const allTime = store.getAnalyticsData({ weekOffset: 0, subjectScope: 'all' });
assert.equal(allTime.subjectBreakdown.length, 2);
assert.equal(allTime.subjectBreakdown[0].name, 'EHB 208E');
assert.equal(allTime.subjectBreakdown[0].durationSec, 12600); // 1h + 30m + 2h = 3.5h
assert.equal(allTime.subjectBreakdown[0].sessionCount, 3);

// Backward compatibility with no arguments
const compat = store.getAnalyticsData();
assert.equal(compat.totalSessions, 4);

console.log('ALL ANALYTICS & ROUTINE PLANNER TESTS PASSED!');
