// src/ui/courses-view.js — Courses grid, dropdown hydration, Subject & Category modals (delegated)
import { store } from '../store.js';
import { timer } from '../timer.js';
import { playClickSound } from '../audio.js';
import { escapeHTML, sanitizeCssColor } from './dom-utils.js';
import { openModal, closeModal, showInAppConfirm, showInAppPrompt } from './modals.js';

export class CoursesViewController {
  constructor(ui) {
    this.ui = ui;
    this.subjectGroupFilter = 'all';
    this.editingSubjectId = null;
  }

  initDOM() {
    this.subjectsGrid = document.getElementById('subjects-grid');
    this.subjectsGroupFilterBar = document.getElementById('subjects-group-filter-bar');
    this.btnOpenAddSubject = document.getElementById('btn-open-add-subject');

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

    this.categoriesModal = document.getElementById('categories-modal');
    this.btnManageCategories = document.getElementById('btn-manage-categories');
    this.btnCloseCategoriesModal = document.getElementById('btn-close-categories-modal');
    this.addCategoryForm = document.getElementById('add-category-form');
    this.newCategoryInput = document.getElementById('new-category-input');
    this.categoriesManagerList = document.getElementById('categories-manager-list');
    this.groupSuggestions = document.getElementById('group-suggestions');
  }

  bindEvents() {
    if (this.btnOpenAddSubject) {
      this.btnOpenAddSubject.addEventListener('click', () => {
        this.openSubjectModal(null);
        playClickSound();
      });
    }
    if (this.btnCancelSubject) {
      this.btnCancelSubject.addEventListener('click', () => closeModal(this.subjectModal));
    }
    if (this.subjectModal) {
      this.subjectModal.addEventListener('click', (e) => {
        if (e.target === this.subjectModal) closeModal(this.subjectModal);
      });
    }
    if (this.subjectForm) {
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
          store.updateSubject(this.editingSubjectId, { name, code, group, folderPath, color, targetWeeklyHours: hours });
        } else {
          store.addSubject(name, color, code, hours, group, folderPath);
        }
        closeModal(this.subjectModal);
        playClickSound();
      });
    }

    if (this.btnManageCategories) {
      this.btnManageCategories.addEventListener('click', () => {
        this.openCategoriesModal();
        playClickSound();
      });
    }
    if (this.btnCloseCategoriesModal) {
      this.btnCloseCategoriesModal.addEventListener('click', () => {
        closeModal(this.categoriesModal);
        playClickSound();
      });
    }
    if (this.categoriesModal) {
      this.categoriesModal.addEventListener('click', (e) => {
        if (e.target === this.categoriesModal) closeModal(this.categoriesModal);
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

    // Event delegation on Group Filter Bar
    if (this.subjectsGroupFilterBar) {
      this.subjectsGroupFilterBar.addEventListener('click', (e) => {
        const tab = e.target.closest('.subj-group-tab');
        if (!tab) return;
        this.subjectGroupFilter = tab.dataset.group;
        this.renderSubjectsPage();
        playClickSound();
      });
    }

    // Event delegation on Subjects Grid
    if (this.subjectsGrid) {
      this.subjectsGrid.addEventListener('click', async (e) => {
        const renameBtn = e.target.closest('.btn-rename-group');
        if (renameBtn) {
          e.stopPropagation();
          const curName = renameBtn.dataset.group;
          const newName = await showInAppPrompt({
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
          return;
        }

        const editBtn = e.target.closest('.btn-edit-subject');
        if (editBtn) {
          const sub = (store.getState().subjects || []).find((s) => s.id === editBtn.dataset.id);
          if (sub) {
            this.openSubjectModal(sub);
            playClickSound();
          }
          return;
        }

        const delBtn = e.target.closest('.btn-delete-subject');
        if (delBtn) {
          const sub = (store.getState().subjects || []).find((s) => s.id === delBtn.dataset.id);
          if (!sub) return;
          const ok = await showInAppConfirm({
            title: 'Remove Course / Subject',
            message: `Remove "${sub.name}" from your subjects? Existing study logs will be preserved.`,
            confirmText: 'Remove Subject',
            danger: true
          });
          if (ok) {
            store.deleteSubject(sub.id);
            playClickSound();
          }
          return;
        }

        const copyBtn = e.target.closest('.btn-copy-path');
        if (copyBtn) {
          navigator.clipboard?.writeText(copyBtn.dataset.path).then(() => {
            copyBtn.textContent = '✓';
            setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
          });
          playClickSound();
          return;
        }

        const quickBtn = e.target.closest('.btn-quick-study-subject');
        if (quickBtn) {
          const subjName = quickBtn.dataset.subject;
          timer.setContext({ subject: subjName, topic: '' });
          if (this.ui.timerView?.subjectSelect) this.ui.timerView.subjectSelect.value = subjName;
          this.ui.switchView('focus');
          playClickSound();
        }
      });
    }

    // Event delegation on Categories Manager List
    if (this.categoriesManagerList) {
      this.categoriesManagerList.addEventListener('click', async (e) => {
        const renameBtn = e.target.closest('.btn-rename-cat');
        if (renameBtn) {
          const groupName = renameBtn.dataset.group;
          const newName = await showInAppPrompt({
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
          return;
        }

        const delBtn = e.target.closest('.btn-del-cat');
        if (delBtn) {
          const groupName = delBtn.dataset.group;
          const ok = await showInAppConfirm({
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
        }
      });
    }
  }

  renderSubjects() {
    const subjects = store.getState().subjects || [];
    const populateSelect = (selectEl, options = {}) => {
      if (!selectEl) return;
      const { includeAll = false, includeNoSubject = false, defaultLabel = 'No Course / General' } = options;
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

    populateSelect(this.ui.timerView?.subjectSelect, { includeNoSubject: true, defaultLabel: 'General / No Course' });
    populateSelect(this.ui.tasksView?.taskSubjectSelect, { includeNoSubject: true, defaultLabel: 'General / No Course' });
    populateSelect(this.ui.tasksView?.sidebarTaskSubject, { includeNoSubject: true, defaultLabel: 'General / No Course' });
    populateSelect(this.ui.tasksView?.sidebarTaskSubjectFilter, { includeAll: true, includeNoSubject: true, defaultLabel: 'No Course Only' });
    populateSelect(this.ui.tasksView?.taskSubjectFilter, { includeAll: true, includeNoSubject: true, defaultLabel: 'No Course Only' });
    populateSelect(this.ui.analyticsView?.historySubjectFilterEl, { includeAll: true, includeNoSubject: true, defaultLabel: 'General / No Course' });
    populateSelect(this.ui.plannerView?.calSubjectFilter, { includeAll: true, includeNoSubject: true, defaultLabel: 'No Course Only' });
    populateSelect(document.getElementById('manual-subject-select'), { includeNoSubject: true, defaultLabel: 'General / No Course' });
  }

  renderSubjectsPage() {
    if (!this.subjectsGrid) return;
    const subjects = store.getState().subjects || [];
    const groups = store.getState().groups || ['General'];

    if (this.subjectsGroupFilterBar) {
      let filterHtml = `<button type="button" class="subj-group-tab ${this.subjectGroupFilter === 'all' ? 'active' : ''}" data-group="all">All Groups (${subjects.length})</button>`;
      groups.forEach((g) => {
        const count = subjects.filter((s) => (s.group || 'İTÜ Courses (Fall 2026)') === g).length;
        filterHtml += `<button type="button" class="subj-group-tab ${this.subjectGroupFilter === g ? 'active' : ''}" data-group="${escapeHTML(g)}">${escapeHTML(g)} (${count})</button>`;
      });
      this.subjectsGroupFilterBar.innerHTML = filterHtml;
    }

    if (this.groupSuggestions) {
      this.groupSuggestions.innerHTML = groups.map((g) => `<option value="${escapeHTML(g)}"></option>`).join('');
    }

    const displayedGroups = this.subjectGroupFilter === 'all'
      ? groups.filter((g) => subjects.some((s) => (s.group || 'İTÜ Courses (Fall 2026)') === g))
      : [this.subjectGroupFilter];

    const dayNames = ['', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
    this.subjectsGrid.innerHTML = displayedGroups.map((groupName) => {
      const groupSubjects = subjects.filter((s) => (s.group || 'İTÜ Courses (Fall 2026)') === groupName);
      if (groupSubjects.length === 0) return '';

      const cardsHtml = groupSubjects.map((sub) => {
        const stats = store.getSubjectStats(sub.name);
        const targetHours = sub.targetWeeklyHours;
        const progressPercent = targetHours ? Math.min(100, Math.round((parseFloat(stats.thisWeekHours) / targetHours) * 100)) : 0;
        const scheduleText = (Array.isArray(sub.schedule) && sub.schedule.length > 0)
          ? sub.schedule.map((s) => `${dayNames[s.day]} ${s.start}-${s.end}`).join(' & ')
          : '';
        const safeSubColor = sanitizeCssColor(sub.color);
        const safeSubId = escapeHTML(sub.id);

        return `
          <div class="subject-management-card" style="--card-accent: ${safeSubColor};">
            <div class="subject-card-header">
              <div class="subject-card-title-group">
                <span class="subject-color-dot" style="background-color: ${safeSubColor}"></span>
                <div>
                  <span class="subject-code-tag">${escapeHTML(sub.code || 'COURSE')}</span>
                  <h3 class="subject-name">${escapeHTML(sub.name)}</h3>
                  ${scheduleText ? `<span class="subject-schedule-badge">${escapeHTML(scheduleText)}</span>` : ''}
                </div>
              </div>
              <div class="subject-card-menu">
                <button type="button" class="btn btn-icon btn-edit-subject" data-id="${safeSubId}" title="Edit subject" aria-label="Edit subject">✎</button>
                <button type="button" class="btn btn-icon btn-delete-subject" data-id="${safeSubId}" title="Delete subject" aria-label="Delete subject">✕</button>
              </div>
            </div>

            ${targetHours ? `
              <div class="subject-progress-box">
                <div class="progress-labels">
                  <span>This Week: <strong>${stats.thisWeekHours} hrs</strong></span>
                  <span>Goal: <strong>${targetHours} hrs/wk</strong></span>
                </div>
                <div class="progress-bar-bg">
                  <div class="progress-bar-fill" style="width: ${progressPercent}%; background-color: ${safeSubColor};"></div>
                </div>
              </div>
            ` : `
              <div class="subject-progress-box self-paced">
                <span class="self-paced-label">Self-Paced (No required weekly quota)</span>
              </div>
            `}

            <div class="subject-metrics-row">
              <div class="subject-metric"><span class="metric-val">${stats.pendingTasks}</span><span class="metric-lbl">To-Do</span></div>
              <div class="subject-metric"><span class="metric-val">${stats.completedTasks}</span><span class="metric-lbl">Completed</span></div>
              <div class="subject-metric"><span class="metric-val">${stats.totalMinutes}m</span><span class="metric-lbl">Total Time</span></div>
            </div>

            <div class="subject-card-footer">
              ${sub.folderPath ? `
                <div class="subject-folder-row" title="${escapeHTML(sub.folderPath)}">
                  <span class="folder-path-text">${escapeHTML(sub.folderPath)}</span>
                  <button type="button" class="btn-copy-path" data-path="${escapeHTML(sub.folderPath)}" title="Copy folder path">Copy</button>
                </div>
              ` : ''}
              <button type="button" class="btn btn-secondary btn-quick-study-subject" data-subject="${escapeHTML(sub.name)}" style="width: 100%;">▶ Study This Course</button>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="subjects-group-block">
          <div class="group-block-header">
            <div class="group-title-with-actions">
              <h3 class="group-block-title">${escapeHTML(groupName)}</h3>
              <button type="button" class="btn btn-icon btn-rename-group" data-group="${escapeHTML(groupName)}" title="Rename category '${escapeHTML(groupName)}'" aria-label="Rename category">✎</button>
            </div>
            <div class="group-header-right">
              <span class="group-block-count">${groupSubjects.length} courses / tracks</span>
            </div>
          </div>
          <div class="group-cards-grid">${cardsHtml}</div>
        </div>
      `;
    }).join('');
  }

  openSubjectModal(subjectToEdit = null) {
    if (!this.subjectModal) return;
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
    openModal(this.subjectModal);
  }

  openCategoriesModal() {
    if (!this.categoriesModal) return;
    this.renderCategoriesModal();
    openModal(this.categoriesModal);
  }

  renderCategoriesModal() {
    if (!this.categoriesManagerList) return;
    const groups = store.getGroups();
    const subjects = store.getState().subjects || [];

    if (groups.length === 0) {
      this.categoriesManagerList.innerHTML = `<div class="empty-state" style="padding: 1rem;"><p>No categories found.</p></div>`;
      return;
    }

    this.categoriesManagerList.innerHTML = groups.map((groupName) => {
      const count = subjects.filter((s) => s.group === groupName).length;
      const safeGroup = escapeHTML(groupName);
      return `
        <div class="category-manager-row">
          <div class="category-info">
            <span class="category-name-badge">${safeGroup}</span>
            <span class="category-sub-count">${count} course${count === 1 ? '' : 's'}</span>
          </div>
          <div class="category-row-actions">
            <button type="button" class="btn btn-secondary btn-rename-cat" data-group="${safeGroup}">Rename</button>
            <button type="button" class="btn btn-icon btn-del-cat" data-group="${safeGroup}" title="Delete category" aria-label="Delete category">✕</button>
          </div>
        </div>
      `;
    }).join('');
  }
}
