// tests/test-core.mjs — Comprehensive unit tests for Store, Subject Management, Calendar & Timer logic
import { strict as assert } from 'node:assert';

// Mock localStorage for Node test environment
global.localStorage = {
  data: {},
  getItem(k) { return this.data[k] || null; },
  setItem(k, v) { this.data[k] = String(v); },
  removeItem(k) { delete this.data[k]; },
  clear() { this.data = {}; }
};

// Import Store
const { store } = await import('../src/store.js');

console.log('Testing ChronoStudy core logic with new revisions...\n');

// 1. Initial State & Authentic User Courses
const subjects = store.getState().subjects;
assert(subjects.length >= 8, 'Should have user authentic subjects');
assert(subjects.some(s => s.name.includes('Circuit Analysis')), 'Should include Circuit Analysis');
assert(subjects.some(s => s.name.includes('Optimization')), 'Should include Introduction to Optimization');
assert(subjects.some(s => s.name.includes('Differential Equations')), 'Should include Differential Equations');
assert(subjects.some(s => s.name.includes('Data Structures')), 'Should include Data Structures');
assert(subjects.some(s => s.name.includes('Kardeşlik ve İhya')), 'Should include Kardeşlik ve İhya Akademisi');
assert(subjects.some(s => s.group === 'İTÜ Courses (Fall 2026)'), 'Should have İTÜ Courses group');
assert(subjects.some(s => s.folderPath && s.folderPath.includes('Desktop')), 'Should have assigned folder path');
console.log('✔ Authentic current courses & groups loaded properly.');

// 2. Add, Edit, Delete Subject with Group & FolderPath
const newSub = store.addSubject({
  name: 'Sample Test Subject',
  color: '#ec4899',
  code: 'TEST',
  targetWeeklyHours: 4,
  group: 'Seminars & Academies',
  folderPath: 'C:\\Users\\Arif E. Yıldırım\\Desktop\\Test'
});
assert(newSub && newSub.id, 'Subject must be created');
assert.equal(newSub.code, 'TEST');
assert.equal(newSub.group, 'Seminars & Academies');
assert.equal(newSub.folderPath, 'C:\\Users\\Arif E. Yıldırım\\Desktop\\Test');

store.updateSubject(newSub.id, { name: 'Updated Test Subject', color: '#06b6d4', targetWeeklyHours: 6 });
let fetchedSub = store.getState().subjects.find(s => s.id === newSub.id);
assert.equal(fetchedSub.name, 'Updated Test Subject');
assert.equal(fetchedSub.color, '#06b6d4');
assert.equal(fetchedSub.targetWeeklyHours, 6);

const stats = store.getSubjectStats('Updated Test Subject');
assert(typeof stats.totalMinutes === 'number', 'Stats must return totalMinutes');
assert(typeof stats.thisWeekHours === 'string', 'Stats must return thisWeekHours');

store.deleteSubject(newSub.id);
assert(!store.getState().subjects.some(s => s.id === newSub.id), 'Subject should be deleted');
console.log('✔ Subject management (Add, Edit, Delete, Groups, Folders, Stats) verified.');

// 2b. Category Renaming & Management (User Requirement)
assert(store.getGroups().length >= 2, 'Should have initial categories');
store.addCategory('Library & Books');
assert(store.getGroups().includes('Library & Books'), 'Library & Books category should be added');

// Test renaming category and cascade to subjects
const beforeCount = store.getState().subjects.filter(s => s.group === 'İTÜ Courses (Fall 2026)').length;
assert(beforeCount >= 8, 'Should have İTÜ courses');
store.renameCategory('İTÜ Courses (Fall 2026)', 'İTÜ Courses (Renamed)');
assert(store.getGroups().includes('İTÜ Courses (Renamed)'), 'New category name must exist in groups');
assert(!store.getGroups().includes('İTÜ Courses (Fall 2026)'), 'Old category name should be replaced');
const afterCount = store.getState().subjects.filter(s => s.group === 'İTÜ Courses (Renamed)').length;
assert.equal(beforeCount, afterCount, 'All subjects in old category must cascade to new category');

// Rename back for consistency
store.renameCategory('İTÜ Courses (Renamed)', 'İTÜ Courses (Fall 2026)');
store.deleteCategory('Library & Books');
assert(!store.getGroups().includes('Library & Books'), 'Deleted category should be removed');
console.log('✔ Category management & cascade renaming verified.');

// 3. Task Management with Optional Due Date & Target Minutes
const task = store.addTask({
  title: 'Circuit Analysis Problem Set 5',
  subject: 'Circuit Analysis',
  targetMinutes: 60,
  dueDate: '2026-11-10'
});
assert(task && task.dueDate === '2026-11-10', 'Task must have dueDate');

const backlogTask = store.addTask({
  title: 'General Reading on Graph Theory',
  subject: 'Circuit Analysis',
  targetMinutes: null,
  dueDate: null
});
assert(backlogTask && backlogTask.dueDate === null, 'Backlog task must have null dueDate');
assert(backlogTask.targetMinutes === null, 'Backlog task must have null targetMinutes');

// Task without any course / subject (General to-do)
const noCourseTask = store.addTask({
  title: 'Buy stationery and renew library card',
  subject: null,
  targetMinutes: null,
  dueDate: null
});
assert(noCourseTask, 'Task without course must be created');
assert.strictEqual(noCourseTask.subject, null, 'Task subject must be null when no course specified');

// Recurring Task test (weekly repetition)
const recTask = store.addTask({
  title: 'Weekly Folland Problem Review',
  subject: 'Advanced Calculus',
  targetMinutes: 45,
  dueDate: '2026-11-10',
  recurrence: 'weekly'
});
assert.equal(recTask.recurrence, 'weekly');
store.toggleTask(recTask.id); // Mark completed
assert(recTask.completed, 'Task should be completed');
const nextRecTask = store.getState().tasks.find(t => !t.completed && t.title === 'Weekly Folland Problem Review');
assert(nextRecTask, 'Next occurrence of weekly task must be spawned');
assert.equal(nextRecTask.dueDate, '2026-11-17', 'Next weekly task must be 7 days later');

// Verify wide recurrence calculations
assert.equal(store.calculateNextRecurrenceDate('2026-11-10', 'daily'), '2026-11-11', 'Daily must advance 1 day');
// Friday 2026-11-13 to Monday 2026-11-16
assert.equal(store.calculateNextRecurrenceDate('2026-11-13', 'weekdays'), '2026-11-16', 'Weekdays must skip Saturday & Sunday to Monday');
assert.equal(store.calculateNextRecurrenceDate('2026-11-10', 'biweekly'), '2026-11-24', 'Bi-weekly must advance 14 days');
assert.equal(store.calculateNextRecurrenceDate('2026-11-10', 'triweekly'), '2026-12-01', 'Tri-weekly must advance 21 days');
assert.equal(store.calculateNextRecurrenceDate('2026-11-10', 'monthly'), '2026-12-10', 'Monthly must advance 1 month');

// Verify Task Editing
store.updateTask(task.id, {
  title: 'Circuit Analysis Problem Set 5 (Revised)',
  targetMinutes: 90,
  dueDate: '2026-11-12',
  notes: 'Review nodal analysis and superposition'
});
const editedTask = store.getState().tasks.find(t => t.id === task.id);
assert.equal(editedTask.title, 'Circuit Analysis Problem Set 5 (Revised)', 'Task title must be updated');
assert.equal(editedTask.targetMinutes, 90, 'Task target minutes must be updated');
assert.equal(editedTask.dueDate, '2026-11-12', 'Task due date must be updated');
assert.equal(editedTask.notes, 'Review nodal analysis and superposition', 'Task notes must be updated');
assert.equal(editedTask.synced, false, 'Edited task must be flagged as unsynced');

console.log('✔ Task management with editing, recurrence, optional due dates and minutes verified.');

// 4. Recurring Events with Cadence (Weekly, Bi-weekly, Monthly, Daily, Weekdays)
const wevent = store.addWeeklyEvent({
  title: 'Haftalık Müzakere',
  day: 4,
  start: '19:00',
  end: '21:30',
  category: 'Seminars & Academies',
  color: '#059669',
  recurrence: 'biweekly',
  notes: 'Kardeşlik ve İhya'
});
assert(wevent && wevent.id, 'Weekly event should be created');
assert.equal(wevent.recurrence, 'biweekly', 'Event should have biweekly cadence');
assert(store.getState().weeklyEvents.some(e => e.id === wevent.id), 'Weekly event must exist in store');

store.updateWeeklyEvent(wevent.id, { start: '19:30', end: '22:00', recurrence: 'monthly', title: 'Haftalık Müzakere (Updated)' });
const updatedWevent = store.getState().weeklyEvents.find(e => e.id === wevent.id);
assert.equal(updatedWevent.start, '19:30');
assert.equal(updatedWevent.end, '22:00');
assert.equal(updatedWevent.recurrence, 'monthly', 'Event recurrence should update to monthly');
assert.equal(updatedWevent.title, 'Haftalık Müzakere (Updated)');

store.deleteWeeklyEvent(wevent.id);
assert(!store.getState().weeklyEvents.some(e => e.id === wevent.id), 'Weekly event should be deleted');

// Settings, Typography & Layout Formats
store.updateSettings({ fontStyle: 'cinzel', theme: 'bibliotheca', timerStyle: 'cadran', layoutFormat: 'mobile' });
assert.equal(store.getState().settings.fontStyle, 'cinzel', 'Font style setting should persist');
assert.equal(store.getState().settings.theme, 'bibliotheca', 'Theme setting should persist');
assert.equal(store.getState().settings.timerStyle, 'cadran', 'Timer style setting should persist');
assert.equal(store.getState().settings.layoutFormat, 'mobile', 'Layout format setting should persist');

// Lecture Slot management on a subject
const testSubId = store.getState().subjects[0].id;
const initialSlotCount = store.getState().subjects[0].schedule.length;
store.addLectureSlot(testSubId, { day: 5, start: '16:30', end: '18:20', label: 'Lab' });
assert.equal(store.getState().subjects[0].schedule.length, initialSlotCount + 1);
store.updateLectureSlot(testSubId, initialSlotCount, { day: 5, start: '17:00', end: '19:00', label: 'Recitation' });
assert.equal(store.getState().subjects[0].schedule[initialSlotCount].start, '17:00');
store.deleteLectureSlot(testSubId, initialSlotCount);
assert.equal(store.getState().subjects[0].schedule.length, initialSlotCount);
console.log('✔ Recurring weekly event & lecture slot management verified.');

// 4. Google Calendar iCal Export (Requirement 2)
const ics = store.generateICS();
assert(ics.includes('BEGIN:VCALENDAR'), 'ICS must include header');
assert(ics.includes('Circuit Analysis Problem Set 5'), 'ICS must include task title');
assert(ics.includes('END:VCALENDAR'), 'ICS must include footer');
console.log('✔ Google Calendar iCal export verified.');

// 5. Study Session Logging
const sess = store.addSession({
  subject: 'Circuit Analysis',
  topic: 'Nodal and Mesh Analysis',
  taskId: task.id,
  durationSec: 3600,
  notes: 'Understood supermesh and source transformation.'
});
assert(sess && sess.durationSec === 3600);
const todayStats = store.getTodayStats();
assert(todayStats.totalSecondsToday >= 3600);
console.log('✔ Session logging verified.');

// 6. Analytics Engine & CSV Export
const analytics = store.getAnalyticsData();
assert(analytics.totalSec >= 3600, 'Analytics total seconds must be >= 3600');
assert(analytics.totalSessions >= 1, 'Analytics total sessions count must be >= 1');
assert(Array.isArray(analytics.dailyTrend) && analytics.dailyTrend.length === 7, '7-day trend must exist');
assert(Array.isArray(analytics.subjectBreakdown), 'Subject breakdown must be an array');
assert(analytics.subjectBreakdown.some(sb => sb.name === 'Circuit Analysis'), 'Circuit Analysis must be present in breakdown');

const csv = store.generateCSV();
assert(csv.includes('Session ID,Date,Start Time,End Time,Duration (Minutes),Subject,Topic,Notes'), 'CSV must contain standard headers');
assert(csv.includes('Circuit Analysis'), 'CSV must contain logged session subject');
console.log('✔ Study Analytics engine and CSV export verified.');

console.log('\nAll tests passed successfully! 🚀');
