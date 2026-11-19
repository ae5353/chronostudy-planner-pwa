// src/ui/analytics-view.js — Header KPI stats, Analytics dashboard, and Session Activity Log (delegated)
import { store } from '../store.js';
import { playClickSound } from '../audio.js';
import { escapeHTML, sanitizeCssColor } from './dom-utils.js';
import { showInAppConfirm } from './modals.js';

export class AnalyticsViewController {
  constructor(ui) {
    this.ui = ui;
    this.historySubjectFilter = 'all';
    this.analyticsWeekOffset = 0;
    this.analyticsSubjectScope = 'week';
  }

  initDOM() {
    this.statTodayTime = document.getElementById('stat-today-time');
    this.statTodaySessions = document.getElementById('stat-today-sessions');
    this.statPendingTasks = document.getElementById('stat-pending-tasks');

    this.analyticsWeekRangeLabel = document.getElementById('analytics-week-range-label');
    this.btnAnalyticsPrevWeek = document.getElementById('btn-analytics-prev-week');
    this.analyticsWeekSelect = document.getElementById('analytics-week-select');
    this.btnAnalyticsNextWeek = document.getElementById('btn-analytics-next-week');
    this.btnAnalyticsThisWeek = document.getElementById('btn-analytics-this-week');
    this.analyticsWeekKpiLabel = document.getElementById('analytics-week-kpi-label');
    this.analyticsTotalTime = document.getElementById('analytics-total-time');
    this.analyticsTotalSessions = document.getElementById('analytics-total-sessions');
    this.analyticsWeekTime = document.getElementById('analytics-week-time');
    this.analyticsWeekTarget = document.getElementById('analytics-week-target');
    this.analyticsActiveDays = document.getElementById('analytics-active-days');
    this.analyticsActiveDaysSub = document.getElementById('analytics-active-days-sub');
    this.analyticsTasksDone = document.getElementById('analytics-tasks-done');
    this.analyticsTasksRate = document.getElementById('analytics-tasks-rate');
    this.analyticsTrendTotal = document.getElementById('analytics-trend-total');
    this.analyticsWeeklyBars = document.getElementById('analytics-weekly-bars');
    this.analyticsHistoryWeeksBars = document.getElementById('analytics-history-weeks-bars');
    this.analyticsHistoryWeeksBadge = document.getElementById('analytics-history-weeks-badge');
    this.btnAnalyticsScopeWeek = document.getElementById('btn-analytics-scope-week');
    this.btnAnalyticsScopeAll = document.getElementById('btn-analytics-scope-all');
    this.analyticsSubjectShare = document.getElementById('analytics-subject-share');

    this.historyListContainer = document.getElementById('history-list-container');
    this.historySubjectFilterEl = document.getElementById('history-subject-filter');
  }

  bindEvents() {
    if (this.historySubjectFilterEl) {
      this.historySubjectFilterEl.addEventListener('change', () => {
        this.historySubjectFilter = this.historySubjectFilterEl.value;
        this.renderHistory();
      });
    }
    if (this.btnAnalyticsPrevWeek) {
      this.btnAnalyticsPrevWeek.addEventListener('click', () => {
        this.analyticsWeekOffset -= 1;
        this.renderHistory();
        playClickSound();
      });
    }
    if (this.btnAnalyticsNextWeek) {
      this.btnAnalyticsNextWeek.addEventListener('click', () => {
        if (this.analyticsWeekOffset < 0) {
          this.analyticsWeekOffset += 1;
          this.renderHistory();
          playClickSound();
        }
      });
    }
    if (this.btnAnalyticsThisWeek) {
      this.btnAnalyticsThisWeek.addEventListener('click', () => {
        this.analyticsWeekOffset = 0;
        this.renderHistory();
        playClickSound();
      });
    }
    if (this.analyticsWeekSelect) {
      this.analyticsWeekSelect.addEventListener('change', () => {
        const val = parseInt(this.analyticsWeekSelect.value, 10);
        if (!Number.isNaN(val)) {
          this.analyticsWeekOffset = val;
          this.renderHistory();
        }
      });
    }
    if (this.btnAnalyticsScopeWeek) {
      this.btnAnalyticsScopeWeek.addEventListener('click', () => {
        this.analyticsSubjectScope = 'week';
        this.renderHistory();
        playClickSound();
      });
    }
    if (this.btnAnalyticsScopeAll) {
      this.btnAnalyticsScopeAll.addEventListener('click', () => {
        this.analyticsSubjectScope = 'all';
        this.renderHistory();
        playClickSound();
      });
    }

    // Delegated clicks for weekly history bars, subject filter cards & session delete
    if (this.analyticsHistoryWeeksBars) {
      this.analyticsHistoryWeeksBars.addEventListener('click', (e) => {
        const btn = e.target.closest('.history-week-btn');
        if (!btn) return;
        const offset = parseInt(btn.dataset.weekOffset, 10);
        if (!Number.isNaN(offset)) {
          this.analyticsWeekOffset = offset;
          this.renderHistory();
          playClickSound();
        }
      });
    }

    if (this.analyticsSubjectShare) {
      this.analyticsSubjectShare.addEventListener('click', (e) => {
        const card = e.target.closest('.subject-detail-card');
        if (!card) return;
        const subj = card.dataset.subject;
        const nextVal = this.historySubjectFilter === subj ? 'all' : subj;
        this.historySubjectFilter = nextVal;
        if (this.historySubjectFilterEl) {
          this.historySubjectFilterEl.value = nextVal === 'General / Other' ? '' : nextVal;
        }
        this.renderHistory();
        playClickSound();
      });
    }

    if (this.historyListContainer) {
      this.historyListContainer.addEventListener('click', async (e) => {
        const delBtn = e.target.closest('.btn-delete-history');
        if (!delBtn) return;
        const sessId = delBtn.dataset.id;
        if (!sessId) return;
        const ok = await showInAppConfirm({
          title: 'Delete Study Session',
          message: 'Delete this study session from your log?',
          confirmText: 'Delete',
          danger: true
        });
        if (ok) {
          store.deleteSession(sessId);
          playClickSound();
        }
      });
    }
  }

  renderStats() {
    const stats = store.getTodayStats();
    const hrs = Math.floor(stats.totalSecondsToday / 3600);
    const mins = Math.floor((stats.totalSecondsToday % 3600) / 60);
    const timeFormatted = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

    if (this.statTodayTime) this.statTodayTime.textContent = timeFormatted;
    if (this.statTodaySessions) this.statTodaySessions.textContent = `${stats.todaySessionsCount} sessions`;
    if (this.statPendingTasks) this.statPendingTasks.textContent = `${stats.pendingTasksCount} to do`;
  }

  renderHistory() {
    const data = store.getAnalyticsData({
      weekOffset: this.analyticsWeekOffset,
      subjectScope: this.analyticsSubjectScope
    });

    if (this.analyticsWeekRangeLabel) {
      this.analyticsWeekRangeLabel.textContent = data.selectedWeekLabel;
    }
    if (this.btnAnalyticsNextWeek) {
      this.btnAnalyticsNextWeek.disabled = this.analyticsWeekOffset >= 0;
    }
    if (this.btnAnalyticsThisWeek) {
      this.btnAnalyticsThisWeek.disabled = this.analyticsWeekOffset === 0;
    }
    if (this.analyticsWeekSelect) {
      const weeksDesc = [...data.weeklyHistory].reverse();
      this.analyticsWeekSelect.innerHTML = weeksDesc.map((w) => {
        const prefix = w.weekOffset === 0 ? 'This Week: ' : w.weekOffset === -1 ? 'Last Week: ' : '';
        return `<option value="${w.weekOffset}" ${w.isSelected ? 'selected' : ''}>${prefix}${escapeHTML(w.label)} (${w.formattedTime})</option>`;
      }).join('');
    }
    if (this.btnAnalyticsScopeWeek && this.btnAnalyticsScopeAll) {
      this.btnAnalyticsScopeWeek.classList.toggle('active', this.analyticsSubjectScope === 'week');
      this.btnAnalyticsScopeAll.classList.toggle('active', this.analyticsSubjectScope === 'all');
    }

    if (this.analyticsWeekKpiLabel) {
      this.analyticsWeekKpiLabel.textContent = this.analyticsWeekOffset === 0 ? "This Week's Focus" : 'Selected Week Focus';
    }
    if (this.analyticsWeekTime) {
      const weekHours = Math.floor(data.weekSec / 3600);
      const weekMins = Math.round((data.weekSec % 3600) / 60);
      this.analyticsWeekTime.textContent = `${weekHours}h ${weekMins}m`;
    }
    if (this.analyticsWeekTarget) {
      const diffMins = Math.round((data.weekSec - data.prevWeekSec) / 60);
      const diffStr = diffMins === 0
        ? 'same as prev week'
        : `${diffMins > 0 ? '+' : '-'}${Math.floor(Math.abs(diffMins) / 60) > 0 ? `${Math.floor(Math.abs(diffMins) / 60)}h ` : ''}${Math.abs(diffMins) % 60}m vs prev week`;
      this.analyticsWeekTarget.textContent = `${data.weekSessionsCount} session${data.weekSessionsCount === 1 ? '' : 's'} • ${diffStr}`;
    }
    if (this.analyticsTotalTime) {
      const totalHours = Math.floor(data.totalSec / 3600);
      const totalMins = Math.round((data.totalSec % 3600) / 60);
      this.analyticsTotalTime.textContent = `${totalHours}h ${totalMins}m`;
    }
    if (this.analyticsTotalSessions) {
      const avgAllMins = data.totalSessions > 0 ? Math.round((data.totalSec / 60) / data.totalSessions) : 0;
      this.analyticsTotalSessions.textContent = `${data.totalSessions} session${data.totalSessions === 1 ? '' : 's'} • ${avgAllMins}m avg`;
    }
    if (this.analyticsActiveDays) {
      this.analyticsActiveDays.textContent = `${data.activeDaysCount} / 7`;
    }
    if (this.analyticsActiveDaysSub) {
      const bestDay = data.dailyTrend.reduce((best, d) => (d.durationMins > best.durationMins ? d : best), { durationMins: 0, label: '' });
      this.analyticsActiveDaysSub.textContent = bestDay.durationMins > 0
        ? `Peak: ${bestDay.label} (${bestDay.durationMins >= 60 ? `${(bestDay.durationMins / 60).toFixed(1)}h` : `${bestDay.durationMins}m`})`
        : 'No sessions this week';
    }
    if (this.analyticsTasksDone) {
      this.analyticsTasksDone.textContent = `${data.completedTasks} / ${data.totalTasks}`;
    }
    if (this.analyticsTasksRate) {
      this.analyticsTasksRate.textContent = `${data.completionRate}% completion rate`;
    }

    if (this.analyticsWeeklyBars) {
      const maxDailyMins = Math.max(60, ...data.dailyTrend.map((d) => d.durationMins));
      if (this.analyticsTrendTotal) {
        this.analyticsTrendTotal.textContent = `${(data.weekSec / 3600).toFixed(1)}h total`;
      }
      this.analyticsWeeklyBars.innerHTML = data.dailyTrend.map((d) => {
        const heightPct = Math.round((d.durationMins / maxDailyMins) * 100);
        const displayVal = d.durationMins > 0 ? (d.durationMins >= 60 ? `${(d.durationMins / 60).toFixed(1)}h` : `${d.durationMins}m`) : '0m';
        return `
          <div class="weekly-bar-col ${d.isToday ? 'today' : ''}" title="${d.dateStr}: ${displayVal} (${d.sessionCount} session${d.sessionCount === 1 ? '' : 's'})">
            <span class="weekly-bar-val">${displayVal}</span>
            <div class="weekly-bar-track">
              <div class="weekly-bar-fill" style="height: ${d.durationMins > 0 ? Math.max(6, heightPct) : 2}%;"></div>
            </div>
            <span class="weekly-bar-label">${d.label}</span>
          </div>
        `;
      }).join('');
    }

    if (this.analyticsHistoryWeeksBars) {
      const recentWeeks = data.weeklyHistory.slice(-8);
      const maxWeekMins = Math.max(60, ...recentWeeks.map((w) => w.durationMins));
      const recordedWeeksCount = data.weeklyHistory.filter((w) => w.durationSec > 0).length;
      if (this.analyticsHistoryWeeksBadge) {
        this.analyticsHistoryWeeksBadge.textContent = `${recordedWeeksCount} week${recordedWeeksCount === 1 ? '' : 's'} recorded`;
      }
      this.analyticsHistoryWeeksBars.innerHTML = recentWeeks.map((w) => {
        const heightPct = Math.round((w.durationMins / maxWeekMins) * 100);
        const displayVal = w.durationMins > 0 ? (w.durationMins >= 60 ? `${w.durationHours}h` : `${w.durationMins}m`) : '0m';
        return `
          <button type="button" class="weekly-bar-col history-week-btn ${w.isSelected ? 'selected-week' : ''} ${w.isCurrentWeek ? 'today' : ''}" data-week-offset="${w.weekOffset}" title="${escapeHTML(w.label)}: ${w.formattedTime} (${w.sessionCount} sessions) — Click to inspect">
            <span class="weekly-bar-val">${displayVal}</span>
            <div class="weekly-bar-track">
              <div class="weekly-bar-fill" style="height: ${w.durationMins > 0 ? Math.max(6, heightPct) : 2}%;"></div>
            </div>
            <span class="weekly-bar-label">${escapeHTML(w.shortLabel)}</span>
          </button>
        `;
      }).join('');
    }

    if (this.analyticsSubjectShare) {
      if (data.subjectBreakdown.length === 0) {
        this.analyticsSubjectShare.innerHTML = `
          <div class="empty-state" style="padding: 1.25rem; font-size: 0.82rem; color: var(--text-muted); text-align: center;">
            ${this.analyticsSubjectScope === 'week' ? 'No study sessions recorded in this week yet.' : 'No course study hours recorded yet.'}
          </div>
        `;
      } else {
        const dayNamesShort = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
        this.analyticsSubjectShare.innerHTML = data.subjectBreakdown.map((sb) => {
          const isActiveFilter = this.historySubjectFilter === sb.name;
          const maxSubDay = Math.max(1, ...sb.dailyMins);
          const safeSbColor = sanitizeCssColor(sb.color);
          return `
            <div class="subject-detail-card ${isActiveFilter ? 'active-filter' : ''}" data-subject="${escapeHTML(sb.name)}" title="Click to filter Session Activity Log by ${escapeHTML(sb.name)}">
              <div class="subject-detail-top">
                <div class="subject-detail-identity">
                  <span class="share-dot" style="background-color: ${safeSbColor};"></span>
                  <span class="subject-detail-name">${escapeHTML(sb.name)}</span>
                  <span class="subject-detail-group">${escapeHTML(sb.group)}</span>
                </div>
                <div class="subject-detail-totals">
                  <strong class="subject-detail-time">${escapeHTML(sb.formattedTime)}</strong>
                  <span class="subject-detail-pct">${sb.percentage}% share</span>
                </div>
              </div>
              <div class="share-bar-track">
                <div class="share-bar-fill" style="width: ${sb.percentage}%; background-color: ${safeSbColor};"></div>
              </div>
              <div class="subject-detail-meta">
                <span>${sb.sessionCount} session${sb.sessionCount === 1 ? '' : 's'}</span>
                <span>•</span>
                <span>Avg ${sb.avgSessionMins}m</span>
                ${sb.goalPct !== null ? `<span>•</span><span>Weekly goal: ${sb.durationHours}h / ${sb.weeklyGoalHours}h (${sb.goalPct}%)</span>` : ''}
                ${sb.lastStudiedStr ? `<span>•</span><span>Last: ${escapeHTML(sb.lastStudiedStr)}</span>` : ''}
              </div>
              ${this.analyticsSubjectScope === 'week' ? `
                <div class="subject-mini-week">
                  ${sb.dailyMins.map((dm, idx) => {
                    const hPct = dm > 0 ? Math.max(20, Math.round((dm / maxSubDay) * 100)) : 0;
                    return `
                      <div class="subject-mini-day" title="${dayNamesShort[idx]}: ${dm}m">
                        <div class="subject-mini-bar-wrap">
                          <div class="subject-mini-bar" style="height: ${hPct}%; background-color: ${dm > 0 ? safeSbColor : 'transparent'};"></div>
                        </div>
                        <span class="subject-mini-label">${dayNamesShort[idx]}</span>
                      </div>
                    `;
                  }).join('')}
                </div>
              ` : ''}
            </div>
          `;
        }).join('');
      }
    }

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
      const sDate = new Date(sess.startTime || sess.endTime || sess.createdAt);
      let dateLabel = sDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      if (sDate.toDateString() === todayStr) dateLabel = 'Today';
      else if (sDate.toDateString() === yesterday) dateLabel = 'Yesterday';
      if (!groups[dateLabel]) groups[dateLabel] = [];
      groups[dateLabel].push(sess);
    });

    Object.entries(groups).forEach(([dateLabel, items]) => {
      const groupEl = document.createElement('div');
      groupEl.className = 'history-group';

      const totalGroupSecs = items.reduce((acc, i) => acc + (i.durationSec || 0), 0);
      const groupMins = Math.round(totalGroupSecs / 60);

      groupEl.innerHTML = `
        <div class="history-group-header">
          <span class="group-date">${escapeHTML(dateLabel)}</span>
          <span class="group-total">${groupMins} mins total</span>
        </div>
      `;

      items.forEach((sess) => {
        const color = sanitizeCssColor(store.getSubjectColor(sess.subject));
        const safeSessId = escapeHTML(sess.id);
        const mins = Math.max(1, Math.round(sess.durationSec / 60));
        const startTimeStr = sess.startTime ? new Date(sess.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const endTimeStr = sess.endTime ? new Date(sess.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const isMidnightSess = store.isMidnightTimestamp(sess.startTime || sess.endTime);

        const card = document.createElement('div');
        card.className = 'history-card';
        card.innerHTML = `
          <div class="history-card-main">
            <div class="history-time-col">
              <span class="history-duration-pill">${mins}m</span>
              <span class="history-clock">${escapeHTML(startTimeStr)} - ${escapeHTML(endTimeStr)}</span>
            </div>
            <div class="history-details-col">
              <div class="history-title-row">
                <span class="subject-badge" style="--badge-color: ${color}">${escapeHTML(sess.subject || 'General')}</span>
                <strong class="history-topic">${escapeHTML(sess.topic || 'Focus Session')}</strong>
                ${isMidnightSess ? `<span class="meta-badge midnight-badge" title="Studied during midnight hours (00:00–04:59)">🌙 Midnight</span>` : ''}
              </div>
              ${sess.notes ? `
                <div class="history-notes-box">
                  <div class="notes-header">Study Notes & Takeaways:</div>
                  <div class="notes-body">${escapeHTML(sess.notes)}</div>
                </div>
              ` : ''}
            </div>
          </div>
          <div class="history-actions">
            <button type="button" class="btn btn-icon btn-delete-history" data-id="${safeSessId}" title="Delete session log" aria-label="Delete session log">✕</button>
          </div>
        `;

        groupEl.appendChild(card);
      });

      this.historyListContainer.appendChild(groupEl);
    });
  }
}
