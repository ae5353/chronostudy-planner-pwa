// src/ui.js — UI Controller for ChronoStudy (Week 7, Grouped Subjects, Weekly Events, Optional Dates/Hours)
import { store, toLocalDateStr } from './store.js';
import { timer } from './timer.js';
import { playClickSound, setAmbientSound, updateAmbientVolume } from './audio.js';
import { syncManager } from './sync.js';
import { wakeLockManager } from './wakelock.js';

export class ChronoUI {
  constructor() {
    this.currentTaskFilter = 'pending';
    this.currentSubjectFilter = 'all';
    this.taskViewFilter = 'todo'; // 'todo' | 'today' | 'planned' | 'general' | 'recurring' | 'done' | 'all'
    this.taskGroupBy = 'dueDate'; // 'dueDate' | 'subject' | 'recurrence' | 'none'
    this.taskSortBy = 'dueDate'; // 'dueDate' | 'subject' | 'title' | 'duration' | 'created'
    this.collapsedTaskGroups = new Set();
    this.currentSidebarFilter = 'pending';
    this.sidebarTaskGroupBy = 'dueDate';
    this.sidebarTaskSortBy = 'dueDate';
    this.collapsedSidebarGroups = new Set();
    this.historySubjectFilter = 'all';
    this.calendarSubjectFilter = 'all';
    this.subjectGroupFilter = 'all';
    
    // View navigation: 'focus' | 'calendar' | 'subjects' | 'history'
    this.activeView = 'focus';

    // Calendar state
    this.calendarViewMode = 'week'; // 'week' | 'month'
    this.calendarAnchorDate = new Date();

    this.editingSubjectId = null;

    this.initDOMElements();
    this.bindEvents();
    this.applyTheme(store.getState().settings.theme || 'slate');
    this.applyFont(store.getState().settings.fontStyle || 'sans');
    this.applyTimerStyle(store.getState().settings.timerStyle || 'chronograph');

    // Configure Screen WakeLock (Stays awake during fullscreen, Zen Mode, & active study)
    wakeLockManager.setConditionChecker(() => {
      const isFullscreen = typeof document !== 'undefined' && Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      const timerState = timer.getState();
      return isFullscreen || timerState.isZenMode || timerState.isRunning;
    });

    wakeLockManager.subscribe((isActive) => {
      if (this.zenWakeLockBadge) {
        this.zenWakeLockBadge.style.display = isActive ? 'inline-flex' : 'none';
      }
    });

    this.render();

    // Subscribe to store updates
    store.subscribe(() => {
      this.renderStats();
      this.renderTasks();
      this.renderHistory();
      this.renderSubjects();
      this.renderSubjectsPage();
      this.renderCalendar();
    });

    // Subscribe to timer updates
    let lastRunningState = null;
    let lastZenState = null;
    timer.subscribe((timerState) => {
      this.renderTimer(timerState);
      if (lastRunningState !== timerState.isRunning || lastZenState !== timerState.isZenMode) {
        lastRunningState = timerState.isRunning;
        lastZenState = timerState.isZenMode;
        wakeLockManager.update();
      }
    });

    // Initialize and subscribe to Cloud Sync Controller
    syncManager.init();
    syncManager.subscribe((syncStatus) => {
      this.renderSyncStatus(syncStatus);
    });
  }

  initDOMElements() {
    // Header & Stats
    this.statTodayTime = document.getElementById('stat-today-time');
    this.statTodaySessions = document.getElementById('stat-today-sessions');
    this.statPendingTasks = document.getElementById('stat-pending-tasks');
    this.themeToggleBtn = document.getElementById('theme-toggle-btn');
    this.backupBtn = document.getElementById('backup-btn');
    this.btnLogPast = document.getElementById('btn-log-past');

    // Navigation Tabs
    this.navTabBtns = document.querySelectorAll('.nav-tab-btn');
    this.views = {
      focus: document.getElementById('view-focus'),
      calendar: document.getElementById('view-calendar'),
      subjects: document.getElementById('view-subjects'),
      history: document.getElementById('view-history')
    };

    // Timer elements
    this.timerModeStopwatch = document.getElementById('mode-stopwatch');
    this.timerModeCountdown = document.getElementById('mode-countdown');
    this.countdownPresets = document.getElementById('countdown-presets');
    this.subjectSelect = document.getElementById('timer-subject-select');
    this.topicInput = document.getElementById('timer-topic-input');
    this.linkedTaskBanner = document.getElementById('linked-task-banner');
    this.linkedTaskTitle = document.getElementById('linked-task-title');
    this.btnUnlinkTask = document.getElementById('btn-unlink-task');

    this.timerDisplay = document.getElementById('timer-digits');
    this.timerStateBadge = document.getElementById('timer-state-badge');
    this.timerProgressRing = document.getElementById('timer-progress-ring');
    this.timerSubdialMinHand = document.getElementById('timer-subdial-min-hand');
    this.timerSubdialSecHand = document.getElementById('timer-subdial-sec-hand');
    this.timerActiveModeLabel = document.getElementById('timer-active-mode-label');
    this.timerTargetDisplay = document.getElementById('timer-target-display');
    this.timerProgressPct = document.getElementById('timer-progress-pct');
    this.timerDigitalProgressBar = document.getElementById('timer-digital-progress-bar');

    this.btnTimerToggle = document.getElementById('btn-timer-toggle');
    this.btnTimerFinish = document.getElementById('btn-timer-finish');
    this.btnTimerReset = document.getElementById('btn-timer-reset');
    this.btnZenModeToggle = document.getElementById('btn-zen-mode');
    this.btnExitZen = document.getElementById('btn-exit-zen');
    this.btnFullscreen = document.getElementById('btn-fullscreen');
    this.zenSubjectBadge = document.getElementById('zen-subject-badge');
    this.zenTopicDisplay = document.getElementById('zen-topic-display');
    this.zenLinkedTaskBadge = document.getElementById('zen-linked-task-badge');
    this.zenWakeLockBadge = document.getElementById('zen-wakelock-badge');
    this.zenTimerDigits = document.getElementById('zen-timer-digits');
    this.zenCircleWrap = document.getElementById('zen-circle-wrap');
    this.zenProgressRing = document.getElementById('zen-progress-ring');
    this.zenCadranHandGroup = document.getElementById('zen-cadran-hand-group');
    this.zenSubdialMinHand = document.getElementById('zen-subdial-min-hand');
    this.zenSubdialSecHand = document.getElementById('zen-subdial-sec-hand');
    this.zenStateBadge = document.getElementById('zen-state-badge');
    this.zenActiveModeLabel = document.getElementById('zen-active-mode-label');
    this.zenTargetDisplay = document.getElementById('zen-target-display');
    this.zenProgressPct = document.getElementById('zen-progress-pct');
    this.zenDigitalProgressBar = document.getElementById('zen-digital-progress-bar');
    this.btnZenTimerToggle = document.getElementById('btn-zen-timer-toggle');
    this.btnZenFinishSession = document.getElementById('btn-zen-finish-session');
    this.btnZenResetTimer = document.getElementById('btn-zen-reset-timer');
    this.btnZenToggleNotes = document.getElementById('btn-zen-toggle-notes');
    this.btnZenCloseNotes = document.getElementById('btn-zen-close-notes');
    this.zenNotesContainer = document.getElementById('zen-notes-container');
    this.zenSoundscapeSelect = document.getElementById('zen-soundscape-select');

    // Notes
    this.sessionNotesArea = document.getElementById('session-notes-area');

    // Ambient sound
    this.ambientSoundSelect = document.getElementById('ambient-sound-select');
    this.ambientVolumeSlider = document.getElementById('ambient-volume-slider');

    // Tasks (in focus view)
    this.taskForm = document.getElementById('new-task-form');
    this.taskTitleInput = document.getElementById('task-title-input');
    this.taskSubjectSelect = document.getElementById('task-subject-select');
    this.taskTargetInput = document.getElementById('task-target-input');
    this.taskDueDateInput = document.getElementById('task-due-date-input');
    this.taskRecurrenceSelect = document.getElementById('task-recurrence-select');
    this.taskListContainer = document.getElementById('task-list-container');
    this.taskFilterTabs = document.querySelectorAll('.task-filter-tab');
    this.taskSubjectFilter = document.getElementById('task-subject-filter');

    // Microsoft To Do Command Bar Elements
    this.todoTabBtns = document.querySelectorAll('.todo-tab-btn');
    this.taskGroupBySelect = document.getElementById('task-group-by');
    this.taskSortBySelect = document.getElementById('task-sort-by');

    // Subjects Management Page
    this.subjectsGrid = document.getElementById('subjects-grid');
    this.subjectsGroupFilterBar = document.getElementById('subjects-group-filter-bar');
    this.btnOpenAddSubject = document.getElementById('btn-open-add-subject');
    this.btnOpenAddWeeklyEventSub = document.getElementById('btn-open-add-weekly-event-sub');

    // Calendar View elements
    this.calModeWeekBtn = document.getElementById('cal-mode-week');
    this.calModeMonthBtn = document.getElementById('cal-mode-month');
    this.calPrevBtn = document.getElementById('cal-prev-btn');
    this.calNextBtn = document.getElementById('cal-next-btn');
    this.calTodayBtn = document.getElementById('cal-today-btn');
    this.calTitleHeader = document.getElementById('cal-title-header');
    this.calSubjectFilter = document.getElementById('cal-subject-filter');
    this.calendarViewContainer = document.getElementById('calendar-view-container');
    this.backlogTasksContainer = document.getElementById('backlog-tasks-container');
    this.btnOpenWeeklyEventModal = document.getElementById('btn-open-weekly-event-modal');
    this.btnGCalSync = document.getElementById('btn-gcal-sync');

    // History elements
    this.historyListContainer = document.getElementById('history-list-container');
    this.historySubjectFilterEl = document.getElementById('history-subject-filter');

    // Modals
    this.finishModal = document.getElementById('finish-session-modal');
    this.finishModalDuration = document.getElementById('finish-modal-duration');
    this.finishModalSubject = document.getElementById('finish-modal-subject');
    this.finishModalTopic = document.getElementById('finish-modal-topic');
    this.finishModalNotes = document.getElementById('finish-modal-notes');
    this.finishModalTaskCompleteGroup = document.getElementById('finish-modal-task-group');
    this.finishModalTaskCheckbox = document.getElementById('finish-modal-task-complete');
    this.finishModalTaskName = document.getElementById('finish-modal-task-name');
    this.btnSaveFinishedSession = document.getElementById('btn-save-finished-session');
    this.btnCancelFinishSession = document.getElementById('btn-cancel-finish-session');

    this.manualLogModal = document.getElementById('manual-log-modal');
    this.manualLogForm = document.getElementById('manual-log-form');
    this.btnCancelManualLog = document.getElementById('btn-cancel-manual-log');

    // Subject modal
    this.subjectModal = document.getElementById('subject-modal');
    this.subjectModalTitle = document.getElementById('subject-modal-title');
    this.subjectForm = document.getElementById('subject-form');
    this.subjectNameInput = document.getElementById('subject-name-input');
    this.subjectCodeInput = document.getElementById('subject-code-input');
    this.subjectGroupInput = document.getElementById('subject-group-input');
    this.subjectFolderInput = document.getElementById('subject-folder-input');
    this.subjectColorInput = document.getElementById('subject-color-input');
    this.subjectHoursInput = document.getElementById('subject-hours-input');
    this.btnCancelSubject = document.getElementById('btn-cancel-subject');

    // Weekly Event modal
    this.weeklyEventModal = document.getElementById('weekly-event-modal');
    this.weeklyEventForm = document.getElementById('weekly-event-form');
    this.btnCancelWevent = document.getElementById('btn-cancel-wevent');

    // Google Calendar & Backup Modals
    this.gcalModal = document.getElementById('gcal-modal');
    this.btnDownloadIcs = document.getElementById('btn-download-ics');
    this.btnCloseGcalModal = document.getElementById('btn-close-gcal-modal');

    this.backupModal = document.getElementById('backup-modal');
    this.btnExportJson = document.getElementById('btn-export-json');
    this.btnExportCsv = document.getElementById('btn-export-csv');
    this.btnImportJson = document.getElementById('btn-import-json');
    this.jsonFileInput = document.getElementById('json-file-input');
    this.btnCloseBackup = document.getElementById('btn-close-backup');

    // Categories Modal & Suggestions
    this.categoriesModal = document.getElementById('categories-modal');
    this.btnManageCategories = document.getElementById('btn-manage-categories');
    this.btnCloseCategoriesModal = document.getElementById('btn-close-categories-modal');
    this.addCategoryForm = document.getElementById('add-category-form');
    this.newCategoryInput = document.getElementById('new-category-input');
    this.categoriesManagerList = document.getElementById('categories-manager-list');
    this.groupSuggestions = document.getElementById('group-suggestions');

    // Weekly Event Modal Enhanced
    this.weventModalTitle = document.getElementById('wevent-modal-title');
    this.weventEditId = document.getElementById('wevent-edit-id');
    this.weventRecurrenceSelect = document.getElementById('wevent-recurrence-select');
    this.weventDayGroup = document.getElementById('wevent-day-group');
    this.btnDeleteWevent = document.getElementById('btn-delete-wevent');
    this.btnSubmitWevent = document.getElementById('btn-submit-wevent');

    // Lecture Slot Modal
    this.lectureSlotModal = document.getElementById('lecture-slot-modal');
    this.lectureSlotForm = document.getElementById('lecture-slot-form');
    this.lslotSubjectId = document.getElementById('lslot-subject-id');
    this.lslotIndex = document.getElementById('lslot-index');
    this.lslotCourseName = document.getElementById('lslot-course-name');
    this.lslotDaySelect = document.getElementById('lslot-day-select');
    this.lslotStartInput = document.getElementById('lslot-start-input');
    this.lslotEndInput = document.getElementById('lslot-end-input');
    this.lslotLabelInput = document.getElementById('lslot-label-input');
    this.btnDeleteLslot = document.getElementById('btn-delete-lslot');
    this.btnCancelLslot = document.getElementById('btn-cancel-lslot');

    // Schedule Manager Modal
    this.btnManageSchedule = document.getElementById('btn-manage-schedule');
    this.btnManageScheduleSub = document.getElementById('btn-manage-schedule-sub');
    this.scheduleManagerModal = document.getElementById('schedule-manager-modal');
    this.btnCloseScheduleManager = document.getElementById('btn-close-schedule-manager');
    this.btnMgrAddWevent = document.getElementById('btn-mgr-add-wevent');
    this.scheduleManagerList = document.getElementById('schedule-manager-list');

    // Expand Tasks Button & Count
    this.btnExpandTasks = document.getElementById('btn-expand-tasks');
    this.taskBadgeCount = document.getElementById('task-badge-count');

    // Global Tasks Sidebar Drawer
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
    this.selectedSidebarDueDate = null;

    // Focus View Quick Due Date elements
    this.focusQuickDates = document.getElementById('focus-quick-dates');
    this.focusClearDate = document.getElementById('focus-clear-date');

    this.sidebarTaskList = document.getElementById('sidebar-task-list');
    this.sidebarFilterTabs = document.querySelectorAll('.task-sidebar-drawer [data-sfilter]');
    this.sidebarTaskGroup = document.getElementById('sidebar-task-group');
    this.sidebarTaskSort = document.getElementById('sidebar-task-sort');
    this.sidebarTaskSubjectFilter = document.getElementById('sidebar-task-subject-filter');

    // Themes Modal & Button
    this.btnThemePalette = document.getElementById('btn-theme-palette');
    this.themeModal = document.getElementById('theme-modal');
    this.btnCloseThemeModal = document.getElementById('btn-close-theme-modal');
    this.btnDoneThemeModal = document.getElementById('btn-done-theme-modal');
    this.themePickerGrid = document.getElementById('theme-picker-grid');
    this.fontPickerGrid = document.getElementById('font-picker-grid');
    this.cadranPickerGrid = document.getElementById('cadran-picker-grid');

    // PiP Floating Mini-Timer Widget
    this.btnPipTimer = document.getElementById('btn-pip-timer');

    // Custom countdown minutes
    this.countdownCustomMins = document.getElementById('countdown-custom-mins');
    this.btnSetCustomMins = document.getElementById('btn-set-custom-mins');

    // Horology Cadran elements
    this.timerCircleWrap = document.getElementById('timer-circle-wrap');
    this.timerCadranHandGroup = document.getElementById('timer-cadran-hand-group');

    // Analytics Dashboard elements
    this.analyticsTotalTime = document.getElementById('analytics-total-time');
    this.analyticsTotalSessions = document.getElementById('analytics-total-sessions');
    this.analyticsWeekTime = document.getElementById('analytics-week-time');
    this.analyticsWeekTarget = document.getElementById('analytics-week-target');
    this.analyticsActiveDays = document.getElementById('analytics-active-days');
    this.analyticsTasksDone = document.getElementById('analytics-tasks-done');
    this.analyticsTasksRate = document.getElementById('analytics-tasks-rate');
    this.analyticsTrendTotal = document.getElementById('analytics-trend-total');
    this.analyticsWeeklyBars = document.getElementById('analytics-weekly-bars');
    this.analyticsSubjectShare = document.getElementById('analytics-subject-share');
    this.btnExportCsv = document.getElementById('btn-export-csv');

    // Cloud Sync & Device Hub elements
    this.btnCloudSync = document.getElementById('btn-cloud-sync');
    this.cloudSyncDot = document.getElementById('cloud-sync-dot');
    this.cloudSyncLabel = document.getElementById('cloud-sync-label');

    this.cloudSyncModal = document.getElementById('cloud-sync-modal');
    this.btnCloseSyncModal = document.getElementById('btn-close-sync-modal');
    this.btnDoneSyncModal = document.getElementById('btn-done-sync-modal');

    this.modalSyncDot = document.getElementById('modal-sync-dot');
    this.modalSyncTitle = document.getElementById('modal-sync-title');
    this.modalSyncSubtitle = document.getElementById('modal-sync-subtitle');
    this.btnModalSyncNow = document.getElementById('btn-modal-sync-now');

    this.modalDeviceId = document.getElementById('modal-device-id');
    this.modalLastSynced = document.getElementById('modal-last-synced');
    this.modalUnsyncedCount = document.getElementById('modal-unsynced-count');
    this.modalNetworkStatus = document.getElementById('modal-network-status');

    this.syncTabBtns = document.querySelectorAll('.sync-tab-btn');
    this.syncTabPanels = {
      gdrive: document.getElementById('sync-tab-panel-gdrive'),
      supabase: document.getElementById('sync-tab-panel-supabase'),
      offline: document.getElementById('sync-tab-panel-offline'),
      devices: document.getElementById('sync-tab-panel-devices')
    };

    // Google Drive Elements
    this.gdriveStatusCard = document.getElementById('gdrive-status-card');
    this.gdriveUserStatus = document.getElementById('gdrive-user-status');
    this.gdriveFileStatus = document.getElementById('gdrive-file-status');
    this.btnGdriveSignin = document.getElementById('btn-gdrive-signin');
    this.btnGdriveDisconnect = document.getElementById('btn-gdrive-disconnect');
    this.gdriveClientId = document.getElementById('gdrive-client-id');
    this.gdrivePassphrase = document.getElementById('gdrive-passphrase');
    this.gdriveAutoToggle = document.getElementById('gdrive-auto-toggle');
    this.btnSaveGdriveConfig = document.getElementById('btn-save-gdrive-config');

    this.syncSupabaseUrl = document.getElementById('sync-supabase-url');
    this.syncSupabaseKey = document.getElementById('sync-supabase-key');
    this.syncSupabaseRoom = document.getElementById('sync-supabase-room');
    this.syncPassphrase = document.getElementById('sync-passphrase');
    this.syncAutoToggle = document.getElementById('sync-auto-toggle');

    this.btnSaveCloudConfig = document.getElementById('btn-save-cloud-config');
    this.btnCopySupabaseSql = document.getElementById('btn-copy-supabase-sql');
    this.btnGenerateRoomCode = document.getElementById('btn-generate-room-code');

    this.btnExportSnapshot = document.getElementById('btn-export-snapshot');
    this.btnDownloadSnapshotFile = document.getElementById('btn-download-snapshot-file');
    this.syncImportTextarea = document.getElementById('sync-import-textarea');
    this.btnImportSnapshot = document.getElementById('btn-import-snapshot');
    this.btnRollbackBackup = document.getElementById('btn-rollback-backup');

    this.btnPwaInstallApp = document.getElementById('btn-pwa-install-app');
    this.btnRequestNotifications = document.getElementById('btn-request-notifications');

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
  }

  bindEvents() {
    // PiP Floating Mini-Timer Widget
    if (this.btnPipTimer) {
      this.btnPipTimer.addEventListener('click', () => {
        this.togglePiPTimer();
        playClickSound();
      });
    }

    // Custom countdown minutes
    if (this.btnSetCustomMins) {
      this.btnSetCustomMins.addEventListener('click', () => {
        this.setCustomCountdownMinutes();
      });
    }
    if (this.countdownCustomMins) {
      this.countdownCustomMins.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.setCustomCountdownMinutes();
        }
      });
    }

    // Export CSV from Analytics
    if (this.btnExportCsv) {
      this.btnExportCsv.addEventListener('click', () => {
        this.downloadCSV();
        playClickSound();
      });
    }

    // Theme Palette Modal Button
    if (this.btnThemePalette) {
      this.btnThemePalette.addEventListener('click', () => {
        this.openThemeModal();
        playClickSound();
      });
    }

    if (this.themeToggleBtn) {
      this.themeToggleBtn.addEventListener('click', () => {
        this.openThemeModal();
        playClickSound();
      });
    }

    if (this.btnCloseThemeModal) {
      this.btnCloseThemeModal.addEventListener('click', () => {
        this.closeThemeModal();
        playClickSound();
      });
    }

    if (this.btnDoneThemeModal) {
      this.btnDoneThemeModal.addEventListener('click', () => {
        this.closeThemeModal();
        playClickSound();
      });
    }

    // Cloud Sync Modal & Actions
    if (this.btnCloudSync) {
      this.btnCloudSync.addEventListener('click', () => {
        this.openSyncModal();
        playClickSound();
      });
    }

    if (this.btnCloseSyncModal) {
      this.btnCloseSyncModal.addEventListener('click', () => {
        this.closeSyncModal();
        playClickSound();
      });
    }

    if (this.btnDoneSyncModal) {
      this.btnDoneSyncModal.addEventListener('click', () => {
        this.closeSyncModal();
        playClickSound();
      });
    }

    if (this.cloudSyncModal) {
      this.cloudSyncModal.addEventListener('click', (e) => {
        if (e.target === this.cloudSyncModal) {
          this.closeSyncModal();
        }
      });
    }

    if (this.syncTabBtns) {
      this.syncTabBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          this.switchSyncTab(btn.dataset.syncTab);
          playClickSound();
        });
      });
    }

    if (this.btnModalSyncNow) {
      this.btnModalSyncNow.addEventListener('click', () => {
        this.triggerSyncNow();
        playClickSound();
      });
    }

    if (this.btnGdriveSignin) {
      this.btnGdriveSignin.addEventListener('click', () => {
        this.handleGoogleDriveSignIn();
        playClickSound();
      });
    }

    if (this.btnGdriveDisconnect) {
      this.btnGdriveDisconnect.addEventListener('click', () => {
        this.handleGoogleDriveDisconnect();
        playClickSound();
      });
    }

    if (this.btnSaveGdriveConfig) {
      this.btnSaveGdriveConfig.addEventListener('click', () => {
        this.handleGoogleDriveSave();
        playClickSound();
      });
    }

    if (this.btnSaveCloudConfig) {
      this.btnSaveCloudConfig.addEventListener('click', () => {
        this.saveCloudConfig();
        playClickSound();
      });
    }

    if (this.btnCopySupabaseSql) {
      this.btnCopySupabaseSql.addEventListener('click', () => {
        this.copySupabaseSql();
        playClickSound();
      });
    }

    if (this.btnGenerateRoomCode) {
      this.btnGenerateRoomCode.addEventListener('click', () => {
        this.generateRoomCode();
        playClickSound();
      });
    }

    if (this.btnExportSnapshot) {
      this.btnExportSnapshot.addEventListener('click', () => {
        this.exportSnapshotClipboard();
        playClickSound();
      });
    }

    if (this.btnDownloadSnapshotFile) {
      this.btnDownloadSnapshotFile.addEventListener('click', () => {
        this.downloadSnapshotFile();
        playClickSound();
      });
    }

    if (this.btnImportSnapshot) {
      this.btnImportSnapshot.addEventListener('click', () => {
        this.importSnapshotFromUI();
        playClickSound();
      });
    }

    if (this.btnRollbackBackup) {
      this.btnRollbackBackup.addEventListener('click', () => {
        this.rollbackPreSyncBackup();
        playClickSound();
      });
    }

    if (this.btnPwaInstallApp) {
      this.btnPwaInstallApp.addEventListener('click', () => {
        syncManager.promptPWAInstall();
        playClickSound();
      });
    }

    if (this.btnRequestNotifications) {
      this.btnRequestNotifications.addEventListener('click', () => {
        this.requestNotifications();
        playClickSound();
      });
    }

    // Expand / Split Tasks View
    if (this.btnExpandTasks) {
      this.btnExpandTasks.addEventListener('click', () => {
        this.toggleTasksExpanded();
      });
    }

    // Global Tasks Sidebar Drawer
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
      this.taskSidebarBackdrop.addEventListener('click', () => {
        this.closeTaskSidebar();
      });
    }

    if (this.sidebarTaskForm) {
      this.sidebarTaskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = this.sidebarTaskTitle.value.trim();
        if (!title) return;
        const subject = this.sidebarTaskSubject.value || null;
        const recurrence = this.sidebarTaskRecurrence ? this.sidebarTaskRecurrence.value : 'none';
        const dueDate = this.selectedSidebarDueDate || null;
        store.addTask({
          title,
          subject,
          recurrence,
          targetMinutes: null,
          dueDate
        });
        this.sidebarTaskTitle.value = '';
        if (this.sidebarTaskRecurrence) this.sidebarTaskRecurrence.value = 'none';
        this.setSidebarDueDate(null);
        playClickSound();
      });
    }

    // Sidebar Quick Due Date Chips (MS To Do style)
    if (this.sidebarQuickDates) {
      this.sidebarQuickDates.querySelectorAll('.quick-date-chip[data-sidebar-preset]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const preset = btn.dataset.sidebarPreset;
          const d = new Date();
          let targetDateStr = null;
          if (preset === 'today') {
            targetDateStr = toLocalDateStr(d);
          } else if (preset === 'tomorrow') {
            d.setDate(d.getDate() + 1);
            targetDateStr = toLocalDateStr(d);
          } else if (preset === 'nextweek') {
            const day = d.getDay() || 7;
            d.setDate(d.getDate() + (8 - day));
            targetDateStr = toLocalDateStr(d);
          }
          this.setSidebarDueDate(targetDateStr, preset);
          playClickSound();
        });
      });
    }

    if (this.sidebarTaskDueDate) {
      this.sidebarTaskDueDate.addEventListener('change', () => {
        const val = this.sidebarTaskDueDate.value;
        this.setSidebarDueDate(val || null, null);
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
      this.sidebarTaskSubjectFilter.addEventListener('change', () => {
        this.renderSidebarTasks();
      });
    }

    // Keyboard Shortcuts: Alt+T for tasks sidebar, Esc for closing sidebar/modal/zen
    document.addEventListener('keydown', (e) => {
      const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
      const isZen = timer.getState().isZenMode;

      if (e.altKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        this.toggleTaskSidebar();
      } else if (e.key === 'Escape') {
        if (isZen) {
          timer.toggleZenMode(false);
          return;
        }
        if (this.globalTaskSidebar && this.globalTaskSidebar.classList.contains('open')) {
          this.closeTaskSidebar();
        }
        if (this.themeModal && this.themeModal.classList.contains('active')) {
          this.closeThemeModal();
        }
      } else if (isZen && !isInput) {
        if (e.code === 'Space') {
          e.preventDefault();
          const state = timer.getState();
          if (state.isRunning) {
            timer.pause();
          } else {
            timer.start();
          }
          playClickSound();
        } else if (e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          if (this.btnZenToggleNotes) this.btnZenToggleNotes.click();
        } else if (e.key === 'f' || e.key === 'F') {
          e.preventDefault();
          if (this.btnFullscreen) this.btnFullscreen.click();
        }
      }
    });

    // View Switching
    this.navTabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        this.switchView(view);
        playClickSound();
      });
    });

    // Timer Mode Switchers
    this.timerModeStopwatch.addEventListener('click', () => {
      if (timer.isRunning) return;
      timer.setMode('stopwatch');
      this.updateTimerModeButtons('stopwatch');
      playClickSound();
    });

    this.timerModeCountdown.addEventListener('click', () => {
      if (timer.isRunning) return;
      timer.setMode('countdown');
      this.updateTimerModeButtons('countdown');
      playClickSound();
    });

    // Preset minute buttons
    this.countdownPresets.addEventListener('click', (e) => {
      const btn = e.target.closest('.preset-btn');
      if (!btn || timer.isRunning) return;
      const mins = parseInt(btn.dataset.mins, 10);
      if (mins) {
        timer.setMode('countdown');
        timer.setTargetMinutes(mins);
        this.updatePresetButtons(mins);
        playClickSound();
      }
    });

    // Context changes
    this.subjectSelect.addEventListener('change', () => {
      timer.setContext({ subject: this.subjectSelect.value });
    });

    this.topicInput.addEventListener('input', () => {
      timer.setContext({ topic: this.topicInput.value });
      if (this.zenTopicDisplay) {
        this.zenTopicDisplay.textContent = this.topicInput.value || 'Focus Session';
      }
    });

    this.btnUnlinkTask.addEventListener('click', () => {
      timer.setContext({ linkedTaskId: null });
      this.renderLinkedTaskBanner(null);
      playClickSound();
    });

    // Timer Controls
    this.btnTimerToggle.addEventListener('click', () => {
      timer.toggle();
      playClickSound();
    });

    this.btnTimerReset.addEventListener('click', async () => {
      const ok = await this.showInAppConfirm({
        title: 'Reset Study Timer',
        message: 'Are you sure you want to reset the current study timer?',
        confirmText: 'Reset',
        danger: true
      });
      if (ok) {
        timer.reset();
        playClickSound();
      }
    });

    this.btnTimerFinish.addEventListener('click', () => {
      this.openFinishModal();
      playClickSound();
    });

    // Zen Mode Controls & Theater Handlers
    this.btnZenModeToggle.addEventListener('click', () => {
      timer.toggleZenMode(true);
      playClickSound();
    });

    this.btnExitZen.addEventListener('click', () => {
      timer.toggleZenMode(false);
      playClickSound();
    });

    if (this.btnZenTimerToggle) {
      this.btnZenTimerToggle.addEventListener('click', () => {
        const state = timer.getState();
        if (state.isRunning) {
          timer.pause();
        } else {
          timer.start();
        }
        playClickSound();
      });
    }

    if (this.btnZenFinishSession) {
      this.btnZenFinishSession.addEventListener('click', () => {
        this.openFinishModal();
        playClickSound();
      });
    }

    if (this.btnZenResetTimer) {
      this.btnZenResetTimer.addEventListener('click', () => {
        timer.reset();
        playClickSound();
      });
    }

    if (this.btnZenToggleNotes) {
      this.btnZenToggleNotes.addEventListener('click', () => {
        if (this.zenNotesContainer) {
          this.zenNotesContainer.classList.toggle('collapsed');
          const isCollapsed = this.zenNotesContainer.classList.contains('collapsed');
          this.btnZenToggleNotes.textContent = isCollapsed ? 'Notes' : '✕ Hide Notes';
        }
        playClickSound();
      });
    }

    if (this.btnZenCloseNotes) {
      this.btnZenCloseNotes.addEventListener('click', () => {
        if (this.zenNotesContainer) {
          this.zenNotesContainer.classList.add('collapsed');
          if (this.btnZenToggleNotes) this.btnZenToggleNotes.textContent = 'Notes';
        }
        playClickSound();
      });
    }

    if (this.zenSoundscapeSelect) {
      this.zenSoundscapeSelect.addEventListener('change', () => {
        const sound = this.zenSoundscapeSelect.value;
        const vol = parseFloat(this.ambientVolumeSlider.value) || 0.5;
        this.ambientSoundSelect.value = sound;
        store.updateSettings({ ambientSound: sound });
        setAmbientSound(sound, vol);
        playClickSound();
      });
    }

    this.btnFullscreen.addEventListener('click', async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        } else {
          await document.exitFullscreen();
        }
      } catch (e) {}
      wakeLockManager.update();
    });

    // Notes auto-save to timer draft
    this.sessionNotesArea.addEventListener('input', () => {
      timer.setDraftNotes(this.sessionNotesArea.value);
    });

    // Ambient audio
    this.ambientSoundSelect.addEventListener('change', () => {
      const sound = this.ambientSoundSelect.value;
      const vol = parseFloat(this.ambientVolumeSlider.value) || 0.5;
      store.updateSettings({ ambientSound: sound });
      setAmbientSound(sound, vol);
    });

    this.ambientVolumeSlider.addEventListener('input', () => {
      const vol = parseFloat(this.ambientVolumeSlider.value) || 0.5;
      store.updateSettings({ volume: vol });
      updateAmbientVolume(vol);
    });

    // Task Form (Time, Due Date, and Recurrence are completely OPTIONAL)
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

    // Focus View Quick Due Date Chips (MS To Do style)
    if (this.focusQuickDates) {
      this.focusQuickDates.querySelectorAll('.quick-date-chip[data-focus-preset]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const preset = btn.dataset.focusPreset;
          const d = new Date();
          let targetDateStr = null;
          if (preset === 'today') {
            targetDateStr = toLocalDateStr(d);
          } else if (preset === 'tomorrow') {
            d.setDate(d.getDate() + 1);
            targetDateStr = toLocalDateStr(d);
          } else if (preset === 'nextweek') {
            const day = d.getDay() || 7;
            d.setDate(d.getDate() + (8 - day));
            targetDateStr = toLocalDateStr(d);
          }
          if (this.taskDueDateInput) {
            this.taskDueDateInput.value = targetDateStr || '';
          }
          this.updateFocusDateChips(preset);
          playClickSound();
        });
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
      this.taskDueDateInput.addEventListener('change', () => {
        this.updateFocusDateChips();
      });
    }

    // Task Filters
    this.taskFilterTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        this.taskFilterTabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentTaskFilter = tab.dataset.filter;
        this.renderTasks();
        playClickSound();
      });
    });

    // Microsoft To Do Smart Tabs
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

    // Group By Change
    if (this.taskGroupBySelect) {
      this.taskGroupBySelect.addEventListener('change', () => {
        this.taskGroupBy = this.taskGroupBySelect.value;
        this.renderTasks();
      });
    }

    // Sort By Change
    if (this.taskSortBySelect) {
      this.taskSortBySelect.addEventListener('change', () => {
        this.taskSortBy = this.taskSortBySelect.value;
        this.renderTasks();
      });
    }

    this.taskSubjectFilter.addEventListener('change', () => {
      this.currentSubjectFilter = this.taskSubjectFilter.value;
      this.renderTasks();
    });

    // Task Edit Modal Event Listeners
    if (this.btnCloseEditTaskModal) {
      this.btnCloseEditTaskModal.addEventListener('click', () => {
        this.closeTaskEditModal();
      });
    }
    if (this.btnCancelEditTask) {
      this.btnCancelEditTask.addEventListener('click', () => {
        this.closeTaskEditModal();
      });
    }
    if (this.taskEditModal) {
      this.taskEditModal.addEventListener('click', (e) => {
        if (e.target === this.taskEditModal) {
          this.closeTaskEditModal();
        }
      });
    }
    if (this.btnDeleteFromEditModal) {
      this.btnDeleteFromEditModal.addEventListener('click', async () => {
        const taskId = this.editTaskId ? this.editTaskId.value : '';
        if (!taskId) return;
        const task = store.getState().tasks.find((t) => t.id === taskId);
        const title = task ? task.title : 'this task';
        const ok = await this.showInAppConfirm({
          title: 'Delete Study Task',
          message: `Delete study task "${title}"?`,
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
    if (this.taskEditForm) {
      this.taskEditForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const taskId = this.editTaskId ? this.editTaskId.value : '';
        if (!taskId) return;
        const title = this.editTaskTitle ? this.editTaskTitle.value.trim() : '';
        if (!title) return;
        const subject = this.editTaskSubject ? this.editTaskSubject.value : '';
        const targetMinutes = (this.editTaskMinutes && this.editTaskMinutes.value) ? parseInt(this.editTaskMinutes.value, 10) : null;
        const dueDate = (this.editTaskDueDate && this.editTaskDueDate.value) ? this.editTaskDueDate.value : null;
        const recurrence = this.editTaskRecurrence ? this.editTaskRecurrence.value : 'none';
        const notes = this.editTaskNotes ? this.editTaskNotes.value.trim() : '';

        const updates = {
          title,
          subject,
          targetMinutes,
          dueDate,
          recurrence,
          notes
        };

        if (this.editTaskTimeSpent && this.editTaskTimeSpent.value !== '') {
          const spentMins = parseInt(this.editTaskTimeSpent.value, 10);
          if (!isNaN(spentMins) && spentMins >= 0) {
            updates.timeSpentSec = spentMins * 60;
          }
        }

        store.updateTask(taskId, updates);

        playClickSound();
        this.closeTaskEditModal();
      });
    }

    // Subject Management Page
    this.btnOpenAddSubject.addEventListener('click', () => {
      this.openSubjectModal(null);
      playClickSound();
    });

    this.btnCancelSubject.addEventListener('click', () => {
      this.subjectModal.classList.remove('active');
    });

    this.subjectForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = this.subjectNameInput.value.trim();
      const code = this.subjectCodeInput.value.trim();
      const group = this.subjectGroupInput.value.trim() || 'General';
      const folderPath = this.subjectFolderInput.value.trim();
      const color = this.subjectColorInput.value;
      const hours = this.subjectHoursInput.value ? parseInt(this.subjectHoursInput.value, 10) : null;

      if (!name) return;

      if (this.editingSubjectId) {
        store.updateSubject(this.editingSubjectId, {
          name,
          code,
          group,
          folderPath,
          color,
          targetWeeklyHours: hours
        });
      } else {
        store.addSubject(name, color, code, hours, group, folderPath);
      }

      this.subjectModal.classList.remove('active');
      playClickSound();
    });

    // Weekly Event Modal (Add & Edit)
    const openWeventHandler = () => {
      this.openWeeklyEventModal(null);
      playClickSound();
    };
    if (this.btnOpenWeeklyEventModal) this.btnOpenWeeklyEventModal.addEventListener('click', openWeventHandler);
    if (this.btnOpenAddWeeklyEventSub) this.btnOpenAddWeeklyEventSub.addEventListener('click', openWeventHandler);

    if (this.btnCancelWevent) {
      this.btnCancelWevent.addEventListener('click', () => {
        this.weeklyEventModal.classList.remove('active');
      });
    }

    if (this.btnDeleteWevent) {
      this.btnDeleteWevent.addEventListener('click', async () => {
        const id = this.weventEditId.value;
        if (id) {
          const ok = await this.showInAppConfirm({
            title: 'Delete Recurring Event',
            message: 'Are you sure you want to delete this recurring weekly event?',
            confirmText: 'Delete',
            danger: true
          });
          if (ok) {
            store.deleteWeeklyEvent(id);
            this.weeklyEventModal.classList.remove('active');
            this.renderCalendar();
            this.renderScheduleManagerModal();
            playClickSound();
          }
        }
      });
    }

    if (this.weventRecurrenceSelect) {
      this.weventRecurrenceSelect.addEventListener('change', () => {
        const val = this.weventRecurrenceSelect.value;
        if (this.weventDayGroup) {
          const isDailyOrWeekdays = val === 'daily' || val === 'weekdays';
          this.weventDayGroup.style.opacity = isDailyOrWeekdays ? '0.5' : '1';
          this.weventDayGroup.style.pointerEvents = isDailyOrWeekdays ? 'none' : 'auto';
        }
      });
    }

    if (this.weeklyEventForm) {
      this.weeklyEventForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const editId = this.weventEditId ? this.weventEditId.value : null;
        const title = document.getElementById('wevent-title-input').value.trim();
        const recurrence = this.weventRecurrenceSelect ? this.weventRecurrenceSelect.value : 'weekly';
        const day = parseInt(document.getElementById('wevent-day-select').value, 10);
        const start = document.getElementById('wevent-start-input').value;
        const end = document.getElementById('wevent-end-input').value;
        const category = document.getElementById('wevent-cat-input').value.trim() || 'Seminars & Academies';
        const color = document.getElementById('wevent-color-input').value;
        const notes = document.getElementById('wevent-notes-input').value.trim();

        if (!title) return;

        if (editId) {
          store.updateWeeklyEvent(editId, { title, day, start, end, category, color, recurrence, notes });
        } else {
          store.addWeeklyEvent({ title, day, start, end, category, color, recurrence, notes });
        }

        this.weeklyEventModal.classList.remove('active');
        this.renderCalendar();
        this.renderScheduleManagerModal();
        playClickSound();
      });
    }

    // Lecture Slot Form & Actions
    if (this.btnCancelLslot) {
      this.btnCancelLslot.addEventListener('click', () => {
        this.lectureSlotModal.classList.remove('active');
      });
    }

    if (this.btnDeleteLslot) {
      this.btnDeleteLslot.addEventListener('click', async () => {
        const subjectId = this.lslotSubjectId.value;
        const slotIdx = parseInt(this.lslotIndex.value, 10);
        if (subjectId && !isNaN(slotIdx)) {
          const ok = await this.showInAppConfirm({
            title: 'Remove Lecture Slot',
            message: 'Remove this lecture slot from the weekly schedule?',
            confirmText: 'Remove',
            danger: true
          });
          if (ok) {
            store.deleteLectureSlot(subjectId, slotIdx);
            this.lectureSlotModal.classList.remove('active');
            this.renderCalendar();
            this.renderScheduleManagerModal();
            playClickSound();
          }
        }
      });
    }

    if (this.lectureSlotForm) {
      this.lectureSlotForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const subjectId = this.lslotSubjectId.value;
        const slotIdx = parseInt(this.lslotIndex.value, 10);
        const day = parseInt(this.lslotDaySelect.value, 10);
        const start = this.lslotStartInput.value;
        const end = this.lslotEndInput.value;
        const label = this.lslotLabelInput.value.trim() || 'Lecture';

        if (subjectId && !isNaN(slotIdx)) {
          store.updateLectureSlot(subjectId, slotIdx, { day, start, end, label });
        }

        this.lectureSlotModal.classList.remove('active');
        this.renderCalendar();
        this.renderScheduleManagerModal();
        playClickSound();
      });
    }

    // Schedule Manager Modal
    const openScheduleMgrHandler = () => {
      this.openScheduleManagerModal();
      playClickSound();
    };
    if (this.btnManageSchedule) this.btnManageSchedule.addEventListener('click', openScheduleMgrHandler);
    if (this.btnManageScheduleSub) this.btnManageScheduleSub.addEventListener('click', openScheduleMgrHandler);

    if (this.btnCloseScheduleManager) {
      this.btnCloseScheduleManager.addEventListener('click', () => {
        this.scheduleManagerModal.classList.remove('active');
      });
    }

    if (this.btnMgrAddWevent) {
      this.btnMgrAddWevent.addEventListener('click', () => {
        this.openWeeklyEventModal(null);
        playClickSound();
      });
    }

    // Manage Categories Modal
    if (this.btnManageCategories) {
      this.btnManageCategories.addEventListener('click', () => {
        this.openCategoriesModal();
        playClickSound();
      });
    }

    if (this.btnCloseCategoriesModal) {
      this.btnCloseCategoriesModal.addEventListener('click', () => {
        this.categoriesModal.classList.remove('active');
        playClickSound();
      });
    }

    if (this.addCategoryForm) {
      this.addCategoryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const val = this.newCategoryInput.value.trim();
        if (val) {
          store.addCategory(val);
          this.newCategoryInput.value = '';
          this.renderCategoriesModal();
          this.renderSubjectsPage();
          playClickSound();
        }
      });
    }

    // Calendar Navigation & Controls
    this.calModeWeekBtn.addEventListener('click', () => {
      this.calendarViewMode = 'week';
      this.calModeWeekBtn.classList.add('active');
      this.calModeMonthBtn.classList.remove('active');
      this.renderCalendar();
      playClickSound();
    });

    this.calModeMonthBtn.addEventListener('click', () => {
      this.calendarViewMode = 'month';
      this.calModeMonthBtn.classList.add('active');
      this.calModeWeekBtn.classList.remove('active');
      this.renderCalendar();
      playClickSound();
    });

    this.calPrevBtn.addEventListener('click', () => {
      if (this.calendarViewMode === 'week') {
        this.calendarAnchorDate.setDate(this.calendarAnchorDate.getDate() - 7);
      } else {
        this.calendarAnchorDate.setMonth(this.calendarAnchorDate.getMonth() - 1);
      }
      this.renderCalendar();
      playClickSound();
    });

    this.calNextBtn.addEventListener('click', () => {
      if (this.calendarViewMode === 'week') {
        this.calendarAnchorDate.setDate(this.calendarAnchorDate.getDate() + 7);
      } else {
        this.calendarAnchorDate.setMonth(this.calendarAnchorDate.getMonth() + 1);
      }
      this.renderCalendar();
      playClickSound();
    });

    this.calTodayBtn.addEventListener('click', () => {
      this.calendarAnchorDate = new Date();
      this.renderCalendar();
      playClickSound();
    });

    this.calSubjectFilter.addEventListener('change', () => {
      this.calendarSubjectFilter = this.calSubjectFilter.value;
      this.renderCalendar();
    });

    // Google Calendar Sync
    this.btnGCalSync.addEventListener('click', () => {
      this.gcalModal.classList.add('active');
      playClickSound();
    });

    this.btnCloseGcalModal.addEventListener('click', () => {
      this.gcalModal.classList.remove('active');
    });

    this.btnDownloadIcs.addEventListener('click', () => {
      const icsData = store.generateICS();
      this.downloadFile(icsData, `chronostudy-schedule-${new Date().toISOString().slice(0, 10)}.ics`, 'text/calendar');
    });

    // History Filters
    this.historySubjectFilterEl.addEventListener('change', () => {
      this.historySubjectFilter = this.historySubjectFilterEl.value;
      this.renderHistory();
    });

    // Finish Modal
    this.finishModalTaskCompleteGroup.addEventListener('click', () => {
      this.finishModalTaskCheckbox.checked = !this.finishModalTaskCheckbox.checked;
    });

    this.btnCancelFinishSession.addEventListener('click', () => {
      this.finishModal.classList.remove('active');
    });

    this.btnSaveFinishedSession.addEventListener('click', () => {
      this.saveFinishedSession();
    });

    // Manual Log
    this.btnLogPast.addEventListener('click', () => {
      this.openManualLogModal();
      playClickSound();
    });

    this.btnCancelManualLog.addEventListener('click', () => {
      this.manualLogModal.classList.remove('active');
    });

    this.manualLogForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveManualLog();
    });

    // Backup & Export Modal
    this.backupBtn.addEventListener('click', () => {
      this.backupModal.classList.add('active');
      playClickSound();
    });

    this.btnCloseBackup.addEventListener('click', () => {
      this.backupModal.classList.remove('active');
    });

    this.btnExportJson.addEventListener('click', () => {
      this.downloadFile(store.exportJSON(), `chronostudy-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
    });

    this.btnExportCsv.addEventListener('click', () => {
      this.downloadFile(store.exportCSV(), `chronostudy-log-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
    });

    this.btnImportJson.addEventListener('click', () => {
      this.jsonFileInput.click();
    });

    this.jsonFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = store.importJSON(event.target.result);
        if (result.success) {
          alert(`Successfully imported backup with ${result.count} study sessions!`);
          this.backupModal.classList.remove('active');
        } else {
          alert('Failed to import backup: ' + result.error);
        }
      };
      reader.readAsText(file);
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        timer.toggle();
        playClickSound();
      } else if (e.code === 'KeyF' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.openFinishModal();
      } else if (e.code === 'KeyZ') {
        timer.toggleZenMode();
      } else if (e.code === 'Escape') {
        if (timer.isZenMode) {
          timer.toggleZenMode(false);
        }
        document.querySelectorAll('.modal.active').forEach((m) => m.classList.remove('active'));
      }
    });
  }

  switchView(viewName) {
    this.activeView = viewName;
    this.navTabBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    Object.entries(this.views).forEach(([name, el]) => {
      if (el) {
        el.style.display = name === viewName ? 'block' : 'none';
      }
    });

    if (viewName === 'calendar') {
      this.renderCalendar();
    } else if (viewName === 'subjects') {
      this.renderSubjectsPage();
    } else if (viewName === 'history') {
      this.renderHistory();
    }
  }

  // --- In-App Dialog Engine (Eliminates disruptive browser prompt/confirm alerts) ---
  showInAppConfirm({ title = 'Confirm Action', message = '', confirmText = 'Confirm', danger = false }) {
    return new Promise((resolve) => {
      const modal = document.getElementById('inapp-dialog-modal');
      const titleEl = document.getElementById('inapp-dialog-title');
      const msgEl = document.getElementById('inapp-dialog-message');
      const inputGroup = document.getElementById('inapp-dialog-input-group');
      const btnCancel = document.getElementById('inapp-dialog-btn-cancel');
      const btnConfirm = document.getElementById('inapp-dialog-btn-confirm');

      if (!modal || !titleEl || !btnConfirm) {
        resolve(window.confirm(`${title}\n\n${message}`));
        return;
      }

      titleEl.textContent = title;
      if (typeof message === 'string' && message.includes('drive.googleapis.com')) {
        const urlMatch = message.match(/https:\/\/console\.developers\.google\.com[^\s'"]+/);
        const url = urlMatch ? urlMatch[0] : '';
        msgEl.innerHTML = `
          <div style="line-height: 1.45;">Google Drive API is not yet enabled in your Google Cloud project.</div>
          <div style="margin-top: 0.85rem; text-align: center;">
            <a href="${url}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="display:inline-block; padding: 0.5rem 1rem; text-decoration: none; font-size: 0.85rem; font-weight: 600;">
              → Enable Google Drive API in Google Cloud
            </a>
          </div>
          <div style="margin-top: 0.75rem; font-size: 0.76rem; color: var(--text-dim); line-height: 1.4;">
            Click the blue <strong>"ENABLE"</strong> button on the Google Cloud page, then return here and click "Sync Now".
          </div>
        `;
      } else {
        msgEl.textContent = message;
      }
      msgEl.style.display = message ? 'block' : 'none';
      if (inputGroup) inputGroup.style.display = 'none';

      btnConfirm.textContent = confirmText;
      btnConfirm.className = danger ? 'btn btn-secondary' : 'btn btn-primary';
      if (danger) {
        btnConfirm.style.color = 'var(--accent-red, #ef4444)';
        btnConfirm.style.borderColor = 'rgba(239, 68, 68, 0.4)';
      } else {
        btnConfirm.style.color = '';
        btnConfirm.style.borderColor = '';
      }

      const cleanup = (result) => {
        modal.classList.remove('active');
        btnCancel.removeEventListener('click', onCancel);
        btnConfirm.removeEventListener('click', onConfirm);
        document.removeEventListener('keydown', onKeyDown);
        resolve(result);
      };

      const onCancel = () => cleanup(false);
      const onConfirm = () => cleanup(true);
      const onKeyDown = (e) => {
        if (e.key === 'Escape') cleanup(false);
        if (e.key === 'Enter') cleanup(true);
      };

      btnCancel.addEventListener('click', onCancel);
      btnConfirm.addEventListener('click', onConfirm);
      document.addEventListener('keydown', onKeyDown);

      modal.classList.add('active');
      btnConfirm.focus();
    });
  }

  showInAppPrompt({ title = 'Enter Value', message = '', defaultValue = '', placeholder = '', confirmText = 'Save' }) {
    return new Promise((resolve) => {
      const modal = document.getElementById('inapp-dialog-modal');
      const titleEl = document.getElementById('inapp-dialog-title');
      const msgEl = document.getElementById('inapp-dialog-message');
      const inputGroup = document.getElementById('inapp-dialog-input-group');
      const inputEl = document.getElementById('inapp-dialog-input');
      const btnCancel = document.getElementById('inapp-dialog-btn-cancel');
      const btnConfirm = document.getElementById('inapp-dialog-btn-confirm');

      if (!modal || !titleEl || !inputEl) {
        resolve(window.prompt(`${title}\n\n${message}`, defaultValue));
        return;
      }

      titleEl.textContent = title;
      if (typeof message === 'string' && message.includes('drive.googleapis.com')) {
        const urlMatch = message.match(/https:\/\/console\.developers\.google\.com[^\s'"]+/);
        const url = urlMatch ? urlMatch[0] : '';
        msgEl.innerHTML = `
          <div style="line-height: 1.45;">Google Drive API is not yet enabled in your Google Cloud project.</div>
          <div style="margin-top: 0.85rem; text-align: center;">
            <a href="${url}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="display:inline-block; padding: 0.5rem 1rem; text-decoration: none; font-size: 0.85rem; font-weight: 600;">
              → Enable Google Drive API in Google Cloud
            </a>
          </div>
          <div style="margin-top: 0.75rem; font-size: 0.76rem; color: var(--text-dim); line-height: 1.4;">
            Click the blue <strong>"ENABLE"</strong> button on the Google Cloud page, then return here and click "Sync Now".
          </div>
        `;
      } else {
        msgEl.textContent = message;
      }
      msgEl.style.display = message ? 'block' : 'none';

      if (inputGroup) inputGroup.style.display = 'block';
      inputEl.value = defaultValue || '';
      inputEl.placeholder = placeholder || '';

      btnConfirm.textContent = confirmText;
      btnConfirm.className = 'btn btn-primary';
      btnConfirm.style.color = '';
      btnConfirm.style.borderColor = '';

      const cleanup = (result) => {
        modal.classList.remove('active');
        btnCancel.removeEventListener('click', onCancel);
        btnConfirm.removeEventListener('click', onConfirm);
        document.removeEventListener('keydown', onKeyDown);
        resolve(result);
      };

      const onCancel = () => cleanup(null);
      const onConfirm = () => {
        const val = inputEl.value.trim();
        cleanup(val);
      };
      const onKeyDown = (e) => {
        if (e.key === 'Escape') cleanup(null);
        if (e.key === 'Enter') {
          e.preventDefault();
          onConfirm();
        }
      };

      btnCancel.addEventListener('click', onCancel);
      btnConfirm.addEventListener('click', onConfirm);
      document.addEventListener('keydown', onKeyDown);

      modal.classList.add('active');
      setTimeout(() => {
        inputEl.focus();
        inputEl.select();
      }, 50);
    });
  }

  showInAppAlert({ title = 'Notice', message = '', buttonText = 'OK' }) {
    return new Promise((resolve) => {
      const modal = document.getElementById('inapp-dialog-modal');
      const titleEl = document.getElementById('inapp-dialog-title');
      const msgEl = document.getElementById('inapp-dialog-message');
      const inputGroup = document.getElementById('inapp-dialog-input-group');
      const btnCancel = document.getElementById('inapp-dialog-btn-cancel');
      const btnConfirm = document.getElementById('inapp-dialog-btn-confirm');

      if (!modal || !titleEl || !btnConfirm) {
        window.alert(`${title}\n\n${message}`);
        resolve();
        return;
      }

      titleEl.textContent = title;
      if (typeof message === 'string' && message.includes('drive.googleapis.com')) {
        const urlMatch = message.match(/https:\/\/console\.developers\.google\.com[^\s'"]+/);
        const url = urlMatch ? urlMatch[0] : '';
        msgEl.innerHTML = `
          <div style="line-height: 1.45;">Google Drive API is not yet enabled in your Google Cloud project.</div>
          <div style="margin-top: 0.85rem; text-align: center;">
            <a href="${url}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="display:inline-block; padding: 0.5rem 1rem; text-decoration: none; font-size: 0.85rem; font-weight: 600;">
              → Enable Google Drive API in Google Cloud
            </a>
          </div>
          <div style="margin-top: 0.75rem; font-size: 0.76rem; color: var(--text-dim); line-height: 1.4;">
            Click the blue <strong>"ENABLE"</strong> button on the Google Cloud page, then return here and click "Sync Now".
          </div>
        `;
      } else {
        msgEl.textContent = message;
      }
      msgEl.style.display = message ? 'block' : 'none';
      if (inputGroup) inputGroup.style.display = 'none';
      if (btnCancel) btnCancel.style.display = 'none';

      btnConfirm.textContent = buttonText;
      btnConfirm.className = 'btn btn-primary';

      const cleanup = () => {
        modal.classList.remove('active');
        btnConfirm.removeEventListener('click', onConfirm);
        document.removeEventListener('keydown', onKeyDown);
        if (btnCancel) btnCancel.style.display = 'inline-block';
        resolve();
      };

      const onConfirm = () => cleanup();
      const onKeyDown = (e) => {
        if (e.key === 'Escape' || e.key === 'Enter') {
          e.preventDefault();
          cleanup();
        }
      };

      btnConfirm.addEventListener('click', onConfirm);
      document.addEventListener('keydown', onKeyDown);

      modal.classList.add('active');
      btnConfirm.focus();
    });
  }

  // --- Multi-Device Cloud Sync Methods ---
  openSyncModal() {
    if (!this.cloudSyncModal) return;
    const syncState = store.getState().sync || {};
    if (this.gdriveClientId) this.gdriveClientId.value = syncState.googleClientId || '';
    if (this.gdrivePassphrase) this.gdrivePassphrase.value = syncState.passphrase || '';
    if (this.gdriveAutoToggle) this.gdriveAutoToggle.checked = syncState.autoSync !== false;

    if (this.syncSupabaseUrl) this.syncSupabaseUrl.value = syncState.supabaseUrl || '';
    if (this.syncSupabaseKey) this.syncSupabaseKey.value = syncState.supabaseKey || '';
    if (this.syncSupabaseRoom) this.syncSupabaseRoom.value = syncState.supabaseRoomId || '';
    if (this.syncPassphrase) this.syncPassphrase.value = syncState.passphrase || '';
    if (this.syncAutoToggle) this.syncAutoToggle.checked = syncState.autoSync !== false;

    this.renderSyncStatus(syncManager.getStatus());
    this.cloudSyncModal.classList.add('active');
  }

  closeSyncModal() {
    if (this.cloudSyncModal) {
      this.cloudSyncModal.classList.remove('active');
    }
  }

  switchSyncTab(tabName) {
    if (this.syncTabBtns) {
      this.syncTabBtns.forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.syncTab === tabName);
      });
    }
    if (this.syncTabPanels) {
      Object.entries(this.syncTabPanels).forEach(([key, panel]) => {
        if (panel) {
          panel.style.display = key === tabName ? 'block' : 'none';
        }
      });
    }
  }

  renderSyncStatus(status) {
    // Header dot & label
    if (this.cloudSyncDot && this.cloudSyncLabel) {
      this.cloudSyncDot.className = 'sync-dot';
      if (!status.isOnline) {
        this.cloudSyncDot.classList.add('sync-dot-offline');
        this.cloudSyncLabel.textContent = 'Offline';
      } else if (status.status === 'syncing') {
        this.cloudSyncDot.classList.add('sync-dot-syncing');
        this.cloudSyncLabel.textContent = 'Syncing...';
      } else if (status.status === 'synced') {
        this.cloudSyncDot.classList.add('sync-dot-synced');
        this.cloudSyncLabel.textContent = 'Synced';
      } else if (status.status === 'error') {
        this.cloudSyncDot.classList.add('sync-dot-error');
        this.cloudSyncLabel.textContent = 'Sync Error';
      } else {
        this.cloudSyncDot.classList.add('sync-dot-idle');
        this.cloudSyncLabel.textContent = 'Sync';
      }
    }

    // Modal elements
    if (this.modalSyncDot) {
      this.modalSyncDot.className = 'sync-dot';
      if (!status.isOnline) {
        this.modalSyncDot.classList.add('sync-dot-offline');
      } else if (status.status === 'syncing') {
        this.modalSyncDot.classList.add('sync-dot-syncing');
      } else if (status.status === 'synced') {
        this.modalSyncDot.classList.add('sync-dot-synced');
      } else if (status.status === 'error') {
        this.modalSyncDot.classList.add('sync-dot-error');
      } else {
        this.modalSyncDot.classList.add('sync-dot-idle');
      }
    }

    if (this.modalDeviceId) {
      this.modalDeviceId.textContent = status.deviceId || 'device-local';
    }

    if (this.modalLastSynced) {
      if (status.lastSyncedAt) {
        const d = new Date(status.lastSyncedAt);
        this.modalLastSynced.textContent = `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      } else {
        this.modalLastSynced.textContent = 'Never';
      }
    }

    if (this.modalUnsyncedCount) {
      this.modalUnsyncedCount.textContent = status.hasChanges
        ? `${status.unsyncedCount} change${status.unsyncedCount === 1 ? '' : 's'} pending`
        : 'All changes synced';
    }

    if (this.modalNetworkStatus) {
      this.modalNetworkStatus.textContent = status.isOnline ? 'Online' : 'Offline';
      this.modalNetworkStatus.className = 'sync-meta-val ' + (status.isOnline ? 'text-green' : 'text-rose');
    }

    if (this.modalSyncTitle) {
      if (!status.isOnline) {
        this.modalSyncTitle.textContent = 'Device Offline';
      } else if (status.status === 'syncing') {
        this.modalSyncTitle.textContent = 'Syncing with Cloud...';
      } else if (status.status === 'synced') {
        this.modalSyncTitle.textContent = 'Cloud Synchronized';
      } else if (status.status === 'error') {
        this.modalSyncTitle.textContent = 'Sync Attention Needed';
      } else if (status.isConfigured) {
        this.modalSyncTitle.textContent = 'Ready to Sync';
      } else {
        this.modalSyncTitle.textContent = 'Local Mode (No Cloud Account)';
      }
    }

    if (this.modalSyncSubtitle) {
      if (!status.isOnline) {
        this.modalSyncSubtitle.textContent = 'Changes queued locally; will auto-sync upon reconnection';
      } else if (status.lastError) {
        const err = String(status.lastError);
        const errLower = err.toLowerCase();
        const isDriveDisabled = (errLower.includes('google drive api') || errLower.includes('drive.googleapis.com')) &&
          (errLower.includes('disabled') || errLower.includes('has not been used') || errLower.includes('403') || errLower.includes('service_disabled') || errLower.includes('accessnotconfigured'));

        if (isDriveDisabled) {
          const match = err.match(/https?:\/\/[^\s'"\\]+/);
          const rawUrl = match ? match[0].replace(/\\/g, '') : '';
          const projectIdMatch = err.match(/project[=\s](\d+)/i) || (status.googleClientId ? status.googleClientId.match(/^(\d+)-/) : null);
          const projectId = projectIdMatch ? projectIdMatch[1] : '749004251176';
          const enableUrl = rawUrl || `https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=${projectId}`;
          this.modalSyncSubtitle.innerHTML = `
            <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 6px; padding: 0.65rem 0.85rem; margin-top: 0.35rem; text-align: left; font-family: system-ui, -apple-system, sans-serif; text-transform: none; letter-spacing: normal;">
              <div style="color: #fca5a5; font-weight: 600; font-size: 0.82rem; margin-bottom: 0.25rem;">
                ⚠ Google Drive API Disabled in Project ${projectId}
              </div>
              <div style="font-size: 0.74rem; color: #fecaca; line-height: 1.45;">
                Google blocked the sync because the Google Drive API library is not yet enabled in your Google Cloud Console project.
              </div>
              <div style="margin-top: 0.55rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <a href="${enableUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.4rem 0.85rem; font-size: 0.76rem; text-decoration: none; font-weight: 600; background: #eab308; color: #000; border: none; border-radius: 4px;">
                  ↗ Enable Google Drive API (1 Click)
                </a>
                <span style="font-size: 0.72rem; color: #94a3b8;">
                  Click the blue "ENABLE" button, then return and click "Sync Now".
                </span>
              </div>
            </div>
          `;
        } else {
          this.modalSyncSubtitle.textContent = status.lastError;
        }
      } else if (status.provider === 'gdrive' && status.googleUserEmail) {
        this.modalSyncSubtitle.textContent = `Google Drive: ${status.googleUserEmail} • chronostudy_sync.json`;
      } else if (status.provider === 'supabase' && status.roomId) {
        this.modalSyncSubtitle.textContent = `Supabase Room: ${status.roomId} • Encrypted End-to-End`;
      } else {
        this.modalSyncSubtitle.textContent = 'Connect Google Drive or Supabase to sync automatically across devices';
      }
    }

    // Google Drive connection status card
    if (this.gdriveUserStatus && this.gdriveFileStatus) {
      if (status.googleUserEmail) {
        this.gdriveUserStatus.textContent = `Connected: ${status.googleUserEmail}`;
        this.gdriveFileStatus.textContent = 'Active • Syncing automatically to chronostudy_sync.json';
        if (this.btnGdriveSignin) this.btnGdriveSignin.style.display = 'none';
        if (this.btnGdriveDisconnect) this.btnGdriveDisconnect.style.display = 'inline-block';
      } else {
        this.gdriveUserStatus.textContent = 'Not Connected';
        this.gdriveFileStatus.textContent = 'Sign in to sync your study logs to Google Drive';
        if (this.btnGdriveSignin) {
          this.btnGdriveSignin.style.display = 'flex';
          this.btnGdriveSignin.disabled = false;
          this.btnGdriveSignin.innerHTML = 'Sign in with Google Drive';
        }
        if (this.btnGdriveDisconnect) this.btnGdriveDisconnect.style.display = 'none';
      }
    }
  }

  async handleGoogleDriveSignIn() {
    const clientId = this.gdriveClientId ? this.gdriveClientId.value.trim() : '';
    const pass = this.gdrivePassphrase ? this.gdrivePassphrase.value.trim() : '';
    const auto = this.gdriveAutoToggle ? this.gdriveAutoToggle.checked : true;

    if (!clientId) {
      await this.showInAppAlert({
        title: 'Google Client ID Required',
        message: 'Please paste your Google OAuth Client ID into the field below. Click "How to get your free Google Client ID" for simple 2-minute steps.'
      });
      if (this.gdriveClientId) this.gdriveClientId.focus();
      return;
    }

    store.updateSyncSettings({
      provider: 'gdrive',
      googleClientId: clientId,
      passphrase: pass,
      autoSync: auto
    });

    try {
      if (this.btnGdriveSignin) {
        this.btnGdriveSignin.disabled = true;
        this.btnGdriveSignin.textContent = 'Connecting with Google...';
      }

      await syncManager.requestGoogleAccessToken({ clientId, interactive: true });
      await this.triggerSyncNow();

      if (this.btnGdriveSignin) {
        this.btnGdriveSignin.disabled = false;
        this.btnGdriveSignin.innerHTML = 'Sign in with Google Drive';
      }
    } catch (err) {
      if (this.btnGdriveSignin) {
        this.btnGdriveSignin.disabled = false;
        this.btnGdriveSignin.innerHTML = 'Sign in with Google Drive';
      }
      await this.showInAppAlert({
        title: 'Google Sign-In Alert',
        message: err.message || 'Failed to authenticate with Google.'
      });
    }
  }

  async handleGoogleDriveDisconnect() {
    const confirmed = await this.showInAppConfirm({
      title: 'Disconnect Google Drive',
      message: 'Are you sure you want to disconnect Google Drive synchronization? Your local study data will remain completely intact.'
    });
    if (!confirmed) return;

    syncManager.disconnectGoogleDrive();
    await this.showInAppAlert({
      title: 'Disconnected',
      message: 'Google Drive has been disconnected. You are now in local offline mode.'
    });
  }

  async handleGoogleDriveSave() {
    const clientId = this.gdriveClientId ? this.gdriveClientId.value.trim() : '';
    const pass = this.gdrivePassphrase ? this.gdrivePassphrase.value.trim() : '';
    const auto = this.gdriveAutoToggle ? this.gdriveAutoToggle.checked : true;

    if (!clientId) {
      await this.showInAppAlert({
        title: 'Missing Client ID',
        message: 'Please enter your Google OAuth Client ID to connect with Google Drive.'
      });
      return;
    }

    store.updateSyncSettings({
      provider: 'gdrive',
      googleClientId: clientId,
      passphrase: pass,
      autoSync: auto
    });

    await this.triggerSyncNow();
  }

  async saveCloudConfig() {
    const url = this.syncSupabaseUrl ? this.syncSupabaseUrl.value.trim() : '';
    const key = this.syncSupabaseKey ? this.syncSupabaseKey.value.trim() : '';
    let room = this.syncSupabaseRoom ? this.syncSupabaseRoom.value.trim().toLowerCase() : '';
    const pass = this.syncPassphrase ? this.syncPassphrase.value.trim() : '';
    const auto = this.syncAutoToggle ? this.syncAutoToggle.checked : true;

    if (!url || !key) {
      await this.showInAppAlert({
        title: 'Missing Credentials',
        message: 'Please provide both your Supabase Project URL and Anon API key.'
      });
      return;
    }

    if (!room) {
      room = `chronostudy-room-${Math.random().toString(36).slice(2, 8)}`;
      if (this.syncSupabaseRoom) this.syncSupabaseRoom.value = room;
    }

    store.updateSyncSettings({
      provider: 'supabase',
      supabaseUrl: url,
      supabaseKey: key,
      supabaseRoomId: room,
      passphrase: pass,
      autoSync: auto
    });

    await this.triggerSyncNow();
  }

  async triggerSyncNow() {
    if (this.btnModalSyncNow) {
      this.btnModalSyncNow.disabled = true;
      this.btnModalSyncNow.textContent = 'Syncing...';
    }

    const res = await syncManager.performSync({ force: true });

    if (this.btnModalSyncNow) {
      this.btnModalSyncNow.disabled = false;
      this.btnModalSyncNow.innerHTML = '<span>⟳</span> Sync Now';
    }

    if (res.success) {
      await this.showInAppAlert({
        title: 'Sync Complete',
        message: 'Your study tasks, courses, and sessions are now fully synchronized with the cloud!'
      });
    } else if (res.reason !== 'unconfigured') {
      await this.showInAppAlert({
        title: 'Sync Alert',
        message: res.error || 'Failed to sync. Please check your network connection and Supabase settings.'
      });
    }
  }

  async copySupabaseSql() {
    const sql = `-- Run this once in your Supabase SQL Editor
create table if not exists chronostudy_sync (
  room_id text primary key,
  payload text not null,
  updated_at timestamptz default now(),
  device_id text
);

alter table chronostudy_sync enable row level security;

create policy "Allow room sync access" on chronostudy_sync
  for all using (true) with check (true);`;

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(sql);
        await this.showInAppAlert({
          title: 'SQL Setup Copied',
          message: 'The table setup SQL query was copied to your clipboard! Paste it into your Supabase Dashboard -> SQL Editor and click "Run".'
        });
      } else {
        await this.showInAppAlert({
          title: 'Supabase SQL Setup',
          message: sql
        });
      }
    } catch (e) {
      await this.showInAppAlert({
        title: 'Supabase SQL Setup',
        message: sql
      });
    }
  }

  generateRoomCode() {
    const code = `chronostudy-itu-${Math.random().toString(36).slice(2, 8)}`;
    if (this.syncSupabaseRoom) {
      this.syncSupabaseRoom.value = code;
    }
  }

  async exportSnapshotClipboard() {
    const json = syncManager.exportSnapshotJSON();
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(json);
        await this.showInAppAlert({
          title: 'Snapshot Copied',
          message: 'Full study workspace snapshot JSON copied to clipboard. You can paste it on another device to import!'
        });
      } else {
        if (this.syncImportTextarea) this.syncImportTextarea.value = json;
        await this.showInAppAlert({
          title: 'Snapshot Generated',
          message: 'Snapshot JSON has been placed in the text box below for you to copy.'
        });
      }
    } catch (e) {
      if (this.syncImportTextarea) this.syncImportTextarea.value = json;
    }
  }

  downloadSnapshotFile() {
    const json = syncManager.exportSnapshotJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chronostudy-backup-${toLocalDateStr(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async importSnapshotFromUI() {
    const text = this.syncImportTextarea ? this.syncImportTextarea.value.trim() : '';
    if (!text) {
      await this.showInAppAlert({
        title: 'Empty Input',
        message: 'Please paste the snapshot JSON text into the text area before importing.'
      });
      return;
    }

    const confirmed = await this.showInAppConfirm({
      title: 'Import Snapshot',
      message: 'This will additively merge all courses, tasks, and study sessions from the snapshot into your current workspace. Your existing data will not be lost. Continue?'
    });

    if (!confirmed) return;

    const res = await syncManager.importSnapshotJSON(text);
    if (res.success) {
      if (this.syncImportTextarea) this.syncImportTextarea.value = '';
      await this.showInAppAlert({
        title: 'Import Successful',
        message: `Successfully merged workspace snapshot! Added ${res.summary.addedTasks} new tasks and ${res.summary.addedSessions} study sessions without data loss.`
      });
    } else {
      await this.showInAppAlert({
        title: 'Import Failed',
        message: res.error || 'Failed to parse and merge snapshot.'
      });
    }
  }

  async rollbackPreSyncBackup() {
    const confirmed = await this.showInAppConfirm({
      title: 'Rollback to Pre-Sync Backup',
      message: 'Are you sure you want to revert your workspace to the automatic safety snapshot created before the last sync operation?',
      danger: true
    });

    if (!confirmed) return;

    const res = store.restoreSafetyBackup();
    if (res.success) {
      await this.showInAppAlert({
        title: 'Rollback Complete',
        message: `Workspace successfully restored to backup from ${new Date(res.backupAt).toLocaleTimeString()}.`
      });
    } else {
      await this.showInAppAlert({
        title: 'Rollback Failed',
        message: res.error || 'No safety backup snapshot found.'
      });
    }
  }

  async requestNotifications() {
    if (typeof Notification === 'undefined') {
      await this.showInAppAlert({
        title: 'Notifications Unsupported',
        message: 'Web notifications are not supported on this browser.'
      });
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      new Notification('ChronoStudy Planner', {
        body: 'Notifications enabled! You will receive study timer and lecture alerts.',
        icon: 'icons/icon-192.png'
      });
      await this.showInAppAlert({
        title: 'Notifications Active',
        message: 'Notification permission granted! ChronoStudy can now remind you of upcoming lectures and study milestones.'
      });
    } else {
      await this.showInAppAlert({
        title: 'Permission Denied',
        message: 'Notification permission was denied. You can re-enable notifications in your browser site settings.'
      });
    }
  }

  // --- Themes & Appearance Engine ---
  applyTheme(theme) {
    const validThemes = [
      'slate', 'oled', 'light', 'sepia', 'forest', 'tokyo',
      'bibliotheca', 'oxblood', 'parchment', 'oxford'
    ];
    let normalized = theme;
    if (normalized === 'dark') normalized = 'slate';
    if (!validThemes.includes(normalized)) normalized = 'slate';

    document.documentElement.setAttribute('data-theme', normalized);

    const themeColors = {
      slate: '#0d1117',
      oled: '#000000',
      light: '#f6f8fa',
      sepia: '#fbf7ee',
      forest: '#08100c',
      tokyo: '#12131d',
      bibliotheca: '#13100d',
      oxblood: '#12090b',
      parchment: '#f4ede0',
      oxford: '#08110c'
    };
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor && themeColors[normalized]) {
      metaThemeColor.setAttribute('content', themeColors[normalized]);
    }

    if (this.themeToggleBtn) {
      this.themeToggleBtn.innerHTML = normalized === 'light' || normalized === 'sepia' || normalized === 'parchment' ? '🌙' : '☀️';
    }
  }

  applyFont(fontStyle) {
    const validFonts = ['sans', 'serif', 'mono', 'humanist', 'cinzel', 'cormorant'];
    const normalized = validFonts.includes(fontStyle) ? fontStyle : 'sans';
    document.documentElement.setAttribute('data-font', normalized);
  }

  applyTimerStyle(style) {
    const validStyles = ['chronograph', 'cadran', 'minimal'];
    let normalized = style;
    if (normalized === 'chronometer') normalized = 'chronograph';
    if (!validStyles.includes(normalized)) normalized = 'chronograph';
    if (this._appliedTimerStyle === normalized) return;
    this._appliedTimerStyle = normalized;
    [this.timerCircleWrap, this.zenCircleWrap].forEach((el) => {
      if (el) {
        el.classList.remove('timer-style-cadran', 'timer-style-chronometer', 'timer-style-chronograph', 'timer-style-minimal');
        el.classList.add(`timer-style-${normalized}`);
      }
    });
  }

  // --- Floating Mini-Timer Widget (Picture-in-Picture) ---
  async togglePiPTimer() {
    if (!('pictureInPictureEnabled' in document) || !document.pictureInPictureEnabled) {
      alert('Picture-in-Picture floating timer is not supported or permitted by this browser.');
      return;
    }

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        return;
      }

      if (!this.pipCanvas) {
        this.pipCanvas = document.createElement('canvas');
        this.pipCanvas.width = 340;
        this.pipCanvas.height = 190;
        this.pipCtx = this.pipCanvas.getContext('2d');
      }

      if (!this.pipVideo) {
        this.pipVideo = document.createElement('video');
        this.pipVideo.muted = true;
        this.pipVideo.autoplay = true;
        this.pipVideo.srcObject = this.pipCanvas.captureStream(25);
      }

      await this.pipVideo.play();
      await this.pipVideo.requestPictureInPicture();

      this.updatePiPCanvas(timer.getState());
    } catch (err) {
      console.warn('PiP timer request failed:', err);
    }
  }

  updatePiPCanvas(state) {
    if (!this.pipCtx || !document.pictureInPictureElement) return;
    const ctx = this.pipCtx;
    const w = 340;
    const h = 190;

    // Dark horology timepiece background
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, w, h);

    // Dynamic accent color
    const subColor = store.getSubjectColor(state.subject) || '#3b82f6';
    ctx.strokeStyle = subColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(3, 3, w - 6, h - 6);

    // Header: Mode & App
    ctx.fillStyle = '#8b949e';
    ctx.font = '600 12px system-ui, -apple-system, sans-serif';
    ctx.fillText((state.mode === 'countdown' ? 'COUNTDOWN' : 'STOPWATCH') + ' • CHRONOSTUDY', 18, 28);

    // Subject badge
    ctx.fillStyle = subColor;
    ctx.font = '700 14px system-ui, -apple-system, sans-serif';
    const subText = (state.subject || 'Focus Session').slice(0, 26);
    ctx.fillText(subText, 18, 52);

    // Large Digits
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 46px monospace, ui-monospace';
    ctx.fillText(state.formattedTime || '00:00', 18, 110);

    // Status Indicator
    const statusText = state.isRunning ? '● FOCUSING' : (state.elapsedSec > 0 ? '❚❚ PAUSED' : '○ READY');
    ctx.fillStyle = state.isRunning ? '#238636' : (state.elapsedSec > 0 ? '#d29922' : '#6e7681');
    ctx.font = '700 12px system-ui, -apple-system, sans-serif';
    ctx.fillText(statusText, 18, 140);

    // Progress bar for countdown
    if (state.mode === 'countdown') {
      const p = Math.max(0, Math.min(1, state.progress || 0));
      ctx.fillStyle = '#212631';
      ctx.fillRect(18, 156, w - 36, 12);
      ctx.fillStyle = subColor;
      ctx.fillRect(18, 156, (w - 36) * p, 12);
    }
  }

  // --- Custom Countdown Minutes Setting ---
  setCustomCountdownMinutes() {
    if (!this.countdownCustomMins) return;
    const val = parseInt(this.countdownCustomMins.value, 10);
    if (!isNaN(val) && val > 0 && val <= 480) {
      timer.setTargetMinutes(val);
      document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('active'));
      playClickSound();
    }
  }

  // --- CSV Export Helper ---
  downloadCSV() {
    const csvContent = store.generateCSV();
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ChronoStudy_Sessions_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  openThemeModal() {
    if (!this.themeModal) return;
    this.renderThemeModal();
    this.themeModal.classList.add('active');
  }

  closeThemeModal() {
    if (this.themeModal) {
      this.themeModal.classList.remove('active');
    }
  }

  renderThemeModal() {
    if (!this.themePickerGrid) return;
    const currentTheme = store.getState().settings.theme || 'slate';
    const effectiveTheme = currentTheme === 'dark' ? 'slate' : currentTheme;

    const THEMES = [
      {
        id: 'slate',
        name: 'Studio Slate',
        desc: 'Neutral dark graphite with crisp blue accent. Distraction-free engineering craft.',
        colors: ['#0d1117', '#161b22', '#f0f3f6', '#3b82f6']
      },
      {
        id: 'oled',
        name: 'Obsidian Black',
        desc: 'True pitch black (#000) for OLED panels. Ultra-sharp contrast and zero glare.',
        colors: ['#000000', '#0a0a0a', '#ffffff', '#e5e5e5']
      },
      {
        id: 'light',
        name: 'Nordic Snow',
        desc: 'Clean paper white and soft zinc tones. Daytime clarity like Things 3 & Notion.',
        colors: ['#f6f8fa', '#ffffff', '#1f2328', '#0969da']
      },
      {
        id: 'sepia',
        name: 'Warm Paper',
        desc: 'Warm cream and parchment with terracotta ink. Relaxed reading, easy on the eyes.',
        colors: ['#fbf7ee', '#f2ece0', '#2b251e', '#b85d19']
      },
      {
        id: 'forest',
        name: 'Evergreen Pine',
        desc: 'Deep midnight botanical green and emerald highlights. Calming natural tone.',
        colors: ['#08100c', '#0f1c15', '#e8f5ed', '#10b981']
      },
      {
        id: 'tokyo',
        name: 'Tokyo Night',
        desc: 'Deep indigo navy with soft velvet lavender. Elegant developer aesthetic.',
        colors: ['#12131d', '#181926', '#cad3f5', '#c6a0f6']
      },
      {
        id: 'bibliotheca',
        name: 'Bibliotheca (Dark Academia)',
        desc: 'Warm walnut wood, aged bookbindings, brass trim, and amber candlelight.',
        colors: ['#13100d', '#1c1814', '#f5ede2', '#c59b27']
      },
      {
        id: 'oxblood',
        name: 'Oxblood & Brass',
        desc: 'Victorian deep mahogany leather, gold chronometer bevels, and vintage ink.',
        colors: ['#12090b', '#1d0f13', '#f4e9df', '#d4af37']
      },
      {
        id: 'parchment',
        name: 'Parchment Scriptorium',
        desc: 'Aged classical paper parchment with sepia chestnut ink and monastic calm.',
        colors: ['#f4ede0', '#e9e0d0', '#241d16', '#8b4513']
      },
      {
        id: 'oxford',
        name: 'Oxford & Racing Green',
        desc: 'British academic racing green, saddle leather, and gold trim.',
        colors: ['#08110c', '#101e17', '#ede8dc', '#c59b27']
      }
    ];

    this.themePickerGrid.innerHTML = THEMES.map((t) => {
      const isActive = t.id === effectiveTheme;
      return `
        <div class="theme-card ${isActive ? 'active' : ''}" data-theme-id="${t.id}">
          <div class="theme-preview-strip">
            <div class="theme-preview-color" style="background-color: ${t.colors[0]};" title="Background"></div>
            <div class="theme-preview-color" style="background-color: ${t.colors[1]};" title="Card"></div>
            <div class="theme-preview-color" style="background-color: ${t.colors[2]};" title="Text"></div>
            <div class="theme-preview-color" style="background-color: ${t.colors[3]};" title="Accent"></div>
          </div>
          <div class="theme-info">
            <div>
              <div class="theme-name">${t.name}</div>
              <div class="theme-desc">${t.desc}</div>
            </div>
            <span class="theme-active-indicator">✓</span>
          </div>
        </div>
      `;
    }).join('');

    this.themePickerGrid.querySelectorAll('.theme-card').forEach((card) => {
      card.addEventListener('click', () => {
        const themeId = card.dataset.themeId;
        this.applyTheme(themeId);
        store.updateSettings({ theme: themeId });
        this.renderThemeModal();
        playClickSound();
      });
    });

    // Render Typography / Authentic Font Formats
    if (this.fontPickerGrid) {
      const currentFont = store.getState().settings.fontStyle || 'sans';
      const FONTS = [
        {
          id: 'sans',
          name: 'Modern Sans',
          sample: 'Analysis & Folland Handout',
          desc: 'Clean geometric sans-serif for modern PC interfaces and dashboards.'
        },
        {
          id: 'serif',
          name: 'Editorial Serif',
          sample: 'Analysis & Folland Handout',
          desc: 'Authentic classical academic & bookish manuscript format for deep study & reading.'
        },
        {
          id: 'mono',
          name: 'Technical Monospace',
          sample: 'Analysis & Folland Handout',
          desc: 'Precision terminal typewriter alignment with engineer focus.'
        },
        {
          id: 'humanist',
          name: 'Humanist Warm',
          sample: 'Analysis & Folland Handout',
          desc: 'Gentle, organic curve geometry for long study sessions without fatigue.'
        },
        {
          id: 'cinzel',
          name: 'Cinzel (Roman Antiqua)',
          sample: 'CHRONOMÈTRE • MCMXXVI',
          desc: 'Classical Greco-Roman inscriptional capital serif, perfect for pocket watch dials and horology precision.'
        },
        {
          id: 'cormorant',
          name: 'Cormorant Garamond',
          sample: 'Folland Handout & Advanced Calculus',
          desc: '16th-century classical Renaissance Garamond serif with intellectual elegance and scholarly gravitas.'
        }
      ];

      this.fontPickerGrid.innerHTML = FONTS.map((f) => {
        const isActive = f.id === currentFont;
        let previewStyle = '';
        if (f.id === 'serif') previewStyle = 'font-family: Merriweather, Georgia, serif;';
        else if (f.id === 'mono') previewStyle = 'font-family: "JetBrains Mono", Consolas, monospace;';
        else if (f.id === 'humanist') previewStyle = 'font-family: "Segoe UI", Ubuntu, sans-serif;';
        else if (f.id === 'cinzel') previewStyle = 'font-family: "Cinzel", "Times New Roman", Georgia, serif; font-size: 0.95rem; letter-spacing: 0.08em;';
        else if (f.id === 'cormorant') previewStyle = 'font-family: "Cormorant Garamond", Charter, Garamond, serif; font-size: 1.15rem; font-style: italic;';
        else previewStyle = 'font-family: -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", sans-serif;';

        return `
          <div class="font-card ${isActive ? 'active' : ''}" data-font-id="${f.id}">
            <div class="font-preview-sample" style="${previewStyle}">
              ${f.sample}
            </div>
            <div class="font-name">${f.name}</div>
            <div class="font-desc">${f.desc}</div>
            <span class="font-active-check">✓</span>
          </div>
        `;
      }).join('');

      this.fontPickerGrid.querySelectorAll('.font-card').forEach((card) => {
        card.addEventListener('click', () => {
          const fontId = card.dataset.fontId;
          this.applyFont(fontId);
          store.updateSettings({ fontStyle: fontId });
          this.renderThemeModal();
          playClickSound();
        });
      });
    }

    // Render Watch Cadran & Horology Timepiece Picker
    if (this.cadranPickerGrid) {
      const rawCadran = store.getState().settings.timerStyle || 'chronograph';
      const currentCadran = rawCadran === 'chronometer' ? 'chronograph' : rawCadran;
      const CADRANS = [
        {
          id: 'chronograph',
          name: 'Analog Mechanical Chronograph',
          desc: 'Bi-compax chronograph with 30-min counter and 60-sec running small-seconds subdials, tachymeter graduations, Roman numerals, and Breguet sweep needle with synthetic ruby pinion.'
        },
        {
          id: 'cadran',
          name: 'Classical Watch Cadran',
          desc: 'Antique pocket watch dial with Roman numerals XII–XI, railway 60-minute chapter track, and central balance hand.'
        },
        {
          id: 'minimal',
          name: 'Minimalist Orbit',
          desc: 'Modern distraction-free circular progress ring without dial markings or needle hands.'
        }
      ];

      this.cadranPickerGrid.innerHTML = CADRANS.map((c) => {
        const isActive = c.id === currentCadran;
        return `
          <div class="cadran-card ${isActive ? 'active' : ''}" data-cadran-id="${c.id}">
            <div class="cadran-card-title">
              <span>${c.name}</span>
            </div>
            <div class="cadran-card-desc">${c.desc}</div>
          </div>
        `;
      }).join('');

      this.cadranPickerGrid.querySelectorAll('.cadran-card').forEach((card) => {
        card.addEventListener('click', () => {
          const cadranId = card.dataset.cadranId;
          this.applyTimerStyle(cadranId);
          store.updateSettings({ timerStyle: cadranId });
          this.renderThemeModal();
          playClickSound();
        });
      });
    }
  }

  // --- Expand Tasks Panel ---
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

  // --- Global Task Sidebar Drawer ---
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

  getRecurrenceLabel(recurrence, interval = 1) {
    if (!recurrence || recurrence === 'none') return '';
    switch (recurrence) {
      case 'daily':
        return interval && interval > 1 ? `Every ${interval} days` : 'Daily';
      case 'weekdays':
        return 'Weekdays (Mon-Fri)';
      case 'weekly':
        return interval && interval > 1 ? `Every ${interval} wks` : 'Weekly';
      case 'biweekly':
        return 'Bi-weekly';
      case 'triweekly':
        return 'Tri-weekly';
      case 'monthly':
        return interval && interval > 1 ? `Every ${interval} mos` : 'Monthly';
      case 'custom_days':
        return `Every ${interval || 1} days`;
      case 'custom_weeks':
        return `Every ${interval || 1} wks`;
      default:
        return recurrence;
    }
  }

  renderSidebarTasks() {
    if (!this.sidebarTaskList) return;
    const tasks = store.getState().tasks;
    let filtered = [...tasks];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = toLocalDateStr(today);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = toLocalDateStr(tomorrow);

    const endOfWeek = new Date(today);
    const dayOfWeek = today.getDay() || 7;
    endOfWeek.setDate(today.getDate() + (7 - dayOfWeek));
    const endOfWeekStr = toLocalDateStr(endOfWeek);

    const sFilter = this.currentSidebarFilter || 'pending';

    // 1. Filter by Smart Tab
    if (sFilter === 'pending') {
      filtered = filtered.filter((t) => !t.completed);
    } else if (sFilter === 'today') {
      filtered = filtered.filter((t) => !t.completed && t.dueDate === todayStr);
    } else if (sFilter === 'planned') {
      filtered = filtered.filter((t) => !t.completed && t.dueDate && t.dueDate >= todayStr);
    } else if (sFilter === 'completed') {
      filtered = filtered.filter((t) => t.completed);
    }
    // 'all' tab shows all tasks

    // 2. Filter by Course / Subject in sidebar
    if (this.sidebarTaskSubjectFilter && this.sidebarTaskSubjectFilter.value !== 'all') {
      const sVal = this.sidebarTaskSubjectFilter.value;
      if (sVal === '') {
        filtered = filtered.filter((t) => !t.subject);
      } else {
        filtered = filtered.filter((t) => t.subject === sVal);
      }
    }

    // 3. Sort tasks in sidebar
    const sortBy = this.sidebarTaskSort ? this.sidebarTaskSort.value : (this.sidebarTaskSortBy || 'dueDate');
    filtered.sort((a, b) => {
      if (sortBy === 'dueDate') {
        if (!a.dueDate && !b.dueDate) return a.title.localeCompare(b.title);
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      } else if (sortBy === 'subject') {
        const subA = a.subject || 'ZZZ';
        const subB = b.subject || 'ZZZ';
        return subA.localeCompare(subB) || a.title.localeCompare(b.title);
      } else if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      } else if (sortBy === 'duration') {
        return (b.targetMinutes || 0) - (a.targetMinutes || 0);
      } else if (sortBy === 'created') {
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      }
      return 0;
    });

    if (filtered.length === 0) {
      this.sidebarTaskList.innerHTML = `
        <div class="empty-state" style="padding: 1.5rem 0.5rem; text-align: center;">
          <p style="font-size: 0.85rem; color: var(--text-muted);">No study tasks found.</p>
        </div>
      `;
      return;
    }

    // 4. Group tasks
    const groupBy = this.sidebarTaskGroup ? this.sidebarTaskGroup.value : (this.sidebarTaskGroupBy || 'dueDate');
    this.sidebarTaskList.innerHTML = '';

    const createSidebarCard = (task) => {
      const color = store.getSubjectColor(task.subject);
      const card = document.createElement('div');
      card.className = `task-card ${task.completed ? 'task-completed' : ''}`;
      card.style.padding = '0.6rem 0.75rem';
      card.innerHTML = `
        <div class="task-card-left">
          <label class="custom-checkbox">
            <input type="checkbox" ${task.completed ? 'checked' : ''} data-task-id="${task.id}" class="sidebar-task-cb" />
            <span class="checkmark"></span>
          </label>
          <div class="task-info">
            <div class="task-title clickable-title" style="font-size: 0.84rem;" title="Click to edit task">${this.escapeHTML(task.title)}</div>
            <div class="task-badges" style="margin-top: 0.2rem;">
              <span class="subject-badge ${!task.subject ? 'badge-no-course' : ''}" style="--badge-color: ${color}; font-size: 0.65rem;">${task.subject ? this.escapeHTML(task.subject) : 'General'}</span>
              ${task.dueDate ? `<span class="meta-badge date-badge" style="font-size: 0.65rem;">${task.dueDate}</span>` : ''}
              ${task.recurrence && task.recurrence !== 'none' ? `<span class="meta-badge task-recurrence-badge" style="font-size: 0.65rem;">↻ ${this.getRecurrenceLabel(task.recurrence, task.recurrenceInterval)}</span>` : ''}
              ${task.targetMinutes ? `<span class="meta-badge" style="font-size: 0.65rem;">${task.targetMinutes}m</span>` : ''}
            </div>
          </div>
        </div>
        <div class="task-actions">
          ${!task.completed ? `
            <button class="btn btn-study-now btn-sidebar-study" data-task-id="${task.id}" title="Study now" style="padding: 0.25rem 0.5rem; font-size: 0.7rem;">
              ▶
            </button>
          ` : ''}
          <button class="btn btn-icon btn-sidebar-edit-task" data-task-id="${task.id}" title="Edit task" style="font-size: 0.75rem;">✎</button>
          <button class="btn btn-icon btn-del-sidebar-task" data-task-id="${task.id}" title="Delete task" style="font-size: 0.75rem;">✕</button>
        </div>
      `;
      return card;
    };

    if (groupBy === 'none') {
      const flatDiv = document.createElement('div');
      flatDiv.style.display = 'flex';
      flatDiv.style.flexDirection = 'column';
      flatDiv.style.gap = '0.45rem';
      filtered.forEach((task) => {
        flatDiv.appendChild(createSidebarCard(task));
      });
      this.sidebarTaskList.appendChild(flatDiv);
    } else {
      const groupsMap = new Map();
      filtered.forEach((task) => {
        let groupKey = 'Other';
        if (groupBy === 'dueDate') {
          if (task.completed) {
            groupKey = 'Completed Tasks';
          } else if (!task.dueDate) {
            groupKey = 'No Due Date';
          } else if (task.dueDate < todayStr) {
            groupKey = 'Overdue';
          } else if (task.dueDate === todayStr) {
            groupKey = 'Today';
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

        if (!groupsMap.has(groupKey)) {
          groupsMap.set(groupKey, []);
        }
        groupsMap.get(groupKey).push(task);
      });

      let orderedKeys = Array.from(groupsMap.keys());
      if (groupBy === 'dueDate') {
        const dueOrder = ['Overdue', 'Today', 'Tomorrow', 'This Week', 'Later', 'No Due Date', 'Completed Tasks'];
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

      orderedKeys.forEach((groupTitle) => {
        const groupTasks = groupsMap.get(groupTitle) || [];
        if (groupTasks.length === 0) return;

        const isCollapsed = this.collapsedSidebarGroups.has(groupTitle);
        const groupDiv = document.createElement('div');
        groupDiv.className = `task-group ${isCollapsed ? 'collapsed' : ''}`;
        groupDiv.style.marginBottom = '0.5rem';

        const headerDiv = document.createElement('div');
        headerDiv.className = 'task-group-header';
        headerDiv.style.cursor = 'pointer';
        headerDiv.style.userSelect = 'none';
        headerDiv.style.padding = '0.35rem 0.6rem';
        headerDiv.innerHTML = `
          <div class="task-group-title" style="font-size: 0.78rem; font-weight: 700;">
            <span class="group-chevron" style="display: inline-block; font-size: 0.65rem; transition: transform 0.2s ease; margin-right: 0.35rem; ${isCollapsed ? 'transform: rotate(-90deg);' : ''}">▼</span>
            <span>${this.escapeHTML(groupTitle)}</span>
            <span class="task-group-count badge-counter" style="font-size: 0.65rem; padding: 0.1rem 0.4rem; margin-left: 0.35rem;">${groupTasks.length}</span>
          </div>
        `;

        headerDiv.addEventListener('click', () => {
          if (this.collapsedSidebarGroups.has(groupTitle)) {
            this.collapsedSidebarGroups.delete(groupTitle);
          } else {
            this.collapsedSidebarGroups.add(groupTitle);
          }
          this.renderSidebarTasks();
          playClickSound();
        });

        const itemsDiv = document.createElement('div');
        itemsDiv.className = 'task-group-items';
        itemsDiv.style.display = isCollapsed ? 'none' : 'flex';
        itemsDiv.style.flexDirection = 'column';
        itemsDiv.style.gap = '0.45rem';
        itemsDiv.style.marginTop = '0.35rem';

        groupTasks.forEach((task) => {
          itemsDiv.appendChild(createSidebarCard(task));
        });

        groupDiv.appendChild(headerDiv);
        groupDiv.appendChild(itemsDiv);
        this.sidebarTaskList.appendChild(groupDiv);
      });
    }

    this.sidebarTaskList.querySelectorAll('.sidebar-task-cb').forEach((cb) => {
      cb.addEventListener('change', () => {
        store.toggleTask(cb.dataset.taskId);
        playClickSound();
      });
    });

    this.sidebarTaskList.querySelectorAll('.btn-sidebar-study').forEach((btn) => {
      btn.addEventListener('click', () => {
        const task = store.getState().tasks.find((t) => t.id === btn.dataset.taskId);
        if (task) {
          this.closeTaskSidebar();
          this.switchView('focus');
          this.startTaskStudySession(task);
          playClickSound();
        }
      });
    });

    this.sidebarTaskList.querySelectorAll('.btn-sidebar-edit-task').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openTaskEditModal(btn.dataset.taskId);
        playClickSound();
      });
    });

    this.sidebarTaskList.querySelectorAll('.task-title.clickable-title').forEach((titleEl) => {
      titleEl.addEventListener('click', (e) => {
        const card = e.target.closest('.task-card');
        const cb = card ? card.querySelector('.sidebar-task-cb') : null;
        if (cb && cb.dataset.taskId) {
          this.openTaskEditModal(cb.dataset.taskId);
        }
      });
    });

    this.sidebarTaskList.querySelectorAll('.btn-del-sidebar-task').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const task = store.getState().tasks.find((t) => t.id === btn.dataset.taskId);
        if (task) {
          const ok = await this.showInAppConfirm({
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
      });
    });
  }

  updateTimerModeButtons(mode) {
    this.timerModeStopwatch.classList.toggle('active', mode === 'stopwatch');
    this.timerModeCountdown.classList.toggle('active', mode === 'countdown');
    this.countdownPresets.style.display = mode === 'countdown' ? 'flex' : 'none';
  }

  updatePresetButtons(activeMins) {
    this.countdownPresets.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.classList.toggle('active', parseInt(btn.dataset.mins, 10) === activeMins);
    });
  }

  render() {
    this.renderSubjects();
    this.renderStats();
    this.renderTasks();
    this.renderHistory();
    this.renderSubjectsPage();
    this.renderCalendar();

    const timerState = timer.getState();
    this.updateTimerModeButtons(timerState.mode);
    this.sessionNotesArea.value = timerState.draftNotes || '';
    this.topicInput.value = timerState.topic || '';
    if (timerState.subject) {
      this.subjectSelect.value = timerState.subject;
    }
    this.renderLinkedTaskBanner(timerState.linkedTaskId);
    this.renderZenMode(timerState.isZenMode, timerState);
  }

  renderSubjects() {
    const subjects = store.getState().subjects;

    const populateSelect = (selectEl, options = {}) => {
      if (!selectEl) return;
      const { includeAll = false, includeNoSubject = false, defaultLabel = 'No Course / General' } = 
        typeof options === 'boolean' ? { includeAll: options } : options;
      const currentVal = selectEl.value;
      selectEl.innerHTML = '';

      if (includeAll) {
        const allOpt = document.createElement('option');
        allOpt.value = 'all';
        allOpt.textContent = 'All Subjects / Courses';
        selectEl.appendChild(allOpt);
      }

      if (includeNoSubject) {
        const noSubOpt = document.createElement('option');
        noSubOpt.value = '';
        noSubOpt.textContent = defaultLabel;
        selectEl.appendChild(noSubOpt);
      }

      subjects.forEach((s) => {
        const opt = document.createElement('option');
        opt.value = s.name;
        opt.textContent = `${s.code ? s.code + ': ' : ''}${s.name}`;
        selectEl.appendChild(opt);
      });

      if (currentVal !== undefined && Array.from(selectEl.options).some((o) => o.value === currentVal)) {
        selectEl.value = currentVal;
      }
    };

    populateSelect(this.subjectSelect, { includeNoSubject: true, defaultLabel: 'General / No Course' });
    populateSelect(this.taskSubjectSelect, { includeNoSubject: true, defaultLabel: 'General / No Course' });
    populateSelect(this.sidebarTaskSubject, { includeNoSubject: true, defaultLabel: 'General / No Course' });
    populateSelect(this.sidebarTaskSubjectFilter, { includeAll: true, includeNoSubject: true, defaultLabel: 'No Course Only' });
    populateSelect(this.taskSubjectFilter, { includeAll: true, includeNoSubject: true, defaultLabel: 'No Course Only' });
    populateSelect(this.historySubjectFilterEl, { includeAll: true, includeNoSubject: true, defaultLabel: 'General / No Course' });
    populateSelect(this.calSubjectFilter, { includeAll: true, includeNoSubject: true, defaultLabel: 'No Course Only' });

    const manualSelect = document.getElementById('manual-subject-select');
    populateSelect(manualSelect, { includeNoSubject: true, defaultLabel: 'General / No Course' });
  }

  renderStats() {
    const stats = store.getTodayStats();
    const hrs = Math.floor(stats.totalSecondsToday / 3600);
    const mins = Math.floor((stats.totalSecondsToday % 3600) / 60);

    let timeFormatted = '';
    if (hrs > 0) {
      timeFormatted = `${hrs}h ${mins}m`;
    } else {
      timeFormatted = `${mins}m`;
    }

    this.statTodayTime.textContent = timeFormatted;
    this.statTodaySessions.textContent = `${stats.todaySessionsCount} sessions`;
    this.statPendingTasks.textContent = `${stats.pendingTasksCount} to do`;
  }

  renderTimer(state) {
    if (this.timerDisplay && this._lastTimerDisplay !== state.formattedTime) {
      this.timerDisplay.textContent = state.formattedTime;
      this._lastTimerDisplay = state.formattedTime;
    }

    let badgeText = 'READY';
    let badgeClass = 'badge-ready';
    if (state.isRunning) {
      badgeText = 'FOCUSING';
      badgeClass = 'badge-studying';
    } else if (state.elapsedSec > 0) {
      badgeText = state.hasFinishedCountdown ? 'COMPLETED' : 'PAUSED';
      badgeClass = state.hasFinishedCountdown ? 'badge-completed' : 'badge-paused';
    }
    if (this.timerStateBadge && this._lastBadgeText !== badgeText) {
      this.timerStateBadge.textContent = badgeText;
      this.timerStateBadge.className = `timer-state-badge ${badgeClass}`;
      this._lastBadgeText = badgeText;
    }

    // Digital Instrument Panel Telemetry
    if (this.timerActiveModeLabel) {
      const modeText = state.mode === 'countdown' ? 'COUNTDOWN' : 'STOPWATCH';
      if (this._lastActiveModeText !== modeText) {
        this.timerActiveModeLabel.textContent = modeText;
        this._lastActiveModeText = modeText;
      }
    }

    if (this.timerTargetDisplay) {
      let targetText = 'Open Study Session';
      if (state.topic) {
        targetText = state.topic;
      } else if (state.mode === 'countdown') {
        const targetMins = Math.round(state.targetDurationSec / 60);
        targetText = `${targetMins}m Focus Block`;
      }
      if (this._lastTargetText !== targetText) {
        this.timerTargetDisplay.textContent = targetText;
        this._lastTargetText = targetText;
      }
    }

    if (this.timerProgressPct) {
      let pctText = '';
      if (state.mode === 'countdown') {
        const pct = Math.min(100, Math.round(state.progress * 100));
        pctText = `${pct}%`;
      } else {
        const elapsedMins = Math.floor(state.elapsedSec / 60);
        pctText = `${elapsedMins}m elapsed`;
      }
      if (this._lastProgressPctText !== pctText) {
        this.timerProgressPct.textContent = pctText;
        this._lastProgressPctText = pctText;
      }
    }

    if (this.timerDigitalProgressBar) {
      const color = store.getSubjectColor(state.subject);
      if (this._lastProgressBarColor !== color) {
        this.timerDigitalProgressBar.style.backgroundColor = color;
        this._lastProgressBarColor = color;
      }
      let pctStr = '0%';
      if (state.mode === 'countdown') {
        const pct = Math.min(100, Math.round(state.progress * 100));
        pctStr = `${pct}%`;
      } else {
        const secInMin = state.elapsedSec % 60;
        const pct = Math.min(100, Math.round((secInMin / 60) * 100));
        pctStr = `${pct}%`;
      }
      if (this._lastProgressBarWidth !== pctStr) {
        this.timerDigitalProgressBar.style.width = pctStr;
        this._lastProgressBarWidth = pctStr;
      }
    }

    const isRunning = state.isRunning;
    const isZero = state.elapsedSec === 0;
    if (this._lastBtnRunning !== isRunning || this._lastBtnZero !== isZero) {
      this._lastBtnRunning = isRunning;
      this._lastBtnZero = isZero;
      if (isRunning) {
        this.btnTimerToggle.innerHTML = '<span class="icon">⏸</span> Pause';
        this.btnTimerToggle.className = 'btn btn-primary btn-pause';
      } else {
        this.btnTimerToggle.innerHTML = '<span class="icon">▶</span> ' + (isZero ? 'Start Studying' : 'Resume');
        this.btnTimerToggle.className = 'btn btn-primary btn-start';
      }
    }

    const canFinish = state.elapsedSec >= 5;
    if (this.btnTimerFinish.disabled !== !canFinish) {
      this.btnTimerFinish.disabled = !canFinish;
    }
    const canReset = !(state.elapsedSec === 0 && !state.isRunning);
    if (this.btnTimerReset.disabled !== !canReset) {
      this.btnTimerReset.disabled = !canReset;
    }

    // Horology Chronograph Outer Ring
    if (this.timerProgressRing) {
      const radius = 126;
      const circumference = 2 * Math.PI * radius;
      if (!this._timerRingDashSet) {
        this.timerProgressRing.style.strokeDasharray = `${circumference} ${circumference}`;
        this._timerRingDashSet = true;
      }
      const strokeOffset = state.mode === 'countdown'
        ? circumference * (1 - state.progress)
        : circumference;
      if (this._lastTimerRingOffset !== strokeOffset) {
        this.timerProgressRing.style.strokeDashoffset = strokeOffset;
        this._lastTimerRingOffset = strokeOffset;
      }
      const subColor = store.getSubjectColor(state.subject);
      if (this._lastTimerRingStroke !== subColor) {
        this.timerProgressRing.style.stroke = subColor;
        this._lastTimerRingStroke = subColor;
      }
    }

    // Central Sweep Hand (Breguet Long Hand: smooth cumulative clockwise rotation)
    if (this.timerCadranHandGroup) {
      const angle = state.mode === 'countdown'
        ? (state.progress * 360)
        : (state.elapsedSec * 6);
      if (this._lastCadranAngle !== angle) {
        this.timerCadranHandGroup.style.transform = `rotate(${angle}deg)`;
        this._lastCadranAngle = angle;
      }
    }

    // Bi-Compax Subdial 1: 30-Minute Chronograph Counter (Upper at 12 o'clock)
    if (this.timerSubdialMinHand) {
      const minAngle = state.mode === 'countdown'
        ? (state.progress * 360)
        : ((state.elapsedSec / 1800) * 360);
      if (this._lastSubdialMinAngle !== minAngle) {
        this.timerSubdialMinHand.style.transform = `rotate(${minAngle}deg)`;
        this._lastSubdialMinAngle = minAngle;
      }
    }

    // Bi-Compax Subdial 2: 60-Second Small-Seconds (Lower at 6 o'clock)
    if (this.timerSubdialSecHand) {
      const secAngle = state.elapsedSec * 6;
      if (this._lastSubdialSecAngle !== secAngle) {
        this.timerSubdialSecHand.style.transform = `rotate(${secAngle}deg)`;
        this._lastSubdialSecAngle = secAngle;
      }
    }

    if (document.pictureInPictureElement) {
      this.updatePiPCanvas(state);
    }
    if (state.isZenMode || this._lastZenActive) {
      this.renderZenMode(state.isZenMode, state);
    }
  }

  renderZenMode(isZen, state) {
    if (this._lastZenActive !== isZen) {
      this._lastZenActive = isZen;
      document.body.classList.toggle('zen-mode-active', isZen);
      const zenOverlay = document.getElementById('zen-overlay-container');
      if (zenOverlay) {
        zenOverlay.style.display = isZen ? 'flex' : 'none';
      }
    }

    if (!isZen) return;

    const zenOverlay = document.getElementById('zen-overlay-container');
    const zenNotes = document.getElementById('zen-notes-area');

    if (zenOverlay) {
      // Digits
      if (this.zenTimerDigits && this._lastZenDigits !== state.formattedTime) {
        this.zenTimerDigits.textContent = state.formattedTime;
        this._lastZenDigits = state.formattedTime;
      }

      // Subject Badge & Styling
      const color = store.getSubjectColor(state.subject);
      if (this.zenSubjectBadge) {
        this.zenSubjectBadge.textContent = state.subject || 'General Study';
        this.zenSubjectBadge.style.backgroundColor = `${color}25`;
        this.zenSubjectBadge.style.color = color;
        this.zenSubjectBadge.style.borderColor = color;
      }

      // Topic Title
      if (this.zenTopicDisplay) {
        this.zenTopicDisplay.textContent = state.topic || 'Deep Focus Session';
      }

      // Linked Task Badge
      if (this.zenLinkedTaskBadge) {
        if (state.linkedTaskId) {
          const task = store.getState().tasks.find((t) => t.id === state.linkedTaskId);
          if (task) {
            this.zenLinkedTaskBadge.style.display = 'inline-block';
            this.zenLinkedTaskBadge.textContent = task.title;
          } else {
            this.zenLinkedTaskBadge.style.display = 'none';
          }
        } else {
          this.zenLinkedTaskBadge.style.display = 'none';
        }
      }

      // State Badge
      let badgeText = 'READY';
      let badgeClass = 'badge-ready';
      if (state.isRunning) {
        badgeText = 'FOCUSING';
        badgeClass = 'badge-studying';
      } else if (state.elapsedSec > 0) {
        badgeText = state.hasFinishedCountdown ? 'COMPLETED' : 'PAUSED';
        badgeClass = state.hasFinishedCountdown ? 'badge-completed' : 'badge-paused';
      }
      if (this.zenStateBadge) {
        this.zenStateBadge.textContent = badgeText;
        this.zenStateBadge.className = `timer-state-badge ${badgeClass}`;
      }

      // Active Mode Tag
      if (this.zenActiveModeLabel) {
        this.zenActiveModeLabel.textContent = state.mode === 'countdown' ? 'COUNTDOWN' : 'STOPWATCH';
      }

      // Target Display
      if (this.zenTargetDisplay) {
        if (state.topic) {
          this.zenTargetDisplay.textContent = state.topic;
        } else if (state.mode === 'countdown') {
          const targetMins = Math.round(state.targetDurationSec / 60);
          this.zenTargetDisplay.textContent = `${targetMins}m Focus Block`;
        } else {
          this.zenTargetDisplay.textContent = 'Open Study Session';
        }
      }

      // Progress Telemetry
      if (this.zenProgressPct) {
        if (state.mode === 'countdown') {
          const pct = Math.min(100, Math.round(state.progress * 100));
          this.zenProgressPct.textContent = `${pct}%`;
        } else {
          const elapsedMins = Math.floor(state.elapsedSec / 60);
          this.zenProgressPct.textContent = `${elapsedMins}m elapsed`;
        }
      }

      if (this.zenDigitalProgressBar) {
        this.zenDigitalProgressBar.style.backgroundColor = color;
        if (state.mode === 'countdown') {
          const pct = Math.min(100, Math.round(state.progress * 100));
          this.zenDigitalProgressBar.style.width = `${pct}%`;
        } else {
          const secInMin = state.elapsedSec % 60;
          if (secInMin === 0 && state.elapsedSec > 0) {
            this.zenDigitalProgressBar.style.transition = 'none';
            this.zenDigitalProgressBar.style.width = '0%';
            requestAnimationFrame(() => {
              if (this.zenDigitalProgressBar) this.zenDigitalProgressBar.style.transition = '';
            });
          } else {
            const pct = Math.min(100, Math.round((secInMin / 60) * 100));
            this.zenDigitalProgressBar.style.width = `${pct}%`;
          }
        }
      }

      // Zen Horology Progress Ring
      if (this.zenProgressRing) {
        const radius = 126;
        const circumference = 2 * Math.PI * radius;
        if (!this._zenRingDashSet) {
          this.zenProgressRing.style.strokeDasharray = `${circumference} ${circumference}`;
          this._zenRingDashSet = true;
        }
        const strokeOffset = state.mode === 'countdown'
          ? circumference * (1 - state.progress)
          : circumference;
        this.zenProgressRing.style.strokeDashoffset = strokeOffset;
        if (this._lastZenRingStroke !== color) {
          this.zenProgressRing.style.stroke = color;
          this._lastZenRingStroke = color;
        }
      }

      // Zen Horology Central Sweep Needle (smooth cumulative rotation)
      if (this.zenCadranHandGroup) {
        const angle = state.mode === 'countdown'
          ? (state.progress * 360)
          : (state.elapsedSec * 6);
        this.zenCadranHandGroup.style.transform = `rotate(${angle}deg)`;
      }

      // Zen Bi-Compax Subdial 1: 30-Minute Counter
      if (this.zenSubdialMinHand) {
        const minAngle = state.mode === 'countdown'
          ? (state.progress * 360)
          : ((state.elapsedSec / 1800) * 360);
        this.zenSubdialMinHand.style.transform = `rotate(${minAngle}deg)`;
      }

      // Zen Bi-Compax Subdial 2: 60-Second Small-Seconds
      if (this.zenSubdialSecHand) {
        const secAngle = state.elapsedSec * 6;
        this.zenSubdialSecHand.style.transform = `rotate(${secAngle}deg)`;
      }

      // In-Theater Controls
      if (this.btnZenTimerToggle) {
        const isRunning = state.isRunning;
        const isZero = state.elapsedSec === 0;
        if (this._lastZenBtnRunning !== isRunning || this._lastZenBtnZero !== isZero) {
          this._lastZenBtnRunning = isRunning;
          this._lastZenBtnZero = isZero;
          if (isRunning) {
            this.btnZenTimerToggle.innerHTML = '<span class="icon">⏸</span> Pause';
            this.btnZenTimerToggle.className = 'btn btn-primary btn-pause';
          } else {
            this.btnZenTimerToggle.innerHTML = '<span class="icon">▶</span> ' + (isZero ? 'Start Studying' : 'Resume');
            this.btnZenTimerToggle.className = 'btn btn-primary btn-start';
          }
        }
      }

      if (this.btnZenFinishSession) {
        this.btnZenFinishSession.disabled = state.elapsedSec < 5;
      }
      if (this.btnZenResetTimer) {
        this.btnZenResetTimer.disabled = state.elapsedSec === 0 && !state.isRunning;
      }

      // Soundscape Sync
      if (this.zenSoundscapeSelect) {
        const currentSound = store.getState().settings.ambientSound || 'none';
        if (this.zenSoundscapeSelect.value !== currentSound) {
          this.zenSoundscapeSelect.value = currentSound;
        }
      }

      // Notes sync
      if (zenNotes && document.activeElement !== zenNotes) {
        zenNotes.value = state.draftNotes || this.sessionNotesArea.value || '';
      }

      if (zenNotes && !zenNotes.dataset.bound) {
        zenNotes.dataset.bound = 'true';
        zenNotes.addEventListener('input', () => {
          this.sessionNotesArea.value = zenNotes.value;
          timer.setDraftNotes(zenNotes.value);
        });
      }
    }
  }

  renderLinkedTaskBanner(taskId) {
    if (!taskId) {
      this.linkedTaskBanner.style.display = 'none';
      return;
    }
    const task = store.getState().tasks.find((t) => t.id === taskId);
    if (!task) {
      this.linkedTaskBanner.style.display = 'none';
      return;
    }
    this.linkedTaskTitle.textContent = task.title;
    this.linkedTaskBanner.style.display = 'flex';
  }

  setSidebarDueDate(dateStr, presetName = null) {
    this.selectedSidebarDueDate = dateStr;
    if (this.sidebarTaskDueDate) {
      this.sidebarTaskDueDate.value = dateStr || '';
    }

    if (this.sidebarQuickDates) {
      this.sidebarQuickDates.querySelectorAll('.quick-date-chip[data-sidebar-preset]').forEach((btn) => {
        btn.classList.toggle('active', Boolean(presetName && btn.dataset.sidebarPreset === presetName));
      });
    }

    const pickerLabel = this.sidebarDatePickerLabel;
    if (pickerLabel) {
      if (dateStr && !presetName) {
        pickerLabel.textContent = dateStr;
        pickerLabel.parentElement.classList.add('active');
      } else {
        pickerLabel.textContent = 'Pick Date';
        pickerLabel.parentElement.classList.remove('active');
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
      const subjects = store.getState().subjects || [];
      subjects.forEach((s) => {
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
    if (this.editTaskTimeSpent) {
      this.editTaskTimeSpent.value = task.timeSpentSec ? Math.round(task.timeSpentSec / 60) : '';
    }
    if (this.editTaskDueDate) this.editTaskDueDate.value = task.dueDate || '';
    if (this.editTaskRecurrence) this.editTaskRecurrence.value = task.recurrence || 'none';
    if (this.editTaskNotes) this.editTaskNotes.value = task.notes || '';

    if (this.taskEditModal) {
      this.taskEditModal.classList.add('active');
    }
    if (options.focusTimeSpent && this.editTaskTimeSpent) {
      setTimeout(() => this.editTaskTimeSpent.focus(), 50);
    } else if (this.editTaskTitle) {
      setTimeout(() => this.editTaskTitle.focus(), 50);
    }
  }

  closeTaskEditModal() {
    if (this.taskEditModal) {
      this.taskEditModal.classList.remove('active');
    }
  }

  createTaskCardElement(task, todayStr) {
    const card = document.createElement('div');
    card.className = `task-card ${task.completed ? 'task-completed' : ''}`;
    const color = store.getSubjectColor(task.subject);
    const timeLoggedMins = Math.round((task.timeSpentSec || 0) / 60);
    const isOverdue = Boolean(task.dueDate && task.dueDate < todayStr && !task.completed);

    card.innerHTML = `
      <div class="task-card-left">
        <label class="custom-checkbox">
          <input type="checkbox" ${task.completed ? 'checked' : ''} data-task-id="${task.id}" class="task-checkbox" />
          <span class="checkmark"></span>
        </label>
        <div class="task-info">
          <div class="task-title clickable-title ${task.completed ? 'completed-text' : ''}" title="Click to edit task">${this.escapeHTML(task.title)}</div>
          <div class="task-badges">
            <span class="subject-badge ${!task.subject ? 'badge-no-course' : ''}" style="--badge-color: ${color}">
              ${task.subject ? this.escapeHTML(task.subject) : 'General'}
            </span>
            ${task.targetMinutes ? `<span class="meta-badge">${task.targetMinutes}m target</span>` : ''}
            ${task.dueDate ? `
              <span class="meta-badge date-badge ${isOverdue ? 'overdue' : ''}" title="${isOverdue ? 'Task is past due!' : 'Target due date'}">
                Due: ${task.dueDate}${isOverdue ? ' (Overdue)' : ''}
              </span>
            ` : '<span class="meta-badge date-badge-none">No deadline</span>'}
            ${task.recurrence && task.recurrence !== 'none' ? `
              <span class="meta-badge task-recurrence-badge" title="Recurring study item: automatically generates next occurrence when completed">
                ↻ ${this.getRecurrenceLabel(task.recurrence, task.recurrenceInterval)}
              </span>
            ` : ''}
            ${timeLoggedMins > 0 ? `<span class="meta-badge logged-badge">◷ ${timeLoggedMins}m logged</span>` : ''}
          </div>
          ${task.notes ? `<div class="task-notes-preview">${this.escapeHTML(task.notes)}</div>` : ''}
        </div>
      </div>
      <div class="task-actions">
        ${!task.completed ? `
          <button class="btn btn-study-now" data-task-id="${task.id}" title="Start timer with this study item">
            ▶ Study
          </button>
        ` : (timeLoggedMins === 0 ? `
          <button class="btn btn-secondary btn-log-time" data-task-id="${task.id}" title="Record time spent on this completed task" style="font-size: 0.72rem; padding: 0.25rem 0.55rem;">
            + Log Time
          </button>
        ` : '')}
        <button class="btn btn-icon btn-edit-task" data-task-id="${task.id}" title="Edit task">✎</button>
        <button class="btn btn-icon btn-delete-task" data-task-id="${task.id}" title="Delete task">✕</button>
      </div>
    `;

    card.querySelector('.task-checkbox').addEventListener('change', () => {
      store.toggleTask(task.id);
      playClickSound();
    });

    const btnStudy = card.querySelector('.btn-study-now');
    if (btnStudy) {
      btnStudy.addEventListener('click', () => {
        this.startTaskStudySession(task);
        playClickSound();
      });
    }

    const btnLogTime = card.querySelector('.btn-log-time');
    if (btnLogTime) {
      btnLogTime.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openTaskEditModal(task.id, { focusTimeSpent: true });
        playClickSound();
      });
    }

    const btnEdit = card.querySelector('.btn-edit-task');
    if (btnEdit) {
      btnEdit.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openTaskEditModal(task.id);
        playClickSound();
      });
    }

    const titleEl = card.querySelector('.task-title');
    if (titleEl) {
      titleEl.addEventListener('click', () => {
        this.openTaskEditModal(task.id);
      });
    }

    card.querySelector('.btn-delete-task').addEventListener('click', async () => {
      const ok = await this.showInAppConfirm({
        title: 'Delete Study Task',
        message: `Delete study task "${task.title}"?`,
        confirmText: 'Delete',
        danger: true
      });
      if (ok) {
        store.deleteTask(task.id);
        playClickSound();
      }
    });

    return card;
  }

  renderTasks() {
    const tasks = store.getState().tasks;
    const pendingCount = tasks.filter((t) => !t.completed).length;

    if (this.statPendingTasks) {
      this.statPendingTasks.textContent = `${pendingCount} to do`;
    }
    if (this.taskBadgeCount) {
      this.taskBadgeCount.textContent = pendingCount;
    }
    if (this.sidebarTaskCount) {
      this.sidebarTaskCount.textContent = pendingCount;
    }

    this.renderSidebarTasks();

    // Date references
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

    const endOfWeek = new Date(today);
    const dayOfWeek = today.getDay() || 7;
    endOfWeek.setDate(today.getDate() + (7 - dayOfWeek));
    const endOfWeekStr = `${endOfWeek.getFullYear()}-${String(endOfWeek.getMonth() + 1).padStart(2, '0')}-${String(endOfWeek.getDate()).padStart(2, '0')}`;

    // 1. Filter by Smart Tab
    let filtered = tasks;
    const view = this.taskViewFilter || 'todo';

    if (view === 'todo') {
      filtered = filtered.filter((t) => !t.completed);
    } else if (view === 'today') {
      filtered = filtered.filter((t) => t.dueDate === todayStr || (t.createdAt && t.createdAt.startsWith(todayStr)));
    } else if (view === 'planned') {
      filtered = filtered.filter((t) => Boolean(t.dueDate));
    } else if (view === 'general') {
      filtered = filtered.filter((t) => !t.subject || t.subject === 'General' || t.subject === '');
    } else if (view === 'recurring') {
      filtered = filtered.filter((t) => t.recurrence && t.recurrence !== 'none');
    } else if (view === 'done') {
      filtered = filtered.filter((t) => t.completed);
    } else if (view === 'all') {
      // keep all
    }

    // 2. Filter by Course / Subject dropdown
    if (this.currentSubjectFilter !== 'all') {
      if (this.currentSubjectFilter === '') {
        filtered = filtered.filter((t) => !t.subject);
      } else {
        filtered = filtered.filter((t) => t.subject === this.currentSubjectFilter);
      }
    }

    // Empty state
    if (filtered.length === 0) {
      this.taskListContainer.innerHTML = `
        <div class="empty-state">
          <p>No study tasks found for this view.</p>
          <small>Add new tasks above or switch to another smart list tab.</small>
        </div>
      `;
      return;
    }

    // 3. Sort tasks
    const sortBy = this.taskSortBy || 'dueDate';
    filtered.sort((a, b) => {
      if (sortBy === 'dueDate') {
        if (!a.dueDate && !b.dueDate) return a.title.localeCompare(b.title);
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      } else if (sortBy === 'subject') {
        const subA = a.subject || 'ZZZ';
        const subB = b.subject || 'ZZZ';
        return subA.localeCompare(subB) || a.title.localeCompare(b.title);
      } else if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      } else if (sortBy === 'duration') {
        return (b.targetMinutes || 0) - (a.targetMinutes || 0);
      } else if (sortBy === 'created') {
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      }
      return 0;
    });

    // 4. Group tasks
    const groupBy = this.taskGroupBy || 'dueDate';
    this.taskListContainer.innerHTML = '';

    if (groupBy === 'none') {
      // Flat list
      const listDiv = document.createElement('div');
      listDiv.className = 'task-group-items';
      filtered.forEach((task) => {
        listDiv.appendChild(this.createTaskCardElement(task, todayStr));
      });
      this.taskListContainer.appendChild(listDiv);
      return;
    }

    // Grouping dictionary
    const groupsMap = new Map();

    filtered.forEach((task) => {
      let groupKey = 'Other';

      if (groupBy === 'dueDate') {
        if (task.completed) {
          groupKey = 'Completed Tasks';
        } else if (!task.dueDate) {
          groupKey = 'No Due Date';
        } else if (task.dueDate < todayStr) {
          groupKey = 'Overdue';
        } else if (task.dueDate === todayStr) {
          groupKey = 'Today';
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

      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, []);
      }
      groupsMap.get(groupKey).push(task);
    });

    // Define priority order for groups when grouping by dueDate
    let orderedKeys = Array.from(groupsMap.keys());
    if (groupBy === 'dueDate') {
      const dueOrder = ['Overdue', 'Today', 'Tomorrow', 'This Week', 'Later', 'No Due Date', 'Completed Tasks'];
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

    orderedKeys.forEach((groupTitle) => {
      const groupTasks = groupsMap.get(groupTitle);
      if (!groupTasks || groupTasks.length === 0) return;

      const totalMins = groupTasks.reduce((sum, t) => sum + (t.targetMinutes || 0), 0);
      const isCollapsed = this.collapsedTaskGroups.has(groupTitle);

      const groupSec = document.createElement('div');
      groupSec.className = `task-group-section ${isCollapsed ? 'group-collapsed' : ''}`;

      const header = document.createElement('div');
      header.className = 'task-group-header';
      header.innerHTML = `
        <span class="group-toggle-arrow">${isCollapsed ? '▸' : '▾'}</span>
        <span class="group-title">${this.escapeHTML(groupTitle)}</span>
        <span class="group-badge">${groupTasks.length} ${groupTasks.length === 1 ? 'task' : 'tasks'}${totalMins > 0 ? ` · ${totalMins}m` : ''}</span>
      `;

      header.addEventListener('click', () => {
        if (this.collapsedTaskGroups.has(groupTitle)) {
          this.collapsedTaskGroups.delete(groupTitle);
        } else {
          this.collapsedTaskGroups.add(groupTitle);
        }
        this.renderTasks();
        playClickSound();
      });

      const itemsDiv = document.createElement('div');
      itemsDiv.className = 'task-group-items';

      groupTasks.forEach((task) => {
        itemsDiv.appendChild(this.createTaskCardElement(task, todayStr));
      });

      groupSec.appendChild(header);
      groupSec.appendChild(itemsDiv);
      this.taskListContainer.appendChild(groupSec);
    });
  }

  startTaskStudySession(task) {
    timer.setContext({
      subject: task.subject || '',
      topic: task.title,
      linkedTaskId: task.id
    });
    if (this.subjectSelect) {
      this.subjectSelect.value = task.subject || '';
    }
    this.topicInput.value = task.title;
    this.renderLinkedTaskBanner(task.id);

    if (timer.mode === 'countdown' && task.targetMinutes) {
      timer.setTargetMinutes(task.targetMinutes);
    }

    this.switchView('focus');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- Grouped Subjects Management Page ---
  renderSubjectsPage() {
    if (!this.subjectsGrid) return;
    const subjects = store.getState().subjects;
    const groups = store.getState().groups || ['General'];

    // Render group filter tabs
    if (this.subjectsGroupFilterBar) {
      let filterHtml = `<button class="subj-group-tab ${this.subjectGroupFilter === 'all' ? 'active' : ''}" data-group="all">All Groups (${subjects.length})</button>`;
      groups.forEach((g) => {
        const count = subjects.filter((s) => (s.group || 'İTÜ Courses (Fall 2026)') === g).length;
        filterHtml += `<button class="subj-group-tab ${this.subjectGroupFilter === g ? 'active' : ''}" data-group="${this.escapeHTML(g)}">${this.escapeHTML(g)} (${count})</button>`;
      });
      this.subjectsGroupFilterBar.innerHTML = filterHtml;

      this.subjectsGroupFilterBar.querySelectorAll('.subj-group-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
          this.subjectGroupFilter = tab.dataset.group;
          this.renderSubjectsPage();
          playClickSound();
        });
      });
    }

    // Dynamic group suggestions datalist for modals
    if (this.groupSuggestions) {
      this.groupSuggestions.innerHTML = groups.map((g) => `<option value="${this.escapeHTML(g)}"></option>`).join('');
    }

    // Group subjects
    const displayedGroups = this.subjectGroupFilter === 'all'
      ? groups.filter((g) => subjects.some((s) => (s.group || 'İTÜ Courses (Fall 2026)') === g))
      : [this.subjectGroupFilter];

    this.subjectsGrid.innerHTML = '';

    displayedGroups.forEach((groupName) => {
      const groupSubjects = subjects.filter((s) => (s.group || 'İTÜ Courses (Fall 2026)') === groupName);
      if (groupSubjects.length === 0) return;

      const groupSection = document.createElement('div');
      groupSection.className = 'subjects-group-block';

      groupSection.innerHTML = `
        <div class="group-block-header">
          <div class="group-title-with-actions">
            <h3 class="group-block-title">${this.escapeHTML(groupName)}</h3>
            <button class="btn btn-icon btn-rename-group" data-group="${this.escapeHTML(groupName)}" title="Rename category '${this.escapeHTML(groupName)}'">✎</button>
          </div>
          <div class="group-header-right">
            <span class="group-block-count">${groupSubjects.length} courses / tracks</span>
          </div>
        </div>
        <div class="group-cards-grid"></div>
      `;

      const renameBtn = groupSection.querySelector('.btn-rename-group');
      if (renameBtn) {
        renameBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const curName = renameBtn.dataset.group;
          const newName = await this.showInAppPrompt({
            title: 'Rename Category',
            message: `Enter new name for category "${curName}":`,
            defaultValue: curName,
            confirmText: 'Rename'
          });
          if (newName && newName.trim() && newName.trim() !== curName) {
            store.renameCategory(curName, newName.trim());
            this.renderSubjectsPage();
            playClickSound();
          }
        });
      }

      const gridEl = groupSection.querySelector('.group-cards-grid');

      groupSubjects.forEach((sub) => {
        const stats = store.getSubjectStats(sub.name);
        const targetHours = sub.targetWeeklyHours;
        const progressPercent = targetHours
          ? Math.min(100, Math.round((parseFloat(stats.thisWeekHours) / targetHours) * 100))
          : 0;

        const dayNames = ['', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
        let scheduleText = '';
        if (Array.isArray(sub.schedule) && sub.schedule.length > 0) {
          scheduleText = sub.schedule.map((s) => `${dayNames[s.day]} ${s.start}-${s.end}`).join(' & ');
        }

        const card = document.createElement('div');
        card.className = 'subject-management-card';
        card.style.setProperty('--card-accent', sub.color);

        card.innerHTML = `
          <div class="subject-card-header">
            <div class="subject-card-title-group">
              <span class="subject-color-dot" style="background-color: ${sub.color}"></span>
              <div>
                <span class="subject-code-tag">${this.escapeHTML(sub.code || 'COURSE')}</span>
                <h3 class="subject-name">${this.escapeHTML(sub.name)}</h3>
                ${scheduleText ? `<span class="subject-schedule-badge">${this.escapeHTML(scheduleText)}</span>` : ''}
              </div>
            </div>
            <div class="subject-card-menu">
              <button class="btn btn-icon btn-edit-subject" data-id="${sub.id}" title="Edit subject">✎</button>
              <button class="btn btn-icon btn-delete-subject" data-id="${sub.id}" title="Delete subject">✕</button>
            </div>
          </div>

          ${targetHours ? `
            <div class="subject-progress-box">
              <div class="progress-labels">
                <span>This Week: <strong>${stats.thisWeekHours} hrs</strong></span>
                <span>Goal: <strong>${targetHours} hrs/wk</strong></span>
              </div>
              <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${progressPercent}%; background-color: ${sub.color};"></div>
              </div>
            </div>
          ` : `
            <div class="subject-progress-box self-paced">
              <span class="self-paced-label">Self-Paced (No required weekly quota)</span>
            </div>
          `}

          <div class="subject-metrics-row">
            <div class="subject-metric">
              <span class="metric-val">${stats.pendingTasks}</span>
              <span class="metric-lbl">To-Do</span>
            </div>
            <div class="subject-metric">
              <span class="metric-val">${stats.completedTasks}</span>
              <span class="metric-lbl">Completed</span>
            </div>
            <div class="subject-metric">
              <span class="metric-val">${stats.totalMinutes}m</span>
              <span class="metric-lbl">Total Time</span>
            </div>
          </div>

          <div class="subject-card-footer">
            ${sub.folderPath ? `
              <div class="subject-folder-row" title="${this.escapeHTML(sub.folderPath)}">
                <span class="folder-path-text">${this.escapeHTML(sub.folderPath)}</span>
                <button class="btn-copy-path" data-path="${this.escapeHTML(sub.folderPath)}" title="Copy folder path">Copy</button>
              </div>
            ` : ''}
            <button class="btn btn-secondary btn-quick-study-subject" data-subject="${this.escapeHTML(sub.name)}" style="width: 100%;">
              ▶ Study This Course
            </button>
          </div>
        `;

        card.querySelector('.btn-edit-subject').addEventListener('click', () => {
          this.openSubjectModal(sub);
          playClickSound();
        });

        card.querySelector('.btn-delete-subject').addEventListener('click', async () => {
          const ok = await this.showInAppConfirm({
            title: 'Remove Course / Subject',
            message: `Remove "${sub.name}" from your subjects? Existing study logs will be preserved.`,
            confirmText: 'Remove Subject',
            danger: true
          });
          if (ok) {
            store.deleteSubject(sub.id);
            playClickSound();
          }
        });

        const btnCopy = card.querySelector('.btn-copy-path');
        if (btnCopy) {
          btnCopy.addEventListener('click', () => {
            navigator.clipboard.writeText(btnCopy.dataset.path).then(() => {
              btnCopy.textContent = '✓';
              setTimeout(() => { btnCopy.textContent = 'Copy'; }, 1500);
            });
            playClickSound();
          });
        }

        card.querySelector('.btn-quick-study-subject').addEventListener('click', () => {
          timer.setContext({ subject: sub.name, topic: '' });
          this.subjectSelect.value = sub.name;
          this.switchView('focus');
          playClickSound();
        });

        gridEl.appendChild(card);
      });

      this.subjectsGrid.appendChild(groupSection);
    });
  }

  openSubjectModal(subjectToEdit = null) {
    if (subjectToEdit) {
      this.editingSubjectId = subjectToEdit.id;
      this.subjectModalTitle.textContent = 'Edit Subject / Course';
      this.subjectNameInput.value = subjectToEdit.name;
      this.subjectCodeInput.value = subjectToEdit.code || '';
      this.subjectGroupInput.value = subjectToEdit.group || 'İTÜ Courses (Fall 2026)';
      this.subjectFolderInput.value = subjectToEdit.folderPath || '';
      this.subjectColorInput.value = subjectToEdit.color || '#e06d43';
      this.subjectHoursInput.value = subjectToEdit.targetWeeklyHours || '';
    } else {
      this.editingSubjectId = null;
      this.subjectModalTitle.textContent = 'Add New Subject / Course';
      this.subjectNameInput.value = '';
      this.subjectCodeInput.value = '';
      this.subjectGroupInput.value = 'İTÜ Courses (Fall 2026)';
      this.subjectFolderInput.value = '';
      this.subjectColorInput.value = '#059669';
      this.subjectHoursInput.value = '';
    }
    this.subjectModal.classList.add('active');
  }

  // --- Manage Categories Modal Logic ---
  openCategoriesModal() {
    if (!this.categoriesModal) return;
    this.renderCategoriesModal();
    this.categoriesModal.classList.add('active');
  }

  renderCategoriesModal() {
    if (!this.categoriesManagerList) return;
    const groups = store.getGroups();
    const subjects = store.getState().subjects;

    if (groups.length === 0) {
      this.categoriesManagerList.innerHTML = `<div class="empty-state" style="padding: 1rem;"><p>No categories found.</p></div>`;
      return;
    }

    this.categoriesManagerList.innerHTML = '';
    groups.forEach((groupName) => {
      const count = subjects.filter((s) => s.group === groupName).length;
      const row = document.createElement('div');
      row.className = 'category-manager-row';
      row.innerHTML = `
        <div class="category-info">
          <span class="category-name-badge">${this.escapeHTML(groupName)}</span>
          <span class="category-sub-count">${count} course${count === 1 ? '' : 's'}</span>
        </div>
        <div class="category-row-actions">
          <button class="btn btn-secondary btn-rename-cat" data-group="${this.escapeHTML(groupName)}">
            Rename
          </button>
          <button class="btn btn-icon btn-del-cat" data-group="${this.escapeHTML(groupName)}" title="Delete category">
            ✕
          </button>
        </div>
      `;

      row.querySelector('.btn-rename-cat').addEventListener('click', async () => {
        const newName = await this.showInAppPrompt({
          title: 'Rename Category',
          message: `Enter new name for category "${groupName}":`,
          defaultValue: groupName,
          confirmText: 'Rename'
        });
        if (newName && newName.trim() && newName.trim() !== groupName) {
          store.renameCategory(groupName, newName.trim());
          this.renderCategoriesModal();
          this.renderSubjectsPage();
          playClickSound();
        }
      });

      row.querySelector('.btn-del-cat').addEventListener('click', async () => {
        const ok = await this.showInAppConfirm({
          title: 'Delete Category',
          message: `Delete category "${groupName}"? Courses in it will be moved to default.`,
          confirmText: 'Delete',
          danger: true
        });
        if (ok) {
          store.deleteCategory(groupName);
          this.renderCategoriesModal();
          this.renderSubjectsPage();
          playClickSound();
        }
      });

      this.categoriesManagerList.appendChild(row);
    });
  }

  // --- Weekly Event Modal (Add / Edit) ---
  openWeeklyEventModal(eventId = null) {
    if (!this.weeklyEventModal) return;
    this.weeklyEventForm.reset();

    if (eventId) {
      const ev = (store.getState().weeklyEvents || []).find((e) => e.id === eventId);
      if (ev) {
        if (this.weventEditId) this.weventEditId.value = ev.id;
        if (this.weventModalTitle) this.weventModalTitle.textContent = 'Edit Recurring Event / Routine';
        document.getElementById('wevent-title-input').value = ev.title;
        if (this.weventRecurrenceSelect) this.weventRecurrenceSelect.value = ev.recurrence || 'weekly';
        document.getElementById('wevent-day-select').value = String(ev.day);
        document.getElementById('wevent-start-input').value = ev.start;
        document.getElementById('wevent-end-input').value = ev.end;
        document.getElementById('wevent-cat-input').value = ev.category || 'Seminars & Academies';
        document.getElementById('wevent-color-input').value = ev.color || '#059669';
        document.getElementById('wevent-notes-input').value = ev.notes || '';
        if (this.btnDeleteWevent) this.btnDeleteWevent.style.display = 'inline-flex';

        if (this.weventDayGroup) {
          const isDailyOrWeekdays = ev.recurrence === 'daily' || ev.recurrence === 'weekdays';
          this.weventDayGroup.style.opacity = isDailyOrWeekdays ? '0.5' : '1';
          this.weventDayGroup.style.pointerEvents = isDailyOrWeekdays ? 'none' : 'auto';
        }
      }
    } else {
      if (this.weventEditId) this.weventEditId.value = '';
      if (this.weventModalTitle) this.weventModalTitle.textContent = 'Add Recurring Event / Routine';
      if (this.weventRecurrenceSelect) this.weventRecurrenceSelect.value = 'weekly';
      document.getElementById('wevent-day-select').value = '4';
      document.getElementById('wevent-start-input').value = '19:00';
      document.getElementById('wevent-end-input').value = '21:30';
      document.getElementById('wevent-cat-input').value = 'Seminars & Academies';
      document.getElementById('wevent-color-input').value = '#059669';
      if (this.btnDeleteWevent) this.btnDeleteWevent.style.display = 'none';

      if (this.weventDayGroup) {
        this.weventDayGroup.style.opacity = '1';
        this.weventDayGroup.style.pointerEvents = 'auto';
      }
    }

    this.weeklyEventModal.classList.add('active');
  }

  // --- Lecture Slot Modal (Edit Course Class Slot) ---
  openLectureSlotModal(subjectId, slotIndex) {
    if (!this.lectureSlotModal) return;
    const sub = store.getState().subjects.find((s) => s.id === subjectId);
    if (!sub || !Array.isArray(sub.schedule) || !sub.schedule[slotIndex]) return;

    const slot = sub.schedule[slotIndex];
    if (this.lslotSubjectId) this.lslotSubjectId.value = sub.id;
    if (this.lslotIndex) this.lslotIndex.value = slotIndex;
    if (this.lslotCourseName) this.lslotCourseName.value = `${sub.code ? sub.code + ' — ' : ''}${sub.name}`;
    if (this.lslotDaySelect) this.lslotDaySelect.value = String(slot.day);
    if (this.lslotStartInput) this.lslotStartInput.value = slot.start;
    if (this.lslotEndInput) this.lslotEndInput.value = slot.end;
    if (this.lslotLabelInput) this.lslotLabelInput.value = slot.label || 'Lecture';

    this.lectureSlotModal.classList.add('active');
  }

  // --- Schedule Manager Modal Logic ---
  openScheduleManagerModal() {
    if (!this.scheduleManagerModal) return;
    this.renderScheduleManagerModal();
    this.scheduleManagerModal.classList.add('active');
  }

  renderScheduleManagerModal() {
    if (!this.scheduleManagerList) return;
    const subjects = store.getState().subjects;
    const weeklyEvents = store.getState().weeklyEvents || [];
    const dayNames = ['', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

    const allItems = [];

    // Course lecture slots
    subjects.forEach((s) => {
      if (Array.isArray(s.schedule)) {
        s.schedule.forEach((slot, idx) => {
          allItems.push({
            type: 'lecture',
            subjectId: s.id,
            slotIndex: idx,
            title: `${s.code ? s.code + ': ' : ''}${s.name}`,
            day: slot.day,
            start: slot.start,
            end: slot.end,
            color: s.color,
            category: 'İTÜ Lectures'
          });
        });
      }
    });

    // Weekly events (Academies & Seminars)
    weeklyEvents.forEach((ev) => {
      allItems.push({
        type: 'wevent',
        id: ev.id,
        title: ev.title,
        day: ev.day,
        start: ev.start,
        end: ev.end,
        color: ev.color || '#059669',
        category: ev.category || 'Seminars & Academies',
        recurrence: ev.recurrence || 'weekly'
      });
    });

    if (allItems.length === 0) {
      this.scheduleManagerList.innerHTML = `<div class="empty-state" style="padding: 1.5rem;"><p>No scheduled classes or events.</p></div>`;
      return;
    }

    // Sort by day (1..7), then start time
    allItems.sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));

    let html = '';
    let currentDay = -1;

    const recLabels = {
      weekly: 'Weekly',
      biweekly: 'Bi-weekly',
      triweekly: 'Tri-weekly',
      monthly: 'Monthly',
      weekdays: 'Weekdays (Mon-Fri)',
      daily: 'Daily'
    };

    allItems.forEach((item) => {
      if (item.day !== currentDay) {
        currentDay = item.day;
        html += `<div class="schedule-mgr-day-header">${dayNames[currentDay]}</div>`;
      }

      const recBadge = item.recurrence && item.recurrence !== 'weekly'
        ? `<span class="cadence-pill">${recLabels[item.recurrence] || item.recurrence}</span>`
        : '';

      html += `
        <div class="schedule-mgr-row" style="border-left: 3px solid ${item.color};">
          <div class="schedule-mgr-info">
            <div style="display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;">
              <span class="schedule-mgr-time">${item.start} - ${item.end}</span>
              <span class="schedule-mgr-badge" style="background-color: ${item.type === 'lecture' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(5, 150, 105, 0.15)'}; color: ${item.type === 'lecture' ? 'var(--primary)' : 'var(--accent-emerald)'};">
                ${this.escapeHTML(item.category)}
              </span>
              ${recBadge}
            </div>
            <div class="schedule-mgr-title">${this.escapeHTML(item.title)}</div>
          </div>
          <div class="schedule-mgr-actions">
            <button class="btn btn-secondary btn-edit-sched-item" data-type="${item.type}" data-sub-id="${item.subjectId || ''}" data-slot-idx="${item.slotIndex !== undefined ? item.slotIndex : ''}" data-ev-id="${item.id || ''}">
              Edit
            </button>
            <button class="btn btn-icon btn-del-sched-item" data-type="${item.type}" data-sub-id="${item.subjectId || ''}" data-slot-idx="${item.slotIndex !== undefined ? item.slotIndex : ''}" data-ev-id="${item.id || ''}" title="Delete / Remove">
              ✕
            </button>
          </div>
        </div>
      `;
    });

    this.scheduleManagerList.innerHTML = html;

    // Attach click handlers
    this.scheduleManagerList.querySelectorAll('.btn-edit-sched-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        if (type === 'wevent') {
          this.openWeeklyEventModal(btn.dataset.evId);
        } else {
          this.openLectureSlotModal(btn.dataset.subId, parseInt(btn.dataset.slotIdx, 10));
        }
      });
    });

    this.scheduleManagerList.querySelectorAll('.btn-del-sched-item').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const type = btn.dataset.type;
        if (type === 'wevent') {
          const ok = await this.showInAppConfirm({
            title: 'Delete Weekly Event',
            message: 'Are you sure you want to delete this recurring weekly event?',
            confirmText: 'Delete',
            danger: true
          });
          if (ok) {
            store.deleteWeeklyEvent(btn.dataset.evId);
            this.renderScheduleManagerModal();
            this.renderCalendar();
            playClickSound();
          }
        } else {
          const ok = await this.showInAppConfirm({
            title: 'Remove Lecture Slot',
            message: 'Remove this lecture slot from the course schedule?',
            confirmText: 'Remove',
            danger: true
          });
          if (ok) {
            store.deleteLectureSlot(btn.dataset.subId, parseInt(btn.dataset.slotIdx, 10));
            this.renderScheduleManagerModal();
            this.renderCalendar();
            playClickSound();
          }
        }
      });
    });
  }

  // --- Weekly & Monthly Planner View (With Lectures, Additional Weekly Events, & Backlog) ---
  renderCalendar() {
    if (!this.calendarViewContainer) return;

    if (this.calendarViewMode === 'week') {
      this.renderWeekCalendar();
    } else {
      this.renderMonthCalendar();
    }

    this.renderBacklogTasks();
  }

  renderWeekCalendar() {
    const anchor = new Date(this.calendarAnchorDate);
    anchor.setHours(0, 0, 0, 0);
    const dayOfWeek = anchor.getDay() || 7; // Monday = 1, Sunday = 7
    const monday = new Date(anchor);
    monday.setDate(anchor.getDate() - dayOfWeek + 1);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(0, 0, 0, 0);

    const options = { month: 'short', day: 'numeric' };
    this.calTitleHeader.textContent = `${monday.toLocaleDateString(undefined, options)} – ${sunday.toLocaleDateString(undefined, { ...options, year: 'numeric' })}`;

    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      d.setHours(0, 0, 0, 0);
      weekDays.push(d);
    }

    const todayStr = toLocalDateStr(new Date());
    const tasks = store.getState().tasks;
    const sessions = store.getState().sessions;

    let html = `<div class="week-calendar-grid">`;

    weekDays.forEach((dateObj) => {
      const dateStr = toLocalDateStr(dateObj);
      const isToday = dateStr === todayStr;
      const dayName = dateObj.toLocaleDateString(undefined, { weekday: 'short' });
      const dayNum = dateObj.getDate();
      const dayNumOfWeek = dateObj.getDay() || 7;

      // Filter tasks for this day
      let dayTasks = tasks.filter((t) => t.dueDate === dateStr);
      if (this.calendarSubjectFilter !== 'all') {
        if (this.calendarSubjectFilter === '') {
          dayTasks = dayTasks.filter((t) => !t.subject);
        } else {
          dayTasks = dayTasks.filter((t) => t.subject === this.calendarSubjectFilter);
        }
      }

      // Filter sessions for this day
      let daySessions = sessions.filter((s) => {
        const sDate = toLocalDateStr(s.endTime || s.createdAt);
        return sDate === dateStr;
      });
      if (this.calendarSubjectFilter !== 'all') {
        daySessions = daySessions.filter((s) => s.subject === this.calendarSubjectFilter);
      }

      const totalMinsStudied = Math.round(daySessions.reduce((acc, s) => acc + (s.durationSec || 0), 0) / 60);

      html += `
        <div class="calendar-day-column ${isToday ? 'today-col' : ''}" data-date="${dateStr}">
          <div class="day-col-header">
            <span class="day-name">${dayName}</span>
            <span class="day-number ${isToday ? 'today-pill' : ''}">${dayNum}</span>
            ${totalMinsStudied > 0 ? `<span class="day-logged-pill">⏱ ${totalMinsStudied}m studied</span>` : ''}
          </div>

          <div class="day-col-body">
            <!-- Scheduled Classes & Weekly Seminars for this day -->
            ${this.renderDayClassLectures(dayNumOfWeek)}

            <!-- Scheduled Study Tasks for the day -->
            <div class="day-tasks-section">
              <span class="day-section-sub">Study Tasks:</span>
              <div class="day-tasks-list">
                ${dayTasks.map((t) => {
                  const color = store.getSubjectColor(t.subject);
                  return `
                    <div class="cal-task-item ${t.completed ? 'completed' : ''}" style="border-left: 3px solid ${color};">
                      <div class="cal-task-top">
                        <span class="cal-subject-badge ${!t.subject ? 'badge-no-course-text' : ''}" style="color: ${color};">${t.subject ? this.escapeHTML(t.subject) : 'General'}</span>
                        ${t.recurrence && t.recurrence !== 'none' ? `<span class="cal-recurrence-pill" title="Repeats: ${this.getRecurrenceLabel(t.recurrence, t.recurrenceInterval)}">↻ ${this.getRecurrenceLabel(t.recurrence, t.recurrenceInterval)}</span>` : ''}
                        ${t.targetMinutes ? `<span class="cal-time-goal">${t.targetMinutes}m</span>` : ''}
                      </div>
                      <div class="cal-task-title">${this.escapeHTML(t.title)}</div>
                      <div class="cal-task-actions">
                        <button class="btn-cal-check" data-task-id="${t.id}" title="${t.completed ? 'Mark undone' : 'Mark done'}">
                          ${t.completed ? '✓' : '○'}
                        </button>
                        ${!t.completed ? `
                          <button class="btn-cal-study" data-task-id="${t.id}" title="Study Now">
                            ▶ Study
                          </button>
                        ` : ''}
                        <button class="btn-cal-edit" data-task-id="${t.id}" title="Edit task">✎</button>
                        <a 
                          href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('[Study] ' + (t.subject || 'General') + ': ' + t.title)}&dates=${dateStr.replace(/-/g, '')}T090000Z/${dateStr.replace(/-/g, '')}T100000Z&details=${encodeURIComponent(t.notes || 'Scheduled in ChronoStudy')}" 
                          target="_blank" 
                          class="btn-cal-gcal" 
                          title="Add to Google Calendar"
                        >
                          GCal
                        </a>
                        <button class="btn-cal-delete" data-task-id="${t.id}" title="Delete task">✕</button>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- Completed study sessions on this day -->
            ${daySessions.length > 0 ? `
              <div class="day-sessions-summary">
                <span class="day-section-sub">Completed Sessions:</span>
                ${daySessions.map((s) => `
                  <div class="cal-session-snippet" title="${this.escapeHTML(s.notes || '')}">
                    <span class="cal-session-dur">${Math.round(s.durationSec / 60)}m</span>
                    <span class="cal-session-title">${this.escapeHTML(s.topic)}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}

            <button class="btn-add-day-task" data-date="${dateStr}">+ Add Task for ${dayName}</button>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    this.calendarViewContainer.innerHTML = html;

    // Bind events inside week view
    this.calendarViewContainer.querySelectorAll('.btn-cal-check').forEach((btn) => {
      btn.addEventListener('click', () => {
        store.toggleTask(btn.dataset.taskId);
        playClickSound();
      });
    });

    this.calendarViewContainer.querySelectorAll('.btn-cal-edit').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.openTaskEditModal(btn.dataset.taskId);
        playClickSound();
      });
    });

    this.calendarViewContainer.querySelectorAll('.cal-task-title').forEach((titleEl) => {
      titleEl.style.cursor = 'pointer';
      titleEl.title = 'Click to edit task';
      titleEl.addEventListener('click', (e) => {
        const item = e.target.closest('.cal-task-item');
        const checkBtn = item ? item.querySelector('.btn-cal-check') : null;
        if (checkBtn && checkBtn.dataset.taskId) {
          this.openTaskEditModal(checkBtn.dataset.taskId);
        }
      });
    });

    this.calendarViewContainer.querySelectorAll('.btn-cal-delete').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ok = await this.showInAppConfirm({
          title: 'Delete Task',
          message: 'Are you sure you want to delete this study task?',
          confirmText: 'Delete',
          danger: true
        });
        if (ok) {
          store.deleteTask(btn.dataset.taskId);
          playClickSound();
        }
      });
    });

    this.calendarViewContainer.querySelectorAll('.btn-cal-study').forEach((btn) => {
      btn.addEventListener('click', () => {
        const task = store.getState().tasks.find((t) => t.id === btn.dataset.taskId);
        if (task) {
          this.startTaskStudySession(task);
          playClickSound();
        }
      });
    });

    this.calendarViewContainer.querySelectorAll('.btn-add-day-task').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const targetDate = btn.dataset.date;
        const title = await this.showInAppPrompt({
          title: `Add Task for ${targetDate}`,
          message: 'What study topic or problem set do you want to plan for this day?',
          placeholder: 'e.g. Chapter 6 Problem Set',
          confirmText: 'Add Task'
        });
        if (title && title.trim()) {
          const selectedSubj = (this.calSubjectFilter && this.calSubjectFilter.value !== 'all') 
            ? this.calSubjectFilter.value 
            : (this.subjectSelect ? this.subjectSelect.value : null);
          store.addTask({
            title: title.trim(),
            subject: selectedSubj || null,
            targetMinutes: null, // Optional
            dueDate: targetDate
          });
          playClickSound();
        }
      });
    });

    // Chip click handlers to arrange lectures and weekly events
    this.calendarViewContainer.querySelectorAll('.itu-lecture-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        this.openLectureSlotModal(chip.dataset.subjectId, parseInt(chip.dataset.slotIndex, 10));
        playClickSound();
      });
    });

    this.calendarViewContainer.querySelectorAll('.wevent-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        this.openWeeklyEventModal(chip.dataset.eventId);
        playClickSound();
      });
    });
  }

  renderDayClassLectures(dayOfWeek) {
    const subjects = store.getState().subjects;
    const weeklyEvents = store.getState().weeklyEvents || [];
    const ituLectures = [];
    const otherEvents = [];

    // 1. İTÜ Course Lectures
    subjects.forEach((s) => {
      if (Array.isArray(s.schedule)) {
        s.schedule.forEach((slot, slotIdx) => {
          if (slot.day === dayOfWeek) {
            ituLectures.push({
              subjectId: s.id,
              slotIndex: slotIdx,
              code: s.code || s.name,
              name: s.name,
              color: s.color,
              start: slot.start,
              end: slot.end
            });
          }
        });
      }
    });

    // 2. Additional Recurring Commitments (e.g. Kardeşlik ve İhya, Seminars, Routines)
    weeklyEvents.forEach((ev) => {
      const rec = ev.recurrence || 'weekly';
      let matches = false;

      if (rec === 'daily') {
        matches = true;
      } else if (rec === 'weekdays') {
        matches = dayOfWeek >= 1 && dayOfWeek <= 5;
      } else if (rec === 'weekly' || rec === 'biweekly' || rec === 'triweekly' || rec === 'monthly') {
        matches = ev.day === dayOfWeek;
      }

      if (matches) {
        let cadenceBadge = '';
        if (rec === 'biweekly') cadenceBadge = '<span class="cadence-pill">Bi-weekly</span>';
        else if (rec === 'triweekly') cadenceBadge = '<span class="cadence-pill">Tri-weekly</span>';
        else if (rec === 'monthly') cadenceBadge = '<span class="cadence-pill">Monthly</span>';
        else if (rec === 'weekdays') cadenceBadge = '<span class="cadence-pill">Weekdays</span>';
        else if (rec === 'daily') cadenceBadge = '<span class="cadence-pill">Daily</span>';

        otherEvents.push({
          id: ev.id,
          code: ev.title,
          cadenceBadge,
          name: ev.notes || ev.title,
          color: ev.color || '#059669',
          start: ev.start,
          end: ev.end
        });
      }
    });

    if (ituLectures.length === 0 && otherEvents.length === 0) return '';

    ituLectures.sort((a, b) => a.start.localeCompare(b.start));
    otherEvents.sort((a, b) => a.start.localeCompare(b.start));

    let html = '';

    if (ituLectures.length > 0) {
      html += `
        <div class="day-classes-container">
          <span class="day-section-sub">İTÜ Lectures:</span>
          <div class="day-classes-list">
            ${ituLectures.map((c) => `
              <div class="day-class-chip itu-lecture-chip" data-subject-id="${c.subjectId}" data-slot-index="${c.slotIndex}" style="--class-color: ${c.color};" title="${this.escapeHTML(c.name)} (${c.start} - ${c.end}) — Click to arrange">
                <div class="class-chip-top">
                  <span class="class-code">${this.escapeHTML(c.code)}</span>
                  <span class="chip-edit-icon" title="Edit lecture time">✎</span>
                </div>
                <div class="class-chip-sub">
                  <span class="class-time">${c.start} - ${c.end}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    if (otherEvents.length > 0) {
      html += `
        <div class="day-classes-container" style="margin-top: 0.4rem;">
          <span class="day-section-sub">Academies & Routines:</span>
          <div class="day-classes-list">
            ${otherEvents.map((c) => `
              <div class="day-class-chip seminar-chip wevent-chip" data-event-id="${c.id}" style="--class-color: ${c.color};" title="${this.escapeHTML(c.name)} (${c.start} - ${c.end}) — Click to arrange">
                <div class="class-chip-top">
                  <span class="class-code">${this.escapeHTML(c.code)}</span>
                  <span class="chip-edit-icon" title="Edit event">✎</span>
                </div>
                <div class="class-chip-sub">
                  <span class="class-time">${c.start} - ${c.end}</span>
                  ${c.cadenceBadge || ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    return html;
  }

  renderMonthCalendar() {
    const anchor = new Date(this.calendarAnchorDate);
    const year = anchor.getFullYear();
    const month = anchor.getMonth();

    this.calTitleHeader.textContent = anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startDayIndex = (firstDayOfMonth.getDay() || 7) - 1;
    const totalDays = lastDayOfMonth.getDate();

    const todayStr = toLocalDateStr(new Date());
    const tasks = store.getState().tasks;
    const sessions = store.getState().sessions;

    let html = `
      <div class="month-calendar-wrapper">
        <div class="month-header-row">
          <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
        </div>
        <div class="month-grid">
    `;

    for (let i = 0; i < startDayIndex; i++) {
      html += `<div class="month-day-cell empty-cell"></div>`;
    }

    for (let d = 1; d <= totalDays; d++) {
      const curDate = new Date(year, month, d);
      curDate.setHours(12, 0, 0, 0);
      const dateStr = toLocalDateStr(curDate);
      const isToday = dateStr === todayStr;

      let dayTasks = tasks.filter((t) => t.dueDate === dateStr);
      if (this.calendarSubjectFilter !== 'all') {
        dayTasks = dayTasks.filter((t) => t.subject === this.calendarSubjectFilter);
      }

      let daySessions = sessions.filter((s) => toLocalDateStr(s.endTime || s.createdAt) === dateStr);
      const dayMins = Math.round(daySessions.reduce((acc, s) => acc + (s.durationSec || 0), 0) / 60);

      html += `
        <div class="month-day-cell ${isToday ? 'today-month-cell' : ''}" data-date="${dateStr}">
          <div class="month-cell-header">
            <span class="month-day-num ${isToday ? 'today-num-pill' : ''}">${d}</span>
            ${dayMins > 0 ? `<span class="month-mins-badge">${dayMins}m</span>` : ''}
          </div>
          <div class="month-cell-dots">
            ${dayTasks.slice(0, 3).map((t) => {
              const color = store.getSubjectColor(t.subject);
              return `<span class="month-task-dot" style="background-color: ${color};" title="${this.escapeHTML(t.title)}"></span>`;
            }).join('')}
            ${dayTasks.length > 3 ? `<span class="more-dots">+${dayTasks.length - 3}</span>` : ''}
          </div>
        </div>
      `;
    }

    html += `
        </div>
      </div>
    `;

    this.calendarViewContainer.innerHTML = html;

    this.calendarViewContainer.querySelectorAll('.month-day-cell:not(.empty-cell)').forEach((cell) => {
      cell.addEventListener('click', () => {
        const dateStr = cell.dataset.date;
        this.openDayInspector(dateStr);
        playClickSound();
      });
    });
  }

  // --- Backlog / Unscheduled Tasks Shelf ---
  renderBacklogTasks() {
    if (!this.backlogTasksContainer) return;

    const backlogTasks = store.getState().tasks.filter((t) => !t.dueDate && !t.completed);

    if (backlogTasks.length === 0) {
      this.backlogTasksContainer.innerHTML = `
        <div class="empty-state" style="padding: 1rem;">
          <p>No unscheduled tasks.</p>
          <small>Add study items with no due date to keep them in this backlog.</small>
        </div>
      `;
      return;
    }

    this.backlogTasksContainer.innerHTML = '';
    backlogTasks.forEach((t) => {
      const color = store.getSubjectColor(t.subject);
      const card = document.createElement('div');
      card.className = 'backlog-task-card';
      card.style.borderLeft = `3px solid ${color}`;

      card.innerHTML = `
        <div class="backlog-task-info">
          <div style="display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap;">
            <span class="subject-badge ${!t.subject ? 'badge-no-course' : ''}" style="--badge-color: ${color}">${t.subject ? this.escapeHTML(t.subject) : 'General'}</span>
            ${t.recurrence && t.recurrence !== 'none' ? `<span class="meta-badge task-recurrence-badge" style="font-size: 0.65rem;">↻ ${this.getRecurrenceLabel(t.recurrence, t.recurrenceInterval)}</span>` : ''}
          </div>
          <div class="backlog-task-title">${this.escapeHTML(t.title)}</div>
        </div>
        <div class="backlog-task-actions">
          <button class="btn btn-study-now btn-study-backlog" data-id="${t.id}">▶ Study</button>
          <button class="btn btn-icon btn-edit-backlog" data-id="${t.id}" title="Edit task">✎</button>
          <button class="btn btn-secondary btn-schedule-backlog" data-id="${t.id}" title="Assign to a day">Schedule</button>
          <button class="btn btn-icon btn-del-backlog" data-id="${t.id}">✕</button>
        </div>
      `;

      card.querySelector('.btn-study-backlog').addEventListener('click', () => {
        this.startTaskStudySession(t);
        playClickSound();
      });

      card.querySelector('.btn-edit-backlog').addEventListener('click', () => {
        this.openTaskEditModal(t.id);
        playClickSound();
      });

      const titleEl = card.querySelector('.backlog-task-title');
      if (titleEl) {
        titleEl.style.cursor = 'pointer';
        titleEl.title = 'Click to edit task';
        titleEl.addEventListener('click', () => {
          this.openTaskEditModal(t.id);
        });
      }

      card.querySelector('.btn-schedule-backlog').addEventListener('click', async () => {
        const todayStr = toLocalDateStr(new Date());
        const pickedDate = await this.showInAppPrompt({
          title: 'Schedule Study Task',
          message: `Assign "${t.title}" to a study date:`,
          defaultValue: todayStr,
          placeholder: 'YYYY-MM-DD',
          confirmText: 'Schedule'
        });
        if (pickedDate && pickedDate.trim()) {
          store.updateTask(t.id, { dueDate: pickedDate.trim() });
          playClickSound();
        }
      });

      card.querySelector('.btn-del-backlog').addEventListener('click', async () => {
        const ok = await this.showInAppConfirm({
          title: 'Delete Task',
          message: `Delete "${t.title}"?`,
          confirmText: 'Delete',
          danger: true
        });
        if (ok) {
          store.deleteTask(t.id);
          playClickSound();
        }
      });

      this.backlogTasksContainer.appendChild(card);
    });
  }

  async openDayInspector(dateStr) {
    const tasks = store.getState().tasks.filter((t) => t.dueDate === dateStr);
    const sessions = store.getState().sessions.filter((s) => toLocalDateStr(s.endTime || s.createdAt) === dateStr);
    const totalMins = Math.round(sessions.reduce((acc, s) => acc + (s.durationSec || 0), 0) / 60);

    let summary = `Date: ${dateStr}\nTotal Study Time: ${totalMins} mins\n\n`;
    if (tasks.length > 0) {
      summary += `Tasks Scheduled:\n` + tasks.map((t) => `• [${t.completed ? 'DONE' : 'TODO'}] ${t.subject || 'General'}: ${t.title}`).join('\n') + `\n\n`;
    }
    if (sessions.length > 0) {
      summary += `Sessions Logged:\n` + sessions.map((s) => `• ${Math.round(s.durationSec / 60)}m: ${s.subject} - ${s.topic}`).join('\n');
    }

    const action = await this.showInAppConfirm({
      title: `Day Details: ${dateStr}`,
      message: `${summary}\nWould you like to switch to the Week view for this date?`,
      confirmText: 'Switch to Week View'
    });
    if (action) {
      this.calendarAnchorDate = new Date(dateStr + 'T12:00:00');
      this.calendarViewMode = 'week';
      this.calModeWeekBtn.classList.add('active');
      this.calModeMonthBtn.classList.remove('active');
      this.renderCalendar();
    }
  }

  // --- Study Analytics Dashboard & History Rendering ---
  renderHistory() {
    const data = store.getAnalyticsData();

    // 1. KPI Cards
    if (this.analyticsTotalTime) {
      const totalHours = Math.floor(data.totalSec / 3600);
      const totalMins = Math.round((data.totalSec % 3600) / 60);
      this.analyticsTotalTime.textContent = `${totalHours}h ${totalMins}m`;
    }
    if (this.analyticsTotalSessions) {
      this.analyticsTotalSessions.textContent = `${data.totalSessions} study session${data.totalSessions === 1 ? '' : 's'}`;
    }
    if (this.analyticsWeekTime) {
      const weekHours = Math.floor(data.weekSec / 3600);
      const weekMins = Math.round((data.weekSec % 3600) / 60);
      this.analyticsWeekTime.textContent = `${weekHours}h ${weekMins}m`;
    }
    if (this.analyticsWeekTarget) {
      this.analyticsWeekTarget.textContent = 'Week 7 Syllabus Target';
    }
    if (this.analyticsActiveDays) {
      this.analyticsActiveDays.textContent = `${data.activeDaysCount} / 7`;
    }
    if (this.analyticsTasksDone) {
      this.analyticsTasksDone.textContent = `${data.completedTasks} / ${data.totalTasks}`;
    }
    if (this.analyticsTasksRate) {
      this.analyticsTasksRate.textContent = `${data.completionRate}% completion rate`;
    }

    // 2. 7-Day Focus Trend Bar Chart
    if (this.analyticsWeeklyBars) {
      const maxDailyMins = Math.max(60, ...data.dailyTrend.map((d) => d.durationMins));
      if (this.analyticsTrendTotal) {
        this.analyticsTrendTotal.textContent = `${(data.weekSec / 3600).toFixed(1)}h total`;
      }
      this.analyticsWeeklyBars.innerHTML = data.dailyTrend.map((d) => {
        const heightPct = Math.round((d.durationMins / maxDailyMins) * 100);
        const displayVal = d.durationMins > 0 ? (d.durationMins >= 60 ? `${(d.durationMins / 60).toFixed(1)}h` : `${d.durationMins}m`) : '0m';
        return `
          <div class="weekly-bar-col ${d.isToday ? 'today' : ''}">
            <span class="weekly-bar-val">${displayVal}</span>
            <div class="weekly-bar-track">
              <div class="weekly-bar-fill" style="height: ${Math.max(4, heightPct)}%;"></div>
            </div>
            <span class="weekly-bar-label">${d.label}</span>
          </div>
        `;
      }).join('');
    }

    // 3. Subject Focus Share Breakdown
    if (this.analyticsSubjectShare) {
      if (data.subjectBreakdown.length === 0) {
        this.analyticsSubjectShare.innerHTML = `
          <div class="empty-state" style="padding: 1.25rem; font-size: 0.8rem; color: var(--text-muted); text-align: center;">
            No course study hours recorded yet.
          </div>
        `;
      } else {
        this.analyticsSubjectShare.innerHTML = data.subjectBreakdown.map((sb) => `
          <div class="subject-share-row">
            <div class="share-row-header">
              <span class="share-name">
                <span class="share-dot" style="background-color: ${sb.color};"></span>
                ${this.escapeHTML(sb.name)}
              </span>
              <span class="share-stats">${sb.durationHours}h (${sb.percentage}%)</span>
            </div>
            <div class="share-bar-track">
              <div class="share-bar-fill" style="width: ${sb.percentage}%; background-color: ${sb.color};"></div>
            </div>
          </div>
        `).join('');
      }
    }

    // 4. Activity Log
    const sessions = store.getState().sessions;
    let filtered = sessions;

    if (this.historySubjectFilter !== 'all') {
      if (this.historySubjectFilter === '') {
        filtered = filtered.filter((s) => !s.subject || s.subject === 'General');
      } else {
        filtered = filtered.filter((s) => s.subject === this.historySubjectFilter);
      }
    }

    if (!this.historyListContainer) return;

    if (filtered.length === 0) {
      this.historyListContainer.innerHTML = `
        <div class="empty-state">
          <p>No study sessions recorded for this filter.</p>
          <small>Use the timer or click "+ Log Past Study" to build your log.</small>
        </div>
      `;
      return;
    }

    this.historyListContainer.innerHTML = '';

    const groups = {};
    const todayStr = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    filtered.forEach((sess) => {
      const sDate = new Date(sess.endTime || sess.createdAt);
      let dateLabel = sDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      if (sDate.toDateString() === todayStr) {
        dateLabel = 'Today';
      } else if (sDate.toDateString() === yesterday) {
        dateLabel = 'Yesterday';
      }
      if (!groups[dateLabel]) {
        groups[dateLabel] = [];
      }
      groups[dateLabel].push(sess);
    });

    Object.entries(groups).forEach(([dateLabel, items]) => {
      const groupEl = document.createElement('div');
      groupEl.className = 'history-group';

      const totalGroupSecs = items.reduce((acc, i) => acc + (i.durationSec || 0), 0);
      const groupMins = Math.round(totalGroupSecs / 60);

      groupEl.innerHTML = `
        <div class="history-group-header">
          <span class="group-date">${dateLabel}</span>
          <span class="group-total">${groupMins} mins total</span>
        </div>
      `;

      items.forEach((sess) => {
        const color = store.getSubjectColor(sess.subject);
        const mins = Math.max(1, Math.round(sess.durationSec / 60));
        const startTimeStr = sess.startTime ? new Date(sess.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const endTimeStr = sess.endTime ? new Date(sess.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

        const card = document.createElement('div');
        card.className = 'history-card';
        card.innerHTML = `
          <div class="history-card-main">
            <div class="history-time-col">
              <span class="history-duration-pill">${mins}m</span>
              <span class="history-clock">${startTimeStr} - ${endTimeStr}</span>
            </div>
            <div class="history-details-col">
              <div class="history-title-row">
                <span class="subject-badge" style="--badge-color: ${color}">${this.escapeHTML(sess.subject || 'General')}</span>
                <strong class="history-topic">${this.escapeHTML(sess.topic || 'Focus Session')}</strong>
              </div>
              ${sess.notes ? `
                <div class="history-notes-box">
                  <div class="notes-header">Study Notes & Takeaways:</div>
                  <div class="notes-body">${this.escapeHTML(sess.notes)}</div>
                </div>
              ` : ''}
            </div>
          </div>
          <div class="history-actions">
            <button class="btn btn-icon btn-delete-history" data-id="${sess.id}" title="Delete session log">✕</button>
          </div>
        `;

        card.querySelector('.btn-delete-history').addEventListener('click', async () => {
          const ok = await this.showInAppConfirm({
            title: 'Delete Study Session',
            message: 'Delete this study session from your log?',
            confirmText: 'Delete',
            danger: true
          });
          if (ok) {
            store.deleteSession(sess.id);
            playClickSound();
          }
        });

        groupEl.appendChild(card);
      });

      this.historyListContainer.appendChild(groupEl);
    });
  }

  // --- Modals logic ---
  openFinishModal() {
    const state = timer.getState();
    const durationMins = Math.max(1, Math.round(state.elapsedSec / 60));

    this.finishModalDuration.textContent = `${durationMins} minutes (${state.formattedTime})`;
    this.finishModalSubject.textContent = state.subject;
    this.finishModalTopic.textContent = state.topic || 'General Focus Session';
    this.finishModalNotes.value = state.draftNotes || this.sessionNotesArea.value || '';

    if (state.linkedTaskId) {
      const task = store.getState().tasks.find((t) => t.id === state.linkedTaskId);
      if (task && !task.completed) {
        this.finishModalTaskCompleteGroup.style.display = 'flex';
        this.finishModalTaskName.textContent = `"${task.title}"`;
        this.finishModalTaskCheckbox.checked = true;
      } else {
        this.finishModalTaskCompleteGroup.style.display = 'none';
      }
    } else {
      this.finishModalTaskCompleteGroup.style.display = 'none';
    }

    this.finishModal.classList.add('active');
  }

  saveFinishedSession() {
    const notes = this.finishModalNotes.value.trim();
    timer.setDraftNotes(notes);

    const markTaskDone = this.finishModalTaskCheckbox.checked;
    const sessionData = timer.finishSession();

    store.addSession({
      ...sessionData,
      notes
    });

    if (sessionData.taskId && markTaskDone) {
      store.toggleTask(sessionData.taskId);
    }

    this.sessionNotesArea.value = '';
    this.finishModal.classList.remove('active');
    playClickSound();
  }

  openManualLogModal() {
    const now = new Date();
    const defaultDate = toLocalDateStr(now);
    const defaultTime = now.toTimeString().slice(0, 5);

    document.getElementById('manual-date').value = defaultDate;
    document.getElementById('manual-time').value = defaultTime;
    document.getElementById('manual-duration').value = 45;
    document.getElementById('manual-topic').value = '';
    document.getElementById('manual-notes').value = '';

    this.manualLogModal.classList.add('active');
  }

  saveManualLog() {
    const dateStr = document.getElementById('manual-date').value;
    const timeStr = document.getElementById('manual-time').value;
    const durationMins = parseInt(document.getElementById('manual-duration').value, 10) || 30;
    const subject = document.getElementById('manual-subject-select').value;
    const topic = document.getElementById('manual-topic').value.trim() || 'Offline Study';
    const notes = document.getElementById('manual-notes').value.trim();

    const end = new Date(`${dateStr}T${timeStr}:00`);
    const start = new Date(end.getTime() - durationMins * 60000);

    store.addSession({
      subject,
      topic,
      durationSec: durationMins * 60,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      notes
    });

    this.manualLogModal.classList.remove('active');
    playClickSound();
  }

  downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
