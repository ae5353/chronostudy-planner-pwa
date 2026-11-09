import test from 'node:test';
import assert from 'node:assert/strict';
import { shapeReportData, buildTabName, formatHours } from '../src/shape.js';

test('1. formatHours converts minutes properly', () => {
  assert.equal(formatHours(90), 1.5);
  assert.equal(formatHours(60), 1.0);
  assert.equal(formatHours(0), 0);
});

test('2. buildTabName formats week and month tabs properly', () => {
  assert.equal(buildTabName({ period: { type: 'week', start: '2026-11-09' } }), 'Week 2026-11-09');
  assert.equal(buildTabName({ period: { type: 'month', start: '2026-11-01' } }), 'Month 2026-11');
});

test('3. shapeReportData formats KPIs, tracks, and sessions accurately', () => {
  const payload = {
    version: 1,
    period: { type: 'week', start: '2026-11-02', end: '2026-11-08' },
    totals: { minutes: 120, sessions: 2, tasksDone: 3 },
    byTrack: [{ name: 'Deep Work', minutes: 120, sessions: 2 }],
    sessions: [{ date: '2026-11-02', start: '09:00', end: '11:00', track: 'Deep Work', topic: 'Core API', rating: 5, notes: 'Done' }]
  };

  const shaped = shapeReportData(payload);
  assert.equal(shaped.tabName, 'Week 2026-11-02');
  assert.equal(shaped.trackRows.length, 1);
  assert.equal(shaped.sessionRows.length, 1);
  assert.equal(shaped.sessionRows[0][4], 'Core API');
});
