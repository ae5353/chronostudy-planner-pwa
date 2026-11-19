// @ts-check
// src/domain/analytics.js — Indexed session stats, subject metrics & multi-week analytics engine
import { toLocalDateStr, getMondayOfDate, formatDurationHM } from './date-utils.js';

export function buildSessionTaskIndex(sessions = []) {
  const byTaskId = new Map();
  const unlinkedByNormTopic = new Map();

  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    if (!s) continue;
    if (s.taskId) {
      let arr = byTaskId.get(s.taskId);
      if (!arr) {
        arr = [];
        byTaskId.set(s.taskId, arr);
      }
      arr.push(s);
    } else if (s.topic) {
      const norm = s.topic.trim().toLowerCase();
      if (norm) {
        let arr = unlinkedByNormTopic.get(norm);
        if (!arr) {
          arr = [];
          unlinkedByNormTopic.set(norm, arr);
        }
        arr.push(s);
      }
    }
  }

  return {
    sessionsRef: sessions,
    sessionsLen: sessions.length,
    byTaskId,
    unlinkedByNormTopic,
    computedByTaskKey: new Map()
  };
}

export function getTaskSessionStats(state, taskOrId, sessionIndex = null) {
  const task = typeof taskOrId === 'string'
    ? (state.tasks || []).find((t) => t.id === taskOrId)
    : taskOrId;
  if (!task) {
    return { sessionCount: 0, totalSec: 0, totalMins: 0, sessions: [] };
  }

  const index = sessionIndex || buildSessionTaskIndex(state.sessions || []);
  const normTitle = (task.title || '').trim().toLowerCase();
  const cacheKey = `${task.id}|${task.parentRecurringId ? '1' : '0'}|${normTitle}`;

  let aggregated = index.computedByTaskKey.get(cacheKey);
  if (!aggregated) {
    const byId = index.byTaskId.get(task.id) || [];
    const byTopic = (!task.parentRecurringId && normTitle)
      ? (index.unlinkedByNormTopic.get(normTitle) || [])
      : [];
    const linked = byTopic.length === 0
      ? byId
      : (byId.length === 0 ? byTopic : [...byId, ...byTopic]);

    const logicalIds = new Set();
    let sumSessionsSec = 0;
    for (let i = 0; i < linked.length; i++) {
      const s = linked[i];
      logicalIds.add(String(s.id || '').replace(/-m\d+$/, ''));
      sumSessionsSec += (s.durationSec || 0);
    }

    aggregated = {
      linked,
      logicalCount: logicalIds.size,
      sumSessionsSec
    };
    index.computedByTaskKey.set(cacheKey, aggregated);
  }

  const totalSec = Math.max(task.timeSpentSec || 0, aggregated.sumSessionsSec);
  const totalMins = Math.round(totalSec / 60);
  const sessionCount = aggregated.linked.length > 0 ? aggregated.logicalCount : (totalMins > 0 ? 1 : 0);

  return {
    sessionCount,
    totalSec,
    totalMins,
    sessions: aggregated.linked
  };
}

export function getSubjectStats(state, subjectName) {
  const tasks = (state.tasks || []).filter((t) => t.subject === subjectName);
  const sessions = (state.sessions || []).filter((s) => s.subject === subjectName);

  const totalSeconds = sessions.reduce((acc, s) => acc + (s.durationSec || 0), 0);
  const pendingTasks = tasks.filter((t) => !t.completed).length;
  const completedTasks = tasks.filter((t) => t.completed).length;

  const startOfWeek = getMondayOfDate(new Date());
  const thisWeekSeconds = sessions
    .filter((s) => new Date(s.endTime || s.createdAt) >= startOfWeek)
    .reduce((acc, s) => acc + (s.durationSec || 0), 0);

  return {
    totalMinutes: Math.round(totalSeconds / 60),
    thisWeekHours: (thisWeekSeconds / 3600).toFixed(1),
    pendingTasks,
    completedTasks,
    totalTasks: tasks.length
  };
}

export function getAnalyticsData(state, options = {}) {
  const weekOffset = Number.isFinite(options.weekOffset) ? options.weekOffset : 0;
  const subjectScope = options.subjectScope === 'all' ? 'all' : 'week';

  const sessions = (state && state.sessions) || [];
  const tasks = (state && state.tasks) || [];
  const subjects = (state && state.subjects) || [];

  let totalSec = 0;
  sessions.forEach((s) => {
    totalSec += (s.durationSec || 0);
  });

  const now = new Date();
  const currentMon = getMondayOfDate(now);

  const mon = new Date(currentMon);
  mon.setDate(currentMon.getDate() + weekOffset * 7);
  mon.setHours(0, 0, 0, 0);

  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);

  const monTime = mon.getTime();
  const sunTime = sun.getTime();

  const prevMon = new Date(mon);
  prevMon.setDate(mon.getDate() - 7);
  const prevSun = new Date(mon);
  prevSun.setDate(mon.getDate() - 1);
  prevSun.setHours(23, 59, 59, 999);
  const prevMonTime = prevMon.getTime();
  const prevSunTime = prevSun.getTime();

  let weekSec = 0;
  let prevWeekSec = 0;
  let weekSessionsCount = 0;
  const activeDaysSet = new Set();

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const todayStr = toLocalDateStr(now);
  const dailyTrend = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    const dStr = toLocalDateStr(d);
    dailyTrend.push({
      dayIndex: (i + 1) % 7,
      label: dayLabels[i],
      dateStr: dStr,
      durationSec: 0,
      durationMins: 0,
      sessionCount: 0,
      isToday: dStr === todayStr
    });
  }

  const weeklyBuckets = new Map();
  const ensureWeekBucket = (mondayDate) => {
    const mStr = toLocalDateStr(mondayDate);
    if (!weeklyBuckets.has(mStr)) {
      const offset = Math.round((mondayDate.getTime() - currentMon.getTime()) / (7 * 86400000));
      const sDate = new Date(mondayDate);
      sDate.setDate(mondayDate.getDate() + 6);
      const shortOpt = { month: 'short', day: 'numeric' };
      weeklyBuckets.set(mStr, {
        mondayStr: mStr,
        sundayStr: toLocalDateStr(sDate),
        label: `${mondayDate.toLocaleDateString(undefined, shortOpt)} – ${sDate.toLocaleDateString(undefined, shortOpt)}`,
        shortLabel: mondayDate.toLocaleDateString(undefined, shortOpt),
        weekOffset: offset,
        durationSec: 0,
        sessionCount: 0,
        activeDays: new Set(),
        subjectTotals: {}
      });
    }
    return weeklyBuckets.get(mStr);
  };

  for (let w = -7; w <= 0; w++) {
    const d = new Date(currentMon);
    d.setDate(currentMon.getDate() + w * 7);
    ensureWeekBucket(d);
  }
  ensureWeekBucket(mon);

  const subjectStatsMap = {};
  const ensureSubjectStat = (subName) => {
    if (!subjectStatsMap[subName]) {
      subjectStatsMap[subName] = {
        durationSec: 0,
        sessionCount: 0,
        lastStudiedTs: 0,
        dailySecs: [0, 0, 0, 0, 0, 0, 0]
      };
    }
    return subjectStatsMap[subName];
  };

  sessions.forEach((s) => {
    const d = s.startTime ? new Date(s.startTime) : new Date(s.createdAt);
    const t = d.getTime();
    const dur = s.durationSec || 0;
    const dStr = toLocalDateStr(d);
    const subName = s.subject || 'General / Other';

    const sMon = getMondayOfDate(d);
    const bucket = ensureWeekBucket(sMon);
    bucket.durationSec += dur;
    bucket.sessionCount += 1;
    bucket.activeDays.add(dStr);
    bucket.subjectTotals[subName] = (bucket.subjectTotals[subName] || 0) + dur;

    const inSelectedWeek = t >= monTime && t <= sunTime;
    if (inSelectedWeek) {
      weekSec += dur;
      weekSessionsCount += 1;
      activeDaysSet.add(dStr);

      const trendDay = dailyTrend.find((td) => td.dateStr === dStr);
      if (trendDay) {
        trendDay.durationSec += dur;
        trendDay.durationMins = Math.round(trendDay.durationSec / 60);
        trendDay.sessionCount += 1;
      }
    }

    if (t >= prevMonTime && t <= prevSunTime) {
      prevWeekSec += dur;
    }

    if (subjectScope === 'all' || inSelectedWeek) {
      const stat = ensureSubjectStat(subName);
      stat.durationSec += dur;
      stat.sessionCount += 1;
      if (t > stat.lastStudiedTs) stat.lastStudiedTs = t;
      if (inSelectedWeek) {
        const idx = (d.getDay() + 6) % 7;
        stat.dailySecs[idx] += dur;
      }
    }
  });

  const scopeTotalSec = Object.values(subjectStatsMap).reduce((acc, st) => acc + st.durationSec, 0);

  const subjectBreakdown = Object.entries(subjectStatsMap).map(([name, st]) => {
    const subObj = subjects.find((s) => s.name === name || s.code === name);
    const color = subObj ? subObj.color : '#64748b';
    const weeklyGoalHours = subObj && subObj.targetWeeklyHours ? Number(subObj.targetWeeklyHours) : 0;
    const percentage = scopeTotalSec > 0 ? Math.round((st.durationSec / scopeTotalSec) * 100) : 0;
    const durationMins = Math.round(st.durationSec / 60);
    const avgSessionMins = st.sessionCount > 0 ? Math.round(durationMins / st.sessionCount) : 0;
    const goalPct = (subjectScope === 'week' && weeklyGoalHours > 0)
      ? Math.min(100, Math.round(((st.durationSec / 3600) / weeklyGoalHours) * 100))
      : null;
    return {
      name,
      code: subObj ? (subObj.code || '') : '',
      group: subObj ? (subObj.group || 'General') : 'General',
      color,
      weeklyGoalHours,
      durationSec: st.durationSec,
      durationMins,
      durationHours: (st.durationSec / 3600).toFixed(1),
      formattedTime: formatDurationHM(st.durationSec),
      sessionCount: st.sessionCount,
      avgSessionMins,
      percentage,
      goalPct,
      lastStudiedStr: st.lastStudiedTs ? toLocalDateStr(new Date(st.lastStudiedTs)) : null,
      dailyMins: st.dailySecs.map((sec) => Math.round(sec / 60))
    };
  }).sort((a, b) => b.durationSec - a.durationSec);

  const weeklyHistory = Array.from(weeklyBuckets.values())
    .sort((a, b) => a.mondayStr.localeCompare(b.mondayStr))
    .map((b) => ({
      mondayStr: b.mondayStr,
      sundayStr: b.sundayStr,
      label: b.label,
      shortLabel: b.shortLabel,
      weekOffset: b.weekOffset,
      durationSec: b.durationSec,
      durationMins: Math.round(b.durationSec / 60),
      durationHours: Number((b.durationSec / 3600).toFixed(1)),
      formattedTime: formatDurationHM(b.durationSec),
      sessionCount: b.sessionCount,
      activeDaysCount: b.activeDays.size,
      isCurrentWeek: b.weekOffset === 0,
      isSelected: b.weekOffset === weekOffset,
      subjectTotals: b.subjectTotals
    }));

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.completed).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const shortOpt = { month: 'short', day: 'numeric' };
  const selectedWeekLabel = weekOffset === 0
    ? `This Week (${mon.toLocaleDateString(undefined, shortOpt)} – ${sun.toLocaleDateString(undefined, shortOpt)})`
    : weekOffset === -1
      ? `Last Week (${mon.toLocaleDateString(undefined, shortOpt)} – ${sun.toLocaleDateString(undefined, shortOpt)})`
      : `${mon.toLocaleDateString(undefined, shortOpt)} – ${sun.toLocaleDateString(undefined, { ...shortOpt, year: 'numeric' })}`;

  return {
    weekOffset,
    subjectScope,
    selectedWeekLabel,
    selectedWeekRange: `${mon.toLocaleDateString(undefined, shortOpt)} – ${sun.toLocaleDateString(undefined, { ...shortOpt, year: 'numeric' })}`,
    totalSec,
    totalSessions: sessions.length,
    weekSec,
    prevWeekSec,
    weekSessionsCount,
    activeDaysCount: activeDaysSet.size,
    totalTasks,
    completedTasks,
    completionRate,
    dailyTrend,
    subjectBreakdown,
    weeklyHistory
  };
}
