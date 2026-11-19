// src/ui/planner-view.js — Week/Month Planner, Class Lectures, Schedule Manager, GCal & Backlog (delegated)
import { store, toLocalDateStr } from '../store.js';
import { getRecurrenceLabel, doesWeeklyEventOccurOnDate } from '../domain/recurrence.js';
import { playClickSound } from '../audio.js';
import { escapeHTML, sanitizeCssColor, downloadFile } from './dom-utils.js';
import { openModal, closeModal, showInAppConfirm, showInAppPrompt } from './modals.js';

export function renderDayClassLecturesHTML(dayOfWeek, dateStr = null, { sanitizeColorFn = sanitizeCssColor, escapeFn = escapeHTML } = {}) {
  const state = store.getState();
  const subjects = state.subjects || [];
  const weeklyEvents = state.weeklyEvents || [];
  const groupsOrder = Array.isArray(state.groups) ? state.groups : [];

  const categoriesMap = new Map();
  const seenKeys = new Set();

  const pushBucketItem = (catName, item) => {
    const cleanName = (catName || 'Courses').trim();
    const dedupKey = `${(item.code || '').trim().toLowerCase()}|${item.start || ''}|${item.end || ''}`;
    if (seenKeys.has(dedupKey)) return;
    seenKeys.add(dedupKey);
    if (!categoriesMap.has(cleanName)) categoriesMap.set(cleanName, []);
    categoriesMap.get(cleanName).push(item);
  };

  subjects.forEach((s) => {
    if (Array.isArray(s.schedule)) {
      s.schedule.forEach((slot, slotIdx) => {
        if (slot.day === dayOfWeek) {
          pushBucketItem(s.group || 'Courses', {
            type: 'lecture',
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

  weeklyEvents.forEach((ev) => {
    if (!doesWeeklyEventOccurOnDate(ev, dayOfWeek, dateStr)) return;
    const rec = ev.recurrence || 'weekly';
    let cadenceBadge = '';
    if (rec === 'biweekly') cadenceBadge = '<span class="cadence-pill">Bi-weekly</span>';
    else if (rec === 'triweekly') cadenceBadge = '<span class="cadence-pill">Tri-weekly</span>';
    else if (rec === 'monthly') cadenceBadge = '<span class="cadence-pill">Monthly</span>';
    else if (rec === 'weekdays') cadenceBadge = '<span class="cadence-pill">Weekdays</span>';
    else if (rec === 'daily') cadenceBadge = '<span class="cadence-pill">Daily</span>';

    pushBucketItem(ev.category || 'Events', {
      type: 'wevent',
      id: ev.id,
      code: ev.title,
      cadenceBadge,
      name: ev.notes || ev.title,
      color: ev.color || '#059669',
      start: ev.start,
      end: ev.end
    });
  });

  if (categoriesMap.size === 0) return '';

  const sortedCategories = Array.from(categoriesMap.keys()).sort((a, b) => {
    const idxA = groupsOrder.indexOf(a);
    const idxB = groupsOrder.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  let html = '';
  sortedCategories.forEach((categoryName, idx) => {
    const items = categoriesMap.get(categoryName);
    if (!items || items.length === 0) return;
    items.sort((a, b) => a.start.localeCompare(b.start));

    const marginTop = idx > 0 ? 'margin-top: 0.4rem;' : '';
    html += `
      <div class="day-classes-container" style="${marginTop}">
        <span class="day-section-sub">${escapeFn(categoryName)}:</span>
        <div class="day-classes-list">
          ${items.map((c) => {
            const safeColor = sanitizeColorFn(c.color, '#059669');
            if (c.type === 'lecture') {
              return `
                <div class="day-class-chip itu-lecture-chip" data-subject-id="${escapeFn(c.subjectId)}" data-slot-index="${c.slotIndex}" style="--class-color: ${safeColor};" title="${escapeFn(c.name)} (${escapeFn(c.start)} - ${escapeFn(c.end)}) — Click to arrange">
                  <div class="class-chip-top">
                    <span class="class-code">${escapeFn(c.code)}</span>
                    <span class="chip-edit-icon" title="Edit lecture time">✎</span>
                  </div>
                  <div class="class-chip-sub">
                    <span class="class-time">${escapeFn(c.start)} - ${escapeFn(c.end)}</span>
                  </div>
                </div>
              `;
            }
            return `
              <div class="day-class-chip seminar-chip wevent-chip" data-event-id="${escapeFn(c.id)}" style="--class-color: ${safeColor};" title="${escapeFn(c.name)} (${escapeFn(c.start)} - ${escapeFn(c.end)}) — Click to arrange">
                <div class="class-chip-top">
                  <span class="class-code">${escapeFn(c.code)}</span>
                  <span class="chip-edit-icon" title="Edit event">✎</span>
                </div>
                <div class="class-chip-sub">
                  <span class="class-time">${escapeFn(c.start)} - ${escapeFn(c.end)}</span>
                  ${c.cadenceBadge || ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  });

  return html;
}

export class PlannerViewController {
  constructor(ui) {
    this.ui = ui;
    this.calendarViewMode = 'week';
    this.calendarAnchorDate = new Date();
    this.calendarSubjectFilter = 'all';
    this.expandedPlannerTasks = new Set();
  }

  initDOM() {
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
    this.btnOpenAddWeeklyEventSub = document.getElementById('btn-open-add-weekly-event-sub');
    this.btnGCalSync = document.getElementById('btn-gcal-sync');
    this.gcalModal = document.getElementById('gcal-modal');
    this.btnDownloadIcs = document.getElementById('btn-download-ics');
    this.btnCloseGcalModal = document.getElementById('btn-close-gcal-modal');

    this.weeklyEventModal = document.getElementById('weekly-event-modal');
    this.weeklyEventForm = document.getElementById('weekly-event-form');
    this.btnCancelWevent = document.getElementById('btn-cancel-wevent');
    this.weventModalTitle = document.getElementById('wevent-modal-title');
    this.weventEditId = document.getElementById('wevent-edit-id');
    this.weventRecurrenceSelect = document.getElementById('wevent-recurrence-select');
    this.weventDayGroup = document.getElementById('wevent-day-group');
    this.btnDeleteWevent = document.getElementById('btn-delete-wevent');

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

    this.btnManageSchedule = document.getElementById('btn-manage-schedule');
    this.btnManageScheduleSub = document.getElementById('btn-manage-schedule-sub');
    this.scheduleManagerModal = document.getElementById('schedule-manager-modal');
    this.btnCloseScheduleManager = document.getElementById('btn-close-schedule-manager');
    this.btnMgrAddWevent = document.getElementById('btn-mgr-add-wevent');
    this.scheduleManagerList = document.getElementById('schedule-manager-list');
  }

  bindEvents() {
    if (this.calModeWeekBtn) {
      this.calModeWeekBtn.addEventListener('click', () => {
        this.calendarViewMode = 'week';
        this.calModeWeekBtn.classList.add('active');
        this.calModeMonthBtn?.classList.remove('active');
        this.renderCalendar();
        playClickSound();
      });
    }
    if (this.calModeMonthBtn) {
      this.calModeMonthBtn.addEventListener('click', () => {
        this.calendarViewMode = 'month';
        this.calModeMonthBtn.classList.add('active');
        this.calModeWeekBtn?.classList.remove('active');
        this.renderCalendar();
        playClickSound();
      });
    }
    if (this.calPrevBtn) {
      this.calPrevBtn.addEventListener('click', () => {
        if (this.calendarViewMode === 'week') this.calendarAnchorDate.setDate(this.calendarAnchorDate.getDate() - 7);
        else this.calendarAnchorDate.setMonth(this.calendarAnchorDate.getMonth() - 1);
        this.renderCalendar();
        playClickSound();
      });
    }
    if (this.calNextBtn) {
      this.calNextBtn.addEventListener('click', () => {
        if (this.calendarViewMode === 'week') this.calendarAnchorDate.setDate(this.calendarAnchorDate.getDate() + 7);
        else this.calendarAnchorDate.setMonth(this.calendarAnchorDate.getMonth() + 1);
        this.renderCalendar();
        playClickSound();
      });
    }
    if (this.calTodayBtn) {
      this.calTodayBtn.addEventListener('click', () => {
        this.calendarAnchorDate = new Date();
        this.renderCalendar();
        playClickSound();
      });
    }
    if (this.calSubjectFilter) {
      this.calSubjectFilter.addEventListener('change', () => {
        this.calendarSubjectFilter = this.calSubjectFilter.value;
        this.renderCalendar();
      });
    }

    // Event delegation for Calendar Grid (Week + Month)
    if (this.calendarViewContainer) {
      this.calendarViewContainer.addEventListener('click', async (e) => {
        const expandEl = e.target.closest('[data-expand-toggle]');
        if (expandEl) {
          e.stopPropagation();
          const key = expandEl.dataset.expandToggle;
          if (!key) return;
          const card = expandEl.closest('.cal-task-item');
          const details = card?.querySelector('.cal-task-details-dropdown');
          const chevron = card?.querySelector('.cal-dropdown-chevron');
          const btn = card?.querySelector('.btn-cal-dropdown');
          if (this.expandedPlannerTasks.has(key)) {
            this.expandedPlannerTasks.delete(key);
            card?.classList.remove('expanded');
            if (details) details.style.display = 'none';
            if (chevron) chevron.textContent = '▸';
            if (btn) btn.setAttribute('aria-expanded', 'false');
          } else {
            this.expandedPlannerTasks.add(key);
            card?.classList.add('expanded');
            if (details) details.style.display = 'flex';
            if (chevron) chevron.textContent = '▾';
            if (btn) btn.setAttribute('aria-expanded', 'true');
          }
          playClickSound();
          return;
        }

        const checkBtn = e.target.closest('.btn-cal-check');
        if (checkBtn) {
          store.toggleTaskForDate(checkBtn.dataset.taskId, checkBtn.dataset.date);
          playClickSound();
          return;
        }

        const moveBtn = e.target.closest('.btn-cal-move-today');
        if (moveBtn) {
          store.updateTask(moveBtn.dataset.taskId, { dueDate: toLocalDateStr(new Date()) });
          playClickSound();
          return;
        }

        const editBtn = e.target.closest('.btn-cal-edit');
        if (editBtn) {
          this.ui.tasksView.openTaskEditModal(editBtn.dataset.taskId);
          playClickSound();
          return;
        }

        const delBtn = e.target.closest('.btn-cal-delete');
        if (delBtn) {
          const ok = await showInAppConfirm({
            title: 'Delete Task',
            message: 'Are you sure you want to delete this study task?',
            confirmText: 'Delete',
            danger: true
          });
          if (ok) {
            store.deleteTask(delBtn.dataset.taskId);
            playClickSound();
          }
          return;
        }

        const studyBtn = e.target.closest('.btn-cal-study');
        if (studyBtn) {
          const task = store.getState().tasks.find((t) => t.id === studyBtn.dataset.taskId);
          if (task) {
            this.ui.startTaskStudySession(task);
            playClickSound();
          }
          return;
        }

        const addDayBtn = e.target.closest('.btn-add-day-task');
        if (addDayBtn) {
          const targetDate = addDayBtn.dataset.date;
          const title = await showInAppPrompt({
            title: `Add Task for ${targetDate}`,
            message: 'What study topic or problem set do you want to plan for this day?',
            placeholder: 'e.g. Chapter 6 Problem Set',
            confirmText: 'Add Task'
          });
          if (title && title.trim()) {
            const subjSelect = this.ui.timerView?.subjectSelect;
            const selectedSubj = (this.calSubjectFilter && this.calSubjectFilter.value !== 'all')
              ? this.calSubjectFilter.value
              : (subjSelect ? subjSelect.value : null);
            store.addTask({ title: title.trim(), subject: selectedSubj || null, targetMinutes: null, dueDate: targetDate });
            playClickSound();
          }
          return;
        }

        const lecChip = e.target.closest('.itu-lecture-chip');
        if (lecChip) {
          this.openLectureSlotModal(lecChip.dataset.subjectId, parseInt(lecChip.dataset.slotIndex, 10));
          playClickSound();
          return;
        }

        const evChip = e.target.closest('.wevent-chip');
        if (evChip) {
          this.openWeeklyEventModal(evChip.dataset.eventId);
          playClickSound();
          return;
        }

        const monthCell = e.target.closest('.month-day-cell:not(.empty-cell)');
        if (monthCell) {
          this.openDayInspector(monthCell.dataset.date);
          playClickSound();
        }
      });
    }

    // Event delegation for Backlog Shelf
    if (this.backlogTasksContainer) {
      this.backlogTasksContainer.addEventListener('click', async (e) => {
        const studyBtn = e.target.closest('.btn-study-backlog');
        if (studyBtn) {
          const t = store.getState().tasks.find((x) => x.id === studyBtn.dataset.id);
          if (t) {
            this.ui.startTaskStudySession(t);
            playClickSound();
          }
          return;
        }

        const editBtn = e.target.closest('.btn-edit-backlog');
        if (editBtn) {
          this.ui.tasksView.openTaskEditModal(editBtn.dataset.id);
          playClickSound();
          return;
        }

        const titleEl = e.target.closest('.backlog-task-title');
        if (titleEl) {
          const card = titleEl.closest('.backlog-task-card');
          const taskId = card?.dataset.taskId;
          if (taskId) this.ui.tasksView.openTaskEditModal(taskId);
          return;
        }

        const schedBtn = e.target.closest('.btn-schedule-backlog');
        if (schedBtn) {
          const t = store.getState().tasks.find((x) => x.id === schedBtn.dataset.id);
          if (!t) return;
          const pickedDate = await showInAppPrompt({
            title: 'Schedule Study Task',
            message: `Assign "${t.title}" to a study date:`,
            defaultValue: toLocalDateStr(new Date()),
            placeholder: 'YYYY-MM-DD',
            confirmText: 'Schedule'
          });
          if (pickedDate && pickedDate.trim()) {
            store.updateTask(t.id, { dueDate: pickedDate.trim() });
            playClickSound();
          }
          return;
        }

        const delBtn = e.target.closest('.btn-del-backlog');
        if (delBtn) {
          const t = store.getState().tasks.find((x) => x.id === delBtn.dataset.id);
          if (!t) return;
          const ok = await showInAppConfirm({
            title: 'Delete Task',
            message: `Delete "${t.title}"?`,
            confirmText: 'Delete',
            danger: true
          });
          if (ok) {
            store.deleteTask(t.id);
            playClickSound();
          }
        }
      });
    }

    // Google Calendar Sync Modal
    if (this.btnGCalSync) {
      this.btnGCalSync.addEventListener('click', () => {
        openModal(this.gcalModal);
        playClickSound();
      });
    }
    if (this.btnCloseGcalModal) {
      this.btnCloseGcalModal.addEventListener('click', () => closeModal(this.gcalModal));
    }
    if (this.gcalModal) {
      this.gcalModal.addEventListener('click', (e) => {
        if (e.target === this.gcalModal) closeModal(this.gcalModal);
      });
    }
    if (this.btnDownloadIcs) {
      this.btnDownloadIcs.addEventListener('click', () => {
        downloadFile(store.generateICS(), `chronostudy-schedule-${toLocalDateStr(new Date())}.ics`, 'text/calendar');
      });
    }

    // Weekly Event Modal
    const openWeventHandler = () => {
      this.openWeeklyEventModal(null);
      playClickSound();
    };
    if (this.btnOpenWeeklyEventModal) this.btnOpenWeeklyEventModal.addEventListener('click', openWeventHandler);
    if (this.btnOpenAddWeeklyEventSub) this.btnOpenAddWeeklyEventSub.addEventListener('click', openWeventHandler);
    if (this.btnCancelWevent) {
      this.btnCancelWevent.addEventListener('click', () => closeModal(this.weeklyEventModal));
    }
    if (this.weeklyEventModal) {
      this.weeklyEventModal.addEventListener('click', (e) => {
        if (e.target === this.weeklyEventModal) closeModal(this.weeklyEventModal);
      });
    }
    if (this.btnDeleteWevent) {
      this.btnDeleteWevent.addEventListener('click', async () => {
        const id = this.weventEditId?.value;
        if (!id) return;
        const ok = await showInAppConfirm({
          title: 'Delete Recurring Event',
          message: 'Are you sure you want to delete this recurring weekly event?',
          confirmText: 'Delete',
          danger: true
        });
        if (ok) {
          store.deleteWeeklyEvent(id);
          closeModal(this.weeklyEventModal);
          this.renderCalendar();
          this.renderScheduleManagerModal();
          playClickSound();
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
        const payload = {
          title: document.getElementById('wevent-title-input').value.trim(),
          recurrence: this.weventRecurrenceSelect ? this.weventRecurrenceSelect.value : 'weekly',
          day: parseInt(document.getElementById('wevent-day-select').value, 10),
          start: document.getElementById('wevent-start-input').value,
          end: document.getElementById('wevent-end-input').value,
          category: document.getElementById('wevent-cat-input').value.trim() || 'Kardeşlik ve İhya',
          color: document.getElementById('wevent-color-input').value,
          notes: document.getElementById('wevent-notes-input').value.trim()
        };
        if (!payload.title) return;
        if (editId) store.updateWeeklyEvent(editId, payload);
        else store.addWeeklyEvent(payload);

        closeModal(this.weeklyEventModal);
        this.renderCalendar();
        this.renderScheduleManagerModal();
        playClickSound();
      });
    }

    // Lecture Slot Modal
    if (this.btnCancelLslot) {
      this.btnCancelLslot.addEventListener('click', () => closeModal(this.lectureSlotModal));
    }
    if (this.lectureSlotModal) {
      this.lectureSlotModal.addEventListener('click', (e) => {
        if (e.target === this.lectureSlotModal) closeModal(this.lectureSlotModal);
      });
    }
    if (this.btnDeleteLslot) {
      this.btnDeleteLslot.addEventListener('click', async () => {
        const subjectId = this.lslotSubjectId.value;
        const slotIdx = parseInt(this.lslotIndex.value, 10);
        if (subjectId && !isNaN(slotIdx)) {
          const ok = await showInAppConfirm({
            title: 'Remove Lecture Slot',
            message: 'Remove this lecture slot from the weekly schedule?',
            confirmText: 'Remove',
            danger: true
          });
          if (ok) {
            store.deleteLectureSlot(subjectId, slotIdx);
            closeModal(this.lectureSlotModal);
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
        if (subjectId && !isNaN(slotIdx)) {
          store.updateLectureSlot(subjectId, slotIdx, {
            day: parseInt(this.lslotDaySelect.value, 10),
            start: this.lslotStartInput.value,
            end: this.lslotEndInput.value,
            label: this.lslotLabelInput.value.trim() || 'Lecture'
          });
        }
        closeModal(this.lectureSlotModal);
        this.renderCalendar();
        this.renderScheduleManagerModal();
        playClickSound();
      });
    }

    // Schedule Manager Modal
    const openSchedMgr = () => {
      this.openScheduleManagerModal();
      playClickSound();
    };
    if (this.btnManageSchedule) this.btnManageSchedule.addEventListener('click', openSchedMgr);
    if (this.btnManageScheduleSub) this.btnManageScheduleSub.addEventListener('click', openSchedMgr);
    if (this.btnCloseScheduleManager) {
      this.btnCloseScheduleManager.addEventListener('click', () => closeModal(this.scheduleManagerModal));
    }
    if (this.scheduleManagerModal) {
      this.scheduleManagerModal.addEventListener('click', (e) => {
        if (e.target === this.scheduleManagerModal) closeModal(this.scheduleManagerModal);
      });
    }
    if (this.btnMgrAddWevent) {
      this.btnMgrAddWevent.addEventListener('click', () => {
        this.openWeeklyEventModal(null);
        playClickSound();
      });
    }

    // Event delegation on Schedule Manager list
    if (this.scheduleManagerList) {
      this.scheduleManagerList.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.btn-edit-sched-item');
        if (editBtn) {
          if (editBtn.dataset.type === 'wevent') {
            this.openWeeklyEventModal(editBtn.dataset.evId);
          } else {
            this.openLectureSlotModal(editBtn.dataset.subId, parseInt(editBtn.dataset.slotIdx, 10));
          }
          return;
        }

        const delBtn = e.target.closest('.btn-del-sched-item');
        if (delBtn) {
          if (delBtn.dataset.type === 'wevent') {
            const ok = await showInAppConfirm({
              title: 'Delete Weekly Event',
              message: 'Are you sure you want to delete this recurring weekly event?',
              confirmText: 'Delete',
              danger: true
            });
            if (ok) {
              store.deleteWeeklyEvent(delBtn.dataset.evId);
              this.renderScheduleManagerModal();
              this.renderCalendar();
              playClickSound();
            }
          } else {
            const ok = await showInAppConfirm({
              title: 'Remove Lecture Slot',
              message: 'Remove this lecture slot from the course schedule?',
              confirmText: 'Remove',
              danger: true
            });
            if (ok) {
              store.deleteLectureSlot(delBtn.dataset.subId, parseInt(delBtn.dataset.slotIdx, 10));
              this.renderScheduleManagerModal();
              this.renderCalendar();
              playClickSound();
            }
          }
        }
      });
    }
  }

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
        document.getElementById('wevent-cat-input').value = ev.category || 'Kardeşlik ve İhya';
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
      document.getElementById('wevent-cat-input').value = 'Kardeşlik ve İhya';
      document.getElementById('wevent-color-input').value = '#059669';
      if (this.btnDeleteWevent) this.btnDeleteWevent.style.display = 'none';
      if (this.weventDayGroup) {
        this.weventDayGroup.style.opacity = '1';
        this.weventDayGroup.style.pointerEvents = 'auto';
      }
    }

    openModal(this.weeklyEventModal);
  }

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

    openModal(this.lectureSlotModal);
  }

  openScheduleManagerModal() {
    if (!this.scheduleManagerModal) return;
    this.renderScheduleManagerModal();
    openModal(this.scheduleManagerModal);
  }

  renderScheduleManagerModal() {
    if (!this.scheduleManagerList) return;
    const subjects = store.getState().subjects || [];
    const weeklyEvents = store.getState().weeklyEvents || [];
    const dayNames = ['', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
    const allItems = [];

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
            category: s.group || 'Courses'
          });
        });
      }
    });

    weeklyEvents.forEach((ev) => {
      allItems.push({
        type: 'wevent',
        id: ev.id,
        title: ev.title,
        day: ev.day,
        start: ev.start,
        end: ev.end,
        color: ev.color || '#059669',
        category: ev.category || 'Events',
        recurrence: ev.recurrence || 'weekly'
      });
    });

    if (allItems.length === 0) {
      this.scheduleManagerList.innerHTML = `<div class="empty-state" style="padding: 1.5rem;"><p>No scheduled classes or events.</p></div>`;
      return;
    }

    allItems.sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));

    const recLabels = {
      weekly: 'Weekly', biweekly: 'Bi-weekly', triweekly: 'Tri-weekly',
      monthly: 'Monthly', weekdays: 'Weekdays (Mon-Fri)', daily: 'Daily'
    };

    let html = '';
    let currentDay = -1;
    allItems.forEach((item) => {
      if (item.day !== currentDay) {
        currentDay = item.day;
        html += `<div class="schedule-mgr-day-header">${dayNames[currentDay]}</div>`;
      }
      const recBadge = item.recurrence && item.recurrence !== 'weekly'
        ? `<span class="cadence-pill">${escapeHTML(recLabels[item.recurrence] || item.recurrence)}</span>`
        : '';
      const safeItemColor = sanitizeCssColor(item.color);

      html += `
        <div class="schedule-mgr-row" style="border-left: 3px solid ${safeItemColor};">
          <div class="schedule-mgr-info">
            <div style="display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;">
              <span class="schedule-mgr-time">${escapeHTML(item.start)} - ${escapeHTML(item.end)}</span>
              <span class="schedule-mgr-badge" style="background-color: ${item.type === 'lecture' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(5, 150, 105, 0.15)'}; color: ${item.type === 'lecture' ? 'var(--primary)' : 'var(--accent-emerald)'};">
                ${escapeHTML(item.category)}
              </span>
              ${recBadge}
            </div>
            <div class="schedule-mgr-title">${escapeHTML(item.title)}</div>
          </div>
          <div class="schedule-mgr-actions">
            <button type="button" class="btn btn-secondary btn-edit-sched-item" data-type="${escapeHTML(item.type)}" data-sub-id="${escapeHTML(item.subjectId || '')}" data-slot-idx="${item.slotIndex !== undefined ? item.slotIndex : ''}" data-ev-id="${escapeHTML(item.id || '')}">Edit</button>
            <button type="button" class="btn btn-icon btn-del-sched-item" data-type="${escapeHTML(item.type)}" data-sub-id="${escapeHTML(item.subjectId || '')}" data-slot-idx="${item.slotIndex !== undefined ? item.slotIndex : ''}" data-ev-id="${escapeHTML(item.id || '')}" title="Delete / Remove" aria-label="Remove scheduled item">✕</button>
          </div>
        </div>
      `;
    });
    this.scheduleManagerList.innerHTML = html;
  }

  renderCalendar() {
    if (!this.calendarViewContainer) return;
    if (this.calendarViewMode === 'week') this.renderWeekCalendar();
    else this.renderMonthCalendar();
    this.renderBacklogTasks();
  }

  renderWeekCalendar() {
    const anchor = new Date(this.calendarAnchorDate);
    anchor.setHours(0, 0, 0, 0);
    const dayOfWeek = anchor.getDay() || 7;
    const monday = new Date(anchor);
    monday.setDate(anchor.getDate() - dayOfWeek + 1);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(0, 0, 0, 0);

    const options = { month: 'short', day: 'numeric' };
    if (this.calTitleHeader) {
      this.calTitleHeader.textContent = `${monday.toLocaleDateString(undefined, options)} – ${sunday.toLocaleDateString(undefined, { ...options, year: 'numeric' })}`;
    }

    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      d.setHours(0, 0, 0, 0);
      weekDays.push(d);
    }

    const todayStr = toLocalDateStr(new Date());
    const tasks = store.getState().tasks || [];
    const sessions = store.getState().sessions || [];

    let html = `<div class="week-calendar-grid">`;
    weekDays.forEach((dateObj) => {
      const dateStr = toLocalDateStr(dateObj);
      const isToday = dateStr === todayStr;
      const dayName = dateObj.toLocaleDateString(undefined, { weekday: 'short' });
      const dayNum = dateObj.getDate();
      const dayNumOfWeek = dateObj.getDay() || 7;

      const rawDayTasks = tasks.filter((t) => store.doesTaskOccurOnDate(t, dateStr));
      const dayTaskDedupMap = new Map();
      rawDayTasks.forEach((t) => {
        const familyKey = `${(t.title || '').trim().toLowerCase()}|${t.subject || ''}`;
        const existing = dayTaskDedupMap.get(familyKey);
        if (!existing) {
          dayTaskDedupMap.set(familyKey, t);
        } else {
          const existingExact = existing.dueDate === dateStr || (existing.completed && existing.completedAt && toLocalDateStr(existing.completedAt) === dateStr);
          const curExact = t.dueDate === dateStr || (t.completed && t.completedAt && toLocalDateStr(t.completedAt) === dateStr);
          if (curExact && !existingExact) dayTaskDedupMap.set(familyKey, t);
        }
      });
      let dayTasks = Array.from(dayTaskDedupMap.values());
      if (this.calendarSubjectFilter !== 'all') {
        dayTasks = this.calendarSubjectFilter === ''
          ? dayTasks.filter((t) => !t.subject)
          : dayTasks.filter((t) => t.subject === this.calendarSubjectFilter);
      }

      let daySessions = sessions.filter((s) => store.getSessionDateStr(s) === dateStr);
      if (this.calendarSubjectFilter !== 'all') {
        daySessions = this.calendarSubjectFilter === ''
          ? daySessions.filter((s) => !s.subject || s.subject === 'General')
          : daySessions.filter((s) => s.subject === this.calendarSubjectFilter);
      }
      const totalMinsStudied = Math.round(daySessions.reduce((acc, s) => acc + (s.durationSec || 0), 0) / 60);

      html += `
        <div class="calendar-day-column ${isToday ? 'today-col' : ''}" data-date="${dateStr}">
          <div class="day-col-header">
            <span class="day-name">${escapeHTML(dayName)}</span>
            <span class="day-number ${isToday ? 'today-pill' : ''}">${dayNum}</span>
            ${totalMinsStudied > 0 ? `<span class="day-logged-pill">◷ ${totalMinsStudied}m studied</span>` : ''}
          </div>
          <div class="day-col-body">
            ${renderDayClassLecturesHTML(dayNumOfWeek, dateStr)}
            <div class="day-tasks-section">
              ${dayTasks.length > 0 ? `<span class="day-section-sub">Study Tasks:</span>` : ''}
              <div class="day-tasks-list">
                ${dayTasks.map((t) => {
                  const color = sanitizeCssColor(store.getSubjectColor(t.subject));
                  const safeTaskId = escapeHTML(t.id);
                  const isDoneForDay = store.isTaskCompletedOnDate(t, dateStr);
                  const isProjectedRoutine = t.recurrence && t.recurrence !== 'none' && t.dueDate !== dateStr && !isDoneForDay;
                  const completedTsForDay = (t.completedDates && t.completedDates[dateStr]) || t.completedAt;
                  const isMidnightDone = Boolean(isDoneForDay && store.isMidnightTimestamp(completedTsForDay));
                  const sessStats = store.getTaskSessionStats(t);
                  const expandKey = `${dateStr}|${safeTaskId}`;
                  const isExpanded = this.expandedPlannerTasks.has(`${dateStr}|${t.id}`);
                  const gcalStart = new Date(`${dateStr}T09:00:00`);
                  const gcalEnd = new Date(gcalStart.getTime() + (t.targetMinutes || 60) * 60000);
                  const pad = (n) => String(n).padStart(2, '0');
                  const fmtGcal = (dObj) => `${dObj.getFullYear()}${pad(dObj.getMonth() + 1)}${pad(dObj.getDate())}T${pad(dObj.getHours())}${pad(dObj.getMinutes())}00`;
                  const gcalDates = `${fmtGcal(gcalStart)}/${fmtGcal(gcalEnd)}`;
                  return `
                    <div class="cal-task-item ${isDoneForDay ? 'completed' : ''} ${isProjectedRoutine ? 'cal-task-routine' : ''} ${isExpanded ? 'expanded' : ''}" data-expand-key="${expandKey}" style="border-left: 3px solid ${color};">
                      <div class="cal-task-compact-row">
                        <button type="button" class="btn-cal-check" data-task-id="${safeTaskId}" data-date="${dateStr}" title="${isDoneForDay ? 'Mark undone for this day' : 'Mark done for this day'}">${isDoneForDay ? '✓' : '○'}</button>
                        <div class="cal-task-title" data-expand-toggle="${expandKey}" title="${escapeHTML(t.title)} — Click to toggle details" style="cursor: pointer;">${escapeHTML(t.title)}</div>
                        <button type="button" class="btn-cal-dropdown" data-expand-toggle="${expandKey}" aria-expanded="${isExpanded}" title="Toggle task details" style="cursor: pointer;">
                          <span class="cal-dropdown-chevron">${isExpanded ? '▾' : '▸'}</span>
                        </button>
                      </div>
                      <div class="cal-task-details-dropdown" style="display: ${isExpanded ? 'flex' : 'none'};">
                        <div class="cal-task-top">
                          <span class="cal-subject-badge ${!t.subject ? 'badge-no-course-text' : ''}" style="color: ${color};">${t.subject ? escapeHTML(t.subject) : 'General'}</span>
                          ${t.recurrence && t.recurrence !== 'none' ? `<span class="cal-recurrence-pill" title="Repeats: ${escapeHTML(getRecurrenceLabel(t.recurrence, t.recurrenceInterval))}">↻ ${escapeHTML(getRecurrenceLabel(t.recurrence, t.recurrenceInterval))}</span>` : ''}
                          ${t.targetMinutes ? `<span class="cal-time-goal">${t.targetMinutes}m</span>` : ''}
                        </div>
                        ${((!isProjectedRoutine || isDoneForDay) && (sessStats.sessionCount > 0 || isMidnightDone)) ? `
                          <div class="cal-task-stats-row">
                            ${sessStats.sessionCount > 0 ? `<span class="cal-sessions-pill" title="Studied across ${sessStats.sessionCount} session(s)">◷ ${sessStats.sessionCount} sess (${sessStats.totalMins}m)</span>` : ''}
                            ${isMidnightDone ? `<span class="cal-midnight-pill" title="Completed during midnight hours (00:00–04:59)">🌙 Midnight</span>` : ''}
                          </div>
                        ` : ''}
                        ${t.notes ? `<div class="cal-task-notes">${escapeHTML(t.notes)}</div>` : ''}
                        <div class="cal-task-actions">
                          ${!isDoneForDay ? `<button type="button" class="btn-cal-study" data-task-id="${safeTaskId}" title="Study Now">▶ Study</button>` : ''}
                          ${!isDoneForDay && dateStr > todayStr && (!t.recurrence || t.recurrence === 'none') ? `<button type="button" class="btn-cal-move-today" data-task-id="${safeTaskId}" title="Move to Today">→ Today</button>` : ''}
                          <button type="button" class="btn-cal-edit" data-task-id="${safeTaskId}" title="Edit task" aria-label="Edit task">✎</button>
                          <a href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('[Study] ' + (t.subject || 'General') + ': ' + t.title)}&dates=${gcalDates}&details=${encodeURIComponent(t.notes || 'Scheduled in ChronoStudy')}" target="_blank" rel="noopener noreferrer" class="btn-cal-gcal" title="Add to Google Calendar">GCal</a>
                          <button type="button" class="btn-cal-delete" data-task-id="${safeTaskId}" title="Delete task" aria-label="Delete task">✕</button>
                        </div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
            ${daySessions.length > 0 ? `
              <div class="day-sessions-summary">
                <span class="day-section-sub">Completed Sessions (${daySessions.length}):</span>
                ${daySessions.map((s) => {
                  const sColor = sanitizeCssColor(store.getSubjectColor(s.subject));
                  const sMins = Math.max(1, Math.round((s.durationSec || 0) / 60));
                  const sStart = s.startTime ? new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                  const sEnd = s.endTime ? new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                  const tip = [s.subject || 'General', (sStart && sEnd) ? `${sStart}–${sEnd}` : '', s.notes || ''].filter(Boolean).join(' • ');
                  return `
                    <div class="cal-session-snippet" style="border-left: 2px solid ${sColor}; padding-left: 0.3rem;" title="${escapeHTML(tip)}">
                      <span class="cal-session-dur">${sMins}m</span>
                      <span class="cal-session-title">${escapeHTML(s.topic || 'Focus Session')}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : ''}
            <button type="button" class="btn-add-day-task" data-date="${dateStr}">+ Add Task for ${escapeHTML(dayName)}</button>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    this.calendarViewContainer.innerHTML = html;
  }

  renderMonthCalendar() {
    const anchor = new Date(this.calendarAnchorDate);
    const year = anchor.getFullYear();
    const month = anchor.getMonth();
    if (this.calTitleHeader) {
      this.calTitleHeader.textContent = anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startDayIndex = (firstDayOfMonth.getDay() || 7) - 1;
    const totalDays = lastDayOfMonth.getDate();

    const todayStr = toLocalDateStr(new Date());
    const tasks = store.getState().tasks || [];
    const sessions = store.getState().sessions || [];

    let html = `
      <div class="month-calendar-wrapper">
        <div class="month-header-row">
          <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
        </div>
        <div class="month-grid">
    `;

    for (let i = 0; i < startDayIndex; i++) html += `<div class="month-day-cell empty-cell"></div>`;

    for (let d = 1; d <= totalDays; d++) {
      const curDate = new Date(year, month, d);
      curDate.setHours(12, 0, 0, 0);
      const dateStr = toLocalDateStr(curDate);
      const isToday = dateStr === todayStr;

      const rawDayTasks = tasks.filter((t) => store.doesTaskOccurOnDate(t, dateStr));
      const monthDedup = new Map();
      rawDayTasks.forEach((t) => {
        const key = `${(t.title || '').trim().toLowerCase()}|${t.subject || ''}`;
        if (!monthDedup.has(key)) monthDedup.set(key, t);
      });
      let dayTasks = Array.from(monthDedup.values());
      if (this.calendarSubjectFilter !== 'all') {
        dayTasks = this.calendarSubjectFilter === ''
          ? dayTasks.filter((t) => !t.subject)
          : dayTasks.filter((t) => t.subject === this.calendarSubjectFilter);
      }

      const daySessions = sessions.filter((s) => store.getSessionDateStr(s) === dateStr);
      const dayMins = Math.round(daySessions.reduce((acc, s) => acc + (s.durationSec || 0), 0) / 60);

      html += `
        <div class="month-day-cell ${isToday ? 'today-month-cell' : ''}" data-date="${dateStr}">
          <div class="month-cell-header">
            <span class="month-day-num ${isToday ? 'today-num-pill' : ''}">${d}</span>
            ${dayMins > 0 ? `<span class="month-mins-badge">${dayMins}m</span>` : ''}
          </div>
          <div class="month-cell-dots">
            ${dayTasks.slice(0, 3).map((t) => `<span class="month-task-dot" style="background-color: ${sanitizeCssColor(store.getSubjectColor(t.subject))};" title="${escapeHTML(t.title)}"></span>`).join('')}
            ${dayTasks.length > 3 ? `<span class="more-dots">+${dayTasks.length - 3}</span>` : ''}
          </div>
        </div>
      `;
    }

    html += `</div></div>`;
    this.calendarViewContainer.innerHTML = html;
  }

  renderBacklogTasks() {
    if (!this.backlogTasksContainer) return;
    const backlogTasks = (store.getState().tasks || []).filter(
      (t) => !t.dueDate && !t.completed && (!t.recurrence || t.recurrence === 'none')
    );

    if (backlogTasks.length === 0) {
      this.backlogTasksContainer.innerHTML = `
        <div class="empty-state" style="padding: 1rem;">
          <p>No unscheduled tasks.</p>
          <small>Add study items with no due date to keep them in this backlog.</small>
        </div>
      `;
      return;
    }

    this.backlogTasksContainer.innerHTML = backlogTasks.map((t) => {
      const color = sanitizeCssColor(store.getSubjectColor(t.subject));
      const safeId = escapeHTML(t.id);
      return `
        <div class="backlog-task-card" data-task-id="${safeId}" style="border-left: 3px solid ${color};">
          <div class="backlog-task-info">
            <div style="display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap;">
              <span class="subject-badge ${!t.subject ? 'badge-no-course' : ''}" style="--badge-color: ${color}">${t.subject ? escapeHTML(t.subject) : 'General'}</span>
              ${t.recurrence && t.recurrence !== 'none' ? `<span class="meta-badge task-recurrence-badge" style="font-size: 0.65rem;">↻ ${escapeHTML(getRecurrenceLabel(t.recurrence, t.recurrenceInterval))}</span>` : ''}
            </div>
            <div class="backlog-task-title" style="cursor: pointer;" title="Click to edit task">${escapeHTML(t.title)}</div>
          </div>
          <div class="backlog-task-actions">
            <button type="button" class="btn btn-study-now btn-study-backlog" data-id="${safeId}">▶ Study</button>
            <button type="button" class="btn btn-icon btn-edit-backlog" data-id="${safeId}" title="Edit task" aria-label="Edit backlog task">✎</button>
            <button type="button" class="btn btn-secondary btn-schedule-backlog" data-id="${safeId}" title="Assign to a day">Schedule</button>
            <button type="button" class="btn btn-icon btn-del-backlog" data-id="${safeId}" aria-label="Delete backlog task">✕</button>
          </div>
        </div>
      `;
    }).join('');
  }

  async openDayInspector(dateStr) {
    const rawTasks = (store.getState().tasks || []).filter((t) => store.doesTaskOccurOnDate(t, dateStr));
    const dedupMap = new Map();
    rawTasks.forEach((t) => {
      const k = `${(t.title || '').trim().toLowerCase()}|${t.subject || ''}`;
      if (!dedupMap.has(k)) dedupMap.set(k, t);
    });
    const tasks = Array.from(dedupMap.values());
    const sessions = (store.getState().sessions || []).filter((s) => store.getSessionDateStr(s) === dateStr);
    const totalMins = Math.round(sessions.reduce((acc, s) => acc + (s.durationSec || 0), 0) / 60);

    let summary = `Date: ${dateStr}\nTotal Study Time: ${totalMins} mins\n\n`;
    if (tasks.length > 0) {
      summary += `Tasks Scheduled:\n` + tasks.map((t) => {
        const st = store.getTaskSessionStats(t);
        const sessInfo = st.sessionCount > 0 ? ` (${st.sessionCount} sess, ${st.totalMins}m)` : '';
        const isDoneOnDay = store.isTaskCompletedOnDate(t, dateStr);
        return `• [${isDoneOnDay ? 'DONE' : 'TODO'}] ${t.subject || 'General'}: ${t.title}${sessInfo}`;
      }).join('\n') + `\n\n`;
    }
    if (sessions.length > 0) {
      summary += `Sessions Logged:\n` + sessions.map((s) => `• ${Math.round(s.durationSec / 60)}m: ${s.subject} - ${s.topic}`).join('\n');
    }

    const action = await showInAppConfirm({
      title: `Day Details: ${dateStr}`,
      message: `${summary}\nWould you like to switch to the Week view for this date?`,
      confirmText: 'Switch to Week View'
    });
    if (action) {
      this.calendarAnchorDate = new Date(dateStr + 'T12:00:00');
      this.calendarViewMode = 'week';
      this.calModeWeekBtn?.classList.add('active');
      this.calModeMonthBtn?.classList.remove('active');
      this.renderCalendar();
    }
  }
}
