// @ts-check
// src/domain/reconcile.js — Midnight session splitting & cross-entity reconciliation
import { toLocalDateStr } from './date-utils.js';
import { LEGACY_DEFAULT_SUBJECT } from './presets.js';
import { ensureRecurringTaskOccurrences } from './recurrence.js';

export function splitSessionAcrossMidnights(sessionObj) {
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

export function reconcileTasksAndSessions(state) {
  if (!state) return false;
  let changed = false;
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
      const beforeLen = s.schedule.length;
      s.schedule = s.schedule.filter((slot) => {
        const key = `${slot.day}-${slot.start}-${slot.end}`;
        if (seenSlots.has(key)) return false;
        seenSlots.add(key);
        return true;
      });
      if (s.schedule.length !== beforeLen) changed = true;
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
        changed = true;
        return;
      }
      seenEvents.add(key);
      dedupedEvents.push(ev);
    });
    state.weeklyEvents = dedupedEvents;
  }

  // 3. Reconcile recurring task completion state across series & deduplicate same-date recurring tasks
  const nowIso = new Date().toISOString();
  const todayStr = toLocalDateStr(new Date());
  const getSeriesKey = (t) => `${(t.title || '').trim().toLowerCase()}|${t.recurrence}|${t.subject || ''}`;

  const recurringGroups = new Map();
  tasks.forEach((t) => {
    if (t.recurrence && t.recurrence !== 'none') {
      if (!t.completed && !t.dueDate) {
        t.dueDate = toLocalDateStr(t.createdAt || new Date());
      }
      const sk = getSeriesKey(t);
      if (!recurringGroups.has(sk)) recurringGroups.set(sk, []);
      recurringGroups.get(sk).push(t);
    }
  });

  recurringGroups.forEach((seriesTasks) => {
    const seriesUncheckedDates = new Map(); // dateStr -> ms
    seriesTasks.forEach((t) => {
      if (!t.completed && t.dueDate && t.uncheckedAt) {
        const unchkMs = new Date(t.uncheckedAt).getTime();
        if (!Number.isNaN(unchkMs)) {
          seriesUncheckedDates.set(t.dueDate, Math.max(seriesUncheckedDates.get(t.dueDate) || 0, unchkMs));
        }
      }
    });

    const seriesCompletedDates = new Map(); // dateStr -> completedAtIso
    const recordCompletedDate = (dStr, ts) => {
      if (!dStr) return;
      const doneIso = ts || nowIso;
      const doneMs = new Date(doneIso).getTime();
      const unchkMs = seriesUncheckedDates.get(dStr) || 0;
      if (unchkMs > doneMs) return;
      const prevIso = seriesCompletedDates.get(dStr);
      if (!prevIso || doneMs > new Date(prevIso).getTime()) {
        seriesCompletedDates.set(dStr, doneIso);
      }
    };

    seriesTasks.forEach((t) => {
      if (t.completed && t.dueDate) {
        recordCompletedDate(t.dueDate, t.completedAt || t.updatedAt);
      }
      if (t.completed && t.completedAt) {
        const compDateStr = toLocalDateStr(t.completedAt);
        if (compDateStr <= todayStr && (!t.dueDate || t.dueDate <= compDateStr)) {
          recordCompletedDate(compDateStr, t.completedAt);
        }
      }
      if (t.completedDates && typeof t.completedDates === 'object') {
        Object.entries(t.completedDates).forEach(([dStr, ts]) => {
          if (ts) recordCompletedDate(dStr, ts);
        });
      }
    });

    seriesTasks.forEach((t) => {
      if (!t.completedDates || typeof t.completedDates !== 'object') {
        t.completedDates = {};
      }
      seriesCompletedDates.forEach((ts, dStr) => {
        t.completedDates[dStr] = ts;
      });
      seriesUncheckedDates.forEach((unchkMs, dStr) => {
        const existingTs = t.completedDates[dStr];
        if (existingTs && unchkMs > new Date(existingTs).getTime()) {
          delete t.completedDates[dStr];
        }
      });

      if (!t.completed && t.dueDate && seriesCompletedDates.has(t.dueDate)) {
        const doneTs = seriesCompletedDates.get(t.dueDate);
        const doneMs = new Date(doneTs).getTime();
        const tUnchkMs = t.uncheckedAt ? new Date(t.uncheckedAt).getTime() : 0;
        if (t.autoGenerated || doneMs >= tUnchkMs) {
          t.completed = true;
          t.completedAt = doneTs;
          t.autoGenerated = false;
          changed = true;
        }
      }
    });
  });

  // Deduplicate recurring tasks sharing series + dueDate
  const seenRecurringMap = new Map();
  const dedupedTasks = [];
  tasks.forEach((t) => {
    if (t.recurrence && t.recurrence !== 'none') {
      const recKey = `${getSeriesKey(t)}|${t.dueDate || ''}`;
      const existing = seenRecurringMap.get(recKey);
      if (existing) {
        changed = true;
        const scoreTask = (x) => (x.completed ? 1000 : 0) + (!x.autoGenerated ? 100 : 0) + ((x.timeSpentSec || 0) > 0 ? 10 : 0);
        if (scoreTask(t) > scoreTask(existing) || (scoreTask(t) === scoreTask(existing) && new Date(t.updatedAt || 0) > new Date(existing.updatedAt || 0))) {
          const idx = dedupedTasks.indexOf(existing);
          if (idx !== -1) dedupedTasks.splice(idx, 1);
          if (existing.id) state.deletedTaskIds[existing.id] = state.deletedTaskIds[existing.id] || nowIso;
          seenRecurringMap.set(recKey, t);
          dedupedTasks.push(t);
        } else {
          if (t.id) state.deletedTaskIds[t.id] = state.deletedTaskIds[t.id] || nowIso;
        }
        return;
      }
      seenRecurringMap.set(recKey, t);
    }
    dedupedTasks.push(t);
  });
  if (dedupedTasks.length !== tasks.length) changed = true;
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
      const parts = splitSessionAcrossMidnights(s);
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
          changed = true;
        }
      }
    }
    if (matchedTask) {
      const expectedSubject = (matchedTask.subject && matchedTask.subject.trim()) ? matchedTask.subject.trim() : 'General';
      if (s.subject !== expectedSubject) {
        s.subject = expectedSubject;
        s.synced = false;
        changed = true;
      }
    }
  });

  // Fix legacy split-subject topics where default subject leaked alongside General on unrelated tasks
  const sessionsByTopic = new Map();
  expandedSessions.forEach((s) => {
    const normTopic = (s.topic || '').trim().toLowerCase();
    if (!normTopic) return;
    if (!sessionsByTopic.has(normTopic)) sessionsByTopic.set(normTopic, []);
    sessionsByTopic.get(normTopic).push(s);
  });

  sessionsByTopic.forEach((groupSessions, normTopic) => {
    const hasLegacyDefault = groupSessions.some((s) => s.subject === LEGACY_DEFAULT_SUBJECT);
    const nonLegacy = groupSessions.find((s) => s.subject && s.subject !== LEGACY_DEFAULT_SUBJECT);
    const task = taskByNormTitle.get(normTopic);
    if (hasLegacyDefault && (nonLegacy || (task && !task.subject))) {
      const targetSubj = task
        ? ((task.subject && task.subject.trim()) ? task.subject.trim() : 'General')
        : nonLegacy.subject;
      if (!task || task.subject !== LEGACY_DEFAULT_SUBJECT) {
        groupSessions.forEach((s) => {
          if (s.subject === LEGACY_DEFAULT_SUBJECT) {
            s.subject = targetSubj;
            if (task && !s.taskId) s.taskId = task.id;
            s.synced = false;
            changed = true;
          }
        });
      }
    }
  });

  state.sessions = expandedSessions;
  if (expandedSessions.length !== rawSessions.length) changed = true;
  if (ensureRecurringTaskOccurrences(state)) changed = true;
  return changed;
}
