// src/ui/tasks-view.js — Study tasks list, MS To Do drawer & Task Edit Modal with event delegation
import { store, toLocalDateStr } from '../store.js';
import { getRecurrenceLabel } from '../domain/recurrence.js';
import { formatRelativeDueDate } from '../domain/date-utils.js';
import { playClickSound } from '../audio.js';
import { escapeHTML, sanitizeCssColor } from './dom-utils.js';
import { openModal, closeModal, showInAppConfirm } from './modals.js';

function getDayAnchors() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toLocalDateStr(today);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toLocalDateStr(yesterday);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = toLocalDateStr(tomorrow);

  const endOfWeek = new Date(today);
  const dayOfWeek = today.getDay() || 7;
  endOfWeek.setDate(today.getDate() + (7 - dayOfWeek));
  const endOfWeekStr = toLocalDateStr(endOfWeek);

  return { todayStr, yesterdayStr, tomorrowStr, endOfWeekStr };
}

function resolveQuickPresetDate(preset) {
  const d = new Date();
  if (preset === 'today') return toLocalDateStr(d);
  if (preset === 'tomorrow') {
    d.setDate(d.getDate() + 1);
    return toLocalDateStr(d);
  }
  if (preset === 'nextweek') {
    const day = d.getDay() || 7;
    d.setDate(d.getDate() + (8 - day));
    return toLocalDateStr(d);
  }
  return null;
}

function sortTasksList(list, sortBy) {
  list.sort((a, b) => {
    if (sortBy === 'dueDate') {
      if (!a.dueDate && !b.dueDate) return a.title.localeCompare(b.title);
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    }
    if (sortBy === 'subject') {
      return (a.subject || 'ZZZ').localeCompare(b.subject || 'ZZZ') || a.title.localeCompare(b.title);
    }
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    if (sortBy === 'duration') return (b.targetMinutes || 0) - (a.targetMinutes || 0);
    if (sortBy === 'created') return (b.createdAt || '').localeCompare(a.createdAt || '');
    return 0;
  });
}

function groupTasksList(list, groupBy, anchors) {
  const { todayStr, yesterdayStr, tomorrowStr, endOfWeekStr } = anchors;
  const groupsMap = new Map();

  list.forEach((task) => {
    let groupKey = 'Other';
    if (groupBy === 'dueDate') {
      if (task.completed) {
        groupKey = store.isMidnightTimestamp(task.completedAt)
          ? 'Completed (Midnight 00:00–05:00)'
          : 'Completed Tasks';
      } else if (!task.dueDate) {
        groupKey = (task.recurrence && task.recurrence !== 'none') ? 'Today' : 'No Due Date';
      } else if (task.dueDate === todayStr) {
        groupKey = 'Today';
      } else if (task.dueDate < todayStr) {
        groupKey = (store.isFrequentRecurringTask(task) && task.dueDate === yesterdayStr) ? 'Yesterday' : 'Overdue';
      } else if (task.dueDate === tomorrowStr) {
        groupKey = 'Tomorrow';
      } else if (task.dueDate <= endOfWeekStr) {
        groupKey = 'This Week';
      } else {
        groupKey = 'Later';
      }
    } else if (groupBy === 'subject') {
      groupKey = task.subject ? task.subject : 'General (No Course)';
    } else if (groupBy === 'recurrence') {
      groupKey = (task.recurrence && task.recurrence !== 'none') ? 'Recurring Tasks' : 'One-Time Tasks';
    }

    if (!groupsMap.has(groupKey)) groupsMap.set(groupKey, []);
    groupsMap.get(groupKey).push(task);
  });

  const orderedKeys = Array.from(groupsMap.keys());
  if (groupBy === 'dueDate') {
    const dueOrder = ['Overdue', 'Today', 'Yesterday', 'Tomorrow', 'This Week', 'Later', 'No Due Date', 'Completed (Midnight 00:00–05:00)', 'Completed Tasks'];
    orderedKeys.sort((a, b) => {
      const idxA = dueOrder.indexOf(a);
      const idxB = dueOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  } else {
    orderedKeys.sort((a, b) => a.localeCompare(b));
  }

  return orderedKeys.map((key) => ({ title: key, tasks: groupsMap.get(key) }));
}

export class TasksViewController {
  constructor(ui) {
    this.ui = ui;
    this.currentTaskFilter = 'pending';
    this.currentSubjectFilter = 'all';
    this.taskViewFilter = 'todo';
    this.taskGroupBy = 'dueDate';
    this.taskSortBy = 'dueDate';
    this.collapsedTaskGroups = new Set();

    this.currentSidebarFilter = 'pending';
    this.sidebarTaskGroupBy = 'dueDate';
    this.sidebarTaskSortBy = 'dueDate';
    this.collapsedSidebarGroups = new Set();
    this.selectedSidebarDueDate = null;
  }

  initDOM() {
    this.taskForm = document.getElementById('new-task-form');
    this.taskTitleInput = document.getElementById('task-title-input');
    this.taskSubjectSelect = document.getElementById('task-subject-select');
    this.taskTargetInput = document.getElementById('task-target-input');
    this.taskDueDateInput = document.getElementById('task-due-date-input');
    this.taskRecurrenceSelect = document.getElementById('task-recurrence-select');
    this.taskListContainer = document.getElementById('task-list-container');
    this.taskFilterTabs = document.querySelectorAll('.task-filter-tab:not([data-sfilter])');
    this.taskSubjectFilter = document.getElementById('task-subject-filter');
    this.todoTabBtns = document.querySelectorAll('.todo-tab-btn');
    this.taskGroupBySelect = document.getElementById('task-group-by');
    this.taskSortBySelect = document.getElementById('task-sort-by');

    this.focusQuickDates = document.getElementById('focus-quick-dates');
    this.focusClearDate = document.getElementById('focus-clear-date');
    this.btnExpandTasks = document.getElementById('btn-expand-tasks');
    this.taskBadgeCount = document.getElementById('task-badge-count');
    this.focusSegTaskCount = document.getElementById('focus-seg-task-count');

    // Global Sidebar Drawer
    this.btnToggleTaskSidebar = document.getElementById('btn-toggle-task-sidebar');
    this.btnCloseTaskSidebar = document.getElementById('btn-close-task-sidebar');
    this.taskSidebarBackdrop = document.getElementById('task-sidebar-backdrop');
    this.globalTaskSidebar = document.getElementById('global-task-sidebar');
    this.sidebarTaskCount = document.getElementById('sidebar-task-count');
    this.sidebarTaskForm = document.getElementById('sidebar-task-form');
    this.sidebarTaskTitle = document.getElementById('sidebar-task-title');
    this.sidebarTaskSubject = document.getElementById('sidebar-task-subject');
    this.sidebarTaskRecurrence = document.getElementById('sidebar-task-recurrence');
    this.sidebarQuickDates = document.getElementById('sidebar-quick-dates');
    this.sidebarTaskDueDate = document.getElementById('sidebar-task-duedate');
    this.sidebarDatePickerLabel = document.getElementById('sidebar-date-picker-label');
    this.sidebarClearDate = document.getElementById('sidebar-clear-date');
    this.sidebarTaskList = document.getElementById('sidebar-task-list');
    this.sidebarFilterTabs = document.querySelectorAll('.task-sidebar-drawer [data-sfilter]');
    this.sidebarTaskGroup = document.getElementById('sidebar-task-group');
    this.sidebarTaskSort = document.getElementById('sidebar-task-sort');
    this.sidebarTaskSubjectFilter = document.getElementById('sidebar-task-subject-filter');

    // Task Edit Modal
    this.taskEditModal = document.getElementById('task-edit-modal');
    this.btnCloseEditTaskModal = document.getElementById('btn-close-edit-task-modal');
    this.btnCancelEditTask = document.getElementById('btn-cancel-edit-task');
    this.btnDeleteFromEditModal = document.getElementById('btn-delete-from-edit-modal');
    this.taskEditForm = document.getElementById('task-edit-form');
    this.editTaskId = document.getElementById('edit-task-id');
    this.editTaskTitle = document.getElementById('edit-task-title');
    this.editTaskSubject = document.getElementById('edit-task-subject');
    this.editTaskMinutes = document.getElementById('edit-task-minutes');
    this.editTaskTimeSpent = document.getElementById('edit-task-time-spent');
    this.editTaskDueDate = document.getElementById('edit-task-duedate');
    this.editTaskRecurrence = document.getElementById('edit-task-recurrence');
    this.editTaskNotes = document.getElementById('edit-task-notes');
    this.editTaskSessionsSummary = document.getElementById('edit-task-sessions-summary');
    this.editTaskSessionsCount = document.getElementById('edit-task-sessions-count');
    this.editTaskLogDate = document.getElementById('edit-task-log-date');
    this.editTaskLogMins = document.getElementById('edit-task-log-mins');
    this.editTaskLogNotes = document.getElementById('edit-task-log-notes');
    this.btnEditTaskAddSession = document.getElementById('btn-edit-task-add-session');
    this.editTaskSessionsList = document.getElementById('edit-task-sessions-list');
  }

  bindEvents() {
    if (this.btnExpandTasks) {
      this.btnExpandTasks.addEventListener('click', () => this.toggleTasksExpanded());
    }
    if (this.btnToggleTaskSidebar) {
      this.btnToggleTaskSidebar.addEventListener('click', () => {
        this.toggleTaskSidebar();
        playClickSound();
      });
    }
    if (this.btnCloseTaskSidebar) {
      this.btnCloseTaskSidebar.addEventListener('click', () => {
        this.closeTaskSidebar();
        playClickSound();
      });
    }
    if (this.taskSidebarBackdrop) {
      this.taskSidebarBackdrop.addEventListener('click', () => this.closeTaskSidebar());
    }

    if (this.sidebarTaskForm) {
      this.sidebarTaskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = this.sidebarTaskTitle.value.trim();
        if (!title) return;
        const subject = this.sidebarTaskSubject.value || null;
        const recurrence = this.sidebarTaskRecurrence ? this.sidebarTaskRecurrence.value : 'none';
        const dueDate = this.selectedSidebarDueDate || null;
        store.addTask({ title, subject, recurrence, targetMinutes: null, dueDate });
        this.sidebarTaskTitle.value = '';
        if (this.sidebarTaskRecurrence) this.sidebarTaskRecurrence.value = 'none';
        this.setSidebarDueDate(null);
        playClickSound();
      });
    }

    if (this.sidebarQuickDates) {
      this.sidebarQuickDates.addEventListener('click', (e) => {
        const chip = e.target.closest('.quick-date-chip[data-sidebar-preset]');
        if (!chip) return;
        const preset = chip.dataset.sidebarPreset;
        this.setSidebarDueDate(resolveQuickPresetDate(preset), preset);
        playClickSound();
      });
    }
    if (this.sidebarTaskDueDate) {
      this.sidebarTaskDueDate.addEventListener('change', () => {
        this.setSidebarDueDate(this.sidebarTaskDueDate.value || null, null);
      });
    }
    if (this.sidebarClearDate) {
      this.sidebarClearDate.addEventListener('click', () => {
        this.setSidebarDueDate(null);
        playClickSound();
      });
    }

    if (this.sidebarFilterTabs) {
      this.sidebarFilterTabs.forEach((tab) => {
        tab.addEventListener('click', () => {
          this.sidebarFilterTabs.forEach((t) => t.classList.remove('active'));
          tab.classList.add('active');
          this.currentSidebarFilter = tab.dataset.sfilter || 'pending';
          this.renderSidebarTasks();
          playClickSound();
        });
      });
    }
    if (this.sidebarTaskGroup) {
      this.sidebarTaskGroup.addEventListener('change', () => {
        this.sidebarTaskGroupBy = this.sidebarTaskGroup.value;
        this.renderSidebarTasks();
      });
    }
    if (this.sidebarTaskSort) {
      this.sidebarTaskSort.addEventListener('change', () => {
        this.sidebarTaskSortBy = this.sidebarTaskSort.value;
        this.renderSidebarTasks();
      });
    }
    if (this.sidebarTaskSubjectFilter) {
      this.sidebarTaskSubjectFilter.addEventListener('change', () => this.renderSidebarTasks());
    }

    // Main Task Form & Quick Date Chips
    if (this.taskForm) {
      this.taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = this.taskTitleInput.value.trim();
        const subject = this.taskSubjectSelect.value || null;
        const targetMinutes = this.taskTargetInput.value ? parseInt(this.taskTargetInput.value, 10) : null;
        const dueDate = this.taskDueDateInput.value || null;
        const recurrence = this.taskRecurrenceSelect ? this.taskRecurrenceSelect.value : 'none';
        if (!title) return;
        store.addTask({ title, subject, targetMinutes, dueDate, recurrence });
        this.taskTitleInput.value = '';
        this.taskTargetInput.value = '';
        this.taskDueDateInput.value = '';
        if (this.taskRecurrenceSelect) this.taskRecurrenceSelect.value = 'none';
        this.updateFocusDateChips(null);
        playClickSound();
      });
    }

    if (this.focusQuickDates) {
      this.focusQuickDates.addEventListener('click', (e) => {
        const btn = e.target.closest('.quick-date-chip[data-focus-preset]');
        if (!btn) return;
        const preset = btn.dataset.focusPreset;
        if (this.taskDueDateInput) {
          this.taskDueDateInput.value = resolveQuickPresetDate(preset) || '';
        }
        this.updateFocusDateChips(preset);
        playClickSound();
      });
    }
    if (this.focusClearDate) {
      this.focusClearDate.addEventListener('click', () => {
        if (this.taskDueDateInput) this.taskDueDateInput.value = '';
        this.updateFocusDateChips(null);
        playClickSound();
      });
    }
    if (this.taskDueDateInput) {
      this.taskDueDateInput.addEventListener('change', () => this.updateFocusDateChips());
    }

    if (this.todoTabBtns) {
      this.todoTabBtns.forEach((tab) => {
        tab.addEventListener('click', () => {
          this.todoTabBtns.forEach((t) => t.classList.remove('active'));
          tab.classList.add('active');
          this.taskViewFilter = tab.dataset.view || 'todo';
          this.renderTasks();
          playClickSound();
        });
      });
    }
    if (this.taskGroupBySelect) {
      this.taskGroupBySelect.addEventListener('change', () => {
        this.taskGroupBy = this.taskGroupBySelect.value;
        this.renderTasks();
      });
    }
    if (this.taskSortBySelect) {
      this.taskSortBySelect.addEventListener('change', () => {
        this.taskSortBy = this.taskSortBySelect.value;
        this.renderTasks();
      });
    }
    if (this.taskSubjectFilter) {
      this.taskSubjectFilter.addEventListener('change', () => {
        this.currentSubjectFilter = this.taskSubjectFilter.value;
        this.renderTasks();
      });
    }

    // Event delegation for main Task List
    if (this.taskListContainer) {
      this.taskListContainer.addEventListener('change', (e) => {
        const cb = e.target.closest('.task-checkbox');
        if (!cb) return;
        store.toggleTask(cb.dataset.taskId);
        playClickSound();
      });

      this.taskListContainer.addEventListener('click', async (e) => {
        const groupHeader = e.target.closest('.task-group-header[data-group-title]');
        if (groupHeader) {
          const title = groupHeader.dataset.groupTitle;
          if (this.collapsedTaskGroups.has(title)) this.collapsedTaskGroups.delete(title);
          else this.collapsedTaskGroups.add(title);
          this.renderTasks();
          playClickSound();
          return;
        }

        const btnMove = e.target.closest('.btn-move-today');
        if (btnMove) {
          e.stopPropagation();
          store.updateTask(btnMove.dataset.taskId, { dueDate: toLocalDateStr(new Date()) });
          playClickSound();
          return;
        }

        const btnMoveTomorrow = e.target.closest('.btn-move-tomorrow');
        if (btnMoveTomorrow) {
          e.stopPropagation();
          store.updateTask(btnMoveTomorrow.dataset.taskId, { dueDate: resolveQuickPresetDate('tomorrow') });
          playClickSound();
          return;
        }

        const btnStudy = e.target.closest('.btn-study-now');
        if (btnStudy) {
          const task = store.getState().tasks.find((t) => t.id === btnStudy.dataset.taskId);
          if (task) {
            this.ui.startTaskStudySession(task);
            playClickSound();
          }
          return;
        }

        const btnLogTime = e.target.closest('.btn-log-time');
        if (btnLogTime) {
          e.stopPropagation();
          this.openTaskEditModal(btnLogTime.dataset.taskId, { focusTimeSpent: true });
          playClickSound();
          return;
        }

        const btnEdit = e.target.closest('.btn-edit-task');
        if (btnEdit) {
          e.stopPropagation();
          this.openTaskEditModal(btnEdit.dataset.taskId);
          playClickSound();
          return;
        }

        const btnDel = e.target.closest('.btn-delete-task');
        if (btnDel) {
          const task = store.getState().tasks.find((t) => t.id === btnDel.dataset.taskId);
          if (task) {
            const ok = await showInAppConfirm({
              title: 'Delete Study Task',
              message: `Delete study task "${task.title}"?`,
              confirmText: 'Delete',
              danger: true
            });
            if (ok) {
              store.deleteTask(task.id);
              playClickSound();
            }
          }
          return;
        }

        const titleEl = e.target.closest('.task-title.clickable-title');
        if (titleEl) {
          const card = titleEl.closest('.task-card');
          const taskId = card?.dataset.taskId || card?.querySelector('.task-checkbox')?.dataset.taskId;
          if (taskId) this.openTaskEditModal(taskId);
        }
      });
    }

    // Event delegation for Sidebar Task List
    if (this.sidebarTaskList) {
      this.sidebarTaskList.addEventListener('change', (e) => {
        const cb = e.target.closest('.sidebar-task-cb');
        if (!cb) return;
        store.toggleTask(cb.dataset.taskId);
        playClickSound();
      });

      this.sidebarTaskList.addEventListener('click', async (e) => {
        const header = e.target.closest('.task-group-header[data-sidebar-group]');
        if (header) {
          const title = header.dataset.sidebarGroup;
          if (this.collapsedSidebarGroups.has(title)) this.collapsedSidebarGroups.delete(title);
          else this.collapsedSidebarGroups.add(title);
          this.renderSidebarTasks();
          playClickSound();
          return;
        }

        const btnMove = e.target.closest('.btn-sidebar-move-today');
        if (btnMove) {
          e.stopPropagation();
          store.updateTask(btnMove.dataset.taskId, { dueDate: toLocalDateStr(new Date()) });
          playClickSound();
          return;
        }

        const btnMoveTomorrow = e.target.closest('.btn-sidebar-move-tomorrow');
        if (btnMoveTomorrow) {
          e.stopPropagation();
          store.updateTask(btnMoveTomorrow.dataset.taskId, { dueDate: resolveQuickPresetDate('tomorrow') });
          playClickSound();
          return;
        }

        const btnStudy = e.target.closest('.btn-sidebar-study');
        if (btnStudy) {
          const task = store.getState().tasks.find((t) => t.id === btnStudy.dataset.taskId);
          if (task) {
            this.closeTaskSidebar();
            this.ui.switchView('focus');
            this.ui.startTaskStudySession(task);
            playClickSound();
          }
          return;
        }

        const btnEdit = e.target.closest('.btn-sidebar-edit-task');
        if (btnEdit) {
          e.stopPropagation();
          this.openTaskEditModal(btnEdit.dataset.taskId);
          playClickSound();
          return;
        }

        const btnDel = e.target.closest('.btn-del-sidebar-task');
        if (btnDel) {
          const task = store.getState().tasks.find((t) => t.id === btnDel.dataset.taskId);
          if (task) {
            const ok = await showInAppConfirm({
              title: 'Delete Study Task',
              message: `Delete study task "${task.title}"?`,
              confirmText: 'Delete',
              danger: true
            });
            if (ok) {
              store.deleteTask(task.id);
              playClickSound();
            }
          }
          return;
        }

        const titleEl = e.target.closest('.task-title.clickable-title');
        if (titleEl) {
          const card = titleEl.closest('.task-card');
          const taskId = card?.dataset.taskId || card?.querySelector('.sidebar-task-cb')?.dataset.taskId;
          if (taskId) this.openTaskEditModal(taskId);
        }
      });
    }

    // Task Edit Modal listeners
    if (this.btnCloseEditTaskModal) {
      this.btnCloseEditTaskModal.addEventListener('click', () => this.closeTaskEditModal());
    }
    if (this.btnCancelEditTask) {
      this.btnCancelEditTask.addEventListener('click', () => this.closeTaskEditModal());
    }
    if (this.taskEditModal) {
      this.taskEditModal.addEventListener('click', (e) => {
        if (e.target === this.taskEditModal) this.closeTaskEditModal();
      });
    }
    if (this.btnDeleteFromEditModal) {
      this.btnDeleteFromEditModal.addEventListener('click', async () => {
        const taskId = this.editTaskId ? this.editTaskId.value : '';
        if (!taskId) return;
        const task = store.getState().tasks.find((t) => t.id === taskId);
        const ok = await showInAppConfirm({
          title: 'Delete Study Task',
          message: `Delete study task "${task ? task.title : 'this task'}"?`,
          confirmText: 'Delete',
          danger: true
        });
        if (ok) {
          store.deleteTask(taskId);
          playClickSound();
          this.closeTaskEditModal();
        }
      });
    }
    if (this.btnEditTaskAddSession) {
      this.btnEditTaskAddSession.addEventListener('click', () => {
        this.addStudySessionFromEditModal();
      });
    }
    const handleLogEnter = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.addStudySessionFromEditModal();
      }
    };
    if (this.editTaskLogMins) this.editTaskLogMins.addEventListener('keydown', handleLogEnter);
    if (this.editTaskLogNotes) this.editTaskLogNotes.addEventListener('keydown', handleLogEnter);

    if (this.editTaskSessionsList) {
      this.editTaskSessionsList.addEventListener('click', async (e) => {
        const delBtn = e.target.closest('.btn-delete-task-session');
        if (!delBtn) return;
        const sessionId = delBtn.dataset.sessionId;
        const taskId = this.editTaskId ? this.editTaskId.value : '';
        if (!sessionId) return;
        const ok = await showInAppConfirm({
          title: 'Delete Study Log',
          message: 'Remove this study log entry from this day?',
          confirmText: 'Delete',
          danger: true
        });
        if (ok) {
          store.deleteSession(sessionId);
          playClickSound();
          if (taskId) this.renderEditTaskSessions(taskId);
        }
      });
    }

    if (this.taskEditForm) {
      this.taskEditForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const taskId = this.editTaskId ? this.editTaskId.value : '';
        if (!taskId) return;
        const title = this.editTaskTitle ? this.editTaskTitle.value.trim() : '';
        if (!title) return;
        const updates = {
          title,
          subject: this.editTaskSubject ? this.editTaskSubject.value : '',
          targetMinutes: (this.editTaskMinutes && this.editTaskMinutes.value) ? parseInt(this.editTaskMinutes.value, 10) : null,
          dueDate: (this.editTaskDueDate && this.editTaskDueDate.value) ? this.editTaskDueDate.value : null,
          recurrence: this.editTaskRecurrence ? this.editTaskRecurrence.value : 'none',
          notes: this.editTaskNotes ? this.editTaskNotes.value.trim() : ''
        };
        store.updateTask(taskId, updates);

        // If the user entered minutes in the inline log input and clicked Save Changes directly, log that session too
        if (this.editTaskLogMins && this.editTaskLogMins.value !== '') {
          const pendingMins = parseInt(this.editTaskLogMins.value, 10);
          if (!Number.isNaN(pendingMins) && pendingMins > 0) {
            const logDate = (this.editTaskLogDate && this.editTaskLogDate.value)
              ? this.editTaskLogDate.value
              : toLocalDateStr(new Date());
            const logNotes = this.editTaskLogNotes ? this.editTaskLogNotes.value.trim() : '';
            store.addTaskSession(taskId, {
              dateStr: logDate,
              durationMins: pendingMins,
              notes: logNotes
            });
          }
        }

        playClickSound();
        this.closeTaskEditModal();
      });
    }
  }

  toggleTasksExpanded() {
    const grid = document.querySelector('.pc-dashboard-grid');
    if (!grid) return;
    grid.classList.toggle('tasks-expanded');
    const isExpanded = grid.classList.contains('tasks-expanded');
    if (this.btnExpandTasks) {
      this.btnExpandTasks.innerHTML = isExpanded ? '⤡ Split' : '⤢ Expand';
      this.btnExpandTasks.setAttribute('title', isExpanded ? 'Restore Split View' : 'Expand Tasks View');
    }
    playClickSound();
  }

  openTaskSidebar() {
    if (this.globalTaskSidebar) {
      this.globalTaskSidebar.classList.add('open');
      if (this.taskSidebarBackdrop) this.taskSidebarBackdrop.classList.add('active');
      this.renderSidebarTasks();
      if (this.sidebarTaskTitle) this.sidebarTaskTitle.focus();
    }
  }

  closeTaskSidebar() {
    if (this.globalTaskSidebar) {
      this.globalTaskSidebar.classList.remove('open');
      if (this.taskSidebarBackdrop) this.taskSidebarBackdrop.classList.remove('active');
    }
  }

  toggleTaskSidebar() {
    if (this.globalTaskSidebar && this.globalTaskSidebar.classList.contains('open')) {
      this.closeTaskSidebar();
    } else {
      this.openTaskSidebar();
    }
  }

  setSidebarDueDate(dateStr, presetName = null) {
    this.selectedSidebarDueDate = dateStr;
    if (this.sidebarTaskDueDate) this.sidebarTaskDueDate.value = dateStr || '';
    if (this.sidebarQuickDates) {
      this.sidebarQuickDates.querySelectorAll('.quick-date-chip[data-sidebar-preset]').forEach((btn) => {
        btn.classList.toggle('active', Boolean(presetName && btn.dataset.sidebarPreset === presetName));
      });
    }
    if (this.sidebarDatePickerLabel) {
      if (dateStr && !presetName) {
        this.sidebarDatePickerLabel.textContent = dateStr;
        this.sidebarDatePickerLabel.parentElement.classList.add('active');
      } else {
        this.sidebarDatePickerLabel.textContent = 'Pick Date';
        this.sidebarDatePickerLabel.parentElement.classList.remove('active');
      }
    }
    if (this.sidebarClearDate) {
      this.sidebarClearDate.style.display = dateStr ? 'inline-flex' : 'none';
    }
  }

  updateFocusDateChips(activePreset = null) {
    const val = this.taskDueDateInput ? this.taskDueDateInput.value : '';
    const todayStr = toLocalDateStr(new Date());
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = toLocalDateStr(tomorrow);

    let preset = activePreset;
    if (!preset && val) {
      if (val === todayStr) preset = 'today';
      else if (val === tomorrowStr) preset = 'tomorrow';
    }
    if (this.focusQuickDates) {
      this.focusQuickDates.querySelectorAll('.quick-date-chip[data-focus-preset]').forEach((btn) => {
        btn.classList.toggle('active', Boolean(preset && btn.dataset.focusPreset === preset));
      });
    }
    if (this.focusClearDate) {
      this.focusClearDate.style.display = val ? 'inline-flex' : 'none';
    }
  }

  openTaskEditModal(taskId, options = {}) {
    const task = store.getState().tasks.find((t) => t.id === taskId);
    if (!task) return;

    if (this.editTaskSubject) {
      this.editTaskSubject.innerHTML = '<option value="">General (No Course)</option>';
      (store.getState().subjects || []).forEach((s) => {
        const opt = document.createElement('option');
        opt.value = s.name;
        opt.textContent = s.code ? `${s.name} (${s.code})` : s.name;
        this.editTaskSubject.appendChild(opt);
      });
    }

    if (this.editTaskId) this.editTaskId.value = task.id;
    if (this.editTaskTitle) this.editTaskTitle.value = task.title || '';
    if (this.editTaskSubject) this.editTaskSubject.value = task.subject || '';
    if (this.editTaskMinutes) this.editTaskMinutes.value = task.targetMinutes || '';
    if (this.editTaskDueDate) this.editTaskDueDate.value = task.dueDate || '';
    if (this.editTaskRecurrence) this.editTaskRecurrence.value = task.recurrence || 'none';
    if (this.editTaskNotes) this.editTaskNotes.value = task.notes || '';
    if (this.editTaskLogDate) this.editTaskLogDate.value = toLocalDateStr(new Date());
    if (this.editTaskLogMins) this.editTaskLogMins.value = '';
    if (this.editTaskLogNotes) this.editTaskLogNotes.value = '';

    this.renderEditTaskSessions(task.id);

    const focusTarget = (options.focusTimeSpent && this.editTaskLogMins) ? this.editTaskLogMins : this.editTaskTitle;
    openModal(this.taskEditModal, { initialFocusEl: focusTarget });
  }

  addStudySessionFromEditModal() {
    const taskId = this.editTaskId ? this.editTaskId.value : '';
    if (!taskId || !this.editTaskLogMins) return;
    const mins = parseInt(this.editTaskLogMins.value, 10);
    if (Number.isNaN(mins) || mins <= 0) {
      this.editTaskLogMins.focus();
      return;
    }

    const dateStr = (this.editTaskLogDate && this.editTaskLogDate.value)
      ? this.editTaskLogDate.value
      : toLocalDateStr(new Date());
    const notes = this.editTaskLogNotes ? this.editTaskLogNotes.value.trim() : '';

    store.addTaskSession(taskId, {
      dateStr,
      durationMins: mins,
      notes
    });

    this.editTaskLogMins.value = '';
    if (this.editTaskLogNotes) this.editTaskLogNotes.value = '';
    playClickSound();
    this.renderEditTaskSessions(taskId);
    this.editTaskLogMins.focus();
  }

  renderEditTaskSessions(taskId) {
    const task = store.getState().tasks.find((t) => t.id === taskId);
    if (!task) return;
    const sessStats = store.getTaskSessionStats(task);

    if (this.editTaskTimeSpent) {
      this.editTaskTimeSpent.value = sessStats.totalMins > 0 ? String(sessStats.totalMins) : '0';
    }
    if (this.editTaskSessionsCount) {
      this.editTaskSessionsCount.textContent = `${sessStats.sessionCount} ${sessStats.sessionCount === 1 ? 'session' : 'sessions'} · ${sessStats.totalMins}m total`;
    }
    if (!this.editTaskSessionsList) return;

    const sortedSessions = [...(sessStats.sessions || [])].sort(
      (a, b) => new Date(b.startTime || b.endTime || b.createdAt || 0).getTime() - new Date(a.startTime || a.endTime || a.createdAt || 0).getTime()
    );

    if (sortedSessions.length === 0) {
      this.editTaskSessionsList.innerHTML = `<div class="task-session-empty-hint">No study logs yet. Pick a date & minutes above to add a separate session.</div>`;
      return;
    }

    this.editTaskSessionsList.innerHTML = sortedSessions.map((s) => {
      const dStr = store.getSessionDateStr(s);
      const tStr = s.startTime ? new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      const mins = Math.max(1, Math.round((s.durationSec || 0) / 60));
      const midMark = store.isMidnightTimestamp(s.startTime || s.endTime) ? ' 🌙' : '';
      const safeSessId = escapeHTML(s.id);
      const noteHtml = s.notes ? `<span class="task-session-mini-note" title="${escapeHTML(s.notes)}">${escapeHTML(s.notes)}</span>` : '';
      return `
        <div class="task-session-mini-row">
          <div class="task-session-mini-meta">
            <span>${escapeHTML(dStr)}${tStr ? ` · ${escapeHTML(tStr)}` : ''}${midMark}</span>
            ${noteHtml}
          </div>
          <div class="task-session-mini-right">
            <strong>${mins}m</strong>
            <button type="button" class="btn-delete-task-session" data-session-id="${safeSessId}" title="Delete this study log" aria-label="Delete study log">✕</button>
          </div>
        </div>
      `;
    }).join('');
  }

  closeTaskEditModal() {
    if (this.taskEditModal) closeModal(this.taskEditModal);
  }

  updateTaskBadgeCounts() {
    const tasks = store.getState().tasks || [];
    const todayStr = toLocalDateStr(new Date());
    const pendingCount = tasks.filter((t) => !t.completed && !store.isExpiredFrequentTask(t, todayStr)).length;

    if (this.taskBadgeCount) this.taskBadgeCount.textContent = pendingCount;
    if (this.sidebarTaskCount) this.sidebarTaskCount.textContent = pendingCount;
    if (this.focusSegTaskCount) this.focusSegTaskCount.textContent = pendingCount;
    const headerPending = document.getElementById('stat-pending-tasks');
    if (headerPending) headerPending.textContent = `${pendingCount} to do`;
  }

  createTaskCardHTML(task, todayStr, { compact = false } = {}) {
    const color = sanitizeCssColor(store.getSubjectColor(task.subject));
    const safeId = escapeHTML(task.id);
    const sessStats = store.getTaskSessionStats(task);
    const timeLoggedMins = sessStats.totalMins;
    const sessWord = sessStats.sessionCount === 1 ? 'session' : 'sessions';
    const isOverdue = Boolean(task.dueDate && task.dueDate < todayStr && !task.completed);
    const isMidnightDone = Boolean(task.completed && store.isMidnightTimestamp(task.completedAt));
    const midnightTimeStr = (!compact && isMidnightDone)
      ? new Date(task.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    let targetProgressBadgeHTML = '';
    if (task.targetMinutes) {
      const targetMins = task.targetMinutes;
      const pct = Math.min(100, Math.round((timeLoggedMins / targetMins) * 100));
      const isMet = timeLoggedMins >= targetMins;
      const fsStyle = compact ? ' style="font-size: 0.65rem;"' : '';
      targetProgressBadgeHTML = `
        <span class="task-target-progress-pill ${isMet ? 'target-met' : ''}"${fsStyle} title="Target: ${targetMins}m • Studied: ${timeLoggedMins}m (${pct}%) across ${sessStats.sessionCount} ${sessWord}">
          <span class="task-progress-mini-bar" style="width: ${pct}%;"></span>
          <span class="task-progress-mini-text">◷ ${timeLoggedMins}/${targetMins}m (${pct}%)${sessStats.sessionCount > 0 ? ` · ${sessStats.sessionCount} ${compact ? 'sess' : sessWord}` : ''}</span>
        </span>
      `;
    } else if (sessStats.sessionCount > 0 || timeLoggedMins > 0) {
      targetProgressBadgeHTML = (!compact && task.completed)
        ? `<span class="meta-badge logged-badge task-sessions-done-badge" title="Completed in ${sessStats.sessionCount} ${sessWord}">✓ ${sessStats.sessionCount} ${sessWord} (${timeLoggedMins}m)</span>`
        : `<span class="meta-badge logged-badge" ${compact ? 'style="font-size: 0.65rem;"' : ''} title="${sessStats.sessionCount} ${sessWord}">◷ ${sessStats.sessionCount} ${compact ? 'sess' : sessWord} · ${timeLoggedMins}m</span>`;
    }

    const dueLabel = task.dueDate ? formatRelativeDueDate(task.dueDate, todayStr, { includePrefix: !compact }) : '';
    const cbClass = compact ? 'sidebar-task-cb' : 'task-checkbox';
    const moveClass = compact ? 'btn-sidebar-move-today' : 'btn-move-today';
    const moveTomorrowClass = compact ? 'btn-sidebar-move-tomorrow' : 'btn-move-tomorrow';
    const studyClass = compact ? 'btn-study-now btn-sidebar-study' : 'btn-study-now';
    const editClass = compact ? 'btn-sidebar-edit-task' : 'btn-edit-task';
    const delClass = compact ? 'btn-del-sidebar-task' : 'btn-delete-task';
    const cardPad = compact ? ' style="padding: 0.6rem 0.75rem;"' : '';

    return `
      <div class="task-card ${task.completed ? 'task-completed' : ''}" data-task-id="${safeId}"${cardPad}>
        <div class="task-card-left">
          <label class="custom-checkbox">
            <input type="checkbox" ${task.completed ? 'checked' : ''} data-task-id="${safeId}" class="${cbClass}" />
            <span class="checkmark"></span>
          </label>
          <div class="task-info">
            <div class="task-title clickable-title ${!compact && task.completed ? 'completed-text' : ''}" ${compact ? 'style="font-size: 0.84rem;"' : ''} title="Click to edit task">${escapeHTML(task.title)}</div>
            <div class="task-badges"${compact ? ' style="margin-top: 0.2rem;"' : ''}>
              <span class="subject-badge ${!task.subject ? 'badge-no-course' : ''}" style="--badge-color: ${color}${compact ? '; font-size: 0.65rem;' : ''}">${task.subject ? escapeHTML(task.subject) : 'General'}</span>
              ${targetProgressBadgeHTML}
              ${isMidnightDone ? `
                <span class="meta-badge midnight-badge" ${compact ? 'style="font-size: 0.63rem;"' : ''} title="Completed during midnight hours (00:00–04:59)">
                  🌙 Midnight${midnightTimeStr ? ` (${escapeHTML(midnightTimeStr)})` : ''}
                </span>
              ` : ''}
              ${dueLabel ? `
                <span class="meta-badge date-badge ${isOverdue ? 'overdue' : ''}" ${compact ? 'style="font-size: 0.65rem;"' : ''} title="Due: ${escapeHTML(task.dueDate)}">
                  ${escapeHTML(dueLabel)}
                </span>
              ` : (!compact ? '<span class="meta-badge date-badge-none">No deadline</span>' : '')}
              ${task.recurrence && task.recurrence !== 'none' ? `
                <span class="meta-badge task-recurrence-badge" ${compact ? 'style="font-size: 0.65rem;"' : ''} title="Recurring study item">
                  ↻ ${escapeHTML(getRecurrenceLabel(task.recurrence, task.recurrenceInterval))}
                </span>
              ` : ''}
            </div>
            ${!compact && task.notes ? `<div class="task-notes-preview">${escapeHTML(task.notes)}</div>` : ''}
          </div>
        </div>
        <div class="task-actions">
          ${!task.completed ? `
            <button type="button" class="btn ${studyClass}" data-task-id="${safeId}" title="Start timer with this study item"${compact ? ' style="padding: 0.25rem 0.5rem; font-size: 0.7rem;"' : ''}>${compact ? '▶' : '▶ Study'}</button>
          ` : (!compact && timeLoggedMins === 0 ? `
            <button type="button" class="btn btn-secondary btn-log-time" data-task-id="${safeId}" title="Record time spent on this completed task" style="font-size: 0.72rem; padding: 0.25rem 0.55rem;">+ Log Time</button>
          ` : '')}
          <button type="button" class="btn btn-icon ${editClass}" data-task-id="${safeId}" title="Edit task" aria-label="Edit task"${compact ? ' style="font-size: 0.75rem;"' : ''}>✎</button>
          <button type="button" class="btn btn-icon ${delClass}" data-task-id="${safeId}" title="Delete task" aria-label="Delete task"${compact ? ' style="font-size: 0.75rem;"' : ''}>✕</button>
          ${!task.completed && (!task.dueDate || task.dueDate > todayStr) ? `
            <button type="button" class="btn btn-secondary ${moveClass}" data-task-id="${safeId}" title="Move to Today"${compact ? ' style="padding: 0.2rem 0.42rem; font-size: 0.65rem;"' : ''}>→ Today</button>
          ` : ''}
          ${!task.completed && task.dueDate === todayStr ? `
            <button type="button" class="btn btn-secondary ${moveTomorrowClass}" data-task-id="${safeId}" title="Move to Tomorrow"${compact ? ' style="padding: 0.2rem 0.42rem; font-size: 0.65rem;"' : ''}>→ Tomorrow</button>
          ` : ''}
        </div>
      </div>
    `;
  }

  renderSidebarTasks() {
    if (!this.sidebarTaskList) return;
    const tasks = store.getState().tasks || [];
    const anchors = getDayAnchors();
    const { todayStr } = anchors;
    const sFilter = this.currentSidebarFilter || 'pending';

    let filtered = [...tasks];
    if (sFilter === 'pending') {
      filtered = filtered.filter((t) => !t.completed && !store.isExpiredFrequentTask(t, todayStr));
    } else if (sFilter === 'today') {
      filtered = filtered.filter((t) => !t.completed && !store.isExpiredFrequentTask(t, todayStr) && (t.dueDate === todayStr || (t.recurrence && t.recurrence !== 'none' && (!t.dueDate || t.dueDate <= todayStr))));
    } else if (sFilter === 'planned') {
      filtered = filtered.filter((t) => !t.completed && t.dueDate && t.dueDate >= todayStr);
    } else if (sFilter === 'completed') {
      filtered = filtered.filter((t) => t.completed);
    }

    if (this.sidebarTaskSubjectFilter && this.sidebarTaskSubjectFilter.value !== 'all') {
      const sVal = this.sidebarTaskSubjectFilter.value;
      filtered = sVal === '' ? filtered.filter((t) => !t.subject) : filtered.filter((t) => t.subject === sVal);
    }

    sortTasksList(filtered, this.sidebarTaskSort ? this.sidebarTaskSort.value : (this.sidebarTaskSortBy || 'dueDate'));

    if (filtered.length === 0) {
      this.sidebarTaskList.innerHTML = `
        <div class="empty-state" style="padding: 1.5rem 0.5rem; text-align: center;">
          <p style="font-size: 0.85rem; color: var(--text-muted);">No study tasks found.</p>
        </div>
      `;
      return;
    }

    const groupBy = this.sidebarTaskGroup ? this.sidebarTaskGroup.value : (this.sidebarTaskGroupBy || 'dueDate');
    if (groupBy === 'none') {
      this.sidebarTaskList.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 0.45rem;">
          ${filtered.map((t) => this.createTaskCardHTML(t, todayStr, { compact: true })).join('')}
        </div>
      `;
      return;
    }

    const groups = groupTasksList(filtered, groupBy, anchors);
    this.sidebarTaskList.innerHTML = groups.map(({ title, tasks: groupTasks }) => {
      const isCollapsed = this.collapsedSidebarGroups.has(title);
      const safeTitle = escapeHTML(title);
      return `
        <div class="task-group ${isCollapsed ? 'collapsed' : ''}" style="margin-bottom: 0.5rem;">
          <div class="task-group-header" data-sidebar-group="${safeTitle}" style="cursor: pointer; user-select: none; padding: 0.35rem 0.6rem;">
            <div class="task-group-title" style="font-size: 0.78rem; font-weight: 700;">
              <span class="group-chevron" style="display: inline-block; font-size: 0.65rem; transition: transform 0.2s ease; margin-right: 0.35rem; ${isCollapsed ? 'transform: rotate(-90deg);' : ''}">▼</span>
              <span>${safeTitle}</span>
              <span class="task-group-count badge-counter" style="font-size: 0.65rem; padding: 0.1rem 0.4rem; margin-left: 0.35rem;">${groupTasks.length}</span>
            </div>
          </div>
          <div class="task-group-items" style="display: ${isCollapsed ? 'none' : 'flex'}; flex-direction: column; gap: 0.45rem; margin-top: 0.35rem;">
            ${groupTasks.map((t) => this.createTaskCardHTML(t, todayStr, { compact: true })).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  renderTasks() {
    this.updateTaskBadgeCounts();
    if (this.globalTaskSidebar && this.globalTaskSidebar.classList.contains('open')) {
      this.renderSidebarTasks();
    }
    if (!this.taskListContainer) return;

    const tasks = store.getState().tasks || [];
    const anchors = getDayAnchors();
    const { todayStr } = anchors;
    const view = this.taskViewFilter || 'todo';

    let filtered = [...tasks];
    if (view === 'todo') {
      filtered = filtered.filter((t) => !t.completed && !store.isExpiredFrequentTask(t, todayStr));
    } else if (view === 'today') {
      filtered = filtered.filter((t) => !store.isExpiredFrequentTask(t, todayStr) && (t.dueDate === todayStr || (t.createdAt && toLocalDateStr(t.createdAt) === todayStr) || (t.recurrence && t.recurrence !== 'none' && (!t.dueDate || t.dueDate <= todayStr))));
    } else if (view === 'planned') {
      filtered = filtered.filter((t) => Boolean(t.dueDate));
    } else if (view === 'general') {
      filtered = filtered.filter((t) => !t.subject || t.subject === 'General' || t.subject === '');
    } else if (view === 'recurring') {
      filtered = filtered.filter((t) => t.recurrence && t.recurrence !== 'none');
    } else if (view === 'done') {
      filtered = filtered.filter((t) => t.completed);
    }

    if (this.currentSubjectFilter !== 'all') {
      filtered = this.currentSubjectFilter === ''
        ? filtered.filter((t) => !t.subject)
        : filtered.filter((t) => t.subject === this.currentSubjectFilter);
    }

    if (filtered.length === 0) {
      this.taskListContainer.innerHTML = `
        <div class="empty-state">
          <p>No study tasks found for this view.</p>
          <small>Add new tasks above or switch to another smart list tab.</small>
        </div>
      `;
      return;
    }

    sortTasksList(filtered, this.taskSortBy || 'dueDate');
    const groupBy = this.taskGroupBy || 'dueDate';

    if (groupBy === 'none') {
      this.taskListContainer.innerHTML = `
        <div class="task-group-items">
          ${filtered.map((t) => this.createTaskCardHTML(t, todayStr)).join('')}
        </div>
      `;
      return;
    }

    const groups = groupTasksList(filtered, groupBy, anchors);
    this.taskListContainer.innerHTML = groups.map(({ title, tasks: groupTasks }) => {
      const totalMins = groupTasks.reduce((sum, t) => sum + (t.targetMinutes || 0), 0);
      const isCollapsed = this.collapsedTaskGroups.has(title);
      const safeTitle = escapeHTML(title);
      return `
        <div class="task-group-section ${isCollapsed ? 'group-collapsed' : ''}">
          <div class="task-group-header" data-group-title="${safeTitle}">
            <span class="group-toggle-arrow">${isCollapsed ? '▸' : '▾'}</span>
            <span class="group-title">${safeTitle}</span>
            <span class="group-badge">${groupTasks.length} ${groupTasks.length === 1 ? 'task' : 'tasks'}${totalMins > 0 ? ` · ${totalMins}m` : ''}</span>
          </div>
          <div class="task-group-items">
            ${groupTasks.map((t) => this.createTaskCardHTML(t, todayStr)).join('')}
          </div>
        </div>
      `;
    }).join('');
  }
}
