// src/store.js — Reactive Local-First State Store for ChronoStudy
// Seeded with Week 7 curriculum, İTÜ courses, personal tracks & Kardeşlik ve İhya Akademisi

const STORAGE_KEY = 'chronostudy_v3_state';

export const DEFAULT_GROUPS = [
  'İTÜ Courses (Fall 2026)',
  'Seminars & Academies'
];

export const INITIAL_SUBJECTS = [
  // --- Group 1: İTÜ Courses (Fall 2026) ---
  {
    id: 'sub-eef211',
    code: 'EEF 211E',
    name: 'Circuit Analysis',
    group: 'İTÜ Courses (Fall 2026)',
    color: '#e06d43',
    targetWeeklyHours: 6,
    folderPath: 'C:\\Users\\Arif E. Yıldırım\\Desktop\\İTÜ\\EEF211E',
    schedule: [{ day: 1, start: '08:30', end: '11:29', label: 'Lecture' }] // Pazartesi
  },
  {
    id: 'sub-mat287',
    code: 'MAT 287',
    name: 'Advanced Calculus',
    group: 'İTÜ Courses (Fall 2026)',
    color: '#d97706',
    targetWeeklyHours: 6,
    folderPath: 'C:\\Users\\Arif E. Yıldırım\\Desktop\\İTÜ\\MAT287',
    schedule: [
      { day: 2, start: '09:30', end: '12:29', label: 'Lecture' }, // Salı
      { day: 5, start: '14:30', end: '16:29', label: 'Lecture' }  // Cuma
    ]
  },
  {
    id: 'sub-ehb474',
    code: 'EHB 474E',
    name: 'Introduction to Optimization',
    group: 'İTÜ Courses (Fall 2026)',
    color: '#57534e',
    targetWeeklyHours: 5,
    folderPath: 'C:\\Users\\Arif E. Yıldırım\\Desktop\\İTÜ\\EHB474E',
    schedule: [{ day: 2, start: '12:30', end: '15:29', label: 'Lecture' }] // Salı
  },
  {
    id: 'sub-ing201',
    code: 'ING 201A',
    name: 'English for Academic Purposes',
    group: 'İTÜ Courses (Fall 2026)',
    color: '#334155',
    targetWeeklyHours: 3,
    folderPath: 'C:\\Users\\Arif E. Yıldırım\\Desktop\\İTÜ\\ING201A',
    schedule: [{ day: 3, start: '08:30', end: '11:29', label: 'Lecture' }] // Çarşamba
  },
  {
    id: 'sub-ehb235',
    code: 'EHB 235',
    name: 'Kompleks Fonksiyonlar Teorisi',
    group: 'İTÜ Courses (Fall 2026)',
    color: '#78716c',
    targetWeeklyHours: 5,
    folderPath: 'C:\\Users\\Arif E. Yıldırım\\Desktop\\İTÜ\\EHB235',
    schedule: [{ day: 3, start: '12:30', end: '15:29', label: 'Lecture' }] // Çarşamba
  },
  {
    id: 'sub-mtt102',
    code: 'MTT 102E',
    name: 'Advanced Linear Algebra',
    group: 'İTÜ Courses (Fall 2026)',
    color: '#9f1239',
    targetWeeklyHours: 5,
    folderPath: 'C:\\Users\\Arif E. Yıldırım\\Desktop\\İTÜ\\MTT102E',
    schedule: [{ day: 3, start: '17:30', end: '21:29', label: 'Lecture' }] // Çarşamba
  },
  {
    id: 'sub-ehb208',
    code: 'EHB 208E',
    name: 'Data Structures',
    group: 'İTÜ Courses (Fall 2026)',
    color: '#475569',
    targetWeeklyHours: 5,
    folderPath: 'C:\\Users\\Arif E. Yıldırım\\Desktop\\İTÜ\\EHB208E',
    schedule: [{ day: 4, start: '08:30', end: '11:29', label: 'Lecture' }] // Perşembe
  },
  {
    id: 'sub-eef210',
    code: 'EEF 210E',
    name: 'Differential Equations',
    group: 'İTÜ Courses (Fall 2026)',
    color: '#ea580c',
    targetWeeklyHours: 5,
    folderPath: 'C:\\Users\\Arif E. Yıldırım\\Desktop\\İTÜ\\EEF210E',
    schedule: [{ day: 4, start: '12:30', end: '15:29', label: 'Lecture' }] // Perşembe
  },
  {
    id: 'sub-eef205',
    code: 'EEF 205E',
    name: 'Digital Design',
    group: 'İTÜ Courses (Fall 2026)',
    color: '#f97316',
    targetWeeklyHours: 5,
    folderPath: 'C:\\Users\\Arif E. Yıldırım\\Desktop\\İTÜ\\EEF205E',
    schedule: [{ day: 5, start: '08:30', end: '11:29', label: 'Lecture' }] // Cuma
  },

  // --- Group 2: Seminars & Academies ---
  {
    id: 'sub-ihya',
    code: 'İHYA',
    name: 'Kardeşlik ve İhya Akademisi',
    group: 'Seminars & Academies',
    color: '#059669',
    targetWeeklyHours: 4,
    folderPath: 'C:\\Users\\Arif E. Yıldırım\\Desktop\\İHYA',
    schedule: [] // Managed via weeklyEvents to avoid duplication
  }
];

export const INITIAL_WEEKLY_EVENTS = [
  // User's Additional commitments
  {
    id: 'wevent-ihya',
    title: 'Kardeşlik ve İhya Akademisi',
    day: 4, // Perşembe
    start: '19:00',
    end: '21:30',
    category: 'Seminars & Academies',
    color: '#059669',
    recurrence: 'weekly', // 'weekly' | 'biweekly' | 'monthly' | 'weekdays' | 'daily'
    notes: 'Haftalık İhya semineri ve okuma müzakeresi'
  }
];

export function toLocalDateStr(d = new Date()) {
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Authentic study tasks aligned with user schedule
const INITIAL_STATE = {
  version: 11,
  groups: DEFAULT_GROUPS,
  subjects: INITIAL_SUBJECTS,
  weeklyEvents: INITIAL_WEEKLY_EVENTS,
  tasks: [
    // --- Day 9 (Pazartesi) ---
    {
      id: 'task-w5-eef211',
      title: 'EEF 211E: Week 5 Methods of Analysis & Graph Theory Problems',
      subject: 'Circuit Analysis',
      targetMinutes: 60,
      dueDate: '2026-11-09',
      notes: 'Nodal and mesh analysis problems from course notes (Desktop/İTÜ/EEF211E)',
      completed: true,
      createdAt: '2026-11-09T09:00:00.000Z',
      completedAt: '2026-11-09T18:30:00.000Z',
      timeSpentSec: 5160
    },

    // --- Day 10 (Salı) ---
    {
      id: 'task-folland-mat287',
      title: 'MAT 287: Folland Advanced Calculus Handout 1 Exercises',
      subject: 'Advanced Calculus',
      targetMinutes: 60,
      dueDate: '2026-11-10',
      notes: 'Multivariable calculus exercises (MAT287 folder)',
      completed: false,
      createdAt: '2026-11-09T10:00:00.000Z',
      completedAt: null,
      timeSpentSec: 0
    },
    {
      id: 'task-w7-ehb474',
      title: 'EHB 474E: Introduction to Optimization - Convex Sets & Calafiore Models',
      subject: 'Introduction to Optimization',
      targetMinutes: 45,
      dueDate: '2026-11-10',
      notes: 'Calafiore optimization models & gradient search exercises (EHB474E)',
      completed: false,
      createdAt: '2026-11-09T10:00:00.000Z',
      completedAt: null,
      timeSpentSec: 0
    },

    // --- Day 11 (Çarşamba) ---
    {
      id: 'task-ing201-synth',
      title: 'ING 201A: Academic Writing Synthesis & Pacing Guide Assignment',
      subject: 'English for Academic Purposes',
      targetMinutes: 40,
      dueDate: '2026-11-11',
      notes: 'APA in-text referencing and synthesis matrix (Desktop/İTÜ/ING201A)',
      completed: false,
      createdAt: '2026-11-09T10:00:00.000Z',
      completedAt: null,
      timeSpentSec: 0
    },

    // --- Day 12 (Perşembe) ---
    {
      id: 'task-ehb208-trees',
      title: 'EHB 208E: Data Structures - Binary Trees & Linked List Operations',
      subject: 'Data Structures',
      targetMinutes: 45,
      dueDate: '2026-11-12',
      notes: 'Binary search tree traversal, pointer operations and Midterm 1 review (Desktop/İTÜ/EHB208E)',
      completed: false,
      createdAt: '2026-11-09T10:00:00.000Z',
      completedAt: null,
      timeSpentSec: 0
    },
    {
      id: 'task-w7-eef210',
      title: 'EEF 210E: Differential Equations - 2nd Order Linear Differential Equations',
      subject: 'Differential Equations',
      targetMinutes: 50,
      dueDate: '2026-11-12',
      notes: 'Boyce & DiPrima undetermined coefficients & variation of parameters',
      completed: false,
      createdAt: '2026-11-09T10:00:00.000Z',
      completedAt: null,
      timeSpentSec: 0
    },

    // --- Day 13 (Cuma) ---
    {
      id: 'task-eef205-kmap',
      title: 'EEF 205E: Digital Design - K-Map Minimization & OneWare VHDL Simulation',
      subject: 'Digital Design',
      targetMinutes: 45,
      dueDate: '2026-11-13',
      notes: 'Digital Design Global Edition Chapter 5 problems and OneWare Studio simulation',
      completed: false,
      createdAt: '2026-11-09T10:00:00.000Z',
      completedAt: null,
      timeSpentSec: 0
    }
  ],
  sessions: [
    {
      id: 'sess-eef211-1',
      subject: 'Circuit Analysis',
      topic: 'EEF 211E: Week 5 Methods of Analysis & Graph Theory Problems',
      taskId: 'task-w5-eef211',
      durationSec: 5160, // 86m studied on Pazartesi Day 9
      startTime: '2026-11-09T17:04:00.000Z',
      endTime: '2026-11-09T18:30:00.000Z',
      notes: 'Nodal and mesh analysis problems solved.',
      createdAt: '2026-11-09T18:30:00.000Z'
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
    linkedTaskId: null,
    draftNotes: '',
    isZenMode: false
  },
  settings: {
    theme: 'slate',
    fontStyle: 'sans', // 'sans' | 'serif' | 'mono' | 'humanist' | 'cinzel' | 'cormorant'
    timerStyle: 'chronograph', // 'chronograph' | 'cadran' | 'minimal'
    soundEnabled: true,
    ambientSound: 'none',
    volume: 0.5,
    calendarView: 'week'
  }
};

class Store {
  constructor() {
    this.listeners = new Set();
    this.state = this.sanitizeState(this.loadState());
    this.saveState();
  }

  sanitizeState(state) {
    if (!state || typeof state !== 'object') return { ...INITIAL_STATE };

    const subjects = Array.isArray(state.subjects) ? state.subjects : [...INITIAL_SUBJECTS];
    const groups = Array.isArray(state.groups) && state.groups.length > 0 ? [...state.groups] : [...DEFAULT_GROUPS];

    // Ensure all 9 authentic İTÜ subjects exist and have correct group & properties
    INITIAL_SUBJECTS.forEach((initSub) => {
      const existing = subjects.find(
        (s) => s.id === initSub.id || (s.name && initSub.name && s.name.toLowerCase() === initSub.name.toLowerCase()) || (s.code && initSub.code && s.code === initSub.code)
      );
      if (!existing) {
        subjects.push({ ...initSub });
      } else {
        // Heal existing subject properties
        if (!existing.group || existing.group === 'General' || existing.group === 'undefined') {
          existing.group = initSub.group;
        }
        if (!existing.folderPath) existing.folderPath = initSub.folderPath;
        if (initSub.id === 'sub-ihya' || (existing.name && existing.name.includes('İhya'))) {
          existing.schedule = []; // Avoid duplicate chip
        } else if (!existing.schedule || existing.schedule.length === 0) {
          existing.schedule = initSub.schedule;
        }
        if (!existing.code) existing.code = initSub.code;
        if (!existing.color) existing.color = initSub.color;
      }
    });

    subjects.forEach((s) => {
      if (s.id === 'sub-ihya' || (s.name && s.name.includes('İhya')) || s.code === 'İHYA') {
        s.group = 'Seminars & Academies';
        s.schedule = []; // Avoid duplicate chip in lecture slots
      } else if (!s.group || s.group === 'General' || s.group.includes('İTÜ') || s.group.includes('ITU') || s.group.includes('Course')) {
        s.group = 'İTÜ Courses (Fall 2026)';
      }
      if (!groups.includes(s.group)) groups.push(s.group);
    });

    const cleanGroups = ['İTÜ Courses (Fall 2026)', 'Seminars & Academies'];
    groups.forEach((g) => {
      const trimmed = (g || '').trim();
      if (trimmed && !trimmed.includes('ITU') && !trimmed.includes('İTÜ') && !trimmed.includes('Seminar') && !cleanGroups.includes(trimmed)) {
        cleanGroups.push(trimmed);
      }
    });

    // Weekly Events sanitization
    const weeklyEvents = Array.isArray(state.weeklyEvents) ? state.weeklyEvents : [...INITIAL_WEEKLY_EVENTS];
    INITIAL_WEEKLY_EVENTS.forEach((initEv) => {
      if (!weeklyEvents.some((ev) => ev.id === initEv.id || (ev.title && ev.title.toLowerCase() === initEv.title.toLowerCase()))) {
        weeklyEvents.push({ ...initEv });
      }
    });
    weeklyEvents.forEach((ev) => {
      if (!ev.recurrence) ev.recurrence = 'weekly';
    });

    const unwantedTaskIds = new Set([
      'task-w7-eef211',
      'task-w7-ehb235',
      'task-w7-mtt102',
      'task-w7-ihya',
      'task-w7-mat287-fri',
      'task-backlog-1',
      'task-backlog-2'
    ]);
    const rawTasks = Array.isArray(state.tasks) ? state.tasks : [...INITIAL_STATE.tasks];
    const tasks = rawTasks.filter((t) => !unwantedTaskIds.has(t.id));
    tasks.forEach((t) => {
      if (!t.recurrence) t.recurrence = 'none';
      // Anchor authentic tasks to their intended curriculum calendar dates
      if (t.id === 'task-w5-eef211') {
        t.dueDate = '2026-11-09';
        t.completed = true;
      } else if (t.id === 'task-folland-mat287' || t.id === 'task-w7-ehb474') {
        if (!t.dueDate || t.dueDate === '2026-11-11' || t.dueDate === '2026-11-09') t.dueDate = '2026-11-10';
      } else if (t.id === 'task-ing201-synth') {
        if (!t.dueDate || t.dueDate === '2026-11-12') t.dueDate = '2026-11-11';
      } else if (t.id === 'task-ehb208-trees' || t.id === 'task-w7-eef210') {
        if (!t.dueDate || t.dueDate === '2026-11-13') t.dueDate = '2026-11-12';
      } else if (t.id === 'task-eef205-kmap') {
        if (!t.dueDate || t.dueDate === '2026-11-14') t.dueDate = '2026-11-13';
      }
    });

    const sessions = Array.isArray(state.sessions) ? state.sessions : [...INITIAL_STATE.sessions];
    sessions.forEach((s) => {
      if (s.id === 'sess-eef211-1') {
        s.endTime = '2026-11-09T18:30:00.000Z';
        s.createdAt = '2026-11-09T18:30:00.000Z';
      }
    });
    state.sessions = sessions;

    if (!state.settings) state.settings = { ...INITIAL_STATE.settings };
    if (!state.settings.fontStyle) state.settings.fontStyle = 'sans';
    if (!state.settings.theme) state.settings.theme = 'slate';
    if (!state.settings.timerStyle || state.settings.timerStyle === 'chronometer') {
      state.settings.timerStyle = 'chronograph';
    }

    state.subjects = subjects;
    state.groups = cleanGroups;
    state.weeklyEvents = weeklyEvents;
    state.tasks = tasks;
    return state;
  }

  loadState() {
    try {
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return { ...INITIAL_STATE };
      }
      const serialized = localStorage.getItem(STORAGE_KEY);
      if (!serialized) {
        return { ...INITIAL_STATE };
      }
      const parsed = JSON.parse(serialized);

      // Upgrade to version 11 (Clean up unwanted auto-injected tasks, lock authentic schedule dates, chronograph timer)
      if (!parsed.version || parsed.version < 11) {
        const unwantedTaskIds = new Set([
          'task-w7-eef211',
          'task-w7-ehb235',
          'task-w7-mtt102',
          'task-w7-ihya',
          'task-w7-mat287-fri',
          'task-backlog-1',
          'task-backlog-2'
        ]);

        // Merge authentic İTÜ subjects with any user-added subjects
        const existingSubjects = Array.isArray(parsed.subjects) ? parsed.subjects : [];
        const cleanExisting = existingSubjects.filter(
          (s) => s.id !== 'sub-balkan' && s.id !== 'sub-langs' && !s.name.includes('Balkan') && !s.name.includes('Diller')
        );

        // Ensure all authentic subjects from INITIAL_SUBJECTS exist
        const mergedSubjects = [...cleanExisting];
        INITIAL_SUBJECTS.forEach((initSub) => {
          if (!mergedSubjects.some((s) => s.id === initSub.id || s.name.toLowerCase() === initSub.name.toLowerCase())) {
            mergedSubjects.push(initSub);
          }
        });

        // Ensure only authentic tasks exist and remove unwanted fabricated tasks
        const existingTasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
        const cleanTasks = existingTasks.filter(
          (t) => !unwantedTaskIds.has(t.id) && !t.subject?.includes('Balkan') && !t.subject?.includes('Diller')
        );
        const mergedTasks = [...cleanTasks];
        INITIAL_STATE.tasks.forEach((initTask) => {
          if (!mergedTasks.some((t) => t.id === initTask.id || t.title.toLowerCase() === initTask.title.toLowerCase())) {
            mergedTasks.push(initTask);
          }
        });

        // Ensure sessions are preserved and 86m session exists
        const existingSessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
        const mergedSessions = [...existingSessions];
        INITIAL_STATE.sessions.forEach((initSess) => {
          if (!mergedSessions.some((s) => s.id === initSess.id)) {
            mergedSessions.push(initSess);
          }
        });

        // Groups
        const groups = parsed.groups && parsed.groups.length > 0 ? parsed.groups : DEFAULT_GROUPS;

        const candidate = {
          ...INITIAL_STATE,
          version: 11,
          groups: [...new Set(groups)],
          subjects: mergedSubjects,
          tasks: mergedTasks,
          weeklyEvents: parsed.weeklyEvents || INITIAL_WEEKLY_EVENTS,
          sessions: mergedSessions,
          settings: { ...INITIAL_STATE.settings, ...(parsed.settings || {}) },
          activeTimer: { ...INITIAL_STATE.activeTimer, ...(parsed.activeTimer || {}) }
        };
        return this.sanitizeState(candidate);
      }

      const candidate = {
        ...INITIAL_STATE,
        ...parsed,
        groups: parsed.groups && parsed.groups.length > 0 ? parsed.groups : DEFAULT_GROUPS,
        subjects: parsed.subjects && parsed.subjects.length > 0 ? parsed.subjects : INITIAL_SUBJECTS,
        weeklyEvents: parsed.weeklyEvents || INITIAL_WEEKLY_EVENTS,
        settings: { ...INITIAL_STATE.settings, ...(parsed.settings || {}) },
        activeTimer: { ...INITIAL_STATE.activeTimer, ...(parsed.activeTimer || {}) }
      };
      return this.sanitizeState(candidate);
    } catch (err) {
      console.warn('Failed to parse localStorage, resetting to initial state', err);
      return { ...INITIAL_STATE };
    }
  }

  saveState() {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      }
    } catch (err) {
      console.error('Failed to save to localStorage', err);
    }
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (err) {
        console.error('Listener notification error:', err);
      }
    }
  }

  getState() {
    return this.state;
  }

  // --- Task Methods (Optional target time, due date, & rich recurrence) ---
  calculateNextRecurrenceDate(dueDate, recurrence, interval = 1) {
    let base;
    if (dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      const [y, m, d] = dueDate.split('-').map(Number);
      base = new Date(y, m - 1, d, 12, 0, 0); // Noon prevents any daylight saving or timezone shifts
    } else {
      base = new Date();
      base.setHours(12, 0, 0, 0);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // If the due date was in the past, calculate relative to today
    if (base < today) {
      base = new Date(today);
      base.setHours(12, 0, 0, 0);
    }

    const next = new Date(base);
    const step = parseInt(interval, 10) || 1;

    switch (recurrence) {
      case 'daily':
        next.setDate(next.getDate() + step);
        break;
      case 'weekdays':
        next.setDate(next.getDate() + 1);
        while (next.getDay() === 0 || next.getDay() === 6) {
          next.setDate(next.getDate() + 1);
        }
        break;
      case 'weekly':
        next.setDate(next.getDate() + (7 * step));
        break;
      case 'biweekly':
        next.setDate(next.getDate() + 14);
        break;
      case 'triweekly':
        next.setDate(next.getDate() + 21);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + step);
        break;
      case 'custom_days':
        next.setDate(next.getDate() + step);
        break;
      case 'custom_weeks':
        next.setDate(next.getDate() + (7 * step));
        break;
      default:
        next.setDate(next.getDate() + 7);
        break;
    }

    const year = next.getFullYear();
    const month = String(next.getMonth() + 1).padStart(2, '0');
    const day = String(next.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  addTask({ title, subject = null, targetMinutes = null, dueDate = null, recurrence = 'none', recurrenceInterval = null, notes = '' }) {
    if (!title || !title.trim()) return null;

    const parsedMins = targetMinutes ? parseInt(targetMinutes, 10) : null;
    const cleanDueDate = dueDate && dueDate.trim() ? dueDate.trim() : null;
    const cleanSubject = subject && subject.trim() && subject.trim().toLowerCase() !== 'none' && subject.trim().toLowerCase() !== 'all' ? subject.trim() : null;

    const newTask = {
      id: 'task-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      title: title.trim(),
      subject: cleanSubject,
      targetMinutes: parsedMins && parsedMins > 0 ? parsedMins : null,
      dueDate: cleanDueDate,
      recurrence: recurrence && recurrence !== 'none' ? recurrence : 'none',
      recurrenceInterval: recurrenceInterval ? parseInt(recurrenceInterval, 10) : null,
      parentRecurringId: null,
      notes: notes ? notes.trim() : '',
      completed: false,
      createdAt: new Date().toISOString(),
      completedAt: null,
      timeSpentSec: 0
    };
    this.state.tasks.unshift(newTask);
    this.saveState();
    return newTask;
  }

  toggleTask(taskId) {
    const task = this.state.tasks.find((t) => t.id === taskId);
    if (!task) return;

    const wasCompleted = task.completed;
    task.completed = !wasCompleted;
    task.completedAt = task.completed ? new Date().toISOString() : null;

    // If the task was just marked COMPLETED and it is RECURRING, spawn the next occurrence
    if (task.completed && task.recurrence && task.recurrence !== 'none') {
      const nextDate = this.calculateNextRecurrenceDate(task.dueDate, task.recurrence, task.recurrenceInterval);
      
      // Ensure we don't duplicate if a pending task with same parent & due date already exists
      const parentId = task.parentRecurringId || task.id;
      const alreadyExists = this.state.tasks.some(
        (t) => !t.completed && 
               (t.parentRecurringId === parentId || t.id === parentId || (t.title.toLowerCase() === task.title.toLowerCase() && t.recurrence === task.recurrence)) && 
               t.dueDate === nextDate
      );

      if (!alreadyExists && nextDate) {
        const nextTask = {
          id: 'task-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          title: task.title,
          subject: task.subject,
          targetMinutes: task.targetMinutes || null,
          dueDate: nextDate,
          recurrence: task.recurrence,
          recurrenceInterval: task.recurrenceInterval || null,
          parentRecurringId: parentId,
          notes: task.notes || '',
          completed: false,
          createdAt: new Date().toISOString(),
          completedAt: null,
          timeSpentSec: 0
        };
        this.state.tasks.unshift(nextTask);
      }
    }

    this.saveState();
  }

  updateTask(taskId, updates) {
    const task = this.state.tasks.find((t) => t.id === taskId);
    if (!task) return;
    Object.assign(task, updates);
    this.saveState();
  }

  deleteTask(taskId) {
    this.state.tasks = this.state.tasks.filter((t) => t.id !== taskId);
    if (this.state.activeTimer.linkedTaskId === taskId) {
      this.state.activeTimer.linkedTaskId = null;
    }
    this.saveState();
  }

  addTimeSpentToTask(taskId, durationSec) {
    const task = this.state.tasks.find((t) => t.id === taskId);
    if (task) {
      task.timeSpentSec = (task.timeSpentSec || 0) + durationSec;
      this.saveState();
    }
  }

  // --- Session Log Methods ---
  addSession({
    subject,
    topic,
    taskId = null,
    durationSec,
    startTime = null,
    endTime = null,
    notes = ''
  }) {
    const now = new Date();
    const end = endTime ? new Date(endTime) : now;
    const start = startTime ? new Date(startTime) : new Date(end.getTime() - durationSec * 1000);

    const cleanSubject = subject && subject.trim() && subject.trim().toLowerCase() !== 'none' ? subject.trim() : 'General';

    const newSession = {
      id: 'sess-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      subject: cleanSubject,
      topic: topic ? topic.trim() : 'Study Session',
      taskId: taskId || null,
      durationSec: Math.max(1, Math.round(durationSec)),
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      notes: notes ? notes.trim() : '',
      createdAt: now.toISOString()
    };

    this.state.sessions.unshift(newSession);

    if (taskId) {
      this.addTimeSpentToTask(taskId, newSession.durationSec);
    }

    this.saveState();
    return newSession;
  }

  deleteSession(sessionId) {
    this.state.sessions = this.state.sessions.filter((s) => s.id !== sessionId);
    this.saveState();
  }

  // --- Subject Management (Groups, Folder Paths, Schedules) ---
  addSubject(nameOrObj, color = '#e06d43', code = '', targetWeeklyHours = null, group = 'İTÜ Courses (Fall 2026)', folderPath = '') {
    let name = nameOrObj;
    if (nameOrObj && typeof nameOrObj === 'object') {
      name = nameOrObj.name;
      color = nameOrObj.color || color;
      code = nameOrObj.code || code;
      targetWeeklyHours = nameOrObj.targetWeeklyHours !== undefined ? nameOrObj.targetWeeklyHours : targetWeeklyHours;
      group = nameOrObj.group || group;
      folderPath = nameOrObj.folderPath || folderPath;
    }

    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed) return null;

    const existing = this.state.subjects.find(
      (s) => s.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) return existing;

    const newSub = {
      id: 'sub-' + Date.now(),
      code: code ? code.trim().toUpperCase() : trimmed.slice(0, 7).toUpperCase(),
      name: trimmed,
      group: group ? group.trim() : 'İTÜ Courses (Fall 2026)',
      color: color || '#e06d43',
      targetWeeklyHours: targetWeeklyHours ? parseInt(targetWeeklyHours, 10) : null,
      folderPath: folderPath ? folderPath.trim() : '',
      schedule: []
    };
    this.state.subjects.push(newSub);

    // If new group, add to groups list
    if (newSub.group && !this.state.groups.includes(newSub.group)) {
      this.state.groups.push(newSub.group);
    }

    this.saveState();
    return newSub;
  }

  updateSubject(subjectId, { name, color, code, targetWeeklyHours, group, folderPath }) {
    const sub = this.state.subjects.find((s) => s.id === subjectId);
    if (!sub) return;

    const oldName = sub.name;
    if (name && name.trim()) sub.name = name.trim();
    if (color) sub.color = color;
    if (code !== undefined) sub.code = code.trim().toUpperCase();
    if (targetWeeklyHours !== undefined) {
      sub.targetWeeklyHours = targetWeeklyHours ? parseInt(targetWeeklyHours, 10) : null;
    }
    if (group !== undefined) {
      sub.group = group ? group.trim() : 'General';
      if (!this.state.groups.includes(sub.group)) {
        this.state.groups.push(sub.group);
      }
    }
    if (folderPath !== undefined) sub.folderPath = folderPath.trim();

    if (oldName !== sub.name) {
      this.state.tasks.forEach((t) => {
        if (t.subject === oldName) t.subject = sub.name;
      });
      this.state.sessions.forEach((s) => {
        if (s.subject === oldName) s.subject = sub.name;
      });
      if (this.state.activeTimer.subject === oldName) {
        this.state.activeTimer.subject = sub.name;
      }
    }

    this.saveState();
  }

  deleteSubject(subjectId) {
    this.state.subjects = this.state.subjects.filter((s) => s.id !== subjectId);
    this.saveState();
  }

  // --- Category / Group Management ---
  getGroups() {
    return this.state.groups || [];
  }

  addCategory(groupName) {
    if (!groupName || typeof groupName !== 'string') return false;
    const trimmed = groupName.trim();
    if (!trimmed) return false;
    if (!this.state.groups.includes(trimmed)) {
      this.state.groups.push(trimmed);
      this.saveState();
      return true;
    }
    return false;
  }

  renameCategory(oldName, newName) {
    if (!oldName || !newName || typeof newName !== 'string') return false;
    const trimmedNew = newName.trim();
    if (!trimmedNew || oldName === trimmedNew) return false;

    // Update in groups list
    const index = this.state.groups.indexOf(oldName);
    if (index !== -1) {
      this.state.groups[index] = trimmedNew;
    } else {
      this.state.groups.push(trimmedNew);
    }

    // Deduplicate
    this.state.groups = [...new Set(this.state.groups)];

    // Update subjects belonging to this group
    this.state.subjects.forEach((s) => {
      if (s.group === oldName) {
        s.group = trimmedNew;
      }
    });

    // Update weekly events belonging to this category
    if (Array.isArray(this.state.weeklyEvents)) {
      this.state.weeklyEvents.forEach((we) => {
        if (we.category === oldName) {
          we.category = trimmedNew;
        }
      });
    }

    this.saveState();
    return true;
  }

  deleteCategory(groupName, fallbackGroup = 'İTÜ Courses (Fall 2026)') {
    if (!groupName) return false;
    this.state.groups = this.state.groups.filter((g) => g !== groupName);
    if (this.state.groups.length === 0) {
      this.state.groups = [fallbackGroup];
    }
    const target = this.state.groups[0];

    this.state.subjects.forEach((s) => {
      if (s.group === groupName) {
        s.group = target;
      }
    });

    if (Array.isArray(this.state.weeklyEvents)) {
      this.state.weeklyEvents.forEach((we) => {
        if (we.category === groupName) {
          we.category = target;
        }
      });
    }

    this.saveState();
    return true;
  }

  getSubjectColor(subjectName) {
    const sub = this.state.subjects.find(
      (s) => s.name.toLowerCase() === (subjectName || '').toLowerCase()
    );
    return sub ? sub.color : '#64748b';
  }

  getSubjectStats(subjectName) {
    const tasks = this.state.tasks.filter((t) => t.subject === subjectName);
    const sessions = this.state.sessions.filter((s) => s.subject === subjectName);

    const totalSeconds = sessions.reduce((acc, s) => acc + (s.durationSec || 0), 0);
    const pendingTasks = tasks.filter((t) => !t.completed).length;
    const completedTasks = tasks.filter((t) => t.completed).length;

    const startOfWeek = new Date();
    const day = startOfWeek.getDay() || 7;
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(startOfWeek.getDate() - day + 1);

    const thisWeekSeconds = sessions
      .filter((s) => new Date(s.endTime || s.createdAt) >= startOfWeek)
      .reduce((acc, s) => acc + (s.durationSec || 0), 0);

    return {
      totalMinutes: Math.round(totalSeconds / 60),
      thisWeekHours: (thisWeekSeconds / 3600).toFixed(1),
      pendingTasks,
      completedTasks,
      totalTasks: tasks.length
    };
  }

  // --- Standalone / Additional Weekly Scheduled Events (Kardeşlik ve İhya, Seminars, etc.) ---
  addWeeklyEvent({ title, day, start, end, category = 'General', color = '#059669', recurrence = 'weekly', notes = '' }) {
    if (!title || !title.trim()) return null;
    const newEvent = {
      id: 'wevent-' + Date.now(),
      title: title.trim(),
      day: parseInt(day, 10) || 1, // 1 = Mon ... 7 = Sun
      start: start || '19:00',
      end: end || '21:00',
      category: category || 'General',
      color: color || '#059669',
      recurrence: recurrence || 'weekly', // 'weekly' | 'biweekly' | 'monthly' | 'weekdays' | 'daily'
      notes: notes ? notes.trim() : ''
    };
    if (!Array.isArray(this.state.weeklyEvents)) {
      this.state.weeklyEvents = [];
    }
    this.state.weeklyEvents.push(newEvent);
    this.saveState();
    return newEvent;
  }

  deleteWeeklyEvent(eventId) {
    if (!Array.isArray(this.state.weeklyEvents)) return;
    this.state.weeklyEvents = this.state.weeklyEvents.filter((e) => e.id !== eventId);
    this.saveState();
  }

  updateWeeklyEvent(eventId, { title, day, start, end, category, color, recurrence, notes }) {
    if (!Array.isArray(this.state.weeklyEvents)) return null;
    const ev = this.state.weeklyEvents.find((e) => e.id === eventId);
    if (!ev) return null;
    if (title && title.trim()) ev.title = title.trim();
    if (day !== undefined) ev.day = parseInt(day, 10) || 1;
    if (start) ev.start = start;
    if (end) ev.end = end;
    if (category !== undefined) ev.category = category.trim();
    if (color) ev.color = color;
    if (recurrence !== undefined) ev.recurrence = recurrence;
    if (notes !== undefined) ev.notes = notes.trim();
    this.saveState();
    return ev;
  }

  // --- Course Lecture Slots Management ---
  addLectureSlot(subjectId, { day, start, end, label = 'Lecture' }) {
    const sub = this.state.subjects.find((s) => s.id === subjectId);
    if (!sub) return false;
    if (!Array.isArray(sub.schedule)) sub.schedule = [];
    sub.schedule.push({
      day: parseInt(day, 10) || 1,
      start: start || '08:30',
      end: end || '11:29',
      label: label ? label.trim() : 'Lecture'
    });
    this.saveState();
    return true;
  }

  updateLectureSlot(subjectId, slotIndex, { day, start, end, label = 'Lecture' }) {
    const sub = this.state.subjects.find((s) => s.id === subjectId);
    if (!sub || !Array.isArray(sub.schedule) || !sub.schedule[slotIndex]) return false;
    sub.schedule[slotIndex] = {
      day: parseInt(day, 10) || 1,
      start: start || '08:30',
      end: end || '11:29',
      label: label ? label.trim() : 'Lecture'
    };
    this.saveState();
    return true;
  }

  deleteLectureSlot(subjectId, slotIndex) {
    const sub = this.state.subjects.find((s) => s.id === subjectId);
    if (!sub || !Array.isArray(sub.schedule)) return false;
    sub.schedule.splice(slotIndex, 1);
    this.saveState();
    return true;
  }

  // --- Active Timer State ---
  updateActiveTimer(partial) {
    this.state.activeTimer = {
      ...this.state.activeTimer,
      ...partial
    };
    this.saveState();
  }

  // --- Settings ---
  updateSettings(partial) {
    this.state.settings = {
      ...this.state.settings,
      ...partial
    };
    this.saveState();
  }

  // --- Statistics Helpers ---
  getTodayStats() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todaySessions = this.state.sessions.filter((s) => {
      const sDate = new Date(s.endTime || s.createdAt);
      return sDate >= startOfToday;
    });

    const totalSecondsToday = todaySessions.reduce((acc, s) => acc + (s.durationSec || 0), 0);
    const completedTasksToday = this.state.tasks.filter((t) => {
      if (!t.completed || !t.completedAt) return false;
      return new Date(t.completedAt) >= startOfToday;
    }).length;

    return {
      totalSecondsToday,
      todaySessionsCount: todaySessions.length,
      completedTasksToday,
      pendingTasksCount: this.state.tasks.filter((t) => !t.completed).length
    };
  }

  // --- Comprehensive Analytics Engine ---
  getAnalyticsData() {
    const sessions = this.state.sessions || [];
    const tasks = this.state.tasks || [];
    const subjects = this.state.subjects || [];

    // Total focus stats
    let totalSec = 0;
    sessions.forEach((s) => {
      totalSec += (s.durationSec || 0);
    });

    // Current Monday - Sunday boundary
    const now = new Date();
    const currentDay = now.getDay(); // 0 is Sun, 1 is Mon...
    const distToMon = (currentDay + 6) % 7;
    const mon = new Date(now);
    mon.setDate(now.getDate() - distToMon);
    mon.setHours(0, 0, 0, 0);

    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    sun.setHours(23, 59, 59, 999);

    const monTime = mon.getTime();
    const sunTime = sun.getTime();

    let weekSec = 0;
    const activeDaysSet = new Set();

    // 7-day focus trend
    const dayLabels = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
    const dailyTrend = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      const dStr = toLocalDateStr(d);
      const isToday = dStr === toLocalDateStr(now);
      dailyTrend.push({
        dayIndex: (i + 1) % 7,
        label: dayLabels[i],
        dateStr: dStr,
        durationSec: 0,
        durationMins: 0,
        isToday
      });
    }

    // Aggregate sessions
    const subjectSecMap = {};
    sessions.forEach((s) => {
      const d = s.startTime ? new Date(s.startTime) : new Date(s.createdAt);
      const t = d.getTime();
      const dur = s.durationSec || 0;

      // Current week metrics
      if (t >= monTime && t <= sunTime) {
        weekSec += dur;
        const dStr = toLocalDateStr(d);
        activeDaysSet.add(dStr);

        const trendDay = dailyTrend.find((td) => td.dateStr === dStr);
        if (trendDay) {
          trendDay.durationSec += dur;
          trendDay.durationMins = Math.round(trendDay.durationSec / 60);
        }
      }

      // Subject breakdown
      const subName = s.subject || 'General / Other';
      subjectSecMap[subName] = (subjectSecMap[subName] || 0) + dur;
    });

    // Subject breakdown sorted by duration descending
    const subjectBreakdown = Object.entries(subjectSecMap).map(([name, durSec]) => {
      const subObj = subjects.find((s) => s.name === name || s.code === name);
      const color = subObj ? subObj.color : '#64748b';
      const percentage = totalSec > 0 ? Math.round((durSec / totalSec) * 100) : 0;
      return {
        name,
        color,
        durationSec: durSec,
        durationMins: Math.round(durSec / 60),
        durationHours: (durSec / 3600).toFixed(1),
        percentage
      };
    }).sort((a, b) => b.durationSec - a.durationSec);

    // Tasks metrics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.completed).length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      totalSec,
      totalSessions: sessions.length,
      weekSec,
      activeDaysCount: activeDaysSet.size,
      totalTasks,
      completedTasks,
      completionRate,
      dailyTrend,
      subjectBreakdown
    };
  }

  // --- Google Calendar & iCal Export Helper ---
  generateICS() {
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ChronoStudy//ITU Study Tracker//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:ChronoStudy Schedule'
    ];

    const formatICSDate = (date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    // Scheduled Tasks with due dates
    this.state.tasks.forEach((task) => {
      if (!task.dueDate) return;
      const start = new Date(task.dueDate + 'T09:00:00');
      const end = new Date(start.getTime() + (task.targetMinutes || 45) * 60000);

      lines.push(
        'BEGIN:VEVENT',
        `UID:task-${task.id}@chronostudy.app`,
        `DTSTAMP:${formatICSDate(new Date())}`,
        `DTSTART:${formatICSDate(start)}`,
        `DTEND:${formatICSDate(end)}`,
        `SUMMARY:[Study] ${task.subject}: ${task.title}`,
        `DESCRIPTION:${task.notes || 'Scheduled study block in ChronoStudy'}`,
        `STATUS:${task.completed ? 'COMPLETED' : 'CONFIRMED'}`,
        'END:VEVENT'
      );
    });

    // Standalone Weekly Recurring Events (e.g. Kardeşlik ve İhya)
    if (Array.isArray(this.state.weeklyEvents)) {
      this.state.weeklyEvents.forEach((ev) => {
        lines.push(
          'BEGIN:VEVENT',
          `UID:event-${ev.id}@chronostudy.app`,
          `DTSTAMP:${formatICSDate(new Date())}`,
          `SUMMARY:[Event] ${ev.title}`,
          `DESCRIPTION:${ev.notes || ''}`,
          'STATUS:CONFIRMED',
          'END:VEVENT'
        );
      });
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  // --- Import / Export ---
  exportJSON() {
    return JSON.stringify(
      {
        appName: 'ChronoStudy',
        version: this.state.version,
        exportedAt: new Date().toISOString(),
        groups: this.state.groups,
        subjects: this.state.subjects,
        weeklyEvents: this.state.weeklyEvents,
        tasks: this.state.tasks,
        sessions: this.state.sessions,
        settings: this.state.settings
      },
      null,
      2
    );
  }

  exportCSV() {
    const headers = ['Session ID', 'Date', 'Start Time', 'End Time', 'Duration (Minutes)', 'Subject', 'Topic', 'Notes'];
    const rows = this.state.sessions.map((s) => {
      const startDate = s.startTime ? new Date(s.startTime) : new Date(s.createdAt);
      const endDate = s.endTime ? new Date(s.endTime) : startDate;
      const dateStr = toLocalDateStr(startDate);
      const startStr = startDate.toTimeString().slice(0, 8);
      const endStr = endDate.toTimeString().slice(0, 8);
      const mins = Math.round((s.durationSec || 0) / 60);
      const escape = (val) => `"${(val || '').toString().replace(/"/g, '""')}"`;

      return [
        escape(s.id),
        escape(dateStr),
        escape(startStr),
        escape(endStr),
        mins,
        escape(s.subject),
        escape(s.topic),
        escape(s.notes)
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\r\n');
  }

  generateCSV() {
    return this.exportCSV();
  }

  importJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid JSON format');
      }

      if (Array.isArray(data.groups)) this.state.groups = data.groups;
      if (Array.isArray(data.subjects)) this.state.subjects = data.subjects;
      if (Array.isArray(data.weeklyEvents)) this.state.weeklyEvents = data.weeklyEvents;
      if (Array.isArray(data.tasks)) this.state.tasks = data.tasks;
      if (Array.isArray(data.sessions)) this.state.sessions = data.sessions;
      if (data.settings) this.state.settings = { ...this.state.settings, ...data.settings };

      this.saveState();
      return { success: true, count: this.state.sessions.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

export const store = new Store();
export default store;
