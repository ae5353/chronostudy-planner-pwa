// @ts-check
// src/domain/presets.js — Initial curriculum presets, groups, seed tombstones & initial state factory

export const DEFAULT_GROUPS = [
  'İTÜ Courses (Fall 2026)',
  'Kardeşlik ve İhya'
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

  // --- Group 2: Kardeşlik ve İhya ---
  {
    id: 'sub-ihya',
    code: 'İHYA',
    name: 'Kardeşlik ve İhya Akademisi',
    group: 'Kardeşlik ve İhya',
    color: '#059669',
    targetWeeklyHours: 4,
    folderPath: 'C:\\Users\\Arif E. Yıldırım\\Desktop\\İHYA',
    schedule: [] // Managed via weeklyEvents to avoid duplication
  }
];

export const INITIAL_WEEKLY_EVENTS = [
  {
    id: 'wevent-ihya',
    title: 'Kardeşlik ve İhya Akademisi',
    day: 4, // Perşembe
    start: '19:00',
    end: '21:30',
    category: 'Kardeşlik ve İhya',
    color: '#059669',
    recurrence: 'weekly', // 'weekly' | 'biweekly' | 'triweekly' | 'monthly' | 'weekdays' | 'daily'
    notes: 'Haftalık İhya semineri ve okuma müzakeresi'
  }
];

export const LEGACY_SEED_TASK_IDS = [
  'task-w5-eef211',
  'task-folland-mat287',
  'task-w7-ehb474',
  'task-ing201-synth',
  'task-ehb208-trees',
  'task-w7-eef210',
  'task-eef205-kmap',
  'task-w7-mtt102',
  'task-w7-ihya',
  'task-w7-mat287-fri',
  'task-backlog-1',
  'task-backlog-2'
];

export const LEGACY_DEFAULT_SUBJECT = 'Circuit Analysis';

const INITIAL_STATE_TEMPLATE = {
  version: 12,
  groups: DEFAULT_GROUPS,
  subjects: INITIAL_SUBJECTS,
  weeklyEvents: INITIAL_WEEKLY_EVENTS,
  tasks: [],
  sessions: [],
  deletedTaskIds: {},
  deletedSessionIds: {},
  deletedSubjectIds: {},
  deletedWeeklyEventIds: {},
  deletedGroups: {},
  activeTimer: {
    isRunning: false,
    mode: 'stopwatch',
    targetSec: 1500,
    elapsedSec: 0,
    startedAt: null,
    subject: '',
    topic: '',
    linkedTaskId: null,
    draftNotes: '',
    isZenMode: false
  },
  settings: {
    theme: 'slate',
    fontStyle: 'sans', // 'sans' | 'serif' | 'mono' | 'humanist' | 'cinzel' | 'cormorant'
    timerStyle: 'chronograph', // 'chronograph' | 'cadran' | 'minimal'
    layoutFormat: 'auto', // 'auto' | 'mobile' | 'desktop'
    soundEnabled: true,
    ambientSound: 'none',
    volume: 0.5,
    calendarView: 'week',
    updatedAt: null
  },
  sync: {
    enabled: false,
    provider: 'gdrive', // 'gdrive' | 'supabase' | 'offline' | 'none'
    googleClientId: '',
    googleUserEmail: '',
    googleDriveFileId: null,
    supabaseUrl: '',
    supabaseKey: '',
    supabaseRoomId: '',
    passphrase: '',
    lastSyncedAt: null,
    lastCompactedAt: null,
    status: 'idle', // 'idle' | 'syncing' | 'synced' | 'offline' | 'error'
    lastError: null,
    hasChanges: false,
    autoSync: true
  }
};

export function createInitialState() {
  return structuredClone(INITIAL_STATE_TEMPLATE);
}
