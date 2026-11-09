const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const block = html.split('/* ==== LOGIC:START')[1].split('/* ==== LOGIC:END ==== */')[0].replace(/^[^\n]*\n/, '');
const L = new Function(block + '\nreturn Logic;')();

const at = (y, m, d, h = 9, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();
const S = (y, m, d, mins, track = 'Math', h = 9) => ({ start: at(y, m, d, h), end: at(y, m, d, h) + mins * 60000, track, rating: 70, notes: 'n', learned: 'l' });

test('dates', () => {
  assert.equal(L.dayKey(at(2025, 3, 5)), '2025-03-05');
  assert.equal(L.addDays('2025-02-28', 1), '2025-03-01');
  assert.equal(L.weekStart('2025-03-09'), '2025-03-03'); // Sunday -> Monday
  assert.equal(L.weekStart('2025-03-03'), '2025-03-03');
});
test('formatting', () => {
  assert.equal(L.fmtClock(65000), '1:05');
  assert.equal(L.fmtClock(3725000), '1:02:05');
  assert.equal(L.fmtClock(-5), '0:00');
  assert.equal(L.fmtMin(45), '45m');
  assert.equal(L.fmtMin(125), '2h 05m');
  assert.equal(L.fmtMin(120), '2h ');
});
test('heat levels', () => {
  assert.deepEqual([0, 10, 30, 60, 120, 500].map(L.heatLevel), [0, 1, 2, 3, 4, 4]);
});
test('streak', () => {
  const by = { '2025-03-01': 5, '2025-03-02': 5, '2025-03-03': 5, '2025-02-20': 5, '2025-02-21': 5 };
  assert.deepEqual(L.streak(by, '2025-03-03'), { current: 3, best: 3 });
  assert.equal(L.streak(by, '2025-03-04').current, 3); // today empty keeps streak
  assert.equal(L.streak(by, '2025-03-05').current, 0);
  assert.deepEqual(L.streak({}, '2025-03-05'), { current: 0, best: 0 });
});
test('suggestTopics', () => {
  const ss = [S(2025, 3, 1, 10, 'Calculus'), S(2025, 3, 2, 10, 'Spanish'), S(2025, 3, 3, 10, 'calc lab')];
  assert.deepEqual(L.suggestTopics(ss, 'cal'), ['calc lab', 'Calculus']);
  assert.equal(L.suggestTopics(ss, '').length, 3);
  assert.equal(L.suggestTopics(ss, '', 1)[0], 'calc lab');
});
test('period', () => {
  assert.deepEqual(L.period('week', '2025-03-05'), { type: 'week', start: '2025-03-03', end: '2025-03-09' });
  assert.deepEqual(L.period('lastweek', '2025-03-05'), { type: 'week', start: '2025-02-24', end: '2025-03-02' });
  assert.deepEqual(L.period('month', '2025-02-10'), { type: 'month', start: '2025-02-01', end: '2025-02-28' });
  assert.deepEqual(L.period('lastmonth', '2025-01-10'), { type: 'month', start: '2024-12-01', end: '2024-12-31' });
});
test('buildReport schema and totals', () => {
  const data = { sessions: [S(2025, 3, 3, 60, 'Math'), S(2025, 3, 4, 30, 'Math'), S(2025, 3, 5, 45, 'Art'), S(2025, 2, 1, 99)],
    tasks: [{ title: 'HW', track: 'Math', done: true, due: '2025-03-04' }, { title: 'Old', done: true, due: '2025-01-01' }, { title: 'Open', done: false, due: '2025-03-06' }] };
  const r = L.buildReport(data, 'week', '2025-03-05');
  assert.equal(r.version, 1);
  assert.deepEqual(r.totals, { minutes: 135, sessions: 3, tasksDone: 1 });
  assert.deepEqual(r.byTrack, [{ name: 'Math', minutes: 90, sessions: 2 }, { name: 'Art', minutes: 45, sessions: 1 }]);
  assert.equal(r.daily.length, 7);
  assert.deepEqual(r.daily[0], { date: '2025-03-03', minutes: 60 });
  assert.deepEqual(Object.keys(r.sessions[0]), ['date', 'start', 'end', 'track', 'topic', 'rating', 'notes']);
  assert.equal(r.sessions[0].start, '09:00');
  assert.equal(r.sessions[0].end, '10:00');
  assert.equal(r.tasks.length, 2);
  assert.deepEqual(r.goals, []);
  JSON.stringify(r);
});
test('toCSV escapes', () => {
  const r = L.buildReport({ sessions: [{ ...S(2025, 3, 3, 10, 'A,"B"'), notes: 'line1\nline2' }], tasks: [] }, 'week', '2025-03-03');
  const csv = L.toCSV(r);
  assert.ok(csv.includes('"A,""B"""'));
  assert.ok(csv.includes('"line1\nline2"'));
  assert.ok(csv.startsWith('date,start,end,track,topic,rating,notes'));
});
test('monthGrid', () => {
  const g = L.monthGrid(2025, 2, { '2025-03-05': 20.4 }); // March 2025 starts Saturday
  assert.equal(g.filter(x => x === null).length, 5);
  assert.equal(g.length, 5 + 31);
  assert.equal(g[5 + 4].minutes, 20);
});
test('normalize and merge', () => {
  assert.deepEqual(L.normalize(null), { sessions: [], tasks: [], timer: null });
  const n = L.normalize({ sessions: [{ start: 2, end: 1 }, { start: 1, end: 2 }, null], tasks: [{ title: 'x' }, { nope: 1 }], timer: { start: 5, topic: 't' } });
  assert.equal(n.sessions.length, 1); assert.equal(n.tasks.length, 1); assert.equal(n.timer.start, 5);
  const a = { sessions: [{ id: 'a', start: 1, end: 2 }], tasks: [] };
  const m = L.mergeData(a, { sessions: [{ id: 'a', start: 1, end: 2 }, { id: 'b', start: 3, end: 4 }], tasks: [{ title: 't' }] });
  assert.equal(m.sessions.length, 2); assert.equal(m.tasks.length, 1);
});
