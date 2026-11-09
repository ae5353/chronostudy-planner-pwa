// To-do logic: quick-add parsing, recurrence, filters, smart lists. DOM-free.
import { isoFromMs, shiftISO, newId, sumMinutes } from './log.js';

const DOW = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const PRIORITY_LABELS = { 0: 'None', 1: 'Low', 2: 'Medium', 3: 'High' };

function todayISO() {
  return isoFromMs(Date.now());
}
function dowIndex(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return (new Date(y, m - 1, d, 12).getDay() + 6) % 7; // Mon=0
}

/** Next date strictly after `from` that falls on weekday `idx` (Mon=0). */
export function nextWeekday(from, idx) {
  let n = ((idx - dowIndex(from) + 7) % 7) || 7;
  return shiftISO(from, n);
}

function matchTrack(query, tracks = []) {
  const q = query.toLowerCase();
  return (
    tracks.find((t) => (t.code || '').toLowerCase() === q) ||
    tracks.find((t) => t.name.toLowerCase().replace(/\s+/g, '-') === q) ||
    tracks.find((t) => t.name.toLowerCase().replace(/\s+/g, '').startsWith(q.replace(/-/g, ''))) ||
    null
  );
}

/**
 * Quick-add syntax (tokens may appear anywhere):
 *   #track   +project   &tag   p1|p2|p3 or !high|!med|!low   @today|@tomorrow|@+3d|@mon|@2026-01-31
 *   ~30m / ~2p (estimate)   every day|weekday|week|month|mon[,wed]   (recurrence)
 */
export function parseQuickAdd(raw, tracks = [], today = todayISO()) {
  let text = ` ${String(raw || '').trim()} `;
  const take = (re) => {
    const m = text.match(re);
    if (m) text = text.replace(m[0], ' ');
    return m;
  };
  const out = {
    title: '',
    trackId: null,
    project: null,
    tags: [],
    priority: 0,
    dueDate: null,
    recurrence: null,
    estimateMinutes: null
  };

  // recurrence
  let m = take(/\s(?:every|each)\s+(day|weekday|weekdays|week|month|(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*)(?:\s*,\s*(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*)*)(?=\s)/i);
  if (m) {
    const w = m[1].toLowerCase();
    if (w === 'day') out.recurrence = { freq: 'daily' };
    else if (w.startsWith('weekday')) out.recurrence = { freq: 'weekdays' };
    else if (w === 'week') out.recurrence = { freq: 'weekly' };
    else if (w === 'month') out.recurrence = { freq: 'monthly' };
    else {
      const days = [...new Set(w.split(/\s*,\s*/).map((x) => DOW.indexOf(x.slice(0, 3))).filter((i) => i >= 0))].sort();
      out.recurrence = { freq: 'weekly', days };
    }
  } else if ((m = take(/\s(daily|weekly|monthly)(?=\s)/i))) {
    out.recurrence = { freq: m[1].toLowerCase() };
  }

  if ((m = take(/\s@(today|tomorrow|\+\d+d|\d{4}-\d{2}-\d{2}|mon|tue|wed|thu|fri|sat|sun)(?=\s)/i))) {
    const t = m[1].toLowerCase();
    if (t === 'today') out.dueDate = today;
    else if (t === 'tomorrow') out.dueDate = shiftISO(today, 1);
    else if (t.startsWith('+')) out.dueDate = shiftISO(today, parseInt(t.slice(1), 10));
    else if (DOW.includes(t)) out.dueDate = nextWeekday(today, DOW.indexOf(t));
    else out.dueDate = t;
  }

  if ((m = take(/\s(?:p([1-3])|!(high|med|medium|low))(?=\s)/i))) {
    if (m[1]) out.priority = 4 - Number(m[1]);
    else out.priority = { high: 3, med: 2, medium: 2, low: 1 }[m[2].toLowerCase()];
  }

  if ((m = take(/\s~(\d+)\s*(m|min|h|p)?(?=\s)/i))) {
    const n = Number(m[1]);
    const u = (m[2] || 'm').toLowerCase();
    out.estimateMinutes = u === 'h' ? n * 60 : u === 'p' ? n * 25 : n;
  }

  while ((m = take(/\s&([\w-]+)(?=\s)/))) out.tags.push(m[1].toLowerCase());
  if ((m = take(/\s\+([\w-]+)(?=\s)/))) out.project = m[1];

  if ((m = text.match(/\s#([\w-]+)(?=\s)/))) {
    const t = matchTrack(m[1], tracks);
    if (t) {
      out.trackId = t.id;
      text = text.replace(m[0], ' ');
    }
  }
  out.title = text.replace(/\s+/g, ' ').trim() || String(raw || '').trim();
  return out;
}

// ---------- Recurrence ----------

export function nextDueDate(due, rec, from = due || todayISO()) {
  const base = due || from;
  if (!rec) return null;
  if (rec.freq === 'daily') return shiftISO(base, 1);
  if (rec.freq === 'weekdays') {
    let d = shiftISO(base, 1);
    while (dowIndex(d) > 4) d = shiftISO(d, 1);
    return d;
  }
  if (rec.freq === 'weekly') {
    if (rec.days && rec.days.length) {
      for (let i = 1; i <= 7; i++) {
        const d = shiftISO(base, i);
        if (rec.days.includes(dowIndex(d))) return d;
      }
    }
    return shiftISO(base, 7);
  }
  if (rec.freq === 'monthly') {
    const [y, m, d] = base.split('-').map(Number);
    const target = new Date(y, m, 1, 12); // first of next month
    const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(d, last));
    return isoFromMs(target.getTime());
  }
  return null;
}

export function makeTask(fields = {}) {
  return {
    id: fields.id || newId('task'),
    title: fields.title || 'Untitled',
    subjectId: fields.trackId || fields.subjectId || null,
    project: fields.project || null,
    tags: fields.tags || [],
    priority: fields.priority || 0,
    dueDate: fields.dueDate || null,
    recurrence: fields.recurrence || null,
    estimateMinutes: fields.estimateMinutes || null,
    subtasks: fields.subtasks || [],
    notes: fields.notes || '',
    completed: false,
    status: 'todo',
    completedAt: null,
    createdAt: Date.now(),
    quadrant: fields.quadrant || 'Q2',
    completedPomodoros: 0
  };
}

/** Mark complete. Returns the spawned next occurrence (already pushed) for recurring tasks. */
export function completeTask(tasks, id, now = Date.now()) {
  const t = tasks.find((x) => x.id === id);
  if (!t || t.completed) return null;
  t.completed = true;
  t.status = 'done';
  t.completedAt = now;
  if (!t.recurrence) return null;
  const next = makeTask({
    ...t,
    trackId: t.subjectId,
    dueDate: nextDueDate(t.dueDate, t.recurrence, isoFromMs(now)),
    subtasks: (t.subtasks || []).map((s) => ({ ...s, id: newId('sub'), done: false }))
  });
  tasks.push(next);
  return next;
}
export function reopenTask(tasks, id) {
  const t = tasks.find((x) => x.id === id);
  if (!t) return;
  t.completed = false;
  t.status = 'todo';
  t.completedAt = null;
}

export function subtaskProgress(task) {
  const subs = task.subtasks || [];
  return { done: subs.filter((s) => s.done).length, total: subs.length };
}

// ---------- Filters & smart lists ----------

export function filterTasks(tasks, f = {}, today = todayISO()) {
  const q = (f.query || '').trim().toLowerCase();
  return tasks.filter((t) => {
    if (f.status === 'open' && t.completed) return false;
    if (f.status === 'done' && !t.completed) return false;
    if (f.trackId && f.trackId !== 'all' && t.subjectId !== f.trackId) return false;
    if (f.project && t.project !== f.project) return false;
    if (f.tag && !(t.tags || []).includes(f.tag)) return false;
    if (f.priority != null && f.priority !== '' && f.priority !== 'all' && t.priority !== Number(f.priority)) return false;
    if (f.smart === 'today' && !(!t.completed && t.dueDate && t.dueDate <= today)) return false;
    if (f.smart === 'upcoming' && !(!t.completed && t.dueDate && t.dueDate > today)) return false;
    if (f.smart === 'overdue' && !(!t.completed && t.dueDate && t.dueDate < today)) return false;
    if (f.smart === 'nodate' && !(!t.completed && !t.dueDate)) return false;
    if (q) {
      const hay = [t.title, t.project, t.notes, ...(t.tags || []), ...(t.subtasks || []).map((s) => s.title || s.text)]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function sortTasks(tasks) {
  return [...tasks].sort(
    (a, b) =>
      Number(a.completed) - Number(b.completed) ||
      (b.priority || 0) - (a.priority || 0) ||
      (a.dueDate || '9999').localeCompare(b.dueDate || '9999') ||
      (a.createdAt || 0) - (b.createdAt || 0)
  );
}
export function todayList(tasks, today = todayISO()) {
  return sortTasks(filterTasks(tasks, { smart: 'today' }, today));
}
export function distinctProjects(tasks) {
  return [...new Set(tasks.map((t) => t.project).filter(Boolean))].sort();
}
export function distinctTags(tasks) {
  return [...new Set(tasks.flatMap((t) => t.tags || []))].sort();
}

/** Logged minutes attributed to a task through timer sessions. */
export function taskMinutes(sessions, taskId) {
  return sumMinutes(sessions.filter((s) => s.taskId === taskId));
}
