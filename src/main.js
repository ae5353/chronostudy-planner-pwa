import {
  store,
  getTodayISO,
  daysUntil,
  parseSmartTaskInput,
  detectScheduleConflicts,
  calculateRequiredExamScore,
  calculateGoalPace
} from './store.js';
import { soundEngine } from './audio.js';
import {
  loadSyncConfig,
  saveSyncConfig,
  pushToGitHubGist,
  pullFromGitHubGist,
  pushToSyncServer,
  pullFromSyncServer,
  createShareableSyncLink,
  checkUrlSyncSnapshot
} from './cloud-sync.js';
import {
  parseICSCalendar,
  parseScheduleText,
  buildGoogleCalendarUrl
} from './calendar-sync.js';
import {
  buildReport,
  reportToCSV,
  reportToXLSX,
  postReportToAppsScript,
  downloadBlob
} from './reports.js';
import { makeSession, computeStreaks } from './log.js';

let timerInterval = null;
let revealedCardId = null;
let wakeLockSentinel = null;

function formatTimeMMSS(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function escapeHTML(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getSubject(subjectId) {
  return (
    store.state.subjects.find((s) => s.id === subjectId) ||
    store.state.subjects[0] || {
      id: 'default',
      name: 'General Focus',
      code: 'GEN',
      category: 'General',
      color: '#C85A32'
    }
  );
}

export function showToast(message) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = 'toast-item';
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => {
    el.remove();
  }, 3200);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.getElementById('meta-theme-color');
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#161412' : '#FAF7F2');
  }
}

// Mobile Screen WakeLock & MediaSession API Integration
async function syncMobileWakeLock(isRunning) {
  if (typeof navigator === 'undefined') return;
  try {
    if (isRunning && 'wakeLock' in navigator && !wakeLockSentinel) {
      wakeLockSentinel = await navigator.wakeLock.request('screen');
    } else if (!isRunning && wakeLockSentinel) {
      await wakeLockSentinel.release();
      wakeLockSentinel = null;
    }
  } catch (_) {}

  try {
    if ('mediaSession' in navigator) {
      const fs = store.state.focusSession;
      const subj = getSubject(fs.linkedSubjectId);
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `ChronoStudy Focus (${formatTimeMMSS(fs.remainingSeconds)})`,
        artist: subj.name,
        album: 'ChronoStudy Deep Focus Studio'
      });
      navigator.mediaSession.playbackState = isRunning ? 'playing' : 'paused';
    }
  } catch (_) {}
}

// Focus Timer Loop
function syncTimerLoop() {
  syncMobileWakeLock(store.state.focusSession.isRunning);
  if (store.state.focusSession.isRunning && !timerInterval) {
    timerInterval = setInterval(() => {
      const fs = store.state.focusSession;
      if (!fs.isRunning) return;
      if (fs.remainingSeconds > 1) {
        store.update((s) => {
          s.focusSession.remainingSeconds -= 1;
        });
      } else {
        soundEngine.playChime();
        const minutesCompleted = Math.max(1, Math.round(fs.durationSeconds / 60));
        store.update((s) => {
          s.focusSession.isRunning = false;
          s.focusSession.remainingSeconds = s.focusSession.durationSeconds;
          if (s.focusSession.mode !== 'break') {
            s.stats.totalFocusMinutes += minutesCompleted;
            s.stats.todayFocusMinutes += minutesCompleted;
            s.stats.completedPomodoros += 1;
            const task = s.tasks.find((t) => t.id === s.focusSession.linkedTaskId);
            if (task) task.completedPomodoros = (task.completedPomodoros || 0) + 1;
            const subj = s.subjects.find((sub) => sub.id === s.focusSession.linkedSubjectId);
            if (subj) subj.loggedMinutes = (subj.loggedMinutes || 0) + minutesCompleted;
          }
        });
        showToast(`Focus session complete! +${minutesCompleted}m logged.`);
      }
    }, 1000);
  } else if (!store.state.focusSession.isRunning && timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// Render Shell Navigation (Sidebar + TopBar + Mobile 6-Tab Bottom Nav)
function renderNavigation() {
  const s = store.state;
  const openTasksCount = s.tasks.filter((t) => !t.completed).length;
  const dueCardsCount = s.flashcards.filter((c) => c.dueDate <= getTodayISO()).length;

  const navItems = [
    { id: 'today', label: 'Today Hub', badge: null, icon: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>` },
    { id: 'tasks', label: 'Tasks & Matrix', badge: openTasksCount, icon: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>` },
    { id: 'program', label: 'Weekly Routine', badge: '7d', icon: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>` },
    { id: 'study', label: 'Knowledge & Notes', badge: dueCardsCount || null, icon: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>` },
    { id: 'focus', label: 'Focus Studio', badge: s.focusSession.isRunning ? 'LIVE' : null, icon: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>` },
    { id: 'analytics', label: 'Goals & Insights', badge: null, icon: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>` }
  ];

  const sidebar = document.getElementById('sidebar-nav');
  if (sidebar) {
    sidebar.innerHTML = `
      <div class="brand-row">
        <div class="brand-mark">CS</div>
        <div>
          <div class="brand-title">ChronoStudy</div>
          <div class="brand-subtitle">v3.0 · Life, Study & Time Suite</div>
        </div>
      </div>

      <ul class="nav-list">
        ${navItems
          .map(
            (item) => `
          <li>
            <button class="nav-btn ${s.activeTab === item.id ? 'active' : ''}" data-nav="${item.id}" id="nav-sidebar-${item.id}">
              <span class="nav-btn-left">${item.icon} <span>${item.label}</span></span>
              ${item.badge !== null ? `<span class="nav-badge">${item.badge}</span>` : ''}
            </button>
          </li>
        `
          )
          .join('')}
      </ul>

      <div style="margin-top: 4px;">
        <div style="display:flex; align-items:center; justify-content:space-between; padding: 0 8px 6px;">
          <span class="metric-label">Active Life & Study Tracks</span>
          <button class="btn-ghost" style="font-size:0.75rem; padding:2px 6px;" data-action="open-subject-modal" title="Add New Track or Goal">+ Add</button>
        </div>
        <div style="display:flex; flex-direction:column; gap:5px;">
          ${s.subjects
            .map((sub) => {
              const d = daysUntil(sub.examDate);
              return `
              <div style="display:flex; align-items:center; justify-content:space-between; padding:6px 10px; border-radius:8px; background:var(--bg-elevated); font-size:0.79rem;">
                <span style="display:flex; align-items:center; gap:7px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                  <span class="subject-dot" style="background:${sub.color}"></span>
                  ${escapeHTML(sub.name)}
                </span>
                <span style="font-family:var(--font-mono); font-size:0.73rem; color:var(--text-muted); flex-shrink:0;">${d >= 0 ? `${d}d` : 'Done'}</span>
              </div>
            `;
            })
            .join('')}
        </div>
      </div>

      <div class="mini-focus-card">
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <span class="metric-label">Focus Timer</span>
          <span class="badge ${s.focusSession.isRunning ? 'badge-q1' : 'badge-q4'}">${s.focusSession.isRunning ? 'Running' : 'Ready'}</span>
        </div>
        <div class="mini-focus-time">${formatTimeMMSS(s.focusSession.remainingSeconds)}</div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-primary btn-sm" style="flex:1;" data-action="toggle-timer" id="sidebar-timer-toggle">
            ${s.focusSession.isRunning ? 'Pause' : 'Start'}
          </button>
          <button class="btn btn-secondary btn-sm" data-nav="focus" id="sidebar-open-studio">Studio</button>
        </div>
      </div>
    `;
  }

  const topBar = document.getElementById('top-bar');
  if (topBar) {
    const dateFormatted = new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
    const syncCfg = loadSyncConfig();
    topBar.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
        <span style="font-weight:700; font-size:0.93rem;">${dateFormatted}</span>
        <span class="badge badge-q2" title="Current Daily Consistency Streak">Streak: ${s.stats.currentStreakDays}d</span>
        <span class="badge badge-q4" style="font-family:var(--font-mono);">${s.stats.todayFocusMinutes}m focused</span>
      </div>
      <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
        <button class="btn btn-primary btn-sm" data-action="open-calendar-modal" id="btn-open-calendar-sync" title="Import/Export Google Calendar, Apple Calendar & Activity Schedules">
          📅 Google Calendar & Schedule Sync
        </button>
        <button class="btn btn-secondary btn-sm" data-action="open-backup-modal" id="btn-open-backup">
          ${syncCfg.gistId ? '🟢 Cloud Sync' : '☁️ PC ↔ Mobile Sync'}
        </button>
        <button class="icon-btn" data-action="toggle-theme" id="btn-toggle-theme" title="Toggle Light/Dark Mode" aria-label="Toggle Theme">
          ${s.theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    `;
  }

  const bottomNav = document.getElementById('bottom-nav');
  if (bottomNav) {
    bottomNav.innerHTML = navItems
      .map(
        (item) => `
      <button class="bottom-nav-btn ${s.activeTab === item.id ? 'active' : ''}" data-nav="${item.id}" id="nav-mobile-${item.id}">
        ${item.icon}
        <span>${item.label.split(' ')[0]}</span>
      </button>
    `
      )
      .join('');
  }
}

// VIEW 1: TODAY HUB (Universal Daily Command Center + Google Calendar Links + Smart Auto-Scheduler)
function renderTodayView() {
  const s = store.state;
  const today = getTodayISO();
  const todayBlocks = s.scheduleBlocks
    .filter((b) => b.date === s.selectedDate)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const conflictIds = detectScheduleConflicts(todayBlocks);
  const priorityTasks = s.tasks.filter((t) => !t.completed).slice(0, 5);
  const dueCards = s.flashcards.filter((c) => c.dueDate <= today);
  const completedTasksCount = s.tasks.filter((t) => t.completed).length;
  const nearestDays = s.subjects.length
    ? Math.min(...s.subjects.map((sub) => Math.max(0, daysUntil(sub.examDate))))
    : 0;

  return `
    <section aria-labelledby="heading-today">
      <div class="page-header">
        <div>
          <h1 class="page-title" id="heading-today">Daily Command Center</h1>
          <p class="page-subtitle">Unified daily time-blocking, self-directed study, work projects, fitness, and Google Calendar sync.</p>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
          <input type="date" class="input-pill" id="today-date-picker" value="${s.selectedDate}" aria-label="Selected Schedule Date" />
          <button class="btn btn-secondary btn-sm" data-action="smart-auto-schedule" id="btn-smart-schedule" title="Automatically schedule top Q1/Q2 tasks into open time gaps">
            ⚡ Auto-Fill Free Gaps
          </button>
          <button class="btn btn-primary btn-sm" data-action="open-block-modal" id="btn-add-timeblock">+ Time Block</button>
        </div>
      </div>

      <!-- Smart Natural-Language Quick Capture Bar -->
      <form class="quick-capture-bar" id="quick-task-form">
        <input
          type="text"
          class="quick-capture-input"
          id="quick-task-title"
          placeholder="Quick Capture: e.g. 'Practice Spanish conversation #PSYC-210 !Q1 ~2p @tomorrow' or any task..."
          required
        />
        <div class="quick-capture-controls">
          <select class="select-pill" id="quick-task-subject" aria-label="Focus Track">
            ${s.subjects.map((sub) => `<option value="${sub.id}">${escapeHTML(sub.code)} · ${escapeHTML(sub.name)}</option>`).join('')}
          </select>
          <select class="select-pill" id="quick-task-quadrant" aria-label="Eisenhower Priority">
            <option value="Q1">Q1 · Urgent & Important</option>
            <option value="Q2" selected>Q2 · Deep Focus / Core Goal</option>
            <option value="Q3">Q3 · Quick Task / Errand</option>
            <option value="Q4">Q4 · Someday / Idea</option>
          </select>
          <button type="submit" class="btn btn-primary btn-sm" id="btn-quick-add-submit">Add Task</button>
        </div>
      </form>

      <!-- Metric Strip -->
      <div class="metric-strip">
        <div class="metric-tile">
          <span class="metric-label">Deep Focus Today</span>
          <span class="metric-value">${s.stats.todayFocusMinutes}m</span>
          <span class="metric-sub">${s.stats.completedPomodoros} sessions completed</span>
        </div>
        <div class="metric-tile">
          <span class="metric-label">Action Items</span>
          <span class="metric-value">${completedTasksCount}/${s.tasks.length}</span>
          <span class="metric-sub">${s.tasks.filter((t) => !t.completed && t.quadrant === 'Q1').length} Q1 priority open</span>
        </div>
        <div class="metric-tile">
          <span class="metric-label">Recall Queue (SM-2)</span>
          <span class="metric-value">${dueCards.length}</span>
          <span class="metric-sub">${s.cornellNotes.length} synthesis notes saved</span>
        </div>
        <div class="metric-tile">
          <span class="metric-label">Next Milestone</span>
          <span class="metric-value">${nearestDays}d</span>
          <span class="metric-sub">${s.subjects.length} active life/study tracks</span>
        </div>
      </div>

      <!-- Two-Column Workspace -->
      <div class="grid-2">
        <!-- Left: Time-Blocked Schedule with Google Calendar Deep Links & Quick Shift -->
        <div class="surface-card">
          <div class="card-header">
            <h2 class="card-title">
              <span>Day Timeline (${s.selectedDate})</span>
              ${conflictIds.size > 0 ? `<span class="badge badge-q1">${conflictIds.size} Overlap</span>` : ''}
            </h2>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <button class="btn btn-secondary btn-sm" data-action="apply-today-template" id="btn-apply-template" title="Populate from Weekly Routine">
                Load Routine
              </button>
              <button class="btn btn-secondary btn-sm" data-action="open-calendar-modal" title="Import from Google Calendar or Paste Schedule">
                Import Schedule
              </button>
            </div>
          </div>

          <div class="timeline-container">
            ${
              todayBlocks.length === 0
                ? `<p style="color:var(--text-muted); font-size:0.88rem; padding:16px 0;">No blocks scheduled for this date. Tap <strong>Load Routine</strong>, <strong>⚡ Auto-Fill Free Gaps</strong>, or <strong>Import Schedule</strong>.</p>`
                : todayBlocks
                    .map((blk) => {
                      const subj = getSubject(blk.subjectId);
                      const isConflict = conflictIds.has(blk.id);
                      const gcalUrl = buildGoogleCalendarUrl({
                        title: blk.title,
                        date: blk.date,
                        startTime: blk.startTime,
                        endTime: blk.endTime,
                        details: `Track: ${subj.name} (${subj.code})`
                      });
                      return `
                      <div class="time-block-row">
                        <div class="time-slot-label">${blk.startTime}<br/><span style="font-size:0.75rem; opacity:0.75;">${blk.endTime}</span></div>
                        <div class="time-block-card ${isConflict ? 'conflict' : ''}" style="border-left-color:${subj.color}; ${blk.done ? 'opacity:0.58;' : ''}">
                          <div style="min-width:0; flex:1;">
                            <div style="font-weight:600; font-size:0.9rem; ${blk.done ? 'text-decoration:line-through;' : ''}">${escapeHTML(blk.title)}</div>
                            <div style="display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin-top:5px;">
                              <span class="subject-tag"><span class="subject-dot" style="background:${subj.color}"></span>${escapeHTML(subj.name)}</span>
                              ${blk.autoScheduled ? `<span class="badge badge-sage">Auto-Scheduled</span>` : ''}
                              ${isConflict ? `<span class="badge badge-q1">Overlap</span>` : ''}
                              <a href="${gcalUrl}" target="_blank" rel="noopener noreferrer" class="badge badge-q4" style="text-decoration:none;" title="Add this block directly to Google Calendar">📅 +GCal</a>
                            </div>
                          </div>
                          <div style="display:flex; align-items:center; gap:4px; flex-shrink:0;">
                            <button class="btn-ghost btn-sm" style="font-family:var(--font-mono); font-size:0.72rem; padding:3px 5px;" data-action="shift-block" data-id="${blk.id}" data-delta="-15" title="Shift 15m earlier">-15m</button>
                            <button class="btn-ghost btn-sm" style="font-family:var(--font-mono); font-size:0.72rem; padding:3px 5px;" data-action="shift-block" data-id="${blk.id}" data-delta="15" title="Shift 15m later">+15m</button>
                            <button class="check-circle ${blk.done ? 'checked' : ''}" data-action="toggle-block" data-id="${blk.id}" aria-label="Mark block complete">
                              ${blk.done ? '✓' : ''}
                            </button>
                            <button class="btn-ghost btn-sm" data-action="delete-block" data-id="${blk.id}" title="Remove block">✕</button>
                          </div>
                        </div>
                      </div>
                    `;
                    })
                    .join('')
            }
          </div>
        </div>

        <!-- Right: Priority Tasks + Daily Habits -->
        <div style="display:flex; flex-direction:column; gap:20px;">
          <div class="surface-card">
            <div class="card-header">
              <h2 class="card-title">Priority Action Queue</h2>
              <button class="btn btn-ghost btn-sm" data-nav="tasks">Matrix & Kanban →</button>
            </div>
            <div class="task-list">
              ${
                priorityTasks.length === 0
                  ? `<p style="color:var(--text-muted); font-size:0.86rem;">All tasks complete! Add a new goal above.</p>`
                  : priorityTasks.map((t) => renderTaskItemHTML(t)).join('')
              }
            </div>
          </div>

          <!-- Daily Habits & Routine Tracker -->
          <div class="surface-card">
            <div class="card-header">
              <h2 class="card-title">Daily Habits & Non-Negotiables</h2>
              <button class="btn btn-secondary btn-sm" data-action="add-habit-prompt" id="btn-add-habit">+ Habit</button>
            </div>
            <div class="habit-grid">
              ${s.habits
                .map(
                  (h) => `
                <button class="habit-pill ${h.completedToday ? 'done' : ''}" data-action="toggle-habit" data-id="${h.id}">
                  <div style="text-align:left;">
                    <div style="font-weight:600; font-size:0.83rem;">${escapeHTML(h.name)}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted); font-family:var(--font-mono);">Streak: ${h.streak}d</div>
                  </div>
                  <span class="check-circle ${h.completedToday ? 'checked' : ''}">${h.completedToday ? '✓' : ''}</span>
                </button>
              `
                )
                .join('')}
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderTaskItemHTML(t) {
  const subj = getSubject(t.subjectId);
  const totalSubtasks = (t.subtasks || []).length;

  return `
    <div class="task-card ${t.completed ? 'completed' : ''}">
      <div class="task-left">
        <button class="check-circle ${t.completed ? 'checked' : ''}" data-action="toggle-task" data-id="${t.id}" aria-label="Toggle task complete">
          ${t.completed ? '✓' : ''}
        </button>
        <div class="task-body">
          <div class="task-title">${escapeHTML(t.title)}</div>
          <div class="task-meta">
            <span class="badge badge-${t.quadrant.toLowerCase()}">${t.quadrant}</span>
            <span class="subject-tag"><span class="subject-dot" style="background:${subj.color}"></span>${escapeHTML(subj.name)}</span>
            <span style="font-family:var(--font-mono); font-size:0.75rem; color:var(--text-muted);">🍅 ${t.completedPomodoros || 0}/${t.estimatedPomodoros || 1}</span>
            <span style="font-size:0.75rem; color:var(--text-muted);">Due ${t.dueDate}</span>
          </div>
          ${
            totalSubtasks > 0
              ? `
            <div class="subtask-list">
              ${t.subtasks
                .map(
                  (st) => `
                <label class="subtask-item ${st.done ? 'done' : ''}" style="cursor:pointer;">
                  <input type="checkbox" ${st.done ? 'checked' : ''} data-action="toggle-subtask" data-task-id="${t.id}" data-subtask-id="${st.id}" />
                  <span>${escapeHTML(st.text)}</span>
                </label>
              `
                )
                .join('')}
            </div>
          `
              : ''
          }
        </div>
      </div>
      <div style="display:flex; flex-direction:column; gap:4px; align-items:flex-end;">
        <button class="btn btn-secondary btn-sm" data-action="focus-on-task" data-id="${t.id}" title="Launch Focus Timer for this task">
          Focus
        </button>
        <button class="btn-ghost btn-sm" data-action="delete-task" data-id="${t.id}" title="Delete task">✕</button>
      </div>
    </div>
  `;
}

// VIEW 2: TASKS & EISENHOWER MATRIX + KANBAN
function renderTasksView() {
  const s = store.state;
  const filteredTasks = s.tasks.filter(
    (t) => s.taskSubjectFilter === 'all' || t.subjectId === s.taskSubjectFilter
  );

  let bodyContent = '';
  if (s.taskViewMode === 'matrix') {
    const quadrants = [
      { id: 'Q1', title: 'Q1 · Urgent & Important', subtitle: 'Do First — Critical Deadlines & High-Impact Actions', badge: 'badge-q1' },
      { id: 'Q2', title: 'Q2 · Important, Not Urgent', subtitle: 'Deep Focus — Self-Study, Skill Mastery & Core Projects', badge: 'badge-q2' },
      { id: 'Q3', title: 'Q3 · Urgent, Less Important', subtitle: 'Quick Batch — Admin, Errands & Messages', badge: 'badge-q3' },
      { id: 'Q4', title: 'Q4 · Someday / Low Priority', subtitle: 'Backlog & Optional Ideas', badge: 'badge-q4' }
    ];
    bodyContent = `
      <div class="matrix-grid">
        ${quadrants
          .map((q) => {
            const qTasks = filteredTasks.filter((t) => t.quadrant === q.id);
            return `
              <div class="matrix-quadrant">
                <div class="quadrant-header">
                  <div>
                    <div style="font-weight:700; font-size:0.95rem;">${q.title}</div>
                    <div style="font-size:0.78rem; color:var(--text-muted);">${q.subtitle}</div>
                  </div>
                  <span class="badge ${q.badge}">${qTasks.length}</span>
                </div>
                <div class="task-list">
                  ${qTasks.length === 0 ? `<p style="font-size:0.84rem; color:var(--text-muted);">No tasks in ${q.id}.</p>` : qTasks.map((t) => renderTaskItemHTML(t)).join('')}
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    `;
  } else if (s.taskViewMode === 'kanban') {
    const columns = [
      { id: 'todo', label: 'To Do', items: filteredTasks.filter((t) => !t.completed && t.status !== 'in_progress') },
      { id: 'in_progress', label: 'In Progress', items: filteredTasks.filter((t) => !t.completed && t.status === 'in_progress') },
      { id: 'done', label: 'Completed', items: filteredTasks.filter((t) => t.completed) }
    ];
    bodyContent = `
      <div class="grid-3">
        ${columns
          .map(
            (col) => `
          <div class="surface-card">
            <div class="card-header">
              <h2 class="card-title">${col.label}</h2>
              <span class="badge badge-q4">${col.items.length}</span>
            </div>
            <div class="task-list">
              ${col.items.map((t) => renderTaskItemHTML(t)).join('')}
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;
  } else {
    bodyContent = `
      <div class="surface-card">
        <div class="task-list">
          ${filteredTasks.length === 0 ? `<p style="color:var(--text-muted);">No matching tasks.</p>` : filteredTasks.map((t) => renderTaskItemHTML(t)).join('')}
        </div>
      </div>
    `;
  }

  return `
    <section aria-labelledby="heading-tasks">
      <div class="page-header">
        <div>
          <h1 class="page-title" id="heading-tasks">Tasks, Projects & Priority Matrix</h1>
          <p class="page-subtitle">Organize self-study goals, work projects, and life errands across List, Eisenhower 2×2, and Kanban views.</p>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
          <div class="filter-tabs" role="tablist">
            <button class="filter-tab ${s.taskViewMode === 'list' ? 'active' : ''}" data-action="set-task-view" data-view="list">List</button>
            <button class="filter-tab ${s.taskViewMode === 'matrix' ? 'active' : ''}" data-action="set-task-view" data-view="matrix">Eisenhower 2×2</button>
            <button class="filter-tab ${s.taskViewMode === 'kanban' ? 'active' : ''}" data-action="set-task-view" data-view="kanban">Kanban Board</button>
          </div>
          <select class="select-pill" id="filter-task-subject" aria-label="Filter by Track">
            <option value="all" ${s.taskSubjectFilter === 'all' ? 'selected' : ''}>All Tracks (${s.tasks.length})</option>
            ${s.subjects
              .map(
                (sub) =>
                  `<option value="${sub.id}" ${s.taskSubjectFilter === sub.id ? 'selected' : ''}>${escapeHTML(sub.name)}</option>`
              )
              .join('')}
          </select>
          <button class="btn btn-primary btn-sm" data-action="open-task-modal" id="btn-new-detailed-task">+ New Task</button>
        </div>
      </div>

      ${bodyContent}
    </section>
  `;
}

// VIEW 3: WEEKLY ROUTINE & SCHEDULE ARCHITECT
function renderProgramView() {
  const s = store.state;
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const shortDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const currentDayIdx = s.selectedProgramDay || 0;
  const dayBlocks = (s.weeklyProgram[currentDayIdx] || []).sort((a, b) =>
    a.startTime.localeCompare(b.startTime)
  );

  return `
    <section aria-labelledby="heading-program">
      <div class="page-header">
        <div>
          <h1 class="page-title" id="heading-program">Weekly Routine & Program Blueprint</h1>
          <p class="page-subtitle">Design your recurring 7-day schedule for study blocks, work, workouts, and classes — or import from Google Calendar.</p>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          <button class="btn btn-secondary btn-sm" data-action="open-calendar-modal">
            📅 Import Schedule / .ICS
          </button>
          <button class="btn btn-secondary btn-sm" data-action="push-program-to-today" id="btn-push-program">
            Apply ${shortDays[currentDayIdx]} to Today
          </button>
          <button class="btn btn-primary btn-sm" data-action="open-program-modal" id="btn-add-program-slot">
            + Add Recurring Slot
          </button>
        </div>
      </div>

      <div class="program-days-bar" role="tablist">
        ${shortDays
          .map(
            (label, idx) => `
          <button class="day-pill ${idx === currentDayIdx ? 'active' : ''}" data-action="select-program-day" data-day="${idx}">
            <div>${label}</div>
            <div style="font-size:0.75rem; opacity:0.75; font-family:var(--font-mono);">${(s.weeklyProgram[idx] || []).length} slots</div>
          </button>
        `
          )
          .join('')}
      </div>

      <div class="surface-card">
        <div class="card-header">
          <h2 class="card-title">${dayNames[currentDayIdx]} Recurring Blueprint</h2>
          <span class="badge badge-q2">${dayBlocks.length} recurring blocks</span>
        </div>

        <div class="timeline-container">
          ${
            dayBlocks.length === 0
              ? `<p style="color:var(--text-muted); padding:14px 0;">No recurring blocks for ${dayNames[currentDayIdx]}. Click <strong>+ Add Recurring Slot</strong> or <strong>📅 Import Schedule / .ICS</strong>.</p>`
              : dayBlocks
                  .map((slot) => {
                    const subj = getSubject(slot.subjectId);
                    return `
                    <div class="time-block-row">
                      <div class="time-slot-label">${slot.startTime}<br/><span style="font-size:0.75rem; opacity:0.75;">${slot.endTime}</span></div>
                      <div class="time-block-card" style="border-left-color:${subj.color};">
                        <div>
                          <div style="font-weight:600; font-size:0.93rem;">${escapeHTML(slot.title)}</div>
                          <div style="display:flex; gap:8px; margin-top:4px; align-items:center;">
                            <span class="subject-tag"><span class="subject-dot" style="background:${subj.color}"></span>${escapeHTML(subj.name)}</span>
                            <span class="badge badge-q4">${escapeHTML(slot.type)}</span>
                          </div>
                        </div>
                        <button class="btn-ghost btn-sm" data-action="delete-program-slot" data-id="${slot.id}" title="Delete recurring slot">✕</button>
                      </div>
                    </div>
                  `;
                  })
                  .join('')
          }
        </div>
      </div>
    </section>
  `;
}

// VIEW 4: KNOWLEDGE, SM-2 SPACED REPETITION & CORNELL NOTES HUB
function renderStudyView() {
  const s = store.state;
  const today = getTodayISO();
  const dueCards = s.flashcards.filter((c) => c.dueDate <= today);
  const activeCard = dueCards[0] || s.flashcards[0];

  return `
    <section aria-labelledby="heading-study">
      <div class="page-header">
        <div>
          <h1 class="page-title" id="heading-study">Knowledge, SM-2 Recall & Synthesis Notes</h1>
          <p class="page-subtitle">Master any self-taught skill, language, book, or course using SuperMemo-2 spaced repetition and structured Cornell Notes.</p>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          <button class="btn btn-secondary btn-sm" data-action="open-cornell-modal" id="btn-add-cornell">+ Synthesis Note</button>
          <button class="btn btn-secondary btn-sm" data-action="open-subject-modal" id="btn-add-subject">+ Life / Study Track</button>
          <button class="btn btn-primary btn-sm" data-action="open-flashcard-modal" id="btn-add-flashcard">+ SM-2 Recall Card</button>
        </div>
      </div>

      <!-- Active Tracks & Milestone Strip -->
      <div class="grid-3" style="margin-bottom:22px;">
        ${s.subjects
          .map((sub) => {
            const d = daysUntil(sub.examDate);
            const pct = Math.min(100, Math.round(((sub.loggedMinutes || 0) / (sub.targetHoursPerWeek * 60)) * 100));
            return `
            <div class="surface-card" style="border-top: 4px solid ${sub.color};">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                <div>
                  <span style="font-family:var(--font-mono); font-size:0.74rem; color:var(--text-muted);">${escapeHTML(sub.category || sub.code)}</span>
                  <h3 style="font-size:0.98rem; font-weight:700; margin-top:2px;">${escapeHTML(sub.name)}</h3>
                </div>
                <span class="badge ${d <= 7 ? 'badge-q1' : 'badge-q2'}">${d >= 0 ? `Goal in ${d}d` : 'Reached'}</span>
              </div>
              <div style="margin-top:12px;">
                <div style="display:flex; justify-content:space-between; font-size:0.77rem; color:var(--text-secondary); margin-bottom:5px;">
                  <span>Weekly Focus Target (${sub.targetHoursPerWeek}h)</span>
                  <span style="font-family:var(--font-mono);">${Math.round(((sub.loggedMinutes || 0) / 60) * 10) / 10}h (${pct}%)</span>
                </div>
                <div class="progress-track">
                  <div class="progress-fill" style="width:${pct}%; background:${sub.color};"></div>
                </div>
              </div>
            </div>
          `;
          })
          .join('')}
      </div>

      <div class="grid-2" style="margin-bottom:22px;">
        <!-- Left: SM-2 Active Recall Reviewer -->
        <div class="review-stage">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span class="badge badge-q2">SM-2 Active Recall Queue (${dueCards.length} due today)</span>
            <span style="font-family:var(--font-mono); font-size:0.77rem; color:var(--text-muted);">Deck: ${s.flashcards.length} cards</span>
          </div>

          ${
            activeCard
              ? (() => {
                  const subj = getSubject(activeCard.subjectId);
                  const isRevealed = revealedCardId === activeCard.id;
                  return `
                  <div>
                    <span class="subject-tag"><span class="subject-dot" style="background:${subj.color}"></span>${escapeHTML(subj.name)}</span>
                    <div class="flashcard-prompt" style="margin-top:12px;">${escapeHTML(activeCard.prompt)}</div>
                  </div>

                  ${
                    isRevealed
                      ? `
                    <div class="flashcard-answer">
                      <div style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--accent-sage); font-weight:700; margin-bottom:4px;">Answer / Key Insight</div>
                      ${escapeHTML(activeCard.answer)}
                    </div>
                    <div>
                      <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:8px; text-align:center;">Rate recall confidence to schedule next SM-2 interval:</div>
                      <div class="sm2-rating-row">
                        <button class="sm2-btn" data-action="grade-card" data-id="${activeCard.id}" data-quality="0">
                          <span style="color:var(--accent-crimson);">Again</span>
                          <span class="interval">1d reset</span>
                        </button>
                        <button class="sm2-btn" data-action="grade-card" data-id="${activeCard.id}" data-quality="3">
                          <span style="color:var(--accent-amber);">Hard</span>
                          <span class="interval">${Math.max(1, activeCard.interval)}d</span>
                        </button>
                        <button class="sm2-btn" data-action="grade-card" data-id="${activeCard.id}" data-quality="4">
                          <span style="color:var(--accent-primary);">Good</span>
                          <span class="interval">${activeCard.repetitions === 0 ? 1 : activeCard.repetitions === 1 ? 3 : Math.round(activeCard.interval * activeCard.efactor)}d</span>
                        </button>
                        <button class="sm2-btn" data-action="grade-card" data-id="${activeCard.id}" data-quality="5">
                          <span style="color:var(--accent-sage);">Easy</span>
                          <span class="interval">${Math.round(Math.max(2, activeCard.interval * activeCard.efactor * 1.3))}d</span>
                        </button>
                      </div>
                    </div>
                  `
                      : `
                    <button class="btn btn-primary" data-action="reveal-card" data-id="${activeCard.id}" id="btn-reveal-answer">
                      Reveal Answer
                    </button>
                  `
                  }
                `;
                })()
              : `<p style="color:var(--text-muted);">No recall cards in deck yet. Click <strong>+ SM-2 Recall Card</strong> above to create one!</p>`
          }
        </div>

        <!-- Right: Skill & Topic Mastery Matrix -->
        <div class="surface-card">
          <div class="card-header">
            <h2 class="card-title">Skill & Topic Mastery Tracker</h2>
            <button class="btn btn-secondary btn-sm" data-action="add-syllabus-topic" id="btn-add-topic">+ Skill / Topic</button>
          </div>
          <div class="task-list">
            ${s.syllabusTopics
              .map((topic) => {
                const subj = getSubject(topic.subjectId);
                return `
                <div class="task-card" style="align-items:center;">
                  <div>
                    <div style="font-weight:600; font-size:0.89rem;">${escapeHTML(topic.title)}</div>
                    <div style="display:flex; gap:8px; align-items:center; margin-top:4px;">
                      <span class="subject-tag"><span class="subject-dot" style="background:${subj.color}"></span>${escapeHTML(subj.name)}</span>
                      <span style="font-family:var(--font-mono); font-size:0.75rem; color:var(--text-muted);">Mastery: ${topic.confidence}%</span>
                    </div>
                  </div>
                  <select class="select-pill" data-action="change-topic-status" data-id="${topic.id}" aria-label="Skill Mastery Status">
                    ${['Not Started', 'Learning', 'Reviewing', 'Mastered']
                      .map((st) => `<option value="${st}" ${topic.status === st ? 'selected' : ''}>${st}</option>`)
                      .join('')}
                  </select>
                </div>
              `;
              })
              .join('')}
          </div>
        </div>
      </div>

      <!-- Cornell Note-Taking System Notebook -->
      <div class="surface-card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Structured Synthesis & Reading Notes (Cornell Method)</h2>
            <p style="font-size:0.8rem; color:var(--text-muted);">Capture book insights, language grammar, or technical notes — and convert any note into an SM-2 card in 1 click.</p>
          </div>
          <button class="btn btn-primary btn-sm" data-action="open-cornell-modal">+ New Note Sheet</button>
        </div>

        <div style="display:flex; flex-direction:column; gap:14px;">
          ${(s.cornellNotes || [])
            .map((note) => {
              const subj = getSubject(note.subjectId);
              return `
              <div class="cornell-card">
                <div style="padding:12px 14px; display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px;">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span class="subject-tag"><span class="subject-dot" style="background:${subj.color}"></span>${escapeHTML(subj.name)}</span>
                    <strong style="font-size:0.94rem;">${escapeHTML(note.title)}</strong>
                  </div>
                  <div style="display:flex; gap:6px;">
                    <button class="btn btn-secondary btn-sm" data-action="cornell-to-flashcard" data-id="${note.id}">
                      ⚡ Convert to SM-2 Card
                    </button>
                    <button class="btn-ghost btn-sm" data-action="delete-cornell" data-id="${note.id}">✕</button>
                  </div>
                </div>
                <div class="cornell-grid">
                  <div class="cornell-cue-col">
                    <div style="font-size:0.72rem; text-transform:uppercase; color:var(--text-muted); margin-bottom:4px;">Cue / Recall Prompt</div>
                    ${escapeHTML(note.cue)}
                  </div>
                  <div class="cornell-notes-col">${escapeHTML(note.notes)}</div>
                </div>
                <div class="cornell-summary-row">
                  <strong>Key Takeaway:</strong> ${escapeHTML(note.summary)}
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      </div>
    </section>
  `;
}

// VIEW 5: DEEP FOCUS STUDIO
function renderFocusView() {
  const s = store.state;
  const fs = s.focusSession;
  const pct = fs.durationSeconds > 0 ? ((fs.durationSeconds - fs.remainingSeconds) / fs.durationSeconds) * 100 : 0;
  const radius = 100;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  const modes = [
    { id: 'pomodoro', label: 'Pomodoro 25m', minutes: 25 },
    { id: 'deep', label: 'Deep Work 50m', minutes: 50 },
    { id: 'ultradian', label: 'Ultradian 90m', minutes: 90 },
    { id: 'break', label: 'Break 5m', minutes: 5 }
  ];

  const sounds = [
    { id: 'off', label: 'Silent', desc: 'Zero audio' },
    { id: 'brown', label: 'Warm Brown Noise', desc: 'Low-pass acoustic shield' },
    { id: 'rain', label: 'Soft Study Rain', desc: 'Pink-filtered rainfall' },
    { id: 'gamma', label: '40Hz Gamma Focus', desc: '200/240Hz binaural beat' }
  ];

  return `
    <section class="focus-studio-wrap" aria-labelledby="heading-focus">
      <div class="page-header" style="margin-bottom:4px;">
        <div>
          <h1 class="page-title" id="heading-focus">Deep Focus Studio</h1>
          <p class="page-subtitle">Mobile Screen WakeLock, Lock-Screen MediaSession controls, and 100% offline Web Audio synthesizer.</p>
        </div>
      </div>

      <div class="timer-ring-card">
        <div class="timer-mode-tabs" role="tablist">
          ${modes
            .map(
              (m) => `
            <button class="timer-mode-tab ${fs.mode === m.id ? 'active' : ''}" data-action="set-timer-mode" data-mode="${m.id}" data-minutes="${m.minutes}">
              ${m.label}
            </button>
          `
            )
            .join('')}
        </div>

        <div class="timer-svg-wrap">
          <svg width="236" height="236" viewBox="0 0 236 236" style="transform: rotate(-90deg);">
            <circle cx="118" cy="118" r="${radius}" fill="none" stroke="var(--bg-elevated)" stroke-width="10" />
            <circle
              cx="118"
              cy="118"
              r="${radius}"
              fill="none"
              stroke="var(--accent-primary)"
              stroke-width="10"
              stroke-linecap="round"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${strokeDashoffset}"
            />
          </svg>
          <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;">
            <div class="timer-digits" id="studio-timer-digits">${formatTimeMMSS(fs.remainingSeconds)}</div>
            <div style="font-size:0.78rem; color:var(--text-muted); margin-top:6px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em;">
              ${fs.isRunning ? 'WakeLock Active · Focusing' : 'Paused / Ready'}
            </div>
          </div>
        </div>

        <!-- Linked Task & Track Selectors -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; width:100%; max-width:520px;">
          <div class="form-group" style="text-align:left;">
            <label class="form-label" for="focus-task-select">Active Task</label>
            <select class="select-pill" id="focus-task-select">
              ${s.tasks
                .filter((t) => !t.completed)
                .map((t) => `<option value="${t.id}" ${fs.linkedTaskId === t.id ? 'selected' : ''}>${escapeHTML(t.title)}</option>`)
                .join('')}
            </select>
          </div>
          <div class="form-group" style="text-align:left;">
            <label class="form-label" for="focus-subject-select">Focus Track Target</label>
            <select class="select-pill" id="focus-subject-select">
              ${s.subjects
                .map((sub) => `<option value="${sub.id}" ${fs.linkedSubjectId === sub.id ? 'selected' : ''}>${escapeHTML(sub.name)}</option>`)
                .join('')}
            </select>
          </div>
        </div>

        <div style="display:flex; flex-wrap:wrap; gap:10px; justify-content:center;">
          <button class="btn btn-primary" style="padding:11px 26px; font-size:0.95rem;" data-action="toggle-timer" id="btn-main-timer-toggle">
            ${fs.isRunning ? 'Pause Session' : 'Start Focus Session'}
          </button>
          <button class="btn btn-secondary" data-action="reset-timer" id="btn-reset-timer">Reset</button>
          <button class="btn btn-secondary" data-action="complete-session-now" id="btn-log-now" title="Finish & Log Session Minutes Now">
            Log Session Now
          </button>
        </div>
      </div>

      <!-- Offline Web Audio Soundscapes -->
      <div class="surface-card">
        <div class="card-header">
          <h2 class="card-title">Synthesized Acoustic Soundscapes (Offline Web Audio)</h2>
          <input
            type="range"
            min="0.05"
            max="0.9"
            step="0.05"
            value="${soundEngine.volume}"
            id="sound-volume-slider"
            aria-label="Soundscape Volume"
            style="width:110px;"
          />
        </div>
        <div class="soundscape-grid">
          ${sounds
            .map(
              (snd) => `
            <button class="sound-btn ${soundEngine.currentMode === snd.id ? 'active' : ''}" data-action="toggle-sound" data-sound="${snd.id}">
              <span>${snd.label}</span>
              <span style="font-size:0.75rem; color:var(--text-muted); font-weight:400;">${snd.desc}</span>
            </button>
          `
            )
            .join('')}
        </div>
      </div>
    </section>
  `;
}

// VIEW 6: GOALS, PACE INSIGHTS & OPTIONAL SCORE CALCULATOR
function renderAnalyticsView() {
  const s = store.state;
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weeklyMins = s.stats.weeklyDailyMinutes || [65, 95, 80, 110, 50, 90, 75];
  const maxDayMin = Math.max(120, ...weeklyMins);

  return `
    <section aria-labelledby="heading-analytics">
      <div class="page-header">
        <div>
          <h1 class="page-title" id="heading-analytics">Goals, Pace Insights & Analytics</h1>
          <p class="page-subtitle">7-day deep focus velocity, weekly goal pace calculator for self-study/projects/fitness, and optional exam score calculator.</p>
        </div>
        <button class="btn btn-secondary btn-sm" data-action="open-subject-modal">+ Add New Life / Study Track</button>
      </div>

      <div class="grid-2" style="margin-bottom:22px;">
        <!-- 7-Day Focus Trend SVG Chart -->
        <div class="surface-card">
          <div class="card-header">
            <h2 class="card-title">7-Day Deep Focus Velocity (Minutes / Day)</h2>
            <span class="badge badge-sage">${weeklyMins.reduce((a, b) => a + b, 0)}m Weekly Total</span>
          </div>
          <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:10px; align-items:end; height:180px; padding-top:20px;">
            ${weeklyMins
              .map((mins, idx) => {
                const hPct = Math.max(10, Math.round((mins / maxDayMin) * 100));
                return `
                <div style="display:flex; flex-direction:column; align-items:center; gap:6px; height:100%; justify-content:flex-end;">
                  <span style="font-family:var(--font-mono); font-size:0.75rem; color:var(--text-secondary);">${mins}m</span>
                  <div style="width:100%; max-width:36px; height:${hPct}%; background:var(--accent-primary); border-radius:6px 6px 3px 3px;"></div>
                  <span style="font-size:0.76rem; font-weight:600; color:var(--text-muted);">${days[idx]}</span>
                </div>
              `;
              })
              .join('')}
          </div>
        </div>

        <!-- Universal Goal Pace & Daily Target Advisor -->
        <div class="surface-card">
          <div class="card-header">
            <h2 class="card-title">Weekly Goal Pace Advisor</h2>
            <span style="font-size:0.76rem; color:var(--text-muted);">Required daily minutes to hit your weekly target</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:12px;">
            ${s.subjects
              .map((sub) => {
                const pace = calculateGoalPace(sub.loggedMinutes || 0, sub.targetHoursPerWeek || 6, 4);
                const loggedH = Math.round(((sub.loggedMinutes || 0) / 60) * 10) / 10;
                return `
                <div>
                  <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.83rem; margin-bottom:4px;">
                    <span style="font-weight:600;">${escapeHTML(sub.name)}</span>
                    <span style="font-family:var(--font-mono); font-size:0.76rem; color:var(--text-secondary);">
                      ${loggedH}h / ${sub.targetHoursPerWeek}h · <strong>${pace.dailyMinutesNeeded}m/day needed</strong>
                    </span>
                  </div>
                  <div class="progress-track">
                    <div class="progress-fill" style="width:${pace.completionPct}%; background:${sub.color};"></div>
                  </div>
                </div>
              `;
              })
              .join('')}
          </div>
        </div>
      </div>

      <!-- Optional Certification / Course Assessment Target Calculator -->
      <div class="surface-card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Milestone & Certification Score Calculator (Optional)</h2>
            <p style="font-size:0.82rem; color:var(--text-muted);">Taking a certification, language test, or course exam? Compute the exact final score needed to hit your target.</p>
          </div>
        </div>
        <div style="overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse; font-size:0.86rem;">
            <thead>
              <tr style="border-bottom:1px solid var(--border-subtle); text-align:left; color:var(--text-muted);">
                <th style="padding:10px 8px;">Track / Goal</th>
                <th style="padding:10px 8px;">Current Score (%)</th>
                <th style="padding:10px 8px;">Final Assessment Weight (%)</th>
                <th style="padding:10px 8px;">Target Score (%)</th>
                <th style="padding:10px 8px;">Required Score</th>
              </tr>
            </thead>
            <tbody>
              ${s.subjects
                .map((sub) => {
                  const reqScore = calculateRequiredExamScore(
                    sub.currentGrade ?? 90,
                    sub.examWeight ?? 35,
                    sub.targetCourseGrade ?? 90
                  );
                  const badgeClass = reqScore > 95 ? 'badge-q1' : reqScore > 82 ? 'badge-q2' : 'badge-sage';
                  return `
                  <tr style="border-bottom:1px solid var(--border-subtle);">
                    <td style="padding:10px 8px; font-weight:600;">
                      <span class="subject-dot" style="background:${sub.color}; display:inline-block; margin-right:6px;"></span>
                      ${escapeHTML(sub.name)}
                    </td>
                    <td style="padding:10px 8px;">
                      <input type="number" class="input-pill" style="width:78px;" step="0.5" value="${sub.currentGrade ?? 90}" data-action="grade-input" data-field="currentGrade" data-id="${sub.id}" />
                    </td>
                    <td style="padding:10px 8px;">
                      <input type="number" class="input-pill" style="width:78px;" step="5" value="${sub.examWeight ?? 35}" data-action="grade-input" data-field="examWeight" data-id="${sub.id}" />
                    </td>
                    <td style="padding:10px 8px;">
                      <input type="number" class="input-pill" style="width:78px;" step="1" value="${sub.targetCourseGrade ?? 90}" data-action="grade-input" data-field="targetCourseGrade" data-id="${sub.id}" />
                    </td>
                    <td style="padding:10px 8px; font-family:var(--font-mono); font-weight:700;">
                      <span class="badge ${badgeClass}">${reqScore}% needed</span>
                    </td>
                  </tr>
                `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Google Sheets & Automated Study Reports -->
      <div class="surface-card" style="margin-top:22px;">
        <div class="card-header">
          <div>
            <h2 class="card-title">📊 Google Sheets & Progress Reports</h2>
            <p style="font-size:0.82rem; color:var(--text-muted);">
              Export beautifully formatted weekly or monthly reports directly to your personal Google Sheet via Webhook, or download as CSV / JSON:
            </p>
          </div>
          <span class="badge badge-sage">Apps Script Ready</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:12px; background:var(--bg-elevated); padding:14px; border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
          <div class="grid-2" style="gap:10px;">
            <div class="form-group">
              <label class="form-label" for="report-period-type">Report Period</label>
              <select class="form-select" id="report-period-type">
                <option value="week" selected>Current Week (Weekly Digest)</option>
                <option value="month">Current Month (Monthly Summary)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="report-sheets-url">Google Sheets Webhook URL (from chronostudy-sheets-reports)</label>
              <input type="url" class="form-input" id="report-sheets-url" placeholder="https://script.google.com/macros/s/.../exec" value="${escapeHTML(localStorage.getItem('chronostudy_sheets_webhook_url') || '')}" />
            </div>
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
            <button type="button" class="btn btn-primary btn-sm" data-action="export-to-google-sheets">
              🚀 Send Report to Google Sheets
            </button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="download-report-xlsx">
              📊 Download Excel (.xlsx)
            </button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="download-report-csv">
              📥 Download Report CSV
            </button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="download-report-json">
              💾 Download Report JSON
            </button>
          </div>
        </div>
      </div>
    </section>
  `;
}

// MODALS
function openModal(type) {
  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return;
  const s = store.state;

  let content = '';
  if (type === 'calendar-sync') {
    const savedFeeds = loadSavedCalendarFeeds();
    content = `
      <h2 class="card-title">📅 Automatic Google Calendar & University Live Sync</h2>
      <p style="font-size:0.84rem; color:var(--text-secondary);">
        Connect your <strong>University Timetable (Canvas, Moodle, Blackboard, Banner, Outlook)</strong> or <strong>Google Calendar</strong> once — ChronoStudy will automatically pull and refresh your schedules every time you open the app:
      </p>

      <!-- 0. Automatic Live Feed Subscription (University LMS / Google Calendar Secret iCal / WebCal) -->
      <div style="background:var(--bg-elevated); padding:13px; border-radius:var(--radius-md); border:1px solid var(--accent-primary); display:flex; flex-direction:column; gap:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="font-size:0.86rem;">🔄 1. Auto-Connect Live University / Google Calendar Feed URL</strong>
          <span class="badge badge-terracotta">Auto-Syncs on Startup</span>
        </div>
        <p style="font-size:0.78rem; color:var(--text-muted);">
          Paste your <strong>University Calendar Feed URL</strong> (Canvas / Moodle / Blackboard / Outlook <code>.ics</code> or <code>webcal://</code> link) or <strong>Google Calendar Secret iCal Address</strong>:
        </p>
        <div class="grid-2" style="gap:8px;">
          <input type="text" class="form-input" id="live-feed-label" placeholder="Name (e.g., University Timetable or My Google Cal)" />
          <select class="form-select" id="live-feed-subject">
            ${s.subjects.map((sub) => `<option value="${sub.id}">Track: ${escapeHTML(sub.name)}</option>`).join('')}
          </select>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <input type="url" class="form-input" id="live-feed-url" style="flex:1; min-width:220px;" placeholder="https://.../calendar.ics or webcal://... or Google Calendar ID" />
          <button type="button" class="btn btn-primary btn-sm" data-action="connect-live-feed">🔗 Connect & Auto-Sync</button>
        </div>
        ${
          savedFeeds.length > 0
            ? `
          <div style="margin-top:6px; display:flex; flex-direction:column; gap:6px; border-top:1px solid var(--border-subtle); padding-top:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:0.76rem; font-weight:700; color:var(--text-secondary);">CONNECTED LIVE FEEDS (${savedFeeds.length})</span>
              <button type="button" class="btn btn-secondary btn-sm" style="padding:3px 8px; font-size:0.72rem;" data-action="sync-live-feeds-now">🔄 Refresh All Now</button>
            </div>
            ${savedFeeds
              .map(
                (f, idx) => `
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.78rem; background:var(--bg-surface); padding:6px 10px; border-radius:6px;">
                <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:75%;">
                  <strong>${escapeHTML(f.label || 'Live Calendar Feed')}</strong>
                  <span style="color:var(--text-muted); font-size:0.72rem;"> · ${f.lastSyncedAt ? 'Synced ' + new Date(f.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}</span>
                </div>
                <button type="button" class="btn-icon" data-action="remove-live-feed" data-index="${idx}" title="Disconnect Feed">✕</button>
              </div>
            `
              )
              .join('')}
          </div>
        `
            : ''
        }
      </div>

      <!-- Direct Google Calendar API Live Connect -->
      <div style="background:var(--bg-elevated); padding:13px; border-radius:var(--radius-md); border:1px solid var(--border-subtle); display:flex; flex-direction:column; gap:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="font-size:0.86rem;">⚡ 2. Direct Google Calendar API Live Connection</strong>
          <span class="badge badge-sage">REST API v3</span>
        </div>
        <div class="grid-2" style="gap:8px;">
          <input type="text" class="form-input" id="gcal-api-calendar-id" placeholder="Calendar ID (default: primary)" value="primary" />
          <input type="password" class="form-input" id="gcal-api-token" placeholder="Google OAuth Access Token or API Key" />
        </div>
        <div style="display:flex; justify-content:flex-end;">
          <button type="button" class="btn btn-secondary btn-sm" data-action="connect-gcal-api">⚡ Pull Live Google Calendar Events</button>
        </div>
      </div>

      <!-- 3. Import .ICS File from Google Calendar / Apple Calendar -->
      <div style="background:var(--bg-elevated); padding:13px; border-radius:var(--radius-md); border:1px solid var(--border-subtle); display:flex; flex-direction:column; gap:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="font-size:0.86rem;">3. Import .ICS File (Google / Apple / University Export)</strong>
          <span class="badge badge-sage">Supports Recurring Events</span>
        </div>
        <p style="font-size:0.78rem; color:var(--text-muted);">
          Upload any <code>.ics</code> file exported from Google Calendar or your schedule app. Single events go to your Day Timeline and weekly recurring events populate your 7-Day Routine!
        </p>
        <div style="display:flex; gap:8px; align-items:center;">
          <select class="select-pill" id="ics-import-subject">
            ${s.subjects.map((sub) => `<option value="${sub.id}">Tag as: ${escapeHTML(sub.name)}</option>`).join('')}
          </select>
          <label class="btn btn-primary btn-sm" style="cursor:pointer;">
            📂 Upload .ICS Calendar File
            <input type="file" id="import-ics-input" accept=".ics,text/calendar" style="display:none;" />
          </label>
        </div>
      </div>

      <!-- 2. Smart Paste Plain-Text Schedule -->
      <div style="background:var(--bg-elevated); padding:13px; border-radius:var(--radius-md); border:1px solid var(--border-subtle); display:flex; flex-direction:column; gap:8px;">
        <strong style="font-size:0.86rem;">2. Smart Paste Any Schedule or Routine (Plain Text)</strong>
        <p style="font-size:0.78rem; color:var(--text-muted);">
          Paste lines from an email, workout plan, or timetable (e.g. <code>Mon 18:00-19:15 Boxing & Conditioning</code> or <code>09:00-10:30 Spanish Practice</code>):
        </p>
        <textarea class="form-textarea" id="paste-schedule-textarea" rows="4" placeholder="Mon 09:00-10:30 Deep Work: AI Project&#10;Wed 18:00-19:15 Strength & Conditioning&#10;14:00-15:00 Spanish Conversation Practice"></textarea>
        <div style="display:flex; justify-content:flex-end;">
          <button type="button" class="btn btn-primary btn-sm" data-action="import-pasted-schedule">⚡ Parse & Import Schedule</button>
        </div>
      </div>

      <!-- 3. Export to Google Calendar / Apple Calendar -->
      <div style="background:var(--bg-elevated); padding:13px; border-radius:var(--radius-md); border:1px solid var(--border-subtle); display:flex; flex-direction:column; gap:8px;">
        <strong style="font-size:0.86rem;">3. Export to Google Calendar / Apple Calendar</strong>
        <p style="font-size:0.78rem; color:var(--text-muted);">
          Tap <strong>📅 +GCal</strong> on any time block to add it directly to Google Calendar online, or download a master <code>.ics</code> file for all blocks & milestones:
        </p>
        <div style="display:flex; gap:8px;">
          <button type="button" class="btn btn-secondary btn-sm" data-action="export-ics">📥 Download Full .ICS Calendar</button>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end;">
        <button type="button" class="btn btn-secondary" data-action="close-modal">Done</button>
      </div>
    `;
  } else if (type === 'task') {
    content = `
      <h2 class="card-title">New Action Item or Study Task</h2>
      <form id="modal-task-form" style="display:flex; flex-direction:column; gap:12px;">
        <div class="form-group">
          <label class="form-label">Task / Goal Title</label>
          <input type="text" class="form-input" name="title" required placeholder="e.g., Build API integration, Practice Spanish, or Complete workout" />
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Life / Study Track</label>
            <select class="form-select" name="subjectId">
              ${s.subjects.map((sub) => `<option value="${sub.id}">${escapeHTML(sub.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Eisenhower Quadrant</label>
            <select class="form-select" name="quadrant">
              <option value="Q1">Q1 · Urgent & Important</option>
              <option value="Q2" selected>Q2 · Important / Core Focus</option>
              <option value="Q3">Q3 · Urgent / Quick Errand</option>
              <option value="Q4">Q4 · Later / Backlog</option>
            </select>
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Target Date</label>
            <input type="date" class="form-input" name="dueDate" value="${getTodayISO()}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Estimated Focus Blocks (25m)</label>
            <input type="number" class="form-input" name="estimatedPomodoros" value="2" min="1" max="16" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Sub-steps / Checklist (one per line)</label>
          <textarea class="form-textarea" name="subtasks" rows="3" placeholder="Step 1&#10;Step 2&#10;Step 3"></textarea>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
          <button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Task</button>
        </div>
      </form>
    `;
  } else if (type === 'block') {
    content = `
      <h2 class="card-title">Schedule Time Block (${s.selectedDate})</h2>
      <form id="modal-block-form" style="display:flex; flex-direction:column; gap:12px;">
        <div class="form-group">
          <label class="form-label">Session / Activity Title</label>
          <input type="text" class="form-input" name="title" required placeholder="e.g., Deep Work, Gym Session, Language Practice, or Meeting" />
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Start Time</label>
            <input type="time" class="form-input" name="startTime" value="14:00" required />
          </div>
          <div class="form-group">
            <label class="form-label">End Time</label>
            <input type="time" class="form-input" name="endTime" value="15:30" required />
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Track / Domain</label>
            <select class="form-select" name="subjectId">
              ${s.subjects.map((sub) => `<option value="${sub.id}">${escapeHTML(sub.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Activity Category</label>
            <select class="form-select" name="category">
              <option value="deep_work">Deep Work / Self-Study</option>
              <option value="lecture">Meeting / Class / Appointment</option>
              <option value="review">SM-2 Recall / Practice</option>
              <option value="wellness">Fitness / Health / Break</option>
            </select>
          </div>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
          <button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
          <button type="submit" class="btn btn-primary">Add to Schedule</button>
        </div>
      </form>
    `;
  } else if (type === 'program') {
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    content = `
      <h2 class="card-title">Add Recurring Weekly Slot (${dayNames[s.selectedProgramDay || 0]})</h2>
      <form id="modal-program-form" style="display:flex; flex-direction:column; gap:12px;">
        <div class="form-group">
          <label class="form-label">Recurring Activity Title</label>
          <input type="text" class="form-input" name="title" required placeholder="e.g., Morning Deep Work, Boxing Class, or Piano Practice" />
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Start Time</label>
            <input type="time" class="form-input" name="startTime" value="10:00" required />
          </div>
          <div class="form-group">
            <label class="form-label">End Time</label>
            <input type="time" class="form-input" name="endTime" value="11:30" required />
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Track / Domain</label>
            <select class="form-select" name="subjectId">
              ${s.subjects.map((sub) => `<option value="${sub.id}">${escapeHTML(sub.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Activity Type</label>
            <select class="form-select" name="type">
              <option value="Deep Focus">Deep Focus</option>
              <option value="Self-Study">Self-Study</option>
              <option value="Project Work">Project Work</option>
              <option value="Fitness & Health">Fitness & Health</option>
              <option value="Session / Class">Session / Class</option>
              <option value="Review">Review</option>
            </select>
          </div>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
          <button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Recurring Slot</button>
        </div>
      </form>
    `;
  } else if (type === 'flashcard') {
    content = `
      <h2 class="card-title">Create SM-2 Spaced Repetition Recall Card</h2>
      <form id="modal-flashcard-form" style="display:flex; flex-direction:column; gap:12px;">
        <div class="form-group">
          <label class="form-label">Track / Skill Domain</label>
          <select class="form-select" name="subjectId">
            ${s.subjects.map((sub) => `<option value="${sub.id}">${escapeHTML(sub.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Question / Vocabulary / Active Recall Prompt</label>
          <textarea class="form-textarea" name="prompt" rows="3" required placeholder="Enter a concept, language phrase, code pattern, or question..."></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Answer / Explanation</label>
          <textarea class="form-textarea" name="answer" rows="3" required placeholder="Concise verifiable answer..."></textarea>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
          <button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
          <button type="submit" class="btn btn-primary">Add to SM-2 Deck</button>
        </div>
      </form>
    `;
  } else if (type === 'cornell') {
    content = `
      <h2 class="card-title">New Synthesis Note Sheet (Cornell Method)</h2>
      <form id="modal-cornell-form" style="display:flex; flex-direction:column; gap:12px;">
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Track / Domain</label>
            <select class="form-select" name="subjectId">
              ${s.subjects.map((sub) => `<option value="${sub.id}">${escapeHTML(sub.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Topic / Book / Session Title</label>
            <input type="text" class="form-input" name="title" required placeholder="e.g., System Architecture Notes or Book Chapter 4" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Cue / Recall Question (Left Column)</label>
          <input type="text" class="form-input" name="cue" required placeholder="What is the core mental model or takeaway?" />
        </div>
        <div class="form-group">
          <label class="form-label">Detailed Notes & Examples (Right Column)</label>
          <textarea class="form-textarea" name="notes" rows="4" required placeholder="Key points, examples, or code snippets..."></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">1-Sentence Synthesis Summary (Bottom Row)</label>
          <input type="text" class="form-input" name="summary" required placeholder="Distill the core lesson into one sentence." />
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
          <button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Note Sheet</button>
        </div>
      </form>
    `;
  } else if (type === 'subject') {
    content = `
      <h2 class="card-title">Add Life, Study, or Project Track</h2>
      <form id="modal-subject-form" style="display:flex; flex-direction:column; gap:12px;">
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Short Tag / Code</label>
            <input type="text" class="form-input" name="code" required placeholder="e.g., SPANISH, AI, GYM" />
          </div>
          <div class="form-group">
            <label class="form-label">Color Tag</label>
            <input type="color" class="form-input" name="color" value="#C85A32" style="height:42px; padding:4px;" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Track / Goal Name</label>
          <input type="text" class="form-input" name="name" required placeholder="e.g., Spanish B2 Fluency, Indie App Launch, Marathon Prep" />
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Target Milestone Date</label>
            <input type="date" class="form-input" name="examDate" value="${new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Weekly Target Hours</label>
            <input type="number" class="form-input" name="targetHoursPerWeek" value="6" min="1" max="40" />
          </div>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
          <button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
          <button type="submit" class="btn btn-primary">Add Track</button>
        </div>
      </form>
    `;
  } else if (type === 'backup') {
    const cfg = loadSyncConfig();
    content = `
      <h2 class="card-title">☁️ PC ↔ Mobile Cloud Sync & Workspace Setup</h2>
      <p style="font-size:0.84rem; color:var(--text-secondary);">
        Synchronize your schedule, tasks, and notes between your <strong>PC</strong> and <strong>Mobile Phone</strong>, or switch between a Blank Slate and Sample Setup:
      </p>

      <!-- Workspace Personalization: Blank Slate vs Sample Data -->
      <div style="background:var(--bg-elevated); padding:12px; border-radius:var(--radius-md); border:1px solid var(--border-subtle); display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;">
        <div>
          <strong style="font-size:0.84rem;">Workspace Mode</strong>
          <div style="font-size:0.76rem; color:var(--text-muted);">Start fresh from zero with your own tracks, or load the sample setup.</div>
        </div>
        <div style="display:flex; gap:6px;">
          <button type="button" class="btn btn-secondary btn-sm" data-action="start-blank-slate">✨ Start Blank Slate</button>
          <button type="button" class="btn btn-secondary btn-sm" data-action="reset-demo-data">Load Sample Setup</button>
        </div>
      </div>

      <!-- Method 1: GitHub Gist 2-Way Cloud Sync -->
      <div style="background:var(--bg-elevated); padding:13px; border-radius:var(--radius-md); border:1px solid var(--border-subtle); display:flex; flex-direction:column; gap:9px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="font-size:0.85rem;">1. GitHub Gist Cloud Sync (PC ↔ Mobile Anywhere)</strong>
          <span class="badge badge-sage">${cfg.gistId ? 'Gist Linked' : 'Serverless'}</span>
        </div>
        <div class="grid-2" style="gap:8px;">
          <input type="password" class="form-input" id="sync-gh-token" placeholder="GitHub Token (gist scope)" value="${escapeHTML(cfg.githubToken || '')}" />
          <input type="text" class="form-input" id="sync-gist-id" placeholder="Gist ID (leave blank on 1st Push)" value="${escapeHTML(cfg.gistId || '')}" />
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          <button type="button" class="btn btn-primary btn-sm" data-action="cloud-gist-push">☁️ Push to GitHub Cloud</button>
          <button type="button" class="btn btn-secondary btn-sm" data-action="cloud-gist-pull">⬇️ Pull from GitHub Cloud</button>
        </div>
      </div>

      <!-- Method 2: Instant Shareable Sync Link (#sync=...) -->
      <div style="background:var(--bg-elevated); padding:13px; border-radius:var(--radius-md); border:1px solid var(--border-subtle); display:flex; flex-direction:column; gap:8px;">
        <strong style="font-size:0.85rem;">2. Instant Device Handoff Link (Zero Account Needed)</strong>
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          <button type="button" class="btn btn-secondary btn-sm" data-action="copy-sync-link">🔗 Copy Instant Sync Link</button>
          <button type="button" class="btn btn-secondary btn-sm" data-action="download-json-backup">💾 Export JSON Backup</button>
          <label class="btn btn-secondary btn-sm" style="cursor:pointer;">
            📂 Import JSON Backup
            <input type="file" id="import-json-input" accept=".json" style="display:none;" />
          </label>
        </div>
      </div>

      <!-- Method 3: Local PC Sync Server -->
      <div style="background:var(--bg-elevated); padding:13px; border-radius:var(--radius-md); border:1px solid var(--border-subtle); display:flex; flex-direction:column; gap:8px;">
        <strong style="font-size:0.85rem;">3. Self-Hosted PC Sync Server (<code>npm start</code>)</strong>
        <div style="display:flex; gap:8px;">
          <input type="text" class="form-input" id="sync-server-url" placeholder="http://localhost:4173" value="${escapeHTML(cfg.serverUrl || '')}" />
          <button type="button" class="btn btn-secondary btn-sm" data-action="sync-to-lan-server">Push</button>
          <button type="button" class="btn btn-secondary btn-sm" data-action="pull-from-lan-server">Pull</button>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end;">
        <button type="button" class="btn btn-secondary" data-action="close-modal">Done</button>
      </div>
    `;
  }

  modalRoot.innerHTML = `
    <div class="modal-backdrop" data-action="backdrop-close">
      <div class="modal-card" role="dialog" aria-modal="true">
        ${content}
      </div>
    </div>
  `;
}

function closeModal() {
  const modalRoot = document.getElementById('modal-root');
  if (modalRoot) modalRoot.innerHTML = '';
}

function renderApp() {
  applyTheme(store.state.theme);
  syncTimerLoop();
  renderNavigation();

  const mainView = document.getElementById('main-view');
  if (!mainView) return;

  const tab = store.state.activeTab;
  if (tab === 'today') mainView.innerHTML = renderTodayView();
  else if (tab === 'tasks') mainView.innerHTML = renderTasksView();
  else if (tab === 'program') mainView.innerHTML = renderProgramView();
  else if (tab === 'study') mainView.innerHTML = renderStudyView();
  else if (tab === 'focus') mainView.innerHTML = renderFocusView();
  else if (tab === 'analytics') mainView.innerHTML = renderAnalyticsView();
}

// Event Delegation
document.addEventListener('click', async (e) => {
  const navBtn = e.target.closest('[data-nav]');
  if (navBtn) {
    const tab = navBtn.getAttribute('data-nav');
    store.update((s) => {
      s.activeTab = tab;
    });
    return;
  }

  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;
  const action = actionEl.getAttribute('data-action');
  const id = actionEl.getAttribute('data-id');

  if (action === 'toggle-theme') {
    store.update((s) => {
      s.theme = s.theme === 'dark' ? 'light' : 'dark';
    });
  } else if (action === 'toggle-task') {
    store.update((s) => {
      const t = s.tasks.find((x) => x.id === id);
      if (t) {
        t.completed = !t.completed;
        t.status = t.completed ? 'done' : 'todo';
      }
    });
  } else if (action === 'delete-task') {
    store.update((s) => {
      s.tasks = s.tasks.filter((x) => x.id !== id);
    });
    showToast('Task removed');
  } else if (action === 'focus-on-task') {
    store.update((s) => {
      const t = s.tasks.find((x) => x.id === id);
      if (t) {
        s.focusSession.linkedTaskId = t.id;
        s.focusSession.linkedSubjectId = t.subjectId;
      }
      s.activeTab = 'focus';
    });
  } else if (action === 'toggle-block') {
    store.update((s) => {
      const b = s.scheduleBlocks.find((x) => x.id === id);
      if (b) b.done = !b.done;
    });
  } else if (action === 'shift-block') {
    const delta = Number(actionEl.getAttribute('data-delta') || 15);
    store.shiftBlockTime(id, delta);
    showToast(`Shifted block ${delta > 0 ? '+15m' : '-15m'}`);
  } else if (action === 'delete-block') {
    store.update((s) => {
      s.scheduleBlocks = s.scheduleBlocks.filter((x) => x.id !== id);
    });
  } else if (action === 'apply-today-template') {
    const d = new Date(store.state.selectedDate + 'T12:00:00');
    const weekdayIdx = d.getDay() === 0 ? 6 : d.getDay() - 1;
    const count = store.applyProgramToDate(weekdayIdx, store.state.selectedDate);
    showToast(count > 0 ? `Added ${count} blocks from Weekly Routine` : 'Routine blocks already in schedule');
  } else if (action === 'smart-auto-schedule') {
    const count = store.autoScheduleDate(store.state.selectedDate);
    showToast(
      count > 0
        ? `⚡ Auto-scheduled ${count} priority tasks into open gaps!`
        : 'No free gaps or unscheduled tasks available'
    );
  } else if (action === 'toggle-habit') {
    store.update((s) => {
      const h = s.habits.find((x) => x.id === id);
      if (h) {
        h.completedToday = !h.completedToday;
        h.streak += h.completedToday ? 1 : -1;
      }
    });
  } else if (action === 'add-habit-prompt') {
    const name = prompt('Enter daily habit name:');
    if (name && name.trim()) {
      store.update((s) => {
        s.habits.push({
          id: 'hab-' + Date.now(),
          name: name.trim(),
          streak: 1,
          completedToday: false
        });
      });
    }
  } else if (action === 'set-task-view') {
    const view = actionEl.getAttribute('data-view');
    store.update((s) => {
      s.taskViewMode = view;
    });
  } else if (action === 'select-program-day') {
    const day = Number(actionEl.getAttribute('data-day'));
    store.update((s) => {
      s.selectedProgramDay = day;
    });
  } else if (action === 'push-program-to-today') {
    const count = store.applyProgramToDate(store.state.selectedProgramDay || 0, getTodayISO());
    store.update((s) => {
      s.selectedDate = getTodayISO();
      s.activeTab = 'today';
    });
    showToast(`Applied ${count} routine slots to Today!`);
  } else if (action === 'delete-program-slot') {
    store.update((s) => {
      const day = s.selectedProgramDay || 0;
      s.weeklyProgram[day] = (s.weeklyProgram[day] || []).filter((x) => x.id !== id);
    });
  } else if (action === 'reveal-card') {
    revealedCardId = id;
    renderApp();
  } else if (action === 'grade-card') {
    const quality = Number(actionEl.getAttribute('data-quality'));
    revealedCardId = null;
    store.reviewFlashcard(id, quality);
    showToast('SM-2 review interval updated!');
  } else if (action === 'cornell-to-flashcard') {
    const card = store.convertCornellNoteToFlashcard(id);
    if (card) showToast('⚡ Converted Note Sheet into SM-2 Recall Card!');
  } else if (action === 'delete-cornell') {
    store.update((s) => {
      s.cornellNotes = (s.cornellNotes || []).filter((n) => n.id !== id);
    });
    showToast('Note deleted');
  } else if (action === 'add-syllabus-topic') {
    const title = prompt('Enter skill, module, or topic title:');
    if (title && title.trim()) {
      store.update((s) => {
        s.syllabusTopics.push({
          id: 'syl-' + Date.now(),
          subjectId: s.subjects[0]?.id || 'subj-algo',
          title: title.trim(),
          status: 'Learning',
          confidence: 50
        });
      });
    }
  } else if (action === 'set-timer-mode') {
    const mode = actionEl.getAttribute('data-mode');
    const minutes = Number(actionEl.getAttribute('data-minutes'));
    store.update((s) => {
      s.focusSession.mode = mode;
      s.focusSession.isRunning = false;
      s.focusSession.durationSeconds = minutes * 60;
      s.focusSession.remainingSeconds = minutes * 60;
    });
  } else if (action === 'toggle-timer') {
    store.update((s) => {
      s.focusSession.isRunning = !s.focusSession.isRunning;
    });
  } else if (action === 'reset-timer') {
    store.update((s) => {
      s.focusSession.isRunning = false;
      s.focusSession.remainingSeconds = s.focusSession.durationSeconds;
    });
  } else if (action === 'complete-session-now') {
    const elapsedMin = Math.max(
      1,
      Math.round((store.state.focusSession.durationSeconds - store.state.focusSession.remainingSeconds) / 60) ||
        Math.round(store.state.focusSession.durationSeconds / 60)
    );
    soundEngine.playChime();
    store.update((s) => {
      s.focusSession.isRunning = false;
      s.focusSession.remainingSeconds = s.focusSession.durationSeconds;
      s.stats.totalFocusMinutes += elapsedMin;
      s.stats.todayFocusMinutes += elapsedMin;
      s.stats.completedPomodoros += 1;
      const task = s.tasks.find((t) => t.id === s.focusSession.linkedTaskId);
      if (task) task.completedPomodoros = (task.completedPomodoros || 0) + 1;
      const subj = s.subjects.find((sub) => sub.id === s.focusSession.linkedSubjectId);
      if (subj) subj.loggedMinutes = (subj.loggedMinutes || 0) + elapsedMin;

      if (!s.sessions) s.sessions = [];
      const nowMs = Date.now();
      const ses = makeSession({
        date: getTodayISO(),
        minutes: elapsedMin,
        trackId: s.focusSession.linkedSubjectId,
        taskId: s.focusSession.linkedTaskId,
        topic: task?.title || 'Deep Focus Session',
        rating: 5,
        source: 'timer'
      });
      s.sessions.push(ses);
      const strk = computeStreaks(s.sessions, getTodayISO());
      s.stats.currentStreakDays = strk.current || 1;
    });
    showToast(`Logged +${elapsedMin}m to track & task!`);
  } else if (action === 'toggle-sound') {
    const snd = actionEl.getAttribute('data-sound');
    const nextMode = soundEngine.play(snd);
    store.update((s) => {
      s.focusSession.soundscape = nextMode;
    });
  } else if (action === 'open-calendar-modal') {
    openModal('calendar-sync');
  } else if (action === 'open-task-modal') {
    openModal('task');
  } else if (action === 'open-block-modal') {
    openModal('block');
  } else if (action === 'open-program-modal') {
    openModal('program');
  } else if (action === 'open-flashcard-modal') {
    openModal('flashcard');
  } else if (action === 'open-cornell-modal') {
    openModal('cornell');
  } else if (action === 'open-subject-modal') {
    openModal('subject');
  } else if (action === 'open-backup-modal') {
    openModal('backup');
  } else if (action === 'close-modal' || (action === 'backdrop-close' && e.target === actionEl)) {
    closeModal();
  } else if (action === 'import-pasted-schedule') {
    const raw = document.getElementById('paste-schedule-textarea')?.value || '';
    if (!raw.trim()) {
      showToast('Paste schedule lines first');
      return;
    }
    const parsed = parseScheduleText(
      raw,
      store.state.selectedDate || getTodayISO(),
      store.state.subjects[0]?.id || 'subj-algo'
    );
    const res = store.importCalendarEvents(parsed);
    closeModal();
    showToast(`Imported ${res.addedBlocks} daily blocks & ${res.addedWeekly} recurring routine slots!`);
  } else if (action === 'export-ics') {
    const icsData = store.exportICS();
    const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chronostudy-schedule-${getTodayISO()}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported .ICS calendar file!');
  } else if (action === 'download-json-backup') {
    const dataStr = JSON.stringify(store.state, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chronostudy-backup-${getTodayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup JSON downloaded!');
  } else if (action === 'cloud-gist-push') {
    const githubToken = document.getElementById('sync-gh-token')?.value?.trim() || '';
    const gistId = document.getElementById('sync-gist-id')?.value?.trim() || '';
    const cfg = { ...loadSyncConfig(), provider: 'gist', githubToken, gistId };
    saveSyncConfig(cfg);
    try {
      const res = await pushToGitHubGist(store.state, cfg);
      saveSyncConfig({ ...cfg, gistId: res.gistId, lastSyncedAt: res.syncedAt });
      const gistInput = document.getElementById('sync-gist-id');
      if (gistInput) gistInput.value = res.gistId;
      showToast(`☁️ Synced to GitHub Gist (${res.gistId.slice(0, 8)}...)!`);
    } catch (err) {
      showToast(err.message || 'GitHub Sync failed');
    }
  } else if (action === 'cloud-gist-pull') {
    const githubToken = document.getElementById('sync-gh-token')?.value?.trim() || '';
    const gistId = document.getElementById('sync-gist-id')?.value?.trim() || '';
    const cfg = { ...loadSyncConfig(), provider: 'gist', githubToken, gistId };
    saveSyncConfig(cfg);
    try {
      const remoteState = await pullFromGitHubGist(cfg);
      store.update((s) => {
        Object.assign(s, remoteState);
      });
      closeModal();
      showToast('⬇️ Pulled latest planner state from GitHub Cloud!');
    } catch (err) {
      showToast(err.message || 'GitHub Pull failed');
    }
  } else if (action === 'copy-sync-link') {
    const url = createShareableSyncLink(store.state);
    try {
      await navigator.clipboard.writeText(url);
      showToast('🔗 Copied Instant Sync URL! Open it on your PC or Phone.');
    } catch (_) {
      prompt('Copy this Instant Sync URL:', url);
    }
  } else if (action === 'sync-to-lan-server') {
    const serverUrl = document.getElementById('sync-server-url')?.value?.trim() || '';
    const cfg = { ...loadSyncConfig(), serverUrl };
    saveSyncConfig(cfg);
    try {
      await pushToSyncServer(store.state, cfg);
      showToast('Synced state to PC Sync Server!');
    } catch (_) {
      showToast('Could not reach PC Sync Server (check URL or run npm start)');
    }
  } else if (action === 'pull-from-lan-server') {
    const serverUrl = document.getElementById('sync-server-url')?.value?.trim() || '';
    const cfg = { ...loadSyncConfig(), serverUrl };
    saveSyncConfig(cfg);
    try {
      const remote = await pullFromSyncServer(cfg);
      store.update((s) => {
        Object.assign(s, remote);
      });
      closeModal();
      showToast('Pulled latest state from PC Sync Server!');
    } catch (_) {
      showToast('Could not reach PC Sync Server');
    }
  } else if (action === 'export-to-google-sheets') {
    const sheetsUrl = document.getElementById('report-sheets-url')?.value?.trim();
    const periodType = document.getElementById('report-period-type')?.value || 'week';
    if (!sheetsUrl) {
      showToast('Paste your Google Sheets Webhook URL first (see chronostudy-sheets-reports)');
      return;
    }
    localStorage.setItem('chronostudy_sheets_webhook_url', sheetsUrl);
    showToast('🚀 Sending report to Google Sheets...');

    try {
      const report = buildReport(store.state, periodType, getTodayISO());
      await postReportToAppsScript(sheetsUrl, report);
      showToast('✅ Report successfully sent to your Google Sheet!');
    } catch (err) {
      showToast(err.message || 'Could not reach Google Sheets URL');
    }
  } else if (action === 'download-report-csv') {
    const periodType = document.getElementById('report-period-type')?.value || 'week';
    const report = buildReport(store.state, periodType, getTodayISO());
    const csvContent = reportToCSV(report);
    downloadBlob(csvContent, `chronostudy-${periodType}-report-${getTodayISO()}.csv`, 'text/csv;charset=utf-8');
    showToast('Downloaded study report CSV!');
  } else if (action === 'download-report-xlsx') {
    const periodType = document.getElementById('report-period-type')?.value || 'week';
    const report = buildReport(store.state, periodType, getTodayISO());
    const xlsxBuffer = reportToXLSX(report);
    downloadBlob(xlsxBuffer, `chronostudy-${periodType}-report-${getTodayISO()}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    showToast('Downloaded Excel (.xlsx) study report!');
  } else if (action === 'download-report-json') {
    const periodType = document.getElementById('report-period-type')?.value || 'week';
    const report = buildReport(store.state, periodType, getTodayISO());
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chronostudy-${periodType}-report-${getTodayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded study report JSON!');
  } else if (action === 'start-blank-slate') {
    store.startBlankSlate();
    closeModal();
    showToast('✨ Started clean Blank Slate workspace!');
  } else if (action === 'reset-demo-data') {
    store.resetToDemo();
    closeModal();
    showToast('Sample setup restored');
  }
});

// Change & Form Events
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'today-date-picker') {
    store.update((s) => {
      s.selectedDate = t.value;
    });
  } else if (t.id === 'filter-task-subject') {
    store.update((s) => {
      s.taskSubjectFilter = t.value;
    });
  } else if (t.id === 'focus-task-select') {
    store.update((s) => {
      s.focusSession.linkedTaskId = t.value;
    });
  } else if (t.id === 'focus-subject-select') {
    store.update((s) => {
      s.focusSession.linkedSubjectId = t.value;
    });
  } else if (t.id === 'sound-volume-slider') {
    soundEngine.setVolume(t.value);
  } else if (t.getAttribute('data-action') === 'toggle-subtask') {
    const taskId = t.getAttribute('data-task-id');
    const subtaskId = t.getAttribute('data-subtask-id');
    store.update((s) => {
      const task = s.tasks.find((x) => x.id === taskId);
      const st = task?.subtasks?.find((x) => x.id === subtaskId);
      if (st) st.done = t.checked;
    });
  } else if (t.getAttribute('data-action') === 'change-topic-status') {
    const id = t.getAttribute('data-id');
    const statusMap = { 'Not Started': 20, Learning: 60, Reviewing: 85, Mastered: 98 };
    store.update((s) => {
      const top = s.syllabusTopics.find((x) => x.id === id);
      if (top) {
        top.status = t.value;
        top.confidence = statusMap[t.value] || 70;
      }
    });
  } else if (t.getAttribute('data-action') === 'grade-input') {
    const id = t.getAttribute('data-id');
    const field = t.getAttribute('data-field');
    store.update((s) => {
      const sub = s.subjects.find((x) => x.id === id);
      if (sub && field) sub[field] = Number(t.value);
    });
  } else if (t.id === 'import-ics-input' && t.files?.[0]) {
    const subjId = document.getElementById('ics-import-subject')?.value || store.state.subjects[0]?.id;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = parseICSCalendar(ev.target.result, subjId);
        const res = store.importCalendarEvents(parsed);
        closeModal();
        showToast(`📅 Imported ${res.addedBlocks} events & ${res.addedWeekly} recurring slots from .ICS!`);
      } catch (_) {
        showToast('Could not parse .ICS file');
      }
    };
    reader.readAsText(t.files[0]);
  } else if (t.id === 'import-json-input' && t.files?.[0]) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        store.update((s) => {
          Object.assign(s, parsed);
        });
        closeModal();
        showToast('Backup restored successfully!');
      } catch (_) {
        showToast('Invalid JSON backup file');
      }
    };
    reader.readAsText(t.files[0]);
  }
});

document.addEventListener('submit', (e) => {
  const form = e.target;
  if (form.id === 'quick-task-form') {
    e.preventDefault();
    const rawTitle = document.getElementById('quick-task-title').value.trim();
    const fallbackSubjectId = document.getElementById('quick-task-subject').value;
    const fallbackQuadrant = document.getElementById('quick-task-quadrant').value;
    if (!rawTitle) return;

    const parsed = parseSmartTaskInput(
      rawTitle,
      store.state.subjects,
      store.state.selectedDate || getTodayISO()
    );

    store.update((s) => {
      s.tasks.unshift({
        id: 'task-' + Date.now(),
        title: parsed.title,
        subjectId: parsed.subjectId || fallbackSubjectId,
        quadrant: parsed.quadrant || fallbackQuadrant,
        status: 'todo',
        completed: false,
        dueDate: parsed.dueDate,
        estimatedPomodoros: parsed.estimatedPomodoros || 2,
        completedPomodoros: 0,
        subtasks: []
      });
    });
    showToast(`Added "${parsed.title}" (${parsed.quadrant || fallbackQuadrant})`);
  } else if (form.id === 'modal-task-form') {
    e.preventDefault();
    const fd = new FormData(form);
    const subtasksRaw = String(fd.get('subtasks') || '')
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);
    store.update((s) => {
      s.tasks.unshift({
        id: 'task-' + Date.now(),
        title: fd.get('title'),
        subjectId: fd.get('subjectId'),
        quadrant: fd.get('quadrant'),
        status: 'todo',
        completed: false,
        dueDate: fd.get('dueDate'),
        estimatedPomodoros: Number(fd.get('estimatedPomodoros') || 2),
        completedPomodoros: 0,
        subtasks: subtasksRaw.map((txt, i) => ({ id: `st-${Date.now()}-${i}`, text: txt, done: false }))
      });
    });
    closeModal();
    showToast('Task created!');
  } else if (form.id === 'modal-block-form') {
    e.preventDefault();
    const fd = new FormData(form);
    store.update((s) => {
      s.scheduleBlocks.push({
        id: 'blk-' + Date.now(),
        date: s.selectedDate,
        startTime: fd.get('startTime'),
        endTime: fd.get('endTime'),
        title: fd.get('title'),
        subjectId: fd.get('subjectId'),
        category: fd.get('category'),
        done: false
      });
    });
    closeModal();
    showToast('Time block scheduled!');
  } else if (form.id === 'modal-program-form') {
    e.preventDefault();
    const fd = new FormData(form);
    store.update((s) => {
      const day = s.selectedProgramDay || 0;
      if (!s.weeklyProgram[day]) s.weeklyProgram[day] = [];
      s.weeklyProgram[day].push({
        id: 'wp-' + Date.now(),
        startTime: fd.get('startTime'),
        endTime: fd.get('endTime'),
        title: fd.get('title'),
        subjectId: fd.get('subjectId'),
        type: fd.get('type')
      });
    });
    closeModal();
    showToast('Recurring slot added to Weekly Routine!');
  } else if (form.id === 'modal-flashcard-form') {
    e.preventDefault();
    const fd = new FormData(form);
    store.update((s) => {
      s.flashcards.unshift({
        id: 'fc-' + Date.now(),
        subjectId: fd.get('subjectId'),
        prompt: fd.get('prompt'),
        answer: fd.get('answer'),
        interval: 1,
        repetitions: 0,
        efactor: 2.5,
        dueDate: getTodayISO()
      });
    });
    closeModal();
    showToast('SM-2 Recall Card added!');
  } else if (form.id === 'modal-cornell-form') {
    e.preventDefault();
    const fd = new FormData(form);
    store.update((s) => {
      if (!s.cornellNotes) s.cornellNotes = [];
      s.cornellNotes.unshift({
        id: 'cn-' + Date.now(),
        subjectId: fd.get('subjectId'),
        title: fd.get('title'),
        date: getTodayISO(),
        cue: fd.get('cue'),
        notes: fd.get('notes'),
        summary: fd.get('summary')
      });
    });
    closeModal();
    showToast('Synthesis Note saved!');
  } else if (form.id === 'modal-subject-form') {
    e.preventDefault();
    const fd = new FormData(form);
    store.update((s) => {
      s.subjects.push({
        id: 'subj-' + Date.now(),
        code: fd.get('code'),
        name: fd.get('name'),
        color: fd.get('color'),
        examDate: fd.get('examDate'),
        targetHoursPerWeek: Number(fd.get('targetHoursPerWeek') || 6),
        loggedMinutes: 0,
        currentGrade: 90,
        examWeight: 35,
        targetCourseGrade: 90
      });
    });
    closeModal();
    showToast('New life/study track added!');
  }
});

// Register Service Worker for Mobile Offline PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

const incomingSnapshot = checkUrlSyncSnapshot();
if (incomingSnapshot) {
  store.update((s) => {
    Object.assign(s, incomingSnapshot);
  });
  setTimeout(() => showToast('🔗 Imported state from Instant Sync Link!'), 300);
}

async function runAutoCalendarSync({ silent = true } = {}) {
  const feeds = loadSavedCalendarFeeds();
  if (!feeds.length) return;
  let totalBlocks = 0;
  let totalWeekly = 0;
  const updatedFeeds = [];

  for (const feed of feeds) {
    try {
      const parsed = await fetchLiveCalendarFeed(feed.url, feed.subjectId || store.state.subjects[0]?.id);
      const res = store.importCalendarEvents(parsed);
      totalBlocks += res.addedBlocks;
      totalWeekly += res.addedWeekly;
      updatedFeeds.push({ ...feed, lastSyncedAt: new Date().toISOString() });
    } catch (_) {
      updatedFeeds.push(feed);
    }
  }

  saveCalendarFeeds(updatedFeeds);
  if (!silent || totalBlocks > 0 || totalWeekly > 0) {
    showToast(
      totalBlocks + totalWeekly > 0
        ? `🔄 Auto-Synced ${totalBlocks} new events & ${totalWeekly} weekly classes from your connected calendars!`
        : `✅ Connected calendars are up to date (${feeds.length} active feed${feeds.length > 1 ? 's' : ''})`
    );
  }
}

store.subscribe(renderApp);
renderApp();

// Automatically sync connected University & Google Calendar feeds on launch + every 15 minutes
setTimeout(() => runAutoCalendarSync({ silent: true }), 800);
setInterval(() => runAutoCalendarSync({ silent: true }), 15 * 60 * 1000);

