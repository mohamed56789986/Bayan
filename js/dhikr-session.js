/**
 * منصة البيان — محرك جلسات الأذكار (Dhikr Session Engine)
 * محرك موحد، تفاعلي، وقابل لإعادة الاستخدام في أذكار الصباح وأذكار المساء
 */

class DhikrSessionEngine {
  constructor(config) {
    this.sessionType = config.sessionType; // 'morning' | 'evening'
    this.sessionTitle = config.sessionTitle; // 'أذكار الصباح' | 'أذكار المساء'
    this.items = config.items || [];
    this.currentIndex = 0;
    this.currentCount = 0;
    this.isCompleted = false;

    // DOM Elements
    this.container = document.getElementById('session-wrapper');
    this.progressBar = document.getElementById('session-progress-fill');
    this.progressText = document.getElementById('session-step-counter');
    this.titleTag = document.getElementById('session-title-tag');

    this.init();
  }

  init() {
    if (!this.container) {
      console.warn('Session wrapper element not found.');
      return;
    }

    if (!this.items.length) {
      console.warn('No dhikr items loaded.');
      return;
    }

    // Set page / session title
    if (this.titleTag) {
      this.titleTag.textContent = this.sessionTitle;
    }

    // Load saved progress
    const saved = window.StorageManager ? window.StorageManager.loadProgress(this.sessionType) : null;
    if (saved && typeof saved.currentIndex === 'number') {
      if (saved.currentIndex >= this.items.length) {
        // Was completed, give fresh start
        this.currentIndex = 0;
        this.currentCount = 0;
      } else {
        this.currentIndex = Math.min(Math.max(saved.currentIndex, 0), this.items.length - 1);
        this.currentCount = Math.min(saved.currentCount || 0, this.items[this.currentIndex].repetitions);
      }
    }

    this.render();
    this.initKeyboardNavigation();
  }

  getCurrentItem() {
    return this.items[this.currentIndex];
  }

  saveState() {
    if (!window.StorageManager) return;
    const total = this.items.length;
    const percent = Math.round(((this.currentIndex) / total) * 100);

    window.StorageManager.saveProgress(this.sessionType, {
      currentIndex: this.currentIndex,
      currentCount: this.currentCount,
      totalItems: total,
      progressPercent: percent
    });

    window.StorageManager.saveLastSession({
      type: this.sessionType,
      title: this.sessionTitle,
      currentIndex: this.currentIndex,
      totalItems: total,
      progressPercent: percent
    });
  }

  render() {
    if (this.isCompleted) {
      this.renderCompletionScreen();
      return;
    }

    const item = this.getCurrentItem();
    const total = this.items.length;
    const percent = Math.round(((this.currentIndex) / total) * 100);

    // Update Progress
    if (this.progressBar) {
      this.progressBar.style.width = `${percent}%`;
    }
    if (this.progressText) {
      this.progressText.textContent = `الذكر ${this.currentIndex + 1} من ${total}`;
    }

    // Render Dhikr Card
    const escapeHtml = window.App.escapeHtml;
    this.container.innerHTML = `
      <div class="dhikr-card" id="active-dhikr-card">
        ${item.virtue ? `<div class="dhikr-virtue-pill">✨ ${escapeHtml(item.virtue)}</div>` : ''}

        <div class="dhikr-text" id="dhikr-text-content">${escapeHtml(item.text)}</div>

        <div class="dhikr-source">المصدر: ${escapeHtml(item.source)}</div>

        <div class="counter-box">
          <button class="tap-counter-btn" id="dhikr-tap-btn" aria-label="اضغط للعد: تم ${this.currentCount} من ${item.repetitions}">
            <span class="tap-btn-label">تم</span>
            <span class="tap-btn-count">${this.currentCount} / ${item.repetitions}</span>
          </button>
          <span class="tap-hint-text">اضغط على الدائرة أو اضغط مفتاح المسافة (Space)</span>
        </div>

        <div class="dhikr-controls-bar">
          <button class="control-btn" id="prev-dhikr-btn" ${this.currentIndex === 0 ? 'disabled' : ''} aria-label="الذكر السابق">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            السابق
          </button>

          <div style="display: flex; gap: 8px;">
            <button class="control-btn" id="copy-dhikr-btn" aria-label="نسخ هذا الذكر">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              نسخ
            </button>
            <button class="control-btn" id="share-dhikr-btn" aria-label="مشاركة هذا الذكر">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
              مشاركة
            </button>
          </div>

          <button class="control-btn" id="next-dhikr-btn" aria-label="الذكر التالي">
            التالي
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
        </div>
      </div>
    `;

    this.attachCardListeners();
  }

  attachCardListeners() {
    const tapBtn = document.getElementById('dhikr-tap-btn');
    const prevBtn = document.getElementById('prev-dhikr-btn');
    const nextBtn = document.getElementById('next-dhikr-btn');
    const copyBtn = document.getElementById('copy-dhikr-btn');
    const shareBtn = document.getElementById('share-dhikr-btn');

    if (tapBtn) {
      tapBtn.addEventListener('click', () => this.handleTap());
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.previous());
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.next());
    }

    const item = this.getCurrentItem();
    if (copyBtn && window.App) {
      copyBtn.addEventListener('click', () => {
        window.App.copyText(`${item.text}\n\nالمصدر: ${item.source}`);
      });
    }

    if (shareBtn && window.App) {
      shareBtn.addEventListener('click', () => {
        window.App.shareContent({
          title: `${this.sessionTitle} — منصة البيان`,
          text: `${item.text}\n\nالمصدر: ${item.source}`
        });
      });
    }
  }

  handleTap() {
    const item = this.getCurrentItem();
    if (this.currentCount < item.repetitions) {
      this.currentCount++;

      // Subtle haptic feedback if device supports it
      if ('vibrate' in navigator) {
        try { navigator.vibrate(25); } catch (e) {}
      }

      if (this.currentCount >= item.repetitions) {
        // Completed required repetitions for this dhikr
        this.saveState();
        if (this.currentIndex < this.items.length - 1) {
          // Subtle pulse and advance after short pleasant pause
          setTimeout(() => {
            this.currentIndex++;
            this.currentCount = 0;
            this.saveState();
            this.render();
          }, 250);
        } else {
          // Reached the end of the session!
          setTimeout(() => {
            this.completeSession();
          }, 300);
        }
      } else {
        this.saveState();
        this.render();
      }
    }
  }

  next() {
    if (this.currentIndex < this.items.length - 1) {
      this.currentIndex++;
      this.currentCount = 0;
      this.saveState();
      this.render();
    } else {
      this.completeSession();
    }
  }

  previous() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.currentCount = 0;
      this.saveState();
      this.render();
    }
  }

  completeSession() {
    this.isCompleted = true;

    // Record session completion and update streak
    if (window.StorageManager) {
      window.StorageManager.recordSessionCompletion(this.sessionType);
      window.StorageManager.clearProgress(this.sessionType);
      window.StorageManager.clearLastSession();
    }

    if (this.progressBar) {
      this.progressBar.style.width = '100%';
    }
    if (this.progressText) {
      this.progressText.textContent = `مكتمل 100%`;
    }

    this.renderCompletionScreen();
  }

  renderCompletionScreen() {
    this.container.innerHTML = `
      <div class="completion-card">
        <div class="completion-icon-wrapper">🌿</div>
        <h2 class="completion-title">أحسنت، أتممت أذكارك</h2>
        <p class="completion-prayer">تقبل الله ذكرك، وشرح صدرك، وجعل لسانك عامرًا بذكره وطمأنينة قلبه.</p>

        <div class="completion-actions">
          <a href="../index.html" class="primary-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            العودة للرئيسية
          </a>

          <button class="secondary-btn" id="restart-session-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            إعادة الأذكار
          </button>

          <button class="secondary-btn" id="share-achievement-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
            مشاركة الإنجاز
          </button>
        </div>
      </div>
    `;

    const restartBtn = document.getElementById('restart-session-btn');
    const shareBtn = document.getElementById('share-achievement-btn');

    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        this.currentIndex = 0;
        this.currentCount = 0;
        this.isCompleted = false;
        this.saveState();
        this.render();
      });
    }

    if (shareBtn && window.App) {
      shareBtn.addEventListener('click', () => {
        window.App.shareContent({
          title: `إتمام ${this.sessionTitle} — منصة البيان`,
          text: `الحمد لله، أتممت اليوم ${this.sessionTitle} على منصة البيان 🌿\n"أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ"`
        });
      });
    }
  }

  initKeyboardNavigation() {
    const FORM_FIELDS = ['INPUT', 'TEXTAREA', 'SELECT', 'OPTION'];
    // العناصر القابلة للتفعيل بالعناصر نفسها: مسافة على زر متركّز يجب أن تفعّل الزر ولا تُعدّ الذكر
    const ACTIVATABLE = ['BUTTON', 'A'];

    window.addEventListener('keydown', (e) => {
      if (this.isCompleted) return;
      if (e.repeat) return;

      const tagName = e.target.tagName;
      if (FORM_FIELDS.includes(tagName) || e.target.isContentEditable) return;

      if (e.code === 'Space') {
        if (ACTIVATABLE.includes(tagName)) return;
        e.preventDefault();
        this.handleTap();
      } else if (e.code === 'ArrowLeft') {
        // In RTL, ArrowLeft navigates to Next item
        e.preventDefault();
        this.next();
      } else if (e.code === 'ArrowRight') {
        // In RTL, ArrowRight navigates to Previous item
        e.preventDefault();
        this.previous();
      }
    });
  }
}

window.DhikrSessionEngine = DhikrSessionEngine;
