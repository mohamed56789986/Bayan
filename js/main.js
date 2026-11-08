/**
 * منصة البيان — الملف الرئيسي والتفاعلات المشتركة (Main Application Script)
 * يدير الثيم، القائمة المتنقلة، التنبيهات (Toast)، النسخ والمشاركة، والصفحة الرئيسية
 */

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

const App = {
  init() {
    this.initTheme();
    this.initMobileMenu();
    this.initMobileDropdowns();
    this.initToastContainer();
    this.initSplash();
    this.initHomepageFeatures();
  },

  // ------------------------------------------------------------------------
  // Shared HTML escaping — every innerHTML interpolation goes through this
  // ------------------------------------------------------------------------
  escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  // ------------------------------------------------------------------------
  // Theme Management (Light / Dark)
  // ------------------------------------------------------------------------
  initTheme() {
    const savedTheme = window.AlBayanTheme
      ? window.AlBayanTheme.resolve()
      : (window.StorageManager ? window.StorageManager.loadTheme() : 'light');
    this.applyTheme(savedTheme);

    const toggleButtons = document.querySelectorAll('.theme-toggle-btn');
    toggleButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme(nextTheme);
        if (window.StorageManager) {
          window.StorageManager.saveTheme(nextTheme);
        }
        this.showToast(nextTheme === 'dark' ? 'تم تفعيل الوضع الليلي 🌙' : 'تم تفعيل الوضع النهاري ☀️');
      });
    });
  },

  applyTheme(theme) {
    const isDark = theme === 'dark';
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    // شريط المتصفح يتبع خلفية الهيدر الفعلية لا لون ثابت
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isDark ? '#141C16' : '#FCFAF5');

    this.updateThemeIcons(isDark ? '☀️' : '🌙');
  },

  updateThemeIcons(iconText) {
    const toggleButtons = document.querySelectorAll('.theme-toggle-btn');
    toggleButtons.forEach(btn => {
      btn.textContent = iconText;
      btn.setAttribute('aria-label', iconText === '🌙' ? 'تفعيل الوضع الليلي' : 'تفعيل الوضع النهاري');
    });
  },

  // ------------------------------------------------------------------------
  // Mobile Navigation Menu Drawer
  // ------------------------------------------------------------------------
  initMobileMenu() {
    const menuBtn = document.querySelector('.mobile-menu-btn');
    const drawer = document.querySelector('.mobile-nav-drawer');

    if (!menuBtn || !drawer) return;

    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = drawer.classList.contains('open');
      if (isOpen) {
        drawer.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
        menuBtn.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        `;
      } else {
        drawer.classList.add('open');
        menuBtn.setAttribute('aria-expanded', 'true');
        menuBtn.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        `;
      }
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (drawer.classList.contains('open') && !drawer.contains(e.target) && !menuBtn.contains(e.target)) {
        drawer.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
        menuBtn.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        `;
      }
    });

    drawer.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        drawer.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
      });
    });
  },

  // ------------------------------------------------------------------------
  // Expandable groups inside the mobile drawer
  // ------------------------------------------------------------------------
  initMobileDropdowns() {
    document.querySelectorAll('.mobile-dropdown-trigger').forEach((trigger) => {
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const parentGroup = trigger.closest('.mobile-nav-group');
        if (!parentGroup) return;
        const isOpen = parentGroup.classList.toggle('open');
        trigger.setAttribute('aria-expanded', String(isOpen));
      });
    });
  },

  // ------------------------------------------------------------------------
  // Toast Notifications
  // ------------------------------------------------------------------------
  initToastContainer() {
    if (!document.querySelector('.toast-container')) {
      const container = document.createElement('div');
      container.className = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      document.body.appendChild(container);
    }
  },

  showToast(message, duration = 3000) {
    const container = document.querySelector('.toast-container') || document.body;
    const toast = document.createElement('div');
    toast.className = 'toast';
    const icon = document.createElement('span');
    icon.textContent = '🌿';
    const label = document.createElement('span');
    label.textContent = message;
    toast.append(icon, document.createTextNode(' '), label);
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  // ------------------------------------------------------------------------
  // Clipboard & Web Share API
  // ------------------------------------------------------------------------
  async copyText(text, successMsg = 'تم نسخ النص بنجاح ✨') {
    if (!text) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      this.showToast(successMsg);
    } catch (err) {
      console.warn('Clipboard copy error:', err);
      this.showToast('تعذر النسخ تلقائيًا، يرجى التحديد والنسخ يدويًا');
    }
  },

  async shareContent({ title, text, url }) {
    const fullText = `${text}\n\n— منصة البيان | أذكارك، حصنك، وطمأنينة قلبك`;
    const shareData = {
      title: title || 'البيان — أذكار وأدعية',
      text: fullText,
      url: url || window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if (err.name !== 'AbortError') {
          // If share rejected or failed, fallback to copy
          this.copyText(fullText, 'تم نسخ الذكر لمشاركته ✨');
        }
      }
    } else {
      // Fallback to clipboard
      this.copyText(fullText, 'تم نسخ الذكر لمشاركته ✨');
    }
  },

  // ------------------------------------------------------------------------
  // Splash Screen Modal (Entrance Screen)
  // ------------------------------------------------------------------------
  initSplash() {
    const splash = document.getElementById('splash-screen');
    const enterBtn = document.getElementById('splash-enter-btn');
    if (!splash || !enterBtn) return;

    const modal = splash.querySelector('.splash-modal');
    const introStep = splash.querySelector('[data-splash-step="intro"]');
    const memorialStep = splash.querySelector('[data-splash-step="memorial"]');
    const nextBtn = document.getElementById('splash-next-btn');
    const backBtn = document.getElementById('splash-back-btn');

    const showSplashStep = (step) => {
      const showMemorial = step === 'memorial';
      if (introStep) introStep.hidden = showMemorial;
      if (memorialStep) memorialStep.hidden = !showMemorial;
      if (modal) {
        modal.classList.toggle('splash-intro-layout', !showMemorial);
        modal.classList.toggle('splash-memorial-layout', showMemorial);
      }
      splash.scrollTop = 0;
    };

    // شاشة الإهداء مخصصة لتجربة التطبيق المثبّت على الجوال.
    // نسخة الويب تبدأ مباشرة من الصفحة الرئيسية ولا يحجبها أي غطاء.
    const isStandaloneApp = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (!isStandaloneApp) {
      splash.classList.add('hidden');
      splash.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      return;
    }

    splash.removeAttribute('aria-hidden');
    showSplashStep('intro');

    // Check if user already dismissed splash in this session
    const alreadySeen = window.StorageManager && window.StorageManager.hasSeenSplash();

    if (alreadySeen) {
      splash.classList.add('hidden');
    } else {
      splash.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }

    enterBtn.addEventListener('click', () => {
      splash.classList.add('hidden');
      document.body.style.overflow = '';
      if (window.StorageManager) {
        window.StorageManager.setSeenSplash(true);
      }
    });

    if (nextBtn) {
      nextBtn.addEventListener('click', () => showSplashStep('memorial'));
    }

    if (backBtn) {
      backBtn.addEventListener('click', () => showSplashStep('intro'));
    }

    // Opens the same dedication screen shown when the application starts.
    const viewDedicationBtns = document.querySelectorAll('.open-dedication-btn');
    viewDedicationBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        showSplashStep('intro');
        splash.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
      });
    });
  },

  // ------------------------------------------------------------------------
  // Homepage Dynamic Widgets (Continue Session, Streak, Featured Dua)
  // ------------------------------------------------------------------------
  initHomepageFeatures() {
    this.renderContinueSession();
    this.renderDailyStreak();
    this.renderFeaturedDua();
  },

  renderContinueSession() {
    const container = document.getElementById('continue-session-container');
    if (!container || !window.StorageManager) return;

    const sessionOptions = {
      morning: { title: 'أذكار الصباح', url: 'pages/morning.html' },
      evening: { title: 'أذكار المساء', url: 'pages/evening.html' },
      sleep: { title: 'أذكار النوم', url: 'pages/sleep.html' }
    };
    const progressByType = Object.fromEntries(
      Object.keys(sessionOptions).map((type) => [type, window.StorageManager.loadProgress(type)])
    );
    const lastSession = window.StorageManager.loadLastSession();

    let activeSession = null;

    if (lastSession && sessionOptions[lastSession.type]) {
      const type = lastSession.type;
      const progress = progressByType[type];
      if (progress && progress.currentIndex < progress.totalItems && progress.totalItems > 0) {
        activeSession = {
          type,
          title: sessionOptions[type].title,
          currentIndex: progress.currentIndex + 1,
          totalItems: progress.totalItems,
          percent: Math.round(((progress.currentIndex + 1) / progress.totalItems) * 100),
          url: sessionOptions[type].url
        };
      }
    }

    if (!activeSession) {
      const resumableType = Object.keys(sessionOptions).find((type) => {
        const progress = progressByType[type];
        return progress && progress.currentIndex > 0 && progress.currentIndex < progress.totalItems;
      });
      if (resumableType) {
        const progress = progressByType[resumableType];
        activeSession = {
          type: resumableType,
          title: sessionOptions[resumableType].title,
          currentIndex: progress.currentIndex + 1,
          totalItems: progress.totalItems,
          percent: Math.round(((progress.currentIndex + 1) / progress.totalItems) * 100),
          url: sessionOptions[resumableType].url
        };
      }
    }

    if (activeSession) {
      container.style.display = 'block';
      container.innerHTML = `
        <div class="continue-card">
          <div class="continue-info">
            <span class="continue-header-tag">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              أكمل من حيث توقفت
            </span>
            <div class="continue-title">${activeSession.title} — الذكر ${activeSession.currentIndex} من ${activeSession.totalItems}</div>
            <div class="continue-progress-bar-wrap">
              <div class="continue-progress-fill" style="width: ${activeSession.percent}%;"></div>
            </div>
          </div>
          <a href="${activeSession.url}" class="continue-btn">
            متابعة القراءة
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </a>
        </div>
      `;
    } else {
      container.style.display = 'none';
    }
  },

  renderDailyStreak() {
    const streakEl = document.getElementById('daily-streak-val');
    if (!streakEl || !window.StorageManager) return;

    const streak = window.StorageManager.loadStreak();
    const count = streak.count || 0;
    streakEl.textContent = `${count} ${count === 1 ? 'يوم' : 'أيام متتالية'}`;
  },

  renderFeaturedDua() {
    const container = document.getElementById('featured-dua-container');
    if (!container || typeof duasData === 'undefined' || !duasData.length) return;

    // Pick dua based on the day of year for consistency during the day
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
    const dua = duasData[dayOfYear % duasData.length];

    const esc = this.escapeHtml;
    container.innerHTML = `
      <div class="featured-dua-card">
        <div class="featured-dua-header">
          <span class="section-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            دعاء مختار لليوم
          </span>
          <span class="dua-category-badge">${esc(dua.categoryName)}</span>
        </div>
        <div class="featured-dua-text">"${esc(dua.text)}"</div>
        <div class="dua-source-text">المصدر: ${esc(dua.source)}</div>
        <div class="card-actions-bar">
          <button class="tool-btn copy-featured-btn" aria-label="نسخ الدعاء">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            نسخ
          </button>
          <button class="tool-btn share-featured-btn" aria-label="مشاركة الدعاء">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
            مشاركة
          </button>
        </div>
      </div>
    `;

    const copyBtn = container.querySelector('.copy-featured-btn');
    const shareBtn = container.querySelector('.share-featured-btn');

    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        App.copyText(`"${dua.text}"\nالمصدر: ${dua.source}`);
      });
    }

    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        App.shareContent({
          title: 'دعاء اليوم من منصة البيان',
          text: `"${dua.text}"\nالمصدر: ${dua.source}`
        });
      });
    }
  },

};

window.App = App;

