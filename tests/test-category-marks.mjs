import assert from 'node:assert';
import { store, DEFAULT_GROUPS, INITIAL_SUBJECTS, INITIAL_WEEKLY_EVENTS } from '../src/store.js';

console.log('Testing category preservation and dynamic marks...');

// 1. Simulate state from user's screenshot
const userState = {
  version: 12,
  groups: [
    'İTÜ Courses (Fall 2026)',
    'Seminars & Academies', // From previous bad sync
    'Kardeşlik ve İhya',
    'LÜGÂT',
    'Seçkin Sanatlar Derneği'
  ],
  subjects: [
    ...INITIAL_SUBJECTS.map(s => {
      if (s.id === 'sub-ihya') return { ...s, group: 'Seminars & Academies' };
      return { ...s };
    }),
    { id: 'sub-lugat-1', name: 'Osmanlı Türkçesi', code: 'LGT 101', group: 'LÜGÂT', color: '#8b5cf6' }
  ],
  weeklyEvents: [
    {
      id: 'wevent-ihya',
      title: 'Kardeşlik ve İhya Akademisi',
      day: 4,
      start: '19:00',
      end: '21:30',
      category: 'Seminars & Academies',
      color: '#059669',
      recurrence: 'weekly'
    }
  ],
  tasks: [
    { id: 'custom-task-1', title: 'User Custom Task', dueDate: '2026-11-20', completed: false }
  ]
};

const sanitized = store.sanitizeState(userState);

// Check 1: User categories are fully preserved and bad 'Seminars & Academies' is purged
assert(sanitized.groups.includes('İTÜ Courses (Fall 2026)'), 'Must include ITU Courses');
assert(sanitized.groups.includes('Kardeşlik ve İhya'), 'Must include Kardeşlik ve İhya');
assert(sanitized.groups.includes('LÜGÂT'), 'Must preserve user group LÜGÂT');
assert(sanitized.groups.includes('Seçkin Sanatlar Derneği'), 'Must preserve user group Seçkin Sanatlar Derneği');
assert(!sanitized.groups.includes('Seminars & Academies'), 'Must remove Seminars & Academies');

// Check 2: sub-ihya and wevent-ihya moved to Kardeşlik ve İhya
const ihyaSub = sanitized.subjects.find(s => s.id === 'sub-ihya');
assert.equal(ihyaSub.group, 'Kardeşlik ve İhya', 'sub-ihya must belong to Kardeşlik ve İhya');

const ihyaEv = sanitized.weeklyEvents.find(e => e.id === 'wevent-ihya');
assert.equal(ihyaEv.category, 'Kardeşlik ve İhya', 'wevent-ihya must belong to Kardeşlik ve İhya');

// Check 3: User custom tasks are untouched
const customTask = sanitized.tasks.find(t => t.id === 'custom-task-1');
assert.equal(customTask.dueDate, '2026-11-20', 'Task due date must not be changed');
assert.equal(customTask.completed, false, 'Task completed status must not be changed');

// Check 4: Dynamic category marks in ChronoUI
import { ChronoUI } from '../src/ui.js';

store.state = sanitized;
const ui = Object.create(ChronoUI.prototype);
ui.escapeHTML = (s) => s;
const htmlDay4 = ui.renderDayClassLectures(4); // Thursday

assert(!htmlDay4.includes('İTÜ Lectures:'), 'Hardcoded "İTÜ Lectures:" must be removed');
assert(!htmlDay4.includes('Academies & Routines:'), 'Hardcoded "Academies & Routines:" must be removed');
assert(htmlDay4.includes('İTÜ Courses (Fall 2026):'), 'Must dynamically display "İTÜ Courses (Fall 2026):" mark');
assert(htmlDay4.includes('Kardeşlik ve İhya:'), 'Must dynamically display "Kardeşlik ve İhya:" mark');

console.log('✔ All category sanitization, dynamic marks, and user data preservation tests passed!');

