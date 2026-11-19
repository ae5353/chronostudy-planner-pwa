// src/ui/timer-view.js — Focus timer station, Horology Zen Theater, PiP widget & session modals
import { store, toLocalDateStr } from '../store.js';
import { timer } from '../timer.js';
import { playClickSound, setAmbientSound, updateAmbientVolume } from '../audio.js';
import { wakeLockManager } from '../wakelock.js';
import { openModal, closeModal, showInAppConfirm, showInAppAlert } from './modals.js';

export class TimerViewController {
  constructor(ui) {
    this.ui = ui;
  }

  initDOM() {
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
    this.timerCircleWrap = document.getElementById('timer-circle-wrap');
    this.timerProgressRing = document.getElementById('timer-progress-ring');
    this.timerCadranHandGroup = document.getElementById('timer-cadran-hand-group');
    this.timerSubdialMinHand = document.getElementById('timer-subdial-min-hand');
    this.timerSubdialSecHand = document.getElementById('timer-subdial-sec-hand');
    this.timerActiveModeLabel = document.getElementById('timer-active-mode-label');
    this.timerTargetDisplay = document.getElementById('timer-target-display');
    this.timerProgressPct = document.getElementById('timer-progress-pct');
    this.timerDigitalProgressBar = document.getElementById('timer-digital-progress-bar');

    this.btnTimerToggle = document.getElementById('btn-timer-toggle');
    this.btnTimerFinish = document.getElementById('btn-timer-finish');
    this.btnTimerReset = document.getElementById('btn-timer-reset');
    this.btnPipTimer = document.getElementById('btn-pip-timer');
    this.btnZenModeToggle = document.getElementById('btn-zen-mode');
    this.countdownCustomMins = document.getElementById('countdown-custom-mins');
    this.btnSetCustomMins = document.getElementById('btn-set-custom-mins');

    // Zen Theater elements
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

    // Notes & Ambient audio
    this.sessionNotesArea = document.getElementById('session-notes-area');
    this.ambientSoundSelect = document.getElementById('ambient-sound-select');
    this.ambientVolumeSlider = document.getElementById('ambient-volume-slider');

    // Finish Session Modal
    this.finishModal = document.getElementById('finish-session-modal');
    this.finishModalDuration = document.getElementById('finish-modal-duration');
    this.finishModalSubject = document.getElementById('finish-modal-subject');
    this.finishModalTopic = document.getElementById('finish-modal-topic');
    this.finishModalNotes = document.getElementById('finish-modal-notes');
    this.finishModalTaskCompleteGroup = document.getElementById('finish-modal-task-group');
    this.finishModalTaskCheckbox = document.getElementById('finish-modal-task-complete');
    this.finishModalTaskName = document.getElementById('finish-modal-task-name');
    this.finishModalTaskProgressWrap = document.getElementById('finish-modal-task-progress-wrap');
    this.finishModalTaskStats = document.getElementById('finish-modal-task-progress-stats');
    this.finishModalTaskDelta = document.getElementById('finish-modal-task-delta');
    this.finishModalTaskBarFill = document.getElementById('finish-modal-task-bar-fill');
    this.finishModalTaskCheckLabel = document.getElementById('finish-modal-task-check-label');
    this.btnSaveFinishedSession = document.getElementById('btn-save-finished-session');
    this.btnCancelFinishSession = document.getElementById('btn-cancel-finish-session');

    // Manual Log Modal
    this.btnLogPast = document.getElementById('btn-log-past');
    this.manualLogModal = document.getElementById('manual-log-modal');
    this.manualLogForm = document.getElementById('manual-log-form');
    this.btnCancelManualLog = document.getElementById('btn-cancel-manual-log');
  }

  bindEvents() {
    if (this.btnPipTimer) {
      this.btnPipTimer.addEventListener('click', () => {
        this.togglePiPTimer();
        playClickSound();
      });
    }

    if (this.btnSetCustomMins) {
      this.btnSetCustomMins.addEventListener('click', () => this.setCustomCountdownMinutes());
    }
    if (this.countdownCustomMins) {
      this.countdownCustomMins.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.setCustomCountdownMinutes();
        }
      });
    }

    if (this.timerModeStopwatch) {
      this.timerModeStopwatch.addEventListener('click', () => {
        if (timer.isRunning) return;
        timer.setMode('stopwatch');
        this.updateTimerModeButtons('stopwatch');
        playClickSound();
      });
    }
    if (this.timerModeCountdown) {
      this.timerModeCountdown.addEventListener('click', () => {
        if (timer.isRunning) return;
        timer.setMode('countdown');
        this.updateTimerModeButtons('countdown');
        playClickSound();
      });
    }

    if (this.countdownPresets) {
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
    }

    if (this.subjectSelect) {
      this.subjectSelect.addEventListener('change', () => {
        timer.setContext({ subject: this.subjectSelect.value });
      });
    }

    if (this.topicInput) {
      this.topicInput.addEventListener('input', () => {
        const val = this.topicInput.value;
        const norm = val.trim().toLowerCase();
        const tasks = store.getState().tasks || [];
        const currentLinkedId = timer.getState().linkedTaskId;
        const matched = norm
          ? (tasks.find((t) => !t.completed && (t.title || '').trim().toLowerCase() === norm)
            || tasks.find((t) => (t.title || '').trim().toLowerCase() === norm))
          : null;

        if (matched) {
          const matchedSubject = matched.subject || '';
          timer.setContext({ topic: val, linkedTaskId: matched.id, subject: matchedSubject });
          if (this.subjectSelect) this.subjectSelect.value = matchedSubject;
          this.renderLinkedTaskBanner(matched.id);
        } else if (currentLinkedId) {
          const curTask = tasks.find((t) => t.id === currentLinkedId);
          if (!curTask || (curTask.title || '').trim().toLowerCase() !== norm) {
            timer.setContext({ topic: val, linkedTaskId: null });
            this.renderLinkedTaskBanner(null);
          } else {
            timer.setContext({ topic: val });
          }
        } else {
          timer.setContext({ topic: val });
        }

        if (this.zenTopicDisplay) {
          this.zenTopicDisplay.textContent = val || 'Focus Session';
        }
      });
    }

    if (this.btnUnlinkTask) {
      this.btnUnlinkTask.addEventListener('click', () => {
        timer.setContext({ linkedTaskId: null });
        this.renderLinkedTaskBanner(null);
        playClickSound();
      });
    }

    if (this.btnTimerToggle) {
      this.btnTimerToggle.addEventListener('click', () => {
        timer.toggle();
        playClickSound();
      });
    }
    if (this.btnTimerReset) {
      this.btnTimerReset.addEventListener('click', async () => {
        const ok = await showInAppConfirm({
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
    }
    if (this.btnTimerFinish) {
      this.btnTimerFinish.addEventListener('click', () => {
        this.openFinishModal();
        playClickSound();
      });
    }

    // Zen Theater Controls
    if (this.btnZenModeToggle) {
      this.btnZenModeToggle.addEventListener('click', () => {
        timer.toggleZenMode(true);
        playClickSound();
      });
    }
    if (this.btnExitZen) {
      this.btnExitZen.addEventListener('click', () => {
        timer.toggleZenMode(false);
        playClickSound();
      });
    }
    if (this.btnZenTimerToggle) {
      this.btnZenTimerToggle.addEventListener('click', () => {
        timer.toggle();
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
        const parsedVol = parseFloat(this.ambientVolumeSlider?.value ?? '0.5');
        const vol = Number.isNaN(parsedVol) ? 0.5 : parsedVol;
        if (this.ambientSoundSelect) this.ambientSoundSelect.value = sound;
        store.updateSettings({ ambientSound: sound });
        setAmbientSound(sound, vol);
        playClickSound();
      });
    }
    if (this.btnFullscreen) {
      this.btnFullscreen.addEventListener('click', async () => {
        try {
          if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
          else await document.exitFullscreen();
        } catch (e) {}
        wakeLockManager.update();
      });
    }

    if (this.sessionNotesArea) {
      this.sessionNotesArea.addEventListener('input', () => {
        timer.setDraftNotes(this.sessionNotesArea.value);
      });
    }

    if (this.ambientSoundSelect) {
      this.ambientSoundSelect.addEventListener('change', () => {
        const sound = this.ambientSoundSelect.value;
        const parsedVol = parseFloat(this.ambientVolumeSlider?.value ?? '0.5');
        const vol = Number.isNaN(parsedVol) ? 0.5 : parsedVol;
        store.updateSettings({ ambientSound: sound });
        setAmbientSound(sound, vol);
      });
    }
    if (this.ambientVolumeSlider) {
      this.ambientVolumeSlider.addEventListener('input', () => {
        const parsedVol = parseFloat(this.ambientVolumeSlider.value);
        const vol = Number.isNaN(parsedVol) ? 0.5 : parsedVol;
        store.updateSettings({ volume: vol });
        updateAmbientVolume(vol);
      });
    }

    // Finish Session Modal
    if (this.finishModalTaskCompleteGroup && this.finishModalTaskCheckbox) {
      this.finishModalTaskCompleteGroup.addEventListener('click', (e) => {
        if (e.target !== this.finishModalTaskCheckbox) {
          this.finishModalTaskCheckbox.checked = !this.finishModalTaskCheckbox.checked;
        }
      });
    }
    if (this.btnCancelFinishSession) {
      this.btnCancelFinishSession.addEventListener('click', () => {
        closeModal(this.finishModal);
      });
    }
    if (this.btnSaveFinishedSession) {
      this.btnSaveFinishedSession.addEventListener('click', () => this.saveFinishedSession());
    }
    if (this.finishModal) {
      this.finishModal.addEventListener('click', (e) => {
        if (e.target === this.finishModal) closeModal(this.finishModal);
      });
    }

    // Manual Log Modal
    if (this.btnLogPast) {
      this.btnLogPast.addEventListener('click', () => {
        this.openManualLogModal();
        playClickSound();
      });
    }
    if (this.btnCancelManualLog) {
      this.btnCancelManualLog.addEventListener('click', () => {
        closeModal(this.manualLogModal);
      });
    }
    if (this.manualLogModal) {
      this.manualLogModal.addEventListener('click', (e) => {
        if (e.target === this.manualLogModal) closeModal(this.manualLogModal);
      });
    }
    if (this.manualLogForm) {
      this.manualLogForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveManualLog();
      });
    }
  }

  updateTimerModeButtons(mode) {
    if (this.timerModeStopwatch) this.timerModeStopwatch.classList.toggle('active', mode === 'stopwatch');
    if (this.timerModeCountdown) this.timerModeCountdown.classList.toggle('active', mode === 'countdown');
    if (this.countdownPresets) this.countdownPresets.style.display = mode === 'countdown' ? 'flex' : 'none';
  }

  updatePresetButtons(activeMins) {
    if (!this.countdownPresets) return;
    this.countdownPresets.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.classList.toggle('active', parseInt(btn.dataset.mins, 10) === activeMins);
    });
  }

  setCustomCountdownMinutes() {
    if (!this.countdownCustomMins) return;
    const val = parseInt(this.countdownCustomMins.value, 10);
    if (!isNaN(val) && val > 0 && val <= 720) {
      timer.setTargetMinutes(val);
      document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('active'));
      playClickSound();
    }
  }

  renderInitialState() {
    const timerState = timer.getState();
    this.updateTimerModeButtons(timerState.mode);
    if (this.sessionNotesArea) this.sessionNotesArea.value = timerState.draftNotes || '';
    if (this.topicInput) this.topicInput.value = timerState.topic || '';
    if (this.subjectSelect) this.subjectSelect.value = timerState.subject || '';
    this.renderLinkedTaskBanner(timerState.linkedTaskId);
    this.renderZenMode(timerState.isZenMode, timerState);
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

    if (this.timerActiveModeLabel) {
      const modeText = state.mode === 'countdown' ? 'COUNTDOWN' : 'STOPWATCH';
      if (this._lastActiveModeText !== modeText) {
        this.timerActiveModeLabel.textContent = modeText;
        this._lastActiveModeText = modeText;
      }
    }

    if (this.timerTargetDisplay) {
      let targetText = 'Open Study Session';
      if (state.topic) targetText = state.topic;
      else if (state.mode === 'countdown') {
        const targetMins = Math.round((state.targetSec || 0) / 60);
        targetText = `${targetMins}m Focus Block`;
      }
      if (this._lastTargetText !== targetText) {
        this.timerTargetDisplay.textContent = targetText;
        this._lastTargetText = targetText;
      }
    }

    if (this.timerProgressPct) {
      const pctText = state.mode === 'countdown'
        ? `${Math.min(100, Math.round(state.progress * 100))}%`
        : `${Math.floor(state.elapsedSec / 60)}m elapsed`;
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
      const pct = state.mode === 'countdown'
        ? Math.min(100, Math.round(state.progress * 100))
        : Math.min(100, Math.round(((state.elapsedSec % 60) / 60) * 100));
      const pctStr = `${pct}%`;
      if (this._lastProgressBarWidth !== pctStr) {
        this.timerDigitalProgressBar.style.width = pctStr;
        this._lastProgressBarWidth = pctStr;
      }
    }

    const isRunning = state.isRunning;
    const isZero = state.elapsedSec === 0;
    if (this.btnTimerToggle && (this._lastBtnRunning !== isRunning || this._lastBtnZero !== isZero)) {
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
    if (this.btnTimerFinish && this.btnTimerFinish.disabled !== !canFinish) {
      this.btnTimerFinish.disabled = !canFinish;
    }
    const canReset = !(state.elapsedSec === 0 && !state.isRunning);
    if (this.btnTimerReset && this.btnTimerReset.disabled !== !canReset) {
      this.btnTimerReset.disabled = !canReset;
    }

    if (this.timerProgressRing) {
      const circumference = 2 * Math.PI * 126;
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

    if (this.timerCadranHandGroup) {
      const angle = state.mode === 'countdown' ? (state.progress * 360) : (state.elapsedSec * 6);
      if (this._lastCadranAngle !== angle) {
        this.timerCadranHandGroup.style.transform = `rotate(${angle}deg)`;
        this._lastCadranAngle = angle;
      }
    }

    if (this.timerSubdialMinHand) {
      const minAngle = state.mode === 'countdown' ? (state.progress * 360) : ((state.elapsedSec / 1800) * 360);
      if (this._lastSubdialMinAngle !== minAngle) {
        this.timerSubdialMinHand.style.transform = `rotate(${minAngle}deg)`;
        this._lastSubdialMinAngle = minAngle;
      }
    }

    if (this.timerSubdialSecHand) {
      const secAngle = state.elapsedSec * 6;
      if (this._lastSubdialSecAngle !== secAngle) {
        this.timerSubdialSecHand.style.transform = `rotate(${secAngle}deg)`;
        this._lastSubdialSecAngle = secAngle;
      }
    }

    if (typeof document !== 'undefined' && document.pictureInPictureElement) {
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
      if (zenOverlay) zenOverlay.style.display = isZen ? 'flex' : 'none';
    }

    if (!isZen) return;
    const zenOverlay = document.getElementById('zen-overlay-container');
    const zenNotes = document.getElementById('zen-notes-area');
    if (!zenOverlay) return;

    if (this.zenTimerDigits && this._lastZenDigits !== state.formattedTime) {
      this.zenTimerDigits.textContent = state.formattedTime;
      this._lastZenDigits = state.formattedTime;
    }

    const color = store.getSubjectColor(state.subject);
    if (this.zenSubjectBadge) {
      this.zenSubjectBadge.textContent = state.subject || 'General Study';
      this.zenSubjectBadge.style.backgroundColor = `${color}25`;
      this.zenSubjectBadge.style.color = color;
      this.zenSubjectBadge.style.borderColor = color;
    }
    if (this.zenTopicDisplay) {
      this.zenTopicDisplay.textContent = state.topic || 'Deep Focus Session';
    }

    if (this.zenLinkedTaskBadge) {
      const task = state.linkedTaskId ? store.getState().tasks.find((t) => t.id === state.linkedTaskId) : null;
      if (task) {
        this.zenLinkedTaskBadge.style.display = 'inline-block';
        this.zenLinkedTaskBadge.textContent = task.title;
      } else {
        this.zenLinkedTaskBadge.style.display = 'none';
      }
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
    if (this.zenStateBadge) {
      this.zenStateBadge.textContent = badgeText;
      this.zenStateBadge.className = `timer-state-badge ${badgeClass}`;
    }
    if (this.zenActiveModeLabel) {
      this.zenActiveModeLabel.textContent = state.mode === 'countdown' ? 'COUNTDOWN' : 'STOPWATCH';
    }
    if (this.zenTargetDisplay) {
      if (state.topic) this.zenTargetDisplay.textContent = state.topic;
      else if (state.mode === 'countdown') this.zenTargetDisplay.textContent = `${Math.round((state.targetSec || 0) / 60)}m Focus Block`;
      else this.zenTargetDisplay.textContent = 'Open Study Session';
    }
    if (this.zenProgressPct) {
      this.zenProgressPct.textContent = state.mode === 'countdown'
        ? `${Math.min(100, Math.round(state.progress * 100))}%`
        : `${Math.floor(state.elapsedSec / 60)}m elapsed`;
    }
    if (this.zenDigitalProgressBar) {
      this.zenDigitalProgressBar.style.backgroundColor = color;
      if (state.mode === 'countdown') {
        this.zenDigitalProgressBar.style.width = `${Math.min(100, Math.round(state.progress * 100))}%`;
      } else {
        const secInMin = state.elapsedSec % 60;
        if (secInMin === 0 && state.elapsedSec > 0) {
          this.zenDigitalProgressBar.style.transition = 'none';
          this.zenDigitalProgressBar.style.width = '0%';
          requestAnimationFrame(() => {
            if (this.zenDigitalProgressBar) this.zenDigitalProgressBar.style.transition = '';
          });
        } else {
          this.zenDigitalProgressBar.style.width = `${Math.min(100, Math.round((secInMin / 60) * 100))}%`;
        }
      }
    }
    if (this.zenProgressRing) {
      const circumference = 2 * Math.PI * 126;
      if (!this._zenRingDashSet) {
        this.zenProgressRing.style.strokeDasharray = `${circumference} ${circumference}`;
        this._zenRingDashSet = true;
      }
      this.zenProgressRing.style.strokeDashoffset = state.mode === 'countdown' ? circumference * (1 - state.progress) : circumference;
      if (this._lastZenRingStroke !== color) {
        this.zenProgressRing.style.stroke = color;
        this._lastZenRingStroke = color;
      }
    }
    if (this.zenCadranHandGroup) {
      const angle = state.mode === 'countdown' ? (state.progress * 360) : (state.elapsedSec * 6);
      this.zenCadranHandGroup.style.transform = `rotate(${angle}deg)`;
    }
    if (this.zenSubdialMinHand) {
      const minAngle = state.mode === 'countdown' ? (state.progress * 360) : ((state.elapsedSec / 1800) * 360);
      this.zenSubdialMinHand.style.transform = `rotate(${minAngle}deg)`;
    }
    if (this.zenSubdialSecHand) {
      this.zenSubdialSecHand.style.transform = `rotate(${state.elapsedSec * 6}deg)`;
    }

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
    if (this.btnZenFinishSession) this.btnZenFinishSession.disabled = state.elapsedSec < 5;
    if (this.btnZenResetTimer) this.btnZenResetTimer.disabled = state.elapsedSec === 0 && !state.isRunning;

    if (this.zenSoundscapeSelect) {
      const currentSound = store.getState().settings.ambientSound || 'none';
      if (this.zenSoundscapeSelect.value !== currentSound) {
        this.zenSoundscapeSelect.value = currentSound;
      }
    }
    if (zenNotes && document.activeElement !== zenNotes) {
      zenNotes.value = state.draftNotes || this.sessionNotesArea?.value || '';
    }
    if (zenNotes && !zenNotes.dataset.bound) {
      zenNotes.dataset.bound = 'true';
      zenNotes.addEventListener('input', () => {
        if (this.sessionNotesArea) this.sessionNotesArea.value = zenNotes.value;
        timer.setDraftNotes(zenNotes.value);
      });
    }
  }

  renderLinkedTaskBanner(taskId) {
    if (!this.linkedTaskBanner) return;
    if (!taskId) {
      this.linkedTaskBanner.style.display = 'none';
      return;
    }
    const task = store.getState().tasks.find((t) => t.id === taskId);
    if (!task) {
      this.linkedTaskBanner.style.display = 'none';
      return;
    }
    const timeLoggedMins = Math.round((task.timeSpentSec || 0) / 60);
    let progressSuffix = '';
    if (task.targetMinutes) {
      const pct = Math.min(100, Math.round((timeLoggedMins / task.targetMinutes) * 100));
      progressSuffix = ` • ${timeLoggedMins}/${task.targetMinutes}m (${pct}%)`;
    } else if (timeLoggedMins > 0) {
      progressSuffix = ` • ${timeLoggedMins}m studied`;
    }
    if (this.linkedTaskTitle) this.linkedTaskTitle.textContent = `${task.title}${progressSuffix}`;
    this.linkedTaskBanner.style.display = 'flex';
  }

  async togglePiPTimer() {
    if (!('pictureInPictureEnabled' in document) || !document.pictureInPictureEnabled) {
      await showInAppAlert({
        title: 'Picture-in-Picture Unsupported',
        message: 'Picture-in-Picture floating timer is not supported or permitted by this browser.'
      });
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
        this.pipVideo.addEventListener('leavepictureinpicture', () => {
          if (this.pipVideo && this.pipVideo.srcObject) {
            this.pipVideo.srcObject.getTracks().forEach((t) => t.stop());
            this.pipVideo.srcObject = null;
          }
        });
      }
      if (!this.pipVideo.srcObject) {
        this.pipVideo.srcObject = this.pipCanvas.captureStream(2);
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
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, w, h);

    const subColor = store.getSubjectColor(state.subject) || '#3b82f6';
    ctx.strokeStyle = subColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(3, 3, w - 6, h - 6);

    ctx.fillStyle = '#8b949e';
    ctx.font = '600 12px system-ui, -apple-system, sans-serif';
    ctx.fillText((state.mode === 'countdown' ? 'COUNTDOWN' : 'STOPWATCH') + ' • CHRONOSTUDY', 18, 28);

    ctx.fillStyle = subColor;
    ctx.font = '700 14px system-ui, -apple-system, sans-serif';
    ctx.fillText((state.subject || 'Focus Session').slice(0, 26), 18, 52);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 46px monospace, ui-monospace';
    ctx.fillText(state.formattedTime || '00:00', 18, 110);

    const statusText = state.isRunning ? '● FOCUSING' : (state.elapsedSec > 0 ? '❚❚ PAUSED' : '○ READY');
    ctx.fillStyle = state.isRunning ? '#238636' : (state.elapsedSec > 0 ? '#d29922' : '#6e7681');
    ctx.font = '700 12px system-ui, -apple-system, sans-serif';
    ctx.fillText(statusText, 18, 140);

    if (state.mode === 'countdown') {
      const p = Math.max(0, Math.min(1, state.progress || 0));
      ctx.fillStyle = '#212631';
      ctx.fillRect(18, 156, w - 36, 12);
      ctx.fillStyle = subColor;
      ctx.fillRect(18, 156, (w - 36) * p, 12);
    }
  }

  openFinishModal() {
    if (!this.finishModal) return;
    const state = timer.getState();
    const durationMins = Math.max(1, Math.round(state.elapsedSec / 60));

    this.finishModalDuration.textContent = `${durationMins} minutes (${state.formattedTime})`;
    this.finishModalSubject.textContent = state.subject || 'General';
    this.finishModalTopic.textContent = state.topic || 'General Focus Session';
    this.finishModalNotes.value = state.draftNotes || this.sessionNotesArea?.value || '';

    if (state.linkedTaskId) {
      const task = store.getState().tasks.find((t) => t.id === state.linkedTaskId);
      if (task && !task.completed) {
        this.finishModalTaskCompleteGroup.style.display = 'flex';
        this.finishModalTaskName.textContent = task.title;

        const sessStats = store.getTaskSessionStats(task);
        const priorSec = Math.max(task.timeSpentSec || 0, sessStats.totalSec || 0);
        const nextSessionNum = sessStats.sessionCount + 1;
        const newTotalMins = Math.round((priorSec + state.elapsedSec) / 60);

        if (task.targetMinutes) {
          const targetMins = task.targetMinutes;
          const progressPct = Math.round((newTotalMins / targetMins) * 100);
          const isTargetMet = newTotalMins >= targetMins;

          if (this.finishModalTaskProgressWrap) {
            this.finishModalTaskProgressWrap.style.display = 'block';
            if (this.finishModalTaskStats) this.finishModalTaskStats.textContent = `Session #${nextSessionNum} · ${newTotalMins}m / ${targetMins}m (${progressPct}%)`;
            if (this.finishModalTaskDelta) this.finishModalTaskDelta.textContent = `+${durationMins}m this session`;
            if (this.finishModalTaskBarFill) {
              this.finishModalTaskBarFill.style.width = `${Math.min(100, progressPct)}%`;
              this.finishModalTaskBarFill.classList.toggle('bar-complete', isTargetMet);
            }
          }
          if (this.finishModalTaskCheckLabel) {
            this.finishModalTaskCheckLabel.textContent = isTargetMet
              ? `Target reached (${progressPct}%)! Mark task as fully completed?`
              : 'Mark task as completed? (Leave unchecked to keep in progress for more sessions)';
          }
          this.finishModalTaskCheckbox.checked = isTargetMet;
        } else {
          if (this.finishModalTaskProgressWrap) {
            this.finishModalTaskProgressWrap.style.display = 'block';
            if (this.finishModalTaskStats) this.finishModalTaskStats.textContent = `Session #${nextSessionNum} · Total studied: ${newTotalMins}m`;
            if (this.finishModalTaskDelta) this.finishModalTaskDelta.textContent = `+${durationMins}m this session`;
            if (this.finishModalTaskBarFill) {
              this.finishModalTaskBarFill.style.width = '100%';
              this.finishModalTaskBarFill.classList.remove('bar-complete');
            }
          }
          if (this.finishModalTaskCheckLabel) {
            this.finishModalTaskCheckLabel.textContent = 'Mark task as completed? (Leave unchecked to keep in progress)';
          }
          this.finishModalTaskCheckbox.checked = false;
        }
      } else {
        this.finishModalTaskCompleteGroup.style.display = 'none';
      }
    } else {
      this.finishModalTaskCompleteGroup.style.display = 'none';
    }

    openModal(this.finishModal);
  }

  saveFinishedSession() {
    const notes = this.finishModalNotes.value.trim();
    timer.setDraftNotes(notes);
    const markTaskDone = this.finishModalTaskCheckbox.checked;
    const sessionData = timer.finishSession();

    store.addSession({ ...sessionData, notes });

    if (sessionData.taskId && markTaskDone) {
      store.toggleTask(sessionData.taskId);
    }

    if (this.sessionNotesArea) this.sessionNotesArea.value = '';
    if (this.topicInput) this.topicInput.value = '';
    if (this.subjectSelect) this.subjectSelect.value = '';
    this.renderLinkedTaskBanner(null);
    closeModal(this.finishModal);
    playClickSound();
  }

  openManualLogModal() {
    if (!this.manualLogModal) return;
    const now = new Date();
    document.getElementById('manual-date').value = toLocalDateStr(now);
    document.getElementById('manual-time').value = now.toTimeString().slice(0, 5);
    document.getElementById('manual-duration').value = 45;
    document.getElementById('manual-topic').value = '';
    document.getElementById('manual-notes').value = '';
    openModal(this.manualLogModal);
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

    closeModal(this.manualLogModal);
    playClickSound();
  }
}
