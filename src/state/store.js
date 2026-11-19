// @ts-check
// src/state/store.js — Reactive Local-First State Store composing pure domain engines
import { StorageAdapter } from './storage.js';
import {
  DEFAULT_GROUPS,
  INITIAL_SUBJECTS,
  INITIAL_WEEKLY_EVENTS,
  LEGACY_SEED_TASK_IDS,
  LEGACY_DEFAULT_SUBJECT,
  createInitialState
} from '../domain/presets.js';
import {
  toLocalDateStr,
  isMidnightTimestamp,
  getSessionDateStr
} from '../domain/date-utils.js';
import {
  calculateNextRecurrenceDate,
  isFrequentRecurringTask,
  isExpiredFrequentTask,
  doesTaskOccurOnDate,
  ensureRecurringTaskOccurrences
} from '../domain/recurrence.js';
import {
  splitSessionAcrossMidnights,
  reconcileTasksAndSessions
} from '../domain/reconcile.js';
import {
  buildSessionTaskIndex,
  getTaskSessionStats as computeTaskSessionStats,
  getSubjectStats as computeSubjectStats,
  getAnalyticsData as computeAnalyticsData
} from '../domain/analytics.js';
import {
  mergeRemoteState as applyRemoteMerge,
  compactTombstones
} from '../domain/sync-merge.js';
import {
  generateICS as buildICS,
  exportJSON as serializeStateJSON,
  exportCSV as serializeSessionsCSV
} from '../domain/exporters.js';

export {
  DEFAULT_GROUPS,
  INITIAL_SUBJECTS,
  INITIAL_WEEKLY_EVENTS,
  LEGACY_SEED_TASK_IDS,
  LEGACY_DEFAULT_SUBJECT,
  toLocalDateStr
};

export class Store {
  constructor() {
    this.listeners = new Set();
    this.storage = new StorageAdapter();
    this._stateRevision = 0;
    this._sessionTaskIndex = null;
    this._cachedRevision = -1;
    this._cachedSessionsRef = null;
    this._cachedSessionsLen = -1;
    this.state = this.sanitizeState(this.loadState());
    this.saveState({ emitSyncEvent: false, notifyUI: false });
  }

  _invalidateCache() {
    this._stateRevision += 1;
    this._sessionTaskIndex = null;
  }

  _getSessionTaskIndex() {
    const sessions = (this.state && this.state.sessions) || [];
    const sessionsLen = sessions.length;
    if (
      !this._sessionTaskIndex ||
      this._cachedRevision !== this._stateRevision ||
      this._cachedSessionsRef !== sessions ||
      this._cachedSessionsLen !== sessionsLen
    ) {
      this._sessionTaskIndex = buildSessionTaskIndex(sessions);
      this._cachedRevision = this._stateRevision;
      this._cachedSessionsRef = sessions;
      this._cachedSessionsLen = sessionsLen;
    }
    return this._sessionTaskIndex;
  }

  isMidnightTimestamp(isoOrDate) {
    return isMidnightTimestamp(isoOrDate);
  }

  getSessionDateStr(s) {
    return getSessionDateStr(s);
  }

  splitSessionAcrossMidnights(sessionObj) {
    return splitSessionAcrossMidnights(sessionObj);
  }

  reconcileTasksAndSessions(state) {
    return reconcileTasksAndSessions(state);
  }

  isFrequentRecurringTask(task) {
    return isFrequentRecurringTask(task);
  }

  isExpiredFrequentTask(task, todayStr = toLocalDateStr(new Date())) {
    return isExpiredFrequentTask(task, todayStr);
  }

  ensureRecurringTaskOccurrences(state = this.state) {
    return ensureRecurringTaskOccurrences(state);
  }

  getTaskSessionStats(taskOrId) {
    return computeTaskSessionStats(this.state, taskOrId, this._getSessionTaskIndex());
  }

  sanitizeState(state) {
    if (!state || typeof state !== 'object') return createInitialState();

    const defaults = createInitialState();
    const subjects = Array.isArray(state.subjects) ? state.subjects : defaults.subjects;
    let groups = Array.isArray(state.groups) && state.groups.length > 0 ? [...state.groups] : [...DEFAULT_GROUPS];

    state.deletedTaskIds = (state.deletedTaskIds && typeof state.deletedTaskIds === 'object') ? state.deletedTaskIds : {};
    state.deletedSessionIds = (state.deletedSessionIds && typeof state.deletedSessionIds === 'object') ? state.deletedSessionIds : {};
    state.deletedSubjectIds = (state.deletedSubjectIds && typeof state.deletedSubjectIds === 'object') ? state.deletedSubjectIds : {};
    state.deletedWeeklyEventIds = (state.deletedWeeklyEventIds && typeof state.deletedWeeklyEventIds === 'object') ? state.deletedWeeklyEventIds : {};
    state.deletedGroups = (state.deletedGroups && typeof state.deletedGroups === 'object') ? state.deletedGroups : {};

    if (!state.version || state.version < 11) {
      INITIAL_SUBJECTS.forEach((initSub) => {
        if (!subjects.some((s) => s.id === initSub.id || (s.name && s.name.toLowerCase() === initSub.name.toLowerCase()))) {
          subjects.push(structuredClone(initSub));
        }
      });
    }

    subjects.forEach((s) => {
      if ((s.id === 'sub-ihya' || (s.name && s.name.includes('İhya'))) && s.group === 'Seminars & Academies') {
        s.group = 'Kardeşlik ve İhya';
      }
      if (s.group && !groups.includes(s.group)) {
        groups.push(s.group);
      }
    });

    const weeklyEvents = Array.isArray(state.weeklyEvents) ? state.weeklyEvents : defaults.weeklyEvents;
    weeklyEvents.forEach((ev) => {
      if ((ev.id === 'wevent-ihya' || (ev.title && ev.title.includes('İhya'))) && ev.category === 'Seminars & Academies') {
        ev.category = 'Kardeşlik ve İhya';
      }
      if (!ev.recurrence) ev.recurrence = 'weekly';
      if (ev.category && !groups.includes(ev.category)) {
        groups.push(ev.category);
      }
    });

    const hasSeminarsSubject = subjects.some((s) => s.group === 'Seminars & Academies');
    const hasSeminarsEvent = weeklyEvents.some((ev) => ev.category === 'Seminars & Academies');
    if (!hasSeminarsSubject && !hasSeminarsEvent) {
      groups = groups.filter((g) => g !== 'Seminars & Academies');
    }

    const rawTasks = Array.isArray(state.tasks) ? state.tasks : [];

    LEGACY_SEED_TASK_IDS.forEach((id) => {
      if (!rawTasks.some((t) => t.id === id)) {
        state.deletedTaskIds[id] = state.deletedTaskIds[id] || '2026-11-12T00:00:00.000Z';
      }
    });

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

    const cleanSubjects = subjects.filter((s) => !state.deletedSubjectIds[s.id]);
    cleanSubjects.forEach((s) => {
      if (!s.updatedAt) s.updatedAt = new Date().toISOString();
      if (s.deletedAt === undefined) s.deletedAt = null;
    });

    const cleanWeeklyEvents = weeklyEvents.filter((e) => !state.deletedWeeklyEventIds[e.id]);
    cleanWeeklyEvents.forEach((e) => {
      if (!e.updatedAt) e.updatedAt = new Date().toISOString();
      if (e.deletedAt === undefined) e.deletedAt = null;
    });

    const cleanGroups = groups.filter((g) => !state.deletedGroups[g]);

    if (!state.settings) state.settings = defaults.settings;
    if (!state.settings.fontStyle) state.settings.fontStyle = 'sans';
    if (!state.settings.theme) state.settings.theme = 'slate';
    if (!state.settings.timerStyle || state.settings.timerStyle === 'chronometer') {
      state.settings.timerStyle = 'chronograph';
    }
    if (!state.settings.layoutFormat || !['auto', 'mobile', 'desktop'].includes(state.settings.layoutFormat)) {
      state.settings.layoutFormat = 'auto';
    }

    state.sync = state.sync ? { ...defaults.sync, ...state.sync } : defaults.sync;

    if (!state.activeTimer) {
      state.activeTimer = defaults.activeTimer;
    } else if (state.activeTimer.linkedTaskId) {
      const linked = tasks.find((t) => t.id === state.activeTimer.linkedTaskId);
      if (linked) {
        state.activeTimer.subject = linked.subject || '';
        state.activeTimer.topic = linked.title;
      }
    } else if (state.activeTimer.subject === LEGACY_DEFAULT_SUBJECT && !state.activeTimer.isRunning && !state.activeTimer.topic) {
      state.activeTimer.subject = '';
    }

    state.version = 12;
    state.subjects = cleanSubjects;
    state.groups = [...new Set(cleanGroups)];
    state.weeklyEvents = cleanWeeklyEvents;
    state.tasks = tasks;

    this.reconcileTasksAndSessions(state);
    this._invalidateCache();
    return state;
  }

  loadState() {
    try {
      const parsed = this.storage.readSync();
      if (!parsed) {
        return createInitialState();
      }
      const defaults = createInitialState();

      const candidate = {
        ...defaults,
        ...parsed,
        groups: parsed.groups && parsed.groups.length > 0 ? parsed.groups : [...DEFAULT_GROUPS],
        subjects: parsed.subjects && parsed.subjects.length > 0 ? parsed.subjects : defaults.subjects,
        weeklyEvents: parsed.weeklyEvents || defaults.weeklyEvents,
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        settings: { ...defaults.settings, ...(parsed.settings || {}) },
        activeTimer: { ...defaults.activeTimer, ...(parsed.activeTimer || {}) }
      };
      return this.sanitizeState(candidate);
    } catch (err) {
      console.warn('Failed to load workspace state, resetting to initial state', err);
      return createInitialState();
    }
  }

  async hydrateFromIndexedDB() {
    try {
      const idbState = await this.storage.hydrateFromIndexedDB();
      if (!idbState) return false;
      this.state = this.sanitizeState(idbState);
      this.saveState({ emitSyncEvent: false, notifyUI: true });
      return true;
    } catch (err) {
      console.warn('IndexedDB hydration error:', err);
      return false;
    }
  }

  saveState({ emitSyncEvent = true, notifyUI = true } = {}) {
    this._invalidateCache();
    try {
      if (emitSyncEvent && this.state && this.state.sync) {
        this.state.sync.hasChanges = true;
      }
      this.storage.write(this.state);
      if (emitSyncEvent && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
        window.dispatchEvent(new CustomEvent('chronostudy:state-changed', { detail: { timestamp: Date.now() } }));
      }
    } catch (err) {
      console.error('Failed to persist state:', err);
    }
    if (notifyUI) {
      this.notify();
    }
  }

  createSafetyBackup() {
    try {
      const payload = {
        backupAt: new Date().toISOString(),
        version: this.state.version,
        state: this.state
      };
      this.storage.saveBackup(payload);
    } catch (err) {
      console.warn('Safety backup snapshot failed:', err);
    }
  }

  restoreSafetyBackup() {
    try {
      const parsed = this.storage.readBackupSync();
      if (parsed && parsed.state) {
        this.state = this.sanitizeState(parsed.state);
        this.saveState();
        return { success: true, backupAt: parsed.backupAt };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
    return { success: false, error: 'No safety backup found' };
  }

  async restoreSafetyBackupAsync() {
    try {
      const parsed = await this.storage.readBackupAsync();
      if (parsed && parsed.state) {
        this.state = this.sanitizeState(parsed.state);
        this.saveState();
        return { success: true, backupAt: parsed.backupAt };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
    return { success: false, error: 'No safety backup found' };
  }

  getSyncPayload() {
    const { layoutFormat, volume, ambientSound, ...syncedSettings } = this.state.settings || {};
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
      settings: syncedSettings
    };
  }

  updateSyncSettings(partial, { emitSyncEvent = false, notifyUI = true } = {}) {
    if (!this.state.sync) this.state.sync = createInitialState().sync;
    this.state.sync = {
      ...this.state.sync,
      ...partial
    };
    this.saveState({ emitSyncEvent, notifyUI });
  }

  markRecordsSynced(syncTimestamp = new Date().toISOString()) {
    this.state.tasks.forEach((t) => { t.synced = true; });
    this.state.sessions.forEach((s) => { s.synced = true; });
    if (!this.state.sync) this.state.sync = createInitialState().sync;
    this.state.sync.hasChanges = false;
    this.state.sync.lastSyncedAt = syncTimestamp;
    this.state.sync.status = 'synced';
    this.state.sync.lastError = null;

    // Throttle tombstone compaction to at most once per 24 hours
    const lastCompactedMs = this.state.sync.lastCompactedAt ? new Date(this.state.sync.lastCompactedAt).getTime() : 0;
    const nowMs = Date.now();
    if (!lastCompactedMs || (nowMs - lastCompactedMs >= 86400000)) {
      compactTombstones(this.state, { maxAgeDays: 90, now: nowMs });
      this.state.sync.lastCompactedAt = syncTimestamp;
    }

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

  mergeRemoteState(remote) {
    if (!remote || typeof remote !== 'object') {
      return { success: false, error: 'Invalid remote sync payload' };
    }

    this.createSafetyBackup();
    const res = applyRemoteMerge(this.state, remote);
    if (!res.success) return res;

    const nowIso = new Date().toISOString();
    if (!this.state.sync) this.state.sync = createInitialState().sync;
    this.state.sync.lastSyncedAt = nowIso;
    this.state.sync.status = 'synced';
    this.state.sync.lastError = null;

    this.saveState({ emitSyncEvent: false, notifyUI: res.changesCount > 0 });
    return res;
  }

  compactTombstones(options = {}) {
    return compactTombstones(this.state, options);
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

  calculateNextRecurrenceDate(dueDate, recurrence, interval = 1) {
    return calculateNextRecurrenceDate(dueDate, recurrence, interval);
  }

  addTask({ title, subject = null, targetMinutes = null, dueDate = null, recurrence = 'none', recurrenceInterval = null, notes = '' }) {
    if (!title || !title.trim()) return null;

    const parsedMins = targetMinutes ? parseInt(targetMinutes, 10) : null;
    const isRecurring = recurrence && recurrence !== 'none';
    let cleanDueDate = dueDate && dueDate.trim() ? dueDate.trim() : null;

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

    const parentId = task.parentRecurringId || task.id;
    const normTitle = (task.title || '').trim().toLowerCase();
    const exactInstance = this.state.tasks.find(
      (t) => t.dueDate === dateStr &&
        t.recurrence === rec &&
        (t.id === taskId || t.parentRecurringId === parentId || t.id === parentId || (t.title || '').trim().toLowerCase() === normTitle)
    );
    if (exactInstance) {
      this.toggleTask(exactInstance.id);
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
      task.uncheckedAt = nowIso;
      const sKey = `${(task.title || '').trim().toLowerCase()}|${rec}|${task.subject || ''}`;
      this.state.tasks.forEach((sib) => {
        if (sib.recurrence === rec && `${(sib.title || '').trim().toLowerCase()}|${sib.recurrence}|${sib.subject || ''}` === sKey) {
          if (sib.completedDates) delete sib.completedDates[dateStr];
        }
      });
      if (task.completed) {
        task.completed = false;
        task.completedAt = null;
      }
    } else {
      task.completedDates[dateStr] = nowIso;
      task.uncheckedAt = null;
      if (task.dueDate === dateStr || (!task.dueDate && dateStr === todayStr)) {
        const nextDate = this.calculateNextRecurrenceDate(dateStr, rec, task.recurrenceInterval);
        if (nextDate) {
          task.dueDate = nextDate;
        }
      }
    }

    task.autoGenerated = false;
    task.updatedAt = nowIso;
    task.synced = false;
    this.saveState();
  }

  toggleTask(taskId) {
    const task = this.state.tasks.find((t) => t.id === taskId);
    if (!task) return;

    const wasCompleted = task.completed;
    task.completed = !wasCompleted;
    const nowIso = new Date().toISOString();
    const prevCompletedAt = task.completedAt;
    task.completedAt = task.completed ? nowIso : null;
    task.uncheckedAt = task.completed ? null : nowIso;
    task.autoGenerated = false;
    task.updatedAt = nowIso;
    task.synced = false;

    const isRec = Boolean(task.recurrence && task.recurrence !== 'none');
    const parentId = task.parentRecurringId || task.id;
    const normTitle = (task.title || '').trim().toLowerCase();
    const isSameSeries = (t) => t.recurrence === task.recurrence &&
      (t.parentRecurringId === parentId || t.id === parentId ||
        ((t.title || '').trim().toLowerCase() === normTitle && (t.subject || '') === (task.subject || '')));

    if (isRec) {
      if (!task.completedDates || typeof task.completedDates !== 'object') {
        task.completedDates = {};
      }
      const affectedDates = new Set();
      if (task.dueDate) affectedDates.add(task.dueDate);
      if (!task.completed && wasCompleted && prevCompletedAt) {
        affectedDates.add(toLocalDateStr(prevCompletedAt));
      }

      if (task.completed) {
        affectedDates.forEach((dStr) => {
          task.completedDates[dStr] = nowIso;
        });
        this.state.tasks.forEach((sib) => {
          if (isSameSeries(sib)) {
            if (!sib.completedDates || typeof sib.completedDates !== 'object') sib.completedDates = {};
            affectedDates.forEach((dStr) => {
              sib.completedDates[dStr] = nowIso;
            });
          }
        });
      } else {
        affectedDates.forEach((dStr) => {
          delete task.completedDates[dStr];
        });
        this.state.tasks.forEach((sib) => {
          if (isSameSeries(sib) && sib.completedDates) {
            affectedDates.forEach((dStr) => delete sib.completedDates[dStr]);
          }
        });
      }
    }

    if (task.completed && isRec) {
      let nextDate = this.calculateNextRecurrenceDate(task.dueDate, task.recurrence, task.recurrenceInterval);
      const todayStr = toLocalDateStr(new Date());

      const hasDateCompletedInSeries = (dStr) => Boolean(
        task.completedDates[dStr] ||
        this.state.tasks.some((t) => isSameSeries(t) && ((t.completedDates && t.completedDates[dStr]) || (t.completed && t.dueDate === dStr)))
      );

      let hop = 0;
      while (nextDate && nextDate < todayStr && hasDateCompletedInSeries(nextDate) && hop < 14) {
        hop++;
        const stepped = this.calculateNextRecurrenceDate(nextDate, task.recurrence, task.recurrenceInterval);
        if (!stepped || stepped <= nextDate) break;
        nextDate = stepped;
      }

      const alreadyExists = this.state.tasks.some((t) => isSameSeries(t) && t.dueDate === nextDate);
      const nextAlreadyCompleted = nextDate && hasDateCompletedInSeries(nextDate);

      if (!alreadyExists && !nextAlreadyCompleted && nextDate) {
        const nextNowIso = new Date().toISOString();
        this.state.tasks.unshift({
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
          completedDates: { ...(task.completedDates || {}) },
          createdAt: nextNowIso,
          updatedAt: nextNowIso,
          deletedAt: null,
          synced: false,
          completedAt: null,
          timeSpentSec: 0
        });
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
            updatedAt: now.toISOString(),
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
    this.state.deletedTaskIds[taskId] = new Date().toISOString();
    this.state.tasks = this.state.tasks.filter((t) => t.id !== taskId);
    if (this.state.activeTimer.linkedTaskId === taskId) {
      this.state.activeTimer.linkedTaskId = null;
    }
    this.saveState();
  }

  addTimeSpentToTask(taskId, durationSec, { save = true } = {}) {
    const task = this.state.tasks.find((t) => t.id === taskId);
    if (task) {
      task.timeSpentSec = (task.timeSpentSec || 0) + durationSec;
      task.updatedAt = new Date().toISOString();
      task.synced = false;
      if (save) {
        this.saveState();
      }
    }
  }

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
        : ((subject && subject.trim() && subject.trim() !== LEGACY_DEFAULT_SUBJECT && subject.trim().toLowerCase() !== 'none') ? subject.trim() : 'General');
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
    for (let i = segments.length - 1; i >= 0; i--) {
      this.state.sessions.unshift(segments[i]);
    }

    if (resolvedTaskId) {
      this.addTimeSpentToTask(resolvedTaskId, newSession.durationSec, { save: false });
    }

    this.saveState();
    return segments[0];
  }

  deleteSession(sessionId) {
    if (!this.state.deletedSessionIds) this.state.deletedSessionIds = {};
    const target = this.state.sessions.find((s) => s.id === sessionId);
    const affectedTaskId = target ? target.taskId : null;
    this.state.deletedSessionIds[sessionId] = new Date().toISOString();
    this.state.sessions = this.state.sessions.filter((s) => s.id !== sessionId);
    if (affectedTaskId) {
      const task = this.state.tasks.find((t) => t.id === affectedTaskId);
      if (task) {
        task.timeSpentSec = this.state.sessions
          .filter((s) => s.taskId === affectedTaskId)
          .reduce((acc, s) => acc + (s.durationSec || 0), 0);
        task.updatedAt = new Date().toISOString();
        task.synced = false;
      }
    }
    this.saveState();
  }

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

    const nowIso = new Date().toISOString();
    const newSub = {
      id: 'sub-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      code: code ? code.trim().toUpperCase() : trimmed.slice(0, 7).toUpperCase(),
      name: trimmed,
      group: group ? group.trim() : 'İTÜ Courses (Fall 2026)',
      color: color || '#e06d43',
      targetWeeklyHours: targetWeeklyHours ? parseInt(targetWeeklyHours, 10) : null,
      folderPath: folderPath ? folderPath.trim() : '',
      schedule: [],
      updatedAt: nowIso,
      deletedAt: null
    };
    this.state.subjects.push(newSub);

    if (newSub.group && !this.state.groups.includes(newSub.group)) {
      this.state.groups.push(newSub.group);
    }

    this.saveState();
    return newSub;
  }

  updateSubject(subjectId, { name, color, code, targetWeeklyHours, group, folderPath }) {
    const sub = this.state.subjects.find((s) => s.id === subjectId);
    if (!sub) return;

    const nowIso = new Date().toISOString();
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
    sub.updatedAt = nowIso;

    if (oldName !== sub.name) {
      this.state.tasks.forEach((t) => {
        if (t.subject === oldName) {
          t.subject = sub.name;
          t.updatedAt = nowIso;
          t.synced = false;
        }
      });
      this.state.sessions.forEach((s) => {
        if (s.subject === oldName) {
          s.subject = sub.name;
          s.updatedAt = nowIso;
          s.synced = false;
        }
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

    const index = this.state.groups.indexOf(oldName);
    if (index !== -1) {
      this.state.groups[index] = trimmedNew;
    } else {
      this.state.groups.push(trimmedNew);
    }
    this.state.groups = [...new Set(this.state.groups)];

    const nowIso = new Date().toISOString();
    this.state.subjects.forEach((s) => {
      if (s.group === oldName) {
        s.group = trimmedNew;
        s.updatedAt = nowIso;
      }
    });

    if (Array.isArray(this.state.weeklyEvents)) {
      this.state.weeklyEvents.forEach((we) => {
        if (we.category === oldName) {
          we.category = trimmedNew;
          we.updatedAt = nowIso;
        }
      });
    }

    this.saveState();
    return true;
  }

  deleteCategory(groupName, fallbackGroup = 'İTÜ Courses (Fall 2026)') {
    if (!groupName) return false;
    if (!this.state.deletedGroups) this.state.deletedGroups = {};
    const nowIso = new Date().toISOString();
    this.state.deletedGroups[groupName] = nowIso;
    this.state.groups = this.state.groups.filter((g) => g !== groupName);
    if (this.state.groups.length === 0) {
      this.state.groups = [fallbackGroup];
    }
    const target = this.state.groups[0];

    this.state.subjects.forEach((s) => {
      if (s.group === groupName) {
        s.group = target;
        s.updatedAt = nowIso;
      }
    });

    if (Array.isArray(this.state.weeklyEvents)) {
      this.state.weeklyEvents.forEach((we) => {
        if (we.category === groupName) {
          we.category = target;
          we.updatedAt = nowIso;
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
    return computeSubjectStats(this.state, subjectName);
  }

  addWeeklyEvent({ title, day, start, end, category = 'General', color = '#059669', recurrence = 'weekly', notes = '', anchorDate = null }) {
    if (!title || !title.trim()) return null;
    const now = new Date();
    const nowIso = now.toISOString();
    const newEvent = {
      id: 'wevent-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      title: title.trim(),
      day: parseInt(day, 10) || 1,
      start: start || '19:00',
      end: end || '21:00',
      category: category || 'General',
      color: color || '#059669',
      recurrence: recurrence || 'weekly',
      anchorDate: anchorDate || toLocalDateStr(now),
      notes: notes ? notes.trim() : '',
      createdAt: nowIso,
      updatedAt: nowIso,
      deletedAt: null
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
    if (!ev.anchorDate) ev.anchorDate = toLocalDateStr(ev.createdAt || new Date());
    ev.updatedAt = new Date().toISOString();
    this.saveState();
    return ev;
  }

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
    sub.updatedAt = new Date().toISOString();
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
    sub.updatedAt = new Date().toISOString();
    this.saveState();
    return true;
  }

  deleteLectureSlot(subjectId, slotIndex) {
    const sub = this.state.subjects.find((s) => s.id === subjectId);
    if (!sub || !Array.isArray(sub.schedule)) return false;
    sub.schedule.splice(slotIndex, 1);
    sub.updatedAt = new Date().toISOString();
    this.saveState();
    return true;
  }

  updateActiveTimer(partial, { forceSave = false } = {}) {
    this.state.activeTimer = {
      ...this.state.activeTimer,
      ...partial
    };
    const now = Date.now();
    if (forceSave || !this._lastTimerDiskSave || now - this._lastTimerDiskSave >= 5000) {
      this._lastTimerDiskSave = now;
      this.saveState({ emitSyncEvent: false, notifyUI: false });
    }
  }

  updateSettings(partial) {
    this.state.settings = {
      ...this.state.settings,
      ...partial,
      updatedAt: new Date().toISOString()
    };
    this.saveState();
  }

  ensureDailyRollover() {
    const todayStr = toLocalDateStr(new Date());
    if (this._lastRolloverCheckDate !== todayStr) {
      this._lastRolloverCheckDate = todayStr;
      if (this.ensureRecurringTaskOccurrences(this.state)) {
        this.saveState();
        return true;
      }
    }
    return false;
  }

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

  doesTaskOccurOnDate(task, targetDateStr) {
    return doesTaskOccurOnDate(task, targetDateStr);
  }

  getAnalyticsData(options = {}) {
    return computeAnalyticsData(this.state, options);
  }

  generateICS() {
    return buildICS(this.state);
  }

  exportJSON() {
    return serializeStateJSON(this.state);
  }

  exportCSV() {
    return serializeSessionsCSV(this.state);
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

      this.createSafetyBackup();
      const defaults = createInitialState();

      const candidate = {
        ...defaults,
        groups: Array.isArray(data.groups) ? data.groups : this.state.groups,
        subjects: Array.isArray(data.subjects) ? data.subjects : this.state.subjects,
        weeklyEvents: Array.isArray(data.weeklyEvents) ? data.weeklyEvents : this.state.weeklyEvents,
        tasks: Array.isArray(data.tasks) ? data.tasks : this.state.tasks,
        sessions: Array.isArray(data.sessions) ? data.sessions : this.state.sessions,
        deletedTaskIds: data.deletedTaskIds && typeof data.deletedTaskIds === 'object' ? data.deletedTaskIds : {},
        deletedSessionIds: data.deletedSessionIds && typeof data.deletedSessionIds === 'object' ? data.deletedSessionIds : {},
        deletedSubjectIds: data.deletedSubjectIds && typeof data.deletedSubjectIds === 'object' ? data.deletedSubjectIds : {},
        deletedWeeklyEventIds: data.deletedWeeklyEventIds && typeof data.deletedWeeklyEventIds === 'object' ? data.deletedWeeklyEventIds : {},
        deletedGroups: data.deletedGroups && typeof data.deletedGroups === 'object' ? data.deletedGroups : {},
        settings: data.settings ? { ...this.state.settings, ...data.settings } : this.state.settings,
        sync: this.state.sync,
        activeTimer: data.activeTimer ? { ...defaults.activeTimer, ...data.activeTimer } : this.state.activeTimer
      };

      this.state = this.sanitizeState(candidate);
      this.saveState();
      return { success: true, count: this.state.sessions.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

export const store = new Store();
export default store;
