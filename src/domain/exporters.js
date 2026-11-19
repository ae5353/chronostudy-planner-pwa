// src/domain/exporters.js — iCal (.ics), JSON snapshot & CSV formula-safe exporters
import { toLocalDateStr } from './date-utils.js';

export function generateICS(state) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ChronoStudy//ITU Study Tracker//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:ChronoStudy Schedule'
  ];

  const formatICSDate = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const escapeICS = (text) => String(text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');

  const foldICSLine = (line) => {
    if (line.length <= 75) return line;
    const chunks = [];
    let remaining = line;
    chunks.push(remaining.slice(0, 75));
    remaining = remaining.slice(75);
    while (remaining.length > 0) {
      chunks.push(' ' + remaining.slice(0, 74));
      remaining = remaining.slice(74);
    }
    return chunks.join('\r\n');
  };

  const pushFolded = (...rawLines) => {
    rawLines.forEach((l) => lines.push(foldICSLine(l)));
  };

  const byDayCodes = ['', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
  const buildRecurrenceRule = (rec, interval = 1) => {
    const step = Math.max(1, parseInt(interval, 10) || 1);
    switch (rec) {
      case 'daily': return step > 1 ? `RRULE:FREQ=DAILY;INTERVAL=${step}` : 'RRULE:FREQ=DAILY';
      case 'weekdays': return 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
      case 'weekly': return step > 1 ? `RRULE:FREQ=WEEKLY;INTERVAL=${step}` : 'RRULE:FREQ=WEEKLY';
      case 'biweekly': return 'RRULE:FREQ=WEEKLY;INTERVAL=2';
      case 'triweekly': return 'RRULE:FREQ=WEEKLY;INTERVAL=3';
      case 'monthly': return step > 1 ? `RRULE:FREQ=MONTHLY;INTERVAL=${step}` : 'RRULE:FREQ=MONTHLY';
      case 'custom':
      case 'custom_days': return `RRULE:FREQ=DAILY;INTERVAL=${step}`;
      case 'custom_weeks': return `RRULE:FREQ=WEEKLY;INTERVAL=${step}`;
      default: return null;
    }
  };

  const getAnchorDateForWeekday = (dayNum, anchorStr = null) => {
    const targetDay = Math.min(7, Math.max(1, parseInt(dayNum, 10) || 1));
    const base = (anchorStr && /^\d{4}-\d{2}-\d{2}$/.test(anchorStr))
      ? new Date(`${anchorStr}T12:00:00`)
      : new Date();
    base.setHours(12, 0, 0, 0);
    const curDay = base.getDay() || 7;
    const diff = (targetDay - curDay + 7) % 7;
    base.setDate(base.getDate() + diff);
    return toLocalDateStr(base);
  };

  const stamp = formatICSDate(new Date());

  (state.tasks || []).forEach((task) => {
    if (!task.dueDate) return;
    const start = new Date(task.dueDate + 'T09:00:00');
    const end = new Date(start.getTime() + (task.targetMinutes || 45) * 60000);
    const subjLabel = (task.subject && task.subject.trim()) ? task.subject.trim() : 'General';
    const rrule = buildRecurrenceRule(task.recurrence, task.recurrenceInterval);

    const eventLines = [
      'BEGIN:VEVENT',
      `UID:task-${task.id}@chronostudy.app`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${formatICSDate(start)}`,
      `DTEND:${formatICSDate(end)}`,
      `SUMMARY:${escapeICS(`[Study] ${subjLabel}: ${task.title}`)}`,
      `DESCRIPTION:${escapeICS(task.notes || 'Scheduled study block in ChronoStudy')}`,
      `STATUS:${task.completed ? 'COMPLETED' : 'CONFIRMED'}`
    ];
    if (rrule) eventLines.push(rrule);
    eventLines.push('END:VEVENT');
    pushFolded(...eventLines);
  });

  (state.subjects || []).forEach((sub) => {
    if (!Array.isArray(sub.schedule)) return;
    sub.schedule.forEach((slot, idx) => {
      const dayStr = getAnchorDateForWeekday(slot.day);
      const start = new Date(`${dayStr}T${slot.start || '09:00'}:00`);
      const end = new Date(`${dayStr}T${slot.end || '10:00'}:00`);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
      const byDay = byDayCodes[Math.min(7, Math.max(1, parseInt(slot.day, 10) || 1))];
      pushFolded(
        'BEGIN:VEVENT',
        `UID:lecture-${sub.id}-${idx}@chronostudy.app`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${formatICSDate(start)}`,
        `DTEND:${formatICSDate(end)}`,
        `RRULE:FREQ=WEEKLY;BYDAY=${byDay}`,
        `SUMMARY:${escapeICS(`[Lecture] ${sub.code ? sub.code + ' ' : ''}${sub.name}`)}`,
        `DESCRIPTION:${escapeICS(slot.label || 'Course Lecture')}`,
        'STATUS:CONFIRMED',
        'END:VEVENT'
      );
    });
  });

  (state.weeklyEvents || []).forEach((ev) => {
    const dayStr = getAnchorDateForWeekday(ev.day, ev.anchorDate);
    const start = new Date(`${dayStr}T${ev.start || '19:00'}:00`);
    const end = new Date(`${dayStr}T${ev.end || '21:00'}:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
    const rrule = buildRecurrenceRule(ev.recurrence || 'weekly') || 'RRULE:FREQ=WEEKLY';
    pushFolded(
      'BEGIN:VEVENT',
      `UID:event-${ev.id}@chronostudy.app`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${formatICSDate(start)}`,
      `DTEND:${formatICSDate(end)}`,
      rrule,
      `SUMMARY:${escapeICS(`[Event] ${ev.title}`)}`,
      `DESCRIPTION:${escapeICS(ev.notes || '')}`,
      'STATUS:CONFIRMED',
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function exportJSON(state) {
  return JSON.stringify(
    {
      appName: 'ChronoStudy',
      version: state.version,
      exportedAt: new Date().toISOString(),
      groups: state.groups,
      subjects: state.subjects,
      weeklyEvents: state.weeklyEvents,
      tasks: state.tasks,
      sessions: state.sessions,
      settings: state.settings
    },
    null,
    2
  );
}

export function exportCSV(state) {
  const headers = ['Session ID', 'Date', 'Start Time', 'End Time', 'Duration (Minutes)', 'Subject', 'Topic', 'Notes'];
  const neutralizeCSVFormula = (str) => {
    if (/^[=+\-@\t\r]/.test(str)) {
      return `'${str}`;
    }
    return str;
  };
  const escape = (val) => {
    const safe = neutralizeCSVFormula((val ?? '').toString());
    return `"${safe.replace(/"/g, '""')}"`;
  };

  const rows = (state.sessions || []).map((s) => {
    const startDate = s.startTime ? new Date(s.startTime) : new Date(s.createdAt);
    const endDate = s.endTime ? new Date(s.endTime) : startDate;
    const dateStr = toLocalDateStr(startDate);
    const startStr = startDate.toTimeString().slice(0, 8);
    const endStr = endDate.toTimeString().slice(0, 8);
    const mins = Math.round((s.durationSec || 0) / 60);

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

  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

export const generateCSV = exportCSV;
