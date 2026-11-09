import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getTodayISO,
  addDaysISO,
  timeToMinutes,
  minutesToTime,
  parseSmartTaskInput,
  detectScheduleConflicts,
  computeAutoScheduleBlocks,
  calculateRequiredExamScore,
  calculateGoalPace,
  createDefaultState,
  Store
} from '../src/store.js';
import {
  parseICSCalendar,
  parseScheduleText,
  buildGoogleCalendarUrl,
  normalizeCalendarFeedUrl,
  fetchLiveCalendarFeed,
  fetchGoogleCalendarEventsAPI
} from '../src/calendar-sync.js';

const mockSubjects = createDefaultState().subjects;

test('1. parseSmartTaskInput — shorthand token extraction in any order & fallback', async (t) => {
  const today = getTodayISO();

  await t.test('extracts #CS-301, !Q1..Q4, ~3p, @today, @tomorrow, @+5d, and @2026-12-01 in various orders', () => {
    const res1 = parseSmartTaskInput('Finish graph benchmark #CS-301 !Q1 ~3p @today', mockSubjects);
    assert.equal(res1.title, 'Finish graph benchmark');
    assert.equal(res1.subjectId, 'subj-algo');
    assert.equal(res1.quadrant, 'Q1');
    assert.equal(res1.estimatedPomodoros, 3);
    assert.equal(res1.dueDate, today);

    const res2 = parseSmartTaskInput('@tomorrow ~4p !Q2 #MATH-204 Prove SVD orthogonality', mockSubjects);
    assert.equal(res2.title, 'Prove SVD orthogonality');
    assert.equal(res2.subjectId, 'subj-linalg');
    assert.equal(res2.quadrant, 'Q2');
    assert.equal(res2.estimatedPomodoros, 4);
    assert.equal(res2.dueDate, addDaysISO(today, 1));

    const res3 = parseSmartTaskInput('!Q3 Review Raft logs @+5d ~2 #CS-412', mockSubjects);
    assert.equal(res3.title, 'Review Raft logs');
    assert.equal(res3.subjectId, 'subj-sys');
    assert.equal(res3.quadrant, 'Q3');
    assert.equal(res3.estimatedPomodoros, 2);
    assert.equal(res3.dueDate, addDaysISO(today, 5));

    const res4 = parseSmartTaskInput('Read fMRI Baddeley paper @2026-12-01 !Q4 #PSYC-210 ~1p', mockSubjects);
    assert.equal(res4.title, 'Read fMRI Baddeley paper');
    assert.equal(res4.subjectId, 'subj-cogpsy');
    assert.equal(res4.quadrant, 'Q4');
    assert.equal(res4.estimatedPomodoros, 1);
    assert.equal(res4.dueDate, '2026-12-01');
  });

  await t.test('gracefully falls back when no shorthand tokens are present', () => {
    const fallbackDate = '2026-11-20';
    const res = parseSmartTaskInput('Write plain thesis outline without tags', mockSubjects, fallbackDate);
    assert.equal(res.title, 'Write plain thesis outline without tags');
    assert.equal(res.quadrant, null);
    assert.equal(res.subjectId, null);
    assert.equal(res.estimatedPomodoros, null);
    assert.equal(res.dueDate, fallbackDate);
  });
});

test('2. SuperMemo-2 (SM-2) Spaced Repetition (Store.prototype.reviewFlashcard)', async (t) => {
  await t.test('grading Again (quality 0) resets repetitions to 0 and interval to 1', () => {
    const s = new Store();
    const card = s.state.flashcards.find((c) => c.id === 'fc-4');
    assert.ok(card);
    assert.equal(card.repetitions, 2);
    assert.equal(card.interval, 3);

    s.reviewFlashcard('fc-4', 0);
    const updated = s.state.flashcards.find((c) => c.id === 'fc-4');
    assert.equal(updated.repetitions, 0);
    assert.equal(updated.interval, 1);
    assert.equal(updated.dueDate, addDaysISO(getTodayISO(), 1));
  });

  await t.test('grading Good (quality 4) progresses intervals 1 -> 3 -> round(3 * EF) and increments repetitions', () => {
    const s = new Store();
    // Create a fresh card with repetitions=0, interval=1, efactor=2.5
    s.state.flashcards.unshift({
      id: 'fc-test-good',
      subjectId: 'subj-algo',
      prompt: 'Test prompt',
      answer: 'Test answer',
      interval: 1,
      repetitions: 0,
      efactor: 2.5,
      dueDate: getTodayISO()
    });

    // 1st review with quality 4 (Good): repetitions 0 -> 1, interval -> 1, EF remains 2.5
    s.reviewFlashcard('fc-test-good', 4);
    let c = s.state.flashcards.find((card) => card.id === 'fc-test-good');
    assert.equal(c.repetitions, 1);
    assert.equal(c.interval, 1);
    assert.equal(c.efactor, 2.5);

    // 2nd review with quality 4 (Good): repetitions 1 -> 2, interval -> 3
    s.reviewFlashcard('fc-test-good', 4);
    c = s.state.flashcards.find((card) => card.id === 'fc-test-good');
    assert.equal(c.repetitions, 2);
    assert.equal(c.interval, 3);
    assert.equal(c.efactor, 2.5);

    // 3rd review with quality 4 (Good): repetitions 2 -> 3, interval -> round(3 * 2.5) = 8
    s.reviewFlashcard('fc-test-good', 4);
    c = s.state.flashcards.find((card) => card.id === 'fc-test-good');
    assert.equal(c.repetitions, 3);
    assert.equal(c.interval, Math.round(3 * 2.5));
  });

  await t.test('grading Easy (quality 5) increases efactor while repeated Hard (quality 3) never drops efactor below 1.3 floor', () => {
    const s = new Store();
    s.state.flashcards.unshift({
      id: 'fc-test-ef',
      subjectId: 'subj-algo',
      prompt: 'EF test',
      answer: 'EF answer',
      interval: 1,
      repetitions: 0,
      efactor: 2.5,
      dueDate: getTodayISO()
    });

    // Grade Easy (5) -> efactor increases by +0.1 to 2.6
    s.reviewFlashcard('fc-test-ef', 5);
    let c = s.state.flashcards.find((card) => card.id === 'fc-test-ef');
    assert.ok(c.efactor > 2.5);
    assert.equal(c.efactor, 2.6);

    // Repeatedly grade Hard (3) 20 times -> efactor should never drop below 1.3
    for (let i = 0; i < 20; i++) {
      s.reviewFlashcard('fc-test-ef', 3);
    }
    c = s.state.flashcards.find((card) => card.id === 'fc-test-ef');
    assert.equal(c.efactor, 1.3);
  });
});

test('3. detectScheduleConflicts — overlapping vs adjacent non-overlapping blocks', async (t) => {
  await t.test('identifies overlapping time blocks (09:00-10:30 and 10:00-11:00)', () => {
    const blocks = [
      { id: 'b1', startTime: '09:00', endTime: '10:30' },
      { id: 'b2', startTime: '10:00', endTime: '11:00' },
      { id: 'b3', startTime: '13:00', endTime: '14:00' }
    ];
    const conflicts = detectScheduleConflicts(blocks);
    assert.equal(conflicts.has('b1'), true);
    assert.equal(conflicts.has('b2'), true);
    assert.equal(conflicts.has('b3'), false);
    assert.equal(conflicts.size, 2);
  });

  await t.test('does not flag non-overlapping adjacent blocks (09:00-10:00 and 10:00-11:00)', () => {
    const blocks = [
      { id: 'adj1', startTime: '09:00', endTime: '10:00' },
      { id: 'adj2', startTime: '10:00', endTime: '11:00' },
      { id: 'adj3', startTime: '11:00', endTime: '12:30' }
    ];
    const conflicts = detectScheduleConflicts(blocks);
    assert.equal(conflicts.size, 0);
  });
});

test('4. computeAutoScheduleBlocks & Store.prototype.autoScheduleDate', async (t) => {
  await t.test('finds free gaps, prioritizes Q1 before Q2, respects 15m buffers, and avoids duplicate scheduling', () => {
    const targetDate = '2026-11-15';
    const existingBlocks = [
      {
        id: 'existing-1',
        date: targetDate,
        startTime: '08:00',
        endTime: '09:00',
        title: 'Morning Lecture',
        subjectId: 'subj-algo'
      }
    ];
    const tasks = [
      {
        id: 't-q2',
        title: 'Secondary Literature Synthesis',
        subjectId: 'subj-cogpsy',
        quadrant: 'Q2',
        completed: false,
        dueDate: targetDate,
        estimatedPomodoros: 2,
        completedPomodoros: 0
      },
      {
        id: 't-q1',
        title: 'Critical Dijkstra Proof',
        subjectId: 'subj-algo',
        quadrant: 'Q1',
        completed: false,
        dueDate: targetDate,
        estimatedPomodoros: 2,
        completedPomodoros: 0
      }
    ];

    const scheduled = computeAutoScheduleBlocks(existingBlocks, tasks, targetDate);
    assert.equal(scheduled.length, 2);

    // Q1 must be scheduled before Q2
    assert.equal(scheduled[0].title, 'Deep Focus: Critical Dijkstra Proof');
    assert.equal(scheduled[1].title, 'Deep Focus: Secondary Literature Synthesis');

    // First block must respect 15m buffer after 08:00-09:00 -> starts at 09:15
    assert.equal(scheduled[0].startTime, '09:15');
    // 2 pomos = 50 mins -> 09:15 to 10:05
    assert.equal(scheduled[0].endTime, '10:05');

    // Second block must respect 15m buffer after 10:05 -> starts at 10:20
    assert.equal(scheduled[1].startTime, '10:20');
    assert.equal(scheduled[1].endTime, '11:10');

    // Calling computeAutoScheduleBlocks again with the newly scheduled blocks included avoids duplicates
    const combined = [...existingBlocks, ...scheduled];
    const secondRun = computeAutoScheduleBlocks(combined, tasks, targetDate);
    assert.equal(secondRun.length, 0);
  });

  await t.test('Store.prototype.autoScheduleDate integrates with store state and avoids duplicates on repeat call', () => {
    const s = new Store();
    const today = getTodayISO();
    const firstAdded = s.autoScheduleDate(today);
    assert.ok(firstAdded > 0);

    // Calling autoScheduleDate a second time when all open tasks are already scheduled or gaps filled
    const secondAdded = s.autoScheduleDate(today);
    assert.equal(secondAdded, 0);
  });
});

test('5. calculateRequiredExamScore — accurate required final exam calculation', () => {
  // Current 90%, exam weight 40%, target 90% -> needs 90.0%
  assert.equal(calculateRequiredExamScore(90, 40, 90), 90.0);

  // Current 88%, exam weight 40%, target 90% -> (90 - 88 * 0.6) / 0.4 = (90 - 52.8) / 0.4 = 93.0%
  assert.equal(calculateRequiredExamScore(88, 40, 90), 93.0);

  // Current 95%, exam weight 25%, target 90% -> (90 - 95 * 0.75) / 0.25 = (90 - 71.25) / 0.25 = 75.0%
  assert.equal(calculateRequiredExamScore(95, 25, 90), 75.0);

  // Edge case: 100% exam weight -> returns targetGrade directly
  assert.equal(calculateRequiredExamScore(80, 100, 92), 92);
});

test('6. Cornell Notes -> SM-2 Flashcard conversion & RFC-5545 .ICS export validity', async (t) => {
  await t.test('convertCornellNoteToFlashcard converts cue, summary, and notes into an SM-2 flashcard', () => {
    const s = new Store();
    const initialCount = s.state.flashcards.length;
    const note = s.state.cornellNotes[0];

    const created = s.convertCornellNoteToFlashcard(note.id);
    assert.ok(created);
    assert.equal(s.state.flashcards.length, initialCount + 1);
    assert.equal(created.subjectId, note.subjectId);
    assert.equal(created.prompt, note.cue);
    assert.ok(created.answer.includes(note.summary));
    assert.ok(created.answer.includes(note.notes));
    assert.equal(created.interval, 1);
    assert.equal(created.repetitions, 0);
    assert.equal(created.efactor, 2.5);
  });

  await t.test('exportICS outputs valid RFC-5545 calendar payload', () => {
    const s = new Store();
    const ics = s.exportICS();
    assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0'));
    assert.ok(ics.includes('BEGIN:VEVENT'));
    assert.ok(ics.includes('DTSTART:'));
    assert.ok(ics.includes('DTEND:'));
    assert.ok(ics.includes('SUMMARY:'));
    assert.ok(ics.includes('END:VEVENT'));
    assert.ok(ics.endsWith('END:VCALENDAR'));
  });
});

test('7. v3.0 Google Calendar .ICS Import, Plain-Text Schedule Parser, Goal Pace & Blank Slate', async (t) => {
  await t.test('parseICSCalendar parses dated events and recurring weekly RRULE events from Google Calendar', () => {
    const sampleICS = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'DTSTART:20261110T090000',
      'DTEND:20261110T103000',
      'SUMMARY:Rust Async Runtime Deep Dive',
      'LOCATION:Home Studio',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'DTSTART:20261111T180000',
      'DTEND:20261111T191500',
      'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR',
      'SUMMARY:Boxing & Conditioning',
      'LOCATION:Metro Gym',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const parsed = parseICSCalendar(sampleICS, 'subj-algo');
    assert.equal(parsed.scheduleBlocks.length, 2);
    assert.equal(parsed.scheduleBlocks[0].title, 'Rust Async Runtime Deep Dive');
    assert.equal(parsed.scheduleBlocks[0].date, '2026-11-10');
    assert.equal(parsed.scheduleBlocks[0].startTime, '09:00');
    assert.equal(parsed.scheduleBlocks[0].endTime, '10:30');
    assert.equal(parsed.weeklySlots.length, 3); // MO, WE, FR
  });

  await t.test('parseScheduleText extracts weekly routine slots and daily blocks from pasted text', () => {
    const raw = [
      'Mon 09:00 - 10:30 Deep Work: LLM Agents @Home Lab',
      'Wed 18:00-19:15 Boxing & Mobility @Gym',
      '14:00 - 15:00 Spanish Conversation Practice'
    ].join('\n');

    const res = parseScheduleText(raw, '2026-11-12', 'subj-algo');
    assert.equal(res.weeklySlots.length, 2);
    assert.equal(res.weeklySlots[0].dayIndex, 0); // Mon
    assert.equal(res.weeklySlots[1].dayIndex, 2); // Wed
    assert.equal(res.scheduleBlocks.length, 1);
    assert.equal(res.scheduleBlocks[0].date, '2026-11-12');
    assert.equal(res.scheduleBlocks[0].startTime, '14:00');
    assert.equal(res.scheduleBlocks[0].endTime, '15:00');
  });

  await t.test('buildGoogleCalendarUrl creates a valid Google Calendar template URL', () => {
    const url = buildGoogleCalendarUrl({
      title: 'Spanish & Reading Synthesis',
      date: '2026-11-12',
      startTime: '14:00',
      endTime: '15:00',
      details: 'ChronoStudy Focus Block'
    });
    assert.ok(url.startsWith('https://calendar.google.com/calendar/render?'));
    assert.ok(url.includes('action=TEMPLATE'));
    assert.ok(url.includes('dates=20261112T140000%2F20261112T150000'));
  });

  await t.test('calculateGoalPace, shiftBlockTime, and startBlankSlate work accurately', () => {
    const pace = calculateGoalPace(180, 10, 4); // 3h logged out of 10h target, 4 days left -> 420m / 4 = 105m/day
    assert.equal(pace.remainingMinutes, 420);
    assert.equal(pace.dailyMinutesNeeded, 105);
    assert.equal(pace.completionPct, 30);

    const s = new Store();
    const block = s.state.scheduleBlocks[0];
    const oldStart = timeToMinutes(block.startTime);
    s.shiftBlockTime(block.id, 15);
    const shifted = s.state.scheduleBlocks.find((b) => b.id === block.id);
    assert.equal(timeToMinutes(shifted.startTime), oldStart + 15);

    s.startBlankSlate();
    assert.equal(s.state.tasks.length, 0);
    assert.equal(s.state.scheduleBlocks.length, 0);
    assert.equal(s.state.subjects.length, 1);
  });

  await t.test('normalizeCalendarFeedUrl, fetchLiveCalendarFeed, and fetchGoogleCalendarEventsAPI auto-sync university & Google feeds', async () => {
    assert.equal(
      normalizeCalendarFeedUrl('webcal://canvas.university.edu/feeds/calendars/user_123.ics'),
      'https://canvas.university.edu/feeds/calendars/user_123.ics'
    );
    assert.ok(
      normalizeCalendarFeedUrl('student@university.edu').includes('calendar.google.com/calendar/ical/')
    );

    const mockFetch = async () => ({
      ok: true,
      text: async () =>
        'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nDTSTART:20261113T100000\r\nDTEND:20261113T113000\r\nSUMMARY:University Algorithms Seminar\r\nEND:VEVENT\r\nEND:VCALENDAR',
      json: async () => ({
        items: [
          {
            id: 'ev-99',
            summary: 'Google Calendar Live Sync Event',
            start: { dateTime: '2026-11-14T15:00:00Z' },
            end: { dateTime: '2026-11-14T16:00:00Z' }
          }
        ]
      })
    });

    const liveFeed = await fetchLiveCalendarFeed('webcal://canvas.university.edu/feed.ics', 'subj-algo', mockFetch);
    assert.equal(liveFeed.scheduleBlocks.length, 1);
    assert.equal(liveFeed.scheduleBlocks[0].title, 'University Algorithms Seminar');

    const gcalRes = await fetchGoogleCalendarEventsAPI({
      calendarId: 'primary',
      accessToken: 'mock-token',
      defaultSubjectId: 'subj-algo',
      fetchImpl: mockFetch
    });
    assert.equal(gcalRes.scheduleBlocks.length, 1);
    assert.equal(gcalRes.scheduleBlocks[0].title, 'Google Calendar Live Sync Event');
  });
});


