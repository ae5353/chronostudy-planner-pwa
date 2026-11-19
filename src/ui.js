// src/ui.js — Lean UI Orchestrator with Active-View Dirty Rendering & Backward-Compatible Prototype
import { store, toLocalDateStr } from './store.js';
import { getRecurrenceLabel } from './domain/recurrence.js';
import { formatRelativeDueDate } from './domain/date-utils.js';
import { timer } from './timer.js';
import { playClickSound } from './audio.js';
import { syncManager } from './sync.js';
import { wakeLockManager } from './wakelock.js';
import {
  escapeHTML,
  sanitizeCssColor,
  sanitizeGoogleEnableUrl,
  renderGDriveApiErrorHtml
} from './ui/dom-utils.js';
import { closeTopNonDialogModals } from './ui/modals.js';
import { TimerViewController } from './ui/timer-view.js';
import { TasksViewController } from './ui/tasks-view.js';
import { PlannerViewController, renderDayClassLecturesHTML } from './ui/planner-view.js';
import { CoursesViewController } from './ui/courses-view.js';
import { AnalyticsViewController } from './ui/analytics-view.js';
import { SyncViewController } from './ui/sync-view.js';
import { ThemeViewController } from './ui/theme-view.js';

export class ChronoUI {
  constructor() {
    this.activeView = 'focus';
    this.activeFocusMobileTab = 'timer';
    this.dirtyViews = new Set(['calendar', 'subjects', 'history']);

    this.timerView = new TimerViewController(this);
    this.tasksView = new TasksViewController(this);
    this.plannerView = new PlannerViewController(this);
    this.coursesView = new CoursesViewController(this);
    this.analyticsView = new AnalyticsViewController(this);
    this.syncView = new SyncViewController(this);
    this.themeView = new ThemeViewController(this);

    this.initDOMElements();
    this.bindEvents();

    const initSettings = store.getState().settings || {};
    this.applyTheme(initSettings.theme || 'slate');
    this.applyFont(initSettings.fontStyle || 'sans');
    this.applyTimerStyle(initSettings.timerStyle || 'chronograph');
    this.applyLayoutFormat(initSettings.layoutFormat || 'auto');

    wakeLockManager.setConditionChecker(() => {
      const isFullscreen = typeof document !== 'undefined' && Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      const timerState = timer.getState();
      return isFullscreen || timerState.isZenMode || timerState.isRunning;
    });

    wakeLockManager.subscribe((isActive) => {
      if (this.timerView.zenWakeLockBadge) {
        this.timerView.zenWakeLockBadge.style.display = isActive ? 'inline-flex' : 'none';
      }
    });

    this.render();
    this.applyInitialUrlParams();

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          store.ensureDailyRollover();
        }
      });
    }
    store.ensureDailyRollover();

    // Active-view dirty rendering on store changes
    store.subscribe(() => {
      const settings = store.getState().settings || {};
      this.applyTheme(settings.theme || 'slate');
      this.applyFont(settings.fontStyle || 'sans');
      this.applyTimerStyle(settings.timerStyle || 'chronograph');
      this.coursesView.renderSubjects();
      this.analyticsView.renderStats();
      this.tasksView.updateTaskBadgeCounts();
      if (this.tasksView.globalTaskSidebar?.classList.contains('open')) {
        this.tasksView.renderSidebarTasks();
      }
      this.renderActiveViewOnly();
    });

    let lastRunningState = null;
    let lastZenState = null;
    timer.subscribe((timerState) => {
      this.timerView.renderTimer(timerState);
      if (lastRunningState !== timerState.isRunning || lastZenState !== timerState.isZenMode) {
        lastRunningState = timerState.isRunning;
        lastZenState = timerState.isZenMode;
        wakeLockManager.update();
      }
    });

    syncManager.init();
    syncManager.subscribe((syncStatus) => {
      this.syncView.renderSyncStatus(syncStatus);
    });
  }

  initDOMElements() {
    this.navTabBtns = document.querySelectorAll('.nav-tab-btn');
    this.views = {
      focus: document.getElementById('view-focus'),
      calendar: document.getElementById('view-calendar'),
      subjects: document.getElementById('view-subjects'),
      history: document.getElementById('view-history')
    };
    this.focusSegBtns = document.querySelectorAll('.focus-seg-btn');
    this.timerMainPanel = document.querySelector('.timer-main-panel');
    this.taskPlannerPanel = document.querySelector('.task-planner-panel');

    this.timerView.initDOM();
    this.tasksView.initDOM();
    this.plannerView.initDOM();
    this.coursesView.initDOM();
    this.analyticsView.initDOM();
    this.syncView.initDOM();
    this.themeView.initDOM();
  }

  bindEvents() {
    this.timerView.bindEvents();
    this.tasksView.bindEvents();
    this.plannerView.bindEvents();
    this.coursesView.bindEvents();
    this.analyticsView.bindEvents();
    this.syncView.bindEvents();
    this.themeView.bindEvents();

    // Navigation switching
    this.navTabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        const focusTarget = btn.dataset.focusTarget;
        this.switchView(view);
        if (view === 'focus' && focusTarget) {
          this.switchFocusMobileTab(focusTarget);
        }
        playClickSound();
      });
    });

    if (this.focusSegBtns) {
      this.focusSegBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          this.switchFocusMobileTab(btn.dataset.focusTab);
          playClickSound();
        });
      });
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this.handleLayoutResize());
    }

    // Unified global keyboard shortcuts
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => {
        const activeEl = document.activeElement;
        const activeTag = activeEl ? activeEl.tagName : '';
        const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag) || (activeEl && activeEl.isContentEditable);
        const isZen = timer.getState().isZenMode;
        const hasActiveModal = Boolean(document.querySelector('.modal.active'));

        if (e.altKey && (e.key === 't' || e.key === 'T')) {
          e.preventDefault();
          this.tasksView.toggleTaskSidebar();
          return;
        }

        if (e.key === 'Escape') {
          if (isZen) {
            timer.toggleZenMode(false);
            return;
          }
          if (this.tasksView.globalTaskSidebar?.classList.contains('open')) {
            this.tasksView.closeTaskSidebar();
          }
          closeTopNonDialogModals();
          return;
        }

        if (isInput || hasActiveModal) return;

        if (isZen) {
          if (e.code === 'Space') {
            e.preventDefault();
            timer.toggle();
            playClickSound();
          } else if (e.key === 'n' || e.key === 'N') {
            e.preventDefault();
            this.timerView.btnZenToggleNotes?.click();
          } else if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            this.timerView.btnFullscreen?.click();
          }
          return;
        }

        if (e.code === 'Space') {
          if (['BUTTON', 'A'].includes(activeTag)) return;
          e.preventDefault();
          timer.toggle();
          playClickSound();
        } else if (e.code === 'KeyF' && e.altKey && e.shiftKey) {
          e.preventDefault();
          if (timer.getState().elapsedSec >= 5) {
            this.timerView.openFinishModal();
          }
        } else if (e.code === 'KeyZ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
          timer.toggleZenMode();
        }
      });
    }
  }

  renderViewByName(viewName) {
    this.dirtyViews.delete(viewName);
    if (viewName === 'focus') {
      this.tasksView.renderTasks();
    } else if (viewName === 'calendar') {
      this.plannerView.renderCalendar();
    } else if (viewName === 'subjects') {
      this.coursesView.renderSubjectsPage();
    } else if (viewName === 'history') {
      this.analyticsView.renderHistory();
    }
  }

  renderActiveViewOnly() {
    ['focus', 'calendar', 'subjects', 'history'].forEach((v) => {
      if (v !== this.activeView) this.dirtyViews.add(v);
    });
    this.renderViewByName(this.activeView);
  }

  render() {
    this.coursesView.renderSubjects();
    this.analyticsView.renderStats();
    this.renderActiveViewOnly();
    this.timerView.renderInitialState();
  }

  applyInitialUrlParams() {
    if (typeof window === 'undefined' || typeof URLSearchParams === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const view = params.get('view');
      const action = params.get('action');
      const validViews = ['focus', 'calendar', 'subjects', 'history'];
      if (view && validViews.includes(view)) {
        this.switchView(view);
      }
      if (action === 'tasks') {
        this.switchView('focus');
        if (this.isMobileLayoutActive()) {
          this.switchFocusMobileTab('tasks');
        } else if (this.tasksView.taskTitleInput) {
          this.tasksView.taskTitleInput.focus();
        }
      }
    } catch (e) {}
  }

  switchView(viewName) {
    this.activeView = viewName;
    this.navTabBtns.forEach((btn) => {
      if (btn.dataset.focusTarget) {
        btn.classList.toggle('active', viewName === 'focus' && (this.activeFocusMobileTab || 'timer') === btn.dataset.focusTarget);
      } else {
        btn.classList.toggle('active', btn.dataset.view === viewName);
      }
    });

    Object.entries(this.views).forEach(([name, el]) => {
      if (el) el.style.display = name === viewName ? 'block' : 'none';
    });

    if (viewName === 'focus') {
      this.switchFocusMobileTab(this.activeFocusMobileTab || 'timer', false);
    }

    if (this.dirtyViews.has(viewName)) {
      this.renderViewByName(viewName);
    }
  }

  applyLayoutFormat(format) {
    this.themeView.applyLayoutFormat(format);
  }

  isMobileLayoutActive() {
    return this.themeView.isMobileLayoutActive();
  }

  handleLayoutResize() {
    this.switchFocusMobileTab(this.activeFocusMobileTab || 'timer', false);
  }

  switchFocusMobileTab(tab = 'timer', updateButtons = true) {
    this.activeFocusMobileTab = tab;
    if (updateButtons && this.focusSegBtns) {
      this.focusSegBtns.forEach((btn) => btn.classList.toggle('active', btn.dataset.focusTab === tab));
      this.navTabBtns.forEach((btn) => {
        if (btn.dataset.focusTarget) {
          btn.classList.toggle('active', this.activeView === 'focus' && btn.dataset.focusTarget === tab);
        }
      });
    }

    if (!this.timerMainPanel || !this.taskPlannerPanel) {
      this.timerMainPanel = document.querySelector('.timer-main-panel');
      this.taskPlannerPanel = document.querySelector('.task-planner-panel');
    }

    const isMobile = this.isMobileLayoutActive();
    if (this.timerMainPanel && this.taskPlannerPanel) {
      if (!isMobile || tab === 'both') {
        this.timerMainPanel.style.display = 'block';
        this.taskPlannerPanel.style.display = 'block';
      } else if (tab === 'timer') {
        this.timerMainPanel.style.display = 'block';
        this.taskPlannerPanel.style.display = 'none';
      } else if (tab === 'tasks') {
        this.timerMainPanel.style.display = 'none';
        this.taskPlannerPanel.style.display = 'block';
      }
    }
  }

  startTaskStudySession(task) {
    timer.setContext({
      subject: task.subject || '',
      topic: task.title,
      linkedTaskId: task.id
    });
    if (this.timerView.subjectSelect) this.timerView.subjectSelect.value = task.subject || '';
    if (this.timerView.topicInput) this.timerView.topicInput.value = task.title;
    this.timerView.renderLinkedTaskBanner(task.id);

    if (timer.mode === 'countdown' && task.targetMinutes) {
      timer.setTargetMinutes(task.targetMinutes);
    }

    this.switchView('focus');
    this.switchFocusMobileTab('timer');
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  applyTheme(theme) {
    this.themeView.applyTheme(theme);
  }

  applyFont(fontStyle) {
    this.themeView.applyFont(fontStyle);
  }

  applyTimerStyle(style) {
    this.themeView.applyTimerStyle(style);
  }

  // --- Backward-Compatible Prototype Hooks (safe on Object.create(ChronoUI.prototype)) ---
  sanitizeCssColor(color, fallback = '#64748b') {
    return sanitizeCssColor(color, fallback);
  }

  sanitizeGoogleEnableUrl(rawUrl) {
    return sanitizeGoogleEnableUrl(rawUrl);
  }

  renderGDriveApiErrorHtml(message, opts = {}) {
    return renderGDriveApiErrorHtml(message, opts);
  }

  getRecurrenceLabel(recurrence, interval = 1) {
    return getRecurrenceLabel(recurrence, interval);
  }

  formatRelativeDueDate(dueDateStr, todayStr = toLocalDateStr(new Date()), opts = {}) {
    return formatRelativeDueDate(dueDateStr, todayStr, opts);
  }

  renderDayClassLectures(dayOfWeek, dateStr = null) {
    return renderDayClassLecturesHTML(dayOfWeek, dateStr, {
      sanitizeColorFn: (c, fb) => (this?.sanitizeCssColor ? this.sanitizeCssColor(c, fb) : fb),
      escapeFn: (s) => (this?.escapeHTML ? this.escapeHTML(s) : escapeHTML(s))
    });
  }

  escapeHTML(str) {
    return escapeHTML(str);
  }
}
