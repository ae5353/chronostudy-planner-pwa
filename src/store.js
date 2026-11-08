// ChronoStudy Reactive State Store, SM-2 Algorithm, & Calendar/Backup Exporters

const STORAGE_KEY = 'chronostudy_state_v1';

export function getTodayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function addDaysISO(baseIso, days) {
  const d = new Date(baseIso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysUntil(targetIso) {
  const today = new Date(getTodayISO() + 'T00:00:00');
  const target = new Date(targetIso + 'T00:00:00');
  return Math.round((target - today) / 86400000);
}

function createDefaultState() {
  const today = getTodayISO();
  return {
    theme: 'light',
    activeTab: 'today', // 'today' | 'tasks' | 'program' | 'study' | 'focus'
    selectedDate: today,
    selectedProgramDay: new Date().getDay() === 0 ? 6 : new Date().getDay() - 1, // 0=Mon..6=Sun
    taskViewMode: 'list', // 'list' | 'matrix' | 'kanban'
    taskSubjectFilter: 'all',
    studySubTab: 'cards', // 'cards' | 'syllabus' | 'exams'

    stats: {
      totalFocusMinutes: 345,
      todayFocusMinutes: 75,
      completedPomodoros: 14,
      currentStreakDays: 6,
      lastActiveDate: today
    },

    subjects: [
      {
        id: 'subj-algo',
        name: 'Algorithms & Data Structures',
        code: 'CS-301',
        color: '#C85A32',
        examDate: addDaysISO(today, 12),
        targetHoursPerWeek: 8,
        loggedMinutes: 195
      },
      {
        id: 'subj-linalg',
        name: 'Linear Algebra & Matrix Theory',
        code: 'MATH-204',
        color: '#2B4C7E',
        examDate: addDaysISO(today, 19),
        targetHoursPerWeek: 6,
        loggedMinutes: 140
      },
      {
        id: 'subj-cogpsy',
        name: 'Cognitive Neuroscience',
        code: 'PSYC-210',
        color: '#2E7D5B',
        examDate: addDaysISO(today, 8),
        targetHoursPerWeek: 5,
        loggedMinutes: 110
      },
      {
        id: 'subj-sys',
        name: 'Distributed Systems Lab',
        code: 'CS-412',
        color: '#C6841D',
        examDate: addDaysISO(today, 5),
        targetHoursPerWeek: 7,
        loggedMinutes: 165
      },
      {
        id: 'subj-life',
        name: 'Personal & Wellness',
        code: 'LIFE',
        color: '#7A5C43',
        examDate: addDaysISO(today, 30),
        targetHoursPerWeek: 4,
        loggedMinutes: 60
      }
    ],

    tasks: [
      {
        id: 'task-1',
        title: 'Implement Dijkstra & A* shortest-path benchmark report',
        subjectId: 'subj-algo',
        quadrant: 'Q1', // Q1: Urgent & Important, Q2: Important Not Urgent, Q3: Urgent Not Important, Q4: Later
        status: 'in_progress', // 'todo' | 'in_progress' | 'done'
        completed: false,
        dueDate: today,
        estimatedPomodoros: 3,
        completedPomodoros: 1,
        notes: 'Compare binary heap vs Fibonacci heap asymptotic & empirical runtime.',
        subtasks: [
          { id: 'st-1', text: 'Write adjacency list graph generator', done: true },
          { id: 'st-2', text: 'Run 100k-node benchmark suite', done: true },
          { id: 'st-3', text: 'Plot latency curves & write conclusion', done: false }
        ]
      },
      {
        id: 'task-2',
        title: 'Complete Singular Value Decomposition (SVD) problem set #6',
        subjectId: 'subj-linalg',
        quadrant: 'Q1',
        status: 'todo',
        completed: false,
        dueDate: today,
        estimatedPomodoros: 2,
        completedPomodoros: 0,
        notes: 'Focus on orthogonal projection proofs and low-rank matrix approximation.',
        subtasks: [
          { id: 'st-4', text: 'Solve problems 1-4 (eigenvalue decomposition)', done: true },
          { id: 'st-5', text: 'Complete proof for pseudo-inverse stability', done: false }
        ]
      },
      {
        id: 'task-3',
        title: 'Synthesize literature review on Working Memory & Prefrontal Cortex',
        subjectId: 'subj-cogpsy',
        quadrant: 'Q2',
        status: 'todo',
        completed: false,
        dueDate: addDaysISO(today, 2),
        estimatedPomodoros: 4,
        completedPomodoros: 1,
        notes: 'Compare Baddeley model updates with modern fMRI findings.',
        subtasks: [
          { id: 'st-6', text: 'Annotate 5 primary journal articles', done: true },
          { id: 'st-7', text: 'Draft methodology comparison section', done: false }
        ]
      },
      {
        id: 'task-4',
        title: 'Debug Raft consensus leader election timeout edge case',
        subjectId: 'subj-sys',
        quadrant: 'Q1',
        status: 'in_progress',
        completed: false,
        dueDate: addDaysISO(today, 1),
        estimatedPomodoros: 3,
        completedPomodoros: 2,
        notes: 'Check randomized election timer reset when AppendEntries heartbeat arrives.',
        subtasks: []
      },
      {
        id: 'task-5',
        title: 'Submit lab partner peer-evaluation form & sync calendar',
        subjectId: 'subj-sys',
        quadrant: 'Q3',
        status: 'todo',
        completed: false,
        dueDate: today,
        estimatedPomodoros: 1,
        completedPomodoros: 0,
        notes: 'Quick administrative form on course portal.',
        subtasks: []
      },
      {
        id: 'task-6',
        title: '35-minute evening mobility & zone-2 run',
        subjectId: 'subj-life',
        quadrant: 'Q2',
        status: 'done',
        completed: true,
        dueDate: today,
        estimatedPomodoros: 1,
        completedPomodoros: 1,
        notes: 'Outdoor track or treadmill recovery pace.',
        subtasks: []
      }
    ],

    // Daily time-blocked schedule keyed by date or list with date
    scheduleBlocks: [
      {
        id: 'blk-1',
        date: today,
        startTime: '08:30',
        endTime: '10:00',
        title: 'Deep Study: Algorithms Graph Theory & A* Heuristics',
        subjectId: 'subj-algo',
        category: 'deep_work',
        done: true
      },
      {
        id: 'blk-2',
        date: today,
        startTime: '10:30',
        endTime: '12:00',
        title: 'Lecture: Linear Algebra — Spectral Theorem & SVD',
        subjectId: 'subj-linalg',
        category: 'lecture',
        done: true
      },
      {
        id: 'blk-3',
        date: today,
        startTime: '13:30',
        endTime: '15:00',
        title: 'Distributed Systems Lab: Raft Log Replication',
        subjectId: 'subj-sys',
        category: 'deep_work',
        done: false
      },
      {
        id: 'blk-4',
        date: today,
        startTime: '15:30',
        endTime: '16:30',
        title: 'SM-2 Active Recall Flashcard Review + Problem Set #6',
        subjectId: 'subj-linalg',
        category: 'review',
        done: false
      },
      {
        id: 'blk-5',
        date: today,
        startTime: '17:30',
        endTime: '18:15',
        title: 'Zone-2 Run & Mobility Reset',
        subjectId: 'subj-life',
        category: 'wellness',
        done: false
      },
      {
        id: 'blk-6',
        date: today,
        startTime: '19:30',
        endTime: '21:00',
        title: 'Cognitive Neuroscience Paper Synthesis',
        subjectId: 'subj-cogpsy',
        category: 'deep_work',
        done: false
      }
    ],

    // Recurring Weekly Program Template (0=Mon .. 6=Sun)
    weeklyProgram: {
      0: [
        { id: 'wp-m1', startTime: '08:30', endTime: '10:00', title: 'Algorithms Deep Work Block', subjectId: 'subj-algo', type: 'Deep Study' },
        { id: 'wp-m2', startTime: '10:30', endTime: '12:00', title: 'Linear Algebra Lecture', subjectId: 'subj-linalg', type: 'Lecture' },
        { id: 'wp-m3', startTime: '14:00', endTime: '16:00', title: 'Distributed Systems Coding Lab', subjectId: 'subj-sys', type: 'Lab' },
        { id: 'wp-m4', startTime: '17:30', endTime: '18:30', title: 'Strength & Mobility Conditioning', subjectId: 'subj-life', type: 'Wellness' }
      ],
      1: [
        { id: 'wp-tu1', startTime: '09:00', endTime: '10:30', title: 'Cognitive Neuroscience Seminar', subjectId: 'subj-cogpsy', type: 'Lecture' },
        { id: 'wp-tu2', startTime: '11:00', endTime: '12:30', title: 'SM-2 Spaced Repetition & Problem Sets', subjectId: 'subj-linalg', type: 'Review' },
        { id: 'wp-tu3', startTime: '15:00', endTime: '17:00', title: 'Algorithms Competitive Problem Solving', subjectId: 'subj-algo', type: 'Deep Study' }
      ],
      2: [
        { id: 'wp-w1', startTime: '08:30', endTime: '10:00', title: 'Algorithms Lecture & Recitation', subjectId: 'subj-algo', type: 'Lecture' },
        { id: 'wp-w2', startTime: '10:30', endTime: '12:00', title: 'Linear Algebra Lecture', subjectId: 'subj-linalg', type: 'Lecture' },
        { id: 'wp-w3', startTime: '14:00', endTime: '16:30', title: 'Distributed Systems Architecture Studio', subjectId: 'subj-sys', type: 'Deep Study' }
      ],
      3: [
        { id: 'wp-th1', startTime: '09:00', endTime: '10:30', title: 'Cognitive Neuroscience Seminar', subjectId: 'subj-cogpsy', type: 'Lecture' },
        { id: 'wp-th2', startTime: '11:00', endTime: '13:00', title: 'Linear Algebra Proof Workshop', subjectId: 'subj-linalg', type: 'Deep Study' },
        { id: 'wp-th3', startTime: '15:30', endTime: '17:00', title: 'Weekly Paper Reading & Synthesis', subjectId: 'subj-cogpsy', type: 'Review' }
      ],
      4: [
        { id: 'wp-f1', startTime: '09:00', endTime: '11:00', title: 'Mock Exam & Timed Practice Set', subjectId: 'subj-algo', type: 'Review' },
        { id: 'wp-f2', startTime: '11:30', endTime: '13:00', title: 'Systems Debugging & Code Review', subjectId: 'subj-sys', type: 'Lab' },
        { id: 'wp-f3', startTime: '15:00', endTime: '16:00', title: 'Weekly Retrospective & Next Week Planning', subjectId: 'subj-life', type: 'Planning' }
      ],
      5: [
        { id: 'wp-sa1', startTime: '10:00', endTime: '12:00', title: 'Saturday Deep Synthesis & Project Build', subjectId: 'subj-sys', type: 'Deep Study' },
        { id: 'wp-sa2', startTime: '14:00', endTime: '15:00', title: 'Full Deck SM-2 Spaced Repetition Catch-up', subjectId: 'subj-cogpsy', type: 'Review' }
      ],
      6: [
        { id: 'wp-su1', startTime: '10:30', endTime: '12:00', title: 'Light Concept Review & Reading', subjectId: 'subj-linalg', type: 'Review' },
        { id: 'wp-su2', startTime: '16:30', endTime: '17:30', title: 'Weekly Time-Block Blueprint & Reset', subjectId: 'subj-life', type: 'Planning' }
      ]
    },

    // SM-2 Spaced Repetition Flashcards
    flashcards: [
      {
        id: 'fc-1',
        subjectId: 'subj-algo',
        prompt: 'What is the time complexity of Dijkstra’s algorithm using a Fibonacci Heap vs. a Binary Heap?',
        answer: 'Fibonacci Heap: O(E + V log V) because Decrease-Key is O(1) amortized. Binary Heap: O((V + E) log V).',
        interval: 1,
        repetitions: 1,
        efactor: 2.5,
        dueDate: today
      },
      {
        id: 'fc-2',
        subjectId: 'subj-linalg',
        prompt: 'State the Fundamental Theorem of Linear Algebra for the four subspaces of an m × n matrix A of rank r.',
        answer: 'Col(A) has dim r in R^m (orth. complement Null(A^T), dim m-r). Row(A) has dim r in R^n (orth. complement Null(A), dim n-r).',
        interval: 1,
        repetitions: 2,
        efactor: 2.6,
        dueDate: today
      },
      {
        id: 'fc-3',
        subjectId: 'subj-sys',
        prompt: 'In the Raft consensus algorithm, what guarantees the Leader Completeness Property?',
        answer: 'RequestVote RPC restriction: a voter denies its vote if the candidate’s log is less up-to-date than its own (compared by lastLogTerm, then lastLogIndex).',
        interval: 2,
        repetitions: 1,
        efactor: 2.4,
        dueDate: today
      },
      {
        id: 'fc-4',
        subjectId: 'subj-cogpsy',
        prompt: 'How does the Episodic Buffer in Baddeley’s working memory model interact with long-term memory?',
        answer: 'It acts as a limited-capacity multimodal interface binding visual, phonological, and semantic information into coherent episodes linked to LTM.',
        interval: 3,
        repetitions: 2,
        efactor: 2.5,
        dueDate: today
      },
      {
        id: 'fc-5',
        subjectId: 'subj-linalg',
        prompt: 'Why does the Singular Value Decomposition A = U Σ V^T exist for EVERY matrix, unlike eigendecomposition?',
        answer: 'Because A^T A is always symmetric and positive semi-definite, guaranteeing orthonormal eigenvectors V and non-negative real singular values σ_i = √λ_i.',
        interval: 4,
        repetitions: 3,
        efactor: 2.7,
        dueDate: addDaysISO(today, 1)
      }
    ],

    // Syllabus Topics for Mastery Tracking
    syllabusTopics: [
      { id: 'syl-1', subjectId: 'subj-algo', title: 'Shortest Paths (Dijkstra, Bellman-Ford, A*)', status: 'Reviewing', confidence: 85 },
      { id: 'syl-2', subjectId: 'subj-algo', title: 'Dynamic Programming & Memoization Proofs', status: 'Learning', confidence: 65 },
      { id: 'syl-3', subjectId: 'subj-algo', title: 'Network Flow & Max-Flow Min-Cut Theorem', status: 'Not Started', confidence: 20 },
      { id: 'syl-4', subjectId: 'subj-linalg', title: 'Orthogonal Projections & Least Squares', status: 'Mastered', confidence: 95 },
      { id: 'syl-5', subjectId: 'subj-linalg', title: 'Singular Value Decomposition (SVD) & PCA', status: 'Learning', confidence: 70 },
      { id: 'syl-6', subjectId: 'subj-sys', title: 'Raft Leader Election & Log Replication', status: 'Reviewing', confidence: 88 },
      { id: 'syl-7', subjectId: 'subj-cogpsy', title: 'Prefrontal Executive Control & Attention Networks', status: 'Reviewing', confidence: 80 }
    ],

    habits: [
      { id: 'hab-1', name: '90m+ Deep Focus Block', streak: 6, completedToday: true },
      { id: 'hab-2', name: 'Zero SM-2 Reviews Overdue', streak: 4, completedToday: false },
      { id: 'hab-3', name: 'Plan Tomorrow Time-Blocks', streak: 9, completedToday: true },
      { id: 'hab-4', name: '30m Movement / Zone-2 Cardio', streak: 5, completedToday: true }
    ],

    focusSession: {
      mode: 'pomodoro', // 'pomodoro' (25) | 'deep' (50) | 'ultradian' (90) | 'break' (5)
      durationSeconds: 25 * 60,
      remainingSeconds: 25 * 60,
      isRunning: false,
      linkedTaskId: 'task-1',
      linkedSubjectId: 'subj-algo',
      soundscape: 'off'
    }
  };
}

class Store {
  constructor() {
    this.listeners = new Set();
    this.state = this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createDefaultState();
      const parsed = JSON.parse(raw);
      return { ...createDefaultState(), ...parsed };
    } catch (_) {
      return createDefaultState();
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (_) {}
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    this.save();
    this.listeners.forEach((fn) => fn(this.state));
  }

  update(updater) {
    updater(this.state);
    this.notify();
  }

  resetToDemo() {
    this.state = createDefaultState();
    this.notify();
  }

  // SuperMemo-2 (SM-2) Algorithm Implementation
  // quality: 0 (Again), 3 (Hard), 4 (Good), 5 (Easy)
  reviewFlashcard(cardId, quality) {
    this.update((s) => {
      const card = s.flashcards.find((c) => c.id === cardId);
      if (!card) return;

      let { repetitions, interval, efactor } = card;
      if (quality < 3) {
        repetitions = 0;
        interval = 1;
      } else {
        if (repetitions === 0) {
          interval = 1;
        } else if (repetitions === 1) {
          interval = 3;
        } else {
          interval = Math.max(1, Math.round(interval * efactor));
        }
        repetitions += 1;
      }

      efactor = efactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
      if (efactor < 1.3) efactor = 1.3;

      card.repetitions = repetitions;
      card.interval = interval;
      card.efactor = Number(efactor.toFixed(2));
      card.dueDate = addDaysISO(getTodayISO(), interval);
    });
  }

  // Apply Weekly Program for a given weekday (0=Mon..6=Sun) to selectedDate
  applyProgramToDate(weekdayIndex, targetDateIso) {
    let addedCount = 0;
    this.update((s) => {
      const templateBlocks = s.weeklyProgram[weekdayIndex] || [];
      const existingKeys = new Set(
        s.scheduleBlocks
          .filter((b) => b.date === targetDateIso)
          .map((b) => `${b.startTime}-${b.title}`)
      );

      templateBlocks.forEach((tpl) => {
        const key = `${tpl.startTime}-${tpl.title}`;
        if (!existingKeys.has(key)) {
          s.scheduleBlocks.push({
            id: 'blk-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            date: targetDateIso,
            startTime: tpl.startTime,
            endTime: tpl.endTime,
            title: tpl.title,
            subjectId: tpl.subjectId,
            category: tpl.type.toLowerCase().includes('lecture') ? 'lecture' : 'deep_work',
            done: false
          });
          addedCount++;
        }
      });

      s.scheduleBlocks.sort((a, b) => a.startTime.localeCompare(b.startTime));
    });
    return addedCount;
  }

  // Generate standard .ics iCalendar file content for mobile calendar apps
  exportICS() {
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ChronoStudy Planner//EN',
      'CALSCALE:GREGORIAN'
    ];

    this.state.scheduleBlocks.forEach((blk) => {
      const dateCompact = blk.date.replace(/-/g, '');
      const startCompact = blk.startTime.replace(':', '') + '00';
      const endCompact = blk.endTime.replace(':', '') + '00';
      lines.push(
        'BEGIN:VEVENT',
        `UID:${blk.id}@chronostudy.app`,
        `DTSTART:${dateCompact}T${startCompact}`,
        `DTEND:${dateCompact}T${endCompact}`,
        `SUMMARY:${blk.title}`,
        `DESCRIPTION:ChronoStudy Scheduled Block (${blk.category})`,
        'END:VEVENT'
      );
    });

    this.state.subjects.forEach((subj) => {
      if (subj.examDate) {
        const d = subj.examDate.replace(/-/g, '');
        lines.push(
          'BEGIN:VEVENT',
          `UID:exam-${subj.id}@chronostudy.app`,
          `DTSTART;VALUE=DATE:${d}`,
          `SUMMARY:EXAM / MILESTONE: ${subj.name} (${subj.code})`,
          'END:VEVENT'
        );
      }
    });

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }
}

export const store = new Store();
