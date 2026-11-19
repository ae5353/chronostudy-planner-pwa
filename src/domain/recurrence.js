// @ts-check
// src/domain/recurrence.js — Recurring task & event cadence calculations and rollover occurrence synthesis
import { toLocalDateStr, getMondayOfDate } from './date-utils.js';

export function getRecurrenceLabel(recurrence, interval = 1) {
  if (!recurrence || recurrence === 'none') return '';
  switch (recurrence) {
    case 'daily':
      return interval && interval > 1 ? `Every ${interval} days` : 'Daily';
    case 'weekdays':
      return 'Weekdays (Mon-Fri)';
    case 'weekly':
      return interval && interval > 1 ? `Every ${interval} wks` : 'Weekly';
    case 'biweekly':
      return 'Bi-weekly';
    case 'triweekly':
      return 'Tri-weekly';
    case 'monthly':
      return interval && interval > 1 ? `Every ${interval} mos` : 'Monthly';
    case 'custom_days':
      return `Every ${interval || 1} days`;
    case 'custom_weeks':
      return `Every ${interval || 1} wks`;
    default:
      return recurrence;
  }
}

export function calculateNextRecurrenceDate(dueDate, recurrence, intervalOrOpts = 1) {
  let base;
  if (dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    const [y, m, d] = dueDate.split('-').map(Number);
    base = new Date(y, m - 1, d, 12, 0, 0); // Noon prevents any daylight saving or timezone shifts
  } else {
    base = new Date();
    base.setHours(12, 0, 0, 0);
  }

  const next = new Date(base);
  const rawInterval = (intervalOrOpts && typeof intervalOrOpts === 'object')
    ? intervalOrOpts.recurrenceInterval || intervalOrOpts.interval || 1
    : intervalOrOpts;
  const step = parseInt(rawInterval, 10) || 1;

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
    case 'monthly': {
      const origDay = base.getDate();
      next.setDate(1);
      next.setMonth(next.getMonth() + step);
      const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(origDay, maxDay));
      break;
    }
    case 'custom':
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

export function isFrequentRecurringTask(task) {
  if (!task || !task.recurrence || task.recurrence === 'none') return false;
  if (task.recurrence === 'daily' || task.recurrence === 'weekdays') return true;
  if (task.recurrence === 'custom_days') {
    const interval = Math.max(1, parseInt(task.recurrenceInterval || 1, 10) || 1);
    return interval < 7;
  }
  return false;
}

export function isExpiredFrequentTask(task, todayStr = toLocalDateStr(new Date())) {
  if (!task || task.completed || !isFrequentRecurringTask(task)) return false;
  if (!task.dueDate) return false;
  const d = new Date(`${todayStr}T12:00:00`);
  d.setDate(d.getDate() - 1);
  const yesterdayStr = toLocalDateStr(d);
  return task.dueDate < yesterdayStr;
}

export function doesTaskOccurOnDate(task, targetDateStr) {
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
    case 'triweekly':
      return diffDays % 21 === 0;
    case 'monthly': {
      const monthsDiff = (targetDate.getFullYear() - anchorDate.getFullYear()) * 12 +
        (targetDate.getMonth() - anchorDate.getMonth());
      if (monthsDiff < 0 || monthsDiff % interval !== 0) return false;
      const maxDay = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
      return targetDate.getDate() === Math.min(anchorDate.getDate(), maxDay);
    }
    case 'custom':
    case 'custom_days':
      return diffDays % interval === 0;
    case 'custom_weeks':
      return diffDays % (7 * interval) === 0;
    default:
      return task.dueDate === targetDateStr;
  }
}

export function doesWeeklyEventOccurOnDate(ev, dayOfWeek, dateStr = null) {
  if (!ev) return false;
  const rec = ev.recurrence || 'weekly';
  if (rec === 'daily') return true;
  if (rec === 'weekdays') return dayOfWeek >= 1 && dayOfWeek <= 5;
  if (!['weekly', 'biweekly', 'triweekly', 'monthly'].includes(rec) || ev.day !== dayOfWeek) {
    return false;
  }

  const targetDateObj = (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr))
    ? new Date(`${dateStr}T12:00:00`)
    : null;
  if (!targetDateObj || Number.isNaN(targetDateObj.getTime()) || rec === 'weekly') {
    return true;
  }

  const anchorStr = ev.anchorDate || (ev.createdAt ? toLocalDateStr(ev.createdAt) : null);
  if (!anchorStr || !/^\d{4}-\d{2}-\d{2}$/.test(anchorStr)) {
    return true;
  }

  const anchorDateObj = new Date(`${anchorStr}T12:00:00`);
  if (Number.isNaN(anchorDateObj.getTime())) {
    return true;
  }

  const targetMon = getMondayOfDate(targetDateObj, { atNoon: true });
  const anchorMon = getMondayOfDate(anchorDateObj, { atNoon: true });
  const weekDiff = Math.round((targetMon.getTime() - anchorMon.getTime()) / (7 * 86400000));

  if (rec === 'biweekly') {
    return weekDiff >= 0 && weekDiff % 2 === 0;
  }
  if (rec === 'triweekly') {
    return weekDiff >= 0 && weekDiff % 3 === 0;
  }
  if (rec === 'monthly') {
    const anchorOcc = new Date(anchorMon);
    anchorOcc.setDate(anchorMon.getDate() + (ev.day - 1));
    const anchorNth = Math.ceil(anchorOcc.getDate() / 7);
    const targetNth = Math.ceil(targetDateObj.getDate() / 7);
    return weekDiff >= 0 && targetNth === anchorNth;
  }
  return true;
}

export function ensureRecurringTaskOccurrences(state) {
  if (!state || !Array.isArray(state.tasks)) return false;
  const now = new Date();
  const todayStr = toLocalDateStr(now);
  const yestDate = new Date(now);
  yestDate.setDate(yestDate.getDate() - 1);
  const yesterdayStr = toLocalDateStr(yestDate);
  const minBackfill = new Date(now);
  minBackfill.setDate(minBackfill.getDate() - 7);
  const minBackfillStr = toLocalDateStr(minBackfill);

  const recurringTasks = state.tasks.filter((t) => t.recurrence && t.recurrence !== 'none');
  if (recurringTasks.length === 0) return false;

  const seriesMap = new Map();
  recurringTasks.forEach((t) => {
    const seriesKey = `${(t.title || '').trim().toLowerCase()}|${t.recurrence}|${t.subject || ''}`;
    if (!seriesMap.has(seriesKey)) seriesMap.set(seriesKey, []);
    seriesMap.get(seriesKey).push(t);
  });

  let addedAny = false;
  const nowIso = now.toISOString();

  seriesMap.forEach((seriesTasks) => {
    seriesTasks.forEach((t) => {
      if (!t.completed && t.dueDate && t.dueDate < todayStr && t.completedDates && t.completedDates[t.dueDate]) {
        t.completed = true;
        t.completedAt = t.completedDates[t.dueDate];
        t.updatedAt = nowIso;
        t.synced = false;
        addedAny = true;
      }
    });

    const existingDates = new Set(seriesTasks.map((t) => t.dueDate).filter(Boolean));
    seriesTasks.forEach((t) => {
      if (t.completed && t.completedAt) {
        existingDates.add(toLocalDateStr(t.completedAt));
      }
      if (t.completedDates && typeof t.completedDates === 'object') {
        Object.keys(t.completedDates).forEach((d) => existingDates.add(d));
      }
    });
    const hasCurrentOrFuture = seriesTasks.some((t) => !t.dueDate || t.dueDate >= todayStr);
    if (hasCurrentOrFuture) return;

    const sorted = [...seriesTasks].sort((a, b) => (b.dueDate || '').localeCompare(a.dueDate || ''));
    const template = sorted[0];
    if (!template || !template.dueDate) return;

    const rootParentId = template.parentRecurringId || template.id;
    const seriesMinBackfillStr = isFrequentRecurringTask(template) ? yesterdayStr : minBackfillStr;
    let cursorDate = template.dueDate;
    let safety = 0;

    while (cursorDate < todayStr && safety < 366) {
      safety++;
      const nextDate = calculateNextRecurrenceDate(cursorDate, template.recurrence, template.recurrenceInterval);
      if (!nextDate || nextDate <= cursorDate) break;
      cursorDate = nextDate;

      if (cursorDate > todayStr) break;
      if (cursorDate >= seriesMinBackfillStr && !existingDates.has(cursorDate)) {
        const occId = `task-occ-${rootParentId}-${cursorDate}`;
        if (!(state.deletedTaskIds && state.deletedTaskIds[occId])) {
          const doneTs = template.completedDates && template.completedDates[cursorDate] ? template.completedDates[cursorDate] : null;
          const occTimestamp = `${cursorDate}T00:00:00.000Z`;
          state.tasks.unshift({
            id: occId,
            title: template.title,
            subject: template.subject,
            targetMinutes: template.targetMinutes || null,
            dueDate: cursorDate,
            recurrence: template.recurrence,
            recurrenceInterval: template.recurrenceInterval || null,
            parentRecurringId: rootParentId,
            notes: template.notes || '',
            completed: Boolean(doneTs),
            completedDates: {},
            autoGenerated: true,
            createdAt: occTimestamp,
            updatedAt: occTimestamp,
            deletedAt: null,
            synced: false,
            completedAt: doneTs,
            timeSpentSec: 0
          });
          existingDates.add(cursorDate);
          addedAny = true;
        }
      }
    }
  });

  return addedAny;
}
