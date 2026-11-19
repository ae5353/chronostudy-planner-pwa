// @ts-check
// src/domain/sync-merge.js — 3-way cloud merge engine & tombstone compaction
import { LEGACY_SEED_TASK_IDS } from './presets.js';
import { reconcileTasksAndSessions } from './reconcile.js';

export const PRESERVED_SESSION_TOMBSTONE_IDS = ['sess-eef211-1'];

export function compactTombstones(state, { maxAgeDays = 90, now = Date.now() } = {}) {
  if (!state || typeof state !== 'object') return 0;
  const cutoffMs = now - Math.max(1, maxAgeDays) * 86400000;
  const preservedTaskSet = new Set(LEGACY_SEED_TASK_IDS);
  const preservedSessionSet = new Set(PRESERVED_SESSION_TOMBSTONE_IDS);

  const pruneMap = (mapObj, protectedSet = null) => {
    if (!mapObj || typeof mapObj !== 'object') return 0;
    let removed = 0;
    for (const [id, delIso] of Object.entries(mapObj)) {
      if (protectedSet && protectedSet.has(id)) continue;
      const delMs = new Date(delIso || 0).getTime();
      if (!Number.isNaN(delMs) && delMs > 0 && delMs < cutoffMs) {
        delete mapObj[id];
        removed++;
      }
    }
    return removed;
  };

  let totalRemoved = 0;
  totalRemoved += pruneMap(state.deletedTaskIds, preservedTaskSet);
  totalRemoved += pruneMap(state.deletedSessionIds, preservedSessionSet);
  totalRemoved += pruneMap(state.deletedSubjectIds);
  totalRemoved += pruneMap(state.deletedWeeklyEventIds);
  totalRemoved += pruneMap(state.deletedGroups);
  return totalRemoved;
}

export function mergeRemoteState(state, remote) {
  if (!remote || typeof remote !== 'object') {
    return { success: false, error: 'Invalid remote sync payload' };
  }

  let changesCount = 0;
  let addedTasks = 0;
  let addedSessions = 0;
  const nowIso = new Date().toISOString();

  // 1. Additive Merge for Study Sessions with Tombstone Protection
  if (!state.deletedSessionIds) state.deletedSessionIds = {};
  if (remote.deletedSessionIds && typeof remote.deletedSessionIds === 'object') {
    Object.entries(remote.deletedSessionIds).forEach(([delId, delTime]) => {
      const existing = state.deletedSessionIds[delId];
      if (!existing || new Date(delTime) > new Date(existing)) {
        state.deletedSessionIds[delId] = delTime;
      }
    });
  }
  const prevSessLen = state.sessions.length;
  state.sessions = state.sessions.filter((s) => !state.deletedSessionIds[s.id]);
  if (state.sessions.length !== prevSessLen) changesCount++;

  if (Array.isArray(remote.sessions)) {
    const localSessionMap = new Map(state.sessions.map((s) => [s.id, s]));
    remote.sessions.forEach((remoteSess) => {
      if (state.deletedSessionIds[remoteSess.id]) return;
      const localSess = localSessionMap.get(remoteSess.id);
      if (!localSess) {
        const cloned = { ...remoteSess, synced: true };
        state.sessions.push(cloned);
        localSessionMap.set(remoteSess.id, cloned);
        changesCount++;
        addedSessions++;
      } else {
        const remoteUpdated = new Date(remoteSess.updatedAt || remoteSess.createdAt || 0).getTime();
        const localUpdated = new Date(localSess.updatedAt || localSess.createdAt || 0).getTime();
        if (remoteUpdated > localUpdated) {
          Object.assign(localSess, remoteSess, { synced: true });
          changesCount++;
        }
      }
    });
    state.sessions.sort((a, b) => new Date(b.startTime || b.date || 0) - new Date(a.startTime || a.date || 0));
  }

  // 2. Merge Deleted Task Tombstones
  if (!state.deletedTaskIds) state.deletedTaskIds = {};
  if (remote.deletedTaskIds && typeof remote.deletedTaskIds === 'object') {
    Object.entries(remote.deletedTaskIds).forEach(([delId, delTime]) => {
      const existingDel = state.deletedTaskIds[delId];
      if (!existingDel || new Date(delTime) > new Date(existingDel)) {
        state.deletedTaskIds[delId] = delTime;
      }
    });
  }

  state.tasks = state.tasks.filter((t) => {
    const delTime = state.deletedTaskIds[t.id];
    if (delTime) {
      const taskUpdated = new Date(t.updatedAt || t.createdAt || 0).getTime();
      if (new Date(delTime).getTime() >= taskUpdated) {
        changesCount++;
        return false;
      }
    }
    return true;
  });

  // 3. Last-Write-Wins Merge for Tasks
  if (Array.isArray(remote.tasks)) {
    const localTaskMap = new Map(state.tasks.map((t) => [t.id, t]));
    remote.tasks.forEach((remoteTask) => {
      const delTime = state.deletedTaskIds[remoteTask.id];
      if (delTime) {
        const remoteUpdated = new Date(remoteTask.updatedAt || remoteTask.createdAt || 0).getTime();
        if (new Date(delTime).getTime() >= remoteUpdated) {
          return;
        }
      }
      if (remoteTask.deletedAt) {
        state.deletedTaskIds[remoteTask.id] = remoteTask.deletedAt;
        return;
      }

      const localTask = localTaskMap.get(remoteTask.id);
      if (!localTask) {
        state.tasks.unshift({ ...remoteTask, synced: true });
        changesCount++;
        addedTasks++;
      } else {
        const remoteUpdated = new Date(remoteTask.updatedAt || remoteTask.createdAt || 0).getTime();
        const localUpdated = new Date(localTask.updatedAt || localTask.createdAt || 0).getTime();
        const mergedCompletedDates = { ...(localTask.completedDates || {}), ...(remoteTask.completedDates || {}) };

        let finalCompleted = localTask.completed;
        let finalCompletedAt = localTask.completedAt || null;
        let completionChanged = false;

        if (localTask.completed !== remoteTask.completed) {
          const completedSide = localTask.completed ? localTask : remoteTask;
          const uncompletedSide = localTask.completed ? remoteTask : localTask;
          const compMs = new Date(completedSide.completedAt || completedSide.updatedAt || 0).getTime();
          const uncompCheckMs = uncompletedSide.uncheckedAt ? new Date(uncompletedSide.uncheckedAt).getTime() : 0;

          if (!uncompletedSide.autoGenerated && uncompCheckMs > compMs) {
            finalCompleted = false;
            finalCompletedAt = null;
            if (uncompletedSide.dueDate) delete mergedCompletedDates[uncompletedSide.dueDate];
          } else {
            finalCompleted = true;
            finalCompletedAt = completedSide.completedAt || completedSide.updatedAt || nowIso;
          }
          if (finalCompleted !== localTask.completed) completionChanged = true;
        }

        if (remoteUpdated > localUpdated || (localTask.autoGenerated && !remoteTask.autoGenerated)) {
          Object.assign(localTask, remoteTask, { synced: true });
          changesCount++;
        } else if (completionChanged) {
          changesCount++;
        }

        localTask.completedDates = mergedCompletedDates;
        localTask.completed = finalCompleted;
        localTask.completedAt = finalCompletedAt;
      }
    });
  }

  // 4. Merge Subjects with Tombstone Protection
  if (!state.deletedSubjectIds) state.deletedSubjectIds = {};
  if (remote.deletedSubjectIds && typeof remote.deletedSubjectIds === 'object') {
    Object.entries(remote.deletedSubjectIds).forEach(([delId, delTime]) => {
      const existing = state.deletedSubjectIds[delId];
      if (!existing || new Date(delTime) > new Date(existing)) {
        state.deletedSubjectIds[delId] = delTime;
      }
    });
  }
  state.subjects = state.subjects.filter((s) => !state.deletedSubjectIds[s.id]);

  if (Array.isArray(remote.subjects)) {
    const localSubMap = new Map(state.subjects.map((s) => [s.id, s]));
    remote.subjects.forEach((remoteSub) => {
      if (state.deletedSubjectIds[remoteSub.id]) return;
      const localSub = localSubMap.get(remoteSub.id);
      if (!localSub) {
        if (!remoteSub.deletedAt) {
          state.subjects.push({ ...remoteSub });
          changesCount++;
        }
      } else {
        const remoteUpdated = new Date(remoteSub.updatedAt || 0).getTime();
        const localUpdated = new Date(localSub.updatedAt || 0).getTime();
        if (remoteUpdated > localUpdated) {
          if (remoteSub.deletedAt) {
            state.subjects = state.subjects.filter((s) => s.id !== remoteSub.id);
          } else {
            Object.assign(localSub, remoteSub);
          }
          changesCount++;
        }
      }
    });
  }

  // 5. Merge Weekly Events with Tombstone Protection
  if (!state.deletedWeeklyEventIds) state.deletedWeeklyEventIds = {};
  if (remote.deletedWeeklyEventIds && typeof remote.deletedWeeklyEventIds === 'object') {
    Object.entries(remote.deletedWeeklyEventIds).forEach(([delId, delTime]) => {
      const existing = state.deletedWeeklyEventIds[delId];
      if (!existing || new Date(delTime) > new Date(existing)) {
        state.deletedWeeklyEventIds[delId] = delTime;
      }
    });
  }
  state.weeklyEvents = state.weeklyEvents.filter((e) => !state.deletedWeeklyEventIds[e.id]);

  if (Array.isArray(remote.weeklyEvents)) {
    const localEvMap = new Map(state.weeklyEvents.map((e) => [e.id, e]));
    remote.weeklyEvents.forEach((remoteEv) => {
      if (state.deletedWeeklyEventIds[remoteEv.id]) return;
      const localEv = localEvMap.get(remoteEv.id);
      if (!localEv) {
        if (!remoteEv.deletedAt) {
          state.weeklyEvents.push({ ...remoteEv });
          changesCount++;
        }
      } else {
        const remoteUpdated = new Date(remoteEv.updatedAt || 0).getTime();
        const localUpdated = new Date(localEv.updatedAt || 0).getTime();
        if (remoteUpdated > localUpdated) {
          if (remoteEv.deletedAt) {
            state.weeklyEvents = state.weeklyEvents.filter((e) => e.id !== remoteEv.id);
          } else {
            Object.assign(localEv, remoteEv);
          }
          changesCount++;
        }
      }
    });
  }

  // 6. Merge Groups with Tombstone Protection
  if (!state.deletedGroups) state.deletedGroups = {};
  if (remote.deletedGroups && typeof remote.deletedGroups === 'object') {
    Object.entries(remote.deletedGroups).forEach(([delGrp, delTime]) => {
      const existing = state.deletedGroups[delGrp];
      if (!existing || new Date(delTime) > new Date(existing)) {
        state.deletedGroups[delGrp] = delTime;
      }
    });
  }
  state.groups = state.groups.filter((g) => !state.deletedGroups[g]);

  if (Array.isArray(remote.groups)) {
    remote.groups.forEach((g) => {
      if (state.deletedGroups[g]) return;
      if (!state.groups.includes(g)) {
        state.groups.push(g);
        changesCount++;
      }
    });
  }

  // 7. Merge Settings (preserve device-local preferences)
  if (remote.settings && typeof remote.settings === 'object') {
    const remoteSettingsUpdated = remote.settings.updatedAt ? new Date(remote.settings.updatedAt).getTime() : 0;
    const localSettingsUpdated = (state.settings && state.settings.updatedAt)
      ? new Date(state.settings.updatedAt).getTime()
      : 0;
    const hasLocalPending = Boolean(state.sync && state.sync.hasChanges);

    if (remoteSettingsUpdated > localSettingsUpdated || (localSettingsUpdated === 0 && !hasLocalPending)) {
      const { layoutFormat: _lf, volume: _vol, ambientSound: _amb, ...remoteSyncableSettings } = remote.settings;
      const mergedSettings = {
        ...state.settings,
        ...remoteSyncableSettings,
        layoutFormat: state.settings.layoutFormat,
        volume: state.settings.volume,
        ambientSound: state.settings.ambientSound
      };
      if (JSON.stringify(mergedSettings) !== JSON.stringify(state.settings)) {
        changesCount++;
      }
      state.settings = mergedSettings;
    }
  }

  if (reconcileTasksAndSessions(state)) {
    changesCount++;
  }

  return { success: true, changesCount, addedTasks, addedSessions };
}
