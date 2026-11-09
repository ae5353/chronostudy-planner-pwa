// Calendar view models: month grid, week timeline, day view, planned-vs-actual overlay.
import { shiftISO, weekStartISO, hhmmToMin, minutesByDay } from './log.js';

/** Imported (ICS / webcal / Google) events are tagged by id prefix or explicit source. */
export function isImportedBlock(b) {
  return b.source === 'import' || /^blk-(ics|txt|gcal|feed)/.test(b.id || '');
}

export function blockDurationMin(b) {
  return Math.max(0, hhmmToMin(b.endTime) - hhmmToMin(b.startTime));
}

/** 6x7 (or 5x7) Monday-first grid of ISO dates covering the month containing `iso`. */
export function monthGrid(iso) {
  const [y, m] = iso.split('-').map(Number);
  const first = `${y}-${String(m).padStart(2, '0')}-01`;
  const start = weekStartISO(first);
  const lastDay = new Date(y, m, 0).getDate();
  const last = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const weeks = [];
  let cur = start;
  while (cur <= last) {
    const row = [];
    for (let i = 0; i < 7; i++) {
      row.push({ date: cur, inMonth: cur.slice(0, 7) === first.slice(0, 7) });
      cur = shiftISO(cur, 1);
    }
    weeks.push(row);
  }
  return weeks;
}

export function weekDates(iso) {
  const s = weekStartISO(iso);
  return Array.from({ length: 7 }, (_, i) => shiftISO(s, i));
}

/** Per-day summary used by the month grid: planned vs studied minutes + event counts. */
export function daySummary(date, { blocks = [], sessions = [] }) {
  const dayBlocks = blocks.filter((b) => b.date === date);
  const planned = dayBlocks.filter((b) => !isImportedBlock(b));
  const imported = dayBlocks.filter(isImportedBlock);
  const studied = minutesByDay(sessions.filter((s) => s.date === date))[date] || 0;
  return {
    date,
    plannedMinutes: planned.reduce((a, b) => a + blockDurationMin(b), 0),
    studiedMinutes: studied,
    plannedCount: planned.length,
    importedCount: imported.length
  };
}

/**
 * Items for the week timeline / day view: planned blocks, imported events and
 * studied sessions, each with top/height as minutes-from-midnight.
 */
export function dayItems(date, { blocks = [], sessions = [] }) {
  const items = [];
  blocks
    .filter((b) => b.date === date)
    .forEach((b) =>
      items.push({
        kind: isImportedBlock(b) ? 'imported' : 'planned',
        id: b.id,
        title: b.title,
        trackId: b.subjectId || null,
        startMin: hhmmToMin(b.startTime),
        endMin: hhmmToMin(b.endTime),
        done: !!b.done
      })
    );
  sessions
    .filter((s) => s.date === date && s.start && s.end)
    .forEach((s) => {
      const st = hhmmToMin(s.start);
      let en = hhmmToMin(s.end);
      if (en <= st) en = Math.min(1440, st + s.minutes);
      items.push({
        kind: 'studied',
        id: s.id,
        title: s.topic || 'Studied',
        trackId: s.trackId,
        startMin: st,
        endMin: en,
        rating: s.rating
      });
    });
  return items.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
}

/** How much of a planned block was actually covered by studied sessions (0..1). */
export function overlapRatio(block, sessions) {
  const bs = hhmmToMin(block.startTime);
  const be = hhmmToMin(block.endTime);
  if (be <= bs) return 0;
  let covered = 0;
  sessions
    .filter((s) => s.date === block.date && s.start && s.end)
    .forEach((s) => {
      const ss = hhmmToMin(s.start);
      const se = Math.max(ss, hhmmToMin(s.end));
      covered += Math.max(0, Math.min(be, se) - Math.max(bs, ss));
    });
  return Math.min(1, covered / (be - bs));
}
