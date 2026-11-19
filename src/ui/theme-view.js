// src/ui/theme-view.js — Theme, horology dial style, layout format & on-demand Google Font loader
import { store } from '../store.js';
import { playClickSound } from '../audio.js';
import { openModal, closeModal } from './modals.js';

const LAZY_FONT_URLS = {
  serif: 'https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,300;0,400;0,700;1,300;1,400&display=swap',
  mono: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap',
  cinzel: 'https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&display=swap',
  cormorant: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&display=swap'
};

export function ensureFontLoaded(fontStyle) {
  if (typeof document === 'undefined' || !document.head) return;
  const href = LAZY_FONT_URLS[fontStyle];
  if (!href) return;
  if (document.querySelector(`link[data-lazy-font="${fontStyle}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.setAttribute('data-lazy-font', fontStyle);
  document.head.appendChild(link);
}

const THEMES = [
  { id: 'slate', name: 'Studio Slate', desc: 'Neutral dark graphite with crisp blue accent. Distraction-free engineering craft.', colors: ['#0d1117', '#161b22', '#f0f3f6', '#3b82f6'] },
  { id: 'oled', name: 'Obsidian Black', desc: 'True pitch black (#000) for OLED panels. Ultra-sharp contrast and zero glare.', colors: ['#000000', '#0a0a0a', '#ffffff', '#e5e5e5'] },
  { id: 'light', name: 'Nordic Snow', desc: 'Clean paper white and soft zinc tones. Daytime clarity like Things 3 & Notion.', colors: ['#f6f8fa', '#ffffff', '#1f2328', '#0969da'] },
  { id: 'sepia', name: 'Warm Paper', desc: 'Warm cream and parchment with terracotta ink. Relaxed reading, easy on the eyes.', colors: ['#fbf7ee', '#f2ece0', '#2b251e', '#b85d19'] },
  { id: 'forest', name: 'Evergreen Pine', desc: 'Deep midnight botanical green and emerald highlights. Calming natural tone.', colors: ['#08100c', '#0f1c15', '#e8f5ed', '#10b981'] },
  { id: 'tokyo', name: 'Tokyo Night', desc: 'Deep indigo navy with soft velvet lavender. Elegant developer aesthetic.', colors: ['#12131d', '#181926', '#cad3f5', '#c6a0f6'] },
  { id: 'bibliotheca', name: 'Bibliotheca (Dark Academia)', desc: 'Warm walnut wood, aged bookbindings, brass trim, and amber candlelight.', colors: ['#13100d', '#1c1814', '#f5ede2', '#c59b27'] },
  { id: 'oxblood', name: 'Oxblood & Brass', desc: 'Victorian deep mahogany leather, gold chronometer bevels, and vintage ink.', colors: ['#12090b', '#1d0f13', '#f4e9df', '#d4af37'] },
  { id: 'parchment', name: 'Parchment Scriptorium', desc: 'Aged classical paper parchment with sepia chestnut ink and monastic calm.', colors: ['#f4ede0', '#e9e0d0', '#241d16', '#8b4513'] },
  { id: 'oxford', name: 'Oxford & Racing Green', desc: 'British academic racing green, saddle leather, and gold trim.', colors: ['#08110c', '#101e17', '#ede8dc', '#c59b27'] }
];

const FONTS = [
  { id: 'sans', name: 'Modern Sans', sample: 'Analysis & Folland Handout', desc: 'Clean geometric sans-serif for modern PC interfaces and dashboards.', previewStyle: 'font-family: -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", sans-serif;' },
  { id: 'serif', name: 'Editorial Serif', sample: 'Analysis & Folland Handout', desc: 'Authentic classical academic & bookish manuscript format for deep study & reading.', previewStyle: 'font-family: Merriweather, Georgia, serif;' },
  { id: 'mono', name: 'Technical Monospace', sample: 'Analysis & Folland Handout', desc: 'Precision terminal typewriter alignment with engineer focus.', previewStyle: 'font-family: "JetBrains Mono", Consolas, monospace;' },
  { id: 'humanist', name: 'Humanist Warm', sample: 'Analysis & Folland Handout', desc: 'Gentle, organic curve geometry for long study sessions without fatigue.', previewStyle: 'font-family: "Segoe UI", Ubuntu, sans-serif;' },
  { id: 'cinzel', name: 'Cinzel (Roman Antiqua)', sample: 'CHRONOMÈTRE • MCMXXVI', desc: 'Classical Greco-Roman inscriptional capital serif, perfect for pocket watch dials and horology precision.', previewStyle: 'font-family: "Cinzel", "Times New Roman", Georgia, serif; font-size: 0.95rem; letter-spacing: 0.08em;' },
  { id: 'cormorant', name: 'Cormorant Garamond', sample: 'Folland Handout & Advanced Calculus', desc: '16th-century classical Renaissance Garamond serif with intellectual elegance and scholarly gravitas.', previewStyle: 'font-family: "Cormorant Garamond", Charter, Garamond, serif; font-size: 1.15rem; font-style: italic;' }
];

const CADRANS = [
  { id: 'chronograph', name: 'Analog Mechanical Chronograph', desc: 'Bi-compax chronograph with 30-min counter and 60-sec running small-seconds subdials, tachymeter graduations, Roman numerals, and Breguet sweep needle with synthetic ruby pinion.' },
  { id: 'cadran', name: 'Classical Watch Cadran', desc: 'Antique pocket watch dial with Roman numerals XII–XI, railway 60-minute chapter track, and central balance hand.' },
  { id: 'minimal', name: 'Minimalist Orbit', desc: 'Modern distraction-free circular progress ring without dial markings or needle hands.' }
];

const LAYOUT_FORMATS = [
  { id: 'auto', name: '◈ Auto-Adaptive (Responsive)', desc: 'Automatically adapts to screen size. Uses widescreen dual dashboard on PC/tablets, and mobile format on phones.' },
  { id: 'mobile', name: '▯ Mobile Phone Format', desc: 'Optimized vertical layout for smartphones. Proportional timepiece, segmented Focus/Tasks switcher, swipeable filter chips, and ergonomic touch targets.' },
  { id: 'desktop', name: '◨ Tablet & PC Dashboard', desc: 'Classic widescreen dual-column dashboard with side-by-side timer and backlog. Preserves the exact PC layout on tablets.' }
];

const THEME_META_COLORS = {
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

export class ThemeViewController {
  constructor(ui) {
    this.ui = ui;
  }

  initDOM() {
    this.btnThemePalette = document.getElementById('btn-theme-palette');
    this.themeToggleBtn = document.getElementById('theme-toggle-btn');
    this.themeModal = document.getElementById('theme-modal');
    this.btnCloseThemeModal = document.getElementById('btn-close-theme-modal');
    this.btnDoneThemeModal = document.getElementById('btn-done-theme-modal');
    this.themePickerGrid = document.getElementById('theme-picker-grid');
    this.fontPickerGrid = document.getElementById('font-picker-grid');
    this.cadranPickerGrid = document.getElementById('cadran-picker-grid');
    this.layoutPickerGrid = document.getElementById('layout-picker-grid');
  }

  bindEvents() {
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
    if (this.themeModal) {
      this.themeModal.addEventListener('click', (e) => {
        if (e.target === this.themeModal) this.closeThemeModal();
      });
    }

    // Event delegation on theme modal picker grids
    if (this.themePickerGrid) {
      this.themePickerGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.theme-card');
        if (!card) return;
        const themeId = card.dataset.themeId;
        this.applyTheme(themeId);
        store.updateSettings({ theme: themeId });
        this.renderThemeModal();
        playClickSound();
      });
    }
    if (this.fontPickerGrid) {
      this.fontPickerGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.font-card');
        if (!card) return;
        const fontId = card.dataset.fontId;
        this.applyFont(fontId);
        store.updateSettings({ fontStyle: fontId });
        this.renderThemeModal();
        playClickSound();
      });
    }
    if (this.cadranPickerGrid) {
      this.cadranPickerGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.cadran-card');
        if (!card) return;
        const cadranId = card.dataset.cadranId;
        this.applyTimerStyle(cadranId);
        store.updateSettings({ timerStyle: cadranId });
        this.renderThemeModal();
        playClickSound();
      });
    }
    if (this.layoutPickerGrid) {
      this.layoutPickerGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.layout-card');
        if (!card) return;
        const layoutId = card.dataset.layoutId;
        this.applyLayoutFormat(layoutId);
        store.updateSettings({ layoutFormat: layoutId });
        this.renderThemeModal();
        playClickSound();
      });
    }
  }

  applyTheme(theme) {
    const validThemes = Object.keys(THEME_META_COLORS);
    let normalized = theme === 'dark' ? 'slate' : theme;
    if (!validThemes.includes(normalized)) normalized = 'slate';
    if (this._appliedTheme === normalized) return;
    this._appliedTheme = normalized;

    document.documentElement.setAttribute('data-theme', normalized);
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor && THEME_META_COLORS[normalized]) {
      metaThemeColor.setAttribute('content', THEME_META_COLORS[normalized]);
    }
    if (this.themeToggleBtn) {
      this.themeToggleBtn.innerHTML = (normalized === 'light' || normalized === 'sepia' || normalized === 'parchment') ? '🌙' : '☀️';
    }
  }

  applyFont(fontStyle) {
    const validFonts = ['sans', 'serif', 'mono', 'humanist', 'cinzel', 'cormorant'];
    const normalized = validFonts.includes(fontStyle) ? fontStyle : 'sans';
    ensureFontLoaded(normalized);
    if (this._appliedFont === normalized) return;
    this._appliedFont = normalized;
    document.documentElement.setAttribute('data-font', normalized);
  }

  applyTimerStyle(style) {
    const validStyles = ['chronograph', 'cadran', 'minimal'];
    let normalized = style === 'chronometer' ? 'chronograph' : style;
    if (!validStyles.includes(normalized)) normalized = 'chronograph';
    if (this._appliedTimerStyle === normalized) return;
    this._appliedTimerStyle = normalized;
    [this.ui.timerView?.timerCircleWrap, this.ui.timerView?.zenCircleWrap].forEach((el) => {
      if (el) {
        el.classList.remove('timer-style-cadran', 'timer-style-chronometer', 'timer-style-chronograph', 'timer-style-minimal');
        el.classList.add(`timer-style-${normalized}`);
      }
    });
  }

  applyLayoutFormat(format) {
    const validFormats = ['auto', 'mobile', 'desktop'];
    const normalized = validFormats.includes(format) ? format : 'auto';
    document.documentElement.setAttribute('data-layout-format', normalized);
    document.body.classList.remove('layout-format-auto', 'layout-format-mobile', 'layout-format-desktop');
    document.body.classList.add(`layout-format-${normalized}`);
    this.ui.handleLayoutResize();
    this.renderLayoutPicker();
  }

  isMobileLayoutActive() {
    const format = store.getState().settings.layoutFormat || 'auto';
    if (format === 'mobile') return true;
    if (format === 'desktop') return false;
    return typeof window !== 'undefined' && window.innerWidth <= 768;
  }

  openThemeModal() {
    if (!this.themeModal) return;
    Object.keys(LAZY_FONT_URLS).forEach((k) => ensureFontLoaded(k));
    this.renderThemeModal();
    openModal(this.themeModal);
  }

  closeThemeModal() {
    if (this.themeModal) closeModal(this.themeModal);
  }

  renderThemeModal() {
    if (!this.themePickerGrid) return;
    const currentTheme = store.getState().settings.theme || 'slate';
    const effectiveTheme = currentTheme === 'dark' ? 'slate' : currentTheme;

    this.themePickerGrid.innerHTML = THEMES.map((t) => `
      <div class="theme-card ${t.id === effectiveTheme ? 'active' : ''}" data-theme-id="${t.id}">
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
    `).join('');

    if (this.fontPickerGrid) {
      const currentFont = store.getState().settings.fontStyle || 'sans';
      this.fontPickerGrid.innerHTML = FONTS.map((f) => `
        <div class="font-card ${f.id === currentFont ? 'active' : ''}" data-font-id="${f.id}">
          <div class="font-preview-sample" style="${f.previewStyle}">${f.sample}</div>
          <div class="font-name">${f.name}</div>
          <div class="font-desc">${f.desc}</div>
          <span class="font-active-check">✓</span>
        </div>
      `).join('');
    }

    if (this.cadranPickerGrid) {
      const rawCadran = store.getState().settings.timerStyle || 'chronograph';
      const currentCadran = rawCadran === 'chronometer' ? 'chronograph' : rawCadran;
      this.cadranPickerGrid.innerHTML = CADRANS.map((c) => `
        <div class="cadran-card ${c.id === currentCadran ? 'active' : ''}" data-cadran-id="${c.id}">
          <div class="cadran-card-title"><span>${c.name}</span></div>
          <div class="cadran-card-desc">${c.desc}</div>
        </div>
      `).join('');
    }

    this.renderLayoutPicker();
  }

  renderLayoutPicker() {
    if (!this.layoutPickerGrid) return;
    const currentFormat = store.getState().settings.layoutFormat || 'auto';
    this.layoutPickerGrid.innerHTML = LAYOUT_FORMATS.map((f) => `
      <div class="cadran-card layout-card ${f.id === currentFormat ? 'active' : ''}" data-layout-id="${f.id}">
        <div class="cadran-card-title"><span>${f.name}</span></div>
        <div class="cadran-card-desc">${f.desc}</div>
      </div>
    `).join('');
  }
}
