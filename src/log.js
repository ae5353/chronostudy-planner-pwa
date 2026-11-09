// Study log: pure, DOM-free logic (sessions, timer maths, streaks, totals, topic progress).
// Dates are local-time ISO strings (YYYY-MM-DD); times are HH:MM.

const pad = (n) => String(n).padStart(2, '0');

export function isoFromMs(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function hhmmFromMs(ms) {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function shiftISO(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  return isoFromMs(new Date(y, m - 1, d + days, 12).getTime());
}
export function hhmmToMin(t = '00:00') {
  const [h, m] = String(t).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
/** Monday-based start of week for an ISO date. */
export function weekStartISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dow = (new Date(y, m - 1, d, 12).getDay() + 6) % 7;
  return shiftISO(iso, -dow);
}
export function monthBounds(iso) {
  const [y, m] = iso.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(last)}` };
}

// ---------- Timer (timestamp based; survives reloads) ----------

/** Active seconds elapsed in the current timer run. */
export function timerElapsedSeconds(fs, now = Date.now()) {
  const base = fs.baseElapsedSeconds || 0;
  if (fs.isRunning && fs.startedAt) return base + Math.max(0, (now - fs.startedAt) / 1000);
  return base;
}
export function timerRemainingSeconds(fs, now = Date.now()) {
  return Math.max(0, Math.round(fs.durationSeconds - timerElapsedSeconds(fs, now)));
}

export function startTimerState(fs, now = Date.now()) {
  if (fs.isRunning) return fs;
  fs.isRunning = true;
  fs.startedAt = now;
  if (!fs.sessionStartedAt) fs.sessionStartedAt = now;
  return fs;
}
export function pauseTimerState(fs, now = Date.now()) {
  if (!fs.isRunning) return fs;
  fs.baseElapsedSeconds = timerElapsedSeconds(fs, now);
  fs.isRunning = false;
  fs.startedAt = null;
  fs.remainingSeconds = timerRemainingSeconds(fs, now);
  return fs;
}
export function resetTimerState(fs) {
  fs.isRunning = false;
  fs.startedAt = null;
  fs.baseElapsedSeconds = 0;
  fs.sessionStartedAt = null;
  fs.remainingSeconds = fs.durationSeconds;
  return fs;
}

// ---------- Sessions ----------

let seq = 0;
export function newId(prefix = 'id') {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}-${Math.random().toString(36).slice(2, 5)}`;
}

export function clampRating(r) {
  const n = Number(r);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(5, Math.round(n));
}

/** Build a normalised session; end/start may be given as times, or minutes + end. */
export function makeSession(input) {
  const date = input.date;
  let start = input.start;
  let end = input.end;
  let minutes = input.minutes;
  if (start && end) {
    let diff = hhmmToMin(end) - hhmmToMin(start);
    if (diff < 0) diff += 24 * 60; // crossed midnight
    minutes = diff;
  } else if (minutes != null && end && !start) {
    start = minutesToHHMM(hhmmToMin(end) - minutes);
  } else if (minutes != null && start && !end) {
    end = minutesToHHMM(hhmmToMin(start) + minutes);
  }
  return {
    id: input.id || newId('ses'),
    date,
    start: start || null,
    end: end || null,
    minutes: Math.max(0, Math.round(minutes || 0)),
    trackId: input.trackId || null,
    topicId: input.topicId || null,
    topic: (input.topic || '').trim(),
    rating: clampRating(input.rating),
    notes: (input.notes || '').trim(),
    covered: (input.covered || '').trim(),
    taskId: input.taskId || null,
    source: input.source || 'manual'
  };
}
function minutesToHHMM(total) {
  const t = ((Math.round(total) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
}

/**
 * Convert the timer into a session. Returns null for breaks or sub-30s runs.
 * `endMs` lets a late-detected completion (app was closed) be back-dated.
 */
export function sessionFromTimer(fs, endMs = Date.now()) {
  if (fs.mode === 'break') return null;
  const elapsed = Math.min(timerElapsedSeconds(fs, endMs), fs.durationSeconds);
  if (elapsed < 30) return null;
  const minutes = Math.max(1, Math.round(elapsed / 60));
  const startMs = fs.sessionStartedAt || endMs - elapsed * 1000;
  return makeSession({
    date: isoFromMs(endMs),
    start: hhmmFromMs(endMs - minutes * 60000),
    end: hhmmFromMs(endMs),
    minutes,
    trackId: fs.linkedSubjectId,
    topicId: fs.linkedTopicId || null,
    taskId: fs.linkedTaskId || null,
    source: 'timer',
    _startMs: startMs
  });
}

// ---------- Aggregation ----------

export function inRange(date, from, to) {
  return date >= from && date <= to;
}
export function sessionsInRange(sessions, from, to) {
  return sessions.filter((s) => inRange(s.date, from, to));
}
export function sumMinutes(sessions) {
  return sessions.reduce((a, s) => a + (s.minutes || 0), 0);
}
export function minutesByDay(sessions) {
  const map = {};
  sessions.forEach((s) => {
    map[s.date] = (map[s.date] || 0) + (s.minutes || 0);
  });
  return map;
}
export function minutesByTrack(sessions) {
  const map = {};
  sessions.forEach((s) => {
    const k = s.trackId || '_none';
    if (!map[k]) map[k] = { minutes: 0, sessions: 0 };
    map[k].minutes += s.minutes || 0;
    map[k].sessions += 1;
  });
  return map;
}

/** Daily / weekly (Mon-Sun) / monthly totals relative to `today`. */
export function periodTotals(sessions, today) {
  const ws = weekStartISO(today);
  const mb = monthBounds(today);
  const day = sessionsInRange(sessions, today, today);
  const week = sessionsInRange(sessions, ws, shiftISO(ws, 6));
  const month = sessionsInRange(sessions, mb.start, mb.end);
  return {
    day: { minutes: sumMinutes(day), sessions: day.length },
    week: { minutes: sumMinutes(week), sessions: week.length },
    month: { minutes: sumMinutes(month), sessions: month.length }
  };
}

/**
 * Streak = consecutive days with >=1 logged minute. The current streak stays
 * alive if today has nothing yet but yesterday does.
 */
export function computeStreaks(sessions, today) {
  const days = new Set(sessions.filter((s) => s.minutes > 0).map((s) => s.date));
  let current = 0;
  let cursor = days.has(today) ? today : shiftISO(today, -1);
  while (days.has(cursor)) {
    current += 1;
    cursor = shiftISO(cursor, -1);
  }
  const sorted = [...days].sort();
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const d of sorted) {
    run = prev && shiftISO(prev, 1) === d ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  return { current, longest, activeDays: days.size };
}

// ---------- Topics ----------

/** Progress 0-100: checklist ratio when a checklist exists, else manual percent. */
export function topicProgress(topic) {
  const list = topic.checklist || [];
  if (list.length) return Math.round((list.filter((c) => c.done).length / list.length) * 100);
  return Math.max(0, Math.min(100, Math.round(topic.percent || 0)));
}
export function topicMinutes(sessions, topicId) {
  return sumMinutes(sessions.filter((s) => s.topicId === topicId));
}

export function formatMinutes(min) {
  const m = Math.round(min || 0);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}
