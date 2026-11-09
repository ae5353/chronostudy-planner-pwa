// ChronoStudy v3.0 — Google Calendar, RFC-5545 .ICS Importer & Smart Schedule Parser
// Enables two-way calendar interoperability:
// 1. Import .ICS files exported from Google Calendar, Apple Calendar, Outlook, or course/activity schedules
// 2. Parse plain-text schedules pasted from emails, syllabi, or workout plans
// 3. Generate 1-Click "Add to Google Calendar" deep links for mobile & desktop

const BYDAY_MAP = { MO: 0, TU: 1, WE: 2, TH: 3, FR: 4, SA: 5, SU: 6 };
const DAY_NAME_MAP = {
  mon: 0, monday: 0,
  tue: 1, tues: 1, tuesday: 1,
  wed: 2, wednesday: 2,
  thu: 3, thur: 3, thurs: 3, thursday: 3,
  fri: 4, friday: 4,
  sat: 5, saturday: 5,
  sun: 6, sunday: 6
};

function parseICSTimestamp(rawVal = '') {
  // Formats: 20261109T093000Z, 20261109T093000, or 20261109
  const clean = String(rawVal).trim().replace(/^.*:/, '');
  const m = clean.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/);
  if (!m) return null;
  const [, yr, mo, da, hh, mm, ss, isUtc] = m;
  const dateIso = `${yr}-${mo}-${da}`;
  if (!hh) {
    return { dateIso, timeHHMM: '09:00', allDay: true };
  }
  if (isUtc) {
    const dt = new Date(Date.UTC(Number(yr), Number(mo) - 1, Number(da), Number(hh), Number(mm), Number(ss || 0)));
    const localH = String(dt.getHours()).padStart(2, '0');
    const localM = String(dt.getMinutes()).padStart(2, '0');
    const offset = dt.getTimezoneOffset() * 60000;
    const localDate = new Date(dt.getTime() - offset).toISOString().slice(0, 10);
    return { dateIso: localDate, timeHHMM: `${localH}:${localM}`, allDay: false };
  }
  return { dateIso, timeHHMM: `${hh}:${mm}`, allDay: false };
}

/**
 * Parse an RFC-5545 .ICS file (Google Calendar, Apple Calendar, Outlook, etc.)
 * Returns { scheduleBlocks: [...], weeklySlots: [...] }
 */
export function parseICSCalendar(icsText = '', defaultSubjectId = 'subj-algo') {
  // Unfold RFC-5545 multi-line continuations
  const unfolded = String(icsText).replace(/\r?\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);

  const scheduleBlocks = [];
  const weeklySlots = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === 'BEGIN:VEVENT') {
      current = {};
    } else if (line === 'END:VEVENT' && current) {
      const startParsed = parseICSTimestamp(current.DTSTART || '');
      const endParsed = parseICSTimestamp(current.DTEND || '');
      const title = (current.SUMMARY || 'Imported Calendar Event')
        .replace(/\\,/g, ',')
        .replace(/\\;/g, ';')
        .replace(/\\n/g, ' ')
        .trim();

      if (startParsed) {
        const startTime = startParsed.timeHHMM || '09:00';
        const endTime = endParsed && !endParsed.allDay ? endParsed.timeHHMM : addMinutesHHMM(startTime, 60);
        const category = inferCategoryFromTitle(title);

        // Check if recurring weekly event (RRULE:FREQ=WEEKLY;BYDAY=MO,WE...)
        if (current.RRULE && /FREQ=WEEKLY/i.test(current.RRULE)) {
          const byDayMatch = current.RRULE.match(/BYDAY=([A-Z,]+)/i);
          const days = byDayMatch
            ? byDayMatch[1].split(',').map((d) => BYDAY_MAP[d.toUpperCase()]).filter((d) => d !== undefined)
            : [getWeekdayIndex(startParsed.dateIso)];

          days.forEach((dayIdx) => {
            weeklySlots.push({
              id: `wp-ics-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              dayIndex: dayIdx,
              startTime,
              endTime,
              title,
              subjectId: defaultSubjectId,
              type: formatCategoryLabel(category)
            });
          });
        }

        scheduleBlocks.push({
          id: `blk-ics-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          date: startParsed.dateIso,
          startTime,
          endTime,
          title,
          subjectId: defaultSubjectId,
          category,
          done: false,
          importedFrom: 'ics'
        });
      }
      current = null;
    } else if (current) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const keyPart = line.slice(0, colonIdx).split(';')[0].toUpperCase();
        const valPart = line.slice(colonIdx + 1);
        current[keyPart] = valPart;
      }
    }
  }

  return { scheduleBlocks, weeklySlots };
}

function getWeekdayIndex(dateIso) {
  const d = new Date(dateIso + 'T12:00:00');
  return d.getDay() === 0 ? 6 : d.getDay() - 1;
}

function addMinutesHHMM(hhmm, minsToAdd) {
  const [h, m] = String(hhmm).split(':').map(Number);
  const total = Math.min(23 * 60 + 59, (h || 0) * 60 + (m || 0) + minsToAdd);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function inferCategoryFromTitle(title = '') {
  const lower = title.toLowerCase();
  if (/(gym|run|workout|yoga|fitness|walk|sport|swim|mobility|cardio)/.test(lower)) return 'wellness';
  if (/(review|flashcard|anki|sm-2|practice|quiz|recall)/.test(lower)) return 'review';
  if (/(class|lecture|seminar|meeting|call|workshop|lesson|coaching)/.test(lower)) return 'lecture';
  return 'deep_work';
}

function formatCategoryLabel(cat) {
  if (cat === 'wellness') return 'Fitness / Wellness';
  if (cat === 'review') return 'Review / Practice';
  if (cat === 'lecture') return 'Session / Meeting';
  return 'Deep Focus';
}

/**
 * Smart Plain-Text Schedule Parser
 * Parses lines like:
 *   "Mon 09:00-10:30 Spanish Immersion Practice"
 *   "Wednesday 18:00 - 19:15 Strength Training & Mobility"
 *   "14:00-15:30 Build AI Portfolio Project"
 */
export function parseScheduleText(rawText = '', targetDateIso = new Date().toISOString().slice(0, 10), defaultSubjectId = 'subj-algo') {
  const lines = String(rawText)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const scheduleBlocks = [];
  const weeklySlots = [];

  for (const line of lines) {
    // Match optional day name + time range + title
    const m = line.match(
      /^(?:(mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\s+)?(\d{1,2}:\d{2})\s*(?:-|–|to)\s*(\d{1,2}:\d{2})\s+(.+)$/i
    );
    if (!m) continue;
    const [, dayStr, rawStart, rawEnd, rawTitle] = m;
    const startTime = rawStart.length === 4 ? `0${rawStart}` : rawStart;
    const endTime = rawEnd.length === 4 ? `0${rawEnd}` : rawEnd;
    const title = rawTitle.trim();
    const category = inferCategoryFromTitle(title);

    if (dayStr) {
      const dayIdx = DAY_NAME_MAP[dayStr.toLowerCase()];
      if (dayIdx !== undefined) {
        weeklySlots.push({
          id: `wp-txt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          dayIndex: dayIdx,
          startTime,
          endTime,
          title,
          subjectId: defaultSubjectId,
          type: formatCategoryLabel(category)
        });
      }
    } else {
      scheduleBlocks.push({
        id: `blk-txt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date: targetDateIso,
        startTime,
        endTime,
        title,
        subjectId: defaultSubjectId,
        category,
        done: false
      });
    }
  }

  return { scheduleBlocks, weeklySlots };
}

/**
 * Build a 1-Click "Add to Google Calendar" Template URL for any Time Block or Milestone
 */
export function buildGoogleCalendarUrl({ title, date, startTime = '09:00', endTime = '10:00', details = '' }) {
  const dCompact = String(date || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
  const sCompact = String(startTime).replace(':', '') + '00';
  const eCompact = String(endTime).replace(':', '') + '00';
  const datesParam = `${dCompact}T${sCompact}/${dCompact}T${eCompact}`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title || 'ChronoStudy Session',
    dates: datesParam,
    details: details || 'Scheduled via ChronoStudy Personal Time, Study & Life Planner'
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
