// Data shaping and row building logic for ChronoStudy Google Sheets report generator.
// Pure JS (no DOM, no SpreadsheetApp dependencies) so it can be tested in node and run inside Apps Script.

export function formatHours(mins) {
  return Math.round((Number(mins || 0) / 60) * 10) / 10;
}

export function buildTabName(payload) {
  const p = payload?.period || {};
  if (p.type === 'month') {
    return `Month ${p.start.slice(0, 7)}`;
  }
  return `Week ${p.start}`;
}

export function shapeReportData(payload) {
  const p = payload.period || { type: 'week', start: '', end: '' };
  const totals = payload.totals || { minutes: 0, sessions: 0, tasksDone: 0 };
  const totalHours = formatHours(totals.minutes);

  const kpis = [
    ['Period', `${p.start} to ${p.end} (${p.type.toUpperCase()})`],
    ['Total Focus Time', `${totalHours} hrs (${totals.minutes} mins)`],
    ['Completed Sessions', totals.sessions || 0],
    ['Tasks Finished', totals.tasksDone || 0],
    ['Average Session', totals.sessions ? `${Math.round(totals.minutes / totals.sessions)} mins` : '0 mins']
  ];

  const trackRows = (payload.byTrack || []).map((t) => [
    t.name,
    formatHours(t.minutes),
    t.minutes,
    t.sessions
  ]);

  const dailyRows = (payload.daily || []).map((d) => [
    d.date,
    formatHours(d.minutes),
    d.minutes
  ]);

  const sessionRows = (payload.sessions || []).map((s) => [
    s.date,
    s.start || '',
    s.end || '',
    s.track || '',
    s.topic || '',
    s.rating ? `${s.rating}★` : '',
    s.notes || ''
  ]);

  const taskRows = (payload.tasks || []).map((t) => [
    t.title,
    t.track || '',
    t.done ? 'COMPLETED' : 'PENDING',
    t.due || ''
  ]);

  const goalRows = (payload.goals || []).map((g) => [
    g.track,
    g.targetHoursPerWeek,
    g.actualHours,
    g.actualHours >= g.targetHoursPerWeek ? 'MET' : `${Math.round((g.actualHours / (g.targetHoursPerWeek || 1)) * 100)}%`
  ]);

  return {
    tabName: buildTabName(payload),
    kpis,
    trackRows,
    dailyRows,
    sessionRows,
    taskRows,
    goalRows
  };
}
