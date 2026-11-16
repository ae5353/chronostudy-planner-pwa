// src/store.js — Reactive Local-First State Store for ChronoStudy
// Seeded with Week 7 curriculum, İTÜ courses, personal tracks & Kardeşlik ve İhya Akademisi

const STORAGE_KEY = 'chronostudy_v3_state';

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
  // User's Additional commitments
  {
    id: 'wevent-ihya',
    title: 'Kardeşlik ve İhya Akademisi',
    day: 4, // Perşembe
    start: '19:00',
    end: '21:30',
    category: 'Kardeşlik ve İhya',
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

// Clean initial state — user starts with their authentic courses and commitments, zero fabricated tasks
const INITIAL_STATE = {
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
    calendarView: 'week'
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
    status: 'idle', // 'idle' | 'syncing' | 'synced' | 'offline' | 'error'
    lastError: null,
    hasChanges: false,
    autoSync: true
  }
};

class Store {
  constructor() {
    this.listeners = new Set();
    this.state = this.sanitizeState(this.loadState());
    this.saveState();
  }

  isMidnightTimestamp(isoOrDate) {
    if (!isoOrDate) return false;
    const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return false;
    const hr = d.getHours();
    return hr >= 0 && hr < 5;
  }

  getSessionDateStr(s) {
    if (!s) return toLocalDateStr(new Date());
    return toLocalDateStr(s.startTime || s.endTime || s.createdAt || new Date());
  }

  splitSessionAcrossMidnights(sessionObj) {
    if (!sessionObj) return [];
    const origDur = Math.max(1, Math.round(sessionObj.durationSec || 0));
    const rawEnd = sessionObj.endTime ? new Date(sessionObj.endTime) : (sessionObj.createdAt ? new Date(sessionObj.createdAt) : new Date());
    const rawStart = sessionObj.startTime ? new Date(sessionObj.startTime) : new Date(rawEnd.getTime() - origDur * 1000);

    if (Number.isNaN(rawStart.getTime()) || Number.isNaN(rawEnd.getTime()) || rawEnd <= rawStart) {
      return [sessionObj];
    }

    const startDateStr = toLocalDateStr(rawStart);
    const endDateStr = toLocalDateStr(rawEnd);
    if (startDateStr === endDateStr) {
      return [sessionObj];
    }

    const totalMs = Math.max(1000, rawEnd.getTime() - rawStart.getTime());
    const segments = [];
    let curStart = new Date(rawStart.getTime());
    let remainingSec = origDur;
    let idx = 0;

    while (toLocalDateStr(curStart) < endDateStr && idx < 7) {
      const nextMidnight = new Date(curStart);
      nextMidnight.setHours(24, 0, 0, 0);
      const segEnd = nextMidnight < rawEnd ? nextMidnight : rawEnd;
      const segMs = Math.max(0, segEnd.getTime() - curStart.getTime());
      const segSec = Math.max(1, Math.min(remainingSec - 1, Math.round((segMs / totalMs) * origDur)));
      remainingSec = Math.max(1, remainingSec - segSec);

      segments.push({
        ...sessionObj,
        id: idx === 0 ? sessionObj.id : `${sessionObj.id}-m${idx + 1}`,
        durationSec: segSec,
        startTime: curStart.toISOString(),
        endTime: new Date(segEnd.getTime() - (segEnd.getTime() === nextMidnight.getTime() ? 1 : 0)).toISOString(),
        isMidnightSplit: idx > 0
      });

      curStart = new Date(nextMidnight.getTime());
      idx += 1;
    }

    // Final segment (from last midnight boundary to rawEnd)
    segments.push({
      ...sessionObj,
      id: idx === 0 ? sessionObj.id : `${sessionObj.id}-m${idx + 1}`,
      durationSec: Math.max(1, remainingSec),
      startTime: curStart.toISOString(),
      endTime: rawEnd.toISOString(),
      isMidnightSplit: idx > 0
    });

    return segments;
  }

  reconcileTasksAndSessions(state) {
    if (!state) return;
    if (!state.deletedTaskIds) state.deletedTaskIds = {};
    if (!state.deletedSessionIds) state.deletedSessionIds = {};
    if (!state.deletedWeeklyEventIds) state.deletedWeeklyEventIds = {};

    const tasks = Array.isArray(state.tasks) ? state.tasks : [];
    const subjects = Array.isArray(state.subjects) ? state.subjects : [];
    const weeklyEvents = Array.isArray(state.weeklyEvents) ? state.weeklyEvents : [];

    // 1. Deduplicate subject lecture schedule slots
    subjects.forEach((s) => {
      if (Array.isArray(s.schedule) && s.schedule.length > 1) {
        const seenSlots = new Set();
        s.schedule = s.schedule.filter((slot) => {
          const key = `${slot.day}-${slot.start}-${slot.end}`;
          if (seenSlots.has(key)) return false;
          seenSlots.add(key);
          return true;
        });
      }
    });

    // 2. Deduplicate weeklyEvents
    if (weeklyEvents.length > 1) {
      const seenEvents = new Set();
      const dedupedEvents = [];
      weeklyEvents.forEach((ev) => {
        const key = `${(ev.title || '').trim().toLowerCase()}|${ev.day}|${ev.start}|${ev.end}|${ev.recurrence || 'weekly'}`;
        if (seenEvents.has(key)) {
          if (ev.id) state.deletedWeeklyEventIds[ev.id] = state.deletedWeeklyEventIds[ev.id] || new Date().toISOString();
          return;
        }
        seenEvents.add(key);
        dedupedEvents.push(ev);
      });
      state.weeklyEvents = dedupedEvents;
    }

    // 3. Ensure active recurring tasks have a dueDate and deduplicate uncompleted recurring duplicates
    const seenRecurring = new Set();
    const dedupedTasks = [];
    tasks.forEach((t) => {
      if (t.recurrence && t.recurrence !== 'none' && !t.completed) {
        if (!t.dueDate) {
          t.dueDate = toLocalDateStr(t.createdAt || new Date());
        }
        const recKey = `${(t.title || '').trim().toLowerCase()}|${t.recurrence}|${t.subject || ''}`;
        if (seenRecurring.has(recKey)) {
          if (t.id) state.deletedTaskIds[t.id] = state.deletedTaskIds[t.id] || new Date().toISOString();
          return;
        }
        seenRecurring.add(recKey);
      }
      dedupedTasks.push(t);
    });
    state.tasks = dedupedTasks;

    // 4. Split any midnight-crossing sessions & preserve existing split tombstones
    const rawSessions = Array.isArray(state.sessions) ? state.sessions : [];
    const existingSessIds = new Set(rawSessions.map((s) => s.id));
    const expandedSessions = [];
    rawSessions.forEach((s) => {
      if (state.deletedSessionIds[s.id]) return;
      const splitAlreadyExists = existingSessIds.has(`${s.id}-m2`) || Boolean(state.deletedSessionIds[`${s.id}-m2`]);
      if (s.isMidnightSplit || splitAlreadyExists) {
        expandedSessions.push(s);
      } else {
        const parts = this.splitSessionAcrossMidnights(s);
        parts.forEach((p) => {
          if (!state.deletedSessionIds[p.id]) {
            expandedSessions.push(p);
          }
        });
      }
    });

    // 5. Reconcile task-subject relationships across tasks & sessions
    const taskById = new Map();
    const taskByNormTitle = new Map();
    dedupedTasks.forEach((t) => {
      taskById.set(t.id, t);
      const norm = (t.title || '').trim().toLowerCase();
      if (norm) {
        // Prefer uncompleted task when ambiguous, otherwise first (most recent)
        const existing = taskByNormTitle.get(norm);
        if (!existing || (existing.completed && !t.completed)) {
          taskByNormTitle.set(norm, t);
        }
      }
    });

    expandedSessions.forEach((s) => {
      let matchedTask = s.taskId ? taskById.get(s.taskId) : null;
      if (!matchedTask && s.topic) {
        const normTopic = s.topic.trim().toLowerCase();
        const candidate = taskByNormTitle.get(normTopic);
        if (candidate) {
          matchedTask = candidate;
          if (!s.taskId) {
            s.taskId = candidate.id;
            s.synced = false;
          }
        }
      }
      if (matchedTask) {
        const expectedSubject = (matchedTask.subject && matchedTask.subject.trim()) ? matchedTask.subject.trim() : 'General';
        if (s.subject !== expectedSubject) {
          s.subject = expectedSubject;
          s.synced = false;
        }
      }
    });

    // Fix split-subject topics where Circuit Analysis leaked alongside General on non-Circuit tasks
    const sessionsByTopic = new Map();
    expandedSessions.forEach((s) => {
      const normTopic = (s.topic || '').trim().toLowerCase();
      if (!normTopic) return;
      if (!sessionsByTopic.has(normTopic)) sessionsByTopic.set(normTopic, []);
      sessionsByTopic.get(normTopic).push(s);
    });

    sessionsByTopic.forEach((groupSessions, normTopic) => {
      const hasCircuit = groupSessions.some((s) => s.subject === 'Circuit Analysis');
      const nonCircuit = groupSessions.find((s) => s.subject && s.subject !== 'Circuit Analysis');
      const task = taskByNormTitle.get(normTopic);
      if (hasCircuit && (nonCircuit || (task && !task.subject))) {
        const targetSubj = task
          ? ((task.subject && task.subject.trim()) ? task.subject.trim() : 'General')
          : nonCircuit.subject;
        if (!task || task.subject !== 'Circuit Analysis') {
          groupSessions.forEach((s) => {
            if (s.subject === 'Circuit Analysis') {
              s.subject = targetSubj;
              if (task && !s.taskId) s.taskId = task.id;
              s.synced = false;
            }
          });
        }
      }
    });

    state.sessions = expandedSessions;
  }

  getTaskSessionStats(taskOrId) {
    const task = typeof taskOrId === 'string'
      ? this.state.tasks.find((t) => t.id === taskOrId)
      : taskOrId;
    if (!task) {
      return { sessionCount: 0, totalSec: 0, totalMins: 0, sessions: [] };
    }

    const normTitle = (task.title || '').trim().toLowerCase();
    const linked = (this.state.sessions || []).filter((s) => {
      if (s.taskId === task.id) return true;
      if (!s.taskId && !task.parentRecurringId && normTitle && s.topic && s.topic.trim().toLowerCase() === normTitle) {
        return true;
      }
      return false;
    });

    const logicalIds = new Set(linked.map((s) => String(s.id || '').replace(/-m\d+$/, '')));
    const sumSessionsSec = linked.reduce((acc, s) => acc + (s.durationSec || 0), 0);
    const totalSec = Math.max(task.timeSpentSec || 0, sumSessionsSec);
    const totalMins = Math.round(totalSec / 60);
    const sessionCount = linked.length > 0 ? logicalIds.size : (totalMins > 0 ? 1 : 0);

    return {
      sessionCount,
      totalSec,
      totalMins,
      sessions: linked
    };
  }

  sanitizeState(state) {
    if (!state || typeof state !== 'object') return { ...INITIAL_STATE };

    const subjects = Array.isArray(state.subjects) ? state.subjects : [...INITIAL_SUBJECTS];
    let groups = Array.isArray(state.groups) && state.groups.length > 0 ? [...state.groups] : [...DEFAULT_GROUPS];

    // Ensure all tombstone maps exist
    state.deletedTaskIds = (state.deletedTaskIds && typeof state.deletedTaskIds === 'object') ? state.deletedTaskIds : {};
    state.deletedSessionIds = (state.deletedSessionIds && typeof state.deletedSessionIds === 'object') ? state.deletedSessionIds : {};
    state.deletedSubjectIds = (state.deletedSubjectIds && typeof state.deletedSubjectIds === 'object') ? state.deletedSubjectIds : {};
    state.deletedWeeklyEventIds = (state.deletedWeeklyEventIds && typeof state.deletedWeeklyEventIds === 'object') ? state.deletedWeeklyEventIds : {};
    state.deletedGroups = (state.deletedGroups && typeof state.deletedGroups === 'object') ? state.deletedGroups : {};

    // If state comes from legacy schema before v11, seed missing authentic subjects
    if (!state.version || state.version < 11) {
      INITIAL_SUBJECTS.forEach((initSub) => {
        if (!subjects.some((s) => s.id === initSub.id || (s.name && s.name.toLowerCase() === initSub.name.toLowerCase()))) {
          subjects.push({ ...initSub });
        }
      });
    }

    // Migrate any legacy 'Seminars & Academies' occurrences to user's authentic category 'Kardeşlik ve İhya'
    subjects.forEach((s) => {
      if ((s.id === 'sub-ihya' || (s.name && s.name.includes('İhya'))) && s.group === 'Seminars & Academies') {
        s.group = 'Kardeşlik ve İhya';
      }
      if (s.group && !groups.includes(s.group)) {
        groups.push(s.group);
      }
    });

    // Weekly Events sanitization
    const weeklyEvents = Array.isArray(state.weeklyEvents) ? state.weeklyEvents : [...INITIAL_WEEKLY_EVENTS];
    weeklyEvents.forEach((ev) => {
      if ((ev.id === 'wevent-ihya' || (ev.title && ev.title.includes('İhya'))) && ev.category === 'Seminars & Academies') {
        ev.category = 'Kardeşlik ve İhya';
      }
      if (!ev.recurrence) ev.recurrence = 'weekly';
      if (ev.category && !groups.includes(ev.category)) {
        groups.push(ev.category);
      }
    });

    // Clean up empty 'Seminars & Academies' group if not used by any subject or event
    const hasSeminarsSubject = subjects.some((s) => s.group === 'Seminars & Academies');
    const hasSeminarsEvent = weeklyEvents.some((ev) => ev.category === 'Seminars & Academies');
    if (!hasSeminarsSubject && !hasSeminarsEvent) {
      groups = groups.filter((g) => g !== 'Seminars & Academies');
    }

    // Raw tasks array
    const rawTasks = Array.isArray(state.tasks) ? state.tasks : [];
    
    // Ensure legacy seed tasks that are not present are tombstoned so cloud sync never resurrects them
    LEGACY_SEED_TASK_IDS.forEach((id) => {
      if (!rawTasks.some((t) => t.id === id)) {
        state.deletedTaskIds[id] = state.deletedTaskIds[id] || '2026-11-12T00:00:00.000Z';
      }
    });

    // Prune any task that has a tombstone
    const tasks = rawTasks.filter((t) => {
      const delTime = state.deletedTaskIds[t.id];
      if (delTime) {
        const taskUpdated = new Date(t.updatedAt || t.createdAt || 0).getTime();
        return new Date(delTime).getTime() < taskUpdated;
      }
      return true;
    });

    tasks.forEach((t) => {
      if (!t.recurrence) t.recurrence = 'none';
      if (!t.createdAt) t.createdAt = new Date().toISOString();
      if (!t.updatedAt) t.updatedAt = t.createdAt;
      if (t.deletedAt === undefined) t.deletedAt = null;
      if (t.synced === undefined) t.synced = true;
    });

    // Sessions sanitization with tombstone pruning
    const rawSessions = Array.isArray(state.sessions) ? state.sessions : [];
    if (!rawSessions.some((s) => s.id === 'sess-eef211-1')) {
      state.deletedSessionIds['sess-eef211-1'] = state.deletedSessionIds['sess-eef211-1'] || '2026-11-12T00:00:00.000Z';
    }
    const sessions = rawSessions.filter((s) => !state.deletedSessionIds[s.id]);
    sessions.forEach((s) => {
      if (!s.createdAt) s.createdAt = s.startTime || new Date().toISOString();
      if (!s.updatedAt) s.updatedAt = s.createdAt;
      if (s.synced === undefined) s.synced = true;
    });
    state.sessions = sessions;

    // Prune subjects by tombstone
    const cleanSubjects = subjects.filter((s) => !state.deletedSubjectIds[s.id]);
    cleanSubjects.forEach((s) => {
      if (!s.updatedAt) s.updatedAt = new Date().toISOString();
      if (s.deletedAt === undefined) s.deletedAt = null;
    });

    // Prune weekly events by tombstone
    const cleanWeeklyEvents = weeklyEvents.filter((e) => !state.deletedWeeklyEventIds[e.id]);
    cleanWeeklyEvents.forEach((e) => {
      if (!e.updatedAt) e.updatedAt = new Date().toISOString();
      if (e.deletedAt === undefined) e.deletedAt = null;
    });

    // Prune groups by tombstone
    const cleanGroups = groups.filter((g) => !state.deletedGroups[g]);

    if (!state.settings) state.settings = { ...INITIAL_STATE.settings };
    if (!state.settings.fontStyle) state.settings.fontStyle = 'sans';
    if (!state.settings.theme) state.settings.theme = 'slate';
    if (!state.settings.timerStyle || state.settings.timerStyle === 'chronometer') {
      state.settings.timerStyle = 'chronograph';
    }
    if (!state.settings.layoutFormat || !['auto', 'mobile', 'desktop'].includes(state.settings.layoutFormat)) {
      state.settings.layoutFormat = 'auto';
    }

    if (!state.sync) {
      state.sync = { ...INITIAL_STATE.sync };
    } else {
      state.sync = { ...INITIAL_STATE.sync, ...state.sync };
    }

    if (!state.activeTimer) {
      state.activeTimer = { ...INITIAL_STATE.activeTimer };
    } else if (state.activeTimer.linkedTaskId) {
      const linked = tasks.find((t) => t.id === state.activeTimer.linkedTaskId);
      if (linked) {
        state.activeTimer.subject = linked.subject || '';
        state.activeTimer.topic = linked.title;
      }
    } else if (state.activeTimer.subject === 'Circuit Analysis' && !state.activeTimer.isRunning && !state.activeTimer.topic) {
      state.activeTimer.subject = '';
    }

    state.version = 12;
    state.subjects = cleanSubjects;
    state.groups = [...new Set(cleanGroups)];
    state.weeklyEvents = cleanWeeklyEvents;
    state.tasks = tasks;

    this.reconcileTasksAndSessions(state);
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

      const candidate = {
        ...INITIAL_STATE,
        ...parsed,
        groups: parsed.groups && parsed.groups.length > 0 ? parsed.groups : DEFAULT_GROUPS,
        subjects: parsed.subjects && parsed.subjects.length > 0 ? parsed.subjects : INITIAL_SUBJECTS,
        weeklyEvents: parsed.weeklyEvents || INITIAL_WEEKLY_EVENTS,
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        settings: { ...INITIAL_STATE.settings, ...(parsed.settings || {}) },
        activeTimer: { ...INITIAL_STATE.activeTimer, ...(parsed.activeTimer || {}) }
      };
      return this.sanitizeState(candidate);
    } catch (err) {
      console.warn('Failed to parse localStorage, resetting to initial state', err);
      return { ...INITIAL_STATE };
    }
  }

  saveState({ emitSyncEvent = true, notifyUI = true } = {}) {
    try {
      if (emitSyncEvent && this.state && this.state.sync) {
        this.state.sync.hasChanges = true;
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      }
      if (emitSyncEvent && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
        window.dispatchEvent(new CustomEvent('chronostudy:state-changed', { detail: { timestamp: Date.now() } }));
      }
    } catch (err) {
      console.error('Failed to save to localStorage', err);
    }
    if (notifyUI) {
      this.notify();
    }
  }

  // --- Safety Backup Snapshots (Zero Data Loss Protection) ---
  createSafetyBackup() {
    try {
      if (typeof localStorage !== 'undefined') {
        const payload = {
          backupAt: new Date().toISOString(),
          version: this.state.version,
          state: this.state
        };
        localStorage.setItem('chronostudy_pre_sync_backup', JSON.stringify(payload));
      }
    } catch (err) {
      console.warn('Safety backup snapshot failed:', err);
    }
  }

  restoreSafetyBackup() {
    try {
      if (typeof localStorage !== 'undefined') {
        const serialized = localStorage.getItem('chronostudy_pre_sync_backup');
        if (serialized) {
          const parsed = JSON.parse(serialized);
          if (parsed && parsed.state) {
            this.state = this.sanitizeState(parsed.state);
            this.saveState();
            return { success: true, backupAt: parsed.backupAt };
          }
        }
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
    return { success: false, error: 'No safety backup found' };
  }

  // --- Cloud Sync Payload & Settings ---
  getSyncPayload() {
    return {
      version: this.state.version,
      exportedAt: new Date().toISOString(),
      groups: this.state.groups,
      deletedGroups: this.state.deletedGroups || {},
      subjects: this.state.subjects,
      deletedSubjectIds: this.state.deletedSubjectIds || {},
      weeklyEvents: this.state.weeklyEvents,
      deletedWeeklyEventIds: this.state.deletedWeeklyEventIds || {},
      tasks: this.state.tasks,
      deletedTaskIds: this.state.deletedTaskIds || {},
      sessions: this.state.sessions,
      deletedSessionIds: this.state.deletedSessionIds || {},
      settings: this.state.settings
    };
  }

  updateSyncSettings(partial) {
    if (!this.state.sync) this.state.sync = { ...INITIAL_STATE.sync };
    this.state.sync = {
      ...this.state.sync,
      ...partial
    };
    this.saveState();
  }

  markRecordsSynced(syncTimestamp = new Date().toISOString()) {
    this.state.tasks.forEach((t) => { t.synced = true; });
    this.state.sessions.forEach((s) => { s.synced = true; });
    if (!this.state.sync) this.state.sync = { ...INITIAL_STATE.sync };
    this.state.sync.hasChanges = false;
    this.state.sync.lastSyncedAt = syncTimestamp;
    this.state.sync.status = 'synced';
    this.state.sync.lastError = null;
    this.saveState({ emitSyncEvent: false, notifyUI: false });
  }

  getUnsyncedChanges() {
    const unsyncedTasks = this.state.tasks.filter((t) => t.synced === false);
    const unsyncedSessions = this.state.sessions.filter((s) => s.synced === false);
    const hasDirty = Boolean(this.state.sync && this.state.sync.hasChanges);
    return {
      hasChanges: hasDirty || unsyncedTasks.length > 0 || unsyncedSessions.length > 0,
      tasks: unsyncedTasks,
      sessions: unsyncedSessions,
      count: unsyncedTasks.length + unsyncedSessions.length + (hasDirty ? 1 : 0)
    };
  }

  // --- Deterministic 3-Way Cloud Merge Engine ---
  mergeRemoteState(remote) {
    if (!remote || typeof remote !== 'object') {
      return { success: false, error: 'Invalid remote sync payload' };
    }

    // 1. Take safety snapshot before touching state
    this.createSafetyBackup();

    let changesCount = 0;
    const nowIso = new Date().toISOString();

    // 2. Additive Merge for Study Sessions with Tombstone Protection (Zero loss, deduplicated by ID)
    if (!this.state.deletedSessionIds) this.state.deletedSessionIds = {};
    if (remote.deletedSessionIds && typeof remote.deletedSessionIds === 'object') {
      Object.entries(remote.deletedSessionIds).forEach(([delId, delTime]) => {
        const existing = this.state.deletedSessionIds[delId];
        if (!existing || new Date(delTime) > new Date(existing)) {
          this.state.deletedSessionIds[delId] = delTime;
        }
      });
    }
    // Prune locally deleted sessions
    this.state.sessions = this.state.sessions.filter((s) => !this.state.deletedSessionIds[s.id]);

    if (Array.isArray(remote.sessions)) {
      const localSessionIds = new Set(this.state.sessions.map((s) => s.id));
      remote.sessions.forEach((remoteSess) => {
        if (this.state.deletedSessionIds[remoteSess.id]) return; // NEVER resurrect deleted session
        if (!localSessionIds.has(remoteSess.id)) {
          this.state.sessions.push({ ...remoteSess, synced: true });
          localSessionIds.add(remoteSess.id);
          changesCount++;
        }
      });
      // Sort sessions descending by start time
      this.state.sessions.sort((a, b) => new Date(b.startTime || b.date || 0) - new Date(a.startTime || a.date || 0));
    }

    // 3. Merge Deleted Task Tombstones (Guarantees deleted tasks NEVER resurrect)
    if (!this.state.deletedTaskIds) this.state.deletedTaskIds = {};
    if (remote.deletedTaskIds && typeof remote.deletedTaskIds === 'object') {
      Object.entries(remote.deletedTaskIds).forEach(([delId, delTime]) => {
        const existingDel = this.state.deletedTaskIds[delId];
        if (!existingDel || new Date(delTime) > new Date(existingDel)) {
          this.state.deletedTaskIds[delId] = delTime;
        }
      });
    }

    // Prune locally any task that has a tombstone
    this.state.tasks = this.state.tasks.filter((t) => {
      const delTime = this.state.deletedTaskIds[t.id];
      if (delTime) {
        const taskUpdated = new Date(t.updatedAt || t.createdAt || 0).getTime();
        if (new Date(delTime).getTime() >= taskUpdated) {
          changesCount++;
          return false;
        }
      }
      return true;
    });

    // 4. Last-Write-Wins Merge for Tasks (resolved by updatedAt & tombstones)
    if (Array.isArray(remote.tasks)) {
      const localTaskMap = new Map(this.state.tasks.map((t) => [t.id, t]));
      remote.tasks.forEach((remoteTask) => {
        // Skip if task was deleted either locally or remotely
        const delTime = this.state.deletedTaskIds[remoteTask.id];
        if (delTime) {
          const remoteUpdated = new Date(remoteTask.updatedAt || remoteTask.createdAt || 0).getTime();
          if (new Date(delTime).getTime() >= remoteUpdated) {
            return;
          }
        }
        if (remoteTask.deletedAt) {
          this.state.deletedTaskIds[remoteTask.id] = remoteTask.deletedAt;
          return;
        }

        const localTask = localTaskMap.get(remoteTask.id);
        if (!localTask) {
          this.state.tasks.unshift({ ...remoteTask, synced: true });
          changesCount++;
        } else {
          const remoteUpdated = new Date(remoteTask.updatedAt || remoteTask.createdAt || 0).getTime();
          const localUpdated = new Date(localTask.updatedAt || localTask.createdAt || 0).getTime();
          if (remoteUpdated > localUpdated) {
            Object.assign(localTask, remoteTask, { synced: true });
            changesCount++;
          }
        }
      });
    }

    // 5. Merge Subjects with Tombstone Protection
    if (!this.state.deletedSubjectIds) this.state.deletedSubjectIds = {};
    if (remote.deletedSubjectIds && typeof remote.deletedSubjectIds === 'object') {
      Object.entries(remote.deletedSubjectIds).forEach(([delId, delTime]) => {
        const existing = this.state.deletedSubjectIds[delId];
        if (!existing || new Date(delTime) > new Date(existing)) {
          this.state.deletedSubjectIds[delId] = delTime;
        }
      });
    }
    this.state.subjects = this.state.subjects.filter((s) => !this.state.deletedSubjectIds[s.id]);

    if (Array.isArray(remote.subjects)) {
      const localSubMap = new Map(this.state.subjects.map((s) => [s.id, s]));
      remote.subjects.forEach((remoteSub) => {
        if (this.state.deletedSubjectIds[remoteSub.id]) return; // NEVER resurrect deleted subject
        const localSub = localSubMap.get(remoteSub.id);
        if (!localSub) {
          if (!remoteSub.deletedAt) {
            this.state.subjects.push({ ...remoteSub });
            changesCount++;
          }
        } else {
          const remoteUpdated = new Date(remoteSub.updatedAt || 0).getTime();
          const localUpdated = new Date(localSub.updatedAt || 0).getTime();
          if (remoteUpdated > localUpdated) {
            if (remoteSub.deletedAt) {
              this.state.subjects = this.state.subjects.filter((s) => s.id !== remoteSub.id);
            } else {
              Object.assign(localSub, remoteSub);
            }
            changesCount++;
          }
        }
      });
    }

    // 6. Merge Weekly Events with Tombstone Protection
    if (!this.state.deletedWeeklyEventIds) this.state.deletedWeeklyEventIds = {};
    if (remote.deletedWeeklyEventIds && typeof remote.deletedWeeklyEventIds === 'object') {
      Object.entries(remote.deletedWeeklyEventIds).forEach(([delId, delTime]) => {
        const existing = this.state.deletedWeeklyEventIds[delId];
        if (!existing || new Date(delTime) > new Date(existing)) {
          this.state.deletedWeeklyEventIds[delId] = delTime;
        }
      });
    }
    this.state.weeklyEvents = this.state.weeklyEvents.filter((e) => !this.state.deletedWeeklyEventIds[e.id]);

    if (Array.isArray(remote.weeklyEvents)) {
      const localEvMap = new Map(this.state.weeklyEvents.map((e) => [e.id, e]));
      remote.weeklyEvents.forEach((remoteEv) => {
        if (this.state.deletedWeeklyEventIds[remoteEv.id]) return; // NEVER resurrect deleted event
        const localEv = localEvMap.get(remoteEv.id);
        if (!localEv) {
          if (!remoteEv.deletedAt) {
            this.state.weeklyEvents.push({ ...remoteEv });
            changesCount++;
          }
        } else {
          const remoteUpdated = new Date(remoteEv.updatedAt || 0).getTime();
          const localUpdated = new Date(localEv.updatedAt || 0).getTime();
          if (remoteUpdated > localUpdated) {
            if (remoteEv.deletedAt) {
              this.state.weeklyEvents = this.state.weeklyEvents.filter((e) => e.id !== remoteEv.id);
            } else {
              Object.assign(localEv, remoteEv);
            }
            changesCount++;
          }
        }
      });
    }

    // 7. Merge Groups with Tombstone Protection
    if (!this.state.deletedGroups) this.state.deletedGroups = {};
    if (remote.deletedGroups && typeof remote.deletedGroups === 'object') {
      Object.entries(remote.deletedGroups).forEach(([delGrp, delTime]) => {
        const existing = this.state.deletedGroups[delGrp];
        if (!existing || new Date(delTime) > new Date(existing)) {
          this.state.deletedGroups[delGrp] = delTime;
        }
      });
    }
    this.state.groups = this.state.groups.filter((g) => !this.state.deletedGroups[g]);

    if (Array.isArray(remote.groups)) {
      remote.groups.forEach((g) => {
        if (this.state.deletedGroups[g]) return; // NEVER resurrect deleted category
        if (!this.state.groups.includes(g)) {
          this.state.groups.push(g);
          changesCount++;
        }
      });
    }

    // 7. Merge Settings
    if (remote.settings) {
      this.state.settings = { ...this.state.settings, ...remote.settings };
    }

    this.reconcileTasksAndSessions(this.state);

    if (!this.state.sync) this.state.sync = { ...INITIAL_STATE.sync };
    this.state.sync.lastSyncedAt = nowIso;
    this.state.sync.status = 'synced';
    this.state.sync.lastError = null;

    if (changesCount > 0) {
      this.saveState({ emitSyncEvent: false, notifyUI: true });
    } else {
      this.saveState({ emitSyncEvent: false, notifyUI: false });
    }
    return { success: true, changesCount };
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
    const isRecurring = recurrence && recurrence !== 'none';
    let cleanDueDate = dueDate && dueDate.trim() ? dueDate.trim() : null;

    // If task is set as repeated task but no due date was chosen, default to TODAY so it's immediately seen in today's tasks
    if (isRecurring && !cleanDueDate) {
      cleanDueDate = toLocalDateStr(new Date());
    }

    const cleanSubject = subject && subject.trim() && subject.trim().toLowerCase() !== 'none' && subject.trim().toLowerCase() !== 'all' ? subject.trim() : null;
    const nowIso = new Date().toISOString();

    const newTask = {
      id: 'task-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      title: title.trim(),
      subject: cleanSubject,
      targetMinutes: parsedMins && parsedMins > 0 ? parsedMins : null,
      dueDate: cleanDueDate,
      recurrence: isRecurring ? recurrence : 'none',
      recurrenceInterval: recurrenceInterval ? parseInt(recurrenceInterval, 10) : null,
      parentRecurringId: null,
      notes: notes ? notes.trim() : '',
      completed: false,
      completedDates: {},
      createdAt: nowIso,
      updatedAt: nowIso,
      deletedAt: null,
      synced: false,
      completedAt: null,
      timeSpentSec: 0
    };
    this.state.tasks.unshift(newTask);
    this.saveState();
    return newTask;
  }

  isTaskCompletedOnDate(task, dateStr) {
    if (!task) return false;
    const rec = task.recurrence || 'none';
    if (rec === 'none') return Boolean(task.completed);
    if (task.completedDates && dateStr && task.completedDates[dateStr]) return true;
    if (task.completed) {
      const doneDateStr = task.completedAt ? toLocalDateStr(task.completedAt) : task.dueDate;
      return doneDateStr === dateStr;
    }
    return false;
  }

  toggleTaskForDate(taskId, dateStr) {
    const task = this.state.tasks.find((t) => t.id === taskId);
    if (!task) return;

    const rec = task.recurrence || 'none';
    if (!dateStr || rec === 'none') {
      this.toggleTask(taskId);
      return;
    }

    if (!task.completedDates || typeof task.completedDates !== 'object') {
      task.completedDates = {};
    }

    const nowIso = new Date().toISOString();
    const todayStr = toLocalDateStr(new Date());
    const wasDone = this.isTaskCompletedOnDate(task, dateStr);

    if (wasDone) {
      delete task.completedDates[dateStr];
      if (task.completed) {
        task.completed = false;
        task.completedAt = null;
      }
    } else {
      task.completedDates[dateStr] = nowIso;
      if (task.dueDate === dateStr || (!task.dueDate && dateStr === todayStr)) {
        const nextDate = this.calculateNextRecurrenceDate(dateStr, rec, task.recurrenceInterval);
        if (nextDate) {
          task.dueDate = nextDate;
        }
      }
    }

    task.updatedAt = nowIso;
    task.synced = false;
    this.saveState();
  }

  toggleTask(taskId) {
    const task = this.state.tasks.find((t) => t.id === taskId);
    if (!task) return;

    const wasCompleted = task.completed;
    task.completed = !wasCompleted;
    task.completedAt = task.completed ? new Date().toISOString() : null;
    task.updatedAt = new Date().toISOString();
    task.synced = false;

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
        const nextNowIso = new Date().toISOString();
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
          createdAt: nextNowIso,
          updatedAt: nextNowIso,
          deletedAt: null,
          synced: false,
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
    const oldTimeSpent = task.timeSpentSec || 0;
    const oldTitle = task.title;
    const oldNormTitle = (oldTitle || '').trim().toLowerCase();

    const isRecurring = updates.recurrence && updates.recurrence !== 'none';
    if (isRecurring) {
      if (updates.dueDate === undefined && !task.dueDate) {
        updates.dueDate = toLocalDateStr(new Date());
      } else if (updates.dueDate === null || updates.dueDate === '') {
        updates.dueDate = toLocalDateStr(new Date());
      }
    }

    Object.assign(task, updates);
    task.updatedAt = new Date().toISOString();
    task.synced = false;

    const resolvedSubject = (task.subject && task.subject.trim()) ? task.subject.trim() : 'General';
    // Cascade task title/subject updates to all linked or topic-matched sessions
    (this.state.sessions || []).forEach((s) => {
      const sNormTopic = (s.topic || '').trim().toLowerCase();
      const matchesById = s.taskId === taskId;
      const matchesByOldTopic = !s.taskId && oldNormTitle && sNormTopic === oldNormTitle;
      if (matchesById || matchesByOldTopic) {
        if (!s.taskId) s.taskId = taskId;
        if (s.subject !== resolvedSubject || s.topic !== task.title) {
          s.subject = resolvedSubject;
          s.topic = task.title;
          s.updatedAt = task.updatedAt;
          s.synced = false;
        }
      }
    });

    if (this.state.activeTimer && this.state.activeTimer.linkedTaskId === taskId) {
      this.state.activeTimer.subject = task.subject || '';
      this.state.activeTimer.topic = task.title;
    }

    // Automatically record or adjust study session when user logs time spent on a task
    if (updates.timeSpentSec !== undefined && updates.timeSpentSec !== oldTimeSpent) {
      const diffSec = updates.timeSpentSec - oldTimeSpent;
      if (diffSec > 0) {
        const existingSession = this.state.sessions.find((s) => s.taskId === taskId);
        if (existingSession) {
          existingSession.durationSec = Math.max(60, (existingSession.durationSec || 0) + diffSec);
          existingSession.synced = false;
        } else {
          const now = new Date();
          const start = new Date(now.getTime() - updates.timeSpentSec * 1000);
          this.state.sessions.unshift({
            id: 'sess-' + Math.random().toString(36).slice(2, 9),
            subject: task.subject || 'General',
            topic: task.title,
            taskId: task.id,
            durationSec: updates.timeSpentSec,
            startTime: start.toISOString(),
            endTime: now.toISOString(),
            notes: task.notes || 'Recorded time spent on task',
            createdAt: now.toISOString(),
            synced: false
          });
        }
      } else if (diffSec < 0) {
        const existingSession = this.state.sessions.find((s) => s.taskId === taskId);
        if (existingSession) {
          existingSession.durationSec = Math.max(0, (existingSession.durationSec || 0) + diffSec);
          existingSession.synced = false;
        }
      }
    }

    this.saveState();
  }

  deleteTask(taskId) {
    if (!this.state.deletedTaskIds) this.state.deletedTaskIds = {};
    const nowIso = new Date().toISOString();
    this.state.deletedTaskIds[taskId] = nowIso;
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
      task.updatedAt = new Date().toISOString();
      task.synced = false;
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

    const trimmedTopic = topic ? topic.trim() : '';
    let resolvedTaskId = taskId || null;
    let linkedTask = resolvedTaskId ? this.state.tasks.find((t) => t.id === resolvedTaskId) : null;

    if (!linkedTask && trimmedTopic) {
      const normTopic = trimmedTopic.toLowerCase();
      linkedTask = this.state.tasks.find((t) => !t.completed && (t.title || '').trim().toLowerCase() === normTopic)
        || this.state.tasks.find((t) => (t.title || '').trim().toLowerCase() === normTopic)
        || null;
      if (linkedTask) {
        resolvedTaskId = linkedTask.id;
      }
    }

    let cleanSubject;
    if (linkedTask) {
      cleanSubject = (linkedTask.subject && linkedTask.subject.trim())
        ? linkedTask.subject.trim()
        : ((subject && subject.trim() && subject.trim() !== 'Circuit Analysis' && subject.trim().toLowerCase() !== 'none') ? subject.trim() : 'General');
    } else {
      cleanSubject = subject && subject.trim() && subject.trim().toLowerCase() !== 'none' ? subject.trim() : 'General';
    }

    const nowIso = now.toISOString();
    const newSession = {
      id: 'sess-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      subject: cleanSubject,
      topic: trimmedTopic || (linkedTask ? linkedTask.title : 'Study Session'),
      taskId: resolvedTaskId,
      durationSec: Math.max(1, Math.round(durationSec)),
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      notes: notes ? notes.trim() : '',
      createdAt: nowIso,
      updatedAt: nowIso,
      synced: false
    };

    const segments = this.splitSessionAcrossMidnights(newSession);
    // Unshift in reverse so later chronological segments stay on top
    for (let i = segments.length - 1; i >= 0; i--) {
      this.state.sessions.unshift(segments[i]);
    }

    if (resolvedTaskId) {
      this.addTimeSpentToTask(resolvedTaskId, newSession.durationSec);
    }

    this.saveState();
    return segments[0];
  }

  deleteSession(sessionId) {
    if (!this.state.deletedSessionIds) this.state.deletedSessionIds = {};
    this.state.deletedSessionIds[sessionId] = new Date().toISOString();
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
    if (!this.state.deletedSubjectIds) this.state.deletedSubjectIds = {};
    this.state.deletedSubjectIds[subjectId] = new Date().toISOString();
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
    if (!this.state.deletedGroups) this.state.deletedGroups = {};
    this.state.deletedGroups[groupName] = new Date().toISOString();
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
    if (!this.state.deletedWeeklyEventIds) this.state.deletedWeeklyEventIds = {};
    this.state.deletedWeeklyEventIds[eventId] = new Date().toISOString();
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
  updateActiveTimer(partial, { forceSave = false } = {}) {
    this.state.activeTimer = {
      ...this.state.activeTimer,
      ...partial
    };
    const now = Date.now();
    // Throttle synchronous flash disk writes to once every 5 seconds unless forceSave is requested
    if (forceSave || !this._lastTimerDiskSave || now - this._lastTimerDiskSave >= 5000) {
      this._lastTimerDiskSave = now;
      this.saveState({ emitSyncEvent: false, notifyUI: false });
    }
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
    const todayStr = toLocalDateStr(startOfToday);

    const todaySessions = this.state.sessions.filter((s) => this.getSessionDateStr(s) === todayStr);

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

  // --- Routine / Recurring Task Date Matcher ---
  doesTaskOccurOnDate(task, targetDateStr) {
    if (!task || !targetDateStr) return false;
    const rec = task.recurrence || 'none';
    if (rec === 'none') {
      return task.dueDate === targetDateStr;
    }

    if (task.completedDates && task.completedDates[targetDateStr]) {
      return true;
    }

    if (task.completed) {
      const doneDateStr = task.completedAt ? toLocalDateStr(task.completedAt) : task.dueDate;
      return doneDateStr === targetDateStr;
    }

    const createdStr = task.createdAt ? toLocalDateStr(task.createdAt) : null;
    let anchorStr = task.dueDate || createdStr;
    if (task.completedDates && Object.keys(task.completedDates).length > 0 && createdStr && (!anchorStr || createdStr < anchorStr)) {
      anchorStr = createdStr;
    }
    if (!anchorStr) return false;
    if (targetDateStr < anchorStr) return false;
    if (targetDateStr === anchorStr) return true;

    const anchorDate = new Date(`${anchorStr}T12:00:00`);
    const targetDate = new Date(`${targetDateStr}T12:00:00`);
    if (Number.isNaN(anchorDate.getTime()) || Number.isNaN(targetDate.getTime())) {
      return false;
    }

    const diffDays = Math.round((targetDate.getTime() - anchorDate.getTime()) / 86400000);
    if (diffDays < 0) return false;

    const interval = Math.max(1, parseInt(task.recurrenceInterval || 1, 10) || 1);
    switch (rec) {
      case 'daily':
        return diffDays % interval === 0;
      case 'weekdays': {
        const day = targetDate.getDay() || 7; // Mon=1 .. Sun=7
        return day >= 1 && day <= 5;
      }
      case 'weekly':
        return diffDays % (7 * interval) === 0;
      case 'biweekly':
        return diffDays % 14 === 0;
      case 'monthly':
        return targetDate.getDate() === anchorDate.getDate();
      case 'custom':
        return diffDays % interval === 0;
      default:
        return task.dueDate === targetDateStr;
    }
  }

  // --- Comprehensive Analytics Engine ---
  getAnalyticsData(options = {}) {
    const weekOffset = Number.isFinite(options.weekOffset) ? options.weekOffset : 0;
    const subjectScope = options.subjectScope === 'all' ? 'all' : 'week';

    const sessions = this.state.sessions || [];
    const tasks = this.state.tasks || [];
    const subjects = this.state.subjects || [];

    const getMondayOfDate = (dateObj) => {
      const d = new Date(dateObj);
      const day = d.getDay();
      const distToMon = (day + 6) % 7;
      d.setDate(d.getDate() - distToMon);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const formatDurationHM = (sec) => {
      const totalMins = Math.round((sec || 0) / 60);
      const h = Math.floor(totalMins / 60);
      const m = totalMins % 60;
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    // Total focus stats (all-time)
    let totalSec = 0;
    sessions.forEach((s) => {
      totalSec += (s.durationSec || 0);
    });

    // Current week Monday
    const now = new Date();
    const currentMon = getMondayOfDate(now);

    // Selected week Monday - Sunday boundary
    const mon = new Date(currentMon);
    mon.setDate(currentMon.getDate() + weekOffset * 7);
    mon.setHours(0, 0, 0, 0);

    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    sun.setHours(23, 59, 59, 999);

    const monTime = mon.getTime();
    const sunTime = sun.getTime();

    // Previous week relative to selected week
    const prevMon = new Date(mon);
    prevMon.setDate(mon.getDate() - 7);
    const prevSun = new Date(mon);
    prevSun.setDate(mon.getDate() - 1);
    prevSun.setHours(23, 59, 59, 999);
    const prevMonTime = prevMon.getTime();
    const prevSunTime = prevSun.getTime();

    let weekSec = 0;
    let prevWeekSec = 0;
    let weekSessionsCount = 0;
    const activeDaysSet = new Set();

    // 7-day focus trend for selected week
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const todayStr = toLocalDateStr(now);
    const dailyTrend = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      const dStr = toLocalDateStr(d);
      dailyTrend.push({
        dayIndex: (i + 1) % 7,
        label: dayLabels[i],
        dateStr: dStr,
        durationSec: 0,
        durationMins: 0,
        sessionCount: 0,
        isToday: dStr === todayStr
      });
    }

    // Group all sessions by week Monday + build subject stats
    const weeklyBuckets = new Map(); // mondayStr -> { mondayDate, weekOffset, durationSec, sessionCount, activeDays: Set, subjectTotals: {} }

    const ensureWeekBucket = (mondayDate) => {
      const mStr = toLocalDateStr(mondayDate);
      if (!weeklyBuckets.has(mStr)) {
        const offset = Math.round((mondayDate.getTime() - currentMon.getTime()) / (7 * 86400000));
        const sDate = new Date(mondayDate);
        sDate.setDate(mondayDate.getDate() + 6);
        const shortOpt = { month: 'short', day: 'numeric' };
        weeklyBuckets.set(mStr, {
          mondayStr: mStr,
          sundayStr: toLocalDateStr(sDate),
          label: `${mondayDate.toLocaleDateString(undefined, shortOpt)} – ${sDate.toLocaleDateString(undefined, shortOpt)}`,
          shortLabel: mondayDate.toLocaleDateString(undefined, shortOpt),
          weekOffset: offset,
          durationSec: 0,
          sessionCount: 0,
          activeDays: new Set(),
          subjectTotals: {}
        });
      }
      return weeklyBuckets.get(mStr);
    };

    // Always include the last 8 weeks (including current week) + selected week
    for (let w = -7; w <= 0; w++) {
      const d = new Date(currentMon);
      d.setDate(currentMon.getDate() + w * 7);
      ensureWeekBucket(d);
    }
    ensureWeekBucket(mon);

    const subjectStatsMap = {};
    const ensureSubjectStat = (subName) => {
      if (!subjectStatsMap[subName]) {
        subjectStatsMap[subName] = {
          durationSec: 0,
          sessionCount: 0,
          lastStudiedTs: 0,
          dailySecs: [0, 0, 0, 0, 0, 0, 0]
        };
      }
      return subjectStatsMap[subName];
    };

    sessions.forEach((s) => {
      const d = s.startTime ? new Date(s.startTime) : new Date(s.createdAt);
      const t = d.getTime();
      const dur = s.durationSec || 0;
      const dStr = toLocalDateStr(d);
      const subName = s.subject || 'General / Other';

      // Record into weekly history bucket
      const sMon = getMondayOfDate(d);
      const bucket = ensureWeekBucket(sMon);
      bucket.durationSec += dur;
      bucket.sessionCount += 1;
      bucket.activeDays.add(dStr);
      bucket.subjectTotals[subName] = (bucket.subjectTotals[subName] || 0) + dur;

      // Selected week metrics
      const inSelectedWeek = t >= monTime && t <= sunTime;
      if (inSelectedWeek) {
        weekSec += dur;
        weekSessionsCount += 1;
        activeDaysSet.add(dStr);

        const trendDay = dailyTrend.find((td) => td.dateStr === dStr);
        if (trendDay) {
          trendDay.durationSec += dur;
          trendDay.durationMins = Math.round(trendDay.durationSec / 60);
          trendDay.sessionCount += 1;
        }
      }

      if (t >= prevMonTime && t <= prevSunTime) {
        prevWeekSec += dur;
      }

      // Subject breakdown (filtered by subjectScope)
      if (subjectScope === 'all' || inSelectedWeek) {
        const stat = ensureSubjectStat(subName);
        stat.durationSec += dur;
        stat.sessionCount += 1;
        if (t > stat.lastStudiedTs) stat.lastStudiedTs = t;
        if (inSelectedWeek) {
          const idx = (d.getDay() + 6) % 7; // Mon=0 .. Sun=6
          stat.dailySecs[idx] += dur;
        }
      }
    });

    const scopeTotalSec = Object.values(subjectStatsMap).reduce((acc, st) => acc + st.durationSec, 0);

    // Subject breakdown sorted by duration descending
    const subjectBreakdown = Object.entries(subjectStatsMap).map(([name, st]) => {
      const subObj = subjects.find((s) => s.name === name || s.code === name);
      const color = subObj ? subObj.color : '#64748b';
      const weeklyGoalHours = subObj && subObj.targetWeeklyHours ? Number(subObj.targetWeeklyHours) : 0;
      const percentage = scopeTotalSec > 0 ? Math.round((st.durationSec / scopeTotalSec) * 100) : 0;
      const durationMins = Math.round(st.durationSec / 60);
      const avgSessionMins = st.sessionCount > 0 ? Math.round(durationMins / st.sessionCount) : 0;
      const goalPct = (subjectScope === 'week' && weeklyGoalHours > 0)
        ? Math.min(100, Math.round(((st.durationSec / 3600) / weeklyGoalHours) * 100))
        : null;
      return {
        name,
        code: subObj ? (subObj.code || '') : '',
        group: subObj ? (subObj.group || 'General') : 'General',
        color,
        weeklyGoalHours,
        durationSec: st.durationSec,
        durationMins,
        durationHours: (st.durationSec / 3600).toFixed(1),
        formattedTime: formatDurationHM(st.durationSec),
        sessionCount: st.sessionCount,
        avgSessionMins,
        percentage,
        goalPct,
        lastStudiedStr: st.lastStudiedTs ? toLocalDateStr(new Date(st.lastStudiedTs)) : null,
        dailyMins: st.dailySecs.map((sec) => Math.round(sec / 60))
      };
    }).sort((a, b) => b.durationSec - a.durationSec);

    // Weekly history sorted chronologically
    const weeklyHistory = Array.from(weeklyBuckets.values())
      .sort((a, b) => a.mondayStr.localeCompare(b.mondayStr))
      .map((b) => ({
        mondayStr: b.mondayStr,
        sundayStr: b.sundayStr,
        label: b.label,
        shortLabel: b.shortLabel,
        weekOffset: b.weekOffset,
        durationSec: b.durationSec,
        durationMins: Math.round(b.durationSec / 60),
        durationHours: Number((b.durationSec / 3600).toFixed(1)),
        formattedTime: formatDurationHM(b.durationSec),
        sessionCount: b.sessionCount,
        activeDaysCount: b.activeDays.size,
        isCurrentWeek: b.weekOffset === 0,
        isSelected: b.weekOffset === weekOffset,
        subjectTotals: b.subjectTotals
      }));

    // Tasks metrics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.completed).length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const shortOpt = { month: 'short', day: 'numeric' };
    const selectedWeekLabel = weekOffset === 0
      ? `This Week (${mon.toLocaleDateString(undefined, shortOpt)} – ${sun.toLocaleDateString(undefined, shortOpt)})`
      : weekOffset === -1
        ? `Last Week (${mon.toLocaleDateString(undefined, shortOpt)} – ${sun.toLocaleDateString(undefined, shortOpt)})`
        : `${mon.toLocaleDateString(undefined, shortOpt)} – ${sun.toLocaleDateString(undefined, { ...shortOpt, year: 'numeric' })}`;

    return {
      weekOffset,
      subjectScope,
      selectedWeekLabel,
      selectedWeekRange: `${mon.toLocaleDateString(undefined, shortOpt)} – ${sun.toLocaleDateString(undefined, { ...shortOpt, year: 'numeric' })}`,
      totalSec,
      totalSessions: sessions.length,
      weekSec,
      prevWeekSec,
      weekSessionsCount,
      activeDaysCount: activeDaysSet.size,
      totalTasks,
      completedTasks,
      completionRate,
      dailyTrend,
      subjectBreakdown,
      weeklyHistory
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
