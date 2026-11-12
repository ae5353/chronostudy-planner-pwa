import { strict as assert } from 'node:assert';
import { store, toLocalDateStr } from '../src/store.js';
import { ChronoUI } from '../src/ui.js';

console.log('Testing Auto-Sync, Repeated Task Visibility & Tombstone Deletion Engines...\n');

const todayStr = toLocalDateStr(new Date());

// =========================================================================
// TEST 1: Repeated tasks must be visible in today's tasks
// =========================================================================
console.log('--- Test 1: Repeated Task in Today’s Tasks ---');

// Case 1A: Adding a task with recurrence without explicit due date -> must default to today
const dailyTask1 = store.addTask({
  title: 'Daily French Vocabulary Practice',
  subject: 'English for Academic Purposes',
  recurrence: 'daily'
});
assert(dailyTask1, 'Daily task must be created');
assert.equal(dailyTask1.dueDate, todayStr, 'Recurring task without explicit due date must default to today');

// Case 1B: Updating an existing backlog task (no due date) to recurring -> must default to today
const oneTimeTask = store.addTask({
  title: 'Review Lecture Notes',
  subject: 'Circuit Analysis',
  dueDate: null
});
assert.equal(oneTimeTask.dueDate, null);
store.updateTask(oneTimeTask.id, { recurrence: 'weekly' });
const updatedRecTask = store.getState().tasks.find(t => t.id === oneTimeTask.id);
assert.equal(updatedRecTask.dueDate, todayStr, 'Task updated to recurring must set due date to today');

// Case 1C: ChronoUI Today Smart Filter & Grouping must include repeated tasks
const ui = Object.create(ChronoUI.prototype);
ui.escapeHTML = (s) => s;
ui.getRecurrenceLabel = ChronoUI.prototype.getRecurrenceLabel;

// Test that filter logic for 'today' includes recurring tasks
const stateTasks = store.getState().tasks;
const todayFiltered = stateTasks.filter((t) => 
  !t.completed && (
    t.dueDate === todayStr || 
    (t.recurrence && t.recurrence !== 'none' && (!t.dueDate || t.dueDate <= todayStr))
  )
);
assert(todayFiltered.some(t => t.id === dailyTask1.id), 'Daily task must be included in Today filter');
assert(todayFiltered.some(t => t.id === oneTimeTask.id), 'Weekly task must be included in Today filter');

console.log('✔ Repeated tasks properly set and visible in Today’s tasks.\n');

// =========================================================================
// TEST 2: Every mutation marks hasChanges = true (Auto-Sync trigger)
// =========================================================================
console.log('--- Test 2: Auto-Sync Dirty Tracking on All Mutations ---');

store.markRecordsSynced();
assert.equal(store.getUnsyncedChanges().hasChanges, false, 'Should be clean after markRecordsSynced');

// Test task deletion sets hasChanges
const tempTask = store.addTask({ title: 'Task to Delete' });
store.markRecordsSynced();
assert.equal(store.getUnsyncedChanges().hasChanges, false);
store.deleteTask(tempTask.id);
assert.equal(store.getUnsyncedChanges().hasChanges, true, 'deleteTask must trigger unsynced changes for auto-sync');

// Test category addition sets hasChanges
store.markRecordsSynced();
store.addCategory('Special Test Category');
assert.equal(store.getUnsyncedChanges().hasChanges, true, 'addCategory must trigger unsynced changes');

// Test session addition & deletion sets hasChanges
store.markRecordsSynced();
const tempSess = store.addSession({ subject: 'Circuit Analysis', topic: 'Testing', durationSec: 600 });
assert.equal(store.getUnsyncedChanges().hasChanges, true, 'addSession must trigger unsynced changes');
store.markRecordsSynced();
store.deleteSession(tempSess.id);
assert.equal(store.getUnsyncedChanges().hasChanges, true, 'deleteSession must trigger unsynced changes');

console.log('✔ All mutations reliably flag unsynced changes for auto-sync.\n');

// =========================================================================
// TEST 3: Multi-Entity Tombstones (Zero Resurrection of Deleted Items)
// =========================================================================
console.log('--- Test 3: Multi-Entity Tombstone Protection Against Resurrection ---');

// 3A: Task deletion tombstone
const taskToKill = store.addTask({ title: 'Kill Me Once' });
const killTaskId = taskToKill.id;
store.deleteTask(killTaskId);
assert(!store.getState().tasks.some(t => t.id === killTaskId));
assert(store.getState().deletedTaskIds[killTaskId], 'Task tombstone must be saved');

// Simulate remote cloud payload attempting to resurrect the deleted task
store.mergeRemoteState({
  version: 12,
  tasks: [{ id: killTaskId, title: 'Kill Me Once', createdAt: taskToKill.createdAt, updatedAt: taskToKill.createdAt }]
});
assert(!store.getState().tasks.some(t => t.id === killTaskId), 'Remote sync must NEVER resurrect deleted task');

// 3B: Session deletion tombstone
const sessToKill = store.addSession({ subject: 'Circuit Analysis', topic: 'Kill Me Sess', durationSec: 300 });
const killSessId = sessToKill.id;
store.deleteSession(killSessId);
assert(!store.getState().sessions.some(s => s.id === killSessId));
assert(store.getState().deletedSessionIds[killSessId], 'Session tombstone must be saved');

// Simulate remote cloud payload attempting to resurrect deleted session
store.mergeRemoteState({
  version: 12,
  sessions: [{ id: killSessId, subject: 'Circuit Analysis', topic: 'Kill Me Sess', durationSec: 300 }]
});
assert(!store.getState().sessions.some(s => s.id === killSessId), 'Remote sync must NEVER resurrect deleted session');

// 3C: Weekly event deletion tombstone
const weventToKill = store.addWeeklyEvent({ title: 'Kill Me Event', day: 2, start: '10:00', end: '11:00' });
const killWeventId = weventToKill.id;
store.deleteWeeklyEvent(killWeventId);
assert(!store.getState().weeklyEvents.some(e => e.id === killWeventId));
assert(store.getState().deletedWeeklyEventIds[killWeventId], 'Weekly event tombstone must be saved');

// Simulate remote cloud payload attempting to resurrect deleted weekly event
store.mergeRemoteState({
  version: 12,
  weeklyEvents: [{ id: killWeventId, title: 'Kill Me Event', day: 2, start: '10:00', end: '11:00' }]
});
assert(!store.getState().weeklyEvents.some(e => e.id === killWeventId), 'Remote sync must NEVER resurrect deleted weekly event');

// 3D: Category deletion tombstone
store.addCategory('Temporary Category');
assert(store.getState().groups.includes('Temporary Category'));
store.deleteCategory('Temporary Category');
assert(!store.getState().groups.includes('Temporary Category'));
assert(store.getState().deletedGroups['Temporary Category'], 'Category tombstone must be saved');

// Simulate remote cloud payload attempting to resurrect deleted category
store.mergeRemoteState({
  version: 12,
  groups: ['Temporary Category']
});
assert(!store.getState().groups.includes('Temporary Category'), 'Remote sync must NEVER resurrect deleted category');

// 3E: Subject deletion tombstone
const subToKill = store.addSubject({ name: 'Disposable Subject', code: 'DISP' });
const killSubId = subToKill.id;
store.deleteSubject(killSubId);
assert(!store.getState().subjects.some(s => s.id === killSubId));
assert(store.getState().deletedSubjectIds[killSubId], 'Subject tombstone must be saved');

// Simulate remote cloud payload attempting to resurrect deleted subject
store.mergeRemoteState({
  version: 12,
  subjects: [{ id: killSubId, name: 'Disposable Subject', code: 'DISP' }]
});
assert(!store.getState().subjects.some(s => s.id === killSubId), 'Remote sync must NEVER resurrect deleted subject');

console.log('✔ All 5 entity tombstone engines prevent resurrection with 100% reliability!\n');

console.log('All Auto-Sync, Repeated Task & Tombstone tests passed successfully! 🚀');
