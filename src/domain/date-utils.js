// src/domain/date-utils.js — Local date/time & week boundary helpers

export function toLocalDateStr(d = new Date()) {
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.trim())) {
    return d.trim();
  }
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) {
    return '';
  }
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isMidnightTimestamp(isoOrDate) {
  if (!isoOrDate) return false;
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return false;
  const hr = d.getHours();
  return hr >= 0 && hr < 5;
}

export function getSessionDateStr(s) {
  if (!s) return toLocalDateStr(new Date());
  return toLocalDateStr(s.startTime || s.endTime || s.createdAt || new Date());
}

export function formatRelativeDueDate(dueDateStr, todayStr = toLocalDateStr(new Date()), { includePrefix = true } = {}) {
  if (!dueDateStr) return '';
  const dueDate = new Date(`${dueDateStr}T12:00:00`);
  const todayDate = new Date(`${todayStr}T12:00:00`);
  if (Number.isNaN(dueDate.getTime()) || Number.isNaN(todayDate.getTime())) {
    return includePrefix ? `Due: ${dueDateStr}` : dueDateStr;
  }
  const diffDays = Math.round((dueDate.getTime() - todayDate.getTime()) / 86400000);
  let label;
  if (diffDays === 0) label = 'Today';
  else if (diffDays === -1) label = 'Yesterday';
  else if (diffDays === 1) label = 'Tomorrow';
  else if (diffDays < -1) label = `${Math.abs(diffDays)} days ago (${dueDateStr})`;
  else label = dueDateStr;

  return includePrefix ? `Due: ${label}` : (diffDays < -1 ? `${Math.abs(diffDays)}d ago` : label);
}

export function getMondayOfDate(dateObj, { atNoon = false } = {}) {
  const d = new Date(dateObj);
  const day = d.getDay();
  const distToMon = (day + 6) % 7;
  d.setDate(d.getDate() - distToMon);
  if (atNoon) {
    d.setHours(12, 0, 0, 0);
  } else {
    d.setHours(0, 0, 0, 0);
  }
  return d;
}

export function formatDurationHM(sec) {
  const totalMins = Math.round((sec || 0) / 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
